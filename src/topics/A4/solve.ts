// A4 problem generators. Numbers are randomised within the ranges the papers use; hints walk
// concept -> set-up -> substitution -> worked solution with this instance's numbers. Topic-specific
// traps name the actual mistake; a trap is dropped when it is within 2.1 % of the answer or when its
// matching window could overlap the part's own tolerance (see `traps` and `finalize`).
import type { ChoicePart, SolveGenerator, SolveInstance, SolvePart } from '../../engine/types';
import type { Rng } from '../../engine/rng';
import { fmt, tex } from '../../engine/format';
import { chainFrequencies, generalRatios, muFromRatio, tunedRatios } from '../../physics/absorber';
import { ceilTo, chainReceptances, sizeForMargins } from './physics';

const TAU = 2 * Math.PI;
const F = (x: number, s = 4) => fmt(x, s);
const T = (x: number, s = 4) => tex(x, s);
const pc = (x: number) => `${F(x * 100, 3)} %`;
const toRpm = (w: number) => (w * 60) / TAU;

type Trap = { value: number; message: string; trapId?: string };

/** Keep finite traps at least `gap` (relative) away from the answer, and at least 2 % from each other. */
export function traps(ans: number, list: (Trap | false | null | undefined)[], gap = 0.021): Trap[] {
  const out: Trap[] = [];
  const scale = Math.max(Math.abs(ans), 1e-12);
  for (const t of list) {
    if (!t || !Number.isFinite(t.value)) continue;
    if (Math.abs(t.value - ans) <= gap * scale) continue;
    if (out.some((o) => Math.abs(o.value - t.value) <= 0.02 * Math.max(Math.abs(o.value), 1e-12))) continue;
    out.push(t);
  }
  return out;
}

/**
 * The checker (src/engine/check.ts) accepts an answer within ±tol (or ±absTol) first, then names a trap
 * within ±1.5 % of the trap value. Drop any trap whose window could overlap the answer window, so a near
 * miss of the right answer is never labelled as a trap. Tight-tolerance parts keep closer traps.
 */
export function finalize(inst: SolveInstance): SolveInstance {
  for (const p of inst.parts) {
    if (p.kind !== 'numeric' || !p.traps) continue;
    const a = Math.abs(p.answer);
    const win = Math.max((p.tol ?? 0.02) * a, p.absTol ?? 0);
    p.traps = p.traps.filter((t) => {
      const d = Math.abs(t.value - p.answer);
      return d > 0.021 * a && d > win + 0.015 * Math.abs(t.value) + 0.002 * a;
    });
  }
  return inst;
}

const withTrapGap = (g: SolveGenerator): SolveGenerator => ({ ...g, generate: (rng, tier) => finalize(g.generate(rng, tier)) });

/** Shuffle-free choice part helper (the UI shuffles). */
const choice = (id: string, label: string, options: ChoicePart['options']): ChoicePart => ({ kind: 'choice', id, label, options });

/** Rejection-sample until `ok` holds (deterministic for a given seed). */
function until<Tv>(rng: Rng, make: (r: Rng) => Tv, ok: (v: Tv) => boolean, tries = 60): Tv {
  let v = make(rng);
  for (let i = 0; i < tries && !ok(v); i++) v = make(rng);
  return v;
}

