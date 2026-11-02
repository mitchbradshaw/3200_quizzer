// Animated mass–spring–damper. Free response from a released displacement, analytic (exact) at any frame rate.
import { useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { criticalDamping, dampedFrequency, dampingRatio, freeResponse, freeVelocity, naturalFrequency } from '../../../physics/sdof';
import { useRaf } from '../../../anim/hooks';
import { damperPaths, Ground, springPath, svgPoint } from '../../../ui/diagrams';
import { HLine, LivePath, livePathD, Plot, type PlotScales } from '../../../plot/Plot';
import { Badge, Button, Readout, Readouts, Segmented, SimLayout, Slider } from '../../../ui/kit';
import { PredictReveal } from '../../../ui/PredictReveal';
import { Rich } from '../../../ui/Rich';

const W = 560;
const H = 130;
const WALL_X = 40;
const REST_X = 300; // mass centre at equilibrium (px)
const PX_PER_M = 2400; // 1 mm = 2.4 px
const MASS_W = 64;
const T_WIN = 6; // seconds per trace sweep

export default function MassSpring() {
  const [m, setM] = useState(2);
  const [k, setK] = useState(400);
  const [c, setC] = useState(3);
  const [running, setRunning] = useState(true);
  const wn = naturalFrequency(k, m);
  const cc = criticalDamping(k, m);
  const zeta = dampingRatio(c, k, m);
  const wd = dampedFrequency(wn, zeta);
  const regime = Math.abs(zeta - 1) < 0.02 ? 'critically damped' : zeta < 1 ? (zeta === 0 ? 'undamped' : 'under-damped') : 'over-damped';

  // Simulation state lives in a ref: the animation loop mutates it without re-rendering React.
  const sim = useRef({ t: 0, x0: 0.04, v0: 0, x: 0.04, v: 0, sweep: 0, buf: [] as [number, number][], dragging: false });
  const svgRef = useRef<SVGSVGElement>(null);
  const massRef = useRef<SVGGElement>(null);
  const springRef = useRef<SVGPathElement>(null);
  const cylRef = useRef<SVGPathElement>(null);
  const rodRef = useRef<SVGPathElement>(null);
  const traceRef = useRef<SVGPathElement>(null);
  const scales = useRef<PlotScales | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  // The animation pauses when the drawing and trace are off screen (not just the whole activity).
  const visRef = useRef<HTMLDivElement>(null);

  /** Restart the analytic solution from the current state, so changing a parameter mid-motion is seamless. */
  const rebase = () => {
    const s = sim.current;
    s.x0 = s.x;
    s.v0 = s.v;
    s.t = 0;
  };
  const withRebase = (set: (v: number) => void) => (v: number) => {
    rebase();
    set(v);
  };

  const draw = () => {
    const s = sim.current;
    const cx = REST_X + s.x * PX_PER_M;
    massRef.current?.setAttribute('transform', `translate(${cx.toFixed(1)} 0)`);
    const left = cx - MASS_W / 2;
    springRef.current?.setAttribute('d', springPath(WALL_X, 45, left, 45, 7, 9));
    const d = damperPaths(WALL_X, 92, left, 92);
    cylRef.current?.setAttribute('d', d.cyl);
    rodRef.current?.setAttribute('d', d.rod);
    traceRef.current?.setAttribute('d', livePathD(s.buf, scales.current));
  };

  useRaf(
    (dt) => {
      const s = sim.current;
      if (running && !s.dragging) {
        s.t += dt;
        s.x = freeResponse(s.t, s.x0, s.v0, wn, zeta);
        s.v = freeVelocity(s.t, s.x0, s.v0, wn, zeta);
        s.sweep += dt;
        if (s.sweep > T_WIN) {
          s.sweep = 0;
          s.buf = [];
        }
        s.buf.push([s.sweep, s.x * 1000]);
      }
      draw();
    },
    true,
    visRef
  );

  const release = (xmm: number) => {
    const s = sim.current;
    s.x0 = s.x = xmm / 1000;
    s.v0 = s.v = 0;
    s.t = 0;
    s.sweep = 0;
    s.buf = [];
    setRunning(true);
  };

  const onPointer = (e: RPointerEvent<SVGGElement>, phase: 'down' | 'move' | 'up') => {
    const s = sim.current;
    if (phase === 'down') {
      s.dragging = true;
      (e.currentTarget as SVGGElement).setPointerCapture(e.pointerId);
    }
    if (!s.dragging || !svgRef.current) return;
    const p = svgPoint(svgRef.current, e.clientX, e.clientY);
    s.x = Math.max(-0.05, Math.min(0.05, (p.x - REST_X) / PX_PER_M));
    s.v = 0;
    if (phase === 'up') {
      s.dragging = false;
      release(s.x * 1000);
    }
  };

  const preset = (z: number) => {
    rebase();
    setC(z * cc);
    release(40);
  };

  return (
    <div ref={wrapRef}>
      <SimLayout
        visual={
          <div ref={visRef}>
            <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="anim" role="img" aria-label="Mass on a spring and damper attached to a wall. Drag the mass and release it.">
              <Ground x={WALL_X} y={68} w={110} vertical side="left" />
              <line x1={REST_X} x2={REST_X} y1={10} y2={124} stroke="var(--text-3)" strokeDasharray="3 4" />
              <text x={REST_X + 4} y={124} className="plot-note">
                equilibrium
              </text>
              <path ref={springRef} fill="none" stroke="var(--text-2)" strokeWidth={1.8} />
              <path ref={cylRef} fill="none" stroke="var(--text-2)" strokeWidth={1.8} />
              <path ref={rodRef} fill="none" stroke="var(--text-2)" strokeWidth={1.8} />
              <g
                ref={massRef}
                style={{ cursor: 'grab', touchAction: 'none' }}
                onPointerDown={(e) => onPointer(e, 'down')}
                onPointerMove={(e) => onPointer(e, 'move')}
                onPointerUp={(e) => onPointer(e, 'up')}
              >
                <rect x={-MASS_W / 2} y={28} width={MASS_W} height={80} rx={5} fill="var(--surface-2)" stroke="var(--m1)" strokeWidth={2} />
                <text x={0} y={73} textAnchor="middle" className="diagram-label">
                  m
                </text>
              </g>
              <text x={WALL_X + 70} y={30} className="plot-note">
                k
              </text>
              <text x={WALL_X + 70} y={118} className="plot-note">
                c
              </text>
            </svg>
            <Plot x={{ min: 0, max: T_WIN, label: 'time in this sweep (s)' }} y={{ min: -50, max: 50, label: 'x (mm)' }} height={200} ariaLabel="Displacement against time">
              <HLine y={0} dash={false} />
              <LivePath pathRef={traceRef} scalesRef={scales} color="var(--m1)" />
            </Plot>
            <p className="muted small">Drag the mass sideways and let go. Changing a slider mid-motion carries on from the current position and velocity.</p>
          </div>
        }
        controls={
          <>
            <Slider label="mass" tex="m" tip="mass (kg)" value={m} min={0.5} max={10} step={0.1} unit="kg" onChange={withRebase(setM)} />
            <Slider label="stiffness" tex="k" tip="spring stiffness (N/m)" value={k} min={50} max={2000} log unit="N/m" onChange={withRebase(setK)} />
            <Slider label="damping" tex="c" tip="viscous damping coefficient (N s/m)" value={c} min={0} max={Math.max(3 * cc, 1)} step={0.05} unit="N s/m" onChange={withRebase(setC)} />
            <div className="row gap-s wrap">
              <span className="muted small">Set ζ:</span>
              <Segmented
                size="sm"
                label="Damping presets"
                value={-1}
                onChange={(z: number) => preset(z)}
                options={[
                  { value: 0, label: '0' },
                  { value: 0.1, label: '0.1' },
                  { value: 1, label: '1' },
                  { value: 2, label: '2' },
                ]}
              />
            </div>
            <Readouts>
              <Readout tex="\omega_n" tip="undamped natural frequency √(k/m)" value={wn} unit="rad/s" />
              <Readout tex="f_n" tip="natural frequency in Hz = ωn/2π" value={wn / (2 * Math.PI)} unit="Hz" />
              <Readout tex="c_c" tip="critical damping 2√(km)" value={cc} unit="N s/m" />
              <Readout tex="\zeta" tip="damping ratio c/c_c" value={zeta} sig={3} tone={zeta < 1 ? 'm1' : zeta > 1.02 ? 'm2' : 'ok'} />
              <Readout tex="\omega_d" tip="damped natural frequency ωn√(1−ζ²)" value={wd} unit="rad/s" text={zeta >= 1 ? 'none' : undefined} />
            </Readouts>
            <div className="row gap-s wrap">
              <Badge tone={regime === 'critically damped' ? 'ok' : 'accent'}>{regime}</Badge>
              <Button size="sm" onClick={() => release(40)}>
                Release from 40 mm
              </Button>
              <Button size="sm" onClick={() => setRunning((r) => !r)}>
                {running ? 'Pause' : 'Play'}
              </Button>
            </div>
            <Rich
              className="note"
              text={
                zeta < 1
                  ? `Oscillates at $\\omega_d$ = ${wd.toFixed(2)} rad/s inside an envelope decaying as $e^{-\\zeta\\omega_n t}$ ${zeta > 0 ? `(time constant ${(1 / (zeta * wn)).toFixed(2)} s).` : '(undamped: no decay, it oscillates for ever).'}`
                  : zeta > 1.02
                    ? `Two real roots; the slow one, $\\omega_n(\\zeta-\\sqrt{\\zeta^2-1})$ = ${(wn * (zeta - Math.sqrt(zeta * zeta - 1))).toFixed(2)} s⁻¹, makes it creep back.`
                    : 'Fastest return without crossing equilibrium: $x = x_0(1+\\omega_n t)e^{-\\omega_n t}$.'
              }
            />
          </>
        }
      />
      <PredictReveal
        id="a1-msd-double-m"
        question="Set $c = 0$, then **double the mass** $m$. What happens to the natural frequency $\omega_n$?"
        options={['It doubles', 'It rises by √2', 'It falls to 1/√2 of its value (×0.71)', 'It halves']}
        answer={2}
        explain="$\omega_n = \sqrt{k/m} \propto m^{-1/2}$, so doubling $m$ multiplies $\omega_n$ by $1/\sqrt2 \approx 0.707$ (the period grows by √2). More mass lowers frequencies; more stiffness raises them."
        tryIt="set c to 0, watch the period, then double m."
        onApply={() => {
          rebase();
          setC(0);
          setM(Math.min(10, m * 2));
        }}
      />
      <PredictReveal
        id="a1-msd-critical"
        question="Set $c = c_c$ and release from rest. Does the mass overshoot equilibrium?"
        options={['Yes, once', 'Yes, it oscillates a few times', 'No: it returns without crossing']}
        answer={2}
        explain="At $\zeta = 1$, $x = x_0(1+\omega_n t)e^{-\omega_n t} > 0$ for all $t$: it never crosses. This is the fastest return without overshoot, which is why a door closer is set to $c = 2\sqrt{kI}$ (2021 A1.1)."
        tryIt="press ζ = 1 and watch the trace."
        onApply={() => preset(1)}
      />
      <PredictReveal
        id="a1-msd-overdamped"
        question="Compared with $\zeta = 1$, with $\zeta = 2$ the mass gets back to equilibrium…"
        options={['faster', 'slower', 'at the same rate']}
        answer={1}
        explain="Over-damping slows the return. The slow root is $\omega_n(\zeta - \sqrt{\zeta^2-1}) = 0.27\,\omega_n$ at $\zeta = 2$, so it creeps back (2% settling: 14.9/ωₙ vs 5.8/ωₙ at ζ = 1)."
        tryIt="press ζ = 2 and compare the trace with ζ = 1."
        onApply={() => preset(2)}
      />
    </div>
  );
}
