// Extra pure functions for B5 (approximate methods) and B6 (the B2 design problem).
// Everything is dimensionless unless stated: beam length L = 1, EI = 1, rhoA = 1, so a beam
// frequency comes out in units of sqrt(EI/(rhoA L^4)) and a point mass M is given as M/(rhoA L).
// Shared physics (beams.ts, approx.ts, waves.ts) is used wherever it already has the formula.
import { genSymEig, type Mat } from '../../physics/linalg';
import { brent } from '../../physics/roots';
import { betaL, modeShape, type BeamBC } from '../../physics/beams';
import { cantileverStiffnessAt, clampedStiffnessAt, holzerRoots, pinnedStiffnessAt } from '../../physics/approx';

// ---------------------------------------------------------------------------------------------
// Finite-element Euler–Bernoulli beam (Hermite cubic elements, LB9). Used for "exact" reference
// values of beams carrying point masses, and to show mesh convergence.
// ---------------------------------------------------------------------------------------------

export type FEEnd = 'clamped' | 'pinned' | 'free';

export interface FEBeamOpts {
  left: FEEnd;
  right: FEEnd;
  /** Number of equal elements before mass positions are inserted as extra nodes. */
  nel: number;
  /** Point masses: x as a fraction of L, M as a fraction of the beam mass rhoA L. */
  masses?: { x: number; M: number }[];
  /** Lumped (diagonal, translation-only) mass matrix instead of the consistent one. */
  lumped?: boolean;
  /** Rotational spring at x = 0 (units EI/L) replacing the slope constraint of a clamped left end. */
  rootSpring?: number;
  /** Modes returned (default 4). */
  nModes?: number;
  /** Also compute the mode shapes (default true; feBeam only). Frequencies alone are cheaper. */
  shapes?: boolean;
}

export interface FEBeamResult {
  /** Natural frequencies in units of sqrt(EI/(rhoA L^4)), ascending (rigid-body modes give 0). */
  omega: number[];
  /** Node positions (fractions of L). */
  nodes: number[];
  /** Full DOF vectors [w0, th0, w1, th1, ...] per returned mode (constrained DOFs are 0); empty when shapes: false. */
  dof: number[][];
}

/**
 * Equal elements plus a node at every mass. A mass within 0.3 of an element of an interior grid node
 * moves that node onto it instead of adding a sliver element: slivers make K and M so badly
 * conditioned that a dense eigen-solve loses the low modes (it returned 0 for some mass positions).
 */
function meshNodes(nel: number, extra: number[]): number[] {
  const grid = Array.from({ length: nel + 1 }, (_, i) => i / nel);
  const moved = new Set<number>();
  const pts: number[] = [];
  for (const x of extra) {
    if (!(x > 0 && x < 1)) continue;
    const i = Math.round(x * nel);
    if (i > 0 && i < nel && !moved.has(i) && Math.abs(x - i / nel) < 0.3 / nel) {
      grid[i] = x;
      moved.add(i);
    } else pts.push(x);
  }
  const sorted = [...grid, ...pts].sort((a, b) => a - b);
  const out: number[] = [];
  for (const x of sorted) if (!out.length || x - out[out.length - 1] > 1e-6) out.push(x);
  if (out[out.length - 1] !== 1) out[out.length - 1] = 1;
  return out;
}

interface FEAssembly {
  nodes: number[];
  ndof: number;
  K: Mat;
  M: Mat;
  /** Unconstrained DOFs, ascending. */
  free: number[];
}

