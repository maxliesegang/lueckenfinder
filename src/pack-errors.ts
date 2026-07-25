/**
 * User-facing failure messages for city packs. They live in one dependency-free
 * module so `i18n.ts` can key its translation table off the same constants the
 * throwing code uses — a renamed message then cannot silently fall back to
 * untranslated English.
 */
export const PACK_INVALID = "Invalid city pack.";
export const PACK_TOO_LARGE = "City pack is too large.";
export const PACK_URL_INVALID = "City pack URL must be http(s).";
export const PACK_EMPTY = "City pack contains no datasets.";
export const PACK_CITY_RESERVED = "That city is already shipped with the app.";
export const PACK_DATASET_RESERVED = "That pack reuses a shipped dataset ID.";
export const PACK_LIMIT_REACHED = "Too many imported cities.";

/** Thrown for a non-2xx pack response; the status is translated separately. */
export function packRequestFailed(status: number): string {
  return `City pack request failed with ${status}.`;
}
