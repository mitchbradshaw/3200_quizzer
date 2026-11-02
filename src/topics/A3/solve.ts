// A3 problem generators. Numbers are randomised within the ranges the papers use; answers are computed from the
// numbers exactly as displayed (rounded P, tables), so a student working from the prompt lands on the same value.
// Hints walk concept -> set-up -> substitution -> worked solution with this instance's numbers.
import type { NumericPart, SolveGenerator, SolvePart } from '../../engine/types';
import { fmt, tex } from '../../engine/format';
import type { Rng } from '../../engine/rng';
import { genSymEig } from '../../physics/linalg';
import { chainKM, chainN, det2, inv2, modeTable, mul, mulT, quad, quadCoeffs, twoDof } from './physics';
import { chainFigure, modeTableFigure } from './figures';

const TAU = 2 * Math.PI;
const G = 9.81;
const f3 = (x: number) => fmt(x, 3);
const f4 = (x: number) => fmt(x, 4);
const t4 = (x: number) => tex(x, 4);
const sig = (x: number, n: number) => Number(x.toPrecision(n));
const dp = (x: number, n: number) => Number(x.toFixed(n));

type Trap = { value: number; message: string; trapId?: string };
/** Keep only traps clearly away from the answer (> 3 %), so a trap can never mask a correct answer. */
function keep(answer: number, list: Trap[]): Trap[] {
  return list.filter((t) => Number.isFinite(t.value) && Math.abs(t.value - answer) > 0.03 * Math.abs(answer));
}

/** TeX bmatrix with `n` significant figures. */
function bm(A: number[][], n = 4): string {
  return `\\begin{bmatrix} ${A.map((r) => r.map((x) => (Math.abs(x) < 1e-12 ? '0' : tex(x, n))).join(' & ')).join(' \\\\ ')} \\end{bmatrix}`;
}

/** Roots of a λ² − b λ + c = 0, ascending. */
function roots(a: number, b: number, c: number): [number, number] {
  const d = Math.sqrt(Math.max(0, b * b - 4 * a * c));
  return [(b - d) / (2 * a), (b + d) / (2 * a)];
}

/** Cart (on spring k) carrying a uniform rod of mass mr, length 2L pinned at its top: M = [mc+mr, mrL; mrL, 4mrL²/3], K = diag(k, mr g L) (2022 A2). */
function cartRod(rng: Rng) {
  const mc = rng.step(2, 10, 0.5);
  const mr = rng.step(1, 5, 0.5);
  const L = rng.step(0.25, 1, 0.05);
  const k = rng.step(5, 100, 5);
  const M = [
    [sig(mc + mr, 4), sig(mr * L, 4)],
    [sig(mr * L, 4), sig((4 * mr * L * L) / 3, 4)],
  ];
  const K = [
    [k, 0],
    [0, sig(mr * G * L, 4)],
  ];
  return { mc, mr, L, k, M, K };
}

/** A restrained 2-DoF chain with friendly numbers (free top). */
function niceChain(rng: Rng) {
  const m2 = rng.pick([1, 2, 4, 5]);
  const m1 = m2 * rng.pick([1, 1.5, 2, 3]);
  const k2 = rng.pick([100, 200, 400, 500, 800, 1000]);
  const k1 = k2 * rng.pick([0.5, 1, 2]);
  return { m1, m2, k1, k2, ...chainKM(m1, m2, k1, k2, 0) };
}

