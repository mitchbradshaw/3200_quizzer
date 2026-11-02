// Single-degree-of-freedom formulas (summary notes A1; LA1, LA7). SI units, frequencies in rad/s,
// r = Omega/wn, zeta = c/cc. Free response is analytic for every damping regime.
import { G, TWO_PI } from './units';

/** Below this |zeta - 1| the free response uses the critically damped formula. */
export const CRITICAL_TOL = 1e-6;

/** Damping regime used by freeResponse: 'critical' when |zeta - 1| < CRITICAL_TOL, else 'under' (zeta < 1) or 'over'. */
export function dampingRegime(zeta: number): 'under' | 'critical' | 'over' {
  if (Math.abs(zeta - 1) < CRITICAL_TOL) return 'critical';
  return zeta < 1 ? 'under' : 'over';
}

/** wn = sqrt(k/m) (rad/s). */
export function naturalFrequency(k: number, m: number): number {
  return Math.sqrt(k / m);
}

/** Critical damping cc = 2 sqrt(k m) = 2 m wn. */
export function criticalDamping(k: number, m: number): number {
  return 2 * Math.sqrt(k * m);
}

/** zeta = c/cc = c/(2 sqrt(k m)). */
export function dampingRatio(c: number, k: number, m: number): number {
  return c / (2 * Math.sqrt(k * m));
}

/** wd = wn sqrt(1 - zeta^2), and 0 when zeta >= 1 (no oscillation). */
export function dampedFrequency(wn: number, zeta: number): number {
  return zeta >= 1 ? 0 : wn * Math.sqrt((1 - zeta) * (1 + zeta));
}

/** wn = sqrt(g/delta_st) from the static deflection under gravity (summary notes A1). */
export function wnFromStaticDeflection(delta: number, g = G): number {
  return Math.sqrt(g / delta);
}

/** sin(w t)/w, finite through w = 0 (limit t); the undamped modal term y_dot0 sin(w t)/w. */
export function sinOver(w: number, t: number): number {
  const x = w * t;
  if (Math.abs(x) < 1e-4) return t * (1 - (x * x) / 6);
  return Math.sin(x) / w;
}

/** Overdamped helpers e^{-a t} cosh(b t) and e^{-a t} sinh(b t)/b (a = zeta wn, b = wn sqrt(zeta^2-1)) without overflow or cancellation. */
function hyperTerms(wn: number, zeta: number, t: number): { ch: number; sh: number } {
  const b = wn * Math.sqrt((zeta - 1) * (zeta + 1));
  const fast = zeta * wn + b; // decay rate of the fast root
  const slow = (wn * wn) / fast; // slow rate a - b, written without cancellation
  const eSlow = Math.exp(-slow * t);
  const ch = 0.5 * (eSlow + Math.exp(-fast * t));
  const sh = b === 0 ? eSlow * t : (eSlow * -Math.expm1(-2 * b * t)) / (2 * b);
  return { ch, sh };
}

/** Free response x(t) from x0, v0: e^{-zeta wn t}[x0 cos wd t + (v0 + zeta wn x0) sin(wd t)/wd]; critical e^{-wn t}[x0 + (v0 + wn x0) t]; overdamped with cosh/sinh (LA1). */
export function freeResponse(t: number, x0: number, v0: number, wn: number, zeta: number): number {
  if (!(wn > 0)) return x0 + v0 * t;
  if (Math.abs(zeta - 1) < CRITICAL_TOL) return Math.exp(-wn * t) * (x0 + (v0 + wn * x0) * t);
  const a = zeta * wn;
  if (zeta < 1) {
    const wd = wn * Math.sqrt((1 - zeta) * (1 + zeta));
    return Math.exp(-a * t) * (x0 * Math.cos(wd * t) + (v0 + a * x0) * sinOver(wd, t));
  }
  const { ch, sh } = hyperTerms(wn, zeta, t);
  return x0 * ch + (v0 + a * x0) * sh;
}

/** Free velocity v(t): e^{-zeta wn t}[v0 cos wd t - (zeta wn v0 + wn^2 x0) sin(wd t)/wd]; critical e^{-wn t}[v0 - wn (v0 + wn x0) t]; overdamped with cosh/sinh (LA1). */
export function freeVelocity(t: number, x0: number, v0: number, wn: number, zeta: number): number {
  if (!(wn > 0)) return v0;
  if (Math.abs(zeta - 1) < CRITICAL_TOL) return Math.exp(-wn * t) * (v0 - wn * (v0 + wn * x0) * t);
  const a = zeta * wn;
  if (zeta < 1) {
    const wd = wn * Math.sqrt((1 - zeta) * (1 + zeta));
    return Math.exp(-a * t) * (v0 * Math.cos(wd * t) - (a * v0 + wn * wn * x0) * sinOver(wd, t));
  }
  const { ch, sh } = hyperTerms(wn, zeta, t);
  return v0 * ch - (a * v0 + wn * wn * x0) * sh;
}