/** Global K and M of the Hermite-element beam (DOFs [w0, th0, w1, th1, ...]), with the supports applied as a list of free DOFs. */
function assembleFE(o: FEBeamOpts): FEAssembly {
  const masses = (o.masses ?? []).filter((m) => m.M > 0);
  const nodes = meshNodes(Math.max(1, Math.round(o.nel)), masses.map((m) => m.x));
  const nn = nodes.length;
  const ndof = 2 * nn;
  const K: Mat = Array.from({ length: ndof }, () => new Array<number>(ndof).fill(0));
  const M: Mat = Array.from({ length: ndof }, () => new Array<number>(ndof).fill(0));
  for (let e = 0; e < nn - 1; e++) {
    const h = nodes[e + 1] - nodes[e];
    const h2 = h * h;
    const k = [
      [12, 6 * h, -12, 6 * h],
      [6 * h, 4 * h2, -6 * h, 2 * h2],
      [-12, -6 * h, 12, -6 * h],
      [6 * h, 2 * h2, -6 * h, 4 * h2],
    ];
    const kf = 1 / (h2 * h);
    const mc = [
      [156, 22 * h, 54, -13 * h],
      [22 * h, 4 * h2, 13 * h, -3 * h2],
      [54, 13 * h, 156, -22 * h],
      [-13 * h, -3 * h2, -22 * h, 4 * h2],
    ];
    const mf = h / 420;
    const idx = [2 * e, 2 * e + 1, 2 * e + 2, 2 * e + 3];
    for (let a = 0; a < 4; a++)
      for (let b = 0; b < 4; b++) {
        K[idx[a]][idx[b]] += kf * k[a][b];
        if (!o.lumped) M[idx[a]][idx[b]] += mf * mc[a][b];
      }
    if (o.lumped) {
      M[2 * e][2 * e] += h / 2;
      M[2 * e + 2][2 * e + 2] += h / 2;
    }
  }
  for (const m of masses) {
    let best = 0;
    for (let i = 1; i < nn; i++) if (Math.abs(nodes[i] - m.x) < Math.abs(nodes[best] - m.x)) best = i;
    M[2 * best][2 * best] += m.M;
  }
  const fixed = new Set<number>();
  const fix = (end: FEEnd, node: number, isLeft: boolean) => {
    if (end === 'clamped') {
      fixed.add(2 * node);
      if (!(isLeft && o.rootSpring !== undefined && Number.isFinite(o.rootSpring))) fixed.add(2 * node + 1);
    } else if (end === 'pinned') fixed.add(2 * node);
  };
  fix(o.left, 0, true);
  fix(o.right, nn - 1, false);
  if (o.left === 'clamped' && o.rootSpring !== undefined && Number.isFinite(o.rootSpring)) K[1][1] += o.rootSpring;
  const free = [...Array(ndof).keys()].filter((i) => !fixed.has(i));
  return { nodes, ndof, K, M, free };
}

/**
 * Natural frequencies of a uniform Euler–Bernoulli beam with point masses by FE (L = EI = rhoA = 1).
 * Consistent mass converges from above; lumped mass usually from below. Supported beams (no rigid-body
 * mode) use the banded Sturm-bisection solver below; free ends fall back to the dense solve.
 */
export function feBeam(o: FEBeamOpts): FEBeamResult {
  return supportsAreRigid(o) ? feLowest(o) : feBeamDense(o);
}

/** The same FE model solved densely for every mode (Cholesky + Jacobi, then the first nModes kept). Reference for the self-tests; handles rigid-body modes. */
export function feBeamDense(o: FEBeamOpts): FEBeamResult {
  const { nodes, ndof, K, M, free } = assembleFE(o);
  const nModes = o.nModes ?? 4;
  let omega2: number[];
  let vecs: number[][]; // full dof vectors per mode
  if (!o.lumped) {
    const Kr = free.map((i) => free.map((j) => K[i][j]));
    const Mr = free.map((i) => free.map((j) => M[i][j]));
    const { omega2: w2, modes } = genSymEig(Kr, Mr);
    omega2 = w2;
    vecs = w2.map((_, c) => {
      const v = new Array<number>(ndof).fill(0);
      free.forEach((d, r) => (v[d] = modes[r][c]));
      return v;
    });
  } else {
    // Static condensation of the massless rotations: Kc = Ktt - Ktr Krr^-1 Krt.
    const t = free.filter((d) => d % 2 === 0);
    const r = free.filter((d) => d % 2 === 1);
    const Krr = r.map((i) => r.map((j) => K[i][j]));
    const Krt = r.map((i) => t.map((j) => K[i][j]));
    const X = solveMany(Krr, Krt); // Krr^-1 Krt
    const Kc = t.map((i) => t.map((j, b) => K[i][j] - r.reduce((s, ri, c) => s + K[i][ri] * X[c][b], 0)));
    const Mc = t.map((i) => t.map((j) => M[i][j]));
    const { omega2: w2, modes } = genSymEig(Kc, Mc);
    omega2 = w2;
    vecs = w2.map((_, c) => {
      const v = new Array<number>(ndof).fill(0);
      t.forEach((d, k) => (v[d] = modes[k][c]));
      r.forEach((d, k) => (v[d] = -X[k].reduce((s, x, b) => s + x * modes[b][c], 0)));
      return v;
    });
  }
  const n = Math.min(nModes, omega2.length);
  return {
    omega: omega2.slice(0, n).map((w) => Math.sqrt(Math.max(0, w))),
    nodes,
    dof: vecs.slice(0, n),
  };
}

