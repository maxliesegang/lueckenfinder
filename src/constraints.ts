// Numeric limits shared by the loaders and the UI that reports them.

/**
 * Guards for city packs loaded from somewhere we do not control. They exist to
 * bound work and storage, not to judge content — a legitimate city pack is a
 * few kilobytes of JSON with a handful of datasets.
 */
export const MAX_PACK_BYTES = 512 * 1024;
export const MAX_PACK_DATASETS = 100;
export const MAX_IMPORTED_PACKS = 20;

/** Bounds for the spatial match radius the comparison engine accepts. */
export const MIN_MATCH_RADIUS_M = 1;
export const DEFAULT_MATCH_RADIUS_M = 100;
export const MAX_MATCH_RADIUS_M = 2_000;
export const MATCH_RADIUS_ERROR = "Match radius must be between 1 and 2,000 metres.";

export function isValidMatchRadiusM(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= MIN_MATCH_RADIUS_M &&
    value <= MAX_MATCH_RADIUS_M
  );
}
