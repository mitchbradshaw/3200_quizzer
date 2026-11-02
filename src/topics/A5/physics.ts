// Extra pure functions for topic A5 (rigid bodies on resilient mounts). SI units, rad/s.
// Builds on src/physics/rigidbody.ts (planarK, bouncePitchK, centreOfRotation, couplings).
import type { C } from '../../physics/complex';
import { cdiv, cmul, csub } from '../../physics/complex';
import type { Mat } from '../../physics/linalg';
import { genSymEig } from '../../physics/linalg';
import { bouncePitchK, centreOfRotation, couplings, planarK, type Mount } from '../../physics/rigidbody';

export interface ModeVec {
  /** Natural frequency (rad/s); 0 for an unrestrained (rigid-body) direction. */
  omega: number;
  omega2: number;
  /** Mass-normalised shape in the coordinate order of K (e.g. x, y, theta). */
  vec: number[];
}

/**
 * Modes of M q'' + K q = 0, solving each group of coupled coordinates on its own (union of
 * |K_ij|, |M_ij| > tol x max diagonal). Decoupled coordinates therefore give exactly pure modes,
 * even when two frequencies coincide. Ascending in omega.
 */
export function blockModes(K: Mat, M: Mat, tol = 1e-6): ModeVec[] {
  const n = K.length;
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const join = (i: number, j: number) => {
    parent[find(i)] = find(j);
  };
  for (const [i, j] of couplings(K, tol)) join(i, j);
  for (const [i, j] of couplings(M, tol)) join(i, j);
  const groups = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    groups.set(r, [...(groups.get(r) || []), i]);
  }
  const out: ModeVec[] = [];
  for (const idx of groups.values()) {
    const subK = idx.map((i) => idx.map((j) => K[i][j]));
    const subM = idx.map((i) => idx.map((j) => M[i][j]));
    const { omega2, modes } = genSymEig(subK, subM);
    for (let c = 0; c < idx.length; c++) {
      const vec = new Array<number>(n).fill(0);
      idx.forEach((i, r) => (vec[i] = modes[r][c]));
      const w2 = Math.max(0, omega2[c]);
      out.push({ omega: Math.sqrt(w2), omega2: w2, vec });
    }
  }
  return out.sort((a, b) => a.omega2 - b.omega2);
}

/** Planar modes (x, y, theta) of a body of mass m and inertia I about G on the given mounts. */
export function planarModes(mounts: Mount[], m: number, I: number): { K: Mat; M: Mat; modes: ModeVec[] } {
  const K = planarK(mounts);
  const M = [
    [m, 0, 0],
    [0, m, 0],
    [0, 0, I],
  ];
  return { K, M, modes: blockModes(K, M) };
}

/** Kinetic-energy fractions [x, y, theta] of a planar mode shape (X, Y, Theta) with M = diag(m, m, I). */
export function energySplit(vec: number[], m: number, I: number): [number, number, number] {
  const e = [m * vec[0] * vec[0], m * vec[1] * vec[1], I * vec[2] * vec[2]];
  const s = e[0] + e[1] + e[2] || 1;
  return [e[0] / s, e[1] / s, e[2] / s];
}

/** Centre of rotation (m, relative to G) of a planar mode, or null when it is effectively a pure translation (farther than `far`). */
export function modeCentre(vec: number[], far = 1e3): { x: number; y: number } | null {
  const c = centreOfRotation(vec[0], vec[1], vec[2]);
  if (!Number.isFinite(c.x) || !Number.isFinite(c.y) || Math.hypot(c.x, c.y) > far) return null;
  return c;
}

/** Horizontal-stiffness height ybar = sum kx_i y_i / sum kx_i (Kx_theta = -sum kx * ybar) and vertical-stiffness centre xbar = sum ky_i x_i / sum ky_i (Ky_theta = sum ky * xbar). NaN when there is no stiffness in that direction. */
export function stiffnessCentres(mounts: Mount[]): { xbar: number; ybar: number; sumKx: number; sumKy: number } {
  let sx = 0;
  let sy = 0;
  let mx = 0;
  let my = 0;
  for (const mt of mounts) {
    sx += mt.kx;
    sy += mt.ky;
    mx += mt.kx * mt.y;
    my += mt.ky * mt.x;
  }
  return { xbar: sy > 0 ? my / sy : NaN, ybar: sx > 0 ? mx / sx : NaN, sumKx: sx, sumKy: sy };
}

/** Re-express M and K in coordinates (x_O, y, theta) measured at a point O a height h below G: x = x_O - h theta. Coupling moves between K and M; the frequencies do not change (LA7 §7.2.1, official 2018 A1.4). */
export function shiftOrigin(K: Mat, M: Mat, h: number): { K: Mat; M: Mat } {
  const T = [
    [1, 0, -h],
    [0, 1, 0],
    [0, 0, 1],
  ];
  const tr = (A: Mat) => {
    const out: Mat = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ];
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++) {
        let s = 0;
        for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) s += T[a][i] * A[a][b] * T[b][j];
        out[i][j] = s;
      }
    return out;
  };
  return { K: tr(K), M: tr(M) };
}

