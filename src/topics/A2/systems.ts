// A2 system catalogue: each exam system as candidate energy "tiles". A tile is one body's or one
// spring's complete energy term (or a plausible wrong version of it). Placed in T it adds its `m`
// pieces to M; placed in V it adds its `k` pieces to K. Pieces carry a symbolic coefficient (for the
// live symbolic matrices in the Energy builder) and its numeric value (for checking and for Solve).
// Sources: research notes NP-01 to NP-11 (2021–2025 papers and worked solutions, official 2017–2019).
import type { TermDef, TermsPart } from '../../engine/types';
import type { Mat } from '../../physics/linalg';
import { G_STD, beltK, boxInertia, boxK, cartRodMK, hoodK, nestSwingMK, platformK } from './physics';
import { bouncePitchK } from '../../physics/rigidbody';

export type Bucket = 'T' | 'V' | 'none';

/** One symbolic piece of a matrix entry: coefficient of ½qᵢ² (i = j) or of qᵢqⱼ (i ≠ j). */
export interface Piece {
  i: number;
  j: number;
  tex: string;
  v: number;
}

export interface Tile {
  id: string;
  tex: string;
  /** Short label of what the term describes (e.g. "cart", "left spring"). */
  role: string;
  belongs: Bucket;
  why: string;
  m?: Piece[];
  k?: Piece[];
}

export interface SystemDef {
  id: string;
  name: string;
  source: string;
  coords: string[];
  coordTips: string[];
  tiles: Tile[];
  Msym: string[][];
  Ksym: string[][];
  M: Mat;
  K: Mat;
  /** Rich-text note on the coordinates and positive directions. */
  setup: string;
}

const P = (i: number, j: number, tex: string, v: number): Piece => ({ i, j, tex, v });

/** Assemble an n×n matrix from pieces (off-diagonal pieces fill both (i, j) and (j, i)). */
export function piecesToMat(n: number, pieces: Piece[] | undefined): Mat {
  const A = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (const p of pieces || []) {
    A[p.i][p.j] += p.v;
    if (p.i !== p.j) A[p.j][p.i] += p.v;
  }
  return A;
}

/** Symbolic sum of pieces for entry (i, j): "m + M", "-k_1 a + k_2 b", or "0". */
export function entryTeX(pieces: Piece[], i: number, j: number): string {
  const lo = Math.min(i, j);
  const hi = Math.max(i, j);
  const ps = pieces.filter((p) => Math.min(p.i, p.j) === lo && Math.max(p.i, p.j) === hi).map((p) => p.tex.trim());
  if (!ps.length) return '0';
  return ps.map((t, k) => (k === 0 ? t : t.startsWith('-') ? ` - ${t.slice(1)}` : ` + ${t}`)).join('');
}

/** Convert a system into a Solve 'terms' part (numeric M/K contributions per term). */
export function toTermsPart(sys: SystemDef, id: string, label: string, opts: { mUnit?: string; kUnit?: string; pick?: (t: Tile) => boolean; marks?: number } = {}): TermsPart {
  const n = sys.coords.length;
  const tiles = sys.tiles.filter((t) => t.belongs !== 'none' || !opts.pick || opts.pick(t));
  const terms: TermDef[] = tiles.map((t) => ({
    id: t.id,
    role: t.role,
    tex: t.tex,
    belongs: t.belongs,
    M: t.m ? piecesToMat(n, t.m) : undefined,
    K: t.k ? piecesToMat(n, t.k) : undefined,
    why: t.why,
  }));
  return { kind: 'terms', id, label, coords: sys.coords, terms, M: sys.M, K: sys.K, mUnit: opts.mUnit, kUnit: opts.kUnit, marks: opts.marks };
}

// ------------------------------------------------------------------ pendulum (rod) on a cart, 2022 A2

