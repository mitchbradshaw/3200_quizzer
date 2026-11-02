// Section scaling: what L, d, t, w, E and ρ each do to the bending frequencies and to the static deflection.
// Thin tube: ω ∝ d/L², independent of t. Rectangle: ω ∝ (depth in the bending direction)/L², independent of the
// other side. Deflection under a load still depends on t (EI ∝ t). Includes the eVTOL wing-width challenge.
import { useMemo, useState } from 'react';
import { type BeamBC, betaL, rectangle, thinTube } from '../../../physics/beams';
import { Dot, Line, Plot, PlotText, VLine, HLine } from '../../../plot/Plot';
import { Badge, Button, Callout, Readout, Readouts, Segmented, SimLayout, Slider, Toggle } from '../../../ui/kit';
import { PredictReveal } from '../../../ui/PredictReveal';
import { Rich } from '../../../ui/Rich';
import { completeChallenge, useProgress } from '../../../app/store';
import { fmt } from '../../../engine/format';
import { BC_NAME, BC_ORDER, BC_SHORT, MATERIALS, materialById, staticCoefficient } from '../physics';
import { modeTone } from './ModeShapes';

export const WING_CHALLENGE = 'b3-wing-width';
const TAU = 2 * Math.PI;

type Section = 'tube' | 'rect';
type Plane = 'in' | 'out';
interface State {
  section: Section;
  d: number;
  tt: number; // tube wall
  w: number;
  tr: number; // rectangle thickness
  plane: Plane;
  L: number;
  mat: string;
  bc: BeamBC;
}

const PRESETS: { id: string; label: string; s: State; note: string }[] = [
  { id: 'evtol', label: '2022 eVTOL wing', s: { section: 'rect', d: 0.2, tt: 0.005, w: 0.4212, tr: 0.00452, plane: 'in', L: 3, mat: 'cfrp', bc: 'clamped-free' }, note: 'CFRP cantilever, in-plane bending across w: f₁ = 100 Hz = 2.5 × 40 Hz.' },
  { id: 'blade', label: '2023 turbine blade', s: { section: 'tube', d: 13.92, tt: 0.0696, w: 0.4, tr: 0.005, plane: 'in', L: 86.4, mat: 'blade', bc: 'clamped-free' }, note: 'Cantilevered thin tube, t/d = 0.005: ω₁ = 2 × 1.8 Ω_max = 6.25 rad/s (f₁ = 0.995 Hz).' },
  { id: 'shaft', label: '2024 hydro shaft', s: { section: 'tube', d: 0.7, tt: 0.02, w: 0.4, tr: 0.005, plane: 'in', L: 13.37, mat: 'steel', bc: 'pinned-pinned' }, note: 'Pinned–pinned steel thin tube (L from the torsion test): f = 11.3, 45.0, 101 Hz.' },
  { id: 'tidal', label: '2025 tidal blade', s: { section: 'tube', d: 0.2, tt: 0.005, w: 0.4, tr: 0.005, plane: 'in', L: 7.78, mat: 'gfrp', bc: 'clamped-free' }, note: 'Cantilevered thin tube with the length found from a 180 rpm critical speed.' },
];

const mmOrM = (v: number) => (v < 1 ? `${fmt(v * 1000, 3)} mm` : `${fmt(v, 3)} m`);

/** EI with an SI prefix so the readout stays short (N m², kN m², MN m², GN m²). */
function eiScaled(EI: number): { value: number; unit: string } {
  if (EI >= 1e9) return { value: EI / 1e9, unit: 'GN m²' };
  if (EI >= 1e6) return { value: EI / 1e6, unit: 'MN m²' };
  if (EI >= 1e3) return { value: EI / 1e3, unit: 'kN m²' };
  return { value: EI, unit: 'N m²' };
}

function compute(s: State) {
  const m = materialById(s.mat);
  const sec = s.section === 'tube' ? thinTube(s.d, s.tt) : s.plane === 'in' ? rectangle(s.tr, s.w) : rectangle(s.w, s.tr);
  const rhoA = m.rho * sec.A;
  const EI = m.E * sec.I;
  const roots = betaL(s.bc, 3);
  const omegas = roots.map((b) => b * b * Math.sqrt(EI / (rhoA * s.L ** 4)));
  const sc = staticCoefficient(s.bc);
  const deltaPerkN = sc ? (sc.c * 1000 * s.L ** 3) / EI : NaN; // m per kN
  return { m, sec, rhoA, EI, rg: Math.sqrt(sec.I / sec.A), f: omegas.map((w) => w / TAU), deltaPerkN, sc };
}

