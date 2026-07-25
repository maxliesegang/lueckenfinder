import assert from "node:assert/strict";
import test from "node:test";
import { formatNumber, setLanguage, t, translateMessage } from "../src/i18n";
import * as packErrors from "../src/pack-errors";

test("translations interpolate variables in English and German", () => {
  setLanguage("en");
  assert.equal(
    t("status.queryingOsm", { count: 12 }),
    "Querying OpenStreetMap (12 official points)…",
  );

  setLanguage("de");
  assert.equal(
    t("status.queryingOsm", { count: 12 }),
    "OpenStreetMap wird abgefragt (12 amtliche Objekte)…",
  );
});

test("numbers and known domain messages follow the selected language", () => {
  setLanguage("de");
  assert.equal(formatNumber(1234.5), "1.234,5");
  assert.equal(
    translateMessage("Official dataset has no valid points."),
    "Der amtliche Datensatz enthält keine gültigen Punkte.",
  );
  assert.equal(
    translateMessage("Overpass returned 429 Too Many Requests"),
    "Overpass hat den Status 429 Too Many Requests zurückgegeben.",
  );
  assert.equal(
    translateMessage("Invalid GeoJSON geometry at feature 3"),
    "Die amtlichen GeoJSON-Daten sind ungültig.",
  );

  setLanguage("en");
});

test("every pack failure message has a translation", () => {
  setLanguage("de");
  const messages = Object.values<unknown>(packErrors).filter(
    (value) => typeof value === "string",
  );
  assert.ok(messages.length > 0);
  for (const message of messages) {
    assert.notEqual(
      translateMessage(message),
      message,
      `untranslated pack message: ${message}`,
    );
  }
  assert.equal(
    translateMessage(packErrors.packRequestFailed(503)),
    "Das Stadtpaket konnte nicht geladen werden (503).",
  );

  setLanguage("en");
});