export function cartRodSystem(p: { m: number; M: number; L: number; k: number; g?: number }): SystemDef {
  const { m, M, L, k } = p;
  const g = p.g ?? G_STD;
  const mk = cartRodMK(m, M, L, k, g);
  return {
    id: 'cart',
    name: 'Rod swinging on a cart',
    source: '2022 A2',
    coords: ['x', '\\theta'],
    coordTips: ['cart displacement (m), positive to the right', 'rod angle from the downward vertical (rad), positive when the lower end swings towards +x'],
    setup: 'Cart $m$ on a spring $k$ to the wall; uniform rod (mass $M$, length $2L$) pinned at its top end to the cart. $x$: cart, $\\theta$: rod from the downward vertical; small angles.',
    tiles: [
      { id: 'cart-T', role: 'cart', tex: '$\\tfrac12 m\\dot x^2$', belongs: 'T', why: 'The cart only translates.', m: [P(0, 0, 'm', m)] },
      {
        id: 'rod-T',
        role: 'rod',
        tex: '$\\tfrac12 M(\\dot x + L\\dot\\theta)^2 + \\tfrac12\\left(\\tfrac13 ML^2\\right)\\dot\\theta^2$',
        belongs: 'T',
        why: 'Translation of G with its **absolute** velocity ($v_G \\approx \\dot x + L\\dot\\theta$ for small θ) plus rotation about G with $I_G = M(2L)^2/12 = ML^2/3$. Together they give $M_{22} = \\tfrac43 ML^2$ and the cross term $M_{12} = ML$.',
        m: [P(0, 0, 'M', M), P(0, 1, 'ML', M * L), P(1, 1, 'ML^2', M * L * L), P(1, 1, '\\tfrac13 ML^2', (M * L * L) / 3)],
      },
      {
        id: 'rod-fixed',
        role: 'rod',
        tex: '$\\tfrac12\\left(\\tfrac43 ML^2\\right)\\dot\\theta^2$ (rod as if pinned to the ground)',
        belongs: 'none',
        why: '$\\tfrac12 I_O\\dot\\theta^2$ is the whole kinetic energy only for a **fixed** pivot. This pivot rides on the cart, so the rod’s translation $\\tfrac12 M\\dot x^2$ and the coupling $ML\\dot x\\dot\\theta$ are lost.',
        m: [P(1, 1, '\\tfrac43 ML^2', (4 * M * L * L) / 3)],
      },
      {
        id: 'rod-double',
        role: 'rod',
        tex: '$\\tfrac12 M(\\dot x + L\\dot\\theta)^2 + \\tfrac12\\left(\\tfrac43 ML^2\\right)\\dot\\theta^2$',
        belongs: 'none',
        why: 'Double counting: $I_O = I_G + ML^2$ already contains the $ML^2$ that $\\tfrac12 M(\\dot x + L\\dot\\theta)^2$ adds. Use $I_G$ with $v_G$ (parallel-axis theorem), never both.',
        m: [P(0, 0, 'M', M), P(0, 1, 'ML', M * L), P(1, 1, 'ML^2', M * L * L), P(1, 1, '\\tfrac43 ML^2', (4 * M * L * L) / 3)],
      },
      {
        id: 'rod-tip',
        role: 'rod',
        tex: '$\\tfrac12 M(\\dot x + 2L\\dot\\theta)^2 + \\tfrac12\\left(\\tfrac13 ML^2\\right)\\dot\\theta^2$',
        belongs: 'none',
        why: 'G is the middle of the rod, a distance $L$ below the pivot, not the tip at $2L$.',
        m: [P(0, 0, 'M', M), P(0, 1, '2ML', 2 * M * L), P(1, 1, '4ML^2', 4 * M * L * L), P(1, 1, '\\tfrac13 ML^2', (M * L * L) / 3)],
      },
      { id: 'spring-V', role: 'spring', tex: '$\\tfrac12 kx^2$', belongs: 'V', why: 'The spring joins the wall to the cart, so it stretches by $x$ only.', k: [P(0, 0, 'k', k)] },
      {
        id: 'spring-rod',
        role: 'spring',
        tex: '$\\tfrac12 k(x + L\\theta)^2$',
        belongs: 'none',
        why: 'The spring is fixed to the cart, not to the rod: its stretch is $x$. Adding $L\\theta$ invents a lever arm and a fake coupling.',
        k: [P(0, 0, 'k', k), P(0, 1, 'kL', k * L), P(1, 1, 'kL^2', k * L * L)],
      },
      {
        id: 'grav-V',
        role: 'gravity',
        tex: '$MgL(1-\\cos\\theta) \\approx \\tfrac12 MgL\\,\\theta^2$',
        belongs: 'V',
        why: 'G rises $L(1-\\cos\\theta)$. Keeping $\\cos\\theta \\approx 1-\\theta^2/2$ gives the rod its gravity stiffness $MgL$.',
        k: [P(1, 1, 'MgL', M * g * L)],
      },
      {
        id: 'grav-cos1',
        role: 'gravity',
        tex: '$MgL(1-\\cos\\theta) \\approx 0$ (using $\\cos\\theta \\approx 1$)',
        belongs: 'none',
        why: 'With $\\cos\\theta \\approx 1$ the gravity term vanishes and the rod has no restoring stiffness. In V keep $1-\\theta^2/2$ (reader LA2 Example 2).',
      },
      {
        id: 'grav-tip',
        role: 'gravity',
        tex: '$\\tfrac12 Mg(2L)\\,\\theta^2$',
        belongs: 'none',
        why: 'The weight acts at G, a distance $L$ below the pivot, so the stiffness is $MgL$, not $2MgL$.',
        k: [P(1, 1, '2MgL', 2 * M * g * L)],
      },
    ],
    Msym: [
      ['m + M', 'ML'],
      ['ML', '\\tfrac43 ML^2'],
    ],
    Ksym: [
      ['k', '0'],
      ['0', 'MgL'],
    ],
    M: mk.M,
    K: mk.K,
  };
}

// ------------------------------------------------------------------ rigid bar on two springs (bounce–pitch)

