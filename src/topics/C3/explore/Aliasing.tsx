// Sampling and aliasing: a continuous sine, its samples at fs, the slowest sine through those samples
// (what an FFT reports), the folding diagram f -> |f - k fs| in [0, fs/2], and a stroboscope disc that
// shows the same fold as the wagon-wheel effect. Optional analogue anti-aliasing filter before the ADC.
import { useMemo, useRef, useState } from 'react';
import { aliasInfo, aliasWave } from '../physics';
import { useRaf } from '../../../anim/hooks';
import { Band, Dot, Handle, Line, LivePath, livePathD, Plot, PlotText, Stems, VLine, sample, type PlotScales } from '../../../plot/Plot';
import { Badge, Button, Legend, Readout, Readouts, SimLayout, Slider, Toggle } from '../../../ui/kit';
import { PredictReveal } from '../../../ui/PredictReveal';
import { Rich } from '../../../ui/Rich';
import { fmt } from '../../../engine/format';

const NS = 24; // samples shown in the time window
const SLOW_FLASHES = 2.5; // strobe flashes per real second in the slowed-down disc

/** Practical analogue anti-aliasing filter: flat to 0.4 fs, about -60 dB from fs/2 on (log-linear between). */
function filterGain(f: number, fs: number): number {
  const u = f / fs;
  if (u <= 0.4) return 1;
  if (u >= 0.5) return 1e-3;
  return Math.pow(10, (-3 * (u - 0.4)) / 0.1);
}

const R = 70; // disc radius (px)

