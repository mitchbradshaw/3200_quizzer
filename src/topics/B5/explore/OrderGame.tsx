// "Order the estimates": put Dunkerley, Rayleigh, Holzer and FEM estimates in order for real scenarios,
// then see the computed values on a number line. Last round: the official "which orders are possible".
import { useMemo, useState } from 'react';
import { endInertiaRoots } from '../../../physics/waves';
import { Dot, Plot, VLine } from '../../../plot/Plot';
import { Badge, Button, Callout, ProgressBar } from '../../../ui/kit';
import { PredictReveal } from '../../../ui/PredictReveal';
import { Rich } from '../../../ui/Rich';
import { completeChallenge, useProgress } from '../../../app/store';
import { hashString, makeRng } from '../../../engine/rng';
import { fmt } from '../../../engine/format';
import { TIP_MASS_FORMS, feBeam, shaftDiscDunkerley, shaftDiscHolzer, shaftDiscRayleigh, tipFormC, tipMassDunkerley, tipMassExact, tipMassRayleighMode, tipMassRayleighTipLoad, tipMassRoots } from '../physics';

export const ORDER_CHALLENGE = 'b5-order-estimates';

interface Item {
  id: string;
  label: string;
  /** Short tag for the number line. */
  short: string;
  value: number;
}
interface Round {
  id: string;
  title: string;
  setup: string;
  unit: string;
  items: Item[];
  /** Reference value drawn as a line (exact or converged). */
  ref?: { label: string; value: number };
  explain: string;
  source: string;
}

