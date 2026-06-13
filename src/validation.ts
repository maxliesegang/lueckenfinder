export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function isValidLon(value: unknown): value is number {
  return isFiniteNumber(value) && Math.abs(value) <= 180;
}

export function isValidLat(value: unknown): value is number {
  return isFiniteNumber(value) && Math.abs(value) <= 90;
}
