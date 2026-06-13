import assert from "node:assert/strict";
import test from "node:test";
import {
  type ComparisonStage,
  compareDataset,
  createComparisonRequestCache,
} from "../src/comparison";
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
      loadOfficial: async () => [official],
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
        loadOfficial: async () => [official],
        runOverpass: async () => [],
      },
    });
    assert.equal(outcome.result.missingInOsm.length, 1);
  }
});

test("compareDataset reuses cached requests when only the match radius changes", async () => {
  const cache = createComparisonRequestCache();
  const strictOnlyDataset = { ...dataset, broadMatchQuery: undefined };
  const osm = pointNorth(80, { amenity: "bench" });
  let officialRequests = 0;
  let osmRequests = 0;
  const dependencies = {
    loadOfficial: async () => {
      officialRequests += 1;
      return [official];
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

test("compareDataset rejects invalid radii before loading data", async () => {
  for (const matchRadiusM of [0, 2_001]) {
    let loaded = false;
    await assert.rejects(
      compareDataset(dataset, matchRadiusM, {
        dependencies: {
          loadOfficial: async () => {
            loaded = true;
            return [official];
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
