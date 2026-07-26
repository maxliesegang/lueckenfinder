import assert from "node:assert/strict";
import test from "node:test";

import { parseCityPack } from "../src/city-pack";
import { mergeOsmCriteria } from "../src/dataset-criteria";
import { parseDatasetDefinition } from "../src/dataset-definition";
import { getTopicCriteria, OSM_TOPICS } from "../src/topics";

const base = {
  id: "example",
  label: "Example",
  geojsonUrl: "https://example.org/data.geojson",
  attribution: "Example",
};

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
      fixed: { recycling_type: "centre" },
      fromProps: { operator: "betreiber" },
    },
  });
  assert.ok(definition);
  assert.deepEqual(definition.tagMapping, {
    // recycling:glass_bottles comes from the topic, recycling_type is overridden.
    fixed: { recycling_type: "centre", "recycling:glass_bottles": "yes" },
    fromProps: { operator: "betreiber" },
  });
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
