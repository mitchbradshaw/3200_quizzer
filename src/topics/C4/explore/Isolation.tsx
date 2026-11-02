// Isolation designer: a 500 kg compressor with a rotating unbalance stands on mounts chosen by their static
// sag and damping. Two curves over the whole run-up (0 → running speed): the force reaching the floor,
// me Ω² T(r, ζ), and the machine's own excursion, (me/M) r²/√((1−r²)² + (2ζr)²). The design trade-off:
// soft, lightly damped mounts isolate at speed, but the run-up passes the mount resonance, where only
// damping limits the excursion. The run-up animation is quasi-steady (slow sweep) and slowed for display.
import { useMemo, useRef, useState } from 'react';
import { transmissibility } from '../../../physics/sdof';
import { G, TWO_PI } from '../../../physics/units';
import { useRaf } from '../../../anim/hooks';
import { Band, HLine, Line, Plot, VLine, sample, usePlot, type PlotScales } from '../../../plot/Plot';
import { Badge, Button, Callout, Legend, Readout, Readouts, SimLayout, Slider, Sym } from '../../../ui/kit';
import { PredictReveal } from '../../../ui/PredictReveal';
import { Ground, damperPaths, springPath } from '../../../ui/diagrams';
import { completeChallenge, useProgress } from '../../../app/store';
import { Rich } from '../../../ui/Rich';
import { fmt, fmtSig } from '../../../engine/format';
import { peakExcursion, sagToFn, startUpPeak, unbalanceAmplitude } from '../physics';

export const ISO_CHALLENGE = 'c4-isolation-design';

const M = 500; // kg, machine mass
const ME = 0.05; // kg m, unbalance (0.25 kg at 200 mm)
const CH = { N: 1500, T: 0.02, X: 2, sag: 25 }; // challenge: rpm, max T at speed, max excursion (mm), max sag (mm)
const RUN_S = 7; // seconds for the animated run-up

/** Mount family from its static sag (LA7-2 typical values). */
function mountType(sagMm: number): string {
  if (sagMm < 1) return 'very stiff pads (barely a mount)';
  if (sagMm <= 6) return 'rubber pads (sag ≤ 6 mm)';
  if (sagMm < 25) return 'thick rubber or stiff springs';
  if (sagMm <= 125) return 'steel coil springs (25–125 mm)';
  return 'air springs (about 200 mm)';
}

/** Captures a Plot's scales so the animation can place markers without re-rendering. */
function Grab({ into }: { into: { current: PlotScales | null } }) {
  const c = usePlot();
  into.current = { sx: c.sx, sy: c.sy, clip: c.clip, yLog: c.yAxis.log };
  return null;
}

/** Largest excursion (m per unit me/M) met while running up to r_run. */
function runUpExcursion(rRun: number, zeta: number): number {
  const rp = zeta < Math.SQRT1_2 ? 1 / Math.sqrt(1 - 2 * zeta * zeta) : Infinity;
  return rRun >= rp ? peakExcursion(zeta) : unbalanceAmplitude(rRun, zeta);
}

