import assert from "node:assert/strict";
import { test } from "node:test";
import { clearResult, renderResult } from "../src/map";
import type { ConflationResult, Dataset, DatasetPoint, PointMatch } from "../src/types";

const dataset: Dataset = {
  id: "test",
  label: "Test",
  source: "custom",
  geojsonUrl: "https://example.com/data.geojson",
  overpassQuery: 'node["amenity"="bench"]({{bbox}});',
  attribution: "Test",
  tagMapping: { fixed: { amenity: "bench" } },
};

test("a second render applies while previous GeoJSON updates are loading", () => {
  const map = new FakeMap();
  installDocument();

  renderResult(map.asMap(), result(point(8, 49)), dataset);
  assert.equal(map.sourceData("src-missingInOsm"), undefined);

  map.fire("load");
  assert.deepEqual(firstCoordinates(map.sourceData("src-missingInOsm")), [8, 49]);

  map.styleLoaded = false;
  renderResult(map.asMap(), result(point(8.1, 49.1)), dataset);

  assert.deepEqual(firstCoordinates(map.sourceData("src-missingInOsm")), [8.1, 49.1]);
});

test("clearing a result empties point and companion line sources", () => {
  const map = new FakeMap();
  map.styleLoaded = true;
  installDocument();

  renderResult(map.asMap(), populatedResult(), dataset);
  assert.equal(featureCount(map.sourceData("src-missingInOsm")), 1);
  assert.equal(featureCount(map.sourceData("src-match-lines")), 1);
  assert.equal(featureCount(map.sourceData("src-needs-tagging-lines")), 1);

  clearResult(map.asMap());

  assert.equal(featureCount(map.sourceData("src-missingInOsm")), 0);
  assert.equal(featureCount(map.sourceData("src-match-lines")), 0);
  assert.equal(featureCount(map.sourceData("src-needs-tagging-lines")), 0);
});

function point(lon: number, lat: number): DatasetPoint {
  return { lon, lat, props: {} };
}

function result(missing: DatasetPoint): ConflationResult {
  return {
    matched: [],
    missingInOsm: [missing],
    onlyInOsm: [],
    needsTagging: [],
  };
}

function populatedResult(): ConflationResult {
  return {
    matched: [match(point(8, 49), point(8.001, 49.001))],
    missingInOsm: [point(8.1, 49.1)],
    onlyInOsm: [point(8.2, 49.2)],
    needsTagging: [
      match(point(8.3, 49.3), point(8.301, 49.301), [
        { key: "amenity", expected: "bench" },
      ]),
    ],
  };
}

function match(
  official: DatasetPoint,
  osm: DatasetPoint,
  attributeGaps: PointMatch["attributeGaps"] = [],
): PointMatch {
  return { official, osm, distanceM: 1, attributeGaps };
}

function firstCoordinates(data: unknown): unknown {
  const collection = data as GeoJSON.FeatureCollection;
  return (collection.features[0]?.geometry as GeoJSON.Point | undefined)?.coordinates;
}

function featureCount(data: unknown): number {
  return (data as GeoJSON.FeatureCollection | undefined)?.features.length ?? 0;
}

function installDocument(): void {
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    },
  });
}

class FakeMap {
  styleLoaded = false;
  private readonly eventHandlers = new Map<string, Array<() => void>>();
  private readonly sources = new Map<string, FakeSource>();
  private readonly layers = new Set<string>();

  asMap(): Parameters<typeof renderResult>[0] {
    return this as unknown as Parameters<typeof renderResult>[0];
  }

  isStyleLoaded(): boolean {
    return this.styleLoaded;
  }

  once(event: string, handler: () => void): void {
    this.eventHandlers.set(event, [...(this.eventHandlers.get(event) ?? []), handler]);
  }

  on(): void {}

  fire(event: string): void {
    const handlers = this.eventHandlers.get(event) ?? [];
    this.eventHandlers.delete(event);
    for (const handler of handlers) handler();
  }

  getSource(id: string): FakeSource | undefined {
    return this.sources.get(id);
  }

  addSource(id: string): void {
    this.sources.set(id, new FakeSource());
  }

  getLayer(id: string): object | undefined {
    return this.layers.has(id) ? {} : undefined;
  }

  addLayer(layer: { id: string }): void {
    this.layers.add(layer.id);
  }

  setLayoutProperty(): void {}

  fitBounds(): void {}

  sourceData(id: string): unknown {
    return this.sources.get(id)?.data;
  }
}

class FakeSource {
  data: unknown;

  setData(data: unknown): void {
    this.data = data;
  }
}
