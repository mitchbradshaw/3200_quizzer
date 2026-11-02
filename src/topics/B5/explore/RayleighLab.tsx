// Rayleigh's quotient for a trial shape the student picks (or blends), against the exact fundamental.
// Units: L = EI = rhoA = 1, so omega is in sqrt(EI/(rhoA L^4)) and a point mass is mu = M/(rhoA L).
import { useMemo, useState } from 'react';
import { TRIAL_SHAPES, rayleighOmega, type TrialShape } from '../../../physics/approx';
import { betaL, modeShape, modeShapeDerivs } from '../../../physics/beams';
import { Dot, HLine, Handle, Line, Plot, PlotText, VLine, sample } from '../../../plot/Plot';
import { Badge, Button, Callout, Legend, Readout, Readouts, Segmented, Select, SimLayout, Slider, Toggle } from '../../../ui/kit';
import { PredictReveal } from '../../../ui/PredictReveal';
import { Rich } from '../../../ui/Rich';
import { feBeam, feCurvatureAt, feShapeAt, tipMassRoots } from '../physics';
import { useMountLater } from './later';

type Beam = 'cantilever' | 'pinned';
const N_PLOT = 160;
const W_SCAN = 40;

interface Blend {
  phi: (xi: number) => number;
  phi2: (xi: number) => number;
}

function blendOf(a: TrialShape, b: TrialShape, w: number): Blend {
  return {
    phi: (xi) => (1 - w) * a.phi(xi) + w * b.phi(xi),
    phi2: (xi) => (1 - w) * a.phi2(xi) + w * b.phi2(xi),
  };
}

function rq(s: Blend, mu: number, xm: number, n = 400): number {
  return rayleighOmega({ L: 1, EI: 1, rhoA: 1, phi: s.phi, phi2: s.phi2, masses: mu > 0 ? [{ x: xm, M: mu }] : [], n });
}

/** Energies of the blend: V = int phi''^2, T_beam = int phi^2, T_mass = mu phi(xm)^2 (Simpson). */
function energies(s: Blend, mu: number, xm: number) {
  const n = 400;
  const h = 1 / n;
  let V = 0;
  let T = 0;
  for (let i = 0; i <= n; i++) {
    const w = i === 0 || i === n ? 1 : i % 2 ? 4 : 2;
    V += w * s.phi2(i * h) ** 2;
    T += w * s.phi(i * h) ** 2;
  }
  return { V: (V * h) / 3, Tb: (T * h) / 3, Tm: mu * s.phi(xm) ** 2 };
}

const SHORT: Record<string, string> = {
  'cant-tip-load': 'tip-load',
  'cant-udl': 'UDL',
  'cant-xi2': 'x²',
  'cant-cos': '1 − cos',
  'pin-sin': 'sine',
  'pin-parabola': 'parabola',
  'pin-mid-load': 'central-load',
};

const SHAPE_HELP: Record<string, string> = {
  'cant-tip-load': 'Static deflection under a tip load. Zero tip moment, but a constant shear: ideal when a heavy tip mass supplies that shear.',
  'cant-udl': 'Static deflection under the beam’s own (uniform) weight. Satisfies every BC: the best choice for a beam with no or light added mass.',
  'cant-xi2': 'Simplest polynomial with zero deflection and slope at the clamp, but a constant curvature: it carries a bending moment at the free tip.',
  'cant-cos': 'Zero tip moment, but non-zero tip shear. Better than ξ², worse than the static shapes.',
  'pin-sin': 'The exact first mode of the bare pinned beam: Rayleigh is exact for it.',
  'pin-parabola': 'Zero deflection at the pins, but constant curvature: it puts a bending moment at each pin.',
  'pin-mid-load': 'Static deflection under a central load: ideal when a heavy mass sits at mid-span.',
};

