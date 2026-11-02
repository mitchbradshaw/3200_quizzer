// Extra pure functions for A2 (Lagrange derivations). SI units, rad/s. Every matrix here is the
// coefficient matrix of a quadratic form: T = ½ q̇ᵀ M q̇, V = ½ qᵀ K q (summary notes A2).
import type { Mat } from '../../physics/linalg';

export const G_STD = 9.81;

/** Symmetric n×n contribution c·v·vᵀ of an energy term ½c(v·q)² (spring of stiffness c with deflection v·q, or a mass c moving at v·q̇). */
export function outer(c: number, v: number[]): Mat {
  return v.map((vi) => v.map((vj) => c * vi * vj));
}

/** n×n matrix with value c at (i, j) and (j, i): the contribution of a cross term c·qᵢqⱼ (i ≠ j), or of ½c·qᵢ² when i = j. */
export function entry(n: number, i: number, j: number, c: number): Mat {
  const A = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  A[i][j] = c;
  A[j][i] = c;
  return A;
}

export function addMats(...As: Mat[]): Mat {
  const n = As[0].length;
  const out = Array.from({ length: n }, () => new Array<number>(As[0][0].length).fill(0));
  for (const A of As) A.forEach((row, i) => row.forEach((x, j) => (out[i][j] += x)));
  return out;
}

/** Finite-difference Hessian of a scalar f(q) at q = 0 (used by self-tests to check M and K against the exact nonlinear energies). */
export function hessianAt0(f: (q: number[]) => number, n: number, h = 1e-4): Mat {
  const H = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  const e = (i: number, s: number) => {
    const v = new Array<number>(n).fill(0);
    v[i] = s;
    return v;
  };
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      const p = (a: number, b: number) => f(e(i, a).map((x, k) => x + e(j, b)[k]));
      H[i][j] = (p(h, h) - p(h, -h) - p(-h, h) + p(-h, -h)) / (4 * h * h);
    }
  return H;
}

// ------------------------------------------------------------------ 2022 A2: rod on a cart

/** Cart (m) on spring k with a uniform rod (mass M, length 2L) pinned at its top: coordinates (x, θ). M = [[m+M, ML],[ML, 4ML²/3]], K = diag(k, MgL) (2022 worked A2.1). */
export function cartRodMK(m: number, M: number, L: number, k: number, g = G_STD): { M: Mat; K: Mat } {
  return {
    M: [
      [m + M, M * L],
      [M * L, (4 * M * L * L) / 3],
    ],
    K: [
      [k, 0],
      [0, M * g * L],
    ],
  };
}

/** k → 0 limit of the cart–rod: ω² = 0 (free translation) and ω² = 3g(m+M)/(L(4m+M)) (derived; ST-15). */
export function cartRodFreeOmega2(m: number, M: number, L: number, g = G_STD): number {
  return (3 * g * (m + M)) / (L * (4 * m + M));
}

// ------------------------------------------------------------------ 2021 A2: nest swing

/** Nest swing (θ rope, φ plate relative to the rope): M = [[I + mh², I],[I, I]], K = diag(mgh, k) (2021 A2.1). */
export function nestSwingMK(m: number, I: number, h: number, k: number, g = G_STD): { M: Mat; K: Mat } {
  return {
    M: [
      [I + m * h * h, I],
      [I, I],
    ],
    K: [
      [m * g * h, 0],
      [0, k],
    ],
  };
}

/** ω₁,₂² = [λ₃ ∓ √(λ₃² − 4λ₁λ₂)]/2 with λ₁ = k/I, λ₂ = g/h, λ₃ = λ₁ + λ₂ + k/(mh²) (2021 worked A2.2). */
export function nestSwingOmega2(m: number, I: number, h: number, k: number, g = G_STD): { l1: number; l2: number; l3: number; w2: [number, number] } {
  const l1 = k / I;
  const l2 = g / h;
  const l3 = l1 + l2 + k / (m * h * h);
  const disc = Math.sqrt(Math.max(0, l3 * l3 - 4 * l1 * l2));
  return { l1, l2, l3, w2: [(l3 - disc) / 2, (l3 + disc) / 2] };
}

/** 2021 A2.6: rotational stiffness of four inclined rope portions (axial stiffness E/L each, angle α to the plate): k = EL sin²2α. */
export function ropeStiffness(E: number, L: number, alpha: number): number {
  const s = Math.sin(2 * alpha);
  return E * L * s * s;
}

// ------------------------------------------------------------------ 2023 A2: folding-leg platform

/** Folding-leg platform (x bounce up, θ CCW). Legs pinned at the CoM, 120° apart; vertical springs k₂ at ±a join the platform to the leg mid-points (which rise x/2); the horizontal k₁ between the mid-points shortens by x/√3. Case (II) removes the left k₂ (2023 worked A2.1–A2.2). */
export function platformK(k1: number, k2: number, a: number, leftRemoved = true): Mat {
  if (leftRemoved)
    return [
      [k1 / 3 + k2 / 4, (k2 * a) / 2],
      [(k2 * a) / 2, k2 * a * a],
    ];
  return [
    [k1 / 3 + k2 / 2, 0],
    [0, 2 * k2 * a * a],
  ];
}

/** Bounce suppression frequency of the platform for a downward force at the left edge (ξ = −b): Q = F₀[−1, b], X = 0 at ω² = (K₂₂ + bK₁₂)/I_G (2023 worked A2.5). */
export function platformSuppressionOmega(K: Mat, IG: number, b: number): number {
  return Math.sqrt((K[1][1] + b * K[0][1]) / IG);
}

