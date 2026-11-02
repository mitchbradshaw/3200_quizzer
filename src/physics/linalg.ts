// Dense linear algebra on plain row-major arrays, sized for discrete vibration problems:
// LU solves, a Jacobi symmetric eigensolver, the generalised eigenproblem K phi = w^2 M phi
// (LA3-LA5, LA8) and complex solves for receptances (LA6) and damped modes (LA9).
// Pure functions: inputs are never mutated. An exactly singular matrix gives non-finite entries
// rather than a throw; only genSymEig throws (it needs a positive-definite mass matrix).
import type { C } from './complex';
import { cadd, csub, cmul, cdiv, cabs2, cneg } from './complex';

export type Vec = number[];
export type Mat = number[][];
export type CMat = C[][];

/** rows x cols matrix of zeros. */
export function zeros(rows: number, cols: number): Mat {
  const out: Mat = new Array(rows);
  for (let i = 0; i < rows; i++) out[i] = new Array<number>(cols).fill(0);
  return out;
}

/** n x n identity matrix I. */
export function eye(n: number): Mat {
  const out = zeros(n, n);
  for (let i = 0; i < n; i++) out[i][i] = 1;
  return out;
}

/** Copy of A whose rows can be mutated safely. */
export function clone(A: Mat): Mat {
  return A.map((row) => row.slice());
}

/** Transpose (A^T)_ij = A_ji. */
export function transpose(A: Mat): Mat {
  const r = A.length;
  const cols = r ? A[0].length : 0;
  const out = zeros(cols, r);
  for (let i = 0; i < r; i++) for (let j = 0; j < cols; j++) out[j][i] = A[i][j];
  return out;
}

/** Matrix product (A B)_ij = sum_k A_ik B_kj. */
export function matMul(A: Mat, B: Mat): Mat {
  const n = A.length;
  const inner = B.length;
  const p = inner ? B[0].length : 0;
  const out = zeros(n, p);
  for (let i = 0; i < n; i++) {
    const Ai = A[i];
    const Oi = out[i];
    for (let k = 0; k < inner; k++) {
      const a = Ai[k];
      const Bk = B[k];
      for (let j = 0; j < p; j++) Oi[j] += a * Bk[j];
    }
  }
  return out;
}

/** Matrix-vector product (A x)_i = sum_j A_ij x_j. */
export function matVec(A: Mat, x: Vec): Vec {
  return A.map((row) => {
    let s = 0;
    for (let j = 0; j < row.length; j++) s += row[j] * x[j];
    return s;
  });
}

/** Element-wise sum A + B. */
export function matAdd(A: Mat, B: Mat): Mat {
  return A.map((row, i) => row.map((v, j) => v + B[i][j]));
}

/** Element-wise difference A - B. */
export function matSub(A: Mat, B: Mat): Mat {
  return A.map((row, i) => row.map((v, j) => v - B[i][j]));
}

/** Scalar multiple s A. */
export function matScale(A: Mat, s: number): Mat {
  return A.map((row) => row.map((v) => v * s));
}

/** Dot product a . b = sum_i a_i b_i. */
export function dot(a: Vec, b: Vec): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

/** Euclidean norm |a| = sqrt(sum a_i^2), scaled so it cannot overflow. */
export function norm(a: Vec): number {
  let scale = 0;
  for (const v of a) scale = Math.max(scale, Math.abs(v));
  if (scale === 0 || !Number.isFinite(scale)) return scale;
  let s = 0;
  for (const v of a) {
    const t = v / scale;
    s += t * t;
  }
  return scale * Math.sqrt(s);
}

// ---------------------------------------------------------------------------------------------
// Real LU with partial pivoting.

interface LUResult {
  lu: Mat; // unit-lower multipliers below the diagonal, U on and above it
  perm: number[]; // row i of P A is row perm[i] of A
  sign: number; // det(P)
}

