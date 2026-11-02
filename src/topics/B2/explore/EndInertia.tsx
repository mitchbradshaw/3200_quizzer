// A shaft fixed at one end with a disc at the other: z tan z = Ia/Ie (summary notes B2; Reader SP6; 2021 B2.5).
// Left: both sides of the frequency equation and its roots. Right: how the roots move as the disc grows,
// against the SDOF estimate sqrt(kt/Ie).
import { useMemo, useRef, useState } from 'react';
import { endInertiaRoots, polarMoment } from '../../../physics/waves';
import { useRaf } from '../../../anim/hooks';
import { Dot, HLine, Handle, Line, Plot, PlotText, VLine, sample } from '../../../plot/Plot';
import { Badge, Button, Callout, Legend, Readout, Readouts, Segmented, SimLayout, Slider, Toggle, modeColor } from '../../../ui/kit';
import { PredictReveal } from '../../../ui/PredictReveal';
import { Rich } from '../../../ui/Rich';
import { completeChallenge, useProgress } from '../../../app/store';
import { MemberView, type MemberApi } from './MemberView';
import { fmt } from '../../../engine/format';

/** Stiffness in N m/rad, kN m/rad or MN m/rad so the readout stays short. */
function stiffnessReadout(kt: number): { value: number; unit: string } {
  if (kt >= 1e6) return { value: kt / 1e6, unit: 'MN m/rad' };
  if (kt >= 1e3) return { value: kt / 1e3, unit: 'kN m/rad' };
  return { value: kt, unit: 'N m/rad' };
}

/** Signed percentage with two significant figures, e.g. +0.32 % or +0.00064 %. */
const signedPct = (x: number) => `${x >= 0 ? '+' : ''}${fmt(x, 2)} %`;

export const HALF_CHALLENGE = 'b2-half-f1';

const G = 80e9; // Pa (steel, Reader SP6)
const RHO = 7700; // kg/m^3
const C = Math.sqrt(G / RHO);
const TAU = 2 * Math.PI;
const D_SP6 = 1000 * (32e-4 / Math.PI) ** 0.25; // mm, gives J = 1e-4 m^4
const Z_MAX = 8.2;
const R_MIN = 1e-3; // Ie/Ia range of the locus plot
const R_MAX = 1e3;

