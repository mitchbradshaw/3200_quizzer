// Exam sprints: Quick (≈12 auto-marked items, 20 min) and Mock (≈⅓ paper in real proportions, 60 min).
import { useEffect, useState } from 'react';
import { TOPICS, challengeIds } from '../topics';
import type { TopicCode } from '../engine/codes';
import type { Tier, TopicDef } from '../engine/types';
import { freshSeed, makeRng, type Rng } from '../engine/rng';
import { getProgress, itemPriority, mastery, recordSprint, useProgress } from '../app/store';
import { ItemRunner, solveMarks, type RunItem } from './ItemRunner';
import { Button, Callout, LinkButton } from '../ui/kit';
import { fmt } from '../engine/format';

const pickTier = (tiers: Tier[]): Tier => (tiers.includes(2) ? 2 : tiers[0]);

/** Weighted pick of up to n items, preferring weak topics and unseen/often-missed items. */
function weightedPick<T extends RunItem>(pool: T[], n: number, rng: Rng, perTopicCap = 3): T[] {
  const p = getProgress();
  const scored = pool.map((it) => {
    const m = mastery(p, it.topic.code, challengeIds(it.topic)).value;
    const key = it.kind === 'mcq' ? `quiz:${it.mcq.id}` : it.kind === 'solve' ? `solve:${it.gen.id}` : `short:${it.sa.id}`;
    const pr = itemPriority(p, key);
    const w = (1.6 - m) * Math.exp(-0.6 * pr);
    return { it, s: Math.pow(rng.next(), 1 / Math.max(0.05, w)) };
  });
  scored.sort((a, b) => b.s - a.s);
  const out: T[] = [];
  const perTopic: Record<string, number> = {};
  for (const { it } of scored) {
    if (out.length >= n) break;
    const c = perTopic[it.topic.code] || 0;
    if (c >= perTopicCap) continue;
    perTopic[it.topic.code] = c + 1;
    out.push(it);
  }
  return out;
}

function mcqPool(codes: TopicCode[] | null, section?: string): RunItem[] {
  return TOPICS.filter((t) => !codes || codes.includes(t.code)).flatMap((t) =>
    t.mcqs.map((mcq) => ({ kind: 'mcq' as const, topic: t, mcq, section, marks: mcq.marks ?? 2.5 }))
  );
}

function solvePool(codes: TopicCode[] | null, rng: Rng, opts: { section?: string; sprintOnly?: boolean } = {}): RunItem[] {
  return TOPICS.filter((t) => !codes || codes.includes(t.code)).flatMap((t: TopicDef) =>
    t.solve
      .filter((g) => !opts.sprintOnly || g.sprint !== false)
      .map((gen) => {
        const tier = pickTier(gen.tiers);
        const seed = 100000 + Math.floor(rng.next() * 900000);
        return { kind: 'solve' as const, topic: t, gen, tier, seed, section: opts.section, marks: solveMarks(gen, tier, seed) };
      })
  );
}

export function buildQuick(seed: number): RunItem[] {
  const rng = makeRng(seed);
  const solves = weightedPick(solvePool(null, rng, { sprintOnly: true }), 5, rng, 1);
  const mcqs = weightedPick(mcqPool(null), 12 - solves.length, rng, 2);
  // Normalise marks: 1 per item in the quick sprint.
  return rng.shuffle([...mcqs, ...solves]).map((it) => ({ ...it, marks: 1 }));
}

export function buildMock(seed: number): RunItem[] {
  const rng = makeRng(seed);
  const A1 = weightedPick(solvePool(['A1', 'A3', 'A4', 'A6'], rng, { section: 'A1 short numericals', sprintOnly: true }), 1, rng, 1);
  const A2 = weightedPick(solvePool(['A2'], rng, { section: 'A2 Lagrange derivation' }), 1, rng, 1);
  const A3m = weightedPick(mcqPool(['C1', 'C2', 'C3', 'C4', 'A5'], 'A3 measurement & control'), 2, rng, 1);
  const shortPool: RunItem[] = TOPICS.filter((t) => ['C1', 'C2', 'C3', 'C4', 'A5', 'A1'].includes(t.code)).flatMap((t) =>
    (t.shortAnswers || []).map((sa) => ({ kind: 'short' as const, topic: t, sa, section: 'A3 measurement & control', marks: sa.marks ?? 2 }))
  );
  const A3s = weightedPick(shortPool, 1, rng, 1);
  const B1 = weightedPick(mcqPool(['B1', 'B2', 'B3', 'B4', 'B5'], 'B1 continuous-systems MCQs'), 2, rng, 1);
  const B2 = weightedPick(solvePool(['B6'], rng, { section: 'B2 design problem' }), 1, rng, 1);
  // One long question per mock (alternating A2 / B2 by seed), so a mock is ~⅓ of a paper at 1.8 min per mark.
  const long = seed % 2 === 0 ? A2 : B2;
  return [...A1, ...(seed % 2 === 0 ? long : []), ...A3m, ...A3s, ...B1, ...(seed % 2 === 1 ? long : [])];
}