function luFactor(A: Mat): LUResult {
  const n = A.length;
  const lu = clone(A);
  const perm = Array.from({ length: n }, (_, i) => i);
  let sign = 1;
  for (let k = 0; k < n; k++) {
    let p = k;
    let big = Math.abs(lu[k][k]);
    for (let i = k + 1; i < n; i++) {
      const v = Math.abs(lu[i][k]);
      if (v > big) {
        big = v;
        p = i;
      }
    }
    if (p !== k) {
      const tr = lu[k];
      lu[k] = lu[p];
      lu[p] = tr;
      const tp = perm[k];
      perm[k] = perm[p];
      perm[p] = tp;
      sign = -sign;
    }
    const piv = lu[k][k];
    if (piv === 0) continue; // the whole sub-column is zero: singular, nothing to eliminate
    for (let i = k + 1; i < n; i++) {
      const f = lu[i][k] / piv;
      lu[i][k] = f;
      if (f === 0) continue;
      const Li = lu[i];
      const Uk = lu[k];
      for (let j = k + 1; j < n; j++) Li[j] -= f * Uk[j];
    }
  }
  return { lu, perm, sign };
}

function luSolve(f: LUResult, b: Vec): Vec {
  const { lu, perm } = f;
  const n = lu.length;
  const x = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    let s = b[perm[i]];
    for (let j = 0; j < i; j++) s -= lu[i][j] * x[j];
    x[i] = s;
  }
  for (let i = n - 1; i >= 0; i--) {
    let s = x[i];
    for (let j = i + 1; j < n; j++) s -= lu[i][j] * x[j];
    x[i] = s / lu[i][i];
  }
  return x;
}

/** Determinant det A = det(P) prod U_kk from LU with partial pivoting (0 for a singular A). */
export function det(A: Mat): number {
  const n = A.length;
  if (n === 0) return 1;
  const { lu, sign } = luFactor(A);
  let d = sign;
  for (let k = 0; k < n; k++) d *= lu[k][k];
  return d;
}

/** Inverse A^-1 by LU with partial pivoting (non-finite entries if A is exactly singular). */
export function inv(A: Mat): Mat {
  const n = A.length;
  const f = luFactor(A);
  const out = zeros(n, n);
  const e = new Array<number>(n).fill(0);
  for (let j = 0; j < n; j++) {
    e.fill(0);
    e[j] = 1;
    const col = luSolve(f, e);
    for (let i = 0; i < n; i++) out[i][j] = col[i];
  }
  return out;
}

/** Solution x of A x = b by LU with partial pivoting. */
export function solve(A: Mat, b: Vec): Vec {
  return luSolve(luFactor(A), b);
}

/** True if A is square and |A_ij - A_ji| <= tol * max|A_kl| for every i, j. */
export function isSymmetric(A: Mat, tol = 1e-9): boolean {
  const n = A.length;
  let big = 0;
  for (const row of A) {
    if (row.length !== n) return false;
    for (const v of row) big = Math.max(big, Math.abs(v));
  }
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) if (!(Math.abs(A[i][j] - A[j][i]) <= tol * big)) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------------------------
// Symmetric eigenproblems.

const symmetrised = (A: Mat): Mat => A.map((row, i) => row.map((v, j) => 0.5 * (v + A[j][i])));

/** Flip each column so its first significant entry (|v| > 1e-9 max|v|) is positive. Mutates P. */
function fixSigns(P: Mat): Mat {
  const n = P.length;
  const m = n ? P[0].length : 0;
  for (let j = 0; j < m; j++) {
    let big = 0;
    for (let i = 0; i < n; i++) big = Math.max(big, Math.abs(P[i][j]));
    for (let i = 0; i < n; i++) {
      if (Math.abs(P[i][j]) > 1e-9 * big) {
        if (P[i][j] < 0) for (let k = 0; k < n; k++) P[k][j] = -P[k][j];
        break;
      }
    }
  }
  return P;
}

