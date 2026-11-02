// Why a force at a node does not excite that mode: modes 1–4 stacked, a force line through all of them, and
// the force's grip on each mode, Yᵢ(x_e). Optional sensor: a mode shows up in a measurement only if both the
// shaker and the sensor are off its nodes (2024 A3.5).
import { useMemo, useRef, useState, type KeyboardEvent as RKeyboardEvent, type PointerEvent as RPointerEvent } from 'react';
import { type BeamBC, beamBCInfo, modeShape, modeShapeSamples, nodes } from '../../../physics/beams';
import { usePrefersReducedMotion, useRaf } from '../../../anim/hooks';
import { svgPoint } from '../../../ui/diagrams';
import { Badge, Button, Readout, Readouts, Segmented, SimLayout, Slider, Toggle, modeColor } from '../../../ui/kit';
import { PredictReveal } from '../../../ui/PredictReveal';
import { Rich } from '../../../ui/Rich';
import { BC_NAME, BC_ORDER, BC_SHORT } from '../../B3/physics';
import { EndSymbol, NodeSnaps, beamPathD } from '../../B3/explore/beamDraw';
import { modeTone } from '../../B3/explore/ModeShapes';

const N = 140;
const W = 600;
const X0 = 76;
const X1 = 484;
const ROW = 92;
const TOP = 8;
const SC = 17; // px per unit Y
const ZERO = 0.03; // |Y| below this counts as "at a node"
const MODES = [1, 2, 3, 4];
/** Round-off at a snapped node (~1e-16) shown as an exact 0. */
const clean = (y: number) => (Math.abs(y) < 1e-9 ? 0 : y);

