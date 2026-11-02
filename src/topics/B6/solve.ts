// B6: randomised B2 design problems (20-mark style). Each instance runs the summary-notes template:
// model and convert -> size for the frequency requirement -> f2, f3 -> choose the mode sketch -> torsion vs
// bending -> forced response -> added masses -> validity. Numbers follow the 2021–2025 papers' ranges.
import type { NumericPart, OrderPart, SolveGenerator, SolvePart } from '../../engine/types';
import { fmt } from '../../engine/format';
import { betaL } from '../../physics/beams';
import { endInertiaRoots } from '../../physics/waves';
import { farTraps } from '../B5/physics';
import { TAU, modalCoef, modalCoefMax, sectionFactor, torsionHz } from './physics';
import { sketchQuestion } from './sketches';
import { beamFigure, shaftDiscFigure, stackFigures } from '../B5/figures';

const f3 = (x: number) => fmt(x, 3);
const f4 = (x: number) => fmt(x, 4);
const CF = betaL('clamped-free', 3); // 1.8751, 4.6941, 7.8548
const R2 = (CF[1] / CF[0]) ** 2; // 6.267
const R3 = (CF[2] / CF[0]) ** 2; // 17.55
const K4 = 1.875 ** 4 / 3; // 4.12

type Trap = { value: number; message: string; trapId?: string };
function num(id: string, label: string, answer: number, unit: string, traps: Trap[] = [], extra: Partial<NumericPart> = {}): NumericPart {
  return { kind: 'numeric', id, label, answer, unit, traps: farTraps(answer, traps), ...extra };
}

/** "0.4L", or "L (the tip)" for x = 1. */
const at = (x: number) => (x >= 1 ? 'the tip' : `${x}L`);

const TEMPLATE_ORDER: OrderPart = {
  kind: 'order',
  id: 'steps',
  label: 'Put the B2 design steps in the order you would do them.',
  steps: [
    'Identify the boundary conditions and the section ($I/A$); convert every speed to rad/s',
    'Impose the frequency requirement $\\omega_1 \\ge n\\,\\Omega$ and solve for the free dimension',
    'Find $f_2$, $f_3$ by the ratio trick and sketch the modes with their nodes',
    'Sum the modes for the forced response at the worst speed and point; size the thickness or the force',
    'Estimate the effect of the added masses (Dunkerley) and state the model’s validity',
  ],
  marks: 2,
};

