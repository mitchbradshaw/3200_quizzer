// Holzer's method on a disc–shaft chain: march at a trial ω, plot the residual against ω, read the roots
// and the mode shapes (LB8 Eqs 8.4–8.6). Disc 1 is the free starting end; the far end is free or fixed.
import { useMemo, useRef, useState } from 'react';
import { useRaf } from '../../../anim/hooks';
import { springPath } from '../../../ui/diagrams';
import { Dot, Handle, HLine, Line, Plot, Stems, VLine } from '../../../plot/Plot';
import { Badge, Button, Callout, Readout, Readouts, Segmented, SimLayout, Slider, Toggle, modeColor } from '../../../ui/kit';
import { PredictReveal } from '../../../ui/PredictReveal';
import { Rich } from '../../../ui/Rich';
import { fmt } from '../../../engine/format';
import { holzerChainModes as chainModes, holzerMarch as march, type HolzerChain as Chain } from '../physics';
import { useMountLater } from './later';

type Far = Chain['far'];

const PRESETS: Record<string, { label: string; chain: Chain; note: string }> = {
  wq10: { label: 'Week 10 Q4 (3 equal discs)', chain: { n: 3, J: [6, 6, 6, 6, 6], k: [3e6, 3e6, 3e6, 3e6, 3e6], far: 'free' }, note: 'Three 6 kg m² discs on two 3 MN m/rad shafts: roots 0, 707, 1225 rad/s.' },
  s7a: { label: 'Sample 7a grinder', chain: { n: 2, J: [20, 10, 10, 10, 10], k: [1.6e7, 1.6e7, 1e7, 1e7, 1e7], far: 'free' }, note: 'Motor and pulley 20 kg m², disc 10 kg m², shaft 1.6×10⁷ N m/rad: 0 and 1549 rad/s (246.6 Hz).' },
  s7b: { label: 'Sample 7b disc stalled', chain: { n: 1, J: [20, 10, 10, 10, 10], k: [1.6e7, 1.6e7, 1e7, 1e7, 1e7], far: 'fixed' }, note: 'The disc is held, so the motor end vibrates against a fixed shaft end: √(K/J₁) = 894.4 rad/s (142.4 Hz).' },
  w75: { label: 'W7.5 aircraft (5 discs)', chain: { n: 5, J: [1, 5, 20, 5, 1], k: [1e6, 1e6, 1e6, 1e6, 1e6], far: 'free' }, note: 'Wing tips, engines and fuselage: 0, 402, 508, 1113, 1115 rad/s.' },
};

const SUP: Record<string, string> = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
const pow10 = (e: number) => `10${String(e).replace(/[0-9]/g, (d) => SUP[d])}`;

/** Signed log10 for a residual that spans many decades. */
const slog = (v: number, v0: number) => Math.sign(v) * Math.log10(1 + Math.abs(v) / v0);

const DISC_Y = 62;

