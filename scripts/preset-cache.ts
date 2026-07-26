// Pure helpers for the preset cache script. Kept separate from fetch-presets.ts
// so the selection rules can be tested without touching the network or disk.

import type { CityPack } from "../src/types";
import { isFiniteNumber, isRecord } from "../src/validation";

export interface CacheSelection {
  packs: readonly CityPack[];
  /** City ids that were asked for but do not exist. */
  unknownCityIds: string[];
}

/**
 * Read `--city=<id>` arguments (repeatable, or comma-separated). No argument
 * means every shipped city, which is what CI and a plain local refresh want.
 */
export function parseCityFilters(argv: readonly string[]): string[] {
  return argv
    .filter((argument) => argument.startsWith("--city="))
    .flatMap((argument) => argument.slice("--city=".length).split(","))
    .map((cityId) => cityId.trim())
    .filter((cityId) => cityId.length > 0);
}

/**
 * Narrow the packs to cache. Unknown city ids are reported rather than
 * silently ignored: a typo would otherwise look like a successful no-op run.
 */
export function selectPacks(
  packs: readonly CityPack[],
  cityIds: readonly string[],
): CacheSelection {
  if (cityIds.length === 0) return { packs, unknownCityIds: [] };

  const wanted = new Set(cityIds);
  const known = new Set(packs.map((pack) => pack.city.id));
  return {
    packs: packs.filter((pack) => wanted.has(pack.city.id)),
    unknownCityIds: [...wanted].filter((cityId) => !known.has(cityId)),
  };
}

/**
 * Cache file path for a dataset, relative to public/presets-data/.
 *
 * One directory per city, so a `--city` refresh maps to a directory and the
 * layout stays readable as cities are added. Both ids are already restricted to
 * URL-safe characters, so no escaping is needed here — and `presetCacheUrl`
 * builds the same path at run time.
 */
export function cacheFilePath(cityId: string, datasetId: string): string {
  return `${cityId}/${datasetId}.geojson`;
}

/**
 * Cache files that no longer belong to any shipped dataset, including whole
 * directories left behind by a city that was removed or renamed. Paths are
 * relative to the cache directory and use "/" on every platform.
 */
export function staleCacheFiles(
  filePaths: readonly string[],
  packs: readonly CityPack[],
): string[] {
  const expected = new Set(
    packs.flatMap((pack) =>
      pack.datasets.map((dataset) => cacheFilePath(pack.city.id, dataset.id)),
    ),
  );
  return filePaths
    .filter((filePath) => filePath.endsWith(".geojson"))
    .filter((filePath) => !expected.has(filePath))
    .sort();
}

/**
 * Serialize a fetched FeatureCollection into its cache file.
 *
 * Two properties matter, and neither is cosmetic. Portals do not promise a
 * stable feature order between requests, so without sorting an unchanged
 * dataset can rewrite the whole file and produce a refresh commit that means
 * nothing. And one feature per line keeps an added, removed, or edited object
 * to a single diff line, so a review can see what actually changed — the file
 * is otherwise a single 300 kB line.
 *
 * Everything else is left exactly as the portal sent it: the remaining
 * top-level keys keep their order, and so do each feature's properties, which
 * the app shows in that order. Only the feature order is ours to choose.
 */
export function serializeCacheFile(value: unknown): string {
  if (!isRecord(value) || !Array.isArray(value.features)) {
    return `${JSON.stringify(value)}\n`;
  }

  const features = [...value.features].sort(compareFeatures);
  const head = Object.entries(value)
    .filter(([key]) => key !== "features")
    .map(([key, entry]) => `${JSON.stringify(key)}:${JSON.stringify(entry)},`)
    .join("");
  const body = features.map((feature) => JSON.stringify(feature)).join(",\n");
  return `{${head}"features":[\n${body}\n]}\n`;
}

/**
 * Order features by their first coordinate so the file tracks the data rather
 * than the portal's response order. Sorting geographically (rather than by the
 * serialized feature) also keeps a renamed object on its original line, so an
 * edit reads as one changed line instead of a delete and an insert.
 */
function compareFeatures(a: unknown, b: unknown): number {
  const left = firstPosition(a);
  const right = firstPosition(b);
  if (left && right) {
    if (left[0] !== right[0]) return left[0] - right[0];
    if (left[1] !== right[1]) return left[1] - right[1];
  } else if (left) {
    return -1;
  } else if (right) {
    return 1;
  }

  // Same position, or no position at all: fall back to the bytes so features
  // stacked on one spot still land in a fixed order.
  const leftJson = JSON.stringify(a) ?? "";
  const rightJson = JSON.stringify(b) ?? "";
  if (leftJson === rightJson) return 0;
  return leftJson < rightJson ? -1 : 1;
}

/** First [lon, lat] anywhere in a feature's geometry, whatever its type. */
function firstPosition(feature: unknown): [number, number] | null {
  return isRecord(feature) ? positionInGeometry(feature.geometry) : null;
}

function positionInGeometry(geometry: unknown): [number, number] | null {
  if (!isRecord(geometry)) return null;

  const fromCoordinates = positionInCoordinates(geometry.coordinates);
  if (fromCoordinates) return fromCoordinates;

  // GeometryCollection keeps its members under `geometries` instead.
  if (Array.isArray(geometry.geometries)) {
    for (const member of geometry.geometries) {
      const position = positionInGeometry(member);
      if (position) return position;
    }
  }
  return null;
}

function positionInCoordinates(value: unknown): [number, number] | null {
  if (!Array.isArray(value)) return null;
  if (isFiniteNumber(value[0]) && isFiniteNumber(value[1])) {
    return [value[0], value[1]];
  }
  for (const entry of value) {
    const position = positionInCoordinates(entry);
    if (position) return position;
  }
  return null;
}