// ======================================================================================= 1. sizing
const absorberSize: SolveGenerator = {
  id: 'a4-absorber-size',
  title: 'Size a tuned absorber for a frequency margin',
  summary: 'The two candidate mass ratios, which limit binds, then $m_2$, $k_2$ and the new speeds.',
  tiers: [1, 2, 3],
  source: 'Similar to Week 5 Q1, 2021 A1.3, 2023 A1.4, 2024 A1.5',
  cardId: 'a4-absorber',
  marks: 5,
  generate(rng, tier) {
    if (tier === 1) {
      const x = rng.step(0.1, 0.45, 0.01);
      const r1 = Number((1 - x).toFixed(2));
      const R2 = Number((1 + x).toFixed(2));
      const muL = muFromRatio(r1);
      const muU = muFromRatio(R2);
      const slip = r1 + 1 / r1 - 2;
      const up = ceilTo(muL, 2);
      const down = Math.floor(muL * 100 + 1e-9) / 100;
      const parts: SolvePart[] = [
        {
          kind: 'numeric',
          id: 'mu',
          label: 'Smallest mass ratio $\\mu = m_2/m_1$ that meets both limits (unrounded)',
          answer: muL,
          unit: '',
          tol: 0.01,
          traps: traps(muL, [
            { value: muU, message: `That is the upper-limit candidate ($r_2$ = ${R2}). It leaves the lower mode at 1/${R2} = ${F(1 / R2)}, only ${F((1 - 1 / R2) * 100, 3)} % below: inside the band.`, trapId: 'absorber-lower-binds' },
            { value: slip, message: '$\\mu = r^2 + r^{-2} - 2$: you used $r$ where $r^2$ belongs.', trapId: 'sqrt' },
          ]),
        },
        {
          kind: 'numeric',
          id: 'r2',
          label: 'Upper new frequency ratio $r_2 = \\omega_2/\\Omega$ for that design',
          answer: 1 / r1,
          unit: '',
          tol: 0.005,
          traps: traps(1 / r1, [{ value: R2, message: 'The spread is geometric, not symmetric: $r_1r_2 = 1$, so $r_2 = 1/r_1$, which is more than $1 + x$.', trapId: 'absorber-lower-binds' }]),
        },
      ];
      if (down < up - 1e-9)
        parts.push(
          choice('round', 'The answer must be reported to two decimal places. How do you round it?', [
            { text: 'Up: a minimum mass ratio must never be rounded down.', correct: true, why: `Reporting ${up.toFixed(2)} puts the lower mode at $r_1$ = ${F(tunedRatios(up)[0])}, still at least ${pc(x)} below.` },
            { text: 'To the nearest value: the rounding error is far smaller than the margin.', correct: false, why: `Here the nearest value is ${(Math.round(muL * 100) / 100).toFixed(2)}. ${Math.round(muL * 100) / 100 < muL ? `It puts $r_1$ at ${F(tunedRatios(Math.round(muL * 100) / 100)[0])}: only ${F((1 - tunedRatios(Math.round(muL * 100) / 100)[0]) * 100, 4)} % below, so the spec fails.` : 'It happens to round up this time, but the rule is to round a minimum up.'}` },
            { text: 'Down: a lighter absorber is cheaper and the error is tiny.', correct: false, why: `${down.toFixed(2)} puts $r_1$ at ${F(tunedRatios(down)[0])}: only ${F((1 - tunedRatios(down)[0]) * 100, 4)} % below. The spec fails (Week 5: 0.98 fails, 0.99 passes).` },
          ])
        );
      return {
        prompt: `A system is forced at exactly its natural frequency $\\Omega = \\sqrt{k_1/m_1}$. An undamped absorber with the same natural frequency ($\\beta = 1$) is added. As a precaution, both new natural frequencies must be at least ${pc(x)} away from $\\Omega$.`,
        givens: [{ sym: 'x', value: pc(x), label: 'required margin either side' }],
        parts,
        hints: [
          'With $\\beta = 1$, Eq 6.22 is $r^4 - (2+\\mu)r^2 + 1 = 0$, so $r_1r_2 = 1$: the new frequencies spread **geometrically** about $\\Omega$. Each limit gives a candidate $\\mu$; only the larger one meets both.',
          `Limits: $r_1 \\le 1 - x$ = ${r1} and $r_2 \\ge 1 + x$ = ${R2}. Rearranged, $\\mu = (r - 1/r)^2$ for either root.`,
          `Lower limit: $\\mu_L = (${T(1 / r1)} - ${r1})^2 = ${T(muL)}$. Upper limit: $\\mu_U = (${R2} - ${T(1 / R2)})^2 = ${T(muU)}$.`,
          `Take the larger: $\\mu$ = **${F(muL)}**, reported as **${up.toFixed(2)}** (rounded up). Then $r_1$ = ${r1} and $r_2 = 1/r_1$ = **${F(1 / r1)}** ≥ ${R2} ✓. The smaller candidate ${F(muU)} would put the lower mode at 1/${R2} = ${F(1 / R2)}, only ${F((1 - 1 / R2) * 100, 3)} % below: it fails.`,
        ],
      };
    }

    if (tier === 2) {
      const building = rng.chance(0.35);
      if (building) {
        const mt = rng.step(500, 4000, 100);
        const m = mt * 1000;
        const fn0 = rng.step(0.6, 2.4, 0.1);
        const k = Number((m * (TAU * fn0) ** 2).toPrecision(3));
        const wn = Math.sqrt(k / m);
        const fn = wn / TAU;
        const x = rng.pick([0.2, 0.25, 0.3, 0.35]);
        const mu = muFromRatio(1 - x);
        const muU = muFromRatio(1 + x);
        const ma = mu * mt; // tonnes
        const ka = mu * k;
        return {
          prompt: `A building of mass ${mt} t stands on a foundation of stiffness ${F(k, 3)} N/m (ignore damping). A dynamic vibration absorber at the top is tuned to the building’s own natural frequency. Both new natural frequencies of the building–absorber system must be at least ${pc(x)} away from the original one. Find the minimum absorber mass and its support stiffness.`,
          givens: [
            { sym: 'm_1', value: `${mt} t`, label: 'building' },
            { sym: 'k_1', value: `${F(k, 3)} N/m`, label: 'foundation' },
            { sym: 'x', value: pc(x), label: 'margin either side' },
          ],
          parts: [
            { kind: 'numeric', id: 'mu', label: 'Mass ratio $\\mu$ (the minimum, unrounded)', answer: mu, unit: '', tol: 0.01, traps: traps(mu, [{ value: muU, message: `That is the upper-limit candidate: it leaves the lower mode at ${F(1 / (1 + x))} of the original, inside the band.`, trapId: 'absorber-lower-binds' }]) },
            { kind: 'numeric', id: 'ma', label: 'Minimum absorber mass $m_a$', answer: ma, unit: 't', tol: 0.015, traps: traps(ma, [{ value: muU * mt, message: 'You sized on the upper limit; the lower limit binds.', trapId: 'absorber-lower-binds' }]) },
            { kind: 'numeric', id: 'ka', label: 'Absorber support stiffness $k_a$', answer: ka, unit: 'N/m', tol: 0.015, traps: traps(ka, [{ value: k, message: 'That is the foundation stiffness. Tuned means $k_a/m_a = k_1/m_1$, so $k_a = \\mu k_1$.' }, { value: muU * k, message: 'Upper-limit $\\mu$: the lower limit binds.', trapId: 'absorber-lower-binds' }]) },
            { kind: 'numeric', id: 'f1', label: 'Lower new natural frequency', answer: (1 - x) * fn, unit: 'Hz', freq: true, tol: 0.01, traps: traps((1 - x) * fn, [{ value: fn / (1 + x), message: 'That is $1/(1+x)$ of the original: the upper-limit design.', trapId: 'absorber-lower-binds' }]) },
            { kind: 'numeric', id: 'f2', label: 'Upper new natural frequency', answer: fn / (1 - x), unit: 'Hz', freq: true, tol: 0.01, traps: traps(fn / (1 - x), [{ value: (1 + x) * fn, message: 'The spread is geometric: $r_2 = 1/r_1$, not $1 + x$.', trapId: 'absorber-lower-binds' }]) },
          ],
          hints: [
            'Tuned absorber ($\\beta = 1$): $r_1r_2 = 1$, so the **lower** limit binds. Size on $r_1 = 1 - x$, then $m_a = \\mu m_1$ and $k_a = \\mu k_1$.',
            `$\\omega_{11} = \\sqrt{k_1/m_1}$; $\\mu = (1/r_1 - r_1)^2$ with $r_1 = ${F(1 - x)}$; new frequencies $r_1\\omega_{11}$ and $\\omega_{11}/r_1$.`,
            `$\\omega_{11} = \\sqrt{k_1/m_1} = \\sqrt{(${T(k, 3)})/(${T(m, 3)})} = ${T(wn)}$ rad/s ($f$ = ${F(fn)} Hz); $\\mu = (${T(1 / (1 - x))} - ${F(1 - x)})^2 = ${T(mu)}$.`,
            `$m_a = ${T(mu)} \\times ${mt}$ t = **${F(ma)} t**; $k_a = \\mu k_1$ = **${F(ka)} N/m** (check: $m_a\\omega_{11}^2$ = ${F(ma * 1000 * wn * wn)} N/m). New frequencies ${F(1 - x)} × ${F(fn)} = **${F((1 - x) * fn)} Hz** and ${F(fn)}/${F(1 - x)} = **${F(fn / (1 - x))} Hz**.`,
          ],
        };
      }
      const m1 = rng.chance(0.5) ? rng.step(20, 150, 5) : rng.step(500, 4000, 100);
      const N = rng.pick([600, 720, 800, 900, 960, 1200, 1450, 1500, 1800, 2400, 3000]);
      const x = rng.pick([0.15, 0.2, 0.25, 0.3, 0.35]);
      const lowerOnly = rng.chance(0.35);
      const W = (N * TAU) / 60;
      const mu = muFromRatio(1 - x);
      const muU = muFromRatio(1 + x);
      const m2 = mu * m1;
      const k2 = m2 * W * W;
      // Sizing on the upper new frequency (r₂ = 1 + x) is the classic slip whether or not the upper limit is
      // stated: with r₁r₂ = 1 it leaves the lower resonance at N/(1 + x), less than x below the speed.
      const upLow = 1 / (1 + x);
      const upMsg = `That sizes $\\mu$ from the upper new frequency ($r_2 = 1 + x$ = ${F(1 + x)}). With $\\beta = 1$, $r_1r_2 = 1$, so it leaves the lower resonance at ${F(upLow)} × ${N} = ${F(upLow * N)} rpm, only ${F((1 - upLow) * 100, 3)} % below: the **lower** frequency binds. Use $r_1 = 1 - x$ = ${F(1 - x)}.`;
      const spec = lowerOnly ? `the resonance (critical speed) must move at least ${pc(x)} below the operating speed` : `both new natural frequencies must be at least ${pc(x)} away from the operating speed`;
      return {
        prompt: `A machine and its mounting (equivalent mass ${m1} kg) is in resonance at its operating speed of ${N} rpm. An undamped dynamic vibration absorber with the same natural frequency as the machine ($\\beta = 1$) will be fitted, and ${spec}.`,
        givens: [
          { sym: 'm_1', value: `${m1} kg`, label: 'equivalent primary mass' },
          { sym: 'N', value: `${N} rpm`, label: 'operating speed = critical speed' },
          { sym: 'x', value: pc(x), label: lowerOnly ? 'shift below' : 'margin either side' },
        ],
        parts: [
          { kind: 'numeric', id: 'mu', label: 'Mass ratio $\\mu = m_2/m_1$ (the minimum, unrounded)', answer: mu, unit: '', tol: 0.01, traps: traps(mu, [{ value: muU, message: upMsg, trapId: 'absorber-lower-binds' }]) },
          { kind: 'numeric', id: 'm2', label: 'Absorber mass $m_2$', answer: m2, unit: 'kg', tol: 0.015, traps: traps(m2, [{ value: muU * m1, message: 'You sized on the upper new frequency ($r_2 = 1 + x$). With $r_1r_2 = 1$ the **lower** one binds: $\\mu = (1/r_1 - r_1)^2$ with $r_1 = 1 - x$.', trapId: 'absorber-lower-binds' }]) },
          {
            kind: 'numeric',
            id: 'k2',
            label: 'Absorber spring stiffness $k_2$',
            answer: k2,
            unit: 'N/m',
            tol: 0.015,
            traps: traps(k2, [
              { value: m2 * N * N, message: 'You used rpm directly. $\\Omega = 2\\pi N/60$ in rad/s.', trapId: 'units' },
              { value: m2 * (N / 60) ** 2, message: 'You used Hz. $k_2 = m_2\\Omega^2$ needs rad/s.', trapId: 'units' },
              { value: m1 * W * W, message: 'That is the machine’s own stiffness $k_1 = m_1\\Omega^2$; the absorber needs $k_2 = \\mu k_1$.' },
              { value: muU * m1 * W * W, message: '$k_2 = m_2\\Omega^2$ is right, but this $m_2$ was sized on the upper new frequency ($r_2 = 1 + x$). The **lower** one binds: size on $r_1 = 1 - x$.', trapId: 'absorber-lower-binds' },
            ]),
          },
          { kind: 'numeric', id: 'N1', label: 'Lower new natural frequency (critical speed)', answer: (1 - x) * N, unit: 'rpm', freq: true, tol: 0.01, traps: traps((1 - x) * N, [{ value: N / (1 + x), message: 'That is $N/(1+x)$: the design sized on the upper new frequency, which leaves the critical speed less than the required margin below.', trapId: 'absorber-lower-binds' }]) },
          { kind: 'numeric', id: 'N2', label: 'Upper new natural frequency', answer: N / (1 - x), unit: 'rpm', freq: true, tol: 0.01, traps: traps(N / (1 - x), [{ value: (1 + x) * N, message: 'The spread is geometric: $r_2 = 1/r_1$.', trapId: 'absorber-lower-binds' }]) },
        ],
        hints: [
          `Tuned absorber: with $\\beta = 1$, $r_1r_2 = 1$. ${lowerOnly ? 'The lower resonance must sit at $r_1 \\le 1 - x$.' : 'The lower limit binds: once $r_1 = 1 - x$, $r_2 = 1/r_1 > 1 + x$ automatically.'} Then $m_2 = \\mu m_1$ and $k_2 = m_2\\Omega^2$.`,
          `$\\Omega = 2\\pi N/60$; $\\mu = (1/r_1 - r_1)^2$ with $r_1 = ${F(1 - x)}$; new speeds $r_1N$ and $N/r_1$.`,
          `$\\Omega = 2\\pi(${N})/60 = ${T(W)}$ rad/s, $\\Omega^2 = ${T(W * W)}$ s⁻²; $\\mu = (${T(1 / (1 - x))} - ${F(1 - x)})^2 = ${T(mu)}$.`,
          `$m_2 = ${T(mu)} \\times ${m1}$ = **${F(m2)} kg**; $k_2 = ${T(m2)} \\times ${T(W * W)}$ = **${F(k2)} N/m** (= $\\mu k_1$). New speeds ${F(1 - x)} × ${N} = **${F((1 - x) * N)} rpm** and ${N}/${F(1 - x)} = **${F(N / (1 - x))} rpm**. These are the minimum values: if you round $\\mu$ for the design, round it up, never down, and scale $k_2$ with $m_2$.`,
        ],
      };
    }

    // tier 3: different margins below and above, plus the absorber stroke
    const pair = until(
      rng,
      (r) => ({ lo: r.pick([0.1, 0.15, 0.2, 0.25, 0.3]), hi: r.pick([0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4]) }),
      (p) => {
        const s = sizeForMargins(p.lo, p.hi);
        return p.lo !== p.hi && Math.abs(s.muLower - s.muUpper) > 0.05 * s.mu;
      }
    );
    const { lo, hi } = pair;
    const s = sizeForMargins(lo, hi);
    const other = s.binds === 'lower' ? s.muUpper : s.muLower;
    // Using the smaller candidate: when the lower limit binds that is the classic β = 1 slip of sizing on the upper
    // new frequency; when the upper binds it is taking the lower candidate by habit with unequal margins.
    const otherTrap = s.binds === 'lower' ? 'absorber-lower-binds' : 'a4-both-limits';
    const smaller = s.binds === 'lower' ? 'upper' : 'lower';
    const m1 = rng.step(20, 400, 10);
    const N = rng.pick([900, 1200, 1500, 1800, 2400, 3000]);
    const F0 = rng.step(40, 400, 10);
    const W = (N * TAU) / 60;
    const k1 = m1 * W * W;
    const m2 = s.mu * m1;
    const k2 = m2 * W * W;
    const X2 = (F0 / k2) * 1e6; // µm
    const k2Other = other * m1 * W * W;
    const [q1, q2] = tunedRatios(s.mu);
    return {
      prompt: `A ${m1} kg machine runs at ${N} rpm, exactly at its resonance, with an out-of-balance force of amplitude ${F0} N. An undamped absorber tuned to ${N} rpm will be fitted. The new lower resonance must be at least ${pc(lo)} below the operating speed and the new upper resonance at least ${pc(hi)} above it.`,
      givens: [
        { sym: 'm_1', value: `${m1} kg` },
        { sym: 'N', value: `${N} rpm` },
        { sym: 'F_0', value: `${F0} N`, label: 'force amplitude' },
        { sym: 'x_{lo},\\ x_{hi}', value: `${pc(lo)}, ${pc(hi)}`, label: 'margins below / above' },
      ],
      parts: [
        {
          kind: 'numeric',
          id: 'mu',
          label: 'Smallest mass ratio $\\mu$ (unrounded)',
          answer: s.mu,
          unit: '',
          tol: 0.01,
          traps: traps(s.mu, [{ value: other, message: `That candidate satisfies only the ${smaller} limit. Compute both and take the larger.`, trapId: otherTrap }]),
        },
        choice('binds', 'Which limit sets the absorber mass here?', [
          { text: 'The lower limit', correct: s.binds === 'lower', why: `$\\mu_L = (1/${F(1 - lo)} - ${F(1 - lo)})^2$ = ${F(s.muLower)}${s.binds === 'lower' ? ' is the larger candidate.' : ' is smaller, so meeting it leaves the upper resonance too close.'}` },
          { text: 'The upper limit', correct: s.binds === 'upper', why: `$\\mu_U = (${F(1 + hi)} - 1/${F(1 + hi)})^2$ = ${F(s.muUpper)}${s.binds === 'upper' ? ' is the larger candidate: with unequal margins the upper limit can bind.' : ' is smaller.'}` },
          { text: 'Both, always equally', correct: false, why: 'Only when $1/(1 - x_{lo}) = 1 + x_{hi}$.' },
        ]),
        { kind: 'numeric', id: 'm2', label: 'Absorber mass $m_2$', answer: m2, unit: 'kg', tol: 0.015, traps: traps(m2, [{ value: other * m1, message: `That uses the smaller candidate ($\\mu$ = ${F(other)}), which meets only the ${smaller} limit. Take the larger, ${F(s.mu)}.`, trapId: otherTrap }]) },
        {
          kind: 'numeric',
          id: 'k2',
          label: 'Absorber stiffness $k_2$',
          answer: k2,
          unit: 'N/m',
          tol: 0.015,
          traps: traps(k2, [
            { value: m2 * (N / 60) ** 2, message: 'Use $\\Omega$ in rad/s.', trapId: 'units' },
            { value: k1, message: 'That is $k_1$; $k_2 = \\mu k_1$.' },
            { value: k2Other, message: `$k_2 = m_2\\Omega^2$ is right, but with the smaller candidate $\\mu$ = ${F(other)} (the ${smaller} limit only). Use the larger, ${F(s.mu)}.`, trapId: otherTrap },
          ]),
        },
        {
          kind: 'numeric',
          id: 'X2',
          label: 'Absorber amplitude $|X_2|$ at the operating speed',
          answer: X2,
          unit: 'µm',
          tol: 0.02,
          traps: traps(X2, [
            { value: (F0 / k1) * 1e6, message: 'That is the machine’s static deflection $F_0/k_1$. Tuned, the absorber spring must carry the whole force: $|X_2| = F_0/k_2$.' },
            { value: (F0 / (k1 + k2)) * 1e6, message: 'The springs are not in parallel here: at the tuned speed $X_1 = 0$ and $|X_2| = F_0/k_2$.' },
            { value: (F0 / k2Other) * 1e6, message: `$|X_2| = F_0/k_2$ is right, but this $k_2$ comes from the smaller candidate $\\mu$ = ${F(other)}.`, trapId: otherTrap },
          ]),
        },
      ],
      hints: [
        'Each limit gives a candidate $\\mu = (r - 1/r)^2$. With equal margins the lower always binds; with unequal margins compute both and take the larger. Tuned, the machine stands still and the absorber spring cancels the force: $X_2 = -F_0/k_2$.',
        `$\\mu_L$ from $r_1 = ${F(1 - lo)}$, $\\mu_U$ from $r_2 = ${F(1 + hi)}$; $\\mu = \\max(\\mu_L, \\mu_U)$; $m_2 = \\mu m_1$; $k_2 = m_2\\Omega^2$; $|X_2| = F_0/k_2$.`,
        `$\\mu_L = (${T(1 / (1 - lo))} - ${F(1 - lo)})^2 = ${T(s.muLower)}$, $\\mu_U = (${F(1 + hi)} - ${T(1 / (1 + hi))})^2 = ${T(s.muUpper)}$; $\\Omega = ${T(W)}$ rad/s.`,
        `The ${s.binds} limit binds: $\\mu$ = **${F(s.mu)}**, so $m_2$ = **${F(m2)} kg** and $k_2 = ${T(m2)} \\times ${T(W)}^2$ = **${F(k2)} N/m**. New resonances at ${F(q1 * N)} and ${F(q2 * N)} rpm (${F((1 - q1) * 100, 3)} % below, ${F((q2 - 1) * 100, 3)} % above). Stroke $|X_2| = F_0/k_2 = ${F0}/(${T(k2)})$ m = **${F(X2)} µm**.`,
      ],
    };
  },
};

