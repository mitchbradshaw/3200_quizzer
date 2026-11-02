// Damped multi-DoF systems M x'' + C x' + K x = 0 and complex modes (summary notes A6; LA9).
// Eigenvalues s solve det(M s^2 + C s + K) = 0; each comes with X (the null vector of
// M s^2 + C s + K) and V = s X, i.e. one column [X; V] of MATLAB's [P, D] = eig(A).
import type { C } from './complex';
import { cabs, carg, cconj, cinv, cmul, csub, cadd } from './complex';
import type { CMat, Mat } from './linalg';
import { cmatInv, cNullVector, inv, matMul, zeros } from './linalg';
import { polyMatDet, polyRoots } from './poly';

/** First-order state matrix A = [[0, I], [-M^-1 K, -M^-1 C]], d/dt [X; V] = A [X; V] (LA9 Eq 9.12). */
export function stateMatrix(M: Mat, C: Mat, K: Mat): Mat {
  const n = M.length;
  const Mi = inv(M);
  const MK = matMul(Mi, K);
  const MC = matMul(Mi, C);
  const A = zeros(2 * n, 2 * n);
  for (let i = 0; i < n; i++) {
    A[i][n + i] = 1;
    for (let j = 0; j < n; j++) {
      A[n + i][j] = -MK[i][j];
      A[n + i][n + j] = -MC[i][j];
    }
  }
  return A;
}

/** One damped mode: eigenvalue s, its wn, wd, zeta, and the eigenvector halves X and V = s X. */
export interface DampedMode {
  s: C;
  wn: number;
  wd: number;
  zeta: number;
  X: C[];
  V: C[];
}

/** wn = |s|, wd = |Im s|, zeta = -Re s/|s| for s = -zeta wn +/- i wd (LA9 Eq 9.9, §9.2.1); a single real root gives zeta = 1, s = 0 gives zeta = 0. */
export function fromEigenvalue(s: C): { wn: number; wd: number; zeta: number } {
  const wn = cabs(s);
  return { wn, wd: Math.abs(s.im), zeta: wn > 0 ? -s.re / wn : 0 };
}

/** Overdamped mode from its two real roots: wn = sqrt(s1 s2), zeta = -(s1 + s2)/(2 wn) (LA1, LA9 Eq 9.15). */
export function fromRealPair(s1: number, s2: number): { wn: number; zeta: number } {
  const wn = Math.sqrt(s1 * s2);
  return { wn, zeta: wn > 0 ? -(s1 + s2) / (2 * wn) : 0 };
}

/** Quadratic matrix A(s) = M s^2 + C s + K. */
function quadMat(M: Mat, C: Mat, K: Mat, s: C): CMat {
  const s2 = cmul(s, s);
  return M.map((row, i) =>
    row.map((m, j) => ({
      re: m * s2.re + C[i][j] * s.re + K[i][j],
      im: m * s2.im + C[i][j] * s.im,
    }))
  );
}

/** Newton polish of a root of det A(s): f'/f = tr(A^-1 A'), A' = 2 M s + C; small, bounded steps only. */
function polishEigenvalue(M: Mat, C: Mat, K: Mat, s0: C): C {
  let s = s0;
  const n = M.length;
  for (let it = 0; it < 4; it++) {
    const Ai = cmatInv(quadMat(M, C, K, s));
    let tr: C = { re: 0, im: 0 };
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const d: C = { re: 2 * M[j][i] * s.re + C[j][i], im: 2 * M[j][i] * s.im };
        tr = cadd(tr, cmul(Ai[i][j], d));
      }
    }
    if (!Number.isFinite(tr.re) || !Number.isFinite(tr.im) || (tr.re === 0 && tr.im === 0)) break;
    const step = cinv(tr);
    const size = cabs(step);
    if (!(size <= 1e-6 * cabs(s))) break; // a large move means this is not a refinement: keep s
    s = csub(s, step);
    if (size <= 1e-15 * cabs(s)) break;
  }
  return s;
}

function makeMode(M: Mat, C: Mat, K: Mat, s: C): DampedMode {
  const X = cNullVector(quadMat(M, C, K, s));
  return { s, ...fromEigenvalue(s), X, V: X.map((x) => cmul(s, x)) };
}

