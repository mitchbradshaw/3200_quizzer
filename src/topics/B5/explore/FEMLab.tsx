// FE mesh refinement on a cantilever (optional tip mass): consistent mass converges from above,
// lumped mass from below; one element only resembles the fundamental (LB9).
import { useMemo, useState } from 'react';
import { HLine, Line, Plot, VLine, sample } from '../../../plot/Plot';
import { Legend, Readout, Readouts, Segmented, SimLayout, Slider, Toggle, modeColor } from '../../../ui/kit';
import { PredictReveal } from '../../../ui/PredictReveal';
import { Rich } from '../../../ui/Rich';
import { feBeam, feShapeAt, tipMassRoots } from '../physics';
import { useMountLater } from './later';

const MESHES = [1, 2, 3, 4, 6, 8, 12, 16, 24];
const NM = 3;

/** Convergence family (frequencies only, 18 FE solves) and the exact roots for one tip mass; cached per slider value. */
interface Family {
  exact: number[];
  consistent: number[][];
  lumped: number[][];
}
const familyCache = new Map<number, Family>();
function familyFor(mu: number): Family {
  const hit = familyCache.get(mu);
  if (hit) return hit;
  const masses = mu > 0 ? [{ x: 1, M: mu }] : [];
  const run = (lumped: boolean) => MESHES.map((n) => feBeam({ left: 'clamped', right: 'free', nel: n, lumped, masses, nModes: NM, shapes: false }).omega);
  const fam = { exact: tipMassRoots(mu, NM).map((l) => l * l), consistent: run(false), lumped: run(true) };
  if (familyCache.size > 200) familyCache.clear();
  familyCache.set(mu, fam);
  return fam;
}

function normalise(ys: Float64Array) {
  let big = 0;
  let at = 0;
  for (let i = 0; i < ys.length; i++)
    if (Math.abs(ys[i]) > big) {
      big = Math.abs(ys[i]);
      at = i;
    }
  const s = (ys[at] < 0 ? -1 : 1) / (big || 1);
  for (let i = 0; i < ys.length; i++) ys[i] *= s;
}

