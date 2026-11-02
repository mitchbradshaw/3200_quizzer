// Self-tests for topic B6: the B2 papers rebuilt from the B6 helpers (official 2016/2018/2019 solutions,
// 2021–2025 worked solutions, recomputed in the research notes, section B6.6), the design studio's model,
// the "choose the sketch" figures, and content and generator sanity checks.
import type { SelfTest } from '../../selftest/types';
import { ascending, isTrue, near, nearAbs } from '../../selftest/assert';
import { betaL, modeShape } from '../../physics/beams';
import { endInertiaRoots } from '../../physics/waves';
import { hashString, makeRng } from '../../engine/rng';
import { TAU, modalCoef, modalCoefMax, ratios, rectOmega, sectionFactor, southwellCoef, torsionHz, torsionSpeed, tubeOmega } from './physics';
import { SCENARIOS, bendingOmegas, checks, dimSI, initialDesign, massCheck, minDim, response, torsionHzs, worstCase, type Design } from './studioModel';
import { sampleNodes, shapeSamples, sketchQuestion } from './sketches';
import { cards, flashcards, traps } from './learn';
import { games, mcqs, shortAnswers } from './quiz';
import { generators } from './solve';
import { explore } from './explore';
import { traps as b5Traps } from '../B5/learn';
import { contentChecks, generatorChecks } from '../B5/checks';

const CF = betaL('clamped-free', 3);

