// Self-tests for topic C3: exam values (2021–2025 A3), reader Coding Example 1, the Week 11/12
// worked solutions, the topic's own helpers, and a sanity sweep of every generator.
import type { CheckResult, SelfTest } from '../../selftest/types';
import type { NumericPart, SolveInstance } from '../../engine/types';
import { checkNumeric } from '../../engine/check';
import { near, nearAbs, isTrue } from '../../selftest/assert';
import { aliasFrequency, amplitudeSpectrum, gcdFrequencies, nyquist, resolution, simulateFRFMeasurement } from '../../physics/dsp';
import { cabs } from '../../physics/complex';
import { makeRng } from '../../engine/rng';
import { aliasInfo, aliasWave, minRecordLength, minSampleRate, noiseBias, scallopReading, ssBeamAccelerance } from './physics';
import { generators } from './solve';
import { mcqs } from './quiz';

const TAU = 2 * Math.PI;

/** Largest corrected amplitude within ±2 lines of f (and the line it sits on). */
function peakNear(x: ArrayLike<number>, fs: number, f: number, kind: 'rect' | 'hann' | 'flattop' = 'rect') {
  const s = amplitudeSpectrum(x, fs, kind);
  const df = s.f[1] - s.f[0];
  const k0 = Math.round(f / df);
  let best = { a: 0, f: 0 };
  for (let k = Math.max(0, k0 - 2); k <= Math.min(s.f.length - 1, k0 + 2); k++) if (s.amp[k] > best.a) best = { a: s.amp[k], f: s.f[k] };
  return best;
}

const record = (fs: number, N: number, fn: (t: number) => number) => Array.from({ length: N }, (_, n) => fn(n / fs));

const genById = (id: string) => generators.find((g) => g.id === id)!;
const numPart = (inst: SolveInstance, id: string) => inst.parts.find((p) => p.id === id && p.kind === 'numeric') as NumericPart | undefined;
const given = (inst: SolveInstance, sym: string) => parseFloat(inst.givens?.find((g) => g.sym === sym)?.value ?? 'NaN');
/** The trap id the checker names for a typed value ('' if it is accepted or only gets generic feedback). */
const trapFor = (p: NumericPart, v: number) => {
  const r = checkNumeric(p, String(v));
  return r.correct ? 'CORRECT' : r.trapId || '';
};

