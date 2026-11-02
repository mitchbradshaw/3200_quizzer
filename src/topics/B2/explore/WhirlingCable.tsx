// A mass on a flexible cable whirled about one end (top view). T(x) = Ω²[m l + ρl (l² − x²)/2] is largest at the hub;
// the in-plane frequencies scale with Ω, rise with the end mass and fall with a heavier cable (official 2018 B1.3–1.4,
// 2023 B1.1–1.2; tutorial W7.9). The course's quick estimates are compared with the exact variable-tension result.
import { useMemo, useRef, useState } from 'react';
import { rotatingCableTension } from '../../../physics/waves';
import { useRaf } from '../../../anim/hooks';
import { Area, Dot, Line, Plot, PlotText, VLine, sample } from '../../../plot/Plot';
import { Button, Legend, Readout, Readouts, SimLayout, Slider } from '../../../ui/kit';
import { PredictReveal } from '../../../ui/PredictReveal';
import { Rich } from '../../../ui/Rich';
import { rotatingCableW79, whirlingCableExact } from '../physics';

const TAU = 2 * Math.PI;
const W = 560;
const H = 250;
const HX = 280; // hub
const HY = 125;
const R = 104; // drawn cable length (px)
const NS = 40; // shape samples (whirlingCableExact returns 41)
const REV_HZ = 0.12; // on-screen revolutions per second (slowed down); the vibration keeps its true ratio to it
const AMP = 13; // px, drawn vibration amplitude
const MU_MIN = 0.25;
const MU_MAX = 200;