/** Solve A X = B (A small and symmetric positive definite) by Gaussian elimination with partial pivoting. */
function solveMany(A: Mat, B: Mat): Mat {
  const n = A.length;
  if (!n) return [];
  const m = B[0]?.length ?? 0;
  const a = A.map((row, i) => [...row, ...B[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let i = c + 1; i < n; i++) if (Math.abs(a[i][c]) > Math.abs(a[p][c])) p = i;
    [a[c], a[p]] = [a[p], a[c]];
    const d = a[c][c];
    for (let i = 0; i < n; i++) {
      if (i === c) continue;
      const f = a[i][c] / d;
      if (f === 0) continue;
      for (let j = c; j < n + m; j++) a[i][j] -= f * a[c][j];
    }
  }
  return a.map((row, i) => row.slice(n).map((x) => x / a[i][i]));
}

// ---------------------------------------------------------------------------------------------
// Lowest modes of a supported beam: the frequencies come from Sturm-sequence bisection on the
// banded K − λM (the number of negative LDLᵀ pivots is the number of eigenvalues below λ), the
// shapes from shifted inverse iteration. Same answers as feBeamDense (checked in the self-tests)
// at about a tenth of the cost, and no "small eigenvalue → 0" clamp, so a heavy mass or a short
// element cannot zero the fundamental.
// ---------------------------------------------------------------------------------------------

/** True when the supports stop every rigid-body motion, so K is positive definite. */
function supportsAreRigid(o: FEBeamOpts): boolean {
  const spring = o.left === 'clamped' && o.rootSpring !== undefined && Number.isFinite(o.rootSpring);
  const leftRot = o.left === 'clamped' && (!spring || (o.rootSpring as number) > 0);
  const leftDefl = o.left !== 'free';
  const rightDefl = o.right !== 'free';
  return (leftDefl && rightDefl) || (leftDefl && leftRot) || (rightDefl && o.right === 'clamped');
}

/** In-place LU with partial pivoting of the dense n×n row-major A (full-row swaps, so the multipliers follow the rows). */
function luFactor(A: Float64Array, n: number, piv: Int32Array): void {
  let norm = 0;
  for (let i = 0; i < n * n; i++) norm = Math.max(norm, Math.abs(A[i]));
  const tiny = 1e-14 * (norm || 1);
  for (let k = 0; k < n; k++) {
    let p = k;
    let big = Math.abs(A[k * n + k]);
    for (let i = k + 1; i < n; i++) {
      const v = Math.abs(A[i * n + k]);
      if (v > big) {
        big = v;
        p = i;
      }
    }
    piv[k] = p;
    if (p !== k)
      for (let j = 0; j < n; j++) {
        const t = A[k * n + j];
        A[k * n + j] = A[p * n + j];
        A[p * n + j] = t;
      }
    if (A[k * n + k] === 0) A[k * n + k] = tiny; // exactly singular shift: any tiny pivot gives the null vector
    const d = A[k * n + k];
    for (let i = k + 1; i < n; i++) {
      const f = (A[i * n + k] /= d);
      if (f !== 0) for (let j = k + 1; j < n; j++) A[i * n + j] -= f * A[k * n + j];
    }
  }
}

/** Solves A x = b in place with the factors from luFactor. */
function luSolve(A: Float64Array, n: number, piv: Int32Array, b: Float64Array): void {
  for (let k = 0; k < n; k++) {
    const p = piv[k];
    if (p !== k) {
      const t = b[k];
      b[k] = b[p];
      b[p] = t;
    }
  }
  for (let i = 0; i < n; i++) {
    let s = b[i];
    for (let j = 0; j < i; j++) s -= A[i * n + j] * b[j];
    b[i] = s;
  }
  for (let i = n - 1; i >= 0; i--) {
    let s = b[i];
    for (let j = i + 1; j < n; j++) s -= A[i * n + j] * b[j];
    b[i] = s / A[i * n + i];
  }
}

/** Lowest nModes of the FE model for a supported beam, in feBeamDense's format and normalisation (M-orthonormal shapes, genSymEig sign convention). */
function feLowest(o: FEBeamOpts): FEBeamResult {
  const { nodes, ndof, K, M, free } = assembleFE(o);
  const n = free.length;
  const Kr = new Float64Array(n * n);
  const Mr = new Float64Array(n * n);
  let band = 0;
  let nFinite = 0;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      Kr[r * n + c] = K[free[r]][free[c]];
      Mr[r * n + c] = M[free[r]][free[c]];
      if (c > r && (Kr[r * n + c] !== 0 || Mr[r * n + c] !== 0)) band = Math.max(band, c - r);
    }
    if (Mr[r * n + r] > 0) nFinite++; // lumped: the massless rotations have no finite eigenvalue
  }
  const want = Math.min(o.nModes ?? 4, o.lumped ? nFinite : n);

  // Sturm count: negative pivots of the LDLᵀ of K − λM, in upper-band storage B[i*bw + (j − i)]
  // (no pivoting, so the band does not fill).
  const bw = band + 1;
  const Kb = new Float64Array(n * bw);
  const Mb = new Float64Array(n * bw);
  for (let i = 0; i < n; i++)
    for (let j = i; j <= Math.min(n - 1, i + band); j++) {
      Kb[i * bw + j - i] = Kr[i * n + j];
      Mb[i * bw + j - i] = Mr[i * n + j];
    }
  const W = new Float64Array(n * bw);
  const below = (lam: number): number => {
    for (let t = 0; t < n * bw; t++) W[t] = Kb[t] - lam * Mb[t];
    let neg = 0;
    for (let k = 0; k < n; k++) {
      const rk = k * bw;
      // An exactly zero pivot means λ is an eigenvalue of a leading block: nudge it (counted as below).
      const d = W[rk] === 0 ? -1e-14 * (Math.abs(Kb[rk]) + Math.abs(lam * Mb[rk]) || 1) : W[rk];
      if (d < 0) neg++;
      const end = Math.min(n - 1, k + band);
      for (let i = k + 1; i <= end; i++) {
        const f = W[rk + i - k] / d;
        if (f === 0) continue;
        const ri = i * bw;
        for (let j = i; j <= end; j++) W[ri + j - i] -= f * W[rk + j - k];
      }
    }
    return neg;
  };
  let hi = 1;
  while (below(hi) < want && hi < 1e300) hi *= 8;
  const lam: number[] = [];
  let lo = 0; // K is positive definite: nothing below 0
  for (let i = 0; i < want; i++) {
    let a = lo;
    let c = hi;
    for (let it = 0; it < 200 && c - a > 1e-14 * c; it++) {
      const mid = 0.5 * (a + c);
      if (mid <= a || mid >= c) break;
      if (below(mid) > i) c = mid;
      else a = mid;
    }
    lam.push(0.5 * (a + c));
    lo = a;
  }
  if (!lam.every(Number.isFinite)) return feBeamDense(o);

  const dof: number[][] = [];
  if (o.shapes !== false) {
    const A = new Float64Array(n * n);
    const piv = new Int32Array(n);
    const x = new Float64Array(n);
    const y = new Float64Array(n);
    const Mx = new Float64Array(n);
    const mulM = (v: Float64Array, out: Float64Array) => {
      for (let i = 0; i < n; i++) {
        let s = 0;
        for (let j = 0; j < n; j++) s += Mr[i * n + j] * v[j];
        out[i] = s;
      }
    };
    let normK = 0;
    let normM = 0;
    for (let i = 0; i < n * n; i++) {
      normK = Math.max(normK, Math.abs(Kr[i]));
      normM = Math.max(normM, Math.abs(Mr[i]));
    }
    const found: Float64Array[] = []; // M-normalised vectors already found (reduced DOFs)
    const signRows = o.lumped ? free.map((d, r) => (d % 2 === 0 ? r : -1)).filter((r) => r >= 0) : free.map((_, r) => r);
    for (let m = 0; m < want; m++) {
      for (let i = 0; i < n * n; i++) A[i] = Kr[i] - lam[m] * Mr[i];
      luFactor(A, n, piv);
      // Earlier modes with (nearly) the same eigenvalue must be projected out, or the iteration finds them again.
      const twins = found.filter((_, j) => Math.abs(lam[j] - lam[m]) <= 1e-6 * lam[m]);
      for (let i = 0; i < n; i++) x[i] = 1 + 0.37 * Math.sin(1.3 * i + 0.5);
      for (let it = 0; it < 3; it++) {
        mulM(x, y);
        luSolve(A, n, piv, y);
        for (const v of twins) {
          mulM(v, Mx);
          let p = 0;
          for (let i = 0; i < n; i++) p += Mx[i] * y[i];
          for (let i = 0; i < n; i++) y[i] -= p * v[i];
        }
        let big = 0;
        for (let i = 0; i < n; i++) big = Math.max(big, Math.abs(y[i]));
        if (!(big > 0) || !Number.isFinite(big)) return feBeamDense(o);
        for (let i = 0; i < n; i++) x[i] = y[i] / big;
      }
      // Accept only a converged eigenpair: scaled residual |Kx − λMx| / ((|K| + λ|M|)|x|) at rounding level.
      mulM(x, Mx);
      let xMx = 0;
      let res = 0;
      for (let i = 0; i < n; i++) {
        xMx += x[i] * Mx[i];
        let kx = 0;
        for (let j = 0; j < n; j++) kx += Kr[i * n + j] * x[j];
        res = Math.max(res, Math.abs(kx - lam[m] * Mx[i]));
      }
      if (!(xMx > 0) || res > 1e-9 * (normK + lam[m] * normM)) return feBeamDense(o);
      const s = 1 / Math.sqrt(xMx);
      // genSymEig's sign convention: the first significant entry of the solved-for vector is positive.
      let big = 0;
      for (const r of signRows) big = Math.max(big, Math.abs(x[r]));
      const first = signRows.find((r) => Math.abs(x[r]) > 1e-9 * big);
      const sign = first !== undefined && x[first] < 0 ? -s : s;
      const unit = Float64Array.from(x, (v) => v * sign);
      found.push(unit);
      const v = new Array<number>(ndof).fill(0);
      free.forEach((d, r) => (v[d] = unit[r]));
      dof.push(v);
    }
  }
  return { omega: lam.map((l) => Math.sqrt(Math.max(0, l))), nodes, dof };
}

