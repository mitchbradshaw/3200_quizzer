// Bending vs torsion of one thin steel tube: shapes, nodes and frequency ladders side by side, with sliders
// for d, t and L showing which frequencies move (template step 4; 2021 B2.3, 2023 B2.3, 2024 B2.4, 2025 B2.2).
import { useMemo, useState } from 'react';
import { betaL, modeShape, nodes as beamNodes, type BeamBC } from '../../../physics/beams';
import { waveModeShape, waveNodes, type WaveBC } from '../../../physics/waves';
import { Dot, Line, Plot, PlotText } from '../../../plot/Plot';
import { Legend, Readout, Readouts, Segmented, SimLayout, Slider } from '../../../ui/kit';
import { PredictReveal } from '../../../ui/PredictReveal';
import { Rich } from '../../../ui/Rich';
import { fmt } from '../../../engine/format';
import { TAU } from '../physics';
import { XS } from '../studioModel';
import { PlotEnds, type EndKind } from './studioParts';

type CaseId = 'cant' | 'cc' | 'pp' | 'ff';

interface CaseDef {
  label: string;
  title: string;
  bend: BeamBC;
  tor: WaveBC;
  bendEnds: [EndKind, EndKind];
  torEnds: [EndKind, EndKind];
  note: string;
}

const CASES: Record<CaseId, CaseDef> = {
  cant: {
    label: 'Fixed–free',
    title: 'Cantilever bending, fixed–free torsion (blades, wings, a half-axle)',
    bend: 'clamped-free',
    tor: 'fixed-free',
    bendEnds: ['clamp', 'free'],
    torEnds: ['clamp', 'free'],
    note: 'Bending leaves the clamp **flat** and ends straight and sloped; torsion leaves the fixed end **with a slope** (that slope is the torque) and ends flat. Spacing 1 : 6.27 : 17.55 vs 1 : 3 : 5.',
  },
  cc: {
    label: 'Fixed–fixed',
    title: 'Clamped–clamped bending, fixed–fixed torsion',
    bend: 'clamped-clamped',
    tor: 'fixed-fixed',
    bendEnds: ['clamp', 'clamp'],
    torEnds: ['clamp', 'clamp'],
    note: 'Bending is flat at both clamps (cosh/sinh terms); torsion is a pure sine with the largest slope at the ends. Spacing 1 : 2.76 : 5.40 vs 1 : 2 : 3.',
  },
  pp: {
    label: 'Pinned / fixed',
    title: 'Pinned–pinned bending vs fixed–fixed torsion (the 2024 hydro shaft)',
    bend: 'pinned-pinned',
    tor: 'fixed-fixed',
    bendEnds: ['pin', 'pin'],
    torEnds: ['clamp', 'clamp'],
    note: 'The **same** shapes, $\\sin(i\\pi x/L)$, but bending is spaced 1 : 4 : 9 and torsion 1 : 2 : 3, and bending moves with $d$ while torsion does not (2024 B2.4).',
  },
  ff: {
    label: 'Free–free',
    title: 'Free–free (a fuselage, javelin or launch tube in flight)',
    bend: 'free-free',
    tor: 'free-free',
    bendEnds: ['free', 'free'],
    torEnds: ['free', 'free'],
    note: 'Both also have rigid-body modes at $\\omega = 0$ (two in bending, one in torsion), not drawn. Elastic spacing 1 : 2.76 : 5.40 vs 1 : 2 : 3; torsion shapes are $\\cos(i\\pi x/L)$.',
  },
};

const E = 210e9;
const RHO = 7850;
const G = E / (2 * (1 + 0.3));
const C = Math.sqrt(G / RHO);
const SUB = ['₁', '₂', '₃'];
const mcol = (i: number) => `var(--m${i + 1})`;

function bendHz(bc: BeamBC, d: number, L: number): number[] {
  const s = (d / 2) * Math.sqrt(E / (2 * RHO));
  return betaL(bc, 3).map((b) => (b * b * s) / (L * L) / TAU);
}

function torHz(bc: WaveBC, L: number): number[] {
  return [1, 2, 3].map((n) => (bc === 'fixed-free' ? ((2 * n - 1) * C) / (4 * L) : (n * C) / (2 * L)));
}

function unit(ys: Float64Array, tipPositive: boolean): Float64Array {
  let big = 0;
  for (const v of ys) big = Math.max(big, Math.abs(v));
  const ref = tipPositive ? ys[ys.length - 1] : ys.find((v) => Math.abs(v) > 0.5 * big) ?? 1;
  const s = (ref < 0 ? -1 : 1) / (big || 1);
  return Float64Array.from(ys, (v) => v * s);
}