export const tests: SelfTest[] = [
  {
    id: 'b6-2016-2019',
    topic: 'B6',
    title: 'Official 2016, 2018 and 2019 B2 values (harvester, A380 wing, A380 fuselage)',
    source: 'Official 2016 B2.1 (0.65, 4.05, 11.3 %), 2018 B2.1/B2.3 (50.1, 140.4 Hz; 35.2 %, 34.4 %), 2019 B2.1/B2.3 (82.7, 162.1 Hz; mode 1 146 %); research B6.6 T-ST01–06',
    run: () => {
      const pctAxial = CF.map((b) => (100 * b * b * 2 * 0.01) / (Math.PI * Math.sqrt(12)));
      const A = modalCoef('clamped-free', [0.35], 1, 1.2);
      const B = modalCoef('clamped-free', [0.65], 1, 1.2);
      const ff = ratios('free-free');
      const r1 = 50 / 30;
      const r2 = 40 / 30;
      return [
        near('2016 B2.1: f₁ = 0.646 % of the axial fundamental (h/L = 0.01)', pctAxial[0], 0.6462, 1e-3),
        near('2016 B2.1: f₂ = 4.049 %', pctAxial[1], 4.0494, 1e-3),
        near('2016 B2.1: f₃ = 11.34 %', pctAxial[2], 11.3385, 1e-3),
        near('2016 B2.3: power ∝ Ω⁵/(1 − Ω²/ω₁²): 0.5 → 0.25 gives 2.5 %', (0.25 ** 5 / (1 - 0.25 ** 2)) / (0.5 ** 5 / (1 - 0.5 ** 2)), 0.025, 1e-9),
        near('2018 B2.1: f₂ = 50.14 Hz from f₁ = 8 Hz', 8 * ratios('clamped-free')[1], 50.135, 1e-4),
        near('2018 B2.1: f₃ = 140.4 Hz', 8 * ratios('clamped-free')[2], 140.38, 1e-4),
        near('2018 B2.3: engine A tip term, mode 1 = −0.13301 PL³/EI', A.terms[0].c, -0.13301, 1e-3),
        near('2018 B2.3: engine B tip sum = −0.3909', B.total, -0.3909, 1e-3),
        near('2018 B2.3: A as % of B = 35.19 % (official 35.2 %)', (100 * A.total) / B.total, 35.19, 1e-3),
        near('2018 B2.3: mode 1 only 34.44 % (official 34.4 %)', (100 * A.terms[0].c) / B.terms[0].c, 34.44, 1e-3),
        near('2019 B2.1: f₂ = 82.70 Hz from 30 Hz (free–free ×2.756)', 30 * ff[1], 82.696, 1e-4),
        near('2019 B2.1: f₃ = 162.12 Hz (×5.404)', 30 * ff[2], 162.12, 1e-4),
        near('2019 B2.3: Y₁(0.6L) of the free–free beam = −1.0405', modeShape('free-free', 1, 0.6), -1.0405, 1e-3),
        near('2019 B2.3: cruise/take-off, mode 1 only = 146.3 %', (100 * ((r2 * r2) / (1 - r2 * r2))) / ((r1 * r1) / (1 - r1 * r1)), 146.29, 1e-3),
      ];
    },
  },
  {
    id: 'b6-2021-2025',
    topic: 'B6',
    title: 'Worked 2021–2025 B2 values (axle, eVTOL wing, wind blade, hydro shaft, tidal blade)',
    source: 'WS2021–WS2025 B2, recomputed in the research notes (B6.6 T-ST07–T-ST11)',
    run: () => {
      // 2021: reflected inertia and the end-inertia drop (SN 0: GRW = 0.30)
      const Ieff = (2.6 / 0.3) ** 2 * 4 + (3.1 / 0.3) ** 2 * 6;
      const z = endInertiaRoots(2 / Ieff, 1)[0];
      // 2022 eVTOL wing
      const Om22 = (2400 * TAU) / 60;
      const w22 = (2.5 * Om22 * 9) / (CF[0] ** 2 * Math.sqrt(280e9 / (12 * 1600)));
      const S22 = modalCoef('clamped-free', [0.5, 0.9], 1, 0.4);
      const P22 = 1e-3 * Om22 * Om22;
      const t22 = (12 * ((S22.total * P22 * 27) / 1e-4)) / 280e9 / w22 ** 3;
      // 2023 wind blade
      const Om23 = 150 / 86.4;
      const r23 = (2 * 1.8 * Om23 * 86.4 ** 2) / (CF[0] ** 2 * Math.sqrt(13.23e9 / (2 * 1820)));
      const S23 = modalCoef('clamped-free', [0.5], 1, 0.5).total;
      const P23 = (0.005 * 86.4 * 13.23e9 * Math.PI * r23 ** 3 * 0.01 * r23) / (S23 * 86.4 ** 3);
      // 2024 hydro shaft
      const c24 = torsionSpeed(210e9, 0.3, 7850);
      const L24 = c24 / 240;
      const fb24 = (Math.PI ** 2 * sectionFactor('tube', 0.7, 210e9, 7850)) / (L24 * L24) / TAU;
      // 2025 tidal blade
      const L25 = Math.sqrt((CF[0] ** 2 * sectionFactor('tube', 0.2, 40e9, 1900)) / ((180 * TAU) / 60));
      const c25 = torsionSpeed(40e9, 0.3, 1900);
      const co25 = modalCoef('clamped-free', [2 / 3], 1, 3.4);
      const tot = co25.terms.reduce((s, t) => s + Math.abs(t.c), 0);
      return [
        near('2021 B2.4: I_eff = 941.1 I_a (SN 0)', Ieff, 941.11, 1e-4),
        near('2021 B2.5: ω₁/ω_A1 = 0.02934 (−97.1 %)', z / (Math.PI / 2), 0.02934, 1e-3),
        near('2022 B2.1: minimum width w = 0.4212 m', w22, 0.42116, 1e-4),
        near('2022 B2.1: f₂ = 626.7 Hz, f₃ = 1754.7 Hz (ratios)', 100 * ratios('clamped-free')[2], 1754.75, 1e-4),
        near('2022 B2.3: tip coefficient 0.4617 PL³/EI (3 modes)', S22.total, 0.46166, 1e-4),
        near('2022 B2.3: mode 1 alone 0.4630', S22.terms[0].c, 0.46297, 1e-4),
        near('2022 B2.3: P = meΩ² = 63.17 N', P22, 63.165, 1e-4),
        near('2022 B2.3: t = 4.517 mm', t22 * 1000, 4.5171, 1e-3),
        near('2022 B2.4: out-of-plane f₁ = f₁ t/w = 1.07 Hz', (100 * t22) / w22, 1.0726, 2e-3),
        near('2023 B2.1: d = 13.92 m', 2 * r23, 13.9206, 1e-4),
        near('2023 B2.3: torsion f₁ = 4.694 Hz (c/4L)', torsionHz('fixed-free', 1, Math.sqrt(4.79e9 / 1820), 86.4), 4.694, 1e-3),
        near('2023 B2.4: S = 0.1405, P_max = 4.648 MN', P23 / 1e6, 4.6477, 1e-3),
        near('2023 B2.5: rotation stiffening K_s = 1.193, +4.50 % at Ω/ω₁ = 0.278', 100 * (Math.sqrt(1 + southwellCoef(1) * (Om23 / (2 * 1.8 * Om23)) ** 2) - 1), 4.5, 3e-3),
        near('2024 B2.1: c = 3207.7 m/s, L = 13.365 m', L24, 13.3652, 1e-4),
        near('2024 B2.4: transverse f₁ = 11.26 Hz', fb24, 11.256, 1e-3),
        near('2024 B2.4: defect/f₁ = 0.2392', (1.4 * 115.4) / 60 / fb24, 0.2392, 1e-3),
        near('2024 B2.5: −30 % response needs +42.9 % thickness', 100 * (1 / 0.7 - 1), 42.857, 1e-4),
        near('2025 B2.1: L = 7.779 m', L25, 7.7794, 1e-4),
        near('2025 B2.2: c = 2846 m/s, first torsional critical speed 5487 rpm', 60 * torsionHz('fixed-free', 1, c25, L25), 5487, 1e-3),
        near('2025 B2.3: transverse mode 1 carries 74.8 % of the tip response', (100 * Math.abs(co25.terms[0].c)) / tot, 74.8, 2e-3),
        near('2025 B2.4: tip mass 2.62 % (Dunkerley, 5 % drop)', (100 * 3 * (1 / 0.95 ** 2 - 1)) / 1.875 ** 4, 2.622, 1e-3),
        near('thin tube vs rectangle helpers agree with the section factor', tubeOmega(CF[0], 0.2, L25, 40e9, 1900), (180 * TAU) / 60, 1e-9),
        near('rectangle helper: 2022 wing at w gives 2.5 Ω', rectOmega(CF[0], w22, 3, 280e9, 1600), 2.5 * Om22, 1e-9),
        near('2024 B2 (worked): largest response to the 0.6L defect near 0.52L', modalCoefMax('pinned-pinned', [0.6], 0.2392).at, 0.52, 0.02),
      ];
    },
  },
  {
    id: 'b6-studio-model',
    topic: 'B6',
    title: 'Design studio model reproduces the 2022–2024 answers and the added-mass lesson',
    source: 'WS2022 B2.1–B2.5, WS2023 B2.1–B2.4, WS2024 B2.1–B2.6; studio scenarios in src/topics/B6/studioModel.ts',
    run: () => {
      const wing = SCENARIOS.wing;
      const blade = SCENARIOS.blade;
      const shaft = SCENARIOS.shaft;
      const wd: Design = { ...initialDesign(wing), dim: minDim(wing), thick: 4.5171 };
      const ww = worstCase(wing, wd);
      const mcW = massCheck(wing, wd);
      const bd: Design = { ...initialDesign(blade), dim: minDim(blade), thick: 0.005 };
      const bw = worstCase(blade, bd);
      const sd: Design = { ...initialDesign(shaft), dim: 0.7, thick: 30 };
      const sw = worstCase(shaft, sd).yMax;
      const sw2 = worstCase(shaft, { ...sd, thick: 30 / 0.7 }).yMax;
      const mcS = massCheck(shaft, sd);
      const mcIn = massCheck(shaft, { ...sd, massX: [0.15, 1] });
      const resp1 = response(wing, wd, 1);
      const resp05 = response(wing, wd, 0.5);
      const chW = checks(wing, { ...wd, thick: 4.52 }, mcW);
      return [
        near('wing: minimum w = 421.2 mm', minDim(wing), 421.16, 1e-4),
        near('wing: worst amplitude at t = 4.517 mm is the 0.1 mm limit', ww.yMax * 1000, 0.1, 1e-3),
        isTrue('wing: worst case at the top speed', ww.s === 1, `s = ${ww.s}`),
        near('wing: S at the tip = 0.4617', resp1.S, 0.46166, 1e-4),
        near('wing: amplitude 50 % → 100 % speed grows ≈ 4.57× (Ω² and the dynamic factor)', resp1.yMax / resp05.yMax, (4 * (1 / (1 - 0.16))) / (1 / (1 - 0.04)), 2e-3),
        near('wing: 5 kg rotors are 54.8 % of the 9.13 kg wing (w = 421 mm, t = 4.52 mm)', mcW.mu[0], 0.5475, 2e-3),
        near('wing: Dunkerley −41.5 % (the paper’s 20 % gives −23.4 %)', 100 * (mcW.rD - 1), -41.55, 2e-3),
        ascending('wing: Dunkerley ≤ exact (FE) ≤ Rayleigh with the masses', [mcW.rD, mcW.rX, mcW.rR], ['D', 'FE', 'R']),
        isTrue('wing at the paper’s answer (t rounded up to 4.52 mm): margin and amplitude met, margin with masses lost', chW.freq && chW.amp && !chW.mass, `${chW.freq} ${chW.amp} ${chW.mass}`),
        near('blade: minimum d = 13.92 m', minDim(blade), 13.9206, 1e-4),
        near('blade: at t = 0.005d and P = 4 MN the amplitude is 4/4.648 of the limit', bw.yMax / blade.limit, 4 / 4.6477, 1e-3),
        near('blade: torsion 4.694 Hz, independent of d', torsionHzs(blade)[0], 4.694, 1e-3),
        near('shaft: L = 13.37 m from 7200 rpm (fixed–fixed torsion)', shaft.L, 13.3652, 1e-4),
        near('shaft: limit is 70 % of the 0.7 m × 30 mm response', shaft.limit / sw, 0.7, 1e-9),
        near('shaft: +42.9 % wall meets it exactly (y ∝ 1/t)', sw2 / shaft.limit, 1, 1e-9),
        near('shaft: bending f₁ = 11.26 Hz at d = 0.7 m', bendingOmegas(shaft, dimSI(shaft, sd))[0] / TAU, 11.256, 1e-3),
        nearAbs('shaft: rotors on the bearings change nothing (D, R and FE)', Math.max(Math.abs(mcS.rD - 1), Math.abs(mcS.rR - 1), Math.abs(mcS.rX - 1)), 0, 1e-6),
        isTrue('shaft: a rotor moved to 0.15L lowers f₁', mcIn.rX < 0.9, `ratio ${mcIn.rX.toFixed(4)}`),
      ];
    },
  },
  {
    id: 'b6-sketches',
    topic: 'B6',
    title: '“Choose the sketch” figures: node counts, end shapes and the (a)–(d) order',
    source: 'Handout node positions (reader p. 91); summary notes B3; torsion sin((2n − 1)πx/2L)',
    run: () => {
      const n = (k: Parameters<typeof shapeSamples>[0]) => sampleNodes(shapeSamples(k));
      const out = [
        near('cantilever mode 2 node at 0.783L', n('cf2')[0], 0.7834, 2e-3),
        isTrue('cantilever mode 3 has 2 interior nodes (0.504, 0.868)', n('cf3').length === 2 && Math.abs(n('cf3')[0] - 0.5036) < 2e-3 && Math.abs(n('cf3')[1] - 0.8677) < 2e-3),
        near('fixed–free torsion mode 2 node at 2L/3', n('tff2')[0], 2 / 3, 2e-3),
        isTrue('fixed–free torsion mode 3 nodes at 0.4L and 0.8L', Math.abs(n('tff3')[0] - 0.4) < 2e-3 && Math.abs(n('tff3')[1] - 0.8) < 2e-3),
        isTrue('pinned mode 3 nodes at L/3 and 2L/3', Math.abs(n('pp3')[0] - 1 / 3) < 2e-3 && Math.abs(n('pp3')[1] - 2 / 3) < 2e-3),
        isTrue('cantilever shapes end at +1 at the free tip (scaled)', Math.abs(shapeSamples('cf2')[96] - 1) < 1e-9 && Math.abs(shapeSamples('cf3')[96] - 1) < 1e-9),
      ];
      // The figure labels (a)–(d) must match the order ChoiceInput shows (it shuffles with seed ^ hash(part id)).
      let orderOk = true;
      let oneCorrect = true;
      for (let s = 1; s <= 40; s++) {
        const seed = 1000 + s * 37;
        for (const kind of ['cantilever', 'pinned', 'torsion-ff', 'torsion-fx'] as const) {
          const q = sketchQuestion(makeRng(seed), { kind, mode: s % 2 ? 2 : 3 });
          const order = makeRng(seed ^ hashString(q.part.id)).shuffle(q.part.options.map((_, i) => i));
          const shown = order.map((i) => q.part.options[i].text);
          const want = q.part.options.map((_, i) => `Sketch (${'abcd'[i]})`);
          if (shown.join('|') !== want.join('|')) orderOk = false;
          if (q.part.options.filter((o) => o.correct).length !== 1) oneCorrect = false;
        }
      }
      out.push(isTrue('options are displayed in (a)–(d) order for 160 instances', orderOk));
      out.push(isTrue('exactly one correct sketch per instance', oneCorrect));
      return out;
    },
  },
  {
    id: 'b6-content',
    topic: 'B6',
    title: 'B6 content: ids, MCQ keys, links, trap ids and TeX',
    run: () => contentChecks({ cards, flashcards, mcqs, games, shortAnswers, solve: generators, explore, traps: [...traps, ...b5Traps] }, 'B6'),
  },
  {
    id: 'b6-generators',
    topic: 'B6',
    title: 'Every B6 generator builds valid problems at every tier (50 seeds)',
    run: () => generatorChecks(generators, [...traps, ...b5Traps].map((t) => t.id)),
  },
];
