// A1 problem generators. Every number is randomised within the ranges the papers use; the
// hints walk concept -> set-up -> substitution -> worked solution with the same numbers.
import type { SolveGenerator, SolvePart } from '../../engine/types';
import { fmt } from '../../engine/format';
import {
  criticalDamping,
  dampingRatio,
  magnification,
  naturalFrequency,
  peakRatioTransmissibility,
  phaseLag,
  transmissibility,
} from '../../physics/sdof';

const TAU = 2 * Math.PI;
const g = 9.81;
const f3 = (x: number) => fmt(x, 3);
const f4 = (x: number) => fmt(x, 4);

export const generators: SolveGenerator[] = [
  // ------------------------------------------------------------------ static sag
  {
    id: 'a1-static-sag',
    title: 'Static sag → natural frequency',
    summary: 'From the static deflection under self-weight to $f_n$, frequency ratio and mount design.',
    tiers: [1, 2, 3],
    source: 'Similar to Week 1 Q1; LA7 isolator data',
    cardId: 'a1-free',
    generate(rng, tier) {
      const mount = rng.pick([
        { name: 'rubber pads', d: rng.step(2, 6, 0.5) },
        { name: 'steel coil springs', d: rng.step(20, 120, 5) },
        { name: 'air springs', d: rng.step(100, 200, 10) },
      ]);
      const d = mount.d; // mm
      const wn = Math.sqrt(g / (d / 1000));
      const fn = wn / TAU;
      const wrongMm = Math.sqrt(g / d) / TAU;
      if (tier === 1) {
        return {
          prompt: `A press rests on ${mount.name} that compress by $\\delta_{st}$ = ${d} mm under its weight. Model it as an SDOF system.`,
          givens: [{ sym: '\\delta_{st}', value: `${d} mm`, label: 'static deflection' }],
          parts: [
            {
              kind: 'numeric',
              id: 'fn',
              label: 'Natural frequency $f_n$',
              answer: fn,
              unit: 'Hz',
              freq: true,
              traps: [{ value: wrongMm, message: 'You left $\\delta_{st}$ in mm. Use metres inside $\\sqrt{g/\\delta_{st}}$.', trapId: 'unit-scale' }],
            },
          ],
          hints: [
            'At static equilibrium the spring carries the weight: $k\\delta_{st} = mg$, so $k/m = g/\\delta_{st}$.',
            '$\\omega_n = \\sqrt{g/\\delta_{st}}$ with $\\delta_{st}$ in metres; then $f_n = \\omega_n/2\\pi$.',
            `$\\omega_n = \\sqrt{9.81/${d / 1000}}$ = ${f4(wn)} rad/s.`,
            `$\\omega_n = \\sqrt{9.81/${d / 1000}} = ${f4(wn)}$ rad/s, so $f_n = ${f4(wn)}/2\\pi = $ **${f4(fn)} Hz**. (Check: $15.76/\\sqrt{${d}} = ${f4(15.76 / Math.sqrt(d))}$ Hz.)`,
          ],
        };
      }
      if (tier === 2) {
        const N = rng.pick([600, 900, 1200, 1500, 1800, 2400, 3000]);
        const fr = N / 60;
        const r = fr / fn;
        const T = 1 / Math.abs(1 - r * r);
        return {
          prompt: `A ${rng.int(150, 900)} kg machine on ${mount.name} sags $\\delta_{st}$ = ${d} mm. It runs at ${N} rpm. Treat the mounts as undamped.`,
          givens: [
            { sym: '\\delta_{st}', value: `${d} mm` },
            { sym: 'N', value: `${N} rpm`, label: 'running speed' },
          ],
          parts: [
            { kind: 'numeric', id: 'fn', label: 'Natural frequency $f_n$', answer: fn, unit: 'Hz', freq: true, traps: [{ value: wrongMm, message: 'δ must be in metres.', trapId: 'unit-scale' }] },
            {
              kind: 'numeric',
              id: 'r',
              label: 'Frequency ratio $r = \\Omega/\\omega_n$',
              answer: r,
              unit: '',
              traps: [{ value: N / fn, message: 'Convert rpm to Hz (÷ 60) before dividing.', trapId: 'units' }, { value: (N / 60) / wn, message: 'Mixed units: running speed in Hz but $\\omega_n$ in rad/s.', trapId: 'units' }],
            },
            { kind: 'numeric', id: 'T', label: 'Transmissibility $T = 1/|1 - r^2|$', answer: T, unit: '', tol: 0.03 },
          ],
          hints: [
            'Static sag gives $\\omega_n$ directly. Transmissibility compares running speed with $\\omega_n$ in the **same units**.',
            '$f_n = \\sqrt{g/\\delta_{st}}/2\\pi$; running frequency $= N/60$ Hz; $r = f/f_n$; undamped $T = 1/|1-r^2|$.',
            `$f_n = ${f4(fn)}$ Hz, $f = ${N}/60 = ${f4(fr)}$ Hz, $r = ${f4(r)}$.`,
            `$f_n = ${f4(fn)}$ Hz; $r = ${f4(fr)}/${f4(fn)} = $ **${f4(r)}**; $T = 1/|1 - ${f4(r)}^2| = $ **${f4(T)}** ${r > Math.SQRT2 ? '(isolating, since r > √2)' : '(amplifying, since r < √2)'}.`,
          ],
        };
      }
      const m = rng.step(100, 1200, 50);
      const fT = rng.step(2, 9, 0.5);
      const wT = TAU * fT;
      const dReq = (g / (wT * wT)) * 1000;
      const k = m * wT * wT;
      return {
        prompt: `You must mount a ${m} kg machine so that its natural frequency is ${fT} Hz. Find the static deflection the mounts must have and their total stiffness.`,
        givens: [
          { sym: 'm', value: `${m} kg` },
          { sym: 'f_n', value: `${fT} Hz`, label: 'target' },
        ],
        parts: [
          { kind: 'numeric', id: 'd', label: 'Static deflection $\\delta_{st}$', answer: dReq, unit: 'mm', traps: [{ value: dReq / 1000, message: 'Give it in mm (you have metres).', trapId: 'unit-scale' }, { value: (g / (fT * fT)) * 1000, message: 'Use $\\omega_n = 2\\pi f_n$ in rad/s, not $f_n$.', trapId: 'units' }] },
          { kind: 'numeric', id: 'k', label: 'Total mount stiffness $k$', answer: k, unit: 'N/m', traps: [{ value: m * fT * fT, message: 'Use $\\omega_n$ in rad/s: $k = m(2\\pi f_n)^2$.', trapId: 'units' }] },
        ],
        hints: [
          'Invert $\\omega_n = \\sqrt{g/\\delta_{st}}$ and $\\omega_n = \\sqrt{k/m}$.',
          '$\\delta_{st} = g/\\omega_n^2$ and $k = m\\omega_n^2$ with $\\omega_n = 2\\pi f_n$.',
          `$\\omega_n = 2\\pi \\times ${fT} = ${f4(wT)}$ rad/s.`,
          `$\\delta_{st} = 9.81/${f4(wT)}^2 = ${f4(dReq / 1000)}$ m = **${f4(dReq)} mm**; $k = ${m} \\times ${f4(wT)}^2 = $ **${f4(k)} N/m**.`,
        ],
      };
    },
  },

  // ------------------------------------------------------------------ free response
  {
    id: 'a1-free-amplitude',
    title: 'Free vibration: amplitude and maximum speed',
    summary: 'Amplitude, maximum velocity and acceleration from initial conditions or an impulse.',
    tiers: [1, 2, 3],
    source: 'Similar to Week 1 Q2',
    cardId: 'a1-free',
    generate(rng, tier) {
      const m = rng.step(0.5, 8, 0.5);
      const k = rng.step(200, 5000, 50);
      const wn = naturalFrequency(k, m);
      if (tier === 3) {
        const Ip = rng.step(0.5, 6, 0.5); // N s
        const v0 = Ip / m;
        const C = v0 / wn;
        const amax = wn * wn * C;
        return {
          prompt: `A ${m} kg mass on a ${k} N/m spring is at rest when it receives an impulse of ${Ip} N s. Ignore damping.`,
          givens: [
            { sym: 'm', value: `${m} kg` },
            { sym: 'k', value: `${k} N/m` },
            { sym: 'I_p', value: `${Ip} N s`, label: 'impulse' },
          ],
          parts: [
            { kind: 'numeric', id: 'C', label: 'Displacement amplitude $C$', answer: C * 1000, unit: 'mm', traps: [{ value: v0 * 1000, message: 'That is the initial speed in mm/s, not a displacement.' }] },
            { kind: 'numeric', id: 'a', label: 'Maximum acceleration', answer: amax, unit: 'm/s²', traps: [{ value: wn * C, message: 'That is the maximum velocity ($\\omega_n C$); acceleration is $\\omega_n^2 C$.' }] },
          ],
          hints: [
            'An impulse changes momentum instantly: the mass starts at $x_0 = 0$ with $\\dot x_0 = I_p/m$.',
            '$C = \\dot x_0/\\omega_n$ and $a_{max} = \\omega_n^2 C = \\omega_n \\dot x_0$.',
            `$\\omega_n = \\sqrt{${k}/${m}} = ${f4(wn)}$ rad/s; $\\dot x_0 = ${Ip}/${m} = ${f4(v0)}$ m/s.`,
            `$C = ${f4(v0)}/${f4(wn)} = ${f4(C)}$ m = **${f4(C * 1000)} mm**; $a_{max} = \\omega_n \\dot x_0 = ${f4(wn)} \\times ${f4(v0)} = $ **${f4(amax)} m/s²**.`,
          ],
        };
      }
      const x0 = rng.pick([-1, 1]) * rng.step(2, 15, 1); // mm
      const v0 = rng.pick([-1, 1]) * rng.step(10, 200, 5); // mm/s
      const C = Math.sqrt(x0 * x0 + (v0 / wn) ** 2);
      const vmax = wn * C;
      const parts: SolvePart[] = [
        { kind: 'numeric', id: 'wn', label: 'Natural frequency $\\omega_n$', answer: wn, unit: 'rad/s', freq: true },
        { kind: 'numeric', id: 'C', label: 'Amplitude $C$', answer: C, unit: 'mm', traps: [{ value: Math.abs(x0), message: '$|x_0|$ ignores the initial velocity: $C = \\sqrt{x_0^2 + (\\dot x_0/\\omega_n)^2}$.' }] },
      ];
      if (tier === 2)
        parts.push({
          kind: 'numeric',
          id: 'vmax',
          label: 'Maximum speed $\\dot x_{max}$',
          answer: vmax,
          unit: 'mm/s',
          traps: [
            { value: C, message: 'That is the displacement amplitude. The velocity amplitude is $\\omega_n C$.' },
            { value: Math.abs(v0), message: 'The initial speed is not the maximum: the mass speeds up as it passes $x = 0$.' },
          ],
        });
      return {
        prompt: `An undamped mass–spring system ($m$ = ${m} kg, $k$ = ${k} N/m) is released with $x_0$ = ${x0} mm and $\\dot x_0$ = ${v0} mm/s.`,
        givens: [
          { sym: 'm', value: `${m} kg` },
          { sym: 'k', value: `${k} N/m` },
          { sym: 'x_0', value: `${x0} mm` },
          { sym: '\\dot x_0', value: `${v0} mm/s` },
        ],
        parts,
        hints: [
          'Undamped free response is $x = x_0\\cos\\omega_n t + (\\dot x_0/\\omega_n)\\sin\\omega_n t = C\\cos(\\omega_n t - \\varphi)$.',
          '$\\omega_n = \\sqrt{k/m}$; $C = \\sqrt{x_0^2 + (\\dot x_0/\\omega_n)^2}$; $\\dot x_{max} = \\omega_n C$. (Mixing mm and mm/s is fine here.)',
          `$\\omega_n = \\sqrt{${k}/${m}} = ${f4(wn)}$ rad/s; $\\dot x_0/\\omega_n = ${f4(v0 / wn)}$ mm.`,
          `$C = \\sqrt{${x0}^2 + (${f4(v0 / wn)})^2} = $ **${f4(C)} mm**${tier === 2 ? `; $\\dot x_{max} = ${f4(wn)} \\times ${f4(C)} = $ **${f4(vmax)} mm/s** (energy check: $\\sqrt{(\\omega_n x_0)^2 + \\dot x_0^2}$ = ${f4(Math.sqrt((wn * x0) ** 2 + v0 * v0))})` : ''}.`,
        ],
      };
    },
  },

  // ------------------------------------------------------------------ forced amplitude
  {
    id: 'a1-forced-amp',
    title: 'Steady-state amplitude under a harmonic force',
    summary: 'Force on the mass: $r$, magnification, amplitude and phase.',
    tiers: [1, 2, 3],
    source: 'Similar to Week 1 Q3; LA1 Eq 1.19',
    cardId: 'a1-forced',
    generate(rng, tier) {
      if (tier === 1) {
        const r = rng.pick([0.5, 0.8, 0.9, 1, 1.2, 1.5, 2, 3]);
        const z = rng.pick([0.02, 0.05, 0.1, 0.2, 0.3]);
        const M = magnification(r, z);
        return {
          prompt: `A harmonically forced SDOF system has frequency ratio $r$ = ${r} and damping ratio $\\zeta$ = ${z}.`,
          parts: [
            { kind: 'numeric', id: 'M', label: 'Dynamic magnification $X/(F_0/k)$', answer: M, unit: '', traps: [{ value: transmissibility(r, z), message: 'That is the transmissibility (base excitation). A force on the mass has no $(2\\zeta r)^2$ in the numerator.', trapId: 'force-vs-base' }, { value: 1 / Math.abs(1 - r * r), message: 'You dropped the damping term $(2\\zeta r)^2$.' }] },
          ],
          hints: [
            'Force excitation: $X/(F_0/k) = 1/\\sqrt{(1-r^2)^2 + (2\\zeta r)^2}$.',
            'Work out $(1-r^2)^2$ and $(2\\zeta r)^2$ separately, add, square-root, invert.',
            `$(1-r^2)^2 = ${f4((1 - r * r) ** 2)}$, $(2\\zeta r)^2 = ${f4((2 * z * r) ** 2)}$.`,
            `$X/(F_0/k) = 1/\\sqrt{${f4((1 - r * r) ** 2 + (2 * z * r) ** 2)}} = $ **${f4(M)}**.`,
          ],
        };
      }
      const m = rng.step(2, 40, 1);
      const k = rng.step(500, 20000, 100);
      const wn = naturalFrequency(k, m);
      const fn = wn / TAU;
      const r = rng.pick([0.6, 0.75, 0.85, 0.94, 1.1, 1.3, 1.8]);
      const f = Number((r * fn).toPrecision(3));
      const W = TAU * f;
      const rr = W / wn;
      const F0 = rng.step(5, 100, 1);
      const z = rng.pick([0.02, 0.05, 0.08, 0.1, 0.15]);
      const c = 2 * z * Math.sqrt(k * m);
      const cShown = Number(c.toPrecision(3));
      const zz = tier === 3 ? dampingRatio(cShown, k, m) : z;
      const M = magnification(rr, zz);
      const X = (F0 / k) * M;
      const wrongF = (F0 / k) * magnification(f / wn, zz);
      const phi = (phaseLag(rr, zz) * 180) / Math.PI;
      const dampTxt = tier === 3 ? `a damper of $c$ = ${cShown} N s/m` : `damping ratio $\\zeta$ = ${z}`;
      const parts: SolvePart[] = [
        { kind: 'numeric', id: 'r', label: 'Frequency ratio $r$', answer: rr, unit: '', traps: [{ value: f / wn, message: 'You divided Hz by rad/s. Convert the forcing frequency: $\\Omega = 2\\pi f$.', trapId: 'units' }] },
        { kind: 'numeric', id: 'X', label: 'Steady-state amplitude $X$', answer: X * 1000, unit: 'mm', traps: [{ value: wrongF * 1000, message: 'This uses $f$ in Hz inside $r$. Convert to rad/s first.', trapId: 'units' }, { value: (F0 / k) * 1000, message: 'That is the static deflection $F_0/k$, not the dynamic amplitude.' }] },
      ];
      if (tier === 3) {
        parts.splice(1, 0, { kind: 'numeric', id: 'z', label: 'Damping ratio $\\zeta$', answer: zz, unit: '', traps: [{ value: cShown / (Math.sqrt(k * m)), message: 'Critical damping is $2\\sqrt{km}$; you missed the 2.', trapId: 'factor2' }] });
        parts.push({ kind: 'numeric', id: 'phi', label: 'Phase lag $\\varphi$ of $x$ behind $F$', answer: phi, unit: '°', tol: 0.02, absTol: 0.5 });
      }
      return {
        prompt: `A ${m} kg mass on a spring of stiffness ${k} N/m with ${dampTxt} is driven by a force $F_0\\sin\\Omega t$ with $F_0$ = ${F0} N at ${f} Hz.`,
        givens: [
          { sym: 'm', value: `${m} kg` },
          { sym: 'k', value: `${k} N/m` },
          tier === 3 ? { sym: 'c', value: `${cShown} N s/m` } : { sym: '\\zeta', value: `${z}` },
          { sym: 'F_0', value: `${F0} N` },
          { sym: 'f', value: `${f} Hz`, label: 'forcing frequency' },
        ],
        parts,
        hints: [
          'Force excitation: $X = \\dfrac{F_0/k}{\\sqrt{(1-r^2)^2 + (2\\zeta r)^2}}$, $\\tan\\varphi = \\dfrac{2\\zeta r}{1-r^2}$.',
          `Find $\\omega_n = \\sqrt{k/m}$, convert $\\Omega = 2\\pi f$, then $r = \\Omega/\\omega_n$${tier === 3 ? ' and $\\zeta = c/(2\\sqrt{km})$' : ''}.`,
          `$\\omega_n = ${f4(wn)}$ rad/s, $\\Omega = ${f4(W)}$ rad/s, $r = ${f4(rr)}$${tier === 3 ? `, $\\zeta = ${f4(zz)}$` : ''}; $F_0/k = ${f4((F0 / k) * 1000)}$ mm.`,
          `$(1-r^2)^2 = ${f4((1 - rr * rr) ** 2)}$, $(2\\zeta r)^2 = ${f4((2 * zz * rr) ** 2)}$, ratio $= ${f4(M)}$, so $X = ${f4((F0 / k) * 1000)} \\times ${f4(M)} = $ **${f4(X * 1000)} mm**${tier === 3 ? `; $\\varphi = $ **${f3(phi)}°**` : ''}.`,
        ],
      };
    },
  },

  // ------------------------------------------------------------------ floor vibration
  {
    id: 'a1-floor',
    title: 'Allowable floor vibration (base excitation)',
    summary: 'Transmissibility with damping: how much floor motion sensitive equipment can tolerate.',
    tiers: [1, 2, 3],
    source: 'Similar to Week 1 Q4; LA7 Eq 7.1',
    cardId: 'a1-base',
    generate(rng, tier) {
      if (tier === 1) {
        const r = rng.pick([0.5, 1, 1.2, Math.SQRT2, 2, 3, 5]);
        const z = rng.pick([0.05, 0.1, 0.2, 0.5]);
        const T = transmissibility(r, z);
        const rs = r === Math.SQRT2 ? '\\sqrt2' : String(r);
        return {
          prompt: `Base-excited SDOF system: $r$ = $${rs}$, $\\zeta$ = ${z}.`,
          parts: [{ kind: 'numeric', id: 'T', label: 'Transmissibility $T = X/Y$', answer: T, unit: '', traps: [{ value: magnification(r, z), message: 'That is the force-excitation ratio: base motion adds $(2\\zeta r)^2$ to the numerator.', trapId: 'force-vs-base' }] }],
          hints: [
            'Base motion acts through the spring and the damper: $T = \\sqrt{\\dfrac{1+(2\\zeta r)^2}{(1-r^2)^2+(2\\zeta r)^2}}$.',
            'Compute $(2\\zeta r)^2$ and $(1-r^2)^2$, then the ratio.',
            `$(2\\zeta r)^2 = ${f4((2 * z * r) ** 2)}$, $(1-r^2)^2 = ${f4((1 - r * r) ** 2)}$.`,
            `$T = \\sqrt{${f4(1 + (2 * z * r) ** 2)}/${f4((1 - r * r) ** 2 + (2 * z * r) ** 2)}} = $ **${f4(T)}**${Math.abs(r - Math.SQRT2) < 1e-9 ? ' (exactly 1 at r = √2 for any ζ)' : ''}.`,
          ],
        };
      }
      const m = rng.step(300, 3000, 50);
      const k = rng.step(10, 200, 2) * 1000;
      const c = rng.step(0.4, 6, 0.2) * 1000;
      const N = rng.pick([300, 450, 600, 900, 1200, 1500]);
      const Xmax = rng.pick([0.5, 1, 2, 5]); // µm
      const wn = naturalFrequency(k, m);
      const W = (TAU * N) / 60;
      const z = dampingRatio(c, k, m);
      const r = W / wn;
      const T = transmissibility(r, z);
      const Ymax = Xmax / T;
      const wrongForce = Xmax / magnification(r, z);
      const parts: SolvePart[] = [
        { kind: 'numeric', id: 'z', label: 'Damping ratio $\\zeta$', answer: z, unit: '' },
        { kind: 'numeric', id: 'r', label: 'Frequency ratio $r$', answer: r, unit: '', traps: [{ value: N / 60 / wn, message: 'rpm → rad/s needs × 2π/60, not just ÷ 60.', trapId: 'units' }] },
        { kind: 'numeric', id: 'Y', label: 'Largest allowable floor amplitude $Y_{max}$', answer: Ymax, unit: 'µm', traps: [{ value: wrongForce, message: 'You used the force-excitation formula. Base motion pushes through the damper too, so the numerator has $1+(2\\zeta r)^2$ (this error is unsafe: it over-estimates the allowable floor motion).', trapId: 'force-vs-base' }] },
      ];
      if (tier === 3)
        parts.push({
          kind: 'choice',
          id: 'double-c',
          label: 'The site engineer proposes doubling the isolator damping to protect the equipment further. What happens to $Y_{max}$?',
          options: [
            { text: 'It falls: more damping transmits more floor motion at this speed, so less floor motion is allowed.', correct: r > Math.SQRT2, why: r > Math.SQRT2 ? `Here $r = ${f3(r)} > \\sqrt2$, so $T$ rises with $\\zeta$.` : 'Not at this speed: below √2 damping reduces T.' },
            { text: 'It rises: damping always reduces vibration.', correct: r <= Math.SQRT2, why: r > Math.SQRT2 ? 'Damping only helps below $r = \\sqrt2$ (near resonance).' : `Here $r = ${f3(r)} < \\sqrt2$, so more damping lowers $T$.` },
            { text: 'No change: transmissibility does not depend on damping.', correct: false, why: '$T$ depends on $\\zeta$ everywhere except exactly at $r = \\sqrt2$.' },
          ],
        });
      return {
        prompt: `Sensitive equipment ($m$ = ${m} kg) sits on isolators with total stiffness ${k / 1000} kN/m and damping ${c / 1000} kN s/m. A nearby engine shakes the floor at ${N} rpm. The equipment’s vibration amplitude must stay below ${Xmax} µm.`,
        givens: [
          { sym: 'm', value: `${m} kg` },
          { sym: 'k', value: `${k} N/m` },
          { sym: 'c', value: `${c} N s/m` },
          { sym: 'N', value: `${N} rpm` },
          { sym: 'X_{max}', value: `${Xmax} µm` },
        ],
        parts,
        hints: [
          'The floor is a moving base, so use the transmissibility $T = X/Y$ (LA7 Eq 7.1), then $Y_{max} = X_{max}/T$.',
          '$\\omega_n = \\sqrt{k/m}$, $\\zeta = c/(2\\sqrt{km})$, $\\Omega = 2\\pi N/60$, $r = \\Omega/\\omega_n$.',
          `$\\omega_n = ${f4(wn)}$ rad/s, $\\zeta = ${f4(z)}$, $\\Omega = ${f4(W)}$ rad/s, $r = ${f4(r)}$; $(2\\zeta r)^2 = ${f4((2 * z * r) ** 2)}$, $(1-r^2)^2 = ${f4((1 - r * r) ** 2)}$.`,
          `$T = \\sqrt{${f4(1 + (2 * z * r) ** 2)}/${f4((1 - r * r) ** 2 + (2 * z * r) ** 2)}} = ${f4(T)}$, so $Y_{max} = ${Xmax}/${f4(T)} = $ **${f4(Ymax)} µm**.`,
        ],
      };
    },
  },

  // ------------------------------------------------------------------ door closer
  {
    id: 'a1-door',
    title: 'Door-closer damping',
    summary: 'Critical damping for a torsional system: fastest closing without hitting the frame.',
    tiers: [1, 2, 3],
    source: 'Similar to 2021 A1.1',
    cardId: 'a1-damping',
    generate(rng, tier) {
      const I = rng.step(4, 40, 1);
      const k = rng.step(10, 120, 5);
      const cc = criticalDamping(k, I);
      const wn = naturalFrequency(k, I);
      if (tier === 1) {
        return {
          prompt: `A door ($I$ = ${I} kg m² about its hinge) has a torsional closing spring $k$ = ${k} N m/rad. Choose the damper so it closes as fast as possible without hitting the frame.`,
          givens: [
            { sym: 'I', value: `${I} kg m²` },
            { sym: 'k', value: `${k} N m/rad` },
          ],
          parts: [
            { kind: 'numeric', id: 'c', label: 'Damper coefficient $c$', answer: cc, unit: 'N m s/rad', traps: [{ value: Math.sqrt(k * I), message: 'Critical damping is $2\\sqrt{kI}$: you missed the 2 (ζ = 0.5 would overshoot).', trapId: 'factor2' }, { value: 2 * Math.sqrt(k / I), message: 'Check units: $c$ needs $\\sqrt{kI}$ (N m s/rad), not $\\sqrt{k/I}$.' }] },
          ],
          hints: [
            'Fastest return with no overshoot is critical damping, $\\zeta = 1$.',
            'For $I\\ddot\\theta + c\\dot\\theta + k\\theta = 0$: $c_c = 2\\sqrt{kI} = 2I\\omega_n$.',
            `$c_c = 2\\sqrt{${k} \\times ${I}}$.`,
            `$c = c_c = 2\\sqrt{${k}\\times${I}} = $ **${f4(cc)} N m s/rad**.`,
          ],
        };
      }
      if (tier === 2) {
        const zeta = rng.pick([0.3, 0.5, 0.7, 1.5, 2, 3]);
        const c = Number((zeta * cc).toPrecision(3));
        const z = c / cc;
        return {
          prompt: `A door ($I$ = ${I} kg m²) with a closing spring of ${k} N m/rad is fitted with a damper of $c$ = ${c} N m s/rad.`,
          givens: [
            { sym: 'I', value: `${I} kg m²` },
            { sym: 'k', value: `${k} N m/rad` },
            { sym: 'c', value: `${c} N m s/rad` },
          ],
          parts: [
            { kind: 'numeric', id: 'z', label: 'Damping ratio $\\zeta$', answer: z, unit: '', traps: [{ value: c / Math.sqrt(k * I), message: '$\\zeta = c/c_c$ with $c_c = 2\\sqrt{kI}$.', trapId: 'factor2' }] },
            {
              kind: 'choice',
              id: 'behaviour',
              label: 'How does the door close?',
              options: [
                { text: 'It overshoots and hits the frame.', correct: z < 1, why: 'Any $\\zeta < 1$ crosses the closed position.' },
                { text: 'It closes as fast as possible without overshoot.', correct: false, why: 'Only exactly at $\\zeta = 1$.' },
                { text: 'It creeps shut more slowly than necessary.', correct: z > 1, why: 'Over-damped: the slow root $\\omega_n(\\zeta - \\sqrt{\\zeta^2-1})$ governs.' },
              ],
            },
          ],
          hints: [
            'Classify the response with $\\zeta = c/c_c$.',
            '$c_c = 2\\sqrt{kI}$; $\\zeta < 1$ under-damped (overshoots), $\\zeta = 1$ critical, $\\zeta > 1$ over-damped (slow).',
            `$c_c = 2\\sqrt{${k}\\times${I}} = ${f4(cc)}$ N m s/rad.`,
            `$\\zeta = ${c}/${f4(cc)} = $ **${f3(z)}**, so it ${z < 1 ? 'overshoots and slams' : 'creeps shut slowly'}.`,
          ],
        };
      }
      const t2 = 5.834 / wn;
      return {
        prompt: `A heavy door ($I$ = ${I} kg m²) has a closing spring of ${k} N m/rad and a critically damped closer.`,
        givens: [
          { sym: 'I', value: `${I} kg m²` },
          { sym: 'k', value: `${k} N m/rad` },
        ],
        parts: [
          { kind: 'numeric', id: 'wn', label: 'Natural frequency $\\omega_n$', answer: wn, unit: 'rad/s', freq: true },
          { kind: 'numeric', id: 't', label: 'Time to get within 2 % of closed after release from rest', answer: t2, unit: 's', tol: 0.03, traps: [{ value: 4 / wn, message: '$4/(\\zeta\\omega_n)$ is the under-damped envelope rule; at $\\zeta = 1$ solve $(1+\\omega_n t)e^{-\\omega_n t} = 0.02$.' }] },
        ],
        hints: [
          'Critically damped from rest: $\\theta = \\theta_0(1 + \\omega_n t)e^{-\\omega_n t}$.',
          'Solve $(1 + u)e^{-u} = 0.02$ for $u = \\omega_n t$ (by iteration), then $t = u/\\omega_n$.',
          `$\\omega_n = \\sqrt{${k}/${I}} = ${f4(wn)}$ rad/s; $u \\approx 5.834$.`,
          `$t = 5.834/${f4(wn)} = $ **${f4(t2)} s**.`,
        ],
      };
    },
  },

  // ------------------------------------------------------------------ building on foundation
  {
    id: 'a1-building',
    title: 'Building on a damped foundation (ground motion)',
    summary: 'Resonance of a base-excited structure: absolute vs relative motion, which peak, and how to reduce it.',
    tiers: [2, 3],
    source: 'Similar to 2021 A1.2',
    cardId: 'a1-base',
    marks: 6,
    generate(rng, tier) {
      const mt = rng.step(500, 5000, 100); // tonnes
      const m = mt * 1000;
      const fn = rng.step(0.8, 3, 0.1);
      const wn = TAU * fn;
      const k = Number((m * wn * wn).toPrecision(3));
      const z = rng.pick([0.1, 0.15, 0.2, 0.225, 0.25, 0.3]);
      const c = Number((2 * z * Math.sqrt(k * m)).toPrecision(3));
      const zz = dampingRatio(c, k, m);
      const wn2 = naturalFrequency(k, m);
      const Y = rng.step(2, 15, 1);
      const T1 = transmissibility(1, zz);
      const rp = peakRatioTransmissibility(zz);
      const fp = (rp * wn2) / TAU;
      const parts: SolvePart[] = [
        { kind: 'numeric', id: 'z', label: 'Damping ratio of the foundation $\\zeta$', answer: zz, unit: '' },
        {
          kind: 'numeric',
          id: 'X1',
          label: 'Building displacement amplitude when the ground shakes at the undamped natural frequency',
          answer: T1 * Y,
          unit: 'mm',
          traps: [{ value: Y / (2 * zz), message: '$Y/(2\\zeta)$ is the **relative** deflection of the foundation. The building’s absolute motion is $T(1)\\,Y = Y\\sqrt{1+4\\zeta^2}/(2\\zeta)$.', trapId: 'force-vs-base' }],
        },
        {
          kind: 'choice',
          id: 'reduce',
          label: 'Which change reduces the building’s peak displacement?',
          options: [
            { text: 'Increase the foundation damping $c$.', correct: true, why: 'A larger $\\zeta$ lowers the resonant peak.' },
            { text: 'Add mass to the building.', correct: false, why: '$\\zeta = c/(2\\sqrt{km})$ falls, so the peak rises.' },
            { text: 'Stiffen the foundation (same $c$).', correct: false, why: '$\\zeta$ falls and the peak rises; the resonance just moves.' },
          ],
        },
      ];
      if (tier === 3)
        parts.splice(2, 0, {
          kind: 'numeric',
          id: 'fp',
          label: 'Frequency at which the building’s absolute displacement is largest',
          answer: fp,
          unit: 'Hz',
          freq: true,
          tol: 0.005,
          traps: [
            { value: fn, message: 'That is the undamped natural frequency. With damping the transmissibility peak sits slightly lower.', trapId: 'damped-peak-shift' },
            { value: (wn2 * Math.sqrt(1 - 2 * zz * zz)) / TAU, message: '$\\omega_n\\sqrt{1-2\\zeta^2}$ is the peak of the **force**-excitation curve. For base motion the peak is at $r = \\sqrt{\\sqrt{1+8\\zeta^2}-1}/(2\\zeta)$.', trapId: 'damped-peak-shift' },
          ],
        });
      return {
        prompt: `A building of mass ${mt} t stands on a foundation of stiffness ${fmt(k, 3)} N/m and damping ${fmt(c, 3)} N s/m. Ground motion $y = Y\\sin\\Omega t$ with $Y$ = ${Y} mm reaches it over a band of frequencies.`,
        givens: [
          { sym: 'm', value: `${mt} t` },
          { sym: 'k', value: `${fmt(k, 3)} N/m` },
          { sym: 'c', value: `${fmt(c, 3)} N s/m` },
          { sym: 'Y', value: `${Y} mm` },
        ],
        parts,
        hints: [
          'Ground motion is base excitation: the building’s absolute amplitude is $T\\,Y$ (LA7 Eq 7.1). The foundation’s relative deflection is a different quantity.',
          '$\\omega_n = \\sqrt{k/m}$, $\\zeta = c/(2\\sqrt{km})$; at $r = 1$, $T = \\sqrt{1+4\\zeta^2}/(2\\zeta)$; the $T$ peak is at $r_p = \\sqrt{\\sqrt{1+8\\zeta^2}-1}/(2\\zeta)$.',
          `$\\omega_n = ${f4(wn2)}$ rad/s ($f_n$ = ${f4(wn2 / TAU)} Hz), $\\zeta = ${f4(zz)}$, $T(1) = ${f4(T1)}$, $r_p = ${f4(rp)}$.`,
          `$X(r{=}1) = ${f4(T1)} \\times ${Y} = $ **${f4(T1 * Y)} mm** (the relative deflection would be $Y/2\\zeta$ = ${f4(Y / (2 * zz))} mm). ${tier === 3 ? `Peak at $f = ${f4(rp)} \\times ${f4(wn2 / TAU)} = $ **${f4(fp)} Hz** with $X_{max} = ${f4(transmissibility(rp, zz) * Y)}$ mm. ` : ''}To reduce it, raise $\\zeta$ (more damping, or a softer foundation at the same $c$), at the cost of more transmission above $r = \\sqrt2$.`,
        ],
      };
    },
  },

  // ------------------------------------------------------------------ isolator design
  {
    id: 'a1-isolator',
    title: 'Isolator design for a target transmissibility',
    summary: 'Undamped isolation: required r, maximum mount stiffness and static sag.',
    tiers: [1, 2, 3],
    source: 'Similar to 2022 A1.1; LA7 design rule ($r \\ge 2$)',
    cardId: 'a1-base',
    generate(rng, tier) {
      const Tt = rng.pick([0.05, 0.1, 0.15, 0.2, 0.25, 1 / 3]);
      const Ts = Tt === 1 / 3 ? '1/3' : String(Tt);
      const rReq = Math.sqrt(1 + 1 / Tt);
      if (tier === 1) {
        return {
          prompt: `An undamped isolator must transmit only ${Ts === '1/3' ? 'one third' : `${Math.round(Tt * 100)} %`} of the vibration ($T$ = ${Ts}).`,
          parts: [{ kind: 'numeric', id: 'r', label: 'Minimum frequency ratio $r$', answer: rReq, unit: '', traps: [{ value: Math.sqrt(1 / Tt), message: '$T \\approx 1/r^2$ drops the −1: undamped $T = 1/(r^2-1)$ for $r > 1$.' }] }],
          hints: [
            'Undamped, above resonance: $T = 1/(r^2 - 1)$.',
            'Rearrange: $r^2 = 1 + 1/T$.',
            `$r^2 = 1 + 1/${Ts} = ${f4(1 + 1 / Tt)}$.`,
            `$r = \\sqrt{${f4(1 + 1 / Tt)}} = $ **${f4(rReq)}**.`,
          ],
        };
      }
      if (tier === 2) {
        const m = rng.step(50, 800, 10);
        const N = rng.pick([900, 1200, 1450, 1500, 1800, 2900, 3000]);
        const W = (TAU * N) / 60;
        const wnMax = W / rReq;
        const kMax = m * wnMax * wnMax;
        const dMin = (g / (wnMax * wnMax)) * 1000;
        return {
          prompt: `A ${m} kg fan runs at ${N} rpm. Choose undamped mounts so that only ${Ts === '1/3' ? 'one third' : `${Math.round(Tt * 100)} %`} of its out-of-balance force reaches the floor.`,
          givens: [
            { sym: 'm', value: `${m} kg` },
            { sym: 'N', value: `${N} rpm` },
            { sym: 'T', value: Ts, label: 'target transmissibility' },
          ],
          parts: [
            {
              kind: 'numeric',
              id: 'k',
              label: 'Maximum total mount stiffness $k$',
              answer: kMax,
              unit: 'N/m',
              traps: [
                { value: m * (N / 60 / rReq) ** 2, message: 'Use $\\Omega$ in rad/s ($2\\pi N/60$).', trapId: 'units' },
                // The reader's rule of thumb (r = 2, T = 1/3) is not this target.
                ...(Math.abs(rReq - 2) / rReq > 0.05
                  ? [{ value: m * (W / 2) ** 2, message: 'That uses the rule of thumb $r = 2$ (which gives $T = 1/3$). This target needs $r = \\sqrt{1 + 1/T}$.' }]
                  : []),
              ],
            },
            { kind: 'numeric', id: 'd', label: 'Corresponding static deflection', answer: dMin, unit: 'mm', traps: [{ value: dMin / 1000, message: 'Give it in mm.', trapId: 'unit-scale' }] },
          ],
          hints: [
            'Force transmissibility uses the same $T(r)$. Find the $r$ needed, then the largest $\\omega_n$ (stiffest mount) that achieves it.',
            '$r = \\sqrt{1 + 1/T}$; $\\omega_n \\le \\Omega/r$; $k \\le m\\omega_n^2$; $\\delta_{st} = g/\\omega_n^2$.',
            `$r = ${f4(rReq)}$, $\\Omega = 2\\pi(${N})/60 = ${f4(W)}$ rad/s, $\\omega_n \\le ${f4(wnMax)}$ rad/s.`,
            `$k \\le ${m} \\times ${f4(wnMax)}^2 = $ **${f4(kMax)} N/m**; $\\delta_{st} = 9.81/${f4(wnMax)}^2 = $ **${f4(dMin)} mm** (softer mounts sag more).`,
          ],
        };
      }
      const m = rng.step(5, 30, 1);
      const f = rng.step(1, 6, 0.5);
      const W = TAU * f;
      const kIso = (m * W * W) / 2;
      const kT = (m * W * W) / (1 + 1 / Tt);
      return {
        prompt: `A ${m} kg camera is mounted on a platform that oscillates as $y = Y\\cos(2\\pi \\cdot ${f}\\,t)$. You may place an undamped cushion of stiffness $k$ between them.`,
        givens: [
          { sym: 'm', value: `${m} kg` },
          { sym: 'f', value: `${f} Hz`, label: 'platform frequency' },
        ],
        parts: [
          { kind: 'numeric', id: 'kiso', label: 'Largest $k$ for which the cushion isolates at all ($T < 1$)', answer: kIso, unit: 'N/m', traps: [{ value: m * W * W, message: 'That is $r = 1$ (resonance). Isolation needs $r > \\sqrt2$, i.e. $k < m\\Omega^2/2$.' }] },
          { kind: 'numeric', id: 'kT', label: `Largest $k$ giving $T$ = ${Ts}`, answer: kT, unit: 'N/m' },
        ],
        hints: [
          'The cushion makes a base-excited SDOF: $X/Y = 1/|1-r^2|$. Isolation needs $r > \\sqrt2$.',
          '$r > \\sqrt2 \\Leftrightarrow \\omega_n^2 < \\Omega^2/2 \\Leftrightarrow k < m\\Omega^2/2$. For a target $T$: $r^2 = 1 + 1/T$, so $k = m\\Omega^2/(1 + 1/T)$.',
          `$\\Omega = 2\\pi(${f}) = ${f4(W)}$ rad/s, $m\\Omega^2 = ${f4(m * W * W)}$ N/m.`,
          `$k < ${f4(m * W * W)}/2 = $ **${f4(kIso)} N/m**; for $T$ = ${Ts}: $k = ${f4(m * W * W)}/${f4(1 + 1 / Tt)} = $ **${f4(kT)} N/m**. (An absorber would not help a camera rigidly fixed to the platform; only a spring changes its dynamics.)`,
        ],
      };
    },
  },
];
