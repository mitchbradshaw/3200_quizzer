// Modal-superposition lab: drag a harmonic point force along the beam, sweep its frequency, and watch the
// signed modal amplitudes aᵢ (bars) build the animated deflected shape y(x) sin Ωt. Units: P L³/EI.
import { useMemo, useRef, useState, type KeyboardEvent as RKeyboardEvent, type PointerEvent as RPointerEvent } from 'react';
import { type BeamBC, beamBCInfo, betaL, modeShape, modeShapeSamples, nodes, rigidModeShape } from '../../../physics/beams';
import { usePrefersReducedMotion, useRaf } from '../../../anim/hooks';
import { Bars, Handle, HLine, Line, Plot, VLine } from '../../../plot/Plot';
import { svgPoint } from '../../../ui/diagrams';
import { Button, Legend, Readout, Segmented, SimLayout, Slider, Toggle, modeColor } from '../../../ui/kit';
import { PredictReveal } from '../../../ui/PredictReveal';
import { Rich } from '../../../ui/Rich';
import { fmt } from '../../../engine/format';
import { BC_NAME, BC_ORDER, BC_SHORT, RIGID } from '../../B3/physics';
import { EndSymbol, NodeSnaps, ReadoutGrid, beamPathD } from '../../B3/explore/beamDraw';
import { modeTone } from '../../B3/explore/ModeShapes';

const N = 120;
const NM = 4; // modes summed and shown
const NREF = 10; // modes used for the truncation check
const W = 600;
const X0 = 54;
const X1 = 546;
const AX = 112;
const AMP = 62; // px for the largest |y|
const ANIM_HZ = 0.55;
const SUB = '₁₂₃₄₅';
const RMIN = 0.05;
const RMAX = 60;
/** Mode values are O(1); round-off at a snapped node (~1e-16) is shown as an exact 0. */
const clean = (y: number) => (Math.abs(y) < 1e-9 ? 0 : y);

interface Preset {
  label: string;
  bc: BeamBC;
  xe: number;
  xo: number;
  r: number;
  note: string;
}
const PRESETS: Preset[] = [
  { label: 'LB6 Ex 9.3', bc: 'clamped-free', xe: 0.6, xo: 1, r: 4, note: 'Cantilever, force at 0.6L, Ω = 4ω₁.' },
  { label: 'Sample prob. 4', bc: 'clamped-free', xe: 0.7, xo: 1, r: 10, note: 'Force 0.3L from the tip, Ω = 10ω₁.' },
  { label: '2023 blade', bc: 'clamped-free', xe: 0.5, xo: 1, r: 0.5, note: 'Bearing force at G = 0.5L, Ω = 0.5ω₁ (B2.4).' },
  { label: '2024 shaft', bc: 'pinned-pinned', xe: 0.6, xo: 0.52, r: 0.239, note: 'Pinned–pinned shaft, force at 0.6L, Ω = 0.239ω₁ (B2.5).' },
  { label: '2025 tidal', bc: 'clamped-free', xe: 2 / 3, xo: 1, r: 3.4, note: 'Force at 2L/3, Ω = 3.4ω₁ (B2.3).' },
  { label: '2025 helicopter', bc: 'clamped-free', xe: 0.8, xo: 1, r: 32, note: 'Flutter force at 0.8R, Ω = 32ω₁ (B1.3).' },
  { label: 'W7.7 machine', bc: 'clamped-clamped', xe: 0.5, xo: 0.5, r: 1 / 3, note: 'Machine at mid-span, Ω = ω₁/3.' },
];

