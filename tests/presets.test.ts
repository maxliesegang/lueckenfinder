import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { PRESET_PACKS } from "../src/presets";

const presetsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "presets");

/**
 * `src/presets.ts` lists its packs explicitly, because `import.meta.glob` is a
 * Vite transform and that module is also loaded by tsx (tests and the cache
 * script). Explicit is fine; silently forgetting the list is not — a dropped
 * city would just not appear in the picker, with nothing failing.
 */
test("every shipped city pack is registered in src/presets.ts", () => {
  const packFiles = readdirSync(presetsDir)
    .filter((fileName) => fileName.endsWith(".json"))
    // The topic catalog is not a pack; src/topics.ts imports it directly.
    .filter((fileName) => fileName !== "topics.json")
    .map((fileName) => fileName.replace(/\.json$/, ""))
    .sort();

  const registered = PRESET_PACKS.map((pack) => pack.city.id).sort();
  assert.deepEqual(
    registered,
    packFiles,
    "presets/<city>.json files and RAW_PACKS entries have diverged",
  );
});

test("dataset ids are unique across every shipped pack", () => {
  // Dataset ids are runtime identity: localStorage keys for custom datasets,
  // share links, and the reservation that stops an import from shadowing a
  // preset. Two cities reusing one id would collide in all three.
  const ids = PRESET_PACKS.flatMap((pack) =>
    pack.datasets.map((dataset) => dataset.id),
  );
  assert.equal(new Set(ids).size, ids.length);
});
