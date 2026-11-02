// C1 problem generators. Numbers are randomised within the ranges the papers and quizzes use; the hints walk
// concept -> set-up -> substitution -> worked solution with this instance's numbers.
import type { NumericPart, SolveGenerator, SolvePart } from '../../engine/types';
import { fmt, tex } from '../../engine/format';
import { accelerometerRatio, hammerContactDuration, seismicPhase, seismicRatio, usableBand } from '../../physics/transducers';
import { CANTILEVER_RATIOS, G, HALF_SINE_10DB, HALF_SINE_20DB, PINNED_RATIOS, TAU, coherenceFromSnrDb, dampedBandEdge } from './physics';
import { spectrumFigure } from './figures';

const f3 = (x: number) => fmt(x, 3);
const f4 = (x: number) => fmt(x, 4);
/** Numbers inside TeX: tex() writes 1.2 \times 10^{5} instead of Unicode superscripts. */
const t4 = (x: number) => tex(x, 4);
const t3 = (x: number) => tex(x, 3);
/** A TeX number used as a divisor: bracketed when it is written as a × 10ⁿ, so 1/(3 × 10⁷) cannot read as (1/3) × 10⁷. */
const d3 = (x: number) => {
  const s = tex(x, 3);
  return s.includes('\\times') ? `(${s})` : s;
};
const d4 = (x: number) => {
  const s = tex(x, 4);
  return s.includes('\\times') ? `(${s})` : s;
};
type Trap = NonNullable<NumericPart['traps']>[number];

/** Keep finite traps that sit clearly outside the answer's tolerance (and are not duplicates of each other). */
export function cleanTraps(answer: number, list: Trap[], tol = 0.02): Trap[] {
  const gap = tol + 0.01;
  const out: Trap[] = [];
  for (const t of list) {
    if (!Number.isFinite(t.value)) continue;
    if (Math.abs(t.value - answer) <= gap * Math.abs(answer)) continue;
    if (out.some((o) => Math.abs(o.value - t.value) <= 0.02 * Math.abs(t.value))) continue;
    out.push(t);
  }
  return out;
}

/** A numeric part whose traps are filtered by cleanTraps. */
function num(p: Omit<NumericPart, 'kind'>): NumericPart {
  return { kind: 'numeric', ...p, traps: p.traps ? cleanTraps(p.answer, p.traps, p.tol ?? 0.02) : undefined };
}

const TIP_TABLE = [
  { name: 'rubber', T: 3.0 },
  { name: 'hard plastic', T: 0.8 },
  { name: 'aluminium', T: 0.35 },
  { name: 'steel', T: 0.15 },
];

