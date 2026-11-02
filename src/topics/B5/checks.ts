// Content and generator sanity checks shared by the B5 and B6 self-tests: ids, one correct option per
// MCQ, a "why" for every option, link targets, trap ids, traps far from answers, 4 hints, and a KaTeX
// parse of every TeX snippet (hidden hints and explanations are not seen by the page crawler).
import katex from 'katex';
import type { CheckResult } from '../../selftest/types';
import { isTrue } from '../../selftest/assert';
import type { ExploreItem, TopicDef, SolveGenerator, SolveInstance } from '../../engine/types';
import { makeRng } from '../../engine/rng';
import { CORE_TRAPS } from '../../engine/traps';

type Content = Pick<TopicDef, 'cards' | 'flashcards' | 'mcqs' | 'games' | 'shortAnswers' | 'solve' | 'traps'> & { explore: Pick<ExploreItem, 'id'>[] };

/** TeX segments of a Rich string ($$...$$ and $...$; \$ is a literal dollar). */
export function texSegments(s: string): string[] {
  const src = s.replace(/\\\$/g, '\u0000');
  const out: string[] = [];
  const re = /\$\$([\s\S]+?)\$\$|\$([^$]+?)\$/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) out.push((m[1] ?? m[2]).replace(/\u0000/g, '\\$'));
  return out;
}

/** Unpaired $ (after removing $$..$$ and $..$ pairs) means broken maths delimiters. */
function unpairedDollar(s: string): boolean {
  const src = s.replace(/\\\$/g, '').replace(/\$\$[\s\S]+?\$\$/g, '').replace(/\$[^$]+?\$/g, '');
  return src.includes('$');
}

export function texErrors(texts: string[]): string[] {
  const bad: string[] = [];
  for (const t of texts) {
    if (unpairedDollar(t)) bad.push(`unpaired $ in: ${t.slice(0, 80)}`);
    for (const seg of texSegments(t)) {
      try {
        katex.renderToString(seg, { throwOnError: true, strict: 'ignore', macros: { '\\wn': '\\omega_n', '\\wd': '\\omega_d' } });
      } catch (e) {
        bad.push(`${(e as Error).message.slice(0, 90)} in: ${seg.slice(0, 80)}`);
      }
    }
  }
  return bad;
}

const BAD_WORDS = /\b(NaN|undefined|Infinity)\b/;

function trapIdOk(id: string | undefined, local: Set<string>): boolean {
  return !id || local.has(id) || CORE_TRAPS.some((t) => t.id === id);
}

export function contentChecks(t: Content, name: string): CheckResult[] {
  const local = new Set((t.traps ?? []).map((x) => x.id));
  const out: CheckResult[] = [];
  const ids = [...t.cards.map((c) => c.id), ...t.flashcards.map((c) => c.id), ...t.mcqs.map((q) => q.id), ...(t.games ?? []).map((g) => g.id), ...(t.shortAnswers ?? []).map((s) => s.id), ...t.solve.map((g) => g.id)];
  const dup = ids.filter((x, i) => ids.indexOf(x) !== i);
  out.push(isTrue(`${name}: ids unique`, !dup.length, dup.join(', ')));
  const mcqBad = t.mcqs
    .filter((q) => q.options.filter((o) => o.correct).length !== 1 || q.options.some((o) => !o.why.trim()) || q.options.length < 3 || !q.source.trim() || !trapIdOk(q.trapId, local))
    .map((q) => q.id);
  out.push(isTrue(`${name}: every MCQ has one correct option, ≥ 3 options, a why for each, a source and a valid trap`, !mcqBad.length, mcqBad.join(', ')));
  const exploreIds = new Set(t.explore.map((e) => e.id));
  const solveIds = new Set(t.solve.map((g) => g.id));
  const linkBad = t.cards.flatMap((c) => [...(c.exploreIds ?? []).filter((x) => !exploreIds.has(x)), ...(c.solveIds ?? []).filter((x) => !solveIds.has(x))].map((x) => `${c.id}→${x}`));
  out.push(isTrue(`${name}: card links point at existing sims and generators`, !linkBad.length, linkBad.join(', ')));
  const cardIds = new Set(t.cards.map((c) => c.id));
  const genCardBad = t.solve.filter((g) => !g.cardId || !cardIds.has(g.cardId)).map((g) => g.id);
  out.push(isTrue(`${name}: every generator links an existing card`, !genCardBad.length, genCardBad.join(', ')));
  const cardTrapBad = t.cards.flatMap((c) => c.traps.filter((x) => !trapIdOk(x.trapId, local)).map((x) => `${c.id}:${x.trapId}`));
  out.push(isTrue(`${name}: card trap ids exist`, !cardTrapBad.length, cardTrapBad.join(', ')));
  const gameBad = (t.games ?? []).flatMap((g) =>
    g.kind === 'sort' ? g.items.filter((it) => !g.buckets.some((b) => b.id === it.bucket) || !it.why.trim()).map((it) => `${g.id}:${it.id}`) : g.pairs.filter((p) => !p.left.trim() || !p.right.trim()).map((p) => `${g.id}:${p.id}`)
  );
  out.push(isTrue(`${name}: game items valid (bucket exists, why given)`, !gameBad.length, gameBad.join(', ')));
  const texts = [
    ...t.cards.flatMap((c) => [c.title, c.what, c.when, ...c.how, ...(c.formulas ?? []), c.more ?? '', ...c.traps.flatMap((x) => [x.title, x.detail])]),
    ...t.flashcards.flatMap((f) => [f.front, f.back]),
    ...t.mcqs.flatMap((q) => [q.stem, ...q.options.flatMap((o) => [o.text, o.why])]),
    ...(t.games ?? []).flatMap((g) => (g.kind === 'sort' ? [g.prompt, ...g.buckets.map((b) => b.label), ...g.items.flatMap((i) => [i.text, i.why])] : [g.prompt, ...g.pairs.flatMap((p) => [p.left, p.right, p.why ?? ''])])),
    ...(t.shortAnswers ?? []).flatMap((s) => [s.prompt, s.model]),
    ...(t.traps ?? []).flatMap((x) => [x.title, x.detail ?? '']),
    ...t.solve.map((g) => g.summary ?? ''),
  ];
  const tex = texErrors(texts);
  out.push(isTrue(`${name}: every TeX snippet in cards, flashcards, MCQs, games and traps parses (${texts.length} strings)`, !tex.length, tex.slice(0, 3).join(' | ')));
  const words = texts.filter((s) => BAD_WORDS.test(s));
  out.push(isTrue(`${name}: no NaN/undefined in content`, !words.length, words.slice(0, 2).join(' | ')));
  return out;
}

