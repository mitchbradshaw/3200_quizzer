// Damped absorber (tuned mass damper): primary amplitude against g = Ω/ω11 for absorber damping ζ = c2/(2 m2 ω11)
// (LC4 §3.5, Rao 9.11.2). Shows the filled-in anti-resonance, the peaks drifting together and merging, the
// locked limit at 1/√(1 + μ), the Den Hartog fixed points P and Q, and the 2021 A1.4 sizing consequence.
// A second plot tracks the peak and dip frequencies against ζ (the dip meets one peak at a fold).
import { useDeferredValue, useMemo, useState } from 'react';
import { denHartogFixedPoints, denHartogOptimum, primaryAmplitude } from '../../../physics/absorber';
import { Band, Dot, HBand, HLine, Handle, Line, Plot, VLine, sample } from '../../../plot/Plot';
import { Button, Callout, Legend, Readout, Readouts, Segmented, SimLayout, Slider, Toggle } from '../../../ui/kit';
import { PredictReveal } from '../../../ui/PredictReveal';
import { Rich } from '../../../ui/Rich';
import HaloText from './HaloText';
import { featureGrid, ladderCeil, lockedAmplitude, minMuForLowerPeak, newFrequenciesG, peakBranches, primaryPeaks } from '../physics';
import { fmt } from '../../../engine/format';

type Mode = 'zero' | 'set' | 'inf';
const FAMILY = [0.02, 0.05, 0.2, 0.5];
const FAMILY_DASH = '1.5 3';
const Z_LO = 0.005;
const Z_HI = 2;

