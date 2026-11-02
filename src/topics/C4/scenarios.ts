// "Choose a strategy" scenario deck (C4 strategy sim, generators and self-tests). Each template builds a
// randomised scenario: a story with numbers, the course's first-choice strategy (the cue in C4.8 of the
// summary notes / LC4), a verdict and a reason for every other strategy, and a simple response model so
// the sim can draw the structure's response now and what each strategy would do to it.
//
// Response model (all SDOF, frequencies in Hz): 'force' plots X/(F0/k) = magnification(f/fn, zeta);
// 'unbalance' plots X/(me/M) = r^2 magnification (the force grows as Omega^2); 'trans' plots the fraction
// transmitted, T(f/fn, zeta), or 1 when the receiver is bolted rigidly to the vibrating support.
import type { Rich } from '../../engine/types';
import type { Rng } from '../../engine/rng';
import { fmt } from '../../engine/format';
import { magnification, transmissibility } from '../../physics/sdof';
import { G, TWO_PI } from '../../physics/units';
import { primaryWithAbsorber } from './physics';

export type StrategyId = 'balance' | 'retune' | 'damp' | 'isolate' | 'absorber' | 'active' | 'stability';
export type Verdict = 'best' | 'ok' | 'poor';

export interface StrategyDef {
  id: StrategyId;
  label: string;
  /** One line: what it does. */
  does: Rich;
  /** The question cues that call for it. */
  cue: Rich;
}

export const STRATEGIES: StrategyDef[] = [
  { id: 'balance', label: 'Balance the source', does: 'Remove the force where it is made: balance rotors, time and arrange engine cylinders.', cue: 'unbalance, 1× running speed, force $\\propto \\Omega^2$, reciprocating engine' },
  { id: 'retune', label: 'Retune ωₙ', does: 'Change stiffness or mass so the natural frequency moves away from a **fixed** forcing frequency.', cue: 'fixed speed close to a natural frequency' },
  { id: 'damp', label: 'Add damping', does: 'Limit the resonant peak ($\\propto 1/2\\zeta$) when resonance cannot be avoided.', cue: 'speed varies, run-up and run-down, passes through resonance' },
  { id: 'isolate', label: 'Isolate', does: 'Soft mounts between source and receiver: $r = \\Omega/\\omega_n \\gg \\sqrt2$, low damping.', cue: 'protect from floor vibration, force to the foundation, mounts' },
  { id: 'absorber', label: 'Tuned absorber (TMD)', does: 'A small tuned $m_2$–$k_2$ where the structure moves most cancels **one** frequency.', cue: 'one dominant mode, one frequency, flexible structure' },
  { id: 'active', label: 'Active control', does: 'Sensors and actuators that adapt to changing conditions (costly, needs power).', cue: 'varying conditions, adaptive, very low frequency' },
  { id: 'stability', label: 'Stability control', does: 'Change the parameter that drives a self-excited vibration (flutter, squeal).', cue: 'grows by itself, flutter, squeal, above a critical speed' },
];

export const strategyById = (id: StrategyId): StrategyDef => STRATEGIES.find((s) => s.id === id)!;

export interface ScenarioPlot {
  metric: 'force' | 'unbalance' | 'trans';
  /** Natural frequency of the structure (or mounts), Hz. Unused when `rigid`. */
  fn: number;
  zeta: number;
  /** Operating band in Hz (equal ends: a single frequency). */
  band: [number, number];
  /** Axis maximum, Hz. */
  fmax: number;
  /** The receiver is bolted rigidly to the vibrating support (T = 1, no dynamics of its own). */
  rigid?: boolean;
  /** The source can be put on mounts (isolation applies to a force or unbalance metric). */
  canIsolate?: boolean;
  /** Already balanced to a good grade: no further source reduction. */
  balanced?: boolean;
  /** Absorber tuning frequency (Hz); default fn when it lies in the band, else the band centre. */
  tuneTo?: number;
}

export interface Scenario {
  template: string;
  title: string;
  text: Rich;
  /** Key data as short chips. */
  chips: string[];
  best: StrategyId;
  /** Verdict and reason for every strategy (the best one's reason says why it fits). */
  verdicts: Record<StrategyId, { v: Verdict; why: Rich }>;
  /** The cue phrase and where it leads. */
  cue: Rich;
  plot?: ScenarioPlot;
  /** Self-excited: show a growing oscillation instead of a frequency response. */
  growth?: boolean;
}

/** Parameters of what each strategy does in the response model. */
export const EFFECT = {
  /** Residual unbalance after balancing (fraction of the force). */
  balance: 0.1,
  /** Natural-frequency shift factor for retuning (stiffness × 2.56 or mass × 2.56). */
  retune: 1.6,
  /** Damping ratio after adding damping. */
  dampZeta: 0.1,
  /** Isolation mounts: lowest operating frequency / mount natural frequency, and their damping. */
  isoRatio: 3,
  isoZeta: 0.05,
  /** Tuned absorber: mass ratio and damping zeta_a = c2/(2 m2 w11). */
  mu: 0.05,
  zetaA: 0.05,
} as const;

