// B6 design studio: the B2 template as a working design. Pick a scenario (2022 eVTOL wing, 2023 wind-turbine
// blade, 2024 hydro shaft), size the free dimension against the frequency requirement, read the mode sketches,
// size the thickness for the amplitude limit, then add the masses and see whether the margin survives.
import { useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { nodes as beamNodes } from '../../../physics/beams';
import { waveModeShape, waveNodes } from '../../../physics/waves';
import { useRaf } from '../../../anim/hooks';
import { Band, Bars, Dot, HBand, HLine, Handle, Line, LivePath, Plot, PlotText, VLine, sample, type PlotScales } from '../../../plot/Plot';
import { Badge, Button, Callout, Legend, Readout, Readouts, Segmented, SimLayout, Slider, Toggle } from '../../../ui/kit';
import { PredictReveal } from '../../../ui/PredictReveal';
import { Rich } from '../../../ui/Rich';
import { completeChallenge, useProgress } from '../../../app/store';
import { fmt } from '../../../engine/format';
import { feBeam } from '../../B5/physics';
import {
  NX,
  SCENARIOS,
  XS,
  bendingOmegas,
  checks,
  dimSI,
  excitationMax,
  initialDesign,
  massCheck,
  memberMass,
  minDim,
  modeGrid,
  requiredOmega,
  response,
  rootFlexCurve,
  spinCoef,
  thickSI,
  torsionHzs,
  worstCase,
  type Design,
  type StudioId,
  type StudioScenario,
} from '../studioModel';
import { TAU } from '../physics';
import { CheckLine, MemberSketch, PlotEnds, type EndKind } from './studioParts';

export const STUDIO_CHALLENGE = 'b6-studio-wing';

type Step = 'size' | 'modes' | 'response' | 'masses' | 'validity';
type ModeView = 'bending' | 'torsion' | 'both';

const STEPS: { value: Step; label: string; title: string }[] = [
  { value: 'size', label: '1 · Size', title: 'Template steps 1–2: model, convert, size the free dimension' },
  { value: 'modes', label: '2 · Modes', title: 'Steps 3–4: f₂, f₃, sketches, torsion vs bending' },
  { value: 'response', label: '3 · Response', title: 'Step 5: forced response, size the thickness' },
  { value: 'masses', label: '4 · Masses', title: 'Step 6: added masses' },
  { value: 'validity', label: '5 · Validity', title: 'Step 7: what the model assumes' },
];

const SUB = ['₁', '₂', '₃'];
const mcol = (i: number) => `var(--m${i + 1})`;

/** Bending shape i (0-based) scaled to max |Y| = 1: free tip positive (cantilever), first lobe positive (pinned). */
function unitShape(sc: StudioScenario, i: number): Float64Array {
  const g = modeGrid(sc)[i];
  let big = 0;
  for (const v of g) big = Math.max(big, Math.abs(v));
  const ref = sc.bc === 'clamped-free' ? g[NX - 1] : g.find((v) => Math.abs(v) > 0.5 * big) ?? 1;
  const s = (ref < 0 ? -1 : 1) / (big || 1);
  return Float64Array.from(g, (v) => v * s);
}

/** Torsional shape i (0-based), max 1: free end positive (fixed–free, like the bending tip), first lobe positive (fixed–fixed). */
function torsionShape(sc: StudioScenario, i: number): Float64Array {
  const bc = sc.torsionBC === 'fixed-fixed' ? 'fixed-fixed' : 'fixed-free';
  const ys = Float64Array.from(XS, (x) => waveModeShape(bc, i + 1, x));
  if (bc === 'fixed-free' && ys[NX - 1] < 0) for (let j = 0; j < NX; j++) ys[j] = -ys[j];
  return ys;
}

const ends = (sc: StudioScenario): [EndKind, EndKind] => (sc.bc === 'pinned-pinned' ? ['pin', 'pin'] : ['clamp', 'free']);
const torsionEnds = (sc: StudioScenario): [EndKind, EndKind] => (sc.torsionBC === 'fixed-fixed' ? ['clamp', 'clamp'] : ['clamp', 'free']);

const dimFmt = (sc: StudioScenario, v: number) => (sc.dim.unit === 'mm' ? `${fmt(v, 3)} mm` : `${fmt(v, 3)} m`);
const thickFmt = (sc: StudioScenario, v: number) => (sc.thick.ratio ? `${fmt(v, 2)} d` : `${fmt(v, 3)} mm`);
const mm = (m: number) => m * 1000;

export default function DesignStudio() {
  const progress = useProgress();
  const [id, setId] = useState<StudioId>('wing');
  const [designs, setDesigns] = useState<Record<StudioId, Design>>(() => ({
    wing: initialDesign(SCENARIOS.wing),
    blade: initialDesign(SCENARIOS.blade),
    shaft: initialDesign(SCENARIOS.shaft),
  }));
  const [step, setStep] = useState<Step>('size');
  const [speed, setSpeed] = useState(1);
  const [animate, setAnimate] = useState(true);
  const [view, setView] = useState<ModeView>('bending');

  const sc = SCENARIOS[id];
  const d = designs[id];
  const setDesign = (patch: Partial<Design>, which: StudioId = id) => setDesigns((p) => ({ ...p, [which]: { ...p[which], ...patch } }));

  // ------------------------------------------------------------------ derived values
  const W = useMemo(() => bendingOmegas(sc, dimSI(sc, d)), [sc, d]);
  const fB = W.map((w) => w / TAU);
  const fT = useMemo(() => torsionHzs(sc), [sc]);
  const fExc = excitationMax(sc) / TAU;
  const fReq = requiredOmega(sc) / TAU;
  const dMin = useMemo(() => minDim(sc), [sc]);
  const resp = useMemo(() => response(sc, d, speed), [sc, d, speed]);
  const worst = useMemo(() => worstCase(sc, d), [sc, d]);
  // The FE mass check lags slider drags slightly (deferred); indexing the deferred map by the current id keeps
  // the scenario and its design together when the scenario switches.
  const deferredDesigns = useDeferredValue(designs);
  const massIn = deferredDesigns[id];
  const mc = useMemo(() => massCheck(sc, massIn), [sc, massIn]);
  const ch = checks(sc, d, mc);
  const mb = memberMass(sc, d);
  const tNeed = Number.isFinite(worst.yMax) ? (d.thick * worst.yMax) / sc.limit : Infinity;

  const allOk = ch.freq && ch.amp && ch.mass;
  const wingDone = id === 'wing' && allOk;
  useEffect(() => {
    if (wingDone) completeChallenge(STUDIO_CHALLENGE);
  }, [wingDone]);

  // ------------------------------------------------------------------ curves
  const sizeCurve = useMemo(() => sample((x) => bendingOmegas(sc, x * sc.dim.toSI)[0] / TAU, sc.dim.min, sc.dim.max, 60), [sc]);
  const fHi = sizeCurve.y[sizeCurve.y.length - 1] * 1.04;
  const ladder = useMemo(() => {
    const top = Math.max(bendingOmegas(sc, sc.dim.max * sc.dim.toSI)[2] / TAU, ...(fT.length ? [fT[2]] : [0]));
    return { lo: fExc / 4, hi: top * 1.4 };
  }, [sc, fT, fExc]);
  const shapes = useMemo(() => [0, 1, 2].map((i) => unitShape(sc, i)), [sc]);
  const tShapes = useMemo(() => (fT.length ? [0, 1, 2].map((i) => torsionShape(sc, i)) : []), [sc, fT]);
  const speedCurve = useMemo(() => sample((s) => mm(response(sc, d, Math.max(s, 1e-4)).yMax), 0, 1.3, 260), [sc, d]);
  const yCap = Math.max(2.2 * mm(sc.limit), Number.isFinite(worst.yMax) ? 1.25 * mm(worst.yMax) : 0);
  const resonances = W.map((w, i) => ({ s: w / excitationMax(sc), i })).filter((r) => r.s > 0 && r.s < 1.3);
  const yAmp = Math.max(1.3 * mm(sc.limit), 1.15 * mm(resp.yMax));
  const respPts = useMemo(() => ({ x: XS, y: Float64Array.from(resp.y, mm) }), [resp]);

  // ------------------------------------------------------------------ animation (paths set through refs)
  const wrapRef = useRef<HTMLDivElement>(null);
  const phase = useRef(0);
  const modeRefs = [useRef<SVGPathElement>(null), useRef<SVGPathElement>(null), useRef<SVGPathElement>(null)];
  const torRefs = [useRef<SVGPathElement>(null), useRef<SVGPathElement>(null), useRef<SVGPathElement>(null)];
  const modeScales = [useRef<PlotScales | null>(null), useRef<PlotScales | null>(null), useRef<PlotScales | null>(null)];
  const respRef = useRef<SVGPathElement>(null);
  const respScales = useRef<PlotScales | null>(null);
  const pathOf = (src: ArrayLike<number>, c: number, s: PlotScales | null) => {
    if (!s) return '';
    let out = '';
    for (let j = 0; j < NX; j++) out += `${j ? 'L' : 'M'}${s.sx(XS[j]).toFixed(1)} ${s.sy(src[j] * c).toFixed(1)}`;
    return out;
  };
  useRaf(
    (dt) => {
      phase.current += dt * TAU * 0.55;
      const c = Math.cos(phase.current);
      if (step === 'modes') {
        for (let i = 0; i < 3; i++) {
          if (view !== 'torsion') modeRefs[i].current?.setAttribute('d', pathOf(shapes[i], c, modeScales[i].current));
          if (view !== 'bending' && tShapes[i]) torRefs[i].current?.setAttribute('d', pathOf(tShapes[i], c, modeScales[i].current));
        }
      } else if (step === 'response') {
        respRef.current?.setAttribute('d', pathOf(respPts.y, c, respScales.current));
      }
    },
    animate && (step === 'modes' || step === 'response'),
    wrapRef
  );

  // ------------------------------------------------------------------ actions
  const go = (which: StudioId, s: Step, patch?: Partial<Design>) => {
    setId(which);
    setStep(s);
    if (patch) setDesign(patch, which);
  };
  const snapMin = () => setDesign({ dim: Math.min(sc.dim.max, Math.ceil(dMin * 1000) / 1000) });
  const snapThick = () => {
    if (!Number.isFinite(tNeed)) return;
    const v = sc.thick.ratio ? Math.ceil(tNeed * 1e5) / 1e5 : Math.ceil(tNeed * 100) / 100;
    setDesign({ thick: Math.min(sc.thick.max, Math.max(sc.thick.min, v)) });
  };

  const dimLabel = `${sc.dim.tex} (${sc.dim.unit})`;
  const massBarData = [
    { x: 0, y: 1, color: 'var(--text-3)', label: 'beam 1' },
    ...mc.terms.map((t, k) => ({ x: k + 1, y: t, color: 'var(--m1)', label: `${sc.masses[k].id} ${fmt(t, 3)}` })),
  ];

  // ------------------------------------------------------------------ visual per step
  let visual: ReactNode;
  if (step === 'size') {
    visual = (
      <>
        <Plot x={{ min: sc.dim.min, max: sc.dim.max, label: dimLabel }} y={{ min: 0, max: fHi, label: 'f₁ (Hz)' }} height={240} ariaLabel="First natural frequency against the free dimension, with the requirement line">
          <Band x0={dMin} x1={sc.dim.max} color="var(--ok)" opacity={0.08} label="meets the margin" />
          <HLine y={fReq} color="var(--bad)" label={`required: ${sc.n} × ${fmt(fExc, 3)} Hz = ${fmt(fReq, 4)} Hz`} />
          <Line points={sizeCurve} color="var(--m1)" width={2.6} />
          <Dot x={dMin} y={fReq} color="var(--bad)" hollow />
          <PlotText x={dMin} y={fReq} dx={8} dy={18} color="var(--bad)">
            {`minimum ${sc.dim.tex} = ${dimFmt(sc, dMin)}`}
          </PlotText>
          <Handle x={d.dim} y={fB[0]} axis="x" clampX={[sc.dim.min, sc.dim.max]} onChange={(x) => setDesign({ dim: Math.round(x * (sc.dim.unit === 'mm' ? 1 : 1000)) / (sc.dim.unit === 'mm' ? 1 : 1000) })} color="var(--accent)" label="your design" labelPos="below" ariaLabel={`free dimension ${sc.dim.tex}`} />
        </Plot>
        <Plot x={{ min: ladder.lo, max: ladder.hi, log: true, label: 'frequency (Hz, log scale)' }} y={{ min: 0, max: 1, ticks: [] }} height={132} margin={{ l: 14 }} ariaLabel="Frequency ladder: excitation range, requirement and natural frequencies">
          <Band x0={ladder.lo} x1={fExc} color="var(--accent)" opacity={0.13} label="forcing range" />
          <VLine x={fReq} color="var(--bad)" label={`${sc.n}× forcing`} labelY="bottom" />
          {fB.map((f, i) => (
            <VLine key={`b${i}`} x={f} color={mcol(i)} dash={false} width={2.4} label={`f${SUB[i]}`} />
          ))}
          {fT.map((f, i) => (
            <VLine key={`t${i}`} x={f} color={mcol(i)} dash="2 3" width={1.6} label={`T${SUB[i]}`} labelY="bottom" />
          ))}
        </Plot>
        <Legend
          items={[
            { label: 'bending f₁–f₃ (move with the free dimension)', color: 'var(--text-2)' },
            ...(fT.length ? [{ label: 'torsion T₁–T₃ (do not move)', color: 'var(--text-2)', dash: true }] : []),
            { label: 'requirement', color: 'var(--bad)', dash: true },
          ]}
        />
      </>
    );
  } else if (step === 'modes') {
    const [l, r] = ends(sc);
    const [tl, tr] = torsionEnds(sc);
    visual = (
      <>
        {[0, 1, 2].map((i) => {
          const bn = beamNodes(sc.bc, i + 1);
          const tn = fT.length ? waveNodes(sc.torsionBC === 'fixed-fixed' ? 'fixed-fixed' : 'fixed-free', i + 1) : [];
          const showB = view !== 'torsion';
          const showT = view !== 'bending' && tShapes.length > 0;
          return (
            <Plot key={i} x={{ min: 0, max: 1, label: i === 2 ? 'x/L' : undefined, ticks: [0, 0.25, 0.5, 0.75, 1] }} y={{ min: -1.45, max: 1.45, ticks: [] }} height={i === 2 ? 132 : 112} margin={{ l: 22, r: 22, t: 18 }} ariaLabel={`Mode ${i + 1} sketch with nodes`}>
              {showB ? <PlotEnds left={l} right={r} /> : <PlotEnds left={tl} right={tr} />}
              {showB && <Line points={{ x: XS, y: shapes[i] }} color={mcol(i)} width={animate ? 1 : 2.6} opacity={animate ? 0.35 : 1} />}
              {showB && animate && <LivePath pathRef={modeRefs[i]} scalesRef={modeScales[i]} color={mcol(i)} width={2.6} />}
              {showT && <Line points={{ x: XS, y: tShapes[i] }} color={mcol(i)} width={animate ? 1 : 2} dash="6 4" opacity={animate ? 0.5 : 1} />}
              {showT && animate && <LivePath pathRef={torRefs[i]} scalesRef={modeScales[i]} color={mcol(i)} width={2} dash="6 4" />}
              {showB && bn.map((x) => <Dot key={`n${x}`} x={x} y={0} r={4} color="var(--text)" hollow label={`${fmt(x, 3)}L`} labelPos="above" />)}
              {showT && tn.map((x) => <Dot key={`t${x}`} x={x} y={0} r={3.5} color="var(--text-3)" />)}
              {showT &&
                tn.map((x) => (
                  <PlotText key={`tl${x}`} x={x} y={0} dy={16} anchor="middle" color="var(--text-3)">
                    {`T: ${fmt(x, 3)}L`}
                  </PlotText>
                ))}
              <PlotText x={0.01} y={1.45} dy={-5} color={mcol(i)}>
                {`Mode ${i + 1}: ${showB ? `bending f${SUB[i]} = ${fmt(fB[i], 4)} Hz${i ? ` (${fmt(fB[i] / fB[0], 4)} f₁)` : ''}` : ''}${showB && showT ? ' · ' : ''}${showT ? `torsion T${SUB[i]} = ${fmt(fT[i], 4)} Hz${i ? ` (${fmt(fT[i] / fT[0], 3)} T₁)` : ''}` : ''}`}
              </PlotText>
            </Plot>
          );
        })}
        <p className="muted small">
          Animation slowed to one speed for all modes; the labels give the real frequencies. Hollow circles mark the bending nodes{view !== 'bending' && fT.length ? '; grey dots the torsional nodes' : ''}.
        </p>
      </>
    );
  } else if (step === 'response') {
    const at = resp.at;
    visual = (
      <>
        <Plot x={{ min: 0, max: 1, label: 'x/L' }} y={{ min: -yAmp, max: yAmp, label: 'deflection (mm)' }} height={210} ariaLabel="Deflection amplitude along the member at the chosen speed, with the limit band">
          <HBand y0={-mm(sc.limit)} y1={mm(sc.limit)} color="var(--ok)" opacity={0.1} />
          <HLine y={mm(sc.limit)} color="var(--ok)" />
          <HLine y={-mm(sc.limit)} color="var(--ok)" />
          <PlotText x={0.03} y={mm(sc.limit)} dy={-5} color="var(--ok)">
            {`limit ±${fmt(mm(sc.limit), 3)} mm`}
          </PlotText>
          {sc.forces.map((x) => (
            <VLine key={x} x={x} color="var(--text-3)" label="load" labelY="bottom" />
          ))}
          <PlotEnds left={ends(sc)[0]} right={ends(sc)[1]} />
          <Line points={respPts} color="var(--text)" width={animate ? 1 : 2.6} opacity={animate ? 0.35 : 1} />
          {animate && <Line points={{ x: XS, y: Float64Array.from(respPts.y, (v) => -v) }} color="var(--text)" width={1} opacity={0.35} />}
          {animate && <LivePath pathRef={respRef} scalesRef={respScales} color="var(--text)" width={2.6} />}
          <Dot x={at} y={respPts.y[Math.round(at * (NX - 1))]} color={resp.yMax <= sc.limit ? 'var(--ok)' : 'var(--bad)'} label={`max ${fmt(mm(resp.yMax), 3)} mm`} labelPos={at > 0.7 ? 'left' : 'right'} />
        </Plot>
        <Plot x={{ min: 0, max: 1.3, label: `running speed / maximum (${sc.speedText})` }} y={{ min: 0, max: yCap, label: 'largest |y| (mm)' }} height={190} ariaLabel="Largest amplitude against running speed with the limit">
          <Band x0={0} x1={1} color="var(--accent)" opacity={0.07} label="running range" />
          {resonances.map((r) => (
            <VLine key={r.i} x={r.s} color={mcol(r.i)} label={`forcing = f${SUB[r.i]}`} />
          ))}
          <HLine y={mm(sc.limit)} color="var(--ok)" label="limit" />
          <Line points={speedCurve} color="var(--text)" width={2.2} />
          {Number.isFinite(worst.yMax) && <Dot x={worst.s} y={Math.min(yCap, mm(worst.yMax))} r={9} color={ch.amp ? 'var(--ok)' : 'var(--bad)'} hollow />}
          <Handle x={speed} y={Math.min(yCap, mm(resp.yMax))} axis="x" clampX={[0.02, 1.3]} onChange={(x) => setSpeed(Math.round(x * 100) / 100)} label="speed" ariaLabel="running speed" />
        </Plot>
        <p className="muted small" style={{ margin: 0 }}>
          Drag the speed point. The large ring marks the worst amplitude inside the running range: that is the value the design check uses.
        </p>
        <Plot x={{ min: 0.4, max: 3.6, ticks: [1, 2, 3], format: (v) => `mode ${v}` }} y={{ min: Math.min(0, ...resp.parts.map(mm)) * 1.25, max: Math.max(0, ...resp.parts.map(mm)) * 1.3 || 1, label: 'share at max (mm)' }} height={140} ariaLabel="Each mode's contribution at the point of largest deflection">
          <Bars width={0.5} bars={resp.parts.map((p, i) => ({ x: i + 1, y: mm(p), color: mcol(i), label: `${fmt((100 * Math.abs(p)) / (resp.parts.reduce((s, q) => s + Math.abs(q), 0) || 1), 3)} %` }))} />
        </Plot>
      </>
    );
  } else if (step === 'masses') {
    const bare = shapes[0];
    visual = (
      <>
        <Plot x={{ min: 0, max: 1, label: 'x/L' }} y={{ min: -0.35, max: 1.25, ticks: [] }} height={210} margin={{ l: 22, r: 22 }} ariaLabel="First mode without and with the added masses; drag the masses">
          <PlotEnds left={ends(sc)[0]} right={ends(sc)[1]} />
          <Line points={{ x: XS, y: bare }} color="var(--text-3)" width={2} dash />
          <Line points={{ x: XS, y: mc.shape }} color="var(--m1)" width={2.6} />
          {sc.masses.map((m, k) => {
            const x = d.massX[k];
            const y = mc.shape[Math.round(x * (NX - 1))];
            return (
              <g key={m.id}>
                <Handle x={x} y={y} axis="x" clampX={m.xRange} r={5 + 6 * Math.sqrt(Math.min(1, mc.mu[k]))} onChange={(nx) => setDesign({ massX: d.massX.map((v, j) => (j === k ? Math.round(nx * 100) / 100 : v)) })} ariaLabel={`${m.label} position`} />
                <PlotText x={x} y={y} dy={-18} anchor={x > 0.75 ? 'end' : x < 0.25 ? 'start' : 'middle'} color="var(--accent)">
                  {m.label}
                </PlotText>
              </g>
            );
          })}
        </Plot>
        <Legend
          items={[
            { label: 'bare mode 1 (Rayleigh’s trial shape)', color: 'var(--text-3)', dash: true },
            { label: 'mode 1 with the masses (FE)', color: 'var(--m1)' },
          ]}
        />
        <div className="row gap-s" style={{ alignItems: 'stretch' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Plot x={{ min: -0.6, max: sc.masses.length + 0.6, ticks: [] }} y={{ min: 0, max: Math.max(1.25, ...mc.terms.map((t) => t * 1.25)), label: '(ω₁₁/ω_kk)²' }} height={170} ariaLabel="Dunkerley terms: the beam and each mass">
              <Bars width={0.55} bars={massBarData} />
            </Plot>
          </div>
          <div style={{ flex: 1.2, minWidth: 0 }}>
            <Plot
              x={{ min: Math.min(fB[0] * mc.rD, fReq) * 0.85, max: Math.max(fB[0], fReq) * 1.15, label: 'f₁ (Hz)' }}
              y={{ min: 0.4, max: 4, ticks: [1, 1.8, 2.6, 3.4], format: (v) => (v < 1.4 ? 'Dunkerley' : v < 2.2 ? 'exact (FE)' : v < 3 ? 'Rayleigh' : 'bare') }}
              height={170}
              margin={{ l: 78 }}
              ariaLabel="First natural frequency: bare, Dunkerley, exact and Rayleigh, against the requirement"
            >
              <VLine x={fReq} color="var(--bad)" label="required" labelY="bottom" />
              <Dot x={fB[0]} y={3.4} color="var(--text-3)" label={fmt(fB[0], 4)} />
              <Dot x={fB[0] * mc.rR} y={2.6} color="var(--m1)" hollow label={fmt(fB[0] * mc.rR, 4)} />
              <Dot x={fB[0] * mc.rX} y={1.8} color="var(--m1)" label={fmt(fB[0] * mc.rX, 4)} />
              <Dot x={fB[0] * mc.rD} y={1.0} color="var(--m1)" hollow label={fmt(fB[0] * mc.rD, 4)} />
            </Plot>
          </div>
        </div>
      </>
    );
  } else {
    visual = <ValidityVisual sc={sc} d={d} w1={W[0]} />;
  }

  // ------------------------------------------------------------------ controls per step
  let stepControls: ReactNode;
  if (step === 'size') {
    stepControls = (
      <>
        <Slider label={sc.dim.name} tex={sc.dim.tex} tip={sc.dim.tip} value={d.dim} min={sc.dim.min} max={sc.dim.max} step={sc.dim.unit === 'mm' ? 1 : 0.01} unit={sc.dim.unit} sig={4} onChange={(v) => setDesign({ dim: v })} />
        <div className="row gap-s wrap">
          <Button size="sm" onClick={snapMin}>
            Snap to the minimum {sc.dim.tex}
          </Button>
        </div>
        <Readouts>
          <Readout tex="f_1" tip="first bending natural frequency" value={fB[0]} unit="Hz" tone="m1" />
          <Readout tex="f_2" tip="second: the ratio trick" value={fB[1]} unit="Hz" tone="m2" />
          <Readout tex="f_3" tip="third: the ratio trick" value={fB[2]} unit="Hz" tone="m3" />
          <Readout tex="f_{exc}" tip={`highest forcing frequency: ${sc.qText}`} value={fExc} unit="Hz" />
          <Readout tex="f_1/f_{exc}" tip={`margin achieved; required ${sc.n}`} value={fB[0] / fExc} sig={3} tone={ch.freq ? 'ok' : 'bad'} />
          <Readout tex={`${sc.dim.tex}_{min}`} tip="smallest free dimension meeting the requirement (ω₁ ∝ the dimension)" value={dMin} unit={sc.dim.unit} />
        </Readouts>
        <Rich className="note" text={`Requirement: ${sc.nText}. The thickness does not appear: in a thin ${sc.section === 'rect' ? 'rectangle' : 'tube'} stiffness and mass both scale with it.`} />
      </>
    );
  } else if (step === 'modes') {
    stepControls = (
      <>
        {fT.length > 0 && (
          <Segmented
            label="Which modes"
            value={view}
            onChange={setView}
            size="sm"
            options={[
              { value: 'bending', label: 'Bending' },
              { value: 'torsion', label: 'Torsion' },
              { value: 'both', label: 'Both' },
            ]}
          />
        )}
        <Toggle checked={animate} onChange={setAnimate} label="Animate" />
        <Readouts>
          {fB.map((f, i) => (
            <Readout key={i} tex={`f_${i + 1}`} tip={`bending mode ${i + 1}`} value={f} unit="Hz" tone={(['m1', 'm2', 'm3'] as const)[i]} />
          ))}
          {fT.map((f, i) => (
            <Readout key={`t${i}`} tex={`T_${i + 1}`} tip={`torsional mode ${i + 1}: c = √(G/ρ), independent of d and t`} value={f} unit="Hz" />
          ))}
        </Readouts>
        <Rich
          className="note"
          text={
            sc.bc === 'clamped-free'
              ? 'Cantilever: zero slope at the clamp, a straight sloping free end with the largest deflection, $n - 1$ interior nodes (0.783L; 0.504L, 0.868L). Spacing 1 : 6.27 : 17.55.' +
                (fT.length ? ' Torsion (fixed–free): pure sines leaving the root **with** a slope, flat at the tip, spaced 1 : 3 : 5.' : '')
              : 'Pinned–pinned: zero deflection and curvature at the bearings, pure sines $\\sin(i\\pi x/L)$, spaced 1 : 4 : 9. Torsion (fixed–fixed): the **same** sines but spaced 1 : 2 : 3.'
          }
        />
      </>
    );
  } else if (step === 'response') {
    stepControls = (
      <>
        <Toggle checked={animate} onChange={setAnimate} label="Animate the deflection" />
        <Slider label="running speed" tex="\Omega/\Omega_{max}" tip={`fraction of the maximum running speed (${sc.speedText}); forcing at ${sc.q} × this`} value={speed} min={0.02} max={1.3} step={0.01} sig={3} onChange={setSpeed} />
        <Slider label={sc.thick.name} tex={sc.thick.tex} tip={sc.thick.tip} value={d.thick} min={sc.thick.min} max={sc.thick.max} step={sc.thick.step} unit={sc.thick.unit || undefined} sig={sc.thick.ratio ? 2 : 3} format={sc.thick.ratio ? (v) => v.toFixed(4) : undefined} onChange={(v) => setDesign({ thick: v })} />
        <Readouts>
          <Readout tex="f_{exc}" tip="forcing frequency at this speed" value={resp.Omega / TAU} unit="Hz" />
          <Readout tex="P" tip={sc.forceKind === 'unbalance' ? 'unbalance force per rotor, me Ω²' : 'load amplitude'} value={resp.F} unit="N" />
          <Readout tex="S" label="× PL³/EI" tip="largest |y| in units of P L³/EI (sum of 3 modes with dynamic factors)" value={resp.S} sig={4} />
          <Readout tex="|y|_{max}" tip="largest amplitude along the member at this speed" value={mm(resp.yMax)} unit="mm" tone={resp.yMax <= sc.limit ? 'ok' : 'bad'} />
          <Readout tex="|y|_{worst}" tip="largest amplitude over the whole running range (worst speed)" value={mm(worst.yMax)} unit="mm" tone={ch.amp ? 'ok' : 'bad'} text={Number.isFinite(worst.yMax) ? undefined : 'resonance'} />
          <Readout tex={`${sc.thick.tex}_{min}`} tip="thickness that just meets the limit at the worst speed (amplitude ∝ 1/t)" value={tNeed} unit={sc.thick.unit || undefined} sig={3} text={Number.isFinite(tNeed) ? undefined : 'fix f₁ first'} />
          {sc.forceKind === 'constant' && <Readout tex="P_{max}" tip="largest load amplitude that meets the limit with this design" value={Number.isFinite(worst.yMax) ? ((sc.P ?? 0) * sc.limit) / worst.yMax : 0} unit="N" sig={3} />}
        </Readouts>
        <div className="row gap-s wrap">
          <Button size="sm" onClick={snapThick} disabled={!Number.isFinite(tNeed)}>
            Set {sc.thick.tex} to the minimum
          </Button>
        </div>
        <Rich className="note" text={`Loads: ${sc.forceText}. Limit: ${sc.limitText}. Bare-member modes, three of them, undamped.`} />
      </>
    );
  } else if (step === 'masses') {
    stepControls = (
      <>
        {sc.masses.map((m, k) => (
          <div key={m.id} className="stack" style={{ marginTop: 6 }}>
            <Slider
              label={m.label}
              tex={`M_{${m.id}}`}
              tip={m.unit === 'kg' ? `${m.label} mass in kg; μ = M/(ρAL) changes with your design` : `${m.label} as a % of the member’s mass`}
              value={d.massValues[k]}
              min={0}
              max={m.max}
              step={m.unit === 'kg' ? 0.1 : 1}
              unit={m.unit === 'kg' ? 'kg' : '%'}
              sig={3}
              onChange={(v) => setDesign({ massValues: d.massValues.map((x, j) => (j === k ? v : x)) })}
            />
            <Slider label="position" tex={`x_{${m.id}}/L`} tip="distance from the left end as a fraction of L (drag the circle on the plot too)" value={d.massX[k]} min={m.xRange[0]} max={m.xRange[1]} step={0.01} sig={2} onChange={(v) => setDesign({ massX: d.massX.map((x, j) => (j === k ? v : x)) })} />
          </div>
        ))}
        <Readouts>
          {mc.mu.map((m, k) => (
            <Readout key={k} tex={`\\mu_{${sc.masses[k].id}}`} tip={`${sc.masses[k].label}: M/(ρAL), with ρAL = ${fmt(mb, 3)} kg`} value={100 * m} unit="%" sig={3} />
          ))}
          <Readout label="Δf₁ (Dunkerley)" tip="100(ω_D/ω₁₁ − 1): a lower bound, so it overstates the drop" value={100 * (mc.rD - 1)} unit="%" sig={3} tone="m1" />
          <Readout label="Δf₁ (exact, FE)" tip="converged finite elements with the point masses" value={100 * (mc.rX - 1)} unit="%" sig={3} />
          <Readout tex="f_1" tip="first frequency with the masses, Dunkerley (conservative)" value={fB[0] * mc.rD} unit="Hz" tone={ch.mass ? 'ok' : 'bad'} />
        </Readouts>
        <Rich className="note" text={sc.massText} />
      </>
    );
  } else {
    stepControls = (
      <>
        <p className="small" style={{ margin: 0 }}>
          <strong>What this model assumes, and which way each assumption pushes the answer:</strong>
        </p>
        <ul className="small" style={{ paddingLeft: '1.2em', margin: '6px 0' }}>
          {sc.validity.map((v, k) => (
            <li key={k} style={{ margin: '5px 0' }}>
              <Rich text={`${v.what} → ${v.bias}.`} inline />
            </li>
          ))}
        </ul>
      </>
    );
  }

  const stepInfo = STEPS.find((s) => s.value === step)!;
  return (
    <div ref={wrapRef}>
      <SimLayout
        visual={
          <>
            <Segmented label="Template step" value={step} onChange={setStep} options={STEPS.map((s) => ({ value: s.value, label: s.label, title: s.title }))} />
            <div className="small muted">{stepInfo.title}</div>
            <MemberSketch sc={sc} dimText={dimFmt(sc, d.dim)} thickText={thickFmt(sc, d.thick)} mu={mc.mu} massX={d.massX} />
            {visual}
            {step !== 'validity' && (
              <div className="row gap-s">
                <Button size="sm" variant="ghost" onClick={() => setStep(STEPS[STEPS.findIndex((s) => s.value === step) + 1].value)}>
                  Next step →
                </Button>
              </div>
            )}
          </>
        }
        controls={
          <>
            <Segmented
              label="Scenario"
              value={id}
              onChange={(v) => setId(v)}
              size="sm"
              options={(['wing', 'blade', 'shaft'] as StudioId[]).map((k) => ({ value: k, label: SCENARIOS[k].short, title: SCENARIOS[k].title }))}
            />
            <Rich className="note" text={sc.blurb} />
            {stepControls}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 10 }}>
              <div className="small" style={{ fontWeight: 600, marginBottom: 2 }}>
                Design checks
              </div>
              <CheckLine ok={ch.freq} label="Frequency margin" detail={`f₁ = ${fmt(fB[0], 4)} Hz vs ${sc.n} × ${fmt(fExc, 3)} = ${fmt(fReq, 4)} Hz`} />
              <CheckLine ok={ch.amp} label="Amplitude" detail={Number.isFinite(worst.yMax) ? `worst ${fmt(mm(worst.yMax), 3)} mm vs limit ${fmt(mm(sc.limit), 3)} mm` : 'a resonance lies inside the running range'} />
              <CheckLine ok={ch.mass} label="Margin with the masses" detail={`Dunkerley f₁ = ${fmt(fB[0] * mc.rD, 4)} Hz (${fmt(100 * (mc.rD - 1), 3)} %)`} />
              {id === 'wing' && (
                <div style={{ marginTop: 6 }}>
                  <Badge tone={progress.challenges[STUDIO_CHALLENGE] ? 'ok' : 'warn'}>
                    {progress.challenges[STUDIO_CHALLENGE] ? '✓ Challenge done: the wing passes all three' : 'Challenge: make the wing pass all three checks'}
                  </Badge>
                </div>
              )}
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setDesigns((p) => ({ ...p, [id]: initialDesign(sc) }))}
            >
              Reset this design
            </Button>
          </>
        }
      />
      {id === 'wing' && allOk && (
        <Callout kind="ok" title="All three checks pass">
          <Rich text={`$w$ = ${dimFmt(sc, d.dim)}, $t$ = ${thickFmt(sc, d.thick)}: wing mass ${fmt(mb, 3)} kg, rotors ${fmt(100 * mc.mu[0], 3)} % and ${fmt(100 * mc.mu[1], 3)} % of it. Sizing with the masses included needs a wider wing than the bare-wing answer of the paper (${dimFmt(sc, dMin)}).`} />
        </Callout>
      )}
      <PredictReveal
        id="b6-studio-thick"
        question="eVTOL wing: you double the thickness $t$ and keep the width $w$. The first in-plane natural frequency…"
        options={['doubles', 'rises by √2', 'stays the same', 'halves']}
        answer={2}
        explain="In-plane, $EI = Etw^3/12$ and $\rho A = \rho wt$ both double, so $\omega_1 = (\beta_1L)^2\sqrt{EI/\rho AL^4}$ does not move. The amplitude halves instead ($y \propto 1/EI$ at fixed frequencies), which is why B2 sizes the frequency with $w$ and the amplitude with $t$."
        tryIt="open step 3 and watch f₁ in the design checks while the thickness slider doubles."
        onApply={() => go('wing', 'response', { thick: Math.min(SCENARIOS.wing.thick.max, designs.wing.thick * 2) })}
      />
      <PredictReveal
        id="b6-studio-diameter"
        question="Hydro shaft: double the tube diameter $d$. What happens to the first **bending** and first **torsional** frequencies?"
        options={['Both double', 'Bending doubles, torsion unchanged', 'Torsion doubles, bending unchanged', 'Neither changes']}
        answer={1}
        explain="Thin-tube bending: $\omega_i = (\beta_iL)^2(r/L^2)\sqrt{E/2\rho}$, proportional to $d$. Torsion of a uniform shaft: $f_n = nc/2L$ with $c = \sqrt{G/\rho}$; $J$ multiplies both $GJ$ and $\rho J$ and cancels (2021 B2.3, 2024 B2.4)."
        tryIt="on the frequency ladder (step 1), watch the solid bending lines move while the dashed torsion lines stay put."
        onApply={() => go('shaft', 'size', { dim: Math.min(SCENARIOS.shaft.dim.max, designs.shaft.dim * 2) })}
      />
      <PredictReveal
        id="b6-studio-speed"
        question="eVTOL wing below its first critical speed: the rotors speed up from 50 % to 100 % of maximum. The largest amplitude grows by a factor of…"
        options={['2 (∝ Ω)', 'exactly 4 (∝ Ω²)', 'more than 4', 'less than 4']}
        answer={2}
        explain="The unbalance force $me\Omega^2$ gives the factor 4, and the dynamic factor $1/(1 - \Omega^2/\omega_1^2)$ grows too (at the minimum width, from 1.04 to 1.19), so about 4.6. That is why the worst case is the top speed (2022 B2.3)."
        tryIt="in step 3, drag the speed handle from 0.5 to 1 and compare the readouts."
        onApply={() => {
          go('wing', 'response', { dim: Math.ceil(minDim(SCENARIOS.wing)) });
          setSpeed(1);
        }}
      />
      <PredictReveal
        id="b6-studio-masses"
        question="Size the wing exactly to the margin ($f_1 = 2.5 \times$ the top rotor speed) with the paper’s thickness, then add the two 5 kg rotors. Does the margin survive?"
        options={['Yes: masses add no stiffness, so f₁ stays', 'Only just: f₁ drops by a few %', 'No: f₁ drops by about 40 %']}
        answer={2}
        explain="On that wing ($w$ = 421 mm, $t$ = 4.5 mm: 9.1 kg) each rotor is about 55 % of the wing mass, not the 20 % the paper quotes. Dunkerley: $(\omega_{11}/\omega_D)^2 = 1 + 4.12 \times 0.55 \times (0.5^3 + 0.9^3) = 2.93$, so $f_1$ falls about 42 % and the margin is lost. Size with the masses included."
        tryIt="open step 4 and read the third design check."
        onApply={() => go('wing', 'masses', { dim: Math.ceil(minDim(SCENARIOS.wing)), thick: 4.52, massValues: [5, 5], massX: [0.5, 0.9] })}
      />
      <PredictReveal
        id="b6-studio-spin"
        question="The wind-turbine blade spins at $\Omega \approx 0.28\,\omega_1$ in operation. Compared with the non-rotating model, its real first bending frequency is…"
        options={['lower: rotation adds kinetic energy', 'about 4–5 % higher', 'about 30 % higher', 'the same']}
        answer={1}
        explain="Centrifugal tension adds strain energy: $\omega^2 \approx \omega_0^2 + 1.19\,\Omega^2$ for a uniform cantilever’s mode 1, so $\omega_1$ rises by $\sqrt{1 + 1.19 \times 0.28^2} - 1 \approx 4.5$ % (as the 2023 worked solution estimates). The non-rotating model is on the safe side for the frequency margin."
        tryIt="open step 5 of the blade at its minimum diameter and read the stiffening curve."
        onApply={() => go('blade', 'validity', { dim: Math.round(minDim(SCENARIOS.blade) * 100) / 100 })}
      />
    </div>
  );
}

