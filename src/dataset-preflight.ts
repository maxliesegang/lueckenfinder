/**
 * A dry run of a dataset definition, for the "Test" button in the source form.
 *
 * It answers the two questions that otherwise only surface after saving and
 * comparing: does the official URL return usable GeoJSON (and all of it?), and
 * does the Overpass query return anything over that data's extent?
 */

import { buildQueryPlan } from "./dataset-query";
import { OFFICIAL_NO_POINTS } from "./errors";
import { bboxOfPoints, padBbox } from "./geo";
import { loadOfficial } from "./official";
import { runOverpass } from "./overpass";
import type { DatasetDefinition } from "./types";

/** Preflight is interactive, so it waits far less than a real comparison. */
const PREFLIGHT_TIMEOUT_MS = 30_000;
const PREFLIGHT_PADDING_M = 100;

export interface PreflightOutcome {
  officialCount: number;
  osmCount: number;
  /** True when the official source signalled a partial response. */
  truncated: boolean;
}

export interface PreflightOptions {
  signal?: AbortSignal;
}

export async function preflightDataset(
  definition: DatasetDefinition,
  options: PreflightOptions = {},
): Promise<PreflightOutcome> {
  const official = await loadOfficial(
    { ...definition, source: "custom" },
    { signal: options.signal },
  );
  if (official.points.length === 0) {
    throw new Error(OFFICIAL_NO_POINTS);
  }

  const bbox = padBbox(bboxOfPoints(official.points), PREFLIGHT_PADDING_M);
  const osm = await runOverpass(buildQueryPlan(definition).query, bbox, {
    signal: options.signal,
    timeoutMs: PREFLIGHT_TIMEOUT_MS,
  });

  return {
    officialCount: official.points.length,
    osmCount: osm.length,
    truncated: official.truncation !== null,
  };
}
