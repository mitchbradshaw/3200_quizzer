// Impact-hammer tip lab: tip stiffness and hammer mass set the contact time T (half-sine pulse), T sets the
// force spectrum, and the 10–20 dB drop sets which of the structure's modes are excited (2023 A3.1; LC1-3/4).
import { useMemo, useRef, useState } from 'react';
import { hammerContactDuration, halfSineSpectrum, spectrumDropFrequency } from '../../../physics/transducers';
import { useRaf } from '../../../anim/hooks';
import { Band, HLine, Line, LivePath, Plot, VLine, livePathD, sample, type AxisSpec, type PlotScales } from '../../../plot/Plot';
import { Badge, Button, Legend, Readout, Readouts, Segmented, SimLayout, Slider, Toggle } from '../../../ui/kit';
import { PredictReveal } from '../../../ui/PredictReveal';
import { Rich } from '../../../ui/Rich';
import { Ground } from '../../../ui/diagrams';
import { mulberry32 } from '../../../engine/rng';
import { CANTILEVER_RATIOS, PINNED_RATIOS, TIPS, halfSinePeak, halfSinePulse, type TipPreset } from '../physics';

const F_LO = 10;
const F_HI = 20000;
const NS = 480;
const MODE_COLORS = ['var(--m1)', 'var(--m2)', 'var(--m3)'];
const SUB = ['₁', '₂', '₃'];

const X_SPEC: AxisSpec = { min: F_LO, max: F_HI, log: true, label: 'frequency (Hz, log)' };
const Y_SPEC: AxisSpec = { min: -80, max: 15, label: 'force (dB re 1 N s)', ticks: [-80, -60, -40, -20, 0] };
const Y_COH: AxisSpec = { min: 0, max: 1.05, label: 'coherence γ²', ticks: [0, 0.5, 1] };

/** Fixed ragged noise pattern (±8 dB about the floor) so the floor looks measured but never jumps between renders. */
const RAG = (() => {
  const r = mulberry32(2023);
  return Array.from({ length: NS + 1 }, () => 10 ** ((r() * 2 - 1) * 0.4));
})();

const fmtHz = (f: number) => (f >= 1000 ? `${(f / 1000).toPrecision(3)} kHz` : `${f.toPrecision(3)} Hz`);

