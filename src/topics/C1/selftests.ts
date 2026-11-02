// Self-tests for topic C1: reference values from the research notes (recomputed), the 2025 A3.1 and
// 2023 A3.1 worked solutions, the Week 11 contact-time model and the reader (LC1).
import type { SelfTest } from '../../selftest/types';
import { isTrue, near, nearAbs } from '../../selftest/assert';
import {
  accelerometerRatio,
  halfSineSpectrum,
  hammerContactDuration,
  seismicPhase,
  seismicRatio,
  spectrumDropFrequency,
  usableBand,
} from '../../physics/transducers';
import { makeRng } from '../../engine/rng';
import { generators } from './solve';
import { G, HALF_SINE_10DB, HALF_SINE_20DB, TIPS, coherenceFromSnrDb, dampedBandEdge, dbToRatio, halfSinePulse, seismicTraces } from './physics';

const DEG = 180 / Math.PI;
const TAU = 2 * Math.PI;

export const tests: SelfTest[] = [
  {
    id: 'c1-accel-ratio',
    topic: 'C1',
    title: 'Accelerometer ratio z₀ωₙ²/|ÿ| (reader LC1-6 chart values)',
    source: 'Research notes ST-C1-01 to 06; 2025 A3.1 WS (4.2 % at β = 0.2)',
    run: () => [
      near('β = 0.1, ζ = 0 → 1.01010 (1 % error)', accelerometerRatio(0.1, 0), 1.0101, 1e-5),
      near('β = 0.2, ζ = 0 → 1.04167 (4.2 % error)', accelerometerRatio(0.2, 0), 1.04167, 1e-5),
      near('β = 0.5, ζ = 0 → 1.33333', accelerometerRatio(0.5, 0), 4 / 3, 1e-6),
      near('β = 1, ζ = 0.05 → 1/(2ζ) = 10', accelerometerRatio(1, 0.05), 10, 1e-9),
      near('β = 1, ζ = 0.3 → 1.6667', accelerometerRatio(1, 0.3), 1.66667, 1e-5),
      nearAbs('β = 0.2, ζ = 0.7 → 1.0000', accelerometerRatio(0.2, 0.7), 1, 1e-4),
      near('β = 0.5, ζ = 0.6 → 1.0412', accelerometerRatio(0.5, 0.6), 1.0412, 1e-4),
      near('β = 0.5, ζ = 0.7 → 0.9747', accelerometerRatio(0.5, 0.7), 0.9747, 1e-4),
      near('β = 0.5, ζ = 1.0 → 0.8000', accelerometerRatio(0.5, 1), 0.8, 1e-9),
    ],
  },
  {
    id: 'c1-bands',
    topic: 'C1',
    title: 'Usable bands: accelerometer (β ≪ 1) and vibrometer (β ≫ 1)',
    source: 'Research notes ST-C1-07 to 09 (recomputed); summary notes C1',
    run: () => [
      near('undamped, 1 % → β_max = 0.0995', usableBand(0, 0.01, 'accelerometer'), 0.099504, 1e-4),
      near('undamped, 2 % → β_max = 0.1400', usableBand(0, 0.02, 'accelerometer'), 0.140028, 1e-4),
      near('undamped, 5 % → β_max = 0.2182', usableBand(0, 0.05, 'accelerometer'), 0.218218, 1e-4),
      near('ζ = 0.7, 5 % → β_max = 0.5910 (2.7× wider)', usableBand(0.7, 0.05, 'accelerometer'), 0.591009, 1e-4),
      near('closed form agrees (ζ = 0.65, 2 %)', dampedBandEdge(0.65, 0.02), usableBand(0.65, 0.02, 'accelerometer'), 1e-9),
      near('closed form agrees (ζ = 0.7, 10 %)', dampedBandEdge(0.7, 0.1), usableBand(0.7, 0.1, 'accelerometer'), 1e-9),
      near('vibrometer, undamped, 5 % → β_min = √21 = 4.583', usableBand(0, 0.05, 'vibrometer'), Math.sqrt(21), 1e-9),
      near('z₀/y₀ at β = 2, ζ = 0 → 1.3333', seismicRatio(2, 0), 4 / 3, 1e-9),
      near('z₀/y₀ at β = 3, ζ = 0 → 1.1250', seismicRatio(3, 0), 1.125, 1e-9),
      near('z₀/y₀ at β = 5, ζ = 0 → 1.0417', seismicRatio(5, 0), 25 / 24, 1e-9),
      near('z₀/y₀ at β = 10, ζ = 0 → 1.0101', seismicRatio(10, 0), 100 / 99, 1e-9),
      near('z₀/y₀ at β = 3, ζ = 0.7 → 0.9961', seismicRatio(3, 0.7), 0.99607, 1e-4),
      near('z₀/y₀ at β = 5, ζ = 0.7 → 1.0000', seismicRatio(5, 0.7), 1, 1e-6),
    ],
  },
  {
    id: 'c1-phase-sensitivity',
    topic: 'C1',
    title: 'Phase lag and sensitivity (deflection per g)',
    source: 'Research notes ST-C1-10, ST-C1-11; LC1-5 (φ = tan⁻¹[cω/(k − mω²)])',
    run: () => [
      near('φ(β = 0.2, ζ = 0.05) = 1.19°', seismicPhase(0.2, 0.05) * DEG, 1.19349, 1e-4),
      near('φ(β = 0.2, ζ = 0.7) = 16.26°', seismicPhase(0.2, 0.7) * DEG, 16.2602, 1e-4),
      near('φ(β = 1) = 90° for any ζ', seismicPhase(1, 0.2) * DEG, 90, 1e-12),
      near('z₀ per g at fₙ = 1 kHz: 2.485×10⁻⁷ m', G / (TAU * 1000) ** 2, 2.4849e-7, 1e-4),
      near('z₀ per g at fₙ = 5 kHz: 9.94×10⁻⁹ m', G / (TAU * 5000) ** 2, 9.9396e-9, 1e-4),
      near('z₀ per g at fₙ = 30 kHz: 2.761×10⁻¹⁰ m', G / (TAU * 30000) ** 2, 2.761e-10, 1e-3),
      nearAbs('animation: reading = truth when β → 0 (accelerometer)', seismicTraces(1.1, 1e-4, 0.02, 'accelerometer').reading - seismicTraces(1.1, 1e-4, 0.02, 'accelerometer').truth, 0, 1e-5),
      nearAbs('animation: reading = truth when β → ∞ (vibrometer)', seismicTraces(0.7, 1e4, 0.02, 'vibrometer').reading - seismicTraces(0.7, 1e4, 0.02, 'vibrometer').truth, 0, 1e-5),
    ],
  },
  {
    id: 'c1-db-pulse',
    topic: 'C1',
    title: 'dB ratios, half-sine pulse spectrum and contact time',
    source: 'LC1-3 (dB, 10–20 dB rule); research notes ST-C1-12 to 15, ST-C1-18; Week 11 WS contact model',
    run: () => {
      const tau = 1e-3;
      let area = 0;
      const n = 4000;
      for (let i = 0; i < n; i++) area += halfSinePulse(((i + 0.5) / n) * tau, tau, 0.7) * (tau / n);
      return [
        near('−3.0103 dB → 0.70711', dbToRatio(-3.0103), 0.70711, 1e-5),
        near('−10 dB → 0.31623 (≈ 1/3)', dbToRatio(-10), 0.316228, 1e-5),
        near('−20 dB → 0.1', dbToRatio(-20), 0.1, 1e-12),
        near('−56 dB → 0.00158', dbToRatio(-56), 0.0015849, 1e-4),
        nearAbs('half-sine first zero at 1.5/T', halfSineSpectrum(1.5 / tau, tau), 0, 1e-12),
        near('half-sine −10 dB at 1.019/T', spectrumDropFrequency(tau, 10) * tau, 1.019, 2e-3),
        near('half-sine −20 dB at 1.303/T', spectrumDropFrequency(tau, 20) * tau, 1.303, 2e-3),
        near('HALF_SINE_10DB constant matches', spectrumDropFrequency(tau, 10) * tau, HALF_SINE_10DB, 1e-7),
        near('HALF_SINE_20DB constant matches', spectrumDropFrequency(tau, 20) * tau, HALF_SINE_20DB, 1e-7),
        near('pulse area = impulse (0.7 N s)', area, 0.7, 1e-6),
        near('T = π√(0.1/10⁷) = 0.314 ms', hammerContactDuration(0.1, 1e7) * 1000, 0.314159, 1e-5),
        near('×4 hammer mass doubles T', hammerContactDuration(0.4, 1e7) / hammerContactDuration(0.1, 1e7), 2, 1e-12),
      ];
    },
  },
  {
    id: 'c1-tips-2023',
    topic: 'C1',
    title: 'Tip presets and the 2023 A3.1 rubber-tip spectrum',
    source: '2023 A3.1 WS (−10 dB ≈ 110 Hz, −20 dB ≈ 150 Hz, f₁ ≈ −4 dB, f₂ and f₃ in the noise); research notes FIG-6',
    run: () => {
      const rubber = TIPS[0];
      const T = hammerContactDuration(2.7, rubber.k);
      const lvl = (f: number) => 20 * Math.log10(halfSineSpectrum(f, T));
      const taus = TIPS.map((t) => hammerContactDuration(0.3, t.k));
      return [
        near('rubber + 2.7 kg: T = 8.99 ms', T * 1000, 8.986, 1e-3),
        near('−10 dB at ≈ 113 Hz', spectrumDropFrequency(T, 10), 113.4, 2e-3),
        near('−20 dB at ≈ 145 Hz', spectrumDropFrequency(T, 20), 145.0, 2e-3),
        nearAbs('f₁ = 76 Hz is about −4 dB', lvl(76), -4.04, 0.05),
        isTrue('f₂ = 478 Hz and f₃ = 1340 Hz are more than 40 dB down', lvl(478) < -40 && lvl(1340) < -40, `${lvl(478).toFixed(1)}, ${lvl(1340).toFixed(1)} dB`),
        isTrue('tips in order: rubber > plastic > aluminium > steel contact time', taus.every((t, i) => i === 0 || t < taus[i - 1])),
        near('0.3 kg presets: rubber 3.0 ms', taus[0] * 1000, 3.0, 0.01),
        near('0.3 kg presets: steel 0.15 ms', taus[3] * 1000, 0.151, 0.01),
      ];
    },
  },
  {
    id: 'c1-coherence',
    topic: 'C1',
    title: 'Coherence from signal-to-noise: γ² = 1/(1 + r)',
    source: 'Week 12 Q5 WS noise ratios (r = 0.25 → 0.8); LC3 Eq 3.9',
    run: () => [
      near('SNR 0 dB → 0.5', coherenceFromSnrDb(0), 0.5, 1e-12),
      near('SNR 10 dB → 0.90909', coherenceFromSnrDb(10), 1 / 1.1, 1e-12),
      near('SNR = 10 log₁₀ 9 → 0.9', coherenceFromSnrDb(10 * Math.log10(9)), 0.9, 1e-12),
      near('r = 0.25 (SNR 6.02 dB) → 0.8', coherenceFromSnrDb(10 * Math.log10(4)), 0.8, 1e-12),
    ],
  },
  {
    id: 'c1-generators',
    topic: 'C1',
    title: 'Every C1 generator builds valid problems at every tier (50 seeds)',
    run: () =>
      generators.map((g) => {
        let bad = '';
        for (let s = 1; s <= 50 && !bad; s++)
          for (const t of g.tiers) {
            const inst = g.generate(makeRng(s * 7919), t);
            if (inst.hints.length !== 4) bad = `needs 4 hints (seed ${s}, tier ${t})`;
            for (const p of inst.parts) {
              if (p.kind === 'numeric') {
                if (!Number.isFinite(p.answer)) bad = `${p.id} not finite (seed ${s}, tier ${t})`;
                const tol = Math.max(p.tol ?? 0.02, 0.02);
                for (const tr of p.traps || [])
                  if (!Number.isFinite(tr.value) || Math.abs(tr.value - p.answer) <= tol * Math.abs(p.answer)) bad = `${p.id}: trap ${tr.value} within tolerance of ${p.answer} (seed ${s}, tier ${t})`;
              }
              if (p.kind === 'choice' && !p.options.some((o) => o.correct)) bad = `${p.id}: no correct option (seed ${s}, tier ${t})`;
              if (p.kind === 'choice' && !p.multi && p.options.filter((o) => o.correct).length !== 1) bad = `${p.id}: single choice needs exactly one correct option (seed ${s}, tier ${t})`;
            }
            if (/NaN|undefined|Infinity/.test(inst.prompt + inst.hints.join(' '))) bad = `NaN/undefined in text (seed ${s}, tier ${t})`;
          }
        return isTrue(`${g.id}`, !bad, bad);
      }),
  },
];
