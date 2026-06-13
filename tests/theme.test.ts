import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";

import {
  applyThemePreference,
  getThemePreference,
  parseThemePreference,
  resolveThemePreference,
  saveThemePreference,
} from "../src/theme";

const storage = new Map<string, string>();
const storageKey = "lueckenfinder:theme";

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
});

afterEach(() => {
  Reflect.deleteProperty(globalThis, "localStorage");
});

test("theme preference defaults to system and ignores invalid storage", () => {
  assert.equal(getThemePreference(), "system");
  storage.set(storageKey, "neon");
  assert.equal(getThemePreference(), "system");
  assert.equal(parseThemePreference("dark"), "dark");
  assert.equal(parseThemePreference("neon"), "system");
});

test("theme preference persists explicit choices and clears system choice", () => {
  saveThemePreference("dark");
  assert.equal(storage.get(storageKey), "dark");
  assert.equal(getThemePreference(), "dark");

  saveThemePreference("system");
  assert.equal(storage.has(storageKey), false);
  assert.equal(getThemePreference(), "system");
});

test("system theme resolves against the current color scheme", () => {
  assert.equal(resolveThemePreference("system", false), "light");
  assert.equal(resolveThemePreference("system", true), "dark");
  assert.equal(resolveThemePreference("light", true), "light");
});

test("applying a theme sets the Kern theme attribute", () => {
  const root: { dataset: { kernTheme?: string }; style: { colorScheme: string } } = {
    dataset: {},
    style: { colorScheme: "" },
  };

  assert.equal(applyThemePreference("dark", root), "dark");
  assert.equal(root.dataset.kernTheme, "dark");
  assert.equal(root.style.colorScheme, "dark");

  assert.equal(applyThemePreference("light", root), "light");
  assert.equal(root.dataset.kernTheme, "light");
  assert.equal(root.style.colorScheme, "light");
});
