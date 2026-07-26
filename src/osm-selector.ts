/**
 * Declarative OSM tag selectors.
 *
 * A selector is the single source of truth for three things that used to be
 * written out separately (and could therefore drift apart):
 *
 *   1. the Overpass QL that fetches candidate objects  -> `selectorQuery`
 *   2. the predicate deciding whether a fetched object satisfies the selector
 *      -> `matchesSelector`
 *   3. the OSM tags an official record is expected to carry
 *      -> `selectorFixedTags`
 *
 * Because (2) exists, the comparison engine can fetch strict and relaxed
 * candidates in one Overpass call and split them locally; see `dataset-query.ts`.
 *
 * Raw `overpassQuery` strings remain supported for queries this shape cannot
 * express — they simply give up (2), and so cost a second Overpass request.
 */

import type { DatasetPoint } from "./types";
import { isRecord, nonEmptyString } from "./validation";

export const OSM_ELEMENT_TYPES = ["node", "way", "relation", "nwr"] as const;
export type OsmElementType = (typeof OSM_ELEMENT_TYPES)[number];

/** One conjunctive set of tag conditions. Every field must hold. */
export interface OsmTagFilter {
  /** Tags that must be present with exactly this value. */
  tags?: Record<string, string>;
  /**
   * Keys that must carry one of the listed values, treating the key as an OSM
   * semicolon list: `sport=table_tennis;basketball` satisfies
   * `{ sport: ["table_tennis"] }`, which an exact `tags` condition would miss.
   */
  anyValue?: Record<string, string[]>;
  /** Keys that must be present, whatever their value. */
  present?: string[];
  /** Keys that must be absent. */
  absent?: string[];
  /**
   * Keys that must not carry any of the listed values. An absent key satisfies
   * this. A bare string is accepted as a one-value list, so
   * `{ access: "private" }` and `{ access: ["private"] }` mean the same thing;
   * parsing normalises both to a list. Real exclusions are rarely single —
   * a public playground is neither `access=private` nor `access=no`.
   */
  exclude?: Record<string, string[]>;
}

/** OSM encodes multiple values for one key as a semicolon-separated list. */
const VALUE_SEPARATOR = ";";

export interface OsmSelector extends OsmTagFilter {
  /** Element types to query. Defaults to ["nwr"]. */
  types?: OsmElementType[];
  /**
   * Alternatives. The selector matches when ANY branch matches; each branch is
   * combined with the conditions declared directly on the selector, so shared
   * conditions are written once.
   */
  anyOf?: OsmTagFilter[];
}

export function parseOsmSelector(value: unknown): OsmSelector | null {
  if (!isRecord(value)) return null;

  const base = parseTagFilter(value);
  if (base === null) return null;
  const selector: OsmSelector = { ...base };

  if (value.types !== undefined) {
    const types = parseTypes(value.types);
    if (types === null) return null;
    selector.types = types;
  }

  if (value.anyOf !== undefined) {
    if (!Array.isArray(value.anyOf) || value.anyOf.length === 0) return null;
    const branches: OsmTagFilter[] = [];
    for (const entry of value.anyOf) {
      if (!isRecord(entry)) return null;
      const branch = parseTagFilter(entry);
      if (branch === null || isEmptyFilter(branch)) return null;
      branches.push(branch);
    }
    selector.anyOf = branches;
  }

  // A selector with no conditions at all would query the whole bounding box.
  if (isEmptyFilter(selector) && selector.anyOf === undefined) return null;
  return selector;
}

/**
 * Build the Overpass QL union body for a selector. One statement per element
 * type per alternative; `bboxToken` is appended so the caller's bbox
 * substitution applies unchanged.
 */
export function selectorQuery(selector: OsmSelector, bboxToken: string): string {
  const types = selector.types ?? ["nwr"];
  const branches = selector.anyOf ?? [{}];

  return branches
    .flatMap((branch) => {
      const filters = filterExpression(selector, branch);
      return types.map((type) => `${type}${filters}(${bboxToken});`);
    })
    .join("\n");
}

/** Whether an OSM object satisfies the selector. */
export function matchesSelector(selector: OsmSelector, point: DatasetPoint): boolean {
  if (!matchesTypes(selector.types, point)) return false;
  if (!matchesFilter(selector, point.props)) return false;
  const branches = selector.anyOf ?? [{}];
  return branches.some((branch) => matchesFilter(branch, point.props));
}

/**
 * Tags implied by the selector for every matching object: those declared
 * directly on it, plus any that every `anyOf` branch agrees on. A tag only some
 * branches require holds for some matches but not all, so it is not an
 * expectation. `anyValue` never contributes — a match may carry any one of the
 * listed values, or a semicolon list of several, so no single value is implied.
 */
