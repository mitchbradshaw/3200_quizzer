// Extra pure functions for topic B2 (strings, rods and shafts). SI units, rad/s unless named Hz.
// The core wave functions live in src/physics/waves.ts; these add the B2-specific pieces the
// simulations and generators need. Each is checked in ./selftests.ts.
import { brent } from '../../physics/roots';
import { pluckAmplitudes, touchedHarmonics, type WaveBC } from '../../physics/waves';
import { betaL, type BeamBC } from '../../physics/beams';

export type Member = 'string' | 'rod' | 'shaft';

export interface Material {
  id: 'steel' | 'aluminium' | 'titanium';
  label: string;
  E: number; // Pa
  rho: number; // kg/m^3
  nu: number;
}

/** Course materials: steel (2024 B2), aluminium and titanium (tutorial W7.2). */
export const MATERIALS: Material[] = [
  { id: 'steel', label: 'Steel', E: 210e9, rho: 7850, nu: 0.3 },
  { id: 'aluminium', label: 'Aluminium', E: 72e9, rho: 2800, nu: 0.32 },
  { id: 'titanium', label: 'Titanium', E: 114e9, rho: 4400, nu: 0.33 },
];

/** Torsional/axial wave-speed (and frequency) ratio for the same member and ends: 1/sqrt(2(1 + nu)) (LB3.5). */
export const torsionAxialRatio = (nu: number): number => 1 / Math.sqrt(2 * (1 + nu));

/** Mass per unit length of a solid round wire, rhoL = rho pi d^2/4 (kg/m). */
export const wireMassPerLength = (d: number, rho: number): number => (rho * Math.PI * d * d) / 4;

/** Beam end conditions that match a wave member's ends in bending: fixed -> clamped, free -> free. */
export const BEAM_OF: Record<WaveBC, BeamBC> = {
  'fixed-fixed': 'clamped-clamped',
  'fixed-free': 'clamped-free',
  'free-free': 'free-free',
};

/** Lowest elastic bending frequency (rad/s) of a solid round rod: w = (beta1 L)^2 (d/4) sqrt(E/rho)/L^2, since I/A = d^2/16 (LB4). */
export function solidRodBendingOmega1(bc: WaveBC, E: number, rho: number, d: number, L: number): number {
  const b = betaL(BEAM_OF[bc], 1)[0];
  return ((b * b) / (L * L)) * (d / 4) * Math.sqrt(E / rho);
}

// ------------------------------------------------------------------ plucked strings

export type Finger = 'none' | 'touch' | 'press';

export interface Partial {
  /** Frequency as a multiple of the open string's f1. */
  ratio: number;
  /** Modal amplitude per unit pluck height (signed). */
  amp: number;
  /** Mode number on the vibrating length (the open string, or the pressed segment). */
  n: number;
  /** False when the mode is not heard (pluck at its node, or killed by the light touch). */
  alive: boolean;
}

export interface Spectrum {
  partials: Partial[];
  /** The vibrating segment [x0, x1] as fractions of L (the whole string unless pressed). */
  seg: [number, number];
  /** Pluck position within the vibrating segment, as a fraction of its length. */
  localA: number;
}

const ZERO = 1e-9;

/**
 * Modes heard from a string fixed at both ends, plucked (triangle, released from rest) at a = x/L.
 * finger = 'touch' at c imposes a node there: only modes with a node at c survive (summary notes B2).
 * finger = 'press' at c makes a new fixed end: the segment holding the pluck vibrates as a shorter string
 * (frequencies f1 L/l). Amplitudes from pluckAmplitudes (LB2 Eq 2.11).
 */
export function pluckSpectrum(a: number, finger: Finger, c: number, nModes: number): Spectrum {
  if (finger === 'press') {
    const seg: [number, number] = a < c ? [0, c] : [c, 1];
    const len = seg[1] - seg[0];
    const localA = (a - seg[0]) / len;
    const silent = Math.abs(a - c) < 1e-9;
    const amps = pluckAmplitudes(Math.min(1, Math.max(0, localA)), nModes);
    return {
      seg,
      localA,
      partials: amps.map((amp, i) => ({ ratio: (i + 1) / len, amp: silent ? 0 : amp, n: i + 1, alive: !silent && Math.abs(amp) > ZERO })),
    };
  }
  const amps = pluckAmplitudes(a, nModes);
  const kept = finger === 'touch' ? new Set(touchedHarmonics(c, nModes)) : null;
  return {
    seg: [0, 1],
    localA: a,
    partials: amps.map((amp, i) => ({ ratio: i + 1, amp, n: i + 1, alive: Math.abs(amp) > ZERO && (!kept || kept.has(i + 1)) })),
  };
}

