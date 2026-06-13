import {
  decodeSharePayload,
  decodeStoragePayload,
  encodeSharePayload,
  encodeStoragePayload,
} from "./dataset-codec";
import { parseDatasetDefinition } from "./dataset-definition";
import { PRESETS } from "./presets";
import type { Dataset, DatasetDefinition } from "./types";

const STORAGE_KEY = "lueckenfinder:datasets";
const PRESET_IDS = new Set(PRESETS.map((preset) => preset.id));

// ---- Custom datasets (the ONLY thing we persist) --------------------------

function loadCustomDatasets(): Dataset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return decodeStoragePayload(raw)
      .filter((definition) => !PRESET_IDS.has(definition.id))
      .map((definition) => ({ ...definition, source: "custom" }));
  } catch {
    return [];
  }
}

function saveCustomDatasets(datasets: Dataset[]): void {
  localStorage.setItem(STORAGE_KEY, encodeStoragePayload(datasets));
}

export function addCustomDataset(definitionInput: DatasetDefinition): Dataset {
  const definition = parseDatasetDefinition(definitionInput);
  if (!definition) throw new TypeError("Invalid dataset definition");
  if (PRESET_IDS.has(definition.id)) {
    throw new Error(`Dataset ID "${definition.id}" is reserved by a preset`);
  }
  const customDataset: Dataset = { ...definition, source: "custom" };
  const customDatasets = loadCustomDatasets().filter(
    (dataset) => dataset.id !== customDataset.id,
  );
  customDatasets.push(customDataset);
  saveCustomDatasets(customDatasets);
  return customDataset;
}

export function removeCustomDataset(datasetId: string): void {
  saveCustomDatasets(
    loadCustomDatasets().filter((dataset) => dataset.id !== datasetId),
  );
}

// ---- Shareable links (no persistence required) ----------------------------
// A custom dataset can be encoded into the URL hash so it can be bookmarked or
// shared without being "saved" anywhere. #d=<base64url(json)>

export function encodeShareLink(definitionInput: DatasetDefinition): string {
  const definition = parseDatasetDefinition(definitionInput);
  if (!definition) throw new TypeError("Invalid dataset definition");
  if (PRESET_IDS.has(definition.id)) {
    throw new Error(`Dataset ID "${definition.id}" is reserved by a preset`);
  }
  const url = new URL(window.location.href);
  url.hash = `d=${encodeSharePayload(definition)}`;
  return url.toString();
}

export function decodeShareLink(): Dataset | null {
  const match = /[#&]d=([^&]+)/.exec(window.location.hash);
  if (!match) return null;
  const definition = decodeSharePayload(match[1]);
  if (!definition || PRESET_IDS.has(definition.id)) return null;
  return { ...definition, source: "custom" };
}

// ---- Combined view --------------------------------------------------------

export function allDatasets(): Dataset[] {
  const sharedDataset = decodeShareLink();
  const customDatasets = loadCustomDatasets();
  const sharedDatasets =
    sharedDataset && !customDatasets.some((dataset) => dataset.id === sharedDataset.id)
      ? [sharedDataset]
      : [];
  return [...PRESETS, ...customDatasets, ...sharedDatasets];
}

export function getDataset(id: string): Dataset | undefined {
  return allDatasets().find((dataset) => dataset.id === id);
}

export function filterAndSortDatasets(
  datasets: Dataset[],
  searchQuery: string,
  locale: string,
): Dataset[] {
  const needle = searchQuery.trim().toLocaleLowerCase(locale);
  return [...datasets]
    .filter(
      (dataset) =>
        needle.length === 0 || dataset.label.toLocaleLowerCase(locale).includes(needle),
    )
    .sort((a, b) => a.label.localeCompare(b.label, locale));
}
