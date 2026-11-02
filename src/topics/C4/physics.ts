// Extra pure functions for C4 (vibration control). The SDOF formulas live in src/physics/sdof.ts and the
// absorber formulas in src/physics/absorber.ts; these helpers combine them for isolation design.
// SI units; frequencies in rad/s unless the name says Hz.
import { G, TWO_PI } from '../../physics/units';
import { magnification, transmissibility } from '../../physics/sdof';
import type { Deriv } from '../../physics/ode';

/** Mount natural frequency (Hz) from its static sag delta (m): f_n = sqrt(g/delta)/(2 pi) (LC4.5; LA7-2). */
export const sagToFn = (delta: number, g = G): number => Math.sqrt(g / delta) / TWO_PI;

/** Static sag (m) that gives a natural frequency fn (Hz): delta = g/(2 pi fn)^2. */
export const fnToSag = (fn: number, g = G): number => g / (TWO_PI * fn) ** 2;

/** Undamped isolator: the smallest frequency ratio with T <= Tt is r = sqrt(1 + 1/Tt) (LA7 Eq 7.1, zeta = 0). */
export const ratioForT = (Tt: number): number => Math.sqrt(1 + 1 / Tt);

/** Machine excursion per unit unbalance, X/(m e/M) = r^2/sqrt((1 - r^2)^2 + (2 zeta r)^2): 1/(2 zeta) at r = 1, tends to 1 for r >> 1. */
export const unbalanceAmplitude = (r: number, zeta: number): number => r * r * magnification(r, zeta);

/**
 * Force reaching the floor from a rotating unbalance, as a fraction of the unbalance force at running speed
 * (m e Omega_run^2), at speed fraction s = Omega/Omega_run: s^2 T(s r_run, zeta).
 */
export const floorForceRatio = (s: number, rRun: number, zeta: number): number => s * s * transmissibility(s * rRun, zeta);

/**
 * Largest floor-force ratio met while running up from rest to the running speed (r_run = Omega_run/wn),
 * and the speed fraction s where it occurs. If the mounts are stiff (r_run < ~0.5) or heavily damped,
 * the largest value is at running speed itself.
 */
export function startUpPeak(rRun: number, zeta: number): { ratio: number; s: number } {
  let best = { ratio: floorForceRatio(1, rRun, zeta), s: 1 };
  const lo = Math.min(1, 0.5 / rRun);
  const hi = Math.min(1, 2.5 / rRun);
  if (hi > lo) {
    const n = 400;
    for (let i = 0; i <= n; i++) {
      const s = lo + ((hi - lo) * i) / n;
      const v = floorForceRatio(s, rRun, zeta);
      if (v > best.ratio) best = { ratio: v, s };
    }
    const h = (hi - lo) / n;
    const a = Math.max(lo, best.s - 2 * h);
    const b = Math.min(1, best.s + 2 * h);
    for (let i = 0; i <= 200; i++) {
      const s = a + ((b - a) * i) / 200;
      const v = floorForceRatio(s, rRun, zeta);
      if (v > best.ratio) best = { ratio: v, s };
    }
  }
  return best;
}

/** Tuned absorber (beta = 1) with absorber damping zeta = c2/(2 m2 w11), primary amplitude at Omega = w11: X1 k1/F0 = 2 zeta/(mu sqrt(1 + 4 zeta^2)) (LC4.6, from Rao 9.11.2). */
export const tunedResidual = (mu: number, zeta: number): number => (2 * zeta) / (mu * Math.sqrt(1 + 4 * zeta * zeta));

export interface SeatParams {
  /** Seat suspension natural frequency (Hz). */
  fn: number;
  zeta: number;
  /** Floor displacement amplitude (m) and frequency (Hz). */
  Y: number;
  f: number;
  /** Free travel either side of equilibrium before the end-stop (m). */
  gap: number;
  /** End-stop stiffness as a multiple of the suspension stiffness. */
  stopRatio: number;
}

