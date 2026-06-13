import { useCallback, useEffect, useMemo, useState } from "react";
import { DEFAULT_MATCH_RADIUS_M } from "../dataset-constraints";
import type { Dataset } from "../types";

export interface DatasetSelection {
  selectedDataset: Dataset | undefined;
  selectedDatasetId: string | undefined;
  matchRadius: number;
  setMatchRadius: (matchRadius: number) => void;
  selectDataset: (datasetId: string) => void;
  selectDatasetEntry: (dataset: Dataset) => void;
  selectFirstAvailableDataset: (excludedDatasetId?: string) => void;
}

/**
 * Keeps the selected dataset in sync with the currently available catalog and
 * owns the app-level match radius. Changing selection resets dependent UI, but
 * it does not change the user's chosen radius.
 */
export function useDatasetSelection(
  datasets: readonly Dataset[],
  resetSelectionState: () => void,
): DatasetSelection {
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | undefined>(
    () => datasets[0]?.id,
  );
  const [matchRadius, setMatchRadius] = useState<number>(DEFAULT_MATCH_RADIUS_M);

  const selectedDataset = useMemo(
    () => datasets.find((dataset) => dataset.id === selectedDatasetId),
    [datasets, selectedDatasetId],
  );

  const applySelection = useCallback(
    (dataset: Dataset | undefined) => {
      resetSelectionState();
      setSelectedDatasetId(dataset?.id);
    },
    [resetSelectionState],
  );

  const selectDataset = useCallback(
    (datasetId: string) => {
      applySelection(datasets.find((dataset) => dataset.id === datasetId));
    },
    [applySelection, datasets],
  );

  const selectFirstAvailableDataset = useCallback(
    (excludedDatasetId?: string) => {
      applySelection(datasets.find((dataset) => dataset.id !== excludedDatasetId));
    },
    [applySelection, datasets],
  );

  useEffect(() => {
    if (selectedDatasetId !== undefined && selectedDataset === undefined) {
      selectFirstAvailableDataset();
    }
  }, [selectFirstAvailableDataset, selectedDataset, selectedDatasetId]);

  return {
    selectedDataset,
    selectedDatasetId,
    matchRadius,
    setMatchRadius,
    selectDataset,
    selectDatasetEntry: applySelection,
    selectFirstAvailableDataset,
  };
}