// ======================================================================================= 2. untuned
const untuned: SolveGenerator = {
  id: 'a4-mistuned',
  title: 'Untuned absorber: β, new frequencies and retuning',
  summary: 'Compute β first, solve Eq 6.23, judge the result against an excitation band, then retune.',
  tiers: [1, 2, 3],
  source: 'Similar to 2025 A1.1–A1.2',
  cardId: 'a4-untuned',
  marks: 4,
  generate(rng, tier) {
    const pick = until(
      rng,
      (r) => {
        const n = r.step(300, 700, 10);
        const N = Math.round((n * r.pick([0.84, 0.88, 0.92, 1.085, 1.1, 1.13, 1.17, 1.21])) / 10) * 10;
        return { n, N };
      },
      (p) => p.N >= 200 && Math.abs(Math.sqrt(p.N / p.n) - 1) >= 0.038
    );
    const { n, N } = pick;
    const mu = 1 / N;
    const b2 = N / n;
    const beta = Math.sqrt(b2);
    const [r1, r2] = generalRatios(mu, beta);
    const ratio = r2 / r1;
    const [t1, t2] = tunedRatios(mu);
    const g1 = beta * r1;
    const g2 = beta * r2;
    const B = 1 + (1 + mu) * b2;
    const prompt = `A building (mass $m_1$, ground stiffness $k_1$) carries an absorber (mass $m_2$, stiffness $k_2$) at its top; treat them as an undamped 2-DoF system. The ground stiffness is ${n} times the absorber stiffness ($k_1 = ${n}\\,k_2$) and the mass ratio is $\\mu = m_2/m_1$ = 1:${N}.`;
    const givens = [
      { sym: 'k_1/k_2', value: `${n}`, label: 'stiffness ratio' },
      { sym: '\\mu', value: `1/${N}`, label: 'mass ratio' },
    ];
    const ratioPart: SolvePart = {
      kind: 'numeric',
      id: 'ratio',
      label: 'Ratio of the higher to the lower natural frequency',
      answer: ratio,
      unit: '',
      tol: 0.003,
      traps: traps(ratio, [
        { value: t2 / t1, message: 'That is the tuned formula, Eq 6.22, which assumes $\\beta = 1$. Here $\\beta \\neq 1$: use Eq 6.23.', trapId: 'beta-not-1' },
        { value: ratio * ratio, message: 'That is $r_2^2/r_1^2$: take the square root.', trapId: 'sqrt' },
      ]),
    };
    const hint2 = `$\\beta^2 = (k_2/k_1)/\\mu$; Eq 6.23: $\\beta^2r^4 - [1 + (1+\\mu)\\beta^2]r^2 + 1 = 0$, roots $r^2 = \\dfrac{B \\pm \\sqrt{B^2 - 4\\beta^2}}{2\\beta^2}$ with $B = 1 + (1+\\mu)\\beta^2$; $\\omega/\\omega_{11} = \\beta r$.`;
    const hint3 = `$\\beta^2 = (1/${n})/(1/${N}) = ${N}/${n} = ${T(b2)}$, $\\beta = ${T(beta)}$; $B = ${T(B, 6)}$, $B^2 - 4\\beta^2 = ${T(B * B - 4 * b2)}$; $r_1^2 = ${T(r1 * r1, 5)}$, $r_2^2 = ${T(r2 * r2, 5)}$.`;

    if (tier === 1) {
      return {
        prompt,
        givens,
        parts: [
          {
            kind: 'numeric',
            id: 'beta',
            label: 'Tuning ratio $\\beta = \\omega_{22}/\\omega_{11}$',
            answer: beta,
            unit: '',
            tol: 0.003,
            traps: traps(beta, [
              { value: 1, message: 'Don’t assume a tuned absorber: $\\beta^2 = (k_2/k_1)/\\mu$.', trapId: 'beta-not-1' },
              { value: 1 / beta, message: 'Inverted: $\\beta^2 = \\dfrac{k_2/m_2}{k_1/m_1} = \\dfrac{k_2}{k_1}\\cdot\\dfrac{m_1}{m_2}$.' },
              { value: b2, message: 'That is $\\beta^2$.', trapId: 'sqrt' },
            ]),
          },
          ratioPart,
        ],
        hints: [
          'Check the tuning before choosing a formula: Eq 6.22 needs $\\beta = 1$; otherwise use the general Eq 6.23.',
          hint2,
          hint3,
          `$\\beta$ = **${F(beta)}** (not tuned). $r_1 = ${T(r1)}$, $r_2 = ${T(r2)}$, ratio $= \\sqrt{${T(r2 * r2, 5)}/${T(r1 * r1, 5)}}$ = **${F(ratio)}**. (The tuned formula would give ${F(t2 / t1)}, wrongly.)`,
        ],
      };
    }

    const b = rng.pick([0.02, 0.03, 0.05]);
    if (tier === 2) {
      const inside = g1 > 1 - b || g2 < 1 + b;
      const zeroIn = Math.abs(beta - 1) < b;
      const loAns = (g1 - 1) * 100;
      const hiAns = (g2 - 1) * 100;
      return {
        prompt: `${prompt} Earthquake (or wind) excitation is expected anywhere within ±${pc(b)} of the building’s original natural frequency $\\omega_{11}$.`,
        givens: [...givens, { sym: '\\pm', value: pc(b), label: 'excitation band' }],
        parts: [
          ratioPart,
          {
            kind: 'numeric',
            id: 'lo',
            label: 'Lower new natural frequency relative to the original: $(\\omega_{n1}/\\omega_{11} - 1) \\times 100$ (negative = below)',
            answer: loAns,
            unit: '%',
            tol: 0.02,
            absTol: 0.06,
            traps: traps(loAns, [
              { value: (t1 - 1) * 100, message: 'That is the tuned result ($\\beta = 1$).', trapId: 'beta-not-1' },
              { value: (r1 - 1) * 100, message: '$r$ is relative to $\\omega_{22}$. Relative to the building: $\\omega/\\omega_{11} = \\beta r$.' },
            ]),
          },
          {
            kind: 'numeric',
            id: 'hi',
            label: 'Upper new natural frequency relative to the original: $(\\omega_{n2}/\\omega_{11} - 1) \\times 100$',
            answer: hiAns,
            unit: '%',
            tol: 0.02,
            absTol: 0.06,
            traps: traps(hiAns, [
              { value: (t2 - 1) * 100, message: 'That is the tuned result ($\\beta = 1$).', trapId: 'beta-not-1' },
              { value: (r2 - 1) * 100, message: 'Multiply $r$ by $\\beta$ to compare with $\\omega_{11}$.' },
            ]),
          },
          choice('band', `How does this absorber cope with excitation within ±${pc(b)} of $\\omega_{11}$?`, [
            { text: 'Badly: a new resonance lies inside the band.', correct: inside, why: inside ? `The ${g1 > 1 - b ? 'lower' : 'upper'} new resonance (${F(g1 > 1 - b ? g1 : g2)} $\\omega_{11}$) is within ±${pc(b)}.` : `Both resonances (${F(g1)} and ${F(g2)} $\\omega_{11}$) are outside ±${pc(b)}.` },
            { text: 'Well: both resonances are outside the band and the building’s zero is inside it.', correct: !inside && zeroIn, why: `The zero of $X_1$ is at $\\omega_{22} = \\beta\\omega_{11}$ = ${F(beta)} $\\omega_{11}$, ${zeroIn ? 'inside' : 'outside'} the band.` },
            { text: 'Partly: both resonances are outside the band, but so is the zero.', correct: !inside && !zeroIn, why: `Resonances at ${F(g1)} and ${F(g2)} $\\omega_{11}$; zero at ${F(beta)} $\\omega_{11}$.` },
          ]),
        ],
        hints: [
          'Compute $\\beta$ first; the general Eq 6.23 gives $r = \\omega/\\omega_{22}$, and $\\beta r = \\omega/\\omega_{11}$ compares with the original frequency. The building stands still at the absorber’s own frequency, $\\omega_{22} = \\beta\\omega_{11}$.',
          hint2,
          hint3,
          `Ratio = **${F(ratio)}**. Relative to $\\omega_{11}$: $\\beta r$ = ${F(g1)} and ${F(g2)}, i.e. **${F(loAns, 3)} %** and **+${F(hiAns, 3)} %**. Band ±${pc(b)}: ${inside ? 'a resonance falls inside it, so the building can still be driven at resonance' : 'both resonances are outside it'}; the zero (${F(beta)} $\\omega_{11}$) is ${zeroIn ? 'inside' : 'outside'} it.`,
        ],
      };
    }

    // tier 3: retune
    const kfac = n / N;
    const mfac = N / n;
    const muMin = muFromRatio(1 - b);
    const muUp = muFromRatio(1 + b);
    // Retuning through the mass changes μ itself (to μ·β² = 1/n); retuning through k₂ keeps μ = 1/N.
    const muByMass = mu * mfac;
    const verdict = (v: number) => (v >= muMin ? 'both resonances clear the band' : 'a resonance stays inside the band');
    return {
      prompt: `${prompt} Excitation is expected within ±${pc(b)} of the building’s original natural frequency. Improve the absorber by tuning its stiffness or mass, then size it for the band.`,
      givens: [...givens, { sym: '\\pm', value: pc(b), label: 'excitation band' }],
      parts: [
        {
          kind: 'numeric',
          id: 'kfac',
          label: 'Keeping $m_2$, multiply $k_2$ by what factor to tune it ($\\beta = 1$)?',
          answer: kfac,
          unit: '',
          tol: 0.005,
          traps: traps(kfac, [
            { value: mfac, message: 'That factor tunes it by changing $m_2$. Changing $k_2$: $k_{2,new} = \\mu k_1$, a factor $\\mu k_1/k_2$.' },
            { value: Math.sqrt(kfac), message: 'That is the frequency factor $1/\\beta$. Stiffness goes with frequency squared.', trapId: 'sqrt' },
          ]),
        },
        {
          kind: 'numeric',
          id: 'mfac',
          label: 'Or, keeping $k_2$, multiply $m_2$ by what factor?',
          answer: mfac,
          unit: '',
          tol: 0.005,
          traps: traps(mfac, [
            { value: kfac, message: 'That is the stiffness factor. Changing the mass needs the inverse.' },
            { value: Math.sqrt(mfac), message: 'Mass goes with frequency squared: the factor is $\\beta^2$.', trapId: 'sqrt' },
          ]),
        },
        {
          kind: 'numeric',
          id: 'mumin',
          label: `With the absorber tuned, the smallest $\\mu$ that keeps both new resonances outside ±${pc(b)}`,
          answer: muMin,
          unit: '',
          tol: 0.01,
          traps: traps(muMin, [{ value: muUp, message: 'Upper-limit candidate: with $r_1r_2 = 1$ the lower limit binds.', trapId: 'absorber-lower-binds' }]),
        },
      ],
      hints: [
        'Tuned means $k_2/m_2 = k_1/m_1$, i.e. $k_2 = \\mu k_1$. Then Eq 6.22 applies and the lower limit $r_1 = 1 - x$ sets the minimum $\\mu$ (keep $k_2 = \\mu k_1$ as $\\mu$ grows).',
        '$k$-factor $= \\mu k_1/k_2$; $m$-factor $= k_2/(\\mu k_1) = \\beta^2$; $\\mu_{min} = (1/(1-x) - (1-x))^2$.',
        `$\\mu k_1/k_2 = ${n}/${N} = ${T(kfac)}$; $\\beta^2 = ${N}/${n} = ${T(mfac)}$; $1 - x$ = ${F(1 - b)}.`,
        `Multiply $k_2$ by **${F(kfac)}** (${kfac < 1 ? 'soften it' : 'stiffen it'} by ${F(Math.abs(1 - kfac) * 100, 3)} %), or multiply $m_2$ by **${F(mfac)}**. Then $\\mu_{min} = (${T(1 / (1 - b))} - ${F(1 - b)})^2$ = **${F(muMin)}**. Retuned through $k_2$, $\\mu$ stays ${F(mu)}, so ${verdict(mu)}; retuned through $m_2$, $\\mu$ becomes 1/${n} = ${F(muByMass)}, so ${verdict(muByMass)}. Heavier absorbers spread the resonances further; damping caps the peaks.`,
      ],
    };
  },
};

