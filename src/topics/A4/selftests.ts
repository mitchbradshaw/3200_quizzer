// Self-tests for topic A4: reference values from the reader (LA6, LC4 §3.5), the Week 5 quiz, the 2021–2025
// worked solutions and official exam-pack answers, plus content and generator sanity checks.
import type { CheckResult, SelfTest } from '../../selftest/types';
import type { SolvePart } from '../../engine/types';
import { checkNumeric } from '../../engine/check';
import { ascending, isTrue, near, nearAbs } from '../../selftest/assert';
import {
  chainFrequencies,
  denHartogFixedPoints,
  denHartogOptimum,
  generalRatios,
  muFromRatio,
  primaryAmplitude,
  sizeTunedAbsorber,
  tunedRatios,
} from '../../physics/absorber';
import { modes, receptanceUndamped, suppressionFrequencies } from '../../physics/mdof';
import { makeRng } from '../../engine/rng';
import { generators } from './solve';
import { cards, flashcards } from './learn';
import { games, mcqs } from './quiz';
import { absorberSigned, ceilTo, chainReceptances, featureGrid, ladderCeil, minMuForLowerPeak, newFrequenciesG, peakBranches, primaryDips, primaryPeaks, sizeForMargins } from './physics';

const TAU = 2 * Math.PI;
const rpm = (w: number) => (w * 60) / TAU;

