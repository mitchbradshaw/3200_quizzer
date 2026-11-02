// Self-tests for topic B5: reference values from the reader (LB7–LB9, Sample Problems 5–7, tutorials
// W7.3–W7.8), the Week 10 quiz, official 2016/2018/2019 B2 solutions and the 2021–2025 worked solutions
// (values recomputed in the research notes), plus content and generator sanity checks.
import type { SelfTest } from '../../selftest/types';
import { ascending, isTrue, near, nearAbs } from '../../selftest/assert';
import { TRIAL_SHAPES, holzer, holzerRoots, rayleighFromTrial } from '../../physics/approx';
import { betaL } from '../../physics/beams';
import { endInertiaRoots } from '../../physics/waves';
import { brent } from '../../physics/roots';
import {
  TIP_MASS_FORMS,
  feBeam,
  feBeamDense,
  holzerChainModes,
  massEstimates,
  pinnedDunkerleyRatio,
  pinnedSineRatio,
  shaftDiscDunkerley,
  shaftDiscHolzer,
  shaftDiscRayleigh,
  tipFormC,
  tipMassDunkerley,
  tipMassExact,
  tipMassRayleighMode,
  tipMassRayleighTipLoad,
  tipMassRoots,
} from './physics';
import { cards, flashcards, traps } from './learn';
import { games, mcqs, shortAnswers } from './quiz';
import { generators } from './solve';
import { explore } from './explore';
import { contentChecks, generatorChecks } from './checks';

