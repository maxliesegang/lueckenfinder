import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchCityPack } from "../pack-fetch";
import {
  loadImportedPacks,
  type PackLibrary,
  readRequestedPackUrl,
  removeImportedPack,
  saveImportedPack,
} from "../packs";
import type { CityPack } from "../types";

/**
 * Owns city packs that did not ship with the app: those the user imported
 * (persisted) and one loaded from a `?pack=` link for this session only. A
 * link can therefore show someone a city without writing to their storage.
 */
export function usePackLibrary(
  onSessionPackError?: (error: unknown) => void,
): PackLibrary {
  const [importedPacks, setImportedPacks] = useState<CityPack[]>(loadImportedPacks);
  const [sessionPack, setSessionPack] = useState<CityPack | undefined>(undefined);
  const [importing, setImporting] = useState(false);

  // Held in a ref so a new callback identity cannot re-trigger the fetch below.
  const errorHandlerRef = useRef(onSessionPackError);
  errorHandlerRef.current = onSessionPackError;

  // A `?pack=` link loads once, in the background, and never blocks the app:
  // if it fails the user still has their own cities.
  useEffect(() => {
    const packUrl = readRequestedPackUrl();
    if (packUrl === null) return undefined;

    const controller = new AbortController();
    void (async () => {
      try {
        const pack = await fetchCityPack(packUrl, { signal: controller.signal });
        if (!controller.signal.aborted) setSessionPack(pack);
      } catch (error) {
        if (!controller.signal.aborted) errorHandlerRef.current?.(error);
      }
    })();
    return () => controller.abort();
  }, []);

  const importPack = useCallback(async (url: string) => {
    setImporting(true);
    try {
      const pack = await fetchCityPack(url);
      setImportedPacks(saveImportedPack(pack));
      setSessionPack((current) =>
        current?.city.id === pack.city.id ? undefined : current,
      );
      return pack;
    } finally {
      setImporting(false);
    }
  }, []);

  const keepSessionPack = useCallback(() => {
    if (!sessionPack) return;
    setImportedPacks(saveImportedPack(sessionPack));
    setSessionPack(undefined);
  }, [sessionPack]);

  const removePack = useCallback((cityId: string) => {
    setImportedPacks(removeImportedPack(cityId));
    setSessionPack((current) => (current?.city.id === cityId ? undefined : current));
  }, []);

  return useMemo(
    () => ({
      activePacks: sessionPack ? [...importedPacks, sessionPack] : importedPacks,
      importedPacks,
      sessionPack,
      importing,
      importPack,
      keepSessionPack,
      removePack,
    }),
    [importedPacks, sessionPack, importing, importPack, keepSessionPack, removePack],
  );
}
