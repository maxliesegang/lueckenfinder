import assert from "node:assert/strict";
import { test } from "node:test";
import {
  layerIdsForVisibilityTarget,
  pointMatchesToLineFeatureCollection,
  pointsToFeatureCollection,
  RESULT_BUCKET_LAYER_REGISTRY,
} from "../src/map-layers";
import type { DatasetPoint, PointMatch } from "../src/types";

test("bucket visibility includes each descriptor's companion layers", () => {
  assert.deepEqual(layerIdsForVisibilityTarget("onlyInOsm"), ["lyr-onlyInOsm"]);
  assert.deepEqual(layerIdsForVisibilityTarget("missingInOsm"), ["lyr-missingInOsm"]);
  assert.deepEqual(layerIdsForVisibilityTarget("matched"), [
    "lyr-matched",
    "lyr-matched-osm",
    "lyr-match-lines",
  ]);
  assert.deepEqual(layerIdsForVisibilityTarget("needsTagging"), [
    "lyr-needsTagging",
    "lyr-needs-tagging-osm",
    "lyr-needs-tagging-lines",
  ]);
  assert.deepEqual(layerIdsForVisibilityTarget("custom"), ["lyr-custom"]);

  for (const [bucketId, descriptor] of Object.entries(RESULT_BUCKET_LAYER_REGISTRY)) {
    assert.equal(descriptor.primary.visibilityBucket, bucketId);
    for (const companion of descriptor.companions) {
      assert.equal(companion.visibilityBucket, bucketId);
    }
  }
});

test("points convert to indexed GeoJSON features for the render version", () => {
  const points: DatasetPoint[] = [
    { lon: 8, lat: 49, props: { name: "First" } },
    { lon: 8.1, lat: 49.1, props: { name: "Second" } },
  ];

  assert.deepEqual(pointsToFeatureCollection(points, 7), {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        id: 0,
        geometry: { type: "Point", coordinates: [8, 49] },
        properties: { idx: 0, renderVersion: 7 },
      },
      {
        type: "Feature",
        id: 1,
        geometry: { type: "Point", coordinates: [8.1, 49.1] },
        properties: { idx: 1, renderVersion: 7 },
      },
    ],
  });
});

test("matched pairs convert to connecting GeoJSON lines", () => {
  const pair: PointMatch = {
    official: { lon: 8, lat: 49, props: {} },
    osm: { lon: 8.01, lat: 49.01, props: {}, osmRef: "node/1" },
    distanceM: 10,
    attributeGaps: [],
  };

  assert.deepEqual(pointMatchesToLineFeatureCollection([pair]), {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: [
            [8, 49],
            [8.01, 49.01],
          ],
        },
        properties: {},
      },
    ],
  });
});
