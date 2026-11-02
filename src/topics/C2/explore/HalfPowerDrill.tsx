// Half-power drill: a random SDOF receptance is plotted (magnitude or real part). Drag the two markers to the
// half-power points, get ζ = (ω₂ − ω₁)/(2ωₙ) and compare with the true damping. Three FRFs estimated within 8 %
// (each FRF counts once) complete the challenge.
import { useMemo, useState } from 'react';
import { cabs } from '../../../physics/complex';
import { sdofReceptance } from '../../../physics/frf';
import { makeRng } from '../../../engine/rng';
import { Dot, HLine, Handle, Line, Plot, VLine, sample, type AxisSpec } from '../../../plot/Plot';
import { Badge, Button, Callout, Readout, Readouts, Segmented, SimLayout, Slider, Toggle } from '../../../ui/kit';
import { PredictReveal } from '../../../ui/PredictReveal';
import { Rich } from '../../../ui/Rich';
import { completeChallenge, useProgress } from '../../../app/store';
import { halfAmplitudePoints, halfPowerFromMax, realExtremes } from '../physics';

export const DRILL_CHALLENGE = 'c2-half-power-drill';
const GOOD = 0.08;

type View = 'mag' | 're';

interface Round {
  k: number;
  wn: number;
  zeta: number;
  m: number;
  c: number;
  lo: number;
  hi: number;
  /** display scale for the receptance and its unit */
  s: number;
  unit: string;
  /** Worked example (not counted towards the challenge). */
  demo?: boolean;
}

function build(k: number, wn: number, zeta: number, widen: number, demo = false): Round {
  const m = k / (wn * wn);
  const c = 2 * zeta * Math.sqrt(k * m);
  const w = 6 * zeta * widen;
  const peak = 1 / (2 * zeta * k);
  const mm = peak >= 1e-3;
  return { k, wn, zeta, m, c, lo: wn * Math.max(0.05, 1 - w), hi: wn * (1 + w), s: mm ? 1e3 : 1e6, unit: mm ? 'mm/N' : 'µm/N', demo };
}

function makeRound(n: number): Round {
  const r = makeRng(9001 + n * 7919);
  const k = Number((10 ** r.uniform(3, 7)).toPrecision(2));
  const wn = Number(r.uniform(20, 2000).toPrecision(2));
  const zeta = Number(r.uniform(0.01, 0.1).toPrecision(2));
  return build(k, wn, zeta, r.uniform(0.8, 1.3));
}

/** The worked example of the third prompt: peak at 100 rad/s, ζ = 0.04 (half-power points ≈ 96 and 104 rad/s). */
const DEMO = build(1e5, 100, 0.04, 1.1, true);

