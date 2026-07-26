/**
 * Turns a dataset definition into the Overpass request(s) the comparison engine
 * actually issues.
 *
 * A dataset states its strict OSM criteria either declaratively (`osmSelector`)
 * or as raw Overpass QL (`overpassQuery`), and optionally a relaxed variant
 * (`broadSelector` / `broadMatchQuery`) used to find objects that exist but are
 * under-tagged.
 *
 * When the strict criteria are declarative we can decide locally whether a
 * fetched object satisfies them, so both candidate sets are fetched in ONE
 * Overpass call and split afterwards. Raw QL gives us no such predicate, so it
 * keeps the historical two-call path.
 */

import { BBOX_TOKEN } from "./dataset-criteria";
import { matchesSelector, selectorQuery } from "./osm-selector";
import type { DatasetDefinition, DatasetPoint } from "./types";

export interface DatasetQueryPlan {
  /** Overpass body to run first. Always present. */
  query: string;
  /**
   * Set only on the two-call path: a second, relaxed query to run separately.
   * Its failure is non-fatal.
   */
  broadQuery: string | null;
  /**
   * Set only on the single-call path: splits `query` results into the strict
   * subset. When null, everything `query` returns is a strict match.
   */
  isStrictMatch: ((point: DatasetPoint) => boolean) | null;
}

/**
 * `strictQuery` and `broadQuery` are unioned into one body on the single-call
 * path. Overpass unions deduplicate elements, and `conflate` groups by
 * `osmRef` regardless, so an object appearing in both halves is counted once.
 */
export function buildQueryPlan(dataset: DatasetDefinition): DatasetQueryPlan {
  const strictQuery = resolveStrictQuery(dataset);
  const broadQuery = resolveBroadQuery(dataset);

  if (dataset.osmSelector === undefined || broadQuery === null) {
    return { query: strictQuery, broadQuery, isStrictMatch: null };
  }

  const selector = dataset.osmSelector;
  return {
    query: `${strictQuery}\n${broadQuery}`,
    broadQuery: null,
    isStrictMatch: (point) => matchesSelector(selector, point),
  };
}

/** The Overpass body a dataset's strict criteria resolve to. */
export function resolveStrictQuery(dataset: DatasetDefinition): string {
  if (dataset.osmSelector) return selectorQuery(dataset.osmSelector, BBOX_TOKEN);
  if (dataset.overpassQuery) return dataset.overpassQuery;
  // parseDatasetDefinition guarantees one of the two is present.
  throw new TypeError("Dataset has neither an osmSelector nor an overpassQuery");
}

/** The relaxed Overpass body, or null when the dataset declares none. */
export function resolveBroadQuery(dataset: DatasetDefinition): string | null {
  if (dataset.broadSelector) return selectorQuery(dataset.broadSelector, BBOX_TOKEN);
  return dataset.broadMatchQuery ?? null;
}