export const tests: SelfTest[] = [
  {
    id: 'a4-tuned-sizing',
    topic: 'A4',
    title: 'Tuned absorber sizing: Week 5, 2021 A1.3, 2023 A1.4, 2024 A1.5',
    source: 'LA6 Eq 6.22 plot; Week 5 Q1, 2021 A1.3, 2023 A1.4, 2024 A1.5 worked solutions',
    run: () => {
      const [a, b] = tunedRatios(0.2);
      const s21 = sizeTunedAbsorber(2e6, 10, 0.3);
      const W23 = (800 * TAU) / 60;
      const s23 = sizeTunedAbsorber(2000, W23, 0.3);
      const W24 = (1200 * TAU) / 60;
      const s24 = sizeTunedAbsorber(40, W24, 0.2);
      return [
        near('LA6 plot: μ = 0.2 → r₁ = 0.80109', a, 0.80109, 1e-4),
        near('LA6 plot: μ = 0.2 → r₂ = 1.24830', b, 1.2483, 1e-4),
        near('Week 5: lower-limit candidate μ = 0.985857', muFromRatio(0.62), 0.985857, 1e-5),
        near('Week 5: upper-limit decoy μ = 0.429500', muFromRatio(1.38), 0.4295, 1e-4),
        near('Week 5 decoy leaves r₁ = 0.72464 (fails)', tunedRatios(0.4295)[0], 0.72464, 1e-4),
        isTrue('Week 5: μ = 0.98 fails (r₁ > 0.62), μ = 0.99 passes', tunedRatios(0.98)[0] > 0.62 && tunedRatios(0.99)[0] <= 0.62, `r₁ = ${tunedRatios(0.98)[0]}, ${tunedRatios(0.99)[0]}`),
        near('ceilTo(0.98586, 2) = 0.99', ceilTo(0.985857, 2), 0.99, 1e-12),
        near('ceilTo(0.530816, 2) = 0.54 (round a minimum up)', ceilTo(0.530816, 2), 0.54, 1e-12),
        near('2021: μ = 0.530816', s21.mu, 0.530816, 1e-5),
        near('2021: m_a = 1.06163e6 kg', s21.m2, 1.06163e6, 1e-5),
        near('2021: k_a = 1.06163e8 N/m', s21.k2, 1.06163e8, 1e-5),
        near('2021: new ω = 7.000 rad/s', s21.r1 * 10, 7, 1e-9),
        near('2021: new ω = 14.286 rad/s', s21.r2 * 10, 14.2857, 1e-4),
        near('2023: Ω = 83.7758 rad/s', W23, 83.7758, 1e-6),
        near('2023: m₂ = 1061.63 kg', s23.m2, 1061.63, 1e-5),
        near('2023: k₂ = 7.45095e6 N/m', s23.k2, 7.45095e6, 1e-5),
        near('2023: new speeds 560 rpm', s23.r1 * 800, 560, 1e-9),
        near('2023: and 1142.86 rpm', s23.r2 * 800, 1142.857, 1e-6),
        near('2024: m_a = 8.100 kg', s24.m2, 8.1, 1e-9),
        near('2024: k_a = 1.27910e5 N/m', s24.k2, 1.2791e5, 1e-4),
        near('2024: new speeds 960 rpm', s24.r1 * 1200, 960, 1e-9),
        near('2024: and 1500 rpm', s24.r2 * 1200, 1500, 1e-9),
        isTrue('symmetric margins: the lower limit binds (x = 0.38)', sizeForMargins(0.38, 0.38).binds === 'lower'),
        isTrue('15 % below / 25 % above: the upper limit binds', sizeForMargins(0.15, 0.25).binds === 'upper'),
        near('… with μ = (1.25 − 0.8)² = 0.2025', sizeForMargins(0.15, 0.25).mu, 0.2025, 1e-9),
      ];
    },
  },
  {
    id: 'a4-untuned',
    topic: 'A4',
    title: 'Untuned absorber (Eq 6.23) and retuning: 2025 A1.1–A1.2',
    source: '2025 A1.1–A1.2 worked solution; LA6 Eq 6.23',
    run: () => {
      const beta = Math.sqrt(25 / 23);
      const [r1, r2] = generalRatios(0.002, beta);
      const [g1, g2] = newFrequenciesG(0.002, beta);
      const [t1, t2] = tunedRatios(0.002);
      let bandMax = 0;
      for (let g = 0.98; g <= 1.02 + 1e-12; g += 1e-4) bandMax = Math.max(bandMax, primaryAmplitude(0.01, 1, g));
      const [q1, q2] = generalRatios(1 / 400, Math.sqrt(400 / 350));
      return [
        near('r₁ = 0.949559', r1, 0.949559, 1e-5),
        near('r₂ = 1.010118', r2, 1.010118, 1e-5),
        near('ω_high/ω_low = 1.063776', r2 / r1, 1.063776, 1e-5),
        near('ω/ω₁₁ = 0.989984 (inside ±2 %)', g1, 0.989984, 1e-5),
        near('ω/ω₁₁ = 1.053121', g2, 1.053121, 1e-5),
        near('trap: tuned formula gives 1.045733', t2 / t1, 1.045733, 1e-5),
        near('|X₁|k₁/F₀ at g = 0.98: 43.28', primaryAmplitude(0.002, beta, 0.98), 43.28, 2e-3),
        near('… at g = 1.00: 40.00', primaryAmplitude(0.002, beta, 1), 40.0, 1e-3),
        near('… at g = 1.02: 11.24', primaryAmplitude(0.002, beta, 1.02), 11.24, 2e-3),
        near('tuned μ = 0.01: band maximum 4.93', bandMax, 4.93, 5e-3),
        near('retune factor on k₂: 460/500 = 0.92', 460 / 500, 0.92, 1e-12),
        near('μ_min for ±2 %: 0.0016328', muFromRatio(0.98), 0.0016328, 1e-4),
        near('quiz item (k₁ = 350k₂, μ = 1/400): ratio 1.0881', q2 / q1, 1.08809, 1e-4),
      ];
    },
  },
  {
    id: 'a4-chain',
    topic: 'A4',
    title: 'Chain receptances, anti-resonances, reciprocity and interlacing',
    source: 'LA6 Eq 6.10–6.13; 2024 A1.2–1.3 figure; official 2018 A1.8; LA6 §6.6',
    run: () => {
      const r = chainReceptances(1, 1, 1, 1, 0.5);
      const [w1, w2] = chainFrequencies(1, 1, 1, 1);
      const [v1, v2] = chainFrequencies(2, 2, 1, 1);
      const K = [[3000, -1200], [-1200, 1200]];
      const M = [[4, 0], [0, 1.5]];
      const R = receptanceUndamped(K, M, 21.7);
      const c = chainReceptances(4, 1800, 1.5, 1200, 21.7);
      const rng = makeRng(4242);
      let bad = 0;
      for (let i = 0; i < 2000; i++) {
        const m1 = rng.uniform(0.1, 100);
        const m2 = rng.uniform(0.1, 100);
        const k1 = rng.uniform(10, 1e6);
        const k2 = rng.uniform(10, 1e6);
        const [a, b] = chainFrequencies(m1, k1, m2, k2);
        for (const z of [Math.sqrt(k1 / m1), Math.sqrt(k2 / m2), Math.sqrt((k1 + k2) / m1)]) if (!(z > a && z < b)) bad++;
      }
      const zA = Math.sqrt(1.279e5 / 8.1);
      const s = chainReceptances(40, 6.317e5, 8.1, 1.279e5, zA);
      return [
        near('Δ(0.5) = 0.3125 (m = k = 1)', r.det, 0.3125, 1e-12),
        near('α₁₁ = 2.4', r.a11, 2.4, 1e-12),
        near('α₂₁ = 3.2', r.a12, 3.2, 1e-12),
        near('α₂₂ = 5.6', r.a22, 5.6, 1e-12),
        near('ω₁ = 0.618034 √(k/m)', w1, 0.618034, 1e-6),
        near('ω₂ = 1.618034 √(k/m)', w2, 1.618034, 1e-6),
        nearAbs('α₂₂ = 0 at √2 √(k/m) (official 2018 A1.8)', chainReceptances(1, 1, 1, 1, Math.SQRT2).a22, 0, 1e-12),
        near('LA6 §6.6 chain: ω₁ = 0.707107', v1, 0.707107, 1e-6),
        near('LA6 §6.6 chain: ω₂ = 1.414214', v2, 1.414214, 1e-6),
        near('closed-form α₁₁ = (K − Ω²M)⁻¹₁₁', c.a11, R[0][0], 1e-10),
        near('closed-form α₁₂ = (K − Ω²M)⁻¹₁₂', c.a12, R[0][1], 1e-10),
        near('reciprocity α₁₂ = α₂₁', R[0][1], R[1][0], 1e-12),
        isTrue('interlacing on 2000 random chains: √(k₁/m₁), √(k₂/m₂), √((k₁+k₂)/m₁) all between ω₁ and ω₂', bad === 0, `${bad} violations`),
        near('absorber stroke at tuning: X₂ = −F₀/k₂ = −7.8186e-4 m (F₀ = 100 N)', s.a12 * 100, -7.8186e-4, 1e-4),
        nearAbs('… while the primary stands still', s.a11 * 100, 0, 1e-15),
      ];
    },
  },
  {
    id: 'a4-camera-2022',
    topic: 'A4',
    title: '2022 A1.2–A1.3: cushion + absorber below vs on top of the camera',
    source: '2022 A1.1–A1.3 worked solution',
    run: () => {
      const W = 4 * Math.PI;
      const two = chainReceptances(5, 250, 12, 100, W);
      const top = chainReceptances(12, 250, 5, 100, W);
      const [a, b] = chainFrequencies(5, 250, 12, 100);
      const [c, d] = chainFrequencies(12, 250, 5, 100);
      const rc = W / Math.sqrt(250 / 12);
      return [
        near('A1.2 Δ = 7.79009e5', two.det, 7.79009e5, 1e-5),
        near('A1.2 |X_cam/Y| = 0.032092 (meets 1/10)', two.a12 * 250, 0.032092, 1e-4),
        near('A1.2 X_a/Y = −0.57604', two.a11 * 250, -0.57604, 1e-4),
        near('A1.2 ω = 2.39577 rad/s', a, 2.39577, 1e-5),
        near('A1.2 ω = 8.52019 rad/s', b, 8.52019, 1e-5),
        near('A1.3 Δ = 1.05536e6', top.det, 1.05536e6, 1e-5),
        near('A1.3 X_cam/Y = −0.163349 (fails)', top.a11 * 250, -0.163349, 1e-4),
        near('A1.3 X_a/Y = 0.023689', top.a12 * 250, 0.023689, 1e-3),
        near('A1.3 ω = 3.29908 rad/s', c, 3.29908, 1e-5),
        near('A1.3 ω = 6.18730 rad/s', d, 6.1873, 1e-5),
        near('cushion alone: |X/Y| = 0.152', 1 / (rc * rc - 1), 0.152, 3e-3),
        near('isolation needs k < mΩ²/2 = 947.5 N/m', (12 * W * W) / 2, 947.5, 1e-3),
        near('tuned top absorber: k_a = m_aΩ² = 789.6 N/m', 5 * W * W, 789.57, 1e-4),
      ];
    },
  },
  {
    id: 'a4-suppress',
    topic: 'A4',
    title: 'Suppressed coordinate: 2023 A2.5 (bounce) and 2025 A2.4 (transverse)',
    source: '2023 A2.5 and 2025 A2.3–A2.4 worked solutions',
    run: () => {
      const M = [[20, 0], [0, 1.6773]];
      const K = [[225, 100], [100, 80]];
      const b = 0.5;
      const ws = suppressionFrequencies(K, M, [-1, b], 0);
      const wx = Math.sqrt((80 + b * 100) / 1.6773);
      const w2 = wx * wx;
      const D = (225 - 20 * w2) * (80 - 1.6773 * w2) - 1e4;
      const md = modes(K, M);
      const kx = 2.4e5;
      const K5 = [[kx, -0.5 * kx], [-0.5 * kx, 0.75 * kx]];
      const M5 = [[28, 0], [0, 15]];
      const m5 = modes(K5, M5);
      const Wa = Math.sqrt((0.75 * kx) / 15);
      const F0 = 0.02 * Wa * Wa;
      return [
        near('2023: ω* = 8.803722 rad/s', wx, 8.803722, 1e-6),
        near('… agrees with suppressionFrequencies(K, M, Q, x)', ws[0], wx, 1e-9),
        near('2023: Δ(ω*) = 5.6256e4 ≠ 0', D, 5.6256e4, 1e-4),
        near('2023: Θ/F₀ = −1/K₁₂ = −0.0100 rad/N', -1 / 100, -0.01, 1e-12),
        near('2023: natural frequency 2.090372 rad/s', md.omega[0], 2.090372, 1e-5),
        near('2023: natural frequency 7.387560 rad/s', md.omega[1], 7.38756, 1e-5),
        near('2023 sign-mix trap: 4.229 rad/s', Math.sqrt(30 / 1.6773), 4.2292, 1e-4),
        near('2025: ω₁ = 64.6879 rad/s', m5.omega[0], 64.6879, 1e-5),
        near('2025: ω₂ = 128.0113 rad/s', m5.omega[1], 128.0113, 1e-5),
        near('2025: Ω_a = 109.5445 rad/s', Wa, 109.5445, 1e-6),
        near('2025: Ω_a = 1046.07 rpm', rpm(Wa), 1046.07, 1e-5),
        near('2025: F₀ = 240 N at that speed', F0, 240, 1e-9),
        near('2025: Θ = F₀/K₁₂ = −2.000e-3 rad', F0 / (-0.5 * kx), -2e-3, 1e-9),
        near('2025: sway X = F₀/(3k_x − mΩ²) = 6.250e-4 m', F0 / (3 * kx - 28 * Wa * Wa), 6.25e-4, 1e-9),
        ascending('2025: Ω_a lies between the two resonances', [m5.omega[0], Wa, m5.omega[1]], ['ω₁', 'Ωa', 'ω₂']),
      ];
    },
  },
  {
    id: 'a4-damped',
    topic: 'A4',
    title: 'Damped absorber: LC4 curves, fixed points, locking and the 2021 A1.4 sizing table',
    source: 'LC4 §3.5 figure (μ = 0.05); 2021 A1.4 worked solution; Rao 9.11.2',
    run: () => {
      const lc4 = [0.85, 0.9, 1.0, 1.1].map((g) => primaryAmplitude(0.05, 1, g, 0.1));
      const fp = denHartogFixedPoints(0.05, 1);
      const pk = primaryPeaks(0.05, 1, 0.1, 0.6, 1.5);
      const p1 = primaryPeaks(0.5308163, 1, 0.1, 0.3, 2.2);
      const p2 = primaryPeaks(0.5308163, 1, 0.2, 0.3, 2.2);
      const opt = denHartogOptimum(0.05);
      const fo = denHartogFixedPoints(0.05, opt.beta);
      return [
        near('LC4: |X₁|k₁/F₀(g = 0.85, ζ = 0.1) = 5.61839', lc4[0], 5.61839, 1e-5),
        near('LC4: g = 0.90 → 9.59848', lc4[1], 9.59848, 1e-5),
        near('LC4: g = 1.00 → 3.92232 (no longer zero)', lc4[2], 3.92232, 1e-5),
        near('LC4: g = 1.10 → 4.92703', lc4[3], 4.92703, 1e-5),
        near('fixed point P at g = 0.9186', fp.g[0], 0.9186, 2e-4),
        near('… height 8.773', fp.amp[0], 8.773, 1e-3),
        near('fixed point Q at g = 1.0753', fp.g[1], 1.0753, 2e-4),
        near('… height 4.673', fp.amp[1], 4.673, 1e-3),
        near('every damping curve passes through P (ζ = 0.37)', primaryAmplitude(0.05, 1, fp.g[0], 0.37), fp.amp[0], 1e-9),
        near('LC4 ζ = 0.1 lower peak at g = 0.903', pk[0].g, 0.903, 2e-3),
        near('… height 9.63', pk[0].amp, 9.63, 2e-3),
        near('LC4 ζ = 0.1 upper peak at g = 1.101', pk[1].g, 1.101, 2e-3),
        near('locked absorber peak 1/√1.05 = 0.97590', primaryPeaks(0.05, 1, Infinity)[0].g, 0.9759, 1e-5),
        near('2021 ζ = 0.1: lower peak g = 0.7012', p1[0].g, 0.7012, 2e-3),
        near('… height 15.16', p1[0].amp, 15.16, 1e-2),
        near('2021 ζ = 0.1: upper peak g = 1.4257', p1[1].g, 1.4257, 2e-3),
        near('2021 ζ = 0.2: lower peak g = 0.7056', p2[0].g, 0.7056, 2e-3),
        near('… upper peak g = 1.3925', p2[1].g, 1.3925, 2e-3),
        near('2021 table: μ for lower peak ≤ 0.70, ζ = 0 → 0.5308', minMuForLowerPeak(0, 0.7), 0.530816, 1e-5),
        near('ζ = 0.1 → 0.536', minMuForLowerPeak(0.1, 0.7), 0.536, 3e-3),
        near('ζ = 0.2 → 0.555', minMuForLowerPeak(0.2, 0.7), 0.555, 3e-3),
        near('ζ = 0.3 → 0.589', minMuForLowerPeak(0.3, 0.7), 0.589, 3e-3),
        near('ζ = 0.5 → 0.685', minMuForLowerPeak(0.5, 0.7), 0.685, 3e-3),
        near('locked → 1/0.49 − 1 = 1.041', minMuForLowerPeak(Infinity, 0.7), 1.0408, 1e-4),
        near('Den Hartog optimum μ = 0.05: β = 0.952', opt.beta, 0.95238, 1e-4),
        near('… ζ = 0.127', opt.zeta, 0.1273, 1e-3),
        near('… equal fixed-point heights √(1 + 2/μ) = 6.403', fo.amp[0], Math.sqrt(41), 1e-6),
        near('… (Q matches P)', fo.amp[1], Math.sqrt(41), 1e-6),
      ];
    },
  },
  {
    id: 'a4-branches',
    topic: 'A4',
    title: 'Damped absorber: the dip climbs to meet the upper peak (fold), then one peak heads for 1/√(1 + μ)',
    source: 'Fine-grid scan (20 000 points, bisection on the peak count) of the LC4 §3.5 formula, done independently in Python',
    run: () => {
      const b = peakBranches(0.05, 1, 0.75, 1.3);
      const b21 = peakBranches(0.5308163, 1, 0.45, 1.7);
      const dip = primaryDips(0.05, 1, 0.1, 0.75, 1.3);
      const lastLower = b.lower[b.lower.length - 1];
      return [
        isTrue('μ = 0.05: a fold exists and the upper peak is the one that vanishes', !!b.fold && b.fold.branch === 'upper', JSON.stringify(b.fold)),
        near('μ = 0.05: fold at ζ = 0.1296', b.fold?.z ?? NaN, 0.1296, 1e-2),
        near('… at g = 1.0526', b.fold?.g ?? NaN, 1.0526, 4e-3),
        near('μ = 0.05, ζ = 0.1: the filled-in zero sits at g = 1.01397', dip[0]?.g ?? NaN, 1.01397, 1e-3),
        near('μ = 0.05, ζ = 2: the surviving peak is at g = 0.97572 (→ 0.97590 locked)', lastLower[1], 0.97572, 1e-3),
        isTrue('the surviving (lower) branch rises monotonically', b.lower.every((p, i) => i === 0 || p[1] >= b.lower[i - 1][1] - 1e-6)),
        near('2021 design (μ = 0.531): fold at ζ = 0.288', b21.fold?.z ?? NaN, 0.2882, 1e-2),
        isTrue('2021 design: lower peak passes g = 0.70 as ζ grows', b21.lower[0][1] <= 0.7 + 1e-3 && b21.lower[b21.lower.length - 1][1] > 0.7),
      ];
    },
  },
  {
    id: 'a4-helpers',
    topic: 'A4',
    title: 'A4 simulation helpers: signed absorber amplitudes, grids and axis ladders',
    source: 'Consistency with the direct 2×2 receptance (LA6 Eq 6.20–6.21)',
    run: () => {
      const out = [];
      const m1 = 40;
      const k1 = 6.317e5;
      for (const [mu, beta, g] of [
        [0.2, 1, 0.5],
        [0.2, 1, 1.5],
        [0.05, 1.1, 0.93],
        [0.5, 0.9, 1.3],
      ]) {
        const m2 = mu * m1;
        const k2 = mu * beta * beta * k1;
        const W = g * Math.sqrt(k1 / m1);
        const c = chainReceptances(m1, k1, m2, k2, W);
        const s = absorberSigned(mu, beta, g);
        out.push(near(`X₁k₁/F₀ = α₁₁k₁ (μ = ${mu}, β = ${beta}, g = ${g})`, s.x1, c.a11 * k1, 1e-9));
        out.push(near(`X₂k₁/F₀ = α₂₁k₁ (μ = ${mu}, β = ${beta}, g = ${g})`, s.x2, c.a12 * k1, 1e-9));
        out.push(near(`|signed| = primaryAmplitude (μ = ${mu}, β = ${beta}, g = ${g})`, Math.abs(s.x1), primaryAmplitude(mu, beta, g), 1e-9));
      }
      out.push(near('derived reference: μ = 0.2, g = 0.5 → X₁k₁/F₀ = 1.46341', absorberSigned(0.2, 1, 0.5).x1, 1.46341, 1e-5));
      out.push(near('derived reference: μ = 0.2, g = 1.5 → X₁k₁/F₀ = −1.12360', absorberSigned(0.2, 1, 1.5).x1, -1.1236, 1e-4));
      const grid = featureGrid(0.2, 80, 300, [19.5, 31.6, 44.7, 51.2]);
      let sorted = true;
      for (let i = 1; i < grid.length; i++) if (grid[i] < grid[i - 1]) sorted = false;
      out.push(isTrue('featureGrid is sorted and within range', sorted && grid[0] >= 0.2 && grid[grid.length - 1] <= 80));
      out.push(near('ladderCeil(74.2) = 80', ladderCeil(74.2), 80, 1e-12));
      out.push(near('ladderCeil(100) = 100', ladderCeil(100), 100, 1e-12));
      out.push(near('ladderCeil(0.031) = 0.04', ladderCeil(0.031), 0.04, 1e-12));
      return out;
    },
  },
  {
    id: 'a4-content',
    topic: 'A4',
    title: 'A4 content: one correct option per MCQ, a reason on every option, unique ids, card links',
    run: () => {
      const res = [];
      for (const q of mcqs) {
        const nOk = q.options.filter((o) => o.correct).length;
        res.push(isTrue(`${q.id}: exactly one correct option, every option has a why`, nOk === 1 && q.options.every((o) => o.why.trim().length > 3), `${nOk} correct`));
      }
      const ids = [...cards.map((c) => c.id), ...flashcards.map((f) => f.id), ...mcqs.map((q) => q.id), ...games.map((g) => g.id), ...generators.map((g) => g.id)];
      res.push(isTrue('all A4 ids are unique', new Set(ids).size === ids.length));
      const genIds = new Set(generators.map((g) => g.id));
      const badLinks = cards.flatMap((c) => (c.solveIds || []).filter((s) => !genIds.has(s)));
      res.push(isTrue('every card solveId exists', badLinks.length === 0, badLinks.join(', ')));
      res.push(isTrue('every generator cardId exists', generators.every((g) => !g.cardId || cards.some((c) => c.id === g.cardId))));
      res.push(isTrue('15–30 flashcards, 12–16 MCQs', flashcards.length >= 15 && flashcards.length <= 30 && mcqs.length >= 12 && mcqs.length <= 16, `${flashcards.length}, ${mcqs.length}`));
      return res;
    },
  },
  {
    id: 'a4-upper-trap',
    topic: 'A4',
    title: 'Absorber sizing: μ, m₂, k₂ (and the stroke) sized on the upper new frequency are named as a trap in every tier',
    source: 'Review round 2: #/A4/solve/a4-absorber-size?t=2&s=2401 gave a generic “Not quite” for μ = 0.07864; summary notes trap 2',
    run: () => {
      const gen = generators.find((g) => g.id === 'a4-absorber-size');
      if (!gen) return [isTrue('a4-absorber-size exists', false)];
      // What the checker names for a 4-significant-figure answer.
      const named = (p: SolvePart | undefined, v: number) => (p?.kind === 'numeric' ? checkNumeric(p, v.toPrecision(4)).trapId : 'no such part');
      const out: CheckResult[] = [];
      const r = gen.generate(makeRng(2401), 2);
      const mu2401 = r.parts.find((p) => p.id === 'mu');
      out.push(isTrue('tier 2, seed 2401 (critical speed 15 % lower): μ = 0.07864 → absorber-lower-binds', named(mu2401, 0.07864) === 'absorber-lower-binds', String(named(mu2401, 0.07864))));
      let bad = '';
      for (let s = 1; s <= 300 && !bad; s++)
        for (const t of [1, 2] as const) {
          const inst = gen.generate(makeRng(s * 7919), t);
          const muP = inst.parts.find((p) => p.id === 'mu');
          if (muP?.kind !== 'numeric') {
            bad = `no μ part (seed ${s}, tier ${t})`;
            break;
          }
          const x = 1 - tunedRatios(muP.answer)[0]; // the margin, recovered from the right answer
          const scale = muFromRatio(1 + x) / muP.answer; // upper-frequency design / right design
          if (named(muP, muP.answer * scale) !== 'absorber-lower-binds') bad = `μ (seed ${s}, tier ${t})`;
          for (const id of ['m2', 'ma', 'k2', 'ka']) {
            const p = inst.parts.find((q) => q.id === id);
            if (p?.kind === 'numeric' && named(p, p.answer * scale) !== 'absorber-lower-binds') bad = `${id} (seed ${s}, tier ${t})`;
          }
        }
      out.push(isTrue('tiers 1–2, 300 seeds: μ, m₂/mₐ, k₂/kₐ from r₂ = 1 + x are named absorber-lower-binds', !bad, bad));
      bad = '';
      let lowerSeen = 0;
      let upperSeen = 0;
      for (let s = 1; s <= 300 && !bad; s++) {
        const inst = gen.generate(makeRng(s * 7919), 3);
        const margins = (inst.givens || []).find((g) => g.sym.includes('x_{lo}'))?.value.match(/[\d.]+/g)?.map((v) => Number(v) / 100);
        if (!margins || margins.length !== 2) {
          bad = `margins not found (seed ${s})`;
          break;
        }
        const s4 = sizeForMargins(margins[0], margins[1]);
        const other = Math.min(s4.muLower, s4.muUpper);
        const want = s4.binds === 'lower' ? 'absorber-lower-binds' : 'a4-both-limits';
        if (s4.binds === 'lower') lowerSeen++;
        else upperSeen++;
        const scale = other / s4.mu;
        for (const [id, f] of [['mu', scale], ['m2', scale], ['k2', scale], ['X2', 1 / scale]] as const) {
          const p = inst.parts.find((q) => q.id === id);
          if (named(p, p?.kind === 'numeric' ? p.answer * f : NaN) !== want) bad = `${id} (seed ${s}, ${s4.binds} binds)`;
        }
      }
      out.push(isTrue(`tier 3, 300 seeds (${lowerSeen} lower-binding, ${upperSeen} upper-binding): the smaller candidate is named, as the right trap`, !bad && lowerSeen > 0 && upperSeen > 0, bad));
      return out;
    },
  },
  {
    id: 'a4-generators',
    topic: 'A4',
    title: 'Every A4 generator builds valid problems at every tier (50 seeds): finite answers, 4 hints, traps ≥ 2 % away, one correct choice',
    run: () =>
      generators.map((g) => {
        let bad = '';
        for (let s = 1; s <= 50 && !bad; s++)
          for (const t of g.tiers) {
            const inst = g.generate(makeRng(s * 7919), t);
            const text = [inst.prompt, ...inst.hints, ...inst.parts.map((p) => p.label)].join(' ');
            if (/NaN|undefined|Infinity/.test(text)) bad = `NaN/undefined in text (seed ${s}, tier ${t})`;
            if (inst.hints.length !== 4) bad = 'needs 4 hints';
            for (const p of inst.parts) {
              if (p.kind === 'numeric') {
                if (!Number.isFinite(p.answer)) bad = `${p.id} not finite (seed ${s}, tier ${t})`;
                for (const tr of p.traps || []) if (Math.abs(tr.value - p.answer) <= 0.02 * Math.abs(p.answer)) bad = `${p.id}: trap within 2 % (seed ${s}, tier ${t})`;
              }
              if (p.kind === 'choice' && p.options.filter((o) => o.correct).length !== 1) bad = `${p.id}: not exactly one correct option (seed ${s}, tier ${t})`;
              if (p.kind === 'matrix' && p.answer.some((row) => row.some((v) => !Number.isFinite(v)))) bad = `${p.id}: matrix not finite`;
            }
          }
        return isTrue(`${g.id}`, !bad, bad);
      }),
  },
];
