// Self-tests for the discrete-system physics library (linalg, poly, sdof, mdof, absorber,
// rigidbody, damped). Each test names where its reference value comes from: the course reader
// (LA#), the exam summary notes, an official exam-pack answer or a worked solution, or an
// independent numerical method (RK4, brute-force search, a second algorithm).
import type { CheckResult, SelfTest } from './types';
import { ascending, isTrue, near, nearAbs } from './assert';
import type { C } from '../physics/complex';
import { c, cabs, cmul, csub } from '../physics/complex';
import { scanRoots } from '../physics/roots';
import { logspace } from '../physics/integrate';
import { integrate } from '../physics/ode';
import { radToRpm, rpmToRad, TWO_PI } from '../physics/units';
import type { Mat, Vec } from '../physics/linalg';
import {
  cdet,
  clone,
  cmatFromReal,
  cmatInv,
  cmatSolve,
  cNullVector,
  det,
  dot,
  eye,
  genSymEig,
  inv,
  isSymmetric,
  matAdd,
  matMul,
  matScale,
  matSub,
  matVec,
  norm,
  solve,
  symEig,
  transpose,
} from '../physics/linalg';
import {
  polyAdd,
  polyDeriv,
  polyEval,
  polyEvalC,
  polyMatDet,
  polyMul,
  polyRoots,
  polyScale,
  polyTrim,
  quadRoots,
} from '../physics/poly';
import {
  criticalDamping,
  dampedFrequency,
  dampingRatio,
  dampingRegime,
  freeResponse,
  freeVelocity,
  isolationRatioFor,
  logDecrement,
  magnification,
  naturalFrequency,
  peakRatioForce,
  peakRatioRelative,
  peakRatioTransmissibility,
  phaseLag,
  relativeMotionRatio,
  transmissibility,
  undampedAmplitude,
  wnFromStaticDeflection,
  zetaFromLogDecrement,
} from '../physics/sdof';
import {
  antiresonance2,
  antiresonances,
  charPoly,
  detKM,
  harmonicResponse,
  modalForces,
  modalFreeResponse,
  modalInitialConditions,
  modalMatrices,
  modeRatio2,
  modes,
  receptance,
  receptanceUndamped,
  suppressionFrequencies,
  uncoupledFrequencies,
} from '../physics/mdof';
import {
  absorberAmplitude,
  chainFrequencies,
  denHartogFixedPoints,
  denHartogOptimum,
  generalRatios,
  muFromRatio,
  primaryAmplitude,
  sizeTunedAbsorber,
  tunedRatios,
} from '../physics/absorber';
import {
  blockInertia,
  bouncePitchK,
  bouncePitchM,
  centreOfRotation,
  couplings,
  inclinedMount,
  nodePosition,
  planarK,
  planarM,
  rodInertiaCentre,
  rodInertiaEnd,
} from '../physics/rigidbody';
import type { DampedMode } from '../physics/damped';
import {
  dampedModes,
  dampedModesSorted,
  fromEigenvalue,
  fromRealPair,
  modeRatio,
  rayleighCoefficients,
  rayleighZeta,
  sortEigenvalues,
  stateMatrix,
} from '../physics/damped';

// ---------------------------------------------------------------------------------------------
// Helpers (test-only).

const maxAbs = (A: Mat): number => A.reduce((m, row) => Math.max(m, ...row.map(Math.abs)), 0);
const offDiagMax = (A: Mat): number =>
  A.reduce((m, row, i) => Math.max(m, ...row.map((v, j) => (i === j ? 0 : Math.abs(v)))), 0);
const vecDiff = (a: Vec, b: Vec): number => a.reduce((m, v, i) => Math.max(m, Math.abs(v - b[i])), 0);
const col = (P: Mat, j: number): Vec => P.map((row) => row[j]);
const diag = (v: number[]): Mat => v.map((x, i) => v.map((_, j) => (i === j ? x : 0)));

/** Stiffness matrix of the chain ground-k1-m1-k2-m2-...-kn-mn. */
function chainK(ks: number[]): Mat {
  const n = ks.length;
  const K: Mat = ks.map(() => new Array<number>(n).fill(0));
  for (let i = 0; i < n; i++) {
    K[i][i] = ks[i] + (i + 1 < n ? ks[i + 1] : 0);
    if (i + 1 < n) {
      K[i][i + 1] = -ks[i + 1];
      K[i + 1][i] = -ks[i + 1];
    }
  }
  return K;
}

/** Brute-force maximiser: dense scan then golden-section refinement. */
function argmax(f: (x: number) => number, a: number, b: number, n = 4000): number {
  const h = (b - a) / n;
  let best = a;
  let fb = -Infinity;
  for (let i = 0; i <= n; i++) {
    const x = a + i * h;
    const v = f(x);
    if (v > fb) {
      fb = v;
      best = x;
    }
  }
  let lo = Math.max(a, best - h);
  let hi = Math.min(b, best + h);
  const gr = (Math.sqrt(5) - 1) / 2;
  let x1 = hi - gr * (hi - lo);
  let x2 = lo + gr * (hi - lo);
  let f1 = f(x1);
  let f2 = f(x2);
  for (let it = 0; it < 200 && hi - lo > 1e-14; it++) {
    if (f1 < f2) {
      lo = x1;
      x1 = x2;
      f1 = f2;
      x2 = lo + gr * (hi - lo);
      f2 = f(x2);
    } else {
      hi = x2;
      x2 = x1;
      f2 = f1;
      x1 = hi - gr * (hi - lo);
      f1 = f(x1);
    }
  }
  return 0.5 * (lo + hi);
}

/** Number of sign changes along a sequence (zeros skipped). */
function signChanges(v: number[]): number {
  let n = 0;
  let prev = 0;
  for (const x of v) {
    const s = Math.sign(x);
    if (s === 0) continue;
    if (prev !== 0 && s !== prev) n++;
    prev = s;
  }
  return n;
}

/** RK4 integration of M x'' + K x = 0 from (x0, v0). */
function rk4Undamped(M: Mat, K: Mat, x0: Vec, v0: Vec, tEnd: number, h: number) {
  const n = M.length;
  const A = matMul(inv(M), K);
  const f = (_t: number, y: readonly number[]) => {
    const out = new Array<number>(2 * n);
    for (let i = 0; i < n; i++) {
      out[i] = y[n + i];
      let s = 0;
      for (let j = 0; j < n; j++) s -= A[i][j] * y[j];
      out[n + i] = s;
    }
    return out;
  };
  return integrate(f, [...x0, ...v0], 0, tEnd, h);
}

/** max |A z - s z| / (max(|s|, 1) max|z|) for a state-space eigenpair z = [X; V]. */
function stateResidual(A: Mat, m: DampedMode): number {
  const z = [...m.X, ...m.V];
  let num = 0;
  let den = 0;
  for (let i = 0; i < z.length; i++) {
    let re = 0;
    let im = 0;
    for (let j = 0; j < z.length; j++) {
      re += A[i][j] * z[j].re;
      im += A[i][j] * z[j].im;
    }
    const sz = cmul(m.s, z[i]);
    num = Math.max(num, Math.hypot(re - sz.re, im - sz.im));
    den = Math.max(den, cabs(z[i]));
  }
  return num / (Math.max(cabs(m.s), 1) * den);
}

const fmt = (x: number, d = 4) => Number(x.toPrecision(d)).toString();

// ---------------------------------------------------------------------------------------------