export default function Isolation() {
  const progress = useProgress();
  const [N, setN] = useState(1500); // rpm
  const [sag, setSag] = useState(10); // mm
  const [zeta, setZeta] = useState(0.1);

  const W = (TWO_PI * N) / 60;
  const fn = sagToFn(sag / 1000);
  const wn = TWO_PI * fn;
  const r = W / wn;
  const k = (M * G) / (sag / 1000);
  const T = transmissibility(r, zeta);
  const F0 = ME * W * W;
  const FT = F0 * T;
  const up = startUpPeak(r, zeta);
  const Fpeak = up.ratio * F0;
  const nPeak = up.s * N;
  const Xpeak = 1000 * (ME / M) * runUpExcursion(r, zeta);
  const Xrun = 1000 * (ME / M) * unbalanceAmplitude(r, zeta);
  const nMax = Math.round(N * 1.15);

  const forceAt = (n: number) => {
    const w = (TWO_PI * n) / 60;
    return ME * w * w * transmissibility(w / wn, zeta);
  };
  const excAt = (n: number) => 1000 * (ME / M) * unbalanceAmplitude((TWO_PI * n) / 60 / wn, zeta);
  const force = useMemo(() => sample(forceAt, 10, nMax, 700), [nMax, wn, zeta]); // eslint-disable-line react-hooks/exhaustive-deps
  const rigid = useMemo(() => sample((n) => ME * ((TWO_PI * n) / 60) ** 2, 10, nMax, 200), [nMax]);
  const exc = useMemo(() => sample(excAt, 0, nMax, 700), [nMax, wn, zeta]); // eslint-disable-line react-hooks/exhaustive-deps
  const fTop = Math.pow(10, Math.ceil(Math.log10(Math.max(Fpeak, ME * ((TWO_PI * nMax) / 60) ** 2) * 1.3)));
  const xTop = Math.max(2.5, Math.ceil(Math.min(Xpeak, 60) * 1.15));

  // challenge
  const done = !!progress.challenges[ISO_CHALLENGE];
  const okN = N === CH.N;
  const okT = T <= CH.T;
  const okX = Xpeak <= CH.X;
  const okSag = sag <= CH.sag;
  const solved = okN && okT && okX && okSag;

  // ---------------------------------------------------------------- run-up animation (refs only)
  const wrapRef = useRef<HTMLDivElement>(null);
  const fScales = useRef<PlotScales | null>(null);
  const xScales = useRef<PlotScales | null>(null);
  const fDot = useRef<SVGCircleElement>(null);
  const xDot = useRef<SVGCircleElement>(null);
  const machine = useRef<SVGGElement>(null);
  const rotor = useRef<SVGLineElement>(null);
  const springL = useRef<SVGPathElement>(null);
  const springR = useRef<SVGPathElement>(null);
  const damperCyl = useRef<SVGPathElement>(null);
  const damperRod = useRef<SVGPathElement>(null);
  const bar = useRef<SVGRectElement>(null);
  const speedTxt = useRef<HTMLSpanElement>(null);
  const forceTxt = useRef<HTMLSpanElement>(null);
  const anim = useRef({ s: 1, playing: false, phase: 0, rot: 0, last: -1 });
  const live = useRef({ N, forceAt, excAt, fTop });
  live.current = { N, forceAt, excAt, fTop };

  useRaf(
    (dt) => {
      const a = anim.current;
      const L = live.current;
      if (a.playing) {
        a.s = Math.min(1, a.s + dt / RUN_S);
        if (a.s >= 1) a.playing = false;
      }
      const n = Math.max(1, a.s * L.N);
      const F = L.forceAt(n);
      const X = L.excAt(n);
      const vf = 0.5 + 2.5 * a.s; // display frequency (Hz), slowed
      a.phase += TWO_PI * vf * dt;
      a.rot += TWO_PI * vf * dt;
      const amp = Math.min(22, X * 9);
      const dy = -amp * Math.sin(a.phase);
      machine.current?.setAttribute('transform', `translate(0 ${dy.toFixed(2)})`);
      rotor.current?.setAttribute('x2', (158 + 15 * Math.cos(a.rot)).toFixed(1));
      rotor.current?.setAttribute('y2', (80 + 15 * Math.sin(a.rot)).toFixed(1));
      const top = 108 + dy;
      springL.current?.setAttribute('d', springPath(78, 150, 78, top, 5, 7));
      springR.current?.setAttribute('d', springPath(162, 150, 162, top, 5, 7));
      const dp = damperPaths(120, 150, 120, top);
      damperCyl.current?.setAttribute('d', dp.cyl);
      damperRod.current?.setAttribute('d', dp.rod);
      const hb = Math.max(0, Math.min(1, Math.log10(Math.max(F, 1)) / Math.log10(L.fTop))) * 120;
      bar.current?.setAttribute('y', (150 - hb).toFixed(1));
      bar.current?.setAttribute('height', hb.toFixed(1));
      const fs = fScales.current;
      const xs = xScales.current;
      if (fs && fDot.current) {
        fDot.current.setAttribute('cx', fs.sx(n).toFixed(1));
        fDot.current.setAttribute('cy', fs.sy(Math.max(F, 1)).toFixed(1));
      }
      if (xs && xDot.current) {
        xDot.current.setAttribute('cx', xs.sx(n).toFixed(1));
        xDot.current.setAttribute('cy', xs.sy(X).toFixed(1));
      }
      const tick = Math.round(a.s * 40);
      if (tick !== a.last) {
        a.last = tick;
        if (speedTxt.current) speedTxt.current.textContent = fmtSig(n, 4);
        if (forceTxt.current) forceTxt.current.textContent = fmtSig(F, 3);
      }
    },
    true,
    wrapRef
  );
  const runUp = () => {
    anim.current.s = 0;
    anim.current.playing = true;
    anim.current.last = -1;
  };

  const preset = (s: number, z: number, n = N) => {
    setSag(s);
    setZeta(z);
    setN(n);
    anim.current.s = 1;
  };

  return (
    <div ref={wrapRef}>
      <Callout kind="info" title="Challenge: mount the compressor">
        <Rich
          text={`A ${M} kg compressor with an unbalance $me$ = ${ME} kg m runs at ${CH.N} rpm. Choose the mounts (static sag and damping) so that **at most 2 %** of its unbalance force reaches the floor at speed ($T \\le$ ${CH.T}), its excursion while running up through the mount resonance stays **within ±${CH.X} mm** (the flexible pipe connection), and the static sag is **at most ${CH.sag} mm** (steel springs, no air springs).`}
        />
        <div className="row gap-s wrap">
          <Badge tone={okN ? 'ok' : 'muted'}>{okN ? '✓' : '○'} running at {CH.N} rpm</Badge>
          <Badge tone={okT ? 'ok' : 'muted'}>{okT ? '✓' : '○'} T ≤ {CH.T} at speed</Badge>
          <Badge tone={okX ? 'ok' : 'muted'}>{okX ? '✓' : '○'} start-up excursion ≤ {CH.X} mm</Badge>
          <Badge tone={okSag ? 'ok' : 'muted'}>{okSag ? '✓' : '○'} sag ≤ {CH.sag} mm</Badge>
        </div>
        <div className="row gap-s wrap">
          <Button size="sm" variant="primary" disabled={!solved || done} onClick={() => solved && completeChallenge(ISO_CHALLENGE)}>
            {done ? '✓ Challenge complete' : solved ? 'Submit this design' : 'Not there yet'}
          </Button>
          {done && <span className="small muted">Soft, lightly but not un-damped mounts: the sag limits the softness and the start-up excursion sets the minimum damping.</span>}
        </div>
      </Callout>
      <SimLayout
        visual={
          <>
            <Plot x={{ min: 0, max: nMax, label: 'machine speed during run-up (rpm)' }} y={{ min: 1, max: fTop, log: true, label: 'force to the floor (N)' }} height={250} ariaLabel="Force transmitted to the floor against machine speed during run-up">
              <Band x0={Math.SQRT2 * fn * 60} x1={nMax} color="var(--ok)" opacity={0.07} label="isolating: T < 1" />
              <Line points={rigid} color="var(--text-3)" width={1.6} dash />
              <Line points={force} color="var(--m1)" width={2.6} />
              <VLine x={fn * 60} color="var(--text-3)" label="fₙ" />
              <VLine x={N} color="var(--m2)" label="running" labelY="bottom" />
              <circle ref={fDot} r={6} cx={-20} cy={-20} fill="var(--surface)" stroke="var(--accent)" strokeWidth={3} />
              <Grab into={fScales} />
            </Plot>
            <Legend
              items={[
                { label: 'on these mounts: me Ω² T', color: 'var(--m1)' },
                { label: 'bolted down: me Ω²', color: 'var(--text-3)', dash: true },
              ]}
            />
            <Plot x={{ min: 0, max: nMax, label: 'machine speed during run-up (rpm)' }} y={{ min: 0, max: xTop, label: 'excursion X (mm)' }} height={190} ariaLabel="Machine excursion against speed during run-up">
              <HLine y={CH.X} color="var(--bad)" label="pipe limit ±2 mm" />
              <HLine y={(1000 * ME) / M} color="var(--text-3)" label="me/M" />
              <Line points={exc} color="var(--m1)" width={2.4} />
              <VLine x={N} color="var(--m2)" />
              <circle ref={xDot} r={6} cx={-20} cy={-20} fill="var(--surface)" stroke="var(--accent)" strokeWidth={3} />
              <Grab into={xScales} />
            </Plot>
            <div className="muted small">
              <Rich text="Quasi-steady run-up (a slow sweep): at each speed, the steady-state response. The excursion peak, $(me/M)/2\zeta$, does not depend on the mount stiffness; the floor-force peak does (it scales with $\omega_n^2$)." />
            </div>
          </>
        }
        controls={
          <>
            <Slider label="running speed" tex="N" tip="compressor running speed (rpm); Ω = 2πN/60" value={N} min={300} max={3600} step={10} unit="rpm" sig={4} onChange={setN} />
            <Slider label="static sag of the mounts" tex="\delta_{st}" tip="how far the mounts compress under the machine's weight; ωₙ = √(g/δ)" value={sag} min={0.5} max={250} log unit="mm" sig={3} onChange={setSag} />
            <Slider label="mount damping ratio" tex="\zeta" tip="ζ = c/(2√(kM))" value={zeta} min={0.005} max={0.5} log sig={2} onChange={setZeta} />
            <div className="small muted">
              <Rich text={`Mount type: **${mountType(sag)}**. Total stiffness $k = Mg/\\delta_{st}$ = ${fmt(k / 1000, 3)} kN/m.`} />
            </div>
            <Readouts>
              <Readout tex="f_n" tip="mount natural frequency √(g/δ)/2π" value={fn} unit="Hz" sig={3} />
              <Readout tex="r" tip="running speed / mount natural frequency, Ω/ωₙ" value={r} sig={3} tone={r > Math.SQRT2 ? 'ok' : 'bad'} />
              <Readout tex="T" tip="transmissibility at speed, F_T/(me Ω²)" value={T} sig={3} tone={T < 1 ? 'ok' : 'bad'} />
              <Readout tex="F_T" tip="force reaching the floor at speed, me Ω² T" value={FT} unit="N" sig={3} />
              <Readout tex="F_{peak}" tip={`largest floor force during the run-up (at ${fmt(nPeak, 3)} rpm)`} value={Fpeak} unit="N" sig={3} tone="warn" />
              <Readout tex="X_{peak}" tip="largest machine excursion during the run-up" value={Xpeak} unit="mm" sig={3} tone={Xpeak <= CH.X ? 'ok' : 'bad'} />
            </Readouts>
            <div className="readouts">
              <div className="readout">
                <div className="readout-label">
                  <Sym tex="N(t)" tip="speed during the animated run-up" />
                </div>
                <div className="readout-value">
                  <span ref={speedTxt}>{fmtSig(N, 4)}</span>
                  <span className="readout-unit"> rpm</span>
                </div>
              </div>
              <div className="readout">
                <div className="readout-label">
                  <Sym tex="F(t)" tip="force reaching the floor at that speed" />
                </div>
                <div className="readout-value">
                  <span ref={forceTxt}>{fmtSig(FT, 3)}</span>
                  <span className="readout-unit"> N</span>
                </div>
              </div>
              <Readout tex="X" tip="excursion at running speed; tends to me/M = 0.1 mm far above resonance" value={Xrun} unit="mm" sig={3} />
            </div>
            <svg viewBox="0 0 240 172" className="anim" style={{ maxWidth: 300 }} role="img" aria-label="Compressor on two springs and a damper, with a bar for the force reaching the floor">
              <g ref={machine}>
                <rect x={45} y={52} width={150} height={56} rx={6} fill="var(--surface-2)" stroke="var(--text-2)" strokeWidth={1.8} />
                <circle cx={158} cy={80} r={19} fill="none" stroke="var(--text-3)" strokeWidth={1.5} />
                <line ref={rotor} x1={158} y1={80} x2={173} y2={80} stroke="var(--m2)" strokeWidth={3} strokeLinecap="round" />
                <text x={56} y={84} className="plot-note">
                  M = {M} kg
                </text>
              </g>
              <path ref={springL} d={springPath(78, 150, 78, 108, 5, 7)} fill="none" stroke="var(--text-2)" strokeWidth={1.8} />
              <path ref={springR} d={springPath(162, 150, 162, 108, 5, 7)} fill="none" stroke="var(--text-2)" strokeWidth={1.8} />
              <g fill="none" stroke="var(--text-2)" strokeWidth={1.8}>
                <path ref={damperCyl} d={damperPaths(120, 150, 120, 108).cyl} />
                <path ref={damperRod} d={damperPaths(120, 150, 120, 108).rod} />
              </g>
              <Ground x={115} y={150} w={170} />
              <rect x={212} y={30} width={14} height={120} fill="none" stroke="var(--border)" />
              <rect ref={bar} x={212} y={150} width={14} height={0} fill="var(--m2)" opacity={0.8} />
              <text x={219} y={22} textAnchor="middle" className="plot-note">
                floor
              </text>
              <text x={219} y={166} textAnchor="middle" className="plot-note">
                force
              </text>
            </svg>
            <div className="row gap-s wrap">
              <Button variant="primary" onClick={runUp}>
                Run up from rest
              </Button>
              <span className="small muted">slow motion; bounce exaggerated</span>
            </div>
            <div className="row gap-s wrap">
              <span className="muted small">Mounts:</span>
              <Button size="sm" onClick={() => preset(4, 0.08)}>
                rubber 4 mm
              </Button>
              <Button size="sm" onClick={() => preset(25, 0.01)} title="bare steel springs are very lightly damped (ζ ≈ 0.01)">
                steel 25 mm
              </Button>
              <Button size="sm" onClick={() => preset(125, 0.02)}>
                coils 125 mm
              </Button>
              <Button size="sm" onClick={() => preset(200, 0.05)}>
                air 200 mm
              </Button>
              <Button size="sm" onClick={() => preset(9.94, 0.05, 1500)} title="2025 A3.5: r = 5">
                r = 5 (2025 A3.5)
              </Button>
            </div>
          </>
        }
      />
      <PredictReveal
        id="c4-iso-stiff"
        question="The compressor runs at 600 rpm (10 Hz). You fit stiff rubber pads that sag only 0.62 mm, so $f_n \approx$ 20 Hz ($\omega_n = 2\Omega$). At speed, the force reaching the floor is…"
        options={['about 1/3 of the unbalance force', 'the same as bolting it down', 'about 1.3 × the unbalance force: more than bolting it down']}
        answer={2}
        explain="With $r = 0.5$, $T = 1/(1 - 0.25) = 1.33$: below $r = \sqrt2$ every mount **amplifies**. Isolation needs a mount frequency much **smaller** than the forcing frequency, never much larger (the recurring distractor in official 2017–2019 A3.7)."
        tryIt="set 600 rpm and a 0.62 mm sag, and read T."
        onApply={() => preset(0.621, 0.05, 600)}
      />
      <PredictReveal
        id="c4-iso-tradeoff"
        question="At 1500 rpm on 10 mm mounts you raise $\zeta$ from 0.05 to 0.3. What happens to the start-up peak and to the force at speed?"
        options={['Both fall', 'The start-up peak falls; the force at speed rises', 'Both rise', 'The start-up peak rises; the force at speed falls']}
        answer={1}
        explain="Near resonance the peak scales as $1/2\zeta$, so the run-up peak drops (excursion 1.0 mm → 0.17 mm). Above $\sqrt2$ the damper passes a force $c\Omega X$ that grows with speed, so $T$ at $r$ = 5.0 rises from 0.046 to 0.130: the force at speed goes from 57 N to 161 N, almost three times more (2025 A3.5; official A3.7(c),(d)). Isolators get **just enough** damping to pass resonance."
        tryIt="start at ζ = 0.05, then raise it to 0.3 and watch both curves."
        onApply={() => preset(10, 0.3, 1500)}
      />
      <PredictReveal
        id="c4-iso-softer"
        question="Keep $\zeta$ = 0.1 and double the static sag from 10 mm to 20 mm. The largest floor force during the run-up…"
        options={['roughly doubles', 'roughly halves', 'stays the same']}
        answer={1}
        explain="Near the mount resonance the floor force is about $me\,\omega_n^2/(2\zeta)$, and $\omega_n^2 = g/\delta_{st}$: doubling the sag halves it, 251 N → 126 N (and the force at speed falls too, 72 N → 43 N). The machine’s **excursion** at resonance, $(me/M)/2\zeta$ = 0.5 mm, does not change at all: softness cannot fix the start-up motion; only damping (or a heavier inertia block, which lowers $me/M$) can."
        tryIt="compare F_peak and X_peak at 10 mm and at 20 mm."
        onApply={() => preset(20, 0.1, 1500)}
      />
    </div>
  );
}
