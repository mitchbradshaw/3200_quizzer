// Self-tests for topic C2: reference values from the research notes (recomputed in Python), the 2025 A3.3,
// 2024 A3.4, Week 12 Q1–Q2 and reader LC2-11/12 data, plus consistency checks of the models the C2
// simulations draw (modal sums, beam FRFs, half-power helpers) and a generator sanity test.
import type { SelfTest } from '../../selftest/types';
import type { NumericPart, SolveInstance } from '../../engine/types';
import { isTrue, near, nearAbs } from '../../selftest/assert';
import { cabs, carg } from '../../physics/complex';
import { halfPower, modalSumFRF, sdofReceptance, toAccelerance, toMobility } from '../../physics/frf';
import { modes, receptanceUndamped } from '../../physics/mdof';
import { makeRng } from '../../engine/rng';
import { checkNumeric } from '../../engine/check';
import { generators } from './solve';
import { TAU, beamFRF, halfAmplitudePoints, halfPowerExact, halfPowerFromMax, pinnedShape, realExtremes, zetaFromDecay } from './physics';

const DEG = 180 / Math.PI;

/** Frequency (and value) of the maximum of f on [a, b] by a fine scan plus golden-section refinement. */
function argMax(f: (w: number) => number, a: number, b: number): { w: number; v: number } {
  let best = a;
  const n = 4000;
  for (let i = 0; i <= n; i++) {
    const w = a + ((b - a) * i) / n;
    if (f(w) > f(best)) best = w;
  }
  let lo = Math.max(a, best - (b - a) / n);
  let hi = Math.min(b, best + (b - a) / n);
  const g = (Math.sqrt(5) - 1) / 2;
  for (let i = 0; i < 80; i++) {
    const x1 = hi - g * (hi - lo);
    const x2 = lo + g * (hi - lo);
    if (f(x1) > f(x2)) hi = x2;
    else lo = x1;
  }
  const w = (lo + hi) / 2;
  return { w, v: f(w) };
}

/** SDOF with k = 1, wn = 1 (so m = 1, c = 2 zeta): normalised receptance. */
const Hn = (zeta: number, b: number) => sdofReceptance(1, 1, 2 * zeta, b);