/** Deflection at xi along an FE mode (Hermite interpolation of the node values and slopes). */
export function feShapeAt(res: FEBeamResult, mode: number, xi: number): number {
  const { nodes, dof } = res;
  const v = dof[mode];
  let e = 0;
  while (e < nodes.length - 2 && xi > nodes[e + 1]) e++;
  const h = nodes[e + 1] - nodes[e];
  const s = Math.min(1, Math.max(0, (xi - nodes[e]) / h));
  const N1 = 1 - 3 * s * s + 2 * s ** 3;
  const N2 = h * (s - 2 * s * s + s ** 3);
  const N3 = 3 * s * s - 2 * s ** 3;
  const N4 = h * (-s * s + s ** 3);
  return N1 * v[2 * e] + N2 * v[2 * e + 1] + N3 * v[2 * e + 2] + N4 * v[2 * e + 3];
}

/** Curvature d2w/dxi2 at xi along an FE mode (second derivative of the Hermite interpolation; piecewise linear). */
export function feCurvatureAt(res: FEBeamResult, mode: number, xi: number): number {
  const { nodes, dof } = res;
  const v = dof[mode];
  let e = 0;
  while (e < nodes.length - 2 && xi > nodes[e + 1]) e++;
  const h = nodes[e + 1] - nodes[e];
  const s = Math.min(1, Math.max(0, (xi - nodes[e]) / h));
  return ((-6 + 12 * s) * v[2 * e]) / (h * h) + ((-4 + 6 * s) * v[2 * e + 1]) / h + ((6 - 12 * s) * v[2 * e + 2]) / (h * h) + ((-2 + 6 * s) * v[2 * e + 3]) / h;
}

