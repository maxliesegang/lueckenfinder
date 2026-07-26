import assert from "node:assert/strict";
import test from "node:test";
import {
  bboxOfPoints,
  haversineMeters,
  metersToDegrees,
  padBbox,
  pointInBbox,
  snapBbox,
} from "../src/geo";

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

test("snapping grows a bbox onto a grid and never shrinks it", () => {
  assert.throws(() => snapBbox([0, 0, 1, 1], 0), /positive number/);

  const bbox: [number, number, number, number] = [8.3814, 48.9522, 8.5361, 49.0821];
  const snapped = snapBbox(bbox, 0.01);
  assert.deepEqual(snapped, [8.38, 48.95, 8.54, 49.09]);
  assert.ok(snapped[0] <= bbox[0] && snapped[1] <= bbox[1]);
  assert.ok(snapped[2] >= bbox[2] && snapped[3] >= bbox[3]);

  // Extents differing by less than the grid land on the same request.
  assert.deepEqual(snapBbox([8.3819, 48.9525, 8.5359, 49.0817], 0.01), snapped);
  // Already on the grid, so snapping is idempotent.
  assert.deepEqual(snapBbox(snapped, 0.01), snapped);
});

test("pointInBbox includes edges and excludes points outside", () => {
  const bbox: [number, number, number, number] = [8, 49, 9, 50];
  assert.ok(pointInBbox({ lon: 8.5, lat: 49.5 }, bbox));
  assert.ok(pointInBbox({ lon: 8, lat: 50 }, bbox));
  assert.ok(!pointInBbox({ lon: 7.9, lat: 49.5 }, bbox));
  assert.ok(!pointInBbox({ lon: 8.5, lat: 50.1 }, bbox));
});
