import { datasetsFromPack, parseCityPack } from "./city-pack";
import { MAX_IMPORTED_PACKS } from "./constraints";
import {
  PACK_CITY_RESERVED,
  PACK_DATASET_RESERVED,
  PACK_LIMIT_REACHED,
} from "./pack-errors";
import { PRESET_CITIES, PRESET_CITY_IDS, PRESET_DATASET_IDS } from "./presets";
import type { CityDefinition, CityPack, Dataset } from "./types";
import { isRecord, safeId } from "./validation";

const STORAGE_KEY = "lueckenfinder:packs";
const PAYLOAD_VERSION = 1;
const URL_PARAM = "pack";

interface PackStoragePayload {
  version: typeof PAYLOAD_VERSION;
  packs: CityPack[];
}

// ---- Imported packs (persisted) -------------------------------------------

/**
 * Packs the user imported, in import order. Anything that no longer validates
 * — a format change, a hand-edited value, a pack whose city has since shipped
 * — is dropped rather than surfaced half-broken.
 */
export function loadImportedPacks(): CityPack[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return [];
  }
  if (!raw) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!isRecord(parsed) || parsed.version !== PAYLOAD_VERSION) return [];
  if (!Array.isArray(parsed.packs)) return [];

  const byCityId = new Map<string, CityPack>();
  for (const entry of parsed.packs) {
    const pack = parseCityPack(entry);
    if (!pack || packImportConflict(pack) !== null) continue;
    byCityId.set(pack.city.id, pack);
  }
  return [...byCityId.values()].slice(0, MAX_IMPORTED_PACKS);
}

/**
 * Store a pack, replacing any previous import of the same city so re-importing
 * a URL is how a pack is updated.
 */
export function saveImportedPack(pack: CityPack): CityPack[] {
  const conflict = packImportConflict(pack);
  if (conflict !== null) throw new Error(conflict);

  const existing = loadImportedPacks().filter(
    (entry) => entry.city.id !== pack.city.id,
  );
  if (existing.length >= MAX_IMPORTED_PACKS) throw new Error(PACK_LIMIT_REACHED);

  const packs = [...existing, pack];
  writeImportedPacks(packs);
  return packs;
}

export function removeImportedPack(cityId: string): CityPack[] {
  const packs = loadImportedPacks().filter((pack) => pack.city.id !== cityId);
  writeImportedPacks(packs);
  return packs;
}

/**
 * Why a pack cannot be imported, or null when it can. Shipped ids win: a pack
 * must not be able to shadow curated data the user believes is reviewed.
 */
export function packImportConflict(pack: CityPack): string | null {
  if (PRESET_CITY_IDS.has(pack.city.id)) return PACK_CITY_RESERVED;
  if (pack.datasets.some((dataset) => PRESET_DATASET_IDS.has(dataset.id))) {
    return PACK_DATASET_RESERVED;
  }
  return null;
}

function writeImportedPacks(packs: readonly CityPack[]): void {
  const payload: PackStoragePayload = { version: PAYLOAD_VERSION, packs: [...packs] };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Import persistence is optional; the session copy still works.
  }
}

// ---- Pack URLs -------------------------------------------------------------

/** The `?pack=` URL to load for this session, if any. */
export function readRequestedPackUrl(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const value = new URL(window.location.href).searchParams.get(URL_PARAM);
    return value !== null && value.trim().length > 0 ? value.trim() : null;
  } catch {
    return null;
  }
}

export function packShareUrl(packUrl: string, cityId: string): string {
  const url = new URL(window.location.href);
  url.searchParams.set(URL_PARAM, packUrl);
  const city = safeId(cityId);
  if (city !== null) url.searchParams.set("city", city);
  return url.toString();
}

// ---- Library surface -------------------------------------------------------

/**
 * Everything the UI needs to show and manage non-shipped cities.
 * `usePackLibrary` implements it over storage; `App` wraps that implementation
 * with status reporting, so the dialog below takes one prop instead of six.
 */
export interface PackLibrary {
  /** Imported packs first, then any unsaved pack from a `?pack=` link. */
  activePacks: readonly CityPack[];
  importedPacks: readonly CityPack[];
  /** Loaded from `?pack=` and not yet saved, so it can be offered for keeping. */
  sessionPack: CityPack | undefined;
  importing: boolean;
  /** Resolves once the pack is stored; rejects with a user-facing error. */
  importPack: (url: string) => Promise<CityPack>;
  keepSessionPack: () => void;
  removePack: (cityId: string) => void;
}

// ---- Combined catalog ------------------------------------------------------

export interface Catalog {
  cities: CityDefinition[];
  datasets: Dataset[];
}

/**
 * Merge shipped presets with imported and session packs. Later packs never
 * displace earlier cities, so a session `?pack=` for an already-imported city
 * is ignored rather than quietly overriding what the user saved.
 */
export function buildCatalog(
  baseDatasets: readonly Dataset[],
  packs: readonly CityPack[],
): Catalog {
  const cities = [...PRESET_CITIES];
  const datasets = [...baseDatasets];
  const seenCityIds = new Set(cities.map((city) => city.id));

  for (const pack of packs) {
    if (seenCityIds.has(pack.city.id)) continue;
    seenCityIds.add(pack.city.id);
    cities.push(pack.city);
    datasets.push(...datasetsFromPack(pack, "imported"));
  }

  return { cities, datasets };
}