/** n + 1 samples of an FE mode on [0, 1], scaled so the largest |value| is 1 and the value of largest magnitude is positive. */
export function feShapeSamples(res: FEBeamResult, mode: number, n = 120): Float64Array {
  const out = new Float64Array(n + 1);
  let big = 0;
  let at = 0;
  for (let k = 0; k <= n; k++) {
    out[k] = feShapeAt(res, mode, k / n);
    if (Math.abs(out[k]) > big) {
      big = Math.abs(out[k]);
      at = k;
    }
  }
  const s = big > 0 ? (out[at] < 0 ? -1 : 1) / big : 1;
  for (let k = 0; k <= n; k++) out[k] *= s;
  return out;
}

// ---------------------------------------------------------------------------------------------
// Beams with point masses: Dunkerley terms, Rayleigh with the bare mode, exact (FE)
// ---------------------------------------------------------------------------------------------

export type MassBeam = 'cantilever' | 'pinned' | 'clamped';

export const MASS_BEAM_BC: Record<MassBeam, BeamBC> = {
  cantilever: 'clamped-free',
  pinned: 'pinned-pinned',
  clamped: 'clamped-clamped',
};

const FE_ENDS: Record<MassBeam, [FEEnd, FEEnd]> = {
  cantilever: ['clamped', 'free'],
  pinned: ['pinned', 'pinned'],
  clamped: ['clamped', 'clamped'],
};