function buildRounds(): Round[] {
  // Tower with a nacelle mass mu = 0.5 (2023 B1.8): omega = C sqrt(EI/(M L^3)).
  const mu = 0.5;
  const exactT = tipMassRoots(mu, 1)[0] ** 2 * Math.sqrt(mu);
  const fem4 = feBeam({ left: 'clamped', right: 'free', nel: 4, masses: [{ x: 1, M: mu }], nModes: 1 }).omega[0] * Math.sqrt(mu);
  // Sample Problem 7(b): grinding tool with the disc stalled (reader p. 125).
  const G = 80e9;
  const rho = 7700;
  const Jp = 1e-4;
  const l = 0.5;
  const J1 = 20;
  const c = Math.sqrt(G / rho);
  const K = (G * Jp) / l;
  const Ia = rho * Jp * l;
  const exact7 = (endInertiaRoots(Ia / J1, 1)[0] * c) / l;
  const ray7 = Math.sqrt(K / (J1 + Ia / 3));
  const dun7 = 1 / Math.sqrt(((2 * l) / (Math.PI * c)) ** 2 + J1 / K);
  const hol7 = Math.sqrt(K / J1);
  const toHz = (w: number) => w / (2 * Math.PI);
  // Shaft with an end disc, beta = Ia/Id = 1 (Week 10 Q3 style), alpha in sqrt(G/(rho L^2)).
  const beta = 1;
  // Bare cantilever FE meshes (LB9; 2022 B1.8(d)).
  const fe = (n: number, lumped: boolean) => feBeam({ left: 'clamped', right: 'free', nel: n, lumped, nModes: 1 }).omega[0];
  // Inverse: tip mass from a 5 % drop (2025 B2.4), mass in % of the beam mass.
  const r = 0.95;
  return [
    {
      id: 'tower',
      title: 'Wind-turbine tower with a nacelle',
      setup: 'A tower is modelled as a uniform cantilever with a tip mass of half the tower mass ($\\mu = M/\\rho AL = 0.5$). Put the estimates of the **fundamental** in order, lowest first.',
      unit: '√(EI/ML³)',
      items: [
        { id: 'D', label: 'Dunkerley', short: 'D', value: tipFormC(TIP_MASS_FORMS.dunkerley, mu) },
        { id: 'F', label: 'FEM, 4 beam elements (consistent mass)', short: 'FEM', value: fem4 },
        { id: 'Rt', label: 'Rayleigh, tip-load static shape', short: 'R tip-load', value: tipFormC(TIP_MASS_FORMS.tipLoad, mu) },
        { id: 'Rc', label: 'Rayleigh, 1 − cos(πx/2L)', short: 'R 1−cos', value: tipFormC(TIP_MASS_FORMS.cosine, mu) },
      ],
      ref: { label: 'exact', value: exactT },
      explain:
        'Dunkerley is the lower bound; an adequately refined FE model sits on the exact value; every Rayleigh estimate is above it, and the better trial shape (the tip-load static deflection, since the nacelle dominates) is the lower of the two. The official-style answer is “Dunkerley’s, FEM, Rayleigh’s”.',
      source: '2023 B1.8; LB7.7–LB8.3',
    },
    {
      id: 's7b',
      title: 'Grinding tool with the disc stalled',
      setup:
        'Reader Sample Problem 7(b): a 20 kg m² motor-pulley drives a disc through a steel shaft ($K$ = 1.6×10⁷ N m/rad, shaft inertia 0.385 kg m²). The disc is held fixed. Order the estimates of $f_1$. Holzer lumps the system as the motor-pulley inertia on a **massless** shaft.',
      unit: 'Hz',
      items: [
        { id: 'D', label: 'Dunkerley (shaft alone + motor-pulley on a massless shaft)', short: 'D', value: toHz(dun7) },
        { id: 'R', label: 'Rayleigh, linear twist: ω² = K/(J₁ + Iₐ/3)', short: 'R', value: toHz(ray7) },
        { id: 'H', label: 'Holzer on the lumped model: √(K/J₁)', short: 'H', value: toHz(hol7) },
      ],
      ref: { label: 'exact', value: toHz(exact7) },
      explain: `Dunkerley ${fmt(toHz(dun7), 7)} Hz ≤ exact ${fmt(toHz(exact7), 7)} Hz ≤ Rayleigh ${fmt(toHz(ray7), 7)} Hz < Holzer ${fmt(toHz(hol7), 7)} Hz. (The 20 kg m² motor-pulley is 52 times the shaft’s inertia, so Rayleigh’s linear twist is almost exact.) Holzer is exact **for its lumped model**, but that model ignores the shaft’s own inertia, so here it lands **above** Rayleigh: the order is D, R, H.`,
      source: 'Reader pp. 124–125 (Sample Problems 6–7); official 2016 B1.8',
    },
    {
      id: 'disc',
      title: 'Shaft fixed at one end, disc at the other',
      setup:
        'The shaft’s polar inertia equals the disc’s ($\\beta = I_a/I_d = 1$). This time the Holzer model lumps the shaft into **3 segments** (inertia shared between the stations). Order the estimates of $\\alpha$ in $\\omega_1 = \\alpha\\sqrt{G/\\rho L^2}$.',
      unit: '√(G/ρL²)',
      items: [
        { id: 'D', label: 'Dunkerley: (4/π² + 1/β)^−½', short: 'D', value: shaftDiscDunkerley(beta) },
        { id: 'H', label: 'Holzer, shaft lumped into 3 segments', short: 'H', value: shaftDiscHolzer(beta, 3) },
        { id: 'R', label: 'Rayleigh, linear twist: (1/β + 1/3)^−½', short: 'R', value: shaftDiscRayleigh(beta) },
      ],
      ref: { label: 'exact (α tan α = β)', value: endInertiaRoots(beta, 1)[0] },
      explain: `Dunkerley ${shaftDiscDunkerley(beta).toFixed(4)} < Holzer ${shaftDiscHolzer(beta, 3).toFixed(4)} < exact ${endInertiaRoots(beta, 1)[0].toFixed(4)} < Rayleigh ${shaftDiscRayleigh(beta).toFixed(4)}: the order is D, H, R. This lumping approaches the exact value from below as segments are added (2 segments 0.849, 4 segments 0.857). Together with the previous round, this is why the official key says “D, H, R **or** D, R, H”. (A very crude lumping, all of the shaft’s inertia halved onto the disc, gives 0.816, even below Dunkerley: lumping error can have either sign.)`,
      source: 'Week 10 Q3 (β randomised); official 2016 B1.8',
    },
    {
      id: 'mesh',
      title: 'FE mesh refinement (bare cantilever)',
      setup: 'A bare cantilever is meshed with beam elements, using either a **consistent** or a **lumped** (diagonal) mass matrix. Order the four FE values of $\\omega_1$.',
      unit: '√(EI/ρAL⁴)',
      items: [
        { id: 'L2', label: 'lumped mass, 2 elements', short: 'lumped 2', value: fe(2, true) },
        { id: 'L8', label: 'lumped mass, 8 elements', short: 'lumped 8', value: fe(8, true) },
        { id: 'C2', label: 'consistent mass, 2 elements', short: 'consistent 2', value: fe(2, false) },
        { id: 'C1', label: 'consistent mass, 1 element', short: 'consistent 1', value: fe(1, false) },
      ],
      ref: { label: 'exact 3.516', value: 1.875104 ** 2 },
      explain:
        'Consistent-mass elements are a Rayleigh–Ritz method, so they converge **from above**; lumped-mass models usually converge **from below**. Both approach 3.516 as the mesh is refined, so “FE always overestimates” (2022 B1.8(d)) and “bigger elements are more accurate” (2022 B1.8(b)) are both false.',
      source: '2022 B1.8; LB9; Week 9 Q4',
    },
    {
      id: 'inverse',
      title: 'Inverse problem: a tip mass from a 5 % drop',
      setup:
        'Blade tips lower a cantilevered blade’s first critical speed by 5 % (2025 B2.4). Order the **mass** estimates (as % of the blade mass). Careful: the roles flip when you solve for a mass.',
      unit: '% of the blade mass',
      items: [
        { id: 'D', label: 'Dunkerley: 3(1/r² − 1)/1.875⁴', short: 'D', value: 100 * tipMassDunkerley(r) },
        { id: 'Rm', label: 'Rayleigh with the blade’s own mode: (1/r² − 1)/4', short: 'R own mode', value: 100 * tipMassRayleighMode(r) },
        { id: 'Rt', label: 'Rayleigh with the tip-load static shape', short: 'R tip-load', value: 100 * tipMassRayleighTipLoad(r) },
      ],
      ref: { label: 'exact', value: 100 * tipMassExact(r) },
      explain:
        'Dunkerley underestimates the frequency for a given mass, so it needs the **least** mass to explain the drop; Rayleigh overestimates the frequency, so it needs the **most**: $M_D \\le M \\le M_R$. The bare mode is the better Rayleigh shape for a light tip mass (2.70 % vs 3.32 %).',
      source: '2025 B2.4; tutorial W7.8 (68 ≤ M ≤ 70.8 kg)',
    },
  ];
}