export function barSystem(p: { m: number; J: number; k1: number; a: number; k2: number; b: number }): SystemDef {
  const { m, J, k1, a, k2, b } = p;
  return {
    id: 'bar',
    name: 'Rigid bar on two springs',
    source: 'LA4 §4.2; 2021 A1.5',
    coords: ['y', '\\theta'],
    coordTips: ['bounce of the centre of mass G (m), up', 'pitch about G (rad), anticlockwise (right end up)'],
    setup: 'Rigid bar (mass $m$, inertia $J$ about G) on spring $k_1$ a distance $a$ left of G and spring $k_2$ a distance $b$ right of G. $y$: bounce of G (up); $\\theta$: pitch (anticlockwise).',
    tiles: [
      { id: 'bar-Ty', role: 'bounce', tex: '$\\tfrac12 m\\dot y^2$', belongs: 'T', why: 'Translation of G.', m: [P(0, 0, 'm', m)] },
      { id: 'bar-Tth', role: 'pitch', tex: '$\\tfrac12 J\\dot\\theta^2$', belongs: 'T', why: 'Rotation about G. With coordinates at G there is no inertial coupling.', m: [P(1, 1, 'J', J)] },
      {
        id: 'bar-parallel',
        role: 'pitch',
        tex: '$\\tfrac12 (J + ma^2)\\dot\\theta^2$',
        belongs: 'none',
        why: 'No parallel-axis shift here: the body rotates about G and G’s translation is already in $\\tfrac12 m\\dot y^2$. ($J + ma^2$ would be $I_O$ about the left spring, a fixed pivot it does not have.)',
        m: [P(1, 1, 'J', J), P(1, 1, 'ma^2', m * a * a)],
      },
      {
        id: 'bar-V1',
        role: 'left spring',
        tex: '$\\tfrac12 k_1(y - a\\theta)^2$',
        belongs: 'V',
        why: 'Deflection = translation + rotation × lever arm. Anticlockwise θ lowers the left end, so the left spring stretches $y - a\\theta$.',
        k: [P(0, 0, 'k_1', k1), P(0, 1, '-k_1 a', -k1 * a), P(1, 1, 'k_1 a^2', k1 * a * a)],
      },
      {
        id: 'bar-V1-split',
        role: 'left spring',
        tex: '$\\tfrac12 k_1 y^2 + \\tfrac12 k_1 (a\\theta)^2$',
        belongs: 'none',
        why: 'Split energy: the deflections must be added **before** squaring. This loses the cross term $-k_1 a\\,y\\theta$, i.e. the coupling (official 2017: elastic energy cannot be separated into translational and rotational parts).',
        k: [P(0, 0, 'k_1', k1), P(1, 1, 'k_1 a^2', k1 * a * a)],
      },
      {
        id: 'bar-V2',
        role: 'right spring',
        tex: '$\\tfrac12 k_2(y + b\\theta)^2$',
        belongs: 'V',
        why: 'Anticlockwise θ lifts the right end by $b\\theta$: deflection $y + b\\theta$ (translation + rotation × lever arm).',
        k: [P(0, 0, 'k_2', k2), P(0, 1, 'k_2 b', k2 * b), P(1, 1, 'k_2 b^2', k2 * b * b)],
      },
      {
        id: 'bar-V2-sign',
        role: 'right spring',
        tex: '$\\tfrac12 k_2(y - b\\theta)^2$',
        belongs: 'none',
        why: 'Wrong sign of the rotation part: with θ anticlockwise the right end goes **up**, so its deflection is $y + b\\theta$ (lever arm sign).',
        k: [P(0, 0, 'k_2', k2), P(0, 1, '-k_2 b', -k2 * b), P(1, 1, 'k_2 b^2', k2 * b * b)],
      },
      {
        id: 'bar-grav',
        role: 'gravity',
        tex: '$mgy$',
        belongs: 'none',
        why: 'y (up) is measured from static equilibrium, where the spring preload already balances the weight: the linear gravity term $mgy$ cancels and never reaches K.',
      },
    ],
    Msym: [
      ['m', '0'],
      ['0', 'J'],
    ],
    Ksym: [
      ['k_1 + k_2', 'k_2 b - k_1 a'],
      ['k_2 b - k_1 a', 'k_1 a^2 + k_2 b^2'],
    ],
    M: [
      [m, 0],
      [0, J],
    ],
    K: bouncePitchK(k1, a, k2, b),
  };
}

// ------------------------------------------------------------------ nest swing, 2021 A2