/** Static stiffness at x (fraction of L) in units of EI/L^3: cantilever 3/x^3, pinned 3/(x^2 (1-x)^2), clamped 3/(x^3 (1-x)^3) (summary notes B5; LB8 Eq 8.2). */
export function pointStiffness(beam: MassBeam, x: number): number {
  if (beam === 'cantilever') return cantileverStiffnessAt(x, 1);
  if (beam === 'pinned') return pinnedStiffnessAt(x, 1, 1);
  return clampedStiffnessAt(x, 1, 1);
}

/** Bare-beam fundamental (beta1 L)^2 in units of sqrt(EI/(rhoA L^4)). */
export const bareOmega1 = (beam: MassBeam): number => betaL(MASS_BEAM_BC[beam], 1)[0] ** 2;

export interface MassEstimates {
  /** Bare beam omega_11. */
  w11: number;
  /** Each mass alone on the massless beam, omega_kk = sqrt(K_k/M_k) (Infinity for M = 0 or a mass at a support). */
  wkk: number[];
  /** Dunkerley term (omega_11/omega_kk)^2 of each mass. */
  terms: number[];
  /** Dunkerley lower bound. */
  dunkerley: number;
  /** Rayleigh with the bare first mode Y1 (normalised integral Y1^2 = L): omega^2 = omega_11^2/(1 + sum mu Y1(x)^2). */
  rayleigh: number;
  /** FE reference value (consistent mass, converged). */
  exact: number;
}

/** Fundamental of a uniform beam carrying point masses by Dunkerley, Rayleigh (bare mode) and FE (units sqrt(EI/(rhoA L^4)); masses as fractions of rhoA L). */
export function massEstimates(beam: MassBeam, masses: { x: number; M: number }[], nel = 24): MassEstimates {
  const w11 = bareOmega1(beam);
  const bc = MASS_BEAM_BC[beam];
  const wkk = masses.map((m) => {
    if (!(m.M > 0)) return Infinity;
    const atSupport = m.x <= 1e-9 || (beam !== 'cantilever' && m.x >= 1 - 1e-9);
    if (atSupport) return Infinity;
    return Math.sqrt(pointStiffness(beam, Math.min(m.x, 1)) / m.M);
  });
  const terms = wkk.map((w) => (Number.isFinite(w) ? (w11 / w) ** 2 : 0));
  const dunk = w11 / Math.sqrt(1 + terms.reduce((s, t) => s + t, 0));
  const ke = masses.reduce((s, m) => s + m.M * modeShape(bc, 1, Math.min(1, Math.max(0, m.x))) ** 2, 0);
  const ray = w11 / Math.sqrt(1 + ke);
  const [left, right] = FE_ENDS[beam];
  const exact = feBeam({ left, right, nel, masses, nModes: 1 }).omega[0];
  return { w11, wkk, terms, dunkerley: dunk, rayleigh: ray, exact };
}

// ---------------------------------------------------------------------------------------------
// Cantilever with a tip mass: every exact root, and the Rayleigh/Dunkerley closed forms (LB7–LB8)
// ---------------------------------------------------------------------------------------------

/** First n roots lambda = beta L of 1 + cos l cosh l + mu l (cos l sinh l - sin l cosh l) = 0 (cantilever, tip mass mu rhoA L); omega_i = lambda_i^2 sqrt(EI/(rhoA L^4)). */
export function tipMassRoots(mu: number, n: number): number[] {
  const f = (l: number) => 1 / Math.cosh(l) + Math.cos(l) + mu * l * (Math.cos(l) * Math.tanh(l) - Math.sin(l));
  const out: number[] = [];
  const h = 0.01;
  let a = 1e-6;
  let fa = f(a);
  for (let b = h; out.length < n && b < 4 * n + 10; b += h) {
    const fb = f(b);
    if (fa * fb < 0) out.push(brent(f, a, b, 1e-14));
    a = b;
    fa = fb;
  }
  return out;
}

