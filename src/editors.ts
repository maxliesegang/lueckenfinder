import { expectedTags } from "./tag-matching";
import type { Dataset, DatasetPoint } from "./types";

/** Open the location in the iD editor (centred; user surveys & maps). */
export function idEditLink(point: DatasetPoint): string {
  const selection = idSelection(point.osmRef);
  return `https://www.openstreetmap.org/edit?editor=id${selection}#map=20/${point.lat}/${point.lon}`;
}

function idSelection(osmRef: string | undefined): string {
  const match = /^(node|way|relation)\/(\d+)$/.exec(osmRef ?? "");
  return match ? `&${match[1]}=${match[2]}` : "";
}

/** View an existing OSM object on osm.org. */
export function osmObjectLink(point: DatasetPoint): string | null {
  if (!point.osmRef) return null;
  return `https://www.openstreetmap.org/${point.osmRef}`;
}

/**
 * JOSM remote control: pre-create a node with the mapped tags.
 * Requires JOSM running with Remote Control enabled. Treat this as a
 * convenience for experienced mappers who verify before uploading — not a
 * bulk-import shortcut.
 */
export function josmAddNodeLink(point: DatasetPoint, dataset: Dataset): string {
  const tags = expectedTags(point, dataset);
  const addtags = Object.entries(tags)
    .map(([k, v]) => `${k}=${v}`)
    .join("|");
  const params = new URLSearchParams({
    lat: String(point.lat),
    lon: String(point.lon),
    addtags,
  });
  return `http://127.0.0.1:8111/add_node?${params.toString()}`;
}

/** JOSM remote control: just zoom to the area so the mapper can survey. */
export function josmZoomLink(point: DatasetPoint, radiusM = 60): string {
  const dLat = radiusM / 111_320;
  const dLon = radiusM / (111_320 * Math.cos((point.lat * Math.PI) / 180) || 1);
  const params = new URLSearchParams({
    left: String(point.lon - dLon),
    right: String(point.lon + dLon),
    top: String(point.lat + dLat),
    bottom: String(point.lat - dLat),
  });
  return `http://127.0.0.1:8111/load_and_zoom?${params.toString()}`;
}
