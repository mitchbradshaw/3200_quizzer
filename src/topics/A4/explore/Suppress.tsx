// Suppressed coordinate (2023 A2.5, 2025 A2.4): a rigid platform with bounce x and pitch θ on two springs, driven by
// a vertical harmonic force at an adjustable position. X = Δ₁/Δ and Θ = Δ₂/Δ each have their own zero; at the
// bounce zero the centre of mass stands still and the platform only rocks.
import { useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { modes } from '../../../physics/mdof';
import { useRaf } from '../../../anim/hooks';
import { springPath, svgPoint } from '../../../ui/diagrams';
import { Handle, Line, Plot, VLine } from '../../../plot/Plot';
import { Button, Readout, Readouts, SimLayout, Slider } from '../../../ui/kit';
import { PredictReveal } from '../../../ui/PredictReveal';
import { Rich } from '../../../ui/Rich';
import { featureGrid, ladderCeil } from '../physics';
import { fmt } from '../../../engine/format';

const M_ = 20; // kg
const I_ = 2.4; // kg m² (uniform 1.2 m bar)
const D = 0.4; // springs at ±0.4 m from the centre of mass
const HALF = 0.6; // half-length of the platform (m)
const PX = 300; // px per metre in the drawing
const CX = 260;
const BAR_Y = 92;
const GROUND_Y = 186;

/** Amplitudes per newton (m/N, rad/N) of bounce and pitch for an upward force at position a (θ anticlockwise). */
function response(K11: number, K12: number, K22: number, a: number, W: number) {
  const W2 = W * W;
  const d11 = K11 - M_ * W2;
  const d22 = K22 - I_ * W2;
  const det = d11 * d22 - K12 * K12;
  return { X: (d22 - a * K12) / det, T: (a * d11 - K12) / det, det };
}

export default function Suppress() {
  const [kL, setKL] = useState(1500);
  const [kR, setKR] = useState(4000);
  const [a, setA] = useState(0);
  const [W, setW] = useState(14);
  const K11 = kL + kR;
  const K12 = D * (kR - kL);
  const K22 = D * D * (kL + kR);
  const md = useMemo(() => modes([[K11, K12], [K12, K22]], [[M_, 0], [0, I_]]), [K11, K12, K22]);
  const [w1, w2] = md.omega;
  // With equal springs (K12 = 0) bounce and pitch decouple: each numerator then cancels a factor of Δ, so the
  // "zeros" below would be the other coordinate's resonance, not anti-resonances (X = 1/(K11 − mΩ²), Θ = a/(K22 − IΩ²)).
  const coupled = Math.abs(K12) > 1e-9 * K11 * D;
  const wx2 = (K22 - a * K12) / I_;
  const wx = coupled && wx2 > 0 ? Math.sqrt(wx2) : NaN; // bounce suppressed
  const wt2 = coupled && Math.abs(a) > 1e-6 ? (K11 - K12 / a) / M_ : NaN;
  const wt = wt2 > 0 ? Math.sqrt(wt2) : NaN; // pitch suppressed
  const xMax = ladderCeil(1.4 * w2);
  const Wc = Math.min(W, xMax);

  const curves = useMemo(() => {
    const xs = featureGrid(0.3, xMax, 520, [w1, w2, wx, wt].filter((v) => Number.isFinite(v)));
    const yx = new Float64Array(xs.length);
    const yt = new Float64Array(xs.length);
    for (let i = 0; i < xs.length; i++) {
      const r = response(K11, K12, K22, a, xs[i]);
      yx[i] = Math.abs(r.X) * 1000;
      yt[i] = Math.abs(r.T) * HALF * 1000;
    }
    return { x: { x: xs, y: yx }, t: { x: xs, y: yt } };
  }, [K11, K12, K22, a, xMax, w1, w2, wx, wt]);

  const r = response(K11, K12, K22, a, Wc);
  const node = Math.abs(r.T) > 1e-15 ? -r.X / r.T : Infinity;
  const stat = response(K11, K12, K22, 0, 0);
  const ref = Math.max(Math.abs(stat.X) + HALF * Math.abs(stat.T), 1e-9);
  const span = Math.abs(r.X) + HALF * Math.abs(r.T);
  const scale = 36 / Math.max(span, 2.5 * ref); // px per (m/N)

  // ------------------------------------------------------------- animation (refs only)
  const svgRef = useRef<SVGSVGElement>(null);
  const barRef = useRef<SVGLineElement>(null);
  const kLRef = useRef<SVGPathElement>(null);
  const kRRef = useRef<SVGPathElement>(null);
  const fRef = useRef<SVGPathElement>(null);
  const comRef = useRef<SVGGElement>(null);
  const t = useRef(0);
  const dragging = useRef(false);
  const yAt = (s: number, ph: number) => BAR_Y - (r.X + s * r.T) * scale * Math.sin(ph);
  useRaf(
    (dt) => {
      t.current += dt;
      const ph = 2 * Math.PI * 0.6 * t.current;
      const yl = yAt(-HALF, ph);
      const yr = yAt(HALF, ph);
      barRef.current?.setAttribute('y1', yl.toFixed(1));
      barRef.current?.setAttribute('y2', yr.toFixed(1));
      kLRef.current?.setAttribute('d', springPath(CX - D * PX, GROUND_Y, CX - D * PX, yAt(-D, ph) + 6, 6, 8));
      kRRef.current?.setAttribute('d', springPath(CX + D * PX, GROUND_Y, CX + D * PX, yAt(D, ph) + 6, 6, 8));
      comRef.current?.setAttribute('transform', `translate(0 ${(yAt(0, ph) - BAR_Y).toFixed(1)})`);
      const xa = CX + a * PX;
      const ya = yAt(a, ph) - 8;
      const len = 30 * Math.sin(ph); // upward force positive
      const tip = ya - 6 - len;
      const h = Math.min(7, Math.abs(len));
      const sg = Math.sign(len) || 1;
      fRef.current?.setAttribute('d', `M${xa.toFixed(1)} ${(ya - 6).toFixed(1)}L${xa.toFixed(1)} ${tip.toFixed(1)}M${(xa - 4).toFixed(1)} ${(tip + sg * h).toFixed(1)}L${xa.toFixed(1)} ${tip.toFixed(1)}L${(xa + 4).toFixed(1)} ${(tip + sg * h).toFixed(1)}`);
    },
    true,
    svgRef
  );

  const onPointer = (e: RPointerEvent<SVGRectElement>, phase: 'down' | 'move' | 'up') => {
    if (phase === 'down') {
      dragging.current = true;
      (e.currentTarget as SVGRectElement).setPointerCapture(e.pointerId);
    }
    if (!dragging.current || !svgRef.current) return;
    const p = svgPoint(svgRef.current, e.clientX, e.clientY);
    setA(Math.max(-HALF, Math.min(HALF, Math.round(((p.x - CX) / PX) * 100) / 100)));
    if (phase === 'up') dragging.current = false;
  };

  const f3 = (v: number) => fmt(v, 3);
  const nodeTxt = !Number.isFinite(node) ? 'pure bounce: no still point' : Math.abs(node) < 0.005 ? 'the still point is the centre of mass (s = 0)' : Math.abs(node) <= HALF ? `the still point is at s = ${f3(node)} m` : `the still point is off the platform (s = ${f3(node)} m)`;
  const tidy = (v: number) => (Math.abs(v) < 1e-9 ? 0 : v); // hide round-off at an exact zero

  return (
    <div>
      <SimLayout
        visual={
          <>
            <svg ref={svgRef} viewBox="0 0 520 214" className="anim" style={{ maxWidth: 560, margin: '0 auto' }} role="img" aria-label="Rigid platform on two springs with a harmonic force; drag along the platform to move the force">
              <g stroke="var(--text-3)" strokeWidth={1.2}>
                <line x1={40} y1={GROUND_Y} x2={480} y2={GROUND_Y} strokeWidth={2} />
                {Array.from({ length: 22 }, (_, i) => (
                  <line key={i} x1={44 + i * 20} y1={GROUND_Y} x2={38 + i * 20} y2={GROUND_Y + 8} />
                ))}
              </g>
              <line x1={CX - HALF * PX} x2={CX + HALF * PX} y1={BAR_Y} y2={BAR_Y} stroke="var(--text-3)" strokeDasharray="3 4" />
              <path ref={kLRef} fill="none" stroke="var(--text-2)" strokeWidth={1.8} />
              <path ref={kRRef} fill="none" stroke="var(--text-2)" strokeWidth={1.8} />
              <text x={CX - D * PX - 14} y={150} className="diagram-label" textAnchor="end" style={{ fontSize: 16 }}>
                k
                <tspan dy={4} style={{ fontSize: 11 }}>
                  L
                </tspan>
              </text>
              <text x={CX + D * PX + 14} y={150} className="diagram-label" style={{ fontSize: 16 }}>
                k
                <tspan dy={4} style={{ fontSize: 11 }}>
                  R
                </tspan>
              </text>
              <text x={CX} y={GROUND_Y + 22} className="plot-note" textAnchor="middle">
                ⊕ centre of mass · springs 0.4 m either side · platform 1.2 m, 20 kg
              </text>
              <line ref={barRef} x1={CX - HALF * PX} x2={CX + HALF * PX} y1={BAR_Y} y2={BAR_Y} stroke="var(--text-2)" strokeWidth={9} strokeLinecap="round" />
              <g ref={comRef}>
                <circle cx={CX} cy={BAR_Y} r={6} fill="var(--surface)" stroke="var(--text)" strokeWidth={1.5} />
                <path d={`M${CX - 6} ${BAR_Y}L${CX + 6} ${BAR_Y}M${CX} ${BAR_Y - 6}L${CX} ${BAR_Y + 6}`} stroke="var(--text)" strokeWidth={1.2} />
              </g>
              {Number.isFinite(node) && Math.abs(node) <= HALF && (
                <path d={`M${CX + node * PX} ${BAR_Y + 14}l-6 10h12z`} fill="var(--ok)" opacity={0.9}>
                  <title>still point of the forced motion</title>
                </path>
              )}
              <path ref={fRef} fill="none" stroke="var(--accent)" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
              <text x={CX + a * PX} y={22} className="plot-note" textAnchor="middle" fill="var(--accent)" style={{ fontSize: 14 }}>
                F₀ sin Ωt
              </text>
              <rect
                x={CX - HALF * PX - 10}
                y={BAR_Y - 60}
                width={2 * HALF * PX + 20}
                height={90}
                fill="transparent"
                style={{ cursor: 'ew-resize', touchAction: 'none' }}
                onPointerDown={(e) => onPointer(e, 'down')}
                onPointerMove={(e) => onPointer(e, 'move')}
                onPointerUp={(e) => onPointer(e, 'up')}
              />
            </svg>
            <Plot x={{ min: 0, max: xMax, label: 'forcing frequency Ω (rad/s)' }} y={{ min: 1e-4, max: 10, log: true, label: 'amplitude per N (mm/N)' }} height={230} ariaLabel="Bounce and pitch amplitudes against forcing frequency">
              <VLine x={w1} color="var(--m1)" label="ω₁" />
              <VLine x={w2} color="var(--m2)" label="ω₂" />
              {Number.isFinite(wx) && <VLine x={wx} color="var(--text)" dash="2 3" label="x = 0" labelY="bottom" />}
              {Number.isFinite(wt) && <VLine x={wt} color="var(--text-2)" dash="2 3" label="θ = 0" labelY="bottom" />}
              <Line points={curves.x} color="var(--text)" width={2.3} />
              <Line points={curves.t} color="var(--text-2)" width={2} dash="7 4" />
              <Handle x={Wc} y={Math.max(1.2e-4, Math.min(8, Math.abs(r.X) * 1000))} axis="x" clampX={[0.3, xMax]} onChange={(x) => setW(x)} color="var(--accent)" ariaLabel="forcing frequency Ω" />
            </Plot>
            <div className="legend">
              <span className="legend-item">
                <svg width="22" height="10" aria-hidden="true">
                  <line x1="1" y1="5" x2="21" y2="5" stroke="var(--text)" strokeWidth="2.5" />
                </svg>
                bounce |X| of the centre of mass
              </span>
              <span className="legend-item">
                <svg width="22" height="10" aria-hidden="true">
                  <line x1="1" y1="5" x2="21" y2="5" stroke="var(--text-2)" strokeWidth="2.5" strokeDasharray="7 4" />
                </svg>
                pitch: edge motion 0.6|Θ|
              </span>
            </div>
            <p className="muted small">Drag along the platform to move the force; drag the ring to change Ω. The green marker is the point that stands still. Animation slowed to 0.6 Hz.</p>
          </>
        }
        controls={
          <>
            <Slider label="force position" tex="a" tip="where the vertical force acts, measured from the centre of mass (+ to the right)" value={a} min={-HALF} max={HALF} step={0.01} unit="m" onChange={setA} />
            <Slider label="forcing frequency" tex="\Omega" tip="frequency of F₀ sin Ωt" value={Wc} min={0.3} max={xMax} step={xMax / 1000} unit="rad/s" onChange={setW} />
            <Slider label="left spring" tex="k_L" tip="spring at 0.4 m left of the centre of mass" value={kL} min={300} max={8000} log unit="N/m" onChange={setKL} />
            <Slider label="right spring" tex="k_R" tip="spring at 0.4 m right of the centre of mass" value={kR} min={300} max={8000} log unit="N/m" onChange={setKR} />
            <Readouts>
              <Readout tex="\omega_1" tip="lower natural frequency (bounce–pitch mode 1)" value={w1} unit="rad/s" tone="m1" />
              <Readout tex="\omega_2" tip="upper natural frequency" value={w2} unit="rad/s" tone="m2" />
              <Readout tex="K_{12}" tip="coupling stiffness 0.4(k_R − k_L)" value={K12} unit="N" sig={3} />
              <Readout label="x = 0 at" tip="Ω² = (K₂₂ − aK₁₂)/I: bounce suppressed" value={wx} unit="rad/s" text={Number.isFinite(wx) ? undefined : 'none'} />
              <Readout label="θ = 0 at" tip="Ω² = (K₁₁ − K₁₂/a)/m: pitch suppressed (never when a = 0)" value={wt} unit="rad/s" text={Number.isFinite(wt) ? undefined : !coupled && Math.abs(a) < 1e-6 ? 'always (not excited)' : Math.abs(a) < 1e-6 ? 'never' : 'none'} />
              <Readout tex="X/F_0" tip="bounce amplitude per newton (signed)" value={tidy(r.X * 1000)} unit="mm/N" sig={3} />
              <Readout tex="\Theta/F_0" tip="pitch amplitude per newton (signed, anticlockwise +)" value={tidy(r.T * 1000)} unit="mrad/N" sig={3} />
            </Readouts>
            <Rich className="note" text={`At $\\Omega$ = ${Wc.toFixed(2)} rad/s ${nodeTxt}.`} />
            <div className="row gap-s wrap">
              <span className="muted small">Go to:</span>
              {Number.isFinite(wx) && (
                <Button size="sm" onClick={() => setW(wx)}>
                  bounce zero
                </Button>
              )}
              {Number.isFinite(wt) && (
                <Button size="sm" onClick={() => setW(wt)}>
                  pitch zero
                </Button>
              )}
              <Button size="sm" onClick={() => { setKL(1500); setKR(4000); setA(0); }}>
                force at CoM
              </Button>
              <Button size="sm" onClick={() => { setKL(1500); setKR(4000); setA(-0.6); }}>
                force at left edge
              </Button>
            </div>
          </>
        }
      />
      <PredictReveal
        id="a4-sup-com"
        question="Unequal springs, force at the centre of mass ($a = 0$). Which coordinate can be made to stand still at some forcing frequency?"
        options={['bounce $x$', 'pitch $\\theta$', 'both, at different frequencies', 'neither']}
        answer={0}
        explain="With $Q = [F_0,\ 0]^T$: $X \propto K_{22} - I\Omega^2$, zero at $\Omega = \sqrt{K_{22}/I}$, but $\Theta \propto -K_{12}$, a constant: pitch can never be suppressed. That is 2025 A2.4 (the transverse motion stops at 1046 rpm; the rotation never does)."
        tryIt="put the force at the centre of mass and press 'bounce zero'."
        onApply={() => {
          setKL(1500);
          setKR(4000);
          setA(0);
          setW(Math.sqrt((D * D * 5500) / I_));
        }}
      />
      <PredictReveal
        id="a4-sup-edge"
        question="Move the force to the left edge ($a$ = −0.6 m). The forcing frequency that suppresses bounce…"
        options={['stays at $\\sqrt{K_{22}/I}$', 'moves: $\\Omega^2 = (K_{22} - aK_{12})/I$', 'no longer exists']}
        answer={1}
        explain="An off-centre force also applies a moment, $Q_\theta = aF_0$, so the numerator of $X$ becomes $(K_{22} - I\Omega^2) - aK_{12}$. Signs matter: $K_{12}$ and $Q_\theta$ must use the same positive directions (2023 A2.5: 8.80 rad/s; mixing them gives 4.23 rad/s)."
        tryIt="drag the force to the left edge and watch the dotted 'x = 0' line move."
        onApply={() => {
          setKL(1500);
          setKR(4000);
          setA(-0.6);
          const K12v = D * 2500;
          setW(Math.sqrt((D * D * 5500 + 0.6 * K12v) / I_));
        }}
      />
      <PredictReveal
        id="a4-sup-node"
        question="Force at the left edge ($a$ = −0.6 m). At the frequency where bounce is suppressed, which point of the platform stands still?"
        options={['the point under the force', 'the centre of mass', 'a spring attachment point', 'none: every point moves']}
        answer={1}
        explain="$X = 0$ means the centre of mass does not move, so the platform only rocks about it: the still point of the forced shape (at $s = -X/\Theta$) sits at the centre of mass, while the loaded edge moves. At other frequencies the still point wanders along the platform, or off it."
        tryIt="put the force at the left edge, press 'bounce zero' and look at the green marker."
        onApply={() => {
          setKL(1500);
          setKR(4000);
          setA(-0.6);
          setW(Math.sqrt((D * D * 5500 + 0.6 * D * 2500) / I_));
        }}
      />
    </div>
  );
}
