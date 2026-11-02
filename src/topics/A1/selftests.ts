// Self-tests for topic A1: values from the Week 1 quiz, 2021 A1.1–A1.2, 2022 A1.1 and the summary notes.
import type { SelfTest } from '../../selftest/types';
import { near, nearAbs, isTrue } from '../../selftest/assert';
import {
  criticalDamping,
  dampingRatio,
  freeResponse,
  magnification,
  naturalFrequency,
  peakRatioTransmissibility,
  transmissibility,
  wnFromStaticDeflection,
} from '../../physics/sdof';
import { integrate } from '../../physics/ode';
import { makeRng } from '../../engine/rng';
import { generators } from './solve';

const TAU = 2 * Math.PI;

export const tests: SelfTest[] = [
  {
    id: 'a1-week1',
    topic: 'A1',
    title: 'Week 1 quiz values (static sag, max speed, forced amplitude, floor vibration)',
    source: 'Week 1 Q1–Q4 worked solutions',
    run: () => {
      const wn2 = naturalFrequency(1411, 1);
      const C = Math.sqrt(6 ** 2 + (-28 / wn2) ** 2);
      const wn3 = naturalFrequency(1000, 10);
      const X3 = (17 / 1000) * magnification((TAU * 1.5) / wn3, 0.05);
      const z4 = dampingRatio(1000, 54000, 1137);
      const r4 = (600 * TAU) / 60 / naturalFrequency(54000, 1137);
      const T4 = transmissibility(r4, z4);
      return [
        near('δst = 2 mm → fn = 11.15 Hz', wnFromStaticDeflection(0.002) / TAU, 11.1465, 1e-4),
        near('Week 1 Q2: v_max = ωn·C = 227.1 mm/s', wn2 * C, 227.11, 1e-4),
        near('Week 1 Q3: X = 0.1163 m', X3, 0.1163, 1e-3),
        near('Week 1 Q4: ζ = 0.06381', z4, 0.06381, 1e-3),
        near('Week 1 Q4: T = 0.01868', T4, 0.01868, 1e-3),
        near('Week 1 Q4: Y_max = 53.5 µm', 1 / T4, 53.53, 1e-3),
      ];
    },
  },
  {
    id: 'a1-building',
    topic: 'A1',
    title: '2021 A1.2 building on a damped foundation',
    source: '2021 A1.2 worked solution',
    run: () => {
      const z = dampingRatio(9e6, 2e8, 2e6);
      const rp = peakRatioTransmissibility(z);
      return [
        near('ζ = 0.225', z, 0.225, 1e-6),
        near('T peak at r = 0.9567 → 1.5226 Hz', (rp * naturalFrequency(2e8, 2e6)) / TAU, 1.52257, 1e-4),
        near('X_max = 12.41 mm (Y = 5 mm)', 5 * transmissibility(rp, z), 12.4066, 1e-4),
        near('X at r = 1 is 12.18 mm', 5 * transmissibility(1, z), 12.1843, 1e-4),
        near('Doubling c: X_max = 7.746 mm', 5 * transmissibility(peakRatioTransmissibility(0.45), 0.45), 7.7459, 1e-4),
      ];
    },
  },
  {
    id: 'a1-transmissibility',
    topic: 'A1',
    title: 'Transmissibility = 1 at r = √2 for every ζ; table values',
    source: 'Summary notes A1; LA7 Eq 7.1',
    run: () => [
      ...[0, 0.05, 0.2, 0.5, 1].map((z) => near(`T(√2, ζ=${z}) = 1`, transmissibility(Math.SQRT2, z), 1, 1e-12)),
      near('T(2, 0) = 1/3', transmissibility(2, 0), 1 / 3, 1e-9),
      near('T(5, 0.05) = 0.0466', transmissibility(5, 0.05), 0.0466, 2e-3),
      near('T(5, 0.3) = 0.1307 (damping hurts above √2)', transmissibility(5, 0.3), 0.1307, 2e-3),
      near('X/δst(1, ζ=0.05) = 1/(2ζ) = 10', magnification(1, 0.05), 10, 1e-12),
    ],
  },
  {
    id: 'a1-sdof-rk4',
    topic: 'A1',
    title: 'Analytic SDOF free response vs RK4 integration (ζ = 0.1, 1, 2)',
    source: 'Exact solution vs numerical integration',
    run: () => {
      const m = 2;
      const k = 400;
      const wn = naturalFrequency(k, m);
      return [0.1, 1, 2].map((z) => {
        const c = z * criticalDamping(k, m);
        const out = integrate((_t, y) => [y[1], (-k * y[0] - c * y[1]) / m], [0.04, 0.1], 0, 3, 1e-3, 50);
        let err = 0;
        out.t.forEach((t, i) => (err = Math.max(err, Math.abs(out.y[i][0] - freeResponse(t, 0.04, 0.1, wn, z)))));
        return nearAbs(`max |analytic − RK4| over 3 s, ζ = ${z}`, err, 0, 1e-8);
      });
    },
  },
  {
    id: 'a1-door',
    topic: 'A1',
    title: 'Door closer: critical damping never crosses zero; ζ = 0.3 overshoots 37 %',
    source: '2021 A1.1 worked solution',
    run: () => {
      const wn = 1;
      let minCrit = Infinity;
      for (let t = 0; t < 30; t += 0.01) minCrit = Math.min(minCrit, freeResponse(t, 1, 0, wn, 1));
      const over = Math.exp((-Math.PI * 0.3) / Math.sqrt(1 - 0.09));
      return [isTrue('ζ = 1 from rest stays ≥ 0', minCrit >= -1e-12, `min ${minCrit}`), near('ζ = 0.3 overshoot = 0.3723', over, 0.3723, 1e-3), near('ζ = 1 settles to 2 % at ωn t = 5.834', freeResponse(5.834, 1, 0, 1, 1), 0.02, 2e-3)];
    },
  },
  {
    id: 'a1-generators',
    topic: 'A1',
    title: 'Every A1 generator builds valid problems at every tier (50 seeds)',
    run: () =>
      generators.map((g) => {
        let bad = '';
        for (let s = 1; s <= 50 && !bad; s++)
          for (const t of g.tiers) {
            const inst = g.generate(makeRng(s * 7919), t);
            for (const p of inst.parts) if (p.kind === 'numeric' && !Number.isFinite(p.answer)) bad = `${p.id} not finite (seed ${s}, tier ${t})`;
            if (inst.hints.length !== 4) bad = 'needs 4 hints';
          }
        return isTrue(`${g.id}`, !bad, bad);
      }),
  },
];
