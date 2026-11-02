// "Choose the correct sketch": four labelled candidate mode shapes drawn from the beam and torsion
// shapes, with the problem's supports on every panel, plus the matching choice part.
import type { ComponentType } from 'react';
import { modeShape } from '../../physics/beams';
import type { ChoicePart } from '../../engine/types';
import type { Rng } from '../../engine/rng';
import { hashString, makeRng } from '../../engine/rng';

export type End = 'clamped' | 'pinned' | 'free' | 'wall';
export type ShapeKey = `${'cf' | 'cc' | 'pp' | 'cp' | 'tff' | 'tfx'}${1 | 2 | 3 | 4}`;

const N = 96;

/** Samples of a candidate shape on xi = 0..1, scaled to max |y| = 1 (free end or first extremum positive). */
export function shapeSamples(key: ShapeKey): number[] {
  const fam = key.replace(/\d$/, '');
  const i = Number(key.slice(-1));
  const f = (xi: number): number => {
    switch (fam) {
      case 'cf':
        return modeShape('clamped-free', i, xi);
      case 'cc':
        return modeShape('clamped-clamped', i, xi);
      case 'cp':
        return modeShape('clamped-pinned', i, xi);
      case 'pp':
      case 'tfx':
        return Math.sin(i * Math.PI * xi);
      default:
        return Math.sin(((2 * i - 1) * Math.PI * xi) / 2);
    }
  };
  const ys = Array.from({ length: N + 1 }, (_, k) => f(k / N));
  const big = Math.max(...ys.map(Math.abs)) || 1;
  let sign = 1;
  if (fam === 'cf' || fam === 'tff') sign = ys[N] < 0 ? -1 : 1;
  else {
    const first = ys.find((v) => Math.abs(v) > 0.5 * big) ?? 1;
    sign = first < 0 ? -1 : 1;
  }
  return ys.map((v) => (sign * v) / big);
}

/** Interior zero crossings of sampled values (fractions of L). */
export function sampleNodes(ys: number[]): number[] {
  const out: number[] = [];
  for (let k = 1; k < ys.length; k++) {
    const a = ys[k - 1];
    const b = ys[k];
    if (a * b < 0) {
      const x = (k - 1 + a / (a - b)) / (ys.length - 1);
      if (x > 0.02 && x < 0.98) out.push(x);
    }
  }
  return out;
}

export interface SketchProps {
  title: string;
  left: End;
  right: End;
  color: string;
  candidates: { label: string; ys: number[] }[];
  yLabel?: string;
}

const X0 = 22;
const X1 = 186;
const Y0 = 50;
const AMP = 28;

function Support({ x, end, side }: { x: number; end: End; side: -1 | 1 }) {
  if (end === 'free') return null;
  if (end === 'pinned')
    return (
      <g stroke="var(--text-2)" strokeWidth={1.3} fill="var(--surface)">
        <path d={`M${x} ${Y0}L${x - 6} ${Y0 + 10}L${x + 6} ${Y0 + 10}Z`} />
        <line x1={x - 9} y1={Y0 + 12} x2={x + 9} y2={Y0 + 12} stroke="var(--text-3)" />
      </g>
    );
  const hatch = [];
  for (let k = -3; k <= 3; k++) hatch.push(<line key={k} x1={x} y1={Y0 + k * 7} x2={x + side * 6} y2={Y0 + k * 7 + 5} />);
  return (
    <g stroke="var(--text-3)" strokeWidth={1.1}>
      <line x1={x} y1={Y0 - 24} x2={x} y2={Y0 + 24} stroke="var(--text-2)" strokeWidth={2.4} />
      {hatch}
    </g>
  );
}

