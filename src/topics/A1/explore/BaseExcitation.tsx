// Base excitation: transmissibility T = X/Y = F_T/F₀ against r, isolation zone, moving operating point and an animation.
import { useMemo, useRef, useState } from 'react';
import { relativeMotionRatio, transmissibility } from '../../../physics/sdof';
import { useRaf } from '../../../anim/hooks';
import { Band, Handle, Line, Plot, VLine, sample } from '../../../plot/Plot';
import { Badge, Button, Legend, Readout, Readouts, SimLayout, Slider, Toggle } from '../../../ui/kit';
import { PredictReveal } from '../../../ui/PredictReveal';
import { Spring, Damper } from '../../../ui/diagrams';

const REF_ZETAS = [0, 0.1, 0.25, 0.5, 1];

/** Absolute phase lag of the mass behind the base (rad). */
function basePhase(r: number, z: number) {
  return Math.atan2(2 * z * r * r * r, 1 - r * r + 4 * z * z * r * r);
}

export default function BaseExcitation() {
  const [zeta, setZeta] = useState(0.1);
  const [r, setR] = useState(2.5);
  const [Y, setY] = useState(5);
  const [log, setLog] = useState(false);
  const [rel, setRel] = useState(false);
  const T = transmissibility(r, zeta);
  const Z = relativeMotionRatio(r, zeta);
  const psi = basePhase(r, zeta);
  const xr = log ? { min: 0.1, max: 10, log: true, label: 'r = Ω/ωₙ (log)' } : { min: 0, max: 4, label: 'r = Ω/ωₙ' };
  const yr = log ? { min: 0.01, max: 30, log: true, label: 'T = X/Y (log)' } : { min: 0, max: 6, label: 'T = X/Y = F_T/F₀' };
  const a = log ? 0.1 : 0.001;
  const b = log ? 10 : 4;
  const refs = useMemo(() => REF_ZETAS.map((z) => sample((x) => transmissibility(x, z), a, b, 500, log)), [a, b, log]);
  const cur = useMemo(() => sample((x) => transmissibility(x, zeta), a, b, 500, log), [zeta, a, b, log]);
  const relc = useMemo(() => sample((x) => relativeMotionRatio(x, zeta), a, b, 400, log), [zeta, a, b, log]);

  // Animation: base moves y = Y sin(ωt); mass moves x = T·Y sin(ωt − ψ) (slowed to 0.7 Hz on screen).
  const wrapRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<SVGGElement>(null);
  const massRef = useRef<SVGGElement>(null);
  const springRef = useRef<SVGGElement>(null);
  const t = useRef(0);
  const yPx = 12;
  const xPx = Math.min(60, T * yPx);
  useRaf(
    (dt) => {
      t.current += dt;
      const w = 2 * Math.PI * 0.7 * t.current;
      const yb = yPx * Math.sin(w);
      const xm = xPx * Math.sin(w - psi);
      baseRef.current?.setAttribute('transform', `translate(0 ${(-yb).toFixed(1)})`);
      massRef.current?.setAttribute('transform', `translate(0 ${(-xm).toFixed(1)})`);
      // spring/damper stretch between base top (y = 170 - yb) and mass bottom (y = 92 - xm): rebuild via scale
      const top = 92 - xm + 26;
      const bot = 170 - yb;
      springRef.current?.setAttribute('transform', `translate(0 ${top.toFixed(1)}) scale(1 ${((bot - top) / 52).toFixed(3)})`);
    },
    true,
    wrapRef
  );

  const verdict = T < 0.999 ? `isolating: transmits ${(T * 100).toFixed(0)} %` : T > 1.001 ? `amplifying ×${T.toFixed(2)}` : 'T = 1 (no gain, no isolation)';

  return (
    <div ref={wrapRef}>
      <SimLayout
        visual={
          <>
            <Plot x={xr} y={yr} height={280} ariaLabel="Transmissibility against frequency ratio">
              <Band x0={Math.SQRT2} x1={b} color="var(--ok)" opacity={0.08} label="isolation: T < 1" />
              {refs.map((pts, i) => (
                <Line key={i} points={pts} color="var(--text-3)" width={1} opacity={0.45} />
              ))}
              {rel && <Line points={relc} color="var(--m2)" dash width={2} />}
              <Line points={cur} color="var(--m1)" width={2.6} />
              <VLine x={Math.SQRT2} label="r = √2" />
              <Handle x={r} y={T} axis="x" clampX={[log ? 0.1 : 0.01, b]} onChange={(x) => setR(x)} color="var(--m2)" label="running speed" />
            </Plot>
            <Legend
              items={[
                { label: `T for ζ = ${zeta.toFixed(2)}`, color: 'var(--m1)' },
                ...(rel ? [{ label: 'relative motion Z/Y', color: 'var(--m2)', dash: true }] : []),
                { label: 'ζ = 0, 0.1, 0.25, 0.5, 1', color: 'var(--text-3)' },
              ]}
            />
          </>
        }
        controls={
          <>
            <Slider label="damping ratio" tex="\zeta" tip="ζ = c/c_c" value={zeta} min={0} max={1} step={0.005} sig={3} onChange={setZeta} />
            <Slider label="frequency ratio" tex="r" tip="running speed / natural frequency" value={r} min={log ? 0.1 : 0.01} max={b} step={0.005} sig={3} onChange={setR} />
            <Slider label="base amplitude" tex="Y" tip="ground/floor amplitude" value={Y} min={0.5} max={60} step={0.5} unit="mm" onChange={setY} />
            <div className="row gap-s wrap">
              <Toggle checked={log} onChange={setLog} label="log–log axes" />
              <Toggle checked={rel} onChange={setRel} label="show relative motion Z/Y" />
            </div>
            <Readouts>
              <Readout tex="T" tip="transmissibility X/Y (= F_T/F₀)" value={T} sig={3} tone={T < 1 ? 'ok' : 'bad'} />
              <Readout tex="X" tip="mass amplitude T·Y" value={T * Y} unit="mm" sig={3} />
              <Readout tex="Z" tip="spring stretch |x − y|" value={Z * Y} unit="mm" sig={3} />
              <Readout tex="\psi" tip="phase lag of the mass behind the base" value={(psi * 180) / Math.PI} unit="°" sig={3} />
            </Readouts>
            <Badge tone={T < 1 ? 'ok' : 'bad'}>{verdict}</Badge>
            <svg viewBox="0 0 200 200" className="anim" style={{ maxWidth: 220 }} role="img" aria-label="Mass on a spring and damper above a moving base">
              <g ref={massRef}>
                <rect x={60} y={66} width={80} height={52} rx={5} fill="var(--surface-2)" stroke="var(--m1)" strokeWidth={2} />
                <text x={100} y={97} textAnchor="middle" className="diagram-label">
                  m
                </text>
              </g>
              <g ref={springRef}>
                <Spring x1={80} y1={0} x2={80} y2={52} coils={5} amp={7} />
                <Damper x1={120} y1={0} x2={120} y2={52} />
              </g>
              <g ref={baseRef}>
                <rect x={40} y={170} width={120} height={14} rx={3} fill="var(--surface-3)" stroke="var(--m2)" strokeWidth={2} />
                <text x={100} y={198} textAnchor="middle" className="plot-note">
                  base y = Y sin Ωt
                </text>
              </g>
            </svg>
            <div className="row gap-s wrap">
              <span className="muted small">Exam presets:</span>
              <Button
                size="sm"
                onClick={() => {
                  setLog(false);
                  setZeta(0.225);
                  setR(0.957);
                  setY(5);
                }}
              >
                2021 building
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setLog(true);
                  setZeta(0.064);
                  setR(9.12);
                  setY(53.5);
                }}
              >
                Week 1 floor
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setLog(false);
                  setZeta(0);
                  setR(2.75);
                  setY(30);
                }}
              >
                2022 camera
              </Button>
            </div>
          </>
        }
      />
      <PredictReveal
        id="a1-base-damping-above"
        question="Running at $r = 5$, you raise $\zeta$ from 0.05 to 0.3. The transmissibility…"
        options={['falls', 'rises', 'stays the same']}
        answer={1}
        explain="Above $r = \sqrt2$ the damper passes force to the mass: $T \to 2\zeta/r$ instead of $1/r^2$. At $r = 5$, T goes 0.047 → 0.131. Isolators need **low** damping, just enough to pass resonance at start-up (official 2018 A3.7; 2025 A3.5)."
        tryIt="drag the running speed to r = 5, then raise ζ."
        onApply={() => {
          setLog(true);
          setR(5);
          setZeta(0.3);
        }}
      />
      <PredictReveal
        id="a1-base-root2"
        question="At $r = \sqrt2$, which damping gives the larger transmissibility: $\zeta = 0.1$ or $\zeta = 0.5$?"
        options={['ζ = 0.1', 'ζ = 0.5', 'Neither: T = 1 for every ζ']}
        answer={2}
        explain="At $r = \sqrt2$, $(1-r^2)^2 = 1$, so numerator and denominator of $T^2$ are both $1 + (2\zeta r)^2$. Every curve passes through (√2, 1): that is where isolation begins."
        tryIt="drag to the dashed √2 line and move ζ."
        onApply={() => setR(Math.SQRT2)}
      />
      <PredictReveal
        id="a1-base-relative"
        question="Where does the **relative** deflection (spring stretch) peak: below, at or above $\omega_n$?"
        options={['Below ωₙ', 'At ωₙ', 'Above ωₙ']}
        answer={2}
        explain="$Z/Y = r^2/\sqrt{(1-r^2)^2+(2\zeta r)^2}$ peaks at $r = 1/\sqrt{1-2\zeta^2}$, just above 1, while the absolute $T$ peak is just below 1. At $r = 1$ the stretch is exactly $Y/(2\zeta)$, which is not the mass's motion (2021 A1.2 trap)."
        tryIt="turn on the relative-motion curve with ζ ≈ 0.3."
        onApply={() => {
          setRel(true);
          setZeta(0.3);
          setLog(false);
          setR(1 / Math.sqrt(1 - 2 * 0.09));
        }}
      />
    </div>
  );
}