function base(p: ScenarioPlot, f: number, fn = p.fn, zeta = p.zeta): number {
  if (p.metric === 'trans') return p.rigid ? 1 : transmissibility(f / fn, zeta);
  const r = f / fn;
  const m = magnification(r, zeta);
  return p.metric === 'unbalance' ? r * r * m : m;
}

/** Worst (largest) response over the operating band. */
export function worstInBand(resp: (f: number) => number, band: [number, number], extra: number[] = []): number {
  const [a, b] = band;
  if (b <= a) return resp(a);
  let w = 0;
  const n = 1500;
  for (let i = 0; i <= n; i++) w = Math.max(w, resp(a + ((b - a) * i) / n));
  for (const f of extra) if (f >= a && f <= b) w = Math.max(w, resp(f));
  return w;
}

/** Frequencies where peaks may hide (checked exactly by worstInBand). */
export function peakHints(p: ScenarioPlot): number[] {
  const ft = absorberTuning(p);
  return [p.fn, p.fn * EFFECT.retune, p.fn / EFFECT.retune, ft * 0.894, ft * 1.118, ft * 0.9, ft * 1.1];
}

export function absorberTuning(p: ScenarioPlot): number {
  if (p.tuneTo) return p.tuneTo;
  return p.fn >= p.band[0] && p.fn <= p.band[1] ? p.fn : (p.band[0] + p.band[1]) / 2;
}

/** The structure's response now (strategy null) or after a strategy; null when the strategy does not change the model. */
export function responseFn(p: ScenarioPlot, s: StrategyId | null): ((f: number) => number) | null {
  if (s === null) return (f) => base(p, f);
  switch (s) {
    case 'balance':
      return p.metric === 'unbalance' && !p.balanced ? (f) => EFFECT.balance * base(p, f) : null;
    case 'retune': {
      if (p.rigid) return null;
      const fn2 = retunedFn(p);
      return (f) => base(p, f, fn2);
    }
    case 'damp':
      return p.rigid ? null : (f) => base(p, f, p.fn, Math.max(p.zeta, EFFECT.dampZeta));
    case 'isolate': {
      const fi = Math.max(p.band[0], 1e-3) / EFFECT.isoRatio;
      if (p.metric === 'trans') return (f) => transmissibility(f / fi, EFFECT.isoZeta);
      return p.canIsolate ? (f) => base(p, f) * transmissibility(f / fi, EFFECT.isoZeta) : null;
    }
    case 'absorber': {
      if (p.rigid || p.metric === 'trans') return null;
      const beta = absorberTuning(p) / p.fn;
      return (f) => {
        const g = f / p.fn;
        const x = primaryWithAbsorber(g, EFFECT.mu, beta, EFFECT.zetaA, p.zeta);
        return p.metric === 'unbalance' ? g * g * x : x;
      };
    }
    default:
      return null;
  }
}

/**
 * Retuned natural frequency the model chooses: the better of ×1.6 (stiffen) and ÷1.6 (soften or add mass).
 * Stiffening wins a tie (within 1 %), e.g. when a sweep crosses either new frequency, so the plotted curve
 * matches the "stiffen the frame" wording of the demos.
 */
export function retunedFn(p: ScenarioPlot): number {
  const up = p.fn * EFFECT.retune;
  const dn = p.fn / EFFECT.retune;
  const hints = peakHints(p);
  return worstInBand((f) => base(p, f, up), p.band, hints) <= 1.01 * worstInBand((f) => base(p, f, dn), p.band, hints) ? up : dn;
}

/** Worst response in the band now and after strategy s (null if s does not change the model). */
export function bandEffect(p: ScenarioPlot, s: StrategyId): { before: number; after: number | null } {
  const hints = peakHints(p);
  const before = worstInBand(responseFn(p, null)!, p.band, hints);
  const fn = responseFn(p, s);
  return { before, after: fn ? worstInBand(fn, p.band, hints) : null };
}

// ------------------------------------------------------------------ templates

const f3 = (x: number) => fmt(x, 3);
const pc = (x: number) => fmt(x * 100, 2);
type V = Scenario['verdicts'];

function verdicts(best: StrategyId, rest: Omit<V, StrategyId> & Partial<V>, bestWhy: Rich): V {
  return { ...(rest as V), [best]: { v: 'best', why: bestWhy } } as V;
}

/** Static sag (m) for a mount natural frequency f (Hz). */
const sagOf = (f: number) => G / (TWO_PI * f) ** 2;

/** Mount family for a static sag in mm (LA7-2 typical values: rubber ≤ 6 mm, steel coils ≈ 25–125 mm, air ≈ 200 mm). */
const mountWord = (sagMm: number) => (sagMm <= 6 ? 'rubber mounts' : sagMm <= 125 ? 'steel springs' : 'air springs');

export interface ScenarioTemplate {
  id: string;
  best: StrategyId;
  make(rng: Rng): Scenario;
}

