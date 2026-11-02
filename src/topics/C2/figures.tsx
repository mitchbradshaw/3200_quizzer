// Static figures for C2 Solve problems: exam-style FRF plots with lettered data cursors and a cursor table,
// a free-decay trace, a wheel-on-rail receptance sum and a beam layout sketch. Each factory returns a
// ComponentType for one instance.
import type { ComponentType } from 'react';
import { cabs } from '../../physics/complex';
import { sdofReceptance } from '../../physics/frf';
import { Dot, HLine, Line, Plot, sample } from '../../plot/Plot';
import { Legend } from '../../ui/kit';
import { Figure } from '../../ui/diagrams';

export interface Cursor {
  tag: string;
  x: number;
  y: number;
  /** Text shown in the cursor table, e.g. "92.8046 rad/s, 5.43917×10⁻⁶ m/N". */
  text: string;
}

function CursorTable({ cursors }: { cursors: Cursor[] }) {
  return (
    <table className="givens" aria-label="Data cursors">
      <tbody>
        {cursors.map((c) => (
          <tr key={c.tag}>
            <th>{c.tag}</th>
            <td className="mono">{c.text}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Receptance magnitude |H| (linear) against ω (rad/s), as in 2025 A3.3, with lettered cursors. */
export function magFigure(p: { k: number; m: number; c: number; wMax: number; scale: number; unit: string; cursors: Cursor[] }): ComponentType {
  const pts = sample((w) => cabs(sdofReceptance(p.k, p.m, p.c, w)) * p.scale, 0, p.wMax, 700);
  let top = 0;
  for (let i = 0; i < pts.y.length; i++) top = Math.max(top, pts.y[i]);
  const Fig = () => (
    <div>
      <Plot x={{ min: 0, max: p.wMax, label: 'ω (rad/s)' }} y={{ min: 0, max: top * 1.15, label: `|H| (${p.unit})` }} height={230} ariaLabel="Receptance magnitude with data cursors">
        <Line points={pts} color="var(--text)" width={2.2} />
        {p.cursors.map((c) => (
          <Dot key={c.tag} x={c.x} y={c.y} color="var(--accent)" label={c.tag} labelPos="above" />
        ))}
      </Plot>
      <CursorTable cursors={p.cursors} />
    </div>
  );
  return Fig;
}

/** Real and imaginary parts of a receptance (or accelerance) against ω (rad/s), as in 2024 A3.4. */
export function reImFigure(p: { re: (w: number) => number; im: (w: number) => number; wMax: number; unit: string; sym: string; reCursors: Cursor[]; imCursors: Cursor[] }): ComponentType {
  const re = sample(p.re, 0, p.wMax, 800);
  const im = sample(p.im, 0, p.wMax, 800);
  const ext = (ys: Float64Array) => {
    let lo = 0;
    let hi = 0;
    for (let i = 0; i < ys.length; i++) {
      lo = Math.min(lo, ys[i]);
      hi = Math.max(hi, ys[i]);
    }
    const pad = 0.12 * (hi - lo || 1);
    return { min: lo - pad, max: hi + pad };
  };
  const Fig = () => (
    <div>
      <Plot x={{ min: 0, max: p.wMax, label: 'ω (rad/s)' }} y={{ ...ext(re.y), label: `Re ${p.sym} (${p.unit})` }} height={190} ariaLabel="Real part with data cursors">
        <Line points={re} color="var(--text)" width={2.2} />
        {p.reCursors.map((c) => (
          <Dot key={c.tag} x={c.x} y={c.y} color="var(--accent)" label={c.tag} labelPos={c.y >= 0 ? 'above' : 'right'} />
        ))}
      </Plot>
      <Plot x={{ min: 0, max: p.wMax, label: 'ω (rad/s)' }} y={{ ...ext(im.y), label: `Im ${p.sym} (${p.unit})` }} height={190} ariaLabel="Imaginary part with data cursors">
        <Line points={im} color="var(--text)" width={2.2} />
        {p.imCursors.map((c) => (
          <Dot key={c.tag} x={c.x} y={c.y} color="var(--accent)" label={c.tag} labelPos="right" />
        ))}
      </Plot>
      <CursorTable cursors={[...p.reCursors, ...p.imCursors]} />
    </div>
  );
  return Fig;
}

/** Free decay x = X0 e^(−ζωn t) cos(ωd t) with the counted peaks marked. */
export function decayFigure(p: { zeta: number; fn: number; X0: number; cycles: number; unit: string; marks: { n: number; label: string }[] }): ComponentType {
  const wn = 2 * Math.PI * p.fn;
  const wd = wn * Math.sqrt(1 - p.zeta * p.zeta);
  const Td = (2 * Math.PI) / wd;
  const tMax = (p.cycles + 0.6) * Td;
  // The peaks of e^(−ζωn t) cos(ωd t) lie a constant time before t = n Td; use the envelope value at n Td.
  const x = (t: number) => p.X0 * Math.exp(-p.zeta * wn * t) * Math.cos(wd * t);
  const pts = sample(x, 0, tMax, 900);
  const Fig = () => (
    <div>
      <Plot x={{ min: 0, max: tMax, label: 'time (s)' }} y={{ min: -1.15 * p.X0, max: 1.15 * p.X0, label: `x (${p.unit})` }} height={220} ariaLabel="Free decay with marked peaks">
        <HLine y={0} dash={false} />
        <Line points={pts} color="var(--text)" width={1.8} />
        {p.marks.map((mk) => (
          <Dot key={mk.n} x={mk.n * Td} y={p.X0 * Math.exp(-p.zeta * wn * mk.n * Td)} color="var(--accent)" label={mk.label} labelPos="above" />
        ))}
      </Plot>
    </div>
  );
  return Fig;
}

/**
 * Wheel on rail (2021 A3.2): receptance magnitudes (nm/N) of a point mass, α_w = −1/(mω²), of a rail that is
 * spring-like below its own resonance, α_r = A_r e^(−iδ) (magnitude A_r, a small phase lag δ from damping), and of
 * their complex sum, which dips where the two are equal in size and nearly opposite in phase (the coupled
 * resonance). At the crossing |α_w + α_r| = 2 A_r sin(δ/2).
 */
export function couplingFigure(p: { m: number; Ar: number; delta: number; fMax: number; fc: number }): ComponentType {
  const wheel = (f: number) => 1e9 / (p.m * (2 * Math.PI * f) ** 2);
  const sum = (f: number) => Math.hypot(p.Ar * Math.cos(p.delta) - wheel(f), p.Ar * Math.sin(p.delta));
  const top = 2.6 * p.Ar;
  const fLo = p.fMax / 60;
  const w = sample(wheel, fLo, p.fMax, 500);
  const s = sample(sum, fLo, p.fMax, 900);
  const r = sample(() => p.Ar, fLo, p.fMax, 2);
  const Fig = () => (
    <div>
      <Plot x={{ min: 0, max: p.fMax, label: 'frequency (Hz)' }} y={{ min: 0, max: top, label: 'receptance magnitude (nm/N)' }} height={220} ariaLabel="Receptance magnitudes of the wheel, the rail and their sum">
        <Line points={w} color="var(--text-2)" width={1.8} dash />
        <Line points={r} color="var(--text-3)" width={2.2} />
        <Line points={s} color="var(--text)" width={2.4} />
        <Dot x={p.fc} y={sum(p.fc)} color="var(--accent)" label="dip" labelPos="above" />
      </Plot>
      <Legend
        items={[
          { label: `wheel (point mass ${p.m} kg)`, color: 'var(--text-2)', dash: true },
          { label: 'rail (spring-like, measured)', color: 'var(--text-3)' },
          { label: '|wheel + rail| (complex sum)', color: 'var(--text)' },
        ]}
      />
    </div>
  );
  return Fig;
}

/** Pinned–pinned beam with sensor positions (squares) and the shaker (arrow), as in 2024 A3.5. */
export function beamLayoutFigure(p: { sensors: number[]; shaker: number; labels: string[] }): ComponentType {
  const X0 = 30;
  const X1 = 330;
  const Y = 70;
  const px = (x: number) => X0 + (X1 - X0) * x;
  const Fig = () => (
    <Figure width={360} height={130} label="Pinned–pinned beam with accelerometers and a shaker">
      <line x1={X0} x2={X1} y1={Y} y2={Y} stroke="var(--text)" strokeWidth={4} strokeLinecap="round" />
      {[X0, X1].map((x) => (
        <path key={x} d={`M${x} ${Y}l-9 15h18z`} fill="var(--surface-2)" stroke="var(--text-2)" strokeWidth={1.5} />
      ))}
      {p.sensors.map((s, i) => (
        <g key={i}>
          <rect x={px(s) - 6} y={Y - 18} width={12} height={12} rx={2} fill="var(--text-2)" />
          <text x={px(s)} y={Y - 24} textAnchor="middle" className="plot-note">
            {p.labels[i]}
          </text>
        </g>
      ))}
      <line x1={px(p.shaker)} x2={px(p.shaker)} y1={Y + 44} y2={Y + 8} stroke="var(--accent)" strokeWidth={2.5} />
      <path d={`M${px(p.shaker)} ${Y + 4}l-6 10h12z`} fill="var(--accent)" />
      <text x={px(p.shaker) + 8} y={Y + 42} className="plot-note">
        shaker
      </text>
      <text x={X0} y={Y + 56} textAnchor="middle" className="plot-note">
        0
      </text>
      <text x={X1} y={Y + 56} textAnchor="middle" className="plot-note">
        L
      </text>
    </Figure>
  );
  return Fig;
}