export function nestSystem(p: { m: number; I: number; h: number; k: number; g?: number }): SystemDef {
  const { m, I, h, k } = p;
  const g = p.g ?? G_STD;
  const mk = nestSwingMK(m, I, h, k, g);
  return {
    id: 'nest',
    name: 'Nest swing',
    source: '2021 A2',
    coords: ['\\theta', '\\phi'],
    coordTips: ['rope angle from the vertical (rad)', 'plate rotation about A–A relative to the rope (rad), same sense as θ'],
    setup: 'Plate (mass $m$, inertia $I$ about A–A through its centre) hangs a distance $h$ below the beam. $\\theta$: rope swing; $\\phi$: plate rocking **relative to the rope**, resisted by a torsional stiffness $k$.',
    tiles: [
      { id: 'nest-Ttr', role: 'plate translation', tex: '$\\tfrac12 m h^2\\dot\\theta^2$', belongs: 'T', why: 'The plate centre moves on a circle of radius h: $v_G = h\\dot\\theta$.', m: [P(0, 0, 'mh^2', m * h * h)] },
      {
        id: 'nest-Trot',
        role: 'plate rotation',
        tex: '$\\tfrac12 I(\\dot\\theta + \\dot\\phi)^2$',
        belongs: 'T',
        why: 'Kinetic energy needs the **absolute** angular velocity of the plate: rope rate plus relative rocking rate. This is where the (inertial) coupling comes from.',
        m: [P(0, 0, 'I', I), P(0, 1, 'I', I), P(1, 1, 'I', I)],
      },
      {
        id: 'nest-Trel',
        role: 'plate rotation',
        tex: '$\\tfrac12 I\\dot\\phi^2$',
        belongs: 'none',
        why: 'φ is measured relative to the rope, so $\\dot\\phi$ alone is not the plate’s angular velocity. T must use $\\dot\\theta + \\dot\\phi$ (reader LA2 §2.3.2: always total velocity in T).',
        m: [P(1, 1, 'I', I)],
      },
      {
        id: 'nest-Tth',
        role: 'plate rotation',
        tex: '$\\tfrac12 I\\dot\\theta^2$',
        belongs: 'none',
        why: 'This ignores the rocking rate $\\dot\\phi$: the plate turns with the rope **and** rocks relative to it.',
        m: [P(0, 0, 'I', I)],
      },
      { id: 'nest-Vk', role: 'torsional spring', tex: '$\\tfrac12 k\\phi^2$', belongs: 'V', why: 'The rope portions resist only the rotation of the plate **relative** to the rope, φ.', k: [P(1, 1, 'k', k)] },
      {
        id: 'nest-Vkabs',
        role: 'torsional spring',
        tex: '$\\tfrac12 k(\\theta + \\phi)^2$',
        belongs: 'none',
        why: 'The spring sits between rope and plate, so it twists by the relative angle φ, not by the absolute angle θ + φ.',
        k: [P(0, 0, 'k', k), P(0, 1, 'k', k), P(1, 1, 'k', k)],
      },
      {
        id: 'nest-Vg',
        role: 'gravity',
        tex: '$mgh(1-\\cos\\theta) \\approx \\tfrac12 mgh\\,\\theta^2$',
        belongs: 'V',
        why: 'The plate centre rises $h(1-\\cos\\theta)$; keep $\\cos\\theta \\approx 1-\\theta^2/2$ so gravity supplies the swing stiffness $mgh$.',
        k: [P(0, 0, 'mgh', m * g * h)],
      },
      {
        id: 'nest-Vgphi',
        role: 'gravity',
        tex: '$\\tfrac12 mgh(\\theta + \\phi)^2$',
        belongs: 'none',
        why: 'Rocking about A–A does not lift the plate centre (it lies on A–A), so gravity depends on θ only.',
        k: [P(0, 0, 'mgh', m * g * h), P(0, 1, 'mgh', m * g * h), P(1, 1, 'mgh', m * g * h)],
      },
    ],
    Msym: [
      ['I + mh^2', 'I'],
      ['I', 'I'],
    ],
    Ksym: [
      ['mgh', '0'],
      ['0', 'k'],
    ],
    M: mk.M,
    K: mk.K,
  };
}

// ------------------------------------------------------------------ belt drive, official 2019 Q2 / Week 2 Q4