export default function EndInertia() {
  const p = useProgress();
  const [d, setD] = useState(D_SP6); // mm
  const [L, setL] = useState(0.5); // m
  const [Ie, setIe] = useState(20); // kg m^2
  const [disc, setDisc] = useState(true);
  const [mode, setMode] = useState(1);
  const J = polarMoment(d / 1000);
  const Ia = RHO * J * L;
  const kt = (G * J) / L;
  const mu = disc ? Ia / Ie : Infinity;
  const z = endInertiaRoots(mu, 3);
  const f = z.map((zi) => (zi * C) / (TAU * L));
  const fBare = C / (4 * L);
  const fSdof = disc ? Math.sqrt(kt / Ie) / TAU : NaN;
  const fRay = disc ? Math.sqrt(kt / (Ie + Ia / 3)) / TAU : NaN;
  const change = (f[0] / fBare - 1) * 100;
  const ratioR = disc ? Ie / Ia : Infinity;
  const solved = disc && Math.abs(f[0] / fBare - 0.5) < 0.01;
  const done = !!p.challenges[HALF_CHALLENGE];

  // Static curves, computed once: the left side z tan z, and the root locus against Ie/Ia.
  const lhs = useMemo(() => sample((x) => x * Math.tan(x), 0.001, Z_MAX, 1600), []);
  const locus = useMemo(() => {
    const n = 220;
    const xs = new Float64Array(n + 1);
    const ys = [new Float64Array(n + 1), new Float64Array(n + 1), new Float64Array(n + 1)];
    const sd = new Float64Array(n + 1);
    for (let i = 0; i <= n; i++) {
      const r = R_MIN * (R_MAX / R_MIN) ** (i / n);
      const zz = endInertiaRoots(1 / r, 3);
      xs[i] = r;
      for (let k = 0; k < 3; k++) ys[k][i] = zz[k] / (Math.PI / 2);
      sd[i] = Math.sqrt(1 / r) / (Math.PI / 2);
    }
    return { modes: ys.map((y) => ({ x: xs, y })), sdof: { x: xs, y: sd } };
  }, []);

  // ---- animation of the selected mode: theta(x, t) = sin(z_n x/L) cos(w t), scaled to its largest twist
  const wrapRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<MemberApi>(null);
  const t = useRef(0);
  const zn = z[mode - 1];
  let peak = 0;
  for (let i = 0; i <= 40; i++) peak = Math.max(peak, Math.abs(Math.sin((zn * i) / 40)));
  const speed = Math.min(6, zn / z[0]);
  const nodesN: number[] = [];
  for (let k = 1; k * Math.PI < zn; k++) nodesN.push((k * Math.PI) / zn);
  useRaf(
    (dt) => {
      t.current += dt;
      const a = Math.cos(TAU * 0.55 * speed * t.current) / (peak || 1);
      viewRef.current?.draw((xi) => a * Math.sin(zn * xi));
    },
    true,
    wrapRef
  );

  const preset = (name: 'bare' | 'w10' | 'sp6' | 'y2021') => {
    const dd = D_SP6;
    const LL = 0.5;
    const IaP = RHO * polarMoment(dd / 1000) * LL;
    setD(dd);
    setL(LL);
    if (name === 'bare') {
      setDisc(false);
      return;
    }
    setDisc(true);
    setIe(name === 'w10' ? IaP / 4.9 : name === 'sp6' ? 20 : 470.56 * IaP);
  };

  const yOfMu = Math.min(1e4, Math.max(1e-4, mu));
  return (
    <div ref={wrapRef}>
      <SimLayout
        visual={
          <>
            <Plot x={{ min: 0, max: Z_MAX, label: 'z = ωL/c', ticks: [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2, 2 * Math.PI, (5 * Math.PI) / 2], format: (v) => ['0', 'π/2', 'π', '3π/2', '2π', '5π/2'][Math.round(v / (Math.PI / 2))] ?? '' }} y={{ min: 1e-4, max: 1e4, log: true, label: 'both sides' }} height={250} ariaLabel="Graphical solution of z tan z = Ia/Ie">
              {[Math.PI / 2, (3 * Math.PI) / 2, (5 * Math.PI) / 2].map((x, i) => (
                <VLine key={x} x={x} color="var(--text-3)" label={i === 0 ? 'no disc' : undefined} labelY="bottom" />
              ))}
              {[Math.PI, 2 * Math.PI].map((x, i) => (
                <VLine key={x} x={x} color="var(--text-3)" dash="1 4" label={i === 0 ? 'fixed end' : undefined} labelY="bottom" />
              ))}
              <Line points={lhs} color="var(--text-2)" width={1.8} />
              {disc && <HLine y={yOfMu} color="var(--accent)" dash={false} width={2} label="Iₐ/Iₑ" />}
              {disc && z.map((zi, i) => <Dot key={i} x={zi} y={yOfMu} color={modeColor(i + 1)} r={5.5} />)}
            </Plot>
            <Legend
              items={[
                { label: 'z tan z (left side)', color: 'var(--text-2)' },
                { label: 'Iₐ/Iₑ (right side)', color: 'var(--accent)' },
                { label: 'root z₁ (mode 1)', color: 'var(--m1)' },
                { label: 'z₂ (mode 2)', color: 'var(--m2)' },
                { label: 'z₃ (mode 3)', color: 'var(--m3)' },
              ]}
            />
            <Plot x={{ min: R_MIN, max: R_MAX, log: true, label: 'disc inertia Iₑ / shaft inertia Iₐ' }} y={{ min: 0, max: 5.4, label: 'f / f₁ of the bare shaft', ticks: [0, 1, 2, 3, 4, 5] }} height={230} ariaLabel="Natural frequencies against disc inertia">
              <HLine y={1} label="bare shaft f₁ (fixed–free)" />
              <HLine y={2} dash="1 4" label="fixed–fixed f₁" />
              {locus.modes.map((pts, i) => (
                <Line key={i} points={pts} color={modeColor(i + 1)} width={2.4} />
              ))}
              <Line points={locus.sdof} color="var(--text-3)" dash width={1.6} />
              {disc && ratioR >= R_MIN && ratioR <= R_MAX && (
                <>
                  <VLine x={ratioR} color="var(--accent)" dash={false} width={1} />
                  <Handle x={ratioR} y={z[0] / (Math.PI / 2)} axis="x" clampX={[R_MIN, R_MAX]} onChange={(x) => setIe(x * Ia)} color="var(--accent)" ariaLabel="Disc inertia relative to the shaft inertia (drag, or use the arrow keys)" />
                  <PlotText x={ratioR} y={z[0] / (Math.PI / 2)} anchor={ratioR > 10 ? 'end' : 'start'} dx={ratioR > 10 ? -14 : 14} dy={-12} color="var(--accent)">
                    drag the disc size
                  </PlotText>
                </>
              )}
            </Plot>
            <Legend
              items={[
                { label: 'mode 1', color: 'var(--m1)' },
                { label: 'mode 2', color: 'var(--m2)' },
                { label: 'mode 3', color: 'var(--m3)' },
                { label: 'SDOF √(kₜ/Iₑ)', color: 'var(--text-3)', dash: true },
              ]}
            />
            <MemberView ref={viewRef} member="shaft" left="fixed" right={disc ? 'disc' : 'free'} color={modeColor(mode)} nodes={nodesN} label={`Shaft with an end disc, mode ${mode} animated`} caption={`mode ${mode}: f = ${f[mode - 1].toPrecision(4)} Hz`} />
            <Rich className="note" text={`Animation speeds are relative to mode 1 and capped at 6× (here the true $f_${mode}/f_1$ = ${(zn / z[0]).toPrecision(3)}). Steel shaft, $G$ = 80 GPa, $\\rho$ = 7700 kg/m³.`} />
          </>
        }
        controls={
          <>
            <Toggle checked={disc} onChange={setDisc} label="disc fitted at the free end" />
            <Slider label="disc inertia" tex="I_e" tip="polar inertia of the end disc (kg m²)" value={Ie} min={1e-3} max={2000} log unit="kg m²" sig={3} onChange={setIe} disabled={!disc} />
            <Slider label="shaft diameter" tex="d" tip="solid shaft diameter (mm): J = πd⁴/32" value={d} min={20} max={400} log unit="mm" onChange={setD} />
            <Slider label="shaft length" tex="L" tip="shaft length (m)" value={L} min={0.2} max={3} step={0.01} unit="m" onChange={setL} />
            <div>
              <div className="muted small">Mode to animate</div>
              <Segmented
                size="sm"
                label="Mode"
                value={mode}
                onChange={setMode}
                options={[
                  { value: 1, label: '1' },
                  { value: 2, label: '2' },
                  { value: 3, label: '3' },
                ]}
              />
            </div>
            <div className="row gap-s wrap">
              <span className="muted small">Presets:</span>
              <Button size="sm" onClick={() => preset('bare')}>
                No disc
              </Button>
              <Button size="sm" onClick={() => preset('w10')}>
                Week 10 Q3 (μ = 4.9)
              </Button>
              <Button size="sm" onClick={() => preset('sp6')}>
                Reader SP6(b)
              </Button>
              <Button size="sm" onClick={() => preset('y2021')}>
                2021 half-axle
              </Button>
            </div>
            <Readouts>
              <Readout tex="I_a" tip="shaft polar inertia ρJL" value={Ia} unit="kg m²" sig={3} />
              <Readout tex="\mu" tip="Iₐ/Iₑ, the right side of z tan z = μ" value={mu} sig={3} text={disc ? undefined : '∞'} />
              <Readout tex="k_t" tip="torsional stiffness GJ/L" value={stiffnessReadout(kt).value} unit={stiffnessReadout(kt).unit} sig={3} />
              <Readout tex="f_1" tip="exact fundamental z₁c/2πL" value={f[0]} unit="Hz" tone="m1" />
              <Readout tex="f_2" tip="second mode" value={f[1]} unit="Hz" tone="m2" />
              <Readout tex="f_3" tip="third mode" value={f[2]} unit="Hz" tone="m3" />
              <Readout tex="f_{SDOF}" tip="massless-shaft estimate √(kt/Ie)/2π" value={fSdof} unit="Hz" text={disc ? undefined : '—'} />
              <Readout tex="f_{R}" tip="Rayleigh estimate √(kt/(Ie + Ia/3))/2π" value={fRay} unit="Hz" text={disc ? undefined : '—'} />
              <Readout label="f₁ vs bare shaft" value={change} unit="%" sig={3} tone={change < -50 ? 'bad' : undefined} />
            </Readouts>
            {disc && (
              <Rich
                className="note"
                text={`Against the exact $f_1$: SDOF ${signedPct((fSdof / f[0] - 1) * 100)}, Rayleigh ${signedPct((fRay / f[0] - 1) * 100)}. Both are upper bounds, the SDOF the higher. The higher roots sit near ${(z[1] / Math.PI).toFixed(3)}π and ${(z[2] / Math.PI).toFixed(3)}π.`}
              />
            )}
            <Callout kind="info" title="Challenge">
              <Rich text="Choose a disc that **halves** the shaft’s fundamental (to within 1 %). Hint: what must $z_1$ be?" />
              <div className="row gap-s wrap">
                <Button size="sm" onClick={() => solved && completeChallenge(HALF_CHALLENGE)} disabled={!solved || done}>
                  {done ? '✓ Challenge complete' : solved ? 'Submit this disc' : `f₁ is ${(100 * (f[0] / fBare)).toFixed(1)} % of the bare value`}
                </Button>
                {done && <Badge tone="ok">z₁ = π/4, so Iₐ/Iₑ = (π/4)tan(π/4) = 0.785: Iₑ = 1.27 Iₐ.</Badge>}
              </div>
            </Callout>
          </>
        }
      />
      <PredictReveal
        id="b2-ei-heavy"
        question="Fit a disc 470 times the shaft’s own inertia (the 2021 hybrid axle). Does $f_1$ rise towards the fixed–fixed value, or fall?"
        options={['It rises × 2 (nearly a fixed end)', 'It barely changes', 'It falls by about 97 %']}
        answer={2}
        explain="A heavy end inertia is not a fixed end. The disc swings on the shaft as a torsional spring, $\omega_1 \approx \sqrt{k_t/I_e}$: here 0.029 of the bare value, a 97 % drop (2021 B2.5). The fixed-end idealisation predicts the opposite, +100 %."
        tryIt="press the 2021 half-axle preset."
        onApply={() => preset('y2021')}
      />
      <PredictReveal
        id="b2-ei-mode2"
        question="With that heavy disc fitted, where does mode 2 go?"
        options={['It stays at 3 × the bare f₁', 'To about 2 × the bare f₁: the fixed–fixed fundamental', 'To zero']}
        answer={1}
        explain="The higher roots fall from $(2n-1)\pi/2$ to about $(n-1)\pi$: mode 2 becomes the fixed–fixed fundamental ($z_2 \to \pi$, 2.0004 × the bare $f_1$ in 2021). The disc end acts as a fixed end only for these higher modes."
        tryIt="2021 preset, animate mode 2, read the locus plot."
        onApply={() => {
          preset('y2021');
          setMode(2);
        }}
      />
      <PredictReveal
        id="b2-ei-diameter"
        question="Keep the heavy 2021 disc and double the shaft diameter. What happens to $f_1$?"
        options={['Nothing: J cancels', 'It doubles', 'It rises about 4 times']}
        answer={2}
        explain="$k_t = GJ/L \propto d^4$ while $I_e$ is unchanged, so $\omega_1 \approx \sqrt{k_t/I_e} \propto d^2$: × 4. “The diameter cancels” holds only for the bare uniform shaft (2021 B2.3 vs B2.5)."
        tryIt="2021 preset, note f₁, then double d."
        onApply={() => {
          preset('y2021');
          setD(D_SP6 * 2);
        }}
      />
      <PredictReveal
        id="b2-ei-sdof"
        question="Is the massless-shaft estimate $\sqrt{k_t/I_e}$ above or below the exact $f_1$?"
        options={['Above', 'Below', 'Exactly equal']}
        answer={0}
        explain="It ignores the shaft’s own inertia, so it is too high. Adding a third of the shaft inertia, $\sqrt{k_t/(I_e + I_a/3)}$ (Rayleigh with a linear twist), is closer but still an upper bound; Dunkerley gives a lower bound (Week 10 Q3: exact $z_1$ = 1.3096, Dunkerley 1.2810)."
        tryIt="Week 10 preset: compare f_SDOF, f_R and f₁."
        onApply={() => preset('w10')}
      />
    </div>
  );
}
