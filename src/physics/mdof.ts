// Undamped multi-DoF systems M x'' + K x = F (summary notes A3-A4; LA3-LA6, LA8): natural
// frequencies, mode shapes, modal coordinates X = P Y, receptances and anti-resonances.
import type { C } from './complex';
import type { CMat, Mat, Vec } from './linalg';
import {
  cmatInv,
  cmatSolve,
  det,
  genSymEig,
  inv,
  matMul,
  matScale,
  matSub,
  matVec,
  normaliseColumns,
  solve,
  transpose,
} from './linalg';
import { polyMatDet, polyRoots } from './poly';
import { sinOver } from './sdof';

/** Natural frequencies (ascending) and modes of (K - w^2 M) A = 0: P normalised 'first' (course style P = [1 1; r1 r2]) or 'max', Pm mass-normalised (Pm^T M Pm = I); w = NaN for w^2 < 0; throws if M is not positive definite (LA3 Eq 3.9, LA5). */
export function modes(
  K: Mat,
  M: Mat,
  normalise: 'first' | 'max' = 'first'
): { omega: number[]; omega2: number[]; P: Mat; Pm: Mat } {
  const { omega2, modes: phi } = genSymEig(K, M);
  const P = normaliseColumns(phi, normalise);
  const n = P.length;
  const Pm = P.map((row) => row.slice());
  for (let j = 0; j < omega2.length; j++) {
    let mj = 0; // modal mass P_j^T M P_j
    for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) mj += P[a][j] * M[a][b] * P[b][j];
    const s = 1 / Math.sqrt(mj);
    for (let a = 0; a < n; a++) Pm[a][j] = P[a][j] * s;
  }
  const omega = omega2.map((w2) => (w2 >= 0 ? Math.sqrt(w2) : NaN));
  return { omega, omega2, P, Pm };
}

/** Modal (generalised) mass and stiffness M* = P^T M P, K* = P^T K P; diagonal by orthogonality, w_i^2 = k*_i/m*_i (LA5). */
export function modalMatrices(P: Mat, M: Mat, K: Mat): { Mstar: Mat; Kstar: Mat } {
  const Pt = transpose(P);
  return { Mstar: matMul(Pt, matMul(M, P)), Kstar: matMul(Pt, matMul(K, P)) };
}

/** Frequency determinant det(K - w^2 M); zero at each natural frequency (LA3 Eq 3.9). */
export function detKM(K: Mat, M: Mat, w2: number): number {
  return det(matSub(K, matScale(M, w2)));
}

/** Ascending coefficients in lambda = w^2 of det(K - lambda M), e.g. [1, -3, 1] for K = [2 -1; -1 1], M = I (LA3). */
export function charPoly(K: Mat, M: Mat): number[] {
  return polyMatDet(K.map((row, i) => row.map((k, j) => [k, -M[i][j]])));
}

/** 2-DoF mode ratio r = A2/A1 = -(k11 - w2 m11)/(k12 - w2 m12) from row 1, else row 2 -(k21 - w2 m21)/(k22 - w2 m22); Infinity for a pure coordinate-2 mode (summary notes A3). */
export function modeRatio2(K: Mat, M: Mat, w2: number): number {
  const a = K[0][0] - w2 * M[0][0];
  const b = K[0][1] - w2 * M[0][1];
  const c = K[1][0] - w2 * M[1][0];
  const d = K[1][1] - w2 * M[1][1];
  let scale = 0;
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) scale = Math.max(scale, Math.abs(K[i][j]), Math.abs(w2 * M[i][j]));
  const tol = 1e-12 * scale;
  if (Math.abs(b) > tol) return -a / b;
  if (Math.abs(d) > tol) return -c / d;
  // Both coupling denominators vanish: A1 = 0 unless the whole matrix is zero (repeated root).
  return Math.abs(a) > tol || Math.abs(c) > tol ? Infinity : NaN;
}

/** Modal initial conditions Y0 = P^-1 X0 and Ydot0 = P^-1 V0 (NOT P^T; summary notes trap 3, LA5 Eq 5.28). */
export function modalInitialConditions(P: Mat, x0: Vec, v0: Vec): { y0: Vec; yd0: Vec } {
  return { y0: solve(P, x0), yd0: solve(P, v0) };
}