export default function WhirlingCable() {
  const [rpm, setRpm] = useState(120);
  const [m, setM] = useState(2); // kg
  const [rl, setRl] = useState(1); // kg/m
  const [l, setL] = useState(2); // m
  const W0 = (TAU * rpm) / 60;
  const mu = m / (rl * l);
  const exact = useMemo(() => whirlingCableExact(mu), [mu]);
  const w79 = mu >= 0.25 ? rotatingCableW79(mu).wOverOmega : NaN;
  const wFixed = Math.PI * Math.sqrt(mu);
  const wFree = (Math.PI / 2) * Math.sqrt(mu);
  const hz = (wOverOmega: number) => (wOverOmega * W0) / TAU;
  const Thub = rotatingCableTension(0, W0, m, rl, l);
  const Tmass = rotatingCableTension(l, W0, m, rl, l);
  const kN = Thub >= 1000;
  const tU = kN ? 1000 : 1;
  const tUnit = kN ? 'kN' : 'N';

  const tension = useMemo(() => sample((xi) => rotatingCableTension(xi * l, W0, m, rl, l) / tU, 0, 1, 60), [W0, m, rl, l, tU]);
  // Model curves against mu, computed once (the exact one needs a shooting solve per point).
  const models = useMemo(() => {
    const exactC = sample((x) => whirlingCableExact(x).wIn, MU_MIN, MU_MAX, 48, true);
    const w79C = sample((x) => rotatingCableW79(x).wOverOmega, MU_MIN, MU_MAX, 120, true);
    const fixedC = sample((x) => Math.PI * Math.sqrt(x), MU_MIN, MU_MAX, 2, true);
    const freeC = sample((x) => (Math.PI / 2) * Math.sqrt(x), MU_MIN, MU_MAX, 2, true);
    return { exactC, w79C, fixedC, freeC };
  }, []);

  // ---- animation: rotation at REV_HZ on screen; in-plane vibration at (w1/Omega) times that rate
  const wrapRef = useRef<HTMLDivElement>(null);
  const cableRef = useRef<SVGPathElement>(null);
  const massRef = useRef<SVGCircleElement>(null);
  const armRef = useRef<SVGLineElement>(null);
  const t = useRef(0);
  useRaf(
    (dt) => {
      t.current += dt;
      const phi = TAU * REV_HZ * t.current;
      const v = AMP * Math.sin(TAU * REV_HZ * exact.wIn * t.current);
      const ux = Math.cos(phi);
      const uy = Math.sin(phi);
      let d = '';
      for (let k = 0; k <= NS; k++) {
        const q = k / NS;
        const w = v * (exact.shape[k] ?? 0);
        const x = HX + R * q * ux - w * uy;
        const y = HY + R * q * uy + w * ux;
        d += `${k ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
      }
      cableRef.current?.setAttribute('d', d);
      const wm = v * (exact.shape[NS] ?? 0);
      massRef.current?.setAttribute('cx', (HX + R * ux - wm * uy).toFixed(1));
      massRef.current?.setAttribute('cy', (HY + R * uy + wm * ux).toFixed(1));
      armRef.current?.setAttribute('x2', (HX + R * ux).toFixed(1));
      armRef.current?.setAttribute('y2', (HY + R * uy).toFixed(1));
    },
    true,
    wrapRef
  );

  /** Presets that hit mu exactly within the slider ranges. */
  const preset = (target: 1 | 10) => {
    setL(2);
    setM(target === 1 ? 2 : 4);
    setRl(target === 1 ? 1 : 0.2);
  };
  const fmtT = (x: number) => (x >= 100 ? x.toFixed(0) : x.toPrecision(3));
  return (
    <div ref={wrapRef}>
      <SimLayout
        visual={
          <>
            <svg viewBox={`0 0 ${W} ${H}`} className="anim" role="img" aria-label="Top view of a cable with an end mass whirling about a hub, vibrating in its plane">
              <circle cx={HX} cy={HY} r={R} fill="none" stroke="var(--border)" strokeDasharray="4 5" />
              <line ref={armRef} x1={HX} y1={HY} x2={HX + R} y2={HY} stroke="var(--border)" strokeDasharray="2 4" />
              <path ref={cableRef} fill="none" stroke="var(--m1)" strokeWidth={2.6} strokeLinejoin="round" />
              <circle ref={massRef} cx={HX + R} cy={HY} r={11} fill="var(--surface-3)" stroke="var(--text-2)" strokeWidth={1.8} />
              <circle cx={HX} cy={HY} r={6} fill="var(--surface)" stroke="var(--text-2)" strokeWidth={2} />
              <text x={HX - 12} y={HY + 4} textAnchor="end" className="plot-note">
                hub A
              </text>
              <text x={12} y={20} className="plot-note">
                top view, slowed: the cable vibrates {exact.wIn.toFixed(2)} times per revolution
              </text>
              <text x={12} y={H - 10} className="plot-note">
                dashed: straight cable (no vibration)
              </text>
            </svg>
            <Plot x={{ min: 0, max: 1, label: 'position along the cable x/l (hub → mass)' }} y={{ min: 0, max: (1.12 * Thub) / tU, label: `tension (${tUnit})` }} height={190} ariaLabel="Tension along the whirling cable">
              <Area points={tension} color="var(--text-3)" opacity={0.15} />
              <Line points={tension} color="var(--text-2)" width={2.4} />
              <PlotText x={0} y={Thub / tU} dx={6} dy={-8}>
                {`hub: ${fmtT(Thub / tU)} ${tUnit}`}
              </PlotText>
              <PlotText x={1} y={Tmass / tU} anchor="end" dx={-6} dy={18}>
                {`at the mass: mΩ²l = ${fmtT(Tmass / tU)} ${tUnit}`}
              </PlotText>
            </Plot>
            <Plot
              x={{ min: MU_MIN, max: MU_MAX, log: true, label: 'μ = m/(ρₗ l): end mass ÷ cable mass' }}
              y={{ min: 0.5, max: 60, log: true, label: 'ω₁ / Ω (in plane)' }}
              height={230}
              ariaLabel="Fundamental in-plane frequency against the mass ratio for the exact model and the course estimates"
            >
              <Line points={models.freeC} color="var(--text-3)" dash="2 4" width={1.6} />
              <Line points={models.fixedC} color="var(--text-3)" dash="6 4" width={1.6} />
              <Line points={models.w79C} color="var(--text-2)" width={1.6} />
              <Line points={models.exactC} color="var(--m1)" width={2.8} />
              {mu >= MU_MIN && mu <= MU_MAX && (
                <>
                  <VLine x={mu} color="var(--accent)" dash={false} width={1} />
                  <Dot x={mu} y={exact.wIn} color="var(--m1)" r={5.5} label={`${exact.wIn.toFixed(2)} Ω`} labelPos="above" />
                </>
              )}
            </Plot>
            <Legend
              items={[
                { label: 'exact, variable tension (2023 WS)', color: 'var(--m1)' },
                { label: 'W7.9(c): constant tension mΩ²l', color: 'var(--text-2)' },
                { label: 'mass end treated as fixed: π√μ', color: 'var(--text-3)', dash: true },
                { label: 'treated as free: (π/2)√μ (dotted)', color: 'var(--text-3)', dash: true },
              ]}
            />
          </>
        }
        controls={
          <>
            <Slider label="spin speed" tex="\Omega" tip="rotation speed about the hub (rpm)" value={rpm} min={30} max={600} step={10} unit="rpm" onChange={setRpm} />
            <Slider label="end mass" tex="m" tip="mass at the end of the cable (kg)" value={m} min={0.5} max={10} log unit="kg" onChange={setM} />
            <Slider label="cable mass per length" tex="\rho_l" tip="mass per unit length of the cable (kg/m)" value={rl} min={0.1} max={1} log unit="kg/m" onChange={setRl} />
            <Slider label="cable length" tex="l" tip="cable length, hub to mass (m)" value={l} min={0.5} max={2} step={0.05} unit="m" onChange={setL} />
            <Readouts>
              <Readout tex="T_{hub}" tip="tension at the hub, Ω²(m l + ρl l²/2): the largest" value={Thub / tU} unit={tUnit} sig={3} />
              <Readout tex="T_{mass}" tip="tension next to the mass, m Ω² l" value={Tmass / tU} unit={tUnit} sig={3} />
              <Readout tex="\mu" tip="end mass ÷ cable mass, m/(ρl l): the only thing ω₁/Ω depends on" value={mu} sig={3} tone="accent" />
              <Readout tex="f_1" tip="exact in-plane fundamental (variable tension), Ω √(λ₂ − 1)/2π" value={hz(exact.wIn)} unit="Hz" sig={3} tone="m1" />
              <Readout tex="f_{fixed}" tip="estimate with the mass end fixed and tension mΩ²l: π√μ Ω/2π" value={hz(wFixed)} unit="Hz" sig={3} />
              <Readout label="fixed-end error" value={(wFixed / exact.wIn - 1) * 100} unit="%" sig={2} />
              <Readout tex="f_{W7.9}" tip="tutorial W7.9(c): β tan β = 1/μ, ω = Ω√(β²μ − 1)" value={hz(w79)} unit="Hz" sig={3} text={Number.isFinite(w79) ? undefined : '—'} />
              <Readout tex="f_{free}" tip="estimate with the mass end free: (π/2)√μ Ω/2π" value={hz(wFree)} unit="Hz" sig={3} />
            </Readouts>
            <Rich
              className="note"
              text={`Every tension is $\\propto \\Omega^2$, so $\\omega_1/\\Omega$ depends only on $\\mu$: here ${exact.wIn.toFixed(3)} in plane (${exact.wOut.toFixed(3)} out of plane). Treating the mass as a fixed end ignores the cable's own centrifugal tension, so it is low, and it gets better as the end mass grows.`}
            />
            <div className="row gap-s wrap">
              <span className="muted small">Presets:</span>
              <Button size="sm" onClick={() => preset(1)}>
                W7.9: m = cable mass (μ = 1)
              </Button>
              <Button size="sm" onClick={() => preset(10)}>
                heavy end mass (μ = 10)
              </Button>
            </div>
          </>
        }
      />
      <PredictReveal
        id="b2-wc-omega"
        question="Double the spin speed $\Omega$. The cable's natural frequencies…"
        options={['rise by √2', 'double', 'quadruple', 'fall: the cable is pulled straighter']}
        answer={1}
        explain="Every tension is proportional to $\Omega^2$, so the wave speed $c = \sqrt{T/\rho_l}$ and every natural frequency are proportional to $\Omega$ (the ratio $\omega_1/\Omega$ depends only on $\mu$). More tension raises the frequencies: the official 2018 B1.4 options claiming the opposite, or the right direction for the wrong reason, are false."
        tryIt="note f₁, then double Ω."
        onApply={() => setRpm((v) => Math.min(600, 2 * v))}
      />
      <PredictReveal
        id="b2-wc-rhol"
        question="Use a cable twice as heavy per metre (same end mass, length and speed). The frequencies…"
        options={['rise, because the tension rises', 'fall, although the tension rises', 'fall, because the tension falls', 'do not change']}
        answer={1}
        explain="The cable's own centrifugal force raises the tension, but $c^2 = T/\rho_l = \Omega^2[ml/\rho_l + \tfrac12(l^2 - x^2)]$ falls: the inertia grows faster than the tension. This was the correct option of official 2018 B1.4; 2023 B1.2 kept only the wrong-reason versions, so its answer was “None of the above”."
        tryIt="watch the hub tension rise while f₁ falls."
        onApply={() => setRl((v) => Math.min(1, 2 * v))}
      />
      <PredictReveal
        id="b2-wc-fixed"
        question="Treat the end mass as a fixed end (tension $m\Omega^2 l$ everywhere). Compared with the exact variable-tension result, that estimate is…"
        options={['exact', 'too low, and closer as the end mass grows', 'too high', 'better if the mass is treated as free instead']}
        answer={1}
        explain="It ignores the cable's own centrifugal tension, so it is low: −16 % at $\mu = 1$, −2 % at $\mu = 10$. Treating the mass as free is far worse (−58 % at $\mu = 1$, tending to −50 % for a heavy end mass). So “the mass can be modelled as fixed without loss of accuracy” (official 2018 B1.3(d)) is false, although fixed is the better of the two quick models (tutorial W7.9)."
        tryIt="press μ = 1, read the fixed-end error, then μ = 10."
        onApply={() => preset(1)}
      />
    </div>
  );
}
