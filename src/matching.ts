import Flatbush from "flatbush";
import { haversineMeters, metersToDegrees } from "./geo";
import type { DatasetPoint } from "./types";

export interface Assignment {
  leftIndex: number;
  rightIndex: number;
  distanceM: number;
}

interface Candidate extends Assignment {}

interface ResidualEdge {
  to: number;
  reverseIndex: number;
  capacity: number;
  cost: number;
  candidate?: Candidate;
}

/**
 * Find a maximum-cardinality one-to-one assignment, then minimize total
 * distance among assignments of that size using min-cost max-flow.
 */
export function assignPoints(
  left: DatasetPoint[],
  right: DatasetPoint[],
  radius: number,
  isEligible: (leftPoint: DatasetPoint, rightPoint: DatasetPoint) => boolean = () =>
    true,
): Assignment[] {
  if (left.length === 0 || right.length === 0) return [];

  const candidates = findCandidates(left, right, radius, isEligible);
  if (candidates.length === 0) return [];

  const source = 0;
  const leftStart = 1;
  const rightStart = leftStart + left.length;
  const sink = rightStart + right.length;
  const graph: ResidualEdge[][] = Array.from({ length: sink + 1 }, () => []);

  for (let leftIndex = 0; leftIndex < left.length; leftIndex += 1) {
    addResidualEdge(graph, source, leftStart + leftIndex, 0);
  }
  for (let rightIndex = 0; rightIndex < right.length; rightIndex += 1) {
    addResidualEdge(graph, rightStart + rightIndex, sink, 0);
  }
  for (const candidate of candidates) {
    addResidualEdge(
      graph,
      leftStart + candidate.leftIndex,
      rightStart + candidate.rightIndex,
      candidate.distanceM,
      candidate,
    );
  }

  runMinCostMaxFlow(graph, source, sink);

  const assignments: Assignment[] = [];
  for (let leftIndex = 0; leftIndex < left.length; leftIndex += 1) {
    for (const edge of graph[leftStart + leftIndex]) {
      if (edge.candidate && edge.capacity === 0) {
        assignments.push(edge.candidate);
      }
    }
  }
  return assignments;
}

function findCandidates(
  left: DatasetPoint[],
  right: DatasetPoint[],
  radius: number,
  isEligible: (leftPoint: DatasetPoint, rightPoint: DatasetPoint) => boolean,
): Candidate[] {
  const index = new Flatbush(right.length);
  for (const point of right) {
    index.add(point.lon, point.lat, point.lon, point.lat);
  }
  index.finish();

  const candidates: Candidate[] = [];
  for (let leftIndex = 0; leftIndex < left.length; leftIndex += 1) {
    const leftPoint = left[leftIndex];
    const degrees = metersToDegrees(radius, leftPoint.lat);
    // Pad the approximate degree conversion before the exact distance check.
    const dLat = degrees.dLat * 1.01;
    const dLon = degrees.dLon * 1.01;
    const hits = index.search(
      leftPoint.lon - dLon,
      leftPoint.lat - dLat,
      leftPoint.lon + dLon,
      leftPoint.lat + dLat,
    );

    for (const rightIndex of hits) {
      const rightPoint = right[rightIndex];
      const distanceM = haversineMeters(
        leftPoint.lon,
        leftPoint.lat,
        rightPoint.lon,
        rightPoint.lat,
      );
      if (distanceM <= radius && isEligible(leftPoint, rightPoint)) {
        candidates.push({ leftIndex, rightIndex, distanceM });
      }
    }
  }

  candidates.sort(
    (a, b) =>
      a.leftIndex - b.leftIndex ||
      a.rightIndex - b.rightIndex ||
      a.distanceM - b.distanceM,
  );
  return candidates;
}

function addResidualEdge(
  graph: ResidualEdge[][],
  from: number,
  to: number,
  cost: number,
  candidate?: Candidate,
): void {
  const forward: ResidualEdge = {
    to,
    reverseIndex: graph[to].length,
    capacity: 1,
    cost,
    candidate,
  };
  const reverse: ResidualEdge = {
    to: from,
    reverseIndex: graph[from].length,
    capacity: 0,
    cost: -cost,
  };
  graph[from].push(forward);
  graph[to].push(reverse);
}

function runMinCostMaxFlow(
  graph: ResidualEdge[][],
  source: number,
  sink: number,
): void {
  const potentials = new Array<number>(graph.length).fill(0);

  while (true) {
    const distances = new Array<number>(graph.length).fill(Infinity);
    const previousNode = new Array<number>(graph.length).fill(-1);
    const previousEdge = new Array<number>(graph.length).fill(-1);
    const heap = new MinHeap();
    distances[source] = 0;
    heap.push({ node: source, distance: 0 });

    while (heap.size > 0) {
      const current = heap.pop();
      if (!current || current.distance > distances[current.node]) continue;

      for (let edgeIndex = 0; edgeIndex < graph[current.node].length; edgeIndex += 1) {
        const edge = graph[current.node][edgeIndex];
        if (edge.capacity === 0) continue;

        const reducedCost = edge.cost + potentials[current.node] - potentials[edge.to];
        const nextDistance = current.distance + Math.max(0, reducedCost);
        if (nextDistance >= distances[edge.to]) continue;

        distances[edge.to] = nextDistance;
        previousNode[edge.to] = current.node;
        previousEdge[edge.to] = edgeIndex;
        heap.push({ node: edge.to, distance: nextDistance });
      }
    }

    if (!Number.isFinite(distances[sink])) return;

    for (let node = 0; node < graph.length; node += 1) {
      if (Number.isFinite(distances[node])) {
        potentials[node] += distances[node];
      }
    }

    for (let node = sink; node !== source; node = previousNode[node]) {
      const from = previousNode[node];
      const edge = graph[from][previousEdge[node]];
      edge.capacity = 0;
      graph[node][edge.reverseIndex].capacity = 1;
    }
  }
}

class MinHeap {
  private readonly entries: Array<{ node: number; distance: number }> = [];

  get size(): number {
    return this.entries.length;
  }

  push(entry: { node: number; distance: number }): void {
    this.entries.push(entry);
    let index = this.entries.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (!isBefore(this.entries[index], this.entries[parent])) break;
      [this.entries[index], this.entries[parent]] = [
        this.entries[parent],
        this.entries[index],
      ];
      index = parent;
    }
  }

  pop(): { node: number; distance: number } | undefined {
    const first = this.entries[0];
    const last = this.entries.pop();
    if (!last || this.entries.length === 0) return first;

    this.entries[0] = last;
    let index = 0;
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      let next = index;
      if (
        left < this.entries.length &&
        isBefore(this.entries[left], this.entries[next])
      ) {
        next = left;
      }
      if (
        right < this.entries.length &&
        isBefore(this.entries[right], this.entries[next])
      ) {
        next = right;
      }
      if (next === index) break;
      [this.entries[index], this.entries[next]] = [
        this.entries[next],
        this.entries[index],
      ];
      index = next;
    }
    return first;
  }
}

function isBefore(
  a: { node: number; distance: number },
  b: { node: number; distance: number },
): boolean {
  return a.distance < b.distance || (a.distance === b.distance && a.node < b.node);
}
