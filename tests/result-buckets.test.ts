import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createResultBucketVisibility,
  initialResultBucketVisibility,
  isExhaustiveSource,
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

test("a source is exhaustive unless it says otherwise", () => {
  assert.equal(isExhaustiveSource(undefined), true);
  assert.equal(isExhaustiveSource({}), true);
  assert.equal(isExhaustiveSource({ exhaustive: true }), true);
  assert.equal(isExhaustiveSource({ exhaustive: false }), false);
});

test("a partial source starts with its OSM-only markers hidden", () => {
  assert.deepEqual(initialResultBucketVisibility({}), createResultBucketVisibility());
  assert.deepEqual(initialResultBucketVisibility({ exhaustive: false }), {
    missingInOsm: true,
    needsTagging: true,
    matched: true,
    onlyInOsm: false,
  });
});

test("result bucket id guard accepts only known bucket ids", () => {
  assert.equal(isResultBucketId("missingInOsm"), true);
  assert.equal(isResultBucketId("custom"), false);
});
