// Dunkerley's lower bound with added point masses on a cantilever, pinned or clamped beam, compared with
// Rayleigh (bare first mode as the trial shape) and a converged FE solution. Units: L = EI = rhoA = 1.
import { useMemo, useState } from 'react';
import { betaL, modeShape, nodes as modeNodes } from '../../../physics/beams';
import { Bars, Dot, Handle, HLine, Line, Plot, VLine, sample, usePlot } from '../../../plot/Plot';
import { Badge, Button, Callout, Legend, Readout, Readouts, Segmented, SimLayout, Slider, Toggle } from '../../../ui/kit';
import { PredictReveal } from '../../../ui/PredictReveal';
import { Rich } from '../../../ui/Rich';
import { MASS_BEAM_BC, bareOmega1, feBeam, feShapeAt, pointStiffness, type MassBeam } from '../physics';
import { useMountLater } from './later';

interface MassState {
  on: boolean;
  x: number;
  mu: number;
}
const NAMES = ['A', 'B', 'C'];
const CANT_NODE2 = modeNodes('clamped-free', 2)[0];
const FE_ENDS: Record<MassBeam, ['clamped' | 'pinned', 'free' | 'pinned' | 'clamped']> = {
  cantilever: ['clamped', 'free'],
  pinned: ['pinned', 'pinned'],
  clamped: ['clamped', 'clamped'],
};

/** Clamp and pin symbols drawn in data coordinates of the surrounding <Plot>. */
function Supports({ beam }: { beam: MassBeam }) {
  const { sx, sy } = usePlot();
  const y0 = sy(0);
  const clamp = (x: number, dir: -1 | 1) => {
    const px = sx(x);
    const lines = [];
    for (let i = -3; i <= 3; i++) lines.push(<line key={i} x1={px} y1={y0 + i * 7} x2={px + dir * 8} y2={y0 + i * 7 + 6} />);
    return (
      <g stroke="var(--text-3)" strokeWidth={1.4}>
        <line x1={px} y1={y0 - 24} x2={px} y2={y0 + 24} strokeWidth={3} stroke="var(--text-2)" />
        {lines}
      </g>
    );
  };
  const pin = (x: number) => {
    const px = sx(x);
    return (
      <g stroke="var(--text-2)" strokeWidth={1.5} fill="none">
        <path d={`M${px} ${y0}L${px - 8} ${y0 + 13}L${px + 8} ${y0 + 13}Z`} fill="var(--surface)" />
        <line x1={px - 12} y1={y0 + 16} x2={px + 12} y2={y0 + 16} stroke="var(--text-3)" />
      </g>
    );
  };
  return (
    <g pointerEvents="none">
      {beam === 'pinned' ? pin(0) : clamp(0, -1)}
      {beam === 'pinned' ? pin(1) : beam === 'clamped' ? clamp(1, 1) : null}
    </g>
  );
}