export function beltSystem(p: { IT: number; IP: number; R1: number; R2: number; k: number }): SystemDef {
  const { IT, IP, R1, R2, k } = p;
  return {
    id: 'belt',
    name: 'Belt drive',
    source: 'Official 2019 Q2; Week 2 Q4',
    coords: ['\\theta_1', '\\theta_2'],
    coordTips: ['motor pulley rotation (rad)', 'driven pulley rotation (rad), same sense as θ₁'],
    setup: 'Motor + pulley $R_1$ (inertia $I_T$) drives pulley $R_2$ (inertia $I_P$) through a belt of stiffness $k$ on each side. $\\theta_1$ and $\\theta_2$ are in the same rotational sense; the belt does not slip.',
    tiles: [
      { id: 'belt-T1', role: 'motor pulley', tex: '$\\tfrac12 I_T\\dot\\theta_1^2$', belongs: 'T', why: 'Motor and its pulley rotate together.', m: [P(0, 0, 'I_T', IT)] },
      { id: 'belt-T2', role: 'driven pulley', tex: '$\\tfrac12 I_P\\dot\\theta_2^2$', belongs: 'T', why: 'Driven pulley. The belt is massless in the course model.', m: [P(1, 1, 'I_P', IP)] },
      {
        id: 'belt-tight',
        role: 'tight side',
        tex: '$\\tfrac12 k(R_1\\theta_1 - R_2\\theta_2)^2$ (tight side)',
        belongs: 'V',
        why: 'Each rim moves $R\\theta$ (exact, no slip), so this side stretches $R_1\\theta_1 - R_2\\theta_2$.',
        k: [P(0, 0, 'kR_1^2', k * R1 * R1), P(0, 1, '-kR_1R_2', -k * R1 * R2), P(1, 1, 'kR_2^2', k * R2 * R2)],
      },
      {
        id: 'belt-slack',
        role: 'slack side',
        tex: '$\\tfrac12 k(R_2\\theta_2 - R_1\\theta_1)^2$ (slack side)',
        belongs: 'V',
        why: 'The other side shortens by the same amount and stores the same energy, so the total is $2\\times\\tfrac12k\\delta^2$ (Week 2 Q4: counting one side gives $k$ instead of $2k$).',
        k: [P(0, 0, 'kR_1^2', k * R1 * R1), P(0, 1, '-kR_1R_2', -k * R1 * R2), P(1, 1, 'kR_2^2', k * R2 * R2)],
      },
      {
        id: 'belt-plus',
        role: 'belt',
        tex: '$\\tfrac12 k(R_1\\theta_1 + R_2\\theta_2)^2$',
        belongs: 'none',
        why: 'With θ₁ and θ₂ in the same sense, a rigid rotation has $R_1\\theta_1 = R_2\\theta_2$ and must not stretch the belt. The plus sign would stretch it.',
        k: [P(0, 0, 'kR_1^2', k * R1 * R1), P(0, 1, 'kR_1R_2', k * R1 * R2), P(1, 1, 'kR_2^2', k * R2 * R2)],
      },
      {
        id: 'belt-noR',
        role: 'belt',
        tex: '$\\tfrac12 k(\\theta_1 - \\theta_2)^2$',
        belongs: 'none',
        why: 'Wrong units and kinematics: the belt stretch is a length, $R_1\\theta_1 - R_2\\theta_2$, not an angle difference.',
        k: [P(0, 0, 'k', k), P(0, 1, '-k', -k), P(1, 1, 'k', k)],
      },
      {
        id: 'belt-split',
        role: 'belt',
        tex: '$\\tfrac12 kR_1^2\\theta_1^2 + \\tfrac12 kR_2^2\\theta_2^2$',
        belongs: 'none',
        why: 'Split energy: as if each pulley had its own spring to ground. It loses the cross term and the free rotation (ω = 0) of the real drive.',
        k: [P(0, 0, 'kR_1^2', k * R1 * R1), P(1, 1, 'kR_2^2', k * R2 * R2)],
      },
    ],
    Msym: [
      ['I_T', '0'],
      ['0', 'I_P'],
    ],
    Ksym: [
      ['2kR_1^2', '-2kR_1R_2'],
      ['-2kR_1R_2', '2kR_2^2'],
    ],
    M: [
      [IT, 0],
      [0, IP],
    ],
    K: beltK(k, R1, R2),
  };
}

// ------------------------------------------------------------------ folding-leg platform, 2023 A2 (case II)