const PERMS = [
  ['D', 'H', 'R'],
  ['D', 'R', 'H'],
  ['H', 'D', 'R'],
  ['H', 'R', 'D'],
  ['R', 'D', 'H'],
  ['R', 'H', 'D'],
];
const NAME: Record<string, string> = { D: 'Dunkerley’s', H: 'Holzer’s', R: 'Rayleigh’s' };

/** Significant figures that keep every pair of values in a round (and its reference) distinguishable. */
function sigFor(round: Round): number {
  const vals = [...round.items.map((i) => i.value), ...(round.ref ? [round.ref.value] : [])].sort((a, b) => a - b);
  let gap = Infinity;
  for (let i = 1; i < vals.length; i++) gap = Math.min(gap, (vals[i] - vals[i - 1]) / Math.max(Math.abs(vals[i]), 1e-12));
  return Math.min(8, Math.max(4, Math.ceil(-Math.log10(Math.max(gap, 1e-9))) + 1));
}

function NumberLine({ round }: { round: Round }) {
  const sorted = [...round.items].sort((a, b) => a.value - b.value);
  const sig = sigFor(round);
  const vals = [...sorted.map((i) => i.value), ...(round.ref ? [round.ref.value] : [])];
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const pad = (hi - lo) * 0.12 || Math.abs(hi) * 0.01;
  return (
    <Plot
      x={{ min: lo - pad, max: hi + pad * 2.2, label: round.unit }}
      y={{ min: -0.7, max: sorted.length - 0.3, ticks: sorted.map((_, i) => i), format: (v) => `${Math.round(v) + 1}` }}
      height={60 + 38 * sorted.length}
      margin={{ l: 34 }}
      ariaLabel="Computed values of each estimate on a number line"
    >
      {round.ref && <VLine x={round.ref.value} color="var(--text-2)" label={`${round.ref.label} ${fmt(round.ref.value, sig)}`} labelY="bottom" />}
      {sorted.map((it, i) => (
        <Dot key={it.id} x={it.value} y={i} color="var(--m1)" label={`${it.short} ${fmt(it.value, sig)}`} labelPos="above" />
      ))}
    </Plot>
  );
}