export default function DunkerleyLab() {
  const [beam, setBeam] = useState<MassBeam>('cantilever');
  const [ms, setMs] = useState<MassState[]>([
    { on: true, x: 0.5, mu: 0.2 },
    { on: true, x: 0.9, mu: 0.2 },
    { on: false, x: 0.7, mu: 0.1 },
  ]);
  const [showM2, setShowM2] = useState(false);
  const later = useMountLater();
  const bc = MASS_BEAM_BC[beam];
  const active = ms.map((m, i) => ({ ...m, i })).filter((m) => m.on && m.mu > 0);

  // Closed forms: instant.
  const w11 = bareOmega1(beam);
  const atSupport = (x: number) => x <= 1e-6 || (beam !== 'cantilever' && x >= 1 - 1e-6);
  const terms = ms.map((m) => (m.on && m.mu > 0 && !atSupport(m.x) ? (m.mu * w11 * w11) / pointStiffness(beam, Math.min(1, m.x)) : 0));
  const sumTerms = terms.reduce((s, t) => s + t, 0);
  const rD = 1 / Math.sqrt(1 + sumTerms);
  const keR = active.reduce((s, m) => s + m.mu * modeShape(bc, 1, m.x) ** 2, 0);
  const rR = 1 / Math.sqrt(1 + keR);
  const w2bare = betaL(bc, 2)[1] ** 2;
  const nodes2 = useMemo(() => modeNodes(bc, 2), [bc]);

  // FE "exact": the banded solver takes about a millisecond, so it follows every drag directly.
  const feIn = useMemo(() => ({ beam, masses: active.map((m) => ({ x: m.x, M: m.mu })) }), [beam, JSON.stringify(active.map((m) => [m.x, m.mu]))]);
  const fe = useMemo(() => {
    const [l, r] = FE_ENDS[feIn.beam];
    return feBeam({ left: l, right: r, nel: 24, masses: feIn.masses, nModes: 2 });
  }, [feIn]);
  const rX = fe.omega[0] / bareOmega1(feIn.beam);
  const r2 = fe.omega[1] / betaL(MASS_BEAM_BC[feIn.beam], 2)[1] ** 2;

  const shapes = useMemo(() => {
    const ex = sample((xi) => feShapeAt(fe, 0, xi), 0, 1, 160);
    let big = 0;
    let at = 0;
    for (let i = 0; i < ex.y.length; i++)
      if (Math.abs(ex.y[i]) > big) {
        big = Math.abs(ex.y[i]);
        at = i;
      }
    const s = (ex.y[at] < 0 ? -1 : 1) / (big || 1);
    for (let i = 0; i < ex.y.length; i++) ex.y[i] *= s;
    const bareRaw = sample((xi) => modeShape(MASS_BEAM_BC[feIn.beam], 1, xi), 0, 1, 160);
    const bb = Math.max(...Array.from(bareRaw.y, Math.abs)) || 1;
    for (let i = 0; i < bareRaw.y.length; i++) bareRaw.y[i] /= bb;
    return { ex, bare: bareRaw, at: (xi: number) => feShapeAt(fe, 0, xi) * s };
  }, [fe, feIn]);

  const set = (i: number, patch: Partial<MassState>) => setMs((prev) => prev.map((m, j) => (j === i ? { ...m, ...patch } : m)));
  const preset = (b: MassBeam, list: MassState[], m2 = false) => {
    setBeam(b);
    setMs([0, 1, 2].map((i) => list[i] ?? { on: false, x: 0.7, mu: 0.1 }));
    setShowM2(m2);
  };
  const xMin = beam === 'cantilever' ? 0.05 : 0;
  const dominant = terms.reduce((best, t, i) => (t > terms[best] ? i : best), 0);
  const dropD = (rD - 1) * 100;
  const dropX = (rX - 1) * 100;
  const xLo = Math.max(0, Math.min(rD, rX, rR) - 0.04);

  return (
    <div>
      <SimLayout
        visual={
          <>
            <Plot x={{ min: 0, max: 1, label: 'x/L' }} y={{ min: -0.4, max: 1.3, label: 'mode 1 (max = 1)' }} height={250} ariaLabel="Beam with point masses and its first mode shape">
              <HLine y={0} dash={false} color="var(--border)" />
              <Supports beam={beam} />
              <Line points={shapes.bare} color="var(--text-3)" width={1.4} dash />
              <Line points={shapes.ex} color="var(--m1)" width={2.6} />
              {showM2 && nodes2.map((n) => <Dot key={n} x={n} y={0} r={4} color="var(--m2)" hollow label={`mode-2 node ${n.toFixed(3)}`} labelPos="above" />)}
              {ms.map((m, i) =>
                m.on ? (
                  <g key={i}>
                    <Dot x={m.x} y={shapes.at(m.x)} r={5 + 9 * Math.sqrt(m.mu)} color="var(--text-2)" hollow />
                    <Handle
                      x={m.x}
                      y={shapes.at(m.x)}
                      axis="x"
                      clampX={[xMin, 1]}
                      onChange={(x) => set(i, { x: Math.round(x * 1000) / 1000 })}
                      label={NAMES[i]}
                      ariaLabel={`mass ${NAMES[i]} position`}
                    />
                  </g>
                ) : null
              )}
            </Plot>
            <Legend
              items={[
                { label: 'exact mode 1 with the masses (FE)', color: 'var(--m1)' },
                { label: 'bare-beam mode 1 (Rayleigh’s trial shape)', color: 'var(--text-3)', dash: true },
              ]}
            />
            <div className="row gap-s wrap" style={{ alignItems: 'stretch' }}>
              <div style={{ flex: '1 1 240px', minWidth: 0 }}>
                <Plot
                  x={{ min: -0.6, max: 3.6, ticks: [0, 1, 2, 3], format: (v) => ['beam', 'A', 'B', 'C'][Math.round(v)] ?? '' }}
                  y={{ min: 0, max: Math.max(1.25, ...terms.map((t) => t * 1.2)), label: '(ω₁₁/ω_kk)²' }}
                  height={190}
                  ariaLabel="Dunkerley term of the beam and of each mass"
                >
                  <Bars
                    width={0.6}
                    bars={[
                      { x: 0, y: 1, color: 'var(--text-3)', label: '1' },
                      ...terms.map((t, i) => ({ x: i + 1, y: t, color: i === dominant && t > 0 ? 'var(--m1)' : 'color-mix(in srgb, var(--m1) 45%, var(--surface))', label: ms[i].on ? t.toFixed(3) : 'off' })),
                    ]}
                  />
                </Plot>
                <p className="muted small">
                  Dunkerley: <Rich inline text={`$(\\omega_{11}/\\omega_D)^2 = 1 + \\sum (\\omega_{11}/\\omega_{kk})^2$ = ${(1 + sumTerms).toFixed(3)}`} />
                  <br />
                  Each mass alone on the massless beam:{' '}
                  {ms.some((m, i) => m.on && terms[i] > 0) ? (
                    <Rich
                      inline
                      text={ms
                        .map((m, i) => (m.on && terms[i] > 0 ? `$\\omega_{${NAMES[i]}${NAMES[i]}}$ = ${(1 / Math.sqrt(terms[i])).toFixed(2)} $\\omega_{11}$` : ''))
                        .filter(Boolean)
                        .join(', ')}
                    />
                  ) : (
                    'none (masses off or on a support)'
                  )}
                </p>
              </div>
              <div style={{ flex: '1 1 240px', minWidth: 0 }}>
                <Plot
                  x={{ min: xLo, max: 1.005, label: 'ω₁ / ω₁₁ (bare beam = 1)' }}
                  y={{ min: -0.6, max: 2.6, ticks: [0, 1, 2], format: (v) => ['Dunkerley', 'exact', 'Rayleigh'][Math.round(v)] ?? '' }}
                  height={190}
                  margin={{ l: 78 }}
                  ariaLabel="Dunkerley, exact and Rayleigh estimates of the fundamental"
                >
                  <VLine x={1} label="bare" />
                  <Dot x={rD} y={0} color="var(--m1)" hollow label={rD.toFixed(4)} labelPos="above" />
                  <Dot x={rX} y={1} color="var(--m1)" label={rX.toFixed(4)} labelPos="above" />
                  <Dot x={rR} y={2} color="var(--m1)" hollow label={rR.toFixed(4)} labelPos="above" />
                </Plot>
                <p className="muted small">Lower bound ≤ exact ≤ upper bound, every time.</p>
              </div>
            </div>
            <Callout kind="info" title={terms[dominant] > 0 ? `Mass ${NAMES[dominant]} dominates` : 'No mass is loading mode 1'}>
              <Rich
                text={
                  terms[dominant] > 0
                    ? `Its term ${terms[dominant].toFixed(3)} is the largest: it sits where the beam is most flexible, $k = ${beam === 'cantilever' ? '3EI/x^3' : beam === 'pinned' ? '3EIL/(a^2(L-a)^2)' : '3EIL^3/(a^3(L-a)^3)'}$, i.e. where mode 1 moves most, so it adds the most kinetic energy.`
                    : 'Masses at a support (or switched off) add no kinetic energy to mode 1: the frequency is unchanged.'
                }
              />
            </Callout>
            {active.length > 0 && Math.abs(dropX) > 0.05 && (
              <Badge tone="warn">Dunkerley overstates the drop by {(Math.abs(dropD) - Math.abs(dropX)).toFixed(2)} percentage points</Badge>
            )}
          </>
        }
        controls={
          <>
            <Segmented
              label="Beam"
              value={beam}
              onChange={(b: MassBeam) => {
                setBeam(b);
                if (b === 'cantilever') setMs((p) => p.map((m) => ({ ...m, x: Math.max(0.05, m.x) })));
              }}
              options={[
                { value: 'cantilever', label: 'Cantilever' },
                { value: 'pinned', label: 'Pinned' },
                { value: 'clamped', label: 'Clamped' },
              ]}
            />
            {ms.map((m, i) => (
              <div key={i} className="stack" style={{ borderTop: '1px solid var(--border)', paddingTop: 6 }}>
                <Toggle checked={m.on} onChange={(v) => set(i, { on: v })} label={`Mass ${NAMES[i]}`} />
                {m.on && (
                  <>
                    <Slider label={`mass ${NAMES[i]}`} tex={`\\mu_${NAMES[i]}`} tip="mass as a fraction of the beam mass, M/(ρAL)" value={m.mu} min={0.01} max={1.5} step={0.01} sig={2} onChange={(v) => set(i, { mu: v })} />
                    <Slider label={`position ${NAMES[i]}`} tex={`x_${NAMES[i]}/L`} tip="distance from the left end as a fraction of L" value={m.x} min={xMin} max={1} step={0.005} sig={3} onChange={(v) => set(i, { x: v })} />
                  </>
                )}
              </div>
            ))}
            <Toggle checked={showM2} onChange={setShowM2} label="Show mode 2 (nodes and f₂)" />
            <Readouts>
              <Readout tex="\omega_{11}" tip="bare beam fundamental (β₁L)², as a multiple of √(EI/ρAL⁴)" value={w11} />
              <Readout tex="\omega_D/\omega_{11}" tip="Dunkerley: 1/√(1 + Σ terms), a lower bound" value={rD} sig={4} tone="m1" />
              <Readout label="Dunkerley change" tip="100(ω_D/ω₁₁ − 1): overstates the drop" value={dropD} unit="%" sig={3} />
              <Readout tex="\omega_1/\omega_{11}" tip="exact (converged FE with the masses)" value={rX} sig={4} />
              <Readout label="true change" tip="100(ω₁/ω₁₁ − 1)" value={dropX} unit="%" sig={3} />
              <Readout tex="\omega_R/\omega_{11}" tip="Rayleigh with the bare first mode Y₁: 1/√(1 + Σ μ_k Y₁(x_k)²), an upper bound" value={rR} sig={4} />
              {showM2 && <Readout tex="\omega_2/\omega_{2,bare}" tip="exact second frequency with the masses / without" value={r2} sig={4} tone="m2" />}
            </Readouts>
            <p className="muted small">ω₁₁ is in units of √(EI/ρAL⁴); the other frequencies are ratios to it (dimensionless); μ = M/ρAL.</p>
            <div className="row gap-s wrap">
              <span className="muted small">Presets:</span>
              <Button size="sm" onClick={() => preset('cantilever', [{ on: true, x: 0.5, mu: 0.2 }, { on: true, x: 0.9, mu: 0.2 }])}>
                2022 eVTOL rotors
              </Button>
              <Button size="sm" onClick={() => preset('cantilever', [{ on: true, x: 0.35, mu: 0.17 }, { on: true, x: 0.65, mu: 0.17 }])}>
                2018 A380 engines
              </Button>
              <Button size="sm" onClick={() => preset('cantilever', [{ on: true, x: 1, mu: 1 }])}>
                Tip mass = beam mass
              </Button>
              <Button size="sm" onClick={() => preset('clamped', [{ on: true, x: 0.5, mu: 0.214 }], true)}>
                W7.8 machine (clamped)
              </Button>
              <Button size="sm" onClick={() => preset('pinned', [{ on: true, x: 0, mu: 0.5 }, { on: true, x: 1, mu: 0.5 }])}>
                2024 rotors at bearings
              </Button>
            </div>
          </>
        }
      />
      {later && (
        <>
          <PredictReveal
            id="b5-dunk-rotor"
            question="eVTOL wing (2022 B2.5): two rotors, each 20 % of the wing mass, at A = 0.5L and B = 0.9L. Which rotor lowers $f_1$ more?"
            options={['Rotor A', 'Rotor B', 'Both the same: equal masses']}
            answer={1}
            explain="Rotor B. Its Dunkerley term is $4.12 \times 0.2 \times 0.9^3 = 0.601$ against $4.12 \times 0.2 \times 0.5^3 = 0.103$: the cantilever is $(0.9/0.5)^3 = 5.8\times$ more flexible at B. In energy terms, B rides where mode 1 moves most ($Y_1(0.9L) = 1.72$ vs $Y_1(0.5L) = 0.68$), so it adds more kinetic energy. Together: $\omega_D/\omega_{11} = 1/\sqrt{1.704} = 0.766$, a **−23.4 %** change."
            tryIt="press '2022 eVTOL rotors' and compare the bars."
            onApply={() => preset('cantilever', [{ on: true, x: 0.5, mu: 0.2 }, { on: true, x: 0.9, mu: 0.2 }])}
          />
          <PredictReveal
            id="b5-dunk-bound"
            question="For the same wing, the true change in $f_1$ is…"
            options={['a bigger drop than Dunkerley’s −23.4 %', 'a smaller drop than Dunkerley’s −23.4 %', 'exactly −23.4 %']}
            answer={1}
            explain="Dunkerley is a lower bound on the frequency, so it **overstates** the drop: the converged FE gives −23.0 % and Rayleigh (bare mode as trial shape) −23.0 % from above. This is the official 2018 B1.8(a) statement: Dunkerley overestimates the magnitude of the decrease."
            tryIt="read the three dots on the estimates plot."
            onApply={() => preset('cantilever', [{ on: true, x: 0.5, mu: 0.2 }, { on: true, x: 0.9, mu: 0.2 }])}
          />
          <PredictReveal
            id="b5-dunk-bearing"
            question="Hydro shaft (2024 B2.6): the generator and turbine rotors get heavier, but they sit on the (pinned) bearings. The first transverse critical speed…"
            options={['falls', 'rises', 'is unchanged']}
            answer={2}
            explain="A mass at a node adds no kinetic energy to that mode ($\phi(x_k) = 0$): the support points are nodes of every transverse mode of a pinned beam, so the critical speeds are unchanged. They would fall if the rotors could move transversely."
            tryIt="press '2024 rotors at bearings', then drag a rotor off its bearing."
            onApply={() => preset('pinned', [{ on: true, x: 0, mu: 0.5 }, { on: true, x: 1, mu: 0.5 }])}
          />
          <PredictReveal
            id="b5-dunk-node2"
            question="A single mass of 0.3 beam masses sits at $0.783L$ on a cantilever, the node of mode 2. What happens to $f_2$?"
            options={['It falls more than f₁', 'It is unchanged', 'It rises']}
            answer={1}
            explain="The bare mode 2 does not move at its node, so the mass adds no kinetic energy to it: mode 2 is still an exact mode and $f_2$ is unchanged (ratio 1.000). $f_1$ still drops, because mode 1 does move there. A mass (or a force) at a node has no effect on that mode (summary notes trap 9)."
            tryIt="turn on 'Show mode 2' and put one mass on the orange node."
            onApply={() => preset('cantilever', [{ on: true, x: Math.round(CANT_NODE2 * 1e4) / 1e4, mu: 0.3 }], true)}
          />
        </>
      )}
    </div>
  );
}
