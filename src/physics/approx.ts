// Approximate methods: Rayleigh, Dunkerley, Holzer, and the added-mass results used in B2 design
// questions (summary notes B5; LB7–LB8). SI units, rad/s.
import { simpson } from './integrate';
import { brent } from './roots';
import { betaL, cantileverTipLoadShape, cantileverTipLoadShapeD2, cantileverUdlShape, cantileverUdlShapeD2 } from './beams';

// ---------------------------------------------------------------------------------------------
// Rayleigh's energy method
// ---------------------------------------------------------------------------------------------

export interface RayleighParams {
  /** Beam length, m. */
  L: number;
  /** Flexural rigidity EI (N m^2), constant or a function of x in metres. */
  EI: number | ((x: number) => number);
  /** Mass per unit length rho A (kg/m), constant or a function of x in metres. */
  rhoA: number | ((x: number) => number);
  /** Trial shape phi(x), x in metres; it must satisfy the geometric BCs. */
  phi: (x: number) => number;
  /** Its second derivative d2phi/dx2 (1/m^2 times the shape's units), x in metres. */
  phi2: (x: number) => number;
  /** Lumped masses M (kg) at positions x (m). */
  masses?: { x: number; M: number }[];
  /** Simpson intervals on [0, L] (default 1000). */
  n?: number;
}

/** Rayleigh: w^2 = int EI phi''^2 dx / (int rhoA phi^2 dx + sum M_k phi(x_k)^2), x in metres; an upper bound for the fundamental (summary notes B5; LB7 Eq 7.14). */
export function rayleighOmega(p: RayleighParams): number {
  const n = p.n ?? 1000;
  const EIv = p.EI;
  const rAv = p.rhoA;
  const EI = typeof EIv === 'function' ? EIv : () => EIv;
  const rhoA = typeof rAv === 'function' ? rAv : () => rAv;
  const Vmax = simpson((x) => EI(x) * p.phi2(x) ** 2, 0, p.L, n);
  let Tmax = simpson((x) => rhoA(x) * p.phi(x) ** 2, 0, p.L, n);
  for (const m of p.masses ?? []) Tmax += m.M * p.phi(m.x) ** 2;
  if (!(Tmax > 0)) return Infinity;
  return Math.sqrt(Math.max(0, Vmax) / Tmax);
}

export interface TrialShape {
  id: string;
  label: string;
  /** KaTeX for phi(xi), xi = x/L. */
  tex: string;
  /** phi(xi), unit value at the reference point (tip or mid-span). */
  phi: (xi: number) => number;
  /** d2phi/dxi2 (callers scale by 1/L^2 for d2phi/dx2). */
  phi2: (xi: number) => number;
  /** Satisfies the geometric (displacement/slope) BCs: required for Rayleigh. */
  geometricBCs: boolean;
  /** Also satisfies the natural (zero moment and shear at free ends, zero moment at pins) BCs. */
  naturalBCs: boolean;
}

/** Pinned beam under a central load, unit mid-span value: phi = xi (3 - 4 xi^2) for xi <= 1/2, mirrored. */
const pinnedMidLoadShape = (xi: number): number => {
  const s = xi <= 0.5 ? xi : 1 - xi;
  return s * (3 - 4 * s * s);
};
const pinnedMidLoadShapeD2 = (xi: number): number => -24 * (xi <= 0.5 ? xi : 1 - xi);

/** Rayleigh trial shapes from LB7 (xi = x/L; phi2 = d2phi/dxi2). The cantilever results with a tip mass M are w^2 = c EI/(L^3 (M + m rhoA L)) with (c, m) = (3, 33/140), (3.2, 0.257), (4, 0.2), (3.04, 0.227). */
export const TRIAL_SHAPES: Record<'cantilever' | 'pinned', TrialShape[]> = {
  cantilever: [
    {
      id: 'cant-tip-load',
      label: 'Static deflection under a tip load',
      tex: '\\phi = \\tfrac12\\left(3\\xi^2 - \\xi^3\\right)',
      phi: cantileverTipLoadShape,
      phi2: cantileverTipLoadShapeD2,
      geometricBCs: true,
      naturalBCs: false, // zero tip moment, but the tip shear is the (non-zero) tip load
    },
    {
      id: 'cant-udl',
      label: 'Static deflection under a uniform load',
      tex: '\\phi = \\tfrac13\\left(6\\xi^2 - 4\\xi^3 + \\xi^4\\right)',
      phi: cantileverUdlShape,
      phi2: cantileverUdlShapeD2,
      geometricBCs: true,
      naturalBCs: true,
    },
    {
      id: 'cant-xi2',
      label: 'Parabola ξ²',
      tex: '\\phi = \\xi^2',
      phi: (xi) => xi * xi,
      phi2: () => 2,
      geometricBCs: true,
      naturalBCs: false, // non-zero tip moment and shear
    },
    {
      id: 'cant-cos',
      label: 'Quarter cosine 1 − cos(πξ/2)',
      tex: '\\phi = 1 - \\cos\\left(\\tfrac{\\pi\\xi}{2}\\right)',
      phi: (xi) => 1 - Math.cos((Math.PI * xi) / 2),
      phi2: (xi) => (Math.PI / 2) ** 2 * Math.cos((Math.PI * xi) / 2),
      geometricBCs: true,
      naturalBCs: false, // zero tip moment, non-zero tip shear
    },
  ],
  pinned: [
    {
      id: 'pin-sin',
      label: 'Half sine sin(πξ) (the exact first mode)',
      tex: '\\phi = \\sin(\\pi\\xi)',
      phi: (xi) => Math.sin(Math.PI * xi),
      phi2: (xi) => -(Math.PI ** 2) * Math.sin(Math.PI * xi),
      geometricBCs: true,
      naturalBCs: true,
    },
    {
      id: 'pin-parabola',
      label: 'Parabola ξ(1 − ξ) (scaled to 1 at mid-span)',
      tex: '\\phi = 4\\xi(1 - \\xi)',
      phi: (xi) => 4 * xi * (1 - xi),
      phi2: () => -8,
      geometricBCs: true,
      naturalBCs: false, // non-zero moment at the pins
    },
    {
      id: 'pin-mid-load',
      label: 'Static deflection under a central load',
      tex: '\\phi = \\xi\\left(3 - 4\\xi^2\\right),\\ \\xi \\le \\tfrac12 \\text{ (mirrored)}',
      phi: pinnedMidLoadShape,
      phi2: pinnedMidLoadShapeD2,
      geometricBCs: true,
      naturalBCs: true,
    },
  ],
};

