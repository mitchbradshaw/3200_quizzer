// Self-tests for topic C4: transmissibility and isolator design values (2025 A3.5, Week 1 Q4, 2022 A1.1,
// LA7 typical mounts), the start-up trade-off, the damped absorber of LC4.6, the seat end-stop model
// (2023 A3.4), the strategy deck's consistency, and sanity sweeps of the MCQs and generators.
import type { SelfTest } from '../../selftest/types';
import { ascending, isTrue, near, nearAbs } from '../../selftest/assert';
import { dampingRatio, naturalFrequency, transmissibility } from '../../physics/sdof';
import { denHartogFixedPoints, primaryAmplitude, tunedRatios } from '../../physics/absorber';
import { rk4Step } from '../../physics/ode';
import { G, TWO_PI } from '../../physics/units';
import { makeRng } from '../../engine/rng';
import {
  fnToSag,
  peakExcursion,
  primaryWithAbsorber,
  ratioForT,
  sagToFn,
  seatAccel,
  seatDeriv,
  secondaryToPrimary,
  startUpPeak,
  floorForceRatio,
  tunedResidual,
  unbalanceAmplitude,
  type SeatParams,
} from './physics';
import { bandEffect, STRATEGIES, TEMPLATES } from './scenarios';
import { generators } from './solve';
import { mcqs } from './quiz';

/** Largest value of f over [a, b] by dense sampling, and where it is. */
function argmax(f: (x: number) => number, a: number, b: number, n = 20000) {
  let best = { x: a, y: -Infinity };
  for (let i = 0; i <= n; i++) {
    const x = a + ((b - a) * i) / n;
    const y = f(x);
    if (y > best.y) best = { x, y };
  }
  return best;
}

/** Steady-state seat response: peak |z| and peak |seat acceleration| over the last `keep` seconds. */
function seatRun(p: SeatParams, T = 24, keep = 6) {
  const f = seatDeriv(p);
  let s = [0, 0];
  let t = 0;
  const h = 1 / 2000;
  let zMax = 0;
  let aMax = 0;
  let zAtAmax = 0;
  for (let i = 0; i < Math.round(T / h); i++) {
    s = rk4Step(f, t, s, h);
    t += h;
    if (t > T - keep) {
      const a = Math.abs(seatAccel(s, p));
      zMax = Math.max(zMax, Math.abs(s[0]));
      if (a > aMax) {
        aMax = a;
        zAtAmax = Math.abs(s[0]);
      }
    }
  }
  return { zMax, aMax, zAtAmax };
}