// ======================================================================================= 3. anti-resonance of a chain
function chainData(rng: Rng) {
  return until(
    rng,
    (r) => ({ m1: r.step(2, 40, 1), m2: r.step(1, 20, 0.5), k1: r.step(5, 80, 1) * 1000, k2: r.step(2, 40, 1) * 1000 }),
    (c) => {
      const za = Math.sqrt(c.k2 / c.m2);
      const zb = Math.sqrt((c.k1 + c.k2) / c.m1);
      const zk = Math.sqrt(c.k1 / c.m1);
      return Math.abs(za / zb - 1) > 0.08 && Math.abs(za / zk - 1) > 0.08 && Math.abs(zb / zk - 1) > 0.08;
    }
  );
}

const antires: SolveGenerator = {
  id: 'a4-zero-freq',
  title: 'Anti-resonance of a two-mass chain',
  summary: 'Which mass stands still, at what frequency, and what the other mass is doing.',
  tiers: [1, 2, 3],
  source: 'Similar to official 2018 A1.8; 2019 Q1g; 2024 A1.3',
  cardId: 'a4-antires',
  marks: 3,
  generate(rng, tier) {
    const { m1, m2, k1, k2 } = chainData(rng);
    const on = rng.pick([1, 2] as const);
    const za = Math.sqrt(k2 / m2);
    const zb = Math.sqrt((k1 + k2) / m1);
    const zk = Math.sqrt(k1 / m1);
    const wa = on === 1 ? za : zb;
    const wo = on === 1 ? zb : za;
    const [w1, w2] = chainFrequencies(m1, k1, m2, k2);
    const forced = on === 1 ? 'm_1' : 'm_2';
    const prompt = `Mass $m_1$ = ${m1} kg is connected to the ground by a spring $k_1$ = ${k1 / 1000} kN/m, and mass $m_2$ = ${m2} kg is connected to $m_1$ by a spring $k_2$ = ${k2 / 1000} kN/m (motion along one line, no damping). A harmonic force $F_0\\sin\\Omega t$ acts on ${on === 1 ? 'the inner mass $m_1$' : 'the outer mass $m_2$'}.`;
    const givens = [
      { sym: 'm_1', value: `${m1} kg` },
      { sym: 'k_1', value: `${k1} N/m`, label: 'to ground' },
      { sym: 'm_2', value: `${m2} kg` },
      { sym: 'k_2', value: `${k2} N/m`, label: 'between the masses' },
    ];
    const formula = on === 1 ? '\\sqrt{k_2/m_2}' : '\\sqrt{(k_1+k_2)/m_1}';
    const why = on === 1 ? 'With $m_1$ held still, $m_2$ resonates on $k_2$: $\\alpha_{11} = (k_2 - m_2\\Omega^2)/\\Delta$ = 0.' : 'With $m_2$ held still, $m_1$ resonates on both springs: $\\alpha_{22} = (k_1 + k_2 - m_1\\Omega^2)/\\Delta$ = 0.';
    const faPart: SolvePart = {
      kind: 'numeric',
      id: 'fa',
      label: `Forcing frequency at which $${forced}$ does not move`,
      answer: wa / TAU,
      unit: 'Hz',
      freq: true,
      tol: 0.01,
      traps: traps(wa / TAU, [
        { value: wo / TAU, message: `That is the zero for a force on the ${on === 1 ? 'outer' : 'inner'} mass. Here the force is on $${forced}$: hold $${forced}$ fixed and find the natural frequency of the rest.`, trapId: 'a4-antires-own' },
        { value: zk / TAU, message: '$\\sqrt{k_1/m_1}$ is $m_1$ on $k_1$ alone; it is not where any driving point stands still.', trapId: 'a4-antires-own' },
      ]),
    };
    const hints: [string, string, string, string] = [
      'A driving-point anti-resonance is the natural frequency of the system with the forced coordinate held fixed: the rest of the system then acts as an absorber.',
      `Force on $${forced}$: zero at $\\Omega = ${formula}$ (numerator of $\\alpha_{${on}${on}}$). Natural frequencies from $m_1m_2\\omega^4 - [m_1k_2 + m_2(k_1+k_2)]\\omega^2 + k_1k_2 = 0$.`,
      `$${formula} = ${on === 1 ? `\\sqrt{${k2}/${m2}}` : `\\sqrt{${k1 + k2}/${m1}}`} = ${T(wa)}$ rad/s; $\\omega_1 = ${T(w1)}$, $\\omega_2 = ${T(w2)}$ rad/s.`,
      `$\\Omega_a$ = ${F(wa)} rad/s = **${F(wa / TAU)} Hz**, between $\\omega_1$ = ${F(w1 / TAU)} Hz and $\\omega_2$ = ${F(w2 / TAU)} Hz. There the other mass moves with $X = -F_0/k_2$, so spring $k_2$ cancels the force on $${forced}$.`,
    ];
    if (tier === 1) {
      return {
        prompt,
        givens,
        parts: [
          choice('which', `Which expression gives the frequency at which $${forced}$ stands still?`, [
            { text: '$\\sqrt{k_2/m_2}$', correct: on === 1, why: on === 1 ? why : 'That is the zero of $\\alpha_{11}$ (force on $m_1$).' },
            { text: '$\\sqrt{k_1/m_1}$', correct: false, why: 'That is $m_1$ on $k_1$ alone, ignoring $k_2$.' },
            { text: '$\\sqrt{(k_1+k_2)/m_1}$', correct: on === 2, why: on === 2 ? why : 'That is the zero of $\\alpha_{22}$ (force on $m_2$).' },
            { text: 'It never stands still', correct: false, why: 'Only a cross receptance like $\\alpha_{12} = k_2/\\Delta$ has no zero.' },
          ]),
          faPart,
        ],
        hints,
      };
    }
    if (tier === 2) {
      return {
        prompt,
        givens,
        parts: [
          faPart,
          { kind: 'numeric', id: 'f1', label: 'Lower natural frequency $f_1$', answer: w1 / TAU, unit: 'Hz', freq: true, tol: 0.01, traps: traps(w1 / TAU, [{ value: w2 / TAU, message: 'That is the upper natural frequency.' }, { value: Math.min(zk, za) / TAU, message: 'That is an uncoupled frequency; coupling pushes the natural frequencies apart. Solve $\\det(K - \\omega^2M) = 0$.' }]) },
          { kind: 'numeric', id: 'f2', label: 'Upper natural frequency $f_2$', answer: w2 / TAU, unit: 'Hz', freq: true, tol: 0.01, traps: traps(w2 / TAU, [{ value: w1 / TAU, message: 'That is the lower natural frequency.' }, { value: zb / TAU, message: 'That is $\\sqrt{(k_1+k_2)/m_1}$, an anti-resonance, not a natural frequency.' }]) },
          choice('where', 'Where does the anti-resonance lie?', [
            { text: 'Between $\\omega_1$ and $\\omega_2$', correct: true, why: 'Interlacing: $\\Delta < 0$ at a chain’s driving-point zero, so it sits between the roots.' },
            { text: 'Below $\\omega_1$', correct: false, why: 'Impossible for a chain: $\\Delta$ is positive below $\\omega_1$ and negative at the zero.' },
            { text: 'Above $\\omega_2$', correct: false, why: 'Impossible for a chain: $\\Delta$ is positive above $\\omega_2$.' },
          ]),
        ],
        hints,
      };
    }
    const F0 = rng.step(20, 200, 10);
    const Xo = (-F0 / k2) * 1000;
    return {
      prompt: `${prompt} $F_0$ = ${F0} N.`,
      givens: [...givens, { sym: 'F_0', value: `${F0} N` }],
      parts: [
        { ...faPart, unit: 'rad/s', answer: wa, traps: traps(wa, [{ value: wo, message: `That is the zero for a force on the other mass.`, trapId: 'a4-antires-own' }, { value: zk, message: '$\\sqrt{k_1/m_1}$ is not a driving-point zero.', trapId: 'a4-antires-own' }]) } as SolvePart,
        {
          kind: 'numeric',
          id: 'Xo',
          label: `At that frequency, amplitude of the other mass ($${on === 1 ? 'm_2' : 'm_1'}$), signed relative to $F_0$`,
          answer: Xo,
          unit: 'mm',
          tol: 0.02,
          traps: traps(Xo, [
            { value: (F0 / k1) * 1000 * Math.sign(Xo), message: 'It is spring $k_2$ that must cancel the force, so $|X| = F_0/k_2$.' },
            { value: (F0 / (k1 + k2)) * 1000 * Math.sign(Xo), message: 'The springs do not share the force: $k_2$ carries all of it.' },
          ]),
        },
        choice('physics', `Why does $${forced}$ stand still there?`, [
          { text: `The other mass moves so that spring $k_2$ pushes on $${forced}$ with exactly $-F_0$.`, correct: true, why: 'It acts as a tuned absorber: $k_2(X_{other} - 0) = -F_0$.' },
          { text: `The force acts at a node of one of the modes.`, correct: false, why: 'Both modes move both masses; the zero is a forced-response cancellation, not a node.' },
          { text: 'Both masses are at rest between the two resonances.', correct: false, why: 'The other mass moves with $|X| = F_0/k_2$.' },
        ]),
      ],
      hints: [
        hints[0],
        `${hints[1]} Row ${on} of $(K - \\Omega^2M)X = F$ with $X_${on} = 0$ gives $-k_2 X_{other} = F_0$.`,
        `${hints[2]} $X_{other} = -F_0/k_2 = -${F0}/${k2}$ m.`,
        `$\\Omega_a$ = **${F(wa)} rad/s**; $X_{other}$ = **${F(Xo)} mm** (negative: it moves against the force). Spring $k_2$ is deflected by ${F(Math.abs(Xo))} mm and pulls on $${forced}$ with exactly $F_0$ = ${F0} N, opposing it.`,
      ],
    };
  },
};

