// Rod swinging on a cart (2022 A2). Exact linear response by modal superposition; live M, K,
// frequencies, the two mode shapes drawn with their node, a trace of the cart and rod-tip motion,
// and ω against the wall-spring stiffness, which shows the k → 0 (rigid-body) limit.
import { useEffect, useMemo, useRef, useState } from 'react';
import { modalFreeResponse, modalInitialConditions, modes } from '../../../physics/mdof';
import type { Mat } from '../../../physics/linalg';
import { useRaf } from '../../../anim/hooks';
import { Ground, springPath } from '../../../ui/diagrams';
import { Dot, Handle, HLine, Line, LivePath, livePathD, Plot, VLine, type PlotScales } from '../../../plot/Plot';
import { Button, Legend, Readout, Readouts, Segmented, SimLayout, Slider, Toggle } from '../../../ui/kit';
import { Rich, TeX } from '../../../ui/Rich';
import { PredictReveal } from '../../../ui/PredictReveal';
import { fmt } from '../../../engine/format';
import { cartRodFreeOmega2, cartRodMK } from '../physics';

const ROD_PX = 120; // drawn rod length (2L)
const X0 = 300; // cart centre at equilibrium
const FLOOR = 158;
const PIVOT_Y = 140;
const WALL = 28;
const K_MAX = 300;
const TRACE_DT = 1 / 30; // s between stored trace points
type Exc = 'mode1' | 'mode2' | 'cart' | 'rod';

function analyse(m: number, M: number, L: number, k: number, g: number) {
  const mk = cartRodMK(m, M, L, k, g);
  const r = modes(mk.K, mk.M);
  return { ...mk, omega: r.omega, P: r.P };
}