export default function HalfPowerDrill() {
  const p = useProgress();
  const done = !!p.challenges[DRILL_CHALLENGE];
  // Start at a random round so each visit draws different FRFs; each round is reproducible from its index.
  const [round, setRound] = useState(() => Math.floor(Math.random() * 1000));
  const [demo, setDemo] = useState(false);
  const R = useMemo(() => (demo ? DEMO : makeRound(round)), [round, demo]);
  const [view, setView] = useState<View>('mag');
  const [showLevel, setShowLevel] = useState(false);
  const span = R.hi - R.lo;
  const [w1, setW1] = useState(R.lo + 0.12 * span);
  const [w2, setW2] = useState(R.hi - 0.12 * span);
  const [result, setResult] = useState<null | { est: number; err: number; good: boolean; r1: number; r2: number; wnUsed: number }>(null);
  const [good, setGood] = useState(0);
  const [tries, setTries] = useState(0);
  /** Rounds already counted as good: re-checking the same FRF does not count twice. */
  const [counted, setCounted] = useState<number[]>([]);

  const H = (w: number) => sdofReceptance(R.k, R.m, R.c, w);
  const magAt = (w: number) => cabs(H(w)) * R.s;
  const reAt = (w: number) => H(w).re * R.s;
  const yAt = view === 'mag' ? magAt : reAt;

  const wPeak = R.wn * Math.sqrt(1 - 2 * R.zeta * R.zeta);
  const hMax = magAt(wPeak);
  const level = hMax / Math.SQRT2;
  const trueHP = halfPowerFromMax(R.wn, R.zeta);
  const rex = realExtremes(R.k, R.wn, R.zeta);
  const half = halfAmplitudePoints(R.wn, R.zeta);

  const curve = useMemo(() => sample((w) => (view === 'mag' ? cabs(sdofReceptance(R.k, R.m, R.c, w)) : sdofReceptance(R.k, R.m, R.c, w).re) * R.s, R.lo, R.hi, 900), [R, view]);
  const xAxis = useMemo<AxisSpec>(() => ({ min: R.lo, max: R.hi, label: 'ω (rad/s)' }), [R]);
  const yAxis = useMemo<AxisSpec>(() => {
    if (view === 'mag') return { min: 0, max: hMax * 1.12, label: `|H| (${R.unit})` };
    const a = rex.v1 * R.s;
    return { min: -a * 1.25, max: a * 1.25, label: `Re H (${R.unit})` };
  }, [R, view, hMax, rex.v1]);

  const wnUsed = view === 'mag' ? wPeak : R.wn;
  const lo = Math.min(w1, w2);
  const hi = Math.max(w1, w2);
  const est = (hi - lo) / (2 * wnUsed);

  const check = () => {
    const err = est / R.zeta - 1;
    const ok = Math.abs(err) <= GOOD;
    setResult({ est, err, good: ok, r1: magAt(lo) / hMax, r2: magAt(hi) / hMax, wnUsed });
    setTries((t) => t + 1);
    if (ok && !R.demo && !counted.includes(round)) {
      const g = good + 1;
      setGood(g);
      setCounted((c) => [...c, round]);
      if (g >= 3) completeChallenge(DRILL_CHALLENGE);
    }
  };
  const next = () => {
    const nr = makeRound(round + 1);
    setDemo(false);
    setRound((r) => r + 1);
    const sp = nr.hi - nr.lo;
    setW1(nr.lo + 0.12 * sp);
    setW2(nr.hi - 0.12 * sp);
    setResult(null);
  };
  const alreadyCounted = !R.demo && counted.includes(round);
  const place = (a: number, b: number) => {
    setW1(a);
    setW2(b);
    setResult(null);
  };

  const diag = (() => {
    if (!result || result.good) return '';
    if (view === 're') return 'On the real-part plot the half-power points are the **peak** and the **trough** of Re H. Put one marker on each.';
    const near = (r: number, t: number) => Math.abs(r - t) < 0.06;
    if (near(result.r1, 0.5) && near(result.r2, 0.5)) return 'Your markers sit at **half amplitude** ($|H|_{max}/2$). Half power is half the **square**: use $|H|_{max}/\\sqrt2 = 0.707|H|_{max}$ (−3 dB).';
    return `Your markers are at ${result.r1.toFixed(2)} and ${result.r2.toFixed(2)} of $|H|_{max}$. Both should be at $1/\\sqrt2 = 0.707$ (−3 dB).`;
  })();

  return (
    <div>
      <Callout kind="info" title="Challenge">
        <Rich text="Drag the two markers to the half-power points of each FRF, then check your damping estimate $\zeta \approx (\omega_2 - \omega_1)/(2\omega_n)$. Good estimates (within 8 % of the true value) on three different FRFs complete the challenge; press **New FRF** after each one. Read the values as you would from exam cursors: the peak is given; the half-power level is yours to work out." />
      </Callout>
      <SimLayout
        visual={
          <>
            <Plot x={xAxis} y={yAxis} height={300} ariaLabel={view === 'mag' ? 'Receptance magnitude with two draggable markers' : 'Real part of the receptance with two draggable markers'}>
              {view === 'mag' && showLevel && <HLine y={level} color="var(--accent)" label="|H|max/√2" />}
              <Line points={curve} color="var(--text)" width={2.4} />
              {view === 'mag' ? <Dot x={wPeak} y={hMax} color="var(--m1)" label="peak" labelPos="above" /> : <Dot x={R.wn} y={0} color="var(--m1)" label="Re H = 0" labelPos="right" />}
              {result && (
                <>
                  <VLine x={view === 'mag' ? trueHP[0] : rex.w1} color="var(--ok)" />
                  <VLine x={view === 'mag' ? trueHP[1] : rex.w2} color="var(--ok)" label="true" />
                </>
              )}
              <Handle x={w1} y={yAt(w1)} axis="x" clampX={[R.lo, R.hi]} onChange={(x) => place(x, w2)} color="var(--accent)" label="ω₁" ariaLabel="Left half-power marker" />
              <Handle x={w2} y={yAt(w2)} axis="x" clampX={[R.lo, R.hi]} onChange={(x) => place(w1, x)} color="var(--accent)" label="ω₂" ariaLabel="Right half-power marker" />
            </Plot>
            <Readouts min={168}>
              {view === 'mag' ? (
                <>
                  <Readout tex="\omega_{peak}" tip="frequency of the magnitude peak (≈ ωₙ for light damping)" value={wPeak} unit="rad/s" sig={6} tone="m1" />
                  <Readout tex="|H|_{max}" tip="peak magnitude" value={hMax} unit={R.unit} sig={6} tone="m1" />
                </>
              ) : (
                <Readout tex="\omega_n" tip="where Re H crosses zero" value={R.wn} unit="rad/s" sig={6} tone="m1" />
              )}
              <Readout tex="\omega_1" tip="left marker" value={lo} unit="rad/s" sig={6} />
              <Readout tex={view === 'mag' ? '|H(\\omega_1)|' : '\\text{Re}\\,H(\\omega_1)'} tip="value at the left marker" value={yAt(lo)} unit={R.unit} sig={5} />
              <Readout tex="\omega_2" tip="right marker" value={hi} unit="rad/s" sig={6} />
              <Readout tex={view === 'mag' ? '|H(\\omega_2)|' : '\\text{Re}\\,H(\\omega_2)'} tip="value at the right marker" value={yAt(hi)} unit={R.unit} sig={5} />
              <Readout tex="\zeta_{est}" tip="(ω₂ − ω₁)/(2ωₙ) from your markers" value={est} sig={4} tone="accent" />
            </Readouts>
          </>
        }
        controls={
          <>
            <Segmented
              label="Plot"
              value={view}
              onChange={(v: View) => {
                setView(v);
                setResult(null);
              }}
              options={[
                { value: 'mag', label: 'Magnitude |H|' },
                { value: 're', label: 'Real part Re H' },
              ]}
            />
            <Slider label="left marker (fine)" tex="\omega_1" tip="fine adjustment of the left marker" value={w1} min={R.lo} max={R.hi} step={span / 4000} unit="rad/s" sig={6} onChange={(x) => place(x, w2)} />
            <Slider label="right marker (fine)" tex="\omega_2" tip="fine adjustment of the right marker" value={w2} min={R.lo} max={R.hi} step={span / 4000} unit="rad/s" sig={6} onChange={(x) => place(w1, x)} />
            {view === 'mag' && <Toggle checked={showLevel} onChange={setShowLevel} label="Hint: show the |H|max/√2 level" />}
            <div className="row gap-s wrap">
              <Button variant="primary" onClick={check}>
                Check my ζ
              </Button>
              <Button onClick={next}>New FRF</Button>
            </div>
            {result && (
              <Callout kind={result.good ? 'ok' : 'bad'} title={result.good ? 'Good estimate' : 'Not within 8 %'}>
                <Rich
                  text={`Your $\\zeta$ = ${result.est.toPrecision(3)}; true $\\zeta$ = ${R.zeta} (${result.err >= 0 ? '+' : ''}${(result.err * 100).toFixed(1)} %). ${result.good ? 'Eq 2.8 itself is a light-damping approximation (a few per cent high near ζ = 0.1).' : diag}`}
                />
              </Callout>
            )}
            <div className="row gap-s wrap">
              <Badge tone={good >= 3 || done ? 'ok' : 'accent'}>{`Good estimates: ${Math.min(good, 3)}/3`}</Badge>
              <span className="muted small">{tries} checked</span>
              {alreadyCounted && <span className="muted small">this FRF already counted: press New FRF</span>}
              {R.demo && <span className="muted small">worked example (not counted)</span>}
              {done && <Badge tone="ok">✓ Challenge complete</Badge>}
            </div>
            <details className="more">
              <summary>This system (reveal after you try)</summary>
              <div className="more-body">
                <Readouts>
                  <Readout tex="k" tip="stiffness" value={R.k} unit="N/m" sig={2} />
                  <Readout tex="\omega_n" tip="undamped natural frequency" value={R.wn} unit="rad/s" sig={4} />
                  <Readout tex="\zeta" tip="true damping ratio" value={R.zeta} sig={2} />
                </Readouts>
              </div>
            </details>
          </>
        }
      />
      <PredictReveal
        id="c2-hp-half-amplitude"
        question="If you put the markers where $|H| = |H|_{max}/2$ instead of $|H|_{max}/\sqrt2$, your damping estimate will be…"
        options={['about right', 'too low, by about half', 'too high, by about 73 % (×√3)']}
        answer={2}
        explain="The half-amplitude points are $\sqrt3$ times further apart than the half-power points ($\beta^2 \approx 1 \mp 2\sqrt3\,\zeta$), so the estimate comes out about 1.73× too big. Half **power** means half the squared amplitude: $1/\sqrt2$, i.e. −3 dB (LC2-5)."
        tryIt="press Show me: the markers jump to the half-amplitude points and are checked."
        onApply={() => {
          setView('mag');
          setW1(half[0]);
          setW2(half[1]);
          const e = (half[1] - half[0]) / (2 * wPeak);
          setResult({ est: e, err: e / R.zeta - 1, good: false, r1: 0.5, r2: 0.5, wnUsed: wPeak });
        }}
      />
      <PredictReveal
        id="c2-hp-real"
        question="On a plot of the **real part** of the receptance, where are the half-power points?"
        options={['where Re H equals its peak value divided by √2', 'at the peak and the trough of Re H', 'where Re H crosses zero']}
        answer={1}
        explain="Re $H \propto (1-\beta^2)/[(1-\beta^2)^2 + (2\zeta\beta)^2]$ has its extremes exactly at $\beta = \sqrt{1 \mp 2\zeta}$, the half-power points; it crosses zero at $\omega_n$. That is how 2024 A3.4 and Week 12 Q1 give damping from Re-peak and Re-trough cursors."
        tryIt="switch to the real-part plot and drag the markers onto the peak and the trough."
        onApply={() => {
          setView('re');
          place(rex.w1, rex.w2);
        }}
      />
      <PredictReveal
        id="c2-hp-numbers"
        question="A peak at 100 rad/s has half-power points at 96 and 104 rad/s. The damping ratio is…"
        options={['0.08', '0.04', '8', '0.4']}
        answer={1}
        explain="$\zeta = (104 - 96)/(2 \times 100) = 0.04$. Forgetting the 2 gives 0.08 (that is $2\zeta$, the loss factor); reporting the bandwidth gives 8. Both are Week 12 Q1 distractors."
        tryIt="press Show me: a ζ = 0.04 FRF with its peak at 100 rad/s is loaded and the markers sit on its half-power points."
        onApply={() => {
          const [a, b] = halfPowerFromMax(DEMO.wn, DEMO.zeta);
          const wp = DEMO.wn * Math.sqrt(1 - 2 * DEMO.zeta * DEMO.zeta);
          const e = (b - a) / (2 * wp);
          setDemo(true);
          setView('mag');
          setShowLevel(true);
          setW1(a);
          setW2(b);
          setResult({ est: e, err: e / DEMO.zeta - 1, good: true, r1: 1 / Math.SQRT2, r2: 1 / Math.SQRT2, wnUsed: wp });
        }}
      />
    </div>
  );
}
