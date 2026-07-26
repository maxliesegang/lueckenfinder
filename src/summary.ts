import type { TranslationKey } from "./i18n";
import { RESULT_BUCKET_LIST, type ResultBucketId } from "./result-buckets";
import type { ConflationResult } from "./types";

/**
 * Legend rows for a result. `exhaustive` describes the official source: when it
 * is not a complete list, the `onlyInOsm` row says so instead of asking for a
 * review it cannot justify.
 */
export function summaryItems(
  result: ConflationResult,
  visibility: Readonly<Record<ResultBucketId, boolean>>,
  exhaustive = true,
) {
  return RESULT_BUCKET_LIST.map((bucket) => {
    const actionKey: TranslationKey =
      bucket.id === "onlyInOsm" && !exhaustive
        ? "bucket.onlyInOsm.partialAction"
        : bucket.actionKey;
    return {
      ...bucket,
      actionKey,
      count: result[bucket.id].length,
      visible: visibility[bucket.id],
    };
  });
}
