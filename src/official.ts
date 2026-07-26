import {
  OFFICIAL_GEOJSON_UNAVAILABLE,
  OFFICIAL_NO_FEATURES,
  OFFICIAL_NOT_FEATURE_COLLECTION,
} from "./errors";
import type { Dataset, DatasetPoint } from "./types";
import {
  isFiniteNumber,
  isPositiveInteger,
  isRecord,
  isValidLat,
  isValidLon,
} from "./validation";

type Position = [lon: number, lat: number];

export interface OfficialLoadOptions {
  signal?: AbortSignal;
}

/**
 * Evidence that a source returned only part of its result set, e.g. because an
 * ArcGIS or WFS endpoint applied its default record cap. Silently comparing a
 * truncated extract would report every withheld record as missing from OSM.
 */
export interface OfficialTruncation {
  /** Features actually present in the response. */
  returned: number;
  /** Features the source says exist, when it says so. */
  matched: number | null;
}

export interface OfficialData {
  points: DatasetPoint[];
  truncation: OfficialTruncation | null;
}

/**
 * Load official data for a dataset. For presets we first try the build-time
 * cached copy under ./presets-data/<id>.geojson (same-origin, no CORS); if that
 * is missing we fall back to the live URL. Custom datasets always go live and
 * therefore depend on the remote server sending CORS headers.
 */
export async function loadOfficial(
  dataset: Dataset,
  options: OfficialLoadOptions = {},
): Promise<OfficialData> {
  // Only a shipped pack has a build-time copy, and it is filed under its city.
  if (dataset.source === "preset" && dataset.cityId !== undefined) {
    const cached = await tryLoadOfficial(
      presetCacheUrl(dataset.cityId, dataset.id),
      options.signal,
    );
    if (cached) return cached;
  }
  const live = await tryLoadOfficial(dataset.geojsonUrl, options.signal);
  if (!live) {
    throw new Error(OFFICIAL_GEOJSON_UNAVAILABLE);
  }
  return live;
}

/**
 * Detect a partial response. Three conventions cover the portals this app
 * targets:
 *   - ArcGIS FeatureServer sets `exceededTransferLimit` (top level, or nested
 *     under `properties` in newer versions).
 *   - OGC API Features / WFS 2 report `numberMatched` against `numberReturned`.
 *   - GeoServer WFS 1.x reports `totalFeatures`, sometimes as "unknown".
 */
export function detectTruncation(value: unknown): OfficialTruncation | null {
  if (!isRecord(value) || !Array.isArray(value.features)) return null;

  const returned = value.features.length;
  const matched =
    featureCount(value.numberMatched) ?? featureCount(value.totalFeatures);
  const flagged =
    value.exceededTransferLimit === true ||
    (isRecord(value.properties) && value.properties.exceededTransferLimit === true);

  if (!flagged && !(matched !== null && matched > returned)) return null;
  return { returned, matched };
}

export function formatTruncation(truncation: OfficialTruncation): string {
  const of = truncation.matched === null ? "" : ` of ${truncation.matched}`;
  return (
    `the source returned only ${truncation.returned}${of} features. ` +
    "Add paging parameters to geojsonUrl (ArcGIS: resultRecordCount/resultOffset, " +
    "WFS: count/startIndex)."
  );
}

function featureCount(value: unknown): number | null {
  return isPositiveInteger(value) ? value : null;
}

/**
 * Where `scripts/fetch-presets.ts` wrote a shipped dataset's copy: one
 * directory per city, mirroring `cacheFilePath` in scripts/preset-cache.ts.
 */
export function presetCacheUrl(cityId: string, datasetId: string): string {
  const path = `../presets-data/${encodeURIComponent(cityId)}/${encodeURIComponent(datasetId)}.geojson`;
  return new URL(path, import.meta.url).toString();
}

async function tryLoadOfficial(
  url: string,
  signal: AbortSignal | undefined,
): Promise<OfficialData | null> {
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    const json: unknown = await res.json();
    return {
      points: parseOfficialGeoJson(json),
      truncation: detectTruncation(json),
    };
  } catch (error) {
    if (signal?.aborted) throw error;
    return null;
  }
}

