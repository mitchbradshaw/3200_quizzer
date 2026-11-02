// Spring deflection = translation + rotation × lever arm. Drag a rigid block (translate and rotate);
// each spring shows its deflection split into the two parts, its energy ½kδ², and the K entries it feeds.
import { useRef, useState, type KeyboardEvent, type PointerEvent as RPointerEvent } from 'react';
import { planarK } from '../../../physics/rigidbody';
import { Ground, Spring, svgPoint } from '../../../ui/diagrams';
import { Readout, Readouts, SimLayout, Slider, Toggle } from '../../../ui/kit';
import { Rich, TeX } from '../../../ui/Rich';
import { PredictReveal } from '../../../ui/PredictReveal';
import { fmt, fmtSig } from '../../../engine/format';
import { SymMatrix } from './SymMatrix';

const W = 0.9; // block half-width (m)
const HH = 0.45; // block half-height (m)
const S = 150; // px per m (geometry)
const E = 12; // display exaggeration of the motion
const GX = 300;
const GY = 142;
const GROUND = 296;
const WALL = 40;
const YMAX = 15; // mm
const XMAX = 15; // mm
const TMAX = 20; // mrad

function ArrowV({ x, y1, y2, dash, label, left }: { x: number; y1: number; y2: number; dash?: boolean; label?: string; left?: boolean }) {
  const len = y2 - y1;
  if (Math.abs(len) < 1.5) return null;
  const s = Math.sign(len);
  return (
    <g stroke="var(--text)" fill="var(--text)" strokeWidth={dash ? 1.6 : 2.2}>
      <line x1={x} y1={y1} x2={x} y2={y2 - s * 5} strokeDasharray={dash ? '4 3' : undefined} />
      <path d={`M${x} ${y2}L${x - 4} ${y2 - s * 7}L${x + 4} ${y2 - s * 7}Z`} stroke="none" />
      {label && (
        <text x={left ? x - 6 : x + 6} y={(y1 + y2) / 2 + 4} textAnchor={left ? 'end' : 'start'} className="plot-note" stroke="none">
          {label}
        </text>
      )}
    </g>
  );
}

function ArrowH({ y, x1, x2, dash, label }: { y: number; x1: number; x2: number; dash?: boolean; label?: string }) {
  const len = x2 - x1;
  if (Math.abs(len) < 1.5) return null;
  const s = Math.sign(len);
  return (
    <g stroke="var(--text)" fill="var(--text)" strokeWidth={dash ? 1.6 : 2.2}>
      <line x1={x1} y1={y} x2={x2 - s * 5} y2={y} strokeDasharray={dash ? '4 3' : undefined} />
      <path d={`M${x2} ${y}L${x2 - s * 7} ${y - 4}L${x2 - s * 7} ${y + 4}Z`} stroke="none" />
      {label && (
        <text x={(x1 + x2) / 2} y={y - 6} textAnchor="middle" className="plot-note" stroke="none">
          {label}
        </text>
      )}
    </g>
  );
}