export default function FEMLab() {
  const [nel, setNel] = useState(2);
  const [mass, setMass] = useState<'consistent' | 'lumped'>('consistent');
  const [mu, setMu] = useState(0);
  const [showOther, setShowOther] = useState(true);
  const later = useMountLater();

  // Every FE solve here is the banded Sturm solver (well under a millisecond each), so the whole
  // chain is recomputed synchronously; the 18-solve convergence family is also cached per μ.
  const conv = useMemo(() => familyFor(mu), [mu]);
  const exact = conv.exact;
  const ratioLine = (fam: 'consistent' | 'lumped', i: number) => ({
    x: Float64Array.from(MESHES),
    y: Float64Array.from(conv[fam].map((om) => (om[i] !== undefined ? om[i] / exact[i] : NaN))),
  });

  const cur = useMemo(() => feBeam({ left: 'clamped', right: 'free', nel, lumped: mass === 'lumped', masses: mu > 0 ? [{ x: 1, M: mu }] : [], nModes: NM }), [nel, mass, mu]);
  const ref = useMemo(() => feBeam({ left: 'clamped', right: 'free', nel: 24, masses: mu > 0 ? [{ x: 1, M: mu }] : [], nModes: NM }), [mu]);
  const shapes = useMemo(() => {
    const out: { fe?: ReturnType<typeof sample>; ex: ReturnType<typeof sample> }[] = [];
    for (let i = 0; i < NM; i++) {
      const ex = sample((xi) => feShapeAt(ref, i, xi), 0, 1, 160);
      normalise(ex.y);
      let fe: ReturnType<typeof sample> | undefined;
      if (i < cur.omega.length) {
        fe = sample((xi) => feShapeAt(cur, i, xi), 0, 1, 160);
        normalise(fe.y);
      }
      out.push({ fe, ex });
    }
    return out;
  }, [cur, ref]);

  const err = (i: number) => (cur.omega[i] !== undefined ? (cur.omega[i] / exact[i] - 1) * 100 : NaN);
  const dofs = mass === 'lumped' ? nel : 2 * nel;

  return (
    <div>
      <SimLayout
        visual={
          <>
            <Plot x={{ min: 1, max: 24, log: true, label: 'number of elements (log)', ticks: [1, 2, 4, 8, 16, 24] }} y={{ min: 0.6, max: 1.6, label: 'ω_FE / ω_exact' }} height={250} ariaLabel="FE frequency divided by the exact frequency against the number of elements">
              <HLine y={1} dash={false} color="var(--text-2)" label="exact" />
              {[0, 1, 2].map((i) => (
                <g key={i}>
                  {(mass === 'consistent' || showOther) && <Line points={ratioLine('consistent', i)} color={modeColor(i + 1)} width={mass === 'consistent' ? 2.6 : 1.4} opacity={mass === 'consistent' ? 1 : 0.55} />}
                  {(mass === 'lumped' || showOther) && <Line points={ratioLine('lumped', i)} color={modeColor(i + 1)} width={mass === 'lumped' ? 2.6 : 1.4} dash opacity={mass === 'lumped' ? 1 : 0.55} />}
                </g>
              ))}
              <VLine x={nel} color="var(--accent)" dash={false} label={`${nel} el.`} />
            </Plot>
            <Legend
              items={[
                { label: 'mode 1', color: 'var(--m1)' },
                { label: 'mode 2', color: 'var(--m2)' },
                { label: 'mode 3', color: 'var(--m3)' },
                { label: 'consistent mass (solid)', color: 'var(--text-2)' },
                { label: 'lumped mass (dashed)', color: 'var(--text-2)', dash: true },
              ]}
            />
            <Plot x={{ min: 0, max: 1, label: 'x/L' }} y={{ min: -1.15, max: 1.15, label: `FE modes, ${nel} element${nel > 1 ? 's' : ''}` }} height={220} ariaLabel="FE mode shapes against the exact mode shapes">
              <HLine y={0} dash={false} />
              {shapes.map((s, i) => (
                <g key={i}>
                  <Line points={s.ex} color={modeColor(i + 1)} width={1.2} opacity={0.45} />
                  {s.fe && <Line points={s.fe} color={modeColor(i + 1)} width={2.4} dash={mass === 'lumped'} />}
                </g>
              ))}
              {Array.from({ length: nel + 1 }, (_, k) => (
                <VLine key={k} x={k / nel} color="var(--text-3)" dash="2 4" width={1} />
              ))}
            </Plot>
            <p className="muted small">Thin lines: exact modes. Thick: the FE modes with the current mesh (grey verticals are the nodes). Cubic elements interpolate between nodes.</p>
          </>
        }
        controls={
          <>
            <Slider label="elements" tex="n_e" tip="number of equal beam elements (each has a cubic deflection)" value={nel} min={1} max={24} step={1} format={(v) => `${Math.round(v)}`} onChange={(v) => setNel(Math.round(v))} />
            <Segmented
              label="Mass matrix"
              value={mass}
              onChange={setMass}
              options={[
                { value: 'consistent', label: 'Consistent mass' },
                { value: 'lumped', label: 'Lumped mass' },
              ]}
            />
            <Toggle checked={showOther} onChange={setShowOther} label="Also show the other mass matrix (faint)" />
            <Slider label="tip mass" tex="\mu" tip="tip mass as a fraction of the beam mass, M/(ρAL); 0 = bare cantilever" value={mu} min={0} max={3} step={0.05} sig={2} onChange={setMu} />
            <Readouts>
              {[0, 1, 2].map((i) => (
                <Readout
                  key={i}
                  tex={`\\omega_${i + 1}`}
                  tip={`mode ${i + 1}: FE value in √(EI/ρAL⁴) (exact ${exact[i]?.toFixed(3)})`}
                  value={cur.omega[i]}
                  text={cur.omega[i] === undefined ? 'n/a' : undefined}
                  tone={(['m1', 'm2', 'm3'] as const)[i]}
                />
              ))}
              {[0, 1, 2].map((i) => (
                <Readout key={`e${i}`} label={`error ${i + 1}`} tip={`(ω_FE/ω_exact − 1) × 100 for mode ${i + 1}`} value={err(i)} text={Number.isFinite(err(i)) ? undefined : 'n/a'} unit="%" sig={3} />
              ))}
              <Readout label="DOFs" tip="free degrees of freedom = number of FE modes available" text={String(dofs)} />
            </Readouts>
            <p className="muted small">ω in units of √(EI/ρAL⁴); exact values: {exact.map((x) => x.toFixed(3)).join(', ')}.</p>
            <Rich
              className="note"
              text={
                nel === 1
                  ? 'One element has only the tip deflection and slope as unknowns: it gives at most two modes, and only the first is close (the second is 58 % high with consistent mass).'
                  : `With ${dofs} DOFs the model has ${dofs} modes; only the lowest few are accurate. Refine until the modes you need stop changing.`
              }
            />
          </>
        }
      />
      {later && (
        <>
          <PredictReveal
            id="b5-fem-consistent"
            question="With a **consistent** mass matrix, as you refine the mesh, does $\omega_1$ approach the exact value from above or below?"
            options={['From above', 'From below', 'It oscillates either side']}
            answer={0}
            explain="From above. Consistent-mass elements use the same cubic shape functions for kinetic and strain energy, so the FE model is a Rayleigh–Ritz approximation: every frequency is an upper bound (1 element 3.533, 2 elements 3.518, exact 3.516). That is the FE version of “Rayleigh overestimates”."
            tryIt="set consistent mass and drag the element slider from 1 to 8."
            onApply={() => {
              setMass('consistent');
              setNel(1);
            }}
          />
          <PredictReveal
            id="b5-fem-lumped"
            question="Now switch to a **lumped** (diagonal) mass matrix. One element gives $\omega_1$ = …"
            options={['about the exact 3.516', 'well above it (≈ 4.5)', 'well below it (≈ 2.45)']}
            answer={2}
            explain="2.449: half the beam mass sits at the tip on a $3EI/L^3$ spring, $\sqrt{3/0.5}$ = 2.449. Lumped models usually converge **from below** (2 el 3.156, 8 el 3.491). So “an FE analysis always overestimates the natural frequencies” is false (2022 B1.8(d)), and coarse models are poor either way: accuracy increases as the mesh is refined (Week 9 Q4)."
            tryIt="switch to lumped mass with one element."
            onApply={() => {
              setMass('lumped');
              setNel(1);
            }}
          />
          <PredictReveal
            id="b5-fem-one-el"
            question="How many modes can a single cantilever beam element represent sensibly?"
            options={['Only the fundamental', 'The first two', 'As many as you like']}
            answer={0}
            explain="Only the fundamental. Inside an element the deflection is a static cubic, so one element cannot bend into the wavy shapes of higher modes: its second mode is 58 % high. This is the reader’s reason for splitting one physical beam into several elements (LB9.3; Exam 2000 Q4(a))."
            tryIt="set 1 element and compare the orange FE mode with the exact one."
            onApply={() => {
              setMass('consistent');
              setNel(1);
            }}
          />
        </>
      )}
    </div>
  );
}
