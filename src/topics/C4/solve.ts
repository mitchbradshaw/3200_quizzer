// C4 problem generators: isolator design by static sag, checking installed mounts (running and start-up),
// strategy chains, and absorber sizing (the A4 link, kept short). Numbers are randomised within the ranges
// the papers use; hints walk concept -> set-up -> substitution -> worked solution with the same numbers.
import type { SolveGenerator, SolvePart } from '../../engine/types';
import { isolationRatioFor, magnification, transmissibility } from '../../physics/sdof';
import { muFromRatio, tunedRatios } from '../../physics/absorber';
import { G, TWO_PI } from '../../physics/units';
import { choice, f3, f4, num } from './util';
import { peakExcursion, tunedResidual } from './physics';

const pctTxt = (T: number) => `${Math.round(T * 100)} %`;

export const generators: SolveGenerator[] = [
  // ------------------------------------------------------------------ isolator design
  {
    id: 'c4-isolator',
    title: 'Isolator design by static sag',
    summary: 'From a target transmissibility to the frequency ratio, mount frequency, static sag, stiffness and mount type; then the start-up check.',
    tiers: [1, 2, 3],
    source: 'Isolator sizing, LC4.5 and LA7-1 to 7-3; similar to 2022 A1.1 (k ≤ mω²/11) and official 2017–2019 A3.7',
    cardId: 'c4-isolation',
    generate(rng, tier) {
      if (tier === 1) {
        const N = rng.pick([600, 900, 1200, 1450, 1500, 1800, 2400, 2900, 3000]);
        const Tt = rng.pick([0.05, 0.1, 0.15, 0.2, 0.25]);
        const W = (TWO_PI * N) / 60;
        const r2 = 1 + 1 / Tt;
        const d = ((G * r2) / (W * W)) * 1000;
        return {
          prompt: `A machine running at ${N} rpm is to stand on undamped mounts that transmit at most ${pctTxt(Tt)} of its vibration force ($T \\le$ ${Tt}).`,
          givens: [
            { sym: 'N', value: `${N} rpm`, label: 'running speed' },
            { sym: 'T', value: `${Tt}`, label: 'largest transmissibility' },
          ],
          parts: [
            num({
              id: 'd',
              label: 'Smallest static deflection of the mounts $\\delta_{st}$',
              answer: d,
              unit: 'mm',
              traps: [
                { value: ((G / Tt) / (W * W)) * 1000, message: 'You used $T \\approx 1/r^2$. Undamped, $T = 1/(r^2 - 1)$, so $r^2 = 1 + 1/T$.' },
                { value: ((2 * G) / (W * W)) * 1000, message: 'That is $r = \\sqrt2$, where $T = 1$: only the start of isolation. For $T$ = ' + Tt + ' you need $r^2 = 1 + 1/T$.' },
                { value: ((G * r2) / (N / 60) ** 2) * 1000, message: 'Use $\\Omega$ in rad/s ($2\\pi N/60$), not Hz.', trapId: 'units' },
                { value: ((G * Math.sqrt(r2)) / (W * W)) * 1000, message: '$\\delta_{st} = g/\\omega_n^2$ needs $r^2$, not $r$: $\\delta_{st} = g r^2/\\Omega^2$.', trapId: 'sqrt' },
              ],
            }),
          ],
          hints: [
            'An undamped isolator transmits $T = 1/(r^2 - 1)$ for $r > \\sqrt2$; the mount’s natural frequency follows from its static sag, $\\omega_n = \\sqrt{g/\\delta_{st}}$.',
            '$r^2 = 1 + 1/T$, $\\omega_n \\le \\Omega/r$, so $\\delta_{st} = g/\\omega_n^2 \\ge g r^2/\\Omega^2$ with $\\Omega = 2\\pi N/60$.',
            `$r^2 = 1 + 1/${Tt} = ${f4(r2)}$; $\\Omega = 2\\pi(${N})/60 = ${f4(W)}$ rad/s.`,
            `$\\delta_{st} \\ge 9.81 \\times ${f4(r2)}/${f4(W)}^2 = ${f4(d / 1000)}$ m = **${f4(d)} mm** (mount frequency at most ${f4(W / Math.sqrt(r2) / TWO_PI)} Hz).`,
          ],
        };
      }
      if (tier === 2) {
        // Pick until the static sag falls clearly in one mount family (rubber ≤ 6 mm, steel 25–125 mm, air 150–250 mm).
        let N = 1500;
        let Tt = 0.1;
        let z = 0.05;
        let r = 0;
        let d = 0;
        for (let i = 0; i < 60; i++) {
          N = rng.pick([600, 900, 1200, 1450, 1500, 1800, 2900, 3000]);
          Tt = rng.pick([0.02, 0.05, 0.1, 0.2, 0.3]);
          z = rng.pick([0.02, 0.05, 0.1]);
          r = isolationRatioFor(Tt, z);
          d = ((G * r * r) / ((TWO_PI * N) / 60) ** 2) * 1000;
          if (d <= 5.5 || (d >= 25 && d <= 115) || (d >= 150 && d <= 250)) break;
        }
        const m = rng.step(80, 1200, 20);
        const W = (TWO_PI * N) / 60;
        const wn = W / r;
        const fn = wn / TWO_PI;
        const k = m * wn * wn;
        const r0 = Math.sqrt(1 + 1 / Tt);
        const fam = d <= 6 ? 'rubber' : d <= 125 ? 'steel' : 'air';
        return {
          prompt: `A ${m} kg machine runs at ${N} rpm. Its mounts will have a damping ratio of about ${z}, and must transmit at most ${pctTxt(Tt)} of its vibration force to the floor. Size the mounts.`,
          givens: [
            { sym: 'm', value: `${m} kg` },
            { sym: 'N', value: `${N} rpm` },
            { sym: '\\zeta', value: `${z}` },
            { sym: 'T', value: `${Tt}`, label: 'largest transmissibility' },
          ],
          parts: [
            num({
              id: 'r',
              label: 'Smallest frequency ratio $r$ that gives this $T$ (with damping)',
              answer: r,
              unit: '',
              tol: 0.02,
              traps: [
                { value: r0, message: 'That ignores the damping. With $\\zeta$ > 0 the numerator $1 + (2\\zeta r)^2$ makes $T$ larger, so a larger $r$ is needed: solve $T(r, \\zeta) = T$.', trapId: 'damping-above-root2' },
                { value: Math.sqrt(1 / Tt), message: '$T \\approx 1/r^2$ drops the −1 and the damping.' },
              ],
            }),
            num({ id: 'fn', label: 'Largest mount natural frequency $f_n$', answer: fn, unit: 'Hz', freq: true }),
            num({ id: 'd', label: 'Smallest static sag $\\delta_{st}$', answer: d, unit: 'mm', traps: [{ value: ((G * r) / (W * W)) * 1000, message: 'Use $r^2$: $\\delta_{st} = g r^2/\\Omega^2$.', trapId: 'sqrt' }] }),
            num({ id: 'k', label: 'Largest total mount stiffness $k$', answer: k / 1000, unit: 'kN/m', traps: [{ value: (m * fn * fn) / 1000, message: '$k = m\\omega_n^2$ needs $\\omega_n$ in rad/s.', trapId: 'units' }] }),
            choice('type', 'Which kind of mount gives that static sag?', [
              { text: 'Rubber pads (static sag up to about 6 mm)', correct: fam === 'rubber', why: fam === 'rubber' ? `${f3(d)} mm is within rubber’s range.` : `Rubber gives at most about 6 mm; you need ${f3(d)} mm.` },
              { text: 'Steel coil springs (about 25–125 mm)', correct: fam === 'steel', why: fam === 'steel' ? `${f3(d)} mm is typical of steel coil springs.` : fam === 'rubber' ? 'Far softer than needed: more sag than required, and more sway.' : `Steel coils reach about 125 mm; ${f3(d)} mm calls for air springs.` },
              { text: 'Air springs (about 200 mm)', correct: fam === 'air', why: fam === 'air' ? `${f3(d)} mm of equivalent sag: only air springs are that soft without buckling.` : 'Much softer than needed.' },
            ]),
          ],
          hints: [
            `Force transmission uses $T = \\sqrt{\\dfrac{1+(2\\zeta r)^2}{(1-r^2)^2+(2\\zeta r)^2}}$. With damping, the required $r$ is a little larger than the undamped $\\sqrt{1 + 1/T}$ = ${f4(r0)}.`,
            'Solve $T(r, \\zeta) = T$ for $r$ (a quadratic in $u = r^2$: $T^2[(1-u)^2 + 4\\zeta^2u] = 1 + 4\\zeta^2u$), then $\\omega_n = \\Omega/r$, $\\delta_{st} = g/\\omega_n^2$, $k = m\\omega_n^2$.',
            `$\\Omega = 2\\pi(${N})/60 = ${f4(W)}$ rad/s; $r = ${f4(r)}$; $\\omega_n = ${f4(W)}/${f4(r)} = ${f4(wn)}$ rad/s.`,
            `$r$ = **${f4(r)}**; $f_n = ${f4(wn)}/2\\pi$ = **${f4(fn)} Hz**; $\\delta_{st} = 9.81/${f4(wn)}^2$ = **${f4(d)} mm**; $k = ${m} \\times ${f4(wn)}^2$ = **${f4(k / 1000)} kN/m**, so **${fam === 'rubber' ? 'rubber pads' : fam === 'steel' ? 'steel coil springs' : 'air springs'}**.`,
          ],
        };
      }
      // tier 3: start-up check of a mounted machine
      const M = rng.step(200, 1000, 50);
      const me = rng.pick([0.02, 0.05, 0.1]);
      const N = rng.pick([1450, 1500, 2900, 3000]);
      const dm = rng.pick([10, 15, 20, 25, 40]);
      const z = rng.pick([0.02, 0.03, 0.05]);
      const W = (TWO_PI * N) / 60;
      const wn = Math.sqrt(G / (dm / 1000));
      const r = W / wn;
      const T = transmissibility(r, z);
      const FT = me * W * W * T;
      const Xp = 1000 * (me / M) * peakExcursion(z);
      const T5 = transmissibility(r, 0.5);
      return {
        prompt: `A ${M} kg machine with an unbalance $me$ = ${me} kg m runs at ${N} rpm on steel springs that sag ${dm} mm, with damping ratio ${z}. Check the design at speed and during start-up.`,
        givens: [
          { sym: 'M', value: `${M} kg` },
          { sym: 'me', value: `${me} kg m`, label: 'unbalance' },
          { sym: 'N', value: `${N} rpm` },
          { sym: '\\delta_{st}', value: `${dm} mm` },
          { sym: '\\zeta', value: `${z}` },
        ],
        parts: [
          num({ id: 'FT', label: 'Force reaching the floor at running speed $F_T$', answer: FT, unit: 'N', traps: [{ value: me * W * W, message: 'That is the whole unbalance force $me\\Omega^2$; multiply by $T$.' }, { value: me * W * W * magnification(r, z), message: 'Force transmission keeps $1 + (2\\zeta r)^2$ in the numerator: use $T$, not the force-response ratio.', trapId: 'force-vs-base' }] }),
          num({ id: 'X', label: 'Largest machine excursion while running up through the mount resonance', answer: Xp, unit: 'mm', tol: 0.03, traps: [{ value: (1000 * me) / M, message: '$me/M$ is the excursion far above resonance. At resonance it is amplified by about $1/2\\zeta$.' }, { value: (1000 * me) / M / z, message: 'The amplification at resonance is $1/(2\\zeta)$, not $1/\\zeta$.', trapId: 'factor2' }] }),
          choice('fix', `The pipework tolerates only a third of that excursion. Which change cures the start-up excursion **without** spoiling the isolation at speed?`, [
            { text: 'An inertia block that triples the mounted mass, with springs re-sized for the same static sag', correct: true, why: `Same sag, same $\\omega_n$ and $T$ at speed; the excursion $(me/M)/2\\zeta$ falls to a third. (It also lowers the centre of mass, LA7.)` },
            { text: 'Stiffer springs', correct: false, why: 'The resonant excursion $(me/M)/2\\zeta$ does not depend on stiffness, and stiffer mounts transmit more at speed.' },
            { text: 'Softer springs', correct: false, why: 'Better isolation at speed, but the excursion at resonance is unchanged: it does not depend on stiffness.' },
            { text: 'Raise the damping ratio to 0.5', correct: false, why: `It does cut the excursion, but at speed $T$ rises from ${f3(T)} to ${f3(T5)}: ${f3(T5 / T)} times more force on the floor.` },
          ]),
        ],
        hints: [
          'At speed the floor receives $me\\Omega^2 T(r, \\zeta)$. Passing through resonance, the machine’s excursion per unit unbalance is $r^2/\\sqrt{(1-r^2)^2+(2\\zeta r)^2}$, which peaks at about $1/2\\zeta$ whatever the stiffness.',
          '$\\omega_n = \\sqrt{g/\\delta_{st}}$, $r = \\Omega/\\omega_n$, $F_T = me\\Omega^2T$; $X_{peak} = (me/M)/(2\\zeta\\sqrt{1-\\zeta^2}) \\approx (me/M)/2\\zeta$.',
          `$\\omega_n = \\sqrt{9.81/${dm / 1000}} = ${f4(wn)}$ rad/s, $\\Omega = ${f4(W)}$ rad/s, $r = ${f4(r)}$, $T = ${f4(T)}$, $me\\Omega^2 = ${f4(me * W * W)}$ N; $me/M = ${f4((1000 * me) / M)}$ mm.`,
          `$F_T = ${f4(me * W * W)} \\times ${f4(T)}$ = **${f4(FT)} N**; $X_{peak} = ${f4((1000 * me) / M)}/(2 \\times ${z})$ ≈ **${f4(Xp)} mm**. To cut it without hurting $T$, raise $M$ (inertia block) at the same sag.`,
        ],
      };
    },
  },

  // ------------------------------------------------------------------ check installed mounts
  {
    id: 'c4-mount-check',
    title: 'Check installed mounts: running and start-up',
    summary: 'Static sag → $f_n$ → $r$ → $T$ → force at speed, then the force passing through resonance, and what more damping does.',
    tiers: [1, 2, 3],
    source: 'Similar to Week 1 Q4 (damped transmissibility) and 2025 A3.5; LC4.5; LA7',
    cardId: 'c4-isolation',
    generate(rng, tier) {
      // Re-pick when r lands within 3 % of √2 (e.g. 5 mm at 600 rpm gives r = 1.419): "does it isolate?"
      // would then hinge on rounding, with T ≈ 1 either way.
      let dm = 10;
      let N = 1200;
      for (let i = 0; i < 20; i++) {
        dm = rng.pick([2, 3, 4, 5, 8, 10, 15, 20, 25, 40, 60]);
        N = rng.pick([600, 900, 1000, 1200, 1450, 1500, 1800, 2400, 3000]);
        if (Math.abs((TWO_PI * N) / 60 / Math.sqrt(G / (dm / 1000)) / Math.SQRT2 - 1) > 0.03) break;
      }
      const wn = Math.sqrt(G / (dm / 1000));
      const fn = wn / TWO_PI;
      const W = (TWO_PI * N) / 60;
      const r = W / wn;
      if (tier === 1) {
        return {
          prompt: `A fan’s mounts compress by ${dm} mm under its weight. It runs at ${N} rpm.`,
          givens: [
            { sym: '\\delta_{st}', value: `${dm} mm` },
            { sym: 'N', value: `${N} rpm` },
          ],
          parts: [
            num({
              id: 'fn',
              label: 'Mount natural frequency $f_n$',
              answer: fn,
              unit: 'Hz',
              freq: true,
              traps: [
                { value: Math.sqrt(G / dm) / TWO_PI, message: '$\\delta_{st}$ must be in metres.', trapId: 'unit-scale' },
                { value: G / (dm / 1000) / TWO_PI, message: 'You forgot the square root: $\\omega_n = \\sqrt{g/\\delta_{st}}$.', trapId: 'static-sag' },
              ],
            }),
            choice('iso', `Do the mounts isolate the fan at ${N} rpm?`, [
              { text: 'Yes: $r > \\sqrt2$, so $T$ < 1', correct: r > Math.SQRT2, why: r > Math.SQRT2 ? `$r = ${f3(W)}/${f3(wn)}$ = ${f3(r)}.` : `No: $r$ = ${f3(r)} is below $\\sqrt2$.` },
              { text: 'No: $r \\le \\sqrt2$, so the mounts transmit as much or more than they receive', correct: r <= Math.SQRT2, why: r <= Math.SQRT2 ? `Below $\\sqrt2$ every mount amplifies (or at best transmits everything). Softer mounts are needed: $f_n < $ ${f3(N / 60 / Math.SQRT2)} Hz.` : `It does: $r$ = ${f3(r)} > $\\sqrt2$.` },
            ]),
          ],
          hints: [
            'The static sag gives the mount frequency; isolation needs the running frequency above $\\sqrt2$ times it.',
            '$\\omega_n = \\sqrt{g/\\delta_{st}}$ ($\\delta_{st}$ in m), $f_n = \\omega_n/2\\pi$; $r = \\Omega/\\omega_n$ with $\\Omega = 2\\pi N/60$.',
            `$\\omega_n = \\sqrt{9.81/${dm / 1000}} = ${f4(wn)}$ rad/s; $\\Omega = ${f4(W)}$ rad/s.`,
            `$f_n$ = **${f4(fn)} Hz**; $r = ${f4(W)}/${f4(wn)} = ${f4(r)}$: ${r > Math.SQRT2 ? `**isolates** ($T$ = ${f3(transmissibility(r, 0))} undamped)` : `**does not isolate** ($T$ = ${f3(transmissibility(r, 0))} undamped)`}.`,
          ],
        };
      }
      // tiers 2-3: damped mounts on a machine with an unbalance
      const M = rng.step(100, 2000, 50);
      const me = rng.pick([0.01, 0.02, 0.05, 0.1, 0.2]);
      const z = rng.pick([0.02, 0.05, 0.08, 0.1, 0.15]);
      const dd = rng.pick([15, 20, 25, 40, 60, 100]);
      const wn2 = Math.sqrt(G / (dd / 1000));
      const N2 = rng.pick([1200, 1450, 1500, 1800, 2400, 2900, 3000]);
      const W2 = (TWO_PI * N2) / 60;
      const r2 = W2 / wn2;
      const T = transmissibility(r2, z);
      const F0 = me * W2 * W2;
      const FT = F0 * T;
      const Tdbl = transmissibility(r2, 2 * z);
      const Fres = me * wn2 * wn2 * transmissibility(1, z);
      const parts: SolvePart[] = [
        num({ id: 'r', label: 'Frequency ratio $r$ at running speed', answer: r2, unit: '', traps: [{ value: N2 / 60 / wn2, message: 'Mixed units: $N/60$ is in Hz but $\\omega_n$ is in rad/s.', trapId: 'units' }] }),
        num({ id: 'T', label: 'Transmissibility $T$', answer: T, unit: '', traps: [{ value: magnification(r2, z), message: 'That is the force-response ratio. Transmission has $1 + (2\\zeta r)^2$ in the numerator (the damper also pushes on the floor).', trapId: 'force-vs-base' }] }),
        num({ id: 'FT', label: 'Force reaching the floor at running speed', answer: FT, unit: 'N', traps: [{ value: F0, message: 'That is the unbalance force itself; multiply by $T$.' }] }),
        choice('double', 'The supplier offers the same mounts with twice the damping. At running speed, the force on the floor would…', [
          { text: `rise, to about ${f3(F0 * Tdbl)} N`, correct: true, why: `Above $r = \\sqrt2$ more damping raises $T$: ${f3(T)} → ${f3(Tdbl)}.` },
          { text: 'fall, because damping always reduces vibration', correct: false, why: 'Only below $r = \\sqrt2$. Here the damper force $c\\Omega X$ is transmitted and grows with speed.' },
          { text: 'stay the same, because damping only matters at resonance', correct: false, why: '$T$ depends on $\\zeta$ everywhere except exactly at $r = \\sqrt2$.' },
        ]),
      ];
      if (tier === 3)
        parts.push(
          num({
            id: 'Fres',
            label: 'Largest floor force while running up through the mount resonance (take $\\Omega = \\omega_n$)',
            answer: Fres,
            unit: 'N',
            tol: 0.03,
            traps: [
              { value: F0 * transmissibility(1, z), message: 'At resonance the unbalance force is $me\\omega_n^2$, not $me\\Omega^2$ at running speed.', trapId: 'unbalance-omega2' },
              { value: me * wn2 * wn2, message: 'At resonance the force is amplified by $T(1) = \\sqrt{1 + 4\\zeta^2}/2\\zeta$.' },
            ],
          }),
          choice('both', 'Which single change lowers **both** that start-up force and the force at speed?', [
            { text: 'Softer springs (larger static sag), same damping ratio', correct: true, why: 'The start-up force $\\approx me\\omega_n^2/2\\zeta$ falls with $\\omega_n^2 = g/\\delta_{st}$, and $r$ grows so $T$ at speed falls too.' },
            { text: 'More damping', correct: false, why: 'Lowers the start-up peak but raises $T$ at speed.' },
            { text: 'Less damping', correct: false, why: 'Slightly better at speed, but the start-up peak grows as $1/2\\zeta$.' },
            { text: 'Stiffer springs', correct: false, why: 'Raises $\\omega_n$: a bigger start-up force and less isolation at speed.' },
          ])
        );
      return {
        prompt: `A ${M} kg machine with an unbalance $me$ = ${me} kg m runs at ${N2} rpm on mounts that sag ${dd} mm under its weight, with damping ratio $\\zeta$ = ${z}.`,
        givens: [
          { sym: 'M', value: `${M} kg` },
          { sym: 'me', value: `${me} kg m`, label: 'unbalance' },
          { sym: 'N', value: `${N2} rpm` },
          { sym: '\\delta_{st}', value: `${dd} mm` },
          { sym: '\\zeta', value: `${z}` },
        ],
        parts,
        hints: [
          'The unbalance throws $F_0 = me\\Omega^2$; the mounts pass $T(r, \\zeta)$ of it to the floor. The static sag gives $\\omega_n$; the mass is not needed for $r$.',
          '$\\omega_n = \\sqrt{g/\\delta_{st}}$, $\\Omega = 2\\pi N/60$, $r = \\Omega/\\omega_n$, $T = \\sqrt{\\dfrac{1+(2\\zeta r)^2}{(1-r^2)^2+(2\\zeta r)^2}}$, $F_T = me\\Omega^2 T$.' + (tier === 3 ? ' At resonance: $F = me\\omega_n^2\\sqrt{1+4\\zeta^2}/2\\zeta$.' : ''),
          `$\\omega_n = ${f4(wn2)}$ rad/s, $\\Omega = ${f4(W2)}$ rad/s, $r = ${f4(r2)}$; $(2\\zeta r)^2 = ${f4((2 * z * r2) ** 2)}$, $(1 - r^2)^2 = ${f4((1 - r2 * r2) ** 2)}$; $me\\Omega^2 = ${f4(F0)}$ N.`,
          `$r$ = **${f4(r2)}**; $T = $ **${f4(T)}**, so $F_T = ${f4(F0)} \\times ${f4(T)}$ = **${f4(FT)} N**. With $2\\zeta$: $T$ = ${f4(Tdbl)} (worse).${tier === 3 ? ` At resonance $F = ${f4(me * wn2 * wn2)} \\times ${f4(transmissibility(1, z))}$ = **${f4(Fres)} N**.` : ''}`,
        ],
      };
    },
  },

  // ------------------------------------------------------------------ strategy chains
  {
    id: 'c4-strategy',
    title: 'Strategy choice with numbers',
    summary: 'Read the cue, back it with a number ($r$, the speed range, the unbalance force), then size the fix.',
    tiers: [1, 2, 3],
    source: 'Cues from LC4.1–LC4.7 and the summary notes C4; similar reasoning in 2023 A3.7, 2024 A3.6, official 2017–2019 A3.7',
    cardId: 'c4-strategies',
    generate(rng, tier) {
      const kind = rng.pick(['fixed', 'sweep', 'unbalance', 'receiver'] as const);
      const strat = (best: 'retune' | 'damp' | 'balance' | 'isolate', why: Record<string, string>) =>
        choice('strategy', 'Which strategy would you reach for first?', [
          { text: 'Retune: change stiffness or mass to move $\\omega_n$', correct: best === 'retune', why: why.retune },
          { text: 'Add damping', correct: best === 'damp', why: why.damp },
          { text: 'Balance the source', correct: best === 'balance', why: why.balance },
          { text: 'Isolate with soft mounts', correct: best === 'isolate', why: why.isolate },
        ]);
      if (kind === 'fixed') {
        const N = rng.pick([1460, 1480, 2900, 2950]);
        const f = N / 60;
        const rr = rng.pick([0.9, 0.93, 0.95, 0.97]);
        const fn = Number((f / rr).toFixed(1));
        const r = f / fn;
        const target = rng.pick([0.7, 0.75]);
        const factor = (f / target / fn) ** 2;
        const parts: SolvePart[] = [
          num({ id: 'r', label: 'Frequency ratio $r$', answer: r, unit: '', tol: 0.01 }),
          strat('retune', {
            retune: `Fixed speed with $r$ = ${f3(r)} ≈ 1: move $\\omega_n$ well away.`,
            damp: 'Helps (peak ∝ 1/2ζ), but you would still sit on a resonance at a fixed speed.',
            balance: 'It is already balanced to grade; the problem is the resonant amplification.',
            isolate: 'Possible (soft mounts under the pump), but a bigger change than bracing the frame.',
          }),
        ];
        if (tier >= 2)
          parts.push(
            num({
              id: 'k',
              label: `Factor by which the frame stiffness must rise so that $r$ = ${target} (same mass)`,
              answer: factor,
              unit: '',
              traps: [{ value: f / target / fn, message: '$\\omega_n \\propto \\sqrt k$: square the frequency ratio.', trapId: 'sqrt' }],
            })
          );
        if (tier === 3)
          parts.push(
            choice('mass', 'A colleague suggests bolting extra mass to the frame instead. Effect?', [
              { text: 'Worse: it lowers $\\omega_n$ towards the running speed ($r$ moves closer to 1)', correct: true, why: `$r$ = ${f3(r)} < 1, so lowering $\\omega_n$ pushes the frame onto the peak.` },
              { text: 'Better: more mass always reduces vibration', correct: false, why: 'Only above resonance does mass help (it raises $r$).' },
              { text: 'No effect: the force is unchanged', correct: false, why: 'The force is unchanged but the amplification changes with $r$.' },
            ])
          );
        return {
          prompt: `A balanced pump runs at a fixed ${N} rpm on a steel frame whose first natural frequency is ${fn} Hz. The frame vibrates strongly at 1×.`,
          givens: [
            { sym: 'N', value: `${N} rpm`, label: 'fixed speed' },
            { sym: 'f_n', value: `${fn} Hz`, label: 'frame mode' },
          ],
          parts,
          hints: [
            'A fixed forcing frequency close to a natural frequency is the cue for natural-frequency control: move $\\omega_n$ so $r$ is well away from 1.',
            `$r = f/f_n$ with $f = N/60$. Below resonance, raise $\\omega_n$ (stiffen); $\\omega_n \\propto \\sqrt{k/m}$, so the stiffness factor is $(f_{n,new}/f_n)^2$${tier >= 2 ? ` with $f_{n,new} = f/${target}$` : ''}.`,
            `$f = ${N}/60 = ${f4(f)}$ Hz, $r = ${f4(f)}/${fn} = ${f4(r)}$.${tier >= 2 ? ` $f_{n,new} = ${f4(f / target)}$ Hz.` : ''}`,
            `$r$ = **${f4(r)}**: resonant at a fixed speed, so **retune** (brace the frame).${tier >= 2 ? ` Stiffness × $(${f4(f / target)}/${fn})^2$ = **${f4(factor)}**.` : ''}${tier === 3 ? ' Adding mass would lower $\\omega_n$ and make it **worse**.' : ''}`,
          ],
        };
      }
      if (kind === 'sweep') {
        const fn = rng.step(8, 20, 1);
        const fa = Number((fn * rng.step(0.4, 0.6, 0.05)).toFixed(1));
        const fb = Number((fn * rng.step(1.8, 2.5, 0.1)).toFixed(1));
        const Q = rng.pick([4, 5, 8, 10]);
        const zReq = 1 / (2 * Q);
        const [g1, g2] = tunedRatios(0.05);
        const parts: SolvePart[] = [
          choice('inside', `Is the frame mode inside the operating range?`, [
            { text: `Yes: ${fn} Hz lies between ${fa} and ${fb} Hz`, correct: true, why: `${Math.round(fa * 60)}–${Math.round(fb * 60)} rpm is ${fa}–${fb} Hz (÷ 60), which contains ${fn} Hz.` },
            { text: 'No: it lies below the range', correct: false, why: `The range runs from ${fa} to ${fb} Hz, which contains ${fn} Hz.` },
          ]),
          num({ id: 'Q0', label: 'Resonant amplification $X/(F_0/k)$ each time the speed passes $f_n$ (with $\\zeta$ = 0.01)', answer: 50, unit: '', traps: [{ value: 100, message: 'At $r = 1$ the amplification is $1/(2\\zeta)$, not $1/\\zeta$.', trapId: 'factor2' }] }),
          strat('damp', {
            retune: `Moving $\\omega_n$ by any modest factor keeps it inside ${fa}–${fb} Hz: the peak just moves.`,
            damp: 'Resonance cannot be avoided in a sweep: damping limits the peak at every speed.',
            balance: 'Already balanced; the amplification at resonance stays.',
            isolate: `Soft mounts under the drive would cut the force into the frame only above $\\sqrt2$ times their own frequency: here a mount frequency below ${f3(fa / Math.SQRT2)} Hz, which every start-up would pass through. Damping the frame mode is the direct fix.`,
          }),
        ];
        if (tier >= 2)
          parts.push(num({ id: 'z', label: `Damping ratio needed so the resonant amplification is at most ${Q}`, answer: zReq, unit: '', traps: [{ value: 1 / Q, message: 'At resonance $X/(F_0/k) = 1/(2\\zeta)$: you missed the 2.', trapId: 'factor2' }] }));
        if (tier === 3)
          parts.push(
            num({ id: 'g1', label: 'A colleague prefers a tuned absorber ($\\mu$ = 0.05, tuned to the mode). Lower of its two new natural frequencies', answer: g1 * fn, unit: 'Hz', freq: true, traps: [{ value: fn * (1 - 0.05), message: 'Use $r^2 = 1 + \\mu/2 \\mp \\sqrt{(1+\\mu/2)^2 - 1}$, not $1 - \\mu$.' }] }),
            choice('tmdok', 'Does the absorber solve the problem?', [
              { text: `No: both new resonances (${f3(g1 * fn)} and ${f3(g2 * fn)} Hz) still lie inside the speed range`, correct: true, why: 'An absorber suits one frequency; a sweep runs through its new peaks.' },
              { text: 'Yes: the primary stands still at the old resonance', correct: false, why: 'Only at that one speed; the sweep crosses the two new resonances.' },
            ])
          );
        return {
          prompt: `A variable-speed drive runs between ${Math.round(fa * 60)} and ${Math.round(fb * 60)} rpm. The balanced drive still shakes its frame at the running frequency, and the frame’s first mode is ${fn} Hz with very little damping ($\\zeta$ ≈ 0.01).`,
          givens: [
            { sym: 'N', value: `${Math.round(fa * 60)}–${Math.round(fb * 60)} rpm`, label: 'speed range' },
            { sym: 'f_n', value: `${fn} Hz`, label: 'frame mode' },
          ],
          parts,
          hints: [
            'A speed that sweeps through a natural frequency cannot avoid resonance: damping control limits the peak, $X/(F_0/k) = 1/(2\\zeta)$ at $r = 1$.',
            `Convert the speeds to Hz (÷ 60) and compare with $f_n$. Required damping: $1/(2\\zeta) \\le Q$, so $\\zeta \\ge 1/(2Q)$.${tier === 3 ? ' Absorber: $r_{1,2}^2 = 1 + \\mu/2 \\mp \\sqrt{(1+\\mu/2)^2 - 1}$.' : ''}`,
            `Range ${fa}–${fb} Hz contains ${fn} Hz; now $1/(2 \\times 0.01) = 50$.${tier >= 2 ? ` $\\zeta \\ge 1/(2 \\times ${Q})$.` : ''}${tier === 3 ? ` $\\mu$ = 0.05: $r_1$ = ${f4(g1)}, $r_2$ = ${f4(g2)}.` : ''}`,
            `Mode inside the range, amplified **50** times at every pass: **add damping**.${tier >= 2 ? ` $\\zeta$ ≥ **${f4(zReq)}**.` : ''}${tier === 3 ? ` Absorber peaks at **${f4(g1 * fn)} Hz** and ${f4(g2 * fn)} Hz: both inside the range, so no.` : ''}`,
          ],
        };
      }
      if (kind === 'unbalance') {
        const N = rng.pick([960, 1450, 2900]);
        const W = (TWO_PI * N) / 60;
        const mu = rng.step(5, 40, 1); // g
        const e = rng.step(100, 400, 25); // mm
        const rc = rng.step(100, 300, 50); // mm
        const F = (mu / 1000) * (e / 1000) * W * W;
        const mc = (mu * e) / rc; // g
        const parts: SolvePart[] = [
          num({ id: 'F', label: 'Amplitude of the rotating unbalance force', answer: F, unit: 'N', traps: [{ value: (mu / 1000) * (e / 1000) * (N / 60) ** 2, message: 'Use $\\Omega$ in rad/s.', trapId: 'units' }, { value: mu * (e / 1000) * W * W, message: 'The mass must be in kg.', trapId: 'unit-scale' }] }),
          strat('balance', {
            retune: 'Moving $\\omega_n$ does not remove the force in the bearings.',
            damp: 'Well above resonance damping barely changes the response, and the bearings still carry the force.',
            balance: 'A rotating unbalance is removed at its source by a correction mass.',
            isolate: 'Mounts protect the floor, not the fan’s own bearings.',
          }),
        ];
        if (tier >= 2)
          parts.push(num({ id: 'mc', label: `Correction mass at radius ${rc} mm, opposite the heavy spot`, answer: mc, unit: 'g', traps: [{ value: (mu * rc) / e, message: 'Balance moments of mass about the axis: $m_c r_c = m e$, so $m_c = me/r_c$.' }] }));
        if (tier === 3)
          parts.push(
            num({ id: 'F2', label: `If the speed rises to ${Math.round(N * 1.25)} rpm, the unbalance force becomes`, answer: F * 1.5625, unit: 'N', traps: [{ value: F * 1.25, message: 'The unbalance force grows as $\\Omega^2$: × 1.25² = 1.5625.', trapId: 'unbalance-omega2' }] })
          );
        return {
          prompt: `A fan’s 1× vibration jumped after a blade repair. Measurements show an extra ${mu} g acting at ${e} mm from the axis. The fan runs at ${N} rpm, well above its support’s natural frequency.`,
          givens: [
            { sym: 'm', value: `${mu} g`, label: 'unbalance mass' },
            { sym: 'e', value: `${e} mm`, label: 'its radius' },
            { sym: 'N', value: `${N} rpm` },
          ],
          parts,
          hints: [
            '1× vibration that grew after a repair is a new unbalance: a rotating force $me\\Omega^2$. Source control removes it.',
            `$F = me\\Omega^2$ (SI units, $\\Omega = 2\\pi N/60$).${tier >= 2 ? ' Correction: $m_cr_c = me$ at 180° to the heavy spot.' : ''}${tier === 3 ? ' $F \\propto \\Omega^2$.' : ''}`,
            `$me = ${mu / 1000} \\times ${e / 1000} = ${f4((mu / 1000) * (e / 1000))}$ kg m; $\\Omega = ${f4(W)}$ rad/s.`,
            `$F$ = **${f4(F)} N**: **balance** it.${tier >= 2 ? ` $m_c = ${mu} \\times ${e}/${rc}$ = **${f4(mc)} g**.` : ''}${tier === 3 ? ` At ${Math.round(N * 1.25)} rpm: ${f4(F)} × 1.5625 = **${f4(F * 1.5625)} N**.` : ''}`,
          ],
        };
      }
      // receiver: isolate an instrument from a vibrating floor
      const fa = rng.step(10, 25, 5);
      const fb = rng.step(40, 80, 10);
      const Tt = rng.pick([0.05, 0.1, 0.2]);
      const fnMax = fa / Math.sqrt(1 + 1 / Tt);
      const sagMin = (G / (TWO_PI * fnMax) ** 2) * 1000;
      const parts: SolvePart[] = [
        strat('isolate', {
          retune: 'Bolted down, the instrument has no natural frequency of its own to move.',
          damp: 'A rigid fixing has no relative motion to damp.',
          balance: 'The source (the floor) is outside your control.',
          isolate: 'Protecting a receiver from a vibrating base: soft mounts, $r \\gg \\sqrt2$.',
        }),
        num({ id: 'fn', label: `Largest mount natural frequency so that $T \\le$ ${Tt} over the whole band (undamped)`, answer: fnMax, unit: 'Hz', freq: true, traps: [{ value: fb / Math.sqrt(1 + 1 / Tt), message: 'The lowest floor frequency is the hardest to isolate: design for ' + fa + ' Hz, not ' + fb + ' Hz.' }, { value: fa / Math.SQRT2, message: '$f/\\sqrt2$ only gives $T = 1$; for $T$ = ' + Tt + ' you need $r^2 = 1 + 1/T$.' }] }),
      ];
      if (tier >= 2) parts.push(num({ id: 'sag', label: 'Corresponding smallest static sag', answer: sagMin, unit: 'mm', traps: [{ value: sagMin / 1000, message: 'Give it in mm.', trapId: 'unit-scale' }] }));
      if (tier === 3)
        parts.push(
          choice('absorber', 'Would a tuned absorber bolted to the instrument help instead?', [
            { text: 'No: the rigid fixing imposes the floor’s motion, and the floor covers a band, not one frequency', correct: true, why: 'Two reasons: no flexible primary, and a band of frequencies (2022 A1.1).' },
            { text: 'Yes, if tuned to the middle of the band', correct: false, why: 'An absorber on a rigidly fixed object changes nothing.' },
          ])
        );
      return {
        prompt: `A sensitive instrument will stand on a floor that vibrates anywhere between ${fa} and ${fb} Hz. Bolted down, it moves with the floor; it must receive at most ${pctTxt(Tt)} of the floor motion.`,
        givens: [
          { sym: 'f', value: `${fa}–${fb} Hz`, label: 'floor band' },
          { sym: 'T', value: `${Tt}` },
        ],
        parts,
        hints: [
          'Protecting a receiver from base motion is the cue for isolation: $T = 1/(r^2 - 1)$ (undamped) applies to the motion, and the lowest frequency in the band is the hardest to isolate.',
          `$r^2 = 1 + 1/T$ at $f$ = ${fa} Hz: $f_n \\le ${fa}/\\sqrt{1 + 1/T}$; static sag $\\delta_{st} = g/(2\\pi f_n)^2$.`,
          `$\\sqrt{1 + 1/${Tt}} = ${f4(Math.sqrt(1 + 1 / Tt))}$.`,
          `**Isolate**: $f_n \\le$ **${f4(fnMax)} Hz**${tier >= 2 ? `, static sag ≥ **${f4(sagMin)} mm**` : ''}.`,
        ],
      };
    },
  },

  // ------------------------------------------------------------------ absorber sizing (A4 link)
  {
    id: 'c4-tmd',
    title: 'Tuned absorber: tune, size, and what damping leaves',
    summary: 'Tune $k_2 = m_2\\Omega^2$; size $\\mu$ from a frequency margin; the residual motion of a damped absorber. (Full two-DoF treatment: A4.)',
    tiers: [1, 2, 3],
    source: 'Similar to A4 absorber sizing (2023 A1.4; 2024 A1.5) and the reader’s LC4.6 damped-absorber curves',
    cardId: 'c4-absorber',
    generate(rng, tier) {
      if (tier === 1) {
        const m2 = rng.step(2, 40, 1);
        const N = rng.pick([600, 900, 1200, 1450, 1500, 1800, 2900, 3000]);
        const W = (TWO_PI * N) / 60;
        const k2 = m2 * W * W;
        return {
          prompt: `A machine runs at a constant ${N} rpm, close to a resonance of its support. An absorber of mass ${m2} kg will be fitted.`,
          givens: [
            { sym: 'm_2', value: `${m2} kg` },
            { sym: 'N', value: `${N} rpm` },
          ],
          parts: [num({ id: 'k2', label: 'Absorber spring stiffness $k_2$', answer: k2 / 1000, unit: 'kN/m', traps: [{ value: (m2 * (N / 60) ** 2) / 1000, message: 'Use $\\Omega$ in rad/s: $k_2 = m_2(2\\pi N/60)^2$.', trapId: 'units' }, { value: (m2 * W) / 1000, message: '$k_2 = m_2\\Omega^2$: you forgot to square $\\Omega$.', trapId: 'sqrt' }] })],
          hints: [
            'An undamped absorber makes the primary stand still when its own frequency equals the forcing frequency.',
            '$\\sqrt{k_2/m_2} = \\Omega$, so $k_2 = m_2\\Omega^2$ with $\\Omega = 2\\pi N/60$.',
            `$\\Omega = 2\\pi(${N})/60 = ${f4(W)}$ rad/s.`,
            `$k_2 = ${m2} \\times ${f4(W)}^2$ = ${f4(k2)} N/m = **${f4(k2 / 1000)} kN/m**.`,
          ],
        };
      }
      if (tier === 2) {
        const m1 = rng.step(100, 2000, 50);
        const N = rng.pick([900, 1200, 1450, 1500, 1800, 3000]);
        const W = (TWO_PI * N) / 60;
        // Not 0.2: it gives mu = 0.2025, so the wrong method "mu = margin" would be marked correct.
        const margin = rng.pick([0.1, 0.12, 0.15, 0.18]);
        const r1 = 1 - margin;
        const mu = muFromRatio(r1);
        const m2 = mu * m1;
        const k2 = m2 * W * W;
        const muUp = muFromRatio(1 + margin);
        return {
          prompt: `A ${m1} kg machine on its mounts resonates exactly at its running speed of ${N} rpm. A tuned absorber ($\\beta$ = 1) must put both new natural frequencies at least ${Math.round(margin * 100)} % away from the running speed.`,
          givens: [
            { sym: 'm_1', value: `${m1} kg` },
            { sym: 'N', value: `${N} rpm` },
            { sym: 'p', value: `${Math.round(margin * 100)} %`, label: 'frequency margin either side' },
          ],
          parts: [
            num({ id: 'mu', label: 'Smallest mass ratio $\\mu$', answer: mu, unit: '', traps: [{ value: muUp, message: 'With $\\beta = 1$, $r_1r_2 = 1$: the **lower** frequency binds. Use $r_1 = 1 -$ margin.', trapId: 'absorber-lower-binds' }, { value: margin, message: '$\\mu$ is not the margin: $\\mu = (r_1 - 1/r_1)^2$.' }] }),
            num({ id: 'm2', label: 'Absorber mass $m_2$', answer: m2, unit: 'kg' }),
            num({ id: 'k2', label: 'Absorber stiffness $k_2$', answer: k2 / 1000, unit: 'kN/m', traps: [{ value: (m2 * (N / 60) ** 2) / 1000, message: 'Use $\\Omega$ in rad/s.', trapId: 'units' }] }),
          ],
          hints: [
            'A tuned absorber ($\\beta$ = 1) splits the resonance into two, at $r_1 < 1 < r_2$ with $r_1r_2 = 1$; the lower one is closer in ratio terms, so it sets the size.',
            '$r_1 = 1 -$ margin; $\\mu = r_1^2 + r_1^{-2} - 2 = (r_1 - 1/r_1)^2$; $m_2 = \\mu m_1$; $k_2 = m_2\\Omega^2$.',
            `$r_1 = ${f4(r1)}$, $1/r_1 = ${f4(1 / r1)}$, $\\Omega = ${f4(W)}$ rad/s.`,
            `$\\mu = (${f4(r1)} - ${f4(1 / r1)})^2$ = **${f4(mu)}**; $m_2$ = **${f4(m2)} kg**; $k_2 = ${f4(m2)} \\times ${f4(W)}^2$ = **${f4(k2 / 1000)} kN/m** (upper frequency ${f4(1 / r1)}: more than the margin).`,
          ],
        };
      }
      const mu = rng.pick([0.02, 0.05, 0.1, 0.2]);
      const z = rng.pick([0.05, 0.1, 0.15, 0.2]);
      const xst = rng.step(0.2, 2, 0.1); // mm, F0/k1
      const res = tunedResidual(mu, z);
      const lock = 1 / Math.sqrt(1 + mu);
      return {
        prompt: `An undamped primary with static deflection $F_0/k_1$ = ${xst} mm under the forcing amplitude carries an absorber of mass ratio $\\mu$ = ${mu}, tuned to the primary ($\\beta$ = 1), with damping ratio $\\zeta = c_2/(2m_2\\omega_{11})$ = ${z}. The forcing is at the primary’s natural frequency.`,
        givens: [
          { sym: '\\mu', value: `${mu}` },
          { sym: '\\zeta', value: `${z}`, label: 'absorber damping' },
          { sym: 'F_0/k_1', value: `${xst} mm` },
        ],
        parts: [
          num({ id: 'X1', label: 'Primary amplitude $X_1$ at the tuning frequency', answer: res * xst, unit: 'mm', tol: 0.02, traps: [{ value: xst / (2 * z), message: 'That is a plain SDOF resonance $1/2\\zeta$; the absorber gives $2\\zeta/(\\mu\\sqrt{1 + 4\\zeta^2})$.' }] }),
          num({ id: 'lock', label: 'If the absorber damper seized (absorber locked to the primary): frequency ratio $\\Omega/\\omega_{11}$ of the single remaining resonance', answer: lock, unit: '', tol: 0.005, traps: [{ value: 1, message: 'The locked absorber adds its mass: $\\omega = \\sqrt{k_1/(m_1 + m_2)}$.' }] }),
          choice('role', 'What does the absorber damping do?', [
            { text: 'Lowers the two new peaks, at the cost of a non-zero response at the tuning frequency', correct: true, why: `Undamped: $X_1 = 0$ at the tuning frequency; with $\\zeta$ = ${z}, ${f3(res)} static deflections remain.` },
            { text: 'Creates the anti-resonance', correct: false, why: 'Tuning ($k_2/m_2 = \\Omega^2$) creates it; damping fills it in.' },
            { text: 'Spreads the new natural frequencies further apart', correct: false, why: 'A larger mass ratio does that.' },
          ]),
        ],
        hints: [
          'With damping in the absorber the primary no longer stands still at the tuning frequency; at $\\beta = 1$, $\\Omega = \\omega_{11}$: $X_1k_1/F_0 = 2\\zeta/(\\mu\\sqrt{1 + 4\\zeta^2})$ (from LC4.6, $\\zeta = c_2/2m_2\\omega_{11}$).',
          'Multiply that ratio by $F_0/k_1$. A locked absorber is just extra mass: $\\omega/\\omega_{11} = 1/\\sqrt{1 + \\mu}$.',
          `$2\\zeta = ${f4(2 * z)}$, $\\sqrt{1 + 4\\zeta^2} = ${f4(Math.sqrt(1 + 4 * z * z))}$; ratio $= ${f4(res)}$.`,
          `$X_1 = ${f4(res)} \\times ${xst}$ = **${f4(res * xst)} mm**; locked: $1/\\sqrt{${f4(1 + mu)}}$ = **${f4(lock)}**.`,
        ],
      };
    },
  },
];
