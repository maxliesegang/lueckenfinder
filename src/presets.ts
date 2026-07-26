import karlsruhe from "../presets/karlsruhe.json";
import { datasetsFromPack, parseCityPack } from "./city-pack";
import type { CityDefinition, CityPack, Dataset } from "./types";

/**
 * Shipped, read-only city packs. To change one or add a city, open a pull
 * request against presets/<city>.json and add it to RAW_PACKS below — that is
 * the deliberate "uneditable in the app, editable via review" contribution
 * path. See presets/README.md for the pack format.
 *
 * The list is written out rather than globbed because `import.meta.glob` is a
 * Vite transform and this module is also loaded by tsx, in the tests and in
 * scripts/fetch-presets.ts. tests/presets.test.ts fails if a pack file is not
 * registered here, so the one manual step cannot be silently skipped.
 *
 * Shipping a pack here (rather than loading it from a URL at runtime) also
 * gets it build-time caching: scripts/fetch-presets.ts writes each geojsonUrl
 * to public/presets-data/<city>/<id>.geojson so the app can load it
 * same-origin, which is the only way to use sources that do not send CORS
 * headers.
 *
 * LICENCE: verify each source's terms before adding it. Display attribution
 * through the `attribution` field, and confirm OSM compatibility before using
 * source data for edits. Frame suggestions as "go verify on the ground", not
 * "copy this".
 */
const RAW_PACKS: readonly unknown[] = [karlsruhe];

export const PRESET_PACKS: readonly CityPack[] = Object.freeze(
  RAW_PACKS.map((raw, index) => {
    const pack = parseCityPack(raw);
    if (!pack) {
      throw new TypeError(`Shipped city pack at index ${index} is invalid`);
    }
    return pack;
  }),
);

export const PRESET_CITIES: readonly CityDefinition[] = Object.freeze(
  PRESET_PACKS.map((pack) => pack.city),
);

export const PRESET_DATASETS: readonly Dataset[] = Object.freeze(
  PRESET_PACKS.flatMap((pack) => datasetsFromPack(pack)),
);

/**
 * IDs the app ships with. Custom datasets and imported packs are checked
 * against these so nothing loaded at runtime can shadow curated, reviewed data.
 */
export const PRESET_CITY_IDS: ReadonlySet<string> = new Set(
  PRESET_CITIES.map((city) => city.id),
);

export const PRESET_DATASET_IDS: ReadonlySet<string> = new Set(
  PRESET_DATASETS.map((dataset) => dataset.id),
);
