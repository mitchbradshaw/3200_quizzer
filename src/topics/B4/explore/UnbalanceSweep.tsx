// Unbalance speed sweep on the 2022 eVTOL wing: two rotors (0.5L, 0.9L) each apply meΩ². Tip amplitude
// against rotor speed, two draggable comparison speeds, in-plane (take-off) vs out-of-plane (cruise)
// bending, and the B2.3 design challenge: the thinnest wing that keeps the tip within 0.1 mm.
import { useMemo, useState } from 'react';
import { betaL, modeShape } from '../../../physics/beams';
import { Band, Handle, HLine, Line, Plot, VLine } from '../../../plot/Plot';
import { Badge, Button, Callout, Legend, Readout, Readouts, Segmented, SimLayout, Slider, modeColor } from '../../../ui/kit';
import { PredictReveal } from '../../../ui/PredictReveal';
import { Rich } from '../../../ui/Rich';
import { completeChallenge, useProgress } from '../../../app/store';
import { fmt } from '../../../engine/format';
import { WING, unbalanceRatioMode1 } from '../physics';

export const WING_T_CHALLENGE = 'b4-wing-thickness';
const NM = 8; // modes summed (cruise needs several to converge)
const NLO = 30;
const NHI = 20000;
const LIMIT = 0.1; // mm
const TAU = 2 * Math.PI;

type Plane = 'in' | 'out';

