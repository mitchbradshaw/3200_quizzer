// Dynamic vibration absorber m2-k2(-c2) on a primary m1-k1 (LA6 §6.4-6.6, LC4 §3.5; summary
// notes A4). LA6 notation: mu = m2/m1, w11 = sqrt(k1/m1), w22 = sqrt(k2/m2), beta = w22/w11 and
// r = w/w22 for the natural-frequency ratios. Forced response uses g = Omega/w11 and the
// Den Hartog/Rao damping ratio zeta = c2/(2 m2 w11).

/** Tuned absorber (beta = 1) frequency ratios r = w/w22, r^2 = 1 + mu/2 -/+ sqrt((1 + mu/2)^2 - 1), ascending, with r1 r2 = 1 exactly (LA6 Eq 6.22). */
export function tunedRatios(mu: number): [number, number] {
  // (1 + mu/2)^2 - 1 = mu (1 + mu/4): no cancellation for small mu.
  const r2 = Math.sqrt(1 + mu / 2 + Math.sqrt(mu * (1 + mu / 4)));
  return [1 / r2, r2];
}

/** Mass ratio for a tuned (beta = 1) absorber with new frequency ratio r: mu = r^2 + r^-2 - 2 = (r - 1/r)^2 (LA6 Eq 6.22 rearranged). */
export function muFromRatio(r: number): number {
  const d = r - 1 / r;
  return d * d;
}

/** Frequency ratios r = w/w22 (ascending) from beta^2 r^4 - [1 + (1 + mu) beta^2] r^2 + 1 = 0, so r1^2 r2^2 = 1/beta^2 (LA6 Eq 6.23). */
export function generalRatios(mu: number, beta: number): [number, number] {
  if (!(beta > 0)) return [NaN, NaN];
  const b2 = beta * beta;
  const B = 1 + (1 + mu) * b2;
  // B^2 - 4 beta^2 = ((1 - beta)^2 + mu beta^2)(B + 2 beta): no cancellation near beta = 1.
  const disc = ((1 - beta) * (1 - beta) + mu * b2) * (B + 2 * beta);
  const hi = (B + Math.sqrt(disc)) / (2 * b2);
  const lo = 1 / (b2 * hi);
  return [Math.sqrt(lo), Math.sqrt(hi)];
}

/** Undamped natural frequencies (rad/s, ascending) of ground-k1-m1-k2-m2: m1 m2 w^4 - (m1 k2 + m2 (k1 + k2)) w^2 + k1 k2 = 0 (LA6 Eq 6.19). */
export function chainFrequencies(m1: number, k1: number, m2: number, k2: number): [number, number] {
  const B = m1 * k2 + m2 * (k1 + k2);
  // B^2 - 4 m1 m2 k1 k2 written as a sum of non-negative terms.
  const disc = (m1 * k2 - m2 * k1) ** 2 + 2 * (m1 * k2 + m2 * k1) * m2 * k2 + (m2 * k2) ** 2;
  const hi = (B + Math.sqrt(disc)) / (2 * m1 * m2);
  const lo = hi > 0 ? (k1 * k2) / (m1 * m2 * hi) : 0;
  return [Math.sqrt(lo), Math.sqrt(hi)];
}

/** Shared denominator |D|: D = (1 - g^2)(beta^2 - g^2) - mu beta^2 g^2 + i 2 zeta g (1 - (1 + mu) g^2). */
function denominator(mu: number, beta: number, g: number, zeta: number): number {
  const g2 = g * g;
  const b2 = beta * beta;
  const re = (1 - g) * (1 + g) * (b2 - g2) - mu * b2 * g2;
  const im = 2 * zeta * g * (1 - (1 + mu) * g2);
  return Math.hypot(re, im);
}

/** Primary amplitude |X1|/(F0/k1) = sqrt([(beta^2 - g^2)^2 + (2 zeta g)^2]/[((1-g^2)(beta^2-g^2) - mu beta^2 g^2)^2 + (2 zeta g)^2 (1 - g^2 - mu g^2)^2]), g = Omega/w11, zeta = c2/(2 m2 w11); zero at g = beta when zeta = 0 (LC4 §3.5, LA6 Eq 6.20). */
export function primaryAmplitude(mu: number, beta: number, g: number, zeta = 0): number {
  return Math.hypot((beta - g) * (beta + g), 2 * zeta * g) / denominator(mu, beta, g, zeta);
}

/** Absorber amplitude |X2|/(F0/k1) = sqrt(beta^4 + (2 zeta g)^2)/|D| with the same D as primaryAmplitude (LA6 Eq 6.21 when zeta = 0). */
export function absorberAmplitude(mu: number, beta: number, g: number, zeta = 0): number {
  return Math.hypot(beta * beta, 2 * zeta * g) / denominator(mu, beta, g, zeta);
}

/** Den Hartog optimum tuning beta = 1/(1 + mu) and damping zeta = sqrt(3 mu/(8 (1 + mu)^3)), zeta = c2/(2 m2 w11) (LC4 §3.5, Rao 9.11.2). */
export function denHartogOptimum(mu: number): { beta: number; zeta: number } {
  return { beta: 1 / (1 + mu), zeta: Math.sqrt((3 * mu) / (8 * (1 + mu) ** 3)) };
}

/** Den Hartog fixed points P, Q shared by every damping curve: g^2 roots of (2 + mu) g^4 - 2 (1 + beta^2 + mu beta^2) g^2 + 2 beta^2 = 0, height 1/|1 - (1 + mu) g^2|. */
export function denHartogFixedPoints(mu: number, beta: number): { g: [number, number]; amp: [number, number] } {
  const b2 = beta * beta;
  const A = 2 + mu;
  const B = 2 * (1 + b2 + mu * b2);
  const Cc = 2 * b2;
  const disc = Math.max(0, B * B - 4 * A * Cc);
  const hi = (B + Math.sqrt(disc)) / (2 * A);
  const lo = Cc / (A * hi);
  const amp = (g2: number) => 1 / Math.abs(1 - (1 + mu) * g2);
  return { g: [Math.sqrt(lo), Math.sqrt(hi)], amp: [amp(lo), amp(hi)] };
}

/** Size a tuned absorber (beta = 1, w22 = w11 = Omega) so both new frequencies are at least `margin` (fraction) from Omega: the lower limit binds, r1 = 1 - margin, mu = (r1 - 1/r1)^2, r2 = 1/r1, m2 = mu m1, k2 = m2 Omega^2 (summary notes A4). */
export function sizeTunedAbsorber(
  m1: number,
  Omega: number,
  margin: number
): { mu: number; m2: number; k2: number; r1: number; r2: number } {
  if (!(margin > 0 && margin < 1)) return { mu: NaN, m2: NaN, k2: NaN, r1: NaN, r2: NaN };
  const r1 = 1 - margin;
  const mu = muFromRatio(r1);
  const m2 = mu * m1;
  return { mu, m2, k2: m2 * Omega * Omega, r1, r2: 1 / r1 };
}
