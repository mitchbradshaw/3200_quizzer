// Complex mode shapes as rotating phasors. A chain support–(k1, c1)–m1–(k2, c2)–m2 (the 2024 A1.1 layout).
// Each mass moves as the horizontal projection of its own arrow X_j e^{iωd t}; the arrows turn together, so the angle
// between them is the phase of X2/X1: 0°/180° for proportional damping (real modes), anything else for general damping.
// Positions are analytic; the loop only writes SVG attributes through refs.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRaf } from '../../../anim/hooks';
import { damperPaths, springPath } from '../../../ui/diagrams';
import { Badge, Button, Legend, More, Readout, Readouts, Segmented, SimLayout, Slider, Toggle } from '../../../ui/kit';
import { PredictReveal } from '../../../ui/PredictReveal';
import { Rich } from '../../../ui/Rich';
import { fmt, tex } from '../../../engine/format';
import type { C } from '../../../physics/complex';
import { cabs, cdiv } from '../../../physics/complex';
import { dampedModesSorted, modeRatio } from '../../../physics/damped';
import { MatlabBlock } from '../MatlabBlock';
import { matlabEig, matlabText } from '../physics';

const VB_W = 520;
const VB_H = 318;
const CY = 88; // phasor circle centres (y)
const RPH = 56; // px for a unit phasor (= mass displacement scale)
const REST: [number, number] = [170, 372];
const MASS = 52;
const MASS_Y = 254; // mass centre (y)
const SPRING_Y = 243;
const DAMPER_Y = 268;
const WALL_X = 34;
const SCREEN_HZ = 0.5;

type Sys = { m1: number; m2: number; k1: number; k2: number; c1: number; c2: number };
type DampKind = 'free' | 'prop';
type Preset = { label: string; sys: Sys; kind: DampKind; beta?: number };

const PRESETS: Record<'single' | 'prop' | 'between' | 'y2024', Preset> = {
  single: { label: 'Damper on m₁ only', sys: { m1: 2, m2: 1, k1: 2000, k2: 1000, c1: 20, c2: 0 }, kind: 'free' },
  prop: { label: 'C ∝ K (same c/k)', sys: { m1: 2, m2: 1, k1: 2000, k2: 1000, c1: 4, c2: 2 }, kind: 'prop', beta: 0.002 },
  between: { label: 'Damper between the masses', sys: { m1: 2, m2: 1, k1: 2000, k2: 1000, c1: 0, c2: 10 }, kind: 'free' },
  y2024: { label: '2024 A1.1-like chain', sys: { m1: 1.5, m2: 1, k1: 3000, k2: 230, c1: 0.6, c2: 0.3 }, kind: 'free' },
};

/** Angle of X2/X1 in words, with the exam's "almost in/out of phase" reading. */
function phaseWords(deg: number): { text: string; tone: 'ok' | 'm1' | 'warn' } {
  const a = Math.abs(deg);
  if (a < 0.05) return { text: 'in phase: a real mode (0°)', tone: 'ok' };
  if (a > 179.95) return { text: 'out of phase: a real mode (180°)', tone: 'ok' };
  if (a < 20) return { text: `almost in phase (φ = ${fmt(deg, 3)}°)`, tone: 'm1' };
  if (a > 160) return { text: `almost out of phase (φ = ${fmt(deg, 3)}°)`, tone: 'm1' };
  return { text: `genuinely complex (φ = ${fmt(deg, 3)}°)`, tone: 'warn' };
}

/** Wall–m1–m2 springs and dampers for mass centres at cx1, cx2 (px). */
function chainPaths(cx1: number, cx2: number) {
  const h = MASS / 2;
  const d1 = damperPaths(WALL_X, DAMPER_Y, cx1 - h, DAMPER_Y, 7);
  const d2 = damperPaths(cx1 + h, DAMPER_Y, cx2 - h, DAMPER_Y, 7);
  return {
    s1: springPath(WALL_X, SPRING_Y, cx1 - h, SPRING_Y, 6, 7),
    s2: springPath(cx1 + h, SPRING_Y, cx2 - h, SPRING_Y, 5, 7),
    d1: d1.cyl + d1.rod,
    d2: d2.cyl + d2.rod,
  };
}