export default function NodeForce() {
  const [bc, setBc] = useState<BeamBC>('pinned-pinned');
  const [xe, setXe] = useState(0.3);
  const [sensorOn, setSensorOn] = useState(false);
  const [xs, setXs] = useState(0.75);
  const [playing, setPlaying] = useState(true);
  const reduced = usePrefersReducedMotion();
  const info = beamBCInfo(bc);
  const shapes = useMemo(() => MODES.map((i) => modeShapeSamples(bc, i, N)), [bc]);
  const nodeList = useMemo(() => MODES.map((i) => nodes(bc, i)), [bc]);
  const Ye = MODES.map((i) => clean(modeShape(bc, i, xe)));
  const Ys = MODES.map((i) => clean(modeShape(bc, i, xs)));
  const excited = MODES.filter((_, k) => Math.abs(Ye[k]) >= ZERO);
  const notExcited = MODES.filter((_, k) => Math.abs(Ye[k]) < ZERO);
  const seen = MODES.filter((_, k) => Math.abs(Ye[k]) >= ZERO && Math.abs(Ys[k]) >= ZERO);
  const H = TOP + ROW * 4 + 10;
  const px = (x: number) => X0 + (X1 - X0) * x;

  // Animation: each mode oscillates slowly at its own rate; the force dot rides on the curve.
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const curveRefs = useRef<(SVGPathElement | null)[]>([]);
  const dotRefs = useRef<(SVGCircleElement | null)[]>([]);
  const sDotRefs = useRef<(SVGCircleElement | null)[]>([]);
  const t = useRef(0);
  const phase = useRef([1, 1, 1, 1]); // last drawn phase of each mode, so a paused frame stays consistent
  useRaf(
    (dt) => {
      t.current += dt;
      MODES.forEach((i, k) => {
        const c = Math.cos(2 * Math.PI * 0.4 * Math.pow(i, 0.6) * t.current);
        phase.current[k] = c;
        const y0 = TOP + ROW * k + ROW / 2;
        curveRefs.current[k]?.setAttribute('d', beamPathD(shapes[k], X0, X1, y0, SC, c));
        dotRefs.current[k]?.setAttribute('cy', (y0 - SC * c * Ye[k]).toFixed(1));
        sDotRefs.current[k]?.setAttribute('cy', (y0 - SC * c * Ys[k]).toFixed(1));
      });
    },
    playing && !reduced,
    wrapRef
  );

  const drag = useRef(false);
  const fromPointer = (e: RPointerEvent<SVGSVGElement>) => {
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
  const snaps = useMemo(() => {
    const out: { x: number; i: number }[] = [];
    nodeList.forEach((ns, k) => ns.forEach((x) => out.push({ x, i: k + 1 })));
    return out.sort((a, b) => a.x - b.x);
  }, [nodeList]);

  return (
    <div ref={wrapRef}>
      <SimLayout
        visual={
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            className="anim"
            role="img"
            aria-label={`Modes 1 to 4 of a ${BC_NAME[bc]} beam with a force at ${xe.toFixed(3)}L`}
            style={{ touchAction: 'none', cursor: 'ew-resize' }}
            onPointerDown={(e) => {
              drag.current = true;
              (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
              fromPointer(e);
            }}
            onPointerMove={(e) => drag.current && fromPointer(e)}
            onPointerUp={() => (drag.current = false)}
          >
            {MODES.map((i, k) => {
              const y0 = TOP + ROW * k + ROW / 2;
              const atNode = Math.abs(Ye[k]) < ZERO;
              return (
                <g key={`${bc}-${i}`}>
                  <text x={8} y={y0 + 4} className="plot-note" fill={modeColor(i)} fontWeight={600}>
                    {`mode ${i}`}
                  </text>
                  <line x1={X0} x2={X1} y1={y0} y2={y0} stroke="var(--border)" />
                  <path
                    ref={(el) => {
                      curveRefs.current[k] = el;
                    }}
                    d={beamPathD(shapes[k], X0, X1, y0, SC, phase.current[k])}
                    fill="none"
                    stroke={modeColor(i)}
                    strokeWidth={2.6}
                  />
                  <EndSymbol x={X0} y={y0} end={info.left} side="left" size={0.6} showFree={false} />
                  <EndSymbol x={X1} y={y0} end={info.right} side="right" size={0.6} showFree={false} />
                  {nodeList[k].map((xn) => (
                    <circle key={xn} cx={px(xn)} cy={y0} r={3.4} fill="var(--surface)" stroke={modeColor(i)} strokeWidth={1.6} />
                  ))}
                  <circle
                    ref={(el) => {
                      dotRefs.current[k] = el;
                    }}
                    cx={px(xe)}
                    cy={y0 - SC * phase.current[k] * Ye[k]}
                    r={5.5}
                    fill="var(--accent)"
                  />
                  {sensorOn && (
                    <circle
                      ref={(el) => {
                        sDotRefs.current[k] = el;
                      }}
                      cx={px(xs)}
                      cy={y0 - SC * phase.current[k] * Ys[k]}
                      r={4.5}
                      fill="var(--surface)"
                      stroke="var(--text-2)"
                      strokeWidth={2}
                    />
                  )}
                  <text x={X1 + 18} y={y0 - 4} className="plot-note" fill={atNode ? 'var(--bad)' : 'var(--text)'} fontWeight={600}>
                    {atNode ? '✗ at a node' : `✓ Y = ${Ye[k].toFixed(2).replace('-', '−')}`}
                  </text>
                  <text x={X1 + 18} y={y0 + 12} className="plot-note">
                    {atNode ? 'not excited' : 'excited'}
                  </text>
                </g>
              );
            })}
            <g tabIndex={0} role="slider" aria-label="Force position (fraction of L)" aria-valuemin={0} aria-valuemax={1} aria-valuenow={xe} onKeyDown={onKey} className="handle">
              <line x1={px(xe)} x2={px(xe)} y1={TOP} y2={H - 6} stroke="var(--accent)" strokeWidth={2} strokeDasharray="5 4" />
              <rect x={px(xe) - 12} y={TOP} width={24} height={H - TOP} fill="transparent" />
            </g>
            {sensorOn && <line x1={px(xs)} x2={px(xs)} y1={TOP} y2={H - 6} stroke="var(--text-3)" strokeWidth={1.5} strokeDasharray="2 3" />}
          </svg>
        }
        controls={
          <>
            <div>
              <div className="muted small">Supports</div>
              <Segmented size="sm" label="Boundary conditions" value={bc} onChange={(v: BeamBC) => setBc(v)} options={BC_ORDER.map((b) => ({ value: b, label: BC_SHORT[b], title: BC_NAME[b] }))} />
            </div>
            <Slider label="force (shaker) at" tex="x_e/L" tip="position of the harmonic force; drag in the drawing or use the arrow keys" value={xe} min={0} max={1} step={0.001} sig={3} onChange={setXe} />
            <NodeSnaps marks={snaps} onSnap={setXe} current={xe} />
            <Readouts>
              {MODES.map((i, k) => (
                <Readout key={i} tex={`Y_${i}(x_e)`} tip={`mode ${i} at the force: its modal force is P·Y${'₁₂₃₄'[k]}(x_e); zero at a node`} value={Ye[k]} sig={3} tone={Math.abs(Ye[k]) < ZERO ? 'bad' : modeTone(i)} />
              ))}
            </Readouts>
            <div className="row gap-s wrap">
              <Badge tone="ok">excited: {excited.length ? excited.join(', ') : 'none'}</Badge>
              <Badge tone={notExcited.length ? 'bad' : 'muted'}>not excited: {notExcited.length ? notExcited.join(', ') : 'none'}</Badge>
            </div>
            <Toggle checked={sensorOn} onChange={setSensorOn} label="add a sensor (accelerometer)" />
            {sensorOn && (
              <>
                <Slider label="sensor at" tex="x_s/L" tip="sensor position: a mode is measured only if the shaker excites it and the sensor sees it" value={xs} min={0} max={1} step={0.001} sig={3} onChange={setXs} />
                <Rich className="note" text={`Measurable modes (excited **and** seen): **${seen.length ? seen.join(', ') : 'none'}**. The FRF term of mode $i$ is proportional to $Y_i(x_e)\\,Y_i(x_s)$: either factor zero hides the mode.`} />
              </>
            )}
            <Rich className="note" text="The modal force is the work the load does through the mode’s motion, $P\,Y_i(x_e)$. At a node the point does not move, so no work is done and the mode is not excited, at **any** frequency. A lumped mass at a node, likewise, adds no kinetic energy to that mode (B3, B5)." />
            <Button size="sm" variant="ghost" onClick={() => setPlaying((p) => !p)} disabled={reduced}>
              {playing && !reduced ? 'Pause' : 'Play'}
            </Button>
          </>
        }
      />
      <PredictReveal
        id="b4-node-ss-mid"
        question="A shaker drives a simply supported beam at mid-span. Which of modes 1–4 can it excite?"
        options={['all four', 'modes 1 and 3 only', 'modes 2 and 4 only', 'mode 1 only']}
        answer={1}
        explain="Mid-span is a node of every even mode of a symmetric beam ($\sin(i\pi/2) = 0$ for even $i$), so modes 2 and 4 get no excitation. That is why 2024 A3.5 could find only modes 1 and 3; moving the shaker to about 0.15L or 0.4L fixes it."
        tryIt="choose P–P and drag the force to 0.5L."
        onApply={() => {
          setBc('pinned-pinned');
          setXe(0.5);
        }}
      />
      <PredictReveal
        id="b4-node-cf-half"
        question="Cantilever, force at mid-length (0.5L). Which mode is (almost) not excited?"
        options={['mode 1', 'mode 2', 'mode 3', 'none: a cantilever has no node there']}
        answer={2}
        explain="Mode 3 has a node at 0.504L, so $Y_3(0.5L)$ = 0.04: almost nothing. Mode 2's node is at 0.783L, so it is well excited at mid-length ($Y_2$ = 1.43; 2024 B1.6(d) is false for this reason)."
        tryIt="choose C–F and set the force to 0.5L."
        onApply={() => {
          setBc('clamped-free');
          setXe(0.5);
        }}
      />
      <PredictReveal
        id="b4-node-sweetspot"
        question="A ball hits a free–free racquet at 0.776L (the head-side node of mode 1). Which mode does it **not** excite?"
        options={['mode 1, the fundamental', 'mode 2', 'all modes are excited']}
        answer={0}
        explain="0.776L is a node of the free–free fundamental, so the impact does no work on mode 1: the sweet spot. Modes 2–4 are still excited, but they are stiffer ($1/(\beta_i L)^4$) and higher in frequency, so the hand feels little (official 2018 B1.7, 2019 B1.8)."
        tryIt="choose F–F and snap to 0.776L."
        onApply={() => {
          setBc('free-free');
          setXe(nodes('free-free', 1)[1]);
        }}
      />
    </div>
  );
}