export function selectorFixedTags(
  selector: OsmSelector | undefined,
): Record<string, string> {
  if (selector === undefined) return {};
  const tags = { ...selector.tags };

  const [first, ...rest] = selector.anyOf ?? [];
  for (const [key, value] of Object.entries(first?.tags ?? {})) {
    if (rest.every((branch) => branch.tags?.[key] === value)) tags[key] = value;
  }

  return tags;
}

/**
 * Whether an OSM tag value already carries an expected value, treating the tag
 * as a semicolon list. `sport=table_tennis;basketball` satisfies an expectation
 * of `table_tennis`: the object is tagged, just for more than one sport, and
 * reporting that as a gap would send someone to "fix" correct data.
 */
export function matchesExpectedValue(expected: string, actual: string): boolean {
  return actual === expected || valueEntries(actual).includes(expected);
}

/**
 * Parse a `key=value` per line block, as typed in the dataset form. Blank lines
 * and `#` comments are ignored. Returns null on any malformed line so the form
 * can point at the field rather than silently dropping a tag.
 */
export function parseTagLines(text: string): Record<string, string> | null {
  const tags: Record<string, string> = {};

  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf("=");
    if (separator <= 0) return null;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();
    if (!isTagText(key) || !isTagText(value)) return null;
    tags[key] = value;
  }

  return Object.keys(tags).length > 0 ? tags : null;
}

/** Render tags back into the `key=value` block the form edits. */
export function formatTagLines(tags: Record<string, string>): string {
  return Object.entries(tags)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
}

function parseTagFilter(value: Record<string, unknown>): OsmTagFilter | null {
  const filter: OsmTagFilter = {};

  if (value.tags !== undefined) {
    const tags = parseTagRecord(value.tags);
    if (tags === null) return null;
    filter.tags = tags;
  }

  if (value.exclude !== undefined) {
    const exclude = parseExcludedValues(value.exclude);
    if (exclude === null) return null;
    filter.exclude = exclude;
  }

  if (value.anyValue !== undefined) {
    const anyValue = parseValueLists(value.anyValue);
    if (anyValue === null) return null;
    filter.anyValue = anyValue;
  }

  for (const field of ["present", "absent"] as const) {
    if (value[field] === undefined) continue;
    const keys = parseKeyList(value[field]);
    if (keys === null) return null;
    filter[field] = keys;
  }

  return filter;
}

function parseTagRecord(value: unknown): Record<string, string> | null {
  if (!isRecord(value)) return null;
  const entries = Object.entries(value);
  if (entries.length === 0) return null;

  const tags: Record<string, string> = {};
  for (const [key, entry] of entries) {
    if (typeof entry !== "string" || !isTagText(key) || !isTagText(entry)) return null;
    tags[key] = entry;
  }
  return tags;
}

/**
 * Parse `exclude`, accepting a bare string as a one-value list so the shorter
 * form stays valid. Unlike `anyValue`, a value carrying a semicolon is allowed:
 * exclusion compares whole values, so `access=private;yes` is simply a value
 * that no listed entry equals.
 */
function parseExcludedValues(value: unknown): Record<string, string[]> | null {
  if (!isRecord(value)) return null;
  const entries = Object.entries(value);
  if (entries.length === 0) return null;

  const excluded: Record<string, string[]> = {};
  for (const [key, entry] of entries) {
    if (!isTagText(key)) return null;
    if (typeof entry === "string") {
      if (!isTagText(entry)) return null;
      excluded[key] = [entry];
      continue;
    }
    const values = parseKeyList(entry);
    if (values === null) return null;
    excluded[key] = values;
  }
  return excluded;
}

function parseValueLists(value: unknown): Record<string, string[]> | null {
  if (!isRecord(value)) return null;
  const entries = Object.entries(value);
  if (entries.length === 0) return null;

  const lists: Record<string, string[]> = {};
  for (const [key, entry] of entries) {
    if (!isTagText(key)) return null;
    const values = parseKeyList(entry);
    // A value carrying the separator could never match one list entry.
    if (values === null || values.some((item) => item.includes(VALUE_SEPARATOR))) {
      return null;
    }
    lists[key] = values;
  }
  return lists;
}

function parseKeyList(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const keys: string[] = [];
  for (const entry of value) {
    const key = nonEmptyString(entry);
    if (key === null || !isTagText(key)) return null;
    keys.push(key);
  }
  return keys;
}

