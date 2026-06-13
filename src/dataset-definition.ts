import type { DatasetDefinition, PropertyTagMapping, PropertyTagRule } from "./types";
import { isRecord } from "./validation";

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const BBOX_TOKEN = "{{bbox}}";

/**
 * Parse an untrusted value into a serializable dataset definition.
 * Unknown properties, including a forged `source`, are intentionally dropped.
 */
export function parseDatasetDefinition(value: unknown): DatasetDefinition | null {
  if (!isRecord(value)) return null;

  const id = nonEmptyString(value.id);
  const label = nonEmptyString(value.label);
  const geojsonUrl = httpUrl(value.geojsonUrl);
  const overpassQuery = bboxQuery(value.overpassQuery);
  const attribution = nonEmptyString(value.attribution);

  if (
    id === null ||
    !SAFE_ID.test(id) ||
    label === null ||
    geojsonUrl === null ||
    overpassQuery === null ||
    attribution === null
  ) {
    return null;
  }

  const definition: DatasetDefinition = {
    id,
    label,
    geojsonUrl,
    overpassQuery,
    attribution,
  };

  if (value.sourceUrl !== undefined) {
    const sourceUrl = httpUrl(value.sourceUrl);
    if (sourceUrl === null) return null;
    definition.sourceUrl = sourceUrl;
  }

  if (value.broadMatchQuery !== undefined) {
    const broadMatchQuery = bboxQuery(value.broadMatchQuery);
    if (broadMatchQuery === null) return null;
    definition.broadMatchQuery = broadMatchQuery;
  }

  if (value.tagMapping !== undefined) {
    const tagMapping = parseTagMapping(value.tagMapping);
    if (tagMapping === null) return null;
    definition.tagMapping = tagMapping;
  }

  return definition;
}

export function isDatasetDefinition(value: unknown): value is DatasetDefinition {
  return parseDatasetDefinition(value) !== null;
}

function parseTagMapping(value: unknown): DatasetDefinition["tagMapping"] | null {
  if (!isRecord(value)) return null;
  const tagMapping: NonNullable<DatasetDefinition["tagMapping"]> = {};

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
      if (extract === null || !validCapturePattern(extract)) return null;
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

function validCapturePattern(pattern: string): boolean {
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
  return query?.includes(BBOX_TOKEN) ? query : null;
}

function httpUrl(value: unknown): string | null {
  const text = nonEmptyString(value);
  if (text === null) return null;
  try {
    const url = new URL(text);
    return url.protocol === "http:" || url.protocol === "https:" ? text : null;
  } catch {
    return null;
  }
}

function nonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
