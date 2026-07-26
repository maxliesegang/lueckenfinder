import assert from "node:assert/strict";
import test from "node:test";
import { summaryItems } from "../src/summary";
import type { ConflationResult } from "../src/types";

const result: ConflationResult = {
  missingInOsm: [{ lon: 8, lat: 49, props: {} }],
  needsTagging: [],
  matched: [],
  onlyInOsm: [],
};

test("summary items preserve application visibility across rerenders", () => {
  const items = summaryItems(result, {
    missingInOsm: false,
    needsTagging: true,
    matched: true,
    onlyInOsm: true,
  });

  assert.equal(items.find(({ id }) => id === "missingInOsm")?.visible, false);
  assert.equal(items.find(({ id }) => id === "missingInOsm")?.count, 1);
});

test("a partial source labels OSM-only results as expected, not as a finding", () => {
  const visibility = {
    missingInOsm: true,
    needsTagging: true,
    matched: true,
    onlyInOsm: true,
  };

  const exhaustive = summaryItems(result, visibility);
  const partial = summaryItems(result, visibility, false);

  assert.equal(
    exhaustive.find(({ id }) => id === "onlyInOsm")?.actionKey,
    "bucket.onlyInOsm.action",
  );
  assert.equal(
    partial.find(({ id }) => id === "onlyInOsm")?.actionKey,
    "bucket.onlyInOsm.partialAction",
  );
  // Only that one row changes.
  assert.deepEqual(
    partial.filter(({ id }) => id !== "onlyInOsm"),
    exhaustive.filter(({ id }) => id !== "onlyInOsm"),
  );
});
