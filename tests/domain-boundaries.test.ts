import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";

import { parseDatasetDefinition } from "../src/dataset-definition";
import {
  addCustomDataset,
  allDatasets,
  decodeShareLink,
  encodeShareLink,
} from "../src/datasets";
import { loadOfficial, parseOfficialGeoJson, presetCacheUrl } from "../src/official";
import { parseOverpassResponse, runOverpass } from "../src/overpass";
import { PRESETS } from "../src/presets";
import type { Dataset, DatasetDefinition } from "../src/types";

const definition: DatasetDefinition = {
  id: "custom-test",
  label: "Test dataset",
  geojsonUrl: "https://example.com/data.geojson",
  overpassQuery: 'node["amenity"="bench"]({{bbox}});',
  attribution: "Example",
  sourceUrl: "https://example.com/source",
};

let storage = new Map<string, string>();
let originalFetch: typeof globalThis.fetch;

beforeEach(() => {
  storage = new Map();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    },
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      location: {
        href: "https://app.example/",
        hash: "",
      },
    },
  });
  originalFetch = globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  Reflect.deleteProperty(globalThis, "localStorage");
  Reflect.deleteProperty(globalThis, "window");
});

test("dataset definitions are validated and normalized", () => {
  const parsed = parseDatasetDefinition({
    ...definition,
    source: "preset",
    category: "Legacy category",
    ignored: true,
    label: "  Test dataset  ",
  });
  assert.deepEqual(parsed, definition);
  assert.equal(parseDatasetDefinition({ ...definition, overpassQuery: "node;" }), null);
});

test("dataset source URLs are optional but validated when present", () => {
  const { sourceUrl: _sourceUrl, ...withoutSourceUrl } = definition;
  assert.deepEqual(parseDatasetDefinition(withoutSourceUrl), withoutSourceUrl);
  assert.equal(
    parseDatasetDefinition({ ...definition, sourceUrl: "javascript:alert(1)" }),
    null,
  );
});

test("legacy dataset match radii are ignored", () => {
  assert.deepEqual(
    parseDatasetDefinition({ ...definition, matchRadiusM: Number.NaN }),
    definition,
  );
});

test("property tag rules are validated and preserved", () => {
  const withRules: DatasetDefinition = {
    ...definition,
    tagMapping: {
      fromProps: {
        capacity: "spaces",
        covered: {
          property: "description",
          extract: "Covered: ([^;]+)",
          values: { ja: "yes", nein: "no" },
        },
        bike_ride: {
          property: "station",
          constant: "yes",
        },
      },
    },
  };

  assert.deepEqual(parseDatasetDefinition(withRules), withRules);
  assert.equal(
    parseDatasetDefinition({
      ...withRules,
      tagMapping: {
        fromProps: {
          covered: { property: "description", extract: "no capture group" },
        },
      },
    }),
    null,
  );
  assert.equal(
    parseDatasetDefinition({
      ...withRules,
      tagMapping: {
        fromProps: {
          covered: { property: "description", extract: "(" },
        },
      },
    }),
    null,
  );
  assert.equal(
    parseDatasetDefinition({
      ...withRules,
      tagMapping: {
        fromProps: {
          bike_ride: {
            property: "station",
            constant: "yes",
            values: { Hauptbahnhof: "train" },
          },
        },
      },
    }),
    null,
  );
});

test("stored datasets use a versioned payload and invalid entries are skipped", () => {
  storage.set(
    "lueckenfinder:datasets",
    JSON.stringify([
      definition,
      { ...definition, id: "broken", geojsonUrl: "javascript:alert(1)" },
      { ...definition, id: "second" },
    ]),
  );
  assert.deepEqual(
    allDatasets()
      .filter((dataset) => dataset.source === "custom")
      .map((dataset) => dataset.id),
    ["custom-test", "second"],
  );

  addCustomDataset({ ...definition, id: "third" });
  const stored = storage.get("lueckenfinder:datasets");
  assert.ok(stored);
  const saved = JSON.parse(stored);
  assert.equal(saved.version, 1);
  assert.deepEqual(
    saved.datasets.map((dataset: DatasetDefinition) => dataset.id),
    ["custom-test", "second", "third"],
  );
  assert.ok(saved.datasets.every((dataset: object) => !("source" in dataset)));
});

test("share links are versioned, validated, and legacy compatible", () => {
  const url = encodeShareLink(definition);
  window.location.hash = new URL(url).hash;
  assert.deepEqual(decodeShareLink(), { ...definition, source: "custom" });

  const legacy = base64Url(JSON.stringify(definition));
  window.location.hash = `#d=${legacy}`;
  assert.deepEqual(decodeShareLink(), { ...definition, source: "custom" });

  const invalid = base64Url(
    JSON.stringify({ ...definition, sourceUrl: "file:///tmp" }),
  );
  window.location.hash = `#d=${invalid}`;
  assert.equal(decodeShareLink(), null);
});

