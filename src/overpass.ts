import { BBOX_TOKEN } from "./dataset-criteria";
import { OVERPASS_INVALID_RESPONSE, OVERPASS_TIMEOUT } from "./errors";
import type { BBox } from "./geo";
import type { DatasetPoint } from "./types";
import { isFiniteNumber, isRecord, isValidLat, isValidLon } from "./validation";

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://lz4.overpass-api.de/api/interpreter",
];
const DEFAULT_ATTEMPT_TIMEOUT_MS = 100_000;
const MAX_SERVER_TIMEOUT_SECONDS = 90;
/** At most eight sequential tiles after an expensive request is rejected. */
const MAX_TILE_DEPTH = 3;
const MAX_RATE_LIMIT_RETRIES = 1;
const MAX_TRANSIENT_RETRIES = 1;
const RATE_LIMIT_DELAY_MS = 15_000;
const TRANSIENT_RETRY_DELAY_MS = 1_000;
const MAX_RETRY_DELAY_MS = 30_000;

type FailureKind = "terminal" | "rate-limit" | "transient" | "capacity" | "query-size";

class OverpassRequestError extends Error {
  constructor(
    message: string,
    readonly kind: FailureKind,
    readonly retryAfterMs?: number,
  ) {
    super(message);
  }
}

export interface OverpassOptions {
  signal?: AbortSignal;
  /** Per-endpoint timeout. The Overpass QL server timeout remains 90 seconds. */
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

  return queryBbox(queryBody, bbox, options, 0);
}

function validateQuery(queryBody: string): void {
  if (!queryBody.includes(BBOX_TOKEN)) {
    throw new TypeError(
      `Overpass query must contain the literal "${BBOX_TOKEN}" token`,
    );
  }
}

function buildOverpassQuery(queryBody: string, bbox: BBox): string {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const bboxStr = `${minLat},${minLon},${maxLat},${maxLon}`;
  const body = queryBody.replaceAll(BBOX_TOKEN, bboxStr);

  return `[out:json][timeout:${MAX_SERVER_TIMEOUT_SECONDS}];
(
${body}
);
out center tags qt;`;
}

function createRequestSignal(
  signal: AbortSignal | undefined,
  timeoutMs: number,
): {
  signal: AbortSignal;
  dispose: () => void;
  didTimeout: () => boolean;
} {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new TypeError("Overpass timeoutMs must be a positive finite number");
  }

  const controller = new AbortController();
  let timedOut = false;
  const forwardAbort = (): void => controller.abort(signal?.reason);
  if (signal?.aborted) forwardAbort();
  else signal?.addEventListener("abort", forwardAbort, { once: true });

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort(new DOMException(OVERPASS_TIMEOUT, "TimeoutError"));
  }, timeoutMs);

  return {
    signal: controller.signal,
    didTimeout: () => timedOut,
    dispose: () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", forwardAbort);
    },
  };
}

async function queryBbox(
  queryBody: string,
  bbox: BBox,
  options: OverpassOptions,
  depth: number,
): Promise<DatasetPoint[]> {
  try {
    return await fetchOverpassWithFallback(
      buildOverpassQuery(queryBody, bbox),
      options.signal,
      options.timeoutMs ?? DEFAULT_ATTEMPT_TIMEOUT_MS,
    );
  } catch (error) {
    if (
      !(error instanceof OverpassRequestError) ||
      error.kind !== "query-size" ||
      depth >= MAX_TILE_DEPTH
    ) {
      throw error;
    }

    const points: DatasetPoint[] = [];
    for (const tile of splitBbox(bbox)) {
      points.push(...(await queryBbox(queryBody, tile, options, depth + 1)));
    }
    return deduplicatePoints(points);
  }
}

