// Real-coefficient polynomials in ASCENDING order: p[k] multiplies x^k, so p = [p0, p1, p2]
// is p0 + p1 x + p2 x^2. Used for characteristic equations det(K - lambda M) = 0 (LA3) and
// det(M s^2 + C s + K) = 0 (LA9).
import type { C } from './complex';
import { cadd, csub, cmul, cdiv, cinv, cabs, cfromPolar, ONE, ZERO } from './complex';

const EPS = 2.220446049250313e-16;

/** p(x) = sum_k p_k x^k by Horner's rule. */
export function polyEval(p: number[], x: number): number {
  let s = 0;
  for (let k = p.length - 1; k >= 0; k--) s = s * x + p[k];
  return s;
}

/** p(z) for complex z by Horner's rule (real coefficients). */
export function polyEvalC(p: number[], z: C): C {
  let re = 0;
  let im = 0;
  for (let k = p.length - 1; k >= 0; k--) {
    const r = re * z.re - im * z.im + p[k];
    im = re * z.im + im * z.re;
    re = r;
  }
  return { re, im };
}

/** Sum a(x) + b(x), coefficient by coefficient. */
export function polyAdd(a: number[], b: number[]): number[] {
  const n = Math.max(a.length, b.length);
  const out = new Array<number>(n);
  for (let k = 0; k < n; k++) out[k] = (k < a.length ? a[k] : 0) + (k < b.length ? b[k] : 0);
  return out;
}

/** Product a(x) b(x): coefficients are the convolution sum_{i+j=k} a_i b_j. */
export function polyMul(a: number[], b: number[]): number[] {
  if (!a.length || !b.length) return [];
  const out = new Array<number>(a.length + b.length - 1).fill(0);
  for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) out[i + j] += a[i] * b[j];
  return out;
}

/** Scalar multiple s p(x). */
export function polyScale(a: number[], s: number): number[] {
  return a.map((v) => v * s);
}

/** Derivative p'(x) = sum_k k p_k x^(k-1). */
export function polyDeriv(p: number[]): number[] {
  if (p.length <= 1) return [0];
  const out = new Array<number>(p.length - 1);
  for (let k = 1; k < p.length; k++) out[k - 1] = k * p[k];
  return out;
}

/** p with exact-zero highest-degree coefficients removed (at least [0] is kept). */
export function polyTrim(p: number[]): number[] {
  let n = p.length;
  while (n > 1 && p[n - 1] === 0) n--;
  return n ? p.slice(0, n) : [0];
}

/** det of a square matrix of polynomials A[i][j] (each ascending coefficients) by cofactor expansion with memoised minors; n <= 12. */
export function polyMatDet(A: number[][][]): number[] {
  const n = A.length;
  if (n === 0) return [1];
  if (n > 12) throw new Error('polyMatDet: matrix too large (n > 12)');
  const memo = new Map<number, number[]>();
  const isZero = (q: number[]) => q.every((v) => v === 0);
  // Expand along row `row` over the columns still in `mask` (row = n - popcount(mask)).
  const rec = (row: number, mask: number): number[] => {
    if (row === n) return [1];
    const hit = memo.get(mask);
    if (hit) return hit;
    let acc: number[] = [0];
    let sign = 1;
    for (let j = 0; j < n; j++) {
      if (!(mask & (1 << j))) continue;
      const a = A[row][j];
      if (!isZero(a)) {
        const minor = rec(row + 1, mask & ~(1 << j));
        acc = polyAdd(acc, polyScale(polyMul(a, minor), sign));
      }
      sign = -sign;
    }
    memo.set(mask, acc);
    return acc;
  };
  return polyTrim(rec(0, (1 << n) - 1));
}

// Veltkamp/Dekker exact product a*b = p + e, used for an accurate discriminant.
const SPLIT = 134217729; // 2^27 + 1
function twoProduct(a: number, b: number): [number, number] {
  const p = a * b;
  let t = SPLIT * a;
  const ah = t - (t - a);
  const al = a - ah;
  t = SPLIT * b;
  const bh = t - (t - b);
  const bl = b - bh;
  const e = ah * bh - p + ah * bl + al * bh + al * bl;
  return [p, e];
}

/** b^2 - 4ac with both products exact (Kahan), so near-double roots keep their accuracy. */
function discriminant(a: number, b: number, c: number): number {
  const [p, dp] = twoProduct(b, b);
  const [q, dq] = twoProduct(4 * a, c);
  const d = p - q + (dp - dq);
  return Number.isFinite(d) ? d : b * b - 4 * a * c;
}

/** Roots of a x^2 + b x + c = 0 without cancellation (q = -(b + sgn(b) sqrt(b^2 - 4ac))/2, x = q/a, c/q); real roots ascending, a complex pair as [re + i im, re - i im]. */
export function quadRoots(a: number, b: number, c: number): [C, C] {
  const nan: C = { re: NaN, im: NaN };
  if (a === 0) return [b !== 0 ? { re: -c / b, im: 0 } : nan, nan];
  const d = discriminant(a, b, c);
  if (d >= 0) {
    const sq = Math.sqrt(d);
    const q = -0.5 * (b + (b >= 0 ? sq : -sq));
    let x1 = 0;
    let x2 = 0;
    if (q !== 0) {
      x1 = q / a;
      x2 = c / q;
    }
    return x1 <= x2 ? [{ re: x1, im: 0 }, { re: x2, im: 0 }] : [{ re: x2, im: 0 }, { re: x1, im: 0 }];
  }
  const re = -b / (2 * a);
  const im = Math.sqrt(-d) / (2 * Math.abs(a));
  return [{ re, im }, { re, im: -im }];
}

