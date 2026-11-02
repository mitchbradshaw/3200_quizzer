// B3 problem generators: the B2 design step (size w, d or L for a frequency margin), the ratio trick,
// node positions, section scaling and boundary-condition identification. Exact βL roots are used
// throughout (the handout's 3–4 digit values agree within 0.1 %); hints walk concept → set-up →
// substitution → worked solution with this instance's numbers.
import type { SolveGenerator, SolvePart } from '../../engine/types';
import { type BeamBC, beamBCInfo, betaL, modeShape, nodes } from '../../physics/beams';
import { BC_NAME, RIGID, beta1L, ratioTrick, torsionWaveSpeed } from './physics';
import { TAU, f3, f4, t4, traps } from './solveKit';

const CF: BeamBC = 'clamped-free';
const ORD = ['', 'first', 'second', 'third', 'fourth', 'fifth'];
const SUB = ['', '₁', '₂', '₃', '₄', '₅'];

/** (βᵢL)² for a BC. */
const bl2 = (bc: BeamBC, i: number) => betaL(bc, i)[i - 1] ** 2;

/** Sketch-rule check for the ends of a beam (the "noting the shape at the boundary conditions" marks of every B2.2). */
function sketchPart(bc: BeamBC): SolvePart {
  const info = beamBCInfo(bc);
  const ends = info.left === info.right ? [{ end: info.left, at: `each ${info.left === 'clamped' ? 'clamp' : info.left === 'pinned' ? 'pin' : 'free end'}` }] : [info.left, info.right].map((e) => ({ end: e, at: `the ${e === 'clamped' ? 'clamp' : e === 'pinned' ? 'pin' : 'free end'}` }));
  const opts: { text: string; correct: boolean; why: string }[] = [];
  for (const { end, at } of ends) {
    if (end === 'clamped') {
      opts.push({ text: `At ${at}: zero deflection **and** zero slope (the curve leaves the wall flat).`, correct: true, why: "Clamped: $y = y' = 0$." });
      opts.push({ text: `At ${at}: zero deflection, but the curve meets it at an angle.`, correct: false, why: 'That is a pin. A clamp also stops rotation, so the slope is zero.' });
    } else if (end === 'pinned') {
      opts.push({ text: `At ${at}: zero deflection and zero curvature, with a non-zero slope.`, correct: true, why: "Pinned: $y = y'' = 0$ (no moment); the beam rotates freely about the pin." });
      opts.push({ text: `At ${at}: zero slope, like a clamp.`, correct: false, why: 'A pin carries no moment and allows rotation: drawing a flat tangent there is a classic sketch error.' });
    } else {
      opts.push({ text: `At ${at}: the largest deflection, with the curve straight there (zero curvature).`, correct: true, why: "Free: $y'' = y''' = 0$ (no moment or shear); normalised $|Y| = 2$." });
      opts.push({ text: `At ${at}: zero slope.`, correct: false, why: 'Nothing restrains the rotation of a free end; its slope is not zero.' });
    }
  }
  return { kind: 'choice', id: 'sketch', label: 'Your sketch of this mode must show… (select all that apply)', multi: true, options: opts };
}

