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
