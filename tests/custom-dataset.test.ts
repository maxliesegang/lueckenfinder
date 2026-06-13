import assert from "node:assert/strict";
import test from "node:test";
import {
  CUSTOM_DATASET_ATTRIBUTION,
  createCustomDatasetDefinition,
} from "../src/custom-dataset";

test("custom dataset creation normalizes input and stores stable attribution", () => {
  assert.deepEqual(
    createCustomDatasetDefinition(
      {
        label: "  Drinking Fountains  ",
        geojsonUrl: " https://example.com/fountains.geojson ",
        sourceUrl: " https://example.com/fountains ",
        overpassQuery: " node({{bbox}}); ",
      },
      "abc123",
    ),
    {
      id: "custom-drinking-fountains-abc123",
      label: "Drinking Fountains",
      geojsonUrl: "https://example.com/fountains.geojson",
      overpassQuery: "node({{bbox}});",
      attribution: CUSTOM_DATASET_ATTRIBUTION,
      sourceUrl: "https://example.com/fountains",
    },
  );
});
