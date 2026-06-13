import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { setLanguage } from "../src/i18n";
import { matchedPopup, missingPopup, reviewPopup } from "../src/popups";
import type { Dataset, DatasetPoint, PointMatch } from "../src/types";

const dataset: Dataset = {
  id: "test",
  label: "Test dataset",
  source: "custom",
  geojsonUrl: "https://example.test/data.geojson",
  overpassQuery: 'node["amenity"="toilets"]({{bbox}});',
  attribution: "Test source",
  tagMapping: {
    fixed: { amenity: "toilets" },
  },
};

function count(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

function countOpenDetails(html: string): number {
  return html.match(/<details class="detail-card" open(?:=""|)>/g)?.length ?? 0;
}

test("missing popups prioritize readable object details", () => {
  setLanguage("en");
  const point: DatasetPoint = {
    lat: 49.0069,
    lon: 8.4037,
    props: {
      name: "Central Toilet",
      gruppenname_de: "Public toilets",
      "addr:street": "Marktplatz",
      "addr:housenumber": "1",
      "addr:postcode": "76131",
      "addr:city": "Karlsruhe",
      operator: "City of Karlsruhe",
      note: "<verify before editing>",
    },
  };

  const html = renderToStaticMarkup(missingPopup(point, dataset));

  assert.match(html, /Official record/);
  assert.match(html, /Central Toilet/);
  assert.match(html, /Address/);
  assert.match(html, /Marktplatz 1, 76131 Karlsruhe/);
  assert.match(html, /City of Karlsruhe/);
  assert.match(html, /&lt;verify before editing&gt;/);
  assert.equal(countOpenDetails(html), 1);
  assert.equal(count(html, '<details class="detail-card">'), 1);
});

test("matched popups show both official and OSM object details", () => {
  setLanguage("en");
  const pair: PointMatch = {
    official: {
      lat: 49.01,
      lon: 8.4,
      props: {
        name: "Covered bike parking",
        art: "Fahrradbox",
        stellplaetze: 24,
      },
    },
    osm: {
      lat: 49.0101,
      lon: 8.4001,
      props: {
        amenity: "bicycle_parking",
        capacity: "12",
        covered: "yes",
      },
      osmRef: "node/123",
    },
    distanceM: 8,
    attributeGaps: [{ key: "capacity", expected: "24", osmValue: "12" }],
  };

  const html = renderToStaticMarkup(matchedPopup(pair));

  assert.match(html, /Official record/);
  assert.match(html, /OSM object/);
  assert.match(html, /Covered bike parking/);
  assert.match(html, /Fahrradbox/);
  assert.match(html, /node\/123/);
  assert.match(html, /capacity/);
  assert.equal(countOpenDetails(html), 1);
  assert.equal(count(html, '<details class="detail-card">'), 1);
  assert.match(
    html,
    /<details class="detail-card" open(?:=""|)>[\s\S]*Official record/,
  );
});

test("matched popups open the selected side and collapse the counterpart", () => {
  setLanguage("en");
  const pair: PointMatch = {
    official: {
      lat: 49.01,
      lon: 8.4,
      props: { name: "Official bike parking" },
    },
    osm: {
      lat: 49.0101,
      lon: 8.4001,
      props: { amenity: "bicycle_parking" },
      osmRef: "node/123",
    },
    distanceM: 8,
    attributeGaps: [],
  };

  const html = renderToStaticMarkup(matchedPopup(pair, "osm"));

  assert.equal(countOpenDetails(html), 1);
  assert.match(html, /<details class="detail-card" open(?:=""|)>[\s\S]*OSM object/);
  assert.match(
    html,
    /<summary class="detail-heading">[\s\S]*OSM object[\s\S]*node\/123/,
  );
});

test("popup detail labels follow the selected language", () => {
  setLanguage("de");
  const html = renderToStaticMarkup(
    reviewPopup({
      lat: 49,
      lon: 8,
      props: { name: "Beispiel", wheelchair: true },
      osmRef: "way/10",
    }),
  );

  assert.match(html, /OSM-Objekt/);
  assert.match(html, /Rollstuhl/);
  assert.match(html, /ja/);
  assert.match(html, /Koordinaten/);

  setLanguage("en");
});
