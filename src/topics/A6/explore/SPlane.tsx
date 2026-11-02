// Eigenvalues in the complex (s) plane. Drag the pole, or change ζ and ωn, and read the eigenvalue the way the exam asks:
// ωn = |s| (distance from the origin), ζ = −Re s/|s| = cos θ, ωd = Im s, decay rate ζωn = −Re s (LA9 Eqs 9.9, 9.15).
// The free response is analytic; the loop only draws the live trace and its dot through refs.
import { useMemo, useRef, useState } from 'react';
import { useRaf, useWidth } from '../../../anim/hooks';
import { Dot, Handle, HLine, Line, LivePath, livePathD, Plot, PlotText, usePlot, VLine, type PlotScales } from '../../../plot/Plot';
import { Badge, Button, Legend, Readout, Readouts, Segmented, SimLayout, Slider } from '../../../ui/kit';
import { PredictReveal } from '../../../ui/PredictReveal';
import { Rich } from '../../../ui/Rich';
import { fmt, tex } from '../../../engine/format';
import { freeResponse } from '../../../physics/sdof';

const RANGES = [12, 25, 120, 2000, 8000];
const H_S = 330; // s-plane plot height (px)
const MARGIN_X = 68; // Plot's left + right margins with an axis label
const MARGIN_Y = 52; // Plot's top + bottom margins with an axis label
const N_T = 600; // samples of the time response
const SWEEP_S = 6; // screen seconds per sweep of the time window
const LN100 = Math.log(100);

type Pole = { under: true; re: number; im: number } | { under: false; r1: number; r2: number };

/** Poles of s² + 2ζωn s + ωn² = 0: a conjugate pair (ζ < 1) or two real roots, r1 the slow one (LA9 Eq 9.9). */
function polesOf(wn: number, z: number): Pole {
  if (z < 1) return { under: true, re: -z * wn, im: wn * Math.sqrt(1 - z * z) };
  const d = wn * Math.sqrt(z * z - 1);
  return { under: false, r1: -z * wn + d, r2: -z * wn - d };
}

/** An eigenvalue marker: the classic pole cross, drawn in data units. */
function Cross({ x, y, color, size = 7 }: { x: number; y: number; color: string; size?: number }) {
  const { sx, sy, x0, iw } = usePlot();
  const px = sx(x);
  const py = sy(y);
  if (!Number.isFinite(px) || px < x0 - 2 || px > x0 + iw + 2) return null;
  return (
    <path d={`M${px - size} ${py - size}L${px + size} ${py + size}M${px - size} ${py + size}L${px + size} ${py - size}`} stroke={color} strokeWidth={3} strokeLinecap="round" pointerEvents="none" />
  );
}

/** Arc for the angle θ between the negative real axis and the ray to the pole (cos θ = ζ). */
function AngleArc({ re, im, color }: { re: number; im: number; color: string }) {
  const { sx, sy } = usePlot();
  const cx = sx(0);
  const cy = sy(0);
  const ux = sx(re) - cx;
  const uy = sy(im) - cy;
  const L = Math.hypot(ux, uy);
  if (L < 30) return null;
  const r = Math.min(34, L * 0.45);
  const ex = cx + (r * ux) / L;
  const ey = cy + (r * uy) / L;
  const mid = Math.atan2(uy, ux) / 2 - Math.PI / 2; // halfway between −π (the negative real axis) and the ray
  const lx = cx + (r + 11) * Math.cos(mid);
  const ly = cy + (r + 11) * Math.sin(mid);
  return (
    <g pointerEvents="none">
      <path d={`M${cx - r} ${cy}A${r} ${r} 0 0 1 ${ex.toFixed(1)} ${ey.toFixed(1)}`} fill="none" stroke={color} strokeWidth={1.6} />
      <text className="plot-note" x={lx} y={ly + 4} textAnchor="middle" fill={color}>
        θ
      </text>
    </g>
  );
}

