// B2 problem generators. Numbers are randomised within the ranges the papers use; the four hints walk
// concept -> set-up -> substitution -> worked solution with this instance's numbers.
import type { ChoicePart, NumericPart, SolveGenerator, SolvePart } from '../../engine/types';
import type { Rng } from '../../engine/rng';
import { fmt, tex } from '../../engine/format';
import { endInertiaRoots, pluckAmplitudes, polarMoment, waveOmegas, type WaveBC } from '../../physics/waves';
import { MATERIALS, endInertiaNewton, halfAxleIeffRatio, pluckSpectrum, lowestAlive, rotatingCableW79, steppedShaftF1Ratio, torsionAxialRatio, wireMassPerLength } from './physics';
import { cableFigure, shaftFigure, stringFigure, swingFigure } from './figures';

const TAU = 2 * Math.PI;
const g = 9.81;
const f3 = (x: number) => fmt(x, 3);
const f4 = (x: number) => fmt(x, 4);
const t3 = (x: number) => tex(x, 3);
const t4 = (x: number) => tex(x, 4);
/** Given data echoed back without float noise. */
const n6 = (x: number) => fmt(x, 6);

type Trap = { value: number; message: string; trapId?: string };

/** Traps that are finite and clearly away (> 3 %) from the answer and from each other. */
export function keepTraps(answer: number, list: Trap[]): Trap[] {
  const out: Trap[] = [];
  for (const t of list) {
    if (!Number.isFinite(t.value)) continue;
    if (Math.abs(t.value - answer) <= 0.03 * Math.max(Math.abs(answer), 1e-12)) continue;
    if (out.some((o) => Math.abs(o.value - t.value) <= 0.015 * Math.abs(t.value))) continue;
    out.push(t);
  }
  return out;
}

function num(id: string, label: string, answer: number, unit: string, traps: Trap[] = [], extra: Partial<NumericPart> = {}): NumericPart {
  return { kind: 'numeric', id, label, answer, unit, traps: keepTraps(answer, traps), ...extra };
}

/** A choice part with its options shuffled (deterministically from the instance's rng). */
function choice(rng: Rng, id: string, label: string, options: ChoicePart['options'], multi = false): ChoicePart {
  return { kind: 'choice', id, label, options: rng.shuffle(options), multi };
}

const BC_TEXT: Record<WaveBC, string> = {
  'fixed-fixed': 'fixed at both ends',
  'fixed-free': 'fixed at one end and free at the other',
  'free-free': 'free at both ends',
};
const BC_FORMULA: Record<WaveBC, string> = {
  'fixed-fixed': '$f_n = nc/2L$ (fixed–fixed, shapes $\\sin(n\\pi x/L)$)',
  'fixed-free': '$f_n = (2n-1)c/4L$ (fixed–free, shapes $\\sin((2n-1)\\pi x/2L)$)',
  'free-free': '$f_n = nc/2L$ plus a rigid-body mode at 0 (free–free, shapes $\\cos(n\\pi x/L)$)',
};

/** Tuned notes used for strings (Hz). */
const NOTES = [110, 146.8, 196, 220, 246.9, 261.6, 293.7, 329.6, 392, 440];

const FRAC_TEX: [number, string][] = [
  [1 / 8, 'L/8'],
  [1 / 6, 'L/6'],
  [1 / 5, 'L/5'],
  [1 / 4, 'L/4'],
  [1 / 3, 'L/3'],
  [3 / 8, '3L/8'],
  [2 / 5, '2L/5'],
  [1 / 2, 'L/2'],
];
const ORD = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth'];

