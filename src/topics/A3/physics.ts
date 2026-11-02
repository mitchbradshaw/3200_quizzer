// Extra pure helpers for A3 (2-DoF modes and modal analysis), built on src/physics/mdof.
// SI units, rad/s. Ratios follow the course convention r = A2/A1 (LA3 Eq 3.13, summary notes A3).
import type { Mat, Vec } from '../../physics/linalg';
import { genSymEig } from '../../physics/linalg';
import { modes } from '../../physics/mdof';

/** Chain ground–k1–m1–k2–m2–k3–ground: M = diag(m1, m2), K = [k1+k2, −k2; −k2, k2+k3] (LA3 Eqs 3.1–3.2). k3 = 0 leaves m2 free. */
export function chainKM(m1: number, m2: number, k1: number, k2: number, k3 = 0): { M: Mat; K: Mat } {
  return {
    M: [
      [m1, 0],
      [0, m2],
    ],
    K: [
      [k1 + k2, -k2],
      [-k2, k2 + k3],
    ],
  };
}

export interface TwoDof {
  /** Natural frequencies, ascending (rad/s); 0 for a rigid-body mode. */
  omega: [number, number];
  omega2: [number, number];
  /** Mode-shape ratios r_i = A2/A1 (Infinity when the mode has A1 = 0). */
  r: [number, number];
  /** Course-normalised modal matrix P = [1 1; r1 r2] (columns = modes, mode 1 first). */
  P: Mat;
}

/** Frequencies and course-normalised modes of a 2-DoF system (LA3 Eqs 3.9–3.15). */
export function twoDof(K: Mat, M: Mat): TwoDof {
  const res = modes(K, M, 'first');
  const P = res.P;
  const ratio = (j: number) => (P[0][j] === 0 ? Infinity : P[1][j] / P[0][j]);
  const w = res.omega.map((x) => (Number.isFinite(x) ? x : 0));
  return { omega: [w[0], w[1]], omega2: [Math.max(0, res.omega2[0]), res.omega2[1]], r: [ratio(0), ratio(1)], P };
}

/** det(K − λM) = aλ² − bλ + c for 2 DoF: a = det M, b = k11 m22 + k22 m11 − 2 k12 m12, c = det K (summary notes A3). */
export function quadCoeffs(K: Mat, M: Mat): { a: number; b: number; c: number } {
  const a = M[0][0] * M[1][1] - M[0][1] * M[1][0];
  const b = K[0][0] * M[1][1] + K[1][1] * M[0][0] - K[0][1] * M[1][0] - K[1][0] * M[0][1];
  const c = K[0][0] * K[1][1] - K[0][1] * K[1][0];
  return { a, b, c };
}

/** Value of det(K − λM) for a 2-DoF system. */
export function det2(K: Mat, M: Mat, lam: number): number {
  const { a, b, c } = quadCoeffs(K, M);
  return a * lam * lam - b * lam + c;
}

/** Mode ratio A2/A1 that row 1 and row 2 of (K − λM)A = 0 would each give at a trial λ; they agree only at a root (summary notes A3). */
export function rowRatios(K: Mat, M: Mat, lam: number): { row1: number; row2: number } {
  const row1 = -(K[0][0] - lam * M[0][0]) / (K[0][1] - lam * M[0][1]);
  const row2 = -(K[1][0] - lam * M[1][0]) / (K[1][1] - lam * M[1][1]);
  return { row1, row2 };
}

/** Inverse of a 2×2 matrix, [a b; c d]^-1 = [d −b; −c a]/(ad − bc) (LA5-7 p37). */
export function inv2(A: Mat): Mat {
  const d = A[0][0] * A[1][1] - A[0][1] * A[1][0];
  return [
    [A[1][1] / d, -A[0][1] / d],
    [-A[1][0] / d, A[0][0] / d],
  ];
}

/** y = A x for small matrices. */
export function mul(A: Mat, x: Vec): Vec {
  return A.map((row) => row.reduce((s, v, j) => s + v * x[j], 0));
}

/** y = Aᵀ x. */
export function mulT(A: Mat, x: Vec): Vec {
  return A[0].map((_, j) => A.reduce((s, row, i) => s + row[j] * x[i], 0));
}

/** Quadratic form uᵀ A v. */
export function quad(u: Vec, A: Mat, v: Vec): number {
  let s = 0;
  for (let i = 0; i < u.length; i++) for (let j = 0; j < v.length; j++) s += u[i] * A[i][j] * v[j];
  return s;
}

/** Fixed–free N-DoF chain: ground–k[0]–m[0]–k[1]–m[1]–…–m[N−1] (top mass free), as in 2023 A1.3. */
export function chainN(m: number[], k: number[]): { M: Mat; K: Mat } {
  const n = m.length;
  const M = m.map((mi, i) => m.map((_, j) => (i === j ? mi : 0)));
  const K: Mat = m.map(() => new Array<number>(n).fill(0));
  for (let i = 0; i < n; i++) {
    K[i][i] += k[i];
    if (i > 0) {
      K[i - 1][i - 1] += k[i];
      K[i - 1][i] -= k[i];
      K[i][i - 1] -= k[i];
    }
  }
  return { M, K };
}

/**
 * Mode table as printed in 2023 A1.3: frequencies in Hz (ascending) and each mode as a row of unit Euclidean length
 * (the MATLAB eig convention). `signs` flips individual modes (scale and sign are arbitrary).
 */
export function modeTable(M: Mat, K: Mat, signs?: number[]): { f: number[]; omega: number[]; rows: number[][] } {
  const { omega2, modes: phi } = genSymEig(K, M);
  const n = M.length;
  const rows: number[][] = [];
  for (let j = 0; j < n; j++) {
    const col = phi.map((r) => r[j]);
    const len = Math.hypot(...col);
    const s = signs ? signs[j] : 1;
    rows.push(col.map((v) => (s * v) / len));
  }
  const omega = omega2.map((w2) => Math.sqrt(Math.max(0, w2)));
  return { f: omega.map((w) => w / (2 * Math.PI)), omega, rows };
}

/** Modal content of a free response: C_i = sqrt(y_i0² + (ẏ_i0/ω_i)²), the amplitude of each modal coordinate (LA5 Eq 5.26). */
export function modalAmplitudes(y0: Vec, yd0: Vec, omega: number[]): number[] {
  return y0.map((y, i) => (omega[i] > 0 ? Math.hypot(y, yd0[i] / omega[i]) : Math.hypot(y, yd0[i])));
}
