// The same uniform rod in axial and torsional vibration (and, for contrast, bending): G < E puts torsion first,
// the diameter cancels from both, and only bending depends on the geometry (official 2016 B1.6, 2018/2019 B1.5).
import { useRef, useState } from 'react';
import { waveOmegas, type WaveBC } from '../../../physics/waves';
import { frequencyRatios } from '../../../physics/beams';
import { useRaf } from '../../../anim/hooks';
import { Line, Plot, PlotText } from '../../../plot/Plot';
import { Legend, Readout, Readouts, Segmented, SimLayout, Slider, modeColor } from '../../../ui/kit';
import { PredictReveal } from '../../../ui/PredictReveal';
import { Rich } from '../../../ui/Rich';
import { BEAM_OF, MATERIALS, solidRodBendingOmega1, torsionAxialRatio } from '../physics';
import { MemberView, type MemberApi } from './MemberView';

const COLS = ['', 'torsion', 'axial', 'bending'];
const TAU = 2 * Math.PI;
const fmtHz = (x: number) => (x >= 100 ? x.toFixed(0) : x >= 10 ? x.toFixed(1) : x.toPrecision(3));

export default function AxialTorsion() {
  const [E, setE] = useState(210); // GPa
  const [rho, setRho] = useState(7850); // kg/m^3
  const [nu, setNu] = useState(0.3);
  const [bc, setBc] = useState<WaveBC>('fixed-free');
  const [L, setL] = useState(2); // m
  const [d, setD] = useState(50); // mm
  const G = E / (2 * (1 + nu));
  const cA = Math.sqrt((E * 1e9) / rho);
  const k = torsionAxialRatio(nu);
  const cT = cA * k;
  const fA = waveOmegas(bc, cA, L, 3).map((w) => w / TAU);
  const fT = waveOmegas(bc, cT, L, 3).map((w) => w / TAU);
  const fB1 = solidRodBendingOmega1(bc, E * 1e9, rho, d / 1000, L) / TAU;
  const fB = frequencyRatios(BEAM_OF[bc], 3).map((r) => r * fB1);
  const preset = MATERIALS.find((m) => Math.abs(m.E / 1e9 - E) < 1e-6 && Math.abs(m.rho - rho) < 1e-6 && Math.abs(m.nu - nu) < 1e-9)?.id ?? 'custom';
  const all = [...fA, ...fT, ...fB];
  const lo = 10 ** Math.floor(Math.log10(Math.min(...all) * 0.7));
  const hi = 10 ** Math.ceil(Math.log10(Math.max(...all) * 1.4));
  const order = [
    { name: 'torsion', f: fT[0] },
    { name: 'axial', f: fA[0] },
    { name: 'bending', f: fB[0] },
  ].sort((p, q) => p.f - q.f);

  // ---- animation: the same mode-1 shape, axial at 0.75 Hz on screen and torsion slower by the true ratio
  const wrapRef = useRef<HTMLDivElement>(null);
  const rodRef = useRef<MemberApi>(null);
  const shaftRef = useRef<MemberApi>(null);
  const t = useRef(0);
  const left = bc === 'free-free' ? 'free' : 'fixed';
  const right = bc === 'fixed-fixed' ? 'fixed' : 'free';
  const shape = (xi: number) => (bc === 'fixed-fixed' ? Math.sin(Math.PI * xi) : bc === 'fixed-free' ? Math.sin((Math.PI * xi) / 2) : Math.cos(Math.PI * xi));
  const nodes = bc === 'free-free' ? [0.5] : [];
  useRaf(
    (dt) => {
      t.current += dt;
      const aA = Math.cos(TAU * 0.75 * t.current);
      const aT = Math.cos(TAU * 0.75 * k * t.current);
      rodRef.current?.draw((xi) => aA * shape(xi));
      shaftRef.current?.draw((xi) => aT * shape(xi));
    },
    true,
    wrapRef
  );

  const applyMat = (id: string) => {
    const m = MATERIALS.find((x) => x.id === id);
    if (!m) return;
    setE(m.E / 1e9);
    setRho(m.rho);
    setNu(m.nu);
  };
  // Torsional f1 for aluminium and titanium at the current length and ends (for the prediction's explanation).
  const fT1For = (id: string) => {
    const m = MATERIALS.find((x) => x.id === id)!;
    return waveOmegas(bc, Math.sqrt(m.E / m.rho) * torsionAxialRatio(m.nu), L, 1)[0] / TAU;
  };

  return (
    <div ref={wrapRef}>
      <SimLayout
        visual={
          <>
            <Plot
              x={{ min: 0.4, max: 3.6, ticks: [1, 2, 3], format: (v) => COLS[Math.round(v)] ?? '', noGrid: true }}
              y={{ min: lo, max: hi, log: true, label: 'natural frequency (Hz)' }}
              height={270}
              ariaLabel="Frequency ladders for torsion, axial and bending vibration of the same rod"
            >
              {[fT, fA, fB].map((col, j) =>
                col.map((fv, i) => <Line key={`${j}-${i}`} points={[[j + 1 - 0.3, fv], [j + 1 + 0.3, fv]]} color={modeColor(i + 1)} width={i === 0 ? 4 : 2.6} />)
              )}
              {[fT[0], fA[0], fB[0]].map((fv, j) => (
                <PlotText key={j} x={j + 1} y={fv} anchor="middle" dy={16}>
                  {`f₁ = ${fmtHz(fv)} Hz`}
                </PlotText>
              ))}
            </Plot>
            <Legend
              items={[
                { label: 'mode 1', color: 'var(--m1)' },
                { label: 'mode 2', color: 'var(--m2)' },
                { label: 'mode 3', color: 'var(--m3)' },
              ]}
            />
            <MemberView ref={rodRef} member="rod" left={left} right={right} color="var(--m1)" nodes={nodes} label="Axial vibration, mode 1" caption={`axial, √(E/ρ): ${fmtHz(fA[0])} Hz`} />
            <MemberView ref={shaftRef} member="shaft" left={left} right={right} color="var(--m1)" nodes={nodes} label="Torsional vibration, mode 1" caption={`torsion, √(G/ρ): ${fmtHz(fT[0])} Hz`} />
            <Rich
              className="note"
              text={`Same rod, same ends, same mode shape: only the wave speed differs, so the torsional animation runs ${k.toFixed(3)} times as fast as the axial one (true ratio, slowed down). Order now: **${order.map((o) => o.name).join(' < ')}**.`}
            />
          </>
        }
        controls={
          <>
            <div>
              <div className="muted small">Material</div>
              <Segmented
                size="sm"
                label="Material"
                value={preset}
                onChange={applyMat}
                options={[...MATERIALS.map((m) => ({ value: m.id as string, label: m.label })), { value: 'custom', label: 'custom', title: 'move a slider below' }]}
              />
            </div>
            <Slider label="Young’s modulus" tex="E" tip="Young’s modulus (GPa): sets the axial wave speed √(E/ρ)" value={E} min={10} max={400} step={1} unit="GPa" onChange={setE} />
            <Slider label="density" tex="\rho" tip="density (kg/m³)" value={rho} min={1000} max={20000} log unit="kg/m³" onChange={setRho} />
            <Slider label="Poisson’s ratio" tex="\nu" tip="Poisson’s ratio: G = E/2(1+ν)" value={nu} min={0} max={0.5} step={0.01} sig={2} onChange={setNu} />
            <div>
              <div className="muted small">Ends</div>
              <Segmented
                label="End conditions"
                value={bc}
                onChange={setBc}
                options={[
                  { value: 'fixed-fixed', label: 'fixed–fixed' },
                  { value: 'fixed-free', label: 'fixed–free' },
                  { value: 'free-free', label: 'free–free' },
                ]}
              />
            </div>
            <Slider label="length" tex="L" tip="rod length (m)" value={L} min={0.2} max={100} log unit="m" onChange={setL} />
            <Slider label="diameter" tex="d" tip="solid circular section (mm): watch which frequencies it changes" value={d} min={5} max={1000} log unit="mm" onChange={setD} />
            <Readouts>
              <Readout tex="G" tip="shear modulus E/2(1+ν)" value={G} unit="GPa" sig={3} />
              <Readout tex="c_A" tip="axial wave speed √(E/ρ)" value={cA} unit="m/s" />
              <Readout tex="c_T" tip="torsional wave speed √(G/ρ)" value={cT} unit="m/s" />
              <Readout tex="f_{T1}/f_{A1}" tip="1/√(2(1+ν)): always below 1 for real materials" value={k} sig={3} tone="accent" />
              <Readout tex="f_{A1}" tip="axial fundamental" value={fA[0]} unit="Hz" tone="m1" />
              <Readout tex="f_{T1}" tip="torsional fundamental" value={fT[0]} unit="Hz" tone="m1" />
              <Readout tex="f_{B1}" tip="bending fundamental (Euler–Bernoulli, solid round rod; fixed = clamped)" value={fB[0]} unit="Hz" tone="m1" />
              <Readout tex="L/d" tip="slenderness" value={L / (d / 1000)} sig={3} />
            </Readouts>
            <Rich className="note" text="Axial and torsion: $f_n \propto c/L$, no $d$. Bending of a solid rod: $\omega_1 = (\beta_1L)^2\,\dfrac{d}{4}\,\dfrac{\sqrt{E/\rho}}{L^2}$, so it scales with $d/L^2$ and can sit anywhere in the ladder." />
          </>
        }
      />
      <PredictReveal
        id="b2-at-ratio"
        question="A steel bar ($\nu$ = 0.3), same ends for both. Which fundamental is lower, and by what factor?"
        options={['Axial, × 0.62', 'Torsional, × 0.62', 'Torsional, × 0.38', 'They are equal']}
        answer={1}
        explain="$f_T/f_A = \sqrt{G/E} = 1/\sqrt{2(1+\nu)} = 0.620$. This is why torsional resonance is met first as a motor shaft runs up (reader quiz Q1(i)), and why the official 2018/2019 B1.5 answer starts “Torsional, Axial”."
        tryIt="pick Steel and compare the two ladders."
        onApply={() => applyMat('steel')}
      />
      <PredictReveal
        id="b2-at-diameter"
        question="Double the diameter. What happens to the torsional and the bending fundamentals?"
        options={['Both double', 'Torsional unchanged, bending doubles', 'Both unchanged', 'Torsional doubles, bending unchanged']}
        answer={1}
        explain="Torsion: $J$ multiplies both the stiffness $GJ$ and the inertia $\rho J$, so it cancels (2021 B2.3, 2022 B1.4(a)). Bending: $\omega \propto \sqrt{EI/\rho A} \propto d$ for a solid rod. That is why the bending position “depends on the geometry”."
        tryIt="read the readouts, then double d."
        onApply={() => setD((v) => Math.min(1000, v * 2))}
      />
      <PredictReveal
        id="b2-at-titanium"
        question="Swap aluminium (72 GPa) for the much stiffer titanium (114 GPa). The torsional fundamental…"
        options={['rises by about 26 %', 'rises by about 58 %', 'does not change', 'falls']}
        answer={2}
        explain={`Titanium is denser too: $G/\\rho$ = 9.74 × 10⁶ m²/s² for both alloys (tutorial W7.2), so the torsional frequencies are identical (here ${fmtHz(fT1For('aluminium'))} Hz and ${fmtHz(fT1For('titanium'))} Hz) and the axial ones rise by only 0.4 %. “A stiffer material always gives higher frequencies” is false.`}
        tryIt="pick Aluminium, note f_T1, then pick Titanium."
        onApply={() => applyMat('titanium')}
      />
      <PredictReveal
        id="b2-at-nu"
        question="Could any real material ($0 \le \nu \le 0.5$) have a torsional fundamental above its axial one?"
        options={['Yes, if ν is close to 0.5', 'Yes, if ν is close to 0', 'No']}
        answer={2}
        explain="The ratio $1/\sqrt{2(1+\nu)}$ is largest at $\nu = 0$, where it is only 0.707 (0.577 at $\nu = 0.5$). Torsion above axial would need $\nu < -0.5$, i.e. $G > E$ (official 2016 B1.6(d) true, (e) false)."
        tryIt="drag ν from 0 to 0.5 and watch the ratio."
        onApply={() => setNu(0)}
      />
    </div>
  );
}
