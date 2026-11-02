// A2 problem generators: derivation chains for the exam systems (research notes NP-01 to NP-14).
// Tiers: 1 Warm-up = one energy term or matrix entry; 2 Exam = the full chain (T, V → M, K → ω);
// 3 Stretch = generalised force / virtual work, base input, or a limit/back-solve twist.
// Hints use the instance's numbers: concept → set-up → substitution → worked solution.
import type { ChoicePart, MatrixPart, NumericPart, SolveGenerator, SolvePart } from '../../engine/types';
import type { Rng } from '../../engine/rng';
import { fmt, tex } from '../../engine/format';
import { modes, modeRatio2 } from '../../physics/mdof';
import type { Mat } from '../../physics/linalg';
import { barSystem, beltSystem, cartRodSystem, nestSystem, platformSystem, toTermsPart } from './systems';
import {
  G_STD,
  beltOmega2,
  boxInertia,
  boxK,
  cartRodFreeOmega2,
  charCoeffs2,
  gearMK,
  hoodYThetaK,
  platformSuppressionOmega,
  ropeStiffness,
  twoCarOmega2,
} from './physics';
import { BarFigure, BeltFigure, BoxFigure, CartRodFigure, GearFigure, HoodFigure, NestFigure, PlatformFigure, RailCarsFigure } from './figures';

const TAU = 2 * Math.PI;
const g = G_STD;
/** Plain-text number (outside TeX). */
const f4 = (x: number) => fmt(x, 4);
/** Number inside TeX. */
const t4 = (x: number) => tex(x, 4);
const t3 = (x: number) => tex(x, 3);
const rpm = (w: number) => (w * 60) / TAU;

/** Matrix as a TeX bmatrix (numbers via tex()). */
function mtx(A: number[][], sig = 4): string {
  return `\\begin{bmatrix} ${A.map((r) => r.map((x) => (Math.abs(x) < 1e-12 ? '0' : tex(x, sig))).join(' & ')).join(' \\\\ ')} \\end{bmatrix}`;
}

type Trap = { value: number; message: string; trapId?: string };

/** Keep only traps that are finite, clearly away from the answer (> 3 %), and distinct from each other. */
export function safeTraps(answer: number, list: Trap[]): Trap[] {
  const out: Trap[] = [];
  for (const t of list) {
    if (!Number.isFinite(t.value)) continue;
    if (Math.abs(t.value - answer) <= 0.03 * Math.max(Math.abs(answer), 1e-12)) continue;
    if (out.some((o) => Math.abs(o.value - t.value) <= 0.02 * Math.max(Math.abs(t.value), 1e-12))) continue;
    out.push(t);
  }
  return out;
}

const maxAbs = (A: number[][]) => A.reduce((m, r) => r.reduce((mm, x) => Math.max(mm, Math.abs(x)), m), 0) || 1;

/** Matrix traps that differ clearly (> 3 % of the largest entry) from the answer. */
export function safeMatTraps(answer: number[][], list: { value: number[][]; message: string; trapId?: string }[]) {
  const s = maxAbs(answer);
  return list.filter((t) => t.value.some((r, i) => r.some((x, j) => Math.abs(x - answer[i][j]) > 0.03 * s)));
}

function num(id: string, label: string, answer: number, unit: string, traps: Trap[] = [], extra: Partial<NumericPart> = {}): NumericPart {
  return { kind: 'numeric', id, label, answer, unit, traps: safeTraps(answer, traps), ...extra };
}

function freqPart(id: string, label: string, w: number, unit: 'rad/s' | 'Hz' | 'rpm', traps: Trap[] = []): NumericPart {
  const conv = (x: number) => (unit === 'rad/s' ? x : unit === 'Hz' ? x / TAU : rpm(x));
  return num(
    id,
    label,
    conv(w),
    unit,
    traps.map((t) => ({ ...t, value: conv(t.value) })),
    { freq: true }
  );
}

/** Natural frequencies (rad/s) and course-style mode ratios r = q₂/q₁ for a 2-DoF system. */
function eig2(K: Mat, M: Mat) {
  const r = modes(K, M);
  const w = r.omega;
  const ratio = r.omega2.map((w2) => modeRatio2(K, M, w2));
  return { w, w2: r.omega2, ratio };
}

/** Draw parameters until `ok` holds (deterministic for a seed). */
function draw<T>(rng: Rng, make: () => T, ok: (p: T) => boolean, tries = 80): T {
  let p = make();
  for (let i = 0; i < tries && !ok(p); i++) p = make();
  return p;
}

const choice = (id: string, label: string, options: ChoicePart['options'], marks?: number): ChoicePart => ({ kind: 'choice', id, label, options, marks });

