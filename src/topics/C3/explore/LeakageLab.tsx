// FFT lab: up to three tones, an adjustable sampling rate, record length and window. Shows the one-sided
// spectrum (lines, true tones, aliases), the windowed record, and the joint where the record meets its own
// repeat (what the DFT assumes), with cycles-in-record and the reading error of each tone.
import { useDeferredValue, useMemo, useState } from 'react';
import { amplitudeSpectrum, coherentGain, windowFn } from '../../../physics/dsp';
import { aliasInfo } from '../physics';
import { Dot, Line, Plot, PlotText, VLine, usePlot } from '../../../plot/Plot';
import { Badge, Button, Callout, Legend, More, Readout, Readouts, Segmented, SimLayout, Slider, Toggle } from '../../../ui/kit';
import { PredictReveal } from '../../../ui/PredictReveal';
import { completeChallenge, useProgress } from '../../../app/store';
import { Rich } from '../../../ui/Rich';
import { fmt } from '../../../engine/format';

export const LEAK_CHALLENGE = 'c3-leakage-repair';

type Win = 'rect' | 'hann' | 'flattop';
interface Tone {
  f: number;
  A: number;
}
interface Setup {
  fs: number;
  T: number;
  tones: Tone[];
  win?: Win;
  correct?: boolean;
}
const COLORS = ['var(--m1)', 'var(--m2)', 'var(--m3)'];
const WIN_LABEL: Record<Win, string> = { rect: 'rectangular', hann: 'Hann', flattop: 'flat-top' };
const EXAM: Tone[] = [
  { f: 7.4, A: 2.6 },
  { f: 15, A: 1.5 },
  { f: 23, A: 0.8 },
];
const BAD: Setup = { fs: 40, T: 8.1, tones: EXAM };
const FIXED: Setup = { fs: 100, T: 5, tones: EXAM };
const T2024: Tone[] = [
  { f: 10, A: 1 },
  { f: 13, A: 1 },
  { f: 30, A: 1 },
];
const CE1: Setup = {
  fs: 15,
  T: 2,
  tones: [
    { f: 1, A: 3 },
    { f: 4, A: 1 },
    { f: 7, A: 2 },
  ],
};
const HALF: Setup = {
  fs: 40,
  T: 8.1,
  tones: [
    { f: 15, A: 1.5 },
    { f: 5, A: 0 },
    { f: 10, A: 0 },
  ],
};

/** Every spectral line as one path (fast even for thousands of lines). */
function LinesPath({ f, a, color }: { f: ArrayLike<number>; a: ArrayLike<number>; color: string }) {
  const { sx, sy, clip, yAxis } = usePlot();
  const lo = yAxis.log ? yAxis.min : 0;
  const yb = sy(lo).toFixed(1);
  const showDots = f.length <= 220;
  let d = '';
  let dots = '';
  for (let i = 0; i < f.length; i++) {
    const v = Math.max(a[i], lo);
    const px = sx(f[i]).toFixed(1);
    const py = Math.max(-50, sy(v)).toFixed(1);
    d += `M${px} ${yb}V${py}`;
    if (showDots && a[i] > lo * 1.0001) dots += `M${px} ${py}m-2.2 0a2.2 2.2 0 1 0 4.4 0a2.2 2.2 0 1 0 -4.4 0`;
  }
  return (
    <g clipPath={`url(#${clip})`} pointerEvents="none">
      <path d={d} stroke={color} strokeWidth={1.3} fill="none" />
      {showDots && <path d={dots} fill={color} stroke="none" />}
    </g>
  );
}

/** The window as a continuous function of u = t/T in [0, 1] (same periodic forms as physics/dsp windowFn). */
function winAt(kind: Win, u: number): number {
  const t = 2 * Math.PI * u;
  if (kind === 'rect') return 1;
  if (kind === 'hann') return 0.5 - 0.5 * Math.cos(t);
  return 0.21557895 - 0.41663158 * Math.cos(t) + 0.277263158 * Math.cos(2 * t) - 0.083578947 * Math.cos(3 * t) + 0.006947368 * Math.cos(4 * t);
}