export default function ForcedLab() {
  const [bc, setBc] = useState<BeamBC>('clamped-free');
  const [xe, setXe] = useState(0.6);
  const [xo, setXo] = useState(1);
  const [r, setR] = useState(4);
  const [showModes, setShowModes] = useState(true);
  const [rigidOn, setRigidOn] = useState(false);
  const [playing, setPlaying] = useState(true);
  const reduced = usePrefersReducedMotion();
  const info = beamBCInfo(bc);
  const nRigid = RIGID[bc];
  const useRigid = rigidOn && nRigid > 0;

  // Per-BC precomputation: roots, frequency ratios, sampled mode shapes and node lists.
  const pre = useMemo(() => {
    const roots = betaL(bc, NREF);
    const b1 = roots[0];
    const shapes = Array.from({ length: NM }, (_, k) => modeShapeSamples(bc, k + 1, N));
    const rigidShapes = Array.from({ length: RIGID[bc] }, (_, k) => Float64Array.from({ length: N + 1 }, (_, j) => rigidModeShape(bc, k + 1, j / N)));
    const nodeMarks: { x: number; i: number }[] = [];
    for (let i = 1; i <= NM; i++) for (const x of nodes(bc, i)) nodeMarks.push({ x, i });
    return { roots, b1, wr: roots.map((b) => (b / b1) ** 2), bL4: roots.map((b) => b ** 4), shapes, rigidShapes, nodeMarks: nodeMarks.sort((a, b) => a.x - b.x) };
  }, [bc]);

  // Modal amplitudes for this force position and frequency (units P L³/EI).
  const st = useMemo(() => {
    const Ye = pre.roots.map((_, k) => clean(modeShape(bc, k + 1, xe)));
    const Yo = pre.roots.map((_, k) => clean(modeShape(bc, k + 1, xo)));
    const DF = pre.wr.map((w) => 1 / (1 - (r / w) ** 2));
    const a = Ye.map((y, k) => (y * DF[k]) / pre.bL4[k]);
    const ar = pre.rigidShapes.map((_, k) => -rigidModeShape(bc, k + 1, xe) / (r * r * pre.bL4[0]));
    const shape = new Float64Array(N + 1);
    const modeCurves = pre.shapes.map((s, k) => s.map((v) => v * a[k]));
    for (let j = 0; j <= N; j++) {
      let y = 0;
      for (let k = 0; k < NM; k++) y += modeCurves[k][j];
      if (useRigid) pre.rigidShapes.forEach((s, k) => (y += ar[k] * s[j]));
      shape[j] = y;
    }
    let maxAbs = 1e-30;
    for (const v of shape) maxAbs = Math.max(maxAbs, Math.abs(v));
    for (const c of modeCurves) for (const v of c) maxAbs = Math.max(maxAbs, Math.abs(v) * 0.999);
    const rigidOut = useRigid ? ar.reduce((s, v, k) => s + v * rigidModeShape(bc, k + 1, xo), 0) : 0;
    const contrib = a.map((v, k) => v * Yo[k]);
    const y4 = contrib.slice(0, NM).reduce((s, v) => s + v, 0) + rigidOut;
    const y10 = contrib.reduce((s, v) => s + v, 0) + rigidOut;
    const tot = contrib.slice(0, NM).reduce((s, v) => s + Math.abs(v), 0);
    let dom = 0;
    for (let k = 1; k < NM; k++) if (Math.abs(contrib[k]) > Math.abs(contrib[dom])) dom = k;
    return { Ye, Yo, DF, a, ar, shape, modeCurves, maxAbs, y4, y10, contrib, tot, dom };
  }, [pre, bc, xe, xo, r, useRigid]);

  // Frequency response at x_out (4 modes) and mode 1 alone, against Ω/ω₁ on log axes.
  const frf = useMemo(() => {
    const coef = pre.roots.slice(0, NM).map((_, k) => (clean(modeShape(bc, k + 1, xe)) * clean(modeShape(bc, k + 1, xo))) / pre.bL4[k]);
    const rigidC = useRigid ? pre.rigidShapes.map((_, k) => (-rigidModeShape(bc, k + 1, xe) * rigidModeShape(bc, k + 1, xo)) / pre.bL4[0]).reduce((s, v) => s + v, 0) : 0;
    const n = 700;
    const xs = new Float64Array(n + 1);
    const ys = new Float64Array(n + 1);
    const y1 = new Float64Array(n + 1);
    for (let j = 0; j <= n; j++) {
      const rr = RMIN * Math.pow(RMAX / RMIN, j / n);
      xs[j] = rr;
      let y = rigidC / (rr * rr);
      for (let k = 0; k < NM; k++) y += coef[k] / (1 - (rr / pre.wr[k]) ** 2);
      ys[j] = Math.abs(y);
      y1[j] = Math.abs(coef[0] / (1 - rr * rr));
    }
    return { all: { x: xs, y: ys }, one: { x: xs, y: y1 } };
  }, [pre, bc, xe, xo, useRigid]);

  // Animation: deflected shape, mode curves and the force arrow, through refs.
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const beamRef = useRef<SVGPathElement>(null);
  const modeRefs = useRef<(SVGPathElement | null)[]>([]);
  const arrowRef = useRef<SVGPathElement>(null);
  const t = useRef(0.4);
  const scale = AMP / st.maxAbs;
  const xeX = X0 + (X1 - X0) * xe;
  /** Force arrow P sin Ωt touching the beam at x_e: pointing up (positive) when s > 0, down when s < 0. */
  const arrowD = (s: number) => {
    const yb = AX - scale * s * sampleAt(st.shape, xe);
    const L = 40 * s;
    if (Math.abs(L) < 2) return '';
    const sg = Math.sign(L);
    const tail = yb + L + sg * 6;
    const head = yb + sg * 4;
    return `M${xeX.toFixed(1)} ${tail.toFixed(1)}L${xeX.toFixed(1)} ${head.toFixed(1)}M${(xeX - 6).toFixed(1)} ${(head + sg * 9).toFixed(1)}L${xeX.toFixed(1)} ${head.toFixed(1)}L${(xeX + 6).toFixed(1)} ${(head + sg * 9).toFixed(1)}`;
  };
  const drawFrame = (s: number) => {
    beamRef.current?.setAttribute('d', beamPathD(st.shape, X0, X1, AX, scale, s));
    st.modeCurves.forEach((c, k) => modeRefs.current[k]?.setAttribute('d', showModes ? beamPathD(c, X0, X1, AX, scale, s) : ''));
    arrowRef.current?.setAttribute('d', arrowD(s));
  };
  useRaf(
    (dt) => {
      t.current += dt;
      drawFrame(Math.sin(2 * Math.PI * ANIM_HZ * t.current));
    },
    playing && !reduced,
    wrapRef
  );
  const still = playing && !reduced ? Math.sin(2 * Math.PI * ANIM_HZ * t.current) : 1;

  // Dragging the force along the beam (pointer anywhere on the drawing) and arrow keys on the force.
  const drag = useRef(false);
  const setFromPointer = (e: RPointerEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const p = svgPoint(svgRef.current, e.clientX, e.clientY);
    setXe(Math.max(0, Math.min(1, Math.round(((p.x - X0) / (X1 - X0)) * 1000) / 1000)));
  };
  const onKey = (e: RKeyboardEvent<SVGGElement>) => {
    const step = e.shiftKey ? 0.05 : 0.005;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') setXe((v) => Math.min(1, +(v + step).toFixed(4)));
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') setXe((v) => Math.max(0, +(v - step).toFixed(4)));
    else return;
    e.preventDefault();
  };

  const bars = st.a.slice(0, NM).map((v, k) => ({ x: k + 1, y: v / Math.max(...st.a.slice(0, NM).map(Math.abs), ...(useRigid ? st.ar.map(Math.abs) : []), 1e-30), color: modeColor(k + 1), label: fmt(v, 3) }));
  const rigidBars = useRigid ? st.ar.map((v, k) => ({ x: NM + 1 + k, y: v / Math.max(...st.a.slice(0, NM).map(Math.abs), ...st.ar.map(Math.abs)), color: 'var(--text-3)', label: fmt(v, 3) })) : [];
  const nearNode = pre.nodeMarks.find((m) => Math.abs(m.x - xe) < 0.004);
  const live = Math.abs(st.y10) > 1e-12;
  const truncPct = live ? (Math.abs(st.y10 - st.y4) / Math.abs(st.y10)) * 100 : NaN;
  const mode1Pct = Math.abs(st.y4) > 1e-12 ? (st.contrib[0] / st.y4) * 100 : NaN;
  const apply = (p: Preset) => {
    setBc(p.bc);
    setXe(p.xe);
    setXo(p.xo);
    setR(p.r);
  };

  return (
    <div ref={wrapRef}>
      <SimLayout
        visual={
          <>
            <svg
              ref={svgRef}
              viewBox={`0 0 ${W} 215`}
              className="anim"
              role="img"
              aria-label={`${BC_NAME[bc]} beam driven by a harmonic force at ${xe.toFixed(3)}L; drag along the beam to move the force`}
              style={{ touchAction: 'none', cursor: 'ew-resize' }}
              onPointerDown={(e) => {
                drag.current = true;
                (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
                setFromPointer(e);
              }}
              onPointerMove={(e) => drag.current && setFromPointer(e)}
              onPointerUp={() => (drag.current = false)}
            >
              <line x1={X0} x2={X1} y1={AX} y2={AX} stroke="var(--text-3)" strokeDasharray="4 4" />
              {st.modeCurves.map((c, k) => (
                <path
                  key={k}
                  ref={(el) => {
                    modeRefs.current[k] = el;
                  }}
                  d={showModes ? beamPathD(c, X0, X1, AX, scale, still) : ''}
                  fill="none"
                  stroke={modeColor(k + 1)}
                  strokeWidth={1.6}
                  opacity={0.85}
                  strokeDasharray="5 3"
                />
              ))}
              <path ref={beamRef} d={beamPathD(st.shape, X0, X1, AX, scale, still)} fill="none" stroke="var(--text)" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
              <EndSymbol x={X0} y={AX} end={info.left} side="left" />
              <EndSymbol x={X1} y={AX} end={info.right} side="right" />
              {/* force: draggable, focusable */}
              <g tabIndex={0} role="slider" aria-label="Force position (fraction of L)" aria-valuemin={0} aria-valuemax={1} aria-valuenow={xe} onKeyDown={onKey} className="handle">
                <rect x={xeX - 14} y={AX - 80} width={28} height={160} fill="transparent" />
                <line x1={xeX} x2={xeX} y1={AX - 78} y2={AX + 78} stroke="var(--accent)" strokeDasharray="2 4" opacity={0.6} />
                <path ref={arrowRef} d={arrowD(still)} fill="none" stroke="var(--accent)" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
                <text x={Math.min(X1 - 40, Math.max(X0 + 40, xeX))} y={14} textAnchor="middle" className="plot-note" fill="var(--accent)">
                  {`P sin Ωt at ${xe.toFixed(3)}L`}
                </text>
              </g>
              {/* output point */}
              <path d={`M${X0 + (X1 - X0) * xo} ${AX + 70}l-6 10h12z`} fill="var(--text-2)" />
              <text x={Math.min(X1 - 10, Math.max(X0 + 10, X0 + (X1 - X0) * xo))} y={AX + 96} textAnchor="middle" className="plot-note">
                output
              </text>
              {/* node ruler: where modes 1–4 have nodes */}
              {pre.nodeMarks.map((m, k) => {
                const px = X0 + (X1 - X0) * m.x;
                return (
                  <g key={k}>
                    <line x1={px} x2={px} y1={AX + 54} y2={AX + 64} stroke={modeColor(m.i)} strokeWidth={2.4} />
                    <text x={px} y={AX + 50} textAnchor="middle" className="plot-note" fill={modeColor(m.i)} fontSize={10}>
                      {m.i}
                    </text>
                  </g>
                );
              })}
              <text x={X0} y={AX + 96} className="plot-note">
                node ruler
              </text>
            </svg>
            <Plot
              x={{ min: 0.4, max: NM + 0.6 + rigidBars.length, ticks: [...[1, 2, 3, 4], ...rigidBars.map((b) => b.x)], format: (v) => (v <= NM ? `a${SUB[v - 1]}` : `R${v - NM}`), label: 'modal amplitude (scaled to the largest; labels in PL³/EI)' }}
              y={{ min: -1.3, max: 1.3, ticks: [-1, 0, 1], format: (v) => (v === 0 ? '0' : v > 0 ? '+max' : '−max') }}
              height={190}
              ariaLabel="Signed modal amplitudes a1 to a4"
            >
              <HLine y={0} dash={false} color="var(--text-3)" />
              <Bars bars={[...bars, ...rigidBars]} width={0.56} />
            </Plot>
            <Plot x={{ min: RMIN, max: RMAX, log: true, label: 'forcing frequency Ω/ω₁' }} y={{ min: 1e-6, max: 10, log: true, label: '|y(x_out)| (PL³/EI)' }} height={220} ariaLabel="Response amplitude at the output point against forcing frequency">
              {pre.wr.slice(0, NM).map((w, k) =>
                w <= RMAX ? <VLine key={k} x={w} color={modeColor(k + 1)} label={`ω${SUB[k]}`} /> : null
              )}
              <Line points={frf.one} color="var(--m1)" dash="5 4" width={1.4} />
              <Line points={frf.all} color="var(--text)" width={2} />
              <Handle x={r} y={Math.min(10, Math.max(1e-6, Math.abs(st.y4)))} axis="x" clampX={[RMIN, RMAX]} onChange={(x) => setR(x)} color="var(--accent)" label="Ω" ariaLabel="Forcing frequency" />
            </Plot>
            <Legend
              items={[
                { label: 'sum of modes 1–4', color: 'var(--text)' },
                { label: 'mode 1 alone', color: 'var(--m1)', dash: true },
                ...(showModes ? [{ label: 'each mode’s share aᵢYᵢ(x)', color: 'var(--text-3)', dash: true }] : []),
              ]}
            />
          </>
        }
        controls={
          <>
            <div>
              <div className="muted small">Supports</div>
              <Segmented size="sm" label="Boundary conditions" value={bc} onChange={(v: BeamBC) => setBc(v)} options={BC_ORDER.map((b) => ({ value: b, label: BC_SHORT[b], title: BC_NAME[b] }))} />
            </div>
            <Slider label="force position" tex="x_e/L" tip="where the harmonic force P sin Ωt acts (drag the arrow too)" value={xe} min={0} max={1} step={0.001} sig={3} onChange={setXe} />
            <NodeSnaps marks={pre.nodeMarks} onSnap={setXe} current={xe} />
            <Slider label="output point" tex="x_{out}/L" tip="where the response y is read (sensor position)" value={xo} min={0} max={1} step={0.005} sig={3} onChange={setXo} />
            <Slider label="forcing frequency" tex="\Omega/\omega_1" tip="forcing frequency over the first natural frequency (log scale)" value={r} min={RMIN} max={RMAX} log sig={3} onChange={setR} />
            <div className="row gap-s wrap">
              <Toggle checked={showModes} onChange={setShowModes} label="show each mode’s share" />
              {nRigid > 0 && <Toggle checked={rigidOn} onChange={setRigidOn} label={`add ${nRigid} rigid-body mode${nRigid > 1 ? 's' : ''}`} />}
            </div>
            <ReadoutGrid cols={2}>
              <Readout tex="y(x_{out})" tip="steady amplitude at the output, Σ aᵢ Yᵢ(x_out), in units of PL³/EI" value={st.y4} sig={3} unit="PL³/EI" />
              <Readout label="phase" tip="sign of y relative to the force: in phase (+) or out of phase (−)" text={Math.abs(st.y4) < 1e-12 ? '—' : st.y4 > 0 ? 'in phase (+)' : 'out of phase (−)'} />
              <Readout label="dominant" tip="mode with the largest |aᵢ Yᵢ(x_out)| and its share of the summed magnitudes" text={st.tot > 1e-12 ? `mode ${st.dom + 1} (${fmt((Math.abs(st.contrib[st.dom]) / st.tot) * 100, 3)} %)` : 'none: output at a support'} tone={st.tot > 1e-12 ? modeTone(st.dom + 1) : undefined} />
              <Readout label="mode 1 alone" tip="mode 1’s contribution as a % of the 4-mode value at x_out" value={mode1Pct} unit="%" sig={3} />
              <Readout label="modes 5–10 add" tip="change in y(x_out) from adding modes 5 to 10: the truncation error" value={truncPct} unit="%" sig={2} />
            </ReadoutGrid>
            <Rich
              className="note"
              text={
                nearNode
                  ? `The force sits on a node of mode ${nearNode.i}: $Y_${nearNode.i}(x_e) \\approx 0$, so $a_${nearNode.i} \\approx 0$. A force at a point that does not move in a mode does no work on it.`
                  : `$a_i = \\dfrac{1}{(\\beta_i L)^4}\\,\\dfrac{PL^3}{EI}\\,\\dfrac{Y_i(x_e)}{1-\\Omega^2/\\omega_i^2}$: mode stiffness, static scale, the force’s grip on the mode, and resonance.`
              }
            />
            {useRigid && <Rich className="note" text="Rigid-body terms: $a_r = -Y_r(x_e)/((\beta_1 L)^4 (\Omega/\omega_1)^2)$ in PL³/EI (mass only, ω = 0: at the load point the beam moves against the force at every Ω). The course method (official 2019 B2.3) sums the elastic modes only." />}
            <div className="row gap-s wrap">
              <span className="muted small">Cases:</span>
              {PRESETS.map((p) => (
                <Button key={p.label} size="sm" onClick={() => apply(p)} title={p.note}>
                  {p.label}
                </Button>
              ))}
              <Button size="sm" variant="ghost" onClick={() => setPlaying((p) => !p)} disabled={reduced}>
                {playing && !reduced ? 'Pause' : 'Play'}
              </Button>
            </div>
          </>
        }
        below={<ModalTable rows={[0, 1, 2, 3].map((k) => ({ i: k + 1, wr: pre.wr[k], r: r / pre.wr[k], DF: st.DF[k], inv: 1 / pre.bL4[k], Ye: st.Ye[k], a: st.a[k], Yo: st.Yo[k], y: st.contrib[k] }))} />}
      />
      <PredictReveal
        id="b4-lab-ex93"
        question="Cantilever, force at 0.6L, $\Omega = 4\omega_1$. The forcing is closest to $\omega_2 = 6.27\omega_1$. Which mode has the largest $|a_i|$?"
        options={['mode 1', 'mode 2', 'mode 3']}
        answer={0}
        explain="Mode 1: $a_1$ = −4.97×10⁻³ against $a_2$ = +4.10×10⁻³ PL³/EI (LB6 Example 9.3). Mode 2 has the bigger dynamic factor (1.69 against −1/15, a 25× gain) and even a slightly better grip ($Y_2$ = 1.18 vs $Y_1$ = 0.92 at 0.6L), but it is 39× stiffer: $1/(\beta_2 L)^4$ = 1/486 against 1/12.4. Net $|a_2/a_1|$ = 0.82. Being closest in frequency is not enough; compare all four factors."
        tryIt="press LB6 Ex 9.3 and compare the bars."
        onApply={() => apply(PRESETS[0])}
      />
      <PredictReveal
        id="b4-lab-node"
        question="Now drag the force to 0.783L on the same cantilever. What happens to the mode-2 bar?"
        options={['it grows', 'it vanishes', 'it changes sign but keeps its size']}
        answer={1}
        explain="0.783L is the node of mode 2: $Y_2(x_e) = 0$ so $a_2 = 0$ at every frequency. The FRF loses its mode-2 resonance entirely. The same idea explains why a shaker at mid-span of a symmetric beam cannot excite any even mode (2024 A3.5)."
        tryIt="press the 0.783L snap button."
        onApply={() => {
          setBc('clamped-free');
          setXe(nodes('clamped-free', 2)[0]);
          setXo(1);
          setR(4);
        }}
      />
      <PredictReveal
        id="b4-lab-phase"
        question="Force at the tip of a cantilever. Raise Ω from 0.8ω₁ to 1.2ω₁. What does the mode-1 bar do?"
        options={['grows and stays positive', 'flips sign: the beam now moves against the force', 'shrinks to zero']}
        answer={1}
        explain="The dynamic factor $1/(1-\Omega^2/\omega_1^2)$ goes from +2.8 to −2.3: through resonance the response swings from in phase to out of phase. Watch the arrow and the tip move opposite ways. Undamped, the amplitude is infinite exactly at $\omega_1$, so signs matter when you sum modes."
        tryIt="set the force at 1.0L and move Ω across ω₁."
        onApply={() => {
          setBc('clamped-free');
          setXe(1);
          setXo(1);
          setR(1.2);
        }}
      />
      <PredictReveal
        id="b4-lab-heli"
        question="Helicopter blade (cantilever), flutter force at 0.8L, $\Omega = 32\omega_1$. Which mode dominates the tip response?"
        options={['mode 1, the fundamental', 'mode 2', 'mode 3', 'mode 4']}
        answer={3}
        explain="$\omega_4 = 34.4\omega_1$, so $\Omega/\omega_4$ = 0.93 and its dynamic factor is 7.5, while 0.8L is near a mode-4 antinode ($Y_4$ = 1.29). Mode 4 gives about 72 % of the summed |contributions| of modes 1–5 (2025 B1.3(d); 75 % of the four modes shown here). At high Ω the mode nearest resonance wins unless the force sits near its node."
        tryIt="press 2025 helicopter."
        onApply={() => apply(PRESETS[5])}
      />
    </div>
  );
}

function sampleAt(s: ArrayLike<number>, xi: number): number {
  const n = s.length - 1;
  const u = Math.max(0, Math.min(1, xi)) * n;
  const k = Math.min(n - 1, Math.floor(u));
  return s[k] + (s[k + 1] - s[k]) * (u - k);
}

function ModalTable({ rows }: { rows: { i: number; wr: number; r: number; DF: number; inv: number; Ye: number; a: number; Yo: number; y: number }[] }) {
  const cell = { padding: '4px 6px' };
  const line = (label: string, tip: string, f: (q: (typeof rows)[number]) => string) => (
    <tr>
      <th style={cell} title={tip}>
        <Rich text={label} inline />
      </th>
      {rows.map((q) => (
        <td key={q.i} style={cell} className="mono">
          {f(q)}
        </td>
      ))}
    </tr>
  );
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="table" style={{ fontSize: '0.82rem' }} aria-label="Modal amplitude table">
        <thead>
          <tr>
            <th style={cell}>The exam table</th>
            {rows.map((q) => (
              <th key={q.i} style={{ ...cell, color: modeColor(q.i) }}>
                mode {q.i}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {line('$\\omega_i/\\omega_1$', 'natural frequency ratio (βᵢL/β₁L)²', (q) => fmt(q.wr, 4))}
          {line('$\\Omega/\\omega_i$', 'forcing over this mode’s frequency', (q) => fmt(q.r, 3))}
          {line('$1/(1-\\Omega^2/\\omega_i^2)$', 'dynamic factor (negative above ωᵢ)', (q) => fmt(q.DF, 3))}
          {line('$1/(\\beta_i L)^4$', 'modal flexibility', (q) => fmt(q.inv, 3))}
          {line('$Y_i(x_e)$', 'mode value at the force', (q) => fmt(q.Ye, 3))}
          {line('$a_i$ (PL³/EI)', 'modal amplitude', (q) => fmt(q.a, 3))}
          {line('$Y_i(x_{out})$', 'mode value at the output', (q) => fmt(q.Yo, 3))}
          {line('$a_iY_i(x_{out})$', 'contribution to the output (signed)', (q) => fmt(q.y, 3))}
        </tbody>
      </table>
    </div>
  );
}
