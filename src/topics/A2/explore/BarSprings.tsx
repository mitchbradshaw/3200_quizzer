// Rigid bar on two springs: bounce–pitch. Live K and the coupling k₂b − k₁a, animated modes with
// their nodes, ω against the rear spring position, and the same system in spring-point coordinates.
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as RPointerEvent } from 'react';
import { modalFreeResponse, modalInitialConditions, modes } from '../../../physics/mdof';
import { bouncePitchK } from '../../../physics/rigidbody';
import { useRaf } from '../../../anim/hooks';
import { Ground, springPath, svgPoint } from '../../../ui/diagrams';
import { Handle, Line, Plot, VLine } from '../../../plot/Plot';
import { Badge, Button, Callout, Legend, Readout, Readouts, Segmented, SimLayout, Slider } from '../../../ui/kit';
import { Rich, TeX } from '../../../ui/Rich';
import { PredictReveal } from '../../../ui/PredictReveal';
import { completeChallenge, useProgress } from '../../../app/store';
import { fmt } from '../../../engine/format';
import { springPointM } from '../physics';

export const DECOUPLE_CHALLENGE = 'a2-bar-decouple';
const S = 80; // px per m
const GX = 280;
const GY = 100;
const GROUND = 200;
const POS_MAX = 2.5; // m
const OVER = 0.25; // bar overhang past each spring (m)
const AMP_MM = 10; // physical amplitude of the largest end motion
const E = 2.6 / S / 1e-3; // display: 2.6 px per mm of motion
type Exc = 'mode1' | 'mode2' | 'bump';
type Coords = 'com' | 'points';

function analyse(m: number, J: number, k1: number, a: number, k2: number, b: number) {
  const K = bouncePitchK(k1 * 1000, a, k2 * 1000, b);
  const M = [
    [m, 0],
    [0, J],
  ];
  const r = modes(K, M);
  const ratio = [r.P[1][0] / r.P[0][0], r.P[1][1] / r.P[0][1]]; // Θ/Y
  return { K, M, omega: r.omega, P: r.P, ratio, nodes: ratio.map((q) => -1 / q) };
}

