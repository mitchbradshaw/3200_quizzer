// Challenge: size an undamped absorber so the machine stands still at its operating speed and both new
// resonances clear a ±x % band, with the lightest absorber (2021 A1.3, 2023 A1.4, 2024 A1.5, Week 5 Q1).
import { useMemo, useState } from 'react';
import { muFromRatio, primaryAmplitude } from '../../../physics/absorber';
import { Band, Dot, HBand, Handle, Line, Plot, PlotText, VLine, sample } from '../../../plot/Plot';
import { Badge, Button, Callout, Legend, Readout, Readouts, Segmented, SimLayout, Slider, Toggle } from '../../../ui/kit';
import { PredictReveal } from '../../../ui/PredictReveal';
import { Rich } from '../../../ui/Rich';
import { completeChallenge, useProgress } from '../../../app/store';
import ChainAnim from './ChainAnim';
import HaloText from './HaloText';
import { absorberSigned, featureGrid, newFrequenciesG } from '../physics';
import { fmt } from '../../../engine/format';

export const TUNING_CHALLENGE = 'a4-absorber-tuning';

interface Scenario {
  id: string;
  name: string;
  m1: number;
  /** Operating speed in `unit`. */
  N: number;
  unit: 'rpm' | 'Hz';
  x: number;
  story: string;
}

const SCENARIOS: Scenario[] = [
  { id: 'wash', name: 'Washer 800 rpm', m1: 2000, N: 800, unit: 'rpm', x: 0.3, story: 'A washing machine and its floor (equivalent mass 2000 kg) resonate at the 800 rpm spin speed (like 2023 A1.4).' },
  { id: 'motor', name: 'Motor 1200 rpm', m1: 40, N: 1200, unit: 'rpm', x: 0.2, story: 'A 40 kg motor assembly on a hinged beam is in resonance at its 1200 rpm operating speed (like 2024 A1.5).' },
  { id: 'week5', name: 'Fan, 38 %', m1: 100, N: 600, unit: 'rpm', x: 0.38, story: 'A 100 kg fan runs at 600 rpm, exactly at its resonance; Week 5 Q1 asks for a 38 % margin.' },
  { id: 'tower', name: 'Tower ±2 %', m1: 5e6, N: 0.15, unit: 'Hz', x: 0.02, story: 'A 5000 t tower sways at 0.15 Hz; wind or seismic excitation sits within ±2 % of it (like 2025 A1.2).' },
];

const omegaOf = (s: Scenario) => (s.unit === 'rpm' ? (s.N * 2 * Math.PI) / 60 : s.N * 2 * Math.PI);
const TUNE_TOL = 0.005; // |β − 1| for "tuned"
// A light absorber's notch is very narrow (|X₁| at Ω = |β² − 1|/(μβ²)), so "stands still" is also checked directly:
// at most a tenth of the static deflection F₀/k₁ (the Tower's μ ≈ 0.0016 needs |β − 1| below about 1e-4).
const STILL_TOL = 0.1;
const MU0 = 0.05;

function randomScenario(): Scenario {
  const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
  const m1 = pick([25, 60, 150, 400, 900, 2500]);
  const N = pick([600, 900, 1200, 1500, 1800, 2400, 3000]);
  const x = pick([0.1, 0.15, 0.2, 0.25, 0.3, 0.35]);
  return { id: 'random', name: 'Random', m1, N, unit: 'rpm', x, story: `A ${m1} kg machine runs at ${N} rpm, right at its resonance. Keep both new resonances at least ${Math.round(x * 100)} % away.` };
}

