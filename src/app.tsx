import { useCallback, useEffect, useMemo, useState } from "react";
import { ControlPanel } from "./components/map-overlay/control-panel";
import { LegendPanel } from "./components/map-overlay/legend-panel";
import { StatusToast } from "./components/map-overlay/status-toast";
import { Toolbar } from "./components/map-overlay/toolbar";
import { MapView } from "./components/map-view";
import { isValidMatchRadiusM } from "./constraints";
import { encodeShareLink } from "./datasets";
import { friendlyError } from "./error-message";
import { useCitySelection } from "./hooks/use-city-selection";
import { useComparison } from "./hooks/use-comparison";
import { useDatasetSelection } from "./hooks/use-dataset-selection";
import { useDatasets } from "./hooks/use-datasets";
import { useI18n } from "./hooks/use-i18n";
import { usePackLibrary } from "./hooks/use-pack-library";
import { useStatus } from "./hooks/use-status";
import { useTheme } from "./hooks/use-theme";
import { buildCatalog, type PackLibrary } from "./packs";
import {
  createResultBucketVisibility,
  type ResultBucketId,
  type ResultBucketVisibility,
} from "./result-buckets";
import type { CityPack, DatasetDefinition } from "./types";

export function App() {
  const { t, language, setLanguage } = useI18n();
  const { themePreference, setThemePreference } = useTheme();
  const {
    datasets: storedDatasets,
    addCustomDataset,
    removeCustomDataset,
  } = useDatasets();
  const status = useStatus();
  const { setStatus, setStatusTimed } = status;

  const reportError = useCallback(
    (error: unknown) => {
      setStatus(t("status.error", { message: friendlyError(error) }));
    },
    [setStatus, t],
  );

  const packLibrary = usePackLibrary(reportError);

  const { cities, datasets } = useMemo(
    () => buildCatalog(storedDatasets, packLibrary.activePacks),
    [storedDatasets, packLibrary.activePacks],
  );
  const { selectedCity, cityDatasets, selectCity } = useCitySelection(datasets, cities);
  const comparison = useComparison(status);
  const {
    result: comparisonResult,
    running: comparisonRunning,
    run: runDatasetComparison,
    clear: clearComparison,
  } = comparison;

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
  } = useDatasetSelection(cityDatasets, resetSelectionState);

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
        reportError(error);
        return false;
      }
    },
    [addCustomDataset, reportError, selectDatasetEntry],
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
        reportError(error);
      }
    },
    [reportError, setStatusTimed, t],
  );

  const removeSelectedCustomDataset = useCallback(() => {
    if (selectedDataset?.source !== "custom") return;
    removeCustomDataset(selectedDataset.id);
    selectFirstAvailableDataset(selectedDataset.id);
  }, [removeCustomDataset, selectFirstAvailableDataset, selectedDataset]);

  // Adding a city switches to it: the user just asked for that place, and
  // landing on the old city with an unexplained new entry reads as a no-op.
  const handlePackAdded = useCallback(
    (pack: CityPack) => {
      selectCity(pack.city.id);
      setStatusTimed(
        t("pack.imported", { city: pack.city.name, count: pack.datasets.length }),
      );
    },
    [selectCity, setStatusTimed, t],
  );

  /** The pack library the UI sees: storage actions plus their status reporting. */
  const reportingPackLibrary = useMemo<PackLibrary>(
    () => ({
      ...packLibrary,
      importPack: async (url) => {
        try {
          const pack = await packLibrary.importPack(url);
          handlePackAdded(pack);
          return pack;
        } catch (error) {
          reportError(error);
          throw error;
        }
      },
      keepSessionPack: () => {
        const pack = packLibrary.sessionPack;
        if (!pack) return;
        try {
          packLibrary.keepSessionPack();
          handlePackAdded(pack);
        } catch (error) {
          reportError(error);
        }
      },
      removePack: (cityId) => {
        const pack = packLibrary.activePacks.find((entry) => entry.city.id === cityId);
        packLibrary.removePack(cityId);
        if (pack) setStatusTimed(t("pack.removed", { city: pack.city.name }));
      },
    }),
    [handlePackAdded, packLibrary, reportError, setStatusTimed, t],
  );

  return (
    <>
      <a href="#map" className="skip-link">
        {t("app.skipToMap")}
      </a>
      <div id="app">
        <MapView
          result={comparisonResult}
          dataset={selectedDataset}
          city={selectedCity}
          resultVisibility={resultVisibility}
          language={language}
        />

        <div className="overlay-layer">
          <div className="overlay-slot--top-left">
            <ControlPanel
              datasets={cityDatasets}
              cities={cities}
              selectedCity={selectedCity}
              onSelectCity={selectCity}
              selectedDataset={selectedDataset}
              selectedDatasetId={selectedDatasetId}
              onSelectDataset={selectDataset}
              comparisonRunning={comparisonRunning}
              onCompare={runComparison}
              onSaveDatasetSource={saveDatasetSource}
              onShareDatasetSource={(definition) => void shareDatasetSource(definition)}
              onRemoveSelectedCustomDataset={removeSelectedCustomDataset}
              packLibrary={reportingPackLibrary}
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
