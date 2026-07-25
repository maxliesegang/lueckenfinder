import type { CityDefinition, Dataset } from "./types";
import { safeId } from "./validation";

const STORAGE_KEY = "lueckenfinder:city";
const URL_PARAM = "city";

/**
 * Resolve which city to start on: an explicit `?city=` wins over the last
 * choice, and an unknown id falls back to the first available city rather than
 * leaving the app with nothing selected.
 */
export function resolveInitialCity(
  cities: readonly CityDefinition[],
  requestedCityId = readRequestedCityId(),
  storedCityId = readStoredCityId(),
): CityDefinition | undefined {
  return (
    findCity(cities, requestedCityId) ??
    findCity(cities, storedCityId) ??
    cities[0] ??
    undefined
  );
}

export function findCity(
  cities: readonly CityDefinition[],
  cityId: string | null,
): CityDefinition | undefined {
  if (cityId === null) return undefined;
  return cities.find((city) => city.id === cityId);
}

export function readRequestedCityId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return safeId(new URL(window.location.href).searchParams.get(URL_PARAM));
  } catch {
    return null;
  }
}

export function readStoredCityId(): string | null {
  if (typeof localStorage === "undefined") return null;
  try {
    return safeId(localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

/** Remember the choice and reflect it in the URL so the view can be shared. */
export function persistCityId(cityId: string): void {
  try {
    localStorage?.setItem(STORAGE_KEY, cityId);
  } catch {
    // City persistence is optional.
  }
  if (typeof window === "undefined" || !window.history?.replaceState) return;
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.get(URL_PARAM) === cityId) return;
    url.searchParams.set(URL_PARAM, cityId);
    window.history.replaceState(null, "", url.toString());
  } catch {
    // A non-navigable URL is not worth failing the selection over.
  }
}

/**
 * Datasets to show for a city. Custom datasets carry no city, so they stay
 * visible everywhere — the user added them deliberately and would otherwise
 * have to guess which city hides them.
 */
export function datasetsForCity(
  datasets: readonly Dataset[],
  cityId: string | undefined,
): Dataset[] {
  return datasets.filter(
    (dataset) => dataset.cityId === undefined || dataset.cityId === cityId,
  );
}
