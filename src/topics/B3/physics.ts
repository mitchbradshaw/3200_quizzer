// Topic-local helpers for B3 (pure functions, SI units, rad/s unless named Hz).
// The core beam physics (roots, exact mode shapes, nodes, sections) lives in src/physics/beams.ts;
// this file adds labels, the handout's rounded table, section-scaling shortcuts and static deflections.
import { type BeamBC, betaL } from '../../physics/beams';

/** Order used in selectors: the exam's most common cases first. */
export const BC_ORDER: BeamBC[] = ['clamped-free', 'pinned-pinned', 'clamped-clamped', 'free-free', 'clamped-pinned', 'free-pinned'];

export const BC_SHORT: Record<BeamBC, string> = {
  'clamped-free': 'C–F',
  'pinned-pinned': 'P–P',
  'clamped-clamped': 'C–C',
  'free-free': 'F–F',
  'clamped-pinned': 'C–P',
  'free-pinned': 'F–P',
};

export const BC_NAME: Record<BeamBC, string> = {
  'clamped-free': 'clamped–free (cantilever)',
  'pinned-pinned': 'pinned–pinned (simply supported)',
  'clamped-clamped': 'clamped–clamped',
  'free-free': 'free–free',
  'clamped-pinned': 'clamped–pinned',
  'free-pinned': 'free–pinned',
};

/** Physical examples that call for each row of the table (method-choice cues). */
export const BC_CUE: Record<BeamBC, string> = {
  'clamped-free': 'wing fixed at the fuselage, blade fixed at the hub, boom, diving board',
  'pinned-pinned': 'shaft in two bearings, simply supported floor beam, contact wire',
  'clamped-clamped': 'beam clamped between massive posts, drill rod embedded at both ends',
  'free-free': 'fuselage or arrow in flight, javelin, racquet in play',
  'clamped-pinned': 'beam built in at one end and resting on a pin at the other',
  'free-pinned': 'beam pinned at one end, free at the other (one rigid-body rotation)',
};

/** Rigid-body (ω = 0) modes of each BC, which the handout table does not list. */
export const RIGID: Record<BeamBC, number> = {
  'clamped-free': 0,
  'pinned-pinned': 0,
  'clamped-clamped': 0,
  'free-free': 2,
  'clamped-pinned': 0,
  'free-pinned': 1,
};

/** The handout table exactly as printed (reader p. 91 / p. 214): βᵢL and C₁ for modes 1–5. */
export const HANDOUT: Record<BeamBC, { bL: number[]; C1: number[] }> = {
  'pinned-pinned': { bL: [3.142, 6.283, 9.425, 12.566, 15.708], C1: [1.414, 1.414, 1.414, 1.414, 1.414] },
  'clamped-clamped': { bL: [4.73, 7.853, 10.996, 14.137, 17.279], C1: [0.9825, 1.00077, 0.999966, 1.0000014, 0.99999994] },
  'free-free': { bL: [4.73, 7.853, 10.996, 14.137, 17.279], C1: [0.9825, 1.00077, 0.999966, 1.0000014, 0.99999994] },
  'clamped-free': { bL: [1.875, 4.694, 7.855, 10.996, 14.137], C1: [0.734, 1.019, 0.9992, 1.00003, 0.9999986] },
  'clamped-pinned': { bL: [3.927, 7.069, 10.21, 13.352, 16.493], C1: [1.001, 1.0, 1.0, 1.0, 1.0] },
  'free-pinned': { bL: [3.927, 7.069, 10.21, 13.352, 16.493], C1: [1.001, 1.0, 1.0, 1.0, 1.0] },
};

/**
 * Mode shape evaluated with the handout's rounded βᵢL and C₁ (handout formulas, x from the first-named end):
 * P–P C₁ sin βx; C–C, C–F, C–P cosh βx − cos βx − C₁(sinh βx − sin βx); F–F, F–P cosh βx + cos βx − C₁(sinh βx + sin βx).
 * Near a free end the rounding shows: cantilever mode 2 gives Y(L) = −2.03 instead of −2 (handout footnote).
 */
export function handoutModeShape(bc: BeamBC, i: number, xi: number): number {
  const row = HANDOUT[bc];
  const l = row.bL[i - 1];
  const c = row.C1[i - 1];
  const z = l * xi;
  if (bc === 'pinned-pinned') return c * Math.sin(z);
  if (bc === 'free-free' || bc === 'free-pinned') return Math.cosh(z) + Math.cos(z) - c * (Math.sinh(z) + Math.sin(z));
  return Math.cosh(z) - Math.cos(z) - c * (Math.sinh(z) - Math.sin(z));
}