export default function HammerTips() {
  const [tipId, setTipId] = useState<TipPreset['id']>('rubber');
  const [mh, setMh] = useState(0.3); // hammer mass, kg
  const [kStr, setKStr] = useState(1e10); // local structure stiffness, N/m
  const [hit, setHit] = useState(1); // impulse relative to 1 N s
  const [floorDb, setFloorDb] = useState(-60);
  const [shape, setShape] = useState<'cantilever' | 'pinned'>('cantilever');
  const [f1, setF1] = useState(76);
  const [showCoh, setShowCoh] = useState(false);

  const tip = TIPS.find((t) => t.id === tipId)!;
  const tau = hammerContactDuration(mh, tip.k, kStr);
  const tauTipOnly = hammerContactDuration(mh, tip.k);
  const f10 = spectrumDropFrequency(tau, 10);
  const f20 = spectrumDropFrequency(tau, 20);
  const fz = 1.5 / tau;
  const peak = halfSinePeak(tau, hit);
  const plateau = 20 * Math.log10(hit);
  const noise = 10 ** (floorDb / 20);
  const ratios = shape === 'cantilever' ? CANTILEVER_RATIOS : PINNED_RATIOS;
  const modesHz = ratios.map((r) => r * f1);

  const level = (f: number) => 20 * Math.log10(hit * halfSineSpectrum(f, tau));
  const modeInfo = modesHz.map((f) => {
    const L = level(f) - plateau; // dB relative to the plateau
    const aboveFloor = level(f) - floorDb;
    const verdict = aboveFloor < 6 ? 'lost in noise' : L >= -10 ? 'well excited' : L >= -20 ? 'edge of range' : 'too weak';
    const tone: 'ok' | 'warn' | 'bad' = verdict === 'well excited' ? 'ok' : verdict === 'edge of range' ? 'warn' : 'bad';
    return { f, L, verdict, tone };
  });

  // Every tip's pulse and spectrum with the current hammer and structure (faint references).
  const all = useMemo(
    () =>
      TIPS.map((t) => {
        const T = hammerContactDuration(mh, t.k, kStr);
        return { id: t.id, T, spec: sample((f) => 20 * Math.log10(hit * halfSineSpectrum(f, T)), F_LO, F_HI, 360, true) };
      }),
    [mh, kStr, hit]
  );
  // Frame the selected pulse: at most 3× its duration and 2.5× its peak, so a long soft pulse is not squashed
  // flat by the steel spike (harder tips then shoot off the top, softer ones run off the right: same area).
  const tMax = Math.min(1.25 * Math.max(...all.map((a) => a.T)), 3 * tau) * 1000; // ms
  const fMax = Math.min(1.1 * Math.max(...all.map((a) => halfSinePeak(a.T, hit))), 2.5 * peak) / 1000; // kN
  const xPulse = useMemo<AxisSpec>(() => ({ min: 0, max: tMax, label: 'time (ms)' }), [tMax]);
  const yPulse = useMemo<AxisSpec>(() => ({ min: 0, max: fMax, label: 'force (kN)' }), [fMax]);
  const pulses = useMemo(() => all.map((a) => sample((tms) => halfSinePulse(tms / 1000, a.T, hit) / 1000, 0, tMax, 400)), [all, hit, tMax]);

  const measured = useMemo(() => {
    const s = sample((f) => hit * halfSineSpectrum(f, tau), F_LO, F_HI, NS, true);
    const db = new Float64Array(s.y.length);
    const coh = new Float64Array(s.y.length);
    for (let i = 0; i < s.y.length; i++) {
      const n = noise * RAG[i];
      db[i] = 10 * Math.log10(s.y[i] * s.y[i] + n * n);
      coh[i] = (s.y[i] * s.y[i]) / (s.y[i] * s.y[i] + n * n);
    }
    return { db: { x: s.x, y: db }, coh: { x: s.x, y: coh } };
  }, [hit, tau, noise]);

  // ---------------------------------------------------------------- animation (approach, slow-motion contact, rebound)
  const wrapRef = useRef<HTMLDivElement>(null);
  const hammerRef = useRef<SVGGElement>(null);
  const tipRef = useRef<SVGRectElement>(null);
  const flashRef = useRef<SVGCircleElement>(null);
  const tracePath = useRef<SVGPathElement>(null);
  const traceScales = useRef<PlotScales | null>(null);
  const dotRef = useRef<SVGCircleElement>(null);
  const clock = useRef(0);
  const CYCLE = 2.8;
  const CONTACT_X = 262; // structure face
  const TIP_W = 9;
  useRaf(
    (dt) => {
      clock.current = (clock.current + dt) % CYCLE;
      const c = clock.current;
      let front = 120; // x of the tip's front face
      let squish = 0;
      let p = -1; // contact progress 0..1
      if (c < 0.9) {
        const u = c / 0.9;
        front = 120 + (CONTACT_X - 120) * u * u;
      } else if (c < 1.8) {
        p = (c - 0.9) / 0.9;
        squish = 5 * Math.sin(Math.PI * p);
        front = CONTACT_X;
      } else if (c < 2.5) {
        const u = (c - 1.8) / 0.7;
        front = CONTACT_X - (CONTACT_X - 120) * (1 - (1 - u) * (1 - u));
      }
      hammerRef.current?.setAttribute('transform', `translate(${(front - TIP_W + squish - 200).toFixed(1)} 0)`);
      tipRef.current?.setAttribute('width', (TIP_W - squish).toFixed(1));
      flashRef.current?.setAttribute('opacity', p >= 0 ? (0.55 * Math.sin(Math.PI * p)).toFixed(2) : '0');
      const s = traceScales.current;
      if (s) {
        const tc = p >= 0 ? p * tau : c >= 1.8 ? tau : 0;
        const n = 48;
        const pts: [number, number][] = [];
        for (let i = 0; i <= n; i++) {
          const t = (tc * i) / n;
          pts.push([t * 1000, halfSinePulse(t, tau, hit) / 1000]);
        }
        tracePath.current?.setAttribute('d', c < 0.9 ? '' : livePathD(pts, s));
        const last = pts[pts.length - 1];
        dotRef.current?.setAttribute('cx', s.sx(last[0]).toFixed(1));
        dotRef.current?.setAttribute('cy', s.sy(last[1]).toFixed(1));
        dotRef.current?.setAttribute('opacity', p >= 0 ? '1' : '0');
      }
    },
    true,
    wrapRef
  );
  const slowMo = 0.9 / tau;

  const preset2023 = () => {
    setTipId('rubber');
    setMh(2.7);
    setKStr(1e10);
    setShape('cantilever');
    setF1(76);
    setHit(1);
    setFloorDb(-57); // the exam figure's ragged floor sits about 55–60 dB down
  };

  return (
    <div ref={wrapRef}>
      <SimLayout
        visual={
          <>
            <svg viewBox="0 0 360 140" className="anim" style={{ maxWidth: 520 }} role="img" aria-label="An instrumented hammer swings in, strikes the structure and rebounds">
              <Ground x={300} y={124} w={110} />
              <rect x={CONTACT_X} y={14} width={14} height={110} rx={2} fill="var(--surface-3)" stroke="var(--text-2)" />
              <text x={CONTACT_X + 20} y={30} className="plot-note">
                structure
              </text>
              <circle ref={flashRef} cx={CONTACT_X} cy={58} r={14} fill="var(--warn)" opacity={0} />
              <g ref={hammerRef} transform="translate(-89 0)">
                <line x1={182} y1={58} x2={120} y2={132} stroke="var(--text-2)" strokeWidth={5} strokeLinecap="round" />
                <rect x={160} y={44} width={40} height={28} rx={4} fill="var(--surface-2)" stroke="var(--text)" strokeWidth={1.8} />
                <rect ref={tipRef} x={200} y={50} width={TIP_W} height={16} rx={3} fill="var(--text-2)" />
              </g>
              <text x={8} y={16} className="plot-note">
                {tip.label} tip, {mh.toPrecision(2)} kg hammer: T = {(tau * 1000).toPrecision(3)} ms
              </text>
              <text x={8} y={32} className="plot-note">
                contact shown about {slowMo >= 1000 ? `${Math.round(slowMo / 100) / 10} thousand` : Math.round(slowMo)} times slower
              </text>
            </svg>
            <Plot x={xPulse} y={yPulse} height={190} ariaLabel="Force against time for each tip">
              {pulses.map((pts, i) => (
                <Line key={TIPS[i].id} points={pts} color={TIPS[i].id === tipId ? 'var(--text)' : 'var(--text-3)'} width={TIPS[i].id === tipId ? 2.4 : 1.2} opacity={TIPS[i].id === tipId ? 0.35 : 0.5} />
              ))}
              <LivePath pathRef={tracePath} scalesRef={traceScales} color="var(--text)" width={2.8} />
              <circle ref={dotRef} r={4.5} fill="var(--accent)" opacity={0} />
            </Plot>
            <Legend
              items={[
                { label: `${tip.label} tip: force during the contact (drawn live)`, color: 'var(--text)' },
                { label: 'other tips, same impulse: harder tips are taller and shorter (off the top)', color: 'var(--text-3)' },
              ]}
            />
            <Plot x={X_SPEC} y={Y_SPEC} height={250} ariaLabel="Force spectrum in decibels with the useful range and the structure's natural frequencies">
              <Band x0={F_LO} x1={Math.min(F_HI, f10)} color="var(--ok)" opacity={0.1} label="useful" />
              <Band x0={Math.min(F_HI, f10)} x1={Math.min(F_HI, f20)} color="var(--ok)" opacity={0.05} />
              {all.map((a) => (a.id === tipId ? null : <Line key={a.id} points={a.spec} color="var(--text-3)" width={1} opacity={0.45} />))}
              <Line points={measured.db} color="var(--text)" width={2.2} />
              {/* Neutral reference levels: orange and green are reserved for modes 2 and 3. */}
              <HLine y={plateau - 10} color="var(--text-2)" dash="8 4" label="−10 dB" />
              <HLine y={plateau - 20} color="var(--text-2)" dash="3 3" label="−20 dB" />
              <HLine y={floorDb} color="var(--text-3)" dash="1 4" />
              {modesHz.map((f, i) => (
                <VLine key={i} x={f} color={MODE_COLORS[i]} label={`f${i + 1}`} labelY={i % 2 ? 'bottom' : 'top'} width={2} />
              ))}
            </Plot>
            <Legend
              items={[
                { label: `${tip.label} tip (measured, with noise)`, color: 'var(--text)' },
                { label: 'other tips, same hammer', color: 'var(--text-3)' },
                { label: 'noise floor', color: 'var(--text-3)', dash: '1 3' },
                { label: 'f₁', color: 'var(--m1)' },
                { label: 'f₂', color: 'var(--m2)' },
                { label: 'f₃', color: 'var(--m3)' },
              ]}
            />
            {showCoh && (
              <Plot x={X_SPEC} y={Y_COH} height={150} ariaLabel="Expected coherence against frequency">
                <Line points={measured.coh} color="var(--text)" width={2} />
                {modesHz.map((f, i) => (
                  <VLine key={i} x={f} color={MODE_COLORS[i]} width={2} />
                ))}
              </Plot>
            )}
          </>
        }
        controls={
          <>
            <Segmented label="Hammer tip" value={tipId} onChange={setTipId} options={TIPS.map((t) => ({ value: t.id, label: t.label }))} />
            <Slider label="hammer mass" tex="m_h" tip="mass of the hammer head" value={mh} min={0.05} max={20} log unit="kg" sig={2} onChange={setMh} />
            <Slider label="structure stiffness" tex="k_{str}" tip="local contact stiffness of the structure (in series with the tip)" value={kStr} min={1e5} max={1e10} log unit="N/m" sig={2} onChange={setKStr} />
            <Slider label="hit strength" tex="I" tip="impulse of the hit, ∫F dt" value={hit} min={0.25} max={4} log unit="N s" sig={2} onChange={setHit} />
            <Slider label="noise floor" tex="N" tip="measurement noise level, dB re 1 N s" value={floorDb} min={-80} max={-30} step={1} unit="dB" sig={2} onChange={setFloorDb} />
            <Readouts>
              <Readout tex="T" tip="contact time π√(mₕ/k_c), 1/k_c = 1/k_tip + 1/k_str" value={tau * 1000} unit="ms" sig={3} />
              <Readout tex="F_{peak}" tip="peak force of the half-sine pulse, πI/(2T)" value={peak / 1000} unit="kN" sig={3} />
              <Readout tex="1/T" tip="the course’s bandwidth rule (LC1-3)" value={1 / tau >= 1000 ? 1 / tau / 1000 : 1 / tau} unit={1 / tau >= 1000 ? 'kHz' : 'Hz'} sig={3} />
              <Readout tex="f_{-10}" tip="spectrum 10 dB down (half-sine: 1.02/T)" value={f10 >= 1000 ? f10 / 1000 : f10} unit={f10 >= 1000 ? 'kHz' : 'Hz'} sig={3} tone="ok" />
              <Readout tex="f_{-20}" tip="spectrum 20 dB down (half-sine: 1.30/T)" value={f20 >= 1000 ? f20 / 1000 : f20} unit={f20 >= 1000 ? 'kHz' : 'Hz'} sig={3} />
              <Readout tex="f_{0}" label="first zero" tip="first zero of the half-sine force spectrum, at 1.5/T" value={fz >= 1000 ? fz / 1000 : fz} unit={fz >= 1000 ? 'kHz' : 'Hz'} sig={3} />
            </Readouts>
            <div className="small">
              <strong>Structure</strong>
            </div>
            <Segmented
              size="sm"
              label="Structure type"
              value={shape}
              onChange={setShape}
              options={[
                { value: 'cantilever', label: 'Cantilever 1 : 6.27 : 17.5' },
                { value: 'pinned', label: 'Pinned beam 1 : 4 : 9' },
              ]}
            />
            <Slider label="first natural frequency" tex="f_1" tip="first natural frequency of the structure" value={f1} min={10} max={2000} log unit="Hz" sig={3} onChange={setF1} />
            <div className="row gap-s wrap" aria-label="Force reaching each mode, relative to the plateau">
              {modeInfo.map((mi, i) => (
                <Badge key={i} tone={mi.tone} title={`mode ${i + 1}: force level relative to the low-frequency plateau`}>
                  {`${mi.tone === 'ok' ? '✓' : mi.tone === 'warn' ? '~' : '✗'} f${SUB[i]} = ${fmtHz(mi.f)}: ${mi.L.toFixed(1).replace('-', '−')} dB, ${mi.verdict}`}
                </Badge>
              ))}
            </div>
            <Toggle checked={showCoh} onChange={setShowCoh} label="Show the expected coherence" />
            <div className="row gap-s wrap">
              <span className="muted small">Preset:</span>
              <Button size="sm" onClick={preset2023}>
                2023 A3.1 cantilever, rubber tip
              </Button>
            </div>
            <Rich
              className="note"
              text={
                Math.abs(tau / tauTipOnly - 1) < 0.02
                  ? 'The tip is much softer than the structure, so the tip alone sets the contact time.'
                  : `The structure is soft enough to matter: it lengthens the contact by ${((tau / tauTipOnly - 1) * 100).toPrecision(2)} % (stiffnesses in series).`
              }
            />
            <p className="muted small">Tip stiffnesses are illustrative; the contact-time model T ≈ π√(m/k) is the Week 11 worked-solution model, not the reader’s.</p>
          </>
        }
      />
      <PredictReveal
        id="c1-ham-2023"
        question="A light cantilever has modes at 76, 478 and 1340 Hz. A heavy hammer with a soft rubber tip gives a spectrum that is 10 dB down at about 113 Hz. How many of the three natural frequencies can be determined reliably?"
        options={['only the first', 'the first two', 'all three']}
        answer={0}
        explain="Mode 1 sits about 4 dB down, inside the useful range. At 478 and 1340 Hz the force is about 42 and 55 dB down (0.8 % and 0.2 % of the plateau, the second right on the exam figure’s noise floor), so those modes get almost no input and their response peaks barely rise out of the measurement noise. This is 2023 A3.1(b); a useful range “to the 50 dB decay” (option a) is the trap."
        tryIt="press the 2023 A3.1 preset and read the three mode badges."
        onApply={preset2023}
      />
      <PredictReveal
        id="c1-ham-steel"
        question="Keep that heavy hammer but swap the rubber tip for **steel**. How many of the three modes are now inside the useful range?"
        options={['still only one', 'two', 'all three']}
        answer={2}
        explain="The steel tip is about 400 times stiffer, so the contact is 20 times shorter (0.45 ms): the spectrum is now 10 dB down only at about 2.2 kHz, beyond 1340 Hz. A harder tip extends the range; it never reduces it (2023 A3.1(e) is false)."
        tryIt="from the 2023 preset, choose the Steel tip."
        onApply={() => {
          preset2023();
          setTipId('steel');
        }}
      />
      <PredictReveal
        id="c1-ham-mass"
        question="Make the hammer **four times heavier**, same tip. The useful frequency range…"
        options={['doubles', 'halves', 'falls to a quarter', 'does not change: the tip sets it']}
        answer={1}
        explain="The contact lasts half a period of the hammer mass on the tip stiffness, $T \approx \pi\sqrt{m_h/k}$, so ×4 mass doubles $T$ and halves the bandwidth $\approx 1/T$. The reader’s rule: a heavier hammer means a longer impact and a narrower range (LC1-4)."
        tryIt="note f₋₁₀, then quadruple the hammer mass."
        onApply={() => setMh((m) => Math.min(20, m * 4))}
      />
      <PredictReveal
        id="c1-ham-series"
        question="A **rubber** tip strikes a stiff steel frame. Make the frame's local stiffness **ten times lower** (still far stiffer than the rubber). The contact time…"
        options={['barely changes', 'grows by √10 ≈ 3.2 times', 'gets shorter']}
        answer={0}
        explain="Tip and structure deform in series: $1/k_c = 1/k_{tip} + 1/k_{str}$, so the **much softer** element sets $k_c$ and the contact time. That is why “the structure’s stiffness matters unless the tip is much **softer**” is true (official 2018/2019 A3.5(c)), and the “much **stiffer**” version is the incorrect statement (official 2017 A3.5(c) = 2022 A3.2(c)). Try the same change with a steel tip: now the structure is no longer negligible and T grows."
        tryIt="choose Rubber, note T, then drag the structure stiffness down one decade; repeat with Steel."
        onApply={() => {
          setTipId('rubber');
          setKStr(1e9);
        }}
      />
      <PredictReveal
        id="c1-ham-harder"
        question="Hit **twice as hard** with the same tip. What changes?"
        options={['the useful range doubles', 'nothing at all', 'the spectrum keeps its shape but sits 6 dB higher above the noise, so coherence improves']}
        answer={2}
        explain="In this linear contact model the duration, and so the shape of the spectrum, does not depend on how hard you hit: twice the impulse is +6 dB everywhere. The −10/−20 dB points do not move, but more of the spectrum clears the noise floor. The FRF itself does not change, because each hit is normalised by its measured force (Week 12 Q4)."
        tryIt="turn on the coherence plot, then double the hit strength."
        onApply={() => {
          setShowCoh(true);
          setHit((h) => Math.min(4, h * 2));
        }}
      />
    </div>
  );
}
