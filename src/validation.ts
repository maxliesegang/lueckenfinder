export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** A non-negative, finite, whole number. */
export function isPositiveInteger(value: unknown): value is number {
  return isFiniteNumber(value) && Number.isInteger(value) && value >= 0;
}

export function isValidLon(value: unknown): value is number {
  return isFiniteNumber(value) && Math.abs(value) <= 180;
}

export function isValidLat(value: unknown): value is number {
  return isFiniteNumber(value) && Math.abs(value) <= 90;
}

/** Identifiers used in URLs, storage keys, and cache file names. */
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export function safeId(value: unknown): string | null {
  const id = nonEmptyString(value);
  return id !== null && SAFE_ID.test(id) ? id : null;
}

export function nonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function httpUrl(value: unknown): string | null {
  const text = nonEmptyString(value);
  if (text === null) return null;
  try {
    const url = new URL(text);
    return url.protocol === "http:" || url.protocol === "https:" ? text : null;
  } catch {
    return null;
  }
}