export default function SPlane() {
  const [R, setR] = useState(12);
  const [wn, setWn] = useState(10);
  const [zeta, setZeta] = useState(0.05);
  const [boxRef, width] = useWidth<HTMLDivElement>(400);

  const pole = polesOf(wn, zeta);
  const under = pole.under;
  const re = pole.under ? pole.re : pole.r1;
  const im = pole.under ? pole.im : 0;
  const decay = zeta * wn; // −Re s of the pair (for ζ < 1)

  // s-plane axes: equal scales on both axes so the circle |s| = ωn is round.
  const iw = Math.max(120, width - MARGIN_X);
  const ih = H_S - MARGIN_Y;
  const yHalf = 1.15 * R;
  const xSpan = (2 * yHalf * iw) / ih;
  const xMax = 0.3 * R;
  const xMin = xMax - xSpan;

  const circle = useMemo(() => {
    const pts: [number, number][] = [];
    for (let i = 0; i <= 120; i++) {
      const a = (i / 120) * 2 * Math.PI;
      pts.push([wn * Math.cos(a), wn * Math.sin(a)]);
    }
    const locusUp: [number, number][] = [];
    for (let i = 0; i <= 60; i++) {
      const z = i / 60;
      locusUp.push([-z * wn, wn * Math.sqrt(1 - z * z)]);
    }
    return { pts, locusUp, locusDown: locusUp.map(([x, y]) => [x, -y] as [number, number]) };
  }, [wn]);

  // ---------------------------------------------------------------- time response (release from rest, x0 = 1)
  const T = (10 * Math.PI) / wn; // five undamped periods
  const ms = T < 0.2;
  const tk = ms ? 1000 : 1;
  const resp = useMemo(() => {
    const xs = new Float64Array(N_T + 1);
    const ys = new Float64Array(N_T + 1);
    for (let i = 0; i <= N_T; i++) {
      const t = (T * i) / N_T;
      xs[i] = t * tk;
      ys[i] = freeResponse(t, 1, 0, wn, zeta);
    }
    const env: { up: [number, number][]; dn: [number, number][] } = { up: [], dn: [] };
    const slow: [number, number][] = [];
    const fast: [number, number][] = [];
    const A = zeta < 1 ? 1 / Math.sqrt(1 - zeta * zeta) : 1;
    for (let i = 0; i <= 120; i++) {
      const t = (T * i) / 120;
      if (zeta < 1) {
        const e = A * Math.exp(-zeta * wn * t);
        env.up.push([t * tk, e]);
        env.dn.push([t * tk, -e]);
      } else if (!pole.under) {
        slow.push([t * tk, Math.exp(pole.r1 * t)]);
        fast.push([t * tk, Math.exp(pole.r2 * t)]);
      }
    }
    return { xs, ys, env, slow, fast };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wn, zeta, T, tk]);

  const wrapRef = useRef<HTMLDivElement>(null);
  const traceRef = useRef<SVGPathElement>(null);
  const dotRef = useRef<SVGCircleElement>(null);
  const scales = useRef<PlotScales | null>(null);
  const clock = useRef(0);
  useRaf(
    (dt) => {
      clock.current = (clock.current + dt / SWEEP_S) % 1;
      const n = Math.max(1, Math.round(clock.current * N_T));
      const s = scales.current;
      traceRef.current?.setAttribute('d', livePathD({ x: resp.xs.subarray(0, n + 1), y: resp.ys.subarray(0, n + 1) }, s));
      if (s && dotRef.current) {
        dotRef.current.setAttribute('cx', s.sx(resp.xs[n]).toFixed(1));
        dotRef.current.setAttribute('cy', s.sy(resp.ys[n]).toFixed(1));
      }
    },
    true,
    wrapRef
  );

  // ---------------------------------------------------------------- controls
  const setRange = (r: number) => {
    setR(r);
    setWn(r * 0.8);
  };
  const fromS = (sre: number, sim: number, range: number) => {
    const w = Math.hypot(sre, sim);
    setR(range);
    setWn(w);
    setZeta(-sre / w);
  };
  const dragPole = (x: number, y: number) => {
    let w = Math.hypot(x, y);
    const lo = R / 50;
    if (w < lo) w = lo;
    if (w > R) w = R;
    const z = Math.min(1, Math.max(0, -x / Math.max(1e-12, Math.hypot(x, y))));
    setWn(w);
    setZeta(z);
  };

  const wd = under ? im : 0;
  const regime = zeta === 0 ? 'undamped' : zeta < 1 ? 'under-damped' : Math.abs(zeta - 1) < 1e-9 ? 'critically damped' : 'over-damped';
  const sText = pole.under
    ? `${fmt(pole.re, 4)} ± ${fmt(pole.im, 5)}i`
    : Math.abs(pole.r1 - pole.r2) < 1e-9 * wn
      ? `${fmt(pole.r1, 4)} (double)`
      : `${fmt(pole.r1, 4)} and ${fmt(pole.r2, 4)}`;

  const reading = pole.under
    ? zeta === 0
      ? `$s = \\pm ${tex(wn, 4)}i$: on the imaginary axis, so $\\zeta = 0$ and the oscillation never decays; $\\omega_n = \\omega_d = ${tex(wn, 4)}$ rad/s.`
      : [
          `$|s| = \\sqrt{${tex(decay, 4)}^2 + ${tex(im, 5)}^2} = ${tex(wn, 4)}$ rad/s $= \\omega_n$`,
          `$\\zeta = -\\mathrm{Re}\\,s/|s| = ${tex(decay, 4)}/${tex(wn, 4)} = ${tex(zeta, 4)}$ $(= \\cos\\theta)$`,
          `$\\omega_d = \\mathrm{Im}\\,s = ${tex(im, 5)}$ rad/s $(f_d = ${tex(im / (2 * Math.PI), 4)}$ Hz$)$`,
          `envelope $e^{-${tex(decay, 3)}t}$: time constant $1/\\zeta\\omega_n = ${tex(1 / decay, 3)}$ s, 1 % after $${tex(LN100 / decay, 3)}$ s`,
        ].join('\n\n')
    : [
        `two real roots: $s_1 = ${tex(pole.r1, 4)}$, $s_2 = ${tex(pole.r2, 4)}$ s⁻¹ (no $\\omega_d$: it does not oscillate)`,
        `$\\omega_n = \\sqrt{s_1s_2} = ${tex(wn, 4)}$ rad/s, $\\zeta = -(s_1+s_2)/2\\omega_n = ${tex(zeta, 4)}$`,
        `the slow root $s_1$ (nearest the origin) sets how long it takes: $e^{${tex(pole.r1, 3)}t}$`,
      ].join('\n\n');

  return (
    <div ref={wrapRef}>
      <SimLayout
        visual={
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.45fr) minmax(0, 1fr)', gap: 12, alignItems: 'start' }}>
              <div ref={boxRef}>
                <Plot
                  x={{ min: xMin, max: xMax, label: 'Re s (s⁻¹)' }}
                  y={{ min: -yHalf, max: yHalf, label: 'Im s (rad/s)' }}
                  height={H_S}
                  ariaLabel="The s-plane: the eigenvalue pair of one mode, the circle of radius omega n and the path the eigenvalues follow as the damping ratio grows"
                >
                  <VLine x={0} dash={false} color="var(--text-2)" width={1.2} />
                  <Line points={circle.pts} color="var(--text-3)" width={1.3} dash="5 4" />
                  <Line points={circle.locusUp} color="var(--m1)" width={5} opacity={0.16} />
                  <Line points={circle.locusDown} color="var(--m1)" width={5} opacity={0.16} />
                  <Line points={[[-wn * (2 - Math.sqrt(3)), 0], [-wn * (2 + Math.sqrt(3)), 0]]} color="var(--m1)" width={5} opacity={0.16} />
                  {under && zeta > 0 && (
                    <>
                      <Line points={[[0, 0], [re, im]]} color="var(--text-2)" width={1.2} />
                      <Line points={[[re, im], [0, im]]} color="var(--m1)" width={1.3} dash="4 3" />
                      <Line points={[[re, im], [re, 0]]} color="var(--m1)" width={1.3} dash="4 3" />
                      <AngleArc re={re} im={im} color="var(--text-2)" />
                      <PlotText x={0} y={im} dx={14} dy={4} color="var(--m1)">
                        ωd
                      </PlotText>
                      <PlotText x={re} y={0} anchor="middle" dy={15} color="var(--m1)">
                        −ζωₙ
                      </PlotText>
                    </>
                  )}
                  {under ? (
                    <>
                      <Cross x={re} y={im} color="var(--m1)" />
                      <Cross x={re} y={-im} color="var(--m1)" />
                      <Handle
                        x={re}
                        y={im}
                        onChange={dragPole}
                        clampX={[xMin, 0]}
                        clampY={[0.002 * R, yHalf]}
                        color="var(--accent)"
                        r={10}
                        ariaLabel="Eigenvalue s: drag to change the decay rate (left/right) and the damped frequency (up/down)"
                      />
                    </>
                  ) : (
                    <>
                      <Cross x={pole.r1} y={0} color="var(--m1)" />
                      <Cross x={pole.r2} y={0} color="var(--m1)" />
                      <PlotText x={pole.r1} y={0} anchor="middle" dy={-12} color="var(--m1)">
                        slow
                      </PlotText>
                      {pole.r2 >= xMin ? (
                        <PlotText x={pole.r2} y={0} anchor="middle" dy={-12} color="var(--m1)">
                          fast
                        </PlotText>
                      ) : (
                        <PlotText x={xMin} y={0} dx={4} dy={-10} color="var(--m1)">
                          {`← fast root ${fmt(pole.r2, 3)}`}
                        </PlotText>
                      )}
                    </>
                  )}
                </Plot>
              </div>
              <div className="stack" style={{ paddingTop: 6 }}>
                <div className="mono small" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 9px' }}>
                  {`s = ${sText}`}
                </div>
                <Rich className="small" text={reading} />
                <Legend
                  items={[
                    { label: '× eigenvalues of the mode', color: 'var(--m1)' },
                    { label: 'circle |s| = ωₙ', color: 'var(--text-3)', dash: true },
                    { label: 'path as ζ goes 0 → 2', color: 'color-mix(in srgb, var(--m1) 30%, transparent)' },
                  ]}
                />
              </div>
            </div>
            <Plot
              x={{ min: 0, max: T * tk, label: `time t (${ms ? 'ms' : 's'})` }}
              y={{ min: -1.3, max: 1.3, ticks: [-1, 0, 1], label: 'x / x₀' }}
              height={185}
              ariaLabel="Free response after release from rest, with the decay envelope set by the real part of s"
            >
              <HLine y={0} dash={false} />
              {zeta < 1 && zeta > 0 && (
                <>
                  <Line points={resp.env.up} color="var(--text-3)" width={1.4} dash="5 4" />
                  <Line points={resp.env.dn} color="var(--text-3)" width={1.4} dash="5 4" />
                </>
              )}
              {zeta >= 1 && (
                <>
                  <Line points={resp.slow} color="var(--m1)" width={1.3} dash="2 3" />
                  <Line points={resp.fast} color="var(--m1)" width={1.3} dash="6 3" />
                </>
              )}
              <Line points={{ x: resp.xs, y: resp.ys }} color="var(--m1)" width={1.4} opacity={0.3} />
              <LivePath pathRef={traceRef} scalesRef={scales} color="var(--m1)" width={2.4} />
              <circle ref={dotRef} r={5} fill="var(--m1)" cx={-20} cy={-20} />
            </Plot>
            <Legend
              items={
                zeta < 1
                  ? [
                      { label: 'x(t), released from rest', color: 'var(--m1)' },
                      { label: 'envelope ∝ e^(Re s · t) = e^(−ζωₙt)', color: 'var(--text-3)', dash: true },
                    ]
                  : [
                      { label: 'x(t), released from rest', color: 'var(--m1)' },
                      { label: 'e^(s₁t) slow and e^(s₂t) fast', color: 'var(--m1)', dash: true },
                    ]
              }
            />
            <p className="muted small">Drag the ring on the upper eigenvalue. The time axis always shows five undamped periods (2π/ωₙ each), so changing ζ alone never rescales it.</p>
          </>
        }
        controls={
          <>
            <div className="row gap-s wrap">
              <span className="muted small">Axis range:</span>
              <Segmented size="sm" label="Axis range" value={R} onChange={setRange} options={RANGES.map((r) => ({ value: r, label: `±${r}` }))} />
            </div>
            <Slider label="natural freq." tex="\omega_n" tip="undamped natural frequency = |s| (rad/s)" value={wn} min={R / 50} max={R} log unit="rad/s" sig={4} onChange={setWn} />
            <Slider label="damping ratio" tex="\zeta" tip="damping ratio = −Re s/|s| (dimensionless)" value={zeta} min={0} max={2} step={0.0005} sig={3} onChange={setZeta} />
            <Readouts>
              <Readout tex="\mathrm{Re}\,s" tip="real part of the eigenvalue = −ζωn: the envelope's decay rate (1/s)" value={re} unit="s⁻¹" tone="m1" />
              <Readout tex="\mathrm{Im}\,s" tip="imaginary part = damped natural frequency ωd (rad/s)" value={im} unit="rad/s" tone="m1" />
              <Readout tex="|s|" tip="distance from the origin = undamped natural frequency ωn (rad/s)" value={wn} unit="rad/s" />
              <Readout tex="\zeta" tip="damping ratio −Re s/|s| = cos θ" value={zeta} sig={3} />
              <Readout tex="f_d" tip="damped natural frequency in Hz = ωd/2π" value={wd / (2 * Math.PI)} unit="Hz" text={under ? undefined : 'none'} />
              <Readout tex="t_{1\%}" tip="time for the envelope to fall to 1 % = ln100/(ζωn) (s)" value={under ? (zeta > 0 ? LN100 / decay : Infinity) : LN100 / -pole.r1} unit="s" sig={3} />
            </Readouts>
            <div className="row gap-s wrap">
              <Badge tone={zeta < 1 ? 'm1' : Math.abs(zeta - 1) < 1e-9 ? 'ok' : 'warn'}>{regime}</Badge>
              {zeta > 0 && zeta < 1 && <Badge tone="muted">{`ωd/ωn = ${fmt(Math.sqrt(1 - zeta * zeta), 4)}`}</Badge>}
            </div>
            <div className="row gap-s wrap">
              <span className="muted small">Eigenvalues from the papers:</span>
              <Button size="sm" onClick={() => fromS(-12.1, 1647.3, 2000)}>
                −12.1 ± 1647.3i
              </Button>
              <Button size="sm" onClick={() => fromS(-321, 5825.0, 8000)}>
                −321 ± 5825.0i
              </Button>
              <Button size="sm" onClick={() => fromS(-0.038, 11.3775, 12)}>
                −0.0380 ± 11.3775i
              </Button>
              <Button size="sm" onClick={() => fromS(-3, 4, 12)}>
                −3 ± 4i
              </Button>
            </div>
            <div className="row gap-s wrap">
              <span className="muted small">Set ζ:</span>
              <Segmented
                size="sm"
                label="Damping presets"
                value={-1}
                onChange={(z: number) => setZeta(z)}
                options={[
                  { value: 0, label: '0' },
                  { value: 0.05, label: '0.05' },
                  { value: 0.5, label: '0.5' },
                  { value: 1, label: '1' },
                  { value: 2, label: '2' },
                ]}
              />
            </div>
            <Rich className="note" text="The first two are official 2019 Q1e (a wheel–rail model, mode 1 and mode 2); the third is mode 1 of 2023 A1.1. Light damping keeps the poles hugging the imaginary axis." />
          </>
        }
      />
      <PredictReveal
        id="a6-splane-circle"
        question="Keep $\omega_n$ = 10 rad/s and raise $\zeta$ from 0.05 to 0.5. How does the upper eigenvalue move?"
        options={['Straight left: Im s (= ωd) stays the same', 'Straight down: Re s (the decay rate) stays the same', 'Round the circle |s| = ωₙ: further left and lower']}
        answer={2}
        explain="$|s|^2 = (\zeta\omega_n)^2 + \omega_n^2(1-\zeta^2) = \omega_n^2$, so at fixed $\omega_n$ the pole stays on the circle. $-\mathrm{Re}\,s = \zeta\omega_n$ grows from 0.5 to 5 s⁻¹ (faster decay) while $\omega_d = \omega_n\sqrt{1-\zeta^2}$ falls from 9.987 to 8.660 rad/s. The angle from the negative real axis is $\theta = \arccos\zeta$."
        tryIt="set ωn = 10 rad/s (±12 range), then move the ζ slider from 0.05 to 0.5 and watch the cross."
        onApply={() => {
          setR(12);
          setWn(10);
          setZeta(0.5);
        }}
      />
      <PredictReveal
        id="a6-splane-critical"
        question="Keep raising $\zeta$. Where are the two eigenvalues at $\zeta = 1$, and what happens beyond it?"
        options={['They meet at −ωₙ on the real axis, then split along it: one slow root, one fast root', 'They meet at the origin and stop moving', 'They leave the circle and move up the imaginary axis']}
        answer={0}
        explain="At $\zeta = 1$ the pair becomes a double root $s = -\omega_n$ (critical damping). Beyond it the roots are real, $-\omega_n(\zeta \mp \sqrt{\zeta^2-1})$: at $\zeta = 2$ they sit at $-0.268\,\omega_n$ and $-3.73\,\omega_n$. The slow root, nearest the origin, controls the response, which is why an over-damped system creeps back. In a MATLAB $D$ an over-damped mode appears as two real negative numbers (official 2018 A1.6(b))."
        tryIt="press ζ = 1, then ζ = 2, and watch the crosses and the dashed decay curves."
        onApply={() => setZeta(2)}
      />
      <PredictReveal
        id="a6-splane-vertical"
        question="With $\zeta = 0.05$, $\omega_n$ = 10 rad/s, drag the pole **straight up** to twice the height (Re s unchanged). What happens to the time the envelope takes to decay to 1 %?"
        options={['It halves', 'It stays the same', 'It doubles']}
        answer={1}
        explain="The envelope is $e^{\mathrm{Re}(s)t}$, so its decay time depends on Re s only: $\ln 100/0.5 = 9.2$ s either way. Moving up raises $\omega_d$ to 19.97 rad/s and $\omega_n$ to 19.98 rad/s, so $\zeta = 0.5/19.98$ halves to 0.025: twice as many cycles fit in the same decay. A smaller $\zeta$ does not always mean a slower decay in seconds."
        tryIt="press ζ = 0.05 at ωn = 10, note t₁%, then drag the ring straight up to Im s ≈ 20."
        onApply={() => fromS(-0.5, 2 * 9.987492, 25)}
      />
    </div>
  );
}
