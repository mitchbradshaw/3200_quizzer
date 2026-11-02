// Content lint over every topic's quiz bank: structural integrity, and no "pick the longest option" cue.
import type { SelfTest, CheckResult } from './types';
import type { MCQ } from '../engine/types';
import { isTrue } from './assert';
import { mcqs as A1 } from '../topics/A1/quiz';
import { mcqs as A2 } from '../topics/A2/quiz';
import { mcqs as A3 } from '../topics/A3/quiz';
import { mcqs as A4 } from '../topics/A4/quiz';
import { mcqs as A5 } from '../topics/A5/quiz';
import { mcqs as A6 } from '../topics/A6/quiz';
import { mcqs as B1 } from '../topics/B1/quiz';
import { mcqs as B2 } from '../topics/B2/quiz';
import { mcqs as B3 } from '../topics/B3/quiz';
import { mcqs as B4 } from '../topics/B4/quiz';
import { mcqs as B5 } from '../topics/B5/quiz';
import { mcqs as B6 } from '../topics/B6/quiz';
import { mcqs as C1 } from '../topics/C1/quiz';
import { mcqs as C2 } from '../topics/C2/quiz';
import { mcqs as C3 } from '../topics/C3/quiz';
import { mcqs as C4 } from '../topics/C4/quiz';

const BANK: [string, MCQ[]][] = [
  ['A1', A1], ['A2', A2], ['A3', A3], ['A4', A4], ['A5', A5], ['A6', A6],
  ['B1', B1], ['B2', B2], ['B3', B3], ['B4', B4], ['B5', B5], ['B6', B6],
  ['C1', C1], ['C2', C2], ['C3', C3], ['C4', C4],
];

/** Approximate rendered length: TeX counts at half weight (it renders compactly), markup is dropped. */
export function visibleLength(s: string): number {
  return s
    .replace(/\$\$?([^$]*)\$\$?/g, (_m, t: string) => 'x'.repeat(Math.ceil(t.length * 0.5)))
    .replace(/\*\*|\*|`/g, '').length;
}

/** For "pick the true statement" items: is the key strictly the longest option? */
export function keyIsLongest(q: MCQ): boolean {
  const lens = q.options.map((o) => visibleLength(o.text));
  const k = q.options.findIndex((o) => o.correct);
  return lens.every((l, i) => i === k || lens[k] > l);
}

const KEY_STYLES = new Set<MCQ['style']>(['correct', 'most-correct', 'best']);
export const LENGTH_CUE_LIMIT = 0.4;

export const tests: SelfTest[] = [
  {
    id: 'content-mcq-integrity',
    topic: 'core',
    title: 'MCQs: exactly one key, a reason for every option, unique ids, at least 3 options',
    run: () => {
      const out: CheckResult[] = [];
      const ids = new Map<string, string>();
      for (const [code, qs] of BANK) {
        const bad: string[] = [];
        for (const q of qs) {
          const keys = q.options.filter((o) => o.correct).length;
          if (keys !== 1) bad.push(`${q.id}: ${keys} keys`);
          if (q.options.length < 3) bad.push(`${q.id}: ${q.options.length} options`);
          if (q.options.some((o) => !o.why || !o.why.trim())) bad.push(`${q.id}: option without a reason`);
          if (!q.source || !q.source.trim()) bad.push(`${q.id}: no source`);
          if (ids.has(q.id)) bad.push(`${q.id}: duplicate id (also in ${ids.get(q.id)})`);
          ids.set(q.id, code);
        }
        out.push(isTrue(`${code}: ${qs.length} MCQs well formed`, bad.length === 0, bad.slice(0, 4).join('; ')));
      }
      return out;
    },
  },
  {
    id: 'content-mcq-length-cue',
    topic: 'core',
    title: `MCQs: option length gives no cue (key is the longest option in ≤ ${LENGTH_CUE_LIMIT * 100} % of "pick the true one" items)`,
    source: 'Review round 1 (engineer): keys were the longest option in 67 % of items',
    run: () => {
      const out: CheckResult[] = [];
      let all = 0;
      let longest = 0;
      for (const [code, qs] of BANK) {
        const items = qs.filter((q) => KEY_STYLES.has(q.style));
        const hits = items.filter(keyIsLongest);
        all += items.length;
        longest += hits.length;
        if (items.length < 4) continue;
        const frac = hits.length / items.length;
        out.push(isTrue(`${code}: key longest in ${hits.length}/${items.length} (${Math.round(frac * 100)} %)`, frac <= LENGTH_CUE_LIMIT, hits.map((q) => q.id).slice(0, 8).join(', ')));
      }
      out.push(isTrue(`all topics: key longest in ${longest}/${all} (${Math.round((100 * longest) / Math.max(1, all))} %)`, longest / Math.max(1, all) <= 0.35));
      return out;
    },
  },
];
