import assert from "node:assert/strict";
import test from "node:test";
import {
  type ComparisonStage,
  compareDataset,
  createComparisonResponseCache,
} from "../src/comparison";
import type { OfficialData } from "../src/official";
import type { Dataset, DatasetPoint } from "../src/types";

const dataset: Dataset = {
  id: "test",
  label: "Test",
  source: "custom",
  geojsonUrl: "https://example.com/data.geojson",
  overpassQuery: 'node["amenity"="bench"]({{bbox}});',
  broadMatchQuery: 'node["amenity"]({{bbox}});',
  attribution: "Test data",
  tagMapping: { fixed: { amenity: "bench" } },
};

const official: DatasetPoint = { lon: 8, lat: 49, props: {} };

function officialData(points: DatasetPoint[]): OfficialData {
  return { points, truncation: null };
}

function pointNorth(meters: number, props: Record<string, unknown> = {}): DatasetPoint {
  const earthRadiusM = 6_371_008.8;
  return {
    lon: official.lon,
    lat: official.lat + ((meters / earthRadiusM) * 180) / Math.PI,
    props,
    osmRef: "node/1",
  };
}

test("compareDataset reports stages and a non-fatal broad-query warning", async () => {
  const stages: ComparisonStage["type"][] = [];
  const outcome = await compareDataset(dataset, 30, {
    onStage: (stage) => stages.push(stage.type),
    dependencies: {
      loadOfficial: async () => officialData([official]),
      runOverpass: async (query) => {
        if (query === dataset.broadMatchQuery) throw new Error("unavailable");
        return [];
      },
    },
  });

  assert.deepEqual(stages, ["official", "osm", "broad-match", "conflate"]);
  assert.equal(outcome.result.missingInOsm.length, 1);
  assert.equal(outcome.warnings.length, 1);
});

test("compareDataset accepts match-radius boundaries", async () => {
  for (const matchRadiusM of [1, 2_000]) {
    const outcome = await compareDataset(dataset, matchRadiusM, {
      dependencies: {
        loadOfficial: async () => officialData([official]),
        runOverpass: async () => [],
      },
    });
    assert.equal(outcome.result.missingInOsm.length, 1);
  }
});

test("compareDataset reuses cached requests when only the match radius changes", async () => {
  const cache = createComparisonResponseCache();
  const strictOnlyDataset = { ...dataset, broadMatchQuery: undefined };
  const osm = pointNorth(80, { amenity: "bench" });
  let officialRequests = 0;
  let osmRequests = 0;
  const dependencies = {
    loadOfficial: async () => {
      officialRequests += 1;
      return officialData([official]);
    },
    runOverpass: async () => {
      osmRequests += 1;
      return [osm];
    },
  };

  const narrow = await compareDataset(strictOnlyDataset, 30, {
    cache,
    dependencies,
  });
  const wide = await compareDataset(strictOnlyDataset, 100, {
    cache,
    dependencies,
  });

  assert.equal(officialRequests, 1);
  assert.equal(osmRequests, 1);
  assert.equal(narrow.result.missingInOsm.length, 1);
  assert.equal(narrow.result.matched.length, 0);
  assert.equal(wide.result.missingInOsm.length, 0);
  assert.equal(wide.result.matched.length, 1);
});

test("two datasets asking OSM the same question share one Overpass request", async () => {
  const cache = createComparisonResponseCache();
  const queries: string[] = [];
  const dependencies = {
    // Slightly different extents, as two exports of the same city would have.
    loadOfficial: async (asked: Dataset) =>
      officialData([
        asked.id === "glass" ? official : { ...official, lat: official.lat + 0.001 },
      ]),
    runOverpass: async (query: string) => {
      queries.push(query);
      return [];
    },
  };

  const glass: Dataset = {
    ...dataset,
    id: "glass",
    overpassQuery: undefined,
    broadMatchQuery: undefined,
    osmSelector: {
      tags: { amenity: "recycling", "recycling:glass": "yes" },
    },
    broadSelector: { tags: { amenity: "recycling" } },
  };
  const batteries: Dataset = {
    ...glass,
    id: "batteries",
    geojsonUrl: "https://example.com/batteries.geojson",
    osmSelector: {
      tags: { amenity: "recycling", "recycling:batteries": "yes" },
    },
  };

  await compareDataset(glass, 30, { cache, dependencies });
  assert.equal(queries.length, 1);

  // A different strict half, so this one still has to be fetched…
  await compareDataset(batteries, 30, { cache, dependencies });
  assert.equal(queries.length, 2);

  // …but re-running either dataset now costs nothing.
  await compareDataset(glass, 30, { cache, dependencies });
  await compareDataset(batteries, 30, { cache, dependencies });
  assert.equal(queries.length, 2);
});

