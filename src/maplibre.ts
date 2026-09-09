import * as maplibregl from "maplibre-gl";

// Ship MapLibre's worker as its own emitted asset and point the library at it.
// Bundlers cannot rely on import.meta.url to find the worker inside the module
// graph, so this one-time setWorkerUrl call is required; self-hosting it also
// keeps GitHub Pages builds same-origin, no blob: worker needed. Imported
// dynamically so non-browser contexts (tests) never load the worker module.
if (typeof window !== "undefined") {
  const { default: workerUrl } = await import(
    "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url"
  );
  maplibregl.setWorkerUrl(workerUrl);
}

export default maplibregl;
