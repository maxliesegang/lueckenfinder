import { RESULT_BUCKET_LIST, type ResultBucketId } from "./result-buckets";
import type { ConflationResult } from "./types";

export function summaryItems(
  result: ConflationResult,
  visibility: Readonly<Record<ResultBucketId, boolean>>,
) {
  return RESULT_BUCKET_LIST.map((bucket) => ({
    ...bucket,
    count: result[bucket.id].length,
    visible: visibility[bucket.id],
  }));
}