/** Lowest audible partial of a spectrum (undefined when silent). */
export const lowestAlive = (s: Spectrum): Partial | undefined => s.partials.find((p) => p.alive);

// ------------------------------------------------------------------ variable tension

/**
 * Tutorial W7.9(c) model of a cable (mass per length rhoL, length l) whirled at Omega with an end mass m:
 * constant tension m Omega^2 l with the cable's centrifugal term kept, beta tan beta = rhoL l/m = 1/mu,
 * w = Omega sqrt(beta^2 mu - 1), using the root beta in (pi, 3 pi/2) (the reader's "beta > pi").
 * Returns w/Omega and beta. Only meaningful for mu = m/(rhoL l) above about 0.25.
 */
export function rotatingCableW79(mu: number): { beta: number; wOverOmega: number } {
  const f = (b: number) => b * Math.sin(b) - (1 / mu) * Math.cos(b);
  const beta = brent(f, Math.PI + 1e-12, 1.5 * Math.PI - 1e-12, 1e-14);
  return { beta, wOverOmega: Math.sqrt(Math.max(0, beta * beta * mu - 1)) };
}

/** Swinging weight: string tension at the bottom and at the extremes of the swing, in units of mg. */
export function swingTensionRatios(theta0: number): { max: number; min: number } {
  return { max: 3 - 2 * Math.cos(theta0), min: Math.cos(theta0) };
}

// ------------------------------------------------------------------ shafts

/**
 * 2021 B2.4: effective motor inertia at the half-axle, in units of the axle's own inertia Ia:
 * Ieff/Ia = (NR/(NS GRW))^2 a1 + (GR2/GRW)^2 a2, with IMG1 = a1 Ia and IMG2 = a2 Ia
 * (an inertia spinning n times faster appears as n^2 I).
 */
export function halfAxleIeffRatio(NRoverNS: number, GR2: number, GRW: number, a1: number, a2: number): number {
  return (NRoverNS / GRW) ** 2 * a1 + (GR2 / GRW) ** 2 * a2;
}

/**
 * Fixed–fixed stepped shaft (2024 B2.3 worked solution): polar moment Jb on 0 <= x <= alpha L, Jcs = n Jb on
 * alpha L <= x <= L, same material. Frequency equation (1 + n) sin kL = (n - 1) sin((1 - 2 alpha) kL).
 * Returns f1/f1,uniform = (k1 L)/pi.
 */
export function steppedShaftF1Ratio(alpha: number, n: number): number {
  const g = (kL: number) => (1 + n) * Math.sin(kL) - (n - 1) * Math.sin((1 - 2 * alpha) * kL);
  const h = 0.005;
  let a = 0.05;
  let ga = g(a);
  for (let b = a + h; b < 2.5 * Math.PI; b += h) {
    const gb = g(b);
    if (ga * gb <= 0) return brent(g, a, b, 1e-14) / Math.PI;
    a = b;
    ga = gb;
  }
  return NaN;
}

/** First root of z tan z = mu by Newton from the Rayleigh start sqrt(mu/(1 + mu/3)) (used to write worked hints). */
export function endInertiaNewton(mu: number, steps = 3): number[] {
  const out: number[] = [];
  let z = Math.sqrt(mu / (1 + mu / 3));
  out.push(z);
  for (let i = 0; i < steps; i++) {
    const f = z * Math.sin(z) - mu * Math.cos(z);
    const d = Math.sin(z) + z * Math.cos(z) + mu * Math.sin(z);
    z -= f / d;
    out.push(z);
  }
  return out;
}

// ------------------------------------------------------------------ swinging weight (large-amplitude pendulum)

/** Arithmetic–geometric mean of a and b (converges quadratically). */
export function agm(a: number, b: number): number {
  for (let i = 0; i < 40 && Math.abs(a - b) > 1e-15 * a; i++) [a, b] = [(a + b) / 2, Math.sqrt(a * b)];
  return a;
}

/** Exact period (s) of a simple pendulum of length L (m) swinging with amplitude theta0 (rad): 2 pi sqrt(L/g) / AGM(1, cos(theta0/2)). */
export function pendulumPeriod(L: number, theta0: number, g = 9.81): number {
  return (2 * Math.PI * Math.sqrt(L / g)) / agm(1, Math.cos(theta0 / 2));
}

/**
 * One period of a pendulum released from rest at theta0 (RK4 on theta'' = -(g/L) sin theta), sampled at n + 1
 * equally spaced times. Used to animate the swinging-weight simulation: the string tension follows from
 * swingTension(m, theta, theta0) = m g (3 cos theta - 2 cos theta0).
 */