export default function ComplexModes() {
  const [p, setP] = useState<Sys>(PRESETS.single.sys);
  const [kind, setKind] = useState<DampKind>('free');
  const [beta, setBeta] = useState(0.002);
  const [sel, setSel] = useState<1 | 2>(1);
  const [playing, setPlaying] = useState(true);
  const [decayOn, setDecayOn] = useState(false);
  const set = (key: keyof Sys) => (v: number) => setP((q) => ({ ...q, [key]: v }));

  const c1 = kind === 'prop' ? beta * p.k1 : p.c1;
  const c2 = kind === 'prop' ? beta * p.k2 : p.c2;

  const sys = useMemo(() => {
    const M = [
      [p.m1, 0],
      [0, p.m2],
    ];
    const K = [
      [p.k1 + p.k2, -p.k2],
      [-p.k2, p.k2],
    ];
    const Cd = [
      [c1 + c2, -c2],
      [-c2, c2],
    ];
    const all = dampedModesSorted(M, Cd, K);
    const osc = all.filter((m) => m.s.im > 1e-9);
    const modes = osc.map((m) => {
      let at = 0;
      m.X.forEach((z, i) => {
        if (cabs(z) > cabs(m.X[at])) at = i;
      });
      const Xn: C[] = m.X.map((z) => cdiv(z, m.X[at])); // largest entry = 1∠0
      const r = modeRatio(m.X, 0, 1);
      return { s: m.s, wn: m.wn, wd: m.wd, zeta: m.zeta, Xn, mag: r.mag, deg: r.phaseDeg };
    });
    let matlab: { P: string[][]; D: string[][] } | null = null;
    if (modes.length === 2 && osc.length === all.length) {
      const t = matlabText(matlabEig(M, Cd, K, [1, 2], [1, 1]));
      matlab = { P: t.P, D: t.D };
    }
    return { M, K, Cd, modes, over: all.length - osc.length, matlab };
  }, [p, c1, c2]);

  const mode = sys.modes[Math.min(sel, sys.modes.length) - 1];
  const color = `var(--m${sel})`;

  // ---------------------------------------------------------------- animation (refs only)
  const wrapRef = useRef<HTMLDivElement>(null);
  const armRef = [useRef<SVGLineElement>(null), useRef<SVGLineElement>(null)];
  const headRef = [useRef<SVGPathElement>(null), useRef<SVGPathElement>(null)];
  const dropRef = [useRef<SVGLineElement>(null), useRef<SVGLineElement>(null)];
  const massRef = [useRef<SVGGElement>(null), useRef<SVGGElement>(null)];
  const ghostRef = useRef<SVGLineElement>(null);
  const arcRef = useRef<SVGPathElement>(null);
  const springRef = [useRef<SVGPathElement>(null), useRef<SVGPathElement>(null)];
  const damperRef = [useRef<SVGPathElement>(null), useRef<SVGPathElement>(null)];
  const th = useRef(0);

  const draw = () => {
    if (!mode) return;
    const q = mode.zeta < 1 ? mode.zeta / Math.sqrt(1 - mode.zeta * mode.zeta) : 0;
    let amp = decayOn ? Math.exp(-q * th.current) : 1;
    if (decayOn && amp < 0.06) {
      th.current = 0;
      amp = 1;
    }
    const c = Math.cos(th.current);
    const s = Math.sin(th.current);
    const tips: { x: number; y: number; ang: number; len: number }[] = [];
    [0, 1].forEach((j) => {
      const z = mode.Xn[j];
      const zr = amp * (z.re * c - z.im * s);
      const zi = amp * (z.re * s + z.im * c);
      const cx = REST[j];
      const x = cx + RPH * zr;
      const y = CY - RPH * zi;
      const len = Math.hypot(x - cx, y - CY);
      const ang = Math.atan2(y - CY, x - cx);
      tips.push({ x, y, ang, len });
      const arm = armRef[j].current;
      if (arm) {
        const back = len > 12 ? 9 : 0;
        arm.setAttribute('x2', (x - back * Math.cos(ang)).toFixed(1));
        arm.setAttribute('y2', (y - back * Math.sin(ang)).toFixed(1));
      }
      const head = headRef[j].current;
      if (head) {
        if (len > 12) {
          const a1 = ang + Math.PI - 0.42;
          const a2 = ang + Math.PI + 0.42;
          head.setAttribute('d', `M${x.toFixed(1)} ${y.toFixed(1)}L${(x + 11 * Math.cos(a1)).toFixed(1)} ${(y + 11 * Math.sin(a1)).toFixed(1)}L${(x + 11 * Math.cos(a2)).toFixed(1)} ${(y + 11 * Math.sin(a2)).toFixed(1)}Z`);
        } else head.setAttribute('d', `M${(x - 3).toFixed(1)} ${y.toFixed(1)}a3 3 0 1 0 6 0a3 3 0 1 0 -6 0`);
      }
      const drop = dropRef[j].current;
      if (drop) {
        drop.setAttribute('x1', x.toFixed(1));
        drop.setAttribute('y1', y.toFixed(1));
        drop.setAttribute('x2', x.toFixed(1));
      }
      massRef[j].current?.setAttribute('transform', `translate(${(x - cx).toFixed(1)} 0)`);
    });
    // Ghost of X1's direction inside circle 2, and the arc φ from it to X2.
    const g = ghostRef.current;
    if (g) {
      g.setAttribute('x2', (REST[1] + RPH * Math.cos(tips[0].ang)).toFixed(1));
      g.setAttribute('y2', (CY + RPH * Math.sin(tips[0].ang)).toFixed(1));
    }
    const arc = arcRef.current;
    if (arc) {
      let d = tips[1].ang - tips[0].ang;
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d <= -Math.PI) d += 2 * Math.PI;
      const r = 20;
      const a0 = tips[0].ang;
      const a1 = a0 + d;
      const sx = REST[1] + r * Math.cos(a0);
      const sy = CY + r * Math.sin(a0);
      const ex = REST[1] + r * Math.cos(a1);
      const ey = CY + r * Math.sin(a1);
      arc.setAttribute('d', Math.abs(d) < 0.01 ? '' : `M${sx.toFixed(1)} ${sy.toFixed(1)}A${r} ${r} 0 0 ${d > 0 ? 1 : 0} ${ex.toFixed(1)} ${ey.toFixed(1)}`);
    }
    const ch = chainPaths(tips[0].x, tips[1].x);
    springRef[0].current?.setAttribute('d', ch.s1);
    springRef[1].current?.setAttribute('d', ch.s2);
    damperRef[0].current?.setAttribute('d', ch.d1);
    damperRef[1].current?.setAttribute('d', ch.d2);
  };
  useRaf(
    (dt) => {
      th.current += dt * 2 * Math.PI * SCREEN_HZ;
      if (!decayOn && th.current > 2 * Math.PI * 1000) th.current -= 2 * Math.PI * 1000;
      draw();
    },
    playing,
    wrapRef
  );
  useEffect(draw);

  // ---------------------------------------------------------------- actions
  const applyPreset = (key: keyof typeof PRESETS, m?: 1 | 2) => {
    const pr = PRESETS[key];
    setP(pr.sys);
    setKind(pr.kind);
    if (pr.beta !== undefined) setBeta(pr.beta);
    if (m) setSel(m);
    th.current = 0;
    setPlaying(true);
  };
  const changeKind = (k: DampKind) => {
    if (k === 'free' && kind === 'prop') setP((q) => ({ ...q, c1: beta * q.k1, c2: beta * q.k2 }));
    setKind(k);
  };

  const pw = mode ? phaseWords(mode.deg) : null;
  const sTeX = mode ? `${tex(mode.s.re, 4)} \\pm ${tex(mode.s.im, 5)}i` : '';

  return (
    <div ref={wrapRef}>
      <SimLayout
        visual={
          <>
            <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="anim" role="img" aria-label="Two rotating arrows (phasors), one per mass; each mass moves as the horizontal shadow of its arrow">
              {[0, 1].map((j) => (
                <g key={j}>
                  <circle cx={REST[j]} cy={CY} r={RPH} fill="none" stroke="var(--border)" strokeWidth={1.4} />
                  <line x1={REST[j] - RPH - 10} x2={REST[j] + RPH + 10} y1={CY} y2={CY} stroke="var(--text-3)" strokeWidth={1} />
                  <line x1={REST[j]} x2={REST[j]} y1={CY - RPH - 6} y2={CY + RPH + 6} stroke="var(--text-3)" strokeWidth={1} strokeDasharray="2 3" />
                  <text x={REST[j] + RPH + 12} y={CY + 4} className="plot-note">
                    Re
                  </text>
                  <text x={REST[j] - RPH} y={16} className="diagram-label">
                    {j ? 'mass 2: X₂ e^(iωd t)' : 'mass 1: X₁ e^(iωd t)'}
                  </text>
                  <line x1={REST[j]} x2={REST[j]} y1={MASS_Y - MASS / 2 - 8} y2={MASS_Y + MASS / 2 + 8} stroke="var(--text-3)" strokeDasharray="3 4" />
                </g>
              ))}
              <line ref={ghostRef} x1={REST[1]} y1={CY} x2={REST[1] + RPH} y2={CY} stroke="var(--text-3)" strokeWidth={1.6} strokeDasharray="4 3" />
              <path ref={arcRef} fill="none" stroke="var(--text)" strokeWidth={1.6} />
              {[0, 1].map((j) => (
                <g key={j}>
                  <line ref={dropRef[j]} x1={REST[j]} y1={CY} x2={REST[j]} y2={MASS_Y - MASS / 2} stroke={color} strokeWidth={1.2} strokeDasharray="3 3" opacity={0.8} />
                  <line ref={armRef[j]} x1={REST[j]} y1={CY} x2={REST[j] + RPH} y2={CY} stroke={color} strokeWidth={j ? 3.4 : 2.6} strokeLinecap="round" />
                  <path ref={headRef[j]} fill={color} stroke="none" />
                </g>
              ))}
              <g stroke="var(--text-3)" strokeWidth={1.4}>
                <line x1={WALL_X} y1={MASS_Y - 42} x2={WALL_X} y2={MASS_Y + 36} strokeWidth={2.2} />
                {Array.from({ length: 8 }, (_, i) => (
                  <line key={i} x1={WALL_X} y1={MASS_Y - 40 + i * 10} x2={WALL_X - 8} y2={MASS_Y - 34 + i * 10} />
                ))}
              </g>
              {[0, 1].map((j) => (
                <g key={j}>
                  <path ref={springRef[j]} fill="none" stroke="var(--text-2)" strokeWidth={1.7} strokeLinejoin="round" />
                  <path ref={damperRef[j]} fill="none" stroke="var(--text-2)" strokeWidth={1.7} />
                </g>
              ))}
              {[0, 1].map((j) => (
                <g key={j} ref={massRef[j]}>
                  <rect x={REST[j] - MASS / 2} y={MASS_Y - MASS / 2} width={MASS} height={MASS} rx={5} fill="var(--surface-2)" stroke={color} strokeWidth={2} />
                  <text x={REST[j]} y={MASS_Y + 6} textAnchor="middle" className="diagram-label" style={{ fontSize: 16 }}>
                    {j ? 'm₂' : 'm₁'}
                  </text>
                </g>
              ))}
              <text x={(WALL_X + REST[0] - MASS / 2) / 2} y={SPRING_Y - 14} textAnchor="middle" className="plot-note">
                k₁
              </text>
              <text x={(WALL_X + REST[0] - MASS / 2) / 2} y={DAMPER_Y + 24} textAnchor="middle" className="plot-note">
                c₁
              </text>
              <text x={(REST[0] + REST[1]) / 2} y={SPRING_Y - 14} textAnchor="middle" className="plot-note">
                k₂
              </text>
              <text x={(REST[0] + REST[1]) / 2} y={DAMPER_Y + 24} textAnchor="middle" className="plot-note">
                c₂
              </text>
              {mode && (
                <text x={REST[1] + RPH + 8} y={CY + RPH + 2} className="plot-note" style={{ fontSize: 13 }} fill="var(--text)">
                  {`φ = ${fmt(mode.deg, 3)}°`}
                </text>
              )}
            </svg>
            <Legend
              items={[
                { label: `mode ${sel} phasors (the arrows turn together)`, color },
                { label: 'X₁’s direction copied into circle 2', color: 'var(--text-3)', dash: true },
              ]}
            />
            <Rich
              className="note"
              text={`Each mass sits directly under the tip of its arrow: its displacement is the horizontal shadow $\\mathrm{Re}(X_je^{i\\omega_dt})$. Arrows of equal direction (φ = 0°) mean in phase, opposite (180°) out of phase. Animation slowed to ${SCREEN_HZ} Hz${decayOn ? ', decaying at the true rate per cycle' : ' with the decay removed'}.`}
            />
          </>
        }
        controls={
          <>
            <div className="row gap-s wrap">
              <Segmented<1 | 2>
                label="Mode to animate"
                value={sel}
                onChange={setSel}
                options={[
                  { value: 1, label: 'Mode 1' },
                  { value: 2, label: 'Mode 2' },
                ]}
              />
              <Button size="sm" onClick={() => setPlaying((v) => !v)}>
                {playing ? 'Pause' : 'Play'}
              </Button>
            </div>
            <Segmented<DampKind>
              size="sm"
              label="Damping matrix"
              value={kind}
              onChange={changeKind}
              options={[
                { value: 'free', label: 'Set c₁, c₂ freely' },
                { value: 'prop', label: 'C ∝ K (c = βk)' },
              ]}
            />
            <Slider label="mass 1" tex="m_1" tip="mass on the support spring (kg)" value={p.m1} min={0.5} max={4} step={0.1} unit="kg" onChange={set('m1')} />
            <Slider label="mass 2" tex="m_2" tip="outer mass (kg)" value={p.m2} min={0.5} max={4} step={0.1} unit="kg" onChange={set('m2')} />
            <Slider label="support spring" tex="k_1" tip="spring from the support to m₁ (N/m)" value={p.k1} min={100} max={5000} step={10} unit="N/m" onChange={set('k1')} />
            <Slider label="coupling spring" tex="k_2" tip="spring between the masses (N/m)" value={p.k2} min={100} max={5000} step={10} unit="N/m" onChange={set('k2')} />
            {kind === 'free' ? (
              <>
                <Slider label="support damper" tex="c_1" tip="damper beside k₁ (N s/m)" value={p.c1} min={0} max={40} step={0.1} unit="N s/m" onChange={set('c1')} />
                <Slider label="middle damper" tex="c_2" tip="damper beside k₂ (N s/m)" value={p.c2} min={0} max={40} step={0.1} unit="N s/m" onChange={set('c2')} />
              </>
            ) : (
              <>
                <Slider label="ratio c/k" tex="\beta" tip="stiffness-proportional coefficient β = c/k (s): C = βK" value={beta} min={0} max={0.01} step={0.0001} unit="s" onChange={setBeta} />
                <Rich className="note" text={`$c_1 = \\beta k_1 = ${tex(c1, 3)}$ N s/m, $c_2 = \\beta k_2 = ${tex(c2, 3)}$ N s/m, so $C = \\beta K$ (Rayleigh with $\\alpha = 0$).`} />
              </>
            )}
            {sys.modes.length < 2 && (
              <Badge tone="warn">{`${2 - sys.modes.length} mode${sys.modes.length === 0 ? 's are' : ' is'} over-damped: real eigenvalues, nothing to rotate`}</Badge>
            )}
            <Readouts>
              {sys.modes.map((m, i) => (
                <Readout key={`w${i}`} tex={`\\omega_{n${i + 1}}`} tip={`mode ${i + 1} undamped natural frequency |s| (rad/s)`} value={m.wn} unit="rad/s" tone={i ? 'm2' : 'm1'} />
              ))}
              {sys.modes.map((m, i) => (
                <Readout key={`z${i}`} tex={`\\zeta_${i + 1}`} tip={`mode ${i + 1} damping ratio −Re s/|s|`} value={m.zeta} sig={3} tone={i ? 'm2' : 'm1'} />
              ))}
              {sys.modes.map((m, i) => (
                <Readout key={`m${i}`} tex={`|X_2/X_1|_${i + 1}`} tip={`mode ${i + 1}: amplitude of mass 2 over mass 1`} value={m.mag} sig={4} tone={i ? 'm2' : 'm1'} />
              ))}
              {sys.modes.map((m, i) => (
                <Readout key={`p${i}`} tex={`\\varphi_${i + 1}`} tip={`mode ${i + 1}: angle of X₂/X₁ in degrees (0 in phase, 180 out of phase)`} value={m.deg} unit="°" sig={4} tone={i ? 'm2' : 'm1'} />
              ))}
            </Readouts>
            {pw && <Badge tone={pw.tone}>{`mode ${sel}: ${pw.text}`}</Badge>}
            {mode && <Rich className="note" text={`Mode ${sel}: $s = ${sTeX}$ s⁻¹, $X_2/X_1 = ${tex(mode.mag, 4)}\\angle{${tex(mode.deg, 4)}}°$.`} />}
            <Toggle checked={decayOn} onChange={setDecayOn} label="Show the decay (restarts when it has died away)" />
            <div className="row gap-s wrap">
              <span className="muted small">Presets:</span>
              {(Object.keys(PRESETS) as (keyof typeof PRESETS)[]).map((k) => (
                <Button key={k} size="sm" onClick={() => applyPreset(k)}>
                  {PRESETS[k].label}
                </Button>
              ))}
            </div>
            <More label="This system as MATLAB’s [P, D] = eig(A)">
              {sys.matlab ? (
                <>
                  <MatlabBlock
                    label="MATLAB output for the current system"
                    matrices={[
                      { name: 'P', cells: sys.matlab.P },
                      { name: 'D', cells: sys.matlab.D },
                    ]}
                    colTint={(_, col) => (Math.floor(col / 2) + 1 === sel ? `color-mix(in srgb, var(--m${sel}) 14%, transparent)` : undefined)}
                  />
                  <Rich className="note" text="Rows: $X_1$, $X_2$, $V_1$, $V_2$. Printed sorted here (mode 1 in columns 1–2); the real `eig` gives no such promise. The tinted columns are the mode being animated: $V_2/V_1$ in a column equals $X_2/X_1$." />
                </>
              ) : (
                <Rich className="note" text="Not printed while a mode is over-damped." />
              )}
            </More>
          </>
        }
      />
      <PredictReveal
        id="a6-cm-prop"
        question="Switch to **C ∝ K** (every damper has the same ratio $c/k$). What is the angle $\varphi$ of $X_2/X_1$ in each mode?"
        options={['Exactly 0° in mode 1 and 180° in mode 2', 'A few degrees away from 0° and 180°', 'About 90° in both modes']}
        answer={0}
        explain="With $C = \beta K$ the undamped modes diagonalise $C$ as well ($P^TCP = \beta P^TKP$), so every mode is a damped SDOF oscillator with a **real** shape: here exactly $[1,\,2]$ and $[1,\,-1]$, the undamped shapes. Only the decay changes: $\zeta_i = \beta\omega_i/2$ = 0.0224 and 0.0447 for β = 0.002 s (official 2018 A1.1: $P^TCP$ **is** diagonal for Rayleigh damping)."
        tryIt="press “C ∝ K (same c/k)” and read φ₁ and φ₂."
        onApply={() => applyPreset('prop', 1)}
      />
      <PredictReveal
        id="a6-cm-single"
        question="Now put a single damper between the support and $m_1$ ($c_1$ = 20 N s/m, $c_2 = 0$). In mode 1, do both masses still pass through zero at the same instant?"
        options={['Yes: φ stays exactly 0°', 'No: mass 2 is about 9° out of step with mass 1', 'No: they are about 90° apart']}
        answer={1}
        explain="Non-proportional damping makes the modes complex: $X_2/X_1 = 1.985\angle 8.6°$ in mode 1 and $1.008\angle 162.8°$ in mode 2, so the masses reach their peaks at slightly different times. In exam language mode 1 is still **almost in phase** and mode 2 **almost out of phase**: it is the angle, not the magnitudes, that decides (official 2019 Q1f)."
        tryIt="press “Damper on m₁ only” and watch the arc between the dashed copy of X₁ and X₂."
        onApply={() => applyPreset('single', 1)}
      />
      <PredictReveal
        id="a6-cm-double"
        question="With the single damper on $m_1$, double $c_1$ from 20 to 40 N s/m. What happens to mode 1’s angle $\varphi_1$ and its magnitude $|X_2/X_1|$?"
        options={['φ₁ roughly doubles (to about 18°) while |X₂/X₁| hardly changes', 'φ₁ stays put while |X₂/X₁| doubles', 'Neither changes: damping only affects ζ']}
        answer={0}
        explain="$\varphi_1$: 8.6° → 17.9°, while $|X_2/X_1|$: 1.985 → 1.937 (−2.4 %) and $\zeta$: 0.075 → 0.151. Light non-proportional damping mostly adds a phase shift; the magnitudes stay close to the undamped shape $[1,\,2]$. That is why worked solutions can still quote “[1; 1.89], in phase” from a complex $P$."
        tryIt="press “Damper on m₁ only”, then drag c₁ to 40 N s/m."
        onApply={() => {
          setKind('free');
          setP({ ...PRESETS.single.sys, c1: 40 });
          setSel(1);
        }}
      />
      <PredictReveal
        id="a6-cm-2024"
        question="A 2024-style chain: $m_1$ = 1.5 kg, $m_2$ = 1 kg, $k_1$ = 3000 N/m, $k_2$ = 230 N/m, light damping. Which mass dominates **mode 1**?"
        options={['Mass 1, on the stiff support spring', 'Mass 2, the outer mass, by about 12 times', 'Neither: they move equally']}
        answer={1}
        explain="Mode 1 (14.55 rad/s) has $X_2/X_1 = 12.66\angle{-0.9}°$: the outer mass swings on the soft coupling spring while mass 1 barely moves, in phase. Mode 2 (46.60 rad/s) is $0.119\angle{-177}°$: mass 1 dominates, out of phase. That is the 2024 A1.1 reading, [1; 12.7] and [1; −0.118]."
        tryIt="press “2024 A1.1-like chain” and compare the arrow lengths in mode 1 and mode 2."
        onApply={() => applyPreset('y2024', 1)}
      />
    </div>
  );
}
