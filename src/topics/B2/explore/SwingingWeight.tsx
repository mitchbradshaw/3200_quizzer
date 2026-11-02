// A weight swinging on a string with a constant angular amplitude: the string tension, and so the string's own
// transverse pitch, changes twice per swing. T = m g (3 cos θ − 2 cos θ0) (official 2016 B1.3–1.5; 2021 B1.2).
// The pendulum motion is integrated once per setting (RK4 over one exact period) and replayed by the animation.
import { useMemo, useRef, useState } from 'react';
import { swingTension } from '../../../physics/waves';
import { useRaf } from '../../../anim/hooks';
import { HLine, Line, LivePath, Plot, PlotText, VLine, livePathD, sample, type PlotScales } from '../../../plot/Plot';
import { Badge, Button, Callout, Legend, Readout, Readouts, SimLayout, Slider } from '../../../ui/kit';
import { PredictReveal } from '../../../ui/PredictReveal';
import { Rich } from '../../../ui/Rich';
import { completeChallenge, useProgress } from '../../../app/store';
import { swingCycle } from '../physics';

export const SWING_CHALLENGE = 'b2-swing-octave';

const G = 9.81;
const DEG = Math.PI / 180;
const W = 560;
const H = 300;
const PX = 236; // pivot
const PY = 24;
const R = 222; // drawn string length (px)
const NS = 28; // points along the drawn string
const WIGGLE = 5; // px amplitude of the drawn string vibration
const SCREEN_HZ = 2.4; // on-screen wiggle rate when T = mg (slowed down)
const METER_X = 505;
const METER_Y0 = 268; // T = 0
const METER_PX = 66; // px per mg
const TICKS = ['release', 'bottom', 'far side', 'bottom', 'back'];

