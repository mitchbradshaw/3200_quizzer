// A4 helpers (pure functions, SI units, rad/s). Thin wrappers over src/physics/absorber.ts and
// src/physics/mdof.ts, plus the peak search and sampling used by the A4 simulations and self-tests.
//
// Notation (LA6 + LC4): primary m1, k1; absorber m2, k2; mu = m2/m1; w11 = sqrt(k1/m1);
// w22 = sqrt(k2/m2); beta = w22/w11; g = Omega/w11 (forcing frequency over the primary's own
// frequency); zeta = c2/(2 m2 w11) (LC4 / Rao 9.11.2 normalisation).
import { generalRatios, muFromRatio, primaryAmplitude } from '../../physics/absorber';

/** Undamped receptances (m/N) of ground–k1–m1–k2–m2 at forcing frequency W (rad/s): a11 = (k2 − m2W²)/Δ, a12 = a21 = k2/Δ, a22 = (k1 + k2 − m1W²)/Δ (LA6 Eq 6.10–6.13). */
export function chainReceptances(m1: number, k1: number, m2: number, k2: number, W: number): { a11: number; a12: number; a22: number; det: number } {
  const W2 = W * W;
  const d11 = k1 + k2 - m1 * W2;
  const d22 = k2 - m2 * W2;
  const det = d11 * d22 - k2 * k2;
  return { a11: d22 / det, a12: k2 / det, a22: d11 / det, det };
}

/** Signed undamped primary and absorber amplitudes X1 k1/F0 and X2 k1/F0 at g = Omega/w11 (LA6 Eq 6.20–6.21 made dimensionless). */
export function absorberSigned(mu: number, beta: number, g: number): { x1: number; x2: number } {
  const g2 = g * g;
  const b2 = beta * beta;
  const D = (1 + mu * b2 - g2) * (1 - g2 / b2) - mu * b2;
  return { x1: (1 - g2 / b2) / D, x2: 1 / D };
}

/** New natural frequencies as fractions of w11 (g = beta r), ascending (LA6 Eq 6.23 times beta). */
export function newFrequenciesG(mu: number, beta: number): [number, number] {
  const [r1, r2] = generalRatios(mu, beta);
  return [beta * r1, beta * r2];
}

/** Minimum tuned (beta = 1) mass ratio so that the new frequencies satisfy r1 <= 1 − lo and r2 >= 1 + hi: the larger of the two candidates (summary notes A4; Week 5 Q1). */
export function sizeForMargins(lo: number, hi: number): { muLower: number; muUpper: number; mu: number; binds: 'lower' | 'upper' } {
  const muLower = muFromRatio(1 - lo);
  const muUpper = muFromRatio(1 + hi);
  return { muLower, muUpper, mu: Math.max(muLower, muUpper), binds: muLower >= muUpper ? 'lower' : 'upper' };
}

/** Round x up to `dp` decimal places (a minimum design value must be rounded up). */
export function ceilTo(x: number, dp: number): number {
  const f = 10 ** dp;
  return Math.ceil(x * f - 1e-9) / f;
}

/** Golden-section search for the maximum of f on [a, b]. */
function goldenMax(f: (x: number) => number, a: number, b: number, iters = 60): number {
  const R = (Math.sqrt(5) - 1) / 2;
  let x1 = b - R * (b - a);
  let x2 = a + R * (b - a);
  let f1 = f(x1);
  let f2 = f(x2);
  for (let i = 0; i < iters; i++) {
    if (f1 < f2) {
      a = x1;
      x1 = x2;
      f1 = f2;
      x2 = a + R * (b - a);
      f2 = f(x2);
    } else {
      b = x2;
      x2 = x1;
      f2 = f1;
      x1 = b - R * (b - a);
      f1 = f(x1);
    }
  }
  return (a + b) / 2;
}

/**
 * Local maxima (ascending in g) of the damped primary amplitude |X1| k1/F0 (LC4 §3.5) on [lo, hi]:
 * sampled scan plus golden-section refinement. zeta <= 0 returns the undamped resonances (amp = Infinity);
 * zeta = Infinity returns the locked-absorber peak g = 1/sqrt(1 + mu).
 */
