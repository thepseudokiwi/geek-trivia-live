import type { PreparedD20Roll } from './physics.js';
import { dieTopology } from './topology.js';

// Match the board camera at (0,20,5), looking at the floor's origin.
const tilt = Math.atan2(5, 20);
const radius = Math.max(...dieTopology.vertices.map(vertex => vertex.length()));

export function boardRollFrame(roll: PreparedD20Roll, aspect: number) {
  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? Math.max(.35, aspect) : 1;
  const halfHeight = 10 / safeAspect;
  const dieScale = Math.min(1, halfHeight / 3);
  const maxHeight = Math.max(...roll.samples.map(sample => sample.position.y));
  const maxDepth = Math.max(1, ...roll.samples.map(sample => Math.abs(sample.position.z)));
  // Reserve room for the entire rotating die and its highest bounce, not only
  // its center, so wide/short player windows cannot clip faces at the edges.
  const clearance = dieScale * (radius + maxHeight * Math.sin(tilt)) + .18;
  const depthScale = Math.max(0, halfHeight - clearance) / (maxDepth * Math.cos(tilt));
  return { halfWidth: 10, halfHeight, dieScale, depthScale };
}
