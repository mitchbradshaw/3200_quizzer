// Noise lab: an averaged FRF measurement on a pinned-pinned beam (modes at 20, 80, 180, 320 Hz).
// Noise on the force and on the response, the number of averages, the excitation (shaker or hammer tip)
// and the sensor/exciter positions decide how H1, H2 and the coherence compare with the true FRF.
// Each spectral line is one call of physics/dsp simulateFRFMeasurement; a weak force at a line is
// modelled by scaling both noise levels by 1/|F(f)| (H1, H2 and coherence are scale-invariant).
import { useDeferredValue, useMemo, useState } from 'react';
import { simulateFRFMeasurement } from '../../../physics/dsp';
import { cabs } from '../../../physics/complex';
import { halfSineSpectrum } from '../../../physics/transducers';
import { ssBeamAccelerance, ssBeamFrequencies } from '../physics';
import { HLine, Line, Plot, VLine } from '../../../plot/Plot';
import { Badge, Button, Callout, Legend, Readout, Readouts, Segmented, SimLayout, Slider, modeColor } from '../../../ui/kit';
import { PredictReveal } from '../../../ui/PredictReveal';
import { completeChallenge, useProgress } from '../../../app/store';
import { Rich } from '../../../ui/Rich';
import { fmt } from '../../../engine/format';

export const COH_CHALLENGE = 'c3-coherence-plan';

const F1 = 20; // Hz
const ZETA = 0.02;
const MASS = 10; // kg
const FMAX = 400;
const DFL = 0.5;
const LINES = Array.from({ length: Math.round((FMAX - 2) / DFL) + 1 }, (_, i) => 2 + i * DFL);
const MODES = ssBeamFrequencies(F1, 4);
type Exc = 'shaker' | 'hard' | 'soft';
const TAU: Record<Exc, number> = { shaker: 0, hard: 0.25e-3, soft: 4e-3 };
const EXC_LABEL: Record<Exc, string> = { shaker: 'shaker (flat force)', hard: 'hammer, hard tip (τ ≈ 0.25 ms)', soft: 'hammer, soft tip (τ ≈ 4 ms)' };
const forceLevel = (e: Exc, f: number) => (e === 'shaker' ? 1 : halfSineSpectrum(f, TAU[e]));

let REF = 0;
/** A typical resonance peak: the largest |A| of the driving-point FRF at 0.4L (the output-noise reference). */
const refPeak = () => (REF ||= Math.max(...LINES.map((f) => cabs(ssBeamAccelerance(f, 0.4, 0.4, F1, ZETA, MASS)))));

interface Params {
  xs: number;
  xf: number;
  exc: Exc;
  nAvg: number;
  nin: number;
  nout: number;
  seed: number;
}

function measure(p: Params) {
  const n = LINES.length;
  const H = new Float64Array(n);
  const H1 = new Float64Array(n);
  const H2 = new Float64Array(n);
  const coh = new Float64Array(n);
  const S = new Float64Array(n);
  const R = new Float64Array(n);
  const ref = refPeak();
  for (let i = 0; i < n; i++) {
    const f = LINES[i];
    const A = ssBeamAccelerance(f, p.xs, p.xf, F1, ZETA, MASS);
    const s = Math.max(1e-5, forceLevel(p.exc, f));
    const r = simulateFRFMeasurement({ H: () => A, freqs: [f], nAvg: p.nAvg, inputNoise: p.nin / s, outputNoise: (p.nout * ref) / s, seed: p.seed * 7919 + i * 131 });
    H[i] = cabs(A);
    H1[i] = cabs(r.H1[0]);
    H2[i] = cabs(r.H2[0]);
    coh[i] = r.coherence[0];
    S[i] = s;
    R[i] = (H[i] * s) / ref;
  }
  return { H, H1, H2, coh, S, R };
}

const nodeAt = (n: number, x: number) => Math.abs(Math.sin(n * Math.PI * x)) < 0.3;

// mode-shape panel geometry
const BX0 = 96;
const BX1 = 388;
const bx = (xi: number) => BX0 + xi * (BX1 - BX0);
const rowY = (n: number) => 54 + (n - 1) * 31;

