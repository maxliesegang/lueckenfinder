import type {
  CircleLayerSpecification,
  ExpressionSpecification,
  LineLayerSpecification,
} from "maplibre-gl";
import {
  isResultBucketId,
  RESULT_BUCKETS,
  type ResultBucketId,
} from "./result-buckets";
import type { DatasetPoint, PointMatch } from "./types";

export type MapPopupTargetId = ResultBucketId | "matched-osm" | "needs-tagging-osm";

interface BaseLayerDescriptor {
  sourceId: string;
  layerId: string;
  targetId: MapPopupTargetId | null;
  visibilityBucket: ResultBucketId | null;
}

export interface CircleLayerDescriptor extends BaseLayerDescriptor {
  type: "circle";
  paint: NonNullable<CircleLayerSpecification["paint"]>;
}

export interface LineLayerDescriptor extends BaseLayerDescriptor {
  type: "line";
  paint: NonNullable<LineLayerSpecification["paint"]>;
}

export type MapLayerDescriptor = CircleLayerDescriptor | LineLayerDescriptor;

interface BucketLayerDescriptor<Id extends ResultBucketId> {
  primary: CircleLayerDescriptor & { targetId: Id };
  companions: readonly MapLayerDescriptor[];
}

type BucketLayerRegistry = {
  [Id in ResultBucketId]: BucketLayerDescriptor<Id>;
};

// Zoom-scaled marker radii so points read well at "map-first" scale: small
// when zoomed out so dense clusters stay legible, larger when zoomed in.
const MARKER_RADIUS: ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["zoom"],
  8,
  4,
  12,
  7,
  16,
  11,
];

// The selection ring sits a few pixels outside whichever marker is active.
const SELECTED_RADIUS: ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["zoom"],
  8,
  8,
  12,
  12,
  16,
  17,
];

const matchLines = {
  sourceId: "src-match-lines",
  layerId: "lyr-match-lines",
  type: "line",
  targetId: null,
  visibilityBucket: "matched",
  paint: {
    "line-color": RESULT_BUCKETS.matched.color,
    "line-width": 1.5,
    "line-opacity": 0.55,
  },
} as const satisfies LineLayerDescriptor;

const needsTaggingLines = {
  sourceId: "src-needs-tagging-lines",
  layerId: "lyr-needs-tagging-lines",
  type: "line",
  targetId: null,
  visibilityBucket: "needsTagging",
  paint: {
    "line-color": RESULT_BUCKETS.needsTagging.color,
    "line-width": 1.5,
    "line-opacity": 0.55,
  },
} as const satisfies LineLayerDescriptor;

const matchedOsm = hollowPointLayer(
  "src-matched-osm",
  "lyr-matched-osm",
  "matched-osm",
  "matched",
  RESULT_BUCKETS.matched.color,
);

const needsTaggingOsm = hollowPointLayer(
  "src-needs-tagging-osm",
  "lyr-needs-tagging-osm",
  "needs-tagging-osm",
  "needsTagging",
  RESULT_BUCKETS.needsTagging.color,
);

const selected = {
  sourceId: "src-selected",
  layerId: "lyr-selected",
  type: "circle",
  targetId: null,
  visibilityBucket: null,
  paint: {
    "circle-radius": SELECTED_RADIUS,
    "circle-color": "transparent",
    "circle-stroke-width": 3,
    "circle-stroke-color": "#1a1a2e",
    "circle-stroke-opacity": 0.9,
  },
} satisfies CircleLayerDescriptor;

const onlyInOsm = solidPointLayer("onlyInOsm");
const matched = solidPointLayer("matched");
const missingInOsm = solidPointLayer("missingInOsm");
const needsTagging = solidPointLayer("needsTagging");

export const MAP_RESULT_BUCKET_ORDER = [
  "onlyInOsm",
  "matched",
  "missingInOsm",
  "needsTagging",
] as const satisfies readonly ResultBucketId[];

