import assert from "node:assert/strict";
import test from "node:test";
import { bboxOfPoints, haversineMeters, metersToDegrees, padBbox } from "../src/geo";

test("haversineMeters returns a known city-scale distance", () => {
  const distance = haversineMeters(8.4037, 49.0069, 8.4047, 49.0069);
  assert.ok(distance > 72 && distance < 74);
});

test("bboxOfPoints rejects empty and invalid point sets", () => {
  assert.throws(() => bboxOfPoints([]), /empty point set/);
  assert.throws(
    () => bboxOfPoints([{ lon: Number.NaN, lat: 49 }]),
    /invalid coordinates/,
  );
});

test("padding and degree conversion validate their inputs", () => {
  assert.throws(() => padBbox([0, 0, 1, 1], -1), /non-negative/);
  assert.throws(() => metersToDegrees(-1, 0), /non-negative/);

  const padded = padBbox([8, 49, 9, 50], 100);
  assert.ok(padded[0] < 8);
  assert.ok(padded[1] < 49);
  assert.ok(padded[2] > 9);
  assert.ok(padded[3] > 50);
});
