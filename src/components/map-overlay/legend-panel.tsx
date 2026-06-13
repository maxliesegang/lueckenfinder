import { KernButton } from "@kern-ux-annex/kern-react-kit";
import { type CSSProperties, useId, useState } from "react";
import { useI18n } from "../../hooks/use-i18n";
import {
  RESULT_BUCKET_IDS,
  type ResultBucketId,
  type ResultBucketVisibility,
} from "../../result-buckets";
import { summaryItems } from "../../summary";
import type { ConflationResult } from "../../types";
import "./legend-panel.css";

interface LegendPanelProps {
  result: ConflationResult;
  resultVisibility: ResultBucketVisibility;
  onToggle: (id: ResultBucketId, visible: boolean) => void;
}

/**
 * Floating results legend. Doubles as the map key and a layer toggle: each row
 * shows a bucket's colour, count, and a checkbox that hides/shows its markers.
 */
export function LegendPanel({ result, resultVisibility, onToggle }: LegendPanelProps) {
  const { t, formatNumber } = useI18n();
  const [legendCollapsed, setLegendCollapsed] = useState(false);
  const bodyId = useId();
  const legendItems = summaryItems(result, resultVisibility);

  const total = legendItems.reduce((sum, item) => sum + item.count, 0);
  const allVisible = legendItems.every((item) => item.visible);
  const noneVisible = legendItems.every((item) => !item.visible);

  const setAll = (visible: boolean) => {
    for (const id of RESULT_BUCKET_IDS) onToggle(id, visible);
  };

  return (
    <section className="overlay-panel legend-panel" aria-label={t("legend.heading")}>
      <header className="overlay-panel__header legend-panel__header">
        <span className="legend-panel__title">
          <span className="section-label">{t("legend.heading")}</span>
          <span className="legend-panel__total">
            {t("legend.total", { count: formatNumber(total) })}
          </span>
        </span>
        <KernButton
          type="button"
          variant="tertiary"
          icon={legendCollapsed ? "arrow-down" : "arrow-up"}
          label=""
          alt={legendCollapsed ? t("controls.expand") : t("controls.collapse")}
          aria-expanded={!legendCollapsed}
          aria-controls={bodyId}
          onClick={() => setLegendCollapsed((value) => !value)}
        />
      </header>

      {!legendCollapsed && (
        <div className="legend-panel__body" id={bodyId}>
          <ul className="legend-list">
            {legendItems.map((item) => (
              <li key={item.id}>
                <label
                  className={
                    item.visible ? "legend-row" : "legend-row legend-row--muted"
                  }
                  style={{ "--bucket-color": item.color } as CSSProperties}
                >
                  <input
                    type="checkbox"
                    className="legend-row__toggle"
                    checked={item.visible}
                    data-layer={item.id}
                    onChange={(event) => onToggle(item.id, event.target.checked)}
                  />
                  <span className="legend-row__dot" aria-hidden="true" />
                  <span className="legend-row__text">
                    <span className="legend-row__name">{t(item.nameKey)}</span>
                    <span className="legend-row__action">{t(item.actionKey)}</span>
                  </span>
                  <span className="legend-row__count">{formatNumber(item.count)}</span>
                </label>
              </li>
            ))}
          </ul>

          <div className="legend-panel__actions">
            <KernButton
              type="button"
              variant="tertiary"
              icon="visibility"
              iconPosition="left"
              label={t("legend.showAll")}
              disabled={allVisible}
              onClick={() => setAll(true)}
            />
            <KernButton
              type="button"
              variant="tertiary"
              icon="visibility-off"
              iconPosition="left"
              label={t("legend.hideAll")}
              disabled={noneVisible}
              onClick={() => setAll(false)}
            />
          </div>
        </div>
      )}
    </section>
  );
}
