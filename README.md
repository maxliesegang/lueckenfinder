# Lückenfinder

Find gaps between official open city data and OpenStreetMap, then fix them
**manually** for better data quality. The app compares an official GeoJSON
dataset (e.g. from the Transparenzportal Karlsruhe) against the matching
OpenStreetMap objects (via an Overpass query) and splits the result into four
buckets:

- **Missing in OSM** — official record with no OSM object nearby → go survey and add it.
- **Needs tags** — a nearby OSM object exists but is missing expected tags.
- **Matched** — present in both; the app flags attribute gaps on the OSM object.
- **Only in OSM** — OSM object with no official match → review (may be valid, may be stale).

Nothing is edited automatically and nothing is marked "done". The app only
produces suggestions; a human verifies and edits OSM.

## Tech stack

- **Vite + TypeScript** — static build, deploys to GitHub Pages.
- **React 19** — UI shell (`src/app.tsx`), mounted from `src/main.tsx`.
- **Kern UX** (`@kern-ux/native` + `@kern-ux-annex/kern-react-kit`) — design system.
- **MapLibre GL JS** — map rendering.
- **Flatbush** — spatial index for fast nearest-neighbour matching.
- No backend. The only persisted state is your **custom dataset mappings**
  (in `localStorage`), or a shareable URL hash.
- **English and German UI** — selected automatically from the browser language
  and changeable from the app header.

## Run locally

```bash
nvm use
npm ci
npm run fetch:presets   # caches preset official data into public/presets-data/
npm run dev
```

The project targets Node.js 24 or newer. Run `npm run check` for the same
typecheck, test, and production-build verification used on pull requests.

Code quality is handled by Biome:

```bash
npm run quality       # lint, formatting, and import-order checks
npm run quality:fix   # apply safe fixes
npm run format        # format all supported project files
```

`npm run build` produces a static `dist/`. The included GitHub Action builds,
caches preset data, and deploys to Pages on push and weekly.

## Cities

The app shows one city at a time, picked in the control panel. The choice is
remembered and reflected in the URL (`?city=karlsruhe`), so a link can open the
app on a specific city. Selecting a city sets the initial map view and narrows
the dataset list; your own custom datasets stay visible in every city.

Nothing in the comparison engine is city-aware — Overpass bounding boxes still
come from each dataset's own official data extent.

## Setting it up for your own city

You do not need to fork this repo. A **city pack** is a single JSON file — one
city plus its datasets — and there are three ways to use one, in increasing
order of effort:

1. **Import it in the app.** Host the JSON anywhere CORS-enabled and paste its
   URL into *Add source → Import a city*, or open
   `?pack=https://example.org/my-city.json` to load it for one visit and be
   offered the chance to keep it. Nothing is forked, built, or reviewed.
2. **Open a pull request** against [`presets/`](presets/) so your city ships
   with the app. This is what a source needs when its server refuses direct
   browser requests: shipped packs get their data cached at build time and
   loaded same-origin.
3. **Fork and self-host** only if you want your own branding or domain — the
   engine itself is city-agnostic and needs no code changes.

See [`presets/README.md`](presets/README.md) for the pack format and the
licence checks expected of any source.

## Adding datasets

Two tiers:

- **Presets** are shipped **city packs** in [`presets/`](presets/) — one JSON
  file per city, read-only in the app. Karlsruhe is the pack this project
  started with; any city can be added the same way. Add or change one via a
  **pull request**; see [`presets/README.md`](presets/README.md) for the format.
  A shipped pack also gets its official data cached at build time, which is how
  sources without CORS headers stay usable.
- **Custom** mappings are added in the app (label + GeoJSON URL + optional
  source URL + Overpass query). They are saved to `localStorage`, or you can "Copy
  share link" to share a mapping via URL without saving anything.

Each mapping pairs a `geojsonUrl` with an `overpassQuery`. Use the `{{bbox}}`
token in the query; it is replaced with the official data's extent at run time.

