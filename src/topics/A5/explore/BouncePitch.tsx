// Bounce–pitch of a body on two springs (car, minibus, pilot cabin): k1 at x = −a (front), k2 at x = +b (rear).
// Modes are animated with their nodes (x = −Z/Θ); the deck/road heave response shows when heave excites pitch.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRaf } from '../../../anim/hooks';
import { springPath } from '../../../ui/diagrams';
import { Handle, Line, Plot, VLine, sample } from '../../../plot/Plot';
import { Badge, Button, Callout, Legend, Readout, Readouts, Segmented, Select, SimLayout, Slider, Toggle } from '../../../ui/kit';
import { PredictReveal } from '../../../ui/PredictReveal';
import { Rich } from '../../../ui/Rich';
import { completeChallenge, useProgress } from '../../../app/store';
import { fmt } from '../../../engine/format';
import { cabs, type C } from '../../../physics/complex';
import { bouncePitchModes, response2 } from '../physics';
import { MatrixView } from './MatrixView';

export const BP_CHALLENGE = 'a5-decouple-unequal';

const VW = 600;
const VH = 250;
const GX = 300;
const GY = 105;
const PPM = 46; // px per metre
const XR = 6.3; // half-width of the view (m)
const HALF_H = 22; // body half-height (px)
const WHEEL_Y = 198;
const A_PX = 15;
const F_VIS = 0.7;
const TAU = 2 * Math.PI;
const MODE_VAR = ['var(--m1)', 'var(--m2)'];

interface BP {
  m: number;
  I: number;
  k1: number;
  k2: number;
  a: number;
  b: number;
}
interface Preset {
  id: string;
  name: string;
  kind: 'car' | 'cabin';
  note: string;
  v: BP;
}
const PRESETS: Preset[] = [
  { id: 'minibus', name: '2021 minibus (illustrative values)', kind: 'car', note: 'Equal front and rear stiffness, G nearer the front (a = 1.3 m, b = 1.7 m): 2021 A1.5 worked-solution values.', v: { m: 3000, I: 5070, k1: 90e3, k2: 90e3, a: 1.3, b: 1.7 } },
  { id: 'car', name: 'Reader LA4 car', kind: 'car', note: 'LA4 §4.2: m = 1000 kg, J = 810 kg m², k₁ = 18 kN/m at 1.0 m ahead, k₂ = 22 kN/m at 1.5 m behind.', v: { m: 1000, I: 810, k1: 18e3, k2: 22e3, a: 1.0, b: 1.5 } },
  { id: 'cabin-equal', name: 'Pilot cabin, identical isolators', kind: 'cabin', note: 'Official 2017–19 A3.8: equal springs placed symmetrically about G (illustrative numbers).', v: { m: 2000, I: 1500, k1: 200e3, k2: 200e3, a: 1.2, b: 1.2 } },
  { id: 'cabin-unequal', name: 'Pilot cabin, unequal isolators', kind: 'cabin', note: '2022 A3.1: same positions, but isolator 2 is 50 % stiffer.', v: { m: 2000, I: 1500, k1: 200e3, k2: 300e3, a: 1.2, b: 1.2 } },
];