// ======================================================================================= 4. resonance count / which receptance vanishes
const count: SolveGenerator = {
  id: 'a4-count',
  title: 'How many resonances, and which receptance can vanish?',
  summary: 'Count resonances (including rigid-body modes), find them, and decide which receptance has a zero.',
  tiers: [1, 2, 3],
  source: 'Similar to 2024 A1.2–A1.3; summary notes trap 10',
  cardId: 'a4-antires',
  marks: 3,
  generate(rng, tier) {
    if (tier === 3) {
      const m1 = rng.step(2, 30, 1);
      const m2 = rng.step(1, 20, 1);
      const k = rng.step(2, 60, 1) * 1000;
      const we = Math.sqrt((k * (m1 + m2)) / (m1 * m2));
      const z = Math.sqrt(k / m2);
      return {
        prompt: `Two masses, $m_1$ = ${m1} kg and $m_2$ = ${m2} kg, slide without friction and are joined only by a spring $k$ = ${k / 1000} kN/m (nothing attaches them to the ground). A harmonic force acts on $m_1$.`,
        givens: [
          { sym: 'm_1', value: `${m1} kg` },
          { sym: 'm_2', value: `${m2} kg` },
          { sym: 'k', value: `${k} N/m` },
        ],
        parts: [
          choice('n', 'How many natural frequencies does the system have, counting rigid-body modes?', [
            { text: 'Two: $\\omega = 0$ (rigid-body translation) and one elastic mode', correct: true, why: '$\\det K = 0$: the unrestrained pair can translate freely, giving $\\omega = 0$.' },
            { text: 'One elastic mode only', correct: false, why: 'The rigid-body mode at $\\omega = 0$ counts when rigid-body modes are included (summary notes trap 10).' },
            { text: 'Two elastic modes', correct: false, why: 'One spring between two free masses gives only one elastic mode.' },
            { text: 'Three', correct: false, why: 'Two DoF, two natural frequencies.' },
          ]),
          {
            kind: 'numeric',
            id: 'we',
            label: 'Elastic natural frequency',
            answer: we,
            unit: 'rad/s',
            freq: true,
            tol: 0.01,
            traps: traps(we, [
              { value: Math.sqrt(k / m1), message: 'That is $m_1$ on a grounded spring. Free–free: $\\omega^2 = k(m_1+m_2)/(m_1m_2)$.' },
              { value: Math.sqrt(k / m2), message: 'That is $m_2$ on a grounded spring (it is the anti-resonance of $\\alpha_{11}$).' },
              { value: Math.sqrt(k / (m1 + m2)), message: 'Use the reduced mass $m_1m_2/(m_1+m_2)$, not the total mass.' },
            ]),
          },
          {
            kind: 'numeric',
            id: 'za',
            label: 'Forcing frequency at which the driven mass $m_1$ stands still',
            answer: z,
            unit: 'rad/s',
            freq: true,
            tol: 0.01,
            traps: traps(z, [
              { value: Math.sqrt(k / m1), message: 'Hold $m_1$ fixed: then $m_2$ vibrates on $k$, at $\\sqrt{k/m_2}$.', trapId: 'a4-antires-own' },
              { value: we, message: 'That is the natural frequency (a resonance), not the zero.' },
            ]),
          },
        ],
        hints: [
          'An unrestrained system has $\\det K = 0$: one rigid-body mode at $\\omega = 0$, so a force at low frequency produces a large rigid-body motion. The driving-point zero is still the natural frequency with the driven mass held fixed.',
          '$K = k\\begin{bmatrix} 1 & -1 \\\\ -1 & 1 \\end{bmatrix}$: $\\det(K - \\omega^2M) = \\omega^2[m_1m_2\\omega^2 - k(m_1+m_2)] = 0$. Zero of $\\alpha_{11}$: $k - m_2\\Omega^2 = 0$.',
          `$\\omega_e^2 = ${k}(${m1 + m2})/(${m1} \\times ${m2}) = ${T(we * we)}$ s⁻²; $k/m_2 = ${T(k / m2)}$ s⁻².`,
          `Natural frequencies **0** and **${F(we)} rad/s** (${F(we / TAU)} Hz); $m_1$ stands still at $\\sqrt{k/m_2}$ = **${F(z)} rad/s**, where $m_2$ acts as an absorber.`,
        ],
      };
    }
    const { m1, m2, k1, k2 } = chainData(rng);
    const [w1, w2] = chainFrequencies(m1, k1, m2, k2);
    const za = Math.sqrt(k2 / m2);
    const zb = Math.sqrt((k1 + k2) / m1);
    const zk = Math.sqrt(k1 / m1);
    const prompt = `On frictionless rollers, a wall is connected by spring $k_1$ = ${k1 / 1000} kN/m to mass $m_1$ = ${m1} kg, which is connected by spring $k_2$ = ${k2 / 1000} kN/m to mass $m_2$ = ${m2} kg. A harmonic force $F_0\\cos\\Omega t$ acts on $m_2$, and $\\Omega$ is varied slowly.`;
    const givens = [
      { sym: 'k_1', value: `${k1} N/m` },
      { sym: 'm_1', value: `${m1} kg` },
      { sym: 'k_2', value: `${k2} N/m` },
      { sym: 'm_2', value: `${m2} kg` },
    ];
    const B = m1 * k2 + m2 * (k1 + k2);
    if (tier === 1) {
      return {
        prompt,
        givens,
        parts: [
          choice('n', 'How many forced resonances occur?', [
            { text: 'Two, at the two natural frequencies', correct: true, why: '$\\Delta = \\det(K - \\Omega^2M)$ has two positive roots, and neither mode has a node at $m_2$, so both show up.' },
            { text: 'One', correct: false, why: 'Both modes move $m_2$, so the force excites both.' },
            { text: 'Three, including a rigid-body resonance at $\\Omega = 0$', correct: false, why: 'The wall restrains the chain: $\\det K = k_1k_2 \\neq 0$, so there is no rigid-body mode.' },
            { text: 'It depends on $F_0$', correct: false, why: 'Linear system: resonance frequencies do not depend on the force amplitude.' },
          ]),
          { kind: 'numeric', id: 'w1', label: 'Lower resonance $\\omega_1$', answer: w1, unit: 'rad/s', freq: true, tol: 0.01, traps: traps(w1, [{ value: Math.min(zk, za), message: 'That is an uncoupled frequency. Solve $\\det(K - \\omega^2M) = 0$.' }, { value: w1 * w1, message: 'That is $\\omega_1^2$.', trapId: 'sqrt' }]) },
          { kind: 'numeric', id: 'w2', label: 'Upper resonance $\\omega_2$', answer: w2, unit: 'rad/s', freq: true, tol: 0.01, traps: traps(w2, [{ value: Math.max(zk, za), message: 'That is an uncoupled frequency.' }, { value: zb, message: '$\\sqrt{(k_1+k_2)/m_1}$ is the zero of $\\alpha_{22}$, not a resonance.', trapId: 'a4-antires-own' }]) },
        ],
        hints: [
          'Forced resonances are where $\\Delta = \\det(K - \\Omega^2M) = 0$: one per degree of freedom, unless the force acts at a node of a mode. A grounded chain has no rigid-body mode.',
          `$K = \\begin{bmatrix} k_1+k_2 & -k_2 \\\\ -k_2 & k_2 \\end{bmatrix}$, $M = \\mathrm{diag}(m_1, m_2)$: $m_1m_2\\omega^4 - [m_1k_2 + m_2(k_1+k_2)]\\omega^2 + k_1k_2 = 0$.`,
          `$${m1 * m2}\\,\\omega^4 - ${T(B, 6)}\\,\\omega^2 + ${T(k1 * k2, 6)} = 0$.`,
          `$\\omega^2 = ${T(w1 * w1)}$ and $${T(w2 * w2)}$ s⁻², so **two** resonances: $\\omega_1$ = **${F(w1)} rad/s** and $\\omega_2$ = **${F(w2)} rad/s** (${F(w1 / TAU)} and ${F(w2 / TAU)} Hz).`,
        ],
      };
    }
    return {
      prompt,
      givens,
      parts: [
        choice('which', 'Which receptance can be zero at some frequency?', [
          { text: '$\\alpha_{22} = X_2/F_2$ only', correct: true, why: 'Its numerator $k_1 + k_2 - m_1\\Omega^2$ vanishes once; $\\alpha_{12}$’s numerator is the constant $k_2$.' },
          { text: '$\\alpha_{12} = X_1/F_2$ only', correct: false, why: '$\\alpha_{12} = k_2/\\Delta$ never vanishes.', },
          { text: 'Both $\\alpha_{22}$ and $\\alpha_{12}$', correct: false, why: '$\\alpha_{12}$ has a constant numerator.' },
          { text: 'Neither', correct: false, why: '$\\alpha_{22}$ has a zero at $\\sqrt{(k_1+k_2)/m_1}$.' },
        ]),
        {
          kind: 'numeric',
          id: 'z',
          label: 'Frequency of that zero',
          answer: zb,
          unit: 'rad/s',
          freq: true,
          tol: 0.01,
          traps: traps(zb, [
            { value: za, message: '$\\sqrt{k_2/m_2}$ is the zero for a force on $m_1$. Here hold $m_2$ fixed: $m_1$ on $k_1 + k_2$.', trapId: 'a4-antires-own' },
            { value: zk, message: '$m_1$ on $k_1$ alone ignores $k_2$.', trapId: 'a4-antires-own' },
          ]),
        },
        choice('where', 'Relative to the resonances, the zero is…', [
          { text: 'between them', correct: true, why: `Interlacing: $\\Delta(\\Omega^2 = (k_1+k_2)/m_1) = -k_2^2 < 0$. Here ${F(w1)} < ${F(zb)} < ${F(w2)} rad/s.` },
          { text: 'below both', correct: false, why: `It is above $\\omega_1$ = ${F(w1)} rad/s.` },
          { text: 'above both', correct: false, why: `It is below $\\omega_2$ = ${F(w2)} rad/s.` },
        ]),
      ],
      hints: [
        'Write $X = (K - \\Omega^2M)^{-1}F$ with $F = [0,\\ F_0]^T$: $X_1 = k_2F_0/\\Delta$ and $X_2 = (k_1 + k_2 - m_1\\Omega^2)F_0/\\Delta$. A receptance can vanish only through its numerator.',
        '$\\alpha_{22} = 0$ when $k_1 + k_2 = m_1\\Omega^2$ ($m_1$ resonating with $m_2$ held fixed); $\\alpha_{12} = k_2/\\Delta \\neq 0$.',
        `$\\Omega_a = \\sqrt{(${k1} + ${k2})/${m1}} = ${T(zb)}$ rad/s; resonances ${F(w1)} and ${F(w2)} rad/s.`,
        `Only $\\alpha_{22}$ vanishes, at **${F(zb)} rad/s** (${F(zb / TAU)} Hz), between the resonances. There $m_1$ moves with $X_1 = -F_0/k_2$ and acts as an absorber for $m_2$.`,
      ],
    };
  },
};

// ======================================================================================= 5. suppressed coordinate
function kMatrix(rng: Rng) {
  return until(
    rng,
    (r) => ({ K11: r.step(200, 2000, 50), K22: r.step(40, 500, 10), K12: r.pick([-1, 1]) * r.step(20, 300, 10) }),
    (k) => k.K11 * k.K22 - k.K12 * k.K12 > 0.2 * k.K11 * k.K22
  );
}