export const tests: SelfTest[] = [
  {
    id: 'c4-transmissibility',
    topic: 'C4',
    title: 'Transmissibility: T(√2) = 1 for every ζ; damping raises T above √2 (2025 A3.5 numbers)',
    source: 'LC4.5 figure; LA7 Eq 7.1; 2025 A3.5 worked (r = 5)',
    run: () => [
      ...[0, 0.05, 0.2, 0.6, 1].map((z) => near(`T(√2, ζ = ${z}) = 1`, transmissibility(Math.SQRT2, z), 1, 1e-12)),
      near('T(5, 0) = 1/24 = 0.04167', transmissibility(5, 0), 1 / 24, 1e-9),
      near('T(5, 0.05) = 0.0466', transmissibility(5, 0.05), 0.0466, 2e-3),
      near('T(5, 0.15) = 0.0750', transmissibility(5, 0.15), 0.075, 2e-3),
      near('T(5, 0.3) = 0.1307', transmissibility(5, 0.3), 0.1307, 2e-3),
      near('T(5, 0.6) = 0.2459', transmissibility(5, 0.6), 0.2459, 2e-3),
      near('T(3, 0.1) = 0.1454', transmissibility(3, 0.1), 0.1454, 2e-3),
      near('T(3, 0.2) = 0.1931', transmissibility(3, 0.2), 0.1931, 2e-3),
      near('Stiff mounts, ωn = 2Ω: T(0.5, 0) = 4/3 (amplifies)', transmissibility(0.5, 0), 4 / 3, 1e-9),
      ascending('r = 5: T rises with ζ = 0, 0.05, 0.15, 0.3, 0.6', [0, 0.05, 0.15, 0.3, 0.6].map((z) => transmissibility(5, z))),
      ascending('r = 1: T falls as ζ rises (listed for ζ = 0.6, 0.3, 0.15, 0.05)', [0.6, 0.3, 0.15, 0.05].map((z) => transmissibility(1, z))),
    ],
  },
  {
    id: 'c4-exam-isolation',
    topic: 'C4',
    title: 'Week 1 Q4 (allowable floor vibration) and 2022 A1.1 (camera cushion)',
    source: 'Week 1 Q4 worked; 2022 A1.1 worked',
    run: () => {
      const wn = naturalFrequency(54000, 1137);
      const z = dampingRatio(1000, 54000, 1137);
      const r = (600 * TWO_PI) / 60 / wn;
      const T = transmissibility(r, z);
      const W = 4 * Math.PI;
      const m = 12;
      const r250 = W / Math.sqrt(250 / m);
      const T250 = 1 / (r250 * r250 - 1);
      return [
        near('Week 1 Q4: ωn = 6.892 rad/s', wn, 6.892, 1e-3),
        near('Week 1 Q4: ζ = 0.06381', z, 0.06381, 1e-3),
        near('Week 1 Q4: r = 9.117', r, 9.117, 1e-3),
        near('Week 1 Q4: T = 0.01868', T, 0.01868, 1e-3),
        near('Week 1 Q4: Y_max = 1 µm / T = 53.53 µm', 1 / T, 53.53, 1e-3),
        near('2022 A1.1: isolation needs k < mω²/2 = 947.5 N/m', (m * W * W) / 2, 947.5, 1e-3),
        near('2022 A1.1: T ≤ 0.1 needs k ≤ mω²/11 = 172.3 N/m', (m * W * W) / 11, 172.3, 1e-3),
        near('2022 A1.1: k = 250 N/m gives r = 2.753', r250, 2.753, 1e-3),
        near('2022 A1.1: T = 0.1520', T250, 0.152, 1e-3),
        near('2022 A1.1: camera amplitude 4.56 mm for Y = 30 mm', 30 * T250, 4.56, 2e-3),
      ];
    },
  },
  {
    id: 'c4-static-sag',
    topic: 'C4',
    title: 'Static sag → natural frequency; typical mounts; isolator sizing by sag',
    source: 'LC4.5 note; LA7-2 typical deflections; constructed G7 (25 Hz, T = 0.1)',
    run: () => [
      near('δ = 5 mm → 7.050 Hz', sagToFn(0.005), 7.05, 5e-4),
      near('δ = 10 mm → 4.985 Hz', sagToFn(0.01), 4.985, 5e-4),
      near('δ = 25 mm → 3.153 Hz', sagToFn(0.025), 3.153, 5e-4),
      near('δ = 50 mm → 2.229 Hz', sagToFn(0.05), 2.229, 5e-4),
      near('steel coil 125 mm → 1.410 Hz', sagToFn(0.125), 1.41, 1e-3),
      near('rubber 6 mm → 6.435 Hz', sagToFn(0.006), 6.435, 1e-3),
      near('air spring 200 mm → 1.115 Hz', sagToFn(0.2), 1.115, 1e-3),
      near('fnToSag inverts sagToFn (3 Hz)', sagToFn(fnToSag(3)), 3, 1e-12),
      near('undamped T = 0.1 needs r = √11 = 3.317', ratioForT(0.1), Math.sqrt(11), 1e-12),
      near('1500 rpm, T ≤ 0.1: δ ≥ 11g/Ω² = 4.37 mm', ((G * 11) / ((1500 * TWO_PI) / 60) ** 2) * 1000, 4.373, 1e-3),
    ],
  },
  {
    id: 'c4-startup',
    topic: 'C4',
    title: 'Start-up trade-off: excursion peak (me/M)/2ζ independent of stiffness; floor-force peak ∝ ωn²',
    source: 'LC4.4–4.5 (damping control, isolation); derived from the SDOF unbalance response',
    run: () => {
      const out = [] as ReturnType<typeof near>[];
      for (const z of [0.02, 0.05, 0.1, 0.3]) {
        const sampled = argmax((r) => unbalanceAmplitude(r, z), 0.5, 3).y;
        out.push(near(`max r²/√((1−r²)² + (2ζr)²) = 1/(2ζ√(1−ζ²)), ζ = ${z}`, peakExcursion(z), sampled, 1e-5));
      }
      out.push(near('ζ ≥ 1/√2: no peak, excursion → me/M', peakExcursion(0.8), 1, 1e-12));
      // floor-force peak during run-up, as a fraction of the running unbalance force
      for (const [rr, z] of [
        [4, 0.05],
        [7.9, 0.03],
        [2, 0.2],
      ] as const) {
        const sampled = argmax((s) => floorForceRatio(s, rr, z), 0.001, 1, 200000).y;
        out.push(near(`startUpPeak matches a dense sweep (r_run = ${rr}, ζ = ${z})`, startUpPeak(rr, z).ratio, sampled, 1e-4));
      }
      // doubling the static sag (r_run × √2, same running force) halves the start-up force peak (it scales with ωn²)
      const a = startUpPeak(5, 0.1).ratio;
      const b = startUpPeak(5 * Math.SQRT2, 0.1).ratio;
      out.push(near('double the sag: start-up floor-force peak halves', b / a, 0.5, 1e-3));
      out.push(near('stiff mounts (r_run = 0.4): the largest force is at running speed', startUpPeak(0.4, 0.05).s, 1, 1e-12));
      // the isolation challenge has a solution (1500 rpm, me/M = 1e-4 m): sag 24 mm, ζ = 0.03
      const W = (1500 * TWO_PI) / 60;
      const rr = W / Math.sqrt(G / 0.024);
      out.push(isTrue('isolation challenge feasible: T ≤ 0.02 and excursion ≤ 2 mm at sag 24 mm, ζ = 0.03', transmissibility(rr, 0.03) <= 0.02 && 0.1 * peakExcursion(0.03) <= 2, `T = ${transmissibility(rr, 0.03).toFixed(4)}`));
      return out;
    },
  },
  {
    id: 'c4-absorber',
    topic: 'C4',
    title: 'LC4.6 damped absorber (μ = 1/20, β = 1): residual 3.92 at ζ = 0.1, peaks, fixed points, locked absorber',
    source: 'Reader LC4.6 figure (Rao 9.11.2); research notes C4.6; LA6 Eq 6.22',
    run: () => {
      let worst = 0;
      for (let g = 0.3; g < 2; g += 0.0137)
        for (const z of [0, 0.05, 0.1, 0.3])
          for (const b of [0.8, 1, 1.2]) {
            const ref = primaryAmplitude(0.05, b, g, z);
            if (ref > 1e-6) worst = Math.max(worst, Math.abs(primaryWithAbsorber(g, 0.05, b, z, 0) - ref) / ref);
          }
      const p1 = argmax((g) => primaryWithAbsorber(g, 0.05, 1, 0.1), 0.8, 1);
      const p2 = argmax((g) => primaryWithAbsorber(g, 0.05, 1, 0.1), 1, 1.3);
      const fp = denHartogFixedPoints(0.05, 1);
      const lock = argmax((g) => primaryWithAbsorber(g, 0.05, 1, 1e4), 0.9, 1.05, 30000);
      const [r1, r2] = tunedRatios(0.05);
      const [s1, s2] = tunedRatios(0.531);
      return [
        nearAbs('with ζ₁ = 0 it equals physics/absorber primaryAmplitude (max relative difference)', worst, 0, 1e-9),
        nearAbs('undamped, tuned: X₁ = 0 at Ω = ω₁₁', primaryWithAbsorber(1, 0.05, 1, 0), 0, 1e-12),
        near('ζ = 0.1: X₁k₁/F₀ = 3.922 at Ω = ω₁₁', primaryWithAbsorber(1, 0.05, 1, 0.1), 3.922, 1e-3),
        near('closed form 2ζ/(μ√(1+4ζ²)) agrees (ζ = 0.1)', tunedResidual(0.05, 0.1), primaryWithAbsorber(1, 0.05, 1, 0.1), 1e-12),
        near('ζ = 0.05: 1.990 at Ω = ω₁₁', tunedResidual(0.05, 0.05), 1.99, 1e-3),
        near('ζ = 0.1: lower peak 9.63', p1.y, 9.63, 1e-2),
        near('… at r = 0.903', p1.x, 0.903, 5e-3),
        near('ζ = 0.1: upper peak 4.93', p2.y, 4.93, 1e-2),
        near('… at r = 1.101', p2.x, 1.101, 5e-3),
        near('fixed point A at r = 0.919', fp.g[0], 0.919, 5e-3),
        near('… height 8.77', fp.amp[0], 8.77, 5e-3),
        near('fixed point B at r = 1.075', fp.g[1], 1.075, 5e-3),
        near('… height 4.67', fp.amp[1], 4.67, 5e-3),
        near('locked absorber (ζ → ∞): one resonance at 1/√1.05 = 0.9759', lock.x, 0.9759, 5e-4),
        near('tuned μ = 0.05: r₁ = 0.894', r1, 0.894, 1e-3),
        near('… r₂ = 1.118', r2, 1.118, 1e-3),
        near('2021 A1.3 μ = 0.531: r₁ = 0.700', s1, 0.7, 2e-3),
        near('… r₂ = 1.429', s2, 1.429, 2e-3),
        isTrue('primary damping ζ₁ = 0.01 lowers the new peak (μ = 0.05, ζ = 0.05)', argmax((g) => primaryWithAbsorber(g, 0.05, 1, 0.05, 0.01), 0.8, 1).y < argmax((g) => primaryWithAbsorber(g, 0.05, 1, 0.05, 0), 0.8, 1).y),
      ];
    },
  },
  {
    id: 'c4-seat',
    topic: 'C4',
    title: 'Seat with end-stops (2023 A3.4): linear without contact; spikes with contact, higher for a stiffer stop',
    source: '2023 A3.4 worked (floor ≈ 6–7 m/s², seat ≈ 9–10, spikes ≈ 15–18 m/s²; plot readings approximate)',
    run: () => {
      const W = TWO_PI * 1.5;
      const base: SeatParams = { fn: 1.5, zeta: 0.4, Y: 6.5 / (W * W), f: 1.5, gap: 0.05, stopRatio: 10 };
      const r = 1;
      const zLin = base.Y * (r * r) / Math.hypot(1 - r * r, 2 * base.zeta * r);
      const aLin = 6.5 * transmissibility(1, 0.4);
      const free = seatRun({ ...base, gap: 1 });
      const hit = seatRun(base);
      const stiff = seatRun({ ...base, stopRatio: 50 });
      return [
        near('no contact: relative travel = Y r²/√((1−r²)² + (2ζr)²) = 91.5 mm', free.zMax, zLin, 5e-3),
        near('no contact: seat acceleration = T·A = 10.4 m/s²', free.aMax, aLin, 5e-3),
        isTrue('with ±50 mm travel the linear travel (91.5 mm) exceeds the gap', zLin > base.gap),
        isTrue('end-stop contact: peak seat acceleration ≥ 1.5 × the smooth (linear) peak', hit.aMax >= 1.5 * aLin, `${hit.aMax.toFixed(1)} vs ${aLin.toFixed(1)} m/s²`),
        isTrue('the spikes occur in contact (|z| > gap at the peak acceleration)', hit.zAtAmax > base.gap, `|z| = ${(hit.zAtAmax * 1000).toFixed(1)} mm`),
        isTrue('spike in the exam’s range: 15–20 m/s² with the default set-up', hit.aMax > 15 && hit.aMax < 20, `${hit.aMax.toFixed(1)} m/s²`),
        isTrue('a 5× stiffer stop gives higher spikes', stiff.aMax > 1.5 * hit.aMax, `${stiff.aMax.toFixed(1)} vs ${hit.aMax.toFixed(1)} m/s²`),
      ];
    },
  },
  {
    id: 'c4-scenarios',
    topic: 'C4',
    title: 'Strategy deck: every scenario has a verdict for all seven strategies, and the plotted effects agree with the verdicts (40 seeds each)',
    source: 'Cue table, summary notes C4 / research notes C4.8',
    run: () =>
      TEMPLATES.map((t) => {
        let bad = '';
        for (let s = 1; s <= 40 && !bad; s++) {
          const sc = t.make(makeRng(s * 101 + 7));
          if (sc.template !== t.id) bad = `template id ${sc.template}`;
          if (sc.best !== t.best || sc.verdicts[t.best]?.v !== 'best') bad = `best is not ${t.best} (seed ${s})`;
          for (const st of STRATEGIES) {
            const v = sc.verdicts[st.id];
            if (!v || v.why.length < 20) bad = `${st.id}: missing verdict (seed ${s})`;
            else if (st.id !== t.best && v.v === 'best') bad = `${st.id}: second best (seed ${s})`;
          }
          if (!sc.plot) continue;
          for (const st of STRATEGIES) {
            const e = bandEffect(sc.plot, st.id);
            if (e.after === null) continue;
            const v = sc.verdicts[st.id].v;
            if (v === 'best' && !(e.after <= 0.5 * e.before)) bad = `${st.id} is best but only ${e.before.toFixed(3)} → ${e.after.toFixed(3)} (seed ${s})`;
            if (v === 'poor' && !(e.after >= 0.7 * e.before)) bad = `${st.id} is poor but helps: ${e.before.toFixed(3)} → ${e.after.toFixed(3)} (seed ${s})`;
          }
        }
        return isTrue(t.id, !bad, bad);
      }),
  },
  {
    id: 'c4-formulas',
    topic: 'C4',
    title: 'Small formula checks: reciprocating secondary/primary ratio, retune factor',
    source: 'LC4.3 inertia forces; LC4.4',
    run: () => [
      near('m_c → 0: secondary/primary = r/l', secondaryToPrimary(2, 0, 0.05, 0.2), 0.25, 1e-12),
      near('m_p = m_c: ratio halves', secondaryToPrimary(2, 2, 0.05, 0.2), 0.125, 1e-12),
      near('raise ωn by 30 %: k × 1.69', 1.3 ** 2, 1.69, 1e-12),
    ],
  },
  {
    id: 'c4-content',
    topic: 'C4',
    title: 'MCQs: exactly one correct option and a reason for every option',
    run: () =>
      mcqs.map((q) => {
        const nCorrect = q.options.filter((o) => o.correct).length;
        const allWhy = q.options.every((o) => o.why.trim().length > 3);
        return isTrue(q.id, nCorrect === 1 && allWhy && !!q.source, `${nCorrect} correct, why on all: ${allWhy}`);
      }),
  },
  {
    id: 'c4-generators',
    topic: 'C4',
    title: 'Every C4 generator builds valid problems at every tier (60 seeds)',
    run: () =>
      generators.map((g) => {
        let bad = '';
        for (let s = 1; s <= 60 && !bad; s++)
          for (const t of g.tiers) {
            const inst = g.generate(makeRng(s * 7919 + 13), t);
            if (inst.hints.length !== 4 || inst.hints.some((h) => !h || h.length < 10)) bad = `hints (seed ${s}, tier ${t})`;
            if (!inst.parts.length) bad = `no parts (seed ${s}, tier ${t})`;
            for (const p of inst.parts) {
              if (p.kind === 'numeric') {
                if (!Number.isFinite(p.answer) || p.answer <= 0) bad = `${p.id} = ${p.answer} (seed ${s}, tier ${t})`;
                for (const tr of p.traps || []) if (Math.abs(tr.value - p.answer) <= 0.035 * Math.abs(p.answer)) bad = `${p.id}: trap within 3.5 % of the answer (seed ${s}, tier ${t})`;
              }
              if (p.kind === 'choice' && !p.multi && p.options.filter((o) => o.correct).length !== 1) bad = `${p.id}: single choice with ${p.options.filter((o) => o.correct).length} correct (seed ${s}, tier ${t})`;
            }
          }
        return isTrue(`${g.id}`, !bad, bad);
      }),
  },
];
