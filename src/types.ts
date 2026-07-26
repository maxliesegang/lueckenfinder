// Shared types for Lückenfinder.

import type { OsmSelector } from "./osm-selector";

export interface PropertyTagRule {
  /** GeoJSON property containing the source value. */
  property: string;
  /** Optional regular expression; its first capture group becomes the value. */
  extract?: string;
  /** Optional fixed output used when the source value is present and non-empty. */
  constant?: string;
  /**
   * Optional source-value translation. Values not present in this map are
   * ignored, which is useful for entries such as "unknown".
   */
  values?: Record<string, string>;
}

export type PropertyTagMapping = string | PropertyTagRule;

export interface TagMapping {
  /** Tags always expected, regardless of the record (e.g. amenity=recycling). */
  fixed?: Record<string, string>;
  /**
   * OSM tag key -> official GeoJSON property or extraction rule. Missing,
   * empty, non-scalar, non-matching, and explicitly unmapped values are
   * ignored. A resolved property tag overrides a fixed tag with the same key.
   */
  fromProps?: Record<string, PropertyTagMapping>;
}

/**
 * The serializable definition of a dataset. It contains no runtime provenance,
 * so it is safe to use in storage and share payloads.
 */
export interface DatasetDefinition {
  id: string;
  label: string;

  /** URL of the official open-data GeoJSON. */
  geojsonUrl: string;

  /**
   * Optional shipped topic supplying the OSM criteria below (see topics.ts).
   * A parsed definition always carries those criteria expanded, so this is a
   * record of where they came from — and the key by which the same kind of
   * dataset can be found across cities. Anything the dataset states itself
   * wins, which is how one city deviates from the shared criteria.
   */
  topic?: string;

  /**
   * Declarative OSM criteria — the preferred way to state what an official
   * record should look like in OSM. It generates the Overpass query, seeds the
   * expected tags, and lets the engine classify results without a second
   * request. See osm-selector.ts.
   */
  osmSelector?: OsmSelector;

  /**
   * Overpass QL body — just the statements inside the union. The escape hatch
   * for criteria `osmSelector` cannot express. Exactly one of `osmSelector` and
   * `overpassQuery` is required.
   *
   * Use the literal token {{bbox}} where a bounding box is needed; it is
   * replaced at query time with the extent of the official data (padded).
   * Example:
   *   node["amenity"="recycling"]["recycling:batteries"="yes"]({{bbox}});
   */
  overpassQuery?: string;

  /**
   * Whether the official export lists *every* object an OSM query for this
   * topic would return. Defaults to true; set it to false when the source is
   * knowingly a subset — a city publishes its own car parks, its own toilets,
   * its own bike racks, while OSM also holds everyone else's.
   *
   * It changes nothing about matching: an official record still has to be found
   * in OSM or be reported missing. What it changes is the reading of the
   * leftovers. For an exhaustive source, an OSM object with no official
   * counterpart is worth reviewing; for a subset, it is exactly what should be
   * there, and presenting it as a finding trains people to ignore the bucket.
   */
  exhaustive?: boolean;

  /** Required attribution string for the official source (CC-BY etc.). */
  attribution: string;

  /** Optional human-facing page for the official source. */
  sourceUrl?: string;

  /**
   * Optional relaxed criteria used to find OSM objects that exist
   * geographically but are missing required tags. Results are matched against
   * official points that failed the strict criteria; hits go into the
   * `needsTagging` bucket rather than `missingInOsm`.
   *
   * Declarative form, preferred. Paired with `osmSelector` it costs no extra
   * Overpass request.
   */
  broadSelector?: OsmSelector;

  /** Raw Overpass QL alternative to `broadSelector`. */
  broadMatchQuery?: string;

  /**
   * How official records map onto OSM tags, beyond what `osmSelector` already
   * implies. Used both to pre-fill new objects (missing-in-OSM) and to detect
   * attribute gaps on matched objects. A key here overrides the selector's.
   */
  tagMapping?: TagMapping;
}

/**
 * A validated dataset definition plus its runtime provenance.
 *
 * Presets are shipped in the repo and are read-only. Custom mappings are
 * created by users at runtime and live only in localStorage (or a share link).
 * Imported datasets come from a city pack the user loaded from a URL: read-only
 * like a preset, but removed as a unit with their city rather than one at a
 * time.
 */
export interface Dataset extends DatasetDefinition {
  source: "preset" | "custom" | "imported";
  /** Set for datasets that came from a city pack; see CityPack. */
  cityId?: string;
}

/**
 * The place a set of datasets belongs to. Nothing in the comparison engine is
 * city-aware — a city only supplies the initial map view and groups datasets
 * in the UI. Overpass bounding boxes still come from the official data extent.
 */
export interface CityDefinition {
  id: string;
  /** Display name, e.g. "Karlsruhe". */
  name: string;
  /** Initial map centre as [lon, lat]. */
  center: [lon: number, lat: number];
  /** Initial map zoom. */
  zoom: number;
  /** Optional ISO 3166-1 alpha-2 country code, e.g. "DE". */
  country?: string;
  /** Optional open-data portal for the city. */
  sourceUrl?: string;
}

/**
 * A city plus the datasets curated for it. Packs are the unit of contribution:
 * shipped ones live in presets/<city>.json, and the same shape can be loaded
 * from a remote URL without touching this repo.
 */
export interface CityPack {
  city: CityDefinition;
  datasets: DatasetDefinition[];
}

/** A normalised point extracted from either dataset. */
export interface DatasetPoint {
  lon: number;
  lat: number;
  /** Original properties (official) or tags (OSM). */
  props: Record<string, unknown>;
  /** OSM element type + id when applicable, e.g. "node/12345". */
  osmRef?: string;
}

export interface PointMatch {
  official: DatasetPoint;
  osm: DatasetPoint;
  distanceM: number;
  /** Tags expected from the official record that OSM is missing or differs on. */
  attributeGaps: TagGap[];
}

export interface TagGap {
  key: string;
  expected: string;
  osmValue?: string;
}

export interface ConflationResult {
  /** Official records that have a matching OSM object within the radius. */
  matched: PointMatch[];
  /** Official records with no OSM match — candidates to add to OSM. */
  missingInOsm: DatasetPoint[];
  /** OSM objects with no official match — review (may be stale, or just not in this dataset). */
  onlyInOsm: DatasetPoint[];
  /**
   * Official records where a nearby OSM object exists but mapped tags are
   * missing or differ. The object may come from either query.
   */
  needsTagging: PointMatch[];
}
