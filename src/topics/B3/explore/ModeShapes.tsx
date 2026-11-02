// Mode shapes for every handout boundary condition: animated, nodes marked, support symbols at each end,
// and (optionally) the handout's rounded constants to show why accuracy near a free end is fragile.
import { useMemo, useRef, useState } from 'react';
import { type BeamBC, beamBCInfo, betaL, modeShapeSamples, nodes, sigma } from '../../../physics/beams';
import { usePrefersReducedMotion, useRaf } from '../../../anim/hooks';
import { Dot, HLine, Line, Plot } from '../../../plot/Plot';
import { Button, Callout, Legend, Readout, Readouts, Segmented, SimLayout, Toggle, modeColor, type Tone } from '../../../ui/kit';
import { PredictReveal } from '../../../ui/PredictReveal';
import { Rich } from '../../../ui/Rich';
import { BC_NAME, BC_ORDER, BC_SHORT, HANDOUT, RIGID, handoutModeShape, ratioTrick } from '../physics';
import { EndSymbol, beamPathD, envelopeD, posLabel } from './beamDraw';

const N = 160; // samples along the beam
const XS = Float64Array.from({ length: N + 1 }, (_, k) => k / N);
const W = 600;
const X0 = 58;
const X1 = 542;
const ROW_H = 136;
const AXIS = 66; // axis y within a row
const SCALE = 24; // px per unit of normalised Y (|Y| = 2 at a free end)
const SUB = '₁₂₃₄₅';

const END_RULE: Record<string, string> = {
  clamped: "clamped: $y = 0$, $y' = 0$ (zero slope)",
  pinned: "pinned: $y = 0$, $y'' = 0$ (no moment; the slope is **not** zero)",
  free: "free: $y'' = 0$, $y''' = 0$ (no moment or shear: a straight end, $|Y| = 2$)",
};

export const modeTone = (i: number): Tone => (['m1', 'm2', 'm3', 'm4'] as const)[Math.min(4, Math.max(1, i)) - 1];
const animRate = (i: number) => 0.42 * Math.pow(i, 0.6); // Hz on screen (slow motion; real ratios in the readouts)

