import { useCallback, useState } from "react";
import {
  allDatasets,
  removeCustomDataset as deleteStoredCustomDataset,
  addCustomDataset as storeCustomDataset,
} from "../datasets";
import type { Dataset, DatasetDefinition } from "../types";

export interface DatasetCatalog {
  datasets: Dataset[];
  addCustomDataset: (definition: DatasetDefinition) => Dataset;
  removeCustomDataset: (datasetId: string) => void;
}

/**
 * Reactive view over presets, stored custom datasets, and any shared dataset in
 * the URL hash. Mutations write through `datasets.ts` and refresh the snapshot.
 */
export function useDatasets(): DatasetCatalog {
  const [datasets, setDatasets] = useState<Dataset[]>(allDatasets);

  const addCustomDataset = useCallback((definition: DatasetDefinition) => {
    const savedDataset = storeCustomDataset(definition);
    setDatasets(allDatasets());
    return savedDataset;
  }, []);

  const removeCustomDataset = useCallback((datasetId: string) => {
    deleteStoredCustomDataset(datasetId);
    setDatasets(allDatasets());
  }, []);

  return { datasets, addCustomDataset, removeCustomDataset };
}
