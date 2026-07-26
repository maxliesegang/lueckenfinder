# Repository Guidelines

- Use Node.js 24 or newer and npm.
- Install dependencies with `npm ci` when starting from a clean checkout.
- This is a static Vite/TypeScript browser app with a React 19 UI shell (Kern UX design system). It has no backend; custom datasets are stored in `localStorage` or URL hashes.
- Follow the existing TypeScript style and keep changes narrowly scoped.
- Use Biome for formatting and linting. Run `npm run quality:fix` when automatic fixes are appropriate.
- Add or update tests when behavior changes.

## Project Layout

- `src/` contains application code. The entry point is `main.tsx`, which mounts the React app (`app.tsx`). Keep domain logic in focused modules rather than in UI wiring.
- `tests/*.test.ts` contains regression tests using Node's test runner through `tsx`. Prefer a test near the module or behavior being changed.
- `presets/<city>.json` holds curated, read-only **city packs** (a city descriptor plus its dataset definitions); `src/presets.ts` imports and validates them. See `presets/README.md` for the format.
- `src/city-pack.ts` owns validation for city definitions and packs, reusing `src/dataset-definition.ts` per dataset. `src/pack-fetch.ts` fetches and size-caps remote packs; `src/packs.ts` stores imported packs, merges the catalog, and defines the `PackLibrary` surface the UI consumes as a single prop.
- `src/pack-errors.ts` holds every user-facing pack failure message; `src/errors.ts` does the same for all other translated failure messages. Throw those constants rather than literals — `src/i18n.ts` keys its translation table off them, so a literal would surface untranslated.
- `scripts/preset-cache.ts` holds the pure selection helpers for the cache script so they stay testable.
- `scripts/fetch-presets.ts` validates and caches preset GeoJSON for production builds. Treat `public/presets-data/` as generated output.
- `src/dataset-definition.ts` owns validation for stored and shared dataset definitions; `src/validation.ts` holds the shared runtime type guards used to validate external data (GeoJSON, Overpass, storage).
- `src/osm-selector.ts` owns declarative OSM criteria: one selector generates the Overpass query, the predicate that classifies results, and the expected tags. Keep those three derived from the same selector — that is what stops a query and its expectations from drifting. `src/dataset-query.ts` turns a definition into the request(s) to issue; a selector-based dataset fetches strict and relaxed candidates in one call.
- `src/dataset-criteria.ts` owns the OSM side of a dataset (selectors, raw queries, tag mapping) and how a topic's criteria merge with a dataset's own. `src/topics.ts` loads `presets/topics.json`, the shipped catalog of reusable criteria that city packs reference by `topic`. Topics are resolved at parse time, so stored and shared payloads stay fully expanded and topic-unaware.
- `src/comparison.ts`, `src/matching.ts`, and `src/conflate.ts` contain the main comparison and result-classification logic. The comparison cache keys official data per dataset but Overpass responses by request — resolved query plus grid-snapped extent — so datasets asking OSM the same question of the same city share one response.
- `src/map.ts` and `src/map-layers.ts` own MapLibre rendering and layer state.

## Dataset Rules

- Keep stored and shared dataset payloads backward compatible unless a migration is intentionally included.
- Validate data at external boundaries: GeoJSON responses, Overpass responses, storage, and URL payloads.
- Prefer a shipped `topic` for city-pack datasets, then `osmSelector`/`broadSelector`, and raw `overpassQuery`/`broadMatchQuery` last. A dataset must state its strict criteria exactly once; a dataset's own criteria replace a topic's whole strict or relaxed slot rather than merging into it.
- Use `anyValue` rather than `tags` for keys OSM writes as semicolon lists (`sport`, `cuisine`, …), or objects tagged with several values will be reported as missing.
- List every value an `exclude` is meant to rule out (`access: ["private", "no", "permit"]`); a single value silently lets its synonyms through.
- Mark a dataset `"exhaustive": false` when its official export is not the full population an OSM query returns. It only changes how `onlyInOsm` is presented, never matching. Narrowing a selector instead can misfire: an object the strict criteria exclude but that lacks no expected tag is rescued by neither pass and is reported missing.
- Raw Overpass queries must contain `{{bbox}}` and carry union statements only — no settings header, no `out` statement. `{{bbox}}` is replaced with the official dataset extent at runtime. Keep the comparison engine city-agnostic — a city supplies the initial map view and grouping only.
- Treat a capped official response as a data error, not a partial success: `src/official.ts` detects it and the comparison warns, while `scripts/fetch-presets.ts` fails the dataset.
- Dataset IDs must be unique across all city packs: they are a dataset's runtime identity in storage, share links, and the preset-shadowing check. Build-time cache files live under `public/presets-data/<city>/<dataset>.geojson`.
- Imported packs must never shadow a shipped city ID or dataset ID, and remote pack payloads stay bounded by the limits in `src/constraints.ts`.
- Preset data is cached at build time, while custom GeoJSON URLs are fetched directly by the browser and require CORS support.
- The app only suggests possible OpenStreetMap changes. Do not add automatic OSM editing or imply that official data may be copied without license review.

## Required Checks

Before reporting a code change as complete, run:

```sh
npm run verify
```

This runs TypeScript checks, Biome formatting/lint/import checks, and the full test suite. Fix all formatter output, warnings, and import-order findings.

For changes that can affect bundling, dependencies, Vite configuration, entry points, static assets, or production output, run the same command used by pull-request CI:

```sh
npm run check
```

`npm run check` includes `npm run verify` and a production build. Do not report completion while a required check is failing. If a check cannot be run, state that explicitly.