function OrderRound({ round, onSolved, solved }: { round: Round; onSolved: () => void; solved: boolean }) {
  const [order, setOrder] = useState<number[]>(() => shuffled(round));
  const [checked, setChecked] = useState<null | boolean>(null);
  const truth = [...round.items.keys()].sort((a, b) => round.items[a].value - round.items[b].value);
  const move = (from: number, to: number) => {
    if (to < 0 || to >= order.length || checked) return;
    const next = order.slice();
    const [x] = next.splice(from, 1);
    next.splice(to, 0, x);
    setOrder(next);
  };
  const check = () => {
    const ok = order.every((v, i) => v === truth[i]);
    setChecked(ok);
    if (ok) onSolved();
  };
  return (
    <div className="stack">
      <Rich text={round.setup} />
      <Rich className="note" text="Arrange from **lowest** (top) to **highest** (bottom) with the arrows (keyboard: Tab to an arrow, then Enter)." />
      <ol className="order-list">
        {order.map((idx, pos) => {
          const it = round.items[idx];
          const state = checked === null ? '' : truth[pos] === idx ? 'cell-ok' : 'cell-bad';
          return (
            <li key={it.id} className={`order-item ${state}`}>
              <span className="order-text">
                <Rich text={it.label} inline />
                {checked !== null && <span className="muted small"> = {fmt(it.value, sigFor(round))} {round.unit}</span>}
              </span>
              <span className="order-btns">
                <button type="button" className="icon-btn" aria-label={`Move ${it.label} up`} disabled={!!checked || pos === 0} onClick={() => move(pos, pos - 1)}>
                  ↑
                </button>
                <button type="button" className="icon-btn" aria-label={`Move ${it.label} down`} disabled={!!checked || pos === order.length - 1} onClick={() => move(pos, pos + 1)}>
                  ↓
                </button>
              </span>
            </li>
          );
        })}
      </ol>
      <div className="row gap-s wrap">
        {checked === null && (
          <Button variant="primary" onClick={check}>
            Check order
          </Button>
        )}
        {checked === false && (
          <Button
            onClick={() => {
              setChecked(null);
              setOrder(shuffled(round, Date.now()));
            }}
          >
            Try again
          </Button>
        )}
        {solved && <Badge tone="ok">✓ solved</Badge>}
      </div>
      {checked !== null && (
        <>
          <Callout kind={checked ? 'ok' : 'bad'} title={checked ? 'Correct order' : 'Not quite: here are the computed values'}>
            <Rich text={round.explain} />
          </Callout>
          <NumberLine round={round} />
          <p className="muted small">Source: {round.source}</p>
        </>
      )}
    </div>
  );
}

function shuffled(round: Round, salt = 0): number[] {
  const idx = round.items.map((_, i) => i);
  let s = makeRng(hashString(round.id) ^ salt).shuffle(idx);
  const truth = [...idx].sort((a, b) => round.items[a].value - round.items[b].value);
  if (s.every((v, i) => v === truth[i])) s = [...s.slice(1), s[0]];
  return s;
}

function OfficialRound({ onSolved, solved }: { onSolved: () => void; solved: boolean }) {
  const [sel, setSel] = useState<number[]>([]);
  const [checked, setChecked] = useState<null | boolean>(null);
  const correct = [0, 1];
  const check = () => {
    const ok = sel.length === correct.length && correct.every((c) => sel.includes(c));
    setChecked(ok);
    if (ok) onSolved();
  };
  return (
    <div className="stack">
      <Rich text="The exam version (official 2016 B1.8; recurs 2022 B1.7, 2024 B1.8, 2025 B1.8): for a lumped-mass shaft or beam, which orders of the **fundamental** estimates (lowest → highest, ignoring rigid-body modes) can you expect from Holzer’s, Rayleigh’s and Dunkerley’s methods? **Select every possible order.**" />
      <div className="options" role="group" aria-label="Possible orders">
        {PERMS.map((p, i) => {
          const on = sel.includes(i);
          const st = checked === null ? (on ? 'is-picked' : '') : correct.includes(i) ? 'is-right' : on ? 'is-wrong' : '';
          return (
            <button key={i} type="button" role="checkbox" aria-checked={on} className={`option ${st}`} disabled={checked !== null} onClick={() => setSel((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i]))}>
              <span className="option-mark" aria-hidden="true">
                {checked !== null ? (correct.includes(i) ? '✓' : on ? '✗' : '') : on ? '●' : ''}
              </span>
              <span className="option-body">{p.map((x) => NAME[x]).join(', ')}</span>
            </button>
          );
        })}
      </div>
      <div className="row gap-s wrap">
        {checked === null ? (
          <Button variant="primary" onClick={check} disabled={!sel.length}>
            Check
          </Button>
        ) : (
          !checked && (
            <Button
              onClick={() => {
                setChecked(null);
                setSel([]);
              }}
            >
              Try again
            </Button>
          )
        )}
        {solved && <Badge tone="ok">✓ solved</Badge>}
      </div>
      {checked !== null && (
        <Callout kind={checked ? 'ok' : 'bad'} title={checked ? 'Matches the official key (b)' : 'Not the official answer'}>
          <Rich text="**Dunkerley’s, Holzer’s, Rayleigh’s or Dunkerley’s, Rayleigh’s, Holzer’s.** Dunkerley is always the lowest (a lower bound). Rayleigh is an upper bound on the exact value. Holzer is exact for the lumped model, so its error is the lumping error, which can fall either side of Rayleigh: you saw D, R, H for the stalled grinder and D, H, R for the lumped shaft. Choosing only “D, H, R” is incomplete; any order with Dunkerley above another method contradicts its lower-bound property." />
        </Callout>
      )}
    </div>
  );
}

