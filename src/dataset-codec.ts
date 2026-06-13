import { parseDatasetDefinition } from "./dataset-definition";
import type { Dataset, DatasetDefinition } from "./types";
import { isRecord } from "./validation";

const PAYLOAD_VERSION = 1;

interface StoragePayload {
  version: typeof PAYLOAD_VERSION;
  datasets: DatasetDefinition[];
}

interface SharePayload {
  version: typeof PAYLOAD_VERSION;
  dataset: DatasetDefinition;
}

export function encodeStoragePayload(datasets: readonly Dataset[]): string {
  const payload: StoragePayload = {
    version: PAYLOAD_VERSION,
    datasets: datasets.map(({ source: _source, ...definition }) => definition),
  };
  return JSON.stringify(payload);
}

export function decodeStoragePayload(raw: string): DatasetDefinition[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  const byId = new Map<string, DatasetDefinition>();
  for (const value of storedEntries(parsed)) {
    const definition = parseDatasetDefinition(value);
    if (definition) byId.set(definition.id, definition);
  }
  return [...byId.values()];
}

export function encodeSharePayload(dataset: DatasetDefinition): string {
  const payload: SharePayload = {
    version: PAYLOAD_VERSION,
    dataset,
  };
  return encodeBase64Url(JSON.stringify(payload));
}

export function decodeSharePayload(encoded: string): DatasetDefinition | null {
  try {
    const parsed: unknown = JSON.parse(decodeBase64Url(encoded));
    return parseDatasetDefinition(sharedEntry(parsed));
  } catch {
    return null;
  }
}

export function encodeBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeBase64Url(value: string): string {
  const unpadded = value.replace(/-/g, "+").replace(/_/g, "/");
  const base64 = unpadded.padEnd(Math.ceil(unpadded.length / 4) * 4, "=");
  const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function storedEntries(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (
    isRecord(value) &&
    value.version === PAYLOAD_VERSION &&
    Array.isArray(value.datasets)
  ) {
    return value.datasets;
  }
  return [];
}

function sharedEntry(value: unknown): unknown {
  if (isRecord(value) && value.version === PAYLOAD_VERSION && "dataset" in value) {
    return value.dataset;
  }
  // Legacy share links encoded the definition directly.
  return value;
}