export const generators: SolveGenerator[] = [
  // ------------------------------------------------------------------ eVTOL wing (2022 archetype)
  {
    id: 'b6-wing',
    title: 'Design an eVTOL wing (cantilever, thin rectangle)',
    summary: 'Size the width for a critical-speed margin, find $f_2$ and $f_3$, pick the mode sketch, size the thickness for an amplitude limit, then add the rotor masses.',
    tiers: [1, 2, 3],
    source: 'Similar to 2022 B2.1–B2.5; official 2018 B2.1–B2.5 (A380 wing)',
    cardId: 'b6-template',
    marks: 20,
    sprint: false,
    generate(rng, tier) {
      const mat = rng.pick([
        { E: 230e9, rho: 1550 },
        { E: 250e9, rho: 1600 },
        { E: 280e9, rho: 1600 },
      ]);
      const L = rng.pick([2.5, 3, 3.5]);
      const N = rng.pick([1800, 2000, 2400, 3000]);
      const n = rng.pick([2, 2.5, 3]);
      const me0 = rng.pick([0.5, 1, 1.5]); // kg mm
      const xA = rng.pick([0.4, 0.5, 0.6]);
      const xB = rng.pick([0.85, 0.9, 1.0]);
      const ylim0 = rng.pick([0.05, 0.1, 0.2]); // mm
      const mu = rng.pick([0.1, 0.15, 0.2, 0.25]);
      const Om = (N * TAU) / 60;
      const w1 = n * Om;
      const s12 = Math.sqrt(mat.E / (12 * mat.rho));
      const w = (w1 * L * L) / (CF[0] ** 2 * s12);
      const f1 = w1 / TAU;
      const co = modalCoef('clamped-free', [xA, xB], 1, 1 / n);
      const coStatic = modalCoef('clamped-free', [xA, xB], 1, 0).total;
      const coB = modalCoef('clamped-free', [xB], 1, 1 / n).total;
      // Keep the answer a thin wing (t between 2 and 15 mm, as in 2022's 4.5 mm): if the drawn imbalance and
      // limit give an unrealistic thickness, use the nearest realistic pair instead (deterministic, no extra draws).
      const tFor = (m: number, y: number) => ((12 * ((co.total * m * 1e-3 * Om * Om * L ** 3) / (y * 1e-3))) / mat.E / w ** 3) * 1000;
      const okT = (x: number) => x >= 2 && x <= 15;
      let me = me0;
      let ylim = ylim0;
      if (!okT(tFor(me, ylim))) {
        const cands: { m: number; y: number; t: number }[] = [];
        for (const m of [0.5, 1, 1.5, 2]) for (const y of [0.05, 0.1, 0.2, 0.5]) cands.push({ m, y, t: tFor(m, y) });
        const best = cands.filter((c) => okT(c.t)).sort((a, b) => Math.abs(Math.log(a.t / 5)) - Math.abs(Math.log(b.t / 5)))[0];
        if (best) {
          me = best.m;
          ylim = best.y;
        }
      }
      const P = me * 1e-3 * Om * Om;
      const EIreq = (co.total * P * L ** 3) / (ylim * 1e-3);
      const Ireq = EIreq / mat.E;
      const t = (12 * Ireq) / w ** 3; // m
      const tA = K4 * mu * xA ** 3;
      const tB = K4 * mu * xB ** 3;
      const rD = 1 / Math.sqrt(1 + tA + tB);
      const sk = sketchQuestion(rng, { kind: 'cantilever', mode: rng.pick([2, 3] as const) });
      const Egpa = mat.E / 1e9;
      const prompt = `A carbon-fibre wing ($\\rho$ = ${mat.rho} kg/m³, $E$ = ${Egpa} GPa, $L$ = ${L} m) supports two rotors and is modelled as a uniform cantilever fixed at the aircraft centre, with a thin rectangular section of width $w$ (in the plane of the rotors’ unbalance forces) and thickness $t$. The rotors run at up to ${N} rpm, each with an imbalance $me$ = ${me} kg mm, at A ($x$ = ${xA}L) and B (${xB >= 1 ? 'at the tip, $x = L$' : `$x$ = ${xB}L`}), in phase. The lowest critical speed for in-plane bending must be at least ${n} times the maximum running speed. ${tier === 1 ? 'Neglect the rotors’ inertia.' : `Neglect the rotors’ inertia until the last part, where each rotor is ${Math.round(mu * 100)} % of the wing mass.`}`;
      const givens = [
        { sym: 'E, \\rho', value: `${Egpa} GPa, ${mat.rho} kg/m³` },
        { sym: 'L', value: `${L} m` },
        { sym: 'N_{max}', value: `${N} rpm` },
        { sym: 'n', value: `${n}`, label: 'critical-speed margin' },
        ...(tier >= 2
          ? [
              { sym: 'me', value: `${me} kg mm`, label: 'imbalance per rotor' },
              { sym: 'x_A, x_B', value: `${xA}L, ${xB}L`, label: 'rotor positions from the root' },
              { sym: 'y_{max}', value: `${ylim} mm`, label: 'amplitude limit' },
              { sym: 'm/\\rho AL', value: `${mu}`, label: 'each rotor' },
            ]
          : []),
      ];
      const parts: SolvePart[] = [
        num('Om', 'Maximum forcing frequency $\\Omega_{max}$', Om, 'rad/s', [], { freq: true, marks: 1 }),
        num('w', 'Minimum width $w$', w * 1000, 'mm', [
          { value: (w * 1000) / n, message: 'Apply the margin: $\\omega_1 = n\\,\\Omega_{max}$.' },
          { value: (w * 1000) / Math.sqrt(12), message: 'For a rectangle $I/A = w^2/12$, so the section factor is $\\sqrt{E/12\\rho}$, not $\\sqrt{E/\\rho}$.' },
          { value: (2 * w1 * L * L * 1000) / (CF[0] ** 2 * Math.sqrt(mat.E / (2 * mat.rho))), message: 'That is the thin-**tube** formula ($I/A = r^2/2$). The wing is a thin rectangle: $I/A = w^2/12$ in its plane.', trapId: 'b6-section' },
        ], { marks: 3 }),
        num('f2', 'Second critical frequency $f_2$', f1 * R2, 'Hz', [
          { value: f1 * 4, message: '×4 is the pinned–pinned ratio. Cantilever: $(4.694/1.875)^2 = 6.267$.' },
          { value: f1 * 2.756, message: '×2.756 is the free–free / clamped–clamped ratio. Cantilever: 6.267.' },
        ], { freq: true, marks: 1 }),
        num('f3', 'Third critical frequency $f_3$', f1 * R3, 'Hz', [
          { value: f1 * 9, message: '×9 is the pinned–pinned ratio. Cantilever: $(7.855/1.875)^2 = 17.55$.' },
          { value: f1 * 5.404, message: '×5.404 is the free–free / clamped–clamped ratio. Cantilever: 17.55.' },
        ], { freq: true, marks: 1 }),
        sk.part,
      ];
      if (tier === 1) parts.push(TEMPLATE_ORDER);
      if (tier >= 2) {
        parts.push(
          {
            kind: 'order',
            id: 'tsteps',
            label: 'Before computing: put the steps for sizing the thickness $t$ in order.',
            steps: [
              'Find the worst case: below $\\omega_1$ both $P = me\\Omega^2$ and the dynamic factors grow with speed, so take $\\Omega_{max}$ and the free tip',
              'Compute the unbalance force of each rotor, $P = me\\,\\Omega_{max}^2$',
              'Tabulate $[Y_i(x_A) + Y_i(x_B)]\\,Y_i(L)/[(\\beta_iL)^4(1 - \\Omega^2/\\omega_i^2)]$ for three modes and sum them to get $S$',
              'Require $y(L) = S\\,PL^3/EI \\le y_{max}$, so $EI \\ge S\\,PL^3/y_{max}$',
              'With $I = t\\,w^3/12$ (bending in the wing’s plane) solve for $t$; the frequencies do not change',
            ],
            marks: 2,
          },
          num('S', 'Tip response coefficient $y(L)/(PL^3/EI)$ at $\\Omega_{max}$, both rotors, 3 modes', co.total, '', [
            { value: coStatic, message: 'You left out the dynamic factors $1/(1 - \\Omega^2/\\omega_i^2)$: that is the static deflection.' },
            { value: coB, message: 'Both rotors push in phase: add rotor A’s contribution too.' },
          ], { marks: 2 }),
          num('t', 'Minimum thickness $t$ for the amplitude limit at all take-off speeds', t * 1000, 'mm', [
            { value: ((12 * ((co.total * me * 1e-3 * Om * L ** 3) / (ylim * 1e-3))) / mat.E / w ** 3) * 1000, message: 'The unbalance force is $P = me\\,\\Omega^2$: you used $\\Omega$, not $\\Omega^2$.', trapId: 'unbalance-omega2' },
            { value: Math.cbrt((12 * Ireq) / w) * 1000, message: 'Wrong bending plane: the forces act in the wing’s plane, so $I = t\\,w^3/12$, not $w\\,t^3/12$.', trapId: 'b6-section' },
          ], { marks: 3 }),
          num('pct', 'Change in $f_1$ from the two rotor masses (Dunkerley, %)', 100 * (rD - 1), '%', [
            { value: 100 * (1 / Math.sqrt(1 + 2 * K4 * mu) - 1), message: 'Use the stiffness at each rotor, $3EI/x^3$, not the tip value for both.', trapId: 'b5-tip-stiffness' },
            { value: 100 * (1 / (1 + tA + tB) - 1), message: 'Take the square root of the frequency-squared ratio.', trapId: 'sqrt' },
            { value: 100 * rD, message: 'That is $f_1$ as a % **of** the bare value; give the % change.', trapId: 'b5-pct-change' },
          ], { marks: 3 }),
          {
            kind: 'choice',
            id: 'dom',
            label: 'Which rotor has the bigger effect on $f_1$, and why?',
            options: [
              { text: `B at ${at(xB)}: it sits where mode 1 moves most (the wing is most flexible there), so it adds the most kinetic energy.`, correct: true, why: `Dunkerley terms: B ${f3(tB)} vs A ${f3(tA)} (ratio $(x_B/x_A)^3$ = ${f3((xB / xA) ** 3)}).` },
              { text: 'A: it is closer to the root, where the bending moment is largest.', correct: false, why: 'Frequency shifts come from kinetic energy at the mass; mode 1 barely moves near the root.' },
              { text: 'Neither: equal masses have equal effects.', correct: false, why: 'Position matters: the Dunkerley term grows as $x^3$.' },
            ],
            marks: 1,
          }
        );
      }
      if (tier === 3) {
        const fout = (f1 * t) / w;
        const rc = (0.2 * Om) / (fout * TAU);
        parts.push(
          num('fout', 'Out-of-plane first natural frequency (bending across $t$)', fout, 'Hz', [
            { value: (f1 * w) / t, message: 'Inverted: out of plane the section depth is $t \\ll w$, so the frequency is lower by $t/w$.' },
            { value: (f1 * t * t) / (w * w), message: 'Frequency scales as the depth ($\\omega \\propto h$), not its square (that is the stiffness ratio).' },
          ], { freq: true, marks: 2 }),
          {
            kind: 'choice',
            id: 'cruise',
            label: 'In cruise the spin axes tilt so the unbalance bends the wing **out of plane**, at 20 % of the maximum speed. What can you say without calculation?',
            options: [
              { text: `The in-plane design does not cover it: out of plane the wing is $(w/t)^2$ ≈ ${f3((w / t) ** 2)} times more flexible and the forcing is ${f3(rc)} times its $f_1$, so it must be checked with the out-of-plane modes (it is likely larger).`, correct: true, why: 'This is the 2022 B2.4 argument: in-plane and out-of-plane frequencies differ by $t/w$, and the regime (above $f_{1,out}$) changes.' },
              { text: 'It is smaller, because the force is only 4 % of the take-off force.', correct: false, why: 'A static scaling ignores both the much lower stiffness and the change of regime relative to $f_{1,out}$.' },
              { text: 'It is the same: same wing, same rotors.', correct: false, why: 'The bending plane changes, and with it $I$ by $(t/w)^2$.' },
            ],
            marks: 2,
          },
          {
            kind: 'choice',
            id: 'valid',
            label: 'The fixed-root (cantilever) model assumes that…',
            options: [
              { text: 'the fuselage is much heavier and stiffer than the wing, so its motion at the root is negligible', correct: true, why: 'Official 2018 B2.5. A flexible or light support would lower the real frequencies.' },
              { text: 'the wing is much heavier than the fuselage', correct: false, why: 'The reverse: the support must dominate.' },
              { text: 'the rotors are at the nodes of mode 1', correct: false, why: 'Mode 1 of a cantilever has no interior node; this has nothing to do with the root.' },
            ],
            marks: 2,
          }
        );
      }
      const term = co.terms;
      return {
        prompt,
        givens,
        figure: stackFigures(beamFigure({ support: 'cantilever', masses: [], forces: [{ x: xA, label: 'rotor A', at: `${xA}L` }, { x: xB, label: 'rotor B', at: xB >= 1 ? 'L' : `${xB}L` }], length: `L = ${L} m`, caption: 'wing: cantilever fixed at the aircraft centre; unbalance meΩ² in the wing’s plane', label: 'Cantilever wing with two rotors' }), sk.figure),
        parts,
        hints: [
          'Template: (1) cantilever, thin rectangle bending in its plane, so $\\omega_i \\propto w$ and independent of $t$; (2) the margin fixes $w$; (3) ratio trick and sketch; (5) modal sum at the tip at the top speed fixes $t$ (the response $\\propto 1/EI \\propto 1/t$ at fixed frequencies); (6) the rotor masses lower $f_1$ (Dunkerley).',
          `$\\Omega_{max} = 2\\pi N/60$; $\\omega_1 = (\\beta_1L)^2\\dfrac{w}{L^2}\\sqrt{\\dfrac{E}{12\\rho}} \\ge n\\,\\Omega_{max}$; $f_i = (\\beta_iL/\\beta_1L)^2f_1$ (6.267, 17.55)${tier >= 2 ? '; $y(L) = \\dfrac{PL^3}{EI}\\sum_i \\dfrac{[Y_i(x_A) + Y_i(x_B)]\\,Y_i(L)}{(\\beta_iL)^4(1 - \\Omega^2/\\omega_i^2)}$ with $P = me\\,\\Omega^2$ and $I = t\\,w^3/12$; Dunkerley $(\\omega_{11}/\\omega_D)^2 = 1 + 4.12\\,\\mu[(x_A/L)^3 + (x_B/L)^3]$' : ''}.`,
          `$\\Omega_{max}$ = ${f4(Om)} rad/s; $\\omega_1 \\ge ${f4(w1)}$ rad/s ($f_1$ = ${f4(f1)} Hz); $\\sqrt{E/12\\rho} = ${f4(s12)}$ m/s.${tier >= 2 ? ` Modal terms at the tip ($\\Omega/\\omega_1 = ${f3(1 / n)}$): ${term.map((x) => `mode ${x.i}: $[${f3(x.yf)}](${f3(x.yo)})(${f4(x.dyn)})/${f4(x.bL4)} = ${f4(x.c)}$`).join('; ')}. $P = ${me}\\times10^{-3} \\times ${f4(Om)}^2 = ${f4(P)}$ N.` : ''}`,
          `$w = ${f4(w1)} \\times ${L}^2/(${f4(CF[0] ** 2)} \\times ${f4(s12)})$ = **${f4(w * 1000)} mm**; $f_2$ = **${f4(f1 * R2)} Hz**, $f_3$ = **${f4(f1 * R3)} Hz**.${
            tier >= 2
              ? ` Coefficient **${f4(co.total)}** (mode 1 alone ${f4(term[0].c)}). $EI \\ge ${f4(co.total)} \\times ${f4(P)} \\times ${L}^3/${ylim}\\times10^{-3} = ${f4(EIreq)}$ N m², $I = ${f4(Ireq)}$ m⁴, $t = 12I/w^3$ = **${f4(t * 1000)} mm**. Rotor masses: terms A ${f4(tA)}, B ${f4(tB)}, $\\omega_D/\\omega_{11} = ${f4(rD)}$: **${f3(100 * (rD - 1))} %**, dominated by **B**.`
              : ''
          }${tier === 3 ? ` Out of plane: $f_{1,out} = f_1\\,t/w$ = **${f4((f1 * t) / w)} Hz**.` : ''}`,
        ],
      };
    },
  },

  // ------------------------------------------------------------------ turbine blades (2025 tidal / 2023 wind archetypes)
  {
    id: 'b6-blade',
    title: 'Design check of a turbine blade (cantilevered thin tube)',
    summary: 'Length from a measured critical speed (tidal) or diameter from a margin (wind); $f_1$–$f_3$; torsion vs bending; the dominant mode or the largest allowable force; blade-tip masses.',
    tiers: [1, 2, 3],
    source: 'Similar to 2025 B2.1–B2.4 (tidal blade) and 2023 B2.1–B2.5 (wind-turbine blade)',
    cardId: 'b6-torsion',
    marks: 20,
    sprint: false,
    generate(rng, tier) {
      if (tier <= 2) {
        const E = rng.pick([35, 40, 45]) * 1e9;
        const rho = rng.pick([1850, 1900, 1950]);
        const nu = 0.3;
        const d = rng.pick([0.15, 0.2, 0.25]);
        const N1 = rng.pick([150, 165, 180, 200, 220]);
        const q = rng.pick([2.6, 3.0, 3.4, 5.3, 5.7]);
        const dpc = rng.pick([3, 4, 5, 6]);
        const w1 = (N1 * TAU) / 60;
        const s2 = sectionFactor('tube', d, E, rho);
        const L = Math.sqrt((CF[0] ** 2 * s2) / w1);
        const f1 = N1 / 60;
        const c = Math.sqrt(E / (2 * (1 + nu)) / rho);
        const T1 = 60 * torsionHz('fixed-free', 1, c, L);
        const co = modalCoef('clamped-free', [2 / 3], 1, q);
        const dom = co.terms.reduce((b, x) => (Math.abs(x.c) > Math.abs(b.c) ? x : b));
        const share = (x: { c: number }) => (100 * Math.abs(x.c)) / co.terms.reduce((s, y) => s + Math.abs(y.c), 0);
        const r = 1 - dpc / 100;
        const muD = (3 * (1 / (r * r) - 1)) / 1.875 ** 4;
        const sk = sketchQuestion(rng, { kind: 'cantilever', mode: rng.pick([2, 3] as const) });
        const parts: SolvePart[] = [
          num('L', 'Blade length $L$ from the measured critical speed', L, 'm', [
            { value: L * Math.SQRT2, message: 'Use the radius $r = d/2$ in $\\omega_1 = (\\beta_1L)^2(r/L^2)\\sqrt{E/2\\rho}$, not $d$.' },
            { value: Math.sqrt((CF[0] ** 2 * s2) / f1), message: 'Convert the critical speed to rad/s ($2\\pi N/60$) before solving for $L$.', trapId: 'units' },
            { value: Math.sqrt((CF[0] ** 2 * sectionFactor('rect', d, E, rho)) / w1), message: 'That is the rectangle formula. A thin tube has $I/A = r^2/2$: factor $r\\sqrt{E/2\\rho}$.', trapId: 'b6-section' },
          ], { marks: 3 }),
          num('f2', 'Second transverse natural frequency $f_2$', f1 * R2, 'Hz', [{ value: f1 * 4, message: 'Cantilever ratio is 6.267, not 4 (pinned).' }], { freq: true, marks: 1 }),
          num('f3', 'Third transverse natural frequency $f_3$', f1 * R3, 'Hz', [{ value: f1 * 9, message: 'Cantilever ratio is 17.55, not 9 (pinned).' }], { freq: true, marks: 1 }),
          sk.part,
          num('T1', 'First torsional critical speed', T1, 'rpm', [
            { value: 60 * (Math.sqrt(E / rho) / (4 * L)), message: 'Torsion uses the shear modulus: $c = \\sqrt{G/\\rho}$ with $G = E/2(1 + \\nu)$.', trapId: 'b6-torsion-G' },
            { value: 60 * (c / (2 * L)), message: 'Fixed at the axis, free at the tip: $f_1 = c/4L$, not $c/2L$.' },
          ], { freq: true, marks: 2 }),
        ];
        if (tier === 1)
          parts.push({
            kind: 'order',
            id: 'steps',
            label: 'Put the steps of this blade check in order.',
            steps: [
              'Model: cantilevered thin tube fixed at the axis; convert the critical speed to rad/s',
              'Invert $\\omega_1 = (\\beta_1L)^2(r/L^2)\\sqrt{E/2\\rho}$ for the length $L$',
              'Find $f_2$ and $f_3$ with the ratio trick (6.267, 17.55) and sketch the modes with their nodes',
              'Torsion: $G = E/2(1 + \\nu)$, $c = \\sqrt{G/\\rho}$, $f_n = (2n - 1)c/4L$, independent of $d$ and $t$',
              'Compare the excitation with every natural frequency (bending and torsion) and judge which modes respond',
            ],
            marks: 2,
          });
        if (tier === 2) {
          const labels = ['transverse mode 1', 'transverse mode 2', 'transverse mode 3'];
          parts.push(
            num('T2', 'Second torsional critical speed', 3 * T1, 'rpm', [{ value: 2 * T1, message: 'Fixed–free torsion is spaced 1 : 3 : 5, not 1 : 2 : 3.' }], { freq: true, marks: 1 }),
            {
              kind: 'order',
              id: 'domsteps',
              label: 'Put the steps for deciding which mode dominates the tip response in order.',
              steps: [
                'Form $\\Omega/\\omega_1$ from the excitation, then $\\Omega/\\omega_i = (\\Omega/\\omega_1)(\\beta_1L/\\beta_iL)^2$ for modes 2 and 3',
                'Evaluate each mode shape at the load ($x = 2L/3$) and at the output point (the tip)',
                'Form each modal term $Y_i(x_e)Y_i(L)/[(\\beta_iL)^4(1 - \\Omega^2/\\omega_i^2)]$, negative above its resonance',
                'Compare the magnitudes: the largest term dominates; check the torsional frequencies against the excitation too',
              ],
              marks: 2,
            },
            {
              kind: 'choice',
              id: 'dom',
              label: `The fluid excitation is at ${q} times the first critical speed, applied at $x = 2L/3$. Which mode dominates the tip response?`,
              options: [
                ...labels.map((lab, k) => ({
                  text: lab.charAt(0).toUpperCase() + lab.slice(1),
                  correct: k + 1 === dom.i,
                  why: `Tip contribution ${f4(co.terms[k].c)} $PL^3/EI$ (${f3(share(co.terms[k]))} % of the total magnitude): $Y_${k + 1}(2L/3) = ${f3(co.terms[k].yf)}$, dynamic factor ${f3(co.terms[k].dyn)}, divided by $(\\beta_${k + 1}L)^4$ = ${f4(co.terms[k].bL4)}.`,
                })),
                { text: 'Torsional mode 1', correct: false, why: `The torsional critical speeds start at ${f4(T1)} rpm, far above the ${f3(q * N1)} rpm excitation: the torque only twists the blade quasi-statically.` },
              ],
              marks: 2,
            },
            num('tm', `Blade-tip mass for a ${dpc} % drop in the first critical speed (Dunkerley, % of the tube mass)`, 100 * muD, '%', [
              { value: (100 * 3 * (1 / r - 1)) / 1.875 ** 4, message: 'Square the frequency ratio: $1/r^2 - 1$.', trapId: 'b5-drop-ratio' },
              { value: (100 * 3 * (1 / (dpc / 100) ** 2 - 1)) / 1.875 ** 4, message: `The frequency ratio is $r_f = 1 - ${dpc / 100}$, not the drop.`, trapId: 'b5-drop-ratio' },
            ], { marks: 3 }),
            {
              kind: 'choice',
              id: 'torque',
              label: 'The fluid force acts 100 mm off the tube axis. What does the offset add?',
              options: [
                { text: 'A torque $0.1P$ that excites torsional modes 1 and 3 but not mode 2 (its node is at $2L/3$), and only quasi-statically, far below their frequencies.', correct: true, why: 'Fixed–free torsional mode 2, $\\sin(3\\pi x/2L)$, has its node exactly at $2L/3$.' },
                { text: 'Nothing: torsion is independent of the force position.', correct: false, why: 'A force through the shear centre causes no twist; an offset force adds a torque.' },
                { text: 'A torque that resonates the first torsional mode.', correct: false, why: `The torsional frequencies (${f4(T1)} rpm and up) are far above the excitation.` },
              ],
              marks: 2,
            }
          );
        }
        return {
          prompt: `The composite blades of a tidal-stream turbine ($\\rho$ = ${rho} kg/m³, $E$ = ${E / 1e9} GPa, $\\nu$ = 0.3) are modelled as cantilevered thin tubes of diameter $d$ = ${d * 1000} mm fixed at the turbine axis. Commissioning tests put the first transverse critical speed at ${N1} rpm.${tier === 2 ? ` A fluid force $P\\sin\\Omega t$ acts at $x = 2L/3$, 100 mm off the tube axis, at ${q} times the first critical speed. Later, blade tips lower the measured critical speed by ${dpc} %.` : ''} Thin tube: $I \\approx \\pi r^3t$, $A \\approx 2\\pi rt$.`,
          givens: [
            { sym: 'E, \\rho, \\nu', value: `${E / 1e9} GPa, ${rho} kg/m³, 0.3` },
            { sym: 'd', value: `${d * 1000} mm` },
            { sym: 'N_1', value: `${N1} rpm`, label: 'first transverse critical speed' },
          ],
          figure: stackFigures(beamFigure({ support: 'cantilever', masses: [], forces: tier === 2 ? [{ x: 2 / 3, label: 'P sin Ωt', at: '2L/3' }] : [], length: 'L = ?', caption: `tidal blade: thin tube Ø${d * 1000} mm fixed at the turbine axis`, label: 'Cantilevered tidal blade' }), sk.figure),
          parts,
          hints: [
            'Cantilevered thin tube: $\\omega_i = (\\beta_iL)^2(r/L^2)\\sqrt{E/2\\rho}$, independent of $t$; invert for $L$. Torsion of a uniform shaft: $c = \\sqrt{G/\\rho}$, fixed–free $f_n = (2n - 1)c/4L$, independent of $d$ and $t$.',
            `$L = \\sqrt{(\\beta_1L)^2 r\\sqrt{E/2\\rho}/\\omega_1}$; $f_2 = 6.267f_1$, $f_3 = 17.55f_1$; $G = E/2(1 + \\nu)$; rpm $= 60f$.${tier === 2 ? ' Dominant mode: compare $Y_i(2L/3)Y_i(L)/[(\\beta_iL)^4(1 - \\Omega^2/\\omega_i^2)]$. Tip mass: $\\mu = 3(1/r_f^2 - 1)/1.875^4$ with the frequency ratio $r_f = 1 - \\text{drop}$ (not the tube radius).' : ''}`,
            `$\\omega_1 = 2\\pi(${N1})/60 = ${f4(w1)}$ rad/s; $r\\sqrt{E/2\\rho} = ${f4(s2)}$ m²/s; $G = ${f4(E / 2.6 / 1e9)}$ GPa, $c = ${f4(c)}$ m/s.${tier === 2 ? ` Tip terms: ${co.terms.map((x) => `mode ${x.i} ${f4(x.c)}`).join(', ')}; $r_f = ${f4(r)}$.` : ''}`,
            `$L$ = **${f4(L)} m**; $f_1$ = ${f4(f1)} Hz, $f_2$ = **${f4(f1 * R2)} Hz**, $f_3$ = **${f4(f1 * R3)} Hz**; first torsional critical speed $60c/4L$ = **${f4(T1)} rpm**${tier === 2 ? ` (then ×3, ×5: **${f4(3 * T1)}** rpm). Dominant: **${['transverse mode 1', 'transverse mode 2', 'transverse mode 3'][dom.i - 1]}** (${f3(share(dom))} %). Tip mass **${f3(100 * muD)} %** of the tube mass (Dunkerley; Rayleigh with the bare mode ${f3(25 * (1 / (r * r) - 1))} %).` : '.'}`,
          ],
        };
      }
      // tier 3: wind-turbine blade, size the diameter (2023 archetype)
      const E = rng.pick([12, 13.23, 15]) * 1e9;
      const rho = rng.pick([1800, 1820]);
      const G = rng.pick([4.5, 4.79, 5.2]) * 1e9;
      const L = rng.pick([70, 80, 86.4, 95]);
      const V = rng.pick([120, 135, 150]);
      const q = rng.pick([1.5, 1.8, 2]);
      const n = rng.pick([2, 2.5]);
      const Om = V / L;
      const wexc = q * Om;
      const w1 = n * wexc;
      const s2u = Math.sqrt(E / (2 * rho));
      const r = (w1 * L * L) / (CF[0] ** 2 * s2u);
      const d = 2 * r;
      const f1 = w1 / TAU;
      const c = Math.sqrt(G / rho);
      const ft1 = torsionHz('fixed-free', 1, c, L);
      const S = modalCoef('clamped-free', [0.5], 1, 1 / n).total;
      const tw = 0.005 * d;
      const EI = E * Math.PI * r ** 3 * tw;
      const ylim = 0.005 * L;
      const Pmax = (ylim * EI) / (S * L ** 3);
      const sk = sketchQuestion(rng, { kind: 'torsion-ff', mode: 2 });
      return {
        prompt: `A wind-turbine blade ($\\rho$ = ${rho} kg/m³, $E$ = ${f4(E / 1e9)} GPa, $G$ = ${f4(G / 1e9)} GPa, $L$ = ${L} m) is modelled as a cantilevered thin tube of diameter $d$ and wall $t = 0.005d$, fixed at the hub. The tip speed is at most ${V} m/s. A bearing defect applies $P\\sin(${q}\\Omega t)$ at mid-length. The first transverse critical speed must be at least ${n} times the defect frequency, and the vibration amplitude must stay below 0.5 % of $L$.`,
        givens: [
          { sym: 'E, G, \\rho', value: `${f4(E / 1e9)} GPa, ${f4(G / 1e9)} GPa, ${rho} kg/m³` },
          { sym: 'L', value: `${L} m` },
          { sym: 'V_{tip}', value: `${V} m/s` },
          { sym: 'n', value: `${n}`, label: 'margin over the defect frequency' },
        ],
        figure: stackFigures(beamFigure({ support: 'cantilever', masses: [], forces: [{ x: 0.5, label: `P sin(${q}Ωt)`, at: 'L/2' }], length: `L = ${L} m`, caption: 'wind-turbine blade: thin tube, wall 0.005d, fixed at the hub', label: 'Cantilevered blade with the defect force at mid-length' }), sk.figure),
        parts: [
          num('Om', 'Maximum rotor speed $\\Omega$', Om, 'rad/s', [], { freq: true, marks: 1 }),
          num('d', 'Minimum tube diameter $d$', d, 'm', [
            { value: r, message: 'That is the radius; the question asks for the diameter $d = 2r$.', trapId: 'factor2' },
            { value: (2 * (n * Om) * L * L) / (CF[0] ** 2 * s2u), message: `The defect acts at ${q}Ω: require $\\omega_1 \\ge ${n} \\times ${q}\\,\\Omega$.` },
          ], { marks: 3 }),
          num('f2', 'Second transverse natural frequency', f1 * R2, 'Hz', [], { freq: true, marks: 1 }),
          num('ft1', 'First torsional natural frequency', ft1, 'Hz', [
            { value: Math.sqrt(E / rho) / (4 * L), message: 'Torsion uses $c = \\sqrt{G/\\rho}$, not $\\sqrt{E/\\rho}$.', trapId: 'b6-torsion-G' },
            { value: c / (2 * L), message: 'Fixed–free: $c/4L$.' },
          ], { freq: true, marks: 2 }),
          sk.part,
          {
            kind: 'order',
            id: 'psteps',
            label: 'Put the steps for the largest allowable defect force in order.',
            steps: [
              'Convert: $\\Omega = V/L$ and the defect frequency $q\\,\\Omega$',
              'Size the diameter from $\\omega_1 = n\\,q\\,\\Omega$ (thin tube: the wall cancels)',
              'Form $\\Omega_{exc}/\\omega_i$ for three modes and sum $Y_i(L/2)Y_i(L)/[(\\beta_iL)^4(1 - \\Omega^2/\\omega_i^2)]$ to get $S$',
              'With $t = 0.005d$, $EI = E\\pi r^3t$; then $P_{max} = y_{max}EI/(SL^3)$',
            ],
            marks: 2,
          },
          num('Pmax', 'Largest allowable defect force amplitude $P$', Pmax / 1e6, 'MN', [
            { value: (ylim * EI) / (modalCoef('clamped-free', [0.5], 1, 0).total * L ** 3) / 1e6, message: 'Include the dynamic factors (the forcing is at $\\omega_1/n$): the static coefficient underestimates the response.' },
            { value: (ylim * E * Math.PI * r ** 3 * 0.005 * r) / (S * L ** 3) / 1e6, message: 'The wall is $t = 0.005d$, not $0.005r$.', trapId: 'factor2' },
          ], { marks: 3 }),
          {
            kind: 'choice',
            id: 'valid',
            label: 'Which statement about this model’s validity is correct?',
            options: [
              { text: 'Rotation adds centrifugal tension, which raises the bending frequencies, so the non-rotating model is conservative for the frequency margin.', correct: true, why: 'Rayleigh with tension adds $\\int T(\\phi^{\\prime})^2dx$ to the numerator (2025 B1.4; 2023 B2.5).' },
              { text: 'The fixed root is exact whatever the hub and tower stiffness.', correct: false, why: 'A fixed root assumes a support much stiffer and heavier than the blade; real frequencies are lower otherwise.' },
              { text: 'A point force at mid-length excites mode 1 more strongly than a distributed load of the same total.', correct: false, why: 'A distributed load acts where mode 1 is large (towards the tip) too; the point force at $L/2$ under-excites mode 1 (about 16 % low, 2023 worked solution).' },
            ],
            marks: 2,
          },
        ],
        hints: [
          'Size for frequency first (thin tube: $\\omega \\propto d$, independent of $t$), then check the amplitude with the modal sum at the tip (the response depends on $EI = E\\pi r^3t$). Torsion of the uniform tube depends only on $c = \\sqrt{G/\\rho}$ and $L$.',
          `$\\Omega = V/L$; defect at ${q}Ω; $\\omega_1 = (\\beta_1L)^2(r/L^2)\\sqrt{E/2\\rho} \\ge ${n} \\times ${q}\\Omega$; torsion $f_1 = c/4L$; $y(L) = \\dfrac{PL^3}{EI}\\sum_i\\dfrac{Y_i(L/2)Y_i(L)}{(\\beta_iL)^4(1 - \\Omega^2/\\omega_i^2)}$ with $\\Omega/\\omega_1 = 1/${n}$.`,
          `$\\Omega = ${V}/${L} = ${f4(Om)}$ rad/s; $\\omega_1 \\ge ${f4(w1)}$ rad/s; $\\sqrt{E/2\\rho} = ${f4(s2u)}$ m/s; $c = ${f4(c)}$ m/s. Tip coefficient $S = ${f4(S)}$; $t = ${f4(tw)}$ m, $EI = ${f4(EI)}$ N m²; limit ${f4(ylim)} m.`,
          `$r = ${f4(w1)} \\times ${L}^2/(${f4(CF[0] ** 2)} \\times ${f4(s2u)}) = ${f4(r)}$ m, so $d$ = **${f4(d)} m**; $f_1$ = ${f4(f1)} Hz, $f_2$ = **${f4(f1 * R2)} Hz**; torsion $f_1$ = **${f4(ft1)} Hz**; $P_{max} = y_{max}EI/(SL^3)$ = **${f4(Pmax / 1e6)} MN**.`,
        ],
      };
    },
  },

  // ------------------------------------------------------------------ hydro shaft (2024 archetype)
  {
    id: 'b6-shaft',
    title: 'Design check of a hydropower shaft (torsion and bending)',
    summary: 'Length from the torsional critical speed, torsional and transverse frequencies, the sketch, the thickness change for a smaller response, and rotors at the bearings.',
    tiers: [1, 2, 3],
    source: 'Similar to 2024 B2.1–B2.6; summary notes B6 step 3',
    cardId: 'b6-torsion',
    marks: 18,
    sprint: false,
    generate(rng, tier) {
      const E = 210e9;
      const rho = 7850;
      const nu = 0.3;
      const G = E / (2 * (1 + nu));
      const c = Math.sqrt(G / rho);
      const d = rng.pick([0.5, 0.6, 0.7, 0.8]);
      const NT = rng.pick([6000, 6600, 7200, 7800, 8400]);
      const fT1 = NT / 60;
      const L = c / (2 * fT1);
      const s2 = sectionFactor('tube', d, E, rho);
      const fb1 = (Math.PI ** 2 * s2) / (L * L) / TAU;
      const X = rng.pick([20, 25, 30, 40]);
      const Nrun = rng.pick([100, 115.4, 125, 150]);
      const qd = rng.pick([1.2, 1.4, 1.6]);
      const xAd = rng.pick([0.4, 0.6]);
      const sk = sketchQuestion(rng, { kind: 'torsion-fx', mode: 2 });
      const parts: SolvePart[] = [
        num('L', 'Total shaft length $L$ (rotors fixed: torsion fixed–fixed)', L, 'm', [
          { value: c / (4 * fT1), message: 'Both ends are held by the rotors’ large inertia: fixed–fixed, $f_1 = c/2L$, not $c/4L$.' },
          { value: Math.sqrt(E / rho) / (2 * fT1), message: 'Torsion uses $c = \\sqrt{G/\\rho}$ with $G = E/2(1 + \\nu)$.', trapId: 'b6-torsion-G' },
        ], { marks: 3 }),
        num('fT2', 'Second torsional natural frequency', 2 * fT1, 'Hz', [{ value: 3 * fT1, message: 'Fixed–fixed torsion is spaced 1 : 2 : 3.' }], { freq: true, marks: 1 }),
        sk.part,
        num('fb1', 'First transverse natural frequency (pinned at the bearings, thin tube)', fb1, 'Hz', [
          { value: (4.73 ** 2 * s2) / (L * L) / TAU, message: '$\\beta_1L = 4.730$ is clamped–clamped; self-aligning bearings are pinned: $\\beta_iL = i\\pi$.' },
          { value: (Math.PI ** 2 * (d / 4) * Math.sqrt(E / rho)) / (L * L) / TAU, message: 'That uses a solid section ($I/A = d^2/16$). A thin tube has $I/A = r^2/2$.', trapId: 'b6-section' },
        ], { freq: true, marks: 2 }),
      ];
      if (tier >= 2) {
        parts.push(
          num('fb2', 'Second transverse natural frequency', 4 * fb1, 'Hz', [{ value: 2 * fb1, message: 'Bending frequencies go as $i^2$ (1 : 4 : 9); 1 : 2 : 3 is torsion.' }], { freq: true, marks: 1 }),
          {
            kind: 'choice',
            id: 'cmp',
            label: 'Compare the transverse and torsional behaviour of this shaft.',
            options: [
              { text: 'Both have $\\sin(i\\pi x/L)$ mode shapes, but bending frequencies go as $i^2$ (and $\\propto d$, independent of $t$) while torsional ones go as $i$ (independent of $d$ and $t$).', correct: true, why: 'Pinned–pinned bending and fixed–fixed torsion share the sine shapes; the spacing and the section dependence differ (2024 B2.4).' },
              { text: 'Both frequencies scale with $d$, so a bigger tube raises them equally.', correct: false, why: 'For a uniform shaft $J$ cancels in torsion: only bending scales with $d$.' },
              { text: 'Bending shapes have hyperbolic terms here, torsional shapes do not.', correct: false, why: 'With pinned ends the bending shapes are pure sines too.' },
            ],
            marks: 2,
          },
          {
            kind: 'order',
            id: 'tsteps',
            label: 'Put the reasoning for the thickness change in order.',
            steps: [
              'Thin-tube bending frequencies do not depend on $t$, so the dynamic factors at the running speed stay the same',
              'With the frequencies fixed, the response scales as $1/EI$, and $EI = E\\pi r^3t \\propto t$',
              'Set $y_{new}/y_{old} = 1 - X$, so $t_{new}/t = 1/(1 - X)$',
              'Convert to a percentage change of the wall thickness (positive: a thicker wall)',
            ],
            marks: 2,
          },
          num('tpct', `Change in wall thickness to cut the transverse response by ${X} % (frequencies unchanged)`, 100 * (1 / (1 - X / 100) - 1), '%', [
            { value: X, message: `The response scales as $1/t$ (thin tube $EI \\propto t$), so $t_{new}/t = 1/(1 - ${X / 100})$, not $1 + ${X / 100}$.`, trapId: 'b6-thickness' },
            { value: -X, message: 'A thicker wall reduces the response: the change in $t$ is positive.', trapId: 'sign' },
            { value: 100 * ((1 / (1 - X / 100)) ** (1 / 3) - 1), message: 'For a thin tube $I = \\pi r^3t$ is linear in $t$ (the cube law is for a solid rectangle’s depth).', trapId: 'b6-thickness' },
          ], { marks: 3 }),
          {
            kind: 'choice',
            id: 'rotors',
            label: 'The generator and turbine rotors are made heavier. They sit on the pinned bearings. The transverse critical speeds…',
            options: [
              { text: 'are essentially unchanged: the masses sit at nodes of every transverse mode', correct: true, why: 'A mass at a node adds no kinetic energy to that mode (2024 B2.6; summary notes trap 9).' },
              { text: 'all fall, because mass always lowers frequencies', correct: false, why: 'Only if the mass moves in the mode.' },
              { text: 'rise, because heavier rotors stiffen the bearings', correct: false, why: 'Mass adds no stiffness.' },
            ],
            marks: 2,
          }
        );
      }
      if (tier === 3) {
        const fexc = (qd * Nrun) / 60;
        const rr = fexc / fb1;
        const mx = modalCoefMax('pinned-pinned', [xAd], rr);
        parts.push(
          num('rr', `Ratio of the bearing-defect frequency (${qd} × ${Nrun} rpm) to the first transverse frequency`, rr, '', [
            { value: (qd * Nrun) / (60 * 4 * fb1), message: 'Compare with $f_1$, not $f_2$.' },
            { value: (qd * Nrun * TAU) / 60 / fb1, message: 'Mixed units: the defect frequency in rad/s against $f_1$ in Hz.', trapId: 'units' },
          ], { marks: 2 }),
          {
            kind: 'choice',
            id: 'where',
            label: `Where along the shaft is the response to the defect at $x = ${xAd}L$ largest?`,
            options: [
              { text: `Near mid-span (about $${f3(mx.at)}L$): mode 1 dominates below resonance and its antinode is at $L/2$.`, correct: true, why: `The 3-mode sum peaks at $x \\approx ${f3(mx.at)}L$ (coefficient ${f4(mx.value)} $PL^3/EI$).` },
              { text: 'At the defect, always.', correct: false, why: 'The response is a sum of mode shapes; the defect position only sets how strongly each is excited.' },
              { text: 'At the bearings.', correct: false, why: 'The bearings are nodes: zero transverse deflection.' },
            ],
            marks: 2,
          }
        );
      }
      if (tier === 1) parts.push(TEMPLATE_ORDER);
      return {
        prompt: `A hydropower generator shaft (steel: $\\rho$ = 7850 kg/m³, $E$ = 210 GPa, $\\nu$ = 0.3) is a thin tube of diameter ${d * 1000} mm connecting the generator and turbine rotors. For torsion, the rotors’ inertias are so large that both ends are fixed; for bending the shaft is pinned at the rotors’ bearings. The first torsional critical speed is measured at ${NT} rpm.${tier >= 2 ? ` A bearing defect at $x$ = ${xAd}L excites the shaft at ${qd} × the running speed of ${Nrun} rpm.` : ''}`,
        givens: [
          { sym: 'E, \\rho, \\nu', value: '210 GPa, 7850 kg/m³, 0.3' },
          { sym: 'd', value: `${d * 1000} mm`, label: 'thin tube' },
          { sym: 'N_{T1}', value: `${NT} rpm`, label: 'first torsional critical speed' },
        ],
        figure: stackFigures(beamFigure({ support: 'pinned', masses: [], forces: tier >= 2 ? [{ x: xAd, label: 'defect', at: `${xAd}L` }] : [], length: 'L (from the torsional critical speed)', caption: `hydro shaft: thin tube Ø${d * 1000} mm, pinned at the rotor bearings (bending)`, label: 'Hydro shaft pinned at the rotor bearings' }), sk.figure),
        parts,
        hints: [
          'Torsion of a uniform shaft depends only on $c = \\sqrt{G/\\rho}$ and $L$ (fixed–fixed: $f_n = nc/2L$), so the measured torsional speed gives $L$. Bending of the pinned thin tube: $\\omega_i = (i\\pi)^2(r/L^2)\\sqrt{E/2\\rho}$, independent of $t$; the response scales as $1/t$.',
          '$G = E/2(1 + \\nu)$; $c = \\sqrt{G/\\rho}$; $L = c/(2f_{T1})$; $f_{Ti} = i\\,f_{T1}$; $f_{bi} = i^2 f_{b1}$; $t_{new}/t = y_{old}/y_{new}$.',
          `$G = ${f4(G / 1e9)}$ GPa, $c = ${f4(c)}$ m/s, $f_{T1} = ${NT}/60 = ${f4(fT1)}$ Hz; $r\\sqrt{E/2\\rho} = ${f4(s2)}$ m²/s.`,
          `$L = ${f4(c)}/(2 \\times ${f4(fT1)})$ = **${f4(L)} m**; torsion ${f4(fT1)}, **${f4(2 * fT1)}**, ${f4(3 * fT1)} Hz; bending $f_{b1} = \\pi^2(${f4(s2)})/(${f4(L)}^2 \\cdot 2\\pi)$ = **${f4(fb1)} Hz**${tier >= 2 ? `, $f_{b2}$ = **${f4(4 * fb1)} Hz**; thickness **+${f3(100 * (1 / (1 - X / 100) - 1))} %**; heavier rotors at the bearings: **no change**` : ''}${tier === 3 ? `; defect ratio **${f4(((qd * Nrun) / 60) / fb1)}**, largest response near mid-span` : ''}.`,
        ],
      };
    },
  },

  // ------------------------------------------------------------------ hybrid half-axle in torsion (2021 archetype)
  {
    id: 'b6-axle',
    title: 'Torsional design of a hybrid-car half-axle',
    summary: 'Fixed–free vs fixed–fixed torsion, why the diameter cannot fix it, gear-reflected motor inertia, and the true drop with a huge end inertia.',
    tiers: [1, 2, 3],
    source: 'Similar to 2021 B2.1–B2.5; reader Sample Problem 6(b)',
    cardId: 'b6-mass-validity',
    marks: 16,
    sprint: false,
    generate(rng, tier) {
      const G = 80e9;
      const rho = 7850;
      const c = Math.sqrt(G / rho);
      const L = rng.pick([0.45, 0.5, 0.55, 0.6, 0.7]);
      const NRNS = rng.pick([2.2, 2.6, 3.0]);
      const GR2 = rng.pick([2.5, 3.1, 3.5]);
      const GRW = rng.pick([0.3, 0.33, 0.36, 0.39]);
      const k1 = rng.pick([2, 4, 6]);
      const k2 = rng.pick([3, 6, 9]);
      const fA1 = c / (4 * L);
      // Speed ratios rounded as printed (3 s.f.), so the stated data reproduce the answers and the hints exactly.
      const n1 = Number((NRNS / GRW).toPrecision(3));
      const n2 = Number((GR2 / GRW).toPrecision(3));
      const IeffR = n1 * n1 * k1 + n2 * n2 * k2; // Ieff / Ia
      const IeR = IeffR / 2;
      const z = endInertiaRoots(1 / IeR, 1)[0];
      const chg = 100 * (z / (Math.PI / 2) - 1);
      const sk = sketchQuestion(rng, { kind: 'torsion-ff', mode: rng.pick([2, 3] as const) });
      const parts: SolvePart[] = [
        num('fA1', 'Case A (wheel fixed, motor end free): first torsional natural frequency', fA1, 'Hz', [
          { value: c / (2 * L), message: 'Fixed–free: $f_1 = c/4L$ (quarter wave), not $c/2L$.' },
        ], { freq: true, marks: 2 }),
        {
          kind: 'choice',
          id: 'ratios',
          label: 'Case B (both ends fixed): its first three natural frequencies as multiples of case A’s first are…',
          options: [
            { text: '2, 4, 6', correct: true, why: 'Case A: $(2n - 1)\\pi c/2L$ = 1, 3, 5 × $\\omega_{A1}$; case B: $n\\pi c/L$ = 2, 4, 6 × $\\omega_{A1}$.' },
            { text: '1, 3, 5', correct: false, why: 'Those are case A’s own modes.' },
            { text: '1, 2, 3', correct: false, why: 'Case B’s first mode is a half wave over $L$, twice case A’s quarter wave.' },
            { text: '4, 16, 36', correct: false, why: 'Squares belong to bending; torsion is a wave equation, linear in $n$.' },
          ],
          marks: 2,
        },
        {
          kind: 'choice',
          id: 'diam',
          label: 'Can the designer triple case A’s first critical speed by changing the axle diameter?',
          options: [
            { text: 'No: stiffness $GJ/L$ and inertia $\\rho JL$ both scale with $J$, so $\\omega = (\\pi/2L)\\sqrt{G/\\rho}$ does not depend on $d$.', correct: true, why: '2021 B2.3 (worked). Only $L$, the material or the boundary conditions change it.' },
            { text: 'Yes: $\\omega \\propto d$, so triple the diameter.', correct: false, why: 'That is thin-tube **bending**; torsion of a uniform shaft is independent of $d$.' },
            { text: 'Yes: $\\omega \\propto d^2$, so increase it by $\\sqrt3$.', correct: false, why: '$J \\propto d^4$ cancels between stiffness and inertia.' },
          ],
          marks: 2,
        },
        sk.part,
      ];
      if (tier >= 2) {
        parts.push(
          num('Ieff', 'Effective motor inertia at the axle, $I_{eff}/I_a$', IeffR, '', [
            { value: n1 * k1 + n2 * k2, message: 'Kinetic-energy equivalence uses the **square** of each speed ratio.' },
            { value: k1 / (n1 * n1) + k2 / (n2 * n2), message: 'Inverted: the motors spin faster than the axle, so their inertia is multiplied by $(\\omega_{motor}/\\omega_{axle})^2$.' },
          ], { marks: 3 }),
          num('ratio', 'Lowest torsional critical speed with $I_e = I_{eff}/2$ at each half-axle’s free end, as a fraction of case A’s: $\\omega_1/\\omega_{A1}$', z / (Math.PI / 2), '', [
            { value: 2, message: 'Treating the heavy end as **fixed** gives case B (2 × case A); a finite end inertia instead pulls the frequency far **down**.', trapId: 'b6-end-inertia' },
            { value: endInertiaRoots(1 / IeffR, 1)[0] / (Math.PI / 2), message: 'Each half-axle carries **half** of the effective inertia: $I_e = I_{eff}/2$.' },
          ], { marks: 3 }),
          num('chg', 'Change in the lowest torsional critical speed (%)', chg, '%', [
            { value: 100, message: 'Treating the heavy end as **fixed** predicts +100 % (case B); a finite end inertia instead pulls the frequency far **down**.', trapId: 'b6-end-inertia' },
          ], { marks: 1, tol: 0.003 }),
        );
      }
      if (tier === 1)
        parts.push({
          kind: 'order',
          id: 'steps',
          label: 'Put the steps of this torsional check in order.',
          steps: [
            'Identify the boundary conditions of each case (A: fixed–free, B: fixed–fixed)',
            'Compute the torsional wave speed $c = \\sqrt{G/\\rho}$',
            'Case A: $f_n = (2n - 1)c/4L$; case B: $f_n = nc/2L$',
            'Express case B’s frequencies as multiples of case A’s first: 2, 4, 6',
            'Explain why the diameter cannot change them: $J$ multiplies both $GJ$ and $\\rho J$',
          ],
          marks: 2,
        });
      if (tier === 2)
        parts.push({
          kind: 'order',
          id: 'isteps',
          label: 'Put the steps for the true lowest critical speed with the motors in order.',
          steps: [
            'Reflect each motor’s inertia to the axle with its squared speed ratio: $I_{eff} = \\sum_k n_k^2I_k$',
            'Give each half-axle half of it at its free end: $I_e = I_{eff}/2$',
            'Form $I_a/I_e$ and solve $z\\tan z = I_a/I_e$ for the smallest root $z_1$',
            'Compare $\\omega_1 = z_1c/L$ with case A’s $(\\pi/2)c/L$ as a % change',
          ],
          marks: 2,
        });
      if (tier === 3) {
        const zS = Math.sqrt(1 / IeR); // massless shaft: omega = sqrt(kt/Ie) -> z = sqrt(Ia/Ie)
        parts.push({
          kind: 'choice',
          id: 'model',
          label: 'Which simple model reproduces this exact result well?',
          options: [
            { text: `The end inertia on a massless shaft, $\\omega = \\sqrt{k_t/I_e}$ (within ${f3((100 * Math.abs(zS - z)) / z)} %).`, correct: true, why: 'With $I_e \\gg I_a$ the shaft acts as a torsional spring; Dunkerley and Rayleigh bracket the exact value even more tightly.' },
            { text: 'The fixed–fixed shaft (case B).', correct: false, why: 'That predicts a rise; the real fundamental drops by about 97 %.' },
            { text: 'The bare fixed–free shaft (case A).', correct: false, why: 'It ignores the motor inertia that dominates the kinetic energy.' },
          ],
          marks: 2,
        });
        parts.push({ ...TEMPLATE_ORDER, label: 'Order the steps for this torsional design check.', steps: ['Identify the boundary conditions of each case (fixed–free, fixed–fixed)', 'Write $c = \\sqrt{G/\\rho}$ and the frequency ratios of the two cases', 'Note that the diameter cancels (uniform shaft)', 'Reflect the motor inertias to the axle with the squared speed ratios', 'Solve $z\\tan z = I_a/I_e$ for the true fundamental and compare'] });
      }
      return {
        prompt: `A hybrid car’s half-axle (steel: $G$ = 80 GPa, $\\rho$ = 7850 kg/m³, length ${L} m, uniform diameter) is modelled in torsion. Case A: wheel fixed, motor end free. Case B: both ends fixed.${tier >= 2 ? ` The motor end actually carries two motor-generators geared to the axle: MG1 ($I = ${k1}I_a$) turns ${f3(n1)} times as fast as the axle and MG2 ($I = ${k2}I_a$) ${f3(n2)} times as fast, where $I_a = \\rho JL$ is one half-axle’s polar inertia. Each half-axle carries half of the effective inertia.` : ''}`,
        givens: [
          { sym: 'G, \\rho', value: '80 GPa, 7850 kg/m³' },
          { sym: 'L', value: `${L} m` },
          ...(tier >= 2
            ? [
                { sym: 'I_{MG1}, I_{MG2}', value: `${k1} Iₐ, ${k2} Iₐ` },
                { sym: 'n_1, n_2', value: `${f3(n1)}, ${f3(n2)}`, label: 'motor speed / axle speed' },
              ]
            : []),
        ],
        figure: stackFigures(shaftDiscFigure(`uniform half-axle, L = ${L} m`, tier >= 2 ? 'motor inertia Iₑ (geared)' : undefined, 'case A: wheel end fixed (left), motor end at the right'), sk.figure),
        parts,
        hints: [
          'Uniform shaft in torsion: $c = \\sqrt{G/\\rho}$; fixed–free $\\omega_n = (2n - 1)\\pi c/2L$, fixed–fixed $\\omega_n = n\\pi c/L$; no diameter dependence. A geared inertia appears at the axle multiplied by (speed ratio)²; a finite end inertia gives $z\\tan z = I_a/I_e$.',
          `$f_{A1} = c/4L$; case B / case A = $2n$; $I_{eff} = n_1^2I_{MG1} + n_2^2I_{MG2}$; $z = \\omega L/c$ with $z\\tan z = I_a/I_e$; change $= 100(z_1/(\\pi/2) - 1)$ %.`,
          `$c = ${f4(c)}$ m/s; $f_{A1} = ${f4(c)}/(4 \\times ${L})$.${tier >= 2 ? ` $I_{eff}/I_a = ${f3(n1)}^2 \\times ${k1} + ${f3(n2)}^2 \\times ${k2}$; $I_e/I_a = ${f4(IeR)}$, so $z\\tan z = ${f4(1 / IeR)}$.` : ''}`,
          `$f_{A1}$ = **${f4(fA1)} Hz**; case B: **2, 4, 6** × $\\omega_{A1}$; diameter: **no effect**.${tier >= 2 ? ` $I_{eff}$ = **${f4(IeffR)} $I_a$**; $z_1 = ${f4(z)}$, so $\\omega_1/\\omega_{A1} = z_1/(\\pi/2)$ = **${f4(z / (Math.PI / 2))}**, a change of **${f3(chg)} %** (a fixed-end model would wrongly predict +100 %).` : ''}`,
        ],
      };
    },
  },
];
