// Self-tests for topic B2: reference values from the reader (SP1, SP2, SP6–7), tutorials W7.1, W7.2, W7.9,
// Week 7 and Week 10 quizzes and the 2021–2025 worked solutions, plus a sanity sweep over every generator.
import type { SelfTest } from '../../selftest/types';
import { ascending, isTrue, near, nearAbs } from '../../selftest/assert';
import { endInertiaRoots, pluckAmplitudes, polarMoment, rodEquivalentSdof, shearModulus, stringWaveSpeed, waveOmegas, waveRoot } from '../../physics/waves';
import { betaL } from '../../physics/beams';
import { makeRng } from '../../engine/rng';
import {
  MATERIALS,
  halfAxleIeffRatio,
  lowestAlive,
  pendulumPeriod,
  pluckSpectrum,
  rotatingCableW79,
  solidRodBendingOmega1,
  steppedShaftF1Ratio,
  swingCycle,
  swingTensionRatios,
  torsionAxialRatio,
  whirlingCableExact,
  wireMassPerLength,
} from './physics';
import { generators } from './solve';
import { mcqs, games } from './quiz';
import { cards, flashcards } from './learn';

const PI = Math.PI;
const TAU = 2 * PI;
const steel = MATERIALS[0];
const al = MATERIALS[1];
const ti = MATERIALS[2];

