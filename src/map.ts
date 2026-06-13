import type { Map as MlMap, Popup as MlPopup } from "maplibre-gl";
import type { ReactElement } from "react";
import { createRoot } from "react-dom/client";
import {
  INTERACTIVE_MAP_LAYER_DESCRIPTORS,
  layerDescriptorForPopupTarget,
  layerIdsForVisibilityTarget,
  MAP_OVERLAY_LAYER_DESCRIPTORS,
  MAP_RESULT_BUCKET_ORDER,
  MATCH_LINES_LAYER,
  type MapPopupTargetId,
  NEEDS_TAGGING_LINES_LAYER,
  pointMatchesToLineFeatureCollection,
  pointsToFeatureCollection,
  SELECTED_LAYER,
} from "./map-layers";
import maplibregl from "./maplibre";
import {
  matchedPopup,
  missingPopup,
  needsTaggingPopup,
  type PopupSide,
  reviewPopup,
} from "./popups";
import {
  createResultBucketVisibility,
  isResultBucketId,
  RESULT_BUCKET_IDS,
  type ResultBucketId,
  type ResultBucketVisibility,
} from "./result-buckets";
import type { ConflationResult, Dataset, DatasetPoint, PointMatch } from "./types";

export const MAP_INITIAL_VIEW_STATE = {
  longitude: 8.4037,
  latitude: 49.0069,
  zoom: 12,
} as const;

export const MAP_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};

const EMPTY_FEATURE_COLLECTION: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

interface MapPopupTarget {
  point: DatasetPoint;
  content: () => ReactElement;
}

interface PendingResultRender {
  result: ConflationResult;
  dataset: Dataset;
}

type ResultBucketTargets = Record<ResultBucketId, MapPopupTarget[]>;

interface MapState {
  popupTargetsById: Map<MapPopupTargetId, MapPopupTarget[]>;
  activePopup: MlPopup | null;
  eventsWired: boolean;
  initialLoadComplete: boolean;
  pendingRender: PendingResultRender | null;
  renderVersion: number;
  visibility: ResultBucketVisibility;
  escapeHandler: (event: KeyboardEvent) => void;
}

const mapStates = new WeakMap<MlMap, MapState>();

export function initializeMap(map: MlMap): void {
  getMapState(map);
}

export function renderResult(
  map: MlMap,
  result: ConflationResult,
  dataset: Dataset,
): void {
  const state = getMapState(map);
  state.pendingRender = { result, dataset };

  for (const id of RESULT_BUCKET_IDS) {
    state.visibility[id] = true;
  }
  closeActivePopup(map);

  if (state.initialLoadComplete) {
    applyRender(map, state, state.pendingRender);
  }
}

export function setLayerVisible(map: MlMap, id: string, visible: boolean): void {
  const state = getMapState(map);
  if (isResultBucketId(id)) {
    state.visibility[id] = visible;
  }
  setLayerVisibility(map, id, visible);
}

export function closeActivePopup(map: MlMap): void {
  const state = mapStates.get(map);
  if (!state) return;

  const popup = state.activePopup;
  if (popup) {
    popup.remove();
    if (state.activePopup === popup) {
      state.activePopup = null;
      clearSelection(map);
    }
  } else {
    clearSelection(map);
  }
}

export function clearResult(map: MlMap): void {
  const state = getMapState(map);
  state.pendingRender = null;
  state.renderVersion++;
  closeActivePopup(map);

  for (const id of MAP_RESULT_BUCKET_ORDER) {
    setTargets(map, state, id, []);
  }
  setTargets(map, state, "matched-osm", []);
  setTargets(map, state, "needs-tagging-osm", []);
  setGeoJsonSource(map, MATCH_LINES_LAYER.sourceId, EMPTY_FEATURE_COLLECTION);
  setGeoJsonSource(map, NEEDS_TAGGING_LINES_LAYER.sourceId, EMPTY_FEATURE_COLLECTION);
}

