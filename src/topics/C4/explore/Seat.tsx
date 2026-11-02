// Seat suspension with end-stops on a vibrating cab floor (2023 A3.4 haul-truck seat). A soft spring–damper
// SDOF seat driven by floor motion y = Y sin Ωt, integrated in the relative coordinate z = x − y with fixed-step
// RK4 (0.5 ms). When |z| exceeds the free travel the seat meets a much stiffer end-stop: the relative
// velocity is destroyed in a short time and the seat acceleration shows a spike (F Δt ≈ m Δv).
import { useMemo, useRef, useState } from 'react';
import { rk4Step } from '../../../physics/ode';
import { relativeMotionRatio, transmissibility } from '../../../physics/sdof';
import { TWO_PI } from '../../../physics/units';
import { useRaf } from '../../../anim/hooks';
import { HLine, LivePath, livePathD, Plot, type PlotScales } from '../../../plot/Plot';
import { Badge, Button, Legend, Readout, SimLayout, Slider, Sym, Toggle } from '../../../ui/kit';
import { PredictReveal } from '../../../ui/PredictReveal';
import { damperPaths, springPath } from '../../../ui/diagrams';
import { fmtSig } from '../../../engine/format';
import { seatAccel, seatDerivPhase, type SeatParams } from '../physics';

const H = 1 / 2000; // s, integration step
const EVERY = 10; // record every 10 steps (200 samples/s)
const WIN = 3; // s shown
const NBUF = Math.round(WIN / (H * EVERY)) + 2;
// Drawing geometry (viewBox 250 × 330): floor top at FLOOR_Y, seat underside at SEAT_Y, the seat bracket
// (and the end-stops, which move with the floor) centred at BRACKET_Y. Displacements are drawn at one scale,
// chosen so the floor moves at most ±24 px, the relative travel at most ±44 px and the stops sit within 70 px
// of the bracket, so nothing leaves the box or crosses the floor.
const FLOOR_Y = 266;
const SEAT_Y = 192;
const BRACKET_Y = 176;
const pxPerMetre = (Y: number, zEstMm: number, gapMm: number) =>
  Math.min(600, 24 / Math.max(Y, 1e-6), 44000 / Math.max(zEstMm, 1e-3), 70000 / Math.max(gapMm, 1e-3));

interface Ctl {
  f: number; // floor frequency, Hz
  A: number; // floor acceleration amplitude, m/s²
  fn: number;
  zeta: number;
  gap: number; // mm
  ratio: number;
}
const DEFAULT: Ctl = { f: 1.5, A: 6.5, fn: 1.5, zeta: 0.4, gap: 50, ratio: 10 };

const toParams = (c: Ctl): SeatParams => {
  const W = TWO_PI * c.f;
  return { fn: c.fn, zeta: c.zeta, Y: c.A / (W * W), f: c.f, gap: c.gap / 1000, stopRatio: c.ratio };
};

