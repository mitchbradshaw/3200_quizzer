// Self-tests for topic B4: forced beam response by modal analysis. Reference values from the reader (LB6
// Example 9.3, sample problem 4, Exam 2000 Q4, W7.4, W7.6, W7.7), the official 2016/2018/2019 B2.3 solutions,
// the 2022–2025 worked solutions and the Week 9 quiz (research notes B4.5–B4.6). Exact βL roots throughout.
import type { CheckResult, SelfTest } from '../../selftest/types';
import { near, nearAbs, isTrue } from '../../selftest/assert';
import { type BeamBC, betaL, modeShape, thinTube } from '../../physics/beams';
import { beamResponse } from '../../physics/forcedBeam';
import { generatorSanity } from '../B3/selftests';
import { makeRng } from '../../engine/rng';
import { generators } from './solve';
import { WING, dominant, maxAlongBeam, modalTable, responseFactor, unbalanceRatioMode1, wingFreqs, wingTip } from './physics';

const TAU = 2 * Math.PI;
const CF: BeamBC = 'clamped-free';
const PP: BeamBC = 'pinned-pinned';
const CC: BeamBC = 'clamped-clamped';
const FF: BeamBC = 'free-free';
const sum = (xs: number[]) => xs.reduce((s, v) => s + v, 0);

