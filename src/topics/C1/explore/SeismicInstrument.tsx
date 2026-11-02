// Seismic instrument: one mass–spring–damper in a case, read as an accelerometer (beta << 1) or a
// displacement vibrometer (beta >> 1). Ratio and phase against beta for several zeta, the usable band
// within ±eps, an animated cut-away and the instrument's reading against the true quantity.
import { useEffect, useMemo, useRef, useState } from 'react';
import { accelerometerRatio, seismicPhase, seismicRatio, usableBand } from '../../../physics/transducers';
import { useRaf } from '../../../anim/hooks';
import { Band, HBand, HLine, Handle, Line, Plot, PlotText, VLine, sample, usePlot, type AxisSpec, type PlotScales } from '../../../plot/Plot';
import { Badge, Button, Callout, Legend, Readout, Readouts, Segmented, SimLayout, Slider } from '../../../ui/kit';
import { PredictReveal } from '../../../ui/PredictReveal';
import { Rich } from '../../../ui/Rich';
import { springPath } from '../../../ui/diagrams';
import { completeChallenge, useProgress } from '../../../app/store';
import { G, TAU, seismicTraces } from '../physics';

/** Design challenge: ±5 % from 0 to 5 kHz with at least 2 nm of deflection per g. Undamped this needs fₙ ≥ 22.9 kHz
 * (0.47 nm per g), so it is only possible with ζ ≈ 0.59–0.76 and fₙ between about 6 and 11 kHz. */
export const SEISMIC_CHALLENGE = 'c1-seismic-design';
const CH_F = 5000; // Hz
const CH_Z = 2e-9; // m per g

type Kind = 'accelerometer' | 'vibrometer';
const REF_ZETAS = [0, 0.05, 0.1, 0.25, 0.5, 0.7, 1];
const B_MIN = 0.01;
const B_MAX = 10;

const X_AXIS: AxisSpec = { min: B_MIN, max: B_MAX, log: true, label: 'frequency ratio β = ω/ωₙ (log)' };
const Y_RATIO_ACC: AxisSpec = { min: 0, max: 3, label: 'reading / true  (z₀ωₙ²/|ÿ|)' };
const Y_RATIO_VIB: AxisSpec = { min: 0, max: 3, label: 'reading / true  (z₀/y₀)' };
const Y_PHASE: AxisSpec = { min: 0, max: 180, label: 'phase lag φ (°)', ticks: [0, 45, 90, 135, 180] };
const X_TRACE: AxisSpec = { min: 0, max: 2, label: 'time (cycles of the measured vibration)', ticks: [0, 0.5, 1, 1.5, 2] };
const Y_TRACE: AxisSpec = { min: -2, max: 2, label: 'normalised', ticks: [-2, -1, 0, 1, 2] };

/** Captures a Plot's scales for per-frame drawing. */
function Probe({ into }: { into: { current: PlotScales | null } }) {
  const ctx = usePlot();
  into.current = { sx: ctx.sx, sy: ctx.sy, clip: ctx.clip };
  return null;
}

/** Hz or kHz for readouts. */
function hz(f: number): { value: number; unit: string } {
  if (!Number.isFinite(f)) return { value: f, unit: 'Hz' };
  return f >= 1000 ? { value: f / 1000, unit: 'kHz' } : { value: f, unit: 'Hz' };
}

