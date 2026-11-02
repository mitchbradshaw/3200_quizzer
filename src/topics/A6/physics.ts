// Extra pure helpers for A6 (damped MDOF, complex modes): MATLAB-style [P, D] = eig(A) output for the
// state-space problem (LA9 Eqs 9.12–9.14, p62) and the reading of it (summary notes A6). SI units, rad/s.
import type { C } from '../../physics/complex';
import { cabs, carg, cconj, cdiv, cmul } from '../../physics/complex';
import type { Mat } from '../../physics/linalg';
import { dampedModesSorted, fromEigenvalue, type DampedMode } from '../../physics/damped';
import type { Rng } from '../../engine/rng';

/** Round to MATLAB "format short" (4 decimals). */
export const r4 = (x: number) => Math.round(x * 1e4) / 1e4;
export const c4 = (z: C): C => ({ re: r4(z.re), im: r4(z.im) });

/** One printed column of [P, D]: eigenvalue and eigenvector [X1..Xn, V1..Vn]. */
export interface MatlabColumn {
  s: C;
  v: C[];
  /** Mode number (1 = smallest |s|) this column belongs to. */
  mode: number;
}

/**
 * MATLAB-like eig output for M x'' + C x' + K x = 0: one column per eigenvalue, conjugate pairs adjacent (+imag first),
 * each eigenvector scaled to unit 2-norm and rotated so its largest entry is real (sign ±, as LAPACK leaves it).
 * `order` lists the modes in printed order (e.g. [2, 1]: the higher mode printed first, as in 2023–2025).
 * Underdamped modes only (every mode must have Im s > 0).
 */
export function matlabEig(M: Mat, Cd: Mat, K: Mat, order: number[], signs: number[]): MatlabColumn[] {
  const modes = dampedModesSorted(M, Cd, K);
  const cols: MatlabColumn[] = [];
  order.forEach((modeNo, k) => {
    const m = modes[modeNo - 1];
    const v = [...m.X, ...m.V];
    let big = 0;
    let at = 0;
    v.forEach((z, i) => {
      const a = cabs(z);
      if (a > big) {
        big = a;
        at = i;
      }
    });
    const norm = Math.sqrt(v.reduce((t, z) => t + z.re * z.re + z.im * z.im, 0));
    const rot: C = { re: (signs[k] * v[at].re) / (big * norm), im: (-signs[k] * v[at].im) / (big * norm) }; // conj(v_at)/|v_at| / norm
    const u = v.map((z) => cmul(z, rot));
    u[at] = { re: u[at].re, im: 0 };
    cols.push({ s: m.s, v: u, mode: modeNo });
    cols.push({ s: cconj(m.s), v: u.map((z) => ({ re: z.re, im: z.im === 0 ? -0 : -z.im })), mode: modeNo });
  });
  return cols;
}

/** Sorted damped modes (one per pair, ascending |s|) for convenience. */
export function sortedModes(M: Mat, Cd: Mat, K: Mat): DampedMode[] {
  return dampedModesSorted(M, Cd, K);
}

const isNeg = (x: number) => x < 0 || Object.is(x, -0);

/**
 * MATLAB "format short" text of one complex entry, e.g. "-0.0003 - 0.0299i" or "-0.2717 +31.1078i": real and imaginary
 * fields right-aligned to the given widths; tiny negatives print as "-0.0000" exactly as in the papers.
 */
export function matlabCell(z: C, wRe = 7, wIm = 7): string {
  const re = `${z.re < 0 ? '-' : ''}${Math.abs(z.re).toFixed(4)}`;
  const im = Math.abs(z.im).toFixed(4);
  return `${re.padStart(wRe)} ${isNeg(z.im) ? '-' : '+'}${im.padStart(wIm)}i`;
}

/** Field widths that fit every entry of a complex matrix (MATLAB pads columns to a common width, at least 7). */
export function fieldWidths(rows: C[][]): { wRe: number; wIm: number } {
  let wRe = 7;
  let wIm = 7;
  for (const row of rows)
    for (const z of row) {
      wRe = Math.max(wRe, `${z.re < 0 ? '-' : ''}${Math.abs(z.re).toFixed(4)}`.length);
      wIm = Math.max(wIm, Math.abs(z.im).toFixed(4).length);
    }
  return { wRe, wIm };
}

/** Text cells of P (rows × columns) and of the diagonal matrix D, ready for <MatlabBlock>. */
export function matlabText(cols: MatlabColumn[]): { P: string[][]; D: string[][]; eig: string[][] } {
  const n2 = cols.length;
  const Pm: C[][] = Array.from({ length: n2 }, (_, i) => cols.map((c) => c.v[i]));
  const Dm: C[][] = Array.from({ length: n2 }, (_, i) => cols.map((c, j) => (i === j ? c.s : { re: 0, im: 0 })));
  const wp = fieldWidths(Pm);
  const wd = fieldWidths(Dm);
  return {
    P: Pm.map((row) => row.map((z) => matlabCell(z, wp.wRe, wp.wIm))),
    D: Dm.map((row) => row.map((z) => matlabCell(z, wd.wRe, wd.wIm))),
    eig: cols.map((c) => [matlabCell(c.s, wd.wRe, wd.wIm)]),
  };
}

/** Text cells of a column of eigenvalues, as printed by `eig(A)` without [P, D] (2025 A1.5 style). */
export function eigListText(s: C[]): string[][] {
  const w = fieldWidths([s]);
  return s.map((z) => [matlabCell(z, w.wRe, w.wIm)]);
}