export const tests: SelfTest[] = [
  {
    id: 'b2-roots',
    topic: 'B2',
    title: 'End conditions: fixed–fixed nπ, fixed–free (2n−1)π/2, free–free nπ',
    source: 'LB2 Eq 2.5; LB3 Eq 3.9; summary notes B2 table',
    run: () => [
      near('fixed–fixed z₃ = 3π', waveRoot('fixed-fixed', 3), 3 * PI, 1e-12),
      near('fixed–free z₂ = 3π/2', waveRoot('fixed-free', 2), 1.5 * PI, 1e-12),
      near('free–free z₁ = π', waveRoot('free-free', 1), PI, 1e-12),
      near('fixed–free f₃/f₁ = 5', waveRoot('fixed-free', 3) / waveRoot('fixed-free', 1), 5, 1e-12),
    ],
  },
  {
    id: 'b2-strings',
    topic: 'B2',
    title: 'Strings: powerline 0.2887 Hz; piano wire 1291 N; Week 7 Q1 153.6 N',
    source: 'Reader SP1(a); tutorial W7.1; Week 7 Q1 worked solution',
    run: () => {
      const c = stringWaveSpeed(20000, 1.5);
      const rl = wireMassPerLength(0.0013, 7850);
      const T = 4 * rl * 0.8 ** 2 * 220 ** 2;
      return [
        near('powerline c = 115.47 m/s', c, 115.47, 1e-4),
        near('powerline f₁ = 0.2887 Hz', c / 400, 0.288675, 1e-5),
        near('piano wire ρl = 0.010419 kg/m', rl, 0.0104195, 1e-4),
        near('piano wire T = 1291 N', T, 1291.0, 1e-3),
        near('piano wire axial/transverse = 14.69', Math.sqrt(210e9 / 7850) / 1.6 / 220, 14.694, 1e-3),
        near('Week 7 Q1: 0.75² × 273 = 153.56 N', 0.75 ** 2 * 273, 153.5625, 1e-9),
        near('Week 7 Q1 trap: 0.75 × 273 lowers f by only 13.4 %', (1 - Math.sqrt(0.75)) * 100, 13.4, 2e-3),
      ];
    },
  },
  {
    id: 'b2-pluck-touch',
    topic: 'B2',
    title: 'Pluck, touch and press: the octave recipe, silence, 330 Hz',
    source: '2022 B1.2 worked solution; 2024 B1.4 worked solution',
    run: () => {
      const q = pluckAmplitudes(0.25, 4);
      const oct = lowestAlive(pluckSpectrum(0.25, 'touch', 0.5, 40));
      const silent = lowestAlive(pluckSpectrum(0.5, 'touch', 0.25, 40));
      const press = pluckSpectrum(2 / 3, 'press', 1 / 3, 40);
      const pressAlive = press.partials.filter((p) => p.alive).map((p) => p.ratio);
      const touch13 = lowestAlive(pluckSpectrum(2 / 3, 'touch', 1 / 3, 40));
      const forced = [1, 2, 3, 4].map((n) => Math.sin((n * PI) / 4) / (n * n - 0.25));
      return [
        near('pluck at L/4: D₂/D₁ = 0.3536', q[1] / q[0], 0.353553, 1e-5),
        near('pluck at L/4: D₃/D₁ = 1/9', q[2] / q[0], 1 / 9, 1e-9),
        nearAbs('pluck at L/4: D₄ = 0', q[3], 0, 1e-12),
        isTrue('pluck L/4 + touch L/2 → lowest is 2 f₁ (octave)', !!oct && Math.abs(oct.ratio - 2) < 1e-9),
        isTrue('pluck L/2 + touch L/4 → silence', !silent),
        near('press at L/3, pluck the long part at its middle → 1.5 f₁ (330 Hz from 220 Hz)', pressAlive[0], 1.5, 1e-12),
        near('… next partial 4.5 f₁ (its 3rd mode)', pressAlive[1], 4.5, 1e-12),
        isTrue('touch at L/3 with the pluck at 2L/3 → silence', !touch13),
        near('2024 B1.4: point load at L/4, Ω = 0.5ω₁: q₁ = 0.9428', forced[0], 0.942809, 1e-5),
        near('… q₂ = 0.2667', forced[1], 0.266667, 1e-5),
        near('… q₃ = 0.0808', forced[2], 0.080812, 1e-4),
        nearAbs('… q₄ = 0', forced[3], 0, 1e-12),
      ];
    },
  },
  {
    id: 'b2-rods',
    topic: 'B2',
    title: 'Rods and shafts: rocket tube, drill rod, torsion/axial ratio, rod SDOF mass',
    source: 'Tutorial W7.2; Reader SP2; 2022 WS B1.3; Week 7 Q2',
    run: () => {
      const cA = Math.sqrt(al.E / al.rho);
      const fA = waveOmegas('free-free', cA, 50, 2).map((w) => w / TAU);
      const fT = waveOmegas('free-free', cA * torsionAxialRatio(al.nu), 50, 2).map((w) => w / TAU);
      const cTi = Math.sqrt(ti.E / ti.rho);
      const sd = rodEquivalentSdof(1, 1, 1, 1);
      return [
        near('rocket axial f₁ = 50.71 Hz', fA[0], 50.709, 1e-4),
        near('rocket axial f₂ = 101.42 Hz', fA[1], 101.42, 1e-4),
        near('rocket torsion f₁ = 31.21 Hz', fT[0], 31.209, 1e-4),
        near('torsion vs axial = −38.45 %', (fT[0] / fA[0] - 1) * 100, -38.454, 1e-4),
        near('titanium axial +0.378 %', (cTi / cA - 1) * 100, 0.378, 2e-3),
        nearAbs('titanium torsion +0.000 % (same G/ρ)', (cTi * torsionAxialRatio(ti.nu)) / (cA * torsionAxialRatio(al.nu)) - 1, 0, 1e-12),
        near('Al G/ρ = 9.740 × 10⁶ m²/s²', shearModulus(al.E, al.nu) / al.rho, 9.74026e6, 1e-5),
        near('ν = 0.3: f_T/f_A = 0.6202', torsionAxialRatio(0.3), 0.620174, 1e-5),
        near('drill rod: axial fixed–fixed = n × 32.25 Hz (reader prints 32.3)', 2 * 10 * Math.sqrt(2.6), 32.249, 1e-4),
        near('rod SDOF mass ratio 4/π²', sd.meq, 0.405285, 1e-5),
      ];
    },
  },
  {
    id: 'b2-critical-speeds',
    topic: 'B2',
    title: 'Torsional critical speeds: 2023 blade, 2024 hydropower shaft, 2025 tidal blade',
    source: '2023 WS B2.3; 2024 WS B2.1–2.2; 2025 WS B2.2',
    run: () => {
      const c23 = Math.sqrt(4.79e9 / 1820);
      const f23 = waveOmegas('fixed-free', c23, 86.4, 3).map((w) => w / TAU);
      const G24 = shearModulus(210e9, 0.3);
      const c24 = Math.sqrt(G24 / 7850);
      const c25 = Math.sqrt(shearModulus(40e9, 0.3) / 1900);
      const f25 = waveOmegas('fixed-free', c25, 7.7789, 3).map((w) => w / TAU);
      return [
        near('2023: c = 1622.3 m/s', c23, 1622.3, 1e-5),
        near('2023: f₁ = 4.694 Hz', f23[0], 4.69416, 1e-5),
        near('2023: f₂ = 14.08 Hz', f23[1], 14.0825, 1e-5),
        near('2023: f₃ = 23.47 Hz', f23[2], 23.4708, 1e-5),
        near('2023 trap: G from E/2.6 gives 4.84 Hz', Math.sqrt(13.23e9 / 2.6 / 1820) / (4 * 86.4), 4.838, 1e-3),
        near('2024: G = 80.77 GPa', G24 / 1e9, 80.7692, 1e-5),
        near('2024: c = 3207.7 m/s', c24, 3207.66, 1e-5),
        near('2024: L = c/2f₁ = 13.365 m (7200 rpm)', c24 / 240, 13.3652, 1e-5),
        near('2024 trap: fixed–free L = 6.68 m', c24 / 480, 6.6826, 1e-4),
        near('2025: torsion f₁ = 91.45 Hz', f25[0], 91.451, 1e-4),
        near('2025: 5487 rpm', 60 * f25[0], 5487, 2e-4),
        near('2025: 16 461 rpm', 60 * f25[1], 16461, 2e-4),
        near('2025: 27 435 rpm', 60 * f25[2], 27435, 2e-4),
        near('2025 trap: fixed–fixed 182.9 Hz', c25 / (2 * 7.7789), 182.9, 1e-3),
      ];
    },
  },
  {
    id: 'b2-end-inertia',
    topic: 'B2',
    title: 'z tan z = Iₐ/Iₑ: root table, SP6(b) 141.9 Hz, Week 10 Q3, 2021 B2.4–2.5',
    source: 'Research notes B2 §E1; Reader SP6–7; Week 10 Q3; 2021 WS B2.4–2.5',
    run: () => {
      const tab: [number, number][] = [
        [0.001, 0.0316175],
        [0.01, 0.099834],
        [0.1, 0.311053],
        [1, 0.860334],
        [10, 1.42887],
        [100, 1.555245],
      ];
      const r1 = endInertiaRoots(1, 3);
      const Ia = 7700 * 1e-4 * 0.5;
      const c = Math.sqrt(80e9 / 7700);
      const z6 = endInertiaRoots(Ia / 20, 1)[0];
      const I21 = halfAxleIeffRatio(2.6, 3.1, 0.3, 4, 6);
      const z21 = endInertiaRoots(2 / I21, 3);
      const dunk = 1 / Math.sqrt(4 / (PI * PI) + 1 / 4.9);
      return [
        ...tab.map(([mu, z]) => near(`μ = ${mu}: z₁ = ${z}`, endInertiaRoots(mu, 1)[0], z, 1e-5)),
        near('μ = 1: z₂ = 3.4256', r1[1], 3.425618, 1e-6),
        near('μ = 1: z₃ = 6.4373', r1[2], 6.437298, 1e-6),
        near('SP6(b): Iₐ = 0.385 kg m²', Ia, 0.385, 1e-9),
        near('SP6(b): z₁ = 0.1383', z6, 0.138301, 1e-5),
        near('SP6(b): f₁ = 141.9 Hz', (z6 * c) / (TAU * 0.5), 141.897, 1e-4),
        near('SP7: massless fixed estimate 142.35 Hz', Math.sqrt(1.6e7 / 20) / TAU, 142.353, 1e-5),
        near('Week 10 Q3: exact α₁ = 1.30963', endInertiaRoots(4.9, 1)[0], 1.30963, 1e-5),
        near('Week 10 Q3: Dunkerley α₁ = 1.28103', dunk, 1.281034, 1e-5),
        near('2021 B2.4: Iₑff/Iₐ = 941.1 (SN = 0)', I21, 941.111, 1e-5),
        near('2021 B2.4: Iₑff/Iₐ = 556.9 (SN = 9)', halfAxleIeffRatio(2.6, 3.1, 0.39, 4, 6), 556.87, 1e-4),
        near('2021 B2.5: z₁ = 0.04608', z21[0], 0.046083, 1e-4),
        near('2021 B2.5: ω₁/ω_A1 = 0.02934 (−97.07 %)', z21[0] / (PI / 2), 0.029337, 1e-4),
        near('2021 B2.5: mode 2 → 2.0004 ω_A1', z21[1] / (PI / 2), 2.00043, 1e-5),
        near('challenge: z₁ = π/4 needs μ = π/4', endInertiaRoots(PI / 4, 1)[0], PI / 4, 1e-9),
        ...[0.05, 0.5, 4.9].map((mu) => {
          const zz = endInertiaRoots(mu, 1)[0];
          return ascending(`μ = ${mu}: exact ≤ Rayleigh ≤ massless SDOF`, [zz, Math.sqrt(mu / (1 + mu / 3)), Math.sqrt(mu)]);
        }),
      ];
    },
  },
  {
    id: 'b2-variable-tension',
    topic: 'B2',
    title: 'Swinging weight (30°: f ratio 1.21) and rotating cable (W7.9, μ = 1: 3.276Ω)',
    source: '2021 WS B1.2; tutorial W7.9; research notes B2 §E4',
    run: () => {
      const s = swingTensionRatios(PI / 6);
      const w1 = rotatingCableW79(1);
      const w4 = rotatingCableW79(4);
      return [
        near('θ₀ = 30°: T_max = 1.2679 mg', s.max, 1.26795, 1e-5),
        near('θ₀ = 30°: T_min = 0.8660 mg', s.min, 0.86603, 1e-5),
        near('θ₀ = 30°: f_max/f_min = 1.21', Math.sqrt(s.max / s.min), 1.21, 1e-4),
        near('θ₀ = 60°: f_max/f_min = 2', Math.sqrt(swingTensionRatios(PI / 3).max / swingTensionRatios(PI / 3).min), 2, 1e-9),
        near('W7.9 μ = 1: β = 3.4256', w1.beta, 3.425618, 1e-6),
        near('W7.9 μ = 1: ω₁ = 3.2764 Ω', w1.wOverOmega, 3.27641, 1e-5),
        near('fixed–fixed estimate πΩ is 4.1 % below the W7.9(c) model', (PI / w1.wOverOmega - 1) * 100, -4.11, 2e-3),
        near('fixed–free estimate is 52 % below it', ((PI / 2) / w1.wOverOmega - 1) * 100, -52.06, 1e-3),
        near('μ = 4: fixed–fixed only 1.2 % low', ((2 * PI) / w4.wOverOmega - 1) * 100, -1.21, 1e-2),
      ];
    },
  },
  {
    id: 'b2-swing-whirl',
    topic: 'B2',
    title: 'Swinging-weight cycle (exact period, tension extremes) and the whirling cable with variable tension',
    source: 'Exact pendulum period by the AGM; 2021 WS B1.2; 2023 WS B1.2 “going further” (μ = 0.25, 1, 4 table); research notes B2 §E4',
    run: () => {
      const th0 = PI / 6;
      const cyc = swingCycle(1, th0, 400);
      let tmax = -Infinity;
      let tmin = Infinity;
      for (const th of cyc.theta) {
        const tr = 3 * Math.cos(th) - 2 * Math.cos(th0);
        tmax = Math.max(tmax, tr);
        tmin = Math.min(tmin, tr);
      }
      const p0 = pendulumPeriod(1, 1e-9);
      const e1 = whirlingCableExact(1);
      const e025 = whirlingCableExact(0.25);
      const e4 = whirlingCableExact(4);
      const e10 = whirlingCableExact(10);
      return [
        near('small swing: period 2π√(L/g) = 2.0061 s (L = 1 m)', p0, 2 * PI * Math.sqrt(1 / 9.81), 1e-9),
        near('60° swing: period ×1.07318', pendulumPeriod(1, PI / 3) / p0, 1.073182, 1e-5),
        near('90° swing: period ×1.18034', pendulumPeriod(1, PI / 2) / p0, 1.180341, 1e-5),
        nearAbs('RK4 cycle returns to θ₀ after one exact period', cyc.theta[400] - th0, 0, 1e-7),
        nearAbs('… and passes the bottom at a quarter period', cyc.theta[100], 0, 1e-7),
        near('30°: largest tension over the cycle 3 − 2cos 30° = 1.2679 mg (at the bottom)', tmax, 1.267949, 1e-5),
        near('30°: smallest tension cos 30° = 0.8660 mg (at the extremes)', tmin, 0.866025, 1e-6),
        near('μ = 1: in-plane ω₁ = √14 Ω = 3.7417 Ω (exact polynomial mode)', e1.wIn, Math.sqrt(14), 1e-6),
        near('μ = 1: out-of-plane ω₁ = √15 Ω = 3.8730 Ω', e1.wOut, Math.sqrt(15), 1e-6),
        near('μ = 0.25: in-plane 2.6050 Ω', e025.wIn, 2.605, 1e-4),
        near('μ = 0.25: out-of-plane 2.7904 Ω', e025.wOut, 2.7904, 1e-4),
        near('μ = 4: in-plane 6.5987 Ω', e4.wIn, 6.5987, 1e-4),
        near('μ = 4: out-of-plane 6.6740 Ω', e4.wOut, 6.674, 1e-4),
        ascending('μ = 1: fixed-end estimate π < W7.9 3.276 < exact 3.742', [PI, rotatingCableW79(1).wOverOmega, e1.wIn]),
        near('fixed-end estimate −16.0 % at μ = 1', (PI / e1.wIn - 1) * 100, -16.04, 2e-3),
        near('fixed-end estimate −2.0 % at μ = 10', ((PI * Math.sqrt(10)) / e10.wIn - 1) * 100, -1.99, 1e-2),
        nearAbs('in-plane mode shape is zero at the hub', e1.shape[0], 0, 1e-12),
      ];
    },
  },
  {
    id: 'b2-stepped-bending',
    topic: 'B2',
    title: 'Stepped shaft (2024 B2.3: +5.2 %) and the bending/axial comparison',
    source: '2024 WS B2.3; official 2016 B2.1; official 2018 B1.5 (javelin illustration)',
    run: () => {
      const cf = betaL('clamped-free', 3);
      const javelinA = Math.sqrt(al.E / al.rho) / (2 * 2.6);
      const javelinB = solidRodBendingOmega1('free-free', al.E, al.rho, 0.03, 2.6) / TAU;
      return [
        near('α = 0.6, d ×1.2 (n = 1.728): f₁ ×1.0524', steppedShaftF1Ratio(0.6, 1.2 ** 3), 1.0524, 2e-4),
        near('α = 0.6, n → ∞: ×1.25', steppedShaftF1Ratio(0.6, 1e9), 1.25, 1e-4),
        near('step at mid-length: no change', steppedShaftF1Ratio(0.5, 3), 1, 1e-9),
        near('enlarging the longer part (α = 0.4): ×0.952', steppedShaftF1Ratio(0.4, 1.2 ** 3), 0.952, 5e-4),
        near('uniform (n = 1): ratio 1', steppedShaftF1Ratio(0.6, 1), 1, 1e-9),
        ...[0.646, 4.049, 11.338].map((v, i) => near(`h/L = 1/100 cantilever: bending mode ${i + 1} = ${v} % of axial f₁`, cf[i] ** 2 * (2 / PI) * 0.01 / Math.sqrt(12) * 100, v, 1e-3)),
        near('javelin (Al, 2.6 m, 30 mm): axial 975 Hz', javelinA, 975.18, 1e-4),
        near('javelin: torsion 600 Hz', javelinA * torsionAxialRatio(al.nu), 600.18, 1e-4),
        near('javelin: bending 20.0 Hz', javelinB, 20.033, 1e-3),
        near('polar moment J = πd⁴/32 (d = 0.17865 m → 1e-4 m⁴)', polarMoment((32e-4 / PI) ** 0.25), 1e-4, 1e-9),
        near('steel E/2.6 = 80.77 GPa', shearModulus(steel.E, steel.nu) / 1e9, 80.769, 1e-4),
      ];
    },
  },
  {
    id: 'b2-generators',
    topic: 'B2',
    title: 'Every B2 generator builds valid problems at every tier (60 seeds)',
    run: () =>
      generators.map((g) => {
        let bad = '';
        for (let s = 1; s <= 60 && !bad; s++)
          for (const t of g.tiers) {
            const inst = g.generate(makeRng(s * 7919), t);
            const text = [inst.prompt, ...inst.hints, ...inst.parts.map((p) => p.label), ...(inst.givens ?? []).map((v) => v.value)].join(' ');
            if (/NaN|undefined|Infinity/.test(text)) bad = `bad text (seed ${s}, tier ${t})`;
            if (inst.hints.length !== 4) bad = 'needs 4 hints';
            for (const p of inst.parts) {
              if (p.kind === 'numeric') {
                if (!Number.isFinite(p.answer)) bad = `${p.id} not finite (seed ${s}, tier ${t})`;
                for (const tr of p.traps ?? []) if (Math.abs(tr.value - p.answer) <= 0.02 * Math.abs(p.answer)) bad = `${p.id}: trap within 2 % (seed ${s}, tier ${t})`;
              }
              if (p.kind === 'choice') {
                const n = p.options.filter((o) => o.correct).length;
                if (n === 0 || (!p.multi && n !== 1)) bad = `${p.id}: ${n} correct options (seed ${s}, tier ${t})`;
                if (p.options.some((o) => /NaN|undefined/.test(o.text))) bad = `${p.id}: bad option text`;
              }
            }
          }
        return isTrue(`${g.id}`, !bad, bad);
      }),
  },
  {
    id: 'b2-content',
    topic: 'B2',
    title: 'B2 content: one correct option per MCQ, a reason for every option, unique ids',
    run: () => {
      const ids = new Set<string>();
      let dup = '';
      for (const q of [...mcqs.map((m) => m.id), ...flashcards.map((f) => f.id), ...cards.map((c) => c.id), ...games.map((g) => g.id), ...generators.map((g) => g.id)]) {
        if (ids.has(q)) dup = q;
        ids.add(q);
      }
      return [
        ...mcqs.map((q) => isTrue(`${q.id}: one correct option, every option explained, a source`, q.options.filter((o) => o.correct).length === 1 && q.options.every((o) => o.why.trim().length > 0) && !!q.source)),
        isTrue('unique ids', !dup, dup),
        isTrue('10–14 MCQs', mcqs.length >= 10 && mcqs.length <= 14, String(mcqs.length)),
        isTrue('15–30 flashcards', flashcards.length >= 15 && flashcards.length <= 30, String(flashcards.length)),
        isTrue('5–7 generators', generators.length >= 5 && generators.length <= 7, String(generators.length)),
      ];
    },
  },
];
