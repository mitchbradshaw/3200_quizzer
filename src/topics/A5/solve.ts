// A5 problem generators. Numbers are randomised within the ranges the papers use; the hints walk
// concept -> set-up -> substitution -> worked solution with this instance's numbers.
import type { ChoicePart, SolveGenerator, SolvePart } from '../../engine/types';
import type { Rng } from '../../engine/rng';
import { fmt, tex } from '../../engine/format';
import { inclinedMount, planarK, type Mount } from '../../physics/rigidbody';
import { bouncePitchModes } from './physics';
import { BoxFig, CabinetFig, MachineFig, RangehoodFig, VMountFig, VMountOneFig, bouncePitchFig, mountsFigure } from './figures';

const TAU = 2 * Math.PI;
const DEG = Math.PI / 180;
const f3 = (x: number) => fmt(x, 3);
const f4 = (x: number) => fmt(x, 4);
/** Number for use inside $…$ (ASCII minus, \times 10^n). */
const t4 = (x: number) => tex(x, 4);
const hz = (w: number) => w / TAU;
const toRpm = (w: number) => (w * 60) / TAU;
const r3 = (x: number) => Number(x.toPrecision(3));
const r2 = (x: number) => Number(x.toPrecision(2));
/** A number in a TeX expression, bracketed when negative or in ×10ⁿ form: a/(4.1 × 10^{5}) is not read as (a/4.1) × 10^{5}. */
const par = (x: number) => {
  const s = t4(x);
  return x < 0 || s.includes('\\times') ? `(${s})` : s;
};
/** A factor in a product, always bracketed: 120(0.2), 30(−0.4) (never "1200.2"). */
const br = (x: number) => `(${t4(x)})`;

type Trap = { value: number; message: string; trapId?: string };
type MTrap = { value: number[][]; message: string; trapId?: string };

/** Keep traps more than `gap` (relative) from the answer and from each other: a wrong method that lands within a few % of the answer cannot be told apart from it. */
export function far(answer: number, traps: Trap[], gap = 0.03): Trap[] {
  const out: Trap[] = [];
  for (const t of traps) {
    if (!Number.isFinite(t.value)) continue;
    if (Math.abs(t.value - answer) <= gap * Math.max(Math.abs(answer), 1e-12)) continue;
    if (out.some((o) => Math.abs(o.value - t.value) <= 0.02 * Math.max(Math.abs(t.value), 1e-12))) continue;
    out.push(t);
  }
  return out;
}

const maxAbs = (A: number[][]) => A.reduce((m, r) => Math.max(m, ...r.map(Math.abs)), 0) || 1;

/** Matrix traps that differ from the answer by more than `gap` × max|entry| somewhere. */
export function farM(answer: number[][], traps: MTrap[], gap = 0.03): MTrap[] {
  const s = maxAbs(answer);
  return traps.filter((t) => t.value.some((row, i) => row.some((x, j) => Math.abs(x - answer[i][j]) > gap * s)));
}

/** Matrix as TeX. */
function mtex(A: number[][], sig = 4): string {
  return `\\begin{bmatrix} ${A.map((r) => r.map((x) => (Math.abs(x) < 1e-12 * maxAbs(A) ? '0' : tex(x, sig))).join(' & ')).join(' \\\\ ')} \\end{bmatrix}`;
}
const sc = (A: number[][], s: number) => A.map((r) => r.map((x) => x * s));
const clone = (A: number[][]) => A.map((r) => r.slice());
const XYT = ['$x$', '$y$', '$\\theta$'];

/** Coupled 2 x 2 natural frequencies (rad/s) of K = [[k11, k12], [k12, k22]], M = diag(m1, m2). */
function pair(k11: number, k12: number, k22: number, m1: number, m2: number): [number, number] {
  const A = m1 * m2;
  const B = -(k11 * m2 + k22 * m1);
  const C = k11 * k22 - k12 * k12;
  const disc = Math.sqrt(Math.max(0, B * B - 4 * A * C));
  return [Math.sqrt((-B - disc) / (2 * A)), Math.sqrt((-B + disc) / (2 * A))];
}

/** Pick a step value different from `avoid`. */
function stepNot(rng: Rng, a: number, b: number, s: number, avoid: number): number {
  for (let i = 0; i < 12; i++) {
    const v = rng.step(a, b, s);
    if (Math.abs(v - avoid) > s / 2) return v;
  }
  return Number((avoid + (avoid + s <= b ? s : -s)).toPrecision(12));
}

const nz = (v: number, ref: number) => Math.abs(v) > 1e-9 * Math.max(1, Math.abs(ref));

/** Multi-select "which off-diagonal terms are non-zero?" part. */
function nonzeroPart(Kxy: number, Kxt: number, Kyt: number, ref: number, why: { xy: string; xt: string; yt: string }): ChoicePart {
  const a = nz(Kxy, ref);
  const b = nz(Kxt, ref);
  const c = nz(Kyt, ref);
  return {
    kind: 'choice',
    id: 'nonzero',
    multi: true,
    label: 'Which off-diagonal stiffness terms are non-zero? (Select all that apply.)',
    options: [
      { text: '$K_{xy}$ (sway–bounce)', correct: a, why: why.xy },
      { text: '$K_{x\\theta}$ (sway–rock)', correct: b, why: why.xt },
      { text: '$K_{y\\theta}$ (bounce–rock)', correct: c, why: why.yt },
      { text: 'None: $K$ is diagonal', correct: !a && !b && !c, why: !a && !b && !c ? 'All three vanish: sway, bounce and rock are independent single-DoF motions.' : 'At least one off-diagonal term is non-zero (see the other options).' },
    ],
  };
}