test("preset IDs cannot be supplied by custom storage, writes, or shares", () => {
  const collision = { ...definition, id: "ka-glass-containers" };
  storage.set("lueckenfinder:datasets", JSON.stringify([collision]));
  assert.equal(
    allDatasets().filter((dataset) => dataset.id === collision.id).length,
    1,
  );
  assert.throws(() => addCustomDataset(collision), /reserved by a preset/);
  assert.throws(() => encodeShareLink(collision), /reserved by a preset/);
});

test("official GeoJSON rejects malformed and non-WGS84 coordinates", () => {
  assert.deepEqual(
    parseOfficialGeoJson({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: [8.4, 49] },
          properties: { name: "A" },
        },
      ],
    }),
    [{ lon: 8.4, lat: 49, props: { name: "A" } }],
  );
  assert.throws(
    () =>
      parseOfficialGeoJson({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: { type: "Point", coordinates: [181, 49] },
            properties: {},
          },
        ],
      }),
    /WGS84/,
  );
});

test("non-point GeoJSON uses a stable bounding-box center", () => {
  assert.deepEqual(
    parseOfficialGeoJson({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: [
              [8, 49],
              [9, 50],
              [9, 50],
            ],
          },
          properties: {},
        },
      ],
    }),
    [{ lon: 8.5, lat: 49.5, props: {} }],
  );
});

test("preset definitions are valid and have unique IDs", () => {
  assert.equal(new Set(PRESETS.map((preset) => preset.id)).size, PRESETS.length);
  for (const { source: _source, ...definition } of PRESETS) {
    assert.deepEqual(parseDatasetDefinition(definition), definition);
  }
});

test("preset cache URLs point at shipped static data", () => {
  assert.match(presetCacheUrl("custom-test"), /\/presets-data\/custom-test\.geojson$/);
});

test("an invalid preset cache falls back to the live source", async () => {
  const calls: string[] = [];
  globalThis.fetch = async (input) => {
    calls.push(String(input));
    if (calls.length === 1) {
      return Response.json({ nope: true });
    }
    return Response.json({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: [8.4, 49] },
          properties: null,
        },
      ],
    });
  };
  const dataset: Dataset = { ...definition, source: "preset" };
  assert.deepEqual(await loadOfficial(dataset), [{ lon: 8.4, lat: 49, props: {} }]);
  assert.equal(calls.length, 2);
  assert.match(calls[0] ?? "", /\/presets-data\/custom-test\.geojson$/);
  assert.equal(calls[1], definition.geojsonUrl);
});

test("Overpass validates response elements and WGS84 positions", () => {
  assert.deepEqual(
    parseOverpassResponse({
      elements: [
        { type: "node", id: 1, lat: 49, lon: 8.4, tags: { amenity: "bench" } },
        { type: "relation", id: 2 },
      ],
    }),
    [
      {
        lon: 8.4,
        lat: 49,
        props: { amenity: "bench" },
        osmRef: "node/1",
      },
    ],
  );
  assert.throws(
    () =>
      parseOverpassResponse({
        elements: [{ type: "node", id: 1, lat: Infinity, lon: 8.4 }],
      }),
    /WGS84/,
  );
  assert.throws(() => parseOverpassResponse({ elements: "nope" }), /Invalid/);
});

test("Overpass requires a bbox token and forwards cancellation", async () => {
  await assert.rejects(runOverpass('node["amenity"="bench"];', [8, 48, 9, 50]), /bbox/);

  const abort = new AbortController();
  globalThis.fetch = async (_input, init) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
    });
  const pending = runOverpass(definition.overpassQuery, [8, 48, 9, 50], {
    signal: abort.signal,
    timeoutMs: 1_000,
  });
  abort.abort(new Error("cancelled"));
  await assert.rejects(pending, /cancelled/);
});

test("Overpass substitutes all bbox tokens in the encoded request", async () => {
  let requestBody = "";
  globalThis.fetch = async (_input, init) => {
    requestBody = String(init?.body);
    return Response.json({ elements: [] });
  };
  await runOverpass("node({{bbox}});\nway({{bbox}});", [8, 48, 9, 50]);
  const query = decodeURIComponent(requestBody.slice("data=".length));
  assert.doesNotMatch(query, /\{\{bbox\}\}/);
  assert.equal(query.match(/48,8,50,9/g)?.length, 2);
});

test("Overpass applies a client-side timeout", async () => {
  globalThis.fetch = async (_input, init) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
    });
  await assert.rejects(
    runOverpass(definition.overpassQuery, [8, 48, 9, 50], { timeoutMs: 5 }),
    (error: unknown) => error instanceof DOMException && error.name === "TimeoutError",
  );
});

function base64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
