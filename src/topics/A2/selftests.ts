// Self-tests for topic A2: reference values from the 2017–2025 papers and worked solutions, the
// weekly quizzes and the reader (research notes §6, ST-01 to ST-31), checks that every energy tile
// set reproduces M and K (and the exact nonlinear energies' Hessians), a generator sanity test, and
// a TeX syntax check of every string the topic renders.
import katex from 'katex';
import type { SelfTest } from '../../selftest/types';
import type { CheckResult } from '../../selftest/types';
import { isTrue, near, nearAbs } from '../../selftest/assert';
import { modalInitialConditions, modeRatio2, modes } from '../../physics/mdof';
import { bouncePitchK } from '../../physics/rigidbody';
import type { Mat } from '../../physics/linalg';
import { makeRng } from '../../engine/rng';
import type { SolveInstance } from '../../engine/types';
import {
  G_STD,
  beltOmega2,
  boxInertia,
  boxK,
  cartRodFreeOmega2,
  cartRodMK,
  gearMK,
  hessianAt0,
  hoodK,
  hoodYThetaK,
  nestSwingMK,
  nestSwingOmega2,
  platformK,
  platformSuppressionOmega,
  rollingFactor,
  ropeStiffness,
  springPointM,
  twoCarOmega2,
} from './physics';
import { assemble, barSystem, beltSystem, boxSystem, cartRodSystem, correctMatrices, hoodSystem, nestSystem, platformSystem, piecesToMat, type SystemDef } from './systems';
import { generators } from './solve';
import { cards, flashcards } from './learn';
import { games, mcqs, shortAnswers } from './quiz';
import { speakTeX, termName } from './speech';

const TAU = 2 * Math.PI;
const D2R = Math.PI / 180;
const w = (K: Mat, M: Mat) => modes(K, M).omega;

function matClose(label: string, A: Mat, B: Mat, rel = 1e-6): CheckResult {
  let big = 0;
  let err = 0;
  B.forEach((r, i) => r.forEach((x, j) => ((big = Math.max(big, Math.abs(x))), (err = Math.max(err, Math.abs(x - A[i][j]))))));
  return isTrue(label, err <= rel * (big || 1), `max error ${err.toExponential(2)} vs scale ${big.toExponential(2)}`);
}

// ------------------------------------------------------------------ TeX syntax check helpers

const MATH = /\$\$([\s\S]+?)\$\$|\$([^$]+?)\$/g;
function texErrors(rich: string | undefined, where: string, out: string[]) {
  if (!rich) return;
  const src = rich.replace(/\\\$/g, '\u0000');
  let m: RegExpExecArray | null;
  const re = new RegExp(MATH.source, 'g');
  while ((m = re.exec(src))) {
    const tex = (m[1] ?? m[2]).split('\u0000').join('$');
    try {
      katex.renderToString(tex, { throwOnError: true, strict: 'ignore', displayMode: !!m[1] });
    } catch (e) {
      out.push(`${where}: ${(e as Error).message.slice(0, 120)}`);
    }
  }
}
function rawTexError(tex: string, where: string, out: string[]) {
  try {
    katex.renderToString(tex, { throwOnError: true, strict: 'ignore' });
  } catch (e) {
    out.push(`${where}: ${(e as Error).message.slice(0, 120)}`);
  }
}
function instanceTexErrors(inst: SolveInstance, where: string, out: string[]) {
  texErrors(inst.prompt, `${where} prompt`, out);
  inst.givens?.forEach((g, i) => rawTexError(g.sym, `${where} given ${i}`, out));
  inst.hints.forEach((h, i) => texErrors(h, `${where} hint ${i + 1}`, out));
  for (const p of inst.parts) {
    texErrors(p.label, `${where} ${p.id} label`, out);
    if (p.kind === 'numeric') p.traps?.forEach((t) => texErrors(t.message, `${where} ${p.id} trap`, out));
    if (p.kind === 'choice') p.options.forEach((o) => (texErrors(o.text, `${where} ${p.id} option`, out), texErrors(o.why, `${where} ${p.id} why`, out)));
    if (p.kind === 'order') p.steps.forEach((s) => texErrors(s, `${where} ${p.id} step`, out));
    if (p.kind === 'matrix') {
      p.rowLabels?.forEach((s) => texErrors(s, `${where} ${p.id} row`, out));
      p.colLabels?.forEach((s) => texErrors(s, `${where} ${p.id} col`, out));
      p.traps?.forEach((t) => texErrors(t.message, `${where} ${p.id} trap`, out));
    }
    if (p.kind === 'terms') {
      p.coords.forEach((c) => rawTexError(c, `${where} coord`, out));
      p.terms.forEach((t) => (texErrors(t.tex, `${where} term ${t.id}`, out), texErrors(t.why, `${where} term ${t.id} why`, out)));
    }
  }
}

// ------------------------------------------------------------------ systems used by several tests