/** Exponents of f₁ and δ with respect to each parameter, for the current section and plane. */
function slopes(s: State): { key: string; label: string; f: number; delta: number }[] {
  const common = [
    { key: 'L', label: 'L', f: -2, delta: 3 },
    { key: 'E', label: 'E', f: 0.5, delta: -1 },
    { key: 'rho', label: 'ρ', f: -0.5, delta: 0 },
  ];
  if (s.section === 'tube') return [{ key: 'd', label: 'd', f: 1, delta: -3 }, { key: 't', label: 't', f: 0, delta: -1 }, ...common];
  return s.plane === 'in'
    ? [{ key: 'w', label: 'w', f: 1, delta: -3 }, { key: 't', label: 't', f: 0, delta: -1 }, ...common]
    : [{ key: 't', label: 't', f: 1, delta: -3 }, { key: 'w', label: 'w', f: 0, delta: -1 }, ...common];
}

export default function SectionScaling() {
  const p = useProgress();
  const [s, setS] = useState<State>(PRESETS[3].s);
  const [ref, setRef] = useState<State>(PRESETS[3].s);
  const [showDelta, setShowDelta] = useState(false);
  const [challenge, setChallenge] = useState(false);
  const set = (patch: Partial<State>) => setS((o) => ({ ...o, ...patch }));
  const load = (st: State) => {
    setS(st);
    setRef(st);
  };

  const c = useMemo(() => compute(s), [s]);
  const r = useMemo(() => compute(ref), [ref]);
  const sl = slopes(s);

  // Scale factor of each parameter against the reference (for the dots on the sensitivity plot).
  const mat = c.m;
  const rmat = r.m;
  const scale: Record<string, number> = {
    d: s.d / ref.d,
    t: s.section === 'tube' ? s.tt / ref.tt : s.tr / ref.tr,
    w: s.w / ref.w,
    L: s.L / ref.L,
    E: mat.E / rmat.E,
    rho: mat.rho / rmat.rho,
  };
  const yr = showDelta ? { min: 1 / 80, max: 80 } : { min: 1 / 20, max: 20 };
  // Lines grouped by exponent so coincident lines share one label; labels pushed apart so they never overlap.
  const groups = useMemo(() => {
    const m = new Map<number, string[]>();
    for (const q of sl) {
      const k = showDelta ? q.delta : q.f;
      m.set(k, [...(m.get(k) ?? []), q.label]);
    }
    // Labels sit just outside the right edge, at each line's end, pushed apart by at least 14 px.
    const gs = [...m.entries()].sort((a, b) => b[0] - a[0]).map(([k, names]) => ({ k, names, ylog: Math.log10(4 ** k) }));
    const dec = Math.log10(yr.max / yr.min);
    const gap = (14 / 208) * dec; // 14 px in decades (plot inner height ≈ 208 px)
    const top = Math.log10(yr.max) - gap * 0.3;
    const bot = Math.log10(yr.min) + gap * 0.5;
    let prev = Infinity;
    for (const g of gs) {
      g.ylog = Math.min(g.ylog, top, prev - gap);
      prev = g.ylog;
    }
    for (let i = gs.length - 1, next = -Infinity; i >= 0; i--) {
      gs[i].ylog = Math.max(gs[i].ylog, bot, next + gap);
      next = gs[i].ylog;
    }
    return gs;
  }, [sl, showDelta, yr.max, yr.min]);
  const EXP: Record<string, string> = { '1': '× s', '0.5': '× √s', '-0.5': '× 1/√s', '-1': '× 1/s', '2': '× s²', '-2': '× 1/s²', '3': '× s³', '-3': '× 1/s³', '0': 'no effect' };
  const expTxt = (k: number) => EXP[String(k)] ?? `× s^${k}`;

  // Challenge: narrowest CFRP wing (L = 3 m, cantilever, in-plane) with f₁ ≥ 100 Hz.
  const wMin = 0.42120;
  const chOk = s.section === 'rect' && s.mat === 'cfrp' && Math.abs(s.L - 3) < 1e-9 && s.bc === 'clamped-free' && s.plane === 'in';
  const solved = chOk && c.f[0] >= 100 * 0.999 && s.w <= wMin * 1.02;
  const done = !!p.challenges[WING_CHALLENGE];

  const tubeWall = s.section === 'tube' ? s.tt / s.d : 0;

  return (
    <div>
      <SimLayout
        visual={
          <>
            <SectionDrawing s={s} />
            <Plot
              x={{ min: 0.25, max: 4, log: true, label: 'scale factor s on one parameter (others fixed)', ticks: [0.25, 0.5, 1, 2, 4], format: (v) => (v < 1 ? `${v}` : `${v}`) }}
              y={{ min: yr.min, max: yr.max, log: true, label: showDelta ? 'δ / δ_ref' : 'f₁ / f₁,ref' }}
              height={260}
              margin={{ r: 104 }}
              ariaLabel="How each parameter scales the first natural frequency or the static deflection"
            >
              <VLine x={1} color="var(--border)" dash={false} />
              <HLine y={1} color="var(--border)" dash={false} />
              {groups.map((g, gi) => (
                <g key={g.k}>
                  <Line points={[[0.25, 0.25 ** g.k], [4, 4 ** g.k]]} color={g.k === 0 ? 'var(--text-3)' : 'var(--text-2)'} width={g.k === 0 ? 2.4 : 1.6} dash={gi % 2 ? '6 3' : undefined} />
                  <PlotText x={4} y={10 ** g.ylog} dx={6} dy={4} anchor="start" color="var(--text-2)">
                    {`${g.names.join(', ')}: ${expTxt(g.k)}`}
                  </PlotText>
                </g>
              ))}
              {sl.map((q) => {
                const sv = scale[q.key];
                if (!Number.isFinite(sv) || sv < 0.25 || sv > 4) return null;
                const k = showDelta ? q.delta : q.f;
                return <Dot key={q.key} x={sv} y={sv ** k} color="var(--accent)" r={4} />;
              })}
            </Plot>
            <Rich
              className="note"
              text={
                showDelta
                  ? 'Each line shows what one parameter does **on its own** to the static deflection $\\delta = cPL^3/EI$; the dots sit at your current values relative to the reference. Thickness now matters ($EI \\propto t$).'
                  : 'Each line shows what one parameter does **on its own** to $f_1 \\propto (\\beta_1 L)^2 (r_g/L^2)\\sqrt{E/\\rho}$; the dots sit at your current values relative to the reference. A flat line means that parameter cancels.'
              }
            />
            <Callout kind="note" title="What cancels">
              <Rich
                text={
                  s.section === 'tube'
                    ? 'Thin tube: $I \\approx \\pi r^3 t$ and $A \\approx 2\\pi r t$, so $EI/\\rho A = E r^2/2\\rho$. The wall thickness **cancels**: $\\omega_i = (\\beta_i L)^2 (r/L^2)\\sqrt{E/2\\rho} \\propto d/L^2$. The deflection still depends on $t$ ($EI \\propto t$).'
                    : s.plane === 'in'
                      ? 'In-plane (across $w$): $I = t w^3/12$, $A = wt$, so $I/A = w^2/12$. The thickness **cancels**: $\\omega_i \\propto w/L^2$. Use this for the take-off unbalance (2022 B2.1, 2023 B1.5).'
                      : 'Out-of-plane (across $t$): $I = w t^3/12$, so $I/A = t^2/12$ and the width cancels: $\\omega_i \\propto t/L^2$. Compared with in-plane bending the frequencies drop by $t/w$ (2022 B2.4, 2023 B1.6).'
                }
              />
            </Callout>
          </>
        }
        controls={
          <>
            <div className="row gap-s wrap">
              <Segmented
                size="sm"
                label="Cross-section"
                value={s.section}
                onChange={(v: Section) => {
                  const next = { ...s, section: v };
                  setS(next);
                  setRef(next);
                }}
                options={[{ value: 'tube' as const, label: 'Thin tube' }, { value: 'rect' as const, label: 'Rectangle (wing)' }]}
              />
              <Toggle checked={showDelta} onChange={setShowDelta} label="plot deflection δ" />
            </div>
            {s.section === 'tube' ? (
              <>
                <Slider label="mean diameter" tex="d" tip="mean diameter of the thin tube" value={s.d} min={0.02} max={20} log format={mmOrM} onChange={(v) => set({ d: v })} />
                <Slider label="wall thickness" tex="t" tip="wall thickness (thin tube: t ≪ d)" value={s.tt} min={0.0005} max={0.3} log format={mmOrM} onChange={(v) => set({ tt: v })} />
              </>
            ) : (
              <>
                <Slider label="width" tex="w" tip="the long side of the section (in the wing plane)" value={s.w} min={0.02} max={2} log format={mmOrM} onChange={(v) => set({ w: v })} />
                <Slider label="thickness" tex="t" tip="the short side of the section" value={s.tr} min={0.0005} max={0.1} log format={mmOrM} onChange={(v) => set({ tr: v })} />
                <div className="row gap-s wrap">
                  <span className="muted small">Bending</span>
                  <Segmented size="sm" label="Bending plane" value={s.plane} onChange={(v: Plane) => set({ plane: v })} options={[{ value: 'in' as const, label: 'across w (in-plane)' }, { value: 'out' as const, label: 'across t (out-of-plane)' }]} />
                </div>
              </>
            )}
            <Slider label="length" tex="L" tip="vibrating length" value={s.L} min={0.3} max={120} log format={mmOrM} onChange={(v) => set({ L: v })} />
            <div className="row gap-s wrap">
              <span className="muted small">Material</span>
              <Segmented size="sm" label="Material" value={s.mat} onChange={(v: string) => set({ mat: v })} options={MATERIALS.map((m) => ({ value: m.id, label: m.id === 'blade' ? 'Blade' : m.id === 'al' ? 'Al' : m.label, title: `${m.label}: E = ${m.E / 1e9} GPa, ρ = ${m.rho} kg/m³` }))} />
            </div>
            <div className="row gap-s wrap">
              <span className="muted small">Supports</span>
              <Segmented size="sm" label="Boundary conditions" value={s.bc} onChange={(v: BeamBC) => set({ bc: v })} options={BC_ORDER.map((b) => ({ value: b, label: BC_SHORT[b], title: BC_NAME[b] }))} />
            </div>
            <p className="muted small" style={{ margin: 0 }}>
              {mat.label}: E = {fmt(mat.E / 1e9, 4)} GPa, ρ = {mat.rho} kg/m³ · {BC_NAME[s.bc]}
            </p>
            <Readouts>
              {[0, 1, 2].map((k) => (
                <Readout key={k} tex={`f_${k + 1}`} tip={`natural frequency of bending mode ${k + 1}`} value={c.f[k]} unit="Hz" sig={4} tone={modeTone(k + 1)} />
              ))}
              <Readout tex="r_g" tip="radius of gyration √(I/A): thin tube d/(2√2), rectangle depth/√12" value={c.rg * 1000} unit="mm" sig={4} />
              <Readout tex="\rho A" tip="mass per unit length ρA (kg/m)" value={c.rhoA} unit="kg/m" sig={4} />
              <Readout tex="EI" tip="bending stiffness E × I (sets deflections, not frequencies on its own)" value={eiScaled(c.EI).value} unit={eiScaled(c.EI).unit} sig={3} />
              <Readout tex="\delta" tip={c.sc ? `static deflection per kN (${c.sc.where}): δ = cPL³/EI with c = ${fmt(c.sc.c, 4)}` : 'free–free and free–pinned beams have rigid-body modes: no static deflection'} value={c.deltaPerkN * 1000} text={c.sc ? undefined : 'unrestrained'} unit="mm/kN" sig={3} />
              <Readout tex="f_1/f_{1,ref}" tip="change in f₁ since the reference (preset or 'set as reference') was taken" value={c.f[0] / r.f[0]} sig={4} />
              <Readout tex="\delta/\delta_{ref}" tip="change in static deflection since the reference was taken" value={c.deltaPerkN / r.deltaPerkN} text={c.sc && r.sc ? undefined : '—'} sig={4} />
            </Readouts>
            {tubeWall > 0.1 && (
              <Callout kind="warn" title="Not a thin tube any more">
                t/d = {tubeWall.toFixed(2)}: the formulas I ≈ πr³t, A ≈ 2πrt assume t ≪ d.
              </Callout>
            )}
            <div className="row gap-s wrap">
              <span className="muted small">Exam cases:</span>
              {PRESETS.map((q) => (
                <Button key={q.id} size="sm" onClick={() => { load(q.s); setChallenge(false); }} title={q.note}>
                  {q.label}
                </Button>
              ))}
              <Button size="sm" variant="ghost" onClick={() => setRef(s)}>
                Set current as reference
              </Button>
            </div>
            <Callout kind="info" title="Challenge: the narrowest eVTOL wing">
              <Rich text="CFRP wing, $L$ = 3 m, fixed at the aircraft centre (cantilever). Rotors spin up to 2400 rpm during take-off and excite **in-plane** bending. Make the lowest critical speed at least 2.5 × the rotor speed ($f_1 \ge$ 100 Hz) with the **narrowest** width $w$ (within 2 %). Which sliders help?" />
              <div className="row gap-s wrap" style={{ marginTop: 6 }}>
                <Button
                  size="sm"
                  onClick={() => {
                    load({ section: 'rect', d: 0.2, tt: 0.005, w: 0.3, tr: 0.0045, plane: 'in', L: 3, mat: 'cfrp', bc: 'clamped-free' });
                    setChallenge(true);
                  }}
                >
                  Load the challenge
                </Button>
                <Button size="sm" variant="primary" disabled={!solved || done} onClick={() => completeChallenge(WING_CHALLENGE)}>
                  {done ? '✓ Challenge complete' : 'Submit this width'}
                </Button>
              </div>
              {challenge && (
                <p className="small" style={{ margin: '6px 0 0' }}>
                  {!chOk
                    ? 'Keep CFRP, L = 3 m, the cantilever and in-plane bending: only the section should change.'
                    : c.f[0] < 99.9
                      ? `f₁ = ${fmt(c.f[0], 4)} Hz: still below 100 Hz.`
                      : solved
                        ? `f₁ = ${fmt(c.f[0], 4)} Hz with w = ${fmt(s.w * 1000, 4)} mm: that is the minimum (0.421 m). Submit it!`
                        : `f₁ = ${fmt(c.f[0], 4)} Hz meets the margin, but w = ${fmt(s.w * 1000, 4)} mm is wider than needed.`}
                </p>
              )}
              {done && <Badge tone="ok">Solved: w = ω₁L²/((β₁L)²√(E/12ρ)) = 0.421 m, and t cannot help (it cancels).</Badge>}
            </Callout>
          </>
        }
      />
      <PredictReveal
        id="b3-sec-double-t"
        question="Tidal-blade tube: double the wall thickness $t$ (same $d$). The first bending frequency…"
        options={['doubles', 'rises by √2', 'does not change', 'halves']}
        answer={2}
        explain="$I \approx \pi r^3 t$ and $A \approx 2\pi r t$ are both proportional to $t$, so $EI/\rho A = Er^2/2\rho$: stiffness and mass grow together and $t$ cancels. 'Thickness affects the bending frequencies' is a recurring false option (2024 B1.5(b), 2025 B1.5(d))."
        tryIt="load the 2025 tidal blade and double t; watch the t-dot slide along the flat line."
        onApply={() => {
          load(PRESETS[3].s);
          setShowDelta(false);
          set({ tt: PRESETS[3].s.tt * 2 });
        }}
      />
      <PredictReveal
        id="b3-sec-double-d"
        question="Now double the tube's mean diameter $d$ (same $t$). $f_1$…"
        options={['doubles', 'quadruples', 'rises 8 times', 'does not change']}
        answer={0}
        explain="$I/A = r^2/2$, so $\sqrt{EI/\rho A} \propto r$ and $f \propto d/L^2$. $I$ alone rises 8× but the mass per length doubles too, so the net effect is ×2 (ω ∝ d is why the 2023 blade design solves for d)."
        tryIt="double d and read f₁/f₁,ref."
        onApply={() => {
          load(PRESETS[3].s);
          setShowDelta(false);
          set({ d: PRESETS[3].s.d * 2 });
        }}
      />
      <PredictReveal
        id="b3-sec-half-L"
        question="Halve the length $L$ of the same beam. $f_1$…"
        options={['doubles', 'quadruples', 'rises 8 times', 'halves']}
        answer={1}
        explain="$\omega_i = (\beta_i L)^2\sqrt{EI/(\rho A L^4)} \propto 1/L^2$, so halving L multiplies every frequency by 4. (The static deflection under a tip load falls 8×, as $L^3$.)"
        tryIt="halve L and read f₁/f₁,ref."
        onApply={() => {
          load(PRESETS[3].s);
          setShowDelta(false);
          set({ L: PRESETS[3].s.L / 2 });
        }}
      />
      <PredictReveal
        id="b3-sec-deflection"
        question="Back to the original tube: double $t$ and look at the **static deflection** under the same load. It…"
        options={['halves', 'does not change', 'quarters']}
        answer={0}
        explain="$\delta = cPL^3/EI$ and $I \approx \pi r^3 t \propto t$, so doubling $t$ halves the deflection while the frequencies stay put. That is why $t$ is the design knob for a forced-response limit (2024 B1.6(b), B2.5): response ∝ 1/t."
        tryIt="switch the plot to deflection δ and double t."
        onApply={() => {
          load(PRESETS[3].s);
          setShowDelta(true);
          set({ tt: PRESETS[3].s.tt * 2 });
        }}
      />
      <PredictReveal
        id="b3-sec-plane"
        question="eVTOL wing ($w$ = 421 mm, $t$ = 4.52 mm). In cruise the rotors tilt and excite **out-of-plane** bending (across $t$). The fundamental becomes…"
        options={['the same 100 Hz', 'about t/w ≈ 1/93 of it (≈ 1.1 Hz)', 'about (t/w)² of it', '93 times higher']}
        answer={1}
        explain="Out-of-plane $I = wt^3/12$, so $r_g = t/\sqrt{12}$ instead of $w/\sqrt{12}$: the frequencies scale by $t/w$ (100 Hz → 1.07 Hz) while the stiffness scales by $(t/w)^2$. Same shapes, very different numbers (2022 B2.4, 2023 B1.6)."
        tryIt="load the 2022 eVTOL wing and switch bending to across t."
        onApply={() => {
          load(PRESETS[0].s);
          setShowDelta(false);
          set({ plane: 'out' });
        }}
      />
    </div>
  );
}