/** A = V diag(values) V^T for symmetric A by cyclic Jacobi rotations; values ascending, unit eigenvectors as columns. */
export function symEig(A: Mat): { values: number[]; vectors: Mat } {
  const n = A.length;
  const a = symmetrised(A);
  const V = eye(n);
  let frob = 0;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) frob += a[i][j] * a[i][j];
  for (let sweep = 0; sweep < 100; sweep++) {
    let off = 0;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += a[p][q] * a[p][q];
    if (off === 0 || off <= 1e-32 * frob) break;
    for (let p = 0; p < n - 1; p++) {
      for (let q = p + 1; q < n; q++) {
        const apq = a[p][q];
        if (apq === 0) continue;
        const app = a[p][p];
        const aqq = a[q][q];
        // After a few sweeps, drop off-diagonal terms below the rounding level of both diagonals.
        const g = 100 * Math.abs(apq);
        if (sweep > 3 && Math.abs(app) + g === Math.abs(app) && Math.abs(aqq) + g === Math.abs(aqq)) {
          a[p][q] = 0;
          a[q][p] = 0;
          continue;
        }
        const theta = (aqq - app) / (2 * apq);
        const t =
          Math.abs(theta) > 1e150
            ? 1 / (2 * theta)
            : (theta >= 0 ? 1 : -1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const cs = 1 / Math.sqrt(t * t + 1);
        const sn = t * cs;
        for (let k = 0; k < n; k++) {
          const akp = a[k][p];
          const akq = a[k][q];
          a[k][p] = cs * akp - sn * akq;
          a[k][q] = sn * akp + cs * akq;
        }
        for (let k = 0; k < n; k++) {
          const apk = a[p][k];
          const aqk = a[q][k];
          a[p][k] = cs * apk - sn * aqk;
          a[q][k] = sn * apk + cs * aqk;
        }
        a[p][q] = 0; // zero by construction of the rotation
        a[q][p] = 0;
        for (let k = 0; k < n; k++) {
          const vkp = V[k][p];
          const vkq = V[k][q];
          V[k][p] = cs * vkp - sn * vkq;
          V[k][q] = sn * vkp + cs * vkq;
        }
      }
    }
  }
  const order = Array.from({ length: n }, (_, i) => i).sort((i, j) => a[i][i] - a[j][j]);
  const values = order.map((i) => a[i][i]);
  const vectors = zeros(n, n);
  order.forEach((src, dst) => {
    for (let k = 0; k < n; k++) vectors[k][dst] = V[k][src];
  });
  return { values, vectors: fixSigns(vectors) };
}

/** Lower-triangular L with M = L L^T (throws if M is not positive definite). */
function cholesky(M: Mat): Mat {
  const n = M.length;
  const L = zeros(n, n);
  for (let j = 0; j < n; j++) {
    let d = M[j][j];
    for (let k = 0; k < j; k++) d -= L[j][k] * L[j][k];
    if (!(d > 0) || !Number.isFinite(d)) throw new Error('genSymEig: the mass matrix M must be symmetric positive definite');
    const ljj = Math.sqrt(d);
    L[j][j] = ljj;
    for (let i = j + 1; i < n; i++) {
      let s = M[i][j];
      for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
      L[i][j] = s / ljj;
    }
  }
  return L;
}

/** Solves L X = B for lower-triangular L (column by column). */
function forwardSub(L: Mat, B: Mat): Mat {
  const n = L.length;
  const m = B.length ? B[0].length : 0;
  const X = zeros(n, m);
  for (let c = 0; c < m; c++) {
    for (let i = 0; i < n; i++) {
      let s = B[i][c];
      for (let k = 0; k < i; k++) s -= L[i][k] * X[k][c];
      X[i][c] = s / L[i][i];
    }
  }
  return X;
}

/** Solves L^T X = B for lower-triangular L. */
function backSubT(L: Mat, B: Mat): Mat {
  const n = L.length;
  const m = B.length ? B[0].length : 0;
  const X = zeros(n, m);
  for (let c = 0; c < m; c++) {
    for (let i = n - 1; i >= 0; i--) {
      let s = B[i][c];
      for (let k = i + 1; k < n; k++) s -= L[k][i] * X[k][c];
      X[i][c] = s / L[i][i];
    }
  }
  return X;
}

