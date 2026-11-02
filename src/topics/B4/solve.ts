// B4 problem generators: forced response by modal superposition. Response ratios with unbalance, thickness
// for an amplitude limit, maximum force, % thickness change, the dominant mode, the aᵢ table and a machine on a clamped beam.
// Exact βL roots and the handout normalisation (∫Y² dx = L) throughout; amplitudes in units of PL³/EI.
import type { SolveGenerator, SolvePart } from '../../engine/types';
import { type BeamBC, betaL, modeShape } from '../../physics/beams';
import { brent } from '../../physics/roots';
import { BC_NAME, ratioTrick } from '../B3/physics';
import { TAU, f3, f4, sumTeX, t4, tp, traps } from '../B3/solveKit';
import { dominant, modalTable, responseFactor, unbalanceRatioMode1 } from './physics';

const CF: BeamBC = 'clamped-free';
const PP: BeamBC = 'pinned-pinned';
const CC: BeamBC = 'clamped-clamped';
const SUB = ['', '₁', '₂', '₃', '₄', '₅'];
const sum = (xs: number[]) => xs.reduce((s, v) => s + v, 0);
/** Position as a fraction of L for text: 'L' at the tip, '2L/3', otherwise '0.6L'. */
const posL = (x: number): string => (Math.abs(x - 1) < 1e-12 ? 'L' : Math.abs(x - 2 / 3) < 1e-12 ? '2L/3' : `${x}L`);

/** "a₁ = …, a₂ = …" with the factors spelled out, for worked solutions (Rich: one maths segment per mode). */
function tableTeX(rows: ReturnType<typeof modalTable>): string {
  return rows.map((m) => `$a_${m.i} = ${t4(m.Ye)} \\times ${tp(m.DF)}/${t4(m.bL4)} = ${t4(m.a)}$`).join(', ');
}

