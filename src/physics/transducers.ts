// Seismic transducers and impact excitation (summary notes C1; LC1). beta = w/wn.
import { brent } from './roots';

/** Seismic instrument relative-deflection ratio z0/y0 = beta^2/sqrt((1 - beta^2)^2 + (2 zeta beta)^2) (summary notes C1; LC1-6). */
export const seismicRatio = (beta: number, zeta: number): number =>
  (beta * beta) / Math.sqrt((1 - beta * beta) ** 2 + (2 * zeta * beta) ** 2);

/** Phase lag of the relative deflection behind the case motion y = y0 cos(w t), z = z0 cos(w t - phi): phi = atan2(2 zeta beta, 1 - beta^2) in [0, pi], pi/2 at beta = 1, -> pi (z = -y) as beta -> infinity (LC1-5). */
export const seismicPhase = (beta: number, zeta: number): number => Math.atan2(2 * zeta * beta, 1 - beta * beta);

/** Accelerometer ratio z0 wn^2/|y''| = 1/sqrt((1 - beta^2)^2 + (2 zeta beta)^2), -> 1 as beta -> 0 (summary notes C1; LC1-6). */
export const accelerometerRatio = (beta: number, zeta: number): number =>
  1 / Math.sqrt((1 - beta * beta) ** 2 + (2 * zeta * beta) ** 2);

/**
 * Accelerometer: the largest beta_max with |accelerometerRatio - 1| <= tol on [0, beta_max].
 * With u = beta^2, the ratio is D^(-1/2) with D = u^2 - 2 b u + 1, b = 1 - 2 zeta^2. For b > 0 it first rises
 * to 1/(2 zeta sqrt(1 - zeta^2)); if that reaches 1 + tol the band ends at the smaller root of D = (1 + tol)^-2,
 * otherwise where the ratio has fallen to 1 - tol (D = (1 - tol)^-2). Vibrometer: seismicRatio(beta) =
 * accelerometerRatio(1/beta), so the smallest beta_min with |seismicRatio - 1| <= tol for all beta >= beta_min
 * is 1/beta_max (summary notes C1).
 */
export function usableBand(zeta: number, tol: number, kind: 'accelerometer' | 'vibrometer'): number {
  if (!(tol > 0) || !(zeta >= 0)) return kind === 'accelerometer' ? 0 : Infinity;
  const b = 1 - 2 * zeta * zeta;
  let u = Infinity;
  const cUp = 1 - 1 / (1 + tol) ** 2; // > 0
  if (b > 0 && b * b >= cUp) {
    u = cUp / (b + Math.sqrt(b * b - cUp)); // smaller root, cancellation-free
  } else if (tol < 1) {
    const cDn = 1 - 1 / (1 - tol) ** 2; // < 0
    u = b + Math.sqrt(b * b - cDn);
  }
  const betaMax = Math.sqrt(u);
  return kind === 'accelerometer' ? betaMax : 1 / betaMax;
}

/** Impact-hammer contact time tau = pi sqrt(m/k_eff), with k_eff = 1/(1/kTip + 1/kStructure) (half a period on the contact spring; LC1-4, Week 11). */
export function hammerContactDuration(mHammer: number, kTip: number, kStructure = Infinity): number {
  const kEff = 1 / (1 / kTip + 1 / kStructure);
  return Math.PI * Math.sqrt(mHammer / kEff);
}

/** Normalised spectrum of a half-sine pulse of duration tau: |F(f)|/|F(0)| = |cos(pi f tau)/(1 - (2 f tau)^2)|, = pi/4 at f tau = 1/2, first zero at f = 1.5/tau (LC1-3). */
export function halfSineSpectrum(f: number, tau: number): number {
  const x = 2 * f * tau;
  const d = 1 - Math.abs(x); // cos(pi x/2) = sin(pi d/2), and 1 - x^2 = d (1 + |x|)
  const s = Math.abs(d) < 1e-6 ? (Math.PI / 2) * (1 - (Math.PI * d) ** 2 / 24) : Math.sin((Math.PI * d) / 2) / d;
  return Math.abs(s / (1 + Math.abs(x)));
}

/** First frequency (Hz) where the half-sine spectrum is dB below its DC value, 20 log10(|F|/|F(0)|) = -dB; the main lobe falls monotonically to its zero at 1.5/tau (LC1-3: useful range to a 10–20 dB drop). */
export function spectrumDropFrequency(tau: number, dB: number): number {
  if (!(dB > 0)) return 0;
  const target = 10 ** (-dB / 20);
  const fz = 1.5 / tau;
  return brent((f) => halfSineSpectrum(f, tau) - target, 0, fz, 1e-14);
}
