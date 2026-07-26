// Small geo helpers — no heavy dependency needed for point conflation.

const EARTH_RADIUS_M = 6_371_008.8;
const DEGREES_TO_RADIANS = Math.PI / 180;

/** Great-circle distance in metres between two lon/lat points. */
export function haversineMeters(
  aLon: number,
  aLat: number,
  bLon: number,
  bLat: number,
): number {
  const dLat = (bLat - aLat) * DEGREES_TO_RADIANS;
  const dLon = (bLon - aLon) * DEGREES_TO_RADIANS;
  const lat1 = aLat * DEGREES_TO_RADIANS;
  const lat2 = bLat * DEGREES_TO_RADIANS;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

export type BBox = [minLon: number, minLat: number, maxLon: number, maxLat: number];

export function bboxOfPoints(points: Array<{ lon: number; lat: number }>): BBox {
  if (points.length === 0) {
    throw new Error("Cannot calculate a bounding box for an empty point set.");
  }

  let minLon = Infinity,
    minLat = Infinity,
    maxLon = -Infinity,
    maxLat = -Infinity;
  for (const point of points) {
    if (!Number.isFinite(point.lon) || !Number.isFinite(point.lat)) {
      throw new Error("Cannot calculate a bounding box from invalid coordinates.");
    }
    if (point.lon < minLon) minLon = point.lon;
    if (point.lat < minLat) minLat = point.lat;
    if (point.lon > maxLon) maxLon = point.lon;
    if (point.lat > maxLat) maxLat = point.lat;
  }
  return [minLon, minLat, maxLon, maxLat];
}

/** Expand a bbox by `meters` on every side (approximate, fine for city scale). */
export function padBbox(bbox: BBox, meters: number): BBox {
  if (!Number.isFinite(meters) || meters < 0) {
    throw new Error("Bounding-box padding must be a non-negative number.");
  }
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const midLat = (minLat + maxLat) / 2;
  const dLat = meters / 111_320;
  const dLon = meters / longitudeMetersPerDegree(midLat);
  return [minLon - dLon, minLat - dLat, maxLon + dLon, maxLat + dLat];
}

/**
 * Grow a bbox outward until each edge sits on a multiple of `degrees`.
 *
 * Datasets covering the same city produce bboxes that differ by metres, which
 * is enough to make two otherwise identical Overpass requests miss each other
 * in a cache keyed by extent. Snapping to a coarse grid collapses those into
 * one request; the result is a superset, and callers already narrow points to
 * the extent they actually care about.
 */
export function snapBbox(bbox: BBox, degrees: number): BBox {
  if (!Number.isFinite(degrees) || degrees <= 0) {
    throw new Error("Bounding-box grid size must be a positive number.");
  }
  const [minLon, minLat, maxLon, maxLat] = bbox;
  return [
    gridEdge(minLon, degrees, Math.floor),
    gridEdge(minLat, degrees, Math.floor),
    gridEdge(maxLon, degrees, Math.ceil),
    gridEdge(maxLat, degrees, Math.ceil),
  ];
}

/**
 * One edge, snapped to the grid. Both the division and the multiplication leave
 * floating-point dust — `8.54 / 0.01` is `854.0000000000001`, which `Math.ceil`
 * turns into a whole extra cell — so each is trimmed well below any meaningful
 * geographic resolution. Without that, snapping an already snapped bbox would
 * move it, and two callers could key the same extent differently.
 */
function gridEdge(
  value: number,
  degrees: number,
  round: (value: number) => number,
): number {
  return trimFloatDust(round(trimFloatDust(value / degrees)) * degrees);
}

/** Decimal places kept after floating-point arithmetic — well below any meaningful geographic resolution. */
const COORDINATE_PRECISION = 9;

/** Strip floating-point dust below {@link COORDINATE_PRECISION} decimal places. */
function trimFloatDust(value: number): number {
  return Number(value.toFixed(COORDINATE_PRECISION));
}

/** Whether a point lies inside a bounding box, edges included. */
export function pointInBbox(point: { lon: number; lat: number }, bbox: BBox): boolean {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  return (
    point.lon >= minLon &&
    point.lon <= maxLon &&
    point.lat >= minLat &&
    point.lat <= maxLat
  );
}

/** Metres -> degrees of latitude / longitude at a given latitude. */
export function metersToDegrees(
  meters: number,
  atLat: number,
): {
  dLat: number;
  dLon: number;
} {
  if (
    !Number.isFinite(meters) ||
    meters < 0 ||
    !Number.isFinite(atLat) ||
    Math.abs(atLat) > 90
  ) {
    throw new Error("Distance must be non-negative and latitude must be valid WGS84.");
  }
  return {
    dLat: meters / 111_320,
    dLon: meters / longitudeMetersPerDegree(atLat),
  };
}

function longitudeMetersPerDegree(latitude: number): number {
  return Math.max(111_320 * Math.abs(Math.cos(latitude * DEGREES_TO_RADIANS)), 1);
}
