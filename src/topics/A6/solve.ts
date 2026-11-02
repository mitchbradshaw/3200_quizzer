// A6 problem generators: reading damped eigenvalues and MATLAB [P, D] output, and Rayleigh damping.
// MATLAB-style outputs come from real 2-DoF damped chains (state-space eig, unit-length columns, largest entry real,
// pairs deliberately unsorted). Answers are computed from the numbers as printed (4 decimals), as a student would.
import type { SolveGenerator, SolvePart } from '../../engine/types';
import { fmt, tex } from '../../engine/format';
import type { Rng } from '../../engine/rng';
import type { C } from '../../physics/complex';
import { cabs } from '../../physics/complex';
import { fromEigenvalue, fromRealPair } from '../../physics/damped';
import { eigListText, matlabCell, matlabDrill, ratio, rayleighZetaAt, sFromColumn, signedRatio } from './physics';
import { matlabFigure } from './MatlabBlock';

const TAU = 2 * Math.PI;
const f3 = (x: number) => fmt(x, 3);
const f4 = (x: number) => fmt(x, 4);
const t4 = (x: number) => tex(x, 4);
const sig = (x: number, n: number) => Number(x.toPrecision(n));
const LN100 = Math.log(100);

type Trap = { value: number; message: string; trapId?: string };
/** Keep only traps clearly away from the answer (> 3 %), so a trap can never mask a correct answer. */
function keep(answer: number, list: Trap[]): Trap[] {
  return list.filter((t) => Number.isFinite(t.value) && Math.abs(t.value - answer) > 0.03 * Math.abs(answer));
}

/** "-a ± bi" in TeX for an eigenvalue pair. */
const pairTeX = (s: C, dRe = 4, dIm = 4) => `${s.re < 0 ? '-' : ''}${Math.abs(s.re).toFixed(dRe)} \\pm ${Math.abs(s.im).toFixed(dIm)}i`;

/** A generated MATLAB [P, D] drill: printed columns plus the readings from the printed numbers. */
function drill(rng: Rng) {
  return { ...matlabDrill(rng), signed: signedRatio };
}

const colName = (k: number) => `columns ${k + 1}–${k + 2}`;
/** X₂/X₁ from the printed (4-decimal) displacement rows of a column: a near-miss of the velocity-row answer when X is tiny. */
const xRowTrap = (v: C[]): Trap => ({
  value: signedRatio(ratio(v[1], v[0])),
  message: 'That is $X_2/X_1$ from the displacement rows, which are rounded to four decimals: entries this small lose most of their digits. Take the same ratio from the velocity rows, $V_2/V_1$, which are $|s|$ times larger.',
  trapId: 'a6-tiny-entries',
});
const phaseWord = (deg: number) => (Math.abs(deg) < 20 ? 'in phase' : Math.abs(deg) > 160 ? 'out of phase' : 'neither in nor out of phase');

