// Digital signal processing for vibration measurement (summary notes C3; LC3).
// Forward transforms use X_k = sum_n x_n e^(-2 pi i k n/N), unscaled. Frequencies in Hz.
import { type C, cabs2, cdiv, cmul } from './complex';

const isPow2 = (n: number): boolean => n > 0 && (n & (n - 1)) === 0;

/** In-place iterative radix-2 FFT, forward and unscaled: X_k = sum_n x_n e^(-2 pi i k n/N); N must be a power of 2 (use dft for any N). */
export function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  if (im.length !== n) throw new RangeError('fft: re and im must have the same length');
  if (n <= 1) return;
  if (!isPow2(n)) throw new RangeError(`fft: length ${n} is not a power of 2 (use dft)`);
  // Bit-reversal permutation.
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let t = re[i];
      re[i] = re[j];
      re[j] = t;
      t = im[i];
      im[i] = im[j];
      im[j] = t;
    }
  }
  // Twiddles e^(-2 pi i k/N) computed directly (no recurrence drift).
  const half = n >> 1;
  const cw = new Float64Array(half);
  const sw = new Float64Array(half);
  for (let k = 0; k < half; k++) {
    const a = (-2 * Math.PI * k) / n;
    cw[k] = Math.cos(a);
    sw[k] = Math.sin(a);
  }
  for (let len = 2; len <= n; len <<= 1) {
    const h = len >> 1;
    const step = n / len;
    for (let i = 0; i < n; i += len) {
      for (let j = 0; j < h; j++) {
        const wr = cw[j * step];
        const wi = sw[j * step];
        const a = i + j;
        const b = a + h;
        const xr = re[b] * wr - im[b] * wi;
        const xi = re[b] * wi + im[b] * wr;
        re[b] = re[a] - xr;
        im[b] = im[a] - xi;
        re[a] += xr;
        im[a] += xi;
      }
    }
  }
}

/** Direct O(N^2) DFT with exact twiddle indexing (k n mod N). */
function directDft(xr: Float64Array, xi: Float64Array): { re: Float64Array; im: Float64Array } {
  const n = xr.length;
  const cw = new Float64Array(n);
  const sw = new Float64Array(n);
  for (let k = 0; k < n; k++) {
    cw[k] = Math.cos((-2 * Math.PI * k) / n);
    sw[k] = Math.sin((-2 * Math.PI * k) / n);
  }
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  for (let k = 0; k < n; k++) {
    let sr = 0;
    let si = 0;
    for (let m = 0, idx = 0; m < n; m++, idx = (idx + k) % n) {
      sr += xr[m] * cw[idx] - xi[m] * sw[idx];
      si += xr[m] * sw[idx] + xi[m] * cw[idx];
    }
    re[k] = sr;
    im[k] = si;
  }
  return { re, im };
}

/** Bluestein (chirp-z) DFT for any N, O(N log N): X_k = w_k sum_n (x_n w_n) conj(w_(k-n)), w_m = e^(-i pi m^2/N). */
function bluestein(xr: Float64Array, xi: Float64Array): { re: Float64Array; im: Float64Array } {
  const n = xr.length;
  let m = 1;
  while (m < 2 * n - 1) m <<= 1;
  const cr = new Float64Array(n);
  const ci = new Float64Array(n);
  for (let k = 0; k < n; k++) {
    const a = (-Math.PI * ((k * k) % (2 * n))) / n; // m^2 mod 2N keeps the angle small and exact
    cr[k] = Math.cos(a);
    ci[k] = Math.sin(a);
  }
  const ar = new Float64Array(m);
  const ai = new Float64Array(m);
  for (let k = 0; k < n; k++) {
    ar[k] = xr[k] * cr[k] - xi[k] * ci[k];
    ai[k] = xr[k] * ci[k] + xi[k] * cr[k];
  }
  const br = new Float64Array(m);
  const bi = new Float64Array(m);
  br[0] = cr[0];
  bi[0] = -ci[0];
  for (let k = 1; k < n; k++) {
    br[k] = br[m - k] = cr[k];
    bi[k] = bi[m - k] = -ci[k];
  }
  fft(ar, ai);
  fft(br, bi);
  for (let k = 0; k < m; k++) {
    const r = ar[k] * br[k] - ai[k] * bi[k];
    const i = ar[k] * bi[k] + ai[k] * br[k];
    ar[k] = r;
    ai[k] = -i; // conjugate, so a forward FFT acts as an inverse
  }
  fft(ar, ai);
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  for (let k = 0; k < n; k++) {
    const vr = ar[k] / m;
    const vi = -ai[k] / m;
    re[k] = vr * cr[k] - vi * ci[k];
    im[k] = vr * ci[k] + vi * cr[k];
  }
  return { re, im };
}

