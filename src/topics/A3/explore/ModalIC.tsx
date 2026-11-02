// Initial conditions → modal coordinates. Set x₁₀, x₂₀ (drag the masses or use the sliders) and the initial velocities;
// see Y₀ = P⁻¹X₀, each modal response and how x₁(t), x₂(t) are built from them. Challenge: excite only mode 1.
// The response is analytic (X = PY); the loop only moves the masses and a time cursor through refs.
import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { useRaf } from '../../../anim/hooks';
import { HLine, Line, LivePath, livePathD, Plot, type PlotScales } from '../../../plot/Plot';
import { svgPoint } from '../../../ui/diagrams';
import { Badge, Button, Callout, Legend, More, Readout, Readouts, Segmented, SimLayout, Slider } from '../../../ui/kit';
import { PredictReveal } from '../../../ui/PredictReveal';
import { Rich } from '../../../ui/Rich';
import { completeChallenge, useProgress } from '../../../app/store';
import { fmt } from '../../../engine/format';
import { chainKM, inv2, modalAmplitudes, mul, mulT, twoDof } from '../physics';
import { chainSprings, MASS, REST, VB_H, VB_W, WALL_L, WALL_R, Y_MID } from './chain';

export const A3_MODE1_CHALLENGE = 'a3-excite-mode1';
type Key = 'equal' | 'forging' | 'fixed';
const SYSTEMS: Record<Key, { m1: number; m2: number; k1: number; k2: number; k3: number; label: string }> = {
  equal: { m1: 1, m2: 1, k1: 400, k2: 400, k3: 0, label: 'Equal masses' },
  forging: { m1: 2.5, m2: 1, k1: 200, k2: 1000, k3: 0, label: 'Forging block' },
  fixed: { m1: 1, m2: 1, k1: 400, k2: 400, k3: 400, label: 'Fixed both ends' },
};
const PX_PER_MM = 1.4;
const XLIM = 30; // mm
const N = 480;

/** Initial displacements proportional to mode 2, [x10, r2 x10], kept inside the ±28 mm slider range (0.5 mm steps). */
function mode2IC(r2: number): [number, number] {
  const x10 = Math.min(15, Math.floor((28 / Math.abs(r2)) * 2) / 2);
  return [x10, Math.round(r2 * x10 * 2) / 2];
}