export default function BendTorsion() {
  const [cid, setCid] = useState<CaseId>('cant');
  const [d, setD] = useState(0.2);
  const [t, setT] = useState(5);
  const [L, setL] = useState(4);
  const cs = CASES[cid];
  const fb = bendHz(cs.bend, d, L);
  const ft = torHz(cs.tor, L);
  const shapes = useMemo(
    () => [0, 1, 2].map((i) => ({ b: unit(Float64Array.from(XS, (x) => modeShape(cs.bend, i + 1, x)), cs.bend === 'clamped-free'), t: unit(Float64Array.from(XS, (x) => waveModeShape(cs.tor, i + 1, x)), cs.tor === 'fixed-free') })),
    [cs]
  );
  const r = d / 2;
  const tm = t / 1000;
  const EI = E * Math.PI * r ** 3 * tm;
  const GJ = G * 2 * Math.PI * r ** 3 * tm;
  const rhoA = RHO * 2 * Math.PI * r * tm;
  // Ladder axis fixed over the diameter slider's range (only L rescales it), so you see which lines move.
  const lo = Math.min(bendHz(cs.bend, 0.05, L)[0], ft[0]) / 1.6;
  const hi = Math.max(bendHz(cs.bend, 1, L)[2], ft[2]) * 1.6;
  const tick = (x: number, f: number, i: number, dash?: boolean) => (
    <Line
      key={`${x}-${i}`}
      points={[
        [x - 0.3, f],
        [x + 0.3, f],
      ]}
      color={mcol(i)}
      width={3}
      dash={dash ? '6 3' : undefined}
    />
  );
  return (
    <div>
      <SimLayout
        visual={
          <>
            {[0, 1, 2].map((i) => {
              const bn = beamNodes(cs.bend, i + 1);
              const tn = waveNodes(cs.tor, i + 1);
              return (
                <Plot key={i} x={{ min: 0, max: 1, label: i === 2 ? 'x/L' : undefined, ticks: [0, 0.25, 0.5, 0.75, 1] }} y={{ min: -1.45, max: 1.45, ticks: [] }} height={i === 2 ? 132 : 112} margin={{ l: 22, r: 22, t: 18 }} ariaLabel={`Mode ${i + 1}: bending and torsion shapes`}>
                  <PlotEnds left={cs.bendEnds[0]} right={cs.bendEnds[1]} />
                  <Line points={{ x: XS, y: shapes[i].b }} color={mcol(i)} width={2.6} />
                  <Line points={{ x: XS, y: shapes[i].t }} color={mcol(i)} width={2} dash="6 4" />
                  {bn.map((x) => (
                    <Dot key={`b${x}`} x={x} y={0} r={4} color="var(--text)" hollow label={`${fmt(x, 3)}L`} labelPos="above" />
                  ))}
                  {tn.map((x) => (
                    <Dot key={`t${x}`} x={x} y={0} r={3.5} color="var(--text-3)" />
                  ))}
                  {tn.map((x) => (
                    <PlotText key={`tl${x}`} x={x} y={0} dy={16} anchor="middle" color="var(--text-3)">
                      {`T: ${fmt(x, 3)}L`}
                    </PlotText>
                  ))}
                  <PlotText x={0.01} y={1.45} dy={-5} color={mcol(i)}>
                    {`Mode ${i + 1}: bending f${SUB[i]} = ${fmt(fb[i], 4)} Hz · torsion T${SUB[i]} = ${fmt(ft[i], 4)} Hz`}
                  </PlotText>
                </Plot>
              );
            })}
            <Legend
              items={[
                { label: 'bending (solid; hollow circles = nodes)', color: 'var(--m1)' },
                { label: 'torsion (dashed; grey dots = nodes)', color: 'var(--m1)', dash: true },
              ]}
            />
            <Plot x={{ min: 0, max: 4, ticks: [1.4, 2.6], format: (v) => (v < 2 ? 'bending' : 'torsion'), noGrid: true }} y={{ min: lo, max: hi, log: true, label: 'frequency (Hz, log)' }} height={240} ariaLabel="Frequency ladders: bending and torsion">
              {fb.map((f, i) => tick(1.4, f, i))}
              {ft.map((f, i) => tick(2.6, f, i, true))}
              {fb.map((f, i) => (
                <PlotText key={`bl${i}`} x={1.02} y={f} dy={4} anchor="end" color={mcol(i)}>
                  {`f${SUB[i]} = ${fmt(f, 3)} Hz (×${fmt(f / fb[0], 3)})`}
                </PlotText>
              ))}
              {ft.map((f, i) => (
                <PlotText key={`tl${i}`} x={2.98} y={f} dy={4} color={mcol(i)}>
                  {`T${SUB[i]} = ${fmt(f, 3)} Hz (×${fmt(f / ft[0], 3)})`}
                </PlotText>
              ))}
            </Plot>
          </>
        }
        controls={
          <>
            <Segmented label="Supports" value={cid} onChange={setCid} size="sm" options={(Object.keys(CASES) as CaseId[]).map((k) => ({ value: k, label: CASES[k].label, title: CASES[k].title }))} />
            <div className="small" style={{ fontWeight: 600 }}>
              {cs.title}
            </div>
            <Slider label="tube diameter" tex="d" tip="mean diameter of the thin steel tube" value={d} min={0.05} max={1} step={0.005} unit="m" onChange={setD} />
            <Slider label="wall thickness" tex="t" tip="wall thickness (thin tube: t ≪ d)" value={t} min={1} max={40} step={0.5} unit="mm" onChange={setT} />
            <Slider label="length" tex="L" tip="member length" value={L} min={1} max={20} step={0.1} unit="m" onChange={setL} />
            <Readouts>
              {fb.map((f, i) => (
                <Readout key={`b${i}`} tex={`f_${i + 1}`} tip={`bending mode ${i + 1}: (βL)²(r/L²)√(E/2ρ), ∝ d, no t`} value={f} unit="Hz" tone={(['m1', 'm2', 'm3'] as const)[i]} />
              ))}
              {ft.map((f, i) => (
                <Readout key={`t${i}`} tex={`T_${i + 1}`} tip={`torsional mode ${i + 1}: c = √(G/ρ) over L, no d or t`} value={f} unit="Hz" />
              ))}
            </Readouts>
            <Readouts>
              <Readout tex="EI" tip="bending stiffness E π r³ t: grows with d³ and t" value={EI / 1e6} unit="MN m²" sig={3} />
              <Readout tex="GJ" tip="torsional stiffness G 2π r³ t: grows with d³ and t" value={GJ / 1e6} unit="MN m²" sig={3} />
              <Readout tex="\rho A" tip="mass per length ρ 2π r t: grows with d and t" value={rhoA} unit="kg/m" sig={3} />
              <Readout tex="c" tip="torsional wave speed √(G/ρ) (steel)" value={C} unit="m/s" />
            </Readouts>
            <Rich className="note" text={cs.note} />
            <Rich className="note" text="Steel: $E$ = 210 GPa, $G = E/2(1 + \nu)$ = 80.8 GPa, $\rho$ = 7850 kg/m³. Thin tube: $I = \pi r^3t$, $J = 2\pi r^3t$, $A = 2\pi rt$." />
          </>
        }
      />
      <PredictReveal
        id="b6-cmp-diameter"
        question="Double the tube diameter $d$. Which frequencies move?"
        options={['Bending only: every $f_i$ doubles', 'Torsion only', 'Both double', 'Neither']}
        answer={0}
        explain="Thin-tube bending $\omega_i = (\beta_iL)^2(r/L^2)\sqrt{E/2\rho}$ is proportional to $d$. Torsion: $GJ$ and $\rho J$ both scale with $J$, so $c = \sqrt{G/\rho}$ and $f_n$ depend only on $L$ and the material (2021 B2.3; 2023 B2.3)."
        tryIt="drag d from 0.2 to 0.4 m and watch the left ladder rise while the right one stays."
        onApply={() => setD(Math.min(1, d * 2))}
      />
      <PredictReveal
        id="b6-cmp-wall"
        question="Double the wall thickness $t$. What happens?"
        options={['All frequencies double', 'Bending rises by √2', 'No frequency changes, but EI and GJ double', 'Torsion rises, bending falls']}
        answer={2}
        explain="Stiffness ($EI$, $GJ$) and mass per length ($\rho A$, $\rho J$) are all proportional to $t$, so every ratio, and every frequency, is unchanged. What changes is the static and forced deflection under a given load ($\propto 1/t$): that is how B2 sizes the thickness (2024 B2.5)."
        tryIt="drag t and watch the frequency readouts stay put while EI, GJ and ρA change."
        onApply={() => setT(Math.min(40, t * 2))}
      />
      <PredictReveal
        id="b6-cmp-pp"
        question="Pinned–pinned bending and fixed–fixed torsion of the same shaft: are the mode shapes the same?"
        options={['Yes, both $\\sin(i\\pi x/L)$; only the frequency spacing differs (1 : 4 : 9 vs 1 : 2 : 3)', 'No: bending has hyperbolic terms', 'Same shapes and the same spacing']}
        answer={0}
        explain="Pinned ends need $y = y'' = 0$, which $\sin(i\pi x/L)$ satisfies exactly, so the bending shapes are pure sines. Fixed–fixed torsion is the wave equation with $\theta = 0$ at both ends: the same sines. But bending frequencies go as $i^2$ (dispersive) and torsion as $i$ (2024 B2.4)."
        tryIt="choose 'Pinned / fixed': the dashed and solid curves lie on top of each other."
        onApply={() => setCid('pp')}
      />
      <PredictReveal
        id="b6-cmp-node"
        question="Cantilevered blade: bending mode 2 has its node at $0.783L$. Where is the node of **torsional** mode 2?"
        options={['Also at 0.783L', 'At 2L/3', 'At L/2']}
        answer={1}
        explain="Fixed–free torsion mode 2 is $\sin(3\pi x/2L)$, zero at $x = 2L/3$. That is why the 2025 tidal-blade force at $2L/3$, offset from the axis, excites torsional modes 1 and 3 but not 2 (2025 B2.2)."
        tryIt="choose 'Fixed–free' and compare the grey torsion node with the hollow bending node in mode 2."
        onApply={() => setCid('cant')}
      />
    </div>
  );
}
