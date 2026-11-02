// C2 problem generators. Numbers are randomised within the ranges the papers use (2025 A3.3, 2024 A3.4,
// Week 12 Q1–Q2, 2024 A3.5); hints walk concept -> set-up -> substitution -> worked solution.
import type { NumericPart, SolveGenerator, SolvePart } from '../../engine/types';
import { fmt, tex } from '../../engine/format';
import { sdofReceptance, toAccelerance } from '../../physics/frf';
import { cabs } from '../../physics/complex';
import { TAU, halfPowerExact, pinnedShape, realExtremes, zetaFromDecay } from './physics';
import { beamLayoutFigure, couplingFigure, decayFigure, magFigure, reImFigure, type Cursor } from './figures';

const f3 = (x: number) => fmt(x, 3);
const f4 = (x: number) => fmt(x, 4);
const t4 = (x: number) => tex(x, 4);
/** A TeX number used as a divisor: bracketed when it is written as a × 10ⁿ, so 1/(4.5 × 10⁻⁶) cannot read as (1/4.5) × 10⁻⁶. */
const d4 = (x: number) => {
  const s = tex(x, 4);
  return s.includes('\\times') ? `(${s})` : s;
};
/** Exam-style cursor value with 6 significant figures, e.g. 5.43917×10⁻⁶. */
const c6 = (x: number) => fmt(x, 6);
type Trap = NonNullable<NumericPart['traps']>[number];

/** Keep finite traps that sit clearly outside the answer's tolerance (and are not duplicates of each other). */
export function cleanTraps(answer: number, list: Trap[], tol = 0.02, absTol = 0): Trap[] {
  const gap = tol + 0.01;
  const out: Trap[] = [];
  for (const t of list) {
    if (!Number.isFinite(t.value)) continue;
    if (Math.abs(t.value - answer) <= Math.max(gap * Math.abs(answer), 1.5 * absTol)) continue;
    if (out.some((o) => Math.abs(o.value - t.value) <= 0.02 * Math.abs(t.value))) continue;
    out.push(t);
  }
  return out;
}

function num(p: Omit<NumericPart, 'kind'>): NumericPart {
  return { kind: 'numeric', ...p, traps: p.traps ? cleanTraps(p.answer, p.traps, p.tol ?? 0.02, p.absTol ?? 0) : undefined };
}

/** sin(n π x) with round-off zeros cleaned (so a node prints as 0, not 1.2×10⁻¹⁶). */
const shape = (n: number, x: number) => {
  const v = pinnedShape(n, x);
  return Math.abs(v) < 1e-9 ? 0 : v;
};
/** Positions as fractions of L for prose: thirds as L/3 and 2L/3. */
const posTxt = (x: number) => (Math.abs(x - 1 / 3) < 1e-9 ? 'L/3' : Math.abs(x - 2 / 3) < 1e-9 ? '2L/3' : x === 0 ? '0' : x === 1 ? 'L' : `${x}L`);
/** Positions as plain numbers for TeX: 1/3, 2/3, 0.25... */
const fracTxt = (x: number) => (Math.abs(x - 1 / 3) < 1e-9 ? '1/3' : Math.abs(x - 2 / 3) < 1e-9 ? '2/3' : String(x));

const r6 = (x: number) => Number(x.toPrecision(6));
const nice = (x: number, s = 2) => Number(x.toPrecision(s));

const LOGDEC = 'c2-logdec-cycles';
/** ζ from a logarithmic decrement (reader Eq 2.9). */
const zetaOfDelta = (delta: number) => delta / Math.sqrt(4 * Math.PI * Math.PI + delta * delta);
/**
 * The named log-decrement slips over m cycles (reader LC2-6, Eq 2.9): ln(X0/Xm) left undivided, or divided by m − 1 or
 * m + 1 (miscounting cycles as peaks). `delta` traps the decrement and `zeta` the damping ratio. The undivided ζ is
 * listed in its Eq 2.9 form and its small-damping form ln(X0/Xm)/2π, which part company once the undivided log is
 * large; when they are close, their geometric mean is added so that a rounded answer between them is caught too.
 * Add the `zeta` list with withSlips(), not through num(): its 2 % de-duplication could drop one of two close forms.
 */
function logdecSlips(X0: number, Xm: number, m: number) {
  const L = Math.log(X0 / Xm);
  const undivided = `$\\ln(X_0/X_m)$ is the decay over all ${m} cycles: divide it by $m$ = ${m} to get $\\delta$, the decay per cycle.`;
  const fewer = `$X_0$ and $X_{${m}}$ are ${m} whole cycles apart: divide by ${m}, not ${m - 1}.`;
  const more = `Divide by the ${m} cycles between the two peaks, not by the ${m + 1} peaks counted from $X_0$ to $X_{${m}}$.`;
  const zExact = zetaOfDelta(L);
  const zSmall = L / TAU;
  const zetaUndivided = zSmall / zExact <= 1.04 ? [zExact, Math.sqrt(zExact * zSmall), zSmall] : [zExact, zSmall];
  const delta: Trap[] = [
    { value: L, message: undivided, trapId: LOGDEC },
    { value: L / (m - 1), message: fewer, trapId: LOGDEC },
    { value: L / (m + 1), message: more, trapId: LOGDEC },
  ];
  const zeta: Trap[] = [
    ...zetaUndivided.map((value) => ({ value, message: undivided, trapId: LOGDEC })),
    { value: zetaOfDelta(L / (m - 1)), message: fewer, trapId: LOGDEC },
    { value: zetaOfDelta(L / (m + 1)), message: more, trapId: LOGDEC },
  ];
  return { L, delta, zeta, zetaUndivided };
}

/** Put same-message variants of one slip ahead of a part's other traps, keeping each one that lies clear of the answer. */
function withSlips(p: NumericPart, slips: Trap[]): NumericPart {
  const gap = (p.tol ?? 0.02) + 0.01;
  const clear = slips.filter((t) => Number.isFinite(t.value) && Math.abs(t.value - p.answer) > gap * Math.abs(p.answer));
  return { ...p, traps: [...clear, ...(p.traps || [])] };
}

