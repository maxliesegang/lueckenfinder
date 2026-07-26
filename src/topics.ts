/**
 * The shipped catalog of OSM topics.
 *
 * A **topic** is a named, reusable bundle of OSM criteria — the selectors and
 * tag expectations for one kind of real-world thing. `leisure=playground` means
 * the same in every city, so a dataset names a topic instead of restating it:
 *
 *   { "id": "ka-playgrounds", "topic": "playground", "geojsonUrl": "…", … }
 *
 * That leaves each city pack holding only what is genuinely local — the source
 * URL, the label, the attribution, and any `tagMapping.fromProps` naming
 * columns that only that city's export has. Improving a selector then improves
 * every city at once, which is the drift this catalog exists to prevent.
 *
 * The catalog is shipped code, reviewed like any preset. Imported packs may
 * reference these topics but cannot define their own: a remote pack that could
 * ship criteria would widen what an untrusted URL can put into an Overpass
 * query, and `osm-selector.ts` narrows that surface deliberately.
 */

import rawTopics from "../presets/topics.json";
import { type OsmCriteria, parseOsmCriteria } from "./dataset-criteria";
import { isRecord, safeId } from "./validation";

export const OSM_TOPICS: ReadonlyMap<string, OsmCriteria> =
  parseTopicCatalog(rawTopics);

/** Criteria for a topic id, or null when no such topic is shipped. */
export function getTopicCriteria(topicId: string): OsmCriteria | null {
  return OSM_TOPICS.get(topicId) ?? null;
}

function parseTopicCatalog(value: unknown): ReadonlyMap<string, OsmCriteria> {
  if (!isRecord(value)) {
    throw new TypeError("Topic catalog is not an object");
  }

  const topics = new Map<string, OsmCriteria>();
  for (const [topicId, entry] of Object.entries(value)) {
    if (safeId(topicId) === null || !isRecord(entry)) {
      throw new TypeError(`Invalid topic id "${topicId}"`);
    }
    const criteria = parseOsmCriteria(entry);
    if (criteria === null || Object.keys(criteria).length === 0) {
      throw new TypeError(`Invalid topic "${topicId}"`);
    }
    topics.set(topicId, criteria);
  }

  return topics;
}
