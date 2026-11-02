// Extra pure functions for topic C2 (FRFs and modal parameters). SI units, rad/s unless named Hz.
// Core FRF models live in src/physics/frf.ts (sdofReceptance, toMobility, toAccelerance, modalSumFRF,
// halfPower); these helpers add the closed forms the simulations and generators need.
import { type C, cabs, cdiv } from '../../physics/complex';
import { toAccelerance, toMobility } from '../../physics/frf';

export const TAU = 2 * Math.PI;

export type FrfForm = 'H' | 'M' | 'A';

/** Convert a receptance value to the requested form at w (rad/s): mobility i w H, accelerance −w² H (LC2-7). */
export function asForm(H: C, w: number, form: FrfForm): C {
  return form === 'H' ? H : form === 'M' ? toMobility(H, w) : toAccelerance(H, w);
}

/**
 * Half-power frequencies of an SDOF receptance using the reader's reference |H(wn)|/√2 (LC2-4, Eq 2.5):
 * beta^2 = 1 − 2 zeta^2 ∓ 2 zeta sqrt(1 + zeta^2). (Reference |H|max/√2 instead: 1 − 2 zeta^2 ∓ 2 zeta sqrt(1 − zeta^2).)
 */
export function halfPowerExact(wn: number, zeta: number): [number, number] {
  const a = 1 - 2 * zeta * zeta;
  const d = 2 * zeta * Math.sqrt(1 + zeta * zeta);
  return [wn * Math.sqrt(Math.max(0, a - d)), wn * Math.sqrt(a + d)];
}

/** Half-power frequencies referenced to the true maximum |H|max/√2 (summary notes): 1 − 2 zeta^2 ∓ 2 zeta sqrt(1 − zeta^2). */
export function halfPowerFromMax(wn: number, zeta: number): [number, number] {
  const a = 1 - 2 * zeta * zeta;
  const d = 2 * zeta * Math.sqrt(1 - zeta * zeta);
  return [wn * Math.sqrt(Math.max(0, a - d)), wn * Math.sqrt(a + d)];
}

/** Points where |H| = |H(wn)|/2 (a classic mistake, "half amplitude"): 1 − 2 zeta^2 ∓ 2 zeta sqrt(3 + zeta^2). */
export function halfAmplitudePoints(wn: number, zeta: number): [number, number] {
  const a = 1 - 2 * zeta * zeta;
  const d = 2 * zeta * Math.sqrt(3 + zeta * zeta);
  return [wn * Math.sqrt(Math.max(0, a - d)), wn * Math.sqrt(a + d)];
}

/** Real-part extremes of an SDOF receptance (LC2-5): at wn sqrt(1 ∓ 2 zeta), values ±1/(4 zeta (1 ∓ zeta) k). */
export function realExtremes(k: number, wn: number, zeta: number) {
  return {
    w1: wn * Math.sqrt(1 - 2 * zeta),
    w2: wn * Math.sqrt(1 + 2 * zeta),
    v1: 1 / (4 * zeta * (1 - zeta) * k),
    v2: -1 / (4 * zeta * (1 + zeta) * k),
  };
}

/** Eq 2.8 estimate zeta = (w2 − w1)/(2 wn). */
export const zetaEq28 = (w1: number, w2: number, wn: number): number => (w2 - w1) / (2 * wn);

/** Log decrement delta = ln(X0/Xm)/m and zeta = delta/sqrt(4 pi^2 + delta^2) (LC2-6, Eq 2.9). */
export function zetaFromDecay(X0: number, Xm: number, m: number): { delta: number; zeta: number } {
  const delta = Math.log(X0 / Xm) / m;
  return { delta, zeta: delta / Math.sqrt(4 * Math.PI * Math.PI + delta * delta) };
}

/** Pinned–pinned beam mode shape sin(n pi x/L), x as a fraction of L (summary notes B3). */
export const pinnedShape = (n: number, xL: number): number => {
  const v = Math.sin(n * Math.PI * xL);
  // sin(nπ) is 1.2×10⁻¹⁶, not 0: clean round-off so a support or node really is a node.
  return Math.abs(v) < 1e-12 ? 0 : v;
};

/**
 * FRF between points xi and xj (fractions of L) of a pinned–pinned beam from a modal sum with unit modal
 * masses: H = sum_r phi_r(xi) phi_r(xj)/(w_r^2 − w^2 + 2 i zeta w_r w), w_r = r^2 w1 (LC2-8 Eq for H; B3 shapes).
 */
export function beamFRF(xi: number, xj: number, w: number, w1: number, zeta: number, nModes: number, form: FrfForm): C {
  let H: C = { re: 0, im: 0 };
  for (let r = 1; r <= nModes; r++) {
    const wr = r * r * w1;
    const num = pinnedShape(r, xi) * pinnedShape(r, xj);
    const t = cdiv({ re: num, im: 0 }, { re: wr * wr - w * w, im: 2 * zeta * wr * w });
    H = { re: H.re + t.re, im: H.im + t.im };
  }
  return asForm(H, w, form);
}

/** Point-mass receptance −1/(m w^2) ("mass line"; 2021 A3.2). */
export const pointMassReceptance = (m: number, w: number): number => -1 / (m * w * w);

/** Magnitude helper. */
export const mag = (z: C): number => cabs(z);
