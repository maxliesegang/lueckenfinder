import assert from "node:assert/strict";
import test from "node:test";
import { filterAndSortDatasets } from "../src/datasets";
import type { Dataset } from "../src/types";

function dataset(
  id: string,
  label: string,
  source: Dataset["source"] = "preset",
): Dataset {
  return {
    id,
    label,
    source,
    geojsonUrl: "https://example.com/data.geojson",
    overpassQuery: "node({{bbox}});",
    attribution: "Example",
  };
}

test("dataset filtering is locale-aware, sorted, and non-mutating", () => {
  const datasets = [
    dataset("zoo", "Zoo"),
    dataset("apple", "Äpfel"),
    dataset("bike", "Fahrrad"),
  ];

  assert.deepEqual(
    filterAndSortDatasets(datasets, "ÄP", "de").map(({ id }) => id),
    ["apple"],
  );
  assert.deepEqual(
    filterAndSortDatasets(datasets, "", "de").map(({ id }) => id),
    ["apple", "bike", "zoo"],
  );
  assert.deepEqual(
    datasets.map(({ id }) => id),
    ["zoo", "apple", "bike"],
  );
});