const SYSTEMS: SystemDef[] = [
  cartRodSystem({ m: 5, M: 3, L: 1, k: 10, g: 10 }),
  barSystem({ m: 1000, J: 810, k1: 18e3, a: 1.0, k2: 22e3, b: 1.5 }),
  nestSystem({ m: 20, I: 0.8, h: 2, k: 30 }),
  beltSystem({ IT: 0.05, IP: 0.4, R1: 0.05, R2: 0.15, k: 2e4 }),
  platformSystem({ m: 20, IG: 1.6773, k1: 300, k2: 500, a: 0.4 }),
  boxSystem({ m: 2000, kx: 4e7, ky: 5e6, a: 2, b: 1.5, c: Math.SQRT2 }),
  hoodSystem({ m: 28, I: 15, kx: 0.24e6, ky: 0.08e6, s: 0.5, d: 0.5 }),
];

export const tests: SelfTest[] = [
  {
    id: 'a2-small-angle',
    topic: 'A2',
    title: 'Small-angle errors: sin θ ≈ θ within 1 % to about 13°; cos θ ≈ 1 fails first',
    source: 'Reader LA2-4 (ST-01, ST-02)',
    run: () => {
      const t13 = 13 * D2R;
      const t14 = 14 * D2R;
      const e = (approx: number, exact: number) => (Math.abs(approx - exact) / Math.abs(exact)) * 100;
      return [
        near('sin θ ≈ θ error at 13° = 0.863 %', e(t13, Math.sin(t13)), 0.8632, 2e-3),
        near('sin θ ≈ θ error at 14° = 1.002 %', e(t14, Math.sin(t14)), 1.0021, 2e-3),
        near('cos θ ≈ 1 error at 13° = 2.630 %', e(1, Math.cos(t13)), 2.6304, 2e-3),
        nearAbs('cos θ ≈ 1 − θ²/2 error at 13° = 0.0113 %', e(1 - (t13 * t13) / 2, Math.cos(t13)), 0.0113, 2e-4),
      ];
    },
  },
  {
    id: 'a2-reader',
    topic: 'A2',
    title: 'Reader examples: double pendulum, LA4 car (both coordinate sets), geared shaft, coupled pendulums',
    source: 'Reader LA4 Eqs 4.1–4.18, LA4-5 note, LA2 Eq 2.3 (ST-03 to ST-07)',
    run: () => {
      const dp = modes([[2, 0], [0, 1]], [[2, 1], [1, 1]]);
      const Kc = bouncePitchK(18e3, 1.0, 22e3, 1.5);
      const car = modes(Kc, [[1000, 0], [0, 810]]);
      const xr = car.omega2.map((w2) => 1 / modeRatio2(Kc, [[1000, 0], [0, 810]], w2));
      const Ma = springPointM(1000, 810, 1.0, 1.5);
      const gear = w([[2, -1], [-1, 1]], [[1, 0], [0, 1]]);
      const cp = modes([[50 * 0.16 + 9.81, -8], [-8, 8 + 9.81]], [[1, 0], [0, 1]]).omega2;
      return [
        near('double pendulum ω₁/√(g/l) = 0.765367', dp.omega[0], 0.765367, 1e-6),
        near('double pendulum ω₂/√(g/l) = 1.847759', dp.omega[1], 1.847759, 1e-6),
        near('double pendulum mode 1: θ₂/θ₁ = +√2', dp.P[1][0], Math.SQRT2, 1e-6),
        near('LA4 car K₁₂ = 15 000', Kc[0][1], 15000, 1e-12),
        near('LA4 car K₂₂ = 67 500', Kc[1][1], 67500, 1e-12),
        near('LA4 car ω₁ = 5.8593 rad/s', car.omega[0], 5.8593, 1e-4),
        near('LA4 car ω₂ = 9.4341 rad/s', car.omega[1], 9.4341, 1e-4),
        near('LA4 car x/θ mode 1 = −2.6461 m', xr[0], -2.6461, 1e-4),
        near('LA4 car x/θ mode 2 = 0.3061 m', xr[1], 0.3061, 1e-3),
        near('axle coordinates: M₁₁ = 489.6', Ma[0][0], 489.6, 1e-9),
        near('axle coordinates: M₁₂ = 110.4', Ma[0][1], 110.4, 1e-9),
        near('axle coordinates: same ω₁ (K = diag(k₁, k₂))', w([[18e3, 0], [0, 22e3]], Ma)[0], 5.8593, 1e-4),
        near('geared shaft (G = 1): ω₁/√(k/I) = 0.618034', gear[0], 0.618034, 1e-6),
        near('geared shaft (G = 1): ω₂/√(k/I) = 1.618034', gear[1], 1.618034, 1e-6),
        near('coupled pendulums ω₁² = g/l = 9.81', cp[0], 9.81, 1e-9),
        near('coupled pendulums ω₂² = 25.81', cp[1], 25.81, 1e-9),
      ];
    },
  },
  {
    id: 'a2-quiz-values',
    topic: 'A2',
    title: 'Quiz values: rail cars, rolling bodies, slider–bob, aerofoil options, 2018 A1.4 coordinate sets',
    source: 'Official 2017 A1(c); Week 3 Q2; Week 1 Q5; Week 2 Q1–Q3; official 2018 A1.4 (ST-08 to ST-13)',
    run: () => {
      const wc = Math.sqrt(twoCarOmega2(2000, 2000, 280e3));
      const w3 = Math.sqrt(twoCarOmega2(73e3, 81e3, 44e6));
      const [m, I, kx, ky, a, h] = [50, 4, 3e4, 6e4, 0.5, 0.3];
      const wa = w([[2 * kx, 2 * kx * h], [2 * kx * h, 2 * ky * a * a + 2 * kx * h * h]], [[m, 0], [0, I]]);
      const wb = w([[2 * kx, 0], [0, 2 * ky * a * a]], [[m, -h * m], [-h * m, I + m * h * h]]);
      const wd = w([[2 * kx, 0], [0, 2 * ky * h * h]], [[m, -a * m], [-a * m, I + m * a * a]]);
      const aeroA = w([[1000, 0], [0, 30]], [[2, -0.2], [-0.2, 0.05]]);
      const aeroB = w([[1000, 0], [0, 30]], [[2, -0.2], [-0.2, 0.05 - 0.02]]);
      return [
        near('2017 A1: ω = 16.7332 rad/s', wc, 16.7332, 1e-5),
        near('2017 A1: f = 2.6632 Hz (MCQ answer 2.66 Hz)', wc / TAU, 2.66317, 1e-5),
        near('Week 3 Q2: ω₂ = 33.8519 rad/s', w3, 33.8519, 1e-5),
        near('Week 3 Q2: f₂ = 5.3877 Hz', w3 / TAU, 5.38769, 1e-5),
        near('solid cylinder: Y = 0.816497', rollingFactor(0.5), 0.816497, 1e-6),
        near('hoop: Y = 0.707107', rollingFactor(1), 0.707107, 1e-6),
        near('solid sphere: Y = 0.845154', rollingFactor(0.4), 0.845154, 1e-6),
        near('double-counted cylinder (m_eff = 2.5m): 0.632456', rollingFactor(1.5), 0.632456, 1e-6),
        near('slider–bob (m 1, l 0.5, k 100): ω_x = √(k/3m) = 5.7735', Math.sqrt(100 / 3), 5.7735, 1e-4),
        near('aerofoil option A: ω₁ = 18.2574', aeroA[0], 18.2574, 1e-4),
        near('aerofoil option B (J_CG at 2,2): ω₂ = 64.3231', aeroB[1], 64.3231, 1e-4),
        near('2018 A1.4 (a): 31.5245 rad/s', wa[0], 31.5245, 1e-5),
        near('2018 A1.4 (b) = (a): 95.1641 rad/s', wb[1], 95.1641, 1e-5),
        near('2018 A1.4 (d), a and h swapped: 21.2132 rad/s', wd[0], 21.2132, 1e-5),
        near('2018 A1.4 (d): 84.8528 rad/s', wd[1], 84.8528, 1e-5),
      ];
    },
  },
  {
    id: 'a2-2022',
    topic: 'A2',
    title: '2022 A2 cart with a swinging rod: frequencies, modes, free response, single-mode θ₀, k → 0',
    source: '2022 worked A2.2–A2.5 (ST-14, ST-15)',
    run: () => {
      const { M, K } = cartRodMK(5, 3, 1, 10, 10);
      const r = modes(K, M);
      const r1 = r.P[1][0];
      const r2 = r.P[1][1];
      const { y0 } = modalInitialConditions(r.P, [1, 0], [0, 0]);
      return [
        near('M = [[8, 3],[3, 4]]: M₂₂ = 4ML²/3 = 4', M[1][1], 4, 1e-12),
        near('ω₁ = 1.08959 rad/s', r.omega[0], 1.08959, 1e-5),
        near('ω₂ = 3.31462 rad/s', r.omega[1], 3.31462, 1e-5),
        near('r₁ = Θ/X = 0.141048', r1, 0.141048, 1e-5),
        near('r₂ = −2.363270', r2, -2.36327, 1e-5),
        near('node of mode 2: 0.423143 L below the pivot', -1 / r2, 0.423143, 1e-5),
        near('Y₀ = P⁻¹[1, 0]: 0.943678', y0[0], 0.943678, 1e-5),
        near('Y₀ second entry 0.056322', y0[1], 0.056322, 1e-4),
        near('θ coefficient r₁Y₁₀ = 0.133103', r1 * y0[0], 0.133103, 1e-5),
        near('single-mode θ₀ = 8.0814°', (r1 * 180) / Math.PI, 8.0814, 1e-4),
        near('k → 0: ω₂² = 3g(m+M)/(L(4m+M)) = 10.4348', cartRodFreeOmega2(5, 3, 1, 10), 10.4348, 1e-5),
        near('k → 0 via the eigen-solver', modes([[0, 0], [0, 30]], M).omega2[1], 10.4348, 1e-5),
        nearAbs('k → 0: the other ω² = 0', modes([[0, 0], [0, 30]], M).omega2[0], 0, 1e-9),
      ];
    },
  },
  {
    id: 'a2-2021',
    topic: 'A2',
    title: '2021 A2 nest swing: λ formula = eigen-solution, mode shapes, k → 0, rope stiffness; 2021 A1.5 minibus',
    source: '2021 worked A2.2–A2.6 and A1.5 (illustrative values; ST-22 to ST-24)',
    run: () => {
      const { M, K } = nestSwingMK(20, 0.8, 2, 30);
      const r = modes(K, M);
      const f = nestSwingOmega2(20, 0.8, 2, 30);
      const ratio = r.omega2.map((w2) => 1 / modeRatio2(K, M, w2)); // θ/φ
      const k0 = modes(nestSwingMK(20, 0.8, 2, 1e-9).K, nestSwingMK(20, 0.8, 2, 1e-9).M);
      const mb = modes(bouncePitchK(90e3, 1.3, 90e3, 1.7), [[3000, 0], [0, 5070]]);
      const nodes = mb.omega2.map((w2) => -1 / modeRatio2(bouncePitchK(90e3, 1.3, 90e3, 1.7), [[3000, 0], [0, 5070]], w2));
      return [
        near('λ₃ = 42.78', f.l3, 42.78, 1e-6),
        near('ω₁ = 2.20211 rad/s (eigen)', r.omega[0], 2.20211, 1e-5),
        near('ω₁ from the λ formula', Math.sqrt(f.w2[0]), r.omega[0], 1e-9),
        near('ω₂ = 6.15879 rad/s', Math.sqrt(f.w2[1]), 6.15879, 1e-5),
        near('mode 1: θ/φ = λ₁/ω₁² − 1 = 6.73307', ratio[0], 6.73307, 1e-5),
        near('mode 2: θ/φ = −0.011355', ratio[1], -0.011355, 1e-4),
        near('k → 0: ω₂² = g/h = 4.905', k0.omega2[1], G_STD / 2, 1e-6),
        near('k → 0: θ = −φ (θ/φ = −1)', 1 / modeRatio2(nestSwingMK(20, 0.8, 2, 1e-9).K, nestSwingMK(20, 0.8, 2, 1e-9).M, k0.omega2[1]), -1, 1e-6),
        near('rope k = EL sin²2α at 30°: 225', ropeStiffness(1000, 0.3, 30 * D2R), 225, 1e-9),
        near('rope k at 45°: 300 (maximum)', ropeStiffness(1000, 0.3, 45 * D2R), 300, 1e-9),
        near('minibus f₁ = 1.19691 Hz', mb.omega[0] / TAU, 1.19691, 1e-5),
        near('minibus f₂ = 1.46514 Hz', mb.omega[1] / TAU, 1.46514, 1e-5),
        near('minibus node product = −I/m = −1.690', nodes[0] * nodes[1], -1.69, 1e-6),
      ];
    },
  },
  {
    id: 'a2-2023',
    topic: 'A2',
    title: '2023 A2 folding-leg platform: K back-solve, frequencies, modes, bounce suppression and the sign slip',
    source: '2023 worked A2.2–A2.5 (ST-17 to ST-19)',
    run: () => {
      const K = platformK(300, 500, 0.4, true);
      const M = [[20, 0], [0, 1.6773]];
      const r = modes(K, M);
      const xt = r.omega2.map((w2) => 1 / modeRatio2(K, M, w2));
      return [
        near('K₁₁ = k₁/3 + k₂/4 = 225', K[0][0], 225, 1e-12),
        near('K₁₂ = k₂a/2 = 100', K[0][1], 100, 1e-12),
        near('K₂₂ = k₂a² = 80', K[1][1], 80, 1e-12),
        near('case (I) is uncoupled: K₁₁ = 350', platformK(300, 500, 0.4, false)[0][0], 350, 1e-12),
        near('I_G = 20(1 + 0.08²)/12 = 1.677333', (20 * (1 + 0.0064)) / 12, 1.677333, 1e-6),
        near('ω₁ = 2.090372 rad/s', r.omega[0], 2.090372, 1e-5),
        near('ω₂ = 7.387560 rad/s', r.omega[1], 7.38756, 1e-5),
        near('mode 1 X/Θ = −0.726708 m', xt[0], -0.726708, 1e-5),
        near('mode 2 X/Θ = 0.115404 m', xt[1], 0.115404, 1e-4),
        near('bounce suppression ω* = 8.803722 rad/s', platformSuppressionOmega(K, 1.6773, 0.5), 8.803722, 1e-5),
        near('ω* = 1.401156 Hz', platformSuppressionOmega(K, 1.6773, 0.5) / TAU, 1.401156, 1e-5),
        near('sign-slip value √((80 − 50)/1.6773) = 4.2292', Math.sqrt(30 / 1.6773), 4.2292, 1e-4),
        near('leg length l = 4a/√3 = 0.92376 m', (4 * 0.4) / Math.sqrt(3), 0.92376, 1e-5),
      ];
    },
  },
  {
    id: 'a2-2024',
    topic: 'A2',
    title: '2024 A2 box on four rubber springs: I_z, frequencies, mode ratios, the fifth spring',
    source: '2024 worked A2.1–A2.5 (ST-20)',
    run: () => {
      const m = 2000;
      const c = Math.SQRT2;
      const Iz = boxInertia(m, 2, c);
      const Mm = [[m, 0, 0], [0, m, 0], [0, 0, Iz]];
      const K = boxK(4e7, 5e6, 2, c);
      const r = modes(K, Mm);
      const r5 = modes(boxK(4e7, 5e6, 2, c, true), Mm);
      const Kxt = [[K[0][0], K[0][2]], [K[2][0], K[2][2]]];
      const xt = modes(Kxt, [[m, 0], [0, Iz]]).omega2.map((w2) => 1 / modeRatio2(Kxt, [[m, 0], [0, Iz]], w2));
      return [
        near('I_z = m(a² + c²)/3 = 4000 kg m²', Iz, 4000, 1e-9),
        near('ω = 69.5981 rad/s', r.omega[0], 69.5981, 1e-5),
        near('bounce ω = 100.0000 rad/s', r.omega[1], 100, 1e-6),
        near('ω = 406.3940 rad/s', r.omega[2], 406.394, 1e-5),
        near('x/θ = −1.50536 m', xt[0], -1.50536, 1e-5),
        near('x/θ = +1.32858 m', xt[1], 1.32858, 1e-5),
        near('fifth spring: 79.2709 rad/s', r5.omega[0], 79.2709, 1e-5),
        near('fifth spring: 115.7621 rad/s', r5.omega[1], 115.7621, 1e-5),
        near('fifth spring: 455.8676 rad/s', r5.omega[2], 455.8676, 1e-5),
      ];
    },
  },
  {
    id: 'a2-2025',
    topic: 'A2',
    title: '2025 A2 range hood: printed K, frequencies (rpm), sway, suppressed y, F₀, Θ and X',
    source: '2025 worked A2.2–A2.4 (ST-21)',
    run: () => {
      const kx = 0.24e6;
      const K = hoodYThetaK(kx, kx / 3, 0.5, 0.5);
      const M = [[28, 0], [0, 15]];
      const r = modes(K, M);
      const Wa = Math.sqrt(K[1][1] / 15);
      const F0 = 0.02 * Wa * Wa;
      const rpm = (x: number) => (x * 60) / TAU;
      return [
        near('K/kₓ = [[1, −0.5],[−0.5, 0.75]]: K₁₂', K[0][1] / kx, -0.5, 1e-12),
        near('K₂₂/kₓ = 0.75', K[1][1] / kx, 0.75, 1e-12),
        near('3×3 hood K: K_xx = 3kₓ', hoodK(kx, kx / 3, 0.5, 0.5)[0][0], 3 * kx, 1e-12),
        near('ω₁ = 64.6879 rad/s', r.omega[0], 64.6879, 1e-5),
        near('ω₁ = 617.72 rpm', rpm(r.omega[0]), 617.72, 1e-5),
        near('ω₂ = 1222.42 rpm', rpm(r.omega[1]), 1222.42, 1e-5),
        near('Θ/Y mode 1 = 1.02361', modeRatio2(K, M, r.omega2[0]), 1.02361, 1e-5),
        near('sway ωₓ = 1531.29 rpm', rpm(Math.sqrt((3 * kx) / 28)), 1531.29, 1e-5),
        near('Ω_a = 1046.07 rpm', rpm(Wa), 1046.07, 1e-5),
        near('F₀ = 240 N', F0, 240, 1e-9),
        near('Θ = F₀/K_yθ = −2.000e−3 rad', F0 / K[0][1], -0.002, 1e-9),
        near('X = 0.625 mm', F0 / (3 * kx - 28 * Wa * Wa), 6.25e-4, 1e-9),
      ];
    },
  },
  {
    id: 'a2-free',
    topic: 'A2',
    title: 'Unrestrained systems: belt drive and motor–gear–load',
    source: 'Official 2019 Q2 and 2018 A2 formulas (illustrative values; ST-25, ST-26)',
    run: () => {
      const belt = beltSystem({ IT: 0.05, IP: 0.4, R1: 0.05, R2: 0.15, k: 2e4 });
      const rb = modes(belt.K, belt.M);
      const g = gearMK(0.02, 3, 5, 800);
      const rg = modes(g.K, g.M);
      return [
        nearAbs('belt: ω₁ = 0 (det K = 0)', rb.omega2[0], 0, 1e-6),
        near('belt: ωₙ² = 2k(R₁²/I_T + R₂²/I_P) = 4250', rb.omega2[1], 4250, 1e-9),
        near('belt formula = eigen-solution', beltOmega2(2e4, 0.05, 0.15, 0.05, 0.4), 4250, 1e-12),
        near('belt rigid mode θ₂/θ₁ = R₁/R₂ = 1/3', rb.P[1][0], 1 / 3, 1e-6),
        near('belt flexible mode θ₂/θ₁ = −0.375', rb.P[1][1], -0.375, 1e-6),
        near('k for exactly 10 Hz = 18 578.08 N/m', (20 * Math.PI) ** 2 / (2 * (0.05 ** 2 / 0.05 + 0.15 ** 2 / 0.4)), 18578.08, 1e-6),
        nearAbs('gear: ω₁ = 0', rg.omega2[0], 0, 1e-6),
        near('gear: ω = 43.2049 rad/s', rg.omega[1], 43.2049, 1e-5),
        near('gear: θ_G/θ_L = −6', rg.P[0][1] / rg.P[1][1], -6, 1e-6),
      ];
    },
  },
  {
    id: 'a2-tiles',
    topic: 'A2',
    title: 'Every system’s correct energy tiles reproduce M and K; tiles are symmetric; wrong tiles change M or K',
    source: 'systems.ts against the reference matrices',
    run: () =>
      SYSTEMS.flatMap((s) => {
        const c = correctMatrices(s);
        const wrongChanges = s.tiles
          .filter((t) => t.belongs === 'none' && (t.m || t.k))
          .every((t) => {
            const place: Record<string, 'T' | 'V' | 'none'> = {};
            for (const u of s.tiles) place[u.id] = u.belongs;
            place[t.id] = t.m ? 'T' : 'V';
            const a = assemble(s, place);
            const diff = (A: Mat, B: Mat) => A.some((r, i) => r.some((x, j) => Math.abs(x - B[i][j]) > 1e-9 * (1 + Math.abs(B[i][j]))));
            return diff(a.M, s.M) || diff(a.K, s.K);
          });
        return [matClose(`${s.id}: Σ correct T tiles = M`, c.M, s.M), matClose(`${s.id}: Σ correct V tiles = K`, c.K, s.K), isTrue(`${s.id}: each wrong tile, if used, changes M or K`, wrongChanges)];
      }),
  },
  {
    id: 'a2-builder-names',
    topic: 'A2',
    title: 'Energy builder: every candidate term has its own plain-text accessible name (role + expression, no TeX left)',
    source: 'Review round 2 (accessibility): the terms of one body shared one name, e.g. “rod: candidate term”',
    run: () => {
      // Expected readings, written with explicit combining dots (U+0307) and compared in NFC.
      const reads = (tex: string, want: string) => isTrue(`${tex} reads “${want.normalize('NFC')}”`, speakTeX(tex) === want.normalize('NFC'), speakTeX(tex));
      const out: CheckResult[] = [
        reads('\\tfrac12 m\\dot x^2', '½ m ẋ²'),
        reads('\\tfrac12 k_1(y - a\\theta)^2', '½ k₁(y − a θ)²'),
        reads('\\tfrac12 I_T\\dot\\theta_1^2', '½ I_T θ̇₁²'),
        reads('\\tfrac12 k_1\\left(\\tfrac{x}{\\sqrt3}\\right)^2', '½ k₁(x/√3)²'),
      ];
      for (const s of SYSTEMS) {
        const names = s.tiles.map(termName);
        const leftover = names.filter((n) => /[\\$^{}]|undefined/.test(n));
        // Distinct even if a screen reader drops the combining dot of θ̇.
        const bare = new Set(names.map((n) => n.normalize('NFD').replace(/[̀-ͯ]/g, '')));
        out.push(isTrue(`${s.id}: ${names.length} distinct names, no TeX left`, new Set(names).size === names.length && bare.size === names.length && leftover.length === 0, leftover.slice(0, 2).join(' | ') || names.join(' | ')));
      }
      return out;
    },
  },
  {
    id: 'a2-hessians',
    topic: 'A2',
    title: 'M and K equal the Hessians of the exact nonlinear energies (cart–rod, nest swing, bar, platform, box, hood)',
    source: 'Finite-difference Hessians at q = 0 (ST-30, ST-31)',
    run: () => {
      // cart–rod: T(q̇) at q = 0, V(q) exact
      const [m, M, L, k, g] = [5, 3, 1, 10, 10];
      const IG = (M * (2 * L) ** 2) / 12;
      const Tcart = (v: number[]) => 0.5 * m * v[0] ** 2 + 0.5 * M * ((v[0] + L * v[1]) ** 2 + 0) + 0.5 * IG * v[1] ** 2;
      const Vcart = (q: number[]) => 0.5 * k * q[0] ** 2 + M * g * L * (1 - Math.cos(q[1]));
      const cart = cartRodSystem({ m, M, L, k, g });
      // nest swing exact V
      const nest = nestSystem({ m: 20, I: 0.8, h: 2, k: 30 });
      const Vnest = (q: number[]) => 20 * G_STD * 2 * (1 - Math.cos(q[0])) + 0.5 * 30 * q[1] ** 2;
      // bar with finite rotation: vertical motion of (p, 0) is y + p sin θ
      const bar = barSystem({ m: 1000, J: 810, k1: 18e3, a: 1.0, k2: 22e3, b: 1.5 });
      const Vbar = (q: number[]) => 0.5 * 18e3 * (q[0] - 1.0 * Math.sin(q[1])) ** 2 + 0.5 * 22e3 * (q[0] + 1.5 * Math.sin(q[1])) ** 2;
      // 2023 platform, exact leg geometry: pivot height l/2 + x, mid-points at (±s/2, H/2)
      const [a, k1, k2] = [0.4, 300, 500];
      const l = (4 * a) / Math.sqrt(3);
      const H0 = l / 2;
      const s0 = Math.sqrt(l * l - H0 * H0);
      const len0 = H0 / 2;
      const Vpf = (q: number[]) => {
        const H = H0 + q[0];
        const s = Math.sqrt(l * l - H * H);
        const top = [a * Math.cos(q[1]), H + a * Math.sin(q[1])];
        const mid = [s / 2, H / 2];
        const len = Math.hypot(top[0] - mid[0], top[1] - mid[1]);
        return 0.5 * k1 * (s - s0) ** 2 + 0.5 * k2 * (len - len0) ** 2;
      };
      // 2024 box: springs at (p, −c) with shear kx and axial ky, finite rotation
      const [kx, ky, ab, c] = [4e7, 5e6, 2, Math.SQRT2];
      const Vbox = (q: number[]) => {
        let V = 0;
        for (const [p, hasY] of [[-ab, 1], [ab, 1], [0, 1], [0, 1]] as const) {
          const dx = q[0] + p * (Math.cos(q[2]) - 1) + c * Math.sin(q[2]);
          const dy = q[1] + p * Math.sin(q[2]) - c * (Math.cos(q[2]) - 1);
          V += 0.5 * kx * dx * dx + (hasY ? 0.5 * ky * dy * dy : 0);
        }
        return V;
      };
      const box = boxSystem({ m: 2000, kx, ky, a: ab, b: 1.5, c });
      // 2025 hood: mounts at (−d, +s), (−d, 0), (−d, −s); axial kₓ along x, transverse k_y along y, finite rotation
      const [hkx, hky, hs, hd] = [0.24e6, 0.08e6, 0.5, 0.5];
      const Vhood = (q: number[]) => {
        let V = 0;
        for (const py of [hs, 0, -hs]) {
          const px = -hd;
          const dx = q[0] + px * (Math.cos(q[2]) - 1) - py * Math.sin(q[2]);
          const dy = q[1] + px * Math.sin(q[2]) + py * (Math.cos(q[2]) - 1);
          V += 0.5 * hkx * dx * dx + 0.5 * hky * dy * dy;
        }
        return V;
      };
      const hood = hoodSystem({ m: 28, I: 15, kx: hkx, ky: hky, s: hs, d: hd });
      return [
        matClose('cart–rod: Hessian of T = M', hessianAt0(Tcart, 2, 1e-3), cart.M, 1e-5),
        matClose('cart–rod: Hessian of V = K (keeps MgL)', hessianAt0(Vcart, 2, 1e-4), cart.K, 1e-5),
        matClose('nest swing: Hessian of V = K', hessianAt0(Vnest, 2, 1e-4), nest.K, 1e-5),
        matClose('bar: Hessian of V = K (signs of the lever arms)', hessianAt0(Vbar, 2, 1e-5), bar.K, 1e-5),
        matClose('2023 platform (II): exact-geometry Hessian = [[225, 100],[100, 80]]', hessianAt0(Vpf, 2, 1e-5), [[225, 100], [100, 80]], 1e-4),
        matClose('2024 box: exact Hessian = K', hessianAt0(Vbox, 3, 1e-6), box.K, 1e-4),
        matClose('2025 hood: exact Hessian = K (printed kₓ[[1, −0.5],[−0.5, 0.75]] block)', hessianAt0(Vhood, 3, 1e-6), hood.K, 1e-4),
        near('2025 hood tiles: K_yθ/kₓ = −0.5', correctMatrices(hood).K[1][2] / hkx, -0.5, 1e-12),
      ];
    },
  },
  {
    id: 'a2-generators',
    topic: 'A2',
    title: 'Every A2 generator builds valid problems at every tier (50 seeds): finite answers, 4 hints, traps > 2 % away, consistent term sets',
    run: () =>
      generators.map((gen) => {
        let bad = '';
        for (let s = 1; s <= 50 && !bad; s++)
          for (const t of gen.tiers) {
            const inst = gen.generate(makeRng(s * 7919), t);
            if (inst.hints.length !== 4) bad = `needs 4 hints (seed ${s}, tier ${t})`;
            for (const p of inst.parts) {
              if (p.kind === 'numeric') {
                if (!Number.isFinite(p.answer)) bad = `${p.id} not finite (seed ${s}, tier ${t})`;
                for (const tr of p.traps || []) if (Math.abs(tr.value - p.answer) <= 0.02 * Math.abs(p.answer)) bad = `${p.id} trap within 2 % (seed ${s}, tier ${t})`;
              }
              if (p.kind === 'matrix' && p.answer.some((r) => r.some((x) => !Number.isFinite(x)))) bad = `${p.id} matrix not finite (seed ${s}, tier ${t})`;
              if (p.kind === 'choice' && !p.options.some((o) => o.correct)) bad = `${p.id} has no correct option (seed ${s}, tier ${t})`;
              if (p.kind === 'terms') {
                const n = p.coords.length;
                const Ms = Array.from({ length: n }, () => new Array<number>(n).fill(0));
                const Ks = Array.from({ length: n }, () => new Array<number>(n).fill(0));
                for (const term of p.terms) {
                  if (term.belongs === 'T' && term.M) term.M.forEach((r, i) => r.forEach((x, j) => (Ms[i][j] += x)));
                  if (term.belongs === 'V' && term.K) term.K.forEach((r, i) => r.forEach((x, j) => (Ks[i][j] += x)));
                }
                const off = (A: Mat, B: Mat) => A.some((r, i) => r.some((x, j) => Math.abs(x - B[i][j]) > 1e-9 * (1 + Math.abs(B[i][j]))));
                if (off(Ms, p.M) || off(Ks, p.K)) bad = `${p.id} terms do not sum to M/K (seed ${s}, tier ${t})`;
              }
            }
          }
        return isTrue(gen.id, !bad, bad);
      }),
  },
  {
    id: 'a2-tex',
    topic: 'A2',
    title: 'Every TeX string in A2 (cards, flashcards, quiz, games, generated problems over 20 seeds) parses in KaTeX',
    run: () => {
      const out: string[] = [];
      for (const c of cards) {
        [c.what, c.when, c.more, ...c.how, ...(c.formulas || [])].forEach((s, i) => texErrors(s, `card ${c.id} #${i}`, out));
        c.traps.forEach((t) => texErrors(t.detail, `card ${c.id} trap`, out));
      }
      flashcards.forEach((f) => (texErrors(f.front, f.id, out), texErrors(f.back, f.id, out)));
      for (const q of mcqs) {
        texErrors(q.stem, q.id, out);
        q.options.forEach((o) => (texErrors(o.text, q.id, out), texErrors(o.why, q.id, out)));
      }
      for (const g of games) {
        texErrors(g.prompt, g.id, out);
        if (g.kind === 'sort') g.items.forEach((it) => (texErrors(it.text, g.id, out), texErrors(it.why, g.id, out)));
        else g.pairs.forEach((p) => (texErrors(p.left, g.id, out), texErrors(p.right, g.id, out), texErrors(p.why, g.id, out)));
      }
      shortAnswers.forEach((s) => (texErrors(s.prompt, s.id, out), texErrors(s.model, s.id, out)));
      for (const sys of SYSTEMS) {
        texErrors(sys.setup, `${sys.id} setup`, out);
        if (/[\t]|_[A-Za-z]/.test(sys.setup.replace(/\$[^$]*\$/g, ''))) out.push(`${sys.id} setup: raw underscore or tab outside TeX`);
        sys.tiles.forEach((t) => (texErrors(t.tex, `${sys.id} ${t.id}`, out), texErrors(t.why, `${sys.id} ${t.id}`, out)));
        sys.Msym.flat().concat(sys.Ksym.flat()).forEach((e) => rawTexError(e, `${sys.id} sym`, out));
        sys.tiles.forEach((t) => [...(t.m || []), ...(t.k || [])].forEach((p) => rawTexError(p.tex, `${sys.id} piece`, out)));
        isTrue('pieces', piecesToMat(sys.coords.length, []).length === sys.coords.length);
      }
      for (const gen of generators)
        for (let s = 1; s <= 20; s++) for (const t of gen.tiers) instanceTexErrors(gen.generate(makeRng(s * 104729), t), `${gen.id} t${t} s${s}`, out);
      return [isTrue('no KaTeX parse errors', out.length === 0, out.slice(0, 4).join(' | '))];
    },
  },
];