/** β₁L of a boundary condition (exact root). */
export const beta1L = (bc: BeamBC): number => betaL(bc, 1)[0];

/** (βᵢL/β₁L)², the ratio trick factor ωᵢ/ω₁. */
export const ratioTrick = (bc: BeamBC, i: number): number => {
  const r = betaL(bc, i);
  return (r[i - 1] / r[0]) ** 2;
};

/** Factor on ω₁ when the boundary conditions change from `from` to `to` (same L and section): (β₁L_to/β₁L_from)². */
export const bcChangeFactor = (from: BeamBC, to: BeamBC): number => (beta1L(to) / beta1L(from)) ** 2;

// ------------------------------------------------------------------ section scaling

/** Radius of gyration √(I/A) of a thin tube of mean diameter d: r/√2 = d/(2√2) (I ≈ πr³t, A ≈ 2πrt). */
export const rgTube = (d: number): number => d / (2 * Math.SQRT2);

/** Radius of gyration √(I/A) of a solid rectangle bending across its depth h: h/√12. */
export const rgRect = (h: number): number => h / Math.sqrt(12);

/** ωᵢ = (βᵢL)² (r_g/L²) √(E/ρ), the same as (βᵢL)²√(EI/(ρA L⁴)) with I/A = r_g². */
export const omegaFromRg = (bL: number, rg: number, L: number, E: number, rho: number): number => ((bL * bL * rg) / (L * L)) * Math.sqrt(E / rho);

/** Radius of gyration that puts mode 1 exactly at ω: r_g = ω L²/((β₁L)² √(E/ρ)). */
export const rgForOmega = (omega: number, bL: number, L: number, E: number, rho: number): number => (omega * L * L) / (bL * bL * Math.sqrt(E / rho));

/** Length that puts the mode with root βL at ω: L = √((βL)² r_g √(E/ρ)/ω). */
export const lengthForOmega = (omega: number, bL: number, rg: number, E: number, rho: number): number => Math.sqrt((bL * bL * rg * Math.sqrt(E / rho)) / omega);

/** Torsional wave speed c_T = √(G/ρ) with G = E/(2(1 + ν)) (LB3). */
export const torsionWaveSpeed = (E: number, nu: number, rho: number): number => Math.sqrt(E / (2 * (1 + nu)) / rho);

/**
 * Static deflection coefficient c in δ = c P L³/EI for a point load at the standard point:
 * cantilever tip load at the tip 1/3; pinned–pinned mid-span 1/48; clamped–clamped mid-span 1/192;
 * clamped–pinned mid-span (deflection under the load) 7/768. Free–free and free–pinned have rigid-body
 * modes, so no static stiffness: null.
 */
export function staticCoefficient(bc: BeamBC): { c: number; where: string } | null {
  switch (bc) {
    case 'clamped-free':
      return { c: 1 / 3, where: 'tip load, tip deflection' };
    case 'pinned-pinned':
      return { c: 1 / 48, where: 'mid-span load and deflection' };
    case 'clamped-clamped':
      return { c: 1 / 192, where: 'mid-span load and deflection' };
    case 'clamped-pinned':
      return { c: 7 / 768, where: 'mid-span load and deflection' };
    default:
      return null;
  }
}

// ------------------------------------------------------------------ materials (course values)

export interface Material {
  id: string;
  label: string;
  E: number;
  rho: number;
  nu: number;
}

export const MATERIALS: Material[] = [
  { id: 'steel', label: 'Steel', E: 210e9, rho: 7850, nu: 0.3 },
  { id: 'al', label: 'Aluminium', E: 70e9, rho: 2700, nu: 0.33 },
  { id: 'cfrp', label: 'CFRP', E: 280e9, rho: 1600, nu: 0.3 },
  { id: 'gfrp', label: 'GFRP', E: 40e9, rho: 1900, nu: 0.3 },
  { id: 'blade', label: 'Blade composite', E: 13.23e9, rho: 1820, nu: 0.38 },
];

export const materialById = (id: string): Material => MATERIALS.find((m) => m.id === id) ?? MATERIALS[0];
