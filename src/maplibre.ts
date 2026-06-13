import type maplibre from "maplibre-gl";
import maplibregl from "maplibre-gl/dist/maplibre-gl-csp.js";

// Use MapLibre's CSP build everywhere. Its worker lives in a separate emitted
// asset instead of an inline Blob, which keeps GitHub Pages production builds
// from tripping over the default worker bootstrap.
if (typeof window !== "undefined") {
  const { default: workerUrl } = await import(
    "maplibre-gl/dist/maplibre-gl-csp-worker.js?url"
  );
  maplibregl.setWorkerUrl(workerUrl);
}

export default maplibregl as typeof maplibre;
