import assert from "node:assert/strict";
import test from "node:test";
import { buildQueryPlan } from "../src/dataset-query";
import type { DatasetDefinition, DatasetPoint } from "../src/types";

const base: DatasetDefinition = {
  id: "test",
  label: "Test",
  geojsonUrl: "https://example.com/data.geojson",
  attribution: "Example",
};

function osm(props: Record<string, string>): DatasetPoint {
  return { lon: 8, lat: 49, props, osmRef: "node/1" };
}

test("a selector plus relaxed criteria resolve to a single unioned query", () => {
  const plan = buildQueryPlan({
    ...base,
    osmSelector: { tags: { amenity: "drinking_water" } },
    broadSelector: { tags: { drinking_water: "yes" } },
  });

  assert.equal(
    plan.query,
    'nwr["amenity"="drinking_water"]({{bbox}});\nnwr["drinking_water"="yes"]({{bbox}});',
  );
  assert.equal(plan.broadQuery, null);
  assert.ok(plan.isStrictMatch);
  assert.equal(plan.isStrictMatch(osm({ amenity: "drinking_water" })), true);
  assert.equal(plan.isStrictMatch(osm({ drinking_water: "yes" })), false);
});

test("a selector works with a raw relaxed query, still in one request", () => {
  const plan = buildQueryPlan({
    ...base,
    osmSelector: { tags: { amenity: "toilets" } },
    broadMatchQuery: 'nwr["toilets"]({{bbox}});',
  });

  assert.equal(
    plan.query,
    'nwr["amenity"="toilets"]({{bbox}});\nnwr["toilets"]({{bbox}});',
  );
  assert.equal(plan.broadQuery, null);
  assert.ok(plan.isStrictMatch);
});

test("raw strict QL keeps the two-request path, since it has no predicate", () => {
  const plan = buildQueryPlan({
    ...base,
    overpassQuery: 'nwr["amenity"="bench"]({{bbox}});',
    broadMatchQuery: 'nwr["amenity"]({{bbox}});',
  });

  assert.equal(plan.query, 'nwr["amenity"="bench"]({{bbox}});');
  assert.equal(plan.broadQuery, 'nwr["amenity"]({{bbox}});');
  assert.equal(plan.isStrictMatch, null);
});

test("a dataset without relaxed criteria issues its strict query alone", () => {
  const plan = buildQueryPlan({
    ...base,
    osmSelector: { tags: { amenity: "toilets" } },
  });

  assert.equal(plan.query, 'nwr["amenity"="toilets"]({{bbox}});');
  assert.equal(plan.broadQuery, null);
  assert.equal(plan.isStrictMatch, null);
});

// The comparison cache keys Overpass responses by the resolved query, so two
// datasets that ask the same thing share one request however they spelled it.
test("the resolved query is the same whichever field states the criteria", () => {
  const viaSelector = buildQueryPlan({
    ...base,
    osmSelector: { tags: { amenity: "toilets" } },
  });
  const viaQuery = buildQueryPlan({
    ...base,
    overpassQuery: 'nwr["amenity"="toilets"]({{bbox}});',
  });
  assert.equal(viaSelector.query, viaQuery.query);

  const changed = buildQueryPlan({
    ...base,
    osmSelector: { tags: { amenity: "bench" } },
  });
  assert.notEqual(viaSelector.query, changed.query);
});
