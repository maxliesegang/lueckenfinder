import {
  mergeOsmCriteria,
  type OsmCriteria,
  parseOsmCriteria,
} from "./dataset-criteria";
import { getTopicCriteria } from "./topics";
import type { DatasetDefinition } from "./types";
import { httpUrl, isRecord, nonEmptyString, safeId } from "./validation";

/**
 * Parse an untrusted value into a serializable dataset definition.
 * Unknown properties, including a forged `source`, are intentionally dropped.
 *
 * A `topic` supplies OSM criteria the dataset does not state itself (see
 * topics.ts). The result is fully expanded — the criteria a topic contributed
 * are written out — so everything downstream, including storage and share
 * payloads, keeps working without knowing topics exist.
 */
export function parseDatasetDefinition(value: unknown): DatasetDefinition | null {
  if (!isRecord(value)) return null;

  const id = safeId(value.id);
  const label = nonEmptyString(value.label);
  const geojsonUrl = httpUrl(value.geojsonUrl);
  const attribution = nonEmptyString(value.attribution);

  if (id === null || label === null || geojsonUrl === null || attribution === null) {
    return null;
  }

  const own = parseOsmCriteria(value);
  if (own === null) return null;

  const topic = parseTopic(value.topic);
  if (topic === null) return null;

  const criteria = mergeOsmCriteria(topic.criteria, own);
  // Without strict criteria there is nothing to query for.
  if (criteria.osmSelector === undefined && criteria.overpassQuery === undefined) {
    return null;
  }

  const definition: DatasetDefinition = {
    id,
    label,
    geojsonUrl,
    attribution,
    ...criteria,
  };

  if (topic.id !== undefined) definition.topic = topic.id;

  // Only the exception is recorded; a source is exhaustive unless it says
  // otherwise, so storing `true` would just be noise in every payload.
  if (value.exhaustive !== undefined) {
    if (typeof value.exhaustive !== "boolean") return null;
    if (!value.exhaustive) definition.exhaustive = false;
  }

  if (value.sourceUrl !== undefined) {
    const sourceUrl = httpUrl(value.sourceUrl);
    if (sourceUrl === null) return null;
    definition.sourceUrl = sourceUrl;
  }

  return definition;
}

export function isDatasetDefinition(value: unknown): value is DatasetDefinition {
  return parseDatasetDefinition(value) !== null;
}

/**
 * Resolve the optional `topic` reference. An unknown topic fails the parse
 * rather than degrading to "no criteria": a pack naming a topic this build does
 * not ship is a mistake its author should see, not a dataset that quietly
 * queries something else.
 */
function parseTopic(
  value: unknown,
): { id: string | undefined; criteria: OsmCriteria } | null {
  if (value === undefined) return { id: undefined, criteria: {} };

  const id = safeId(value);
  if (id === null) return null;
  const criteria = getTopicCriteria(id);
  return criteria === null ? null : { id, criteria };
}
