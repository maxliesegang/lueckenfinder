import type { Map as MlMap } from "maplibre-gl";
import { useEffect, useRef } from "react";
import {
  GeolocateControl,
  type MapRef,
  NavigationControl,
  Map as ReactMap,
  ScaleControl,
} from "react-map-gl/maplibre";
import type { Language } from "../i18n";
import {
  clearResult,
  closeActivePopup,
  initializeMap,
  MAP_INITIAL_VIEW_STATE,
  MAP_STYLE,
  renderResult,
  setLayerVisible,
} from "../map";
import maplibregl from "../maplibre";
import { RESULT_BUCKET_IDS, type ResultBucketId } from "../result-buckets";
import type { ConflationResult, Dataset } from "../types";

interface MapViewProps {
  result: ConflationResult | undefined;
  dataset: Dataset | undefined;
  resultVisibility: Record<ResultBucketId, boolean>;
  language: Language;
}

/**
 * React boundary around the imperative MapLibre map. The map and its popups are
 * an integration island driven by effects; result data and layer visibility
 * flow in as props.
 */
export function MapView({ result, dataset, resultVisibility, language }: MapViewProps) {
  const mapRef = useRef<MapRef | null>(null);

  useEffect(() => {
    const map = currentMap(mapRef.current);
    if (!map) return;
    if (result && dataset) renderResult(map, result, dataset);
    else clearResult(map);
  }, [result, dataset]);

  useEffect(() => {
    const map = currentMap(mapRef.current);
    if (!map) return;
    for (const id of RESULT_BUCKET_IDS) setLayerVisible(map, id, resultVisibility[id]);
  }, [resultVisibility]);

  // Popups render as HTML strings, so close the active one when the language
  // changes; the next click re-opens it translated.
  useEffect(() => {
    const map = currentMap(mapRef.current);
    if (map && language) closeActivePopup(map);
  }, [language]);

  return (
    <ReactMap
      id="map"
      ref={mapRef}
      mapLib={maplibregl}
      mapStyle={MAP_STYLE}
      initialViewState={MAP_INITIAL_VIEW_STATE}
      onLoad={(event) => initializeMap(event.target)}
    >
      <NavigationControl position="bottom-right" visualizePitch={true} />
      <GeolocateControl position="bottom-right" />
      <ScaleControl position="bottom-right" unit="metric" />
    </ReactMap>
  );
}

function currentMap(ref: MapRef | null): MlMap | null {
  return ref?.getMap() ?? null;
}
