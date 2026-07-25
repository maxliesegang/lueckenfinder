import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";

import {
  datasetsForCity,
  findCity,
  persistCityId,
  readRequestedCityId,
  readStoredCityId,
  resolveInitialCity,
} from "../src/city-selection";
import type { CityDefinition, Dataset } from "../src/types";

const storage = new Map<string, string>();
const storageKey = "lueckenfinder:city";

const karlsruhe: CityDefinition = {
  id: "karlsruhe",
  name: "Karlsruhe",
  center: [8.4037, 49.0069],
  zoom: 12,
};
const mannheim: CityDefinition = {
  id: "mannheim",
  name: "Mannheim",
  center: [8.4694, 49.4875],
  zoom: 12,
};
const cities = [karlsruhe, mannheim];

function dataset(id: string, cityId?: string): Dataset {
  return {
    id,
    label: id,
    geojsonUrl: "https://example.com/data.geojson",
    overpassQuery: 'node["amenity"="bench"]({{bbox}});',
    attribution: "Example",
    source: cityId === undefined ? "custom" : "preset",
    ...(cityId === undefined ? {} : { cityId }),
  };
}

function stubLocation(href: string): void {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      location: { href },
      history: {
        replaceState: (_state: unknown, _title: string, url: string) => {
          (globalThis.window as { location: { href: string } }).location.href = url;
        },
      },
    },
  });
}

beforeEach(() => {
  storage.clear();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      removeItem: (key: string) => storage.delete(key),
      setItem: (key: string, value: string) => storage.set(key, value),
    },
  });
  stubLocation("https://example.com/app/");
});

afterEach(() => {
  Reflect.deleteProperty(globalThis, "localStorage");
  Reflect.deleteProperty(globalThis, "window");
});

test("an explicit ?city= wins over the stored choice", () => {
  stubLocation("https://example.com/app/?city=mannheim");
  storage.set(storageKey, "karlsruhe");
  assert.equal(readRequestedCityId(), "mannheim");
  assert.equal(resolveInitialCity(cities), mannheim);
});

test("the stored choice is used when the URL says nothing", () => {
  storage.set(storageKey, "mannheim");
  assert.equal(readStoredCityId(), "mannheim");
  assert.equal(resolveInitialCity(cities), mannheim);
});

test("unknown or unsafe city ids fall back to the first city", () => {
  stubLocation("https://example.com/app/?city=atlantis");
  assert.equal(resolveInitialCity(cities), karlsruhe);

  stubLocation("https://example.com/app/?city=../escape");
  assert.equal(readRequestedCityId(), null);
  assert.equal(resolveInitialCity(cities), karlsruhe);

  storage.set(storageKey, "atlantis");
  assert.equal(resolveInitialCity(cities), karlsruhe);
});

test("resolving without any city yields undefined rather than throwing", () => {
  assert.equal(resolveInitialCity([]), undefined);
  assert.equal(findCity(cities, null), undefined);
});

test("persisting a city stores it and reflects it in the URL", () => {
  persistCityId("mannheim");
  assert.equal(storage.get(storageKey), "mannheim");
  assert.equal(
    (globalThis.window as { location: { href: string } }).location.href,
    "https://example.com/app/?city=mannheim",
  );
});

test("city datasets keep city-less custom entries visible", () => {
  const datasets = [
    dataset("ka-benches", "karlsruhe"),
    dataset("ma-benches", "mannheim"),
    dataset("my-source"),
  ];
  assert.deepEqual(
    datasetsForCity(datasets, "karlsruhe").map((entry) => entry.id),
    ["ka-benches", "my-source"],
  );
  assert.deepEqual(
    datasetsForCity(datasets, undefined).map((entry) => entry.id),
    ["my-source"],
  );
});
