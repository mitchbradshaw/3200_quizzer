// Strings, rods and shafts: the "wave" systems (summary notes B2; LB2–LB3).
// Pure functions, SI units, angular frequency in rad/s. Positions along the member are xi = x/L.
import { brent } from './roots';
import { G as GRAVITY } from './units';

export type WaveBC = 'fixed-fixed' | 'fixed-free' | 'free-free';

/** String wave speed c = sqrt(T/rhoL) (summary notes B2 table; LB2). T in N, rhoL in kg/m. */
export const stringWaveSpeed = (T: number, rhoL: number): number => Math.sqrt(T / rhoL);

/** Axial rod wave speed c = sqrt(E/rho) (summary notes B2 table; LB3). */
export const rodWaveSpeed = (E: number, rho: number): number => Math.sqrt(E / rho);

/** Torsional shaft wave speed c = sqrt(G/rho) (summary notes B2 table; LB3). */
export const shaftWaveSpeed = (G: number, rho: number): number => Math.sqrt(G / rho);

/** Shear modulus G = E/(2(1 + nu)) (summary notes B2 table). */
export const shearModulus = (E: number, nu: number): number => E / (2 * (1 + nu));

/** sin(pi x) with exact zeros at integer x (keeps node tests clean for rational positions). */
function sinPi(x: number): number {
  const r = x - 2 * Math.round(x / 2); // r in [-1, 1]
  if (r === 0 || r === 1 || r === -1) return 0;
  return Math.sin(Math.PI * r);
}

function checkMode(i: number, min = 1): void {
  if (!Number.isInteger(i) || i < min) throw new RangeError(`mode number must be an integer >= ${min} (got ${i})`);
}

/** Dimensionless root z_i = w_i L/c: fixed-fixed and free-free i pi, fixed-free (2i - 1) pi/2 (summary notes B2 table). */
export function waveRoot(bc: WaveBC, i: number): number {
  checkMode(i);
  return bc === 'fixed-free' ? ((2 * i - 1) * Math.PI) / 2 : i * Math.PI;
}

/** The n lowest non-zero natural frequencies w_i = z_i c/L in rad/s (fixed-fixed i pi c/L, fixed-free (2i-1) pi c/2L, free-free i pi c/L; summary notes B2). */
export function waveOmegas(bc: WaveBC, c: number, L: number, n: number): number[] {
  const out: number[] = [];
  for (let i = 1; i <= n; i++) out.push((waveRoot(bc, i) * c) / L);
  return out;
}

/** True when the member also has a w = 0 rigid-body mode (free-free only; summary notes B2 table). */
export const hasRigidMode = (bc: WaveBC): boolean => bc === 'free-free';

/** Mode shape at xi = x/L (unit amplitude): fixed-fixed sin(i pi xi), fixed-free sin((2i-1) pi xi/2), free-free cos(i pi xi); i = 0 is the free-free rigid mode (summary notes B2). */
export function waveModeShape(bc: WaveBC, i: number, xi: number): number {
  if (bc === 'free-free') {
    checkMode(i, 0);
    return Math.cos(i * Math.PI * xi);
  }
  checkMode(i);
  return bc === 'fixed-fixed' ? sinPi(i * xi) : sinPi(((2 * i - 1) * xi) / 2);
}

/** Interior nodes (xi in (0,1)) of mode i: fixed-fixed k/i; fixed-free 2k/(2i-1); free-free (2k-1)/(2i) (zeros of waveModeShape). */
export function waveNodes(bc: WaveBC, i: number): number[] {
  const out: number[] = [];
  if (bc === 'free-free') {
    checkMode(i, 0);
    for (let k = 1; k <= i; k++) out.push((2 * k - 1) / (2 * i));
  } else if (bc === 'fixed-fixed') {
    checkMode(i);
    for (let k = 1; k < i; k++) out.push(k / i);
  } else {
    checkMode(i);
    for (let k = 1; k < i; k++) out.push((2 * k) / (2 * i - 1));
  }
  return out;
}

/**
 * First n roots z of z tan z = ratio (ratio = Ia/Ie, z = w L/c): a shaft fixed at one end with a rigid
 * disc Ie at the other (summary notes B2; also a fixed rod with an end mass, ratio = rod mass/end mass).
 * Root k lies in ((k-1) pi, (k-1) pi + pi/2). ratio = Infinity gives the fixed-free roots (2k-1) pi/2;
 * ratio = 0 (infinite disc) gives 0, pi, 2 pi, ...
 */
