import type {
  Dataset,
  DatasetPoint,
  PropertyTagMapping,
  PropertyTagRule,
  TagGap,
  TagMapping,
} from "./types";

type Tags = Record<string, string>;

/** Resolve the full set of OSM tags implied by one official record. */
export function expectedTags(official: DatasetPoint, dataset: Dataset): Tags {
  return resolveTagMapping(official.props, dataset.tagMapping);
}

/** Find expected tags that are missing from or differ on an OSM object. */
export function findTagGaps(
  official: DatasetPoint,
  osm: DatasetPoint,
  dataset: Dataset,
): TagGap[] {
  const expected = expectedTags(official, dataset);
  const gaps: TagGap[] = [];

  for (const [key, expectedValue] of Object.entries(expected)) {
    const actualValue = osm.props[key];
    const osmValue = typeof actualValue === "string" ? actualValue : undefined;
    if (osmValue !== expectedValue) {
      gaps.push({ key, expected: expectedValue, osmValue });
    }
  }

  return gaps;
}

function resolveTagMapping(
  properties: DatasetPoint["props"],
  tagMapping: TagMapping | undefined,
): Tags {
  const tags = new Map(Object.entries(tagMapping?.fixed ?? {}));

  for (const [osmKey, propertyMapping] of Object.entries(tagMapping?.fromProps ?? {})) {
    const value = resolvePropertyValue(properties, propertyMapping);
    if (value !== null) tags.set(osmKey, value);
  }

  return Object.fromEntries(tags);
}

function resolvePropertyValue(
  properties: DatasetPoint["props"],
  propertyMapping: PropertyTagMapping,
): string | null {
  const rule = normalizePropertyTagRule(propertyMapping);
  const sourceValue = readProperty(properties, rule.property);
  if (sourceValue === null) return null;

  const extractedValue = extractValue(sourceValue, rule.extract);
  if (extractedValue === null) return null;

  if (rule.constant !== undefined) return rule.constant;
  if (rule.values !== undefined) {
    return Object.hasOwn(rule.values, extractedValue)
      ? rule.values[extractedValue]
      : null;
  }
  return extractedValue;
}

function normalizePropertyTagRule(
  propertyMapping: PropertyTagMapping,
): PropertyTagRule {
  return typeof propertyMapping === "string"
    ? { property: propertyMapping }
    : propertyMapping;
}

function readProperty(
  properties: DatasetPoint["props"],
  property: string,
): string | null {
  const source = properties[property];
  if (source === undefined || source === null) return null;
  if (
    typeof source !== "string" &&
    typeof source !== "number" &&
    typeof source !== "boolean"
  ) {
    return null;
  }
  if (typeof source === "number" && !Number.isFinite(source)) return null;

  const value = String(source).trim();
  return value === "" ? null : value;
}

function extractValue(value: string, pattern: string | undefined): string | null {
  if (pattern === undefined) return value;

  const extracted = new RegExp(pattern).exec(value)?.[1]?.trim();
  return extracted ? extracted : null;
}