async function fetchOverpassWithFallback(
  ql: string,
  signal: AbortSignal | undefined,
  timeoutMs: number,
): Promise<DatasetPoint[]> {
  const body = `data=${encodeURIComponent(ql)}`;
  let lastError: Error | undefined;
  let sawFailure = false;
  let capacityFailuresOnly = true;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    let rateLimitRetries = 0;
    let transientRetries = 0;
    while (true) {
      throwIfAborted(signal);
      const request = createRequestSignal(signal, timeoutMs);
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body,
          signal: request.signal,
        });
        const responseError = await parseOverpassResponseError(response);
        if (!responseError) {
          return parseOverpassResponse(await response.json());
        }
        if (responseError.kind === "terminal" || responseError.kind === "query-size") {
          throw responseError;
        }
        if (
          responseError.kind === "rate-limit" &&
          rateLimitRetries < MAX_RATE_LIMIT_RETRIES
        ) {
          rateLimitRetries += 1;
          await waitForRetry(responseError.retryAfterMs, RATE_LIMIT_DELAY_MS, signal);
          continue;
        }
        if (
          responseError.kind === "transient" &&
          transientRetries < MAX_TRANSIENT_RETRIES
        ) {
          transientRetries += 1;
          await waitForRetry(
            responseError.retryAfterMs,
            TRANSIENT_RETRY_DELAY_MS,
            signal,
          );
          continue;
        }
        lastError = responseError;
        sawFailure = true;
        if (responseError.kind !== "capacity") capacityFailuresOnly = false;
        break;
      } catch (error) {
        throwIfAborted(signal);
        if (request.didTimeout()) {
          lastError = new DOMException(OVERPASS_TIMEOUT, "TimeoutError");
          sawFailure = true;
          capacityFailuresOnly = false;
          break;
        }
        if (error instanceof OverpassRequestError) {
          if (error.kind === "terminal" || error.kind === "query-size") throw error;
          lastError = error;
          sawFailure = true;
          if (error.kind !== "capacity") capacityFailuresOnly = false;
          break;
        }
        lastError = error instanceof Error ? error : new Error(String(error));
        sawFailure = true;
        capacityFailuresOnly = false;
        break;
      } finally {
        request.dispose();
      }
    }
  }

  if (sawFailure && capacityFailuresOnly && lastError) {
    throw new OverpassRequestError(lastError.message, "query-size");
  }
  throw lastError ?? new Error("All Overpass endpoints failed");
}

async function parseOverpassResponseError(
  response: Response,
): Promise<OverpassRequestError | null> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    const detail = overpassErrorDetail(await response.text(), response.status);
    const message =
      !response.ok && detail === `HTTP ${response.status}`
        ? `Overpass returned ${response.status} ${response.statusText}`
        : `Overpass error: ${detail}`;
    return new OverpassRequestError(
      message,
      isQuerySizeError(detail) ? "query-size" : failureKind(response.status),
      retryAfterMs(response),
    );
  }
  if (!response.ok) {
    return new OverpassRequestError(
      `Overpass returned ${response.status} ${response.statusText}`,
      failureKind(response.status),
      retryAfterMs(response),
    );
  }
  return null;
}

function failureKind(status: number): FailureKind {
  if (status === 429) return "rate-limit";
  if (status === 504) return "capacity";
  if (status === 502 || status === 503) return "transient";
  return "terminal";
}

function isQuerySizeError(detail: string): boolean {
  return /timed out|timeout|out of memory|exceed(?:ed|s).*memory/i.test(detail);
}

function retryAfterMs(response: Response): number | undefined {
  const value = response.headers.get("retry-after");
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1_000;
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : undefined;
}

async function waitForRetry(
  retryAfter: number | undefined,
  defaultDelay: number,
  signal: AbortSignal | undefined,
): Promise<void> {
  throwIfAborted(signal);
  const delay = Math.min(
    retryAfter ?? defaultDelay + Math.random() * defaultDelay * 0.1,
    MAX_RETRY_DELAY_MS,
  );
  await new Promise<void>((resolve, reject) => {
    const onAbort = (): void => {
      clearTimeout(timer);
      reject(signal?.reason ?? new DOMException("Aborted", "AbortError"));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, delay);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw signal.reason ?? new DOMException("Aborted", "AbortError");
  }
}

function splitBbox(bbox: BBox): [BBox, BBox] {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  if (maxLon - minLon >= maxLat - minLat) {
    const middle = (minLon + maxLon) / 2;
    return [
      [minLon, minLat, middle, maxLat],
      [middle, minLat, maxLon, maxLat],
    ];
  }
  const middle = (minLat + maxLat) / 2;
  return [
    [minLon, minLat, maxLon, middle],
    [minLon, middle, maxLon, maxLat],
  ];
}

function deduplicatePoints(points: DatasetPoint[]): DatasetPoint[] {
  const seen = new Set<string>();
  return points.filter((point) => {
    const key = point.osmRef ?? JSON.stringify([point.lon, point.lat, point.props]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function overpassErrorDetail(text: string, status: number): string {
  const match =
    text.match(/Error:<\/p>\s*<p[^>]*>([\s\S]*?)<\/p>/i) ??
    text.match(/runtime error:([^\n<]+)/i);
  return match ? match[1].trim() : `HTTP ${status}`;
}

export function parseOverpassResponse(value: unknown): DatasetPoint[] {
  if (!isRecord(value) || !Array.isArray(value.elements)) {
    throw new TypeError(OVERPASS_INVALID_RESPONSE);
  }
  return value.elements.flatMap((element, index) => {
    if (!isRecord(element) || !isElementType(element.type)) {
      throw new TypeError(`Invalid Overpass element at index ${index}`);
    }
    const id = element.id;
    if (!isFiniteNumber(id) || !Number.isSafeInteger(id) || id <= 0) {
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
        osmRef: `${element.type}/${id}`,
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
