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
