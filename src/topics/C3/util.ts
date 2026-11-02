// Small helpers for building C3 problem parts. Traps are filtered so that no trap value sits close
// to the correct answer (a student typing the right number must never be told it is a trap).
import type { ChoicePart, NumericPart, Rich } from '../../engine/types';
import { fmt } from '../../engine/format';

type Trap = NonNullable<NumericPart['traps']>[number];

/** Drop traps that are not finite, or within `gap` (relative) of the answer or of an earlier trap. */
export function safeTraps(answer: number, traps: Trap[], gap = 0.04): Trap[] {
  const far = (a: number, b: number) => Math.abs(a - b) > gap * Math.max(Math.abs(b), Math.abs(a), 1e-12);
  const out: Trap[] = [];
  for (const t of traps) {
    if (!Number.isFinite(t.value) || t.value === 0) continue;
    if (!far(t.value, answer)) continue;
    if (out.some((o) => !far(t.value, o.value))) continue;
    out.push(t);
  }
  return out;
}

/** A numeric part whose traps are filtered against its own tolerance. */
export function num(p: Omit<NumericPart, 'kind'>): NumericPart {
  const tol = p.tol ?? 0.02;
  return { kind: 'numeric', ...p, traps: p.traps ? safeTraps(p.answer, p.traps, Math.max(0.04, tol + 0.025)) : undefined };
}

/** A choice part. */
export function choice(id: string, label: Rich, options: ChoicePart['options'], multi = false): ChoicePart {
  return { kind: 'choice', id, label, options, multi: multi || undefined };
}

/** 4 significant figures, for hints. */
export const f4 = (x: number) => fmt(x, 4);
/** 3 significant figures, for hints. */
export const f3 = (x: number) => fmt(x, 3);

/** A tidy decimal (no floating-point fuzz) for frequencies built as multiples, e.g. 0.2 * 37. */
export const tidy = (x: number, dp = 4) => Number(x.toFixed(dp));
