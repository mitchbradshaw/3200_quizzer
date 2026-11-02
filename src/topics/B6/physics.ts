// Pure helpers for the B2 design problem (summary notes B6 template; LB3–LB8). SI units, rad/s.
// Shared beam data come from physics/beams.ts; torsion from physics/waves.ts.
import { betaL, modeShape, type BeamBC } from '../../physics/beams';

export const TAU = 2 * Math.PI;

/** Thin rectangle bending across its dimension h (I/A = h^2/12): omega_i = (beta_i L)^2 (h/L^2) sqrt(E/(12 rho)); independent of the other side (summary notes B3). */
export const rectOmega = (bL: number, h: number, L: number, E: number, rho: number): number => bL * bL * (h / (L * L)) * Math.sqrt(E / (12 * rho));

/** Thin tube of mean diameter d (I/A = r^2/2): omega_i = (beta_i L)^2 (r/L^2) sqrt(E/(2 rho)); independent of the wall thickness. */
export const tubeOmega = (bL: number, d: number, L: number, E: number, rho: number): number => bL * bL * (d / 2 / (L * L)) * Math.sqrt(E / (2 * rho));

/** Section factor s with omega_i = (beta_i L)^2 (s/L^2): rectangle s = h sqrt(E/12rho); tube s = (d/2) sqrt(E/2rho). */
export const sectionFactor = (kind: 'rect' | 'tube', dim: number, E: number, rho: number): number =>
  kind === 'rect' ? dim * Math.sqrt(E / (12 * rho)) : (dim / 2) * Math.sqrt(E / (2 * rho));

/** Torsional wave speed from E and Poisson's ratio: c = sqrt(G/rho), G = E/(2(1 + nu)). */
export const torsionSpeed = (E: number, nu: number, rho: number): number => Math.sqrt(E / (2 * (1 + nu)) / rho);

/** Torsional natural frequency (Hz) of mode n: fixed–free (2n - 1)c/4L; fixed–fixed n c/2L (summary notes B6 step 3). */
export const torsionHz = (bc: 'fixed-free' | 'fixed-fixed', n: number, c: number, L: number): number => (bc === 'fixed-free' ? ((2 * n - 1) * c) / (4 * L) : (n * c) / (2 * L));

/** Bending-to-torsion BC names used in the sketches. */
export interface ModalTerm {
  i: number;
  bL4: number;
  /** Omega/omega_i. */
  r: number;
  dyn: number;
  /** Sum of Y_i at the force points. */
  yf: number;
  yo: number;
  /** Contribution to y(x_out) in units of P L^3/EI. */
  c: number;
}

/**
 * Modal-sum coefficient y(xo) / (P L^3/EI) for equal in-phase forces P sin(Omega t) at the positions xf (fractions of L):
 * sum over modes of [sum_f Y_i(xf)] Y_i(xo) / ((beta_i L)^4 (1 - Omega^2/omega_i^2)) (summary notes B4/B6; official 2018 B2.3 table).
 * r1 = Omega/omega_1; higher ratios follow from (beta_1/beta_i)^2.
 */
export function modalCoef(bc: BeamBC, xf: number[], xo: number, r1: number, n = 3): { total: number; terms: ModalTerm[] } {
  const roots = betaL(bc, n);
  const terms: ModalTerm[] = [];
  let total = 0;
  for (let k = 0; k < n; k++) {
    const i = k + 1;
    const bL4 = roots[k] ** 4;
    const r = r1 * (roots[0] / roots[k]) ** 2;
    const dyn = 1 / (1 - r * r);
    const yf = xf.reduce((s, x) => s + modeShape(bc, i, x), 0);
    const yo = modeShape(bc, i, xo);
    const c = (yf * yo * dyn) / bL4;
    terms.push({ i, bL4, r, dyn, yf, yo, c });
    total += c;
  }
  return { total, terms };
}

/** Largest |y(x)| along the beam for the same loading (coefficient in P L^3/EI), sampled at 201 points. */
export function modalCoefMax(bc: BeamBC, xf: number[], r1: number, n = 3): { value: number; at: number } {
  const roots = betaL(bc, n);
  const amps = roots.map((bl, k) => {
    const r = r1 * (roots[0] / bl) ** 2;
    return xf.reduce((s, x) => s + modeShape(bc, k + 1, x), 0) / (bl ** 4 * (1 - r * r));
  });
  let best = 0;
  let at = 0;
  for (let j = 0; j <= 200; j++) {
    const x = j / 200;
    const y = Math.abs(amps.reduce((s, a, k) => s + a * modeShape(bc, k + 1, x), 0));
    if (y > best) {
      best = y;
      at = x;
    }
  }
  return { value: best, at };
}

/** Southwell-type rotation stiffening for a cantilever blade spinning at Omega about its root: omega^2 = omega_0^2 + K_s Omega^2,
 *  with K_s = int (1 - xi^2)/2 Y'(xi)^2 dxi / int Y^2 dxi from the bare mode (Rayleigh with centrifugal tension, summary notes B6 validity). */
export function southwellCoef(mode = 1): number {
  const n = 400;
  let num = 0;
  let den = 0;
  for (let k = 0; k <= n; k++) {
    const xi = k / n;
    const w = k === 0 || k === n ? 1 : k % 2 ? 4 : 2;
    const h = 1e-5;
    const d = (modeShape('clamped-free', mode, Math.min(1, xi + h)) - modeShape('clamped-free', mode, Math.max(0, xi - h))) / (Math.min(1, xi + h) - Math.max(0, xi - h));
    num += (w * (1 - xi * xi) * d * d) / 2;
    den += w * modeShape('clamped-free', mode, xi) ** 2;
  }
  return num / den;
}

/** Ratio trick: omega_i/omega_1 = (beta_i L/beta_1 L)^2. */
export const ratios = (bc: BeamBC, n = 3): number[] => {
  const r = betaL(bc, n);
  return r.map((x) => (x / r[0]) ** 2);
};