export default function BouncePitch() {
  const progress = useProgress();
  const [pid, setPid] = useState('minibus');
  const [v, setV] = useState<BP>(PRESETS[0].v);
  const [mode, setMode] = useState(0);
  const [heave, setHeave] = useState(false);
  const [zeta, setZeta] = useState(0.05);
  const [fF, setFF] = useState(3);
  const preset = PRESETS.find((p) => p.id === pid) || PRESETS[0];
  const cabin = preset.kind === 'cabin';
  const load = (id: string) => {
    const p = PRESETS.find((q) => q.id === id) || PRESETS[0];
    setPid(p.id);
    setV(p.v);
  };
  const set = (patch: Partial<BP>) => setV((o) => ({ ...o, ...patch }));
  const { m, I, k1, k2, a, b } = v;

  const bp = useMemo(() => bouncePitchModes(m, I, k1, a, k2, b), [m, I, k1, a, k2, b]);
  const [w1, w2] = bp.omega;
  const K12 = bp.K[0][1];
  const kc = Math.abs(K12) / Math.sqrt(bp.K[0][0] * bp.K[1][1]); // coupling coefficient
  const coupled = kc > 1e-6;
  // The log stiffness sliders move in 0.46 % steps, so k1a = k2b can only be met to within ~0.1 % of √(K11K22):
  // treat |K12| ≤ 0.3 % of √(K11K22) as decoupled for the challenge (and say so on the badge).
  const nearly = coupled && kc <= 3e-3;
  const rho = Math.sqrt(I / m);
  const eta = (2 * zeta) / w1; // dampers c_i = eta k_i, so mode 1 has damping ratio zeta exactly
  const solved = kc <= 3e-3 && Math.abs(k1 - k2) > 0.05 * Math.max(k1, k2);
  const done = !!progress.challenges[BP_CHALLENGE];

  // ---- heave response (deck or road moving y_b under both springs)
  const resp = (fHz: number): [C, C] => {
    const W = TAU * fHz;
    const Cd = bp.K.map((r) => r.map((x) => eta * x));
    const kin = [bp.K[0][0], K12];
    const F: [C, C] = [
      { re: kin[0], im: W * eta * kin[0] },
      { re: kin[1], im: W * eta * kin[1] },
    ];
    return response2(bp.K, bp.M, Cd, F, W);
  };
  const fLo = Math.max(0.05, (0.25 * w1) / TAU);
  const fHi = (6 * w2) / TAU;
  const curves = useMemo(() => {
    if (!heave) return null;
    const zc = sample((f) => cabs(resp(f)[0]), fLo, fHi, 500, true);
    const tc = sample((f) => {
      const r = resp(f);
      const th = cabs(r[1]) * rho;
      return th < 1e-9 * Math.max(1e-30, cabs(r[0])) ? NaN : th;
    }, fLo, fHi, 500, true);
    return { zc, tc };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heave, bp, eta, rho, fLo, fHi]);
  const fClamp = Math.max(fLo, Math.min(fHi, fF));
  const atF = resp(fClamp);
  const Zr = cabs(atF[0]);
  const Tr = cabs(atF[1]) * rho;

  // ---- animation (refs only)
  const wrapRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<SVGGElement>(null);
  const s1Ref = useRef<SVGPathElement>(null);
  const s2Ref = useRef<SVGPathElement>(null);
  const t = useRef(0);
  const xF = -a * PPM;
  const xR = b * PPM;
  const vis = useMemo(() => {
    if (mode < 0) return null;
    const [Z, T] = bp.shapes[mode];
    const ext = Math.max(a, b) + 0.6;
    const dmax = Math.abs(Z) + Math.abs(T) * ext;
    if (!(dmax > 0)) return null;
    const s = A_PX / (dmax * PPM);
    return { z: s * Z * PPM, th: s * T };
  }, [mode, bp, a, b]);
  const live = useRef({ vis, xF, xR });
  live.current = { vis, xF, xR };
  const drawPose = (amp: number) => {
    const L = live.current;
    const z = L.vis ? L.vis.z * amp : 0;
    const th = L.vis ? L.vis.th * amp : 0;
    bodyRef.current?.setAttribute('transform', `translate(${GX} ${(GY - z).toFixed(2)}) rotate(${((-th * 180) / Math.PI).toFixed(3)})`);
    const att = (u: number) => {
      const vv = -HALF_H;
      return [GX + u * Math.cos(th) - vv * Math.sin(th), GY - (z + u * Math.sin(th) + vv * Math.cos(th))] as const;
    };
    const [x1, y1] = att(L.xF);
    const [x2, y2] = att(L.xR);
    s1Ref.current?.setAttribute('d', springPath(x1, y1, GX + L.xF, WHEEL_Y - 12, 5, 7, 6));
    s2Ref.current?.setAttribute('d', springPath(x2, y2, GX + L.xR, WHEEL_Y - 12, 5, 7, 6));
  };
  const animating = !!vis;
  useRaf(
    (dt) => {
      t.current += dt;
      drawPose(Math.sin(TAU * F_VIS * t.current));
    },
    animating,
    wrapRef
  );
  useEffect(() => {
    if (!animating) drawPose(0);
  });

  const nodeTxt = (x: number) => (Number.isFinite(x) ? `${fmt(Math.abs(x), 3)} m ${x > 0 ? (cabin ? 'towards isolator 2' : 'behind G') : x < 0 ? (cabin ? 'towards isolator 1' : 'ahead of G') : '(at G)'}` : 'none (pure bounce)');
  const n = mode >= 0 ? bp.nodes[mode] : NaN;
  const nodeX = GX + n * PPM;
  const bodyL = (-a - (cabin ? 0.35 : 0.75)) * PPM;
  const bodyR = (b + (cabin ? 0.35 : 0.75)) * PPM;

  return (
    <div ref={wrapRef}>
      <SimLayout
        visual={
          <>
            <svg viewBox={`0 0 ${VW} ${VH}`} className="anim" role="img" aria-label={`${cabin ? 'Cabin' : 'Vehicle body'} on two springs, animating mode ${mode + 1} with its node marked.`}>
              <line x1={GX - XR * PPM} x2={GX + XR * PPM} y1={GY} y2={GY} stroke="var(--text-3)" strokeDasharray="5 5" />
              <text x={8} y={GY - 6} className="plot-note">
                rest line
              </text>
              {/* road or deck */}
              <line x1={20} x2={VW - 20} y1={WHEEL_Y + 12} y2={WHEEL_Y + 12} stroke="var(--text-3)" strokeWidth={2} />
              {[xF, xR].map((u, i) =>
                cabin ? (
                  <rect key={i} x={GX + u - 14} y={WHEEL_Y - 12} width={28} height={8} fill="var(--surface-3)" stroke="var(--text-2)" />
                ) : (
                  <circle key={i} cx={GX + u} cy={WHEEL_Y} r={12} fill="var(--surface)" stroke="var(--text-2)" strokeWidth={2} />
                )
              )}
              <path ref={s1Ref} d={springPath(GX + xF, GY + HALF_H, GX + xF, WHEEL_Y - 12, 5, 7, 6)} fill="none" stroke="var(--text-2)" strokeWidth={2} />
              <path ref={s2Ref} d={springPath(GX + xR, GY + HALF_H, GX + xR, WHEEL_Y - 12, 5, 7, 6)} fill="none" stroke="var(--text-2)" strokeWidth={2} />
              <text x={GX + xF + 10} y={WHEEL_Y - 30} className="plot-note">
                k₁
              </text>
              <text x={GX + xR + 10} y={WHEEL_Y - 30} className="plot-note">
                k₂
              </text>
              <text x={GX + xF} y={VH - 6} textAnchor="middle" className="plot-note">
                {cabin ? 'isolator 1' : 'front'}
              </text>
              <text x={GX + xR} y={VH - 6} textAnchor="middle" className="plot-note">
                {cabin ? 'isolator 2' : 'rear'}
              </text>
              <g ref={bodyRef} transform={`translate(${GX} ${GY})`}>
                <rect x={bodyL} y={-HALF_H} width={bodyR - bodyL} height={2 * HALF_H} rx={cabin ? 4 : 14} fill="var(--surface-2)" stroke="var(--text-2)" strokeWidth={1.8} />
                <line x1={-XR * PPM} x2={XR * PPM} y1={0} y2={0} stroke={mode >= 0 ? MODE_VAR[mode] : 'var(--text-2)'} strokeWidth={2} />
                <circle r={6} fill="var(--surface)" stroke="var(--text)" strokeWidth={1.6} />
                <text x={8} y={-8} className="diagram-label">
                  G
                </text>
              </g>
              {mode >= 0 &&
                (Number.isFinite(n) ? (
                  Math.abs(n) <= XR - 0.2 ? (
                    <g pointerEvents="none">
                      <circle cx={nodeX} cy={GY} r={6} fill="none" stroke={MODE_VAR[mode]} strokeWidth={2.4} />
                      <line x1={nodeX} x2={nodeX} y1={GY - 34} y2={GY + 34} stroke={MODE_VAR[mode]} strokeDasharray="3 3" />
                      <text x={nodeX + (n > XR - 1.8 ? -8 : 8)} y={GY - 38} textAnchor={n > XR - 1.8 ? 'end' : 'start'} className="plot-note" fill={MODE_VAR[mode]}>
                        node x = {fmt(n, 3)} m
                      </text>
                    </g>
                  ) : (
                    <text x={n > 0 ? VW - 8 : 8} y={GY - 38} textAnchor={n > 0 ? 'end' : 'start'} className="plot-note" fill={MODE_VAR[mode]}>
                      node at x = {fmt(n, 3)} m {n > 0 ? '→' : '←'} (off-screen)
                    </text>
                  )
                ) : (
                  <text x={8} y={22} className="plot-note" fill={MODE_VAR[mode]}>
                    Mode {mode + 1}: pure bounce, no node
                  </text>
                ))}
              <text x={VW - 8} y={22} textAnchor="end" className="plot-note">
                x measured rearwards (→) from G
              </text>
            </svg>
            <div className="row gap-s wrap">
              <span className="muted small">Animate:</span>
              <Segmented
                size="sm"
                label="Mode to animate"
                value={mode}
                onChange={setMode}
                options={[
                  { value: 0, label: <span style={{ color: 'var(--m1)', fontWeight: 650 }}>Mode 1</span> },
                  { value: 1, label: <span style={{ color: 'var(--m2)', fontWeight: 650 }}>Mode 2</span> },
                  { value: -1, label: 'Still' },
                ]}
              />
              <Toggle checked={heave} onChange={setHeave} label={cabin ? 'deck heave response' : 'road heave response'} />
            </div>
            <p className="muted small">The coloured line is the body’s centre line in the animated mode; it crosses the dashed rest line at the node, the one point of the body line that does not move. Slowed to {F_VIS} Hz.</p>
            {heave && curves && (
              <>
                <Plot x={{ min: fLo, max: fHi, log: true, label: 'heave frequency (Hz)' }} y={{ min: 1e-3, max: 100, log: true, label: 'response / heave' }} height={240} ariaLabel="Bounce and pitch response to heave against frequency">
                  <VLine x={w1 / TAU} color="var(--m1)" label="f₁" />
                  <VLine x={w2 / TAU} color="var(--m2)" label="f₂" />
                  <Line points={curves.zc} color="var(--text)" width={2.4} />
                  <Line points={curves.tc} color="var(--text-2)" width={2} dash />
                  <Handle x={fClamp} y={Math.max(1.1e-3, Math.min(90, Zr))} axis="x" clampX={[fLo, fHi]} onChange={(x) => setFF(x)} ariaLabel="heave frequency (drag)" />
                </Plot>
                <Legend
                  items={[
                    { label: 'bounce |Z/y_b|', color: 'var(--text)' },
                    { label: 'pitch |ρΘ/y_b| (ρ = radius of gyration)', color: 'var(--text-2)', dash: true },
                  ]}
                />
                {!coupled && <Badge tone="ok">K₁₂ = 0: heave pushes only on bounce, so the pitch curve is zero (not drawn)</Badge>}
              </>
            )}
          </>
        }
        controls={
          <>
            <Select label="Preset" value={pid} onChange={load} options={PRESETS.map((p) => ({ value: p.id, label: p.name }))} />
            <Rich className="note" text={preset.note} />
            <Slider label={cabin ? 'isolator 1 stiffness' : 'front stiffness'} tex="k_1" tip="spring at x = −a (N/m, total for that end)" value={k1 / 1e3} min={5} max={500} log unit="kN/m" onChange={(x) => set({ k1: x * 1e3 })} />
            <Slider label={cabin ? 'isolator 2 stiffness' : 'rear stiffness'} tex="k_2" tip="spring at x = +b (N/m)" value={k2 / 1e3} min={5} max={500} log unit="kN/m" onChange={(x) => set({ k2: x * 1e3 })} />
            <Slider label={cabin ? 'G to isolator 1' : 'G to front axle'} tex="a" tip="distance from G to spring 1 (m)" value={a} min={0.3} max={3} step={0.05} unit="m" onChange={(x) => set({ a: x })} />
            <Slider label={cabin ? 'G to isolator 2' : 'G to rear axle'} tex="b" tip="distance from G to spring 2 (m)" value={b} min={0.3} max={3} step={0.05} unit="m" onChange={(x) => set({ b: x })} />
            <details className="more">
              <summary>Mass and inertia</summary>
              <div className="more-body">
                <Slider label="mass" tex="m" tip="body mass (kg)" value={m} min={300} max={8000} log unit="kg" onChange={(x) => set({ m: x })} />
                <Slider label="pitch inertia" tex="I" tip="moment of inertia about G (kg m²); ρ = √(I/m)" value={I} min={100} max={20000} log unit="kg m²" onChange={(x) => set({ I: x })} />
              </div>
            </details>
            {heave && <Slider label="damping (mode 1)" tex="\zeta" tip="isolator dampers c = ηk, chosen so mode 1 has this damping ratio" value={zeta} min={0.01} max={0.5} step={0.01} onChange={setZeta} />}
            <Readouts>
              <Readout tex="f_1" tip={`lower natural frequency (ω₁ = ${fmt(w1, 4)} rad/s)`} value={w1 / TAU} unit="Hz" tone="m1" />
              <Readout tex="f_2" tip={`higher natural frequency (ω₂ = ${fmt(w2, 4)} rad/s)`} value={w2 / TAU} unit="Hz" tone="m2" />
              <Readout tex="x_{n1}" tip="node of mode 1, x = −Z/Θ (rearwards positive)" value={bp.nodes[0]} unit="m" text={Number.isFinite(bp.nodes[0]) ? undefined : '∞'} />
              <Readout tex="x_{n2}" tip="node of mode 2" value={bp.nodes[1]} unit="m" text={Number.isFinite(bp.nodes[1]) ? undefined : '∞'} />
              <Readout tex="K_{12}" tip="k₂b − k₁a: net moment about G per metre of bounce" value={K12 / 1e3} unit="kN/rad" tone={coupled && !nearly ? 'warn' : 'ok'} />
              <Readout tex="-I/m" tip="should equal x_n1 · x_n2 (nodes on opposite sides of G)" value={-I / m} unit="m²" />
              {heave && <Readout tex="|Z/y_b|" tip="bounce transmissibility at the handle frequency" value={Zr} sig={3} />}
              {heave && <Readout tex="|\rho\Theta/y_b|" tip="pitch response (scaled by ρ) at the handle frequency" value={Tr} sig={3} />}
            </Readouts>
            <Badge tone={coupled && !nearly ? 'warn' : 'ok'}>
              {!coupled
                ? '✓ decoupled: k₁a = k₂b (pure bounce + pure pitch)'
                : nearly
                  ? `✓ decoupled to slider precision: k₁a = ${fmt((k1 * a) / 1e3, 4)} ≈ k₂b = ${fmt((k2 * b) / 1e3, 4)} kN`
                  : `coupled: k₁a = ${fmt((k1 * a) / 1e3, 4)} ≠ k₂b = ${fmt((k2 * b) / 1e3, 4)} kN`}
            </Badge>
          </>
        }
        below={
          <div className="stack">
            <div className="row gap-s wrap" style={{ alignItems: 'flex-start' }}>
              <MatrixView A={bp.K} labels={['z', '\\theta']} name="K" scale={1e3} unit="kN/m, kN/rad, kN m/rad" />
              <MatrixView A={bp.M} labels={['z', '\\theta']} name="M" unit="kg, kg m²" />
            </div>
            <Rich
              className="note"
              text={
                coupled
                  ? `Both modes mix bounce and pitch. Mode 1 turns about a node ${nodeTxt(bp.nodes[0])}, mode 2 about a node ${nodeTxt(bp.nodes[1])}; their product is ${fmt(bp.nodes[0] * bp.nodes[1], 4)} m² $= -I/m$. Uncoupled checks: $\\sqrt{K_{11}/m}$ = ${fmt(Math.sqrt(bp.K[0][0] / m) / TAU, 3)} Hz and $\\sqrt{K_{22}/I}$ = ${fmt(Math.sqrt(bp.K[1][1] / I) / TAU, 3)} Hz lie between $f_1$ and $f_2$.`
                  : `$k_1a = k_2b$, so $K_{12} = 0$: one pure bounce mode at $\\sqrt{(k_1+k_2)/m}$ = ${fmt(Math.sqrt(bp.K[0][0] / m) / TAU, 3)} Hz (no node) and one pure pitch mode at $\\sqrt{(k_1a^2+k_2b^2)/I}$ = ${fmt(Math.sqrt(bp.K[1][1] / I) / TAU, 3)} Hz about G.`
              }
            />
            <Callout kind="info" title={`Challenge: ${done ? 'complete ✓' : 'decouple with unequal springs'}`}>
              <Rich text="Make bounce and pitch independent **without** making the two springs equal (they must differ by more than 5 %). Start from the LA4 car if you like: which rear stiffness, or which axle position, does it?" />
              <div className="row gap-s wrap" style={{ marginTop: 6 }}>
                <Button size="sm" onClick={() => load('car')}>
                  Load the LA4 car
                </Button>
                <Button size="sm" variant="primary" disabled={!solved || done} onClick={() => completeChallenge(BP_CHALLENGE)}>
                  {done ? '✓ Challenge complete' : solved ? 'Submit this design' : 'Not decoupled yet'}
                </Button>
              </div>
            </Callout>
          </div>
        }
      />
      <PredictReveal
        id="a5-bp-equal"
        question="Pilot cabin on **identical** isolators at equal distances from G. Does heave of the deck excite the pitch mode?"
        options={['Yes: both modes respond', 'No: heave excites only bounce']}
        answer={1}
        explain="The heave input to the pitch equation is $(k_2l_2 - k_1l_1)\,y_b = 0$, and $K$ is diagonal, so pitch is never driven (official 2017–19 A3.8 (b): one bouncing and one pitching mode)."
        tryIt="load the identical-isolator cabin and switch on the deck heave response."
        onApply={() => {
          load('cabin-equal');
          setHeave(true);
        }}
      />
      <PredictReveal
        id="a5-bp-unequal"
        question="Now make one isolator 50 % stiffer, keeping the positions symmetric. Does deck heave excite pitch now?"
        options={['No: the positions are still symmetric', 'Yes: a pitch response appears, with two resonance peaks']}
        answer={1}
        explain="$K_{12} = (k_2 - k_1)l \ne 0$ couples bounce and pitch, and the same term carries the heave into the pitch equation. Both modes now mix bounce and pitch (2022 A3.1, answer (d))."
        tryIt="load the unequal-isolator cabin with the heave response on."
        onApply={() => {
          load('cabin-unequal');
          setHeave(true);
        }}
      />
      <PredictReveal
        id="a5-bp-node"
        question="2021 minibus (equal springs, G 1.3 m behind the front axle and 1.7 m ahead of the rear). Where is the node of the lower, bounce-dominated mode?"
        options={['At G', 'Between the axles, near G', 'Behind the rear axle', 'Ahead of the front axle']}
        answer={2}
        explain="$x_{n1} = -Z/\Theta$ = +3.48 m, beyond the rear axle at 1.7 m: the body mostly heaves, rotating about a distant point. Mode 2’s node is 0.48 m ahead of G, and $x_{n1}x_{n2} = -I/m$ = −1.69 m² (2021 A1.5 worked solution)."
        tryIt="load the minibus and animate mode 1."
        onApply={() => {
          load('minibus');
          setMode(0);
        }}
      />
      <PredictReveal
        id="a5-bp-damping"
        question="Identical-isolator cabin, heave at 5 × the bounce frequency. Raise the damping ratio from 0.05 to 0.3. The bounce transmissibility $|Z/y_b|$…"
        options={['falls', 'rises', 'stays the same']}
        answer={1}
        explain="Above $\sqrt2$ the dampers pass force to the cabin: $T \to 2\zeta/r$. At $r = 5$, T rises from 0.047 to 0.131. Isolators want low damping, just enough for resonance (2025 A3.5; official 2018 A3.7)."
        tryIt="turn on the heave response, drag the handle to 5 × f₁ and raise ζ."
        onApply={() => {
          load('cabin-equal');
          setHeave(true);
          const fb = Math.sqrt((2 * 200e3) / 2000) / TAU;
          setFF(5 * fb);
          setZeta(0.3);
        }}
      />
    </div>
  );
}