const same = (a: Tone[], b: Tone[]) => a.length === b.length && a.every((t, i) => Math.abs(t.f - b[i].f) < 1e-9 && Math.abs(t.A - b[i].A) < 1e-9);

export default function LeakageLab() {
  const progress = useProgress();
  const done = !!progress.challenges[LEAK_CHALLENGE];
  const [fs, setFs] = useState(BAD.fs);
  const [T, setT] = useState(BAD.T);
  const [tones, setTones] = useState<Tone[]>(BAD.tones);
  const [win, setWin] = useState<Win>('rect');
  const [correct, setCorrect] = useState(true);
  const [dB, setDB] = useState(false);
  const [hover, setHover] = useState<number | null>(null);

  const N = Math.max(8, Math.round(fs * T));
  const Teff = N / fs;
  const nyq = fs / 2;

  const inputs = useMemo(() => ({ fs, N, tones, win }), [fs, N, tones, win]);
  const d = useDeferredValue(inputs);
  const calc = useMemo(() => {
    const x = new Float64Array(d.N);
    for (let n = 0; n < d.N; n++) {
      let s = 0;
      for (const t of d.tones) if (t.A > 0) s += t.A * Math.sin((2 * Math.PI * t.f * n) / d.fs);
      x[n] = s;
    }
    const w = windowFn(d.win, d.N);
    return { x, w, spec: amplitudeSpectrum(x, d.fs, d.win), cg: coherentGain(w), N: d.N, fs: d.fs };
  }, [d]);
  const scale = correct ? 1 : calc.cg;
  const amp = useMemo(() => calc.spec.amp.map((v) => v * scale), [calc, scale]);
  const dfl = calc.fs / calc.N;
  const Tc = calc.N / calc.fs;

  const rows = tones.map((t, i) => {
    if (!(t.A > 0)) return null;
    const { fa } = aliasInfo(t.f, calc.fs);
    const al = t.f > calc.fs / 2 + 1e-9;
    const cycles = t.f * Tc;
    const onLine = Math.abs(cycles - Math.round(cycles)) < 1e-6;
    const k0 = Math.round(fa / dfl);
    let reads = 0;
    let at = 0;
    for (let k = Math.max(0, k0 - 2); k <= Math.min(amp.length - 1, k0 + 2); k++)
      if (amp[k] > reads) {
        reads = amp[k];
        at = calc.spec.f[k];
      }
    return { i, t, fa, al, cycles, onLine, reads, at, err: (reads - t.A) / t.A };
  });
  const live = rows.filter((r): r is NonNullable<typeof r> => !!r);
  // Challenge: the cheapest repair of the 2022 record. Every tone below fs/2 and on a line (true amplitude
  // within 1 %), with fs below 60 samples/s and the shortest such record, 1/gcd(7.4, 15, 23) = 5 s.
  const exam = same(tones, EXAM) && live.length === 3;
  const goals = [
    { ok: exam && live.every((r) => !r.al), text: 'no tone above fs/2' },
    { ok: exam && live.every((r) => r.onLine && Math.abs(r.err) < 0.01), text: 'every tone on a line, true amplitude' },
    { ok: calc.fs < 60, text: 'fs below 60 samples/s' },
    { ok: exam && Math.abs(Tc - 5) < 1e-6, text: 'the shortest record that does it' },
  ];
  const solved = goals.every((g) => g.ok) && d === inputs;

  const maxA = Math.max(0.5, ...tones.map((t) => t.A));
  const yAxis = dB ? { min: 1e-4, max: 2 * maxA, log: true, label: 'amplitude (log)' } : { min: 0, max: 1.15 * maxA, label: correct ? 'amplitude (corrected)' : 'amplitude (uncorrected)' };

  // time record and the joint with its repeat
  const timeData = useMemo(() => {
    const xs = new Float64Array(calc.N);
    const ys = new Float64Array(calc.N);
    const env = new Float64Array(calc.N);
    let peak = 0;
    for (let n = 0; n < calc.N; n++) peak = Math.max(peak, Math.abs(calc.x[n]));
    for (let n = 0; n < calc.N; n++) {
      xs[n] = n / calc.fs;
      ys[n] = calc.x[n] * calc.w[n];
      env[n] = peak * calc.w[n];
    }
    // The joint the DFT assumes: the continuous signal at the end of the record, then its own start again.
    const live = tones.filter((t) => t.A > 0);
    const sig = (t: number) => live.reduce((s, tn) => s + tn.A * Math.sin(2 * Math.PI * tn.f * t), 0);
    const Tr = calc.N / calc.fs;
    const fmin = Math.min(...live.map((t) => t.f), calc.fs / 4);
    const half = Math.min(Tr / 2, 2.2 / Math.max(fmin, 1e-3));
    const endPts: [number, number][] = [];
    const repPts: [number, number][] = [];
    const M = 240;
    for (let i = 0; i <= M; i++) {
      const t = Tr - half + (half * i) / M;
      endPts.push([t, sig(t) * winAt(d.win, t / Tr)]);
      const s = (half * i) / M;
      repPts.push([Tr + s, sig(s) * winAt(d.win, s / Tr)]);
    }
    const endVal = endPts[M][1];
    const startVal = repPts[0][1];
    return { xs, ys, env, peak: Math.max(peak, 0.1), endPts, repPts, w0: Tr - half, w1: Tr + half, endVal, startVal, Tr };
  }, [calc, tones, d.win]);
  const jump = Math.abs(timeData.endVal - timeData.startVal);
  const hasJump = jump > 0.02 * timeData.peak;
  // An off-line tone leaks even when the values happen to meet at the joint: exactly half-way (121.5 cycles)
  // both ends are zero but the slope reverses, a kink. With a taper window both ends are zero by design.
  const offLine = live.some((r) => Math.abs(r.cycles - Math.round(r.cycles)) > 0.02);
  const tapered = d.win !== 'rect';
  const kink = !tapered && !hasJump && offLine;
  const jointText = tapered
    ? 'Here the window takes both ends to zero, so there is no jump: an off-line tone still spreads over a few neighbouring lines (the window’s main lobe), but the far skirts vanish.'
    : hasJump
      ? 'Here the end does not meet the start: that jump spreads energy into neighbouring lines.'
      : kink
        ? 'Here the values happen to meet but the slopes do not (a kink at the joint): an off-line tone still spreads energy into neighbouring lines.'
        : 'Here the end meets the start smoothly, so nothing leaks.';

  const load = (p: Setup) => {
    setFs(p.fs);
    setT(p.T);
    setTones(p.tones);
    setWin(p.win ?? 'rect');
    setCorrect(p.correct ?? true);
  };
  const setTone = (i: number, patch: Partial<Tone>) => setTones((ts) => ts.map((t, j) => (j === i ? { ...t, ...patch } : t)));

  const hoverLine = hover === null ? null : Math.max(0, Math.min(amp.length - 1, Math.round(hover / dfl)));
  const diag = live.length
    ? live
        .map((r) =>
          r.al
            ? `${fmt(r.t.f, 4)} Hz is above $f_s/2$ = ${fmt(calc.fs / 2, 4)} Hz, so it shows at ${fmt(r.fa, 4)} Hz (alias).`
            : r.onLine
              ? `${fmt(r.t.f, 4)} Hz completes ${fmt(r.cycles, 5)} cycles: on a line.`
              : `${fmt(r.t.f, 4)} Hz completes ${fmt(r.cycles, 4)} cycles: off-line, so it leaks${Math.abs(r.cycles - Math.round(r.cycles)) > 0.45 ? ' (nearly half-way: the worst case)' : ''}.`
        )
        .join(' ')
    : 'All tone amplitudes are zero.';

  return (
    <div>
      <Callout kind="info" title="Challenge: repair the 2022 A3.5 measurement, cheaply">
        <Rich text="The record below (40 samples/s, 8.1 s) of $2.6\sin(2\pi\,7.4t) + 1.5\sin(2\pi\,15t) + 0.8\sin(2\pi\,23t)$ shows a false 17 Hz line and a low 15 Hz peak. Change the **sampling rate** and **record length** (keep the three tones) so that every tone reads its true amplitude, within 1 %, at its true frequency. Do it with a sampling rate **below 60 samples/s** and the **shortest record** that works." />
        <div className="row gap-s wrap">
          {goals.map((g, i) => (
            <Badge key={i} tone={g.ok ? 'ok' : 'muted'}>
              {g.ok ? '✓' : '○'} {g.text}
            </Badge>
          ))}
        </div>
        <div className="row gap-s wrap">
          <Button size="sm" onClick={() => load(BAD)}>
            Load the 2022 record
          </Button>
          <Button size="sm" variant="primary" disabled={!solved || done} onClick={() => solved && completeChallenge(LEAK_CHALLENGE)}>
            {done ? '✓ Challenge complete' : solved ? 'Submit this fix' : 'Not fixed yet'}
          </Button>
          {done && <Badge tone="ok">{'Solved: 46 < fs < 60 samples/s, and T = 1/gcd(7.4, 15, 23) = 5 s, the shortest record with every tone on a line.'}</Badge>}
        </div>
      </Callout>
      <SimLayout
        visual={
          <>
            <Plot x={{ min: 0, max: nyq, label: 'frequency (Hz)' }} y={yAxis} height={260} ariaLabel="One-sided amplitude spectrum with the true tone positions" onHover={(x) => setHover(x)} cursorX={hover}>
              <LinesPath f={calc.spec.f} a={amp} color="var(--text-2)" />
              {live.map((r) => (
                <g key={r.i}>
                  <VLine x={r.fa} color={COLORS[r.i]} width={1} />
                  <Dot x={r.fa} y={r.t.A} color={COLORS[r.i]} hollow label={r.al ? `${fmt(r.t.f, 3)}→${fmt(r.fa, 3)}` : undefined} labelPos="above" />
                </g>
              ))}
            </Plot>
            <Legend
              items={[
                { label: `FFT lines (${WIN_LABEL[win]}${win !== 'rect' && !correct ? ', uncorrected' : ''})`, color: 'var(--text-2)' },
                ...live.map((r) => ({ label: `tone ${r.i + 1}: ${fmt(r.t.A, 3)} at ${fmt(r.t.f, 4)} Hz (○ = true)`, color: COLORS[r.i], dash: true })),
              ]}
            />
            {hoverLine !== null ? (
              <Readouts>
                <Readout label="line at" tip="the FFT line nearest the pointer" value={calc.spec.f[hoverLine]} unit="Hz" />
                <Readout label="reads" tip="amplitude on that line" value={amp[hoverLine]} sig={4} />
              </Readouts>
            ) : (
              <p className="muted small">Point at the spectrum to read any line.</p>
            )}
            <Plot x={{ min: 0, max: Tc, label: 'time (s)' }} y={{ min: -1.15 * timeData.peak, max: 1.15 * timeData.peak, label: win === 'rect' ? 'record' : 'windowed record' }} height={170} ariaLabel="The sampled record, multiplied by the window">
              {win !== 'rect' && (
                <>
                  <Line points={{ x: timeData.xs, y: timeData.env }} color="var(--text-3)" dash width={1} />
                  <Line points={{ x: timeData.xs, y: timeData.env.map((v) => -v) }} color="var(--text-3)" dash width={1} />
                </>
              )}
              <Line points={{ x: timeData.xs, y: timeData.ys }} color="var(--text-2)" width={1} />
            </Plot>
            <Plot x={{ min: timeData.w0, max: timeData.w1, label: 'time near the end of the record (s)' }} y={{ min: -1.15 * timeData.peak, max: 1.15 * timeData.peak, label: 'joint' }} height={150} ariaLabel="End of the record followed by its own start: the joint the DFT assumes">
              <Line points={timeData.endPts} color="var(--text-2)" width={1.8} />
              <Line points={timeData.repPts} color="var(--accent)" width={1.8} dash />
              <VLine x={timeData.Tr} color="var(--text-3)" />
              {hasJump && (
                <>
                  <Line points={[[timeData.Tr, timeData.endVal], [timeData.Tr, timeData.startVal]]} color="var(--bad)" width={3.5} />
                  <PlotText x={timeData.Tr} y={Math.max(timeData.endVal, timeData.startVal)} dx={6} dy={-4} color="var(--bad)">
                    jump: leakage
                  </PlotText>
                </>
              )}
              {kink && (
                <PlotText x={timeData.Tr} y={timeData.endVal} dx={6} dy={-4} color="var(--bad)">
                  kink: leakage
                </PlotText>
              )}
            </Plot>
            <Legend
              items={[
                { label: 'end of the record', color: 'var(--text-2)' },
                { label: 'its start, repeated (what the DFT assumes)', color: 'var(--accent)', dash: true },
              ]}
            />
            <p className="muted small">
              The DFT treats the record as one period of a repeating signal. {jointText} Whole periods, or a window that tapers both ends to zero, remove the jump.
            </p>
          </>
        }
        controls={
          <>
            <Slider label="sampling rate" tex="f_s" tip="samples per second; sets the Nyquist frequency fs/2" value={fs} min={8} max={200} step={1} format={(v) => `${Math.round(v)} samples/s`} onChange={setFs} />
            <Slider label="record length" tex="T" tip="duration of the record; sets the line spacing Δf = 1/T" value={T} min={0.2} max={30} step={0.05} format={(v) => `${fmt(v, 4)} s`} onChange={setT} />
            <More label="Tones (frequency and amplitude)" open>
              {tones.map((t, i) => (
                <div key={i}>
                  <Slider label="frequency" tex={`f_${i + 1}`} tip={`frequency of tone ${i + 1}`} value={t.f} min={0.5} max={100} step={0.1} format={(v) => `${fmt(v, 4)} Hz`} onChange={(v) => setTone(i, { f: Number(v.toFixed(2)) })} />
                  <Slider label="amplitude" tex={`A_${i + 1}`} tip={`amplitude of tone ${i + 1} (0 switches it off)`} value={t.A} min={0} max={3} step={0.05} format={(v) => fmt(v, 3)} onChange={(v) => setTone(i, { A: Number(v.toFixed(2)) })} />
                </div>
              ))}
            </More>
            <div className="row gap-s wrap">
              <Segmented
                size="sm"
                label="Window"
                value={win}
                onChange={setWin}
                options={[
                  { value: 'rect', label: 'Rectangular' },
                  { value: 'hann', label: 'Hann' },
                  { value: 'flattop', label: 'Flat-top' },
                ]}
              />
            </div>
            <div className="row gap-s wrap">
              <Toggle checked={correct} onChange={setCorrect} label="amplitude correction (÷ coherent gain)" />
              <Toggle checked={dB} onChange={setDB} label="log amplitude" />
            </div>
            <Readouts>
              <Readout tex="N" tip="number of samples, fs·T" text={String(N)} />
              <Readout tex="\Delta t" tip="time step 1/fs" value={1000 / fs} unit="ms" sig={3} />
              <Readout tex="\Delta f" tip="line spacing 1/T" value={1 / Teff} unit="Hz" sig={3} />
              <Readout tex="f_s/2" tip="Nyquist frequency" value={nyq} unit="Hz" sig={4} />
              <Readout label="lines" tip="N/2 lines from 0 to fs/2" text={String(Math.floor(N / 2))} />
              <Readout tex="CG" tip="coherent gain of the window: rect 1, Hann 0.5, flat-top 0.216" value={calc.cg} sig={3} />
            </Readouts>
            <div style={{ overflowX: 'auto' }}>
              <table className="table small">
                <thead>
                  <tr>
                    <th>tone</th>
                    <th>cycles in T</th>
                    <th>shown at</th>
                    <th>reads</th>
                    <th>error</th>
                  </tr>
                </thead>
                <tbody>
                  {live.map((r) => (
                    <tr key={r.i}>
                      <td>
                        <span style={{ color: COLORS[r.i] }} aria-hidden="true">
                          ●
                        </span>{' '}
                        {fmt(r.t.f, 4)} Hz
                      </td>
                      <td>
                        {fmt(r.cycles, 5)} {r.onLine ? '✓' : '✗'}
                      </td>
                      <td className={r.al ? 'bad-text' : undefined}>
                        {fmt(r.al ? r.fa : r.at, 4)} Hz{r.al ? ' alias' : ''}
                      </td>
                      <td>{fmt(r.reads, 3)}</td>
                      <td className={Math.abs(r.err) < 0.01 && !r.al ? 'ok-text' : 'bad-text'}>
                        {Math.abs(r.err) < 0.01 && !r.al ? '✓ ' : ''}
                        {fmt(r.err * 100, 3)} %
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Rich className="note" text={diag} />
            <div className="row gap-s wrap">
              <span className="muted small">Presets:</span>
              <Button size="sm" onClick={() => load(BAD)}>
                2022 A3.5 as recorded
              </Button>
              <Button size="sm" onClick={() => load(FIXED)}>
                2022 fixed (100 S/s, 5 s)
              </Button>
              <Button size="sm" onClick={() => load({ fs: 120, T: 1 / 3, tones: T2024 })}>
                2024 A3.2: Δf = 3 Hz
              </Button>
              <Button size="sm" onClick={() => load({ fs: 120, T: 1, tones: T2024 })}>
                2024 A3.2: Δf = 1 Hz
              </Button>
              <Button size="sm" onClick={() => load(CE1)}>
                Reader CE1
              </Button>
              <Button size="sm" onClick={() => load(HALF)}>
                Half-bin tone
              </Button>
            </div>
          </>
        }
      />
      <PredictReveal
        id="c3-leak-15hz"
        question="In the 2022 record (no window, $T$ = 8.1 s) the 15 Hz tone has amplitude 1.5. What will its peak read?"
        options={['1.5', 'about 1.3', 'about 0.97', 'about 0.5']}
        answer={2}
        explain="15 × 8.1 = 121.5 cycles: exactly half-way between lines, the worst case. On its own it would read about $2/\pi \times 1.5 = 0.95$; leakage from the other tones lifts it to 0.968, the value on the 2022 A3.5 plot."
        tryIt="load the 2022 record and read the table."
        onApply={() => load(BAD)}
      />
      <PredictReveal
        id="c3-leak-hann"
        question="On the fixed record (100 samples/s, 5 s: every tone on a line) switch to a Hann window with the amplitude correction **off**. The 7.4 Hz tone (amplitude 2.6) now reads…"
        options={['2.6', 'about 1.3', 'about 5.2']}
        answer={1}
        explain="The Hann window’s coherent gain is 0.5, so an on-line tone reads half its amplitude and its peak spreads over three lines. Correcting (× 2) gives 2.6 again. For an FRF the same window on force and response cancels, so no correction is needed there."
        tryIt="load ‘2022 fixed’, pick Hann and untick the correction."
        onApply={() => load({ ...FIXED, win: 'hann', correct: false })}
      />
      <PredictReveal
        id="c3-leak-2024"
        question="Tones at 10, 13 and 30 Hz are sampled at 120 samples/s. You lengthen the record from 1/3 s (Δf = 3 Hz) to 1 s. What happens?"
        options={['The 10 and 13 Hz peaks stay merged', 'Three sharp peaks of exactly 1 appear', 'Only the 30 Hz peak sharpens']}
        answer={1}
        explain="With Δf = 1 Hz = gcd(10, 13, 30) every tone sits on a line: three exact peaks. With 3 Hz lines, 10 and 13 Hz both leak into the 12 Hz line and appear at the wrong frequencies (2024 A3.2)."
        tryIt="press the two 2024 presets in turn."
        onApply={() => load({ fs: 120, T: 1, tones: T2024 })}
      />
      <PredictReveal
        id="c3-leak-doublefs"
        question="Back on the 2022 record, double the sampling rate to 80 samples/s and keep $T$ = 8.1 s. Does the 15 Hz peak recover?"
        options={['Yes: more samples per period fix it', 'No: it still leaks']}
        answer={1}
        explain="Leakage depends on the cycles in the record, $fT$ = 121.5, which has not changed; nor has Δf = 1/T. Doubling $f_s$ only cures the alias (23 Hz is now below the 40 Hz Nyquist). Record length fixes leakage, sampling rate fixes aliasing."
        tryIt="load the 2022 record and drag fs to 80."
        onApply={() => load({ ...BAD, fs: 80 })}
      />
    </div>
  );
}