function getMapState(map: MlMap): MapState {
  const existing = mapStates.get(map);
  if (existing) return existing;

  const initialLoadComplete = map.isStyleLoaded() === true;
  const state: MapState = {
    popupTargetsById: new Map(),
    activePopup: null,
    eventsWired: false,
    initialLoadComplete,
    pendingRender: null,
    renderVersion: 0,
    visibility: createResultBucketVisibility(),
    escapeHandler: (event) => {
      if (event.key === "Escape") closeActivePopup(map);
    },
  };

  mapStates.set(map, state);
  document.addEventListener("keydown", state.escapeHandler);
  if (!initialLoadComplete) {
    map.once("load", () => {
      state.initialLoadComplete = true;
      if (state.pendingRender) {
        applyRender(map, state, state.pendingRender);
      }
    });
  }
  map.once("remove", () => {
    document.removeEventListener("keydown", state.escapeHandler);
    mapStates.delete(map);
  });
  return state;
}

function applyRender(map: MlMap, state: MapState, render: PendingResultRender): void {
  initOverlayLayers(map, state);
  state.renderVersion++;

  const { result, dataset } = render;
  applyBucketTargets(map, state, bucketTargets(result, dataset));
  applyMatchCompanionTargets(
    map,
    state,
    "matched-osm",
    result.matched,
    matchedPopup,
    MATCH_LINES_LAYER.sourceId,
  );
  applyMatchCompanionTargets(
    map,
    state,
    "needs-tagging-osm",
    result.needsTagging,
    needsTaggingPopup,
    NEEDS_TAGGING_LINES_LAYER.sourceId,
  );

  clearSelection(map);
  fitToData(map, resultPoints(result));
}

function bucketTargets(
  result: ConflationResult,
  dataset: Dataset,
): ResultBucketTargets {
  return {
    onlyInOsm: pointTargets(result.onlyInOsm, reviewPopup),
    matched: matchTargets(result.matched, "official", matchedPopup),
    missingInOsm: pointTargets(result.missingInOsm, (point) =>
      missingPopup(point, dataset),
    ),
    needsTagging: matchTargets(result.needsTagging, "official", needsTaggingPopup),
  };
}

function applyBucketTargets(
  map: MlMap,
  state: MapState,
  targetsByBucket: ResultBucketTargets,
): void {
  for (const id of MAP_RESULT_BUCKET_ORDER) {
    setTargets(map, state, id, targetsByBucket[id]);
    setLayerVisibility(map, id, state.visibility[id]);
  }
}

function applyMatchCompanionTargets(
  map: MlMap,
  state: MapState,
  targetId: "matched-osm" | "needs-tagging-osm",
  pairs: readonly PointMatch[],
  content: (pair: PointMatch, side: PopupSide) => ReactElement,
  lineSourceId: string,
): void {
  setTargets(map, state, targetId, matchTargets(pairs, "osm", content));
  setGeoJsonSource(map, lineSourceId, pointMatchesToLineFeatureCollection(pairs));
}

function pointTargets(
  points: readonly DatasetPoint[],
  content: (point: DatasetPoint) => ReactElement,
): MapPopupTarget[] {
  return points.map((point) => ({
    point,
    content: () => content(point),
  }));
}

function matchTargets(
  pairs: readonly PointMatch[],
  side: PopupSide,
  content: (pair: PointMatch, side: PopupSide) => ReactElement,
): MapPopupTarget[] {
  return pairs.map((pair) => ({
    point: pair[side],
    content: () => content(pair, side),
  }));
}

function resultPoints(result: ConflationResult): DatasetPoint[] {
  return [
    ...result.matched.flatMap(matchPoints),
    ...result.missingInOsm,
    ...result.onlyInOsm,
    ...result.needsTagging.flatMap(matchPoints),
  ];
}

function matchPoints(pair: PointMatch): [DatasetPoint, DatasetPoint] {
  return [pair.official, pair.osm];
}

function initOverlayLayers(map: MlMap, state: MapState): void {
  for (const descriptor of MAP_OVERLAY_LAYER_DESCRIPTORS) {
    addGeoJsonSource(map, descriptor.sourceId);
    if (map.getLayer(descriptor.layerId)) continue;
    map.addLayer({
      id: descriptor.layerId,
      type: descriptor.type,
      source: descriptor.sourceId,
      paint: descriptor.paint,
    } as maplibregl.LayerSpecification);
  }

  if (!state.eventsWired) {
    for (const descriptor of INTERACTIVE_MAP_LAYER_DESCRIPTORS) {
      if (descriptor.targetId) {
        wirePopupLayer(map, state, descriptor.layerId, descriptor.targetId);
      }
    }
    wireBackgroundClick(map);
    state.eventsWired = true;
  }
}