export const tests: SelfTest[] = [
  {
    id: 'b4-static',
    topic: 'B4',
    title: 'Static limit (Ω → 0): the modal sums reproduce the beam-table deflections',
    source: 'Research notes B4.6 (static checks used in the 2022–2024 worked solutions); beam tables',
    run: () => [
      near('cantilever, tip load, tip: Σ 4/(βᵢL)⁴ = 1/3 (40 modes)', responseFactor(CF, [{ xi: 1 }], 0, 1, 40), 1 / 3, 1e-4),
      near('cantilever, tip load, mode 1 alone = 0.3236 (97 % of 1/3)', responseFactor(CF, [{ xi: 1 }], 0, 1, 1), 0.32356, 1e-4),
      near('pinned–pinned, mid-span load and deflection: 1/48', responseFactor(PP, [{ xi: 0.5 }], 0, 0.5, 40), 1 / 48, 1e-5),
      near('clamped–clamped, mid-span: 1/192', responseFactor(CC, [{ xi: 0.5 }], 0, 0.5, 40), 1 / 192, 1e-5),
      near('cantilever, load at 0.5L, tip: 5/48', responseFactor(CF, [{ xi: 0.5 }], 0, 1, 40), 5 / 48, 1e-5),
      near('pinned–pinned, load at 0.6L, at 0.6L: a²b²/3L³ = 0.0192', responseFactor(PP, [{ xi: 0.6 }], 0, 0.6, 40), 0.0192, 1e-5),
      near('cantilever, loads at 0.5L + 0.9L, tip: 0.387667 (2022 WS)', responseFactor(CF, [{ xi: 0.5 }, { xi: 0.9 }], 0, 1, 40), 0.387667, 1e-5),
    ],
  },
  {
    id: 'b4-reader',
    topic: 'B4',
    title: 'Reader examples: LB6 Ex 9.3, sample problem 4, Exam 2000 Q4(c), W7.4(b), W7.6(b), W7.7(b)',
    source: 'Reader pp. 106–108, 130–134; research notes B4-N1, N2, N8, N13–N15 (exact constants)',
    run: () => {
      const ex93 = modalTable(CF, [{ xi: 0.6 }], 4, 1, 4).map((m) => m.a);
      const sp4 = modalTable(CF, [{ xi: 0.7 }], 10, 1, 4);
      const q4c = responseFactor(PP, [{ xi: 0.5 }], 5, 0.5, 5);
      // W7.4(b): E = 210 GPa, I = 1.58e-5 m⁴, A = 2.32e-3 m², ρ = 7850, L = 10 m, 2 sin 80t kN at 7 m, mode 1 at B (7 m).
      const w74 = beamResponse({ bc: PP, x: 0.7, xe: 0.7, Omega: 80, P: 2000, L: 10, EI: 210e9 * 1.58e-5, rhoA: 7850 * 2.32e-3, nModes: 1 });
      // W7.7(b): clamped–clamped, machine at mid-span, mr = 1 kg m at 1800 rpm, Ω = ω₁/3, |y| ≤ 1 mm, I/A = 0.002 m².
      const f77 = responseFactor(CC, [{ xi: 0.5 }], 1 / 3, 0.5, 1);
      const P77 = 1 * ((TAU * 1800) / 60) ** 2;
      const I77 = (f77 * P77 * 3 ** 3) / 1e-3 / 200e9;
      return [
        near('Ex 9.3: a₁ = −4.974e-3 PL³/EI', ex93[0], -4.974e-3, 2e-3),
        near('Ex 9.3: a₂ = +4.098e-3 (reader 4.083e-3 with handout constants)', ex93[1], 4.098e-3, 2e-3),
        near('Ex 9.3: a₃ = −2.626e-4', ex93[2], -2.626e-4, 2e-3),
        near('Ex 9.3: a₄ = −4.528e-5', ex93[3], -4.528e-5, 2e-3),
        isTrue('Ex 9.3: |a₁| > |a₂| although Ω = 4ω₁ is closest to ω₂', Math.abs(ex93[0]) > Math.abs(ex93[1])),
        near('sample problem 4: a₁ = −9.656e-4', sp4[0].a, -9.656e-4, 2e-3),
        near('sample problem 4: a₂ = −8.447e-4', sp4[1].a, -8.447e-4, 2e-3),
        near('sample problem 4: a₃ = −5.116e-4', sp4[2].a, -5.116e-4, 2e-3),
        near('sample problem 4: a₄ = +5.940e-5', sp4[3].a, 5.94e-5, 3e-3),
        near('sample problem 4: tip deflection (4 modes) −1.384e-3 FL³/EI', sum(sp4.map((m) => m.y)), -1.384e-3, 2e-3),
        near('Exam 2000 Q4(c): central load at 5ω₁, modes 1, 3, 5: −4.546e-4', q4c, -4.546e-4, 2e-3),
        nearAbs('Exam 2000 Q4(c): even modes vanish (a₂ = a₄ = 0)', Math.abs(modalTable(PP, [{ xi: 0.5 }], 5, 0.5, 4)[1].a) + Math.abs(modalTable(PP, [{ xi: 0.5 }], 5, 0.5, 4)[3].a), 0, 1e-15),
        near('W7.4(b): ω₁ = 42.13 rad/s', w74.omegas[0], 42.13, 1e-3),
        near('W7.4(b): mode-1 contribution at B = −3.11 mm', w74.y * 1000, -3.11, 5e-3),
        near('W7.6(b): tip load at ω₁/10, tip, all modes: 0.3366 PL³/EI', responseFactor(CF, [{ xi: 1 }], 0.1, 1, 40), 0.3366, 1e-3),
        near('W7.6(b): mode 1 alone 0.3268', responseFactor(CF, [{ xi: 1 }], 0.1, 1, 1), 0.3268, 1e-3),
        near('W7.7(b): mode-1 factor 0.005669 PL³/EI', f77, 0.005669, 1e-3),
        near('W7.7(b): I = 2.72e-5 m⁴', I77, 2.72e-5, 3e-3),
        near('W7.7(b): A = I/(I/A) = 1.36e-2 m²', I77 / 0.002, 1.36e-2, 3e-3),
        near('W7.7(b): three modes need 0.005805 (+2.4 %)', responseFactor(CC, [{ xi: 0.5 }], 1 / 3, 0.5, 3), 0.005805, 1e-3),
      ];
    },
  },
  {
    id: 'b4-unbalance',
    topic: 'B4',
    title: 'Unbalance ratios: official 2018 and 2019 B2.3, 2016 B2.3',
    source: 'Exam pack Part B official solutions; research notes B4-N4–N6 and B4.9 #1–2',
    run: () => {
      const tipA = (r: number, n: number) => responseFactor(CF, [{ xi: 0.35 }], r, 1, n);
      const tipB = (r: number, n: number) => responseFactor(CF, [{ xi: 0.65 }], r, 1, n);
      const S3 = (r: number) => responseFactor(FF, [{ xi: 0.6 }], r, 0.6, 3);
      const rt = 50 / 30;
      const rc = 40 / 30;
      const power = (ra: number, rb: number) => unbalanceRatioMode1(ra, rb) * (rb / ra) ** 3;
      // Rigid-body part for a truly free fuselage (B4.9 #7): −Σ Y_r(0.6)²/(β₁L)⁴ in units of meω₁²L³/EI.
      // With EI = ρA = L = 1, ω₁² = (β₁L)⁴; P = 4 N at Ω = 2 rad/s is an unbalance me = P/Ω² = 1 kg m.
      const rig = beamResponse({ bc: FF, x: 0.6, xe: 0.6, Omega: 2, P: 4, L: 1, EI: 1, rhoA: 1, nModes: 1 }).yRigid;
      const meUnit = betaL(FF, 1)[0] ** 4; // meω₁²L³/EI with me = 1
      return [
        near('2018: engine A tip contribution, 3 modes = 35.2 % of B', (tipA(1.2, 3) / tipB(1.2, 3)) * 100, 35.2, 2e-3),
        near('2018: mode 1 only = Y₁(0.35L)/Y₁(0.65L) = 34.4 %', (modeShape(CF, 1, 0.35) / modeShape(CF, 1, 0.65)) * 100, 34.4, 2e-3),
        near('2018 note: halving Ω from 1.2ω₁ gives −0.172 (in phase again)', unbalanceRatioMode1(1.2, 0.6), -0.1719, 1e-3),
        near('2019: cruise/take-off, mode 1 only = 146.3 % (official estimate)', unbalanceRatioMode1(rt, rc) * 100, 146.29, 1e-3),
        near('2019: three modes in consistent units = 195.0 % (not the official 159 %)', ((rc * rc * S3(rc)) / (rt * rt * S3(rt))) * 100, 194.98, 2e-3),
        near('2019 caveat: rigid-body part at 0.6L = −2.24e-3 meω₁²L³/EI, any speed', rig / meUnit, -2.2375e-3, 2e-3),
        near('2016: harvester power 0.5 → 0.25 ω₁ = 2.5 % (official arithmetic)', power(0.5, 0.25) * 100, 2.5, 1e-4),
        near('2016: with the printed 0.30 → 0.15 ω₁ = 2.91 %', power(0.3, 0.15) * 100, 2.909, 1e-3),
        near('doubling speed 0.3 → 0.6ω₁ multiplies the response by 5.69', unbalanceRatioMode1(0.3, 0.6), 5.6875, 1e-4),
      ];
    },
  },
  {
    id: 'b4-design',
    topic: 'B4',
    title: 'Design numbers: 2022 B2.3–B2.4 wing, 2023 B2.4 blade force, 2024 B2.5 shaft',
    source: '2022–2024 B2 worked solutions; research notes B4-N7, N9, N10, N16',
    run: () => {
      const S22 = responseFactor(CF, [{ xi: WING.xA }, { xi: WING.xB }], 0.4, 1, 3);
      const P22 = 1e-3 * ((TAU * 2400) / 60) ** 2;
      const t22 = ((S22 * P22 * WING.L ** 3) / 1e-4) * (12 / (WING.E * WING.w ** 3));
      const yTip = wingTip({ t: 0.00452, plane: 'in', rpm: 2400, me: 1e-3, n: 3 });
      const fOut = wingFreqs(0.00452, 'out', 4);
      const yCruise = wingTip({ t: 0.00452, plane: 'out', rpm: 480, me: 1e-3, n: 8 });
      // Cruise maximum along the wing: same modal sum, physical scale P L³/EI with out-of-plane I.
      const w1out = fOut[0] * TAU;
      const Pc = 1e-3 * ((TAU * 480) / 60) ** 2;
      const EIout = (WING.E * WING.w * 0.00452 ** 3) / 12;
      const mx = maxAlongBeam(CF, [{ xi: WING.xA }, { xi: WING.xB }], ((TAU * 480) / 60) / w1out, 8, 800);
      // 2023 B2.4: d = 13.922 m, t = 0.005d, E = 13.23 GPa, L = 86.4 m, force at 0.5L, Ω = 0.5ω₁, tip ≤ 0.5 % of L.
      const sec = thinTube(13.922, 0.005 * 13.922);
      const S23 = responseFactor(CF, [{ xi: 0.5 }], 0.5, 1, 3);
      const P23 = (0.005 * 86.4 * 13.23e9 * sec.I) / (S23 * 86.4 ** 3);
      // 2024 B2.5: pinned–pinned shaft, force at 0.6L, Ω = 0.239ω₁.
      const rows24 = modalTable(PP, [{ xi: 0.6 }], 0.239, 0.6, 3);
      const mx24 = maxAlongBeam(PP, [{ xi: 0.6 }], 0.239, 3, 1000);
      return [
        near('2022: tip sum S = 0.4617 (3 modes, exact constants)', S22, 0.46166, 5e-4),
        near('2022: P = meΩ² = 63.17 N at 2400 rpm (me = 1 kg mm)', P22, 63.165, 1e-3),
        near('2022: minimum thickness t = 4.52 mm', t22 * 1000, 4.516, 2e-3),
        near('2022: with t = 4.52 mm the take-off tip amplitude is 0.1 mm', yTip * 1000, 0.0999, 3e-3),
        near('2022 B2.4: out-of-plane f₁ = 1.07 Hz', fOut[0], 1.0731, 2e-3),
        near('2022 B2.4: out-of-plane f₂ = 6.73 Hz', fOut[1], 6.725, 2e-3),
        near('2022 B2.4: out-of-plane f₄ = 36.9 Hz', fOut[3], 36.9, 3e-3),
        near('2022 B2.4: cruise (480 rpm) tip amplitude 0.222 mm', Math.abs(yCruise) * 1000, 0.222, 2e-2),
        near('2022 B2.4: cruise maximum 0.435 mm', ((Math.abs(mx.y) * Pc * WING.L ** 3) / EIout) * 1000, 0.435, 2e-2),
        nearAbs('2022 B2.4: … at about 0.665L', mx.x, 0.665, 0.01),
        near('2023: I = πr³t = 73.77 m⁴', sec.I, 73.77, 1e-3),
        near('2023: tip sum S = 0.14058 (exact; handout 0.14053)', S23, 0.14058, 5e-4),
        near('2023: P_max = 4.65 MN', P23 / 1e6, 4.65, 2e-3),
        near('2023: mode 1 alone overestimates S by 4.3 %', responseFactor(CF, [{ xi: 0.5 }], 0.5, 1, 1) / S23, 1.0426, 2e-3),
        near('2024: a₁ = +1.465e-2 PL³/EI', rows24[0].a, 1.4645e-2, 2e-3),
        near('2024: maximum |y| along the shaft = 0.0209 PL³/EI', Math.abs(mx24.y), 0.0209, 5e-3),
        nearAbs('2024: … at about 0.53L', mx24.x, 0.53, 0.015),
        near('2024: −30 % response needs +42.86 % wall thickness', (1 / 0.7 - 1) * 100, 42.857, 1e-4),
      ];
    },
  },
  {
    id: 'b4-dominant',
    topic: 'B4',
    title: 'Which mode dominates: 2025 B2.3 (tidal blade), 2025 B1.3 (helicopter), 2023 B1.4, Week 9 Q1–Q3',
    source: '2023 and 2025 worked solutions; Week 9 quiz worked solutions; research notes B4-N3, N11, N12, N17, N18',
    run: () => {
      const tidal = modalTable(CF, [{ xi: 2 / 3 }], 3.4, 1, 5);
      const totT = sum(tidal.map((m) => Math.abs(m.y)));
      const heli = modalTable(CF, [{ xi: 0.8 }], 32, 1, 5);
      const dH = dominant(heli);
      const cc5 = betaL(CC, 5);
      const r5 = 0.95 * (cc5[4] / cc5[0]) ** 2;
      const cc = modalTable(CC, [{ xi: 0.5 }], r5, 0.5, 5);
      const wk1 = modalTable(CF, [{ xi: 1 }], 0.8, 1, 2);
      const wk3 = modalTable(PP, [{ xi: 0.5 }], 0.2, 0.5, 3);
      return [
        near('2025 B2.3: mode 1 = 74.8 % of Σ|aᵢYᵢ(L)| (5 modes)', (Math.abs(tidal[0].y) / totT) * 100, 74.8, 5e-3),
        near('2025 B2.3: mode 2 = 22.0 %', (Math.abs(tidal[1].y) / totT) * 100, 22.0, 1e-2),
        near('2025 B2.3: |a₁/a₂| = 3.40', Math.abs(tidal[0].a / tidal[1].a), 3.40, 5e-3),
        near('2025 B2.3: tip total −2.239e-2 PL³/EI', sum(tidal.map((m) => m.y)), -2.239e-2, 3e-3),
        isTrue('2025 B1.3: mode 4 dominates the helicopter tip at Ω = 32ω₁', dH.i === 4, `mode ${dH.i}`),
        near('2025 B1.3: mode-4 share 71.7 % of Σ|.|', dH.share * 100, 71.7, 5e-3),
        near('2025 B1.3: mode-4 dynamic factor 7.45', heli[3].DF, 7.45, 5e-3),
        near('2023 B1.4: |a₅/a₁| = 8.19 at Ω = 0.95ω₅ (clamped–clamped, mid-span)', Math.abs(cc[4].a / cc[0].a), 8.19, 3e-3),
        nearAbs('2023 B1.4: a₂ = a₄ = 0 for a mid-span force', Math.abs(cc[1].a) + Math.abs(cc[3].a), 0, 1e-12),
        near('Week 9 Q1: |a₂/a₁| = 0.009318 (exact; handout 0.0095)', Math.abs(wk1[1].a / wk1[0].a), 0.009318, 2e-3),
        near('Week 9 Q3: a₁ = 0.01512 PL³/EI', wk3[0].a, 0.01512, 1e-3),
        near('Week 9 Q3: a₃ = −1.79e-4', wk3[2].a, -1.79e-4, 5e-3),
        near('Week 9 Q3: mid-span deflection (all modes) 0.02169', responseFactor(PP, [{ xi: 0.5 }], 0.2, 0.5, 41), 0.02169, 1e-3),
        near('Week 9 Q3: mode 1 = 98.6 % of the mid-span deflection', (wk3[0].y / responseFactor(PP, [{ xi: 0.5 }], 0.2, 0.5, 41)) * 100, 98.6, 2e-3),
      ];
    },
  },
  {
    id: 'b4-consistency',
    topic: 'B4',
    title: 'Topic helpers agree with src/physics/forcedBeam in physical units',
    source: 'Internal consistency: aᵢ = PL³Yᵢ(xₑ)/(EI(βᵢL)⁴(1 − Ω²/ωᵢ²)) both ways',
    run: () => {
      const out: CheckResult[] = [];
      const cases: { bc: BeamBC; xe: number; x: number; r: number }[] = [
        { bc: CF, xe: 0.6, x: 1, r: 4 },
        { bc: PP, xe: 0.3, x: 0.55, r: 2.2 },
        { bc: CC, xe: 0.42, x: 0.8, r: 0.7 },
        { bc: 'clamped-pinned', xe: 0.25, x: 0.6, r: 1.6 },
      ];
      for (const c of cases) {
        const EI = 3.2e6;
        const rhoA = 41;
        const L = 4.5;
        const w1 = betaL(c.bc, 1)[0] ** 2 * Math.sqrt(EI / (rhoA * L ** 4));
        const P = 750;
        const phys = beamResponse({ bc: c.bc, x: c.x, xe: c.xe, Omega: c.r * w1, P, L, EI, rhoA, nModes: 4 }).y;
        const unit = responseFactor(c.bc, [{ xi: c.xe }], c.r, c.x, 4) * ((P * L ** 3) / EI);
        out.push(near(`${c.bc}, load ${c.xe}L, output ${c.x}L, Ω = ${c.r}ω₁`, unit, phys, 1e-10));
      }
      out.push(isTrue('reciprocity: y at B from a load at A = y at A from a load at B', Math.abs(responseFactor(CF, [{ xi: 0.3 }], 2.5, 0.9, 6) - responseFactor(CF, [{ xi: 0.9 }], 2.5, 0.3, 6)) < 1e-14));
      return out;
    },
  },
  {
    id: 'b4-machine-generator',
    topic: 'B4',
    title: 'The machine-beam generator reproduces reader W7.7 when it draws the reader’s data',
    source: 'Reader W7.7(a)–(b) printed answers: I/A = 0.002 m², I = 2.72e-5 m⁴, A = 1.36e-2 m² (mode 1 only)',
    run: () => {
      const g = generators.find((x) => x.id === 'b4-machine-beam');
      if (!g) return [isTrue('generator b4-machine-beam exists', false)];
      for (let s = 1; s <= 40000; s++) {
        const inst = g.generate(makeRng(s), 2);
        const gv = Object.fromEntries((inst.givens || []).map((x) => [x.sym, x.value]));
        if (gv.L === '3 m' && gv.N === '1800 rpm' && gv.n === '3' && gv.mr === '1 kg m' && gv['y_{lim}'] === '1 mm') {
          const ans = Object.fromEntries(inst.parts.filter((p) => p.kind === 'numeric').map((p) => [p.id, (p as { answer: number }).answer]));
          return [
            near('I/A = 0.002 m² (printed; exact 2.018e-3)', ans.IA, 2.018e-3, 2e-3),
            near('P = mrΩ² = 35 531 N', ans.P, 35531, 1e-3),
            near('I = 2.72e-5 m⁴', ans.I, 2.72e-5, 3e-3),
            near('A = 1.36e-2 m² (with the exact I/A: 1.348e-2)', ans.A, 1.348e-2, 3e-3),
          ];
        }
      }
      return [isTrue('found a seed with the reader’s data', false)];
    },
  },
  {
    id: 'b4-generators',
    topic: 'B4',
    title: 'Every B4 generator builds valid problems at every tier (50 seeds)',
    run: () => generatorSanity(generators),
  },
];
