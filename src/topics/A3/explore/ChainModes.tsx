// Two-mass chain: animate mode 1, mode 2 or both; mode shapes along the chain; the frequency equation in numbers.
// Positions are analytic (cos of each mode's phase); the loop only writes SVG attributes through refs.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRaf } from '../../../anim/hooks';
import { Dot, HLine, Line, Plot } from '../../../plot/Plot';
import { Badge, Button, Legend, More, Readout, Readouts, Segmented, SimLayout, Slider } from '../../../ui/kit';
import { PredictReveal } from '../../../ui/PredictReveal';
import { Rich, TeX } from '../../../ui/Rich';
import { matTeX } from '../../../ui/inputs';
import { fmt, tex } from '../../../engine/format';
import { chainKM, quadCoeffs, twoDof } from '../physics';
import { chainSprings, MASS, nodesOf, REST, unitMax, VB_H, VB_W, WALL_L, WALL_R, Y_MID } from './chain';

type View = 0 | 1 | 2; // 0 = both modes together
type Sys = { m1: number; m2: number; k1: number; k2: number; k3: number };

const PRESETS: Record<string, Sys & { label: string }> = {
  equal: { m1: 1, m2: 1, k1: 400, k2: 400, k3: 0, label: 'Equal, free top' },
  forging: { m1: 2, m2: 1, k1: 200, k2: 400, k3: 0, label: 'Forging (Week 3 Q1)' },
  fixed: { m1: 1, m2: 1, k1: 400, k2: 400, k3: 400, label: 'Fixed both ends' },
  free: { m1: 0.9, m2: 1, k1: 0, k2: 400, k3: 0, label: 'Free wagons' },
};
const AMP = 30; // px for a unit mode entry
const POS_LABEL = ['ground', 'm₁', 'm₂', 'wall'];