export default function CoherenceLab() {
  const progress = useProgress();
  const done = !!progress.challenges[COH_CHALLENGE];
  const [xs, setXs] = useState(0.5);
  const [xf, setXf] = useState(0.2);
  const [exc, setExc] = useState<Exc>('hard');
  const [nAvg, setNAvg] = useState(4);
  const [nin, setNin] = useState(0.1);
  const [nout, setNout] = useState(0.01);
  const [seed, setSeed] = useState(1);
  const [hoverF, setHoverF] = useState<number | null>(null);

  const params = useMemo<Params>(() => ({ xs, xf, exc, nAvg, nin, nout, seed }), [xs, xf, exc, nAvg, nin, nout, seed]);
  const dp = useDeferredValue(params);
  const m = useMemo(() => measure(dp), [dp]);
  const xy = (ys: Float64Array) => ({ x: LINES, y: ys });

  const at = (f: number) => Math.max(0, Math.min(LINES.length - 1, Math.round((f - 2) / DFL)));
  const cur = hoverF ?? MODES[0];
  const ci = at(cur);
  const seen = MODES.map((_, i) => ({ n: i + 1, sensor: nodeAt(i + 1, dp.xs), exciter: nodeAt(i + 1, dp.xf) }));
  const resCoh = MODES.map((f) => m.coh[at(f)]);
  const checks = [
    { ok: nAvg >= 20, text: 'at least 20 averages' },
    { ok: nin >= 0.1 - 1e-9 && nout >= 0.01 - 1e-9, text: 'noise at least 10 % (force) and 1 % (sensor)' },
    { ok: seen.every((s) => !s.sensor && !s.exciter), text: 'sensor and exciter off every node of modes 1–4' },
    { ok: resCoh.every((c) => c >= 0.9), text: 'γ² ≥ 0.9 at all four resonances' },
  ];
  const solved = checks.every((c) => c.ok) && dp === params;

  const preset = (p: Partial<Params>) => {
    if (p.xs !== undefined) setXs(p.xs);
    if (p.xf !== undefined) setXf(p.xf);
    if (p.exc !== undefined) setExc(p.exc);
    if (p.nAvg !== undefined) setNAvg(p.nAvg);
    if (p.nin !== undefined) setNin(p.nin);
    if (p.nout !== undefined) setNout(p.nout);
  };

  const shapes = useMemo(
    () =>
      MODES.map((_, i) => {
        const n = i + 1;
        let d = '';
        for (let k = 0; k <= 80; k++) {
          const xi = k / 80;
          d += `${k ? 'L' : 'M'}${bx(xi).toFixed(1)} ${(rowY(n) - 11 * Math.sin(n * Math.PI * xi)).toFixed(1)}`;
        }
        return d;
      }),
    []
  );

  return (
    <div>
      <Callout kind="info" title="Challenge: plan a clean modal test">
        <Rich text="The beam has four modes below 400 Hz. The starting set-up (sensor at mid-span) misses two of them. With at least the starting noise (10 % on the force, 1 % on the sensor), find a set-up that shows **all four modes** with coherence **γ² ≥ 0.9 at every resonance**, using **at least 20 averages**." />
        <div className="row gap-s wrap">
          {checks.map((c, i) => (
            <Badge key={i} tone={c.ok ? 'ok' : 'muted'}>
              {c.ok ? '✓' : '○'} {c.text}
            </Badge>
          ))}
        </div>
        <div className="row gap-s wrap">
          <Button size="sm" onClick={() => preset({ xs: 0.5, xf: 0.2, exc: 'hard', nAvg: 4, nin: 0.1, nout: 0.01 })}>
            Reset to the starting set-up
          </Button>
          <Button size="sm" variant="primary" disabled={!solved || done} onClick={() => solved && completeChallenge(COH_CHALLENGE)}>
            {done ? '✓ Challenge complete' : solved ? 'Submit this test plan' : 'Not there yet'}
          </Button>
        </div>
      </Callout>
      <SimLayout
        visual={
          <>
            <svg viewBox="0 0 400 172" className="anim" role="img" aria-label="Beam with sensor and exciter positions and the first four mode shapes">
              <line x1={BX0} y1={18} x2={BX1} y2={18} stroke="var(--text-2)" strokeWidth={3} />
              {[BX0, BX1].map((x) => (
                <path key={x} d={`M${x} 18l-7 11h14z`} fill="var(--surface-2)" stroke="var(--text-2)" strokeWidth={1.4} />
              ))}
              <rect x={bx(xs) - 6} y={6} width={12} height={10} rx={2} fill="var(--text)" />
              <path d={`M${bx(xf)} 4V14m-4 -5l4 6l4 -6`} stroke="var(--text)" strokeWidth={2.2} fill="none" />
              <text x={4} y={22} className="plot-note">
                beam
              </text>
              {MODES.map((fn, i) => {
                const n = i + 1;
                const y = rowY(n);
                return (
                  <g key={n}>
                    <text x={4} y={y + 4} className="plot-note">
                      mode {n} · {fn} Hz
                    </text>
                    <line x1={BX0} y1={y} x2={BX1} y2={y} stroke="var(--border)" />
                    <path d={shapes[i]} fill="none" stroke={modeColor(n)} strokeWidth={1.8} />
                    {Array.from({ length: n + 1 }, (_, k) => (
                      <circle key={k} cx={bx(k / n)} cy={y} r={2.2} fill="var(--text-3)" />
                    ))}
                    <rect x={bx(xs) - 4} y={y - 11 * Math.sin(n * Math.PI * xs) - 4} width={8} height={8} rx={1} fill={seen[i].sensor ? 'var(--surface)' : 'var(--text)'} stroke="var(--text)" strokeWidth={1.6} />
                    <circle cx={bx(xf)} cy={y - 11 * Math.sin(n * Math.PI * xf)} r={3.8} fill={seen[i].exciter ? 'var(--surface)' : 'var(--text-2)'} stroke="var(--text-2)" strokeWidth={1.6} />
                  </g>
                );
              })}
              <line x1={bx(xs)} y1={18} x2={bx(xs)} y2={170} stroke="var(--text-3)" strokeDasharray="4 3" />
              <line x1={bx(xf)} y1={18} x2={bx(xf)} y2={170} stroke="var(--text-3)" strokeDasharray="1 3" />
            </svg>
            <div className="small muted">■ sensor (accelerometer) · ● ↓ exciter (force) · a hollow marker sits on a node of that mode, so the mode is missed. Mode shapes in the mode colours.</div>
            <div className="row gap-s wrap">
              {seen.map((s) => (
                <Badge key={s.n} tone={s.sensor || s.exciter ? 'bad' : 'ok'}>
                  {s.sensor || s.exciter ? '✗' : '✓'} mode {s.n}
                  {s.sensor ? ': sensor at a node' : s.exciter ? ': exciter at a node' : ''}
                </Badge>
              ))}
            </div>
            <Plot
              x={{ min: 0, max: FMAX, label: 'frequency (Hz)' }}
              y={{ min: 1e-3, max: 50, log: true, label: '|A| ((m/s²)/N)' }}
              height={240}
              ariaLabel="True accelerance and the H1 and H2 estimates"
              onHover={(x) => setHoverF(x !== null && x >= 2 ? x : null)}
              cursorX={hoverF}
            >
              {MODES.map((f, i) => (
                <VLine key={f} x={f} label={`f${'₁₂₃₄'[i]}`} width={1} />
              ))}
              <Line points={xy(m.H)} color="var(--text-3)" width={3.2} opacity={0.6} />
              <Line points={xy(m.H2)} color="var(--m2)" width={1.4} dash="5 3" />
              <Line points={xy(m.H1)} color="var(--m1)" width={1.5} />
            </Plot>
            <Legend
              items={[
                { label: 'true FRF', color: 'var(--text-3)' },
                { label: 'H₁ = S_fx/S_ff', color: 'var(--m1)' },
                { label: 'H₂ = S_xx/S_xf', color: 'var(--m2)', dash: true },
              ]}
            />
            <Plot x={{ min: 0, max: FMAX, label: 'frequency (Hz)' }} y={{ min: 0, max: 1.05, label: 'coherence γ²', ticks: [0, 0.5, 0.9, 1] }} height={150} ariaLabel="Coherence against frequency" onHover={(x) => setHoverF(x !== null && x >= 2 ? x : null)} cursorX={hoverF}>
              <HLine y={0.9} />
              <Line points={xy(m.coh)} color="var(--text)" width={1.5} />
            </Plot>
            <Plot x={{ min: 0, max: FMAX, label: 'frequency (Hz)' }} y={{ min: 1e-4, max: 3, log: true, label: 'level (relative)' }} height={170} ariaLabel="Force and response signal levels against their noise floors">
              <Line points={xy(m.S)} color="var(--m2)" width={1.8} />
              <HLine y={nin} color="var(--m2)" label="force noise" />
              <Line points={xy(m.R)} color="var(--m1)" width={1.6} />
              <HLine y={nout} color="var(--m1)" label="sensor noise" />
            </Plot>
            <Legend
              items={[
                { label: 'force signal (1 = low-frequency level)', color: 'var(--m2)' },
                { label: 'response signal (1 = a typical peak)', color: 'var(--m1)' },
                { label: 'noise floors', color: 'var(--text-3)', dash: true },
              ]}
            />
            <p className="muted small">Where a signal sinks towards its noise floor, coherence drops: the response at anti-resonances, at nodes and at very low frequency (an accelerance grows as ω², so it starts near zero), and the force above a soft tip’s bandwidth.</p>
          </>
        }
        controls={
          <>
            <Segmented
              size="sm"
              label="Excitation"
              value={exc}
              onChange={setExc}
              options={[
                { value: 'shaker', label: 'Shaker' },
                { value: 'hard', label: 'Hard tip' },
                { value: 'soft', label: 'Soft tip' },
              ]}
            />
            <p className="muted small">{EXC_LABEL[exc]}</p>
            <Slider label="averages" tex="n_{avg}" tip="number of records averaged into the spectra" value={nAvg} min={1} max={100} log format={(v) => `${Math.round(v)}`} onChange={(v) => setNAvg(Math.max(1, Math.round(v)))} />
            <Slider label="force noise" tex="n_{in}" tip="input noise: RMS on the force signal, as a fraction of the force at low frequency" value={nin} min={0} max={0.6} step={0.01} format={(v) => `${Math.round(v * 100)} %`} onChange={setNin} />
            <Slider label="sensor noise" tex="n_{out}" tip="output noise: RMS on the response, as a fraction of a typical resonance peak" value={nout} min={0} max={0.1} step={0.001} format={(v) => `${fmt(v * 100, 2)} %`} onChange={setNout} />
            <Slider label="sensor at" tex="x_s/L" tip="accelerometer position along the beam (0 and 1 are the pinned supports)" value={xs} min={0} max={1} step={0.01} format={(v) => fmt(v, 2)} onChange={setXs} />
            <Slider label="exciter at" tex="x_f/L" tip="where the hammer strikes or the shaker pushes" value={xf} min={0} max={1} step={0.01} format={(v) => fmt(v, 2)} onChange={setXf} />
            <Button size="sm" onClick={() => setSeed((s) => s + 1)}>
              Measure again (new noise)
            </Button>
            <Readouts>
              <Readout tex="f" tip="frequency under the cursor (hover a plot)" value={LINES[ci]} unit="Hz" sig={4} />
              <Readout tex="|A|" tip="true accelerance at f" value={m.H[ci]} unit="(m/s²)/N" sig={3} />
              <Readout tex="|H_1|" tip="H1 = S_fx/S_ff: unbiased by sensor noise" value={m.H1[ci]} unit="(m/s²)/N" sig={3} tone="m1" />
              <Readout tex="|H_2|" tip="H2 = S_xx/S_xf: unbiased by force noise" value={m.H2[ci]} unit="(m/s²)/N" sig={3} tone="m2" />
              <Readout tex="\gamma^2" tip="coherence |S_xf|²/(S_ff S_xx) = |H1/H2|" value={m.coh[ci]} sig={3} tone={m.coh[ci] >= 0.9 ? 'ok' : 'bad'} />
            </Readouts>
            <div className="row gap-s wrap">
              <span className="muted small">Presets:</span>
              <Button size="sm" onClick={() => preset({ nin: 0, nout: 0, nAvg: 20, xs: 0.4, xf: 0.4, exc: 'hard' })}>
                Noise-free
              </Button>
              <Button size="sm" onClick={() => preset({ nin: 0, nout: 0.03, nAvg: 50, xs: 0.4, xf: 0.4, exc: 'hard' })}>
                Sensor noise only
              </Button>
              <Button size="sm" onClick={() => preset({ nin: 0.5, nout: 0, nAvg: 50, xs: 0.4, xf: 0.4, exc: 'hard' })}>
                Force noise only
              </Button>
              <Button size="sm" onClick={() => preset({ nin: 0.5, nout: 0.05, nAvg: 1 })}>
                One average
              </Button>
              <Button size="sm" onClick={() => preset({ exc: 'soft', xs: 0.4, xf: 0.15, nAvg: 20, nin: 0.1, nout: 0.01 })}>
                2023 A3.5: soft tip
              </Button>
              <Button size="sm" onClick={() => preset({ xs: 0, xf: 0.5, exc: 'shaker', nAvg: 20, nin: 0.1, nout: 0.01 })}>
                2024 A3.5: sensor on a support
              </Button>
              <Button size="sm" onClick={() => preset({ xs: 0.25, xf: 0.5, exc: 'shaker', nAvg: 20, nin: 0.1, nout: 0.01 })}>
                2024 A3.5: shaker at mid-span
              </Button>
            </div>
          </>
        }
      />
      <PredictReveal
        id="c3-coh-output"
        question="Remove the force noise and add sensor (output) noise. Which estimate stays on the true FRF?"
        options={['H₁', 'H₂', 'Neither']}
        answer={0}
        explain="$H_1 = S_{fx}/S_{ff}$ contains no $S_{xx}$, so sensor noise averages out of it. $H_2 = S_{xx}/S_{xf}$ carries the noise power in its numerator and shoots up wherever the response is small: at the anti-resonances, exactly where the coherence dips (LC3-8)."
        tryIt="press ‘Sensor noise only’ and compare the two estimates at the anti-resonances."
        onApply={() => preset({ nin: 0, nout: 0.03, nAvg: 50, xs: 0.4, xf: 0.4, exc: 'hard' })}
      />
      <PredictReveal
        id="c3-coh-input"
        question="Now put the noise on the force only (50 % RMS). Which way does H₁ move?"
        options={['Up', 'Down, at every frequency', 'It stays on the true FRF']}
        answer={1}
        explain="The noise power adds to $S_{ff}$ in $H_1$’s denominator: $|H_1| = |H|/(1 + q_{in})$ = $|H|/1.25$ = 0.8$|H|$, at every frequency. $H_2$ stays on the truth, and the coherence settles near 0.8 (Week 12 Q5)."
        tryIt="press ‘Force noise only’."
        onApply={() => preset({ nin: 0.5, nout: 0, nAvg: 50, xs: 0.4, xf: 0.4, exc: 'hard' })}
      />
      <PredictReveal
        id="c3-coh-single"
        question="Heavy noise on both channels, but only **one** average. What does the coherence show?"
        options={['About 0', 'About 0.5', 'Exactly 1 at every frequency']}
        answer={2}
        explain="With one record $|S_{xf}|^2 = |F|^2|X|^2/\Delta f^2 = S_{ff}S_{xx}$, so $\gamma^2 \equiv 1$ whatever the noise. Coherence only means something once several records are averaged; raise the averages and watch it fall to its true level."
        tryIt="press ‘One average’, then raise the averages."
        onApply={() => preset({ nin: 0.5, nout: 0.05, nAvg: 1 })}
      />
      <PredictReveal
        id="c3-coh-support"
        question="Move the accelerometer onto a pinned support ($x_s$ = 0). What happens to the coherence?"
        options={['Nothing changes', 'It drops at the resonances only', 'It falls to about 0 at every frequency']}
        answer={2}
        explain="The support is a node of every mode: the beam never moves there, so the sensor records only noise, uncorrelated with the force. $\gamma^2 \approx 0$ at all frequencies (2024 A3.5(a)). No estimator can rescue a sensor in the wrong place (LC3-8)."
        tryIt="drag the sensor position to 0."
        onApply={() => preset({ xs: 0, xf: 0.5, exc: 'shaker', nAvg: 20 })}
      />
      <PredictReveal
        id="c3-coh-soft"
        question="Swap the hard tip for a soft one (contact time about 4 ms). Where does the coherence suffer?"
        options={['At low frequencies', 'Above roughly 250 Hz', 'Equally everywhere']}
        answer={1}
        explain="A contact time $\tau$ puts in force up to roughly $1/\tau$ = 250 Hz (the first spectral zero is at $1.5/\tau$ = 375 Hz). Above that the force sinks into its noise floor, so both signals are mostly noise and the coherence collapses, exactly as in 2023 A3.5. A hard tip excites the whole band."
        tryIt="press ‘2023 A3.5: soft tip’ and look at the force level plot."
        onApply={() => preset({ exc: 'soft', xs: 0.4, xf: 0.15, nAvg: 20, nin: 0.1, nout: 0.01 })}
      />
    </div>
  );
}
