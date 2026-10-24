import type { PreparedD20Roll } from './physics.js';
import { dieTopology } from './topology.js';

// Match the board camera at (0,20,5), looking at the floor's origin.
const tilt = Math.atan2(5, 20);
const radius = Math.max(...dieTopology.vertices.map(vertex => vertex.length()));

export function boardRollFrame(roll: PreparedD20Roll, aspect: number) {
  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? Math.max(.35, aspect) : 1;
  const halfHeight = 10 / safeAspect;
  const dieScale = Math.min(1, halfHeight / 3);
  const maxWidth = Math.max(1, ...roll.samples.map(sample => Math.abs(sample.position.x)));
  const maxHeight = Math.max(...roll.samples.map(sample => sample.position.y));
  const maxDepth = Math.max(1, ...roll.samples.map(sample => Math.abs(sample.position.z)));
  // Reserve room for the entire rotating die and its highest bounce, not only
  // its center, so wide/short player windows cannot clip faces at the edges.
  const padding = Math.max(.5, halfHeight * .06);
  const clearance = dieScale * (radius + maxHeight * Math.sin(tilt)) + padding;
  const widthScale = Math.min(1, (10 - dieScale * radius - .6) / maxWidth);
  const depthScale = Math.max(0, halfHeight - clearance) / (maxDepth * Math.cos(tilt));
  return { halfWidth: 10, halfHeight, dieScale, widthScale, depthScale };
}

// This transparent layer contains only the die, not the board typography.
// Bound its fill rate on high-DPI/production monitors without scaling the UI.
export function boardPixelRatio(width: number, height: number, deviceRatio: number) {
  const pixels = Number.isFinite(width * height) && width > 0 && height > 0 ? width * height : 1;
  const ratio = Number.isFinite(deviceRatio) && deviceRatio > 0 ? deviceRatio : 1;
  return Math.min(ratio, 1.25, Math.sqrt(1_800_000 / pixels));
}