export default function OrderGame() {
  const p = useProgress();
  const rounds = useMemo(buildRounds, []);
  const [cur, setCur] = useState(0);
  const [solved, setSolved] = useState<Record<string, boolean>>({});
  const total = rounds.length + 1;
  const nSolved = Object.values(solved).filter(Boolean).length;
  const done = !!p.challenges[ORDER_CHALLENGE];
  const mark = (id: string) => {
    const next = { ...solved, [id]: true };
    setSolved(next);
    if (Object.values(next).filter(Boolean).length >= total) completeChallenge(ORDER_CHALLENGE);
  };
  const isOfficial = cur === rounds.length;
  return (
    <div>
      <Callout kind="info" title="Challenge: order every set of estimates">
        <Rich text="Five scenarios with real numbers, then the exam question. Bounds to remember: **Dunkerley ≤ exact ≤ Rayleigh**; Holzer is exact for its lumped model; FEM converges as the mesh is refined." />
      </Callout>
      <div className="row gap-s wrap" style={{ margin: '10px 0' }}>
        {[...rounds.map((r) => r.title), 'Exam question'].map((t, i) => {
          const id = i < rounds.length ? rounds[i].id : 'official';
          return (
            <Button key={id} size="sm" variant={i === cur ? 'primary' : 'default'} onClick={() => setCur(i)} aria-current={i === cur ? 'step' : undefined}>
              {solved[id] ? '✓ ' : ''}
              {i + 1}. {t}
            </Button>
          );
        })}
      </div>
      <ProgressBar value={nSolved} max={total} tone={nSolved >= total ? 'ok' : 'accent'} label="Rounds solved" />
      <div className="card" style={{ marginTop: 10 }}>
        <h3 className="card-title">{isOfficial ? 'Exam question: which orders are possible?' : rounds[cur].title}</h3>
        {isOfficial ? (
          <OfficialRound key="official" solved={!!solved.official} onSolved={() => mark('official')} />
        ) : (
          <OrderRound key={rounds[cur].id} round={rounds[cur]} solved={!!solved[rounds[cur].id]} onSolved={() => mark(rounds[cur].id)} />
        )}
        <div className="row gap-s wrap" style={{ marginTop: 10 }}>
          {cur > 0 && (
            <Button size="sm" onClick={() => setCur(cur - 1)}>
              ← Previous
            </Button>
          )}
          {cur < total - 1 && (
            <Button size="sm" onClick={() => setCur(cur + 1)}>
              Next →
            </Button>
          )}
        </div>
      </div>
      {(done || nSolved >= total) && (
        <Callout kind="ok" title="Challenge complete">
          Every round ordered correctly. Keep the one-liner: Dunkerley lowest, Rayleigh above the truth, Holzer either side of Rayleigh, a converged FEM on the truth.
        </Callout>
      )}
      <PredictReveal
        id="b5-order-holzer-above"
        question="For the same physical system, can Holzer’s estimate of $f_1$ be **above** Rayleigh’s?"
        options={['No: Holzer is exact, so it must lie between the bounds', 'Yes: Holzer is exact only for the lumped model']}
        answer={1}
        explain="Yes. In Sample Problem 7(b) the lumped model ignores the shaft’s inertia and gives 142.35 Hz, above Rayleigh’s 141.898 Hz (exact 141.897 Hz). Holzer has no bound property: it inherits the lumping error. That is why the official answer allows both D, H, R and D, R, H."
        tryIt="open round 2 and check your order."
        onApply={() => setCur(1)}
      />
      <PredictReveal
        id="b5-order-lumped-fe"
        question="The tower of round 1 ($\mu = 0.5$) is modelled with **one** beam element and a **lumped** mass matrix. Its $\omega_1$ is…"
        options={['above Rayleigh’s estimates', 'between Dunkerley and the exact value', 'below even Dunkerley’s lower bound']}
        answer={2}
        explain="One lumped element gives $C$ = 1.2247 (in $\sqrt{EI/ML^3}$), well below Dunkerley’s 1.4212: a lumped-mass model converges from below and can be very low when coarse. “Dunkerley’s, FEM, Rayleigh’s” assumes **adequate mesh refinement** (2023 B1.8 wording); 4 consistent elements already agree with the exact 1.4257 to 5 figures."
        tryIt="see round 4 for how lumped models converge from below."
        onApply={() => setCur(3)}
      />
    </div>
  );
}
