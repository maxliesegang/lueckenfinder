import { KernButton } from "@kern-ux-annex/kern-react-kit";
import { type FormEvent, useEffect, useRef } from "react";
import { createCustomDatasetDefinition } from "../custom-dataset";
import { useI18n } from "../hooks/use-i18n";
import type { DatasetDefinition } from "../types";
import "./dataset-source-form.css";

const BBOX_PLACEHOLDER = "{{bbox}}";

interface DatasetSourceFormProps {
  open: boolean;
  /** Returns true when the dataset was saved, so the form can reset. */
  onSaveDefinition: (definition: DatasetDefinition) => boolean;
  onShareDefinition: (definition: DatasetDefinition) => void;
  onCancel: () => void;
}

export function DatasetSourceForm({
  open,
  onSaveDefinition,
  onShareDefinition,
  onCancel,
}: DatasetSourceFormProps) {
  const { t } = useI18n();
  const formRef = useRef<HTMLFormElement>(null);
  const labelInputRef = useRef<HTMLInputElement>(null);
  const geojsonUrlInputRef = useRef<HTMLInputElement>(null);
  const sourceUrlInputRef = useRef<HTMLInputElement>(null);
  const overpassQueryInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    labelInputRef.current?.focus();
  }, [open]);

  function readDatasetDefinition(): DatasetDefinition | null {
    const form = formRef.current;
    const overpassQueryInput = overpassQueryInputRef.current;
    if (!form || !overpassQueryInput) return null;
    overpassQueryInput.setCustomValidity(
      overpassQueryInput.value.includes(BBOX_PLACEHOLDER)
        ? ""
        : t("validation.bboxToken", { bboxToken: BBOX_PLACEHOLDER }),
    );
    if (!form.reportValidity()) return null;
    return createCustomDatasetDefinition({
      label: labelInputRef.current?.value ?? "",
      geojsonUrl: geojsonUrlInputRef.current?.value ?? "",
      sourceUrl: sourceUrlInputRef.current?.value,
      overpassQuery: overpassQueryInput.value,
    });
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const definition = readDatasetDefinition();
    if (definition && onSaveDefinition(definition)) formRef.current?.reset();
  }

  function handleShare() {
    const definition = readDatasetDefinition();
    if (definition) onShareDefinition(definition);
  }

  function handleCancel() {
    formRef.current?.reset();
    onCancel();
  }

  return (
    <form
      className="dataset-source-form"
      ref={formRef}
      hidden={!open}
      onSubmit={handleSubmit}
    >
      <div className="form-header">
        <span className="section-label">{t("sourceForm.heading")}</span>
      </div>

      <div className="kern-form-input dataset-source-form__field">
        <label className="kern-label" htmlFor="f-label">
          {t("sourceForm.label")}
        </label>
        <input
          id="f-label"
          name="label"
          ref={labelInputRef}
          className="kern-form-input__input"
          placeholder={t("sourceForm.labelPlaceholder")}
          required
        />
      </div>

      <div className="kern-form-input dataset-source-form__field">
        <label className="kern-label" htmlFor="f-geojson">
          {t("sourceForm.geojsonUrl")}
        </label>
        <input
          id="f-geojson"
          name="geojsonUrl"
          ref={geojsonUrlInputRef}
          className="kern-form-input__input"
          type="url"
          placeholder="https://.../data.geojson"
          autoComplete="off"
          spellCheck={false}
          required
        />
      </div>

      <div className="kern-form-input dataset-source-form__field">
        <label className="kern-label" htmlFor="f-source-url">
          {t("sourceForm.sourceUrl")}
        </label>
        <input
          id="f-source-url"
          name="sourceUrl"
          ref={sourceUrlInputRef}
          className="kern-form-input__input"
          type="url"
          placeholder="https://.../dataset"
          autoComplete="off"
          spellCheck={false}
        />
      </div>

      <div className="kern-form-input dataset-source-form__field">
        <label className="kern-label" htmlFor="f-overpass">
          {t("sourceForm.overpassQuery", { bboxToken: BBOX_PLACEHOLDER })}
        </label>
        <textarea
          id="f-overpass"
          name="overpassQuery"
          ref={overpassQueryInputRef}
          className="kern-form-input__input"
          placeholder={'node["amenity"="drinking_water"]({{bbox}});'}
          autoComplete="off"
          spellCheck={false}
          rows={4}
          required
        />
      </div>

      <div className="dataset-source-form__actions">
        <KernButton
          type="submit"
          variant="primary"
          icon="check"
          iconPosition="left"
          block
        >
          {t("actions.save")}
        </KernButton>
        <div className="dataset-source-form__actions-row">
          <KernButton
            type="button"
            variant="secondary"
            icon="content-copy"
            iconPosition="left"
            onClick={handleShare}
          >
            {t("actions.copyShareLink")}
          </KernButton>
          <KernButton type="button" variant="tertiary" onClick={handleCancel}>
            {t("actions.cancel")}
          </KernButton>
        </div>
      </div>
    </form>
  );
}
