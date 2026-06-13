import { assignPoints } from "./matching";
import { findTagGaps } from "./tag-matching";
import type { ConflationResult, Dataset, DatasetPoint, PointMatch } from "./types";

interface OsmGroup {
  point: DatasetPoint;
  originalIndices: number[];
}

/**
 * Compare official points against OSM points and split into four buckets:
 *   - matched:      official has an OSM object within radius
 *   - missingInOsm: official with no OSM match  -> add to OSM
 *   - onlyInOsm:    OSM with no official match  -> review (maybe stale)
 *   - needsTagging: nearby OSM object has mapped attribute gaps
 *
 * Both strict and broad matching maximize the number of one-to-one matches,
 * then minimize their total distance.
 *
 * @param broadOsm Optional broader OSM result set (relaxed tag filter). Points
 *   whose osmRef appears in the strict `osm` array are excluded from broad
 *   matching so an object is never counted twice.
 */
export function conflate(
  official: DatasetPoint[],
  osm: DatasetPoint[],
  dataset: Dataset,
  matchRadiusM: number,
  broadOsm?: DatasetPoint[],
): ConflationResult {
  const radius = matchRadiusM;
  const strictGroups = groupOsmPoints(osm);
  const strictAssignments = assignPoints(
    official,
    strictGroups.map((group) => group.point),
    radius,
  );

  const officialMatched = new Array<boolean>(official.length).fill(false);
  const osmClaimed = new Array<boolean>(osm.length).fill(false);
  const matched: PointMatch[] = [];
  const needsTagging: PointMatch[] = [];

  for (const assignment of strictAssignments) {
    officialMatched[assignment.leftIndex] = true;
    for (const originalIndex of strictGroups[assignment.rightIndex].originalIndices) {
      osmClaimed[originalIndex] = true;
    }

    const officialPoint = official[assignment.leftIndex];
    const osmPoint = strictGroups[assignment.rightIndex].point;
    const pair = createPointMatch(
      officialPoint,
      osmPoint,
      assignment.distanceM,
      dataset,
    );
    (pair.attributeGaps.length > 0 ? needsTagging : matched).push(pair);
  }

  const missingInOsmFlags = official.map((_, oi) => !officialMatched[oi]);
  const onlyInOsm = osm.filter((_, mi) => !osmClaimed[mi]);

  if (broadOsm && broadOsm.length > 0) {
    const strictOsmRefs = new Set(osm.map((point) => point.osmRef).filter(isDefined));
    const strictOsmPoints = new Set(osm);
    const broadGroups = groupOsmPoints(broadOsm, strictOsmRefs, strictOsmPoints);
    const unmatchedOfficialIndices = official
      .map((_, oi) => oi)
      .filter((oi) => missingInOsmFlags[oi]);
    const unmatchedOfficial = unmatchedOfficialIndices.map((oi) => official[oi]);

    const broadAssignments = assignPoints(
      unmatchedOfficial,
      broadGroups.map((group) => group.point),
      radius,
      (officialPoint, osmPoint) =>
        findTagGaps(officialPoint, osmPoint, dataset).length > 0,
    );

    for (const assignment of broadAssignments) {
      const officialIndex = unmatchedOfficialIndices[assignment.leftIndex];
      const officialPoint = official[officialIndex];
      const osmPoint = broadGroups[assignment.rightIndex].point;
      const pair = createPointMatch(
        officialPoint,
        osmPoint,
        assignment.distanceM,
        dataset,
      );

      missingInOsmFlags[officialIndex] = false;
      needsTagging.push(pair);
    }
  }

  const missingInOsm = official.filter((_, oi) => missingInOsmFlags[oi]);
  return { matched, missingInOsm, onlyInOsm, needsTagging };
}

function groupOsmPoints(
  points: DatasetPoint[],
  excludedRefs: ReadonlySet<string> = new Set(),
  excludedPoints: ReadonlySet<DatasetPoint> = new Set(),
): OsmGroup[] {
  const groups: OsmGroup[] = [];
  const groupByRef = new Map<string, number>();
  const groupByPoint = new Map<DatasetPoint, number>();

  points.forEach((point, originalIndex) => {
    if (
      excludedPoints.has(point) ||
      (point.osmRef !== undefined && excludedRefs.has(point.osmRef))
    ) {
      return;
    }

    const existingGroup =
      point.osmRef === undefined
        ? groupByPoint.get(point)
        : groupByRef.get(point.osmRef);
    if (existingGroup !== undefined) {
      groups[existingGroup].originalIndices.push(originalIndex);
      return;
    }

    const groupIndex = groups.length;
    groups.push({ point, originalIndices: [originalIndex] });
    if (point.osmRef === undefined) {
      groupByPoint.set(point, groupIndex);
    } else {
      groupByRef.set(point.osmRef, groupIndex);
    }
  });

  return groups;
}

function createPointMatch(
  official: DatasetPoint,
  osm: DatasetPoint,
  distanceM: number,
  dataset: Dataset,
): PointMatch {
  return {
    official,
    osm,
    distanceM: Math.round(distanceM * 10) / 10,
    attributeGaps: findTagGaps(official, osm, dataset),
  };
}

function isDefined(value: string | undefined): value is string {
  return value !== undefined;
}
