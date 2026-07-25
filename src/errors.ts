/**
 * User-facing failure messages outside the city-pack flow (those live in
 * pack-errors.ts). Like the pack messages, they live in one dependency-free
 * module so `i18n.ts` can key its translation table off the same constants the
 * throwing code uses — a renamed message then cannot silently fall back to
 * untranslated English.
 */
export const CLIPBOARD_UNAVAILABLE =
  "Clipboard access is not available in this browser.";
export const DATASET_INVALID = "Invalid dataset definition";
export const OFFICIAL_NO_POINTS = "Official dataset has no valid points.";
export const OFFICIAL_GEOJSON_UNAVAILABLE =
  "Could not load valid official GeoJSON. If this is a custom source, " +
  "the server may not allow direct browser access (CORS).";
export const OFFICIAL_NOT_FEATURE_COLLECTION =
  "Official data is not a GeoJSON FeatureCollection";
export const OFFICIAL_NO_FEATURES = "GeoJSON FeatureCollection has no features array";
export const OVERPASS_TIMEOUT = "Overpass request timed out";
export const OVERPASS_INVALID_RESPONSE = "Invalid Overpass JSON response";
export const BROAD_QUERY_FAILED =
  "The relaxed OSM query failed, so some missing items may only need tags.";
