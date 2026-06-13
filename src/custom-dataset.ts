import type { DatasetDefinition } from "./types";

export const CUSTOM_DATASET_ATTRIBUTION = "lueckenfinder:generated-custom-attribution";

export interface CustomDatasetDefinitionInput {
  geojsonUrl: string;
  label: string;
  overpassQuery: string;
  sourceUrl?: string;
}

export function createCustomDatasetDefinition(
  input: CustomDatasetDefinitionInput,
  idSuffix = crypto.randomUUID().slice(0, 8),
): DatasetDefinition {
  const label = input.label.trim();
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return {
    id: `custom-${slug || "dataset"}-${idSuffix}`,
    label,
    geojsonUrl: input.geojsonUrl.trim(),
    overpassQuery: input.overpassQuery.trim(),
    attribution: CUSTOM_DATASET_ATTRIBUTION,
    ...(input.sourceUrl?.trim() ? { sourceUrl: input.sourceUrl.trim() } : {}),
  };
}