/** Rayleigh/Dunkerley closed forms for a cantilever with a tip mass: omega^2 = a EI/(L^3 (M + b rhoA L)) (LB7.7–LB8.3). */
export const TIP_MASS_FORMS = {
  tipLoad: { a: 3, b: 33 / 140, label: 'Rayleigh, tip-load static shape' },
  udl: { a: 16 / 5, b: 104 / 405, label: 'Rayleigh, UDL static shape' },
  cosine: { a: Math.PI ** 4 / 32, b: (3 * Math.PI - 8) / (2 * Math.PI), label: 'Rayleigh, 1 − cos(πx/2L)' },
  parabola: { a: 4, b: 0.2, label: 'Rayleigh, x²' },
  dunkerley: { a: 3, b: 3 / betaL('clamped-free', 1)[0] ** 4, label: 'Dunkerley' },
} as const;

/** omega sqrt(M L^3/EI) for a tip-mass closed form with mass ratio mu = M/(rhoA L): sqrt(a/(1 + b/mu)). */
export const tipFormC = (form: { a: number; b: number }, mu: number): number => Math.sqrt(form.a / (1 + form.b / mu));

// ---------------------------------------------------------------------------------------------
// Inverse problems (summary notes B5): a mass from a measured frequency ratio r = omega_with/omega_without
// ---------------------------------------------------------------------------------------------

const BL1_4 = 1.875 ** 4; // formula-sheet value used by the official solutions (12.36)

/** Dunkerley tip-mass ratio from r: mu = 3(1/r^2 - 1)/1.875^4 (official 2016 B2.4; 2025 B2.4). */
export const tipMassDunkerley = (r: number): number => (3 * (1 / (r * r) - 1)) / BL1_4;

/** Rayleigh tip-mass ratio from r with the bare cantilever mode (Y1(L) = 2): mu = (1/r^2 - 1)/4 (upper bound on the mass; WS2025 B2.4). */
export const tipMassRayleighMode = (r: number): number => (1 / (r * r) - 1) / 4;

/** Rayleigh tip-mass ratio from r with the tip-load static shape: mu = 3/(beta1L^4 r^2) - 33/140 (W7.6). */
export const tipMassRayleighTipLoad = (r: number): number => 3 / (betaL('clamped-free', 1)[0] ** 4 * r * r) - 33 / 140;

/** Exact tip-mass ratio from r (inverts the exact frequency equation). */
export function tipMassExact(r: number): number {
  if (!(r > 0 && r < 1)) return NaN;
  const l1 = betaL('clamped-free', 1)[0];
  const target = l1 * Math.sqrt(r); // omega ratio r = (lambda/l1)^2
  const g = (mu: number) => tipMassRoots(mu, 1)[0] - target;
  let hi = 1;
  while (g(hi) > 0 && hi < 1e7) hi *= 2;
  return brent(g, 0, hi, 1e-12);
}

// ---------------------------------------------------------------------------------------------
// Pinned beam with a point mass N rhoA L at a, sine trial shape (WQ10 Q1)
// ---------------------------------------------------------------------------------------------

/** Rayleigh with sin(pi x/L): omega/omega0 = 1/sqrt(1 + 2N sin^2(pi a/L)) (a as a fraction of L; mid-span gives 1/sqrt(1 + 2N)). */
export const pinnedSineRatio = (N: number, a = 0.5): number => 1 / Math.sqrt(1 + 2 * N * Math.sin(Math.PI * a) ** 2);

/** Dunkerley for the same: omega/omega0 = 1/sqrt(1 + pi^4 N a^2 (1-a)^2/3) (K = 3EI L/(a^2 (L-a)^2)). */
export const pinnedDunkerleyRatio = (N: number, a = 0.5): number => 1 / Math.sqrt(1 + (Math.PI ** 4 * N * a * a * (1 - a) ** 2) / 3);

// ---------------------------------------------------------------------------------------------
// Torsional shaft fixed at one end with a disc at the other (WQ10 Q3; units: omega in sqrt(G/(rho L^2)))
// ---------------------------------------------------------------------------------------------

/** Dunkerley alpha = (4/pi^2 + 1/beta)^(-1/2), beta = Ia/Id = rho J L/Id. */
export const shaftDiscDunkerley = (beta: number): number => 1 / Math.sqrt(4 / (Math.PI * Math.PI) + 1 / beta);

/** Rayleigh with a linear twist: alpha = (1/beta + 1/3)^(-1/2) (omega^2 = kt/(Id + Ia/3)). */
export const shaftDiscRayleigh = (beta: number): number => 1 / Math.sqrt(1 / beta + 1 / 3);