export default function UnbalanceSweep() {
  const p = useProgress();
  const [tmm, setTmm] = useState(3);
  const [plane, setPlane] = useState<Plane>('in');
  const [me, setMe] = useState(1); // kg mm
  const [nMax, setNMax] = useState(2400);
  const [nA, setNA] = useState(1200);
  const [nB, setNB] = useState(2400);

  // Modal coefficients cᵢ = (Yᵢ(0.5) + Yᵢ(0.9)) Yᵢ(1)/(βᵢL)⁴ and frequency ratios (fixed by the geometry).
  const modal = useMemo(() => {
    const roots = betaL('clamped-free', NM);
    return roots.map((b, k) => ({ wr: (b / roots[0]) ** 2, c: ((modeShape('clamped-free', k + 1, WING.xA) + modeShape('clamped-free', k + 1, WING.xB)) * modeShape('clamped-free', k + 1, 1)) / b ** 4 }));
  }, []);
  const t = tmm / 1000;
  const { E, rho, L, w } = WING;
  const depth = plane === 'in' ? w : t;
  const I = plane === 'in' ? (t * w ** 3) / 12 : (w * t ** 3) / 12;
  const EI = E * I;
  const b1 = betaL('clamped-free', 1)[0];
  const w1 = b1 * b1 * (depth / (L * L)) * Math.sqrt(E / (12 * rho));
  const N1 = (60 * w1) / TAU;
  const freqs = modal.slice(0, 4).map((m) => (m.wr * w1) / TAU);

  /** Tip amplitude in mm at a rotor speed (rpm): (meΩ² L³/EI) Σ cᵢ/(1 − (Ω/ωᵢ)²), n modes. */
  const tipAt = (rpm: number, n = NM) => {
    const Om = (TAU * rpm) / 60;
    const P = me * 1e-3 * Om * Om;
    let S = 0;
    for (let k = 0; k < n; k++) S += modal[k].c / (1 - (Om / (w1 * modal[k].wr)) ** 2);
    return ((S * P * L ** 3) / EI) * 1000;
  };
  const curves = useMemo(() => {
    const n = 800;
    const x = new Float64Array(n + 1);
    const all = new Float64Array(n + 1);
    const one = new Float64Array(n + 1);
    for (let j = 0; j <= n; j++) {
      const rpm = NLO * Math.pow(NHI / NLO, j / n);
      x[j] = rpm;
      all[j] = Math.abs(tipAt(rpm));
      one[j] = Math.abs(tipAt(rpm, 1));
    }
    return { all: { x, y: all }, one: { x, y: one } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tmm, plane, me, modal]);

  // Worst case over the operating range [0, N_max]: scan finely, and flag a resonance inside the range.
  const worst = useMemo(() => {
    let best = { y: 0, rpm: 0 };
    for (let j = 0; j <= 600; j++) {
      const rpm = (nMax * j) / 600;
      const y = Math.abs(tipAt(rpm));
      if (y > best.y) best = { y, rpm };
    }
    return best;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tmm, plane, me, nMax, modal]);
  const resonanceInRange = freqs.some((f) => f * 60 <= nMax);
  const yA = tipAt(nA);
  const yB = tipAt(nB);
  const ratio = yB / yA;
  const ratio1 = unbalanceRatioMode1(nA / N1, nB / N1);
  const tReq = plane === 'in' && !resonanceInRange ? (tmm * worst.y) / LIMIT : NaN;

  // Challenge: thinnest wall for ≤ 0.1 mm at every take-off speed up to 2400 rpm (me = 1 kg mm).
  const chSettings = plane === 'in' && Math.abs(me - 1) < 1e-9 && nMax === 2400;
  const solved = chSettings && worst.y <= LIMIT * 1.001 && worst.y >= LIMIT / 1.03;
  const done = !!p.challenges[WING_T_CHALLENGE];

  return (
    <div>
      <SimLayout
        visual={
          <>
            <Plot x={{ min: NLO, max: NHI, log: true, label: 'rotor speed (rpm)' }} y={{ min: 1e-5, max: 100, log: true, label: '|tip amplitude| (mm)' }} height={300} ariaLabel="Tip amplitude of the wing against rotor speed">
              <Band x0={NLO} x1={nMax} color="var(--ok)" opacity={0.07} label="operating range" />
              <HLine y={LIMIT} color="var(--bad)" label="limit 0.1 mm" />
              {freqs.map((f, k) => (f * 60 >= NLO && f * 60 <= NHI ? <VLine key={k} x={f * 60} color={modeColor(k + 1)} label={`f${'₁₂₃₄'[k]}`} /> : null))}
              <Line points={curves.one} color="var(--m1)" dash="5 4" width={1.4} />
              <Line points={curves.all} color="var(--text)" width={2.2} />
              <Handle x={nA} y={Math.min(100, Math.max(1e-5, Math.abs(yA)))} axis="x" clampX={[NLO, NHI]} onChange={(x) => setNA(Math.round(x))} color="var(--accent)" label="A" ariaLabel="Speed A (rpm)" />
              <Handle x={nB} y={Math.min(100, Math.max(1e-5, Math.abs(yB)))} axis="x" clampX={[NLO, NHI]} onChange={(x) => setNB(Math.round(x))} color="var(--accent)" label="B" ariaLabel="Speed B (rpm)" />
            </Plot>
            <Legend
              items={[
                { label: `${NM} modes`, color: 'var(--text)' },
                { label: 'mode 1 alone', color: 'var(--m1)', dash: true },
                { label: 'critical speeds', color: 'var(--text-3)', dash: true },
              ]}
            />
            <Rich
              className="note"
              text={
                plane === 'in'
                  ? 'Take-off, in-plane bending: $I = tw^3/12$, so the critical speeds depend on $w$ only, while the amplitude goes as $1/EI \\propto 1/t$. Below $f_1$ the unbalance force $me\\Omega^2$ and the dynamic factor both grow, so the top speed is the worst case.'
                  : 'Cruise, out-of-plane bending: $I = wt^3/12$, so every frequency drops by $t/w$ and the static flexibility rises by $(w/t)^2$. Several resonances now sit inside the speed range; above them the response is inertia-controlled.'
              }
            />
          </>
        }
        controls={
          <>
            <div className="row gap-s wrap">
              <span className="muted small">Bending</span>
              <Segmented size="sm" label="Bending plane" value={plane} onChange={setPlane} options={[{ value: 'in' as const, label: 'take-off (in-plane)' }, { value: 'out' as const, label: 'cruise (out-of-plane)' }]} />
            </div>
            <Slider label="wing thickness" tex="t" tip="thickness of the wing section (w = 421 mm fixed by the B2.1 frequency design)" value={tmm} min={1} max={12} log sig={3} unit="mm" onChange={setTmm} />
            <Slider label="unbalance per rotor" tex="me" tip="rotor mass × eccentricity; each rotor applies meΩ² (in phase)" value={me} min={0.2} max={5} step={0.1} sig={2} unit="kg mm" onChange={setMe} />
            <Slider label="maximum speed" tex="N_{max}" tip="top of the operating range" value={nMax} min={300} max={6000} step={100} sig={4} unit="rpm" onChange={setNMax} />
            <Readouts>
              <Readout tex="f_1" tip="first natural frequency for this bending plane" value={freqs[0]} unit="Hz" sig={4} tone="m1" />
              <Readout tex="N_1" tip="first critical speed (rpm) = 60 f₁" value={N1} unit="rpm" sig={4} tone="m1" />
              <Readout tex="y_A" tip="tip amplitude at speed A" value={Math.abs(yA)} unit="mm" sig={3} />
              <Readout tex="y_B" tip="tip amplitude at speed B" value={Math.abs(yB)} unit="mm" sig={3} />
              <Readout tex="y_B/y_A" tip={`ratio with ${NM} modes (negative = opposite phase)`} value={ratio} sig={3} />
              <Readout label="mode-1 formula" tip="(Ω_B/Ω_A)² (1 − Ω_A²/ω₁²)/(1 − Ω_B²/ω₁²): force ∝ Ω² times the dynamic factor" value={ratio1} sig={3} />
              <Readout label="worst in range" tip="largest tip amplitude for speeds up to N_max" value={worst.y} unit="mm" sig={3} tone={worst.y > LIMIT * 1.001 ? 'bad' : 'ok'} />
              <Readout label="t for 0.1 mm" tip="y ∝ 1/t in-plane (frequencies unchanged): t_req = t × y_worst/0.1 mm" value={tReq} text={Number.isFinite(tReq) ? undefined : 'n/a'} unit="mm" sig={4} />
            </Readouts>
            <div className="row gap-s wrap">
              <span className="muted small">Speeds A, B:</span>
              <Button size="sm" onClick={() => { setNA(1200); setNB(2400); }}>
                1200 vs 2400 rpm
              </Button>
              <Button size="sm" onClick={() => { setNA(2400); setNB(480); }}>
                2400 vs 480 rpm
              </Button>
            </div>
            {resonanceInRange && (
              <Callout kind="warn" title="Resonance inside the operating range">
                <Rich text={`At least one critical speed (${freqs.filter((f) => f * 60 <= nMax).map((f) => `${fmt(f * 60, 3)} rpm`).join(', ')}) lies below $N_{max}$. Undamped, the amplitude is unbounded there: thickening the wing barely helps, you must move the frequencies.`} />
              </Callout>
            )}
            <Callout kind="info" title="Challenge: the thinnest wing (2022 B2.3)">
              <Rich text="Take-off, rotors at 0.5L and 0.9L, each 1 kg mm, up to 2400 rpm. Keep the tip within **0.1 mm** at every speed with the **thinnest** wing (within 3 %)." />
              <div className="row gap-s wrap" style={{ marginTop: 6 }}>
                <Button
                  size="sm"
                  onClick={() => {
                    setPlane('in');
                    setMe(1);
                    setNMax(2400);
                    setTmm(3);
                    setNA(1200);
                    setNB(2400);
                  }}
                >
                  Load the challenge
                </Button>
                <Button size="sm" variant="primary" disabled={!solved || done} onClick={() => completeChallenge(WING_T_CHALLENGE)}>
                  {done ? '✓ Challenge complete' : 'Submit this thickness'}
                </Button>
              </div>
              <p className="small" style={{ margin: '6px 0 0' }}>
                {!chSettings
                  ? 'Use take-off bending, me = 1 kg mm and N_max = 2400 rpm.'
                  : worst.y > LIMIT * 1.001
                    ? `Worst tip amplitude ${fmt(worst.y, 3)} mm: too flexible.`
                    : solved
                      ? `Worst tip amplitude ${fmt(worst.y, 3)} mm at t = ${fmt(tmm, 3)} mm: that is the minimum. Submit it!`
                      : `Within the limit, but thicker than needed (worst ${fmt(worst.y, 3)} mm).`}
              </p>
              {done && <Badge tone="ok">Solved: t ≈ 4.52 mm. The frequencies never moved; only EI ∝ t did.</Badge>}
            </Callout>
          </>
        }
      />
      <PredictReveal
        id="b4-unb-halve"
        question="Take-off, in-plane: the rotors slow from 2400 to 1200 rpm, both well below $N_1$ = 6000 rpm. The tip amplitude falls to about…"
        options={['one half', 'one quarter', 'a little less than one quarter', 'it stays the same']}
        answer={2}
        explain="The force $me\Omega^2$ quarters, and the dynamic factor also drops (1.19 at Ω = 0.4ω₁ → 1.04 at 0.2ω₁): ratio $= 0.25 \times 1.04/1.19$ ≈ 0.22. With unbalance you must compare force × dynamic factor, never the dynamic factor alone (summary trap 12)."
        tryIt="press 1200 vs 2400 rpm with take-off bending and read y_B/y_A."
        onApply={() => {
          setPlane('in');
          setNA(2400);
          setNB(1200);
        }}
      />
      <PredictReveal
        id="b4-unb-thick"
        question="Double the wing thickness $t$ (take-off bending). The tip amplitude…"
        options={['halves', 'quarters', 'does not change, because the critical speeds do not change']}
        answer={0}
        explain="In-plane $I = tw^3/12 \propto t$, so the static flexibility $L^3/EI$ halves, while $I/A$, and so every critical speed, is unchanged. Response ∝ 1/t: this is the 2024 B2.5 logic (a 30 % cut needs +42.9 % thickness)."
        tryIt="note y_B, then double t."
        onApply={() => {
          setPlane('in');
          setTmm(Math.min(12, tmm * 2));
        }}
      />
      <PredictReveal
        id="b4-unb-cruise"
        question="Cruise: the rotors tilt so the unbalance drives **out-of-plane** bending at 480 rpm ($t$ = 4.52 mm, 1 kg mm per rotor). Compared with the 0.1 mm take-off amplitude, the tip amplitude is…"
        options={['much smaller, because 480 rpm is far below 2400 rpm', 'about the same', 'larger, about 0.2 mm']}
        answer={2}
        explain="The force is 25× smaller, $(480/2400)^2$, but out of plane the wing is $(w/t)^2$ ≈ 8700× more flexible and its first two critical speeds (64 and 404 rpm) now lie below 480 rpm. The tip moves about 0.22 mm (0.43 mm near 0.67L): more than at take-off, as 2022 B2.4 and 2023 B1.6(a) predict."
        tryIt="switch to cruise, set t = 4.52 mm and put speed B at 480 rpm."
        onApply={() => {
          setPlane('out');
          setTmm(4.52);
          setMe(1);
          setNA(2400);
          setNB(480);
        }}
      />
    </div>
  );
}