export default function AbsorberDamping() {
  const [mu, setMu] = useState(0.05);
  const [beta, setBeta] = useState(1);
  const [mode, setMode] = useState<Mode>('set');
  const [zeta, setZeta] = useState(0.1);
  const [family, setFamily] = useState(true);
  const [band, setBand] = useState(false);

  const z = mode === 'zero' ? 0 : mode === 'inf' ? Infinity : zeta;
  const [g1, g2] = newFrequenciesG(mu, beta);
  const gL = 1 / Math.sqrt(1 + mu);
  const gLo = Math.max(0.05, Math.floor(Math.min(0.8 * g1, 0.9 * gL) * 20) / 20);
  const gHi = Math.ceil(1.15 * g2 * 20) / 20;
  const fp = denHartogFixedPoints(mu, beta);
  const yMax = Math.max(5, ladderCeil(2 * Math.max(fp.amp[0], fp.amp[1])));
  const opt = denHartogOptimum(mu);
  const f3 = (v: number) => fmt(v, 3);
  const gStep = gHi - gLo > 0.85 ? 0.2 : 0.1;
  const gTicks: number[] = [];
  for (let v = Math.ceil(gLo / gStep - 1e-9) * gStep; v <= gHi + 1e-9; v += gStep) gTicks.push(Number(v.toFixed(2)));
  const gFormat = (v: number) => fmt(v, 3);

  const refs = useMemo(() => {
    const xs = featureGrid(gLo, gHi, 500, [g1, g2, beta, gL]);
    const und = new Float64Array(xs.length);
    const lock = new Float64Array(xs.length);
    for (let i = 0; i < xs.length; i++) {
      und[i] = primaryAmplitude(mu, beta, xs[i], 0);
      lock[i] = lockedAmplitude(mu, xs[i]);
    }
    const fam = FAMILY.map((zz) => sample((g) => primaryAmplitude(mu, beta, g, zz), gLo, gHi, 420));
    return { und: { x: xs, y: und }, lock: { x: xs, y: lock }, fam };
  }, [mu, beta, gLo, gHi, g1, g2, gL]);

  // Peak/dip branches against ζ: the heaviest computation here, so it follows the sliders with a deferred value.
  const muD = useDeferredValue(mu);
  const betaD = useDeferredValue(beta);
  const branches = useMemo(() => {
    const [a] = newFrequenciesG(muD, betaD);
    const gl = 1 / Math.sqrt(1 + muD);
    const lo = Math.max(0.05, Math.floor(Math.min(0.8 * a, 0.9 * gl) * 20) / 20);
    const hi = Math.ceil(1.15 * newFrequenciesG(muD, betaD)[1] * 20) / 20;
    return peakBranches(muD, betaD, lo, hi, Z_LO, Z_HI, 80);
  }, [muD, betaD]);

  const cur = useMemo(() => (mode === 'set' ? sample((g) => primaryAmplitude(mu, beta, g, zeta), gLo, gHi, 700) : null), [mu, beta, zeta, mode, gLo, gHi]);
  const peaks = useMemo(() => primaryPeaks(mu, beta, z, gLo, gHi, 600), [mu, beta, z, gLo, gHi]);
  const peaksSet = useMemo(() => (mode === 'set' ? peaks : primaryPeaks(mu, beta, zeta, gLo, gHi, 600)), [mode, peaks, mu, beta, zeta, gLo, gHi]);
  const muNeed = useMemo(() => (band ? minMuForLowerPeak(z, 0.7) : NaN), [band, z]);
  const at1 = mode === 'zero' ? (Math.abs(beta - 1) < 1e-12 ? 0 : primaryAmplitude(mu, beta, 1, 0)) : mode === 'inf' ? lockedAmplitude(mu, 1) : primaryAmplitude(mu, beta, 1, zeta);
  const finite = peaks.filter((p) => Number.isFinite(p.amp));
  // After the fold the surviving peak belongs to the branch that started at the lower resonance (mode 1) unless the
  // dip met the lower peak instead.
  const survivorColor = branches.fold?.branch === 'lower' ? 'var(--m2)' : 'var(--m1)';
  const peakColor = (i: number, n: number) => (n > 1 ? (i === 0 ? 'var(--m1)' : 'var(--m2)') : survivorColor);

  const preset = (m: number, b: number, md: Mode, zz: number, bd: boolean) => {
    setMu(m);
    setBeta(b);
    setMode(md);
    setZeta(zz);
    setBand(bd);
  };

  const foldTxt = branches.fold
    ? `The dip (the filled-in zero, from $g = \\beta$) moves to meet the ${branches.fold.branch} peak; at $\\zeta \\approx$ ${f3(branches.fold.z)} both vanish and one peak is left, heading for the locked value $1/\\sqrt{1+\\mu}$ = ${f3(gL)}.`
    : `One peak throughout this range, heading for the locked value $1/\\sqrt{1+\\mu}$ = ${f3(gL)}.`;

  return (
    <div>
      <SimLayout
        visual={
          <>
            <Plot
              x={{ min: gLo, max: gHi, label: 'g = Ω/ω₁₁ (forcing / primary frequency)', ticks: gTicks, format: gFormat }}
              y={{ min: 0, max: yMax, label: '|X₁| / (F₀/k₁)' }}
              height={290}
              ariaLabel="Primary amplitude against forcing frequency for several absorber damping values"
            >
              {band && <Band x0={0.7} x1={1.3} color="var(--warn)" opacity={0.12} label="±30 %" />}
              <VLine x={1} color="var(--text-3)" label="ω₁₁" />
              {Math.abs(beta - 1) > 0.002 && <VLine x={beta} color="var(--text-3)" dash="2 3" label="ω₂₂" labelY="bottom" />}
              {family && refs.fam.map((pts, i) => <Line key={i} points={pts} color="var(--text-3)" width={1.1} dash={FAMILY_DASH} />)}
              <Line points={refs.und} color="var(--text-2)" width={mode === 'zero' ? 2.4 : 1.3} opacity={mode === 'zero' ? 1 : 0.75} />
              <Line points={refs.lock} color="var(--text-2)" dash width={mode === 'inf' ? 2.4 : 1.3} opacity={mode === 'inf' ? 1 : 0.75} />
              {cur && <Line points={cur} color="var(--text)" width={2.5} />}
              <Dot x={fp.g[0]} y={fp.amp[0]} hollow color="var(--text-2)" />
              <Dot x={fp.g[1]} y={fp.amp[1]} hollow color="var(--text-2)" />
              {finite.map((pk, i) => (
                <Dot key={i} x={pk.g} y={Math.min(pk.amp, yMax * 0.98)} r={4} color={peakColor(i, finite.length)} />
              ))}
              {/* Every curve passes through P and Q, so every peak is at least as high as both: labels placed below
                  the higher point and just above the lower one never sit on a peak dot. */}
              <HaloText x={fp.g[0]} y={Math.min(fp.amp[0], yMax)} dy={fp.amp[0] >= fp.amp[1] ? 21 : -9} anchor="middle" color="var(--text)" size={13}>
                P
              </HaloText>
              <HaloText x={fp.g[1]} y={Math.min(fp.amp[1], yMax)} dy={fp.amp[1] > fp.amp[0] ? 21 : -9} anchor="middle" color="var(--text)" size={13}>
                Q
              </HaloText>
            </Plot>
            <div className="legend">
              {[
                { label: mode === 'set' ? `ζ = ${f3(zeta)}` : mode === 'zero' ? 'ζ = 0 (current)' : 'ζ → ∞ (current)', color: 'var(--text)', dash: undefined },
                { label: 'ζ = 0: spikes and a true zero', color: 'var(--text-2)', dash: undefined },
                { label: 'ζ → ∞: absorber locked', color: 'var(--text-2)', dash: '6 4' },
                ...(family ? [{ label: 'ζ = 0.02, 0.05, 0.2, 0.5', color: 'var(--text-3)', dash: FAMILY_DASH }] : []),
              ].map((it, i) => (
                <span key={i} className="legend-item">
                  <svg width="22" height="10" aria-hidden="true">
                    <line x1="1" y1="5" x2="21" y2="5" stroke={it.color} strokeWidth="2.2" strokeDasharray={it.dash} />
                  </svg>
                  {it.label}
                </span>
              ))}
            </div>
            <p className="muted small">
              Every curve for the same μ and β passes through the fixed points P and Q. Coloured dots: the peaks of the current curve (lower peak in mode-1 colour, upper in mode-2 colour).
            </p>
            <Plot
              x={{ min: Z_LO, max: Z_HI, log: true, label: 'absorber damping ζ (log scale)' }}
              y={{ min: gLo, max: gHi, label: 'g of peaks and dip', ticks: gTicks, format: gFormat }}
              height={215}
              ariaLabel="Frequencies of the two peaks and the dip against absorber damping"
            >
              {band && <HBand y0={0.7} y1={Math.min(1.3, gHi)} color="var(--warn)" opacity={0.12} />}
              {band && <HLine y={0.7} color="var(--warn)" label="0.70 limit (2021)" />}
              <HLine y={gL} color="var(--text-2)" dash label="locked 1/√(1+μ)" />
              <Line points={branches.dip} color="var(--text-3)" dash="5 3" width={1.8} />
              <Line points={branches.lower} color="var(--m1)" width={2.4} />
              <Line points={branches.upper} color="var(--m2)" width={2.4} />
              {branches.fold && <Dot x={branches.fold.z} y={branches.fold.g} hollow r={4} color="var(--text-2)" />}
              {branches.fold && (
                <HaloText x={branches.fold.z} y={branches.fold.g} dx={8} dy={branches.fold.branch === 'upper' ? 4 : 12}>
                  peak meets dip
                </HaloText>
              )}
              {mode === 'set' && <VLine x={zeta} color="var(--accent)" dash={false} width={1.2} />}
              {mode === 'set' && finite.map((pk, i) => <Dot key={i} x={zeta} y={pk.g} r={3.5} color={peakColor(i, finite.length)} />)}
              {peaksSet[0] && (
                <Handle
                  x={zeta}
                  y={peaksSet[0].g}
                  axis="x"
                  clampX={[Z_LO, Z_HI]}
                  onChange={(x) => {
                    setMode('set');
                    setZeta(x);
                  }}
                  color="var(--accent)"
                  ariaLabel="absorber damping ζ (drag along the lower branch)"
                />
              )}
            </Plot>
            <Legend
              items={[
                { label: 'lower peak', color: 'var(--m1)' },
                { label: 'upper peak', color: 'var(--m2)' },
                { label: 'dip (filled-in zero)', color: 'var(--text-3)', dash: true },
              ]}
            />
            <Rich className="note" text={`Lower plot: where the peaks sit as $\\zeta$ grows (drag the ring to set $\\zeta$). ${foldTxt}`} />
          </>
        }
        controls={
          <>
            <Segmented
              label="Absorber damping"
              value={mode}
              onChange={setMode}
              options={[
                { value: 'zero', label: 'ζ = 0' },
                { value: 'set', label: 'set ζ' },
                { value: 'inf', label: 'ζ → ∞' },
              ]}
            />
            <Slider label="absorber damping" tex="\zeta" tip="ζ = c₂/(2m₂ω₁₁): LC4 / Rao normalisation by the primary frequency (dimensionless)" value={zeta} min={Z_LO} max={Z_HI} log sig={3} disabled={mode !== 'set'} onChange={setZeta} />
            <Slider label="mass ratio" tex="\mu" tip="μ = m₂/m₁ (dimensionless)" value={mu} min={0.01} max={0.8} log sig={3} onChange={setMu} />
            <Slider label="tuning" tex="\beta" tip="β = ω₂₂/ω₁₁ = √(k₂/m₂)/√(k₁/m₁) (dimensionless)" value={beta} min={0.8} max={1.2} step={0.001} sig={4} onChange={setBeta} />
            <Toggle checked={family} onChange={setFamily} label="show a family of damping values" />
            <Readouts>
              <Readout tex="g_P" tip="lower fixed point P, as a fraction of ω₁₁: shared by every damping value" value={fp.g[0]} unit="ω₁₁" sig={4} />
              <Readout label="P height" tip="|X₁| at P in static deflections F₀/k₁ (= 1/|1 − (1 + μ)g²|)" value={fp.amp[0]} unit="F₀/k₁" sig={3} />
              <Readout tex="g_Q" tip="upper fixed point Q, as a fraction of ω₁₁" value={fp.g[1]} unit="ω₁₁" sig={4} />
              <Readout label="Q height" tip="|X₁| at Q in static deflections F₀/k₁" value={fp.amp[1]} unit="F₀/k₁" sig={3} />
              <Readout label="lower peak" tip="frequency of the lower (or only) peak of the current curve, as a fraction of ω₁₁" value={peaks[0]?.g} unit="ω₁₁" sig={4} tone="m1" />
              <Readout label="its height" tip="|X₁| at the lower peak, in static deflections F₀/k₁" value={peaks[0]?.amp} unit="F₀/k₁" sig={3} text={peaks[0] && !Number.isFinite(peaks[0].amp) ? '∞' : undefined} />
              <Readout label="upper peak" tip="frequency of the upper peak of the current curve (after merging: none)" value={peaks[1]?.g} unit="ω₁₁" sig={4} tone="m2" text={peaks.length < 2 ? 'merged' : undefined} />
              <Readout label="at g = 1" tip="primary amplitude at the old resonance, in F₀/k₁ (zero only if ζ = 0 and β = 1)" value={at1} unit="F₀/k₁" sig={3} />
              <Readout label="one peak above" tip="absorber damping ζ at which the dip meets a peak and the two-peak shape disappears" value={branches.fold?.z} sig={3} text={branches.fold ? `ζ ≈ ${f3(branches.fold.z)}` : '—'} />
            </Readouts>
            {band && (
              <Readouts>
                <Readout label="lower peak below Ω" tip="(1 − g_peak) × 100: must be ≥ 30 % in the 2021 design" value={(1 - (peaks[0]?.g ?? 1)) * 100} unit="%" sig={3} tone={(peaks[0]?.g ?? 1) <= 0.7 + 1e-6 ? 'ok' : 'bad'} />
                <Readout tex="\mu_{need}" tip="smallest μ of a tuned absorber (β = 1) whose lower peak stays at g ≤ 0.70 with this damping (2021 A1.4)" value={muNeed} sig={3} />
              </Readouts>
            )}
            <div className="row gap-s wrap">
              <span className="muted small">Presets:</span>
              <Button size="sm" onClick={() => preset(0.05, 1, 'set', 0.1, false)}>
                LC4 figure (μ = 0.05)
              </Button>
              <Button size="sm" onClick={() => preset(0.5308, 1, 'set', 0.2, true)}>
                2021: 30 % design + damping
              </Button>
              <Button size="sm" onClick={() => preset(mu, opt.beta, 'set', opt.zeta, band)}>
                Den Hartog optimum
              </Button>
            </div>
            <Callout kind="note">
              <Rich text={`Den Hartog's optimum (Rao 9.11.2, beyond the reader) detunes slightly, $\\beta = 1/(1+\\mu)$ = ${f3(opt.beta)}, so P and Q are equally high, then picks $\\zeta$ = ${f3(opt.zeta)} so the curve peaks there. Exams ask the qualitative effects.`} />
            </Callout>
          </>
        }
      />
      <PredictReveal
        id="a4-damp-zero"
        question="Start undamped and tuned ($\beta = 1$). Add a little absorber damping ($\zeta$ = 0.05). At $g = 1$, does the primary still stand perfectly still?"
        options={['yes, tuning still cancels the force exactly', 'no, it moves a little: the zero becomes a dip']}
        answer={1}
        explain="With a dashpot across $k_2$ the absorber force is $k_2 + i\Omega c_2$ times the relative motion, so it can no longer exactly cancel $F_0$: the anti-resonance fills in. **Complete suppression exists only without damping** (official 2018 A1.5(c); 2019 Q1h(c) is the false statement). In exchange the two new peaks become finite."
        tryIt="choose ζ = 0, then set ζ to 0.05 and read 'at g = 1'."
        onApply={() => preset(mu, 1, 'set', 0.05, band)}
      />
      <PredictReveal
        id="a4-damp-locked"
        question="The absorber's damper jams solid ($\zeta \to \infty$). Where does the primary now resonate?"
        options={['at g = 1, the old resonance', 'below it, at $g = 1/\\sqrt{1+\\mu}$', 'above it, at $g = \\sqrt{1+\\mu}$', 'nowhere: it is fully damped']}
        answer={1}
        explain="A rigid link makes $m_1 + m_2$ move as one mass on $k_1$: a single undamped peak at $\omega_{11}/\sqrt{1+\mu}$ (0.976 for $\mu$ = 0.05). Infinite damping dissipates nothing because the damper no longer moves. Useful damping is in between: in the lower plot the surviving peak creeps up to the locked line as $\zeta$ grows."
        tryIt="press ζ → ∞ and compare the dashed curve with the undamped one."
        onApply={() => setMode('inf')}
      />
      <PredictReveal
        id="a4-damp-fixed"
        question="Hold $\mu$ and $\beta$, and sweep $\zeta$ from 0 to ∞. What do all the curves have in common?"
        options={['their peaks', 'two points, P and Q, that every curve passes through', 'their value at g = 1', 'nothing']}
        answer={1}
        explain="At two frequencies $|X_1|$ does not depend on $\zeta$ (Den Hartog's fixed points; LC4 figure points A and B). For $\mu$ = 0.05, $\beta$ = 1 they are at $g$ = 0.919 (height 8.77) and 1.075 (4.67). No damping value can push the response below the higher of the two, which is why the optimum first equalises them by detuning."
        tryIt="turn on the family of damping values and look for the crossing points."
        onApply={() => {
          setFamily(true);
          preset(0.05, 1, 'set', 0.1, false);
        }}
      />
      <PredictReveal
        id="a4-damp-2021"
        question="A tuned absorber with $\mu$ = 0.531 puts both undamped resonances 30 % away. Damping $\zeta$ = 0.2 is added. Are both peaks still at least 30 % away?"
        options={['yes, damping only lowers the peaks', 'no, the peaks move inwards, so μ must grow', 'no, they move outwards']}
        answer={1}
        explain="The peaks drift towards $g = 1$: 0.706 and 1.39 at $\zeta$ = 0.2 (the lower is now only 29.4 % below). Keeping the lower peak at 0.70 needs $\mu \approx$ 0.555; at $\zeta$ = 0.5 about 0.685, and 1.04 when locked (2021 A1.4). 'Damping lowers the new resonances' (LC4) means lower **peaks**, not lower frequencies."
        tryIt="press the 2021 preset: in the lower plot the blue branch has crossed the 0.70 line; read 'μ need'."
        onApply={() => preset(0.5308, 1, 'set', 0.2, true)}
      />
    </div>
  );
}