export default function ModeShapes() {
  const [bc, setBc] = useState<BeamBC>('clamped-free');
  const [mode, setMode] = useState(2);
  const [compare, setCompare] = useState(false);
  const [handout, setHandout] = useState(false);
  const [playing, setPlaying] = useState(true);
  const reduced = usePrefersReducedMotion();
  const info = beamBCInfo(bc);

  // Precomputed mode shapes (exact and handout constants) for modes 1–5 of this BC.
  const shapes = useMemo(() => [1, 2, 3, 4, 5].map((i) => modeShapeSamples(bc, i, N)), [bc]);
  const shapesHandout = useMemo(
    () =>
      [1, 2, 3, 4, 5].map((i) => {
        const s = new Float64Array(N + 1);
        for (let k = 0; k <= N; k++) s[k] = handoutModeShape(bc, i, k / N);
        return s;
      }),
    [bc]
  );
  const nodeList = useMemo(() => [1, 2, 3, 4, 5].map((i) => nodes(bc, i)), [bc]);
  const useHandout = handout && !compare;
  const rows = compare ? [1, 2, 3] : [mode];
  const H = ROW_H * rows.length + 6;

  const bL = betaL(bc, mode)[mode - 1];
  const sh = (useHandout ? shapesHandout : shapes)[mode - 1];
  const handoutNodes = useMemo(() => {
    const s = shapesHandout[mode - 1];
    const out: number[] = [];
    for (let k = 1; k < N; k++) if (s[k] === 0 || s[k] * s[k + 1] < 0) out.push((k + s[k] / (s[k] - s[k + 1])) / N);
    return out.filter((x) => x > 0.004 && x < 0.996);
  }, [shapesHandout, mode]);
  const nodesNow = useHandout ? handoutNodes : nodeList[mode - 1];
  const rigid = RIGID[bc];
  const farEnd = sh[N];
  const farErr = info.right === 'free' ? Math.abs(farEnd) - 2 : farEnd;

  // Animation: each row's path is rebuilt from its precomputed samples (setAttribute, no React state).
  const wrapRef = useRef<HTMLDivElement>(null);
  const pathRefs = useRef<(SVGPathElement | null)[]>([]);
  const t = useRef(0);
  useRaf(
    (dt) => {
      t.current += dt;
      rows.forEach((i, r) => {
        const s = useHandout ? shapesHandout[i - 1] : shapes[i - 1];
        pathRefs.current[r]?.setAttribute('d', beamPathD(s, X0, X1, r * ROW_H + AXIS, SCALE, Math.cos(2 * Math.PI * animRate(i) * t.current)));
      });
    },
    playing && !reduced,
    wrapRef
  );

  const pick = (b: BeamBC, i: number, cmp = false, ho = false) => {
    setBc(b);
    setMode(i);
    setCompare(cmp);
    setHandout(ho);
  };

  return (
    <div ref={wrapRef}>
      <SimLayout
        visual={
          <>
            <svg viewBox={`0 0 ${W} ${H}`} className="anim" role="img" aria-label={`Animated ${BC_NAME[bc]} beam, ${compare ? 'modes 1 to 3' : `mode ${mode}`}, with nodes marked`}>
              {rows.map((i, r) => {
                const y0 = r * ROW_H + AXIS;
                const s = useHandout ? shapesHandout[i - 1] : shapes[i - 1];
                const ns = useHandout ? handoutNodes : nodeList[i - 1];
                const col = modeColor(i);
                let lastX = -1e9;
                let lane = 0;
                return (
                  <g key={`${bc}-${i}-${r}`}>
                    <text x={X0} y={r * ROW_H + 15} className="plot-note" fill={col} fontWeight={600}>
                      {`mode ${i}`}
                    </text>
                    <text x={X1} y={r * ROW_H + 15} className="plot-note" textAnchor="end">
                      {`ω${SUB[i - 1]}/ω₁ = ${ratioTrick(bc, i).toFixed(2)} · ${ns.length} node${ns.length === 1 ? '' : 's'}`}
                    </text>
                    <line x1={X0} x2={X1} y1={y0} y2={y0} stroke="var(--text-3)" strokeDasharray="4 4" />
                    <path d={envelopeD(s, X0, X1, y0, SCALE)} fill={col} opacity={0.1} />
                    <path
                      ref={(el) => {
                        pathRefs.current[r] = el;
                      }}
                      d={beamPathD(s, X0, X1, y0, SCALE, 1)}
                      fill="none"
                      stroke={col}
                      strokeWidth={3.6}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <EndSymbol x={X0} y={y0} end={info.left} side="left" />
                    <EndSymbol x={X1} y={y0} end={info.right} side="right" />
                    {ns.map((xn) => {
                      const px = X0 + (X1 - X0) * xn;
                      lane = px - lastX < 46 ? 1 - lane : 0;
                      lastX = px;
                      const ly = r * ROW_H + ROW_H - 8 - lane * 12;
                      return (
                        <g key={xn}>
                          <line x1={px} x2={px} y1={y0 + 6} y2={ly - 10} stroke={col} strokeDasharray="2 3" opacity={0.6} />
                          <circle cx={px} cy={y0} r={4.6} fill="var(--surface)" stroke={col} strokeWidth={2.2} />
                          <text x={px} y={ly} textAnchor="middle" className="plot-note" fill={col}>
                            {posLabel(xn)}
                          </text>
                        </g>
                      );
                    })}
                  </g>
                );
              })}
            </svg>
            <Plot x={{ min: 0, max: 1, label: 'position x/L' }} y={{ min: -2.4, max: 2.4, label: 'Yᵢ (∫Y² dx = L)' }} height={210} ariaLabel="Normalised mode shapes against position">
              <HLine y={0} dash={false} color="var(--border)" />
              {[1, 2, 3, 4, 5].map((i) => {
                const on = compare ? i <= 3 : i === mode;
                if (!on && i > 3) return null;
                return <Line key={i} points={{ x: XS, y: shapes[i - 1] }} color={on ? modeColor(i) : 'var(--text-3)'} width={on ? 2.6 : 1} opacity={on ? 1 : 0.45} />;
              })}
              {useHandout && <Line points={{ x: XS, y: shapesHandout[mode - 1] }} color="var(--text)" dash="5 4" width={1.6} />}
              {!compare && nodesNow.map((xn) => <Dot key={xn} x={xn} y={0} color={modeColor(mode)} hollow />)}
              {!compare && info.right === 'free' && <Dot x={1} y={farEnd} color={modeColor(mode)} label={`Y(L) = ${farEnd.toFixed(3).replace("-", "−")}`} labelPos="left" />}
              {!compare && info.left === 'free' && <Dot x={0} y={sh[0]} color={modeColor(mode)} label={`Y(0) = ${sh[0].toFixed(3).replace("-", "−")}`} labelPos="right" />}
            </Plot>
            <Legend
              items={[
                ...(compare ? [1, 2, 3] : [mode]).map((i) => ({ label: `mode ${i}, exact constants`, color: modeColor(i) })),
                ...(useHandout ? [{ label: 'handout’s rounded constants', color: 'var(--text)', dash: true }] : []),
                ...(!compare ? [{ label: 'other modes', color: 'var(--text-3)' }] : []),
              ]}
            />
          </>
        }
        controls={
          <>
            <div className="stack">
              <div>
                <div className="muted small">Boundary conditions (left end – right end)</div>
                <Segmented size="sm" label="Boundary conditions" value={bc} onChange={(v: BeamBC) => setBc(v)} options={BC_ORDER.map((b) => ({ value: b, label: BC_SHORT[b], title: BC_NAME[b] }))} />
                <div className="small" style={{ marginTop: 4 }}>
                  <strong>{BC_NAME[bc]}</strong>
                  {rigid > 0 && <span className="muted"> · plus {rigid} rigid-body mode{rigid > 1 ? 's' : ''} at ω = 0, not in the table</span>}
                </div>
              </div>
              <div className="row gap-s wrap">
                <span className="muted small">Mode</span>
                <Segmented
                  size="sm"
                  label="Mode number"
                  value={compare ? 0 : mode}
                  onChange={(v: number) => {
                    setMode(v);
                    setCompare(false);
                  }}
                  options={[1, 2, 3, 4, 5].map((i) => ({ value: i, label: String(i) }))}
                />
              </div>
              <Toggle checked={compare} onChange={setCompare} label="Sketch modes 1–3 together" />
              <Toggle checked={handout} onChange={setHandout} label="Use the handout’s rounded constants" />
            </div>
            <Readouts>
              <Readout tex="\beta_i L" tip="root of this BC's frequency equation (dimensionless)" value={bL} sig={5} tone={compare ? undefined : modeTone(mode)} />
              <Readout tex="(\beta_i L)^2" tip="ωᵢ = (βᵢL)² √(EI/(ρA L⁴))" value={bL * bL} sig={5} />
              <Readout tex="\omega_i/\omega_1" tip="(βᵢL/β₁L)²: the ratio trick" value={ratioTrick(bc, mode)} sig={4} />
              <Readout
                tex="C_1"
                tip="mode-shape constant σᵢ in the handout formula (for pinned–pinned, the amplitude √2)"
                value={useHandout ? undefined : sigma(bc, mode)}
                text={useHandout ? String(HANDOUT[bc].C1[mode - 1]) : undefined}
                sig={6}
              />
              <Readout label="nodes" tip="interior zeros of Yᵢ (ends excluded)" value={nodesNow.length} sig={1} />
              {info.right === 'free' ? (
                <Readout tex="Y_i(L)" tip="normalised free-end value: exactly ±2 with exact constants" value={farEnd} sig={4} tone={useHandout && Math.abs(farErr) > 0.003 ? 'bad' : undefined} />
              ) : info.left === 'free' ? (
                <Readout tex="Y_i(0)" tip="normalised free-end value: exactly 2 with exact constants" value={sh[0]} sig={4} />
              ) : (
                <Readout tex="Y_i(L/2)" tip="normalised mid-span value" value={sh[N / 2]} sig={4} />
              )}
            </Readouts>
            <Rich
              className="note"
              text={
                compare
                  ? 'Each higher mode adds one node, and the frequencies spread out as $(\\beta_i L)^2$.'
                  : nodesNow.length
                    ? `Interior nodes of mode ${mode} at $x/L$ = ${nodesNow.map((x) => x.toFixed(4)).join(', ')}.${useHandout ? ` (Exact constants: ${nodeList[mode - 1].map((x) => x.toFixed(4)).join(', ') || 'none'}.)` : ''}`
                    : `Mode ${mode} has no interior node.`
              }
            />
            {useHandout && Math.abs(farErr) > 0.003 && (
              <Callout kind="trap" title="Rounded constants near the far end">
                <Rich
                  text={
                    info.right === 'free'
                      ? `With $C_1$ = ${HANDOUT[bc].C1[mode - 1]} the free-end value is ${farEnd.toFixed(4).replace("-", "−")} instead of ±2. Near $x = L$ the cosh and sinh terms are huge and cancel, so a tiny rounding in $C_1$ is amplified. Say which constants you used.`
                      : `With the rounded constants $Y(L)$ = ${farEnd.toFixed(4).replace("-", "−")} instead of 0, so the far end no longer meets its boundary condition${handoutNodes.length > nodeList[mode - 1].length ? ' and a spurious node appears near the end' : ''}.`
                  }
                />
              </Callout>
            )}
            <Callout kind="note" title="Sketch rules for these ends">
              <Rich text={`- left end ${END_RULE[info.left]}\n- right end ${END_RULE[info.right]}\n- mode $n$ has ${bc === 'free-free' ? '$n + 1$' : bc === 'free-pinned' ? '$n$' : '$n - 1$'} interior nodes`} />
            </Callout>
            <div className="row gap-s wrap">
              <Button size="sm" onClick={() => setPlaying((p) => !p)} disabled={reduced}>
                {playing && !reduced ? 'Pause' : 'Play'}
              </Button>
              {reduced && <span className="muted small">Animation off (reduced motion).</span>}
            </div>
          </>
        }
      />
      <PredictReveal
        id="b3-modes-cf2-node"
        question="A cantilever's second mode has one interior node. Where is it?"
        options={['at mid-span, 0.5L', 'at 2L/3 from the clamp', 'at 0.783L from the clamp', 'at the free end']}
        answer={2}
        explain="$Y_2$ crosses zero at 0.7834L (LB5 prints 0.78). The clamp holds the root straight, so the node sits out towards the free end, not at the middle as for a string's second harmonic. A force or a lumped mass placed there does nothing to mode 2."
        tryIt="choose C–F and mode 2, then read the node marker."
        onApply={() => pick('clamped-free', 2)}
      />
      <PredictReveal
        id="b3-modes-ff1"
        question="How many interior nodes does the first **elastic** mode of a free–free beam have?"
        options={['none', 'one, at mid-span', 'two']}
        answer={2}
        explain="Two, at 0.224L and 0.776L: the ends swing one way and the middle the other, so the beam keeps zero net momentum. These are the racquet sweet spot, the pin-test supports and the 'best seats' in a fuselage. Free–free mode $n$ has $n + 1$ nodes; the two ω = 0 rigid-body modes come first only if a question says to include them."
        tryIt="choose F–F, mode 1."
        onApply={() => pick('free-free', 1)}
      />
      <PredictReveal
        id="b3-modes-handout"
        question="Switch to the handout's rounded constants for cantilever mode 2 ($C_1$ = 1.019). Is the tip value still exactly −2?"
        options={['yes, −2.000', 'no, about −2.03', 'no, it changes sign']}
        answer={1}
        explain="With $C_1$ = 1.019 (exact 1.01847) the tip value is −2.0295 and the node moves to 0.782L. Near $x = L$ the cosh and sinh terms are about 55 each and cancel, so a 0.05 % rounding in $C_1$ is amplified. This is the handout footnote's warning: quote which constants you used (summary notes B4 trap)."
        tryIt="choose C–F, mode 2 and turn on the handout constants."
        onApply={() => pick('clamped-free', 2, false, true)}
      />
      <PredictReveal
        id="b3-modes-pin-slope"
        question="At a pinned end, which quantity is zero besides the deflection?"
        options={["the slope $y'$", "the curvature $y''$ (no bending moment)", 'both slope and curvature']}
        answer={1}
        explain="Pinned: $y = 0$ and $y'' = 0$. The beam rotates freely about the pin, so every mode meets the support at a slope. Drawing zero slope at a pin is a classic sketch error; zero slope belongs to a clamp ($y = y' = 0$)."
        tryIt="choose P–P, sketch modes 1–3, and look at how each curve meets the triangles."
        onApply={() => pick('pinned-pinned', 1, true)}
      />
    </div>
  );
}
