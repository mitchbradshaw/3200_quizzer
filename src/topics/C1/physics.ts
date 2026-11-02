// Extra pure functions for topic C1 (transducers and excitation). SI units; frequencies in Hz unless named w.
// The core models live in src/physics/transducers.ts (seismicRatio, accelerometerRatio, usableBand,
// hammerContactDuration, halfSineSpectrum, spectrumDropFrequency); these helpers only add what the
// simulations and generators need on top.
import { accelerometerRatio, seismicPhase, seismicRatio } from '../../physics/transducers';

export const G = 9.81;
export const TAU = 2 * Math.PI;

/** dB (20 log10 of an amplitude ratio) to the amplitude ratio: −10 dB → 0.316, −20 dB → 0.1 (LC1-3). */
export const dbToRatio = (db: number): number => 10 ** (db / 20);

/** Amplitude ratio to dB, 20 log10(x). */
export const ratioToDb = (x: number): number => 20 * Math.log10(x);

/** Half-sine impact pulse F(t) = F0 sin(pi t/tau) on [0, tau] with impulse I, so F0 = pi I/(2 tau). */
export function halfSinePulse(t: number, tau: number, impulse: number): number {
  if (t < 0 || t > tau) return 0;
  return ((Math.PI * impulse) / (2 * tau)) * Math.sin((Math.PI * t) / tau);
}

/** Peak force of a half-sine pulse of duration tau carrying impulse I: F0 = pi I/(2 tau). */
export const halfSinePeak = (tau: number, impulse: number): number => (Math.PI * impulse) / (2 * tau);

/** The half-sine spectrum is 10 dB down at f tau = 1.0194 and 20 dB down at f tau = 1.3033 (first zero 1.5). */
export const HALF_SINE_10DB = 1.0193658501136902;
export const HALF_SINE_20DB = 1.3032806208018357;

/**
 * Coherence when uncorrelated noise sits SNR dB below the signal (both in 20 log10 amplitude dB):
 * gamma^2 = 1/(1 + r), r = noise power/signal power = 10^(-SNR/10) (LC3 Eq 3.9; Week 12 Q5 noise model).
 */
export const coherenceFromSnrDb = (snrDb: number): number => 1 / (1 + 10 ** (-snrDb / 10));

/** Accelerometer amplitude error (reading/true − 1) at frequency ratio beta and damping zeta. */
export const accelError = (beta: number, zeta: number): number => accelerometerRatio(beta, zeta) - 1;

/** Vibrometer amplitude error (z0/y0 − 1). */
export const vibroError = (beta: number, zeta: number): number => seismicRatio(beta, zeta) - 1;

/**
 * Closed-form upper band edge of a well-damped accelerometer (zeta >= 0.65, so the response never rises by
 * more than 1.3 %): the ratio has fallen to 1 − eps where beta^2 = b + sqrt(b^2 + c), b = 1 − 2 zeta^2,
 * c = 1/(1 − eps)^2 − 1. Matches usableBand(zeta, eps, 'accelerometer') whenever eps exceeds the overshoot.
 */
export function dampedBandEdge(zeta: number, eps: number): number {
  const b = 1 - 2 * zeta * zeta;
  const c = 1 / (1 - eps) ** 2 - 1;
  return Math.sqrt(b + Math.sqrt(b * b + c));
}

/**
 * Normalised steady-state traces for the seismic-instrument animation at phase theta of the case motion
 * y = Y sin(theta). Returns the true quantity and the instrument's reading, both divided by their amplitude:
 * accelerometer: true = y''/(w^2 Y) = −sin(theta), reading = −wn^2 z/(w^2 Y) = −A(beta) sin(theta − phi);
 * vibrometer:    true = y/Y = sin(theta),            reading = −z/Y = −beta^2 A(beta) sin(theta − phi).
 */
export function seismicTraces(theta: number, beta: number, zeta: number, kind: 'accelerometer' | 'vibrometer') {
  const phi = seismicPhase(beta, zeta);
  if (kind === 'accelerometer') return { truth: -Math.sin(theta), reading: -accelerometerRatio(beta, zeta) * Math.sin(theta - phi) };
  return { truth: Math.sin(theta), reading: -seismicRatio(beta, zeta) * Math.sin(theta - phi) };
}

export interface TipPreset {
  id: 'rubber' | 'plastic' | 'aluminium' | 'steel';
  label: string;
  /** Contact stiffness of the tip, N/m (illustrative values; give tau = 3.0, 0.80, 0.35, 0.15 ms with a 0.3 kg hammer on a rigid structure). */
  k: number;
}

export const TIPS: TipPreset[] = [
  { id: 'rubber', label: 'Rubber', k: 3.3e5 },
  { id: 'plastic', label: 'Hard plastic', k: 4.6e6 },
  { id: 'aluminium', label: 'Aluminium', k: 2.4e7 },
  { id: 'steel', label: 'Steel', k: 1.3e8 },
];

/** Bending-mode frequency ratios f_n/f_1: cantilever (beta_n L)^2 ratios and pinned–pinned n^2 (summary notes B3). */
export const CANTILEVER_RATIOS = [1, 6.267, 17.547];
export const PINNED_RATIOS = [1, 4, 9];