/** Free response X(t) = sum_i P_i [y0_i cos(w_i t) + yd0_i sin(w_i t)/w_i]; a w = 0 rigid-body mode gives y0 + yd0 t (summary notes A3). */
export function modalFreeResponse(P: Mat, omega: number[], y0: Vec, yd0: Vec, t: number): Vec {
  const n = P.length;
  const x = new Array<number>(n).fill(0);
  for (let i = 0; i < omega.length; i++) {
    const w = omega[i];
    const yi = y0[i] * Math.cos(w * t) + yd0[i] * sinOver(w, t);
    for (let r = 0; r < n; r++) x[r] += P[r][i] * yi;
  }
  return x;
}

/** Modal forces P^T F (summary notes A3). */
export function modalForces(P: Mat, F: Vec): Vec {
  return matVec(transpose(P), F);
}

/** Uncoupled frequencies sqrt(K_ii/M_ii) of each coordinate alone (others held fixed); coupled pairs straddle them (summary notes A5). */
export function uncoupledFrequencies(K: Mat, M: Mat): number[] {
  return K.map((row, i) => {
    const w2 = row[i] / M[i][i];
    return w2 >= 0 ? Math.sqrt(w2) : NaN;
  });
}

function dynamicStiffness(K: Mat, M: Mat, Omega: number, Cdamp?: Mat): CMat {
  const W2 = Omega * Omega;
  return K.map((row, i) => row.map((k, j) => ({ re: k - W2 * M[i][j], im: Cdamp ? Omega * Cdamp[i][j] : 0 })));
}

/** Complex receptance matrix alpha(Omega) = (K - Omega^2 M + i Omega C)^-1 (C optional) (LA6 Eq 6.7, LA6 §6.6). */
export function receptance(K: Mat, M: Mat, Omega: number, Cdamp?: Mat): CMat {
  return cmatInv(dynamicStiffness(K, M, Omega, Cdamp));
}

/** Undamped receptances alpha_ij = [(K - Omega^2 M)^-1]_ij (LA6 Eqs 6.10-6.13). */
export function receptanceUndamped(K: Mat, M: Mat, Omega: number): Mat {
  return inv(matSub(K, matScale(M, Omega * Omega)));
}

/** Steady-state complex amplitudes X = (K - Omega^2 M + i Omega C)^-1 F for forces F e^{i Omega t} (LA6 Eq 6.7). */
export function harmonicResponse(K: Mat, M: Mat, F: Vec, Omega: number, Cdamp?: Mat): C[] {
  return cmatSolve(
    dynamicStiffness(K, M, Omega, Cdamp),
    F.map((f) => ({ re: f, im: 0 }))
  );
}

/** 2-DoF driving-point anti-resonance of coordinate j (0-based): alpha_jj = 0 at sqrt(k_oo/m_oo) of the other coordinate o, i.e. the natural frequency with j held fixed (chain: sqrt(k2/m2) for j = 0, sqrt((k1+k2)/m1) for j = 1; summary notes A4). */
export function antiresonance2(K: Mat, M: Mat, j: number): number {
  const o = j === 0 ? 1 : 0;
  const w2 = K[o][o] / M[o][o];
  return w2 >= 0 ? Math.sqrt(w2) : NaN;
}

/** n-DoF driving-point anti-resonances of coordinate j: natural frequencies (rad/s, ascending) of the system with coordinate j held fixed (summary notes A4). */
export function antiresonances(K: Mat, M: Mat, j: number): number[] {
  const keep = K.map((_, i) => i).filter((i) => i !== j);
  if (!keep.length) return [];
  const Kr = keep.map((a) => keep.map((b) => K[a][b]));
  const Mr = keep.map((a) => keep.map((b) => M[a][b]));
  return genSymEig(Kr, Mr).omega2.filter((w2) => w2 > 0).map(Math.sqrt);
}

/** Forcing frequencies (rad/s, ascending) where X_i = Delta_i/Delta vanishes for force pattern F: positive real roots of Delta_i(w^2), the determinant of K - w^2 M with column i replaced by F (summary notes A4). */
export function suppressionFrequencies(K: Mat, M: Mat, F: Vec, i: number): number[] {
  const entries = K.map((row, a) => row.map((k, b) => (b === i ? [F[a]] : [k, -M[a][b]])));
  const num = polyMatDet(entries);
  if (num.every((v) => v === 0)) return [];
  return polyRoots(num)
    .filter((z) => z.re > 0 && Math.abs(z.im) <= 1e-7 * Math.abs(z.re))
    .map((z) => Math.sqrt(z.re))
    .sort((a, b) => a - b);
}
