import { KernButton } from "@kern-ux-annex/kern-react-kit";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { createCustomDatasetDefinition } from "../custom-dataset";
import { BBOX_TOKEN, checkOverpassQuery } from "../dataset-criteria";
import { preflightDataset } from "../dataset-preflight";
import { friendlyError } from "../error-message";
import { useI18n } from "../hooks/use-i18n";
import { parseTagLines } from "../osm-selector";
import type { DatasetDefinition } from "../types";
import "./dataset-source-form.css";

interface DatasetSourceFormProps {
  open: boolean;
  /** Returns true when the dataset was saved, so the form can reset. */
  onSaveDefinition: (definition: DatasetDefinition) => boolean;
  onShareDefinition: (definition: DatasetDefinition) => void;
  onCancel: () => void;
}

type TestState =
  | { status: "idle" }
  | { status: "running" }
  | { status: "done"; message: string; warning: boolean }
  | { status: "error"; message: string };

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
  const osmTagsInputRef = useRef<HTMLTextAreaElement>(null);
  const broadTagsInputRef = useRef<HTMLTextAreaElement>(null);
  const overpassQueryInputRef = useRef<HTMLTextAreaElement>(null);
  const testRun = useRef<AbortController | undefined>(undefined);
  const [test, setTest] = useState<TestState>({ status: "idle" });

  useEffect(() => {
    if (!open) return;
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    labelInputRef.current?.focus();
  }, [open]);

  useEffect(() => () => testRun.current?.abort(), []);

  /**
   * Validate the OSM criteria fields and report each failure on the field that
   * caused it, so the browser focuses the right input.
   */
  function readOsmCriteria() {
    const osmTagsInput = osmTagsInputRef.current;
    const broadTagsInput = broadTagsInputRef.current;
    const queryInput = overpassQueryInputRef.current;
    if (!osmTagsInput || !broadTagsInput || !queryInput) return null;

    for (const input of [osmTagsInput, broadTagsInput, queryInput]) {
      input.setCustomValidity("");
    }

    const osmTagsText = osmTagsInput.value.trim();
    const broadTagsText = broadTagsInput.value.trim();
    const queryText = queryInput.value.trim();

    if ((osmTagsText === "") === (queryText === "")) {
      osmTagsInput.setCustomValidity(t("validation.osmCriteria"));
      return null;
    }

    const osmSelector = osmTagsText === "" ? undefined : parseTags(osmTagsInput);
    if (osmTagsText !== "" && osmSelector === undefined) return null;

    const broadSelector = broadTagsText === "" ? undefined : parseTags(broadTagsInput);
    if (broadTagsText !== "" && broadSelector === undefined) return null;

    if (queryText !== "") {
      const problem = checkOverpassQuery(queryText);
      if (problem !== null) {
        queryInput.setCustomValidity(
          t(QUERY_PROBLEM_MESSAGES[problem], { bboxToken: BBOX_TOKEN }),
        );
        return null;
      }
    }

    return {
      ...(osmSelector ? { osmSelector } : {}),
      ...(queryText === "" ? {} : { overpassQuery: queryText }),
      ...(broadSelector ? { broadSelector } : {}),
    };
  }

  function parseTags(input: HTMLTextAreaElement) {
    const tags = parseTagLines(input.value);
    if (tags === null) {
      input.setCustomValidity(t("validation.tagLines"));
      return undefined;
    }
    return { tags };
  }

  function readDatasetDefinition(): DatasetDefinition | null {
    const form = formRef.current;
    if (!form) return null;

    const criteria = readOsmCriteria();
    if (!form.reportValidity() || criteria === null) return null;

    return createCustomDatasetDefinition({
      label: labelInputRef.current?.value ?? "",
      geojsonUrl: geojsonUrlInputRef.current?.value ?? "",
      sourceUrl: sourceUrlInputRef.current?.value,
      ...criteria,
    });
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const definition = readDatasetDefinition();
    if (definition && onSaveDefinition(definition)) {
      formRef.current?.reset();
      setTest({ status: "idle" });
    }
  }

  function handleShare() {
    const definition = readDatasetDefinition();
    if (definition) onShareDefinition(definition);
  }

  async function handleTest() {
    const definition = readDatasetDefinition();
    if (!definition) return;

    const controller = new AbortController();
    testRun.current?.abort();
    testRun.current = controller;
    setTest({ status: "running" });

    try {
      const outcome = await preflightDataset(definition, { signal: controller.signal });
      if (controller.signal.aborted) return;
      setTest({
        status: "done",
        message: t("sourceForm.testResult", {
          official: outcome.officialCount,
          osm: outcome.osmCount,
        }),
        warning: outcome.truncated,
      });
    } catch (error) {
      if (controller.signal.aborted) return;
      setTest({ status: "error", message: friendlyError(error) });
    } finally {
      if (testRun.current === controller) testRun.current = undefined;
    }
  }

  function handleCancel() {
    testRun.current?.abort();
    formRef.current?.reset();
    setTest({ status: "idle" });
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
        <label className="kern-label" htmlFor="f-osm-tags">
          {t("sourceForm.osmTags")}
        </label>
        <p className="dataset-source-form__hint" id="f-osm-tags-hint">
          {t("sourceForm.osmTagsHint")}
        </p>
        <textarea
          id="f-osm-tags"
          name="osmTags"
          ref={osmTagsInputRef}
          className="kern-form-input__input"
          aria-describedby="f-osm-tags-hint"
          placeholder={"amenity=drinking_water"}
          autoComplete="off"
          spellCheck={false}
          rows={3}
        />
      </div>

      <div className="kern-form-input dataset-source-form__field">
        <label className="kern-label" htmlFor="f-broad-tags">
          {t("sourceForm.broadTags")}
        </label>
        <p className="dataset-source-form__hint" id="f-broad-tags-hint">
          {t("sourceForm.broadTagsHint")}
        </p>
        <textarea
          id="f-broad-tags"
          name="broadTags"
          ref={broadTagsInputRef}
          className="kern-form-input__input"
          aria-describedby="f-broad-tags-hint"
          placeholder={"drinking_water=yes"}
          autoComplete="off"
          spellCheck={false}
          rows={2}
        />
      </div>

      <details className="dataset-source-form__advanced">
        <summary>{t("sourceForm.overpassQuery", { bboxToken: BBOX_TOKEN })}</summary>
        <div className="kern-form-input dataset-source-form__field">
          <p className="dataset-source-form__hint" id="f-overpass-hint">
            {t("sourceForm.overpassQueryHint")}
          </p>
          <textarea
            id="f-overpass"
            name="overpassQuery"
            ref={overpassQueryInputRef}
            className="kern-form-input__input"
            aria-describedby="f-overpass-hint"
            aria-label={t("sourceForm.overpassQuery", { bboxToken: BBOX_TOKEN })}
            placeholder={'node["amenity"="drinking_water"]({{bbox}});'}
            autoComplete="off"
            spellCheck={false}
            rows={4}
          />
        </div>
      </details>

      {test.status !== "idle" && test.status !== "running" && (
        <p
          className={`dataset-source-form__test-result dataset-source-form__test-result--${
            test.status === "error" || test.warning ? "warning" : "ok"
          }`}
          role="status"
        >
          {test.message}
        </p>
      )}

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
            icon="checklist"
            iconPosition="left"
            disabled={test.status === "running"}
            onClick={() => void handleTest()}
          >
            {test.status === "running" ? t("actions.testing") : t("actions.test")}
          </KernButton>
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

const QUERY_PROBLEM_MESSAGES = {
  bbox: "validation.bboxToken",
  settings: "validation.overpassSettings",
  out: "validation.overpassOut",
} as const;