/** DFT of a real or complex sequence of any length N: X_k = sum_n x_n e^(-2 pi i k n/N), unscaled (LC3 Eq 3.3 without the 1/N). Radix-2 FFT when N is a power of 2, else Bluestein. */
export function dft(x: ArrayLike<number>, xIm?: ArrayLike<number>): { re: Float64Array; im: Float64Array } {
  const n = x.length;
  const re = Float64Array.from(x);
  const im = xIm ? Float64Array.from(xIm) : new Float64Array(n);
  if (n <= 1) return { re, im };
  if (isPow2(n)) {
    fft(re, im);
    return { re, im };
  }
  return n <= 64 ? directDft(re, im) : bluestein(re, im);
}

/** Periodic (DFT-even) window of length N: rect 1; hann 0.5 - 0.5 cos(2 pi n/N); flattop sum_k (-1)^k a_k cos(2 pi k n/N) with the a_k of MATLAB's flattopwin (LC3 leakage). */
export function windowFn(kind: 'rect' | 'hann' | 'flattop', N: number): Float64Array {
  const w = new Float64Array(N);
  const FT = [0.21557895, 0.41663158, 0.277263158, 0.083578947, 0.006947368];
  for (let i = 0; i < N; i++) {
    const t = (2 * Math.PI * i) / N;
    if (kind === 'rect') w[i] = 1;
    else if (kind === 'hann') w[i] = 0.5 - 0.5 * Math.cos(t);
    else w[i] = FT[0] - FT[1] * Math.cos(t) + FT[2] * Math.cos(2 * t) - FT[3] * Math.cos(3 * t) + FT[4] * Math.cos(4 * t);
  }
  return w;
}

/** Coherent gain CG = (1/N) sum w_n (rect 1, Hann 0.5, flat-top 0.2156): divide by it to correct tone amplitudes. */
export function coherentGain(w: ArrayLike<number>): number {
  let s = 0;
  for (let i = 0; i < w.length; i++) s += w[i];
  return w.length ? s / w.length : NaN;
}

/** Single-sided amplitude spectrum at f_k = k fs/N, k = 0..floor(N/2): amp_k = c_k |X_k|/(N CG), c_k = 2 except at DC and Nyquist, so a tone exactly on a line reads its true amplitude (LC3 Eqs 3.3–3.5). */
export function amplitudeSpectrum(
  x: ArrayLike<number>,
  fs: number,
  kind: 'rect' | 'hann' | 'flattop' = 'rect'
): { f: Float64Array; amp: Float64Array } {
  const N = x.length;
  if (N === 0) return { f: new Float64Array(0), amp: new Float64Array(0) };
  const w = windowFn(kind, N);
  const cg = coherentGain(w);
  const xw = new Float64Array(N);
  for (let i = 0; i < N; i++) xw[i] = x[i] * w[i];
  const X = dft(xw);
  const nLines = Math.floor(N / 2) + 1;
  const f = new Float64Array(nLines);
  const amp = new Float64Array(nLines);
  for (let k = 0; k < nLines; k++) {
    f[k] = (k * fs) / N;
    const twoSided = k === 0 || (N % 2 === 0 && k === N / 2) ? 1 : 2;
    amp[k] = (twoSided * Math.hypot(X.re[k], X.im[k])) / (N * cg);
  }
  return { f, amp };
}

/** Apparent frequency after sampling at fs: |f - k fs| folded into [0, fs/2] (summary notes C3, aliasing). */
export function aliasFrequency(f: number, fs: number): number {
  const r = ((Math.abs(f) % fs) + fs) % fs;
  return r > fs / 2 ? fs - r : r;
}

/** Nyquist frequency f_max = fs/2 (LC3 Eq 3.4). */
export const nyquist = (fs: number): number => fs / 2;

/** Frequency resolution (line spacing) df = 1/T = 1/(N dt) (LC3 Eq 3.5). */
export const resolution = (T: number): number => 1 / T;