export function swingCycle(L: number, theta0: number, n = 400, g = 9.81): { period: number; t: Float64Array; theta: Float64Array } {
  const period = pendulumPeriod(L, theta0, g);
  const sub = 10;
  const h = period / (n * sub);
  const t = new Float64Array(n + 1);
  const theta = new Float64Array(n + 1);
  let th = theta0;
  let w = 0;
  const acc = (x: number) => -(g / L) * Math.sin(x);
  theta[0] = th;
  for (let i = 1; i <= n; i++) {
    for (let s = 0; s < sub; s++) {
      const k1t = w;
      const k1w = acc(th);
      const k2t = w + (h / 2) * k1w;
      const k2w = acc(th + (h / 2) * k1t);
      const k3t = w + (h / 2) * k2w;
      const k3w = acc(th + (h / 2) * k2t);
      const k4t = w + h * k3w;
      const k4w = acc(th + h * k3t);
      th += (h / 6) * (k1t + 2 * k2t + 2 * k3t + k4t);
      w += (h / 6) * (k1w + 2 * k2w + 2 * k3w + k4w);
    }
    t[i] = (i * period) / n;
    theta[i] = th;
  }
  return { period, t, theta };
}

// ------------------------------------------------------------------ whirling cable, variable tension

/**
 * Whirling cable (length l, mass per length rhoL) with an end mass m, spinning at Omega about the other end, with the
 * true tension T(x) = Omega^2 [m l + rhoL (l^2 - x^2)/2] (2023 worked solution B1.2, "going further"). With xi = x/l and
 * mu = m/(rhoL l) the transverse modes obey -d/dxi{[mu + (1 - xi^2)/2] Y'} = lambda Y, Y(0) = 0, Y'(1) = lambda Y(1),
 * with out-of-plane w = Omega sqrt(lambda) and in-plane w = Omega sqrt(lambda - 1). lambda = 1 is the rigid tilt (in-plane:
 * the steady rotation itself, w = 0), so the first vibration is the second eigenvalue. Solved by shooting (RK4, 200 steps)
 * and bisection. Returns w/Omega for both planes and the in-plane mode shape sampled at 41 points (max |Y| = 1).
 */
export function whirlingCableExact(mu: number): { lambda: number; wIn: number; wOut: number; shape: Float64Array } {
  const N = 200;
  const shoot = (lam: number, keep?: Float64Array) => {
    let Y = 0;
    let p = 1;
    const h = 1 / N;
    const q = (xi: number) => mu + 0.5 * (1 - xi * xi);
    if (keep) keep[0] = 0;
    for (let i = 0; i < N; i++) {
      const xi = i * h;
      const k1Y = p / q(xi);
      const k1p = -lam * Y;
      const k2Y = (p + (h / 2) * k1p) / q(xi + h / 2);
      const k2p = -lam * (Y + (h / 2) * k1Y);
      const k3Y = (p + (h / 2) * k2p) / q(xi + h / 2);
      const k3p = -lam * (Y + (h / 2) * k2Y);
      const k4Y = (p + h * k3p) / q(xi + h);
      const k4p = -lam * (Y + h * k3Y);
      Y += (h / 6) * (k1Y + 2 * k2Y + 2 * k3Y + k4Y);
      p += (h / 6) * (k1p + 2 * k2p + 2 * k3p + k4p);
      if (keep && (i + 1) % 5 === 0) keep[(i + 1) / 5] = Y;
    }
    return p / mu - lam * Y; // Y'(1) - lambda Y(1)
  };
  // The second eigenvalue lies near the fixed-end estimate pi^2 mu + 1: bracket it and bisect.
  const guess = Math.PI * Math.PI * mu + 1;
  const a0 = Math.max(1.05, 0.7 * guess);
  const b0 = 1.6 * guess + 5;
  const M = 60;
  let lo = a0;
  let flo = shoot(lo);
  let hi = NaN;
  for (let k = 1; k <= M; k++) {
    const x = a0 + ((b0 - a0) * k) / M;
    const fx = shoot(x);
    if (flo * fx <= 0) {
      hi = x;
      break;
    }
    lo = x;
    flo = fx;
  }
  if (!Number.isFinite(hi)) return { lambda: NaN, wIn: NaN, wOut: NaN, shape: new Float64Array(41) };
  for (let it = 0; it < 60; it++) {
    const m = 0.5 * (lo + hi);
    const fm = shoot(m);
    if (flo * fm <= 0) hi = m;
    else {
      lo = m;
      flo = fm;
    }
  }
  const lambda = 0.5 * (lo + hi);
  const shape = new Float64Array(N / 5 + 1);
  shoot(lambda, shape);
  let peak = 0;
  for (const v of shape) peak = Math.max(peak, Math.abs(v));
  for (let i = 0; i < shape.length; i++) shape[i] /= peak || 1;
  return { lambda, wIn: Math.sqrt(Math.max(0, lambda - 1)), wOut: Math.sqrt(lambda), shape };
}
