// Forced response of uniform beams by modal analysis (summary notes B4; LB6).
// A point load P sin(Omega t) at xe gives y(x, t) = sum a_i Y_i(x) sin(Omega t), with the modes of
// beams.ts normalised to integral Y^2 dx = L. Positions x and xe are fractions of L.
import { type BeamBC, betaL, modeShape, beamBCInfo, rigidModeShape } from './beams';

/** Dynamic (magnification) factor 1/(1 - Omega^2/w^2): large near resonance, negative (out of phase) above it, infinite at Omega = w (summary notes B4). */
export const dynamicFactor = (Omega: number, w: number): number => 1 / (1 - (Omega * Omega) / (w * w));

/** Rotating-unbalance force amplitude P = m e Omega^2 (summary notes B4). */
export const unbalanceForce = (m: number, e: number, Omega: number): number => m * e * Omega * Omega;

export interface ModalAmplitudeParams {
  bc: BeamBC;
  /** Elastic mode number (1-based). */
  i: number;
  /** Load position as a fraction of L. */
  xe: number;
  /** Forcing frequency, rad/s. */
  Omega: number;
  /** Natural frequency of mode i, rad/s. */
  omega_i: number;
  /** Force amplitude, N. */
  P: number;
  L: number;
  EI: number;
}

/** Modal amplitude a_i = P L^3 Y_i(xe)/(EI (beta_i L)^4 (1 - Omega^2/omega_i^2)), xe as a fraction of L (summary notes B4; LB6). */
export function modalAmplitude(p: ModalAmplitudeParams): number {
  const bL = betaL(p.bc, p.i)[p.i - 1];
  const stat = (p.P * p.L ** 3 * modeShape(p.bc, p.i, p.xe)) / (p.EI * bL ** 4);
  return stat * dynamicFactor(p.Omega, p.omega_i);
}

export interface BeamResponseParams {
  bc: BeamBC;
  /** Output position as a fraction of L. */
  x: number;
  /** Load position as a fraction of L. */
  xe: number;
  /** Forcing frequency, rad/s. */
  Omega: number;
  /** Force amplitude, N. */
  P: number;
  L: number;
  EI: number;
  /** Mass per unit length rho A, kg/m. */
  rhoA: number;
  /** Number of elastic modes summed (default 3, as in the course). */
  nModes?: number;
  /** Add the rigid-body modes of free-free and free-pinned beams (default true). */
  includeRigid?: boolean;
}

export interface BeamResponse {
  /** Response amplitude at x (m): yRigid + sum a_i Y_i(x). In phase with the force when positive. */
  y: number;
  /** Elastic modal amplitudes a_i (index k is mode k + 1). */
  a: number[];
  /** Elastic natural frequencies (rad/s), same indexing as a. */
  omegas: number[];
  /** Rigid-body modal amplitudes (free-free: translation, rotation; free-pinned: rotation); empty otherwise. */
  aRigid: number[];
  /** Rigid-body part of y (0 for beams without rigid-body modes, so then y = sum a_i Y_i(x)). */
  yRigid: number;
}

/**
 * Steady-state amplitude y = sum a_i Y_i(x) of a uniform beam under P sin(Omega t) at xe, from the first
 * nModes elastic modes (summary notes B4; LB6). For free-free and free-pinned beams the rigid-body modes
 * are added (modal mass rhoA L, w = 0: a_r = -P Y_r(xe)/(rhoA L Omega^2)), unless includeRigid is false.
 */
export function beamResponse(p: BeamResponseParams): BeamResponse {
  const n = p.nModes ?? 3;
  const roots = betaL(p.bc, n);
  const scale = Math.sqrt(p.EI / (p.rhoA * p.L ** 4));
  const omegas = roots.map((bL) => bL * bL * scale);
  const a = omegas.map((w, k) =>
    modalAmplitude({ bc: p.bc, i: k + 1, xe: p.xe, Omega: p.Omega, omega_i: w, P: p.P, L: p.L, EI: p.EI })
  );
  let y = 0;
  for (let k = 0; k < n; k++) y += a[k] * modeShape(p.bc, k + 1, p.x);
  const aRigid: number[] = [];
  let yRigid = 0;
  if (p.includeRigid !== false) {
    const nr = beamBCInfo(p.bc).rigidModes;
    for (let r = 1; r <= nr; r++) {
      const ar = (-p.P * rigidModeShape(p.bc, r, p.xe)) / (p.rhoA * p.L * p.Omega * p.Omega);
      aRigid.push(ar);
      yRigid += ar * rigidModeShape(p.bc, r, p.x);
    }
  }
  return { y: y + yRigid, a, omegas, aRigid, yRigid };
}