export default function Seat() {
  const [c, setC] = useState<Ctl>(DEFAULT);
  const [slow, setSlow] = useState(false);
  const [paused, setPaused] = useState(false);
  const set = (k: keyof Ctl) => (v: number) => setC((o) => ({ ...o, [k]: v }));

  const p = useMemo(() => toParams(c), [c]);
  const r = c.f / c.fn;
  const Ymm = p.Y * 1000;
  const Zlin = Ymm * relativeMotionRatio(r, c.zeta);
  const aLin = c.A * transmissibility(r, c.zeta);
  const bottoms = Zlin > c.gap;
  const zTop = Math.min(220, Math.max(1.35 * c.gap, 1.1 * Zlin, 20));
  const aTop = c.ratio > 30 || c.A > 8 ? 80 : 40; // m/s², acceleration axis (stiff stops spike higher)
  const zStep = zTop > 120 ? 100 : zTop > 60 ? 50 : zTop > 30 ? 20 : 10;
  const zTicks = [-2, -1, 0, 1, 2].map((k) => k * zStep).filter((v) => Math.abs(v) <= zTop);
  const PX = pxPerMetre(p.Y, Math.min(Zlin, 1.3 * c.gap), c.gap); // drawing scale, px per metre

  // ---------------------------------------------------------------- simulation state (refs only)
  const pRef = useRef(p);
  pRef.current = p;
  const pxRef = useRef(PX);
  pxRef.current = PX;
  const deriv = useMemo(() => seatDerivPhase(() => pRef.current), []);
  const sim = useRef({ s: [0, 0, 0] as number[], acc: 0, n: 0, head: 0, count: 0, t: 0, lastUi: 0 });
  const buf = useRef({ t: new Float64Array(NBUF), af: new Float64Array(NBUF), as: new Float64Array(NBUF), z: new Float64Array(NBUF) });
  const view = useRef({ x: new Float64Array(NBUF), y1: new Float64Array(NBUF), y2: new Float64Array(NBUF), y3: new Float64Array(NBUF) });
  const aScales = useRef<PlotScales | null>(null);
  const zScales = useRef<PlotScales | null>(null);
  const floorPath = useRef<SVGPathElement>(null);
  const seatPath = useRef<SVGPathElement>(null);
  const zPath = useRef<SVGPathElement>(null);
  const floorG = useRef<SVGGElement>(null);
  const seatG = useRef<SVGGElement>(null);
  const spring = useRef<SVGPathElement>(null);
  const dCyl = useRef<SVGPathElement>(null);
  const dRod = useRef<SVGPathElement>(null);
  const bumpUp = useRef<SVGRectElement>(null);
  const bumpDn = useRef<SVGRectElement>(null);
  const peakTxt = useRef<HTMLSpanElement>(null);
  const travelTxt = useRef<HTMLSpanElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const reset = () => {
    sim.current = { s: [0, 0, 0], acc: 0, n: 0, head: 0, count: 0, t: 0, lastUi: 0 };
  };

  useRaf(
    (dt) => {
      const S = sim.current;
      const B = buf.current;
      const P = pRef.current;
      if (!paused) {
        S.acc += Math.min(dt, 0.05) * (slow ? 0.25 : 1);
        let steps = 0;
        while (S.acc >= H && steps < 400) {
          S.s = rk4Step(deriv, S.t, S.s, H);
          S.t += H;
          S.acc -= H;
          steps++;
          if (++S.n % EVERY === 0) {
            const i = S.head;
            B.t[i] = S.t;
            B.af[i] = -TWO_PI * TWO_PI * P.f * P.f * P.Y * Math.sin(S.s[2]);
            B.as[i] = seatAccel(S.s, P);
            B.z[i] = S.s[0] * 1000;
            S.head = (i + 1) % NBUF;
            S.count = Math.min(NBUF, S.count + 1);
          }
        }
      }
      // drawing: floor y and seat x = y + z
      const px = pxRef.current;
      const y = P.Y * Math.sin(S.s[2]);
      const z = S.s[0];
      const fy = -y * px;
      const sy = -(y + z) * px;
      floorG.current?.setAttribute('transform', `translate(0 ${fy.toFixed(1)})`);
      seatG.current?.setAttribute('transform', `translate(0 ${sy.toFixed(1)})`);
      spring.current?.setAttribute('d', springPath(100, FLOOR_Y + fy, 100, SEAT_Y + sy, 6, 8));
      const dp = damperPaths(140, FLOOR_Y + fy, 140, SEAT_Y + sy);
      dCyl.current?.setAttribute('d', dp.cyl);
      dRod.current?.setAttribute('d', dp.rod);
      const hit = Math.abs(z) > P.gap;
      bumpUp.current?.setAttribute('fill', hit && z > 0 ? 'var(--bad)' : 'var(--surface-3)');
      bumpDn.current?.setAttribute('fill', hit && z < 0 ? 'var(--bad)' : 'var(--surface-3)');
      // traces: ordered copy of the ring buffer, time relative to now
      const V = view.current;
      const n = S.count;
      const start = (S.head - n + NBUF) % NBUF;
      let pk = 0;
      let zt = 0;
      for (let k = 0; k < n; k++) {
        const i = (start + k) % NBUF;
        V.x[k] = B.t[i] - S.t;
        V.y1[k] = B.af[i];
        V.y2[k] = B.as[i];
        V.y3[k] = B.z[i];
        if (V.x[k] > -2) {
          pk = Math.max(pk, Math.abs(B.as[i]));
          zt = Math.max(zt, Math.abs(B.z[i]));
        }
      }
      const sub = { x: V.x.subarray(0, n), y: V.y1.subarray(0, n) };
      floorPath.current?.setAttribute('d', livePathD(sub, aScales.current));
      seatPath.current?.setAttribute('d', livePathD({ x: sub.x, y: V.y2.subarray(0, n) }, aScales.current));
      zPath.current?.setAttribute('d', livePathD({ x: sub.x, y: V.y3.subarray(0, n) }, zScales.current));
      if (S.t - S.lastUi > 0.25) {
        S.lastUi = S.t;
        if (peakTxt.current) peakTxt.current.textContent = fmtSig(pk, 3);
        if (travelTxt.current) travelTxt.current.textContent = fmtSig(zt, 3);
      }
    },
    true,
    wrapRef
  );

  const g = c.gap * (PX / 1000); // gap in px
  return (
    <div ref={wrapRef}>
      <SimLayout
        visual={
          <>
            <div className="row gap-s" style={{ alignItems: 'flex-start' }}>
              <svg viewBox="0 0 250 330" className="anim" style={{ maxWidth: 230, flex: '0 0 auto' }} role="img" aria-label="Seat on a spring and damper above a moving cab floor, with end-stops limiting its travel">
                <g ref={floorG}>
                  <rect x={30} y={FLOOR_Y} width={190} height={12} rx={3} fill="var(--surface-3)" stroke="var(--m2)" strokeWidth={2} />
                  <line x1={212} y1={FLOOR_Y} x2={212} y2={76} stroke="var(--text-3)" strokeWidth={3} />
                  <rect ref={bumpUp} x={198} y={BRACKET_Y - g - 4 - 14} width={24} height={14} rx={3} fill="var(--surface-3)" stroke="var(--text-2)" strokeWidth={1.2} />
                  <rect ref={bumpDn} x={198} y={BRACKET_Y + g + 4} width={24} height={14} rx={3} fill="var(--surface-3)" stroke="var(--text-2)" strokeWidth={1.2} />
                </g>
                <path ref={spring} d={springPath(100, FLOOR_Y, 100, SEAT_Y, 6, 8)} fill="none" stroke="var(--text-2)" strokeWidth={1.8} />
                <g fill="none" stroke="var(--text-2)" strokeWidth={1.8}>
                  <path ref={dCyl} d={damperPaths(140, FLOOR_Y, 140, SEAT_Y).cyl} />
                  <path ref={dRod} d={damperPaths(140, FLOOR_Y, 140, SEAT_Y).rod} />
                </g>
                <g ref={seatG}>
                  <rect x={66} y={SEAT_Y - 40} width={110} height={40} rx={6} fill="var(--surface-2)" stroke="var(--m1)" strokeWidth={2} />
                  <rect x={66} y={SEAT_Y - 102} width={16} height={64} rx={4} fill="var(--surface-2)" stroke="var(--m1)" strokeWidth={2} />
                  <rect x={176} y={BRACKET_Y - 4} width={34} height={8} rx={2} fill="var(--m1)" />
                  <text x={124} y={BRACKET_Y + 1} textAnchor="middle" className="diagram-label">
                    seat + driver
                  </text>
                </g>
                <text x={125} y={318} textAnchor="middle" className="plot-note">
                  cab floor y = Y sin Ωt (motion to scale)
                </text>
              </svg>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Plot x={{ min: -WIN, max: 0, label: 'time (s, now = 0)' }} y={{ min: -aTop, max: aTop, label: 'acceleration (m/s²)', ticks: [-aTop, -aTop / 2, 0, aTop / 2, aTop] }} height={200} ariaLabel="Floor and seat acceleration over the last three seconds">
                  <LivePath pathRef={floorPath} scalesRef={aScales} color="var(--text-3)" width={1.5} dash="5 3" />
                  <LivePath pathRef={seatPath} scalesRef={aScales} color="var(--m1)" width={2} />
                </Plot>
                <Legend
                  items={[
                    { label: 'cab floor', color: 'var(--text-3)', dash: true },
                    { label: 'seat', color: 'var(--m1)' },
                  ]}
                />
                <Plot x={{ min: -WIN, max: 0, label: 'time (s, now = 0)' }} y={{ min: -zTop, max: zTop, label: 'travel z = x − y (mm)', ticks: zTicks }} height={170} ariaLabel="Relative travel of the seat with the end-stop limits">
                  <HLine y={c.gap} color="var(--bad)" />
                  <HLine y={-c.gap} color="var(--bad)" />
                  <LivePath pathRef={zPath} scalesRef={zScales} color="var(--m1)" width={2} />
                </Plot>
                <Legend
                  items={[
                    { label: 'seat travel relative to the floor', color: 'var(--m1)' },
                    { label: `end-stops at ±${c.gap} mm`, color: 'var(--bad)', dash: true },
                  ]}
                />
              </div>
            </div>
          </>
        }
        controls={
          <>
            <Slider label="floor frequency" tex="f" tip="cab-floor vibration frequency" value={c.f} min={0.5} max={4} step={0.05} unit="Hz" onChange={set('f')} />
            <Slider label="floor acceleration" tex="A" tip="amplitude of the floor acceleration; Y = A/Ω²" value={c.A} min={1} max={10} step={0.1} unit="m/s²" onChange={set('A')} />
            <Slider label="seat natural frequency" tex="f_n" tip="seat suspension natural frequency √(k/m)/2π" value={c.fn} min={0.6} max={3} step={0.05} unit="Hz" onChange={set('fn')} />
            <Slider label="seat damping ratio" tex="\zeta" tip="c/(2√(km))" value={c.zeta} min={0.05} max={0.8} step={0.01} onChange={set('zeta')} />
            <Slider label="free travel to the stops" tex="g" tip="travel either side of equilibrium before the end-stop" value={c.gap} min={10} max={200} step={1} unit="mm" sig={3} onChange={set('gap')} />
            <Slider label="end-stop stiffness" tex="k_s/k" tip="end-stop stiffness as a multiple of the seat spring" value={c.ratio} min={2} max={100} log sig={2} unit="× k" onChange={set('ratio')} />
            <div className="row gap-s wrap">
              <Toggle checked={slow} onChange={setSlow} label="slow motion (¼ speed)" />
              <Button size="sm" onClick={() => setPaused((v) => !v)}>
                {paused ? 'Resume' : 'Pause'}
              </Button>
              <Button size="sm" onClick={reset}>
                Restart
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setC(DEFAULT);
                  reset();
                }}
              >
                2023 A3.4 set-up
              </Button>
            </div>
            <div className="readouts">
              <Readout tex="r" tip="floor frequency / seat natural frequency" value={r} sig={3} tone={r > Math.SQRT2 ? 'ok' : 'bad'} />
              <Readout tex="Y" tip="floor displacement amplitude A/Ω²" value={Ymm} unit="mm" sig={3} />
              <Readout tex="Z_{lin}" tip="relative travel without stops, Y·r²/√((1−r²)² + (2ζr)²)" value={Zlin} unit="mm" sig={3} tone={bottoms ? 'bad' : 'ok'} />
              <Readout tex="a_{lin}" tip="seat acceleration without stops, T·A" value={aLin} unit="m/s²" sig={3} />

              <div className="readout tone-m1">
                <div className="readout-label">
                  <Sym tex="\hat a_{seat}" tip="largest seat acceleration in the last 2 s (simulated, with the stops)" />
                </div>
                <div className="readout-value">
                  <span ref={peakTxt}>—</span>
                  <span className="readout-unit"> m/s²</span>
                </div>
              </div>
              <div className="readout">
                <div className="readout-label">
                  <Sym tex="\hat z" tip="largest relative travel in the last 2 s (simulated)" />
                </div>
                <div className="readout-value">
                  <span ref={travelTxt}>—</span>
                  <span className="readout-unit"> mm</span>
                </div>
              </div>
            </div>
            <Badge tone={bottoms ? 'bad' : 'ok'}>{bottoms ? `bottoms out: needs ${fmtSig(Zlin, 3)} mm of travel, has ${c.gap} mm` : 'travel is enough: no end-stop contact in steady state'}</Badge>
          </>
        }
      />
      <PredictReveal
        id="c4-seat-spikes"
        question="The cab floor shakes at the seat’s own natural frequency (1.5 Hz) and the seat has ±50 mm of travel. The seat acceleration shows sharp spikes well above its smooth peaks. They come from…"
        options={['the resonance itself: a resonant response is spiky', 'the seat hitting its end-stops: its relative velocity is destroyed in a very short time', 'electrical noise in the accelerometer']}
        answer={1}
        explain="Near resonance the relative travel would be about 92 mm, more than the 50 mm available, so the seat strikes the stiff end-stop every half-cycle. The stop removes the relative velocity in about 0.1 s: $F\Delta t \approx m\Delta v$ gives a large, brief force, so the acceleration spikes to about 18 m/s² against a smooth 10 m/s² (2023 A3.4). Resonance alone gives a smooth sinusoid."
        tryIt="watch the travel trace touch the red lines exactly when the spikes appear (slow motion helps)."
        onApply={() => {
          setC(DEFAULT);
          setSlow(true);
        }}
      />
      <PredictReveal
        id="c4-seat-stiff-stop"
        question="Make the end-stop five times stiffer (10 k → 50 k). The spikes become…"
        options={['lower and longer', 'higher and shorter', 'unchanged']}
        answer={1}
        explain="A stiffer stop stops the same relative velocity in a shorter time, so the force (and acceleration) peak is higher: about 33 m/s² instead of 18 m/s², with contact lasting about 50 ms instead of 100 ms. Soft, progressive bump-stops are kinder to the driver."
        tryIt="raise the end-stop stiffness to 50 × k."
        onApply={() => setC({ ...DEFAULT, ratio: 50 })}
      />
      <PredictReveal
        id="c4-seat-softer"
        question="Soften the seat to $f_n$ = 0.8 Hz, so that the 1.5 Hz floor is now above $\sqrt2 f_n$ (isolation). Does the seat still bottom out?"
        options={['No: it isolates now, so the travel shrinks and the spikes vanish', 'Yes: above resonance the relative travel approaches the floor’s own amplitude (73 mm), more than the 50 mm available', 'Only while starting']}
        answer={1}
        explain="Without stops the seat would now transmit only 4 m/s² (isolation, $r$ = 1.9), but its relative travel is $Z = Y r^2/\sqrt{(1-r^2)^2 + (2\zeta r)^2}$ = 88 mm, even more than the floor’s own $Y$ = 73 mm. Isolation means the seat moves less than the floor, so the floor moves up and down under it: far above resonance $Z$ tends to the full $Y$. A soft seat needs **rattle space** (or a smaller floor input); otherwise it bottoms out and the spikes return."
        tryIt="set the seat natural frequency to 0.8 Hz."
        onApply={() => setC({ ...DEFAULT, fn: 0.8 })}
      />
    </div>
  );
}