/** Starting points on circles whose radii come from the upper convex hull of (k, log|a_k|) (Bini's Newton-polygon rule). */
function initialGuesses(a: number[]): C[] {
  const n = a.length - 1;
  const pts: [number, number][] = [];
  for (let k = 0; k <= n; k++) if (a[k] !== 0) pts.push([k, Math.log(Math.abs(a[k]))]);
  const hull: [number, number][] = [];
  for (const p of pts) {
    while (hull.length >= 2) {
      const [x1, y1] = hull[hull.length - 2];
      const [x2, y2] = hull[hull.length - 1];
      if ((x2 - x1) * (p[1] - y1) - (y2 - y1) * (p[0] - x1) >= 0) hull.pop();
      else break;
    }
    hull.push(p);
  }
  const z: C[] = [];
  for (let h = 0; h + 1 < hull.length; h++) {
    const [k1, y1] = hull[h];
    const [k2, y2] = hull[h + 1];
    const m = k2 - k1;
    const u = Math.exp((y1 - y2) / m);
    for (let j = 0; j < m; j++) z.push(cfromPolar(u, (2 * Math.PI * j) / m + (2 * Math.PI * h) / n + 0.7));
  }
  return z;
}

/** Aberth-Ehrlich simultaneous iteration, run until each |p(z_i)| reaches its rounding-error floor. */
function aberth(q: number[]): C[] {
  const n = q.length - 1;
  let big = 0;
  for (const v of q) big = Math.max(big, Math.abs(v));
  const a = q.map((v) => v / big);
  const da = polyDeriv(a);
  const absA = a.map(Math.abs);
  const z = initialGuesses(a);
  const done = new Array<boolean>(n).fill(false);
  for (let it = 0; it < 1000; it++) {
    let active = false;
    for (let i = 0; i < n; i++) {
      if (done[i]) continue;
      active = true;
      const zi = z[i];
      const pz = polyEvalC(a, zi);
      // Rounding-error bound of Horner's rule: stop once p(z) is at the noise level.
      if (cabs(pz) <= 4 * EPS * polyEval(absA, cabs(zi))) {
        done[i] = true;
        continue;
      }
      const ratio = cdiv(pz, polyEvalC(da, zi)); // Newton correction p/p'
      let sum: C = ZERO;
      for (let j = 0; j < n; j++) if (j !== i) sum = cadd(sum, cinv(csub(zi, z[j])));
      const w = cdiv(ratio, csub(ONE, cmul(ratio, sum)));
      if (!Number.isFinite(w.re) || !Number.isFinite(w.im)) {
        z[i] = cmul(zi, { re: 1 + 1e-7, im: 1e-7 }); // nudge off a stationary point
        continue;
      }
      z[i] = csub(zi, w);
      if (cabs(w) <= EPS * cabs(z[i])) done[i] = true;
    }
    if (!active) break;
  }
  return z;
}

/** Pairs roots of a real polynomial into exact conjugates (closest pairs first); unpaired roots are made exactly real. */
function tidyConjugates(z: C[]): C[] {
  const pos: number[] = [];
  const neg: number[] = [];
  z.forEach((v, i) => {
    if (v.im > 0) pos.push(i);
    else if (v.im < 0) neg.push(i);
  });
  const cand: [number, number, number][] = [];
  for (const i of pos) {
    for (const j of neg) {
      const d = Math.hypot(z[i].re - z[j].re, z[i].im + z[j].im);
      // A true pair sits closer to the other's conjugate than either sits to the real axis;
      // two real roots carrying opposite rounding noise in Im do not.
      if (d < Math.min(z[i].im, -z[j].im)) cand.push([d, i, j]);
    }
  }
  cand.sort((A, B) => A[0] - B[0]);
  const out = z.map((v) => ({ re: v.re, im: v.im }));
  const paired = new Set<number>();
  for (const [, i, j] of cand) {
    if (paired.has(i) || paired.has(j)) continue;
    paired.add(i);
    paired.add(j);
    const re = 0.5 * (z[i].re + z[j].re);
    const im = 0.5 * (z[i].im - z[j].im);
    out[i] = { re, im };
    out[j] = { re, im: -im };
  }
  out.forEach((v, i) => {
    if (!paired.has(i)) v.im = 0;
  });
  return out;
}

/** All complex roots of p (ascending coefficients) by Aberth-Ehrlich from Newton-polygon starts, iterated to the rounding floor; exact-zero leading terms stripped, exact zero roots factored out, conjugate pairs made exact; sorted by real part, then |imag|, each pair adjacent with +imag first. */
export function polyRoots(p: number[]): C[] {
  let q = polyTrim(p);
  const deg = q.length - 1;
  if (deg < 1) return [];
  if (!q.every(Number.isFinite)) return Array.from({ length: deg }, () => ({ re: NaN, im: NaN }));
  const roots: C[] = [];
  let k0 = 0;
  while (q[k0] === 0) k0++;
  for (let i = 0; i < k0; i++) roots.push({ re: 0, im: 0 });
  q = q.slice(k0);
  const n = q.length - 1;
  if (n === 1) roots.push({ re: -q[0] / q[1], im: 0 });
  else if (n === 2) roots.push(...quadRoots(q[2], q[1], q[0]));
  else if (n >= 3) roots.push(...tidyConjugates(aberth(q)));
  return roots.sort((A, B) => A.re - B.re || Math.abs(A.im) - Math.abs(B.im) || B.im - A.im);
}
