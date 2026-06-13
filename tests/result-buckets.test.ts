import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createResultBucketVisibility,
  isResultBucketId,
  RESULT_BUCKET_IDS,
} from "../src/result-buckets";

test("result bucket visibility includes every bucket with the requested state", () => {
  assert.deepEqual(
    Object.keys(createResultBucketVisibility()).sort(),
    [...RESULT_BUCKET_IDS].sort(),
  );
  assert.deepEqual(createResultBucketVisibility(false), {
    missingInOsm: false,
    needsTagging: false,
    matched: false,
    onlyInOsm: false,
  });
});

test("result bucket id guard accepts only known bucket ids", () => {
  assert.equal(isResultBucketId("missingInOsm"), true);
  assert.equal(isResultBucketId("custom"), false);
});
