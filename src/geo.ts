// Small geo helpers — no heavy dependency needed for point conflation.

const EARTH_R = 6_371_008.8; // mean Earth radius, metres
const DEG = Math.PI / 180;

/** Great-circle distance in metres between two lon/lat points. */
export function haversineMeters(
  aLon: number,
  aLat: number,
  bLon: number,
  bLat: number,
): number {
  const dLat = (bLat - aLat) * DEG;
  const dLon = (bLon - aLon) * DEG;
  const lat1 = aLat * DEG;
  const lat2 = bLat * DEG;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.sqrt(h));
}

export type BBox = [minLon: number, minLat: number, maxLon: number, maxLat: number];

export function bboxOfPoints(pts: Array<{ lon: number; lat: number }>): BBox {
  if (pts.length === 0) {
    throw new Error("Cannot calculate a bounding box for an empty point set.");
  }

  let minLon = Infinity,
    minLat = Infinity,
    maxLon = -Infinity,
    maxLat = -Infinity;
  for (const p of pts) {
    if (!Number.isFinite(p.lon) || !Number.isFinite(p.lat)) {
      throw new Error("Cannot calculate a bounding box from invalid coordinates.");
    }
    if (p.lon < minLon) minLon = p.lon;
    if (p.lat < minLat) minLat = p.lat;
    if (p.lon > maxLon) maxLon = p.lon;
    if (p.lat > maxLat) maxLat = p.lat;
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
  return Math.max(111_320 * Math.abs(Math.cos(latitude * DEG)), 1);
}
