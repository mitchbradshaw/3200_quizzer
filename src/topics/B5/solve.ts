// B5 problem generators: inverse and forward Dunkerley, Rayleigh with a sine or static shape, Holzer
// chains and the torsional shaft with an end disc. Numbers are randomised within the ranges of the
// papers and quizzes; hints walk concept -> set-up -> substitution -> worked solution with this instance.
import type { NumericPart, SolveGenerator, SolvePart } from '../../engine/types';
import { fmt } from '../../engine/format';
import { betaL } from '../../physics/beams';
import { farTraps, pinnedDunkerleyRatio, pinnedSineRatio, shaftDiscDunkerley, shaftDiscRayleigh } from './physics';
import { endInertiaRoots } from '../../physics/waves';
import { beamFigure, chainFigure, shaftDiscFigure } from './figures';

const TAU = 2 * Math.PI;
const f3 = (x: number) => fmt(x, 3);
const f4 = (x: number) => fmt(x, 4);
/** Formula-sheet (beta1 L)^4 = 1.875^4 = 12.36, as used in the official solutions. */
const B4 = 1.875 ** 4;
const K4 = B4 / 3; // 4.12
const BL1X = betaL('clamped-free', 1)[0] ** 4; // exact 12.362
const FF4 = 4.73 ** 4; // free–free (beta1 L)^4 = 500.6

type Trap = { value: number; message: string; trapId?: string };

/** Numeric part with traps that are safely away (≥ 4 %) from the answer. */
function num(id: string, label: string, answer: number, unit: string, traps: Trap[] = [], extra: Partial<NumericPart> = {}): NumericPart {
  return { kind: 'numeric', id, label, answer, unit, traps: farTraps(answer, traps), ...extra };
}

const rpm = (w: number) => (w * 60) / TAU;