test("an identical relaxed query is fetched once across datasets", async () => {
  const cache = createComparisonResponseCache();
  const queries: string[] = [];
  const dependencies = {
    loadOfficial: async () => officialData([official]),
    runOverpass: async (query: string) => {
      queries.push(query);
      return [];
    },
  };

  // Raw QL keeps the two-request path, so the shared relaxed query is its own
  // request — exactly the one that should be reused.
  const first: Dataset = { ...dataset, id: "first" };
  const second: Dataset = {
    ...dataset,
    id: "second",
    overpassQuery: 'node["amenity"="waste_basket"]({{bbox}});',
  };

  await compareDataset(first, 30, { cache, dependencies });
  await compareDataset(second, 30, { cache, dependencies });

  assert.deepEqual(queries, [
    dataset.overpassQuery,
    dataset.broadMatchQuery,
    second.overpassQuery,
  ]);
});

test("compareDataset rejects invalid radii before loading data", async () => {
  for (const matchRadiusM of [0, 2_001]) {
    let loaded = false;
    await assert.rejects(
      compareDataset(dataset, matchRadiusM, {
        dependencies: {
          loadOfficial: async () => {
            loaded = true;
            return officialData([official]);
          },
          runOverpass: async () => [],
        },
      }),
      /between 1 and 2,000/,
    );
    assert.equal(loaded, false);
  }
});

test("compareDataset forwards cancellation to data loading", async () => {
  const controller = new AbortController();
  const pending = compareDataset(dataset, 30, {
    signal: controller.signal,
    dependencies: {
      loadOfficial: async (_dataset, options) =>
        new Promise((_resolve, reject) => {
          options?.signal?.addEventListener("abort", () => {
            reject(options.signal?.reason);
          });
        }),
      runOverpass: async () => [],
    },
  });

  controller.abort(new Error("cancelled"));
  await assert.rejects(pending, /cancelled/);
});

const selectorDataset: Dataset = {
  id: "test-selector",
  label: "Test",
  source: "custom",
  geojsonUrl: "https://example.com/data.geojson",
  osmSelector: { tags: { amenity: "bench" } },
  broadSelector: { tags: { amenity: "seat" } },
  attribution: "Test data",
};

/** A second official record far enough away to conflate independently. */
const officialFar: DatasetPoint = { lon: 8.01, lat: 49, props: {} };

function northOf(
  point: DatasetPoint,
  meters: number,
  props: Record<string, unknown>,
  osmRef: string,
): DatasetPoint {
  const earthRadiusM = 6_371_008.8;
  return {
    lon: point.lon,
    lat: point.lat + ((meters / earthRadiusM) * 180) / Math.PI,
    props,
    osmRef,
  };
}

test("selector datasets query Overpass once and classify the result locally", async () => {
  const queries: string[] = [];
  const stages: ComparisonStage["type"][] = [];
  const strict = northOf(official, 10, { amenity: "bench" }, "node/1");
  const broad = northOf(officialFar, 10, { amenity: "seat" }, "node/2");

  const outcome = await compareDataset(selectorDataset, 30, {
    onStage: (stage) => stages.push(stage.type),
    dependencies: {
      loadOfficial: async () => officialData([official, officialFar]),
      runOverpass: async (query) => {
        queries.push(query);
        return [strict, broad];
      },
    },
  });

  // One request covered both selectors, and no broad-match stage was reported.
  assert.equal(queries.length, 1);
  assert.deepEqual(stages, ["official", "osm", "conflate"]);
  assert.equal(outcome.result.matched.length, 1);
  assert.equal(outcome.result.needsTagging.length, 1);
  assert.equal(outcome.result.missingInOsm.length, 0);
  assert.equal(outcome.result.onlyInOsm.length, 0);
});

test("splitting one response still reports unmatched strict objects as OSM-only", async () => {
  // Inside the official extent, but further than the match radius from anything.
  const stray = northOf(officialFar, 60, { amenity: "bench" }, "node/9");

  const outcome = await compareDataset(selectorDataset, 30, {
    dependencies: {
      loadOfficial: async () => officialData([official, officialFar]),
      runOverpass: async () => [stray],
    },
  });

  assert.equal(outcome.result.missingInOsm.length, 2);
  assert.equal(outcome.result.onlyInOsm.length, 1);
});

test("a truncated official response warns instead of failing", async () => {
  const outcome = await compareDataset(dataset, 30, {
    dependencies: {
      loadOfficial: async () => ({
        points: [official],
        truncation: { returned: 1000, matched: 5000 },
      }),
      runOverpass: async () => [],
    },
  });

  assert.equal(outcome.officialCount, 1);
  assert.equal(outcome.warnings.length, 1);
  assert.match(outcome.warnings[0], /only part of its data/);
});
