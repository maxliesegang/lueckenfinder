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
- `src/presets.ts` contains curated, read-only dataset definitions.
- `scripts/fetch-presets.ts` validates and caches preset GeoJSON for production builds. Treat `public/presets-data/` as generated output.
- `src/dataset-definition.ts` owns validation for stored and shared dataset definitions; `src/validation.ts` holds the shared runtime type guards used to validate external data (GeoJSON, Overpass, storage).
- `src/comparison.ts`, `src/matching.ts`, and `src/conflate.ts` contain the main comparison and result-classification logic.
- `src/map.ts` and `src/map-layers.ts` own MapLibre rendering and layer state.

## Dataset Rules

- Keep stored and shared dataset payloads backward compatible unless a migration is intentionally included.
- Validate data at external boundaries: GeoJSON responses, Overpass responses, storage, and URL payloads.
- Overpass queries must contain `{{bbox}}`; it is replaced with the official dataset extent at runtime.
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
