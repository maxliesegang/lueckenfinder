import assert from "node:assert/strict";
import test from "node:test";
import { detectTruncation, formatTruncation } from "../src/official";

function collection(extra: Record<string, unknown>, featureCount = 2) {
  return {
    type: "FeatureCollection",
    features: Array.from({ length: featureCount }, () => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [8, 49] },
      properties: {},
    })),
    ...extra,
  };
}

test("ArcGIS transfer limits are detected at either nesting level", () => {
  assert.deepEqual(detectTruncation(collection({ exceededTransferLimit: true })), {
    returned: 2,
    matched: null,
  });
  assert.deepEqual(
    detectTruncation(collection({ properties: { exceededTransferLimit: true } })),
    { returned: 2, matched: null },
  );
});

test("WFS and OGC feature counts are compared against what arrived", () => {
  assert.deepEqual(detectTruncation(collection({ numberMatched: 5000 })), {
    returned: 2,
    matched: 5000,
  });
  assert.deepEqual(detectTruncation(collection({ totalFeatures: 5000 })), {
    returned: 2,
    matched: 5000,
  });
});

test("complete responses report no truncation", () => {
  assert.equal(detectTruncation(collection({})), null);
  assert.equal(detectTruncation(collection({ exceededTransferLimit: false })), null);
  assert.equal(
    detectTruncation(collection({ numberMatched: 2, numberReturned: 2 })),
    null,
  );
  // GeoServer sends "unknown" when it cannot count; that is not evidence of a cap.
  assert.equal(detectTruncation(collection({ totalFeatures: "unknown" })), null);
  assert.equal(detectTruncation({ type: "FeatureCollection" }), null);
  assert.equal(detectTruncation(null), null);
});

test("the truncation message names the counts and the fix", () => {
  assert.match(
    formatTruncation({ returned: 2000, matched: 5000 }),
    /only 2000 of 5000 features.*resultRecordCount/s,
  );
  assert.match(
    formatTruncation({ returned: 1000, matched: null }),
    /only 1000 features/,
  );
});
