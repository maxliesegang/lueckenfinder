import assert from "node:assert/strict";
import { test } from "node:test";
import { conflate } from "../src/conflate";
import { haversineMeters } from "../src/geo";
import type { Dataset, DatasetPoint } from "../src/types";

const EARTH_RADIUS_M = 6_371_008.8;

function point(
  id: string,
  northM: number,
  props: Record<string, unknown> = {},
  osmRef?: string,
): DatasetPoint {
  return {
    lon: 0,
    lat: ((northM / EARTH_RADIUS_M) * 180) / Math.PI,
    props: { id, ...props },
    osmRef,
  };
}

function testDataset(fixed: Record<string, string> = {}): Dataset {
  return {
    id: "test",
    label: "Test",
    source: "custom",
    geojsonUrl: "",
    overpassQuery: "",
    attribution: "",
    tagMapping: { fixed },
  };
}

test("maximizes cardinality instead of taking the closest pair greedily", () => {
  const official = [point("a", 0), point("b", -80)];
  const osm = [point("x", -30, {}, "node/1"), point("y", 100, {}, "node/2")];

  const result = conflate(official, osm, testDataset(), 120);

  assert.equal(result.matched.length, 2);
  assert.deepEqual(
    result.matched.map(({ official: o, osm: m }) => [o.props.id, m.props.id]),
    [
      ["a", "y"],
      ["b", "x"],
    ],
  );
  assert.deepEqual(result.missingInOsm, []);
  assert.deepEqual(result.onlyInOsm, []);
});

test("minimizes total distance and resolves equal-cost assignments deterministically", () => {
  const official = [point("a", 0), point("b", 100)];
  const osm = [point("x", 40, {}, "node/1"), point("y", 60, {}, "node/2")];

  const minimum = conflate(official, osm, testDataset(), 100);
  assert.deepEqual(
    minimum.matched.map(({ official: o, osm: m }) => [o.props.id, m.props.id]),
    [
      ["a", "x"],
      ["b", "y"],
    ],
  );

  const tiedOfficial = [point("a", 0), point("b", 0)];
  const tiedOsm = [point("x", 10, {}, "node/1"), point("y", 10, {}, "node/2")];
  const assignments = Array.from({ length: 5 }, () =>
    conflate(tiedOfficial, tiedOsm, testDataset(), 20).matched.map(
      ({ official: o, osm: m }) => [o.props.id, m.props.id],
    ),
  );
  for (const assignment of assignments.slice(1)) {
    assert.deepEqual(assignment, assignments[0]);
  }
});

test("includes a match exactly on the radius boundary", () => {
  const official = point("official", 0);
  const boundary = point("boundary", 100, {}, "node/1");
  assert.ok(
    haversineMeters(official.lon, official.lat, boundary.lon, boundary.lat) <= 100,
  );

  const atBoundary = conflate([official], [boundary], testDataset(), 100);
  assert.equal(atBoundary.matched.length, 1);

  const outside = point("outside", 100.001, {}, "node/2");
  const beyondBoundary = conflate([official], [outside], testDataset(), 100);
  assert.equal(beyondBoundary.matched.length, 0);
  assert.deepEqual(beyondBoundary.missingInOsm, [official]);
});

test("does not claim an OSM ref again through broad matching", () => {
  const official = [point("strict", 0), point("other", 100)];
  const strictOsm = [point("strict-osm", 0, { amenity: "bench" }, "node/1")];
  const broadOsm = [point("same-logical-osm", 100, {}, "node/1")];

  const result = conflate(
    official,
    strictOsm,
    testDataset({ amenity: "bench" }),
    20,
    broadOsm,
  );

  assert.equal(result.matched.length, 1);
  assert.deepEqual(result.needsTagging, []);
  assert.deepEqual(result.missingInOsm, [official[1]]);
});

test("strict matches with mapped tag differences need review", () => {
  const official = point("official", 0, { spaces: 20 });
  const osm = point("osm", 0, { amenity: "bicycle_parking", capacity: "10" }, "node/1");
  const propertyMapping: Dataset = {
    ...testDataset({ amenity: "bicycle_parking" }),
    tagMapping: {
      fixed: { amenity: "bicycle_parking" },
      fromProps: { capacity: "spaces" },
    },
  };

  const result = conflate([official], [osm], propertyMapping, 20);

  assert.deepEqual(result.matched, []);
  assert.equal(result.needsTagging.length, 1);
  assert.deepEqual(result.needsTagging[0].attributeGaps, [
    { key: "capacity", expected: "20", osmValue: "10" },
  ]);
});

test("duplicate broad results cannot be claimed by two officials", () => {
  const official = [point("a", 0), point("b", 10)];
  const broadOsm = [
    point("first-copy", 5, {}, "node/1"),
    point("second-copy", 5, {}, "node/1"),
  ];

  const result = conflate(
    official,
    [],
    testDataset({ amenity: "bench" }),
    20,
    broadOsm,
  );

  assert.equal(result.needsTagging.length, 1);
  assert.equal(result.missingInOsm.length, 1);
  assert.equal(result.needsTagging[0].osm.osmRef, "node/1");
});

test("leaves zero-gap broad matches missing", () => {
  const official = point("official", 0);
  const broadOsm = point("broad", 0, { amenity: "bench" }, "node/1");

  const result = conflate([official], [], testDataset({ amenity: "bench" }), 20, [
    broadOsm,
  ]);

  assert.deepEqual(result.needsTagging, []);
  assert.deepEqual(result.missingInOsm, [official]);
});