export function SketchChoices({ title, left, right, color, candidates, yLabel = 'deflection' }: SketchProps) {
  return (
    <figure style={{ margin: 0 }}>
      <figcaption className="small muted" style={{ marginBottom: 4 }}>
        {title}
      </figcaption>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
        {candidates.map((c) => {
          const pts = c.ys.map((y, k) => `${(X0 + ((X1 - X0) * k) / (c.ys.length - 1)).toFixed(1)} ${(Y0 - AMP * y).toFixed(1)}`);
          const nds = sampleNodes(c.ys);
          return (
            <svg key={c.label} viewBox="0 0 200 96" width="100%" role="img" aria-label={`Sketch ${c.label}: candidate ${yLabel} shape with ${nds.length} interior node(s)`} style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)' }}>
              <line x1={X0} y1={Y0} x2={X1} y2={Y0} stroke="var(--border)" strokeDasharray="3 3" />
              <Support x={X0} end={left} side={-1} />
              <Support x={X1} end={right} side={1} />
              <path d={`M${pts.join('L')}`} fill="none" stroke={color} strokeWidth={2.4} strokeLinejoin="round" />
              {nds.map((x) => (
                <circle key={x} cx={X0 + (X1 - X0) * x} cy={Y0} r={3} fill="var(--surface)" stroke="var(--text-2)" strokeWidth={1.3} />
              ))}
              <text x={6} y={14} className="diagram-label" fontWeight={700}>
                ({c.label})
              </text>
            </svg>
          );
        })}
      </div>
    </figure>
  );
}

/** A zero-prop figure component for a SolveInstance. */
export function sketchFigure(p: SketchProps): ComponentType {
  const Fig = () => <SketchChoices {...p} />;
  return Fig;
}

/**
 * Arrange options so that ChoiceInput (which shuffles with makeRng(seed ^ hashString(partId))) shows them
 * in the given order, keeping the (a)–(d) labels in sequence. If the shuffle ever changes, the options are
 * merely shown in another order.
 */
export function inDisplayOrder<T>(seed: number, partId: string, opts: T[]): T[] {
  const order = makeRng(seed ^ hashString(partId)).shuffle(opts.map((_, i) => i));
  const out = new Array<T>(opts.length);
  order.forEach((src, pos) => (out[src] = opts[pos]));
  return out;
}

export type SketchTarget =
  | { kind: 'cantilever'; mode: 2 | 3 }
  | { kind: 'pinned'; mode: 2 | 3 }
  | { kind: 'torsion-ff'; mode: 2 | 3 }
  | { kind: 'torsion-fx'; mode: 2 | 3 };

const nodeTxt = (ys: number[]) => {
  const n = sampleNodes(ys);
  return n.length ? `${n.length} interior node${n.length > 1 ? 's' : ''} (${n.map((x) => `${x.toFixed(2)}L`).join(', ')})` : 'no interior node';
};