/** Step 5 visuals: root flexibility (cantilevers), rotation stiffening (blade), rotor position (shaft). */
function ValidityVisual({ sc, d, w1 }: { sc: StudioScenario; d: Design; w1: number }) {
  const root = useMemo(() => (sc.bc === 'clamped-free' ? rootFlexCurve() : null), [sc]);
  const Ks = spinCoef();
  const spin = useMemo(() => sample((s) => Math.sqrt(1 + Ks * s * s), 0, 1, 60), [Ks]);
  const op = sc.OmegaMax / w1;
  const rotor = useMemo(() => {
    if (sc.id !== 'shaft') return null;
    const mu = d.massValues[0] / 100;
    return sample((x) => (x <= 0 ? 1 : feBeam({ left: 'pinned', right: 'pinned', nel: 12, masses: [{ x, M: mu }], nModes: 1 }).omega[0] / (Math.PI * Math.PI)), 0, 0.3, 18);
  }, [sc, d.massValues]);
  return (
    <>
      {root && (
        <Plot x={{ min: 0.1, max: 3162, log: true, label: 'root rotational stiffness k_θ L/EI (log)' }} y={{ min: 0, max: 1.08, label: 'f₁ / f₁(clamped)' }} height={210} ariaLabel="First frequency against root stiffness">
          <HLine y={1} color="var(--text-3)" label="rigid root (the model)" />
          <Line points={{ x: root.k, y: root.r }} color="var(--m1)" width={2.4} />
          <PlotText x={12} y={0.3} color="var(--text-2)">
            a flexible root lowers every frequency
          </PlotText>
        </Plot>
      )}
      {sc.id === 'blade' && (
        <Plot x={{ min: 0, max: 1, label: 'rotation speed Ω / ω₁' }} y={{ min: 0.98, max: 1.6, label: 'f₁(spinning) / f₁' }} height={190} ariaLabel="Rotation stiffening of the first bending mode">
          <Line points={spin} color="var(--m1)" width={2.4} />
          <Dot x={op} y={Math.sqrt(1 + Ks * op * op)} color="var(--m1)" label={`operating: +${fmt(100 * (Math.sqrt(1 + Ks * op * op) - 1), 2)} %`} labelPos="right" />
        </Plot>
      )}
      {rotor && (
        <Plot x={{ min: 0, max: 0.3, label: 'generator rotor position x/L (0 = on the bearing)' }} y={{ min: 0, max: 1.05, label: 'f₁ / f₁(bare)' }} height={210} ariaLabel="First bending frequency against rotor position">
          <Line points={rotor} color="var(--m1)" width={2.4} />
          <Dot x={0} y={1} color="var(--ok)" />
          <PlotText x={0.004} y={1} dy={20} color="var(--ok)">
            on the bearing: no change (a node of every bending mode)
          </PlotText>
        </Plot>
      )}
    </>
  );
}