export function primaryPeaks(mu: number, beta: number, zeta: number, lo = 0.05, hi = 3, n = 500): { g: number; amp: number }[] {
  if (!(zeta > 0)) return newFrequenciesG(mu, beta).map((g) => ({ g, amp: Infinity }));
  if (!Number.isFinite(zeta)) {
    const g = 1 / Math.sqrt(1 + mu);
    return [{ g, amp: Infinity }];
  }
  const f = (g: number) => primaryAmplitude(mu, beta, g, zeta);
  const out: { g: number; amp: number }[] = [];
  const h = (hi - lo) / n;
  let ym = f(lo);
  let y0 = f(lo + h);
  for (let i = 1; i < n; i++) {
    const yp = f(lo + (i + 1) * h);
    if (y0 > ym && y0 >= yp) {
      const g = goldenMax(f, lo + (i - 1) * h, lo + (i + 1) * h);
      out.push({ g, amp: f(g) });
    }
    ym = y0;
    y0 = yp;
  }
  return out;
}

/**
 * Local minima (ascending in g) of the damped primary amplitude |X1| k1/F0 on [lo, hi]: the filled-in
 * anti-resonance between the two peaks (zeta > 0 only; same scan + golden refinement as primaryPeaks).
 */
export function primaryDips(mu: number, beta: number, zeta: number, lo = 0.05, hi = 3, n = 500): { g: number; amp: number }[] {
  if (!(zeta > 0) || !Number.isFinite(zeta)) return [];
  const f = (g: number) => primaryAmplitude(mu, beta, g, zeta);
  const neg = (g: number) => -f(g);
  const out: { g: number; amp: number }[] = [];
  const h = (hi - lo) / n;
  let ym = f(lo);
  let y0 = f(lo + h);
  for (let i = 1; i < n; i++) {
    const yp = f(lo + (i + 1) * h);
    if (y0 < ym && y0 <= yp) {
      const g = goldenMax(neg, lo + (i - 1) * h, lo + (i + 1) * h);
      out.push({ g, amp: f(g) });
    }
    ym = y0;
    y0 = yp;
  }
  return out;
}

/** Peak and dip positions g = Ω/ω11 of the damped primary amplitude against absorber damping ζ (LC4 §3.5). */
export interface PeakBranches {
  /** [ζ, g] points of the branch that starts at the lower undamped resonance. */
  lower: [number, number][];
  /** [ζ, g] points of the branch that starts at the upper undamped resonance. */
  upper: [number, number][];
  /** [ζ, g] points of the dip between the peaks (the filled-in zero), up to the fold. */
  dip: [number, number][];
  /** Where one peak and the dip meet and vanish (above this ζ the response has a single peak). */
  fold: { z: number; g: number; branch: 'lower' | 'upper' } | null;
}

/**
 * Track the two peaks and the dip of |X1| as ζ grows from zLo to zHi (log-spaced). Peaks are followed by
 * continuity: as ζ grows the dip climbs to meet one peak and both vanish (a fold); the surviving peak tends
 * to the locked frequency 1/sqrt(1 + mu). The fold is located by bisection on the number of peaks.
 */
export function peakBranches(mu: number, beta: number, lo: number, hi: number, zLo = 0.005, zHi = 2, nz = 90): PeakBranches {
  const n = 420;
  const zs: number[] = [];
  for (let i = 0; i <= nz; i++) zs.push(zLo * (zHi / zLo) ** (i / nz));
  const lower: [number, number][] = [];
  const upper: [number, number][] = [];
  const dip: [number, number][] = [];
  let fold: PeakBranches['fold'] = null;
  let prevL = NaN;
  let prevU = NaN;
  let prevZ = NaN;
  let survivor: 'lower' | 'upper' | null = null;
  const between = (z: number, a: number, b: number) => primaryDips(mu, beta, z, lo, hi, n).find((d) => d.g > a && d.g < b);
  for (const z of zs) {
    const P = primaryPeaks(mu, beta, z, lo, hi, n);
    if (!P.length) continue;
    if (!survivor && P.length >= 2) {
      const a = P[0].g;
      const b = P[P.length - 1].g;
      lower.push([z, a]);
      upper.push([z, b]);
      const d = between(z, a, b);
      if (d) dip.push([z, d.g]);
      prevL = a;
      prevU = b;
      prevZ = z;
      continue;
    }
    if (!survivor) {
      // the peak count just dropped: the surviving branch is the one closest to the single peak
      const g = P[0].g;
      survivor = Number.isFinite(prevL) && Math.abs(g - prevU) < Math.abs(g - prevL) ? 'upper' : 'lower';
      if (Number.isFinite(prevZ)) {
        let za = prevZ;
        let zb = z;
        for (let k = 0; k < 28; k++) {
          const zm = Math.sqrt(za * zb);
          if (primaryPeaks(mu, beta, zm, lo, hi, n).length >= 2) za = zm;
          else zb = zm;
        }
        const Pa = primaryPeaks(mu, beta, za, lo, hi, n);
        if (Pa.length >= 2) {
          const a = Pa[0].g;
          const b = Pa[Pa.length - 1].g;
          const d = between(za, a, b);
          const ending = survivor === 'lower' ? b : a;
          const gf = d ? (ending + d.g) / 2 : ending;
          lower.push([za, survivor === 'lower' ? a : gf]);
          upper.push([za, survivor === 'upper' ? b : gf]);
          dip.push([za, gf]);
          fold = { z: za, g: gf, branch: survivor === 'lower' ? 'upper' : 'lower' };
        }
      }
    }
    // after the fold follow only the surviving peak (ignore any tiny secondary bump)
    const last = survivor === 'lower' ? lower[lower.length - 1]?.[1] ?? P[0].g : upper[upper.length - 1]?.[1] ?? P[0].g;
    let best = P[0];
    for (const p of P) if (Math.abs(p.g - last) < Math.abs(best.g - last)) best = p;
    (survivor === 'lower' ? lower : upper).push([z, best.g]);
  }
  return { lower, upper, dip, fold };
}

