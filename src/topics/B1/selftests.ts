// Self-tests for topic B1: every number quoted in the B1 cards, flashcards and MCQ explanations.
import type { SelfTest } from '../../selftest/types';
import { ascending, isTrue, near, nearAbs } from '../../selftest/assert';
import { betaL, frequencyRatios, nodes } from '../../physics/beams';
import { endInertiaRoots, pluckAmplitudes, stringWaveSpeed } from '../../physics/waves';
import { simpson } from '../../physics/integrate';
import { elasticEndStringRoots, fixedFreeRodFEM } from './physics';
import { mcqs, games } from './quiz';
import { cards, flashcards } from './learn';

const PI = Math.PI;

export const tests: SelfTest[] = [
  {
    id: 'b1-fem-convergence',
    topic: 'B1',
    title: 'FEM of a fixed–free rod: +10.3 % / −10.0 % with one element, converging as 1/N²',
    source: 'Research notes B1-N3 (computed); quoted in b1-models, b1-q-fe-*',
    run: () => {
      const exact = PI / 2;
      const c1 = fixedFreeRodFEM(1)[0];
      const l1 = fixedFreeRodFEM(1, true)[0];
      const c2 = fixedFreeRodFEM(2)[0];
      const l2 = fixedFreeRodFEM(2, true)[0];
      const c4 = fixedFreeRodFEM(4);
      const l4 = fixedFreeRodFEM(4, true)[0];
      const c8 = fixedFreeRodFEM(8)[0];
      const l8 = fixedFreeRodFEM(8, true)[0];
      return [
        near('1 element, consistent mass: √3 = 1.7321', c1, Math.sqrt(3), 1e-9),
        near('1 element, lumped mass: √2 = 1.4142', l1, Math.SQRT2, 1e-9),
        near('error +10.27 % (consistent)', (c1 / exact - 1) * 100, 10.27, 1e-3),
        near('error −9.97 % (lumped)', (l1 / exact - 1) * 100, -9.97, 1e-3),
        near('2 elements: 1.6114 (consistent)', c2, 1.6114, 1e-4),
        near('2 elements: 1.5307 (lumped)', l2, 1.5307, 1e-4),
        near('4 elements: 1.5809 (consistent)', c4[0], 1.5809, 1e-4),
        near('4 elements: 1.5607 (lumped)', l4, 1.5607, 1e-4),
        near('4 elements, mode 3 = 9.06 against exact 5π/2 = 7.854', c4[2], 9.0594, 1e-4),
        near('8 elements: 1.5733 (consistent)', c8, 1.5733, 1e-4),
        near('8 elements: 1.5683 (lumped)', l8, 1.5683, 1e-4),
        isTrue('an N-element model returns N frequencies', fixedFreeRodFEM(5).length === 5),
        ascending('consistent mass converges from above', [exact, c8, c4[0], c2, c1]),
        ascending('lumped mass converges from below', [l1, l2, l4, l8, exact]),
        near('error ratio N = 4 to N = 8 ≈ 4 (∝ 1/N²)', (c4[0] - exact) / (c8 - exact), 4, 0.02),
      ];
    },
  },
  {
    id: 'b1-bc-sensitivity',
    topic: 'B1',
    title: 'Boundary-condition sensitivity: ×2.27 clamped vs pinned, ×2.81 pinned vs cantilever',
    source: 'Beam table (reader p. 91); 2021 B1.1(b), 2024 B1.2, 2025 B1.1 worked solutions',
    run: () => {
      const pp = betaL('pinned-pinned', 1)[0];
      const cc = betaL('clamped-clamped', 1)[0];
      const cf = betaL('clamped-free', 1)[0];
      const r = frequencyRatios('clamped-free', 3);
      return [
        near('(β₁L)² pinned–pinned = 9.8696', pp * pp, 9.8696, 1e-4),
        near('(β₁L)² clamped–clamped = 22.373', cc * cc, 22.373, 1e-4),
        near('(β₁L)² clamped–free = 3.5160', cf * cf, 3.516, 2e-4),
        near('clamped–clamped / pinned–pinned = 2.2669', (cc / pp) ** 2, 2.2669, 1e-4),
        near('unsquared trap 4.730/π = 1.5056', cc / pp, 1.5056, 1e-4),
        near('pinned–pinned / clamped–free = 2.807', (pp / cf) ** 2, 2.807, 1e-3),
        near('cantilever ω₂/ω₁ = 6.27', r[1], 6.267, 1e-3),
        near('cantilever ω₃/ω₁ = 17.55', r[2], 17.547, 1e-3),
      ];
    },
  },
  {
    id: 'b1-pluck',
    topic: 'B1',
    title: 'Initial conditions set amplitudes: mid-span pluck 0.811h, 0, −0.090h; quarter period is straight',
    source: 'LB2 Eq 2.11; Week 6 Q5 worked solution; 2022 B1.2 worked solution',
    run: () => {
      const mid = pluckAmplitudes(0.5, 5);
      const end = pluckAmplitudes(0.02, 3);
      // y(x, T1/4) for the mid-span pluck: sum of D_n cos(n pi/2) sin(n pi x).
      const D = pluckAmplitudes(0.5, 400);
      let worst = 0;
      for (let k = 1; k < 20; k++) {
        const x = k / 20;
        let y = 0;
        for (let n = 1; n <= 400; n++) y += D[n - 1] * Math.cos((n * PI) / 2) * Math.sin(n * PI * x);
        worst = Math.max(worst, Math.abs(y));
      }
      return [
        near('D₁/h = 8/π² = 0.8106', mid[0], 0.81057, 1e-4),
        nearAbs('D₂ = 0 (node at mid-span)', mid[1], 0, 1e-12),
        near('D₃/h = −8/(9π²) = −0.0901', mid[2], -0.090063, 1e-4),
        near('|D₃/D₁| = 1/9', Math.abs(mid[2] / mid[0]), 1 / 9, 1e-9),
        near('D₅/h = 0.0324', mid[4], 0.032423, 1e-4),
        near('pluck at 0.02L: D₂/D₁ = 0.499', end[1] / end[0], 0.499, 1e-3),
        near('pluck at 0.02L: D₃/D₁ = 0.332', end[2] / end[0], 0.3316, 1e-3),
        nearAbs('mid-span pluck is straight at t = T₁/4 (400 modes)', worst, 0, 1e-9),
      ];
    },
  },
  {
    id: 'b1-orthogonality',
    topic: 'B1',
    title: 'Orthogonality integrals, and the end-inertia term that restores it',
    source: 'LB5 Eq 5.2; research notes B2 §E1 (μ = 1: 0.212425 − 0.212425 = 0)',
    run: () => {
      const z = endInertiaRoots(1, 2);
      const plain = simpson((s) => Math.sin(z[0] * s) * Math.sin(z[1] * s), 0, 1, 2000);
      const endTerm = (1 / 1) * Math.sin(z[0]) * Math.sin(z[1]);
      return [
        nearAbs('∫₀¹ sin(πx) sin(2πx) dx = 0', simpson((x) => Math.sin(PI * x) * Math.sin(2 * PI * x), 0, 1), 0, 1e-9),
        near('∫₀¹ sin²(πx) dx = 1/2', simpson((x) => Math.sin(PI * x) ** 2, 0, 1), 0.5, 1e-9),
        nearAbs('fixed–free: ∫₀¹ sin(πx/2) sin(3πx/2) dx = 0', simpson((x) => Math.sin((PI * x) / 2) * Math.sin((3 * PI * x) / 2), 0, 1), 0, 1e-9),
        nearAbs('free–free: ∫₀¹ cos(πx) cos(2πx) dx = 0', simpson((x) => Math.cos(PI * x) * Math.cos(2 * PI * x), 0, 1), 0, 1e-9),
        near('end disc (z tan z = 1): plain integral = 0.2124', plain, 0.212425, 1e-4),
        nearAbs('weighted form with the disc term = 0', plain + endTerm, 0, 1e-9),
      ];
    },
  },
  {
    id: 'b1-spacing',
    topic: 'B1',
    title: 'Uneven spacing: powerline with an elastic pad (0.263, 0.529, 0.800, 1.075 Hz)',
    source: 'Reader Sample Problem 1(b), p. 77; official 2019 B1.4',
    run: () => {
      const L = 200;
      const c = stringWaveSpeed(20000, 1.5);
      const f = elasticEndStringRoots(20000 / (1000 * L), 4).map((z) => (z * c) / (2 * PI * L));
      return [
        near('fixed–fixed f₁ = 0.2887 Hz', c / (2 * L), 0.288675, 1e-5),
        near('pad f₁ = 0.2631 Hz', f[0], 0.26305, 5e-4),
        near('pad f₂ = 0.5293 Hz', f[1], 0.52933, 5e-4),
        near('pad f₃ = 0.8002 Hz', f[2], 0.80019, 5e-4),
        near('pad f₄ = 1.0753 Hz', f[3], 1.07534, 5e-4),
        near('spacing f₂ − f₁ = 0.266 Hz', f[1] - f[0], 0.2663, 2e-3),
        near('spacing f₄ − f₃ = 0.275 Hz', f[3] - f[2], 0.2752, 2e-3),
      ];
    },
  },
  {
    id: 'b1-truncation',
    topic: 'B1',
    title: 'Modal truncation: cantilever 1/(βᵢL)⁴ relative to mode 1 = 2.55 %, 0.32 %, 0.085 %',
    source: '2021 B1.3 worked solution',
    run: () => {
      const b = betaL('clamped-free', 4);
      const rel = b.map((x) => (b[0] / x) ** 4 * 100);
      return [near('mode 2: 2.55 %', rel[1], 2.546, 1e-3), near('mode 3: 0.32 %', rel[2], 0.3247, 2e-3), near('mode 4: 0.085 %', rel[3], 0.0846, 5e-3)];
    },
  },
  {
    id: 'b1-free-free-nodes',
    topic: 'B1',
    title: 'Free–free beam: mode 1 nodes at 0.224L and 0.776L; mode i has i + 1 nodes',
    source: '2022 B1.5 worked solution; official 2018 B1.7(c)',
    run: () => {
      const n1 = nodes('free-free', 1);
      return [
        near('first node 0.224', n1[0], 0.2242, 2e-3),
        near('second node 0.776', n1[1], 0.7758, 2e-3),
        ...[1, 2, 3, 4].map((i) => isTrue(`mode ${i} has ${i + 1} nodes`, nodes('free-free', i).length === i + 1, `${nodes('free-free', i).length}`)),
      ];
    },
  },
  {
    id: 'b1-content',
    topic: 'B1',
    title: 'B1 content: one correct option per MCQ, a reason for every option, unique ids',
    run: () => {
      const ids = new Set<string>();
      let dup = '';
      for (const q of [...mcqs.map((m) => m.id), ...flashcards.map((f) => f.id), ...cards.map((c) => c.id), ...games.map((g) => g.id)]) {
        if (ids.has(q)) dup = q;
        ids.add(q);
      }
      return [
        ...mcqs.map((q) => isTrue(`${q.id}: exactly one correct option, every option explained`, q.options.filter((o) => o.correct).length === 1 && q.options.every((o) => o.why.trim().length > 0) && !!q.source)),
        isTrue('unique ids', !dup, dup),
        isTrue('18–25 MCQs', mcqs.length >= 18 && mcqs.length <= 25, String(mcqs.length)),
        isTrue('15–30 flashcards', flashcards.length >= 15 && flashcards.length <= 30, String(flashcards.length)),
      ];
    },
  },
];