const suppress: SolveGenerator = {
  id: 'a4-suppress',
  title: 'Forcing frequency that suppresses one coordinate',
  summary: 'Set the numerator of $X_i = \\Delta_i/\\Delta$ to zero; then the other amplitude from the suppressed row.',
  tiers: [1, 2, 3],
  source: 'Similar to 2023 A2.5 and 2025 A2.4',
  cardId: 'a4-antires',
  marks: 4,
  generate(rng, tier) {
    if (tier === 3) {
      const d = until(
        rng,
        (r) => ({ kx: r.step(1, 5, 0.2) * 1e5, c12: -r.pick([0.3, 0.4, 0.5, 0.6]), c22: r.pick([0.5, 0.6, 0.75, 0.9, 1]), m: r.step(15, 60, 1), I: r.step(5, 30, 1), me: r.pick([0.01, 0.015, 0.02, 0.025, 0.03]) }),
        (q) => q.c22 > q.c12 * q.c12 * 1.2
      );
      const { kx, c12, c22, m, I, me } = d;
      const Wa = Math.sqrt((c22 * kx) / I);
      const Na = toRpm(Wa);
      const Nmax = Math.ceil((Na * 1.25) / 100) * 100;
      const F0 = me * Wa * Wa;
      const th = (F0 / (c12 * kx)) * 1000; // mrad
      const WmaxF = me * ((Nmax * TAU) / 60) ** 2;
      return {
        prompt: `A rangehood fan housing hangs on three identical wall mounts (axial stiffness $k_x$ each). With transverse displacement $y$ and rotation $\\theta$ about its centre of mass, and all three mounts already included, its equations of motion are
$$\\begin{bmatrix} ${m} & 0 \\\\ 0 & ${I} \\end{bmatrix}\\begin{bmatrix} \\ddot y \\\\ \\ddot\\theta \\end{bmatrix} + k_x\\begin{bmatrix} 1 & ${c12} \\\\ ${c12} & ${c22} \\end{bmatrix}\\begin{bmatrix} y \\\\ \\theta \\end{bmatrix} = \\begin{bmatrix} F_0 \\\\ 0 \\end{bmatrix}\\sin\\Omega t$$
with $k_x$ = ${F(kx, 3)} N/m (masses in kg, kg m²). The fan sits at the centre of mass with an unbalance $m_ee$ = ${me} kg m, so $F_0 = m_ee\\,\\Omega^2$, and it runs up to ${Nmax} rpm.`,
        givens: [
          { sym: 'k_x', value: `${F(kx, 3)} N/m` },
          { sym: 'm,\\ I', value: `${m} kg, ${I} kg m²` },
          { sym: 'm_e e', value: `${me} kg m`, label: 'unbalance' },
          { sym: 'N_{max}', value: `${Nmax} rpm` },
        ],
        parts: [
          {
            kind: 'numeric',
            id: 'N',
            label: 'Fan speed at which the transverse motion $y$ is momentarily suppressed',
            answer: Na,
            unit: 'rpm',
            freq: true,
            tol: 0.01,
            traps: traps(Na, [
              { value: toRpm(Math.sqrt(kx / m)), message: 'That is $\\sqrt{k_x/m}$, $y$’s own uncoupled frequency. $Y = 0$ needs the numerator $K_{22} - I\\Omega^2 = 0$.', trapId: 'a4-antires-own' },
              { value: toRpm(Math.sqrt((3 * c22 * kx) / I)), message: 'The three mounts are already inside the matrix: multiplying $k_x$ by 3 again gives this speed (2025 A2.4 trap).' },
            ]),
          },
          {
            kind: 'numeric',
            id: 'F0',
            label: 'Unbalance force amplitude at that speed',
            answer: F0,
            unit: 'N',
            tol: 0.015,
            traps: traps(F0, [
              { value: WmaxF, message: 'Evaluate $F_0 = m_ee\\Omega^2$ at the suppression speed, not at the maximum speed.', trapId: 'unbalance-omega2' },
              { value: me * Na * Na, message: 'Use $\\Omega$ in rad/s inside $m_ee\\Omega^2$.', trapId: 'units' },
            ]),
          },
          {
            kind: 'numeric',
            id: 'th',
            label: 'Rotation amplitude $\\Theta$ at that speed (signed)',
            answer: th,
            unit: 'mrad',
            tol: 0.02,
            traps: traps(th, [{ value: (F0 / (c22 * kx)) * 1000 * Math.sign(th), message: 'With $Y = 0$, use the **first** row: $K_{12}\\Theta = F_0$.' }]),
          },
        ],
        hints: [
          'Only $y$ is forced. $Y = \\Delta_1/\\Delta$ with $\\Delta_1 = (K_{22} - I\\Omega^2)F_0$, so $Y = 0$ when $\\Omega^2 = K_{22}/I$. The unbalance force grows as $\\Omega^2$, so evaluate it there.',
          `$K_{22} = ${c22}k_x$, $K_{12} = ${c12}k_x$; $\\Omega_a = \\sqrt{K_{22}/I}$; row 1 with $Y = 0$: $K_{12}\\Theta = F_0$.`,
          `$\\Omega_a^2 = ${c22} \\times ${T(kx, 3)}/${I} = ${T(Wa * Wa)}$ s⁻²; $F_0 = ${me} \\times ${T(Wa * Wa)}$.`,
          `$\\Omega_a = ${T(Wa)}$ rad/s = **${F(Na)} rpm** (within the ${Nmax} rpm range). $F_0$ = **${F(F0)} N**; $\\Theta = F_0/K_{12} = ${T(F0)}/(${c12} \\times ${T(kx, 3)})$ = **${F(th)} mrad**. $\\theta$ itself can never be suppressed: its numerator $-K_{12}F_0$ is constant.`,
        ],
      };
    }
    const m = rng.step(10, 60, 1);
    const I = rng.step(0.5, 6, 0.1);
    // (tiers 1–2 ask for the pitch per newton, as 2023 A2.5 did)
    if (tier === 1) {
      const { K11, K22, K12 } = kMatrix(rng);
      const Wa = Math.sqrt(K22 / I);
      const th = (1 / K12) * 1000; // mrad per N
      return {
        prompt: `A rigid platform has bounce $x$ (m) and pitch $\\theta$ (rad) with
$$M = \\begin{bmatrix} ${m} & 0 \\\\ 0 & ${I} \\end{bmatrix},\\qquad K = \\begin{bmatrix} ${K11} & ${K12} \\\\ ${K12} & ${K22} \\end{bmatrix}\\ \\ (\\text{SI units}).$$
A harmonic force $F_0\\sin\\Omega t$ acts at the centre of mass, along $x$.`,
        givens: [
          { sym: 'm,\\ I', value: `${m} kg, ${I} kg m²` },
          { sym: 'K_{11},\\ K_{12},\\ K_{22}', value: `${K11} N/m, ${K12} N, ${K22} N m/rad` },
        ],
        parts: [
          {
            kind: 'numeric',
            id: 'W',
            label: 'Forcing frequency at which the bounce $x$ is suppressed',
            answer: Wa,
            unit: 'rad/s',
            freq: true,
            tol: 0.01,
            traps: traps(Wa, [
              { value: Math.sqrt(K11 / m), message: 'That is $x$’s own uncoupled frequency. The zero of $X$ is where the **pitch** row’s diagonal vanishes: $K_{22} = I\\Omega^2$.', trapId: 'a4-antires-own' },
              { value: Math.sqrt(K22 / m), message: 'Pitch stiffness goes with the pitch inertia $I$.' },
            ]),
          },
          {
            kind: 'numeric',
            id: 'th',
            label: 'Pitch amplitude per newton of force, $\\Theta/F_0$, at that frequency (signed)',
            answer: th,
            unit: 'mrad/N',
            tol: 0.02,
            traps: traps(th, [{ value: (1 / K22) * 1000 * Math.sign(th), message: 'That is a static pitch compliance $1/K_{22}$. With $X = 0$, row 1 gives $K_{12}\\Theta = F_0$.' }]),
          },
        ],
        hints: [
          'Suppressing one coordinate means the numerator of its amplitude vanishes. With $Q = [F_0,\\ 0]^T$, $X = (K_{22} - I\\Omega^2)F_0/\\Delta$.',
          '$X = 0 \\Rightarrow \\Omega^2 = K_{22}/I$ (pitch alone resonating). Then row 1: $(K_{11} - m\\Omega^2)\\cdot 0 + K_{12}\\Theta = F_0$.',
          `$\\Omega^2 = ${K22}/${I} = ${T(K22 / I)}$ s⁻²; $\\Theta/F_0 = 1/K_{12} = 1/(${K12})$ rad/N.`,
          `$\\Omega$ = **${F(Wa)} rad/s** (${F(Wa / TAU)} Hz), and $\\Theta/F_0$ = **${F(th)} mrad/N**: the platform only pitches. ($\\Delta = -K_{12}^2 \\neq 0$ there, so the answer is valid.)`,
        ],
      };
    }
    // tier 2: off-centre force, sign conventions (2023 A2.5)
    const d = until(
      rng,
      (r) => {
        const k = kMatrix(r);
        const side = r.pick(['left', 'right'] as const);
        const b = r.pick([0.2, 0.25, 0.3, 0.4, 0.5]);
        return { ...k, side, b };
      },
      (q) => {
        const a = q.side === 'left' ? -q.b : q.b;
        const w2 = (q.K22 - a * q.K12) / I;
        const wrong = (q.K22 + a * q.K12) / I;
        if (!(w2 > 0) || !(wrong > 0)) return false;
        const D = (q.K11 - m * w2) * (q.K22 - I * w2) - q.K12 * q.K12;
        return Math.abs(D) > 0.05 * q.K11 * q.K22 && Math.abs(Math.sqrt(wrong / w2) - 1) > 0.05;
      }
    );
    const a = d.side === 'left' ? -d.b : d.b;
    const w2 = (d.K22 - a * d.K12) / I;
    const Wa = Math.sqrt(w2);
    const wrong = Math.sqrt((d.K22 + a * d.K12) / I);
    const th = (-1 / d.K12) * 1000; // mrad per N
    const D = (d.K11 - m * w2) * (d.K22 - I * w2) - d.K12 * d.K12;
    return {
      prompt: `A rigid platform has bounce $x$ (upward, m) and pitch $\\theta$ (anticlockwise, rad), so a point a distance $a$ to the right of the centre of mass moves up by $x + a\\theta$. Its equations of motion are $M\\ddot q + Kq = Q$ with
$$M = \\begin{bmatrix} ${m} & 0 \\\\ 0 & ${I} \\end{bmatrix},\\qquad K = \\begin{bmatrix} ${d.K11} & ${d.K12} \\\\ ${d.K12} & ${d.K22} \\end{bmatrix}\\ \\ (\\text{SI units}).$$
A **downward** force $F_0\\sin\\Omega t$ acts at the ${d.side} edge, ${d.b} m from the centre of mass. Find the forcing frequency at which only pitch is excited (bounce suppressed).`,
      givens: [
        { sym: 'm,\\ I', value: `${m} kg, ${I} kg m²` },
        { sym: 'K_{11},\\ K_{12},\\ K_{22}', value: `${d.K11} N/m, ${d.K12} N, ${d.K22} N m/rad` },
        { sym: 'a', value: `${a} m`, label: `force position (${d.side} edge)` },
        { sym: 'F_0', value: 'downward, at the edge' },
      ],
      parts: [
        choice('Q', 'Generalised forces $[Q_x,\\ Q_\\theta]$ (amplitudes):', [
          { text: `$[-F_0,\\ ${T(-a)}F_0]$`, correct: true, why: `Virtual work: $\\delta W = -F_0(\\delta x + a\\,\\delta\\theta)$ with $a$ = ${a} m.` },
          { text: `$[-F_0,\\ ${T(a)}F_0]$`, correct: false, why: 'Sign slip: a downward force at $a$ does work $-F_0 a\\,\\delta\\theta$.' },
          { text: `$[F_0,\\ ${T(-a)}F_0]$`, correct: false, why: 'The force is downward and $x$ is upward: $Q_x = -F_0$.' },
        ]),
        {
          kind: 'numeric',
          id: 'W',
          label: 'Forcing frequency at which the bounce $x$ is suppressed',
          answer: Wa,
          unit: 'rad/s',
          freq: true,
          tol: 0.01,
          traps: traps(Wa, [
            { value: wrong, message: 'Sign conventions mixed between $K_{12}$ and $Q_\\theta$. Keep the same positive directions for both.', trapId: 'a4-qtheta-sign' },
            { value: Math.sqrt(d.K22 / I), message: 'That ignores the moment of the off-centre force: the numerator is $(K_{22} - I\\Omega^2)Q_x - K_{12}Q_\\theta$.' },
          ]),
        },
        {
          kind: 'numeric',
          id: 'th',
          label: 'Pitch amplitude per newton, $\\Theta/F_0$, there (signed)',
          answer: th,
          unit: 'mrad/N',
          tol: 0.02,
          traps: traps(th, [{ value: (-a / d.K22) * 1000, message: 'That is the static pitch $Q_\\theta/K_{22}$. With $X = 0$, row 1 gives $K_{12}\\Theta = Q_x$.' }]),
        },
      ],
      hints: [
        'Get the generalised forces by virtual work, keep one sign convention for $K$ and $Q$, then set the numerator of $X = \\Delta_1/\\Delta$ to zero and check $\\Delta \\neq 0$.',
        '$Q_x = -F_0$, $Q_\\theta = -aF_0$. $X = [(K_{22} - I\\Omega^2)Q_x - K_{12}Q_\\theta]/\\Delta = -F_0(K_{22} - aK_{12} - I\\Omega^2)/\\Delta$, so $\\Omega^2 = (K_{22} - aK_{12})/I$. Then $K_{12}\\Theta = Q_x$.',
        `$\\Omega^2 = (${d.K22} - (${a})(${d.K12}))/${I} = ${T(w2)}$ s⁻²; $\\Delta(\\Omega) = ${T(D)}$ ≠ 0 ✓.`,
        `$\\Omega$ = **${F(Wa)} rad/s** (${F(Wa / TAU)} Hz); $\\Theta/F_0 = -1/K_{12} = -1/(${d.K12})$ rad/N = **${F(th)} mrad/N**. Mixing the sign of $Q_\\theta$ gives ${F(wrong)} rad/s, the classic slip (2023 A2.5: 8.80 vs 4.23 rad/s).`,
      ],
    };
  },
};