function addGeoJsonSource(map: MlMap, id: string): void {
  if (!map.getSource(id)) {
    map.addSource(id, { type: "geojson", data: EMPTY_FEATURE_COLLECTION });
  }
}

function wirePopupLayer(
  map: MlMap,
  state: MapState,
  layerId: string,
  targetId: MapPopupTargetId,
): void {
  map.on("click", layerId, (event) => {
    const feature = event.features?.[0];
    if (!feature) return;

    const renderVersion = Number(feature.properties?.renderVersion);
    if (renderVersion !== state.renderVersion) return;
    const index = Number(feature.properties?.idx);
    const target = state.popupTargetsById.get(targetId)?.[index];
    if (!target) return;

    openPopup(map, state, target);
  });
  map.on("mouseenter", layerId, () => {
    map.getCanvas().style.cursor = "pointer";
  });
  map.on("mouseleave", layerId, () => {
    map.getCanvas().style.cursor = "";
  });
}

function wireBackgroundClick(map: MlMap): void {
  map.on("click", (event) => {
    const hits = map.queryRenderedFeatures(event.point, {
      layers: INTERACTIVE_MAP_LAYER_DESCRIPTORS.map((descriptor) => descriptor.layerId),
    });
    if (hits.length === 0) {
      closeActivePopup(map);
    }
  });
}

function openPopup(map: MlMap, state: MapState, target: MapPopupTarget): void {
  closeActivePopup(map);
  selectPoint(map, target.point);

  const content = document.createElement("div");
  const root = createRoot(content);
  root.render(target.content());

  const popup = new maplibregl.Popup({ closeButton: true, maxWidth: "400px" })
    .setLngLat([target.point.lon, target.point.lat])
    .setDOMContent(content);

  state.activePopup = popup;
  popup.on("close", () => {
    root.unmount();
    if (state.activePopup === popup) {
      state.activePopup = null;
      clearSelection(map);
    }
  });
  popup.addTo(map);
}

function clearSelection(map: MlMap): void {
  setGeoJsonSource(map, SELECTED_LAYER.sourceId, EMPTY_FEATURE_COLLECTION);
}

function selectPoint(map: MlMap, point: DatasetPoint): void {
  setGeoJsonSource(map, SELECTED_LAYER.sourceId, pointsToFeatureCollection([point]));
}

function setTargets(
  map: MlMap,
  state: MapState,
  id: MapPopupTargetId,
  targets: MapPopupTarget[],
): void {
  state.popupTargetsById.set(id, targets);
  const descriptor = layerDescriptorForPopupTarget(id);
  setGeoJsonSource(
    map,
    descriptor.sourceId,
    pointsToFeatureCollection(
      targets.map((target) => target.point),
      state.renderVersion,
    ),
  );
}

function setGeoJsonSource(
  map: MlMap,
  id: string,
  data: GeoJSON.FeatureCollection,
): void {
  (map.getSource(id) as maplibregl.GeoJSONSource | undefined)?.setData(data);
}

function setLayerVisibility(map: MlMap, id: string, visible: boolean): void {
  const visibility = visible ? "visible" : "none";
  for (const layerId of layerIdsForVisibilityTarget(id)) {
    if (map.getLayer(layerId)) {
      map.setLayoutProperty(layerId, "visibility", visibility);
    }
  }
}

function fitToData(map: MlMap, points: DatasetPoint[]): void {
  if (points.length === 0) return;
  const bounds = new maplibregl.LngLatBounds();
  for (const point of points) {
    bounds.extend([point.lon, point.lat]);
  }
  // Asymmetric padding keeps fitted markers clear of the floating overlay
  // panels: the control panel/toast at the top, the control panel on the left,
  // and the results legend in the bottom-left corner.
  map.fitBounds(bounds, {
    padding: { top: 120, bottom: 140, left: 360, right: 80 },
    maxZoom: 16,
    duration: 600,
  });
}
