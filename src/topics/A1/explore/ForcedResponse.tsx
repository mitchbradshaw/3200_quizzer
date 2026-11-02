// Force on the mass: amplitude and phase against r, with a draggable operating point and a phasor picture.
import { useMemo, useRef, useState } from 'react';
import { magnification, naturalFrequency, peakRatioForce, phaseLag } from '../../../physics/sdof';
import { useRaf } from '../../../anim/hooks';
import { Dot, Handle, Line, Plot, VLine, sample } from '../../../plot/Plot';
import { Legend, Readout, Readouts, SimLayout, Slider } from '../../../ui/kit';
import { PredictReveal } from '../../../ui/PredictReveal';
import { Rich } from '../../../ui/Rich';

const REF_ZETAS = [0.05, 0.1, 0.2, 0.5, 1];
const RMAX = 3;

export default function ForcedResponse() {
  const [zeta, setZeta] = useState(0.1);
  const [r, setR] = useState(0.6);
  const [m, setM] = useState(10);
  const [k, setK] = useState(1000);
  const [F0, setF0] = useState(17);
  const wn = naturalFrequency(k, m);
  const ratio = magnification(r, zeta);
  const phi = phaseLag(r, zeta);
  const rp = peakRatioForce(zeta);
  const dst = F0 / k;

  const refs = useMemo(() => REF_ZETAS.map((z) => sample((x) => magnification(x, z), 0, RMAX, 300)), []);
  const amp = useMemo(() => sample((x) => magnification(x, zeta), 0, RMAX, 400), [zeta]);
  const ph = useMemo(() => sample((x) => (phaseLag(x, zeta) * 180) / Math.PI, 0, RMAX, 300), [zeta]);

  // Phasors: force (orange) and displacement (blue) rotating together, displacement lagging by φ.
  const wrapRef = useRef<HTMLDivElement>(null);
  const fRef = useRef<SVGLineElement>(null);
  const xRef = useRef<SVGLineElement>(null);
  const massRef = useRef<SVGRectElement>(null);
  const arrowRef = useRef<SVGLineElement>(null);
  const t = useRef(0);
  const L = Math.min(70, 22 * ratio);
  useRaf(
    (dt) => {
      t.current += dt;
      const a = 2 * Math.PI * 0.4 * t.current;
      const fx = 80 + 52 * Math.cos(a);
      const fy = 80 - 52 * Math.sin(a);
      const xx = 80 + L * Math.cos(a - phi);
      const xy = 80 - L * Math.sin(a - phi);
      fRef.current?.setAttribute('x2', fx.toFixed(1));
      fRef.current?.setAttribute('y2', fy.toFixed(1));
      xRef.current?.setAttribute('x2', xx.toFixed(1));
      xRef.current?.setAttribute('y2', xy.toFixed(1));
      massRef.current?.setAttribute('y', (xy - 12).toFixed(1));
      arrowRef.current?.setAttribute('y2', fy.toFixed(1));
    },
    true,
    wrapRef
  );

  return (
    <div ref={wrapRef}>
      <SimLayout
        visual={
          <>
            <Plot x={{ min: 0, max: RMAX, label: 'frequency ratio r = Ω/ωₙ' }} y={{ min: 0, max: 10, label: 'X / (F₀/k)' }} height={250} ariaLabel="Amplitude ratio against frequency ratio">
              {refs.map((pts, i) => (
                <Line key={i} points={pts} color="var(--text-3)" width={1} opacity={0.45} />
              ))}
              <Line points={amp} color="var(--m1)" width={2.6} />
              {Number.isFinite(rp) && <Dot x={rp} y={magnification(rp, zeta)} color="var(--m1)" hollow label="peak" labelPos="above" />}
              <VLine x={1} label="r = 1" />
              <Handle x={r} y={Math.min(ratio, 10)} axis="x" onChange={(x) => setR(Math.max(0.01, x))} clampX={[0.01, RMAX]} color="var(--m2)" label="operating point" />
            </Plot>
            <Plot x={{ min: 0, max: RMAX, label: 'r' }} y={{ min: 0, max: 180, label: 'phase lag φ (°)', ticks: [0, 45, 90, 135, 180] }} height={170} ariaLabel="Phase lag against frequency ratio">
              <Line points={ph} color="var(--m1)" width={2.2} />
              <VLine x={1} />
              <Dot x={r} y={(phi * 180) / Math.PI} color="var(--m2)" />
            </Plot>
          </>
        }
        controls={
          <>
            <Slider label="damping ratio" tex="\zeta" tip="ζ = c/c_c" value={zeta} min={0.02} max={1} log sig={3} onChange={setZeta} />
            <Slider label="frequency ratio" tex="r" tip="r = Ω/ωₙ (drag the orange point too)" value={r} min={0.01} max={RMAX} step={0.005} sig={3} onChange={setR} />
            <details className="more">
              <summary>Physical values (m, k, F₀)</summary>
              <div className="more-body">
                <Slider label="mass" tex="m" value={m} min={1} max={50} step={0.5} unit="kg" onChange={setM} />
                <Slider label="stiffness" tex="k" value={k} min={200} max={20000} log unit="N/m" onChange={setK} />
                <Slider label="force amplitude" tex="F_0" value={F0} min={1} max={100} step={1} unit="N" onChange={setF0} />
              </div>
            </details>
            <Readouts>
              <Readout tex="X/\delta_{st}" tip="dynamic magnification" value={ratio} sig={3} tone="m1" />
              <Readout tex="\varphi" tip="phase lag of x behind F" value={(phi * 180) / Math.PI} unit="°" sig={3} />
              <Readout tex="X" tip="steady-state amplitude" value={ratio * dst * 1000} unit="mm" sig={3} />
              <Readout tex="\Omega" tip="forcing frequency" value={(r * wn) / (2 * Math.PI)} unit="Hz" sig={3} />
              <Readout tex="r_{peak}" tip="√(1 − 2ζ²): below 1" value={rp} sig={3} text={Number.isFinite(rp) ? undefined : 'no peak'} />
              <Readout tex="1/2\zeta" tip="amplitude ratio at r = 1" value={1 / (2 * zeta)} sig={3} />
            </Readouts>
            <svg viewBox="0 0 200 160" className="anim" style={{ maxWidth: 260 }} role="img" aria-label="Rotating phasors: force and displacement">
              <circle cx={80} cy={80} r={52} fill="none" stroke="var(--border)" />
              <line x1={80} y1={80} x2={132} y2={80} ref={fRef} stroke="var(--m2)" strokeWidth={3} strokeLinecap="round" />
              <line x1={80} y1={80} x2={80} y2={80} ref={xRef} stroke="var(--m1)" strokeWidth={3} strokeLinecap="round" />
              <line x1={168} y1={80} x2={168} y2={80} ref={arrowRef} stroke="var(--m2)" strokeWidth={2} />
              <rect ref={massRef} x={156} y={68} width={24} height={24} rx={3} fill="var(--surface-2)" stroke="var(--m1)" strokeWidth={2} />
              <line x1={150} y1={80} x2={186} y2={80} stroke="var(--text-3)" strokeDasharray="2 3" />
            </svg>
            <Legend
              items={[
                { label: 'force F', color: 'var(--m2)' },
                { label: 'displacement x', color: 'var(--m1)' },
              ]}
            />
            <Rich className="note" text={r < 1 ? 'Below resonance: stiffness-controlled, x nearly in phase with F.' : r > 1 ? 'Above resonance: inertia-controlled, x lags towards 180°.' : 'At resonance: damping-controlled, 90° lag.'} />
          </>
        }
      />
      <PredictReveal
        id="a1-forced-r1"
        question="With $\zeta = 0.05$, at $r = 1$ the amplitude is how many static deflections $F_0/k$?"
        options={['about 1', 'about 5', '10', '20']}
        answer={2}
        explain="At $r = 1$ the spring and inertia forces cancel and only the damper resists: $X = F_0/(2\zeta k)$, i.e. $1/(2\zeta) = 10$ static deflections."
        tryIt="set ζ to 0.05 and drag the orange point to r = 1."
        onApply={() => {
          setZeta(0.05);
          setR(1);
        }}
      />
      <PredictReveal
        id="a1-forced-peak"
        question="With $\zeta = 0.3$, where is the amplitude peak?"
        options={['Below r = 1', 'Exactly at r = 1', 'Above r = 1']}
        answer={0}
        explain="The force-response peak is at $r = \sqrt{1-2\zeta^2}$ = 0.906 for ζ = 0.3, below $\omega_n$. (The relative-deflection peak of base excitation sits above it; say which one you quote.)"
        tryIt="set ζ = 0.3 and find the top of the blue curve."
        onApply={() => {
          setZeta(0.3);
          setR(Math.sqrt(1 - 2 * 0.09));
        }}
      />
      <PredictReveal
        id="a1-forced-phase"
        question="Well above resonance ($r = 3$), the mass moves… relative to the force."
        options={['in phase', '90° behind', 'almost 180° behind (opposite)']}
        answer={2}
        explain="Above $\omega_n$ the response is inertia-controlled and lags by nearly 180°: the mass moves opposite to the force. Below $\omega_n$ it is stiffness-controlled (in phase); at resonance the lag is exactly 90° for any ζ."
        tryIt="drag the operating point to r = 3 and watch the phasors."
        onApply={() => setR(3)}
      />
    </div>
  );
}
