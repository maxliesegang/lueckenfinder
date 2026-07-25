// Fetches each preset's official GeoJSON and writes it to
// public/presets-data/<id>.geojson so the app can load it same-origin.
// Run locally with `npm run fetch:presets` and in CI before `vite build`.
//
// Required fetch failures fall back to the checked-in cache. CI only fails when
// neither the live source nor a valid cached copy is available. Use --best-effort
// for an explicitly partial local refresh.
//
// Work is grouped by city pack. Pass --city=<id> (repeatable, or comma
// separated) to refresh a single city instead of every shipped one — useful
// when adding a city, so the other cities' portals are left alone.

import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseOfficialGeoJson } from "../src/official";
import { PRESET_PACKS } from "../src/presets";
import type { CityPack } from "../src/types";
import {
  cacheFileName,
  parseCityFilters,
  selectPacks,
  staleCacheFiles,
} from "./preset-cache";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", "public", "presets-data");
const bestEffort = process.argv.includes("--best-effort");
const cityFilters = parseCityFilters(process.argv);

type DatasetOutcome =
  | { status: "refreshed" }
  | { status: "cached" }
  | { status: "failed"; message: string };

async function main(): Promise<void> {
  const { packs, unknownCityIds } = selectPacks(PRESET_PACKS, cityFilters);
  if (unknownCityIds.length > 0) {
    throw new Error(
      `Unknown --city value(s): ${unknownCityIds.join(", ")}. ` +
        `Available: ${PRESET_PACKS.map((pack) => pack.city.id).join(", ")}`,
    );
  }
  if (packs.length === 0) {
    throw new Error("No city packs to cache.");
  }

  await mkdir(outDir, { recursive: true });
  const outcomes: DatasetOutcome[] = [];

  for (const pack of packs) {
    console.log(`\n${pack.city.name} (${pack.datasets.length} datasets)`);
    for (const dataset of pack.datasets) {
      outcomes.push(await cacheDataset(dataset));
    }
  }

  const count = (status: DatasetOutcome["status"]) =>
    outcomes.filter((outcome) => outcome.status === status).length;
  const failures = outcomes.flatMap((outcome) =>
    outcome.status === "failed" ? [outcome.message] : [],
  );

  console.log(
    `\nDone: ${count("refreshed")}/${outcomes.length} preset datasets refreshed, ` +
      `${count("cached")} from cache, across ${packs.length} ` +
      `${packs.length === 1 ? "city" : "cities"}.`,
  );

  await reportStaleFiles(cityFilters.length === 0);

  if (failures.length > 0 && !bestEffort) {
    throw new Error(`Could not cache all required presets:\n${failures.join("\n")}`);
  }
}

/**
 * Refresh one dataset's cache file, falling back to the checked-in copy when
 * the live source is unreachable. Only a copy that still parses counts as a
 * fallback — a corrupt cache is a failure, not a quiet pass.
 */
async function cacheDataset(dataset: CityPack["datasets"][number]) {
  const outputPath = join(outDir, cacheFileName(dataset.id));
  try {
    const res = await fetch(dataset.geojsonUrl, {
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json: unknown = await res.json();
    parseOfficialGeoJson(json);

    const temporaryPath = `${outputPath}.tmp`;
    try {
      await writeFile(temporaryPath, `${JSON.stringify(json)}\n`);
      await rename(temporaryPath, outputPath);
    } finally {
      await rm(temporaryPath, { force: true });
    }

    console.log(`  OK ${dataset.id}`);
    return { status: "refreshed" } as const;
  } catch (err) {
    const liveError = errorMessage(err);
    try {
      const cachedJson: unknown = JSON.parse(await readFile(outputPath, "utf8"));
      parseOfficialGeoJson(cachedJson);
      console.warn(`  CACHE ${dataset.id}: live refresh failed (${liveError})`);
      return { status: "cached" } as const;
    } catch (cacheErr) {
      const message = `${dataset.id}: live refresh failed (${liveError}); cache unavailable (${errorMessage(cacheErr)})`;
      console.warn(`  FAILED ${message}`);
      return { status: "failed", message } as const;
    }
  }
}

/**
 * Only meaningful for a full run: with --city the other cities' files are
 * present and correct, they just were not refreshed.
 */
async function reportStaleFiles(fullRun: boolean): Promise<void> {
  if (!fullRun) return;
  const allDatasets = PRESET_PACKS.flatMap((pack) => pack.datasets);
  const stale = staleCacheFiles(await readdir(outDir), allDatasets);
  if (stale.length === 0) return;
  console.warn(
    `\n${stale.length} cached file(s) no longer belong to a preset and can be deleted:\n` +
      stale.map((fileName) => `  ${fileName}`).join("\n"),
  );
}

function errorMessage(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  if (!("cause" in error) || error.cause === undefined) return error.message;
  return `${error.message}: ${errorMessage(error.cause)}`;
}

await main();
