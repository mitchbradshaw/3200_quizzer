// Topic-local helpers for B4 (pure functions). Forced response of uniform beams by modal superposition,
// written in units of P L³/EI with the forcing frequency as a ratio r₁ = Ω/ω₁ (exact βL roots and the
// handout normalisation ∫Y² dx = L). The physical-units version is src/physics/forcedBeam.ts.
import { type BeamBC, betaL, modeShape } from '../../physics/beams';

export interface Load {
  /** Position as a fraction of L. */
  xi: number;
  /** Relative amplitude (default 1); all loads in phase. */
  w?: number;
}

export interface ModalRow {
  i: number;
  bL: number;
  /** (βᵢL)⁴, the modal stiffness factor. */
  bL4: number;
  /** ωᵢ/ω₁ = (βᵢL/β₁L)². */
  wr: number;
  /** Ω/ωᵢ. */
  r: number;
  /** Dynamic factor 1/(1 − Ω²/ωᵢ²): negative (out of phase) above ωᵢ. */
  DF: number;
  /** Σ wₖ Yᵢ(ξₖ): how hard the loads drive mode i (0 at a node). */
  Ye: number;
  /** Yᵢ at the output point. */
  Yout: number;
  /** Modal amplitude aᵢ = Ye · DF/(βᵢL)⁴ in units of P L³/EI. */
  a: number;
  /** Contribution aᵢ Yᵢ(ξ_out) to the output, in P L³/EI. */
  y: number;
}

/** Mode value with round-off at an exact node (e.g. 1e-16 at mid-span for an even mode) snapped to 0. */
export const modeAt = (bc: BeamBC, i: number, xi: number): number => {
  const y = modeShape(bc, i, xi);
  return Math.abs(y) < 1e-12 ? 0 : y;
};

/**
 * Modal table for in-phase point loads at ξₖ (amplitudes wₖ P), forcing at Ω = r₁ ω₁, output at ξ_out:
 * aᵢ = [1/(βᵢL)⁴] (P L³/EI) [1/(1 − Ω²/ωᵢ²)] Σ wₖ Yᵢ(ξₖ)   (LB6 boxed result p. 105; summary notes B4).
 */
export function modalTable(bc: BeamBC, loads: Load[], r1: number, xout: number, n = 3): ModalRow[] {
  const roots = betaL(bc, n);
  const b1 = roots[0];
  return roots.map((bL, k) => {
    const i = k + 1;
    const wr = (bL / b1) ** 2;
    const r = r1 / wr;
    const DF = 1 / (1 - r * r);
    const Ye = loads.reduce((s, l) => s + (l.w ?? 1) * modeAt(bc, i, l.xi), 0);
    const Yout = modeAt(bc, i, xout);
    const bL4 = bL ** 4;
    const a = (Ye * DF) / bL4;
    return { i, bL, bL4, wr, r, DF, Ye, Yout, a, y: a * Yout };
  });
}

/** Response Σ aᵢ Yᵢ(ξ_out) of the first n modes, in units of P L³/EI. */
export const responseFactor = (bc: BeamBC, loads: Load[], r1: number, xout: number, n = 3): number =>
  modalTable(bc, loads, r1, xout, n).reduce((s, m) => s + m.y, 0);

/** Largest |Σ aᵢ Yᵢ(x)| along the beam (n modes, sampled) and where it occurs (fraction of L). */
export function maxAlongBeam(bc: BeamBC, loads: Load[], r1: number, n = 3, samples = 400): { y: number; x: number } {
  const rows = modalTable(bc, loads, r1, 0, n);
  let best = { y: 0, x: 0 };
  for (let k = 0; k <= samples; k++) {
    const x = k / samples;
    let y = 0;
    for (const m of rows) y += m.a * modeShape(bc, m.i, x);
    if (Math.abs(y) > Math.abs(best.y)) best = { y, x };
  }
  return best;
}

/**
 * Mode-1-only ratio of unbalance responses at two speeds (P = meΩ², so the force grows as Ω²):
 * y(Ω_b)/y(Ω_a) = (Ω_b/Ω_a)² (1 − Ω_a²/ω₁²)/(1 − Ω_b²/ω₁²) = (ω₁²/Ω_a² − 1)/(ω₁²/Ω_b² − 1)  (summary notes B4).
 */
export const unbalanceRatioMode1 = (ra: number, rb: number): number => ((rb * rb) / (ra * ra)) * ((1 - ra * ra) / (1 - rb * rb));

/** Index (1-based) of the largest |contribution| and its share of Σ|contributions|. */
export function dominant(rows: ModalRow[]): { i: number; share: number } {
  const tot = rows.reduce((s, m) => s + Math.abs(m.y), 0);
  let best = rows[0];
  for (const m of rows) if (Math.abs(m.y) > Math.abs(best.y)) best = m;
  return { i: best.i, share: tot > 0 ? Math.abs(best.y) / tot : 0 };
}

// ------------------------------------------------------------------ the 2022 eVTOL wing (B2.3–B2.4)

export const WING = { E: 280e9, rho: 1600, L: 3, w: 0.4212, xA: 0.5, xB: 0.9 };

/**
 * Tip amplitude (m) of the 2022 eVTOL wing (cantilever, rotors at 0.5L and 0.9L in phase, each meΩ²):
 * in-plane bending uses I = t w³/12 (ω ∝ w, independent of t); out-of-plane I = w t³/12 (ω ∝ t).
 */
export function wingTip(opts: { t: number; w?: number; plane: 'in' | 'out'; rpm: number; me: number; n?: number }): number {
  const w = opts.w ?? WING.w;
  const { E, rho, L, xA, xB } = WING;
  const depth = opts.plane === 'in' ? w : opts.t;
  const I = opts.plane === 'in' ? (opts.t * w ** 3) / 12 : (w * opts.t ** 3) / 12;
  const b1 = betaL('clamped-free', 1)[0];
  const w1 = b1 * b1 * (depth / (L * L)) * Math.sqrt(E / (12 * rho));
  const Om = (2 * Math.PI * opts.rpm) / 60;
  const P = opts.me * Om * Om;
  const S = responseFactor('clamped-free', [{ xi: xA }, { xi: xB }], Om / w1, 1, opts.n ?? 4);
  return (S * P * L ** 3) / (E * I);
}

/** First n natural frequencies (Hz) of the wing for the bending plane. */
export function wingFreqs(t: number, plane: 'in' | 'out', n = 4, w = WING.w): number[] {
  const depth = plane === 'in' ? w : t;
  const { E, rho, L } = WING;
  return betaL('clamped-free', n).map((b) => (b * b * (depth / (L * L)) * Math.sqrt(E / (12 * rho))) / (2 * Math.PI));
}
