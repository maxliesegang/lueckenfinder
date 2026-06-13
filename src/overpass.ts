import type { BBox } from "./geo";
import type { DatasetPoint } from "./types";
import { isRecord, isValidLat, isValidLon } from "./validation";

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://lz4.overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];
const BBOX_TOKEN = "{{bbox}}";
const CLIENT_TIMEOUT_MS = 100_000;
const SERVER_TIMEOUT_SECONDS = 90;

export interface OverpassOptions {
  signal?: AbortSignal;
  /** Client-side timeout. The Overpass QL server timeout remains 90 seconds. */
  timeoutMs?: number;
}

/**
 * Run an Overpass query. `queryBody` is the union body; {{bbox}} is replaced
 * with "south,west,north,east". `out center tags` ensures ways/relations get a
 * representative coordinate.
 */
export async function runOverpass(
  queryBody: string,
  bbox: BBox,
  options: OverpassOptions = {},
): Promise<DatasetPoint[]> {
  validateQuery(queryBody);
  validateBbox(bbox);

  const ql = buildOverpassQuery(queryBody, bbox);
  const request = createRequestSignal(options);

  try {
    return await fetchOverpassWithFallback(ql, request.signal);
  } finally {
    request.dispose();
  }
}

function validateQuery(queryBody: string): void {
  if (!queryBody.includes(BBOX_TOKEN)) {
    throw new TypeError('Overpass query must contain the literal "{{bbox}}" token');
  }
}

function buildOverpassQuery(queryBody: string, bbox: BBox): string {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const bboxStr = `${minLat},${minLon},${maxLat},${maxLon}`;
  const body = queryBody.replaceAll(BBOX_TOKEN, bboxStr);

  return `[out:json][timeout:${SERVER_TIMEOUT_SECONDS}];
(
${body}
);
out center tags;`;
}

function createRequestSignal(options: OverpassOptions): {
  signal: AbortSignal;
  dispose: () => void;
} {
  const timeoutMs = options.timeoutMs ?? CLIENT_TIMEOUT_MS;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new TypeError("Overpass timeoutMs must be a positive finite number");
  }

  const controller = new AbortController();
  const forwardAbort = (): void => controller.abort(options.signal?.reason);
  if (options.signal?.aborted) forwardAbort();
  else options.signal?.addEventListener("abort", forwardAbort, { once: true });

  const timer = setTimeout(
    () =>
      controller.abort(new DOMException("Overpass request timed out", "TimeoutError")),
    timeoutMs,
  );

  return {
    signal: controller.signal,
    dispose: () => {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", forwardAbort);
    },
  };
}

async function fetchOverpassWithFallback(
  ql: string,
  signal: AbortSignal,
): Promise<DatasetPoint[]> {
  const body = `data=${encodeURIComponent(ql)}`;
  let lastError: Error | undefined;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    if (signal.aborted) break;
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
        signal,
      });
      const responseError = await parseOverpassResponseError(response);
      if (responseError) {
        lastError = responseError;
        continue;
      }
      return parseOverpassResponse(await response.json());
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") throw error;
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw lastError ?? new Error("All Overpass endpoints failed");
}

async function parseOverpassResponseError(response: Response): Promise<Error | null> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return new Error(
      `Overpass error: ${overpassErrorDetail(await response.text(), response.status)}`,
    );
  }
  if (!response.ok) {
    return new Error(`Overpass returned ${response.status} ${response.statusText}`);
  }
  return null;
}

function overpassErrorDetail(text: string, status: number): string {
  const match =
    text.match(/Error:<\/p>\s*<p[^>]*>([\s\S]*?)<\/p>/i) ??
    text.match(/runtime error:([^\n<]+)/i);
  return match ? match[1].trim() : `HTTP ${status}`;
}

export function parseOverpassResponse(value: unknown): DatasetPoint[] {
  if (!isRecord(value) || !Array.isArray(value.elements)) {
    throw new TypeError("Invalid Overpass JSON response");
  }
  return value.elements.flatMap((element, index) => {
    if (!isRecord(element) || !isElementType(element.type)) {
      throw new TypeError(`Invalid Overpass element at index ${index}`);
    }
    if (!Number.isSafeInteger(element.id) || (element.id as number) <= 0) {
      throw new TypeError(`Invalid Overpass element ID at index ${index}`);
    }
    const props = parseTags(element.tags, index);
    const position = elementPosition(element, index);
    if (!position) return [];
    return [
      {
        lon: position[0],
        lat: position[1],
        props,
        osmRef: `${element.type}/${element.id as number}`,
      },
    ];
  });
}

function elementPosition(
  element: Record<string, unknown>,
  index: number,
): [number, number] | null {
  if (element.lat !== undefined || element.lon !== undefined) {
    if (!isValidLat(element.lat) || !isValidLon(element.lon)) {
      throw new TypeError(`Invalid WGS84 coordinate at Overpass element ${index}`);
    }
    return [element.lon, element.lat];
  }
  if (element.center !== undefined) {
    if (
      !isRecord(element.center) ||
      !isValidLat(element.center.lat) ||
      !isValidLon(element.center.lon)
    ) {
      throw new TypeError(`Invalid center at Overpass element ${index}`);
    }
    return [element.center.lon, element.center.lat];
  }
  return null;
}

function parseTags(value: unknown, index: number): Record<string, unknown> {
  if (value === undefined) return {};
  if (!isRecord(value)) {
    throw new TypeError(`Invalid tags at Overpass element ${index}`);
  }
  for (const tagValue of Object.values(value)) {
    if (typeof tagValue !== "string") {
      throw new TypeError(`Invalid tags at Overpass element ${index}`);
    }
  }
  return value;
}

function validateBbox(bbox: BBox): void {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  if (
    !isValidLon(minLon) ||
    !isValidLat(minLat) ||
    !isValidLon(maxLon) ||
    !isValidLat(maxLat) ||
    minLon > maxLon ||
    minLat > maxLat
  ) {
    throw new TypeError("Invalid WGS84 bounding box");
  }
}

function isElementType(value: unknown): value is "node" | "way" | "relation" {
  return value === "node" || value === "way" || value === "relation";
}
