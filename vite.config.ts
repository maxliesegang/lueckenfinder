import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const mapLibreCspEntry = "maplibre-gl/dist/maplibre-gl-csp.js";

// base: "./" makes the build work whether hosted at a domain root
// or under a GitHub Pages project sub-path (username.github.io/lueckenfinder/).
export default defineConfig({
  base: "./",
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: /^maplibre-gl$/,
        // react-map-gl imports the bare package internally; keep that on the
        // same CSP build used by src/maplibre.ts so main thread and worker match.
        replacement: mapLibreCspEntry,
      },
    ],
  },
  build: {
    target: "es2022",
    sourcemap: true,
  },
});
