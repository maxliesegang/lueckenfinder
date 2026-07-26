/**
 * The OSM side of a dataset: what an official record is expected to look like
 * in OpenStreetMap, independent of which city published the record.
 *
 * These four fields are shared verbatim between cities — `leisure=playground`
 * means the same thing in Karlsruhe and in Leipzig — so they are parsed here
 * rather than in `dataset-definition.ts`, and a reusable bundle of them is what
 * `topics.ts` calls a topic. A dataset merges its topic's criteria with its own
 * (`mergeOsmCriteria`), which is what keeps one city's improvement from
 * silently leaving the other cities behind.
 */

import { type OsmSelector, parseOsmSelector } from "./osm-selector";
import type { PropertyTagMapping, PropertyTagRule, TagMapping } from "./types";
import { isRecord, nonEmptyString } from "./validation";

/**
 * Placeholder every Overpass query must contain. `overpass.ts` replaces it
 * with the official data extent at query time; validators and form hints share
 * this constant so the contract cannot drift between them.
 */
export const BBOX_TOKEN = "{{bbox}}";

/**
 * Why a raw Overpass body was rejected. The form maps these to field-level
 * messages; the parser only cares that the result is null.
 */
export type OverpassQueryProblem = "bbox" | "settings" | "out";

/** Settings headers such as [out:json] or [timeout:90]. */
const SETTINGS_HEADER = /\[\s*(?:out|timeout|maxsize|bbox|date|diff|adiff)\s*:/i;

/**
 * A statement-initial `out`, `>` or `<`. Anchoring to the start of a statement
 * keeps tag values such as ["name"="Layout"] from matching.
 */
const OUTPUT_STATEMENT = /(?:^|;)\s*(?:out\b|>|<)/;

/** The OSM-side fields of a dataset. Every one is optional on its own. */
export interface OsmCriteria {
  osmSelector?: OsmSelector;
  overpassQuery?: string;
  broadSelector?: OsmSelector;
  broadMatchQuery?: string;
  tagMapping?: TagMapping;
}

/**
 * Datasets supply only the statements inside the union; `overpass.ts` wraps
 * them with its own settings header and `out` statement. A query pasted whole
 * from overpass-turbo would produce a syntactically broken request and an
 * opaque server error, so reject it here with a reason the form can explain.
 */
export function checkOverpassQuery(query: string): OverpassQueryProblem | null {
  if (!query.includes(BBOX_TOKEN)) return "bbox";
  if (SETTINGS_HEADER.test(query)) return "settings";
  if (OUTPUT_STATEMENT.test(query)) return "out";
  return null;
}

/**
 * Parse the OSM-side fields out of an untrusted record. Absent fields are left
 * absent; a malformed one fails the whole parse. Stating criteria both ways in
 * the same half (strict or relaxed) is rejected: accepting both would
 * reintroduce the drift `osmSelector` exists to prevent, and only one form
 * drives the query anyway.
 *
 * Whether the result says *enough* is the caller's business: a dataset needs
 * strict criteria from somewhere, but a dataset that gets them from a topic
 * states none of its own.
 */
export function parseOsmCriteria(value: Record<string, unknown>): OsmCriteria | null {
  if (value.osmSelector !== undefined && value.overpassQuery !== undefined) return null;
  if (value.broadSelector !== undefined && value.broadMatchQuery !== undefined)
    return null;

  const criteria: OsmCriteria = {};

  for (const field of ["osmSelector", "broadSelector"] as const) {
    if (value[field] === undefined) continue;
    const selector = parseOsmSelector(value[field]);
    if (selector === null) return null;
    criteria[field] = selector;
  }

  for (const field of ["overpassQuery", "broadMatchQuery"] as const) {
    if (value[field] === undefined) continue;
    const query = bboxQuery(value[field]);
    if (query === null) return null;
    criteria[field] = query;
  }

  if (value.tagMapping !== undefined) {
    const tagMapping = parseTagMapping(value.tagMapping);
    if (tagMapping === null) return null;
    criteria.tagMapping = tagMapping;
  }

  return criteria;
}

/**
 * Layer a dataset's own criteria over its topic's.
 *
 * The strict and relaxed criteria are taken whole from whichever side states
 * them, never mixed: a dataset that overrides `osmSelector` must not silently
 * inherit the topic's `overpassQuery`, or it would state its strict criteria
 * twice. Tag mappings do merge key by key, since a city's `fromProps` names
 * columns only that city's export has, and belongs alongside the topic's fixed
 * tags rather than replacing them.
 *
 * Merging is idempotent: re-parsing an already merged definition takes every
 * slot from the definition and reproduces it unchanged, so storage and share
 * payloads round-trip without a migration.
 */
export function mergeOsmCriteria(topic: OsmCriteria, own: OsmCriteria): OsmCriteria {
  const strict =
    own.osmSelector !== undefined || own.overpassQuery !== undefined ? own : topic;
  const broad =
    own.broadSelector !== undefined || own.broadMatchQuery !== undefined ? own : topic;

  const merged: OsmCriteria = {};
  if (strict.osmSelector !== undefined) merged.osmSelector = strict.osmSelector;
  if (strict.overpassQuery !== undefined) merged.overpassQuery = strict.overpassQuery;
  if (broad.broadSelector !== undefined) merged.broadSelector = broad.broadSelector;
  if (broad.broadMatchQuery !== undefined) {
    merged.broadMatchQuery = broad.broadMatchQuery;
  }

  const tagMapping = mergeTagMapping(topic.tagMapping, own.tagMapping);
  if (tagMapping !== null) merged.tagMapping = tagMapping;

  return merged;
}

function mergeTagMapping(
  topic: TagMapping | undefined,
  own: TagMapping | undefined,
): TagMapping | null {
  if (topic === undefined) return own ?? null;
  if (own === undefined) return topic;

  const merged: TagMapping = {};
  if (topic.fixed !== undefined || own.fixed !== undefined) {
    merged.fixed = { ...topic.fixed, ...own.fixed };
  }
  if (topic.fromProps !== undefined || own.fromProps !== undefined) {
    merged.fromProps = { ...topic.fromProps, ...own.fromProps };
  }
  return merged;
}

function parseTagMapping(value: unknown): TagMapping | null {
  if (!isRecord(value)) return null;
  const tagMapping: TagMapping = {};

  if (value.fixed !== undefined) {
    const fixed = stringRecord(value.fixed);
    if (fixed === null) return null;
    tagMapping.fixed = fixed;
  }
  if (value.fromProps !== undefined) {
    const fromProps = propertyTagRules(value.fromProps);
    if (fromProps === null) return null;
    tagMapping.fromProps = fromProps;
  }

  return tagMapping;
}

function propertyTagRules(value: unknown): Record<string, PropertyTagMapping> | null {
  if (!isRecord(value)) return null;
  const rules: Record<string, PropertyTagMapping> = {};

  for (const [osmKey, entry] of Object.entries(value)) {
    if (osmKey.length === 0) return null;
    if (typeof entry === "string") {
      const property = nonEmptyString(entry);
      if (property === null) return null;
      rules[osmKey] = property;
      continue;
    }
    if (!isRecord(entry)) return null;

    const property = nonEmptyString(entry.property);
    if (property === null) return null;
    const rule: PropertyTagRule = { property };

    if (entry.extract !== undefined) {
      const extract = nonEmptyString(entry.extract);
      if (extract === null || !isValidCapturePattern(extract)) return null;
      rule.extract = extract;
    }
    if (entry.constant !== undefined) {
      const constant = nonEmptyString(entry.constant);
      if (constant === null || entry.values !== undefined) return null;
      rule.constant = constant;
    }
    if (entry.values !== undefined) {
      const values = stringRecord(entry.values);
      if (values === null) return null;
      rule.values = values;
    }
    rules[osmKey] = rule;
  }

  return rules;
}

function stringRecord(value: unknown): Record<string, string> | null {
  if (!isRecord(value)) return null;
  const entries = Object.entries(value);
  for (const [key, entry] of entries) {
    if (key.length === 0 || typeof entry !== "string" || entry.length === 0) {
      return null;
    }
  }
  return Object.fromEntries(entries) as Record<string, string>;
}

function isValidCapturePattern(pattern: string): boolean {
  try {
    new RegExp(pattern);
    return hasCaptureGroup(pattern);
  } catch {
    return false;
  }
}

function hasCaptureGroup(pattern: string): boolean {
  let escaped = false;
  let inCharacterClass = false;

  for (let index = 0; index < pattern.length; index++) {
    const character = pattern[index];
    if (escaped) {
      escaped = false;
    } else if (character === "\\") {
      escaped = true;
    } else if (character === "[") {
      inCharacterClass = true;
    } else if (character === "]") {
      inCharacterClass = false;
    } else if (character === "(" && !inCharacterClass && pattern[index + 1] !== "?") {
      return true;
    }
  }
  return false;
}

function bboxQuery(value: unknown): string | null {
  const query = nonEmptyString(value);
  if (query === null) return null;
  return checkOverpassQuery(query) === null ? query : null;
}
