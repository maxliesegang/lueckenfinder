import { parseDatasetDefinition } from "./dataset-definition";
import type { CityDefinition, CityPack, Dataset } from "./types";
import {
  httpUrl,
  isFiniteNumber,
  isRecord,
  isValidLat,
  isValidLon,
  nonEmptyString,
  safeId,
} from "./validation";

const MAX_ZOOM = 24;
const COUNTRY_CODE = /^[A-Z]{2}$/;

/**
 * Parse an untrusted value into a city definition. Unknown properties are
 * dropped, so the result is safe to store and to share.
 */
export function parseCityDefinition(value: unknown): CityDefinition | null {
  if (!isRecord(value)) return null;

  const id = safeId(value.id);
  const name = nonEmptyString(value.name);
  const center = parseCenter(value.center);

  if (
    id === null ||
    name === null ||
    center === null ||
    !isFiniteNumber(value.zoom) ||
    value.zoom < 0 ||
    value.zoom > MAX_ZOOM
  ) {
    return null;
  }

  const city: CityDefinition = { id, name, center, zoom: value.zoom };

  if (value.country !== undefined) {
    const country = nonEmptyString(value.country)?.toUpperCase();
    if (country === undefined || !COUNTRY_CODE.test(country)) return null;
    city.country = country;
  }

  if (value.sourceUrl !== undefined) {
    const sourceUrl = httpUrl(value.sourceUrl);
    if (sourceUrl === null) return null;
    city.sourceUrl = sourceUrl;
  }

  return city;
}

/**
 * Parse an untrusted value into a city pack. A pack is rejected outright when
 * any dataset in it is invalid: a partially loaded city would silently hide
 * datasets the author believes are published.
 */
export function parseCityPack(value: unknown): CityPack | null {
  if (!isRecord(value) || !Array.isArray(value.datasets)) return null;

  const city = parseCityDefinition(value.city);
  if (city === null) return null;

  const datasets: CityPack["datasets"] = [];
  const seenIds = new Set<string>();
  for (const entry of value.datasets) {
    const definition = parseDatasetDefinition(entry);
    if (definition === null || seenIds.has(definition.id)) return null;
    seenIds.add(definition.id);
    datasets.push(definition);
  }

  return { city, datasets };
}

/**
 * Flatten a pack into runtime datasets tagged with their provenance. Shipped
 * packs produce presets (build-time cached); packs loaded from a URL produce
 * "imported" datasets, which always load live and need CORS.
 */
export function datasetsFromPack(
  pack: CityPack,
  source: Dataset["source"] = "preset",
): Dataset[] {
  return pack.datasets.map((definition) => ({
    ...definition,
    source,
    cityId: pack.city.id,
  }));
}

function parseCenter(value: unknown): CityDefinition["center"] | null {
  if (!Array.isArray(value) || value.length !== 2) return null;
  const [lon, lat] = value;
  return isValidLon(lon) && isValidLat(lat) ? [lon, lat] : null;
}