/** Validate GeoJSON and convert each non-empty feature to a representative point. */
export function parseOfficialGeoJson(value: unknown): DatasetPoint[] {
  if (!isRecord(value) || value.type !== "FeatureCollection") {
    throw new TypeError(OFFICIAL_NOT_FEATURE_COLLECTION);
  }
  if (!Array.isArray(value.features)) {
    throw new TypeError(OFFICIAL_NO_FEATURES);
  }

  return value.features.flatMap((feature, index) => {
    if (!isRecord(feature) || feature.type !== "Feature") {
      throw new TypeError(`Invalid GeoJSON feature at index ${index}`);
    }
    const properties = parseProperties(feature.properties, index);
    const coords = geometryPositions(feature.geometry, index);
    if (coords.length === 0) return [];

    const [first, ...rest] = coords;
    let minLon = first[0];
    let minLat = first[1];
    let maxLon = first[0];
    let maxLat = first[1];
    for (const [lon, lat] of rest) {
      minLon = Math.min(minLon, lon);
      minLat = Math.min(minLat, lat);
      maxLon = Math.max(maxLon, lon);
      maxLat = Math.max(maxLat, lat);
    }
    return [
      {
        lon: (minLon + maxLon) / 2,
        lat: (minLat + maxLat) / 2,
        props: properties,
      },
    ];
  });
}

function parseProperties(
  value: unknown,
  featureIndex: number,
): Record<string, unknown> {
  if (value === null || value === undefined) return {};
  if (!isRecord(value)) {
    throw new TypeError(`Invalid GeoJSON properties at feature ${featureIndex}`);
  }
  return value;
}

function geometryPositions(value: unknown, featureIndex: number): Position[] {
  if (value === null) return [];
  if (!isRecord(value) || typeof value.type !== "string") {
    throw new TypeError(`Invalid GeoJSON geometry at feature ${featureIndex}`);
  }

  switch (value.type) {
    case "Point":
      return [parsePosition(value.coordinates, featureIndex)];
    case "MultiPoint":
    case "LineString":
      return parsePositionArray(value.coordinates, featureIndex);
    case "MultiLineString":
    case "Polygon":
      return parseNestedPositions(value.coordinates, 2, featureIndex);
    case "MultiPolygon":
      return parseNestedPositions(value.coordinates, 3, featureIndex);
    case "GeometryCollection": {
      if (!Array.isArray(value.geometries)) {
        throw new TypeError(
          `Invalid GeoJSON GeometryCollection at feature ${featureIndex}`,
        );
      }
      return value.geometries.flatMap((geometry) =>
        geometryPositions(geometry, featureIndex),
      );
    }
    default:
      throw new TypeError(
        `Unsupported GeoJSON geometry "${value.type}" at feature ${featureIndex}`,
      );
  }
}

function parseNestedPositions(
  value: unknown,
  depth: number,
  featureIndex: number,
): Position[] {
  if (!Array.isArray(value)) {
    throw new TypeError(`Invalid GeoJSON coordinates at feature ${featureIndex}`);
  }
  if (depth === 1) return parsePositionArray(value, featureIndex);
  return value.flatMap((entry) => parseNestedPositions(entry, depth - 1, featureIndex));
}

function parsePositionArray(value: unknown, featureIndex: number): Position[] {
  if (!Array.isArray(value)) {
    throw new TypeError(`Invalid GeoJSON coordinates at feature ${featureIndex}`);
  }
  return value.map((entry) => parsePosition(entry, featureIndex));
}

function parsePosition(value: unknown, featureIndex: number): Position {
  if (
    !Array.isArray(value) ||
    value.length < 2 ||
    !isValidLon(value[0]) ||
    !isValidLat(value[1]) ||
    value.slice(2).some((entry) => !isFiniteNumber(entry))
  ) {
    throw new TypeError(`Invalid WGS84 coordinate at GeoJSON feature ${featureIndex}`);
  }
  return [value[0], value[1]];
}