/** Reading an eigenvalue: ωn = |s|, ωd = |Im s|, ζ = −Re s/|s| (LA9 Eq 9.15; summary notes A6). */
export const readEig = fromEigenvalue;

/** Complex ratio a/b as magnitude and angle in degrees (−180, 180]. */
export function ratio(a: C, b: C): { z: C; mag: number; deg: number } {
  const z = cdiv(a, b);
  return { z, mag: cabs(z), deg: (carg(z) * 180) / Math.PI };
}

/** A lightly damped 2-DoF chain support–(k1, c1)–m1–(k2, c2)–m2 (2024 A1.1 figure) with ω₂ < 95 rad/s so MATLAB prints 4 decimals. */
export function drillSystem(rng: Rng): { M: Mat; C: Mat; K: Mat; m: number[]; k: number[]; c: number[] } {
  for (let attempt = 0; attempt < 40; attempt++) {
    const m1 = rng.step(0.5, 3, 0.1);
    const m2 = rng.step(0.5, 3, 0.1);
    const k1 = rng.step(200, 4000, 50);
    const k2 = rng.step(100, 2500, 50);
    const c1 = rng.step(0.02, 1.2, 0.02);
    const c2 = rng.step(0.02, 0.8, 0.02);
    const M = [
      [m1, 0],
      [0, m2],
    ];
    const K = [
      [k1 + k2, -k2],
      [-k2, k2],
    ];
    const Cd = [
      [c1 + c2, -c2],
      [-c2, c2],
    ];
    const modes = dampedModesSorted(M, Cd, K);
    if (modes.length !== 2 || modes.some((md) => !(md.s.im > 0))) continue;
    const [w1, w2] = modes.map((md) => md.wn);
    const z = modes.map((md) => md.zeta);
    if (w1 < 5 || w2 > 95 || w2 / w1 < 1.6 || z.some((x) => x < 0.0015 || x > 0.04)) continue;
    // Displacement entries must not all round to zero (P-only questions need V/X).
    return { M, C: Cd, K, m: [m1, m2], k: [k1, k2], c: [c1, c2] };
  }
  // Fallback: the 2023 A1.1-like system (always valid).
  return {
    M: [
      [1.5, 0],
      [0, 1],
    ],
    C: [
      [0.45, -0.15],
      [-0.15, 0.15],
    ],
    K: [
      [3230, -230],
      [-230, 230],
    ],
    m: [1.5, 1],
    k: [3000, 230],
    c: [0.3, 0.15],
  };
}

/**
 * A generated MATLAB [P, D] drill (2023 A1.1–A1.2 style): a random lightly damped chain, its state-space eig output with
 * the pairs mostly printed higher-mode-first, and the readings a student makes from the PRINTED numbers (4 decimals):
 * column of each mode's +imag member (k1, k2), ωn/ζ/ωd from the printed s, and V2/V1 in each mode's column.
 */
export function matlabDrill(rng: Rng) {
  const sys = drillSystem(rng);
  const higherFirst = rng.chance(0.7);
  const order = higherFirst ? [2, 1] : [1, 2];
  const cols = matlabEig(sys.M, sys.C, sys.K, order, [rng.pick([1, -1]), rng.pick([1, -1])]);
  const text = matlabText(cols);
  const pc = cols.map((c) => ({ s: c4(c.s), v: c.v.map(c4) })); // printed values
  const colOf = (mode: number) => cols.findIndex((c) => c.mode === mode && c.s.im > 0);
  const k1 = colOf(1);
  const k2 = colOf(2);
  const e1 = fromEigenvalue(pc[k1].s);
  const e2 = fromEigenvalue(pc[k2].s);
  const vr = (k: number) => ratio(pc[k].v[3], pc[k].v[2]); // V2/V1 from the printed velocity rows
  return { sys, cols, pc, text, k1, k2, e1, e2, r1: vr(k1), r2: vr(k2), higherFirst };
}

/** A complex mode ratio as one signed real number: +magnitude when nearer 0°, −magnitude when nearer 180°. */
export const signedRatio = (r: { mag: number; deg: number }) => (Math.abs(r.deg) < 90 ? r.mag : -r.mag);

/** Parse a printed MATLAB complex entry such as "-0.0003 - 0.0299i" or "-0.2717 +31.1078i". */
export function parseMatlabCell(t: string): C {
  const m = t.trim().match(/^([+-]?\d*\.?\d+)\s*([+-])\s*(\d*\.?\d+)i$/);
  if (!m) return { re: NaN, im: NaN };
  return { re: Number(m[1]), im: (m[2] === '-' ? -1 : 1) * Number(m[3]) };
}

/** s estimated from a printed column as V_i/X_i, using the displacement row with the larger |X_i| (best resolved). */
export function sFromColumn(v: C[], n: number): { s: C; row: number } {
  let row = 0;
  for (let i = 1; i < n; i++) if (cabs(v[i]) > cabs(v[row])) row = i;
  return { s: cdiv(v[n + row], v[row]), row };
}

/** Modal damping of Rayleigh damping, ζ = α/(2ω) + βω/2 (LA9 Eq 9.7). */
export const rayleighZetaAt = (alpha: number, beta: number, w: number) => alpha / (2 * w) + (beta * w) / 2;