export default function RayleighLab() {
  const [beam, setBeam] = useState<Beam>('cantilever');
  const [aId, setA] = useState('cant-xi2');
  const [bId, setB] = useState('cant-udl');
  const [w, setW] = useState(0);
  const [massOn, setMassOn] = useState(false);
  const [mu, setMu] = useState(1);
  const [xm, setXm] = useState(1);
  const later = useMountLater();

  const shapes = TRIAL_SHAPES[beam];
  const A = shapes.find((s) => s.id === aId) ?? shapes[0];
  const B = shapes.find((s) => s.id === bId) ?? shapes[1];
  const m = massOn ? mu : 0;

  // Exact reference: frequency equation, or the banded FE solve (about a millisecond) when a mass is not at the cantilever tip.
  const exactIn = useMemo(() => ({ beam, m, xm }), [beam, m, xm]);
  const exact = useMemo(() => {
    const { beam: bm, m: mm, xm: x } = exactIn;
    const bc = bm === 'cantilever' ? 'clamped-free' : 'pinned-pinned';
    if (!(mm > 0)) {
      const lam = betaL(bc, 1)[0];
      const raw = sample((xi) => modeShape(bc, 1, xi), 0, 1, N_PLOT);
      const tipScale = 1 / Math.max(...Array.from(raw.y, Math.abs));
      const curv = sample((xi) => modeShapeDerivs(bc, 1, xi)[2] * tipScale, 0, 1, N_PLOT);
      for (let i = 0; i < raw.y.length; i++) raw.y[i] *= tipScale;
      return { omega: lam * lam, shape: raw, curv };
    }
    if (bm === 'cantilever' && x >= 0.999) {
      const lam = tipMassRoots(mm, 1)[0];
      const fe = feBeam({ left: 'clamped', right: 'free', nel: 24, masses: [{ x: 1, M: mm }], nModes: 1 });
      return { omega: lam * lam, ...feCurves(fe) };
    }
    const fe = feBeam({ left: bm === 'cantilever' ? 'clamped' : 'pinned', right: bm === 'cantilever' ? 'free' : 'pinned', nel: 24, masses: [{ x, M: mm }], nModes: 1 });
    return { omega: fe.omega[0], ...feCurves(fe) };
  }, [exactIn]);

  const blend = useMemo(() => blendOf(A, B, w), [A, B, w]);
  const wR = useMemo(() => rq(blend, m, xm), [blend, m, xm]);
  const en = useMemo(() => energies(blend, m, xm), [blend, m, xm]);
  const err = (wR / exact.omega - 1) * 100;
  const trial = useMemo(() => sample(blend.phi, 0, 1, N_PLOT), [blend]);
  const trialCurv = useMemo(() => sample(blend.phi2, 0, 1, N_PLOT), [blend]);
  const scan = useMemo(() => sample((t) => rq(blendOf(A, B, t), m, xm, 200), 0, 1, W_SCAN), [A, B, m, xm]);
  const scanMin = useMemo(() => {
    let k = 0;
    for (let i = 1; i < scan.y.length; i++) if (scan.y[i] < scan.y[k]) k = i;
    return { w: scan.x[k], om: scan.y[k] };
  }, [scan]);

  // Natural BC check (what the static shapes get right).
  const h = 1e-4;
  const tipM = blend.phi2(1);
  const tipV = (blend.phi2(1) - blend.phi2(1 - h)) / h;
  const pinM0 = blend.phi2(0);
  const pinM1 = blend.phi2(1);
  const zero = (v: number, ref: number) => Math.abs(v) <= 1e-3 * Math.max(1, Math.abs(ref));
  const curvRef = Math.max(...Array.from(trialCurv.y, Math.abs));

  const scanTop = Math.max(exact.omega * 1.04, ...Array.from(scan.y));
  const scanHi = scanTop + 0.12 * (scanTop - exact.omega);
  const scanLo = exact.omega - 0.22 * (scanHi - exact.omega);
  const curvLo = Math.min(-0.5, ...Array.from(trialCurv.y), ...Array.from(exact.curv.y));
  const curvHi = Math.max(0.5, ...Array.from(trialCurv.y), ...Array.from(exact.curv.y));

  const setBeamTo = (b: Beam) => {
    setBeam(b);
    const s = TRIAL_SHAPES[b];
    setA(b === 'cantilever' ? 'cant-xi2' : 'pin-parabola');
    setB(b === 'cantilever' ? 'cant-udl' : s[0].id);
    setW(0);
    setXm(b === 'cantilever' ? 1 : 0.5);
  };
  const preset = (p: { beam: Beam; a: string; b: string; w: number; mass: boolean; mu?: number; xm?: number }) => {
    setBeam(p.beam);
    setA(p.a);
    setB(p.b);
    setW(p.w);
    setMassOn(p.mass);
    if (p.mu !== undefined) setMu(p.mu);
    setXm(p.xm ?? (p.beam === 'cantilever' ? 1 : 0.5));
  };

  const opts = shapes.map((s) => ({ value: s.id, label: s.label }));
  const C = m > 0 ? wR * Math.sqrt(m) : NaN;
  const Cx = m > 0 ? exact.omega * Math.sqrt(m) : NaN;

  return (
    <div>
      <SimLayout
        visual={
          <>
            <Plot x={{ min: 0, max: 1, label: 'x/L' }} y={{ min: -0.15, max: 1.15, label: 'shape (max = 1)' }} height={210} ariaLabel="Trial shape compared with the exact first mode">
              <Line points={exact.shape} color="var(--m1)" width={2.6} />
              <Line points={trial} color="var(--pred)" width={2.2} dash />
              {m > 0 && <VLine x={xm} label={`mass ${fmt2(m)} ρAL`} color="var(--text-2)" />}
              {m > 0 && <Dot x={xm} y={blend.phi(xm)} r={4 + Math.min(8, 3 * Math.sqrt(m))} color="var(--text-2)" hollow />}
            </Plot>
            <Legend
              items={[
                { label: 'exact first mode', color: 'var(--m1)' },
                { label: `trial shape φ${w > 0 && w < 1 ? ' (blend)' : ''}`, color: 'var(--pred)', dash: true },
              ]}
            />
            <Plot
              x={{ min: 0, max: 1, label: 'x/L' }}
              y={{ min: curvLo * 1.1, max: curvHi * 1.1, label: 'curvature φ″ ∝ moment' }}
              height={170}
              ariaLabel="Curvature of the trial shape and of the exact mode"
            >
              <HLine y={0} dash={false} />
              <Line points={exact.curv} color="var(--m1)" width={2} />
              <Line points={trialCurv} color="var(--pred)" width={2} dash />
              {beam === 'cantilever' && <Dot x={1} y={tipM} color={zero(tipM, curvRef) ? 'var(--ok)' : 'var(--bad)'} />}
              {beam === 'cantilever' && (
                <PlotText x={0.99} y={curvHi * 1.1} dy={14} anchor="end" color={zero(tipM, curvRef) ? 'var(--ok)' : 'var(--bad)'}>
                  {zero(tipM, curvRef) ? '✓ trial: zero moment at the free tip' : '✗ trial: moment at the free tip ≠ 0'}
                </PlotText>
              )}
              {beam === 'pinned' && <Dot x={0} y={pinM0} color={zero(pinM0, curvRef) ? 'var(--ok)' : 'var(--bad)'} />}
              {beam === 'pinned' && <Dot x={1} y={pinM1} color={zero(pinM1, curvRef) ? 'var(--ok)' : 'var(--bad)'} />}
              {beam === 'pinned' && (
                <PlotText x={0.5} y={curvHi * 1.1} dy={14} anchor="middle" color={zero(pinM0, curvRef) ? 'var(--ok)' : 'var(--bad)'}>
                  {zero(pinM0, curvRef) ? '✓ trial: zero moment at the pins' : '✗ trial: moment at the pins ≠ 0'}
                </PlotText>
              )}
            </Plot>
            <Plot
              x={{ min: -0.04, max: 1.04, ticks: [0, 0.2, 0.4, 0.6, 0.8, 1], label: `blend w (0 = ${SHORT[A.id] ?? 'A'}, 1 = ${SHORT[B.id] ?? 'B'})` }}
              y={{ min: scanLo, max: scanHi, label: 'ω_R' }}
              height={190}
              ariaLabel="Rayleigh estimate for every blend of the two shapes, with the exact value"
            >
              <HLine y={exact.omega} color="var(--m1)" dash={false} />
              <PlotText x={0.01} y={exact.omega} dy={13} color="var(--m1)">
                exact ω₁ = {exact.omega.toFixed(3)}: no blend gets below this line
              </PlotText>
              <Line points={scan} color="var(--pred)" width={2.2} />
              <Dot x={scanMin.w} y={scanMin.om} color="var(--pred)" hollow label="best blend" labelPos="above" />
              <Handle x={w} y={wR} axis="x" clampX={[0, 1]} onChange={(x) => setW(Math.round(x * 100) / 100)} color="var(--accent)" label="your blend" />
            </Plot>
            <p className="muted small">
              Drag the handle (or the blend slider) between the two shapes. Every admissible shape, and every blend of two, stays on or above the exact line.
            </p>
          </>
        }
        controls={
          <>
            <Segmented
              label="Beam"
              value={beam}
              onChange={setBeamTo}
              options={[
                { value: 'cantilever', label: 'Cantilever' },
                { value: 'pinned', label: 'Pinned–pinned' },
              ]}
            />
            <div className="stack">
              <label className="small muted">Shape A</label>
              <Select label="Trial shape A" value={A.id} options={opts} onChange={(v) => setA(v)} />
              <Rich className="note" text={`$${A.tex}$. ${SHAPE_HELP[A.id] ?? ''}`} />
              <label className="small muted">Shape B</label>
              <Select label="Trial shape B" value={B.id} options={opts} onChange={(v) => setB(v)} />
            </div>
            <Slider label="blend" tex="w" tip="φ = (1 − w)·φ_A + w·φ_B: any blend of admissible shapes is admissible" value={w} min={0} max={1} step={0.01} sig={2} onChange={setW} />
            <Toggle checked={massOn} onChange={setMassOn} label="Add a point mass" />
            {massOn && (
              <>
                <Slider label="mass ratio" tex="\mu" tip="μ = M/(ρAL): point mass as a multiple of the beam mass" value={mu} min={0.01} max={20} log sig={3} onChange={setMu} />
                <Slider label="position" tex="x_M/L" tip="where the mass sits (1 = cantilever tip)" value={xm} min={beam === 'cantilever' ? 0.1 : 0.05} max={beam === 'cantilever' ? 1 : 0.95} step={0.01} sig={2} onChange={setXm} />
              </>
            )}
            <Readouts min={150}>
              <Readout tex="\omega_R" tip="Rayleigh estimate √(∫EIφ″²dx / (∫ρAφ²dx + Mφ(x_M)²)), as a multiple of √(EI/ρAL⁴)" value={wR} unit="√(EI/ρAL⁴)" tone="m1" />
              <Readout tex="\omega_1" tip="exact fundamental (frequency equation, or converged FE when a mass is present), as a multiple of √(EI/ρAL⁴)" value={exact.omega} unit="√(EI/ρAL⁴)" />
              <Readout label="error" tip="(ω_R/ω₁ − 1) × 100: never negative" value={err} unit="%" sig={3} tone={err < 1 ? 'ok' : err < 5 ? 'warn' : 'bad'} />
              {m > 0 && <Readout tex="C_R" tip="the same estimate written as ω = C√(EI/ML³) (lecture units for a tip mass)" value={C} unit="√(EI/ML³)" />}
              {m > 0 && <Readout tex="C_{exact}" tip="exact value written as ω = C√(EI/ML³)" value={Cx} unit="√(EI/ML³)" />}
            </Readouts>
            <Readouts>
              <Readout tex="V" tip="strain-energy integral ∫φ″² dξ, the numerator (×EI/L³; dimensionless here)" value={en.V} sig={4} />
              <Readout tex="T_{beam}" tip="beam kinetic-energy integral ∫φ² dξ (×ρAL; dimensionless here)" value={en.Tb} sig={4} />
              {m > 0 && <Readout tex="T_{mass}" tip="point-mass term μ φ(x_M)² (×ρAL): adds kinetic energy, no stiffness" value={en.Tm} sig={4} />}
            </Readouts>
            <div className="row gap-s wrap">
              {beam === 'cantilever' ? (
                <>
                  <Badge tone={zero(tipM, curvRef) ? 'ok' : 'bad'}>{zero(tipM, curvRef) ? '✓ zero tip moment' : '✗ tip moment ≠ 0'}</Badge>
                  <Badge tone={zero(tipV, curvRef) ? 'ok' : m > 0 && xm >= 0.999 ? 'warn' : 'bad'}>
                    {zero(tipV, curvRef) ? '✓ zero tip shear' : m > 0 && xm >= 0.999 ? '~ tip shear ≠ 0 (a tip mass needs one)' : '✗ tip shear ≠ 0'}
                  </Badge>
                </>
              ) : (
                <Badge tone={zero(pinM0, curvRef) && zero(pinM1, curvRef) ? 'ok' : 'bad'}>{zero(pinM0, curvRef) && zero(pinM1, curvRef) ? '✓ zero moment at the pins' : '✗ moment at the pins ≠ 0'}</Badge>
              )}
              <Badge tone="ok">✓ geometric BCs (required)</Badge>
            </div>
            <Callout kind={err < 1 ? 'ok' : 'info'} title={err < 1 ? 'Within 1 % (still above)' : 'Upper bound'}>
              <Rich
                text={`$\\omega_R$ = ${wR.toFixed(4)} vs exact ${exact.omega.toFixed(4)}: **${err.toFixed(2)} % high**. The best blend of these two shapes is ${((scanMin.om / exact.omega - 1) * 100).toFixed(2)} % high at $w$ = ${scanMin.w.toFixed(2)}.`}
              />
            </Callout>
            <div className="row gap-s wrap">
              <span className="muted small">Presets:</span>
              <Button size="sm" onClick={() => preset({ beam: 'cantilever', a: 'cant-xi2', b: 'cant-udl', w: 0, mass: false })}>
                LB7 bare cantilever
              </Button>
              <Button size="sm" onClick={() => preset({ beam: 'cantilever', a: 'cant-cos', b: 'cant-tip-load', w: 0, mass: true, mu: 1, xm: 1 })}>
                Tip mass = beam mass
              </Button>
              <Button size="sm" onClick={() => preset({ beam: 'cantilever', a: 'cant-tip-load', b: 'cant-udl', w: 0, mass: true, mu: 0.05, xm: 1 })}>
                Heavy beam (ρAL = 20M)
              </Button>
              <Button size="sm" onClick={() => preset({ beam: 'pinned', a: 'pin-sin', b: 'pin-mid-load', w: 0, mass: true, mu: 9, xm: 0.5 })}>
                Week 10 floor beam (N = 9)
              </Button>
            </div>
          </>
        }
      />
      {later && (
        <>
          <PredictReveal
            id="b5-ray-x2"
            question="Bare cantilever with $\phi = x^2$: the estimate is about 27 % high. Which condition does $x^2$ break?"
            options={['Zero deflection at the clamp', 'Zero slope at the clamp', 'Zero bending moment at the free tip', 'Nothing: Rayleigh always underestimates']}
            answer={2}
            explain="$x^2$ has constant curvature, so it carries a bending moment right up to the free tip ($\phi''(L) = 2 \ne 0$). Geometric BCs (deflection, slope) are required and it meets them; breaking a natural BC is allowed but costs accuracy: $\omega^2 = 20$ vs 12.36 (LB7.5). The UDL static shape satisfies every BC and is only 0.4 % high."
            tryIt="press 'LB7 bare cantilever' and look at the red tip-moment dot on the curvature plot, then drag the blend to the UDL shape."
            onApply={() => preset({ beam: 'cantilever', a: 'cant-xi2', b: 'cant-udl', w: 0, mass: false })}
          />
          <PredictReveal
            id="b5-ray-tipmass"
            question="A tip mass equal to the beam mass ($\mu = 1$). Which trial shape gives the **best** (lowest) estimate?"
            options={['$x^2$', '$1 - \\cos(\\pi x/2L)$', 'UDL static deflection', 'Tip-load static deflection']}
            answer={3}
            explain="With a heavy tip mass the dominant inertia load is a point force at the tip, so the tip-load static shape is nearly the true shape: $C$ = 1.558 vs exact 1.557 (in $\sqrt{EI/ML^3}$). UDL gives 1.596, $1-\cos$ 1.575, $x^2$ 1.826. Dunkerley gives 1.554 from below (LB7.7–LB8.3)."
            tryIt="press 'Tip mass = beam mass' and switch shape A between the four shapes."
            onApply={() => preset({ beam: 'cantilever', a: 'cant-tip-load', b: 'cant-udl', w: 0, mass: true, mu: 1, xm: 1 })}
          />
          <PredictReveal
            id="b5-ray-blend"
            question="You blend the tip-load and UDL shapes for a cantilever with $\mu = 0.3$. Can some blend give an estimate **below** the exact frequency?"
            options={['Yes, the right blend can undershoot slightly', 'No: every blend stays at or above the exact value']}
            answer={1}
            explain="Any blend of admissible shapes is itself admissible, and Rayleigh’s quotient of an admissible shape is never below the true fundamental (it equals it only for the exact mode). The blend curve has a minimum close to, but above, the exact line. This is why a Rayleigh value is a guaranteed **upper bound** (summary notes B5)."
            tryIt="drag the handle on the blend plot from w = 0 to 1 and watch it stay above the exact line."
            onApply={() => preset({ beam: 'cantilever', a: 'cant-tip-load', b: 'cant-udl', w: 0.5, mass: true, mu: 0.3, xm: 1 })}
          />
          <PredictReveal
            id="b5-ray-floor"
            question="Pinned floor beam with a machine of $N = 9$ beam masses at mid-span, trial $\sin(\pi x/L)$. Predict $\omega/\omega_0$."
            options={['1/9 = 0.111', '1/√10 = 0.316', '1/√19 = 0.229', '1/√(1 + 9π⁴/48) = 0.228']}
            answer={2}
            explain="With $\phi = \sin(\pi x/L)$ the beam’s KE integral is $L/2$ (it acts like half its mass at the antinode) while the machine counts in full: $\omega/\omega_0 = 1/\sqrt{1 + 2N} = 1/\sqrt{19} = 0.2294$ (Week 10 Q1). The last option is Dunkerley (0.2278), a lower bound; the exact value is 0.2279."
            tryIt="press 'Week 10 floor beam' and compare ω_R with ω₁ = π² × 0.2279."
            onApply={() => preset({ beam: 'pinned', a: 'pin-sin', b: 'pin-mid-load', w: 0, mass: true, mu: 9, xm: 0.5 })}
          />
        </>
      )}
    </div>
  );
}

function feCurves(fe: ReturnType<typeof feBeam>) {
  const shape = sample((xi) => feShapeAt(fe, 0, xi), 0, 1, N_PLOT);
  let big = 0;
  let at = 0;
  for (let i = 0; i < shape.y.length; i++)
    if (Math.abs(shape.y[i]) > big) {
      big = Math.abs(shape.y[i]);
      at = i;
    }
  const s = (shape.y[at] < 0 ? -1 : 1) / (big || 1);
  for (let i = 0; i < shape.y.length; i++) shape.y[i] *= s;
  const curv = sample((xi) => feCurvatureAt(fe, 0, xi) * s, 0, 1, N_PLOT);
  return { shape, curv };
}

const fmt2 = (x: number) => (x >= 10 ? x.toFixed(0) : x >= 1 ? x.toFixed(1) : x.toFixed(2));
