// Rayleigh (proportional) damping C = αM + βK: ζ(ω) = α/2ω + βω/2 (LA9 Eq 9.7). Set α and β directly, or drag two
// target points and let the app solve α + βωᵢ² = 2ζᵢωᵢ. The structure's natural frequencies are marked in mode colours.
import { useMemo, useState } from 'react';
import { Dot, Handle, Line, Plot, PlotText, VLine, sample } from '../../../plot/Plot';
import { Badge, Button, Legend, Readout, Readouts, Segmented, SimLayout, Slider } from '../../../ui/kit';
import { PredictReveal } from '../../../ui/PredictReveal';
import { Rich } from '../../../ui/Rich';
import { fmt, tex } from '../../../engine/format';
import { rayleighCoefficients, rayleighZeta } from '../../../physics/damped';

const W_MIN = 3;
const W_MAX = 300;
const Z_MAX = 0.1;

type Structure = 'frame' | 'belt';
type Ctrl = 'coef' | 'targets';
type Target = { w: number; z: number };

/** Three-storey shear frame, equal floor masses m and storey stiffnesses k with k/m = 2500 s⁻²: ωᵢ = 100 sin((2i−1)π/14). */
const FRAME_W = [1, 2, 3].map((i) => 100 * Math.sin(((2 * i - 1) * Math.PI) / 14));
/** Belt drive of official 2019 Q2 (sample data I_T = 0.05, I_P = 0.4 kg m², R₁ = 0.05, R₂ = 0.15 m, k = 20 kN/m): flexible mode only. */
const BELT_W = [Math.sqrt(2 * 2e4 * (0.05 ** 2 / 0.05 + 0.15 ** 2 / 0.4))];