// ======================================================================================= 6. isolator vs absorber (2022)
const camera: SolveGenerator = {
  id: 'a4-camera',
  title: 'Isolator or absorber? A camera on a vibrating platform',
  summary: 'Cushion only, a two-stage mount, or an absorber on top: base excitation through $k_1$.',
  tiers: [1, 2, 3],
  source: 'Similar to 2022 A1.1–A1.3',
  cardId: 'a4-choose',
  marks: 4,
  sprint: false,
  generate(rng, tier) {
    const f = rng.step(1.5, 4, 0.5);
    const W = TAU * f;
    const W2 = W * W;
    const Y = rng.step(10, 50, 5); // mm
    if (tier === 1) {
      const d = until(
        rng,
        (r) => ({ m: r.step(5, 20, 1), k: r.step(100, 1000, 10) }),
        (q) => Math.abs(W / Math.sqrt(q.k / q.m) - 1) > 0.2 && Math.abs(W / Math.sqrt(q.k / q.m) - Math.SQRT2) > 0.1
      );
      const wn = Math.sqrt(d.k / d.m);
      const r = W / wn;
      const X = Y / Math.abs(1 - r * r);
      const kIso = (d.m * W2) / 2;
      return {
        prompt: `A ${d.m} kg camera is mounted on a platform that oscillates as $y = ${Y / 1000}\\cos(2\\pi \\cdot ${f}\\,t)$ m. An undamped cushion of stiffness ${d.k} N/m is placed between the platform and the camera.`,
        givens: [
          { sym: 'm', value: `${d.m} kg` },
          { sym: 'k', value: `${d.k} N/m`, label: 'cushion' },
          { sym: 'f,\\ Y', value: `${f} Hz, ${Y} mm`, label: 'platform motion' },
        ],
        parts: [
          { kind: 'numeric', id: 'r', label: 'Frequency ratio $r = \\Omega/\\omega_n$', answer: r, unit: '', tol: 0.01, traps: traps(r, [{ value: f / wn, message: 'You divided Hz by rad/s. $\\Omega = 2\\pi f$.', trapId: 'units' }]) },
          { kind: 'numeric', id: 'X', label: 'Camera amplitude $|X|$', answer: X, unit: 'mm', tol: 0.02, traps: traps(X, [{ value: (Y * r * r) / Math.abs(1 - r * r), message: 'That is the cushion’s relative deflection $|X - Y|$; the camera’s absolute motion is $Y/|1 - r^2|$.', trapId: 'force-vs-base' }]) },
          { kind: 'numeric', id: 'kiso', label: 'Largest cushion stiffness that isolates at all ($|X| < Y$)', answer: kIso, unit: 'N/m', tol: 0.015, traps: traps(kIso, [{ value: d.m * W2, message: 'That is resonance ($r = 1$). Isolation needs $r > \\sqrt2$: $k < m\\Omega^2/2$.' }]) },
          choice('abs', 'Without the cushion (camera bolted rigidly to the platform), would a small absorber fixed on top of the camera reduce its motion?', [
            { text: 'No: the platform imposes the camera’s displacement.', correct: true, why: 'An absorber only works on a flexibly mounted primary (2022 A1.1).' },
            { text: 'Yes, if it is tuned to the platform frequency.', correct: false, why: 'Tuning creates a zero only for a primary on its own spring.' },
            { text: 'Yes, if the absorber spring is soft enough.', correct: false, why: 'A soft spring under the camera isolates; one on top does nothing for a rigid fixing.' },
          ]),
        ],
        hints: [
          'The cushion makes a base-excited SDOF: $X/Y = 1/(1 - r^2)$ (undamped transmissibility). It isolates only for $r > \\sqrt2$.',
          '$\\Omega = 2\\pi f$, $\\omega_n = \\sqrt{k/m}$, $r = \\Omega/\\omega_n$; $|X| = Y/|1 - r^2|$; $k < m\\Omega^2/2$.',
          `$\\Omega = ${T(W)}$ rad/s, $\\omega_n = \\sqrt{${d.k}/${d.m}} = ${T(wn)}$ rad/s, $r = ${T(r)}$, $r^2 = ${T(r * r)}$.`,
          `$r$ = **${F(r)}**; $|X| = ${Y}/|1 - ${T(r * r)}|$ = **${F(X)} mm** (${r > Math.SQRT2 ? 'isolating' : 'amplifying'}); $k < ${d.m} \\times ${T(W2)}/2$ = **${F(kIso)} N/m**. An absorber on a rigidly fixed camera changes nothing.`,
        ],
      };
    }
    const d = until(
      rng,
      (r) => ({ mc: r.step(8, 20, 1), ma: r.step(2, 10, 1), k1: r.step(100, 600, 10), ka: r.step(50, 400, 10) }),
      (q) => {
        const [a, b] = chainFrequencies(q.ma, q.k1, q.mc, q.ka);
        const [c, e] = chainFrequencies(q.mc, q.k1, q.ma, q.ka);
        const far = (x: number) => Math.abs(W / x - 1) > 0.12;
        return far(a) && far(b) && far(c) && far(e) && Math.abs(W / Math.sqrt(q.ka / q.ma) - 1) > 0.15;
      }
    );
    const { mc, ma, k1, ka } = d;
    let target = rng.pick([5, 10, 20]);
    // two-stage: platform – k1 – ma – ka – camera
    const two = chainReceptances(ma, k1, mc, ka, W);
    const Xc2 = two.a12 * k1 * Y; // camera amplitude (mm, signed)
    // absorber on top: platform – k1 – camera – ka – ma
    const top = chainReceptances(mc, k1, ma, ka, W);
    const Xc3 = top.a11 * k1 * Y;
    // Keep the yes/no verdict well clear of the ±2 % answer tolerance: never put |X_c/Y| within 5 % of 1/target.
    const gain = Math.abs(tier === 2 ? Xc2 : Xc3) / Y;
    if (Math.abs(gain * target - 1) < 0.05) target = target === 20 ? 10 : target * 2;
    const single = Y / Math.abs(1 - (mc * W2) / k1);
    const prompt = (layout: string) =>
      `A ${mc} kg camera stands on a platform that oscillates as $y = ${Y / 1000}\\cos(2\\pi \\cdot ${f}\\,t)$ m. Available parts: a cushion of stiffness $k_1$ = ${k1} N/m and an absorber of mass $m_a$ = ${ma} kg on a spring $k_a$ = ${ka} N/m (all undamped). ${layout} The camera amplitude must be below 1/${target} of the platform’s.`;
    if (tier === 2) {
      const ok = Math.abs(Xc2) < Y / target;
      return {
        prompt: prompt('They are stacked platform → cushion → absorber mass → absorber spring → camera.'),
        givens: [
          { sym: 'm_c,\\ m_a', value: `${mc} kg, ${ma} kg` },
          { sym: 'k_1,\\ k_a', value: `${k1} N/m, ${ka} N/m` },
          { sym: 'f,\\ Y', value: `${f} Hz, ${Y} mm` },
        ],
        parts: [
          {
            kind: 'matrix',
            id: 'D',
            label: 'Dynamic stiffness $K - \\Omega^2M$ for coordinates $[x_a,\\ x_c]$ (N/m)',
            answer: [
              [k1 + ka - ma * W2, -ka],
              [-ka, ka - mc * W2],
            ],
            rowLabels: ['$x_a$', '$x_c$'],
            unit: 'N/m',
            // The camera entry m_cΩ² dwarfs k_a (k_a can be only 0.4 % of the largest entry), so the default ±2 % of
            // that entry would accept a missing k_a or a flipped off-diagonal sign. ±0.3 % still allows 4-s.f. working.
            tol: 0.003,
            traps: [
              { value: [[k1 + ka - ma * f * f, -ka], [-ka, ka - mc * f * f]], message: 'Use $\\Omega = 2\\pi f$ in rad/s: $\\Omega^2$ = ' + F(W2) + ' s⁻².', trapId: 'units' },
              { value: [[k1 + ka + ma * W2, -ka], [-ka, ka + mc * W2]], message: 'It is $K - \\Omega^2M$, not $K + \\Omega^2M$.', trapId: 'sign' },
            ],
          },
          {
            kind: 'numeric',
            id: 'Xc',
            label: 'Camera amplitude $|X_c|$',
            answer: Math.abs(Xc2),
            unit: 'mm',
            tol: 0.02,
            traps: traps(Math.abs(Xc2), [
              { value: single, message: 'That is the cushion alone under the camera (one stage). Here the force $k_1Y$ acts on $m_a$ and reaches the camera through $k_a$.' },
              { value: Math.abs(Xc2) / k1, message: 'The base enters as a force $k_1Y$ on $m_a$, not $Y$.', trapId: 'force-vs-base' },
            ]),
          },
          choice('ok', `Is the 1/${target} target met?`, [
            { text: 'Yes', correct: ok, why: `$|X_c/Y|$ = ${F(Math.abs(Xc2) / Y, 3)} ${ok ? '<' : '>'} 1/${target}.` },
            { text: 'No', correct: !ok, why: `$|X_c/Y|$ = ${F(Math.abs(Xc2) / Y, 3)} ${ok ? '<' : '>'} 1/${target}.` },
          ]),
        ],
        hints: [
          'Base motion through $k_1$ is a force $k_1Y$ on the mass that spring touches ($m_a$ here); $K$ is unchanged. Solve $(K - \\Omega^2M)X = [k_1Y,\\ 0]^T$. Below the camera the “absorber” acts as a second isolation stage.',
          '$K = \\begin{bmatrix} k_1+k_a & -k_a \\\\ -k_a & k_a \\end{bmatrix}$, $M = \\mathrm{diag}(m_a, m_c)$; $X_c = k_a k_1Y/\\Delta$.',
          `$\\Omega^2 = (2\\pi \\cdot ${f})^2 = ${T(W2)}$ s⁻²; $K - \\Omega^2M = \\begin{bmatrix} ${T(k1 + ka - ma * W2)} & ${-ka} \\\\ ${-ka} & ${T(ka - mc * W2)} \\end{bmatrix}$, $\\Delta = ${T(two.det)}$.`,
          `$X_c = ${ka} \\times ${k1} \\times ${Y}/(${T(two.det)})$ = ${F(Xc2)} mm, so $|X_c|$ = **${F(Math.abs(Xc2))} mm** ($|X_c/Y|$ = ${F(Math.abs(Xc2) / Y, 3)}): ${ok ? 'target met' : 'target missed'}. A one-stage cushion would give ${F(single)} mm.`,
        ],
      };
    }
    const kTune = ma * W2;
    const ok = Math.abs(Xc3) < Y / target;
    const fa = Math.sqrt(ka / ma) / TAU;
    return {
      prompt: prompt('This time they are arranged platform → cushion → camera, with the absorber (spring and mass) mounted on top of the camera.'),
      givens: [
        { sym: 'm_c,\\ m_a', value: `${mc} kg, ${ma} kg` },
        { sym: 'k_1,\\ k_a', value: `${k1} N/m, ${ka} N/m` },
        { sym: 'f,\\ Y', value: `${f} Hz, ${Y} mm` },
      ],
      parts: [
        {
          kind: 'numeric',
          id: 'Xc',
          label: 'Camera amplitude $|X_c|$',
          answer: Math.abs(Xc3),
          unit: 'mm',
          tol: 0.02,
          traps: traps(Math.abs(Xc3), [
            { value: Math.abs(Xc2), message: 'That is the stacked arrangement (absorber below the camera).' },
            { value: single, message: 'That ignores the absorber on top.' },
          ]),
        },
        choice('ok', `Is the 1/${target} target met?`, [
          { text: 'Yes', correct: ok, why: `$|X_c/Y|$ = ${F(Math.abs(Xc3) / Y, 3)}.` },
          { text: 'No', correct: !ok, why: `$|X_c/Y|$ = ${F(Math.abs(Xc3) / Y, 3)}.` },
        ]),
        {
          kind: 'numeric',
          id: 'kt',
          label: `Absorber stiffness that would hold the camera still at ${f} Hz`,
          answer: kTune,
          unit: 'N/m',
          tol: 0.015,
          traps: traps(kTune, [
            { value: ma * f * f, message: 'Use $\\Omega$ in rad/s: $k_a = m_a(2\\pi f)^2$.', trapId: 'units' },
            { value: mc * W2, message: 'Tune the absorber with its own mass $m_a$, not the camera mass.' },
          ]),
        },
      ],
      hints: [
        'Now the camera is the primary, on the cushion $k_1$; the absorber sits on top. The base force $k_1Y$ acts on the camera. The camera stands still only when $\\sqrt{k_a/m_a} = \\Omega$.',
        '$M = \\mathrm{diag}(m_c, m_a)$, same $K$ form; $X_c = k_1Y(k_a - m_a\\Omega^2)/\\Delta$; tuning $k_a = m_a\\Omega^2$.',
        `$\\Omega^2 = ${T(W2)}$ s⁻²; $k_a - m_a\\Omega^2 = ${T(ka - ma * W2)}$; $\\Delta = ${T(top.det)}$. The absorber is tuned to ${F(fa, 3)} Hz, not ${f} Hz.`,
        `$|X_c| = ${k1} \\times ${Y} \\times |${T(ka - ma * W2)}|/|${T(top.det)}|$ = **${F(Math.abs(Xc3))} mm** (${ok ? 'meets' : 'misses'} 1/${target}). Tuned to the platform it would need $k_a = ${ma} \\times ${T(W2)}$ = **${F(kTune)} N/m**.`,
      ],
    };
  },
};