export const generators: SolveGenerator[] = [
  // ------------------------------------------------------------------ strings: tension and mass per length
  {
    id: 'b2-string',
    title: 'String frequencies from tension and mass per length',
    summary: '$f_n = (n/2L)\\sqrt{T/\\rho_l}$: a taut string’s frequencies, the tension that tunes it, and its axial frequencies.',
    tiers: [1, 2, 3],
    source: 'Similar to Reader SP1(a) (powerline), tutorial W7.1 (piano wire) and Week 7 Q1',
    cardId: 'b2-strings',
    marks: 4,
    generate(rng, tier) {
      if (tier === 1) {
        const powerline = rng.chance(0.5);
        if (powerline) {
          const L = rng.step(100, 400, 10);
          const rl = rng.step(0.8, 2.5, 0.1);
          const TkN = rng.step(10, 40, 1);
          const T = TkN * 1000;
          const c = Math.sqrt(T / rl);
          const f1 = c / (2 * L);
          const n = rng.pick([2, 3, 4]);
          return {
            prompt: `A powerline spans ${L} m between towers. It has a mass of ${rl} kg/m and carries a tension of ${TkN} kN. Treat it as a taut string fixed at both ends.`,
            givens: [
              { sym: 'L', value: `${L} m`, label: 'span' },
              { sym: '\\rho_l', value: `${rl} kg/m`, label: 'mass per unit length' },
              { sym: 'T', value: `${TkN} kN`, label: 'tension' },
            ],
            figure: stringFigure({ label: 'A powerline span modelled as a string fixed at both ends' }),
            parts: [
              num('c', 'Transverse wave speed $c$', c, 'm/s', [{ value: Math.sqrt(TkN / rl), message: 'Convert the tension to newtons (kN × 1000) before taking the square root.', trapId: 'unit-scale' }]),
              num('f1', 'Fundamental frequency $f_1$', f1, 'Hz', [
                { value: c / L, message: '$f_1 = c/2L$: the fundamental fits half a wavelength between the fixed ends.', trapId: 'factor2' },
                { value: c / (4 * L), message: '$c/4L$ is the fixed–free result. A span between two towers is fixed at both ends.', trapId: 'b2-end-condition' },
              ], { freq: true }),
              num('fn', `Frequency of mode ${n}, $f_{${n}}$`, n * f1, 'Hz', [{ value: (2 * n - 1) * f1, message: 'Odd multiples (1 : 3 : 5) belong to fixed–free ends. Fixed at both ends every harmonic is present: $f_n = nf_1$.', trapId: 'b2-end-condition' }], { freq: true }),
            ],
            hints: [
              'A taut string carries transverse waves at $c = \\sqrt{T/\\rho_l}$. Fixed at both ends it fits whole half-wavelengths, so $f_n = nc/2L$ (LB2 Eq 2.6): evenly spaced.',
              '$c = \\sqrt{T/\\rho_l}$ with $T$ in N and $\\rho_l$ in kg/m; $f_1 = c/2L$; $f_n = nf_1$.',
              `$c = \\sqrt{${T}/${rl}}$; $f_1 = c/(2 \\times ${L})$; $f_{${n}} = ${n}f_1$.`,
              `$c = \\sqrt{${T}/${rl}} = $ **${f4(c)} m/s**; $f_1 = ${t4(c)}/${2 * L} = $ **${f4(f1)} Hz**; $f_{${n}} = ${n} \\times ${t4(f1)} = $ **${f4(n * f1)} Hz**. The modes are evenly spaced by $f_1$, and the loop length (node to node) is $c/2f$, e.g. ${f3(c / 2)} m at 1 Hz (Reader SP1(a)).`,
            ],
          };
        }
        const dmm = rng.step(0.3, 1.5, 0.1);
        const L = rng.step(0.5, 1.2, 0.05);
        // Keep the wire stress T/A below about 1.5 GPa (steel music wire), so thin wires get lower tensions.
        const Tcap = Math.min(600, Math.max(60, Math.floor((1.5e9 * Math.PI * (dmm / 1000) ** 2) / 40) * 10));
        const T = rng.step(50, Tcap, 10);
        const rl = wireMassPerLength(dmm / 1000, 7850);
        const c = Math.sqrt(T / rl);
        const f1 = c / (2 * L);
        const n = rng.pick([2, 3, 4]);
        return {
          prompt: `A steel wire (density 7850 kg/m³, diameter ${dmm} mm) is stretched between fixed supports ${n6(L)} m apart with a tension of ${T} N.`,
          givens: [
            { sym: 'd', value: `${dmm} mm` },
            { sym: '\\rho', value: '7850 kg/m³', label: 'density' },
            { sym: 'L', value: `${n6(L)} m` },
            { sym: 'T', value: `${T} N` },
          ],
          figure: stringFigure({ label: 'A wire fixed at both ends' }),
          parts: [
            num('rl', 'Mass per unit length $\\rho_l$', rl, 'kg/m', [{ value: 7850 * Math.PI * (dmm / 1000) ** 2, message: 'The area is $\\pi d^2/4$: you used the diameter as the radius.' }]),
            num('f1', 'Fundamental frequency $f_1$', f1, 'Hz', [
              { value: Math.sqrt(T / 7850) / (2 * L), message: 'That uses the density $\\rho$ (kg/m³). A string needs the mass per unit length $\\rho_l = \\rho\\pi d^2/4$ (kg/m).', trapId: 'b2-rho-vs-rhol' },
              { value: c / L, message: '$f_1 = c/2L$: half a wavelength fits between the supports.', trapId: 'factor2' },
              { value: c / (4 * L), message: '$c/4L$ is the fixed–free result; the wire is fixed at both ends.', trapId: 'b2-end-condition' },
            ], { freq: true }),
            num('fn', `Frequency of mode ${n}, $f_{${n}}$`, n * f1, 'Hz', [{ value: (2 * n - 1) * f1, message: 'Odd multiples belong to fixed–free ends; here $f_n = nf_1$.', trapId: 'b2-end-condition' }], { freq: true }),
          ],
          hints: [
            'A taut string carries transverse waves at $c = \\sqrt{T/\\rho_l}$, where $\\rho_l$ is the mass per unit **length**. Fixed at both ends, $f_n = nc/2L$.',
            '$\\rho_l = \\rho\\pi d^2/4$ (kg/m); $c = \\sqrt{T/\\rho_l}$; $f_1 = c/2L$; $f_n = nf_1$.',
            `$\\rho_l = 7850\\pi(${tex(dmm / 1000, 6)})^2/4 = ${t4(rl)}$ kg/m; $c = \\sqrt{${T}/(${t4(rl)})} = ${t4(c)}$ m/s.`,
            `$\\rho_l$ = **${f4(rl)} kg/m**; $f_1 = ${t4(c)}/(2 \\times ${n6(L)}) = $ **${f4(f1)} Hz**; $f_{${n}} = $ **${f4(n * f1)} Hz**. No $E$ appears: a thin wire behaves as a string, not a beam.`,
          ],
        };
      }
      if (tier === 2) {
        if (rng.chance(0.5)) {
          const dmm = rng.step(0.6, 2.0, 0.1);
          const f1 = rng.pick(NOTES);
          // The wire stress is T/A = 4 rho (L f1)^2: keep L f1 <= 220 m/s (below about 1.5 GPa).
          const L = rng.step(0.3, Math.max(0.3, Math.min(1.6, Math.floor(220 / f1 / 0.05 + 1e-9) * 0.05)), 0.05);
          const rl = wireMassPerLength(dmm / 1000, 7850);
          const T = 4 * rl * L * L * f1 * f1;
          return {
            prompt: `A piano wire (steel, density 7850 kg/m³, diameter ${dmm} mm) has a vibrating length of ${n6(L)} m between fixed ends. It must be tuned to a fundamental of ${f1} Hz.`,
            givens: [
              { sym: 'd', value: `${dmm} mm` },
              { sym: '\\rho', value: '7850 kg/m³' },
              { sym: 'L', value: `${n6(L)} m` },
              { sym: 'f_1', value: `${f1} Hz`, label: 'target' },
            ],
            figure: stringFigure({ label: 'A piano wire fixed at both ends' }),
            parts: [
              num('rl', 'Mass per unit length $\\rho_l$', rl, 'kg/m', [{ value: 7850 * Math.PI * (dmm / 1000) ** 2, message: 'The area is $\\pi d^2/4$: you used the diameter as the radius.' }]),
              num('T', 'Tension required $T$', T, 'N', [
                { value: 4 * 7850 * L * L * f1 * f1, message: 'That uses the density $\\rho$ (kg/m³) instead of $\\rho_l$ (kg/m).', trapId: 'b2-rho-vs-rhol' },
                { value: rl * (L * f1) ** 2, message: '$T = \\rho_l c^2$ with $c = 2Lf_1$: the 2 is squared too, giving $4\\rho_l L^2 f_1^2$.', trapId: 'factor2' },
                { value: 4 * rl * L * L * f1 * f1 * TAU * TAU, message: 'Use $f_1$ in Hz: $c = 2Lf_1$ (not $2L\\omega_1$).', trapId: 'units' },
              ]),
              num('f3', 'Third natural frequency $f_3$', 3 * f1, 'Hz', [{ value: 5 * f1, message: 'Fixed at both ends, the harmonics are $nf_1$: $f_3 = 3f_1$.', trapId: 'b2-end-condition' }], { freq: true }),
            ],
            hints: [
              'Invert the string formula: $f_1 = (1/2L)\\sqrt{T/\\rho_l}$, so the tuning tension is $T = \\rho_l c^2 = 4\\rho_l L^2 f_1^2$ (tutorial W7.1).',
              '$\\rho_l = \\rho\\pi d^2/4$; $T = 4\\rho_l L^2 f_1^2$; $f_n = nf_1$.',
              `$\\rho_l = 7850\\pi(${tex(dmm / 1000, 6)})^2/4 = ${t4(rl)}$ kg/m; $T = 4 \\times ${t4(rl)} \\times ${n6(L)}^2 \\times ${f1}^2$.`,
              `$\\rho_l$ = **${f4(rl)} kg/m**; $T = $ **${f4(T)} N**; $f_3 = 3 \\times ${f1} = $ **${f4(3 * f1)} Hz** (and $f_2$ = ${f4(2 * f1)} Hz).`,
            ],
          };
        }
        const T0 = rng.step(100, 900, 1);
        const p = rng.pick([-40, -30, -25, -20, -15, -10, 10, 15, 20, 25, 30, 50]);
        const dmm = rng.pick([1, 1.5, 2, 2.5]);
        const L = rng.step(2, 10, 0.5);
        const r = 1 + p / 100;
        const Tn = T0 * r * r;
        const word = p < 0 ? `lower its fundamental frequency by ${-p} %` : `raise its fundamental frequency by ${p} %`;
        return {
          prompt: `A steel wire (diameter ${dmm} mm, length ${L} m, fixed at both ends) carries a tension of ${T0} N. You want to ${word}.`,
          givens: [
            { sym: 'T_0', value: `${T0} N`, label: 'present tension' },
            { sym: 'd', value: `${dmm} mm` },
            { sym: 'L', value: `${L} m` },
          ],
          parts: [
            num('T', 'New tension $T$', Tn, 'N', [
              { value: T0 * r, message: '$f \\propto \\sqrt T$, so a frequency ratio $r$ needs a tension ratio $r^2$. Scaling the tension by $r$ changes $f$ by only $\\sqrt r$.', trapId: 'b2-tension-ratio' },
              { value: T0 * Math.sqrt(r), message: 'The square root is on the wrong side: $T \\propto f^2$.', trapId: 'sqrt' },
              { value: T0 * (1 - p / 100) ** 2, message: 'Check the direction: a higher frequency needs more tension.', trapId: 'sign' },
            ]),
            choice(rng, 'cancel', 'Did you need the wire’s diameter and length?', [
              { text: 'No: they cancel in $f_{new}/f_{old} = \\sqrt{T_{new}/T_{old}}$.', correct: true, why: 'Same wire, same length: only the tension changes.' },
              { text: 'Yes: $\\rho_l$ depends on $d$.', correct: false, why: 'It does, but it is the same before and after, so it cancels in the ratio.' },
              { text: 'Yes: $f$ depends on $L$.', correct: false, why: 'The length does not change, so it cancels too.' },
            ]),
          ],
          hints: [
            'For the same wire, $f_1 = (1/2L)\\sqrt{T/\\rho_l} \\propto \\sqrt T$: everything except the tension cancels in a ratio.',
            '$f_{new}/f_{old} = \\sqrt{T_{new}/T_{old}}$, so $T_{new} = T_{old}\\,(f_{new}/f_{old})^2$.',
            `$f_{new}/f_{old} = ${n6(r)}$, so $T_{new} = ${T0} \\times ${n6(r)}^2$.`,
            `$T_{new} = ${T0} \\times ${n6(r * r)} = $ **${f4(Tn)} N**. (Scaling $T$ by ${n6(r)} instead would change $f$ by only ${f3((Math.sqrt(r) - 1) * 100)} %: Week 7 Q1’s trap.)`,
          ],
        };
      }
      // tier 3: the same wire's axial (longitudinal) frequencies (W7.1(c)-(d))
      const dmm = rng.step(0.8, 1.6, 0.1);
      const f1 = rng.pick([110, 146.8, 196, 220, 261.6]);
      // Wire stress 4 rho (L f1)^2 below about 1.5 GPa (W7.1: 0.8 m at 220 Hz is 0.97 GPa).
      const L = rng.step(0.5, Math.min(1.4, Math.floor(220 / f1 / 0.05 + 1e-9) * 0.05), 0.05);
      const E = 210e9;
      const rho = 7850;
      const rl = wireMassPerLength(dmm / 1000, rho);
      const T = 4 * rl * L * L * f1 * f1;
      const cA = Math.sqrt(E / rho);
      const fA = cA / (2 * L);
      const ratio = fA / f1;
      return {
        prompt: `A steel piano wire ($E$ = 210 GPa, $\\rho$ = 7850 kg/m³, diameter ${dmm} mm, vibrating length ${n6(L)} m, fixed at both ends) is tuned so that its transverse fundamental is ${f1} Hz. The same wire can also vibrate longitudinally (axially), which affects the timbre.`,
        givens: [
          { sym: 'E', value: '210 GPa' },
          { sym: '\\rho', value: '7850 kg/m³' },
          { sym: 'd', value: `${dmm} mm` },
          { sym: 'L', value: `${n6(L)} m` },
          { sym: 'f_1', value: `${f1} Hz`, label: 'transverse' },
        ],
        parts: [
          num('T', 'Tension in the wire $T$', T, 'N', [{ value: 4 * rho * L * L * f1 * f1, message: 'Use $\\rho_l = \\rho\\pi d^2/4$ (kg/m), not $\\rho$.', trapId: 'b2-rho-vs-rhol' }]),
          num('fA', 'Fundamental axial (longitudinal) frequency $f_{A1}$', fA, 'Hz', [{ value: cA / (4 * L), message: 'The wire is held axially at both ends too: fixed–fixed, $c/2L$.', trapId: 'b2-end-condition' }], { freq: true }),
          num('ratio', 'Ratio $f_{A1}/f_1$ (axial to transverse)', ratio, '', [{ value: 1 / ratio, message: 'Inverted: the axial waves are far faster than the transverse ones.' }]),
          choice(rng, 'wrap', 'Copper wire is wound round the steel core: it adds mass per length but almost no axial stiffness. To keep the same transverse pitch the tension must…', [
            { text: 'rise in proportion to $\\rho_l$.', correct: true, why: '$f_1 = (1/2L)\\sqrt{T/\\rho_l}$: keeping $f_1$ fixed needs $T \\propto \\rho_l$ (tutorial W7.1(d)).' },
            { text: 'stay the same.', correct: false, why: 'Then $f_1$ would fall as $1/\\sqrt{\\rho_l}$.' },
            { text: 'rise with $\\sqrt{\\rho_l}$.', correct: false, why: 'The tension enters under the square root alongside $\\rho_l$, so it must scale with $\\rho_l$ itself.' },
            { text: 'fall.', correct: false, why: 'That lowers the pitch further.' },
          ]),
        ],
        hints: [
          'Two different waves on one wire: transverse waves are carried by the tension ($c = \\sqrt{T/\\rho_l}$), axial waves by the steel’s stiffness ($c_A = \\sqrt{E/\\rho}$). Both see fixed–fixed ends.',
          '$T = 4\\rho_l L^2 f_1^2$ with $\\rho_l = \\rho\\pi d^2/4$; $f_{A1} = c_A/2L$.',
          `$\\rho_l = ${t4(rl)}$ kg/m; $c_A = \\sqrt{210 \\times 10^9/7850} = ${t4(cA)}$ m/s.`,
          `$T = 4 \\times ${t4(rl)} \\times ${n6(L)}^2 \\times ${f1}^2 = $ **${f4(T)} N**; $f_{A1} = ${t4(cA)}/(2 \\times ${n6(L)}) = $ **${f4(fA)} Hz**, i.e. **${f4(ratio)}** times the transverse fundamental. The axial ladder is independent of $d$ and $T$.`,
        ],
      };
    },
  },

  // ------------------------------------------------------------------ pluck, touch and press
  {
    id: 'b2-pluck',
    title: 'Pluck, touch or press: which harmonics sound?',
    summary: 'Which modes a pluck excites, which a light touch keeps, and what a firm press does to the pitch.',
    tiers: [1, 2, 3],
    source: 'Similar to 2022 B1.2; recurs official 2019 B1.7(c)–(d), 2025 B1.7; LB2 Eq 2.11',
    cardId: 'b2-strings',
    marks: 3,
    generate(rng, tier) {
      const f1 = rng.pick(NOTES);
      if (tier === 1) {
        const k = rng.pick([2, 3, 4, 5]);
        const a = 1 / k;
        const D = pluckAmplitudes(a, 6);
        const m = k === 2 ? 3 : 2;
        const ratio = Math.abs(D[m - 1] / D[0]);
        const sinM = Math.abs(Math.sin(m * Math.PI * a));
        const sin1 = Math.sin(Math.PI * a);
        const options: ChoicePart['options'] =
          k === 2
            ? [
                { text: 'The even modes ($n$ = 2, 4, 6, …)', correct: true, why: 'They all have a node at mid-length: $\\sin(n\\pi/2) = 0$ for even $n$.' },
                { text: 'The odd modes ($n$ = 1, 3, 5, …)', correct: false, why: 'They have antinodes at the middle, so they are excited.' },
                { text: 'None: a pluck excites every mode', correct: false, why: 'A mode with a node at the pluck point gets no amplitude.' },
                { text: 'Every mode except the fundamental', correct: false, why: 'The fundamental has its antinode at the middle and is the strongest.' },
              ]
            : [
                { text: `Every ${ORD[k]} mode ($n$ = ${k}, ${2 * k}, ${3 * k}, …)`, correct: true, why: `$\\sin(n\\pi/${k}) = 0$ when $n$ is a multiple of ${k}: those modes have a node at the pluck point.` },
                { text: 'The even modes ($n$ = 2, 4, 6, …)', correct: false, why: `Mode 2’s node is at the middle, not at $L/${k}$, so mode 2 is excited ($D_2/D_1$ = ${f3(D[1] / D[0])}).` },
                { text: 'None: a pluck excites every mode', correct: false, why: 'A mode with a node at the pluck point gets no amplitude.' },
                { text: 'Every mode except the fundamental', correct: false, why: 'The fundamental is excited, and is the strongest.' },
              ];
        return {
          prompt: `A string fixed at both ends, tuned to $f_1$ = ${f1} Hz, is pulled aside at $a = L/${k}$ from one end and released from rest.`,
          givens: [
            { sym: 'a', value: `L/${k}`, label: 'pluck point' },
            { sym: 'f_1', value: `${f1} Hz` },
          ],
          figure: stringFigure({ pluck: a, label: `A string plucked at L/${k}` }),
          parts: [
            choice(rng, 'missing', 'Which modes are missing from the sound?', options),
            num('ratio', `Amplitude of mode ${m} relative to mode 1, $|D_${m}/D_1|$`, ratio, '', [
              { value: Math.abs(sinM / (m * sin1)), message: 'The amplitudes of a triangular pluck fall as $1/n^2$, not $1/n$.' },
              { value: 1 / (m * m), message: `Include $\\sin(n\\pi a/L)$: mode ${m}’s value at the pluck point, relative to mode 1’s.` },
            ]),
          ],
          hints: [
            'Released from rest, the initial triangle is a sum of the modes. Each modal amplitude is the projection of that shape on the mode (LB2 Eq 2.11), so a mode with a node at the pluck point gets nothing.',
            '$D_n \\propto \\dfrac{\\sin(n\\pi a/L)}{n^2}$, so $\\dfrac{D_n}{D_1} = \\dfrac{\\sin(n\\pi a/L)}{n^2\\sin(\\pi a/L)}$. Missing modes: $\\sin(n\\pi a/L) = 0$.',
            `$a/L = 1/${k}$: $\\sin(n\\pi/${k}) = 0$ for $n$ = ${k}, ${2 * k}, …; $D_${m}/D_1 = \\sin(${m}\\pi/${k})/(${m * m}\\sin(\\pi/${k}))$.`,
            `Missing: **modes ${k}, ${2 * k}, ${3 * k}, …** $|D_${m}/D_1| = ${t4(sinM)}/(${m * m} \\times ${t4(sin1)}) = $ **${f4(ratio)}**. The pitch is still ${f1} Hz: the pluck point only changes the mix of harmonics (the timbre).`,
          ],
        };
      }
      if (tier === 2) {
        const q = rng.pick([2, 3, 4]);
        const cands = FRAC_TEX.map(([a, s]) => {
          const sp = pluckSpectrum(a, 'touch', 1 / q, 48);
          return { a, s, low: lowestAlive(sp) };
        }).filter((x) => x.low && x.low.n <= 12);
        const pick = rng.pick(cands);
        const n = pick.low!.n;
        const sins = [q, 2 * q].map((m) => Math.sin(m * Math.PI * pick.a));
        return {
          prompt: `A string tuned to $f_1$ = ${f1} Hz is plucked at $${pick.s}$ and, just after release, touched lightly at $L/${q}$ (a light touch, not a press).`,
          givens: [
            { sym: 'f_1', value: `${f1} Hz` },
            { sym: 'a', value: pick.s, label: 'pluck point' },
            { sym: 'x_t', value: `L/${q}`, label: 'light touch' },
          ],
          figure: stringFigure({ pluck: pick.a, finger: { at: 1 / q, kind: 'touch' }, label: `A string plucked at ${pick.s} and touched at L/${q}` }),
          parts: [
            num('f', 'Lowest frequency you then hear', n * f1, 'Hz', [
              { value: f1, message: `A light touch at $L/${q}$ kills every mode without a node there, the fundamental included.`, trapId: 'b2-touch-vs-press' },
              { value: q * f1, message: `Mode ${q} has a node at the pluck point as well, so it was never excited: the lowest survivor is mode ${n}.`, trapId: 'node-no-effect' },
              // A firm press at L/q would leave the plucked segment sounding on its own: q f1 (short part) or q f1/(q - 1) (long part).
              { value: pick.a < 1 / q ? q * f1 : (f1 * q) / (q - 1), message: 'That treats the touch as a firm press (a new fixed end). A light touch only imposes a node.', trapId: 'b2-touch-vs-press' },
            ], { freq: true }),
            choice(rng, 'octave', `Which way of playing gives the octave, ${2 * f1} Hz, as the lowest tone?`, [
              { text: 'Pluck at $L/4$ and touch lightly at $L/2$.', correct: true, why: '$L/4$ excites mode 2 ($D_2/D_1$ = 0.354) and the touch at $L/2$ keeps only the even modes (2022 B1.2).' },
              { text: 'Pluck at $L/2$ and touch lightly at $L/4$.', correct: false, why: 'The mid-pluck has only odd modes; a touch at $L/4$ keeps only 4, 8, …: near silence.' },
              { text: 'Pluck at $L/2$ and touch lightly at $L/2$.', correct: false, why: 'The touch kills the odd modes and the mid-pluck never excited the even ones: silence.' },
              { text: 'Press firmly at $L/3$ and pluck the longer part.', correct: false, why: `A new string of length $2L/3$: ${f4(1.5 * f1)} Hz.` },
              { text: 'Pluck very close to one end without touching.', correct: false, why: `Bright, but the pitch is still ${f1} Hz.` },
            ]),
          ],
          hints: [
            'A light touch forces a node at the finger. Only modes that already have a node there survive (the others die away almost at once), and they must also have been excited by the pluck.',
            `A touch at $L/${q}$ keeps $n = ${q}, ${2 * q}, ${3 * q}, \\dots$; the pluck gives $D_n \\propto \\sin(n\\pi a/L)/n^2$. The lowest $n$ that is kept **and** excited sets the pitch $nf_1$.`,
            `Pluck at $${pick.s}$: $\\sin(${q}\\pi a/L) = ${t3(Math.abs(sins[0]) < 1e-9 ? 0 : sins[0])}$, $\\sin(${2 * q}\\pi a/L) = ${t3(Math.abs(sins[1]) < 1e-9 ? 0 : sins[1])}$.`,
            `The lowest mode that survives is **mode ${n}**, so you hear **${f4(n * f1)} Hz** (${n} × ${f1} Hz). The octave recipe is: pluck at $L/4$, touch at $L/2$.`,
          ],
        };
      }
      // q: a light touch at c keeps only the modes n = q, 2q, 3q, ... (c = p/q in lowest terms)
      const opt = rng.pick([
        { c: 1 / 3, s: 'L/3', q: 3, ls: '2L/3', up: '3/2' },
        { c: 1 / 4, s: 'L/4', q: 4, ls: '3L/4', up: '4/3' },
        { c: 2 / 5, s: '2L/5', q: 5, ls: '3L/5', up: '5/3' },
        { c: 1 / 5, s: 'L/5', q: 5, ls: '4L/5', up: '5/4' },
      ]);
      const len = 1 - opt.c;
      const a = opt.c + len / 2;
      const fLow = f1 / len;
      const fNext = (3 * f1) / len;
      const touch = lowestAlive(pluckSpectrum(a, 'touch', opt.c, 48));
      const touchText = touch ? `${f4(touch.ratio * f1)} Hz` : 'almost nothing: no plucked mode survives the touch';
      const q = opt.q;
      return {
        prompt: `A string tuned to $f_1$ = ${f1} Hz is pressed **firmly** against the fingerboard at $${opt.s}$ from one end, and the longer part is plucked at its middle.`,
        givens: [
          { sym: 'f_1', value: `${f1} Hz`, label: 'open string' },
          { sym: 'x_p', value: opt.s, label: 'firm press' },
        ],
        figure: stringFigure({ pluck: a, finger: { at: opt.c, kind: 'press' }, label: `A string pressed at ${opt.s} and plucked on the longer part` }),
        parts: [
          num('f', 'Lowest frequency that sounds', fLow, 'Hz', [
            { value: f1 / opt.c, message: 'That is the short part. The plucked part is the longer one, of length $(1 - c)L$.' },
            { value: f1 * len, message: 'A shorter string has a **higher** frequency: $f \\propto 1/L$.' },
            { value: q * f1, message: 'That treats the press as a light touch. A firm press makes a new fixed end: a shorter string with its own fundamental.', trapId: 'b2-touch-vs-press' },
          ], { freq: true }),
          num('f2', 'Next frequency that sounds above it', fNext, 'Hz', [{ value: (2 * f1) / len, message: 'Plucked at its own middle, the segment’s even modes have a node at the pluck point, so the next one heard is its 3rd mode.', trapId: 'node-no-effect' }], { freq: true }),
          choice(rng, 'touch', 'If you only touched the string lightly at the same point (and plucked at the same place), the lowest sound would be:', [
            { text: touchText, correct: true, why: touch ? `A light touch keeps only the modes with a node at $${opt.s}$; the lowest of those that the pluck excites is mode ${touch.n}.` : `A light touch keeps only modes ${q}, ${2 * q}, …, and every one of them has a node at the pluck point too.` },
            ...(touch ? [{ text: 'almost nothing: no plucked mode survives the touch', correct: false, why: `Mode ${touch.n} survives: it has a node at the finger but not at the pluck point.` }] : [{ text: `${f4(q * f1)} Hz`, correct: false, why: `Mode ${q} has a node at the finger but also at the pluck point, so it was never excited.` }]),
            { text: `${f4(fLow)} Hz, the same as pressing`, correct: false, why: 'A touch does not create a new fixed end, so it cannot give a non-harmonic of the open string.' },
            { text: `${f1} Hz: a light touch changes nothing`, correct: false, why: 'It kills every mode that lacks a node at the finger, the fundamental included.' },
          ]),
        ],
        hints: [
          'A firm press is a new fixed end: the plucked part becomes a shorter string of length $\\ell$, with $f = f_1 L/\\ell$ and its own harmonics. (A light touch would only impose a node.)',
          `$\\ell = L - ${opt.s} = ${opt.ls}$; plucked at its own middle it sounds only its odd modes: $f_1L/\\ell$, $3f_1L/\\ell$, …`,
          `$L/\\ell = ${opt.up}$, so the new fundamental is $f_1L/\\ell = ${f1} \\times ${opt.up}$, and the next is three times that.`,
          `Lowest: **${f4(fLow)} Hz**; next: **${f4(fNext)} Hz** (its 2nd mode has a node at the pluck point). A light touch at the same point would give ${touchText}.`,
        ],
      };
    },
  },

  // ------------------------------------------------------------------ rods and shafts
  {
    id: 'b2-rod-shaft',
    title: 'Rods and shafts: material, end conditions, axial vs torsion',
    summary: 'Axial and torsional frequencies from $\\sqrt{E/\\rho}$ and $\\sqrt{G/\\rho}$, the end conditions, and what changes when an end is fixed.',
    tiers: [1, 2, 3],
    source: 'Similar to tutorial W7.2 (rocket tube) and Reader SP2 (drill rod); official 2016 B1.6, 2019 B1.5–1.6',
    cardId: 'b2-bcs',
    marks: 5,
    generate(rng, tier) {
      if (tier === 1) {
        const mat = rng.pick(MATERIALS);
        const bc = rng.pick<WaveBC>(['fixed-fixed', 'fixed-free', 'free-free']);
        const L = rng.step(0.5, 12, 0.5);
        const c = Math.sqrt(mat.E / mat.rho);
        const [w1, w2] = waveOmegas(bc, c, L, 2);
        const f1 = w1 / TAU;
        const f2 = w2 / TAU;
        const ff = bc === 'fixed-free';
        return {
          prompt: `A uniform ${mat.label.toLowerCase()} bar ($E$ = ${mat.E / 1e9} GPa, $\\rho$ = ${mat.rho} kg/m³), ${L} m long, is ${BC_TEXT[bc]}. Consider its axial (longitudinal) vibration${bc === 'free-free' ? ' and ignore the rigid-body mode' : ''}.`,
          givens: [
            { sym: 'E', value: `${mat.E / 1e9} GPa` },
            { sym: '\\rho', value: `${mat.rho} kg/m³` },
            { sym: 'L', value: `${L} m` },
          ],
          figure: shaftFigure({ left: bc === 'free-free' ? 'free' : 'fixed', right: bc === 'fixed-fixed' ? 'fixed' : 'free', label: `A bar ${BC_TEXT[bc]}` }),
          parts: [
            num('c', 'Axial wave speed $c$', c, 'm/s', [{ value: c * torsionAxialRatio(mat.nu), message: 'That is the torsional speed $\\sqrt{G/\\rho}$. Axial waves use $E$.', trapId: 'b2-E-vs-G' }]),
            num('f1', bc === 'free-free' ? 'Lowest non-zero natural frequency $f_1$' : 'Fundamental frequency $f_1$', f1, 'Hz', [
              ff
                ? { value: c / (2 * L), message: '$c/2L$ is for fixed–fixed (or free–free) ends. One free end fits a quarter-wave: $c/4L$.', trapId: 'b2-end-condition' }
                : { value: c / (4 * L), message: '$c/4L$ is the fixed–free result. With both ends alike the fundamental is a half-wave: $c/2L$.', trapId: 'b2-end-condition' },
            ], { freq: true }),
            num('f2', 'Second natural frequency $f_2$', f2, 'Hz', [
              ff ? { value: 2 * f1, message: 'Fixed–free modes go 1 : 3 : 5, so $f_2 = 3f_1$.', trapId: 'b2-end-condition' } : { value: 3 * f1, message: 'Odd multiples are for fixed–free ends; here $f_2 = 2f_1$.', trapId: 'b2-end-condition' },
            ], { freq: true }),
          ],
          hints: [
            'Axial waves in a rod travel at $c = \\sqrt{E/\\rho}$ (independent of the cross-section); the end conditions decide which wavelengths fit.',
            `${BC_FORMULA[bc]}.`,
            `$c = \\sqrt{${t4(mat.E)}/${mat.rho}} = ${t4(c)}$ m/s.`,
            `$c$ = **${f4(c)} m/s**; $f_1$ = **${f4(f1)} Hz**; $f_2$ = **${f4(f2)} Hz** (ratio ${f3(f2 / f1)}).`,
          ],
        };
      }
      if (tier === 2) {
        const mat = rng.pick(MATERIALS);
        const L = rng.step(20, 80, 5);
        const dOut = rng.step(2, 5, 0.5);
        const dIn = Number((dOut - rng.step(0.2, 1, 0.1)).toFixed(2));
        const cA = Math.sqrt(mat.E / mat.rho);
        const k = torsionAxialRatio(mat.nu);
        const fA = cA / (2 * L);
        const fT = fA * k;
        const pct = (k - 1) * 100;
        return {
          prompt: `A rocket body is modelled as a uniform ${mat.label.toLowerCase()} tube ($E$ = ${mat.E / 1e9} GPa, $\\rho$ = ${mat.rho} kg/m³, $\\nu$ = ${mat.nu}; outer diameter ${dOut} m, inner diameter ${dIn} m), ${L} m long and completely free at both ends in flight.`,
          givens: [
            { sym: 'E', value: `${mat.E / 1e9} GPa` },
            { sym: '\\rho', value: `${mat.rho} kg/m³` },
            { sym: '\\nu', value: `${mat.nu}` },
            { sym: 'L', value: `${L} m` },
            { sym: 'd_o, d_i', value: `${dOut} m, ${dIn} m` },
          ],
          figure: shaftFigure({ left: 'free', right: 'free', label: 'A free–free tube' }),
          parts: [
            num('fA', 'Lowest non-zero axial frequency $f_{A1}$', fA, 'Hz', [{ value: cA / (4 * L), message: 'Free–free fits a half-wave: $c/2L$ (the zero-frequency mode is the rigid-body motion).', trapId: 'b2-end-condition' }], { freq: true }),
            num('fT', 'Lowest non-zero torsional frequency $f_{T1}$', fT, 'Hz', [
              { value: fA, message: 'That is the axial value. Torsion uses $G = E/2(1+\\nu)$, so $c_T = \\sqrt{G/\\rho}$.', trapId: 'b2-E-vs-G' },
              { value: Math.sqrt(mat.E / (1 + mat.nu) / mat.rho) / (2 * L), message: '$G = E/2(1+\\nu)$: the factor 2 is missing.', trapId: 'factor2' },
            ], { freq: true }),
            num('pct', 'Change from the axial to the torsional fundamental', pct, '%', [{ value: (1 / k - 1) * 100, message: 'Express it relative to the axial value: $(f_T - f_A)/f_A$.' }]),
          ],
          hints: [
            'Free at both ends: $f_n = nc/2L$ for both axial ($c = \\sqrt{E/\\rho}$) and torsional ($c = \\sqrt{G/\\rho}$) vibration. The diameters cancel for a uniform tube.',
            '$f_{A1} = \\sqrt{E/\\rho}/2L$; $G = E/2(1+\\nu)$; $f_{T1}/f_{A1} = \\sqrt{G/E} = 1/\\sqrt{2(1+\\nu)}$.',
            `$c_A = ${t4(cA)}$ m/s; $1/\\sqrt{2(1 + ${mat.nu})} = ${t4(k)}$.`,
            `$f_{A1}$ = **${f4(fA)} Hz**; $f_{T1}$ = **${f4(fT)} Hz**; change = **${f4(pct)} %**. Torsion is always lower because $G < E$; the diameters were not needed.`,
          ],
        };
      }
      const ft1 = rng.step(5, 40, 0.5);
      const nu = rng.pick([0.25, 0.28, 0.3, 0.33]);
      const k = Math.sqrt(2 * (1 + nu));
      return {
        prompt: `A cantilevered drill rod ($\\nu$ = ${nu}) is fixed at the rig and free at the bit. Its first torsional natural frequency is measured as ${ft1} Hz. The bit then jams in hard rock, which fixes that end too.`,
        givens: [
          { sym: 'f_{T1}', value: `${ft1} Hz`, label: 'measured, fixed–free' },
          { sym: '\\nu', value: `${nu}` },
        ],
        figure: shaftFigure({ left: 'fixed', right: 'fixed', label: 'The drill rod after the bit jams: fixed at both ends' }),
        parts: [
          num('fT', 'First torsional frequency after the bit jams', 2 * ft1, 'Hz', [{ value: ft1, message: 'Fixing the bit end changes fixed–free ($c/4L$) to fixed–fixed ($c/2L$): the fundamental doubles.', trapId: 'b2-end-condition' }], { freq: true }),
          num('fA', 'First axial frequency after the bit jams', 2 * ft1 * k, 'Hz', [
            { value: (2 * ft1) / k, message: 'Inverted: axial waves are faster, $c_A = c_T\\sqrt{2(1+\\nu)}$.', trapId: 'b2-E-vs-G' },
            { value: ft1 * k, message: 'That is the axial fundamental **before** the bit jammed (fixed–free).', trapId: 'b2-end-condition' },
          ], { freq: true }),
          choice(rng, 'shape', 'The axial mode shapes after the bit jams are:', [
            { text: '$\\sin(n\\pi x/L)$', correct: true, why: 'Fixed–fixed: zero displacement at both ends.' },
            { text: '$\\sin((2n-1)\\pi x/2L)$', correct: false, why: 'That is fixed–free, the state before the bit jammed.' },
            { text: '$\\cos(n\\pi x/L)$', correct: false, why: 'That is free–free.' },
          ]),
        ],
        hints: [
          'The measured torsional frequency gives $c_T/L$. The axial speed follows from $c_A/c_T = \\sqrt{E/G} = \\sqrt{2(1+\\nu)}$. Then apply the new end conditions.',
          'Before: fixed–free, $f_{T1} = c_T/4L$, so $c_T/L = 4f_{T1}$. After: fixed–fixed, $f_n = nc/2L$.',
          `$c_T/L = 4 \\times ${ft1} = ${t4(4 * ft1)}$ Hz; $c_A/L = ${t4(4 * ft1)} \\times \\sqrt{2(1 + ${nu})} = ${t4(4 * ft1 * k)}$ Hz.`,
          `Torsion after: $c_T/2L$ = **${f4(2 * ft1)} Hz**; axial after: $f_{A,n} = n\\,c_A/2L$ = $n \\times$ **${f4(2 * ft1 * k)} Hz**, with shapes $\\sin(n\\pi x/L)$ (Reader SP2: 10 Hz and ν = 0.3 give $n \\times 32.25$ Hz).`,
        ],
      };
    },
  },

  // ------------------------------------------------------------------ torsional critical speed
  {
    id: 'b2-critical-speed',
    title: 'Torsional critical speed → shaft length and frequencies',
    summary: 'From a measured torsional critical speed (rpm) to the shaft length and its higher torsional modes, with the right $G$ and end conditions.',
    tiers: [1, 2, 3],
    source: 'Similar to 2024 B2.1–2.3, 2025 B2.2 and 2023 B2.3',
    cardId: 'b2-bcs',
    marks: 8,
    generate(rng, tier) {
      if (tier === 1) {
        const mat = rng.pick(MATERIALS);
        const L = rng.step(4, 25, 0.5);
        const G = mat.E / (2 * (1 + mat.nu));
        const c = Math.sqrt(G / mat.rho);
        const f1 = c / (2 * L);
        return {
          prompt: `A uniform ${mat.label.toLowerCase()} shaft ($E$ = ${mat.E / 1e9} GPa, $\\nu$ = ${mat.nu}, $\\rho$ = ${mat.rho} kg/m³), ${L} m long, runs between two very heavy rotors that can be treated as torsionally fixed.`,
          givens: [
            { sym: 'E', value: `${mat.E / 1e9} GPa` },
            { sym: '\\nu', value: `${mat.nu}` },
            { sym: '\\rho', value: `${mat.rho} kg/m³` },
            { sym: 'L', value: `${L} m` },
          ],
          figure: shaftFigure({ left: 'fixed', right: 'fixed', label: 'A shaft between two torsionally fixed rotors' }),
          parts: [
            num('G', 'Shear modulus $G$', G / 1e9, 'GPa', [{ value: mat.E / (1 + mat.nu) / 1e9, message: '$G = E/2(1+\\nu)$: the factor 2 is missing.', trapId: 'factor2' }]),
            num('c', 'Torsional wave speed $c$', c, 'm/s', [{ value: Math.sqrt(mat.E / mat.rho), message: 'That is the axial speed $\\sqrt{E/\\rho}$. Torsion uses $G$.', trapId: 'b2-E-vs-G' }]),
            num('N1', 'First torsional critical speed', 60 * f1, 'rpm', [{ value: (60 * c) / (4 * L), message: '$c/4L$ is fixed–free. Both rotors are fixed: $f_1 = c/2L$.', trapId: 'b2-end-condition' }], { freq: true }),
          ],
          hints: [
            'A critical speed is a natural frequency expressed as a rotation speed. Torsional waves travel at $c = \\sqrt{G/\\rho}$; with both ends fixed $f_n = nc/2L$.',
            '$G = E/2(1+\\nu)$; $c = \\sqrt{G/\\rho}$; $f_1 = c/2L$; rpm $= 60f_1$.',
            `$G = ${mat.E / 1e9}/(2 \\times ${n6(1 + mat.nu)}) = ${t4(G / 1e9)}$ GPa; $c = \\sqrt{${t4(G)}/${mat.rho}} = ${t4(c)}$ m/s.`,
            `$G$ = **${f4(G / 1e9)} GPa**; $c$ = **${f4(c)} m/s**; $f_1 = ${t4(c)}/(2 \\times ${L}) = ${t4(f1)}$ Hz, i.e. **${f4(60 * f1)} rpm**.`,
          ],
        };
      }
      if (tier === 2) {
        const mat = MATERIALS[0];
        const both = rng.chance(0.6);
        const N1 = both ? rng.step(3000, 9000, 100) : rng.step(1500, 6000, 100);
        const d = rng.step(0.3, 1.2, 0.1);
        const G = mat.E / (2 * (1 + mat.nu));
        const c = Math.sqrt(G / mat.rho);
        const f1 = N1 / 60;
        const L = both ? c / (2 * f1) : c / (4 * f1);
        const k2 = both ? 2 : 3;
        const k3 = both ? 3 : 5;
        const stepRatio = steppedShaftF1Ratio(0.6, 1.2 ** 3);
        const parts: SolvePart[] = [
          num('L', 'Shaft length $L$', L, 'm', [
            { value: both ? c / (4 * f1) : c / (2 * f1), message: both ? 'That uses fixed–free ($L = c/4f_1$). With both rotors fixed, $f_1 = c/2L$, so $L = c/2f_1$.' : 'That uses fixed–fixed. One end is free, so $f_1 = c/4L$ and $L = c/4f_1$.', trapId: 'b2-end-condition' },
            { value: Math.sqrt(mat.E / mat.rho) / ((both ? 2 : 4) * f1), message: 'That uses the axial speed $\\sqrt{E/\\rho}$. Torsion uses $G = E/2(1+\\nu)$.', trapId: 'b2-E-vs-G' },
          ]),
          num('f2', 'Second torsional natural frequency $f_2$', k2 * f1, 'Hz', [{ value: (both ? 3 : 2) * f1, message: both ? 'Fixed–fixed gives every harmonic: $f_2 = 2f_1$.' : 'Fixed–free gives odd multiples: $f_2 = 3f_1$.', trapId: 'b2-end-condition' }], { freq: true }),
          num('f3', 'Third torsional natural frequency $f_3$', k3 * f1, 'Hz', [{ value: (both ? 5 : 3) * f1, message: both ? 'Fixed–fixed: $f_3 = 3f_1$.' : 'Fixed–free: $f_3 = 5f_1$.', trapId: 'b2-end-condition' }], { freq: true }),
          both
            ? choice(rng, 'step', 'Only the connecting section (the 40 % of the length next to the generator) is enlarged, to 1.2 times the diameter with the same wall thickness. The first torsional critical speed…', [
                { text: `rises slightly (about ${f3((stepRatio - 1) * 100)} %).`, correct: true, why: `It becomes a stepped shaft. Next to a fixed end that section twists little but strains a lot, so it adds more stiffness than inertia: $(1+n)\\sin kL = (n-1)\\sin((1-2\\alpha)kL)$ with $\\alpha$ = 0.6 and $n = J_{cs}/J_b = 1.2^3$ (thin tube, $J \\approx \\pi d^3 t/4$) gives ×${f4(stepRatio)} (2024 B2.3).` },
                { text: 'is unchanged, because torsional frequencies never depend on the diameter.', correct: false, why: 'That holds for a uniform shaft only. Enlarging part of it makes a stepped shaft.' },
                { text: 'falls, because the enlarged section adds inertia.', correct: false, why: 'It adds stiffness too, and in that region the stiffness wins.' },
                { text: 'rises by 20 %, in proportion to the diameter.', correct: false, why: `Far less: ×${f4(stepRatio)}, and at most ×1.25 however large the section.` },
              ])
            : choice(rng, 'diam', 'The shaft is replaced by a uniform shaft of twice the diameter (same material and length). The first torsional critical speed…', [
                { text: 'is unchanged.', correct: true, why: 'Uniform shaft: $J$ multiplies both $GJ$ and $\\rho J$, so it cancels.' },
                { text: 'doubles.', correct: false, why: 'Bending frequencies of a tube scale with $d$; torsional ones do not.' },
                { text: 'rises 16-fold, because $J \\propto d^4$.', correct: false, why: 'The inertia $\\rho J$ rises 16-fold too.' },
                { text: 'halves, because the shaft is heavier.', correct: false, why: 'The stiffness rises in the same proportion as the inertia.' },
              ]),
        ];
        return {
          prompt: both
            ? `A thin-walled tubular steel shaft ($E$ = 210 GPa, $\\nu$ = 0.3, $\\rho$ = 7850 kg/m³, diameter ${d} m) connects a generator rotor to a turbine rotor. Commissioning tests measure its first torsional critical speed at ${N1} rpm. Treat both rotors as torsionally fixed (their inertias are far larger than the shaft’s).`
            : `A hollow steel drive shaft ($E$ = 210 GPa, $\\nu$ = 0.3, $\\rho$ = 7850 kg/m³, diameter ${d} m) is clamped to a very heavy flywheel at one end; the other end carries nothing. Its first torsional critical speed is measured at ${N1} rpm.`,
          givens: [
            { sym: 'E', value: '210 GPa' },
            { sym: '\\nu', value: '0.3' },
            { sym: '\\rho', value: '7850 kg/m³' },
            { sym: 'd', value: `${d} m` },
            { sym: 'N_1', value: `${N1} rpm`, label: 'first torsional critical speed' },
          ],
          figure: shaftFigure({ left: 'fixed', right: both ? 'fixed' : 'free', label: both ? 'A shaft between two fixed rotors' : 'A shaft fixed at one end, free at the other' }),
          parts,
          hints: [
            `A critical speed is a natural frequency: $f_1 = N_1/60$. The torsional wave speed $\\sqrt{G/\\rho}$ is known, so the length follows from the ${both ? 'fixed–fixed' : 'fixed–free'} formula. The diameter is not needed.`,
            both ? '$G = E/2(1+\\nu)$, $c = \\sqrt{G/\\rho}$; fixed–fixed $f_n = nc/2L \\Rightarrow L = c/2f_1$; $f_n = nf_1$.' : '$G = E/2(1+\\nu)$, $c = \\sqrt{G/\\rho}$; fixed–free $f_n = (2n-1)c/4L \\Rightarrow L = c/4f_1$; $f_n = (2n-1)f_1$.',
            `$f_1 = ${N1}/60 = ${t4(f1)}$ Hz; $G = ${t4(G / 1e9)}$ GPa; $c = ${t4(c)}$ m/s.`,
            `$L = ${t4(c)}/(${both ? 2 : 4} \\times ${t4(f1)}) = $ **${f4(L)} m**; $f_2$ = **${f4(k2 * f1)} Hz**, $f_3$ = **${f4(k3 * f1)} Hz** (${f4(60 * k2 * f1)} and ${f4(60 * k3 * f1)} rpm). Mode shapes: ${both ? '$\\sin(n\\pi x/L)$, zero twist and maximum torque at both rotors' : '$\\sin((2n-1)\\pi x/2L)$, zero twist at the flywheel and zero slope at the free end'}.`,
          ],
        };
      }
      const G = rng.step(3.5, 6.5, 0.05);
      const E = rng.step(12, 22, 0.1);
      const rho = rng.step(1600, 2000, 10);
      const L = rng.step(30, 100, 0.2);
      const c = Math.sqrt((G * 1e9) / rho);
      const f1 = c / (4 * L);
      const cWrong = Math.sqrt((E * 1e9) / 2.6 / rho);
      return {
        prompt: `A wind-turbine blade’s composite support tube ($\\rho$ = ${rho} kg/m³, $E$ = ${n6(E)} GPa, $G$ = ${n6(G)} GPa) is ${n6(L)} m long, fixed at the hub and free at the tip. Find its torsional critical speeds.`,
        givens: [
          { sym: '\\rho', value: `${rho} kg/m³` },
          { sym: 'E', value: `${n6(E)} GPa` },
          { sym: 'G', value: `${n6(G)} GPa`, label: 'given (composite)' },
          { sym: 'L', value: `${n6(L)} m` },
        ],
        figure: shaftFigure({ left: 'fixed', right: 'free', label: 'A blade tube fixed at the hub, free at the tip' }),
        parts: [
          num('f1', 'First torsional natural frequency $f_1$', f1, 'Hz', [
            { value: cWrong / (4 * L), message: 'Use the **given** $G$. A composite is not isotropic, so $G \\ne E/2(1+\\nu)$ (2023 B2.3 trap).', trapId: 'b2-E-vs-G' },
            { value: c / (2 * L), message: 'Fixed at the hub only: fixed–free, $f_1 = c/4L$.', trapId: 'b2-end-condition' },
            { value: Math.sqrt((E * 1e9) / rho) / (4 * L), message: 'That uses $E$. Torsion uses $G$.', trapId: 'b2-E-vs-G' },
          ], { freq: true }),
          num('f3', 'Third torsional natural frequency $f_3$', 5 * f1, 'Hz', [{ value: 3 * f1, message: 'Fixed–free modes go 1 : 3 : 5: $f_3 = 5f_1$.', trapId: 'b2-end-condition' }], { freq: true }),
          num('N2', 'Second torsional critical speed', 60 * 3 * f1, 'rpm', [{ value: 60 * 2 * f1, message: 'Fixed–free: $f_2 = 3f_1$.', trapId: 'b2-end-condition' }], { freq: true }),
          choice(rng, 'axis', 'The aerodynamic load is modelled as a transverse force through the tube’s axis. Does it excite the torsional modes?', [
            { text: 'No: a force through the axis has no moment about it.', correct: true, why: 'Torsional modes need a torque; an offset force (force × arm) would excite them, except at their nodes (2024/2025 B1.6(e)).' },
            { text: 'Yes, every torsional mode.', correct: false, why: 'Only a torque does work on a twist.' },
            { text: 'Only the first torsional mode.', correct: false, why: 'It applies no torque at all.' },
            { text: 'Only when its frequency equals a torsional frequency.', correct: false, why: 'Without a torque there is no modal force, even at resonance.' },
          ]),
        ],
        hints: [
          'Torsion of a uniform tube: $c = \\sqrt{G/\\rho}$ with the **given** $G$ (do not recompute it from $E$ for a composite). Fixed at the hub, free at the tip: $f_n = (2n-1)c/4L$.',
          '$c = \\sqrt{G/\\rho}$; $f_1 = c/4L$, $f_2 = 3f_1$, $f_3 = 5f_1$; rpm $= 60f$.',
          `$c = \\sqrt{${n6(G)} \\times 10^9/${rho}} = ${t4(c)}$ m/s; $f_1 = ${t4(c)}/(4 \\times ${n6(L)})$.`,
          `$f_1$ = **${f4(f1)} Hz**; $f_3 = 5f_1$ = **${f4(5 * f1)} Hz**; second critical speed $60 \\times 3f_1$ = **${f4(180 * f1)} rpm**. The tube diameter and thickness do not enter. (With $G = E/2.6$ you would get ${f4(cWrong / (4 * L))} Hz.)`,
        ],
      };
    },
  },

  // ------------------------------------------------------------------ shaft with an end inertia
  {
    id: 'b2-shaft-disc',
    title: 'Shaft with an end inertia ($z\\tan z = I_a/I_e$)',
    summary: 'A disc, rotor or geared motor at the free end: the SDOF estimate, the exact root, and the 2021 hybrid half-axle.',
    tiers: [1, 2, 3],
    source: 'Similar to 2021 B2.4–2.5; Reader Sample Problem 6(b); Week 10 Q3',
    cardId: 'b2-end-inertia',
    marks: 6,
    generate(rng, tier) {
      const G = 80e9;
      const rho = 7700;
      if (tier === 1) {
        const dmm = rng.step(20, 100, 5);
        const L = rng.step(0.3, 2, 0.1);
        const Ie = rng.step(5, 80, 1);
        const J = polarMoment(dmm / 1000);
        const kt = (G * J) / L;
        const Ia = rho * J * L;
        const f = Math.sqrt(kt / Ie) / TAU;
        const fR = Math.sqrt(kt / (Ie + Ia / 3)) / TAU;
        return {
          prompt: `A solid steel shaft ($G$ = 80 GPa, $\\rho$ = 7700 kg/m³, diameter ${dmm} mm, length ${n6(L)} m) is fixed at one end and carries a flywheel of polar inertia $I_e$ = ${Ie} kg m² at the other. The flywheel is much heavier than the shaft.`,
          givens: [
            { sym: 'G', value: '80 GPa' },
            { sym: 'd', value: `${dmm} mm` },
            { sym: 'L', value: `${n6(L)} m` },
            { sym: 'I_e', value: `${Ie} kg m²` },
          ],
          figure: shaftFigure({ left: 'fixed', right: 'disc', label: 'A shaft fixed at one end with a flywheel at the other' }),
          parts: [
            num('J', 'Polar second moment of area $J$', J, 'm⁴', [{ value: (Math.PI * (dmm / 1000) ** 4) / 64, message: '$\\pi d^4/64$ is the bending second moment $I$. Torsion uses the polar $J = \\pi d^4/32$.', trapId: 'factor2' }]),
            num('kt', 'Torsional stiffness $k_t$', kt, 'N m/rad', [{ value: G * J, message: '$k_t = GJ/L$: divide by the length.' }]),
            num('f', 'Approximate fundamental frequency $f_1$', f, 'Hz', [{ value: Math.sqrt(kt / Ie), message: 'That is $\\omega$ in rad/s; divide by $2\\pi$ for Hz.', trapId: 'units' }], { freq: true }),
          ],
          hints: [
            'When the flywheel is much heavier than the shaft, the shaft acts as a massless torsional spring and the flywheel as the inertia: an SDOF torsional oscillator.',
            '$J = \\pi d^4/32$; $k_t = GJ/L$; $\\omega_1 \\approx \\sqrt{k_t/I_e}$, $f_1 = \\omega_1/2\\pi$.',
            `$J = \\pi(${n6(dmm / 1000)})^4/32 = ${t4(J)}$ m⁴; $k_t = 80 \\times 10^9 \\times ${t4(J)}/${n6(L)}$.`,
            `$J$ = **${f4(J)} m⁴**; $k_t$ = **${f4(kt)} N m/rad**; $f_1 \\approx \\sqrt{${t4(kt)}/${Ie}}/2\\pi = $ **${f4(f)} Hz**. Check: the shaft’s own inertia $I_a = \\rho JL$ = ${f3(Ia)} kg m² is ${f3((Ia / Ie) * 100)} % of $I_e$; $\\sqrt{k_t/(I_e + I_a/3)}$ gives ${f4(fR)} Hz.`,
          ],
        };
      }
      if (tier === 2) {
        const dmm = rng.step(40, 200, 10);
        const L = rng.step(0.3, 1.5, 0.1);
        const J = polarMoment(dmm / 1000);
        const Ia = rho * J * L;
        const target = rng.pick([0.02, 0.05, 0.1, 0.2, 0.5, 1]);
        const Ie = rng.nice(Ia / target, 2);
        const mu = Ia / Ie;
        const c = Math.sqrt(G / rho);
        const z1 = endInertiaRoots(mu, 1)[0];
        const f1 = (z1 * c) / (TAU * L);
        const it = endInertiaNewton(mu, 2);
        return {
          prompt: `A solid steel shaft ($G$ = 80 GPa, $\\rho$ = 7700 kg/m³, diameter ${dmm} mm, length ${n6(L)} m) is fixed at one end and carries a disc of polar inertia $I_e$ = ${fmt(Ie, 3)} kg m² at the other. Find the fundamental torsional frequency **without** treating the shaft as massless.`,
          givens: [
            { sym: 'G', value: '80 GPa' },
            { sym: '\\rho', value: '7700 kg/m³' },
            { sym: 'd', value: `${dmm} mm` },
            { sym: 'L', value: `${n6(L)} m` },
            { sym: 'I_e', value: `${fmt(Ie, 3)} kg m²` },
          ],
          figure: shaftFigure({ left: 'fixed', right: 'disc', label: 'A shaft fixed at one end with a disc at the other' }),
          parts: [
            num('Ia', 'Shaft polar inertia $I_a = \\rho JL$', Ia, 'kg m²', [{ value: rho * ((Math.PI * (dmm / 1000) ** 4) / 64) * L, message: 'Use the polar $J = \\pi d^4/32$.', trapId: 'factor2' }]),
            num('z1', 'Lowest root $z_1$ of $z\\tan z = I_a/I_e$', z1, '', [
              { value: Math.PI / 2, message: '$\\pi/2$ is the root with no disc (fixed–free).', trapId: 'b2-end-condition' },
              { value: Math.sqrt(mu), message: '$\\sqrt{I_a/I_e}$ is the massless-shaft estimate. Solve $z\\tan z = \\mu$ itself (it is a little lower).' },
            ]),
            num('f1', 'Fundamental torsional frequency $f_1$', f1, 'Hz', [
              { value: c / (4 * L), message: 'That is the bare shaft ($c/4L$); the disc lowers it.', trapId: 'b2-end-condition' },
              { value: c / (2 * L), message: 'A heavy disc is **not** a fixed end: it creates a new, lower fundamental.', trapId: 'b2-heavy-end-not-fixed' },
              { value: Math.sqrt((G * J) / L / Ie) / TAU, message: 'That is $\\sqrt{k_t/I_e}$, the massless-shaft estimate, which is slightly high.', trapId: 'bounds-order' },
            ], { freq: true }),
          ],
          hints: [
            'The disc makes the free-end condition $I_e\\ddot\\theta = -GJ\\,\\partial\\theta/\\partial x$. With $\\Theta = A\\sin(\\omega x/c)$ this gives $z\\tan z = I_a/I_e$, $z = \\omega L/c$ (summary notes B2; Reader SP6).',
            '$J = \\pi d^4/32$, $I_a = \\rho JL$, $\\mu = I_a/I_e$; solve $z\\tan z = \\mu$ for $z_1 \\in (0, \\pi/2)$; $f_1 = z_1 c/(2\\pi L)$ with $c = \\sqrt{G/\\rho}$.',
            `$J = ${t4(J)}$ m⁴, $I_a = ${t4(Ia)}$ kg m², $\\mu = ${t4(mu)}$; start $z_0 = \\sqrt{\\mu/(1 + \\mu/3)} = ${t4(it[0])}$, Newton: ${t4(it[1])}, ${t4(it[2])}; $c = ${t4(c)}$ m/s.`,
            `$I_a$ = **${f4(Ia)} kg m²**; $z_1$ = **${f4(z1)}**; $f_1 = ${t4(z1)} \\times ${t4(c)}/(2\\pi \\times ${n6(L)}) = $ **${f4(f1)} Hz**, against ${f4(c / (4 * L))} Hz for the bare shaft (${f3((z1 / (Math.PI / 2) - 1) * 100)} %).`,
          ],
        };
      }
      const NRNS = rng.step(2.2, 3, 0.1);
      const GR2 = rng.step(2.5, 4, 0.1);
      const GRW = rng.step(0.25, 0.45, 0.01);
      const a1 = rng.int(2, 8);
      const a2 = rng.int(3, 10);
      const IeffR = halfAxleIeffRatio(NRNS, GR2, GRW, a1, a2);
      const mu = 2 / IeffR;
      const z1 = endInertiaRoots(mu, 1)[0];
      const ratio = z1 / (Math.PI / 2);
      const zFull = endInertiaRoots(1 / IeffR, 1)[0];
      const it = endInertiaNewton(mu, 1);
      return {
        prompt: `A hybrid car’s solid half-axle (torsional stiffness $k_t$, polar inertia $I_a$) is fixed at the wheel. With the engine off, two motor-generators drive it through gears: MG1 (inertia $${a1}I_a$) turns $N_R/(N_S G_{RW})$ times as fast as the axle and MG2 (inertia $${a2}I_a$) turns $G_{R2}/G_{RW}$ times as fast, with $N_R/N_S$ = ${n6(NRNS)}, $G_{R2}$ = ${n6(GR2)} and $G_{RW}$ = ${n6(GRW)}. Each half-axle carries half of the effective inertia $I_{eff}$ at its differential end.`,
        givens: [
          { sym: 'N_R/N_S', value: n6(NRNS) },
          { sym: 'G_{R2}', value: n6(GR2) },
          { sym: 'G_{RW}', value: n6(GRW) },
          { sym: 'I_{MG1}/I_a,\\ I_{MG2}/I_a', value: `${a1}, ${a2}` },
          { sym: 'I_e/I_{eff}', value: '0.5', label: 'per half-axle' },
        ],
        figure: shaftFigure({ left: 'fixed', right: 'disc', label: 'A half-axle fixed at the wheel with the reflected motor inertia at the differential', note: 'half-axle' }),
        parts: [
          num('Ieff', 'Effective motor inertia $I_{eff}/I_a$', IeffR, '', [
            { value: (NRNS / GRW) * a1 + (GR2 / GRW) * a2, message: 'Reflected inertias scale with the speed ratio **squared** (one factor from the torque, one from the acceleration).', trapId: 'b2-gear-squared' },
            { value: (GRW / NRNS) ** 2 * a1 + (GRW / GR2) ** 2 * a2, message: 'The motors spin faster than the axle, so their inertia is multiplied by (speed ratio)², not divided.', trapId: 'b2-gear-squared' },
          ]),
          num('ratio', 'Lowest critical frequency as a fraction of the bare axle’s, $\\omega_1/\\omega_{A1}$', ratio, '', [
            { value: 2, message: 'Treating the heavy end as fixed predicts ×2 (+100 %). A large end inertia is not a fixed end: it adds a new, much lower mode.', trapId: 'b2-heavy-end-not-fixed' },
            { value: zFull / (Math.PI / 2), message: 'Each half-axle carries **half** of $I_{eff}$ (as stated), so $I_e = I_{eff}/2$.' },
            { value: z1, message: 'That is $z_1$ itself. The bare axle has $z = \\pi/2$, so $\\omega_1/\\omega_{A1} = z_1/(\\pi/2)$.' },
          ], { tol: 0.01 }),
          choice(rng, 'diam', 'With the motors connected, the axle diameter is increased by 20 % (same motor inertias in kg m²). The lowest critical speed…', [
            { text: 'rises by about 44 %.', correct: true, why: 'Now $\\omega_1 \\approx \\sqrt{k_t/I_e}$ with $k_t \\propto d^4$ and $I_e$ fixed, so $\\omega_1 \\propto d^2$: $1.2^2 = 1.44$ (2021 B2.5).' },
            { text: 'is unchanged, because $J$ cancels.', correct: false, why: 'Only for the bare uniform axle (2021 B2.3). Here the motor inertia dominates and does not scale with $d$.' },
            { text: 'rises by 20 %.', correct: false, why: 'The stiffness rises with $d^4$, and the frequency with its square root.' },
            { text: 'falls, because the axle becomes heavier.', correct: false, why: 'The axle’s own inertia is negligible next to the motors’.' },
          ]),
        ],
        hints: [
          'Engine off: the motor inertias, reflected through the gears, sit at the differential end. A heavy end inertia turns fixed–free into $z\\tan z = I_a/I_e$ (2021 B2.5). Do **not** treat it as a fixed end.',
          '$I_{eff} = \\big(\\tfrac{N_R}{N_S G_{RW}}\\big)^2 I_{MG1} + \\big(\\tfrac{G_{R2}}{G_{RW}}\\big)^2 I_{MG2}$; $I_e = I_{eff}/2$; $\\mu = I_a/I_e$; solve $z\\tan z = \\mu$; $\\omega_1/\\omega_{A1} = z_1/(\\pi/2)$.',
          `Speed ratios ${t4(NRNS / GRW)} and ${t4(GR2 / GRW)}; $I_{eff}/I_a = ${t4((NRNS / GRW) ** 2)} \\times ${a1} + ${t4((GR2 / GRW) ** 2)} \\times ${a2} = ${t4(IeffR)}$; $\\mu = ${t4(mu)}$, $z_1 \\approx \\sqrt{\\mu/(1 + \\mu/3)} = ${t4(it[0])}$.`,
          `$I_{eff}/I_a$ = **${f4(IeffR)}**; $z_1 = ${t4(z1)}$, so $\\omega_1/\\omega_{A1}$ = **${f4(ratio)}**: a **${f3((1 - ratio) * 100)} % drop** (not the +100 % a fixed end would suggest). Modes 2 and 3 move up to about 2 and 4 $\\omega_{A1}$, the fixed–fixed values.`,
        ],
      };
    },
  },

  // ------------------------------------------------------------------ swinging weight
  {
    id: 'b2-swing',
    title: 'Swinging weight: tension and string frequency through the swing',
    summary: '$T = mg(3\\cos\\theta - 2\\cos\\theta_0)$: the string’s pitch is highest at the bottom of the swing.',
    tiers: [1, 2, 3],
    source: 'Similar to 2021 B1.2; official 2016 B1.3–1.5',
    cardId: 'b2-variable-tension',
    marks: 4,
    generate(rng, tier) {
      if (tier === 1) {
        const m = rng.step(0.5, 5, 0.1);
        const th = rng.step(10, 60, 5);
        const t = (th * Math.PI) / 180;
        const Tmax = m * g * (3 - 2 * Math.cos(t));
        const Tmin = m * g * Math.cos(t);
        return {
          prompt: `A ${n6(m)} kg weight hangs from a light string and swings in a vertical plane with a constant angular amplitude of ${th}°.`,
          givens: [
            { sym: 'm', value: `${n6(m)} kg` },
            { sym: '\\theta_0', value: `${th}°` },
          ],
          figure: swingFigure(th),
          parts: [
            num('Tmax', 'String tension at the bottom of the swing', Tmax, 'N', [
              { value: m * g, message: 'That is the static tension $mg$. At the bottom the string also supplies the centripetal force $mv^2/L$.', trapId: 'b2-variable-tension' },
              { value: m * g * (3 * Math.cos(t) - 2), message: 'Swapped angles: at the bottom $\\theta = 0$, so $T = mg(3 - 2\\cos\\theta_0)$.' },
            ]),
            num('Tmin', 'String tension at the extremes of the swing', Tmin, 'N', [{ value: m * g, message: 'At the extremes the weight is momentarily at rest, but the string carries only the component $mg\\cos\\theta_0$.' }]),
          ],
          hints: [
            'Energy fixes the speed at each angle, and the string must supply the centripetal force on top of the weight component: the tension varies through the swing.',
            '$v^2 = 2gL(\\cos\\theta - \\cos\\theta_0)$ and $T - mg\\cos\\theta = mv^2/L$, so $T = mg(3\\cos\\theta - 2\\cos\\theta_0)$.',
            `$mg = ${t4(m * g)}$ N, $\\cos ${th}° = ${t4(Math.cos(t))}$.`,
            `Bottom ($\\theta = 0$): $T = ${t4(m * g)}(3 - 2 \\times ${t4(Math.cos(t))}) = $ **${f4(Tmax)} N**; extremes: $T = mg\\cos\\theta_0 = $ **${f4(Tmin)} N**.`,
          ],
        };
      }
      if (tier === 2) {
        const m = rng.step(0.5, 5, 0.5);
        const th = rng.step(15, 60, 5);
        const t = (th * Math.PI) / 180;
        const Ls = rng.step(0.5, 2, 0.1);
        const rlg = rng.step(0.5, 5, 0.5);
        const rl = rlg / 1000;
        const Tmax = m * g * (3 - 2 * Math.cos(t));
        const Tmin = m * g * Math.cos(t);
        const fmax = Math.sqrt(Tmax / rl) / (2 * Ls);
        const fmin = Math.sqrt(Tmin / rl) / (2 * Ls);
        return {
          prompt: `A ${n6(m)} kg weight hangs from a string ${n6(Ls)} m long with a mass of ${n6(rlg)} g per metre, and swings with a constant angular amplitude of ${th}°. Treat the string as fixed at both ends for its own transverse vibration.`,
          givens: [
            { sym: 'm', value: `${n6(m)} kg` },
            { sym: 'L', value: `${n6(Ls)} m`, label: 'string length' },
            { sym: '\\rho_l', value: `${n6(rlg)} g/m` },
            { sym: '\\theta_0', value: `${th}°` },
          ],
          figure: swingFigure(th),
          parts: [
            num('fmax', 'String fundamental at the bottom of the swing', fmax, 'Hz', [
              { value: Math.sqrt((m * g) / rl) / (2 * Ls), message: 'That uses the static tension $mg$; at the bottom $T = mg(3 - 2\\cos\\theta_0)$.', trapId: 'b2-variable-tension' },
              { value: Math.sqrt(Tmax / rlg) / (2 * Ls), message: 'Convert $\\rho_l$ to kg/m (g/m ÷ 1000).', trapId: 'unit-scale' },
            ], { freq: true }),
            num('fmin', 'String fundamental at the extremes', fmin, 'Hz', [{ value: Math.sqrt((m * g) / rl) / (2 * Ls), message: 'At the extremes $T = mg\\cos\\theta_0$, not $mg$.', trapId: 'b2-variable-tension' }], { freq: true }),
            num('ratio', 'Ratio $f_{max}/f_{min}$', fmax / fmin, '', [{ value: Tmax / Tmin, message: 'That is the tension ratio. $f \\propto \\sqrt T$: take its square root.', trapId: 'sqrt' }]),
          ],
          hints: [
            'At every instant the string behaves as a fixed–fixed string with the current tension, $f_1 = (1/2L)\\sqrt{T/\\rho_l}$; only $T$ changes through the swing.',
            '$T_{max} = mg(3 - 2\\cos\\theta_0)$ at the bottom, $T_{min} = mg\\cos\\theta_0$ at the extremes; $\\rho_l$ in kg/m.',
            `$T_{max} = ${t4(Tmax)}$ N, $T_{min} = ${t4(Tmin)}$ N, $\\rho_l = ${n6(rl)}$ kg/m.`,
            `$f_{max} = \\sqrt{${t4(Tmax)}/${n6(rl)}}/(2 \\times ${n6(Ls)}) = $ **${f4(fmax)} Hz**; $f_{min}$ = **${f4(fmin)} Hz**; ratio **${f4(fmax / fmin)}** $= \\sqrt{(3 - 2\\cos\\theta_0)/\\cos\\theta_0}$, independent of $m$, $L$ and $\\rho_l$.`,
          ],
        };
      }
      const R = rng.pick([1.05, 1.1, 1.15, 1.2, 1.25, 1.3, 1.4, 1.5]);
      const cos0 = 3 / (R * R + 2);
      const th = (Math.acos(cos0) * 180) / Math.PI;
      return {
        prompt: `A weight swings on a light string. Over each swing the pitch of the string’s fundamental varies so that its highest value is ${R} times its lowest.`,
        givens: [{ sym: 'f_{max}/f_{min}', value: `${R}` }],
        parts: [
          num('th', 'Angular amplitude of the swing $\\theta_0$', th, '°', [
            { value: (Math.acos(3 / (R + 2)) * 180) / Math.PI, message: 'The **tension** ratio is $R^2$ because $f \\propto \\sqrt T$.', trapId: 'sqrt' },
          ], { absTol: 0.3 }),
          choice(rng, 'lower', 'Which changes would lower the string’s highest frequency (at the bottom of the swing)? Select all that apply.', [
            { text: 'A lighter weight', correct: true, why: '$T \\propto m$.' },
            { text: 'A longer string', correct: true, why: '$f \\propto 1/L$, and at a fixed angle $T$ does not depend on $L$.' },
            { text: 'A heavier (denser) string', correct: true, why: '$f \\propto 1/\\sqrt{\\rho_l}$.' },
            { text: 'A larger swing amplitude', correct: false, why: 'It raises $T_{max} = mg(3 - 2\\cos\\theta_0)$.' },
            { text: 'A shorter string', correct: false, why: 'It raises $f$.' },
          ], true),
        ],
        hints: [
          'The pitch follows the tension, $f \\propto \\sqrt T$, and the tension swings between $mg\\cos\\theta_0$ (extremes) and $mg(3 - 2\\cos\\theta_0)$ (bottom).',
          '$\\left(f_{max}/f_{min}\\right)^2 = (3 - 2\\cos\\theta_0)/\\cos\\theta_0 \\Rightarrow \\cos\\theta_0 = 3/(R^2 + 2)$.',
          `$\\cos\\theta_0 = 3/(${R}^2 + 2) = ${t4(cos0)}$.`,
          `$\\theta_0 = \\arccos(${t4(cos0)}) = $ **${f3(th)}°**. To lower the top frequency: lighter weight, longer string or heavier string (a smaller swing too).`,
        ],
      };
    },
  },

  // ------------------------------------------------------------------ rotating cable
  {
    id: 'b2-rotating-cable',
    title: 'Rotating cable with an end mass',
    summary: '$T(x) = \\Omega^2[ml + \\tfrac12\\rho_l(l^2 - x^2)]$: tension, quick frequency estimates, and what Ω, $m$ and $\\rho_l$ do.',
    tiers: [1, 2, 3],
    source: 'Similar to tutorial W7.9; official 2018 B1.3–1.4 and 2023 B1.1–1.2',
    cardId: 'b2-variable-tension',
    marks: 5,
    generate(rng, tier) {
      const m = rng.step(0.5, 10, 0.5);
      const l = rng.step(0.5, 3, 0.1);
      const N = rng.step(60, 600, 30);
      const W = (TAU * N) / 60;
      if (tier === 1) {
        const rl = rng.step(0.05, 1, 0.05);
        const Tm = W * W * m * l;
        const Th = W * W * (m * l + 0.5 * rl * l * l);
        return {
          prompt: `A ${n6(m)} kg mass on the end of a flexible cable (length ${n6(l)} m, ${n6(rl)} kg/m) is whirled in a horizontal plane about the cable’s other end, A, at ${N} rpm. Neglect gravity.`,
          givens: [
            { sym: 'm', value: `${n6(m)} kg` },
            { sym: 'l', value: `${n6(l)} m` },
            { sym: '\\rho_l', value: `${n6(rl)} kg/m` },
            { sym: 'N', value: `${N} rpm` },
          ],
          figure: cableFigure(),
          parts: [
            num('Tm', 'Cable tension next to the mass', Tm, 'N', [
              { value: (N / 60) ** 2 * m * l, message: '$\\Omega$ must be in rad/s: $\\Omega = 2\\pi N/60$, not $N/60$.', trapId: 'units' },
              { value: N * N * m * l, message: '$\\Omega$ must be in rad/s: $\\Omega = 2\\pi N/60$.', trapId: 'units' },
            ]),
            num('Th', 'Cable tension at the hub A', Th, 'N', [
              { value: Tm, message: 'Include the cable’s own centrifugal force, $\\tfrac12\\rho_l\\Omega^2 l^2$.', trapId: 'b2-variable-tension' },
              { value: W * W * (m * l + rl * l * l), message: 'The cable’s centrifugal force is $\\int_0^l \\rho_l\\Omega^2 x\\,dx = \\tfrac12\\rho_l\\Omega^2 l^2$.', trapId: 'factor2' },
            ]),
          ],
          hints: [
            'Each piece of cable is pulled inwards by the tension and must supply the centripetal force of everything outboard of it, so the tension is largest at the hub.',
            '$T(x) = \\Omega^2[ml + \\tfrac12\\rho_l(l^2 - x^2)]$ with $\\Omega$ in rad/s: $T(l) = m\\Omega^2 l$, $T(0) = \\Omega^2(ml + \\tfrac12\\rho_l l^2)$.',
            `$\\Omega = 2\\pi \\times ${N}/60 = ${t4(W)}$ rad/s; $\\Omega^2 = ${t4(W * W)}$ s⁻².`,
            `At the mass: $T = ${t4(W * W)} \\times ${n6(m)} \\times ${n6(l)} = $ **${f4(Tm)} N**; at the hub: $T = ${t4(W * W)}(${n6(m * l)} + ${n6(0.5 * rl * l * l)}) = $ **${f4(Th)} N**.`,
          ],
        };
      }
      const muT = rng.pick([0.5, 1, 2, 4, 8]);
      const rl = rng.nice(m / (muT * l), 2);
      const mu = m / (rl * l);
      const T = m * W * W * l;
      const c = Math.sqrt(T / rl);
      const fFF = c / (2 * l);
      const fFr = c / (4 * l);
      const ex = rotatingCableW79(mu);
      const fEx = (ex.wOverOmega * W) / TAU;
      const errFF = (fFF / fEx - 1) * 100;
      const errFr = (fFr / fEx - 1) * 100;
      const common = {
        givens: [
          { sym: 'm', value: `${n6(m)} kg` },
          { sym: 'l', value: `${n6(l)} m` },
          { sym: '\\rho_l', value: `${n6(rl)} kg/m` },
          { sym: 'N', value: `${N} rpm` },
        ],
        figure: cableFigure(),
      };
      const intro = `A ${n6(m)} kg mass on a flexible cable (length ${n6(l)} m, ${n6(rl)} kg/m) is whirled in a horizontal plane about the cable’s other end at ${N} rpm.`;
      if (tier === 2) {
        return {
          prompt: `${intro} For a first estimate of the cable’s in-plane transverse frequencies (tutorial W7.9), neglect the cable’s own centrifugal force, so the tension is $m\\Omega^2 l$ everywhere.`,
          ...common,
          parts: [
            num('c', 'Wave speed along the cable $c$', c, 'm/s', [{ value: Math.sqrt((m * (N / 60) ** 2 * l) / rl), message: '$\\Omega$ must be in rad/s.', trapId: 'units' }]),
            num('fFF', 'Fundamental, treating the mass end as fixed', fFF, 'Hz', [{ value: fFr, message: 'That is the free-end estimate ($c/4l$). Fixed ends give $c/2l$.', trapId: 'b2-end-condition' }], { freq: true }),
            num('fFr', 'Fundamental, treating the mass end as free', fFr, 'Hz', [{ value: fFF, message: 'That is the fixed-end estimate. A free end gives a quarter-wave: $c/4l$.', trapId: 'b2-end-condition' }], { freq: true }),
            choice(rng, 'better', 'Tutorial W7.9(c) refines the model by keeping the cable’s own centrifugal term. Which quick estimate is closer to it?', [
              { text: 'Treating the mass as fixed', correct: true, why: `The end mass behaves far more like a fixed end than a free one. W7.9(c) gives ${f4(fEx)} Hz: the fixed estimate is ${f3(errFF)} %, the free one ${f3(errFr)} %. Both are low, because the cable’s own centrifugal force adds tension (the exact variable-tension result is higher again), and the fixed estimate improves as $m$ grows.` },
              { text: 'Treating the mass as free', correct: false, why: `About ${f3(Math.abs(errFr))} % low: the end mass resists transverse motion strongly.` },
              { text: 'They are equally good', correct: false, why: 'They differ by a factor of 2.' },
            ]),
          ],
          hints: [
            'With constant tension the cable is a taut string with $c = \\sqrt{T/\\rho_l}$. The end mass is somewhere between a fixed end (very heavy) and a free end (very light).',
            '$\\Omega = 2\\pi N/60$; $T = m\\Omega^2 l$; $c = \\sqrt{T/\\rho_l} = \\Omega l\\sqrt{m/(\\rho_l l)}$; fixed: $f_1 = c/2l$; free: $f_1 = c/4l$.',
            `$\\Omega = ${t4(W)}$ rad/s; $T = ${t4(T)}$ N; $m/(\\rho_l l) = ${t4(mu)}$.`,
            `$c$ = **${f4(c)} m/s**; fixed: **${f4(fFF)} Hz**; free: **${f4(fFr)} Hz**. The fixed-end estimate is far better (${f3(errFF)} % vs ${f3(errFr)} %), and improves as $m$ grows.`,
          ],
        };
      }
      const cr = Math.sqrt(1 + (rl * l) / (2 * m));
      return {
        prompt: `${intro} Use the W7.9 model with the cable’s centrifugal force kept at constant tension: $\\beta\\tan\\beta = \\rho_l l/m$ and $\\omega = \\Omega\\sqrt{\\beta^2 m/(\\rho_l l) - 1}$, taking the root $\\beta > \\pi$.`,
        ...common,
        parts: [
          num('cr', 'Ratio of the wave speed at the hub to that at the mass, $c(0)/c(l)$', cr, '', [{ value: 1 + (rl * l) / (2 * m), message: 'That is the tension ratio; $c \\propto \\sqrt T$.', trapId: 'sqrt' }]),
          num('w', 'Fundamental in-plane frequency $\\omega_1/\\Omega$', ex.wOverOmega, '', [
            { value: Math.PI * Math.sqrt(mu), message: 'That is the fixed-end estimate $\\pi\\Omega\\sqrt{m/(\\rho_l l)}$; solve the W7.9 equation.' },
            { value: (Math.PI / 2) * Math.sqrt(mu), message: 'That is the free-end estimate.' },
          ]),
          choice(rng, 'rho', 'The cable is replaced by one twice as heavy per metre (same $m$, $l$ and speed). Its natural frequencies…', [
            { text: 'fall, although the tension rises.', correct: true, why: '$c^2 = \\Omega^2[ml/\\rho_l + \\tfrac12(l^2 - x^2)]$ falls: the inertia grows faster than the tension (official 2018 B1.4(a)).' },
            { text: 'rise, because the tension rises.', correct: false, why: 'The tension does rise, but $\\rho_l$ in the denominator of $c^2$ wins.' },
            { text: 'fall, because the tension falls.', correct: false, why: 'Right direction, wrong reason: the tension rises with $\\rho_l$.' },
            { text: 'do not change.', correct: false, why: '$c$ depends on $\\rho_l$.' },
          ]),
          choice(rng, 'omega', 'The spin speed is doubled. Its natural frequencies…', [
            { text: 'all double.', correct: true, why: 'Every tension term is ∝ $\\Omega^2$, so $c$ and every $\\omega_n$ are ∝ $\\Omega$.' },
            { text: 'rise by $\\sqrt2$.', correct: false, why: 'The tension rises 4×, so $c$ rises 2×.' },
            { text: 'fall, because the tension rises.', correct: false, why: 'More tension raises the frequencies.' },
            { text: 'quadruple.', correct: false, why: 'That is the tension, not the frequency.' },
          ]),
        ],
        hints: [
          'The tension falls from the hub to the mass, so the wave speed varies along the cable. A quick model keeps the cable’s centrifugal force but uses a constant tension, giving a transcendental equation with $\\mu = m/(\\rho_l l)$.',
          '$c(x) = \\sqrt{T(x)/\\rho_l}$ with $T(0)/T(l) = 1 + \\rho_l l/2m$. Solve $\\beta\\tan\\beta = 1/\\mu$ for $\\beta \\in (\\pi, 3\\pi/2)$, then $\\omega_1/\\Omega = \\sqrt{\\beta^2\\mu - 1}$.',
          `$\\mu = ${t4(mu)}$, $1/\\mu = ${t4(1 / mu)}$: $\\beta = ${t4(ex.beta)}$.`,
          `$c(0)/c(l) = \\sqrt{1 + ${t4((rl * l) / (2 * m))}} = $ **${f4(cr)}**; $\\omega_1/\\Omega = \\sqrt{${t4(ex.beta)}^2 \\times ${t4(mu)} - 1} = $ **${f4(ex.wOverOmega)}** (${f4(fEx)} Hz here), against $\\pi\\sqrt\\mu = ${t4(Math.PI * Math.sqrt(mu))}$ for the fixed-end estimate. Heavier cable: frequencies fall; faster spin: all ∝ Ω.`,
        ],
      };
    },
  },
];