export default function AbsorberTuning() {
  const p = useProgress();
  const done = !!p.challenges[TUNING_CHALLENGE];
  const [sc, setSc] = useState<Scenario>(SCENARIOS[0]);
  const W = omegaOf(sc);
  const k1 = sc.m1 * W * W;
  const [m2, setM2raw] = useState(MU0 * SCENARIOS[0].m1);
  const [k2, setK2] = useState(MU0 * SCENARIOS[0].m1 * omegaOf(SCENARIOS[0]) ** 2);
  const [keep, setKeep] = useState(false);
  const [gT, setGT] = useState(1);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const mu = m2 / sc.m1;
  const beta = Math.sqrt(k2 / m2 / (k1 / sc.m1));
  const [g1, g2] = newFrequenciesG(mu, beta);
  const muMin = muFromRatio(1 - sc.x);
  const muUp = muFromRatio(1 + sc.x);
  const at = absorberSigned(mu, beta, 1);
  const tuned = Math.abs(beta - 1) <= TUNE_TOL && Math.abs(at.x1) <= STILL_TOL;
  const lowOk = g1 <= 1 - sc.x + 1e-9;
  const upOk = g2 >= 1 + sc.x - 1e-9;
  const atT = absorberSigned(mu, beta, gT);

  const gLo = Math.max(0.02, 1 - 3 * sc.x);
  const gHi = 1 + 3 * sc.x;
  const u = sc.unit;
  const sp = (g: number) => g * sc.N; // speed in the scenario's unit
  const f3 = (v: number) => fmt(v, 3);

  const setM2 = (v: number) => {
    setM2raw(v);
    if (keep) setK2(v * W * W);
    setMsg(null);
  };
  const tune = () => {
    setK2(m2 * W * W);
    setMsg(null);
  };
  const choose = (s: Scenario, muStart = MU0) => {
    const w = omegaOf(s);
    setSc(s);
    setM2raw(muStart * s.m1);
    setK2(muStart * s.m1 * w * w);
    setGT(1);
    setMsg(null);
  };

  const resp = useMemo(() => {
    const feats = [g1, g2, beta].filter((g) => g > gLo && g < gHi);
    const xs = featureGrid(gLo, gHi, 500, feats);
    const y = new Float64Array(xs.length);
    const y0 = new Float64Array(xs.length);
    const xsU = new Float64Array(xs.length);
    for (let i = 0; i < xs.length; i++) {
      y[i] = primaryAmplitude(mu, beta, xs[i]);
      y0[i] = 1 / Math.abs(1 - xs[i] * xs[i]);
      xsU[i] = xs[i] * sc.N;
    }
    return { abs: { x: xsU, y }, none: { x: xsU, y: y0 } };
  }, [mu, beta, g1, g2, gLo, gHi, sc.N]);

  const muLo = Math.max(1e-5, muMin / 40);
  const muHi = Math.min(4, muMin * 12);
  const branches = useMemo(() => {
    const lo = sample((m) => newFrequenciesG(m, beta)[0], muLo, muHi, 240, true);
    const hi = sample((m) => newFrequenciesG(m, beta)[1], muLo, muHi, 240, true);
    const lo1 = sample((m) => newFrequenciesG(m, 1)[0], muLo, muHi, 240, true);
    const hi1 = sample((m) => newFrequenciesG(m, 1)[1], muLo, muHi, 240, true);
    return { lo, hi, lo1, hi1 };
  }, [beta, muLo, muHi]);

  const check = () => {
    if (!tuned) {
      setMsg({
        ok: false,
        text: `**Not tuned** ($\\beta$ = ${fmt(beta, 6)}). The absorber's own frequency is ${fmt(sp(beta), 6)} ${u}, so the machine's zero is not at the operating speed and it still vibrates there ($|X_1|$ = ${f3(Math.abs(at.x1))} $F_0/k_1$). Make $\\sqrt{k_2/m_2} = \\Omega$: $k_2 = m_2\\Omega^2$ = ${fmt(m2 * W * W, 4)} N/m.`,
      });
      return;
    }
    if (!lowOk) {
      setMsg({ ok: false, text: `The lower new resonance is only ${f3((1 - g1) * 100)} % below the operating speed: inside the ±${Math.round(sc.x * 100)} % band. Increase $\\mu$ (and re-tune $k_2$).` });
      return;
    }
    if (!upOk) {
      setMsg({ ok: false, text: `The upper new resonance is only ${f3((g2 - 1) * 100)} % above the operating speed. Increase $\\mu$.` });
      return;
    }
    if (mu > 1.05 * muMin) {
      setMsg({ ok: false, text: `Both resonances clear the band, but $\\mu$ = ${f3(mu)} is ${f3((mu / muMin - 1) * 100)} % heavier than needed. Find the lightest absorber that still works (within 5 %).` });
      return;
    }
    completeChallenge(TUNING_CHALLENGE);
    setMsg({
      ok: true,
      text: `**Lightest working absorber.** $\\mu$ = ${f3(mu)} (minimum ${f3(muMin)}), $m_2$ = ${fmt(m2, 4)} kg, $k_2 = m_2\\Omega^2$ = ${fmt(k2, 4)} N/m. The lower resonance (${fmt(sp(g1), 4)} ${u}) sits just below its limit of ${fmt(sp(1 - sc.x), 4)} ${u}; the upper one is automatically well clear, at ${fmt(sp(g2), 4)} ${u}, because $r_1 r_2 = 1$.`,
    });
  };

  const sAnim = 26 / Math.max(Math.abs(atT.x1), Math.abs(atT.x2), 3);
  const yClamp = (v: number) => Math.max(0.012, Math.min(80, v));

  return (
    <div>
      <Callout kind="info" title="Challenge">
        <Rich
          text={`${sc.story} Add an undamped absorber ($m_2$, $k_2$) so that the machine **stands still at ${fmt(sc.N, 3)} ${u}** and **both new resonances are at least ${Math.round(sc.x * 100)} % away** from it. Use the **lightest** absorber that does it (within 5 %).`}
        />
      </Callout>
      <SimLayout
        visual={
          <>
            <Plot
              x={{ min: sp(gLo), max: sp(gHi), label: `machine speed (${u})` }}
              y={{ min: 0.01, max: 100, log: true, label: '|X₁| / (F₀/k₁)' }}
              height={250}
              ariaLabel="Machine amplitude against speed, with and without the absorber"
            >
              <Band x0={sp(1 - sc.x)} x1={sp(1 + sc.x)} color="var(--warn)" opacity={0.13} />
              <PlotText x={sp(1 - sc.x)} y={0.016} dx={3} color="var(--warn)">
                {`±${Math.round(sc.x * 100)} %`}
              </PlotText>
              <Line points={resp.none} color="var(--text-3)" dash width={1.4} />
              <Line points={resp.abs} color="var(--text)" width={2.3} />
              <VLine x={sp(1)} color="var(--text-2)" dash={false} width={1} label="Ω" />
              <VLine x={sp(g1)} color="var(--m1)" />
              <VLine x={sp(g2)} color="var(--m2)" />
              <Handle x={sp(gT)} y={yClamp(primaryAmplitude(mu, beta, gT))} axis="x" clampX={[sp(gLo), sp(gHi)]} onChange={(x) => setGT(x / sc.N)} color="var(--accent)" ariaLabel="test speed (drag to see the motion at another speed)" />
            </Plot>
            <Legend
              items={[
                { label: 'with absorber', color: 'var(--text)' },
                { label: 'no absorber', color: 'var(--text-3)', dash: true },
                { label: 'new resonance 1', color: 'var(--m1)', dash: true },
                { label: 'new resonance 2', color: 'var(--m2)', dash: true },
              ]}
            />
            <Plot
              x={{ min: muLo, max: muHi, log: true, label: 'mass ratio μ = m₂/m₁' }}
              y={{ min: gLo, max: gHi, label: 'ωᵢ / Ω', ticks: [1 - 2 * sc.x, 1 - sc.x, 1, 1 + sc.x, 1 + 2 * sc.x].filter((v) => v >= gLo && v <= gHi), format: (v) => fmt(v, 3) }}
              height={220}
              ariaLabel="New natural frequencies against mass ratio, with the forbidden band"
            >
              <HBand y0={1 - sc.x} y1={1 + sc.x} color="var(--warn)" opacity={0.13} />
              {Math.abs(beta - 1) > 1e-6 && (
                <>
                  <Line points={branches.lo1} color="var(--text-3)" dash width={1.2} />
                  <Line points={branches.hi1} color="var(--text-3)" dash width={1.2} />
                </>
              )}
              <Line points={branches.lo} color="var(--m1)" width={2.2} />
              <Line points={branches.hi} color="var(--m2)" width={2.2} />
              <Dot x={muUp} y={1 + sc.x} hollow color="var(--text-2)" />
              <Dot x={muMin} y={1 - sc.x} hollow color="var(--text-2)" />
              <HaloText x={muUp} y={1 + sc.x} dx={7} dy={15}>
                {`upper-limit μ = ${f3(muUp)}`}
              </HaloText>
              <HaloText x={muMin} y={1 - sc.x} dx={7} dy={-8}>
                {`lower-limit μ = ${f3(muMin)}`}
              </HaloText>
              <VLine x={mu} color="var(--accent)" dash={false} width={1.4} />
              <Dot x={mu} y={g1} color="var(--m1)" />
              <Dot x={mu} y={g2} color="var(--m2)" />
            </Plot>
            <Rich
              className="note"
              text={`Lower plot: the two new natural frequencies against $\\mu$ for the current tuning (dashed grey: perfectly tuned). Hollow dots: the two candidate mass ratios, $\\mu$ = ${f3(muUp)} from the upper limit and $\\mu$ = ${f3(muMin)} from the lower limit. Drag the ring on the upper plot to watch the machine at other speeds.`}
            />
          </>
        }
        controls={
          <>
            <Segmented
              size="sm"
              label="Scenario"
              value={sc.id}
              onChange={(id) => {
                const s = SCENARIOS.find((q) => q.id === id);
                if (s) choose(s);
              }}
              options={[...SCENARIOS.map((s) => ({ value: s.id, label: s.name })), ...(sc.id === 'random' ? [{ value: 'random', label: 'Random' }] : [])]}
            />
            <Button size="sm" onClick={() => choose(randomScenario())}>
              Random machine
            </Button>
            <ChainAnim
              vertical
              unbalance
              maxWidth={200}
              a1={atT.x1 * sAnim}
              a2={atT.x2 * sAnim}
              driven={1}
              labels={{ m1: 'm₁', m2: 'm₂' }}
              ariaLabel="Machine on a spring with the absorber mass on top, moving at the test speed"
            />
            <div className="row gap-s wrap" style={{ justifyContent: 'center' }}>
              <span className="muted small">
                Motion at the test speed, {f3(sp(gT))} {u} (slowed to 0.6 Hz)
              </span>
              {Math.abs(gT - 1) > 1e-6 && (
                <Button size="sm" variant="ghost" onClick={() => setGT(1)}>
                  back to Ω
                </Button>
              )}
            </div>
            <Slider label="absorber mass" tex="m_2" tip="absorber mass; μ = m₂/m₁" value={m2} min={sc.m1 * 1e-4} max={sc.m1 * 3} log unit="kg" sig={4} onChange={setM2} />
            <Slider
              label="absorber spring"
              tex="k_2"
              tip="absorber stiffness; tuned when k₂ = m₂Ω²"
              value={k2}
              min={k1 * 5e-5}
              max={k1 * 6}
              log
              unit="N/m"
              sig={4}
              disabled={keep}
              onChange={(v) => {
                setK2(v);
                setMsg(null);
              }}
            />
            <div className="row gap-s wrap">
              <Button size="sm" variant="primary" onClick={tune} disabled={keep || tuned}>
                Tune: k₂ = m₂Ω²
              </Button>
              <Toggle checked={keep} onChange={(v) => { setKeep(v); if (v) setK2(m2 * W * W); }} label="keep tuned" />
            </div>
            <Readouts>
              <Readout tex="\mu" tip="mass ratio m₂/m₁" value={mu} sig={3} />
              <Readout tex="\beta" tip="tuning: ω₂₂/ω₁₁ = √(k₂/m₂)/Ω here" value={beta} sig={4} tone={tuned ? 'ok' : 'bad'} />
              <Readout tex="\omega_1" tip="lower new natural frequency" value={sp(g1)} unit={u} sig={4} tone={lowOk ? 'm1' : 'bad'} />
              <Readout tex="\omega_2" tip="upper new natural frequency" value={sp(g2)} unit={u} sig={4} tone={upOk ? 'm2' : 'bad'} />
              <Readout label="ω₁ below Ω" tip="(1 − ω₁/Ω) × 100" value={(1 - g1) * 100} unit="%" sig={3} tone={lowOk ? 'ok' : 'bad'} />
              <Readout label="ω₂ above Ω" tip="(ω₂/Ω − 1) × 100" value={(g2 - 1) * 100} unit="%" sig={3} tone={upOk ? 'ok' : 'bad'} />
              <Readout tex="|X_1|" tip="machine amplitude at Ω, in static deflections F₀/k₁" value={Math.abs(at.x1) < 1e-9 ? 0 : Math.abs(at.x1)} unit="F₀/k₁" sig={3} tone={tuned ? 'ok' : 'bad'} />
              <Readout tex="|X_2|" tip="absorber amplitude at Ω (= F₀/k₂ = 1/μ static deflections when tuned)" value={Math.abs(at.x2)} unit="F₀/k₁" sig={3} />
            </Readouts>
            <div className="row gap-s wrap">
              <Button variant="primary" onClick={check}>
                Check my design
              </Button>
              {done && <Badge tone="ok">✓ Challenge complete</Badge>}
            </div>
            {msg && (
              <Callout kind={msg.ok ? 'ok' : 'bad'} title={msg.ok ? 'Design accepted' : 'Not yet'}>
                <Rich text={msg.text} />
              </Callout>
            )}
          </>
        }
      />
      <PredictReveal
        id="a4-tune-binds"
        question="Washer, ±30 % band. You raise $\mu$ from zero, keeping the absorber tuned. Which new resonance is the **last** to leave the band?"
        options={['the lower one', 'the upper one', 'both leave together']}
        answer={0}
        explain="With $\beta = 1$, $r_1 r_2 = 1$: the frequencies spread geometrically. The upper one reaches 1.30 at $\mu$ = 0.282, when the lower is still at 1/1.30 = 0.769 (only 23 % below). The lower reaches 0.70 only at $\mu = (1/0.7 - 0.7)^2$ = 0.531, by which time the upper is at 1.43. So size on the lower limit: Week 5's two candidates are 0.43 and 0.99, and only 0.99 works."
        tryIt="set the upper-limit design μ = 0.282 and look where ω₁ sits."
        onApply={() => {
          const s = SCENARIOS[0];
          const w = omegaOf(s);
          const m = muFromRatio(1.3) * s.m1;
          setSc(s);
          setM2raw(m);
          setK2(m * w * w);
          setGT(1);
          setMsg(null);
        }}
      />
      <PredictReveal
        id="a4-tune-detune"
        question="Start from a working design, then **double $m_2$ but keep $k_2$**. At the operating speed the machine…"
        options={['stays still: a heavier absorber only helps', 'vibrates: the absorber is now tuned to Ω/√2', 'vibrates: the absorber is now tuned to √2 Ω']}
        answer={1}
        explain="The machine's zero sits at the absorber's own frequency $\sqrt{k_2/m_2}$, which drops to $\Omega/\sqrt2$. At $\Omega$ the machine is no longer held still. A heavier absorber needs a proportionally stiffer spring, $k_2 = m_2\Omega^2 = \mu k_1$, to stay tuned (2023 A1.4 note)."
        tryIt="press Show me, then watch the machine and the β readout."
        onApply={() => {
          const s = sc;
          const w = omegaOf(s);
          const md = muFromRatio(1 - s.x) * 1.02 * s.m1;
          setKeep(false);
          setM2raw(2 * md);
          setK2(md * w * w);
          setGT(1);
          setMsg(null);
        }}
      />
      <PredictReveal
        id="a4-tune-stroke"
        question="Tower, ±2 % band: the lightest absorber has $\mu \approx$ 0.0016. At the operating frequency, how far does it swing compared with the tower's static deflection $F_0/k_1$?"
        options={['about the same', 'about 6 times', 'about 600 times']}
        answer={2}
        explain="Tuned, $X_2 = -F_0/k_2 = -(1/\mu)\,F_0/k_1$, about 610 static deflections. The absorber's spring force must cancel the whole excitation, so a light absorber needs a long stroke (and exact tuning: its notch is narrow). That is why real tuned mass dampers use a few per cent of the mass and add damping."
        tryIt="pick the Tower scenario with the lightest working absorber and read |X₂|."
        onApply={() => {
          const s = SCENARIOS[3];
          const w = omegaOf(s);
          const m = muFromRatio(0.98) * 1.01 * s.m1;
          setSc(s);
          setM2raw(m);
          setK2(m * w * w);
          setGT(1);
          setMsg(null);
        }}
      />
    </div>
  );
}
