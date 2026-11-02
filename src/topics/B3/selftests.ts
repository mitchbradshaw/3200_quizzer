// Self-tests for topic B3: exam and reader values the beam physics and this topic's helpers must reproduce,
// plus a sanity sweep over every generator. Exact βL roots throughout (the handout's are rounded).
import type { SelfTest, CheckResult } from '../../selftest/types';
import { near, nearAbs, isTrue } from '../../selftest/assert';
import { type BeamBC, betaL, beamOmega, frequencyRatios, nodes, rectangle, thinTube } from '../../physics/beams';
import { beamResponse } from '../../physics/forcedBeam';
import { makeRng } from '../../engine/rng';
import type { SolveGenerator } from '../../engine/types';
import { generators } from './solve';
import { bcChangeFactor, handoutModeShape, lengthForOmega, omegaFromRg, rgForOmega, rgRect, rgTube, staticCoefficient, torsionWaveSpeed } from './physics';

const TAU = 2 * Math.PI;
const b1 = (bc: BeamBC) => betaL(bc, 1)[0];

/** Generator sanity: finite answers, four hints, traps clear of the answer, every choice part answerable. */
export function generatorSanity(gens: SolveGenerator[], seeds = 50): CheckResult[] {
  return gens.map((g) => {
    let bad = '';
    for (let s = 1; s <= seeds && !bad; s++)
      for (const t of g.tiers) {
        const inst = g.generate(makeRng(s * 7919), t);
        if (inst.hints.length !== 4 || inst.hints.some((h) => !h || h.includes('NaN') || h.includes('undefined'))) bad = `hints (seed ${s}, tier ${t})`;
        if (inst.prompt.includes('NaN') || inst.prompt.includes('undefined')) bad = `prompt (seed ${s}, tier ${t})`;
        for (const p of inst.parts) {
          if (p.kind === 'numeric') {
            if (!Number.isFinite(p.answer)) bad = `${p.id} not finite (seed ${s}, tier ${t})`;
            for (const tr of p.traps || [])
              if (!Number.isFinite(tr.value) || Math.abs(tr.value - p.answer) <= Math.max(0.02 * Math.abs(p.answer), p.absTol ?? 0)) bad = `${p.id} trap ${tr.value} within 2 % of ${p.answer} (seed ${s}, tier ${t})`;
          }
          if (p.kind === 'choice' && !p.options.some((o) => o.correct)) bad = `${p.id} has no correct option (seed ${s}, tier ${t})`;
          if (p.kind === 'choice' && !p.multi && p.options.filter((o) => o.correct).length !== 1) bad = `${p.id} single-choice with ${p.options.filter((o) => o.correct).length} correct (seed ${s}, tier ${t})`;
        }
      }
    return isTrue(`${g.id}: ${seeds} seeds × tiers ${g.tiers.join(',')}`, !bad, bad);
  });
}