// ======================================================================================= 7. steady-state amplitudes
const steady: SolveGenerator = {
  id: 'a4-steady',
  title: 'Steady-state amplitudes X = (K − Ω²M)⁻¹F',
  summary: 'Direct inversion for a two-mass chain: force on a mass, or base motion through a spring.',
  tiers: [1, 2, 3],
  source: 'LA6 Eq 6.5–6.13; similar to Week 4 Q3, 2022 A1.2',
  cardId: 'a4-forced',
  marks: 4,
  generate(rng, tier) {
    const d = until(
      rng,
      (r) => ({ m1: r.step(1, 10, 0.5), m2: r.step(0.5, 5, 0.5), k1: r.step(1, 20, 0.5) * 1000, k2: r.step(0.5, 10, 0.5) * 1000, f: r.step(1, 12, 0.5) }),
      (q) => {
        const [a, b] = chainFrequencies(q.m1, q.k1, q.m2, q.k2);
        const W = TAU * q.f;
        const far = (x: number) => Math.abs(W / x - 1) > 0.1;
        const ok = far(a) && far(b) && far(Math.sqrt(q.k2 / q.m2)) && far(Math.sqrt((q.k1 + q.k2) / q.m1));
        if (tier !== 2 || !ok) return ok;
        // Tier 2 checks K − Ω²M itself, to ±2 % of its largest entry: keep every stiffness and inertia term at least
        // 10 % of that entry, so that dropping Ω²M, using f for Ω or subtracting the springs is never accepted.
        const W2 = W * W;
        const s = Math.max(Math.abs(q.k1 + q.k2 - q.m1 * W2), q.k2, Math.abs(q.k2 - q.m2 * W2));
        return Math.min(q.m1 * W2, q.m2 * W2, q.k1, q.k2) >= 0.1 * s;
      }
    );
    const { m1, m2, k1, k2, f } = d;
    const W = TAU * f;
    const W2 = W * W;
    const rec = chainReceptances(m1, k1, m2, k2, W);
    const recHz = chainReceptances(m1, k1, m2, k2, f);
    const givens = [
      { sym: 'm_1,\\ m_2', value: `${m1} kg, ${m2} kg` },
      { sym: 'k_1,\\ k_2', value: `${k1} N/m, ${k2} N/m` },
      { sym: 'f', value: `${f} Hz` },
    ];
    const D11 = k1 + k2 - m1 * W2;
    const D22 = k2 - m2 * W2;
    if (tier === 3) {
      const Y = rng.step(2, 20, 1); // mm
      const X1 = rec.a11 * k1 * Y;
      const X2 = rec.a12 * k1 * Y;
      return {
        prompt: `The base of a two-storey model moves as $y = Y\\cos\\Omega t$ with $Y$ = ${Y} mm at ${f} Hz. It drives mass $m_1$ through spring $k_1$; mass $m_2$ sits on spring $k_2$ above $m_1$. Use absolute displacements $x_1$, $x_2$ (no damping).`,
        givens: [...givens, { sym: 'Y', value: `${Y} mm` }],
        parts: [
          choice('F', 'The equivalent force vector (amplitudes, multiplying $\\cos\\Omega t$) is:', [
            { text: '$[k_1Y,\\ 0]^T$', correct: true, why: 'From $V = \\tfrac12k_1(x_1 - y)^2 + \\dots$: the base pushes $m_1$ through $k_1$. Check: at $\\Omega \\to 0$, $x_1 = x_2 = Y$.' },
            { text: '$[Y,\\ 0]^T$', correct: false, why: 'A displacement is not a force: multiply by the spring that transmits it.' },
            { text: '$[-k_1Y,\\ 0]^T$', correct: false, why: 'Raising the base pushes $m_1$ up: positive.' },
            { text: '$[0,\\ k_1Y]^T$', correct: false, why: '$k_1$ touches $m_1$, not $m_2$.' },
          ]),
          { kind: 'numeric', id: 'X1', label: 'Amplitude $X_1$ (signed: negative = anti-phase with the base)', answer: X1, unit: 'mm', tol: 0.02, traps: traps(X1, [{ value: recHz.a11 * k1 * Y, message: 'You used $f$ (Hz) for $\\Omega$.', trapId: 'units' }, { value: rec.a11 * Y, message: 'The force is $k_1Y$, not $Y$.', trapId: 'force-vs-base' }]) },
          { kind: 'numeric', id: 'X2', label: 'Amplitude $X_2$ (signed)', answer: X2, unit: 'mm', tol: 0.02, traps: traps(X2, [{ value: recHz.a12 * k1 * Y, message: 'You used $f$ (Hz) for $\\Omega$.', trapId: 'units' }, { value: rec.a12 * Y, message: 'The force is $k_1Y$, not $Y$.', trapId: 'force-vs-base' }]) },
        ],
        hints: [
          'Base motion through $k_1$ acts like a force $k_1Y$ on $m_1$; then it is an ordinary forced problem, $X = (K - \\Omega^2M)^{-1}F$.',
          '$X_1 = (k_2 - m_2\\Omega^2)k_1Y/\\Delta$, $X_2 = k_2k_1Y/\\Delta$, $\\Delta = (k_1 + k_2 - m_1\\Omega^2)(k_2 - m_2\\Omega^2) - k_2^2$.',
          `$\\Omega^2 = ${T(W2)}$ s⁻²; $k_1+k_2-m_1\\Omega^2 = ${T(D11)}$, $k_2 - m_2\\Omega^2 = ${T(D22)}$, $\\Delta = ${T(rec.det)}$; $k_1Y = ${T(k1 * Y / 1000)}$ N.`,
          `$X_1$ = **${F(X1)} mm**, $X_2$ = **${F(X2)} mm** (${X2 < 0 ? 'anti-phase with the base' : 'in phase with the base'}); $|X_2/Y|$ = ${F(Math.abs(X2) / Y, 3)}.`,
        ],
      };
    }
    const F0 = rng.step(10, 200, 10);
    const on = tier === 1 ? 1 : 2;
    const X1 = (on === 1 ? rec.a11 : rec.a12) * F0 * 1000;
    const X2 = (on === 1 ? rec.a12 : rec.a22) * F0 * 1000;
    const X1hz = (on === 1 ? recHz.a11 : recHz.a12) * F0 * 1000;
    const X2hz = (on === 1 ? recHz.a12 : recHz.a22) * F0 * 1000;
    const prompt = `Mass $m_1$ is attached to the ground by $k_1$ and mass $m_2$ to $m_1$ by $k_2$ (undamped chain). A force $F_0\\cos\\Omega t$ with $F_0$ = ${F0} N at ${f} Hz acts on $m_${on}$.`;
    const parts: SolvePart[] = [];
    if (tier === 2)
      parts.push({
        kind: 'matrix',
        id: 'D',
        label: 'Dynamic stiffness $K - \\Omega^2M$ (N/m)',
        answer: [
          [D11, -k2],
          [-k2, D22],
        ],
        rowLabels: ['$x_1$', '$x_2$'],
        unit: 'N/m',
        traps: [
          { value: [[k1 + k2 - m1 * f * f, -k2], [-k2, k2 - m2 * f * f]], message: 'Use $\\Omega = 2\\pi f$ in rad/s.', trapId: 'units' },
          { value: [[k1 + k2 + m1 * W2, -k2], [-k2, k2 + m2 * W2]], message: 'It is $K - \\Omega^2M$.', trapId: 'sign' },
          { value: [[k1 - k2 - m1 * W2, -k2], [-k2, k2 - m2 * W2]], message: '$k_{11} = k_1 + k_2$: both springs resist when $m_1$ moves.' },
        ],
      });
    parts.push(
      { kind: 'numeric', id: 'X1', label: 'Amplitude $X_1$ (signed: negative = anti-phase with the force)', answer: X1, unit: 'mm', tol: 0.02, traps: traps(X1, [{ value: X1hz, message: 'You used $f$ (Hz) for $\\Omega$.', trapId: 'units' }, on === 1 && { value: (F0 / k1) * 1000, message: 'That is the static deflection $F_0/k_1$; the dynamic answer needs $(K - \\Omega^2M)^{-1}$.' }]) },
      { kind: 'numeric', id: 'X2', label: 'Amplitude $X_2$ (signed)', answer: X2, unit: 'mm', tol: 0.02, traps: traps(X2, [{ value: X2hz, message: 'You used $f$ (Hz) for $\\Omega$.', trapId: 'units' }]) }
    );
    if (tier === 2)
      parts.push(
        choice('phase', `Relative to the force, $m_2$ moves…`, [
          { text: 'in phase', correct: X2 > 0, why: `$X_2$ = ${F(X2)} mm is ${X2 > 0 ? 'positive' : 'negative'}.` },
          { text: 'in anti-phase (180°)', correct: X2 < 0, why: `$X_2$ = ${F(X2)} mm is ${X2 > 0 ? 'positive' : 'negative'}.` },
          { text: '90° behind', correct: false, why: 'Undamped steady responses are exactly in phase or anti-phase.' },
        ])
      );
    const num1 = on === 1 ? `(k_2 - m_2\\Omega^2)F_0` : `k_2F_0`;
    const num2 = on === 1 ? `k_2F_0` : `(k_1 + k_2 - m_1\\Omega^2)F_0`;
    return {
      prompt,
      givens: [...givens, { sym: 'F_0', value: `${F0} N on $m_${on}$` }],
      parts,
      hints: [
        'Steady state at the forcing frequency: $X = (K - \\Omega^2M)^{-1}F$. For 2×2, swap the diagonal, negate the off-diagonal and divide by $\\Delta$.',
        `$K = \\begin{bmatrix} k_1+k_2 & -k_2 \\\\ -k_2 & k_2 \\end{bmatrix}$; $X_1 = ${num1}/\\Delta$, $X_2 = ${num2}/\\Delta$.`,
        `$\\Omega = 2\\pi(${f}) = ${T(W)}$ rad/s, $\\Omega^2 = ${T(W2)}$; $K - \\Omega^2M = \\begin{bmatrix} ${T(D11)} & ${-k2} \\\\ ${-k2} & ${T(D22)} \\end{bmatrix}$, $\\Delta = ${T(rec.det)}$ N²/m².`,
        `$X_1$ = **${F(X1)} mm**, $X_2$ = **${F(X2)} mm** (${X1 * X2 > 0 ? 'the masses move together' : 'the masses move in opposite directions'}). Resonances at ${F(chainFrequencies(m1, k1, m2, k2)[0] / TAU, 3)} and ${F(chainFrequencies(m1, k1, m2, k2)[1] / TAU, 3)} Hz.`,
      ],
    };
  },
};

export const generators: SolveGenerator[] = [absorberSize, untuned, antires, count, suppress, camera, steady].map(withTrapGap);