export function platformSystem(p: { m: number; IG: number; k1: number; k2: number; a: number }): SystemDef {
  const { m, IG, k1, k2, a } = p;
  return {
    id: 'platform',
    name: 'Folding-leg platform (II)',
    source: '2023 A2',
    coords: ['x', '\\theta'],
    coordTips: ['bounce of the CoM (m), up', 'pitch about the CoM (rad), anticlockwise'],
    setup: 'Platform ($m$, $I_G$) on two massless legs pinned at its CoM, 120° apart, feet sliding freely. Horizontal $k_1$ joins the leg mid-points; in case (II) only the right vertical spring $k_2$ (at $+a$, down to the right leg’s mid-point) remains. $x$: bounce (up), $\\theta$: pitch (anticlockwise).',
    tiles: [
      { id: 'pf-Tx', role: 'bounce', tex: '$\\tfrac12 m\\dot x^2$', belongs: 'T', why: 'The pivot is at the CoM, which moves vertically only.', m: [P(0, 0, 'm', m)] },
      { id: 'pf-Tth', role: 'pitch', tex: '$\\tfrac12 I_G\\dot\\theta^2$', belongs: 'T', why: 'Rotation about the CoM. Legs and springs are massless.', m: [P(1, 1, 'I_G', IG)] },
      {
        id: 'pf-V1',
        role: 'horizontal spring',
        tex: '$\\tfrac12 k_1\\left(\\tfrac{x}{\\sqrt3}\\right)^2$',
        belongs: 'V',
        why: 'Leg geometry: when the pivot rises x, each foot slides in $x/\\sqrt3$, so the two mid-points close up by $x/\\sqrt3$ in total.',
        k: [P(0, 0, '\\tfrac13 k_1', k1 / 3)],
      },
      {
        id: 'pf-V1x',
        role: 'horizontal spring',
        tex: '$\\tfrac12 k_1 x^2$',
        belongs: 'none',
        why: 'k₁ is horizontal: it does not stretch by the bounce x itself but by the mid-points’ inward motion, $x/\\sqrt3$ (leg kinematics: the feet slide in as the pivot rises).',
        k: [P(0, 0, 'k_1', k1)],
      },
      {
        id: 'pf-V2',
        role: 'right vertical spring',
        tex: '$\\tfrac12 k_2\\left(\\tfrac x2 + a\\theta\\right)^2$',
        belongs: 'V',
        why: 'Top end: translation + rotation × lever arm, $x + a\\theta$. Bottom end: the leg mid-point rises $x/2$. Deflection $= x/2 + a\\theta$.',
        k: [P(0, 0, '\\tfrac14 k_2', k2 / 4), P(0, 1, '\\tfrac12 k_2 a', (k2 * a) / 2), P(1, 1, 'k_2 a^2', k2 * a * a)],
      },
      {
        id: 'pf-V2full',
        role: 'right vertical spring',
        tex: '$\\tfrac12 k_2(x + a\\theta)^2$',
        belongs: 'none',
        why: 'The spring’s lower end is not fixed: it rides on the leg mid-point, which rises $x/2$. Deflection $= (x + a\\theta) - x/2$.',
        k: [P(0, 0, 'k_2', k2), P(0, 1, 'k_2 a', k2 * a), P(1, 1, 'k_2 a^2', k2 * a * a)],
      },
      {
        id: 'pf-Vleft',
        role: 'left vertical spring',
        tex: '$\\tfrac12 k_2\\left(\\tfrac x2 - a\\theta\\right)^2$',
        belongs: 'none',
        why: 'That is the **left** spring, which case (II) removes. Removing it is what creates the coupling.',
        k: [P(0, 0, '\\tfrac14 k_2', k2 / 4), P(0, 1, '-\\tfrac12 k_2 a', -(k2 * a) / 2), P(1, 1, 'k_2 a^2', k2 * a * a)],
      },
      {
        id: 'pf-grav',
        role: 'gravity',
        tex: '$mgx$',
        belongs: 'none',
        why: 'x is measured from static equilibrium, so the weight is balanced by the spring preloads and drops out.',
      },
    ],
    Msym: [
      ['m', '0'],
      ['0', 'I_G'],
    ],
    Ksym: [
      ['\\tfrac13 k_1 + \\tfrac14 k_2', '\\tfrac12 k_2 a'],
      ['\\tfrac12 k_2 a', 'k_2 a^2'],
    ],
    M: [
      [m, 0],
      [0, IG],
    ],
    K: platformK(k1, k2, a, true),
  };
}

// ------------------------------------------------------------------ box on four rubber springs, 2024 A2

