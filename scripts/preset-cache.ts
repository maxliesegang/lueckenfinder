// Pure helpers for the preset cache script. Kept separate from fetch-presets.ts
// so the selection rules can be tested without touching the network or disk.

import type { CityPack } from "../src/types";

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
 * Cache file name for a dataset. Dataset ids are unique across all packs and
 * already restricted to URL-safe characters, so the flat layout stays valid as
 * cities are added — and matches what `presetCacheUrl` requests at run time.
 */
export function cacheFileName(datasetId: string): string {
  return `${datasetId}.geojson`;
}

/** Cache files that no longer belong to any shipped dataset. */
export function staleCacheFiles(
  fileNames: readonly string[],
  datasets: readonly { id: string }[],
): string[] {
  const expected = new Set(datasets.map((dataset) => cacheFileName(dataset.id)));
  return fileNames
    .filter((fileName) => fileName.endsWith(".geojson"))
    .filter((fileName) => !expected.has(fileName))
    .sort();
}
