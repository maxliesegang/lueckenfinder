import type { OsmSelector } from "./osm-selector";
import type { DatasetDefinition } from "./types";

export const CUSTOM_DATASET_ATTRIBUTION = "lueckenfinder:generated-custom-attribution";

export interface CustomDatasetDefinitionInput {
  geojsonUrl: string;
  label: string;
  sourceUrl?: string;
  /** Declarative criteria. Mutually exclusive with `overpassQuery`. */
  osmSelector?: OsmSelector;
  /** Raw Overpass QL. Mutually exclusive with `osmSelector`. */
  overpassQuery?: string;
  /** Optional relaxed criteria, in whichever form the strict side uses. */
  broadSelector?: OsmSelector;
  broadMatchQuery?: string;
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
    attribution: CUSTOM_DATASET_ATTRIBUTION,
    ...(input.osmSelector ? { osmSelector: input.osmSelector } : {}),
    ...(input.overpassQuery ? { overpassQuery: input.overpassQuery.trim() } : {}),
    ...(input.broadSelector ? { broadSelector: input.broadSelector } : {}),
    ...(input.broadMatchQuery ? { broadMatchQuery: input.broadMatchQuery.trim() } : {}),
    ...(input.sourceUrl?.trim() ? { sourceUrl: input.sourceUrl.trim() } : {}),
  };
}
