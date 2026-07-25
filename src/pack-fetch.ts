import { parseCityPack } from "./city-pack";
import { MAX_PACK_BYTES, MAX_PACK_DATASETS } from "./constraints";
import {
  PACK_EMPTY,
  PACK_INVALID,
  PACK_TOO_LARGE,
  PACK_URL_INVALID,
  packRequestFailed,
} from "./pack-errors";
import type { CityPack } from "./types";
import { httpUrl } from "./validation";

export interface FetchCityPackOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

/**
 * Load a city pack from a URL the user supplied. The response is untrusted:
 * it is size-capped, shape-validated, and rejected as a whole if anything is
 * wrong. The remote server must send CORS headers — the app has no backend to
 * proxy through, which is exactly the limitation that shipped packs avoid.
 */
export async function fetchCityPack(
  url: string,
  options: FetchCityPackOptions = {},
): Promise<CityPack> {
  const packUrl = httpUrl(url);
  if (packUrl === null) throw new Error(PACK_URL_INVALID);

  const signals = [AbortSignal.timeout(options.timeoutMs ?? 20_000)];
  if (options.signal) signals.push(options.signal);

  const res = await fetch(packUrl, {
    signal: AbortSignal.any(signals),
    headers: { accept: "application/json" },
  });
  if (!res.ok) throw new Error(packRequestFailed(res.status));

  const declaredLength = Number(res.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_PACK_BYTES) {
    throw new Error(PACK_TOO_LARGE);
  }

  const text = await res.text();
  return parseCityPackJson(text);
}

/** Validate a pack document (fetched or pasted) into a usable pack. */
export function parseCityPackJson(text: string): CityPack {
  if (byteLength(text) > MAX_PACK_BYTES) throw new Error(PACK_TOO_LARGE);

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(PACK_INVALID);
  }

  const pack = parseCityPack(parsed);
  if (!pack) throw new Error(PACK_INVALID);
  if (pack.datasets.length === 0) throw new Error(PACK_EMPTY);
  if (pack.datasets.length > MAX_PACK_DATASETS) {
    throw new Error(PACK_TOO_LARGE);
  }
  return pack;
}

function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}
