import assert from "node:assert/strict";
import { test } from "node:test";

import {
  cacheFileName,
  parseCityFilters,
  selectPacks,
  staleCacheFiles,
} from "../scripts/preset-cache";
import type { CityPack } from "../src/types";

function pack(cityId: string, datasetIds: string[]): CityPack {
  return {
    city: { id: cityId, name: cityId, center: [8, 49], zoom: 12 },
    datasets: datasetIds.map((id) => ({
      id,
      label: id,
      geojsonUrl: "https://example.com/data.geojson",
      overpassQuery: 'node["amenity"="bench"]({{bbox}});',
      attribution: "Example",
    })),
  };
}

const packs = [pack("karlsruhe", ["ka-benches"]), pack("mannheim", ["ma-benches"])];

test("city filters accept repeated and comma-separated values", () => {
  assert.deepEqual(parseCityFilters(["--city=karlsruhe"]), ["karlsruhe"]);
  assert.deepEqual(parseCityFilters(["--city=karlsruhe,mannheim"]), [
    "karlsruhe",
    "mannheim",
  ]);
  assert.deepEqual(parseCityFilters(["--city=karlsruhe", "--city= mannheim "]), [
    "karlsruhe",
    "mannheim",
  ]);
  assert.deepEqual(parseCityFilters(["--best-effort", "--city="]), []);
  assert.deepEqual(parseCityFilters([]), []);
});

test("no filter caches every city", () => {
  const selection = selectPacks(packs, []);
  assert.equal(selection.packs.length, 2);
  assert.deepEqual(selection.unknownCityIds, []);
});

test("a filter narrows to the named cities", () => {
  const selection = selectPacks(packs, ["mannheim"]);
  assert.deepEqual(
    selection.packs.map((entry) => entry.city.id),
    ["mannheim"],
  );
  assert.deepEqual(selection.unknownCityIds, []);
});

test("unknown city ids are reported rather than silently skipped", () => {
  const selection = selectPacks(packs, ["atlantis", "karlsruhe"]);
  assert.deepEqual(
    selection.packs.map((entry) => entry.city.id),
    ["karlsruhe"],
  );
  assert.deepEqual(selection.unknownCityIds, ["atlantis"]);
});

test("cache files are flat and named by dataset id", () => {
  assert.equal(cacheFileName("ka-benches"), "ka-benches.geojson");
});

test("stale cache files are the ones no dataset claims", () => {
  const datasets = packs.flatMap((entry) => entry.datasets);
  assert.deepEqual(
    staleCacheFiles(
      ["ka-benches.geojson", "old-dataset.geojson", "README.md", "ma-benches.geojson"],
      datasets,
    ),
    ["old-dataset.geojson"],
  );
  assert.deepEqual(staleCacheFiles([], datasets), []);
});
