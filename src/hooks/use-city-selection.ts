import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  datasetsForCity,
  findCity,
  persistCityId,
  readRequestedCityId,
  readStoredCityId,
  resolveInitialCity,
} from "../city-selection";
import type { CityDefinition, Dataset } from "../types";

export interface CitySelection {
  selectedCity: CityDefinition | undefined;
  /** Datasets belonging to the selected city, plus city-less custom ones. */
  cityDatasets: Dataset[];
  selectCity: (cityId: string) => void;
}

/**
 * Owns which city the app is showing. The comparison engine stays city-blind;
 * this only narrows the dataset list and supplies the initial map view.
 */
export function useCitySelection(
  datasets: readonly Dataset[],
  cities: readonly CityDefinition[],
): CitySelection {
  const [selectedCity, setSelectedCity] = useState<CityDefinition | undefined>(() =>
    resolveInitialCity(cities),
  );

  // The city asked for, by link, by last visit, or by picking one. Cities can
  // arrive after mount — a `?pack=` link is fetched in the background — so the
  // request outlives the first resolution attempt until it can be honoured.
  const requestedCityIdRef = useRef(readRequestedCityId() ?? readStoredCityId());
  const knownCityIdsRef = useRef(new Set(cities.map((city) => city.id)));

  const selectCity = useCallback(
    (cityId: string) => {
      const city = findCity(cities, cityId);
      if (!city) return;
      requestedCityIdRef.current = city.id;
      persistCityId(city.id);
      setSelectedCity(city);
    },
    [cities],
  );

  useEffect(() => {
    const newCities = cities.filter((city) => !knownCityIdsRef.current.has(city.id));
    for (const city of cities) knownCityIdsRef.current.add(city.id);

    // The selected city can disappear when its pack is removed.
    if (selectedCity && !cities.some((city) => city.id === selectedCity.id)) {
      setSelectedCity(resolveInitialCity(cities, null, null));
      return;
    }

    const requested = findCity(cities, requestedCityIdRef.current);
    if (requested) {
      if (requested.id !== selectedCity?.id) setSelectedCity(requested);
      return;
    }
    // Nothing specific was asked for, so a city that just arrived is the one
    // the user opened the app to see — a bare `?pack=` link.
    if (newCities.length > 0) setSelectedCity(newCities[0]);
  }, [cities, selectedCity]);

  const cityDatasets = useMemo(
    () => datasetsForCity(datasets, selectedCity?.id),
    [datasets, selectedCity],
  );

  return { selectedCity, cityDatasets, selectCity };
}