export const tests: SelfTest[] = [
  // ------------------------------------------------------------------ linalg
  {
    id: 'disc-linalg-lu',
    topic: 'core',
    title: 'Linear algebra: determinant, inverse and solve (LU with pivoting)',
    source: 'Hand-computed 3×3 determinant; identities A⁻¹A = I and A x = b',
    run: () => {
      const A = [
        [4, -2, 1],
        [-2, 4, -2],
        [1, -2, 4],
      ];
      const b = [1, -2, 3];
      const x = solve(A, b);
      const swap = [
        [0, 1],
        [1, 0],
      ];
      return [
        near('det A = 36', det(A), 36, 1e-13),
        near('det [0 1; 1 0] = −1 (needs a row swap)', det(swap), -1, 1e-15),
        nearAbs('det of the singular [1 2; 2 4] = 0', det([[1, 2], [2, 4]]), 0, 1e-15),
        nearAbs('max |A⁻¹A − I|', maxAbs(matSub(matMul(inv(A), A), eye(3))), 0, 1e-14),
        nearAbs('max |A x − b| after solve', vecDiff(matVec(A, x), b), 0, 1e-14),
        nearAbs('A + A − 2A = 0 (matAdd, matScale, clone)', maxAbs(matSub(matAdd(A, clone(A)), matScale(A, 2))), 0, 0),
        near('dot([1, 2, 3], [4, −5, 6]) = 12', dot([1, 2, 3], [4, -5, 6]), 12, 0),
        isTrue('cmatFromReal: imaginary parts 0', cmatFromReal(A).every((row, i) => row.every((z, j) => z.re === A[i][j] && z.im === 0))),
        near('|(3, 4)| = 5 (norm)', norm([3, 4]), 5, 1e-15),
        isTrue('isSymmetric(A)', isSymmetric(A)),
        isTrue('[1 2; 2.001 1] is not symmetric', !isSymmetric([[1, 2], [2.001, 1]])),
      ];
    },
  },
  {
    id: 'disc-linalg-symeig',
    topic: 'core',
    title: 'Jacobi eigen-solver on the 3-mass tridiagonal matrix',
    source: 'Closed form λₖ = 2 − 2 cos(kπ/4): 2 − √2, 2, 2 + √2; first eigenvector [1, √2, 1]/2',
    run: () => {
      const A = [
        [2, -1, 0],
        [-1, 2, -1],
        [0, -1, 2],
      ];
      const { values, vectors: V } = symEig(A);
      const VtV = matMul(transpose(V), V);
      const AV = matMul(A, V);
      const VL = matMul(V, diag(values));
      return [
        near('λ₁ = 2 − √2', values[0], 2 - Math.SQRT2, 1e-13),
        near('λ₂ = 2', values[1], 2, 1e-13),
        near('λ₃ = 2 + √2', values[2], 2 + Math.SQRT2, 1e-13),
        ascending('eigenvalues ascending', values),
        nearAbs('max |VᵀV − I| (orthonormal columns)', maxAbs(matSub(VtV, eye(3))), 0, 1e-14),
        nearAbs('max |AV − VΛ|', maxAbs(matSub(AV, VL)), 0, 1e-14),
        nearAbs('first eigenvector = [1, √2, 1]/2', vecDiff(col(V, 0), [0.5, Math.SQRT1_2, 0.5]), 0, 1e-14),
      ];
    },
  },
  {
    id: 'disc-linalg-gensymeig',
    topic: 'core',
    title: 'Generalised eigenproblem Kφ = ω²Mφ with a mass-coupled M',
    source: 'LA3 Eq 3.9: det(K − λM) = 2.75λ² − 1300λ + 77500 for K = [400 −150; −150 250], M = [3 0.5; 0.5 1]',
    run: () => {
      const K = [
        [400, -150],
        [-150, 250],
      ];
      const M = [
        [3, 0.5],
        [0.5, 1],
      ];
      const { omega2, modes: Phi } = genSymEig(K, M);
      const p = charPoly(K, M);
      const [l1, l2] = quadRoots(p[2], p[1], p[0]);
      const PtMP = matMul(transpose(Phi), matMul(M, Phi));
      const PtKP = matMul(transpose(Phi), matMul(K, Phi));
      return [
        near('charPoly constant term 77500', p[0], 77500, 1e-14),
        near('charPoly λ coefficient −1300', p[1], -1300, 1e-14),
        near('charPoly λ² coefficient 2.75 = det M', p[2], 2.75, 1e-14),
        near('ω₁² = smaller root of the characteristic equation', omega2[0], l1.re, 1e-12),
        near('ω₂² = larger root', omega2[1], l2.re, 1e-12),
        nearAbs('max |ΦᵀMΦ − I| (M-orthonormal)', maxAbs(matSub(PtMP, eye(2))), 0, 1e-14),
        nearAbs('max |ΦᵀKΦ − diag(ω²)| / ω₂²', maxAbs(matSub(PtKP, diag(omega2))) / omega2[1], 0, 1e-14),
        nearAbs('det(K − ω₁²M)/det K ≈ 0', detKM(K, M, omega2[0]) / det(K), 0, 1e-12),
      ];
    },
  },
  {
    id: 'disc-linalg-complex',
    topic: 'core',
    title: 'Complex solve, inverse, determinant and null vector',
    source: 'Identities A⁻¹A = I, A x = b, det(AB) = det A det B; B x = 0 for a rank-deficient B',
    run: () => {
      const A: C[][] = [
        [c(2, 1), c(-1), c(0, 0.5)],
        [c(1), c(3, -2), c(1)],
        [c(0), c(0, 1), c(1, 1)],
      ];
      const b = [c(1, -1), c(0, 2), c(-3)];
      const x = cmatSolve(A, b);
      const Ai = cmatInv(A);
      let invErr = 0;
      let solveErr = 0;
      for (let i = 0; i < 3; i++) {
        let r = c(0);
        for (let j = 0; j < 3; j++) {
          let s = c(0);
          for (let k = 0; k < 3; k++) s = { re: s.re + cmul(Ai[i][k], A[k][j]).re, im: s.im + cmul(Ai[i][k], A[k][j]).im };
          invErr = Math.max(invErr, cabs(csub(s, c(i === j ? 1 : 0))));
          const t = cmul(A[i][j], x[j]);
          r = { re: r.re + t.re, im: r.im + t.im };
        }
        solveErr = Math.max(solveErr, cabs(csub(r, b[i])));
      }
      // det(A) det(A^-1) = 1
      const dd = cmul(cdet(A), cdet(Ai));
      // Rank 2: row 3 = row 1 + (1 - i) row 2.
      const w = c(1, -1);
      const B: C[][] = [A[0], A[1], A[0].map((v, j) => ({ re: v.re + cmul(w, A[1][j]).re, im: v.im + cmul(w, A[1][j]).im }))];
      const nB = cNullVector(B);
      // Rank 1: outer product u v^T.
      const u = [c(1, 2), c(-1), c(0.5, 0.5)];
      const v = [c(2), c(0, 1), c(-1, 3)];
      const R1 = u.map((ui) => v.map((vj) => cmul(ui, vj)));
      const nR = cNullVector(R1);
      const resid = (Mx: C[][], z: C[]) =>
        Math.max(
          ...Mx.map((row) => {
            let s = c(0);
            row.forEach((m, j) => {
              const t = cmul(m, z[j]);
              s = { re: s.re + t.re, im: s.im + t.im };
            });
            return cabs(s);
          })
        );
      return [
        nearAbs('max |A⁻¹A − I|', invErr, 0, 1e-14),
        nearAbs('max |A x − b|', solveErr, 0, 1e-14),
        nearAbs('det A · det A⁻¹ = 1 (real part)', dd.re, 1, 1e-13),
        nearAbs('det A · det A⁻¹ = 1 (imag part)', dd.im, 0, 1e-13),
        nearAbs('rank-2 B: max |B x| for the null vector', resid(B, nB), 0, 1e-13),
        nearAbs('null vector scaled so max |xᵢ| = 1', Math.max(...nB.map(cabs)), 1, 1e-15),
        nearAbs('rank-1 matrix: max |R x| for the null vector', resid(R1, nR), 0, 1e-13),
      ];
    },
  },
  // ------------------------------------------------------------------ poly
  {
    id: 'disc-poly-roots',
    topic: 'core',
    title: 'Polynomial roots (Aberth–Ehrlich) and the stable quadratic formula',
    source: 'Polynomials built from known roots, incl. the 2019 Q1e damped pairs −12.1 ± 1647.3i, −321 ± 5825.0i',
    run: () => {
      const out: CheckResult[] = [];
      const r3 = polyRoots([-6, 11, -6, 1]).map((z) => z.re);
      out.push(nearAbs('(x−1)(x−2)(x−3): roots 1, 2, 3', vecDiff(r3, [1, 2, 3]), 0, 1e-13));
      const r4 = polyRoots([1, 0, 0, 0, 1]);
      let unit = 0;
      for (const z of r4) unit = Math.max(unit, Math.abs(cabs(z) - 1), Math.abs(Math.abs(z.re) - Math.SQRT1_2));
      out.push(nearAbs('x⁴ + 1: roots (±1 ± i)/√2', unit, 0, 1e-14));
      out.push(isTrue('x⁴ + 1: conjugate pairs exact', r4[0].re === r4[1].re && r4[0].im === -r4[1].im && r4[2].im === -r4[3].im));
      // det-like quartic from two damped modes
      const pairs: C[] = [c(-12.1, 1647.3), c(-321, 5825.0)];
      let p = [1];
      for (const s of pairs) {
        const q = [s.re * s.re + s.im * s.im, -2 * s.re, 1];
        const next = new Array<number>(p.length + 2).fill(0);
        p.forEach((a, i) => q.forEach((b2, j) => (next[i + j] += a * b2)));
        p = next;
      }
      const rq = polyRoots(p);
      const relErr = Math.max(...pairs.map((s) => Math.min(...rq.map((z) => cabs(csub(z, s)))) / cabs(s)));
      out.push(nearAbs('damped quartic: max relative root error', relErr, 0, 1e-13));
      out.push(isTrue('damped quartic: 2 roots with Im > 0, 2 with Im < 0', rq.filter((z) => z.im > 0).length === 2 && rq.filter((z) => z.im < 0).length === 2));
      // widely spread real roots 1e-3, 1, 1e3, -2
      const spread = [1e-3, 1, 1e3, -2];
      let ps = [1];
      for (const r of spread) {
        const next = new Array<number>(ps.length + 1).fill(0);
        ps.forEach((a, i) => {
          next[i] -= r * a;
          next[i + 1] += a;
        });
        ps = next;
      }
      const rs = polyRoots(ps).map((z) => z.re);
      const sorted = [...spread].sort((a, b2) => a - b2);
      out.push(nearAbs('roots spread 1e−3 … 1e3: max relative error', Math.max(...rs.map((r, i) => Math.abs(r - sorted[i]) / Math.abs(sorted[i]))), 0, 1e-12));
      // (x + 2)^2 (x^2 + 1): a double real root next to a complex pair.
      const mixed = polyRoots([4, 4, 5, 4, 1]);
      const reals = mixed.filter((z) => z.im === 0);
      const cplx = mixed.filter((z) => z.im !== 0);
      out.push(isTrue('(x + 2)²(x² + 1): 2 real roots and 1 exact conjugate pair', reals.length === 2 && cplx.length === 2 && cplx[0].im === -cplx[1].im));
      out.push(nearAbs('… double root −2 (to √ε accuracy)', Math.max(...reals.map((z) => Math.abs(z.re + 2))), 0, 1e-7));
      out.push(nearAbs('… pair ±i', Math.max(...cplx.map((z) => cabs(csub(z, c(0, Math.sign(z.im)))))), 0, 1e-13));
      const [s1] = quadRoots(1, -1e8, 1);
      out.push(near('x² − 10⁸x + 1: small root 1e−8 without cancellation', s1.re, 1e-8, 1e-14));
      const [d1, d2] = quadRoots(1, -6, 9);
      out.push(isTrue('(x − 3)²: exact double root', d1.re === 3 && d2.re === 3 && d1.im === 0));
      const lead = polyRoots([2, -3, 1, 0, 0]).map((z) => z.re);
      out.push(nearAbs('leading zeros stripped: [2, −3, 1, 0, 0] → 1, 2', vecDiff(lead, [1, 2]), 0, 1e-15));
      const zr = polyRoots([0, 0, 2, 1]).map((z) => z.re);
      out.push(nearAbs('zero roots factored out: x³ + 2x² → −2, 0, 0', vecDiff(zr, [-2, 0, 0]), 0, 1e-15));
      return out;
    },
  },
  {
    id: 'disc-poly-arith',
    topic: 'core',
    title: 'Polynomial arithmetic (ascending coefficients)',
    source: '(1 + x)(1 − x) = 1 − x², d/dx(x³) = 3x², (1 + 2x)² at x = i is −3 + 4i',
    run: () => {
      const z = polyEvalC([1, 4, 4], c(0, 1));
      return [
        nearAbs('(1 + x)(1 − x) = 1 − x²', vecDiff(polyMul([1, 1], [1, -1]), [1, 0, -1]), 0, 0),
        nearAbs('(1 + x) + (2 − x + x²) = 3 + x²', vecDiff(polyAdd([1, 1], [2, -1, 1]), [3, 0, 1]), 0, 0),
        nearAbs('3·(1 − 2x) = 3 − 6x', vecDiff(polyScale([1, -2], 3), [3, -6]), 0, 0),
        nearAbs('d/dx (x³ + 5x) = 3x² + 5', vecDiff(polyDeriv([0, 5, 0, 1]), [5, 0, 3]), 0, 0),
        isTrue('polyTrim drops exact-zero leading terms', polyTrim([1, 2, 0, 0]).length === 2 && polyTrim([0, 0]).length === 1),
        near('Horner: 2 + 3x + x² at x = 2 is 12', polyEval([2, 3, 1], 2), 12, 0),
        isTrue('complex Horner: (1 + 2x)² at x = i is −3 + 4i', z.re === -3 && z.im === 4, `${z.re} + ${z.im}i`),
      ];
    },
  },
  {
    id: 'disc-poly-matdet',
    topic: 'core',
    title: 'Determinant of a polynomial matrix',
    source: 'det A(x) evaluated numerically at sample points must equal the polynomial',
    run: () => {
      const A = [
        [[2, 1, 0.5], [-1, 0.2], [0, 3]],
        [[-1, 0.2], [4, -1, 2], [1]],
        [[0, 3], [1], [5, 0, 1]],
      ];
      const p = polyMatDet(A);
      const at = (x: number) => A.map((row) => row.map((q) => polyEval(q, x)));
      return [
        isTrue('degree 6 (diagonal x² terms)', p.length === 7, `length ${p.length}`),
        ...[0.5, -1.3, 2.7].map((x) => near(`det A(${x}) = polynomial value`, polyEval(p, x), det(at(x)), 1e-12)),
      ];
    },
  },
  // ------------------------------------------------------------------ sdof
  {
    id: 'disc-sdof-basics',
    topic: 'core',
    title: 'SDOF essentials: ωn, ζ, ωd, static deflection, log decrement',
    source: 'Summary notes A1; LA1 (k = 4000 N/m, m = 10 kg, c = 40 N·s/m)',
    run: () => {
      const wn = naturalFrequency(4000, 10);
      const zeta = dampingRatio(40, 4000, 10);
      return [
        near('ωn = √(k/m) = 20 rad/s', wn, 20, 1e-15),
        near('cc = 2√(km) = 400 N·s/m', criticalDamping(4000, 10), 400, 1e-15),
        near('ζ = c/cc = 0.1', zeta, 0.1, 1e-15),
        near('ωd = ωn√(1 − ζ²) = 19.8997 rad/s', dampedFrequency(wn, zeta), 20 * Math.sqrt(0.99), 1e-15),
        nearAbs('ωd = 0 at ζ = 1 and ζ = 2', dampedFrequency(20, 1) + dampedFrequency(20, 2), 0, 0),
        near('static sag 9.81 mm → ωn = √(g/δ) = 31.623 rad/s', wnFromStaticDeflection(0.00981), Math.sqrt(1000), 1e-14),
        near('X = √(x₀² + (v₀/ωn)²) = 0.05 m (x₀ = 0.03 m, v₀ = 0.8 m/s, ωn = 20)', undampedAmplitude(0.03, 0.8, 20), 0.05, 1e-14),
        near('δ = 2πζ/√(1 − ζ²) = 0.63148 at ζ = 0.1', logDecrement(0.1), (TWO_PI * 0.1) / Math.sqrt(0.99), 1e-14),
        ...[0.01, 0.3, 0.9].map((z) => near(`ζ from δ round trip (ζ = ${z})`, zetaFromLogDecrement(logDecrement(z)), z, 1e-13)),
        near('phase lag at r = 1 is 90°', phaseLag(1, 0.2), Math.PI / 2, 1e-15),
        nearAbs('phase lag 0 below resonance when ζ = 0', phaseLag(0.5, 0), 0, 0),
        near('phase lag π above resonance when ζ = 0', phaseLag(2, 0), Math.PI, 1e-15),
        isTrue('phase lag in (π/2, π) for r = 2, ζ = 0.1', phaseLag(2, 0.1) > Math.PI / 2 && phaseLag(2, 0.1) < Math.PI),
        isTrue('regimes: ζ = 0.5 under, 1 ± 5·10⁻⁷ critical, 1.5 over', dampingRegime(0.5) === 'under' && dampingRegime(1 + 5e-7) === 'critical' && dampingRegime(1 - 5e-7) === 'critical' && dampingRegime(1.5) === 'over'),
      ];
    },
  },
  {
    id: 'disc-sdof-transmissibility',
    topic: 'core',
    title: 'Transmissibility: T = 1 at r = √2; resonant amplitude 1/(2ζ)',
    source: 'LA7 Eq 7.1; summary notes A1 and trap 5',
    run: () => {
      const out: CheckResult[] = [];
      for (const z of [0, 0.1, 0.5, 1]) out.push(near(`T(√2, ζ = ${z}) = 1`, transmissibility(Math.SQRT2, z), 1, 1e-14));
      for (const z of [0.02, 0.1, 0.5]) {
        out.push(near(`X/(F₀/k) at r = 1 is 1/(2ζ) (ζ = ${z})`, magnification(1, z), 1 / (2 * z), 1e-14));
        out.push(near(`relative deflection Z/Y at r = 1 is 1/(2ζ) (ζ = ${z})`, relativeMotionRatio(1, z), 1 / (2 * z), 1e-14));
      }
      out.push(near('undamped T at r = 3 is 1/(r² − 1) = 0.125', transmissibility(3, 0), 0.125, 1e-14));
      out.push(isTrue('above √2 more damping raises T (r = 3: ζ 0.05 vs 0.3)', transmissibility(3, 0.05) < transmissibility(3, 0.3)));
      out.push(isTrue('below √2 more damping lowers T (r = 1.2)', transmissibility(1.2, 0.05) > transmissibility(1.2, 0.3)));
      for (const z of [0, 0.1, 0.3]) {
        const r = isolationRatioFor(0.1, z);
        out.push(near(`isolationRatioFor(T = 0.1, ζ = ${z}) gives T = 0.1 (r = ${fmt(r)})`, transmissibility(r, z), 0.1, 1e-13));
      }
      out.push(near('ζ = 0: r for T = 0.1 is √11', isolationRatioFor(0.1), Math.sqrt(11), 1e-15));
      return out;
    },
  },
  {
    id: 'disc-sdof-peaks',
    topic: 'core',
    title: 'Peak frequency ratios vs brute-force maximisation',
    source: 'Independent numerical maximisation of X/(F₀/k), T and Z/Y over r (summary notes A1, trap 4)',
    run: () => {
      const out: CheckResult[] = [];
      for (const z of [0.05, 0.1, 0.2, 0.4, 0.6]) {
        out.push(near(`force peak r = √(1 − 2ζ²) (ζ = ${z})`, argmax((r) => magnification(r, z), 0, 3), peakRatioForce(z), 1e-6));
        out.push(near(`transmissibility peak (ζ = ${z})`, argmax((r) => transmissibility(r, z), 0, 3), peakRatioTransmissibility(z), 1e-6));
        out.push(near(`relative-motion peak r = 1/√(1 − 2ζ²) (ζ = ${z})`, argmax((r) => relativeMotionRatio(r, z), 0, 6), peakRatioRelative(z), 1e-6));
      }
      out.push(near('peak magnification = 1/(2ζ√(1 − ζ²)) at ζ = 0.1', magnification(peakRatioForce(0.1), 0.1), 1 / (0.2 * Math.sqrt(0.99)), 1e-13));
      out.push(near('transmissibility peak ratio → 1 as ζ → 0', peakRatioTransmissibility(0), 1, 0));
      out.push(isTrue('no force peak for ζ ≥ 1/√2 (NaN)', Number.isNaN(peakRatioForce(0.8)) && Number.isNaN(peakRatioRelative(0.75))));
      out.push(isTrue('force peak below ωn, relative-motion peak above (ζ = 0.2)', peakRatioForce(0.2) < 1 && peakRatioRelative(0.2) > 1));
      return out;
    },
  },
  {
    id: 'disc-sdof-rk4',
    topic: 'core',
    title: 'Analytic free response vs RK4 over 3 periods',
    source: "RK4 integration of x″ + 2ζωn x′ + ωn² x = 0 (src/physics/ode.ts); LA1 free-response formulas",
    run: () => {
      const out: CheckResult[] = [];
      const wn = 10;
      const x0 = 0.01;
      const v0 = 0.5;
      const A0 = undampedAmplitude(x0, v0, wn);
      const T = TWO_PI / wn;
      for (const z of [0.05, 1, 2]) {
        const sim = integrate((_t, y) => [y[1], -2 * z * wn * y[1] - wn * wn * y[0]], [x0, v0], 0, 3 * T, T / 2000);
        let ex = 0;
        let ev = 0;
        sim.t.forEach((t, k) => {
          ex = Math.max(ex, Math.abs(sim.y[k][0] - freeResponse(t, x0, v0, wn, z)));
          ev = Math.max(ev, Math.abs(sim.y[k][1] - freeVelocity(t, x0, v0, wn, z)));
        });
        out.push(nearAbs(`ζ = ${z}: max |x − x_RK4| / X₀`, ex / A0, 0, 1e-6));
        out.push(nearAbs(`ζ = ${z}: max |v − v_RK4| / (ωn X₀)`, ev / (wn * A0), 0, 1e-6));
      }
      const t = 0.15;
      const xc = freeResponse(t, x0, v0, wn, 1);
      out.push(nearAbs('continuous through ζ = 1 (ζ = 1 − 2·10⁻⁶ vs critical)', (freeResponse(t, x0, v0, wn, 1 - 2e-6) - xc) / A0, 0, 1e-5));
      out.push(nearAbs('continuous through ζ = 1 (ζ = 1 + 2·10⁻⁶ vs critical)', (freeResponse(t, x0, v0, wn, 1 + 2e-6) - xc) / A0, 0, 1e-5));
      out.push(nearAbs('overdamped response finite at large t (ζ = 50, t = 1000 s)', freeResponse(1000, x0, v0, wn, 50), 0, 1e-3));
      return out;
    },
  },
  // ------------------------------------------------------------------ mdof
  {
    id: 'disc-mdof-chain',
    topic: 'core',
    title: '2-DoF chain m₁ = m₂ = 1, k₁ = k₂ = 1: frequencies, modes, orthogonality',
    source: 'Summary notes A3: det(K − ω²M) = ω⁴ − 3ω² + 1, so ω² = (3 ∓ √5)/2 and r = (1 ± √5)/2',
    run: () => {
      const K = chainK([1, 1]);
      const M = eye(2);
      const { omega2, P, Pm } = modes(K, M);
      const { Mstar, Kstar } = modalMatrices(P, M, K);
      const r1 = (1 + Math.sqrt(5)) / 2;
      const r2 = (1 - Math.sqrt(5)) / 2;
      return [
        near('ω₁² = (3 − √5)/2 = 0.381966', omega2[0], (3 - Math.sqrt(5)) / 2, 1e-14),
        near('ω₂² = (3 + √5)/2 = 2.618034', omega2[1], (3 + Math.sqrt(5)) / 2, 1e-14),
        nearAbs('P row 1 = [1, 1] (course normalisation)', vecDiff(P[0], [1, 1]), 0, 0),
        near('mode 1 ratio r₁ = (1 + √5)/2 = 1.618 (in phase)', P[1][0], r1, 1e-14),
        near('mode 2 ratio r₂ = (1 − √5)/2 = −0.618 (out of phase)', P[1][1], r2, 1e-14),
        near('modeRatio2 at ω₁² (row 1 formula)', modeRatio2(K, M, omega2[0]), r1, 1e-13),
        near('modeRatio2 at ω₂²', modeRatio2(K, M, omega2[1]), r2, 1e-13),
        nearAbs('PᵀMP diagonal (max off-diagonal)', offDiagMax(Mstar), 0, 1e-14),
        nearAbs('PᵀKP diagonal (max off-diagonal)', offDiagMax(Kstar), 0, 1e-14),
        near('k*₁/m*₁ = ω₁²', Kstar[0][0] / Mstar[0][0], omega2[0], 1e-13),
        nearAbs('Pmᵀ M Pm = I', maxAbs(matSub(modalMatrices(Pm, M, K).Mstar, eye(2))), 0, 1e-14),
        nearAbs('charPoly = [1, −3, 1]', vecDiff(charPoly(K, M), [1, -3, 1]), 0, 0),
        nearAbs('det(K − ω₁²M) = 0', detKM(K, M, omega2[0]), 0, 1e-15),
      ];
    },
  },
  {
    id: 'disc-mdof-2025a14',
    topic: 'core',
    title: '2025 A1.4: K = k[2 −2; −2 3], M = mI',
    source: '2025 A1.4 worked solution: λ′ = (5 ∓ √17)/2, P = [1 1; 0.7808 −1.2808], PᵀMP = m diag(1.6096, 2.6404), PᵀKP = k diag(0.7057, 12.044)',
    run: () => {
      const K = [
        [2, -2],
        [-2, 3],
      ];
      const M = eye(2);
      const { omega2, P } = modes(K, M);
      const { Mstar, Kstar } = modalMatrices(P, M, K);
      return [
        near('ω₁²/(k/m) = 0.4384', omega2[0], (5 - Math.sqrt(17)) / 2, 1e-14),
        near('ω₂²/(k/m) = 4.5616', omega2[1], (5 + Math.sqrt(17)) / 2, 1e-14),
        near('r₁ = (√17 − 1)/4 = 0.7808', P[1][0], 0.7808, 1e-4),
        near('r₂ = −(√17 + 1)/4 = −1.2808', P[1][1], -1.2808, 1e-4),
        near('m*₁ = 1.6096 m', Mstar[0][0], 1.6096, 1e-4),
        near('m*₂ = 2.6404 m', Mstar[1][1], 2.6404, 1e-4),
        near('k*₁ = 0.7057 k', Kstar[0][0], 0.7057, 2e-4),
        near('k*₂ = 12.044 k', Kstar[1][1], 12.044, 1e-4),
      ];
    },
  },
  {
    id: 'disc-mdof-semidefinite',
    topic: 'core',
    title: 'Semi-definite systems: zero-frequency rigid-body modes',
    source: 'LA8 §8.1 and Eqs 8.5–8.12 (M = diag(1, 2, 1), λ = 0, 0, 4, X₃ = [1, −1, 1]); summary notes A3',
    run: () => {
      // Two masses joined by one spring.
      const k = 600;
      const K2 = [
        [k, -k],
        [-k, k],
      ];
      const M2 = diag([2, 3]);
      const a = modes(K2, M2);
      // LA8 aircraft-wing example.
      const K3 = [
        [1, -2, 1],
        [-2, 4, -2],
        [1, -2, 1],
      ];
      const M3 = diag([1, 2, 1]);
      const b = modes(K3, M3);
      const z1 = col(b.P, 0);
      const z2 = col(b.P, 1);
      const x3 = col(b.P, 2);
      const mDot = (u: Vec, v: Vec) => u.reduce((s, ui, i) => s + ui * M3[i][i] * v[i], 0);
      return [
        isTrue('two masses + one spring: ω₁ = 0 exactly', a.omega[0] === 0, `ω₁ = ${a.omega[0]}`),
        nearAbs('rigid-body mode [1, 1]', vecDiff(col(a.P, 0), [1, 1]), 0, 1e-12),
        near('elastic ω₂² = k(1/m₁ + 1/m₂) = 500', a.omega2[1], 500, 1e-13),
        isTrue('LA8 example: ω₁² = ω₂² = 0 exactly (repeated zero)', b.omega2[0] === 0 && b.omega2[1] === 0),
        near('LA8 example: ω₃² = 4', b.omega2[2], 4, 1e-13),
        nearAbs('LA8 example: X₃ = [1, −1, 1]', vecDiff(x3, [1, -1, 1]), 0, 1e-12),
        nearAbs('both zero modes satisfy K X = 0', Math.max(norm(matVec(K3, z1)), norm(matVec(K3, z2))), 0, 1e-12),
        nearAbs('zero modes M-orthogonal to each other', mDot(z1, z2), 0, 1e-12),
        nearAbs('zero modes M-orthogonal to X₃', Math.max(Math.abs(mDot(z1, x3)), Math.abs(mDot(z2, x3))), 0, 1e-12),
      ];
    },
  },
  {
    id: 'disc-mdof-belt',
    topic: 'core',
    title: 'Belt drive (official 2019 Q2): rigid mode [1, R₁/R₂]',
    source: 'Official 2019 Part A Q2 solution: K = 2k[R₁² −R₁R₂; −R₁R₂ R₂²], ωn² = 2k(R₁²/I_T + R₂²/I_P), θ₂ = −(R₂/R₁)(I_T/I_P)θ₁',
    run: () => {
      const IT = 0.05;
      const IP = 0.4;
      const R1 = 0.05;
      const R2 = 0.2;
      const beltK = (k: number) => matScale([[R1 * R1, -R1 * R2], [-R1 * R2, R2 * R2]], 2 * k);
      const M = diag([IT, IP]);
      const m = modes(beltK(2e5), M);
      // Part (3): k for a 10 Hz elastic mode.
      const k10 = (20 * Math.PI) ** 2 / (2 * (R1 * R1 / IT + R2 * R2 / IP));
      const m10 = modes(beltK(k10), M);
      return [
        isTrue('one zero frequency (steady rotation)', m.omega[0] === 0, `ω₁ = ${m.omega[0]}`),
        nearAbs('rigid mode θ₂/θ₁ = R₁/R₂ = 0.25 (not 1)', m.P[1][0], R1 / R2, 1e-12),
        near('ωn² = 2k(R₁²/I_T + R₂²/I_P) = 6×10⁴ s⁻²', m.omega2[1], 6e4, 1e-13),
        near('elastic mode θ₂/θ₁ = −(R₂/R₁)(I_T/I_P) = −0.5', m.P[1][1], -0.5, 1e-13),
        near('part (3): k for 10 Hz gives fn = 10 Hz', m10.omega[1] / TWO_PI, 10, 1e-13),
      ];
    },
  },
  {
    id: 'disc-mdof-antiresonance',
    topic: 'core',
    title: 'Anti-resonances and receptances of the 2-DoF chain',
    source: 'Summary notes A4 (official 2018 A1.8, 2019 Q1g); LA6 Eqs 6.10–6.13 (m₁ = 2, k₁ = 300, m₂ = 0.5, k₂ = 50)',
    run: () => {
      const [m1, k1, m2, k2] = [2, 300, 0.5, 50];
      const K = chainK([k1, k2]);
      const M = diag([m1, m2]);
      const wa1 = antiresonance2(K, M, 0);
      const wa2 = antiresonance2(K, M, 1);
      const sweep = logspace(0.1, 100, 4000);
      let crossDev = 0;
      const a11: number[] = [];
      const a12: number[] = [];
      for (const W of sweep) {
        const R = receptanceUndamped(K, M, W);
        a11.push(R[0][0]);
        a12.push(R[0][1]);
        crossDev = Math.max(crossDev, Math.abs(R[0][1] * detKM(K, M, W * W) - k2) / k2);
      }
      const Rc = receptance(K, M, 7.3);
      const Ru = receptanceUndamped(K, M, 7.3);
      const recDiff = Math.max(...Rc.flatMap((row, i) => row.map((z, j) => Math.hypot(z.re - Ru[i][j], z.im))));
      const s11 = suppressionFrequencies(K, M, [1, 0], 0);
      const s22 = suppressionFrequencies(K, M, [0, 1], 1);
      // Forced response with damping: X = (K − Ω²M + iΩC)⁻¹F against the receptance matrix.
      const Cd = [
        [0.4, -0.1],
        [-0.1, 0.1],
      ];
      const F = [3, -2];
      const Xh = harmonicResponse(K, M, F, 9.1, Cd);
      const Rh = receptance(K, M, 9.1, Cd);
      const viaR = Rh.map((row) => row.reduce((s, z, j) => ({ re: s.re + z.re * F[j], im: s.im + z.im * F[j] }), c(0)));
      const hrDiff = Math.max(...Xh.map((z, i) => cabs(csub(z, viaR[i])) / cabs(viaR[i])));
      const P = modes(K, M).P;
      return [
        near('force on m₁: X₁ = 0 at √(k₂/m₂) = 10 rad/s', wa1, Math.sqrt(k2 / m2), 1e-15),
        near('force on m₂: X₂ = 0 at √((k₁ + k₂)/m₁) = 13.229 rad/s', wa2, Math.sqrt((k1 + k2) / m1), 1e-15),
        nearAbs('α₁₁ really vanishes there (|α₁₁|·k₂)', Math.abs(receptanceUndamped(K, M, wa1)[0][0]) * k2, 0, 1e-12),
        nearAbs('α₂₂ really vanishes there (|α₂₂|·(k₁ + k₂))', Math.abs(receptanceUndamped(K, M, wa2)[1][1]) * (k1 + k2), 0, 1e-12),
        near('antiresonances(K, M, 0) agrees', antiresonances(K, M, 0)[0], wa1, 1e-13),
        near('antiresonances(K, M, 1) agrees', antiresonances(K, M, 1)[0], wa2, 1e-13),
        near('suppressionFrequencies(F on m₁, X₁) = [10]', s11[0], wa1, 1e-12),
        near('suppressionFrequencies(F on m₂, X₂) = [13.229]', s22[0], wa2, 1e-12),
        nearAbs('cross receptance: α₁₂·det(K − Ω²M) = k₂ on the whole sweep (max rel. dev.)', crossDev, 0, 1e-9),
        isTrue('cross receptance has no zero (suppressionFrequencies empty)', suppressionFrequencies(K, M, [1, 0], 1).length === 0),
        isTrue('α₁₂ changes sign only at the 2 resonances', signChanges(a12) === 2, `${signChanges(a12)} sign changes`),
        isTrue('α₁₁ changes sign 3 times (2 resonances + 1 anti-resonance)', signChanges(a11) === 3, `${signChanges(a11)} sign changes`),
        nearAbs('complex receptance with C = 0 equals the undamped one', recDiff, 0, 1e-15),
        nearAbs('harmonicResponse(F) = receptance · F (damped, max rel. diff)', hrDiff, 0, 1e-13),
        nearAbs('modal forces PᵀF', vecDiff(modalForces(P, F), [F[0] + P[1][0] * F[1], F[0] + P[1][1] * F[1]]), 0, 1e-13),
      ];
    },
  },
  {
    id: 'disc-mdof-modal-ic',
    topic: 'core',
    title: 'Modal initial conditions use P⁻¹, not Pᵀ',
    source: 'Summary notes A3 and trap 3; LA5 Eq 5.28 (Y₀ = P⁻¹X₀ = (PᵀMP)⁻¹PᵀM X₀)',
    run: () => {
      const K = chainK([200, 100]);
      const M = diag([1, 2]);
      const { P } = modes(K, M);
      const x0 = [0.01, -0.005];
      const v0 = [0, 0.2];
      const { y0, yd0 } = modalInitialConditions(P, x0, v0);
      const PtX = matVec(transpose(P), x0);
      const { Mstar } = modalMatrices(P, M, K);
      const viaOrtho = matVec(inv(Mstar), matVec(transpose(P), matVec(M, x0)));
      const only2 = modalInitialConditions(P, col(P, 1), [0, 0]).y0;
      return [
        nearAbs('P Y₀ = X₀', vecDiff(matVec(P, y0), x0), 0, 1e-16),
        nearAbs('P Ẏ₀ = V₀', vecDiff(matVec(P, yd0), v0), 0, 1e-16),
        nearAbs('Y₀ = (PᵀMP)⁻¹PᵀM X₀ (orthogonality form)', vecDiff(y0, viaOrtho), 0, 1e-15),
        isTrue('PᵀX₀ is NOT the answer when P is not orthogonal', vecDiff(PtX, y0) > 0.1 * norm(y0), `|PᵀX₀ − Y₀| = ${fmt(vecDiff(PtX, y0))}`),
        nearAbs('X₀ ∝ mode 2 excites only mode 2: y₁₀ = 0', only2[0], 0, 1e-15),
        near('… and y₂₀ = 1', only2[1], 1, 1e-14),
      ];
    },
  },
  {
    id: 'disc-mdof-free-rk4',
    topic: 'core',
    title: 'Modal superposition vs RK4 for M x″ + K x = 0',
    source: 'RK4 (src/physics/ode.ts) on the same equations; LA5 modal superposition',
    run: () => {
      const out: CheckResult[] = [];
      const cases: { name: string; K: Mat; M: Mat; x0: Vec; v0: Vec }[] = [
        { name: 'chain m = [1, 2], k = [200, 100]', K: chainK([200, 100]), M: diag([1, 2]), x0: [0.01, -0.005], v0: [0, 0.2] },
        { name: 'free–free m = [1, 3], k = 300 (rigid-body drift)', K: [[300, -300], [-300, 300]], M: diag([1, 3]), x0: [0, 0.01], v0: [1, 0] },
      ];
      for (const cs of cases) {
        const m = modes(cs.K, cs.M);
        const { y0, yd0 } = modalInitialConditions(m.P, cs.x0, cs.v0);
        const wMin = m.omega.find((w) => w > 0) ?? 1;
        const T = TWO_PI / wMin;
        const h = TWO_PI / m.omega[m.omega.length - 1] / 2000;
        const sim = rk4Undamped(cs.M, cs.K, cs.x0, cs.v0, 3 * T, h);
        let err = 0;
        let big = 0;
        sim.t.forEach((t, k) => {
          const x = modalFreeResponse(m.P, m.omega, y0, yd0, t);
          for (let i = 0; i < x.length; i++) {
            err = Math.max(err, Math.abs(x[i] - sim.y[k][i]));
            big = Math.max(big, Math.abs(sim.y[k][i]));
          }
        });
        out.push(nearAbs(`${cs.name}: max |x_modal − x_RK4| / max|x|`, err / big, 0, 1e-6));
      }
      return out;
    },
  },
  {
    id: 'disc-mdof-3dof',
    topic: 'core',
    title: '3-DoF chain: characteristic polynomial vs Jacobi, and node counts',
    source: 'LA3: det(K − ω²M) = 0 solved two ways; summary notes: higher modes have more nodes',
    run: () => {
      const K = chainK([400, 300, 200]);
      const M = diag([1, 1.5, 2]);
      const m = modes(K, M);
      const rootsL = polyRoots(charPoly(K, M)).map((z) => z.re);
      const out: CheckResult[] = [ascending('ω ascending', m.omega)];
      for (let i = 0; i < 3; i++) {
        out.push(near(`ω${i + 1}² from charPoly roots = Jacobi`, rootsL[i], m.omega2[i], 1e-12));
        out.push(nearAbs(`det(K − ω${i + 1}²M)/det K = 0`, detKM(K, M, m.omega2[i]) / det(K), 0, 1e-11));
        out.push(isTrue(`mode ${i + 1} has ${i} node(s) (sign changes)`, signChanges(col(m.P, i)) === i));
      }
      const unc = uncoupledFrequencies(K, M);
      out.push(isTrue('ω₁ below and ω₃ above every uncoupled √(Kᵢᵢ/Mᵢᵢ)', m.omega[0] < Math.min(...unc) && m.omega[2] > Math.max(...unc)));
      // Summary notes A4: the cross receptance vanishes nowhere end to end, but can between neighbours.
      out.push(isTrue('F on m₁: end-to-end X₃ never vanishes', suppressionFrequencies(K, M, [1, 0, 0], 2).length === 0));
      const s12 = suppressionFrequencies(K, M, [1, 0, 0], 1);
      out.push(isTrue('F on m₁: X₂ vanishes once …', s12.length === 1));
      out.push(near('… at √(k₃/m₃), m₃ acting as an absorber on m₂', s12[0], Math.sqrt(200 / 2), 1e-12));
      const dp = suppressionFrequencies(K, M, [0, 1, 0], 1);
      const ar = antiresonances(K, M, 1);
      out.push(isTrue('driving point m₂: 2 anti-resonances', dp.length === 2 && ar.length === 2));
      out.push(nearAbs('Δᵢ = 0 roots agree with the held-coordinate frequencies', vecDiff(dp, ar) / ar[1], 0, 1e-12));
      return out;
    },
  },
  // ------------------------------------------------------------------ absorber
  {
    id: 'disc-absorber-tuned',
    topic: 'core',
    title: 'Tuned absorber β = 1: r₁r₂ = 1 and μ = (r − 1/r)²',
    source: 'LA6 Eq 6.22 (β = 1, μ = 0.2 example: r = 0.8011, 1.2483); 2025 A1.2 table (μ = 0.01: 0.951, 1.051; μ = 0.05: 0.894, 1.118)',
    run: () => {
      const out: CheckResult[] = [];
      for (const mu of [0.05, 0.2, 1]) {
        const [r1, r2] = tunedRatios(mu);
        const [g1, g2] = generalRatios(mu, 1);
        out.push(near(`μ = ${mu}: r₁r₂ = 1`, r1 * r2, 1, 1e-15));
        out.push(near(`μ = ${mu}: muFromRatio(r₁) = μ`, muFromRatio(r1), mu, 1e-13));
        out.push(near(`μ = ${mu}: muFromRatio(r₂) = μ`, muFromRatio(r2), mu, 1e-13));
        out.push(near(`μ = ${mu}: Eq 6.23 with β = 1 gives the same r₁`, g1, r1, 1e-14));
        out.push(near(`μ = ${mu}: Eq 6.23 with β = 1 gives the same r₂`, g2, r2, 1e-14));
        out.push(isTrue(`μ = ${mu}: r₁ < 1 < r₂`, r1 < 1 && r2 > 1));
      }
      const [a1, a2] = tunedRatios(0.2);
      out.push(nearAbs('LA6 example μ = 0.2: r₁ = 0.8011', a1, 0.8011, 5e-5));
      out.push(nearAbs('LA6 example μ = 0.2: r₂ = 1.2483', a2, 1.2483, 5e-5));
      out.push(nearAbs('μ = 0.01: r = 0.951', tunedRatios(0.01)[0], 0.951, 5e-4));
      out.push(nearAbs('μ = 0.01: r = 1.051', tunedRatios(0.01)[1], 1.051, 5e-4));
      out.push(nearAbs('μ = 0.05: r = 0.894', tunedRatios(0.05)[0], 0.894, 5e-4));
      out.push(nearAbs('μ = 0.05: r = 1.118', tunedRatios(0.05)[1], 1.118, 5e-4));
      return out;
    },
  },
  {
    id: 'disc-absorber-general',
    topic: 'core',
    title: 'Untuned absorber (Eq 6.23) and 2025 A1.1',
    source: 'LA6 Eq 6.23; 2025 A1.1 worked solution (μ = 1/500, k₁ = 460k₂: β = √(25/23), ω_high/ω_low = 1.0638, ω/ω₁₁ = 0.9900 and 1.0531)',
    run: () => {
      const out: CheckResult[] = [];
      const mu = 0.1;
      for (const beta of [0.8, 1.25]) {
        const [r1, r2] = generalRatios(mu, beta);
        out.push(near(`β = ${beta}: r₁²r₂² = 1/β²`, r1 * r1 * r2 * r2, 1 / (beta * beta), 1e-14));
        for (const r of [r1, r2]) {
          const B = 1 + (1 + mu) * beta * beta;
          out.push(nearAbs(`β = ${beta}: Eq 6.23 residual at r = ${fmt(r)}`, beta * beta * r ** 4 - B * r * r + 1, 0, 1e-14));
        }
      }
      const b25 = Math.sqrt(25 / 23);
      const [q1, q2] = generalRatios(0.002, b25);
      out.push(near('2025 A1.1: ω_high/ω_low = 1.0638', q2 / q1, 1.0638, 1e-4));
      out.push(nearAbs('2025 A1.1: lower ω/ω₁₁ = rβ = 0.9900', q1 * b25, 0.99, 5e-5));
      out.push(nearAbs('2025 A1.1: upper ω/ω₁₁ = rβ = 1.0531', q2 * b25, 1.0531, 5e-5));
      // A chain with mu = 0.1, beta = 0.8: m1 = 10, k1 = 1e4, m2 = 1, k2 = m2 (beta w11)^2.
      const [m1, k1, m2] = [10, 1e4, 1];
      const w11 = Math.sqrt(k1 / m1);
      const k2 = m2 * (0.8 * w11) ** 2;
      const cf = chainFrequencies(m1, k1, m2, k2);
      const ge = genSymEig(chainK([k1, k2]), diag([m1, m2])).omega2.map(Math.sqrt);
      const gr = generalRatios(m2 / m1, 0.8);
      const w22 = Math.sqrt(k2 / m2);
      out.push(near('chainFrequencies ω₁ = genSymEig', cf[0], ge[0], 1e-13));
      out.push(near('chainFrequencies ω₂ = genSymEig', cf[1], ge[1], 1e-13));
      out.push(near('chainFrequencies/ω₂₂ = generalRatios (r₁)', cf[0] / w22, gr[0], 1e-13));
      out.push(near('chainFrequencies/ω₂₂ = generalRatios (r₂)', cf[1] / w22, gr[1], 1e-13));
      return out;
    },
  },
  {
    id: 'disc-absorber-amplitude',
    topic: 'core',
    title: 'Absorber response: anti-resonance and a direct receptance check',
    source: 'LC4 §3.5 (Rao 9.11.2) amplitude formula vs (K − Ω²M + iΩC)⁻¹; LA6 Eqs 6.20–6.21; 2025 A1.2 (|X₁k₁/F₀| = 43, 40, 11)',
    run: () => {
      const out: CheckResult[] = [];
      out.push(nearAbs('μ = 0.2, β = 1: X₁ = 0 at g = β (ζ = 0)', primaryAmplitude(0.2, 1, 1, 0), 0, 0));
      out.push(nearAbs('μ = 0.1, β = 0.9: X₁ = 0 at g = β (ζ = 0)', primaryAmplitude(0.1, 0.9, 0.9, 0), 0, 0));
      const [m1, k1, m2, k2] = [10, 1e4, 1, 900];
      const w11 = Math.sqrt(k1 / m1);
      const mu = m2 / m1;
      const beta = Math.sqrt(k2 / m2) / w11;
      const K = chainK([k1, k2]);
      const M = diag([m1, m2]);
      const zeta = 0.1;
      const c2 = 2 * zeta * m2 * w11;
      const Cd = [
        [c2, -c2],
        [-c2, c2],
      ];
      for (const g of [0.3, 0.8, 1.1, 1.7]) {
        const W = g * w11;
        const R = receptanceUndamped(K, M, W);
        const Rd = receptance(K, M, W, Cd);
        out.push(near(`g = ${g}: |X₁|/(F₀/k₁) = |α₁₁|k₁ (undamped)`, primaryAmplitude(mu, beta, g), Math.abs(R[0][0]) * k1, 1e-12));
        out.push(near(`g = ${g}: |X₂|/(F₀/k₁) = |α₂₁|k₁ (undamped)`, absorberAmplitude(mu, beta, g), Math.abs(R[1][0]) * k1, 1e-12));
        out.push(near(`g = ${g}: damped |X₁| matches (K − Ω²M + iΩC)⁻¹ (ζ = 0.1)`, primaryAmplitude(mu, beta, g, zeta), cabs(Rd[0][0]) * k1, 1e-12));
        out.push(near(`g = ${g}: damped |X₂| matches`, absorberAmplitude(mu, beta, g, zeta), cabs(Rd[1][0]) * k1, 1e-12));
      }
      const b25 = Math.sqrt(25 / 23);
      out.push(nearAbs('2025 A1.2: g = 0.98 → 43', primaryAmplitude(0.002, b25, 0.98), 43, 0.5));
      out.push(nearAbs('2025 A1.2: g = 1.00 → 40', primaryAmplitude(0.002, b25, 1.0), 40, 0.5));
      out.push(nearAbs('2025 A1.2: g = 1.02 → 11', primaryAmplitude(0.002, b25, 1.02), 11, 0.5));
      out.push(nearAbs('2025 A1.2: no absorber at g = 0.98 → 25', magnification(0.98, 0), 25, 0.5));
      return out;
    },
  },
  {
    id: 'disc-absorber-denhartog',
    topic: 'core',
    title: 'Damped absorber: Den Hartog fixed points and optimum',
    source: 'Den Hartog / Rao 9.11.2 (cited in LC4 §3.5): every damping curve passes through two fixed points; at β = 1/(1 + μ) both have height √(1 + 2/μ)',
    run: () => {
      const out: CheckResult[] = [];
      const mu = 0.2;
      for (const beta of [1, 0.9]) {
        const gaps = scanRoots((g) => primaryAmplitude(mu, beta, g, 0.05) - primaryAmplitude(mu, beta, g, 1), 0.05, 2.5, 5000);
        const fp = denHartogFixedPoints(mu, beta);
        out.push(isTrue(`β = ${beta}: the ζ = 0.05 and ζ = 1 curves cross at exactly 2 points`, gaps.length === 2, `${gaps.length} crossings`));
        gaps.forEach((g, i) => {
          out.push(near(`β = ${beta}: crossing ${i + 1} at the fixed-point g = ${fmt(fp.g[i])}`, g, fp.g[i], 1e-9));
          const h = primaryAmplitude(mu, beta, g, 0.05);
          out.push(near(`β = ${beta}: ζ = 0.2 curve passes through point ${i + 1}`, primaryAmplitude(mu, beta, g, 0.2), h, 1e-8));
          out.push(near(`β = ${beta}: ζ = 1 curve passes through point ${i + 1}`, primaryAmplitude(mu, beta, g, 1), h, 1e-8));
          out.push(near(`β = ${beta}: point ${i + 1} height = 1/|1 − (1 + μ)g²|`, h, fp.amp[i], 1e-8));
        });
      }
      const opt = denHartogOptimum(mu);
      const fpo = denHartogFixedPoints(mu, opt.beta);
      out.push(near('optimum β = 1/(1 + μ) = 0.8333', opt.beta, 1 / 1.2, 1e-15));
      out.push(near('optimum ζ = √(3μ/(8(1 + μ)³)) = 0.2083', opt.zeta, Math.sqrt(0.6 / (8 * 1.728)), 1e-14));
      out.push(near('at the optimum β both fixed points have height √(1 + 2/μ) (P)', fpo.amp[0], Math.sqrt(1 + 2 / mu), 1e-12));
      out.push(near('… and (Q)', fpo.amp[1], Math.sqrt(1 + 2 / mu), 1e-12));
      const gPeak = argmax((g) => primaryAmplitude(mu, opt.beta, g, opt.zeta), 0.3, 1.8);
      out.push(near('with the optimum ζ the highest peak is within 3% of √(1 + 2/μ)', primaryAmplitude(mu, opt.beta, gPeak, opt.zeta), Math.sqrt(1 + 2 / mu), 0.03));
      return out;
    },
  },
  {
    id: 'disc-absorber-sizing',
    topic: 'core',
    title: 'Absorber sizing for a frequency margin (2023 A1.4, Week 5 Q1)',
    source: '2023 A1.4 worked solution (m₁ = 2000 kg, 800 rpm, 30 %: μ = 0.531, m₂ = 1062 kg, k₂ = 7.45 MN/m, 560 and 1142.9 rpm); Week 5 Q1 (38 %: μ = 0.9859)',
    run: () => {
      const W = rpmToRad(800);
      const s = sizeTunedAbsorber(2000, W, 0.3);
      const k1 = 2000 * W * W;
      const [wl, wh] = chainFrequencies(2000, k1, s.m2, s.k2);
      const s38 = sizeTunedAbsorber(1, 1, 0.38);
      return [
        near('μ = (1/0.7 − 0.7)² = 0.5308', s.mu, 0.5308, 1e-4),
        near('m₂ = 1061.6 kg', s.m2, 1061.6, 1e-4),
        near('k₂ = m₂Ω² = 7.45 MN/m', s.k2, 7.45e6, 1e-3),
        near('r₂ = 1/r₁ = 1.4286', s.r2, 1 / 0.7, 1e-15),
        near('new lower critical speed 560 rpm', radToRpm(wl), 560, 1e-9),
        near('new upper critical speed 1142.9 rpm', radToRpm(wh), 1142.9, 1e-4),
        near('Week 5 Q1: 38 % margin needs μ = 0.9859', s38.mu, 0.9859, 1e-4),
        near('Week 5 Q1: r₂ = 1/0.62 = 1.6129', s38.r2, 1.6129, 1e-4),
        isTrue('upper new frequency is further than the margin (lower limit binds)', s38.r2 - 1 > 0.38),
      ];
    },
  },
  // ------------------------------------------------------------------ rigid body
  {
    id: 'disc-rigid-bouncepitch',
    topic: 'core',
    title: 'Bounce–pitch coupling and node positions',
    source: 'Summary notes A3: K = [k₁ + k₂, k₂b − k₁a; k₂b − k₁a, k₁a² + k₂b²], decoupled when k₁a = k₂b; node at x = −z/θ',
    run: () => {
      const K0 = bouncePitchK(30000, 1.2, 36000, 1.0);
      const K1 = bouncePitchK(30000, 1.2, 40000, 1.0);
      const M = bouncePitchM(1200, 1800);
      const m0 = modes(K0, M);
      const pitch = m0.P[0][0] === 0 ? 0 : 1; // the column with no bounce
      const pz = m0.P[0][1 - pitch] === 1 && m0.P[1][1 - pitch] === 0;
      return [
        nearAbs('k₁a = k₂b ⇒ off-diagonal = 0', K0[0][1], 0, 0),
        isTrue('decoupled K has no couplings', couplings(K0).length === 0),
        isTrue('k₁a ≠ k₂b ⇒ coupling (0, 1)', couplings(K1).length === 1 && couplings(K1)[0][0] === 0 && couplings(K1)[0][1] === 1),
        isTrue('bouncePitchK symmetric', isSymmetric(K1)),
        near('decoupled bounce ω = √((k₁ + k₂)/m)', Math.max(...m0.omega), Math.sqrt(66000 / 1200), 1e-13),
        near('decoupled pitch ω = √((k₁a² + k₂b²)/I)', Math.min(...m0.omega), Math.sqrt(79200 / 1800), 1e-13),
        isTrue('decoupled modes are pure bounce [1, 0] and pure pitch [0, 1]', pz && m0.P[1][pitch] === 1),
        isTrue('pure bounce has no node (Infinity)', nodePosition(1, 0) === Infinity),
        nearAbs('pure pitch node at the CoM', nodePosition(0, 1), 0, 0),
        near('node of (z, θ) = (0.5, 0.25) at x = −2', nodePosition(0.5, 0.25), -2, 1e-15),
      ];
    },
  },
  {
    id: 'disc-rigid-planar',
    topic: 'core',
    title: 'Planar mounts: symmetry decouples bounce; sway–rock matches LA7 Eq 7.6',
    source: 'Summary notes A5; LA7 Eqs 7.4–7.7 (4 springs kx = 5 kN/m, ky = 20 kN/m at x = ±0.4 m, 0.25 m below the CoM, m = 100 kg, ρ = 0.3 m) and Eq 7.11',
    run: () => {
      const [kx, ky, a, b, m, rho] = [5000, 20000, 0.25, 0.4, 100, 0.3];
      // Two springs per side in the plane: each planar mount carries 2kx, 2ky.
      const mounts = [
        { x: -b, y: -a, kx: 2 * kx, ky: 2 * ky },
        { x: b, y: -a, kx: 2 * kx, ky: 2 * ky },
      ];
      const K = planarK(mounts);
      const M = planarM(m, m * rho * rho);
      const md = modes(K, M);
      const wy = Math.sqrt((4 * ky) / m);
      const S = (kx / ky) * (rho / b) ** 2;
      const T = (a / rho) ** 2;
      const B = 1 + S * (1 + T);
      const lam = [(B - Math.sqrt(B * B - 4 * S)) / 2, (B + Math.sqrt(B * B - 4 * S)) / 2];
      const w76 = lam.map((L) => ((wy * b) / rho) * Math.sqrt(L));
      const unc = uncoupledFrequencies(K, M);
      const cp = couplings(K);
      // Centre of rotation of the low sway-rock mode: a mount there would not deflect.
      const low = col(md.P, 0);
      const cr = centreOfRotation(low[0], low[1], low[2]);
      const k0 = inclinedMount(0, 0, 3000, 1000, 0);
      const k90 = inclinedMount(0, 0, 3000, 1000, Math.PI / 2);
      const k30 = inclinedMount(0, 0, 3000, 1000, Math.PI / 6);
      return [
        isTrue('planarK symmetric', isSymmetric(K)),
        nearAbs('symmetric layout: K_yθ = Σky·x = 0 (bounce decoupled)', K[1][2], 0, 0),
        isTrue('only sway–rock coupled: couplings = [(0, 2)]', cp.length === 1 && cp[0][0] === 0 && cp[0][1] === 2),
        near('K_xθ = −Σkx·y = 4kx·a', K[0][2], 4 * kx * a, 1e-15),
        near('K_θθ = Σ(kx y² + ky x²) = 4kx a² + 4ky b²', K[2][2], 4 * kx * a * a + 4 * ky * b * b, 1e-15),
        near('bounce ω_y = √(4ky/m) (LA7 Eq 7.5)', md.omega[1], wy, 1e-13),
        near('coupled low mode = LA7 Eq 7.6', md.omega[0], w76[0], 1e-12),
        near('coupled high mode = LA7 Eq 7.6', md.omega[2], w76[1], 1e-12),
        isTrue('coupled pair straddles the uncoupled sway and rock values', md.omega[0] < Math.min(unc[0], unc[2]) && md.omega[2] > Math.max(unc[0], unc[2])),
        isTrue('mounts at CoM height: no couplings', couplings(planarK(mounts.map((q) => ({ ...q, y: 0 })))).length === 0),
        nearAbs('centre of rotation does not move (Δx = X − yθ)', low[0] - cr.y * low[2], 0, 1e-15),
        nearAbs('… (Δy = Y + xθ)', low[1] + cr.x * low[2], 0, 1e-15),
        isTrue('inclined mount at 0°: kx = k₁, ky = k₂, kxy = 0', k0.kx === 3000 && k0.ky === 1000 && k0.kxy === 0),
        near('inclined mount at 90°: kx = k₂', k90.kx, 1000, 1e-12),
        near('rotation invariant: kx + ky = k₁ + k₂ at 30°', k30.kx + k30.ky, 4000, 1e-15),
        near('rotation invariant: kx·ky − kxy² = k₁k₂ at 30°', k30.kx * k30.ky - (k30.kxy ?? 0) ** 2, 3e6, 1e-14),
        near('block 0.3 m × 0.4 m, 12 kg: I = m(w² + h²)/12 = 0.25 kg·m²', blockInertia(12, 0.3, 0.4), 0.25, 1e-14),
        near('rod 3 kg, 2 m: I_G = mL²/12 = 1 kg·m²', rodInertiaCentre(3, 2), 1, 1e-15),
        near('rod 3 kg, 2 m: I_end = mL²/3 = 4 kg·m²', rodInertiaEnd(3, 2), 4, 1e-15),
      ];
    },
  },
  // ------------------------------------------------------------------ damped
  {
    id: 'disc-damped-eigenvalues',
    topic: 'core',
    title: 'Damping ratios from eigenvalues (2019 Q1e, 2023 A1.1, 2025 A1.5)',
    source: 'Official 2019 Q1e answer (ζ = 0.0073 and 0.055); 2023 A1.1 and 2025 A1.5 worked solutions; ζ = −Re s/|s|, ωn = |s|',
    run: () => {
      const e1 = fromEigenvalue(c(-12.1, 1647.3));
      const e2 = fromEigenvalue(c(-321, 5825.0));
      // 2023 A1.1: MATLAB lists the higher pair first.
      const d23 = sortEigenvalues([c(-0.2717, 31.1078), c(-0.2717, -31.1078), c(-0.038, 11.3775), c(-0.038, -11.3775)]);
      const d25 = sortEigenvalues([c(-0.1455, 53.0366), c(-0.1455, -53.0366), c(-0.0171, 15.2933), c(-0.0171, -15.2933)]);
      return [
        nearAbs('2019: ζ₁ = 0.0073', e1.zeta, 0.0073, 5e-5),
        nearAbs('2019: ζ₂ = 0.055', e2.zeta, 0.055, 5e-4),
        near('2019: ωd = |Im s| = 1647.3 rad/s', e1.wd, 1647.3, 1e-15),
        isTrue('2023: sortEigenvalues keeps one entry per pair', d23.length === 2),
        near('2023: mode 1 ωn = |s| = 11.378 rad/s (lower pair, listed second)', d23[0].wn, 11.378, 1e-4),
        nearAbs('2023: ζ₁ = 0.00334', d23[0].zeta, 0.00334, 5e-6),
        near('2023: mode 2 ωn = 31.109 rad/s', d23[1].wn, 31.109, 1e-4),
        nearAbs('2023: ζ₂ = 0.00873', d23[1].zeta, 0.00873, 5e-6),
        near('2025: ωd₁ = 15.2933 rad/s', d25[0].wd, 15.2933, 1e-15),
        near('2025: ωd₂ = 53.0366 rad/s', d25[1].wd, 53.0366, 1e-15),
        nearAbs('2025: ζ₁ = 1.118×10⁻³', d25[0].zeta, 1.118e-3, 5e-7),
        nearAbs('2025: ζ₂ = 2.743×10⁻³', d25[1].zeta, 2.743e-3, 5e-7),
      ];
    },
  },
  {
    id: 'disc-damped-moderatio',
    topic: 'core',
    title: 'Mode shape from a MATLAB [P, D] column (2023 A1.2)',
    source: '2023 A1.2 worked solution: X₂/X₁ = 1.888∠0.06°, V₂/V₁ = 1.889∠0.04°, mode 2 V₂/V₁ = −0.397 (official 2019 Q1f: read the velocity rows too)',
    run: () => {
      const X = [c(-0.0002, -0.041), c(-0.0003, -0.0774)];
      const V = [c(0.466, -0.0003), c(0.8804, 0)];
      const V2 = [c(0.929, 0), c(-0.3688, 0.0007)];
      const rx = modeRatio(X, 0, 1);
      const rv = modeRatio(V, 0, 1);
      const r2 = modeRatio(V2, 0, 1);
      return [
        nearAbs('X₂/X₁ magnitude 1.888', rx.mag, 1.888, 5e-4),
        nearAbs('X₂/X₁ phase 0.06° (in phase)', rx.phaseDeg, 0.06, 0.01),
        nearAbs('V₂/V₁ magnitude 1.889', rv.mag, 1.889, 5e-4),
        nearAbs('V₂/V₁ phase 0.04°', rv.phaseDeg, 0.04, 0.01),
        nearAbs('mode 2: |V₂/V₁| = 0.397', r2.mag, 0.397, 5e-4),
        isTrue('mode 2: phase ≈ 180° (out of phase)', Math.abs(r2.phaseDeg) > 179.8, `${fmt(r2.phaseDeg)}°`),
      ];
    },
  },
  {
    id: 'disc-damped-proportional',
    topic: 'core',
    title: 'Proportional damping C = αM + βK: ζᵢ = α/(2ωᵢ) + βωᵢ/2, real modes',
    source: 'LA9 Eqs 9.4–9.7 and summary notes A6 (3-DoF chain m = [1, 1.5, 2], k = [400, 300, 200], α = 0.4 s⁻¹, β = 0.002 s)',
    run: () => {
      const out: CheckResult[] = [];
      const K = chainK([400, 300, 200]);
      const M = diag([1, 1.5, 2]);
      const [alpha, beta] = [0.4, 0.002];
      const Cd = matScale(M, alpha).map((row, i) => row.map((v, j) => v + beta * K[i][j]));
      const und = modes(K, M, 'max');
      const all = dampedModes(M, Cd, K);
      const dm = dampedModesSorted(M, Cd, K);
      const A = stateMatrix(M, Cd, K);
      out.push(isTrue('6 eigenvalues in conjugate pairs', all.length === 6 && all.every((m, i) => (i % 2 ? m.s.im === -all[i - 1].s.im && m.s.re === all[i - 1].s.re : true))));
      out.push(isTrue('3 oscillatory modes after sorting', dm.length === 3));
      dm.forEach((m, i) => {
        const w = und.omega[i];
        out.push(near(`mode ${i + 1}: ωn = |s| = undamped ω${i + 1}`, m.wn, w, 1e-11));
        out.push(near(`mode ${i + 1}: ζ = α/(2ω) + βω/2 = ${fmt(rayleighZeta(alpha, beta, w))}`, m.zeta, rayleighZeta(alpha, beta, w), 1e-10));
        const re = m.X.map((z) => z.re);
        const imMax = Math.max(...m.X.map((z) => Math.abs(z.im)));
        out.push(nearAbs(`mode ${i + 1}: X is the real undamped mode`, Math.max(vecDiff(re, col(und.P, i)), imMax), 0, 1e-9));
        const rx = modeRatio(m.X, 0, 1);
        const rv = modeRatio(m.V, 0, 1);
        out.push(nearAbs(`mode ${i + 1}: X₂/X₁ = V₂/V₁`, Math.abs(rx.mag - rv.mag) + Math.abs(rx.phaseDeg - rv.phaseDeg), 0, 1e-9));
        out.push(nearAbs(`mode ${i + 1}: state-space residual |Az − sz|`, stateResidual(A, m), 0, 1e-12));
      });
      return out;
    },
  },
  {
    id: 'disc-damped-general',
    topic: 'core',
    title: 'Non-proportional damping: complex modes satisfy the state-space problem',
    source: 'LA9 Eq 9.12: Σs = trace A = −tr(M⁻¹C), Πs = det A = det K/det M (M = diag(2, 1), K = [300 −100; −100 100], damper c = 3 on m₂ only)',
    run: () => {
      const out: CheckResult[] = [];
      const M = diag([2, 1]);
      const K = [
        [300, -100],
        [-100, 100],
      ];
      const Cd = [
        [0, 0],
        [0, 3],
      ];
      const all = dampedModes(M, Cd, K);
      const A = stateMatrix(M, Cd, K);
      let sum = c(0);
      let prod = c(1);
      for (const m of all) {
        sum = { re: sum.re + m.s.re, im: sum.im + m.s.im };
        prod = cmul(prod, m.s);
      }
      out.push(isTrue('4 eigenvalues', all.length === 4));
      out.push(near('Σs = trace A = −tr(M⁻¹C) = −3', sum.re, -3, 1e-12));
      out.push(nearAbs('Σs imaginary part 0', sum.im, 0, 1e-12));
      out.push(near('Πs = det A = det K/det M = 10⁴', prod.re, 1e4, 1e-12));
      let maxPhase = 0;
      all.forEach((m, i) => {
        out.push(nearAbs(`eigenpair ${i + 1}: state-space residual`, stateResidual(A, m), 0, 1e-12));
        const rx = modeRatio(m.X, 0, 1);
        const rv = modeRatio(m.V, 0, 1);
        out.push(nearAbs(`eigenpair ${i + 1}: X₂/X₁ = V₂/V₁`, Math.abs(rx.mag - rv.mag) + Math.abs(rx.phaseDeg - rv.phaseDeg), 0, 1e-9));
        const ph = Math.abs(rx.phaseDeg);
        maxPhase = Math.max(maxPhase, Math.min(ph, 180 - ph));
      });
      out.push(isTrue('modes are genuinely complex (phase not 0°/180°)', maxPhase > 0.5, `max offset ${fmt(maxPhase)}°`));
      // Heavy damper on m1 to ground: one overdamped mode (two real roots) plus one pair.
      const Ch = [
        [120, 0],
        [0, 0],
      ];
      const heavy = dampedModes(M, Ch, K);
      const Ah = stateMatrix(M, Ch, K);
      const realRoots = heavy.filter((m) => m.s.im === 0);
      let hs = 0;
      let hp = c(1);
      for (const m of heavy) {
        hs += m.s.re;
        hp = cmul(hp, m.s);
      }
      out.push(isTrue('heavy damping: 2 real (overdamped) roots + 1 pair', realRoots.length === 2 && heavy.length === 4, heavy.map((m) => `${fmt(m.s.re)}${m.s.im ? `±${fmt(Math.abs(m.s.im))}i` : ''}`).join(', ')));
      out.push(near('heavy damping: Σs = −tr(M⁻¹C) = −60', hs, -60, 1e-12));
      out.push(near('heavy damping: Πs = det K/det M = 10⁴', hp.re, 1e4, 1e-12));
      out.push(nearAbs('heavy damping: worst state-space residual', Math.max(...heavy.map((m) => stateResidual(Ah, m))), 0, 1e-12));
      out.push(near('sorted list: real roots kept individually, pairs once (3 entries)', dampedModesSorted(M, Ch, K).length, 3, 0));
      return out;
    },
  },
  {
    id: 'disc-damped-sdof',
    topic: 'core',
    title: '1-DoF damped eigenvalues: s = −ζωn ± iωd',
    source: 'LA9 Eqs 9.9–9.11 (m = 2 kg, k = 800 N/m, so ωn = 20 rad/s)',
    run: () => {
      const M = [[2]];
      const K = [[800]];
      const u = dampedModes(M, [[8]], K);
      const o = dampedModes(M, [[160]], K);
      const cr = dampedModes(M, [[80]], K);
      const pr = fromRealPair(o[0].s.re, o[1].s.re);
      const A = stateMatrix(M, [[8]], K);
      return [
        isTrue('ζ = 0.1: one conjugate pair', u.length === 2 && u[0].s.im > 0 && u[1].s.im === -u[0].s.im),
        near('ζ = 0.1: ωn = |s| = 20', u[0].wn, 20, 1e-14),
        near('ζ = 0.1: ζ = −Re s/|s| = 0.1', u[0].zeta, 0.1, 1e-13),
        near('ζ = 0.1: ωd = 20√0.99', u[0].wd, 20 * Math.sqrt(0.99), 1e-14),
        isTrue('ζ = 0.1: X = [1], V = [s]', u[0].X[0].re === 1 && u[0].V[0].im === u[0].s.im),
        isTrue('ζ = 2: two real (overdamped) roots', o.length === 2 && o.every((m) => m.s.im === 0 && m.s.re < 0)),
        near('ζ = 2: s₁s₂ = ωn² = 400', o[0].s.re * o[1].s.re, 400, 1e-13),
        near('ζ = 2: fromRealPair recovers ωn = 20', pr.wn, 20, 1e-13),
        near('ζ = 2: fromRealPair recovers ζ = 2', pr.zeta, 2, 1e-13),
        nearAbs('ζ = 1: critically damped roots s ≈ −ωn', Math.max(...cr.map((m) => cabs(csub(m.s, c(-20))))) / 20, 0, 1e-7),
        nearAbs('state matrix [0 1; −k/m −c/m] (LA9 Eq 9.10)', vecDiff(A.flat(), [0, 1, -400, -4]), 0, 0),
      ];
    },
  },
  {
    id: 'disc-damped-rayleigh',
    topic: 'core',
    title: 'Rayleigh damping fit and the 2019 Q2(5) belt-drive result ζ = (c/2k)ωn',
    source: 'LA9 Eq 9.7; official 2019 Part A Q2(5) solution (C ∝ K: α = 0, β = c/k)',
    run: () => {
      const { alpha, beta } = rayleighCoefficients(0.02, 10, 0.05, 40);
      const IT = 0.05;
      const IP = 0.4;
      const R1 = 0.05;
      const R2 = 0.2;
      const [k, cb] = [2e5, 50];
      const shape = [
        [R1 * R1, -R1 * R2],
        [-R1 * R2, R2 * R2],
      ];
      const K = matScale(shape, 2 * k);
      const Cd = matScale(shape, 2 * cb);
      const dm = dampedModesSorted(diag([IT, IP]), Cd, K);
      const elastic = dm[dm.length - 1];
      const wn = Math.sqrt(2 * k * (R1 * R1 / IT + R2 * R2 / IP));
      return [
        near('fit: ζ(10 rad/s) = 0.02', rayleighZeta(alpha, beta, 10), 0.02, 1e-13),
        near('fit: ζ(40 rad/s) = 0.05', rayleighZeta(alpha, beta, 40), 0.05, 1e-13),
        isTrue('belt: rigid-body eigenvalues s = 0', dm.filter((m) => m.wn === 0).length === 2, dm.map((m) => fmt(m.wn)).join(', ')),
        near('belt: elastic ωn unchanged by C ∝ K', elastic.wn, wn, 1e-12),
        near('belt: ζ = (c/2k)ωn', elastic.zeta, (cb / (2 * k)) * wn, 1e-11),
        near('belt: ωd = ωn√(1 − ζ²) (part 6)', elastic.wd, dampedFrequency(wn, (cb / (2 * k)) * wn), 1e-11),
      ];
    },
  },
];