/** Exam pace: 180 min for 100 marks. */
export function mockMinutes(items: RunItem[]): number {
  const marks = items.reduce((t, it) => t + it.marks, 0);
  return Math.max(30, Math.min(90, Math.round((1.8 * marks) / 5) * 5));
}

// Keep an in-progress sprint across route changes (leaving and coming back resumes the same set).
type Run = { mode: 'quick' | 'mock'; seed: number; items: RunItem[] };
let active: Run | null = null;

function getOrCreate(mode: 'quick' | 'mock'): Run {
  if (!active || active.mode !== mode) {
    const seed = freshSeed();
    active = { mode, seed, items: mode === 'quick' ? buildQuick(seed) : buildMock(seed) };
  }
  return active;
}

export function Sprint({ mode }: { mode?: 'quick' | 'mock' }) {
  const p = useProgress();
  const [run, setRun] = useState<Run | null>(() => (mode ? getOrCreate(mode) : null));
  useEffect(() => {
    setRun(mode ? getOrCreate(mode) : null);
  }, [mode]);
  const items = run?.items ?? [];

  if (!mode) {
    const last = p.sprints.slice(-8).reverse();
    return (
      <div className="stack">
        <h1>Exam sprint</h1>
        <div className="item-grid">
          <a className="item-tile" href="#/sprint/quick">
            <div className="item-title">Quick sprint · 20 min</div>
            <p>About 12 auto-marked items across all topics, weighted towards your weakest topics and anything you missed recently. Daily practice.</p>
          </a>
          <a className="item-tile" href="#/sprint/mock">
            <div className="item-title">Mock paper · about 60 min</div>
            <p>
              About a third of a real paper at exam pace (1.8 min per mark): an A1 numerical, one long question (the A2 Lagrange chain or the B2 design problem, alternating), A3 MCQs plus a word-limited answer, two B1
              MCQs.
            </p>
          </a>
        </div>
        {last.length > 0 && (
          <table className="table">
            <thead>
              <tr>
                <th>When</th>
                <th>Mode</th>
                <th>Score</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {last.map((s) => (
                <tr key={s.t}>
                  <td>{new Date(s.t).toLocaleString()}</td>
                  <td>{s.mode}</td>
                  <td className="mono">
                    {fmt(s.score, 3)} / {s.max} ({Math.round((100 * s.score) / (s.max || 1))} %)
                  </td>
                  <td className="mono">{Math.round(s.secs / 60)} min</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="row between wrap gap-s">
        <h1>{mode === 'quick' ? 'Quick sprint' : 'Mock paper'}</h1>
        <div className="row gap-s">
          <Button
            onClick={() => {
              active = null;
              setRun(getOrCreate(mode));
            }}
          >
            New set
          </Button>
          <LinkButton href="#/sprint" variant="ghost">
            All sprints
          </LinkButton>
        </div>
      </div>
      {mode === 'mock' && (
        <Callout kind="info">
          First answers count. Hints unlock once you have answered every part of a problem. Write the formula, substitute, then compute, exactly as you would on paper.
        </Callout>
      )}
      <ItemRunner
        key={run?.seed}
        items={items}
        minutes={mode === 'quick' ? 20 : mockMinutes(items)}
        requireStart
        showPartMarks={mode === 'mock'}
        runKey={run?.seed}
        intro={
          mode === 'mock' ? (
            <p className="muted">
              About a third of a real paper at exam pace (1.8 min per mark). Each mock has one long question, alternating between the A2 Lagrange
              derivation and the B2 design problem. First answers count; hints unlock once every part is answered.
            </p>
          ) : (
            <p className="muted">Auto-marked items from every topic, weighted towards your weakest topics and anything you missed recently. One mark each.</p>
          )
        }
        title={mode === 'quick' ? 'Quick sprint' : 'Mock paper'}
        onFinish={(res, secs) => {
          const max = items.reduce((t, it) => t + it.marks, 0);
          const score = res.reduce((t, r) => t + (r ? r.score : 0), 0);
          recordSprint({ mode, score: Math.round(score * 10) / 10, max, secs });
          active = null;
        }}
      />
    </div>
  );
}
