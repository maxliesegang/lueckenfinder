import type { TranslationKey } from "./i18n";
import type { ConflationResult } from "./types";

export const RESULT_BUCKET_IDS = [
  "missingInOsm",
  "needsTagging",
  "matched",
  "onlyInOsm",
] as const satisfies readonly (keyof ConflationResult)[];

export type ResultBucketId = (typeof RESULT_BUCKET_IDS)[number];
export type ResultBucketVisibility = Record<ResultBucketId, boolean>;

interface ResultBucketMetadata<Id extends ResultBucketId> {
  id: Id;
  color: `#${string}`;
  nameKey: TranslationKey;
  actionKey: TranslationKey;
}

export const RESULT_BUCKETS = {
  missingInOsm: {
    id: "missingInOsm",
    color: "#e4572e",
    nameKey: "bucket.missing.name",
    actionKey: "bucket.missing.action",
  },
  needsTagging: {
    id: "needsTagging",
    color: "#f59e0b",
    nameKey: "bucket.tagDifferences.name",
    actionKey: "bucket.tagDifferences.action",
  },
  matched: {
    id: "matched",
    color: "#3d9970",
    nameKey: "bucket.matched.name",
    actionKey: "bucket.matched.action",
  },
  onlyInOsm: {
    id: "onlyInOsm",
    color: "#386fa4",
    nameKey: "bucket.osmOnly.name",
    actionKey: "bucket.osmOnly.action",
  },
} as const satisfies {
  [Id in keyof ConflationResult]: ResultBucketMetadata<Id>;
};

export const RESULT_BUCKET_LIST = RESULT_BUCKET_IDS.map((id) => RESULT_BUCKETS[id]);

export function createResultBucketVisibility(visible = true): ResultBucketVisibility {
  return Object.fromEntries(
    RESULT_BUCKET_IDS.map((id) => [id, visible]),
  ) as ResultBucketVisibility;
}

export function isResultBucketId(id: string): id is ResultBucketId {
  return Object.hasOwn(RESULT_BUCKETS, id);
}
