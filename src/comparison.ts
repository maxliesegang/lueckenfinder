import { conflate } from "./conflate";
import {
  isValidMatchRadiusM,
  MATCH_RADIUS_ERROR,
  MAX_MATCH_RADIUS_M,
} from "./constraints";
import { buildQueryPlan } from "./dataset-query";
import { BROAD_QUERY_FAILED, OFFICIAL_NO_POINTS, OFFICIAL_TRUNCATED } from "./errors";
import { type BBox, bboxOfPoints, padBbox, pointInBbox, snapBbox } from "./geo";
import { loadOfficial, type OfficialData } from "./official";
import { runOverpass } from "./overpass";
import type { ConflationResult, Dataset, DatasetPoint } from "./types";

export type ComparisonStage =
  | { type: "official" }
  | { type: "osm"; officialCount: number }
  | { type: "broad-match" }
  | { type: "conflate" };

export interface ComparisonOutcome {
  result: ConflationResult;
  officialCount: number;
  warnings: string[];
}

/**
 * Responses kept across comparison runs, so re-running a dataset at a different
 * match radius — or running a sibling dataset — costs no network.
 *
 * Official data is cached per dataset, but Overpass responses are cached by the
 * request itself: the resolved query plus the extent it covers. Datasets that
 * ask OSM the same question over the same city then share one response, which
 * is the common case within a city pack (four recycling datasets all fetch
 * `amenity=recycling` for their relaxed half).
 */
export interface ComparisonResponseCache {
  official: Map<string, OfficialData>;
  osm: Map<string, DatasetPoint[]>;
}

interface ComparisonDependencies {
  loadOfficial: typeof loadOfficial;
  runOverpass: typeof runOverpass;
}

export interface ComparisonOptions {
  signal?: AbortSignal;
  onStage?: (stage: ComparisonStage) => void;
  dependencies?: ComparisonDependencies;
  cache?: ComparisonResponseCache;
}

const defaultDependencies: ComparisonDependencies = {
  loadOfficial,
  runOverpass,
};

/**
 * Grid the cached request extent snaps to, roughly a kilometre. Small against
 * the two kilometres of match-radius padding a cached request already carries,
 * and coarse enough that datasets covering one city land on the same extent.
 */
const REQUEST_GRID_DEGREES = 0.01;

/** The responses one comparison run works from, cached or freshly fetched. */
interface ComparisonRunData {
  official: DatasetPoint[];
  osm: DatasetPoint[];
  broadOsm?: DatasetPoint[];
  warnings: string[];
}

export function createComparisonResponseCache(): ComparisonResponseCache {
  return { official: new Map(), osm: new Map() };
}

export async function compareDataset(
  dataset: Dataset,
  matchRadiusM: number,
  options: ComparisonOptions = {},
): Promise<ComparisonOutcome> {
  if (!isValidMatchRadiusM(matchRadiusM)) {
    throw new Error(MATCH_RADIUS_ERROR);
  }

  const {
    signal,
    onStage = () => undefined,
    dependencies = defaultDependencies,
    cache,
  } = options;

  const officialKey = officialRequestKey(dataset);
  let officialData = cache?.official.get(officialKey);
  if (!officialData) {
    onStage({ type: "official" });
    officialData = await dependencies.loadOfficial(dataset, { signal });
    cache?.official.set(officialKey, officialData);
  }

  const official = officialData.points;
  if (official.length === 0) {
    throw new Error(OFFICIAL_NO_POINTS);
  }

  const warnings: string[] = [];
  if (officialData.truncation) warnings.push(OFFICIAL_TRUNCATED);

  // With a cache the request covers the widest radius the app allows and snaps
  // to a shared grid, so one response serves every radius and every dataset
  // asking the same question of the same city.
  const bbox = cache ? requestBbox(official) : resultBbox(official, matchRadiusM);
  const plan = buildQueryPlan(dataset);
  const queried = await runQuery(plan.query, bbox, () =>
    onStage({ type: "osm", officialCount: official.length }),
  );

  let osm = queried;
  let broadOsm: DatasetPoint[] | undefined;

  if (plan.isStrictMatch) {
    // One request covered both criteria; split it locally.
    osm = queried.filter(plan.isStrictMatch);
    broadOsm = queried;
  } else if (plan.broadQuery) {
    try {
      broadOsm = await runQuery(plan.broadQuery, bbox, () =>
        onStage({ type: "broad-match" }),
      );
    } catch (error) {
      if (signal?.aborted) throw error;
      warnings.push(BROAD_QUERY_FAILED);
    }
  }

  return compareRequestData(
    { official, osm, broadOsm, warnings },
    dataset,
    matchRadiusM,
    onStage,
  );

  /** Run one Overpass request, or reuse an identical one from the cache. */
  async function runQuery(
    query: string,
    extent: BBox,
    onRequest: () => void,
  ): Promise<DatasetPoint[]> {
    const key = osmRequestKey(query, extent);
    const hit = cache?.osm.get(key);
    if (hit) return hit;

    onRequest();
    const points = await dependencies.runOverpass(query, extent, { signal });
    cache?.osm.set(key, points);
    return points;
  }
}

function compareRequestData(
  data: ComparisonRunData,
  dataset: Dataset,
  matchRadiusM: number,
  onStage: (stage: ComparisonStage) => void,
): ComparisonOutcome {
  onStage({ type: "conflate" });
  const bbox = resultBbox(data.official, matchRadiusM);
  return {
    result: conflate(
      data.official,
      data.osm.filter((point) => pointInBbox(point, bbox)),
      dataset,
      matchRadiusM,
      data.broadOsm?.filter((point) => pointInBbox(point, bbox)),
    ),
    officialCount: data.official.length,
    warnings: [...data.warnings],
  };
}

function requestBbox(official: DatasetPoint[]): BBox {
  return snapBbox(
    padBbox(bboxOfPoints(official), MAX_MATCH_RADIUS_M + 50),
    REQUEST_GRID_DEGREES,
  );
}

function resultBbox(official: DatasetPoint[], matchRadiusM: number): BBox {
  return padBbox(bboxOfPoints(official), matchRadiusM + 50);
}

/**
 * Everything `loadOfficial` looks at: it prefers the build-time copy filed
 * under a shipped dataset's city, and otherwise fetches the live URL.
 */
function officialRequestKey(dataset: Dataset): string {
  return JSON.stringify([
    dataset.source,
    dataset.cityId ?? null,
    dataset.id,
    dataset.geojsonUrl,
  ]);
}

/**
 * The identity of an Overpass request: the resolved query and its extent, and
 * nothing about the dataset that asked. Two datasets resolving to the same
 * query over the same extent are the same request, however they spelled it.
 */
function osmRequestKey(query: string, bbox: BBox): string {
  return JSON.stringify([query, bbox]);
}
