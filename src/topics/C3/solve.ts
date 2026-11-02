// C3 problem generators. Numbers are randomised within the ranges the papers use; the four hints walk
// concept -> set-up -> substitution -> worked solution with this instance's numbers.
import type { SolveGenerator, SolvePart } from '../../engine/types';
import type { Rng } from '../../engine/rng';
import { coherentGain, windowFn } from '../../physics/dsp';
import { aliasInfo, gcdInt, nextPow2, noiseBias, scallopReading } from './physics';
import { choice, f3, f4, num, tidy } from './util';

// Window constants, computed once from the app's own window functions.
let FT_CG = 0;
const flatTopGain = () => (FT_CG ||= coherentGain(windowFn('flattop', 1024)));
let SCALLOP: { rect: number; hann: number } | null = null;
const scallop = () => (SCALLOP ||= { rect: scallopReading('rect', 0.5), hann: scallopReading('hann', 0.5) });

/** Three (or two) tones g*n_i with gcd(n_i) = 1 and spacings of at least 2g. */
function makeTones(rng: Rng, count: number, gs: number[]): { g: number; n: number[]; tones: number[] } {
  for (let attempt = 0; attempt < 300; attempt++) {
    const g = rng.pick(gs);
    const nMin = Math.max(2, Math.ceil(1 / g - 1e-9));
    const nMax = Math.min(60, Math.floor(400 / g));
    const n: number[] = [];
    while (n.length < count) {
      const v = rng.int(nMin, nMax);
      if (!n.includes(v)) n.push(v);
    }
    n.sort((a, b) => a - b);
    let G = 0;
    for (const v of n) G = gcdInt(G, v);
    const gaps = n.slice(1).map((v, i) => v - n[i]);
    if (G === 1 && Math.min(...gaps) >= 2) return { g, n, tones: n.map((v) => tidy(v * g)) };
  }
  return { g: 1, n: [10, 13, 30].slice(0, count), tones: [10, 13, 30].slice(0, count) };
}

