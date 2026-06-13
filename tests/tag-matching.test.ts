import assert from "node:assert/strict";
import { test } from "node:test";
import { PRESETS } from "../src/presets";
import { expectedTags, findTagGaps } from "../src/tag-matching";
import type { Dataset, DatasetPoint } from "../src/types";

function point(props: Record<string, unknown> = {}): DatasetPoint {
  return { lon: 0, lat: 0, props };
}

function datasetWithTagMapping(tagMapping: Dataset["tagMapping"]): Dataset {
  return {
    id: "test",
    label: "Test",
    source: "custom",
    geojsonUrl: "",
    overpassQuery: "",
    attribution: "",
    tagMapping,
  };
}

const fixedPresetTags: Record<string, Record<string, string>> = {
  "ka-glass-containers": {
    amenity: "recycling",
    recycling_type: "container",
    "recycling:glass_bottles": "yes",
  },
  "ka-battery-containers": {
    amenity: "recycling",
    recycling_type: "container",
    "recycling:batteries": "yes",
  },
  "ka-green-waste-containers": {
    amenity: "recycling",
    recycling_type: "container",
    "recycling:green_waste": "yes",
  },
  "ka-textile-containers": {
    amenity: "recycling",
    recycling_type: "container",
    "recycling:clothes": "yes",
  },
  "ka-public-toilets": { amenity: "toilets" },
  "ka-disabled-parking-spaces": {
    amenity: "parking_space",
    parking_space: "disabled",
  },
  "ka-table-tennis-tables": {
    leisure: "pitch",
    sport: "table_tennis",
  },
  "ka-drinking-water": { amenity: "drinking_water" },
  "ka-playgrounds": { leisure: "playground" },
};

for (const [presetId, tags] of Object.entries(fixedPresetTags)) {
  test(`${presetId} resolves its fixed tags`, () => {
    const preset = PRESETS.find(({ id }) => id === presetId);
    assert.ok(preset);
    assert.deepEqual(expectedTags(point(), preset), tags);
  });
}

test("bicycle parking resolves conditional property tags", () => {
  const preset = PRESETS.find(({ id }) => id === "ka-bicycle-parking");
  assert.ok(preset);

  assert.deepEqual(
    expectedTags(
      point({
        art: "Fahrradstation",
        bike_and_ride: "Hauptbahnhof Karlsruhe",
        stellplaetze: 600,
        lastenrad: "T",
      }),
      preset,
    ),
    {
      amenity: "bicycle_parking",
      capacity: "600",
      covered: "yes",
      bicycle_parking: "building",
      bike_ride: "yes",
      cargo_bike: "yes",
    },
  );

  assert.deepEqual(
    expectedTags(
      point({
        art: "Fahrradabstellanlage",
        bike_and_ride: null,
        stellplaetze: null,
        lastenrad: "F",
      }),
      preset,
    ),
    {
      amenity: "bicycle_parking",
      covered: "no",
    },
  );
});

test("car parks resolve capacity when available", () => {
  const preset = PRESETS.find(({ id }) => id === "ka-car-parks");
  assert.ok(preset);

  assert.deepEqual(expectedTags(point({ gesamte_parkplaetze: 612 }), preset), {
    amenity: "parking",
    capacity: "612",
  });
  assert.deepEqual(expectedTags(point({ gesamte_parkplaetze: null }), preset), {
    amenity: "parking",
  });
});

test("property mappings resolve direct, extracted, translated, and constant values", () => {
  const tagMapping = datasetWithTagMapping({
    fromProps: {
      count: "count",
      active: "active",
      extracted: { property: "details", extract: "Count: (\\d+)" },
      translated: {
        property: "details",
        extract: "Covered: ([^;]+)",
        values: { ja: "yes", nein: "no" },
      },
      constant: { property: "station", constant: "yes" },
    },
  });

  assert.deepEqual(
    expectedTags(
      point({
        count: 0,
        active: false,
        details: "Count: 20; Covered: ja",
        station: "Central",
      }),
      tagMapping,
    ),
    {
      count: "0",
      active: "false",
      extracted: "20",
      translated: "yes",
      constant: "yes",
    },
  );
});

test("property mappings ignore unusable and unmapped values", () => {
  const tagMapping = datasetWithTagMapping({
    fromProps: {
      blank: "blank",
      object: "object",
      array: "array",
      infinite: "infinite",
      noMatch: { property: "details", extract: "Count: (\\d+)" },
      inherited: { property: "inherited", values: { known: "yes" } },
    },
  });

  assert.deepEqual(
    expectedTags(
      point({
        blank: " ",
        object: { value: "unsafe" },
        array: ["unsafe"],
        infinite: Number.POSITIVE_INFINITY,
        details: "Count: unknown",
        inherited: "toString",
      }),
      tagMapping,
    ),
    {},
  );
});

test("resolved property tags override fixed tags with the same key", () => {
  const tagMapping = datasetWithTagMapping({
    fixed: { covered: "unknown" },
    fromProps: {
      covered: { property: "covered", values: { ja: "yes" } },
    },
  });

  assert.deepEqual(expectedTags(point({ covered: "ja" }), tagMapping), {
    covered: "yes",
  });
  assert.deepEqual(expectedTags(point({ covered: "unmapped" }), tagMapping), {
    covered: "unknown",
  });
});

test("tag gaps use exact string equality and ignore extra OSM tags", () => {
  const tagMapping = datasetWithTagMapping({
    fixed: { amenity: "bench", covered: "yes", capacity: "10" },
  });

  assert.deepEqual(
    findTagGaps(
      point(),
      point({
        amenity: "bench",
        covered: "Yes",
        capacity: 10,
        extra: "ignored",
      }),
      tagMapping,
    ),
    [
      { key: "covered", expected: "yes", osmValue: "Yes" },
      { key: "capacity", expected: "10", osmValue: undefined },
    ],
  );
});