/** The two mode shapes as static snapshots: rest position dashed, displaced shape in the mode colour, node marked. */
function ModeShapes({ P, omega, L }: { P: Mat; omega: number[]; L: number }) {
  const R = 78; // drawn rod length (px)
  const kpx = R / (2 * L); // px per m
  const PIV = 66;
  const FLOOR_Y = PIV + 8; // under the wheels
  return (
    <svg viewBox="0 0 560 178" className="anim" role="img" aria-label="Mode shapes of the cart and rod: mode 1 in phase, mode 2 out of phase with a node on the rod">
      {[0, 1].map((j) => {
        const x0 = 140 + 280 * j;
        const col = `var(--m${j + 1})`;
        const X = P[0][j];
        const T = P[1][j];
        const tip = X + 2 * L * T;
        let s = 34 / Math.max(Math.abs(X) * kpx, Math.abs(tip) * kpx, 1e-9);
        if (Math.abs(T) * s > 0.45) s = 0.45 / Math.abs(T);
        const dX = X * s * kpx;
        const th = T * s;
        const px = x0 + dX;
        const rigid = Math.abs(T) < 1e-9 * Math.max(1, Math.abs(X));
        const node = rigid ? NaN : -X / T; // m below the pivot (negative = above)
        const nodeOnRod = node > 0 && node <= 2 * L * 1.02;
        const nx = px + node * kpx * Math.sin(th);
        const ny = PIV + node * kpx * Math.cos(th);
        const nodeLabelY = Math.abs(ny - FLOOR_Y) < 9 ? ny + 17 : ny + 4; // keep the label off the floor line
        const note = rigid
          ? 'rigid-body mode (ω = 0): both translate together'
          : T / X > 0
            ? `in phase; still point ${fmt(-node, 3)} m above the pivot`
            : nodeOnRod
              ? `out of phase; node ${fmt(node, 3)} m below the pivot`
              : `out of phase; still point ${fmt(node, 3)} m below the pivot`;
        return (
          <g key={j}>
            <text x={x0} y={15} textAnchor="middle" className="plot-note" fill={col}>
              mode {j + 1}: ω{j ? '₂' : '₁'} = {fmt(omega[j], 4)} rad/s, Θ/X = {rigid ? '0' : fmt(T / X, 3)} rad/m
            </text>
            <line x1={x0 - 120} y1={FLOOR_Y} x2={x0 + 120} y2={FLOOR_Y} stroke="var(--text-3)" strokeWidth={1.5} />
            <rect x={x0 - 34} y={PIV - 30} width={68} height={28} rx={4} fill="none" stroke="var(--text-3)" strokeDasharray="4 3" />
            <line x1={x0} y1={PIV} x2={x0} y2={PIV + R} stroke="var(--text-3)" strokeDasharray="4 3" strokeWidth={1.5} />
            <rect x={px - 34} y={PIV - 30} width={68} height={28} rx={4} fill="var(--surface-2)" stroke={col} strokeWidth={2} />
            <circle cx={px - 20} cy={PIV + 4} r={4} fill="var(--surface)" stroke={col} strokeWidth={1.5} />
            <circle cx={px + 20} cy={PIV + 4} r={4} fill="var(--surface)" stroke={col} strokeWidth={1.5} />
            <line x1={px} y1={PIV} x2={px + R * Math.sin(th)} y2={PIV + R * Math.cos(th)} stroke={col} strokeWidth={4} strokeLinecap="round" />
            <circle cx={px} cy={PIV} r={3} fill="var(--surface)" stroke={col} strokeWidth={1.5} />
            {nodeOnRod && (
              <g>
                <circle cx={nx} cy={ny} r={6} fill="var(--surface)" stroke={col} strokeWidth={2.2} />
                <text x={nx + (th < 0 ? 10 : -10)} y={nodeLabelY} textAnchor={th < 0 ? 'start' : 'end'} className="plot-note" fill={col}>
                  node
                </text>
              </g>
            )}
            <text x={x0} y={172} textAnchor="middle" className="plot-note">
              {note}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default function CartPendulum() {
  const [m, setM] = useState(5);
  const [Mr, setMr] = useState(3);
  const [L, setL] = useState(1);
  const [k, setK] = useState(10);
  const [g10, setG10] = useState(true);
  const [exc, setExc] = useState<Exc>('cart');
  const g = g10 ? 10 : 9.81;
  const A = useMemo(() => analyse(m, Mr, L, k, g), [m, Mr, L, k, g]);
  const [w1, w2] = A.omega;
  const r1 = A.P[1][0] / A.P[0][0];
  const r2 = A.P[1][1] / A.P[0][1];
  const node2 = -1 / r2; // m below the pivot
  const pxPerM = ROD_PX / (2 * L);
  const wFree = Math.sqrt(cartRodFreeOmega2(m, Mr, L, g));
  const wPivot = Math.sqrt((3 * g) / (4 * L));

  // ω₁(k), ω₂(k) and the uncoupled references
  const curves = useMemo(() => {
    const n = 90;
    const ks = Array.from({ length: n + 1 }, (_, i) => (K_MAX * i) / n);
    const ws = ks.map((kk) => analyse(m, Mr, L, kk, g).omega);
    return {
      w1: ks.map((kk, i) => [kk, ws[i][0]] as [number, number]),
      w2: ks.map((kk, i) => [kk, ws[i][1]] as [number, number]),
      unc: ks.map((kk) => [kk, Math.sqrt(kk / (m + Mr))] as [number, number]),
      yMax: Math.max(...ws.map((w) => w[1])) * 1.08,
    };
  }, [m, Mr, L, g]);

  // initial conditions for the chosen excitation (from rest), scaled to a visible but small motion
  const ic = useMemo(() => {
    const target = 55; // px of the largest motion
    let q0: number[];
    if (exc === 'mode1' || exc === 'mode2') {
      const j = exc === 'mode1' ? 0 : 1;
      const X = A.P[0][j];
      const T = A.P[1][j];
      let s = target / Math.max(Math.abs(X) * pxPerM, Math.abs(T) * ROD_PX, 1e-9);
      if (Math.abs(T) * s > 0.35) s = 0.35 / Math.abs(T);
      q0 = [X * s, T * s];
    } else if (exc === 'cart') q0 = [target / pxPerM, 0];
    else q0 = [0, 0.3];
    return modalInitialConditions(A.P, q0, [0, 0]);
  }, [A, exc, pxPerM]);

  // trace window (about three periods of the slower moving mode) and a fixed y-range from the modal amplitudes
  const trace = useMemo(() => {
    const wSlow = A.omega[0] > 1e-6 ? A.omega[0] : A.omega[1];
    const tWin = Math.min(30, Math.max(8, Math.ceil((6 * Math.PI) / wSlow)));
    let bx = 0;
    let bt = 0;
    for (let i = 0; i < 2; i++) {
      bx += Math.abs(A.P[0][i] * ic.y0[i]);
      bt += Math.abs((A.P[0][i] + 2 * L * A.P[1][i]) * ic.y0[i]);
    }
    return { tWin, yMax: Math.max(bx, bt, 1e-6) * 1.15 };
  }, [A, ic, L]);

  const wrapRef = useRef<HTMLDivElement>(null);
  const cartRef = useRef<SVGGElement>(null);
  const springRef = useRef<SVGPathElement>(null);
  const rodRef = useRef<SVGLineElement>(null);
  const gRef = useRef<SVGCircleElement>(null);
  const xTraceRef = useRef<SVGPathElement>(null);
  const tipTraceRef = useRef<SVGPathElement>(null);
  const scales = useRef<PlotScales | null>(null);
  const sim = useRef({ t: 0, sweep: 0, last: -1, bx: [] as [number, number][], bt: [] as [number, number][] });
  const restart = () => {
    const s = sim.current;
    s.t = 0;
    s.sweep = 0;
    s.last = -1;
    s.bx = [];
    s.bt = [];
  };
  useEffect(restart, [ic, trace]);
  useRaf(
    (dt) => {
      const s = sim.current;
      s.t += dt;
      s.sweep += dt;
      if (s.sweep > trace.tWin) {
        s.sweep = 0;
        s.last = -1;
        s.bx = [];
        s.bt = [];
      }
      const [x, th] = modalFreeResponse(A.P, A.omega, ic.y0, ic.yd0, s.t);
      const cx = X0 + x * pxPerM;
      cartRef.current?.setAttribute('transform', `translate(${(cx - X0).toFixed(1)} 0)`);
      springRef.current?.setAttribute('d', springPath(WALL, 112, cx - 62, 112, 6, 7));
      const tx = cx + ROD_PX * Math.sin(th);
      const ty = PIVOT_Y + ROD_PX * Math.cos(th);
      rodRef.current?.setAttribute('x1', cx.toFixed(1));
      rodRef.current?.setAttribute('x2', tx.toFixed(1));
      rodRef.current?.setAttribute('y2', ty.toFixed(1));
      gRef.current?.setAttribute('cx', ((cx + tx) / 2).toFixed(1));
      gRef.current?.setAttribute('cy', ((PIVOT_Y + ty) / 2).toFixed(1));
      if (s.last < 0 || s.sweep - s.last >= TRACE_DT) {
        s.last = s.sweep;
        s.bx.push([s.sweep, x]);
        s.bt.push([s.sweep, x + 2 * L * th]);
        xTraceRef.current?.setAttribute('d', livePathD(s.bx, scales.current));
        tipTraceRef.current?.setAttribute('d', livePathD(s.bt, scales.current));
      }
    },
    true,
    wrapRef
  );

  const showNode = exc === 'mode2' && node2 > 0 && node2 < 2 * L * 1.05;
  const tex = (x: number) => fmt(x, 4).replace('−', '-');

  return (
    <div ref={wrapRef}>
      <SimLayout
        visual={
          <>
            <svg viewBox="0 66 560 226" className="anim" role="img" aria-label="Animated cart on a wall spring with a uniform rod swinging below it">
              <Ground x={WALL} y={112} w={70} vertical side="left" />
              <line x1={WALL} y1={FLOOR} x2={545} y2={FLOOR} stroke="var(--text-3)" strokeWidth={2} />
              <line x1={X0} y1={PIVOT_Y} x2={X0} y2={PIVOT_Y + ROD_PX + 16} stroke="var(--text-3)" strokeDasharray="3 4" />
              <path ref={springRef} fill="none" stroke="var(--text-2)" strokeWidth={1.8} />
              <g ref={cartRef}>
                <rect x={X0 - 62} y={86} width={124} height={50} rx={5} fill="var(--surface-2)" stroke="var(--text-2)" strokeWidth={1.8} />
                <text x={X0 - 30} y={116} textAnchor="middle" className="diagram-label">
                  m
                </text>
                <circle cx={X0 - 38} cy={147} r={10} fill="var(--surface)" stroke="var(--text-2)" strokeWidth={1.6} />
                <circle cx={X0 + 38} cy={147} r={10} fill="var(--surface)" stroke="var(--text-2)" strokeWidth={1.6} />
              </g>
              <line ref={rodRef} x1={X0} y1={PIVOT_Y} x2={X0} y2={PIVOT_Y + ROD_PX} stroke="var(--text)" strokeWidth={6} strokeLinecap="round" />
              <circle ref={gRef} cx={X0} cy={PIVOT_Y + ROD_PX / 2} r={4} fill="var(--surface)" stroke="var(--text)" strokeWidth={1.5} />
              {showNode && (
                <g>
                  <circle cx={X0} cy={PIVOT_Y + node2 * pxPerM} r={6} fill="none" stroke="var(--m2)" strokeWidth={2.5} />
                  <text x={X0 + 10} y={PIVOT_Y + node2 * pxPerM + 4} className="plot-note" fill="var(--m2)">
                    node of mode 2 ({fmt(node2, 3)} m below the pivot)
                  </text>
                </g>
              )}
              <text x={WALL + 30} y={98} className="diagram-label">
                k
              </text>
              <text x={X0 + 66} y={PIVOT_Y + ROD_PX} className="plot-note">
                rod M, 2L = {fmt(2 * L, 3)} m
              </text>
              <text x={8} y={284} className="plot-note">
                Drawn to scale ({fmt(pxPerM, 3)} px per m). Linear (small-angle) response.
              </text>
            </svg>
            <div className="row gap-s wrap">
              <span className="muted small">Start from rest with:</span>
              <Segmented
                size="sm"
                label="Initial condition"
                value={exc}
                onChange={(v: Exc) => setExc(v)}
                options={[
                  { value: 'mode1', label: 'mode 1 shape' },
                  { value: 'mode2', label: 'mode 2 shape' },
                  { value: 'cart', label: 'cart displaced' },
                  { value: 'rod', label: 'rod tilted' },
                ]}
              />
              <Button size="sm" onClick={restart}>
                Restart
              </Button>
            </div>
            <Plot x={{ min: 0, max: trace.tWin, label: 'time in this sweep (s)' }} y={{ min: -trace.yMax, max: trace.yMax, label: 'displacement (m)' }} height={170} ariaLabel="Horizontal displacement of the cart and of the rod tip against time">
              <HLine y={0} dash={false} />
              <LivePath pathRef={xTraceRef} scalesRef={scales} color="var(--text)" width={2} />
              <LivePath pathRef={tipTraceRef} scalesRef={scales} color="var(--text-2)" width={1.8} dash="5 3" />
            </Plot>
            <Legend
              items={[
                { label: 'cart x', color: 'var(--text)' },
                { label: 'rod tip x + 2Lθ', color: 'var(--text-2)', dash: true },
              ]}
            />
            <ModeShapes P={A.P} omega={A.omega} L={L} />
            <Plot x={{ min: 0, max: K_MAX, label: 'wall spring stiffness k (N/m)' }} y={{ min: 0, max: curves.yMax, label: 'ω (rad/s)' }} height={210} ariaLabel="Natural frequencies against wall-spring stiffness">
              <Line points={curves.unc} color="var(--text-3)" dash width={1.4} />
              <HLine y={wPivot} label="√(3g/4L): rod on a fixed pivot" />
              <Line points={curves.w1} color="var(--m1)" width={2.4} />
              <Line points={curves.w2} color="var(--m2)" width={2.4} />
              <VLine x={k} color="var(--text-3)" dash={false} width={1} />
              <Dot x={k} y={w2} color="var(--m2)" />
              <Handle x={k} y={w1} axis="x" clampX={[0, K_MAX]} onChange={(x) => setK(Math.round(x))} color="var(--accent)" label="k" ariaLabel="wall spring stiffness" />
            </Plot>
            <Legend
              items={[
                { label: 'ω₁ (mode 1)', color: 'var(--m1)' },
                { label: 'ω₂ (mode 2)', color: 'var(--m2)' },
                { label: 'uncoupled √(k/(m+M)) and √(3g/4L)', color: 'var(--text-3)', dash: true },
              ]}
            />
          </>
        }
        controls={
          <>
            <Slider label="cart mass" tex="m" tip="cart mass (kg)" value={m} min={1} max={20} step={0.5} unit="kg" onChange={setM} />
            <Slider label="rod mass" tex="M" tip="uniform rod mass (kg)" value={Mr} min={0.5} max={10} step={0.5} unit="kg" onChange={setMr} />
            <Slider label="half-length" tex="L" tip="half the rod length; G is L below the pivot (m)" value={L} min={0.2} max={1.5} step={0.05} unit="m" onChange={setL} />
            <Slider label="wall spring" tex="k" tip="wall spring stiffness (N/m); 0 = free cart" value={k} min={0} max={K_MAX} step={1} unit="N/m" onChange={setK} />
            <Toggle checked={g10} onChange={setG10} label="g = 10 m/s² (as the 2022 paper; off: 9.81)" />
            <TeX display>{`M = \\begin{bmatrix} m+M & ML \\\\ ML & \\tfrac43 ML^2 \\end{bmatrix} = \\begin{bmatrix} ${tex(A.M[0][0])} & ${tex(A.M[0][1])} \\\\ ${tex(A.M[1][0])} & ${tex(A.M[1][1])} \\end{bmatrix}`}</TeX>
            <TeX display>{`K = \\begin{bmatrix} k & 0 \\\\ 0 & MgL \\end{bmatrix} = \\begin{bmatrix} ${tex(A.K[0][0])} & 0 \\\\ 0 & ${tex(A.K[1][1])} \\end{bmatrix}`}</TeX>
            <Readouts>
              <Readout tex="\omega_1" tip="lower natural frequency (rad/s)" value={w1} unit="rad/s" tone="m1" />
              <Readout tex="\omega_2" tip="higher natural frequency (rad/s)" value={w2} unit="rad/s" tone="m2" />
              <Readout tex="f_1" tip="ω₁/2π" value={w1 / (2 * Math.PI)} unit="Hz" tone="m1" />
              <Readout tex="f_2" tip="ω₂/2π" value={w2 / (2 * Math.PI)} unit="Hz" tone="m2" />
              <Readout tex="r_1" tip="mode 1 shape Θ/X (rad per m of cart motion)" value={r1} unit="rad/m" sig={3} tone="m1" />
              <Readout tex="r_2" tip="mode 2 shape Θ/X (rad per m of cart motion)" value={r2} unit="rad/m" sig={3} tone="m2" />
              <Readout label="node, mode 2" tex="s_2" tip="distance below the pivot of the point that stays still in mode 2: −1/r₂ (m)" value={node2} unit="m" sig={3} />
              <Readout label="k → 0" tex="\omega_2^{(0)}" tip="ω₂ with no wall spring: √(3g(m+M)/(L(4m+M)))" value={wFree} unit="rad/s" sig={3} />
            </Readouts>
            <div className="row gap-s wrap">
              <span className="muted small">Presets:</span>
              <Button
                size="sm"
                onClick={() => {
                  setM(5);
                  setMr(3);
                  setL(1);
                  setK(10);
                  setG10(true);
                }}
              >
                2022 paper
              </Button>
              <Button size="sm" onClick={() => setK(0)}>
                k = 0 (free cart)
              </Button>
            </div>
            <Rich
              className="note"
              text={
                k === 0
                  ? `With $k = 0$, $\\det K = 0$: $\\omega_1 = 0$ (cart and rod translate together) and $\\omega_2 = \\sqrt{3g(m+M)/(L(4m+M))}$ = ${fmt(wFree, 4)} rad/s. Released from rest the total momentum $(m+M)\\dot x + ML\\dot\\theta$ stays zero, so nothing drifts: the cart recoils against the swinging rod while the centre of mass stays still.`
                  : `Mode 1 is in phase ($r_1 > 0$: the rod swings the way the cart moves); mode 2 is out of phase, with a point ${fmt(node2, 3)} m below the pivot that stays still.`
              }
            />
          </>
        }
      />
      <PredictReveal
        id="a2-cart-k0"
        question="Remove the wall spring ($k \to 0$). What happens to the lower natural frequency?"
        options={['It goes to zero', 'It tends to $\\sqrt{3g/4L}$', 'It does not change', 'It rises']}
        answer={0}
        explain="With $k = 0$ nothing resists a translation of cart and rod together: $K = \mathrm{diag}(0, MgL)$ is singular and $\omega_1 = 0$ (a rigid-body mode, drawn as mode 1). The other frequency tends to $\sqrt{3g(m+M)/(L(4m+M))}$: 3.230 rad/s for the 2022 values, above the fixed-pivot $\sqrt{3g/4L}$ = 2.739 rad/s because the light cart recoils."
        tryIt="drag the k handle on the lower plot to 0 and watch ω₁ (blue) and the mode-1 drawing."
        onApply={() => {
          setK(0);
          setExc('rod');
        }}
      />
      <PredictReveal
        id="a2-cart-heavy"
        question="Make the cart very heavy compared with the rod ($m \gg M$). The higher natural frequency tends to…"
        options={['$\\sqrt{g/L}$', '$\\sqrt{3g/4L}$: the rod on a fixed pivot', '$\\sqrt{g/2L}$', 'zero']}
        answer={1}
        explain="A heavy cart barely moves, so the rod swings about a fixed pivot: $\tfrac43 ML^2\ddot\theta + MgL\theta = 0$, $\omega^2 = 3g/4L$. Not $\sqrt{g/L}$: the rod is a compound pendulum, not a point mass at G. The cart mode drops to $\sqrt{k/(m+M)}$."
        tryIt="set m = 20 kg and M = 0.5 kg; compare ω₂ with the dashed line."
        onApply={() => {
          setM(20);
          setMr(0.5);
        }}
      />
      <PredictReveal
        id="a2-cart-mode1"
        question="2022 values. Start from rest in mode 1’s shape, $\theta_0 = r_1x_0$ (e.g. $x_0$ = 1 m and $\theta_0$ = 0.141 rad). What do you see?"
        options={['Beating: energy swaps between cart and rod', 'A single frequency: cart and rod swing together at ω₁', 'Only the rod moves']}
        answer={1}
        explain="Those initial conditions match mode 1’s shape exactly, so $Y_0 = P^{-1}X_0$ has no mode-2 part: everything oscillates at $\omega_1$ = 1.090 rad/s and both traces are clean, in-phase sine waves (2022 A2.5: θ₀ = 0.141 rad = 8.08°). Any other start mixes both modes: with only the cart displaced the rod tip trace wobbles at both frequencies."
        tryIt="choose the 2022 preset, then ‘mode 1 shape’; compare the traces with ‘cart displaced’."
        onApply={() => {
          setM(5);
          setMr(3);
          setL(1);
          setK(10);
          setG10(true);
          setExc('mode1');
        }}
      />
    </div>
  );
}
