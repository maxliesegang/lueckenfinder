import { createRoot } from "react-dom/client";
import { App } from "./app";
import { requiredElement } from "./dom";
import { applyThemePreference, getThemePreference } from "./theme";
import "@kern-ux-annex/kern-react-kit/kern-react-kit.css";
import "maplibre-gl/dist/maplibre-gl.css";
import "./style.css";
import "./map.css";

applyThemePreference(getThemePreference());

createRoot(requiredElement("root")).render(<App />);