export const RESULT_BUCKET_LAYER_REGISTRY = {
  onlyInOsm: {
    primary: onlyInOsm,
    companions: [],
  },
  matched: {
    primary: matched,
    companions: [matchedOsm, matchLines],
  },
  missingInOsm: {
    primary: missingInOsm,
    companions: [],
  },
  needsTagging: {
    primary: needsTagging,
    companions: [needsTaggingOsm, needsTaggingLines],
  },
} as const satisfies BucketLayerRegistry;

export const INTERACTIVE_MAP_LAYER_DESCRIPTORS = [
  ...MAP_RESULT_BUCKET_ORDER.map((id) => RESULT_BUCKET_LAYER_REGISTRY[id].primary),
  matchedOsm,
  needsTaggingOsm,
] as const satisfies readonly CircleLayerDescriptor[];

export const MAP_OVERLAY_LAYER_DESCRIPTORS = [
  matchLines,
  needsTaggingLines,
  matchedOsm,
  needsTaggingOsm,
  selected,
  ...MAP_RESULT_BUCKET_ORDER.map((id) => RESULT_BUCKET_LAYER_REGISTRY[id].primary),
] as const satisfies readonly MapLayerDescriptor[];

export const SELECTED_LAYER = selected;
export const MATCH_LINES_LAYER = matchLines;
export const NEEDS_TAGGING_LINES_LAYER = needsTaggingLines;

export function layerDescriptorForPopupTarget(
  targetId: MapPopupTargetId,
): CircleLayerDescriptor {
  const descriptor = INTERACTIVE_MAP_LAYER_DESCRIPTORS.find(
    (candidate) => candidate.targetId === targetId,
  );
  if (!descriptor) {
    throw new Error(`No map layer descriptor for target: ${targetId}`);
  }
  return descriptor;
}

export function layerIdsForVisibilityTarget(id: string): readonly string[] {
  if (!isResultBucketId(id)) return [`lyr-${id}`];
  const descriptor = RESULT_BUCKET_LAYER_REGISTRY[id];
  return [
    descriptor.primary.layerId,
    ...descriptor.companions.map((companion) => companion.layerId),
  ];
}

export function pointsToFeatureCollection(
  points: readonly DatasetPoint[],
  renderVersion = 0,
): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: points.map((point, index) => ({
      type: "Feature",
      id: index,
      geometry: {
        type: "Point",
        coordinates: [point.lon, point.lat],
      },
      properties: { idx: index, renderVersion },
    })),
  };
}

export function pointMatchesToLineFeatureCollection(
  pairs: readonly PointMatch[],
): GeoJSON.FeatureCollection<GeoJSON.LineString> {
  return {
    type: "FeatureCollection",
    features: pairs.map((pair) => ({
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [
          [pair.official.lon, pair.official.lat],
          [pair.osm.lon, pair.osm.lat],
        ],
      },
      properties: {},
    })),
  };
}

function solidPointLayer<Id extends ResultBucketId>(
  id: Id,
): CircleLayerDescriptor & { targetId: Id } {
  return {
    sourceId: `src-${id}`,
    layerId: `lyr-${id}`,
    type: "circle",
    targetId: id,
    visibilityBucket: id,
    paint: {
      "circle-radius": MARKER_RADIUS,
      "circle-color": RESULT_BUCKETS[id].color,
      "circle-opacity": 0.92,
      "circle-stroke-width": 2,
      "circle-stroke-color": "#ffffff",
    },
  };
}

function hollowPointLayer(
  sourceId: string,
  layerId: string,
  targetId: MapPopupTargetId,
  visibilityBucket: ResultBucketId,
  color: string,
): CircleLayerDescriptor {
  return {
    sourceId,
    layerId,
    type: "circle",
    targetId,
    visibilityBucket,
    paint: {
      "circle-radius": MARKER_RADIUS,
      "circle-color": "#ffffff",
      "circle-opacity": 0.85,
      "circle-stroke-width": 2.5,
      "circle-stroke-color": color,
    },
  };
}