export function boxSystem(p: { m: number; kx: number; ky: number; a: number; b: number; c: number }): SystemDef {
  const { m, kx, ky, a, b, c } = p;
  const Iz = boxInertia(m, a, c);
  const Iy = (m * (a * a + b * b)) / 3;
  return {
    id: 'box',
    name: 'Box on four rubber springs',
    source: '2024 A2',
    coords: ['x', 'y', '\\theta'],
    coordTips: ['sway of G (m), right', 'bounce of G (m), up', 'rock about the z axis through G (rad), anticlockwise'],
    setup: 'Uniform box $2a \\times 2b \\times 2c$ (along x, z, y) on four springs at the mid-points of the bottom edges, a depth $c$ below G: front/back at $x = 0$, left/right at $x = \\mp a$. Axial (vertical) $k_y$; transverse (shear) $k_x$.',
    tiles: [
      { id: 'box-Ttr', role: 'translation', tex: '$\\tfrac12 m(\\dot x^2 + \\dot y^2)$', belongs: 'T', why: 'Coordinates at G: translation of the CoM.', m: [P(0, 0, 'm', m), P(1, 1, 'm', m)] },
      {
        id: 'box-Tz',
        role: 'rotation',
        tex: '$\\tfrac12 I_z\\dot\\theta^2,\\ I_z = \\tfrac m3(a^2 + c^2)$',
        belongs: 'T',
        why: 'Rotation about z uses the face normal to z, which is $2a \\times 2c$: $I_z = m((2a)^2 + (2c)^2)/12$.',
        m: [P(2, 2, 'I_z', Iz)],
      },
      {
        id: 'box-Ty',
        role: 'rotation',
        tex: '$\\tfrac12 I\\dot\\theta^2,\\ I = \\tfrac m3(a^2 + b^2)$',
        belongs: 'none',
        why: 'Wrong face: $m(a^2+b^2)/3$ is $I_y$ (the $2a\\times2b$ face). Rocking in the x–y plane turns about z.',
        m: [P(2, 2, 'I_y', Iy)],
      },
      {
        id: 'box-Vshear',
        role: 'shear (all four)',
        tex: '$4\\cdot\\tfrac12 k_x(x + c\\theta)^2$',
        belongs: 'V',
        why: 'All four springs shear in x. Each sits a depth c below G, so its horizontal deflection is $x - (-c)\\theta = x + c\\theta$ (translation + rotation × lever arm).',
        k: [P(0, 0, '4k_x', 4 * kx), P(0, 2, '4k_x c', 4 * kx * c), P(2, 2, '4k_x c^2', 4 * kx * c * c)],
      },
      {
        id: 'box-Vshear-noc',
        role: 'shear (all four)',
        tex: '$4\\cdot\\tfrac12 k_x x^2$',
        belongs: 'none',
        why: 'The springs are a depth c below G, so rocking also shears them: deflection $x + c\\theta$. Dropping the lever arm c removes the sway–rock coupling.',
        k: [P(0, 0, '4k_x', 4 * kx)],
      },
      {
        id: 'box-Vshear-2',
        role: 'shear (two)',
        tex: '$2\\cdot\\tfrac12 k_x(x + c\\theta)^2$',
        belongs: 'none',
        why: 'The front and back springs (at x = 0) also shear when the box sways: all four count (2024 worked solution).',
        k: [P(0, 0, '2k_x', 2 * kx), P(0, 2, '2k_x c', 2 * kx * c), P(2, 2, '2k_x c^2', 2 * kx * c * c)],
      },
      { id: 'box-Vfb', role: 'front + back (vertical)', tex: '$2\\cdot\\tfrac12 k_y y^2$', belongs: 'V', why: 'The front and back springs sit at x = 0: rocking about z does not move them vertically.', k: [P(1, 1, '2k_y', 2 * ky)] },
      {
        id: 'box-Vl',
        role: 'left (vertical)',
        tex: '$\\tfrac12 k_y(y - a\\theta)^2$',
        belongs: 'V',
        why: 'Left spring at $x = -a$: vertical deflection $y + (-a)\\theta$.',
        k: [P(1, 1, 'k_y', ky), P(1, 2, '-k_y a', -ky * a), P(2, 2, 'k_y a^2', ky * a * a)],
      },
      {
        id: 'box-Vr',
        role: 'right (vertical)',
        tex: '$\\tfrac12 k_y(y + a\\theta)^2$',
        belongs: 'V',
        why: 'Right spring at $x = +a$: $y + a\\theta$. Its cross term cancels the left one’s, so bounce decouples.',
        k: [P(1, 1, 'k_y', ky), P(1, 2, 'k_y a', ky * a), P(2, 2, 'k_y a^2', ky * a * a)],
      },
      { id: 'box-grav', role: 'gravity', tex: '$mgy$', belongs: 'none', why: 'y (up) is measured from static equilibrium: the spring preload cancels the weight’s linear term $mgy$.' },
    ],
    Msym: [
      ['m', '0', '0'],
      ['0', 'm', '0'],
      ['0', '0', 'I_z'],
    ],
    Ksym: [
      ['4k_x', '0', '4k_x c'],
      ['0', '4k_y', '0'],
      ['4k_x c', '0', '4k_x c^2 + 2k_y a^2'],
    ],
    M: [
      [m, 0, 0],
      [0, m, 0],
      [0, 0, Iz],
    ],
    K: boxK(kx, ky, a, c),
  };
}

// ------------------------------------------------------------------ range hood on three wall mounts, 2025 A2