/** K phi = w^2 M phi via Cholesky M = L L^T and Jacobi on L^-1 K L^-T; ascending, M-orthonormal columns, |w^2| < 1e-10 max clamped to 0 (LA3 Eq 3.9, LA8); throws if M is not positive definite. */
export function genSymEig(K: Mat, M: Mat): { omega2: number[]; modes: Mat } {
  const L = cholesky(symmetrised(M));
  const Y = forwardSub(L, symmetrised(K)); // L^-1 K
  const A = forwardSub(L, transpose(Y)); // L^-1 K L^-T (symmetric)
  const { values, vectors } = symEig(A);
  const phi = backSubT(L, vectors); // phi = L^-T y, so phi^T M phi = y^T y = 1
  let big = 0;
  for (const v of values) big = Math.max(big, Math.abs(v));
  const omega2 = values.map((v) => (Math.abs(v) < 1e-10 * big ? 0 : v));
  return { omega2, modes: fixSigns(phi) };
}

/** Scale each column so its 'first' significant entry (|v| > 1e-9 max|v|; course style P = [1 1; r1 r2]) or its largest-|v| entry ('max') is +1; rounding noise below 1e-13 max|v| is set to 0. */
export function normaliseColumns(P: Mat, how: 'first' | 'max'): Mat {
  const n = P.length;
  const m = n ? P[0].length : 0;
  const out = clone(P);
  for (let j = 0; j < m; j++) {
    let big = 0;
    for (let i = 0; i < n; i++) big = Math.max(big, Math.abs(P[i][j]));
    if (big === 0 || !Number.isFinite(big)) continue;
    let ref = 0;
    for (let i = 0; i < n; i++) {
      const a = Math.abs(P[i][j]);
      if (how === 'first' ? a > 1e-9 * big : a >= (1 - 1e-9) * big) {
        ref = i;
        break;
      }
    }
    const v = P[ref][j];
    for (let i = 0; i < n; i++) out[i][j] = Math.abs(P[i][j]) < 1e-13 * big ? 0 : P[i][j] / v;
    out[ref][j] = 1;
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Complex matrices.

/** Real matrix as a complex matrix (imaginary parts 0). */
export function cmatFromReal(A: Mat): CMat {
  return A.map((row) => row.map((v) => ({ re: v, im: 0 })));
}

interface CLUResult {
  lu: CMat;
  perm: number[];
  sign: number;
}

const czero = (z: C) => z.re === 0 && z.im === 0;

function cluFactor(A: CMat): CLUResult {
  const n = A.length;
  const lu = A.map((row) => row.map((z) => ({ re: z.re, im: z.im })));
  const perm = Array.from({ length: n }, (_, i) => i);
  let sign = 1;
  for (let k = 0; k < n; k++) {
    let p = k;
    let big = cabs2(lu[k][k]);
    for (let i = k + 1; i < n; i++) {
      const v = cabs2(lu[i][k]);
      if (v > big) {
        big = v;
        p = i;
      }
    }
    if (p !== k) {
      const tr = lu[k];
      lu[k] = lu[p];
      lu[p] = tr;
      const tp = perm[k];
      perm[k] = perm[p];
      perm[p] = tp;
      sign = -sign;
    }
    const piv = lu[k][k];
    if (czero(piv)) continue;
    for (let i = k + 1; i < n; i++) {
      if (czero(lu[i][k])) continue;
      const f = cdiv(lu[i][k], piv);
      lu[i][k] = f;
      for (let j = k + 1; j < n; j++) lu[i][j] = csub(lu[i][j], cmul(f, lu[k][j]));
    }
  }
  return { lu, perm, sign };
}

function cluSolve(f: CLUResult, b: C[]): C[] {
  const { lu, perm } = f;
  const n = lu.length;
  const x: C[] = new Array(n);
  for (let i = 0; i < n; i++) {
    let s = b[perm[i]];
    for (let j = 0; j < i; j++) s = csub(s, cmul(lu[i][j], x[j]));
    x[i] = s;
  }
  for (let i = n - 1; i >= 0; i--) {
    let s = x[i];
    for (let j = i + 1; j < n; j++) s = csub(s, cmul(lu[i][j], x[j]));
    x[i] = cdiv(s, lu[i][i]);
  }
  return x;
}

/** Solution x of the complex system A x = b (LU with partial pivoting). */
export function cmatSolve(A: CMat, b: C[]): C[] {
  return cluSolve(cluFactor(A), b);
}

/** Complex inverse A^-1 (LU with partial pivoting; non-finite entries if A is exactly singular). */
export function cmatInv(A: CMat): CMat {
  const n = A.length;
  const f = cluFactor(A);
  const out: CMat = Array.from({ length: n }, () => new Array<C>(n));
  for (let j = 0; j < n; j++) {
    const e: C[] = Array.from({ length: n }, (_, i) => ({ re: i === j ? 1 : 0, im: 0 }));
    const col = cluSolve(f, e);
    for (let i = 0; i < n; i++) out[i][j] = col[i];
  }
  return out;
}

/** Complex determinant det A = det(P) prod U_kk (LU with partial pivoting). */
export function cdet(A: CMat): C {
  const n = A.length;
  const { lu, sign } = cluFactor(A);
  let d: C = { re: sign, im: 0 };
  for (let k = 0; k < n; k++) d = cmul(d, lu[k][k]);
  return d;
}

/** Null vector x of a (near-)singular complex A (A x ~ 0) by complete-pivoting elimination with the last pivot taken as 0; scaled so the largest |x_i| entry is exactly 1. */
export function cNullVector(A: CMat): C[] {
  const n = A.length;
  if (n === 0) return [];
  const a = A.map((row) => row.map((z) => ({ re: z.re, im: z.im })));
  const col = Array.from({ length: n }, (_, i) => i); // column order after pivoting
  let rank = n - 1; // the last pivot is always treated as zero
  let first = 0;
  for (let k = 0; k < n - 1; k++) {
    let pi = k;
    let pj = k;
    let big = -1;
    for (let i = k; i < n; i++) {
      for (let j = k; j < n; j++) {
        const v = cabs2(a[i][j]);
        if (v > big) {
          big = v;
          pi = i;
          pj = j;
        }
      }
    }
    const mag = Math.sqrt(big);
    if (k === 0) first = mag;
    if (!(mag > 1e-13 * first)) {
      rank = k; // the rest of the matrix is numerically zero: several free variables
      break;
    }
    if (pi !== k) {
      const tr = a[k];
      a[k] = a[pi];
      a[pi] = tr;
    }
    if (pj !== k) {
      for (let i = 0; i < n; i++) {
        const t = a[i][k];
        a[i][k] = a[i][pj];
        a[i][pj] = t;
      }
      const tc = col[k];
      col[k] = col[pj];
      col[pj] = tc;
    }
    const piv = a[k][k];
    for (let i = k + 1; i < n; i++) {
      if (czero(a[i][k])) continue;
      const f = cdiv(a[i][k], piv);
      for (let j = k + 1; j < n; j++) a[i][j] = csub(a[i][j], cmul(f, a[k][j]));
      a[i][k] = { re: 0, im: 0 };
    }
  }
  // Free variables: y[n-1] = 1, y[rank..n-2] = 0; back-substitute the pivot rows.
  const y: C[] = Array.from({ length: n }, () => ({ re: 0, im: 0 }));
  y[n - 1] = { re: 1, im: 0 };
  for (let i = rank - 1; i >= 0; i--) {
    let s: C = { re: 0, im: 0 };
    for (let j = i + 1; j < n; j++) s = cadd(s, cmul(a[i][j], y[j]));
    y[i] = cneg(cdiv(s, a[i][i]));
  }
  const x: C[] = new Array(n);
  for (let i = 0; i < n; i++) x[col[i]] = y[i];
  let ref = 0;
  let big = -1;
  for (let i = 0; i < n; i++) {
    const v = cabs2(x[i]);
    if (v > big * (1 + 1e-12)) {
      big = v;
      ref = i;
    }
  }
  const scale = x[ref];
  const out = x.map((z) => cdiv(z, scale));
  out[ref] = { re: 1, im: 0 };
  return out;
}
