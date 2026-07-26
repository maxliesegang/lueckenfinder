import assert from "node:assert/strict";
import { test } from "node:test";

import {
  cacheFilePath,
  parseCityFilters,
  selectPacks,
  serializeCacheFile,
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

test("cache files live in a directory named after their city", () => {
  assert.equal(
    cacheFilePath("karlsruhe", "ka-benches"),
    "karlsruhe/ka-benches.geojson",
  );
});

test("stale cache files are the ones no dataset claims", () => {
  assert.deepEqual(
    staleCacheFiles(
      [
        "karlsruhe",
        "karlsruhe/ka-benches.geojson",
        "karlsruhe/old-dataset.geojson",
        "karlsruhe/README.md",
        "mannheim/ma-benches.geojson",
        // A city that is no longer shipped leaves its whole directory behind.
        "atlantis/at-benches.geojson",
      ],
      packs,
    ),
    ["atlantis/at-benches.geojson", "karlsruhe/old-dataset.geojson"],
  );
  assert.deepEqual(staleCacheFiles([], packs), []);
  // A dataset filed under the wrong city is stale where it sits.
  assert.deepEqual(staleCacheFiles(["mannheim/ka-benches.geojson"], packs), [
    "mannheim/ka-benches.geojson",
  ]);
});

function point(lon: number, lat: number, name: string) {
  return {
    type: "Feature",
    geometry: { type: "Point", coordinates: [lon, lat] },
    properties: { name },
  };
}

test("cache files put one feature per line so a change is one diff line", () => {
  const serialized = serializeCacheFile({
    type: "FeatureCollection",
    features: [point(8.4, 49, "a"), point(8.5, 49, "b")],
  });

  assert.equal(serialized.split("\n").length - 1, 4);
  assert.ok(serialized.endsWith("\n"));
  assert.deepEqual(JSON.parse(serialized), {
    type: "FeatureCollection",
    features: [point(8.4, 49, "a"), point(8.5, 49, "b")],
  });
});

test("feature order follows the data, not the portal's response order", () => {
  const features = [point(8.5, 49, "b"), point(8.4, 49, "a"), point(8.4, 48, "c")];
  const shuffled = [features[1], features[2], features[0]];

  // Same data in a different order has to produce identical bytes, or every
  // refresh would look like a change.
  assert.equal(
    serializeCacheFile({ type: "FeatureCollection", features }),
    serializeCacheFile({ type: "FeatureCollection", features: shuffled }),
  );
  assert.deepEqual(
    JSON.parse(serializeCacheFile({ type: "FeatureCollection", features })).features,
    [point(8.4, 48, "c"), point(8.4, 49, "a"), point(8.5, 49, "b")],
  );
});

test("serializing keeps the top-level keys truncation detection reads", () => {
  const parsed = JSON.parse(
    serializeCacheFile({
      type: "FeatureCollection",
      numberMatched: 900,
      exceededTransferLimit: true,
      features: [point(8.4, 49, "a")],
    }),
  );
  assert.equal(parsed.numberMatched, 900);
  assert.equal(parsed.exceededTransferLimit, true);
});

test("features without a usable position still serialize deterministically", () => {
  const nullGeometry = { type: "Feature", geometry: null, properties: { name: "x" } };
  const polygon = {
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [8.3, 49],
          [8.31, 49],
          [8.3, 49.1],
        ],
      ],
    },
    properties: { name: "p" },
  };
  const collection = {
    type: "Feature",
    geometry: {
      type: "GeometryCollection",
      geometries: [{ type: "Point", coordinates: [8.2, 49] }],
    },
    properties: { name: "g" },
  };

  const order = (features: unknown[]) =>
    JSON.parse(
      serializeCacheFile({ type: "FeatureCollection", features }),
    ).features.map(
      (feature: { properties: { name: string } }) => feature.properties.name,
    );

  // Polygon sorts on its first vertex, the collection on its member point, and
  // the positionless feature lands last rather than wherever it arrived.
  assert.deepEqual(order([nullGeometry, polygon, collection]), ["g", "p", "x"]);
  assert.deepEqual(order([polygon, collection, nullGeometry]), ["g", "p", "x"]);
});

test("an empty collection stays valid JSON", () => {
  assert.deepEqual(
    JSON.parse(serializeCacheFile({ type: "FeatureCollection", features: [] })),
    {
      type: "FeatureCollection",
      features: [],
    },
  );
});