/** Rayleigh estimate for a uniform beam with a dimensionless trial shape: rayleighOmega with phi(x) = s.phi(x/L), phi''(x) = s.phi2(x/L)/L^2 (LB7). */
export function rayleighFromTrial(
  s: Pick<TrialShape, 'phi' | 'phi2'>,
  L: number,
  EI: number,
  rhoA: number,
  masses: { x: number; M: number }[] = [],
  n?: number
): number {
  return rayleighOmega({ L, EI, rhoA, phi: (x) => s.phi(x / L), phi2: (x) => s.phi2(x / L) / (L * L), masses, n });
}

// ---------------------------------------------------------------------------------------------
// Dunkerley and the stiffness at a lumped mass
// ---------------------------------------------------------------------------------------------

/** Dunkerley: 1/w^2 = sum 1/w_i^2 (w_ii = each mass alone on the massless structure, plus the structure alone); a lower bound (summary notes B5; LB8 Eq 8.1). */
export function dunkerley(omegas: number[]): number {
  let s = 0;
  for (const w of omegas) {
    if (w === 0) return 0;
    s += 1 / (w * w);
  }
  return s > 0 ? 1 / Math.sqrt(s) : Infinity;
}

/** Cantilever stiffness at distance x from the clamp, k = 3 EI/x^3 (tip: 3 EI/L^3; summary notes B5; LB8 Eq 8.2). */
export const cantileverStiffnessAt = (x: number, EI: number): number => (3 * EI) / x ** 3;

/** Pinned–pinned span Ls with the load at a: k = 3 EI Ls/(a^2 (Ls - a)^2) (mid-span 48 EI/Ls^3; summary notes B5). */
export const pinnedStiffnessAt = (a: number, Ls: number, EI: number): number => (3 * EI * Ls) / (a * a * (Ls - a) ** 2);

/** Clamped–clamped span Ls with the load at a: k = 3 EI Ls^3/(a^3 (Ls - a)^3) (mid-span 192 EI/Ls^3; tutorial W7.8). */
export const clampedStiffnessAt = (a: number, Ls: number, EI: number): number => (3 * EI * Ls ** 3) / (a ** 3 * (Ls - a) ** 3);

// ---------------------------------------------------------------------------------------------
// Added-mass results (summary notes B5 "handy results")
// ---------------------------------------------------------------------------------------------

/** beta1 L of a cantilever as printed on the formula sheet (summary notes B5 uses 1.875^4/3). */
const BL1_SHEET = 1.875;

/** Cantilever with a tip mass, Dunkerley: w1/w11 = [1 + (1.875^4/3)(M/(rhoA L))]^(-1/2) (summary notes B5; LB8). */
export const tipMassRatio = (M: number, rhoA: number, L: number): number =>
  1 / Math.sqrt(1 + (BL1_SHEET ** 4 / 3) * (M / (rhoA * L)));

/** Tip mass M (kg) that gives a measured fractional drop in w1 (drop = 0.05 means 5%), inverting tipMassRatio: M = (1/(1 - drop)^2 - 1)(3/1.875^4) rhoA L (summary notes B5). */
export function tipMassFromDrop(drop: number, rhoA: number, L: number): number {
  if (!(drop >= 0 && drop < 1)) return NaN;
  const r = 1 - drop;
  return ((1 / (r * r) - 1) * 3 * rhoA * L) / BL1_SHEET ** 4;
}

/** Pinned beam with a mid-span mass N rhoA L, Rayleigh with sin(pi x/L): w/w0 = 1/sqrt(1 + 2N) (summary notes B5). */
export const pinnedMidMassRatio = (N: number): number => 1 / Math.sqrt(1 + 2 * N);

