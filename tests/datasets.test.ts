import assert from "node:assert/strict";
import test from "node:test";

import {
  decodeBase64Url,
  decodeSharePayload,
  decodeStoragePayload,
  encodeBase64Url,
  encodeSharePayload,
  encodeStoragePayload,
} from "../src/dataset-codec";
import { addCustomDataset, allDatasets } from "../src/datasets";
import type { Dataset, DatasetDefinition } from "../src/types";

const definition: DatasetDefinition = {
  id: "custom-test",
  label: "Test dataset",
  geojsonUrl: "https://example.com/data.geojson",
  overpassQuery: 'node["amenity"="bench"]({{bbox}});',
  attribution: "Example",
  sourceUrl: "https://example.com/source",
};

test("storage payloads support legacy arrays, validation, and last-value deduplication", () => {
  const decoded = decodeStoragePayload(
    JSON.stringify([
      definition,
      { ...definition, id: "second" },
      { ...definition, label: "Updated dataset" },
      { ...definition, id: "invalid", geojsonUrl: "javascript:alert(1)" },
    ]),
  );

  assert.deepEqual(
    decoded.map(({ id, label }) => ({ id, label })),
    [
      { id: "custom-test", label: "Updated dataset" },
      { id: "second", label: "Test dataset" },
    ],
  );
  assert.deepEqual(decodeStoragePayload("{broken"), []);
  assert.deepEqual(
    decodeStoragePayload(JSON.stringify({ version: 2, datasets: [definition] })),
    [],
  );
});

test("storage payload encoding is versioned and omits runtime provenance", () => {
  const dataset: Dataset = { ...definition, source: "custom" };
  const payload = JSON.parse(encodeStoragePayload([dataset]));

  assert.equal(payload.version, 1);
  assert.deepEqual(payload.datasets, [definition]);
});

test("share payloads are versioned, Unicode-safe, and legacy compatible", () => {
  const unicodeDefinition = { ...definition, label: "Öffentliche Plätze" };
  const encoded = encodeSharePayload(unicodeDefinition);

  assert.deepEqual(decodeSharePayload(encoded), unicodeDefinition);
  assert.deepEqual(JSON.parse(decodeBase64Url(encoded)), {
    version: 1,
    dataset: unicodeDefinition,
  });
  assert.deepEqual(
    decodeSharePayload(encodeBase64Url(JSON.stringify(unicodeDefinition))),
    unicodeDefinition,
  );
  assert.equal(
    decodeSharePayload(
      encodeBase64Url(JSON.stringify({ version: 2, dataset: unicodeDefinition })),
    ),
    null,
  );
  assert.equal(decodeSharePayload("not valid base64"), null);
});

test("base64url helpers round-trip UTF-8 without padding or standard alphabet", () => {
  const value = "Karlsruhe: äöü / + ?";
  const encoded = encodeBase64Url(value);

  assert.doesNotMatch(encoded, /[+/=]/);
  assert.equal(decodeBase64Url(encoded), value);
});

test("browser persistence ignores read failures and propagates write failures", () => {
  const writeFailure = new Error("storage unavailable");
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { location: { href: "https://app.example/", hash: "" } },
  });
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: () => {
        throw new Error("read blocked");
      },
      setItem: () => {
        throw writeFailure;
      },
    },
  });

  try {
    assert.ok(allDatasets().every((dataset) => dataset.source === "preset"));
    assert.throws(() => addCustomDataset(definition), writeFailure);
  } finally {
    Reflect.deleteProperty(globalThis, "localStorage");
    Reflect.deleteProperty(globalThis, "window");
  }
});

test("a stored custom dataset takes precedence over the same shared ID", () => {
  const stored = { ...definition, label: "Stored dataset", source: "custom" } as const;
  const shared = { ...definition, label: "Shared dataset" };
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: () => encodeStoragePayload([stored]),
      setItem: () => undefined,
    },
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      location: {
        href: "https://app.example/",
        hash: `#d=${encodeSharePayload(shared)}`,
      },
    },
  });

  try {
    const matches = allDatasets().filter((dataset) => dataset.id === definition.id);
    assert.equal(matches.length, 1);
    assert.equal(matches[0].label, "Stored dataset");
  } finally {
    Reflect.deleteProperty(globalThis, "localStorage");
    Reflect.deleteProperty(globalThis, "window");
  }
});
