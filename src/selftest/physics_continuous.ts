// Physics library self-tests (physics_continuous): waves, beams, forced beams, approximate methods,
// FRFs, transducers and DSP. Reference values cite the summary notes, the course reader and past papers.
import type { CheckResult, SelfTest } from './types';
import { near, nearAbs, isTrue, ascending } from './assert';
import { simpson } from '../physics/integrate';
import { type C, cabs, carg, cdiv, csub } from '../physics/complex';
import {
  waveOmegas,
  hasRigidMode,
  waveModeShape,
  waveNodes,
  endInertiaRoots,
  shaftEndInertiaOmegas,
  torsionalStiffness,
  polarMoment,
  polarMomentTube,
  pluckAmplitudes,
  touchedHarmonics,
  rotatingCableTension,
  swingTension,
  rodEquivalentSdof,
  rodWaveSpeed,
  shaftWaveSpeed,
  shearModulus,
  stringWaveSpeed,
} from '../physics/waves';
import {
  type BeamBC,
  BEAM_BCS,
  betaL,
  sigma,
  modeShape,
  modeShapeDerivs,
  modeShapeSamples,
  nodes,
  beamOmega,
  frequencyRatios,
  rigidModeShape,
  thinTube,
  hollowCircle,
  solidCircle,
  rectangle,
  cantileverTipLoadShape,
  cantileverTipLoadShapeD2,
  cantileverUdlShape,
  cantileverUdlShapeD2,
} from '../physics/beams';
import { modalAmplitude, beamResponse, dynamicFactor, unbalanceForce } from '../physics/forcedBeam';
import {
  rayleighOmega,
  rayleighFromTrial,
  TRIAL_SHAPES,
  dunkerley,
  cantileverStiffnessAt,
  pinnedStiffnessAt,
  clampedStiffnessAt,
  tipMassRatio,
  tipMassFromDrop,
  pinnedMidMassRatio,
  cantileverTipMassExact,
  holzer,
  holzerRoots,
} from '../physics/approx';
import { sdofReceptance, toMobility, toAccelerance, modalSumFRF, halfPower } from '../physics/frf';
import {
  seismicRatio,
  seismicPhase,
  accelerometerRatio,
  usableBand,
  hammerContactDuration,
  halfSineSpectrum,
  spectrumDropFrequency,
} from '../physics/transducers';
import {
  fft,
  dft,
  windowFn,
  coherentGain,
  amplitudeSpectrum,
  aliasFrequency,
  nyquist,
  resolution,
  gcdFrequencies,
  makeRng,
  gaussian,
  simulateFRFMeasurement,
} from '../physics/dsp';

const PI = Math.PI;
const HANDOUT = "Handout 'Mode shapes for transverse vibration of uniform beams' (reader p. 91); summary notes B3 table";
const ALL_BCS: BeamBC[] = BEAM_BCS.map((b) => b.id);

/** Integral over xi in [0, 1] of f by Simpson's rule. */
const int01 = (f: (xi: number) => number, n = 2000) => simpson(f, 0, 1, n);

/** Reference DFT written independently of dsp.ts. */
function naiveDft(xr: number[], xi: number[]): { re: number[]; im: number[] } {
  const n = xr.length;
  const re: number[] = [];
  const im: number[] = [];
  for (let k = 0; k < n; k++) {
    let sr = 0;
    let si = 0;
    for (let m = 0; m < n; m++) {
      const a = (-2 * PI * ((k * m) % n)) / n;
      sr += xr[m] * Math.cos(a) - xi[m] * Math.sin(a);
      si += xr[m] * Math.sin(a) + xi[m] * Math.cos(a);
    }
    re.push(sr);
    im.push(si);
  }
  return { re, im };
}

const maxAbsDiff = (a: ArrayLike<number>, b: ArrayLike<number>) => {
  let m = 0;
  for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i] - b[i]));
  return m;
};

