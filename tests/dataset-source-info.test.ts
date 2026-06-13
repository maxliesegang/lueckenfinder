import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DatasetSourceInfo } from "../src/components/dataset-source-info";
import { CUSTOM_DATASET_ATTRIBUTION } from "../src/custom-dataset";
import { setLanguage } from "../src/i18n";
import type { Dataset } from "../src/types";

const dataset: Dataset = {
  id: "test",
  label: "Test dataset",
  source: "custom",
  geojsonUrl: "https://example.com/data.geojson",
  overpassQuery: "node({{bbox}});",
  attribution: CUSTOM_DATASET_ATTRIBUTION,
  sourceUrl: "https://example.com/source",
};

test("dataset source info localizes custom attribution and links to the source", () => {
  setLanguage("de");

  const html = renderToStaticMarkup(createElement(DatasetSourceInfo, { dataset }));

  assert.match(html, /Eigene Quelle/);
  assert.match(html, /href="https:\/\/example.com\/source"/);
  assert.match(html, /Datenquelle öffnen/);
});
