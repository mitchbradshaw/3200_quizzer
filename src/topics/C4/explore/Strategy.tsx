// "Choose a strategy": randomised scenario cards (unbalanced fan, fixed-speed pump on a frame, variable-speed
// drive, microscope on a busy floor, footbridge, flutter...). The student picks one of seven strategies; the
// feedback says why it fits or not, and the plot shows the structure's response now and what the chosen
// strategy would do to it (simple SDOF model, see ../scenarios.ts). Five first-choice answers in a row
// complete the challenge.
import { useMemo, useState } from 'react';
import { freshSeed, makeRng } from '../../../engine/rng';
import { fmt } from '../../../engine/format';
import { magnification } from '../../../physics/sdof';
import { Band, Line, Plot, VLine, sample } from '../../../plot/Plot';
import { Badge, Button, Callout, Legend, More, SimLayout } from '../../../ui/kit';
import { PredictReveal } from '../../../ui/PredictReveal';
import { completeChallenge, useProgress } from '../../../app/store';
import { Rich } from '../../../ui/Rich';
import { bandEffect, responseFn, STRATEGIES, strategyById, TEMPLATES, templateById, type Scenario, type StrategyId } from '../scenarios';

export const STRAT_CHALLENGE = 'c4-strategy-streak';
const STREAK = 5;

const METRIC_LABEL = { force: 'response X/(F₀/k)', unbalance: 'response X/(me/M)', trans: 'fraction transmitted T' } as const;
const VERDICT = {
  best: { kind: 'ok' as const, title: 'First choice', mark: '✓' },
  ok: { kind: 'warn' as const, title: 'Works, but not the first choice', mark: '~' },
  poor: { kind: 'bad' as const, title: 'Does not fit this problem', mark: '✗' },
};

interface Deck {
  seed: number;
  order: string[];
  i: number;
  /** false for cards loaded by a "Show me" demo: they do not count towards the streak. */
  counted: boolean;
}

function newDeck(first?: string, avoid?: string): Deck {
  const seed = freshSeed();
  let order = makeRng(seed).shuffle(TEMPLATES.map((t) => t.id));
  if (first) order = [first, ...order.filter((id) => id !== first)];
  else if (avoid && order[0] === avoid) order = [...order.slice(1), order[0]];
  return { seed, order, i: 0, counted: !first };
}

/** A seed for which template `id` builds a scenario whose title contains `title` (for the demos). */
function seedFor(id: string, title: string): number {
  const t = templateById(id)!;
  for (let s = 1; s < 500; s++) if (t.make(makeRng(s)).title.includes(title)) return s;
  return 1;
}

// Many closely spaced cable modes (power-line card): f in units of the first cable mode.
const comb = (zeta: number) => (f: number) => {
  let s = 0;
  for (let n = 1; n <= 14; n++) s += magnification(f / n, zeta) / n;
  return s;
};