export const generators: SolveGenerator[] = [
  // ------------------------------------------------------------------ rectangular wing (2022 B2.1)
  {
    id: 'b3-wing-width',
    title: 'Size a rectangular wing for a frequency margin',
    summary: 'Thin rectangular cantilever: in-plane frequencies scale with the width $w$ and out-of-plane ones with $t$. Size $w$, then $f_1$–$f_3$ by the ratio trick.',
    tiers: [1, 2, 3],
    source: 'Similar to 2022 B2.1–2.2 (eVTOL wing) and 2023 B1.5–1.6',
    cardId: 'b3-design',
    marks: 5,
    generate(rng, tier) {
      const b1 = beta1L(CF);
      const k1 = b1 * b1;
      const r2 = ratioTrick(CF, 2);
      const r3 = ratioTrick(CF, 3);
      const rawR2 = betaL(CF, 2)[1] / b1;
      const rawR3 = betaL(CF, 3)[2] / b1;
      if (tier === 1) {
        const mat = rng.pick([
          { name: 'carbon-fibre (CFRP)', E: 280e9, rho: 1600 },
          { name: 'aluminium', E: 70e9, rho: 2700 },
          { name: 'steel', E: 210e9, rho: 7850 },
        ]);
        const L = rng.step(0.5, 3, 0.25);
        const wmm = rng.step(40, 300, 10);
        const tmm = rng.step(2, 10, 1);
        const w = wmm / 1000;
        const c12 = Math.sqrt(mat.E / (12 * mat.rho));
        const w1 = k1 * (w / (L * L)) * c12;
        const f1 = w1 / TAU;
        return {
          prompt: `${mat.name === 'aluminium' ? 'An' : 'A'} ${mat.name} strip, clamped at one end, has length $L$ = ${L} m, width $w$ = ${wmm} mm and thickness $t$ = ${tmm} mm. It vibrates **in its own plane**, bending across the width $w$. Use $E$ = ${mat.E / 1e9} GPa and $\\rho$ = ${mat.rho} kg/m³.`,
          givens: [
            { sym: 'L', value: `${L} m` },
            { sym: 'w', value: `${wmm} mm`, label: 'width (in the bending direction)' },
            { sym: 't', value: `${tmm} mm`, label: 'thickness' },
            { sym: 'E', value: `${mat.E / 1e9} GPa` },
            { sym: '\\rho', value: `${mat.rho} kg/m³` },
          ],
          parts: [
            {
              kind: 'numeric',
              id: 'f1',
              label: 'First natural frequency $f_1$',
              answer: f1,
              unit: 'Hz',
              freq: true,
              traps: traps(f1, [
                { value: (f1 * tmm) / wmm, message: 'You used $t$ as the depth. Bending **across $w$** uses $I = tw^3/12$, so $I/A = w^2/12$ and $t$ cancels.', trapId: 'b3-wrong-plane' },
                { value: f1 * Math.sqrt(12), message: 'For a rectangle $I/A = h^2/12$: the 12 is missing.', trapId: 'b3-wrong-section' },
                { value: (f1 * Math.sqrt(6)) / 2, message: 'That is the thin-tube formula ($I/A = r^2/2$ with $r = w/2$). A solid rectangle has $I/A = w^2/12$.', trapId: 'b3-wrong-section' },
                { value: f1 / b1, message: 'Square $\\beta_1 L$: $\\omega_1 = (\\beta_1 L)^2\\sqrt{EI/(\\rho A L^4)}$ with $(1.875)^2 = 3.516$.', trapId: 'b3-ratio-not-squared' },
              ]),
            },
          ],
          hints: [
            'Bending frequencies depend on the section only through $I/A$: $\\omega_i = (\\beta_i L)^2 (r_g/L^2)\\sqrt{E/\\rho}$ with $r_g = \\sqrt{I/A}$. Take the depth in the bending direction.',
            'Cantilever: $\\beta_1 L = 1.875$. Bending across $w$: $I = tw^3/12$, $A = wt$, so $I/A = w^2/12$ and $\\omega_1 = (1.875)^2\\,\\dfrac{w}{L^2}\\sqrt{\\dfrac{E}{12\\rho}}$.',
            `$\\sqrt{E/12\\rho} = \\sqrt{${t4(mat.E)}/(12 \\times ${mat.rho})} = ${t4(c12)}$ m/s; $w/L^2 = ${w}/${L}^2 = ${t4(w / (L * L))}$ 1/m.`,
            `$\\omega_1 = 3.516 \\times ${t4(w / (L * L))} \\times ${t4(c12)} = ${t4(w1)}$ rad/s, so $f_1 = ${t4(w1)}/2\\pi = $ **${f4(f1)} Hz**. The thickness (${tmm} mm) cancels.`,
          ],
        };
      }
      const mat = rng.pick([
        { E: 280e9, rho: 1600 },
        { E: 230e9, rho: 1550 },
        { E: 180e9, rho: 1500 },
      ]);
      const L = rng.step(1.5, 4, 0.5);
      const N = rng.pick([1800, 2000, 2400, 3000, 3600]);
      const n = rng.pick([2, 2.5, 3]);
      const Om = (TAU * N) / 60;
      const w1 = n * Om;
      const c12 = Math.sqrt(mat.E / (12 * mat.rho));
      const w = (w1 * L * L) / (k1 * c12);
      const f1 = w1 / TAU;
      const f2 = f1 * r2;
      const f3v = f1 * r3;
      const tmm = rng.step(3, 8, 0.5);
      const f1out = (f1 * tmm) / (w * 1000);
      const parts: SolvePart[] = [
        {
          kind: 'numeric',
          id: 'w',
          label: 'Minimum width $w$',
          answer: w,
          unit: 'm',
          traps: traps(w, [
            { value: w / n, message: `That puts $\\omega_1$ exactly at the running speed. The requirement is $\\omega_1 \\ge ${n}\\,\\Omega_{max}$.`, trapId: 'b3-margin' },
            { value: (w * 2) / Math.sqrt(6), message: 'Thin-tube formula used for a solid rectangle ($I/A = r^2/2$ with $r = w/2$ gives $w$ 18 % too small). In-plane, $I/A = w^2/12$: the 2022 notes’ tube formula is a trap.', trapId: 'b3-wrong-section' },
            { value: w * b1, message: 'Square $\\beta_1 L$: $(1.875)^2 = 3.516$.', trapId: 'b3-ratio-not-squared' },
            { value: (w * 60) / TAU, message: 'You used the rotor speed in rpm instead of rad/s: $\\Omega = 2\\pi N/60$.', trapId: 'units' },
          ]),
        },
        { kind: 'numeric', id: 'f1', label: 'Lowest critical speed $f_1$', answer: f1, unit: 'Hz', freq: true, traps: traps(f1, [{ value: N / 60, message: 'That is the rotor speed itself; the design puts $f_1$ at the margin times it.', trapId: 'b3-margin' }]) },
        {
          kind: 'numeric',
          id: 'f2',
          label: 'Second critical speed $f_2$',
          answer: f2,
          unit: 'Hz',
          freq: true,
          traps: traps(f2, [
            { value: f1 * rawR2, message: 'Square the root ratio: $f_2/f_1 = (4.694/1.875)^2 = 6.27$, not 2.50.', trapId: 'b3-ratio-not-squared' },
            { value: f1 * ratioTrick('clamped-clamped', 2), message: 'That is the clamped–clamped / free–free spacing (2.76). The wing is a cantilever (6.27).', trapId: 'b3-wrong-bc-row' },
            { value: 2 * f1, message: 'Beams are not strings: no harmonic 1 : 2 : 3 spacing.' },
          ]),
        },
        {
          kind: 'numeric',
          id: 'f3',
          label: 'Third critical speed $f_3$',
          answer: f3v,
          unit: 'Hz',
          freq: true,
          traps: traps(f3v, [
            { value: f1 * rawR3, message: 'Square the root ratio: $(7.855/1.875)^2 = 17.55$.', trapId: 'b3-ratio-not-squared' },
            { value: f1 * ratioTrick('clamped-clamped', 3), message: 'Clamped–clamped spacing (5.40) used for a cantilever.', trapId: 'b3-wrong-bc-row' },
            { value: 5 * f1, message: '1 : 3 : 5 is the fixed–free rod or shaft spacing, not bending.' },
          ]),
        },
      ];
      if (tier === 3) {
        parts.push(
          {
            kind: 'numeric',
            id: 'f1out',
            label: `Cruise: with $t$ = ${tmm} mm, the lowest **out-of-plane** critical speed $f_{1,out}$`,
            answer: f1out,
            unit: 'Hz',
            freq: true,
            traps: traps(f1out, [
              { value: (f1 * (tmm / (w * 1000)) ** 2), message: 'Stiffness scales by $(t/w)^2$, frequency by its square root: $t/w$.', trapId: 'b3-wrong-plane' },
              { value: (f1 * w * 1000) / tmm, message: 'Upside down: out of plane the depth is the thin side $t$, so the frequency drops.', trapId: 'b3-wrong-plane' },
            ]),
          },
          {
            kind: 'choice',
            id: 'tEffect',
            label: 'If the thickness $t$ is doubled, the take-off (in-plane) critical speeds…',
            options: [
              { text: 'do not change', correct: true, why: 'In-plane $I/A = w^2/12$: $t$ cancels (it only changes the deflection, B4).' },
              { text: 'double', correct: false, why: 'That would need $\\omega \\propto t$: true only for out-of-plane bending.' },
              { text: 'rise by $\\sqrt2$', correct: false, why: 'Stiffness and mass both double, so nothing changes.' },
              { text: 'halve', correct: false, why: 'More material cannot lower a frequency when stiffness grows in proportion.' },
            ],
          }
        );
      }
      return {
        prompt: `An eVTOL wing is a carbon-fibre cantilever ($E$ = ${mat.E / 1e9} GPa, $\\rho$ = ${mat.rho} kg/m³) of length $L$ = ${L} m, fixed at the aircraft centre, with a thin rectangular section of width $w$ and thickness $t \\ll w$. Rotors on the wing spin at up to ${N} rpm during take-off and their unbalance excites **in-plane** bending (across $w$). Neglect the rotor inertia. Design the minimum $w$ so the lowest critical speed is at least ${n} times the maximum running speed, then find the first three critical speeds.${tier === 3 ? ` In cruise the rotor axes tilt, so the same unbalance drives **out-of-plane** bending (across $t$); take $t$ = ${tmm} mm.` : ''}`,
        givens: [
          { sym: 'E', value: `${mat.E / 1e9} GPa` },
          { sym: '\\rho', value: `${mat.rho} kg/m³` },
          { sym: 'L', value: `${L} m` },
          { sym: 'N_{max}', value: `${N} rpm` },
          { sym: 'n', value: `${n}`, label: 'frequency margin' },
          ...(tier === 3 ? [{ sym: 't', value: `${tmm} mm` }] : []),
        ],
        parts,
        hints: [
          'Only $I/A$ matters. For in-plane bending the depth is $w$, so $I/A = w^2/12$ and $t$ cancels. Convert the speed to rad/s and apply the margin before solving for $w$.',
          `$\\Omega_{max} = 2\\pi N/60$; require $\\omega_1 = ${n}\\,\\Omega_{max} = (\\beta_1 L)^2\\dfrac{w}{L^2}\\sqrt{\\dfrac{E}{12\\rho}}$, so $w = \\dfrac{${n}\\,\\Omega_{max}L^2}{(\\beta_1 L)^2\\sqrt{E/12\\rho}}$. Then $f_i = f_1(\\beta_i L/\\beta_1 L)^2$.${tier === 3 ? ' Out of plane the depth is $t$: $f_{1,out} = f_1\\,t/w$.' : ''}`,
          `$\\Omega_{max} = 2\\pi(${N})/60 = ${t4(Om)}$ rad/s; $\\omega_1 = ${n} \\times ${t4(Om)} = ${t4(w1)}$ rad/s; $\\sqrt{E/12\\rho} = ${t4(c12)}$ m/s; $(\\beta_1 L)^2 = 3.516$.`,
          `$w = ${t4(w1)} \\times ${L}^2/(3.516 \\times ${t4(c12)}) = $ **${f4(w)} m**. $f_1 = ${t4(w1)}/2\\pi = $ **${f4(f1)} Hz**, $f_2 = 6.267 f_1 = $ **${f4(f2)} Hz**, $f_3 = 17.55 f_1 = $ **${f4(f3v)} Hz** (${f4(f1 * 60)}, ${f4(f2 * 60)}, ${f4(f3v * 60)} rpm).${tier === 3 ? ` Cruise: $f_{1,out} = ${f4(f1)} \\times ${tmm}/${f4(w * 1000)} = $ **${f4(f1out)} Hz**. Doubling $t$ leaves the take-off frequencies unchanged.` : ''}`,
        ],
      };
    },
  },

  // ------------------------------------------------------------------ thin tube (2023 B2.1, 2024 B2.4)
  {
    id: 'b3-tube-diameter',
    title: 'Thin-tube blades and shafts: size d, find the frequencies',
    summary: 'Thin tube: $I/A = r^2/2$, so $\\omega \\propto d/L^2$ and the wall thickness cancels. Size a blade diameter from a tip speed, or find a shaft’s bending frequencies after a torsion test.',
    tiers: [1, 2, 3],
    source: 'Similar to 2023 B2.1 (turbine blade) and 2024 B2.1, B2.4 (hydro shaft)',
    cardId: 'b3-design',
    marks: 6,
    generate(rng, tier) {
      if (tier === 1) {
        const mat = rng.pick([
          { name: 'steel', E: 210e9, rho: 7850 },
          { name: 'aluminium', E: 70e9, rho: 2700 },
        ]);
        const dmm = rng.step(50, 400, 10);
        const tmm = rng.step(2, 8, 1);
        const L = rng.step(1, 6, 0.5);
        const r = dmm / 2000;
        const c2 = Math.sqrt(mat.E / (2 * mat.rho));
        const w1 = bl2(CF, 1) * (r / (L * L)) * c2;
        const f1 = w1 / TAU;
        return {
          prompt: `${mat.name === 'aluminium' ? 'An' : 'A'} ${mat.name} thin-walled tube (mean diameter $d$ = ${dmm} mm, wall $t$ = ${tmm} mm) is a cantilever of length $L$ = ${L} m. Use $I \\approx \\pi r^3 t$, $A \\approx 2\\pi r t$, $E$ = ${mat.E / 1e9} GPa and $\\rho$ = ${mat.rho} kg/m³.`,
          givens: [
            { sym: 'd', value: `${dmm} mm` },
            { sym: 't', value: `${tmm} mm` },
            { sym: 'L', value: `${L} m` },
            { sym: 'E', value: `${mat.E / 1e9} GPa` },
            { sym: '\\rho', value: `${mat.rho} kg/m³` },
          ],
          parts: [
            {
              kind: 'numeric',
              id: 'f1',
              label: 'First bending natural frequency $f_1$',
              answer: f1,
              unit: 'Hz',
              freq: true,
              traps: traps(f1, [
                { value: 2 * f1, message: 'You used the diameter where the radius belongs: $I/A = r^2/2$ with $r = d/2$.', trapId: 'factor2' },
                { value: f1 * Math.SQRT2, message: 'The thin tube has $I/A = r^2/2$, so the root is $\\sqrt{E/2\\rho}$, not $\\sqrt{E/\\rho}$.', trapId: 'b3-wrong-section' },
                { value: f1 / Math.SQRT2, message: 'That is a solid shaft ($I/A = d^2/16$). For a thin tube $I/A = r^2/2$.', trapId: 'b3-wrong-section' },
                { value: f1 / beta1L(CF), message: 'Square $\\beta_1 L$: $(1.875)^2 = 3.516$.', trapId: 'b3-ratio-not-squared' },
              ]),
            },
            {
              kind: 'choice',
              id: 'tDouble',
              label: 'If the wall thickness is doubled (same $d$), $f_1$…',
              options: [
                { text: 'is unchanged', correct: true, why: '$I$ and $A$ are both proportional to $t$, so $t$ cancels in $EI/\\rho A = Er^2/2\\rho$.' },
                { text: 'doubles', correct: false, why: 'Stiffness doubles but so does the mass per length.' },
                { text: 'rises by $\\sqrt2$', correct: false, why: 'Nothing changes: $\\omega$ depends on $I/A$ only.' },
                { text: 'halves', correct: false, why: 'Extra wall adds stiffness in proportion to its mass.' },
              ],
            },
          ],
          hints: [
            'Frequencies depend on the section through $I/A$ only. For a thin tube $I/A = \\pi r^3 t/(2\\pi r t) = r^2/2$: the wall thickness cancels.',
            'Cantilever, $\\beta_1 L = 1.875$: $\\omega_1 = (1.875)^2\\,\\dfrac{r}{L^2}\\sqrt{\\dfrac{E}{2\\rho}}$, with $r = d/2$.',
            `$r = ${r}$ m, $\\sqrt{E/2\\rho} = ${t4(c2)}$ m/s, $r/L^2 = ${t4(r / (L * L))}$ 1/m.`,
            `$\\omega_1 = 3.516 \\times ${t4(r / (L * L))} \\times ${t4(c2)} = ${t4(w1)}$ rad/s, so $f_1 = $ **${f4(f1)} Hz**, whatever the wall thickness.`,
          ],
        };
      }
      if (tier === 2) {
        const mat = rng.pick([
          { E: 13.23e9, rho: 1820 },
          { E: 20e9, rho: 1850 },
          { E: 40e9, rho: 1900 },
        ]);
        const L = rng.step(40, 100, 2);
        const V = rng.step(80, 150, 10);
        const k = rng.pick([1, 1.5, 1.8, 2, 3]);
        const n = rng.pick([1.5, 2, 2.5, 3]);
        const Om = V / L;
        const w1 = n * k * Om;
        const c2 = Math.sqrt(mat.E / (2 * mat.rho));
        const r = (w1 * L * L) / (bl2(CF, 1) * c2);
        const d = 2 * r;
        const f1 = w1 / TAU;
        const f2 = f1 * ratioTrick(CF, 2);
        const f3v = f1 * ratioTrick(CF, 3);
        return {
          prompt: `A wind-turbine blade’s main spar is a composite thin tube ($E$ = ${f4(mat.E / 1e9)} GPa, $\\rho$ = ${mat.rho} kg/m³), modelled as a cantilever of length $L$ = ${L} m fixed at the turbine axis. The blade tip speed is at most ${V} m/s, and a bearing defect excites the blade at ${k === 1 ? 'the rotation frequency Ω' : `${k} times the rotation frequency Ω`}. Ignore the hub. Design the diameter $d$ so the lowest transverse critical speed is at least ${n} times the excitation frequency, then give the first three critical speeds.`,
          givens: [
            { sym: 'E', value: `${f4(mat.E / 1e9)} GPa` },
            { sym: '\\rho', value: `${mat.rho} kg/m³` },
            { sym: 'L', value: `${L} m` },
            { sym: 'V_{tip}', value: `${V} m/s` },
            { sym: '\\Omega_{exc}', value: k === 1 ? 'Ω' : `${k} Ω`, label: 'bearing-defect excitation' },
            { sym: 'n', value: `${n}`, label: 'margin' },
          ],
          parts: [
            { kind: 'numeric', id: 'Om', label: 'Maximum rotation speed $\\Omega_{max}$', answer: Om, unit: 'rad/s', freq: true, traps: traps(Om, [{ value: V / (2 * L), message: 'The tip is at radius $L$ (the hub is ignored): $\\Omega = V/L$.' }]) },
            {
              kind: 'numeric',
              id: 'd',
              label: 'Minimum diameter $d$',
              answer: d,
              unit: 'm',
              traps: traps(d, [
                { value: d / k, message: `Use the excitation frequency ${k}Ω, not Ω itself.`, trapId: 'b3-margin' },
                { value: d / n, message: `Apply the margin: $\\omega_1 \\ge ${n}\\,\\Omega_{exc}$.`, trapId: 'b3-margin' },
                { value: r, message: 'That is the radius; the question asks for the diameter $d = 2r$.', trapId: 'factor2' },
                { value: (d * Math.sqrt(6)) / 2, message: 'Rectangle formula ($\\sqrt{E/12\\rho}$) used for a tube. Thin tube: $I/A = r^2/2$.', trapId: 'b3-wrong-section' },
              ]),
            },
            { kind: 'numeric', id: 'f1', label: 'First critical speed $f_1$', answer: f1, unit: 'Hz', freq: true },
            { kind: 'numeric', id: 'f2', label: 'Second critical speed $f_2$', answer: f2, unit: 'Hz', freq: true, traps: traps(f2, [{ value: f1 * (betaL(CF, 2)[1] / beta1L(CF)), message: 'Square the βL ratio (6.27, not 2.50).', trapId: 'b3-ratio-not-squared' }]) },
            { kind: 'numeric', id: 'f3', label: 'Third critical speed $f_3$', answer: f3v, unit: 'Hz', freq: true, traps: traps(f3v, [{ value: f1 * (betaL(CF, 3)[2] / beta1L(CF)), message: 'Square the βL ratio (17.55, not 4.19).', trapId: 'b3-ratio-not-squared' }]) },
            {
              kind: 'choice',
              id: 't',
              label: 'Does the answer depend on the wall thickness $t$?',
              options: [
                { text: 'No: $I/A = r^2/2$, so $t$ cancels in the frequencies', correct: true, why: 'Stiffness and mass per length are both proportional to $t$.' },
                { text: 'Yes: a thicker wall is stiffer, so $d$ could be smaller', correct: false, why: 'A thicker wall is also heavier, in the same proportion.' },
                { text: 'Yes: a thicker wall is heavier, so $d$ must be larger', correct: false, why: 'The extra mass is matched by extra stiffness.' },
              ],
            },
          ],
          hints: [
            'The excitation is a multiple of the rotation speed; the tip speed gives Ω. Then size the tube from the in-built ratio $I/A = r^2/2$ (thickness cancels).',
            `$\\Omega_{max} = V/L$; $\\omega_1 = ${n} \\times ${k}\\,\\Omega_{max}$; $\\omega_1 = (1.875)^2\\dfrac{r}{L^2}\\sqrt{\\dfrac{E}{2\\rho}} \\Rightarrow r = \\dfrac{\\omega_1 L^2}{3.516\\sqrt{E/2\\rho}}$, $d = 2r$.`,
            `$\\Omega_{max} = ${V}/${L} = ${t4(Om)}$ rad/s; $\\omega_1 = ${t4(n * k)} \\times ${t4(Om)} = ${t4(w1)}$ rad/s; $\\sqrt{E/2\\rho} = ${t4(c2)}$ m/s.`,
            `$\\Omega_{max}$ = **${f4(Om)} rad/s**; $r = ${t4(w1)} \\times ${L}^2/(3.516 \\times ${t4(c2)}) = ${t4(r)}$ m, so $d$ = **${f4(d)} m** (independent of $t$). $f_1 = ${t4(w1)}/2\\pi = $ **${f4(f1)} Hz**, $f_2 = 6.267f_1 = $ **${f4(f2)} Hz**, $f_3 = 17.55f_1 = $ **${f4(f3v)} Hz**.`,
          ],
        };
      }
      // tier 3: hydro shaft, L from a fixed–fixed torsion test, then pinned–pinned bending (2024 B2.1 + B2.4)
      const E = 210e9;
      const nu = 0.3;
      const rho = 7850;
      const d = rng.step(0.3, 1.2, 0.1);
      const NT = rng.pick([4800, 6000, 7200, 8400, 9600]);
      const fT = NT / 60;
      const cT = torsionWaveSpeed(E, nu, rho);
      const L = cT / (2 * fT);
      const r = d / 2;
      const c2 = Math.sqrt(E / (2 * rho));
      const fB = [1, 2, 3].map((i) => ((i * Math.PI) ** 2 * (r / (L * L)) * c2) / TAU);
      return {
        prompt: `A steel hydropower shaft ($E$ = 210 GPa, $\\nu$ = 0.3, $\\rho$ = 7850 kg/m³) is a thin tube of mean diameter $d$ = ${f3(d)} m. For torsion the heavy generator and turbine rotors act as fixed ends; for bending the shaft is pinned in bearings at the rotors. A commissioning test finds the first torsional critical speed at ${NT} rpm.`,
        givens: [
          { sym: 'E', value: '210 GPa' },
          { sym: '\\nu', value: '0.3' },
          { sym: '\\rho', value: '7850 kg/m³' },
          { sym: 'd', value: `${f3(d)} m` },
          { sym: 'N_{T1}', value: `${NT} rpm`, label: 'first torsional critical speed' },
        ],
        parts: [
          {
            kind: 'numeric',
            id: 'L',
            label: 'Shaft length $L$',
            answer: L,
            unit: 'm',
            traps: traps(L, [
              { value: L / 2, message: 'That is the fixed–free formula $f_1 = c/4L$. Both ends are fixed in torsion: $f_1 = c_T/2L$.', trapId: 'b3-wrong-bc-row' },
              { value: L * Math.sqrt(2 * (1 + nu)), message: 'Torsion travels at $c_T = \\sqrt{G/\\rho}$ with $G = E/2(1+\\nu)$, not $\\sqrt{E/\\rho}$.' },
            ]),
          },
          {
            kind: 'numeric',
            id: 'fB1',
            label: 'First transverse (bending) natural frequency $f_{B1}$',
            answer: fB[0],
            unit: 'Hz',
            freq: true,
            traps: traps(fB[0], [
              { value: fB[0] * (beta1L(CF) / Math.PI) ** 2, message: 'Cantilever row used. Bearings at both ends: pinned–pinned, $\\beta_1 L = \\pi$.', trapId: 'b3-wrong-bc-row' },
              { value: 2 * fB[0], message: 'Use the radius in $I/A = r^2/2$.', trapId: 'factor2' },
            ]),
          },
          {
            kind: 'numeric',
            id: 'fB3',
            label: 'Third transverse natural frequency $f_{B3}$',
            answer: fB[2],
            unit: 'Hz',
            freq: true,
            traps: traps(fB[2], [{ value: 3 * fB[0], message: 'Pinned–pinned bending goes as $i^2$ (1 : 4 : 9); 1 : 2 : 3 is the torsion spacing.', trapId: 'b3-ratio-not-squared' }]),
          },
          {
            kind: 'choice',
            id: 'compare',
            label: 'Compare the torsional (fixed–fixed) and bending (pinned–pinned) modes of this shaft.',
            options: [
              { text: 'Same shapes $\\sin(i\\pi x/L)$; torsion is spaced 1 : 2 : 3, bending 1 : 4 : 9', correct: true, why: 'Pinned–pinned bending has $Y_i = \\sqrt2\\sin(i\\pi x/L)$ with $\\beta_i L = i\\pi$, so $\\omega \\propto i^2$; torsion has $\\omega \\propto i$.' },
              { text: 'The bending shapes include cosh and sinh terms, so they differ from the torsional sines', correct: false, why: 'The hyperbolic terms vanish for pinned–pinned ends; they appear with clamped or free ends.' },
              { text: 'Both sets of frequencies are independent of the diameter', correct: false, why: 'Torsion is, but bending goes as $d$ (through $I/A = r^2/2$).' },
              { text: 'Both are spaced 1 : 4 : 9', correct: false, why: 'Torsion (a wave system) is evenly spaced, $f_i = i\\,c_T/2L$.' },
            ],
          },
        ],
        hints: [
          'Two models of one shaft: torsion as a fixed–fixed wave system ($f_i = i\\,c_T/2L$, no dependence on $d$ or $t$) gives $L$; bending as a pinned–pinned thin tube then gives the transverse frequencies.',
          '$c_T = \\sqrt{G/\\rho}$, $G = E/2(1+\\nu)$, $L = c_T/(2f_{T1})$. Bending: $\\omega_{Bi} = (i\\pi)^2\\dfrac{r}{L^2}\\sqrt{\\dfrac{E}{2\\rho}}$.',
          `$G = ${t4(E / (2 * (1 + nu)))}$ Pa, $c_T = ${t4(cT)}$ m/s, $f_{T1} = ${NT}/60 = ${t4(fT)}$ Hz; $r = ${f4(r)}$ m, $\\sqrt{E/2\\rho} = ${t4(c2)}$ m/s.`,
          `$L = ${t4(cT)}/(2 \\times ${t4(fT)}) = $ **${f4(L)} m**. $f_{B1} = \\pi^2 \\times ${f4(r)}/${f4(L)}^2 \\times ${t4(c2)}/2\\pi = $ **${f4(fB[0])} Hz**, $f_{B2}$ = ${f4(fB[1])} Hz, $f_{B3} = 9f_{B1} = $ **${f4(fB[2])} Hz**. Each lies below the torsional frequency of the same order (${f4(fT)}, ${f4(2 * fT)}, ${f4(3 * fT)} Hz), and none depends on the wall thickness.`,
        ],
      };
    },
  },

  // ------------------------------------------------------------------ length from a measured critical speed (2025 B2.1)
  {
    id: 'b3-length',
    title: 'Blade length from a measured critical speed',
    summary: 'Invert $\\omega_1 = (\\beta_1 L)^2 (r_g/L^2)\\sqrt{E/\\rho}$ for $L$, then the higher critical speeds by the ratio trick.',
    tiers: [1, 2, 3],
    source: 'Similar to 2025 B2.1 (tidal turbine blade); reader sample problem 3',
    cardId: 'b3-design',
    marks: 6,
    generate(rng, tier) {
      const dmm = rng.step(100, 600, 20);
      const E = rng.pick([30, 40, 50]) * 1e9;
      const rho = rng.pick([1800, 1900, 2000]);
      const N1 = rng.step(120, 600, 30);
      const w1 = (TAU * N1) / 60;
      const r = dmm / 2000;
      const c2 = Math.sqrt(E / (2 * rho));
      const k1 = bl2(CF, 1);
      const L = Math.sqrt((k1 * r * c2) / w1);
      const N2 = N1 * ratioTrick(CF, 2);
      const N3 = N1 * ratioTrick(CF, 3);
      const parts: SolvePart[] = [
        {
          kind: 'numeric',
          id: 'L',
          label: 'Blade length $L$',
          answer: L,
          unit: 'm',
          traps: traps(L, [
            { value: L * L, message: 'That is $L^2$: take the square root.', trapId: 'sqrt' },
            { value: L * Math.SQRT2, message: 'Use the radius: $I/A = r^2/2$ with $r = d/2$.', trapId: 'factor2' },
            { value: L * Math.sqrt(TAU), message: '$\\omega_1$ must be in rad/s ($2\\pi f$), not Hz.', trapId: 'units' },
            { value: L * Math.sqrt(TAU / 60), message: 'You put the speed in rpm straight into the formula. Convert: $\\omega = 2\\pi N/60$.', trapId: 'units' },
          ]),
        },
      ];
      if (tier >= 2) {
        parts.push(
          { kind: 'numeric', id: 'N2', label: 'Second critical speed', answer: N2, unit: 'rpm', freq: true, traps: traps(N2, [{ value: N1 * (betaL(CF, 2)[1] / beta1L(CF)), message: 'Square the βL ratio: 6.27.', trapId: 'b3-ratio-not-squared' }, { value: N1 * ratioTrick('clamped-clamped', 2), message: 'Clamped–clamped spacing used for a cantilever.', trapId: 'b3-wrong-bc-row' }]) },
          { kind: 'numeric', id: 'N3', label: 'Third critical speed', answer: N3, unit: 'rpm', freq: true, traps: traps(N3, [{ value: N1 * (betaL(CF, 3)[2] / beta1L(CF)), message: 'Square the βL ratio: 17.55.', trapId: 'b3-ratio-not-squared' }]) }
        );
      }
      const k = rng.pick([1.5, 2.5, 3.4, 4.5, 8, 12, 20, 25]);
      if (tier === 3) {
        const below = k < ratioTrick(CF, 2) ? 1 : k < ratioTrick(CF, 3) ? 2 : 3;
        parts.push(
          { kind: 'numeric', id: 'Om2', label: 'Ratio of the excitation to the second natural frequency, $\\Omega/\\omega_2$', answer: k / ratioTrick(CF, 2), unit: '', traps: traps(k / ratioTrick(CF, 2), [{ value: k / (betaL(CF, 2)[1] / beta1L(CF)), message: '$\\omega_2/\\omega_1 = (4.694/1.875)^2 = 6.27$.', trapId: 'b3-ratio-not-squared' }]) },
          {
            kind: 'choice',
            id: 'below',
            label: `Which natural frequencies lie below the excitation at ${k} × the first critical speed?`,
            options: [
              { text: 'only $f_1$', correct: below === 1, why: `$f_2 = 6.27 f_1$ ${below === 1 ? 'is above' : 'is below'} ${k} $f_1$.` },
              { text: '$f_1$ and $f_2$', correct: below === 2, why: `$f_2 = 6.27f_1$ and $f_3 = 17.55f_1$ against ${k} $f_1$.` },
              { text: '$f_1$, $f_2$ and $f_3$', correct: below === 3, why: `$f_3 = 17.55 f_1$ ${below === 3 ? 'is below' : 'is above'} ${k} $f_1$.` },
              { text: 'none of them', correct: false, why: `${k} > 1, so the excitation is above $f_1$.` },
            ],
          }
        );
      }
      return {
        prompt: `A tidal-turbine blade spar is a composite thin tube (mean diameter $d$ = ${dmm} mm, $E$ = ${E / 1e9} GPa, $\\rho$ = ${rho} kg/m³) modelled as a cantilever fixed at the turbine axis. A test finds its first transverse bending critical speed at ${N1} rpm.${tier === 3 ? ` A fluid excitation acts at ${k} times this critical speed.` : ''}`,
        givens: [
          { sym: 'd', value: `${dmm} mm` },
          { sym: 'E', value: `${E / 1e9} GPa` },
          { sym: '\\rho', value: `${rho} kg/m³` },
          { sym: 'N_1', value: `${N1} rpm` },
        ],
        parts,
        hints: [
          'A measured frequency and the section fix the length: invert $\\omega_1 = (\\beta_1 L)^2 (r/L^2)\\sqrt{E/2\\rho}$ (thin tube, $t$ cancels). Higher speeds follow from the ratio trick.',
          `$\\omega_1 = 2\\pi N_1/60$; $L = \\sqrt{\\dfrac{(1.875)^2\\,r\\sqrt{E/2\\rho}}{\\omega_1}}$${tier >= 2 ? '; $N_i = N_1(\\beta_i L/\\beta_1 L)^2$' : ''}.`,
          `$\\omega_1 = 2\\pi(${N1})/60 = ${t4(w1)}$ rad/s; $r = ${r}$ m; $\\sqrt{E/2\\rho} = ${t4(c2)}$ m/s; $(1.875)^2 = 3.516$.`,
          `$L^2 = 3.516 \\times ${r} \\times ${t4(c2)}/${t4(w1)} = ${t4(L * L)}$ m², so $L$ = **${f4(L)} m**.${tier >= 2 ? ` $N_2 = 6.267 \\times ${N1} = $ **${f4(N2)} rpm** (${f4(N2 / 60)} Hz), $N_3 = 17.55 \\times ${N1} = $ **${f4(N3)} rpm** (${f4(N3 / 60)} Hz).` : ''}${tier === 3 ? ` $\\Omega/\\omega_2 = ${k}/6.267 = $ **${f4(k / ratioTrick(CF, 2))}**.` : ''}`,
        ],
      };
    },
  },

  // ------------------------------------------------------------------ ratio trick (official 2018/2019 B2.1; Week 8 Q2)
  {
    id: 'b3-ratio-trick',
    title: 'The ratio trick: one measured frequency gives the rest',
    summary: '$f_i = f_1(\\beta_i L/\\beta_1 L)^2$: no $EI$ needed. Stretch: a test with different supports or vibrating length.',
    tiers: [1, 2, 3],
    source: 'Similar to official 2018 B2.1 (wing), 2019 B2.1 (fuselage); Week 8 Q2 (racquet)',
    cardId: 'b3-ratio',
    marks: 3,
    generate(rng, tier) {
      if (tier <= 2) {
        const scen = rng.pick([
          { bc: 'clamped-free' as BeamBC, text: 'An aircraft wing, fixed at the fuselage,' },
          { bc: 'free-free' as BeamBC, text: 'A fuselage in flight (no supports)' },
          { bc: 'pinned-pinned' as BeamBC, text: 'A floor beam resting on two simple supports' },
          { bc: 'clamped-clamped' as BeamBC, text: 'A steel beam clamped between two massive posts' },
          { bc: 'clamped-pinned' as BeamBC, text: 'A beam built into a wall at one end and pinned at the other' },
        ]);
        const bc = scen.bc;
        const f1 = rng.pick([5, 8, 12, 15, 20, 25, 30, 40, 50, 60, 80, 100]);
        const r = betaL(bc, 3);
        const q2 = ratioTrick(bc, 2);
        const q3 = ratioTrick(bc, 3);
        const other: BeamBC = bc === 'clamped-free' ? 'clamped-clamped' : 'clamped-free';
        const parts: SolvePart[] = [];
        const NEED: Record<string, string> = {
          'clamped-free': 'one built-in end and one free end',
          'pinned-pinned': 'a pin (or simple support) at each end',
          'clamped-clamped': 'both ends built in',
          'free-free': 'no supports at all',
          'clamped-pinned': 'one built-in end and one pinned end',
        };
        if (tier === 2) {
          const rowsOffered: BeamBC[] = bc === 'clamped-pinned' ? ['clamped-pinned', 'clamped-free', 'pinned-pinned', 'clamped-clamped'] : ['clamped-free', 'pinned-pinned', 'clamped-clamped', 'free-free'];
          parts.push({
            kind: 'choice',
            id: 'row',
            label: 'Which boundary conditions apply?',
            options: rowsOffered.map((b) => ({
              text: `${BC_NAME[b]} ($\\beta_1 L = ${b === 'pinned-pinned' ? '\\pi' : beta1L(b).toFixed(3)}$)`,
              correct: b === bc,
              why: b === bc ? `Matches the supports: ${NEED[b]}.` : `That model needs ${NEED[b]}.`,
            })),
          });
        }
        parts.push({
          kind: 'numeric',
          id: 'f2',
          label: 'Second natural frequency $f_2$',
          answer: f1 * q2,
          unit: 'Hz',
          freq: true,
          traps: traps(f1 * q2, [
            { value: (f1 * r[1]) / r[0], message: 'Square the root ratio: $f_2/f_1 = (\\beta_2 L/\\beta_1 L)^2$.', trapId: 'b3-ratio-not-squared' },
            { value: 2 * f1, message: 'Beams are not strings: the frequencies are not harmonics.' },
            { value: f1 * ratioTrick(other, 2), message: `That uses the ${BC_NAME[other]} spacing. Check the supports.`, trapId: 'b3-wrong-bc-row' },
          ]),
        });
        if (tier === 2)
          parts.push({
            kind: 'numeric',
            id: 'f3',
            label: 'Third natural frequency $f_3$',
            answer: f1 * q3,
            unit: 'Hz',
            freq: true,
            traps: traps(f1 * q3, [
              { value: (f1 * r[2]) / r[0], message: 'Square the root ratio: $f_3/f_1 = (\\beta_3 L/\\beta_1 L)^2$.', trapId: 'b3-ratio-not-squared' },
              { value: 3 * f1, message: 'Not harmonics: that is a string’s third mode.' },
              { value: f1 * ratioTrick(other, 3), message: `That uses the ${BC_NAME[other]} spacing.`, trapId: 'b3-wrong-bc-row' },
            ]),
          });
        const rows = bc === 'pinned-pinned' ? '$\\beta_i L = i\\pi$' : `$\\beta_1 L$ = ${r[0].toFixed(3)}, $\\beta_2 L$ = ${r[1].toFixed(3)}, $\\beta_3 L$ = ${r[2].toFixed(3)}`;
        return {
          prompt: tier === 1 ? `A ${BC_NAME[bc]} beam has its first natural frequency measured at $f_1$ = ${f1} Hz.` : `${scen.text} has its first natural frequency measured at $f_1$ = ${f1} Hz. Find the next two without knowing $E$, $I$ or $\\rho A$.`,
          givens: [{ sym: 'f_1', value: `${f1} Hz`, label: 'measured' }],
          parts,
          hints: [
            'Every mode carries the same factor $\\sqrt{EI/(\\rho A L^4)}$, so frequency ratios depend only on the βL roots of the boundary conditions.',
            `$f_i = f_1\\left(\\dfrac{\\beta_i L}{\\beta_1 L}\\right)^2$. ${BC_NAME[bc]}: ${rows}.`,
            `$(\\beta_2 L/\\beta_1 L)^2 = ${t4(q2)}$${tier === 2 ? `, $(\\beta_3 L/\\beta_1 L)^2 = ${t4(q3)}$` : ''}.`,
            `$f_2 = ${t4(q2)} \\times ${f1} = $ **${f4(f1 * q2)} Hz**${tier === 2 ? `; $f_3 = ${t4(q3)} \\times ${f1} = $ **${f4(f1 * q3)} Hz**` : ''}.`,
          ],
        };
      }
      // tier 3: different supports and/or vibrating length between the test and the use
      if (rng.chance(0.5)) {
        const lam = rng.step(0.75, 0.95, 0.05);
        const f1t = rng.step(30, 80, 2);
        const i = rng.pick([1, 2, 3]);
        const bFF = betaL('free-free', i)[i - 1];
        const b1c = beta1L(CF);
        const ans = f1t * (bFF / b1c) ** 2 * lam * lam;
        return {
          prompt: `To test a racquet frame, its handle is clamped so that only ${f3(lam)} of its length $L$ vibrates (a cantilever). The first natural frequency of this set-up is ${f1t} Hz. In play the whole racquet is close to free–free. Predict its ${ORD[i]} free–free (elastic) natural frequency.`,
          givens: [
            { sym: 'f_{1,test}', value: `${f1t} Hz`, label: 'clamped test' },
            { sym: 'L_c/L', value: `${f3(lam)}`, label: 'vibrating length in the test' },
          ],
          parts: [
            {
              kind: 'numeric',
              id: 'f',
              label: `Free–free $f_${i}$ of the whole racquet`,
              answer: ans,
              unit: 'Hz',
              freq: true,
              traps: traps(ans, [
                { value: ans / (lam * lam), message: 'βL refers to the vibrating length: multiply by $(L_c/L)^2$.', trapId: 'b3-vibrating-length' },
                { value: ans / lam, message: 'The length enters squared: $\\omega \\propto 1/L^2$.', trapId: 'b3-vibrating-length' },
                { value: ans / (lam * lam * lam * lam), message: 'The length factor is upside down: the test is shorter, so it is stiffer.', trapId: 'b3-vibrating-length' },
                i === 1
                  ? { value: f1t, message: 'That is the clamped test’s own frequency. The free racquet is a different beam: different supports (β₁L 1.875 → 4.730) and a longer vibrating length.', trapId: 'b3-wrong-bc-row' }
                  : { value: f1t * ratioTrick('free-free', i), message: 'You applied the free–free ratio to the cantilever’s frequency. Different supports: use the roots of both rows.', trapId: 'b3-wrong-bc-row' },
              ]),
            },
          ],
          hints: [
            'Both set-ups share $\\sqrt{EI/\\rho A}$; they differ in their βL roots and in the length that vibrates. $\\omega = (\\beta L)^2\\sqrt{EI/\\rho A}/L^2$.',
            `$f_{${i},FF} = f_{1,test}\\left(\\dfrac{\\beta_${i} L_{FF}}{\\beta_1 L_{CF}}\\right)^2\\left(\\dfrac{L_c}{L}\\right)^2$.`,
            `$\\beta_${i}L_{FF}$ = ${bFF.toFixed(4)}, $\\beta_1 L_{CF}$ = ${b1c.toFixed(4)}: ratio² = ${f4((bFF / b1c) ** 2)}; $(L_c/L)^2$ = ${f4(lam * lam)}.`,
            `$f = ${f1t} \\times ${f4((bFF / b1c) ** 2)} \\times ${f4(lam * lam)} = $ **${f4(ans)} Hz**. (Forgetting the length factor gives ${f4(ans / (lam * lam))} Hz, the classic slip.)`,
          ],
        };
      }
      const L1 = rng.step(2, 6, 0.5);
      const mu = rng.pick([1.1, 1.2, 1.25, 1.5]);
      const f1 = rng.step(10, 60, 1);
      const fac = (beta1L('clamped-clamped') / Math.PI) ** 2;
      const ans = (f1 * fac) / (mu * mu);
      return {
        prompt: `A uniform beam simply supported over a span of ${L1} m has a measured first natural frequency of ${f1} Hz. The same beam is re-installed with both ends **clamped** over a span of ${f4(L1 * mu)} m. Predict its new first natural frequency.`,
        givens: [
          { sym: 'f_{1,PP}', value: `${f1} Hz` },
          { sym: 'L_1', value: `${L1} m` },
          { sym: 'L_2', value: `${f4(L1 * mu)} m` },
        ],
        parts: [
          {
            kind: 'numeric',
            id: 'f',
            label: 'New first natural frequency',
            answer: ans,
            unit: 'Hz',
            freq: true,
            traps: traps(ans, [
              { value: f1 * fac, message: 'The span changed too: multiply by $(L_1/L_2)^2$.', trapId: 'b3-vibrating-length' },
              { value: (f1 * fac) / mu, message: 'The span enters squared ($\\omega \\propto 1/L^2$).', trapId: 'b3-vibrating-length' },
              { value: (f1 * (beta1L('clamped-clamped') / Math.PI)) / (mu * mu), message: 'Square the βL ratio: $(4.730/\\pi)^2 = 2.27$.', trapId: 'b3-ratio-not-squared' },
            ]),
          },
        ],
        hints: [
          'Same beam, so $\\sqrt{EI/\\rho A}$ is common; the supports change $\\beta_1 L$ and the span changes $L$.',
          '$\\dfrac{f_{1,CC}}{f_{1,PP}} = \\left(\\dfrac{4.730}{\\pi}\\right)^2\\left(\\dfrac{L_1}{L_2}\\right)^2$.',
          `$(4.730/\\pi)^2 = ${f4(fac)}$; $(L_1/L_2)^2 = (1/${mu})^2 = ${f4(1 / (mu * mu))}$.`,
          `$f_1' = ${f1} \\times ${f4(fac)} \\times ${f4(1 / (mu * mu))} = $ **${f4(ans)} Hz**: clamping raises it 2.27×, the longer span lowers it.`,
        ],
      };
    },
  },

  // ------------------------------------------------------------------ nodes (Week 8 Q1; racquet, fuselage, arrow; nodes and masses)
  {
    id: 'b3-nodes',
    title: 'Node positions: sweet spots, pin tests, masses and forces',
    summary: 'Where a mode does not move, a support carries no load, a force does no work and a mass adds no energy. Find the nodes and use them.',
    tiers: [1, 2, 3],
    source: 'Similar to Week 8 Q1; official 2018 B1.7, 2019 B1.8 and B2.5; 2023 B1.3; 2024 A3.5',
    cardId: 'b3-nodes',
    marks: 3,
    generate(rng, tier) {
      if (tier === 1) {
        const c = rng.pick([
          { bc: 'clamped-free' as BeamBC, i: 2, k: 0, from: 'the clamp' },
          { bc: 'clamped-free' as BeamBC, i: 3, k: 0, from: 'the clamp' },
          { bc: 'clamped-free' as BeamBC, i: 3, k: 1, from: 'the clamp' },
          { bc: 'clamped-free' as BeamBC, i: 4, k: 2, from: 'the clamp' },
          { bc: 'free-free' as BeamBC, i: 1, k: 0, from: 'the nearer end' },
          { bc: 'free-free' as BeamBC, i: 2, k: 0, from: 'the nearer end' },
          { bc: 'clamped-clamped' as BeamBC, i: 3, k: 0, from: 'the nearer end' },
          { bc: 'clamped-pinned' as BeamBC, i: 2, k: 0, from: 'the clamp' },
          { bc: 'pinned-pinned' as BeamBC, i: 3, k: 0, from: 'the nearer end' },
        ]);
        const ns = nodes(c.bc, c.i);
        const x = ns[c.k];
        const which = ns.length === 1 ? 'its interior node' : `its ${['first', 'second', 'third'][c.k]} interior node counted from ${c.from}`;
        return {
          prompt: `Mode ${c.i} of a ${BC_NAME[c.bc]} beam has ${ns.length} interior node${ns.length > 1 ? 's' : ''}. Give the position of ${which}, as $x/L$ measured from ${c.from} (3 decimal places).`,
          parts: [
            {
              kind: 'numeric',
              id: 'x',
              label: 'Node position $x/L$',
              answer: x,
              unit: '',
              tol: 0.004,
              absTol: 0.0015,
              traps: traps(x, [
                { value: 1 - x, message: 'Measured from the wrong end.' },
                ns.some((v) => Math.abs(v - 0.5) < 1e-6)
                  ? { value: 0.5, message: 'Mid-span is this mode’s middle node; the question asks for the one counted from the end.' }
                  : { value: 0.5, message: 'Mid-span is a node only of the antisymmetric modes of a symmetric beam.' },
                { value: (c.k + 1) / c.i, message: 'That is where a string’s (or a pinned–pinned beam’s) node would be. Clamped and free ends shift the nodes.' },
              ]),
            },
            sketchPart(c.bc),
          ],
          hints: [
            `A node is an interior zero of $Y_${c.i}(x)$. The count is ${c.bc === 'free-free' ? '$n + 1$ for free–free' : '$n - 1$ here'}, and clamped or free ends push the nodes away from the evenly spaced string positions. Each end type also fixes how the curve meets the support: clamped $y = y' = 0$, pinned $y = y'' = 0$, free $y'' = y''' = 0$.`,
            c.bc === 'pinned-pinned' ? '$Y_i = \\sqrt2\\sin(i\\pi x/L)$: zeros at $x/L = k/i$.' : `Solve $Y_${c.i}(x) = 0$ with the handout form (${c.bc === 'free-free' ? '$\\cosh\\beta x + \\cos\\beta x - C_1(\\sinh\\beta x + \\sin\\beta x)$' : '$\\cosh\\beta x - \\cos\\beta x - C_1(\\sinh\\beta x - \\sin\\beta x)$'}) by trial, or recall the table.`,
            `$\\beta_${c.i}L$ = ${betaL(c.bc, c.i)[c.i - 1].toFixed(4)}; all interior nodes: $x/L$ = ${ns.map((v) => v.toFixed(4)).join(', ')}.`,
            `The requested node is at **$x/L$ = ${x.toFixed(3)}** (exact ${x.toFixed(5)}). Sketch: ${[beamBCInfo(c.bc).left, beamBCInfo(c.bc).right]
              .map((e, k) => `${k ? 'right' : 'left'} end ${e === 'clamped' ? '**flat** (zero deflection and slope)' : e === 'pinned' ? '**through zero at an angle** (zero deflection and curvature)' : '**straight, with the largest deflection**'}`)
              .join('; ')}.`,
          ],
        };
      }
      if (tier === 2) {
        const c = rng.pick([
          { what: 'racquet', L: rng.step(650, 710, 5), unit: 'mm', ask: 'How far from the tip of the head is the sweet spot (the head-side node of the fundamental)?', xi: 0, why: 'An impact at a node of mode 1 excites no mode-1 vibration, so little is felt at the hand.' },
          { what: 'fuselage', L: rng.step(50, 75, 1), unit: 'm', ask: 'Passengers feel least of the fundamental bending mode at its nodes. How far from the nose is the rear one?', xi: 1, why: 'Official 2019 B2.5: seats at the mode-1 nodes, 22.4 % from each end.' },
          { what: 'arrow', L: rng.step(700, 800, 10), unit: 'mm', ask: 'How far from the rear (nock) end should the fletching be centred to sit at the nearer node of the fundamental?', xi: 0, why: 'At a node the shaft moves least (2022 B1.5).' },
        ]);
        const ns = nodes('free-free', 1);
        const pos = (c.xi === 0 ? ns[0] : ns[1]) * c.L;
        const desc = c.what === 'racquet' ? `A tennis racquet frame of length ${c.L} mm behaves as a free–free beam in play.` : c.what === 'fuselage' ? `A ${c.L} m fuselage in flight is modelled as a uniform free–free beam.` : `An arrow of length ${c.L} mm flies as a uniform free–free beam (ignore the tip and fletching masses).`;
        return {
          prompt: `${desc} ${c.ask}`,
          givens: [{ sym: 'L', value: `${c.L} ${c.unit}` }],
          parts: [
            {
              kind: 'numeric',
              id: 'pos',
              label: 'Distance',
              answer: pos,
              unit: c.unit,
              tol: 0.006,
              traps: traps(pos, [
                { value: c.L / 2, message: 'Mid-length is an antinode of the free–free fundamental (it moves a lot).' },
                { value: (c.xi === 0 ? 1 - ns[0] : ns[0]) * c.L, message: 'Right node, measured from the other end.' },
                { value: 0.7834 * c.L, message: '0.783L is the cantilever’s mode-2 node, not a free–free one.', trapId: 'b3-wrong-bc-row' },
              ]),
            },
            {
              kind: 'choice',
              id: 'pins',
              label: 'In a test, the beam is instead supported on pins at both of these nodes. Its first natural frequency…',
              options: [
                { text: 'equals the free–free value: the beam does not move there in mode 1, so the pins carry no load in that mode', correct: true, why: 'Official 2018 B1.7(c), 2019 B1.8(c): the pinned test represents the free condition.' },
                { text: 'rises, because pins add stiffness', correct: false, why: 'A support at a node does no work in that mode.' },
                { text: 'falls, because the pins add mass', correct: false, why: 'Ideal pins add no mass, and they sit where the mode does not move.' },
                { text: 'drops to the pinned–pinned value $\\pi^2\\sqrt{EI/\\rho A L^4}$', correct: false, why: 'The pins are not at the ends.' },
              ],
            },
          ],
          hints: [
            `${c.why} The first elastic mode of a free–free beam has two nodes.`,
            'Free–free mode 1: nodes at $x/L$ = 0.224 and 0.776 (Y₁ = 0 with β₁L = 4.730, $C_1$ = 0.9825).',
            `Nodes: ${f4(ns[0] * c.L)} ${c.unit} and ${f4(ns[1] * c.L)} ${c.unit} from the reference end.`,
            `The answer is **${f4(pos)} ${c.unit}** (${(c.xi === 0 ? ns[0] : ns[1]).toFixed(3)}L). Pins exactly there leave the fundamental unchanged.`,
          ],
        };
      }
      const c = rng.pick([
        { bc: 'pinned-pinned' as BeamBC, x: 0.5, none: [2, 4], label: 'mid-span' },
        { bc: 'pinned-pinned' as BeamBC, x: 1 / 3, none: [3], label: 'one third of the span' },
        { bc: 'pinned-pinned' as BeamBC, x: 0.25, none: [4], label: 'a quarter of the span' },
        { bc: 'clamped-clamped' as BeamBC, x: 0.5, none: [2, 4], label: 'mid-span' },
        { bc: 'free-free' as BeamBC, x: 0.5, none: [2, 4], label: 'mid-length' },
        { bc: 'clamped-free' as BeamBC, x: nodes('clamped-free', 2)[0], none: [2], label: '0.783L from the clamp' },
        { bc: 'free-free' as BeamBC, x: nodes('free-free', 1)[0], none: [1], label: '0.224L from one end' },
        { bc: 'clamped-free' as BeamBC, x: 1, none: [] as number[], label: 'the free tip' },
      ]);
      // Mode values at the point, with the round-off at an exact node shown as 0.
      const Yat = (i: number) => {
        const y = modeShape(c.bc, i, c.x);
        return Math.abs(y) < 1e-6 ? 0 : y;
      };
      const Y1 = Yat(1);
      const thing = rng.pick(['a harmonic force', 'a lumped mass']);
      const modesTxt = `Mode${c.none.length > 1 ? 's' : ''} ${c.none.join(' and ')}`;
      const opts = [1, 2, 3, 4].map((i) => {
        const at = c.none.includes(i);
        return {
          text: `mode ${i}`,
          correct: at,
          why: at ? `$Y_${i}$ = 0 there (a node of mode ${i}).` : `$Y_${i}$ = ${f3(Yat(i))} there, not zero.`,
        };
      });
      opts.push({ text: 'none of modes 1–4', correct: c.none.length === 0, why: c.none.length === 0 ? 'A free end is never a node: every mode moves there (|Y| = 2).' : `${modesTxt} ${c.none.length > 1 ? 'have' : 'has'} a node there.` });
      return {
        prompt: `${thing === 'a harmonic force' ? 'A harmonic force' : 'A lumped mass'} is applied to a ${BC_NAME[c.bc]} beam at ${c.label} ($x/L$ = ${c.x.toFixed(4)}).`,
        parts: [
          {
            kind: 'choice',
            id: 'unaffected',
            label: thing === 'a harmonic force' ? 'Which of modes 1–4 are **not excited** at all? (Select all that apply.)' : 'Which of modes 1–4 keep **exactly** their natural frequency? (Select all that apply.)',
            multi: true,
            options: opts,
          },
          {
            kind: 'numeric',
            id: 'Y1',
            label: 'Normalised mode-1 value $Y_1(x)$ at that point (handout normalisation, $\\int Y^2 dx = L$)',
            answer: Y1,
            unit: '',
            tol: 0.02,
            absTol: 0.003,
            traps: traps(
              Y1,
              [
                { value: -Y1, message: 'Sign slip: with the handout form, mode 1 is ' + (c.bc === 'free-free' ? 'positive near the ends and negative in the middle.' : 'positive along the whole span.'), trapId: 'sign' },
                { value: Y1 / Math.SQRT2, message: 'That is $Y_1/\\sqrt2$. The handout normalisation $\\int Y^2 dx = L$ makes the shapes larger than a unit-amplitude sketch: $\\sqrt2$ for pinned–pinned, 2 at any free end.' },
              ],
              0.03,
              0.02
            ),
          },
        ],
        hints: [
          `A ${thing === 'a harmonic force' ? 'force' : 'mass'} at a node of mode $i$ ${thing === 'a harmonic force' ? 'does no work on that mode (its modal force ∝ $Y_i(x_e)$ = 0)' : 'adds no kinetic energy to that mode (Rayleigh: $M\\,\\phi(x_k)^2$ = 0)'}, so that mode is untouched.`,
          `Check $Y_i(${c.x.toFixed(3)}L)$ for $i$ = 1–4 using the ${BC_NAME[c.bc]} shapes (symmetric beams: even modes have a node at mid-span).`,
          `$Y_1$ = ${f4(Yat(1))}, $Y_2$ = ${f4(Yat(2))}, $Y_3$ = ${f4(Yat(3))}, $Y_4$ = ${f4(Yat(4))}.`,
          `${c.none.length ? `**${modesTxt}** ${thing === 'a harmonic force' ? (c.none.length > 1 ? 'receive' : 'receives') + ' no excitation' : (c.none.length > 1 ? 'keep their' : 'keeps its') + ' natural frequency exactly'}` : `**Every mode is affected**: a free end is never a node, so ${thing === 'a harmonic force' ? 'the force excites modes 1–4' : 'the mass lowers every frequency'}`}; $Y_1$ = **${f4(Y1)}** there.`,
        ],
      };
    },
  },

  // ------------------------------------------------------------------ section and parameter scaling
  {
    id: 'b3-scaling',
    title: 'What does each change do to f₁?',
    summary: 'Thin tube $\\omega \\propto d/L^2$ (t cancels); rectangle $\\omega \\propto$ depth$/L^2$; material $\\propto\\sqrt{E/\\rho}$; supports change $(\\beta_1 L)^2$.',
    tiers: [1, 2, 3],
    source: 'Similar to 2024 B1.5, 2025 B1.5, 2023 B1.5; official 2019 B1.6; summary notes B3',
    cardId: 'b3-sections',
    marks: 2.5,
    generate(rng, tier) {
      if (tier === 1) {
        const f1 = rng.step(5, 60, 1);
        const ch = rng.pick(['L', 'd', 't', 'mat'] as const);
        let ans = f1;
        let text = '';
        let tr: { value: number; message: string; trapId?: string }[] = [];
        let why = '';
        if (ch === 'L') {
          const s = rng.pick([0.5, 0.8, 1.25, 1.5, 2]);
          ans = f1 / (s * s);
          text = `its length is multiplied by ${s}`;
          tr = [
            { value: f1 / s, message: 'Beams go as $1/L^2$, not $1/L$ (that is strings and rods).' },
            { value: f1 / s ** 3, message: '$L^3$ is the static-deflection scaling; frequency goes as $1/L^2$.' },
            { value: f1 * s * s, message: 'Longer is lower: $\\omega \\propto 1/L^2$.', trapId: 'sign' },
          ];
          why = `$\\omega \\propto 1/L^2$: $f_1' = ${f1}/${s}^2$`;
        } else if (ch === 'd') {
          const s = rng.pick([0.5, 1.5, 2, 3]);
          ans = f1 * s;
          text = `its mean diameter is multiplied by ${s} (same wall thickness)`;
          tr = [
            { value: f1 * s * s, message: '$I/A = r^2/2$, so $\\sqrt{I/A} \\propto r$: linear in $d$.' },
            { value: f1 * s ** 1.5, message: '$I \\propto r^3$ but $A \\propto r$ too: the ratio goes as $r^2$, its root as $r$.' },
            { value: f1, message: 'Diameter does matter in bending (it is torsion where $d$ cancels).', trapId: 'rod-diameter' },
          ];
          why = `$\\omega \\propto d$: $f_1' = ${f1} \\times ${s}$`;
        } else if (ch === 't') {
          const s = rng.pick([0.5, 1.5, 2, 3]);
          ans = f1;
          text = `its wall thickness is multiplied by ${s} (same mean diameter)`;
          tr = [
            { value: f1 * s, message: 'Thickness cancels in bending: $I$ and $A$ are both proportional to $t$.', trapId: 'rod-diameter' },
            { value: f1 * Math.sqrt(s), message: 'Stiffness and mass per length both scale with $t$: no change.', trapId: 'rod-diameter' },
            { value: f1 / s, message: 'More wall adds mass and stiffness equally: no change.', trapId: 'rod-diameter' },
          ];
          why = '$I/A = r^2/2$ does not contain $t$, so $f_1$ is unchanged';
        } else {
          const m = rng.pick([
            { name: 'carbon-fibre composite', E: 280, rho: 1600 },
            { name: 'glass-fibre composite', E: 40, rho: 1900 },
            { name: 'titanium', E: 110, rho: 4500 },
          ]);
          const fac = Math.sqrt(m.E / m.rho / (210 / 7850));
          ans = f1 * fac;
          text = `it is remade in ${m.name} ($E$ = ${m.E} GPa, $\\rho$ = ${m.rho} kg/m³) instead of steel ($E$ = 210 GPa, $\\rho$ = 7850 kg/m³), with the same geometry`;
          tr = [
            { value: f1 * Math.sqrt(m.E / 210), message: 'Density changes too: the factor is $\\sqrt{(E/\\rho)_{new}/(E/\\rho)_{steel}}$.' },
            { value: (f1 * m.E) / 210, message: 'Frequency goes as $\\sqrt{E/\\rho}$: take the square root, and include ρ.', trapId: 'sqrt' },
            { value: (f1 * (m.E / m.rho)) / (210 / 7850), message: 'Take the square root of the $E/\\rho$ ratio.', trapId: 'sqrt' },
          ];
          why = `$\\omega \\propto \\sqrt{E/\\rho}$, so $f_1' = ${f1}\\sqrt{(${m.E}/${m.rho})/(210/7850)} = ${f1} \\times ${f4(fac)}$`;
        }
        return {
          prompt: `A cantilevered thin-walled steel tube has $f_1$ = ${f1} Hz. Find the new $f_1$ if ${text}.`,
          givens: [{ sym: 'f_1', value: `${f1} Hz` }],
          parts: [{ kind: 'numeric', id: 'f', label: "New first natural frequency $f_1'$", answer: ans, unit: 'Hz', freq: true, traps: traps(ans, tr) }],
          hints: [
            'Write $\\omega_1 = (\\beta_1 L)^2 \\dfrac{r_g}{L^2}\\sqrt{\\dfrac{E}{\\rho}}$ with $r_g = \\sqrt{I/A}$ and see which factor changes.',
            'Thin tube: $r_g = r/\\sqrt2$ (no $t$). So $f_1 \\propto d\\,\\sqrt{E/\\rho}/L^2$.',
            `${why}.`,
            `$f_1'$ = **${f4(ans)} Hz**.`,
          ],
        };
      }
      if (tier === 2) {
        const f1 = rng.step(20, 120, 5);
        const sw = rng.pick([0.8, 1.2, 1.25, 1.5]);
        const st = rng.pick([0.5, 1.5, 2]);
        const sL = rng.pick([0.8, 0.9, 1.1, 1.2]);
        const fNew = (f1 * sw) / (sL * sL);
        const dRatio = sL ** 3 / (sw ** 3 * st);
        return {
          prompt: `A cantilevered wing of thin rectangular section ($w \\gg t$) bends **in its own plane** (across $w$) with $f_1$ = ${f1} Hz. The design changes: $w$ × ${sw}, $t$ × ${st}, $L$ × ${sL}.`,
          givens: [
            { sym: 'f_1', value: `${f1} Hz` },
            { sym: 'w', value: `× ${sw}` },
            { sym: 't', value: `× ${st}` },
            { sym: 'L', value: `× ${sL}` },
          ],
          parts: [
            {
              kind: 'numeric',
              id: 'f',
              label: "New in-plane $f_1'$",
              answer: fNew,
              unit: 'Hz',
              freq: true,
              traps: traps(fNew, [
                { value: fNew * st, message: '$t$ cancels for in-plane bending ($I/A = w^2/12$).', trapId: 'b3-wrong-plane' },
                { value: (f1 * sw) / sL, message: 'The length enters as $1/L^2$.' },
                { value: (f1 * sw ** 1.5 * Math.sqrt(st)) / (sL * sL), message: 'Use $\\sqrt{I/A}$, not $\\sqrt{I}$ alone: the mass changes too.' },
              ]),
            },
            {
              kind: 'numeric',
              id: 'delta',
              label: 'Ratio of new to old static tip deflection under the same tip load, $\\delta\'/\\delta$',
              answer: dRatio,
              unit: '',
              traps: traps(dRatio, [
                { value: sL ** 3 / sw ** 3, message: 'Deflection uses $EI$ itself: $I = tw^3/12$ includes $t$.' },
                { value: sL * sL / sw, message: 'That is the frequency scaling inverted. Static deflection is $PL^3/3EI$.' },
              ]),
            },
          ],
          hints: [
            'Frequencies depend on $I/A$; deflections on $EI$. In-plane, $I = tw^3/12$ and $I/A = w^2/12$.',
            "$f_1' /f_1 = (w'/w)(L/L')^2$; $\\delta'/\\delta = (L'/L)^3 \\,/\\, [(t'/t)(w'/w)^3]$.",
            `$f_1'/f_1 = ${sw}/${sL}^2 = ${f4(sw / (sL * sL))}$; $\\delta'/\\delta = ${sL}^3/(${st} \\times ${sw}^3) = ${f4(dRatio)}$.`,
            `$f_1'$ = **${f4(fNew)} Hz** (thickness irrelevant) and $\\delta'/\\delta$ = **${f4(dRatio)}** (thickness matters).`,
          ],
        };
      }
      const c = rng.pick([
        { from: 'clamped-free' as BeamBC, to: 'clamped-clamped' as BeamBC, story: 'A clamped drill rod’s free end becomes embedded in rock' },
        { from: 'pinned-pinned' as BeamBC, to: 'clamped-clamped' as BeamBC, story: 'The pins of a simply supported beam are replaced by clamps' },
        { from: 'clamped-free' as BeamBC, to: 'clamped-pinned' as BeamBC, story: 'The free tip of a cantilever is propped on a pin' },
        { from: 'clamped-clamped' as BeamBC, to: 'pinned-pinned' as BeamBC, story: 'The clamps of a fixed–fixed beam work loose and act as pins' },
      ]);
      const f1 = rng.step(10, 80, 2);
      const s = rng.pick([0.8, 1, 1.2, 1.5]);
      const fac = (beta1L(c.to) / beta1L(c.from)) ** 2;
      const f1n = (f1 * fac) / (s * s);
      const f2n = f1n * ratioTrick(c.to, 2);
      return {
        prompt: `${c.story}${s === 1 ? '' : `, and the span changes to ${s} times its old length`}. Before the change $f_1$ = ${f1} Hz.`,
        givens: [
          { sym: 'f_1', value: `${f1} Hz` },
          { sym: '\\text{BCs}', value: `${BC_NAME[c.from]} → ${BC_NAME[c.to]}` },
          { sym: "L'/L", value: `${s}` },
        ],
        parts: [
          {
            kind: 'numeric',
            id: 'f1',
            label: "New $f_1'$",
            answer: f1n,
            unit: 'Hz',
            freq: true,
            traps: traps(f1n, [
              { value: (f1 * Math.sqrt(fac)) / (s * s), message: 'Square the βL ratio.', trapId: 'b3-ratio-not-squared' },
              { value: f1 * fac, message: 'The span changed too: divide by $(L\'/L)^2$.', trapId: 'b3-vibrating-length' },
              { value: f1 / fac / (s * s), message: 'Upside down: check which βL is new.', trapId: 'b3-wrong-bc-row' },
            ]),
          },
          { kind: 'numeric', id: 'f2', label: "New $f_2'$", answer: f2n, unit: 'Hz', freq: true, traps: traps(f2n, [{ value: f1n * ratioTrick(c.from, 2), message: 'Use the new supports’ spacing for $f_2/f_1$.', trapId: 'b3-wrong-bc-row' }]) },
        ],
        hints: [
          'Same beam: $\\sqrt{EI/\\rho A}$ is common. Only $\\beta_1 L$ (supports) and $L$ (span) change, as $(\\beta_1 L)^2/L^2$.',
          "$f_1' = f_1\\left(\\dfrac{\\beta_1 L_{new}}{\\beta_1 L_{old}}\\right)^2\\left(\\dfrac{L}{L'}\\right)^2$; then $f_2' = f_1'(\\beta_2 L/\\beta_1 L)^2_{new}$.",
          `$\\beta_1 L$: ${beta1L(c.from).toFixed(4)} → ${beta1L(c.to).toFixed(4)}, factor ${f4(fac)}; span factor $1/${s}^2 = ${f4(1 / (s * s))}$; new spacing $f_2/f_1$ = ${f4(ratioTrick(c.to, 2))}.`,
          `$f_1'$ = **${f4(f1n)} Hz**, $f_2'$ = **${f4(f2n)} Hz**.`,
        ],
      };
    },
  },

  // ------------------------------------------------------------------ BCs and the table row (W7.4a; rigid-body modes)
  {
    id: 'b3-bc-id',
    title: 'Pick the supports, then the frequencies',
    summary: 'Read the boundary conditions from the description, pick the handout row, and count rigid-body modes only when asked.',
    tiers: [1, 2, 3],
    source: 'Similar to reader W7.4(a); summary notes B3 cues and trap 10 (rigid-body modes)',
    cardId: 'b3-freq',
    marks: 3,
    generate(rng, tier) {
      const BCS4: BeamBC[] = ['clamped-free', 'pinned-pinned', 'clamped-clamped', 'free-free'];
      const scen = [
        { bc: 'clamped-free' as BeamBC, text: 'a sideways-vibrating crane boom fixed at its base' },
        { bc: 'clamped-free' as BeamBC, text: 'a turbine blade fixed at the hub' },
        { bc: 'pinned-pinned' as BeamBC, text: 'a shaft running in a bearing at each end' },
        { bc: 'pinned-pinned' as BeamBC, text: 'an overhead contact wire between two masts, treated as a beam' },
        { bc: 'clamped-clamped' as BeamBC, text: 'a beam clamped between two massive support posts' },
        { bc: 'free-free' as BeamBC, text: 'a javelin in flight' },
        { bc: 'free-free' as BeamBC, text: 'a racquet held lightly in play' },
      ];
      const choicePart = (bc: BeamBC): SolvePart => ({
        kind: 'choice',
        id: 'bc',
        label: 'Which boundary conditions model it?',
        options: BCS4.map((b) => ({
          text: BC_NAME[b],
          correct: b === bc,
          why: b === bc ? 'Matches the physical supports.' : b === 'free-free' ? 'Free–free needs no supports at all.' : b === 'clamped-free' ? 'A cantilever needs one built-in end and one free end.' : b === 'pinned-pinned' ? 'Pinned ends allow rotation but no deflection (bearings, simple supports).' : 'Clamped ends allow neither deflection nor rotation.',
        })),
      });
      if (tier === 1) {
        const s = rng.pick(scen);
        const q = ratioTrick(s.bc, 2);
        return {
          prompt: `Model ${s.text} as a uniform beam.`,
          parts: [
            choicePart(s.bc),
            {
              kind: 'numeric',
              id: 'r2',
              label: 'Then the ratio $\\omega_2/\\omega_1$',
              answer: q,
              unit: '',
              traps: traps(q, [
                { value: betaL(s.bc, 2)[1] / beta1L(s.bc), message: 'Square the βL ratio.', trapId: 'b3-ratio-not-squared' },
                { value: 2, message: 'Not harmonics: beams are not strings.' },
                ...BCS4.filter((b) => b !== s.bc).map((b) => ({ value: ratioTrick(b, 2), message: `That is the ${BC_NAME[b]} spacing.`, trapId: 'b3-wrong-bc-row' })),
              ]),
            },
          ],
          hints: [
            'Ask what each end can do: a built-in end cannot move or rotate (clamped), a bearing stops motion but allows rotation (pinned), an unsupported end is free.',
            'Cues: hub, root, base → clamped; bearings, simple supports → pinned; in flight or held lightly → free.',
            `${s.text[0].toUpperCase()}${s.text.slice(1)} → ${BC_NAME[s.bc]}: $\\beta_1 L$ = ${beta1L(s.bc).toFixed(3)}, $\\beta_2 L$ = ${betaL(s.bc, 2)[1].toFixed(3)}.`,
            `**${BC_NAME[s.bc]}**; $\\omega_2/\\omega_1 = (${betaL(s.bc, 2)[1].toFixed(3)}/${beta1L(s.bc).toFixed(3)})^2$ = **${f4(q)}**.`,
          ],
        };
      }
      if (tier === 2) {
        const I = rng.step(0.8, 3, 0.1) * 1e-5;
        const A = rng.step(1.5, 4, 0.1) * 1e-3;
        const L = rng.step(4, 14, 1);
        const E = 210e9;
        const rho = 7850;
        const root = Math.sqrt((E * I) / (rho * A * L ** 4));
        const w1 = Math.PI ** 2 * root;
        const f1 = w1 / TAU;
        return {
          prompt: `A steel floor beam ($E$ = 210 GPa, $\\rho$ = 7850 kg/m³, $I = ${t4(I)}$ m⁴, $A = ${t4(A)}$ m²) rests on simple supports ${L} m apart.`,
          givens: [
            { sym: 'E', value: '210 GPa' },
            { sym: '\\rho', value: '7850 kg/m³' },
            { sym: 'I', value: `${f3(I * 1e5)}×10⁻⁵ m⁴` },
            { sym: 'A', value: `${f3(A * 1e3)}×10⁻³ m²` },
            { sym: 'L', value: `${L} m` },
          ],
          parts: [
            choicePart('pinned-pinned'),
            {
              kind: 'numeric',
              id: 'f1',
              label: 'First natural frequency $f_1$',
              answer: f1,
              unit: 'Hz',
              freq: true,
              traps: traps(f1, [
                { value: f1 * Math.sqrt(A), message: 'Use the mass per unit length $\\rho A$ (kg/m), not the density $\\rho$.', trapId: 'b3-rho-vs-rhoA' },
                { value: f1 * L, message: 'The root contains $L^4$: $\\sqrt{EI/(\\rho A L^4)}$.' },
                { value: f1 * (beta1L(CF) / Math.PI) ** 2, message: 'Cantilever row used; simple supports are pinned–pinned ($\\beta_1 L = \\pi$).', trapId: 'b3-wrong-bc-row' },
              ]),
            },
          ],
          hints: [
            'Simple supports stop deflection but allow rotation: pinned–pinned, $\\beta_i L = i\\pi$.',
            '$\\omega_1 = \\pi^2\\sqrt{\\dfrac{EI}{\\rho A\\,L^4}}$, $f_1 = \\omega_1/2\\pi$; $\\rho A$ is the mass per metre.',
            `$\\rho A = ${t4(rho * A)}$ kg/m, $EI = ${t4(E * I)}$ N m², $\\sqrt{EI/(\\rho A L^4)} = ${t4(root)}$ 1/s.`,
            `$\\omega_1 = 9.870 \\times ${t4(root)} = ${t4(w1)}$ rad/s, so $f_1$ = **${f4(f1)} Hz**.`,
          ],
        };
      }
      const bc = rng.pick(['free-free', 'free-pinned'] as BeamBC[]);
      const f1 = rng.pick([12, 20, 30, 45]);
      const ratios = betaL(bc, 6).map((b, k, a) => (b / a[0]) ** 2);
      let lim = 0;
      for (let tries = 0; tries < 20; tries++) {
        const cand = f1 * rng.pick([2, 3, 4, 5, 6, 8, 10, 12, 15]);
        if (ratios.every((q) => Math.abs(f1 * q - cand) > 0.05 * cand)) {
          lim = cand;
          break;
        }
      }
      if (!lim) lim = f1 * 4.4;
      const elastic = ratios.filter((q) => f1 * q < lim);
      const count = elastic.length + RIGID[bc];
      const top = f1 * elastic[elastic.length - 1];
      return {
        prompt: `A ${BC_NAME[bc]} beam has its first **elastic** natural frequency at ${f1} Hz. How many natural frequencies lie below ${f4(lim)} Hz, **including rigid-body modes**?`,
        givens: [
          { sym: 'f_1', value: `${f1} Hz`, label: 'first elastic mode' },
          { sym: 'f_{lim}', value: `${f4(lim)} Hz` },
        ],
        parts: [
          {
            kind: 'numeric',
            id: 'n',
            label: 'Number of natural frequencies below the limit (including ω = 0 modes)',
            answer: count,
            unit: '',
            tol: 0,
            absTol: 0.4,
            traps: traps(count, [
              { value: elastic.length, message: `Include the rigid-body modes: ${BC_NAME[bc]} has ${RIGID[bc]} at ω = 0.`, trapId: 'rigid-modes' },
              { value: elastic.length + 2 * RIGID[bc], message: 'Count each rigid-body mode once.' },
            ]),
          },
          { kind: 'numeric', id: 'top', label: 'The highest of those frequencies', answer: top, unit: 'Hz', freq: true },
        ],
        hints: [
          `An unrestrained beam can move as a rigid body at ω = 0: ${bc === 'free-free' ? 'translate and rotate (2 modes)' : 'rotate about the pin (1 mode)'}. The handout lists only elastic modes.`,
          `Elastic frequencies: $f_i = f_1(\\beta_i L/\\beta_1 L)^2$ with ${bc === 'free-free' ? '1 : 2.757 : 5.404 : 8.933' : '1 : 3.241 : 6.761 : 11.56'}.`,
          `Elastic: ${elastic.map((q) => f4(f1 * q)).join(', ')} Hz below ${f4(lim)} Hz; next is ${f4(f1 * ratios[elastic.length])} Hz.`,
          `**${count}** natural frequencies (${RIGID[bc]} rigid + ${elastic.length} elastic); the highest is **${f4(top)} Hz**.`,
        ],
      };
    },
  },
];