// ------------------------------------------------------------------ 2024 A2: box on four rubber springs

/** Uniform box 2a × 2c face: I_z = m((2a)² + (2c)²)/12 = m(a² + c²)/3 (summary notes A2; 2024 hint). */
export function boxInertia(m: number, a: number, c: number): number {
  return (m * (a * a + c * c)) / 3;
}

/** Box on four bottom-edge springs (front/back at x = 0, left/right at ∓a, all a depth c below G), coordinates (x, y, θ): every spring shears x + cθ; verticals y, y, y ∓ aθ. With `fifth`, one more spring at (+a, −c) (2024 worked A2.1–A2.5). */
export function boxK(kx: number, ky: number, a: number, c: number, fifth = false): Mat {
  const n = fifth ? 5 : 4;
  const K: Mat = [
    [n * kx, 0, n * kx * c],
    [0, n * ky, 0],
    [n * kx * c, 0, n * kx * c * c + 2 * ky * a * a],
  ];
  if (fifth) {
    K[1][2] = K[2][1] = ky * a;
    K[2][2] += ky * a * a;
  }
  return K;
}

// ------------------------------------------------------------------ 2025 A2: range hood

/** Range hood on three wall mounts at (−d, +s), (−d, 0), (−d, −s), axial kₓ and transverse k_y each; coordinates (x, y, θ): x decouples (3kₓ); the y–θ block is [[3k_y, −3k_y d],[−3k_y d, 2kₓs² + 3k_y d²]] (2025 worked A2.1–A2.2). */
export function hoodK(kx: number, ky: number, s: number, d: number): Mat {
  return [
    [3 * kx, 0, 0],
    [0, 3 * ky, -3 * ky * d],
    [0, -3 * ky * d, 2 * kx * s * s + 3 * ky * d * d],
  ];
}

/** The y–θ block of hoodK. */
export function hoodYThetaK(kx: number, ky: number, s: number, d: number): Mat {
  return [
    [3 * ky, -3 * ky * d],
    [-3 * ky * d, 2 * kx * s * s + 3 * ky * d * d],
  ];
}

/** Unbalance force amplitude F₀ = m_b R Ω² (2025 paper A2). */
export function unbalanceForce(mbR: number, Omega: number): number {
  return mbR * Omega * Omega;
}

// ------------------------------------------------------------------ belts, gears, cars

/** No-slip belt with stiffness k per side: K = 2k[[R₁², −R₁R₂],[−R₁R₂, R₂²]] (official 2019 Q2(1)). */
export function beltK(k: number, R1: number, R2: number): Mat {
  return [
    [2 * k * R1 * R1, -2 * k * R1 * R2],
    [-2 * k * R1 * R2, 2 * k * R2 * R2],
  ];
}

/** Non-zero belt-drive frequency: ω² = 2k(R₁²/I_T + R₂²/I_P) (official 2019 Q2(3)). */
export function beltOmega2(k: number, R1: number, R2: number, IT: number, IP: number): number {
  return 2 * k * (R1 * R1 / IT + R2 * R2 / IP);
}

/** Motor (I_m) → gear ratio G → shaft k_T → load I_L, coordinates (θ_G, θ_L): M = diag(I_m G², I_L), K = k_T[[1, −1],[−1, 1]] (official 2018 A2.2). */
export function gearMK(Im: number, IL: number, G: number, kT: number): { M: Mat; K: Mat } {
  return {
    M: [
      [Im * G * G, 0],
      [0, IL],
    ],
    K: [
      [kT, -kT],
      [-kT, kT],
    ],
  };
}

/** Two free cars joined by a coupling k: ω₂² = k(1/m₁ + 1/m₂), mode x₂/x₁ = −m₁/m₂ (official 2017 A1; Week 3 Q2). */
export function twoCarOmega2(m1: number, m2: number, k: number): number {
  return k * (1 / m1 + 1 / m2);
}

/** Rolling body (J = β m r²) on a spring at its centre: ωₙ/√(k/m) = 1/√(1 + β) (Week 1 Q5: solid cylinder β = ½ → 0.8165). */
export function rollingFactor(beta: number): number {
  return 1 / Math.sqrt(1 + beta);
}

/** Bounce–pitch mass matrix in spring-point coordinates (y₁ at −a, y₂ at +b): y = (b y₁ + a y₂)/(a+b), θ = (y₂ − y₁)/(a+b) (reader LA4-5 note). */
export function springPointM(m: number, J: number, a: number, b: number): Mat {
  const s = (a + b) * (a + b);
  return [
    [(m * b * b + J) / s, (m * a * b - J) / s],
    [(m * a * b - J) / s, (m * a * a + J) / s],
  ];
}

/** 2-DoF characteristic coefficients of det(K − λM) = Aλ² − Bλ + C (for hints). */
export function charCoeffs2(K: Mat, M: Mat): { A: number; B: number; C: number } {
  const A = M[0][0] * M[1][1] - M[0][1] * M[1][0];
  const B = M[0][0] * K[1][1] + M[1][1] * K[0][0] - 2 * M[0][1] * K[0][1];
  const C = K[0][0] * K[1][1] - K[0][1] * K[1][0];
  return { A, B, C };
}

/** Roots λ = ω² of Aλ² − Bλ + C = 0, ascending. */
export function quadRoots(A: number, B: number, C: number): [number, number] {
  const disc = Math.sqrt(Math.max(0, B * B - 4 * A * C));
  return [(B - disc) / (2 * A), (B + disc) / (2 * A)];
}