function instanceTexts(inst: SolveInstance): string[] {
  return [
    inst.prompt,
    ...inst.hints,
    ...(inst.givens ?? []).map((g) => `$${g.sym}$ ${g.value} ${g.label ?? ''}`),
    ...inst.parts.flatMap((p) => [
      p.label,
      ...(p.kind === 'choice' ? p.options.flatMap((o) => [o.text, o.why ?? '']) : []),
      ...(p.kind === 'order' ? p.steps : []),
      ...(p.kind === 'numeric' ? (p.traps ?? []).map((x) => x.message) : []),
    ]),
  ];
}

/** Every generator, every tier, `seeds` seeds: builds, 4 hints, finite answers, traps ≥ 3.5 % away, one correct choice, valid trap ids, clean text; KaTeX on the first `texSeeds` seeds. */
export function generatorChecks(gens: SolveGenerator[], localTraps: string[] = [], seeds = 50, texSeeds = 6): CheckResult[] {
  const local = new Set(localTraps);
  return gens.map((g) => {
    let bad = '';
    for (let s = 1; s <= seeds && !bad; s++)
      for (const tier of g.tiers) {
        let inst: SolveInstance;
        try {
          inst = g.generate(makeRng(s * 7919 + 13), tier);
        } catch (e) {
          bad = `throws (seed ${s}, tier ${tier}): ${(e as Error).message}`;
          break;
        }
        if (inst.hints.length !== 4 || inst.hints.some((h) => !h.trim())) bad = `needs 4 non-empty hints (seed ${s}, tier ${tier})`;
        if (!inst.parts.length) bad = `no parts (tier ${tier})`;
        for (const p of inst.parts) {
          if (p.kind === 'numeric') {
            if (!Number.isFinite(p.answer)) bad = `${p.id} not finite (seed ${s}, tier ${tier})`;
            for (const tr of p.traps ?? []) {
              if (!Number.isFinite(tr.value)) bad = `${p.id} trap not finite`;
              const sep = Math.abs(tr.value - p.answer) / Math.max(Math.abs(tr.value), Math.abs(p.answer), 1e-300);
              if (sep < 0.035) bad = `${p.id}: trap within ${(sep * 100).toFixed(1)} % of the answer (seed ${s}, tier ${tier})`;
              if (!trapIdOk(tr.trapId, local)) bad = `${p.id}: unknown trap id ${tr.trapId}`;
            }
          }
          if (p.kind === 'choice' && !p.multi && p.options.filter((o) => o.correct).length !== 1) bad = `${p.id}: needs exactly one correct option (seed ${s}, tier ${tier})`;
          if (p.kind === 'choice' && p.options.some((o) => !o.why?.trim())) bad = `${p.id}: every option needs a why`;
          if (p.kind === 'order' && p.steps.length < 3) bad = `${p.id}: order part needs ≥ 3 steps`;
        }
        const texts = instanceTexts(inst);
        const words = texts.find((x) => BAD_WORDS.test(x));
        if (words) bad = `NaN/undefined in text (seed ${s}, tier ${tier}): ${words.slice(0, 80)}`;
        if (s <= texSeeds) {
          const tex = texErrors(texts);
          if (tex.length) bad = `TeX (seed ${s}, tier ${tier}): ${tex[0]}`;
        }
        if (bad) break;
      }
    return isTrue(`${g.id}: ${seeds} seeds × tiers ${g.tiers.join('/')} build cleanly`, !bad, bad);
  });
}
