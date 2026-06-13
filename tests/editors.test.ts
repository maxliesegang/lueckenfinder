import assert from "node:assert/strict";
import test from "node:test";
import { idEditLink } from "../src/editors";
import type { DatasetPoint } from "../src/types";

function point(osmRef?: string): DatasetPoint {
  return {
    lat: 49.0069,
    lon: 8.4037,
    props: {},
    osmRef,
  };
}

test("idEditLink centers on points without an OSM reference", () => {
  assert.equal(
    idEditLink(point()),
    "https://www.openstreetmap.org/edit?editor=id#map=20/49.0069/8.4037",
  );
});

test("idEditLink selects an existing OSM object", () => {
  assert.equal(
    idEditLink(point("node/12345")),
    "https://www.openstreetmap.org/edit?editor=id&node=12345#map=20/49.0069/8.4037",
  );
  assert.equal(
    idEditLink(point("way/67890")),
    "https://www.openstreetmap.org/edit?editor=id&way=67890#map=20/49.0069/8.4037",
  );
  assert.equal(
    idEditLink(point("relation/42")),
    "https://www.openstreetmap.org/edit?editor=id&relation=42#map=20/49.0069/8.4037",
  );
});

test("idEditLink ignores malformed OSM references", () => {
  assert.equal(
    idEditLink(point("node/not-an-id")),
    "https://www.openstreetmap.org/edit?editor=id#map=20/49.0069/8.4037",
  );
});