export default function ModalIC() {
  const prog = useProgress();
  const done = !!prog.challenges[A3_MODE1_CHALLENGE];
  const [key, setKey] = useState<Key>('equal');
  const [x0, setX0] = useState<[number, number]>([20, 0]);
  const [v0, setV0] = useState<[number, number]>([0, 0]);
  const [playing, setPlaying] = useState(true);
  const [justSolved, setJustSolved] = useState(false);

  const sys = useMemo(() => {
    const S = SYSTEMS[key];
    const { K, M } = chainKM(S.m1, S.m2, S.k1, S.k2, S.k3);
    const s = twoDof(K, M);
    return { ...s, Pi: inv2(s.P), vMax: Math.round(s.omega[0] * XLIM) };
  }, [key]);
  const P = sys.P;
  const w = sys.omega;
  const Y0 = mul(sys.Pi, x0);
  const Yd0 = mul(sys.Pi, v0);
  const C = modalAmplitudes(Y0, Yd0, w);
  const share = C[0] > 1e-9 ? C[1] / C[0] : Infinity;
  // Degenerate inputs get plain-language states instead of ∞: nothing moves at all (X₀ = Ẋ₀ = 0), or mode 1 is
  // (almost) absent, e.g. after “Set X₀ ∝ mode 2” (C₁ under 1 % of C₂, so C₂/C₁ would read 10⁴ % or ∞).
  const still = C[0] + C[1] <= 1e-9;
  const noMode1 = !still && C[0] <= 0.01 * C[1];
  const PT = mulT(P, x0);
  const back = mul(P, PT);
  const ok = C[0] >= 3 && share <= 0.03;
  const zeroX0 = x0[0] === 0 && x0[1] === 0;
  // Which initial condition carries the mode-1 shape (for the success message): displacement, velocity, or neither cleanly.
  const nearR1 = (q: number) => Number.isFinite(q) && Math.abs(q - sys.r[0]) <= 0.05 * Math.abs(sys.r[0]);
  const shapeNote =
    x0[0] !== 0 && nearR1(x0[1] / x0[0])
      ? `$x_{20}/x_{10} = ${fmt(x0[1] / x0[0], 4)} \\approx r_1 = ${fmt(sys.r[0], 4)}$: the initial shape is mode 1, so $y_{20} \\approx 0$`
      : v0[0] !== 0 && nearR1(v0[1] / v0[0])
        ? `$\\dot x_{20}/\\dot x_{10} = ${fmt(v0[1] / v0[0], 4)} \\approx r_1 = ${fmt(sys.r[0], 4)}$: the initial velocity has mode 1’s shape, so $\\dot y_{20} \\approx 0$`
        : 'The initial conditions are almost all mode 1: $y_{20}$ and $\\dot y_{20}/\\omega_2$ are under 3 % of mode 1’s amplitude';

  // ---------------------------------------------------------------- curves (recomputed only when the ICs change)
  const T = (3 * 2 * Math.PI) / w[0];
  const curves = useMemo(() => {
    const y = [0, 1].map((i) => (t: number) => Y0[i] * Math.cos(w[i] * t) + (Yd0[i] / w[i]) * Math.sin(w[i] * t));
    const mk = (f: (t: number) => number) => {
      const xs = new Float64Array(N + 1);
      const ys = new Float64Array(N + 1);
      for (let n = 0; n <= N; n++) {
        xs[n] = (T * n) / N;
        ys[n] = f(xs[n]);
      }
      return { x: xs, y: ys };
    };
    const out = [0, 1].map((j) => ({
      c1: mk((t) => P[j][0] * y[0](t)),
      c2: mk((t) => P[j][1] * y[1](t)),
      sum: mk((t) => P[j][0] * y[0](t) + P[j][1] * y[1](t)),
    }));
    let big = 1;
    for (const o of out) for (const s of [o.c1, o.c2, o.sum]) for (const v of s.y) big = Math.max(big, Math.abs(v));
    return { out, yLim: Math.ceil(big * 1.1) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [x0[0], x0[1], v0[0], v0[1], sys, T]);

  // ---------------------------------------------------------------- animation
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const massRef = [useRef<SVGGElement>(null), useRef<SVGGElement>(null)];
  const springRef = [useRef<SVGPathElement>(null), useRef<SVGPathElement>(null), useRef<SVGPathElement>(null)];
  const cursorRef = [useRef<SVGPathElement>(null), useRef<SVGPathElement>(null)];
  const scales = [useRef<PlotScales | null>(null), useRef<PlotScales | null>(null)];
  const sim = useRef({ t: 0, drag: -1 });
  const right = SYSTEMS[key].k3 > 0;

  const draw = () => {
    const t = sim.current.t;
    const y = [0, 1].map((i) => Y0[i] * Math.cos(w[i] * t) + (Yd0[i] / w[i]) * Math.sin(w[i] * t));
    const xs = [0, 1].map((j) => P[j][0] * y[0] + P[j][1] * y[1]);
    const px = xs.map((v) => Math.max(-40, Math.min(40, v * PX_PER_MM)));
    massRef.forEach((r, j) => r.current?.setAttribute('transform', `translate(${px[j].toFixed(1)} 0)`));
    chainSprings(REST[0] + px[0], REST[1] + px[1], true, right).forEach((d, i) => springRef[i].current?.setAttribute('d', d));
    const tc = t % T;
    cursorRef.forEach((r, j) =>
      r.current?.setAttribute(
        'd',
        livePathD(
          [
            [tc, -curves.yLim],
            [tc, curves.yLim],
          ],
          scales[j].current
        )
      )
    );
  };
  useRaf(
    (dt) => {
      if (sim.current.drag >= 0) return;
      sim.current.t += dt * ((2 * Math.PI * 0.5) / w[0]); // mode 1 plays at 0.5 Hz on screen
      if (sim.current.t > 40 * T) sim.current.t -= 39 * T;
      draw();
    },
    playing,
    wrapRef
  );
  useEffect(draw);

  useEffect(() => {
    if (playing && ok && !done) {
      completeChallenge(A3_MODE1_CHALLENGE);
      setJustSolved(true);
    }
  }, [playing, ok, done]);

  const release = (nx: [number, number], nv: [number, number] = v0) => {
    setX0(nx);
    setV0(nv);
    sim.current.t = 0;
    setPlaying(true);
  };
  const setSystem = (k: Key) => {
    setKey(k);
    sim.current.t = 0;
    setV0([0, 0]);
  };

  const onPointer = (j: number) => (e: RPointerEvent<SVGGElement>, phase: 'down' | 'move' | 'up') => {
    if (phase === 'down') {
      sim.current.drag = j;
      sim.current.t = 0;
      setPlaying(false);
      (e.currentTarget as SVGGElement).setPointerCapture(e.pointerId);
    }
    if (sim.current.drag !== j || !svgRef.current) return;
    const p = svgPoint(svgRef.current, e.clientX, e.clientY);
    const mm = Math.round(Math.max(-XLIM, Math.min(XLIM, (p.x - REST[j]) / PX_PER_MM)) * 2) / 2;
    const nx: [number, number] = j === 0 ? [mm, x0[1]] : [x0[0], mm];
    setX0(nx);
    if (phase === 'up') {
      sim.current.drag = -1;
      release(nx, [0, 0]);
    }
  };
  const pm = [onPointer(0), onPointer(1)];

  const plot = (j: number) => (
    <Plot
      key={j}
      x={{ min: 0, max: T, label: 'time t (s)' }}
      y={{ min: -curves.yLim, max: curves.yLim, label: `x${j ? '₂' : '₁'} (mm)` }}
      height={170}
      ariaLabel={`Displacement of mass ${j + 1} and its two modal contributions against time`}
    >
      <HLine y={0} dash={false} />
      <Line points={curves.out[j].c1} color="var(--m1)" width={1.6} dash="5 4" />
      <Line points={curves.out[j].c2} color="var(--m2)" width={1.6} dash="5 4" />
      <Line points={curves.out[j].sum} color="var(--text)" width={2.4} />
      <LivePath pathRef={cursorRef[j]} scalesRef={scales[j]} color="var(--text-3)" width={1.2} />
    </Plot>
  );

  return (
    <div ref={wrapRef}>
      <Callout kind="info" title="Challenge: excite only mode 1">
        <Rich text="Set the initial displacements (drag a mass sideways, or use the sliders) so that, released from rest, the system vibrates in **mode 1 only**: the dashed orange (mode 2) contributions must stay flat. Target: mode-2 content below 3 % of mode 1’s, with at least 3 mm of mode 1. Hint: what must $x_{20}/x_{10}$ be?" />
      </Callout>
      <SimLayout
        visual={
          <>
            <svg ref={svgRef} viewBox={`0 0 ${VB_W} ${VB_H}`} className="anim" role="img" aria-label="Two masses on springs. Drag a mass sideways to set its initial displacement, then let go.">
              <g stroke="var(--text-3)" strokeWidth={1.4}>
                <line x1={WALL_L} y1={Y_MID - 40} x2={WALL_L} y2={Y_MID + 40} strokeWidth={2.2} />
                {Array.from({ length: 9 }, (_, i) => (
                  <line key={i} x1={WALL_L} y1={Y_MID - 38 + i * 9.5} x2={WALL_L - 8} y2={Y_MID - 32 + i * 9.5} />
                ))}
                {right && <line x1={WALL_R} y1={Y_MID - 40} x2={WALL_R} y2={Y_MID + 40} strokeWidth={2.2} />}
              </g>
              {REST.map((x, j) => (
                <g key={j}>
                  <line x1={x} x2={x} y1={Y_MID - 44} y2={Y_MID + 44} stroke="var(--text-3)" strokeDasharray="3 4" />
                  <text x={x} y={VB_H - 4} textAnchor="middle" className="plot-note" style={{ fontSize: 13 }}>
                    {`x${j ? '₂' : '₁'}₀ = ${fmt(x0[j], 3)} mm`}
                  </text>
                </g>
              ))}
              {[0, 1, 2].map((i) => (
                <path key={i} ref={springRef[i]} fill="none" stroke="var(--text-2)" strokeWidth={1.8} strokeLinejoin="round" />
              ))}
              {[0, 1].map((j) => (
                <g
                  key={j}
                  ref={massRef[j]}
                  style={{ cursor: 'grab', touchAction: 'none' }}
                  onPointerDown={(e) => pm[j](e, 'down')}
                  onPointerMove={(e) => pm[j](e, 'move')}
                  onPointerUp={(e) => pm[j](e, 'up')}
                >
                  <rect x={REST[j] - MASS / 2} y={Y_MID - MASS / 2} width={MASS} height={MASS} rx={5} fill="var(--surface-2)" stroke="var(--accent)" strokeWidth={2} />
                  <text x={REST[j]} y={Y_MID + 6} textAnchor="middle" className="diagram-label" style={{ fontSize: 17 }}>
                    {j ? 'm₂' : 'm₁'}
                  </text>
                </g>
              ))}
            </svg>
            {plot(0)}
            {plot(1)}
            <Legend
              items={[
                { label: 'mode 1 part, Pⱼ₁y₁(t)', color: 'var(--m1)', dash: true },
                { label: 'mode 2 part, Pⱼ₂y₂(t)', color: 'var(--m2)', dash: true },
                { label: 'xⱼ(t) = sum', color: 'var(--text)' },
              ]}
            />
            <p className="muted small">Each displacement is the sum of two modal parts, each at its own frequency. Animation slowed so mode 1 plays at 0.5 Hz; the plots are in real time.</p>
          </>
        }
        controls={
          <>
            <Segmented<Key> label="System" size="sm" value={key} onChange={setSystem} options={(Object.keys(SYSTEMS) as Key[]).map((k) => ({ value: k, label: SYSTEMS[k].label }))} />
            <Readouts>
              <Readout tex="\omega_1" tip="mode 1 natural frequency" value={w[0]} unit="rad/s" tone="m1" />
              <Readout tex="\omega_2" tip="mode 2 natural frequency" value={w[1]} unit="rad/s" tone="m2" />
              <Readout tex="r_1" tip="mode 1 shape X₂/X₁" value={sys.r[0]} sig={4} tone="m1" />
              <Readout tex="r_2" tip="mode 2 shape X₂/X₁" value={sys.r[1]} sig={4} tone="m2" />
            </Readouts>
            <Slider label="initial x₁" tex="x_{10}" tip="initial displacement of m₁ (mm)" value={x0[0]} min={-XLIM} max={XLIM} step={0.5} unit="mm" onChange={(v) => release([v, x0[1]])} />
            <Slider label="initial x₂" tex="x_{20}" tip="initial displacement of m₂ (mm)" value={x0[1]} min={-XLIM} max={XLIM} step={0.5} unit="mm" onChange={(v) => release([x0[0], v])} />
            <More label="Initial velocities">
              <Slider label="initial ẋ₁" tex="\dot x_{10}" tip="initial velocity of m₁ (mm/s)" value={v0[0]} min={-sys.vMax} max={sys.vMax} step={1} unit="mm/s" onChange={(v) => release(x0, [v, v0[1]])} />
              <Slider label="initial ẋ₂" tex="\dot x_{20}" tip="initial velocity of m₂ (mm/s)" value={v0[1]} min={-sys.vMax} max={sys.vMax} step={1} unit="mm/s" onChange={(v) => release(x0, [v0[0], v])} />
            </More>
            <Readouts>
              <Readout tex="y_{10}" tip="modal initial displacement of mode 1, (P⁻¹X₀)₁" value={Y0[0]} unit="mm" sig={3} tone="m1" />
              <Readout tex="y_{20}" tip="modal initial displacement of mode 2, (P⁻¹X₀)₂" value={Y0[1]} unit="mm" sig={3} tone="m2" />
              <Readout tex="\dot y_{10}" tip="modal initial velocity of mode 1, (P⁻¹Ẋ₀)₁" value={Yd0[0]} unit="mm/s" sig={3} tone="m1" />
              <Readout tex="\dot y_{20}" tip="modal initial velocity of mode 2, (P⁻¹Ẋ₀)₂" value={Yd0[1]} unit="mm/s" sig={3} tone="m2" />
              <Readout
                tex="C_2/C_1"
                tip="mode-2 amplitude over mode-1 amplitude, Cᵢ = √(yᵢ₀² + (ẏᵢ₀/ωᵢ)²)"
                value={still || noMode1 ? undefined : share * 100}
                text={still ? 'no motion' : noMode1 ? '≈ mode 2 only' : undefined}
                unit="%"
                sig={3}
                tone={still ? undefined : ok ? 'ok' : 'warn'}
              />
            </Readouts>
            <Rich
              className="note"
              text={
                zeroX0
                  ? 'Trap check: with $X_0 = 0$ both $P^TX_0$ and $P^{-1}X_0$ are zero, so they cannot be told apart. Set a displacement to compare them: the modal initial conditions are $P^{-1}X_0$.'
                  : `Trap check: $P^TX_0 = [${fmt(PT[0], 3)};\\;${fmt(PT[1], 3)}]$ mm, and $P(P^TX_0) = [${fmt(back[0], 3)};\\;${fmt(back[1], 3)}]$ mm ${Math.abs(back[0] - x0[0]) + Math.abs(back[1] - x0[1]) < 0.05 ? '$= X_0$ (only by luck here)' : '$\\ne X_0$'}. The modal initial conditions are $P^{-1}X_0$.`
              }
            />
            {ok ? (
              <Callout kind="ok" title={justSolved || done ? 'Only mode 1 is moving' : 'Mode 1 only'}>
                <Rich text={`${shapeNote}, and the uncoupled modal equations keep $y_2$ near zero. Both masses move in step at $\\omega_1$.`} />
              </Callout>
            ) : (
              <Badge tone={still ? 'muted' : 'warn'}>
                {still ? 'No motion: set a displacement or velocity' : noMode1 ? 'Almost pure mode 2 (target: mode 1 only)' : `mode-2 content ${fmt(share * 100, 3)} % (target < 3 %)`}
              </Badge>
            )}
            {done && <Badge tone="ok">✓ Challenge complete</Badge>}
            <div className="row gap-s wrap">
              <Button size="sm" variant="primary" onClick={() => release(x0)}>
                Release
              </Button>
              <Button size="sm" onClick={() => setPlaying((p) => !p)}>
                {playing ? 'Pause' : 'Play'}
              </Button>
              <Button size="sm" onClick={() => release(mode2IC(sys.r[1]), [0, 0])}>
                Set X₀ ∝ mode 2
              </Button>
              <Button size="sm" onClick={() => release([0, 0], [0, Math.round(sys.vMax * 0.65)])}>
                Hammer blow on m₂
              </Button>
            </div>
          </>
        }
      />
      <PredictReveal
        id="a3-ic-one-mass"
        question="Equal masses, free top. Hold $m_2$ at equilibrium, displace $m_1$ by 20 mm and release from rest. How many frequencies appear in $x_1(t)$?"
        options={['One: ω₁', 'One: ω₂', 'Two: ω₁ and ω₂ superposed']}
        answer={2}
        explain="$X_0 = [20,\,0]$ mm is not proportional to either mode, so $Y_0 = P^{-1}X_0 = [5.53,\;14.47]$ mm: both modes are excited and each displacement is a sum of two cosines (never a single cosine at some average frequency). Here mode 2 even gets the larger share."
        tryIt="choose Equal masses and set x₁₀ = 20, x₂₀ = 0."
        onApply={() => {
          setKey('equal');
          release([20, 0], [0, 0]);
        }}
      />
      <PredictReveal
        id="a3-ic-mode2"
        question="Set $X_0$ proportional to mode 2 ($x_{20} = r_2x_{10}$) and release from rest. What does $x_1(t)$ look like?"
        options={['A pure cosine at ω₂', 'A beat between ω₁ and ω₂', 'A pure cosine at ω₁']}
        answer={0}
        explain="$Y_0 = P^{-1}X_0 = [0,\;x_{10}]$, so $y_1$ starts at rest at zero and, because the modal equations are uncoupled, stays there. Every coordinate then moves at $\omega_2$ only. The same idea with mode 1’s shape is the challenge (2022 A2.5)."
        tryIt="press “Set X₀ ∝ mode 2”."
        onApply={() => release(mode2IC(sys.r[1]), [0, 0])}
      />
      <PredictReveal
        id="a3-ic-ptrans"
        question="Equal masses, $X_0 = [20,\,0]$ mm. Someone writes $Y_0 = P^TX_0 = [20,\,20]$ mm. Is that right?"
        options={['Yes: Pᵀ undoes P', 'No: P is not orthogonal; Y₀ = P⁻¹X₀ = [5.53, 14.47] mm']}
        answer={1}
        explain="Check by transforming back: $P[20;\,20] = [40;\,20] \ne X_0$, while $P[5.53;\,14.47] = [20;\,0]$ ✓. Only mass-normalised modes have the shortcut $\bar P^{-1} = \bar P^TM$ (summary notes trap 3). Watch the trap-check line under the readouts."
        tryIt="set x₁₀ = 20, x₂₀ = 0 and read the trap-check line."
        onApply={() => {
          setKey('equal');
          release([20, 0], [0, 0]);
        }}
      />
      <PredictReveal
        id="a3-ic-hammer"
        question="Forging block: a hammer blow gives the machine ($m_2$) a velocity while the block starts at rest. Which mode dominates the block’s displacement $x_1$?"
        options={['Mode 1 (the slow one)', 'Mode 2 (the fast one)', 'They contribute equally']}
        answer={0}
        explain="$\dot Y_0 = P^{-1}[0;\,\dot x_{20}]$ gives equal and opposite modal velocities, but displacement amplitude = velocity ÷ $\omega$, so the slow mode is about $\omega_2/\omega_1 \approx 5$ times bigger. Week 4 Q4: 1.147 mm from mode 1 against 0.228 mm from mode 2, and $|x_1| \le 1.375$ mm."
        tryIt="choose Forging block and press “Hammer blow on m₂”; compare the dashed curves in the x₁ plot."
        onApply={() => {
          setKey('forging');
          sim.current.t = 0;
          const S = SYSTEMS.forging;
          const wf = twoDof(chainKM(S.m1, S.m2, S.k1, S.k2, S.k3).K, chainKM(S.m1, S.m2, S.k1, S.k2, S.k3).M).omega[0];
          setX0([0, 0]);
          setV0([0, Math.round(wf * XLIM * 0.65)]);
          setPlaying(true);
        }}
      />
    </div>
  );
}