export default function Strategy() {
  const progress = useProgress();
  const done = !!progress.challenges[STRAT_CHALLENGE];
  const [deck, setDeck] = useState<Deck>(() => newDeck());
  const [forcedSeed, setForcedSeed] = useState<number | null>(null);
  const [first, setFirst] = useState<StrategyId | null>(null);
  const [shown, setShown] = useState<StrategyId | null>(null);
  const [streak, setStreak] = useState(0);
  const [tally, setTally] = useState({ n: 0, best: 0 });

  const tid = deck.order[deck.i];
  const sc: Scenario = useMemo(() => templateById(tid)!.make(makeRng(forcedSeed ?? deck.seed * 31 + deck.i * 7 + 1)), [tid, deck.seed, deck.i, forcedSeed]);

  const pick = (s: StrategyId) => {
    setShown(s);
    if (first || !deck.counted) return;
    setFirst(s);
    const v = sc.verdicts[s].v;
    const nextStreak = v === 'best' ? streak + 1 : v === 'ok' ? streak : 0;
    setStreak(nextStreak);
    setTally((t) => ({ n: t.n + 1, best: t.best + (v === 'best' ? 1 : 0) }));
    if (nextStreak >= STREAK) completeChallenge(STRAT_CHALLENGE);
  };
  const next = () => {
    setFirst(null);
    setShown(null);
    setForcedSeed(null);
    setDeck((d) => (d.i + 1 < d.order.length ? { ...d, i: d.i + 1, counted: true } : newDeck(undefined, d.order[d.i])));
  };
  const demo = (id: string, title: string, s: StrategyId) => {
    setDeck(newDeck(id));
    setForcedSeed(seedFor(id, title));
    setFirst(null);
    setShown(s);
  };

  // ---------------------------------------------------------------- plot data
  const p = sc.plot;
  const now = useMemo(() => (p ? sample(responseFn(p, null)!, p.fmax / 1200, p.fmax, 1200) : null), [p]);
  const after = useMemo(() => {
    const fn = p && shown ? responseFn(p, shown) : null;
    return p && fn ? sample(fn, p.fmax / 1200, p.fmax, 1200) : null;
  }, [p, shown]);
  const effect = useMemo(() => (p && shown ? bandEffect(p, shown) : null), [p, shown]);
  const change = effect && effect.after !== null ? effect.after / effect.before - 1 : 0;
  const yTop = useMemo(() => {
    if (!now) return 10;
    let m = 1;
    for (let i = 0; i < now.y.length; i++) m = Math.max(m, now.y[i]);
    return Math.pow(10, Math.ceil(Math.log10(m * 1.5)));
  }, [now]);
  const growth = useMemo(() => sample((t) => Math.exp(0.035 * 2 * Math.PI * t) * Math.sin(2 * Math.PI * t), 0, 12, 900), []);
  const growthAfter = useMemo(
    () => (shown === 'stability' ? sample((t) => Math.exp(-0.04 * 2 * Math.PI * t) * Math.sin(2 * Math.PI * t), 0, 12, 900) : shown === 'damp' ? sample((t) => Math.exp(0.012 * 2 * Math.PI * t) * Math.sin(2 * Math.PI * t), 0, 12, 900) : null),
    [shown]
  );
  const isComb = sc.template === 'power-line';
  const combNow = useMemo(() => sample(comb(0.005), 0.05, 12, 1500), []);
  const combAfter = useMemo(() => (isComb && shown === 'absorber' ? sample(comb(0.05), 0.05, 12, 1500) : null), [isComb, shown]);

  const sv = shown ? sc.verdicts[shown] : null;
  const firstV = first ? sc.verdicts[first].v : null;
  const bestDef = strategyById(sc.best);

  return (
    <div>
      <Callout kind="info" title={`Challenge: ${STREAK} first-choice answers in a row`}>
        <Rich text="Read the scenario, look at where the operating frequency sits on the response, and pick the strategy the course would reach for **first**. A workable but second-best choice keeps your streak; a poor one resets it. After answering, click other strategies to see why they fit or not." />
        <div className="row gap-s wrap">
          <span className="small">Streak</span>
          {Array.from({ length: STREAK }, (_, i) => (
            <Badge key={i} tone={i < streak ? 'ok' : 'muted'}>
              {i < streak ? '●' : '○'}
            </Badge>
          ))}
          <span className="small muted">
            {tally.n} answered · {tally.best} first choice
          </span>
          {done && <Badge tone="ok">✓ Challenge complete</Badge>}
        </div>
      </Callout>
      <SimLayout
        visual={
          <>
            <div className="row between">
              <h3 style={{ margin: 0 }}>{sc.title}</h3>
              {!deck.counted && <Badge tone="muted">demo card: not counted</Badge>}
            </div>
            <Rich text={sc.text} />
            <div className="row gap-s wrap">
              {sc.chips.map((c, i) => (
                <span key={i} className="chip">
                  {c}
                </span>
              ))}
            </div>
            {p && now && (
              <>
                <Plot x={{ min: 0, max: p.fmax, label: 'frequency (Hz)' }} y={{ min: 0.005, max: yTop, log: true, label: METRIC_LABEL[p.metric] }} height={250} ariaLabel="Response of the structure against frequency, with the operating band">
                  {p.band[1] > p.band[0] ? <Band x0={p.band[0]} x1={p.band[1]} color="var(--m2)" opacity={0.12} label="operating range" /> : <VLine x={p.band[0]} color="var(--m2)" label="operating" />}
                  <Line points={now} color={after ? 'var(--text-3)' : 'var(--m1)'} width={after ? 1.6 : 2.4} dash={after ? true : undefined} />
                  {after && <Line points={after} color="var(--m1)" width={2.4} />}
                </Plot>
                <Legend
                  items={[
                    { label: p.rigid ? 'now (bolted down: T = 1)' : 'now', color: after ? 'var(--text-3)' : 'var(--m1)', dash: !!after },
                    ...(after && shown ? [{ label: `after: ${strategyById(shown).label}`, color: 'var(--m1)' }] : []),
                    { label: p.band[1] > p.band[0] ? 'operating range (shaded)' : 'operating frequency', color: 'var(--m2)' },
                  ]}
                />
                {effect && (
                  <div className="row gap-s wrap small">
                    {effect.after === null ? (
                      <Badge tone="muted">{strategyById(shown!).label}: no change to this model (see why)</Badge>
                    ) : (
                      <Badge tone={effect.after <= 0.5 * effect.before ? 'ok' : effect.after >= 0.95 * effect.before ? 'bad' : 'warn'}>
                        worst in the operating range: {fmt(effect.before, 3)} → {fmt(effect.after, 3)} ({Math.abs(change) < 0.005 ? 'no change' : `${change < 0 ? '−' : '+'}${fmt(Math.abs(change) * 100, 2)} %`})
                      </Badge>
                    )}
                  </div>
                )}
              </>
            )}
            {sc.growth && (
              <>
                <Plot x={{ min: 0, max: 12, label: 'time (cycles)' }} y={{ min: -15, max: 15, label: 'vibration' }} height={200} ariaLabel="A self-excited vibration growing with time">
                  <Line points={growth} color={growthAfter ? 'var(--text-3)' : 'var(--m1)'} width={growthAfter ? 1.4 : 2} dash={growthAfter ? true : undefined} />
                  {growthAfter && <Line points={growthAfter} color="var(--m1)" width={2.2} />}
                </Plot>
                <Legend
                  items={[
                    { label: 'now: grows by itself', color: growthAfter ? 'var(--text-3)' : 'var(--m1)', dash: !!growthAfter },
                    ...(growthAfter && shown ? [{ label: `after: ${strategyById(shown).label}${shown === 'damp' ? ' (grows more slowly)' : ' (decays)'}`, color: 'var(--m1)' }] : []),
                  ]}
                />
                <p className="small muted">No forcing frequency to compare with: the oscillation feeds itself and grows (negative damping) once a parameter passes its critical value.</p>
              </>
            )}
            {isComb && (
              <>
                <Plot x={{ min: 0, max: 12, label: 'frequency / first cable mode' }} y={{ min: 0.1, max: 200, log: true, label: 'response' }} height={220} ariaLabel="Many closely spaced cable modes with the wind's frequency range">
                  <Band x0={4} x1={10} color="var(--m2)" opacity={0.12} label="vortex-shedding range" />
                  <Line points={combNow} color={combAfter ? 'var(--text-3)' : 'var(--m1)'} width={combAfter ? 1.3 : 1.8} dash={combAfter ? true : undefined} />
                  {combAfter && <Line points={combAfter} color="var(--m1)" width={2.2} />}
                </Plot>
                <Legend
                  items={[
                    { label: 'now', color: combAfter ? 'var(--text-3)' : 'var(--m1)', dash: !!combAfter },
                    ...(combAfter ? [{ label: 'after: multi-DoF absorbers (many peaks damped)', color: 'var(--m1)' }] : []),
                    { label: 'wind’s range', color: 'var(--m2)' },
                  ]}
                />
                <p className="small muted">A cable has many closely spaced modes; the wind excites whichever fall in its range.</p>
              </>
            )}
          </>
        }
        controls={
          <>
            <div className="small muted">{first ? 'Your first answer counts; click others to compare.' : deck.counted ? 'Pick the strategy you would reach for first:' : 'Demo card: explore freely.'}</div>
            <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {STRATEGIES.map((s) => {
                const v = first || !deck.counted ? sc.verdicts[s.id].v : null;
                const mark = v && (first || shown) ? VERDICT[v].mark : '';
                return (
                  <Button key={s.id} variant={shown === s.id ? 'primary' : v === 'best' && first ? 'ok' : 'default'} onClick={() => pick(s.id)} title={s.does.replace(/\$[^$]*\$/g, '…')} aria-pressed={shown === s.id}>
                    {mark && <span aria-hidden="true">{mark} </span>}
                    {s.label}
                  </Button>
                );
              })}
            </div>
            {sv && shown && (
              <Callout kind={VERDICT[sv.v].kind} title={`${VERDICT[sv.v].mark} ${strategyById(shown).label}: ${VERDICT[sv.v].title}`}>
                <Rich text={sv.why} />
              </Callout>
            )}
            {shown && sv && sv.v !== 'best' && (
              <Callout kind="info" title={`First choice: ${bestDef.label}`}>
                <Rich text={sc.verdicts[sc.best].why} />
              </Callout>
            )}
            {(first || shown) && (
              <div className="small">
                <Rich text={`**Cue.** ${sc.cue}`} />
              </div>
            )}
            {firstV && (
              <div className="small muted">
                {firstV === 'best' ? `Streak ${streak}/${STREAK}.` : firstV === 'ok' ? 'Streak kept (a workable choice).' : 'Streak reset.'}
              </div>
            )}
            <div className="row gap-s wrap">
              <Button variant={first || !deck.counted ? 'primary' : 'default'} onClick={next}>
                {first || !deck.counted ? 'Next scenario →' : 'Skip'}
              </Button>
            </div>
          </>
        }
      />
      <More label="The toolbox: what each strategy does and the cues that call for it">
        <table className="table small">
          <thead>
            <tr>
              <th>Strategy</th>
              <th>What it does</th>
              <th>Cue in the question</th>
            </tr>
          </thead>
          <tbody>
            {STRATEGIES.map((s) => (
              <tr key={s.id}>
                <td>{s.label}</td>
                <td>
                  <Rich text={s.does} inline />
                </td>
                <td>
                  <Rich text={s.cue} inline />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </More>
      <PredictReveal
        id="c4-strat-rigid-absorber"
        question="A camera is bolted rigidly to a platform that shakes at 2 Hz. You fix a tuned absorber (tuned to 2 Hz) to the camera. The camera’s motion…"
        options={['falls to almost zero at 2 Hz', 'does not change: the bolts impose the platform’s motion', 'doubles']}
        answer={1}
        explain="An absorber works by making a flexibly mounted primary stand still at its tuning frequency. A rigidly fixed camera has no flexibility: its motion **is** the platform’s motion, whatever is attached to it. A soft cushion ($k < m\Omega^2/2$) is what isolates it (2022 A1.1)."
        tryIt="load the camera scenario and look at the absorber’s effect."
        onApply={() => demo('receiver', 'camera', 'absorber')}
      />
      <PredictReveal
        id="c4-strat-band-retune"
        question="A frame’s mode lies inside a variable-speed drive’s range. You stiffen the frame so its natural frequency rises by 60 %. The worst response over the speed range…"
        options={['falls a lot', 'hardly changes: the peak just moves to another speed in the range', 'rises sharply']}
        answer={1}
        explain="Retuning works when the forcing frequency is **fixed**: it moves the peak away from it. When the speed sweeps a range that still contains the new natural frequency, some speed still matches it, and the peak height $1/2\zeta$ is unchanged. Only damping lowers the peak itself (LC4.4)."
        tryIt="load the variable-speed conveyor and compare ‘Retune’ with ‘Add damping’."
        onApply={() => demo('variable-speed', 'conveyor', 'retune')}
      />
      <PredictReveal
        id="c4-strat-tmd-band"
        question="Same conveyor: instead, you fit a tuned absorber ($\mu$ = 0.05) tuned to the frame’s mode. Over the whole speed range the worst response…"
        options={['drops to near zero', 'drops, but two new peaks remain inside the range', 'is unchanged']}
        answer={1}
        explain="The absorber turns the old peak into an anti-resonance, but creates two new resonances at about 0.89 and 1.12 × the tuning frequency, both still inside a wide speed range. Absorbers suit one frequency (2024 A3.6(e)); damping suits a sweep."
        tryIt="load the conveyor and pick ‘Tuned absorber’."
        onApply={() => demo('variable-speed', 'conveyor', 'absorber')}
      />
    </div>
  );
}
