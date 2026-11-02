// Extra pure functions for C3 (signal processing). The core DSP lives in src/physics/dsp.ts;
// these are small helpers the simulations, generators and self-tests share. SI units, Hz.
import { type C } from '../../physics/complex';
import { modalSumFRF, toAccelerance, type ModalTerm } from '../../physics/frf';
import { amplitudeSpectrum } from '../../physics/dsp';

/**
 * Where a tone of frequency f appears after sampling at fs: f = k fs + s fa with k = round(f/fs),
 * fa = |f - k fs| in [0, fs/2] (summary notes C3: fold |f - k fs|). s = -1 means the samples trace the
 * alias backwards (a sine sampled this way looks like a phase-inverted sine at fa: the wagon-wheel effect).
 */
export function aliasInfo(f: number, fs: number): { fa: number; k: number; reversed: boolean } {
  const k = Math.round(Math.abs(f) / fs);
  const d = Math.abs(f) - k * fs;
  return { fa: Math.abs(d), k, reversed: d < 0 };
}

/**
 * The lowest-frequency sinusoid through the samples of A sin(2 pi f t + phi) taken at fs:
 * A sin(2 pi s fa t + phi) with s = -1 when the alias is reversed (see aliasInfo). It equals the
 * true signal at every sample instant t = n/fs.
 */
export function aliasWave(t: number, f: number, fs: number, A = 1, phi = 0): number {
  const { fa, reversed } = aliasInfo(f, fs);
  return A * Math.sin(2 * Math.PI * (reversed ? -fa : fa) * t + phi);
}

/** Theoretical minimum sampling rate for content up to fmax: fs = 2 fmax (LC3 Eq 3.4). */
export const minSampleRate = (fmax: number): number => 2 * fmax;

/** Shortest record for a resolution df: T = 1/df (LC3 Eq 3.5). */
export const minRecordLength = (df: number): number => 1 / df;

/** Smallest power of two >= n (the FFT uses N = 2^n, LC3-2). */
export function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/** Number of cycles of a tone in a record of length T, and whether it lands exactly on a line (f T an integer). */
export function cyclesInRecord(f: number, T: number): { cycles: number; onLine: boolean } {
  const cycles = f * T;
  return { cycles, onLine: Math.abs(cycles - Math.round(cycles)) < 1e-6 };
}

/**
 * Bias of averaged FRF estimates with uncorrelated noise (Week 12 Q5 worked; consistent with LC3-8):
 * q_in = input-noise power / force power, q_out = output-noise power / response power.
 * |H1|/|H| = 1/(1 + q_in), |H2|/|H| = 1 + q_out, coherence = 1/((1 + q_in)(1 + q_out)).
 */
export function noiseBias(qIn: number, qOut: number): { h1: number; h2: number; coherence: number } {
  return { h1: 1 / (1 + qIn), h2: 1 + qOut, coherence: 1 / ((1 + qIn) * (1 + qOut)) };
}

/**
 * Corrected amplitude a window reads for a unit tone `offset` lines away from a line (0 = on a line,
 * 0.5 = half-way, the worst case), computed with the app's own spectrum (N = 1024): rect about 2/pi,
 * Hann about 0.85, flat-top about 1.
 */
export function scallopReading(kind: 'rect' | 'hann' | 'flattop', offset: number): number {
  const N = 1024;
  const k0 = 100 + offset;
  const x = new Float64Array(N);
  for (let n = 0; n < N; n++) x[n] = Math.cos((2 * Math.PI * k0 * n) / N);
  const { amp } = amplitudeSpectrum(x, N, kind);
  let best = 0;
  for (let k = 97; k <= 104; k++) best = Math.max(best, amp[k]);
  return best;
}

/** Natural frequencies (Hz) of a pinned-pinned beam: f_n = n^2 f1 (LB4). */
export const ssBeamFrequencies = (f1: number, n: number): number[] => Array.from({ length: n }, (_, i) => (i + 1) * (i + 1) * f1);

/** Mass-normalised pinned-pinned mode shape sqrt(2/m) sin(n pi xi), xi = x/L, m = beam mass (kg). */
export const ssBeamPhi = (n: number, xi: number, m: number): number => Math.sqrt(2 / m) * Math.sin(n * Math.PI * xi);

/**
 * Accelerance (m/s^2 per N) of a pinned-pinned beam between a force at xiF and a sensor at xiS,
 * by modal superposition of the first `nModes` modes (LC2 / LB6): A = -w^2 sum phi_s phi_f/(wn^2 - w^2 + 2 i zeta wn w).
 */
export function ssBeamAccelerance(fHz: number, xiS: number, xiF: number, f1: number, zeta: number, m: number, nModes = 6): C {
  const modes: ModalTerm[] = ssBeamFrequencies(f1, nModes).map((fn, i) => ({
    wn: 2 * Math.PI * fn,
    zeta,
    phi: [ssBeamPhi(i + 1, xiS, m), ssBeamPhi(i + 1, xiF, m)],
  }));
  const w = 2 * Math.PI * fHz;
  return toAccelerance(modalSumFRF(modes, 0, 1, w), w);
}

/** Integer greatest common divisor. */
export function gcdInt(a: number, b: number): number {
  a = Math.abs(Math.round(a));
  b = Math.abs(Math.round(b));
  while (b) [a, b] = [b, a % b];
  return a;
}