const gcdInt = (a: number, b: number): number => {
  while (b) [a, b] = [b, a % b];
  return a;
};

/** Largest line spacing df that puts every tone exactly on a line: the GCD of the tone frequencies, each rounded to a multiple of quantum (summary notes C3); Infinity if every tone is 0. */
export function gcdFrequencies(tones: number[], quantum = 1e-3): number {
  const inv = 1 / quantum;
  const invR = Math.round(inv);
  const exact = invR > 0 && Math.abs(inv - invR) < 1e-9 * inv; // e.g. quantum = 1e-3 -> work in integer milli-Hz
  let g = 0;
  for (const t of tones) {
    const q = Math.round(exact ? Math.abs(t) * invR : Math.abs(t) / quantum);
    if (q) g = gcdInt(g, q);
  }
  if (!g) return Infinity;
  return exact ? g / invR : g * quantum;
}

/** Seeded uniform generator on [0, 1) (mulberry32), deterministic for a given seed. */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal sample N(0, 1) by Box–Muller from a uniform generator. */
export function gaussian(rng: () => number): number {
  const u1 = 1 - rng(); // (0, 1], so the log is finite
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

export interface FRFMeasurementParams {
  /** True FRF at frequency f (Hz). */
  H: (f: number) => C;
  /** Spectral lines (Hz). */
  freqs: number[];
  /** Number of averages per line. */
  nAvg: number;
  /** RMS of the complex noise added to the measured force (the force itself has unit RMS). */
  inputNoise: number;
  /** RMS of the complex noise added to the measured response, in response units (compare with |H|). */
  outputNoise: number;
  seed: number;
}

/**
 * Simulated averaged FRF measurement (summary notes C3; LC3 Eqs 3.7–3.9). Per line and average:
 * a random complex force F (unit RMS, random amplitude and phase), X = H F, measured F + n_in and X + n_out.
 * Sff = sum |F|^2, Sxx = sum |X|^2, Sfx = sum conj(F) X, Sxf = conj(Sfx); H1 = Sfx/Sff, H2 = Sxx/Sxf,
 * coherence = |Sfx|^2/(Sff Sxx). (Sfx is taken as conj(F) X so that H1 -> H, not its conjugate.)
 * H1 is unbiased by output noise and biased low by input noise; H2 the reverse. Undefined ratios give 0.
 */
export function simulateFRFMeasurement(p: FRFMeasurementParams): { H1: C[]; H2: C[]; coherence: number[] } {
  const rng = makeRng(p.seed);
  const g = () => gaussian(rng) * Math.SQRT1_2; // each complex sample has unit RMS magnitude
  const H1: C[] = [];
  const H2: C[] = [];
  const coherence: number[] = [];
  for (const f of p.freqs) {
    const H = p.H(f);
    let sff = 0;
    let sxx = 0;
    let fxRe = 0;
    let fxIm = 0;
    for (let a = 0; a < p.nAvg; a++) {
      // Always draw all six samples so the force sequence does not depend on the noise levels.
      const F: C = { re: g(), im: g() };
      const nin: C = { re: g() * p.inputNoise, im: g() * p.inputNoise };
      const nout: C = { re: g() * p.outputNoise, im: g() * p.outputNoise };
      const X = cmul(H, F);
      const Fm: C = { re: F.re + nin.re, im: F.im + nin.im };
      const Xm: C = { re: X.re + nout.re, im: X.im + nout.im };
      sff += cabs2(Fm);
      sxx += cabs2(Xm);
      fxRe += Fm.re * Xm.re + Fm.im * Xm.im; // conj(Fm) Xm
      fxIm += Fm.re * Xm.im - Fm.im * Xm.re;
    }
    const Sfx: C = { re: fxRe, im: fxIm };
    const Sxf: C = { re: fxRe, im: -fxIm };
    H1.push(sff > 0 ? { re: fxRe / sff, im: fxIm / sff } : { re: 0, im: 0 });
    H2.push(fxRe !== 0 || fxIm !== 0 ? cdiv({ re: sxx, im: 0 }, Sxf) : { re: 0, im: 0 });
    coherence.push(sff > 0 && sxx > 0 ? cabs2(Sfx) / (sff * sxx) : 0);
  }
  return { H1, H2, coherence };
}