export function hoodSystem(p: { m: number; I: number; kx: number; ky: number; s: number; d: number }): SystemDef {
  const { m, I, kx, ky, s, d } = p;
  return {
    id: 'hood',
    name: 'Range hood on three wall mounts',
    source: '2025 A2',
    coords: ['x', 'y', '\\theta'],
    coordTips: ['sway of the CoM away from the wall (m)', 'motion of the CoM along the wall (m)', 'rotation about the CoM in the top view (rad), anticlockwise'],
    setup: 'Top view. Hood (mass $m$, inertia $I$ about its CoM) on three wall mounts at $y = +s, 0, -s$, all a distance $d$ behind the CoM. Each mount has axial stiffness $k_x$ (normal to the wall) and transverse stiffness $k_y$. The fan is centred on the CoM.',
    tiles: [
      { id: 'hood-Ttr', role: 'translation', tex: '$\\tfrac12 m(\\dot x^2 + \\dot y^2)$', belongs: 'T', why: 'Coordinates at the CoM: translation of G.', m: [P(0, 0, 'm', m), P(1, 1, 'm', m)] },
      { id: 'hood-Trot', role: 'rotation', tex: '$\\tfrac12 I\\dot\\theta^2$', belongs: 'T', why: 'Rotation about the CoM; with coordinates at G there is no inertial coupling.', m: [P(2, 2, 'I', I)] },
      {
        id: 'hood-Vtop',
        role: 'axial, top mount (y = +s)',
        tex: '$\\tfrac12 k_x(x - s\\theta)^2$',
        belongs: 'V',
        why: 'A point at $(p_x, p_y)$ moves $\\Delta x = x - p_y\\theta$. The top mount has $p_y = +s$, so anticlockwise θ pulls it towards the wall: $x - s\\theta$.',
        k: [P(0, 0, 'k_x', kx), P(0, 2, '-k_x s', -kx * s), P(2, 2, 'k_x s^2', kx * s * s)],
      },
      { id: 'hood-Vmid', role: 'axial, middle mount (y = 0)', tex: '$\\tfrac12 k_x x^2$', belongs: 'V', why: 'The middle mount is level with the CoM ($p_y = 0$): rotation does not move it along x.', k: [P(0, 0, 'k_x', kx)] },
      {
        id: 'hood-Vbot',
        role: 'axial, bottom mount (y = −s)',
        tex: '$\\tfrac12 k_x(x + s\\theta)^2$',
        belongs: 'V',
        why: '$p_y = -s$: $\\Delta x = x + s\\theta$. Its cross term cancels the top mount’s, so the sway x decouples.',
        k: [P(0, 0, 'k_x', kx), P(0, 2, 'k_x s', kx * s), P(2, 2, 'k_x s^2', kx * s * s)],
      },
      {
        id: 'hood-Vtr',
        role: 'transverse, all three',
        tex: '$3\\cdot\\tfrac12 k_y(y - d\\theta)^2$',
        belongs: 'V',
        why: 'All three mounts are a distance d behind the CoM ($p_x = -d$): $\\Delta y = y + p_x\\theta = y - d\\theta$. This lever arm is the y–θ coupling $-3k_yd$.',
        k: [P(1, 1, '3k_y', 3 * ky), P(1, 2, '-3k_y d', -3 * ky * d), P(2, 2, '3k_y d^2', 3 * ky * d * d)],
      },
      {
        id: 'hood-Vtr-noarm',
        role: 'transverse, all three',
        tex: '$3\\cdot\\tfrac12 k_y y^2$',
        belongs: 'none',
        why: 'The mounts are d behind the CoM, so rotation also shears them: $\\Delta y = y - d\\theta$. Without the lever arm the y–θ coupling disappears.',
        k: [P(1, 1, '3k_y', 3 * ky)],
      },
      {
        id: 'hood-Vtr-sign',
        role: 'transverse, all three',
        tex: '$3\\cdot\\tfrac12 k_y(y + d\\theta)^2$',
        belongs: 'none',
        why: 'Sign of the lever arm: the mounts sit at $p_x = -d$ (behind the CoM, on the wall side), so $\\Delta y = y - d\\theta$ and $K_{y\\theta} = -3k_yd$.',
        k: [P(1, 1, '3k_y', 3 * ky), P(1, 2, '3k_y d', 3 * ky * d), P(2, 2, '3k_y d^2', 3 * ky * d * d)],
      },
      {
        id: 'hood-Vtop-split',
        role: 'axial, top mount (y = +s)',
        tex: '$\\tfrac12 k_x x^2 + \\tfrac12 k_x(s\\theta)^2$',
        belongs: 'none',
        why: 'Split energy: add the deflections before squaring. This drops the cross term $-k_xs\\,x\\theta$, which should cancel the bottom mount’s $+k_xs\\,x\\theta$; left alone, that term would invent a sway–rotation coupling.',
        k: [P(0, 0, 'k_x', kx), P(2, 2, 'k_x s^2', kx * s * s)],
      },
      {
        id: 'hood-W',
        role: 'fan force',
        tex: '$(F_0\\cos\\Omega t)\\,x + (F_0\\sin\\Omega t)\\,y$',
        belongs: 'none',
        why: 'That is the work W of the rotating unbalance force, not an energy of T or V. It gives $Q_x = F_0\\cos\\Omega t$, $Q_y = F_0\\sin\\Omega t$ and $Q_\\theta = 0$ (the force passes through the CoM), on the right-hand side.',
      },
    ],
    Msym: [
      ['m', '0', '0'],
      ['0', 'm', '0'],
      ['0', '0', 'I'],
    ],
    Ksym: [
      ['3k_x', '0', '0'],
      ['0', '3k_y', '-3k_y d'],
      ['0', '-3k_y d', '2k_x s^2 + 3k_y d^2'],
    ],
    M: [
      [m, 0, 0],
      [0, m, 0],
      [0, 0, I],
    ],
    K: hoodK(kx, ky, s, d),
  };
}

/** Matrix assembled from a placement of tiles (T → M pieces, V → K pieces). */
export function assemble(sys: SystemDef, place: Record<string, Bucket | undefined>): { M: Mat; K: Mat; mPieces: Piece[]; kPieces: Piece[] } {
  const n = sys.coords.length;
  const mPieces: Piece[] = [];
  const kPieces: Piece[] = [];
  for (const t of sys.tiles) {
    const b = place[t.id];
    if (b === 'T' && t.m) mPieces.push(...t.m);
    if (b === 'V' && t.k) kPieces.push(...t.k);
  }
  return { M: piecesToMat(n, mPieces), K: piecesToMat(n, kPieces), mPieces, kPieces };
}

/** Sum of the correct tiles' contributions (used by self-tests: must equal the system's M and K). */
export function correctMatrices(sys: SystemDef): { M: Mat; K: Mat } {
  const place: Record<string, Bucket> = {};
  for (const t of sys.tiles) place[t.id] = t.belongs;
  const { M, K } = assemble(sys, place);
  return { M, K };
}
