// Shared types for Lückenfinder.

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
   * Overpass QL body — just the statements inside the union.
   * Use the literal token {{bbox}} where a bounding box is needed; it is
   * replaced at query time with the extent of the official data (padded).
   * Example:
   *   node["amenity"="recycling"]["recycling:batteries"="yes"]({{bbox}});
   */
  overpassQuery: string;

  /** Required attribution string for the official source (CC-BY etc.). */
  attribution: string;

  /** Optional human-facing page for the official source. */
  sourceUrl?: string;

  /**
   * Optional relaxed Overpass query (no strict attribute filters) used to find
   * OSM objects that exist geographically but are missing required tags.
   * Example: nwr["amenity"="recycling"]({{bbox}});
   * Results are matched against official points that failed the strict query;
   * hits go into the `needsTagging` bucket rather than `missingInOsm`.
   */
  broadMatchQuery?: string;

  /**
   * How official records map onto OSM tags. Used both to pre-fill new objects
   * (missing-in-OSM) and to detect attribute gaps on matched objects.
   */
  tagMapping?: TagMapping;
}

/**
 * A validated dataset definition plus its runtime provenance.
 *
 * Presets are shipped in the repo and are read-only. Custom mappings are
 * created by users at runtime and live only in localStorage (or a share link).
 */
export interface Dataset extends DatasetDefinition {
  source: "preset" | "custom";
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