/**
 * Exact fundamental (rad/s) of a uniform cantilever with a tip mass M: the smallest root l = beta L of
 * 1 + cos l cosh l + (M/(rhoA L)) l (cos l sinh l - sin l cosh l) = 0, w = l^2 sqrt(EI/(rhoA L^4)).
 * (Clamped at 0: Y'' (L) = 0 and EI Y'''(L) = -M w^2 Y(L).) Solved divided by cosh l; the root lies in
 * (0, 1.87510], so M = 0 recovers the bare cantilever and large M tends to sqrt(3EI/(L^3 (M + 0.2357 rhoA L))).
 */
export function cantileverTipMassExact(M: number, rhoA: number, L: number, EI: number): number {
  const scale = Math.sqrt(EI / (rhoA * L ** 4));
  const l1 = betaL('clamped-free', 1)[0];
  const mu = M / (rhoA * L);
  if (!(mu > 0)) return l1 * l1 * scale;
  const f = (l: number) => 1 / Math.cosh(l) + Math.cos(l) + mu * l * (Math.cos(l) * Math.tanh(l) - Math.sin(l));
  // f(0+) = 2 > 0 and f(l1) = -1.24 mu l1 < 0. For large mu the root is near (3/(mu + 0.25))^(1/4),
  // so bracket from well below that.
  if (!(f(l1) < 0)) return l1 * l1 * scale; // M so small that rounding hides the shift
  const guess = Math.pow(3 / (mu + 0.25), 0.25);
  const lo = Math.min(1e-3 * guess, 1e-3);
  const l = brent(f, lo, l1, 1e-15);
  return l * l * scale;
}

// ---------------------------------------------------------------------------------------------
// Holzer's method (LB8 Eqs 8.4–8.6)
// ---------------------------------------------------------------------------------------------

export interface HolzerResult {
  /** Angle of each disc (theta_1 = 1). */
  theta: number[];
  /** Torque transmitted past each disc, T_i = T_(i-1) + J_i w^2 theta_i. */
  torque: number[];
  /** Torque past the last disc, T_n: zero at a natural frequency (the right-hand end is free). */
  residual: number;
}

/**
 * Holzer march at a trial w (LB8 Eqs 8.4–8.6): theta_1 = 1, T_i = sum_{j<=i} J_j w^2 theta_j,
 * theta_(i+1) = theta_i - T_i/k_i; residual = T_n.
 * left = 'free': k[i] joins disc i to disc i + 1 (k.length >= J.length - 1).
 * left = 'fixed': k[0] joins the wall to disc 1 and k[i] joins disc i to disc i + 1 (k.length >= J.length).
 * The wall is station 0 with theta_0 = 0, so theta_1 = theta_0 - T_0/k[0] = 1 fixes the wall-shaft torque
 * T_0 = -k[0]; the march then continues as for a free end with T_i = T_(i-1) + J_i w^2 theta_i.
 * In both cases the far (right) end is free, so the residual is zero at a natural frequency.
 */
export function holzer(J: number[], k: number[], omega: number, left: 'free' | 'fixed' = 'free'): HolzerResult {
  const n = J.length;
  const off = left === 'fixed' ? 1 : 0;
  if (k.length < n - 1 + off) {
    throw new RangeError(`holzer: ${n} discs need ${n - 1 + off} shaft stiffnesses with left = '${left}' (got ${k.length})`);
  }
  const w2 = omega * omega;
  const theta: number[] = [];
  const torque: number[] = [];
  let th = 1;
  let T = left === 'fixed' ? -k[0] * th : 0;
  for (let i = 0; i < n; i++) {
    theta.push(th);
    T += J[i] * w2 * th;
    torque.push(T);
    if (i < n - 1) th -= T / k[i + off];
  }
  return { theta, torque, residual: n ? T : 0 };
}

/** Natural frequencies (rad/s) in [0, wMax] from sign changes of the Holzer residual T_n(w), refined with Brent; a free-free chain includes w = 0 (summary notes B5: "every mode of the lumped model, incl. w = 0"). */
export function holzerRoots(J: number[], k: number[], wMax: number, left: 'free' | 'fixed' = 'free'): number[] {
  const out: number[] = [];
  if (J.length === 0) return out;
  if (left === 'free') out.push(0); // T_n(0) = 0 exactly: the rigid-body mode
  if (!(wMax > 0)) return out;
  const res = (w: number) => holzer(J, k, w, left).residual;
  const N = Math.max(4000, 500 * J.length);
  // A free chain's residual is ~ w^2 sum J > 0 just above w = 0, so start the scan there.
  let w0 = left === 'free' ? wMax / (64 * N) : 0;
  let r0 = res(w0);
  for (let s = 1; s <= N; s++) {
    const w1 = (wMax * s) / N;
    const r1 = res(w1);
    if (r1 === 0) out.push(w1);
    else if (r0 * r1 < 0) out.push(brent(res, w0, w1, 1e-14));
    w0 = w1;
    r0 = r1;
  }
  return out;
}