export function endInertiaRoots(ratio: number, n: number): number[] {
  const out: number[] = [];
  if (!(ratio >= 0)) return out;
  for (let k = 1; k <= n; k++) {
    const lo = (k - 1) * Math.PI;
    const hi = lo + Math.PI / 2;
    if (ratio === Infinity) {
      out.push(hi);
      continue;
    }
    if (ratio === 0) {
      out.push(lo);
      continue;
    }
    // z sin z - ratio cos z has no poles and the same roots as z tan z - ratio on the bracket.
    const f = (z: number) => z * Math.sin(z) - ratio * Math.cos(z);
    let z = brent(f, lo, hi, 1e-15);
    // Newton polish: improves the relative accuracy of tiny first roots (z1 ~ sqrt(ratio)).
    for (let it = 0; it < 3; it++) {
      const d = Math.sin(z) + z * Math.cos(z) + ratio * Math.sin(z);
      if (d === 0) break;
      const zn = z - f(z) / d;
      if (!(zn > lo && zn < hi) || zn === z) break;
      z = zn;
    }
    out.push(z);
  }
  return out;
}

/** Torsional frequencies (rad/s) of a shaft fixed at one end with a disc Ie at the other: w = z c/L with z tan z = Ia/Ie, Ia = rho J L, c = sqrt(G/rho) (summary notes B2). */
export function shaftEndInertiaOmegas(G: number, rho: number, J: number, L: number, Ie: number, n: number): number[] {
  const Ia = rho * J * L;
  const ratio = Ie > 0 ? Ia / Ie : Infinity;
  const c = shaftWaveSpeed(G, rho);
  return endInertiaRoots(ratio, n).map((z) => (z * c) / L);
}

/** Torsional stiffness of a uniform shaft k_t = G J/L (summary notes B2). */
export const torsionalStiffness = (G: number, J: number, L: number): number => (G * J) / L;

/** Polar second moment of a solid circular section J = pi d^4/32. */
export const polarMoment = (d: number): number => (Math.PI * d ** 4) / 32;

/** Polar second moment of a tube J = pi (dOut^4 - dIn^4)/32. */
export const polarMomentTube = (dOut: number, dIn: number): number => (Math.PI * (dOut ** 4 - dIn ** 4)) / 32;

/**
 * Modal amplitudes of a fixed-fixed string released from rest from a triangle of unit height with its
 * apex at xi = a: b_i = 2 sin(i pi a)/(i^2 pi^2 a (1 - a)), so y(xi, 0) = sum b_i sin(i pi xi) (LB2).
 * Limits a -> 0 and a -> 1 give the ramps 1 - xi and xi (b_i = 2/(i pi) and 2(-1)^(i+1)/(i pi)).
 */
export function pluckAmplitudes(a: number, n: number): number[] {
  const out: number[] = [];
  for (let i = 1; i <= n; i++) {
    if (!(a >= 0 && a <= 1)) out.push(NaN);
    else if (a === 0) out.push(2 / (i * Math.PI));
    else if (a === 1) out.push(((i % 2 ? 2 : -2) / (i * Math.PI)));
    else out.push((2 * sinPi(i * a)) / (i * i * Math.PI * Math.PI * a * (1 - a)));
  }
  return out;
}

/** Mode numbers i <= n with a node at xi = xt (|sin(i pi xt)| < tol): the harmonics that survive a light touch there (summary notes B2). */
export function touchedHarmonics(xt: number, n: number, tol = 1e-9): number[] {
  const out: number[] = [];
  for (let i = 1; i <= n; i++) if (Math.abs(sinPi(i * xt)) < tol) out.push(i);
  return out;
}

/** Tension in a cable of length l rotating at Omega about one end with a mass m at the other, at radius x: T(x) = Omega^2 [m l + rhoL (l^2 - x^2)/2] (summary notes B2). */
export const rotatingCableTension = (x: number, Omega: number, m: number, rhoL: number, l: number): number =>
  Omega * Omega * (m * l + (rhoL * (l * l - x * x)) / 2);

/** Tension in the string of a swinging weight at angle theta (amplitude theta0): T = m g (3 cos theta - 2 cos theta0), largest at the bottom (summary notes B2). */
export const swingTension = (m: number, theta: number, theta0: number, g: number = GRAVITY): number =>
  m * g * (3 * Math.cos(theta) - 2 * Math.cos(theta0));

/** SDOF model of a fixed-free rod of mass m: k = E A/L, meq = 4 m/pi^2, so sqrt(k/meq) = pi c/(2L) matches w1 (summary notes B2). */
export function rodEquivalentSdof(E: number, A: number, L: number, m: number): { k: number; meq: number } {
  return { k: (E * A) / L, meq: (4 * m) / (Math.PI * Math.PI) };
}
