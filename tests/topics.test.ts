import assert from "node:assert/strict";
import test from "node:test";

import { parseCityPack } from "../src/city-pack";
import { mergeOsmCriteria } from "../src/dataset-criteria";
import { parseDatasetDefinition } from "../src/dataset-definition";
import { matchesSelector, selectorFixedTags } from "../src/osm-selector";
import { getTopicCriteria, OSM_TOPICS } from "../src/topics";
import type { DatasetPoint } from "../src/types";

const base = {
  id: "example",
  label: "Example",
  geojsonUrl: "https://example.org/data.geojson",
  attribution: "Example",
};

function osm(props: Record<string, string>): DatasetPoint {
  return { lon: 8, lat: 49, props, osmRef: "way/1" };
}

test("the shipped catalog loads and every topic states some criteria", () => {
  assert.ok(OSM_TOPICS.size > 0);
  for (const [topicId, criteria] of OSM_TOPICS) {
    assert.ok(Object.keys(criteria).length > 0, `${topicId} is empty`);
  }
  assert.equal(getTopicCriteria("no-such-topic"), null);
});

test("a topic supplies the criteria a dataset does not state", () => {
  const definition = parseDatasetDefinition({ ...base, topic: "drinking-water" });
  assert.ok(definition);
  assert.equal(definition.topic, "drinking-water");
  assert.deepEqual(definition.osmSelector, { tags: { amenity: "drinking_water" } });
  assert.deepEqual(definition.broadSelector, { tags: { drinking_water: "yes" } });
});

test("an unknown topic fails the parse rather than resolving to nothing", () => {
  assert.equal(parseDatasetDefinition({ ...base, topic: "atlantis-fountains" }), null);
  assert.equal(parseDatasetDefinition({ ...base, topic: "" }), null);
  assert.equal(parseDatasetDefinition({ ...base, topic: 7 }), null);
});

test("a dataset with neither topic nor criteria has nothing to query", () => {
  assert.equal(parseDatasetDefinition(base), null);
});

/**
 * A city's list of Parkhäuser is a list of built structures, but most of
 * `amenity=parking` is street-side bays and surface lots — matching against all
 * of it pairs a garage with whatever parking happens to be nearest. The strict
 * half therefore asks only for the built subtypes, and the relaxed half keeps
 * every off-street lot so a garage mapped without its subtype still surfaces as
 * a tagging suggestion rather than a phantom gap.
 */
test("multi-storey car parks are structures, not any nearby parking", () => {
  const definition = parseDatasetDefinition({
    ...base,
    topic: "multi-storey-car-park",
  });
  const strictSelector = definition?.osmSelector;
  const broadSelector = definition?.broadSelector;
  assert.ok(strictSelector);
  assert.ok(broadSelector);

  const strict = (props: Record<string, string>) =>
    matchesSelector(strictSelector, osm(props));
  const relaxed = (props: Record<string, string>) =>
    matchesSelector(broadSelector, osm(props));

  for (const parking of ["multi-storey", "underground", "rooftop"]) {
    assert.ok(strict({ amenity: "parking", parking }), parking);
  }
  for (const parking of ["surface", "street_side", "lane", "on_kerb", "layby"]) {
    assert.equal(strict({ amenity: "parking", parking }), false, parking);
  }
  // A subtype-less lot could be either, so only the relaxed half claims it.
  assert.equal(strict({ amenity: "parking" }), false);
  assert.ok(relaxed({ amenity: "parking" }));
  assert.ok(relaxed({ amenity: "parking", parking: "surface" }));
  // The bay outside the entrance must not be offered the garage's capacity.
  assert.equal(relaxed({ amenity: "parking", parking: "street_side" }), false);

  // The subtype varies across matches, so it is never an expectation.
  assert.deepEqual(selectorFixedTags(strictSelector), {
    amenity: "parking",
  });
});

test("the dataset's own strict criteria replace the topic's whole slot", () => {
  const definition = parseDatasetDefinition({
    ...base,
    topic: "drinking-water",
    overpassQuery: 'nwr["amenity"="fountain"]({{bbox}});',
  });
  assert.ok(definition);
  // Taking the topic's selector too would state the strict criteria twice.
  assert.equal(definition.osmSelector, undefined);
  assert.equal(definition.overpassQuery, 'nwr["amenity"="fountain"]({{bbox}});');
  // The relaxed slot is untouched, so it still comes from the topic.
  assert.deepEqual(definition.broadSelector, { tags: { drinking_water: "yes" } });
});

test("tag mappings merge key by key, with the dataset winning", () => {
  const definition = parseDatasetDefinition({
    ...base,
    topic: "recycling-glass",
    tagMapping: {
      fixed: { "recycling:glass": "yes" },
      fromProps: { operator: "betreiber" },
    },
  });
  assert.ok(definition);
  assert.deepEqual(definition.tagMapping, {
    // recycling_type comes from the topic and survives beside the dataset's key.
    fixed: { recycling_type: "container", "recycling:glass": "yes" },
    fromProps: { operator: "betreiber" },
  });

  const overriding = parseDatasetDefinition({
    ...base,
    topic: "recycling-glass",
    tagMapping: { fixed: { recycling_type: "centre" } },
  });
  assert.ok(overriding);
  assert.deepEqual(overriding.tagMapping, { fixed: { recycling_type: "centre" } });
});

test("parsing an already resolved definition changes nothing", () => {
  const once = parseDatasetDefinition({
    ...base,
    topic: "recycling-glass",
    tagMapping: { fromProps: { operator: "betreiber" } },
  });
  assert.ok(once);
  // Storage and share payloads hold the resolved form; re-reading one must not
  // drift, or a stored dataset would change meaning when a topic is edited.
  assert.deepEqual(parseDatasetDefinition(JSON.parse(JSON.stringify(once))), once);
});

test("merging is slot-wise for criteria and key-wise for tag mappings", () => {
  const topic = {
    osmSelector: { tags: { amenity: "recycling" } },
    broadSelector: { tags: { amenity: "waste_disposal" } },
    tagMapping: { fixed: { recycling_type: "container" } },
  };

  assert.deepEqual(mergeOsmCriteria(topic, {}), topic);
  assert.deepEqual(mergeOsmCriteria({}, topic), topic);

  const overridden = mergeOsmCriteria(topic, {
    broadMatchQuery: 'nwr["amenity"]({{bbox}});',
  });
  // The relaxed slot was stated, so the topic's selector for it is dropped.
  assert.equal(overridden.broadSelector, undefined);
  assert.equal(overridden.broadMatchQuery, 'nwr["amenity"]({{bbox}});');
  assert.deepEqual(overridden.osmSelector, { tags: { amenity: "recycling" } });
});

test("a city pack is rejected when a dataset names an unshipped topic", () => {
  const pack = {
    city: { id: "example-city", name: "Example", center: [8, 49], zoom: 12 },
    datasets: [{ ...base, topic: "atlantis-fountains" }],
  };
  assert.equal(parseCityPack(pack), null);

  assert.ok(
    parseCityPack({ ...pack, datasets: [{ ...base, topic: "playground" }] }),
    "a shipped topic is accepted",
  );
});