export default function ChainModes() {
  const [p, setP] = useState<Sys>(PRESETS.equal);
  const [view, setView] = useState<View>(1);
  const [playing, setPlaying] = useState(true);
  const set = (key: keyof Sys) => (v: number) => setP((q) => ({ ...q, [key]: v }));

  const sys = useMemo(() => {
    const { K, M } = chainKM(p.m1, p.m2, p.k1, p.k2, p.k3);
    const s = twoDof(K, M);
    const col = (j: number) => unitMax([s.P[0][j], s.P[1][j]]);
    return { K, M, ...s, A: [col(0), col(1)], q: quadCoeffs(K, M) };
  }, [p]);
  const left = p.k1 > 0;
  const right = p.k3 > 0;
  const rigid = sys.omega[0] < 1e-6;

  // ---------------------------------------------------------------- animation (refs only)
  const wrapRef = useRef<HTMLDivElement>(null);
  const massRef = [useRef<SVGGElement>(null), useRef<SVGGElement>(null)];
  const springRef = [useRef<SVGPathElement>(null), useRef<SVGPathElement>(null), useRef<SVGPathElement>(null)];
  const t = useRef(0);
  const draw = () => {
    const wRef = rigid ? sys.omega[1] : sys.omega[0];
    const k = (2 * Math.PI * 0.5) / wRef; // the slower (non-zero) mode plays at 0.5 Hz on screen
    const ph1 = rigid ? 2 * Math.PI * 0.25 * t.current : sys.omega[0] * k * t.current;
    const ph2 = sys.omega[1] * k * t.current;
    const c1 = Math.cos(ph1);
    const c2 = Math.cos(ph2);
    const x = [0, 1].map((j) => (view === 1 ? sys.A[0][j] * c1 : view === 2 ? sys.A[1][j] * c2 : 0.5 * (sys.A[0][j] * c1 + sys.A[1][j] * c2)) * AMP);
    const cx1 = REST[0] + x[0];
    const cx2 = REST[1] + x[1];
    massRef[0].current?.setAttribute('transform', `translate(${x[0].toFixed(1)} 0)`);
    massRef[1].current?.setAttribute('transform', `translate(${x[1].toFixed(1)} 0)`);
    const d = chainSprings(cx1, cx2, left, right);
    d.forEach((s, i) => springRef[i].current?.setAttribute('d', s));
  };
  useRaf(
    (dt) => {
      t.current += dt;
      draw();
    },
    playing,
    wrapRef
  );
  // Redraw once whenever the system or view changes (covers the paused state and the first paint).
  useEffect(draw);

  // ---------------------------------------------------------------- mode-shape plot data
  const shapes = useMemo(
    () =>
      [0, 1].map((i) => {
        const pts: [number, number][] = [];
        if (left) pts.push([0, 0]);
        pts.push([1, sys.A[i][0]], [2, sys.A[i][1]]);
        if (right) pts.push([3, 0]);
        return { pts, nodes: nodesOf(pts) };
      }),
    [sys, left, right]
  );
  const xMax = right ? 3.25 : 2.25;
  const ticks = right ? [0, 1, 2, 3] : [0, 1, 2];
  const showMode = (i: number) => view === 0 || view === i + 1;
  const rFmt = (r: number) => (Number.isFinite(r) ? r : NaN);

  const preset = (key: keyof typeof PRESETS, v?: View) => {
    setP(PRESETS[key]);
    if (v !== undefined) setView(v);
    setPlaying(true);
  };

  const arrow = (i: number) =>
    [0, 1].map((j) => {
      const L = sys.A[i][j] * 30;
      const x0 = REST[j];
      const dir = Math.sign(L) || 1;
      return Math.abs(L) < 2 ? null : (
        <g key={`${i}-${j}`} stroke={`var(--m${i + 1})`} fill={`var(--m${i + 1})`} strokeWidth={2.4}>
          <line x1={x0} y1={18} x2={x0 + L - dir * 6} y2={18} />
          <path d={`M${x0 + L} 18 l${-dir * 8} -5 v10 z`} stroke="none" />
        </g>
      );
    });

  return (
    <div ref={wrapRef}>
      <SimLayout
        visual={
          <>
            <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="anim" role="img" aria-label="Two masses joined by springs, oscillating in the selected mode">
              {left && (
                <g stroke="var(--text-3)" strokeWidth={1.4}>
                  <line x1={WALL_L} y1={Y_MID - 40} x2={WALL_L} y2={Y_MID + 40} strokeWidth={2.2} />
                  {Array.from({ length: 9 }, (_, i) => (
                    <line key={i} x1={WALL_L} y1={Y_MID - 38 + i * 9.5} x2={WALL_L - 8} y2={Y_MID - 32 + i * 9.5} />
                  ))}
                </g>
              )}
              {right && (
                <g stroke="var(--text-3)" strokeWidth={1.4}>
                  <line x1={WALL_R} y1={Y_MID - 40} x2={WALL_R} y2={Y_MID + 40} strokeWidth={2.2} />
                  {Array.from({ length: 9 }, (_, i) => (
                    <line key={i} x1={WALL_R} y1={Y_MID - 38 + i * 9.5} x2={WALL_R + 8} y2={Y_MID - 32 + i * 9.5} />
                  ))}
                </g>
              )}
              {REST.map((x, j) => (
                <line key={j} x1={x} x2={x} y1={Y_MID + 34} y2={Y_MID + 44} stroke="var(--text-3)" strokeWidth={1.5} />
              ))}
              {[0, 1, 2].map((i) => (
                <path key={i} ref={springRef[i]} fill="none" stroke="var(--text-2)" strokeWidth={1.8} strokeLinejoin="round" />
              ))}
              {[0, 1].map((j) => (
                <g key={j} ref={massRef[j]}>
                  <rect x={REST[j] - MASS / 2} y={Y_MID - MASS / 2} width={MASS} height={MASS} rx={5} fill="var(--surface-2)" stroke="var(--text-2)" strokeWidth={1.8} />
                  <text x={REST[j]} y={Y_MID + 6} textAnchor="middle" className="diagram-label" style={{ fontSize: 17 }}>
                    {j ? 'm₂' : 'm₁'}
                  </text>
                </g>
              ))}
              <text x={left ? (WALL_L + REST[0] - MASS / 2) / 2 : 0} y={Y_MID + 36} textAnchor="middle" className="plot-note" style={{ fontSize: 15 }}>
                {left ? 'k₁' : ''}
              </text>
              <text x={(REST[0] + REST[1]) / 2} y={Y_MID + 36} textAnchor="middle" className="plot-note" style={{ fontSize: 15 }}>
                k₂
              </text>
              {right && (
                <text x={(REST[1] + MASS / 2 + WALL_R) / 2} y={Y_MID + 36} textAnchor="middle" className="plot-note" style={{ fontSize: 15 }}>
                  k₃
                </text>
              )}
              {view !== 0 && arrow(view - 1)}
              <text x={VB_W - 6} y={22} textAnchor="end" className="plot-note" style={{ fontSize: 14 }} fill={view ? `var(--m${view})` : 'var(--text-2)'}>
                {view === 0 ? 'modes 1 + 2 together' : `mode ${view} shape`}
              </text>
            </svg>
            <Plot
              x={{ min: left ? -0.25 : 0.75, max: xMax, ticks, format: (v) => POS_LABEL[Math.round(v)] ?? '', label: 'position along the chain' }}
              y={{ min: -1.25, max: 1.25, ticks: [-1, 0, 1], label: 'relative amplitude' }}
              height={190}
              ariaLabel="Mode shapes plotted along the chain; zero crossings are nodes"
            >
              <HLine y={0} dash={false} />
              {[0, 1].map((i) => (
                <g key={i} opacity={showMode(i) ? 1 : 0.28}>
                  <Line points={shapes[i].pts} color={`var(--m${i + 1})`} width={showMode(i) ? 2.8 : 1.6} />
                  {shapes[i].pts.map(([x, y], k) => (
                    <Dot key={k} x={x} y={y} r={x === 1 || x === 2 ? 4.5 : 3} color={`var(--m${i + 1})`} />
                  ))}
                  {showMode(i) && shapes[i].nodes.map((xn, k) => <Dot key={`n${k}`} x={xn} y={0} hollow r={5} color={`var(--m${i + 1})`} label="node" labelPos="above" />)}
                </g>
              ))}
            </Plot>
            <Legend
              items={[
                { label: `mode 1: ω₁ = ${fmt(sys.omega[0], 4)} rad/s`, color: 'var(--m1)' },
                { label: `mode 2: ω₂ = ${fmt(sys.omega[1], 4)} rad/s`, color: 'var(--m2)' },
              ]}
            />
            <p className="muted small">Arrows show the selected mode’s shape: the ratio of the two amplitudes is all a mode fixes. Animation slowed: the slower mode plays at 0.5 Hz, the faster at its true frequency ratio.</p>
          </>
        }
        controls={
          <>
            <Segmented<View>
              label="Which motion to animate"
              value={view}
              onChange={setView}
              options={[
                { value: 1, label: 'Mode 1' },
                { value: 2, label: 'Mode 2' },
                { value: 0, label: 'Both' },
              ]}
            />
            <Slider label="lower mass" tex="m_1" tip="mass nearer the ground (kg)" value={p.m1} min={0.5} max={5} step={0.1} unit="kg" onChange={set('m1')} />
            <Slider label="upper mass" tex="m_2" tip="outer mass (kg)" value={p.m2} min={0.5} max={5} step={0.1} unit="kg" onChange={set('m2')} />
            <Slider label="ground spring" tex="k_1" tip="spring from the left wall to m₁ (N/m); 0 = free" value={p.k1} min={0} max={1000} step={10} unit="N/m" onChange={set('k1')} />
            <Slider label="coupling spring" tex="k_2" tip="spring between the masses (N/m)" value={p.k2} min={10} max={1000} step={10} unit="N/m" onChange={set('k2')} />
            <Slider label="outer spring" tex="k_3" tip="spring from m₂ to the right wall (N/m); 0 = free end" value={p.k3} min={0} max={1000} step={10} unit="N/m" onChange={set('k3')} />
            <Readouts>
              <Readout tex="\omega_1" tip="lower natural frequency √λ₁" value={sys.omega[0]} unit="rad/s" tone="m1" />
              <Readout tex="\omega_2" tip="higher natural frequency √λ₂" value={sys.omega[1]} unit="rad/s" tone="m2" />
              <Readout tex="f_1" tip="ω₁/2π" value={sys.omega[0] / (2 * Math.PI)} unit="Hz" tone="m1" />
              <Readout tex="f_2" tip="ω₂/2π" value={sys.omega[1] / (2 * Math.PI)} unit="Hz" tone="m2" />
              <Readout tex="r_1" tip="mode 1 ratio X₂/X₁ (dimensionless)" value={rFmt(sys.r[0])} sig={4} tone="m1" />
              <Readout tex="r_2" tip="mode 2 ratio X₂/X₁ (dimensionless)" value={rFmt(sys.r[1])} sig={4} tone="m2" />
            </Readouts>
            <div className="row gap-s wrap">
              {rigid ? <Badge tone="warn">ω₁ = 0: rigid-body mode (det K = 0)</Badge> : <Badge tone="accent">{sys.r[0] > 0 ? 'mode 1 in phase' : 'mode 1 out of phase'}</Badge>}
              <Badge tone="m2">{sys.r[1] < 0 ? 'mode 2 out of phase' : 'mode 2 in phase'}</Badge>
            </div>
            {rigid && <Rich className="note" text="With no spring to ground the system can roll away: mode 1 is a rigid drift at $\omega = 0$ (animated as a slow sway only so you can see its shape, $[1,\,1]$)." />}
            <div className="row gap-s wrap">
              <span className="muted small">Presets:</span>
              {(Object.keys(PRESETS) as (keyof typeof PRESETS)[]).map((k) => (
                <Button key={k} size="sm" onClick={() => preset(k)}>
                  {PRESETS[k].label}
                </Button>
              ))}
            </div>
            <Button size="sm" onClick={() => setPlaying((v) => !v)}>
              {playing ? 'Pause' : 'Play'}
            </Button>
            <More label="Matrices and the frequency equation">
              <TeX display>{`M = ${matTeX(sys.M)}\\ \\text{kg}, \\quad K = ${matTeX(sys.K)}\\ \\text{N/m}`}</TeX>
              <TeX display>{`\\det(K-\\lambda M) = ${tex(sys.q.a, 4)}\\lambda^2 - ${tex(sys.q.b, 4)}\\lambda + ${tex(sys.q.c, 4)} = 0`}</TeX>
              <TeX display>{`\\lambda = ${tex(sys.omega2[0], 4)},\\ ${tex(sys.omega2[1], 4)}\\ \\text{rad}^2/\\text{s}^2, \\quad P = ${Number.isFinite(sys.r[0]) && Number.isFinite(sys.r[1]) ? matTeX([[1, 1], [sys.r[0], sys.r[1]]]) : matTeX(sys.P)}`}</TeX>
              <Rich className="note" text={`Check: $r_1r_2 = ${tex(sys.r[0] * sys.r[1], 4)}$ and $-m_1/m_2 = ${tex(-p.m1 / p.m2, 4)}$ (orthogonality with diagonal $M$).`} />
            </More>
          </>
        }
      />
      <PredictReveal
        id="a3-chain-double-m2"
        question="Start from equal masses and springs with a free top. If you **double $m_2$**, which natural frequency drops more, in percent?"
        options={['ω₁ drops more', 'ω₂ drops more', 'Both drop by the same percentage']}
        answer={0}
        explain="$\omega_1$: 12.36 → 9.36 rad/s (−24 %); $\omega_2$: 32.36 → 30.20 rad/s (−7 %). In mode 1 the top mass moves most ($r_1 = 1.618$), so mode 1’s modal mass $m_1 + m_2r_1^2$ grows far more. Mass added where a mode moves a lot lowers that mode’s frequency most; mass at a node changes nothing."
        tryIt="press “Equal, free top”, note ω₁ and ω₂, then drag m₂ to 2 kg."
        onApply={() => {
          setP({ ...PRESETS.equal, m2: 2 });
          setView(1);
        }}
      />
      <PredictReveal
        id="a3-chain-free"
        question="With $k_3 = 0$, set the ground spring $k_1 = 0$ so nothing holds the chain. What happens to mode 1?"
        options={['ω₁ rises', 'ω₁ → 0 and mode 1 becomes [1, 1]: both masses move together', 'Mode 1 disappears and only one mode is left']}
        answer={1}
        explain="With no spring to ground $\det K = 0$, so one root is $\omega = 0$. Its shape solves $KA = 0$: no spring stretches, so both masses move together (a rigid-body mode). The flexible mode has $\omega^2 = k_2(1/m_1 + 1/m_2)$ and zero momentum, $x_2/x_1 = -m_1/m_2$ (Week 3 Q2, official 2017 A1)."
        tryIt="drag k₁ to 0 and watch ω₁ and the mode-1 line."
        onApply={() => {
          setP((q) => ({ ...q, k1: 0, k3: 0 }));
          setView(1);
        }}
      />
      <PredictReveal
        id="a3-chain-node"
        question="Equal masses and springs, **fixed at both ends**. In mode 2, which point of the chain stays still?"
        options={['Neither mass moves', 'The middle of spring k₂', 'The middle of mass m₁', 'No point stays still']}
        answer={1}
        explain="Mode 2 is $[1,\,-1]$: the masses move equal and opposite, so the midpoint of the coupling spring is a node ($\omega_2 = \sqrt{3k/m}$). Mode 1 is $[1,\,1]$ at $\omega_1 = \sqrt{k/m}$: the middle spring is never stretched."
        tryIt="press “Fixed both ends” and choose Mode 2."
        onApply={() => preset('fixed', 2)}
      />
    </div>
  );
}
