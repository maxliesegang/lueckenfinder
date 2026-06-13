import { CUSTOM_DATASET_ATTRIBUTION } from "../custom-dataset";
import { useI18n } from "../hooks/use-i18n";
import type { Dataset } from "../types";

const LEGACY_CUSTOM_ATTRIBUTIONS = new Set([
  "Custom source — verify licence before editing OSM.",
  "Eigene Quelle — Lizenz vor der Bearbeitung von OSM prüfen.",
]);

interface DatasetSourceInfoProps {
  dataset: Dataset | undefined;
}

export function DatasetSourceInfo({ dataset }: DatasetSourceInfoProps) {
  const { t } = useI18n();
  const attribution = datasetAttribution(dataset, t);

  return (
    <div className="attribution">
      {attribution}
      {dataset?.sourceUrl && (
        <>
          {" "}
          <a href={dataset.sourceUrl} target="_blank" rel="noreferrer">
            {t("dataset.sourceLink")}
          </a>
        </>
      )}
    </div>
  );
}

function datasetAttribution(
  dataset: Dataset | undefined,
  t: ReturnType<typeof useI18n>["t"],
): string {
  if (
    dataset?.source === "custom" &&
    (dataset.attribution === CUSTOM_DATASET_ATTRIBUTION ||
      LEGACY_CUSTOM_ATTRIBUTIONS.has(dataset.attribution))
  ) {
    return t("source.customAttribution");
  }
  return dataset?.attribution ?? "";
}