export const generators: SolveGenerator[] = [
  // ------------------------------------------------------------------ eigenvalue reading
  {
    id: 'a6-eigenvalues',
    title: 'ζ, ωn and ωd from damped eigenvalues',
    summary: '$\\omega_n = |s|$, $\\omega_d = |\\mathrm{Im}\\,s|$, $\\zeta = -\\mathrm{Re}\\,s/|s|$; sort the modes by $|s|$.',
    tiers: [1, 2, 3],
    source: 'Similar to official 2019 Q1e (−12.1 ± 1647.3i → ζ = 0.0073); 2023 A1.1; Week 6 Q2–Q3',
    cardId: 'a6-eigenvalues',
    generate(rng, tier) {
      if (tier === 3 && rng.chance(0.4)) {
        // Overdamped mode: a real pair.
        const wn = rng.step(5, 60, 0.5);
        const z = rng.step(1.2, 4, 0.1);
        const d = wn * Math.sqrt(z * z - 1);
        const p1 = sig(z * wn - d, 3);
        const p2 = sig(z * wn + d, 3);
        const fr = fromRealPair(-p1, -p2);
        const other = { re: -sig(rng.step(0.1, 1.5, 0.05), 3), im: sig(rng.step(15, 120, 0.5), 4) };
        return {
          prompt: `A two-mode damped model has eigenvalues $${pairTeX(other, 2, 2)}$, $-${p1}$ and $-${p2}$ (all in s⁻¹).`,
          givens: [
            { sym: 's', value: `${fmt(other.re, 3)} ± ${other.im}i, −${p1}, −${p2} s⁻¹` },
          ],
          parts: [
            {
              kind: 'choice',
              id: 'kind',
              label: 'What do the two real eigenvalues represent?',
              options: [
                { text: 'One overdamped mode: two decay rates, no oscillation.', correct: true, why: 'Real negative eigenvalues come in a pair for an overdamped mode (LA9 p62).' },
                { text: 'Two rigid-body modes.', correct: false, why: 'Rigid-body modes have $s = 0$; these decay.' },
                { text: `Two damped natural frequencies, ${p1} and ${p2} rad/s.`, correct: false, why: 'Real eigenvalues are decay rates, not frequencies.' },
              ],
            },
            {
              kind: 'numeric',
              id: 'wn',
              label: 'Undamped natural frequency $\\omega_n$ of that mode',
              answer: fr.wn,
              unit: 'rad/s',
              freq: true,
              traps: keep(fr.wn, [{ value: (p1 + p2) / 2, message: 'Use the product, not the mean: $s_1s_2 = \\omega_n^2$.' }]),
            },
            { kind: 'numeric', id: 'z', label: 'Its damping ratio $\\zeta$', answer: fr.zeta, unit: '', traps: keep(fr.zeta, [{ value: p2 / p1, message: 'Use $s_1 + s_2 = -2\\zeta\\omega_n$.' }]) },
          ],
          hints: [
            'An overdamped mode has two real roots $s_{1,2} = -\\zeta\\omega_n \\pm \\omega_n\\sqrt{\\zeta^2-1}$ (LA1, LA9 Eq 9.15).',
            'Product and sum of the roots: $s_1s_2 = \\omega_n^2$ and $s_1 + s_2 = -2\\zeta\\omega_n$.',
            `$\\omega_n = \\sqrt{${p1}\\times ${p2}}$, $\\zeta = (${p1} + ${p2})/(2\\omega_n)$.`,
            `$\\omega_n = $ **${f4(fr.wn)} rad/s**, $\\zeta = $ **${f4(fr.zeta)}** (> 1: overdamped). The other pair is an ordinary underdamped mode with $\\zeta = ${f3(fromEigenvalue(other).zeta)}$.`,
          ],
        };
      }
      if (tier === 3) {
        const wn = rng.step(4, 80, 0.5);
        const z = rng.step(0.25, 0.7, 0.05);
        const s = { re: -sig(z * wn, 3), im: sig(wn * Math.sqrt(1 - z * z), 3) };
        const e = fromEigenvalue(s);
        const a = -s.re;
        return {
          prompt: `A heavily damped mode has eigenvalues $s = ${pairTeX(s, 2, 2)}$ s⁻¹.`,
          givens: [{ sym: 's', value: `${fmt(s.re, 3)} ± ${s.im}i s⁻¹` }],
          parts: [
            { kind: 'numeric', id: 'z', label: 'Damping ratio $\\zeta$', answer: e.zeta, unit: '', traps: keep(e.zeta, [{ value: a / s.im, message: '$-\\mathrm{Re}/\\mathrm{Im}$ gives $\\zeta/\\sqrt{1-\\zeta^2}$: divide by $|s|$ instead.', trapId: 'a6-zeta-re-im' }, { value: s.im / e.wn, message: 'That is $\\omega_d/\\omega_n = \\sqrt{1-\\zeta^2}$.' }]) },
            { kind: 'numeric', id: 'wn', label: 'Undamped natural frequency $\\omega_n$', answer: e.wn, unit: 'rad/s', freq: true, traps: keep(e.wn, [{ value: s.im, message: 'That is $\\omega_d = |\\mathrm{Im}\\,s|$; $\\omega_n = |s|$.' }]) },
            { kind: 'numeric', id: 't', label: 'Time for the envelope to fall to 1 % of its initial value', answer: LN100 / a, unit: 's', traps: keep(LN100 / a, [{ value: 1 / a, message: '$1/(\\zeta\\omega_n)$ is the time constant (down to 37 %); 1 % needs $\\ln 100$ time constants.' }, { value: LN100 / (e.zeta * s.im), message: 'The decay rate is $\\zeta\\omega_n = -\\mathrm{Re}\\,s$, not $\\zeta\\omega_d$.', trapId: 'a6-real-part-zwd' }]) },
          ],
          hints: [
            'For $s = -a \\pm ib$: $\\omega_n = |s| = \\sqrt{a^2+b^2}$, $\\zeta = a/|s|$, and the envelope is $e^{-at}$ with $a = \\zeta\\omega_n$.',
            '$\\zeta = -\\mathrm{Re}\\,s/|s|$ (not $/\\mathrm{Im}\\,s$, which matters at this damping); 1 % when $e^{-at} = 0.01$, i.e. $t = \\ln 100/a$.',
            `$|s| = \\sqrt{${a}^2 + ${s.im}^2} = ${f4(e.wn)}$ rad/s.`,
            `$\\zeta = ${a}/${f4(e.wn)} = $ **${f4(e.zeta)}**; $\\omega_n = $ **${f4(e.wn)} rad/s** ($\\omega_d = ${s.im}$ rad/s is ${f3((1 - s.im / e.wn) * 100)} % lower); $t_{1\\%} = 4.605/${a} = $ **${f4(LN100 / a)} s**.`,
          ],
        };
      }
      if (tier === 2) {
        const wn1 = rng.pick([rng.step(8, 60, 0.1), rng.step(150, 900, 1), rng.step(1000, 2500, 5)]);
        const wn2 = wn1 * rng.step(2, 4.5, 0.05);
        const z1 = rng.step(0.002, 0.03, 0.0005);
        const z2 = rng.step(0.01, 0.06, 0.001);
        const dI = (s: C) => (Math.abs(s.im) >= 100 ? 1 : 2);
        const mk = (wn: number, z: number): C => {
          const im = wn * Math.sqrt(1 - z * z);
          return { re: -sig(z * wn, 3), im: Number(im.toFixed(im >= 100 ? 1 : 2)) };
        };
        const s1 = mk(wn1, z1);
        const s2 = mk(wn2, z2);
        const first = rng.chance(0.6) ? s2 : s1;
        const second = first === s1 ? s2 : s1;
        const e1 = fromEigenvalue(s1);
        const e2 = fromEigenvalue(s2);
        const show = (s: C) => `${fmt(s.re, 3)} \\pm ${s.im.toFixed(dI(s))}i`;
        return {
          prompt: `A damped two-mass model has eigenvalues $${show(first)}$ and $${show(second)}$ s⁻¹ (listed in the order the program printed them).`,
          givens: [
            { sym: 's_A', value: `${fmt(first.re, 3)} ± ${first.im.toFixed(dI(first))}i` },
            { sym: 's_B', value: `${fmt(second.re, 3)} ± ${second.im.toFixed(dI(second))}i` },
          ],
          parts: [
            { kind: 'numeric', id: 'z1', label: 'Damping ratio of mode 1 (the lower mode), $\\zeta_1$', answer: e1.zeta, unit: '', traps: keep(e1.zeta, [{ value: e2.zeta, message: 'That is the other mode. Mode 1 is the pair with the smaller $|s|$, whatever order they are listed in.', trapId: 'matlab-unsorted' }, { value: -s1.re, message: 'That is the decay rate $\\zeta\\omega_n$; divide by $|s|$.' }]) },
            { kind: 'numeric', id: 'z2', label: 'Damping ratio of mode 2, $\\zeta_2$', answer: e2.zeta, unit: '', traps: keep(e2.zeta, [{ value: e1.zeta, message: 'That is mode 1’s value.', trapId: 'matlab-unsorted' }]) },
            { kind: 'numeric', id: 'f1', label: 'Undamped natural frequency of mode 1', answer: e1.wn / TAU, unit: 'Hz', freq: true, traps: keep(e1.wn / TAU, [{ value: e2.wn / TAU, message: 'That is mode 2: sort by $|s|$.', trapId: 'matlab-unsorted' }]) },
            {
              kind: 'choice',
              id: 'form',
              label: 'Which expression can describe the displacement $x_1(t)$ of mass 1 after a general disturbance?',
              options: [
                { text: `$e^{${s1.re}t}(A\\cos ${s1.im}t + B\\sin ${s1.im}t)$ only`, correct: false, why: 'That single-mode form belongs to the modal coordinate $y_1$, not to a physical displacement (official 2019 Q1e(b)).' },
                { text: `$e^{${s1.re}t}(A_1\\cos ${s1.im}t + B_1\\sin ${s1.im}t) + e^{${s2.re}t}(A_2\\cos ${s2.im}t + B_2\\sin ${s2.im}t)$`, correct: true, why: 'A physical coordinate contains every excited mode.' },
                { text: `$e^{${sig(s1.re + s2.re, 3)}t}\\cos(${sig(s1.im + s2.im, 5)}t)$`, correct: false, why: 'Modes superpose; their decay rates and frequencies never add.' },
              ],
            },
          ],
          hints: [
            'Each ± pair is one mode. $\\omega_n = |s|$, $\\zeta = -\\mathrm{Re}\\,s/|s|$, $\\omega_d = |\\mathrm{Im}\\,s|$; mode 1 has the smaller $|s|$ (the list may be unsorted).',
            '$|s| = \\sqrt{(\\mathrm{Re}\\,s)^2 + (\\mathrm{Im}\\,s)^2}$; $f_n = \\omega_n/2\\pi$.',
            `$|${show(s1)}| = ${f4(e1.wn)}$ rad/s and $|${show(s2)}| = ${f4(e2.wn)}$ rad/s, so mode 1 is $${show(s1)}$${first === s2 ? ' (listed second)' : ''}.`,
            `$\\zeta_1 = ${-s1.re}/${f4(e1.wn)} = $ **${f4(e1.zeta)}**, $\\zeta_2 = ${-s2.re}/${f4(e2.wn)} = $ **${f4(e2.zeta)}**; $f_1 = ${f4(e1.wn)}/2\\pi = $ **${f4(e1.wn / TAU)} Hz**. $x_1$ contains both modes.`,
          ],
        };
      }
      const wn = rng.pick([rng.step(5, 60, 0.5), rng.step(200, 2000, 10), rng.step(1000, 6000, 50)]);
      const z = rng.pick([0.002, 0.004, 0.0073, 0.01, 0.02, 0.03, 0.05, 0.08]);
      const im0 = wn * Math.sqrt(1 - z * z);
      const dI = im0 >= 100 ? 1 : 2;
      const s = { re: -sig(z * wn, 3), im: Number(im0.toFixed(dI)) };
      const e = fromEigenvalue(s);
      return {
        prompt: `A damped eigenvalue analysis gives the pair $s = ${fmt(s.re, 3)} \\pm ${s.im.toFixed(dI)}i$ s⁻¹ for one mode.`,
        givens: [{ sym: 's', value: `${fmt(s.re, 3)} ± ${s.im.toFixed(dI)}i s⁻¹` }],
        parts: [
          { kind: 'numeric', id: 'z', label: 'Damping ratio $\\zeta$', answer: e.zeta, unit: '', traps: keep(e.zeta, [{ value: -s.re, message: 'That is the decay rate $\\zeta\\omega_n$ (s⁻¹); divide by $|s|$.' }]) },
          { kind: 'numeric', id: 'wn', label: 'Undamped natural frequency $\\omega_n$', answer: e.wn, unit: 'rad/s', freq: true },
          { kind: 'numeric', id: 'fd', label: 'Damped natural frequency $f_d$', answer: e.wd / TAU, unit: 'Hz', freq: true },
        ],
        hints: [
          'An underdamped pair is $s = -\\zeta\\omega_n \\pm i\\omega_d$: the distance from the origin is $\\omega_n$, the real part is the decay rate.',
          '$\\omega_n = |s|$, $\\zeta = -\\mathrm{Re}\\,s/|s|$, $\\omega_d = |\\mathrm{Im}\\,s|$, $f_d = \\omega_d/2\\pi$.',
          `$|s| = \\sqrt{${-s.re}^2 + ${s.im}^2} = ${f4(e.wn)}$ rad/s.`,
          `$\\zeta = ${-s.re}/${f4(e.wn)} = $ **${f4(e.zeta)}**; $\\omega_n = $ **${f4(e.wn)} rad/s**; $f_d = ${s.im}/2\\pi = $ **${f4(e.wd / TAU)} Hz**.`,
        ],
      };
    },
  },

  // ------------------------------------------------------------------ [P, D] output
  {
    id: 'a6-matlab-pd',
    title: 'Damping ratios and mode shapes from a MATLAB [P, D] output',
    summary: 'Unsorted eigenvalues, unit-length complex eigenvectors, tiny “0.0000” entries: read ζ, ωn and the mode ratios.',
    tiers: [1, 2, 3],
    source: 'Similar to 2023 A1.1–A1.2; official 2019 Q1e–f; Week 6 Q3–Q4',
    cardId: 'a6-statespace',
    generate(rng, tier) {
      const d = drill(rng);
      const cmd = '[P,D] = eig([zeros(2),eye(2);-inv(M)*K,-inv(M)*C])';
      const lead = 'A two-mass chain (mass 1 on the support, mass 2 beyond it) with springs and dampers satisfies $M\\ddot X + C\\dot X + KX = 0$. Treating the velocity $V$ as a separate variable, MATLAB returns the output below (rows of $P$: $X_1$, $X_2$, $V_1$, $V_2$). Mode 1 is the mode with the lower natural frequency.';
      const s1 = d.pc[d.k1].s;
      const s2 = d.pc[d.k2].s;
      const r1 = d.signed(d.r1);
      const r2 = d.signed(d.r2);
      const pairHint = `Pairs: ${colName(d.k1 < d.k2 ? d.k1 : d.k2)} and ${colName(d.k1 < d.k2 ? d.k2 : d.k1)}. $|${pairTeX(s1)}| = ${f4(d.e1.wn)}$ rad/s (mode 1, ${colName(d.k1)}) and $|${pairTeX(s2)}| = ${f4(d.e2.wn)}$ rad/s (mode 2, ${colName(d.k2)})${d.higherFirst ? ': the higher mode was printed first' : ''}.`;
      if (tier === 1) {
        return {
          prompt: `${lead} Only $D$ is shown.`,
          figure: matlabFigure([{ name: 'D', cells: d.text.D }], cmd),
          parts: [
            { kind: 'numeric', id: 'z1', label: 'Damping ratio of mode 1, $\\zeta_1$', answer: d.e1.zeta, unit: '', traps: keep(d.e1.zeta, [{ value: d.e2.zeta, message: 'That is the other pair: mode 1 has the smaller $|s|$. MATLAB does not sort.', trapId: 'matlab-unsorted' }]) },
            { kind: 'numeric', id: 'z2', label: 'Damping ratio of mode 2, $\\zeta_2$', answer: d.e2.zeta, unit: '', traps: keep(d.e2.zeta, [{ value: d.e1.zeta, message: 'That is mode 1’s value.', trapId: 'matlab-unsorted' }]) },
            { kind: 'numeric', id: 'f1', label: 'Natural frequency of mode 1', answer: d.e1.wn / TAU, unit: 'Hz', freq: true, traps: keep(d.e1.wn / TAU, [{ value: d.e2.wn / TAU, message: 'That is mode 2.', trapId: 'matlab-unsorted' }]) },
          ],
          hints: [
            'The diagonal of $D$ holds the eigenvalues $s$; each conjugate pair is one mode. Mode 1 is the pair with the smaller $|s| = \\omega_n$.',
            '$\\zeta = -\\mathrm{Re}\\,s/|s|$, $\\omega_n = |s|$, $f_n = \\omega_n/2\\pi$.',
            pairHint,
            `$\\zeta_1 = ${f4(-s1.re)}/${f4(d.e1.wn)} = $ **${f4(d.e1.zeta)}**; $\\zeta_2 = ${f4(-s2.re)}/${f4(d.e2.wn)} = $ **${f4(d.e2.zeta)}**; $f_1 = ${f4(d.e1.wn)}/2\\pi = $ **${f4(d.e1.wn / TAU)} Hz**.`,
          ],
        };
      }
      const v = d.pc[d.k1].v;
      const w = d.pc[d.k2].v;
      const ratioHint = `Mode 1 (${colName(d.k1)}): $V_2/V_1 = (${matlabCell(v[3]).trim()})/(${matlabCell(v[2]).trim()}) = ${f4(d.r1.mag)}\\angle{${f3(d.r1.deg)}}°$; mode 2 (${colName(d.k2)}): $V_2/V_1 = ${f4(d.r2.mag)}\\angle{${f3(d.r2.deg)}}°$.`;
      const parts: SolvePart[] = [];
      if (tier === 2) {
        parts.push(
          { kind: 'numeric', id: 'z1', label: 'Damping ratio of mode 1, $\\zeta_1$', answer: d.e1.zeta, unit: '', traps: keep(d.e1.zeta, [{ value: d.e2.zeta, message: 'That is the other pair: mode 1 has the smaller $|s|$.', trapId: 'matlab-unsorted' }]) },
          { kind: 'numeric', id: 'z2', label: 'Damping ratio of mode 2, $\\zeta_2$', answer: d.e2.zeta, unit: '', traps: keep(d.e2.zeta, [{ value: d.e1.zeta, message: 'That is mode 1’s value.', trapId: 'matlab-unsorted' }]) }
        );
      }
      parts.push({
        kind: 'numeric',
        id: 'r1',
        label: 'Mode 1 shape: $X_2/X_1$ as a real number (sign shows the phase)',
        answer: r1,
        unit: '',
        traps: keep(r1, [
          { value: 1 / r1, message: 'That is $X_1/X_2$: the ratio is upside down.' },
          { value: r2, message: 'That is mode 2’s column. Identify mode 1 by $|s|$ first.', trapId: 'matlab-unsorted' },
          xRowTrap(v),
        ]),
      });
      if (tier === 3)
        parts.push({
          kind: 'numeric',
          id: 'r2',
          label: 'Mode 2 shape: $X_2/X_1$ as a real number',
          answer: r2,
          unit: '',
          traps: keep(r2, [
            { value: 1 / r2, message: 'That is $X_1/X_2$.' },
            { value: r1, message: 'That is mode 1’s column.', trapId: 'matlab-unsorted' },
            xRowTrap(w),
          ]),
        });
      parts.push({
        kind: 'choice',
        id: 'phase',
        label: tier === 3 ? 'How do the masses move in mode 2?' : 'How do the masses move in mode 1?',
        options: (['in phase', 'out of phase', 'neither in nor out of phase'] as const).map((p) => {
          const deg = tier === 3 ? d.r2.deg : d.r1.deg;
          return { text: p === 'neither in nor out of phase' ? 'Neither: the angle is far from both 0° and 180°' : `Almost ${p}`, correct: phaseWord(deg) === p, why: `The angle of $X_2/X_1$ is ${f3(deg)}°.` };
        }),
      });
      return {
        prompt: lead,
        figure: matlabFigure(
          [
            { name: 'P', cells: d.text.P },
            { name: 'D', cells: d.text.D },
          ],
          cmd
        ),
        parts,
        hints: [
          'Each eigenvector column is $[X;\\,sX]$, conjugate pairs sit side by side, and MATLAB does not sort. Identify mode 1 by $|s|$, then take ratios inside its column; the velocity rows ($V$) keep more digits than the tiny displacement rows.',
          '$\\zeta = -\\mathrm{Re}\\,s/|s|$; mode shape $X_2/X_1 = V_2/V_1$ (same column); angle near 0° in phase, near 180° out of phase.',
          pairHint,
          `${tier === 2 ? `$\\zeta_1 = $ **${f4(d.e1.zeta)}**, $\\zeta_2 = $ **${f4(d.e2.zeta)}**. ` : ''}${ratioHint} So mode 1 is $[1;\\,${f4(r1)}]$ (**${f4(r1)}**, ${phaseWord(d.r1.deg)})${tier === 3 ? ` and mode 2 is $[1;\\,${f4(r2)}]$ (**${f4(r2)}**, ${phaseWord(d.r2.deg)})` : ''}. Check $sX = V$ in column ${d.k1 + 1}: $(${s1.re < 0 ? '-' : ''}${Math.abs(s1.re).toFixed(4)} + ${Math.abs(s1.im).toFixed(4)}i)(${matlabCell(v[0]).trim()}) \\approx ${matlabCell(v[2]).trim()}$; mode 2 column ${d.k2 + 1}: $V_1 = ${matlabCell(w[2]).trim()}$.`,
        ],
      };
    },
  },

  // ------------------------------------------------------------------ P only
  {
    id: 'a6-p-only',
    title: 'Mode shapes from P alone (no D)',
    summary: 'Recover $s = V_j/X_j$ from a column to tell the modes apart, then read the shapes from the velocity rows.',
    tiers: [2, 3],
    source: 'Similar to 2024 A1.1; summary notes A6 (recover s = V₁/X₁ when D is missing)',
    cardId: 'a6-statespace',
    generate(rng, tier) {
      const d = drill(rng);
      const first = d.pc[0];
      const est = sFromColumn(first.v, 2);
      const wEst = cabs(est.s);
      const r1 = d.signed(d.r1);
      const r2 = d.signed(d.r2);
      const firstIsMode1 = d.k1 === 0;
      const x = first.v[est.row];
      const vv = first.v[2 + est.row];
      const parts: SolvePart[] = [
        {
          kind: 'numeric',
          id: 'w',
          label: 'Estimate the natural frequency of the mode in columns 1–2 from $s \\approx V_j/X_j$',
          answer: wEst,
          unit: 'rad/s',
          tol: 0.05,
          traps: keep(wEst, [{ value: cabs(first.v[2 + (1 - est.row)]) / Math.max(1e-4, cabs(first.v[est.row])), message: 'Pair each velocity with its own displacement: $V_1/X_1$ or $V_2/X_2$, not $V_2/X_1$.', trapId: 'a6-mixed-columns' }]),
        },
        {
          kind: 'choice',
          id: 'which',
          label: 'Which columns hold mode 1 (the lower natural frequency)?',
          options: [
            { text: 'Columns 1–2', correct: firstIsMode1, why: firstIsMode1 ? `Their $|s| \\approx ${f3(wEst)}$ rad/s is the smaller one.` : `Their $|s| \\approx ${f3(wEst)}$ rad/s is the larger one: MATLAB printed mode 2 first.` },
            { text: 'Columns 3–4', correct: !firstIsMode1, why: firstIsMode1 ? 'Columns 3–4 have the larger $|s|$.' : 'Columns 3–4 have the smaller $|s|$.' },
          ],
        },
        {
          kind: 'numeric',
          id: 'r1',
          label: 'Mode 1 shape: $X_2/X_1$ as a real number',
          answer: r1,
          unit: '',
          traps: keep(r1, [
            { value: 1 / r1, message: 'That is $X_1/X_2$.' },
            { value: r2, message: 'That is the other mode’s column.', trapId: 'matlab-unsorted' },
            xRowTrap(d.pc[d.k1].v),
          ]),
        },
        {
          kind: 'numeric',
          id: 'r2',
          label: 'Mode 2 shape: $X_2/X_1$ as a real number',
          answer: r2,
          unit: '',
          traps: keep(r2, [
            { value: 1 / r2, message: 'That is $X_1/X_2$.' },
            { value: r1, message: 'That is mode 1’s column.', trapId: 'matlab-unsorted' },
            xRowTrap(d.pc[d.k2].v),
          ]),
        },
      ];
      if (tier === 3)
        parts.push({
          kind: 'choice',
          id: 'dominant',
          label: 'In mode 1, which mass has the larger amplitude?',
          options: [
            { text: 'Mass 2 (the outer mass)', correct: Math.abs(r1) > 1, why: `$|X_2/X_1| = ${f3(Math.abs(r1))}$.` },
            { text: 'Mass 1 (the mass on the support)', correct: Math.abs(r1) < 1, why: `$|X_2/X_1| = ${f3(Math.abs(r1))}$.` },
          ],
        });
      return {
        prompt: 'A two-mass chain with dampers (mass 1 on the support, mass 2 beyond it) was solved with `[P,D] = eig([zeros(2),eye(2);-inv(M)*K,-inv(M)*C])`, but only $P$ was printed (rows $X_1$, $X_2$, $V_1$, $V_2$). Mode 1 is the lower-frequency mode.',
        figure: matlabFigure([{ name: 'P', cells: d.text.P }], '[P,D] = eig(A);  P'),
        parts,
        hints: [
          'Each column is $[X;\\,sX]$, so $s = V_j/X_j$ inside a column. Use the displacement entry that is best resolved (the larger one); entries printed 0.0000 are noise.',
          '$\\omega_n \\approx |V_j/X_j|$ tells the two pairs apart (smaller = mode 1). The shape is $X_2/X_1 = V_2/V_1$ from the velocity rows of that mode’s column.',
          `Columns 1–2: $V_${est.row + 1}/X_${est.row + 1} = (${matlabCell(vv).trim()})/(${matlabCell(x).trim()}) \\approx ${f3(est.s.re)} + ${f4(est.s.im)}i$, so $|s| \\approx ${f4(wEst)}$ rad/s: ${firstIsMode1 ? 'mode 1' : 'mode 2 (the higher mode was printed first)'}.`,
          `$|s| \\approx $ **${f4(wEst)} rad/s** for columns 1–2, so mode 1 is in **${colName(d.k1)}**. Mode 1: $V_2/V_1 = ${f4(d.r1.mag)}\\angle{${f3(d.r1.deg)}}°$ ⇒ **${f4(r1)}**; mode 2: $${f4(d.r2.mag)}\\angle{${f3(d.r2.deg)}}°$ ⇒ **${f4(r2)}**. (Exact eigenvalues: $|s_1| = ${f4(d.e1.wn)}$, $|s_2| = ${f4(d.e2.wn)}$ rad/s.)`,
        ],
      };
    },
  },

  // ------------------------------------------------------------------ damped natural frequencies from a list
  {
    id: 'a6-damped-freqs',
    title: 'Damped natural frequencies from a list of eigenvalues',
    summary: 'Pair the conjugates, sort by $|s|$, read $\\omega_d = |\\mathrm{Im}\\,s|$; real pairs are overdamped modes.',
    tiers: [1, 2, 3],
    source: 'Similar to 2025 A1.5; official 2018 A1.6(a)–(b)',
    cardId: 'a6-eigenvalues',
    generate(rng, tier) {
      const mk = (wn: number, z: number): C => ({ re: -Number((z * wn).toFixed(4)), im: Number((wn * Math.sqrt(1 - z * z)).toFixed(4)) });
      const wn1 = rng.step(6, 30, 0.01);
      const wn2 = wn1 * rng.step(2.2, Math.min(4, 95 / wn1), 0.01); // below 100 rad/s, so format short keeps 4 decimals (as in 2025)
      const sA = mk(wn1, rng.step(0.0008, 0.006, 0.0001));
      const sB = mk(wn2, rng.step(0.001, 0.008, 0.0001));
      const list: C[][] = [[sA], [sB]];
      let real: [number, number] | null = null;
      if (tier === 3) {
        const wnR = rng.step(4, 40, 0.5);
        const zR = rng.step(1.5, 4, 0.1);
        const dd = wnR * Math.sqrt(zR * zR - 1);
        real = [Number((zR * wnR - dd).toFixed(4)), Number((zR * wnR + dd).toFixed(4))];
      }
      const blocks = rng.shuffle(list.concat(real ? [[{ re: -real[0], im: 0 }]] : []));
      if (blocks[0][0] === sA && rng.chance(0.7)) blocks.reverse(); // mostly print the higher mode first, as in 2025
      const printed: C[] = [];
      for (const b of blocks) {
        if (b[0].im === 0 && real) printed.push({ re: -real[0], im: 0 }, { re: -real[1], im: 0 });
        else printed.push(b[0], { re: b[0].re, im: -b[0].im });
      }
      const text = eigListText(printed);
      const e1 = fromEigenvalue(sA);
      const e2 = fromEigenvalue(sB);
      const parts: SolvePart[] = [
        {
          kind: 'numeric',
          id: 'fd1',
          label: real ? 'Damped natural frequency of the **lower** of the two oscillating modes' : 'Damped natural frequency of mode 1 (the lower mode)',
          answer: e1.wd / TAU,
          unit: 'Hz',
          freq: true,
          traps: keep(e1.wd / TAU, [{ value: e2.wd / TAU, message: 'That is the other mode: sort by $|s|$; the list is not ordered.', trapId: 'matlab-unsorted' }]),
        },
        {
          kind: 'numeric',
          id: 'fd2',
          label: real ? 'Damped natural frequency of the **higher** oscillating mode' : 'Damped natural frequency of mode 2',
          answer: e2.wd / TAU,
          unit: 'Hz',
          freq: true,
          traps: keep(e2.wd / TAU, [{ value: e1.wd / TAU, message: 'That is the lower mode.', trapId: 'matlab-unsorted' }]),
        },
      ];
      if (tier === 2)
        parts.push({ kind: 'numeric', id: 't1', label: 'Time for the higher mode’s envelope to fall to 1 %', answer: LN100 / -sB.re, unit: 's', traps: keep(LN100 / -sB.re, [{ value: 1 / -sB.re, message: '$1/(\\zeta\\omega_n)$ is one time constant (37 %); 1 % takes $\\ln 100 \\approx 4.6$ of them.' }, { value: LN100 / -sA.re, message: 'That is the lower mode’s decay.', trapId: 'matlab-unsorted' }]) });
      if (tier === 3 && real)
        parts.push({
          kind: 'choice',
          id: 'real',
          label: `What do the real eigenvalues $-${real[0]}$ and $-${real[1]}$ represent?`,
          options: [
            { text: 'An overdamped mode: it decays without oscillating, so it has no damped natural frequency.', correct: true, why: `Real negative pair: $\\omega_n = \\sqrt{${real[0]}\\times ${real[1]}} = ${f3(Math.sqrt(real[0] * real[1]))}$ rad/s, $\\zeta = ${f3((real[0] + real[1]) / (2 * Math.sqrt(real[0] * real[1])))}$.` },
            { text: 'A mode with damped natural frequencies of $' + real[0] + '$ and $' + real[1] + '$ rad/s.', correct: false, why: 'Real eigenvalues are decay rates, not frequencies.' },
            { text: 'Two rigid-body modes.', correct: false, why: 'Rigid-body modes have $s = 0$.' },
          ],
        });
      const sortedTxt = `$|${pairTeX(sA)}| = ${f4(e1.wn)}$ and $|${pairTeX(sB)}| = ${f4(e2.wn)}$ rad/s`;
      return {
        prompt: `A ${real ? 'three' : 'two'}-mass model with light damping${real ? ' (one mode is heavily damped)' : ''} is solved with \`eig(A)\`, which prints the eigenvalues below in its own order.`,
        figure: matlabFigure([{ name: 'ans', cells: text }], 'eig(A)'),
        parts,
        hints: [
          'Each conjugate pair is one oscillating mode with $\\omega_d = |\\mathrm{Im}\\,s|$; a real negative pair is an overdamped mode. The list is not sorted: order the modes by $|s|$.',
          '$f_d = |\\mathrm{Im}\\,s|/2\\pi$; envelope $e^{\\mathrm{Re}(s)t}$ falls to 1 % after $\\ln 100/|\\mathrm{Re}\\,s|$.',
          `${sortedTxt}, so the lower oscillating mode is $${pairTeX(sA)}$${real ? `; the real pair $-${real[0]}$, $-${real[1]}$ has no imaginary part, so it has no $\\omega_d$` : ''}.`,
          `$f_{d1} = ${sA.im}/2\\pi = $ **${f4(e1.wd / TAU)} Hz**; $f_{d2} = ${sB.im}/2\\pi = $ **${f4(e2.wd / TAU)} Hz**${tier === 2 ? `; $t_{1\\%} = 4.605/${-sB.re} = $ **${f4(LN100 / -sB.re)} s**` : ''}${real ? `. The real pair is an overdamped mode with no $\\omega_d$` : ''}. ($\\zeta_1 = ${f3(e1.zeta)}$, $\\zeta_2 = ${f3(e2.zeta)}$, so $\\omega_d \\approx \\omega_n$.)`,
        ],
      };
    },
  },

  // ------------------------------------------------------------------ Rayleigh damping
  {
    id: 'a6-rayleigh',
    title: 'Rayleigh damping: ζ = α/2ω + βω/2',
    summary: 'Modal damping from $C = \\alpha M + \\beta K$; the belt drive with $C \\propto K$; choosing α and β for two targets.',
    tiers: [1, 2, 3],
    source: 'Similar to official 2019 Q2(5)–(6); LA9 Eq 9.7',
    cardId: 'a6-rayleigh',
    generate(rng, tier) {
      if (tier === 2) {
        const R1 = rng.step(0.03, 0.1, 0.005);
        const R2 = Number((R1 * rng.pick([1.5, 2, 2.5, 3])).toFixed(4));
        const IT = rng.step(0.01, 0.1, 0.005);
        const IP = rng.step(0.05, 1, 0.01);
        const k = rng.step(5000, 50000, 1000);
        const wn = Math.sqrt(2 * k * ((R1 * R1) / IT + (R2 * R2) / IP));
        const c = sig((2 * k * rng.step(0.01, 0.15, 0.005)) / wn, 3); // a damper giving a light-to-moderate ζ
        const z = (c * wn) / (2 * k);
        const wd = wn * Math.sqrt(1 - z * z);
        return {
          prompt: `A belt drive: motor pulley ($R_1$ = ${R1} m, $I_T$ = ${IT} kg m²) and driven pulley ($R_2$ = ${R2} m, $I_P$ = ${IP} kg m²) joined by a belt whose two sides each have stiffness $k$ = ${k} N/m and, alongside, a damper $c$ = ${c} N s/m. So $C$ has the same form as $K$ with $c$ in place of $k$.`,
          givens: [
            { sym: 'R_1,\\ R_2', value: `${R1}, ${R2} m` },
            { sym: 'I_T,\\ I_P', value: `${IT}, ${IP} kg m²` },
            { sym: 'k,\\ c', value: `${k} N/m, ${c} N s/m`, label: 'each belt side' },
          ],
          parts: [
            { kind: 'numeric', id: 'wn', label: 'Undamped natural frequency of the flexible mode', answer: wn, unit: 'rad/s', freq: true, traps: keep(wn, [{ value: wn / Math.SQRT2, message: 'Both belt sides stretch: $K$ has $2k$.', trapId: 'factor2' }]) },
            {
              kind: 'numeric',
              id: 'z',
              label: 'Damping ratio $\\zeta$ of that mode',
              answer: z,
              unit: '',
              traps: keep(z, [
                { value: (c * wn) / k, message: 'Missing the ½: $2\\zeta\\omega_n = \\beta\\omega_n^2$ gives $\\zeta = \\beta\\omega_n/2$.', trapId: 'factor2' },
                { value: c / (2 * k * wn), message: '$\\beta/(2\\omega)$ is the mass-proportional form. Here $\\alpha = 0$, $\\beta = c/k$, so $\\zeta = c\\omega_n/(2k)$.' },
              ]),
            },
            { kind: 'numeric', id: 'fd', label: 'Damped natural frequency $f_d$', answer: wd / TAU, unit: 'Hz', freq: true },
          ],
          hints: [
            '$C = (c/k)K$ is Rayleigh damping with $\\alpha = 0$, $\\beta = c/k$, so the undamped mode still applies and $2\\zeta\\omega_n = \\beta\\omega_n^2$ (official 2019 Q2(5)).',
            '$\\omega_n^2 = 2k(R_1^2/I_T + R_2^2/I_P)$ (topic A3); $\\zeta = c\\omega_n/(2k)$; $\\omega_d = \\omega_n\\sqrt{1-\\zeta^2}$.',
            `$\\omega_n^2 = 2(${k})(${R1}^2/${IT} + ${R2}^2/${IP}) = ${t4(wn * wn)}$ s⁻², $\\omega_n = ${f4(wn)}$ rad/s.`,
            `$\\omega_n = $ **${f4(wn)} rad/s**; $\\zeta = ${c}\\times ${f4(wn)}/(2\\times ${k}) = $ **${f4(z)}**; $\\omega_d = ${f4(wd)}$ rad/s $=$ **${f4(wd / TAU)} Hz**. The rigid-body mode ($\\omega = 0$) is not damped by $C \\propto K$.`,
          ],
        };
      }
      if (tier === 3) {
        const w1 = rng.step(5, 60, 1);
        const q = rng.step(3, 12, 0.5);
        const w2 = w1 * q;
        const z1 = rng.step(0.01, 0.06, 0.005);
        // Keep α > 0 and β > 0: 1.25 ζ1/q ≤ ζ2 ≤ 0.8 ζ1 q.
        const lo = Math.max(0.01, Math.ceil((1.25 * z1 * 200) / q) / 200);
        const z2 = rng.step(lo, Math.max(lo, Math.min(0.06, 0.8 * z1 * q)), 0.005);
        const d = w2 * w2 - w1 * w1;
        const beta = (2 * (z2 * w2 - z1 * w1)) / d;
        const alpha = (2 * w1 * w2 * (z1 * w2 - z2 * w1)) / d;
        const w3 = Number(Math.sqrt(w1 * w2).toPrecision(3));
        const z3 = rayleighZetaAt(alpha, beta, w3);
        return {
          prompt: `Choose Rayleigh damping $C = \\alpha M + \\beta K$ so that the mode at $\\omega_1$ = ${w1} rad/s has $\\zeta_1$ = ${z1} and the mode at $\\omega_2$ = ${f4(w2)} rad/s has $\\zeta_2$ = ${z2}.`,
          givens: [
            { sym: '\\omega_1,\\ \\zeta_1', value: `${w1} rad/s, ${z1}` },
            { sym: '\\omega_2,\\ \\zeta_2', value: `${f4(w2)} rad/s, ${z2}` },
          ],
          parts: [
            { kind: 'numeric', id: 'alpha', label: 'Mass coefficient $\\alpha$', answer: alpha, unit: 's⁻¹', absTol: 1e-4 },
            { kind: 'numeric', id: 'beta', label: 'Stiffness coefficient $\\beta$', answer: beta, unit: 's', absTol: 1e-7 },
            { kind: 'numeric', id: 'z3', label: `Resulting $\\zeta$ of a mode at ${w3} rad/s`, answer: z3, unit: '', traps: keep(z3, [{ value: (z1 + z2) / 2, message: '$\\zeta(\\omega)$ is not linear: it dips between the two targets.' }]) },
          ],
          hints: [
            'Each mode satisfies $\\alpha + \\beta\\omega_i^2 = 2\\zeta_i\\omega_i$ (LA9 Eq 9.7): two equations, two unknowns.',
            '$\\beta = \\dfrac{2(\\zeta_2\\omega_2-\\zeta_1\\omega_1)}{\\omega_2^2-\\omega_1^2}$, $\\alpha = 2\\zeta_1\\omega_1 - \\beta\\omega_1^2$; then $\\zeta(\\omega) = \\alpha/(2\\omega) + \\beta\\omega/2$.',
            `$2\\zeta_1\\omega_1 = ${f4(2 * z1 * w1)}$, $2\\zeta_2\\omega_2 = ${f4(2 * z2 * w2)}$, $\\omega_2^2 - \\omega_1^2 = ${f4(d)}$.`,
            `$\\beta = $ **${fmt(beta, 4)} s**, $\\alpha = $ **${fmt(alpha, 4)} s⁻¹**; $\\zeta(${w3}) = ${fmt(alpha, 4)}/(2\\times ${w3}) + ${fmt(beta, 4)}\\times ${w3}/2 = $ **${f4(z3)}**.`,
          ],
        };
      }
      const alpha = rng.step(0.1, 5, 0.1);
      const beta = rng.step(1e-4, 5e-3, 1e-4);
      const w = rng.step(5, 200, 1);
      const z = rayleighZetaAt(alpha, beta, w);
      return {
        prompt: `A structure has Rayleigh damping $C = \\alpha M + \\beta K$ with $\\alpha$ = ${alpha} s⁻¹ and $\\beta$ = ${fmt(beta, 3)} s. One of its modes has $\\omega_n$ = ${w} rad/s.`,
        givens: [
          { sym: '\\alpha', value: `${alpha} s⁻¹` },
          { sym: '\\beta', value: `${fmt(beta, 3)} s` },
          { sym: '\\omega_n', value: `${w} rad/s` },
        ],
        parts: [
          {
            kind: 'numeric',
            id: 'z',
            label: 'Damping ratio of that mode, $\\zeta$',
            answer: z,
            unit: '',
            traps: keep(z, [
              { value: alpha / w + beta * w, message: 'Missing the ½: $2\\zeta\\omega = \\alpha + \\beta\\omega^2$.', trapId: 'factor2' },
              { value: alpha / (2 * w), message: 'That is only the mass part; add $\\beta\\omega/2$.' },
              { value: (beta * w) / 2, message: 'That is only the stiffness part; add $\\alpha/(2\\omega)$.' },
            ]),
          },
        ],
        hints: [
          'Proportional damping keeps the modes real; each mode’s equation is $\\ddot y + (\\alpha + \\beta\\omega_i^2)\\dot y + \\omega_i^2y = \\cdots$, so $2\\zeta_i\\omega_i = \\alpha + \\beta\\omega_i^2$.',
          '$\\zeta = \\alpha/(2\\omega) + \\beta\\omega/2$.',
          `$\\alpha/(2\\omega) = ${alpha}/${2 * w} = ${f4(alpha / (2 * w))}$; $\\beta\\omega/2 = ${fmt(beta, 3)}\\times ${w}/2 = ${f4((beta * w) / 2)}$.`,
          `$\\zeta = $ **${f4(z)}** (the ${alpha / (2 * w) > (beta * w) / 2 ? 'mass' : 'stiffness'} term dominates at this frequency).`,
        ],
      };
    },
  },
];