export default function BarSprings() {
  const progress = useProgress();
  const [m, setM] = useState(1000);
  const [rho, setRho] = useState(0.9);
  const [k1, setK1] = useState(18);
  const [k2, setK2] = useState(22);
  const [a, setA] = useState(1.0);
  const [b, setB] = useState(1.5);
  const [exc, setExc] = useState<Exc>('mode1');
  const [coords, setCoords] = useState<Coords>('com');
  const J = m * rho * rho;
  const A = useMemo(() => analyse(m, J, k1, a, k2, b), [m, J, k1, a, k2, b]);
  const [w1, w2] = A.omega;
  const K12 = k2 * b - k1 * a; // kN/rad
  const decoupled = Math.abs(K12) <= 0.01 * (k1 * a + k2 * b);
  const done = !!progress.challenges[DECOUPLE_CHALLENGE];
  const xL = -a - OVER;
  const xR = b + OVER;

  // ω against the right-spring position b
  const sweep = useMemo(() => {
    const n = 80;
    const bs = Array.from({ length: n + 1 }, (_, i) => 0.1 + ((POS_MAX - 0.1) * i) / n);
    const ws = bs.map((bb) => analyse(m, J, k1, a, k2, bb).omega);
    return {
      w1: bs.map((bb, i) => [bb, ws[i][0]] as [number, number]),
      w2: bs.map((bb, i) => [bb, ws[i][1]] as [number, number]),
      bounce: bs.map((bb) => [bb, Math.sqrt(((k1 + k2) * 1000) / m)] as [number, number]),
      pitch: bs.map((bb) => [bb, Math.sqrt(((k1 * a * a + k2 * bb * bb) * 1000) / J)] as [number, number]),
      yMax: Math.max(...ws.map((w) => w[1])) * 1.1,
    };
  }, [m, J, k1, a, k2]);

  // initial conditions: largest end motion = AMP_MM
  const ic = useMemo(() => {
    let q0: number[];
    if (exc === 'bump') {
      q0 = [((AMP_MM / 1000) * b) / (a + b), -(AMP_MM / 1000) / (a + b)]; // left spring point up 10 mm, right one level
    } else {
      const j = exc === 'mode1' ? 0 : 1;
      const Y = A.P[0][j];
      const T = A.P[1][j];
      const end = Math.max(Math.abs(Y + xL * T), Math.abs(Y + xR * T), 1e-12);
      q0 = [(Y / end) * (AMP_MM / 1000), (T / end) * (AMP_MM / 1000)];
    }
    return modalInitialConditions(A.P, q0, [0, 0]);
  }, [A, exc, a, b, xL, xR]);

  const wrapRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<SVGGElement>(null);
  const s1Ref = useRef<SVGPathElement>(null);
  const s2Ref = useRef<SVGPathElement>(null);
  const t = useRef(0);
  useEffect(() => {
    t.current = 0;
  }, [ic]);
  useRaf(
    (dt) => {
      t.current += dt;
      const [y, th] = modalFreeResponse(A.P, A.omega, ic.y0, ic.yd0, t.current);
      const phi = E * th;
      const gy = GY - E * S * y;
      barRef.current?.setAttribute('transform', `translate(${GX} ${gy.toFixed(2)}) rotate(${((-phi * 180) / Math.PI).toFixed(3)})`);
      const top = (p: number) => [GX + p * S * Math.cos(phi) + 7 * Math.sin(phi), gy - p * S * Math.sin(phi) + 7 * Math.cos(phi)];
      const [x1, y1] = top(-a);
      const [x2, y2] = top(b);
      s1Ref.current?.setAttribute('d', springPath(GX - a * S, GROUND, x1, y1, 5, 8));
      s2Ref.current?.setAttribute('d', springPath(GX + b * S, GROUND, x2, y2, 5, 8));
    },
    true,
    wrapRef
  );

  // drag the spring positions along the bar (pointer or arrow keys)
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef<'a' | 'b' | null>(null);
  const clampPos = (v: number) => Math.max(0.1, Math.min(POS_MAX, Math.round(v * 20) / 20));
  const onPtr = (e: RPointerEvent<SVGGElement>, which: 'a' | 'b', phase: 'down' | 'move' | 'up') => {
    if (phase === 'down') {
      dragging.current = which;
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }
    if (phase === 'up') {
      dragging.current = null;
      return;
    }
    if (dragging.current !== which || !svgRef.current) return;
    const p = svgPoint(svgRef.current, e.clientX, e.clientY);
    const v = (p.x - GX) / S;
    if (which === 'a') setA(clampPos(-v));
    else setB(clampPos(v));
  };
  const onKey = (e: KeyboardEvent<SVGGElement>, which: 'a' | 'b') => {
    const step = e.shiftKey ? 0.25 : 0.05;
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    if (which === 'a') setA((v) => clampPos(v - dir * step));
    else setB((v) => clampPos(v + dir * step));
  };

  const nodeMode = exc === 'mode1' ? 0 : exc === 'mode2' ? 1 : -1;
  const xn = nodeMode >= 0 ? A.nodes[nodeMode] : NaN;
  const nodeOnScreen = Number.isFinite(xn) && Math.abs(xn) < 3.3;
  const Mp = springPointM(m, J, a, b);
  const wPts = modes(
    [
      [k1 * 1000, 0],
      [0, k2 * 1000],
    ],
    Mp
  ).omega;
  const t4 = (x: number) => fmt(x, 4).replace('−', '-');
  const modeShape = (j: number) => {
    const Y = A.P[0][j];
    const T = A.P[1][j];
    const d = (x: number) => Y + x * T;
    const big = Math.max(Math.abs(d(xL)), Math.abs(d(xR)), 1e-12);
    const base = j === 0 ? 34 : 92;
    const yy = (x: number) => base - (22 * d(x)) / big;
    return { pts: `${GX + xL * S},${yy(xL).toFixed(1)} ${GX + xR * S},${yy(xR).toFixed(1)}`, base, node: A.nodes[j], end: yy };
  };

  return (
    <div ref={wrapRef}>
      <SimLayout
        visual={
          <>
            <svg ref={svgRef} viewBox="0 44 560 206" className="anim" role="img" aria-label="Rigid bar on two springs, animated in bounce and pitch. Drag the spring markers to move the springs.">
              <line x1={GX} y1={GY - 40} x2={GX} y2={GROUND} stroke="var(--text-3)" strokeDasharray="2 4" />
              <Ground x={GX - a * S} y={GROUND} w={40} />
              <Ground x={GX + b * S} y={GROUND} w={40} />
              <path ref={s1Ref} fill="none" stroke="var(--text-2)" strokeWidth={1.8} d={springPath(GX - a * S, GROUND, GX - a * S, GY + 7, 5, 8)} />
              <path ref={s2Ref} fill="none" stroke="var(--text-2)" strokeWidth={1.8} d={springPath(GX + b * S, GROUND, GX + b * S, GY + 7, 5, 8)} />
              <g ref={barRef} transform={`translate(${GX} ${GY})`}>
                {nodeOnScreen && xn > xR && <line x1={xR * S} y1={0} x2={xn * S} y2={0} stroke={`var(--m${nodeMode + 1})`} strokeDasharray="5 4" strokeWidth={1.5} />}
                {nodeOnScreen && xn < xL && <line x1={xn * S} y1={0} x2={xL * S} y2={0} stroke={`var(--m${nodeMode + 1})`} strokeDasharray="5 4" strokeWidth={1.5} />}
                <rect x={xL * S} y={-7} width={(xR - xL) * S} height={14} rx={3} fill="var(--surface-2)" stroke="var(--text-2)" strokeWidth={1.8} />
                <circle cx={0} cy={0} r={4} fill="var(--text)" />
              </g>
              {nodeOnScreen && (
                <g>
                  <path d={`M${GX + xn * S} ${GY + 12}l-6 10h12z`} fill={`var(--m${nodeMode + 1})`} />
                  <text x={GX + xn * S} y={GY + 36} textAnchor="middle" className="plot-note" fill={`var(--m${nodeMode + 1})`}>
                    node
                  </text>
                </g>
              )}
              <text x={GX + 6} y={GY - 26} className="diagram-label">
                G
              </text>
              {(['a', 'b'] as const).map((w) => {
                const px = w === 'a' ? GX - a * S : GX + b * S;
                return (
                  <g
                    key={w}
                    className="handle"
                    role="slider"
                    tabIndex={0}
                    aria-label={w === 'a' ? `left spring position a = ${fmt(a, 3)} m` : `right spring position b = ${fmt(b, 3)} m`}
                    aria-valuenow={w === 'a' ? a : b}
                    style={{ cursor: 'ew-resize', touchAction: 'none' }}
                    onPointerDown={(e) => onPtr(e, w, 'down')}
                    onPointerMove={(e) => onPtr(e, w, 'move')}
                    onPointerUp={(e) => onPtr(e, w, 'up')}
                    onKeyDown={(e) => onKey(e, w)}
                  >
                    <rect x={px - 16} y={GROUND - 4} width={32} height={30} fill="transparent" />
                    <path d={`M${px} ${GROUND + 8}l-8 12h16z`} fill="var(--surface)" stroke="var(--accent)" strokeWidth={2.2} />
                    <text x={px} y={GROUND + 36} textAnchor="middle" className="plot-note" fill="var(--accent)">
                      {w === 'a' ? `k₁ at −${fmt(a, 3)} m` : `k₂ at +${fmt(b, 3)} m`}
                    </text>
                  </g>
                );
              })}
              <text x={8} y={58} className="plot-note">
                Motion drawn ×{fmt(E, 2)}; drag ▲ to move a spring.
              </text>
              {nodeMode >= 0 && !nodeOnScreen && Number.isFinite(xn) && (
                <text x={552} y={58} textAnchor="end" className="plot-note" fill={`var(--m${nodeMode + 1})`}>
                  node at {fmt(xn, 3)} m (off screen)
                </text>
              )}
            </svg>
            <div className="row gap-s wrap">
              <span className="muted small">Start from rest in:</span>
              <Segmented
                size="sm"
                label="Initial condition"
                value={exc}
                onChange={(v: Exc) => setExc(v)}
                options={[
                  { value: 'mode1', label: 'mode 1' },
                  { value: 'mode2', label: 'mode 2' },
                  { value: 'bump', label: 'left end lifted' },
                ]}
              />
            </div>
            <svg viewBox="0 0 560 122" className="anim" role="img" aria-label="Mode shapes: the deflected bar in each mode with its node">
              {[0, 1].map((j) => {
                const s = modeShape(j);
                return (
                  <g key={j}>
                    <line x1={GX + xL * S} y1={s.base} x2={GX + xR * S} y2={s.base} stroke="var(--text-3)" strokeDasharray="3 4" />
                    {Math.abs(s.node) < 3.4 && (s.node > xR || s.node < xL) && (
                      <line x1={GX + s.node * S} y1={s.base} x2={GX + (s.node > xR ? xR : xL) * S} y2={s.end(s.node > xR ? xR : xL)} stroke={`var(--m${j + 1})`} strokeDasharray="4 4" strokeWidth={1.5} />
                    )}
                    <polyline points={s.pts} fill="none" stroke={`var(--m${j + 1})`} strokeWidth={4} strokeLinecap="round" />
                    {Math.abs(s.node) < 3.4 && <circle cx={GX + s.node * S} cy={s.base} r={4.5} fill="var(--surface)" stroke={`var(--m${j + 1})`} strokeWidth={2} />}
                    <text x={6} y={s.base - 12} className="plot-note" fill={`var(--m${j + 1})`}>
                      mode {j + 1}: {fmt(A.omega[j] / (2 * Math.PI), 4)} Hz
                    </text>
                    <text x={6} y={s.base + 18} className="plot-note" fill={`var(--m${j + 1})`}>
                      node {Number.isFinite(s.node) && Math.abs(s.node) < 1e4 ? `${fmt(s.node, 3)} m` : 'at ∞ (pure bounce)'}
                    </text>
                  </g>
                );
              })}
            </svg>
            <Plot x={{ min: 0.1, max: POS_MAX, label: 'right spring position b (m)' }} y={{ min: 0, max: sweep.yMax, label: 'ω (rad/s)' }} height={220} ariaLabel="Natural frequencies against the right spring position">
              <Line points={sweep.bounce} color="var(--text-3)" dash width={1.4} />
              <Line points={sweep.pitch} color="var(--text-3)" dash width={1.4} />
              <Line points={sweep.w1} color="var(--m1)" width={2.4} />
              <Line points={sweep.w2} color="var(--m2)" width={2.4} />
              {(k1 * a) / k2 <= POS_MAX && <VLine x={(k1 * a) / k2} color="var(--ok)" label="K₁₂ = 0" />}
              <Handle x={b} y={w1} axis="x" clampX={[0.1, POS_MAX]} onChange={(x) => setB(clampPos(x))} color="var(--accent)" label="b" ariaLabel="right spring position" />
            </Plot>
            <Legend
              items={[
                { label: 'ω₁', color: 'var(--m1)' },
                { label: 'ω₂', color: 'var(--m2)' },
                { label: 'uncoupled bounce √((k₁+k₂)/m) and pitch √((k₁a²+k₂b²)/J)', color: 'var(--text-3)', dash: true },
              ]}
            />
          </>
        }
        controls={
          <>
            <Slider label="mass" tex="m" tip="body mass (kg)" value={m} min={300} max={3000} step={50} unit="kg" onChange={setM} />
            <Slider label="radius of gyration" tex="\rho" tip="J = mρ² (m)" value={rho} min={0.4} max={1.5} step={0.05} unit="m" onChange={setRho} />
            <Slider label="left stiffness" tex="k_1" tip="spring at −a (kN/m)" value={k1} min={5} max={100} step={1} unit="kN/m" onChange={setK1} />
            <Slider label="right stiffness" tex="k_2" tip="spring at +b (kN/m)" value={k2} min={5} max={100} step={1} unit="kN/m" onChange={setK2} />
            <Slider label="left position" tex="a" tip="distance of k₁ left of G (m)" value={a} min={0.1} max={POS_MAX} step={0.05} unit="m" onChange={setA} />
            <Slider label="right position" tex="b" tip="distance of k₂ right of G (m)" value={b} min={0.1} max={POS_MAX} step={0.05} unit="m" onChange={setB} />
            <div className="row gap-s wrap">
              <span className="muted small">Coordinates:</span>
              <Segmented
                size="sm"
                label="Coordinates"
                value={coords}
                onChange={(v: Coords) => setCoords(v)}
                options={[
                  { value: 'com', label: 'y, θ at G' },
                  { value: 'points', label: 'y₁, y₂ at the springs' },
                ]}
              />
            </div>
            {coords === 'com' ? (
              <>
                <TeX display>{`M = \\begin{bmatrix} m & 0 \\\\ 0 & J \\end{bmatrix} = \\begin{bmatrix} ${t4(m)} & 0 \\\\ 0 & ${t4(J)} \\end{bmatrix}`}</TeX>
                <TeX display>{`K = \\begin{bmatrix} k_1+k_2 & k_2b-k_1a \\\\ k_2b-k_1a & k_1a^2+k_2b^2 \\end{bmatrix} = \\begin{bmatrix} ${t4(k1 + k2)} & ${t4(K12)} \\\\ ${t4(K12)} & ${t4(k1 * a * a + k2 * b * b)} \\end{bmatrix}\\ \\text{kN}`}</TeX>
              </>
            ) : (
              <>
                <TeX display>{`M = \\frac{1}{(a+b)^2}\\begin{bmatrix} mb^2+J & mab-J \\\\ mab-J & ma^2+J \\end{bmatrix} = \\begin{bmatrix} ${t4(Mp[0][0])} & ${t4(Mp[0][1])} \\\\ ${t4(Mp[1][0])} & ${t4(Mp[1][1])} \\end{bmatrix}`}</TeX>
                <TeX display>{`K = \\begin{bmatrix} k_1 & 0 \\\\ 0 & k_2 \\end{bmatrix} = \\begin{bmatrix} ${t4(k1)} & 0 \\\\ 0 & ${t4(k2)} \\end{bmatrix}\\ \\text{kN/m}`}</TeX>
                <Rich
                  className="note"
                  text={`Each spring now sees one coordinate, so K is diagonal and the coupling sits in M (inertial). Solving $\\det(K - \\omega^2M) = 0$ with these matrices gives ${fmt(wPts[0], 4)} and ${fmt(wPts[1], 4)} rad/s: the same frequencies as in $(y, \\theta)$ (LA4-5 note).`}
                />
              </>
            )}
            <Readouts>
              <Readout tex="K_{12}" tip="bounce–pitch coupling k₂b − k₁a (kN/rad), in CoM coordinates" value={K12} unit="kN/rad" sig={3} tone={decoupled ? 'ok' : undefined} />
              <Readout tex="J" tip="pitch inertia mρ² (kg m²)" value={J} unit="kg m²" sig={4} />
              <Readout tex="\omega_1" tip="lower natural frequency (rad/s)" value={w1} unit="rad/s" tone="m1" />
              <Readout tex="\omega_2" tip="higher natural frequency (rad/s)" value={w2} unit="rad/s" tone="m2" />
              <Readout tex="f_1" tip="ω₁/2π" value={w1 / (2 * Math.PI)} unit="Hz" tone="m1" />
              <Readout tex="f_2" tip="ω₂/2π" value={w2 / (2 * Math.PI)} unit="Hz" tone="m2" />
              <Readout label="node 1" tex="x_1" tip="node of mode 1 from G, −Y/Θ (m; + to the right)" value={A.nodes[0]} unit="m" sig={3} tone="m1" text={Math.abs(A.nodes[0]) > 1e4 ? '∞' : undefined} />
              <Readout label="node 2" tex="x_2" tip="node of mode 2 from G, −Y/Θ (m)" value={A.nodes[1]} unit="m" sig={3} tone="m2" text={Math.abs(A.nodes[1]) > 1e4 ? '∞' : undefined} />
            </Readouts>
            <div className="row gap-s wrap">
              <span className="muted small">Presets:</span>
              <Button
                size="sm"
                onClick={() => {
                  setM(1000);
                  setRho(0.9);
                  setK1(18);
                  setK2(22);
                  setA(1.0);
                  setB(1.5);
                }}
              >
                LA4 car
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setM(3000);
                  setRho(1.3);
                  setK1(90);
                  setK2(90);
                  setA(1.3);
                  setB(1.7);
                }}
              >
                Minibus (2021 A1.5)
              </Button>
            </div>
            {decoupled ? (
              <Callout kind="ok" title="Bounce and pitch are decoupled">
                <Rich text={`$k_1a = k_2b$, so $K_{12} = 0$: the modes are a pure bounce at $\\sqrt{(k_1+k_2)/m}$ = ${fmt(Math.sqrt(((k1 + k2) * 1000) / m), 4)} rad/s and a pure pitch about G at $\\sqrt{(k_1a^2+k_2b^2)/J}$ = ${fmt(Math.sqrt(((k1 * a * a + k2 * b * b) * 1000) / J), 4)} rad/s.`} />
              </Callout>
            ) : (
              <Callout kind="info" title="Challenge">
                Place the springs (or change their stiffnesses) so that bounce and pitch decouple, then submit.
              </Callout>
            )}
            <div className="row gap-s wrap">
              <Button variant="primary" disabled={!decoupled || done} onClick={() => completeChallenge(DECOUPLE_CHALLENGE)}>
                {done ? '✓ Challenge complete' : 'Submit this layout'}
              </Button>
              {done && <Badge tone="ok">Solved: k₁a = k₂b</Badge>}
            </div>
          </>
        }
      />
      <PredictReveal
        id="a2-bar-decouple"
        question="Slide the right spring until $k_1a = k_2b$. What do the two modes become?"
        options={['Still one bounce-dominated and one pitch-dominated mode, with nodes off G', 'A pure bounce (no rotation) and a pure pitch about G', 'Two pitching modes']}
        answer={1}
        explain="With $K_{12} = k_2b - k_1a = 0$ and a diagonal M, nothing couples y and θ: mode 1 or 2 is a pure bounce (node at infinity) and the other a pure pitch with its node exactly at G. On the plot the coupled curves just touch the dashed uncoupled ones there."
        tryIt="drag b to the green K₁₂ = 0 line and play each mode."
        onApply={() => {
          setB(Math.max(0.1, Math.min(POS_MAX, (k1 * a) / k2)));
          setExc('mode1');
        }}
      />
      <PredictReveal
        id="a2-bar-coords"
        question="Switch to spring-point coordinates $(y_1, y_2)$. K becomes diagonal. Do the natural frequencies change?"
        options={['Yes: with a diagonal K the motions are uncoupled', 'No: the coupling moves into M and the frequencies stay the same']}
        answer={1}
        explain="In $(y_1, y_2)$ each spring sees one coordinate, so $K = \mathrm{diag}(k_1, k_2)$, but $M$ gains the off-diagonal $(mab - J)/(a+b)^2$: inertial coupling. Same physics, same $\omega_1, \omega_2$ (reader LA4-5; official 2018 A1.4). Coupling is a property of the coordinates, the frequencies are not."
        tryIt="toggle the coordinates and watch ω₁, ω₂."
        onApply={() => setCoords('points')}
      />
      <PredictReveal
        id="a2-bar-node"
        question="LA4 car (front spring 18 kN/m at 1.0 m, rear 22 kN/m at 1.5 m). Where is the node of the bounce-dominated mode 1?"
        options={['Between the axles, near G', 'Outside the wheelbase, beyond the rear axle', 'Exactly at the rear axle']}
        answer={1}
        explain="Mode 1 has $x/\theta = -2.646$ m, so its node is 2.65 m from G on the rear-spring side, outside the 2.5 m wheelbase: the body bounces with a slight pitch about a far-away point. Mode 2 pitches about a point 0.31 m on the other side of G (LA4 Eqs 4.16–4.17)."
        tryIt="load the LA4 car preset and play mode 1."
        onApply={() => {
          setM(1000);
          setRho(0.9);
          setK1(18);
          setK2(22);
          setA(1.0);
          setB(1.5);
          setExc('mode1');
        }}
      />
    </div>
  );
}