/** LA7 Eq 7.6-7.7: the two values of (omega_n rho / (omega_y b))^2 with S = (kx/ky)(rho/b)^2 and T = (a/rho)^2 (T is NOT transmissibility). Ascending. */
export function eq76(S: number, T: number): [number, number] {
  const A = 1 + S * (1 + T);
  const disc = Math.sqrt(Math.max(0, A * A - 4 * S));
  return [(A - disc) / 2, (A + disc) / 2];
}

/** LA7 Eq 7.8-7.9: the two values of (omega_n/omega_y)^2 for a uniform body with springs at its four lower corners, U = kx/ky, V = 1 + (a/b)^2 (a = CoM height above the springs, b = half spacing). Ascending. */
export function eq78(U: number, V: number): [number, number] {
  const A = 4 * U + (3 * (1 - U)) / V;
  const disc = Math.sqrt(Math.max(0, A * A - (12 * U) / V));
  return [(A - disc) / 2, (A + disc) / 2];
}

/**
 * Centre of rotation of a coupled sway–rock mode of the LA7 Eq 7.8 body (uniform, springs at the four lower
 * corners), as a height above the spring plane in units of b: h/b = (a/b) r²/(r² − U), with r = ω/ωy and
 * U = kx/ky (row 1 of LA7 Eq 7.4, origin at spring level: x/α = a r²/(r² − U)). At a = 0 the pair separates:
 * pure sway (r² = U, no centre: Infinity) and pure rock about G, which then lies on the spring plane (0).
 */
export function eq78Centre(U: number, ab: number, r: number): number {
  const d = r * r - U;
  if (ab < 1e-9) return Math.abs(d) < 1e-6 ? Infinity : 0;
  return Math.abs(d) < 1e-12 ? Infinity : (ab * r * r) / d;
}

export interface BouncePitch {
  K: Mat;
  M: Mat;
  /** rad/s, ascending. */
  omega: [number, number];
  /** Mode shapes (Z, Theta), mass-normalised. */
  shapes: [number[], number[]];
  /** Node positions x = -Z/Theta measured rearwards (towards +b) from G (m); Infinity for pure bounce. */
  nodes: [number, number];
}

/** Bounce z / pitch theta of a body (m, I about G) on spring k1 at x = -a (front) and k2 at x = +b (rear); theta anticlockwise lifts the rear (summary notes A3, LA4 §4.2, 2021 A1.5). */
export function bouncePitchModes(m: number, I: number, k1: number, a: number, k2: number, b: number): BouncePitch {
  const K = bouncePitchK(k1, a, k2, b);
  const M = [
    [m, 0],
    [0, I],
  ];
  const md = blockModes(K, M);
  const node = (v: number[]) => (Math.abs(v[1]) < 1e-12 * Math.max(1, Math.abs(v[0])) ? Infinity : -v[0] / v[1]);
  return {
    K,
    M,
    omega: [md[0].omega, md[1].omega],
    shapes: [md[0].vec, md[1].vec],
    nodes: [node(md[0].vec), node(md[1].vec)],
  };
}

/** Mounts of the 2025 A2 range hood (top view): three wall mounts at (-d, +s), (-d, 0), (-d, -s) from G, each kx (axial, x) and ky (transverse, y). */
export function rangehoodMounts(kx: number, ky: number, s: number, d: number): Mount[] {
  return [
    { x: -d, y: s, kx, ky },
    { x: -d, y: 0, kx, ky },
    { x: -d, y: -s, kx, ky },
  ];
}

/** Complex solution of a 2x2 system A z = b. */
export function csolve2(A: [[C, C], [C, C]], b: [C, C]): [C, C] {
  const det = csub(cmul(A[0][0], A[1][1]), cmul(A[0][1], A[1][0]));
  const z0 = cdiv(csub(cmul(A[1][1], b[0]), cmul(A[0][1], b[1])), det);
  const z1 = cdiv(csub(cmul(A[0][0], b[1]), cmul(A[1][0], b[0])), det);
  return [z0, z1];
}

/**
 * Steady-state complex amplitudes of a 2-DoF system (K - W^2 M + i W C) q = F with a 2x2 damping
 * matrix C (pass zeros for undamped). F may be complex (e.g. a moving base acts through springs and dampers).
 */
export function response2(K: Mat, M: Mat, Cd: Mat, F: [C, C], W: number): [C, C] {
  const A = [0, 1].map((i) => [0, 1].map((j) => ({ re: K[i][j] - W * W * M[i][j], im: W * Cd[i][j] }))) as [[C, C], [C, C]];
  return csolve2(A, F);
}

/** Modal damping matrix C = M P diag(2 zeta omega_i) P^T M for mass-normalised modes P (every mode gets the same zeta). */
export function modalDamping(K: Mat, M: Mat, zeta: number): Mat {
  const md = blockModes(K, M);
  const n = K.length;
  const Cd: Mat = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (const mode of md) {
    const Mv = M.map((row) => row.reduce((t, x, j) => t + x * mode.vec[j], 0));
    const c = 2 * zeta * mode.omega;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) Cd[i][j] += c * Mv[i] * Mv[j];
  }
  return Cd;
}

export type { Mount };