const conjMode = (m: DampedMode): DampedMode => ({
  s: cconj(m.s),
  wn: m.wn,
  wd: m.wd,
  zeta: m.zeta,
  X: m.X.map(cconj),
  V: m.V.map(cconj),
});

/** All 2n eigenvalues of det(M s^2 + C s + K) = 0 (polyRoots, Newton-polished on the determinant), each with X = null vector of M s^2 + C s + K (largest |X_i| = 1) and V = s X; conjugate pairs adjacent (+imag first), otherwise unsorted (LA9 Eqs 9.12-9.14). */
export function dampedModes(M: Mat, C: Mat, K: Mat): DampedMode[] {
  const entries = M.map((row, i) => row.map((m, j) => [K[i][j], C[i][j], m]));
  const roots = polyRoots(polyMatDet(entries));
  const out: DampedMode[] = [];
  for (const r of roots) {
    if (r.im < 0) continue; // emitted as the conjugate of its partner
    const s = polishEigenvalue(M, C, K, r);
    const mode = makeMode(M, C, K, r.im === 0 ? { re: s.re, im: 0 } : s);
    out.push(mode);
    if (r.im > 0) out.push(conjMode(mode));
  }
  return out;
}

/** One entry per oscillatory pair (Im s > 0) plus each real (overdamped or rigid-body) root, sorted by |s| = wn (summary notes trap 6). */
export function dampedModesSorted(M: Mat, C: Mat, K: Mat): DampedMode[] {
  return dampedModes(M, C, K)
    .filter((m) => m.s.im >= 0)
    .sort((a, b) => a.wn - b.wn);
}

/** Reads a list of eigenvalues (e.g. MATLAB's diag(D)): one entry per conjugate pair (taken with Im s > 0) or real root, sorted by |s| (summary notes A6 traps). */
export function sortEigenvalues(eigs: C[]): { s: C; wn: number; wd: number; zeta: number }[] {
  const seen: C[] = [];
  const out: { s: C; wn: number; wd: number; zeta: number }[] = [];
  for (const e of eigs) {
    const s = e.im < 0 ? cconj(e) : e;
    if (s.im > 0) {
      // drop the second member of a pair already listed
      const k = seen.findIndex((t) => cabs(csub(t, s)) <= 1e-9 * Math.max(cabs(s), 1e-300));
      if (k >= 0) {
        seen.splice(k, 1);
        continue;
      }
      seen.push(s);
    }
    out.push({ s, ...fromEigenvalue(s) });
  }
  return out.sort((a, b) => a.wn - b.wn);
}

/** Modal damping of Rayleigh damping C = alpha M + beta K: zeta = alpha/(2 w) + beta w/2 (LA9 Eq 9.7). */
export function rayleighZeta(alpha: number, beta: number, w: number): number {
  return alpha / (2 * w) + (beta * w) / 2;
}

/** Rayleigh coefficients giving zeta1 at w1 and zeta2 at w2 from alpha + beta w_i^2 = 2 zeta_i w_i (LA9 Eq 9.7). */
export function rayleighCoefficients(zeta1: number, w1: number, zeta2: number, w2: number): { alpha: number; beta: number } {
  const d = w2 * w2 - w1 * w1;
  const beta = (2 * (zeta2 * w2 - zeta1 * w1)) / d;
  const alpha = (2 * w1 * w2 * (zeta1 * w2 - zeta2 * w1)) / d;
  return { alpha, beta };
}

/** Complex mode-shape ratio X_j/X_i as magnitude and phase in degrees (-180, 180]; |phase| near 0 = in phase, near 180 = out of phase (LA9 §9.2.1). */
export function modeRatio(X: C[], i: number, j: number): { mag: number; phaseDeg: number } {
  const xi = X[i];
  const xj = X[j];
  // X_j/X_i via X_j conj(X_i)/|X_i|^2: the phase needs only the numerator.
  const num = cmul(xj, cconj(xi));
  return { mag: cabs(xj) / cabs(xi), phaseDeg: (carg(num) * 180) / Math.PI };
}