/** End-stop force per unit mass in the relative coordinate z = x - y: (k_stop/m)(|z| - gap) sign z beyond the gap. */
export function stopAccel(z: number, p: SeatParams): number {
  const over = Math.abs(z) - p.gap;
  if (over <= 0) return 0;
  const wn = TWO_PI * p.fn;
  return p.stopRatio * wn * wn * over * Math.sign(z);
}

/**
 * Seat with end-stops on a vibrating floor y = Y sin(Omega t), in the relative coordinate z = x - y (2023 A3.4):
 * z'' = -y'' - 2 zeta wn z' - wn^2 z - stopAccel(z). State [z, z']. The seat's absolute acceleration is y'' + z''.
 */
export function seatDeriv(p: SeatParams): Deriv {
  const wn = TWO_PI * p.fn;
  const W = TWO_PI * p.f;
  return (t, s) => {
    const ydd = -W * W * p.Y * Math.sin(W * t);
    return [s[1], -ydd - 2 * p.zeta * wn * s[1] - wn * wn * s[0] - stopAccel(s[0], p)];
  };
}

/** Seat absolute acceleration (m/s^2) from the state [z, z']: the spring, damper and stop forces per unit mass. */
export function seatAccel(s: readonly number[], p: SeatParams): number {
  const wn = TWO_PI * p.fn;
  return -2 * p.zeta * wn * s[1] - wn * wn * s[0] - stopAccel(s[0], p);
}

/**
 * The same seat model with the floor phase as a third state, [z, z', phi] with phi' = Omega and
 * y = Y sin(phi): the floor stays continuous when a slider changes its frequency mid-run. `get` returns the
 * current parameters (read every step, so the simulation follows the sliders).
 */
export function seatDerivPhase(get: () => SeatParams): Deriv {
  return (_t, s) => {
    const p = get();
    const wn = TWO_PI * p.fn;
    const W = TWO_PI * p.f;
    const ydd = -W * W * p.Y * Math.sin(s[2]);
    return [s[1], -ydd - 2 * p.zeta * wn * s[1] - wn * wn * s[0] - stopAccel(s[0], p), W];
  };
}

/**
 * Largest machine excursion per unit unbalance met during a run-up, max over r of r^2/sqrt((1 - r^2)^2 + (2 zeta r)^2):
 * 1/(2 zeta sqrt(1 - zeta^2)) at r = 1/sqrt(1 - 2 zeta^2) when zeta < 1/sqrt2, else 1 (approached at high speed).
 * It does not depend on the mount stiffness: only damping limits the start-up excursion (LC4.4-4.5).
 */
export function peakExcursion(zeta: number): number {
  return zeta < Math.SQRT1_2 ? 1 / (2 * zeta * Math.sqrt(1 - zeta * zeta)) : 1;
}

/**
 * Primary amplitude X1 k1/F0 of a damped primary (zeta1 = c1/(2 m1 w11)) carrying a damped absorber
 * (zetaA = c2/(2 m2 w11), the LC4.6/Rao convention), g = Omega/w11, beta = w22/w11, mu = m2/m1:
 *   X1 k1/F0 = |beta^2 - g^2 + 2i zetaA g| / |(1 - g^2 + 2i zeta1 g)(beta^2 - g^2 + 2i zetaA g) - mu g^2 (beta^2 + 2i zetaA g)|.
 * With zeta1 = 0 it is physics/absorber primaryAmplitude (LC4.6 Eq; LA6 Eq 6.20 when both are undamped).
 */
export function primaryWithAbsorber(g: number, mu: number, beta: number, zetaA: number, zeta1 = 0): number {
  const b2 = beta * beta;
  const g2 = g * g;
  const ar = 1 - g2;
  const ai = 2 * zeta1 * g;
  const br = b2 - g2;
  const bi = 2 * zetaA * g;
  const re = ar * br - ai * bi - mu * g2 * b2;
  const im = ar * bi + ai * br - mu * g2 * bi;
  return Math.hypot(br, bi) / Math.hypot(re, im);
}

/** Single-cylinder inertia forces (LC4.3): amplitude of the secondary (2 omega) over the primary (omega) x-force, m_p r/((m_p + m_c) l). */
export const secondaryToPrimary = (mp: number, mc: number, r: number, l: number): number => (mp * r) / ((mp + mc) * l);