export const TEMPLATES: ScenarioTemplate[] = [
  // ---------------------------------------------------------------- source: unbalance
  {
    id: 'fan-unbalance',
    best: 'balance',
    make(rng) {
      const N = rng.pick([960, 1450, 2900]);
      const f = N / 60;
      const fn = Number((f * rng.step(0.3, 0.45, 0.05)).toFixed(1));
      const r = f / fn;
      const k = rng.pick([3, 4, 5]);
      return {
        template: 'fan-unbalance',
        title: 'A fan after a blade change',
        text: `A ventilation fan runs at ${N} rpm (${f3(f)} Hz) on a steel platform. Since one blade was replaced, its once-per-revolution (1×) vibration is ${k} times higher and the bearings run hot. A bump test puts the platform’s first mode at ${fn} Hz.`,
        chips: [`${N} rpm = ${f3(f)} Hz`, `platform mode ${fn} Hz`, `r = ${f3(r)}`, `1× level × ${k}`],
        best: 'balance',
        cue: '“1× vibration that grew after a repair” means a new unbalance: remove the force at its source.',
        plot: { metric: 'unbalance', fn, zeta: 0.03, band: [f, f], fmax: 1.6 * f },
        verdicts: verdicts(
          'balance',
          {
            retune: { v: 'poor', why: `The fan already runs well above the platform mode ($r$ = ${f3(r)}). Above resonance the response to an unbalance tends to $me/M$ whatever $\\omega_n$ is, and the bearings still carry $me\\Omega^2$.` },
            damp: { v: 'poor', why: `Damping matters near $r = 1$; at $r$ = ${f3(r)} it barely changes the response, and it does nothing about the force in the bearings.` },
            isolate: { v: 'poor', why: 'Mounts would cut what reaches the floor, but the complaint is the fan’s own vibration and hot bearings. On soft mounts the fan would move even more freely (its excursion tends to $me/M$).' },
            absorber: { v: 'ok', why: `An absorber tuned to ${f3(f)} Hz could hold the platform still at this one speed, but the unbalance force still loads the bearings: it treats the symptom of a fault that is easy to fix.` },
            active: { v: 'ok', why: 'Actuators could cancel the 1× force, at great cost and complexity. Balancing is cheap and removes the cause.' },
            stability: { v: 'poor', why: 'Nothing here is self-excited: it is a forced response at exactly 1× running speed.' },
          },
          `The new blade added an unbalance $me$: a rotating force $me\\Omega^2$ at exactly 1×. Balancing (a correction mass with $m_cr_c = me$, opposite the heavy spot) removes it at the source, so the bearing loads and the platform response both fall (to about 10 % with a 10 % residual).`
        ),
      };
    },
  },
  // ---------------------------------------------------------------- source: reciprocating engine
  {
    id: 'engine',
    best: 'balance',
    make(rng) {
      const N = rng.pick([900, 1200, 1500]);
      const f = N / 60;
      const fn = Number((f * rng.step(0.35, 0.5, 0.05)).toFixed(1));
      const rl = rng.pick([0.25, 0.3]);
      return {
        template: 'engine',
        title: 'A single-cylinder compressor',
        text: `A single-cylinder compressor turns at ${N} rpm on a light skid whose first mode is ${fn} Hz. Its piston and con-rod throw inertia forces at crank speed (primary, ${f3(f)} Hz) and at twice crank speed (secondary, ${f3(2 * f)} Hz, about ${Math.round(rl * 100)} % of the primary for crank radius / con-rod length = ${rl}). A replacement machine is being specified.`,
        chips: [`primary ${f3(f)} Hz`, `secondary ${f3(2 * f)} Hz`, `skid mode ${fn} Hz`],
        best: 'balance',
        cue: '“reciprocating”, “primary and secondary inertia forces” means source control: arrange and time the cylinders so the forces cancel.',
        plot: { metric: 'unbalance', fn, zeta: 0.03, band: [f, 2 * f], fmax: 2.4 * f, canIsolate: true, tuneTo: f },
        verdicts: verdicts(
          'balance',
          {
            retune: { v: 'poor', why: `Both orders (${f3(f)} and ${f3(2 * f)} Hz) are already above the skid mode; moving $\\omega_n$ cannot remove forces that grow as $\\omega^2$.` },
            damp: { v: 'poor', why: 'Well above resonance, damping hardly changes the response to the inertia forces.' },
            isolate: { v: 'ok', why: 'Mounts under the skid would reduce what reaches the floor: a sensible second step. But the specification can remove the forces themselves.' },
            absorber: { v: 'poor', why: 'An absorber cancels one frequency; here there are two (1× and 2×), and the forces stay in the machine and its bearings.' },
            active: { v: 'ok', why: 'Possible, but costly; a balanced multi-cylinder design removes the forces passively.' },
            stability: { v: 'poor', why: 'These are forced vibrations at 1× and 2× crank speed, not an instability.' },
          },
          'The forces come from the moving parts themselves: $F_x = (m_p + m_c)r\\omega^2\\cos\\omega t + m_p\\frac{r^2\\omega^2}{l}\\cos 2\\omega t$. Specify a multi-cylinder machine whose cranks are arranged and timed so the primary and secondary forces cancel (plus counterweights): no force, no vibration (LC4.3).'
        ),
      };
    },
  },
  // ---------------------------------------------------------------- retune: fixed speed near resonance
  {
    id: 'fixed-speed',
    best: 'retune',
    make(rng) {
      const v = rng.pick([
        { machine: 'pump', support: 'steel frame' },
        { machine: 'fan', support: 'roof frame' },
        { machine: 'motor–gearbox set', support: 'cantilever bracket' },
      ]);
      const N = rng.pick([1460, 1480, 2900, 2950]);
      const f = N / 60;
      const r0 = rng.pick([0.9, 0.93, 0.95, 1.05, 1.08, 1.1]);
      const fn = Number((f / r0).toFixed(1));
      const r = f / fn;
      const p: ScenarioPlot = { metric: 'unbalance', fn, zeta: 0.02, band: [f, f], fmax: 2 * f, balanced: true, canIsolate: true };
      const e = bandEffect(p, 'retune');
      const below = r < 1;
      const fn2 = retunedFn(p);
      const up = fn2 > fn;
      return {
        template: 'fixed-speed',
        title: `A ${v.machine} at a fixed speed`,
        text: `A ${v.machine} runs at a fixed ${N} rpm (${f3(f)} Hz), set by the process. It is balanced to a good grade, yet the ${v.support} it stands on vibrates strongly at 1×. A bump test puts the ${v.support}’s first mode at ${fn} Hz.`,
        chips: [`fixed ${f3(f)} Hz`, `${v.support} mode ${fn} Hz`, `r = ${f3(r)}`, 'balanced to grade'],
        best: 'retune',
        cue: '“fixed speed” + “close to a natural frequency” means natural-frequency control: change stiffness or mass so $r$ moves well away from 1.',
        plot: p,
        verdicts: verdicts(
          'retune',
          {
            damp: { v: 'ok', why: 'Damping lowers the peak (it scales as $1/2\\zeta$), but at a fixed speed you would still be sitting on a resonance. Moving $\\omega_n$ is more effective and more robust.' },
            balance: { v: 'poor', why: 'It is already balanced to grade. The problem is the amplification of about $1/2\\zeta$ at $r \\approx 1$, not the size of the force.' },
            isolate: { v: 'ok', why: `Soft mounts under the ${v.machine} would cut the force into the ${v.support}, but it is a bigger change than ${below ? 'bracing' : 'retuning'} the ${v.support}, and the ${v.machine} then moves more on its mounts.` },
            absorber: { v: 'ok', why: `An absorber tuned to ${f3(f)} Hz works at exactly this speed, but it adds two new resonances either side that the ${v.machine} passes at every start-up and run-down. Shifting $\\omega_n$ is simpler.` },
            active: { v: 'ok', why: 'Possible, but expensive for a problem a brace or a mass can fix.' },
            stability: { v: 'poor', why: 'Not self-excited: the vibration is at exactly 1× and follows the running speed.' },
          },
          `$r$ = ${f3(r)}: the speed sits just ${below ? '**below**' : '**above**'} the mode, on the resonant peak. ${
            up
              ? `Raise $\\omega_n$ (brace or stiffen: ×1.6 in frequency needs $k$ × 2.56), so $r$ ≈ ${f3(f / fn2)} and the 1× response falls from ${f3(e.before)} to ${f3(e.after!)} (× $me/M$).${below ? ' Do not add mass: it would pull $\\omega_n$ down onto the running speed.' : ' (Softening or adding mass so that $r$ ≈ 1.7 also works.)'}`
              : `Lower $\\omega_n$ (add mass or soften: ÷1.6 needs $m$ × 2.56 or $k$ ÷ 2.56), so $r$ ≈ ${f3(f / fn2)} and the 1× response falls from ${f3(e.before)} to ${f3(e.after!)} (× $me/M$).`
          }`
        ),
      };
    },
  },
  // ---------------------------------------------------------------- damping: variable speed
  {
    id: 'variable-speed',
    best: 'damp',
    make(rng) {
      const fn = rng.step(8, 20, 1);
      const fa = Number((fn * rng.step(0.4, 0.6, 0.05)).toFixed(1));
      const fb = Number((fn * rng.step(1.8, 2.5, 0.1)).toFixed(1));
      const p: ScenarioPlot = { metric: 'force', fn, zeta: 0.01, band: [fa, fb], fmax: 1.15 * fb, balanced: true };
      return {
        template: 'variable-speed',
        title: 'A variable-speed conveyor',
        text: `A variable-speed drive moves a conveyor anywhere between ${Math.round(fa * 60)} and ${Math.round(fb * 60)} rpm, depending on the load. The drive is balanced, but the belt and rollers shake the support frame at the running frequency, and the frame’s first mode (${fn} Hz, ζ ≈ 1 %) lies inside that range: it rings badly whenever the speed matches it.`,
        chips: [`speeds ${fa}–${fb} Hz`, `frame mode ${fn} Hz`, 'ζ ≈ 0.01'],
        best: 'damp',
        cue: '“speed varies” + “a mode inside the range” means resonance cannot be avoided: add damping, so the peak falls as $1/2\\zeta$.',
        plot: p,
        verdicts: verdicts(
          'damp',
          {
            retune: { v: 'poor', why: `Moving $\\omega_n$ by a factor 1.6 keeps it inside the ${fa}–${fb} Hz range: the peak just moves to another speed.` },
            balance: { v: 'poor', why: 'The drive is already balanced, and the excitation comes from the belt and rollers; the amplification at resonance remains.' },
            isolate: { v: 'poor', why: 'The excitation is generated along the conveyor itself: there is no single machine to put on mounts.' },
            absorber: { v: 'ok', why: `A TMD tuned to the ${fn} Hz mode adds damping to it, but its two new resonances (about 0.89 and 1.12 × ${fn} Hz) still lie inside the speed range. Plain damping treats every speed.` },
            active: { v: 'ok', why: 'Active damping would work over the whole range, but passive damping does the job more cheaply.' },
            stability: { v: 'poor', why: 'Forced vibration at the running frequency, not an instability.' },
          },
          `Some speed in ${fa}–${fb} Hz always matches the ${fn} Hz mode, so resonance cannot be avoided. Damping limits the peak wherever it occurs: raising $\\zeta$ from 0.01 to 0.1 cuts it from about 50 to 5 static deflections (LC4.4 damping control).`
        ),
      };
    },
  },
  // ---------------------------------------------------------------- damping: run-up through a mount resonance
  {
    id: 'run-up',
    best: 'damp',
    make(rng) {
      const fRun = rng.step(20, 50, 5);
      const ratio = rng.step(6, 10, 1);
      const fn = Number((fRun / ratio).toFixed(2));
      const r = fRun / fn;
      const p: ScenarioPlot = { metric: 'unbalance', fn, zeta: 0.01, band: [0, fRun], fmax: 1.1 * fRun };
      return {
        template: 'run-up',
        title: 'A centrifuge that bangs at start-up',
        text: `A centrifuge stands on soft, almost undamped mounts (${fn} Hz, ζ ≈ 1 %) and runs at ${fRun * 60} rpm, ${f3(r)}× the mount frequency, where it is well isolated. Each batch loads the rotor slightly out of balance, and at every start-up and shut-down, as it passes through the mount resonance, the casing swings far enough to strike the frame.`,
        chips: [`runs at ${fRun} Hz`, `mounts ${fn} Hz`, `r = ${f3(r)} at speed`, 'trouble only at start-up'],
        best: 'damp',
        cue: '“passes through resonance at start-up and shut-down” means damping control: enough damping to cap the transient peak, low enough to keep the isolation at speed.',
        plot: p,
        verdicts: verdicts(
          'damp',
          {
            retune: { v: 'poor', why: `Every run-up sweeps from 0 to ${fRun} Hz, so any mount frequency below the running speed is crossed; stiffer mounts would also spoil the isolation at speed.` },
            isolate: { v: 'poor', why: 'It is already isolated: the soft mounts are the reason there is a resonance to pass through.' },
            balance: { v: 'ok', why: 'Better balance shrinks every response, but each batch loads the rotor differently, so a residual unbalance always returns; the amplification at resonance stays $1/2\\zeta$.' },
            absorber: { v: 'ok', why: 'A TMD tuned to the mount frequency adds damping to that mode, but every run-up still crosses its two new resonances. Mount dampers are simpler.' },
            active: { v: 'ok', why: 'Active (or switchable) mounts could add damping only while passing resonance and remove it at speed, the ideal, but at a cost.' },
            stability: { v: 'poor', why: 'A forced response to the unbalance during the sweep, not an instability.' },
          },
          `The excursion at resonance is $(me/M)/2\\zeta$ whatever the mount stiffness, so stiffness cannot limit it: damping can (or a heavier inertia block, which lowers $me/M$). Raising $\\zeta$ from 0.01 to 0.1 cuts it tenfold, and at $r$ = ${f3(r)} the isolation is still good: $T$ rises from ${f3(transmissibility(r, 0.01))} to ${f3(transmissibility(r, 0.1))}, the price of a safe start-up. Choose the smallest $\\zeta$ that keeps the excursion acceptable.`
        ),
      };
    },
  },
  // ---------------------------------------------------------------- isolation: sensitive receiver
  {
    id: 'receiver',
    best: 'isolate',
    make(rng) {
      if (rng.chance(0.5)) {
        const fa = rng.step(10, 20, 5);
        const fb = rng.step(40, 80, 10);
        const fi = fa / 3;
        return {
          template: 'receiver',
          title: 'A microscope on a busy floor',
          text: `An electron microscope will stand on a laboratory floor that vibrates at ${fa}–${fb} Hz from pumps and traffic. Bolted straight to the floor it moves exactly as the floor does, which exceeds the supplier’s limit.`,
          chips: [`floor ${fa}–${fb} Hz`, 'bolted down: T = 1'],
          best: 'isolate',
          cue: '“protect sensitive equipment from floor vibration” means isolation: soft mounts so every operating frequency is well above $\\sqrt2\\,\\omega_n$.',
          plot: { metric: 'trans', fn: fa, zeta: 0.02, band: [fa, fb], fmax: 1.2 * fb, rigid: true },
          verdicts: verdicts(
            'isolate',
            {
              absorber: { v: 'poor', why: 'Bolted down, the microscope has no dynamics of its own: the fixing imposes the floor’s motion, so an absorber attached to it changes nothing (2022 A1.1).' },
              retune: { v: 'poor', why: 'Bolted down it has no natural frequency of its own to move. (Putting it on springs is isolation.)' },
              damp: { v: 'poor', why: 'Damping acts on relative motion; a rigid fixing has none, so there is nothing to damp.' },
              balance: { v: 'poor', why: 'The sources (pumps, traffic) are outside your control.' },
              active: { v: 'ok', why: 'Active isolation tables exist and work well at low frequency, but passive mounts are simpler and need no power. Try passive isolation first.' },
              stability: { v: 'poor', why: 'Forced vibration from the floor, not an instability.' },
            },
            `Soft mounts with $f_n$ ≈ ${f3(fi)} Hz (static sag ≈ ${f3(sagOf(fi) * 1000)} mm: ${mountWord(sagOf(fi) * 1000)}) put the whole ${fa}–${fb} Hz band above $3f_n$, so the microscope receives at most $T$ = ${f3(transmissibility(3, 0.05))} of the floor motion. Keep their damping low, just enough to settle after a knock.`
          ),
        };
      }
      const m = rng.step(5, 20, 1);
      const f = rng.pick([1.5, 2, 2.5, 3]);
      const W = TWO_PI * f;
      return {
        template: 'receiver',
        title: 'A camera on a shaking platform',
        text: `A ${m} kg camera is bolted rigidly to an inspection platform that oscillates at ${f} Hz. The images are blurred. One engineer proposes a tuned absorber fixed to the camera; another a soft cushion under it.`,
        chips: [`m = ${m} kg`, `platform ${f} Hz`, 'bolted down: T = 1'],
        best: 'isolate',
        cue: '“rigidly fixed” + a vibrating support means isolation, never an absorber (2022 A1.1).',
        plot: { metric: 'trans', fn: f, zeta: 0.02, band: [f, f], fmax: 3 * f, rigid: true },
        verdicts: verdicts(
          'isolate',
          {
            absorber: { v: 'poor', why: 'The rigid fixing imposes the platform’s motion on the camera: an absorber attached to it has nothing to work against and changes nothing (2022 A1.1).' },
            retune: { v: 'poor', why: 'Bolted down, the camera has no natural frequency of its own to move. (A spring under it is isolation.)' },
            damp: { v: 'poor', why: 'A rigid fixing has no relative motion to damp.' },
            balance: { v: 'poor', why: 'The platform’s motion is imposed from outside; there is nothing on the camera to balance.' },
            active: { v: 'ok', why: 'An active (or gimbal-stabilised) mount would work, at a cost; a passive cushion is enough here.' },
            stability: { v: 'poor', why: 'Forced vibration of the platform, not an instability.' },
          },
          `A soft cushion makes the camera a base-excited SDOF system with $X/Y = 1/|1 - r^2|$. It isolates when $k < m\\Omega^2/2$ = ${f3((m * W * W) / 2)} N/m, and $T \\le 0.1$ needs $r^2 \\ge 11$, i.e. $k \\le m\\Omega^2/11$ = ${f3((m * W * W) / 11)} N/m (2022 A1.1).`
        ),
      };
    },
  },
  // ---------------------------------------------------------------- isolation: machine on a light floor
  {
    id: 'office-floor',
    best: 'isolate',
    make(rng) {
      const M = rng.step(200, 800, 50);
      const N = rng.pick([1450, 1480, 2900, 2950]);
      const f = N / 60;
      const ff = rng.step(7, 12, 1);
      const fi = f / 3;
      return {
        template: 'office-floor',
        title: 'A compressor above the offices',
        text: `A ${M} kg compressor, balanced to a good grade, runs at ${N} rpm (${f3(f)} Hz), bolted straight to a light office floor. Occupants below feel the vibration. The floor’s first mode is about ${ff} Hz, well away from the running speed.`,
        chips: [`${N} rpm = ${f3(f)} Hz`, `floor mode ${ff} Hz`, 'bolted down: T = 1'],
        best: 'isolate',
        cue: '“force transmitted to the floor (foundation)” from a machine means isolation at the source.',
        plot: { metric: 'trans', fn: f, zeta: 0.02, band: [f, f], fmax: 2.2 * f, rigid: true },
        verdicts: verdicts(
          'isolate',
          {
            balance: { v: 'poor', why: 'Already balanced to grade: the residual force is small, but bolted down, all of it reaches the floor.' },
            retune: { v: 'poor', why: `The floor mode (${ff} Hz) is not at the running speed, and stiffening a whole floor is expensive: the problem is transmission.` },
            damp: { v: 'poor', why: 'Bolted down there is no flexible element to damp: the floor receives the full force.' },
            absorber: { v: 'ok', why: `A TMD on the floor tuned to ${f3(f)} Hz could calm the floor at that one frequency, but springs under the compressor are simpler and work at every frequency above $\\sqrt2 f_n$.` },
            active: { v: 'ok', why: 'Possible, but complex; passive mounts already remove about 90 % here.' },
            stability: { v: 'poor', why: 'Forced vibration at the running speed, not an instability.' },
          },
          `Mount the compressor on resilient mounts with $f_n \\le$ ${f3(fi)} Hz (static sag ≥ ${f3(sagOf(fi) * 1000)} mm: ${mountWord(sagOf(fi) * 1000)} will do). Then $r \\ge 3$ and at most $T = 1/(r^2 - 1)$ = 12.5 % of its force reaches the floor. Use light damping, just enough for the start-up through the mount resonance.`
        ),
      };
    },
  },
  // ---------------------------------------------------------------- absorber: one lively mode
  {
    id: 'footbridge',
    best: 'absorber',
    make(rng) {
      const fn = rng.step(1.7, 2.3, 0.1);
      const zeta = rng.pick([0.004, 0.005, 0.008]);
      const p: ScenarioPlot = { metric: 'force', fn, zeta, band: [fn, fn], fmax: 2 * fn };
      const e = bandEffect(p, 'absorber');
      return {
        template: 'footbridge',
        title: 'A lively footbridge',
        text: `A slender steel footbridge has a lively vertical mode at ${fn} Hz with very light damping (ζ ≈ ${pc(zeta)} %). Crowds walking in step load it right at that frequency; its other modes are well away. The span is long and there is nothing stationary under it to fix dampers to.`,
        chips: [`mode ${fn} Hz`, `ζ ≈ ${pc(zeta)} %`, 'one dominant mode', 'one frequency'],
        best: 'absorber',
        cue: '“one dominant mode” excited at one frequency on a flexible structure means a tuned mass damper, attached where that mode moves most.',
        plot: p,
        verdicts: verdicts(
          'absorber',
          {
            retune: { v: 'ok', why: 'Raising the mode above the pacing range needs about ×1.6 in frequency, i.e. ×2.56 the stiffness of the whole span: rarely practical on an existing bridge.' },
            damp: { v: 'ok', why: 'More damping would work (the peak scales as $1/2\\zeta$), but viscous dampers need a fixed point to push against. A TMD is the practical way to add damping to one mode of a span.' },
            isolate: { v: 'poor', why: 'The force comes from people walking on the deck: there is no path to interrupt.' },
            balance: { v: 'poor', why: 'Nothing rotating to balance, and you cannot change how people walk.' },
            active: { v: 'ok', why: 'Active mass dampers exist, but they need power and maintenance; a passive TMD is the standard solution.' },
            stability: { v: 'poor', why: 'Walking in step at the mode frequency is forced resonance, not a self-excited instability.' },
          },
          `A TMD of a few per cent of the modal mass ($\\mu \\approx 0.05$), tuned to ${fn} Hz and fixed at mid-span (largest mode shape), turns the resonance into an anti-resonance: here from ${f3(e.before)} to about ${f3(e.after!)} static deflections. Damping in the TMD keeps its two new peaks low for walkers at slightly different paces (LC4.6).`
        ),
      };
    },
  },
  // ---------------------------------------------------------------- absorber: power line (multi-DoF)
  {
    id: 'power-line',
    best: 'absorber',
    make(rng) {
      const span = rng.step(200, 400, 50);
      return {
        template: 'power-line',
        title: 'A humming power line',
        text: `A steady crosswind sheds vortices from an overhead conductor (${span} m span), exciting many of its closely spaced modes over a range of frequencies. The conductor is fatiguing where it is clamped.`,
        chips: ['many close modes', 'a range of frequencies', 'fatigue at the clamps'],
        best: 'absorber',
        cue: '“a range of frequencies on a power line” means multi-degree-of-freedom absorbers with several natural frequencies (Stockbridge dampers).',
        verdicts: verdicts(
          'absorber',
          {
            damp: { v: 'ok', why: 'Damping the long conductor itself is hard; the absorbers are how damping is added to it in practice.' },
            retune: { v: 'poor', why: 'A cable has many closely spaced modes: moving one just brings another into the wind’s range.' },
            isolate: { v: 'poor', why: 'The wind acts directly on the conductor: there is no path to interrupt.' },
            balance: { v: 'poor', why: 'Nothing rotates or reciprocates here: there is no unbalance to remove.' },
            active: { v: 'ok', why: 'Possible in principle, but nobody would power and maintain actuators along every span.' },
            stability: { v: 'poor', why: 'Vortex shedding forces the conductor. (Galloping of iced conductors, a large, low-frequency motion, is the instability case.)' },
          },
          'A single TMD covers one frequency, but **multi-DoF absorbers** with several natural frequencies (Stockbridge dampers) are clamped near the ends of power lines to suppress a range of frequencies (official 2019 Q1(h)(e); 2018 A1.5(e)).'
        ),
      };
    },
  },
  // ---------------------------------------------------------------- active control
  {
    id: 'stage',
    best: 'active',
    make(rng) {
      const fb = rng.pick([1.5, 2, 3]);
      const fa = 0.5;
      const fi = fa / 3;
      return {
        template: 'stage',
        title: 'A precision stage with changing payloads',
        text: `A precision positioning stage carries payloads that change from job to job, and the floor disturbances it must reject lie between ${fa} and ${fb} Hz. Passive mounts soft enough to isolate there would sag by metres and settle differently under every payload.`,
        chips: [`disturbance ${fa}–${fb} Hz`, 'payload changes', 'very low frequency'],
        best: 'active',
        cue: '“changing conditions”, “adaptive”, “very low frequency” means active control.',
        plot: { metric: 'trans', fn: fa, zeta: 0.02, band: [fa, fb], fmax: 2 * fb, rigid: true },
        verdicts: verdicts(
          'active',
          {
            isolate: { v: 'ok', why: `It would work on paper, but passive isolation from ${fa} Hz needs $f_n$ ≈ ${f3(fi)} Hz: a static sag of about ${f3(sagOf(fi))} m, and it would shift with each payload. Impractical.` },
            damp: { v: 'poor', why: 'The stage is bolted to the floor: there is no relative motion to damp.' },
            retune: { v: 'poor', why: 'Bolted down, it has no natural frequency of its own to move away from the disturbance band.' },
            absorber: { v: 'poor', why: 'An absorber needs a flexibly mounted primary and one frequency; here the motion is imposed by the floor over a band.' },
            balance: { v: 'poor', why: 'The disturbance comes from the floor, outside your control.' },
            stability: { v: 'poor', why: 'Forced disturbance from the floor, not an instability.' },
          },
          'Sensors and actuators can emulate a very soft, well-damped mount without the static sag, and re-tune themselves as the payload changes: active control replaces passive stiffness, damping and mass where conditions vary (LC4 §3.6).'
        ),
      };
    },
  },
  // ---------------------------------------------------------------- stability control
  {
    id: 'self-excited',
    best: 'stability',
    make(rng) {
      const squeal = rng.chance(0.4);
      const fk = rng.step(1.5, 4, 0.5);
      return {
        template: 'self-excited',
        title: squeal ? 'A squealing brake' : 'A panel that starts to flutter',
        text: squeal
          ? `A disc brake squeals at about ${fk} kHz, but only above a certain pad friction. Once started, the squeal sustains itself while the disc turns steadily; nothing in the system is forcing it at that frequency.`
          : 'Above a certain air speed, a thin aircraft panel starts to oscillate in steady flow, and the oscillation grows by itself until something limits it. Below that speed it is quiet.',
        chips: squeal ? [`squeal ≈ ${fk} kHz`, 'only above a critical friction', 'self-sustaining'] : ['only above a critical air speed', 'grows by itself', 'steady flow'],
        best: 'stability',
        cue: '“grows by itself”, “above a critical speed (friction)”, flutter, squeal: a self-excited instability, so stability control.',
        growth: true,
        verdicts: verdicts(
          'stability',
          {
            damp: { v: 'ok', why: 'Extra damping can absorb some of the energy fed in and push the onset back a little (damping shims are used against squeal), but the lasting cure is to remove the cause.' },
            active: { v: 'ok', why: 'Active suppression has been demonstrated, but it is complex and must never fail; the standard approach is to design the instability out.' },
            retune: { v: 'poor', why: 'Natural-frequency control moves $\\omega_n$ away from a forcing frequency, and there is none here: the vibration happens at the structure’s own frequency, whatever it is. (Stiffness may still be one of the parameters you change, which is stability control.)' },
            absorber: { v: 'poor', why: 'An absorber cancels a forced response at a known frequency; it does not remove the energy source that drives a self-excited vibration.' },
            isolate: { v: 'poor', why: 'The energy comes from the flow (or the friction) acting on the structure itself: there is no path to interrupt.' },
            balance: { v: 'poor', why: 'Nothing is unbalanced: the motion is self-excited.' },
          },
          squeal
            ? 'No external force sets the frequency: friction feeds energy in at the system’s own frequency, like negative damping. Identify the critical parameters (friction, pad geometry and stiffness) and change them so the system stays stable (LC4.7 stability control).'
            : 'No external force sets the frequency: the flow feeds energy in at the panel’s own frequency, like negative damping. Identify the critical parameters (stiffness, mass distribution, air speed) and change them so the onset speed lies outside the operating envelope (LC4.7 stability control).'
        ),
      };
    },
  },
];

export const templateById = (id: string): ScenarioTemplate | undefined => TEMPLATES.find((t) => t.id === id);