export default function LeverArm() {
  const [y, setY] = useState(10); // mm
  const [x, setX] = useState(0); // mm
  const [th, setTh] = useState(10); // mrad
  const [a, setA] = useState(0.6);
  const [b, setB] = useState(0.5);
  const [k1, setK1] = useState(20); // kN/m
  const [k2, setK2] = useState(30);
  const [horiz, setHoriz] = useState(false);
  const [e, setE] = useState(HH);
  const [k3, setK3] = useState(25);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<'move' | 'rot' | null>(null);

  const xm = horiz ? x / 1000 : 0;
  const ym = y / 1000;
  const t = th / 1000;
  // linear deflections (m): translation part + rotation × lever arm
  const springs = [
    { id: 'k₁', k: k1, arm: -a, tr: ym, rot: -a * t, armTxt: `−a = −${fmt(a, 3)} m`, label: '−aθ' },
    { id: 'k₂', k: k2, arm: b, tr: ym, rot: b * t, armTxt: `b = ${fmt(b, 3)} m`, label: '+bθ' },
    ...(horiz ? [{ id: 'k₃', k: k3, arm: e, tr: xm, rot: e * t, armTxt: `e = ${fmt(e, 3)} m below G`, label: '+eθ' }] : []),
  ];
  const V = springs.reduce((s, p) => s + 0.5 * p.k * 1000 * (p.tr + p.rot) ** 2, 0);
  const Vsplit = springs.reduce((s, p) => s + 0.5 * p.k * 1000 * (p.tr * p.tr + p.rot * p.rot), 0);
  const mounts = [
    { x: -a, y: -HH, kx: 0, ky: k1 },
    { x: b, y: -HH, kx: 0, ky: k2 },
    ...(horiz ? [{ x: -W, y: -e, kx: k3, ky: 0 }] : []),
  ];
  const K3 = planarK(mounts); // kN units, order (x, y, θ)
  const idx = horiz ? [0, 1, 2] : [1, 2];
  const K = idx.map((i) => idx.map((j) => K3[i][j]));
  const q = horiz ? [xm, ym, t] : [ym, t];
  const Vq = 0.5 * q.reduce((s, qi, i) => s + qi * K[i].reduce((ss, kij, j) => ss + kij * 1000 * q[j], 0), 0);

  // screen geometry of the displaced block (exaggerated)
  const phi = E * t;
  const gx = GX + E * S * xm;
  const gy = GY - E * S * ym;
  const toScreen = (px: number, py: number) => [gx + S * (px * Math.cos(phi) - py * Math.sin(phi)), gy - S * (px * Math.sin(phi) + py * Math.cos(phi))] as const;
  const corners = [
    [-W, -HH],
    [W, -HH],
    [W, HH],
    [-W, HH],
  ].map(([px, py]) => toScreen(px, py));
  const rotHandle = toScreen(W, HH);
  const restY = GY + S * HH; // undeflected bottom face
  const p1 = toScreen(-a, -HH);
  const p2 = toScreen(b, -HH);
  const p3 = toScreen(-W, -e);

  const clamp = (v: number, lim: number) => Math.max(-lim, Math.min(lim, v));
  const onPointer = (ev: RPointerEvent<SVGElement>, phase: 'down' | 'move' | 'up', kind?: 'move' | 'rot') => {
    if (phase === 'down' && kind) {
      drag.current = kind;
      (ev.currentTarget as SVGElement).setPointerCapture(ev.pointerId);
      return;
    }
    if (phase === 'up') {
      drag.current = null;
      return;
    }
    if (!drag.current || !svgRef.current) return;
    const p = svgPoint(svgRef.current, ev.clientX, ev.clientY);
    if (drag.current === 'move') {
      setY(Math.round(clamp(-(p.y - GY) / (E * S) * 1000, YMAX) * 2) / 2);
      if (horiz) setX(Math.round(clamp(((p.x - GX) / (E * S)) * 1000, XMAX) * 2) / 2);
    } else {
      const ang = Math.atan2(-(p.y - gy), p.x - gx) - Math.atan2(HH, W);
      setTh(Math.round(clamp((ang / E) * 1000, TMAX)));
    }
  };
  const keyMove = (ev: KeyboardEvent<SVGElement>) => {
    const step = ev.shiftKey ? 5 : 1;
    if (ev.key === 'ArrowUp') setY((v) => clamp(v + step, YMAX));
    else if (ev.key === 'ArrowDown') setY((v) => clamp(v - step, YMAX));
    else if (ev.key === 'ArrowRight' && horiz) setX((v) => clamp(v + step, XMAX));
    else if (ev.key === 'ArrowLeft' && horiz) setX((v) => clamp(v - step, XMAX));
    else return;
    ev.preventDefault();
  };
  const keyRot = (ev: KeyboardEvent<SVGElement>) => {
    const step = ev.shiftKey ? 5 : 1;
    if (ev.key === 'ArrowUp' || ev.key === 'ArrowLeft') setTh((v) => clamp(v + step, TMAX));
    else if (ev.key === 'ArrowDown' || ev.key === 'ArrowRight') setTh((v) => clamp(v - step, TMAX));
    else return;
    ev.preventDefault();
  };

  const mm = (v: number) => fmtSig(v * 1000, 3);
  const coords = horiz ? ['x', 'y', '\\theta'] : ['y', '\\theta'];
  const symK = horiz
    ? [
        ['k_3', '0', 'k_3e'],
        ['0', 'k_1 + k_2', 'k_2b - k_1a'],
        ['k_3e', 'k_2b - k_1a', 'k_1a^2 + k_2b^2 + k_3e^2'],
      ]
    : [
        ['k_1 + k_2', 'k_2b - k_1a'],
        ['k_2b - k_1a', 'k_1a^2 + k_2b^2'],
      ];
  const coupling = K3[1][2];

  return (
    <div>
      <SimLayout
        visual={
          <>
            <svg ref={svgRef} viewBox="0 0 560 330" className="anim" role="img" aria-label="Rigid block on two vertical springs and an optional horizontal spring. Drag the centre to translate it and the corner handle to rotate it.">
              {/* reference (undeflected) block */}
              <rect x={GX - S * W} y={GY - S * HH} width={2 * S * W} height={2 * S * HH} fill="none" stroke="var(--text-3)" strokeDasharray="4 4" />
              {/* lever-arm dimensions on the reference geometry */}
              <g stroke="var(--text-3)" strokeWidth={1}>
                <line x1={GX} y1={GY} x2={GX} y2={restY + 6} strokeDasharray="2 3" />
                <line x1={GX - S * a} y1={restY + 18} x2={GX} y2={restY + 18} />
                <line x1={GX} y1={restY + 30} x2={GX + S * b} y2={restY + 30} />
              </g>
              <text x={GX - (S * a) / 2} y={restY + 15} textAnchor="middle" className="plot-note">
                a
              </text>
              <text x={GX + (S * b) / 2} y={restY + 43} textAnchor="middle" className="plot-note">
                b
              </text>
              <Ground x={GX - S * a} y={GROUND} w={40} />
              <Ground x={GX + S * b} y={GROUND} w={40} />
              <Spring x1={GX - S * a} y1={GROUND} x2={p1[0]} y2={p1[1]} coils={5} amp={7} />
              <Spring x1={GX + S * b} y1={GROUND} x2={p2[0]} y2={p2[1]} coils={5} amp={7} />
              <text x={GX - S * a - 12} y={GROUND - 30} textAnchor="end" className="diagram-label">
                k₁
              </text>
              <text x={GX + S * b + 12} y={GROUND - 30} className="diagram-label">
                k₂
              </text>
              {horiz && (
                <>
                  <Ground x={WALL} y={GY + S * e} w={50} vertical side="left" />
                  <Spring x1={WALL} y1={GY + S * e} x2={p3[0]} y2={p3[1]} coils={5} amp={6} />
                  <text x={WALL + 20} y={GY + S * e - 12} className="diagram-label">
                    k₃
                  </text>
                  <line x1={GX - S * W - 6} y1={GY} x2={GX - S * W - 6} y2={GY + S * e} stroke="var(--text-3)" />
                  {e > 0.04 && (
                    <text x={GX - S * W - 10} y={GY + (S * e) / 2 + 4} textAnchor="end" className="plot-note">
                      e
                    </text>
                  )}
                </>
              )}
              {/* displaced block */}
              <polygon points={corners.map((c) => c.map((v) => v.toFixed(1)).join(',')).join(' ')} fill="var(--surface-2)" stroke="var(--text-2)" strokeWidth={1.8} opacity={0.92} />
              <circle cx={gx} cy={gy} r={5} fill="var(--text)" />
              <text x={gx + 8} y={gy - 8} className="diagram-label">
                G
              </text>
              {/* decomposition arrows: translation (solid) then rotation × lever arm (dashed) */}
              <ArrowV x={GX - S * a + 16} y1={restY} y2={restY - E * S * ym} label={Math.abs(ym) > 0.0015 ? 'y' : undefined} left />
              <ArrowV x={GX - S * a + 16} y1={restY - E * S * ym} y2={restY - E * S * (ym - a * t)} dash label={Math.abs(a * t) > 0.0015 ? '−aθ' : undefined} />
              <ArrowV x={GX + S * b + 16} y1={restY} y2={restY - E * S * ym} label={Math.abs(ym) > 0.0015 ? 'y' : undefined} left />
              <ArrowV x={GX + S * b + 16} y1={restY - E * S * ym} y2={restY - E * S * (ym + b * t)} dash label={Math.abs(b * t) > 0.0015 ? '+bθ' : undefined} />
              {horiz && (
                <>
                  <ArrowH y={GY + S * e - 14} x1={GX - S * W} x2={GX - S * W + E * S * xm} label={Math.abs(xm) > 0.002 ? 'x' : undefined} />
                  <ArrowH y={GY + S * e - 14} x1={GX - S * W + E * S * xm} x2={GX - S * W + E * S * (xm + e * t)} dash label={Math.abs(e * t) > 0.002 ? '+eθ' : undefined} />
                </>
              )}
              {/* handles */}
              <g
                role="slider"
                tabIndex={0}
                aria-label={horiz ? 'Translate the block: arrow keys move x and y' : 'Translate the block: up and down arrows move y'}
                aria-valuenow={y}
                style={{ cursor: 'move', touchAction: 'none' }}
                onPointerDown={(ev) => onPointer(ev, 'down', 'move')}
                onPointerMove={(ev) => onPointer(ev, 'move')}
                onPointerUp={(ev) => onPointer(ev, 'up')}
                onKeyDown={keyMove}
                className="handle"
              >
                <circle cx={gx} cy={gy} r={22} fill="transparent" />
                <circle cx={gx} cy={gy} r={11} fill="none" stroke="var(--accent)" strokeWidth={2.5} />
              </g>
              <g
                role="slider"
                tabIndex={0}
                aria-label="Rotate the block: arrow keys change θ"
                aria-valuenow={th}
                style={{ cursor: 'grab', touchAction: 'none' }}
                onPointerDown={(ev) => onPointer(ev, 'down', 'rot')}
                onPointerMove={(ev) => onPointer(ev, 'move')}
                onPointerUp={(ev) => onPointer(ev, 'up')}
                onKeyDown={keyRot}
                className="handle"
              >
                <circle cx={rotHandle[0]} cy={rotHandle[1]} r={18} fill="transparent" />
                <circle cx={rotHandle[0]} cy={rotHandle[1]} r={8} fill="var(--surface)" stroke="var(--accent)" strokeWidth={2.5} />
                <text x={rotHandle[0] + 11} y={rotHandle[1] + 16} className="plot-note" fill="var(--accent)">
                  rotate
                </text>
              </g>
              <text x={8} y={324} className="plot-note">
                Motion drawn ×{E}. Solid arrow: translation; dashed: rotation × lever arm.
              </text>
            </svg>
            <div style={{ overflowX: 'auto' }}>
              <table className="small" style={{ borderCollapse: 'collapse', width: '100%', minWidth: 300 }}>
                <thead>
                  <tr className="muted" style={{ textAlign: 'right' }}>
                    <th style={{ textAlign: 'left' }}>spring</th>
                    <th>translation</th>
                    <th>+ rotation × arm</th>
                    <th>= δ</th>
                    <th>½kδ²</th>
                  </tr>
                </thead>
                <tbody className="mono" style={{ textAlign: 'right' }}>
                  {springs.map((p) => (
                    <tr key={p.id}>
                      <td style={{ textAlign: 'left' }} title={`lever arm ${p.armTxt}`}>
                        {p.id} <span className="muted">({p.armTxt})</span>
                      </td>
                      <td>{mm(p.tr)} mm</td>
                      <td>{mm(p.rot)} mm</td>
                      <td>
                        <strong>{mm(p.tr + p.rot)} mm</strong>
                      </td>
                      <td>{fmtSig(0.5 * p.k * 1000 * (p.tr + p.rot) ** 2, 3)} J</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        }
        controls={
          <>
            <Slider label="bounce" tex="y" tip="translation of G, up (mm)" value={y} min={-YMAX} max={YMAX} step={0.5} unit="mm" onChange={setY} />
            <Slider label="rotation" tex="\theta" tip="rotation about G, anticlockwise (mrad)" value={th} min={-TMAX} max={TMAX} step={1} unit="mrad" onChange={setTh} />
            {horiz && <Slider label="sway" tex="x" tip="translation of G, right (mm)" value={x} min={-XMAX} max={XMAX} step={0.5} unit="mm" onChange={setX} />}
            <Slider label="left spring arm" tex="a" tip="distance of k₁ to the left of G (m)" value={a} min={0} max={W} step={0.05} unit="m" onChange={setA} />
            <Slider label="right spring arm" tex="b" tip="distance of k₂ to the right of G (m)" value={b} min={0} max={W} step={0.05} unit="m" onChange={setB} />
            <Slider label="left stiffness" tex="k_1" tip="vertical spring at −a (kN/m)" value={k1} min={5} max={60} step={1} unit="kN/m" onChange={setK1} />
            <Slider label="right stiffness" tex="k_2" tip="vertical spring at +b (kN/m)" value={k2} min={5} max={60} step={1} unit="kN/m" onChange={setK2} />
            <Toggle checked={horiz} onChange={setHoriz} label="Add a horizontal spring k₃ (sway x)" />
            {horiz && (
              <>
                <Slider label="its depth below G" tex="e" tip="height of k₃ below G (m); 0 = at CoM height" value={e} min={0} max={HH} step={0.05} unit="m" onChange={setE} />
                <Slider label="its stiffness" tex="k_3" tip="horizontal spring (kN/m)" value={k3} min={5} max={60} step={1} unit="kN/m" onChange={setK3} />
              </>
            )}
            <Readouts>
              <Readout tex="V" tip="Σ ½k(translation + rotation × arm)²: the correct energy" value={V} unit="J" sig={3} tone="ok" />
              <Readout label="split" tex="V_{split}" tip="Σ [½k(translation)² + ½k(rotation × arm)²]: the classic wrong form" value={Vsplit} unit="J" sig={3} tone="bad" />
              <Readout label="lost" tex="V - V_{split}" tip="the cross terms Σ k·(translation)(rotation × arm): exactly the coupling" value={V - Vsplit} unit="J" sig={3} />
              <Readout tex="\tfrac12 q^TKq" tip="the same energy from the stiffness matrix (equals V)" value={Vq} unit="J" sig={3} />
            </Readouts>
            <div className="derived-label">K for q = [{coords.join(', ').replace(/\\theta/g, 'θ')}] (kN/m, kN/rad, kN m/rad)</div>
            <SymMatrix name="K" entries={symK} compact />
            <SymMatrix name="K" entries={K.map((r) => r.map((v) => (Math.abs(v) < 1e-9 ? '0' : fmt(v, 4).replace('−', '-'))))} />
            <Rich
              className="note"
              text={
                Math.abs(coupling) < 1e-9
                  ? 'Bounce–pitch coupling $K_{y\\theta} = k_2b - k_1a = 0$: here $k_1a = k_2b$, so a pure bounce stores no pitch energy and vice versa.'
                  : `Bounce–pitch coupling $K_{y\\theta} = k_2b - k_1a$ = ${fmt(coupling, 3)} kN/rad: it is the cross term the split form throws away.`
              }
            />
          </>
        }
      />
      <PredictReveal
        id="a2-lever-split"
        question="Set $y$ = 10 mm and $\theta$ = 10 mrad, with the right spring at $b$ = 0.5 m. Its stored energy is ½k₂ × …"
        options={['(10 mm)² + (5 mm)²', '(15 mm)²', '(5 mm)²', '(10 mm)²']}
        answer={1}
        explain="The spring end moves $y + b\theta$ = 10 + 0.5 × 10 = 15 mm, and the spring stores $\tfrac12 k(15\ \text{mm})^2$. Splitting gives $(10)^2 + (5)^2 = 125$ instead of $15^2 = 225$ mm²: the missing $2 \times 10 \times 5$ is the cross term $k\,b\,y\theta$, the coupling (official 2017: elastic energy cannot be separated into translational and rotational parts)."
        tryIt="read the table row for k₂ and compare V with V_split."
        onApply={() => {
          setHoriz(false);
          setX(0);
          setY(10);
          setTh(10);
          setB(0.5);
        }}
      />
      <PredictReveal
        id="a2-lever-decouple"
        question="Make $k_1a = k_2b$ (for example equal springs at equal distances). Which entry of K becomes zero?"
        options={['$K_{yy}$', '$K_{y\\theta}$', '$K_{\\theta\\theta}$', 'None of them']}
        answer={1}
        explain="$K_{y\theta} = k_2b - k_1a$ vanishes, so bounce and pitch decouple: the modes become a pure bounce at $\sqrt{(k_1+k_2)/m}$ and a pure pitch at $\sqrt{(k_1a^2+k_2b^2)/J}$. Notice that $V$ still has cross terms spring by spring; they cancel between the two springs."
        tryIt="watch the K matrix and the note under it."
        onApply={() => {
          setK1(25);
          setK2(25);
          setA(0.6);
          setB(0.6);
        }}
      />
      <PredictReveal
        id="a2-lever-height"
        question="Add the horizontal spring and raise it to the height of G ($e \to 0$). What happens to $K_{x\theta}$?"
        options={['It doubles', 'It becomes zero: sway decouples from rock', 'It does not change: the spring is still on the block']}
        answer={1}
        explain="A horizontal spring a depth $e$ below G stretches $x - p_y\theta = x + e\theta$, so $K_{x\theta} = k_3e$. At CoM height ($e = 0$) rotation does not move its line of action and sway decouples. This is why the 2024 box couples sway and rock: its shear springs sit $c$ below G ($K_{x\theta} = 4k_xc$)."
        tryIt="turn on the horizontal spring and slide e to 0."
        onApply={() => {
          setHoriz(true);
          setE(0);
          setX(8);
          setTh(12);
        }}
      />
    </div>
  );
}