export const tests: SelfTest[] = [
  {
    id: 'c2-2025-a33',
    topic: 'C2',
    title: '2025 A3.3: receptance cursors, ζ and k (k = 10⁶ N/m, ωₙ = 100 rad/s, ζ = 0.065)',
    source: 'Research notes NUM-C2-01, ST-C2-01 to 05; 2025 A3.3 WS (ζ ≈ 0.0655, k = 1.0×10⁶ N/m)',
    run: () => {
      const k = 1e6;
      const m = 100;
      const z = 0.065;
      const c = 2 * z * Math.sqrt(k * m);
      const [w1, w2] = halfPowerExact(100, z);
      const top = argMax((w) => cabs(sdofReceptance(k, m, c, w)), 90, 110);
      const est = (105.915 - 92.8046) / (2 * 100.005);
      const ws = Array.from({ length: 4001 }, (_, i) => 80 + (40 * i) / 4000);
      const hp = halfPower(ws, ws.map((w) => cabs(sdofReceptance(k, m, c, w))));
      return [
        near('|H(ωₙ)| = 1/(2ζk) = 7.69231×10⁻⁶ m/N', cabs(sdofReceptance(k, m, c, 100)), 7.69231e-6, 1e-5),
        near('cursor value at 100.005 rad/s: 7.69192×10⁻⁶ m/N', cabs(sdofReceptance(k, m, c, 100.005)), 7.69192e-6, 2e-5),
        near('lower half-power point (ref |H(ωₙ)|/√2) = 92.8049 rad/s', w1, 92.8049, 1e-5),
        near('upper half-power point = 105.9162 rad/s', w2, 105.9162, 1e-5),
        near('|H| there = 5.43928×10⁻⁶ m/N (cursors 5.43917, 5.43969)', cabs(sdofReceptance(k, m, c, w1)), 5.43928e-6, 1e-5),
        near('true maximum at ωₙ√(1 − 2ζ²) = 99.5766 rad/s', top.w, 99.5766, 1e-5),
        near('true maximum 7.70861×10⁻⁶ m/N', top.v, 7.70861e-6, 1e-5),
        near('Eq 2.8 from the cursors: ζ = 0.06555', est, 0.065549, 1e-4),
        near('peak height check 1/(2Q): ζ = 0.06500', 1e-6 / (2 * 7.69192e-6), 0.065003, 1e-4),
        near('m = k/ωₙ² = 99.99 kg', 1e6 / 100.005 ** 2, 99.99, 1e-4),
        near('c = 2ζ√(km) = 1311 N s/m (with ζ = 0.06555)', 2 * est * Math.sqrt(1e6 * (1e6 / 100.005 ** 2)), 1310.9, 1e-3),
        near('physics halfPower() on a sampled |H| gives the Eq 2.8 value 0.0656', hp.zeta, 0.065557, 2e-3),
      ];
    },
  },
  {
    id: 'c2-2024-a34',
    topic: 'C2',
    title: '2024 A3.4: real and imaginary parts (k = 10⁴ N/m, fₙ = 12 Hz, ζ = 0.03)',
    source: 'Research notes NUM-C2-02, ST-C2-06 to 08; 2024 A3.4 WS (ζ = 0.030)',
    run: () => {
      const k = 1e4;
      const wn = TAU * 12;
      const z = 0.03;
      const ex = realExtremes(k, wn, z);
      const m = k / (wn * wn);
      const c = 2 * z * Math.sqrt(k * m);
      const im = argMax((w) => -sdofReceptance(k, m, c, w).im, 0.98 * wn, 1.02 * wn);
      const ratio = 8.59094 / 8.09052;
      return [
        near('Re peak at ωₙ√(1 − 2ζ) = 73.101 rad/s', ex.w1, 73.1013, 2e-5),
        near('Re peak value +8.5911×10⁻⁴ m/N', sdofReceptance(k, m, c, ex.w1).re, 8.59107e-4, 1e-4),
        near('closed form 1/(4ζ(1 − ζ)k) agrees', ex.v1, sdofReceptance(k, m, c, ex.w1).re, 1e-9),
        near('Re trough at ωₙ√(1 + 2ζ) = 77.627 rad/s', ex.w2, 77.6272, 2e-5),
        near('Re trough value −8.0906×10⁻⁴ m/N', ex.v2, -8.09061e-4, 1e-4),
        near('|Im H| maximum 1.66704×10⁻³ m/N', im.v, 1.66704e-3, 1e-4),
        near('…at β = 0.99955 (75.364 rad/s; cursor 75.3605)', im.w / wn, 0.99955, 2e-5),
        near('Eq 2.8 from the cursors: ζ = 0.03002', (77.6378 - 73.1134) / (2 * 75.3605), 0.030018, 1e-4),
        near('from the Im peak, H(0)/(2|Im H|): ζ = 0.02999', 1e-4 / (2 * 1.66704e-3), 0.029993, 1e-4),
        near('from the Re extreme ratio (1 + ζ)/(1 − ζ): ζ = 0.03000', (ratio - 1) / (ratio + 1), 0.0299986, 1e-4),
      ];
    },
  },
  {
    id: 'c2-week12-reader',
    topic: 'C2',
    title: 'Week 12 Q1–Q2 and reader LC2-11 damping and mode-shape values',
    source: 'Week 12 Q1/Q2 WS (answers B and D); reader LC2-11 exercise (research notes NUM-C2-03 to 05, ST-C2-09, 10, 22)',
    run: () => {
      const cols = [
        [0.01027, 0.0002859, -0.004226],
        [-0.004622, 0.0017, -0.002977],
        [-0.001846, -0.005004, -0.007548],
      ];
      const norm = cols.map((col) => {
        const big = col.reduce((b, v) => (Math.abs(v) > Math.abs(b) ? v : b), 0);
        return col.map((v) => v / big);
      });
      return [
        near('mode 1: (1.196 − 1.099)/(2 × 1.147) = 0.04228', (1.196 - 1.099) / (2 * 1.147), 0.04228, 1e-4),
        near('mode 2: (2.026 − 1.880)/(2 × 1.953) = 0.03738', (2.026 - 1.88) / (2 * 1.953), 0.03738, 1e-4),
        near('mode 3: (2.783 − 2.686)/(2 × 2.734) = 0.01774', (2.783 - 2.686) / (2 * 2.734), 0.01774, 2e-4),
        nearAbs('Q2 column 1 normalised: P2 = 0.0278', norm[0][1], 0.0278, 1e-4),
        nearAbs('Q2 column 1 normalised: P3 = −0.4115', norm[0][2], -0.4115, 1e-4),
        nearAbs('Q2 column 2 normalised: P2 = −0.3678', norm[1][1], -0.3678, 1e-4),
        nearAbs('Q2 column 3 normalised: P1 = 0.2446', norm[2][0], 0.2446, 1e-4),
        near('reader LC2-11 mode 3, magnitude: ζ = 0.004247', (335.238 - 332.402) / (2 * 333.9), 0.004247, 1e-3),
        near('reader LC2-11 mode 3, real part: ζ = 0.004347', (335 - 332.1) / (2 * 333.6), 0.004347, 1e-3),
        near('72.9471/√2 = 51.5814 (the half-power cursor level)', 72.9471 / Math.SQRT2, 51.5814, 1e-5),
      ];
    },
  },
  {
    id: 'c2-sdof-landmarks',
    topic: 'C2',
    title: 'SDOF landmarks: Re/Im extremes, peak positions of H, M and A, phase at resonance',
    source: 'Research notes ST-C2-11 to 15 (2022 A3.3 WS: β = 0.9487, 1.0488); reader Eq 2.4–2.6, LC2-5, LC2-7',
    run: () => {
      const out = [];
      const z = 0.05;
      const ex = realExtremes(1, 1, z);
      out.push(
        near('ζ = 0.05: Re peak at β = 0.94868', ex.w1, 0.948683, 1e-5),
        near('ζ = 0.05: Re trough at β = 1.04881', ex.w2, 1.048809, 1e-5),
        near('k·Re max = +5.2632', Hn(z, ex.w1).re, 5.26316, 1e-5),
        near('k·Re min = −4.7619', Hn(z, ex.w2).re, -4.7619, 1e-5),
        near('k·Im(ωₙ) = −1/(2ζ) = −10', Hn(z, 1).im, -10, 1e-9),
        nearAbs('Re H(ωₙ) = 0', Hn(z, 1).re, 0, 1e-12)
      );
      for (const zz of [0.05, 0.1, 0.2]) {
        const r = argMax((b) => cabs(Hn(zz, b)), 0.5, 1.5);
        const mob = argMax((b) => cabs(toMobility(Hn(zz, b), b)), 0.5, 1.5);
        const acc = argMax((b) => cabs(toAccelerance(Hn(zz, b), b)), 0.5, 1.5);
        out.push(
          near(`ζ = ${zz}: receptance peak at √(1 − 2ζ²) = ${Math.sqrt(1 - 2 * zz * zz).toFixed(5)}`, r.w, Math.sqrt(1 - 2 * zz * zz), 1e-5),
          near(`ζ = ${zz}: k|H|max = 1/(2ζ√(1 − ζ²)) = ${(1 / (2 * zz * Math.sqrt(1 - zz * zz))).toFixed(4)}`, r.v, 1 / (2 * zz * Math.sqrt(1 - zz * zz)), 1e-6),
          near(`ζ = ${zz}: mobility peak exactly at ωₙ`, mob.w, 1, 1e-5),
          near(`ζ = ${zz}: accelerance peak at 1/√(1 − 2ζ²) = ${(1 / Math.sqrt(1 - 2 * zz * zz)).toFixed(5)}`, acc.w, 1 / Math.sqrt(1 - 2 * zz * zz), 1e-5)
        );
      }
      const H1 = Hn(0.03, 1);
      out.push(
        near('phase at ωₙ: receptance −90°', carg(H1) * DEG, -90, 1e-9),
        nearAbs('phase at ωₙ: mobility 0°', carg(toMobility(H1, 1)) * DEG, 0, 1e-9),
        near('phase at ωₙ: accelerance +90°', carg(toAccelerance(H1, 1)) * DEG, 90, 1e-9),
        near('ζ = 0.05: receptance phase at β = 0.95 is −44.26°', carg(Hn(0.05, 0.95)) * DEG, -44.2559, 1e-4),
        near('ζ = 0.05: receptance phase at β = 1.05 is −134.31°', carg(Hn(0.05, 1.05)) * DEG, -134.3097, 1e-5)
      );
      return out;
    },
  },
  {
    id: 'c2-half-power-helpers',
    topic: 'C2',
    title: 'Half-power helpers: levels hit exactly; Eq 2.8 bias; half-amplitude trap',
    source: 'Research notes ST-C2-16, 17 (Eq 2.8 error +0.50 % at ζ = 0.05, +2.06 % at 0.1); reader LC2-4/5 (C-4)',
    run: () => {
      const out = [];
      for (const z of [0.01, 0.05, 0.1]) {
        const [a, b] = halfPowerFromMax(1, z);
        const peak = 1 / (2 * z * Math.sqrt(1 - z * z));
        out.push(near(`ζ = ${z}: |H| at halfPowerFromMax points = |H|max/√2`, cabs(Hn(z, a)), peak / Math.SQRT2, 1e-9));
        out.push(near(`ζ = ${z}: …both points`, cabs(Hn(z, b)), peak / Math.SQRT2, 1e-9));
        const [c, d] = halfPowerExact(1, z);
        out.push(near(`ζ = ${z}: |H| at halfPowerExact points = |H(ωₙ)|/√2`, cabs(Hn(z, d)), 1 / (2 * z) / Math.SQRT2, 1e-9));
        out.push(nearAbs(`ζ = ${z}: …lower point`, cabs(Hn(z, c)) * 2 * z * Math.SQRT2, 1, 1e-9));
        const [h1, h2] = halfAmplitudePoints(1, z);
        out.push(near(`ζ = ${z}: half-amplitude points sit at |H(ωₙ)|/2`, cabs(Hn(z, h2)), 1 / (4 * z), 1e-9));
        out.push(near(`ζ = ${z}: half-amplitude spacing ≈ √3 × half-power spacing`, (h2 - h1) / (d - c), Math.sqrt(3), 0.01));
      }
      const err = (z: number) => {
        const [a, b] = halfPowerExact(1, z);
        return ((b - a) / 2 / z - 1) * 100;
      };
      const errRe = (z: number) => {
        const ex = realExtremes(1, 1, z);
        return ((ex.w2 - ex.w1) / 2 / z - 1) * 100;
      };
      out.push(
        nearAbs('Eq 2.8 error at ζ = 0.01: +0.02 %', err(0.01), 0.02, 0.005),
        nearAbs('Eq 2.8 error at ζ = 0.05: +0.50 %', err(0.05), 0.504, 0.005),
        nearAbs('Eq 2.8 error at ζ = 0.065: +0.86 %', err(0.065), 0.856, 0.005),
        nearAbs('Eq 2.8 error at ζ = 0.1: +2.06 %', err(0.1), 2.063, 0.005),
        nearAbs('Eq 2.8 error at ζ = 0.2: +9.19 %', err(0.2), 9.19, 0.01),
        nearAbs('Re-extreme spacing error at ζ = 0.05: +0.13 %', errRe(0.05), 0.126, 0.005),
        nearAbs('Re-extreme spacing error at ζ = 0.2: +2.15 %', errRe(0.2), 2.155, 0.005),
        near('exact Re relation (ω₂² − ω₁²)/(4ωₙ²) = ζ', (realExtremes(1, 1, 0.07).w2 ** 2 - realExtremes(1, 1, 0.07).w1 ** 2) / 4, 0.07, 1e-12)
      );
      return out;
    },
  },
  {
    id: 'c2-logdec-conversions',
    topic: 'C2',
    title: 'Log decrement, FRF-form conversions and the modal constant',
    source: 'Research notes ST-C2-18, 24, 28 (reader Eq 2.9; LC2-7; Lab Exp. 3)',
    run: () => {
      const d = zetaFromDecay(10, 5, 5);
      const w = TAU * 118.4;
      return [
        near('ζ = 0.05 → δ = 2πζ/√(1 − ζ²) = 0.31455', (TAU * 0.05) / Math.sqrt(1 - 0.0025), 0.314553, 1e-5),
        near('X₀ = 10, X₅ = 5: δ = 0.13863', d.delta, 0.138629, 1e-5),
        near('…ζ = δ/√(4π² + δ²) = 0.02206', d.zeta, 0.0220582, 1e-5),
        near('|A| = 152.2 m/s²/N at 118.4 Hz → |H| = 2.750×10⁻⁴ m/N', 152.2 / (w * w), 2.75012e-4, 1e-5),
        near('…|M| = 0.2046 m/s/N', 152.2 / w, 0.204589, 1e-5),
        near('modal constant 2ζωₙ²|H(ωₙ)| = 1/m: 2025 data → 0.0100 kg⁻¹', 2 * 0.065 * 100 ** 2 * 7.69192e-6, 0.0099995, 1e-4),
        near('…2024 data → 0.5686 kg⁻¹ (m = 1.759 kg)', 2 * 0.03 * (TAU * 12) ** 2 * 1.66704e-3, 0.568617, 1e-4),
        near('accelerance at resonance |A(ωₙ)| = 1/(2ζm)', cabs(toAccelerance(sdofReceptance(400, 4, 2 * 0.02 * 40, 10), 10)), 1 / (2 * 0.02 * 4), 1e-9),
      ];
    },
  },
  {
    id: 'c2-modal-models',
    topic: 'C2',
    title: 'Simulation models: 2-DoF modal sum = direct inverse; beam FRF reciprocity and Im H ∝ mode shape',
    source: 'Reader LC2-8 Eq for H (proportional damping), Eq 2.10; summary notes B3 (pinned–pinned shapes)',
    run: () => {
      const k = 1e6;
      const m = 100;
      const K = [
        [2 * k, -k],
        [-k, k],
      ];
      const M = [
        [m, 0],
        [0, m],
      ];
      const res = modes(K, M);
      const terms = res.omega.map((wn, i) => ({ wn, zeta: 0, phi: [res.Pm[0][i], res.Pm[1][i]] }));
      const W = 87;
      const direct = receptanceUndamped(K, M, W);
      const sum11 = modalSumFRF(terms, 0, 0, W).re;
      const sum21 = modalSumFRF(terms, 1, 0, W).re;
      // Beam: hammer at 0.25 L, accelerometer roving; at mode 3 the column is ∝ sin(3πx).
      const w1 = TAU * 20;
      const z = 0.005;
      const xs = [0.2, 0.45, 0.7];
      const col = xs.map((x) => beamFRF(x, 0.25, 9 * w1, w1, z, 5, 'A').im);
      const shape = xs.map((x) => pinnedShape(3, x));
      const ratioErr = Math.max(...col.map((v, i) => Math.abs(v / col[0] - shape[i] / shape[0])));
      const recip = cabs({ re: beamFRF(0.3, 0.8, 300, w1, 0.02, 5, 'H').re - beamFRF(0.8, 0.3, 300, w1, 0.02, 5, 'H').re, im: beamFRF(0.3, 0.8, 300, w1, 0.02, 5, 'H').im - beamFRF(0.8, 0.3, 300, w1, 0.02, 5, 'H').im });
      return [
        near('2-DoF chain: ω₁ = 0.618√(k/m) = 61.80 rad/s', res.omega[0], 61.8034, 1e-5),
        near('ω₂ = 1.618√(k/m) = 161.80 rad/s', res.omega[1], 161.8034, 1e-5),
        near('undamped modal sum H₁₁ = [(K − ω²M)⁻¹]₁₁', sum11, direct[0][0], 1e-9),
        near('undamped modal sum H₂₁ = [(K − ω²M)⁻¹]₂₁', sum21, direct[1][0], 1e-9),
        nearAbs('H₁₁ anti-resonance at √(k₂/m₂) = 100 rad/s', modalSumFRF(terms, 0, 0, 100).re, 0, 1e-15),
        nearAbs('beam reciprocity H(0.3, 0.8) = H(0.8, 0.3)', recip, 0, 1e-15),
        nearAbs('beam column at mode 3: Im A ratios = sin(3πx) ratios (within 2 %)', ratioErr, 0, 0.02),
        near('beam driving-point accelerance at mode 1 ≈ φ²/(2ζ)', beamFRF(0.5, 0.5, w1, w1, 0.02, 5, 'A').im, 1 / (2 * 0.02), 0.02),
        nearAbs('a sensor on a support sees nothing', cabs(beamFRF(0, 0.3, 4 * w1, w1, 0.02, 5, 'A')), 0, 1e-12),
      ];
    },
  },
  {
    id: 'c2-wheel-rail',
    topic: 'C2',
    title: '2021 A3.2–A3.3: point-mass receptance, the wheel-on-rail dip and the loaded rail mode',
    source: 'Research notes NUM-C2-09, NUM-C2-10 (2021 A3.2/A3.3 WS: wheel ≈ 105 kg; crossing ≈ 0.8×10⁻⁸ m/N near 175–180 Hz; 18.7° from opposition; mass ratio (142/91)² = 2.43)',
    run: () => {
      const mWheel = (alpha: number, f: number) => 1 / (alpha * (TAU * f) ** 2);
      const fCross = Math.sqrt(1 / (105 * 0.8e-8)) / TAU;
      const dev = (2 * Math.asin(0.26 / (2 * 0.8)) * 180) / Math.PI;
      return [
        near('|α| = 0.15×10⁻⁸ m/N at 400 Hz → m = 105.5 kg', mWheel(0.15e-8, 400), 105.54, 1e-3),
        near('|α| = 0.27×10⁻⁸ m/N at 300 Hz → m = 104.2 kg', mWheel(0.27e-8, 300), 104.24, 1e-3),
        near('point mass: |α| falls as 1/ω² (0.6×10⁻⁸ at 200 Hz → 0.15×10⁻⁸ at 400 Hz)', 0.6e-8 * (200 / 400) ** 2, 0.15e-8, 1e-12),
        near('wheel (105 kg) meets a 0.8×10⁻⁸ m/N rail at √(k/m)/2π = 173.7 Hz', fCross, 173.66, 1e-3),
        near('|sum| = 0.26 from two 0.8 vectors: 18.7° from exact opposition', dev, 18.71, 1e-3),
        near('2021 A3.3: effective mass ratio (142/91)² = 2.435', (142 / 91) ** 2, 2.435, 1e-3),
      ];
    },
  },
  {
    id: 'c2-logdec-traps',
    topic: 'C2',
    title: 'Log decrement: an undivided ln(X₀/X_m), or m ± 1 cycles, is named as a trap at every tier',
    source: 'Review round 1: #/C2/solve/c2-logdec?t=2&s=4202 (ζ = 0.3355 from the undivided log) got a generic “Not quite”; reader LC2-6, Eq 2.9',
    run: () => {
      const g = generators.find((x) => x.id === 'c2-logdec')!;
      const zPart = (inst: SolveInstance) => inst.parts.find((p) => p.id === 'z') as NumericPart;
      const reported = zPart(g.generate(makeRng(4202), 2));
      let bad = '';
      let n = 0;
      for (let s = 1; s <= 200 && !bad; s++)
        for (const t of g.tiers) {
          const inst = g.generate(makeRng(s * 7919), t);
          const xm = (inst.givens || []).find((x) => /^X_\{\d+\}$/.test(x.sym));
          const x0 = (inst.givens || []).find((x) => x.sym === 'X_0');
          if (!xm || !x0) {
            bad = `seed ${s}, tier ${t}: X_0 or X_m missing from the givens`;
            break;
          }
          const m = Number(/\d+/.exec(xm.sym)![0]);
          const X0 = parseFloat(x0.value);
          const Xm = parseFloat(xm.value);
          const z = zPart(inst);
          // Undivided log (Eq 2.9 and the small-damping δ/2π), then m − 1 and m + 1 cycles; typed to 3 s.f.
          const slips = [zetaFromDecay(X0, Xm, 1).zeta, Math.log(X0 / Xm) / TAU, zetaFromDecay(X0, Xm, m - 1).zeta, zetaFromDecay(X0, Xm, m + 1).zeta];
          for (const v of slips) {
            n++;
            if (checkNumeric(z, v.toPrecision(3)).trapId !== 'c2-logdec-cycles') bad = `seed ${s}, tier ${t}: ζ = ${v.toPrecision(3)} is not named`;
          }
          if (!checkNumeric(z, z.answer.toPrecision(3)).correct) bad = `seed ${s}, tier ${t}: the answer ${z.answer.toPrecision(3)} is rejected`;
        }
      return [
        isTrue('seed 4202, tier 2: ζ = 0.3355 (undivided log in Eq 2.9) is named c2-logdec-cycles', checkNumeric(reported, '0.3355').trapId === 'c2-logdec-cycles'),
        isTrue('…and ζ = 0.356 (undivided log over 2π)', checkNumeric(reported, '0.356').trapId === 'c2-logdec-cycles'),
        isTrue('…while the answer 0.0710 is accepted', checkNumeric(reported, '0.0710').correct),
        isTrue(`200 seeds × 3 tiers: all four slips named and every answer accepted (${n} slips)`, !bad, bad),
      ];
    },
  },
  {
    id: 'c2-generators',
    topic: 'C2',
    title: 'Every C2 generator builds valid problems at every tier (50 seeds)',
    run: () =>
      generators.map((g) => {
        let bad = '';
        for (let s = 1; s <= 50 && !bad; s++)
          for (const t of g.tiers) {
            const inst = g.generate(makeRng(s * 7919), t);
            if (inst.hints.length !== 4) bad = `needs 4 hints (seed ${s}, tier ${t})`;
            for (const p of inst.parts) {
              if (p.kind === 'numeric') {
                if (!Number.isFinite(p.answer)) bad = `${p.id} not finite (seed ${s}, tier ${t})`;
                const tol = Math.max(p.tol ?? 0.02, 0.02);
                for (const tr of p.traps || []) {
                  const gap = Math.abs(tr.value - p.answer);
                  if (!Number.isFinite(tr.value) || (gap <= tol * Math.abs(p.answer) && !(p.absTol !== undefined && gap > 1.5 * p.absTol)))
                    bad = `${p.id}: trap ${tr.value} within tolerance of ${p.answer} (seed ${s}, tier ${t})`;
                }
              }
              if (p.kind === 'matrix' && !p.answer.flat().every(Number.isFinite)) bad = `${p.id}: matrix not finite (seed ${s}, tier ${t})`;
              if (p.kind === 'choice' && !p.options.some((o) => o.correct)) bad = `${p.id}: no correct option (seed ${s}, tier ${t})`;
              if (p.kind === 'choice' && !p.multi && p.options.filter((o) => o.correct).length !== 1) bad = `${p.id}: single choice needs exactly one correct option (seed ${s}, tier ${t})`;
            }
            if (/NaN|undefined|Infinity|\d\.\d*(0000000|9999999)\d/.test(inst.prompt + inst.hints.join(' '))) bad = `NaN/undefined/float artefact in text (seed ${s}, tier ${t})`;
          }
        return isTrue(`${g.id}`, !bad, bad);
      }),
  },
];
