import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";

import { MAX_PACK_BYTES } from "../src/constraints";
import { fetchCityPack, parseCityPackJson } from "../src/pack-fetch";
import {
  buildCatalog,
  loadImportedPacks,
  packImportConflict,
  packShareUrl,
  readRequestedPackUrl,
  removeImportedPack,
  saveImportedPack,
} from "../src/packs";
import { PRESET_CITIES, PRESET_DATASETS } from "../src/presets";
import type { CityPack, Dataset } from "../src/types";

const storage = new Map<string, string>();
const storageKey = "lueckenfinder:packs";

function pack(cityId: string, datasetIds: string[]): CityPack {
  return {
    city: { id: cityId, name: cityId.toUpperCase(), center: [8, 49], zoom: 11 },
    datasets: datasetIds.map((id) => ({
      id,
      label: id,
      geojsonUrl: "https://example.com/data.geojson",
      overpassQuery: 'node["amenity"="bench"]({{bbox}});',
      attribution: "Example",
    })),
  };
}

function stubLocation(href: string): void {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { location: { href } },
  });
}

beforeEach(() => {
  storage.clear();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      removeItem: (key: string) => storage.delete(key),
      setItem: (key: string, value: string) => storage.set(key, value),
    },
  });
  stubLocation("https://example.com/app/");
});

afterEach(() => {
  Reflect.deleteProperty(globalThis, "localStorage");
  Reflect.deleteProperty(globalThis, "window");
});

test("an imported pack round-trips through storage", () => {
  const imported = pack("bonn", ["bn-benches"]);
  assert.deepEqual(saveImportedPack(imported), [imported]);
  assert.deepEqual(loadImportedPacks(), [imported]);
});

test("re-importing the same city replaces it rather than duplicating", () => {
  saveImportedPack(pack("bonn", ["bn-benches"]));
  const updated = pack("bonn", ["bn-benches", "bn-toilets"]);
  assert.deepEqual(saveImportedPack(updated), [updated]);
  assert.deepEqual(loadImportedPacks(), [updated]);
});

test("removing a pack leaves the others", () => {
  saveImportedPack(pack("bonn", ["bn-benches"]));
  saveImportedPack(pack("essen", ["es-benches"]));
  assert.deepEqual(
    removeImportedPack("bonn").map((entry) => entry.city.id),
    ["essen"],
  );
});

test("packs cannot shadow shipped cities or dataset IDs", () => {
  const shippedCity = PRESET_CITIES[0].id;
  const shippedDataset = PRESET_DATASETS[0].id;

  assert.notEqual(packImportConflict(pack(shippedCity, ["xx-benches"])), null);
  assert.notEqual(packImportConflict(pack("bonn", [shippedDataset])), null);
  assert.equal(packImportConflict(pack("bonn", ["bn-benches"])), null);

  assert.throws(() => saveImportedPack(pack(shippedCity, ["xx-benches"])));
  assert.throws(() => saveImportedPack(pack("bonn", [shippedDataset])));
});

test("unreadable or invalid stored packs are ignored, not surfaced broken", () => {
  storage.set(storageKey, "not json");
  assert.deepEqual(loadImportedPacks(), []);

  storage.set(
    storageKey,
    JSON.stringify({ version: 99, packs: [pack("bonn", ["b"])] }),
  );
  assert.deepEqual(loadImportedPacks(), []);

  storage.set(
    storageKey,
    JSON.stringify({
      version: 1,
      packs: [pack("bonn", ["bn-benches"]), { city: { id: "broken" } }],
    }),
  );
  assert.deepEqual(
    loadImportedPacks().map((entry) => entry.city.id),
    ["bonn"],
  );
});

test("a pack document is validated before it is trusted", () => {
  const document = JSON.stringify(pack("bonn", ["bn-benches"]));
  assert.deepEqual(parseCityPackJson(document), pack("bonn", ["bn-benches"]));

  assert.throws(() => parseCityPackJson("{"), /Invalid city pack/);
  assert.throws(() => parseCityPackJson("{}"), /Invalid city pack/);
  assert.throws(
    () => parseCityPackJson(JSON.stringify(pack("bonn", []))),
    /no datasets/,
  );
  assert.throws(
    () => parseCityPackJson(`${" ".repeat(MAX_PACK_BYTES + 1)}`),
    /too large/,
  );
});

test("fetching a pack rejects bad URLs, bad statuses, and oversized bodies", async () => {
  const originalFetch = globalThis.fetch;
  try {
    await assert.rejects(fetchCityPack("ftp://example.org/p.json"), /http\(s\)/);

    globalThis.fetch = async () =>
      new Response("{}", { status: 404, statusText: "Not Found" });
    await assert.rejects(
      fetchCityPack("https://example.org/p.json"),
      /failed with 404/,
    );

    globalThis.fetch = async () =>
      new Response("{}", {
        status: 200,
        headers: { "content-length": String(MAX_PACK_BYTES + 1) },
      });
    await assert.rejects(fetchCityPack("https://example.org/p.json"), /too large/);

    const wanted = pack("bonn", ["bn-benches"]);
    globalThis.fetch = async () =>
      new Response(JSON.stringify(wanted), { status: 200 });
    assert.deepEqual(await fetchCityPack("https://example.org/p.json"), wanted);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("the pack URL is read from the query string", () => {
  assert.equal(readRequestedPackUrl(), null);
  stubLocation("https://example.com/app/?pack=https%3A%2F%2Fexample.org%2Fp.json");
  assert.equal(readRequestedPackUrl(), "https://example.org/p.json");
});

test("a share URL carries both the pack and the city", () => {
  const shared = new URL(packShareUrl("https://example.org/p.json", "bonn"));
  assert.equal(shared.searchParams.get("pack"), "https://example.org/p.json");
  assert.equal(shared.searchParams.get("city"), "bonn");
});

test("the catalog merges presets with packs and tags their provenance", () => {
  const stored: Dataset[] = [
    ...PRESET_DATASETS,
    {
      id: "my-source",
      label: "Mine",
      geojsonUrl: "https://example.com/data.geojson",
      overpassQuery: 'node["amenity"="bench"]({{bbox}});',
      attribution: "Example",
      source: "custom",
    },
  ];
  const catalog = buildCatalog(stored, [pack("bonn", ["bn-benches"])]);

  assert.equal(catalog.cities.length, PRESET_CITIES.length + 1);
  assert.ok(catalog.cities.some((city) => city.id === "bonn"));

  const imported = catalog.datasets.find((entry) => entry.id === "bn-benches");
  assert.equal(imported?.source, "imported");
  assert.equal(imported?.cityId, "bonn");
  assert.ok(catalog.datasets.some((entry) => entry.id === "my-source"));
});

test("a pack never displaces a city that is already present", () => {
  const shippedCity = PRESET_CITIES[0];
  const catalog = buildCatalog(PRESET_DATASETS, [pack(shippedCity.id, ["xx-benches"])]);

  assert.equal(catalog.cities.length, PRESET_CITIES.length);
  assert.equal(
    catalog.datasets.some((entry) => entry.id === "xx-benches"),
    false,
  );
});