export const tests: SelfTest[] = [
  {
    id: 'b3-exam-design',
    topic: 'B3',
    title: 'B2.1 design numbers: 2022 wing, 2023 blade, 2024 shaft, 2025 tidal blade',
    source: '2022–2025 B2 worked solutions (research notes B3-N4, N5, N7, N8)',
    run: () => {
      // 2022 B2.1: CFRP rectangle, in-plane, L = 3 m, 2400 rpm × 2.5.
      const w1a = 2.5 * ((TAU * 2400) / 60);
      const w = rgForOmega(w1a, b1('clamped-free'), 3, 280e9, 1600) * Math.sqrt(12);
      const ra = frequencyRatios('clamped-free', 3);
      // 2023 B2.1: tube, L = 86.4 m, tip 150 m/s, 1.8Ω, ×2.
      const w1b = 2 * 1.8 * (150 / 86.4);
      const d = rgForOmega(w1b, b1('clamped-free'), 86.4, 13.23e9, 1820) * 2 * Math.SQRT2;
      // 2025 B2.1: tube d = 0.2 m, 40 GPa, 1900 kg/m³, 180 rpm.
      const L25 = lengthForOmega((TAU * 180) / 60, b1('clamped-free'), rgTube(0.2), 40e9, 1900);
      // 2024 B2.1 + B2.4: steel, fixed–fixed torsion at 7200 rpm, pinned–pinned bending, d = 0.7 m.
      const L24 = torsionWaveSpeed(210e9, 0.3, 7850) / (2 * 120);
      const fB = [1, 2, 3].map((i) => omegaFromRg(i * Math.PI, rgTube(0.7), L24, 210e9, 7850) / TAU);
      return [
        near('2022: w = 0.4212 m', w, 0.4212, 1e-3),
        near('2022: f₂ = 626.7 Hz', 100 * ra[1], 626.7, 1e-3),
        near('2022: f₃ = 1755.1 Hz', 100 * ra[2], 1755.1, 1e-3),
        near('2023: d = 13.92 m', d, 13.922, 1e-3),
        near('2023: f₁ = 0.9947 Hz', w1b / TAU, 0.9947, 1e-3),
        near('2023: f₃ = 17.46 Hz', (w1b / TAU) * ra[2], 17.458, 1e-3),
        near('2025: L = 7.779 m', L25, 7.7789, 1e-3),
        near('2025: f₂ = 18.80 Hz', 3 * ra[1], 18.802, 1e-3),
        near('2025: f₃ = 52.65 Hz', 3 * ra[2], 52.652, 1e-3),
        near('2024: L = 13.365 m', L24, 13.3652, 1e-4),
        near('2024: f_B1 = 11.256 Hz', fB[0], 11.256, 1e-3),
        near('2024: f_B2 = 45.03 Hz', fB[1], 45.025, 1e-3),
        near('2024: f_B3 = 101.3 Hz', fB[2], 101.306, 1e-3),
        near('2022 cruise: out-of-plane f₁ = 100 Hz × t/w = 1.073 Hz', 100 * (0.00452 / w), 1.0731, 2e-3),
      ];
    },
  },
  {
    id: 'b3-ratio-trick',
    topic: 'B3',
    title: 'Ratio trick and support changes',
    source: 'Official 2018/2019 B2.1; Week 8 Q2 worked solution; summary notes B3',
    run: () => {
      const cf = frequencyRatios('clamped-free', 3);
      const ff = frequencyRatios('free-free', 3);
      const wk8 = 48 * (betaL('free-free', 3)[2] / b1('clamped-free')) ** 2 * 0.85 ** 2;
      return [
        near('2018 wing: f₂ = 50.14 Hz from f₁ = 8 Hz', 8 * cf[1], 50.14, 1e-3),
        near('2018 wing: f₃ = 140.4 Hz', 8 * cf[2], 140.38, 1e-3),
        near('2019 fuselage: f₂ = 82.69 Hz from f₁ = 30 Hz', 30 * ff[1], 82.69, 1e-3),
        near('2019 fuselage: f₃ = 162.1 Hz', 30 * ff[2], 162.13, 1e-3),
        near('Week 8 Q2: racquet free–free f₃ = 1193 Hz (exact constants 1192.5)', wk8, 1192.5, 2e-3),
        near('pinned–pinned → clamped–clamped: × 2.2668', bcChangeFactor('pinned-pinned', 'clamped-clamped'), 2.2668, 1e-4),
        near('pinned–pinned → cantilever: × 0.3562', bcChangeFactor('pinned-pinned', 'clamped-free'), 0.35624, 1e-3),
        near('cantilever → clamped–clamped (embedded drill rod): × 6.363', bcChangeFactor('clamped-free', 'clamped-clamped'), 6.3633, 1e-3),
      ];
    },
  },
  {
    id: 'b3-nodes',
    topic: 'B3',
    title: 'Node positions used in the questions',
    source: 'Research notes B3.6-C (exact constants); LB5 p. 95; summary notes B3; Week 8 Q1',
    run: () => [
      nearAbs('free–free mode 1: 0.22416L', nodes('free-free', 1)[0], 0.22416, 2e-5),
      nearAbs('free–free mode 1: 0.77584L', nodes('free-free', 1)[1], 0.77584, 2e-5),
      nearAbs('cantilever mode 2: 0.78344L', nodes('clamped-free', 2)[0], 0.78344, 2e-5),
      nearAbs('cantilever mode 3: 0.50355L', nodes('clamped-free', 3)[0], 0.50355, 2e-5),
      nearAbs('cantilever mode 3: 0.86768L', nodes('clamped-free', 3)[1], 0.86768, 2e-5),
      nearAbs('clamped–clamped mode 3: 0.35845L', nodes('clamped-clamped', 3)[0], 0.35845, 2e-5),
      nearAbs('clamped–pinned mode 2: 0.55750L', nodes('clamped-pinned', 2)[0], 0.5575, 2e-5),
      nearAbs('free–pinned mode 1: 0.26422L (from the free end)', nodes('free-pinned', 1)[0], 0.26422, 2e-5),
      nearAbs('free–free mode 2: 0.13211L', nodes('free-free', 2)[0], 0.13211, 2e-5),
      nearAbs('racquet 680 mm: sweet spot 152.4 mm from the tip', 680 * nodes('free-free', 1)[0], 152.43, 0.05),
    ],
  },
  {
    id: 'b3-handout-constants',
    topic: 'B3',
    title: 'Handout (rounded) constants near a far end',
    source: 'Research notes B3.6-D and B3.9 #1 (handout footnote: accuracy near x = L is very sensitive)',
    run: () => [
      nearAbs('cantilever mode 1 tip with C₁ = 0.734: +2.0001', handoutModeShape('clamped-free', 1, 1), 2.0001, 2e-4),
      nearAbs('cantilever mode 2 tip with C₁ = 1.019: −2.0295', handoutModeShape('clamped-free', 2, 1), -2.0295, 2e-4),
      nearAbs('cantilever mode 3 tip with C₁ = 0.9992: +2.032', handoutModeShape('clamped-free', 3, 1), 2.032, 2e-3),
      nearAbs('cantilever mode 4 tip with C₁ = 1.00003: −1.895', handoutModeShape('clamped-free', 4, 1), -1.895, 2e-3),
      nearAbs('clamped–clamped mode 2 far end with handout constants: +0.0094 (not 0)', handoutModeShape('clamped-clamped', 2, 1), 0.0094, 5e-4),
      nearAbs('pinned–pinned mid-span with C₁ = 1.414 (exact √2 = 1.41421)', handoutModeShape('pinned-pinned', 1, 0.5), 1.414, 1e-6),
    ],
  },
  {
    id: 'b3-sections',
    topic: 'B3',
    title: 'Section scaling, reader examples and static coefficients',
    source: 'Reader W7.4(a), sample problem 3 (dragline boom), official 2016 B2.1; summary notes B3; beam tables',
    run: () => {
      const E = 210e9;
      const rho = 7850;
      const w74 = beamOmega(Math.PI, E, 1.58e-5, rho * 2.32e-3, 10);
      const boom = betaL('clamped-free', 3).map((b) => beamOmega(b, E, 79, rho * 4.64, 100) / TAU);
      const ratios16 = betaL('clamped-free', 3).map((b) => (b * b * (2 / Math.PI) * 0.01) / Math.sqrt(12) * 100);
      const tubeA = thinTube(0.3, 0.004);
      const tubeB = thinTube(0.3, 0.012);
      const wA = beamOmega(1.875, E, tubeA.I, rho * tubeA.A, 2);
      const wB = beamOmega(1.875, E, tubeB.I, rho * tubeB.A, 2);
      const rA = rectangle(0.01, 0.2);
      const rB = rectangle(0.05, 0.2);
      const static40 = (bc: BeamBC, xe: number) => beamResponse({ bc, x: xe, xe, Omega: 1e-9, P: 1, L: 1, EI: 1, rhoA: 1, nModes: 40 }).y;
      return [
        near('W7.4(a): simply supported I-beam f₁ = 6.705 Hz', w74 / TAU, 6.705, 1e-3),
        near('dragline boom f₁ = 1.194 Hz', boom[0], 1.194, 1e-3),
        near('dragline boom f₃ = 20.96 Hz', boom[2], 20.958, 1e-3),
        near('dragline: rope length for resonance with mode 1, g/ω₁² = 0.174 m', 9.81 / (boom[0] * TAU) ** 2, 0.1743, 2e-3),
        near('2016 B2.1: bending mode 1 = 0.646 % of the axial fundamental (h/L = 1/100)', ratios16[0], 0.646, 2e-3),
        near('2016 B2.1: bending mode 3 = 11.34 %', ratios16[2], 11.339, 2e-3),
        near('thin tube: tripling t leaves ω unchanged', wB, wA, 1e-12),
        near('thin tube r_g = d/(2√2)', Math.sqrt(tubeA.I / tubeA.A), rgTube(0.3), 1e-12),
        near('rectangle: changing b leaves √(I/A) unchanged', Math.sqrt(rB.I / rB.A), Math.sqrt(rA.I / rA.A), 1e-12),
        near('rectangle r_g = h/√12', Math.sqrt(rA.I / rA.A), rgRect(0.2), 1e-12),
        near('cantilever tip load: δ coefficient 1/3 = modal sum (40 modes)', staticCoefficient('clamped-free')!.c, static40('clamped-free', 1), 1e-4),
        near('pinned–pinned mid-span: 1/48 = modal sum', staticCoefficient('pinned-pinned')!.c, static40('pinned-pinned', 0.5), 1e-5),
        near('clamped–clamped mid-span: 1/192 = modal sum', staticCoefficient('clamped-clamped')!.c, static40('clamped-clamped', 0.5), 1e-4),
        near('clamped–pinned mid-span: 7/768 = modal sum', staticCoefficient('clamped-pinned')!.c, static40('clamped-pinned', 0.5), 1e-4),
        isTrue('free–free has no static coefficient (rigid-body modes)', staticCoefficient('free-free') === null),
        near('rgForOmega inverts omegaFromRg', omegaFromRg(4.73, rgForOmega(500, 4.73, 3, E, rho), 3, E, rho), 500, 1e-12),
        near('lengthForOmega inverts omegaFromRg', omegaFromRg(1.875, 0.05, lengthForOmega(80, 1.875, 0.05, E, rho), E, rho), 80, 1e-12),
      ];
    },
  },
  {
    id: 'b3-generators',
    topic: 'B3',
    title: 'Every B3 generator builds valid problems at every tier (50 seeds)',
    run: () => generatorSanity(generators),
  },
];
