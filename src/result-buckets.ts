import type { TranslationKey } from "./i18n";
import type { ConflationResult, DatasetDefinition } from "./types";

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
    nameKey: "bucket.needsTagging.name",
    actionKey: "bucket.needsTagging.action",
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
    nameKey: "bucket.onlyInOsm.name",
    actionKey: "bucket.onlyInOsm.action",
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

/**
 * Whether a dataset's official export claims to list every object of its kind.
 * Sources are exhaustive unless they say otherwise, so this is the one place
 * that default is spelled out.
 */
export function isExhaustiveSource(
  dataset: Pick<DatasetDefinition, "exhaustive"> | undefined,
): boolean {
  return dataset?.exhaustive !== false;
}

/**
 * Which buckets a fresh comparison shows. `onlyInOsm` starts hidden for a
 * source that is not a complete list: those objects are expected rather than
 * findings, and drawing hundreds of them over the city buries the buckets that
 * do need attention.
 */
export function initialResultBucketVisibility(
  dataset: Pick<DatasetDefinition, "exhaustive"> | undefined,
): ResultBucketVisibility {
  const visibility = createResultBucketVisibility();
  visibility.onlyInOsm = isExhaustiveSource(dataset);
  return visibility;
}

export function isResultBucketId(id: string): id is ResultBucketId {
  return Object.hasOwn(RESULT_BUCKETS, id);
}