export const tests: SelfTest[] = [
  {
    id: 'b5-rayleigh-shapes',
    topic: 'B5',
    title: 'Rayleigh trial shapes for a cantilever, bare and with a tip mass (LB7)',
    source: 'LB7.5–LB7.8 (reader pp. 113–116); research ST02–ST07; exam 2000 Q4(d) “1.56”',
    run: () => {
      const exact = betaL('clamped-free', 1)[0] ** 2;
      const [tip, udl, sq, cosS] = TRIAL_SHAPES.cantilever;
      const C1 = (mu: number) => tipMassRoots(mu, 1)[0] ** 2 * Math.sqrt(mu);
      return [
        near('bare cantilever exact (β₁L)² = 3.5160', exact, 3.516, 1e-4),
        near('φ = x²: √20 = 4.4721 (27 % high)', rayleighFromTrial(sq, 1, 1, 1), 4.4721, 1e-4),
        near('φ = 1 − cos(πx/2L): 3.6639', rayleighFromTrial(cosS, 1, 1, 1), 3.6639, 1e-4),
        near('UDL static shape: √(162/13) = 3.5301', rayleighFromTrial(udl, 1, 1, 1), 3.5301, 1e-4),
        near('tip-load static shape: 3.5675', rayleighFromTrial(tip, 1, 1, 1), Math.sqrt(3 / (33 / 140)), 1e-6),
        near('μ = 1: exact C = 1.55730 (β₁L = 1.24792)', C1(1), 1.5573, 1e-4),
        near('μ = 1: Dunkerley C = 1.55375', tipFormC(TIP_MASS_FORMS.dunkerley, 1), 1.55375, 1e-4),
        near('μ = 1: Rayleigh tip-load C = 1.55812 (lecture “1.56”)', tipFormC(TIP_MASS_FORMS.tipLoad, 1), 1.55812, 1e-4),
        near('μ = 1: Rayleigh 1 − cos C = 1.57523', tipFormC(TIP_MASS_FORMS.cosine, 1), 1.57523, 1e-4),
        near('μ = 1: Rayleigh UDL C = 1.59567', tipFormC(TIP_MASS_FORMS.udl, 1), 1.59567, 1e-4),
        near('μ = 0.05 (ρAL = 20M): exact C = 0.71740', C1(0.05), 0.7174, 1e-4),
        near('μ = 0.05: Rayleigh UDL C = 0.72217 (best shape for a heavy beam)', tipFormC(TIP_MASS_FORMS.udl, 0.05), 0.72217, 1e-4),
        ascending('μ = 0.05: D ≤ exact ≤ R(UDL) ≤ R(tip-load) ≤ R(1−cos)', [tipFormC(TIP_MASS_FORMS.dunkerley, 0.05), C1(0.05), tipFormC(TIP_MASS_FORMS.udl, 0.05), tipFormC(TIP_MASS_FORMS.tipLoad, 0.05), tipFormC(TIP_MASS_FORMS.cosine, 0.05)], ['D', 'exact', 'UDL', 'tip', 'cos']),
        ascending('μ = 1: D ≤ exact ≤ R(tip-load) ≤ R(1−cos) ≤ R(UDL)', [tipFormC(TIP_MASS_FORMS.dunkerley, 1), C1(1), tipFormC(TIP_MASS_FORMS.tipLoad, 1), tipFormC(TIP_MASS_FORMS.cosine, 1), tipFormC(TIP_MASS_FORMS.udl, 1)], ['D', 'exact', 'tip', 'cos', 'UDL']),
      ];
    },
  },
  {
    id: 'b5-fe-convergence',
    topic: 'B5',
    title: 'FE mesh convergence: consistent mass from above, lumped from below',
    source: 'Research ST20 (numpy Hermite FE); WS2023 B1.8; LB9',
    run: () => {
      const tip = (nel: number, lumped: boolean) => feBeam({ left: 'clamped', right: 'free', nel, lumped, masses: [{ x: 1, M: 1 }], nModes: 1 }).omega[0];
      const bare = (nel: number) => feBeam({ left: 'clamped', right: 'free', nel, lumped: true, nModes: 1 }).omega[0];
      const fine = feBeam({ left: 'clamped', right: 'free', nel: 16, nModes: 3 }).omega;
      return [
        near('consistent, 1 element, μ = 1: 1.55756', tip(1, false), 1.55756, 1e-5),
        near('consistent, 2 elements: 1.55733', tip(2, false), 1.55733, 1e-5),
        near('lumped, 1 element: √2 = 1.41421', tip(1, true), 1.41421, 1e-5),
        near('lumped, 4 elements: 1.54768', tip(4, true), 1.54768, 1e-5),
        near('bare, lumped 2 elements: 3.15623', bare(2), 3.15623, 1e-5),
        near('bare, lumped 16 elements: 3.50972', bare(16), 3.50972, 1e-5),
        near('16 consistent elements reproduce ω₂ = 22.0345', fine[1], betaL('clamped-free', 2)[1] ** 2, 1e-5),
        near('16 consistent elements reproduce ω₃ = 61.6972', fine[2], betaL('clamped-free', 3)[2] ** 2, 1e-4),
        ascending('lumped < exact < consistent (μ = 1, 2 elements)', [tip(2, true), tipMassRoots(1, 1)[0] ** 2, tip(2, false)], ['lumped', 'exact', 'consistent']),
      ];
    },
  },
  {
    id: 'b5-fe-banded-solver',
    topic: 'B5',
    title: 'FE solver used by the labs (banded Sturm bisection) = dense Jacobi solve; no zero fundamental beside a mesh node',
    source: 'Cross-check of feBeam against feBeamDense; regression for masses 0.0004L–0.01L from a node (dense solve returned ω = 0)',
    run: () => {
      const ends = [
        ['clamped', 'free'],
        ['pinned', 'pinned'],
        ['clamped', 'clamped'],
      ] as const;
      const massSets = [[], [{ x: 1, M: 1 }], [{ x: 0.5, M: 0.2 }, { x: 0.9, M: 0.2 }], [{ x: 0.35, M: 0.17 }, { x: 0.65, M: 0.17 }], [{ x: 0.5, M: 9 }]];
      let worstW = 0;
      let worstV = 0;
      let cases = 0;
      const compare = (o: Parameters<typeof feBeam>[0]) => {
        const a = feBeamDense(o);
        const b = feBeam(o);
        cases++;
        if (a.omega.length !== b.omega.length) worstW = Infinity;
        a.omega.forEach((w, i) => {
          worstW = Math.max(worstW, Math.abs(b.omega[i] / w - 1));
          const big = Math.max(...a.dof[i].map(Math.abs));
          worstV = Math.max(worstV, ...a.dof[i].map((v, k) => Math.abs(v - b.dof[i][k]) / big));
        });
      };
      for (const [left, right] of ends)
        for (const nel of [1, 3, 8, 12])
          for (const lumped of [false, true]) for (const masses of massSets) compare({ left, right, nel, lumped, masses, nModes: 3 });
      compare({ left: 'clamped', right: 'free', nel: 24, masses: massSets[2], nModes: 3 });
      compare({ left: 'clamped', right: 'free', nel: 8, rootSpring: 5, nModes: 3 });
      const near = (x: number, M: number) => {
        const w = feBeam({ left: 'clamped', right: 'free', nel: 24, masses: [{ x, M }], nModes: 2 }).omega;
        const fine = feBeam({ left: 'clamped', right: 'free', nel: 60, masses: [{ x, M }], nModes: 2 }).omega;
        return Math.max(Math.abs(w[0] / fine[0] - 1), Math.abs(w[1] / fine[1] - 1));
      };
      const nearWorst = Math.max(near(0.042, 0.2), near(0.083, 0.2), near(0.99, 0.2), near(0.9, 20), near(0.5004, 1));
      return [
        isTrue(`ω agrees with the dense solve to 1e-8 (${cases} cases, up to 3 modes each)`, worstW < 1e-8, `worst ${worstW.toExponential(2)}`),
        isTrue('mode shapes agree to 1e-7 (same sign convention)', worstV < 1e-7, `worst ${worstV.toExponential(2)}`),
        isTrue('masses at 0.042L, 0.083L, 0.99L, a 20× mass, 0.5004L: ω₁, ω₂ within 1e-4 of a 60-element mesh', nearWorst < 1e-4, `worst ${nearWorst.toExponential(2)}`),
      ];
    },
  },
  {
    id: 'b5-holzer-lab-roots',
    topic: 'B5',
    title: 'Holzer lab roots (eigenvalue-seeded, polished on the residual) = a fine residual scan',
    source: 'Week 10 Q4, Sample Problem 7, tutorial W7.5 chains; shared holzerRoots scan',
    run: () => {
      const chains = [
        { n: 3, J: [6, 6, 6], k: [3e6, 3e6, 3e6], far: 'free' as const },
        { n: 2, J: [20, 10], k: [1.6e7, 1.6e7], far: 'free' as const },
        { n: 5, J: [1, 5, 20, 5, 1], k: [1e6, 1e6, 1e6, 1e6, 1e6], far: 'free' as const },
        { n: 1, J: [20], k: [1.6e7], far: 'fixed' as const },
        { n: 3, J: [6, 6, 6], k: [3e6, 3e6, 3e6], far: 'fixed' as const },
        { n: 4, J: [2, 30, 0.7, 9], k: [4e5, 6e7, 2e6, 1e5], far: 'fixed' as const },
      ];
      return chains.map((c) => {
        const lab = holzerChainModes(c).roots;
        const J = c.J.slice(0, c.n);
        const k = c.far === 'free' ? c.k.slice(0, c.n - 1) : c.k.slice(0, c.n);
        const wMax = 1.18 * Math.max(...lab, 1);
        // The shared scan puts a fixed end on the left: mirror the chain (same frequencies).
        const scan = c.far === 'free' ? holzerRoots(J, k, wMax, 'free') : holzerRoots([...J].reverse(), [k[c.n - 1], ...k.slice(0, c.n - 1).reverse()], wMax, 'fixed');
        const ok = lab.length === scan.length && lab.every((w, i) => Math.abs(w - scan[i]) <= 1e-9 * Math.max(1, scan[i]));
        return isTrue(`${c.n} disc(s), far end ${c.far}: ${lab.map((w) => w.toFixed(2)).join(', ')} rad/s`, ok, `scan ${scan.map((w) => w.toFixed(4)).join(', ')}`);
      });
    },
  },
  {
    id: 'b5-dunkerley-masses',
    topic: 'B5',
    title: 'Added masses: official 2018 and 2019 B2.4, 2022 B2.5, Week 10 Q1–Q2',
    source: 'Official 2018 B2.4 (0.904), 2019 B2.4 (84.6 %); WS2022 B2.5 (0.766); Week 10 Q1–Q2; research ST08, ST09, ST18, ST19',
    run: () => {
      const e18 = massEstimates('cantilever', [
        { x: 0.35, M: 0.17 },
        { x: 0.65, M: 0.17 },
      ]);
      const e22 = massEstimates('cantilever', [
        { x: 0.5, M: 0.2 },
        { x: 0.9, M: 0.2 },
      ]);
      const e9 = massEstimates('pinned', [{ x: 0.5, M: 9 }]);
      const Ls = 0.552;
      const a = 0.376;
      const K19 = (3 * Ls) / (a * a * (Ls - a) ** 2);
      const r19 = 1 / Math.sqrt(1 + (4.73 ** 4 * 0.3) / K19);
      const kRac = 3 / ((1 - 0.224 - 0.1) * (0.224 - 0.1) ** 2);
      return [
        near('2018: Dunkerley ω_D/ω₁₁ = 0.9045 (−9.6 %)', e18.dunkerley / e18.w11, 0.9045, 1e-4),
        near('2018: FE exact 0.9086', e18.exact / e18.w11, 0.9086, 2e-4),
        near('2022: Dunkerley 0.7661 (−23.4 %)', e22.dunkerley / e22.w11, 0.7661, 1e-4),
        near('2022: Rayleigh (bare mode) 0.7699', e22.rayleigh / e22.w11, 0.7699, 1e-4),
        near('2022: FE exact 0.7697', e22.exact / e22.w11, 0.7697, 2e-4),
        near('2022: rotor B term 0.601 vs rotor A 0.103', e22.terms[1] / e22.terms[0], 0.729 / 0.125, 1e-9),
        ascending('2022: D ≤ exact ≤ R', [e22.dunkerley, e22.exact, e22.rayleigh], ['D', 'exact', 'R']),
        near('Week 10 Q1: Rayleigh (sine) N = 9 → 1/√19 = 0.22942', pinnedSineRatio(9), 0.22942, 1e-4),
        near('Week 10 Q1: Dunkerley N = 9 → 0.2278', pinnedDunkerleyRatio(9), 0.2278, 3e-4),
        near('Week 10 Q1: FE exact N = 9 → 0.2279', e9.exact / e9.w11, 0.2279, 3e-4),
        near('2019 B2.4: K at 0.6L = 378.1 EI/L³', K19, 378.1, 2e-4),
        near('2019 B2.4: 84.6 % of the measured value', r19, 0.846, 2e-4),
        near('Week 10 Q2: racquet stiffness 288.62 EI/L³', kRac, 288.62, 1e-4),
        near('Week 10 Q2: Dunkerley ω₁/ω₁₁ = 0.9000 (k = 288)', 1 / Math.sqrt(1 + (4.73 ** 4 * 0.135) / 288), 0.9, 2e-4),
      ];
    },
  },
  {
    id: 'b5-inverse-mass',
    topic: 'B5',
    title: 'Mass from a measured drop: Dunkerley ≤ exact ≤ Rayleigh',
    source: 'WS2025 B2.4 (2.62 %, 2.70 %); official 2016 B2.4 (0.43); tutorial W7.6 (19.4) and W7.8 (68 kg); research ST16–ST17',
    run: () => {
      // W7.8(a): clamped–clamped steel beam, L = 3 m, I = 2.72e-5 m^4, A = 1.36e-2 m^2, resonance 20 % low.
      const EI = 200e9 * 2.72e-5;
      const rA = 7800 * 1.36e-2;
      const L = 3;
      const w11 = betaL('clamped-clamped', 1)[0] ** 2 * Math.sqrt(EI / (rA * L ** 4));
      const K = (192 * EI) / L ** 3;
      const Mm = (1 / 0.8 ** 2 - 1) * (K / (w11 * w11));
      return [
        near('2025: 5 % drop, Dunkerley 2.622 %', 100 * tipMassDunkerley(0.95), 2.622, 1e-3),
        near('2025: Rayleigh with the own mode 2.701 %', 100 * tipMassRayleighMode(0.95), 2.701, 1e-3),
        near('2025: exact 2.693 %', 100 * tipMassExact(0.95), 2.693, 1e-3),
        near('2025: Rayleigh with the tip-load shape 3.32 % (poor shape for a light mass)', 100 * tipMassRayleighTipLoad(0.95), 3.317, 1e-3),
        near('2016 (official r = 0.6): 0.4315', tipMassDunkerley(0.6), 0.4315, 1e-3),
        near('2016 exact 0.4360', tipMassExact(0.6), 0.436, 1e-3),
        near('W7.6: 9× drop, Dunkerley μ = 19.42', tipMassDunkerley(1 / 9), 19.42, 1e-3),
        near('W7.6: Rayleigh tip-load 19.42, exact 19.42', tipMassRayleighTipLoad(1 / 9), tipMassExact(1 / 9), 1e-3),
        near('W7.8(a): Dunkerley machine mass ≈ 68 kg', Mm, 68, 0.02),
        ascending('r = 0.95: M_D ≤ M_exact ≤ M_R(mode) ≤ M_R(tip-load)', [tipMassDunkerley(0.95), tipMassExact(0.95), tipMassRayleighMode(0.95), tipMassRayleighTipLoad(0.95)], ['D', 'exact', 'R mode', 'R tip']),
      ];
    },
  },
  {
    id: 'b5-torsion-disc',
    topic: 'B5',
    title: 'Shaft with an end disc and the grinding tool (Sample Problems 6–7)',
    source: 'Week 10 Q3 (α = 1.2810 at β = 4.9); reader pp. 124–125; WS2021 B2.5; research ST10, ST13, ST22',
    run: () => {
      const G = 80e9;
      const rho = 7700;
      const Jp = 1e-4;
      const l = 0.5;
      const J1 = 20;
      const J2 = 10;
      const c = Math.sqrt(G / rho);
      const K = (G * Jp) / l;
      const Ia = rho * Jp * l;
      // 6(a): free–free shaft with two discs: tan(ωl/c) = ω(J1 + J2)GJc/(J1J2ω²c² − G²J²), written without poles.
      const g6 = (w: number) => Math.sin((w * l) / c) * (J1 * J2 * w * w * c * c - G * G * Jp * Jp) - Math.cos((w * l) / c) * w * (J1 + J2) * G * Jp * c;
      const w6a = brent(g6, 1400, 1700);
      const w6b = (endInertiaRoots(Ia / J1, 1)[0] * c) / l;
      const z21 = endInertiaRoots(1 / 470.6, 1)[0];
      return [
        near('β = 4.9: Dunkerley α = 1.2810', shaftDiscDunkerley(4.9), 1.28103, 1e-4),
        near('β = 4.9: exact α = 1.3096', endInertiaRoots(4.9, 1)[0], 1.3096, 1e-4),
        near('β = 4.9: Rayleigh (linear twist) α = 1.3641', shaftDiscRayleigh(4.9), 1.36412, 1e-4),
        ascending('β = 1: D ≤ Holzer(3 segments) ≤ exact ≤ R', [shaftDiscDunkerley(1), shaftDiscHolzer(1, 3), endInertiaRoots(1, 1)[0], shaftDiscRayleigh(1)], ['D', 'H', 'exact', 'R']),
        near('6(a) exact: 245.8 Hz', w6a / (2 * Math.PI), 245.8, 3e-4),
        near('6(b) disc stalled, exact: 141.9 Hz', w6b / (2 * Math.PI), 141.9, 3e-4),
        near('7(a) lumped two-disc: 1549.2 rad/s', Math.sqrt((K * (J1 + J2)) / (J1 * J2)), 1549.2, 1e-4),
        near('7(a) Holzer residual at 1550 rad/s: −7.51×10⁴ N m', holzer([J1, J2], [K], 1550).residual, -7.51e4, 3e-3),
        near('7(b) Holzer, disc fixed: √(K/J₁) = 894.4 rad/s', holzerRoots([J1], [K], 1200, 'fixed')[0], 894.43, 1e-4),
        isTrue('7(b): Holzer above Rayleigh above exact (the “D, R, H” case)', Math.sqrt(K / J1) > Math.sqrt(K / (J1 + Ia / 3)) && Math.sqrt(K / (J1 + Ia / 3)) >= w6b),
        near('2021 B2.5: z₁ = 0.04608 for I_e/I_a = 470.6', z21, 0.04608, 1e-3),
        near('2021 B2.5: ω₁/ω_A1 = 0.02934 (−97.1 %)', z21 / (Math.PI / 2), 0.02934, 1e-3),
      ];
    },
  },
  {
    id: 'b5-holzer-chains',
    topic: 'B5',
    title: 'Holzer on the Week 10 Q4 and W7.5 aircraft chains',
    source: 'Week 10 Q4 plot (0, 707.5, 1224.7 rad/s; extremes +0.19×10⁷, −0.63×10⁷); tutorial W7.5 (402, 508, 1113, 1115 rad/s); research ST11–ST12',
    run: () => {
      const three = holzerRoots([6, 6, 6], [3e6, 3e6], 1400);
      let tMax = -Infinity;
      let tMin = Infinity;
      for (let w = 0; w <= 1300; w += 0.5) {
        const T = holzer([6, 6, 6], [3e6, 3e6], w).residual;
        tMax = Math.max(tMax, w < 900 ? T : -Infinity);
        tMin = Math.min(tMin, T);
      }
      const air = holzerRoots([1, 5, 20, 5, 1], [1e6, 1e6, 1e6, 1e6], 1300);
      return [
        isTrue('three equal discs: 3 roots incl. ω = 0', three.length === 3 && three[0] === 0, `${three.length} roots`),
        near('ω₂ = 707.11 rad/s', three[1], 707.11, 1e-4),
        near('ω₃ = 1224.74 rad/s', three[2], 1224.74, 1e-4),
        near('residual maximum +1.893×10⁶ N m', tMax, 1.893e6, 2e-3),
        near('residual minimum −6.338×10⁶ N m', tMin, -6.338e6, 2e-3),
        isTrue('W7.5: 5 roots including ω = 0', air.length === 5 && air[0] === 0, `${air.length} roots`),
        near('W7.5: 401.85 rad/s', air[1], 401.85, 5e-4),
        near('W7.5: 507.50 rad/s', air[2], 507.5, 5e-4),
        near('W7.5: 1112.89 rad/s', air[3], 1112.89, 5e-4),
        near('W7.5: 1114.65 rad/s', air[4], 1114.65, 5e-4),
      ];
    },
  },
  {
    id: 'b5-sample5',
    topic: 'B5',
    title: 'Sample Problem 5 turbine rotor (Rayleigh 2534 rpm, Dunkerley 2456 rpm) and W7.3 shaker',
    source: 'Reader p. 118 (Sample Problem 5(a)–(b)); tutorial W7.3 (497 Hz); research ST14–ST15',
    run: () => {
      const E = 210e9;
      const rho = 7800;
      const L = 3;
      const R2 = (0.15 ** 2 * 1.6 + 0.2 ** 2 * 1.0) / 2.6; // equal-mass uniform shaft
      const EI = (E * Math.PI * R2 * R2) / 4;
      const rA = rho * Math.PI * R2;
      const xs = [0.6, 1.5, 2.4];
      const M = 1500;
      const KE = xs.reduce((s, x) => s + M * Math.sin((Math.PI * x) / L) ** 2, 0);
      const wR = Math.sqrt((EI * (Math.PI / L) ** 4 * (L / 2)) / ((rA * L) / 2 + KE));
      const w11 = (Math.PI / L) ** 2 * Math.sqrt(EI / rA);
      const Ks = xs.map((a) => (3 * EI * L) / (a * a * (L - a) ** 2));
      const wD = 1 / Math.sqrt(1 / w11 ** 2 + xs.reduce((s, _, i) => s + M / Ks[i], 0));
      const C = (1 / 398 ** 2 - 1 / 435 ** 2) / 4.52;
      const fb = 1 / Math.sqrt(1 / 435 ** 2 - C * 5.44);
      return [
        near('EI = 1.409×10⁸ N m²', EI, 1.409e8, 1e-3),
        near('Σ Mφ² = 2536 kg', KE, 2536, 1e-3),
        near('Rayleigh: 265.3 rad/s', wR, 265.33, 1e-3),
        near('Rayleigh: 2534 rpm', (wR * 60) / (2 * Math.PI), 2534, 1e-3),
        near('ω₁₁ = 486.4 rad/s', w11, 486.4, 1e-3),
        near('K at the outer rotors 6.117×10⁸ N/m', Ks[0], 6.117e8, 1e-3),
        near('K at the middle rotor 2.505×10⁸ N/m', Ks[1], 2.505e8, 1e-3),
        near('Dunkerley: 257.2 rad/s = 2456 rpm', (wD * 60) / (2 * Math.PI), 2456, 1e-3),
        near('W7.3: bare beam 497 Hz from two shaker measurements', fb, 497.1, 1e-3),
      ];
    },
  },
  {
    id: 'b5-content',
    topic: 'B5',
    title: 'B5 content: ids, MCQ keys, links, trap ids and TeX',
    run: () => contentChecks({ cards, flashcards, mcqs, games, shortAnswers, solve: generators, explore, traps }, 'B5'),
  },
  {
    id: 'b5-generators',
    topic: 'B5',
    title: 'Every B5 generator builds valid problems at every tier (50 seeds)',
    run: () => generatorChecks(generators, traps.map((t) => t.id)),
  },
];