function parseTypes(value: unknown): OsmElementType[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const types: OsmElementType[] = [];
  for (const entry of value) {
    if (!isOsmElementType(entry) || types.includes(entry)) return null;
    types.push(entry);
  }
  return types;
}

function isOsmElementType(value: unknown): value is OsmElementType {
  return OSM_ELEMENT_TYPES.includes(value as OsmElementType);
}

/**
 * Tag keys and values are interpolated into Overpass QL. Quotes and backslashes
 * are escaped by `quote`; control characters are rejected outright rather than
 * escaped, because no real OSM tag contains them and allowing them only widens
 * what a remote city pack can inject into a query.
 */
function isTagText(value: string): boolean {
  if (value.length === 0) return false;
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    if (code < 0x20 || code === 0x7f) return false;
  }
  return true;
}

function isEmptyFilter(filter: OsmTagFilter): boolean {
  return (
    filter.tags === undefined &&
    filter.anyValue === undefined &&
    filter.present === undefined &&
    filter.absent === undefined &&
    filter.exclude === undefined
  );
}

/**
 * Conditions declared on the selector come first so shared filters read the
 * same across every alternative.
 */
function filterExpression(base: OsmTagFilter, branch: OsmTagFilter): string {
  const parts: string[] = [];

  for (const filter of [base, branch]) {
    for (const [key, value] of Object.entries(filter.tags ?? {})) {
      parts.push(`[${quote(key)}=${quote(value)}]`);
    }
  }
  for (const filter of [base, branch]) {
    for (const [key, values] of Object.entries(filter.anyValue ?? {})) {
      parts.push(`[${quote(key)}~${quote(valueListPattern(values))}]`);
    }
  }
  for (const filter of [base, branch]) {
    for (const key of filter.present ?? []) parts.push(`[${quote(key)}]`);
    for (const key of filter.absent ?? []) parts.push(`[!${quote(key)}]`);
  }
  for (const filter of [base, branch]) {
    for (const [key, values] of Object.entries(filter.exclude ?? {})) {
      parts.push(
        values.length === 1
          ? `[${quote(key)}!=${quote(values[0])}]`
          : `[${quote(key)}!~${quote(exactValuePattern(values))}]`,
      );
    }
  }

  return parts.join("");
}

function quote(value: string): string {
  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

/**
 * Regex matching any of `values` as a whole entry of a semicolon list, so it
 * hits both `sport=table_tennis` and `sport=table_tennis;basketball`. Surrounding
 * spaces are tolerated because `a; b` occurs in the wild. Kept to constructs
 * that mean the same thing in Overpass's regex flavour and in JavaScript's,
 * since `matchesFilter` has to agree with what this produces.
 */
function valueListPattern(values: string[]): string {
  return `(^|;)[ ]*(${values.map(escapeRegex).join("|")})[ ]*($|;)`;
}

/**
 * Regex matching any of `values` as the whole tag value. Used for `exclude`
 * with more than one value, where Overpass offers no repeatable `!=`; the
 * anchors keep it to whole values, so excluding `no` never hits `nozzle`.
 */
function exactValuePattern(values: string[]): string {
  return `^(${values.map(escapeRegex).join("|")})$`;
}

function escapeRegex(value: string): string {
  return value.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Entries of an OSM value, treating it as a semicolon list. */
function valueEntries(value: string): string[] {
  return value.split(VALUE_SEPARATOR).map((entry) => entry.trim());
}

function matchesTypes(
  types: OsmElementType[] | undefined,
  point: DatasetPoint,
): boolean {
  if (types === undefined || types.includes("nwr")) return true;
  const elementType = point.osmRef?.split("/")[0];
  return elementType !== undefined && types.includes(elementType as OsmElementType);
}

function matchesFilter(filter: OsmTagFilter, props: DatasetPoint["props"]): boolean {
  for (const [key, value] of Object.entries(filter.tags ?? {})) {
    if (props[key] !== value) return false;
  }
  for (const [key, values] of Object.entries(filter.anyValue ?? {})) {
    const actual = props[key];
    if (typeof actual !== "string") return false;
    const entries = valueEntries(actual);
    if (!values.some((value) => entries.includes(value))) return false;
  }
  for (const key of filter.present ?? []) {
    if (typeof props[key] !== "string") return false;
  }
  for (const key of filter.absent ?? []) {
    if (typeof props[key] === "string") return false;
  }
  for (const [key, values] of Object.entries(filter.exclude ?? {})) {
    const actual = props[key];
    if (typeof actual === "string" && values.includes(actual)) return false;
  }
  return true;
}
