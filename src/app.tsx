import { useCallback, useEffect, useState } from "react";
import { ControlPanel } from "./components/map-overlay/control-panel";
import { LegendPanel } from "./components/map-overlay/legend-panel";
import { StatusToast } from "./components/map-overlay/status-toast";
import { Toolbar } from "./components/map-overlay/toolbar";
import { MapView } from "./components/map-view";
import { isValidMatchRadiusM } from "./dataset-constraints";
import { encodeShareLink } from "./datasets";
import { friendlyError } from "./error-message";
import { useComparison } from "./hooks/use-comparison";
import { useDatasetSelection } from "./hooks/use-dataset-selection";
import { useDatasets } from "./hooks/use-datasets";
import { useI18n } from "./hooks/use-i18n";
import { useStatus } from "./hooks/use-status";
import { useTheme } from "./hooks/use-theme";
import {
  createResultBucketVisibility,
  type ResultBucketId,
  type ResultBucketVisibility,
} from "./result-buckets";
import type { DatasetDefinition } from "./types";

export function App() {
  const { t, language, setLanguage } = useI18n();
  const { themePreference, setThemePreference } = useTheme();
  const { datasets, addCustomDataset, removeCustomDataset } = useDatasets();
  const status = useStatus();
  const comparison = useComparison(status);
  const {
    result: comparisonResult,
    running: comparisonRunning,
    run: runDatasetComparison,
    clear: clearComparison,
  } = comparison;
  const { setStatus, setStatusTimed } = status;

  const [resultVisibility, setResultVisibility] = useState<ResultBucketVisibility>(
    createResultBucketVisibility,
  );

  useEffect(() => {
    document.documentElement.lang = language;
    document.title = t("app.title");
  }, [language, t]);

  const resetSelectionState = useCallback(() => {
    clearComparison();
    setResultVisibility(createResultBucketVisibility());
    setStatus("");
  }, [clearComparison, setStatus]);

  const {
    selectedDataset,
    selectedDatasetId,
    matchRadius,
    setMatchRadius,
    selectDataset,
    selectDatasetEntry,
    selectFirstAvailableDataset,
  } = useDatasetSelection(datasets, resetSelectionState);

  const runComparison = useCallback(() => {
    if (!selectedDataset) return;
    if (!isValidMatchRadiusM(matchRadius)) {
      setStatus(t("status.error", { message: t("error.matchRadius") }));
      return;
    }
    clearComparison();
    setStatus("");
    setResultVisibility(createResultBucketVisibility());
    void runDatasetComparison(selectedDataset, matchRadius);
  }, [
    clearComparison,
    runDatasetComparison,
    selectedDataset,
    matchRadius,
    setStatus,
    t,
  ]);

  const toggleResultBucketVisibility = useCallback(
    (id: ResultBucketId, visible: boolean) => {
      setResultVisibility((prev) => ({ ...prev, [id]: visible }));
    },
    [],
  );

  const saveDatasetSource = useCallback(
    (definition: DatasetDefinition) => {
      try {
        const savedDataset = addCustomDataset(definition);
        selectDatasetEntry(savedDataset);
        return true;
      } catch (error) {
        setStatus(t("status.error", { message: friendlyError(error) }));
        return false;
      }
    },
    [addCustomDataset, selectDatasetEntry, setStatus, t],
  );

  const shareDatasetSource = useCallback(
    async (definition: DatasetDefinition) => {
      try {
        if (!navigator.clipboard) {
          throw new Error("Clipboard access is not available in this browser.");
        }
        await navigator.clipboard.writeText(encodeShareLink(definition));
        setStatusTimed(t("status.shareCopied"));
      } catch (error) {
        setStatus(t("status.error", { message: friendlyError(error) }));
      }
    },
    [setStatus, setStatusTimed, t],
  );

  const removeSelectedCustomDataset = useCallback(() => {
    if (selectedDataset?.source !== "custom") return;
    removeCustomDataset(selectedDataset.id);
    selectFirstAvailableDataset(selectedDataset.id);
  }, [removeCustomDataset, selectFirstAvailableDataset, selectedDataset]);

  return (
    <>
      <a href="#map" className="skip-link">
        {t("app.skipToMap")}
      </a>
      <div id="app">
        <MapView
          result={comparisonResult}
          dataset={selectedDataset}
          resultVisibility={resultVisibility}
          language={language}
        />

        <div className="overlay-layer">
          <div className="overlay-slot--top-left">
            <ControlPanel
              datasets={datasets}
              selectedDataset={selectedDataset}
              selectedDatasetId={selectedDatasetId}
              onSelectDataset={selectDataset}
              comparisonRunning={comparisonRunning}
              onCompare={runComparison}
              onSaveDatasetSource={saveDatasetSource}
              onShareDatasetSource={(definition) => void shareDatasetSource(definition)}
              onRemoveSelectedCustomDataset={removeSelectedCustomDataset}
            />
          </div>

          <div className="overlay-slot--top-center">
            <StatusToast status={status.status} />
          </div>

          <div className="overlay-slot--top-right">
            <Toolbar
              language={language}
              onLanguageChange={setLanguage}
              themePreference={themePreference}
              onThemePreferenceChange={setThemePreference}
              matchRadius={matchRadius}
              onMatchRadiusChange={setMatchRadius}
            />
          </div>

          {comparisonResult && (
            <div className="overlay-slot--bottom-left">
              <LegendPanel
                result={comparisonResult}
                resultVisibility={resultVisibility}
                onToggle={toggleResultBucketVisibility}
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