export default function SwingingWeight() {
  const p = useProgress();
  const [th0Deg, setTh0Deg] = useState(30);
  const [m, setM] = useState(2); // kg
  const [L, setL] = useState(1); // m
  const [rlg, setRlg] = useState(1); // g/m
  const [playing, setPlaying] = useState(true);
  const th0 = th0Deg * DEG;
  const rl = rlg / 1000;
  const mg = m * G;
  const Tmax = swingTension(m, 0, th0);
  const Tmin = swingTension(m, th0, th0);
  const fOf = (T: number) => Math.sqrt(T / rl) / (2 * L);
  const fHang = fOf(mg);
  const fMax = fOf(Tmax);
  const fMin = fOf(Tmin);
  const ratio = fMax / fMin;
  const solved = Math.abs(ratio - 2) < 0.005;
  const done = !!p.challenges[SWING_CHALLENGE];

  // One period of the motion, and the tension / pitch over that period (ratios to the hanging values).
  const cyc = useMemo(() => swingCycle(L, th0, 400), [L, th0]);
  const curves = useMemo(() => {
    const n = cyc.theta.length;
    const T = { x: new Float64Array(n), y: new Float64Array(n) };
    const f = { x: new Float64Array(n), y: new Float64Array(n) };
    for (let i = 0; i < n; i++) {
      const tr = 3 * Math.cos(cyc.theta[i]) - 2 * Math.cos(th0);
      T.x[i] = f.x[i] = i / (n - 1);
      T.y[i] = tr;
      f.y[i] = Math.sqrt(Math.max(0, tr));
    }
    return { T, f };
  }, [cyc, th0]);
  const arc = useMemo(() => sample((a) => a, -th0, th0, 40), [th0]);

  // ---- animation (refs only)
  const wrapRef = useRef<HTMLDivElement>(null);
  const stringRef = useRef<SVGPathElement>(null);
  const bobRef = useRef<SVGCircleElement>(null);
  const barRef = useRef<SVGRectElement>(null);
  const tTextRef = useRef<SVGTextElement>(null);
  const cursorRef = useRef<SVGPathElement>(null);
  const dotT = useRef<SVGCircleElement>(null);
  const dotF = useRef<SVGCircleElement>(null);
  const scales = useRef<PlotScales | null>(null);
  const sim = useRef({ t: 0, phase: 0 });
  useRaf(
    (dt) => {
      const s = sim.current;
      const step = Math.max(0, dt); // the first frame's dt can be slightly negative
      if (playing) s.t = (s.t + step) % cyc.period;
      const u = Math.max(0, Math.min(1, s.t / cyc.period)) * (cyc.theta.length - 1);
      const i = Math.max(0, Math.min(cyc.theta.length - 2, Math.floor(u)));
      const th = cyc.theta[i] + (u - i) * (cyc.theta[i + 1] - cyc.theta[i]);
      const tr = 3 * Math.cos(th) - 2 * Math.cos(th0);
      if (playing) s.phase = (s.phase + step * 2 * Math.PI * SCREEN_HZ * Math.sqrt(Math.max(0, tr))) % (2 * Math.PI);
      // string with its own small transverse vibration (mode 1), perpendicular to the string
      const sx = Math.sin(th);
      const cy = Math.cos(th);
      const amp = WIGGLE * Math.sin(s.phase);
      let d = '';
      for (let k = 0; k <= NS; k++) {
        const q = k / NS;
        const w = amp * Math.sin(Math.PI * q);
        const x = PX + R * q * sx + w * cy;
        const y = PY + R * q * cy - w * sx;
        d += `${k ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
      }
      stringRef.current?.setAttribute('d', d);
      bobRef.current?.setAttribute('cx', (PX + R * sx).toFixed(1));
      bobRef.current?.setAttribute('cy', (PY + R * cy).toFixed(1));
      const hBar = Math.max(0, tr) * METER_PX;
      barRef.current?.setAttribute('y', (METER_Y0 - hBar).toFixed(1));
      barRef.current?.setAttribute('height', hBar.toFixed(1));
      if (tTextRef.current) tTextRef.current.textContent = `T = ${tr.toFixed(2)} mg`;
      const sc = scales.current;
      const xf = s.t / cyc.period;
      cursorRef.current?.setAttribute('d', livePathD([[xf, 0], [xf, 3]], sc));
      if (sc) {
        dotT.current?.setAttribute('cx', sc.sx(xf).toFixed(1));
        dotT.current?.setAttribute('cy', sc.sy(tr).toFixed(1));
        dotF.current?.setAttribute('cx', sc.sx(xf).toFixed(1));
        dotF.current?.setAttribute('cy', sc.sy(Math.sqrt(Math.max(0, tr))).toFixed(1));
      }
    },
    true,
    wrapRef
  );

  const tickY = (tr: number) => METER_Y0 - tr * METER_PX;
  // Meter ticks at their true heights; labels pushed apart so they never overlap at small amplitudes.
  const meterTicks: { v: number; label: string; ly: number }[] = [];
  for (const tk of [
    { v: Tmax / mg, label: 'bottom' },
    { v: 1, label: 'mg (at rest)' },
    { v: Tmin / mg, label: 'ends' },
  ]) {
    const prev = meterTicks[meterTicks.length - 1];
    meterTicks.push({ ...tk, ly: prev ? Math.max(tickY(tk.v), prev.ly + 13) : tickY(tk.v) });
  }
  return (
    <div ref={wrapRef}>
      <SimLayout
        visual={
          <>
            <svg viewBox={`0 0 ${W} ${H}`} className="anim" role="img" aria-label="A weight swinging on a string; the string vibrates faster when its tension is higher">
              <line x1={PX - 60} y1={PY} x2={PX + 60} y2={PY} stroke="var(--text-3)" strokeWidth={3} />
              <line x1={PX} y1={PY} x2={PX} y2={PY + R + 22} stroke="var(--border)" strokeDasharray="3 5" />
              <path
                d={Array.from(arc.x, (a, k) => `${k ? 'L' : 'M'}${(PX + R * Math.sin(a)).toFixed(1)} ${(PY + R * Math.cos(a)).toFixed(1)}`).join('')}
                fill="none"
                stroke="var(--border)"
                strokeDasharray="4 4"
              />
              <text x={12} y={20} className="plot-note">
                θ₀ = {th0Deg}° (dashed arc)
              </text>
              <path ref={stringRef} fill="none" stroke="var(--m1)" strokeWidth={2.4} strokeLinejoin="round" />
              <circle ref={bobRef} cx={PX} cy={PY + R} r={13} fill="var(--surface-3)" stroke="var(--text-2)" strokeWidth={1.8} />
              <circle cx={PX} cy={PY} r={4} fill="var(--text-2)" />
              {/* tension meter */}
              <text x={METER_X + 10} y={METER_Y0 + 20} textAnchor="middle" className="plot-note">
                tension
              </text>
              <rect x={METER_X} y={tickY(3)} width={20} height={3 * METER_PX} fill="none" stroke="var(--border)" />
              <rect ref={barRef} x={METER_X} y={tickY(1)} width={20} height={METER_PX} fill="var(--m1)" opacity={0.75} />
              {meterTicks.map((tk) => (
                <g key={tk.label}>
                  <line x1={METER_X - 6} x2={METER_X} y1={tickY(tk.v)} y2={tickY(tk.v)} stroke="var(--text-2)" strokeWidth={1.4} />
                  <text x={METER_X - 9} y={tk.ly + 4} textAnchor="end" className="plot-note">
                    {tk.label}
                  </text>
                </g>
              ))}
              <text ref={tTextRef} x={METER_X + 10} y={tickY(3) - 8} textAnchor="middle" className="plot-note">
                T = 1.00 mg
              </text>
            </svg>
            <Plot
              x={{ min: 0, max: 1, label: 'time through one swing period', ticks: [0, 0.25, 0.5, 0.75, 1], format: (v) => TICKS[Math.round(v * 4)] ?? '' }}
              y={{ min: 0, max: 3, label: 'ratio to the hanging value', ticks: [0, 0.5, 1, 1.5, 2, 2.5, 3] }}
              height={220}
              ariaLabel="String tension and string fundamental over one swing, as ratios to their values when the weight hangs at rest"
            >
              <HLine y={1} />
              <PlotText x={0.5} y={1} anchor="middle" dy={-7}>
                1 = hanging at rest
              </PlotText>
              {[0.25, 0.75].map((x) => (
                <VLine key={x} x={x} />
              ))}
              <Line points={curves.T} color="var(--text-2)" width={2} />
              <Line points={curves.f} color="var(--m1)" width={2.6} />
              <LivePath pathRef={cursorRef} scalesRef={scales} color="var(--text-3)" width={1.2} />
              <circle ref={dotT} r={5} fill="var(--surface)" stroke="var(--text-2)" strokeWidth={2} />
              <circle ref={dotF} r={5} fill="var(--surface)" stroke="var(--m1)" strokeWidth={2.4} />
            </Plot>
            <Legend
              items={[
                { label: 'tension T / mg', color: 'var(--text-2)' },
                { label: 'string fundamental f₁ / f₁(hanging) = √(T/mg)', color: 'var(--m1)' },
              ]}
            />
            <Rich className="note" text="The string vibrates (drawn exaggerated and slowed) faster when it is tighter. Energy gives $v^2 = 2gL(\cos\theta - \cos\theta_0)$ and the radial balance $T - mg\cos\theta = mv^2/L$, so $T = mg(3\cos\theta - 2\cos\theta_0)$: the string carries the weight **and** the centripetal force at the bottom." />
          </>
        }
        controls={
          <>
            <Slider label="swing amplitude" tex="\theta_0" tip="angular amplitude of the swing (degrees)" value={th0Deg} min={5} max={80} step={1} format={(v) => `${Math.round(v)}°`} onChange={setTh0Deg} />
            <Slider label="weight" tex="m" tip="mass of the swinging weight (kg)" value={m} min={0.1} max={10} log unit="kg" onChange={setM} />
            <Slider label="string length" tex="L" tip="length of the string, pivot to weight (m): also the vibrating length" value={L} min={0.2} max={3} step={0.01} unit="m" onChange={setL} />
            <Slider label="string mass per length" tex="\rho_l" tip="mass per unit length of the string (g/m)" value={rlg} min={0.1} max={10} log unit="g/m" onChange={setRlg} />
            <Readouts>
              <Readout tex="T_{max}" tip="tension at the bottom of the swing, m g (3 − 2 cos θ₀)" value={Tmax} unit="N" sig={3} />
              <Readout tex="T_{min}" tip="tension at the extremes of the swing, m g cos θ₀" value={Tmin} unit="N" sig={3} />
              <Readout tex="f_{max}" tip="string fundamental at the bottom, (1/2L)√(T_max/ρl)" value={fMax} unit="Hz" sig={3} tone="m1" />
              <Readout tex="f_{min}" tip="string fundamental at the extremes, (1/2L)√(T_min/ρl)" value={fMin} unit="Hz" sig={3} tone="m1" />
              <Readout tex="f_{max}/f_{min}" tip="√((3 − 2 cos θ₀)/cos θ₀): depends only on the swing amplitude" value={ratio} sig={3} tone="accent" />
              <Readout tex="\tau" tip="swing period: exact pendulum period 2π√(L/g)/AGM(1, cos(θ₀/2)), independent of m" value={cyc.period} unit="s" sig={3} />
            </Readouts>
            <Rich
              className="note"
              text={`Hanging at rest the string would sound $f_1$ = ${fHang.toPrecision(3)} Hz. While swinging it goes from ${fMin.toPrecision(3)} Hz (ends) to ${fMax.toPrecision(3)} Hz (bottom), twice per period.`}
            />
            <div className="row gap-s wrap">
              <Button size="sm" onClick={() => setPlaying((v) => !v)}>
                {playing ? 'Pause' : 'Play'}
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setTh0Deg(30);
                  setM(2);
                  setL(1);
                  setRlg(1);
                }}
              >
                2021 B1.2 set-up (30°)
              </Button>
            </div>
            <Callout kind="info" title="Challenge">
              <Rich text="Find the swing amplitude at which the string's pitch spans exactly an **octave** ($f_{max} = 2f_{min}$) in every swing. Does the answer depend on $m$, $L$ or $\rho_l$?" />
              <div className="row gap-s wrap">
                <Button size="sm" onClick={() => solved && completeChallenge(SWING_CHALLENGE)} disabled={!solved || done}>
                  {done ? '✓ Challenge complete' : solved ? 'Submit this amplitude' : `ratio now ${ratio.toFixed(3)}`}
                </Button>
                {done && <Badge tone="ok">(3 − 2cos θ₀)/cos θ₀ = 4 gives cos θ₀ = 1/2: θ₀ = 60°, whatever m, L and ρl.</Badge>}
              </div>
            </Callout>
          </>
        }
      />
      <PredictReveal
        id="b2-sw-bottom"
        question="Where in the swing is the string's own pitch (its transverse fundamental) highest?"
        options={['At the extremes, where the weight stops', 'At the bottom, where the weight moves fastest', 'Nowhere: it stays the same']}
        answer={1}
        explain="At the bottom the string must carry the weight **and** supply the centripetal force $mv^2/L$, so $T = mg(3 - 2\cos\theta_0)$ is largest there; at the extremes it carries only $mg\cos\theta_0$. Since $f \propto \sqrt T$, the pitch peaks at the bottom (official 2016 B1.4: “lowest at the bottom” was the incorrect statement)."
        tryIt="set θ₀ to 50° and watch the meter and the wiggle speed."
        onApply={() => setTh0Deg(50)}
      />
      <PredictReveal
        id="b2-sw-mass"
        question="Double the weight's mass (same swing). What happens to the string's frequencies?"
        options={['They fall, because the weight is heavier', 'They rise by √2', 'They double', 'No change']}
        answer={1}
        explain="Every tension in the swing is proportional to $m$, and $f \propto \sqrt T$, so all the string frequencies rise by $\sqrt2$ (reader quiz Q1(g); official 2016 B1.3(c) was false). The swing period does not change: the pendulum's motion does not depend on $m$."
        tryIt="read f_max, then double m."
        onApply={() => setM((v) => Math.min(10, v * 2))}
      />
      <PredictReveal
        id="b2-sw-length"
        question="Use a string twice as long, with the same swing amplitude. The string's fundamental…"
        options={['rises', 'halves', 'falls by √2', 'is unchanged']}
        answer={1}
        explain="At a given angle $T$ does not depend on $L$ ($mv^2/L$ with $v^2 \propto L$), so $f_1 = (1/2L)\sqrt{T/\rho_l}$ simply halves (official 2016 B1.3(d): “increases if the length is increased” was false). The swing itself slows by $\sqrt2$."
        tryIt="note f_max, then double L."
        onApply={() => setL((v) => Math.min(3, v * 2))}
      />
    </div>
  );
}