export const generators: SolveGenerator[] = [
  // ------------------------------------------------------------------ K and M from a mount table
  {
    id: 'a5-k-table',
    title: 'K and M from a mount table',
    summary: 'Tabulate each mount’s position from G, apply $\\Delta x = x - y_i\\theta$, $\\Delta y = y + x_i\\theta$, and read off $K$ (and $M$).',
    tiers: [1, 2, 3],
    source: 'Similar to official 2017 A2(a)–(b), 2022 A1.4, 2024 A2.2; summary notes A5; LA7 Eq 7.11 (inclined mounts)',
    cardId: 'a5-k',
    marks: 6,
    generate(rng, tier) {
      if (tier === 1) {
        const a = rng.step(0.2, 0.6, 0.05);
        const b = rng.step(0.4, 1.2, 0.1);
        const c = stepNot(rng, 0.4, 1.2, 0.1, b);
        const kx = rng.step(40, 200, 10);
        const ky = rng.step(100, 400, 20);
        const Kxt = 2 * kx * a;
        const Kyt = ky * (c - b);
        const Ktt = 2 * kx * a * a + ky * (b * b + c * c);
        return {
          prompt: `A machine stands on two isolator mounts a height $a$ = ${a} m below its centre of mass G. The left mount is $b$ = ${b} m to the left of G and the right mount $c$ = ${c} m to the right. **Each** mount has horizontal stiffness $k_x$ = ${kx} kN/m and vertical stiffness $k_y$ = ${ky} kN/m. Use coordinates at G: sway $x$, bounce $y$, rock θ anticlockwise.`,
          figure: MachineFig,
          givens: [
            { sym: 'a', value: `${a} m`, label: 'height of G above the mounts' },
            { sym: 'b', value: `${b} m`, label: 'left mount to G' },
            { sym: 'c', value: `${c} m`, label: 'G to right mount' },
            { sym: 'k_x', value: `${kx} kN/m`, label: 'per mount' },
            { sym: 'k_y', value: `${ky} kN/m`, label: 'per mount' },
          ],
          parts: [
            {
              kind: 'numeric',
              id: 'kxt',
              label: '$K_{x\\theta}$, the (1, 3) entry of $K$',
              answer: Kxt,
              unit: 'kN/rad',
              traps: far(Kxt, [
                { value: -Kxt, message: 'Sign: $K_{x\\theta} = -\\sum k_{x,i}y_i$ and both mounts are **below** G ($y_i = -a$), so it is $+2k_xa$ for anticlockwise θ.', trapId: 'sign' },
                { value: kx * a, message: 'Both mounts shear by $x + a\\theta$, so the term is $2k_xa$, not $k_xa$.', trapId: 'factor2' },
              ]),
            },
            {
              kind: 'numeric',
              id: 'kyt',
              label: '$K_{y\\theta}$, the (2, 3) entry of $K$',
              answer: Kyt,
              unit: 'kN/rad',
              traps: far(Kyt, [
                { value: -Kyt, message: 'Sign: the left mount sits at $x_i = -b$, so $K_{y\\theta} = \\sum k_yx_i = k_y(c - b)$.', trapId: 'sign' },
                { value: ky * (b + c), message: 'Use the signed positions: $x_i = -b$ for the left mount. The moments of the two springs partly cancel.', trapId: 'lever-arm' },
              ]),
            },
            {
              kind: 'numeric',
              id: 'ktt',
              label: '$K_{\\theta\\theta}$, the (3, 3) entry of $K$',
              answer: Ktt,
              unit: 'kN m/rad',
              traps: far(Ktt, [
                { value: ky * (b * b + c * c), message: 'You left out the shear term $2k_xa^2$: rocking also shears the mounts, by $a\\theta$ each.', trapId: 'lever-arm' },
                { value: 2 * kx * a * a, message: 'You left out the vertical springs’ rocking stiffness $k_y(b^2 + c^2)$.' },
                { value: kx * a * a + ky * (b * b + c * c), message: 'Both mounts shear: the term is $2k_xa^2$.', trapId: 'factor2' },
              ]),
            },
          ],
          hints: [
            'Each mount deflects by the motion of G plus the rotation times its lever arm: $\\Delta x_i = x - y_i\\theta$, $\\Delta y_i = y + x_i\\theta$. Write $V = \\tfrac12\\sum k\\Delta^2$ and read the entries from $V = \\tfrac12 q^TKq$.',
            `Positions from G: left $(-b, -a)$, right $(c, -a)$. So $V = 2\\cdot\\tfrac12k_x(x + a\\theta)^2 + \\tfrac12k_y(y - b\\theta)^2 + \\tfrac12k_y(y + c\\theta)^2$, giving $K_{x\\theta} = 2k_xa$, $K_{y\\theta} = k_y(c - b)$ and $K_{\\theta\\theta} = 2k_xa^2 + k_y(b^2 + c^2)$.`,
            `$K_{x\\theta} = 2 \\times ${kx} \\times ${a}$; $K_{y\\theta} = ${ky}\\,(${c} - ${b})$; $K_{\\theta\\theta} = 2 \\times ${kx} \\times ${a}^2 + ${ky}\\,(${b}^2 + ${c}^2)$.`,
            `$K_{x\\theta}$ = **${f4(Kxt)} kN/rad**; $K_{y\\theta}$ = **${f4(Kyt)} kN/rad**${Kyt < 0 ? ' (negative: the vertical stiffness is centred left of G, so a bounce up tips the body anticlockwise)' : ''}; $K_{\\theta\\theta} = ${t4(2 * kx * a * a)} + ${t4(ky * (b * b + c * c))}$ = **${f4(Ktt)} kN m/rad**. All three motions are coupled because $a \\ne 0$ and $b \\ne c$.`,
          ],
        };
      }
      if (tier === 2) {
        const w = rng.step(1.0, 2.4, 0.2);
        const h = rng.step(0.6, 1.6, 0.2);
        const m = rng.step(200, 1500, 50);
        const x2 = rng.step(0.1, Number((w / 2 - 0.1).toFixed(2)), 0.1);
        const y3 = rng.step(Number((-h / 2 + 0.1).toFixed(2)), Number((h / 2 - 0.1).toFixed(2)), 0.1);
        const ms: Mount[] = [
          { x: -w / 2, y: -h / 2, kx: rng.step(20, 120, 10), ky: rng.step(50, 250, 10) },
          { x: x2, y: -h / 2, kx: rng.step(20, 120, 10), ky: rng.step(50, 250, 10) },
          { x: w / 2, y: y3, kx: rng.step(20, 120, 10), ky: rng.chance(0.5) ? 0 : rng.step(50, 250, 10) },
        ].map((q) => ({ ...q, x: Number(q.x.toFixed(2)), y: Number(q.y.toFixed(2)) }));
        const I = (m * (w * w + h * h)) / 12;
        const K = planarK(ms);
        const M = [
          [m, 0, 0],
          [0, m, 0],
          [0, 0, I],
        ];
        const Kflip = clone(K);
        Kflip[0][2] = Kflip[2][0] = -K[0][2];
        const Ksplit = K.map((r, i) => r.map((x, j) => (i === j ? x : 0)));
        const Knoshear = clone(K);
        Knoshear[2][2] = ms.reduce((t, q) => t + q.ky * q.x * q.x, 0);
        const sKx = ms.map((q) => `${q.kx}`).join(' + ');
        const sKy = ms.map((q) => `${q.ky}`).join(' + ');
        const sKxt = ms.map((q) => `${q.kx}${br(q.y)}`).join(' + ');
        const sKyt = ms.map((q) => `${q.ky}${br(q.x)}`).join(' + ');
        const sKtt = ms.map((q) => `${q.kx}${br(q.y)}^2 + ${q.ky}${br(q.x)}^2`).join(' + ');
        const parts: SolvePart[] = [
          {
            kind: 'numeric',
            id: 'I',
            label: 'Moment of inertia about G, $I_G$',
            answer: I,
            unit: 'kg m²',
            traps: far(I, [
              { value: (m * (w * w + h * h)) / 3, message: '$m(w^2+h^2)/3$ is about a corner. Coordinates at G need $I_G = m(w^2+h^2)/12$.', trapId: 'parallel-axis' },
              { value: (m * w * w) / 12, message: 'Use both side lengths of the face: $I_G = m(w^2 + h^2)/12$.' },
              { value: I + m * (h / 2) ** 2, message: 'That is about the middle of the base. The coordinates are at G, so no parallel-axis term.', trapId: 'parallel-axis' },
            ]),
          },
          {
            kind: 'matrix',
            id: 'M',
            label: 'Mass matrix $M$ for $q = [x,\\ y,\\ \\theta]^T$',
            answer: M,
            rowLabels: XYT,
            colLabels: XYT,
            unit: 'kg, kg m²',
            traps: farM(M, [{ value: [M[0], M[1], [0, 0, I + m * (h / 2) ** 2]], message: 'Coordinates at G: $M = \\mathrm{diag}(m, m, I_G)$, with no parallel-axis term.', trapId: 'parallel-axis' }]),
          },
          {
            kind: 'matrix',
            id: 'K',
            label: 'Stiffness matrix $K$ (kN/m, kN/rad, kN m/rad)',
            answer: K,
            rowLabels: XYT,
            colLabels: XYT,
            unit: 'kN/m, kN/rad, kN m/rad',
            tol: 0.005,
            traps: farM(K, [
              { value: Kflip, message: 'Check the sign of $K_{x\\theta} = -\\sum k_{x,i}y_i$: a mount below G ($y_i < 0$) contributes $+k_x|y_i|$.', trapId: 'sign' },
              { value: Ksplit, message: 'You lost the cross terms. Each spring stores $\\tfrac12k(\\text{total deflection})^2$; the cross terms are the coupling (official 2017 A2).', trapId: 'lever-arm' },
              { value: Knoshear, message: '$K_{\\theta\\theta}$ needs both $\\sum k_{x,i}y_i^2$ and $\\sum k_{y,i}x_i^2$.', trapId: 'lever-arm' },
            ]),
          },
        ];
        return {
          prompt: `A uniform block, $w$ = ${w} m wide and $h$ = ${h} m high, with mass $m$ = ${m} kg, is held by three mounts at the positions below (measured from G at the block’s centre). Each mount has a horizontal stiffness $k_x$ and a vertical stiffness $k_y$, in kN/m. Use coordinates at G: sway $x$, bounce $y$, rock θ anticlockwise.`,
          figure: mountsFigure(w, h, ms),
          givens: [
            { sym: 'm', value: `${m} kg` },
            { sym: 'w \\times h', value: `${w} m × ${h} m` },
            ...ms.map((q, i) => ({ sym: `\\text{mount } ${i + 1}`, value: `(${f3(q.x)}, ${f3(q.y)}) m`, label: `horizontal ${q.kx}, vertical ${q.ky} kN/m` })),
          ],
          parts,
          hints: [
            'Coordinates at G give $M = \\mathrm{diag}(m, m, I_G)$ with $I_G = m(w^2+h^2)/12$. Each mount adds $k_x\\,a_ia_i^T + k_y\\,b_ib_i^T$ to $K$, where $a_i = [1, 0, -y_i]^T$ and $b_i = [0, 1, x_i]^T$ (from $\\Delta x = x - y_i\\theta$, $\\Delta y = y + x_i\\theta$).',
            '$K_{xx} = \\sum k_x$, $K_{yy} = \\sum k_y$, $K_{xy} = 0$ (upright mounts), $K_{x\\theta} = -\\sum k_xy_i$, $K_{y\\theta} = \\sum k_yx_i$, $K_{\\theta\\theta} = \\sum (k_xy_i^2 + k_yx_i^2)$.',
            `$I_G = ${m}(${w}^2 + ${h}^2)/12$; $\\sum k_x = ${sKx}$; $\\sum k_y = ${sKy}$; $-\\sum k_xy_i = -[${sKxt}]$; $\\sum k_yx_i = ${sKyt}$; $K_{\\theta\\theta} = ${sKtt}$.`,
            `$I_G$ = **${f4(I)} kg m²**, so $M = ${mtex(M)}$ and **$K = ${mtex(K)}$** (kN/m, kN/rad, kN m/rad). ${nz(K[0][2], K[0][0]) ? 'The nonzero $K_{x\\theta}$ couples sway and rock' : 'Sway and rock are decoupled'}${nz(K[1][2], K[1][1]) ? '; the nonzero $K_{y\\theta}$ couples bounce and rock.' : '; bounce is decoupled.'}`,
          ],
        };
      }
      // tier 3: a symmetric pair of inclined ('V') mounts, LA7 Eq 7.11
      const l = rng.step(0.4, 1.0, 0.1);
      const h = rng.step(0.2, 0.6, 0.05);
      const k1 = rng.step(100, 400, 20);
      const k2 = r3(k1 * rng.pick([0.25, 0.3, 0.4, 0.5]));
      const phiDeg = rng.pick([15, 20, 25, 30, 35, 40]);
      const phi = phiDeg * DEG;
      const R = inclinedMount(l, -h, k1, k2, Math.PI / 2 + phi);
      const L = inclinedMount(-l, -h, k1, k2, Math.PI / 2 - phi);
      const K = planarK([L, R]);
      const Kup = planarK([
        { x: -l, y: -h, kx: k2, ky: k1 },
        { x: l, y: -h, kx: k2, ky: k1 },
      ]);
      const KnoXY = planarK([
        { ...L, kxy: 0 },
        { ...R, kxy: 0 },
      ]);
      const s = Math.sin(phi);
      const c = Math.cos(phi);
      const wrongKx = k1 * c * c + k2 * s * s;
      return {
        prompt: `A machine sits on two identical rubber mounts at $(\\pm l, -h)$ from its centre of mass G, with $l$ = ${l} m and $h$ = ${h} m. Each mount has stiffness $k_1$ = ${k1} kN/m along its own axis and $k_2$ = ${k2} kN/m across it. The axes are tilted φ = ${phiDeg}° from the vertical, leaning **inwards** (the top of each mount is nearer G’s vertical line than its base). Coordinates at G: sway $x$, bounce $y$, rock θ anticlockwise.`,
        figure: VMountFig,
        givens: [
          { sym: 'l', value: `${l} m` },
          { sym: 'h', value: `${h} m`, label: 'G above the mounts' },
          { sym: 'k_1', value: `${k1} kN/m`, label: 'along the mount axis' },
          { sym: 'k_2', value: `${k2} kN/m`, label: 'across the mount axis' },
          { sym: '\\varphi', value: `${phiDeg}°`, label: 'tilt from vertical' },
        ],
        parts: [
          {
            kind: 'numeric',
            id: 'kx',
            label: 'Horizontal stiffness $k_x$ of the **right** mount',
            answer: R.kx,
            unit: 'kN/m',
            traps: far(R.kx, [
              { value: wrongKx, message: 'The axis is φ from the **vertical**, i.e. at $90° + \\varphi$ from $x$: $k_x = k_1\\sin^2\\varphi + k_2\\cos^2\\varphi$.' },
              { value: k2, message: 'That treats the mount as upright. Resolve it with LA7 Eq 7.11.' },
            ]),
          },
          {
            kind: 'numeric',
            id: 'kxy',
            label: 'Cross stiffness $k_{xy}$ of the **right** mount (sign matters)',
            answer: R.kxy ?? 0,
            unit: 'kN/m',
            traps: far(R.kxy ?? 0, [
              { value: -(R.kxy ?? 0), message: 'Sign: the right mount’s axis points up and to the **left** (angle $90° + \\varphi$ from $x$), so $k_{xy} = (k_1 - k_2)\\sin\\beta\\cos\\beta < 0$.', trapId: 'sign' },
            ]),
          },
          {
            kind: 'matrix',
            id: 'K',
            label: 'Stiffness matrix $K$ of the pair (kN/m, kN/rad, kN m/rad)',
            answer: K,
            rowLabels: XYT,
            colLabels: XYT,
            unit: 'kN/m, kN/rad, kN m/rad',
            tol: 0.005,
            traps: farM(K, [
              { value: Kup, message: 'You treated the mounts as upright ($k_x = k_2$, $k_y = k_1$). Rotate each mount’s stiffness with Eq 7.11 first.' },
              { value: KnoXY, message: 'You rotated $k_x$ and $k_y$ but dropped $k_{xy}$. Although the two $k_{xy}$ cancel in $K_{xy}$, they add $k_{xy}x_i$ to $K_{x\\theta}$ and $-2k_{xy}x_iy_i$ to $K_{\\theta\\theta}$.', trapId: 'lever-arm' },
            ]),
          },
        ],
        hints: [
          'An inclined mount with principal stiffnesses $k_1$ (along its axis, at angle β from $x$) and $k_2$ (across) has $k_x = k_1\\cos^2\\beta + k_2\\sin^2\\beta$, $k_y = k_1\\sin^2\\beta + k_2\\cos^2\\beta$, $k_{xy} = (k_1 - k_2)\\sin\\beta\\cos\\beta$ (LA7 Eq 7.11). Then add each mount to $K$ as usual, including the $k_{xy}$ terms.',
          `Right mount: β = 90° + ${phiDeg}°; left mount: β = 90° − ${phiDeg}°. Per mount: $K_{xy} \\mathrel{+}= k_{xy}$, $K_{x\\theta} \\mathrel{+}= -k_xy_i + k_{xy}x_i$, $K_{y\\theta} \\mathrel{+}= k_yx_i - k_{xy}y_i$, $K_{\\theta\\theta} \\mathrel{+}= k_xy_i^2 + k_yx_i^2 - 2k_{xy}x_iy_i$.`,
          `$\\sin\\varphi = ${t4(s)}$, $\\cos\\varphi = ${t4(c)}$. Right mount: $k_x = ${k1}(${t4(s)})^2 + ${k2}(${t4(c)})^2 = ${t4(R.kx)}$, $k_y = ${t4(R.ky)}$, $k_{xy} = -(${k1} - ${k2})(${t4(s)})(${t4(c)}) = ${t4(R.kxy ?? 0)}$ kN/m. The left mount mirrors it with $k_{xy} = ${t4(L.kxy ?? 0)}$.`,
          `$k_x$ = **${f4(R.kx)} kN/m**, $k_{xy}$ = **${f4(R.kxy ?? 0)} kN/m**, and **$K = ${mtex(K)}$**. $K_{xy}$ cancels by symmetry, but the tilt ${K[0][2] < 2 * k2 * h ? 'reduced' : 'increased'} $K_{x\\theta}$ from $2k_2h$ = ${f4(2 * k2 * h)} kN/rad (upright mounts) to ${f4(K[0][2])} kN/rad. A suitable tilt can cancel the sway–rock coupling altogether: inclined isolators are one way to decouple rocking from sway (LA7 §7.4).`,
        ],
      };
    },
  },

  // ------------------------------------------------------------------ coupling and decoupling
  {
    id: 'a5-coupling',
    title: 'Which motions couple, and how to decouple them',
    summary: 'Point to each non-zero off-diagonal term, name its cause, and choose the geometric change that removes it.',
    tiers: [1, 2, 3],
    source: 'Similar to official 2017 A2(c)–(d), 2022 A1.5, 2024 A2.3 and A2.5; official 2018 A1.3(b)',
    cardId: 'a5-coupling',
    marks: 4,
    generate(rng, tier) {
      const kind = tier === 3 ? rng.pick(['box5', 'incline'] as const) : rng.pick(['machine', 'cabinet'] as const);
      if (kind === 'machine') {
        const a = rng.pick([0, 0.2, 0.25, 0.3, 0.4]);
        const b = rng.step(0.5, 1.0, 0.1);
        const c = rng.chance(0.35) ? b : stepNot(rng, 0.5, 1.0, 0.1, b);
        const kx = rng.step(40, 200, 10);
        const ky = rng.step(100, 400, 20);
        const Kxt = 2 * kx * a;
        const Kyt = ky * (c - b);
        const parts: SolvePart[] = [
          nonzeroPart(0, Kxt, Kyt, kx + ky, {
            xy: 'Upright springs give no $K_{xy}$: a vertical spring does not resist horizontal motion, and vice versa.',
            xt: a ? `$K_{x\\theta} = 2k_xa = 2 \\times ${kx} \\times ${a}$ = ${f4(Kxt)} kN/rad: the springs shear ${a} m below G.` : '$a = 0$: the horizontal springs act at the height of G, so $K_{x\\theta} = 2k_xa = 0$.',
            yt: b !== c ? `$K_{y\\theta} = k_y(c - b) = ${ky}(${c} - ${b})$ = ${f4(Kyt)} kN/rad: the vertical stiffness is not centred under G.` : '$b = c$: the vertical springs are symmetric about G, so $K_{y\\theta} = 0$.',
          }),
        ];
        let decoupleTxt = '';
        if (tier >= 2) {
          if (a && b !== c) {
            parts.push({
              kind: 'choice',
              id: 'fix',
              label: 'What is the smallest set of geometric changes that makes all three motions independent?',
              options: [
                { text: 'Raise the horizontal springs to G’s height ($a = 0$) **and** make $b = c$.', correct: true, why: 'Each change removes one term: $a = 0$ kills $2k_xa$, $b = c$ kills $k_y(c - b)$ (official 2017 A2(d)).' },
                { text: 'Raise the horizontal springs to G’s height ($a = 0$) only.', correct: false, why: `$K_{y\\theta} = ${t4(Kyt)}$ kN/rad remains.` },
                { text: 'Make $b = c$ only.', correct: false, why: `$K_{x\\theta} = ${t4(Kxt)}$ kN/rad remains.` },
                { text: 'Make $k_x = k_y$.', correct: false, why: 'Stiffness values scale the terms; only geometry (or stiffness ratios matching lever arms) removes them.' },
              ],
            });
            decoupleTxt = 'To decouple everything, set $a = 0$ and $b = c$: then $\\omega_x^2 = 2k_x/m$, $\\omega_y^2 = 2k_y/m$, $\\omega_\\theta^2 = 2k_yb^2/I$.';
          } else if (a) {
            parts.push({
              kind: 'choice',
              id: 'fix',
              label: 'Which single change decouples sway?',
              options: [
                { text: 'Raise the horizontal springs to the height of G ($a = 0$).', correct: true, why: 'Then the horizontal spring force passes through G and $K_{x\\theta} = 2k_xa = 0$; sway has $\\omega^2 = 2k_x/m$ (official 2017 A2(c)).' },
                { text: 'Make $b = c$.', correct: false, why: 'It already is; that only removes $K_{y\\theta}$.' },
                { text: 'Double $k_x$.', correct: false, why: '$K_{x\\theta} = 2k_xa$ doubles too.' },
                { text: 'Move the springs further apart.', correct: false, why: 'That raises the rocking stiffness, but $K_{x\\theta} = 2k_xa$ does not depend on $b$ or $c$.' },
              ],
            });
            decoupleTxt = 'Raising the horizontal springs to G’s height ($a = 0$) decouples sway: $\\omega_x^2 = 2k_x/m$.';
          } else if (b !== c) {
            parts.push({
              kind: 'choice',
              id: 'fix',
              label: 'Sway is already decoupled. Which change also separates bounce from rock?',
              options: [
                { text: `Make $b = c$ (or, keeping the positions, choose stiffnesses with $k_{y,L}b = k_{y,R}c$).`, correct: true, why: 'Either way $\\sum k_yx_i = 0$: the vertical stiffness is centred under G.' },
                { text: 'Lower the springs below G.', correct: false, why: 'That would re-couple sway and rock ($a \\ne 0$).' },
                { text: 'Stiffen both vertical springs equally.', correct: false, why: `$K_{y\\theta} = k_y(c - b)$ just scales up.` },
                { text: 'Nothing: bounce and rock can never be separated.', correct: false, why: 'They separate when the vertical stiffness centre lies under G.' },
              ],
            });
            decoupleTxt = 'Making $b = c$ removes $K_{y\\theta}$ as well, leaving three independent motions.';
          } else {
            parts.push({
              kind: 'choice',
              id: 'fix',
              label: 'With $a = 0$ and $b = c$, how do you find the natural frequencies?',
              options: [
                { text: 'Directly as $K_{ii}/M_{ii}$: $2k_x/m$, $2k_y/m$ and $2k_yb^2/I$.', correct: true, why: '$K$ and $M$ are both diagonal, so each coordinate is a separate SDOF (official 2017 A2(d)).' },
                { text: 'From a cubic in $\\omega^2$.', correct: false, why: 'No coupling, no determinant to expand.' },
                { text: 'From a quadratic for sway and rock.', correct: false, why: 'Sway and rock are decoupled because $a = 0$.' },
                { text: 'They cannot be found without damping data.', correct: false, why: 'Undamped frequencies need only $K$ and $M$.' },
              ],
            });
            decoupleTxt = 'Everything is decoupled: each frequency is a diagonal ratio.';
          }
        }
        return {
          prompt: `A machine on isolators (as in the official 2017 paper): the springs sit $a$ = ${a} m below G; the left end is $b$ = ${b} m and the right end $c$ = ${c} m from G horizontally. At each end the springs total $k_x$ = ${kx} kN/m horizontally and $k_y$ = ${ky} kN/m vertically. Coordinates at G (sway $x$, bounce $y$, rock θ anticlockwise).`,
          figure: MachineFig,
          givens: [
            { sym: 'a', value: `${a} m` },
            { sym: 'b', value: `${b} m` },
            { sym: 'c', value: `${c} m` },
            { sym: 'k_x', value: `${kx} kN/m`, label: 'per end' },
            { sym: 'k_y', value: `${ky} kN/m`, label: 'per end' },
          ],
          parts,
          hints: [
            'Coupling sits in the off-diagonal terms. With coordinates at G, $M$ is diagonal, so look only at $K$: $K_{x\\theta} = -\\sum k_xy_i$, $K_{y\\theta} = \\sum k_yx_i$, and $K_{xy} = 0$ for upright springs.',
            'Official 2017 A2(b): $K = [[2k_x, 0, 2k_xa],\\ [0, 2k_y, k_y(c - b)],\\ [2k_xa, k_y(c - b), 2k_xa^2 + k_y(b^2 + c^2)]]$.',
            `$2k_xa = 2 \\times ${kx} \\times ${a}$; $k_y(c - b) = ${ky}(${c} - ${b})$.`,
            `$K_{x\\theta}$ = **${f4(Kxt)} kN/rad**${a ? ' (sway–rock coupled)' : ' (sway decoupled)'}, $K_{y\\theta}$ = **${f4(Kyt)} kN/rad**${b !== c ? ' (bounce–rock coupled)' : ' (bounce decoupled)'}, $K_{xy}$ = **0**. ${decoupleTxt}`,
          ],
        };
      }
      if (kind === 'cabinet') {
        const a = rng.step(0.1, 0.6, 0.05);
        const b = rng.chance(0.3) ? a : stepNot(rng, 0.1, 0.6, 0.05, a);
        const c = rng.step(0.15, 0.4, 0.05);
        const kx = rng.step(10, 200, 5);
        const ky = rng.step(10, 200, 5);
        const Kxt = kx * (b - a);
        const Kyt = ky * c;
        const parts: SolvePart[] = [
          nonzeroPart(0, Kxt, Kyt, kx + ky, {
            xy: 'No inclined springs, so $K_{xy} = 0$.',
            xt: a !== b ? `$K_{x\\theta} = k_x(b - a) = ${kx}(${b} - ${a})$ = ${f4(Kxt)} kN/rad: the two horizontal anchors are at different distances from G.` : '$a = b$: the horizontal forces are balanced about G, so $K_{x\\theta} = k_x(b - a) = 0$.',
            yt: `$K_{y\\theta} = k_yc = ${ky} \\times ${c}$ = ${f4(Kyt)} kN/rad: the vertical support is on the wall, ${c} m from G.`,
          }),
        ];
        if (tier >= 2)
          parts.push({
            kind: 'choice',
            id: 'fix',
            label: 'Which degree of freedom can be decoupled by choosing the length dimensions, and how?',
            options:
              a !== b
                ? [
                    { text: 'Sway: put the horizontal anchors equidistant above and below G ($a = b$).', correct: true, why: '$K_{x\\theta} = k_x(b - a) = 0$, so $m\\ddot x + 2k_xx = 0$ (2022 A1.5).' },
                    { text: 'Bounce: make $a = b$.', correct: false, why: '$K_{y\\theta} = k_yc$ does not contain $a$ or $b$.' },
                    { text: 'Bounce: move the vertical support under G ($c = 0$).', correct: false, why: 'Mathematically yes, but the support is on the wall, at least half the depth from G: impossible here.' },
                    { text: 'None: a wall-hung cabinet is always fully coupled.', correct: false, why: 'Sway decouples when $a = b$.' },
                  ]
                : [
                    { text: 'Sway is already decoupled ($a = b$); bounce cannot be, because $K_{y\\theta} = k_yc$ with $c \\ne 0$.', correct: true, why: 'Only $K_{x\\theta}$ depends on $a$ and $b$, and it is already zero.' },
                    { text: 'Bounce, by making $a = b$.', correct: false, why: '$K_{y\\theta} = k_yc$ does not contain $a$ or $b$.' },
                    { text: 'Rock, by making $a = b$.', correct: false, why: 'Rock stays coupled with bounce through $k_yc$.' },
                    { text: 'All three, by stiffening the vertical spring.', correct: false, why: 'A stiffer $k_y$ only scales $K_{y\\theta}$.' },
                  ],
          });
        return {
          prompt: `A cabinet hangs on a wall (to its right) from two anchors. The upper anchor is a horizontal spring $k_x$ a height $a$ = ${a} m above G; the lower anchor, a depth $b$ = ${b} m below G, has a horizontal spring $k_x$ and a vertical spring $k_y$ resting on a wall bracket. Both anchors are $c$ = ${c} m from G horizontally; $k_x$ = ${kx} kN/m and $k_y$ = ${ky} kN/m. Coordinates at G: sway $x$ (towards the wall), bounce $y$, θ anticlockwise.`,
          figure: CabinetFig,
          givens: [
            { sym: 'a', value: `${a} m` },
            { sym: 'b', value: `${b} m` },
            { sym: 'c', value: `${c} m` },
            { sym: 'k_x', value: `${kx} kN/m`, label: 'each horizontal spring' },
            { sym: 'k_y', value: `${ky} kN/m` },
          ],
          parts,
          hints: [
            'Deflections from the rule $\\Delta x = x - y_i\\theta$, $\\Delta y = y + x_i\\theta$: upper $x - a\\theta$, lower $x + b\\theta$, vertical $y + c\\theta$. Coupling = non-zero off-diagonal $K$ terms (M is diagonal at G).',
            '$V = \\tfrac12k_x(x - a\\theta)^2 + \\tfrac12k_x(x + b\\theta)^2 + \\tfrac12k_y(y + c\\theta)^2$, so $K_{x\\theta} = k_x(b - a)$, $K_{y\\theta} = k_yc$, $K_{xy} = 0$.',
            `$k_x(b - a) = ${kx}(${b} - ${a})$; $k_yc = ${ky} \\times ${c}$.`,
            `$K_{x\\theta}$ = **${f4(Kxt)} kN/rad**, $K_{y\\theta}$ = **${f4(Kyt)} kN/rad**, $K_{xy}$ = **0**. ${a !== b ? 'Sway can be decoupled by making $a = b$.' : 'Sway is already decoupled.'} Bounce stays coupled with rock: $k_yc$ needs the support under G (2022 A1.5).`,
          ],
        };
      }
      if (kind === 'box5') {
        const m = rng.step(500, 5000, 100);
        const ky = rng.step(1, 10, 0.5);
        const n = rng.pick([4, 5, 6, 8, 10]);
        const kx = n * ky;
        const a = rng.step(0.5, 2.5, 0.1);
        const c = rng.step(0.3, 2.0, 0.1);
        const Kxt = 5 * kx * c;
        const Kyt = ky * a;
        return {
          prompt: `A uniform box (${2 * a} m long, ${r3(2 * c)} m high, mass ${m} kg) rests on four rubber springs at the mid-points of its bottom edges, each with $k_y$ = ${ky} MN/m and shear stiffness $k_x$ = ${n}$k_y$. A **fifth** identical spring is added under the right-hand bottom corner, at $(x, y) = (a, -c)$ with $a$ = ${a} m and $c$ = ${c} m from G. Consider in-plane sway $x$, bounce $y$ and rock θ.`,
          figure: BoxFig,
          givens: [
            { sym: 'a', value: `${a} m`, label: 'half-length' },
            { sym: 'c', value: `${c} m`, label: 'half-height' },
            { sym: 'k_y', value: `${ky} MN/m` },
            { sym: 'k_x', value: `${kx} MN/m` },
          ],
          parts: [
            nonzeroPart(0, Kxt, Kyt, kx, {
              xy: 'Every spring is upright, so $K_{xy} = 0$: sway and bounce are linked only through θ.',
              xt: `$K_{x\\theta} = 5k_xc = 5 \\times ${kx} \\times ${c}$ = ${f4(Kxt)} MN/rad: all five springs shear at the base.`,
              yt: `$K_{y\\theta} = k_ya = ${ky} \\times ${a}$ = ${f4(Kyt)} MN/rad: the fifth spring moves the vertical stiffness centre to $x = a/5$ = ${f3(a / 5)} m.`,
            }),
            {
              kind: 'choice',
              id: 'fix',
              label: 'Which statement about the five-spring box is correct?',
              options: [
                { text: 'A vertical force through G now also rotates the box, so there is no pure bounce mode.', correct: true, why: '$K_{y\\theta} \\ne 0$; with $K_{x\\theta} \\ne 0$ too, all three frequencies come from one cubic (2024 A2.5).' },
                { text: 'Bounce is still a pure mode, now at $\\sqrt{5k_y/m}$.', correct: false, why: 'Not with $K_{y\\theta} = k_ya \\ne 0$.' },
                { text: 'Sway and bounce are now coupled directly through $K_{xy}$.', correct: false, why: 'Upright springs give $K_{xy} = 0$.' },
                { text: 'Only the rocking frequency changes.', correct: false, why: '$K_{xx}$, $K_{yy}$, $K_{\\theta\\theta}$ and two off-diagonal terms all change.' },
              ],
            },
          ],
          hints: [
            'Each spring adds $\\tfrac12k_x(x + c\\theta)^2 + \\tfrac12k_y(y + x_i\\theta)^2$. A spring that is not mirrored about G leaves a net $\\sum k_yx_i$.',
            'Four mid-edge springs: $K_{x\\theta} = 4k_xc$, $K_{y\\theta} = 0$. The fifth at $(a, -c)$ adds $k_xc$ to $K_{x\\theta}$ and $k_ya$ to $K_{y\\theta}$.',
            `$K_{x\\theta} = 5 \\times ${kx} \\times ${c}$, $K_{y\\theta} = ${ky} \\times ${a}$.`,
            `Non-zero: $K_{x\\theta}$ = **${f4(Kxt)} MN/rad** and $K_{y\\theta}$ = **${f4(Kyt)} MN/rad**; $K_{xy}$ = 0. Bounce now couples with rock and, through rock, with sway: all three motions are coupled.`,
          ],
        };
      }
      // inclined right mount. Resample when the tilt's k_xy·x_i nearly cancels the shear term (or similar), so that
      // every off-diagonal term the answer calls "non-zero" is clearly non-zero (coupling coefficient ≥ 0.08).
      let l = 0;
      let h = 0;
      let k1 = 0;
      let k2 = 0;
      let phiDeg = 0;
      let Rm = inclinedMount(0, 0, 1, 1, 0);
      let K = planarK([Rm]);
      for (let i = 0; i < 30; i++) {
        l = rng.step(0.4, 1.0, 0.1);
        h = rng.step(0.2, 0.6, 0.05);
        k1 = rng.step(100, 400, 20);
        k2 = r3(k1 * rng.pick([0.25, 0.4, 0.5]));
        phiDeg = rng.pick([20, 30, 40]);
        Rm = inclinedMount(l, -h, k1, k2, Math.PI / 2 + phiDeg * DEG);
        K = planarK([{ x: -l, y: -h, kx: k2, ky: k1 }, Rm]);
        const Kc = K;
        const weak = ([[0, 1], [0, 2], [1, 2]] as const).some(([p, q]) => Math.abs(Kc[p][q]) < 0.08 * Math.sqrt(Kc[p][p] * Kc[q][q]));
        if (!weak) break;
      }
      return {
        prompt: `A machine stands on two rubber mounts at $(\\pm l, -h)$ from G ($l$ = ${l} m, $h$ = ${h} m), each with $k_1$ = ${k1} kN/m along its axis and $k_2$ = ${k2} kN/m across it. The left mount is upright; the right one is tilted φ = ${phiDeg}° from the vertical, its top leaning towards G.`,
        figure: VMountOneFig,
        givens: [
          { sym: 'l', value: `${l} m` },
          { sym: 'h', value: `${h} m` },
          { sym: 'k_1', value: `${k1} kN/m` },
          { sym: 'k_2', value: `${k2} kN/m` },
          { sym: '\\varphi', value: `${phiDeg}°`, label: 'right mount only' },
        ],
        parts: [
          nonzeroPart(K[0][1], K[0][2], K[1][2], k1, {
            xy: `$K_{xy} = k_{xy}$ of the tilted mount = ${f4(K[0][1])} kN/m (LA7 Eq 7.11).`,
            xt: `$K_{x\\theta}$ = ${f4(K[0][2])} kN/rad: both mounts shear below G, plus the tilted mount’s $k_{xy}x_i$.`,
            yt: `$K_{y\\theta}$ = ${f4(K[1][2])} kN/rad: the tilted mount is vertically softer ($k_y$ = ${f4(Rm.ky)} kN/m) and adds $-k_{xy}y_i$.`,
          }),
          {
            kind: 'choice',
            id: 'fix',
            label: 'What does tilting one mount do?',
            options: [
              { text: 'A vertical force at G now also produces sway, because $K_{xy} \\ne 0$.', correct: true, why: 'An inclined isolator couples vertical forces to horizontal motion and vice versa (official 2018 A1.3(b)).' },
              { text: 'Nothing changes: only the mount positions matter.', correct: false, why: 'The stiffness directions matter too: Eq 7.11 rotates the stiffness matrix.' },
              { text: 'It decouples everything, because tilted mounts always decouple sway and rock.', correct: false, why: 'A symmetric pair of tilted mounts can cancel $K_{x\\theta}$; one tilted mount adds coupling.' },
              { text: 'Only the rocking stiffness changes.', correct: false, why: 'All entries of the 2 × 2 mount stiffness change, so $K_{xx}$, $K_{yy}$ and all off-diagonals change.' },
            ],
          },
        ],
        hints: [
          'Resolve the tilted mount first (LA7 Eq 7.11): $k_x = k_1\\cos^2\\beta + k_2\\sin^2\\beta$, $k_y = k_1\\sin^2\\beta + k_2\\cos^2\\beta$, $k_{xy} = (k_1 - k_2)\\sin\\beta\\cos\\beta$ with β the axis angle from $x$.',
          `Here β = 90° + ${phiDeg}°. Then $K_{xy} = \\sum k_{xy}$, $K_{x\\theta} = \\sum(-k_xy_i + k_{xy}x_i)$, $K_{y\\theta} = \\sum(k_yx_i - k_{xy}y_i)$.`,
          `Tilted mount: $k_x = ${t4(Rm.kx)}$, $k_y = ${t4(Rm.ky)}$, $k_{xy} = ${t4(Rm.kxy ?? 0)}$ kN/m; upright mount: $k_x = ${k2}$, $k_y = ${k1}$.`,
          `All three are non-zero: $K_{xy}$ = **${f4(K[0][1])} kN/m**, $K_{x\\theta}$ = **${f4(K[0][2])} kN/rad**, $K_{y\\theta}$ = **${f4(K[1][2])} kN/rad**. One tilted mount couples every pair of motions.`,
        ],
      };
    },
  },

  // ------------------------------------------------------------------ bounce and pitch
  {
    id: 'a5-bounce-pitch',
    title: 'Bounce–pitch frequencies and nodes',
    summary: 'Car, minibus or pilot cabin on two springs: $K$, the coupled frequencies, node positions and the decoupling condition $k_1a = k_2b$.',
    tiers: [1, 2, 3],
    source: 'Similar to 2021 A1.5 (minibus); LA4 §4.2 car; pilot cabin 2017–19 A3.8, 2022 A3.1',
    cardId: 'a5-bounce-pitch',
    marks: 6,
    generate(rng, tier) {
      const ctx = rng.pick(['minibus', 'car', 'cabin'] as const);
      const cabin = ctx === 'cabin';
      let m = 0;
      let rho = 0;
      let a = 0;
      let b = 0;
      let k1 = 0;
      let k2 = 0;
      for (let i = 0; i < 20; i++) {
        m = cabin ? rng.step(1000, 4000, 100) : rng.step(1200, 6000, 100);
        rho = cabin ? rng.step(0.6, 1.2, 0.05) : rng.step(0.9, 1.6, 0.05);
        a = cabin ? rng.step(0.8, 1.6, 0.1) : rng.step(0.8, 2.0, 0.1);
        b = cabin ? a : rng.step(1.0, 2.5, 0.1);
        k1 = rng.step(30, 200, 5);
        k2 = rng.step(30, 200, 5);
        const K12 = k2 * b - k1 * a;
        if (Math.abs(K12) > 0.2 * Math.max(k1 * a, k2 * b)) break;
      }
      const I = r3(m * rho * rho);
      const bp = bouncePitchModes(m, I, k1 * 1e3, a, k2 * 1e3, b);
      const K = sc(bp.K, 1e-3);
      const [w1, w2] = bp.omega;
      const [n1, n2] = bp.nodes;
      const fz = hz(Math.sqrt(bp.K[0][0] / m));
      const ft = hz(Math.sqrt(bp.K[1][1] / I));
      const names = cabin ? { s1: 'isolator 1', s2: 'isolator 2', body: 'pilot cabin' } : { s1: 'front suspension', s2: 'rear suspension', body: ctx };
      const prompt = cabin
        ? `A pilot cabin of mass $m$ = ${m} kg and moment of inertia $I$ = ${I} kg m² about G rests on two isolators at equal distances $l$ = ${a} m either side of G: $k_1$ = ${k1} kN/m at $x = -l$ and $k_2$ = ${k2} kN/m at $x = +l$. Model bounce $z$ (up) and pitch θ (anticlockwise, lifting the $+x$ side).`
        : `A ${ctx} body has mass $m$ = ${m} kg and $I$ = ${I} kg m² about its centre of mass G. The front suspension ($k_1$ = ${k1} kN/m in total) is $a$ = ${a} m ahead of G and the rear ($k_2$ = ${k2} kN/m) is $b$ = ${b} m behind it. Use bounce $z$ (up) and pitch θ, and measure $x$ rearwards from G, so the front axle is at $x = -a$.`;
      const givens = [
        { sym: 'm', value: `${m} kg` },
        { sym: 'I', value: `${I} kg m²` },
        { sym: 'k_1', value: `${k1} kN/m`, label: names.s1 },
        { sym: 'k_2', value: `${k2} kN/m`, label: names.s2 },
        ...(cabin ? [{ sym: 'l', value: `${a} m` }] : [{ sym: 'a', value: `${a} m`, label: 'G to front' }, { sym: 'b', value: `${b} m`, label: 'G to rear' }]),
      ];
      const figure = bouncePitchFig(cabin ? 'cabin' : 'car');
      const Kset = `$K = [[k_1 + k_2,\\ k_2b - k_1a],\\ [k_2b - k_1a,\\ k_1a^2 + k_2b^2]]$${cabin ? ' with $a = b = l$' : ''}`;
      if (tier === 1) {
        const Ksign = clone(K);
        Ksign[0][1] = Ksign[1][0] = -K[0][1];
        const Knosq = clone(K);
        Knosq[1][1] = k1 * a + k2 * b;
        return {
          prompt,
          figure,
          givens,
          parts: [
            {
              kind: 'matrix',
              id: 'K',
              label: 'Stiffness matrix $K$ for $q = [z,\\ \\theta]^T$ (kN/m, kN/rad, kN m/rad)',
              answer: K,
              rowLabels: ['$z$', '$\\theta$'],
              colLabels: ['$z$', '$\\theta$'],
              unit: 'kN/m, kN/rad, kN m/rad',
              tol: 0.01,
              traps: farM(K, [
                { value: Ksign, message: 'Sign: the spring at $x = -a$ deflects $z - a\\theta$, so it contributes $-k_1a$; the one at $+b$ contributes $+k_2b$.', trapId: 'offdiag-sign' },
                { value: Knosq, message: '$K_{22}$ needs the squares of the lever arms: $k_1a^2 + k_2b^2$.', trapId: 'lever-arm' },
              ]),
            },
            {
              kind: 'choice',
              id: 'coupled',
              label: 'Are bounce and pitch coupled?',
              options: [
                { text: `Yes: $k_2b - k_1a = ${t4(K[0][1])} \\ne 0$, so a bounce gives a net moment about G.`, correct: true, why: 'The off-diagonal term is the moment of the spring forces about G for a unit bounce.' },
                { text: `No: the springs are on opposite sides of G.`, correct: false, why: 'Opposite sides is not enough: the moments $k_1a$ and $k_2b$ must also be equal.' },
                { text: 'No: $M$ is diagonal.', correct: false, why: 'A diagonal $M$ only reflects coordinates at G; the coupling here is elastic, in $K$.' },
                { text: 'Yes, through the mass matrix.', correct: false, why: 'With coordinates at G, $M = \\mathrm{diag}(m, I)$: there is no inertial coupling.' },
              ],
            },
          ],
          hints: [
            `Bounce $z$ and pitch θ at G: the spring at $x_i$ deflects $z + x_i\\theta$. Here ${cabin ? 'the isolators are at $\\mp l$' : 'the front is at $-a$ and the rear at $+b$'}.`,
            `$V = \\tfrac12k_1(z - a\\theta)^2 + \\tfrac12k_2(z + b\\theta)^2$, so ${Kset}; $M = \\mathrm{diag}(m, I)$.`,
            `$k_1 + k_2 = ${k1} + ${k2}$; $k_2b - k_1a = ${k2} \\times ${b} - ${k1} \\times ${a}$; $k_1a^2 + k_2b^2 = ${k1} \\times ${a}^2 + ${k2} \\times ${b}^2$.`,
            `**$K = ${mtex(K)}$** (kN/m, kN/rad, kN m/rad). $K_{12}$ = ${f4(K[0][1])} kN/rad ≠ 0, so bounce and pitch are coupled${cabin ? ': unequal isolators at equal distances still couple (2022 A3.1)' : ''}. Decoupling would need $k_1a = k_2b$.`,
          ],
        };
      }
      if (tier === 2) {
        return {
          prompt,
          figure,
          givens,
          parts: [
            { kind: 'numeric', id: 'f1', label: 'Lower natural frequency $f_1$', answer: hz(w1), unit: 'Hz', freq: true, traps: far(hz(w1), [{ value: Math.min(fz, ft), message: 'That is an **uncoupled** frequency ($\\sqrt{K_{11}/m}$ or $\\sqrt{K_{22}/I}$). Coupling pushes the pair apart: solve $\\det(K - \\omega^2M) = 0$.', trapId: 'a5-uncoupled' }]) },
            { kind: 'numeric', id: 'f2', label: 'Higher natural frequency $f_2$', answer: hz(w2), unit: 'Hz', freq: true, traps: far(hz(w2), [{ value: Math.max(fz, ft), message: 'That is an **uncoupled** frequency. The coupled pair straddles $\\sqrt{K_{11}/m}$ and $\\sqrt{K_{22}/I}$.', trapId: 'a5-uncoupled' }]) },
            { kind: 'numeric', id: 'n1', label: 'Node of mode 1, $x_{n1}$ (measured rearwards / towards $+x$ from G)', answer: n1, unit: 'm', traps: far(n1, [{ value: -n1, message: 'The node is where $z + x\\theta = 0$, at $x = -Z/\\Theta$ (not $+Z/\\Theta$).', trapId: 'sign' }]) },
            { kind: 'numeric', id: 'n2', label: 'Node of mode 2, $x_{n2}$', answer: n2, unit: 'm', traps: far(n2, [{ value: -n2, message: 'The node is at $x = -Z/\\Theta$.', trapId: 'sign' }]) },
          ],
          hints: [
            'Solve $\\det(K - \\omega^2M) = 0$ for the two frequencies, then use row 1 of $(K - \\omega^2M)A = 0$ for each mode ratio. The node is the body point with no vertical motion: $z + x\\theta = 0$.',
            `${Kset}, $M = \\mathrm{diag}(m, I)$. With $\\lambda = \\omega^2$: $mI\\lambda^2 - (K_{11}I + K_{22}m)\\lambda + (K_{11}K_{22} - K_{12}^2) = 0$; then $Z/\\Theta = -K_{12}/(K_{11} - m\\lambda)$ and $x_n = -Z/\\Theta$.`,
            `$K = ${mtex(sc(bp.K, 1))}$ (SI). Uncoupled checks: $\\sqrt{K_{11}/m}$ → ${f4(fz)} Hz, $\\sqrt{K_{22}/I}$ → ${f4(ft)} Hz.`,
            `$\\lambda_1 = ${t4(w1 * w1)}$, $\\lambda_2 = ${t4(w2 * w2)}$ s⁻², so $f_1$ = **${f4(hz(w1))} Hz** and $f_2$ = **${f4(hz(w2))} Hz** (they straddle the uncoupled values). Nodes: $x_{n1}$ = **${f4(n1)} m** and $x_{n2}$ = **${f4(n2)} m**; check $x_{n1}x_{n2} = ${t4(n1 * n2)} = -I/m = ${t4(-I / m)}$ m². ${Math.abs(n1) > Math.max(a, b) ? `Mode 1 rotates about a node outside the ${cabin ? 'isolators' : 'wheelbase'}: it is bounce-dominated.` : ''}`,
          ],
        };
      }
      const k2d = (k1 * a) / b;
      const fb = hz(Math.sqrt(((k1 + k2d) * 1e3) / m));
      const fp = hz(Math.sqrt(((k1 * a * a + k2d * b * b) * 1e3) / I));
      return {
        prompt: `${prompt} You may change only ${cabin ? 'isolator 2' : 'the rear suspension'}.`,
        figure,
        givens,
        parts: [
          {
            kind: 'numeric',
            id: 'k2',
            label: `Value of $k_2$ that decouples bounce and pitch`,
            answer: k2d,
            unit: 'kN/m',
            traps: far(k2d, [
              { value: (k1 * b) / a, message: 'The ratio is upside down: $k_1a = k_2b$ gives $k_2 = k_1a/b$. The spring with the longer lever arm must be softer.' },
              { value: k1, message: 'Equal springs decouple only when G is midway between them.', trapId: 'a5-symmetric' },
              { value: (k1 * a * a) / (b * b), message: 'That balances the pitch-stiffness terms $k_1a^2 = k_2b^2$. Decoupling needs equal **moments**: $k_1a = k_2b$.' },
            ]),
          },
          { kind: 'numeric', id: 'fb', label: 'Pure bounce frequency after the change', answer: fb, unit: 'Hz', freq: true },
          { kind: 'numeric', id: 'fp', label: 'Pure pitch frequency after the change', answer: fp, unit: 'Hz', freq: true },
          {
            kind: 'numeric',
            id: 'prod',
            label: 'For the **original** springs, the product of the two node positions $x_{n1}x_{n2}$',
            answer: n1 * n2,
            unit: 'm²',
            traps: far(n1 * n2, [{ value: I / m, message: 'Right size, wrong sign: the nodes lie on opposite sides of G, so the product is $-I/m$.', trapId: 'sign' }]),
          },
        ],
        hints: [
          'Bounce and pitch decouple when a pure bounce gives no net moment about G: $K_{12} = k_2b - k_1a = 0$. Then each frequency is a diagonal ratio. Mass orthogonality ($mZ_1Z_2 + I\\Theta_1\\Theta_2 = 0$) fixes the node product.',
          '$k_2 = k_1a/b$; $\\omega_b^2 = (k_1 + k_2)/m$; $\\omega_p^2 = (k_1a^2 + k_2b^2)/I$; $x_{n1}x_{n2} = (Z_1/\\Theta_1)(Z_2/\\Theta_2) = -I/m$.',
          `$k_2 = ${k1} \\times ${a}/${b}$; $\\omega_b^2 = (${k1} + ${t4(k2d)}) \\times 10^3/${m}$; $\\omega_p^2 = (${k1} \\times ${a}^2 + ${t4(k2d)} \\times ${b}^2) \\times 10^3/${I}$.`,
          `$k_2$ = **${f4(k2d)} kN/m**; pure bounce **${f4(fb)} Hz**, pure pitch **${f4(fp)} Hz**. Original nodes: ${f4(n1)} m and ${f4(n2)} m, product **${f4(n1 * n2)} m²** $= -I/m$.`,
        ],
      };
    },
  },

  // ------------------------------------------------------------------ 2024 box on rubber springs
  {
    id: 'a5-box-2024',
    title: 'Box on rubber springs, including a fifth spring',
    summary: '2024 A2 pattern: $I_z$ from the right face, $K$ with the shear of every mount, bounce plus the coupled sway–rock pair, then a fifth spring.',
    tiers: [1, 2, 3],
    source: 'Similar to 2024 A2.1–A2.5 (recurring type: official 2017 A2, 2025 A2)',
    cardId: 'a5-modes',
    marks: 10,
    sprint: false,
    generate(rng, tier) {
      const m = rng.step(500, 5000, 100);
      const ky = rng.step(1, 10, 0.5);
      const n = rng.pick([4, 5, 6, 8, 10]);
      const kx = n * ky;
      const a = rng.step(0.5, 2.5, 0.1);
      const b = rng.step(0.4, 2.0, 0.1);
      const c = rng.step(0.3, 2.0, 0.1);
      const Iz = (m * (a * a + c * c)) / 3;
      const Iy = (m * (a * a + b * b)) / 3;
      const Ix = (m * (b * b + c * c)) / 3;
      const KM: number[][] = [
        [4 * kx, 0, 4 * kx * c],
        [0, 4 * ky, 0],
        [4 * kx * c, 0, 4 * kx * c * c + 2 * ky * a * a],
      ]; // MN units
      const wy = Math.sqrt((4 * ky * 1e6) / m);
      const [w1, w3] = pair(KM[0][0] * 1e6, KM[0][2] * 1e6, KM[2][2] * 1e6, m, Iz);
      const wsx = Math.sqrt((KM[0][0] * 1e6) / m);
      const wst = Math.sqrt((KM[2][2] * 1e6) / Iz);
      const h1 = -KM[0][2] / (KM[0][0] - (m * w1 * w1) / 1e6);
      const h3 = -KM[0][2] / (KM[0][0] - (m * w3 * w3) / 1e6);
      const prompt = `A uniform solid box is $2a$ = ${r3(2 * a)} m long ($x$), $2c$ = ${r3(2 * c)} m high ($y$) and $2b$ = ${r3(2 * b)} m deep ($z$), with mass $m$ = ${m} kg. It rests on four rubber springs, one at the mid-point of each bottom edge. Each spring has axial (vertical) stiffness $k_y$ = ${ky} MN/m and transverse stiffness $k_x = k_z$ = ${n}$k_y$. Consider only the in-plane motion: sway $x$, bounce $y$ and rock θ about the $z$ axis through G (anticlockwise). Hint: $I = m(w^2 + h^2)/12$ for a uniform cuboid about an axis normal to the $w \\times h$ face.`;
      const givens = [
        { sym: 'm', value: `${m} kg` },
        { sym: 'a', value: `${a} m`, label: 'half-length (x)' },
        { sym: 'b', value: `${b} m`, label: 'half-depth (z)' },
        { sym: 'c', value: `${c} m`, label: 'half-height (y)' },
        { sym: 'k_y', value: `${ky} MN/m`, label: 'per spring' },
        { sym: 'k_x', value: `${kx} MN/m`, label: `shear, per spring (${n} × the vertical)` },
      ];
      const iTraps = far(Iz, [
        { value: Iy, message: 'That is $I_y$ (from the $2a \\times 2b$ face). Rocking in the $x$–$y$ plane is about $z$: use the $2a \\times 2c$ face.', trapId: 'a5-wrong-face' },
        { value: Ix, message: 'That is $I_x$. Use the face perpendicular to the rotation axis $z$: $2a \\times 2c$.', trapId: 'a5-wrong-face' },
        { value: (m * (a * a + c * c)) / 12, message: 'The hint uses full side lengths: $w = 2a$, $h = 2c$, so $I_z = m(a^2 + c^2)/3$.', trapId: 'factor2' },
      ]);
      const fyTraps = far(hz(wy), [
        { value: hz(Math.sqrt((2 * ky * 1e6) / m)), message: 'All **four** springs carry the bounce: $\\omega_y = \\sqrt{4k_y/m}$.', trapId: 'a5-spring-count' },
        { value: hz(Math.sqrt((5 * ky * 1e6) / m)), message: 'That counts five springs; the original box has four.', trapId: 'a5-spring-count' },
      ]);
      if (tier === 1) {
        return {
          prompt,
          figure: BoxFig,
          givens,
          parts: [
            { kind: 'numeric', id: 'Iz', label: 'Moment of inertia $I_z$ about the $z$ axis through G', answer: Iz, unit: 'kg m²', traps: iTraps },
            { kind: 'numeric', id: 'fy', label: 'Bounce natural frequency $f_y$', answer: hz(wy), unit: 'Hz', freq: true, traps: fyTraps },
          ],
          hints: [
            'Rocking in the $x$–$y$ plane is about $z$, so use the face perpendicular to $z$ (sides $2a$ and $2c$). Bounce is decoupled because the vertical springs are symmetric about G: an SDOF on all four springs.',
            '$I_z = m[(2a)^2 + (2c)^2]/12 = m(a^2 + c^2)/3$; $\\omega_y = \\sqrt{4k_y/m}$ (LA7 Eq 7.5).',
            `$I_z = ${m}(${a}^2 + ${c}^2)/3$; $\\omega_y = \\sqrt{4 \\times ${ky}\\times10^6/${m}}$.`,
            `$I_z$ = **${f4(Iz)} kg m²** (not $I_y$ = ${f4(Iy)}); $\\omega_y$ = ${f4(wy)} rad/s, so $f_y$ = **${f4(hz(wy))} Hz**.`,
          ],
        };
      }
      if (tier === 2) {
        const K2 = [
          [2 * kx, 0, 2 * kx * c],
          [0, 4 * ky, 0],
          [2 * kx * c, 0, 2 * kx * c * c + 2 * ky * a * a],
        ];
        const Kflip = clone(KM);
        Kflip[0][2] = Kflip[2][0] = -KM[0][2];
        return {
          prompt,
          figure: BoxFig,
          givens,
          parts: [
            {
              kind: 'matrix',
              id: 'K',
              label: 'Stiffness matrix $K$ for $q = [x,\\ y,\\ \\theta]^T$ (MN/m, MN/rad, MN m/rad)',
              answer: KM,
              rowLabels: XYT,
              colLabels: XYT,
              unit: 'MN/m, MN/rad, MN m/rad',
              tol: 0.005,
              traps: farM(KM, [
                { value: K2, message: 'All **four** mounts shear at the base, including the front and back ones on $x = 0$: $K_{xx} = 4k_x$, $K_{x\\theta} = 4k_xc$.', trapId: 'a5-shear' },
                { value: Kflip, message: 'Sign: the base is below G ($y_i = -c$), so $\\Delta x = x + c\\theta$ and $K_{x\\theta} = +4k_xc$ for anticlockwise θ.', trapId: 'sign' },
              ]),
            },
            { kind: 'numeric', id: 'fy', label: 'Bounce frequency $f_y$', answer: hz(wy), unit: 'Hz', freq: true, traps: fyTraps },
            { kind: 'numeric', id: 'f1', label: 'Lower coupled sway–rock frequency $f_1$', answer: hz(w1), unit: 'Hz', freq: true, traps: far(hz(w1), [{ value: hz(Math.min(wsx, wst)), message: 'That is an uncoupled value ($\\sqrt{K_{xx}/m}$ or $\\sqrt{K_{\\theta\\theta}/I_z}$). Solve the 2 × 2 determinant.', trapId: 'a5-uncoupled' }]) },
            { kind: 'numeric', id: 'f3', label: 'Higher coupled sway–rock frequency $f_3$', answer: hz(w3), unit: 'Hz', freq: true, traps: far(hz(w3), [{ value: hz(Math.max(wsx, wst)), message: 'That is an uncoupled value. The coupled pair lies outside both uncoupled frequencies.', trapId: 'a5-uncoupled' }]) },
          ],
          hints: [
            'Coordinates at G: $M = \\mathrm{diag}(m, m, I_z)$. Every spring shears by $x + c\\theta$ (all are $c$ below G); vertically the left and right springs move $y \\mp a\\theta$, the front and back ones $y$. Bounce decouples by symmetry; sway and rock remain a 2 × 2 problem.',
            '$V = 2k_x(x + c\\theta)^2 + 2k_yy^2 + k_ya^2\\theta^2$, so $K = [[4k_x, 0, 4k_xc],\\ [0, 4k_y, 0],\\ [4k_xc, 0, 4k_xc^2 + 2k_ya^2]]$. Sway–rock: $(K_{11} - m\\lambda)(K_{33} - I_z\\lambda) - K_{13}^2 = 0$.',
            `$I_z = ${t4(Iz)}$ kg m²; $4k_x = ${t4(4 * kx)}$, $4k_xc = ${t4(4 * kx * c)}$, $4k_xc^2 + 2k_ya^2 = ${t4(KM[2][2])}$ (MN units). Uncoupled checks: $\\sqrt{K_{11}/m}$ = ${f4(wsx)} and $\\sqrt{K_{33}/I_z}$ = ${f4(wst)} rad/s.`,
            `**$K = ${mtex(KM)}$** MN/m, MN/rad, MN m/rad. $\\omega_y = \\sqrt{4k_y/m}$ = ${f4(wy)} rad/s → **${f4(hz(wy))} Hz**. Coupled: $\\omega_1$ = ${f4(w1)} rad/s → **${f4(hz(w1))} Hz** (rotation about a point ${f3(Math.abs(h1))} m ${h1 < 0 ? 'below' : 'above'} G) and $\\omega_3$ = ${f4(w3)} rad/s → **${f4(hz(w3))} Hz** (about a point ${f3(Math.abs(h3))} m ${h3 < 0 ? 'below' : 'above'} G); the heights multiply to $-I_z/m$ = ${f4(-Iz / m)} m².`,
          ],
        };
      }
      const K5 = [
        [5 * kx, 0, 5 * kx * c],
        [0, 5 * ky, ky * a],
        [5 * kx * c, ky * a, 5 * kx * c * c + 3 * ky * a * a],
      ];
      const K5noShear = [
        [4 * kx, 0, 4 * kx * c],
        [0, 5 * ky, ky * a],
        [4 * kx * c, ky * a, 4 * kx * c * c + 3 * ky * a * a],
      ];
      const K5flip = clone(K5);
      K5flip[1][2] = K5flip[2][1] = -ky * a;
      return {
        prompt: `${prompt} One more identical spring is now installed under the **right-front bottom corner**, at $x = +a$, $y = -c$ from G.`,
        figure: BoxFig,
        givens,
        parts: [
          {
            kind: 'matrix',
            id: 'K5',
            label: 'New stiffness matrix $K\'$ (MN/m, MN/rad, MN m/rad)',
            answer: K5,
            rowLabels: XYT,
            colLabels: XYT,
            unit: 'MN/m, MN/rad, MN m/rad',
            tol: 0.005,
            traps: farM(K5, [
              { value: K5noShear, message: 'The fifth spring also shears: it adds $k_x$ to $K_{xx}$, $k_xc$ to $K_{x\\theta}$ and $k_xc^2$ to $K_{\\theta\\theta}$.', trapId: 'a5-shear' },
              { value: K5flip, message: 'Sign: a spring at $x_i = +a$ deflects $y + a\\theta$, so $K_{y\\theta} = +k_ya$.', trapId: 'sign' },
            ]),
          },
          {
            kind: 'numeric',
            id: 'xbar',
            label: 'Where is the vertical stiffness centre now? $\\bar x = \\sum k_yx_i/\\sum k_y$',
            answer: a / 5,
            unit: 'm',
            traps: far(a / 5, [{ value: a / 4, message: 'There are five springs now: $\\bar x = k_ya/(5k_y) = a/5$.', trapId: 'a5-spring-count' }]),
          },
          {
            kind: 'choice',
            id: 'coupled',
            label: 'How does the fifth spring change the coupling?',
            options: [
              { text: 'Bounce couples with rock through $K_{y\\theta} = k_ya$, and through rock with sway: all three are coupled.', correct: true, why: 'The vertical stiffness is no longer centred under G (2024 A2.5).' },
              { text: 'Only the frequencies rise; bounce is still pure.', correct: false, why: 'A bounce now produces a net moment $k_ya\\,y$ about G.' },
              { text: 'Sway and bounce couple directly through $K_{xy}$.', correct: false, why: 'Upright springs give $K_{xy} = 0$.' },
              { text: 'Sway decouples because the new spring balances the shear.', correct: false, why: '$K_{x\\theta}$ grows to $5k_xc$.' },
            ],
          },
        ],
        hints: [
          'Add the fifth spring’s energy, $\\tfrac12k_x(x + c\\theta)^2 + \\tfrac12k_y(y + a\\theta)^2$, to the four-spring $V$, and read off $K\'$.',
          '$K\' = [[5k_x, 0, 5k_xc],\\ [0, 5k_y, k_ya],\\ [5k_xc, k_ya, 5k_xc^2 + 3k_ya^2]]$; $\\bar x = \\sum k_yx_i / \\sum k_y$.',
          `$5k_x = ${t4(5 * kx)}$, $5k_xc = ${t4(5 * kx * c)}$, $5k_y = ${t4(5 * ky)}$, $k_ya = ${t4(ky * a)}$, $5k_xc^2 + 3k_ya^2 = ${t4(K5[2][2])}$ (MN units); $\\bar x = ${t4(ky * a)}/${t4(5 * ky)}$.`,
          `**$K\' = ${mtex(K5)}$**; $\\bar x$ = **${f4(a / 5)} m** to the right of G. The new $K_{y\\theta} = k_ya$ couples bounce with rock, and rock is still coupled with sway: all three couple and the frequencies come from a cubic.`,
        ],
      };
    },
  },

  // ------------------------------------------------------------------ 2025 range hood
  {
    id: 'a5-rangehood-2025',
    title: 'Range hood on three wall mounts: isolation check',
    summary: '2025 A2 pattern: decoupled sway, the coupled pair in rpm, whether the running speed is safe, and the run-up anti-resonance.',
    tiers: [1, 2, 3],
    source: 'Similar to 2025 A2.1–A2.4; LA7 p47 design rule',
    cardId: 'a5-isolation',
    marks: 8,
    sprint: false,
    generate(rng, tier) {
      let m = 0;
      let I = 0;
      let kx = 0;
      let q = 0;
      let s = 0;
      let d = 0;
      let Wa = 0;
      for (let i = 0; i < 30; i++) {
        m = rng.step(15, 60, 1);
        I = rng.step(5, 30, 0.5);
        kx = rng.step(50, 1000, 10) * 1e3;
        q = rng.pick([0.2, 0.25, 1 / 3, 0.4, 0.5]);
        s = rng.step(0.2, 0.6, 0.05);
        d = rng.step(0.2, 0.6, 0.05);
        const Ktt0 = 2 * kx * s * s + 3 * kx * q * d * d;
        Wa = Math.sqrt(Ktt0 / I);
        if (Math.abs(3 * kx - m * Wa * Wa) > 0.15 * 3 * kx) break;
      }
      const ky = kx * q;
      const qs = q === 1 / 3 ? '1/3' : String(q);
      const mbR = rng.step(0.005, 0.05, 0.005);
      const Kyy = 3 * ky;
      const Kyt = -3 * ky * d;
      const Ktt = 2 * kx * s * s + 3 * ky * d * d;
      const wx = Math.sqrt((3 * kx) / m);
      const [w1, w2] = pair(Kyy, Kyt, Ktt, m, I);
      const Nmax = Math.ceil((toRpm(Wa) * rng.pick([1.08, 1.15, 1.25])) / 50) * 50;
      const Wmax = (Nmax * TAU) / 60;
      const modes = [w1, w2, wx].sort((u, v) => u - v);
      const wTop = modes[2];
      const near = modes.find((w) => Math.abs(Wmax / w - 1) < 0.1);
      const prompt = `A range hood of mass $m$ = ${m} kg and inertia $I$ = ${I} kg m² about its centre of mass G is fixed to a wall by three identical mounts at $(-d, +s)$, $(-d, 0)$ and $(-d, -s)$ from G (top view: $x$ away from the wall, $y$ along it, θ anticlockwise), with $s$ = ${s} m and $d$ = ${d} m. **Each** mount has axial stiffness $k_x$ = ${f4(kx / 1e6)} MN/m and transverse stiffness $k_y$ = ${qs} $k_x$. The fan at G has an unbalance $m_bR$ = ${mbR} kg m and runs up to ${Nmax} rpm, so the force on the hood is $F_0 = m_bR\\,\\Omega^2$, rotating in the plane.`;
      const givens = [
        { sym: 'm', value: `${m} kg` },
        { sym: 'I', value: `${I} kg m²` },
        { sym: 'k_x', value: `${f4(kx / 1e6)} MN/m`, label: 'per mount' },
        { sym: 'k_y', value: `${qs} × kₓ`, label: 'per mount (transverse)' },
        { sym: 's', value: `${s} m` },
        { sym: 'd', value: `${d} m` },
        { sym: 'm_bR', value: `${mbR} kg m` },
        { sym: 'N_{\\max}', value: `${Nmax} rpm` },
      ];
      const Kset = '$K = [[3k_x, 0, 0],\\ [0, 3k_y, -3k_yd],\\ [0, -3k_yd, 2k_xs^2 + 3k_yd^2]]$';
      if (tier === 1) {
        return {
          prompt,
          figure: RangehoodFig,
          givens,
          parts: [
            {
              kind: 'numeric',
              id: 'wx',
              label: 'Sway ($x$) natural frequency',
              answer: toRpm(wx),
              unit: 'rpm',
              freq: true,
              traps: far(toRpm(wx), [
                { value: toRpm(Math.sqrt(kx / m)), message: 'All three mounts resist $x$: $K_{xx} = 3k_x$.', trapId: 'a5-spring-count' },
                { value: toRpm(Math.sqrt((9 * kx) / m)), message: '$k_x$ is already **per mount**; $K_{xx} = 3k_x$, not $9k_x$.', trapId: 'a5-spring-count' },
              ]),
            },
            {
              kind: 'numeric',
              id: 'ktt',
              label: 'Rocking stiffness $K_{\\theta\\theta}$',
              answer: Ktt,
              unit: 'N m/rad',
              traps: far(Ktt, [
                { value: 2 * kx * s * s, message: 'The transverse springs also resist rocking: each moves by $-d\\theta$ along $y$, adding $3k_yd^2$.', trapId: 'lever-arm' },
                { value: 3 * ky * d * d, message: 'The top and bottom axial springs stretch by $\\mp s\\theta$: add $2k_xs^2$.', trapId: 'lever-arm' },
              ]),
            },
            {
              kind: 'choice',
              id: 'why',
              label: 'Why is the sway $x$ decoupled from $y$ and θ?',
              options: [
                { text: 'The axial springs are symmetric about G ($y_i = +s, 0, -s$), so $K_{x\\theta} = -\\sum k_xy_i = 0$, and upright mounts give $K_{xy} = 0$.', correct: true, why: 'A pure $x$ produces no net moment, and a rotation no net $x$ force (2025 A2.2).' },
                { text: 'Because the fan force passes through G.', correct: false, why: 'That removes the forcing in θ, not the elastic coupling.' },
                { text: 'Because $k_y < k_x$.', correct: false, why: 'Stiffness ratios do not remove $\\sum k_xy_i$; symmetry does.' },
                { text: 'It is not: all three are coupled.', correct: false, why: 'Only $y$ and θ couple, through the transverse springs’ lever arm $d$.' },
              ],
            },
          ],
          hints: [
            'Mount deflections: axial $x - y_i\\theta$ (i.e. $x \\mp s\\theta$, $x$), transverse $y + x_i\\theta = y - d\\theta$ for all three. $k_x$ is per mount, so the 3 appears inside $K$.',
            `${Kset}; $\\omega_x = \\sqrt{3k_x/m}$; rpm = rad/s × 60/2π.`,
            `$\\omega_x = \\sqrt{3 \\times ${t4(kx)}/${m}}$ rad/s; $K_{\\theta\\theta} = 2(${t4(kx)})(${s})^2 + 3(${t4(ky)})(${d})^2$.`,
            `$\\omega_x$ = ${f4(wx)} rad/s = **${f4(toRpm(wx))} rpm**; $K_{\\theta\\theta}$ = **${f4(Ktt)} N m/rad**. Sway is decoupled because the axial springs are symmetric about G.`,
          ],
        };
      }
      if (tier === 2) {
        const okIso = Wmax >= 2 * wTop;
        return {
          prompt,
          figure: RangehoodFig,
          givens,
          parts: [
            { kind: 'numeric', id: 'w1', label: 'Lower coupled ($y$–θ) natural frequency', answer: toRpm(w1), unit: 'rpm', freq: true, traps: far(toRpm(w1), [{ value: toRpm(Math.sqrt(Kyy / m)), message: 'That is the uncoupled $\\sqrt{3k_y/m}$. $y$ and θ couple through $-3k_yd$: solve the 2 × 2 determinant.', trapId: 'a5-uncoupled' }]) },
            { kind: 'numeric', id: 'w2', label: 'Higher coupled ($y$–θ) natural frequency', answer: toRpm(w2), unit: 'rpm', freq: true, traps: far(toRpm(w2), [{ value: toRpm(Math.sqrt(Ktt / I)), message: 'That is the uncoupled $\\sqrt{K_{\\theta\\theta}/I}$ (it is the $y$ anti-resonance, not a natural frequency).', trapId: 'a5-uncoupled' }]) },
            {
              kind: 'choice',
              id: 'verdict',
              label: `Is ${Nmax} rpm a good maximum operating speed for these mounts?`,
              options: [
                { text: 'No: it is within 10 % of a natural frequency (resonance risk).', correct: !!near, why: near ? `It is ${f3(Math.abs(Wmax / near - 1) * 100)} % from the mode at ${f4(toRpm(near))} rpm.` : `The nearest mode is ${f3(Math.min(...modes.map((w) => Math.abs(Wmax / w - 1))) * 100)} % away, so not this reason.` },
                { text: 'No: no resonance is close, but the speed is below twice the highest mode, so not every mode is isolated.', correct: !near && !okIso, why: `The highest rigid-body mode is ${f4(toRpm(wTop))} rpm; isolation of every mode needs at least ${f4(2 * toRpm(wTop))} rpm (LA7 p47).` },
                { text: 'Yes: it is above the first coupled mode, so the mounts isolate.', correct: false, why: 'Being above one mode does not isolate the others; the reader’s rule uses the **highest** mode.' },
                { text: 'Yes: it is at least twice every rigid-body frequency.', correct: okIso, why: okIso ? 'Every $r_i \\ge 2$.' : `The highest mode is ${f4(toRpm(wTop))} rpm, so it is not.` },
              ],
            },
          ],
          hints: [
            'List every rigid-body mode: the decoupled sway and the coupled $y$–θ pair. Isolation needs the running speed well above all of them; the reader asks for at least twice the highest.',
            `${Kset}. For $(y, \\theta)$: $(3k_y - m\\lambda)(K_{\\theta\\theta} - I\\lambda) - (3k_yd)^2 = 0$, $\\lambda = \\omega^2$.`,
            `$3k_y = ${t4(Kyy)}$, $3k_yd = ${t4(-Kyt)}$, $K_{\\theta\\theta} = ${t4(Ktt)}$; so $${t4(m * I)}\\,\\lambda^2 - ${t4(Kyy * I + Ktt * m)}\\,\\lambda + ${t4(Kyy * Ktt - Kyt * Kyt)} = 0$. Sway: $\\sqrt{3k_x/m}$ = ${f4(wx)} rad/s.`,
            `$\\omega_1$ = ${f4(w1)} rad/s = **${f4(toRpm(w1))} rpm**, $\\omega_2$ = ${f4(w2)} rad/s = **${f4(toRpm(w2))} rpm**; sway ${f4(toRpm(wx))} rpm. At ${Nmax} rpm: ${near ? `within 10 % of the ${f4(toRpm(near))} rpm mode, a poor operating point.` : okIso ? 'every mode is below half the speed: well isolated.' : `not near a resonance, but below 2 × ${f4(toRpm(wTop))} rpm, so not every mode is isolated.`}`,
          ],
        };
      }
      const F0 = mbR * Wa * Wa;
      const Th = F0 / Kyt;
      const X = F0 / (3 * kx - m * Wa * Wa);
      const F0max = mbR * Wmax * Wmax;
      return {
        prompt: `${prompt} During run-up, the motion is momentarily suppressed in one direction at one particular speed.`,
        figure: RangehoodFig,
        givens,
        parts: [
          {
            kind: 'choice',
            id: 'which',
            label: 'Which motion is suppressed?',
            options: [
              { text: '$y$, along the wall', correct: true, why: 'The force on $y$ drives the coupled $(y, \\theta)$ pair; $Y$’s numerator $K_{\\theta\\theta} - I\\Omega^2$ vanishes at one speed (an anti-resonance).' },
              { text: 'θ, the rotation', correct: false, why: '$\\Theta = -K_{y\\theta}F_0/\\Delta$ has a constant numerator: it never vanishes.' },
              { text: '$x$, away from the wall', correct: false, why: '$X = F_0/(3k_x - m\\Omega^2)$ is an SDOF response: it never vanishes.' },
            ],
          },
          {
            kind: 'numeric',
            id: 'Wa',
            label: 'Fan speed at which it is suppressed',
            answer: toRpm(Wa),
            unit: 'rpm',
            freq: true,
            traps: far(toRpm(Wa), [
              { value: toRpm(Math.sqrt(Kyy / m)), message: 'That is $\\sqrt{3k_y/m}$. $Y$ vanishes when its **numerator** $K_{\\theta\\theta} - I\\Omega^2 = 0$.' },
              { value: toRpm(w1), message: 'That is a natural frequency, where the response peaks.' },
              { value: toRpm(w2), message: 'That is a natural frequency, where the response peaks.' },
            ]),
          },
          {
            kind: 'numeric',
            id: 'Th',
            label: 'Rotation amplitude $|\\Theta|$ at that speed',
            answer: Math.abs(Th) * 1e3,
            unit: 'mrad',
            traps: far(Math.abs(Th) * 1e3, [{ value: (F0max / Math.abs(Kyt)) * 1e3, message: `The unbalance force grows as $\\Omega^2$: use $F_0$ at the suppression speed (${f4(F0)} N), not at ${Nmax} rpm.`, trapId: 'unbalance-omega2' }]),
          },
          {
            kind: 'numeric',
            id: 'X',
            label: 'Sway amplitude $|X|$ at that speed',
            answer: Math.abs(X) * 1e3,
            unit: 'mm',
            traps: far(Math.abs(X) * 1e3, [
              { value: Math.abs(F0 / (kx - m * Wa * Wa)) * 1e3, message: 'Sway is resisted by all three mounts: $X = F_0/(3k_x - m\\Omega^2)$.', trapId: 'a5-spring-count' },
              { value: (F0 / (3 * kx)) * 1e3, message: 'That is the static deflection $F_0/3k_x$; include the inertia term $-m\\Omega^2$.' },
            ]),
          },
        ],
        hints: [
          'With harmonic forcing, $(K - \\Omega^2M)q = F$. For the $(y, \\theta)$ pair driven on $y$: $Y = (K_{\\theta\\theta} - I\\Omega^2)F_0/\\Delta$ and $\\Theta = -K_{y\\theta}F_0/\\Delta$. A response vanishes where its numerator does.',
          `$\\Omega_a^2 = K_{\\theta\\theta}/I$. There $\\Delta = -K_{y\\theta}^2$, so $\\Theta = F_0/K_{y\\theta} = -F_0/(3k_yd)$. Sway is SDOF: $X = F_0/(3k_x - m\\Omega^2)$; and $F_0 = m_bR\\,\\Omega_a^2$.`,
          `$\\Omega_a = \\sqrt{${t4(Ktt)}/${I}} = ${t4(Wa)}$ rad/s; $F_0 = ${mbR} \\times ${t4(Wa)}^2 = ${t4(F0)}$ N; $3k_yd = ${t4(-Kyt)}$ N/rad; $3k_x - m\\Omega_a^2 = ${t4(3 * kx - m * Wa * Wa)}$ N/m.`,
          `$y$ stops at $\\Omega_a$ = ${f4(Wa)} rad/s = **${f4(toRpm(Wa))} rpm**. There $|\\Theta| = ${t4(F0)}/${par(-Kyt)}$ = **${f4(Math.abs(Th) * 1e3)} mrad** and $|X| = ${t4(F0)}/${par(3 * kx - m * Wa * Wa)}$ = **${f4(Math.abs(X) * 1e3)} mm**${X < 0 ? ' (in anti-phase with the force, because the speed is above the sway resonance)' : ''}. Physically the hood turns so the mounts’ transverse deflection $y - d\\theta$ pulls back exactly against the fan force.`,
        ],
      };
    },
  },

  // ------------------------------------------------------------------ 2022 wall cabinet
  {
    id: 'a5-cabinet-2022',
    title: 'Cabinet on a wall: K, decoupling and frequencies',
    summary: '2022 A1.4–A1.5 pattern: $K$ from two wall anchors, which DoF can be decoupled (sway, by $a = b$), and the resulting frequencies.',
    tiers: [1, 2, 3],
    source: 'Similar to 2022 A1.4–A1.5; official 2017 A2 method',
    cardId: 'a5-coupling',
    marks: 6,
    generate(rng, tier) {
      const m = rng.step(10, 100, 5);
      const c = rng.step(0.15, 0.4, 0.05);
      const a = rng.step(0.1, 0.6, 0.05);
      const b = tier === 3 ? a : stepNot(rng, 0.1, 0.6, 0.05, a);
      const H = r3(2 * Math.max(a, b) + rng.step(0, 0.3, 0.1));
      const I = r3((m * (H * H + 4 * c * c)) / 12);
      const kx = rng.step(10, 200, 5);
      const ky = rng.step(10, 200, 5);
      const K = [
        [2 * kx, 0, kx * (b - a)],
        [0, ky, ky * c],
        [kx * (b - a), ky * c, kx * (a * a + b * b) + ky * c * c],
      ];
      const prompt = `A cabinet of mass $m$ = ${m} kg ($I$ = ${I} kg m² about G) hangs on a wall to its right. The upper anchor is a horizontal spring $k_x$ a height $a$ = ${a} m above G. The lower anchor, $b$ = ${b} m below G, is a horizontal spring $k_x$ plus a vertical spring $k_y$ resting on a wall bracket. Both anchors are $c$ = ${c} m from G horizontally; $k_x$ = ${kx} kN/m and $k_y$ = ${ky} kN/m. Coordinates at G: sway $x$ (towards the wall), bounce $y$, θ anticlockwise.`;
      const givens = [
        { sym: 'm', value: `${m} kg` },
        { sym: 'I', value: `${I} kg m²` },
        { sym: 'a', value: `${a} m` },
        { sym: 'b', value: `${b} m` },
        { sym: 'c', value: `${c} m` },
        { sym: 'k_x', value: `${kx} kN/m`, label: 'each horizontal spring' },
        { sym: 'k_y', value: `${ky} kN/m` },
      ];
      const hint1 = 'Wall-side points: upper $(c, a)$, lower $(c, -b)$. Deflections: upper horizontal $x - a\\theta$, lower horizontal $x + b\\theta$, vertical $y + c\\theta$ (from $\\Delta x = x - y_i\\theta$, $\\Delta y = y + x_i\\theta$).';
      const hint2 = '$V = \\tfrac12k_x(x - a\\theta)^2 + \\tfrac12k_x(x + b\\theta)^2 + \\tfrac12k_y(y + c\\theta)^2$, so $K = [[2k_x, 0, k_x(b - a)],\\ [0, k_y, k_yc],\\ [k_x(b - a), k_yc, k_x(a^2 + b^2) + k_yc^2]]$ and $M = \\mathrm{diag}(m, m, I)$.';
      if (tier === 1) {
        return {
          prompt,
          figure: CabinetFig,
          givens,
          parts: [
            { kind: 'numeric', id: 'k13', label: '$K_{x\\theta}$ (sign matters)', answer: K[0][2], unit: 'kN/rad', traps: far(K[0][2], [{ value: -K[0][2], message: 'Sign: the upper spring stretches $x - a\\theta$ (above G) and the lower $x + b\\theta$, so $K_{x\\theta} = k_x(b - a)$.', trapId: 'sign' }]) },
            { kind: 'numeric', id: 'k23', label: '$K_{y\\theta}$', answer: K[1][2], unit: 'kN/rad', traps: far(K[1][2], [{ value: -K[1][2], message: 'The bracket is on the wall side ($x_i = +c$): $\\Delta y = y + c\\theta$.', trapId: 'sign' }, { value: kx * c, message: 'Use the vertical spring’s stiffness: $K_{y\\theta} = k_yc$.' }]) },
            {
              kind: 'numeric',
              id: 'k33',
              label: '$K_{\\theta\\theta}$',
              answer: K[2][2],
              unit: 'kN m/rad',
              traps: far(K[2][2], [
                { value: kx * (a * a + b * b), message: 'Rocking also compresses the vertical spring by $c\\theta$: add $k_yc^2$.', trapId: 'lever-arm' },
                { value: kx * (b - a) ** 2 + ky * c * c, message: 'Each horizontal spring contributes its own $k_xy_i^2$: $k_x(a^2 + b^2)$, not $k_x(b - a)^2$.', trapId: 'lever-arm' },
              ]),
            },
          ],
          hints: [hint1, hint2, `$k_x(b - a) = ${kx}(${b} - ${a})$; $k_yc = ${ky} \\times ${c}$; $k_x(a^2 + b^2) + k_yc^2 = ${kx}(${a}^2 + ${b}^2) + ${ky}(${c})^2$.`, `$K_{x\\theta}$ = **${f4(K[0][2])} kN/rad**, $K_{y\\theta}$ = **${f4(K[1][2])} kN/rad**, $K_{\\theta\\theta}$ = **${f4(K[2][2])} kN m/rad**.`],
        };
      }
      if (tier === 2) {
        const Kflip = clone(K);
        Kflip[0][2] = Kflip[2][0] = -K[0][2];
        const Kmiss = clone(K);
        Kmiss[2][2] = kx * (a * a + b * b);
        return {
          prompt,
          figure: CabinetFig,
          givens,
          parts: [
            {
              kind: 'matrix',
              id: 'K',
              label: 'Stiffness matrix $K$ (kN/m, kN/rad, kN m/rad)',
              answer: K,
              rowLabels: XYT,
              colLabels: XYT,
              unit: 'kN/m, kN/rad, kN m/rad',
              tol: 0.005,
              traps: farM(K, [
                { value: Kflip, message: 'Sign of $K_{x\\theta}$: the anchor above G stretches $x - a\\theta$, the one below $x + b\\theta$.', trapId: 'sign' },
                { value: Kmiss, message: 'Rocking compresses the vertical spring too: $K_{\\theta\\theta}$ includes $k_yc^2$.', trapId: 'lever-arm' },
              ]),
            },
            {
              kind: 'choice',
              id: 'fix',
              label: 'Which degree of freedom can be decoupled by choosing the length dimensions, and how?',
              options: [
                { text: 'Sway: make $a = b$, so $K_{x\\theta} = k_x(b - a) = 0$.', correct: true, why: 'The horizontal forces then pass through G; sway is an SDOF with $\\omega^2 = 2k_x/m$ (2022 A1.5).' },
                { text: 'Bounce: make $a = b$.', correct: false, why: '$K_{y\\theta} = k_yc$ does not depend on $a$ or $b$.' },
                { text: 'Bounce: put the vertical support under G ($c = 0$).', correct: false, why: 'The support is on the wall, at least half the cabinet depth from G: impossible here.' },
                { text: 'All three, by making $a = b$ and $k_x = k_y$.', correct: false, why: 'Stiffness values cannot remove $k_yc$.' },
              ],
            },
          ],
          hints: [hint1, hint2, `$2k_x = ${2 * kx}$; $k_x(b - a) = ${t4(K[0][2])}$; $k_y = ${ky}$; $k_yc = ${t4(K[1][2])}$; $K_{33} = ${t4(K[2][2])}$.`, `**$K = ${mtex(K)}$** (kN/m, kN/rad, kN m/rad). Sway decouples if $a = b$ (≤ 20-word answer: “Sway $x$: put the horizontal anchors equidistant above and below G”). Bounce cannot be decoupled: $K_{y\\theta} = k_yc \\ne 0$.`],
        };
      }
      // tier 3: a = b (sway decoupled); coupled y–θ pair
      const wx = Math.sqrt((2 * kx * 1e3) / m);
      const [w1, w2] = pair(ky * 1e3, ky * c * 1e3, K[2][2] * 1e3, m, I);
      return {
        prompt: `${prompt} The installer has chosen $a = b$.`,
        figure: CabinetFig,
        givens,
        parts: [
          { kind: 'numeric', id: 'fx', label: 'Sway natural frequency', answer: hz(wx), unit: 'Hz', freq: true, traps: far(hz(wx), [{ value: hz(Math.sqrt((kx * 1e3) / m)), message: 'Both horizontal springs resist sway: $\\omega_x^2 = 2k_x/m$.', trapId: 'a5-spring-count' }]) },
          { kind: 'numeric', id: 'f1', label: 'Lower coupled ($y$–θ) frequency', answer: hz(w1), unit: 'Hz', freq: true, traps: far(hz(w1), [{ value: hz(Math.sqrt((ky * 1e3) / m)), message: 'That is the uncoupled bounce $\\sqrt{k_y/m}$; $y$ and θ are still coupled by $k_yc$.', trapId: 'a5-uncoupled' }]) },
          { kind: 'numeric', id: 'f2', label: 'Higher coupled ($y$–θ) frequency', answer: hz(w2), unit: 'Hz', freq: true, traps: far(hz(w2), [{ value: hz(Math.sqrt((K[2][2] * 1e3) / I)), message: 'That is the uncoupled rock $\\sqrt{K_{\\theta\\theta}/I}$; solve the 2 × 2 determinant.', trapId: 'a5-uncoupled' }]) },
        ],
        hints: [
          'With $a = b$, $K_{x\\theta} = 0$: sway is an SDOF on two horizontal springs. Bounce and rock remain coupled through $k_yc$, so they need $\\det(K - \\omega^2M) = 0$ for the $(y, \\theta)$ block.',
          '$\\omega_x^2 = 2k_x/m$; $(y, \\theta)$: $K = [[k_y, k_yc],\\ [k_yc, 2k_xa^2 + k_yc^2]]$, $M = \\mathrm{diag}(m, I)$, so $mI\\lambda^2 - (k_yI + K_{33}m)\\lambda + (k_yK_{33} - k_y^2c^2) = 0$.',
          `$\\omega_x = \\sqrt{2 \\times ${kx}\\times10^3/${m}} = ${t4(wx)}$ rad/s; $k_y = ${ky * 1e3}$ N/m, $k_yc = ${t4(ky * c * 1e3)}$ N/rad, $K_{33} = ${t4(K[2][2] * 1e3)}$ N m/rad.`,
          `Sway **${f4(hz(wx))} Hz**; coupled pair $\\omega_1$ = ${f4(w1)} rad/s → **${f4(hz(w1))} Hz** and $\\omega_2$ = ${f4(w2)} rad/s → **${f4(hz(w2))} Hz**, either side of the uncoupled ${f4(hz(Math.sqrt((ky * 1e3) / m)))} Hz (bounce) and ${f4(hz(Math.sqrt((K[2][2] * 1e3) / I)))} Hz (rock).`,
        ],
      };
    },
  },

  // ------------------------------------------------------------------ official 2017 machine on isolators
  {
    id: 'a5-machine-2017',
    title: 'Machine on isolator springs (official 2017 A2)',
    summary: 'The energy expression, $K$, the decoupled frequencies for $a = 0$ and $b = c$, and the damped sway eigenvalue.',
    tiers: [1, 2, 3],
    source: 'Similar to official 2017 A2(a)–(f) (exam pack solution)',
    cardId: 'a5-k',
    marks: 8,
    generate(rng, tier) {
      const m = rng.step(100, 3000, 50);
      const rho = rng.step(0.3, 1.0, 0.05);
      const I = r3(m * rho * rho);
      const kx = rng.step(20, 500, 10);
      const ky = rng.step(20, 500, 10);
      const a = rng.step(0.1, 0.4, 0.05);
      const b = rng.step(0.3, 1.2, 0.1);
      const c = stepNot(rng, 0.3, 1.2, 0.1, b);
      const K = [
        [2 * kx, 0, 2 * kx * a],
        [0, 2 * ky, ky * (c - b)],
        [2 * kx * a, ky * (c - b), 2 * kx * a * a + ky * (b * b + c * c)],
      ];
      const prompt = `A machine on isolator springs has mass $m$ = ${m} kg and moment of inertia $I$ = ${I} kg m² about its centre of mass G, where the axes are placed. The springs at each end total $k_x$ = ${kx} kN/m horizontally and $k_y$ = ${ky} kN/m vertically. All springs are $a$ = ${a} m below G; the left end is $b$ = ${b} m and the right end $c$ = ${c} m from G horizontally. Coordinates: sway $x$, bounce $y$, rock θ anticlockwise.`;
      const givens = [
        { sym: 'm', value: `${m} kg` },
        { sym: 'I', value: `${I} kg m²` },
        { sym: 'k_x', value: `${kx} kN/m`, label: 'per end' },
        { sym: 'k_y', value: `${ky} kN/m`, label: 'per end' },
        { sym: 'a', value: `${a} m` },
        { sym: 'b', value: `${b} m` },
        { sym: 'c', value: `${c} m` },
      ];
      const Vok = '$V = \\tfrac12k_y(y + c\\theta)^2 + \\tfrac12k_y(y - b\\theta)^2 + \\tfrac12\\,2k_x(x + a\\theta)^2$';
      if (tier === 1) {
        return {
          prompt,
          figure: MachineFig,
          givens,
          parts: [
            {
              kind: 'choice',
              id: 'V',
              label: 'Which expression is the elastic potential energy?',
              options: [
                { text: Vok, correct: true, why: 'Each deflection is that of G plus rotation × lever arm (official 2017 A2(a)).' },
                { text: '$V = \\tfrac12\\,2k_yy^2 + \\tfrac12\\,2k_xx^2 + \\tfrac12[k_y(b^2 + c^2) + 2k_xa^2]\\theta^2$', correct: false, why: 'Split into translation and rotation: it loses the cross terms. Elastic energy cannot be separated this way (official 2017 note).' },
                { text: '$V = \\tfrac12k_y(y - c\\theta)^2 + \\tfrac12k_y(y + b\\theta)^2 + \\tfrac12\\,2k_x(x - a\\theta)^2$', correct: false, why: 'All signs reversed: that is clockwise θ. With θ anticlockwise the right end ($x_i = +c$) rises by $c\\theta$.' },
                { text: '$V = \\tfrac12k_y(y + c\\theta)^2 + \\tfrac12k_y(y - b\\theta)^2 + \\tfrac12k_x(x + a\\theta)^2$', correct: false, why: 'Each end has $k_x$, so the two ends give $2k_x$.' },
              ],
            },
            { kind: 'numeric', id: 'k13', label: '$K_{x\\theta}$', answer: K[0][2], unit: 'kN/rad', traps: far(K[0][2], [{ value: -K[0][2], message: 'With θ anticlockwise and the springs below G, the shear is $x + a\\theta$: $K_{x\\theta} = +2k_xa$.', trapId: 'sign' }, { value: kx * a, message: 'Both ends shear: $2k_xa$.', trapId: 'factor2' }]) },
            { kind: 'numeric', id: 'k23', label: '$K_{y\\theta}$', answer: K[1][2], unit: 'kN/rad', traps: far(K[1][2], [{ value: -K[1][2], message: 'Right end at $+c$, left at $-b$: $K_{y\\theta} = k_y(c - b)$.', trapId: 'sign' }]) },
          ],
          hints: [
            '“The deflection at a spring is that of the origin plus that due to rotation about the origin” (official 2017). Use $\\Delta x = x - y_i\\theta$, $\\Delta y = y + x_i\\theta$ with the springs at $(-b, -a)$ and $(c, -a)$.',
            `${Vok}; hence $K_{x\\theta} = 2k_xa$ and $K_{y\\theta} = k_y(c - b)$.`,
            `$2k_xa = 2 \\times ${kx} \\times ${a}$; $k_y(c - b) = ${ky}(${c} - ${b})$.`,
            `The correct $V$ is the one with the full deflections; $K_{x\\theta}$ = **${f4(K[0][2])} kN/rad**, $K_{y\\theta}$ = **${f4(K[1][2])} kN/rad**.`,
          ],
        };
      }
      if (tier === 2) {
        const fx = hz(Math.sqrt((2 * kx * 1e3) / m));
        const fr = hz(Math.sqrt((2 * ky * 1e3 * b * b) / I));
        const Kflip = clone(K);
        Kflip[0][2] = Kflip[2][0] = -K[0][2];
        Kflip[1][2] = Kflip[2][1] = -K[1][2];
        return {
          prompt,
          figure: MachineFig,
          givens,
          parts: [
            { kind: 'matrix', id: 'K', label: 'Stiffness matrix $K$ (kN/m, kN/rad, kN m/rad)', answer: K, rowLabels: XYT, colLabels: XYT, unit: 'kN/m, kN/rad, kN m/rad', tol: 0.005, traps: farM(K, [{ value: Kflip, message: 'Both coupling terms have flipped sign: that is clockwise θ. Follow the figure’s anticlockwise θ.', trapId: 'offdiag-sign' }]) },
            { kind: 'numeric', id: 'fx', label: 'Special case $a = 0$: sway natural frequency', answer: fx, unit: 'Hz', freq: true, traps: far(fx, [{ value: hz(Math.sqrt((kx * 1e3) / m)), message: 'Both ends resist sway: $\\omega^2 = 2k_x/m$.', trapId: 'a5-spring-count' }]) },
            { kind: 'numeric', id: 'fr', label: `Now also $c = b$ = ${b} m: rocking natural frequency`, answer: fr, unit: 'Hz', freq: true, traps: far(fr, [{ value: hz(Math.sqrt((ky * 1e3 * b * b) / I)), message: 'Two vertical springs, each $k_y$ at lever arm $b$: $\\omega^2 = 2k_yb^2/I$.', trapId: 'factor2' }]) },
          ],
          hints: [
            'Read $K$ from $V$; then a coordinate whose off-diagonal terms vanish is an SDOF with $\\omega^2 = K_{ii}/M_{ii}$.',
            'Official 2017: $K = [[2k_x, 0, 2k_xa],\\ [0, 2k_y, k_y(c - b)],\\ [2k_xa, k_y(c - b), 2k_xa^2 + k_y(b^2 + c^2)]]$. With $a = 0$: $\\omega_x^2 = 2k_x/m$. With $a = 0$ and $b = c$: $\\omega_y^2 = 2k_y/m$, $\\omega_\\theta^2 = 2k_yb^2/I$.',
            `$2k_xa = ${t4(2 * kx * a)}$, $k_y(c - b) = ${t4(K[1][2])}$, $K_{33} = ${t4(K[2][2])}$; $\\omega_x = \\sqrt{2 \\times ${kx}\\times10^3/${m}}$; $\\omega_\\theta = \\sqrt{2 \\times ${ky}\\times10^3 \\times ${b}^2/${I}}$.`,
            `**$K = ${mtex(K)}$**; sway (a = 0) **${f4(fx)} Hz**; rock (a = 0, b = c) **${f4(fr)} Hz** (and bounce ${f4(hz(Math.sqrt((2 * ky * 1e3) / m)))} Hz).`,
          ],
        };
      }
      const zeta = rng.pick([0.25, 0.3, 0.35, 0.4, 0.45]);
      const cx = r2((zeta * Math.sqrt(2 * kx * 1e3 * m)) / 1e3) * 1e3; // N s/m, 2 s.f. in kN s/m
      const sig = cx / m;
      const wd = Math.sqrt((2 * kx * 1e3) / m - sig * sig);
      const z = cx / Math.sqrt(2 * kx * 1e3 * m);
      return {
        prompt: `${prompt} In the decoupled case ($a = 0$), a damper $c_x$ = ${f4(cx / 1e3)} kN s/m acts horizontally at **each** end.`,
        figure: MachineFig,
        givens: [...givens, { sym: 'c_x', value: `${f4(cx / 1e3)} kN s/m`, label: 'each end' }],
        parts: [
          {
            kind: 'numeric',
            id: 're',
            label: 'Real part of the sway eigenvalue λ',
            answer: -sig,
            unit: '1/s',
            traps: far(-sig, [
              { value: (-2 * cx) / m, message: 'From $\\lambda^2 + (2c_x/m)\\lambda + 2k_x/m = 0$, the real part is half the coefficient: $-c_x/m$.', trapId: 'factor2' },
              { value: -cx / (2 * m), message: 'There are two dampers: the total is $2c_x$, so the real part is $-c_x/m$.', trapId: 'a5-spring-count' },
            ]),
          },
          {
            kind: 'numeric',
            id: 'im',
            label: 'Imaginary part of λ (positive root)',
            answer: wd,
            unit: 'rad/s',
            traps: far(wd, [{ value: Math.sqrt((2 * kx * 1e3) / m), message: 'That is the undamped $\\sqrt{2k_x/m}$. The imaginary part is the **damped** frequency $\\sqrt{2k_x/m - (c_x/m)^2}$.' }]),
          },
          { kind: 'numeric', id: 'zeta', label: 'Sway damping ratio ζ', answer: z, unit: '', traps: far(z, [{ value: z / 2, message: 'Two dampers act: $\\zeta = 2c_x/(2\\sqrt{2k_xm}) = c_x/\\sqrt{2k_xm}$.', trapId: 'factor2' }]) },
          {
            kind: 'choice',
            id: 'meaning',
            label: 'What do the parts of λ mean?',
            options: [
              { text: 'The real part is the exponential decay rate; the imaginary part is the damped natural frequency.', correct: true, why: 'Official 2017 A2(f): $x = x_0e^{\\lambda t} = x_0e^{-\\sigma t}e^{\\pm i\\omega_dt}$.' },
              { text: 'The real part is the natural frequency; the imaginary part is the damping ratio.', correct: false, why: 'Reversed and mislabelled: the imaginary part is in rad/s.' },
              { text: 'The magnitude $|\\lambda|$ is the damped natural frequency.', correct: false, why: '$|\\lambda| = \\sqrt{2k_x/m}$ is the **undamped** natural frequency.' },
            ],
          },
        ],
        hints: [
          'With $a = 0$ sway is an SDOF: $m\\ddot x + 2c_x\\dot x + 2k_xx = 0$. Put $x = x_0e^{\\lambda t}$, or write it as the first-order eigenvalue problem $[[0, 1], [-2k_x/m, -2c_x/m]]\\,[x; \\dot x] = \\lambda[x; \\dot x]$ (official 2017 A2(e)).',
          '$\\lambda = -c_x/m \\pm i\\sqrt{2k_x/m - (c_x/m)^2}$ (official 2017 A2(f)); $\\zeta = 2c_x/(2\\sqrt{2k_xm}) = c_x/\\sqrt{2k_xm}$.',
          `$c_x/m = ${t4(cx)}/${m} = ${t4(sig)}$ s⁻¹; $2k_x/m = ${t4((2 * kx * 1e3) / m)}$ s⁻².`,
          `$\\lambda$ = **${f4(-sig)}** ± **${f4(wd)}** i: decays as $e^{-${t4(sig)}t}$ and oscillates at ${f4(wd)} rad/s; ζ = **${f4(z)}**.`,
        ],
      };
    },
  },
];