/** Undamped free-vibration amplitude X = sqrt(x0^2 + (v0/wn)^2) (summary notes A1). */
export function undampedAmplitude(x0: number, v0: number, wn: number): number {
  return Math.hypot(x0, v0 / wn);
}

/** Dynamic magnification X/(F0/k) = 1/sqrt((1 - r^2)^2 + (2 zeta r)^2) (summary notes A1). */
export function magnification(r: number, zeta: number): number {
  return 1 / Math.hypot((1 - r) * (1 + r), 2 * zeta * r);
}

/** Phase lag phi in [0, pi] with tan phi = 2 zeta r/(1 - r^2) (pi/2 at r = 1). */
export function phaseLag(r: number, zeta: number): number {
  const x = (1 - r) * (1 + r);
  const y = 2 * zeta * r;
  if (x === 0) return Math.PI / 2;
  return Math.atan2(y === 0 ? 0 : y, x);
}

/** Transmissibility T = X/Y = F_T/F0 = sqrt((1 + (2 zeta r)^2)/((1 - r^2)^2 + (2 zeta r)^2)); T = 1 at r = sqrt2 for every zeta (LA7 Eq 7.1). */
export function transmissibility(r: number, zeta: number): number {
  const y = 2 * zeta * r;
  return Math.hypot(1, y) / Math.hypot((1 - r) * (1 + r), y);
}

/** Relative motion of base excitation Z/Y = r^2/sqrt((1 - r^2)^2 + (2 zeta r)^2) (summary notes A1). */
export function relativeMotionRatio(r: number, zeta: number): number {
  return (r * r) / Math.hypot((1 - r) * (1 + r), 2 * zeta * r);
}

/** r at the force-response (magnification) peak, sqrt(1 - 2 zeta^2); NaN if zeta >= 1/sqrt2 (no peak). */
export function peakRatioForce(zeta: number): number {
  const u = 1 - 2 * zeta * zeta;
  return u > 0 ? Math.sqrt(u) : NaN;
}

/** r at the transmissibility peak, sqrt(sqrt(1 + 8 zeta^2) - 1)/(2 zeta) = sqrt(2/(1 + sqrt(1 + 8 zeta^2))); 1 at zeta = 0. */
export function peakRatioTransmissibility(zeta: number): number {
  return Math.sqrt(2 / (1 + Math.sqrt(1 + 8 * zeta * zeta)));
}

/** r at the relative-motion peak, 1/sqrt(1 - 2 zeta^2); NaN if zeta >= 1/sqrt2 (no peak). */
export function peakRatioRelative(zeta: number): number {
  const u = 1 - 2 * zeta * zeta;
  return u > 0 ? 1 / Math.sqrt(u) : NaN;
}

/** Logarithmic decrement delta = ln(x_n/x_{n+1}) = 2 pi zeta/sqrt(1 - zeta^2); NaN for zeta >= 1 (no oscillation). */
export function logDecrement(zeta: number): number {
  return zeta < 1 ? (TWO_PI * zeta) / Math.sqrt((1 - zeta) * (1 + zeta)) : NaN;
}

/** Damping ratio from a log decrement, zeta = delta/sqrt(4 pi^2 + delta^2). */
export function zetaFromLogDecrement(delta: number): number {
  return delta / Math.hypot(TWO_PI, delta);
}

/** The r > sqrt2 at which transmissibility(r, zeta) = T for 0 < T < 1 (zeta = 0: r = sqrt(1 + 1/T)); NaN otherwise. */
export function isolationRatioFor(T: number, zeta = 0): number {
  if (!(T > 0 && T < 1)) return NaN;
  if (zeta === 0) return Math.sqrt(1 + 1 / T);
  // T^2 [(1 - u)^2 + 4 zeta^2 u] = 1 + 4 zeta^2 u with u = r^2: one positive root.
  const T2 = T * T;
  const z2 = 4 * zeta * zeta;
  const bq = -2 * T2 - z2 * (1 - T2); // < 0
  const cq = T2 - 1; // < 0
  const u = (-bq + Math.sqrt(bq * bq - 4 * T2 * cq)) / (2 * T2);
  return Math.sqrt(u);
}
