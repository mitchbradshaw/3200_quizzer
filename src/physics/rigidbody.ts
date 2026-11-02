// Rigid bodies on resilient mounts (summary notes A3 bounce-pitch, A5 planar isolation; LA7).
// Planar coordinates at the centre of mass: sway x, bounce y, rock theta (anticlockwise).
// A mount at (x_i, y_i) relative to the CoM deflects dx = x - y_i theta, dy = y + x_i theta.
import type { Mat } from './linalg';
import { zeros } from './linalg';

/** A planar mount at (x, y) from the CoM with stiffnesses kx, ky (and optional cross stiffness kxy, e.g. an inclined isolator). */
export interface Mount {
  x: number;
  y: number;
  kx: number;
  ky: number;
  kxy?: number;
}

/** Planar K for (x, y, theta): Kxx = sum kx, Kyy = sum ky, Kxt = -sum kx y_i, Kyt = sum ky x_i, Ktt = sum(kx y_i^2 + ky x_i^2), plus kxy cross terms (summary notes A5). */
export function planarK(mounts: Mount[]): Mat {
  const K = zeros(3, 3);
  for (const m of mounts) {
    const kxy = m.kxy ?? 0;
    // V_i = 1/2 [kx dx^2 + 2 kxy dx dy + ky dy^2] with d(dx)/dq = a, d(dy)/dq = b.
    const a = [1, 0, -m.y];
    const b = [0, 1, m.x];
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        K[i][j] += m.kx * a[i] * a[j] + kxy * (a[i] * b[j] + b[i] * a[j]) + m.ky * b[i] * b[j];
      }
    }
  }
  return K;
}

/** Planar mass matrix diag(m, m, I_G) for (x, y, theta). */
export function planarM(m: number, I: number): Mat {
  return [
    [m, 0, 0],
    [0, m, 0],
    [0, 0, I],
  ];
}

/** I_G = m (w^2 + h^2)/12 of a uniform w x h block about the axis normal to that face (summary notes A2). */
export function blockInertia(m: number, w: number, h: number): number {
  return (m * (w * w + h * h)) / 12;
}

/** I_G = m L^2/12 of a uniform rod about its centre (summary notes A2). */
export function rodInertiaCentre(m: number, L: number): number {
  return (m * L * L) / 12;
}

/** I_end = m L^2/3 of a uniform rod about one end (summary notes A2). */
export function rodInertiaEnd(m: number, L: number): number {
  return (m * L * L) / 3;
}

/** Mount whose principal stiffnesses k1 (axial, at angle theta from x) and k2 (transverse) are rotated to x, y: [[k1 c^2 + k2 s^2, (k1 - k2) s c], [(k1 - k2) s c, k1 s^2 + k2 c^2]] (LA7 Eq 7.11). */
export function inclinedMount(x: number, y: number, k1: number, k2: number, theta: number): Mount {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  return { x, y, kx: k1 * c * c + k2 * s * s, ky: k1 * s * s + k2 * c * c, kxy: (k1 - k2) * s * c };
}

/** Bounce-pitch K for (z, theta), spring k1 at x = -a and k2 at x = +b: [[k1 + k2, k2 b - k1 a], [k2 b - k1 a, k1 a^2 + k2 b^2]]; decoupled when k1 a = k2 b (summary notes A3). */
export function bouncePitchK(k1: number, a: number, k2: number, b: number): Mat {
  const kc = k2 * b - k1 * a;
  return [
    [k1 + k2, kc],
    [kc, k1 * a * a + k2 * b * b],
  ];
}

/** Bounce-pitch mass matrix diag(m, I_G) for (z, theta). */
export function bouncePitchM(m: number, I: number): Mat {
  return [
    [m, 0],
    [0, I],
  ];
}

/** Node of a bounce-pitch mode (z, theta): z + x theta = 0 at x = -z/theta; Infinity when theta = 0 (pure bounce) (summary notes A3). */
export function nodePosition(z: number, theta: number): number {
  return theta === 0 ? Infinity : -z / theta;
}

/** Centre of rotation of a planar mode (X, Y, Theta), the point that does not move: (x, y) = (-Y/Theta, X/Theta); Infinity for pure translation. */
export function centreOfRotation(X: number, Y: number, Theta: number): { x: number; y: number } {
  if (Theta === 0) return { x: Infinity, y: Infinity };
  return { x: -Y / Theta, y: X / Theta };
}

/** Coupled coordinate pairs [i, j] (i < j) with |K_ij| > tol * max_i |K_ii| (point to the off-diagonal term to explain coupling). */
export function couplings(K: Mat, tol = 1e-9): [number, number][] {
  let big = 0;
  for (let i = 0; i < K.length; i++) big = Math.max(big, Math.abs(K[i][i]));
  const out: [number, number][] = [];
  for (let i = 0; i < K.length; i++) {
    for (let j = i + 1; j < K.length; j++) if (Math.abs(K[i][j]) > tol * big) out.push([i, j]);
  }
  return out;
}