export default function Rayleigh() {
  const [structure, setStructure] = useState<Structure>('frame');
  const [ctrl, setCtrl] = useState<Ctrl>('coef');
  const [alpha, setAlpha] = useState(0.3636);
  const [beta, setBeta] = useState(0.0003636);
  const [tA, setTA] = useState<Target>({ w: 10, z: 0.02 });
  const [tB, setTB] = useState<Target>({ w: 100, z: 0.02 });

  // In target mode α and β follow from the two targets (sorted by frequency).
  const fit = useMemo(() => {
    const [a, b] = tA.w <= tB.w ? [tA, tB] : [tB, tA];
    if (Math.abs(b.w - a.w) < 1e-6 * b.w) return null;
    return rayleighCoefficients(a.z, a.w, b.z, b.w);
  }, [tA, tB]);
  const al = ctrl === 'targets' && fit ? fit.alpha : alpha;
  const be = ctrl === 'targets' && fit ? fit.beta : beta;

  const curves = useMemo(
    () => ({
      total: sample((w) => rayleighZeta(al, be, w), W_MIN, W_MAX, 240, true),
      mass: sample((w) => al / (2 * w), W_MIN, W_MAX, 240, true),
      stiff: sample((w) => (be * w) / 2, W_MIN, W_MAX, 240, true),
    }),
    [al, be]
  );
  const ws = structure === 'frame' ? FRAME_W : BELT_W;
  const zs = ws.map((w) => rayleighZeta(al, be, w));
  const wStar = al > 0 && be > 0 ? Math.sqrt(al / be) : NaN;
  const zStar = al > 0 && be > 0 ? Math.sqrt(al * be) : NaN;

  const toTargets = () => {
    setTA({ w: 10, z: Math.min(Z_MAX, Math.max(0.001, rayleighZeta(alpha, beta, 10))) });
    setTB({ w: 100, z: Math.min(Z_MAX, Math.max(0.001, rayleighZeta(alpha, beta, 100))) });
    setCtrl('targets');
  };
  const toCoef = () => {
    setAlpha(Math.max(0, al));
    setBeta(Math.max(0, be));
    setCtrl('coef');
  };
  const coefPreset = (a: number, b: number, s: Structure = structure) => {
    setStructure(s);
    setAlpha(a);
    setBeta(b);
    setCtrl('coef');
  };
  const targetPreset = (A: Target, B: Target) => {
    setTA(A);
    setTB(B);
    setCtrl('targets');
  };

  const bad = ctrl === 'targets' && fit && (fit.alpha < -1e-9 || fit.beta < -1e-12);

  return (
    <div>
      <SimLayout
        visual={
          <>
            <Plot
              x={{ min: W_MIN, max: W_MAX, log: true, label: 'natural frequency ω (rad/s, log scale)' }}
              y={{ min: 0, max: Z_MAX, label: 'modal damping ratio ζ' }}
              height={330}
              ariaLabel="Damping ratio against frequency for Rayleigh damping, with its mass and stiffness parts and the structure's natural frequencies"
            >
              {ws.map((w, i) => (
                <VLine key={i} x={w} color={`var(--m${i + 1})`} label={structure === 'frame' ? `ω${'₁₂₃'[i]}` : 'ωₙ'} />
              ))}
              <Line points={curves.mass} color="var(--text-3)" width={1.5} dash="5 4" />
              <Line points={curves.stiff} color="var(--text-3)" width={1.5} dash="2 3" />
              <Line points={curves.total} color="var(--text)" width={2.6} />
              {al > 0 && al / (2 * 4.5) < Z_MAX * 0.95 && (
                <PlotText x={4.5} y={al / 9} dy={-6} color="var(--text-3)">
                  α/2ω
                </PlotText>
              )}
              {be > 0 && (be * 200) / 2 < Z_MAX * 0.95 && (
                <PlotText x={200} y={be * 100} dy={-6} anchor="end" color="var(--text-3)">
                  βω/2
                </PlotText>
              )}
              {Number.isFinite(wStar) && wStar > W_MIN && wStar < W_MAX && zStar < Z_MAX && <Dot x={wStar} y={zStar} hollow r={5} color="var(--text-2)" label="min" labelPos="above" />}
              {ws.map((w, i) => (
                <Dot key={i} x={w} y={zs[i]} r={6} color={`var(--m${i + 1})`} />
              ))}
              {ctrl === 'targets' && (
                <>
                  <Handle x={tA.w} y={tA.z} onChange={(w, z) => setTA({ w, z })} clampX={[W_MIN, W_MAX]} clampY={[0.001, Z_MAX]} label="target A" ariaLabel="Target A: frequency (left/right) and damping ratio (up/down)" />
                  <Handle x={tB.w} y={tB.z} onChange={(w, z) => setTB({ w, z })} clampX={[W_MIN, W_MAX]} clampY={[0.001, Z_MAX]} label="target B" ariaLabel="Target B: frequency (left/right) and damping ratio (up/down)" />
                </>
              )}
            </Plot>
            <Legend
              items={[
                { label: 'ζ(ω) = α/2ω + βω/2', color: 'var(--text)' },
                { label: 'mass part α/2ω', color: 'var(--text-3)', dash: true },
                { label: 'stiffness part βω/2', color: 'var(--text-3)', dash: true },
                ...ws.map((_, i) => ({ label: structure === 'frame' ? `mode ${i + 1}` : 'flexible mode', color: `var(--m${i + 1})` })),
              ]}
            />
            <Rich
              className="note"
              text={
                structure === 'frame'
                  ? 'Structure: a three-storey shear frame with equal floor masses and storey stiffnesses ($k/m$ = 2500 s⁻²), so $\\omega_i = 100\\sin\\frac{(2i-1)\\pi}{14}$ = 22.25, 62.35 and 90.10 rad/s. Rayleigh damping keeps its real mode shapes; each mode simply gets its own $\\zeta_i$.'
                  : 'Structure: the belt drive of official 2019 Q2 with sample data ($I_T$ = 0.05, $I_P$ = 0.4 kg m², $R_1$ = 0.05, $R_2$ = 0.15 m, $k$ = 20 kN/m per belt side): one flexible mode at 65.19 rad/s. Its rigid-body mode ($\\omega = 0$) stretches no belt, so $C \\propto K$ gives it no damping at all.'
              }
            />
          </>
        }
        controls={
          <>
            <Segmented<Structure>
              size="sm"
              label="Structure"
              value={structure}
              onChange={setStructure}
              options={[
                { value: 'frame', label: '3-storey frame' },
                { value: 'belt', label: 'Belt drive (2019 Q2)' },
              ]}
            />
            <Segmented<Ctrl>
              size="sm"
              label="How to set the damping"
              value={ctrl}
              onChange={(c) => (c === 'targets' ? toTargets() : toCoef())}
              options={[
                { value: 'coef', label: 'Set α and β' },
                { value: 'targets', label: 'Drag two targets' },
              ]}
            />
            {ctrl === 'coef' ? (
              <>
                <Slider label="mass coefficient" tex="\alpha" tip="mass-proportional coefficient α (1/s): C = αM + βK" value={alpha} min={0} max={4} step={0.01} unit="s⁻¹" onChange={setAlpha} />
                <Slider label="stiffness coeff." tex="\beta" tip="stiffness-proportional coefficient β (s, shown in ms): for dampers beside springs, β = c/k" value={beta} min={0} max={0.002} step={0.00001} format={(v) => `${fmt(v * 1000, 3)} ms`} onChange={setBeta} />
              </>
            ) : (
              <Rich
                className="note"
                text={`Each target imposes $\\alpha + \\beta\\omega^2 = 2\\zeta\\omega$: A gives $\\alpha + ${tex(tA.w ** 2, 4)}\\beta = ${tex(2 * tA.z * tA.w, 4)}$, B gives $\\alpha + ${tex(tB.w ** 2, 4)}\\beta = ${tex(2 * tB.z * tB.w, 4)}$ (ω in rad/s). Drag them, or use the arrow keys.`}
              />
            )}
            <Readouts>
              <Readout tex="\alpha" tip="mass coefficient (1/s)" value={al} unit="s⁻¹" sig={4} />
              <Readout tex="\beta" tip="stiffness coefficient β, here in milliseconds (1 ms = 0.001 s)" value={be * 1000} unit="ms" sig={4} />
              <Readout tex="\omega^*" tip="frequency of minimum damping √(α/β) (rad/s)" value={Number.isFinite(wStar) ? wStar : undefined} text={Number.isFinite(wStar) ? undefined : 'none'} unit="rad/s" />
              <Readout tex="\zeta_{min}" tip="minimum damping ratio √(αβ)" value={Number.isFinite(zStar) ? zStar : undefined} text={Number.isFinite(zStar) ? undefined : '—'} sig={3} />
              {ws.map((w, i) => (
                <Readout key={i} tex={structure === 'frame' ? `\\zeta_${i + 1}` : '\\zeta'} tip={`damping ratio of the mode at ${fmt(w, 4)} rad/s: α/2ω + βω/2`} value={zs[i]} sig={3} tone={`m${i + 1}` as 'm1' | 'm2' | 'm3'} />
              ))}
            </Readouts>
            {bad && (
              <Badge tone="bad">{fit!.alpha < 0 ? '✗ needs α < 0: ζ cannot fall faster than 1/ω' : '✗ needs β < 0: ζ cannot rise faster than ω'}</Badge>
            )}
            <div className="row gap-s wrap">
              <span className="muted small">Presets:</span>
              <Button size="sm" onClick={() => targetPreset({ w: 10, z: 0.02 }, { w: 100, z: 0.02 })}>
                ζ = 0.02 at 10 and 100 rad/s
              </Button>
              <Button size="sm" onClick={() => coefPreset(0, 0.001)}>
                Stiffness only, C = βK
              </Button>
              <Button size="sm" onClick={() => coefPreset(2, 0)}>
                Mass only, C = αM
              </Button>
              <Button size="sm" onClick={() => coefPreset(0, 0.0015, 'belt')}>
                Belt drive, c/k = 1.5 ms
              </Button>
            </div>
            <Rich className="note" text="Proportional damping is the only case where the undamped modes uncouple the damped equations: $P^TCP = \alpha P^TMP + \beta P^TKP$ is diagonal, so $2\zeta_i\omega_i = \alpha + \beta\omega_i^2$ (LA9 Eqs 9.4–9.7)." />
          </>
        }
      />
      <PredictReveal
        id="a6-ray-stiff"
        question="Set $\alpha = 0$ (dampers beside every spring with the same $c/k$, so $C = \beta K$). Which mode of the frame gets the **largest** damping ratio?"
        options={['Mode 1 (22.3 rad/s)', 'Mode 3 (90.1 rad/s)', 'All three get the same ζ']}
        answer={1}
        explain="With $\alpha = 0$, $\zeta_i = \beta\omega_i/2$ grows in proportion to frequency: for β = 1 ms, ζ = 0.011, 0.031 and 0.045. This is the official 2019 Q2(5) result $\zeta = (c/2k)\omega_n$: stiffness-type damping kills the high modes and leaves the low ones lightly damped."
        tryIt="press “Stiffness only, C = βK” and compare the three coloured dots."
        onApply={() => coefPreset(0, 0.001, 'frame')}
      />
      <PredictReveal
        id="a6-ray-mass"
        question="Now set $\beta = 0$ (mass-proportional only, $C = \alpha M$, like dampers from each mass to the ground with $c_i/m_i$ equal). Which mode gets the largest $\zeta$?"
        options={['Mode 1', 'Mode 3', 'All the same']}
        answer={0}
        explain="With $\beta = 0$, $\zeta_i = \alpha/(2\omega_i)$ falls as $1/\omega$: for α = 2 s⁻¹, ζ = 0.045, 0.016 and 0.011. Mass damping acts on the low modes; combining both parts lets you shape ζ at two frequencies."
        tryIt="press “Mass only, C = αM”."
        onApply={() => coefPreset(2, 0, 'frame')}
      />
      <PredictReveal
        id="a6-ray-dip"
        question="Choose α and β so that $\zeta = 0.02$ at both 10 and 100 rad/s. At 31.6 rad/s, between the two targets, is $\zeta$ above, equal to or below 0.02?"
        options={['Above 0.02', 'Exactly 0.02', 'Below 0.02']}
        answer={2}
        explain="$\alpha = 0.3636$ s⁻¹ and $\beta = 3.636\times10^{-4}$ s. The curve dips between the targets to its minimum at $\omega^* = \sqrt{\alpha/\beta} = 31.6$ rad/s, where $\zeta_{min} = \sqrt{\alpha\beta} = 0.0115$. So modes between the two design frequencies get **less** damping than the target, and modes outside them more."
        tryIt="press “ζ = 0.02 at 10 and 100 rad/s” and read ζ at the hollow minimum."
        onApply={() => targetPreset({ w: 10, z: 0.02 }, { w: 100, z: 0.02 })}
      />
    </div>
  );
}