export const generators: SolveGenerator[] = [
  // ------------------------------------------------------------------ frequencies and mode shapes
  {
    id: 'a3-freq-modes',
    title: 'Natural frequencies and mode shapes from M and K',
    summary: 'Expand $\\det(K-\\omega^2M) = 0$, solve the quadratic in $\\omega^2$, then read each mode ratio from one row.',
    tiers: [1, 2, 3],
    source: 'Similar to Week 3 Q1–Q3, 2025 A1.4, 2022 A2.2–A2.3',
    cardId: 'a3-frequencies',
    generate(rng, tier) {
      if (tier === 3) {
        const { mc, mr, L, k, M, K } = cartRod(rng);
        const { a, b, c } = quadCoeffs(K, M);
        const [l1, l2] = roots(a, b, c);
        const w1 = Math.sqrt(l1);
        const w2 = Math.sqrt(l2);
        const ratio = (l: number) => (K[0][0] - l * M[0][0]) / (l * M[0][1]); // Θ/X from row 1: (k11 − λm11)X − λm12Θ = 0
        const r1 = ratio(l1);
        const r2 = ratio(l2);
        const node = -1 / r2;
        const unc = [K[0][0] / M[0][0], K[1][1] / M[1][1]].sort((p, q) => p - q).map(Math.sqrt);
        return {
          prompt: `A cart (${mc} kg) on a spring $k$ = ${k} N/m carries a uniform rod (${mr} kg, length ${f3(2 * L)} m) pinned at its top end to the cart. For small motions, with $x$ (m) and the rod angle $\\theta$ (rad), the equations of motion are $M\\ddot X + KX = 0$ with
$$M = ${bm(M)}, \\qquad K = ${bm(K)}$$
(SI units). Mode 1 is the lower frequency; give the mode ratios as $r = \\Theta/X$.`,
          givens: [
            { sym: 'M', value: `[${M[0][0]}, ${M[0][1]}; ${M[1][0]}, ${M[1][1]}]`, label: 'mass matrix (kg, kg m, kg m²)' },
            { sym: 'K', value: `diag(${K[0][0]}, ${K[1][1]})`, label: 'stiffness (N/m, N m/rad)' },
          ],
          parts: [
            {
              kind: 'numeric',
              id: 'w1',
              label: 'Lower natural frequency $\\omega_1$',
              answer: w1,
              unit: 'rad/s',
              freq: true,
              traps: keep(w1, [{ value: unc[0], message: 'You dropped the $-\\omega^2m_{12}$ coupling terms: that is the uncoupled frequency. With mass coupling the off-diagonal of $K-\\omega^2M$ is $-\\omega^2m_{12}$.', trapId: 'a3-inertial-coupling' }]),
            },
            {
              kind: 'numeric',
              id: 'w2',
              label: 'Higher natural frequency $\\omega_2$',
              answer: w2,
              unit: 'rad/s',
              freq: true,
              traps: keep(w2, [{ value: unc[1], message: 'That is an uncoupled frequency: keep $-\\omega^2m_{12}$ in the off-diagonal.', trapId: 'a3-inertial-coupling' }]),
            },
            {
              kind: 'numeric',
              id: 'r1',
              label: 'Mode 1 ratio $r_1 = \\Theta/X$',
              answer: r1,
              unit: 'rad/m',
              traps: keep(r1, [
                { value: 1 / r1, message: 'That is $X/\\Theta$, the inverse ratio.', trapId: 'a3-ratio-inverted' },
                { value: r2, message: 'That is mode 2’s ratio: use $\\omega_1^2$ for mode 1.', trapId: 'a3-wrong-mode' },
              ]),
            },
            {
              kind: 'numeric',
              id: 'r2',
              label: 'Mode 2 ratio $r_2 = \\Theta/X$',
              answer: r2,
              unit: 'rad/m',
              traps: keep(r2, [
                { value: 1 / r2, message: 'That is $X/\\Theta$, the inverse ratio.', trapId: 'a3-ratio-inverted' },
                { value: r1, message: 'That is mode 1’s ratio.', trapId: 'a3-wrong-mode' },
              ]),
            },
            {
              kind: 'numeric',
              id: 'node',
              label: 'Mode 2: distance below the pivot of the point on the rod’s line that stays still',
              answer: node,
              unit: 'm',
              traps: keep(node, [{ value: -r2, message: 'The node is where $x + s\\theta = 0$, i.e. $s = -X/\\Theta = -1/r_2$, not $-r_2$.', trapId: 'a3-ratio-inverted' }]),
            },
          ],
          hints: [
            'Mass coupling: the off-diagonals of $K-\\omega^2M$ are $-\\omega^2m_{12}$. The frequencies are the roots of $\\det(K-\\omega^2M) = 0$; each ratio comes from one row. A point on the rod a distance $s$ below the pivot moves $x + s\\theta$.',
            '$\\det = (k_{11}-\\lambda m_{11})(k_{22}-\\lambda m_{22}) - \\lambda^2m_{12}^2 = a\\lambda^2 - b\\lambda + c$ with $a = m_{11}m_{22}-m_{12}^2$, $b = k_{11}m_{22}+k_{22}m_{11}$, $c = k_{11}k_{22}$. Row 1: $(k_{11}-\\lambda m_{11})X - \\lambda m_{12}\\Theta = 0 \\Rightarrow r = (k_{11}-\\lambda m_{11})/(\\lambda m_{12})$.',
            `$a = ${t4(a)}$, $b = ${t4(b)}$, $c = ${t4(c)}$, so $\\lambda = ${t4(l1)}$ and $${t4(l2)}$ rad²/s².`,
            `$\\omega_1 = $ **${f4(w1)} rad/s**, $\\omega_2 = $ **${f4(w2)} rad/s**. $r_1 = (${t4(K[0][0])} - ${t4(l1)}\\times${t4(M[0][0])})/(${t4(l1)}\\times${t4(M[0][1])}) = $ **${f4(r1)} rad/m** (in phase); $r_2 = $ **${f4(r2)} rad/m** (out of phase). Node of mode 2: $s = -1/r_2 = $ **${f4(node)} m** below the pivot${node > 2 * L ? ' (beyond the end of the rod)' : ''}.`,
          ],
        };
      }
      if (tier === 2) {
        const m2t = rng.step(50, 200, 0.5);
        const mu = rng.pick([1, 1.5, 2, 2.5, 3]);
        const m1t = sig(m2t * mu, 4);
        const k2G = rng.pick([0.4, 0.5, 0.6, 0.73, 0.8, 1, 1.2, 1.5, 2, 2.5]);
        const kap = rng.pick([0.2, 0.3, 0.4, 0.5, 0.75, 1]);
        const k1G = sig(k2G * kap, 3);
        const { K, M } = chainKM(m1t * 1000, m2t * 1000, k1G * 1e9, k2G * 1e9, 0);
        const s = twoDof(K, M);
        const { a, b, c } = quadCoeffs(K, M);
        const [w1, w2] = s.omega;
        const [r1, r2] = s.r;
        const f1 = w1 / TAU;
        const f2 = w2 / TAU;
        const muE = m1t / m2t;
        const kapE = k1G / k2G;
        const lp = [s.omega2[0], s.omega2[1]].map((l) => (l * m2t * 1000) / (k2G * 1e9));
        return {
          prompt: `A forging machine ($m_2$ = ${m2t} t) stands on an elastic pad ($k_2$ = ${k2G} GN/m) on a concrete foundation block ($m_1$ = ${m1t} t), which rests on an isolation mat ($k_1$ = ${k1G} GN/m) on rigid ground. Model it as a 2-DoF chain with $x_1$ (block) and $x_2$ (machine) measured from static equilibrium. Mode 1 is the lower frequency; $r_i = X_2/X_1$.`,
          givens: [
            { sym: 'm_1', value: `${m1t} t`, label: 'foundation block' },
            { sym: 'm_2', value: `${m2t} t`, label: 'machine' },
            { sym: 'k_1', value: `${k1G} GN/m`, label: 'isolation mat' },
            { sym: 'k_2', value: `${k2G} GN/m`, label: 'elastic pad' },
          ],
          figure: chainFigure('block m₁', 'machine m₂', 'mat k₁', 'pad k₂'),
          parts: [
            { kind: 'numeric', id: 'f1', label: 'Fundamental frequency $f_1$', answer: f1, unit: 'Hz', freq: true, traps: keep(f1, [{ value: f1 * Math.sqrt(1000), message: 'Masses must be in kg: 1 t = 1000 kg (here every ω came out √1000 too high).', trapId: 'unit-scale' }]) },
            { kind: 'numeric', id: 'f2', label: 'Second natural frequency $f_2$', answer: f2, unit: 'Hz', freq: true },
            {
              kind: 'numeric',
              id: 'r1',
              label: 'Mode 1 ratio $r_1 = X_2/X_1$',
              answer: r1,
              unit: '',
              traps: keep(r1, [
                { value: 1 / r1, message: 'That is $X_1/X_2$: the ratio is upside down.', trapId: 'a3-ratio-inverted' },
                { value: r2, message: 'That is mode 2’s ratio: use $\\omega_1^2$ for mode 1.', trapId: 'a3-wrong-mode' },
              ]),
            },
            {
              kind: 'numeric',
              id: 'r2',
              label: 'Mode 2 ratio $r_2 = X_2/X_1$',
              answer: r2,
              unit: '',
              traps: keep(r2, [
                { value: 1 / r2, message: 'That is $X_1/X_2$: the ratio is upside down.', trapId: 'a3-ratio-inverted' },
                { value: r1, message: 'That is mode 1’s ratio.', trapId: 'a3-wrong-mode' },
              ]),
            },
            {
              kind: 'matrix',
              id: 'P',
              label: 'Modal matrix $P$ (columns = modes 1 and 2; any column scaling is accepted)',
              answer: [
                [1, 1],
                [r1, r2],
              ],
              rowLabels: ['$x_1$', '$x_2$'],
              colLabels: ['mode 1', 'mode 2'],
              columnsUpToScale: true,
            },
          ],
          hints: [
            'Chain with nothing above $m_2$ ($k_3 = 0$): $M = \\mathrm{diag}(m_1, m_2)$, $K = [k_1+k_2,\\,-k_2;\\;-k_2,\\,k_2]$. Convert t → kg and GN/m → N/m first.',
            'Neat scaling: with $\\lambda\' = m_2\\omega^2/k_2$, $\\mu = m_1/m_2$, $\\kappa = k_1/k_2$ the frequency equation is $\\mu\\lambda\'^2 - (\\kappa+1+\\mu)\\lambda\' + \\kappa = 0$ and row 1 gives $r = \\kappa + 1 - \\mu\\lambda\'$.',
            `$\\mu = ${f4(muE)}$, $\\kappa = ${f4(kapE)}$: $${t4(muE)}\\lambda'^2 - ${t4(kapE + 1 + muE)}\\lambda' + ${t4(kapE)} = 0 \\Rightarrow \\lambda' = ${t4(lp[0])}, ${t4(lp[1])}$. (Unscaled: $${t4(a)}\\omega^4 - ${t4(b)}\\omega^2 + ${t4(c)} = 0$.)`,
            `$\\omega_1^2 = \\lambda'_1k_2/m_2 = ${t4(s.omega2[0])}$, $\\omega_1 = ${f4(w1)}$ rad/s, $f_1 = $ **${f4(f1)} Hz**; $\\omega_2 = ${f4(w2)}$ rad/s, $f_2 = $ **${f4(f2)} Hz**. $r_1 = $ **${f4(r1)}** (in phase), $r_2 = $ **${f4(r2)}** (out of phase); check $r_1r_2 = ${f4(r1 * r2)} = -\\mu$ ✓. $P = ${bm([[1, 1], [r1, r2]])}$.`,
          ],
        };
      }
      const { m1, m2, k1, k2, K, M } = niceChain(rng);
      const s = twoDof(K, M);
      const { a, b, c } = quadCoeffs(K, M);
      const [w1, w2] = s.omega;
      const [r1, r2] = s.r;
      return {
        prompt: `A vertical chain stands on rigid ground: ground–$k_1$–$m_1$–$k_2$–$m_2$, with nothing above $m_2$. $m_1$ = ${m1} kg, $m_2$ = ${m2} kg, $k_1$ = ${k1} N/m, $k_2$ = ${k2} N/m; $x_1$, $x_2$ are measured from static equilibrium. Mode 1 is the lower frequency; $r_i = X_2/X_1$.`,
        givens: [
          { sym: 'm_1', value: `${m1} kg` },
          { sym: 'm_2', value: `${m2} kg` },
          { sym: 'k_1', value: `${k1} N/m` },
          { sym: 'k_2', value: `${k2} N/m` },
        ],
        figure: chainFigure(),
        parts: [
          { kind: 'numeric', id: 'w1', label: 'Lower natural frequency $\\omega_1$', answer: w1, unit: 'rad/s', freq: true, traps: keep(w1, [{ value: Math.sqrt(k1 / m1), message: 'That is $\\sqrt{k_1/m_1}$, $m_1$ alone on $k_1$. Coupling pushes $\\omega_1$ below it (and $\\omega_2$ above).' }]) },
          { kind: 'numeric', id: 'w2', label: 'Higher natural frequency $\\omega_2$', answer: w2, unit: 'rad/s', freq: true },
          {
            kind: 'numeric',
            id: 'r1',
            label: 'Mode 1 ratio $r_1 = X_2/X_1$',
            answer: r1,
            unit: '',
            traps: keep(r1, [
              { value: 1 / r1, message: 'That is $X_1/X_2$: the ratio is upside down.', trapId: 'a3-ratio-inverted' },
              { value: r2, message: 'That is mode 2’s ratio: substitute $\\omega_1^2$, not $\\omega_2^2$.', trapId: 'a3-wrong-mode' },
            ]),
          },
        ],
        hints: [
          'Free vibration: the roots of $\\det(K-\\omega^2M) = 0$ are $\\omega^2$; one row of $(K-\\omega_i^2M)A = 0$ gives each ratio $r_i = A_2/A_1$.',
          `$M = ${bm(M)}$ kg, $K = ${bm(K)}$ N/m. With $\\lambda = \\omega^2$: $m_1m_2\\lambda^2 - [(k_1+k_2)m_2 + k_2m_1]\\lambda + k_1k_2 = 0$, and row 1 gives $r_i = (k_1+k_2-\\lambda_im_1)/k_2$.`,
          `$${t4(a)}\\lambda^2 - ${t4(b)}\\lambda + ${t4(c)} = 0 \\Rightarrow \\lambda = ${t4(s.omega2[0])}$, $${t4(s.omega2[1])}$ rad²/s².`,
          `$\\omega_1 = \\sqrt{${t4(s.omega2[0])}} = $ **${f4(w1)} rad/s**, $\\omega_2 = $ **${f4(w2)} rad/s**. $r_1 = (${k1 + k2} - ${t4(s.omega2[0])}\\times ${m1})/${k2} = $ **${f4(r1)}** (in phase); $r_2 = ${f4(r2)}$. Check: $r_1r_2 = ${f4(r1 * r2)} = -m_1/m_2$ ✓.`,
        ],
      };
    },
  },

  // ------------------------------------------------------------------ free response
  {
    id: 'a3-free-response',
    title: 'Free response to initial conditions (Y₀ = P⁻¹X₀)',
    summary: 'Project the initial conditions onto the modes, write each modal response, and superpose with $X = PY$.',
    tiers: [1, 2, 3],
    source: 'Similar to 2022 A2.4; official 2017 A1(e)–(f); Week 4 Q4',
    cardId: 'a3-free-response',
    sprint: false,
    generate(rng, tier) {
      if (tier === 3) {
        // Week 4 Q4: hammer blow on the machine of a forging foundation.
        const m2 = rng.step(40, 150, 5); // t
        const m1 = sig(m2 * rng.pick([1.5, 2, 2.5, 3]), 3);
        const k2 = rng.pick([1, 1.5, 2, 2.5, 3, 4]); // GN/m
        const k1 = sig(k2 * rng.pick([0.1, 0.15, 0.2, 0.25, 0.3]), 3);
        const { K, M } = chainKM(m1 * 1000, m2 * 1000, k1 * 1e9, k2 * 1e9, 0);
        const s = twoDof(K, M);
        const w1 = dp(s.omega[0], 2);
        const w2 = dp(s.omega[1], 2);
        const r1 = sig(s.r[0], 5);
        const r2 = sig(s.r[1], 5);
        const P = [
          [1, 1],
          [r1, r2],
        ];
        const Pi = inv2(P);
        const v = rng.step(50, 300, 1); // mm/s
        const yd = mul(Pi, [0, v]);
        const A = yd[0] / w1;
        const B = yd[1] / w2;
        const ydT = mulT(P, [0, v]);
        return {
          prompt: `A forging machine ($m_2$ = ${m2} t) sits on a pad ($k_2$ = ${k2} GN/m) on a foundation block ($m_1$ = ${m1} t) on a mat ($k_1$ = ${k1} GN/m). The modes are $\\omega_1$ = ${w1} rad/s, $\\omega_2$ = ${w2} rad/s with $P = ${bm(P, 5)}$ (rows $x_1$ block, $x_2$ machine). The hammer strikes and rebounds, leaving the machine with $\\dot x_{20}$ = ${v} mm/s while everything else starts from rest at equilibrium.`,
          givens: [
            { sym: '\\omega_1,\\ \\omega_2', value: `${w1}, ${w2} rad/s` },
            { sym: 'r_1,\\ r_2', value: `${r1}, ${r2}`, label: 'X₂/X₁' },
            { sym: '\\dot x_{20}', value: `${v} mm/s`, label: 'machine, after the blow' },
          ],
          figure: chainFigure('block m₁', 'machine m₂', 'mat k₁', 'pad k₂'),
          parts: [
            {
              kind: 'matrix',
              id: 'Yd0',
              label: 'Modal initial velocities $\\dot Y_0$',
              answer: [[yd[0]], [yd[1]]],
              rowLabels: ['$\\dot y_{10}$', '$\\dot y_{20}$'],
              unit: 'mm/s',
              traps: [{ value: [[ydT[0]], [ydT[1]]], message: 'That is $P^T\\dot X_0$. $P$ is not orthogonal: use $\\dot Y_0 = P^{-1}\\dot X_0$.', trapId: 'modal-ic-pinv' }],
            },
            {
              kind: 'numeric',
              id: 'A',
              label: 'In $x_1(t) = A\\sin\\omega_1t + B\\sin\\omega_2t$, the amplitude $A$',
              answer: A,
              unit: 'mm',
              traps: keep(A, [
                { value: v / w1, message: 'Each mode gets its own share of the velocity, $\\dot Y_0 = P^{-1}\\dot X_0$, not the whole $\\dot x_{20}$.', trapId: 'a3-equal-modal-amplitudes' },
                { value: ydT[0] / w1, message: 'This uses $P^T\\dot X_0$ for the modal velocities.', trapId: 'modal-ic-pinv' },
                { value: yd[0] * w1, message: 'Velocity → displacement amplitude divides by $\\omega_1$: $A = P_{11}\\dot y_{10}/\\omega_1$.' },
              ]),
            },
            {
              kind: 'numeric',
              id: 'B',
              label: 'the amplitude $B$',
              answer: B,
              unit: 'mm',
              traps: keep(B, [
                { value: v / w2, message: 'Each mode gets its own share of the velocity, $\\dot Y_0 = P^{-1}\\dot X_0$.', trapId: 'a3-equal-modal-amplitudes' },
                { value: ydT[1] / w2, message: 'This uses $P^T\\dot X_0$.', trapId: 'modal-ic-pinv' },
              ]),
            },
            { kind: 'numeric', id: 'max', label: 'Upper bound on $|x_1|$ (reached as the two modes drift into step)', answer: Math.abs(A) + Math.abs(B), unit: 'mm', traps: keep(Math.abs(A) + Math.abs(B), [{ value: Math.abs(A), message: 'That is the mode-1 term alone; add the mode-2 amplitude for the bound $|A| + |B|$.' }]) },
          ],
          hints: [
            'An impulsive blow sets an initial **velocity**: $X_0 = 0$, $\\dot X_0 = [0;\\,\\dot x_{20}]$. Project with $P^{-1}$, then $y_i = (\\dot y_{i0}/\\omega_i)\\sin\\omega_it$ and $x_1 = P_{11}y_1 + P_{12}y_2$.',
            `$P^{-1} = \\frac{1}{r_2-r_1}\\begin{bmatrix} r_2 & -1 \\\\ -r_1 & 1\\end{bmatrix}$, so $\\dot Y_0 = \\frac{\\dot x_{20}}{r_2-r_1}[-1;\\;1]$: equal and opposite modal velocities.`,
            `$r_2 - r_1 = ${f4(r2 - r1)}$; $\\dot Y_0 = [${f4(yd[0])};\\;${f4(yd[1])}]$ mm/s.`,
            `$A = ${f4(yd[0])}/${w1} = $ **${f4(A)} mm**, $B = ${f4(yd[1])}/${w2} = $ **${f4(B)} mm**, so $|x_1| \\le $ **${f4(Math.abs(A) + Math.abs(B))} mm**. The slow mode dominates because the equal modal velocities are divided by $\\omega_i$ ($\\omega_2/\\omega_1 = ${f3(w2 / w1)}$).`,
          ],
        };
      }
      if (tier === 2) {
        const draw = () => {
          const { M, K } = cartRod(rng);
          const { a, b, c } = quadCoeffs(K, M);
          const [l1, l2] = roots(a, b, c);
          return { l1, l2, r1: dp((K[0][0] - l1 * M[0][0]) / (l1 * M[0][1]), 3), r2: dp((K[0][0] - l2 * M[0][0]) / (l2 * M[0][1]), 3) };
        };
        // Weak coupling (|r1/r2| small) gives Y0 ≈ X0 within the matrix tolerance, so the physical initial conditions
        // (a named trap) would be marked correct: redraw until y20 is at least ~6 % of y10.
        let cr = draw();
        for (let k = 0; k < 40 && Math.abs(cr.r1 / cr.r2) < 0.06; k++) cr = draw();
        const { l1, l2, r1, r2 } = cr;
        const w1 = dp(Math.sqrt(l1), 3);
        const w2 = dp(Math.sqrt(l2), 3);
        const P = [
          [1, 1],
          [r1, r2],
        ];
        const x0 = rng.step(0.02, 0.2, 0.01);
        const Y0 = mul(inv2(P), [x0, 0]);
        const YT = mulT(P, [x0, 0]);
        const c1 = r1 * Y0[0];
        const c2 = r2 * Y0[1];
        return {
          prompt: `A cart–rod system (coordinates $x$ in m, $\\theta$ in rad) has $\\omega_1$ = ${w1} rad/s, $\\omega_2$ = ${w2} rad/s and modal matrix $P = ${bm(P, 4)}$. It is released from rest with $x_0$ = ${x0} m and $\\theta_0 = 0$. Write $\\theta(t) = C_1\\cos\\omega_1t + C_2\\cos\\omega_2t$.`,
          givens: [
            { sym: '\\omega_1,\\ \\omega_2', value: `${w1}, ${w2} rad/s` },
            { sym: 'P', value: `[1, 1; ${r1}, ${r2}]`, label: 'rows x, θ' },
            { sym: 'X_0', value: `[${x0}; 0]`, label: 'm, rad; from rest' },
          ],
          parts: [
            {
              kind: 'matrix',
              id: 'Y0',
              label: 'Modal initial displacements $Y_0$',
              answer: [[Y0[0]], [Y0[1]]],
              rowLabels: ['$y_{10}$', '$y_{20}$'],
              unit: 'm',
              traps: [
                { value: [[YT[0]], [YT[1]]], message: 'That is $P^TX_0$: use $P^{-1}$ (summary notes trap 3).', trapId: 'modal-ic-pinv' },
                { value: [[x0], [0]], message: 'Those are the physical initial conditions; project them with $P^{-1}$.' },
              ],
            },
            { kind: 'numeric', id: 'C1', label: '$C_1$ (coefficient of $\\cos\\omega_1t$ in $\\theta$)', answer: c1, unit: 'rad', traps: keep(c1, [{ value: Y0[0], message: 'Multiply by the $\\theta$-row entry of mode 1: $C_1 = r_1y_{10}$.' }, { value: r1 * YT[0], message: 'This uses $P^TX_0$.', trapId: 'modal-ic-pinv' }]) },
            { kind: 'numeric', id: 'C2', label: '$C_2$ (coefficient of $\\cos\\omega_2t$ in $\\theta$)', answer: c2, unit: 'rad', traps: keep(c2, [{ value: Y0[1], message: 'Multiply by the $\\theta$-row entry of mode 2: $C_2 = r_2y_{20}$.' }, { value: r2 * YT[1], message: 'This uses $P^TX_0$.', trapId: 'modal-ic-pinv' }]) },
          ],
          hints: [
            'Released from rest: $\\dot Y_0 = 0$, so $y_i = y_{i0}\\cos\\omega_it$ with $Y_0 = P^{-1}X_0$. Then $\\theta = P_{21}y_1 + P_{22}y_2$.',
            '$P^{-1} = \\frac{1}{r_2-r_1}\\begin{bmatrix} r_2 & -1 \\\\ -r_1 & 1\\end{bmatrix}$; with $X_0 = [x_0;\\,0]$: $y_{10} = r_2x_0/(r_2-r_1)$, $y_{20} = -r_1x_0/(r_2-r_1)$.',
            `$r_2 - r_1 = ${f4(r2 - r1)}$; $Y_0 = [${f4(Y0[0])};\\;${f4(Y0[1])}]$ m (check: $y_{10} + y_{20} = ${f4(Y0[0] + Y0[1])} = x_0$ ✓).`,
            `$\\theta(t) = ${f4(r1)}\\times${f4(Y0[0])}\\cos ${w1}t + (${f4(r2)})\\times${f4(Y0[1])}\\cos ${w2}t$, i.e. $C_1 = $ **${f4(c1)} rad**, $C_2 = $ **${f4(c2)} rad**. They cancel at $t = 0$ because $\\theta_0 = 0$ ✓; and $x(t) = ${f4(Y0[0])}\\cos ${w1}t + ${f4(Y0[1])}\\cos ${w2}t$ m.`,
          ],
        };
      }
      const ch = niceChain(rng);
      const s = twoDof(ch.K, ch.M);
      const r1 = dp(s.r[0], 3);
      const r2 = dp(s.r[1], 3);
      const P = [
        [1, 1],
        [r1, r2],
      ];
      const Pi = inv2(P);
      const x10 = rng.pick([-1, 1]) * rng.step(2, 20, 1);
      const x20 = rng.pick([-1, 1]) * rng.step(2, 20, 1);
      const Y0 = mul(Pi, [x10, x20]);
      const YT = mulT(P, [x10, x20]);
      return {
        prompt: `A 2-DoF system has modal matrix $P = ${bm(P, 4)}$ (columns = modes 1 and 2). It is released from rest with $X_0 = [${x10};\\;${x20}]$ mm.`,
        givens: [
          { sym: 'P', value: `[1, 1; ${r1}, ${r2}]` },
          { sym: 'X_0', value: `[${x10}; ${x20}] mm`, label: 'from rest' },
        ],
        parts: [
          {
            kind: 'matrix',
            id: 'Y0',
            label: 'Modal initial displacements $Y_0$',
            answer: [[Y0[0]], [Y0[1]]],
            rowLabels: ['$y_{10}$', '$y_{20}$'],
            unit: 'mm',
            traps: [
              { value: [[YT[0]], [YT[1]]], message: 'That is $P^TX_0$. $P$ is not orthogonal, so $P^T \\ne P^{-1}$ (summary notes trap 3).', trapId: 'modal-ic-pinv' },
              { value: [[x10], [x20]], message: 'Those are the physical initial conditions; project them onto the modes with $P^{-1}$.' },
            ],
          },
        ],
        hints: [
          'Modal initial conditions come from $X_0 = PY_0$, so $Y_0 = P^{-1}X_0$, never $P^TX_0$.',
          '$P^{-1} = \\frac{1}{r_2-r_1}\\begin{bmatrix} r_2 & -1 \\\\ -r_1 & 1\\end{bmatrix}$ for $P = [1\\;1;\\,r_1\\;r_2]$.',
          `$r_2 - r_1 = ${f4(r2 - r1)}$, so $P^{-1} = ${bm(Pi)}$.`,
          `$Y_0 = P^{-1}X_0 = $ **[${f4(Y0[0])}; ${f4(Y0[1])}] mm**. Check: $PY_0 = [${f4(Y0[0] + Y0[1])};\\;${f4(r1 * Y0[0] + r2 * Y0[1])}] = X_0$ ✓. ($P^TX_0 = [${f4(YT[0])};\\;${f4(YT[1])}]$ would not return $X_0$.)`,
        ],
      };
    },
  },

  // ------------------------------------------------------------------ single-mode initial conditions
  {
    id: 'a3-single-mode',
    title: 'Initial conditions that excite only one mode',
    summary: 'Make $X_0$ (and $\\dot X_0$) proportional to the chosen mode, so the other modal coordinate stays at zero.',
    tiers: [1, 2, 3],
    source: 'Similar to 2022 A2.5; summary notes A3',
    cardId: 'a3-free-response',
    generate(rng, tier) {
      if (tier === 2) {
        const { M, K } = cartRod(rng);
        const { a, b, c } = quadCoeffs(K, M);
        const [l1, l2] = roots(a, b, c);
        const r1 = (K[0][0] - l1 * M[0][0]) / (l1 * M[0][1]);
        const r2 = (K[0][0] - l2 * M[0][0]) / (l2 * M[0][1]);
        const x0 = rng.step(0.02, 0.2, 0.01);
        const th = r1 * x0;
        const deg = (th * 180) / Math.PI;
        return {
          prompt: `A cart–rod system has $M = ${bm(M)}$ and $K = ${bm(K)}$ (SI units; coordinates $x$ in m, $\\theta$ in rad). The cart is displaced $x_0$ = ${x0} m. What initial rod angle $\\theta_0$, released from rest together with $x_0$, makes the system vibrate in mode 1 (the lower mode) only?`,
          givens: [
            { sym: 'M', value: `[${M[0][0]}, ${M[0][1]}; ${M[1][0]}, ${M[1][1]}]` },
            { sym: 'K', value: `diag(${K[0][0]}, ${K[1][1]})` },
            { sym: 'x_0', value: `${x0} m` },
          ],
          parts: [
            {
              kind: 'numeric',
              id: 'r1',
              label: 'Mode 1 ratio $r_1 = \\Theta/X$',
              answer: r1,
              unit: 'rad/m',
              traps: keep(r1, [
                { value: 1 / r1, message: 'That is $X/\\Theta$, the inverse.', trapId: 'a3-ratio-inverted' },
                { value: r2, message: 'That is mode 2’s ratio.', trapId: 'a3-wrong-mode' },
              ]),
            },
            {
              kind: 'numeric',
              id: 'th0',
              label: 'Initial angle $\\theta_0$',
              answer: deg,
              unit: '°',
              traps: keep(deg, [
                { value: th, message: 'That is the angle in radians; the answer box wants degrees (× 180/π).' },
                { value: (r2 * x0 * 180) / Math.PI, message: 'That excites mode 2 only ($\\theta_0 = r_2x_0$).', trapId: 'a3-wrong-mode' },
                { value: (r1 * 180) / Math.PI, message: 'Scale the ratio by $x_0$: $\\theta_0 = r_1x_0$.', trapId: 'a3-single-mode-scale' },
              ]),
            },
          ],
          hints: [
            'Only mode 1 responds when $X_0$ is proportional to mode 1’s shape (and the release is from rest): then $Y_0 = P^{-1}X_0 = [x_0;\\,0]$ and $y_2$ stays zero.',
            'Find $\\omega_1^2$ from $\\det(K-\\omega^2M) = 0$ (keep $-\\omega^2m_{12}$), then row 1: $r_1 = (k_{11}-\\omega_1^2m_{11})/(\\omega_1^2m_{12})$. Finally $\\theta_0 = r_1x_0$.',
            `$\\det$: $${t4(a)}\\lambda^2 - ${t4(b)}\\lambda + ${t4(c)} = 0$, $\\omega_1^2 = ${t4(l1)}$ rad²/s²; $r_1 = (${t4(K[0][0])} - ${t4(l1)}\\times ${t4(M[0][0])})/(${t4(l1)}\\times ${t4(M[0][1])}) = ${f4(r1)}$ rad/m.`,
            `$r_1 = $ **${f4(r1)} rad/m**; $\\theta_0 = ${f4(r1)}\\times ${x0} = ${f4(th)}$ rad $=$ **${f4(deg)}°**, in the same sense as $x_0$ (mode 1 is in phase).`,
          ],
        };
      }
      if (tier === 3) {
        const ch = niceChain(rng);
        const s = twoDof(ch.K, ch.M);
        const [w1, w2] = s.omega;
        const [r1, r2] = s.r;
        const v1 = rng.pick([-1, 1]) * rng.step(50, 400, 10); // mm/s
        const v2 = r2 * v1;
        const amp = Math.abs(v1) / w2;
        return {
          prompt: `The chain ground–$k_1$–$m_1$–$k_2$–$m_2$ (free top) has $m_1$ = ${ch.m1} kg, $m_2$ = ${ch.m2} kg, $k_1$ = ${ch.k1} N/m, $k_2$ = ${ch.k2} N/m and is at rest at equilibrium. Two simultaneous impulses give $m_1$ a velocity $\\dot x_{10}$ = ${v1} mm/s and $m_2$ a velocity $\\dot x_{20}$. Choose $\\dot x_{20}$ so that only mode 2 (the higher mode) vibrates.`,
          givens: [
            { sym: 'm_1,\\ m_2', value: `${ch.m1}, ${ch.m2} kg` },
            { sym: 'k_1,\\ k_2', value: `${ch.k1}, ${ch.k2} N/m` },
            { sym: '\\dot x_{10}', value: `${v1} mm/s` },
          ],
          figure: chainFigure(),
          parts: [
            {
              kind: 'numeric',
              id: 'v2',
              label: 'Required $\\dot x_{20}$',
              answer: v2,
              unit: 'mm/s',
              traps: keep(v2, [
                { value: r1 * v1, message: 'That is mode 1’s shape: it would excite mode 1 only.', trapId: 'a3-wrong-mode' },
                { value: v1 / r2, message: 'Ratio inverted: $\\dot x_{20} = r_2\\dot x_{10}$ with $r_2 = X_2/X_1$.', trapId: 'a3-ratio-inverted' },
              ]),
            },
            { kind: 'numeric', id: 'f', label: 'Frequency of the resulting vibration', answer: w2 / TAU, unit: 'Hz', freq: true, traps: keep(w2 / TAU, [{ value: w1 / TAU, message: 'Only mode 2 is excited, so the motion is at $\\omega_2$.', trapId: 'a3-wrong-mode' }]) },
            {
              kind: 'numeric',
              id: 'amp',
              label: 'Displacement amplitude of $m_1$',
              answer: amp,
              unit: 'mm',
              traps: keep(amp, [
                { value: Math.abs(v1) / w1, message: 'Divide by the frequency of the mode that is moving, $\\omega_2$.', trapId: 'a3-wrong-mode' },
                { value: Math.abs(v1) * w2, message: 'Displacement amplitude = velocity amplitude ÷ $\\omega$.' },
              ]),
            },
          ],
          hints: [
            'Velocities proportional to mode 2 give $\\dot Y_0 = [0;\\,\\dot y_{20}]$; with $Y_0 = 0$ only $y_2 = (\\dot y_{20}/\\omega_2)\\sin\\omega_2t$ moves, and every coordinate oscillates at $\\omega_2$.',
            'Find $\\omega_2$ and $r_2 = X_2/X_1$ from $\\det(K-\\omega^2M) = 0$ and row 1, $r = (k_1+k_2-\\omega^2m_1)/k_2$. Then $\\dot x_{20} = r_2\\dot x_{10}$; $m_1$’s amplitude is $|\\dot x_{10}|/\\omega_2$.',
            `$\\omega_1 = ${f4(w1)}$, $\\omega_2 = ${f4(w2)}$ rad/s; $r_2 = ${f4(r2)}$ (mode 1 would need $r_1 = ${f4(r1)}$).`,
            `$\\dot x_{20} = ${f4(r2)}\\times ${v1} = $ **${f4(v2)} mm/s** (opposite sense); $f_2 = ${f4(w2)}/2\\pi = $ **${f4(w2 / TAU)} Hz**; amplitude of $m_1$ $= ${Math.abs(v1)}/${f4(w2)} = $ **${f4(amp)} mm**.`,
          ],
        };
      }
      // tier 1
      const ch = niceChain(rng);
      const s = twoDof(ch.K, ch.M);
      const r1 = dp(s.r[0], 3);
      const r2 = dp(s.r[1], 3);
      const mode = rng.pick([1, 2]);
      const ri = mode === 1 ? r1 : r2;
      const ro = mode === 1 ? r2 : r1;
      const x10 = rng.pick([-1, 1]) * rng.step(2, 25, 1);
      const x20 = ri * x10;
      return {
        prompt: `A 2-DoF system has modes $P = \\begin{bmatrix} 1 & 1 \\\\ ${r1} & ${r2} \\end{bmatrix}$ (columns = modes 1 and 2, rows $x_1$, $x_2$). Mass 1 is held at $x_{10}$ = ${x10} mm. Where must mass 2 be held so that, released from rest, the system vibrates in **mode ${mode} only**?`,
        givens: [
          { sym: 'r_1,\\ r_2', value: `${r1}, ${r2}`, label: 'X₂/X₁' },
          { sym: 'x_{10}', value: `${x10} mm` },
        ],
        parts: [
          {
            kind: 'numeric',
            id: 'x20',
            label: 'Initial displacement $x_{20}$',
            answer: x20,
            unit: 'mm',
            traps: keep(x20, [
              { value: ro * x10, message: `That excites mode ${mode === 1 ? 2 : 1} only.`, trapId: 'a3-wrong-mode' },
              { value: x10 / ri, message: 'Ratio inverted: $x_{20} = r_ix_{10}$ with $r_i = X_2/X_1$.', trapId: 'a3-ratio-inverted' },
              { value: ri, message: 'Scale the ratio by $x_{10}$.', trapId: 'a3-single-mode-scale' },
            ]),
          },
        ],
        hints: [
          'Only the chosen mode responds when $X_0$ has its shape: then $Y_0 = P^{-1}X_0$ has a single non-zero entry, and (released from rest) the other modal coordinate stays zero.',
          `Mode ${mode} is $[1;\\,r_${mode}]$, so $x_{20} = r_${mode}\\,x_{10}$.`,
          `$x_{20} = (${ri})\\times(${x10})$.`,
          `$x_{20} = $ **${f4(x20)} mm**${ri < 0 ? ' (opposite sense to $x_{10}$: an out-of-phase mode)' : ' (same sense: an in-phase mode)'}. Then $Y_0 = [${mode === 1 ? x10 : 0};\\;${mode === 1 ? 0 : x10}]$ mm.`,
        ],
      };
    },
  },

  // ------------------------------------------------------------------ truncated modal superposition
  {
    id: 'a3-truncation',
    title: 'Modal superposition from a table of modes',
    summary: 'Build $x_j(t)$ from tabulated modes and modal initial conditions, keeping only the first few modes.',
    tiers: [1, 2, 3],
    source: 'Similar to 2023 A1.3',
    cardId: 'a3-free-response',
    generate(rng, tier) {
      const n = tier === 1 ? 4 : rng.pick([5, 6]);
      const m = Array.from({ length: n }, () => rng.step(0.5, 3, 0.1));
      const k = Array.from({ length: n }, () => rng.step(50, 500, 10));
      const { M, K } = chainN(m, k);
      const signs = Array.from({ length: n }, (_, i) => (i === 0 ? 1 : rng.pick([-1, 1])));
      const tab = modeTable(M, K, signs);
      const rows = tab.rows.map((r) => r.map((v) => dp(v, 3)));
      const f = tab.f.map((x) => dp(x, 3));
      const w = f.map((x) => TAU * x);
      const y0 = Array.from({ length: n }, () => rng.step(0.01, 0.3, 0.01));
      if (tier === 3) y0.sort((p, q) => p - q);
      const j = rng.int(1, n) - 1; // DoF asked
      const coef = (i: number) => rows[i][j] * y0[i];
      const y0txt = y0.map((v) => fmt(v, 3)).join(', ');
      const prompt = `A ${n}-DoF spring–mass chain (each displacement measured from its own static equilibrium) has the modes in the table: one row per mode, entries for DoF 1–${n}. It is released from rest with modal initial displacements $Y_0 = [${y0txt}]$ m (mode 1 first).`;
      const figure = modeTableFigure(f, rows);
      const rowTrap = (i: number): Trap[] => (j < n && i < n && rows[j] && rows[j][i] !== rows[i][j] ? [{ value: rows[j][i] * y0[i], message: `That is the DoF-${i + 1} entry of mode ${j + 1}. For $x_${j + 1}$ take the DoF-${j + 1} entry of each mode (column ${j + 1} of the table).`, trapId: 'a3-row-vs-column' }] : []);
      if (tier === 1) {
        const i = rng.int(0, 2);
        const ci = coef(i);
        return {
          prompt: prompt + ` Write $x_${j + 1}(t) = \\sum_i C_i\\cos\\omega_it$.`,
          figure,
          parts: [
            { kind: 'numeric', id: 'w', label: `$\\omega_${i + 1}$ of mode ${i + 1}`, answer: w[i], unit: 'rad/s', freq: true },
            { kind: 'numeric', id: 'c', label: `Coefficient $C_${i + 1}$ of $\\cos\\omega_${i + 1}t$ in $x_${j + 1}(t)$`, answer: ci * 1000, unit: 'mm', absTol: 0.02, traps: keep(ci * 1000, [...rowTrap(i).map((t) => ({ ...t, value: t.value * 1000 })), { value: rows[i][j] * 1000, message: 'Multiply the mode-shape entry by that mode’s initial condition $y_{i0}$.' }]) },
          ],
          hints: [
            'With modal initial conditions given, no inversion is needed: $x_j(t) = \\sum_i P_{ji}\\,y_{i0}\\cos\\omega_it$, where $P_{ji}$ is the DoF-$j$ entry of mode $i$.',
            `Table rows are modes, so $P_{${j + 1}${i + 1}}$ is row ${i + 1}, column DoF ${j + 1}. Convert $f$ to $\\omega = 2\\pi f$.`,
            `$P_{${j + 1}${i + 1}} = ${rows[i][j]}$, $y_{${i + 1}0} = ${y0[i]}$ m, $f_${i + 1} = ${f[i]}$ Hz.`,
            `$\\omega_${i + 1} = 2\\pi\\times ${f[i]} = $ **${f4(w[i])} rad/s**; $C_${i + 1} = ${rows[i][j]}\\times ${y0[i]} = ${fmt(ci, 4)}$ m $=$ **${f4(ci * 1000)} mm**.`,
          ],
        };
      }
      const cs = [0, 1, 2].map(coef);
      const trunc = cs[0] + cs[1] + cs[2];
      const full = rows.reduce((t, _, i) => t + coef(i), 0);
      const parts: SolvePart[] = [0, 1, 2].map(
        (i): NumericPart => ({
          kind: 'numeric',
          id: `c${i + 1}`,
          label: `Coefficient of $\\cos\\omega_${i + 1}t$ in $x_${j + 1}(t)$`,
          answer: cs[i] * 1000,
          unit: 'mm',
          absTol: 0.02,
          traps: keep(cs[i] * 1000, rowTrap(i).map((t) => ({ ...t, value: t.value * 1000 }))),
        })
      );
      if (tier === 2) parts.push({ kind: 'numeric', id: 'w3', label: '$\\omega_3$', answer: w[2], unit: 'rad/s', freq: true });
      else {
        // Tier 3 sorts Y0 ascending, so the dropped modes always carry the LARGEST modal amplitudes; whether the
        // truncation is adequate depends on their mode-shape entries at this DoF.
        const bad = Math.abs(trunc - full) > 0.1 * Math.max(Math.abs(full), 1e-6);
        const cmp = `Three modes give ${f3(trunc * 1000)} mm, all ${n} give ${f3(full * 1000)} mm.`;
        parts.push(
          { kind: 'numeric', id: 'x0t', label: `$x_${j + 1}(0)$ from the three-mode approximation`, answer: trunc * 1000, unit: 'mm', absTol: 0.02 },
          { kind: 'numeric', id: 'x0f', label: `$x_${j + 1}(0)$ using all ${n} modes`, answer: full * 1000, unit: 'mm', absTol: 0.02 },
          {
            kind: 'choice',
            id: 'ok',
            label: 'Is the three-mode truncation adequate here?',
            options: [
              { text: 'No: the three-mode value is more than 10 % away from the full value; the dropped modes carry the largest modal amplitudes here and contribute strongly to this coordinate.', correct: bad, why: cmp },
              { text: 'Yes: high modes have high frequencies, so they never matter.', correct: false, why: 'Frequency alone does not decide it: each dropped mode adds $P_{ji}y_{i0}$, its mode-shape entry times its modal amplitude (2023 A1.3).' },
              { text: 'Yes: the three-mode value is within 10 % of the full value; the dropped modes have large modal amplitudes, but their contributions to this coordinate are small or cancel.', correct: !bad, why: cmp },
            ],
          }
        );
      }
      return {
        prompt: prompt + ` Using only the **first three** modes, write $x_${j + 1}(t) = \\sum_{i=1}^{3} C_i\\cos\\omega_it$.`,
        figure,
        parts,
        hints: [
          'Modal initial conditions are given, so skip $P^{-1}$: $x_j(t) = \\sum_i P_{ji}\\,y_{i0}\\cos\\omega_it$ with $\\omega_i = 2\\pi f_i$.',
          `The table has one row per mode, so $P_{${j + 1}i}$ is the DoF-${j + 1} column read down the first three rows.`,
          `DoF-${j + 1} entries: ${[0, 1, 2].map((i) => fmt(rows[i][j], 3)).join(', ')}; $y_{i0}$: ${y0.slice(0, 3).join(', ')} m; $\\omega = ${[0, 1, 2].map((i) => f4(w[i])).join(', ')}$ rad/s.`,
          `$x_${j + 1}(t) = ${cs.map((cv, i) => `${i ? (cv < 0 ? '- ' : '+ ') : cv < 0 ? '-' : ''}${f4(Math.abs(cv))}\\cos ${f4(w[i])}t`).join(' ')}$ m, i.e. **${cs.map((cv) => f4(cv * 1000)).join(', ')} mm**${tier === 3 ? `. At $t = 0$: three modes give **${f4(trunc * 1000)} mm**; all ${n} give **${f4(full * 1000)} mm**` : `; $\\omega_3 = $ **${f4(w[2])} rad/s**`}.`,
        ],
      };
    },
  },

  // ------------------------------------------------------------------ rigid-body modes
  {
    id: 'a3-rigid',
    title: 'Semi-definite systems: rigid-body and flexible modes',
    summary: 'Free wagons, belt drives and geared drives: one mode at ω = 0, the flexible mode from the rest of the determinant.',
    tiers: [1, 2, 3],
    source: 'Similar to Week 3 Q2, official 2017 A1(c)–(d), official 2019 Q2(1)–(4), official 2018 A2',
    cardId: 'a3-rigid',
    generate(rng, tier) {
      if (tier === 2) {
        const R1 = rng.step(0.03, 0.1, 0.005);
        const R2 = dp(R1 * rng.pick([1.5, 2, 2.5, 3, 4]), 4);
        const IT = rng.step(0.005, 0.1, 0.005);
        const IP = rng.step(0.02, 1, 0.01);
        const k = rng.step(5000, 50000, 1000);
        const w2 = 2 * k * (R1 * R1 / IT + R2 * R2 / IP);
        const w = Math.sqrt(w2);
        const rig = R1 / R2;
        const flex = -(R2 / R1) * (IT / IP);
        return {
          prompt: `A motor pulley (radius $R_1$ = ${R1} m, inertia $I_T$ = ${IT} kg m², angle $\\theta_1$) drives a pulley ($R_2$ = ${R2} m, $I_P$ = ${IP} kg m², angle $\\theta_2$) through a belt whose two straight sides each have stiffness $k$ = ${k} N/m. Neither pulley is restrained.`,
          givens: [
            { sym: 'R_1,\\ R_2', value: `${R1}, ${R2} m` },
            { sym: 'I_T,\\ I_P', value: `${IT}, ${IP} kg m²` },
            { sym: 'k', value: `${k} N/m`, label: 'each belt side' },
          ],
          parts: [
            {
              kind: 'numeric',
              id: 'rig',
              label: 'Zero-frequency mode: $\\theta_2/\\theta_1$',
              answer: rig,
              unit: '',
              traps: keep(rig, [
                { value: 1, message: '$[1,\\,1]$ stretches the belt here. The belt is unstretched when $R_1\\theta_1 = R_2\\theta_2$.', trapId: 'a3-rigid-not-uniform' },
                { value: R2 / R1, message: 'Inverted: $R_1\\theta_1 = R_2\\theta_2$ gives $\\theta_2/\\theta_1 = R_1/R_2$.', trapId: 'a3-ratio-inverted' },
              ]),
            },
            { kind: 'numeric', id: 'f', label: 'Non-zero natural frequency', answer: w / TAU, unit: 'Hz', freq: true, traps: keep(w / TAU, [{ value: w / Math.SQRT2 / TAU, message: 'Both belt sides stretch: $V = 2\\times\\tfrac12k(R_1\\theta_1-R_2\\theta_2)^2$, so $K$ has $2k$.', trapId: 'factor2' }]) },
            {
              kind: 'numeric',
              id: 'flex',
              label: 'Flexible mode: $\\theta_2/\\theta_1$',
              answer: flex,
              unit: '',
              traps: keep(flex, [
                { value: 1 / flex, message: 'That is $\\theta_1/\\theta_2$: row 1 gives $\\theta_2/\\theta_1 = -(R_2/R_1)(I_T/I_P)$.', trapId: 'a3-ratio-inverted' },
                { value: -R2 / R1, message: 'The inertias matter too: $\\theta_2/\\theta_1 = -(R_2/R_1)(I_T/I_P)$.' },
              ]),
            },
            {
              kind: 'matrix',
              id: 'P',
              label: 'Modal matrix $P$ (column 1 = rigid mode; any column scaling)',
              answer: [
                [1, 1],
                [rig, flex],
              ],
              rowLabels: ['$\\theta_1$', '$\\theta_2$'],
              colLabels: ['ω = 0', 'flexible'],
              columnsUpToScale: true,
            },
          ],
          hints: [
            'Unrestrained, so one mode has $\\omega = 0$: $KA = 0$, i.e. the belt is not stretched. The belt stretch is $R_1\\theta_1 - R_2\\theta_2$ on each side.',
            '$V = 2\\cdot\\tfrac12k(R_1\\theta_1-R_2\\theta_2)^2 \\Rightarrow K = 2k\\begin{bmatrix} R_1^2 & -R_1R_2 \\\\ -R_1R_2 & R_2^2\\end{bmatrix}$, $M = \\mathrm{diag}(I_T, I_P)$. Then $\\lambda(\\lambda - 2k(R_1^2/I_T + R_2^2/I_P)) = 0$; flexible mode from row 1: $\\theta_2/\\theta_1 = -(R_2/R_1)(I_T/I_P)$.',
            `$\\omega^2 = 2(${k})(${R1}^2/${IT} + ${R2}^2/${IP}) = ${t4(w2)}$ s⁻².`,
            `Rigid: $\\theta_2/\\theta_1 = R_1/R_2 = $ **${f4(rig)}**. $\\omega = ${f4(w)}$ rad/s $=$ **${f4(w / TAU)} Hz**. Flexible: $\\theta_2/\\theta_1 = $ **${f4(flex)}** (pulleys counter-rotate relative to the rigid motion). $P = ${bm([[1, 1], [rig, flex]])}$.`,
          ],
        };
      }
      if (tier === 3) {
        const Im = rng.step(0.005, 0.2, 0.005);
        const Gr = rng.int(2, 12);
        const IL = rng.step(0.2, 20, 0.1);
        const kT = rng.step(500, 100000, 500);
        const Ieq = Im * Gr * Gr;
        const w2 = (kT * (IL + Ieq)) / (IL * Ieq);
        const w = Math.sqrt(w2);
        const ratio = -IL / Ieq;
        const wNoG = Math.sqrt((kT * (IL + Im)) / (IL * Im));
        const wG1 = Math.sqrt((kT * (IL + Im * Gr)) / (IL * Im * Gr));
        return {
          prompt: `A motor (rotor inertia $I_m$ = ${Im} kg m²) drives a load ($I_L$ = ${IL} kg m²) through a gearbox with speed ratio $G$ = ${Gr} (motor speed / shaft speed) and a shaft of torsional stiffness $k_T$ = ${kT} N m/rad. Gear inertias are negligible and nothing is restrained. Use $\\theta_G$ (shaft angle at the gearbox) and $\\theta_L$ (load angle).`,
          givens: [
            { sym: 'I_m', value: `${Im} kg m²` },
            { sym: 'G', value: `${Gr}` },
            { sym: 'I_L', value: `${IL} kg m²` },
            { sym: 'k_T', value: `${kT} N m/rad` },
          ],
          parts: [
            {
              kind: 'numeric',
              id: 'f',
              label: 'Non-zero natural frequency',
              answer: w / TAU,
              unit: 'Hz',
              freq: true,
              traps: keep(w / TAU, [
                { value: wNoG / TAU, message: 'The motor turns $G$ times faster: its kinetic energy is $\\tfrac12I_m(G\\dot\\theta_G)^2$, so it appears as $I_mG^2$.' },
                { value: wG1 / TAU, message: 'Reflected inertia scales with $G^2$, not $G$.' },
              ]),
            },
            {
              kind: 'numeric',
              id: 'ratio',
              label: 'Flexible mode: $\\theta_G/\\theta_L$',
              answer: ratio,
              unit: '',
              traps: keep(ratio, [
                { value: 1 / ratio, message: 'That is $\\theta_L/\\theta_G$.', trapId: 'a3-ratio-inverted' },
                { value: -IL / Im, message: 'Use the reflected inertia $I_mG^2$.' },
              ]),
            },
          ],
          hints: [
            'Reflect the motor through the gearbox: $T = \\tfrac12I_m(G\\dot\\theta_G)^2 + \\tfrac12I_L\\dot\\theta_L^2$, $V = \\tfrac12k_T(\\theta_L-\\theta_G)^2$. Unrestrained, so one root is $\\omega = 0$.',
            '$M = \\mathrm{diag}(I_mG^2,\\,I_L)$, $K = k_T\\begin{bmatrix} 1 & -1 \\\\ -1 & 1\\end{bmatrix}$; $\\omega^2 = k_T(I_L + I_mG^2)/(I_LI_mG^2)$; row 1 gives $\\theta_G/\\theta_L = -I_L/(I_mG^2)$.',
            `$I_mG^2 = ${Im}\\times ${Gr}^2 = ${f4(Ieq)}$ kg m²; $\\omega^2 = ${kT}(${IL} + ${f4(Ieq)})/(${IL}\\times ${f4(Ieq)}) = ${t4(w2)}$ s⁻².`,
            `$\\omega = ${f4(w)}$ rad/s $=$ **${f4(w / TAU)} Hz**; $\\theta_G/\\theta_L = -${IL}/${f4(Ieq)} = $ **${f4(ratio)}**; $P = ${bm([[1, ratio], [1, 1]])}$ (rows $\\theta_G$, $\\theta_L$; column 1 is the rigid rotation).`,
          ],
        };
      }
      const m1 = rng.step(20, 100, 1);
      const m2 = rng.step(20, 100, 1);
      const k = rng.step(5, 60, 1); // MN/m
      const w2 = Math.sqrt(k * 1e6 * (1 / (m1 * 1000) + 1 / (m2 * 1000)));
      const ratio = -m1 / m2;
      const mbar = ((m1 + m2) / 2) * 1000;
      return {
        prompt: `Two wagons of ${m1} t and ${m2} t stand on a level track, free to roll, joined by a coupler of stiffness ${k} MN/m. Use $x_1$, $x_2$ for the wagon displacements.`,
        givens: [
          { sym: 'm_1,\\ m_2', value: `${m1}, ${m2} t` },
          { sym: 'k', value: `${k} MN/m` },
        ],
        parts: [
          {
            kind: 'numeric',
            id: 'f2',
            label: 'Non-zero natural frequency',
            answer: w2 / TAU,
            unit: 'Hz',
            freq: true,
            traps: keep(w2 / TAU, [
              { value: Math.sqrt((2 * k * 1e6) / mbar) / TAU, message: '$\\sqrt{2k/m}$ only holds for equal masses: use $\\omega^2 = k(1/m_1 + 1/m_2)$.' },
              { value: Math.sqrt((k * 1e6) / (m1 * 1000)) / TAU, message: 'That treats wagon 2 as a fixed wall. Both wagons move: $\\omega^2 = k(1/m_1+1/m_2)$.' },
            ]),
          },
          {
            kind: 'numeric',
            id: 'r',
            label: 'Flexible mode ratio $x_2/x_1$',
            answer: ratio,
            unit: '',
            traps: keep(ratio, [
              { value: -m2 / m1, message: 'Inverted: zero momentum needs $m_1x_1 + m_2x_2 = 0$, so $x_2/x_1 = -m_1/m_2$.', trapId: 'a3-ratio-inverted' },
              { value: 1, message: 'That is the rigid-body (ω = 0) mode.', trapId: 'rigid-modes' },
            ]),
          },
        ],
        hints: [
          'Free to roll means no spring to ground: $\\det K = 0$, so one mode has $\\omega = 0$ (both wagons rolling together, shape $[1,\\,1]$).',
          '$K = k\\begin{bmatrix} 1 & -1 \\\\ -1 & 1\\end{bmatrix}$, $M = \\mathrm{diag}(m_1, m_2)$: $\\omega^2[m_1m_2\\omega^2 - k(m_1+m_2)] = 0 \\Rightarrow \\omega^2 = k(1/m_1 + 1/m_2)$; the flexible mode has zero momentum, $x_2/x_1 = -m_1/m_2$.',
          `$\\omega^2 = ${k}\\times10^6\\,(1/${m1 * 1000} + 1/${m2 * 1000}) = ${t4(w2 * w2)}$ s⁻².`,
          `$\\omega = ${f4(w2)}$ rad/s $=$ **${f4(w2 / TAU)} Hz** (the other mode is $\\omega = 0$); $x_2/x_1 = -${m1}/${m2} = $ **${f4(ratio)}**.`,
        ],
      };
    },
  },

  // ------------------------------------------------------------------ modal forces
  {
    id: 'a3-modal-forces',
    title: 'Modal forces Pᵀ F and the modal step response',
    summary: 'Transform the physical forces into modal coordinates; with a step load each mode responds as $(\\tilde f_i/\\tilde k_i)(1-\\cos\\omega_it)$.',
    tiers: [1, 2, 3],
    source: 'Similar to official 2019 Q1b–d (answers b, c, a); Week 4 Q2',
    cardId: 'a3-orthogonality',
    generate(rng, tier) {
      if (tier === 1) {
        const ch = niceChain(rng);
        const s = twoDof(ch.K, ch.M);
        const r1 = dp(s.r[0], 3);
        const r2 = dp(s.r[1], 3);
        const F1 = rng.pick([-1, 1]) * rng.step(10, 200, 5);
        const F2 = rng.pick([-1, 1]) * rng.step(10, 200, 5);
        const P = [
          [1, 1],
          [r1, r2],
        ];
        const ft = mulT(P, [F1, F2]);
        const pf = mul(P, [F1, F2]);
        return {
          prompt: `A 2-DoF system has $P = ${bm(P)}$ (columns = modes 1 and 2). Forces $F = [${F1};\\;${F2}]$ N act on coordinates 1 and 2.`,
          givens: [
            { sym: 'P', value: `[1, 1; ${r1}, ${r2}]` },
            { sym: 'F', value: `[${F1}; ${F2}] N` },
          ],
          parts: [
            { kind: 'numeric', id: 'f1', label: 'Modal force on mode 1, $\\tilde f_1$', answer: ft[0], unit: 'N', traps: keep(ft[0], [{ value: pf[0], message: 'That is $(PF)_1$. Modal forces are $P^TF$: use column 1 of $P$.', trapId: 'a3-modal-force-transpose' }, { value: F1, message: 'That is $F_1$ untransformed.', trapId: 'a3-modal-force-transpose' }]) },
            { kind: 'numeric', id: 'f2', label: 'Modal force on mode 2, $\\tilde f_2$', answer: ft[1], unit: 'N', traps: keep(ft[1], [{ value: pf[1], message: 'That is $(PF)_2$. Use column 2 of $P$.', trapId: 'a3-modal-force-transpose' }, { value: F2, message: 'That is $F_2$ untransformed.', trapId: 'a3-modal-force-transpose' }]) },
          ],
          hints: [
            'Pre-multiplying $M\\ddot X + KX = F$ by $P^T$ with $X = PY$ gives modal forces $\\tilde f = P^TF$: each one is (mode $i$’s column)·$F$.',
            '$\\tilde f_1 = F_1 + r_1F_2$ and $\\tilde f_2 = F_1 + r_2F_2$.',
            `$\\tilde f_1 = ${F1} + (${r1})(${F2})$, $\\tilde f_2 = ${F1} + (${r2})(${F2})$.`,
            `$\\tilde f_1 = $ **${f4(ft[0])} N**, $\\tilde f_2 = $ **${f4(ft[1])} N**. (The tempting $PF = [${f4(pf[0])};\\;${f4(pf[1])}]$ uses rows instead of columns.)`,
          ],
        };
      }
      // rail–wheel model (official 2019 Q1): wheel x1 on contact spring kC on rail x2 on pad kR.
      const mW = rng.step(350, 550, 10);
      const mR = rng.step(500, 900, 10);
      const kC = rng.step(0.8, 1.6, 0.1); // GN/m
      const kR = rng.step(1.5, 3, 0.1); // ×10^10 N/m
      const M = [
        [mW, 0],
        [0, mR],
      ];
      const K = [
        [kC * 1e9, -kC * 1e9],
        [-kC * 1e9, kC * 1e9 + kR * 1e10],
      ];
      const { omega2, modes: phi } = genSymEig(K, M);
      const cols = [0, 1].map((jj) => {
        const v = [phi[0][jj], phi[1][jj]];
        const len = Math.hypot(v[0], v[1]);
        let u = v.map((x) => x / len);
        const big = Math.abs(u[0]) > Math.abs(u[1]) ? 0 : 1;
        if (u[big] < 0) u = u.map((x) => -x);
        return u;
      });
      const P = [
        [dp(cols[0][0], 3), dp(cols[1][0], 3)],
        [dp(cols[0][1], 3), dp(cols[1][1], 3)],
      ];
      const h = rng.step(0.005, 0.05, 0.005); // mm
      const step = kC * 1e9 * (h / 1000); // N
      const F = [step, -step];
      const ft = mulT(P, F).map((x) => x / 1000); // kN
      const pf = mul(P, F).map((x) => x / 1000);
      const half = mulT(P, [step, 0]).map((x) => x / 1000);
      const Pdisp = `\\begin{bmatrix} ${P[0][0]} & ${P[0][1]} \\\\ ${P[1][0]} & ${P[1][1]} \\end{bmatrix}`;
      if (tier === 2) {
        return {
          prompt: `A wheel ($x_1$) rides on a rail ($x_2$) through a contact spring $k_C$ = ${kC} GN/m; the rail sits on a pad to ground. MATLAB gives the undamped unit-length modal matrix $P = ${Pdisp}$ (columns = modes 1, 2). At $t = 0$ the wheel meets a step rise $h$ = ${h} mm in the rail surface, so the contact spring is suddenly compressed by an extra $h$.`,
          givens: [
            { sym: 'k_C', value: `${kC} GN/m` },
            { sym: 'h', value: `${h} mm` },
            { sym: 'P', value: `[${P[0][0]}, ${P[0][1]}; ${P[1][0]}, ${P[1][1]}]` },
          ],
          parts: [
            {
              kind: 'numeric',
              id: 'f1',
              label: 'Modal force on mode 1, $\\tilde f_1$',
              answer: ft[0],
              unit: 'kN',
              traps: keep(ft[0], [
                { value: pf[0], message: 'That is $(PF)_1$: modal forces are $P^TF$.', trapId: 'a3-modal-force-transpose' },
                { value: half[0], message: 'The step loads the rail too: $F = k_Ch[1;\\,-1]$, equal and opposite.' },
              ]),
            },
            {
              kind: 'numeric',
              id: 'f2',
              label: 'Modal force on mode 2, $\\tilde f_2$',
              answer: ft[1],
              unit: 'kN',
              traps: keep(ft[1], [
                { value: pf[1], message: 'That is $(PF)_2$: modal forces are $P^TF$.', trapId: 'a3-modal-force-transpose' },
                { value: half[1], message: 'The step loads the rail too: $F = k_Ch[1;\\,-1]$.' },
              ]),
            },
          ],
          hints: [
            'Write $V = \\tfrac12k_C(x_1 - x_2 - h)^2 + \\tfrac12k_Rx_2^2$: the known $h$ terms move to the right-hand side as a step force vector $F$; then $\\tilde f = P^TF$.',
            '$F = k_Ch\\,[1;\\,-1]$ (pushes the wheel up and the rail down); $\\tilde f_i = P_{1i}F_1 + P_{2i}F_2$.',
            `$k_Ch = ${kC}\\times10^9 \\times ${h}\\times10^{-3} = ${f4(step / 1000)}$ kN, so $F = [${f4(step / 1000)};\\;${f4(-step / 1000)}]$ kN.`,
            `$\\tilde f_1 = ${P[0][0]}(${f4(step / 1000)}) + ${P[1][0]}(${f4(-step / 1000)}) = $ **${f4(ft[0])} kN**; $\\tilde f_2 = ${P[0][1]}(${f4(step / 1000)}) + ${P[1][1]}(${f4(-step / 1000)}) = $ **${f4(ft[1])} kN**.`,
          ],
        };
      }
      // tier 3: modal step response (official 2019 Q1d)
      const D = omega2.map((x) => sig(x, 4));
      const mt = [0, 1].map((jj) => quad(cols[jj], M, cols[jj]));
      const kt = mt.map((m_, jj) => sig(omega2[jj] * m_, 4));
      const w1 = Math.sqrt(D[0]);
      const y1 = (ft[0] * 1000) / kt[0]; // m
      const y2 = (ft[1] * 1000) / kt[1];
      const c2 = P[0][1] * y2 * 1e6; // µm
      const c1 = P[0][0] * y1 * 1e6;
      return {
        prompt: `Wheel–rail model (wheel $x_1$, rail $x_2$), undamped. MATLAB output: $P = ${Pdisp}$, $D = \\mathrm{diag}(${t4(D[0])},\\;${t4(D[1])})$ from \`[P,D] = eig(inv(M)*K)\`, and $P^TKP = \\mathrm{diag}(${t4(kt[0])},\\;${t4(kt[1])})$ N/m. A step rise of the rail surface ($k_C$ = ${kC} GN/m, $h$ = ${h} mm) loads wheel and rail with $F = k_Ch[1;\\,-1]$ from $t = 0$. Each modal coordinate then responds as $y_i = (\\tilde f_i/\\tilde k_i)(1-\\cos\\omega_it)$.`,
          givens: [
            { sym: 'P', value: `[${P[0][0]}, ${P[0][1]}; ${P[1][0]}, ${P[1][1]}]` },
            { sym: 'D', value: `diag(${fmt(D[0], 4)}, ${fmt(D[1], 4)})`, label: 'eig(inv(M)*K)' },
            { sym: '\\tilde k', value: `${fmt(kt[0], 4)}, ${fmt(kt[1], 4)} N/m` },
            { sym: 'k_C,\\ h', value: `${kC} GN/m, ${h} mm` },
          ],
          parts: [
            { kind: 'numeric', id: 'w1', label: 'Mode 1 natural frequency $\\omega_1$', answer: w1, unit: 'rad/s', freq: true, traps: keep(w1, [{ value: D[0], message: 'D from `eig(inv(M)*K)` holds $\\omega^2$: take the square root.', trapId: 'a3-d-omega2' }]) },
            { kind: 'numeric', id: 'c1', label: 'Coefficient of $(1-\\cos\\omega_1t)$ in $x_1(t)$', answer: c1, unit: 'µm', traps: keep(c1, [{ value: y1 * 1e6, message: 'That is $y_1$’s coefficient; $x_1 = P_{11}y_1 + P_{12}y_2$, so multiply by $P_{11}$.' }]) },
            {
              kind: 'numeric',
              id: 'c2',
              label: 'Coefficient of $(1-\\cos\\omega_2t)$ in $x_1(t)$',
              answer: c2,
              unit: 'µm',
              traps: keep(c2, [
                { value: P[1][0] * y2 * 1e6, message: 'That uses $P_{21}$. The wheel row is row 1: $x_1 = P_{11}y_1 + P_{12}y_2$.' },
                { value: P[1][1] * y2 * 1e6, message: 'That is the rail ($x_2$) coefficient, $P_{22}y_2$.' },
              ]),
            },
          ],
          hints: [
            'Modal forces $\\tilde f = P^TF$; each mode is an SDOF system under a suddenly applied constant force: $y_i = (\\tilde f_i/\\tilde k_i)(1-\\cos\\omega_it)$. Then $x_1 = P_{11}y_1 + P_{12}y_2$.',
            '$\\omega_i = \\sqrt{D_{ii}}$ (D holds $\\omega^2$); $F = k_Ch[1;\\,-1]$; $\\tilde f_i = P_{1i}F_1 + P_{2i}F_2$.',
            `$k_Ch = ${f4(step / 1000)}$ kN; $\\tilde f = [${f4(ft[0])};\\;${f4(ft[1])}]$ kN; static modal deflections $\\tilde f_i/\\tilde k_i = ${f4(y1 * 1e6)}$ and $${f4(y2 * 1e6)}$ µm.`,
            `$\\omega_1 = \\sqrt{${t4(D[0])}} = $ **${f4(w1)} rad/s** ($\\omega_2 = ${f4(Math.sqrt(D[1]))}$ rad/s). $x_1 = ${P[0][0]}(${f4(y1 * 1e6)})(1-\\cos\\omega_1t) + (${P[0][1]})(${f4(y2 * 1e6)})(1-\\cos\\omega_2t)$ = **${f4(c1)}**$(1-\\cos\\omega_1t)$ + **${f4(c2)}**$(1-\\cos\\omega_2t)$ µm.`,
          ],
        };
    },
  },

  // ------------------------------------------------------------------ orthogonality
  {
    id: 'a3-orthogonality',
    title: 'Orthogonality checks, modal mass and nodes',
    summary: 'Use $A^{(i)T}MA^{(j)} = 0$ to get a second mode without solving, and $\\tilde k/\\tilde m = \\omega^2$ to check a mode.',
    tiers: [1, 2, 3],
    source: 'LA5 Eqs 5.5–5.14; checks used in Week 3 Q1/Q3 and 2021 A1.5 (worked solution)',
    cardId: 'a3-orthogonality',
    generate(rng, tier) {
      if (tier === 1) {
        const ch = niceChain(rng);
        const s = twoDof(ch.K, ch.M);
        const r1 = dp(s.r[0], 3);
        const r2 = -ch.m1 / (ch.m2 * r1);
        return {
          prompt: `A 2-DoF system has $M = \\mathrm{diag}(${ch.m1},\\;${ch.m2})$ kg. Mode 1 is $[1;\\,${r1}]$. Using orthogonality only, find mode 2’s ratio $r_2 = A_2/A_1$.`,
          givens: [
            { sym: 'M', value: `diag(${ch.m1}, ${ch.m2}) kg` },
            { sym: 'r_1', value: `${r1}` },
          ],
          parts: [
            {
              kind: 'numeric',
              id: 'r2',
              label: '$r_2$',
              answer: r2,
              unit: '',
              traps: keep(r2, [
                { value: -1 / r1, message: '$-1/r_1$ ignores the masses; it only works when $m_1 = m_2$.' },
                { value: -r1, message: 'No basis: check $m_1 + m_2r_1r_2 = 0$.' },
                { value: -ch.m2 / (ch.m1 * r1), message: 'Mass ratio inverted: $r_2 = -m_1/(m_2r_1)$.' },
              ]),
            },
          ],
          hints: [
            'M-orthogonality: $A^{(1)T}MA^{(2)} = 0$.',
            'With $A^{(i)} = [1;\\,r_i]$ and diagonal $M$: $m_1 + m_2r_1r_2 = 0 \\Rightarrow r_2 = -m_1/(m_2r_1)$.',
            `$r_2 = -${ch.m1}/(${ch.m2}\\times ${r1})$.`,
            `$r_2 = $ **${f4(r2)}** (exact eigen-solution: ${f4(s.r[1])}) — negative, so mode 2 is out of phase.`,
          ],
        };
      }
      if (tier === 3) {
        const m = rng.step(800, 3000, 50);
        const rho = rng.step(0.8, 1.3, 0.05);
        const I = sig(m * rho * rho, 3);
        const xi1 = rng.step(1.5, 6, 0.1);
        const xi2 = -I / (m * xi1);
        return {
          prompt: `A vehicle (mass $m$ = ${m} kg, pitch inertia $I_G$ = ${I} kg m² about its centre of mass G) bounces ($z$) and pitches ($\\theta$) on its suspension; a point $\\xi$ ahead of G moves $z + \\xi\\theta$, and $M = \\mathrm{diag}(m, I_G)$. Its bounce-dominated mode has a node ${xi1} m ahead of G. Without solving the eigenproblem, locate the node of the other mode.`,
          givens: [
            { sym: 'm', value: `${m} kg` },
            { sym: 'I_G', value: `${I} kg m²` },
            { sym: '\\xi_1', value: `${xi1} m`, label: 'node of mode 1, ahead of G' },
          ],
          parts: [
            {
              kind: 'numeric',
              id: 'xi2',
              label: 'Node of the other mode, $\\xi_2$ (positive ahead of G)',
              answer: xi2,
              unit: 'm',
              traps: keep(xi2, [
                { value: -(m * xi1) / I, message: 'Inverted: orthogonality gives $\\xi_1\\xi_2 = -I_G/m$, so $\\xi_2 = -I_G/(m\\xi_1)$.' },
                { value: -Math.sqrt(I / m) / xi1, message: 'Use $I_G/m = \\rho^2$, not $\\rho$.', trapId: 'sqrt' },
              ]),
            },
            {
              kind: 'choice',
              id: 'which',
              label: 'Which description fits the second mode?',
              options: [
                { text: 'Pitch-dominated: its node lies close to G, on the other side from mode 1’s node.', correct: true, why: `$|\\xi_2| = ${f3(Math.abs(xi2))}$ m is smaller than the radius of gyration ${f3(rho)} m, so the body mostly rotates about a point near G.` },
                { text: 'Bounce-dominated: its node lies far from G on the same side as mode 1’s node.', correct: false, why: 'The nodes must lie on opposite sides ($\\xi_1\\xi_2 < 0$), and the second is near G.' },
                { text: 'Pure pitch about G.', correct: false, why: 'Pure pitch would need a node exactly at G ($\\xi = 0$), which only happens when bounce and pitch are uncoupled.' },
              ],
            },
          ],
          hints: [
            'Node of mode $i$: $Z_i + \\xi_i\\Theta_i = 0$, so $\\xi_i = -Z_i/\\Theta_i$. Mass orthogonality links the two modes.',
            '$mZ_1Z_2 + I_G\\Theta_1\\Theta_2 = 0 \\Rightarrow (Z_1/\\Theta_1)(Z_2/\\Theta_2) = -I_G/m \\Rightarrow \\xi_1\\xi_2 = -I_G/m = -\\rho^2$.',
            `$I_G/m = ${I}/${m} = ${f4(I / m)}$ m².`,
            `$\\xi_2 = -${f4(I / m)}/${xi1} = $ **${f4(xi2)} m** (behind G), close to G: the second mode is pitch-dominated.`,
          ],
        };
      }
      const ch = niceChain(rng);
      const s = twoDof(ch.K, ch.M);
      const r1 = sig(s.r[0], 4);
      const r2 = sig(s.r[1], 4);
      const A1 = [1, r1];
      const A2 = [1, r2];
      const m1t = quad(A1, ch.M, A1);
      const m2t = quad(A2, ch.M, A2);
      const k1t = quad(A1, ch.K, A1);
      const w1 = Math.sqrt(k1t / m1t);
      return {
        prompt: `A chain has $M = \\mathrm{diag}(${ch.m1},\\;${ch.m2})$ kg and $K = ${bm(ch.K)}$ N/m. Its modal matrix is $P = \\begin{bmatrix} 1 & 1 \\\\ ${r1} & ${r2} \\end{bmatrix}$.`,
        givens: [
          { sym: 'M', value: `diag(${ch.m1}, ${ch.m2}) kg` },
          { sym: 'K', value: `[${ch.K[0][0]}, ${ch.K[0][1]}; ${ch.K[1][0]}, ${ch.K[1][1]}] N/m` },
          { sym: 'P', value: `[1, 1; ${r1}, ${r2}]` },
        ],
        parts: [
          { kind: 'numeric', id: 'm1', label: 'Modal mass $\\tilde m_{11}$', answer: m1t, unit: 'kg', traps: keep(m1t, [{ value: ch.m1 + ch.m2 * r1, message: 'The modal mass is a quadratic form: $\\tilde m_{11} = m_1 + m_2r_1^2$.' }, { value: ch.m1 + ch.m2, message: 'Weight each mass by its mode entry squared: $m_1(1)^2 + m_2r_1^2$.' }]) },
          { kind: 'numeric', id: 'm2', label: 'Modal mass $\\tilde m_{22}$', answer: m2t, unit: 'kg', traps: keep(m2t, [{ value: ch.m1 + ch.m2 * r2, message: '$\\tilde m_{22} = m_1 + m_2r_2^2$ (square the entry).' }]) },
          { kind: 'numeric', id: 'w1', label: '$\\omega_1$ from the modal stiffness and mass', answer: w1, unit: 'rad/s', freq: true },
        ],
        hints: [
          'Orthogonality makes $P^TMP$ and $P^TKP$ diagonal; the diagonal entries are the modal masses and stiffnesses, and $\\omega_i^2 = \\tilde k_{ii}/\\tilde m_{ii}$.',
          '$\\tilde m_{ii} = A^{(i)T}MA^{(i)} = m_1 + m_2r_i^2$; $\\tilde k_{ii} = A^{(i)T}KA^{(i)} = k_{11} + 2k_{12}r_i + k_{22}r_i^2$.',
          `$\\tilde m_{11} = ${ch.m1} + ${ch.m2}(${r1})^2$; $\\tilde k_{11} = ${ch.K[0][0]} + 2(${ch.K[0][1]})(${r1}) + ${ch.K[1][1]}(${r1})^2 = ${f4(k1t)}$ N/m.`,
          `$\\tilde m_{11} = $ **${f4(m1t)} kg**, $\\tilde m_{22} = $ **${f4(m2t)} kg**; $\\omega_1 = \\sqrt{${f4(k1t)}/${f4(m1t)}} = $ **${f4(w1)} rad/s** (eigen-solution: ${f4(s.omega[0])}). Off-diagonal check: $A^{(1)T}MA^{(2)} = ${f4(quad(A1, ch.M, A2))} \\approx 0$ ✓.`,
        ],
      };
    },
  },
];

// Re-exported for the self-tests.
export { det2 };