/** Locked absorber (zeta -> infinity): the pair moves as one mass m1 + m2 on k1, |X1| k1/F0 = 1/|1 − (1 + mu) g^2|, single peak at g = 1/sqrt(1 + mu) (LC4 §3.5 figure). */
export const lockedAmplitude = (mu: number, g: number): number => 1 / Math.abs(1 - (1 + mu) * g * g);

/**
 * Smallest tuned mass ratio whose LOWER peak sits at or below gTarget for absorber damping zeta (2021 A1.4
 * extension: the peaks drift inwards with damping, so a heavier absorber is needed). zeta = 0 gives
 * (1/gT − gT)^2; zeta = Infinity gives 1/gT^2 − 1.
 */
export function minMuForLowerPeak(zeta: number, gTarget: number, beta = 1): number {
  if (!(zeta > 0)) return muFromRatio(gTarget);
  if (!Number.isFinite(zeta)) return 1 / (gTarget * gTarget) - 1;
  const lowerPeak = (mu: number) => {
    const p = primaryPeaks(mu, beta, zeta, 0.05, 1.2, 400);
    return p.length ? p[0].g : 1;
  };
  let a = 1e-4;
  let b = 8;
  for (let i = 0; i < 50; i++) {
    const mid = Math.sqrt(a * b);
    if (lowerPeak(mid) > gTarget) a = mid;
    else b = mid;
  }
  return b;
}

/**
 * Sample points on [a, b] that include dense clusters around feature frequencies (resonances,
 * anti-resonances), so undamped spikes reach the plot edge and zeros dive to the bottom.
 */
export function featureGrid(a: number, b: number, n: number, features: number[]): Float64Array {
  const pts: number[] = [];
  for (let i = 0; i <= n; i++) pts.push(a + ((b - a) * i) / n);
  const offs = [0.04, 0.02, 0.01, 0.005, 0.002, 0.001, 3e-4, 1e-4, 3e-5];
  for (const f of features) {
    if (!(f > a && f < b)) continue;
    for (const o of offs) pts.push(f * (1 - o), f * (1 + o));
  }
  pts.sort((x, y) => x - y);
  return Float64Array.from(pts.filter((x) => x >= a && x <= b));
}

/** Smallest value in a 1-2-2.5-3-4-5-6-8 ladder (times a power of ten) that is >= x: axis limits that change rarely. */
export function ladderCeil(x: number): number {
  if (!(x > 0)) return 1;
  const e = Math.floor(Math.log10(x));
  const base = 10 ** e;
  for (const m of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * base >= x * (1 - 1e-12)) return m * base;
  return 10 * base;
}

/** Natural frequencies (rad/s, ascending) of a free–free pair m1 – k – m2: 0 and sqrt(k (m1 + m2)/(m1 m2)). */
export const freeFreePair = (m1: number, m2: number, k: number): [number, number] => [0, Math.sqrt((k * (m1 + m2)) / (m1 * m2))];
