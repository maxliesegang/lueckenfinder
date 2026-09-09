import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// base: "./" makes the build work whether hosted at a domain root
// or under a GitHub Pages project sub-path (username.github.io/lueckenfinder/).
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    target: "es2022",
    sourcemap: true,
  },
});
