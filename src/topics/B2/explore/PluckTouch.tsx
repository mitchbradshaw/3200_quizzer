// Pluck a string, then touch it lightly or press it firmly: which harmonics survive? (2022 B1.2; LB2 Eq 2.11)
// The animation is the exact mode sum of the surviving modes; the bar chart is the spectrum |D_n|.
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as RPointerEvent } from 'react';
import { pluckAmplitudes } from '../../../physics/waves';
import { useRaf } from '../../../anim/hooks';
import { Bars, Plot, VLine } from '../../../plot/Plot';
import { Ground, svgPoint } from '../../../ui/diagrams';
import { Badge, Button, Callout, Readout, Readouts, Segmented, SimLayout, Slider, modeColor } from '../../../ui/kit';
import { PredictReveal } from '../../../ui/PredictReveal';
import { Rich } from '../../../ui/Rich';
import { completeChallenge, useProgress } from '../../../app/store';
import { lowestAlive, pluckSpectrum, type Finger } from '../physics';

export const OCTAVE_CHALLENGE = 'b2-octave';

const FINGER_POS: { value: number; label: string }[] = [
  { value: 1 / 2, label: 'L/2' },
  { value: 1 / 3, label: 'L/3' },
  { value: 1 / 4, label: 'L/4' },
  { value: 1 / 5, label: 'L/5' },
  { value: 2 / 5, label: '2L/5' },
];
const PLUCK_PRESETS: { value: number; label: string }[] = [
  { value: 1 / 2, label: 'L/2' },
  { value: 1 / 3, label: 'L/3' },
  { value: 1 / 4, label: 'L/4' },
  { value: 0.02, label: 'near the end' },
];
const MODE_TONES = ['m1', 'm2', 'm3'] as const;
const NM = 40; // modes summed in the animation
const NB = 12; // spectrum range (multiples of f1)
const W = 600;
const H = 150;
const X0 = 40;
const X1 = 560;
const Y0 = 82;
const AMP = 52;
const XS = Array.from({ length: 161 }, (_, i) => i / 160);
const X = (xi: number) => X0 + (X1 - X0) * xi;
const fracLabel = (v: number) => FINGER_POS.find((p) => Math.abs(p.value - v) < 1e-9)?.label ?? `${v.toFixed(2)}L`;