Optional official properties can be checked against OSM with `tagMapping`.
Use a property name directly, or an extraction rule when the value is embedded
in a larger string. A `constant` emits a fixed tag value whenever its source
property is present and non-empty:

```ts
tagMapping: {
  fixed: { amenity: "bicycle_parking" },
  fromProps: {
    capacity: "number_of_spaces",
    covered: {
      property: "description",
      extract: "Covered: ([^;]+)",
      values: { ja: "yes", nein: "no" },
    },
    bike_ride: {
      property: "public_transport_stop",
      constant: "yes",
    },
  },
}
```

`extract` uses its first regular-expression capture group. Missing, empty,
non-scalar, non-matching, and unlisted `values` are ignored. `constant` and
`values` are mutually exclusive. A resolved property tag overrides a fixed tag
with the same key. Known values that differ from OSM appear in the **Tag
differences** result bucket.

> **CORS note:** preset data is cached same-origin at build time, so it always
> loads. Custom GeoJSON URLs are fetched live in the browser and only work if
> the remote server sends CORS headers — many open-data portals do not.

## Licensing — read before mapping

The app **displaying** CC-BY data only needs attribution (handled per dataset).

**Copying** that data into OpenStreetMap is different. OSM is published under
the ODbL, and all CC-BY versions (including 4.0) need an explicit waiver from
the licensor before their data may be incorporated — manual editing does not
remove this requirement. The OSMF provides a ready-made CC-BY 4.0 cover-letter
and waiver template. For the Karlsruhe datasets:

1. Check the OSM wiki Contributors / German import pages — the source may
   already be cleared.
2. If not, send the city the OSMF CC-BY 4.0 waiver request and record the reply
   on the wiki.
3. Coordinate with the German OSM community before doing this systematically.

Framing suggestions as "go verify on the ground and map what you see" (rather
than "copy these coordinates") keeps individual edits on much firmer footing.

## Project layout

```
src/
  main.tsx               entry point: mounts the React app
  app.tsx                React UI shell and app controller (Kern UX)
  components/            React components
  hooks/                 React state and lifecycle hooks
  dom.ts                 required DOM lookup helper
  comparison.ts          comparison workflow and progress reporting
  conflate.ts            result-bucket policy
  matching.ts            one-to-one spatial assignment engine
  tag-matching.ts        tag-mapping evaluation and diffing
  dataset-definition.ts  validation for stored/shared definitions
  city-pack.ts           validation for city packs (city + datasets)
  city-selection.ts      selected city, ?city= URL, per-city dataset view
  pack-fetch.ts          fetching and size-capping remote city packs
  packs.ts               imported pack storage and the merged catalog
  dataset-codec.ts       share-link encode/decode
  constraints.ts         dataset and city-pack payload limits
  custom-dataset.ts      custom dataset definition helpers
  datasets.ts            custom storage + share links + merged registry
  editors.ts             tag-mapping editors
  geo.ts                 geographic helpers
  official.ts            validated GeoJSON loading
  overpass.ts            cancellable Overpass client
  validation.ts          shared runtime type guards for external data
  result-buckets.ts      shared bucket metadata
  summary.ts             result summary rendering
  popups.ts              map popup content
  map.ts, map-layers.ts  MapLibre state and layer rendering
  i18n.ts                English/German strings
  presets.ts             shipped city packs, validated at load
presets/
  <city>.json            one shipped city pack per file
scripts/
  fetch-presets.ts       validated build-time preset cache
tests/
  *.test.ts              Node test runner regression suite
```

## Notes

- The dev map uses raw OSM raster tiles. For production, switch `RASTER_STYLE`
  in `src/map.ts` to a proper vector tile provider to respect the OSM tile
  usage policy.
- JOSM deep links require JOSM running with Remote Control enabled.

## License

The application source code is available under the [MIT License](LICENSE).
Dataset and OpenStreetMap content remain subject to their respective licenses;
see [Licensing — read before mapping](#licensing--read-before-mapping).