export const generators: SolveGenerator[] = [
  // ------------------------------------------------------------------ inverse: tip mass from a drop
  {
    id: 'b5-tip-mass-drop',
    title: 'Tip mass from a measured frequency drop',
    summary: 'Inverse Dunkerley, with Rayleigh’s upper value: how heavy is the mass that lowered $f_1$ by this much?',
    tiers: [1, 2, 3],
    source: 'Similar to 2025 B2.4; official 2016 B2.4; tutorial W7.6',
    cardId: 'b5-added-mass',
    marks: 5,
    generate(rng, tier) {
      if (tier === 1) {
        const d = rng.pick([2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30]);
        const r = 1 - d / 100;
        const q = 1 / (r * r) - 1;
        const mu = (3 * q) / B4;
        return {
          figure: beamFigure({ support: 'cantilever', masses: [{ x: 1, label: 'M = ?' }], caption: 'uniform cantilever, tip mass added', label: 'Uniform cantilever with an unknown tip mass' }),
          prompt: `A compact mass is fixed to the free tip of a uniform cantilever, and its measured first natural frequency falls by ${d} %. Estimate the tip mass as a percentage of the beam mass using Dunkerley’s method.`,
          givens: [{ sym: '\\Delta f_1', value: `−${d} %`, label: 'measured change in the fundamental' }],
          parts: [
            num('mu', 'Tip mass $M/(\\rho AL)$', 100 * mu, '%', [
              { value: (100 * 3 * (1 / r - 1)) / B4, message: 'You used $1/r - 1$. Dunkerley adds reciprocals of **squared** frequencies: $1/r^2 - 1$.', trapId: 'b5-drop-ratio' },
              { value: (100 * 3 * (1 / (d / 100) ** 2 - 1)) / B4, message: `The frequency ratio is $r = 1 - ${d / 100} = ${f4(r)}$, not the drop itself.`, trapId: 'b5-drop-ratio' },
              { value: 100 * q, message: 'The factor $3/1.875^4$ is missing: the mass sits on a spring $3EI/L^3$ while $\\omega_{11}^2 = 1.875^4EI/\\rho AL^4$.' },
            ]),
          ],
          hints: [
            'Dunkerley: the bare beam ($\\omega_{11}$) and the tip mass alone on the massless cantilever ($k = 3EI/L^3$) combine as $1/\\omega_1^2 = 1/\\omega_{11}^2 + ML^3/3EI$.',
            'Divide by $1/\\omega_{11}^2 = \\rho AL^4/(1.875^4EI)$: $(\\omega_{11}/\\omega_1)^2 = 1 + \\tfrac{1.875^4}{3}\\mu$, so $\\mu = M/\\rho AL = 3(1/r^2 - 1)/1.875^4$ with $r = \\omega_1/\\omega_{11}$.',
            `$r = 1 - ${d / 100} = ${f4(r)}$; $1/r^2 - 1 = ${f4(q)}$; $1.875^4 = 12.36$.`,
            `$\\mu = 3 \\times ${f4(q)}/12.36 = ${f4(mu)}$, i.e. **${f3(100 * mu)} %** of the beam mass. Dunkerley underestimates frequencies, so this is the **smallest** mass consistent with the drop; Rayleigh with the bare mode gives the upper value $(1/r^2 - 1)/4$ = ${f3(25 * q)} %.`,
          ],
        };
      }
      if (tier === 2) {
        const N0 = rng.step(120, 400, 10);
        const d = rng.pick([3, 4, 5, 6, 7, 8, 10]);
        const N1 = Number((N0 * (1 - d / 100)).toPrecision(4));
        const r = N1 / N0;
        const q = 1 / (r * r) - 1;
        const muD = (3 * q) / B4;
        const muR = q / 4;
        const parts: SolvePart[] = [
          num('r', 'Frequency ratio $r = \\omega_1/\\omega_{11}$', r, '', [
            { value: 1 - r, message: 'That is the fractional drop; the ratio is the new frequency over the old one.', trapId: 'b5-drop-ratio' },
            { value: N0 / N1, message: 'Inverted: $r$ = (with tips)/(without tips) < 1.' },
          ], { tol: 0.002 }),
          num('muD', 'Tip mass by Dunkerley, as % of the tube mass', 100 * muD, '%', [
            { value: (100 * 3 * (1 / r - 1)) / B4, message: 'Square the ratio: $1/r^2 - 1$.', trapId: 'b5-drop-ratio' },
            { value: 100 * q, message: 'Missing the factor $3/1.875^4$ (tip stiffness $3EI/L^3$ against $\\omega_{11}^2 = 1.875^4EI/\\rho AL^4$).' },
          ]),
          num('muR', 'Tip mass by Rayleigh with the blade’s own first mode, as % of the tube mass', 100 * muR, '%', [
            { value: 100 * q, message: 'The normalised mode has $Y_1(L) = 2$, so the tip mass enters as $M Y_1(L)^2 = 4M$: $\\mu = (1/r^2 - 1)/4$.', trapId: 'b5-mode-tip-4' },
          ]),
          {
            kind: 'choice',
            id: 'bound',
            label: 'What do the two estimates tell you about the true tip mass?',
            options: [
              { text: 'Dunkerley gives a lower bound and Rayleigh an upper bound on the mass: the true value lies between them.', correct: true, why: 'Dunkerley underestimates the frequency for a given mass, so it needs the least mass to explain the drop; Rayleigh needs the most.' },
              { text: 'Dunkerley gives an upper bound on the mass, because it underestimates frequencies.', correct: false, why: 'The roles flip in an inverse problem: underestimating $\\omega$ means less mass is needed to reach the measured drop.' },
              { text: 'They should agree exactly; the difference is rounding.', correct: false, why: 'They are different approximations (lower and upper bound); the exact value is between them.' },
            ],
          },
        ];
        return {
          figure: beamFigure({ support: 'cantilever', masses: [{ x: 1, label: 'tips' }], caption: 'blade: cantilevered thin tube fixed at the turbine axis', label: 'Turbine blade as a cantilevered tube with added blade tips' }),
          prompt: `The blades of a tidal-stream turbine are modelled as cantilevered thin tubes. Commissioning tests put the first transverse critical speed at ${N0} rpm. After blade tips are added it is measured at ${N1} rpm. Estimate the mass of the tips as a percentage of the tube mass.`,
          givens: [
            { sym: 'N_{11}', value: `${N0} rpm`, label: 'without tips' },
            { sym: 'N_1', value: `${N1} rpm`, label: 'with tips' },
          ],
          parts,
          hints: [
            'Treat the tips as one tip mass. Dunkerley gives the mass that explains the drop from below; Rayleigh (with the bare blade mode as the trial shape) from above. Only the frequency **ratio** matters.',
            '$r = N_1/N_{11}$. Dunkerley: $(1/r^2) = 1 + \\tfrac{1.875^4}{3}\\mu$, so $\\mu_D = 3(1/r^2 - 1)/1.875^4$. Rayleigh with $Y_1$ ($\\int Y_1^2 dx = L$, $Y_1(L) = 2$): $\\omega^2/\\omega_{11}^2 = 1/(1 + 4\\mu)$, so $\\mu_R = (1/r^2 - 1)/4$.',
            `$r = ${N1}/${N0} = ${f4(r)}$; $1/r^2 - 1 = ${f4(q)}$.`,
            `$\\mu_D = 3 \\times ${f4(q)}/12.36 = $ **${f3(100 * muD)} %**; $\\mu_R = ${f4(q)}/4 = $ **${f3(100 * muR)} %**. So ${f3(100 * muD)} % ≤ $M/\\rho AL$ ≤ ${f3(100 * muR)} %: Dunkerley is the lower bound on the mass, Rayleigh the upper.`,
          ],
        };
      }
      const fac = rng.pick([2, 3, 4, 5, 6, 8, 9]);
      const mb = rng.step(2, 20, 0.5); // grams
      const muD = (3 * (fac * fac - 1)) / B4;
      const muR = (3 * fac * fac) / BL1X - 33 / 140;
      return {
        figure: beamFigure({ support: 'cantilever', masses: [{ x: 1, label: 'proof mass', size: 1.3 }], caption: `micro-cantilever, beam mass ${mb} g`, label: 'Micro-cantilever with a proof mass at its tip' }),
        prompt: `A micro-machined gyroscope is a uniform cantilever beam of mass ${mb} g with a proof mass at its tip. Its fundamental frequency is found to be ${fac} times lower than that of the bare beam. Estimate the proof mass by Dunkerley’s method and by Rayleigh’s method with the static deflection under a tip load, $\\phi = (3x^2L - x^3)/2L^3$.`,
        givens: [
          { sym: 'm_b', value: `${mb} g`, label: 'beam mass ρAL' },
          { sym: '\\omega_{11}/\\omega_1', value: `${fac}`, label: 'measured frequency reduction' },
        ],
        parts: [
          num('MD', 'Proof mass by Dunkerley', muD * mb, 'g', [
            { value: ((3 * (fac - 1)) / B4) * mb, message: 'Use the squared frequency ratio: $(\\omega_{11}/\\omega_1)^2 - 1$.', trapId: 'b5-drop-ratio' },
            { value: (fac * fac - 1) * mb, message: 'Missing the factor $3/1.875^4$.' },
          ]),
          num('MR', 'Proof mass by Rayleigh (tip-load shape)', muR * mb, 'g', [
            { value: ((3 * fac * fac) / BL1X) * mb, message: 'You dropped the beam’s own kinetic energy: the tip-load shape gives $\\omega^2 = 3EI/[L^3(M + \\tfrac{33}{140}\\rho AL)]$.' },
          ]),
          {
            kind: 'choice',
            id: 'shape',
            label: 'Which Rayleigh trial shape gives the most accurate estimate for this heavy tip mass?',
            options: [
              { text: 'The static deflection under a tip load', correct: true, why: 'With $M \\gg \\rho AL$ the inertia load is essentially a tip force, so this shape is almost the true mode (W7.6: 19.42 against exact 19.42 for a 9× drop).' },
              { text: 'The static deflection under a uniform load', correct: false, why: 'Best for a bare or heavy beam; for a heavy tip mass it overestimates more (20.7 for a 9× drop).' },
              { text: '$\\phi = x^2$', correct: false, why: 'Breaks the free-end moment condition: the worst of the four (26.0 for a 9× drop).' },
              { text: '$\\phi = 1 - \\cos(\\pi x/2L)$', correct: false, why: 'Reasonable, but not as close as the tip-load shape here (19.7 for a 9× drop).' },
            ],
          },
        ],
        hints: [
          'Both methods relate the tip mass to the frequency ratio; in an inverse problem Dunkerley gives the smallest mass and Rayleigh the largest. For a heavy tip mass the bracket is tight.',
          'Dunkerley: $(\\omega_{11}/\\omega_1)^2 = 1 + \\tfrac{1.875^4}{3}\\mu$. Rayleigh (tip-load shape): $\\omega_1^2 = 3EI/[L^3(M + 0.2357\\rho AL)]$ with $\\omega_{11}^2 = 12.362EI/\\rho AL^4$, so $\\mu_R = 3(\\omega_{11}/\\omega_1)^2/12.362 - 0.2357$.',
          `$(\\omega_{11}/\\omega_1)^2 = ${fac * fac}$. Dunkerley: $\\mu_D = 3 \\times ${fac * fac - 1}/12.36 = ${f4(muD)}$. Rayleigh: $\\mu_R = 3 \\times ${fac * fac}/12.362 - 0.2357 = ${f4(muR)}$.`,
          `$M_D = ${f4(muD)} \\times ${mb} = $ **${f4(muD * mb)} g**; $M_R = ${f4(muR)} \\times ${mb} = $ **${f4(muR * mb)} g**. The true mass lies between them (spread ${f3((100 * (muR - muD)) / muD)} %). The tip-load shape is the best Rayleigh shape here because the proof mass dominates the inertia.`,
        ],
      };
    },
  },

  // ------------------------------------------------------------------ forward: added masses on a wing
  {
    id: 'b5-added-masses',
    title: 'Effect of added masses on f₁ (%)',
    summary: 'Engines, rotors or wings on a beam: Dunkerley terms, % change, the dominant mass, and the free–free fuselage pinned at its nodes.',
    tiers: [1, 2, 3],
    source: 'Similar to 2022 B2.5; official 2018 B2.4 and 2019 B2.4',
    cardId: 'b5-dunkerley',
    marks: 5,
    generate(rng, tier) {
      if (tier === 1) {
        const mu = rng.pick([0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5]);
        const x = rng.pick([0.4, 0.5, 0.6, 0.7, 0.8, 0.9]);
        const term = K4 * mu * x ** 3;
        const ratio = 1 / Math.sqrt(1 + term);
        const pct = 100 * (ratio - 1);
        return {
          figure: beamFigure({ support: 'cantilever', masses: [{ x, label: 'pod', at: `${x}L` }], caption: 'wing as a uniform cantilever', label: `Cantilever wing with a pod at ${x}L` }),
          prompt: `A sensor pod whose mass is ${100 * mu} % of the wing mass is fixed at $x$ = ${x}L on a wing modelled as a uniform cantilever. Estimate the change in the wing’s fundamental frequency with Dunkerley’s method.`,
          givens: [
            { sym: '\\mu', value: `${mu}`, label: 'pod mass / wing mass' },
            { sym: 'x/L', value: `${x}`, label: 'pod position from the root' },
          ],
          parts: [
            num('term', 'Dunkerley term $(\\omega_{11}/\\omega_{22})^2$ of the pod', term, '', [
              { value: K4 * mu, message: 'That uses the tip stiffness $3EI/L^3$. The pod is at $x$: $k = 3EI/x^3$.', trapId: 'b5-tip-stiffness' },
              { value: mu * x ** 3, message: 'Missing the factor $(\\beta_1L)^4/3 = 4.12$ from $\\omega_{11}^2 = 1.875^4EI/\\rho AL^4$.' },
            ]),
            num('pct', 'Change in $f_1$ (%, negative for a drop)', pct, '%', [
              { value: 100 * (1 / (1 + term) - 1), message: 'Take the square root: $\\omega_D/\\omega_{11} = (1 + \\text{term})^{-1/2}$.', trapId: 'sqrt' },
              { value: 100 * (1 / Math.sqrt(1 + K4 * mu) - 1), message: 'Tip stiffness used for a mass that is not at the tip.', trapId: 'b5-tip-stiffness' },
              { value: 100 * (1 / Math.sqrt(1 + K4 * mu * x) - 1), message: 'The stiffness scales as $1/x^3$, so the term has $(x/L)^3$, not $x/L$.' },
              { value: 100 * ratio, message: 'That is the new frequency as a % **of** the old one; the question asks for the % **change**.', trapId: 'b5-pct-change' },
            ]),
          ],
          hints: [
            'Dunkerley: the bare wing ($\\omega_{11}$) plus the pod alone on the massless wing ($\\omega_{22}^2 = k/m$ with $k = 3EI/x^3$ at the pod).',
            '$(\\omega_{11}/\\omega_D)^2 = 1 + (\\omega_{11}/\\omega_{22})^2 = 1 + \\tfrac{1.875^4}{3}\\,\\mu\\,(x/L)^3$; change $= 100(\\omega_D/\\omega_{11} - 1)$ %.',
            `Term $= 4.12 \\times ${mu} \\times ${x}^3 = ${f4(term)}$.`,
            `$\\omega_D/\\omega_{11} = 1/\\sqrt{${f4(1 + term)}} = ${f4(ratio)}$: a change of **${f3(pct)} %**. Dunkerley is a lower bound, so the true drop is slightly smaller.`,
          ],
        };
      }
      if (tier === 2) {
        const sc = rng.pick([
          { name: 'An aircraft wing', what: 'engines', each: 'engine', mus: [0.12, 0.15, 0.17, 0.2], xa: [0.3, 0.35, 0.4], xb: [0.6, 0.65, 0.7], f: [6, 7, 8, 9] },
          { name: 'An eVTOL wing', what: 'rotors', each: 'rotor', mus: [0.15, 0.2, 0.25, 0.3], xa: [0.4, 0.5, 0.6], xb: [0.8, 0.9, 1.0], f: [60, 80, 100, 120] },
        ]);
        const mu = rng.pick(sc.mus);
        const xA = rng.pick(sc.xa);
        const xB = rng.pick(sc.xb);
        const f11 = rng.pick(sc.f);
        const tA = K4 * mu * xA ** 3;
        const tB = K4 * mu * xB ** 3;
        const ratio = 1 / Math.sqrt(1 + tA + tB);
        const pct = 100 * (ratio - 1);
        return {
          figure: beamFigure({ support: 'cantilever', masses: [{ x: xA, label: 'A', at: `${xA}L` }, { x: xB, label: 'B', at: `${xB}L` }], caption: `${sc.name.replace(/^An? /, '')} as a uniform cantilever`, label: `Cantilever with ${sc.what} at ${xA}L and ${xB}L` }),
          prompt: `${sc.name} is modelled as a uniform cantilever fixed at the fuselage, with a fundamental of ${f11} Hz when its ${sc.what} are ignored. Two ${sc.what}, each ${Math.round(100 * mu)} % of the wing mass, sit at A ($x_A$ = ${xA}L) and B ($x_B$ = ${xB}L). Estimate their effect on $f_1$ with Dunkerley’s method and say which one matters more.`,
          givens: [
            { sym: 'f_{11}', value: `${f11} Hz`, label: 'bare wing' },
            { sym: '\\mu', value: `${mu}`, label: `each ${sc.each} / wing mass` },
            { sym: 'x_A, x_B', value: `${xA}L, ${xB}L` },
          ],
          parts: [
            num('tA', `Dunkerley term of ${sc.each} A, $(\\omega_{11}/\\omega_{AA})^2$`, tA, '', [
              { value: K4 * mu, message: 'Tip stiffness used: at A the stiffness is $3EI/x_A^3$.', trapId: 'b5-tip-stiffness' },
              { value: mu * xA ** 3, message: 'Missing the factor $1.875^4/3 = 4.12$.' },
            ]),
            num('tB', `Dunkerley term of ${sc.each} B`, tB, '', [
              { value: K4 * mu, message: 'Tip stiffness used: at B the stiffness is $3EI/x_B^3$.', trapId: 'b5-tip-stiffness' },
              { value: mu * xB ** 3, message: 'Missing the factor $1.875^4/3 = 4.12$.' },
            ]),
            num('pct', 'Change in $f_1$ (%, negative for a drop)', pct, '%', [
              { value: 100 * (1 / (1 + tA + tB) - 1), message: 'Take the square root of the frequency-squared ratio.', trapId: 'sqrt' },
              { value: 100 * (1 / Math.sqrt(1 + 2 * K4 * mu) - 1), message: 'Tip stiffness for both: each needs $3EI/x^3$ at its own position.', trapId: 'b5-tip-stiffness' },
              { value: 100 * ratio, message: 'That is $f_1$ as a % **of** the bare value; the question asks for the % change.', trapId: 'b5-pct-change' },
              { value: 100 * (1 / Math.sqrt(1 + K4 * mu * (xA + xB)) - 1), message: 'The terms carry $(x/L)^3$, not $x/L$.' },
            ]),
            num('f1', 'New fundamental frequency $f_1$', f11 * ratio, 'Hz', [], { freq: true }),
            {
              kind: 'choice',
              id: 'dom',
              label: `Which ${sc.each} has the bigger effect on $f_1$, and why?`,
              options: [
                { text: `B, at ${xB}L: the wing is far more flexible there and B moves with a larger mode-1 amplitude, so it adds more kinetic energy.`, correct: true, why: `Its term is $(x_B/x_A)^3 = ${f3((xB / xA) ** 3)}$ times A’s. Official 2018 note: the engine closest to the tip vibrates with larger amplitude and adds more KE.` },
                { text: 'A: it is nearer the root, where the bending moment is largest.', correct: false, why: 'Frequency depends on kinetic energy at the mass; near the root the mode-1 amplitude is small.' },
                { text: 'Both equally: they have the same mass.', correct: false, why: 'Position matters: the term grows as $x^3$.' },
                { text: 'B, because it sits near a node of mode 1.', correct: false, why: 'Mode 1 of a cantilever has no interior node; B is near the tip, the antinode.' },
              ],
            },
          ],
          hints: [
            `Split into three simple systems: the bare wing, ${sc.each} A alone and ${sc.each} B alone on the massless wing, each with $k = 3EI/x^3$ at its position (official 2018 B2.4 method).`,
            '$(\\omega_{11}/\\omega_D)^2 = 1 + \\tfrac{1.875^4}{3}\\,\\mu\\,[(x_A/L)^3 + (x_B/L)^3]$; change $= 100(\\omega_D/\\omega_{11} - 1)$; $f_1 = f_{11}\\,\\omega_D/\\omega_{11}$.',
            `A: $4.12 \\times ${mu} \\times ${xA}^3 = ${f4(tA)}$. B: $4.12 \\times ${mu} \\times ${xB}^3 = ${f4(tB)}$. Sum with the beam: $${f4(1 + tA + tB)}$.`,
            `$\\omega_D/\\omega_{11} = 1/\\sqrt{${f4(1 + tA + tB)}} = ${f4(ratio)}$: **${f3(pct)} %**, so $f_1$ = ${f11} × ${f4(ratio)} = **${f4(f11 * ratio)} Hz**. **B** dominates (term ${f3(tB)} vs ${f3(tA)}): nearer the tip it moves more and adds more kinetic energy. Dunkerley overstates the drop slightly (lower bound).`,
          ],
        };
      }
      // tier 3: free–free fuselage with wings, pinned at the mode-1 nodes (official 2019 B2.4)
      const f = rng.pick([20, 25, 30, 35, 40]);
      const mw = rng.pick([0.1, 0.12, 0.15, 0.18, 0.2]);
      const xA = rng.pick([0.4, 0.45, 0.5, 0.55, 0.6, 0.65]);
      const Ls = 1 - 2 * 0.224;
      const a = xA - 0.224;
      const K = (3 * Ls) / (a * a * (Ls - a) ** 2);
      const term = (FF4 * 2 * mw) / K;
      const ratio = 1 / Math.sqrt(1 + term);
      const Kend = 3 / (xA * xA * (1 - xA) ** 2);
      return {
        figure: beamFigure({ support: 'nodes', masses: [{ x: xA, label: 'wings (2m_w)', at: `${xA}L` }], caption: 'fuselage: free–free beam', label: `Free–free fuselage with the wings at ${xA}L, modelled as pinned at the mode-1 nodes` }),
        prompt: `A fuselage is modelled as a free–free uniform beam with a measured fundamental of ${f} Hz without its wings. The two wings, each ${Math.round(100 * mw)} % of the fuselage mass, attach at the same station A, $x_A$ = ${xA}L. Model the fuselage as pinned at the first-mode nodes (0.224L from each end) to find its static stiffness at A, and estimate the new fundamental with Dunkerley’s method. Static deflection of a pinned span $L_s$ loaded at $a$: $\\delta = Pa^2(L_s - a)^2/(3EIL_s)$.`,
        givens: [
          { sym: 'f_{11}', value: `${f} Hz`, label: 'measured, no wings' },
          { sym: 'm_w', value: `${mw} ρAL`, label: 'each wing (fuselage mass ρAL)' },
          { sym: 'x_A', value: `${xA}L` },
          { sym: '(\\beta_1L)^4', value: '4.730⁴ = 500.6', label: 'free–free' },
        ],
        parts: [
          num('K', 'Static stiffness at A, $K_A$ (in units of $EI/L^3$)', K, 'EI/L³', [
            { value: Kend, message: 'The beam is pinned at the nodes (span $L_s = 0.552L$), not at its ends: $a = x_A - 0.224L$.' },
          ]),
          num('pct', '$f_1$ with wings as a % of the measured value', 100 * ratio, '%', [
            { value: 100 * (ratio - 1), message: 'That is the % **change**; the question asks for the new value as a % **of** the old.', trapId: 'b5-pct-change' },
            { value: 100 / Math.sqrt(1 + term / 2), message: 'Both wings act at A: the mass is $2m_w$.' },
            { value: 100 / (1 + term), message: 'Take the square root.', trapId: 'sqrt' },
          ]),
          num('f1', 'New fundamental $f_1$', f * ratio, 'Hz', [], { freq: true }),
          {
            kind: 'choice',
            id: 'bias',
            label: 'Compared with the true first elastic frequency, this estimate is…',
            options: [
              { text: 'lower: Dunkerley is a lower bound, and pinning a free body at its nodes exaggerates the drop further', correct: true, why: 'For the 2019 data Dunkerley gives 84.6 % while an exact free–free model with the masses gives about 89 %.' },
              { text: 'higher: the pins add stiffness', correct: false, why: 'The pins only define a static stiffness for $\\omega_{22}$; Dunkerley still underestimates.' },
              { text: 'exact, because the pins are at the nodes', correct: false, why: 'The wing mass moves the nodes, and Dunkerley is an approximation in any case.' },
            ],
          },
        ],
        hints: [
          'A free–free body has no static stiffness, so pin it at its first-mode nodes (where it does not move in mode 1) and treat the wings as a mass on that pinned span (official 2019 B2.4).',
          `Span $L_s = (1 - 2 \\times 0.224)L = 0.552L$; load at $a = x_A - 0.224L$; $K_A = 3EIL_s/[a^2(L_s - a)^2]$. Then $(\\omega_{11}/\\omega_D)^2 = 1 + (\\beta_1L)^4 (2m_w/\\rho AL)/\\hat K_A$ with $\\hat K_A = K_AL^3/EI$.`,
          `$a = ${f3(xA)} - 0.224 = ${f4(a)}$, $L_s - a = ${f4(Ls - a)}$: $\\hat K_A = 3 \\times 0.552/(${f4(a)}^2 \\times ${f4(Ls - a)}^2) = ${f4(K)}$. Term $= 500.6 \\times ${f3(2 * mw)}/${f4(K)} = ${f4(term)}$.`,
          `$\\omega_D/\\omega_{11} = 1/\\sqrt{${f4(1 + term)}} = ${f4(ratio)}$: **${f3(100 * ratio)} %** of the measured value, i.e. $f_1$ ≈ **${f3(f * ratio)} Hz**. (2019 data, $x_A = 0.6L$, 15 % each: 84.6 %.)`,
        ],
      };
    },
  },

  // ------------------------------------------------------------------ Dunkerley in physical units: rotors on a shaft
  {
    id: 'b5-dunkerley-shaft',
    title: 'Critical speed of a shaft carrying rotors',
    summary: 'Sample Problem 5 style: bare-shaft frequency, the stiffness at each rotor, Dunkerley (and Rayleigh) in rpm.',
    tiers: [1, 2, 3],
    source: 'Similar to reader Sample Problem 5 (p. 117–118); tutorial W7.8',
    cardId: 'b5-dunkerley',
    marks: 8,
    generate(rng, tier) {
      const E = 210e9;
      const rho = 7800;
      const D = rng.pick([0.15, 0.2, 0.25, 0.3]);
      const L = rng.pick([2.5, 3, 3.5, 4]);
      const I = (Math.PI * D ** 4) / 64;
      const A = (Math.PI * D * D) / 4;
      const EI = E * I;
      const rA = rho * A;
      const w11 = (Math.PI / L) ** 2 * Math.sqrt(EI / rA);
      const shaftTxt = `A solid steel shaft ($E$ = 210 GPa, $\\rho$ = 7800 kg/m³) of diameter ${D * 1000} mm runs in self-aligning (pinned) bearings ${L} m apart.`;
      if (tier === 1) {
        const M = rng.step(400, 3000, 100);
        const K = (48 * EI) / L ** 3;
        const w22 = Math.sqrt(K / M);
        const wD = 1 / Math.sqrt(1 / w11 ** 2 + 1 / w22 ** 2);
        return {
          figure: beamFigure({ support: 'pinned', masses: [{ x: 0.5, label: `${M} kg`, kind: 'rotor', at: 'L/2' }], length: `L = ${L} m`, caption: `shaft Ø${D * 1000} mm in self-aligning bearings`, label: 'Pinned shaft with one rotor at mid-span' }),
          prompt: `${shaftTxt} A ${M} kg rotor sits at mid-span. Estimate the first critical speed with Dunkerley’s method.`,
          givens: [
            { sym: 'D', value: `${D * 1000} mm` },
            { sym: 'L', value: `${L} m`, label: 'bearing span' },
            { sym: 'M', value: `${M} kg`, label: 'rotor' },
          ],
          parts: [
            num('w11', 'Bare-shaft fundamental $\\omega_{11}$', w11, 'rad/s', [], { freq: true }),
            num('K', 'Shaft stiffness at the rotor', K, 'N/m', [
              { value: (3 * EI) / L ** 3, message: '$3EI/L^3$ is a cantilever tip. Pinned span, central load: $48EI/L^3$.', trapId: 'b5-tip-stiffness' },
              { value: (192 * EI) / L ** 3, message: '$192EI/L^3$ is for clamped ends; self-aligning bearings are pinned: $48EI/L^3$.' },
            ]),
            num('N', 'First critical speed (Dunkerley)', rpm(wD), 'rpm', [
              { value: rpm(1 / (1 / w11 + 1 / w22)), message: 'Dunkerley adds $1/\\omega^2$, not $1/\\omega$.', trapId: 'b5-add-omegas' },
              { value: rpm(w22), message: 'That is the rotor on a massless shaft only; add the shaft’s own term.' },
            ], { freq: true }),
          ],
          hints: [
            'Dunkerley: the bare shaft ($\\omega_{11}$, pinned–pinned beam) and the rotor alone on the massless shaft ($\\omega_{22}^2 = K/M$) combine as $1/\\omega^2 = 1/\\omega_{11}^2 + 1/\\omega_{22}^2$.',
            '$I = \\pi D^4/64$, $\\rho A = \\rho\\pi D^2/4$, $\\omega_{11} = (\\pi/L)^2\\sqrt{EI/\\rho A}$; mid-span stiffness $K = 48EI/L^3$; rpm $= 60\\omega/2\\pi$.',
            `$EI = ${f4(EI)}$ N m², $\\rho A = ${f4(rA)}$ kg/m, $\\omega_{11} = ${f4(w11)}$ rad/s; $K = ${f4(K)}$ N/m, $\\omega_{22} = \\sqrt{${f4(K)}/${M}} = ${f4(w22)}$ rad/s.`,
            `$1/\\omega_D^2 = 1/${f4(w11)}^2 + 1/${f4(w22)}^2$ → $\\omega_D$ = ${f4(wD)} rad/s = **${f4(rpm(wD))} rpm** (lower bound). Also $\\omega_{11}$ = **${f4(w11)} rad/s**, $K$ = **${f4(K)} N/m**.`,
          ],
        };
      }
      const M1 = rng.step(500, 2500, 100);
      const M2 = rng.step(500, 3000, 100);
      const M3 = M1;
      const xs = [0.2, 0.5, 0.8];
      const Ks = xs.map((x) => (3 * EI * L) / ((x * L) ** 2 * ((1 - x) * L) ** 2));
      const Ms = [M1, M2, M3];
      const inv = 1 / w11 ** 2 + Ms.reduce((s, m, i) => s + m / Ks[i], 0);
      const wD = 1 / Math.sqrt(inv);
      const parts: SolvePart[] = [
        num('w11', 'Bare-shaft fundamental $\\omega_{11}$', w11, 'rad/s', [], { freq: true }),
        num('K1', 'Stiffness at the outer rotors ($a$ = 0.2L)', Ks[0], 'N/m', [
          { value: (48 * EI) / L ** 3, message: '$48EI/L^3$ only applies at mid-span. At $a$: $K = 3EIL/[a^2(L - a)^2]$.', trapId: 'b5-tip-stiffness' },
          { value: (3 * EI) / (0.2 * L) ** 3, message: '$3EI/a^3$ is a cantilever formula; the shaft is pinned at both bearings.' },
        ]),
        num('K2', 'Stiffness at the middle rotor', Ks[1], 'N/m'),
        num('N', 'First critical speed by Dunkerley', rpm(wD), 'rpm', [
          { value: rpm(1 / (1 / w11 + Ms.reduce((s, m, i) => s + 1 / Math.sqrt(Ks[i] / m), 0))), message: 'Dunkerley adds $1/\\omega^2$ terms, not $1/\\omega$.', trapId: 'b5-add-omegas' },
          { value: rpm(1 / Math.sqrt(1 / w11 ** 2 + (M1 + M2 + M3) / Ks[1])), message: 'Each rotor needs the stiffness at its own position; $48EI/L^3$ is only right at mid-span.', trapId: 'b5-tip-stiffness' },
        ], { freq: true }),
      ];
      const hints: [string, string, string, string] = [
        'Dunkerley: the bare shaft plus each rotor alone on the massless shaft, $1/\\omega_D^2 = 1/\\omega_{11}^2 + \\sum M_k/K_k$ (Sample Problem 5(b)).',
        '$\\omega_{11} = (\\pi/L)^2\\sqrt{EI/\\rho A}$; for a load at $a$ on a pinned span, $K = 3EI(a + b)/(a^2b^2)$ with $b = L - a$ (mid-span: $48EI/L^3$).',
        `$EI = ${f4(EI)}$ N m², $\\rho A = ${f4(rA)}$ kg/m → $\\omega_{11} = ${f4(w11)}$ rad/s. $K_1 = K_3 = ${f4(Ks[0])}$ N/m, $K_2 = ${f4(Ks[1])}$ N/m. Terms $M_k/K_k$: ${f4(M1 / Ks[0])}, ${f4(M2 / Ks[1])}, ${f4(M3 / Ks[2])} s².`,
        `$1/\\omega_D^2 = ${f4(1 / w11 ** 2)} + ${f4(M1 / Ks[0] + M2 / Ks[1] + M3 / Ks[2])} = ${f4(inv)}$ s² → $\\omega_D$ = ${f4(wD)} rad/s = **${f4(rpm(wD))} rpm**${tier === 3 ? '' : ' (a lower bound)'}.`,
      ];
      if (tier === 3) {
        const s2 = xs.map((x) => Math.sin(Math.PI * x) ** 2);
        const KE = Ms.reduce((s, m, i) => s + m * s2[i], 0);
        const wR = Math.sqrt((EI * (Math.PI / L) ** 4 * (L / 2)) / ((rA * L) / 2 + KE));
        parts.push(
          num('NR', 'First critical speed by Rayleigh with $\\phi = \\sin(\\pi x/L)$', rpm(wR), 'rpm', [
            { value: rpm(Math.sqrt((EI * (Math.PI / L) ** 4 * (L / 2)) / (rA * L + KE))), message: '$\\int_0^L\\rho A\\sin^2(\\pi x/L)dx = \\rho AL/2$, not $\\rho AL$.', trapId: 'b5-half-beam' },
            { value: rpm(Math.sqrt((EI * (Math.PI / L) ** 4 * (L / 2)) / ((rA * L) / 2 + M1 + M2 + M3))), message: 'Each rotor enters with $\\phi(x_k)^2 = \\sin^2(\\pi x_k/L)$; only the middle one has $\\phi = 1$.' },
          ], { freq: true }),
          {
            kind: 'choice',
            id: 'use',
            label: 'The machine must run at least 20 % below its first critical speed. Which value should you check the running speed against?',
            options: [
              { text: 'Dunkerley’s: it is a lower bound, so if it passes, the true critical speed passes too.', correct: true, why: 'Conservative: the true value is at least $\\omega_D$.' },
              { text: 'Rayleigh’s: it is the more accurate estimate.', correct: false, why: 'It is an upper bound: the true critical speed may be lower.' },
              { text: 'The mean of the two, which is exact.', correct: false, why: 'The mid-point is a good estimate, not a guaranteed value.' },
            ],
          }
        );
        hints[2] += ` Rayleigh: $\\sin^2(\\pi a/L)$ = ${f4(s2[0])}, 1, ${f4(s2[2])} → $\\sum M\\phi^2 = ${f4(KE)}$ kg.`;
        hints[3] += ` Rayleigh: $\\omega_R^2 = EI(\\pi/L)^4(L/2)/(\\rho AL/2 + ${f4(KE)})$ → $\\omega_R$ = ${f4(wR)} rad/s = **${f4(rpm(wR))} rpm**. So ${f4(rpm(wD))} ≤ $N_{cr}$ ≤ ${f4(rpm(wR))} rpm; check the running speed against the **lower** bound.`;
      }
      return {
        figure: beamFigure({ support: 'pinned', masses: [{ x: 0.2, label: `${M1} kg`, kind: 'rotor', at: '0.2L' }, { x: 0.5, label: `${M2} kg`, kind: 'rotor', at: '0.5L' }, { x: 0.8, label: `${M3} kg`, kind: 'rotor', at: '0.8L' }], length: `L = ${L} m`, caption: `shaft Ø${D * 1000} mm in self-aligning bearings`, label: 'Pinned shaft with three rotors at 0.2L, 0.5L and 0.8L' }),
        prompt: `${shaftTxt} It carries three rotors: ${M1} kg at 0.2L, ${M2} kg at mid-span and ${M3} kg at 0.8L. Treat the rotors as point masses${tier === 3 ? ' and bracket the first critical speed' : ' and estimate the first critical speed with Dunkerley’s method'}.`,
        givens: [
          { sym: 'D', value: `${D * 1000} mm` },
          { sym: 'L', value: `${L} m`, label: 'bearing span' },
          { sym: 'M_1, M_2, M_3', value: `${M1}, ${M2}, ${M3} kg`, label: 'at 0.2L, 0.5L, 0.8L' },
        ],
        parts,
        hints,
      };
    },
  },

  // ------------------------------------------------------------------ Rayleigh with a sine shape
  {
    id: 'b5-rayleigh-sine',
    title: 'Rayleigh: pinned beam with a point mass (sine shape)',
    summary: '$\\omega/\\omega_0 = 1/\\sqrt{1 + 2N\\sin^2(\\pi a/L)}$ for a machine on a floor beam, with Dunkerley as the lower check.',
    tiers: [1, 2, 3],
    source: 'Similar to Week 10 Q1; summary notes B5; reader Sample Problem 5(a)',
    cardId: 'b5-rayleigh',
    marks: 4,
    generate(rng, tier) {
      if (tier === 1) {
        const N = rng.pick([0.5, 1, 1.5, 2, 3, 4, 5, 6, 8, 9, 10, 12, 15]);
        const ratio = pinnedSineRatio(N);
        return {
          figure: beamFigure({ support: 'pinned', masses: [{ x: 0.5, label: `machine ${N}ρAL`, size: 1.2, at: 'L/2' }], caption: 'floor beam, simply supported', label: 'Pinned floor beam with a machine at mid-span' }),
          prompt: `A simply supported floor beam carries a machine whose mass is ${N} times the beam’s mass, at mid-span. Using Rayleigh’s method with the trial shape $\\phi = c\\sin(\\pi x/L)$, find the ratio of the new fundamental to the bare-beam value.`,
          givens: [{ sym: 'N', value: `${N}`, label: 'machine mass / beam mass' }],
          parts: [
            num('ratio', '$\\omega/\\omega_0$', ratio, '', [
              { value: 1 / Math.sqrt(1 + N), message: 'With the sine shape the beam’s kinetic-energy integral is $\\rho AL/2$: it counts as half its mass, while the machine counts in full.', trapId: 'b5-half-beam' },
              { value: 1 / (1 + 2 * N), message: '$\\omega^2$ scales with the energy ratio: take the square root.', trapId: 'sqrt' },
            ], { tol: 0.005 }),
          ],
          hints: [
            'Rayleigh: $\\omega^2 = \\int EI(\\phi^{\\prime\\prime})^2dx/[\\int\\rho A\\phi^2dx + M\\phi(L/2)^2]$. The sine is the exact bare mode, so without the machine it gives $\\omega_0$ exactly.',
            '$\\int EI(\\phi^{\\prime\\prime})^2 = EIc^2(\\pi/L)^4L/2$; $\\int\\rho A\\phi^2 = \\rho Ac^2L/2$; $M\\phi(L/2)^2 = N\\rho ALc^2$. So $\\omega^2/\\omega_0^2 = (1/2)/(1/2 + N) = 1/(1 + 2N)$.',
            `$1 + 2N = 1 + 2 \\times ${N} = ${1 + 2 * N}$.`,
            `$\\omega/\\omega_0 = 1/\\sqrt{${1 + 2 * N}} = $ **${f4(ratio)}** (an upper bound; Dunkerley with $K = 48EI/L^3$ gives ${f4(pinnedDunkerleyRatio(N))}).`,
          ],
        };
      }
      if (tier === 2) {
        const N = rng.pick([0.5, 1, 2, 3, 4, 5]);
        const a = rng.pick([0.2, 0.25, 0.3, 0.4]);
        const s2 = Math.sin(Math.PI * a) ** 2;
        const ratio = pinnedSineRatio(N, a);
        const target = rng.pick([0.5, 0.6, 0.7, 0.8]);
        const Nt = (1 / target ** 2 - 1) / (2 * s2);
        return {
          figure: beamFigure({ support: 'pinned', masses: [{ x: a, label: `${N}ρAL`, at: `a = ${a}L` }], caption: 'pinned–pinned beam', label: `Pinned beam with a point mass at ${a}L` }),
          prompt: `A pinned–pinned beam carries a point mass of ${N} beam masses at $a$ = ${a}L. Use Rayleigh’s method with $\\phi = \\sin(\\pi x/L)$.`,
          givens: [
            { sym: 'N', value: `${N}`, label: 'mass / beam mass' },
            { sym: 'a', value: `${a}L`, label: 'mass position' },
          ],
          parts: [
            num('ratio', '$\\omega/\\omega_0$ with the mass at $a$', ratio, '', [
              { value: pinnedSineRatio(N), message: 'That treats the mass as if it were at mid-span ($\\phi = 1$). At $a$ it moves with $\\phi(a) = \\sin(\\pi a/L)$, squared in the energy.' },
              { value: 1 / Math.sqrt(1 + 2 * N * Math.sin(Math.PI * a)), message: 'The kinetic energy has $\\phi(a)^2 = \\sin^2(\\pi a/L)$, not $\\sin(\\pi a/L)$.' },
              { value: 1 / Math.sqrt(1 + N * s2), message: 'The beam counts as half its mass with the sine shape: the factor is $2N$.', trapId: 'b5-half-beam' },
            ], { tol: 0.005 }),
            num('Nt', `Mass at $a$ (in beam masses) that would bring the frequency down to ${target}$\\,\\omega_0$`, Nt, '', [
              { value: (1 / target - 1) / (2 * s2), message: 'Square the frequency ratio: $1 + 2N\\sin^2 = (\\omega_0/\\omega)^2$.', trapId: 'sqrt' },
            ]),
          ],
          hints: [
            'A point mass adds $M\\phi(a)^2$ to the kinetic-energy denominator; the beam’s own term with the sine shape is $\\rho AL/2$.',
            '$\\omega^2/\\omega_0^2 = 1/(1 + 2N\\sin^2(\\pi a/L))$; invert for $N$: $N = [(\\omega_0/\\omega)^2 - 1]/(2\\sin^2(\\pi a/L))$.',
            `$\\sin^2(\\pi \\times ${a}) = ${f4(s2)}$; $1 + 2 \\times ${N} \\times ${f4(s2)} = ${f4(1 + 2 * N * s2)}$.`,
            `$\\omega/\\omega_0 = 1/\\sqrt{${f4(1 + 2 * N * s2)}} = $ **${f4(ratio)}**. For ${target}$\\omega_0$: $N = (1/${target}^2 - 1)/(2 \\times ${f4(s2)}) = $ **${f4(Nt)}** beam masses. A mass nearer a pin moves less, so it takes more of it to pull the frequency down.`,
          ],
        };
      }
      const E = 200e9;
      const Ival = rng.pick([0.8e-4, 1.0e-4, 1.5e-4, 2.0e-4]);
      const EI = E * Ival;
      const rA = rng.step(30, 90, 5);
      const L = rng.step(4, 8, 0.5);
      const mb = rA * L;
      const M = Math.round((rng.pick([0.5, 1, 2, 3, 4]) * mb) / 10) * 10;
      const N = M / mb;
      const w0 = (Math.PI / L) ** 2 * Math.sqrt(EI / rA);
      const wR = w0 * pinnedSineRatio(N);
      const K = (48 * EI) / L ** 3;
      const wD = 1 / Math.sqrt(1 / w0 ** 2 + M / K);
      return {
        figure: beamFigure({ support: 'pinned', masses: [{ x: 0.5, label: `${M} kg`, size: 1.2, at: 'L/2' }], length: `L = ${L} m`, caption: `steel floor beam, ${rA} kg/m`, label: 'Pinned floor beam with a machine at mid-span' }),
        prompt: `A steel floor beam ($EI$ = ${f3(EI)} N m², mass ${rA} kg/m, simply supported over ${L} m) carries a ${M} kg machine at mid-span. Bracket its fundamental natural frequency.`,
        givens: [
          { sym: 'EI', value: `${f3(EI)} N m²` },
          { sym: '\\rho A', value: `${rA} kg/m` },
          { sym: 'L', value: `${L} m` },
          { sym: 'M', value: `${M} kg`, label: 'machine at mid-span' },
        ],
        parts: [
          num('f0', 'Bare-beam fundamental $f_0$', w0 / TAU, 'Hz', [], { freq: true }),
          num('fR', 'Rayleigh estimate with $\\phi = \\sin(\\pi x/L)$', wR / TAU, 'Hz', [
            { value: (w0 / Math.sqrt(1 + N)) / TAU, message: 'With the sine shape the beam contributes $\\rho AL/2$: use $1 + 2N$.', trapId: 'b5-half-beam' },
          ], { freq: true }),
          num('fD', 'Dunkerley estimate ($K = 48EI/L^3$)', wD / TAU, 'Hz', [
            { value: (1 / (1 / w0 + 1 / Math.sqrt(K / M))) / TAU, message: 'Add $1/\\omega^2$ terms, not $1/\\omega$.', trapId: 'b5-add-omegas' },
          ], { freq: true }),
          {
            kind: 'choice',
            id: 'order',
            label: 'Where is the exact fundamental?',
            options: [
              { text: `Between the two: $f_D \\le f_1 \\le f_R$`, correct: true, why: 'Dunkerley is a lower bound and Rayleigh an upper bound.' },
              { text: 'Below the Dunkerley value', correct: false, why: 'Dunkerley is the lower bound.' },
              { text: 'Above the Rayleigh value', correct: false, why: 'Rayleigh is the upper bound.' },
            ],
          },
        ],
        hints: [
          'Rayleigh with the sine shape: $\\omega^2/\\omega_0^2 = 1/(1 + 2N)$, $N = M/\\rho AL$. Dunkerley: $1/\\omega^2 = 1/\\omega_0^2 + M/K$ with the mid-span stiffness of a pinned beam.',
          '$\\omega_0 = (\\pi/L)^2\\sqrt{EI/\\rho A}$; $K = 48EI/L^3$; $f = \\omega/2\\pi$.',
          `$\\omega_0 = ${f4(w0)}$ rad/s; $N = ${M}/${f4(mb)} = ${f4(N)}$; $K = ${f4(K)}$ N/m, $\\sqrt{K/M} = ${f4(Math.sqrt(K / M))}$ rad/s.`,
          `$f_0$ = **${f4(w0 / TAU)} Hz**; $f_R = f_0/\\sqrt{1 + 2N}$ = **${f4(wR / TAU)} Hz**; $f_D$ = **${f4(wD / TAU)} Hz**. The exact value lies between ${f4(wD / TAU)} and ${f4(wR / TAU)} Hz (they differ by ${f3((100 * (wR - wD)) / wD)} %).`,
        ],
      };
    },
  },

  // ------------------------------------------------------------------ Holzer
  {
    id: 'b5-holzer-chain',
    title: 'Holzer march on a 2–3 disc chain',
    summary: 'Residual torque at a trial frequency, the natural frequencies and the mode shape; free or fixed far end.',
    tiers: [1, 2, 3],
    source: 'Similar to reader Sample Problem 7 (p. 125); Week 10 Q4; tutorial W7.5',
    cardId: 'b5-holzer',
    marks: 6,
    generate(rng, tier) {
      if (tier === 1) {
        const J1 = rng.pick([2, 4, 5, 8, 10, 20]);
        const J2 = rng.pick([1, 2, 5, 10, 15]);
        const k = rng.pick([0.5, 1, 2, 5, 10, 16]) * 1e6;
        const w = Math.sqrt((k * (J1 + J2)) / (J1 * J2));
        const wt = Number((w * rng.pick([0.8, 0.9, 1.1, 1.2])).toPrecision(2));
        const th2 = 1 - (J1 * wt * wt) / k;
        const T1 = J1 * wt * wt;
        const T2 = T1 + J2 * wt * wt * th2;
        return {
          figure: chainFigure([`J₁ = ${J1} kg m²`, `J₂ = ${J2} kg m²`], [`k = ${f3(k)} N m/rad`], 'free', 'free–free chain'),
          prompt: `Two discs, $J_1$ = ${J1} kg m² and $J_2$ = ${J2} kg m², are joined by a shaft of torsional stiffness $k$ = ${f3(k)} N m/rad; both ends are free. Apply Holzer’s method.`,
          givens: [
            { sym: 'J_1', value: `${J1} kg m²` },
            { sym: 'J_2', value: `${J2} kg m²` },
            { sym: 'k', value: `${f3(k)} N m/rad` },
            { sym: '\\omega_t', value: `${wt} rad/s`, label: 'trial frequency' },
          ],
          parts: [
            num('th2', 'At the trial frequency: $\\theta_2$ (with $\\theta_1 = 1$)', th2, 'rad', [
              { value: 1 + (J1 * wt * wt) / k, message: 'Sign: $\\theta_2 = \\theta_1 - T_1/k$.', trapId: 'sign' },
            ], { absTol: 0.01 }),
            num('T2', 'Residual torque $T_2$ at the trial frequency', T2, 'N m', [
              { value: J2 * wt * wt * th2, message: 'Torques accumulate: $T_2 = T_1 + J_2\\omega^2\\theta_2$.', trapId: 'b5-holzer-sum' },
            ], { absTol: 1e-3 * T1 }),
            num('w', 'Natural frequency (non-zero)', w, 'rad/s', [
              { value: Math.sqrt(k / J1), message: 'That is disc 1 on a fixed shaft. Both discs move: $\\omega^2 = k(J_1 + J_2)/(J_1J_2)$.' },
              { value: Math.sqrt(k / J2), message: 'That is disc 2 on a fixed shaft. Both discs move: $\\omega^2 = k(J_1 + J_2)/(J_1J_2)$.' },
            ], { freq: true }),
            num('ratio', 'Mode shape $\\theta_2/\\theta_1$ at that frequency', -J1 / J2, '', [
              { value: -J2 / J1, message: 'Inverted: the heavier disc moves less, $\\theta_2/\\theta_1 = -J_1/J_2$.' },
            ]),
          ],
          hints: [
            'Holzer: march from disc 1 with $\\theta_1 = 1$, accumulating the inertia torques; at a natural frequency the free far end needs no torque, so $T_2 = 0$.',
            '$T_1 = J_1\\omega^2\\theta_1$; $\\theta_2 = \\theta_1 - T_1/k$; $T_2 = T_1 + J_2\\omega^2\\theta_2$. Setting $T_2 = 0$ gives $\\omega^2 = k(J_1 + J_2)/(J_1J_2)$ (or $\\omega = 0$).',
            `At $\\omega_t$ = ${wt}: $T_1 = ${J1} \\times ${wt}^2 = ${f4(T1)}$ N m; $\\theta_2 = 1 - ${f4(T1)}/${f3(k)} = ${f4(th2)}$.`,
            `$T_2 = ${f4(T1)} + ${J2} \\times ${wt}^2 \\times (${f4(th2)}) = $ **${f4(T2)} N m** (not zero: not a natural frequency). $\\omega = \\sqrt{${f3(k)} \\times ${J1 + J2}/(${J1} \\times ${J2})} = $ **${f4(w)} rad/s** (${f4(w / TAU)} Hz); there $\\theta_2 = 1 - J_1\\omega^2/k = $ **${f4(-J1 / J2)}**, ${J1 === J2 ? 'equal and opposite twists, so the node is at mid-shaft' : 'a node nearer the heavier disc'}. The chain also has the rigid-body root $\\omega = 0$.`,
          ],
        };
      }
      if (tier === 2) {
        const J = [rng.pick([2, 4, 6, 8]), rng.pick([4, 6, 10, 12]), rng.pick([2, 3, 6, 8])];
        const k = [rng.pick([1, 2, 3, 4]) * 1e6, rng.pick([1, 2, 3, 4]) * 1e6];
        const a = J[0] * J[1] * J[2];
        const b = k[0] * J[2] * (J[0] + J[1]) + k[1] * J[0] * (J[1] + J[2]);
        const c = k[0] * k[1] * (J[0] + J[1] + J[2]);
        const disc = Math.sqrt(b * b - 4 * a * c);
        const w1 = Math.sqrt((b - disc) / (2 * a));
        const w2 = Math.sqrt((b + disc) / (2 * a));
        const wt = Number((0.5 * (w1 + w2)).toPrecision(2));
        const th = [1];
        const T: number[] = [];
        let t = 0;
        for (let i = 0; i < 3; i++) {
          t += J[i] * wt * wt * th[i];
          T.push(t);
          if (i < 2) th.push(th[i] - t / k[i]);
        }
        const sh = [1, 1 - (J[0] * w1 * w1) / k[0]];
        sh.push(sh[1] - (J[0] * w1 * w1 + J[1] * w1 * w1 * sh[1]) / k[1]);
        return {
          figure: chainFigure(J.map((j, i) => `J${'₁₂₃'[i]} = ${j}`), [`k₁ = ${f3(k[0])}`, `k₂ = ${f3(k[1])}`], 'free', 'free–free chain (J in kg m², k in N m/rad)'),
          prompt: `Three discs ($J_1, J_2, J_3$ = ${J.join(', ')} kg m²) are joined by shafts $k_1$ = ${f3(k[0])} and $k_2$ = ${f3(k[1])} N m/rad; both ends are free. Use Holzer’s method.`,
          givens: [
            { sym: 'J_1, J_2, J_3', value: `${J.join(', ')} kg m²` },
            { sym: 'k_1, k_2', value: `${f3(k[0])}, ${f3(k[1])} N m/rad` },
            { sym: '\\omega_t', value: `${wt} rad/s`, label: 'trial frequency' },
          ],
          parts: [
            num('th3', 'At the trial frequency: $\\theta_3$ ($\\theta_1 = 1$)', th[2], 'rad', [], { absTol: 0.01 }),
            num('T3', 'Residual torque $T_3$ at the trial frequency', T[2], 'N m', [
              { value: J[2] * wt * wt * th[2], message: 'Torques accumulate: $T_3 = T_2 + J_3\\omega^2\\theta_3$.', trapId: 'b5-holzer-sum' },
            ], { absTol: 1e-3 * Math.abs(T[0]) }),
            num('w1', 'First non-zero natural frequency', w1, 'rad/s', [], { freq: true }),
            num('w2', 'Second non-zero natural frequency', w2, 'rad/s', [], { freq: true }),
            num('sh3', 'Mode shape at the first non-zero frequency: $\\theta_3/\\theta_1$', sh[2], '', [], { absTol: 0.01 }),
            {
              kind: 'choice',
              id: 'count',
              label: 'How many roots does the residual $T_3(\\omega)$ have, counting $\\omega = 0$?',
              options: [
                { text: '3: the rigid-body rotation and two elastic modes', correct: true, why: 'A free–free chain of $n$ discs has $n$ modes, one at $\\omega = 0$.' },
                { text: '2: only the elastic modes', correct: false, why: 'The question says to count $\\omega = 0$, the rigid-body mode.' },
                { text: '4: one per disc and shaft', correct: false, why: 'Three inertias give three modes.' },
              ],
            },
          ],
          hints: [
            'March from disc 1 ($\\theta_1 = 1$) with accumulating torques; at a natural frequency the residual past disc 3 is zero. For three free discs the residual is $\\omega^2$ times a quadratic in $\\omega^2$.',
            '$T_i = T_{i-1} + J_i\\omega^2\\theta_i$, $\\theta_{i+1} = \\theta_i - T_i/k_i$. The non-zero roots solve $J_1J_2J_3\\lambda^2 - [k_1J_3(J_1 + J_2) + k_2J_1(J_2 + J_3)]\\lambda + k_1k_2(J_1 + J_2 + J_3) = 0$, $\\lambda = \\omega^2$.',
            `At ${wt} rad/s: $T_1 = ${f4(T[0])}$, $\\theta_2 = ${f4(th[1])}$, $T_2 = ${f4(T[1])}$, $\\theta_3 = ${f4(th[2])}$. Quadratic: $${f4(a)}\\lambda^2 - ${f4(b)}\\lambda + ${f4(c)} = 0$.`,
            `$T_3$ = **${f4(T[2])} N m** at the trial frequency. Roots: $\\omega_1$ = **${f4(w1)} rad/s**, $\\omega_2$ = **${f4(w2)} rad/s**, plus $\\omega = 0$ (3 roots). Mode 1: $\\theta = [1, ${f4(sh[1])}, ${f4(sh[2])}]$, so $\\theta_3/\\theta_1$ = **${f4(sh[2])}** (one node).`,
          ],
        };
      }
      // tier 3: fixed far end: disc 1 (free) – k1 – disc 2 – k2 – wall
      const J1 = rng.pick([5, 10, 15, 20]);
      const J2 = rng.pick([5, 10, 20, 30]);
      const k1 = rng.pick([1, 2, 4, 8]) * 1e6;
      const k2 = rng.pick([1, 2, 4, 8]) * 1e6;
      const a = J1 * J2;
      const b = k1 * J2 + (k1 + k2) * J1;
      const c = k1 * k2;
      const disc = Math.sqrt(b * b - 4 * a * c);
      const w1 = Math.sqrt((b - disc) / (2 * a));
      const w2 = Math.sqrt((b + disc) / (2 * a));
      const wt = Number((0.7 * w1).toPrecision(2));
      const T1 = J1 * wt * wt;
      const th2 = 1 - T1 / k1;
      const T2 = T1 + J2 * wt * wt * th2;
      const thw = th2 - T2 / k2;
      return {
        figure: chainFigure([`J₁ = ${J1}`, `J₂ = ${J2}`], [`k₁ = ${f3(k1)}`, `k₂ = ${f3(k2)}`], 'fixed', 'free end → wall (J in kg m², k in N m/rad)'),
        prompt: `A disc $J_1$ = ${J1} kg m² at a free end is joined by a shaft $k_1$ = ${f3(k1)} N m/rad to a disc $J_2$ = ${J2} kg m², which is joined by a shaft $k_2$ = ${f3(k2)} N m/rad to a rigid wall. Use Holzer’s method starting at the free end.`,
        givens: [
          { sym: 'J_1, J_2', value: `${J1}, ${J2} kg m²` },
          { sym: 'k_1, k_2', value: `${f3(k1)}, ${f3(k2)} N m/rad` },
          { sym: '\\omega_t', value: `${wt} rad/s`, label: 'trial frequency' },
        ],
        parts: [
          num('thw', 'Twist at the wall $\\theta_{wall}$ at the trial frequency ($\\theta_1 = 1$)', thw, 'rad', [], { absTol: 0.01 }),
          num('w1', 'First natural frequency', w1, 'rad/s', [
            { value: Math.sqrt(k2 / (J1 + J2)), message: 'Treating the chain as one rigid inertia on $k_2$ ignores the flexibility of $k_1$.' },
          ], { freq: true }),
          num('w2', 'Second natural frequency', w2, 'rad/s', [], { freq: true }),
          {
            kind: 'choice',
            id: 'zero',
            label: 'Is $\\omega = 0$ a root of this residual?',
            options: [
              { text: 'No: the wall prevents rigid-body rotation, so the chain has two elastic modes only.', correct: true, why: 'At $\\omega = 0$ the march gives $\\theta_{wall} = 1 \\ne 0$.' },
              { text: 'Yes: Holzer always finds $\\omega = 0$.', correct: false, why: 'Only unrestrained chains have the rigid-body root.' },
              { text: 'Holzer cannot be used with a fixed end.', correct: false, why: 'It can: the residual is the twist at the fixed end (Sample Problem 7(b)).' },
            ],
          },
        ],
        hints: [
          'Start at the free end with $\\theta_1 = 1$; march to the wall. At a natural frequency the twist arriving at the wall must be zero.',
          '$T_1 = J_1\\omega^2$; $\\theta_2 = 1 - T_1/k_1$; $T_2 = T_1 + J_2\\omega^2\\theta_2$; $\\theta_{wall} = \\theta_2 - T_2/k_2$. Setting it to zero: $J_1J_2\\lambda^2 - [k_1J_2 + (k_1 + k_2)J_1]\\lambda + k_1k_2 = 0$.',
          `At ${wt} rad/s: $T_1 = ${f4(T1)}$, $\\theta_2 = ${f4(th2)}$, $T_2 = ${f4(T2)}$. Quadratic: $${f4(a)}\\lambda^2 - ${f4(b)}\\lambda + ${f4(c)} = 0$.`,
          `$\\theta_{wall}$ = **${f4(thw)} rad** at the trial frequency (positive: still below $\\omega_1$). $\\omega_1$ = **${f4(w1)} rad/s**, $\\omega_2$ = **${f4(w2)} rad/s**; no root at $\\omega = 0$.`,
        ],
      };
    },
  },

  // ------------------------------------------------------------------ cantilever + tip mass bracket (physical)
  {
    id: 'b5-tip-bracket',
    title: 'Cantilever with a tip mass: bracket f₁',
    summary: 'Bare frequency, Dunkerley (lower) and Rayleigh with a static shape (upper) for a real cantilever, and which shape suits which mass.',
    tiers: [1, 2, 3],
    source: 'Similar to 2021 B1.4; reader Exam 2000 Q4(d); LB7.7–LB8.3',
    cardId: 'b5-order',
    marks: 6,
    generate(rng, tier) {
      const E = 200e9;
      const rho = 7850;
      const b = rng.step(20, 50, 5) / 1000;
      const h = rng.step(3, 10, 1) / 1000;
      const L = rng.step(0.2, 0.6, 0.05);
      const I = (b * h ** 3) / 12;
      const EI = E * I;
      const mb = rho * b * h * L;
      const M = Number((rng.pick([0.1, 0.25, 0.5, 1, 2, 4]) * mb).toPrecision(2));
      const mu = M / mb;
      const w11 = 1.875104 ** 2 * Math.sqrt(EI / ((mb / L) * L ** 4));
      const wD = Math.sqrt((3 * EI) / (L ** 3 * (M + (3 / BL1X) * mb)));
      const wRt = Math.sqrt((3 * EI) / (L ** 3 * (M + (33 / 140) * mb)));
      const wRu = Math.sqrt((3.2 * EI) / (L ** 3 * (M + (104 / 405) * mb)));
      const Mtxt = M < 1 ? `${Number((M * 1000).toPrecision(3))} g` : `${M} kg`;
      const beam = `A steel strip ($E$ = 200 GPa, $\\rho$ = 7850 kg/m³), ${b * 1000} mm wide and ${h * 1000} mm thick, is clamped as a ${L} m cantilever bending across its thickness. A ${Mtxt} mass is fixed at its tip.`;
      const givens = [
        { sym: 'b \\times h', value: `${b * 1000} × ${h * 1000} mm` },
        { sym: 'L', value: `${L} m` },
        { sym: 'M', value: Mtxt, label: 'tip mass' },
      ];
      const parts: SolvePart[] = [
        num('f11', 'Bare-beam fundamental $f_{11}$', w11 / TAU, 'Hz', [
          { value: (1.875 * Math.sqrt(EI / ((mb / L) * L ** 4))) / TAU, message: 'Square $\\beta_1L$: $\\omega = (\\beta_1L)^2\\sqrt{EI/\\rho AL^4}$.', trapId: 'sqrt' },
        ], { freq: true }),
        num('fD', 'Dunkerley estimate with the tip mass', wD / TAU, 'Hz', [
          { value: Math.sqrt((3 * EI) / (L ** 3 * M)) / TAU, message: 'That is the mass on a massless beam; add the beam’s own term $1/\\omega_{11}^2$.' },
        ], { freq: true }),
      ];
      if (tier >= 2)
        parts.push(
          num('fR', 'Rayleigh estimate, tip-load static shape $\\phi = (3x^2L - x^3)/2L^3$', wRt / TAU, 'Hz', [
            { value: Math.sqrt((3 * EI) / (L ** 3 * (M + mb))) / TAU, message: 'With this shape the beam’s kinetic energy is $\\tfrac{33}{140}\\rho AL\\,\\phi(L)^2\\omega^2/2$: only 0.236 of its mass counts.' },
          ], { freq: true }),
          {
            kind: 'choice',
            id: 'bound',
            label: 'Which statement is right?',
            options: [
              { text: `$f_D \\le f_1 \\le f_R$: the exact value lies in the ${f3(wD / TAU)}–${f3(wRt / TAU)} Hz bracket.`, correct: true, why: 'Dunkerley is a lower bound, Rayleigh an upper bound (official 2016 B2.5).' },
              { text: 'Rayleigh is the lower bound because it ignores part of the beam’s mass.', correct: false, why: 'Rayleigh is an upper bound for any admissible shape.' },
              { text: 'Dunkerley is exact for a single tip mass.', correct: false, why: 'It is a lower bound for any system with distributed mass.' },
            ],
          }
        );
      if (tier === 3)
        parts.push(
          num('fU', 'Rayleigh estimate, UDL static shape (ω² = 3.2EI/[L³(M + 0.257ρAL)])', wRu / TAU, 'Hz', [], { freq: true }),
          {
            kind: 'choice',
            id: 'best',
            label: `For this mass ratio ($M/\\rho AL$ = ${f3(mu)}), which Rayleigh estimate is closer to the truth?`,
            options: [
              { text: wRt < wRu ? 'The tip-load shape: it gives the lower value' : 'The UDL shape: it gives the lower value', correct: true, why: 'Both are upper bounds, so the lower one is closer. The tip-load shape wins once the tip mass exceeds about 8 % of the beam mass; below that the UDL shape does.' },
              { text: wRt < wRu ? 'The UDL shape: it satisfies every boundary condition' : 'The tip-load shape: it suits a tip mass', correct: false, why: 'Compare the numbers: for upper bounds, lower is better.' },
              { text: 'Neither: Rayleigh cannot handle a tip mass', correct: false, why: 'The tip mass simply adds $M\\phi(L)^2$ to the kinetic energy.' },
            ],
          }
        );
      return {
        figure: beamFigure({ support: 'cantilever', masses: [{ x: 1, label: Mtxt }], length: `L = ${L} m`, caption: `steel strip ${b * 1000} × ${h * 1000} mm`, label: 'Steel cantilever strip with a tip mass' }),
        prompt: `${beam} Estimate its fundamental frequency.`,
        givens,
        parts,
        hints: [
          'Bracket the fundamental: Dunkerley (beam alone + tip mass on the massless beam, $k = 3EI/L^3$) from below, Rayleigh with a static deflection shape (+ the tip mass’s kinetic energy) from above.',
          '$\\omega_{11} = 1.875^2\\sqrt{EI/\\rho AL^4}$; Dunkerley $\\omega^2 = 3EI/[L^3(M + 0.243\\rho AL)]$; Rayleigh (tip-load shape) $\\omega^2 = 3EI/[L^3(M + 0.236\\rho AL)]$; (UDL shape) $3.2EI/[L^3(M + 0.257\\rho AL)]$.',
          `$I = bh^3/12 = ${f4(I)}$ m⁴, $EI = ${f4(EI)}$ N m², beam mass $\\rho AL = ${f4(mb)}$ kg (so $M/\\rho AL$ = ${f3(mu)}), $3EI/L^3 = ${f4((3 * EI) / L ** 3)}$ N/m.`,
          `$f_{11}$ = **${f4(w11 / TAU)} Hz**; $f_D$ = **${f4(wD / TAU)} Hz**${tier >= 2 ? `; $f_R$ (tip-load) = **${f4(wRt / TAU)} Hz**` : ''}${tier === 3 ? `; $f_R$ (UDL) = **${f4(wRu / TAU)} Hz**` : ''}. ${tier >= 2 ? `The exact value lies between ${f4(wD / TAU)} and ${f4(Math.min(wRt, wRu) / TAU)} Hz.` : 'Dunkerley is a lower bound.'}`,
        ],
      };
    },
  },

  // ------------------------------------------------------------------ torsional shaft with an end disc
  {
    id: 'b5-torsion-disc',
    title: 'Torsional shaft with an end disc',
    summary: 'Fixed–free shaft carrying a disc: Dunkerley $\\alpha = (4/\\pi^2 + 1/\\beta)^{-1/2}$, Rayleigh with a linear twist, and the heavy-disc limit.',
    tiers: [1, 2, 3],
    source: 'Similar to Week 10 Q3; reader Sample Problem 6(b); 2021 B2.5',
    cardId: 'b5-order',
    marks: 4,
    generate(rng, tier) {
      if (tier === 1 || tier === 2) {
        const beta = rng.pick([0.2, 0.5, 1, 1.5, 2, 3, 4.9, 6, 8, 10, 15, 20]);
        const aD = shaftDiscDunkerley(beta);
        const aR = shaftDiscRayleigh(beta);
        const aX = endInertiaRoots(beta, 1)[0];
        const parts: SolvePart[] = [
          num('aD', 'Dunkerley: $\\alpha_1$ in $\\omega_1 = \\alpha_1\\sqrt{G/\\rho L^2}$', aD, '', [
            { value: 1 / Math.sqrt(4 / Math.PI ** 2 + beta), message: 'Inverted $\\beta$: the disc term is $I_d/k_t = (1/\\beta)\\,\\rho L^2/G$ with $\\beta = I_a/I_d$.' },
            { value: 1 / Math.sqrt(1 / Math.PI ** 2 + 1 / beta), message: 'A fixed–free shaft has $\\omega_{11} = (\\pi/2)c/L$, so its term is $4/\\pi^2$, not $1/\\pi^2$.' },
            { value: Math.PI / 2 + Math.sqrt(beta), message: 'Dunkerley adds $1/\\omega^2$ terms, not frequencies.', trapId: 'b5-add-omegas' },
          ], { tol: 0.002 }),
        ];
        if (tier === 2)
          parts.push(
            num('aR', 'Rayleigh with a linear twist $\\Theta = x/L$: $\\alpha_1$', aR, '', [
              { value: Math.sqrt(beta), message: 'That ignores the shaft’s inertia (disc on a massless shaft); with a linear twist the shaft adds $I_a/3$.' },
              { value: 1 / Math.sqrt(1 / beta + 1 / 2), message: 'With a linear twist the shaft’s kinetic energy is $\\int\\rho J(x/L)^2dx = I_a/3$, not $I_a/2$.' },
            ], { tol: 0.002 }),
            {
              kind: 'choice',
              id: 'exact',
              label: `The exact value solves $\\alpha\\tan\\alpha = \\beta$ and is $\\alpha$ = ${f4(aX)}. This confirms that…`,
              options: [
                { text: 'Dunkerley ≤ exact ≤ Rayleigh', correct: true, why: `${f4(aD)} ≤ ${f4(aX)} ≤ ${f4(aR)}.` },
                { text: 'Rayleigh ≤ exact ≤ Dunkerley', correct: false, why: 'Reversed bounds.' },
                { text: 'both approximations are above the exact value', correct: false, why: 'Dunkerley is below it.' },
              ],
            }
          );
        return {
          figure: shaftDiscFigure('shaft: ρ, G, J, L (inertia Iₐ = ρJL)', `disc I_d = Iₐ/${beta}`),
          prompt: `A uniform circular shaft (density $\\rho$, shear modulus $G$, polar second moment $J$, length $L$) is fixed at one end and carries a rigid disc of polar inertia $I_d$ at the other, with $\\beta = \\rho JL/I_d$ = ${beta}. Write the fundamental as $\\omega_1 = \\alpha_1\\sqrt{G/(\\rho L^2)}$.`,
          givens: [{ sym: '\\beta', value: `${beta}`, label: 'shaft inertia / disc inertia' }],
          parts,
          hints: [
            'Dunkerley splits the system into the shaft alone (fixed–free, $\\omega_{11} = (\\pi/2)\\sqrt{G/\\rho L^2}$) and the disc on a massless shaft ($\\omega_{22}^2 = k_t/I_d$, $k_t = GJ/L$). Rayleigh with a linear twist adds a third of the shaft inertia to the disc.',
            `Dunkerley: $1/\\alpha^2 = 4/\\pi^2 + 1/\\beta$ (since $k_t/I_d = \\beta\\,G/\\rho L^2$). Rayleigh: $\\omega^2 = k_t/(I_d + I_a/3)$, so $\\alpha^2 = 1/(1/\\beta + 1/3)$.`,
            `$4/\\pi^2 = 0.4053$, $1/\\beta = ${f4(1 / beta)}$${tier === 2 ? `, $1/\\beta + 1/3 = ${f4(1 / beta + 1 / 3)}$` : ''}.`,
            `$\\alpha_D = 1/\\sqrt{${f4(4 / Math.PI ** 2 + 1 / beta)}} = $ **${f4(aD)}**${tier === 2 ? `; $\\alpha_R = 1/\\sqrt{${f4(1 / beta + 1 / 3)}} = $ **${f4(aR)}**` : ''}. Exact ($\\alpha\\tan\\alpha = \\beta$): ${f4(aX)}. Limits: $\\beta \\to \\infty$ gives $\\pi/2$ (no disc); $\\beta \\to 0$ gives $\\sqrt\\beta$ (disc on a massless spring).`,
          ],
        };
      }
      // tier 3: physical shaft and a heavy disc (Sample 6(b) / 2021 B2.5 flavour)
      const G = 80e9;
      const rho = 7800;
      const d = rng.step(30, 80, 5) / 1000;
      const L = rng.step(0.4, 1.5, 0.1);
      const Jp = (Math.PI * d ** 4) / 32;
      const Ia = rho * Jp * L;
      const Id = Number((Ia * rng.pick([5, 10, 20, 50, 100])).toPrecision(2));
      const kt = (G * Jp) / L;
      const c = Math.sqrt(G / rho);
      const beta = Ia / Id;
      const wD = 1 / Math.sqrt(((2 * L) / (Math.PI * c)) ** 2 + Id / kt);
      const wR = Math.sqrt(kt / (Id + Ia / 3));
      const wS = Math.sqrt(kt / Id);
      const wX = (endInertiaRoots(beta, 1)[0] * c) / L;
      const wFix = (Math.PI * c) / L; // fixed–fixed first torsional mode
      return {
        figure: shaftDiscFigure(`steel shaft Ø${d * 1000} mm, L = ${f3(L)} m`, `flywheel ${Id} kg m²`),
        prompt: `A steel shaft ($G$ = 80 GPa, $\\rho$ = 7800 kg/m³) of diameter ${d * 1000} mm and length ${f3(L)} m is fixed at one end and carries a flywheel of polar inertia ${Id} kg m² at the other.`,
        givens: [
          { sym: 'd', value: `${d * 1000} mm` },
          { sym: 'L', value: `${f3(L)} m` },
          { sym: 'I_d', value: `${Id} kg m²`, label: 'flywheel' },
        ],
        parts: [
          num('kt', 'Shaft torsional stiffness $k_t = GJ/L$', kt, 'N m/rad', [
            { value: (G * (Math.PI * d ** 4) / 64) / L, message: 'Torsion uses the polar moment $J = \\pi d^4/32$, not the bending $I = \\pi d^4/64$.', trapId: 'factor2' },
          ]),
          num('fD', 'Fundamental by Dunkerley', wD / TAU, 'Hz', [], { freq: true }),
          num('fR', 'Fundamental by Rayleigh (linear twist)', wR / TAU, 'Hz', [], { freq: true }),
          {
            kind: 'choice',
            id: 'model',
            label: `With $I_d$ about ${f3(1 / beta)} times the shaft’s own inertia, which simple model is adequate, and what would a “fixed flywheel” model predict?`,
            options: [
              { text: `The flywheel on a massless shaft, $\\sqrt{k_t/I_d}$ = ${f3(wS / TAU)} Hz, is within ${f3((100 * (wS - wX)) / wX)} % of exact; treating the flywheel end as fixed would predict ${f3(wFix / TAU)} Hz, far too high.`, correct: true, why: 'A heavy end inertia is not a fixed end: it lowers the fundamental drastically (2021 B2.5: −97 % in reality vs +100 % for a fixed-end model).' },
              { text: 'The flywheel end can be treated as fixed, because the flywheel barely moves.', correct: false, why: 'The flywheel barely moves only at high frequencies; the fundamental is the flywheel swinging on the shaft spring.' },
              { text: 'Only the exact equation $z\\tan z = I_a/I_d$ is adequate.', correct: false, why: `Dunkerley and Rayleigh bracket it within ${f3((100 * (wR - wD)) / wX)} %.` },
            ],
          },
        ],
        hints: [
          'Shaft inertia $I_a = \\rho JL$ is small next to the flywheel, so the mode is essentially the flywheel twisting the shaft. Dunkerley and Rayleigh bracket it tightly.',
          '$J = \\pi d^4/32$, $k_t = GJ/L$, $I_a = \\rho JL$, $c = \\sqrt{G/\\rho}$. Dunkerley $1/\\omega^2 = (2L/\\pi c)^2 + I_d/k_t$; Rayleigh $\\omega^2 = k_t/(I_d + I_a/3)$.',
          `$J = ${f4(Jp)}$ m⁴, $k_t = ${f4(kt)}$ N m/rad, $I_a = ${f4(Ia)}$ kg m², $c = ${f4(c)}$ m/s; $(2L/\\pi c)^2 = ${f4(((2 * L) / (Math.PI * c)) ** 2)}$ s², $I_d/k_t = ${f4(Id / kt)}$ s².`,
          `$k_t$ = **${f4(kt)} N m/rad**; $f_D$ = **${f4(wD / TAU)} Hz**; $f_R$ = **${f4(wR / TAU)} Hz** (exact ${f4(wX / TAU)} Hz; massless-shaft ${f4(wS / TAU)} Hz). A fixed-end model would give $(\\pi c/L)/2\\pi$ = ${f4(wFix / TAU)} Hz: wrong by a factor of ${f3(wFix / wX)}.`,
        ],
      };
    },
  },
];
