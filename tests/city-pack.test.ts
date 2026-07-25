import assert from "node:assert/strict";
import { test } from "node:test";

import { datasetsFromPack, parseCityDefinition, parseCityPack } from "../src/city-pack";
import { PRESET_CITIES, PRESET_DATASETS, PRESET_PACKS } from "../src/presets";
import type { CityDefinition, DatasetDefinition } from "../src/types";

const city: CityDefinition = {
  id: "testville",
  name: "Testville",
  center: [8.4, 49],
  zoom: 12,
};

const dataset: DatasetDefinition = {
  id: "tv-benches",
  label: "Benches",
  geojsonUrl: "https://example.com/data.geojson",
  overpassQuery: 'node["amenity"="bench"]({{bbox}});',
  attribution: "Testville open data",
};

test("a minimal city definition round-trips", () => {
  assert.deepEqual(parseCityDefinition({ ...city }), city);
});

test("optional city fields are validated", () => {
  assert.deepEqual(parseCityDefinition({ ...city, country: "de" }), {
    ...city,
    country: "DE",
  });
  assert.deepEqual(
    parseCityDefinition({ ...city, sourceUrl: "https://example.com/" }),
    {
      ...city,
      sourceUrl: "https://example.com/",
    },
  );
  assert.equal(parseCityDefinition({ ...city, country: "Germany" }), null);
  assert.equal(
    parseCityDefinition({ ...city, sourceUrl: "javascript:alert(1)" }),
    null,
  );
});

test("invalid city definitions are rejected", () => {
  assert.equal(parseCityDefinition(null), null);
  assert.equal(parseCityDefinition({ ...city, id: "" }), null);
  assert.equal(parseCityDefinition({ ...city, id: "../escape" }), null);
  assert.equal(parseCityDefinition({ ...city, name: "  " }), null);
  assert.equal(parseCityDefinition({ ...city, center: [200, 49] }), null);
  assert.equal(parseCityDefinition({ ...city, center: [8.4, 91] }), null);
  assert.equal(parseCityDefinition({ ...city, center: [8.4] }), null);
  assert.equal(parseCityDefinition({ ...city, center: "8.4,49" }), null);
  assert.equal(parseCityDefinition({ ...city, zoom: 99 }), null);
  assert.equal(parseCityDefinition({ ...city, zoom: Number.NaN }), null);
});

test("unknown city properties are dropped", () => {
  assert.deepEqual(parseCityDefinition({ ...city, evil: "payload" }), city);
});

test("a city pack carries its datasets", () => {
  assert.deepEqual(parseCityPack({ city, datasets: [dataset] }), {
    city,
    datasets: [dataset],
  });
  assert.deepEqual(parseCityPack({ city, datasets: [] }), { city, datasets: [] });
});

test("a pack with any invalid or duplicated dataset is rejected whole", () => {
  assert.equal(parseCityPack({ city, datasets: [{ ...dataset, id: "" }] }), null);
  assert.equal(
    // Missing the {{bbox}} token.
    parseCityPack({
      city,
      datasets: [{ ...dataset, overpassQuery: 'node["amenity"="bench"];' }],
    }),
    null,
  );
  assert.equal(parseCityPack({ city, datasets: [dataset, dataset] }), null);
  assert.equal(parseCityPack({ city }), null);
  assert.equal(parseCityPack({ city: { ...city, id: "" }, datasets: [dataset] }), null);
});

test("pack datasets are tagged with their city and provenance", () => {
  assert.deepEqual(datasetsFromPack({ city, datasets: [dataset] }), [
    { ...dataset, source: "preset", cityId: "testville" },
  ]);
  assert.deepEqual(datasetsFromPack({ city, datasets: [dataset] }, "custom"), [
    { ...dataset, source: "custom", cityId: "testville" },
  ]);
});

test("shipped preset packs are valid and consistent", () => {
  assert.ok(PRESET_PACKS.length > 0);
  assert.equal(
    new Set(PRESET_CITIES.map((entry) => entry.id)).size,
    PRESET_CITIES.length,
  );
  assert.equal(
    PRESET_DATASETS.length,
    PRESET_PACKS.reduce((total, pack) => total + pack.datasets.length, 0),
  );
  for (const preset of PRESET_DATASETS) {
    assert.equal(preset.source, "preset");
    assert.ok(PRESET_CITIES.some((entry) => entry.id === preset.cityId));
  }
});
