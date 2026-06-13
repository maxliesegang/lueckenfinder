// Fetches each preset's official GeoJSON and writes it to
// public/presets-data/<id>.geojson so the app can load it same-origin.
// Run locally with `npm run fetch:presets` and in CI before `vite build`.
//
// Required fetch failures fall back to the checked-in cache. CI only fails when
// neither the live source nor a valid cached copy is available. Use --best-effort
// for an explicitly partial local refresh.

import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseOfficialGeoJson } from "../src/official";
import { PRESETS } from "../src/presets";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", "public", "presets-data");
const bestEffort = process.argv.includes("--best-effort");

async function main(): Promise<void> {
  await mkdir(outDir, { recursive: true });
  let ok = 0;
  let cached = 0;
  const failures: string[] = [];

  for (const preset of PRESETS) {
    const outputPath = join(outDir, `${preset.id}.geojson`);
    try {
      const res = await fetch(preset.geojsonUrl, {
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

      console.log(`OK ${preset.id}`);
      ok++;
    } catch (err) {
      const liveError = errorMessage(err);
      try {
        const cachedJson: unknown = JSON.parse(await readFile(outputPath, "utf8"));
        parseOfficialGeoJson(cachedJson);
        console.warn(`CACHE ${preset.id}: live refresh failed (${liveError})`);
        cached++;
      } catch (cacheErr) {
        const message = `${preset.id}: live refresh failed (${liveError}); cache unavailable (${errorMessage(cacheErr)})`;
        failures.push(message);
        console.warn(`FAILED ${message}`);
      }
    }
  }

  console.log(
    `Done: ${ok}/${PRESETS.length} preset datasets refreshed, ${cached} from cache.`,
  );
  if (failures.length > 0 && !bestEffort) {
    throw new Error(`Could not cache all required presets:\n${failures.join("\n")}`);
  }
}

function errorMessage(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  if (!("cause" in error) || error.cause === undefined) return error.message;
  return `${error.message}: ${errorMessage(error.cause)}`;
}

await main();
