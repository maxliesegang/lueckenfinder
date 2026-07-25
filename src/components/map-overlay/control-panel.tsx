import { KernBadge, KernButton, KernSelect } from "@kern-ux-annex/kern-react-kit";
import { useState } from "react";
import { datasetBadgeKey } from "../../dataset-badges";
import { useI18n } from "../../hooks/use-i18n";
import type { PackLibrary } from "../../packs";
import type { CityDefinition, Dataset, DatasetDefinition } from "../../types";
import { AddDatasetSourceDialog } from "../add-dataset-source-dialog";
import { DatasetList } from "../dataset-list";
import { DatasetSourceInfo } from "../dataset-source-info";
import "./control-panel.css";

interface ControlPanelProps {
  datasets: Dataset[];
  cities: readonly CityDefinition[];
  selectedCity: CityDefinition | undefined;
  onSelectCity: (cityId: string) => void;
  selectedDataset: Dataset | undefined;
  selectedDatasetId: string | undefined;
  onSelectDataset: (datasetId: string) => void;
  comparisonRunning: boolean;
  onCompare: () => void;
  onSaveDatasetSource: (definition: DatasetDefinition) => boolean;
  onShareDatasetSource: (definition: DatasetDefinition) => void;
  onRemoveSelectedCustomDataset: () => void;
  packLibrary: PackLibrary;
}

/**
 * Primary floating control card. The casual flow — pick a dataset, compare —
 * stays visible; adding a custom source opens in a modal dialog.
 */
export function ControlPanel({
  datasets,
  cities,
  selectedCity,
  onSelectCity,
  selectedDataset,
  selectedDatasetId,
  onSelectDataset,
  comparisonRunning,
  onCompare,
  onSaveDatasetSource,
  onShareDatasetSource,
  onRemoveSelectedCustomDataset,
  packLibrary,
}: ControlPanelProps) {
  const { t } = useI18n();
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [datasetSearchQuery, setDatasetSearchQuery] = useState("");

  const selectedDatasetIsCustom = selectedDataset?.source === "custom";
  const selectedBadgeKey = datasetBadgeKey(selectedDataset?.source);

  return (
    <section className="overlay-panel control-panel" aria-label={t("dataset.heading")}>
      <header className="overlay-panel__header">
        <span className="control-panel__brand">Lückenfinder</span>
        <KernButton
          type="button"
          variant="tertiary"
          icon={panelCollapsed ? "arrow-down" : "arrow-up"}
          label=""
          alt={panelCollapsed ? t("controls.expand") : t("controls.collapse")}
          aria-expanded={!panelCollapsed}
          onClick={() => setPanelCollapsed((value) => !value)}
        />
      </header>

      {!panelCollapsed && (
        <div className="overlay-panel__body overlay-panel__body--scroll">
          <KernSelect
            id="citySelect"
            label={t("city.label")}
            aria-label={t("city.selectAria")}
            required
            value={selectedCity?.id ?? ""}
            onChange={(event) => onSelectCity(event.target.value)}
          >
            {cities.map((city) => (
              <option key={city.id} value={city.id}>
                {city.name}
              </option>
            ))}
          </KernSelect>

          <div className="control-panel__dataset">
            <div className="control-panel__dataset-label">
              <span className="section-label">{t("dataset.heading")}</span>
              {selectedBadgeKey && (
                <KernBadge variant="info" label={t(selectedBadgeKey)} />
              )}
            </div>
            <div className="kern-form-input control-panel__search">
              <label className="kern-label kern-sr-only" htmlFor="datasetFilter">
                {t("dataset.filterAria")}
              </label>
              <input
                type="search"
                id="datasetFilter"
                className="kern-form-input__input"
                placeholder={t("dataset.filter")}
                autoComplete="off"
                aria-label={t("dataset.filterAria")}
                aria-controls="datasetList"
                value={datasetSearchQuery}
                onChange={(event) => setDatasetSearchQuery(event.target.value)}
              />
            </div>
            <DatasetList
              datasets={datasets}
              searchQuery={datasetSearchQuery}
              selectedDatasetId={selectedDatasetId}
              onSelectDataset={onSelectDataset}
            />
            <DatasetSourceInfo dataset={selectedDataset} />
          </div>

          <KernButton
            type="button"
            variant="primary"
            icon="search"
            iconPosition="left"
            block
            disabled={comparisonRunning || !selectedDataset}
            onClick={onCompare}
          >
            {t("actions.compare")}
          </KernButton>

          <AddDatasetSourceDialog
            onSaveDefinition={onSaveDatasetSource}
            onShareDefinition={onShareDatasetSource}
            packLibrary={packLibrary}
          />
          {selectedDatasetIsCustom && (
            <KernButton
              type="button"
              variant="tertiary"
              icon="delete"
              iconPosition="left"
              block
              onClick={onRemoveSelectedCustomDataset}
            >
              {t("actions.remove")}
            </KernButton>
          )}
        </div>
      )}
    </section>
  );
}