export const generators: SolveGenerator[] = [
  // ------------------------------------------------------------------ accelerometer band
  {
    id: 'c1-accel-band',
    title: 'Accelerometer: amplitude error and usable band',
    summary: 'Reading error at a given frequency ratio, the natural frequency needed for a target band, and what damping near 0.7 buys.',
    tiers: [1, 2, 3],
    source: 'Similar to 2025 A3.1 (WS: 1 % at β = 0.1, 4.2 % at β = 0.2); LC1-6',
    cardId: 'c1-accel-design',
    generate(rng, tier) {
      if (tier === 1) {
        const fnk = rng.pick([10, 12, 15, 20, 25, 30, 40, 50]);
        const b0 = rng.pick([0.08, 0.1, 0.12, 0.15, 0.2, 0.25, 0.3, 0.4]);
        const fk = rng.nice(b0 * fnk, 2);
        const beta = fk / fnk;
        const err = (1 / (1 - beta * beta) - 1) * 100;
        return {
          prompt: `A piezoelectric accelerometer with negligible damping has a mounted natural frequency of ${fnk} kHz. It measures a vibration at ${fk} kHz.`,
          givens: [
            { sym: 'f_n', value: `${fnk} kHz`, label: 'accelerometer natural frequency' },
            { sym: 'f', value: `${fk} kHz`, label: 'measured frequency' },
            { sym: '\\zeta', value: '≈ 0' },
          ],
          parts: [
            num({ id: 'beta', label: 'Frequency ratio $\\beta = f/f_n$', answer: beta, unit: '', traps: [{ value: fnk / fk, message: 'Inverted: $\\beta$ is the measured frequency over the instrument’s natural frequency.' }] }),
            num({
              id: 'err',
              label: 'Amplitude error of the reading',
              answer: err,
              unit: '%',
              tol: 0.02,
              traps: [
                { value: beta * 100, message: 'You used $\\beta$. The undamped error is $1/(1-\\beta^2) - 1$, which grows as $\\beta^2$.', trapId: 'sqrt' },
                { value: beta * beta * 100, message: '$\\beta^2$ is only the small-$\\beta$ approximation. Use the exact $1/(1-\\beta^2) - 1$.' },
                { value: (1 / (1 - beta) - 1) * 100, message: 'Square $\\beta$ inside the bracket: $1/(1-\\beta^2)$.', trapId: 'sqrt' },
              ],
            }),
          ],
          hints: [
            'Below resonance the accelerometer reads $z_0\\omega_n^2 = |\\ddot y|/\\sqrt{(1-\\beta^2)^2+(2\\zeta\\beta)^2}$. With $\\zeta \\approx 0$ the factor is $1/(1-\\beta^2) > 1$: it reads high.',
            '$\\beta = f/f_n$ (same units), then error $= 1/(1-\\beta^2) - 1$.',
            `$\\beta = ${fk}/${fnk} = ${f4(beta)}$, $\\beta^2 = ${f4(beta * beta)}$.`,
            `$\\beta = $ **${f4(beta)}**; $1/(1 - ${f4(beta * beta)}) = ${f4(1 / (1 - beta * beta))}$, so the reading is **${f3(err)} %** high.`,
          ],
        };
      }
      if (tier === 2) {
        const fmax = rng.pick([0.5, 1, 1.5, 2, 3, 5, 8]); // kHz
        const epsPct = rng.pick([1, 2, 3, 5, 10]);
        const eps = epsPct / 100;
        const bmax = Math.sqrt(1 - 1 / (1 + eps));
        const fnMin = fmax / bmax; // kHz
        const wn = TAU * fnMin * 1000;
        const aG = rng.pick([1, 2, 5, 10, 20, 50]);
        const z0nm = ((aG * G) / (wn * wn)) * 1e9;
        return {
          prompt: `You need to measure accelerations up to ${fmax} kHz with an amplitude error of at most ${epsPct} %, using an accelerometer with negligible damping.`,
          givens: [
            { sym: 'f_{max}', value: `${fmax} kHz`, label: 'highest frequency to measure' },
            { sym: '\\varepsilon', value: `${epsPct} %`, label: 'allowed amplitude error' },
            { sym: '|\\ddot y|', value: `${aG} g`, label: 'acceleration amplitude for the last part' },
          ],
          parts: [
            num({
              id: 'bmax',
              label: 'Largest usable frequency ratio $\\beta_{max}$',
              answer: bmax,
              unit: '',
              traps: [
                { value: Math.sqrt(eps), message: '$\\sqrt\\varepsilon$ is only approximate. Solve $1/(1-\\beta^2) = 1+\\varepsilon$ exactly.' },
                { value: eps, message: 'The error depends on $\\beta^2$: solve $1/(1-\\beta^2) = 1 + \\varepsilon$.', trapId: 'sqrt' },
              ],
            }),
            num({
              id: 'fn',
              label: 'Minimum natural frequency of the accelerometer $f_n$',
              answer: fnMin,
              unit: 'kHz',
              traps: [
                { value: fmax * bmax, message: 'Inverted: $f_n = f_{max}/\\beta_{max}$, so it must be well **above** $f_{max}$.', trapId: 'c1-regime' },
                { value: fmax / eps, message: 'Use $\\beta_{max}$, not $\\varepsilon$, as the frequency ratio.' },
              ],
            }),
            num({
              id: 'z0',
              label: `Relative deflection of the seismic mass at that $f_n$ for an acceleration of ${aG} g`,
              answer: z0nm,
              unit: 'nm',
              traps: [
                { value: ((aG * G) / (fnMin * 1000) ** 2) * 1e9, message: 'Use $\\omega_n$ in rad/s: $z_0 = |\\ddot y|/\\omega_n^2$ with $\\omega_n = 2\\pi f_n$.', trapId: 'units' },
                { value: (aG / wn ** 2) * 1e9, message: 'Convert g to m/s² (× 9.81) first.' },
              ],
            }),
          ],
          hints: [
            'Accelerometer regime: the undamped reading is high by $1/(1-\\beta^2) - 1$. The band ends where that equals $\\varepsilon$. The deflection per unit acceleration is $1/\\omega_n^2$.',
            '$1/(1-\\beta_{max}^2) = 1+\\varepsilon \\Rightarrow \\beta_{max} = \\sqrt{1 - 1/(1+\\varepsilon)}$; $f_n \\ge f_{max}/\\beta_{max}$; $z_0 = |\\ddot y|/\\omega_n^2$.',
            `$\\beta_{max} = \\sqrt{1 - 1/${f4(1 + eps)}} = ${f4(bmax)}$; $\\omega_n = 2\\pi f_n$; $|\\ddot y| = ${aG} \\times 9.81 = ${f4(aG * G)}$ m/s².`,
            `$\\beta_{max} = $ **${f4(bmax)}**; $f_n \\ge ${fmax}/${f4(bmax)} = $ **${f4(fnMin)} kHz**; $\\omega_n = ${t4(wn)}$ rad/s, $z_0 = ${f4(aG * G)}/(${t4(wn)})^2 = $ **${f4(z0nm)} nm** (tiny: hence the charge amplifier).`,
          ],
        };
      }
      const zeta = rng.pick([0.65, 0.7]);
      const epsPct = rng.pick([2, 3, 5, 10]);
      const eps = epsPct / 100;
      const fnk = rng.pick([5, 8, 10, 12, 15, 20]);
      const b = 1 - 2 * zeta * zeta;
      const c = 1 / (1 - eps) ** 2 - 1;
      const bd = usableBand(zeta, eps, 'accelerometer');
      const bu = usableBand(0, eps, 'accelerometer');
      const phi = (seismicPhase(bd, zeta) * 180) / Math.PI;
      return {
        prompt: `A damped accelerometer ($\\zeta$ = ${zeta}) has a natural frequency of ${fnk} kHz. Its reading may be in error by at most ±${epsPct} %. Its response never rises by more than ${f3((accelerometerRatio(Math.sqrt(Math.max(b, 0)), zeta) - 1) * 100)} %, so the band ends where the reading has **fallen** by ${epsPct} %.`,
        givens: [
          { sym: '\\zeta', value: `${zeta}` },
          { sym: 'f_n', value: `${fnk} kHz` },
          { sym: '\\varepsilon', value: `${epsPct} %` },
        ],
        parts: [
          num({
            id: 'bd',
            label: 'Upper band edge $\\beta_{max}$ (reading = $1 - \\varepsilon$)',
            answer: bd,
            unit: '',
            traps: [
              { value: bu, message: 'That is the undamped band edge. With damping, solve $(1-u)^2 + 4\\zeta^2 u = 1/(1-\\varepsilon)^2$ for $u = \\beta^2$.' },
              { value: bd * bd, message: 'That is $u = \\beta^2$. Take the square root.', trapId: 'sqrt' },
            ],
          }),
          num({ id: 'fmax', label: 'Highest usable frequency', answer: bd * fnk, unit: 'kHz', traps: [{ value: bu * fnk, message: 'You used the undamped band edge.' }] }),
          num({ id: 'gain', label: 'How many times wider is this band than for an undamped accelerometer with the same $f_n$?', answer: bd / bu, unit: '×', tol: 0.03 }),
          num({ id: 'phi', label: 'Phase lag of the reading at the band edge', answer: phi, unit: '°', tol: 0.02, traps: [{ value: 90 * bd, message: 'Close to the rule of thumb φ ≈ 90°·β, but compute $\\tan^{-1}[2\\zeta\\beta/(1-\\beta^2)]$.' }] }),
        ],
        hints: [
          'Reading/true $= 1/\\sqrt{(1-\\beta^2)^2+(2\\zeta\\beta)^2}$. Near $\\zeta \\approx 0.7$ it stays close to 1 and then falls slowly, so the band ends where it reaches $1-\\varepsilon$.',
          'With $u = \\beta^2$: $(1-u)^2 + 4\\zeta^2u = 1/(1-\\varepsilon)^2$, i.e. $u^2 - 2bu - c = 0$ with $b = 1-2\\zeta^2$, $c = 1/(1-\\varepsilon)^2 - 1$, so $u = b + \\sqrt{b^2 + c}$. Phase: $\\varphi = \\tan^{-1}[2\\zeta\\beta/(1-\\beta^2)]$.',
          `$b = ${f4(b)}$, $c = ${f4(c)}$, $u = ${f4(b)} + \\sqrt{${f4(b * b)} + ${f4(c)}} = ${f4(bd * bd)}$. Undamped: $\\beta = \\sqrt{1 - 1/(1+\\varepsilon)} = ${f4(bu)}$.`,
          `$\\beta_{max} = \\sqrt{${f4(bd * bd)}} = $ **${f4(bd)}** (check: ${f4(dampedBandEdge(zeta, eps))}), so $f_{max} = $ **${f4(bd * fnk)} kHz**, **${f3(bd / bu)}×** the undamped band; $\\varphi = \\tan^{-1}[${f4(2 * zeta * bd)}/${f4(1 - bd * bd)}] = $ **${f3(phi)}°** (nearly proportional to frequency, so the waveform is delayed rather than distorted).`,
        ],
      };
    },
  },

  // ------------------------------------------------------------------ vibrometer
  {
    id: 'c1-vibrometer',
    title: 'Displacement vibrometer: how far above resonance?',
    summary: 'The β ≫ 1 regime: reading error, the lowest usable frequency, and why vibrometers are big and soft.',
    tiers: [1, 2, 3],
    source: 'LC1-6 (displacement vibrometer, z₀/y₀ → 1 as β → ∞); summary notes C1',
    cardId: 'c1-seismic',
    generate(rng, tier) {
      if (tier === 1) {
        const fn = rng.pick([1, 2, 2.5, 4, 5, 8, 10]);
        const b0 = rng.pick([3, 4, 5, 6, 8, 10]);
        const f = fn * b0;
        const ratio = seismicRatio(b0, 0);
        const err = (ratio - 1) * 100;
        return {
          prompt: `A seismic displacement pickup (soft spring, heavy mass, negligible damping) has a natural frequency of ${fn} Hz. It is mounted on a structure vibrating at ${f} Hz.`,
          givens: [
            { sym: 'f_n', value: `${fn} Hz` },
            { sym: 'f', value: `${f} Hz` },
            { sym: '\\zeta', value: '≈ 0' },
          ],
          parts: [
            num({ id: 'beta', label: 'Frequency ratio $\\beta$', answer: b0, unit: '', traps: [{ value: 1 / b0, message: 'Inverted: $\\beta = f/f_n$.' }] }),
            num({
              id: 'err',
              label: 'Amplitude error of the reading $z_0/y_0 - 1$',
              answer: err,
              unit: '%',
              traps: [
                { value: 100 / (b0 * b0), message: '$1/\\beta^2$ is the large-$\\beta$ approximation. Exactly, $z_0/y_0 = \\beta^2/(\\beta^2-1)$.' },
                { value: (1 / (1 - 1 / b0) - 1) * 100, message: 'Square $\\beta$: $z_0/y_0 = \\beta^2/(\\beta^2 - 1)$.', trapId: 'sqrt' },
              ],
            }),
          ],
          hints: [
            'Far above resonance the mass stays still, so the relative deflection is the case displacement: $z_0/y_0 = \\beta^2/\\sqrt{(1-\\beta^2)^2 + (2\\zeta\\beta)^2} \\to 1$.',
            'Undamped and $\\beta > 1$: $z_0/y_0 = \\beta^2/(\\beta^2 - 1)$, error $= 1/(\\beta^2 - 1)$.',
            `$\\beta = ${f}/${fn} = ${b0}$; $\\beta^2 = ${b0 * b0}$.`,
            `$\\beta = $ **${b0}**; $z_0/y_0 = ${b0 * b0}/${b0 * b0 - 1} = ${f4(ratio)}$, so it reads **${f3(err)} %** high.`,
          ],
        };
      }
      if (tier === 2) {
        const fn = rng.pick([1, 1.5, 2, 3, 4, 5]);
        const epsPct = rng.pick([1, 2, 3, 5, 10]);
        const eps = epsPct / 100;
        const bmin = Math.sqrt(1 + 1 / eps);
        const fmin = bmin * fn;
        const fTest = rng.pick([2, 3]) * Math.ceil(fmin);
        const errTest = (seismicRatio(fTest / fn, 0) - 1) * 100;
        return {
          prompt: `An undamped seismic displacement pickup has a natural frequency of ${fn} Hz. Its reading may be at most ${epsPct} % high.`,
          givens: [
            { sym: 'f_n', value: `${fn} Hz` },
            { sym: '\\varepsilon', value: `${epsPct} %` },
          ],
          parts: [
            num({ id: 'bmin', label: 'Lowest usable frequency ratio $\\beta_{min}$', answer: bmin, unit: '', traps: [{ value: 1 / Math.sqrt(eps), message: '$1/\\sqrt\\varepsilon$ is approximate. Solve $\\beta^2/(\\beta^2-1) = 1+\\varepsilon$.' }, { value: Math.sqrt(1 - 1 / (1 + eps)), message: 'That is the **accelerometer** band edge ($\\beta \\ll 1$). A vibrometer works at $\\beta \\gg 1$.', trapId: 'c1-regime' }] }),
            num({ id: 'fmin', label: 'Lowest usable frequency $f_{min}$', answer: fmin, unit: 'Hz', freq: true, traps: [{ value: fn / bmin, message: '$f_{min} = \\beta_{min} f_n$, above the natural frequency.' }] }),
            num({ id: 'errT', label: `Reading error at ${fTest} Hz`, answer: errTest, unit: '%', traps: [{ value: (100 * fn * fn) / (fTest * fTest), message: '$1/\\beta^2$ is approximate; use $1/(\\beta^2-1)$.' }] }),
          ],
          hints: [
            'For $\\beta > 1$ the undamped reading is $z_0/y_0 = \\beta^2/(\\beta^2-1)$, which falls towards 1 as $\\beta$ grows: the error shrinks with frequency.',
            '$\\beta^2/(\\beta^2-1) = 1+\\varepsilon \\Rightarrow \\beta_{min}^2 = 1 + 1/\\varepsilon$; $f_{min} = \\beta_{min} f_n$.',
            `$\\beta_{min} = \\sqrt{1 + 1/${eps}} = ${f4(bmin)}$; at ${fTest} Hz, $\\beta = ${f4(fTest / fn)}$.`,
            `$\\beta_{min} = $ **${f4(bmin)}**, $f_{min} = ${f4(bmin)} \\times ${fn} = $ **${f4(fmin)} Hz**; at ${fTest} Hz the error is $1/(${f4((fTest / fn) ** 2)} - 1) = $ **${f3(errTest)} %**.`,
          ],
        };
      }
      const fLow = rng.pick([5, 8, 10, 15, 20]);
      const epsPct = rng.pick([2, 5, 10]);
      const eps = epsPct / 100;
      const bmin = Math.sqrt(1 + 1 / eps);
      const fnMax = fLow / bmin;
      const wn = TAU * fnMax;
      const sag = (G / (wn * wn)) * 1000; // mm
      const parts: SolvePart[] = [
        num({ id: 'fn', label: 'Largest natural frequency the pickup may have', answer: fnMax, unit: 'Hz', freq: true, traps: [{ value: fLow * bmin, message: 'Inverted: the natural frequency must be **below** the lowest measured frequency, $f_n = f_{low}/\\beta_{min}$.', trapId: 'c1-regime' }] }),
        num({ id: 'sag', label: 'Static sag of the seismic mass on its spring (mounted vertically)', answer: sag, unit: 'mm', traps: [{ value: (G / (fnMax * fnMax)) * 1000, message: 'Use $\\omega_n$ in rad/s: $\\delta = g/\\omega_n^2$.', trapId: 'units' }] }),
        {
          kind: 'choice',
          id: 'why',
          label: 'Why are displacement vibrometers bulky?',
          options: [
            { text: 'A low natural frequency needs a soft spring and a heavy mass, which means a large static sag and room for the mass to stay still while the case moves.', correct: true, why: `Here $\\delta = g/\\omega_n^2 \\approx$ ${f3(sag)} mm.` },
            { text: 'To make them more sensitive than accelerometers.', correct: false, why: 'For $\\beta \\gg 1$ the reading is simply $z \\approx -y$; size does not raise it.' },
            { text: 'To raise their natural frequency above the measured band.', correct: false, why: 'That is the accelerometer requirement. A vibrometer needs $f_n$ well **below** the band.' },
          ],
        },
      ];
      return {
        prompt: `A seismic pickup is to measure displacement down to ${fLow} Hz with an error of at most ${epsPct} % (negligible damping).`,
        givens: [
          { sym: 'f_{low}', value: `${fLow} Hz` },
          { sym: '\\varepsilon', value: `${epsPct} %` },
        ],
        parts,
        hints: [
          'A vibrometer needs $\\beta = f/f_n \\gg 1$ at the lowest frequency measured, so its natural frequency must be low: a soft spring and heavy mass.',
          '$\\beta_{min} = \\sqrt{1 + 1/\\varepsilon}$; $f_n \\le f_{low}/\\beta_{min}$; static sag $\\delta = mg/k = g/\\omega_n^2$.',
          `$\\beta_{min} = \\sqrt{1 + 1/${eps}} = ${f4(bmin)}$; $f_n \\le ${fLow}/${f4(bmin)}$.`,
          `$f_n \\le $ **${f4(fnMax)} Hz**; $\\omega_n = ${f4(wn)}$ rad/s; $\\delta = 9.81/${f4(wn)}^2 = $ **${f4(sag)} mm**: big, soft and heavy, the opposite of an accelerometer.`,
        ],
      };
    },
  },

  // ------------------------------------------------------------------ contact duration
  {
    id: 'c1-contact-bandwidth',
    title: 'Impact duration → bandwidth',
    summary: 'The ≈ 1/T rule, the contact time from hammer mass and tip stiffness, and the structure’s stiffness in series.',
    tiers: [1, 2, 3],
    source: 'LC1-3 (≈ 1/T, 10–20 dB); LC1-4; Week 11 Q1 WS (T ≈ π√(m/k))',
    cardId: 'c1-hammer',
    generate(rng, tier) {
      if (tier === 1) {
        const Tms = rng.pick([0.1, 0.15, 0.2, 0.25, 0.4, 0.5, 0.8, 1, 2, 2.5, 4, 5]);
        const f = 1000 / Tms;
        return {
          prompt: `An instrumented hammer’s force pulse lasts $T$ = ${Tms} ms.`,
          givens: [{ sym: 'T', value: `${Tms} ms`, label: 'impact duration' }],
          parts: [
            num({ id: 'f', label: 'Approximate highest frequency excited, by the course rule', answer: f, unit: 'Hz', traps: [{ value: 1 / Tms, message: 'Convert ms to s: $1/T$ with $T$ in seconds gives Hz.', trapId: 'unit-scale' }] }),
            num({ id: 'f2', label: 'The same estimate if a softer tip doubled the duration', answer: f / 2, unit: 'Hz', traps: [{ value: 2 * f, message: 'A longer pulse has a **narrower** spectrum.', trapId: 'c1-tip-range' }, { value: f / 4, message: 'The bandwidth scales as $1/T$, not $1/T^2$.' }] }),
          ],
          hints: [
            'A short impulse contains all frequencies up to about $1/T$; the useful range ends where the spectrum has fallen 10–20 dB (LC1-3).',
            '$f_{max} \\approx 1/T$ with $T$ in seconds.',
            `$T = ${Tms}$ ms $= ${t3(Tms / 1000)}$ s.`,
            `$f_{max} \\approx 1/${d3(Tms / 1000)} = $ **${f4(f)} Hz**; doubling $T$ halves it: **${f4(f / 2)} Hz**.`,
          ],
        };
      }
      if (tier === 2) {
        const m = rng.pick([0.1, 0.15, 0.2, 0.25, 0.3, 0.5, 1]);
        const k = rng.pick([3e5, 5e5, 1e6, 2e6, 5e6, 1e7, 2e7, 5e7, 1e8]);
        const mult = rng.pick([2, 4, 9]);
        const T = hammerContactDuration(m, k);
        const f = 1 / T;
        return {
          prompt: `A hammer of mass ${m} kg strikes a rigid structure through a tip with contact stiffness ${fmt(k, 3)} N/m. Model the contact as half a period of the hammer mass on the tip spring (Week 11 model).`,
          givens: [
            { sym: 'm_h', value: `${m} kg` },
            { sym: 'k_{tip}', value: `${fmt(k, 3)} N/m` },
          ],
          parts: [
            num({ id: 'T', label: 'Contact time $T$', answer: T * 1000, unit: 'ms', traps: [{ value: Math.sqrt(m / k) * 1000, message: 'Missing π: half a period is $\\pi\\sqrt{m/k}$.' }, { value: 2 * Math.PI * Math.sqrt(m / k) * 1000, message: 'That is a full period. The tip is in contact for half of one.', trapId: 'factor2' }] }),
            num({ id: 'f', label: 'Approximate bandwidth $\\approx 1/T$', answer: f, unit: 'Hz', traps: [{ value: 1 / (Math.sqrt(m / k)), message: 'Include the π in $T$ before inverting.' }, { value: f / TAU, message: '$1/T$ is already in Hz.', trapId: 'units' }] }),
            num({ id: 'f4', label: `Bandwidth with a hammer ${mult} times heavier (same tip)`, answer: f / Math.sqrt(mult), unit: 'Hz', traps: [{ value: f / mult, message: '$T \\propto \\sqrt{m}$, so the bandwidth falls by $\\sqrt{' + mult + '}$, not ' + mult + '.', trapId: 'sqrt' }, { value: f * Math.sqrt(mult), message: 'A heavier hammer lengthens the impact and **narrows** the range (LC1-4).', trapId: 'c1-tip-range' }] }),
          ],
          hints: [
            'During contact the hammer mass rides on the tip stiffness: the pulse lasts half a period, and its spectrum extends to about $1/T$.',
            '$T \\approx \\pi\\sqrt{m_h/k}$; $f_{max} \\approx 1/T$; a heavier hammer: $T \\propto \\sqrt{m_h}$.',
            `$\\sqrt{${m}/${d3(k)}} = ${t4(Math.sqrt(m / k))}$ s.`,
            `$T = \\pi \\times ${t4(Math.sqrt(m / k))} = $ **${f4(T * 1000)} ms**; $1/T = $ **${f4(f)} Hz**; ×${mult} mass: $T$ × ${f3(Math.sqrt(mult))}, bandwidth **${f4(f / Math.sqrt(mult))} Hz**.`,
          ],
        };
      }
      const m = rng.pick([0.1, 0.2, 0.3]);
      const kt = rng.pick([1e7, 3e7, 1e8]);
      // Never equal to the tip stiffness: then neither element is "the softer one" and the last part has no answer.
      const ks = rng.pick([2e6, 5e6, 1e7, 3e7, 3e8].filter((s) => s !== kt));
      const kc = 1 / (1 / kt + 1 / ks);
      const T = hammerContactDuration(m, kt, ks);
      const f10 = HALF_SINE_10DB / T;
      const structSofter = ks < kt;
      return {
        prompt: `A ${m} kg hammer with a tip of stiffness ${fmt(kt, 2)} N/m strikes a structure whose local contact stiffness is ${fmt(ks, 2)} N/m. Treat the pulse as a half-sine, whose spectrum is 10 dB down at $f \\approx 1.02/T$.`,
        givens: [
          { sym: 'm_h', value: `${m} kg` },
          { sym: 'k_{tip}', value: `${fmt(kt, 2)} N/m` },
          { sym: 'k_{str}', value: `${fmt(ks, 2)} N/m` },
        ],
        parts: [
          num({ id: 'kc', label: 'Effective contact stiffness $k_c$', answer: kc, unit: 'N/m', traps: [{ value: kt + ks, message: 'The tip and the structure deform one after the other: springs in **series**, $1/k_c = 1/k_{tip} + 1/k_{str}$.', trapId: 'c1-tip-range' }, { value: kt, message: 'You ignored the structure’s local stiffness.' }, { value: ks, message: 'You ignored the tip stiffness.' }] }),
          num({
            id: 'T',
            label: 'Contact time $T$',
            answer: T * 1000,
            unit: 'ms',
            traps: [
              { value: hammerContactDuration(m, kt) * 1000, message: 'Use the series stiffness $k_c$, not the tip alone.' },
              { value: 2 * T * 1000, message: 'That is a full period. The tip is in contact for half of one: $T = \\pi\\sqrt{m_h/k_c}$.', trapId: 'factor2' },
              { value: Math.sqrt(m / kc) * 1000, message: 'Missing π: half a period is $\\pi\\sqrt{m_h/k_c}$.' },
            ],
          }),
          num({ id: 'f10', label: 'Frequency at which the force spectrum is 10 dB down', answer: f10, unit: 'Hz', traps: [{ value: HALF_SINE_10DB / hammerContactDuration(m, kt), message: 'That ignores the structure’s stiffness.' }] }),
          {
            kind: 'choice',
            id: 'stiffer',
            label: 'Would a much stiffer tip widen the excited range much here?',
            options: [
              { text: 'No: the structure is the softer element and controls the contact.', correct: structSofter, why: structSofter ? `$k_{str} < k_{tip}$, so $k_c$ is already close to $k_{str}$ = ${fmt(ks, 2)} N/m; a stiffer tip barely changes it.` : 'Here the tip is the softer element.' },
              { text: 'Yes: the tip is the softer element and controls the contact.', correct: !structSofter, why: !structSofter ? `$k_{tip} < k_{str}$, so the tip controls $k_c$; a stiffer tip shortens the pulse.` : 'Here the structure is the softer element.' },
            ],
          },
        ],
        hints: [
          'Tip and structure are compressed in series; the structure’s stiffness only drops out when the tip is much **softer** (official 2018/2019 A3.5(c)).',
          '$1/k_c = 1/k_{tip} + 1/k_{str}$; $T \\approx \\pi\\sqrt{m_h/k_c}$; half-sine: $f_{-10\\,dB} \\approx 1.02/T$.',
          `$1/k_c = 1/${d3(kt)} + 1/${d3(ks)} = ${t4(1 / kc)}$ m/N.`,
          `$k_c = $ **${fmt(kc, 4)} N/m**; $T = \\pi\\sqrt{${m}/${d4(kc)}} = $ **${f4(T * 1000)} ms**; $f_{-10} = 1.02/T = $ **${f4(f10)} Hz**. ${structSofter ? 'The structure is the softer element, so a stiffer tip would hardly help.' : 'The tip is the softer element, so a stiffer tip would widen the range.'}`,
        ],
      };
    },
  },

  // ------------------------------------------------------------------ which tip
  {
    id: 'c1-which-tip',
    title: 'Which tip reaches the modes you need?',
    summary: 'Read a force spectrum against the natural frequencies (2023 A3.1), pick the softest adequate tip, and size the hammer.',
    tiers: [1, 2, 3],
    source: 'Similar to 2023 A3.1; Week 11 Q1; LC1-3/LC1-4',
    cardId: 'c1-hammer',
    generate(rng, tier) {
      const cant = rng.chance(0.6);
      const ratios = cant ? CANTILEVER_RATIOS : PINNED_RATIOS;
      const sname = cant ? 'light cantilever' : 'pinned–pinned beam';
      if (tier === 1) {
        // Realistic first modes (20–500 Hz); choose the tip (and hammer) so that one or two modes are clearly
        // inside the range, at least one clearly outside, and none in the ambiguous band between −10 and −20 dB.
        let tip = TIP_TABLE[0];
        let T = 9e-3;
        let modes = ratios.map((r) => Number((r * 76).toPrecision(3)));
        for (let tries = 0; tries < 80; tries++) {
          const f1 = rng.pick([20, 25, 30, 40, 50, 60, 75, 80, 100, 120, 150, 200, 250, 300, 400, 500]);
          const tryModes = ratios.map((r) => Number((r * f1).toPrecision(3)));
          const tryTip = rng.pick(TIP_TABLE);
          const tryT = (tryTip.T * rng.pick([0.5, 1, 2, 3])) / 1000;
          const a = HALF_SINE_10DB / tryT;
          const b = HALF_SINE_20DB / tryT;
          const nIn = tryModes.filter((f) => f < 0.9 * a).length;
          if (nIn >= 1 && nIn <= 2 && tryModes.every((f) => f < 0.9 * a || f > 1.15 * b)) {
            tip = tryTip;
            T = tryT;
            modes = tryModes;
            break;
          }
        }
        const f10 = HALF_SINE_10DB / T;
        const inside = modes.map((f) => f < f10);
        return {
          prompt: `A ${sname} has natural frequencies $f_1$ = ${modes[0]} Hz, $f_2$ = ${modes[1]} Hz and $f_3$ = ${modes[2]} Hz. It is struck with ${/^[aeiou]/.test(tip.name) ? 'an' : 'a'} ${tip.name} tip; the measured force spectrum is shown (dB relative to its low-frequency plateau).`,
          figure: spectrumFigure({ tau: T, modes, floorDb: -55, tipLabel: tip.name[0].toUpperCase() + tip.name.slice(1) }),
          parts: [
            {
              kind: 'choice',
              id: 'which',
              label: 'Which natural frequencies lie inside this tip’s useful range? (Select all that apply.)',
              multi: true,
              options: [
                ...modes.map((f, i) => ({ text: `$f_${i + 1}$ = ${f} Hz`, correct: inside[i], why: inside[i] ? 'Below the −10 dB point: well excited.' : 'Beyond the −20 dB point: almost no force reaches it.' })),
              ],
            },
            num({ id: 'f10', label: 'Read the frequency at which the spectrum has fallen 10 dB', answer: f10, unit: 'Hz', tol: 0.05, traps: [{ value: HALF_SINE_20DB / T, message: 'That is the −20 dB point. Either end of the 10–20 dB rule is acceptable as a range, but this part asks for −10 dB.' }] }),
          ],
          hints: [
            'The useful range runs from 0 Hz to where the force spectrum has fallen 10–20 dB (LC1-3). Modes beyond it get almost no force and sit in the noise.',
            'Find the −10 dB and −20 dB crossings, then compare each $f_n$ with them.',
            `−10 dB at about ${f3(f10)} Hz, −20 dB at about ${f3(HALF_SINE_20DB / T)} Hz.`,
            `Useful range ≈ 0–${f3(f10)} Hz (to ${f3(HALF_SINE_20DB / T)} Hz at −20 dB): **${inside.some(Boolean) ? modes.filter((_, i) => inside[i]).map((f) => `${f} Hz`).join(', ') : 'none of the modes'}** ${inside.filter(Boolean).length === 1 ? 'is' : 'are'} inside; the rest lie beyond the −20 dB point and get less than a tenth of the plateau force.`,
          ],
        };
      }
      const hammerScale = rng.pick([0.5, 1, 2]);
      const tips = TIP_TABLE.map((t) => ({ ...t, T: t.T * hammerScale }));
      const n = tier === 2 ? rng.pick([2, 3]) : 3;
      let target: number;
      if (tier === 2) {
        // Put the target mode between the reach of tip j-1 and tip j, so tip j is the softest adequate one.
        const j = rng.int(0, 3);
        const fHi = HALF_SINE_10DB / (tips[j].T / 1000);
        const fLo = j > 0 ? HALF_SINE_10DB / (tips[j - 1].T / 1000) : 0.3 * fHi;
        target = fLo + (fHi - fLo) * rng.uniform(0.2, 0.8);
      } else {
        // Keep every mode clearly inside or clearly outside the rubber tip's range (never between its −10 and
        // −20 dB points, where "inside the useful range" would be a judgement call), as in tier 1.
        const rub10 = HALF_SINE_10DB / (tips[0].T / 1000);
        const rub20 = HALF_SINE_20DB / (tips[0].T / 1000);
        const clear = (f3: number) => {
          const g1 = Number((f3 / ratios[2]).toPrecision(3));
          return ratios.every((r) => {
            const f = Number((r * g1).toPrecision(3));
            return f < 0.9 * rub10 || f > 1.15 * rub20;
          });
        };
        target = rng.uniform(1000, 3000);
        for (let tries = 0; tries < 60 && !clear(target); tries++) target = rng.uniform(1000, 3000);
      }
      const f1 = Number((target / ratios[n - 1]).toPrecision(3));
      const modes = ratios.map((r) => Number((r * f1).toPrecision(3)));
      const fTarget = modes[n - 1];
      const Tmax = HALF_SINE_10DB / fTarget; // s
      const adequate = tips.filter((t) => t.T / 1000 <= Tmax);
      const softest = adequate.length ? adequate[0] : tips[tips.length - 1];
      if (tier === 2) {
        return {
          prompt: `A ${sname} has natural frequencies ${modes.join(', ')} Hz. With the available hammer the tips give these contact times: ${tips.map((t) => `${t.name} ${fmt(t.T, 3)} ms`).join(', ')}. You want mode ${n} inside the useful range (spectrum no more than 10 dB down; half-sine: $f_{-10} \\approx 1.02/T$).`,
          givens: tips.map((t) => ({ sym: `T_{\\text{${t.name.split(' ').pop()}}}`, value: `${fmt(t.T, 3)} ms` })),
          parts: [
            num({
              id: 'Tmax',
              label: `Longest contact time that still reaches $f_${n}$ = ${fTarget} Hz`,
              answer: Tmax * 1000,
              unit: 'ms',
              tol: 0.03,
              traps: [
                { value: 1500 / fTarget, message: '$1.5/T$ is where the half-sine spectrum reaches **zero**; the useful range ends much earlier.' },
                { value: 1000 / (TAU * fTarget), message: 'No 2π: the spectrum rule uses $f$ in Hz.', trapId: 'units' },
                { value: (HALF_SINE_20DB / fTarget) * 1000, message: 'That uses the −20 dB point ($1.30/T$). Either end of the 10–20 dB rule is a fair range, but here the mode must be no more than 10 dB down: $T \\le 1.02/f$.', trapId: 'c1-useful-range' },
              ],
            }),
            {
              kind: 'choice',
              id: 'tip',
              label: 'Which is the softest tip that does the job?',
              options: tips.map((t) => ({
                text: `${t.name[0].toUpperCase() + t.name.slice(1)} (${fmt(t.T, 3)} ms)`,
                correct: t.name === softest.name && adequate.length > 0,
                why: t.T / 1000 <= Tmax ? (t.name === softest.name ? 'The longest contact time that is still short enough.' : 'Works, but a softer tip would also do.') : `Too long: its −10 dB point is at ${f3(HALF_SINE_10DB / (t.T / 1000))} Hz, below ${fTarget} Hz.`,
              })),
            },
          ],
          hints: [
            'Harder tip → shorter contact → wider spectrum. The softest tip that reaches the target mode is the one with the longest contact time still short enough.',
            `Require $f_{-10} = 1.02/T \\ge f_${n}$, i.e. $T \\le 1.02/f_${n}$.`,
            `$T_{max} = 1.02/${fTarget} = ${f4(Tmax * 1000)}$ ms.`,
            `$T_{max} = $ **${f4(Tmax * 1000)} ms**: ${adequate.length ? `the softest adequate tip is **${softest.name}** (${fmt(softest.T, 3)} ms)` : 'none of these tips is short enough: use a lighter hammer'}.`,
          ],
        };
      }
      const kAl = 2.4e7;
      const mMax = kAl * (Tmax / Math.PI) ** 2;
      const rubber = tips[0];
      const steel = tips[3];
      return {
        prompt: `A ${sname} has natural frequencies ${modes.join(', ')} Hz. A first test used a rubber tip (contact ${fmt(rubber.T, 3)} ms). You now want all three modes inside the useful range (half-sine: $f_{-10} \\approx 1.02/T$) using an aluminium tip of contact stiffness $2.4 \\times 10^7$ N/m on a rigid structure.`,
        givens: [
          { sym: 'T_{rubber}', value: `${fmt(rubber.T, 3)} ms` },
          { sym: 'k_{Al}', value: '2.4×10⁷ N/m' },
          { sym: 'f_3', value: `${fTarget} Hz` },
        ],
        parts: [
          {
            kind: 'choice',
            id: 'rub',
            label: 'With the rubber tip, which modes were inside the useful range? (Select all that apply.)',
            multi: true,
            options: [
              ...modes.map((f, i) => {
                const ok = f <= HALF_SINE_10DB / (rubber.T / 1000);
                return { text: `$f_${i + 1}$ = ${f} Hz`, correct: ok, why: ok ? 'Below the rubber tip’s −10 dB point.' : `Above ${f3(HALF_SINE_10DB / (rubber.T / 1000))} Hz, the rubber tip’s −10 dB point.` };
              }),
              (() => {
                const none = modes.every((f) => f > HALF_SINE_10DB / (rubber.T / 1000));
                return { text: 'None of them', correct: none, why: none ? `Even $f_1$ is above the rubber tip’s −10 dB point (${f3(HALF_SINE_10DB / (rubber.T / 1000))} Hz).` : 'At least the first mode was inside the rubber tip’s range.' };
              })(),
            ],
          },
          num({ id: 'mmax', label: 'Largest hammer mass for which the aluminium tip still reaches $f_3$', answer: mMax, unit: 'kg', traps: [{ value: kAl * (Tmax / Math.PI), message: 'Square it: $T = \\pi\\sqrt{m/k} \\Rightarrow m = k(T/\\pi)^2$.', trapId: 'sqrt' }, { value: kAl * Tmax * Tmax, message: 'Divide by $\\pi^2$: $m = k(T/\\pi)^2$.' }] }),
          num({ id: 'ratio', label: `How many times shorter is the steel-tip contact (${fmt(steel.T, 3)} ms) than the rubber one?`, answer: rubber.T / steel.T, unit: '×', traps: [{ value: steel.T / rubber.T, message: 'Inverted: rubber over steel.' }] }),
        ],
        hints: [
          'All three modes inside means $f_{-10} \\ge f_3$. The aluminium tip’s contact time depends on the hammer mass through $T = \\pi\\sqrt{m/k}$.',
          `$T_{max} = 1.02/f_3$, then $m_{max} = k(T_{max}/\\pi)^2$. Rubber: $f_{-10} = 1.02/T_{rubber}$.`,
          `$T_{max} = 1.02/${fTarget} = ${f4(Tmax * 1000)}$ ms; rubber $f_{-10} = ${f3(HALF_SINE_10DB / (rubber.T / 1000))}$ Hz.`,
          `Rubber reached **${modes.filter((f) => f <= HALF_SINE_10DB / (rubber.T / 1000)).join(', ') || 'none'}** Hz; $m_{max} = 2.4\\times10^7 \\times (${t4(Tmax)}/\\pi)^2 = $ **${f4(mMax)} kg**; steel is **${f3(rubber.T / steel.T)}×** shorter.`,
        ],
      };
    },
  },

  // ------------------------------------------------------------------ coherence by tip
  {
    id: 'c1-coherence-tip',
    title: 'Coherence expectations by tip',
    summary: 'From the force level and the noise floor to the coherence you should expect, and where a soft tip loses it (2023 A3.5).',
    tiers: [1, 2, 3],
    source: 'Similar to 2023 A3.5; noise model γ² = 1/(1 + noise/signal) as in Week 12 Q5 WS; LC3 Eq 3.9',
    cardId: 'c1-hammer',
    generate(rng, tier) {
      if (tier === 1) {
        const L = rng.pick([0, 3, 5, 10, 15, 20, 25, 30]); // dB below plateau
        const N = rng.pick([30, 35, 40, 45, 50]); // noise floor, dB below plateau
        const snr = N - L;
        const coh = coherenceFromSnrDb(snr);
        return {
          prompt: `At one frequency a hammer’s force spectrum is ${L} dB below its plateau. The (uncorrelated) measurement noise sits ${N} dB below the plateau.`,
          givens: [
            { sym: 'L', value: `−${L} dB`, label: 'signal level re plateau' },
            { sym: 'N', value: `−${N} dB`, label: 'noise level re plateau' },
          ],
          parts: [
            num({ id: 'snr', label: 'Signal-to-noise ratio', answer: snr, unit: 'dB', absTol: 0.3, traps: [{ value: N + L, message: 'Subtract the levels: SNR = (−L) − (−N) = N − L.' }] }),
            num({ id: 'coh', label: 'Expected coherence $\\gamma^2 = 1/(1 + r)$, with $r$ the noise-to-signal **power** ratio', answer: coh, unit: '', tol: 0.01, traps: [{ value: 1 / (1 + 10 ** (-snr / 20)), message: 'dB of amplitude convert to a **power** ratio with $10^{-\\text{SNR}/10}$.', trapId: 'c1-db-amplitude' }, { value: 10 ** (-snr / 10), message: 'That is $r$ itself. Coherence is $1/(1+r)$.' }] }),
          ],
          hints: [
            'Coherence falls when noise is comparable with the signal: $\\gamma^2 = 1/(1 + r)$ with $r = $ noise power / signal power.',
            'SNR (dB) = signal level − noise level; $r = 10^{-\\text{SNR}/10}$ (power), so $\\gamma^2 = 1/(1 + 10^{-\\text{SNR}/10})$.',
            `SNR = ${N} − ${L} = ${snr} dB; $r = 10^{-${snr}/10} = ${t3(10 ** (-snr / 10))}$.`,
            `SNR = **${snr} dB**, $\\gamma^2 = 1/(1 + ${t3(10 ** (-snr / 10))}) = $ **${f4(coh)}**. (At 0 dB SNR it would be 0.5.)`,
          ],
        };
      }
      const Thard = rng.pick([0.1, 0.15, 0.2]) / 1000;
      const Tsoft = rng.pick([0.6, 0.8, 1.0]) / 1000;
      const N = rng.pick([35, 40, 45]);
      const fh20 = HALF_SINE_20DB / Thard;
      const fs20 = HALF_SINE_20DB / Tsoft;
      if (tier === 2) {
        const coh20 = coherenceFromSnrDb(N - 20);
        return {
          prompt: `A cantilever is hammer-tested with a hard tip (contact ${fmt(Thard * 1000, 2)} ms) and a soft tip (${fmt(Tsoft * 1000, 2)} ms). Treat both pulses as half-sines (20 dB down at $f \\approx 1.30/T$). The measurement noise is ${N} dB below the force plateau.`,
          givens: [
            { sym: 'T_{hard}', value: `${fmt(Thard * 1000, 2)} ms` },
            { sym: 'T_{soft}', value: `${fmt(Tsoft * 1000, 2)} ms` },
            { sym: 'N', value: `−${N} dB` },
          ],
          parts: [
            num({ id: 'fs20', label: 'Soft tip: frequency where its spectrum is 20 dB down', answer: fs20, unit: 'Hz', traps: [{ value: 1 / Tsoft, message: 'That is the rough $1/T$ rule; the half-sine is 20 dB down at $1.30/T$.' }] }),
            num({ id: 'coh20', label: 'Expected coherence at a −20 dB point', answer: coh20, unit: '', tol: 0.01, traps: [{ value: 1 / (1 + 10 ** (-(N - 20) / 20)), message: 'Use the power ratio $10^{-\\text{SNR}/10}$.', trapId: 'c1-db-amplitude' }] }),
            {
              kind: 'choice',
              id: 'where',
              label: `Above about ${f3(fs20)} Hz, what happens in the soft-tip test?`,
              options: [
                { text: 'The force there falls towards the noise floor, so coherence drops (the hard tip still has force there).', correct: true, why: `The hard tip is only 20 dB down at ${f3(fh20)} Hz.` },
                { text: 'The structure’s damping rises, so coherence drops.', correct: false, why: 'The tip changes the input spectrum, not the structure.' },
                { text: 'Nothing: coherence depends only on the structure.', correct: false, why: 'Coherence depends on signal-to-noise, so on how much force reaches each frequency.' },
              ],
            },
            {
              kind: 'choice',
              id: 'dips',
              label: 'Even with the hard tip, where would you still expect narrow coherence dips? (Select all that apply.)',
              multi: true,
              options: [
                { text: 'At anti-resonances of the measured FRF', correct: true, why: 'The response is tiny there, so ordinary noise dominates.' },
                { text: 'Near frequencies of modes that have a node at the sensor or the hit point', correct: true, why: 'That mode barely appears in the response.' },
                { text: 'At the resonance peaks', correct: false, why: 'The response is largest there; coherence is normally highest.' },
              ],
            },
          ],
          hints: [
            'Soft tip → long contact → force spectrum rolls off early. Where the force nears the noise floor the signal-to-noise ratio, and so the coherence, collapses (2023 A3.5).',
            'Half-sine: −20 dB at $1.30/T$. At a level $L$ dB down with noise $N$ dB down: SNR $= N - L$, $\\gamma^2 = 1/(1 + 10^{-\\text{SNR}/10})$.',
            `Soft: $1.30/${d3(Tsoft)} = ${f3(fs20)}$ Hz; hard: ${f3(fh20)} Hz. SNR at −20 dB = ${N - 20} dB.`,
            `Soft tip 20 dB down at **${f4(fs20)} Hz**; there $\\gamma^2 = 1/(1 + 10^{-${N - 20}/10}) = $ **${f4(coh20)}**; above it the soft-tip force sinks into the noise, while dips that survive with the hard tip mark anti-resonances and nodes (low response).`,
          ],
        };
      }
      const Ndb = rng.pick([25, 30, 35, 40]);
      const snrMin = 10 * Math.log10(9);
      const drop = Ndb - snrMin;
      const f10 = HALF_SINE_10DB / Tsoft;
      const coh10 = coherenceFromSnrDb(Ndb - 10);
      return {
        prompt: `A soft tip gives a half-sine pulse of ${fmt(Tsoft * 1000, 2)} ms (10 dB down at $1.02/T$). The noise floor of the measurement is ${Ndb} dB below the force plateau. You want a coherence of at least 0.9.`,
        givens: [
          { sym: 'T', value: `${fmt(Tsoft * 1000, 2)} ms` },
          { sym: 'N', value: `−${Ndb} dB` },
        ],
        parts: [
          num({ id: 'snr', label: 'Minimum signal-to-noise ratio for $\\gamma^2 \\ge 0.9$', answer: snrMin, unit: 'dB', traps: [{ value: 20 * Math.log10(9), message: 'Coherence uses the power ratio: $r \\le 1/9 \\Rightarrow$ SNR $\\ge 10\\log_{10}9$.', trapId: 'c1-db-amplitude' }] }),
          num({
            id: 'drop',
            label: 'How far may the force spectrum fall below its plateau before $\\gamma^2 < 0.9$?',
            answer: drop,
            unit: 'dB',
            traps: [
              { value: Ndb + snrMin, message: 'The allowed drop is the noise depth **minus** the SNR margin.' },
              { value: Ndb - 20 * Math.log10(9), message: 'That margin uses $20\\log_{10}9$. Coherence works with the noise-to-signal **power** ratio, so the margin is $10\\log_{10}9 = 9.54$ dB.', trapId: 'c1-db-amplitude' },
            ],
          }),
          num({ id: 'f10', label: 'Frequency of the −10 dB point', answer: f10, unit: 'Hz' }),
          num({ id: 'coh10', label: 'Coherence expected at the −10 dB point', answer: coh10, unit: '', tol: 0.01, traps: [{ value: 1 / (1 + 10 ** (-(Ndb - 10) / 20)), message: 'Use the power ratio $10^{-\\text{SNR}/10}$.', trapId: 'c1-db-amplitude' }] }),
          {
            kind: 'choice',
            id: 'half',
            label: 'What coherence do you expect where the force spectrum meets the noise floor?',
            options: [
              { text: 'About 0.5', correct: true, why: 'SNR = 0 dB → $r = 1$ → $\\gamma^2 = 1/2$.' },
              { text: 'About 0', correct: false, why: 'Only once the force is far below the noise.' },
              { text: 'About 1', correct: false, why: 'Noise equal to the signal halves the coherence.' },
            ],
          },
        ],
        hints: [
          '$\\gamma^2 = 1/(1 + r)$ with $r$ = noise power / signal power. A coherence target sets a minimum SNR, and the noise depth then limits how far the force spectrum may fall.',
          `$\\gamma^2 \\ge 0.9 \\Leftrightarrow r \\le 1/9 \\Leftrightarrow$ SNR $\\ge 10\\log_{10}9$; allowed drop = ${Ndb} dB − SNR$_{min}$; $f_{-10} = 1.02/T$.`,
          `SNR$_{min}$ = ${f3(snrMin)} dB; drop = ${Ndb} − ${f3(snrMin)} dB; $f_{-10} = 1.02/${d3(Tsoft)}$ Hz; SNR at −10 dB = ${Ndb - 10} dB.`,
          `SNR$_{min}$ = **${f4(snrMin)} dB**; allowed drop **${f4(drop)} dB**; $f_{-10}$ = **${f4(f10)} Hz** with $\\gamma^2$ = **${f4(coh10)}**; where force meets noise, $\\gamma^2 \\approx 0.5$.`,
        ],
      };
    },
  },
];
