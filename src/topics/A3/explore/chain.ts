// Geometry for the horizontal 2-mass chain drawn by the A3 simulations (viewBox units).
// Per-frame code calls chainSprings() and sets the returned path strings on refs.
import { springPath } from '../../../ui/diagrams';

export const VB_W = 480;
export const VB_H = 132;
export const Y_MID = 74;
export const WALL_L = 22;
export const WALL_R = 458;
export const MASS = 54;
/** Rest positions of the mass centres. */
export const REST: [number, number] = [170, 310];

/** Spring paths for mass centres at cx1, cx2 (px). Springs that are absent (k = 0) get an empty path. */
export function chainSprings(cx1: number, cx2: number, left: boolean, right: boolean): [string, string, string] {
  const h = MASS / 2;
  return [
    left ? springPath(WALL_L, Y_MID, cx1 - h, Y_MID, 6, 8) : '',
    springPath(cx1 + h, Y_MID, cx2 - h, Y_MID, 6, 8),
    right ? springPath(cx2 + h, Y_MID, WALL_R, Y_MID, 6, 8) : '',
  ];
}

/** Normalise a mode vector so its largest |entry| is 1 (sign kept). */
export function unitMax(v: number[]): number[] {
  let big = 0;
  for (const x of v) big = Math.max(big, Math.abs(x));
  return big > 0 ? v.map((x) => x / big) : v.slice();
}

/** Zero crossings (nodes) of a piecewise-linear shape through points (x, y). */
export function nodesOf(pts: [number, number][]): number[] {
  const out: number[] = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    const [xa, ya] = pts[i];
    const [xb, yb] = pts[i + 1];
    if (ya * yb < 0) out.push(xa + (ya / (ya - yb)) * (xb - xa));
  }
  return out;
}