export const tests: SelfTest[] = [
  // ------------------------------------------------------------------------------------------
  // Beams (B3)
  // ------------------------------------------------------------------------------------------
  {
    id: 'phys-beam-roots',
    topic: 'core',
    title: 'Beam roots βᵢL for every boundary condition',
    source: `${HANDOUT}; 12-digit values from the characteristic equations`,
    run: () => {
      const cf = betaL('clamped-free', 3);
      const cc = betaL('clamped-clamped', 3);
      const ff = betaL('free-free', 3);
      const cp = betaL('clamped-pinned', 3);
      const fp = betaL('free-pinned', 3);
      const pp = betaL('pinned-pinned', 3);
      const resid = Math.max(
        ...cf.map((l) => Math.abs(Math.cos(l) + 1 / Math.cosh(l))),
        ...cc.map((l) => Math.abs(Math.cos(l) - 1 / Math.cosh(l))),
        ...cp.map((l) => Math.abs(Math.sin(l) - Math.cos(l) * Math.tanh(l)))
      );
      return [
        nearAbs('cantilever β₁L = 1.87510407', cf[0], 1.875104068712, 1e-10),
        nearAbs('cantilever β₂L = 4.69409113', cf[1], 4.694091132974, 1e-10),
        nearAbs('cantilever β₃L = 7.85475744', cf[2], 7.854757438238, 1e-10),
        nearAbs('cantilever table 1.875 / 4.694 / 7.855 (β₁L)', cf[0], 1.875, 5e-4),
        nearAbs('cantilever table β₂L = 4.694', cf[1], 4.694, 5e-4),
        nearAbs('cantilever table β₃L = 7.855', cf[2], 7.855, 5e-4),
        nearAbs('clamped–clamped β₁L = 4.73004074', cc[0], 4.730040744863, 1e-10),
        nearAbs('clamped–clamped β₂L = 7.85320462', cc[1], 7.853204624096, 1e-10),
        nearAbs('clamped–clamped β₃L = 10.99560784', cc[2], 10.995607838002, 1e-10),
        isTrue('free–free elastic roots equal clamped–clamped', maxAbsDiff(ff, cc) === 0),
        nearAbs('clamped–pinned β₁L = 3.92660231', cp[0], 3.926602312048, 1e-10),
        nearAbs('clamped–pinned β₂L = 7.06858275', cp[1], 7.068582745629, 1e-10),
        nearAbs('clamped–pinned β₃L = 10.21017612', cp[2], 10.210176122813, 1e-10),
        isTrue('free–pinned elastic roots equal clamped–pinned', maxAbsDiff(fp, cp) === 0),
        nearAbs('pinned–pinned βᵢL = iπ (i = 3)', pp[2], 3 * PI, 1e-14),
        isTrue('characteristic-equation residuals < 1e-12', resid < 1e-12, `max ${resid.toExponential(2)}`),
      ];
    },
  },
  {
    id: 'phys-beam-ratios',
    topic: 'core',
    title: 'Beam frequency ratios ω₁ : ω₂ : ω₃ (the ratio trick)',
    source: 'Summary notes B3 table',
    run: () => {
      const cf = frequencyRatios('clamped-free', 3);
      const pp = frequencyRatios('pinned-pinned', 3);
      const cc = frequencyRatios('clamped-clamped', 3);
      const ff = frequencyRatios('free-free', 3);
      const cp = frequencyRatios('clamped-pinned', 3);
      return [
        near('cantilever ω₂/ω₁ = 6.27', cf[1], 6.27, 2e-3),
        near('cantilever ω₃/ω₁ = 17.55', cf[2], 17.55, 2e-3),
        near('pinned–pinned ω₂/ω₁ = 4', pp[1], 4, 1e-12),
        near('pinned–pinned ω₃/ω₁ = 9', pp[2], 9, 1e-12),
        near('clamped–clamped ω₂/ω₁ = 2.76', cc[1], 2.76, 2e-3),
        near('clamped–clamped ω₃/ω₁ = 5.40', cc[2], 5.4, 2e-3),
        near('free–free ω₂/ω₁ = 2.76', ff[1], 2.76, 2e-3),
        near('clamped–pinned ω₂/ω₁ = 3.24', cp[1], 3.24, 2e-3),
        near('clamped–pinned ω₃/ω₁ = 6.76', cp[2], 6.76, 2e-3),
      ];
    },
  },
  {
    id: 'phys-beam-sigma',
    topic: 'core',
    title: 'Mode-shape constants C₁ = σᵢ',
    source: `${HANDOUT} (printed C₁ checked to one unit in its last digit; the handout's 1.019 is 1.018467 and its 1.00077 is 1.000777)`,
    run: () => {
      const lam = (bc: BeamBC, i: number) => betaL(bc, i)[i - 1];
      const sCF = (x: number) => (Math.sinh(x) - Math.sin(x)) / (Math.cosh(x) + Math.cos(x));
      const sCC = (x: number) => (Math.cosh(x) - Math.cos(x)) / (Math.sinh(x) - Math.sin(x));
      return [
        nearAbs('cantilever σ₁ = 0.734', sigma('clamped-free', 1), 0.734, 1e-3),
        nearAbs('cantilever σ₂ = 1.019 (exact 1.018467)', sigma('clamped-free', 2), 1.019, 1e-3),
        nearAbs('cantilever σ₃ = 0.9992', sigma('clamped-free', 3), 0.9992, 1e-4),
        nearAbs('clamped–clamped σ₁ = 0.9825', sigma('clamped-clamped', 1), 0.9825, 1e-4),
        nearAbs('clamped–clamped σ₂ = 1.00077 (exact 1.000777)', sigma('clamped-clamped', 2), 1.00077, 1e-5),
        nearAbs('free–free σ₃ = 0.999966', sigma('free-free', 3), 0.999966, 1e-6),
        nearAbs('clamped–pinned σ₁ = 1.001', sigma('clamped-pinned', 1), 1.001, 1e-3),
        nearAbs('free–pinned σ₂ = 1.000', sigma('free-pinned', 2), 1.0, 1e-3),
        near('pinned–pinned C₁ = √2', sigma('pinned-pinned', 4), Math.SQRT2, 1e-14),
        nearAbs('cantilever σ₂ = (sinh − sin)/(cosh + cos) at β₂L', sigma('clamped-free', 2), sCF(lam('clamped-free', 2)), 1e-12),
        nearAbs('clamped–clamped σ₁ = (cosh − cos)/(sinh − sin) at β₁L', sigma('clamped-clamped', 1), sCC(lam('clamped-clamped', 1)), 1e-12),
        nearAbs('clamped–pinned σ₁ = (cosh − cos)/(sinh − sin) at β₁L', sigma('clamped-pinned', 1), sCC(lam('clamped-pinned', 1)), 1e-12),
      ];
    },
  },
  {
    id: 'phys-beam-nodes',
    topic: 'core',
    title: 'Node positions (sweet spots, pin-test supports)',
    source: 'Summary notes B3 "Node positions to know" and the B3 sketching rule',
    run: () => {
      const ff1 = nodes('free-free', 1);
      const cf2 = nodes('clamped-free', 2);
      const cf3 = nodes('clamped-free', 3);
      const cc2 = nodes('clamped-clamped', 2);
      let countsOk = true;
      for (let n = 1; n <= 5; n++) {
        if (nodes('clamped-free', n).length !== n - 1) countsOk = false;
        if (nodes('free-free', n).length !== n + 1) countsOk = false;
        if (nodes('clamped-clamped', n).length !== n - 1) countsOk = false;
        if (nodes('pinned-pinned', n).length !== n - 1) countsOk = false;
      }
      return [
        nearAbs('free–free mode 1 node at 0.224L', ff1[0], 0.224, 5e-4),
        nearAbs('free–free mode 1 node at 0.776L', ff1[1], 0.776, 5e-4),
        isTrue('free–free mode 1 has exactly 2 nodes', ff1.length === 2, `found ${ff1.length}`),
        nearAbs('cantilever mode 2 node at 0.783L', cf2[0], 0.783, 1e-3),
        isTrue('cantilever mode 2 has exactly 1 node', cf2.length === 1, `found ${cf2.length}`),
        nearAbs('cantilever mode 3 node at 0.504L', cf3[0], 0.504, 1e-3),
        nearAbs('cantilever mode 3 node at 0.868L', cf3[1], 0.868, 1e-3),
        nearAbs('clamped–clamped mode 2 node at mid-span', cc2[0], 0.5, 1e-9),
        isTrue('interior node counts: cantilever n−1, free–free n+1, clamped n−1, pinned n−1 (n ≤ 5)', countsOk),
      ];
    },
  },
  {
    id: 'phys-beam-normalisation',
    topic: 'core',
    title: 'Mode normalisation ∫Y² dx = L and cantilever tip value ±2',
    source: `${HANDOUT} (normalised so that ∫Y² dx = L; summary notes B4 trap: tip value ±2)`,
    run: () => {
      let worst = 0;
      for (const bc of ALL_BCS)
        for (let i = 1; i <= 5; i++) worst = Math.max(worst, Math.abs(int01((x) => modeShape(bc, i, x) ** 2, 6000) - 1));
      const tips = [1, 2, 3, 4, 5].map((i) => modeShape('clamped-free', i, 1));
      const samples = modeShapeSamples('clamped-free', 2, 200);
      return [
        isTrue('∫₀¹ Y² dξ = 1 for modes 1–5 of all six BCs (±1e-9)', worst < 1e-9, `worst error ${worst.toExponential(2)}`),
        nearAbs('cantilever mode 1 tip Y(L) = +2', tips[0], 2, 1e-9),
        nearAbs('cantilever mode 2 tip Y(L) = −2', tips[1], -2, 1e-9),
        nearAbs('cantilever mode 5 tip |Y(L)| = 2', Math.abs(tips[4]), 2, 1e-9),
        nearAbs('free–free mode 1 end value Y(0) = 2', modeShape('free-free', 1, 0), 2, 1e-9),
        nearAbs('pinned–pinned mode 1 mid-span Y = √2', modeShape('pinned-pinned', 1, 0.5), Math.SQRT2, 1e-12),
        isTrue('modeShapeSamples has n + 1 points ending at the tip', samples.length === 201 && Math.abs(samples[200] + 2) < 1e-9),
      ];
    },
  },
  {
    id: 'phys-beam-orthogonality',
    topic: 'core',
    title: 'Orthogonality of beam modes',
    source: 'Summary notes B1 (∫ρl YᵢYⱼ dx = 0 and ∫EI Yᵢ″Yⱼ″ dx = 0)',
    run: () => {
      const d2 = (bc: BeamBC, i: number, x: number) => modeShapeDerivs(bc, i, x)[2];
      return [
        nearAbs('cantilever ∫Y₁Y₂ dξ = 0', int01((x) => modeShape('clamped-free', 1, x) * modeShape('clamped-free', 2, x)), 0, 1e-9),
        nearAbs('cantilever ∫Y₁Y₃ dξ = 0', int01((x) => modeShape('clamped-free', 1, x) * modeShape('clamped-free', 3, x)), 0, 1e-9),
        nearAbs('cantilever ∫Y₁″Y₂″ dξ = 0', int01((x) => d2('clamped-free', 1, x) * d2('clamped-free', 2, x)), 0, 1e-6),
        nearAbs('free–free ∫Y₁Y₂ dξ = 0', int01((x) => modeShape('free-free', 1, x) * modeShape('free-free', 2, x)), 0, 1e-9),
        nearAbs('free–free mode 1 ⟂ rigid translation', int01((x) => modeShape('free-free', 1, x) * rigidModeShape('free-free', 1, x)), 0, 1e-9),
        nearAbs('free–free mode 2 ⟂ rigid rotation', int01((x) => modeShape('free-free', 2, x) * rigidModeShape('free-free', 2, x)), 0, 1e-9),
        nearAbs('clamped–pinned ∫Y₁Y₂ dξ = 0', int01((x) => modeShape('clamped-pinned', 1, x) * modeShape('clamped-pinned', 2, x)), 0, 1e-9),
        nearAbs('free–pinned mode 1 ⟂ rigid rotation about the pin', int01((x) => modeShape('free-pinned', 1, x) * rigidModeShape('free-pinned', 1, x)), 0, 1e-9),
      ];
    },
  },
  {
    id: 'phys-beam-bcs',
    topic: 'core',
    title: 'Mode shapes satisfy their boundary conditions',
    source: 'Summary notes B3: clamped y = y′ = 0; pinned y = y″ = 0; free y″ = y‴ = 0',
    run: () => {
      // Each end condition as [derivative orders that vanish]; checked for modes 1–4, scaled by lambda^k.
      const ends: Record<string, number[]> = { clamped: [0, 1], pinned: [0, 2], free: [2, 3] };
      const out: CheckResult[] = [];
      for (const b of BEAM_BCS) {
        let worst = 0;
        for (let i = 1; i <= 4; i++) {
          const lam = betaL(b.id, i)[i - 1];
          for (const [xi, end] of [[0, b.left], [1, b.right]] as const) {
            const d = modeShapeDerivs(b.id, i, xi);
            for (const k of ends[end]) worst = Math.max(worst, Math.abs(d[k]) / lam ** k);
          }
        }
        out.push(isTrue(`${b.label}: end conditions hold for modes 1–4`, worst < 1e-9, `worst ${worst.toExponential(2)}`));
      }
      return out;
    },
  },
  {
    id: 'phys-beam-sections',
    topic: 'core',
    title: 'Section properties and static deflection shapes',
    source: 'Summary notes B3 "Section scaling"; LB7 Eqs 7.16–7.17',
    run: () => {
      const tube = thinTube(0.2, 0.004);
      const rect = rectangle(0.05, 0.02);
      const solid = solidCircle(0.1);
      const thick = hollowCircle(0.204, 0.196); // same mean diameter and wall as the thin tube
      const h = 1e-4;
      const fd2 = (f: (x: number) => number, x: number) => (f(x + h) - 2 * f(x) + f(x - h)) / (h * h);
      return [
        near('thin tube I/A = r²/2', tube.I / tube.A, 0.1 ** 2 / 2, 1e-12),
        near('rectangle bending across h: I/A = h²/12', rect.I / rect.A, 0.02 ** 2 / 12, 1e-12),
        near('solid circle I = πd⁴/64', solid.I, (PI * 1e-4) / 64, 1e-12),
        near('hollow circle → thin-tube I as t → 0', thick.I, tube.I, 1e-3),
        near('tip-load shape has unit tip value', cantileverTipLoadShape(1), 1, 1e-14),
        near('UDL shape has unit tip value', cantileverUdlShape(1), 1, 1e-14),
        nearAbs('tip-load shape φ″ matches finite differences', cantileverTipLoadShapeD2(0.3), fd2(cantileverTipLoadShape, 0.3), 1e-5),
        nearAbs('UDL shape φ″ matches finite differences', cantileverUdlShapeD2(0.6), fd2(cantileverUdlShape, 0.6), 1e-5),
      ];
    },
  },
  {
    id: 'phys-beam-w77',
    topic: 'core',
    title: 'Clamped–clamped machine support sized for 3× running speed',
    source: 'Tutorial W7.7(a) (reader p. 134): I/A ≈ 0.002 m², ω₂ ≈ 14.9 krpm',
    run: () => {
      const E = 200e9;
      const rho = 7800;
      const L = 3;
      const w1 = (3 * 1800 * 2 * PI) / 60;
      const bL = betaL('clamped-clamped', 1)[0];
      const IoverA = ((w1 * L * L) / (bL * bL)) ** 2 * (rho / E);
      const w1check = beamOmega(bL, E, IoverA, rho, L); // rhoA/A = rho, so pass I/A for I and rho for rhoA
      const r = frequencyRatios('clamped-clamped', 2);
      return [
        near('minimum I/A = 0.002 m²', IoverA, 0.002, 0.01),
        near('beamOmega reproduces the design ω₁ = 565.5 rad/s', w1check, w1, 1e-12),
        near('second critical speed ≈ 14.9 krpm', 5400 * r[1], 14900, 5e-3),
      ];
    },
  },
  // ------------------------------------------------------------------------------------------
  // Waves (B2)
  // ------------------------------------------------------------------------------------------
  {
    id: 'phys-wave-basics',
    topic: 'core',
    title: 'Strings, rods and shafts: frequencies, shapes and nodes',
    source: 'Summary notes B2 tables',
    run: () => {
      const c = 5000;
      const L = 2;
      const ff = waveOmegas('fixed-free', c, L, 3);
      const fx = waveOmegas('fixed-fixed', c, L, 3);
      const E = 200e9;
      const G = shearModulus(E, 0.3);
      return [
        near('fixed–free ω₁ = πc/2L', ff[0], (PI * c) / (2 * L), 1e-14),
        near('fixed–free ω₂/ω₁ = 3 (odd quarter-waves)', ff[1] / ff[0], 3, 1e-14),
        near('fixed–fixed ω₃/ω₁ = 3 (evenly spaced)', fx[2] / fx[0], 3, 1e-14),
        isTrue('free–free has a rigid mode, the others do not', hasRigidMode('free-free') && !hasRigidMode('fixed-free') && !hasRigidMode('fixed-fixed')),
        nearAbs('fixed–free mode 2 node at ξ = 2/3', waveNodes('fixed-free', 2)[0], 2 / 3, 1e-14),
        nearAbs('fixed–free mode 2 shape vanishes at its node', waveModeShape('fixed-free', 2, 2 / 3), 0, 1e-12),
        isTrue('fixed–fixed mode 3 nodes at 1/3 and 2/3', waveNodes('fixed-fixed', 3).join() === [1 / 3, 2 / 3].join()),
        nearAbs('free–free mode 1 node at mid-length', waveNodes('free-free', 1)[0], 0.5, 1e-14),
        near('G = E/2(1+ν) = 76.92 GPa for steel', G, 76.923e9, 1e-4),
        isTrue('torsional wave speed below axial (G < E)', shaftWaveSpeed(G, 7850) < rodWaveSpeed(E, 7850)),
        near('string c = √(T/ρl)', stringWaveSpeed(400, 0.01), 200, 1e-14),
      ];
    },
  },
  {
    id: 'phys-wave-endinertia',
    topic: 'core',
    title: 'Shaft with an end inertia: z tan z = Iₐ/Iₑ',
    source: 'Summary notes B2; 2021 B2.5 worked solution (Iₑ/Iₐ = 470.6 → z₁ = 0.04608); reader Sample Problem 6(b) (f₁ = 141.9 Hz)',
    run: () => {
      const Gs = 80e9;
      const rho = 7700;
      const J = polarMoment(0.05);
      const L = 0.5;
      const c = shaftWaveSpeed(Gs, rho);
      const Ia = rho * J * L;
      const kt = torsionalStiffness(Gs, J, L);
      const big = shaftEndInertiaOmegas(Gs, rho, J, L, 1000 * Ia, 1)[0];
      const small = shaftEndInertiaOmegas(Gs, rho, J, L, Ia / 1e4, 1)[0];
      const z = endInertiaRoots(2.5, 4);
      const resid = Math.max(...z.map((x) => Math.abs(x * Math.tan(x) - 2.5)));
      const sp6 = shaftEndInertiaOmegas(80e9, 7700, 1e-4, 0.5, 20, 1)[0] / (2 * PI);
      return [
        near('large end inertia (Iₐ/Iₑ = 0.001): ω₁ → √(kₜ/Iₑ)', big, Math.sqrt(kt / (1000 * Ia)), 5e-4),
        near('small end inertia (Iₐ/Iₑ = 10⁴): ω₁ → πc/2L (fixed–free)', small, (PI * c) / (2 * L), 5e-4),
        near('2021 B2.5: Iₑ/Iₐ = 470.6 gives z₁ = 0.04608', endInertiaRoots(1 / 470.6, 1)[0], 0.04608, 5e-4),
        near('Sample Problem 6(b): f₁ = 141.9 Hz', sp6, 141.9, 1e-3),
        isTrue('roots satisfy z tan z = 2.5 (residual < 1e-10)', resid < 1e-10, `max ${resid.toExponential(2)}`),
        isTrue('one root per interval ((k−1)π, (k−1)π + π/2)', z.every((x, k) => x > k * PI && x < k * PI + PI / 2)),
        near('ratio → ∞ recovers fixed–free 3π/2', endInertiaRoots(Infinity, 2)[1], (3 * PI) / 2, 1e-14),
        near('tube J = π(d₀⁴ − dᵢ⁴)/32', polarMomentTube(0.05, 0.03), polarMoment(0.05) - polarMoment(0.03), 1e-12),
      ];
    },
  },
  {
    id: 'phys-wave-string',
    topic: 'core',
    title: 'Plucked and lightly touched strings',
    source: 'Summary notes B2 (plucking at a node; touching imposes a node)',
    run: () => {
      const mid = pluckAmplitudes(0.5, 6);
      const a = 0.3;
      const b = pluckAmplitudes(a, 4000);
      let apex = 0;
      for (let i = 0; i < b.length; i++) apex += b[i] * Math.sin((i + 1) * PI * a);
      return [
        nearAbs('midpoint pluck: b₂ = 0', mid[1], 0, 1e-15),
        nearAbs('midpoint pluck: b₄ = 0', mid[3], 0, 1e-15),
        nearAbs('midpoint pluck: b₆ = 0', mid[5], 0, 1e-15),
        near('midpoint pluck: b₁ = 8/π²', mid[0], 8 / (PI * PI), 1e-12),
        nearAbs('Fourier series rebuilds the unit apex at ξ = 0.3', apex, 1, 2e-4),
        isTrue('touching at L/3 keeps only multiples of 3', touchedHarmonics(1 / 3, 12).join() === '3,6,9,12', touchedHarmonics(1 / 3, 12).join()),
        isTrue('touching at L/2 keeps only even harmonics (the octave)', touchedHarmonics(0.5, 8).join() === '2,4,6,8'),
      ];
    },
  },
  {
    id: 'phys-wave-tension',
    topic: 'core',
    title: 'Variable tension: rotating cable and swinging weight; rod as a SDOF',
    source: 'Summary notes B2',
    run: () => {
      const Om = 10;
      const m = 2;
      const rl = 0.5;
      const l = 3;
      const g = 9.81;
      const th0 = 0.4;
      const E = 70e9;
      const A = 1e-4;
      const L = 1.5;
      const rho = 2700;
      const sd = rodEquivalentSdof(E, A, L, rho * A * L);
      return [
        near('rotating cable T(l) = Ω²ml at the mass', rotatingCableTension(l, Om, m, rl, l), Om * Om * m * l, 1e-14),
        near('rotating cable T(0) = Ω²(ml + ρl l²/2) at the hub', rotatingCableTension(0, Om, m, rl, l), Om * Om * (m * l + (rl * l * l) / 2), 1e-14),
        near('swing tension at the bottom = mg(3 − 2cos θ₀)', swingTension(m, 0, th0), m * g * (3 - 2 * Math.cos(th0)), 1e-14),
        near('swing tension at the extreme = mg cos θ₀', swingTension(m, th0, th0), m * g * Math.cos(th0), 1e-14),
        near('rod SDOF: √(k/meq) = πc/2L', Math.sqrt(sd.k / sd.meq), (PI * rodWaveSpeed(E, rho)) / (2 * L), 1e-12),
      ];
    },
  },
  // ------------------------------------------------------------------------------------------
  // Forced response (B4)
  // ------------------------------------------------------------------------------------------
  {
    id: 'phys-forced-static',
    topic: 'core',
    title: 'Modal sum reproduces static deflections (Ω → 0)',
    source: 'Summary notes B4 (aᵢ formula); beam tables PL³/3EI and PL³/48EI',
    run: () => {
      const P = 1000;
      const L = 2;
      const EI = 5e5;
      const rhoA = 20;
      const tip3 = beamResponse({ bc: 'clamped-free', x: 1, xe: 1, Omega: 1e-9, P, L, EI, rhoA, nModes: 3 });
      const tip10 = beamResponse({ bc: 'clamped-free', x: 1, xe: 1, Omega: 1e-9, P, L, EI, rhoA, nModes: 10 });
      const mid = beamResponse({ bc: 'pinned-pinned', x: 0.5, xe: 0.5, Omega: 1e-9, P, L, EI, rhoA, nModes: 5 });
      const cantStatic = (P * L ** 3) / (3 * EI);
      return [
        near('cantilever tip, 3 modes: PL³/3EI within 0.5%', tip3.y, cantStatic, 5e-3),
        near('cantilever tip, 10 modes: PL³/3EI within 0.01%', tip10.y, cantStatic, 1e-4),
        near('pinned mid-span, 5 modes: PL³/48EI within 0.1%', mid.y, (P * L ** 3) / (48 * EI), 1e-3),
        nearAbs('force at mid-span of a pinned beam: a₂ = 0', mid.a[1] / mid.a[0], 0, 1e-12),
        nearAbs('force at mid-span of a pinned beam: a₄ = 0', mid.a[3] / mid.a[0], 0, 1e-12),
        isTrue('no rigid-body part for a cantilever', tip3.yRigid === 0 && tip3.aRigid.length === 0),
      ];
    },
  },
  {
    id: 'phys-forced-w76',
    topic: 'core',
    title: 'Forced cantilever at Ω = ω₁/10',
    source: 'Tutorial W7.6(b) (reader p. 133): tip ≈ 0.337 PL³/EI, mode 1 largest',
    run: () => {
      const P = 1;
      const L = 1;
      const EI = 1;
      const rhoA = 1;
      const w1 = beamOmega(betaL('clamped-free', 1)[0], EI, 1, rhoA, L);
      const r = beamResponse({ bc: 'clamped-free', x: 1, xe: 1, Omega: w1 / 10, P, L, EI, rhoA, nModes: 3 });
      const a1 = modalAmplitude({ bc: 'clamped-free', i: 1, xe: 1, Omega: w1 / 10, omega_i: w1, P, L, EI });
      return [
        near('tip amplitude ≈ 0.337 PL³/EI', r.y, 0.337, 5e-3),
        near('modalAmplitude matches beamResponse for mode 1', a1, r.a[0], 1e-14),
        isTrue('mode 1 gives > 95% of the tip response', (r.a[0] * 2) / r.y > 0.95, `share ${((r.a[0] * 2) / r.y).toFixed(4)}`),
        isTrue('higher modes are much stiffer: |a₂| < |a₁|/30', Math.abs(r.a[1]) < Math.abs(r.a[0]) / 30),
      ];
    },
  },
  {
    id: 'phys-forced-misc',
    topic: 'core',
    title: 'Dynamic factor, unbalance force and rigid-body response',
    source: 'Summary notes B4',
    run: () => {
      const P = 10;
      const L = 1;
      const EI = 1e4;
      const rhoA = 5;
      const Om = 0.01 * beamOmega(betaL('free-free', 1)[0], EI, 1, rhoA, L);
      const ff = beamResponse({ bc: 'free-free', x: 0, xe: 1, Omega: Om, P, L, EI, rhoA, nModes: 3 });
      const rigid = (-P / (rhoA * L * Om * Om)) * (1 + 3 * (2 * 1 - 1) * (2 * 0 - 1));
      return [
        near('dynamic factor below resonance', dynamicFactor(0.5, 1), 4 / 3, 1e-14),
        isTrue('dynamic factor negative (out of phase) above resonance', dynamicFactor(2, 1) < 0),
        near('unbalance force P = meΩ²', unbalanceForce(0.1, 0.02, 300), 0.1 * 0.02 * 9e4, 1e-14),
        near('free–free beam far below ω₁ moves as a rigid body', ff.y, rigid, 1e-3),
        isTrue('free–free reports two rigid-body amplitudes', ff.aRigid.length === 2),
      ];
    },
  },
  // ------------------------------------------------------------------------------------------
  // Approximate methods (B5)
  // ------------------------------------------------------------------------------------------
  {
    id: 'phys-approx-rayleigh-shapes',
    topic: 'core',
    title: 'Rayleigh estimates from the LB7 trial shapes',
    source: 'LB7 (reader pp. 115–116): tip mass equal to beam mass gives ω² = c EI/((M + m ρl L) L³) with (3.04, 0.227), (3.2, 0.257), (3, 0.236)',
    run: () => {
      const L = 1;
      const EI = 1;
      const rhoA = 1;
      const [tip, udl, sq, cosS] = TRIAL_SHAPES.cantilever;
      const [sinS, par, midS] = TRIAL_SHAPES.pinned;
      const exact = betaL('clamped-free', 1)[0] ** 2;
      const tipM = [{ x: L, M: rhoA * L }];
      const est = TRIAL_SHAPES.cantilever.map((s) => rayleighFromTrial(s, L, EI, rhoA));
      return [
        near('tip-load shape: ω₁ = 3.5675 √(EI/ρlL⁴)', est[0], Math.sqrt(3 / (33 / 140)), 1e-9),
        near('UDL shape: ω₁ = 3.5301 √(EI/ρlL⁴)', est[1], Math.sqrt(3.2 / 0.25679012), 1e-6),
        near('ξ² shape: ω₁ = √20', est[2], Math.sqrt(20), 1e-9),
        near('1 − cos shape: ω₁ = 3.6639', est[3], 3.66386, 1e-4),
        ascending('every estimate is above the exact 3.5160', [exact, Math.min(...est)], ['exact', 'min Rayleigh']),
        near('M = ρlL, 1 − cos shape: ω² = 3.04/(1.227)', rayleighFromTrial(cosS, L, EI, rhoA, tipM) ** 2, 3.04 / 1.227, 3e-3),
        near('M = ρlL, UDL shape: ω² = 3.2/(1.257)', rayleighFromTrial(udl, L, EI, rhoA, tipM) ** 2, 3.2 / 1.257, 3e-3),
        near('M = ρlL, tip-load shape: ω² = 3/(1.236)', rayleighFromTrial(tip, L, EI, rhoA, tipM) ** 2, 3 / 1.236, 3e-3),
        near('pinned sin(πξ) is exact: ω₁ = π²', rayleighFromTrial(sinS, L, EI, rhoA), PI * PI, 1e-9),
        near('pinned parabola: ω₁ = √120', rayleighFromTrial(par, L, EI, rhoA), Math.sqrt(120), 1e-9),
        near('pinned mid-load shape: ω₁ = 9.941', rayleighFromTrial(midS, L, EI, rhoA), Math.sqrt(48 / 0.48571429), 1e-6),
        isTrue('geometric BCs flagged for every trial shape', [...TRIAL_SHAPES.cantilever, ...TRIAL_SHAPES.pinned].every((s) => s.geometricBCs)),
        isTrue('ξ² misses the natural BCs; the UDL shape satisfies them', !sq.naturalBCs && udl.naturalBCs),
      ];
    },
  },
  {
    id: 'phys-approx-bounds',
    topic: 'core',
    title: 'Dunkerley ≤ exact ≤ Rayleigh: cantilever with a tip mass',
    source: 'Summary notes B5 (order of estimates; tip-mass ratio); LB8 example 10.5',
    run: () => {
      const L = 1.2;
      const EI = 3e4;
      const rhoA = 8;
      const w11 = beamOmega(betaL('clamped-free', 1)[0], EI, 1, rhoA, L);
      const out: CheckResult[] = [];
      for (const mu of [0.1, 1, 5]) {
        const M = mu * rhoA * L;
        const D = dunkerley([w11, Math.sqrt(cantileverStiffnessAt(L, EI) / M)]);
        const X = cantileverTipMassExact(M, rhoA, L, EI);
        const R = rayleighOmega({
          L,
          EI,
          rhoA,
          phi: (x) => cantileverTipLoadShape(x / L),
          phi2: (x) => cantileverTipLoadShapeD2(x / L) / (L * L),
          masses: [{ x: L, M }],
        });
        out.push(ascending(`M/ρlL = ${mu}: Dunkerley ≤ exact ≤ Rayleigh`, [D, X, R], ['D', 'exact', 'R']));
        out.push(near(`M/ρlL = ${mu}: tipMassRatio × ω₁₁ = Dunkerley (1.875 vs 1.8751)`, tipMassRatio(M, rhoA, L) * w11, D, 1e-3));
      }
      return out;
    },
  },
  {
    id: 'phys-approx-tipmass',
    topic: 'core',
    title: 'Exact cantilever tip-mass frequency and tip mass from a measured drop',
    source: 'Tutorial W7.6(c), (e) (reader p. 133): ω₁ falls 9× → M/ρlL ≈ 19.4 (exact 19.42); summary notes B5',
    run: () => {
      const L = 0.5;
      const EI = 200;
      const rhoA = 0.3;
      const s = Math.sqrt(EI / (rhoA * L ** 4));
      const w11 = betaL('clamped-free', 1)[0] ** 2 * s;
      const big = 1000 * rhoA * L;
      const M5 = tipMassFromDrop(0.05, rhoA, L);
      return [
        near('M → 0 gives β₁L = 1.8751', Math.sqrt(cantileverTipMassExact(1e-12, rhoA, L, EI) / s), 1.875104069, 1e-9),
        near('large M → √(3EI/(L³(M + 0.2357ρlL)))', cantileverTipMassExact(big, rhoA, L, EI), Math.sqrt((3 * EI) / (L ** 3 * (big + (33 / 140) * rhoA * L))), 1e-5),
        near('W7.6(c): a 9× drop needs M ≈ 19.4 ρlL (Dunkerley)', tipMassFromDrop(1 - 1 / 9, rhoA, L) / (rhoA * L), 19.42, 1e-3),
        near('W7.6(e): exact M = 19.42 ρlL gives ω₁/ω₁₁ = 1/9', cantileverTipMassExact(19.42 * rhoA * L, rhoA, L, EI) / w11, 1 / 9, 1e-3),
        near('5% drop round trip through tipMassRatio', tipMassRatio(M5, rhoA, L), 0.95, 1e-12),
      ];
    },
  },
  {
    id: 'phys-approx-stiffness',
    topic: 'core',
    title: 'Point stiffness for Dunkerley; pinned and clamped beams with a central mass',
    source: 'Summary notes B5; tutorial W7.8(a) (reader p. 134): machine mass ≈ 68 kg',
    run: () => {
      const EI = 1;
      const L = 1;
      const rhoA = 1;
      const N = 2;
      const w0 = PI * PI;
      const R = rayleighOmega({ L, EI, rhoA, phi: (x) => Math.sin(PI * x), phi2: (x) => -PI * PI * Math.sin(PI * x), masses: [{ x: 0.5, M: N * rhoA * L }] });
      // W7.8(a): clamped–clamped steel beam, L = 3 m, A = 1.36e-2 m^2 (W7.7b), resonance 20% low.
      const rA = 7800 * 1.36e-2;
      const EIs = 200e9 * 2.72e-5;
      const w11 = beamOmega(betaL('clamped-clamped', 1)[0], EIs, 1, rA, 3);
      const k = clampedStiffnessAt(1.5, 3, EIs);
      const Mm = (1 / 0.8 ** 2 - 1) * (k / (w11 * w11));
      return [
        near('cantilever tip stiffness 3EI/L³', cantileverStiffnessAt(2, 6), 2.25, 1e-14),
        near('pinned mid-span stiffness 48EI/L³', pinnedStiffnessAt(1, 2, 3), (48 * 3) / 8, 1e-14),
        near('clamped mid-span stiffness 192EI/L³', clampedStiffnessAt(1, 2, 3), (192 * 3) / 8, 1e-14),
        near('pinned + mid mass N = 2: ω/ω₀ = 1/√5', R / w0, pinnedMidMassRatio(N), 1e-9),
        near('W7.8(a): Dunkerley machine mass ≈ 68 kg', Mm, 68, 0.02),
        near('Dunkerley with one term returns it', dunkerley([123]), 123, 1e-14),
      ];
    },
  },
  {
    id: 'phys-approx-holzer',
    topic: 'core',
    title: "Holzer's method on torsional chains",
    source: 'LB8 Eqs 8.4–8.6; two-disc result ω² = k(J₁ + J₂)/(J₁J₂)',
    run: () => {
      const J1 = 2;
      const J2 = 5;
      const k = 3e4;
      const two = holzerRoots([J1, J2], [k], 500);
      const wExact = Math.sqrt((k * (J1 + J2)) / (J1 * J2));
      const three = holzerRoots([1, 1, 1], [1, 1], 2.5);
      const fixed = holzerRoots([4], [100], 20, 'fixed');
      const fixed2 = holzerRoots([1, 1], [1, 1], 2, 'fixed'); // wall–k–J–k–J: ω² = (3 ∓ √5)/2
      const at = holzer([J1, J2], [k], wExact);
      return [
        isTrue('two discs: exactly 2 roots below 500 rad/s', two.length === 2, `found ${two.length}`),
        nearAbs('two discs: rigid-body root ω = 0', two[0], 0, 0),
        near('two discs: ω = √(k(J₁ + J₂)/(J₁J₂))', two[1], wExact, 1e-10),
        near('two discs: mode shape θ₂/θ₁ = −J₁/J₂', at.theta[1], -J1 / J2, 1e-9),
        nearAbs('residual vanishes at the root (relative to J₁ω²)', at.residual / (J1 * wExact ** 2), 0, 1e-9),
        near('three equal discs: ω₂ = √(k/J)', three[1], 1, 1e-10),
        near('three equal discs: ω₃ = √(3k/J)', three[2], Math.sqrt(3), 1e-10),
        near('one disc on a wall shaft (fixed): ω = √(k/J)', fixed[0], 5, 1e-10),
        near('fixed chain of two: ω₁² = (3 − √5)/2', fixed2[0] ** 2, (3 - Math.sqrt(5)) / 2, 1e-9),
        near('fixed chain of two: ω₂² = (3 + √5)/2', fixed2[1] ** 2, (3 + Math.sqrt(5)) / 2, 1e-9),
        isTrue('fixed chain has no ω = 0 root', fixed2.length === 2 && fixed2[0] > 0.1),
      ];
    },
  },
  // ------------------------------------------------------------------------------------------
  // FRFs (C2)
  // ------------------------------------------------------------------------------------------
  {
    id: 'phys-frf-sdof',
    topic: 'core',
    title: 'SDOF receptance, mobility and accelerance',
    source: 'Summary notes C2 (k = 1/|H(0)|, |H|max ≈ 1/2ζk, phase −90° at ωn)',
    run: () => {
      const k = 4e4;
      const m = 10;
      const zeta = 0.05;
      const wn = Math.sqrt(k / m);
      const c = 2 * zeta * Math.sqrt(k * m);
      const H0 = sdofReceptance(k, m, c, 0);
      const Hn = sdofReceptance(k, m, c, wn);
      const mob = toMobility(Hn, wn);
      const acc = toAccelerance(Hn, wn);
      const modal = modalSumFRF([{ wn, zeta, phi: [1 / Math.sqrt(m)] }], 0, 0, 0.7 * wn);
      const direct = sdofReceptance(k, m, c, 0.7 * wn);
      return [
        near('H(0) = 1/k', H0.re, 1 / k, 1e-14),
        near('|H(ωn)| = 1/(2ζk)', cabs(Hn), 1 / (2 * zeta * k), 1e-12),
        near('phase at ωn = −90°', carg(Hn), -PI / 2, 1e-12),
        near('mobility at ωn is real: 1/c', mob.re, 1 / c, 1e-12),
        near('|accelerance| = ω²|H|', cabs(acc), wn * wn * cabs(Hn), 1e-12),
        nearAbs('modal sum with φ = 1/√m equals the SDOF receptance', cabs(csub(modal, direct)) / cabs(direct), 0, 1e-12),
      ];
    },
  },
  {
    id: 'phys-frf-halfpower',
    topic: 'core',
    title: 'Half-power damping from a synthetic FRF',
    source: 'Summary notes C2: ζ = (ω₂ − ω₁)/(2ωn) at |H|max/√2',
    run: () => {
      const k = 1e5;
      const m = 2;
      const zeta = 0.02;
      const wn = Math.sqrt(k / m);
      const c = 2 * zeta * Math.sqrt(k * m);
      const ws: number[] = [];
      const mags: number[] = [];
      for (let i = 0; i <= 4000; i++) {
        const w = wn * (0.5 + i / 4000);
        ws.push(w);
        mags.push(cabs(sdofReceptance(k, m, c, w)));
      }
      const hp = halfPower(ws, mags);
      return [
        near('recovers ζ = 0.02 within 2%', hp.zeta, zeta, 0.02),
        near('peak frequency ≈ ωn (within 0.1%)', hp.wn, wn, 1e-3),
        near('peak ≈ 1/(2ζk) (within 1%)', hp.peak, 1 / (2 * zeta * k), 0.01),
        ascending('ω₁ < ωn < ω₂', [hp.w1, hp.wn, hp.w2], ['ω₁', 'ωn', 'ω₂']),
      ];
    },
  },
  // ------------------------------------------------------------------------------------------
  // Transducers (C1)
  // ------------------------------------------------------------------------------------------
  {
    id: 'phys-trans-seismic',
    topic: 'core',
    title: 'Seismic instrument: accelerometer and vibrometer ratios',
    source: 'Summary notes C1; LC1-5 and LC1-6',
    run: () => [
      near('accelerometer ratio → 1 as β → 0', accelerometerRatio(1e-4, 0.3), 1, 1e-6),
      near('vibrometer ratio → 1 as β → ∞', seismicRatio(1e3, 0.3), 1, 1e-5),
      near('accelerometer ratio at β = 1 is 1/(2ζ)', accelerometerRatio(1, 0.1), 5, 1e-12),
      near('relative-motion phase at β = 1 is 90°', seismicPhase(1, 0.2), PI / 2, 1e-12),
      near('seismicRatio(β) = β² · accelerometerRatio(β)', seismicRatio(0.4, 0.2), 0.16 * accelerometerRatio(0.4, 0.2), 1e-14),
    ],
  },
  {
    id: 'phys-trans-band',
    topic: 'core',
    title: 'Usable frequency band of an accelerometer and a vibrometer',
    source: 'Summary notes C1 (small mass and stiff spring give a wide flat range; damping ≈ 0.7 flattens it)',
    run: () => {
      const b0 = usableBand(0, 0.05, 'accelerometer');
      const b7 = usableBand(0.7, 0.05, 'accelerometer');
      const v0 = usableBand(0, 0.05, 'vibrometer');
      return [
        near('ζ = 0, 5% tolerance: β_max ≈ 0.218', b0, 0.218218, 1e-5),
        near('at β_max the error is exactly 5%', accelerometerRatio(b0, 0), 1.05, 1e-12),
        near('ζ = 0.7, 5% tolerance: β_max ≈ 0.591', b7, 0.591009, 1e-5),
        isTrue('ζ = 0.7 band is much wider (> 2.5×)', b7 > 2.5 * b0, `${b7.toFixed(3)} vs ${b0.toFixed(3)}`),
        near('ζ = 0.7: the ratio has fallen 5% at β_max', accelerometerRatio(b7, 0.7), 0.95, 1e-12),
        near('vibrometer ζ = 0: β_min = 1/0.218 = 4.58', v0, 1 / b0, 1e-12),
        near('vibrometer ratio at β_min is 1.05', seismicRatio(v0, 0), 1.05, 1e-12),
      ];
    },
  },
  {
    id: 'phys-trans-hammer',
    topic: 'core',
    title: 'Impact hammer: contact time and half-sine force spectrum',
    source: 'Summary notes C1; LC1-3 and LC1-4 (useful range to a 10–20 dB drop); Week 11 Q1 (τ ≈ π√(m/k))',
    run: () => {
      const tau = 0.5e-3;
      const f20 = spectrumDropFrequency(tau, 20);
      const f10 = spectrumDropFrequency(tau, 10);
      const direct = (f: number) => Math.abs(Math.cos(PI * f * tau) / (1 - (2 * f * tau) ** 2));
      const fNear = (1 - 0.9e-6) / (2 * tau); // inside the series branch, |1 - 2fτ| < 1e-6
      return [
        near('spectrum is 1 at DC', halfSineSpectrum(0, tau), 1, 1e-14),
        near('continuous at fτ = 1/2: value π/4', halfSineSpectrum(0.5 / tau, tau), PI / 4, 1e-12),
        nearAbs('series branch near fτ = 1/2 matches the direct formula', halfSineSpectrum(fNear, tau) - direct(fNear), 0, 1e-9),
        nearAbs('first zero at f = 1.5/τ', halfSineSpectrum(1.5 / tau, tau), 0, 1e-14),
        isTrue('no zero before 1.5/τ', halfSineSpectrum(1.45 / tau, tau) > 0.005),
        near('−20 dB point found correctly', 20 * Math.log10(halfSineSpectrum(f20, tau)), -20, 1e-9),
        ascending('−10 dB point comes before −20 dB and before the zero', [f10, f20, 1.5 / tau]),
        near('contact time τ = π√(m/k)', hammerContactDuration(0.1, 1e7), PI * Math.sqrt(1e-8), 1e-14),
        near('equal structure and tip stiffness lengthen τ by √2', hammerContactDuration(0.1, 1e7, 1e7), Math.SQRT2 * PI * Math.sqrt(1e-8), 1e-12),
      ];
    },
  },
  // ------------------------------------------------------------------------------------------
  // DSP (C3)
  // ------------------------------------------------------------------------------------------
  {
    id: 'phys-dsp-fft',
    topic: 'core',
    title: 'FFT and arbitrary-length DFT against a direct sum',
    source: 'LC3 Eq 3.3 (DFT definition)',
    run: () => {
      const rng = makeRng(7);
      const mk = (n: number) => Array.from({ length: n }, () => gaussian(rng));
      const out: CheckResult[] = [];
      for (const n of [30, 64, 100, 250]) {
        const xr = mk(n);
        const xi = mk(n);
        const ref = naiveDft(xr, xi);
        const got = dft(xr, xi);
        const err = Math.max(maxAbsDiff(got.re, ref.re), maxAbsDiff(got.im, ref.im));
        out.push(isTrue(`N = ${n}: dft matches the direct sum (< 1e-9)`, err < 1e-9, `max error ${err.toExponential(2)}`));
      }
      const re = Float64Array.from(mk(256));
      const im = new Float64Array(256);
      let e0 = 0;
      for (const v of re) e0 += v * v;
      fft(re, im);
      let e1 = 0;
      for (let i = 0; i < 256; i++) e1 += re[i] * re[i] + im[i] * im[i];
      out.push(near('Parseval: Σ|X|² = N Σ|x|²', e1, 256 * e0, 1e-12));
      return out;
    },
  },
  {
    id: 'phys-dsp-sampling',
    topic: 'core',
    title: 'Sampling: aliasing, Nyquist, resolution and on-line tones',
    source: '2025 A3.2 (135 Hz at 250 samples/s; 0.2 Hz in 8 s); 2024 A3.2 (gcd of 10, 13, 30 Hz = 1 Hz); summary notes C3',
    run: () => [
      near('135 Hz sampled at 250 Hz aliases to 115 Hz', aliasFrequency(135, 250), 115, 1e-14),
      near('260 Hz at 250 Hz aliases to 10 Hz', aliasFrequency(260, 250), 10, 1e-12),
      near('a tone below fs/2 is unchanged', aliasFrequency(60, 250), 60, 1e-14),
      near('Nyquist fs/2 = 125 Hz', nyquist(250), 125, 1e-14),
      near('8 s record: Δf = 0.125 Hz (so 0.2 Hz is resolvable)', resolution(8), 0.125, 1e-14),
      near('gcd(30, 45, 75 Hz) = 15 Hz', gcdFrequencies([30, 45, 75]), 15, 1e-14),
      near('2024 A3.2: gcd(10, 13, 30 Hz) = 1 Hz', gcdFrequencies([10, 13, 30]), 1, 1e-14),
      near('gcd(12.5, 20 Hz) = 2.5 Hz', gcdFrequencies([12.5, 20]), 2.5, 1e-14),
    ],
  },
  {
    id: 'phys-dsp-spectrum',
    topic: 'core',
    title: 'Amplitude spectrum, windows and leakage',
    source: 'Summary notes C3 (leakage; window, then correct the amplitude); LC3-4',
    run: () => {
      const fs = 1000;
      const N = 1000; // T = 1 s, Δf = 1 Hz, not a power of 2
      const tone = (f: number, A = 1) => Array.from({ length: N }, (_, n) => A * Math.cos((2 * PI * f * n) / fs + 0.3));
      const on = tone(50);
      const off = tone(50.5);
      const rect = amplitudeSpectrum(on, fs, 'rect');
      const hann = amplitudeSpectrum(on, fs, 'hann');
      const flat = amplitudeSpectrum(on, fs, 'flattop');
      const leak = amplitudeSpectrum(off, fs, 'rect');
      const flatOff = amplitudeSpectrum(off, fs, 'flattop');
      const lines = rect.f.length;
      return [
        near('line spacing Δf = fs/N = 1 Hz', rect.f[1] - rect.f[0], 1, 1e-12),
        isTrue('N/2 + 1 lines from DC to Nyquist', lines === 501),
        near('on-line tone, rect: amplitude 1', rect.amp[50], 1, 1e-9),
        nearAbs('on-line tone, rect: neighbour line empty', rect.amp[52], 0, 1e-9),
        near('on-line tone, Hann (amplitude corrected): 1', hann.amp[50], 1, 1e-9),
        near('on-line tone, flat-top (amplitude corrected): 1', flat.amp[50], 1, 1e-9),
        near('Hann coherent gain = 0.5', coherentGain(windowFn('hann', 64)), 0.5, 1e-12),
        isTrue('off-line tone (50.5 Hz), rect: peak line underestimates (< 0.7)', leak.amp[50] < 0.7, leak.amp[50].toFixed(3)),
        isTrue('off-line tone, rect: leaks into lines 48 and 53 (> 0.1 each)', leak.amp[48] > 0.1 && leak.amp[53] > 0.1, `${leak.amp[48].toFixed(3)}, ${leak.amp[53].toFixed(3)}`),
        near('off-line tone, flat-top reads the amplitude within 0.5%', Math.max(flatOff.amp[50], flatOff.amp[51]), 1, 5e-3),
      ];
    },
  },
  {
    id: 'phys-dsp-frf-noise',
    topic: 'core',
    title: 'H₁, H₂ and coherence from noisy averaged measurements',
    source: 'Summary notes C3; LC3-8 (H₁ assumes output noise, H₂ input noise; coherence ∈ [0, 1])',
    run: () => {
      const Htrue: C = { re: 0.6, im: -0.8 };
      const base = { H: () => Htrue, freqs: [1, 2, 3, 4], nAvg: 2000, seed: 42 };
      const err = (H: C[]) => H.reduce((s, h) => s + cabs(csub(cdiv(h, Htrue), { re: 1, im: 0 })), 0) / H.length;
      const clean = simulateFRFMeasurement({ ...base, inputNoise: 0, outputNoise: 0 });
      const outN = simulateFRFMeasurement({ ...base, inputNoise: 0, outputNoise: 0.5 });
      const inN = simulateFRFMeasurement({ ...base, inputNoise: 0.5, outputNoise: 0 });
      const again = simulateFRFMeasurement({ ...base, inputNoise: 0, outputNoise: 0.5 });
      const minCoh = Math.min(...clean.coherence);
      return [
        nearAbs('no noise: coherence = 1', minCoh, 1, 1e-12),
        nearAbs('no noise: H₁ = H', err(clean.H1), 0, 1e-12),
        nearAbs('no noise: H₂ = H', err(clean.H2), 0, 1e-12),
        isTrue('output noise only: H₁ unbiased (< 3% error)', err(outN.H1) < 0.03, err(outN.H1).toFixed(4)),
        isTrue('output noise only: H₂ biased high (≈ +25%)', err(outN.H2) > 0.15, err(outN.H2).toFixed(4)),
        isTrue('input noise only: H₂ unbiased (< 3% error)', err(inN.H2) < 0.03, err(inN.H2).toFixed(4)),
        isTrue('input noise only: H₁ biased low (≈ −20%)', err(inN.H1) > 0.12, err(inN.H1).toFixed(4)),
        isTrue('noise lowers the coherence (< 0.9)', Math.max(...outN.coherence, ...inN.coherence) < 0.9),
        isTrue('same seed gives the same measurement', again.H2[2].re === outN.H2[2].re && again.coherence[1] === outN.coherence[1]),
      ];
    },
  },
];