/** Cross-section drawing with the bending direction marked. Not to scale in thickness (walls ≥ 2 px). */
function SectionDrawing({ s }: { s: State }) {
  const W = 300;
  const H = 150;
  if (s.section === 'tube') {
    const R = 52;
    const wall = Math.max(2, Math.min(26, (2 * R * s.tt) / s.d));
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="anim" style={{ maxWidth: 360 }} role="img" aria-label={`Thin tube section, d = ${mmOrM(s.d)}, t = ${mmOrM(s.tt)}`}>
        <circle cx={110} cy={70} r={R} fill="none" stroke="var(--text-2)" strokeWidth={wall} />
        <line x1={110 - R} x2={110 + R} y1={136} y2={136} stroke="var(--text-2)" strokeWidth={1.2} />
        <line x1={110 - R} x2={110 - R} y1={130} y2={142} stroke="var(--text-2)" />
        <line x1={110 + R} x2={110 + R} y1={130} y2={142} stroke="var(--text-2)" />
        <text x={110} y={148} textAnchor="middle" className="plot-note">{`d = ${mmOrM(s.d)}`}</text>
        <text x={110} y={70 - R - 8} textAnchor="middle" className="plot-note">{`t = ${mmOrM(s.tt)}`}</text>
        <BendArrow x={232} y={70} vertical />
      </svg>
    );
  }
  // rectangle: w horizontal, t vertical (as a wing seen end-on), not to scale in t
  const bw = 170;
  const th = Math.max(4, Math.min(60, (bw * s.tr) / s.w));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="anim" style={{ maxWidth: 360 }} role="img" aria-label={`Rectangular section w = ${mmOrM(s.w)}, t = ${mmOrM(s.tr)}, bending ${s.plane === 'in' ? 'across w' : 'across t'}`}>
      <rect x={110 - bw / 2} y={70 - th / 2} width={bw} height={th} fill="var(--surface-3)" stroke="var(--text-2)" strokeWidth={1.6} rx={1} />
      <text x={110} y={70 + th / 2 + 18} textAnchor="middle" className="plot-note">{`w = ${mmOrM(s.w)}`}</text>
      <text x={110 + bw / 2} y={70 - th / 2 - 8} textAnchor="end" className="plot-note">{`t = ${mmOrM(s.tr)}`}</text>
      {s.plane === 'in' ? <BendArrow x={110} y={22} /> : <BendArrow x={250} y={70} vertical />}
    </svg>
  );
}

function BendArrow({ x, y, vertical }: { x: number; y: number; vertical?: boolean }) {
  const L = 34;
  const d = vertical ? `M${x} ${y - L}L${x} ${y + L}M${x - 5} ${y - L + 7}L${x} ${y - L}L${x + 5} ${y - L + 7}M${x - 5} ${y + L - 7}L${x} ${y + L}L${x + 5} ${y + L - 7}` : `M${x - L} ${y}L${x + L} ${y}M${x - L + 7} ${y - 5}L${x - L} ${y}L${x - L + 7} ${y + 5}M${x + L - 7} ${y - 5}L${x + L} ${y}L${x + L - 7} ${y + 5}`;
  return (
    <g>
      <path d={d} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinecap="round" />
      <text x={vertical ? x : x} y={vertical ? y + L + 14 : y - 9} textAnchor="middle" className="plot-note" fill="var(--accent)">
        bending
      </text>
    </g>
  );
}