export default function PluckTouch() {
  const p = useProgress();
  const [a, setA] = useState(0.25);
  const [finger, setFinger] = useState<Finger>('none');
  const [fc, setFc] = useState(0.5);
  const [f1, setF1] = useState(220);
  const [playing, setPlaying] = useState(true);
  const spec = useMemo(() => pluckSpectrum(a, finger, fc, NM), [a, finger, fc]);
  const low = lowestAlive(spec);
  const amps = useMemo(() => pluckAmplitudes(a, 2), [a]);
  const heard = spec.partials.filter((q) => q.alive && q.ratio <= NB + 1e-9);
  const missing = finger === 'none' ? spec.partials.filter((q) => !q.alive && q.n <= NB).map((q) => q.n) : [];
  const solved = finger === 'touch' && !!low && Math.abs(low.ratio - 2) < 1e-9 && Math.abs(low.amp) > 0.05;
  const done = !!p.challenges[OCTAVE_CHALLENGE];

  // Sampled modal shapes of the surviving modes (amplitude included), recomputed only when the set-up changes.
  const basis = useMemo(() => {
    const [s0, s1] = spec.seg;
    const len = s1 - s0;
    return spec.partials
      .filter((q) => q.alive)
      .map((q) => {
        const arr = new Float64Array(XS.length);
        for (let i = 0; i < XS.length; i++) {
          const xi = XS[i];
          arr[i] = xi < s0 || xi > s1 ? 0 : q.amp * Math.sin(q.n * Math.PI * ((xi - s0) / len));
        }
        return { w: q.ratio, arr };
      });
  }, [spec]);

  // ---- animation (refs only): y(x, t) = sum D_n phi_n(x) cos(w_n t), slowed so f1 shows at 0.3 Hz
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const t = useRef(0);
  const cosBuf = useRef(new Float64Array(NM));
  useEffect(() => {
    t.current = 0;
  }, [spec]);
  useRaf(
    (dt) => {
      if (playing) t.current += dt;
      const cb = cosBuf.current;
      for (let k = 0; k < basis.length; k++) cb[k] = Math.cos(2 * Math.PI * 0.3 * basis[k].w * t.current);
      let d = '';
      for (let i = 0; i < XS.length; i++) {
        let y = 0;
        for (let k = 0; k < basis.length; k++) y += basis[k].arr[i] * cb[k];
        d += `${i ? 'L' : 'M'}${X(XS[i]).toFixed(1)} ${(Y0 - AMP * y).toFixed(1)}`;
      }
      pathRef.current?.setAttribute('d', d);
    },
    true,
    wrapRef
  );

  // ---- pluck handle: drag along the string, or arrow keys
  const dragging = useRef(false);
  const setPluck = (v: number) => setA(Math.min(0.98, Math.max(0.02, Math.round(v * 100) / 100)));
  const onPointer = (e: RPointerEvent<SVGGElement>, phase: 'down' | 'move' | 'up') => {
    if (phase === 'down') {
      dragging.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    if (!dragging.current || !svgRef.current) return;
    const pt = svgPoint(svgRef.current, e.clientX, e.clientY);
    setPluck((pt.x - X0) / (X1 - X0));
    if (phase === 'up') dragging.current = false;
  };
  const onKey = (e: KeyboardEvent<SVGGElement>) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') setPluck(a + (e.shiftKey ? 0.05 : 0.01));
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') setPluck(a - (e.shiftKey ? 0.05 : 0.01));
    else return;
    e.preventDefault();
  };

  // initial (plucked) shape on the vibrating segment, drawn as a dashed reference
  const [s0, s1] = finger === 'press' ? spec.seg : [0, 1];
  const ghost = `${X(s0)},${Y0} ${X(a)},${Y0 - AMP} ${X(s1)},${Y0}`;
  const bars = spec.partials
    .filter((q) => q.ratio <= NB + 0.5)
    .map((q) => ({
      x: q.ratio,
      y: Math.abs(q.amp),
      color: q.alive ? (q.n <= 3 ? modeColor(q.n) : 'var(--text-2)') : 'var(--border)',
      label: q.alive ? undefined : Math.abs(q.amp) > 1e-9 ? '×' : '0',
    }));

  const lowHz = low ? low.ratio * f1 : NaN;
  const ratioText = low ? (Math.abs(low.ratio - Math.round(low.ratio)) < 1e-9 ? `× ${Math.round(low.ratio)}` : `× ${low.ratio.toFixed(3)}`) : '—';
  const story = !low
    ? `**Near silence.** No mode excited by this pluck has a node at the finger, so the light touch damps them all.`
    : finger === 'touch'
      ? `**Light touch at ${fracLabel(fc)}:** it forces a node there, so only modes with a node at the finger survive. The lowest that the pluck excited is mode ${low.n}: you hear ${lowHz.toFixed(1)} Hz (${ratioText} the open string).`
      : finger === 'press'
        ? `**Firm press at ${fracLabel(fc)}:** a new fixed end. The plucked part is ${(spec.seg[1] - spec.seg[0]).toFixed(3)}L long, so it sounds ${lowHz.toFixed(1)} Hz and its own harmonics: not harmonics of the open string.`
        : `**Plucked at ${a.toFixed(2)}L.** ${missing.length ? `Missing (a node at the pluck point): mode${missing.length > 1 ? 's' : ''} ${missing.join(', ')}.` : 'No mode up to 12 has a node exactly at the pluck point.'} The pitch stays at $f_1$ = ${f1} Hz wherever you pluck.`;

  return (
    <div ref={wrapRef}>
      <SimLayout
        visual={
          <>
            <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="anim" role="img" aria-label="A plucked string between two fixed ends, with an optional finger">
              <Ground x={X0} y={Y0} w={90} vertical side="left" />
              <Ground x={X1} y={Y0} w={90} vertical side="right" />
              <line x1={X0} x2={X1} y1={Y0} y2={Y0} stroke="var(--border)" strokeDasharray="3 5" />
              <polyline points={ghost} fill="none" stroke="var(--text-3)" strokeDasharray="5 4" strokeWidth={1.4} />
              <path ref={pathRef} fill="none" stroke="var(--m1)" strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
              {finger !== 'none' && (
                <g aria-hidden="true">
                  <rect x={X(fc) - 8} y={Y0 - (finger === 'press' ? 30 : 40)} width={16} height={finger === 'press' ? 30 : 24} rx={7} fill="var(--surface-3)" stroke="var(--accent)" strokeWidth={2} />
                  <text x={X(fc)} y={Y0 - (finger === 'press' ? 36 : 46)} textAnchor="middle" className="plot-note">
                    {finger === 'press' ? 'press' : 'touch'}
                  </text>
                </g>
              )}
              <g
                className="handle"
                tabIndex={0}
                role="slider"
                aria-label="Pluck position"
                aria-valuemin={0.02}
                aria-valuemax={0.98}
                aria-valuenow={a}
                onPointerDown={(e) => onPointer(e, 'down')}
                onPointerMove={(e) => onPointer(e, 'move')}
                onPointerUp={(e) => onPointer(e, 'up')}
                onKeyDown={onKey}
                style={{ cursor: 'ew-resize', touchAction: 'none' }}
              >
                <circle cx={X(a)} cy={Y0 - AMP} r={16} fill="transparent" />
                <circle cx={X(a)} cy={Y0 - AMP} r={7} fill="var(--surface)" stroke="var(--accent)" strokeWidth={3} />
                <text x={X(a)} y={Y0 - AMP - 12} textAnchor="middle" className="plot-note">
                  pluck
                </text>
              </g>
              <text x={X0} y={H - 6} className="plot-note">
                dashed: the plucked shape at release
              </text>
            </svg>
            <Plot
              x={{ min: 0, max: NB + 0.6, label: 'frequency ÷ f₁ (open-string harmonics at whole numbers)', ticks: Array.from({ length: NB }, (_, i) => i + 1) }}
              y={{ min: 0, max: 0.9, label: '|Dₙ| / h', ticks: [0, 0.2, 0.4, 0.6, 0.8] }}
              height={210}
              ariaLabel="Spectrum: amplitude of each mode that sounds"
            >
              <Bars bars={bars} width={0.42} />
              {low && <VLine x={low.ratio} color="var(--accent)" label="pitch" />}
            </Plot>
            <Rich className="note" text="Bars: modal amplitude per unit pluck height. Coloured bars sound; **×** marks a mode the pluck excited but the light touch kills; **0** marks a mode with a node at the pluck point. The animation sums the surviving modes exactly (40 modes), slowed down." />
          </>
        }
        controls={
          <>
            <Slider label="pluck point" tex="a/L" tip="where the string is pulled aside, as a fraction of its length (drag the handle too)" value={a} min={0.02} max={0.98} step={0.01} sig={3} onChange={setPluck} />
            <div className="row gap-s wrap">
              <span className="muted small">Pluck at:</span>
              <Segmented size="sm" label="Pluck presets" value={PLUCK_PRESETS.find((q) => Math.abs(q.value - a) < 1e-9)?.value ?? -1} onChange={setA} options={PLUCK_PRESETS} />
            </div>
            <div>
              <div className="muted small">Finger</div>
              <Segmented
                label="Finger"
                value={finger}
                onChange={setFinger}
                options={[
                  { value: 'none', label: 'none' },
                  { value: 'touch', label: 'light touch' },
                  { value: 'press', label: 'firm press' },
                ]}
              />
            </div>
            {finger !== 'none' && (
              <div className="row gap-s wrap">
                <span className="muted small">Finger at:</span>
                <Segmented size="sm" label="Finger position" value={fc} onChange={setFc} options={FINGER_POS} />
              </div>
            )}
            <Slider label="open-string pitch" tex="f_1" tip="fundamental of the open string (Hz)" value={f1} min={80} max={440} step={1} unit="Hz" onChange={setF1} />
            <Readouts>
              <Readout tex="f_{low}" tip="lowest frequency that sounds" value={lowHz} unit="Hz" text={low ? undefined : 'silent'} tone={low && low.n <= 3 && finger !== 'press' ? MODE_TONES[low.n - 1] : undefined} />
              <Readout label="pitch" text={ratioText} />
              <Readout tex="D_2/D_1" tip="mode-2 amplitude relative to mode 1 from the pluck alone: sin(2πa/L)/(4 sin(πa/L))" value={amps[1] / amps[0]} sig={3} />
              <Readout label="modes heard ≤ 12 f₁" text={String(heard.length)} />
            </Readouts>
            <Callout kind={low ? 'info' : 'warn'}>
              <Rich text={story} />
            </Callout>
            <div className="row gap-s wrap">
              <Button size="sm" variant="primary" onClick={() => (t.current = 0)}>
                Pluck again
              </Button>
              <Button size="sm" onClick={() => setPlaying((v) => !v)}>
                {playing ? 'Pause' : 'Play'}
              </Button>
            </div>
            <Callout kind="info" title="Challenge">
              <Rich text="Make the **octave** ($2f_1$) the lowest tone, using a light touch." />
              <div className="row gap-s wrap">
                <Button size="sm" onClick={() => solved && completeChallenge(OCTAVE_CHALLENGE)} disabled={!solved || done}>
                  {done ? '✓ Challenge complete' : solved ? 'Submit: octave found' : 'Not the octave yet'}
                </Button>
                {done && <Badge tone="ok">Pluck at an antinode of mode 2 (L/4), touch at its node (L/2).</Badge>}
              </div>
            </Callout>
          </>
        }
      />
      <PredictReveal
        id="b2-pl-octave"
        question="Open string 220 Hz. Pluck at $L/4$ and touch lightly at $L/2$. What do you hear?"
        options={['220 Hz', '330 Hz', '440 Hz', 'Almost nothing']}
        answer={2}
        explain="The touch at $L/2$ forces a node there, so only the even modes survive, and $L/4$ is an antinode of mode 2 ($D_2/D_1$ = 0.354). The lowest survivor is mode 2: 440 Hz, the octave (2022 B1.2)."
        tryIt="set pluck L/4, light touch at L/2."
        onApply={() => {
          setF1(220);
          setA(0.25);
          setFinger('touch');
          setFc(0.5);
        }}
      />
      <PredictReveal
        id="b2-pl-silence"
        question="Now pluck at the **middle** and touch lightly at $L/4$. What do you hear?"
        options={['220 Hz', '440 Hz', '880 Hz', 'Almost nothing']}
        answer={3}
        explain="A mid-span pluck excites only the odd modes. A touch at $L/4$ keeps only modes 4, 8, 12, …, which are even and were never excited, so nothing survives: near silence (the 2022 B1.2 distractor)."
        tryIt="pluck at L/2 with a light touch at L/4."
        onApply={() => {
          setF1(220);
          setA(0.5);
          setFinger('touch');
          setFc(0.25);
        }}
      />
      <PredictReveal
        id="b2-pl-pitch"
        question="No finger. Move the pluck point from $L/2$ to $L/4$. Does the pitch change?"
        options={['Yes, it rises', 'Yes, it falls', 'No: only the mix of harmonics changes']}
        answer={2}
        explain="Plucking is an initial condition: it sets the amplitudes $D_n$, never the frequencies. At $L/4$ every fourth mode is missing and mode 2 appears ($D_2/D_1$ = 0.35); the lowest frequency stays $f_1$."
        tryIt="finger none, compare pluck L/2 and L/4 in the spectrum."
        onApply={() => {
          setFinger('none');
          setA(0.25);
        }}
      />
      <PredictReveal
        id="b2-pl-press"
        question="Press **firmly** at $L/3$ and pluck the longer part at its middle (open string 220 Hz). Lowest frequency?"
        options={['220 Hz', '330 Hz', '660 Hz', 'Almost nothing']}
        answer={1}
        explain="A firm press is a new fixed end: the plucked part is a string of length $2L/3$, so it sounds $220 \times 3/2$ = 330 Hz (then 990 Hz, …). A light touch at $L/3$ would have kept only modes 3, 6, …, all of which have a node at the pluck point $2L/3$: near silence."
        tryIt="firm press at L/3, pluck at 0.67."
        onApply={() => {
          setF1(220);
          setFinger('press');
          setFc(1 / 3);
          setA(2 / 3);
        }}
      />
    </div>
  );
}