export const generators: SolveGenerator[] = [
  // ================================================================== rigid bar on two springs
  {
    id: 'a2-bar',
    title: 'Rigid bar on two springs (bounce–pitch)',
    summary: 'Spring deflections with lever arms → K; frequencies and nodes; a road input and the decoupling position.',
    tiers: [1, 2, 3],
    source: 'Similar to 2021 A1.5 and reader LA4 §4.2 (Eq 4.9); road input as LA9 §9.5',
    cardId: 'a2-potential',
    marks: 12,
    generate(rng, tier) {
      const p = draw(
        rng,
        () => {
          const m = rng.step(800, 2400, 100);
          const rho = rng.step(0.8, 1.3, 0.05);
          return { m, J: Math.round((m * rho * rho) / 10) * 10, a: rng.step(0.9, 1.6, 0.1), b: rng.step(1.0, 1.9, 0.1), k1: rng.step(15, 40, 1), k2: rng.step(15, 40, 1) };
        },
        (q) => Math.abs(q.k2 * q.b - q.k1 * q.a) >= 0.08 * (q.k1 * q.a + q.k2 * q.b)
      );
      const { m, J, a, b, k1, k2 } = p; // k in kN/m
      const K12 = k2 * b - k1 * a; // kN/rad
      const K22 = k1 * a * a + k2 * b * b; // kN m/rad
      const givens = [
        { sym: 'm', value: `${m} kg`, label: 'mass' },
        { sym: 'J', value: `${J} kg m²`, label: 'pitch inertia about G' },
        { sym: 'k_1', value: `${k1} kN/m`, label: `left spring, a = ${a} m left of G` },
        { sym: 'k_2', value: `${k2} kN/m`, label: `right spring, b = ${b} m right of G` },
      ];
      const intro = `A rigid vehicle body (mass $m$ = ${m} kg, pitch inertia $J$ = ${J} kg m² about its CoM G) rests on a spring $k_1$ = ${k1} kN/m a distance $a$ = ${a} m to the left of G and a spring $k_2$ = ${k2} kN/m a distance $b$ = ${b} m to the right. Use the bounce $y$ of G (up) and the pitch $\\theta$ (anticlockwise, right end up), both from static equilibrium.`;
      if (tier === 1) {
        return {
          prompt: `${intro} Find two entries of the stiffness matrix for $q = [y;\\ \\theta]$.`,
          givens,
          figure: BarFigure,
          parts: [
            num('K12', 'Coupling entry $K_{12}$', K12, 'kN/rad', [
              { value: -K12, message: 'Sign: anticlockwise θ **lifts** the right end ($y + b\\theta$) and lowers the left end ($y - a\\theta$), so $K_{12} = k_2b - k_1a$.', trapId: 'sign' },
              { value: k1 * a + k2 * b, message: 'Both cross terms were given the same sign. The left spring deflects $y - a\\theta$ and the right one $y + b\\theta$.', trapId: 'lever-arm' },
              { value: K12 / 2, message: 'A cross term $c\\,y\\theta$ in V gives $K_{12} = c$, not $c/2$.', trapId: 'offdiag-factor2' },
            ]),
            num('K22', 'Pitch entry $K_{22}$', K22, 'kN m/rad', [
              { value: k1 * a + k2 * b, message: 'The lever arm is squared: $\\tfrac12 k(a\\theta)^2$ gives $ka^2$ in $K_{22}$.', trapId: 'lever-arm' },
              { value: K22 / 2, message: 'Coefficient of $\\tfrac12\\theta^2$, not of $\\theta^2$: $K_{22} = k_1a^2 + k_2b^2$.', trapId: 'factor2' },
            ]),
          ],
          hints: [
            'Each spring’s deflection is translation + rotation × lever arm, written **before** squaring. With θ anticlockwise the right end rises and the left end falls.',
            '$V = \\tfrac12 k_1(y - a\\theta)^2 + \\tfrac12 k_2(y + b\\theta)^2$. Expand: the coefficient of $y\\theta$ is $K_{12} = k_2b - k_1a$; the coefficient of $\\tfrac12\\theta^2$ is $K_{22} = k_1a^2 + k_2b^2$.',
            `$K_{12} = ${k2}(${b}) - ${k1}(${a})$ and $K_{22} = ${k1}(${a})^2 + ${k2}(${b})^2$ (kN and m).`,
            `$K_{12} = ${t4(k2 * b)} - ${t4(k1 * a)} = $ **${f4(K12)} kN/rad**; $K_{22} = ${t4(k1 * a * a)} + ${t4(k2 * b * b)} = $ **${f4(K22)} kN m/rad**. ${Math.abs(K12) > 0 ? `Since $K_{12} \\ne 0$, bounce and pitch are coupled; moving the right spring to $b = k_1a/k_2$ = ${f4((k1 * a) / k2)} m would decouple them.` : ''}`,
          ],
        };
      }
      const sys = barSystem({ m, J, k1: k1 * 1000, a, k2: k2 * 1000, b });
      const { w, ratio } = eig2(sys.K, sys.M);
      if (tier === 2) {
        const node1 = -1 / ratio[0];
        const node2 = -1 / ratio[1];
        const wU = [Math.sqrt(sys.K[0][0] / m), Math.sqrt(sys.K[1][1] / J)];
        const cc = charCoeffs2(sys.K, sys.M);
        const parts: SolvePart[] = [
          toTermsPart(sys, 'TV', 'Sort the energy terms: T, V or not a term. M and K are assembled from your choices.', { mUnit: 'kg, kg m²', kUnit: 'N/m, N/rad, N m/rad', marks: 5 }),
          freqPart('f1', 'Lower natural frequency $f_1$', w[0], 'Hz', [
            { value: Math.min(...wU), message: 'That is an **uncoupled** frequency $\\sqrt{K_{ii}/M_{ii}}$. With $K_{12} \\ne 0$ the coupled frequencies lie outside the uncoupled pair.' },
            { value: Math.max(...wU), message: 'That is an uncoupled frequency; solve $\\det(K - \\omega^2M) = 0$ with the coupling term.' },
          ]),
          freqPart('f2', 'Higher natural frequency $f_2$', w[1], 'Hz', [
            { value: Math.max(...wU), message: 'That is an uncoupled frequency $\\sqrt{K_{ii}/M_{ii}}$; coupling pushes $\\omega_2$ above it.' },
            { value: Math.min(...wU), message: 'That is an uncoupled frequency, not a root of the coupled determinant.' },
          ]),
          num('node1', 'Node of mode 1: distance from G to the point that does not move (positive to the right)', node1, 'm', [
            { value: -node1, message: 'Sign: the node is where $y + x\\theta = 0$, i.e. $x = -Y/\\Theta$.', trapId: 'sign' },
            { value: node2, message: 'That is the node of mode 2 (the higher frequency), not of mode 1.' },
          ], { tol: 0.03 }),
        ];
        return {
          prompt: `${intro} Derive the EoM by Lagrange, then find the natural frequencies and the node of the lower mode.`,
          givens,
          figure: BarFigure,
          parts,
          hints: [
            'Coordinates at G make M diagonal: any coupling is elastic, from the lever arms. Then $\\det(K - \\omega^2M) = 0$ gives the frequencies, and each mode’s node is where $y + x\\theta = 0$.',
            '$T = \\tfrac12 m\\dot y^2 + \\tfrac12 J\\dot\\theta^2$, $V = \\tfrac12 k_1(y-a\\theta)^2 + \\tfrac12 k_2(y+b\\theta)^2$, so $M = \\mathrm{diag}(m, J)$, $K = \\begin{bmatrix} k_1+k_2 & k_2b-k_1a \\\\ k_2b-k_1a & k_1a^2+k_2b^2\\end{bmatrix}$; $mJ\\omega^4 - (mK_{22} + JK_{11})\\omega^2 + \\det K = 0$; node at $x = -Y/\\Theta$.',
            `$K = ${mtx(sys.K)}$ (N/m, N/rad, N m/rad), $M = ${mtx(sys.M)}$; ${t4(cc.A)}\\,\\omega^4 - ${t4(cc.B)}\\,\\omega^2 + ${t4(cc.C)} = 0$.`,
            `$\\omega^2 = ${t4(w[0] ** 2)}, ${t4(w[1] ** 2)}$, so $\\omega_1 = ${t4(w[0])}$ rad/s (**${f4(w[0] / TAU)} Hz**) and $\\omega_2 = ${t4(w[1])}$ rad/s (**${f4(w[1] / TAU)} Hz**). Mode ratios $\\Theta/Y = ${t4(ratio[0])}, ${t4(ratio[1])}$ rad/m, so the nodes are at $x = -Y/\\Theta$ = **${f4(node1)} m** (mode 1, ${node1 < -a || node1 > b ? 'outside the wheelbase: bounce-dominated' : 'inside the wheelbase'}) and ${f4(node2)} m (mode 2).`,
          ],
        };
      }
      // tier 3: road bump under the left spring + decoupling position
      const h0 = rng.step(5, 25, 5); // mm
      const h = h0 / 1000;
      const F = [[k1 * 1000 * h], [-k1 * 1000 * a * h]];
      const bStar = (k1 * a) / k2;
      return {
        prompt: `${intro} The left wheel runs over a bump that lifts the bottom of spring $k_1$ by $h(t) = h_0\\sin\\Omega t$ with $h_0$ = ${h0} mm (the right spring’s base stays level).`,
        givens: [...givens, { sym: 'h_0', value: `${h0} mm`, label: 'base lift under k₁' }],
        figure: BarFigure,
        parts: [
          {
            kind: 'matrix',
            id: 'F',
            label: 'Amplitude of the generalised force vector $F$ in $M\\ddot q + Kq = F\\sin\\Omega t$',
            answer: F,
            rowLabels: ['$y$ (N)', '$\\theta$ (N m)'],
            traps: safeMatTraps(F, [
              { value: [[-F[0][0]], [-F[1][0]]], message: 'Both signs reversed. Lifting the base compresses $k_1$: it pushes the body **up** and rotates it clockwise (left end up), so $Q_\\theta < 0$.', trapId: 'sign' },
              { value: [[F[0][0]], [0]], message: 'The base input acts through spring $k_1$ at lever arm $a$, so it also gives a moment $-k_1ah_0$.', trapId: 'lever-arm' },
              { value: [[F[0][0]], [-F[1][0]]], message: 'Sign of the moment: the left spring sits at $x = -a$, so its force $k_1h$ gives $Q_\\theta = -ak_1h$.', trapId: 'sign' },
            ]),
          } as MatrixPart,
          num('bstar', 'Where must the right spring sit ($b$, from G) for bounce and pitch to decouple?', bStar, 'm', [
            { value: a, message: 'Equal distances decouple only equal springs. The condition is $k_1a = k_2b$.' },
            { value: (k2 * a) / k1, message: 'Ratio inverted: $k_1a = k_2b$ gives $b = k_1a/k_2$.' },
          ]),
          choice('modes', 'With the right spring at that position, the two modes are…', [
            { text: 'a pure bounce (no rotation) and a pure pitch about G', correct: true, why: '$K_{12} = 0$ and M is diagonal, so the coordinates themselves are the modes.' },
            { text: 'still coupled, with nodes outside the wheelbase', correct: false, why: 'Coupling needs a non-zero off-diagonal entry in K or M; both are zero now.' },
            { text: 'two pitching modes about the springs', correct: false, why: 'A planar body on two springs has one bounce-type and one pitch-type mode.' },
          ]),
        ],
        hints: [
          'A prescribed base motion enters through the spring deflection, not as a separate force: spring 1 now stretches $(y - a\\theta) - h$. The known terms move to the right-hand side. Decoupling needs $K_{12} = 0$.',
          '$V = \\tfrac12 k_1(y - a\\theta - h)^2 + \\tfrac12 k_2(y + b\\theta)^2$. The terms linear in $q$ are $-k_1h(y - a\\theta)$, so $F = [k_1h;\\ -k_1ah]$. Decoupled when $k_1a = k_2b$.',
          `$k_1h_0 = ${k1 * 1000} \\times ${h} $ and $k_1ah_0 = ${k1 * 1000} \\times ${a} \\times ${h}$; $b = k_1a/k_2 = ${k1}(${a})/${k2}$.`,
          `$F = [${t4(F[0][0])};\\ ${t4(F[1][0])}]$: **${f4(F[0][0])} N** on y and **${f4(F[1][0])} N m** on θ (the bump lifts the left end, a clockwise moment). Decoupling position $b = $ **${f4(bStar)} m**; then the modes are a pure bounce at $\\sqrt{(k_1+k_2)/m}$ and a pure pitch at $\\sqrt{(k_1a^2+k_2b^2)/J}$.`,
        ],
      };
    },
  },

  // ================================================================== rod on a cart (2022 A2)
  {
    id: 'a2-cart-rod',
    title: 'Pendulum (rod) on a cart',
    summary: 'Moving-pivot kinematics, inertial coupling and gravity stiffness; frequencies, mode ratio, tip force and the k → 0 limit.',
    tiers: [1, 2, 3],
    source: 'Similar to 2022 A2.1–A2.3 (worked solutions)',
    cardId: 'a2-kinetic',
    marks: 14,
    generate(rng, tier) {
      const m = rng.step(2, 12, 0.5);
      const M = rng.step(1, 8, 0.5);
      const L = rng.step(0.25, 1.2, 0.05);
      const k = rng.step(10, 300, 10);
      const sys = cartRodSystem({ m, M, L, k });
      const givens = [
        { sym: 'm', value: `${m} kg`, label: 'cart' },
        { sym: 'M', value: `${M} kg`, label: 'rod' },
        { sym: '2L', value: `${fmt(2 * L, 3)} m`, label: 'rod length' },
        { sym: 'k', value: `${k} N/m`, label: 'wall spring' },
      ];
      const intro = `A cart of mass $m$ = ${m} kg rolls on a frictionless floor and is tied to a wall by a spring $k$ = ${k} N/m. A uniform rod (mass $M$ = ${M} kg, length $2L$ = ${fmt(2 * L, 3)} m) hangs from a frictionless pin on the cart. Use the cart displacement $x$ and the rod angle $\\theta$ from the downward vertical (positive when the lower end swings towards $+x$); small angles, $g$ = 9.81 m/s².`;
      if (tier === 1) {
        const M12 = M * L;
        const M22 = (4 * M * L * L) / 3;
        return {
          prompt: `${intro} Find the mass-matrix entries that involve the rod’s rotation.`,
          givens: givens.slice(1, 3),
          figure: CartRodFigure,
          parts: [
            num('M12', 'Coupling entry $M_{12}$', M12, 'kg m', [{ value: 2 * M * L, message: 'A cross term $c\\,\\dot x\\dot\\theta$ in T gives $M_{12} = c$: here $c = ML$ (from $\\tfrac12 M\\cdot 2L\\dot x\\dot\\theta$), not $2ML$.', trapId: 'offdiag-factor2' }]),
            num('M22', 'Rotation entry $M_{22}$', M22, 'kg m²', [
              { value: (M * L * L) / 3, message: '$ML^2/3$ is $I_G$ alone. G also moves on a circle of radius L about the pivot, adding $ML^2$ (parallel axis): $M_{22} = \\tfrac43ML^2$.', trapId: 'parallel-axis' },
              { value: M * L * L, message: 'That treats the rod as a point mass at G. Add its own rotation, $I_G = ML^2/3$.', trapId: 'parallel-axis' },
              { value: (7 * M * L * L) / 3, message: 'Double counting: $\\tfrac12 I_O\\dot\\theta^2$ plus $\\tfrac12 M(\\dot x + L\\dot\\theta)^2$ counts $ML^2$ twice.', trapId: 'parallel-axis' },
              { value: (13 * M * L * L) / 12, message: 'The rod is $2L$ long, so $I_G = M(2L)^2/12 = ML^2/3$, not $ML^2/12$.' },
            ]),
          ],
          hints: [
            'The pivot moves with the cart, so write the rod’s kinetic energy as $\\tfrac12 Mv_G^2 + \\tfrac12 I_G\\dot\\theta^2$ with the **absolute** velocity of G.',
            `For small θ, $v_G \\approx \\dot x + L\\dot\\theta$ (G is L below the pivot) and $I_G = M(2L)^2/12 = ML^2/3$. So $T_{rod} = \\tfrac12 M\\dot x^2 + ML\\dot x\\dot\\theta + \\tfrac12\\left(ML^2 + \\tfrac13 ML^2\\right)\\dot\\theta^2$.`,
            `$M_{12} = ML = ${M} \\times ${L}$; $M_{22} = \\tfrac43 ML^2 = \\tfrac43 \\times ${M} \\times ${L}^2$.`,
            `$M_{12} = $ **${f4(M12)} kg m** and $M_{22} = $ **${f4(M22)} kg m²** (with $M_{11} = m + M$ = ${f4(m + M)} kg).`,
          ],
        };
      }
      const { w, ratio } = eig2(sys.K, sys.M);
      if (tier === 2) {
        const wU = [Math.sqrt(k / (m + M)), Math.sqrt((3 * g) / (4 * L))];
        const cc = charCoeffs2(sys.K, sys.M);
        const node = -1 / ratio[1];
        return {
          prompt: `${intro} Derive the EoM with Lagrange, then find the natural frequencies and the second mode shape.`,
          givens,
          figure: CartRodFigure,
          parts: [
            toTermsPart(sys, 'TV', 'Sort each candidate term: T, V or not a term (wrong or not needed).', { mUnit: 'kg, kg m, kg m²', kUnit: 'N/m, N m/rad', marks: 6 }),
            freqPart('w1', 'Lower natural frequency $\\omega_1$', w[0], 'rad/s', [
              { value: Math.min(...wU), message: 'That is an uncoupled frequency ($\\sqrt{K_{ii}/M_{ii}}$). The inertial coupling $ML$ pushes $\\omega_1$ below both.' },
            ]),
            freqPart('w2', 'Higher natural frequency $\\omega_2$', w[1], 'rad/s', [
              { value: Math.max(...wU), message: 'That is an uncoupled frequency; the coupled $\\omega_2$ lies above it.' },
              { value: Math.sqrt(g / L), message: '$\\sqrt{g/L}$ treats the rod as a point mass at G on a fixed pivot.' },
            ]),
            num('r2', 'Mode-2 shape ratio $\\Theta/X$', ratio[1], 'rad/m', [
              { value: 1 / ratio[1], message: 'That is $X/\\Theta$ (m/rad). The ratio asked is $\\Theta/X$.' },
              { value: ratio[0], message: 'That is mode 1’s ratio (in phase).' },
            ]),
          ],
          hints: [
            'The pivot rides on the cart: use G’s absolute velocity in T (inertial coupling $ML$), and keep $\\cos\\theta \\approx 1 - \\theta^2/2$ in V so gravity gives the rod a stiffness $MgL$.',
            '$T = \\tfrac12 m\\dot x^2 + \\tfrac12 M(\\dot x + L\\dot\\theta)^2 + \\tfrac12(\\tfrac13ML^2)\\dot\\theta^2$, $V = \\tfrac12 kx^2 + \\tfrac12 MgL\\theta^2$, so $M = \\begin{bmatrix} m+M & ML \\\\ ML & \\tfrac43ML^2 \\end{bmatrix}$, $K = \\mathrm{diag}(k, MgL)$. Mode ratio from row 1: $\\Theta/X = (k - (m+M)\\omega^2)/(ML\\omega^2)$.',
            `$M = ${mtx(sys.M)}$, $K = ${mtx(sys.K)}$; $\\det(K - \\omega^2M) = ${t4(cc.A)}\\,\\omega^4 - ${t4(cc.B)}\\,\\omega^2 + ${t4(cc.C)} = 0$.`,
            `$\\omega^2 = ${t4(w[0] ** 2)}$ and $${t4(w[1] ** 2)}$, so $\\omega_1 = $ **${f4(w[0])} rad/s** (${f4(w[0] / TAU)} Hz) and $\\omega_2 = $ **${f4(w[1])} rad/s** (${f4(w[1] / TAU)} Hz). Ratios $\\Theta/X$ = ${f4(ratio[0])} (mode 1, in phase) and **${f4(ratio[1])} rad/m** (mode 2, out of phase), so in mode 2 the point ${f4(node)} m below the pivot stays still${node < 2 * L ? ' (on the rod)' : ' (beyond the rod’s tip)'}.`,
          ],
        };
      }
      // tier 3: force at the rod tip (virtual work) + k → 0 limit
      const P0 = rng.step(2, 20, 1);
      const Q = [[P0], [2 * L * P0]];
      const w0 = Math.sqrt(cartRodFreeOmega2(m, M, L));
      return {
        prompt: `${intro} A horizontal force $P(t) = P_0\\cos\\Omega t$ with $P_0$ = ${P0} N now acts at the rod’s **lower tip**. Then the wall spring is removed ($k \\to 0$).`,
        givens: [...givens, { sym: 'P_0', value: `${P0} N`, label: 'tip force amplitude' }],
        figure: CartRodFigure,
        parts: [
          {
            kind: 'matrix',
            id: 'Q',
            label: 'Amplitude of the generalised forces $[Q_x;\\ Q_\\theta]$',
            answer: Q,
            rowLabels: ['$Q_x$ (N)', '$Q_\\theta$ (N m)'],
            traps: safeMatTraps(Q, [
              { value: [[P0], [L * P0]], message: 'The force acts at the tip, $2L$ below the pivot, not at G.', trapId: 'lever-arm' },
              { value: [[P0], [0]], message: 'A force at the tip also does work when θ changes: the tip moves $x + 2L\\theta$.' },
              { value: [[0], [2 * L * P0]], message: 'The tip also moves with the cart: $\\partial(x + 2L\\theta)/\\partial x = 1$, so $Q_x = P_0$.' },
            ]),
          } as MatrixPart,
          freqPart('w0', 'With $k = 0$: the non-zero natural frequency', w0, 'rad/s', [
            { value: Math.sqrt((3 * g) / (4 * L)), message: '$\\sqrt{3g/4L}$ is the rod on a **fixed** pivot (cart infinitely heavy). Here the free cart recoils, which raises the frequency.' },
            { value: Math.sqrt(g / L), message: '$\\sqrt{g/L}$ is a point mass at G on a fixed pivot.' },
          ]),
          choice('w1', 'With $k = 0$, what happens to the other natural frequency?', [
            { text: 'It is zero: cart and rod can translate together freely (rigid-body mode, $\\det K = 0$).', correct: true, why: 'With $K = \\mathrm{diag}(0, MgL)$ the motion $[x, \\theta] = [1, 0]$ stores no energy.' },
            { text: 'It equals $\\sqrt{3g/4L}$.', correct: false, why: 'That is the pendulum on a fixed pivot; it is not a root here.' },
            { text: 'It is unchanged, because the spring only affects the cart.', correct: false, why: 'Every coupled frequency depends on every stiffness.' },
          ]),
        ],
        hints: [
          'Generalised forces come from virtual work: $W = P\\times$(horizontal displacement of the tip) and $Q_i = \\partial W/\\partial q_i$. For $k \\to 0$ the system is unrestrained.',
          'The tip is $2L$ below the pivot, so it moves $x + 2L\\sin\\theta \\approx x + 2L\\theta$: $W = P(x + 2L\\theta)$. With $k = 0$: $\\det(K - \\omega^2M) = 0$ gives $\\omega^2 = 0$ and $\\omega^2 = 3g(m+M)/(L(4m+M))$.',
          `$Q = P_0[1;\\ 2L] = ${P0}[1;\\ ${t4(2 * L)}]$; $\\omega^2 = 3(9.81)(${m} + ${M})/(${L}(4\\times${m} + ${M}))$.`,
          `$Q = [$**${P0} N**$;\\ $**${f4(2 * L * P0)} N m**$]$. With $k = 0$: $\\omega_1 = 0$ (free translation) and $\\omega_2 = \\sqrt{${t4(w0 * w0)}} = $ **${f4(w0)} rad/s**, above the fixed-pivot value $\\sqrt{3g/4L}$ = ${f4(Math.sqrt((3 * g) / (4 * L)))} rad/s.`,
        ],
      };
    },
  },

  // ================================================================== nest swing (2021 A2)
  {
    id: 'a2-nest',
    title: 'Nest swing: absolute vs relative rotation',
    summary: 'Which T is correct, the inertial coupling from a relative coordinate, frequencies and mode shape, rope stiffness and a push on the plate.',
    tiers: [1, 2, 3],
    source: 'Similar to 2021 A2.1–A2.6 (worked solutions)',
    cardId: 'a2-kinetic',
    marks: 12,
    generate(rng, tier) {
      const m = rng.step(10, 35, 1);
      const r = rng.step(0.3, 0.6, 0.05);
      const I = Number(((m * r * r) / 4).toPrecision(3));
      const h = rng.step(1.2, 2.8, 0.1);
      const k = rng.step(10, 200, 5);
      const givens = [
        { sym: 'm', value: `${m} kg`, label: 'plate' },
        { sym: 'I', value: `${I} kg m²`, label: 'about A–A' },
        { sym: 'h', value: `${h} m`, label: 'beam to A–A' },
        { sym: 'k', value: `${k} N m/rad`, label: 'rocking stiffness' },
      ];
      // Tier 3 derives k from the ropes, so its prompt must not also state a (different) value of k.
      const kTxt = tier === 3 ? 'a rotational stiffness $k$' : `a rotational stiffness $k$ = ${k} N m/rad`;
      const intro = `A nest swing: a circular plate (mass $m$ = ${m} kg, $I$ = ${I} kg m² about the axis A–A through its centre) hangs on ropes a distance $h$ = ${h} m below the beam. The ropes swing through $\\theta$; the plate also rocks about A–A by $\\phi$ **relative to the ropes**, resisted by ${kTxt}. Small angles, $g$ = 9.81 m/s².`;
      if (tier === 1) {
        return {
          prompt: `${intro}`,
          givens,
          figure: NestFigure,
          parts: [
            choice('T', 'Which kinetic energy is correct?', [
              { text: '$\\tfrac12 mh^2\\dot\\theta^2 + \\tfrac12 I(\\dot\\theta + \\dot\\phi)^2$', correct: true, why: 'Centre moves at $h\\dot\\theta$; the plate’s absolute angular velocity is $\\dot\\theta + \\dot\\phi$.' },
              { text: '$\\tfrac12 mh^2\\dot\\theta^2 + \\tfrac12 I\\dot\\phi^2$', correct: false, why: '$\\dot\\phi$ is measured relative to the rope; T needs the absolute rate.' },
              { text: '$\\tfrac12(I + mh^2)\\dot\\theta^2 + \\tfrac12 I\\dot\\phi^2$', correct: false, why: 'Misses the cross term $I\\dot\\theta\\dot\\phi$, so M would be diagonal.' },
              { text: '$\\tfrac12 I(\\dot\\theta + \\dot\\phi)^2$', correct: false, why: 'Forgets the translation of the plate’s centre, $\\tfrac12 m(h\\dot\\theta)^2$.' },
            ]),
            num('M11', 'Mass-matrix entry $M_{11}$ (for $\\ddot\\theta$ in the θ equation)', I + m * h * h, 'kg m²', [
              { value: m * h * h, message: 'Expanding $\\tfrac12 I(\\dot\\theta+\\dot\\phi)^2$ also puts $I$ into $M_{11}$: $M_{11} = I + mh^2$.' },
              { value: I, message: 'Add the plate centre’s translation, $mh^2$.' },
            ]),
          ],
          hints: [
            'T needs absolute velocities: the plate centre’s speed and the plate’s absolute angular velocity. φ is a relative angle.',
            '$v_G = h\\dot\\theta$ (circle of radius h); absolute rotation rate $\\dot\\theta + \\dot\\phi$. So $T = \\tfrac12 mh^2\\dot\\theta^2 + \\tfrac12 I(\\dot\\theta+\\dot\\phi)^2$ and $M = [[I + mh^2,\\ I],[I,\\ I]]$.',
            `$M_{11} = I + mh^2 = ${I} + ${m}(${h})^2$.`,
            `The first option is correct, and $M_{11} = $ **${f4(I + m * h * h)} kg m²** ($M_{12} = M_{22} = I$ = ${I} kg m²).`,
          ],
        };
      }
      const sys = nestSystem({ m, I, h, k });
      const { w, ratio } = eig2(sys.K, sys.M);
      const l1 = k / I;
      const l2 = g / h;
      const l3 = l1 + l2 + k / (m * h * h);
      if (tier === 2) {
        const thetaPhi1 = 1 / ratio[0]; // ratio = φ/θ
        return {
          prompt: `${intro} Derive the EoM and find the natural frequencies and the first mode shape.`,
          givens,
          figure: NestFigure,
          parts: [
            toTermsPart(sys, 'TV', 'Sort each candidate term: T, V or not a term.', { mUnit: 'kg m²', kUnit: 'N m/rad', marks: 5 }),
            freqPart('w1', 'Lower natural frequency $\\omega_1$', w[0], 'rad/s', [
              { value: Math.sqrt(Math.min(l1, l2)), message: `That is $\\sqrt{\\min(\\lambda_1, \\lambda_2)}$, an uncoupled value. The coupled $\\omega_1^2$ lies below both $\\lambda_1 = k/I$ and $\\lambda_2 = g/h$.` },
            ]),
            freqPart('w2', 'Higher natural frequency $\\omega_2$', w[1], 'rad/s', [
              { value: Math.sqrt(Math.max(l1, l2)), message: 'That is an uncoupled value; the coupled $\\omega_2^2$ lies above $\\max(\\lambda_1, \\lambda_2)$.' },
              { value: Math.sqrt(l3), message: '$\\sqrt{\\lambda_3}$ is not a root: solve $\\omega^4 - \\lambda_3\\omega^2 + \\lambda_1\\lambda_2 = 0$.' },
            ]),
            num('ratio1', 'Mode 1: $\\Theta/\\Phi$', thetaPhi1, '', [
              { value: ratio[0], message: 'That is $\\Phi/\\Theta$. Use row 2: $\\Theta/\\Phi = \\lambda_1/\\omega^2 - 1$.' },
            ]),
          ],
          hints: [
            'T uses the plate’s absolute rotation $\\dot\\theta + \\dot\\phi$ (inertial coupling $I$); the spring twists by the relative angle φ; gravity acts on θ only. Then $\\det(K - \\omega^2M) = 0$.',
            '$M = \\begin{bmatrix} I + mh^2 & I \\\\ I & I\\end{bmatrix}$, $K = \\mathrm{diag}(mgh, k)$. Dividing the determinant by $mh^2I$: $\\omega^4 - \\lambda_3\\omega^2 + \\lambda_1\\lambda_2 = 0$ with $\\lambda_1 = k/I$, $\\lambda_2 = g/h$, $\\lambda_3 = \\lambda_1 + \\lambda_2 + k/(mh^2)$. Row 2 gives $\\Theta/\\Phi = \\lambda_1/\\omega^2 - 1$.',
            `$\\lambda_1 = ${t4(l1)}$, $\\lambda_2 = ${t4(l2)}$, $\\lambda_3 = ${t4(l3)}$ (s⁻²); $\\omega^2 = \\tfrac12\\left[${t4(l3)} \\mp \\sqrt{${t4(l3)}^2 - 4(${t4(l1)})(${t4(l2)})}\\right]$.`,
            `$\\omega_1 = $ **${f4(w[0])} rad/s** and $\\omega_2 = $ **${f4(w[1])} rad/s**; mode 1: $\\Theta/\\Phi = ${t4(l1)}/${t4(w[0] ** 2)} - 1 = $ **${f4(thetaPhi1)}** (${thetaPhi1 > 0 ? 'same sense' : 'opposite sense'}; mode 2 has $\\Theta/\\Phi$ = ${f4(1 / ratio[1])}).`,
          ],
        };
      }
      // tier 3: rope stiffness + push on the plate
      const E = rng.step(500, 4000, 100);
      const Lr = rng.step(0.2, 0.6, 0.05);
      const alphaDeg = rng.step(20, 70, 5);
      const al = (alphaDeg * Math.PI) / 180;
      const kr = ropeStiffness(E, Lr, al);
      const F0 = rng.step(5, 40, 5);
      const Q = [[F0 * h], [0]];
      return {
        prompt: `${intro} (a) The rocking stiffness comes from four inclined rope portions, each of length $L$ = ${Lr} m with axial stiffness $E/L$ ($E$ = ${E} N), at $\\alpha$ = ${alphaDeg}° to the plate. (b) A child pushes the plate centre horizontally with $F(t) = F_0\\cos\\Omega t$, $F_0$ = ${F0} N.`,
        givens: [...givens.slice(0, 3), { sym: 'E', value: `${E} N` }, { sym: 'L', value: `${Lr} m`, label: 'rope portion' }, { sym: '\\alpha', value: `${alphaDeg}°` }, { sym: 'F_0', value: `${F0} N` }],
        figure: NestFigure,
        parts: [
          num('k', 'Rocking stiffness $k = EL\\sin^2 2\\alpha$ from the rope energy', kr, 'N m/rad', [
            { value: E * Lr * Math.sin(al) ** 2, message: 'Each attachment moves $d\\phi$ normal to the plate with $d = L\\cos\\alpha$, and the rope stretches $d\\phi\\sin\\alpha$: both $\\sin\\alpha$ and $\\cos\\alpha$ appear, $k = 4EL\\sin^2\\alpha\\cos^2\\alpha$.' },
            { value: E * Lr * Math.cos(al) ** 2, message: 'Both the lever arm $L\\cos\\alpha$ and the stretch factor $\\sin\\alpha$ enter: $k = 4EL\\sin^2\\alpha\\cos^2\\alpha$.' },
          ]),
          {
            kind: 'matrix',
            id: 'Q',
            label: 'Amplitude of the generalised forces $[Q_\\theta;\\ Q_\\phi]$ from the push',
            answer: Q,
            rowLabels: ['$Q_\\theta$ (N m)', '$Q_\\phi$ (N m)'],
            traps: safeMatTraps(Q, [
              { value: [[F0 * h], [F0 * h]], message: 'Rocking about A–A does not move the plate centre (it lies on A–A), so the push does no work on φ: $Q_\\phi = 0$.' },
              { value: [[F0], [0]], message: 'θ is an angle: the centre moves $h\\theta$, so $Q_\\theta = F_0h$ (N m).' },
            ]),
          } as MatrixPart,
          choice('k0', 'If the rocking stiffness tends to zero, the non-zero mode is…', [
            { text: 'the plate staying level ($\\theta + \\phi = 0$) and swinging like a simple pendulum at $\\sqrt{g/h}$', correct: true, why: 'With $k \\to 0$: $\\omega^2 = g/h$ and $\\Theta = -\\Phi$ (2021 A2.5). The other root is ω = 0 (free plate rotation).' },
            { text: 'the plate rocking about A–A at $\\sqrt{k/I}$', correct: false, why: '$k/I \\to 0$: that becomes the zero-frequency mode.' },
            { text: 'a compound pendulum including the plate’s inertia $I$', correct: false, why: 'With no rocking stiffness the plate does not have to turn with the rope, so I drops out.' },
          ]),
        ],
        hints: [
          'Equivalent stiffness by energy: write the stretch of each rope portion in terms of φ, sum $\\tfrac12(E/L)e^2$ and match it to $\\tfrac12 k\\phi^2$. Generalised forces: virtual work of the push.',
          'Each attachment is $d = L\\cos\\alpha$ from the axis, moves $d\\phi$ normal to the plate, and stretches its rope by $e = d\\phi\\sin\\alpha$. $V = 4\\cdot\\tfrac12(E/L)e^2$ ⇒ $k = 4EL\\sin^2\\alpha\\cos^2\\alpha = EL\\sin^2 2\\alpha$. The push moves through $h\\theta$, so $W = F h\\theta$.',
          `$k = ${E}(${Lr})\\sin^2(${2 * alphaDeg}°)$; $Q = [F_0h;\\ 0] = [${F0}(${h});\\ 0]$.`,
          `$k = $ **${f4(kr)} N m/rad** (largest at α = 45°); $Q_\\theta = $ **${f4(F0 * h)} N m**, $Q_\\phi = $ **0** (A–A passes through the centre). As $k \\to 0$ the plate stays level and swings at $\\sqrt{g/h}$ = ${f4(Math.sqrt(g / h))} rad/s.`,
        ],
      };
    },
  },

  // ================================================================== folding-leg platform (2023 A2)
  {
    id: 'a2-platform',
    title: 'Folding-leg platform: mechanism kinematics',
    summary: 'Springs whose ends ride on moving legs; the coupling created by removing a spring; generalised force and bounce suppression.',
    tiers: [1, 2, 3],
    source: 'Similar to 2023 A2.1–A2.5 (worked solutions)',
    cardId: 'a2-potential',
    marks: 14,
    sprint: false,
    generate(rng, tier) {
      const p = draw(
        rng,
        () => ({ m: rng.step(10, 40, 1), b: rng.step(0.3, 0.7, 0.05), t: rng.step(0.02, 0.08, 0.01), a: rng.step(0.15, 0.6, 0.05), k1: rng.step(100, 800, 50), k2: rng.step(200, 1500, 50) }),
        (q) => q.a <= 0.85 * q.b
      );
      const { m, b, t, a, k1, k2 } = p;
      const IG = Number(((m * (4 * b * b + t * t)) / 12).toPrecision(4));
      const l = (4 * a) / Math.sqrt(3);
      const givens = [
        { sym: 'm', value: `${m} kg` },
        { sym: 'I_G', value: `${IG} kg m²` },
        { sym: 'k_1', value: `${k1} N/m`, label: 'horizontal spring' },
        { sym: 'k_2', value: `${k2} N/m`, label: 'vertical spring' },
        { sym: 'a', value: `${a} m`, label: 'CoM to vertical spring' },
        { sym: '2b', value: `${fmt(2 * b, 3)} m`, label: 'platform width' },
      ];
      const intro = `A mobile platform (mass $m$ = ${m} kg, $I_G$ = ${IG} kg m², width $2b$ = ${fmt(2 * b, 3)} m) sits on two massless legs of length $l$ = ${fmt(l, 3)} m, pinned at its CoM and opened 120° apart; the feet slide without friction. A horizontal spring $k_1$ = ${k1} N/m joins the legs’ mid-points, and vertical springs $k_2$ = ${k2} N/m join the platform at $\\pm a$ ($a$ = ${a} m) to the mid-points directly below. Coordinates: bounce $x$ of the CoM (up) and pitch $\\theta$ (anticlockwise), from static equilibrium.`;
      if (tier === 1) {
        const { xmm, thm } = draw(
          rng,
          () => ({ xmm: rng.step(2, 10, 1), thm: rng.pick([-1, 1]) * rng.step(5, 30, 5) }), // mm, mrad
          (q) => Math.abs(q.xmm / 2 + a * q.thm) >= 0.5
        );
        const d2 = xmm / 2 + a * thm; // mm (a in m × mrad = mm)
        const d1 = xmm / Math.sqrt(3);
        return {
          prompt: `${intro} The platform bounces up by $x$ = ${xmm} mm and pitches by $\\theta$ = ${thm} mrad.`,
          givens: [...givens.slice(4, 5), { sym: 'x', value: `${xmm} mm` }, { sym: '\\theta', value: `${thm} mrad` }],
          figure: PlatformFigure,
          parts: [
            num('d2', 'Change of length of the **right** vertical spring (positive = stretched)', d2, 'mm', [
              { value: xmm + a * thm, message: 'The spring’s lower end rides on the leg mid-point, which rises $x/2$. Deflection $= (x + a\\theta) - x/2$.' },
              { value: a * thm, message: 'Translation is missing: the top end also moves with the bounce x.', trapId: 'lever-arm' },
              { value: xmm / 2, message: 'Rotation × lever arm is missing: the top end moves $x + a\\theta$.', trapId: 'lever-arm' },
            ], { absTol: 0.02 }),
            num('d1', 'Shortening of the horizontal spring $k_1$', d1, 'mm', [
              { value: xmm, message: 'k₁ is horizontal: it shortens by the mid-points’ inward motion, not by the bounce.' },
              { value: (2 * xmm) / Math.sqrt(3), message: 'Each **foot** slides in $x/\\sqrt3$; the mid-points move half as far, $x/(2\\sqrt3)$ each, so they close up by $x/\\sqrt3$.' },
              { value: xmm / (2 * Math.sqrt(3)), message: 'That is one mid-point’s motion; both move inward, so the spring shortens by twice that.' },
            ]),
          ],
          hints: [
            'A spring’s deflection is the difference of its two ends’ motions along its axis. Here the bottom ends are not fixed: they ride on the leg mid-points.',
            'Top of the right spring: $x + a\\theta$. Leg mid-point: the pivot rises x and the foot stays on the ground, so it rises $x/2$. Legs at 30° to the ground: pivot height $l/2$, foot span $(\\sqrt3/2)l$, so $\\delta s = -x/\\sqrt3$ per foot and $-x/(2\\sqrt3)$ per mid-point.',
            `Right spring: $\\delta_2 = x/2 + a\\theta = ${xmm}/2 + ${a}\\times(${thm})$ mm; horizontal spring: $x/\\sqrt3 = ${xmm}/\\sqrt3$ mm.`,
            `$\\delta_2 = ${t4(xmm / 2)} + ${t4(a * thm)} = $ **${f4(d2)} mm**${d2 < 0 ? ' (compressed)' : ''}; $k_1$ shortens by **${f4(d1)} mm**. These give $V = \\tfrac12 k_1(x/\\sqrt3)^2 + \\tfrac12 k_2(x/2 + a\\theta)^2 + \\dots$`,
          ],
        };
      }
      const sys = platformSystem({ m, IG, k1, k2, a });
      const { w } = eig2(sys.K, sys.M);
      if (tier === 2) {
        const cc = charCoeffs2(sys.K, sys.M);
        const KI = [
          [k1 / 3 + k2 / 2, 0],
          [0, 2 * k2 * a * a],
        ];
        return {
          prompt: `${intro} In case (II) the **left** vertical spring is removed. Derive the EoM for case (II) and find its natural frequencies.`,
          givens,
          figure: PlatformFigure,
          parts: [
            toTermsPart(sys, 'TV', 'Case (II): sort each candidate term into T, V or not a term.', { mUnit: 'kg, kg m²', kUnit: 'N/m, N/rad, N m/rad', marks: 6 }),
            freqPart('w1', 'Lower natural frequency $\\omega_1$', w[0], 'rad/s', [
              { value: Math.sqrt(KI[0][0] / m), message: 'That is the bounce frequency of case (I) with both springs. Removing the left spring changes K and couples the motions.' },
              { value: Math.sqrt(sys.K[0][0] / m), message: 'That is the uncoupled bounce frequency $\\sqrt{K_{11}/m}$; the coupling $K_{12}$ moves it.' },
            ]),
            freqPart('w2', 'Higher natural frequency $\\omega_2$', w[1], 'rad/s', [
              { value: Math.sqrt(KI[1][1] / IG), message: 'That is the pitch frequency of case (I).' },
              { value: Math.sqrt(sys.K[1][1] / IG), message: 'That is the uncoupled pitch frequency $\\sqrt{K_{22}/I_G}$.' },
            ]),
          ],
          hints: [
            'Mechanism kinematics first: the leg mid-points rise $x/2$ and close up by $x/\\sqrt3$. Removing one vertical spring breaks the symmetry, so $K_{12} \\ne 0$.',
            '$T = \\tfrac12 m\\dot x^2 + \\tfrac12 I_G\\dot\\theta^2$; $V = \\tfrac12 k_1(x/\\sqrt3)^2 + \\tfrac12 k_2(x/2 + a\\theta)^2$, so $K = \\begin{bmatrix} k_1/3 + k_2/4 & k_2a/2 \\\\ k_2a/2 & k_2a^2\\end{bmatrix}$.',
            `$K = ${mtx(sys.K)}$, $M = ${mtx(sys.M)}$; $${t4(cc.A)}\\,\\omega^4 - ${t4(cc.B)}\\,\\omega^2 + ${t4(cc.C)} = 0$.`,
            `$\\omega^2 = ${t4(w[0] ** 2)}, ${t4(w[1] ** 2)}$: $\\omega_1 = $ **${f4(w[0])} rad/s** (${f4(w[0] / TAU)} Hz), $\\omega_2 = $ **${f4(w[1])} rad/s** (${f4(w[1] / TAU)} Hz). (Case (I) is uncoupled: $\\sqrt{(k_1/3 + k_2/2)/m}$ = ${f4(Math.sqrt(KI[0][0] / m))} and $\\sqrt{2k_2a^2/I_G}$ = ${f4(Math.sqrt(KI[1][1] / IG))} rad/s.)`,
          ],
        };
      }
      // tier 3: force at the left edge → Q and the bounce-suppression frequency
      const F0 = rng.step(5, 50, 5);
      const Q = [[-F0], [b * F0]];
      const wStar = platformSuppressionOmega(sys.K, IG, b);
      const slip2 = (sys.K[1][1] - b * sys.K[0][1]) / IG;
      return {
        prompt: `${intro} Case (II), left vertical spring removed. A downward force $f(t) = F_0\\sin\\omega t$ with $F_0$ = ${F0} N acts at the platform’s **left edge** (a distance $b$ = ${b} m from the CoM).`,
        givens: [...givens, { sym: 'F_0', value: `${F0} N` }],
        figure: PlatformFigure,
        parts: [
          {
            kind: 'matrix',
            id: 'Q',
            label: 'Amplitude of the generalised forces $[Q_x;\\ Q_\\theta]$',
            answer: Q,
            rowLabels: ['$Q_x$ (N)', '$Q_\\theta$ (N m)'],
            traps: safeMatTraps(Q, [
              { value: [[-F0], [-b * F0]], message: 'Sign of the moment: anticlockwise θ **lowers** the left edge, so the downward force does positive work on θ: $Q_\\theta = +bF_0$.', trapId: 'sign' },
              { value: [[F0], [b * F0]], message: 'The force is downward and x is upward: $Q_x = -F_0$.', trapId: 'sign' },
              { value: [[-F0], [0]], message: 'The force acts a distance b from the CoM, so it has a moment.' },
            ]),
          } as MatrixPart,
          freqPart('wstar', 'Forcing frequency at which the bounce $x$ is suppressed', wStar, 'rad/s', [
            ...(slip2 > 0 ? [{ value: Math.sqrt(slip2), message: 'Sign slip between $K_{12}$ and $Q_\\theta$ (the 2023 “common slip”): with $Q = F_0[-1;\\ b]$ the numerator of X is $-(K_{22} + bK_{12} - I_G\\omega^2)$.', trapId: 'sign' }] : []),
            { value: Math.sqrt(sys.K[1][1] / IG), message: '$\\sqrt{K_{22}/I_G}$ ignores the moment of the force: the force enters both rows.' },
            { value: w[1], message: 'That is a natural frequency, where the response is largest, not where x vanishes.' },
          ]),
        ],
        hints: [
          'Virtual work gives Q. Then solve $(K - \\omega^2M)X = Q$ by Cramer’s rule: x is suppressed where the numerator of $X$ vanishes (an anti-resonance).',
          'The left edge rises $x - b\\theta$, so $W = -f(x - b\\theta)$ ⇒ $Q = F_0[-1;\\ b]$. Numerator of X: $(K_{22} - I_G\\omega^2)(-F_0) - K_{12}(bF_0) = 0$ ⇒ $\\omega^2 = (K_{22} + bK_{12})/I_G$.',
          `$K_{12} = k_2a/2 = ${t4(sys.K[0][1])}$ N/rad, $K_{22} = k_2a^2 = ${t4(sys.K[1][1])}$ N m/rad; $\\omega^2 = (${t4(sys.K[1][1])} + ${b}\\times${t4(sys.K[0][1])})/${IG}$.`,
          `$Q = [$**${-F0} N**$;\\ $**${f4(b * F0)} N m**$]$; $\\omega^2 = ${t4(wStar * wStar)}$, so x is suppressed at **${f4(wStar)} rad/s** (${f4(wStar / TAU)} Hz), ${wStar > w[1] ? `above $\\omega_2$ = ${f4(w[1])} rad/s` : wStar > w[0] ? `between $\\omega_1$ = ${f4(w[0])} and $\\omega_2$ = ${f4(w[1])} rad/s` : `below $\\omega_1$ = ${f4(w[0])} rad/s`}. There $\\Theta = -F_0/K_{12}$: ${f4(-1000 / sys.K[0][1])} mrad per newton of $F_0$.`,
        ],
      };
    },
  },

  // ================================================================== box on four rubber springs (2024 A2)
  {
    id: 'a2-box',
    title: 'Box on four rubber springs (3 DoF)',
    summary: 'Which face for the inertia, shear lever arms, the 3 × 3 stiffness matrix, which motions couple, and a fifth spring.',
    tiers: [1, 2, 3],
    source: 'Similar to 2024 A2.1–A2.5 (worked solutions; official 2017 A2 method)',
    cardId: 'a2-potential',
    marks: 16,
    sprint: false,
    generate(rng, tier) {
      const p = draw(
        rng,
        () => ({ m: rng.step(800, 4000, 100), ky: rng.step(1, 8, 0.5), ratio: rng.pick([0.5, 1, 2, 4, 8]), a: rng.step(0.8, 2.4, 0.1), b: rng.step(0.6, 1.8, 0.1), c: rng.step(0.4, 1.6, 0.1) }),
        (q) => Math.abs(q.b - q.c) >= 0.2
      );
      const { m, ky, ratio, a, b, c } = p; // ky in MN/m
      const kx = ky * ratio;
      const Iz = boxInertia(m, a, c);
      const givens = [
        { sym: 'm', value: `${m} kg` },
        { sym: '2a,\\ 2b,\\ 2c', value: `${fmt(2 * a, 3)}, ${fmt(2 * b, 3)}, ${fmt(2 * c, 3)} m`, label: 'along x, z, y' },
        { sym: 'k_y', value: `${ky} MN/m`, label: 'axial (vertical), each' },
        { sym: 'k_x', value: `${fmt(kx, 3)} MN/m`, label: 'transverse (shear), each' },
      ];
      const intro = `A uniform box (mass $m$ = ${m} kg; $2a$ = ${fmt(2 * a, 3)} m along x, $2b$ = ${fmt(2 * b, 3)} m along z, $2c$ = ${fmt(2 * c, 3)} m high along y) stands on four rubber springs at the mid-points of the four bottom edges. Each has axial (vertical) stiffness $k_y$ = ${ky} MN/m and transverse stiffness $k_x$ = ${fmt(kx, 3)} MN/m. Consider only planar motion in the x–y plane: sway $x$ and bounce $y$ of G and rock $\\theta$ about z (anticlockwise).`;
      if (tier === 1) {
        return {
          prompt: `${intro}`,
          givens,
          figure: BoxFigure,
          parts: [
            num('Iz', 'Moment of inertia $I_z$ for the rocking', Iz, 'kg m²', [
              { value: (m * (a * a + b * b)) / 3, message: 'Wrong face: $m((2a)^2 + (2b)^2)/12$ is $I_y$. Rocking about z uses the face normal to z, $2a \\times 2c$.' },
              { value: (m * (b * b + c * c)) / 3, message: 'That is $I_x$ (the $2b \\times 2c$ face). Rocking about z uses $2a \\times 2c$.' },
              { value: (m * (a * a + c * c)) / 12, message: 'With half-dimensions the formula is $m(a^2 + c^2)/3$; $/12$ needs the full lengths $2a$ and $2c$.', trapId: 'factor2' },
            ]),
            num('Kxt', 'Sway–rock coupling entry $K_{x\\theta}$', 4 * kx * c, 'MN/rad', [
              { value: 2 * kx * c, message: 'All four springs shear when the box sways, including the front and back ones at x = 0.' },
              { value: kx * c, message: 'Sum over all four springs: $4k_xc$.' },
            ]),
          ],
          hints: [
            'Rotation about z: use the face normal to z. Every spring sits a depth c below G, so its horizontal deflection is translation + rotation × lever arm.',
            '$I_z = m((2a)^2 + (2c)^2)/12 = m(a^2 + c^2)/3$. A point at $(p_x, -c)$ moves $\\Delta x = x - (-c)\\theta = x + c\\theta$, so $V \\ni 4\\cdot\\tfrac12 k_x(x + c\\theta)^2$ and $K_{x\\theta} = 4k_xc$.',
            `$I_z = ${m}(${a}^2 + ${c}^2)/3$; $K_{x\\theta} = 4(${fmt(kx, 3)})(${c})$.`,
            `$I_z = $ **${f4(Iz)} kg m²** and $K_{x\\theta} = $ **${f4(4 * kx * c)} MN/rad** (nonzero, so sway and rock are coupled; bounce stays decoupled by symmetry).`,
          ],
        };
      }
      const K = boxK(kx, ky, a, c); // MN units
      if (tier === 2) {
        const KxT = [
          [K[0][0] * 1e6, K[0][2] * 1e6],
          [K[2][0] * 1e6, K[2][2] * 1e6],
        ];
        const { w } = eig2(KxT, [
          [m, 0],
          [0, Iz],
        ]);
        const wy = Math.sqrt((4 * ky * 1e6) / m);
        const wSway = Math.sqrt(KxT[0][0] / m);
        const wRock = Math.sqrt(KxT[1][1] / Iz);
        const K2 = boxK(kx, ky, a, c).map((r) => r.slice());
        K2[0][0] = 2 * kx;
        K2[0][2] = K2[2][0] = 2 * kx * c;
        K2[2][2] = 2 * kx * c * c + 2 * ky * a * a;
        const Knoc = boxK(kx, ky, a, c).map((r) => r.slice());
        Knoc[0][2] = Knoc[2][0] = 0;
        Knoc[2][2] = 2 * ky * a * a;
        return {
          prompt: `${intro} Derive the EoM and find all three natural frequencies.`,
          givens,
          figure: BoxFigure,
          parts: [
            {
              kind: 'matrix',
              id: 'K',
              label: 'Stiffness matrix for $q = [x;\\ y;\\ \\theta]$ (in MN/m, MN/rad, MN m/rad)',
              answer: K,
              rowLabels: ['$x$', '$y$', '$\\theta$'],
              colLabels: ['$x$', '$y$', '$\\theta$'],
              traps: safeMatTraps(K, [
                { value: K2, message: 'All four springs shear in x, including the front and back ones at x = 0: $4k_x$, $4k_xc$, $4k_xc^2$.' },
                { value: Knoc, message: 'The shear deflection is $x + c\\theta$ (the springs are c below G). Without the lever arm c there is no sway–rock coupling.', trapId: 'lever-arm' },
              ]),
            } as MatrixPart,
            freqPart('wy', 'Bounce natural frequency', wy, 'Hz', [
              { value: Math.sqrt((2 * ky * 1e6) / m), message: 'All four springs carry the bounce: $\\omega_y = \\sqrt{4k_y/m}$.' },
            ]),
            freqPart('w1', 'Lower sway–rock frequency', w[0], 'Hz', [
              { value: Math.min(wSway, wRock), message: 'That is an uncoupled frequency; the coupling $4k_xc$ pushes the lower root below both.' },
            ]),
            freqPart('w2', 'Higher sway–rock frequency', w[1], 'Hz', [
              { value: Math.max(wSway, wRock), message: 'That is an uncoupled frequency; the coupled root lies above it.' },
            ]),
          ],
          hints: [
            'Coordinates at G make M diagonal. Every spring is c below G: horizontal deflection $x + c\\theta$; vertical deflections $y$ (front, back) and $y \\mp a\\theta$ (left, right). Bounce separates from the sway–rock pair.',
            `$V = 4\\cdot\\tfrac12 k_x(x + c\\theta)^2 + 2\\cdot\\tfrac12 k_yy^2 + \\tfrac12 k_y(y - a\\theta)^2 + \\tfrac12 k_y(y + a\\theta)^2$, so $K = \\begin{bmatrix} 4k_x & 0 & 4k_xc \\\\ 0 & 4k_y & 0 \\\\ 4k_xc & 0 & 4k_xc^2 + 2k_ya^2\\end{bmatrix}$ and $M = \\mathrm{diag}(m, m, I_z)$, $I_z = m(a^2+c^2)/3$.`,
            `$K = ${mtx(K)}$ MN units, $I_z$ = ${f4(Iz)} kg m². Bounce: $\\sqrt{4k_y/m}$. Sway–rock: $\\det\\left(\\begin{bmatrix} ${t4(K[0][0])} & ${t4(K[0][2])} \\\\ ${t4(K[0][2])} & ${t4(K[2][2])}\\end{bmatrix}\\times10^6 - \\omega^2\\begin{bmatrix} ${m} & 0 \\\\ 0 & ${t4(Iz)}\\end{bmatrix}\\right) = 0$.`,
            `Bounce **${f4(wy / TAU)} Hz** (${f4(wy)} rad/s); sway–rock **${f4(w[0] / TAU)} Hz** and **${f4(w[1] / TAU)} Hz** (${f4(w[0])} and ${f4(w[1])} rad/s). Uncoupled sway and rock would be ${f4(wSway / TAU)} and ${f4(wRock / TAU)} Hz: the coupling pushes the pair apart.`,
          ],
        };
      }
      // tier 3: a fifth spring and a force on the top edge
      const F0 = rng.step(1, 10, 1); // kN
      return {
        prompt: `${intro} (a) A fifth identical spring is added under the **right-front bottom corner**, at $(x, y, z) = (+a, -c, +b)$ from G. (b) Separately, a horizontal force $F$ = ${F0} kN (in +x) acts at the middle of the **top** edge, a height c above G.`,
        givens: [...givens, { sym: 'F', value: `${F0} kN`, label: 'at (0, +c)' }],
        figure: BoxFigure,
        parts: [
          num('Kyt', 'New bounce–rock entry $K_{y\\theta}$ with the fifth spring', ky * a, 'MN/rad', [
            { value: -ky * a, message: 'The corner is at $x = +a$: its vertical deflection is $y + a\\theta$, so $K_{y\\theta} = +k_ya$.', trapId: 'sign' },
            { value: 0, message: 'The fifth spring breaks the left–right symmetry, so its cross term is not cancelled.' },
            { value: ky * b, message: 'z = b does not matter for rocking about z; the lever arm is the x offset a.', trapId: 'lever-arm' },
          ]),
          choice('coupling', 'With the fifth spring, which motions are coupled?', [
            { text: 'All three: sway–rock through $5k_xc$ and now bounce–rock through $k_ya$.', correct: true, why: 'Bounce is linked to rock, and rock to sway, so the three EoM are coupled (2024 A2.5).' },
            { text: 'Only sway and rock, as before.', correct: false, why: 'The extra vertical spring at $x = +a$ gives $K_{y\\theta} = k_ya \\ne 0$.' },
            { text: 'Only bounce and rock; sway decouples.', correct: false, why: 'Sway–rock coupling $5k_xc$ is still there.' },
            { text: 'None: adding a spring only stiffens the box.', correct: false, why: 'Stiffness added off-centre creates coupling.' },
          ]),
          num('Qt', '(b) Generalised moment $Q_\\theta$ of the top-edge force', -c * F0, 'kN m', [
            { value: c * F0, message: 'A point above G moves $\\Delta x = x - c\\theta$ when θ is anticlockwise, so $Q_\\theta = -cF$.', trapId: 'sign' },
            { value: -2 * c * F0, message: 'The top edge is c above G (the box is 2c high), so the arm is c.' },
          ]),
        ],
        hints: [
          'Add the fifth spring’s energy to V using translation + rotation × lever arm at its corner. For the force, use virtual work at its point of application.',
          'Corner $(+a, -c)$: horizontal $x + c\\theta$, vertical $y + a\\theta$ ⇒ $\\Delta V = \\tfrac12 k_x(x + c\\theta)^2 + \\tfrac12 k_y(y + a\\theta)^2$, so $K_{y\\theta}$ gains $k_ya$. Top point $(0, +c)$: $\\Delta x = x - c\\theta$ ⇒ $W = F(x - c\\theta)$.',
          `$K_{y\\theta} = k_ya = ${ky}(${a})$ MN/rad; $Q_\\theta = -cF = -(${c})(${F0})$ kN m.`,
          `$K_{y\\theta} = $ **${f4(ky * a)} MN/rad** (all three motions now couple; $K = ${mtx(boxK(kx, ky, a, c, true))}$ MN units). $Q_x = F$ and $Q_\\theta = $ **${f4(-c * F0)} kN m** (a force above G tips the box clockwise).`,
        ],
      };
    },
  },

  // ================================================================== range hood on wall mounts (2025 A2)
  {
    id: 'a2-hood',
    title: 'Range hood on wall mounts with an unbalanced fan',
    summary: 'Axial and transverse mount deflections, the y–θ coupling, Q from a force through the CoM, frequencies in rpm and the suppressed coordinate.',
    tiers: [1, 2, 3],
    source: 'Similar to 2025 A2.1–A2.4 (worked solutions)',
    cardId: 'a2-forces',
    marks: 14,
    sprint: false,
    generate(rng, tier) {
      const p = draw(
        rng,
        () => ({ m: rng.step(15, 40, 1), I: rng.step(5, 25, 1), kx: rng.step(0.1, 0.5, 0.02), ratio: rng.pick([1 / 4, 1 / 3, 1 / 2, 2 / 3, 1]), s: rng.step(0.25, 0.6, 0.05), d: rng.step(0.25, 0.6, 0.05), mbR: rng.step(0.005, 0.05, 0.005), N: rng.step(900, 1800, 100) }),
        () => true
      );
      const { m, I, kx, ratio, s, d, mbR, N } = p;
      const ky = kx * ratio; // MN/m
      const ratioS = ratio === 1 / 3 ? 'k_x/3' : ratio === 1 / 4 ? 'k_x/4' : ratio === 1 / 2 ? 'k_x/2' : ratio === 2 / 3 ? '2k_x/3' : 'k_x';
      const ratioPlain = ratioS.replace('k_x', 'kₓ'); // givens values are plain text, not TeX
      const ratioTxt = `$k_y = ${ratioS}$`;
      const givens = [
        { sym: 'm', value: `${m} kg` },
        { sym: 'I', value: `${I} kg m²`, label: 'about the CoM (top view)' },
        { sym: 'k_x', value: `${fmt(kx * 1000, 3)} kN/m`, label: 'axial, per mount' },
        { sym: 'k_y', value: `${ratioPlain} = ${fmt(ky * 1000, 4)} kN/m`, label: 'transverse, per mount' },
        { sym: 's,\\ d', value: `${s} m, ${d} m` },
        { sym: 'm_bR', value: `${mbR} kg m`, label: 'fan unbalance' },
      ];
      const intro = `A range hood (mass $m$ = ${m} kg, $I$ = ${I} kg m² about its CoM in the top view) is fixed to a wall by three mounts at $y = +s, 0, -s$ ($s$ = ${s} m), all a distance $d$ = ${d} m behind the CoM. Each mount has axial stiffness $k_x$ = ${fmt(kx * 1000, 3)} kN/m (normal to the wall) and transverse stiffness ${ratioTxt}. The fan, centred on the CoM, has unbalance $m_bR$ = ${mbR} kg m and runs at up to ${N} rpm. Coordinates at the CoM: $x$ away from the wall, $y$ along it, $\\theta$ anticlockwise.`;
      const W = (TAU * N) / 60;
      if (tier === 1) {
        const F0 = mbR * W * W;
        return {
          prompt: `${intro}`,
          givens: [{ sym: 'm_bR', value: `${mbR} kg m` }, { sym: 'N', value: `${N} rpm` }],
          figure: HoodFigure,
          parts: [
            num('F0', `Amplitude of the unbalance force at ${N} rpm`, F0, 'N', [
              { value: mbR * W, message: 'Centrifugal force grows with the **square** of the speed: $F_0 = m_bR\\Omega^2$.', trapId: 'unbalance-omega2' },
              { value: mbR * N * N, message: 'Convert rpm to rad/s first: $\\Omega = 2\\pi N/60$.', trapId: 'units' },
              { value: mbR * (N / 60) ** 2, message: 'Ω must be in rad/s, not rev/s: multiply by 2π.', trapId: 'units' },
            ]),
            choice('Q', 'Which generalised forces does the fan produce (force rotating at Ω through the CoM)?', [
              { text: '$Q_x = F_0\\cos\\Omega t$, $Q_y = F_0\\sin\\Omega t$, $Q_\\theta = 0$', correct: true, why: 'The force passes through the CoM, so it does no work on a rotation about the CoM.' },
              { text: '$Q_x = F_0\\cos\\Omega t$, $Q_y = F_0\\sin\\Omega t$, $Q_\\theta = F_0d\\sin\\Omega t$', correct: false, why: 'A moment about the CoM needs a line of action off the CoM; the fan is centred on it.' },
              { text: '$Q_x = Q_y = F_0$ (constant), $Q_\\theta = 0$', correct: false, why: 'The force rotates with the fan, so its components oscillate at Ω.' },
            ]),
          ],
          hints: [
            'An unbalance $m_bR$ spinning at Ω pulls with a rotating force of magnitude $m_bR\\Omega^2$ (Ω in rad/s). Q follows from virtual work at the CoM.',
            `$\\Omega = 2\\pi N/60$, $F_0 = m_bR\\Omega^2$, with components $F_0\\cos\\Omega t$ (x) and $F_0\\sin\\Omega t$ (y); $W = F_x x + F_y y + 0\\cdot\\theta$.`,
            `$\\Omega = 2\\pi(${N})/60 = ${t4(W)}$ rad/s; $F_0 = ${mbR}\\times${t4(W)}^2$.`,
            `$F_0 = $ **${f4(F0)} N**. $Q = [F_0\\cos\\Omega t,\\ F_0\\sin\\Omega t,\\ 0]$: no moment, because the force passes through the CoM.`,
          ],
        };
      }
      const Kyt = hoodYThetaK(kx * 1e6, ky * 1e6, s, d); // N units
      const M2 = [
        [m, 0],
        [0, I],
      ];
      const { w } = eig2(Kyt, M2);
      if (tier === 2) {
        const Kk = Kyt.map((r) => r.map((x) => x / 1000)); // kN units
        const wx = Math.sqrt((3 * kx * 1e6) / m);
        return {
          prompt: `${intro} Write the coupled y–θ equations of motion and find the natural frequencies.`,
          givens,
          figure: HoodFigure,
          parts: [
            {
              kind: 'matrix',
              id: 'K',
              label: 'Stiffness matrix for $q = [y;\\ \\theta]$ (kN/m, kN/rad, kN m/rad)',
              answer: Kk,
              rowLabels: ['$y$', '$\\theta$'],
              colLabels: ['$y$', '$\\theta$'],
              traps: safeMatTraps(Kk, [
                { value: [[Kk[0][0], 0], [0, (2 * kx * s * s * 1e6) / 1000]], message: 'The transverse mounts are a distance d behind the CoM: they deflect $y - d\\theta$, which couples y and θ.', trapId: 'lever-arm' },
                { value: [[Kk[0][0], -Kk[0][1]], [-Kk[0][1], Kk[1][1]]], message: 'Sign: a mount at $x = -d$ moves $\\Delta y = y + (-d)\\theta$, so $K_{y\\theta} = -3k_yd$.', trapId: 'offdiag-sign' },
                { value: [[Kk[0][0], Kk[0][1]], [Kk[0][1], (3 * ky * d * d * 1e6) / 1000]], message: 'The axial mounts at $\\pm s$ also resist rotation: they add $2k_xs^2$ to $K_{\\theta\\theta}$.' },
              ]),
            } as MatrixPart,
            freqPart('w1', 'Lower y–θ natural frequency', w[0], 'rpm', [
              { value: Math.sqrt(Kyt[0][0] / m), message: 'That is the uncoupled $\\sqrt{3k_y/m}$; the coupling term moves it.' },
              { value: Math.sqrt(ky * 1e6 / m), message: 'k_y is per mount: there are three, $K_{yy} = 3k_y$.' },
            ]),
            freqPart('w2', 'Higher y–θ natural frequency', w[1], 'rpm', [{ value: Math.sqrt(Kyt[1][1] / I), message: 'That is the uncoupled $\\sqrt{K_{\\theta\\theta}/I}$.' }]),
            freqPart('wx', 'Sway (x) natural frequency', wx, 'rpm', [{ value: Math.sqrt((kx * 1e6) / m), message: 'All three mounts resist x: $K_{xx} = 3k_x$.' }]),
          ],
          hints: [
            'Mount deflections from the CoM: axial $\\Delta x = x - p_y\\theta$, transverse $\\Delta y = y + p_x\\theta$ with $p_x = -d$. The axial mounts are symmetric (±s), so x decouples.',
            '$V = \\tfrac12 k_x[(x - s\\theta)^2 + x^2 + (x + s\\theta)^2] + \\tfrac32 k_y(y - d\\theta)^2$ ⇒ $K_{yy} = 3k_y$, $K_{y\\theta} = -3k_yd$, $K_{\\theta\\theta} = 2k_xs^2 + 3k_yd^2$; $K_{xx} = 3k_x$.',
            `$K = ${mtx(Kk)}$ kN units, $M = \\mathrm{diag}(${m}, ${I})$; $\\det(K - \\omega^2M) = 0$ and $\\omega_x = \\sqrt{3k_x/m}$.`,
            `$\\omega_1 = ${t4(w[0])}$ rad/s = **${f4(rpm(w[0]))} rpm**, $\\omega_2 = ${t4(w[1])}$ rad/s = **${f4(rpm(w[1]))} rpm**; sway $\\omega_x = ${t4(wx)}$ rad/s = **${f4(rpm(wx))} rpm**. ${rpm(w[1]) < N || rpm(w[0]) < N ? `The fan (up to ${N} rpm) passes through ${rpm(w[1]) < N ? 'both' : 'the first'} y–θ resonance${rpm(w[1]) < N ? 's' : ''} at start-up.` : `Both lie above the ${N} rpm maximum.`}`,
          ],
        };
      }
      // tier 3: suppressed coordinate during run-up
      const Wa = Math.sqrt(Kyt[1][1] / I);
      const F0 = mbR * Wa * Wa;
      const Th = F0 / Kyt[0][1]; // rad
      const X = F0 / (3 * kx * 1e6 - m * Wa * Wa);
      return {
        prompt: `${intro} During run-up one coordinate stops vibrating at a particular fan speed.`,
        givens,
        figure: HoodFigure,
        parts: [
          freqPart('Wa', 'Fan speed at which $y$ is suppressed', Wa, 'rpm', [
            { value: Math.sqrt(Kyt[0][0] / m), message: 'That is the uncoupled y frequency $\\sqrt{K_{yy}/m}$. The numerator of Y is $(K_{\\theta\\theta} - I\\Omega^2)F_0$, so y vanishes at $\\Omega_a = \\sqrt{K_{\\theta\\theta}/I}$.' },
            { value: w[0], message: 'That is a natural frequency (largest response), not the anti-resonance.' },
            { value: w[1], message: 'That is a natural frequency (largest response), not the anti-resonance.' },
          ]),
          choice('inrange', `Is that speed reached during a run-up from 0 to ${N} rpm?`, [
            { text: rpm(Wa) <= N ? 'Yes' : 'No', correct: true, why: `$\\Omega_a$ = ${f4(rpm(Wa))} rpm ${rpm(Wa) <= N ? '≤' : '>'} ${N} rpm.` },
            { text: rpm(Wa) <= N ? 'No' : 'Yes', correct: false, why: `Compare $\\Omega_a$ = ${f4(rpm(Wa))} rpm with ${N} rpm.` },
          ]),
          num('F0', 'Unbalance force amplitude at that speed', F0, 'N', [
            { value: mbR * W * W, message: 'Use the suppression speed, not the maximum speed: $F_0 = m_bR\\Omega_a^2$.' },
            { value: mbR * Wa, message: '$F_0 = m_bR\\Omega^2$: the square is missing.', trapId: 'unbalance-omega2' },
          ]),
          num('Th', 'Rotation amplitude $\\Theta$ there (with sign)', Th * 1000, 'mrad', [
            { value: -Th * 1000, message: 'Sign: at $\\Omega_a$, $\\Theta = F_0/K_{y\\theta}$ with $K_{y\\theta} = -3k_yd < 0$.', trapId: 'sign' },
          ]),
          num('X', 'Sway amplitude $|X|$ there', Math.abs(X) * 1000, 'mm', [{ value: (F0 / (3 * kx * 1e6)) * 1000, message: 'The static deflection $F_0/3k_x$ ignores the inertia term: $X = F_0/(3k_x - m\\Omega_a^2)$.' }]),
        ],
        hints: [
          'Forced y–θ response by Cramer’s rule with $Q = [F_0;\\ 0]$ (no moment). A coordinate is suppressed where its numerator vanishes; x is a separate SDOF driven by $F_0\\cos\\Omega t$.',
          '$Y = (K_{\\theta\\theta} - I\\Omega^2)F_0/\\Delta$ vanishes at $\\Omega_a = \\sqrt{K_{\\theta\\theta}/I}$. There $\\Delta = -K_{y\\theta}^2$, so $\\Theta = -K_{y\\theta}F_0/\\Delta = F_0/K_{y\\theta}$; $X = F_0/(3k_x - m\\Omega_a^2)$.',
          `$K_{\\theta\\theta} = ${t4(Kyt[1][1])}$ N m/rad, $K_{y\\theta} = ${t4(Kyt[0][1])}$ N/rad; $\\Omega_a = \\sqrt{${t4(Kyt[1][1])}/${I}}$; $F_0 = ${mbR}\\,\\Omega_a^2$.`,
          `$\\Omega_a = ${t4(Wa)}$ rad/s = **${f4(rpm(Wa))} rpm** (${rpm(Wa) <= N ? 'inside' : 'outside'} the run-up range); $F_0$ = **${f4(F0)} N**; $\\Theta = ${t4(F0)}/(${t4(Kyt[0][1])}) = $ **${f4(Th * 1000)} mrad**; $|X|$ = **${f4(Math.abs(X) * 1000)} mm**. Neither Θ nor X vanishes at any speed.`,
        ],
      };
    },
  },

  // ================================================================== unrestrained systems: rail cars, belt drive, gear train
  {
    id: 'a2-free',
    title: 'Unrestrained systems: rail cars, belt drive, gear train',
    summary: 'Zero-frequency rigid-body modes, belts (both sides, Rθ), gear-referred inertia and a load-torque generalised force.',
    tiers: [1, 2, 3],
    source: 'Similar to official 2017 A1, Week 3 Q2 (cars); official 2019 Q2 and Week 2 Q4 (belt); official 2018 A2 (gears)',
    cardId: 'a2-checks',
    marks: 12,
    generate(rng, tier) {
      if (tier === 1) {
        const m1 = rng.step(20, 90, 1);
        const m2 = rng.step(20, 90, 1);
        const k = rng.step(5, 60, 1);
        const w2 = Math.sqrt(twoCarOmega2(m1 * 1000, m2 * 1000, k * 1e6));
        return {
          prompt: `Two rail cars of ${m1} t and ${m2} t, free to roll on a level track, are joined by a coupling of stiffness ${k} MN/m.`,
          givens: [
            { sym: 'm_1', value: `${m1} t` },
            { sym: 'm_2', value: `${m2} t` },
            { sym: 'k', value: `${k} MN/m` },
          ],
          figure: RailCarsFigure,
          parts: [
            choice('zero', 'How many natural frequencies are zero, and why?', [
              { text: 'One: the cars can roll together without stretching the coupling ($\\det K = 0$).', correct: true, why: '$K = k[[1, -1],[-1, 1]]$ is singular; the rigid-body mode is $[1, 1]$.' },
              { text: 'None: every mode stretches the coupling.', correct: false, why: 'Equal displacements leave the coupling unstretched.' },
              { text: 'Two: nothing ties the cars to the ground.', correct: false, why: 'The coupling resists **relative** motion, which gives one non-zero frequency.' },
            ]),
            freqPart('f2', 'The non-zero natural frequency', w2, 'Hz', [
              { value: Math.sqrt((k * 1e6) / (m1 * 1000)), message: '$\\sqrt{k/m_1}$ holds car 2 fixed. Both cars move: $\\omega^2 = k(1/m_1 + 1/m_2)$.' },
              { value: Math.sqrt((k * 1e6) / (m2 * 1000)), message: '$\\sqrt{k/m_2}$ holds car 1 fixed. Use the reduced mass: $\\omega^2 = k(1/m_1 + 1/m_2)$.' },
            ]),
            num('ratio', 'Mode shape of that mode, $x_2/x_1$', -m1 / m2, '', [{ value: -m2 / m1, message: 'Momentum balance: $m_1x_1 + m_2x_2 = 0$, so $x_2/x_1 = -m_1/m_2$.' }]),
          ],
          hints: [
            'Nothing ties the cars to the ground, so one mode is a rigid-body roll at ω = 0. The other stretches the coupling with the centre of mass at rest.',
            '$T = \\tfrac12 m_1\\dot x_1^2 + \\tfrac12 m_2\\dot x_2^2$, $V = \\tfrac12 k(x_2 - x_1)^2$; $\\det(K - \\omega^2M) = \\omega^2[m_1m_2\\omega^2 - k(m_1 + m_2)] = 0$.',
            `$\\omega^2 = k(1/m_1 + 1/m_2) = ${k}\\times10^6(1/${m1 * 1000} + 1/${m2 * 1000})$.`,
            `$\\omega_1 = 0$ and $\\omega_2 = ${t4(w2)}$ rad/s = **${f4(w2 / TAU)} Hz**, with $x_2/x_1 = -m_1/m_2$ = **${f4(-m1 / m2)}** (reduced mass ${f4((m1 * m2) / (m1 + m2))} t).`,
          ],
        };
      }
      if (tier === 2) {
        const R1 = rng.step(0.03, 0.1, 0.01);
        const R2 = Number((R1 * rng.pick([1.5, 2, 2.5, 3, 4])).toPrecision(3));
        const IT = rng.step(0.01, 0.2, 0.01);
        const IP = rng.step(0.05, 2, 0.05);
        const k = rng.step(5, 50, 1) * 1000;
        const sys = beltSystem({ IT, IP, R1, R2, k });
        const w = Math.sqrt(beltOmega2(k, R1, R2, IT, IP));
        const flex = -(R2 / R1) * (IT / IP);
        return {
          prompt: `A motor and its pulley ($R_1$ = ${R1} m, total inertia $I_T$ = ${IT} kg m²) drive a pulley of radius $R_2$ = ${R2} m and inertia $I_P$ = ${IP} kg m² through a belt that does not slip; each side of the belt has stiffness $k$ = ${k / 1000} kN/m. $\\theta_1$ and $\\theta_2$ are measured in the same sense.`,
          givens: [
            { sym: 'R_1,\\ R_2', value: `${R1} m, ${R2} m` },
            { sym: 'I_T,\\ I_P', value: `${IT}, ${IP} kg m²` },
            { sym: 'k', value: `${k / 1000} kN/m`, label: 'each side' },
          ],
          figure: BeltFigure,
          parts: [
            toTermsPart(sys, 'TV', 'Sort each candidate term into T, V or not a term.', { mUnit: 'kg m²', kUnit: 'N m/rad', marks: 5 }),
            freqPart('f', 'The non-zero natural frequency', w, 'Hz', [
              { value: w / Math.SQRT2, message: 'Both belt sides store energy: the stiffness is $2k$, not $k$.' },
              { value: Math.sqrt(2 * k * (1 / IT + 1 / IP)), message: 'The belt stretches by $R_1\\theta_1 - R_2\\theta_2$: the radii enter the stiffness.' },
            ]),
            num('r0', 'Zero-frequency mode: $\\theta_2/\\theta_1$', R1 / R2, '', [
              { value: 1, message: 'The pulleys do not turn through equal angles: no belt stretch needs $R_1\\theta_1 = R_2\\theta_2$.' },
              { value: R2 / R1, message: 'Inverted: $R_1\\theta_1 = R_2\\theta_2$ gives $\\theta_2/\\theta_1 = R_1/R_2$.' },
            ]),
            num('r1', 'Flexible mode: $\\theta_2/\\theta_1$', flex, '', [
              { value: -flex, message: 'In the flexible mode the pulleys turn in opposite senses.', trapId: 'sign' },
              { value: -(R1 / R2) * (IP / IT), message: 'Use row 1 at $\\omega^2$: $\\theta_2/\\theta_1 = -(R_2/R_1)(I_T/I_P)$.' },
            ]),
          ],
          hints: [
            'Each belt side changes length by $R_1\\theta_1 - R_2\\theta_2$ (exact, no slip), and both sides store energy. Nothing ties the drive to the ground, so expect ω = 0.',
            '$T = \\tfrac12 I_T\\dot\\theta_1^2 + \\tfrac12 I_P\\dot\\theta_2^2$, $V = 2\\cdot\\tfrac12 k(R_1\\theta_1 - R_2\\theta_2)^2$ ⇒ $K = 2k\\begin{bmatrix} R_1^2 & -R_1R_2 \\\\ -R_1R_2 & R_2^2 \\end{bmatrix}$; $\\omega^2 = 2k(R_1^2/I_T + R_2^2/I_P)$.',
            `$K = ${mtx(sys.K)}$ N m/rad; $\\omega^2 = 2(${k})(${R1}^2/${IT} + ${R2}^2/${IP})$.`,
            `$\\omega^2 = ${t4(w * w)}$ s⁻², $\\omega = ${t4(w)}$ rad/s = **${f4(w / TAU)} Hz**. Zero mode $\\theta_2/\\theta_1 = R_1/R_2$ = **${f4(R1 / R2)}**; flexible mode $-(R_2/R_1)(I_T/I_P)$ = **${f4(flex)}**.`,
          ],
        };
      }
      // tier 3: motor–gearbox–load with a load torque
      const Im = rng.step(0.005, 0.05, 0.005);
      const IL = rng.step(0.5, 10, 0.5);
      const G = rng.step(2, 10, 1);
      const kT = rng.step(500, 5000, 100);
      const mk = gearMK(Im, IL, G, kT);
      const w = Math.sqrt((kT * (IL + Im * G * G)) / (IL * Im * G * G));
      return {
        prompt: `A motor (armature inertia $I_m$ = ${Im} kg m²) drives a gear reduction of ratio $G$ = ${G} (motor speed / load-shaft speed). The load shaft (torsional stiffness $k_T$ = ${kT} N m/rad) turns a machine of inertia $I_L$ = ${IL} kg m². Gear inertias are negligible. Coordinates: $\\theta_G$, the rotation of the gear at the motor end of the load shaft, and $\\theta_L$, the rotation of the load. A fluctuating load torque $T_L(t)$ acts on the machine.`,
        givens: [
          { sym: 'I_m', value: `${Im} kg m²` },
          { sym: 'G', value: `${G}` },
          { sym: 'k_T', value: `${kT} N m/rad` },
          { sym: 'I_L', value: `${IL} kg m²` },
        ],
        figure: GearFigure,
        parts: [
          {
            kind: 'matrix',
            id: 'M',
            label: 'Mass matrix for $q = [\\theta_G;\\ \\theta_L]$ (kg m²)',
            answer: mk.M,
            traps: safeMatTraps(mk.M, [
              { value: [[Im, 0], [0, IL]], message: 'The motor turns at $G\\dot\\theta_G$, so its kinetic energy is $\\tfrac12 I_m(G\\dot\\theta_G)^2$: $M_{11} = I_mG^2$.' },
              { value: [[Im / (G * G), 0], [0, IL]], message: 'Ratio inverted: the motor is the fast side, $G\\dot\\theta_G$.' },
            ]),
          } as MatrixPart,
          freqPart('w', 'The non-zero natural frequency', w, 'rad/s', [
            { value: Math.sqrt(kT * (1 / Im + 1 / IL)), message: 'Refer the motor inertia through the gear: $I_mG^2$.' },
            { value: Math.sqrt(kT / IL), message: '$\\sqrt{k_T/I_L}$ treats the motor end as fixed (the limit $I_mG^2 \\gg I_L$).' },
          ]),
          choice('Q', 'Generalised forces of the load torque $T_L$ (acting on the machine):', [
            { text: '$Q = [0;\\ T_L]$', correct: true, why: '$W = T_L\\,\\theta_L$: only $\\theta_L$ does work.' },
            { text: '$Q = [T_L;\\ 0]$', correct: false, why: 'The torque acts on the load, not at the gear.' },
            { text: '$Q = [GT_L;\\ T_L]$', correct: false, why: 'The load torque does no work through $\\theta_G$ directly.' },
          ]),
        ],
        hints: [
          'The gear is a constraint: the motor angle is $G\\theta_G$, so its inertia is referred as $I_mG^2$. The shaft twists by $\\theta_L - \\theta_G$. Nothing is grounded, so one ω = 0.',
          '$T = \\tfrac12 I_m(G\\dot\\theta_G)^2 + \\tfrac12 I_L\\dot\\theta_L^2$, $V = \\tfrac12 k_T(\\theta_L - \\theta_G)^2$ ⇒ $M = \\mathrm{diag}(I_mG^2, I_L)$, $K = k_T\\begin{bmatrix} 1 & -1 \\\\ -1 & 1\\end{bmatrix}$; $\\omega^2 = k_T(I_L + I_mG^2)/(I_LI_mG^2)$.',
          `$I_mG^2 = ${Im}\\times${G}^2 = ${t4(Im * G * G)}$ kg m²; $\\omega^2 = ${kT}(${IL} + ${t4(Im * G * G)})/(${IL}\\times${t4(Im * G * G)})$.`,
          `$M = ${mtx(mk.M)}$ kg m²; $\\omega = $ **${f4(w)} rad/s** (${f4(w / TAU)} Hz), mode $\\theta_G/\\theta_L = -I_L/(G^2I_m)$ = ${f4(-IL / (G * G * Im))}; $Q = [0;\\ T_L]$ by virtual work.`,
        ],
      };
    },
  },

  // ================================================================== the recipe: steps, which T/V, show-that matching
  {
    id: 'a2-recipe',
    title: 'Lagrange recipe: steps, which T and V, matching a given EoM',
    summary: 'Order the procedure; pick the correct T and V (Week 2 style); back-solve a printed EoM term by term.',
    tiers: [1, 2, 3],
    source: 'Reader LA1-9 procedure; Week 2 Q1–Q3; Week 1 Q5; LA2 §2.3–2.5; LA4 §4.1; 2022 A2.2 matching',
    cardId: 'a2-recipe',
    marks: 8,
    generate(rng, tier) {
      if (tier === 1) {
        const sysName = rng.pick(['the rod swinging on a cart (2022)', 'the nest swing (2021)', 'the box on rubber springs (2024)', 'the range hood on wall mounts (2025)', 'a belt drive (2019)']);
        return {
          prompt: `You are asked to “use Lagrange’s equations to derive the equations of motion” of ${sysName}.`,
          parts: [
            {
              kind: 'order',
              id: 'steps',
              label: 'Put the steps of the derivation in order.',
              steps: [
                'Choose the generalised coordinates (one per DoF) and their positive directions from the figure.',
                'Write each body’s absolute CoM velocity and angular velocity, and each spring’s deflection, in those coordinates.',
                'Write $T$ and $V$ (and $D$, $W$ if there are dampers or applied forces) and form $L = T - V$.',
                'Linearise: keep quadratic terms only, with $\\cos\\theta \\approx 1-\\theta^2/2$ in $V$.',
                'Apply $\\frac{d}{dt}\\frac{\\partial L}{\\partial\\dot q_i} - \\frac{\\partial L}{\\partial q_i} + \\frac{\\partial D}{\\partial\\dot q_i} - \\frac{\\partial W}{\\partial q_i} = 0$ for each coordinate (or read $M$, $K$ off the quadratic forms).',
                'Assemble $M\\ddot q + C\\dot q + Kq = Q$ and check symmetry, units and a limiting case.',
              ],
            },
            choice('lin', 'Which small-angle rule belongs in the **gravity** term of V?', [
              { text: '$\\cos\\theta \\approx 1 - \\theta^2/2$', correct: true, why: 'It keeps the quadratic term that becomes the gravity stiffness.' },
              { text: '$\\cos\\theta \\approx 1$', correct: false, why: 'The gravity term would vanish: no restoring stiffness (LA2 Example 2).' },
              { text: '$\\sin\\theta \\approx \\theta$', correct: false, why: 'Heights involve $1 - \\cos\\theta$; $\\sin\\theta$ belongs to horizontal positions.' },
              { text: 'Drop gravity: it never affects the frequencies.', correct: false, why: 'For rotations that lift a CoM, gravity **is** the stiffness ($Mgd$).' },
            ]),
          ],
          hints: [
            'The reader’s procedure (LA1-9): coordinates → total T and V (and D, W) → L → Euler–Lagrange for each coordinate → the EoM. For vibration, linearise and check.',
            'Velocities and deflections come before energies; linearisation comes before differentiating (or reading off M and K); checks come last.',
            'Order: coordinates → velocities and deflections → T, V, D, W and L → linearise → Lagrange per coordinate → assemble and check.',
            'Steps 1 to 6 as listed in the worked order. In V use $\\cos\\theta \\approx 1-\\theta^2/2$: gravity is a stiffness for rotations.',
          ],
        };
      }
      if (tier === 2) {
        const which = rng.pick(['slider', 'aerofoil', 'double', 'rolling', 'relative', 'coupled'] as const);
        if (which === 'slider') {
          const n = rng.pick([2, 3, 4]);
          const m = rng.step(0.5, 3, 0.25);
          const l = rng.step(0.3, 1.2, 0.05);
          const k = rng.step(50, 500, 10);
          const wx = Math.sqrt(k / ((n + 1) * m));
          const tot = n + 1;
          const half = (c: number) => (c === 2 ? '' : c % 2 === 0 ? `${c / 2}` : `\\tfrac{${c}}{2}`);
          return {
            prompt: `A carriage of mass ${n}m slides vertically between frictionless guides on a spring $k$; $x$ is its downward displacement from static equilibrium. A bob of mass $m$ hangs from it on a massless rod of length $\\ell$, at angle $\\theta$ from the vertical. Here $m$ = ${m} kg, $\\ell$ = ${l} m, $k$ = ${k} N/m.`,
            givens: [{ sym: 'm', value: `${m} kg` }, { sym: '\\ell', value: `${l} m` }, { sym: 'k', value: `${k} N/m` }],
            parts: [
              choice('T', 'Linearised kinetic energy?', [
                { text: `$${half(tot)}m\\dot x^2 + \\tfrac12 m\\ell^2\\dot\\theta^2$`, correct: true, why: 'Carriage and bob both move with $\\dot x$; the cross term $-m\\ell\\dot x\\dot\\theta\\sin\\theta$ is cubic and drops.' },
                { text: `$${half(n)}m\\dot x^2 + \\tfrac12 m\\ell^2\\dot\\theta^2$`, correct: false, why: 'The bob also moves with $\\dot x$: add $\\tfrac12 m\\dot x^2$.' },
                { text: `$${half(tot)}m\\dot x^2 + \\tfrac12 m\\ell^2\\dot\\theta^2 + m\\ell\\dot x\\dot\\theta$`, correct: false, why: 'The exact cross term carries $\\sin\\theta$: it is cubic and vanishes.' },
                { text: `$${half(tot)}m\\dot x^2 + \\tfrac12 (${n + 1}m)\\ell^2\\dot\\theta^2$`, correct: false, why: 'Only the bob swings on the rod.' },
              ]),
              choice('V', 'Linearised potential energy (constants dropped)?', [
                { text: '$\\tfrac12 kx^2 + \\tfrac12 mg\\ell\\theta^2$', correct: true, why: 'The preload cancels the weight along the spring; the bob rises $\\ell(1-\\cos\\theta) \\approx \\ell\\theta^2/2$.' },
                { text: `$\\tfrac12 kx^2 - ${tot}mgx + \\tfrac12 mg\\ell\\theta^2$`, correct: false, why: 'A linear term means x = 0 is not an equilibrium: the preload $k\\delta_{st} = ' + tot + 'mg$ cancels it.' },
                { text: '$\\tfrac12 kx^2$', correct: false, why: 'Uses $\\cos\\theta \\approx 1$ and loses the pendulum stiffness.' },
                { text: '$\\tfrac12 kx^2 + mg\\ell\\theta^2$', correct: false, why: 'Factor 2: $mg\\ell(1-\\cos\\theta) \\approx \\tfrac12 mg\\ell\\theta^2$.' },
              ]),
              freqPart('wx', 'Natural frequency of the carriage (x) motion', wx, 'rad/s', [{ value: Math.sqrt(k / (n * m)), message: 'The bob moves with the carriage: the mass is $(' + n + ' + 1)m$.' }]),
            ],
            hints: [
              'Write the bob’s position $(x + \\ell\\cos\\theta,\\ \\ell\\sin\\theta)$, differentiate, square, and keep only quadratic terms. Measure x from static equilibrium.',
              '$v_B^2 = \\dot x^2 - 2\\ell\\dot x\\dot\\theta\\sin\\theta + \\ell^2\\dot\\theta^2$; $V = \\tfrac12 k(\\delta_{st} + x)^2 - (' + tot + 'm)gx - mg\\ell\\cos\\theta$.',
              `The EoM decouple: $${tot}m\\ddot x + kx = 0$ and $m\\ell^2\\ddot\\theta + mg\\ell\\theta = 0$, so $\\omega_x = \\sqrt{k/(${tot}m)} = \\sqrt{${k}/(${tot}\\times${m})}$.`,
              `$T = ${half(tot)}m\\dot x^2 + \\tfrac12 m\\ell^2\\dot\\theta^2$, $V = \\tfrac12 kx^2 + \\tfrac12 mg\\ell\\theta^2$; $\\omega_x = $ **${f4(wx)} rad/s** (and $\\omega_\\theta = \\sqrt{g/\\ell}$ = ${f4(Math.sqrt(g / l))} rad/s).`,
            ],
          };
        }
        if (which === 'aerofoil') {
          const m = rng.step(1, 5, 0.5);
          const e = rng.step(0.03, 0.15, 0.01);
          const J = rng.step(0.01, 0.1, 0.005);
          const J0 = J + m * e * e;
          return {
            prompt: `A wing section (mass $m$ = ${m} kg, $J_{CG}$ = ${J} kg m²) is supported at its elastic axis o by a vertical spring $k$ and a torsional spring $k_t$. Its CG lies $e$ = ${e} m **ahead** of o. Coordinates at o: $x$ (down) and $\\theta$ (nose up), from static equilibrium.`,
            givens: [{ sym: 'm', value: `${m} kg` }, { sym: 'J_{CG}', value: `${J} kg m²` }, { sym: 'e', value: `${e} m` }],
            parts: [
              choice('T', 'Kinetic energy?', [
                { text: '$\\tfrac12 m(\\dot x - e\\dot\\theta)^2 + \\tfrac12 J_{CG}\\dot\\theta^2$', correct: true, why: 'Nose-up θ lifts the CG ahead of o: CG moves $x - e\\theta$ (down).' },
                { text: '$\\tfrac12 m\\dot x^2 + \\tfrac12 J_{CG}\\dot\\theta^2$', correct: false, why: 'x is measured at o, not at the CG; the CG velocity also depends on $\\dot\\theta$.' },
                { text: '$\\tfrac12 m(\\dot x + e\\dot\\theta)^2 + \\tfrac12 J_{CG}\\dot\\theta^2$', correct: false, why: 'Sign: nose-up rotation raises the CG.' },
                { text: '$\\tfrac12 m(\\dot x - e\\dot\\theta)^2 + \\tfrac12 (J_{CG} + me^2)\\dot\\theta^2$', correct: false, why: 'Double counting: the $me^2$ already comes from expanding $\\tfrac12 m(\\dot x - e\\dot\\theta)^2$.' },
              ]),
              choice('V', 'Potential energy?', [
                { text: '$\\tfrac12 kx^2 + \\tfrac12 k_t\\theta^2$', correct: true, why: 'Both springs act at o, which moves x and turns θ.' },
                { text: '$\\tfrac12 k(x - e\\theta)^2 + \\tfrac12 k_t\\theta^2$', correct: false, why: 'The spring is attached at o, not at the CG.' },
                { text: '$\\tfrac12 kx^2 + \\tfrac12 k_t\\theta^2 - mgx$', correct: false, why: 'From static equilibrium the preload cancels the weight.' },
                { text: '$\\tfrac12 kx^2 + \\tfrac12 k_t(e\\theta)^2$', correct: false, why: 'A torsional spring stores $\\tfrac12 k_t\\theta^2$; it has no lever arm.' },
              ]),
              num('J0', 'Mass-matrix entry $M_{22}$', J0, 'kg m²', [
                { value: J, message: 'Expanding $\\tfrac12 m(\\dot x - e\\dot\\theta)^2$ adds $me^2$: $M_{22} = J_{CG} + me^2$.', trapId: 'parallel-axis' },
                { value: J + 2 * m * e * e, message: 'Count $me^2$ once.', trapId: 'parallel-axis' },
              ]),
            ],
            hints: [
              'Coordinates at o (not at the CG) put the coupling into M. Write the CG velocity from x and θ.',
              'CG displacement (down) $= x - e\\theta$, so $T = \\tfrac12 m(\\dot x - e\\dot\\theta)^2 + \\tfrac12 J_{CG}\\dot\\theta^2$ and $M = \\begin{bmatrix} m & -me \\\\ -me & J_{CG} + me^2 \\end{bmatrix}$.',
              `$M_{22} = ${J} + ${m}(${e})^2$; $M_{12} = -me = -${m}\\times${e}$.`,
              `$M_{22} = J_o = $ **${f4(J0)} kg m²** and $M_{12} = ${t4(-m * e)}$ kg m; $K = \\mathrm{diag}(k, k_t)$.`,
            ],
          };
        }
        if (which === 'double') {
          const l = rng.step(0.2, 2, 0.1);
          const w1 = 0.765367 * Math.sqrt(g / l);
          return {
            prompt: `A double pendulum: two equal bobs $m$ on two massless strings of equal length $\\ell$ = ${l} m. $\\theta_1$ and $\\theta_2$ are the upper and lower strings’ angles **from the vertical**.`,
            givens: [{ sym: '\\ell', value: `${l} m` }],
            parts: [
              choice('T', 'Linearised kinetic energy?', [
                { text: '$\\tfrac12 m\\ell^2\\dot\\theta_1^2 + \\tfrac12 m\\ell^2(\\dot\\theta_1 + \\dot\\theta_2)^2$', correct: true, why: 'The lower bob moves with the upper bob plus its own swing: $\\ell\\dot\\theta_1 + \\ell\\dot\\theta_2$ (LA4 §4.1).' },
                { text: '$\\tfrac12 m\\ell^2(\\dot\\theta_1^2 + \\dot\\theta_2^2)$', correct: false, why: 'The lower bob’s velocity is absolute: it carries the upper bob’s motion too.' },
                { text: '$\\tfrac12 m\\ell^2\\dot\\theta_1^2 + \\tfrac12 m\\ell^2(\\dot\\theta_2 - \\dot\\theta_1)^2$', correct: false, why: 'With both angles from the vertical the lower bob moves at $\\ell\\dot\\theta_1 + \\ell\\dot\\theta_2$; a difference describes the lower string relative to the upper one, not the bob’s absolute velocity.' },
                { text: '$m\\ell^2\\dot\\theta_1^2 + \\tfrac12 m\\ell^2\\dot\\theta_2^2$', correct: false, why: 'Misses the cross term $m\\ell^2\\dot\\theta_1\\dot\\theta_2$.' },
              ]),
              choice('V', 'Linearised potential energy?', [
                { text: '$\\tfrac12 mg\\ell(2\\theta_1^2 + \\theta_2^2)$', correct: true, why: 'Upper bob rises $\\ell(1-\\cos\\theta_1)$; the lower bob rises $\\ell(1-\\cos\\theta_1) + \\ell(1-\\cos\\theta_2)$.' },
                { text: '$\\tfrac12 mg\\ell(\\theta_1^2 + \\theta_2^2)$', correct: false, why: 'The lower bob is also lifted by the upper string’s swing.' },
                { text: '$mg\\ell(2\\theta_1^2 + \\theta_2^2)$', correct: false, why: 'Factor 2: $1-\\cos\\theta \\approx \\theta^2/2$.' },
                { text: '0, using $\\cos\\theta \\approx 1$', correct: false, why: 'Gravity is the only stiffness here; keep $1-\\theta^2/2$.' },
              ]),
              freqPart('w1', 'Lower natural frequency', w1, 'rad/s', [
                { value: Math.sqrt(g / l), message: '$\\sqrt{g/\\ell}$ is a single pendulum. Coupled: $\\omega_1^2 = (2 - \\sqrt2)g/\\ell$.' },
                { value: 1.847759 * Math.sqrt(g / l), message: 'That is the higher frequency, $(2 + \\sqrt2)g/\\ell$.' },
              ]),
            ],
            hints: [
              'Absolute angles from the vertical: the lower bob’s velocity is the sum of both strings’ contributions; each bob’s height uses $1 - \\cos\\theta$.',
              '$M = m\\ell^2\\begin{bmatrix} 2 & 1 \\\\ 1 & 1\\end{bmatrix}$, $K = mg\\ell\\,\\mathrm{diag}(2, 1)$ ⇒ $\\omega^4 - 4(g/\\ell)\\omega^2 + 2(g/\\ell)^2 = 0$.',
              `$\\omega^2 = (2 \\mp \\sqrt2)g/\\ell$ with $g/\\ell = ${t4(g / l)}$ s⁻².`,
              `$\\omega_1 = 0.7654\\sqrt{g/\\ell} = $ **${f4(w1)} rad/s** ($\\omega_2 = 1.848\\sqrt{g/\\ell}$ = ${f4(1.847759 * Math.sqrt(g / l))} rad/s), with $\\theta_2/\\theta_1 = \\pm\\sqrt2$.`,
            ],
          };
        }
        if (which === 'rolling') {
          const body = rng.pick([
            { name: 'solid cylinder', beta: 0.5, J: '\\tfrac12 mr^2' },
            { name: 'thin hoop', beta: 1, J: 'mr^2' },
            { name: 'solid sphere', beta: 0.4, J: '\\tfrac25 mr^2' },
            { name: 'thin spherical shell', beta: 2 / 3, J: '\\tfrac23 mr^2' },
          ]);
          const m = rng.step(1, 20, 1);
          const k = rng.step(100, 2000, 50);
          const wn = Math.sqrt(k / (m * (1 + body.beta)));
          return {
            prompt: `A ${body.name} (mass $m$ = ${m} kg, $J = ${body.J}$ about its axle) rolls without slipping on level ground, restrained by a spring $k$ = ${k} N/m attached at its axle. $x$ is the axle displacement.`,
            givens: [{ sym: 'm', value: `${m} kg` }, { sym: 'k', value: `${k} N/m` }],
            parts: [
              choice('T', 'Kinetic energy?', [
                { text: '$\\tfrac12 m\\dot x^2 + \\tfrac12 J(\\dot x/r)^2$', correct: true, why: 'Translation of the centre plus rotation, with the rolling constraint $\\theta = x/r$.' },
                { text: '$\\tfrac12 m\\dot x^2$', correct: false, why: 'The body also spins: add $\\tfrac12 J\\dot\\theta^2$.' },
                { text: '$\\tfrac12 m\\dot x^2 + \\tfrac12(J + mr^2)(\\dot x/r)^2$', correct: false, why: 'Double counting: $J + mr^2$ is the inertia about the contact point, which already includes the translation.', },
                { text: '$\\tfrac12 J(\\dot x/r)^2$', correct: false, why: 'Forgets the translation of the centre.' },
              ]),
              choice('V', 'Potential energy?', [
                { text: '$\\tfrac12 kx^2$', correct: true, why: 'The spring at the axle stretches by x; on level ground gravity does not change.' },
                { text: '$\\tfrac12 k(2x)^2$', correct: false, why: 'That would be a spring at the top of the rim (it moves 2x); this one is at the axle.' },
                { text: '$\\tfrac12 kx^2 + mgx$', correct: false, why: 'Rolling on level ground does not raise the CoM.' },
                { text: '$\\tfrac12 k(x/r)^2$', correct: false, why: 'Units: the spring stretches by a length, x.' },
              ]),
              freqPart('wn', 'Natural frequency', wn, 'rad/s', [
                { value: Math.sqrt(k / m), message: 'Include the rotational inertia: $m_{eff} = m + J/r^2$.' },
                { value: Math.sqrt(k / (m * (2 + body.beta))), message: 'Double counted: $m_{eff} = m + J/r^2$, not $m + (J + mr^2)/r^2$.' },
              ]),
            ],
            hints: [
              'Rolling without slip is a constraint, $\\theta = x/r$: one coordinate. The contact force does no work.',
              `$T = \\tfrac12(m + J/r^2)\\dot x^2 = \\tfrac12(1 + ${fmt(body.beta, 3)})m\\dot x^2$, $V = \\tfrac12 kx^2$ ⇒ $\\omega_n = \\sqrt{k/m_{eff}}$.`,
              `$m_{eff} = ${t4(1 + body.beta)}\\times${m} = ${t4(m * (1 + body.beta))}$ kg; $\\omega_n = \\sqrt{${k}/${t4(m * (1 + body.beta))}}$.`,
              `$\\omega_n = $ **${f4(wn)} rad/s** $= ${t4(1 / Math.sqrt(1 + body.beta))}\\sqrt{k/m}$.`,
            ],
          };
        }
        if (which === 'relative') {
          const m1 = rng.step(1, 10, 0.5);
          const m2 = rng.step(1, 10, 0.5);
          return {
            prompt: `A two-mass chain: ground → $k_1$ → $m_1$ → $k_2$ → $m_2$, with $m_1$ = ${m1} kg and $m_2$ = ${m2} kg. Use $x_1$ (absolute displacement of $m_1$) and $x_r = x_2 - x_1$ (displacement of $m_2$ **relative to** $m_1$).`,
            givens: [{ sym: 'm_1', value: `${m1} kg` }, { sym: 'm_2', value: `${m2} kg` }],
            parts: [
              choice('T', 'Kinetic energy?', [
                { text: '$\\tfrac12 m_1\\dot x_1^2 + \\tfrac12 m_2(\\dot x_1 + \\dot x_r)^2$', correct: true, why: 'Always use the total (absolute) velocity in T (LA2 §2.3.2).' },
                { text: '$\\tfrac12 m_1\\dot x_1^2 + \\tfrac12 m_2\\dot x_r^2$', correct: false, why: '$\\dot x_r$ is a relative velocity.' },
                { text: '$\\tfrac12(m_1 + m_2)\\dot x_1^2 + \\tfrac12 m_2\\dot x_r^2$', correct: false, why: 'Misses the cross term $m_2\\dot x_1\\dot x_r$.' },
                { text: '$\\tfrac12 m_1\\dot x_1^2 + \\tfrac12 m_2(\\dot x_r - \\dot x_1)^2$', correct: false, why: 'Sign: $x_2 = x_1 + x_r$.' },
              ]),
              choice('V', 'Potential energy?', [
                { text: '$\\tfrac12 k_1x_1^2 + \\tfrac12 k_2x_r^2$', correct: true, why: '$k_2$ stretches by exactly the relative displacement: V is diagonal in these coordinates.' },
                { text: '$\\tfrac12 k_1x_1^2 + \\tfrac12 k_2(x_r - x_1)^2$', correct: false, why: '$x_r$ is already the stretch of $k_2$.' },
                { text: '$\\tfrac12 k_1x_1^2 + \\tfrac12 k_2(x_1 + x_r)^2$', correct: false, why: 'That is $\\tfrac12 k_2x_2^2$, as if $k_2$ went to the ground.' },
                { text: '$\\tfrac12(k_1 + k_2)x_1^2 + \\tfrac12 k_2x_r^2$', correct: false, why: 'Moving $m_1$ alone with $x_r$ fixed does not stretch $k_2$.' },
              ]),
              num('M11', 'Mass-matrix entry $M_{11}$', m1 + m2, 'kg', [{ value: m1, message: '$\\tfrac12 m_2(\\dot x_1 + \\dot x_r)^2$ also contributes $m_2$ to $M_{11}$.' }]),
            ],
            hints: [
              'Relative coordinates move the coupling into M: T needs absolute velocities, while each spring sees exactly one coordinate.',
              '$T = \\tfrac12 m_1\\dot x_1^2 + \\tfrac12 m_2(\\dot x_1 + \\dot x_r)^2$ ⇒ $M = \\begin{bmatrix} m_1 + m_2 & m_2 \\\\ m_2 & m_2\\end{bmatrix}$, $K = \\mathrm{diag}(k_1, k_2)$.',
              `$M_{11} = ${m1} + ${m2}$ kg, $M_{12} = M_{22} = ${m2}$ kg.`,
              `$M_{11} = $ **${f4(m1 + m2)} kg**; $M = \\begin{bmatrix} ${t4(m1 + m2)} & ${m2} \\\\ ${m2} & ${m2}\\end{bmatrix}$ kg (LA2 Eq 2.2).`,
            ],
          };
        }
        // coupled pendulums
        const m = rng.step(0.5, 5, 0.5);
        const l = rng.step(0.4, 2, 0.1);
        const d = Number((l * rng.step(0.2, 0.9, 0.1)).toPrecision(3));
        const k = rng.step(10, 300, 10);
        const w2 = Math.sqrt(g / l + (2 * k * d * d) / (m * l * l));
        return {
          prompt: `Two identical pendulums (bobs $m$ = ${m} kg on massless rods $\\ell$ = ${l} m) hang side by side; a spring $k$ = ${k} N/m joins the rods a distance $d$ = ${d} m below the pivots. $\\theta_1$, $\\theta_2$ from the vertical, in the same sense.`,
          givens: [{ sym: 'm', value: `${m} kg` }, { sym: '\\ell', value: `${l} m` }, { sym: 'd', value: `${d} m` }, { sym: 'k', value: `${k} N/m` }],
          parts: [
            choice('T', 'Kinetic energy?', [
              { text: '$\\tfrac12 m\\ell^2(\\dot\\theta_1^2 + \\dot\\theta_2^2)$', correct: true, why: 'Each bob moves at $\\ell\\dot\\theta_i$; no inertial coupling.' },
              { text: '$\\tfrac12 m(\\dot\\theta_1^2 + \\dot\\theta_2^2)$', correct: false, why: 'Units: the bobs move at $\\ell\\dot\\theta$.' },
              { text: '$\\tfrac12 md^2(\\dot\\theta_1^2 + \\dot\\theta_2^2)$', correct: false, why: 'The bobs are at $\\ell$; d is only where the spring attaches.' },
              { text: '$\\tfrac12 m\\ell^2(\\dot\\theta_1 + \\dot\\theta_2)^2$', correct: false, why: 'The pendulums are separate bodies; there is no cross term in T.' },
            ]),
            choice('V', 'Potential energy?', [
              { text: '$\\tfrac12 kd^2(\\theta_2 - \\theta_1)^2 + \\tfrac12 mg\\ell(\\theta_1^2 + \\theta_2^2)$', correct: true, why: 'Spring stretch $d(\\theta_2 - \\theta_1)$ (lever arm d) plus each bob’s gravity term.' },
              { text: '$\\tfrac12 k(\\theta_2 - \\theta_1)^2 + \\tfrac12 mg\\ell(\\theta_1^2 + \\theta_2^2)$', correct: false, why: 'Lever arm missing: the spring stretches by a length, $d(\\theta_2 - \\theta_1)$.' },
              { text: '$\\tfrac12 k\\ell^2(\\theta_2 - \\theta_1)^2 + \\tfrac12 mg\\ell(\\theta_1^2 + \\theta_2^2)$', correct: false, why: 'The spring is attached at d, not at the bobs.' },
              { text: '$\\tfrac12 kd^2(\\theta_2 - \\theta_1)^2$', correct: false, why: 'Gravity stiffness lost ($\\cos\\theta \\approx 1$).' },
            ]),
            freqPart('w2', 'Higher natural frequency (anti-phase mode)', w2, 'rad/s', [
              { value: Math.sqrt(g / l), message: 'That is the in-phase mode: the spring is not stretched.' },
              { value: Math.sqrt(g / l + (k * d * d) / (m * l * l)), message: 'In the anti-phase mode the spring stretches $2d\\theta$: $\\omega_2^2 = g/\\ell + 2kd^2/(m\\ell^2)$.' },
            ]),
          ],
          hints: [
            'The spring’s stretch is translation of its ends: $d\\theta_2 - d\\theta_1$. Gravity gives each pendulum $mg\\ell$.',
            '$M = m\\ell^2 I$, $K = \\begin{bmatrix} kd^2 + mg\\ell & -kd^2 \\\\ -kd^2 & kd^2 + mg\\ell\\end{bmatrix}$ (LA2 Eq 2.3). Modes: in phase $\\omega_1^2 = g/\\ell$; anti-phase $\\omega_2^2 = g/\\ell + 2kd^2/(m\\ell^2)$.',
            `$g/\\ell = ${t4(g / l)}$ s⁻², $2kd^2/(m\\ell^2) = ${t4((2 * k * d * d) / (m * l * l))}$ s⁻².`,
            `$\\omega_2 = \\sqrt{${t4(w2 * w2)}} = $ **${f4(w2)} rad/s** ($\\omega_1 = \\sqrt{g/\\ell}$ = ${f4(Math.sqrt(g / l))} rad/s).`,
          ],
        };
      }
      // tier 3: back-solve a printed EoM (2022 A2.2 style)
      const L = rng.step(0.4, 1.4, 0.1);
      const Mr = rng.step(1, 6, 0.5);
      const m = rng.step(2, 10, 0.5);
      const k = rng.step(10, 200, 10);
      const A = Number((m + Mr).toPrecision(4));
      const B = Number((Mr * L).toPrecision(4));
      const C = Number(((4 * Mr * L * L) / 3).toPrecision(4));
      const E = Number((Mr * g * L).toPrecision(4));
      const Ls = (3 * C) / (4 * B);
      const Ms = B / Ls;
      const gs = E / B;
      return {
        prompt: `For the rod-on-a-cart system (cart $m$ on spring $k$; uniform rod of mass $M$ and length $2L$ pinned to the cart; coordinates $x$, $\\theta$), a model gives\n\n$$\\begin{bmatrix} ${A} & ${B} \\\\ ${B} & ${C} \\end{bmatrix}\\begin{bmatrix} \\ddot x \\\\ \\ddot\\theta \\end{bmatrix} + \\begin{bmatrix} ${k} & 0 \\\\ 0 & ${E} \\end{bmatrix}\\begin{bmatrix} x \\\\ \\theta \\end{bmatrix} = 0$$\n\nMatch it term by term with your symbolic $M = \\begin{bmatrix} m+M & ML \\\\ ML & \\tfrac43ML^2\\end{bmatrix}$, $K = \\mathrm{diag}(k, MgL)$ to recover the parameters.`,
        figure: CartRodFigure,
        parts: [
          num('L', 'Half-length $L$ of the rod', Ls, 'm', [
            { value: C / B, message: 'You used $M_{22} = ML^2$. With $M_{22} = \\tfrac43 ML^2$: $L = \\tfrac34 M_{22}/M_{12}$.', trapId: 'parallel-axis' },
            { value: (3 * C) / B, message: 'You used $M_{22} = \\tfrac13 ML^2$ ($I_G$ only); G’s motion adds $ML^2$.', trapId: 'parallel-axis' },
          ]),
          num('M', 'Rod mass $M$', Ms, 'kg', [{ value: B, message: '$M_{12} = ML$: divide by L.' }]),
          num('m', 'Cart mass $m$', A - Ms, 'kg', [{ value: A, message: '$M_{11} = m + M$ includes the rod, which moves with the cart.' }]),
          num('g', 'Value of $g$ this model implies', gs, 'm/s²', [{ value: E / Ms, message: '$K_{22} = MgL$: divide by $ML$ (= $M_{12}$), not by M alone.' }]),
        ],
        hints: [
          'A “show that” EoM can be checked by matching each entry with the symbolic matrices; the ratios of entries give the geometry first.',
          '$M_{22}/M_{12} = \\tfrac43 L$ ⇒ $L = \\tfrac34 M_{22}/M_{12}$; then $M = M_{12}/L$, $m = M_{11} - M$, $g = K_{22}/M_{12}$.',
          `$L = \\tfrac34(${C}/${B})$; $M = ${B}/L$; $m = ${A} - M$; $g = ${E}/${B}$.`,
          `$L = $ **${f4(Ls)} m** (rod ${f4(2 * Ls)} m long), $M = $ **${f4(Ms)} kg**, $m = $ **${f4(A - Ms)} kg**, $k$ = ${k} N/m and $g = $ **${f4(gs)} m/s²** (the 2022 paper’s numbers imply g = 10 m/s²).`,
        ],
      };
    },
  },
];