export default function HolzerLab() {
  const [chain, setChain] = useState<Chain>(PRESETS.wq10.chain);
  const [noteKey, setNoteKey] = useState('wq10');
  const [log, setLog] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const later = useMountLater();
  const modes = useMemo(() => chainModes(chain), [chain]);
  const wMax = Math.max(10, 1.18 * modes.top);
  const roots = modes.roots;
  const [w, setW] = useState(707);
  const wTrial = Math.min(w, wMax);
  const m = march(chain, wTrial);
  const v0 = chain.far === 'free' ? 1 : 1e-3;

  const curve = useMemo(() => {
    const N = 600;
    const xs = new Float64Array(N + 1);
    const ys = new Float64Array(N + 1);
    for (let i = 0; i <= N; i++) {
      xs[i] = (wMax * i) / N;
      ys[i] = march(chain, xs[i]).residual;
    }
    return { x: xs, y: ys };
  }, [chain, wMax]);
  const linRange = useMemo(() => {
    const a = Array.from(curve.y, Math.abs)
      .filter((v) => Number.isFinite(v))
      .sort((p, q) => p - q);
    return Math.max(1e-9, a[Math.floor(0.8 * (a.length - 1))] * 1.3);
  }, [curve]);
  const shown = useMemo(() => {
    const ys = new Float64Array(curve.y.length);
    for (let i = 0; i < ys.length; i++) ys[i] = log ? slog(curve.y[i], v0) : curve.y[i];
    return { x: curve.x, y: ys };
  }, [curve, log, v0]);
  // Log-axis range and ticks only exist in log mode: in linear mode shown.y holds raw torques (up to ~10⁸ N m),
  // and stepping ticks through that range used to build a ~50-million-entry array on every load.
  const yMaxLog = useMemo(() => {
    if (!log) return 2;
    let big = 2;
    for (let i = 0; i < shown.y.length; i++) if (Number.isFinite(shown.y[i])) big = Math.max(big, Math.abs(shown.y[i]));
    return big * 1.05;
  }, [shown, log]);
  const yLim = log ? yMaxLog : linRange;
  const logTicks = useMemo(() => {
    if (!log) return [];
    const step = yMaxLog > 12 ? 4 : 2;
    const out: number[] = [];
    for (let v = -Math.floor(yMaxLog / step) * step; v <= yMaxLog; v += step) out.push(v);
    return out;
  }, [yMaxLog, log]);
  const yOf = (v: number) => (log ? slog(v, v0) : Math.max(-yLim, Math.min(yLim, v)));

  // Which root (if any) is the trial omega sitting on?
  const scale = chain.far === 'free' ? Math.max(1, chain.J.slice(0, chain.n).reduce((s, x) => s + x, 0) * wTrial * wTrial) : 1;
  const atRoot = roots.findIndex((r) => Math.abs(r - wTrial) <= Math.max(0.002 * wMax, 1e-9));
  const elasticIdx = (ri: number) => (chain.far === 'free' ? ri : ri + 1); // free chains: root 0 is the rigid-body mode
  const colorOf = (ri: number) => (chain.far === 'free' && ri === 0 ? 'var(--text-3)' : modeColor(elasticIdx(ri)));
  const tone = atRoot >= 0 ? colorOf(atRoot) : 'var(--pred)';

  // Animation of the disc twists (end view): radius lines rotate by theta_i * A sin(2 pi 0.8 t).
  const wrapRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(SVGLineElement | null)[]>([]);
  const big = Math.max(...m.theta.map(Math.abs), 1e-9);
  const amp = m.theta.map((t) => (0.75 * t) / big);
  const xs = Array.from({ length: chain.n }, (_, i) => 40 + (i * 300) / Math.max(1, chain.n - (chain.far === 'fixed' ? 0 : 1)));
  const radii = chain.J.slice(0, chain.n).map((J) => 10 + 6 * Math.log10(1 + J));
  useRaf(
    (_dt, t) => {
      const s = Math.sin(2 * Math.PI * 0.8 * t);
      for (let i = 0; i < chain.n; i++) {
        const el = lineRefs.current[i];
        if (!el) continue;
        const a = -Math.PI / 2 + amp[i] * s;
        el.setAttribute('x2', (xs[i] + radii[i] * Math.cos(a)).toFixed(1));
        el.setAttribute('y2', (DISC_Y + radii[i] * Math.sin(a)).toFixed(1));
      }
    },
    true,
    wrapRef
  );

  const load = (key: string) => {
    const p = PRESETS[key];
    setChain(p.chain);
    setNoteKey(key);
    const r = chainModes(p.chain).roots;
    setW(r[p.chain.far === 'free' ? 1 : 0] ?? r[0] ?? 100);
    setLog(p.chain.n >= 4);
  };
  const setN = (n: number) => setChain((c) => ({ ...c, n }));
  const setJ = (i: number, v: number) => setChain((c) => ({ ...c, J: c.J.map((x, j) => (j === i ? v : x)) }));
  const setK = (i: number, v: number) => setChain((c) => ({ ...c, k: c.k.map((x, j) => (j === i ? v : x)) }));
  const nk = chain.far === 'free' ? chain.n - 1 : chain.n;

  return (
    <div ref={wrapRef}>
      <SimLayout
        visual={
          <>
            <svg viewBox="0 0 380 132" className="anim" style={{ maxWidth: 520, margin: '0 auto' }} role="img" aria-label="End view of the discs on the shaft, twisting in the current shape">
              {xs.map((x, i) =>
                i < nk ? (
                  <path
                    key={`s${i}`}
                    d={springPath(x + radii[i] + 2, DISC_Y, i < chain.n - 1 ? xs[i + 1] - radii[i + 1] - 2 : 352, DISC_Y, 5, 6)}
                    fill="none"
                    stroke="var(--text-2)"
                    strokeWidth={1.6}
                  />
                ) : null
              )}
              {chain.far === 'fixed' && (
                <g stroke="var(--text-3)" strokeWidth={1.3}>
                  <line x1={354} y1={DISC_Y - 30} x2={354} y2={DISC_Y + 30} strokeWidth={3} stroke="var(--text-2)" />
                  {[-3, -2, -1, 0, 1, 2, 3].map((j) => (
                    <line key={j} x1={354} y1={DISC_Y + j * 9} x2={362} y2={DISC_Y + j * 9 + 6} />
                  ))}
                </g>
              )}
              {xs.map((x, i) => (
                <g key={`d${i}`}>
                  <circle cx={x} cy={DISC_Y} r={radii[i]} fill="var(--surface-2)" stroke="var(--text-2)" strokeWidth={1.6} />
                  <line ref={(el) => (lineRefs.current[i] = el)} x1={x} y1={DISC_Y} x2={x} y2={DISC_Y - radii[i]} stroke={tone} strokeWidth={3} strokeLinecap="round" />
                  <text x={x} y={DISC_Y + radii[i] + 16} textAnchor="middle" className="plot-note">
                    J{i + 1} = {fmt(chain.J[i], 3)}
                  </text>
                  {i < nk && (
                    <text x={i < chain.n - 1 ? (x + xs[i + 1]) / 2 : (x + 352) / 2} y={DISC_Y - 18} textAnchor="middle" className="plot-note">
                      k{i + 1}
                    </text>
                  )}
                </g>
              ))}
              <text x={6} y={14} className="plot-note">
                start here: θ₁ = 1
              </text>
              <text x={190} y={128} textAnchor="middle" className="plot-note">
                J in kg m² · k in N m/rad (values in the controls)
              </text>
              <text x={374} y={14} textAnchor="end" className="plot-note">
                {chain.far === 'free' ? 'free end: need Tₙ = 0' : 'wall: need θ = 0'}
              </text>
            </svg>
            <Plot
              x={{ min: 0, max: wMax, label: 'trial ω (rad/s)' }}
              y={
                log
                  ? { min: -yLim, max: yLim, label: chain.far === 'free' ? 'Tₙ (signed log, N m)' : 'θ_wall (signed log)', ticks: logTicks, format: (v) => (v === 0 ? '0' : `${v < 0 ? '−' : ''}${pow10(Math.abs(v))}`) }
                  : { min: -yLim, max: yLim, label: chain.far === 'free' ? 'residual torque Tₙ (N m)' : 'twist at the wall θ_wall' }
              }
              height={250}
              ariaLabel="Holzer residual against trial frequency, roots marked"
            >
              <HLine y={0} dash={false} color="var(--text-2)" />
              <Line points={shown} color="var(--pred)" width={2.2} />
              {roots.map((r, i) => (
                <Dot key={i} x={r} y={0} r={5} color={colorOf(i)} label={r > 1e-9 ? fmt(r, 4) : undefined} labelPos="above" />
              ))}
              <VLine x={wTrial} color="var(--accent)" dash={false} width={1} />
              <Handle x={wTrial} y={yOf(m.residual)} axis="x" clampX={[0, wMax]} onChange={(x) => setW(x)} label={atRoot >= 0 ? undefined : 'trial ω'} ariaLabel="trial frequency" />
            </Plot>
            <Plot
              x={{ min: 0.5, max: chain.n + (chain.far === 'fixed' ? 1.5 : 0.5), ticks: Array.from({ length: chain.n + (chain.far === 'fixed' ? 1 : 0) }, (_, i) => i + 1), format: (v) => (v > chain.n ? 'wall' : `θ${v}`) }}
              y={{ min: -1.15, max: 1.15, label: 'θᵢ / max|θ|' }}
              height={150}
              ariaLabel="Disc angles from the march at the trial frequency"
            >
              <HLine y={0} dash={false} />
              <Stems xs={[...m.theta.map((_, i) => i + 1), ...(chain.far === 'fixed' ? [chain.n + 1] : [])]} ys={[...amp.map((a) => a / 0.75), ...(chain.far === 'fixed' ? [m.thWall / big] : [])]} color={tone} width={3} />
            </Plot>
            <div style={{ overflowX: 'auto' }}>
              <table className="table small" aria-label="Holzer march table at the trial frequency">
                <thead>
                  <tr>
                    <th>station</th>
                    <th>θᵢ (rad)</th>
                    <th>Jᵢω²θᵢ (N m)</th>
                    <th>Tᵢ = Tᵢ₋₁ + Jᵢω²θᵢ (N m)</th>
                    <th>next: θᵢ₊₁ = θᵢ − Tᵢ/kᵢ</th>
                  </tr>
                </thead>
                <tbody>
                  {m.theta.map((th, i) => (
                    <tr key={i}>
                      <td>disc {i + 1}</td>
                      <td className="mono">{fmt(th, 4)}</td>
                      <td className="mono">{fmt(m.inertia[i], 4)}</td>
                      <td className="mono">{fmt(m.T[i], 4)}</td>
                      <td className="mono muted">{i < chain.n - 1 ? `θ${i + 2} = ${fmt(m.theta[i + 1], 4)}` : chain.far === 'fixed' ? `θ_wall = ${fmt(m.thWall, 4)}` : `residual T${chain.n} = ${fmt(m.T[i], 4)}`}</td>
                    </tr>
                  ))}
                  {chain.far === 'fixed' && (
                    <tr>
                      <td>wall</td>
                      <td className="mono">{fmt(m.thWall, 4)}</td>
                      <td colSpan={3} className="muted">
                        θ_wall = θₙ − Tₙ/kₙ must be 0 at a natural frequency
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="muted small" style={{ margin: 0 }}>
              <Rich inline text="March: $T_i = T_{i-1} + J_i\omega^2\theta_i$, then $\theta_{i+1} = \theta_i - T_i/k_i$ (LB8 Eqs 8.4–8.5). The torque column accumulates: it is everything carried through the shaft past disc $i$." />
            </p>
          </>
        }
        controls={
          <>
            <div className="row gap-s wrap">
              {Object.entries(PRESETS).map(([key, p]) => (
                <Button key={key} size="sm" variant={noteKey === key ? 'primary' : 'default'} onClick={() => load(key)}>
                  {p.label}
                </Button>
              ))}
            </div>
            <p className="note">{PRESETS[noteKey]?.note}</p>
            <span className="small muted">Number of discs</span>
            <Segmented
              label="Number of discs"
              value={chain.n}
              onChange={(n: number) => {
                setN(n);
                setNoteKey('');
              }}
              options={(chain.far === 'free' ? [2, 3, 4, 5] : [1, 2, 3, 4, 5]).map((n) => ({ value: n, label: `${n}` }))}
            />
            <Segmented
              label="Far end"
              value={chain.far}
              onChange={(f: Far) => {
                setChain((c) => ({ ...c, far: f, n: f === 'free' ? Math.max(2, c.n) : c.n }));
                setNoteKey('');
              }}
              options={[
                { value: 'free', label: 'Far end free' },
                { value: 'fixed', label: 'Far end fixed' },
              ]}
            />
            <Slider label="trial frequency" tex="\omega" tip="the frequency you guess; Holzer marches the disc angles at this ω" value={wTrial} min={0} max={wMax} step={wMax / 2000} unit="rad/s" sig={4} onChange={setW} />
            <div className="row gap-s wrap">
              <span className="muted small">Jump to a root:</span>
              {roots.map((r, i) => (
                <Button key={i} size="sm" onClick={() => setW(r)}>
                  {chain.far === 'free' && i === 0 ? 'ω = 0 (rigid)' : `mode ${elasticIdx(i)}`}
                </Button>
              ))}
            </div>
            <Toggle checked={log} onChange={setLog} label="Signed-log residual axis (needed for 4–5 discs)" />
            <Readouts>
              <Readout tex="\omega" tip="trial frequency" value={wTrial} unit="rad/s" sig={4} />
              <Readout tex="f" tip="trial frequency in Hz = ω/2π" value={wTrial / (2 * Math.PI)} unit="Hz" sig={4} />
              <Readout
                tex={chain.far === 'free' ? 'T_n' : '\\theta_{wall}'}
                tip={chain.far === 'free' ? 'residual torque past the last disc (zero at a natural frequency)' : 'twist at the fixed end (zero at a natural frequency)'}
                value={m.residual}
                unit={chain.far === 'free' ? 'N m' : 'rad'}
                sig={3}
                tone={atRoot >= 0 ? 'ok' : undefined}
              />
              <Readout label="roots below ω_max" tip="natural frequencies found in the plotted range" value={roots.length} sig={1} />
            </Readouts>
            {atRoot >= 0 ? (
              <Callout kind="ok" title={chain.far === 'free' && atRoot === 0 ? 'Rigid-body root' : `Natural frequency: mode ${elasticIdx(atRoot)}`}>
                <Rich text={`Residual ≈ 0 relative to $\\sum J\\omega^2$ (${fmt(Math.abs(m.residual) / scale, 2)}): no external torque is needed, so the angles shown are this mode’s shape.`} />
              </Callout>
            ) : (
              <Callout kind="info" title="Not a natural frequency">
                <Rich text={chain.far === 'free' ? `An external torque of ${fmt(m.residual, 3)} N m would be needed at the free end to hold this motion. Move ω until the curve crosses zero.` : `The march ends with ${fmt(m.thWall, 3)} rad of twist where the wall allows none. Move ω until the curve crosses zero.`} />
              </Callout>
            )}
            <details className="more" onToggle={(e) => setEditOpen(e.currentTarget.open)}>
              <summary>Edit the chain (J and k)</summary>
              {/* The sliders exist only while the panel is open: nothing to build or lay out on load. */}
              <div className="more-body">
                {editOpen &&
                  chain.J.slice(0, chain.n).map((J, i) => (
                    <Slider key={`J${i}`} label={`disc ${i + 1} inertia`} tex={`J_${i + 1}`} tip="polar moment of inertia of the disc (kg m²)" value={J} min={0.5} max={100} log unit="kg m²" sig={3} onChange={(v) => setJ(i, v)} />
                  ))}
                {editOpen &&
                  Array.from({ length: nk }, (_, i) => (
                    <Slider key={`k${i}`} label={i < chain.n - 1 ? `shaft ${i + 1}–${i + 2}` : `shaft ${i + 1}–wall`} tex={`k_${i + 1}`} tip="torsional stiffness GJ/L of the shaft segment (N m/rad)" value={chain.k[i]} min={1e5} max={1e8} log unit="N m/rad" sig={3} onChange={(v) => setK(i, v)} />
                  ))}
              </div>
            </details>
            <Badge tone="muted">{chain.far === 'free' ? `${chain.n} discs, free–free: expect ${chain.n} roots including ω = 0` : `${chain.n} disc(s), one end fixed: expect ${chain.n} roots, none at ω = 0`}</Badge>
          </>
        }
      />
      {later && <HolzerPredictions load={load} setChain={setChain} setNoteKey={setNoteKey} setW={setW} />}
    </div>
  );
}

/** The predict-then-reveal blocks (below the fold: mounted one task after the lab). */
function HolzerPredictions({ load, setChain, setNoteKey, setW }: { load: (key: string) => void; setChain: (c: Chain) => void; setNoteKey: (k: string) => void; setW: (w: number) => void }) {
  return (
    <>
      <PredictReveal
        id="b5-holzer-count"
        question="The W7.5 aircraft model has 5 discs and is free at both ends. How many zeros does the residual $T_5(\omega)$ have, **counting** $\omega = 0$?"
        options={['4', '5', '6', 'Infinitely many']}
        answer={1}
        explain="An $n$-disc lumped chain has $n$ modes. Free–free, one of them is the rigid-body rotation at $\omega = 0$, so 5 roots: 0, 402, 508, 1113 and 1115 rad/s. That is the 2024 B1.7 answer “Holzer 5 (including rigid-body modes)”."
        tryIt="load the W7.5 preset and count the dots on the zero line."
        onApply={() => load('w75')}
      />
      <PredictReveal
        id="b5-holzer-fixed"
        question="Three equal discs, then you fix the far end to a wall through a third shaft. Does the $\omega = 0$ root survive?"
        options={['Yes: Holzer always finds ω = 0', 'No: the wall removes the rigid-body mode']}
        answer={1}
        explain="With a fixed end the chain cannot rotate as a rigid body, so no root at $\omega = 0$. The residual is now the twist left over at the wall, $\theta_{wall} = \theta_n - T_n/k_n$, and Holzer still finds every mode (Sample Problem 7b; Week 10 Q4 option D is false)."
        tryIt="load Week 10 Q4, then switch 'Far end fixed'."
        onApply={() => {
          setChain({ ...PRESETS.wq10.chain, far: 'fixed' });
          setNoteKey('');
          setW(300);
        }}
      />
      <PredictReveal
        id="b5-holzer-pair"
        question="In the aircraft model, why are the modes at 1113 and 1115 rad/s so close together?"
        options={['A numerical artefact of the march', 'Each wing (tip and engine discs) vibrates almost on its own while the heavy fuselage barely moves, so the in-phase and out-of-phase versions nearly coincide', 'Holzer cannot separate modes closer than 1 %']}
        answer={1}
        explain="In both modes the 1 kg m² tip and the 5 kg m² engine twist against each other on their shaft (engine angle about −0.24 of the tip) while the 20 kg m² fuselage hardly moves. One wing on its own is close to a two-disc oscillator, $\omega \approx \sqrt{k(1/J_1 + 1/J_2)} = \sqrt{10^6 \times 1.2} = 1095$ rad/s; the second shaft to the fuselage stiffens it to about 1113. The two wings do this out of phase (antisymmetric, 1113 rad/s) or in phase (symmetric, 1115 rad/s), and the nearly still fuselage barely couples them. A coarse ω step would miss one of the pair: sweep finely and check the mode shapes."
        tryIt="load W7.5, jump to modes 3 and 4 and compare the disc angles."
        onApply={() => {
          load('w75');
          setW(1112.89);
        }}
      />
      <PredictReveal
        id="b5-holzer-stiff"
        question="Double every shaft stiffness of the 3-disc chain. The natural frequencies…"
        options={['double', 'rise by √2', 'stay the same', 'halve']}
        answer={1}
        explain="Scaling every $k$ by 2 scales $K$ by 2 with $M$ unchanged, so every $\omega^2$ doubles and $\omega$ rises by $\sqrt2$: 707 → 1000 and 1225 → 1732 rad/s. Mode shapes are unchanged."
        tryIt="open 'Edit the chain' and double k₁ and k₂."
        onApply={() => {
          setChain({ ...PRESETS.wq10.chain, k: PRESETS.wq10.chain.k.map((x) => 2 * x) });
          setNoteKey('');
          setW(1000);
        }}
      />
    </>
  );
}
