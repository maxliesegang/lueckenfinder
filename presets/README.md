# City packs

A **city pack** is one JSON file describing a place and the official datasets
curated for it. Packs are the unit of contribution: this directory holds the
packs shipped with the app, and the same file format can be hosted elsewhere.

## Adding a city

1. Create `presets/<city-id>.json` using the format below. The file name must
   match the `city.id` inside it.
2. Register it in [`src/presets.ts`](../src/presets.ts) — one `import` plus one
   entry in `RAW_PACKS`. A test fails if you forget.
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
      "topic": "drinking-water",  // the OSM criteria, shared with other cities
      "label": "Trinkwasserbrunnen Karlsruhe",
      "geojsonUrl": "https://…/query?…&f=geojson",
      "exhaustive": false,          // optional; see below. Defaults to true
      "attribution": "Datenquelle: Geoportal Stadt Karlsruhe",
      "sourceUrl": "https://geoportal.karlsruhe.de/"
    }
  ]
}
```

Dataset fields are the same ones the in-app "Add source" form writes; see the
[main README](../README.md#saying-what-an-osm-object-should-look-like) for the
full `osmSelector` and `tagMapping` semantics. Five rules matter most:

- **Prefer a `topic`.** `topics.json` holds the OSM criteria for each kind of
  thing — a drinking fountain is tagged the same in every city — so a dataset
  usually only has to say which topic it is and where its data comes from. See
  [Topics](#topics) below.
- State the strict OSM criteria **exactly once**: from a `topic`, or from
  `osmSelector` (preferred), or from raw `overpassQuery`. A selector generates
  the query *and* the expected tags, so the two cannot drift apart; only repeat
  a tag in `tagMapping.fixed` when you expect something you do not query for.
- Pairing `osmSelector` with `broadSelector` costs no extra Overpass request —
  both are fetched in one call and split locally. Prefer them over
  `overpassQuery`/`broadMatchQuery`, which need two.
- Raw `overpassQuery` **must** contain `{{bbox}}` and must be union statements
  only — no `[out:…]` header, no `out` statement; the app adds both. `{{bbox}}`
  is replaced at run time with the extent of that dataset's official data, so
  nothing here is hard-coded to a city's coordinates.
- Dataset `id`s must be unique across every pack: they are the app's runtime
  identity for a dataset, in share links and in the check that stops an import
  from shadowing a preset. Prefix them with a city abbreviation. (Cache files
  are filed per city, so only this rule constrains the name.)

## Is the source a complete list?

Before adding a dataset, ask what an OSM query for the same topic returns that
the official export does not. A city's toilet list covers the toilets the city
runs; OSM also has the ones in the shopping centre. A city's bike-parking list
covers its own racks; OSM also has the bike shop's.

Where the two populations differ, say so with `"exhaustive": false`. Matching is
unaffected — an official record still has to be found in OSM or be reported
missing. What changes is the reading of the leftovers: those extra OSM objects
are what should be there, so the app stops presenting them as findings and hides
their markers by default. Left unsaid, a city-scale dataset can bury the buckets
that matter under hundreds of correct objects, and people learn to ignore the
whole panel.

Prefer fixing this in the selector where the tags actually distinguish the two
populations — `exhaustive: false` is for when they do not. Note that narrowing a
selector has its own cost: an object excluded by the strict criteria and carrying
no *missing* tag cannot be rescued by the relaxed criteria either, so it is
reported as missing from OSM although it is right there. That is why `car-park`
still queries all of `amenity=parking`, why `playground` and `table-tennis` do
not exclude `access` even though OSM holds plenty of private playgrounds and
school tables, and why the Karlsruhe lists behind all three are marked
non-exhaustive instead.

## Topics

A **topic** is a named bundle of OSM criteria in
[`presets/topics.json`](topics.json): an `osmSelector`, optionally a
`broadSelector`, and any `tagMapping` that holds regardless of city.

```jsonc
"drinking-water": {
  "osmSelector": { "tags": { "amenity": "drinking_water" } },
  "broadSelector": { "tags": { "drinking_water": "yes" } }
}
```

Naming a topic leaves each dataset holding only what is genuinely local — the
URL, the label, the attribution, and any `tagMapping.fromProps` naming columns
that only that city's export has. Improving a selector then improves every city
that uses it, instead of one copy of five.

A dataset may still state anything itself, and what it states wins:

- `osmSelector` or `overpassQuery` replaces the topic's **whole** strict slot,
  never half of it; likewise `broadSelector`/`broadMatchQuery` for the relaxed
  slot. So overriding a selector never leaves you accidentally stating the
  strict criteria twice.
- `tagMapping` merges key by key over the topic's, which is where a city's
  `fromProps` belongs.

To add a topic, add an entry to `topics.json`; ids follow the same character
rules as dataset ids. Datasets in **imported** packs may reference shipped
topics but cannot define their own — criteria arriving from an untrusted URL
would widen what a remote pack can put into an Overpass query.

Check that `geojsonUrl` returns the **whole** dataset. Portals commonly cap a
response at 1000 or 2000 records; `npm run fetch:presets` fails the dataset when
it detects a cap, and tells you which paging parameters to add.

Check what else the column you filter on holds. Portals often split one kind of
thing into a plain group and an accessible variant — Karlsruhe publishes
`Spielplätze` and `Spielplätze (mit rollstuhlgerechtem Zugang)` as separate
groups. Filtering with `=` silently drops the variant; a `LIKE '%…%'` filter
keeps both, and a `tagMapping.fromProps` rule reading the same column turns the
distinction into `wheelchair=yes` rather than discarding it:

```jsonc
"wheelchair": {
  "property": "gruppenname_de",
  "values": { "Spielplätze (mit rollstuhlgerechtem Zugang)": "yes" }
}
```

Groups left out of `values` resolve to no tag, so the plain group correctly says
nothing about access.

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
`public/presets-data/<city>/<id>.geojson`), which is the only way to use the many
open-data portals that do not allow direct browser access. If a source loads
fine in the browser, you never need this repo at all.

## Refreshing cached data

```sh
npm run fetch:presets                  # every shipped city
npm run fetch:presets -- --city=karlsruhe   # just one, leaving other portals alone
```

A full run also reports cache files that no longer belong to any dataset.