export default function Aliasing() {
  const [fs, setFsRaw] = useState(40);
  const [f, setF] = useState(23);
  const [filter, setFilter] = useState(false);
  const [playing, setPlaying] = useState(true);
  const setFs = (v: number) => {
    setFsRaw(v);
    setF((x) => Math.min(x, 3 * v));
  };
  const nyq = fs / 2;
  const { fa, k, reversed } = aliasInfo(f, fs);
  const aliased = f > nyq * (1 + 1e-9);
  const gain = filter ? filterGain(f, fs) : 1;
  const removed = filter && gain < 0.01;
  const Tw = NS / fs;
  const tScale = Tw < 0.5 ? 1000 : 1;
  const tUnit = tScale === 1000 ? 'ms' : 's';

  const cont = useMemo(() => {
    const n = Math.min(4000, Math.max(400, Math.ceil(f * Tw * 30)));
    return sample((t) => gain * Math.sin(2 * Math.PI * f * (t / tScale)), 0, Tw * tScale, n);
  }, [f, Tw, gain, tScale]);
  const raw = useMemo(() => (filter && gain < 0.999 ? sample((t) => Math.sin(2 * Math.PI * f * (t / tScale)), 0, Tw * tScale, Math.min(4000, Math.max(400, Math.ceil(f * Tw * 30)))) : null), [filter, gain, f, Tw, tScale]);
  const alias = useMemo(() => sample((t) => aliasWave(t / tScale, f, fs, gain), 0, Tw * tScale, 600), [f, fs, gain, Tw, tScale]);
  const samples = useMemo(() => {
    const xs = new Float64Array(NS + 1);
    const ys = new Float64Array(NS + 1);
    for (let n = 0; n <= NS; n++) {
      xs[n] = (n / fs) * tScale;
      ys[n] = gain * Math.sin((2 * Math.PI * f * n) / fs);
    }
    return { xs, ys };
  }, [f, fs, gain, tScale]);
  const fold = useMemo(() => Array.from({ length: 7 }, (_, m) => [(m * fs) / 2, (m % 2) * nyq] as [number, number]), [fs, nyq]);

  // ------------------------------------------------------------------ stroboscope animation
  const wrapRef = useRef<HTMLDivElement>(null);
  const trueRef = useRef<SVGLineElement>(null);
  const flashRefs = [useRef<SVGLineElement>(null), useRef<SVGLineElement>(null), useRef<SVGLineElement>(null)];
  const cursorRef = useRef<SVGPathElement>(null);
  const scales = useRef<PlotScales | null>(null);
  const anim = useRef({ t: 0, n: -1 });
  useRaf(
    (dt) => {
      if (!playing) return;
      const a = anim.current;
      a.t += dt * (SLOW_FLASHES / fs);
      const th = 2 * Math.PI * f * a.t;
      trueRef.current?.setAttribute('x2', (100 + R * Math.cos(th)).toFixed(1));
      trueRef.current?.setAttribute('y2', (100 - R * Math.sin(th)).toFixed(1));
      const n = Math.floor(a.t * fs);
      if (n !== a.n) {
        a.n = n;
        flashRefs.forEach((ref, j) => {
          const thj = (2 * Math.PI * f * (n - j)) / fs;
          ref.current?.setAttribute('x2', (100 + R * Math.cos(thj)).toFixed(1));
          ref.current?.setAttribute('y2', (100 - R * Math.sin(thj)).toFixed(1));
        });
        const tn = ((n % NS) / fs) * tScale;
        cursorRef.current?.setAttribute('d', livePathD([[tn, -1.25], [tn, 1.25]], scales.current));
      }
    },
    true,
    wrapRef
  );

  const preset = (pf: number, pfs: number, pFilter = false) => {
    setFsRaw(pfs);
    setF(pf);
    setFilter(pFilter);
  };
  const perPeriod = fs / Math.max(f, 1e-9);
  const status = removed ? 'removed by the filter' : aliased ? `aliased to ${fmt(fa, 4)} Hz` : f === nyq ? 'at Nyquist: ambiguous' : 'shown correctly';
  const tone = removed ? 'muted' : aliased ? 'bad' : 'ok';

  return (
    <div ref={wrapRef}>
      <SimLayout
        visual={
          <>
            <Plot x={{ min: 0, max: Tw * tScale, label: `time (${tUnit})` }} y={{ min: -1.25, max: 1.25, label: 'signal', ticks: [-1, 0, 1] }} height={230} ariaLabel="Continuous sine, its samples and the slowest sine through the samples">
              {raw && <Line points={raw} color="var(--text-3)" width={1} opacity={0.5} />}
              <Line points={cont} color="var(--m1)" width={1.4} opacity={f / fs > 1.5 ? 0.55 : 0.9} />
              <Line points={alias} color="var(--m2)" width={2.4} dash />
              <Stems xs={samples.xs} ys={samples.ys} color="var(--text)" width={1.2} />
              <LivePath pathRef={cursorRef} scalesRef={scales} color="var(--accent)" width={1.5} />
            </Plot>
            <Legend
              items={[
                { label: `true signal, ${fmt(f, 4)} Hz${filter ? ' (after the filter)' : ''}`, color: 'var(--m1)' },
                { label: `slowest sine through the samples: ${fmt(fa, 4)} Hz`, color: 'var(--m2)', dash: true },
                { label: 'samples', color: 'var(--text)' },
              ]}
            />
            <Plot
              x={{ min: 0, max: 3 * fs, label: 'true frequency f (Hz)', ticks: [0, nyq, fs, 2 * fs, 3 * fs], format: (v) => fmt(v, 4) }}
              y={{ min: 0, max: 0.62 * fs, label: 'frequency shown (Hz)', ticks: [0, nyq], format: (v) => fmt(v, 4) }}
              height={210}
              ariaLabel="Folding diagram: true frequency against the frequency the FFT shows"
            >
              {filter ? (
                <>
                  <Band x0={0.4 * fs} x1={0.5 * fs} color="var(--warn)" opacity={0.12} />
                  <Band x0={0.5 * fs} x1={3 * fs} color="var(--text-3)" opacity={0.1} />
                  <PlotText x={1.5 * fs} y={0.04 * fs} anchor="middle">
                    removed by the filter
                  </PlotText>
                </>
              ) : (
                <>
                  <Band x0={nyq} x1={3 * fs} color="var(--bad)" opacity={0.06} />
                  <PlotText x={1.5 * fs} y={0.04 * fs} anchor="middle">
                    above fs/2: folds back
                  </PlotText>
                </>
              )}
              <Line points={fold} color="var(--text-2)" width={1.6} />
              <VLine x={nyq} label="fs/2" />
              <VLine x={fs} label="fs" />
              <VLine x={2 * fs} label="2fs" />
              <Line points={[[f, 0], [f, fa]]} color="var(--m2)" dash width={1.2} />
              <Line points={[[0, fa], [f, fa]]} color="var(--m2)" dash width={1.2} />
              <Dot x={0} y={fa} color="var(--m2)" r={3.5} />
              <Handle x={f} y={fa} axis="x" clampX={[fs / 100, 3 * fs]} onChange={(x) => setF(Number(x.toPrecision(4)))} color="var(--accent)" label={`${fmt(f, 4)} Hz`} ariaLabel="true frequency" />
            </Plot>
            <p className="muted small">Drag the handle along the zig-zag: every true frequency lands somewhere in 0 to fs/2. The samples cannot tell f from |f − k·fs|.</p>
          </>
        }
        controls={
          <>
            <Slider label="sampling rate" tex="f_s" tip="samples per second; Nyquist = fs/2" value={fs} min={5} max={50000} log format={(v) => `${fmt(v, 4)} samples/s`} onChange={(v) => setFs(Number(v.toPrecision(3)))} />
            <Slider label="true frequency" tex="f" tip="frequency of the vibration before sampling" value={f} min={fs / 100} max={3 * fs} step={fs / 200} format={(v) => `${fmt(v, 4)} Hz`} onChange={(v) => setF(Number(v.toPrecision(4)))} />
            <Toggle checked={filter} onChange={setFilter} label="analogue anti-aliasing filter before the ADC" />
            <Readouts>
              <Readout tex="f_s/2" tip="Nyquist frequency: the highest frequency the FFT can show" value={nyq} unit="Hz" />
              <Readout tex="f_a" tip="frequency at which the FFT shows the tone, |f − k fs|" value={fa} unit="Hz" tone={aliased && !removed ? 'bad' : 'ok'} />
              <Readout tex="k" tip="nearest whole number of fs below or above f: round(f/fs)" text={String(k)} />
              <Readout tex="f_s/f" tip="samples per period of the true signal (needs more than 2)" value={perPeriod} sig={3} tone={perPeriod > 2 ? 'ok' : 'bad'} />
              {filter && <Readout label="filter gain" tip="attenuation of the analogue filter at f" value={20 * Math.log10(gain)} unit="dB" sig={3} />}
            </Readouts>
            <Badge tone={tone}>{status}</Badge>
            <div className="row gap-s wrap" style={{ alignItems: 'flex-start' }}>
              <svg viewBox="0 0 200 200" className="anim" style={{ maxWidth: 190 }} role="img" aria-label="Stroboscope: a spoke turning at f, lit fs times a second">
                <circle cx={100} cy={100} r={R + 8} fill="var(--surface-2)" stroke="var(--border)" />
                <line ref={trueRef} x1={100} y1={100} x2={100 + R} y2={100} stroke="var(--m1)" strokeWidth={2} opacity={0.35} strokeLinecap="round" />
                {flashRefs.map((ref, j) => (
                  <line key={j} ref={ref} x1={100} y1={100} x2={100 + R} y2={100} stroke="var(--m2)" strokeWidth={j === 0 ? 5 : 3} opacity={j === 0 ? 1 : j === 1 ? 0.45 : 0.2} strokeLinecap="round" />
                ))}
                <circle cx={100} cy={100} r={6} fill="var(--surface)" stroke="var(--text-2)" strokeWidth={2} />
              </svg>
              <div className="small" style={{ flex: '1 1 140px', minWidth: 0 }}>
                <Rich
                  text={`**Strobe view** (slowed down). Faint spoke: the true rotation at $f$. Bold spoke: what each flash shows, with the two previous flashes fading. It appears to turn ${fa < 1e-9 ? '**not at all**' : `at ${fmt(fa, 3)} rev/s **${reversed ? 'backwards' : 'forwards'}**`}.`}
                />
              </div>
            </div>
            <div className="row gap-s wrap">
              <Button size="sm" onClick={() => setPlaying((p) => !p)}>
                {playing ? 'Pause strobe' : 'Play strobe'}
              </Button>
            </div>
            <div className="row gap-s wrap">
              <span className="muted small">Exam cases:</span>
              <Button size="sm" onClick={() => preset(23, 40)}>
                2022 A3.5: 23 Hz at 40
              </Button>
              <Button size="sm" onClick={() => preset(135, 250)}>
                2025 A3.2: 135 Hz at 250
              </Button>
              <Button size="sm" onClick={() => preset(12000, 20000)}>
                2021 A3.1: 12 kHz at 20 kHz
              </Button>
              <Button size="sm" onClick={() => preset(7, 15)}>
                Reader CE1: 7 Hz at 15
              </Button>
              <Button size="sm" onClick={() => preset(20, 40)}>
                f = fs/2
              </Button>
            </div>
            <Rich
              className="note"
              text={
                removed
                  ? 'The analogue filter removed the tone **before** sampling, so nothing false appears. That is the only cure: after the A/D converter an alias looks exactly like a real tone.'
                  : aliased
                    ? `Fewer than two samples per period: the samples trace a ${fmt(fa, 4)} Hz sine${reversed ? ' (phase-inverted)' : ''} instead. $f_a = |${fmt(f, 4)} - ${k} \\times ${fmt(fs, 4)}|$.`
                    : f === nyq
                      ? 'Exactly at Nyquist the samples can land on the zero crossings: the amplitude is undefined. Real analysers stay well below fs/2.'
                      : `${fmt(perPeriod, 3)} samples per period: enough to pin the frequency down.`
              }
            />
          </>
        }
      />
      <PredictReveal
        id="c3-alias-23"
        question="A 23 Hz vibration is sampled at 40 samples/s with no anti-aliasing filter. Where does the FFT show it?"
        options={['At 23 Hz', 'At 17 Hz', 'At 3 Hz', 'Nowhere: it is lost']}
        answer={1}
        explain="The Nyquist frequency is 20 Hz, so 23 Hz folds back: $f_a = |23 - 40| = 17$ Hz. Its samples are identical to those of a (phase-inverted) 17 Hz sine, so the FFT shows a sharp but false 17 Hz line (2022 A3.5)."
        tryIt="set f = 23 Hz and fs = 40 samples/s and compare the dashed sine with the samples."
        onApply={() => preset(23, 40)}
      />
      <PredictReveal
        id="c3-alias-50"
        question="Keep the 23 Hz tone and raise the sampling rate to 50 samples/s. Where is it shown now?"
        options={['Still at 17 Hz', 'At 23 Hz, correctly', 'At 27 Hz']}
        answer={1}
        explain="Nyquist is now 25 Hz, above 23 Hz, so the tone is shown at its true frequency ($k$ = round(23/50) = 0). |23 − 50| = 27 Hz is not the alias: it lies above $f_s/2$."
        tryIt="press the 2022 preset, then drag fs up to 50."
        onApply={() => preset(23, 50)}
      />
      <PredictReveal
        id="c3-alias-digital"
        question="You sampled the 23 Hz tone at 40 samples/s, then apply a sharp **digital** low-pass filter at 15 Hz to the samples. What happens?"
        options={['The alias disappears and 23 Hz is restored', 'The 17 Hz line is removed, but 23 Hz is gone for good and a genuine 17 Hz tone would be removed too', 'The line moves back to 23 Hz']}
        answer={1}
        explain="After the A/D converter the samples of 23 Hz and of a 17 Hz sine are identical, so no processing can separate them or recover 23 Hz. Only an **analogue** anti-aliasing filter before sampling prevents aliasing (LC3-4; Week 11 Q4). Show me turns that filter on: the tone is removed before it can fold."
        tryIt="tick the analogue anti-aliasing filter and watch the folding diagram."
        onApply={() => preset(23, 40, true)}
      />
      <PredictReveal
        id="c3-alias-wheel"
        question="A spoke turns at 39 rev/s and is lit by a strobe flashing 40 times a second. How does it appear to turn?"
        options={['Forwards at 39 rev/s', 'Forwards, slowly (1 rev/s)', 'Backwards, slowly (1 rev/s)', 'Frozen']}
        answer={2}
        explain="Between flashes it turns 39/40 of a revolution, just short of a full turn, so each flash shows it slightly behind where it was: it creeps backwards at |39 − 40| = 1 rev/s. Same fold as aliasing, with $f - kf_s < 0$ meaning reversed."
        tryIt="set f = 39 Hz, fs = 40 and watch the bold spoke."
        onApply={() => preset(39, 40)}
      />
    </div>
  );
}