export const generators: SolveGenerator[] = [
  // ------------------------------------------------------------------ half-power on |H|
  {
    id: 'c2-halfpower',
    title: 'ζ and k from a magnitude plot',
    summary: 'Half-power points on |H|, the stiffness from |H(0)|, and the checks |H|max ≈ 1/(2ζk), m = k/ωn², c = 2ζ√(km).',
    tiers: [1, 2, 3],
    source: 'Similar to 2025 A3.3 (cursors at 0 rad/s, the peak and the half-power points); recurs Week 12 Q1',
    cardId: 'c2-damping',
    generate(rng, tier) {
      const zeta = nice(rng.uniform(0.01, 0.08), 2);
      if (tier === 1) {
        const fn = nice(rng.uniform(5, 500), 3);
        const [a, b] = halfPowerExact(fn, zeta);
        const fa = r6(a);
        const fb = r6(b);
        const est = (fb - fa) / (2 * fn);
        return {
          prompt: `A receptance FRF has a peak at ${fn} Hz. Its magnitude falls to $1/\\sqrt2$ of the peak value at ${fa} Hz and ${fb} Hz.`,
          givens: [
            { sym: 'f_n', value: `${fn} Hz` },
            { sym: 'f_1', value: `${fa} Hz`, label: 'lower half-power point' },
            { sym: 'f_2', value: `${fb} Hz`, label: 'upper half-power point' },
          ],
          parts: [
            num({
              id: 'z',
              label: 'Damping ratio $\\zeta$',
              answer: est,
              unit: '',
              tol: 0.02,
              traps: [
                { value: fb - fa, message: 'That is the bandwidth $\\Delta f$ in Hz. Divide by $2f_n$.', trapId: 'c2-bandwidth' },
                { value: (fb - fa) / fn, message: '$\\Delta f/f_n = 2\\zeta$ (the loss factor): divide by $2f_n$.', trapId: 'factor2' },
                { value: (fb - fa) / (Math.SQRT2 * fn), message: 'The half-power bandwidth is $2\\zeta\\omega_n$, not $\\sqrt2\\zeta\\omega_n$.', trapId: 'c2-half-power' },
              ],
            }),
          ],
          hints: [
            'An isolated peak behaves as an SDOF FRF: its width at the half-power level ($|H|_{peak}/\\sqrt2$, −3 dB) is about $2\\zeta\\omega_n$ (reader Eq 2.7).',
            '$\\zeta \\approx (f_2 - f_1)/(2f_n)$: a ratio, so Hz are fine if all three are in Hz.',
            `$f_2 - f_1 = ${fb} - ${fa} = ${f4(fb - fa)}$ Hz; $2f_n = ${2 * fn}$ Hz.`,
            `$\\zeta \\approx ${f4(fb - fa)}/${2 * fn} = $ **${f4(est)}**.`,
          ],
        };
      }
      const k = nice(10 ** rng.uniform(3, 7), 2);
      const wn = nice(rng.uniform(20, 1500), 3);
      const m = k / (wn * wn);
      const c = 2 * zeta * Math.sqrt(k * m);
      const Hn = 1 / (2 * zeta * k);
      const [w1, w2] = halfPowerExact(wn, zeta);
      const W1 = r6(w1);
      const W2 = r6(w2);
      const est = (W2 - W1) / (2 * wn);
      const scale = 1;
      const cursors: Cursor[] = [
        { tag: 'A', x: 0, y: 1 / k, text: `0 rad/s, ${c6(1 / k)} m/N` },
        { tag: 'B', x: wn, y: Hn, text: `${wn} rad/s, ${c6(Hn)} m/N (peak)` },
        { tag: 'C', x: W1, y: Hn / Math.SQRT2, text: `${W1} rad/s, ${c6(Hn / Math.SQRT2)} m/N` },
        { tag: 'D', x: W2, y: Hn / Math.SQRT2, text: `${W2} rad/s, ${c6(Hn / Math.SQRT2)} m/N` },
      ];
      const parts: SolvePart[] = [
        num({
          id: 'z',
          label: 'Damping ratio $\\zeta$ (half-power method)',
          answer: est,
          unit: '',
          tol: 0.03,
          traps: [
            { value: (W2 - W1) / wn, message: '$\\Delta\\omega/\\omega_n = 2\\zeta$: divide by $2\\omega_n$.', trapId: 'factor2' },
            { value: W2 - W1, message: 'That is the bandwidth in rad/s, not $\\zeta$.', trapId: 'c2-bandwidth' },
          ],
        }),
        num({
          id: 'k',
          label: 'Stiffness $k$',
          answer: k,
          unit: 'N/m',
          traps: [
            { value: 1 / Hn, message: '$1/|H|_{peak} = 2\\zeta k$. The stiffness comes from the 0 rad/s value: $k = 1/|H(0)|$.' },
            { value: 1 / (Hn / Math.SQRT2), message: 'That uses a half-power cursor. Use cursor A (0 rad/s): $k = 1/|H(0)|$.' },
          ],
        }),
      ];
      if (tier === 3) {
        parts.push(
          num({ id: 'm', label: 'Mass $m = k/\\omega_n^2$', answer: m, unit: 'kg', traps: [{ value: k / (wn / TAU) ** 2, message: 'Use $\\omega_n$ in rad/s (the plot axis), not Hz.', trapId: 'units' }, { value: k / wn, message: 'Square $\\omega_n$: $m = k/\\omega_n^2$.', trapId: 'sqrt' }] }),
          num({ id: 'c', label: 'Damping coefficient $c = 2\\zeta\\sqrt{km}$', answer: 2 * est * Math.sqrt(k * m), unit: 'N s/m', tol: 0.03, traps: [{ value: est * Math.sqrt(k * m), message: '$c_c = 2\\sqrt{km}$: you dropped the 2.', trapId: 'factor2' }] }),
          num({ id: 'zq', label: 'Check: $\\zeta$ from the peak height, $|H(0)|/(2|H|_{peak})$', answer: zeta, unit: '', tol: 0.02, traps: [{ value: 2 * zeta, message: '$Q = |H|_{peak}/H(0) = 1/(2\\zeta)$, so $\\zeta = H(0)/(2|H|_{peak})$.', trapId: 'factor2' }] })
        );
      }
      return {
        prompt: `The receptance of an SDOF system was measured under harmonic forcing. Data cursors are shown on the magnitude plot.`,
        figure: magFigure({ k, m, c, wMax: 2 * wn, scale, unit: 'm/N', cursors }),
        parts,
        hints: [
          'Cursor A (0 rad/s) is the stiffness-controlled value $1/k$. Cursor B is the peak; C and D sit at $|H|_{peak}/\\sqrt2$ (check it), the half-power points.',
          `$\\zeta \\approx (\\omega_D - \\omega_C)/(2\\omega_B)$; $k = 1/|H(0)|$; check $|H|_{peak} \\approx 1/(2\\zeta k)$${tier === 3 ? '; then $m = k/\\omega_n^2$, $c = 2\\zeta\\sqrt{km}$' : ''}.`,
          `$${t4(Hn)}/\\sqrt2 = ${t4(Hn / Math.SQRT2)}$ ✓; $\\omega_D - \\omega_C = ${W2} - ${W1} = ${f4(W2 - W1)}$ rad/s; $|H(0)| = ${t4(1 / k)}$ m/N.`,
          `$\\zeta = ${f4(W2 - W1)}/(2 \\times ${wn}) = $ **${f4(est)}**; $k = 1/${d4(1 / k)} = $ **${fmt(k, 4)} N/m** (check: $1/(2\\zeta|H|_{peak}) = ${t4(1 / (2 * est * Hn))}$)${tier === 3 ? `; $m = ${t4(k)}/${wn}^2 = $ **${f4(m)} kg**; $c = 2(${f4(est)})\\sqrt{km} = $ **${f4(2 * est * Math.sqrt(k * m))} N s/m**; peak check $\\zeta = ${t4(1 / k)}/(2 \\times ${t4(Hn)}) = $ **${f4(zeta)}**` : ''}.`,
        ],
      };
    },
  },

  // ------------------------------------------------------------------ real and imaginary parts
  {
    id: 'c2-reim',
    title: 'ζ (and k) from the real and imaginary parts',
    summary: 'Re H peak and trough are the half-power points; Im H peaks at ωn with −1/(2ζk). Accelerance flips the order.',
    tiers: [1, 2, 3],
    source: 'Similar to 2024 A3.4; Week 12 Q1; reader LC2-11 (accelerance H₄₁, mode 3)',
    cardId: 'c2-reim',
    generate(rng, tier) {
      const zeta = nice(rng.uniform(0.01, 0.06), 2);
      if (tier === 1) {
        const fn = nice(rng.uniform(1, 400), 3);
        const ex = realExtremes(1, fn, zeta);
        const fa = nice(ex.w1, 5);
        const fb = nice(ex.w2, 5);
        const est = (fb - fa) / (2 * fn);
        return {
          prompt: `On a receptance FRF, the real part peaks at ${fa} Hz and has its trough at ${fb} Hz; the imaginary part is most negative at ${fn} Hz.`,
          givens: [
            { sym: 'f_{Re,max}', value: `${fa} Hz` },
            { sym: 'f_{Re,min}', value: `${fb} Hz` },
            { sym: 'f_{Im}', value: `${fn} Hz` },
          ],
          parts: [
            num({
              id: 'z',
              label: 'Damping ratio $\\zeta$',
              answer: est,
              unit: '',
              traps: [
                { value: fb - fa, message: 'That is the bandwidth (Hz). Divide by $2f_n$.', trapId: 'c2-bandwidth' },
                { value: (fb - fa) / fn, message: 'Divide by $2f_n$, not $f_n$.', trapId: 'factor2' },
              ],
            }),
          ],
          hints: [
            'For a receptance the real part’s peak and trough sit exactly at the half-power points $\\omega_n\\sqrt{1\\mp2\\zeta}$; the imaginary part peaks at $\\omega_n$ (LC2-5).',
            '$\\zeta \\approx (f_{trough} - f_{peak})/(2f_n)$ with $f_n$ from the Im extreme (or the Re zero crossing).',
            `$f_{trough} - f_{peak} = ${fb} - ${fa} = ${f4(fb - fa)}$ Hz.`,
            `$\\zeta = ${f4(fb - fa)}/(2 \\times ${fn}) = $ **${f4(est)}**.`,
          ],
        };
      }
      const k = nice(10 ** rng.uniform(3, 6), 2);
      const fn = nice(rng.uniform(2, 100), 3);
      const wn = TAU * fn;
      const m = k / (wn * wn);
      const c = 2 * zeta * Math.sqrt(k * m);
      if (tier === 2) {
        const ex = realExtremes(k, wn, zeta);
        const W1 = r6(ex.w1);
        const W2 = r6(ex.w2);
        const imN = -1 / (2 * zeta * k);
        const est = (W2 - W1) / (2 * r6(wn));
        const kEst = 1 / (2 * est * Math.abs(imN));
        const reC: Cursor[] = [
          { tag: 'A', x: W1, y: sdofReceptance(k, m, c, W1).re, text: `Re: ${W1} rad/s, ${c6(sdofReceptance(k, m, c, W1).re)} m/N` },
          { tag: 'B', x: W2, y: sdofReceptance(k, m, c, W2).re, text: `Re: ${W2} rad/s, ${c6(sdofReceptance(k, m, c, W2).re)} m/N` },
        ];
        const imC: Cursor[] = [{ tag: 'C', x: r6(wn), y: imN, text: `Im: ${r6(wn)} rad/s, ${c6(imN)} m/N` }];
        return {
          prompt: 'The real and imaginary parts of an SDOF receptance were measured. Data cursors are shown.',
          figure: reImFigure({ re: (w) => sdofReceptance(k, m, c, w).re, im: (w) => sdofReceptance(k, m, c, w).im, wMax: 2 * wn, unit: 'm/N', sym: 'H', reCursors: reC, imCursors: imC }),
          parts: [
            num({ id: 'z', label: 'Damping ratio $\\zeta$', answer: est, unit: '', traps: [{ value: (W2 - W1) / r6(wn), message: 'Divide by $2\\omega_n$.', trapId: 'factor2' }, { value: W2 - W1, message: 'That is the bandwidth in rad/s.', trapId: 'c2-bandwidth' }] }),
            num({ id: 'k', label: 'Stiffness $k$ from the imaginary peak, $|\\text{Im}\\,H(\\omega_n)| = 1/(2\\zeta k)$', answer: kEst, unit: 'N/m', traps: [{ value: 1 / Math.abs(imN), message: '$|\\text{Im}\\,H(\\omega_n)| = 1/(2\\zeta k)$, so $k = 1/(2\\zeta|\\text{Im}\\,H|)$.' }, { value: 1 / (4 * est * Math.abs(imN)), message: 'One factor of 2 too many: $k = 1/(2\\zeta|\\text{Im}\\,H|)$.', trapId: 'factor2' }] }),
            {
              kind: 'choice',
              id: 'ratio',
              label: 'Cross-check: the Re peak height divided by the Re trough depth is about…',
              options: [
                { text: `$(1+\\zeta)/(1-\\zeta)$ = ${f4((1 + est) / (1 - est))}`, correct: true, why: 'The extremes are $\\pm 1/(4\\zeta(1\\mp\\zeta)k)$.' },
                { text: '1 exactly', correct: false, why: 'The peak (below $\\omega_n$) is slightly taller than the trough is deep.' },
                { text: `$1/(2\\zeta)$ = ${f3(1 / (2 * est))}`, correct: false, why: 'That is the amplification $Q$ of the magnitude.' },
              ],
            },
          ],
          hints: [
            'On a receptance the real part’s peak (below $\\omega_n$) and trough (above) are the half-power points; Im H is extreme at $\\omega_n$ with value $-1/(2\\zeta k)$.',
            '$\\zeta \\approx (\\omega_B - \\omega_A)/(2\\omega_C)$; $k = 1/(2\\zeta|\\text{Im}\\,H(\\omega_n)|)$.',
            `$\\omega_B - \\omega_A = ${W2} - ${W1} = ${f4(W2 - W1)}$ rad/s; $|\\text{Im}\\,H| = ${t4(Math.abs(imN))}$ m/N.`,
            `$\\zeta = ${f4(W2 - W1)}/(2 \\times ${r6(wn)}) = $ **${f4(est)}**; $k = 1/(2 \\times ${f4(est)} \\times ${t4(Math.abs(imN))}) = $ **${fmt(kEst, 4)} N/m** (true ${fmt(k, 3)}); Re ratio $(1+\\zeta)/(1-\\zeta) = ${f4((1 + est) / (1 - est))}$.`,
          ],
        };
      }
      // Tier 3: accelerance (what an accelerometer measures): Re trough first, peak above; Im A(ωn) = 1/(2ζm).
      const A = (w: number) => toAccelerance(sdofReceptance(k, m, c, w), w);
      const ex = realExtremes(k, wn, zeta);
      // Accelerance real-part extremes: find numerically near the receptance ones.
      const findExt = (w0: number, sign: number) => {
        let best = w0;
        let bv = -Infinity;
        for (let i = -400; i <= 400; i++) {
          const w = w0 * (1 + (i / 400) * 3 * zeta);
          const v = sign * A(w).re;
          if (v > bv) {
            bv = v;
            best = w;
          }
        }
        return best;
      };
      const wTrough = r6(findExt(ex.w1, -1));
      const wPeak = r6(findExt(ex.w2, 1));
      const imA = A(wn).im;
      const est = (wPeak - wTrough) / (2 * r6(wn));
      const mEst = 1 / (2 * est * imA);
      const reC: Cursor[] = [
        { tag: 'A', x: wTrough, y: A(wTrough).re, text: `Re: ${wTrough} rad/s, ${c6(A(wTrough).re)} m/s²/N` },
        { tag: 'B', x: wPeak, y: A(wPeak).re, text: `Re: ${wPeak} rad/s, ${c6(A(wPeak).re)} m/s²/N` },
      ];
      const imC: Cursor[] = [{ tag: 'C', x: r6(wn), y: imA, text: `Im: ${r6(wn)} rad/s, ${c6(imA)} m/s²/N` }];
      return {
        prompt: 'An accelerometer test gives the **accelerance** of one isolated mode (treat it as SDOF). Data cursors are shown on its real and imaginary parts.',
        figure: reImFigure({ re: (w) => A(w).re, im: (w) => A(w).im, wMax: 2 * wn, unit: 'm/s²/N', sym: 'A', reCursors: reC, imCursors: imC }),
        parts: [
          {
            kind: 'choice',
            id: 'order',
            label: 'Which real-part extreme comes first (lower frequency) on an accelerance plot?',
            options: [
              { text: 'The trough', correct: true, why: '$A = -\\omega^2 H$ flips the sign of Re: the receptance peak becomes an accelerance trough (as in the reader’s $H_{41}$, mode 3).' },
              { text: 'The peak', correct: false, why: 'That is the receptance order.' },
            ],
          },
          num({ id: 'z', label: 'Damping ratio $\\zeta$', answer: est, unit: '', traps: [{ value: (wPeak - wTrough) / r6(wn), message: 'Divide by $2\\omega_n$.', trapId: 'factor2' }, { value: wPeak - wTrough, message: 'That is the bandwidth in rad/s, not $\\zeta$.', trapId: 'c2-bandwidth' }] }),
          num({ id: 'm', label: 'Modal mass from the imaginary peak, $\\text{Im}\\,A(\\omega_n) = 1/(2\\zeta m)$', answer: mEst, unit: 'kg', traps: [{ value: 1 / imA, message: 'Include the $2\\zeta$: $m = 1/(2\\zeta\\,\\text{Im}\\,A)$.' }, { value: mEst * wn * wn, message: 'That is the stiffness $k = m\\omega_n^2$, not the mass.' }] }),
        ],
        hints: [
          'Accelerance is $-\\omega^2 H$: at resonance $A = i\\omega_n/c$, purely imaginary and positive, $\\text{Im}\\,A = 1/(2\\zeta m)$. The real-part extremes are still (very nearly) the half-power points, but in the opposite order.',
          '$\\zeta \\approx (\\omega_B - \\omega_A)/(2\\omega_C)$; $m = 1/(2\\zeta\\,\\text{Im}\\,A(\\omega_n))$.',
          `$\\omega_B - \\omega_A = ${wPeak} - ${wTrough} = ${f4(wPeak - wTrough)}$ rad/s; Im A = ${f4(imA)} m/s²/N.`,
          `Trough first; $\\zeta = ${f4(wPeak - wTrough)}/(2 \\times ${r6(wn)}) = $ **${f4(est)}**; $m = 1/(2 \\times ${f4(est)} \\times ${f4(imA)}) = $ **${f4(mEst)} kg** (true ${f4(m)} kg).`,
        ],
      };
    },
  },

  // ------------------------------------------------------------------ mode shapes from Im
  {
    id: 'c2-modeshape',
    title: 'Mode shapes from Im H at the resonances',
    summary: 'Normalise a column of Im H values, spot an invalid modal matrix, and use reciprocity.',
    tiers: [1, 2, 3],
    source: 'Similar to Week 12 Q2; reader LC2-12 (mode 2 of the cantilever); official 2017–2019 A3.6(a)',
    cardId: 'c2-modes',
    generate(rng, tier) {
      // Beam with three points, hammer fixed at P1 (a column); accelerance Im A_i1(ω_r) = φ_r(x_i) φ_r(x_1)/(2 ζ_r m_r).
      const choices = [0.15, 0.2, 0.3, 0.35, 0.4, 0.45, 0.55, 0.6, 0.65, 0.7, 0.8, 0.85];
      // Each mode's largest-magnitude entry must be unique, or tied only with entries of the same sign: points
      // symmetric about mid-span give equal and opposite even-mode values, and "normalise by the largest entry"
      // would then have two answers of opposite sign.
      const clearMax = (pick: number[], r: number) => {
        const v = pick.map((x) => pinnedShape(r, x));
        const big = Math.max(...v.map(Math.abs));
        const top = v.filter((y) => Math.abs(y) > 0.97 * big);
        return top.every((y) => Math.sign(y) === Math.sign(top[0]));
      };
      let xs = [0.15, 0.4, 0.7];
      for (let t = 0; t < 50; t++) {
        const pick = rng.shuffle(choices).slice(0, 3).sort((a, b) => a - b);
        if ([1, 2, 3].every((r) => pick.every((x) => Math.abs(pinnedShape(r, x)) > 0.2) && clearMax(pick, r))) {
          xs = pick;
          break;
        }
      }
      const mr = nice(rng.uniform(1, 10), 2);
      const zs = [1, 2, 3].map(() => nice(rng.uniform(0.01, 0.04), 2));
      const f1 = nice(rng.uniform(5, 40), 2);
      const val = (r: number, i: number) => nice((pinnedShape(r, xs[i]) * pinnedShape(r, xs[0])) / (2 * zs[r - 1] * mr), 4);
      const cols = [1, 2, 3].map((r) => [0, 1, 2].map((i) => val(r, i)));
      const tableTxt = (r: number) => cols[r - 1].map((v) => fmt(v, 4)).join(', ');
      if (tier === 1) {
        const r = rng.pick([2, 3]);
        const c = cols[r - 1];
        const a2 = c[1] / c[0];
        const a3 = c[2] / c[0];
        return {
          prompt: `A roving-accelerometer test (hammer fixed at P1) on a structure gives these imaginary parts of the accelerance at the natural frequency of mode ${r} (${fmt(r * r * f1, 4)} Hz): P1: ${fmt(c[0], 4)}, P2: ${fmt(c[1], 4)}, P3: ${fmt(c[2], 4)} m/s²/N.`,
          givens: [
            { sym: `\\text{Im}\\,A_{11}`, value: `${fmt(c[0], 4)} m/s²/N` },
            { sym: `\\text{Im}\\,A_{21}`, value: `${fmt(c[1], 4)} m/s²/N` },
            { sym: `\\text{Im}\\,A_{31}`, value: `${fmt(c[2], 4)} m/s²/N` },
          ],
          parts: [
            num({ id: 'a2', label: 'Mode-shape amplitude at P2, scaled so that P1 = 1', answer: a2, unit: '', traps: [{ value: Math.abs(a2), message: 'Keep the sign: it tells you whether P2 moves with or against P1.', trapId: 'sign' }, { value: 1 / a2, message: 'Inverted: divide by the P1 value.' }] }),
            num({ id: 'a3', label: 'Mode-shape amplitude at P3, scaled so that P1 = 1', answer: a3, unit: '', traps: [{ value: Math.abs(a3), message: 'Keep the sign of Im A.', trapId: 'sign' }, { value: 1 / a3, message: 'Inverted: divide by the P1 value.' }] }),
            {
              kind: 'choice',
              id: 'anti',
              label: 'Which points move in antiphase with P1 in this mode?',
              multi: true,
              options: [
                { text: 'P2', correct: a2 < 0, why: a2 < 0 ? 'Its Im A has the opposite sign to P1’s.' : 'Same sign as P1: in phase.' },
                { text: 'P3', correct: a3 < 0, why: a3 < 0 ? 'Its Im A has the opposite sign to P1’s.' : 'Same sign as P1: in phase.' },
                { text: 'Neither', correct: a2 > 0 && a3 > 0, why: a2 > 0 && a3 > 0 ? 'All three Im values share a sign.' : 'At least one point has the opposite sign.' },
              ],
            },
          ],
          hints: [
            'At resonance the FRF is purely imaginary and a column of the FRF matrix is proportional to the mode shape: amplitude ∝ |Im|, sign from the sign of Im (LC2-9).',
            'Divide each value by the P1 value (keeping signs): $\\phi_i/\\phi_1 = \\text{Im}\\,A_{i1}/\\text{Im}\\,A_{11}$.',
            `$${fmt(c[1], 4)}/${fmt(c[0], 4)}$ and $${fmt(c[2], 4)}/${fmt(c[0], 4)}$.`,
            `Mode ${r} ≈ [1, **${f3(a2)}**, **${f3(a3)}**]${a2 < 0 || a3 < 0 ? `: ${[a2 < 0 ? 'P2' : '', a3 < 0 ? 'P3' : ''].filter(Boolean).join(' and ')} move against P1` : ': all in phase'}.`,
          ],
        };
      }
      const norm = cols.map((c) => {
        const big = c.reduce((b, v) => (Math.abs(v) > Math.abs(b) ? v : b), 0);
        return c.map((v) => v / big);
      });
      const P = [0, 1, 2].map((i) => [0, 1, 2].map((r) => norm[r][i])); // rows = points, cols = modes
      const bm = (A: number[][]) => `$\\begin{bmatrix} ${A.map((row) => row.map((x) => tex(x, 3)).join(' & ')).join(' \\\\ ')} \\end{bmatrix}$`;
      const table = `Im A (m/s²/N), hammer at P1: mode 1 (${f1} Hz): ${tableTxt(1)}; mode 2 (${fmt(4 * f1, 4)} Hz): ${tableTxt(2)}; mode 3 (${fmt(9 * f1, 4)} Hz): ${tableTxt(3)} (points P1, P2, P3).`;
      if (tier === 2) {
        // Invalid option: two rows of one column swapped (choose a column whose swap actually changes it).
        const cBad = [0, 1, 2].find((j) => Math.abs(P[0][j] - P[1][j]) > 0.05) ?? 0;
        const bad = P.map((row) => row.slice());
        [bad[0][cBad], bad[1][cBad]] = [bad[1][cBad], bad[0][cBad]];
        const flip = P.map((row) => row.map((x, j) => (j === 1 ? -x : x)));
        const raw = [0, 1, 2].map((i) => [0, 1, 2].map((r) => cols[r][i]));
        const negRaw = raw.map((row) => row.map((x) => -x));
        const opts = [
          { text: bm(P), correct: false, why: 'Valid: each column divided by its largest-magnitude entry.' },
          { text: bm(flip), correct: false, why: 'Valid: a whole column (mode 2) times −1.' },
          { text: bm(raw), correct: false, why: 'Valid: the raw Im values; each column has its own scale.' },
          { text: bm(bad), correct: true, why: `Not valid: two entries of mode ${cBad + 1} have been swapped between points, which changes the shape.` },
          { text: bm(negRaw), correct: false, why: 'Valid: every column times −1.' },
        ];
        const j = rng.int(1, 3);
        return {
          prompt: `A roving-accelerometer test gives these imaginary parts at the three natural frequencies. ${table}`,
          parts: [
            { kind: 'choice', id: 'bad', label: 'Which matrix (rows P1–P3, columns modes 1–3) is **not** a possible modal matrix?', options: rng.shuffle(opts) },
            num({ id: 'e', label: `Mode ${j}, normalised so its largest-magnitude entry is 1: the value at P2`, answer: norm[j - 1][1], unit: '', absTol: 0.005, traps: [{ value: Math.abs(norm[j - 1][1]), message: 'Keep the sign.', trapId: 'sign' }] }),
          ],
          hints: [
            'Each column of Im values is one mode’s shape. A column may be multiplied by any non-zero number (including −1); its rows may never be reordered.',
            'Normalise each column by its largest-magnitude entry, then compare every candidate column by column.',
            `Mode ${j}: ${tableTxt(j)} → divide by ${fmt(cols[j - 1].reduce((b, v) => (Math.abs(v) > Math.abs(b) ? v : b), 0), 4)}.`,
            `Normalised mode ${j} = [${norm[j - 1].map((v) => f3(v)).join(', ')}], so P2 = **${f3(norm[j - 1][1])}**. The invalid matrix has entries of mode ${cBad + 1} swapped between P1 and P2.`,
          ],
        };
      }
      return {
        prompt: `A roving-accelerometer test gives these imaginary parts at the three natural frequencies. ${table}`,
        parts: [
          { kind: 'matrix', id: 'P', label: 'Modal matrix (rows P1–P3, columns modes 1–3; any scaling of each column)', answer: P, rowLabels: ['P1', 'P2', 'P3'], colLabels: ['mode 1', 'mode 2', 'mode 3'], columnsUpToScale: true, tol: 0.03 },
          {
            kind: 'choice',
            id: 'recip',
            label: 'You repeat the test with the accelerometer fixed at P1 and the hammer roving over P1–P3. The mode shapes you get are…',
            options: [
              { text: 'the same: this row equals the column (reciprocity, $A_{1j} = A_{j1}$)', correct: true, why: 'For a linear structure the FRF matrix is symmetric.' },
              { text: 'different, because force and response have swapped', correct: false, why: 'Reciprocity: $H_{ij} = H_{ji}$ (LC2-9).' },
              { text: 'unobtainable: rows do not give mode shapes', correct: false, why: 'Rows work as well as columns (official 2017 A3.6(b) is false).' },
            ],
          },
          {
            kind: 'choice',
            id: 'conv',
            label: 'The same data are converted to receptance ($H = A/(-\\omega^2)$). The normalised mode shapes…',
            options: [
              { text: 'do not change', correct: true, why: 'At one $\\omega_n$ every point is multiplied by the same $-1/\\omega_n^2$ (LC2-13).' },
              { text: 'change sign at some points only', correct: false, why: 'The factor is common to the whole column.' },
              { text: 'lose their higher modes', correct: false, why: 'The higher modes get smaller, but each shape is unchanged.' },
            ],
          },
        ],
        hints: [
          'Each column (one natural frequency) of Im values is proportional to that mode’s shape. Scale each column freely; never reorder rows.',
          'Divide each column by one of its entries (e.g. the largest), keeping signs.',
          `Mode 1: ${tableTxt(1)}; mode 2: ${tableTxt(2)}; mode 3: ${tableTxt(3)}.`,
          `One answer: **${bm(P)}** (any column may be scaled). The row test gives the same shapes; receptance conversion does not change them.`,
        ],
      };
    },
  },

  // ------------------------------------------------------------------ conversions
  {
    id: 'c2-convert',
    title: 'Receptance, mobility and accelerance',
    summary: 'Convert between the three FRF forms, their phases at resonance, and modal mass from an accelerance peak.',
    tiers: [1, 2, 3],
    source: 'LC2-7 (M = A/(iω), H = A/(−ω²)); reader LC2-12 accelerance data; Lab Exp. 3 modal constant',
    cardId: 'c2-frf',
    generate(rng, tier) {
      if (tier === 1) {
        const f = nice(rng.uniform(10, 600), 3);
        const Aval = nice(rng.uniform(5, 200), 3);
        const w = TAU * f;
        const Hum = (Aval / (w * w)) * 1e6;
        const Mmm = (Aval / w) * 1e3;
        return {
          prompt: `At ${f} Hz an accelerance FRF has magnitude ${Aval} m/s²/N.`,
          givens: [
            { sym: 'f', value: `${f} Hz` },
            { sym: '|A|', value: `${Aval} m/s²/N` },
          ],
          parts: [
            num({ id: 'H', label: 'Receptance magnitude $|H|$', answer: Hum, unit: 'µm/N', traps: [{ value: (Aval / (f * f)) * 1e6, message: 'Use $\\omega$ in rad/s: $|H| = |A|/\\omega^2$ with $\\omega = 2\\pi f$.', trapId: 'units' }, { value: (Aval / w) * 1e6, message: 'Displacement is acceleration divided by $\\omega^2$, not $\\omega$.', trapId: 'sqrt' }] }),
            num({ id: 'M', label: 'Mobility magnitude $|M|$', answer: Mmm, unit: 'mm/s/N', traps: [{ value: (Aval / f) * 1e3, message: 'Use $\\omega = 2\\pi f$.', trapId: 'units' }, { value: Aval * w * 1e3, message: 'Divide by $\\omega$: $M = A/(i\\omega)$.' }] }),
          ],
          hints: [
            'For harmonic motion, velocity = displacement × $i\\omega$ and acceleration = displacement × $-\\omega^2$ (LC2-7).',
            '$|H| = |A|/\\omega^2$, $|M| = |A|/\\omega$, with $\\omega = 2\\pi f$ in rad/s.',
            `$\\omega = 2\\pi \\times ${f} = ${f4(w)}$ rad/s; $\\omega^2 = ${t4(w * w)}$.`,
            `$|H| = ${Aval}/${d4(w * w)} = ${t4(Aval / (w * w))}$ m/N = **${f4(Hum)} µm/N**; $|M| = ${Aval}/${f4(w)} = $ **${f4(Mmm)} mm/s/N**.`,
          ],
        };
      }
      const k = nice(10 ** rng.uniform(4, 7), 2);
      const fn = nice(rng.uniform(5, 300), 3);
      const zeta = nice(rng.uniform(0.01, 0.06), 2);
      const wn = TAU * fn;
      const m = k / (wn * wn);
      const Hn = 1 / (2 * zeta * k);
      if (tier === 2) {
        return {
          prompt: `An SDOF mode has stiffness ${fmt(k, 2)} N/m, natural frequency ${fn} Hz and damping ratio ${zeta}.`,
          givens: [
            { sym: 'k', value: `${fmt(k, 2)} N/m` },
            { sym: 'f_n', value: `${fn} Hz` },
            { sym: '\\zeta', value: `${zeta}` },
          ],
          parts: [
            num({ id: 'H', label: 'Receptance magnitude at resonance $|H(\\omega_n)|$', answer: Hn * 1e6, unit: 'µm/N', traps: [{ value: 1e6 / k, message: 'That is $H(0) = 1/k$. At resonance it is amplified by $Q = 1/(2\\zeta)$.' }, { value: 1e6 / (zeta * k), message: '$|H(\\omega_n)| = 1/(2\\zeta k)$: the 2 is missing.', trapId: 'factor2' }] }),
            num({ id: 'A', label: 'Accelerance magnitude at resonance $|A(\\omega_n)|$', answer: Hn * wn * wn, unit: 'm/s²/N', traps: [{ value: Hn * fn * fn, message: 'Use $\\omega_n$ in rad/s.', trapId: 'units' }, { value: Hn * wn, message: 'That is $\\omega_n|H|$, the **mobility**. Accelerance needs $\\omega_n^2$: $|A| = \\omega_n^2|H|$.', trapId: 'c2-form' }] }),
            {
              kind: 'choice',
              id: 'ph',
              label: 'Phases at resonance of receptance, mobility and accelerance?',
              options: [
                { text: '−90°, 0°, +90°', correct: true, why: 'Each $i\\omega$ adds +90°: $H(\\omega_n) = 1/(i\\omega_n c)$ is −90°.' },
                { text: '+90°, 0°, −90°', correct: false, why: 'Reversed: receptance lags the force by 90° at resonance.' },
                { text: '−90° for all three', correct: false, why: 'Mobility and accelerance add 90° and 180°.' },
                { text: '0°, 90°, 180°', correct: false, why: 'Those are the low-frequency phases.' },
              ],
            },
          ],
          hints: [
            'At resonance only the damper resists: $H(\\omega_n) = 1/(i\\omega_n c)$, so $|H| = 1/(2\\zeta k)$ with phase −90°. Multiply by $i\\omega$ for mobility, by $-\\omega^2$ for accelerance.',
            `$|H(\\omega_n)| = 1/(2\\zeta k)$; $|A(\\omega_n)| = \\omega_n^2|H(\\omega_n)| = 1/(2\\zeta m)$.`,
            `$\\omega_n = ${f4(wn)}$ rad/s; $2\\zeta k = ${t4(2 * zeta * k)}$ N/m.`,
            `$|H| = $ **${f4(Hn * 1e6)} µm/N**; $|A| = ${t4(wn * wn)} \\times ${t4(Hn)} = $ **${f4(Hn * wn * wn)} m/s²/N**; phases −90°, 0°, +90°.`,
          ],
        };
      }
      const Apk = 1 / (2 * zeta * m); // |A(ωn)|
      const Ash = nice(Apk, 4);
      const mEst = 1 / (2 * zeta * Ash);
      const kEst = mEst * wn * wn;
      return {
        prompt: `An accelerometer test of one isolated mode shows an accelerance peak of ${Ash} m/s²/N at ${fn} Hz; the half-power method gives $\\zeta$ = ${zeta}. Far above the resonance the accelerance levels off.`,
        givens: [
          { sym: '|A(\\omega_n)|', value: `${Ash} m/s²/N` },
          { sym: 'f_n', value: `${fn} Hz` },
          { sym: '\\zeta', value: `${zeta}` },
        ],
        parts: [
          num({ id: 'm', label: 'Modal mass $m$', answer: mEst, unit: 'kg', traps: [{ value: 1 / Ash, message: 'At resonance $|A| = 1/(2\\zeta m)$, so $m = 1/(2\\zeta|A|)$.' }, { value: 1 / (zeta * Ash), message: 'Keep the 2: $m = 1/(2\\zeta|A|)$.', trapId: 'factor2' }] }),
          num({ id: 'k', label: 'Modal stiffness $k = m\\omega_n^2$', answer: kEst, unit: 'N/m', traps: [{ value: mEst * fn * fn, message: 'Use $\\omega_n$ in rad/s.', trapId: 'units' }] }),
          num({ id: 'Ainf', label: 'High-frequency level of $|A|$ (the mass line)', answer: 1 / mEst, unit: 'm/s²/N', traps: [{ value: Ash, message: 'That is the peak; well above resonance $A \\to 1/m$.' }] }),
        ],
        hints: [
          'Accelerance $A = -\\omega^2/(k - m\\omega^2 + i\\omega c)$: at $\\omega_n$ it equals $i\\omega_n/c$, so $|A(\\omega_n)| = 1/(2\\zeta m)$; far above resonance $A \\to 1/m$ (mass-controlled).',
          '$m = 1/(2\\zeta|A(\\omega_n)|)$; $k = m\\omega_n^2$; mass line $= 1/m$.',
          `$2\\zeta|A| = 2 \\times ${zeta} \\times ${Ash} = ${f4(2 * zeta * Ash)}$; $\\omega_n = ${f4(wn)}$ rad/s.`,
          `$m = $ **${f4(mEst)} kg**; $k = ${f4(mEst)} \\times ${f4(wn)}^2 = $ **${fmt(kEst, 4)} N/m**; mass line $1/m = $ **${f4(1 / mEst)} m/s²/N**.`,
        ],
      };
    },
  },

  // ------------------------------------------------------------------ sensor and shaker layout
  {
    id: 'c2-coherence-sensors',
    title: 'Which sensors see which modes? (layout and coherence)',
    summary: 'Pinned–pinned beam: mode-shape values at sensors, modes missed by a shaker at a node, sensors with no coherence.',
    tiers: [1, 2, 3],
    source: 'Similar to 2024 A3.5; summary notes C2 (a point at a node sees only noise)',
    cardId: 'c2-modes',
    generate(rng, tier) {
      const isNode = (n: number, x: number) => shape(n, x) === 0;
      const MODES = [1, 2, 3, 4];
      if (tier === 1) {
        const n = rng.int(1, 4);
        const x = rng.pick([0.1, 0.2, 0.25, 0.3, 0.4, 0.5, 0.6, 0.7, 0.75, 0.8]);
        const xs = rng.pick([0.25, 0.5, 1 / 3, 0.2, 0.4]);
        const v = shape(n, x);
        const node = isNode(n, xs);
        return {
          prompt: `A pinned–pinned beam has mode shapes $\\phi_n(x) = \\sin(n\\pi x/L)$. A sensor sits at $x$ = ${posTxt(x)} and a shaker at $x$ = ${posTxt(xs)}.`,
          parts: [
            num({
              id: 'phi',
              label: `Mode-shape value $\\phi_${n}$ at the sensor`,
              answer: v,
              unit: '',
              absTol: 0.005,
              traps: [
                { value: Math.cos(n * Math.PI * x), message: 'Pinned–pinned shapes are sines: $\\sin(n\\pi x/L)$.' },
                { value: Math.sin(n * x), message: `Include π: $\\sin(n\\pi x/L)$ with $x/L$ = ${x}.` },
              ],
            }),
            {
              kind: 'choice',
              id: 'node',
              label: `Does the shaker excite mode ${n}?`,
              options: [
                { text: 'Yes', correct: !node, why: node ? `$\\sin(${n}\\pi \\cdot ${fracTxt(xs)}) = 0$: the shaker sits on a node.` : `$\\phi_${n}$ = ${f3(shape(n, xs))} there, not zero.` },
                { text: 'No: the shaker is at a node of this mode', correct: node, why: node ? 'A force at a node does no work on that mode.' : 'It is not at a node of this mode.' },
              ],
            },
          ],
          hints: [
            'A force at a point excites mode $n$ in proportion to $\\phi_n$ there; a sensor sees mode $n$ in proportion to $\\phi_n$ at the sensor.',
            `$\\phi_${n}(x) = \\sin(${n}\\pi x/L)$; a node is where it is zero.`,
            `Sensor: $\\sin(${n}\\pi \\times ${x}) = \\sin(${f4(n * Math.PI * x)}\\ \\text{rad})$; shaker: $\\sin(${n}\\pi \\times ${fracTxt(xs)})$.`,
            `$\\phi_${n}$ = **${f3(v)}** at the sensor; at the shaker $\\phi_${n}$ = ${f3(shape(n, xs))}, so mode ${n} is **${node ? 'not excited' : 'excited'}**.`,
          ],
        };
      }
      if (tier === 2) {
        const sensorSets = [
          [0, 0.25, 0.5, 0.75, 1],
          [0, 0.2, 0.4, 0.6, 1],
          [0, 1 / 3, 0.5, 2 / 3, 1],
        ];
        const sens = rng.pick(sensorSets);
        const xs = rng.pick([0.5, 0.25, 1 / 3]);
        const labels = sens.map((_, i) => `A${i + 1}`);
        const excited = MODES.map((n) => !isNode(n, xs));
        const dead = sens.map((x) => MODES.every((n) => isNode(n, x)));
        return {
          prompt: `Accelerometers ${labels.join(', ')} sit at $x$ = ${sens.map(posTxt).join(', ')} on a pinned–pinned beam; a shaker at $x$ = ${posTxt(xs)} drives a sine sweep through the first four modes ($\\phi_n = \\sin(n\\pi x/L)$).`,
          figure: beamLayoutFigure({ sensors: sens, shaker: xs, labels }),
          parts: [
            {
              kind: 'choice',
              id: 'dead',
              label: 'Which sensors give very low coherence at **all** frequencies? (Select all that apply.)',
              multi: true,
              options: sens.map((x, i) => {
                const moves = MODES.filter((n) => !isNode(n, x));
                const seen = moves.filter((n) => excited[n - 1]);
                return {
                  text: `${labels[i]} (x = ${posTxt(x)})`,
                  correct: dead[i],
                  why: dead[i]
                    ? 'On a support: a node of every mode, so it records only noise.'
                    : `It moves in mode${moves.length > 1 ? 's' : ''} ${moves.join(', ')}${seen.length < moves.length ? `; the shaker excites only mode${seen.length > 1 ? 's' : ''} ${seen.join(', ')} of these` : ''}, so its signal correlates with the force near ${seen.length > 1 ? 'those resonances' : 'that resonance'}.`,
                };
              }),
            },
            {
              kind: 'choice',
              id: 'modes',
              label: 'Which of modes 1–4 does the shaker excite? (Select all that apply.)',
              multi: true,
              options: MODES.map((n) => ({
                text: `Mode ${n}`,
                correct: excited[n - 1],
                why: excited[n - 1] ? `$\\phi_${n}$ = ${f3(shape(n, xs))} ≠ 0 at the shaker.` : `$\\sin(${n}\\pi \\cdot ${fracTxt(xs)}) = 0$: the shaker is at a node.`,
              })),
            },
          ],
          hints: [
            'A sensor at a node of a mode does not see that mode; a sensor at a node of **every** mode (a support) sees only noise. A shaker at a node of a mode does not excite it.',
            '$\\phi_n(x) = \\sin(n\\pi x/L)$: evaluate it at each sensor and at the shaker for $n$ = 1–4.',
            `At the shaker: ${MODES.map((n) => `$\\phi_${n}$ = ${f3(shape(n, xs))}`).join(', ')}.`,
            `Dead sensors: **${labels.filter((_, i) => dead[i]).join(', ') || 'none'}**; excited modes: **${MODES.filter((n) => excited[n - 1]).join(', ')}**. Fix: move the shaker off the nodes (e.g. 0.15L) and the end sensors inboard.`,
          ],
        };
      }
      // Tier 3: exactly one candidate position drives all four modes with |phi| > 0.3.
      const target = rng.pick([0.15, 0.4]);
      const bad = rng.shuffle([0.5, 0.25, 1 / 3]);
      const opts = rng.shuffle([target, ...bad]);
      const weakest = Math.min(...MODES.map((n) => Math.abs(shape(n, target))));
      const strongest = Math.max(...MODES.map((n) => Math.abs(shape(n, target))));
      return {
        prompt: 'A pinned–pinned beam is to be tested with one shaker so that modes 1–4 are all excited reasonably strongly ($|\\phi_n| > 0.3$ at the shaker; $\\phi_n = \\sin(n\\pi x/L)$).',
        parts: [
          {
            kind: 'choice',
            id: 'pos',
            label: 'Where should the shaker go?',
            options: opts.map((x) => {
              const vals = MODES.map((n) => shape(n, x));
              const ok = vals.every((v) => Math.abs(v) > 0.3);
              return { text: `x = ${posTxt(x)}`, correct: ok, why: `$\\phi_1 \\ldots \\phi_4$ = ${vals.map((v) => f3(v)).join(', ')}${ok ? ': all well away from zero.' : ': at least one is a node.'}` };
            }),
          },
          num({ id: 'weak', label: 'At the position you chose, the smallest $|\\phi_n|$ for $n$ = 1–4', answer: weakest, unit: '', tol: 0.02, traps: [{ value: strongest, message: 'That is the largest; the question asks for the weakest-driven mode.' }] }),
        ],
        hints: [
          'The modal force on mode $n$ is $F\\phi_n(x_s)$. Avoid nodes of every mode you need: mid-span kills even modes, quarter points kill mode 4, L/3 kills mode 3.',
          'Evaluate $\\sin(n\\pi x/L)$ for $n$ = 1–4 at each candidate and check all four are clearly non-zero.',
          `At ${posTxt(target)}: ${MODES.map((n) => `$\\phi_${n}$ = ${f3(shape(n, target))}`).join(', ')}.`,
          `Choose **x = ${posTxt(target)}**; its weakest mode has $|\\phi|$ = **${f3(weakest)}**.`,
        ],
      };
    },
  },

  // ------------------------------------------------------------------ log decrement
  {
    id: 'c2-logdec',
    title: 'Damping from a free decay (log decrement)',
    summary: 'The time-domain alternative to half-power: δ = ln(X₀/X_m)/m, then link ζ back to the FRF bandwidth.',
    tiers: [1, 2, 3],
    source: 'Reader LC2-6, Eq 2.9 (template; not examined 2016–2025 but part of the reader method set)',
    cardId: 'c2-damping',
    generate(rng, tier) {
      const zeta = nice(rng.uniform(0.005, 0.08), 2);
      const fn = nice(rng.uniform(2, 60), 2);
      const mCyc = rng.pick([3, 4, 5, 6, 8, 10]);
      const X0 = rng.pick([2, 4, 5, 8, 10, 12, 20]);
      const delta = (TAU * zeta) / Math.sqrt(1 - zeta * zeta);
      const Xm = nice(X0 * Math.exp(-mCyc * delta), 3);
      const d = zetaFromDecay(X0, Xm, mCyc);
      const slip = logdecSlips(X0, Xm, mCyc);
      /** The ζ part, the same at every tier: the named cycle-count slips first, then the formula slips. */
      const zetaPart = () =>
        withSlips(
          num({
            id: 'z',
            label: 'Damping ratio $\\zeta$',
            answer: d.zeta,
            unit: '',
            traps: [
              { value: d.delta, message: 'That is $\\delta$. Use $\\zeta = \\delta/\\sqrt{4\\pi^2 + \\delta^2}$.' },
              { value: d.delta / Math.PI, message: '$\\zeta \\approx \\delta/(2\\pi)$, not $\\delta/\\pi$.', trapId: 'factor2' },
              { value: zetaOfDelta(Math.log10(X0 / Xm) / mCyc), message: 'Use the natural log, not log₁₀.' },
            ],
          }),
          slip.zeta
        );
      /** For later parts: a student who skipped the division by m carries the undivided ζ forward. */
      const carryMsg = `That carries forward the $\\zeta$ from the undivided $\\ln(X_0/X_m)$. Divide by the ${mCyc} cycles first.`;
      if (tier === 1) {
        return {
          prompt: `After a hammer hit, a structure rings in one mode. A peak of ${X0} mm is followed, ${mCyc} cycles later, by a peak of ${Xm} mm.`,
          givens: [
            { sym: 'X_0', value: `${X0} mm` },
            { sym: `X_{${mCyc}}`, value: `${Xm} mm` },
            { sym: 'm', value: `${mCyc} cycles` },
          ],
          parts: [
            num({ id: 'delta', label: 'Logarithmic decrement $\\delta$', answer: d.delta, unit: '', traps: [...slip.delta, { value: Math.log10(X0 / Xm) / mCyc, message: 'Use the natural log, not log₁₀.' }] }),
            zetaPart(),
          ],
          hints: [
            'Free vibration decays as $e^{-\\zeta\\omega_n t}$: successive peaks shrink by a constant ratio each cycle (LC2-6).',
            '$\\delta = \\ln(X_0/X_m)/m$; $\\zeta = \\delta/\\sqrt{4\\pi^2+\\delta^2}$ (Eq 2.9).',
            `$\\ln(${X0}/${Xm}) = ${f4(Math.log(X0 / Xm))}$.`,
            `$\\delta = ${f4(Math.log(X0 / Xm))}/${mCyc} = $ **${f4(d.delta)}**; $\\zeta = ${f4(d.delta)}/\\sqrt{39.48 + ${f4(d.delta ** 2)}} = $ **${f4(d.zeta)}**.`,
          ],
        };
      }
      const wn = TAU * fn;
      const Td = TAU / (wn * Math.sqrt(1 - zeta * zeta));
      const TdS = nice(Td, 4);
      const fnEst = 1 / TdS / Math.sqrt(1 - d.zeta * d.zeta);
      const bw = 2 * d.zeta * fnEst;
      if (tier === 2) {
        const fnCarried = slip.zetaUndivided.map((z) => 1 / TdS / Math.sqrt(1 - z * z));
        const fnTraps: Trap[] = fnCarried.map((value) => ({ value, message: carryMsg, trapId: LOGDEC }));
        const bwTraps: Trap[] = slip.zetaUndivided.map((z, i) => ({ value: 2 * z * fnCarried[i], message: carryMsg, trapId: LOGDEC }));
        return {
          prompt: `The free decay after a hit is shown. Successive peaks are ${fmt(TdS, 4)} s apart; the marked peaks are ${X0} mm and, ${mCyc} cycles later, ${Xm} mm.`,
          figure: decayFigure({ zeta, fn, X0, cycles: mCyc, unit: 'mm', marks: [{ n: 0, label: `${X0} mm` }, { n: mCyc, label: `${Xm} mm` }] }),
          givens: [
            { sym: 'T_d', value: `${fmt(TdS, 4)} s`, label: 'period of the decaying oscillation' },
            { sym: 'X_0', value: `${X0} mm` },
            { sym: `X_{${mCyc}}`, value: `${Xm} mm` },
          ],
          parts: [
            zetaPart(),
            num({ id: 'fn', label: 'Undamped natural frequency $f_n$', answer: fnEst, unit: 'Hz', freq: true, tol: 0.02, traps: fnTraps }),
            withSlips(num({ id: 'bw', label: 'Half-power bandwidth you would expect on the FRF', answer: bw, unit: 'Hz', traps: [{ value: d.zeta * fnEst, message: 'The half-power bandwidth is $2\\zeta f_n$.', trapId: 'factor2' }] }), bwTraps),
          ],
          hints: [
            'The same damping shows in both domains: decay per cycle (log decrement) and peak width (half-power bandwidth $2\\zeta\\omega_n$).',
            '$\\delta = \\ln(X_0/X_m)/m$, $\\zeta = \\delta/\\sqrt{4\\pi^2+\\delta^2}$; $f_d = 1/T_d$, $f_n = f_d/\\sqrt{1-\\zeta^2}$; bandwidth $\\approx 2\\zeta f_n$.',
            `$\\delta = \\ln(${X0}/${Xm})/${mCyc} = ${f4(d.delta)}$; $f_d = 1/${fmt(TdS, 4)} = ${f4(1 / TdS)}$ Hz.`,
            `$\\zeta = $ **${f4(d.zeta)}**; $f_n = $ **${f4(fnEst)} Hz**; bandwidth $2\\zeta f_n = $ **${f4(bw)} Hz**.`,
          ],
        };
      }
      const pct = rng.pick([50, 25, 10, 5, 1]);
      const cyc = Math.log(100 / pct) / d.delta;
      const cycMsg = `That uses $\\ln(X_0/X_m)$ itself as $\\delta$: divide it by the ${mCyc} cycles first.`;
      return {
        prompt: `A free decay shows peaks of ${X0} mm and, ${mCyc} cycles later, ${Xm} mm (period ${fmt(TdS, 4)} s).`,
        givens: [
          { sym: 'X_0', value: `${X0} mm` },
          { sym: `X_{${mCyc}}`, value: `${Xm} mm` },
          { sym: 'T_d', value: `${fmt(TdS, 4)} s` },
        ],
        parts: [
          zetaPart(),
          num({ id: 'cyc', label: `Number of cycles for the vibration to decay to ${pct} % of a peak`, answer: cyc, unit: 'cycles', tol: 0.03, traps: [{ value: Math.log10(100 / pct) / d.delta, message: 'Use the natural log: $m = \\ln(X_0/X_m)/\\delta$.' }, { value: Math.log(100 / pct) / slip.L, message: cycMsg, trapId: LOGDEC }] }),
          num({ id: 't', label: `Time for that decay`, answer: cyc * TdS, unit: 's', tol: 0.03, traps: [{ value: (Math.log(100 / pct) / slip.L) * TdS, message: cycMsg, trapId: LOGDEC }] }),
        ],
        hints: [
          'Each cycle multiplies the amplitude by $e^{-\\delta}$, so decaying by a factor $X_0/X_m$ takes $\\ln(X_0/X_m)/\\delta$ cycles.',
          '$\\delta = \\ln(X_0/X_m)/m$; cycles to reach $p$ % $= \\ln(100/p)/\\delta$; time = cycles × $T_d$.',
          `$\\delta = ${f4(d.delta)}$; $\\ln(100/${pct}) = ${f4(Math.log(100 / pct))}$.`,
          `$\\zeta = $ **${f4(d.zeta)}**; **${f4(cyc)} cycles**, i.e. **${f4(cyc * TdS)} s**.`,
        ],
      };
    },
  },

  // ------------------------------------------------------------------ point mass and coupled receptances
  {
    id: 'c2-point-mass',
    title: 'Point-mass receptance and the wheel on the rail',
    summary: 'The mass line −1/(mω²), the dip where a mass-like and a spring-like receptance cancel (the coupled resonance), and why a loaded rail rings lower.',
    tiers: [1, 2, 3],
    source: 'Similar to 2021 A3.2 (wheel as a point mass on a measured rail) and 2021 A3.3 (hammer test vs train pass-by)',
    cardId: 'c2-frf',
    generate(rng, tier) {
      if (tier === 1) {
        const m = rng.pick([40, 60, 80, 105, 150, 200, 300, 450]);
        const f1 = rng.pick([150, 200, 250, 300, 400, 500, 600]);
        const w1 = TAU * f1;
        const a1 = nice(1e9 / (m * w1 * w1), 3); // nm/N, as read off the plot
        const mEst = 1e9 / (a1 * w1 * w1);
        const f2 = f1 * rng.pick([2, 3, 0.5]);
        const a2 = a1 * (f1 / f2) ** 2;
        return {
          prompt: `A wheel is modelled as a rigid point mass. Its receptance magnitude is ${a1} nm/N (${fmt(a1 / 10, 3)} × 10⁻⁸ m/N) at ${f1} Hz.`,
          givens: [{ sym: '|\\alpha_w|', value: `${a1} nm/N`, label: `wheel receptance at ${f1} Hz` }],
          parts: [
            num({
              id: 'm',
              label: 'Mass of the wheel',
              answer: mEst,
              unit: 'kg',
              traps: [
                { value: 1e9 / (a1 * f1 * f1), message: 'Use ω in rad/s: $|\\alpha| = 1/(m\\omega^2)$ with $\\omega = 2\\pi f$.', trapId: 'units' },
                { value: 1e9 / (a1 * w1), message: 'Square ω: a mass has $|\\alpha| = 1/(m\\omega^2)$.', trapId: 'sqrt' },
              ],
            }),
            num({
              id: 'a2',
              label: `Its receptance magnitude at ${f2} Hz`,
              answer: a2,
              unit: 'nm/N',
              traps: [
                { value: a1 * (f1 / f2), message: 'A mass line falls as $1/\\omega^2$, not $1/\\omega$.', trapId: 'sqrt' },
                { value: a1 * (f2 / f1) ** 2, message: 'Inverted: a mass is harder to shake at higher frequency, so its receptance falls.' },
              ],
            }),
            {
              kind: 'choice',
              id: 'ph',
              label: 'Phase of the wheel’s displacement relative to the force?',
              options: [
                { text: '180° at every frequency: it moves against the force', correct: true, why: '$\\alpha = -1/(m\\omega^2)$ is real and negative: mass-controlled, like any SDOF system far above its resonance.' },
                { text: '0°: in phase with the force', correct: false, why: 'That is a spring, $\\alpha = 1/k$ (stiffness-controlled).' },
                { text: '−90°', correct: false, why: 'That is a damper, or an SDOF system exactly at resonance.' },
              ],
            },
          ],
          hints: [
            'A free rigid mass obeys $F = m\\ddot x = -m\\omega^2 X$, so its receptance is $\\alpha = X/F = -1/(m\\omega^2)$: the “mass line”, falling as $1/\\omega^2$ and always 180° out of phase.',
            '$m = 1/(|\\alpha|\\omega^2)$ with $\\omega = 2\\pi f$ and $|\\alpha|$ in m/N; at another frequency $|\\alpha_2| = |\\alpha_1|(f_1/f_2)^2$.',
            `$\\omega = 2\\pi \\times ${f1} = ${f4(w1)}$ rad/s; $|\\alpha| = ${a1}$ nm/N $= ${t4(a1 * 1e-9)}$ m/N.`,
            `$m = 1/(${t4(a1 * 1e-9)} \\times ${f4(w1)}^2) = $ **${f4(mEst)} kg**; at ${f2} Hz: $${a1} \\times (${f1}/${f2})^2 = $ **${f4(a2)} nm/N**; phase **180°**.`,
          ],
        };
      }
      if (tier === 2) {
        const m = rng.pick([80, 100, 105, 120, 150, 200]);
        const Ar = nice(rng.uniform(4, 12), 2); // rail receptance plateau, nm/N
        const kEq = 1e9 / Ar; // N/m
        const wc = Math.sqrt(kEq / m);
        const fc = wc / TAU;
        const S = nice(rng.uniform(0.2, 0.45) * Ar, 2); // |sum| at the crossing, nm/N
        const dev = (2 * Math.asin(S / (2 * Ar)) * 180) / Math.PI;
        return {
          prompt: `A wheel, modelled as a rigid point mass of ${m} kg, rolls on a rail. Below its own first resonance the rail behaves like a spring: its measured receptance is roughly flat at ${Ar} nm/N (${fmt(Ar / 10, 3)} × 10⁻⁸ m/N) with a phase close to 0°. The wheel and rail receptances are added (relative displacement per unit contact force), as in the plot.`,
          figure: couplingFigure({ m, Ar, delta: (dev * Math.PI) / 180, fMax: Math.max(400, Math.ceil((2.6 * fc) / 100) * 100), fc }),
          givens: [
            { sym: 'm_w', value: `${m} kg`, label: 'wheel (point mass)' },
            { sym: '|\\alpha_r|', value: `${Ar} nm/N`, label: 'rail, below its resonance' },
          ],
          parts: [
            num({
              id: 'k',
              label: 'Equivalent stiffness of the rail, $k_r = 1/|\\alpha_r|$',
              answer: kEq / 1e6,
              unit: 'MN/m',
              traps: [{ value: 1e-6 / Ar, message: 'Convert nm/N to m/N (× 10⁻⁹) before inverting.', trapId: 'unit-scale' }],
            }),
            num({
              id: 'fc',
              label: 'Frequency at which the wheel’s and the rail’s receptance magnitudes are equal',
              answer: fc,
              unit: 'Hz',
              freq: true,
              traps: [{ value: kEq / m / TAU, message: 'Take the square root: $1/(m\\omega^2) = 1/k_r$ gives $\\omega = \\sqrt{k_r/m}$.', trapId: 'sqrt' }],
            }),
            {
              kind: 'choice',
              id: 'dip',
              label: 'What does the magnitude of the summed receptance do at that frequency, and why?',
              options: [
                { text: 'It dips towards zero: equal magnitudes with opposite phases (mass-like 180°, spring-like 0°) cancel. This is the coupled wheel-on-rail resonance; damping keeps the dip finite.', correct: true, why: 'Where $\\alpha_w + \\alpha_r = 0$ the contact force needed for a given relative displacement vanishes: the wheel bouncing on the rail stiffness resonates at $\\sqrt{k_r/m}$ (2021 A3.2 worked solution).' },
                { text: 'It peaks: the two equal magnitudes add.', correct: false, why: 'Magnitudes add only when the phases are equal. Here they are nearly opposite.' },
                { text: 'Nothing special happens: receptances of two bodies cannot be added.', correct: false, why: 'The contact force acts on both, so the relative displacement per unit contact force is $\\alpha_w + \\alpha_r$ (compliances in series). It vanishes at the coupled natural frequency.' },
              ],
            },
            num({
              id: 'dev',
              label: `The measured sum there is only ${S} nm/N. How far from exact opposition (180°) are the two phases?`,
              answer: dev,
              unit: '°',
              traps: [{ value: dev / 2, message: 'Two vectors of length $A$ that are $180° - \\delta$ apart sum to $2A\\sin(\\delta/2)$: solve for the whole of $\\delta$.', trapId: 'factor2' }],
            }),
          ],
          hints: [
            'The wheel is a mass ($\\alpha_w = -1/(m\\omega^2)$, phase 180°); below its resonance the rail is a spring ($\\alpha_r \\approx 1/k_r$, phase near 0°). Their sum vanishes where they are equal in size and opposite in phase: the coupled resonance.',
            '$k_r = 1/|\\alpha_r|$; $1/(m\\omega^2) = 1/k_r \\Rightarrow \\omega = \\sqrt{k_r/m}$; two vectors of length $A$ that are $180° - \\delta$ apart sum to $2A\\sin(\\delta/2)$.',
            `$k_r = 1/(${Ar} \\times 10^{-9}) = ${t4(kEq)}$ N/m; $\\omega = \\sqrt{${t4(kEq)}/${m}} = ${f4(wc)}$ rad/s; $\\sin(\\delta/2) = ${S}/(2 \\times ${Ar}) = ${f4(S / (2 * Ar))}$.`,
            `$k_r = $ **${f4(kEq / 1e6)} MN/m**; $f = ${f4(wc)}/2\\pi = $ **${f4(fc)} Hz**, where the sum **dips** (equal magnitudes, opposite phases: the coupled resonance); $\\delta = 2\\sin^{-1}(${f4(S / (2 * Ar))}) = $ **${f3(dev)}°**.`,
          ],
        };
      }
      // Tier 3: 2021 A3.3. Hammer test on the unloaded rail vs response under a passing train.
      const fOld = rng.pick([120, 142, 160, 180, 200, 250]);
      const ratio = nice(rng.uniform(1.6, 3), 2);
      const fNew = nice(fOld / Math.sqrt(ratio), 3);
      const mr = rng.pick([40, 50, 60, 80, 100]);
      const fs = rng.pick([10000, 20000, 25600]);
      const r = (fOld / fNew) ** 2;
      const dm = mr * (r - 1);
      return {
        prompt: `A hammer test on an unloaded rail (force and acceleration recorded at ${fs / 1000} kHz) shows its lowest mode at ${fOld} Hz. Under a passing train only the rail response is recorded, and its spectrum peaks at ${fNew} Hz instead. Treat the mode as an SDOF system whose stiffness does not change; the rail’s effective modal mass for this mode is ${mr} kg.`,
        givens: [
          { sym: 'f_{hammer}', value: `${fOld} Hz`, label: 'unloaded rail' },
          { sym: 'f_{train}', value: `${fNew} Hz`, label: 'under the train' },
          { sym: 'm_r', value: `${mr} kg`, label: 'effective modal mass of the rail' },
          { sym: 'f_s', value: `${fs / 1000} kHz`, label: 'sampling rate' },
        ],
        parts: [
          num({ id: 'r', label: 'How many times larger is the effective mass under the train?', answer: r, unit: '×', traps: [{ value: fOld / fNew, message: '$f \\propto 1/\\sqrt{m}$: the mass ratio is the frequency ratio **squared**.', trapId: 'sqrt' }] }),
          num({
            id: 'dm',
            label: 'Effective mass added by the wheelset',
            answer: dm,
            unit: 'kg',
            traps: [
              { value: mr * r, message: 'That is the total effective mass; subtract the rail’s own modal mass.' },
              { value: mr * (fOld / fNew - 1), message: 'Square the frequency ratio before subtracting 1.', trapId: 'sqrt' },
            ],
          }),
          {
            kind: 'choice',
            id: 'alias',
            label: 'Could the lower peak under the train be an aliasing artefact?',
            options: [
              { text: `No: the Nyquist frequency is ${fs / 2000} kHz, far above both peaks, so nothing folds down to ${fNew} Hz.`, correct: true, why: 'Aliasing folds content from above $f_s/2$; both modes are far below it. The shift is physical: the wheelset mass rides on, and moves with, the rail.' },
              { text: 'Yes: a moving load always aliases the spectrum.', correct: false, why: 'Aliasing depends on the sampling rate, not on the load.' },
              { text: 'Yes, because the train test has no force signal.', correct: false, why: 'A missing force signal stops you forming an FRF; it does not fold frequencies.' },
            ],
          },
          {
            kind: 'choice',
            id: 'noise',
            label: 'In which test can the measurement noise be quantified?',
            options: [
              { text: 'Only the hammer test: force and response are both measured, so H₁, H₂ and the coherence can be formed.', correct: true, why: 'The pass-by gives only a response spectrum (in m, not m/N): with no measured input there is nothing to correlate the response with.' },
              { text: 'Only the train test, because it has more energy.', correct: false, why: 'Noise is judged from the coherence between a measured input and the output, which the train test lacks.' },
              { text: 'Both, by averaging the response spectra.', correct: false, why: 'Averaging a response alone smooths it but cannot separate the noise from the response to the (unknown) input.' },
            ],
          },
        ],
        hints: [
          '$f = \\frac{1}{2\\pi}\\sqrt{k/m}$: with the same stiffness, a lower frequency means more mass. Under the train the wheelset rests on the rail and moves with it, so the coupled wheel/track mode is lower.',
          '$m_{train}/m_r = (f_{hammer}/f_{train})^2$; $\\Delta m = m_r[(f_{hammer}/f_{train})^2 - 1]$; Nyquist $= f_s/2$; noise needs a measured input (coherence).',
          `$(${fOld}/${fNew})^2 = ${f4(r)}$; $\\Delta m = ${mr} \\times (${f4(r)} - 1)$; Nyquist $= ${fs / 2000}$ kHz.`,
          `Effective mass **${f3(r)}×** larger; $\\Delta m = $ **${f4(dm)} kg**; not aliasing (Nyquist ${fs / 2000} kHz); noise can be quantified **only in the hammer test**.`,
        ],
      };
    },
  },
];
