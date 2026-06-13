import { conflate } from "./conflate";
import {
  isValidMatchRadiusM,
  MATCH_RADIUS_ERROR,
  MAX_MATCH_RADIUS_M,
} from "./dataset-constraints";
import { type BBox, bboxOfPoints, padBbox } from "./geo";
import { loadOfficial } from "./official";
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

export interface ComparisonRequestData {
  official: DatasetPoint[];
  osm: DatasetPoint[];
  broadOsm?: DatasetPoint[];
  warnings: string[];
}

export interface ComparisonRequestCache {
  entries: Map<string, ComparisonRequestData>;
}

interface ComparisonDependencies {
  loadOfficial: typeof loadOfficial;
  runOverpass: typeof runOverpass;
}

export interface ComparisonOptions {
  signal?: AbortSignal;
  onStage?: (stage: ComparisonStage) => void;
  dependencies?: ComparisonDependencies;
  cache?: ComparisonRequestCache;
}

const defaultDependencies: ComparisonDependencies = {
  loadOfficial,
  runOverpass,
};

export function createComparisonRequestCache(): ComparisonRequestCache {
  return { entries: new Map() };
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
  const cacheKey = comparisonRequestKey(dataset);
  const cached = cache?.entries.get(cacheKey);
  if (cached) {
    return compareRequestData(cached, dataset, matchRadiusM, onStage);
  }

  onStage({ type: "official" });
  const official = await dependencies.loadOfficial(dataset, { signal });
  if (official.length === 0) {
    throw new Error("Official dataset has no valid points.");
  }

  const bbox = cache ? requestBbox(official) : resultBbox(official, matchRadiusM);
  onStage({ type: "osm", officialCount: official.length });
  const osm = await dependencies.runOverpass(dataset.overpassQuery, bbox, {
    signal,
  });

  const warnings: string[] = [];
  let broadOsm: Awaited<ReturnType<typeof runOverpass>> | undefined;
  if (dataset.broadMatchQuery) {
    onStage({ type: "broad-match" });
    try {
      broadOsm = await dependencies.runOverpass(dataset.broadMatchQuery, bbox, {
        signal,
      });
    } catch (error) {
      if (signal?.aborted) throw error;
      warnings.push(
        "The relaxed OSM query failed, so some missing items may only need tags.",
      );
    }
  }

  const requestData = { official, osm, broadOsm, warnings };
  cache?.entries.set(cacheKey, requestData);
  return compareRequestData(requestData, dataset, matchRadiusM, onStage);
}

function compareRequestData(
  data: ComparisonRequestData,
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
  return padBbox(bboxOfPoints(official), MAX_MATCH_RADIUS_M + 50);
}

function resultBbox(official: DatasetPoint[], matchRadiusM: number): BBox {
  return padBbox(bboxOfPoints(official), matchRadiusM + 50);
}

function pointInBbox(point: DatasetPoint, bbox: BBox): boolean {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  return (
    point.lon >= minLon &&
    point.lon <= maxLon &&
    point.lat >= minLat &&
    point.lat <= maxLat
  );
}

function comparisonRequestKey(dataset: Dataset): string {
  return JSON.stringify({
    source: dataset.source,
    id: dataset.id,
    geojsonUrl: dataset.geojsonUrl,
    overpassQuery: dataset.overpassQuery,
    broadMatchQuery: dataset.broadMatchQuery ?? null,
  });
}
