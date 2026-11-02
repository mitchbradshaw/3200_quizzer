// Small helpers shared by the B3 and B4 problem generators.
import type { Rich } from '../../engine/types';
import { fmt, tex } from '../../engine/format';

export interface TrapSpec {
  value: number;
  message: Rich;
  trapId?: string;
}

/**
 * Keeps only traps that are finite, nonzero, clearly away from the answer (more than 3 %) and from each other,
 * so a trap can never shadow a correct answer (the checker accepts ±2 % before it looks at traps).
 */
export function traps(answer: number, list: TrapSpec[], minGap = 0.03, absGap = 0): TrapSpec[] {
  const out: TrapSpec[] = [];
  for (const t of list) {
    if (!Number.isFinite(t.value) || t.value === 0) continue;
    if (Math.abs(t.value - answer) <= Math.max(minGap * Math.abs(answer), absGap)) continue;
    if (out.some((o) => Math.abs(o.value - t.value) <= 0.015 * Math.abs(o.value))) continue;
    out.push(t);
  }
  return out;
}

/** 4 significant figures for prose and for TeX. */
export const f4 = (x: number): string => fmt(x, 4);
export const f3 = (x: number): string => fmt(x, 3);
export const t4 = (x: number): string => tex(x, 4);
export const t3 = (x: number): string => tex(x, 3);

/** TeX number for use as a factor or divisor: parenthesised when negative or in ×10ⁿ form, e.g. (−0.0667), (2 \times 10^{-4}). */
export const tp = (x: number, sig = 4): string => {
  const s = tex(x, sig);
  return x < 0 || s.includes('\\times') ? `(${s})` : s;
};

/** Signed sum in TeX, "a + b − c": each later term shows its own sign instead of "+ −c". */
export const sumTeX = (xs: number[], sig = 4): string =>
  xs.map((x, k) => (k === 0 ? tex(x, sig) : `${x < 0 ? '-' : '+'} ${tex(Math.abs(x), sig)}`)).join(' ');

export const TAU = 2 * Math.PI;
export const SUBS = ['₀', '₁', '₂', '₃', '₄', '₅', '₆'];