export default function SeismicInstrument() {
  const [kind, setKind] = useState<Kind>('accelerometer');
  const [zeta, setZeta] = useState(0.02);
  const [tolPct, setTolPct] = useState(5);
  const [mGram, setMGram] = useState(5); // proof mass, g
  const [k, setK] = useState(1.8e8); // N/m
  const [f, setF] = useState(3000); // measured frequency, Hz

  const m = mGram / 1000;
  const wn = Math.sqrt(k / m);
  const fn = wn / TAU;
  const beta = f / fn;
  const tol = tolPct / 100;
  const acc = kind === 'accelerometer';
  const ratio = acc ? accelerometerRatio(beta, zeta) : seismicRatio(beta, zeta);
  const err = ratio - 1;
  const phi = (seismicPhase(beta, zeta) * 180) / Math.PI;
  const band = usableBand(zeta, tol, kind); // beta_max (accelerometer) or beta_min (vibrometer)
  const bandOk = acc ? beta <= band : beta >= band;
  const bandUndamped = usableBand(0, tol, kind);
  const zPerG = G / (wn * wn); // m per g

  const fnS = hz(fn);
  const bandF = hz(band * fn);

  // Design challenge (always judged at ±5 %, whatever the ε slider says).
  const progress = useProgress();
  const done = !!progress.challenges[SEISMIC_CHALLENGE];
  const band5 = usableBand(zeta, 0.05, 'accelerometer') * fn;
  const okBand = band5 >= CH_F;
  const okSens = zPerG >= CH_Z;
  useEffect(() => {
    if (okBand && okSens) completeChallenge(SEISMIC_CHALLENGE);
  }, [okBand, okSens]);
  const band5S = hz(band5);

  // Sampled curves (memoised on the inputs they depend on).
  const fnRatio = acc ? accelerometerRatio : seismicRatio;
  const refs = useMemo(() => REF_ZETAS.map((z) => sample((b) => fnRatio(b, z), B_MIN, B_MAX, 360, true)), [fnRatio]);
  const cur = useMemo(() => sample((b) => fnRatio(b, zeta), B_MIN, B_MAX, 500, true), [fnRatio, zeta]);
  const phRefs = useMemo(() => REF_ZETAS.filter((z) => z > 0).map((z) => sample((b) => (seismicPhase(b, z) * 180) / Math.PI, B_MIN, B_MAX, 300, true)), []);
  const ph = useMemo(() => sample((b) => (seismicPhase(b, zeta) * 180) / Math.PI, B_MIN, B_MAX, 400, true), [zeta]);
  const traces = useMemo(() => {
    const truth = sample((c) => seismicTraces(TAU * c, beta, zeta, kind).truth, 0, 2, 240);
    const reading = sample((c) => seismicTraces(TAU * c, beta, zeta, kind).reading, 0, 2, 240);
    return { truth, reading };
  }, [beta, zeta, kind]);

  // Animation: the case follows y = Y sin(theta) (slowed to 0.5 cycles/s on screen); the mass moves x = y + z.
  const wrapRef = useRef<HTMLDivElement>(null);
  const caseRef = useRef<SVGGElement>(null);
  const massRef = useRef<SVGGElement>(null);
  const springRef = useRef<SVGPathElement>(null);
  const groundRef = useRef<SVGGElement>(null);
  const cursorRef = useRef<SVGLineElement>(null);
  const dotTruthRef = useRef<SVGCircleElement>(null);
  const dotReadRef = useRef<SVGCircleElement>(null);
  const traceScales = useRef<PlotScales | null>(null);
  const theta = useRef(0);
  const zOverY = seismicRatio(beta, zeta);
  const phiRad = seismicPhase(beta, zeta);
  const Ypx = 14;
  const zpx = Math.min(44, zOverY * Ypx);
  useRaf(
    (dt) => {
      theta.current = (theta.current + TAU * 0.5 * dt) % (2 * TAU);
      const th = theta.current;
      const y = Ypx * Math.sin(th);
      const z = zpx * Math.sin(th - phiRad);
      groundRef.current?.setAttribute('transform', `translate(0 ${(-y).toFixed(2)})`);
      caseRef.current?.setAttribute('transform', `translate(0 ${(-y).toFixed(2)})`);
      massRef.current?.setAttribute('transform', `translate(0 ${(-z).toFixed(2)})`);
      // Spring (piezo element) from the case floor (y = 150) to the mass underside (y = 104 - z), in case coordinates.
      springRef.current?.setAttribute('d', springPath(110, 150, 110, 104 - z, 4, 9));
      const s = traceScales.current;
      if (s) {
        const c = th / TAU;
        const tr = seismicTraces(th, beta, zeta, kind);
        const px = s.sx(c).toFixed(1);
        cursorRef.current?.setAttribute('x1', px);
        cursorRef.current?.setAttribute('x2', px);
        dotTruthRef.current?.setAttribute('cx', px);
        dotTruthRef.current?.setAttribute('cy', s.sy(Math.max(-2.2, Math.min(2.2, tr.truth))).toFixed(1));
        dotReadRef.current?.setAttribute('cx', px);
        dotReadRef.current?.setAttribute('cy', s.sy(Math.max(-2.2, Math.min(2.2, tr.reading))).toFixed(1));
      }
    },
    true,
    wrapRef
  );

  const preset = (p: 'piezo' | 'damped' | 'vibro') => {
    if (p === 'piezo') {
      setKind('accelerometer');
      setMGram(5);
      setK(1.8e8);
      setZeta(0.02);
      setF(3000);
    } else if (p === 'damped') {
      setKind('accelerometer');
      setZeta(0.7);
      setF(0.5 * fn);
    } else {
      setKind('vibrometer');
      setMGram(500);
      setK(50);
      setZeta(0.5);
      setF(20);
    }
  };

  const b2 = beta.toPrecision(2);
  const outside = `Outside the ±${tolPct} % band (β = ${b2}): the reading is ${ratio.toPrecision(3)}× the true amplitude and lags by ${phi.toPrecision(3)}°.`;
  const regime = acc
    ? bandOk
      ? beta < 0.3
        ? `**Accelerometer regime** (β = ${b2}): the mass rides with the case and the tiny spring squeeze $z_0 \\approx |\\ddot y|/\\omega_n^2$ tracks the case acceleration.`
        : `**Still inside the ±${tolPct} % band** (β = ${b2}): with ζ = ${zeta.toFixed(2)} the curve stays flat this close to $f_n$, and the phase lag (${phi.toPrecision(2)}°) grows almost in proportion to frequency, a near-constant time delay.`
      : beta > 3
        ? `β = ${b2} is far **above** resonance: the mass stays still and $z \\approx -y$. That is a displacement reading, not acceleration.`
        : `${outside} Keep the measured band below β = ${band.toPrecision(3)}.`
    : bandOk
      ? `**Vibrometer regime** (β = ${b2}): the heavy mass hardly moves, so the relative deflection is the case displacement ($z \\approx -y$).`
      : beta < 0.3
        ? `β = ${b2} is far **below** resonance: the mass moves with the case, so $z \\approx 0$ and a vibrometer reads almost nothing. Use it well above $f_n$.`
        : `${outside} Use it above β = ${band.toPrecision(3)}.`;

  const offScale = Math.abs(ratio) > 2;

  return (
    <div ref={wrapRef}>
      <SimLayout
        visual={
          <>
            <Plot x={X_AXIS} y={acc ? Y_RATIO_ACC : Y_RATIO_VIB} height={260} ariaLabel="Instrument reading divided by the true value, against frequency ratio">
              <HBand y0={1 - tol} y1={1 + tol} color="var(--ok)" opacity={0.12} />
              {acc ? (
                <Band x0={B_MIN} x1={Math.min(B_MAX, band)} color="var(--ok)" opacity={0.08} label={`usable: β ≤ ${band.toPrecision(3)}`} />
              ) : (
                <Band x0={Math.max(B_MIN, band)} x1={B_MAX} color="var(--ok)" opacity={0.08} label={`usable: β ≥ ${band.toPrecision(3)}`} />
              )}
              {/* The other regime of the same instrument, as on the reader's LC1-6 chart. */}
              {acc ? (
                <>
                  <Band x0={3} x1={B_MAX} color="var(--text-3)" opacity={0.07} />
                  <PlotText x={B_MAX} y={2.72} anchor="end" dx={-6} color="var(--text-3)">
                    β ≫ 1: vibrometer region (z ≈ −y)
                  </PlotText>
                </>
              ) : (
                <>
                  <Band x0={B_MIN} x1={0.3} color="var(--text-3)" opacity={0.07} />
                  <PlotText x={B_MIN} y={2.72} dx={6} color="var(--text-3)">
                    β ≪ 1: accelerometer region (z ∝ ÿ)
                  </PlotText>
                </>
              )}
              {refs.map((pts, i) => (
                <Line key={i} points={pts} color="var(--text-3)" width={1} opacity={0.45} />
              ))}
              <Line points={cur} color="var(--m1)" width={2.6} />
              <HLine y={1} color="var(--text-2)" label="exact" />
              <VLine x={1} label="β = 1 (resonance)" labelY="bottom" />
              {beta >= B_MIN && beta <= B_MAX && (
                <Handle x={beta} y={Math.min(3, ratio)} axis="x" clampX={[B_MIN, B_MAX]} onChange={(b) => setF(b * fn)} color="var(--accent)" label="measuring here" ariaLabel="Measured frequency ratio" />
              )}
            </Plot>
            <Legend
              items={[
                { label: `ζ = ${zeta.toFixed(2)}`, color: 'var(--m1)' },
                { label: 'ζ = 0, 0.05, 0.1, 0.25, 0.5, 0.7, 1', color: 'var(--text-3)' },
                { label: `±${tolPct} % band`, color: 'var(--ok)' },
              ]}
            />
            <Plot x={X_AXIS} y={Y_PHASE} height={160} ariaLabel="Phase lag of the relative deflection against frequency ratio">
              {phRefs.map((pts, i) => (
                <Line key={i} points={pts} color="var(--text-3)" width={1} opacity={0.4} />
              ))}
              <Line points={ph} color="var(--m1)" width={2.2} />
              <VLine x={1} />
              {beta >= B_MIN && beta <= B_MAX && <HLine y={phi} color="var(--accent)" dash="2 3" width={1} />}
            </Plot>
            <Plot x={X_TRACE} y={Y_TRACE} height={180} ariaLabel="Instrument reading and true quantity over two cycles">
              <Line points={traces.reading} color="var(--m1)" width={2.6} />
              <Line points={traces.truth} color="var(--text)" dash width={1.6} />
              <Probe into={traceScales} />
              <line ref={cursorRef} y1={12} y2={140} stroke="var(--text-3)" strokeDasharray="3 3" />
              <circle ref={dotTruthRef} r={4} fill="var(--surface)" stroke="var(--text-2)" strokeWidth={2} />
              <circle ref={dotReadRef} r={4} fill="var(--m1)" />
            </Plot>
            <Legend
              items={[
                { label: acc ? 'true case acceleration ÿ' : 'true case displacement y', color: 'var(--text)', dash: true },
                { label: acc ? 'reading −ωₙ²z' : 'reading −z', color: 'var(--m1)' },
              ]}
            />
            {offScale && <p className="muted small">The reading is off this scale ({ratio.toPrecision(3)}× the true amplitude).</p>}
          </>
        }
        controls={
          <>
            <Segmented
              label="Use the instrument as"
              value={kind}
              onChange={setKind}
              options={[
                { value: 'accelerometer', label: 'Accelerometer' },
                { value: 'vibrometer', label: 'Vibrometer' },
              ]}
            />
            <Slider label="damping ratio" tex="\zeta" tip="ζ = c/(2√(km)) of the seismic mass" value={zeta} min={0} max={1} step={0.005} sig={3} onChange={setZeta} />
            <Slider label="allowed error" tex="\varepsilon" tip="usable band: reading within ±ε of the true value" value={tolPct} min={1} max={10} step={0.5} unit="%" sig={2} onChange={setTolPct} />
            <Slider label="measured frequency" tex="f" tip="frequency of the vibration being measured" value={f} min={0.1} max={1e6} log unit="Hz" sig={3} onChange={setF} />
            <details className="more">
              <summary>Physical design: proof mass and spring</summary>
              <div className="more-body">
                <Slider label="proof mass" tex="m" tip="seismic (proof) mass" value={mGram} min={0.5} max={5000} log unit="g" sig={3} onChange={setMGram} />
                <Slider label="spring stiffness" tex="k" tip="stiffness of the piezo element / spring" value={k} min={10} max={1e10} log unit="N/m" sig={3} onChange={setK} />
              </div>
            </details>
            <Readouts>
              <Readout tex="f_n" tip="instrument natural frequency √(k/m)/2π" value={fnS.value} unit={fnS.unit} sig={3} />
              <Readout tex="\beta" tip="frequency ratio f/fₙ" value={beta} sig={3} />
              <Readout
                tex={acc ? 'z_0\\omega_n^2/|\\ddot y|' : 'z_0/y_0'}
                tip={acc ? 'reading/true: accelerometer reading divided by the true case acceleration, 1/√((1−β²)² + (2ζβ)²)' : 'reading/true: vibrometer reading divided by the true case displacement, β²/√((1−β²)² + (2ζβ)²)'}
                value={ratio}
                sig={4}
                tone={Math.abs(err) <= tol ? 'ok' : 'bad'}
              />
              <Readout tex="e" label="error" tip="amplitude error e = reading/true − 1 (usable while |e| ≤ ε)" value={err * 100} unit="%" sig={3} tone={Math.abs(err) <= tol ? 'ok' : 'bad'} />
              <Readout tex="\varphi" tip="phase lag of z behind the case motion" value={phi} unit="°" sig={3} />
              {acc ? (
                <Readout tex="f_{max}" label="usable to" tip="highest frequency with |error| ≤ ε: β_max·fₙ" value={bandF.value} unit={bandF.unit} sig={3} tone="m1" />
              ) : (
                <Readout tex="f_{min}" label="usable above" tip="lowest frequency with |error| ≤ ε from there up: β_min·fₙ" value={bandF.value} unit={bandF.unit} sig={3} tone="m1" />
              )}
              {acc ? (
                <Readout tex="z_0/g" tip="relative deflection per g of case acceleration, g/ωₙ² (the sensitivity)" value={zPerG * 1e9} unit="nm" sig={3} />
              ) : (
                <Readout tex="\beta_{min}" tip="lowest usable frequency ratio" value={band} sig={3} />
              )}
              <Readout tex="\times" label="band vs ζ = 0" tip="how many times wider the usable band is than for an undamped instrument with the same fₙ" value={acc ? band / bandUndamped : bandUndamped / band} unit="×" sig={3} />
            </Readouts>
            <svg viewBox="0 0 220 222" className="anim" style={{ maxWidth: 240 }} role="img" aria-label="Cut-away of the instrument: the case moves with the structure and the mass moves on its spring">
              <g ref={groundRef}>
                <rect x={20} y={172} width={180} height={14} rx={2} fill="var(--surface-3)" stroke="var(--text-3)" />
              </g>
              <text x={110} y={218} textAnchor="middle" className="plot-note">
                structure moves y = Y sin ωt
              </text>
              <g ref={caseRef}>
                <rect x={60} y={40} width={100} height={130} rx={6} fill="none" stroke="var(--text-2)" strokeWidth={2} />
                <rect x={60} y={150} width={100} height={20} fill="var(--surface-2)" stroke="var(--text-2)" strokeWidth={1.5} />
                <text x={64} y={36} className="plot-note">
                  case
                </text>
                <path ref={springRef} d={springPath(110, 150, 110, 104, 4, 9)} fill="none" stroke="var(--m2)" strokeWidth={2} />
                <g ref={massRef}>
                  <rect x={80} y={72} width={60} height={32} rx={4} fill="var(--surface-2)" stroke="var(--m1)" strokeWidth={2} />
                  <text x={110} y={93} textAnchor="middle" className="diagram-label">
                    m
                  </text>
                </g>
              </g>
              <text x={170} y={128} className="plot-note">
                k (piezo)
              </text>
            </svg>
            <Rich className="note" text={regime} />
            <div className="row gap-s wrap">
              <span className="muted small">Presets:</span>
              <Button size="sm" onClick={() => preset('piezo')}>
                Piezo accelerometer
              </Button>
              <Button size="sm" onClick={() => preset('damped')}>
                Damped, ζ = 0.7
              </Button>
              <Button size="sm" onClick={() => preset('vibro')}>
                Vibrometer
              </Button>
            </div>
            <p className="muted small">Piezo values (5 g, about 30 kHz, ζ = 0.02) are typical, not from the course notes.</p>
          </>
        }
        below={
          <Callout kind={okBand && okSens ? 'ok' : 'info'} title="Design challenge: bandwidth and sensitivity">
            <Rich text="Design an accelerometer that reads within **±5 %** from 0 to **5 kHz** while its seismic mass still deflects at least **2 nm per g** (a usable signal). Use the damping slider and the proof mass and spring under *Physical design*." />
            <div className="row gap-s wrap" aria-live="polite">
              <Badge tone={okBand ? 'ok' : 'bad'} title="highest frequency at which the reading is still within ±5 % (judged at ε = 5 % whatever the slider says)">
                {`${okBand ? '✓' : '✗'} ±5 % up to ${band5S.value.toPrecision(3)} ${band5S.unit} (need ≥ 5 kHz)`}
              </Badge>
              <Badge tone={okSens ? 'ok' : 'bad'} title="relative deflection of the seismic mass per g of case acceleration, g/ωₙ²">
                {`${okSens ? '✓' : '✗'} ${(zPerG * 1e9).toPrecision(3)} nm per g (need ≥ 2)`}
              </Badge>
              {done && <Badge tone="ok">✓ Challenge complete</Badge>}
            </div>
            {okBand && okSens ? (
              <Rich text={`Solved with $\\zeta$ = ${zeta.toFixed(3)} and $f_n$ = ${fnS.value.toPrecision(3)} ${fnS.unit}. Undamped, ±5 % to 5 kHz needs $f_n \\ge$ 5/0.218 = 22.9 kHz, which leaves only 0.47 nm per g. Damping near 0.6–0.75 keeps the curve flat up to 0.48–0.84 $f_n$, so a softer, more sensitive instrument covers the same band. Outside that window it fails: below about 0.59 the resonant rise already exceeds 5 %, above about 0.76 the curve droops too early.`} />
            ) : (
              done && <Rich className="muted small" text="Already solved once; the badges keep tracking your current design." />
            )}
          </Callout>
        }
      />
      <PredictReveal
        id="c1-seis-halve-m"
        question="Halve the proof mass and keep the same spring. What happens to the usable band and to the deflection per g?"
        options={['band ×2 wider, deflection per g halves', 'band ×√2 wider, deflection per g halves', 'band ×√2 wider, deflection per g doubles', 'no change: only the spring matters']}
        answer={1}
        explain="$\omega_n = \sqrt{k/m}$ rises by $\sqrt2$, and the usable band scales with $\omega_n$, so it is $\sqrt2$ wider. The sensitivity $z_0/|\ddot y| = 1/\omega_n^2 = m/k$ halves: the charge per g gets even smaller. That is the bandwidth–sensitivity trade-off (2025 A3.1(b))."
        tryIt="note the ‘usable to’ and ‘z₀/g’ readouts, then halve m under Physical design."
        onApply={() => {
          setKind('accelerometer');
          setMGram((g) => g / 2);
        }}
      />
      <PredictReveal
        id="c1-seis-fifth"
        question="An **undamped** accelerometer measures vibration at one fifth of its natural frequency. Its amplitude reading is…"
        options={['exact', 'about 4 % too high', 'about 20 % too high', 'about 4 % too low']}
        answer={1}
        explain="$1/(1-\beta^2) = 1/(1-0.04) = 1.042$: 4.2 % high. The error grows as $\beta^2$, so measuring to one tenth of $f_n$ keeps it to 1 %. This is the 2025 A3.1 worked-solution figure."
        tryIt="set ζ = 0 and the measured frequency to fₙ/5."
        onApply={() => {
          setKind('accelerometer');
          setZeta(0);
          setF(fn / 5);
        }}
      />
      <PredictReveal
        id="c1-seis-above"
        question="Now use the same instrument at **five times** its natural frequency. Its relative deflection $z$ follows…"
        options={['the case acceleration', 'the case displacement: it has become a vibrometer', 'nothing: it reads zero']}
        answer={1}
        explain="For $\beta \gg 1$ the mass cannot follow the case and stays almost still, so $z \approx -y$ and $z_0/y_0 \to 1$ (1.042 at β = 5 undamped). That is how a displacement vibrometer, and an electrodynamic velocity pickup, work (LC1-6)."
        tryIt="set f = 5 fₙ and switch the view to Vibrometer; watch the mass in the cut-away."
        onApply={() => {
          setKind('vibrometer');
          setF(5 * fn);
        }}
      />
      <PredictReveal
        id="c1-seis-damping"
        question="With a ±5 % tolerance, raising the damping from ζ = 0.02 to ζ = 0.7 makes the usable accelerometer band…"
        options={['narrower', 'about the same', 'nearly three times wider']}
        answer={2}
        explain="Undamped, the reading leaves the ±5 % band at β = 0.218. At ζ = 0.7 the curve is almost flat until it slowly falls, reaching −5 % only at β = 0.591: 2.7× wider. The phase lag also becomes nearly proportional to frequency (≈ 90° × β), so the waveform is delayed rather than distorted."
        tryIt="set ε = 5 % and move ζ from 0.02 to 0.7; watch the green band."
        onApply={() => {
          setKind('accelerometer');
          setTolPct(5);
          setZeta(0.7);
          setF(0.5 * fn); // inside the new band: the reading is 2.5 % low, still within ±5 %
        }}
      />
    </div>
  );
}
