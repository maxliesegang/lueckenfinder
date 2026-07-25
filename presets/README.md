# City packs

A **city pack** is one JSON file describing a place and the official datasets
curated for it. Packs are the unit of contribution: this directory holds the
packs shipped with the app, and the same file format can be hosted elsewhere.

## Adding a city

1. Create `presets/<city-id>.json` using the format below.
2. Register it in [`src/presets.ts`](../src/presets.ts) — one `import` plus one
   entry in `RAW_PACKS`.
3. Run `npm run fetch:presets` to cache the official data, then `npm run check`.

The shipped packs are validated on every test run, so a malformed pack fails CI
rather than the browser.

## Format

```jsonc
{
  "city": {
    "id": "karlsruhe",            // [A-Za-z0-9][A-Za-z0-9._-]*, unique
    "name": "Karlsruhe",          // shown in the UI
    "center": [8.4037, 49.0069],  // [lon, lat], initial map view
    "zoom": 12,                   // 0–24
    "country": "DE",              // optional, ISO 3166-1 alpha-2
    "sourceUrl": "https://transparenz.karlsruhe.de/" // optional portal link
  },
  "datasets": [
    {
      "id": "ka-drinking-water",  // unique across ALL packs; prefix with the city
      "label": "Trinkwasserbrunnen Karlsruhe",
      "geojsonUrl": "https://…/query?…&f=geojson",
      "overpassQuery": "nwr[\"amenity\"=\"drinking_water\"]({{bbox}});",
      "attribution": "Datenquelle: Geoportal Stadt Karlsruhe",
      "sourceUrl": "https://geoportal.karlsruhe.de/",
      "broadMatchQuery": "nwr[\"drinking_water\"=\"yes\"]({{bbox}});",
      "tagMapping": { "fixed": { "amenity": "drinking_water" } }
    }
  ]
}
```

Dataset fields are the same ones the in-app "Add source" form writes; see the
[main README](../README.md#adding-datasets) for `tagMapping` semantics. Two
rules matter most:

- `overpassQuery` **must** contain `{{bbox}}`. It is replaced at run time with
  the extent of that dataset's official data, so nothing here is hard-coded to a
  city's coordinates.
- Dataset `id`s must be unique across every pack, because they name the cached
  file in `public/presets-data/`. Prefix them with a city abbreviation.

A pack is rejected as a whole if any dataset in it is invalid — a partly loaded
city would silently hide datasets the author believes are published.

## Licence check before you open a PR

Confirm the source's terms allow this use, put the required credit in
`attribution`, and confirm compatibility before anyone uses the data for OSM
edits. The app only ever suggests places to go and verify; it never implies
official data may be copied into OSM.

## When you do not need a PR

**Host the same JSON file yourself.** Put it anywhere your browser can reach
with CORS enabled — a gist, an S3 bucket, your city's own open-data portal —
then either paste its URL into **Add source → Import a city** in the app, or
send someone a link with `?pack=`:

```
https://<app-url>/?pack=https://example.org/my-city.json
```

A `?pack=` link loads the city for that visit without saving anything; the app
offers to keep it. Imported cities live in `localStorage`, appear in the city
picker beside the shipped ones, and are removed as a unit from the same dialog.

Two limits apply to imported packs, both from `src/constraints.ts`:
512 KB per pack and 100 datasets per pack. An imported pack may not reuse a
shipped city id or dataset id, so it can never shadow reviewed data.

Shipping a pack in this repo instead exists mainly to give a source
**build-time caching** (`scripts/fetch-presets.ts` writes each `geojsonUrl` to
`public/presets-data/<id>.geojson`), which is the only way to use the many
open-data portals that do not allow direct browser access. If a source loads
fine in the browser, you never need this repo at all.

## Refreshing cached data

```sh
npm run fetch:presets                  # every shipped city
npm run fetch:presets -- --city=karlsruhe   # just one, leaving other portals alone
```

A full run also reports cache files that no longer belong to any dataset.
