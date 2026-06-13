import { type KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import { filterAndSortDatasets } from "../datasets";
import { useI18n } from "../hooks/use-i18n";
import type { Dataset } from "../types";

interface DatasetListProps {
  datasets: Dataset[];
  searchQuery: string;
  selectedDatasetId: string | undefined;
  onSelectDataset: (datasetId: string) => void;
}

export function DatasetList({
  datasets,
  searchQuery,
  selectedDatasetId,
  onSelectDataset,
}: DatasetListProps) {
  const { t, language } = useI18n();
  const listRef = useRef<HTMLDivElement>(null);
  const baseId = useId();
  const visibleDatasets = useMemo(
    () => filterAndSortDatasets(datasets, searchQuery, language),
    [datasets, searchQuery, language],
  );

  // Roving-tabindex cursor. Tracks the focusable option by index so Up/Down,
  // Home/End move through the listbox without changing the actual selection.
  const [activeIndex, setActiveIndex] = useState(0);

  // Keep the cursor on the selected dataset (or in range) as the list changes.
  useEffect(() => {
    const selectedIndex = visibleDatasets.findIndex(
      (dataset) => dataset.id === selectedDatasetId,
    );
    if (selectedIndex >= 0) {
      setActiveIndex(selectedIndex);
      return;
    }
    setActiveIndex((index) =>
      visibleDatasets.length === 0 ? 0 : Math.min(index, visibleDatasets.length - 1),
    );
  }, [visibleDatasets, selectedDatasetId]);

  function optionId(index: number): string {
    return `${baseId}-option-${index}`;
  }

  function focusOption(index: number) {
    setActiveIndex(index);
    const option = listRef.current?.querySelector<HTMLElement>(
      `#${CSS.escape(optionId(index))}`,
    );
    option?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const count = visibleDatasets.length;
    if (count === 0) return;
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        focusOption((activeIndex + 1) % count);
        break;
      case "ArrowUp":
        event.preventDefault();
        focusOption((activeIndex - 1 + count) % count);
        break;
      case "Home":
        event.preventDefault();
        focusOption(0);
        break;
      case "End":
        event.preventDefault();
        focusOption(count - 1);
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        onSelectDataset(visibleDatasets[activeIndex].id);
        break;
      default:
        break;
    }
  }

  return (
    <div
      id="datasetList"
      ref={listRef}
      className="dataset-list"
      role="listbox"
      aria-label={t("dataset.selectAria")}
      data-empty-label={t("dataset.empty")}
      onKeyDown={handleKeyDown}
    >
      {visibleDatasets.map((dataset, index) => {
        const selected = dataset.id === selectedDatasetId;
        const isCustom = dataset.source === "custom";
        return (
          <button
            key={dataset.id}
            id={optionId(index)}
            type="button"
            className={selected ? "dataset-item selected" : "dataset-item"}
            role="option"
            aria-selected={selected}
            tabIndex={index === activeIndex ? 0 : -1}
            onClick={() => {
              setActiveIndex(index);
              onSelectDataset(dataset.id);
            }}
          >
            <span className="dataset-item__label">{dataset.label}</span>
            {isCustom && (
              <span className="kern-badge kern-badge--info dataset-badge">
                {t("dataset.customBadge")}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