export const tests: SelfTest[] = [
  {
    id: 'c3-exam-sampling',
    topic: 'C3',
    title: 'Sampling, resolution and Nyquist: 2023, 2024 and 2025 A3.2',
    source: '2023 A3.2, 2024 A3.2, 2025 A3.2 worked solutions; LC3 Eqs 3.4–3.5',
    run: () => [
      near('2023 A3.2: fs = 2 × 10 Hz = 20 samples/s', minSampleRate(10), 20, 1e-12),
      near('2023 A3.2: T = 1/0.05 = 20 s', minRecordLength(0.05), 20, 1e-12),
      near('2023 A3.2: N = fs T = 400 samples (200 lines)', minSampleRate(10) * minRecordLength(0.05), 400, 1e-12),
      near('2024 A3.2: Δf_max = gcd(10, 13, 30) = 1 Hz', gcdFrequencies([10, 13, 30]), 1, 1e-12),
      near('2024 A3.2: fs_min = 60 samples/s', minSampleRate(30), 60, 1e-12),
      near('2022 A3.5: gcd(7.4, 15, 23) = 0.2 Hz (T = 5 s)', gcdFrequencies([7.4, 15, 23]), 0.2, 1e-12),
      near('2025 A3.2(a): 8 s record → Δf = 0.125 Hz (0.2 Hz achievable)', resolution(8), 0.125, 1e-12),
      near('2025 A3.2(b): Nyquist at 250 samples/s = 125 Hz', nyquist(250), 125, 1e-12),
      near('2025 A3.2(b): 5.4 × 1500 rpm = 135 Hz aliases to 115 Hz', aliasFrequency((5.4 * 1500) / 60, 250), 115, 1e-9),
      near('2021 A3.1: 12 kHz sampled at 20 kHz appears at 8 kHz', aliasFrequency(12000, 20000), 8000, 1e-12),
      near('2022 A3.5: 23 Hz at 40 samples/s → 17 Hz', aliasFrequency(23, 40), 17, 1e-12),
    ],
  },
  {
    id: 'c3-alias-fold',
    topic: 'C3',
    title: 'Folding rule: edge cases, agreement with the library, alias wave through the samples',
    source: 'Summary notes C3 (fold |f − k fs| into [0, fs/2]); reader CE1 (7 Hz at 15 samples/s)',
    run: () => {
      const cases: [number, number, number][] = [
        [95, 100, 5],
        [260, 100, 40],
        [60, 50, 10],
        [150, 100, 50],
        [7, 15, 7],
      ];
      let maxDiff = 0;
      for (let f = 0.37; f < 800; f += 3.71) maxDiff = Math.max(maxDiff, Math.abs(aliasInfo(f, 97).fa - aliasFrequency(f, 97)));
      let waveErr = 0;
      for (const [f, fs] of [
        [23, 40],
        [135, 250],
        [39, 40],
        [7, 15],
        [61, 20],
      ])
        for (let n = 0; n < 50; n++) waveErr = Math.max(waveErr, Math.abs(aliasWave(n / fs, f, fs, 1.3, 0.4) - 1.3 * Math.sin(TAU * f * (n / fs) + 0.4)));
      return [
        ...cases.map(([f, fs, fa]) => near(`${f} Hz at ${fs} samples/s → ${fa} Hz`, aliasInfo(f, fs).fa, fa, 1e-12)),
        isTrue('23 Hz at 40 samples/s is reversed (wagon wheel); 7 Hz at 15 is not', aliasInfo(23, 40).reversed && !aliasInfo(7, 15).reversed),
        nearAbs('aliasInfo agrees with physics/dsp aliasFrequency (sweep to 800 Hz)', maxDiff, 0, 1e-9),
        nearAbs('the alias wave passes through every sample of the true sine', waveErr, 0, 1e-9),
      ];
    },
  },
  {
    id: 'c3-reader-ce1',
    topic: 'C3',
    title: 'Reader Coding Example 1: exact one-sided amplitudes',
    source: 'LC3-3 p.160 (fs 15 samples/s, T 2 s; x = 2 + 3cos 2πt + sin 8πt − 2cos 14πt)',
    run: () => {
      const x = record(15, 30, (t) => 2 + 3 * Math.cos(TAU * t) + Math.sin(TAU * 4 * t) - 2 * Math.cos(TAU * 7 * t));
      const s = amplitudeSpectrum(x, 15, 'rect');
      return [
        near('DC = 2', s.amp[0], 2, 1e-9),
        near('1 Hz line = 3', s.amp[2], 3, 1e-9),
        near('4 Hz line = 1', s.amp[8], 1, 1e-9),
        near('7 Hz line = 2 (just below the 7.5 Hz Nyquist)', s.amp[14], 2, 1e-9),
        isTrue('16 points from 0 to 7.5 Hz (N/2 = 15 lines)', s.f.length === 16 && Math.abs(s.f[15] - 7.5) < 1e-12),
      ];
    },
  },
  {
    id: 'c3-2022-a35',
    topic: 'C3',
    title: '2022 A3.5 / Week 11 Q4: the bad spectrum, its Hann version and the fixed record',
    source: '2022 A3.5 plot data tips; Week 11 Q4 worked (Hann corrected ≈ 1.27 at 15 Hz); recomputed in numpy',
    run: () => {
      const sig = (t: number) => 2.6 * Math.sin(TAU * 7.4 * t) + 1.5 * Math.sin(TAU * 15 * t) + 0.8 * Math.sin(TAU * 23 * t);
      const bad = record(40, 324, sig);
      const fixed = record(100, 500, sig);
      const p1 = peakNear(bad, 40, 7.4);
      const p2 = peakNear(bad, 40, 15);
      const p3 = peakNear(bad, 40, 17);
      const h2 = peakNear(bad, 40, 15, 'hann');
      const s = amplitudeSpectrum(fixed, 100, 'rect');
      return [
        nearAbs('7.4 Hz tone reads 2.5859 (at 7.407 Hz)', p1.a, 2.5859, 5e-4),
        nearAbs('15 Hz tone reads 0.9678 (half-bin leakage)', p2.a, 0.9678, 5e-4),
        nearAbs('23 Hz aliases to 17.04 Hz and reads 0.6593', p3.a, 0.6593, 5e-4),
        near('alias line sits at 17.037 Hz', p3.f, 17.037, 1e-4),
        nearAbs('Hann, corrected, at 15 Hz reads 1.273 (better, still 15 % low)', h2.a, 1.2733, 2e-3),
        near('fixed record (100 samples/s, 5 s): 7.4 Hz reads 2.600', s.amp[37], 2.6, 1e-9),
        near('fixed record: 15 Hz reads 1.500', s.amp[75], 1.5, 1e-9),
        near('fixed record: 23 Hz reads 0.800', s.amp[115], 0.8, 1e-9),
      ];
    },
  },
  {
    id: 'c3-leak-challenge',
    topic: 'C3',
    title: 'FFT-lab challenge: the cheapest repair of the 2022 record exists (fs < 60 samples/s, T = 5 s) and 5 s is the shortest',
    source: '2022 A3.5 worked (fs > 46 samples/s; gcd(7.4, 15, 23) = 0.2 Hz → T = 5 s)',
    run: () => {
      const sig = (t: number) => 2.6 * Math.sin(TAU * 7.4 * t) + 1.5 * Math.sin(TAU * 15 * t) + 0.8 * Math.sin(TAU * 23 * t);
      const out: ReturnType<typeof near>[] = [];
      for (const fs of [47, 50, 59]) {
        const s = amplitudeSpectrum(record(fs, 5 * fs, sig), fs, 'rect');
        out.push(near(`fs = ${fs}, T = 5 s: 7.4, 15 and 23 Hz read 2.6 + 1.5 + 0.8 = 4.9 in total`, s.amp[37] + s.amp[75] + s.amp[115], 4.9, 1e-9));
        out.push(near(`fs = ${fs}, T = 5 s: the 15 Hz line alone reads 1.5`, s.amp[75], 1.5, 1e-9));
      }
      const grid = Array.from({ length: 96 }, (_, i) => Number((0.2 + 0.05 * i).toFixed(2))); // the T slider's grid, 0.2 … 4.95 s
      const shorter = grid.filter((T) => [7.4, 15, 23].every((f) => Math.abs(f * T - Math.round(f * T)) < 1e-6));
      return [...out, isTrue('no record shorter than 5 s on the slider grid puts all three tones on lines', shorter.length === 0, shorter.join(', '))];
    },
  },
  {
    id: 'c3-2024-leakage',
    topic: 'C3',
    title: '2024 A3.2: tones 10, 13, 30 Hz on 3 Hz lines leak; on 1 Hz lines they are exact',
    source: '2024 A3.2 worked (zero-phase cosines; lines 9/12/15 Hz = 1.04/0.44/0.58)',
    run: () => {
      const sig = (t: number) => Math.cos(TAU * 10 * t) + Math.cos(TAU * 13 * t) + Math.cos(TAU * 30 * t);
      const coarse = amplitudeSpectrum(record(120, 40, sig), 120, 'rect');
      const fine = amplitudeSpectrum(record(120, 120, sig), 120, 'rect');
      return [
        nearAbs('Δf = 3 Hz: 9 Hz line = 1.04', coarse.amp[3], 1.0416, 0.01),
        nearAbs('Δf = 3 Hz: 12 Hz line = 0.44', coarse.amp[4], 0.4367, 0.01),
        nearAbs('Δf = 3 Hz: 15 Hz line = 0.58', coarse.amp[5], 0.5768, 0.01),
        near('Δf = 1 Hz: 10 Hz reads 1', fine.amp[10], 1, 1e-9),
        near('Δf = 1 Hz: 13 Hz reads 1', fine.amp[13], 1, 1e-9),
        nearAbs('Δf = 1 Hz: 12 Hz line is empty', fine.amp[12], 0, 1e-9),
      ];
    },
  },
  {
    id: 'c3-scalloping',
    topic: 'C3',
    title: 'Scalloping: tone half-way between lines',
    source: 'Week 11 Q4 worked (2/π for rectangular); computed for Hann and flat-top',
    run: () => [
      near('on a line, rectangular: 1', scallopReading('rect', 0), 1, 1e-9),
      near('half-way, rectangular ≈ 2/π (0.637)', scallopReading('rect', 0.5), 2 / Math.PI, 5e-3),
      near('half-way, Hann corrected ≈ 0.849', scallopReading('hann', 0.5), 0.8488, 5e-3),
      near('half-way, flat-top ≈ 1 (within 0.5 %)', scallopReading('flattop', 0.5), 1, 5e-3),
    ],
  },
  {
    id: 'c3-noise-bias',
    topic: 'C3',
    title: 'H₁/H₂ bias and coherence: formula and Monte Carlo agree; one record gives γ² = 1',
    source: 'Week 12 Q5 worked (noise 25 % of the power → 0.8 and 1.25); LC3 Eqs 3.8–3.9',
    run: () => {
      const H = { re: 0.3, im: -0.4 };
      const freqs = [1, 2, 3, 4, 5, 6, 7, 8];
      const base = { H: () => H, freqs, nAvg: 3000, seed: 7 };
      const inN = simulateFRFMeasurement({ ...base, inputNoise: 0.5, outputNoise: 0 });
      const outN = simulateFRFMeasurement({ ...base, inputNoise: 0, outputNoise: 0.5 * cabs(H) });
      const one = simulateFRFMeasurement({ ...base, nAvg: 1, inputNoise: 2, outputNoise: 2 });
      const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
      const r1 = mean(inN.H1.map((h) => cabs(h) / cabs(H)));
      const r2 = mean(outN.H2.map((h) => cabs(h) / cabs(H)));
      const b = noiseBias(0.25, 0);
      return [
        near('formula: input q = 0.25 → |H₁|/|H| = 0.8', b.h1, 0.8, 1e-12),
        near('formula: output q = 0.25 → |H₂|/|H| = 1.25', noiseBias(0, 0.25).h2, 1.25, 1e-12),
        near('formula: coherence = 0.8', b.coherence, 0.8, 1e-12),
        nearAbs('Monte Carlo: input noise 50 % RMS → |H₁|/|H| ≈ 0.80', r1, 0.8, 0.02),
        nearAbs('Monte Carlo: output noise 50 % RMS → |H₂|/|H| ≈ 1.25', r2, 1.25, 0.03),
        nearAbs('Monte Carlo: coherence ≈ 0.80', mean(inN.coherence), 0.8, 0.02),
        nearAbs('single record, heavy noise: coherence = 1 exactly', Math.min(...one.coherence), 1, 1e-12),
      ];
    },
  },
  {
    id: 'c3-beam-frf',
    topic: 'C3',
    title: 'Noise-lab beam: sensor on a support sees nothing; mid-span misses mode 2; point FRF has an anti-resonance',
    source: '2024 A3.5 (sensors on pinned supports; shaker at mid-span); LC3-9',
    run: () => {
      const f1 = 20;
      const A = (f: number, xs: number, xf: number) => cabs(ssBeamAccelerance(f, xs, xf, f1, 0.02, 10));
      let maxSupport = 0;
      for (let f = 2; f < 400; f += 1.7) maxSupport = Math.max(maxSupport, A(f, 0, 0.4));
      let minPt = Infinity;
      for (let f = 25; f < 75; f += 0.1) minPt = Math.min(minPt, A(f, 0.4, 0.4));
      return [
        nearAbs('sensor at the support: |A| = 0 at every frequency', maxSupport, 0, 1e-12),
        isTrue('sensor at mid-span (node of mode 2): no peak at f₂ = 80 Hz, only the other modes’ background (< 10 % of the off-node value)', A(80, 0.5, 0.2) < 0.1 * A(80, 0.4, 0.2), `${A(80, 0.5, 0.2).toExponential(2)} vs ${A(80, 0.4, 0.2).toExponential(2)}`),
        isTrue('sensor at mid-span: |A| has no local maximum near 80 Hz', A(80, 0.5, 0.2) < Math.max(A(70, 0.5, 0.2), A(90, 0.5, 0.2)) * 1.5),
        isTrue('point FRF at 0.4L: deep anti-resonance between f₁ and f₂ (< 1 % of the f₁ peak)', minPt < 0.01 * A(20, 0.4, 0.4), `${minPt.toExponential(2)} vs ${A(20, 0.4, 0.4).toExponential(2)}`),
        near('resonant peak ≈ φ²/(2ζ) at f₁ (one mode dominates)', A(20, 0.4, 0.4), ((2 / 10) * Math.sin(0.4 * Math.PI) ** 2) / 0.04, 0.05),
      ];
    },
  },
  {
    id: 'c3-named-traps',
    topic: 'C3',
    title: 'Solve feedback names the summary-notes slips: incomplete folding, fs vs fs/2, 1/N, N/2 lines',
    source: 'Review round 1 (#/C3/solve/c3-alias?t=2&s=4302: 230 Hz got a generic “Not quite”); summary notes C3',
    run: () => {
      const out: CheckResult[] = [];
      // The reported instance: 430 Hz at 200 samples/s.
      const rep = genById('c3-alias').generate(makeRng(4302), 2);
      const repFa = numPart(rep, 'fa')!;
      out.push(near('s4302 t2: 430 Hz at 200 samples/s shows at 30 Hz', repFa.answer, 30, 1e-9));
      out.push(isTrue('s4302 t2: 230 Hz (430 − 200, folded only once) is named “alias-incomplete”', trapFor(repFa, 230) === 'alias-incomplete', trapFor(repFa, 230)));
      out.push(isTrue('s4302 t2: 170 Hz (|430 − 3 × 200|, folded once too often) is named “alias-incomplete”', trapFor(repFa, 170) === 'alias-incomplete', trapFor(repFa, 170)));
      // Every c3-alias instance: f − m fs for each multiple short of the nearest is named; the answer is accepted.
      let bad = '';
      let named = 0;
      for (let s = 1; s <= 300 && !bad; s++)
        for (const t of [1, 2] as const) {
          const inst = genById('c3-alias').generate(makeRng(s * 7919 + 13), t);
          const p = numPart(inst, 'fa')!;
          const f = given(inst, 'f');
          const fs = given(inst, 'f_s');
          const k = Math.round(f / fs);
          if (trapFor(p, p.answer) !== 'CORRECT') bad = `seed ${s} t${t}: the answer is not accepted`;
          if (trapFor(p, f) !== 'nyquist-half') bad = `seed ${s} t${t}: true frequency ${f} not named nyquist-half`;
          for (let m = 1; m < k; m++) {
            named++;
            if (trapFor(p, Number((f - m * fs).toFixed(3))) !== 'alias-incomplete') bad = `seed ${s} t${t}: ${f} − ${m} × ${fs} not named`;
          }
          const nyq = numPart(inst, 'nyq');
          if (nyq && (trapFor(nyq, fs) !== 'nyquist-half' || trapFor(nyq, 2 * fs) !== 'nyquist-half')) bad = `seed ${s}: Nyquist = fs or 2fs not named`;
        }
      out.push(isTrue(`c3-alias (300 seeds × tiers 1–2): every incomplete fold is named (${named} cases), the true frequency is named nyquist-half`, !bad && named > 50, bad));
      // c3-achievable: the same folds on the machine-tone alias parts (tier 2 without filter, tier 3 bypassed).
      bad = '';
      named = 0;
      for (let s = 1; s <= 300 && !bad; s++)
        for (const t of [2, 3] as const) {
          const inst = genById('c3-achievable').generate(makeRng(s * 7919 + 13), t);
          const p = numPart(inst, 'alias');
          if (!p) continue;
          const f = numPart(inst, 'f')!.answer;
          const fs = given(inst, 'f_s');
          if (f < fs / 2) continue;
          const half = (2 * f) / fs;
          if (Math.abs(half - Math.round(half)) < 0.02) bad = `seed ${s} t${t}: ${f} Hz at ${fs} samples/s aliases onto 0 Hz or onto Nyquist`;
          const k = Math.round(f / fs);
          for (let m = 1; m < k; m++) {
            named++;
            if (trapFor(p, Number((f - m * fs).toFixed(3))) !== 'alias-incomplete') bad = `seed ${s} t${t}: ${f} − ${m} × ${fs} not named`;
          }
        }
      out.push(isTrue(`c3-achievable (300 seeds × tiers 2–3): every incomplete fold is named (${named} cases); no alias lands on 0 Hz or on Nyquist`, !bad && named > 20, bad));
      // c3-lines: Δf = 1/N, (fs/2)/N, and N lines instead of N/2.
      bad = '';
      for (let s = 1; s <= 100 && !bad; s++) {
        const inst = genById('c3-lines').generate(makeRng(s * 7919 + 13), 1);
        const fs = given(inst, 'f_s');
        const N = given(inst, 'N');
        const df = numPart(inst, 'df')!;
        // When fs ≈ N, 1/N ≈ 1/fs = Δt and the checker names the Δt slip instead; both are right.
        if (Math.abs(fs - N) > 0.05 * N && trapFor(df, 1 / N) !== 'resolution-record') bad = `seed ${s}: Δf = 1/N not named`;
        if (trapFor(df, fs / (2 * N)) !== 'lines-half') bad = `seed ${s}: Δf = (fs/2)/N not named`;
        if (trapFor(numPart(inst, 'lines')!, N) !== 'lines-half') bad = `seed ${s}: N lines not named`;
      }
      out.push(isTrue('c3-lines tier 1 (100 seeds): Δf = 1/N, (f_s/2)/N and “N lines” are named', !bad, bad));
      return out;
    },
  },
  {
    id: 'c3-content',
    topic: 'C3',
    title: 'MCQs: exactly one correct option and a reason for every option',
    run: () =>
      mcqs.map((q) => {
        const nCorrect = q.options.filter((o) => o.correct).length;
        const allWhy = q.options.every((o) => o.why.trim().length > 3);
        return isTrue(q.id, nCorrect === 1 && allWhy && !!q.source, `${nCorrect} correct, why on all: ${allWhy}`);
      }),
  },
  {
    id: 'c3-generators',
    topic: 'C3',
    title: 'Every C3 generator builds valid problems at every tier (60 seeds)',
    run: () =>
      generators.map((g) => {
        let bad = '';
        for (let s = 1; s <= 60 && !bad; s++)
          for (const t of g.tiers) {
            const inst = g.generate(makeRng(s * 7919 + 13), t);
            if (inst.hints.length !== 4 || inst.hints.some((h) => !h || h.length < 10)) bad = `hints (seed ${s}, tier ${t})`;
            if (!inst.parts.length) bad = `no parts (seed ${s}, tier ${t})`;
            for (const p of inst.parts) {
              if (p.kind === 'numeric') {
                if (!Number.isFinite(p.answer)) bad = `${p.id} not finite (seed ${s}, tier ${t})`;
                for (const tr of p.traps || []) if (Math.abs(tr.value - p.answer) <= 0.035 * Math.abs(p.answer)) bad = `${p.id}: trap within 3.5 % of the answer (seed ${s}, tier ${t})`;
              }
              if (p.kind === 'choice' && !p.options.some((o) => o.correct)) bad = `${p.id}: no correct option (seed ${s}, tier ${t})`;
              if (p.kind === 'choice' && !p.multi && p.options.filter((o) => o.correct).length !== 1) bad = `${p.id}: single choice with ${p.options.filter((o) => o.correct).length} correct (seed ${s}, tier ${t})`;
            }
          }
        return isTrue(`${g.id}`, !bad, bad);
      }),
  },
];