const list = (xs: (string | number)[]) => (xs.length < 2 ? String(xs[0]) : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

type Trap = { value: number; message: string; trapId?: string };

/**
 * Folding that stops too early or goes once too far: |f − m fs| for multiples m other than the nearest,
 * k = round(f/fs). Each value lies above fs/2, so the line cannot appear there (summary notes C3: fold
 * |f − k fs| into [0, fs/2]). E.g. 430 Hz at 200 samples/s: 430 − 200 = 230 Hz is still above 100 Hz.
 */
function foldTraps(f: number, fs: number, unit = 'Hz'): Trap[] {
  const { k } = aliasInfo(f, fs);
  const nyq = fs / 2;
  const out: Trap[] = [];
  for (let m = 1; m < k; m++) {
    const v = tidy(f - m * fs, 3);
    out.push({
      value: v,
      message: `$${f} - ${m === 1 ? '' : `${m} \\times `}${fs}$ = ${v} ${unit} is still above $f_s/2$ = ${nyq} ${unit}: subtracting $f_s$ ${m === 1 ? 'once' : `${m} times`} is not enough. An alias always lies in $[0, f_s/2]$; subtract the **nearest** multiple, $k = \\text{round}(f/f_s)$ = ${k}.`,
      trapId: 'alias-incomplete',
    });
  }
  // f − k fs already lies in [0, fs/2]; reflecting it once more (fs minus that remainder) overshoots.
  if (f - k * fs > 1e-9) {
    const v = tidy((k + 1) * fs - f, 3);
    out.push({
      value: v,
      message: `${v} ${unit} is above $f_s/2$ = ${nyq} ${unit}, so the line cannot appear there: you folded once too often. Subtract the nearest multiple of $f_s$, $k = \\text{round}(f/f_s)$ = ${k}, and stop when the result lies in $[0, f_s/2]$.`,
      trapId: 'alias-incomplete',
    });
  }
  return out;
}

/** "Shown at its true frequency" answered for a tone above Nyquist: compare with fs/2, not fs. */
const trueFreqTrap = (f: number, fs: number, unit = 'Hz'): Trap => ({
  value: f,
  message:
    f < fs
      ? `${f} ${unit} is below $f_s$ but above $f_s/2$ = ${fs / 2} ${unit}: compare with the Nyquist frequency, not the sampling rate. It cannot appear at its true frequency.`
      : `${f} ${unit} is above $f_s/2$ = ${fs / 2} ${unit}, so it cannot appear at its true frequency.`,
  trapId: 'nyquist-half',
});

export const generators: SolveGenerator[] = [
  // ------------------------------------------------------------------ record planning (2023 A3.2)
  {
    id: 'c3-record',
    title: 'Sampling rate and record length for a measurement',
    summary: 'From the bandwidth and resolution you need to $f_s$, $T$, $N$ and the number of lines.',
    tiers: [1, 2, 3],
    source: 'Similar to 2023 A3.2 (building: 10 Hz, 0.05 Hz)',
    cardId: 'c3-sampling',
    marks: 4,
    generate(rng, tier) {
      const job = rng.pick([
        { what: 'the natural frequencies of a tall building', fmax: [2, 5, 10], df: [0.005, 0.01, 0.02, 0.05] },
        { what: 'the vertical modes of a footbridge', fmax: [5, 10, 20], df: [0.01, 0.02, 0.05, 0.1] },
        { what: 'the vibration of a truck seat', fmax: [50, 100, 200], df: [0.1, 0.25, 0.5] },
        { what: 'the casing vibration of a gearbox', fmax: [500, 1000, 2000, 5000], df: [0.5, 1, 2, 5] },
      ]);
      const fmax = rng.pick(job.fmax);
      const df = rng.pick(job.df);
      const fs = 2 * fmax;
      const T = 1 / df;
      const N = Math.round(fs * T);
      const lines = N / 2;
      const givens = [
        { sym: 'f_{max}', value: `${fmax} Hz`, label: 'highest frequency of interest' },
        { sym: '\\Delta f', value: `${df} Hz`, label: 'required resolution' },
      ];
      if (tier === 3) {
        const fs3 = 2.56 * fmax;
        const Nmin = fs3 / df;
        const N2 = nextPow2(Math.ceil(Nmin - 1e-9));
        const T2 = N2 / fs3;
        const df2 = 1 / T2;
        const p = Math.round(Math.log2(N2));
        return {
          prompt: `An analyser will record ${job.what} up to ${fmax} Hz, with lines no more than ${df} Hz apart. Like most analysers it samples at 2.56 $f_{max}$ (so its anti-aliasing filter can roll off before $f_s/2$) and its FFT needs $N = 2^n$ samples.`,
          givens,
          parts: [
            num({ id: 'fs', label: 'Sampling rate $f_s$', answer: fs3, unit: 'samples/s', traps: [{ value: fs, message: 'That is the theoretical minimum $2f_{max}$; this analyser samples at $2.56f_{max}$.' }] }),
            num({
              id: 'N',
              label: 'Number of samples $N$ (a power of 2)',
              answer: N2,
              unit: '',
              tol: 0.001,
              traps: [
                { value: Nmin, message: `$f_s/\\Delta f$ = ${f4(Nmin)} is the minimum; round **up** to the next power of 2.` },
                { value: N2 / 2, message: `With $N$ = ${N2 / 2}, $\\Delta f$ = ${f4((2 * fs3) / N2)} Hz, coarser than ${df} Hz: you rounded down, or counted the $N/2$ lines instead of the $N$ samples. Round $f_s/\\Delta f$ **up**.` },
                { value: Nmin / 2, message: `${f4(Nmin / 2)} is the number of lines up to $f_s/2$, i.e. $N/2$. Samples: $N \\ge f_s/\\Delta f$ = ${f4(Nmin)}, rounded up to a power of 2.`, trapId: 'lines-half' },
              ],
            }),
            num({ id: 'T', label: 'Record length $T$', answer: T2, unit: 's', traps: [{ value: T, message: `$1/\\Delta f$ = ${f4(T)} s is the minimum before rounding; with $N$ = ${N2}, $T = N/f_s$.` }] }),
            num({ id: 'df', label: 'Actual line spacing $\\Delta f$', answer: df2, unit: 'Hz', traps: [{ value: df, message: 'That is the target; rounding $N$ up made the lines finer.' }] }),
          ],
          hints: [
            'An analyser samples a little faster than Nyquist demands, so the anti-aliasing filter can roll off before $f_s/2$, and its FFT wants $N = 2^n$. Round $N$ **up**: the lines can only get finer.',
            '$f_s = 2.56f_{max}$; $N \\ge f_s/\\Delta f$, rounded up to a power of 2; then $T = N/f_s$ and $\\Delta f = 1/T$.',
            `$f_s = 2.56 \\times ${fmax} = ${f4(fs3)}$ samples/s; $f_s/\\Delta f = ${f4(fs3)}/${df} = ${f4(Nmin)}$.`,
            `**$f_s$ = ${f4(fs3)} samples/s**; $N$ = **${N2}** ($2^{${p}}$); $T = ${N2}/${f4(fs3)} =$ **${f4(T2)} s**; $\\Delta f = 1/T =$ **${f4(df2)} Hz** (no coarser than ${df} Hz). The FFT has ${N2 / 2} lines up to $f_s/2$ = ${f4(fs3 / 2)} Hz.`,
          ],
        };
      }
      const parts: SolvePart[] = [
        num({
          id: 'fs',
          label: 'Minimum sampling rate $f_s$',
          answer: fs,
          unit: 'samples/s',
          traps: [
            { value: fmax, message: 'That is the highest frequency itself. Two samples per period are needed: $f_s \\ge 2f_{max}$.', trapId: 'nyquist-half' },
            { value: 2.56 * fmax, message: 'That is the practical analyser rate ($2.56f_{max}$, room for the anti-aliasing filter). The theoretical minimum is $2f_{max}$.' },
            { value: 4 * fmax, message: 'Twice too high: $f_{max} = f_s/2$, so $f_s = 2f_{max}$.', trapId: 'nyquist-half' },
          ],
        }),
        num({
          id: 'T',
          label: 'Shortest record length $T$',
          answer: T,
          unit: 's',
          traps: [
            { value: df, message: 'That is $\\Delta f$ itself. The record length is its inverse: $T = 1/\\Delta f$.' },
            { value: 1 / fs, message: 'That is the time step $\\Delta t = 1/f_s$, not the record length.' },
            { value: 1 / (2 * df), message: 'There is no factor of 2 in the resolution: $\\Delta f = 1/T$.' },
          ],
        }),
      ];
      if (tier === 2)
        parts.push(
          num({
            id: 'N',
            label: 'Number of samples $N$',
            answer: N,
            unit: '',
            traps: [{ value: lines, message: 'That is the number of lines, $N/2$ (or you used $f_{max}$ instead of $f_s$). Samples: $N = f_sT$.', trapId: 'lines-half' }],
          }),
          num({
            id: 'lines',
            label: 'Number of spectral lines up to the Nyquist frequency',
            answer: lines,
            unit: '',
            traps: [{ value: N, message: '$N$ samples give $N/2$ lines: the upper half of the DFT mirrors the lower half.', trapId: 'lines-half' }],
          })
        );
      return {
        prompt: `You must measure ${job.what} up to ${fmax} Hz with a frequency resolution of ${df} Hz.`,
        givens,
        parts,
        hints: [
          'Two separate limits: the sampling rate sets the highest frequency an FFT can show ($f_s/2$: two samples per period), and the record length sets the line spacing ($\\Delta f = 1/T$).',
          `$f_s \\ge 2f_{max}$ (LC3 Eq 3.4); $T \\ge 1/\\Delta f$ (Eq 3.5)${tier === 2 ? '; $N = f_sT$; lines $= N/2$' : ''}.`,
          `$f_s = 2 \\times ${fmax}$; $T = 1/${df}$${tier === 2 ? '; then $N = f_s \\times T$' : ''}.`,
          `$f_s$ = **${fs} samples/s** ($\\Delta t$ = ${f4(1000 / fs)} ms); $T$ = **${f4(T)} s**${tier === 2 ? `; $N = ${fs} \\times ${f4(T)} =$ **${N}** samples, giving **${lines} lines** of ${df} Hz up to ${fmax} Hz` : ''}. (An analyser would actually sample at about $2.56f_{max}$ = ${f4(2.56 * fmax)} samples/s.)`,
        ],
      };
    },
  },

  // ------------------------------------------------------------------ gcd of tones (2024 A3.2)
  {
    id: 'c3-gcd',
    title: 'Largest line spacing that resolves given tones',
    summary: 'Every tone on a line: $\\Delta f_{max} = \\gcd(f_i)$, $T_{min} = 1/\\Delta f_{max}$, and $f_s > 2f_{max}$.',
    tiers: [1, 2, 3],
    source: 'Similar to 2024 A3.2 (10, 13, 30 Hz → 1 Hz, 60 samples/s); 2022 A3.5 (7.4, 15, 23 Hz → 0.2 Hz)',
    cardId: 'c3-leakage',
    marks: 5,
    generate(rng, tier) {
      const { g, n, tones } = makeTones(rng, tier === 1 ? 2 : 3, tier === 3 ? [0.1, 0.2, 0.25] : [0.5, 1, 2, 5]);
      const gaps = tones.slice(1).map((t, i) => tidy(t - tones[i]));
      const spacing = Math.min(...gaps);
      const fmaxT = tones[tones.length - 1];
      const Tmin = 1 / g;
      const g2 = gcdInt(n[0], n[1]) * g;
      const parts: SolvePart[] = [
        num({
          id: 'df',
          label: 'Largest line spacing $\\Delta f$ that puts every tone on a line',
          answer: g,
          unit: 'Hz',
          traps: [
            { value: spacing, message: `${spacing} Hz is the smallest spacing. $\\Delta f$ below it is only **necessary**; for sharp, distinct peaks every tone must sit on a line, so $\\Delta f$ must divide every tone: the gcd.`, trapId: 'gcd-not-spacing' },
            { value: spacing / 2, message: `Half the spacing (${f4(spacing / 2)} Hz) still leaves tones off the lines unless it divides all of them.`, trapId: 'gcd-not-spacing' },
            { value: g2, message: `${f4(g2)} Hz divides ${tones[0]} and ${tones[1]} Hz but not every tone.`, trapId: 'gcd-not-spacing' },
            { value: tones[0], message: 'A spacing equal to the lowest tone misses the others unless they are its multiples.' },
          ],
        }),
        num({
          id: 'T',
          label: 'Corresponding shortest record length $T$',
          answer: Tmin,
          unit: 's',
          traps: [
            { value: g, message: 'That is $\\Delta f$; the record length is $T = 1/\\Delta f$.' },
            { value: 1 / spacing, message: 'That is 1/(smallest spacing): it does not put every tone on a line.', trapId: 'gcd-not-spacing' },
          ],
        }),
      ];
      if (tier >= 2)
        parts.push(
          num({
            id: 'fs',
            label: 'Minimum sampling rate to avoid aliasing',
            answer: 2 * fmaxT,
            unit: 'samples/s',
            traps: [
              { value: fmaxT, message: 'Nyquist: the highest tone must be below $f_s/2$, so $f_s > 2f_{max}$.', trapId: 'nyquist-half' },
              { value: 2.56 * fmaxT, message: 'That is a practical value with filter margin; the minimum is $2f_{max}$.' },
              { value: 2 * spacing, message: 'The sampling rate is set by the highest tone, not by the spacing.' },
            ],
          })
        );
      let T0 = 0;
      if (tier === 3) {
        const u = rng.pick([0.5, 1.5, 2.5]);
        T0 = tidy(Tmin * u, 4);
        parts.push(
          choice(
            'leak',
            `A colleague recorded $T$ = ${T0} s instead. Which tones leak? (Select all that apply.)`,
            tones.map((t) => {
              const c = tidy(t * T0, 6);
              const whole = Math.abs(c - Math.round(c)) < 1e-6;
              return { text: `${t} Hz`, correct: !whole, why: `${t} × ${T0} = ${c} cycles: ${whole ? 'a whole number, so it sits on a line' : 'not whole, so it leaks'}.` };
            }),
            true
          )
        );
      }
      const leakTxt = tier === 3 ? ` With $T$ = ${T0} s: ${tones.map((t) => `${t} × ${T0} = ${tidy(t * T0, 6)}`).join('; ')} cycles; the non-integers leak.` : '';
      return {
        prompt: `A vibration signal contains tones at ${list(tones)} Hz. You want distinct, sharp peaks in its FFT spectrum${tier >= 2 ? ', without aliasing' : ''}.`,
        givens: tones.map((t, i) => ({ sym: `f_${i + 1}`, value: `${t} Hz` })),
        parts,
        hints: [
          'Sharp peaks need every tone exactly on a line: $f_iT$ must be a whole number for each tone, so $\\Delta f = 1/T$ must divide every tone frequency (LC3-4). The smallest spacing only gives a necessary condition.',
          `$\\Delta f_{max} = \\gcd(${tones.join(', ')})$, $T_{min} = 1/\\Delta f_{max}$${tier >= 2 ? '; and $f_s > 2f_{max}$ for the highest tone' : ''}.`,
          `Write each tone as a multiple of ${g} Hz: ${n.join(', ')}. These share no further factor.`,
          `$\\Delta f_{max}$ = **${g} Hz**, so $T_{min}$ = 1/${g} = **${f4(Tmin)} s** (the tones complete ${n.join(', ')} cycles). The smallest spacing is ${spacing} Hz: $\\Delta f$ < ${spacing} Hz is necessary but not sufficient.${tier >= 2 ? ` Sampling: $f_s$ > 2 × ${fmaxT} = **${f4(2 * fmaxT)} samples/s** (about ${f4(2.56 * fmaxT)} in practice).` : ''}${leakTxt}`,
        ],
      };
    },
  },

  // ------------------------------------------------------------------ achievable? visible? (2025 A3.2)
  {
    id: 'c3-achievable',
    title: 'Is this resolution achievable? Is this tone visible?',
    summary: 'Check a resolution against the record length, and a machine frequency against the Nyquist frequency.',
    tiers: [1, 2, 3],
    source: 'Similar to 2025 A3.2 (0.2 Hz in 8 s; 5.4 × 1500 rpm at 250 samples/s)',
    cardId: 'c3-aliasing',
    marks: 5,
    generate(rng, tier) {
      const parts: SolvePart[] = [];
      const hints = ['', '', '', ''];
      let prompt = '';
      const givens: { sym: string; value: string; label?: string }[] = [];
      if (tier <= 2) {
        const T = rng.pick([2, 2.5, 4, 5, 6, 8, 10, 12, 16, 20, 25, 30, 40, 50, 60]);
        const dfT = 1 / T;
        const targets = [0.02, 0.05, 0.1, 0.2, 0.25, 0.5, 1];
        let want = rng.chance(0.5);
        let pool = targets.filter((x) => (want ? x >= dfT - 1e-12 : x < dfT - 1e-12));
        if (!pool.length) {
          want = !want;
          pool = targets.filter((x) => (want ? x >= dfT - 1e-12 : x < dfT - 1e-12));
        }
        const target = rng.pick(pool);
        const ok = dfT <= target + 1e-12;
        prompt = `(a) A recording is ${T} s long. Is a frequency resolution of ${target} Hz achievable?`;
        givens.push({ sym: 'T', value: `${T} s`, label: 'record length' }, { sym: '\\Delta f_{target}', value: `${target} Hz` });
        parts.push(
          num({ id: 'df', label: '(a) Line spacing of this record', answer: dfT, unit: 'Hz', traps: [{ value: T, message: 'That is $T$; the spacing is $1/T$.' }, { value: 1 / (2 * T), message: 'No factor of 2: $\\Delta f = 1/T$.' }] }),
          choice('ok', `(a) Is ${target} Hz achievable?`, [
            { text: 'Yes: this record gives lines at least that fine.', correct: ok, why: ok ? `$\\Delta f = 1/${T}$ = ${f4(dfT)} Hz ≤ ${target} Hz; ${target} Hz only needs $T \\ge$ ${f4(1 / target)} s.` : `$\\Delta f = 1/${T}$ = ${f4(dfT)} Hz is coarser than ${target} Hz.` },
            { text: 'No: the record is too short for lines that fine.', correct: !ok, why: ok ? `$T$ = ${T} s is already at least ${f4(1 / target)} s.` : `${target} Hz needs $T \\ge 1/${target}$ = ${f4(1 / target)} s; only a longer record gives finer lines.` },
            { text: 'It depends on the sampling rate: a higher $f_s$ gives finer lines.', correct: false, why: '$\\Delta f = 1/T$ only; $f_s$ sets the Nyquist frequency.' },
          ])
        );
        hints[0] = 'The line spacing depends on the record length only: $\\Delta f = 1/T$ (LC3 Eq 3.5).';
        hints[1] = `$\\Delta f = 1/T$; achievable if $\\Delta f \\le$ the target.`;
        hints[2] = `$\\Delta f = 1/${T}$.`;
        hints[3] = `(a) $\\Delta f = 1/${T}$ = **${f4(dfT)} Hz**, so **${ok ? 'yes' : 'no'}**: ${ok ? `finer than ${target} Hz (which needs only $T \\ge$ ${f4(1 / target)} s)` : `${target} Hz needs $T \\ge$ ${f4(1 / target)} s`}.`;
      }
      if (tier >= 2) {
        const rpm = rng.pick([600, 900, 1200, 1450, 1500, 1800, 2400, 2900, 3000, 3600]);
        const fsB = rng.pick(tier === 3 ? [200, 250, 400, 500, 1000] : [100, 128, 200, 250, 256, 400, 500, 512, 1000, 1024]);
        const shaft = rpm / 60;
        const wantVisible = tier === 3 ? rng.chance(0.4) : rng.chance(0.45);
        let order = 2;
        let f = 2 * shaft;
        // First candidate that meets every condition except the wanted visibility: used when no candidate
        // can be visible (e.g. 3600 rpm at 100 samples/s), instead of whatever the last draw was.
        let fallback: [number, number] | null = null;
        let found = false;
        for (let a = 0; a < 200; a++) {
          const o = rng.step(1.5, 12, 0.1);
          const fc = tidy(o * shaft, 3);
          const nyq = fsB / 2;
          if (Math.abs(fc - nyq) / nyq < 0.06 || fc > 2.9 * fsB) continue;
          // Above Nyquist, keep the alias clear of 0 Hz and of fs/2 (f at a multiple of fs/2 is ill-posed:
          // 400 Hz at 200 samples/s "appears" at DC, 150 Hz at 100 samples/s exactly at Nyquist).
          const half = (2 * fc) / fsB;
          if (fc > nyq && Math.abs(half - Math.round(half)) < 0.02) continue;
          if (tier === 3 && Math.abs(fc - 0.4 * fsB) / (0.4 * fsB) < 0.06) continue;
          fallback ||= [o, fc];
          const vis = tier === 3 ? fc <= 0.4 * fsB : fc < nyq;
          if (vis === wantVisible) {
            [order, f] = [o, fc];
            found = true;
            break;
          }
        }
        if (!found && fallback) [order, f] = fallback;
        const nyq = fsB / 2;
        const visible = f < nyq;
        const { fa } = aliasInfo(f, fsB);
        const machine = rng.pick(['a bearing defect', 'a gear-mesh tone', 'a blade-pass tone']);
        const lead = tier === 2 ? '(b) ' : '';
        prompt += `${tier === 2 ? '\n\n' : ''}${lead}A shaft turns at ${rpm} rpm and ${machine} occurs at ${order} times the shaft speed. The signal is sampled at ${fsB} samples/s${tier === 3 ? ' by a logger whose anti-aliasing filter is flat only up to $0.4f_s$ (it removes everything above $f_s/2$)' : ''}.`;
        givens.push({ sym: 'N', value: `${rpm} rpm` }, { sym: '\\text{order}', value: `${order}` }, { sym: 'f_s', value: `${fsB} samples/s` });
        parts.push(
          num({
            id: 'f',
            label: `${lead}Frequency of the ${machine.replace(/^a /, '')}`,
            answer: f,
            unit: 'Hz',
            traps: [{ value: shaft, message: 'That is the shaft speed; multiply by the order.' }, { value: order * rpm, message: 'Convert rpm to Hz (÷ 60) first.', trapId: 'units' }],
          }),
          num({ id: 'nyq', label: `${lead}Nyquist frequency`, answer: nyq, unit: 'Hz', traps: [{ value: fsB, message: 'The Nyquist frequency is half the sampling rate.', trapId: 'nyquist-half' }, { value: 2 * fsB, message: 'It is $f_s/2$, not $2f_s$.', trapId: 'nyquist-half' }] })
        );
        if (tier === 2) {
          parts.push(
            choice('vis', '(b) Can it be observed correctly?', [
              { text: 'Yes: it lies below the Nyquist frequency, so it is represented correctly.', correct: visible, why: visible ? `${f} Hz < ${nyq} Hz: more than two samples per period.` : `${f} Hz is above $f_s/2$ = ${nyq} Hz.` },
              { text: 'No: it lies above the Nyquist frequency, so the anti-aliasing filter removes it or, without one, it appears at a false frequency.', correct: !visible, why: visible ? `${f} Hz is below $f_s/2$ = ${nyq} Hz.` : `${f} Hz > ${nyq} Hz. Without a filter it would appear at ${f4(fa)} Hz.` },
              { text: 'Yes: it lies below the sampling rate.', correct: false, why: `Compare with $f_s/2$ = ${nyq} Hz, not with $f_s$ = ${fsB} samples/s.` },
            ])
          );
          if (!visible)
            parts.push(
              num({
                id: 'alias',
                label: '(b) Where would it appear with no anti-aliasing filter?',
                answer: fa,
                unit: 'Hz',
                traps: [
                  { value: f - nyq, message: 'Fold about multiples of $f_s$, not about $f_s/2$: $f_a = |f - kf_s|$.', trapId: 'alias-fold' },
                  { value: nyq, message: 'Content above Nyquist is not clipped to it; it folds back.', trapId: 'alias-fold' },
                  // f − m fs for m short of the nearest multiple (e.g. f − fs when f > 1.5 fs) is still above Nyquist.
                  ...foldTraps(f, fsB),
                  trueFreqTrap(f, fsB),
                ],
              })
            );
          parts.push(
            num({
              id: 'fsNeed',
              label: '(b) Lowest sampling rate that shows it correctly',
              answer: 2 * f,
              unit: 'samples/s',
              traps: [
                { value: f, message: 'Two samples per period: $f_s > 2f$.', trapId: 'nyquist-half' },
                ...(visible ? [] : [{ value: 2 * fa, message: `That doubles the alias (${f4(fa)} Hz). To show the tone at its true frequency, $f_s$ must exceed twice the **true** frequency, ${f} Hz.` }]),
              ],
            })
          );
        } else {
          const inBand = f <= 0.4 * fsB;
          parts.push(
            choice('vis', 'Will the logger show it at the right frequency and amplitude?', [
              { text: 'Yes: it lies inside the filter’s flat band.', correct: inBand, why: inBand ? `${f} Hz ≤ $0.4f_s$ = ${f4(0.4 * fsB)} Hz: the filter passes it unchanged.` : `${f} Hz is above $0.4f_s$ = ${f4(0.4 * fsB)} Hz.` },
              { text: visible ? 'Not fully: it lies in the filter’s roll-off, so its amplitude reads low.' : 'No: it lies above $f_s/2$, so the filter removes it.', correct: !inBand, why: !inBand ? (visible ? `${f} Hz is between $0.4f_s$ = ${f4(0.4 * fsB)} Hz and $f_s/2$ = ${nyq} Hz, where the filter attenuates.` : `${f} Hz > $f_s/2$ = ${nyq} Hz: removed before sampling, which is what prevents an alias.`) : `${f} Hz is inside the flat band.` },
              { text: 'No: it appears at an aliased, false frequency.', correct: false, why: 'With the anti-aliasing filter fitted, content above $f_s/2$ is removed before sampling, so no alias forms.' },
            ]),
            num({
              id: 'alias',
              label: 'Where would it appear if the filter were bypassed?',
              answer: visible ? f : fa,
              unit: 'Hz',
              traps: [
                ...(f > nyq ? [{ value: f - nyq, message: 'Fold about multiples of $f_s$: $f_a = |f - kf_s|$.', trapId: 'alias-fold' }] : []),
                ...(visible
                  ? [{ value: fsB - f, message: `Below $f_s/2$ nothing folds: the nearest multiple of $f_s$ is $k$ = 0, so the tone appears at its own frequency.`, trapId: 'alias-fold' }]
                  : [...foldTraps(f, fsB), trueFreqTrap(f, fsB)]),
              ],
            }),
            num({
              id: 'fsNeed',
              label: 'Lowest sampling rate that puts it inside the flat band',
              answer: f / 0.4,
              unit: 'samples/s',
              traps: [
                { value: 2 * f, message: '$2f$ only puts it below Nyquist, in the filter’s roll-off. The flat band needs $0.4f_s \\ge f$.' },
                { value: 0.4 * f, message: 'Invert: $f_s \\ge f/0.4 = 2.5f$.' },
              ],
            })
          );
        }
        const k = Math.round(f / fsB);
        const h2 =
          tier === 2
            ? `(b) $f = \\text{order} \\times N/60$; observable if $f < f_s/2$; otherwise $f_a = |f - kf_s|$ with $k = \\text{round}(f/f_s)$; need $f_s > 2f$.`
            : '$f$ = order × $N$/60; flat band $f \\le 0.4f_s$; removed above $f_s/2$; bypassed: $f_a = |f - kf_s|$; flat band needs $f_s \\ge f/0.4 = 2.5f$.';
        hints[0] = (hints[0] ? `${hints[0]} ` : '') + `${lead}Convert the machine speed to Hz and multiply by the order; compare with $f_s/2$ (two samples per period), not with $f_s$.`;
        hints[1] = (tier === 2 ? `${hints[1]} ` : '') + h2;
        hints[2] = (tier === 2 ? `${hints[2]} ` : '') + `${lead}$f = ${order} \\times ${rpm}/60 = ${order} \\times ${f4(shaft)}$ Hz; $f_s/2 = ${nyq}$ Hz.`;
        const tail =
          tier === 2
            ? visible
              ? ` **Yes**, it is below Nyquist and shown correctly; it would need $f_s$ > **${f4(2 * f)} samples/s** at the limit.`
              : ` **No**: above Nyquist. Filtered out, or with no filter it appears at $|${f} - ${k} \\times ${fsB}|$ = **${f4(fa)} Hz**. It needs $f_s$ > **${f4(2 * f)} samples/s** (more in practice).`
            : ` ${f <= 0.4 * fsB ? '**Inside the flat band**: shown correctly.' : visible ? '**In the roll-off**: shown at the right frequency but attenuated.' : '**Above $f_s/2$**: the filter removes it.'} Bypassing the filter it would appear at **${f4(visible ? f : fa)} Hz**. For the flat band: $f_s \\ge ${f}/0.4$ = **${f4(f / 0.4)} samples/s**.`;
        hints[3] = (tier === 2 ? `${hints[3]}\n\n` : '') + `${lead}$f$ = **${f4(f)} Hz**; Nyquist = **${nyq} Hz**.${tail}`;
      }
      return { prompt, givens, parts, hints: hints as [string, string, string, string] };
    },
  },

  // ------------------------------------------------------------------ alias frequency
  {
    id: 'c3-alias',
    title: 'Where does an aliased tone appear?',
    summary: 'Fold $|f - kf_s|$ into $[0, f_s/2]$, find the rate that would show it, and tell an alias from a real tone.',
    tiers: [1, 2, 3],
    source: 'Similar to 2022 A3.5 (23 Hz at 40 samples/s → 17 Hz), 2021 A3.1 (12 kHz at 20 kHz → 8 kHz), 2025 A3.2(b)',
    cardId: 'c3-aliasing',
    generate(rng, tier) {
      if (tier === 3) {
        const fs = rng.pick([100, 200, 250, 400, 500, 1000]);
        let fa = 0;
        for (let a = 0; a < 100; a++) {
          fa = tidy(fs * rng.step(0.06, 0.44, 0.02), 3);
          if (Math.abs(fa / fs - 0.25) > 0.04 && Math.abs(fa / fs - 1 / 6) > 0.02 && Math.abs(fa / fs - 1 / 3) > 0.02) break;
        }
        const cands = [
          { v: fa, why: 'Itself: a genuine tone below Nyquist.' },
          { v: fs - fa, why: `$|${tidy(fs - fa)} - ${fs}| = ${fa}$.` },
          { v: fs + fa, why: `$|${tidy(fs + fa)} - ${fs}| = ${fa}$.` },
          { v: 2 * fs - fa, why: `$|${tidy(2 * fs - fa)} - ${2 * fs}| = ${fa}$.` },
          { v: fs / 2 + fa, why: '' },
          { v: fs / 2 - fa, why: '' },
          { v: 2 * fa, why: '' },
        ].map((c) => {
          const v = tidy(c.v, 3);
          const al = aliasInfo(v, fs).fa;
          const ok = Math.abs(al - fa) < 1e-6;
          return { text: `${v} Hz`, correct: ok, why: ok ? c.why || `Folds to ${fa} Hz.` : `It would appear at ${f4(al)} Hz, not ${fa} Hz.` };
        });
        return {
          prompt: `An FFT of data sampled at ${fs} samples/s with **no** anti-aliasing filter shows an unexpected sharp line at ${fa} Hz.`,
          givens: [
            { sym: 'f_s', value: `${fs} samples/s` },
            { sym: 'f_a', value: `${fa} Hz`, label: 'observed line' },
          ],
          parts: [
            choice('which', 'Which of these true frequencies could have produced the line? (Select all that apply.)', cands, true),
            num({
              id: 'lowest',
              label: 'The lowest frequency above the Nyquist frequency that would produce it',
              answer: fs - fa,
              unit: 'Hz',
              traps: [
                { value: fs / 2 + fa, message: 'Folding is about multiples of $f_s$, not about $f_s/2$: $f = f_s - f_a$.', trapId: 'alias-fold' },
                { value: fs + fa, message: 'That also aliases to the line, but it is not the lowest above Nyquist.' },
              ],
            }),
            choice('test', 'How could you tell whether the line is genuine?', [
              { text: 'Measure again at a different sampling rate: a genuine tone stays put, an alias moves.', correct: true, why: `E.g. at ${f4(1.2 * fs)} samples/s an alias of ${tidy(fs - fa)} Hz would move to ${f4(aliasInfo(fs - fa, 1.2 * fs).fa)} Hz.` },
              { text: 'Apply a Hann window: an alias disappears.', correct: false, why: 'A window changes leakage, not where an alias lands.' },
              { text: 'Record for longer: an alias is a resolution problem.', correct: false, why: 'Resolution has nothing to do with it; the alias stays.' },
              { text: 'Average more records: aliases average out.', correct: false, why: 'An alias is as repeatable as a real tone.' },
            ]),
          ],
          hints: [
            `Sampling at ${fs} samples/s cannot tell $f$ from $f \\pm kf_s$, so many true frequencies land on the same line.`,
            'Candidates: $f = kf_s \\pm f_a$ for $k = 0, 1, 2, \\dots$; the lowest one above $f_s/2$ is $f_s - f_a$.',
            `$f = ${fa},\\ ${fs} - ${fa},\\ ${fs} + ${fa},\\ ${2 * fs} - ${fa}, \\dots$ Hz.`,
            `Possible: **${fa}, ${tidy(fs - fa)}, ${tidy(fs + fa)}, ${tidy(2 * fs - fa)} Hz**, … The lowest above Nyquist is **${tidy(fs - fa)} Hz**. Changing $f_s$ is the test: an alias moves, a real tone does not. (Prevent it with an analogue anti-aliasing filter.)`,
          ],
        };
      }
      const kHz = tier === 2 && rng.chance(0.3);
      const fs = kHz ? rng.pick([10, 20, 25, 40, 50]) : rng.pick([20, 40, 50, 100, 200, 250, 500, 1000, 2000]);
      const unit = kHz ? 'kHz' : 'Hz';
      const sUnit = kHz ? 'kS/s' : 'samples/s';
      let u = 0.7;
      for (let a = 0; a < 100; a++) {
        u = tier === 1 ? rng.step(0.55, 0.95, 0.05) : rng.step(0.6, 2.9, 0.05);
        const frac = u - Math.floor(u);
        if (Math.abs(frac) > 0.04 && Math.abs(frac - 0.5) > 0.04 && Math.abs(frac - 1) > 0.04) break;
      }
      const f = tidy(u * fs, 3);
      const { fa, k } = aliasInfo(f, fs);
      const nyq = fs / 2;
      const parts: SolvePart[] = [];
      if (tier === 2)
        parts.push(
          num({
            id: 'nyq',
            label: 'Nyquist frequency',
            answer: nyq,
            unit,
            traps: [
              { value: fs, message: 'That is the sampling rate; the Nyquist frequency is half of it.', trapId: 'nyquist-half' },
              { value: 2 * fs, message: 'It is $f_s/2$, not $2f_s$: two samples are needed per period.', trapId: 'nyquist-half' },
            ],
          })
        );
      parts.push(
        num({
          id: 'fa',
          label: 'Frequency at which the FFT shows the tone',
          answer: fa,
          unit,
          traps: [
            trueFreqTrap(f, fs, unit),
            { value: Math.abs(f - nyq), message: 'Fold about multiples of $f_s$, not about $f_s/2$.', trapId: 'alias-fold' },
            { value: nyq, message: 'Content above Nyquist folds back below it; it is not clipped to $f_s/2$.', trapId: 'alias-fold' },
            // Stopping short of the nearest multiple (430 − 200 = 230 Hz at 200 samples/s) or folding once too often.
            ...foldTraps(f, fs, unit),
          ],
        })
      );
      if (tier === 2)
        parts.push(
          num({
            id: 'fsNeed',
            label: 'Lowest sampling rate that would show it at its true frequency',
            answer: 2 * f,
            unit: sUnit,
            traps: [
              { value: f, message: '$f_s > 2f$: two samples per period.', trapId: 'nyquist-half' },
              { value: 2 * fa, message: `That doubles the alias (${f4(fa)} ${unit}). To show the tone at its true frequency, $f_s$ must exceed twice the **true** frequency, ${f} ${unit}.` },
            ],
          })
        );
      return {
        prompt: `A vibration component at ${f} ${unit} is sampled at ${fs} ${sUnit} with no anti-aliasing filter.`,
        givens: [
          { sym: 'f', value: `${f} ${unit}`, label: 'true frequency' },
          { sym: 'f_s', value: `${fs} ${sUnit}` },
        ],
        parts,
        hints: [
          'Above $f_s/2$ a tone is not lost but disguised: its samples match those of a lower frequency, found by folding the frequency axis about multiples of $f_s$.',
          '$f_a = |f - kf_s|$ with $k = \\text{round}(f/f_s)$, which always lands in $[0, f_s/2]$. To show $f$ correctly: $f_s > 2f$.',
          `$f/f_s = ${f}/${fs} = ${f4(f / fs)}$, so $k$ = ${k}; $f_s/2$ = ${nyq} ${unit}.`,
          `$f_a = |${f} - ${k} \\times ${fs}|$ = **${f4(fa)} ${unit}**${tier === 2 ? `; Nyquist = **${nyq} ${unit}**; to see ${f} ${unit} correctly $f_s$ > **${f4(2 * f)} ${sUnit}** (with an anti-aliasing filter, in practice about ${f4(2.5 * f)})` : ''}.`,
        ],
      };
    },
  },

  // ------------------------------------------------------------------ lines, N and Δf
  {
    id: 'c3-lines',
    title: 'Lines, samples and resolution of an FFT set-up',
    summary: 'Translate between $f_s$, $N$, $T$, $\\Delta f$ and the number of lines; check whether close modes separate.',
    tiers: [1, 2, 3],
    source: 'LC3 Eqs 3.4–3.5; official 2017–2019 A3.1 statements; 2023 A3.2',
    cardId: 'c3-sampling',
    generate(rng, tier) {
      if (tier === 1) {
        let fs = 1024;
        let N = 1024;
        for (let a = 0; a < 50; a++) {
          fs = rng.pick([256, 512, 1000, 1024, 2000, 2048, 5000, 10240]);
          N = rng.pick([256, 512, 1024, 2048, 4096, 8192]);
          const T = N / fs;
          if (T >= 0.05 && T <= 20) break;
        }
        const T = N / fs;
        const df = fs / N;
        return {
          prompt: `An FFT analyser samples at ${fs} samples/s and takes $N$ = ${N} samples per record.`,
          givens: [
            { sym: 'f_s', value: `${fs} samples/s` },
            { sym: 'N', value: `${N}` },
          ],
          parts: [
            num({
              id: 'T',
              label: 'Record length $T$',
              answer: T,
              unit: 's',
              traps: [
                { value: df, message: 'That is $\\Delta f = f_s/N$; the record length is $N/f_s$.' },
                { value: 1 / fs, message: 'That is the time step $\\Delta t$.' },
                { value: N / 2 / fs, message: 'That counts only $N/2$ samples (the number of lines). The record holds all $N$: $T = N/f_s$.', trapId: 'lines-half' },
              ],
            }),
            num({
              id: 'df',
              label: 'Line spacing $\\Delta f$',
              answer: df,
              unit: 'Hz',
              traps: [
                { value: (2 * fs) / N, message: 'The lines run from 0 to $f_s/2$, not to $f_s$: the spacing is $(f_s/2)/(N/2) = 1/T = f_s/N$.', trapId: 'nyquist-half' },
                { value: T, message: 'That is $T$; $\\Delta f = 1/T$.' },
                { value: 1 / fs, message: 'That is $\\Delta t$.' },
                { value: 1 / N, message: `$\\Delta f$ is not $1/N$: it is $1/T = 1/(N\\Delta t) = f_s/N$, so the time step matters (LC3 Eq 3.5).`, trapId: 'resolution-record' },
                { value: fs / (2 * N), message: 'That spreads $f_s/2$ over $N$ lines, but there are only $N/2$ of them: $\\Delta f = (f_s/2)/(N/2) = f_s/N$.', trapId: 'lines-half' },
              ],
            }),
            num({ id: 'lines', label: 'Number of lines up to the Nyquist frequency', answer: N / 2, unit: '', traps: [{ value: N, message: '$N$ samples give $N/2$ lines.', trapId: 'lines-half' }] }),
          ],
          hints: [
            'Record length is samples × time step; the line spacing is its inverse; the lines run up to $f_s/2$.',
            '$T = N/f_s$, $\\Delta f = 1/T = f_s/N$, lines $= N/2$, Nyquist $= f_s/2$.',
            `$T = ${N}/${fs}$; $\\Delta f = ${fs}/${N}$.`,
            `$T$ = **${f4(T)} s**, $\\Delta f$ = **${f4(df)} Hz**, **${N / 2} lines** of ${f4(df)} Hz up to $f_s/2$ = ${fs / 2} Hz.`,
          ],
        };
      }
      if (tier === 2) {
        const F = rng.pick([100, 200, 500, 1000, 2000, 5000]);
        const L = rng.pick([200, 400, 800, 1600, 3200]);
        const df = F / L;
        const T = 1 / df;
        const N = 2 * L;
        const fA = tidy(F * rng.step(0.15, 0.7, 0.05), 3);
        const mult = rng.pick([0.6, 1, 1.5, 2.5, 4]);
        const delta = tidy(df * mult, 4);
        const sep = delta / df >= 2;
        return {
          prompt: `An FFT is set to show 0–${F} Hz (its Nyquist frequency) with ${L} lines. Two modes of the test structure sit at ${fA} Hz and ${tidy(fA + delta, 4)} Hz.`,
          givens: [
            { sym: 'f_{Nyq}', value: `${F} Hz` },
            { sym: '\\text{lines}', value: `${L}` },
          ],
          parts: [
            num({
              id: 'df',
              label: 'Line spacing $\\Delta f$',
              answer: df,
              unit: 'Hz',
              traps: [
                { value: (2 * F) / L, message: `That divides $f_s$ by the lines, but the lines cover only 0 to $f_s/2$ = ${F} Hz: $\\Delta f = f_{Nyq}/\\text{lines}$.`, trapId: 'nyquist-half' },
                { value: L / F, message: 'That is $T$; $\\Delta f = 1/T$.' },
                { value: F / (2 * L), message: `That divides $f_{Nyq}$ by $N$ = 2 × lines. The ${L} lines span 0 to $f_{Nyq}$: $\\Delta f = f_{Nyq}/\\text{lines} = f_s/N$.`, trapId: 'lines-half' },
                { value: 1 / (2 * L), message: '$\\Delta f$ is not $1/N$: it is $1/T = 1/(N\\Delta t) = f_s/N$.', trapId: 'resolution-record' },
              ],
            }),
            num({
              id: 'T',
              label: 'Record length $T$',
              answer: T,
              unit: 's',
              traps: [
                { value: df, message: 'That is $\\Delta f$; $T = 1/\\Delta f$.' },
                { value: T / 2, message: 'That is lines/$f_s$: the record holds $N$ = 2 × lines samples, so $T = N/f_s$ = lines/$f_{Nyq}$.', trapId: 'lines-half' },
                { value: 2 * T, message: `That uses $f_{Nyq}$ as the sampling rate. $f_s = 2f_{Nyq}$ = ${2 * F} samples/s, so $T = N/f_s$ = lines/$f_{Nyq}$.`, trapId: 'nyquist-half' },
              ],
            }),
            num({ id: 'N', label: 'Number of samples $N$', answer: N, unit: '', traps: [{ value: L, message: 'That is the number of lines; $N$ = 2 × lines.', trapId: 'lines-half' }] }),
            choice('sep', 'Will the two modes appear as separate peaks (at least 2 lines apart)?', [
              { text: 'Yes: they are at least two lines apart.', correct: sep, why: `${delta}/${f4(df)} = ${f3(delta / df)} lines${sep ? ': separate peaks.' : ', fewer than 2: they merge.'}` },
              { text: 'No: they are fewer than two lines apart.', correct: !sep, why: !sep ? `Only ${f3(delta / df)} lines. A record of at least ${f4(2 / delta)} s ($\\Delta f \\le$ ${f4(delta / 2)} Hz) would separate them.` : `They are ${f3(delta / df)} lines apart.` },
              { text: 'It depends on the sampling rate.', correct: false, why: 'Separation in lines is $\\delta/\\Delta f = \\delta T$: record length only.' },
            ]),
          ],
          hints: [
            'The lines span 0 to the Nyquist frequency, so their spacing is the span divided by the number of lines; the record length is the inverse of the spacing.',
            '$\\Delta f = f_{Nyq}/\\text{lines}$, $T = 1/\\Delta f$, $N$ = 2 × lines, $f_s = 2f_{Nyq}$; separation in lines = $\\delta/\\Delta f$.',
            `$\\Delta f = ${F}/${L}$; the modes are $\\delta$ = ${delta} Hz apart.`,
            `$\\Delta f$ = **${f4(df)} Hz**, $T$ = **${f4(T)} s**, $N$ = **${N}** ($f_s$ = ${2 * F} samples/s). ${delta} Hz / ${f4(df)} Hz = ${f3(delta / df)} lines, so **${sep ? 'yes, separate peaks' : 'no, they merge'}**.`,
          ],
        };
      }
      const fs = rng.pick([256, 512, 1024, 2048, 4096]);
      const delta = rng.pick([0.05, 0.1, 0.2, 0.25, 0.5, 1]);
      const Tmin = 3 / delta;
      const Nmin = fs * Tmin;
      const N2 = nextPow2(Math.ceil(Nmin - 1e-9));
      const T2 = N2 / fs;
      const df2 = 1 / T2;
      return {
        prompt: `Two closely spaced modes, ${delta} Hz apart, must be separated by at least 3 lines. The analyser samples at ${fs} samples/s and needs $N = 2^n$.`,
        givens: [
          { sym: '\\delta', value: `${delta} Hz`, label: 'mode spacing' },
          { sym: 'f_s', value: `${fs} samples/s` },
        ],
        parts: [
          num({ id: 'Tmin', label: 'Shortest record length before rounding $N$', answer: Tmin, unit: 's', traps: [{ value: 1 / delta, message: 'That gives only 1 line between them; 3 lines need $\\Delta f \\le \\delta/3$.' }, { value: delta / 3, message: 'That is $\\Delta f$; $T = 1/\\Delta f$.' }] }),
          num({ id: 'N', label: 'Number of samples $N$ (power of 2)', answer: N2, unit: '', tol: 0.001, traps: [{ value: Nmin, message: 'Round up to the next power of 2.' }, { value: N2 / 2, message: 'Rounding down makes $\\Delta f$ too coarse.' }] }),
          num({
            id: 'df',
            label: 'Resulting line spacing $\\Delta f$',
            answer: df2,
            unit: 'Hz',
            traps: [
              { value: delta / 3, message: 'That is the target; rounding $N$ up made it finer.' },
              { value: 1 / N2, message: '$\\Delta f$ is not $1/N$: it is $1/T = f_s/N$.', trapId: 'resolution-record' },
              { value: fs / 2 / N2, message: 'That spreads $f_s/2$ over $N$ lines, but there are only $N/2$: $\\Delta f = f_s/N$.', trapId: 'lines-half' },
            ],
          }),
        ],
        hints: [
          'Separation in lines is the mode spacing divided by $\\Delta f$, and only the record length sets $\\Delta f$.',
          '$\\Delta f \\le \\delta/3 \\Rightarrow T \\ge 3/\\delta$; $N \\ge f_sT$ rounded up to a power of 2; then $\\Delta f = f_s/N$.',
          `$T \\ge 3/${delta} = ${f4(Tmin)}$ s; $f_sT = ${fs} \\times ${f4(Tmin)} = ${f4(Nmin)}$.`,
          `$T_{min}$ = **${f4(Tmin)} s**; $N$ = **${N2}**; then $T = ${N2}/${fs} = ${f4(T2)}$ s and $\\Delta f$ = **${f4(df2)} Hz**, giving ${f3(delta / df2)} lines between the modes.`,
        ],
      };
    },
  },

  // ------------------------------------------------------------------ windows
  {
    id: 'c3-window',
    title: 'Choosing and correcting a window',
    summary: 'Which way to beat leakage for a given signal, and how to read a windowed amplitude.',
    tiers: [1, 2, 3],
    source: 'Summary notes C3 (“window, then correct the amplitude”); LC3-4; Week 11 Q4 worked',
    cardId: 'c3-leakage',
    generate(rng, tier) {
      const CGf = flatTopGain();
      if (tier === 1) {
        const win = rng.pick(['Hann', 'flat-top'] as const);
        const R = rng.nice(rng.uniform(0.2, 5), 2);
        const cg = win === 'Hann' ? 0.5 : CGf;
        const A = R / cg;
        return {
          prompt: `A steady tone lies exactly on a line. A ${win}-windowed spectrum, with no amplitude correction, reads ${R} mm at that line.`,
          givens: [
            { sym: '\\text{reading}', value: `${R} mm` },
            { sym: 'CG', value: win === 'Hann' ? '0.5' : f4(cg), label: `coherent gain of the ${win} window` },
          ],
          parts: [
            num({
              id: 'A',
              label: 'Amplitude of the tone',
              answer: A,
              unit: 'mm',
              traps: [
                { value: R * cg, message: 'The window lowered the reading, so divide by the coherent gain; you multiplied.', trapId: 'window-correction' },
                { value: R, message: 'That is the uncorrected reading.', trapId: 'window-correction' },
                { value: R * Math.SQRT2, message: '× √2 converts RMS to amplitude; it is not the window correction.', trapId: 'window-correction' },
              ],
            }),
          ],
          hints: [
            'A window multiplies the record by a taper whose average value (the coherent gain) is below 1, so an on-line tone reads low by exactly that factor.',
            'Amplitude = reading / CG (Hann CG = 0.5; flat-top CG ≈ 0.216).',
            `Amplitude = ${R}/${win === 'Hann' ? '0.5' : f4(cg)}.`,
            `Amplitude = **${f4(A)} mm** (${win === 'Hann' ? '× 2' : `× ${f4(1 / cg)}`}). For an FRF this correction cancels if force and response use the same window.`,
          ],
        };
      }
      if (tier === 2) {
        const sc = rng.pick(['impact', 'random', 'periodic', 'amplitude'] as const);
        // Why a taper window is wrong (or second best) depends on the scenario: on an impact record it would
        // suppress the hit itself, which sits at the start of the record where every taper is zero.
        const hannWhy: Record<string, string> = {
          impact: 'No: a Hann window is zero at the start of the record, where the impact sits, so it would suppress the measured force and distort the decay (and the damping estimate). A complete transient needs no window.',
          periodic: 'It would work, but when you can choose $T$, whole periods give exact, sharper lines with no window at all.',
          amplitude: 'Not accurate enough: even after the × 2 correction, Hann reads up to about 15 % low when the tone falls half-way between lines.',
        };
        const opts = (best: string) => [
          { text: 'No window (rectangular), because the whole event fits inside the record', correct: best === 'impact', why: best === 'impact' ? 'A transient that has died away within $T$ does not leak (LC3-4).' : 'Only valid when the signal is a complete transient inside the record.' },
          { text: 'A Hann window applied to both force and response', correct: best === 'random', why: best === 'random' ? 'Random signals are never periodic in $T$; the same window on both channels cancels in $H$.' : hannWhy[best] },
          { text: 'No window, with $T$ set to a whole number of periods', correct: best === 'periodic', why: best === 'periodic' ? 'Every tone then sits on a line: no leakage and the sharpest peaks.' : 'Only possible when you know and control the periods.' },
          { text: 'A flat-top window', correct: best === 'amplitude', why: best === 'amplitude' ? 'Reads the amplitude to about 0.1 % wherever the tone falls between lines (at the cost of a wide peak).' : best === 'impact' ? 'No: like any taper it is almost zero at the start of the record, where the impact sits; a complete transient needs no window.' : 'Accurate amplitudes but very wide peaks; not needed here.' },
        ];
        if (sc === 'impact') {
          const T = rng.pick([1, 2, 4, 5, 8]);
          return {
            prompt: `A hammer test on a lightly damped bracket: the response has decayed to the noise floor well inside the ${T} s record.`,
            givens: [{ sym: 'T', value: `${T} s` }],
            parts: [
              choice('how', 'How should leakage be handled?', opts('impact')),
              num({ id: 'df', label: 'Line spacing of the spectrum', answer: 1 / T, unit: 'Hz', traps: [{ value: T, message: 'That is $T$; $\\Delta f = 1/T$.' }] }),
            ],
            hints: [
              'Leakage comes from the jump where the record meets its own repeat. A transient that has finished inside the record joins smoothly (zero to zero).',
              'Complete transient → no window needed (LC3-4); $\\Delta f = 1/T$.',
              `$\\Delta f = 1/${T}$.`,
              `**No window**: the whole transient is captured, so nothing leaks. $\\Delta f$ = **${f4(1 / T)} Hz**. (A Hann window would distort the decay and the damping estimate.)`,
            ],
          };
        }
        if (sc === 'random') {
          const Xr = rng.nice(rng.uniform(0.3, 6), 2);
          const Fr = rng.nice(rng.uniform(5, 60), 2);
          const H = Xr / Fr;
          return {
            prompt: `A shaker drives a frame with broadband random force; force and acceleration are recorded continuously and averaged. At one line the Hann-windowed (uncorrected) spectra read ${Fr} N and ${Xr} m/s².`,
            givens: [
              { sym: '|F|', value: `${Fr} N`, label: 'Hann, uncorrected' },
              { sym: '|X|', value: `${Xr} m/s²`, label: 'Hann, uncorrected' },
            ],
            parts: [
              choice('how', 'How should leakage be handled?', opts('random')),
              num({
                id: 'H',
                label: '$|H|$ at that line (accelerance)',
                answer: H,
                unit: '(m/s²)/N',
                traps: [
                  { value: (2 * Xr) / Fr, message: 'The same window on both channels cancels in the ratio: no correction for $H$.', trapId: 'window-correction' },
                  { value: Xr / (2 * Fr), message: 'The correction cancels: $|H| = |X|/|F|$ directly.', trapId: 'window-correction' },
                  { value: Fr / Xr, message: 'FRF = response / force.' },
                ],
              }),
            ],
            hints: [
              'Random signals never repeat within the record, so they always leak; a taper on both channels keeps the FRF consistent.',
              'Same window on force and response: its gain cancels in $H = X/F$ (LC3-4).',
              `$|H| = ${Xr}/${Fr}$.`,
              `**Hann on both channels**; $|H|$ = **${f4(H)} (m/s²)/N**, no amplitude correction needed for a ratio.`,
            ],
          };
        }
        if (sc === 'periodic') {
          const rpm = rng.pick([600, 750, 900, 1200, 1500, 1800, 3000]);
          const f = rpm / 60;
          const cycles = rng.pick([10, 16, 20, 25, 40, 50]);
          const T = cycles / f;
          return {
            prompt: `A constant-speed fan runs at ${rpm} rpm; you want its 1× and harmonic amplitudes, and you can choose the record length.`,
            givens: [{ sym: 'N', value: `${rpm} rpm` }],
            parts: [
              choice('how', 'How should leakage be handled?', opts('periodic')),
              num({ id: 'T', label: `Record length that holds exactly ${cycles} shaft revolutions`, answer: T, unit: 's', traps: [{ value: cycles / rpm, message: 'Convert rpm to rev/s (÷ 60) first.', trapId: 'units' }, { value: cycles * f, message: 'Period = 1/f; $T$ = cycles/$f$.' }] }),
            ],
            hints: [
              'If the record holds a whole number of periods, its repeat joins without a jump and every harmonic falls on a line.',
              `$T = n/f$ with $f = N/60$; then the lines $k/T$ include $f, 2f, 3f, \\dots$`,
              `$f = ${rpm}/60 = ${f4(f)}$ Hz; $T = ${cycles}/${f4(f)}$.`,
              `**Whole periods, no window**; $T$ = **${f4(T)} s** ($\\Delta f$ = ${f4(1 / T)} Hz, so 1× is line ${cycles}, 2× line ${2 * cycles}, …).`,
            ],
          };
        }
        const R = rng.nice(rng.uniform(0.1, 1.2), 2);
        const A = R / CGf;
        return {
          prompt: `A calibration check must read the amplitude of a single tone of unknown, drifting frequency to within 1 %. The uncorrected spectrum with your chosen window reads ${R} V at the peak line.`,
          givens: [{ sym: '\\text{reading}', value: `${R} V` }],
          parts: [
            choice('how', 'Which choice suits this task?', opts('amplitude')),
            num({
              id: 'A',
              label: 'Tone amplitude (flat-top coherent gain ≈ 0.2156)',
              answer: A,
              unit: 'V',
              traps: [
                { value: R * CGf, message: 'Divide by the coherent gain; you multiplied.', trapId: 'window-correction' },
                { value: R, message: 'That is the uncorrected reading.', trapId: 'window-correction' },
                { value: 2 * R, message: '× 2 is the Hann correction; flat-top has CG ≈ 0.2156.', trapId: 'window-correction' },
              ],
            }),
          ],
          hints: [
            'With an unknown frequency the tone will usually fall between lines; rectangular and Hann then read low (scalloping). A flat-top window has a flat main lobe.',
            'Flat-top: amplitude = reading / 0.2156, accurate to about 0.1 % anywhere between lines (beyond the reader; standard practice).',
            `Amplitude = ${R}/0.2156.`,
            `**Flat-top window**; amplitude = **${f4(A)} V**. Its peak is very wide, so it is poor at separating close tones.`,
          ],
        };
      }
      const A = rng.nice(rng.uniform(0.5, 4), 2);
      const s = scallop();
      const fl = rng.pick([12, 15, 20, 25, 40]);
      return {
        prompt: `A tone of amplitude ${A} mm sits exactly half-way between two lines (e.g. ${fl + 0.5} Hz with 1 Hz lines). Predict the peak reading.`,
        givens: [{ sym: 'A', value: `${A} mm` }],
        parts: [
          num({
            id: 'rect',
            label: 'Rectangular window (no window)',
            answer: A * s.rect,
            unit: 'mm',
            tol: 0.03,
            traps: [
              { value: A, message: 'Half-way between lines is the worst case for leakage: the energy splits between the two neighbours.' },
              { value: A * s.hann, message: 'That is the corrected Hann value; rectangular loses more.' },
              { value: A / 2, message: 'Not quite half: about $2/\\pi \\approx 0.64$.' },
            ],
          }),
          num({
            id: 'hann',
            label: 'Hann window, amplitude-corrected (× 2)',
            answer: A * s.hann,
            unit: 'mm',
            tol: 0.03,
            traps: [
              { value: A * s.hann * 0.5, message: 'Apply the × 2 coherent-gain correction.', trapId: 'window-correction' },
              { value: A, message: 'Hann still scallops between lines (about −1.4 dB).' },
              { value: A * s.rect, message: 'That is the rectangular value.' },
            ],
          }),
          choice('best', 'Which reads an off-line tone’s amplitude most accurately, and at what cost?', [
            { text: 'Flat-top: within about 0.1 %, but its peak is several lines wide.', correct: true, why: 'Its main lobe is flat across a whole line, so scalloping is negligible; the wide lobe blurs close tones.' },
            { text: 'Rectangular: no window means no distortion.', correct: false, why: `It is the worst between lines: ${f3(s.rect)} of the amplitude.` },
            { text: 'Hann: exact once corrected.', correct: false, why: `The correction fixes on-line tones; half-way it still reads ${f3(s.hann)} of the amplitude.` },
          ]),
        ],
        hints: [
          'Between lines the tone’s energy is shared by its neighbours (scalloping). The worst case is half-way. A window changes the shape of each line’s response, and so the loss.',
          'Rectangular half-way: $\\approx 2/\\pi$ of $A$. Hann (corrected): $\\approx 0.85A$. Flat-top: $\\approx A$.',
          `Rectangular: ${A} × ${f3(s.rect)}; Hann: ${A} × ${f3(s.hann)}.`,
          `Rectangular **${f3(A * s.rect)} mm** (−${f3(100 * (1 - s.rect))} %), Hann corrected **${f3(A * s.hann)} mm** (−${f3(100 * (1 - s.hann))} %). **Flat-top** gets the amplitude right but blurs close tones; whole-period records beat all windows when you can arrange them.`,
        ],
      };
    },
  },

  // ------------------------------------------------------------------ H1, H2 and coherence bias
  {
    id: 'c3-h1h2',
    title: 'Noise bias of H₁ and H₂, and the coherence',
    summary: 'From noise levels to $|H_1|/|H|$, $|H_2|/|H|$ and $\\gamma^2$; which estimate to trust.',
    tiers: [1, 2, 3],
    source: 'Similar to Week 12 Q5 (noise 25 % of the signal power); LC3-8, LC3-9',
    cardId: 'c3-h1h2',
    generate(rng, tier) {
      if (tier === 3) {
        const rin = rng.pick([0.1, 0.2, 0.3, 0.4]);
        const rout = rng.pick([0.1, 0.2, 0.3, 0.5]);
        const qi = rin * rin;
        const qo = rout * rout;
        const b = noiseBias(qi, qo);
        return {
          prompt: `A modal test has noise on both channels: the force noise RMS is ${Math.round(rin * 100)} % of the force RMS and the response noise RMS is ${Math.round(rout * 100)} % of the response RMS at the line of interest. Many averages are taken.`,
          givens: [
            { sym: '\\rho_{in}', value: `${Math.round(rin * 100)} %`, label: 'input noise RMS ratio' },
            { sym: '\\rho_{out}', value: `${Math.round(rout * 100)} %`, label: 'output noise RMS ratio' },
          ],
          parts: [
            num({ id: 'h1', label: '$|H_1|/|H|$', answer: b.h1, unit: '', traps: [{ value: 1 / (1 + rin), message: 'Square the RMS ratio: the noise **power** ratio is $q = \\rho^2$.', trapId: 'rms-vs-power' }, { value: 1 + qi, message: 'Input noise inflates $S_{ff}$ in the denominator, so $H_1$ reads **low**.', trapId: 'noise-bias-direction' }, { value: b.h1 / (1 + qo), message: '$H_1$ is unbiased by output noise.' }] }),
            num({ id: 'h2', label: '$|H_2|/|H|$', answer: b.h2, unit: '', traps: [{ value: 1 + rout, message: 'Square the RMS ratio.', trapId: 'rms-vs-power' }, { value: 1 / (1 + qo), message: 'Output noise inflates $S_{xx}$ in the numerator, so $H_2$ reads **high**.', trapId: 'noise-bias-direction' }] }),
            num({ id: 'coh', label: 'Coherence $\\gamma^2$', answer: b.coherence, unit: '', traps: [{ value: 1 - qi - qo, message: 'Close, but use $\\gamma^2 = 1/((1+q_{in})(1+q_{out})) = |H_1|/|H_2|$.' }, { value: b.h1, message: 'That is only the input part; multiply by $1/(1+q_{out})$.' }] }),
            choice('trust', 'At an anti-resonance of this structure the response is tiny. Which estimate is closer to the truth there?', [
              { text: '$H_1$: output noise dominates there and $H_1$ is unbiased by it.', correct: true, why: 'Where the response is small, $q_{out}$ is large; $H_2$ shoots up, $H_1$ only carries the (small) input bias.' },
              { text: '$H_2$: it is the estimate for low response.', correct: false, why: '$H_2$ is unbiased by input noise; output noise makes it read high.' },
              { text: 'Both are equally good once averaged.', correct: false, why: 'Averaging removes random scatter, not the bias.' },
            ]),
          ],
          hints: [
            'Noise on the force inflates $S_{ff}$ (biasing $H_1$ low); noise on the response inflates $S_{xx}$ (biasing $H_2$ high). The cross-spectrum is untouched by uncorrelated noise.',
            '$q = \\rho^2$; $|H_1|/|H| = 1/(1+q_{in})$, $|H_2|/|H| = 1+q_{out}$, $\\gamma^2 = |H_1/H_2| = 1/((1+q_{in})(1+q_{out}))$.',
            `$q_{in} = ${rin}^2 = ${f4(qi)}$, $q_{out} = ${rout}^2 = ${f4(qo)}$.`,
            `$|H_1|/|H|$ = **${f4(b.h1)}**, $|H_2|/|H|$ = **${f4(b.h2)}**, $\\gamma^2$ = **${f4(b.coherence)}**. At an anti-resonance trust **$H_1$**.`,
          ],
        };
      }
      const side = rng.pick(['input', 'output'] as const);
      const isRms = tier === 2;
      const rho = rng.pick([0.1, 0.2, 0.3, 0.4, 0.5, 0.7]);
      const q = isRms ? rho * rho : rng.pick([0.04, 0.1, 0.25, 0.5, 1]);
      const b = side === 'input' ? noiseBias(q, 0) : noiseBias(0, q);
      const where = side === 'input' ? 'the force (input) signal' : 'the response (output) signal';
      const parts: SolvePart[] = [];
      if (isRms) parts.push(num({ id: 'q', label: 'Noise power ratio $q$', answer: q, unit: '', traps: [{ value: rho, message: 'Square the RMS ratio: power goes as amplitude squared.', trapId: 'rms-vs-power' }] }));
      parts.push(
        num({
          id: 'h1',
          label: '$|H_1|/|H|$',
          answer: b.h1,
          unit: '',
          traps:
            side === 'input'
              ? [{ value: 1 + q, message: 'Wrong direction: the noise inflates $S_{ff}$ in the **denominator**, so $H_1$ reads low.', trapId: 'noise-bias-direction' }, { value: 1, message: '$H_1$ is biased by input noise.' }, ...(isRms ? [{ value: 1 / (1 + rho), message: 'Square the RMS ratio.', trapId: 'rms-vs-power' }] : [])]
              : [{ value: 1 / (1 + q), message: '$H_1 = S_{fx}/S_{ff}$ does not contain $S_{xx}$: output noise does not bias it.', trapId: 'noise-bias-direction' }],
        }),
        num({
          id: 'h2',
          label: '$|H_2|/|H|$',
          answer: b.h2,
          unit: '',
          traps:
            side === 'output'
              ? [{ value: 1 / (1 + q), message: 'Wrong direction: the noise inflates $S_{xx}$ in the **numerator**, so $H_2$ reads high.', trapId: 'noise-bias-direction' }, { value: 1, message: '$H_2$ is biased by output noise.' }, ...(isRms ? [{ value: 1 + rho, message: 'Square the RMS ratio.', trapId: 'rms-vs-power' }] : [])]
              : [{ value: 1 + q, message: '$H_2 = S_{xx}/S_{xf}$ contains no $S_{ff}$: input noise does not bias it.', trapId: 'noise-bias-direction' }],
        }),
        num({ id: 'coh', label: 'Coherence $\\gamma^2$', answer: b.coherence, unit: '', traps: [{ value: 1 - q, message: 'Use $\\gamma^2 = 1/(1+q)$ exactly.' }, { value: q, message: 'That is the noise ratio itself.' }] })
      );
      if (tier === 2)
        parts.push(
          choice('trust', 'Which estimate should be used?', [
            { text: side === 'input' ? '$H_2$, because the noise is on the input' : '$H_1$, because the noise is on the output', correct: true, why: side === 'input' ? '$H_2$ avoids comparing the noisy force with itself (LC3-8); typical near resonances, where the force drops.' : '$H_1$ avoids comparing the noisy response with itself; typical near anti-resonances.' },
            { text: side === 'input' ? '$H_1$, because it uses the force auto-spectrum' : '$H_2$, because it uses the response auto-spectrum', correct: false, why: 'That is exactly the auto-spectrum polluted by the noise.' },
            { text: 'Either: averaging removes the noise', correct: false, why: 'Averaging removes scatter, not the bias.' },
          ])
        );
      const qTxt = isRms ? `$q = ${rho}^2 = ${f4(q)}$; ` : '';
      const qBold = isRms ? `$q = ${rho}^2$ = **${f4(q)}**; ` : '';
      return {
        prompt: `In an averaged FRF measurement, uncorrelated noise appears only on ${where}, with ${isRms ? `an RMS of ${Math.round(rho * 100)} % of that signal’s RMS` : `a power of ${Math.round(q * 100)} % of that signal’s power`}.`,
        givens: [{ sym: isRms ? '\\rho' : 'q', value: isRms ? `${Math.round(rho * 100)} %` : `${q}`, label: isRms ? 'noise RMS / signal RMS' : 'noise power / signal power' }],
        parts,
        hints: [
          'Uncorrelated noise averages out of the cross-spectrum $S_{fx}$ but adds its power to the auto-spectrum of the channel it is on.',
          `${isRms ? '$q = \\rho^2$; ' : ''}input noise: $|H_1|/|H| = 1/(1+q)$, $H_2$ exact; output noise: $H_1$ exact, $|H_2|/|H| = 1+q$; $\\gamma^2 = 1/(1+q)$.`,
          `${qTxt}noise on the ${side}, so ${side === 'input' ? '$S_{ff}$' : '$S_{xx}$'} is multiplied by $1 + q = ${f4(1 + q)}$.`,
          `${qBold}$|H_1|/|H|$ = **${f4(b.h1)}**, $|H_2|/|H|$ = **${f4(b.h2)}**, $\\gamma^2$ = **${f4(b.coherence)}**${tier === 2 ? `. Use **${side === 'input' ? '$H_2$' : '$H_1$'}**` : ''}.`,
        ],
      };
    },
  },
];