/** Holzer on a lumped model of the same shaft: N equal segments (stiffness N kt each), inertia Ia/N at interior stations and Ia/(2N) + Id at the disc; alpha of the first root. */
export function shaftDiscHolzer(beta: number, N: number): number {
  const J: number[] = [];
  const k: number[] = [];
  for (let i = 1; i <= N; i++) {
    J.push(i < N ? 1 / N : 1 / (2 * N) + 1 / beta);
    k.push(N);
  }
  const roots = holzerRoots(J, k, 4, 'fixed');
  return roots[0];
}

// ---------------------------------------------------------------------------------------------
// Disc–shaft chain of the Holzer lab: disc 1 is the free starting end; the far end is free or fixed
// ---------------------------------------------------------------------------------------------

export interface HolzerChain {
  /** Number of discs in use (the arrays may be longer). */
  n: number;
  /** Disc polar inertias (kg m^2), disc 1 first. */
  J: number[];
  /** Shaft stiffnesses (N m/rad): k[i] joins disc i+1 to disc i+2; k[n-1] joins disc n to the wall when fixed. */
  k: number[];
  far: 'free' | 'fixed';
}

const chainStiffness = (c: HolzerChain): number[] => (c.far === 'free' ? c.k.slice(0, c.n - 1) : c.k.slice(0, c.n));

/** Holzer march from disc 1 (theta_1 = 1, LB8 Eqs 8.4–8.5). Free far end: residual = T_n. Fixed far end: residual = twist left at the wall. */
export function holzerMarch(c: HolzerChain, w: number) {
  const J = c.J.slice(0, c.n);
  const k = chainStiffness(c);
  const theta: number[] = [];
  const inertia: number[] = [];
  const T: number[] = [];
  let th = 1;
  let t = 0;
  for (let i = 0; i < c.n; i++) {
    theta.push(th);
    inertia.push(J[i] * w * w * th);
    t += J[i] * w * w * th;
    T.push(t);
    if (i < c.n - 1) th -= t / k[i];
  }
  const thWall = c.far === 'fixed' ? th - t / k[c.n - 1] : NaN;
  return { theta, inertia, T, residual: c.far === 'free' ? t : thWall, thWall };
}

/**
 * Every natural frequency of the chain (rad/s, ascending; a free chain starts with the rigid-body 0) and the
 * highest one. The n eigenvalues of K phi = omega^2 J phi seed the roots, so none is missed (W7.5's pair is only
 * 1.8 rad/s apart), and each is polished on the Holzer residual so it is exactly a zero of the marched curve.
 * Same roots as a fine residual scan (holzerRoots, 4000+ samples) at a fraction of the cost.
 */
export function holzerChainModes(c: HolzerChain): { roots: number[]; top: number } {
  const n = c.n;
  const K: Mat = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  const M: Mat = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? c.J[i] : 0)));
  const k = chainStiffness(c);
  for (let i = 0; i < n - 1; i++) {
    K[i][i] += k[i];
    K[i + 1][i + 1] += k[i];
    K[i][i + 1] -= k[i];
    K[i + 1][i] -= k[i];
  }
  if (c.far === 'fixed') K[n - 1][n - 1] += k[n - 1];
  const w = genSymEig(K, M)
    .omega2.map((v) => Math.sqrt(Math.max(0, v)))
    .sort((a, b) => a - b);
  const residual = (x: number) => holzerMarch(c, x).residual;
  const roots = w.map((r) => {
    if (r === 0) return 0;
    const a = r * (1 - 1e-6);
    const b = r * (1 + 1e-6);
    const x = residual(a) * residual(b) < 0 ? brent(residual, a, b, 1e-13) : r;
    return Number.isFinite(x) ? x : r;
  });
  return { roots, top: Math.max(1, ...w) };
}

// ---------------------------------------------------------------------------------------------
// Small numeric helpers for generators
// ---------------------------------------------------------------------------------------------

/** Keep only traps at least `minRel` (default 4 %) away from the answer and from each other. */
export function farTraps<T extends { value: number }>(answer: number, traps: T[], minRel = 0.04): T[] {
  const out: T[] = [];
  for (const t of traps) {
    if (!Number.isFinite(t.value)) continue;
    const far = (a: number, b: number) => Math.abs(a - b) > minRel * Math.max(Math.abs(a), Math.abs(b), 1e-300);
    if (far(t.value, answer) && out.every((o) => far(o.value, t.value))) out.push(t);
  }
  return out;
}
