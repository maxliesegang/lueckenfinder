import type { Dataset, DatasetPoint } from "./types";
import { isFiniteNumber, isRecord, isValidLat, isValidLon } from "./validation";

type Position = [lon: number, lat: number];

export interface OfficialLoadOptions {
  signal?: AbortSignal;
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
): Promise<DatasetPoint[]> {
  if (dataset.source === "preset") {
    const cached = await tryLoadPoints(presetCacheUrl(dataset.id), options.signal);
    if (cached) return cached;
  }
  const live = await tryLoadPoints(dataset.geojsonUrl, options.signal);
  if (!live) {
    throw new Error(
      "Could not load valid official GeoJSON. If this is a custom source, " +
        "the server may not allow direct browser access (CORS).",
    );
  }
  return live;
}

export function presetCacheUrl(datasetId: string): string {
  const path = `../presets-data/${encodeURIComponent(datasetId)}.geojson`;
  return new URL(path, import.meta.url).toString();
}

async function tryLoadPoints(
  url: string,
  signal: AbortSignal | undefined,
): Promise<DatasetPoint[] | null> {
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    return parseOfficialGeoJson(await res.json());
  } catch (error) {
    if (signal?.aborted) throw error;
    return null;
  }
}

/** Validate GeoJSON and convert each non-empty feature to a representative point. */
export function parseOfficialGeoJson(value: unknown): DatasetPoint[] {
  if (!isRecord(value) || value.type !== "FeatureCollection") {
    throw new TypeError("Official data is not a GeoJSON FeatureCollection");
  }
  if (!Array.isArray(value.features)) {
    throw new TypeError("GeoJSON FeatureCollection has no features array");
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