export const generators: SolveGenerator[] = [
  // ------------------------------------------------------------------ speed / engine ratios (official 2018/2019 B2.3)
  {
    id: 'b4-speed-ratio',
    title: 'Response ratios with rotating unbalance',
    summary: 'Unbalance $P = me\\Omega^2$: compare speeds through force × dynamic factor, and engines through their mode-shape values.',
    tiers: [1, 2, 3],
    source: 'Similar to official 2019 B2.3 (take-off vs cruise) and 2018 B2.3 (two engines); summary notes B4',
    cardId: 'b4-unbalance',
    marks: 4,
    generate(rng, tier) {
      if (tier === 1) {
        const ra = rng.pick([0.2, 0.25, 0.3, 0.4]);
        const rb = rng.pick([0.5, 0.6, 0.7, 0.8]);
        const DFa = 1 / (1 - ra * ra);
        const DFb = 1 / (1 - rb * rb);
        const ratio = unbalanceRatioMode1(ra, rb);
        return {
          prompt: `A motor with a fixed rotating unbalance $me$ is mounted on a beam whose response is dominated by mode 1. It first runs at $\\Omega_a = ${ra}\\,\\omega_1$, then at $\\Omega_b = ${rb}\\,\\omega_1$.`,
          givens: [
            { sym: '\\Omega_a/\\omega_1', value: `${ra}` },
            { sym: '\\Omega_b/\\omega_1', value: `${rb}` },
          ],
          parts: [
            { kind: 'numeric', id: 'DFb', label: 'Mode-1 dynamic factor at $\\Omega_b$', answer: DFb, unit: '', traps: traps(DFb, [{ value: 1 / (1 - rb), message: 'Square the frequency ratio: $1/(1-\\Omega^2/\\omega_1^2)$.', trapId: 'sqrt' }]) },
            {
              kind: 'numeric',
              id: 'ratio',
              label: 'Ratio of response amplitudes $y_b/y_a$',
              answer: ratio,
              unit: '',
              traps: traps(ratio, [
                { value: DFb / DFa, message: 'The unbalance force also grows, as $\\Omega^2$: multiply by $(\\Omega_b/\\Omega_a)^2$.', trapId: 'unbalance-omega2' },
                { value: (rb / ra) ** 2, message: 'That is the force ratio only. The dynamic factor changes too.', trapId: 'unbalance-omega2' },
                { value: rb / ra, message: 'The force is $me\\Omega^2$: square the speed ratio, then include the dynamic factors.', trapId: 'unbalance-omega2' },
              ]),
            },
          ],
          hints: [
            'Two things change with speed: the unbalance force $P = me\\Omega^2$ and the dynamic factor $1/(1-\\Omega^2/\\omega_1^2)$. With mode 1 dominant, $y \\propto \\Omega^2/(1-\\Omega^2/\\omega_1^2)$.',
            '$\\dfrac{y_b}{y_a} = \\left(\\dfrac{\\Omega_b}{\\Omega_a}\\right)^2 \\dfrac{1-\\Omega_a^2/\\omega_1^2}{1-\\Omega_b^2/\\omega_1^2}$.',
            `$(\\Omega_b/\\Omega_a)^2 = (${rb}/${ra})^2 = ${t4((rb / ra) ** 2)}$; dynamic factors $${t4(DFa)}$ and $${t4(DFb)}$.`,
            `Dynamic factor at $\\Omega_b$: **${f4(DFb)}**. $y_b/y_a = ${t4((rb / ra) ** 2)} \\times ${t4(DFb)}/${t4(DFa)} = $ **${f4(ratio)}**: more than the force ratio alone, because $\\Omega_b$ is also closer to resonance.`,
          ],
        };
      }
      if (tier === 2) {
        // Both speeds between ω₁ and 1.7ω₁, so the forcing really is closest to ω₁ (ω₂ = 2.76ω₁), as in 2019.
        const f1 = rng.pick([20, 25, 30, 35, 40]);
        const rc0 = rng.pick([1.15, 1.2, 1.25, 1.3, 1.35]);
        const kt = rng.pick([1.15, 1.2, 1.25]);
        const Nc = Math.round((rc0 * f1 * 60) / 10) * 10;
        const Nt = Math.round((rc0 * kt * f1 * 60) / 10) * 10;
        const rc = Nc / 60 / f1;
        const rt = Nt / 60 / f1;
        const DFt = 1 / (1 - rt * rt);
        const pct = unbalanceRatioMode1(rt, rc) * 100;
        const S3 = (r: number) => responseFactor('free-free', [{ xi: 0.6 }], r, 0.6, 3);
        const pct3 = ((rc * rc * S3(rc)) / (rt * rt * S3(rt))) * 100;
        return {
          prompt: `A fuselage in flight is modelled as a free–free beam with its first elastic natural frequency at ${f1} Hz. The wing engines at 0.6L, near an antinode of mode 1, apply in-phase unbalance forces $2m_we\\Omega^2$. The engines turn at ${Nt} rpm at take-off and ${Nc} rpm in cruise. Using mode 1 only (the forcing is closest to $\\omega_1$), compare the steady vibration at the engines.`,
          givens: [
            { sym: 'f_1', value: `${f1} Hz` },
            { sym: 'N_{take-off}', value: `${Nt} rpm` },
            { sym: 'N_{cruise}', value: `${Nc} rpm` },
          ],
          parts: [
            { kind: 'numeric', id: 'DFt', label: 'Mode-1 dynamic factor at take-off', answer: DFt, unit: '', traps: traps(DFt, [{ value: -DFt, message: 'Above $\\omega_1$ the dynamic factor is negative (out of phase).', trapId: 'sign' }]) },
            {
              kind: 'numeric',
              id: 'pct',
              label: 'Cruise response as a percentage of the take-off response',
              answer: pct,
              unit: '%',
              traps: traps(pct, [
                { value: ((1 - rt * rt) / (1 - rc * rc)) * 100, message: 'You compared dynamic factors only. The unbalance force falls as $\\Omega^2$ in cruise.', trapId: 'unbalance-omega2' },
                { value: (rc / rt) ** 2 * 100, message: 'That is the force ratio only; cruise is closer to $\\omega_1$, so its dynamic factor is larger.', trapId: 'unbalance-omega2' },
                { value: 10000 / pct, message: 'Upside down: cruise over take-off.' },
              ]),
            },
            {
              kind: 'choice',
              id: 'why',
              label: 'Why can the slower cruise speed give the larger vibration?',
              options: [
                { text: 'Cruise is closer to $\\omega_1$ (both are above it), and that resonance effect outweighs the smaller $\\Omega^2$ force', correct: pct > 100, why: pct > 100 ? 'The official 2019 note gives exactly this reason.' : 'Not here: in this case the force reduction wins.' },
                { text: 'The smaller $\\Omega^2$ force always wins, so cruise is always quieter', correct: pct <= 100, why: pct <= 100 ? 'Here the force reduction wins.' : 'Above $\\omega_1$ slowing down moves you towards resonance.' },
                { text: 'The engines move to a node in cruise', correct: false, why: 'The forcing position does not change with speed.' },
              ],
            },
          ],
          hints: [
            'Both speeds are above $\\omega_1$, so both dynamic factors are negative and the response is out of phase with the force. Slowing down moves you *towards* resonance while the force $me\\Omega^2$ falls.',
            '$\\dfrac{y_c}{y_t} = \\dfrac{\\Omega_c^2/(1-\\Omega_c^2/\\omega_1^2)}{\\Omega_t^2/(1-\\Omega_t^2/\\omega_1^2)} = \\dfrac{\\omega_1^2/\\Omega_t^2-1}{\\omega_1^2/\\Omega_c^2-1}$.',
            `$\\Omega_t/\\omega_1 = ${Nt}/(60 \\times ${f1}) = ${t4(rt)}$, $\\Omega_c/\\omega_1 = ${t4(rc)}$; dynamic factors $${t4(DFt)}$ (take-off) and $${t4(1 / (1 - rc * rc))}$ (cruise).`,
            `Take-off dynamic factor **${f4(DFt)}**. $y_c/y_t = (${t4(1 / (rt * rt))} - 1)/(${t4(1 / (rc * rc))} - 1)$ = **${f4(pct)} %**. The exam answer, like the official 2019 solution, uses mode 1 alone. (Mode 2, at $2.757\\,\\omega_1$, is in phase with the force and partly cancels mode 1, more so at the faster speed: three elastic modes in consistent units give ${f3(pct3)} %.)`,
          ],
        };
      }
      const xA = rng.pick([0.3, 0.35, 0.4]);
      const xB = rng.pick([0.6, 0.65, 0.7, 0.75]);
      const r = rng.pick([0.6, 0.7, 0.8, 1.2, 1.3, 1.5]);
      const rowsA = modalTable(CF, [{ xi: xA }], r, 1, 3);
      const rowsB = modalTable(CF, [{ xi: xB }], r, 1, 3);
      const yA = sum(rowsA.map((m) => m.y));
      const yB = sum(rowsB.map((m) => m.y));
      const pct3 = (yA / yB) * 100;
      const pct1 = (modeShape(CF, 1, xA) / modeShape(CF, 1, xB)) * 100;
      return {
        prompt: `A cantilevered wing carries engine A at ${posL(xA)} and engine B at ${posL(xB)} from the root. Both have the same unbalance and run at $\\Omega = ${r}\\,\\omega_1$. Compare their contributions to the wing-tip vibration.`,
        givens: [
          { sym: 'x_A', value: `${posL(xA)}` },
          { sym: 'x_B', value: `${posL(xB)}` },
          { sym: '\\Omega/\\omega_1', value: `${r}` },
        ],
        parts: [
          {
            kind: 'numeric',
            id: 'p1',
            label: 'Engine A’s tip contribution as a % of engine B’s, mode 1 only',
            answer: pct1,
            unit: '%',
            traps: traps(pct1, [
              { value: 10000 / pct1, message: 'Upside down: A as a percentage of B.' },
              { value: (pct1 / 100) ** 2 * 100, message: 'Each engine enters once, through $Y_1(x_{engine})$; the tip value $Y_1(L)$ is common and cancels.' },
            ]),
          },
          {
            kind: 'numeric',
            id: 'p3',
            label: 'The same ratio with three modes',
            answer: pct3,
            unit: '%',
            traps: traps(pct3, [
              { value: pct1, message: 'That is the mode-1 value; add modes 2 and 3 with their signs.' },
              { value: 10000 / pct3, message: 'Upside down: A as a percentage of B.' },
            ]),
          },
          {
            kind: 'choice',
            id: 'why',
            label: 'Why does engine B contribute more?',
            options: [
              { text: 'It is nearer the tip, where mode 1 (which dominates) moves most; A is nearer the root, which is a node', correct: true, why: 'Official 2018 B2.3 note: the response scales with $Y_1(x_{engine})$.' },
              { text: 'It is closer to resonance', correct: false, why: 'Both engines run at the same Ω.' },
              { text: 'Its unbalance force is larger', correct: false, why: 'The unbalances are equal.' },
            ],
          },
        ],
        hints: [
          'Same Ω, so the dynamic factors are common. Each engine’s modal force is $P\\,Y_i(x_{engine})$; the tip value $Y_i(L)$ multiplies both.',
          'Mode 1 only: ratio $= Y_1(x_A)/Y_1(x_B)$. Three modes: $\\dfrac{\\sum_i Y_i(x_A) Y_i(L)\\,DF_i/(\\beta_i L)^4}{\\sum_i Y_i(x_B) Y_i(L)\\,DF_i/(\\beta_i L)^4}$.',
          `$Y_1(x_A) = ${t4(modeShape(CF, 1, xA))}$, $Y_1(x_B) = ${t4(modeShape(CF, 1, xB))}$. A: $${sumTeX(rowsA.map((m) => m.y))}$; B: $${sumTeX(rowsB.map((m) => m.y))}$ (units PL³/EI).`,
          `Mode 1 only: **${f4(pct1)} %**. Three modes: $${t4(yA)}/${t4(yB)}$ = **${f4(pct3)} %**. B dominates because it sits nearer the tip, the antinode of the dominant mode.`,
        ],
      };
    },
  },

  // ------------------------------------------------------------------ thickness for an amplitude limit (2022 B2.3)
  {
    id: 'b4-thickness-limit',
    title: 'Wing thickness for an amplitude limit',
    summary: 'Sum the modal contributions at the tip, then $EI \\ge S\\,PL^3/y_{lim}$ and $I = tw^3/12$ for in-plane bending.',
    tiers: [1, 2, 3],
    source: 'Similar to 2022 B2.3 (eVTOL wing); reader W7.7(b)',
    cardId: 'b4-design',
    marks: 5,
    sprint: false,
    generate(rng, tier) {
      const E = 280e9;
      const rho = 1600;
      if (tier === 1) {
        const L = rng.pick([1.5, 2, 2.5, 3]);
        const w = rng.pick([0.2, 0.3, 0.4]);
        const P = rng.step(5, 60, 5);
        const r = rng.pick([0.3, 0.4, 0.5]);
        const ylim = rng.pick([0.05, 0.1, 0.2]);
        const S = responseFactor(CF, [{ xi: 1 }], r, 1, 3);
        const S0 = responseFactor(CF, [{ xi: 1 }], 1e-9, 1, 3);
        const EI = (S * P * L ** 3) / (ylim / 1000);
        const I = EI / E;
        const t = ((12 * I) / w ** 3) * 1000;
        return {
          prompt: `A carbon-fibre cantilever ($E$ = 280 GPa) of length ${L} m and width $w$ = ${w * 1000} mm bends in its own plane (across $w$) under a rotor at its tip that applies $P$ = ${P} N at $\\Omega = ${r}\\,\\omega_1$. The three-mode tip sum is $S = \\sum a_i Y_i(L)\\,/\\,(PL^3/EI) = ${f4(S)}$. The tip amplitude must not exceed ${ylim} mm.`,
          givens: [
            { sym: 'L', value: `${L} m` },
            { sym: 'w', value: `${w * 1000} mm` },
            { sym: 'P', value: `${P} N` },
            { sym: 'S', value: f4(S), label: 'tip sum, PL³/EI units' },
            { sym: 'y_{lim}', value: `${ylim} mm` },
          ],
          parts: [
            { kind: 'numeric', id: 'EI', label: 'Minimum bending stiffness $EI$', answer: EI, unit: 'N m²', traps: traps(EI, [{ value: (S0 * P * L ** 3) / (ylim / 1000), message: 'That uses the static sum (Ω → 0). The question already gives $S$ including the dynamic factors.' }, { value: (S * P * L ** 3) / ylim, message: 'Convert the limit to metres.', trapId: 'unit-scale' }]) },
            {
              kind: 'numeric',
              id: 't',
              label: 'Minimum thickness $t$',
              answer: t,
              unit: 'mm',
              traps: traps(t, [
                { value: Math.cbrt((12 * I) / w) * 1000, message: 'Out-of-plane formula used. Bending across $w$: $I = tw^3/12$.', trapId: 'b3-wrong-plane' },
                { value: t / 12, message: '$I = tw^3/12$: keep the 12.' },
              ]),
            },
          ],
          hints: [
            'The tip amplitude is $y = S\\,PL^3/EI$, so the limit sets the minimum $EI$; in-plane bending then gives $t$ from $I = tw^3/12$ (and $t$ does not change the frequencies).',
            '$EI_{min} = S\\,P L^3/y_{lim}$; $I = EI/E$; $t = 12I/w^3$.',
            `$EI_{min} = ${t4(S)} \\times ${P} \\times ${L}^3/${tp(ylim / 1000)} = ${t4(EI)}$ N m²; $I = ${t4(I)}$ m⁴.`,
            `$EI$ = **${f4(EI)} N m²**; $t = 12 \\times ${t4(I)}/${w}^3 = $ **${f4(t)} mm**.`,
          ],
        };
      }
      const L = rng.pick([2, 2.5, 3, 3.5]);
      const N = rng.pick([1800, 2400, 3000]);
      const n = rng.pick([2, 2.5, 3]);
      const me = rng.pick([0.5, 1, 2]);
      const ylim = rng.pick([0.05, 0.1, 0.2]);
      const xA = rng.pick([0.4, 0.5, 0.6]);
      const xB = rng.pick([0.8, 0.9, 1.0]);
      const Om = (TAU * N) / 60;
      const b1 = betaL(CF, 1)[0];
      const c12 = Math.sqrt(E / (12 * rho));
      const wmm = Math.round(((n * Om * L * L) / (b1 * b1 * c12)) * 1000);
      const w = wmm / 1000;
      const w1 = b1 * b1 * (w / (L * L)) * c12;
      const r = Om / w1;
      const P = me * 1e-3 * Om * Om;
      const loads = [{ xi: xA }, { xi: xB }];
      const rows = modalTable(CF, loads, r, 1, 3);
      const S = sum(rows.map((m) => m.y));
      const SB = responseFactor(CF, [{ xi: xB }], r, 1, 3);
      const S0 = responseFactor(CF, loads, 1e-9, 1, 3);
      const EI = (S * P * L ** 3) / (ylim / 1000);
      const I = EI / E;
      const t = ((12 * I) / w ** 3) * 1000;
      const parts: SolvePart[] = [
        {
          kind: 'numeric',
          id: 'P',
          label: 'Unbalance force per rotor at the top speed, $P = me\\Omega^2$',
          answer: P,
          unit: 'N',
          traps: traps(P, [
            { value: me * 1e-3 * Om, message: 'The unbalance force is $me\\Omega^2$: square Ω.', trapId: 'unbalance-omega2' },
            { value: me * 1e-3 * (N / 60) ** 2, message: 'Use Ω in rad/s: $2\\pi N/60$.', trapId: 'units' },
            { value: me * Om * Om, message: 'Convert kg mm to kg m (×10⁻³).', trapId: 'unit-scale' },
          ]),
        },
        {
          kind: 'numeric',
          id: 'S',
          label: 'Tip sum $S = \\sum_{i=1}^{3} a_iY_i(L)$ in units of $PL^3/EI$ (both rotors)',
          answer: S,
          unit: '',
          traps: traps(S, [
            { value: SB, message: 'Both rotors push in phase: add $Y_i(x_A) + Y_i(x_B)$ in every mode.' },
            { value: S0, message: 'You left out the dynamic factors $1/(1-\\Omega^2/\\omega_i^2)$.' },
          ]),
        },
        {
          kind: 'numeric',
          id: 't',
          label: 'Minimum wing thickness $t$',
          answer: t,
          unit: 'mm',
          traps: traps(t, [
            { value: Math.cbrt((12 * I) / w) * 1000, message: 'Out-of-plane $I$ used. Take-off bending is across $w$: $I = tw^3/12$, linear in $t$.', trapId: 'b3-wrong-plane' },
            { value: (t * SB) / S, message: 'Only one rotor counted.' },
            { value: (t * S0) / S, message: 'Dynamic factors missing (that is the static design).' },
          ]),
        },
      ];
      if (tier === 3)
        parts.push(
          {
            kind: 'choice',
            id: 'worst',
            label: 'Why is the top speed the worst case for this limit?',
            options: [
              { text: 'Below $\\omega_1$ both the force $me\\Omega^2$ and the dynamic factor grow with speed', correct: true, why: `$\\Omega/\\omega_1$ = ${f3(r)} at the top speed: everything is below resonance.` },
              { text: 'The dynamic factor is largest at low speed', correct: false, why: 'It rises towards resonance.' },
              { text: 'The force is the same at every speed', correct: false, why: 'Unbalance force grows as Ω².' },
            ],
          },
          {
            kind: 'choice',
            id: 'freq',
            label: 'Does your new thickness change the take-off critical speeds?',
            options: [
              { text: 'No: in-plane $I/A = w^2/12$ does not involve $t$', correct: true, why: 'Stiffness and mass both scale with $t$; only $EI$ (so the amplitude) changes.' },
              { text: 'Yes: a thicker wing is stiffer, so they rise', correct: false, why: 'It is heavier in the same proportion.' },
              { text: 'Yes: a thicker wing is heavier, so they fall', correct: false, why: 'Stiffness rises in the same proportion.' },
            ],
          }
        );
      return {
        prompt: `An eVTOL wing (CFRP, $E$ = 280 GPa, $\\rho$ = 1600 kg/m³) is a cantilever of length $L$ = ${L} m with a thin rectangular section; its width $w$ = ${wmm} mm was chosen to put $f_1$ at ${n}× the top rotor speed of ${N} rpm. Two rotors, at ${posL(xA)} and ${xB === 1 ? 'at the tip' : posL(xB)}, each have an unbalance $me$ = ${me} kg mm and spin in phase, exciting **in-plane** bending. Find the minimum thickness $t$ so the tip amplitude never exceeds ${ylim} mm during take-off. Use three modes and neglect the rotor inertia.`,
        givens: [
          { sym: 'L', value: `${L} m` },
          { sym: 'w', value: `${wmm} mm` },
          { sym: 'N_{max}', value: `${N} rpm` },
          { sym: 'me', value: `${me} kg mm` },
          { sym: 'x_A, x_B', value: `${posL(xA)}, ${posL(xB)}` },
          { sym: 'y_{lim}', value: `${ylim} mm` },
        ],
        parts,
        hints: [
          'Below $\\omega_1$ the worst case is the top speed (force and dynamic factor both largest) at the tip. Sum both rotors’ modal forces in each mode, then turn the limit into a minimum $EI$, and $EI$ into $t$ with $I = tw^3/12$.',
          `$a_i = \\dfrac{1}{(\\beta_i L)^4}\\,\\dfrac{PL^3}{EI}\\,\\dfrac{Y_i(${posL(xA)}) + Y_i(${posL(xB)})}{1-(\\Omega/\\omega_i)^2}$, $S = \\sum a_iY_i(L)$ per $PL^3/EI$; $EI_{min} = SPL^3/y_{lim}$.`,
          `$\\Omega = ${t4(Om)}$ rad/s, $\\omega_1 = ${t4(w1)}$ rad/s, $\\Omega/\\omega_1 = ${t4(r)}$; $P = ${me}\\times10^{-3} \\times ${t4(Om)}^2 = ${t4(P)}$ N. Modes: ${tableTeX(rows)}; $Y_i(L) = \\pm 2$.`,
          `$P$ = **${f4(P)} N**; $S = ${sumTeX(rows.map((m) => m.y))} = $ **${f4(S)}**; $EI_{min} = ${t4(S)} \\times ${t4(P)} \\times ${L}^3/${tp(ylim / 1000)} = ${t4(EI)}$ N m², $I = ${t4(I)}$ m⁴, so $t = 12I/w^3 = $ **${f4(t)} mm**.`,
        ],
      };
    },
  },

  // ------------------------------------------------------------------ maximum allowable force (2023 B2.4)
  {
    id: 'b4-max-force',
    title: 'Maximum allowable force for a deflection limit',
    summary: '$P_{max} = y_{lim}\\,EI/(S L^3)$ with $S$ the modal sum at the output; thin tube $I = \\pi r^3 t$.',
    tiers: [1, 2, 3],
    source: 'Similar to 2023 B2.4 (turbine blade); reader W7.6(b)',
    cardId: 'b4-design',
    marks: 4,
    generate(rng, tier) {
      if (tier === 1) {
        const EI = rng.pick([2e5, 5e5, 1e6, 2e6, 5e6]);
        const L = rng.step(1, 4, 0.5);
        const r = rng.pick([0.2, 0.3, 0.5, 0.6, 0.7]);
        const ylim = rng.pick([0.5, 1, 2, 5]);
        const bL4 = betaL(CF, 1)[0] ** 4;
        const DF = 1 / (1 - r * r);
        const S1 = (4 / bL4) * DF;
        const P = ((ylim / 1000) * EI) / (S1 * L ** 3);
        return {
          prompt: `A cantilever ($EI = ${t4(EI)}$ N m², $L$ = ${L} m) carries a harmonic force at its tip at $\\Omega = ${r}\\,\\omega_1$. Using mode 1 only, find the largest force amplitude that keeps the tip within ${ylim} mm.`,
          givens: [
            { sym: 'EI', value: `${f3(EI)} N m²` },
            { sym: 'L', value: `${L} m` },
            { sym: '\\Omega/\\omega_1', value: `${r}` },
            { sym: 'y_{lim}', value: `${ylim} mm` },
          ],
          parts: [
            { kind: 'numeric', id: 'S1', label: 'Mode-1 tip factor $a_1Y_1(L)$ in units of $PL^3/EI$', answer: S1, unit: '', traps: traps(S1, [{ value: 4 / bL4, message: 'Include the dynamic factor $1/(1-\\Omega^2/\\omega_1^2)$.' }, { value: 2 / bL4 / (1 - r * r), message: 'Both $Y_1(x_e)$ and $Y_1(L)$ appear: here both are 2.', trapId: 'factor2' }, { value: (1 / 3) * DF, message: 'That is the exact static tip value (all modes) times the dynamic factor; the question asks for mode 1 alone.' }]) },
            { kind: 'numeric', id: 'P', label: 'Maximum force amplitude $P_{max}$', answer: P, unit: 'N', traps: traps(P, [{ value: P * DF, message: 'Dynamic factor missing.' }, { value: P * 1000, message: 'The limit must be in metres.', trapId: 'unit-scale' }]) },
          ],
          hints: [
            'One mode: $a_1 Y_1(L) = \\dfrac{1}{(\\beta_1L)^4}\\dfrac{PL^3}{EI}\\dfrac{Y_1(x_e)\\,Y_1(L)}{1-\\Omega^2/\\omega_1^2}$, with $Y_1(L) = 2$ for the normalised cantilever.',
            '$P_{max} = \\dfrac{y_{lim}\\,EI}{S_1 L^3}$ with $S_1 = \\dfrac{2 \\times 2}{(1.875)^4}\\cdot\\dfrac{1}{1-r^2}$.',
            `$(\\beta_1L)^4 = ${t4(bL4)}$, dynamic factor $${t4(DF)}$, so $S_1 = 4/${t4(bL4)} \\times ${t4(DF)} = ${t4(S1)}$.`,
            `$S_1$ = **${f4(S1)}**; $P_{max} = ${t4(ylim / 1000)} \\times ${t4(EI)}/(${t4(S1)} \\times ${L}^3) = $ **${f4(P)} N**.`,
          ],
        };
      }
      const E = 13.23e9;
      const L = rng.pick([60, 70, 80, 86.4, 90]);
      const d = rng.pick([8, 10, 12, 13.9, 15]);
      const tdr = rng.pick([0.003, 0.005, 0.008]);
      const xi = rng.pick([0.4, 0.5, 0.6]);
      const limPct = rng.pick([0.2, 0.5, 1]);
      let r: number;
      let n = 2;
      let k = 1.8;
      if (tier === 3) {
        n = rng.pick([1.5, 2, 2.5, 3]);
        k = rng.pick([1, 1.5, 1.8, 2]);
        r = 1 / n;
      } else r = rng.pick([0.3, 0.4, 0.5, 0.6]);
      const t = tdr * d;
      const rad = d / 2;
      const I = Math.PI * rad ** 3 * t;
      const EI = E * I;
      const rows = modalTable(CF, [{ xi }], r, 1, 3);
      const S = sum(rows.map((m) => m.y));
      const S1 = rows[0].y;
      const S0 = responseFactor(CF, [{ xi }], 1e-9, 1, 3);
      const ylim = (limPct / 100) * L;
      const P = (ylim * EI) / (S * L ** 3) / 1000; // kN
      const parts: SolvePart[] = [];
      if (tier === 3)
        parts.push({ kind: 'numeric', id: 'r', label: 'Forcing ratio $\\Omega_{exc}/\\omega_1$ at the top speed', answer: r, unit: '', traps: traps(r, [{ value: k / n, message: 'The design already includes the excitation multiple: $\\omega_1 = n\\,k\\,\\Omega_{max}$, so $k\\Omega_{max}/\\omega_1 = 1/n$.', trapId: 'b3-margin' }, { value: 1 / (n * k), message: 'Use the excitation frequency $k\\Omega$, not Ω.', trapId: 'b3-margin' }]) });
      parts.push(
        { kind: 'numeric', id: 'I', label: 'Second moment of area $I \\approx \\pi r^3 t$', answer: I, unit: 'm⁴', traps: traps(I, [{ value: Math.PI * d ** 3 * t, message: 'Use the radius: $r = d/2$.', trapId: 'factor2' }]) },
        {
          kind: 'numeric',
          id: 'S',
          label: 'Tip sum $S = \\sum_{i=1}^3 a_iY_i(L)$ in units of $PL^3/EI$',
          answer: S,
          unit: '',
          traps: traps(S, [
            { value: S1, message: 'Mode 1 alone. At this Ω mode 2 (out of phase at the tip) takes a few per cent off: include three modes.' },
            { value: S0, message: 'Dynamic factors missing.' },
          ]),
        },
        {
          kind: 'numeric',
          id: 'P',
          label: 'Maximum force amplitude $P_{max}$',
          answer: P,
          unit: 'kN',
          traps: traps(P, [
            { value: (P * S) / S1, message: 'Mode-1-only sum used.' },
            { value: (P * S) / S0, message: 'Static sum used (no dynamic factors).' },
            { value: P * 8, message: '$I$ used the diameter instead of the radius.', trapId: 'factor2' },
          ]),
        }
      );
      return {
        prompt:
          tier === 3
            ? `A wind-turbine blade spar (composite thin tube, $E$ = 13.23 GPa) is a cantilever of length ${L} m, diameter $d$ = ${d} m and wall $t = ${tdr}\\,d$. It was designed so that $\\omega_1$ = ${n} × the bearing-defect excitation (at ${k}Ω) at the top rotor speed. That excitation is modelled as a force $P\\sin(${k}\\Omega t)$ at ${posL(xi)}. Find the largest $P$ that keeps the tip within ${limPct} % of $L$ at the top speed (three modes).`
            : `A wind-turbine blade spar (composite thin tube, $E$ = 13.23 GPa) is a cantilever of length ${L} m, diameter $d$ = ${d} m and wall $t = ${tdr}\\,d$. A bearing defect applies $P\\sin\\Omega_{exc}t$ at ${posL(xi)}, with $\\Omega_{exc} = ${r}\\,\\omega_1$ at the top speed. Find the largest $P$ that keeps the tip deflection within ${limPct} % of $L$ (three modes).`,
        givens: [
          { sym: 'E', value: '13.23 GPa' },
          { sym: 'L', value: `${L} m` },
          { sym: 'd', value: `${d} m` },
          { sym: 't/d', value: `${tdr}` },
          { sym: 'x_e', value: `${posL(xi)}` },
          ...(tier === 3 ? [{ sym: 'n', value: `${n}`, label: 'frequency margin' }] : [{ sym: '\\Omega_{exc}/\\omega_1', value: `${r}` }]),
          { sym: 'y_{lim}', value: `${limPct} % of L` },
        ],
        parts,
        hints: [
          `${tier === 3 ? 'First the forcing ratio: the design put $\\omega_1$ at $n$ times the excitation, so at the top speed $\\Omega_{exc}/\\omega_1 = 1/n$. Then t' : 'T'}abulate $a_iY_i(L)$ for three modes in units of $PL^3/EI$ and invert $y_{lim} = S\\,PL^3/EI$ for $P$.`,
          `$I = \\pi r^3 t$; $a_iY_i(L) = \\dfrac{Y_i(${posL(xi)})\\,Y_i(L)}{(\\beta_i L)^4\\,(1-(\\Omega/\\omega_i)^2)}$; $P_{max} = y_{lim}EI/(S L^3)$.`,
          `$r = ${d / 2}$ m, $t = ${t4(t)}$ m, $I = ${t4(I)}$ m⁴, $EI = ${t4(EI)}$ N m²; $\\Omega/\\omega_1 = ${t4(r)}$; ${tableTeX(rows)}; $Y_i(L) = \\pm 2$.`,
          `${tier === 3 ? `Forcing ratio **${f4(r)}**. ` : ''}$I$ = **${f4(I)} m⁴**; $S = ${sumTeX(rows.map((m) => m.y))} = $ **${f4(S)}**; $y_{lim} = ${t4(ylim)}$ m, so $P_{max} = ${t4(ylim)} \\times ${t4(EI)}/(${t4(S)} \\times ${L}^3) = $ **${f4(P)} kN**.`,
        ],
      };
    },
  },

  // ------------------------------------------------------------------ thickness change for a response target (2024 B2.5)
  {
    id: 'b4-thickness-change',
    title: 'Wall-thickness change for a response target',
    summary: 'Thin tube: $EI \\propto t$ while the frequencies do not move, so $y \\propto 1/t$ and $t_{new}/t = y_{old}/y_{new}$.',
    tiers: [1, 2, 3],
    source: 'Similar to 2024 B2.5 (hydro shaft); 2024 B1.6(b), 2025 B1.6(b)',
    cardId: 'b4-design',
    marks: 4,
    generate(rng, tier) {
      const X = rng.pick([10, 20, 25, 30, 40, 50]);
      const dt = (1 / (1 - X / 100) - 1) * 100;
      const dtTraps = traps(dt, [
        { value: X, message: `Response ∝ 1/t, not ∝ −t: a ${X} % cut needs $1/(1-${X / 100}) - 1$, more than ${X} %.`, trapId: 'b4-t-response' },
        { value: ((1 / (1 - X / 100)) ** (1 / 3) - 1) * 100, message: 'A thin tube has $I \\approx \\pi r^3 t$: linear in $t$ (the cube is for a solid section bending across $t$).', trapId: 'b4-t-response' },
        { value: -X, message: 'The wall must get thicker to cut the response.', trapId: 'sign' },
      ]);
      if (tier === 1) {
        return {
          prompt: `A thin-walled tubular shaft (fixed mean diameter) vibrates under a harmonic bearing force. By what percentage must its wall thickness change to reduce the steady-state vibration amplitude by ${X} %?`,
          givens: [{ sym: '\\Delta y', value: `−${X} %` }],
          parts: [
            { kind: 'numeric', id: 'dt', label: 'Change in wall thickness', answer: dt, unit: '%', traps: dtTraps },
            {
              kind: 'choice',
              id: 'freq',
              label: 'Do the transverse critical speeds change?',
              options: [
                { text: 'No: $I/A = r^2/2$ does not involve $t$', correct: true, why: 'Stiffness and mass per length both scale with $t$.' },
                { text: 'Yes, they rise in proportion to $t$', correct: false, why: 'The extra wall adds mass in the same proportion.' },
                { text: 'Yes, they fall', correct: false, why: 'Nothing in $\\omega \\propto (r/L^2)\\sqrt{E/2\\rho}$ depends on $t$.' },
              ],
            },
          ],
          hints: [
            'Each modal amplitude carries $PL^3/EI$ and a dynamic factor. For a thin tube $EI = E\\pi r^3 t \\propto t$ while the frequencies (so the dynamic factors) do not depend on $t$.',
            '$y \\propto 1/t$ ⇒ $t_{new}/t_{old} = y_{old}/y_{new} = 1/(1 - \\text{reduction})$.',
            `$t_{new}/t_{old} = 1/(1 - ${X / 100}) = ${t4(1 / (1 - X / 100))}$.`,
            `Increase the wall by **${f4(dt)} %** (not ${X} %); the critical speeds are unchanged.`,
          ],
        };
      }
      const xe = rng.pick([0.55, 0.6, 0.65, 0.7]);
      const r1 = rng.pick([0.2, 0.24, 0.3, 0.4]);
      const rows = modalTable(PP, [{ xi: xe }], r1, xe, 3);
      const a1 = rows[0].a;
      const yLoad = sum(rows.map((m) => m.y));
      if (tier === 2) {
        return {
          prompt: `A hydropower shaft is a pinned–pinned thin tube. A bearing defect applies $P\\sin\\Omega t$ at ${posL(xe)} with $\\Omega = ${r1}\\,\\omega_1$. The designer wants to cut the maximum transverse vibration by ${X} % by changing only the wall thickness.`,
          givens: [
            { sym: 'x_e', value: `${posL(xe)}` },
            { sym: '\\Omega/\\omega_1', value: `${r1}` },
            { sym: '\\Delta y', value: `−${X} %` },
          ],
          parts: [
            {
              kind: 'numeric',
              id: 'a1',
              label: 'Mode-1 amplitude $a_1$ in units of $PL^3/EI$',
              answer: a1,
              unit: '',
              traps: traps(a1, [
                { value: a1 * (1 - r1 * r1), message: 'Dynamic factor missing.' },
                { value: (modeShape(PP, 1, xe) / Math.PI ** 2) * rows[0].DF, message: 'The modal stiffness factor is $1/(\\beta_1 L)^4 = 1/\\pi^4$.' },
                { value: (Math.sin(Math.PI * xe) * rows[0].DF) / Math.PI ** 4, message: 'Normalised pinned–pinned shapes are $\\sqrt2\\sin(i\\pi x/L)$.' },
              ]),
            },
            { kind: 'numeric', id: 'y', label: 'Response at the load point with three modes, $y(x_e)$, in $PL^3/EI$', answer: yLoad, unit: '', traps: traps(yLoad, [{ value: rows.reduce((s, m) => s + Math.abs(m.y), 0), message: 'Add the contributions with their signs.' }]) },
            { kind: 'numeric', id: 'dt', label: 'Required change in wall thickness', answer: dt, unit: '%', traps: dtTraps },
          ],
          hints: [
            'Tabulate $a_i$ for three modes (pinned–pinned: $\\beta_iL = i\\pi$, $Y_i = \\sqrt2\\sin(i\\pi x/L)$). Every term carries $PL^3/EI \\propto 1/t$ and the frequencies do not depend on $t$, so the whole response scales as $1/t$.',
            '$a_i = \\dfrac{1}{(i\\pi)^4}\\,\\dfrac{\\sqrt2\\sin(i\\pi x_e/L)}{1-(\\Omega/\\omega_i)^2}$ (in $PL^3/EI$), $\\omega_i = i^2\\omega_1$; $t_{new}/t = 1/(1 - \\text{reduction})$.',
            `${tableTeX(rows)}.`,
            `$a_1$ = **${f4(a1)}**; $y(x_e) = ${sumTeX(rows.map((m) => m.y))} = $ **${f4(yLoad)}** $PL^3/EI$; wall change **+${f4(dt)} %**. (The maximum along the shaft sits a little nearer mid-span, but it scales the same way.)`,
          ],
        };
      }
      // tier 3: change the diameter instead (mode 1 dominant): y ∝ DF(Ω/ω₁)/d³ with ω₁ ∝ d
      const target = 1 - X / 100;
      const f = (s: number) => (1 - r1 * r1) / (s ** 3 - s * r1 * r1) - target;
      const s = brent(f, 1, 3);
      const dd = (s - 1) * 100;
      return {
        prompt: `A pinned–pinned thin-tube shaft (mode 1 dominant) is forced at $\\Omega = ${r1}\\,\\omega_1$. To cut its vibration by ${X} %, compare increasing the wall thickness $t$ (same $d$) with increasing the mean diameter $d$ (same $t$).`,
        givens: [
          { sym: '\\Omega/\\omega_1', value: `${r1}` },
          { sym: '\\Delta y', value: `−${X} %` },
        ],
        parts: [
          { kind: 'numeric', id: 'dt', label: 'Required change in $t$ (same $d$)', answer: dt, unit: '%', traps: dtTraps },
          {
            kind: 'numeric',
            id: 'dd',
            label: 'Required change in $d$ (same $t$)',
            answer: dd,
            unit: '%',
            tol: 0.03,
            traps: traps(dd, [
              { value: ((1 / target) ** (1 / 3) - 1) * 100, message: 'Close, but $\\omega_1 \\propto d$ too: the dynamic factor shrinks as $d$ grows, so slightly less is needed.' },
              { value: dt, message: '$EI \\propto d^3 t$: the diameter enters cubed.' },
            ], 0.05),
          },
          {
            kind: 'choice',
            id: 'mass',
            label: 'Which change adds less material (mass ∝ $d\\,t$)?',
            options: [
              { text: `Increasing $d$: mass +${f3(dd)} % against +${f3(dt)} % for $t$`, correct: true, why: '$EI \\propto d^3$, so a small diameter change buys a lot of stiffness. But it also raises every critical speed ($\\omega \\propto d$): check them against the excitations.' },
              { text: 'Increasing $t$, because thickness is what stiffens a tube', correct: false, why: '$t$ enters $EI$ only linearly.' },
              { text: 'Both add the same mass', correct: false, why: 'The required percentages differ a lot.' },
            ],
          },
        ],
        hints: [
          'Thin tube: $EI = E\\pi r^3 t$ and $\\omega_1 \\propto d$ (independent of $t$). With mode 1 dominant, $y \\propto \\dfrac{1}{EI}\\cdot\\dfrac{1}{1-(\\Omega/\\omega_1)^2}$.',
          'Thickness: $y \\propto 1/t$. Diameter ×s: $\\dfrac{y_{new}}{y_{old}} = \\dfrac{1-r_1^2}{s^3 - s\\,r_1^2}$ (EI × s³, $\\omega_1$ × s); solve for $s$.',
          `$t$: $1/(1 - ${X / 100}) = ${t4(1 / target)}$. $d$: solve $(1 - ${t4(r1 * r1)})/(s^3 - ${t4(r1 * r1)}\\,s) = ${t4(target)}$ by trial (start from $s = ${t4((1 / target) ** (1 / 3))}$).`,
          `Wall **+${f4(dt)} %**; diameter **+${f4(dd)} %** ($s$ = ${f4(s)}). The diameter route adds far less mass but moves the critical speeds up by ${f3(dd)} %.`,
        ],
      };
    },
  },

  // ------------------------------------------------------------------ which mode dominates (2025 B1.3, B2.3; LB6 Ex 9.3)
  {
    id: 'b4-dominant',
    title: 'Which mode dominates the response?',
    summary: 'Compare $|a_iY_i(x_{out})|$: dynamic factor, $1/(\\beta_iL)^4$, $Y_i(x_e)$ and $Y_i(x_{out})$ all matter. The closest natural frequency does not always win.',
    tiers: [1, 2, 3],
    source: 'Similar to 2025 B2.3 (tidal blade) and B1.3 (helicopter blade); LB6 Example 9.3; Week 9 Q2',
    cardId: 'b4-which-modes',
    marks: 4,
    generate(rng, tier) {
      if (tier <= 2) {
        let xe = 0.6;
        let r = 4;
        let rows = modalTable(CF, [{ xi: xe }], r, 1, 3);
        let dom = dominant(rows);
        for (let tries = 0; tries < 40; tries++) {
          xe = rng.pick([0.5, 0.55, 0.6, 2 / 3, 0.7, 0.85, 0.9, 0.95, 1]);
          r = tier === 1 ? rng.pick([0.5, 1.5, 2.5, 4, 5, 5.6, 7.5, 9, 12]) : rng.pick([1.8, 2.5, 3, 3.4, 4, 4.5, 5]);
          rows = modalTable(CF, [{ xi: xe }], r, 1, 3);
          dom = dominant(rows);
          const sorted = rows.map((m) => Math.abs(m.y)).sort((a, b) => b - a);
          if (sorted[0] >= 1.3 * sorted[1] && Math.abs(rows[1].y) > 1e-9) break;
        }
        const xs = xe === 1 ? 'the tip' : posL(xe);
        const tot = sum(rows.map((m) => Math.abs(m.y)));
        const choice: SolvePart = {
          kind: 'choice',
          id: 'dom',
          label: 'Which mode dominates the tip response?',
          options: rows.map((m) => ({
            text: `mode ${m.i}`,
            correct: m.i === dom.i,
            why: `$|a_${m.i}Y_${m.i}(L)|$ = ${f3(Math.abs(m.y))} PL³/EI (${f3((Math.abs(m.y) / tot) * 100)} % of the total): dynamic factor ${f3(m.DF)}, $Y_${m.i}(x_e)$ = ${f3(m.Ye)}, $1/(\\beta_${m.i}L)^4$ = ${f3(1 / m.bL4)}.`,
          })),
        };
        const DF2 = rows[1].DF;
        const ratio12 = Math.abs(rows[0].y / rows[1].y);
        const share1 = (Math.abs(rows[0].y) / tot) * 100;
        const parts: SolvePart[] =
          tier === 1
            ? [
                { kind: 'numeric', id: 'DF2', label: 'Dynamic factor of mode 2, $1/(1-\\Omega^2/\\omega_2^2)$', answer: DF2, unit: '', traps: traps(DF2, [{ value: 1 / (1 - (r / (betaL(CF, 2)[1] / betaL(CF, 1)[0])) ** 2), message: '$\\omega_2/\\omega_1 = (4.694/1.875)^2 = 6.27$: square the root ratio.', trapId: 'b3-ratio-not-squared' }, { value: 1 / (1 - r * r), message: 'That is mode 1’s dynamic factor.' }]) },
                choice,
              ]
            : [
                { kind: 'numeric', id: 'ratio', label: 'Ratio of tip contributions $|a_1Y_1(L)\\,/\\,a_2Y_2(L)|$', answer: ratio12, unit: '', traps: traps(ratio12, [{ value: Math.abs(rows[0].DF / rows[1].DF), message: 'Dynamic factors alone: include $Y_i(x_e)$ and $1/(\\beta_iL)^4$.', trapId: 'b4-closest' }, { value: 1 / ratio12, message: 'Upside down: mode 1 over mode 2.' }]) },
                { kind: 'numeric', id: 'share', label: 'Mode 1’s share of $\\sum_{i=1}^3 |a_iY_i(L)|$', answer: share1, unit: '%', traps: traps(share1, [{ value: 100 - share1, message: 'That is the share of modes 2 and 3.' }]) },
                choice,
              ];
        return {
          prompt: `A turbine blade is modelled as a uniform cantilever. A fluid force $P\\sin\\Omega t$ acts at ${xs} with $\\Omega = ${r}\\,\\omega_1$, and the response is measured at the tip.`,
          givens: [
            { sym: 'x_e', value: xs },
            { sym: '\\Omega/\\omega_1', value: `${r}` },
            { sym: 'x_{out}', value: 'L' },
          ],
          parts,
          hints: [
            'Each mode’s tip contribution is a product of four factors: $\\dfrac{1}{(\\beta_iL)^4}$ (higher modes are stiffer), $Y_i(x_e)$ (zero at a node), the dynamic factor (large near resonance, negative above it) and $Y_i(L) = \\pm2$.',
            '$a_iY_i(L) = \\dfrac{Y_i(x_e)\\,Y_i(L)}{(\\beta_iL)^4\\,(1-(\\Omega/\\omega_i)^2)}$ with $\\omega_i/\\omega_1$ = 1, 6.267, 17.55.',
            `Dynamic factors $${rows.map((m) => t4(m.DF)).join(', ')}$; $Y_i(x_e) = ${rows.map((m) => t4(m.Ye)).join(', ')}$; contributions $${rows.map((m) => t4(m.y)).join(', ')}$.`,
            `${tier === 1 ? `$DF_2$ = **${f4(DF2)}**. ` : `$|a_1Y_1/a_2Y_2|$ = **${f4(ratio12)}**; mode 1’s share **${f4(share1)} %**. `}**Mode ${dom.i}** dominates (${f3(dom.share * 100)} % of the summed magnitudes)${r > 1 && dom.i === 1 ? ': even above $\\omega_1$, the stiffness penalty $1/(\\beta_iL)^4$ keeps mode 1 ahead' : ''}.`,
          ],
        };
      }
      // tier 3: forcing near a higher mode (helicopter-blade style), five modes
      let xe = 0.8;
      let r = 32;
      for (let tries = 0; tries < 40; tries++) {
        const kM = rng.pick([2, 3, 4]);
        const xc = rng.pick([0.6, 0.7, 0.8, 0.9, 1]);
        const q = rng.pick([0.9, 0.93, 0.95]);
        if (Math.abs(modeShape(CF, kM, xc)) < 0.5) continue;
        xe = xc;
        r = Number((ratioTrick(CF, kM) * q).toFixed(2));
        break;
      }
      const rows = modalTable(CF, [{ xi: xe }], r, 1, 5);
      const dom = dominant(rows);
      const tot = sum(rows.map((m) => Math.abs(m.y)));
      const dm = rows[dom.i - 1];
      return {
        prompt: `A helicopter blade is modelled as a non-rotating uniform cantilever. A flutter force acts at ${xe === 1 ? 'the tip' : posL(xe)} at $\\Omega = ${r}\\,\\omega_1$; an accelerometer sits at the tip. Consider modes 1–5.`,
        givens: [
          { sym: 'x_e', value: `${posL(xe)}` },
          { sym: '\\Omega/\\omega_1', value: `${r}` },
        ],
        parts: [
          {
            kind: 'choice',
            id: 'dom',
            label: 'Which mode dominates the tip response?',
            options: rows.map((m) => ({ text: `mode ${m.i}`, correct: m.i === dom.i, why: `$\\Omega/\\omega_${m.i}$ = ${f3(m.r)}, dynamic factor ${f3(m.DF)}, $Y_${m.i}(x_e)$ = ${f3(m.Ye)}: ${f3((Math.abs(m.y) / tot) * 100)} % of the total.` })),
          },
          { kind: 'numeric', id: 'share', label: 'Its share of $\\sum_{i=1}^5|a_iY_i(L)|$', answer: dom.share * 100, unit: '%', tol: 0.03 },
          { kind: 'numeric', id: 'DF', label: 'Its dynamic factor', answer: dm.DF, unit: '', traps: traps(dm.DF, [{ value: 1 / (1 - dm.r), message: 'Square the frequency ratio.', trapId: 'sqrt' }]) },
        ],
        hints: [
          'At high forcing frequency the low modes are inertia-controlled (tiny negative dynamic factors) while a mode just above Ω is near resonance. The winner is the near-resonant mode unless the force sits near its node.',
          'Cantilever $\\omega_i/\\omega_1$ = 1, 6.267, 17.55, 34.39, 56.84. Compare $|Y_i(x_e)\\,Y_i(L)\\,DF_i/(\\beta_iL)^4|$.',
          `$\\Omega/\\omega_i$ = ${rows.map((m) => f3(m.r)).join(', ')}; dynamic factors ${rows.map((m) => f3(m.DF)).join(', ')}; $Y_i(x_e)$ = ${rows.map((m) => f3(m.Ye)).join(', ')}.`,
          `**Mode ${dom.i}**, with **${f4(dom.share * 100)} %** of the summed magnitudes and dynamic factor **${f4(dm.DF)}**. (Centrifugal stiffening of a real rotor would shift these frequencies; the exam uses the non-rotating model.)`,
        ],
      };
    },
  },

  // ------------------------------------------------------------------ the aᵢ table (LB6 Ex 9.3, Sample problem 4, W7.4(b))
  {
    id: 'b4-modal-table',
    title: 'Modal amplitudes aᵢ: build the table',
    summary: '$a_i = \\dfrac{1}{(\\beta_iL)^4}\\dfrac{PL^3}{EI}\\dfrac{Y_i(x_e)}{1-\\Omega^2/\\omega_i^2}$, then $y = \\sum a_iY_i(x)$ with signs.',
    tiers: [1, 2, 3],
    source: 'Similar to LB6 Example 9.3, sample problem 4, Exam 2000 Q4(c) and W7.4(b) (reader); Week 9 Q1',
    cardId: 'b4-modal',
    marks: 4,
    generate(rng, tier) {
      if (tier === 1) {
        const bc = rng.pick([CF, PP]);
        const xe = bc === CF ? rng.pick([0.3, 0.5, 0.6, 0.7, 0.8, 1]) : rng.pick([0.25, 0.3, 0.5, 0.6, 0.7]);
        const r = rng.pick([0.2, 0.5, 0.8, 1.5, 2, 4]);
        const row = modalTable(bc, [{ xi: xe }], r, 1, 1)[0];
        return {
          prompt: `A ${BC_NAME[bc]} beam carries a harmonic force $P\\sin\\Omega t$ at ${xe === 1 ? 'the tip' : posL(xe)} with $\\Omega = ${r}\\,\\omega_1$.`,
          givens: [
            { sym: 'x_e', value: `${posL(xe)}` },
            { sym: '\\Omega/\\omega_1', value: `${r}` },
          ],
          parts: [
            { kind: 'numeric', id: 'Y', label: `Normalised $Y_1(x_e)$`, answer: row.Ye, unit: '', traps: traps(row.Ye, [{ value: bc === PP ? Math.sin(Math.PI * xe) : -row.Ye, message: bc === PP ? 'Normalised: $Y_1 = \\sqrt2\\sin(\\pi x/L)$.' : 'Sign: mode 1 is positive along the cantilever.' }]) },
            { kind: 'numeric', id: 'DF', label: 'Dynamic factor $1/(1-\\Omega^2/\\omega_1^2)$', answer: row.DF, unit: '', traps: traps(row.DF, [{ value: -row.DF, message: 'Below $\\omega_1$ it is positive; above, negative.', trapId: 'sign' }, { value: 1 / (1 - r), message: 'Square the ratio.', trapId: 'sqrt' }]) },
            {
              kind: 'numeric',
              id: 'a1',
              label: '$a_1$ in units of $PL^3/EI$',
              answer: row.a,
              unit: '',
              traps: traps(row.a, [
                { value: row.Ye / row.bL4, message: 'Dynamic factor missing.' },
                { value: (row.Ye * row.DF) / row.bL ** 2, message: 'The modal stiffness factor is $1/(\\beta_1L)^4$, not $1/(\\beta_1L)^2$.' },
                { value: -row.a, message: 'Sign: keep the sign of the dynamic factor.', trapId: 'sign' },
              ]),
            },
          ],
          hints: [
            'The boxed LB6 result: $a_i = \\dfrac{1}{(\\beta_iL)^4}\\cdot\\dfrac{PL^3}{EI}\\cdot\\dfrac{1}{1-\\Omega^2/\\omega_i^2}\\cdot Y_i(x_e)$, with the handout normalisation $\\int Y^2 dx = L$.',
            bc === PP ? '$\\beta_1L = \\pi$, $Y_1 = \\sqrt2\\sin(\\pi x/L)$.' : '$\\beta_1L = 1.8751$, $Y_1 = \\cosh\\beta x - \\cos\\beta x - 0.7341(\\sinh\\beta x - \\sin\\beta x)$.',
            `$(\\beta_1L)^4 = ${t4(row.bL4)}$, $Y_1(${posL(xe)}) = ${t4(row.Ye)}$, dynamic factor $1/(1-${r}^2) = ${t4(row.DF)}$.`,
            `$Y_1$ = **${f4(row.Ye)}**, dynamic factor **${f4(row.DF)}**, $a_1 = ${t4(row.Ye)} \\times ${tp(row.DF)}/${t4(row.bL4)} = $ **${f4(row.a)}** $PL^3/EI$${r > 1 ? ' (negative: out of phase above ω₁)' : ''}.`,
          ],
        };
      }
      if (tier === 2) {
        const c = rng.pick([
          { bc: CF, xe: rng.pick([0.5, 0.6, 0.7, 0.8]), r: rng.pick([0.5, 2, 4, 8, 10]), xo: 1, out: 'the tip' },
          { bc: PP, xe: rng.pick([0.3, 0.6]), r: rng.pick([0.2, 2, 5]), xo: 0.5, out: 'mid-span' },
          { bc: 'clamped-clamped' as BeamBC, xe: 0.5, r: rng.pick([1 / 3, 2]), xo: 0.5, out: 'mid-span' },
        ]);
        const rows = modalTable(c.bc, [{ xi: c.xe }], c.r, c.xo, 3);
        const yOut = sum(rows.map((m) => m.y));
        const amax = Math.max(...rows.map((m) => Math.abs(m.a)));
        const third = Math.abs(c.r - 1 / 3) < 1e-9;
        const rs = third ? '\\tfrac13' : String(c.r);
        const parts: SolvePart[] = rows.map((m) => ({
          kind: 'numeric' as const,
          id: `a${m.i}`,
          label: `$a_${m.i}$ ($PL^3/EI$)`,
          answer: m.a,
          unit: '',
          tol: 0.025,
          absTol: 1e-7 * amax,
          traps: traps(
            m.a,
            [
              { value: m.Ye / m.bL4, message: 'Dynamic factor missing.' },
              { value: (m.Yout * m.DF) / m.bL4, message: 'Use $Y_i$ at the **force** point; the output value multiplies afterwards.', trapId: 'b4-wrong-point' },
              { value: -m.a, message: 'Sign of the dynamic factor (negative above $\\omega_i$).', trapId: 'sign' },
            ],
            0.03,
            1e-6 * amax
          ),
        }));
        parts.push({
          kind: 'numeric',
          id: 'y',
          label: `Response at ${c.out}, $\\sum a_iY_i(x_{out})$ ($PL^3/EI$)`,
          answer: yOut,
          unit: '',
          tol: 0.025,
          traps: traps(yOut, [{ value: rows.reduce((s, m) => s + Math.abs(m.y), 0), message: 'Add the contributions with their signs.', trapId: 'b4-signs' }, { value: sum(rows.map((m) => m.a)), message: 'Multiply each $a_i$ by $Y_i(x_{out})$ before adding.', trapId: 'b4-wrong-point' }]),
        });
        return {
          prompt: `A ${BC_NAME[c.bc]} beam carries a harmonic force $P\\sin\\Omega t$ at ${posL(c.xe)} with $\\Omega = ${rs}\\,\\omega_1$. Build the modal table for modes 1–3 and find the response at ${c.out} (exact constants; table constants agree within about 2 %).`,
          givens: [
            { sym: 'x_e', value: `${posL(c.xe)}` },
            { sym: '\\Omega/\\omega_1', value: third ? '1/3' : String(c.r) },
            { sym: 'x_{out}', value: `${posL(c.xo)}` },
          ],
          parts,
          hints: [
            `Three factors per mode times the force point’s mode value: $a_i = Y_i(x_e)\\,DF_i/(\\beta_iL)^4$ in $PL^3/EI$. ${c.bc !== CF && c.xe === 0.5 ? 'A force at mid-span of a symmetric beam is at a node of every even mode.' : ''}`,
            `$\\omega_i/\\omega_1 = (\\beta_iL/\\beta_1L)^2$ = ${rows.map((m) => f4(m.wr)).join(', ')}; $DF_i = 1/(1-(\\Omega/\\omega_i)^2)$; $y = \\sum a_iY_i(x_{out})$ with signs.`,
            `$(\\beta_iL)^4$ = ${rows.map((m) => f4(m.bL4)).join(', ')}; $Y_i(x_e)$ = ${rows.map((m) => f4(m.Ye)).join(', ')}; $DF_i$ = ${rows.map((m) => f4(m.DF)).join(', ')}; $Y_i(x_{out})$ = ${rows.map((m) => f4(m.Yout)).join(', ')}.`,
            `${rows.map((m) => `$a_${m.i}$ = **${f4(m.a)}**`).join(', ')}; $y = ${sumTeX(rows.map((m) => m.y))} = $ **${f4(yOut)}** $PL^3/EI$.`,
          ],
        };
      }
      // tier 3: physical units (reader W7.4(b))
      const E = 210e9;
      const rho = 7850;
      const I = rng.step(1, 3, 0.1) * 1e-5;
      const A = rng.step(1.5, 4, 0.1) * 1e-3;
      const L = rng.pick([6, 8, 10, 12]);
      const P = rng.pick([1, 2, 5]);
      const xi = rng.pick([0.3, 0.6, 0.7]);
      const xB = rng.pick([0.5, 0.7]);
      const w1 = Math.PI ** 2 * Math.sqrt((E * I) / (rho * A * L ** 4));
      const Om = Math.round(w1 * rng.pick([0.5, 1.5, 1.9, 2.5]));
      const r = Om / w1;
      const PL3 = (P * 1000 * L ** 3) / (E * I); // m
      const row = modalTable(PP, [{ xi }], r, xB, 1)[0];
      const yB = row.y * PL3 * 1000; // mm
      return {
        prompt: `A simply supported steel beam ($E$ = 210 GPa, $\\rho$ = 7850 kg/m³, $I$ = ${f3(I * 1e5)}×10⁻⁵ m⁴, $A$ = ${f3(A * 1e3)}×10⁻³ m², span ${L} m) carries a force $${P}\\sin(${Om}t)$ kN ($t$ in s) at ${f3(xi * L)} m from the left support. Find the mode-1 contribution to the vibration at ${f3(xB * L)} m from the left support.`,
        givens: [
          { sym: 'I', value: `${f3(I * 1e5)}×10⁻⁵ m⁴` },
          { sym: 'A', value: `${f3(A * 1e3)}×10⁻³ m²` },
          { sym: 'L', value: `${L} m` },
          { sym: 'P', value: `${P} kN` },
          { sym: '\\Omega', value: `${Om} rad/s` },
        ],
        parts: [
          { kind: 'numeric', id: 'w1', label: 'First natural frequency $\\omega_1$', answer: w1, unit: 'rad/s', freq: true, traps: traps(w1, [{ value: w1 * Math.sqrt(A), message: 'Use $\\rho A$, the mass per unit length.', trapId: 'b3-rho-vs-rhoA' }]) },
          { kind: 'numeric', id: 'PL3', label: 'Static scale $PL^3/EI$', answer: PL3 * 1000, unit: 'mm', traps: traps(PL3 * 1000, [{ value: PL3, message: 'Give it in mm.', trapId: 'unit-scale' }]) },
          {
            kind: 'numeric',
            id: 'yB',
            label: 'Mode-1 contribution $a_1Y_1(x_B)$',
            answer: yB,
            unit: 'mm',
            traps: traps(yB, [
              { value: -yB, message: 'Above $\\omega_1$ the dynamic factor is negative.', trapId: 'sign' },
              { value: (yB * (1 - r * r)) , message: 'Dynamic factor missing.' },
              { value: yB / modeShape(PP, 1, xB), message: 'Multiply $a_1$ by $Y_1(x_B)$ for the response at B.', trapId: 'b4-wrong-point' },
            ]),
          },
        ],
        hints: [
          'Physical units: get $\\omega_1$ from the section, the frequency ratio, the static scale $PL^3/EI$, then the boxed $a_1$ and multiply by $Y_1$ at the output point.',
          '$\\omega_1 = \\pi^2\\sqrt{EI/(\\rho A L^4)}$; $a_1 = \\dfrac{1}{\\pi^4}\\dfrac{PL^3}{EI}\\dfrac{\\sqrt2\\sin(\\pi x_e/L)}{1-(\\Omega/\\omega_1)^2}$; contribution $a_1\\sqrt2\\sin(\\pi x_B/L)$.',
          `$\\omega_1 = ${t4(w1)}$ rad/s, $\\Omega/\\omega_1 = ${t4(r)}$, $PL^3/EI = ${t4(PL3)}$ m; $Y_1(x_e) = ${t4(row.Ye)}$, $Y_1(x_B) = ${t4(row.Yout)}$, dynamic factor $${t4(row.DF)}$.`,
          `$\\omega_1$ = **${f4(w1)} rad/s**; $PL^3/EI$ = **${f4(PL3 * 1000)} mm**; $a_1 = ${t4(PL3 * 1000)} \\times ${t4(row.Ye)} \\times ${tp(row.DF)}/${t4(row.bL4)} = ${t4(row.a * PL3 * 1000)}$ mm, so at B: **${f4(yB)} mm**${r > 1 ? ' (out of phase with the force)' : ''}.`,
        ],
      };
    },
  },

  // ------------------------------------------------------------------ machine at mid-span of a clamped–clamped beam (reader W7.7, Exam 2008)
  {
    id: 'b4-machine-beam',
    title: 'Machine at mid-span of a clamped–clamped beam',
    summary: 'Size $I/A$ for a critical-speed margin, then $I$ and $A$ so the unbalance response stays below a limit. Mid-span is a node of every even mode.',
    tiers: [1, 2, 3],
    source: 'Similar to reader W7.7 (Exam 2008) and 2023 B1.3–B1.4',
    cardId: 'b4-design',
    marks: 6,
    sprint: false,
    generate(rng, tier) {
      const E = 200e9;
      const rho = 7800;
      const b1 = betaL(CC, 1)[0];
      const Ymid = modeShape(CC, 1, 0.5);
      if (tier === 1) {
        const r = rng.pick([0.2, 0.25, 1 / 3, 0.4, 0.5]);
        const rs = Math.abs(r - 1 / 3) < 1e-9 ? '1/3' : String(r);
        const row = modalTable(CC, [{ xi: 0.5 }], r, 0.5, 1)[0];
        return {
          prompt: `A machine with a rotating unbalance sits at mid-span of a uniform beam clamped at both ends. It runs at $\\Omega = ${rs}\\,\\omega_1$. Find the mode-1 contribution to the mid-span amplitude in units of $PL^3/EI$, and say which modes respond at all.`,
          givens: [{ sym: '\\Omega/\\omega_1', value: rs }],
          parts: [
            {
              kind: 'numeric',
              id: 'S1',
              label: 'Mode-1 factor $a_1Y_1(L/2)$ in units of $PL^3/EI$',
              answer: row.y,
              unit: '',
              traps: traps(row.y, [
                { value: row.y * (1 - r * r), message: 'Include the dynamic factor $1/(1-\\Omega^2/\\omega_1^2)$.' },
                { value: row.a, message: 'That is $a_1$. The amplitude at mid-span is $a_1Y_1(L/2)$: the mode value appears twice (load and output).', trapId: 'b4-wrong-point' },
                { value: (row.Ye * row.Yout * row.DF) / (b1 * b1), message: 'The modal stiffness factor is $1/(\\beta_1L)^4 = 1/500.6$, not $1/(\\beta_1L)^2$.', trapId: 'sqrt' },
              ]),
            },
            {
              kind: 'choice',
              id: 'modes',
              label: 'Which modes contribute to the mid-span response?',
              options: [
                { text: 'Only the odd (symmetric) modes 1, 3, 5, …', correct: true, why: 'Even modes are antisymmetric with a node at mid-span: $Y_i(L/2) = 0$, so the force does no work on them and they are not seen there either.' },
                { text: 'All modes, each a little less than the one before', correct: false, why: 'A force at a node of mode $i$ gives $a_i = 0$ exactly.' },
                { text: 'Only the even modes', correct: false, why: 'Upside down: the even modes are the ones with a node at mid-span.' },
                { text: 'Only mode 1', correct: false, why: 'Modes 3, 5, … are excited too ($|Y_3(L/2)|$ = 1.41), just much less: they are stiffer.' },
              ],
            },
          ],
          hints: [
            'Clamped–clamped: $\\beta_1L$ = 4.730, and mode 1 is symmetric with $Y_1(L/2)$ = 1.588 (handout normalisation). The force and the output are both at mid-span, so $Y_1(L/2)$ appears twice.',
            '$a_1Y_1(L/2) = \\dfrac{Y_1(L/2)^2}{(\\beta_1L)^4}\\cdot\\dfrac{1}{1-\\Omega^2/\\omega_1^2}$ in $PL^3/EI$.',
            `$Y_1(L/2)^2 = ${t4(Ymid * Ymid)}$, $(\\beta_1L)^4 = ${t4(b1 ** 4)}$, dynamic factor $1/(1-(${rs})^2) = ${t4(row.DF)}$.`,
            `$a_1Y_1(L/2) = ${t4(Ymid * Ymid)} \\times ${t4(row.DF)}/${t4(b1 ** 4)} = $ **${f4(row.y)}** $PL^3/EI$. Only the **odd modes** respond: every even mode has a node at mid-span. (Static check: all odd modes together give 1/192 = 0.005208 at Ω → 0.)`,
          ],
        };
      }
      // Ranges around the reader's case (L = 3 m, 1800 rpm, ×3, mr = 1 kg m, 1 mm), which keep the section realistic.
      const L = rng.step(2, 5, 0.5);
      const N = rng.pick([900, 1200, 1500, 1800, 2400]);
      const n = rng.pick([2, 2.5, 3]);
      const mr = rng.pick([0.2, 0.5, 1, 2]); // kg m
      const ylim = rng.pick([0.5, 1, 2]); // mm
      const Om = (TAU * N) / 60;
      const w1 = n * Om;
      const IA = ((w1 * L * L) / (b1 * b1)) ** 2 * (rho / E);
      const P = mr * Om * Om;
      const r = 1 / n;
      const rows = modalTable(CC, [{ xi: 0.5 }], r, 0.5, 3);
      const S1 = rows[0].y;
      const S3 = sum(rows.map((m) => m.y));
      const S = tier === 3 ? S3 : S1;
      const Sstatic = tier === 3 ? responseFactor(CC, [{ xi: 0.5 }], 0, 0.5, 3) : (Ymid * Ymid) / b1 ** 4;
      const I = (S * P * L ** 3) / (ylim / 1000) / E;
      const A = I / IA;
      const parts: SolvePart[] = [
        {
          kind: 'numeric',
          id: 'IA',
          label: 'Minimum $I/A$ for the critical-speed margin',
          answer: IA,
          unit: 'm²',
          traps: traps(IA, [
            { value: IA / (n * n), message: `Apply the margin: $\\omega_1 \\ge ${n}\\,\\Omega$, and $I/A \\propto \\omega_1^2$.`, trapId: 'b3-margin' },
            { value: IA * (60 / TAU) ** 2, message: 'Use Ω in rad/s ($2\\pi N/60$), not rpm.', trapId: 'units' },
            { value: IA * b1 * b1, message: 'Square $\\beta_1L$ inside the bracket: $\\omega_1 = (4.730)^2\\sqrt{EI/(\\rho A L^4)}$.', trapId: 'b3-ratio-not-squared' },
            { value: Math.sqrt(IA), message: 'That is $\\sqrt{I/A}$ (the radius of gyration). Square it.', trapId: 'sqrt' },
          ]),
        },
        { kind: 'numeric', id: 'P', label: 'Unbalance force amplitude $P = mr\\,\\Omega^2$', answer: P, unit: 'N', traps: traps(P, [{ value: mr * Om, message: 'Square Ω.', trapId: 'unbalance-omega2' }, { value: mr * (N / 60) ** 2, message: 'Ω in rad/s, not rev/s.', trapId: 'units' }]) },
        {
          kind: 'numeric',
          id: 'I',
          label: tier === 3 ? 'Minimum $I$ using modes 1–3' : 'Minimum $I$ (mode 1 only, as in the reader)',
          answer: I,
          unit: 'm⁴',
          traps: traps(I, [
            { value: (I * Sstatic) / S, message: `Dynamic factors missing: the design point is $\\Omega = \\omega_1/${n}$, not static.` },
            { value: I / Ymid, message: 'Both the force and the output are at mid-span: $Y_1(L/2)$ appears twice.', trapId: 'b4-wrong-point' },
            { value: I / 1000, message: 'The limit must be in metres.', trapId: 'unit-scale' },
            ...(tier === 3 ? [{ value: (I * S1) / S3, message: 'That is the mode-1-only value. Add mode 3 (mode 2 is zero at mid-span).' }] : []),
          ]),
        },
        { kind: 'numeric', id: 'A', label: 'Corresponding area $A = I/(I/A)$', answer: A, unit: 'm²', traps: traps(A, [{ value: I * IA, message: 'Divide: $A = I/(I/A)$.' }]) },
      ];
      if (tier === 3)
        parts.push({
          kind: 'choice',
          id: 'inertia',
          label: 'If the machine’s own inertia were included, the required $I$ and $A$ would…',
          options: [
            { text: 'increase: the machine lowers $\\omega_1$, so $\\Omega/\\omega_1$ rises and so does the dynamic factor', correct: true, why: 'Reader W7.7(c). A mass at mid-span adds kinetic energy to mode 1 (an antinode), lowering $\\omega_1$; the margin shrinks and the response grows.' },
            { text: 'not change, because the machine sits at a node', correct: false, why: 'Mid-span is a node of the even modes only; mode 1 has its largest motion there.' },
            { text: 'decrease, because extra mass reduces the vibration', correct: false, why: 'Below resonance, extra mass at an antinode moves $\\omega_1$ towards Ω and increases the response.' },
          ],
        });
      return {
        prompt: `A machine is mounted at mid-span of a steel beam ($E$ = 200 GPa, $\\rho$ = 7800 kg/m³) clamped between two massive posts ${L} m apart. It runs at ${N} rpm. (a) Find the minimum $I/A$ so the lowest critical speed is at least ${n} times the running speed (neglect the machine’s inertia). (b) The machine has an unbalance $mr$ = ${mr} kg m. Find the $I$ and $A$ that keep the vibration amplitude below ${ylim} mm${tier === 3 ? ', using modes 1–3' : ', using mode 1 only'}.`,
        givens: [
          { sym: 'E', value: '200 GPa' },
          { sym: '\\rho', value: '7800 kg/m³' },
          { sym: 'L', value: `${L} m` },
          { sym: 'N', value: `${N} rpm` },
          { sym: 'n', value: `${n}`, label: 'margin' },
          { sym: 'mr', value: `${mr} kg m` },
          { sym: 'y_{lim}', value: `${ylim} mm` },
        ],
        parts,
        hints: [
          'Two linked designs: the margin fixes $\\omega_1$ and so $I/A$ (frequencies depend on the section only through $I/A$); the amplitude limit then fixes $EI$, and $A$ follows from $I/A$. The force and output are both at mid-span, a node of every even mode.',
          `$\\omega_1 = ${n}\\,\\Omega = (\\beta_1L)^2\\sqrt{\\dfrac{E}{\\rho}\\dfrac{I}{A}}\\dfrac{1}{L^2} \\Rightarrow \\dfrac{I}{A} = \\left(\\dfrac{\\omega_1L^2}{(\\beta_1L)^2}\\right)^2\\dfrac{\\rho}{E}$; $y = S\\,\\dfrac{PL^3}{EI}$ with $S = \\sum a_iY_i(L/2)$ per $PL^3/EI$, $\\Omega/\\omega_1 = 1/${n}$.`,
          `$\\Omega = ${t4(Om)}$ rad/s, $\\omega_1 = ${t4(w1)}$ rad/s; $P = ${mr} \\times ${t4(Om)}^2 = ${t4(P)}$ N; ${tableTeX(tier === 3 ? rows : rows.slice(0, 1))}; $Y_i(L/2)$ = ${rows.map((m) => f3(m.Yout)).join(', ')}.`,
          `$I/A$ = **${f4(IA)} m²**; $P$ = **${f4(P)} N**; $S = ${tier === 3 ? sumTeX(rows.map((m) => m.y)) + ' = ' : ''}${t4(S)}$, so $I = SPL^3/(E\\,y_{lim}) = ${t4(S)} \\times ${t4(P)} \\times ${L}^3/(2 \\times 10^{11} \\times ${tp(ylim / 1000)}) = $ **${f4(I)} m⁴** and $A = I/(I/A)$ = **${f4(A)} m²**${tier === 3 ? ` (mode 1 alone gives ${f4((I * S1) / S3)} m⁴: the reader’s W7.7 answer used mode 1 only)` : ''}.`,
        ],
      };
    },
  },
];