/** Builds the sketch figure and the choice part for a target mode, with three distractors. */
export function sketchQuestion(rng: Rng, target: SketchTarget, partId = 'sketch', marks = 2): { figure: ComponentType; part: ChoicePart } {
  const m = target.mode;
  const other = (m === 2 ? 3 : 2) as 2 | 3;
  let left: End;
  let right: End;
  let correct: ShapeKey;
  let correctWhy: string;
  let pool: { key: ShapeKey; why: string }[];
  let what: string;
  let yLabel = 'deflection';
  if (target.kind === 'cantilever') {
    left = 'clamped';
    right = 'free';
    correct = `cf${m}`;
    what = `bending mode ${m} of the cantilever`;
    correctWhy = `Zero deflection and zero slope at the clamp, ${nodeTxt(shapeSamples(correct))}, and a straight (zero-curvature) free end with the largest deflection.`;
    pool = [
      { key: `tff${m}`, why: 'It leaves the root with a slope and reaches the tip flat: a fixed–free **torsion** mode (pure sine). A clamped bending root leaves horizontally; a free bending tip is straight but sloped.' },
      { key: `cf${other}`, why: `${nodeTxt(shapeSamples(`cf${other}`))}: that is bending mode ${other}. Cantilever mode $n$ has $n - 1$ interior nodes.` },
      { key: `cp${m}`, why: 'The tip does not move: that is a clamped–pinned shape. The free tip moves the most.' },
      { key: `cc${m}`, why: 'Zero deflection and slope at the tip: clamped at both ends. The free tip must move.' },
    ];
  } else if (target.kind === 'pinned') {
    left = 'pinned';
    right = 'pinned';
    correct = `pp${m}`;
    what = `bending mode ${m} of the pinned–pinned shaft`;
    correctWhy = `A pure sine: zero deflection and zero curvature (no moment) at both bearings, crossing them with a slope; ${nodeTxt(shapeSamples(correct))}.`;
    pool = [
      { key: `cc${m}`, why: 'Zero slope at the supports means clamped ends. A pin carries no moment, so the beam crosses it with a slope and zero curvature.' },
      { key: `pp${other}`, why: `${nodeTxt(shapeSamples(`pp${other}`))}: that is mode ${other}. Pinned–pinned mode $n$ has $n - 1$ interior nodes.` },
      { key: 'pp1', why: 'No interior node: that is mode 1.' },
      { key: `cp${m}`, why: 'Zero slope at the left support means a clamp there; both supports are bearings (pins).' },
    ];
  } else if (target.kind === 'torsion-ff') {
    left = 'wall';
    right = 'free';
    yLabel = 'twist';
    correct = `tff${m}`;
    what = `torsional mode ${m} (fixed–free)`;
    correctWhy = `$\\theta = \\sin((2n-1)\\pi x/2L)$: zero twist but the largest slope (torque) at the fixed end, zero slope (no torque) at the free end; ${nodeTxt(shapeSamples(correct))}.`;
    pool = [
      { key: `cf${m}`, why: 'Zero slope at the fixed end would mean zero torque there; that is a cantilever **bending** shape with hyperbolic terms.' },
      { key: `tfx${m}`, why: 'The twist is zero at the free end: that is a fixed–fixed shape. A free end carries no torque, so its twist slope is zero, not its twist.' },
      { key: `tff${other}`, why: `${nodeTxt(shapeSamples(`tff${other}`))}: that is torsional mode ${other}.` },
    ];
  } else {
    left = 'wall';
    right = 'wall';
    yLabel = 'twist';
    correct = `tfx${m}`;
    what = `torsional mode ${m} (fixed–fixed)`;
    correctWhy = `$\\theta = \\sin(n\\pi x/L)$: zero twist at both fixed ends, where the slope (torque) is largest; ${nodeTxt(shapeSamples(correct))}. Same shape as pinned–pinned bending, but frequencies spaced 1 : 2 : 3, not 1 : 4 : 9.`;
    pool = [
      { key: `cc${m}`, why: 'Zero slope at the fixed ends would mean no torque there; that is a clamped–clamped **bending** shape (hyperbolic terms).' },
      { key: `tff${m}`, why: 'The right end twists freely: that is fixed–free. Both rotors are held here.' },
      { key: `tfx${other}`, why: `${nodeTxt(shapeSamples(`tfx${other}`))}: that is mode ${other}.` },
    ];
  }
  const distractors = rng.shuffle(pool).slice(0, 3);
  const items = rng.shuffle([{ key: correct, why: correctWhy, ok: true }, ...distractors.map((d) => ({ ...d, ok: false }))]);
  const labels = ['a', 'b', 'c', 'd'];
  const color = `var(--m${m})`;
  const figure = sketchFigure({
    title: `Candidate sketches for ${what}. Supports as in the problem; circles mark interior nodes.`,
    left,
    right,
    color,
    yLabel,
    candidates: items.map((it, i) => ({ label: labels[i], ys: shapeSamples(it.key) })),
  });
  const options = items.map((it, i) => ({ text: `Sketch (${labels[i]})`, correct: it.ok, why: it.why }));
  const part: ChoicePart = {
    kind: 'choice',
    id: partId,
    label: `Which sketch shows ${what}? (The figure shows the four candidates.)`,
    options: inDisplayOrder(rng.seed, partId, options),
    marks,
  };
  return { figure, part };
}
