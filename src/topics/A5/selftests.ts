// Self-tests for topic A5: reference values from the 2024 and 2025 A2 worked solutions, Week 5 Q2,
// the official 2017 A2 / 2018 A1.4 solutions, the reader (LA4 §4.2, LA7 Eq 7.6–7.11) and the 2021 A1.5 WS.
import type { SelfTest } from '../../selftest/types';
import { ascending, isTrue, near, nearAbs } from '../../selftest/assert';
import { centreOfRotation, inclinedMount, planarK } from '../../physics/rigidbody';
import { harmonicResponse } from '../../physics/mdof';
import { cabs } from '../../physics/complex';
import { makeRng } from '../../engine/rng';
import { blockModes, bouncePitchModes, eq76, eq78, eq78Centre, modalDamping, planarModes, rangehoodMounts, shiftOrigin } from './physics';
import { generators } from './solve';

const TAU = 2 * Math.PI;
const C = Math.SQRT2;

export const tests: SelfTest[] = [
  {
    id: 'a5-box2024',
    topic: 'A5',
    title: '2024 A2 box on four rubber springs: Iz, K, the three frequencies and the rotation centres',
    source: '2024 A2.1–A2.4 worked solution',
    run: () => {
      const m = 2000;
      const ky = 5e6;
      const kx = 8 * ky;
      const Iz = (m * (4 * 4 + (2 * C) ** 2)) / 12;
      const { K, modes } = planarModes(
        [
          { x: 0, y: -C, kx, ky },
          { x: 0, y: -C, kx, ky },
          { x: -2, y: -C, kx, ky },
          { x: 2, y: -C, kx, ky },
        ],
        m,
        Iz
      );
      const h1 = modes[0].vec[0] / modes[0].vec[2];
      const h3 = modes[2].vec[0] / modes[2].vec[2];
      return [
        near('Iz = m(a² + c²)/3 = 4000 kg m²', Iz, 4000, 1e-9),
        near('K13 = 4kx c = 2.2627×10⁸ N/rad', K[0][2], 2.26274e8, 1e-5),
        near('K33 = 4kx c² + 2ky a² = 3.6×10⁸ N m/rad', K[2][2], 3.6e8, 1e-9),
        nearAbs('K23 = 0 (bounce decoupled)', K[1][2], 0, 1e-3),
        near('ω1 = 69.598 rad/s (11.08 Hz)', modes[0].omega, 69.598, 1e-4),
        near('ω2 = 100.000 rad/s (bounce, √(4ky/m))', modes[1].omega, 100, 1e-6),
        near('ω3 = 406.394 rad/s (64.68 Hz)', modes[2].omega, 406.394, 1e-4),
        near('mode 1 centre X/Θ = −1.5054 m (just below the base)', h1, -1.50536, 1e-4),
        near('mode 3 centre X/Θ = +1.3286 m', h3, 1.32858, 1e-4),
        near('h1·h3 = −Iz/m = −2 m²', h1 * h3, -2, 1e-6),
        isTrue('mode 2 is pure bounce', Math.abs(modes[1].vec[0]) < 1e-12 && Math.abs(modes[1].vec[2]) < 1e-12),
      ];
    },
  },
  {
    id: 'a5-box2024-fifth',
    topic: 'A5',
    title: '2024 A2.5: a fifth spring at the corner couples all three motions',
    source: '2024 A2.5 worked solution',
    run: () => {
      const m = 2000;
      const ky = 5e6;
      const kx = 8 * ky;
      const mounts = [
        { x: 0, y: -C, kx, ky },
        { x: 0, y: -C, kx, ky },
        { x: -2, y: -C, kx, ky },
        { x: 2, y: -C, kx, ky },
        { x: 2, y: -C, kx, ky },
      ];
      const { K, modes } = planarModes(mounts, m, 4000);
      return [
        near("K'yθ = ky a = 1×10⁷ N/rad", K[1][2], 1e7, 1e-9),
        near("K'xθ = 5kx c = 2.828×10⁸", K[0][2], 2.82843e8, 1e-5),
        near("K'θθ = 5kx c² + 3ky a² = 4.6×10⁸", K[2][2], 4.6e8, 1e-9),
        near('ω1 = 79.27 rad/s', modes[0].omega, 79.2709, 1e-4),
        near('ω2 = 115.76 rad/s', modes[1].omega, 115.762, 1e-4),
        near('ω3 = 455.87 rad/s', modes[2].omega, 455.868, 1e-4),
        isTrue('no pure mode remains (every mode has x, y and θ)', modes.every((md) => md.vec.every((v) => Math.abs(v) > 1e-9))),
      ];
    },
  },
  {
    id: 'a5-rangehood2025',
    topic: 'A5',
    title: '2025 A2 range hood: K/kx, sway and coupled frequencies, anti-resonance amplitudes',
    source: '2025 A2.2–A2.4 worked solution',
    run: () => {
      const kx = 0.24e6;
      const K = planarK(rangehoodMounts(kx, kx / 3, 0.5, 0.5));
      const M = [
        [28, 0, 0],
        [0, 28, 0],
        [0, 0, 15],
      ];
      const md = blockModes(K, M);
      const coupled = md.filter((q) => Math.abs(q.vec[0]) < 1e-12);
      const Wa = Math.sqrt(K[2][2] / 15);
      const F0 = 0.02 * Wa * Wa;
      const r = harmonicResponse(K, M, [F0, F0, 0], Wa);
      const rpm = (w: number) => (w * 60) / TAU;
      return [
        near('K22/kx = 1', K[1][1] / kx, 1, 1e-12),
        near('K23/kx = −0.5', K[1][2] / kx, -0.5, 1e-12),
        near('K33/kx = 0.75', K[2][2] / kx, 0.75, 1e-12),
        nearAbs('K13 = 0 (sway decoupled)', K[0][2], 0, 1e-6),
        near('coupled ω1 = 64.688 rad/s (617.7 rpm)', coupled[0].omega, 64.6879, 1e-4),
        near('coupled ω2 = 128.011 rad/s (1222.4 rpm)', rpm(coupled[1].omega), 1222.42, 1e-4),
        near('sway √(3kx/m) = 160.357 rad/s (1531 rpm)', md.find((q) => Math.abs(q.vec[0]) > 0)!.omega, 160.357, 1e-4),
        near('mode 1 Θ/Y = +1.0236 rad/m', coupled[0].vec[2] / coupled[0].vec[1], 1.02361, 1e-4),
        near('y anti-resonance 1046.1 rpm', rpm(Wa), 1046.07, 1e-4),
        near('F0 = 240 N there', F0, 240, 1e-9),
        nearAbs('Y = 0 at the anti-resonance', cabs(r[1]), 0, 1e-12),
        near('|Θ| = 2.0 mrad', cabs(r[2]), 2e-3, 1e-6),
        near('|X| = 0.625 mm', cabs(r[0]), 6.25e-4, 1e-6),
        near('margin to the 2nd mode: 1.87 % above 1200 rpm', (rpm(coupled[1].omega) / 1200 - 1) * 100, 1.868, 1e-3),
      ];
    },
  },
  {
    id: 'a5-la7-charts',
    topic: 'A5',
    title: 'LA7 Eq 7.6 and 7.8 (handout Fig 2.8 / 2.11) and the Week 5 cuboid ranking',
    source: 'Week 5 Q2 worked solution; LA7 p47–48',
    run: () => {
      const xy = eq78(0.5, 2).map(Math.sqrt);
      const yz = eq78(0.5, 1.25).map(Math.sqrt);
      const g = eq76(1, 1).map(Math.sqrt);
      // direct eigen-solution of the corner-spring body (m = 1, ky = 1 per spring, a = b = 0.5)
      const { modes } = planarModes(
        [
          { x: -0.5, y: -0.5, kx: 1, ky: 2 },
          { x: 0.5, y: -0.5, kx: 1, ky: 2 },
        ],
        1,
        (0.25 + 0.25) / 3
      );
      const wy = Math.sqrt(4);
      return [
        near('XY lower 0.5541 ωy', xy[0], 0.55408, 1e-4),
        near('XY upper 1.5630 ωy', xy[1], 1.56301, 1e-4),
        near('YZ lower 0.6586 ωy', yz[0], 0.65864, 1e-4),
        near('YZ upper 1.6632 ωy', yz[1], 1.66319, 1e-4),
        ascending('Week 5 ranking: XY low < YZ low < bounce < XY up < YZ up', [xy[0], yz[0], 1, xy[1], yz[1]]),
        near('Eq 7.8 agrees with the eigen-solution (lower)', modes[0].omega / wy, xy[0], 1e-9),
        near('Eq 7.8 agrees with the eigen-solution (upper)', modes[2].omega / wy, xy[1], 1e-9),
        near('Eq 7.6 golden ratio, √S = 1, a/ρ = 1: 0.618', g[0], 0.618034, 1e-5),
        near('… and 1.618', g[1], 1.618034, 1e-5),
        near('Eq 7.8 at a = 0 gives √U', Math.sqrt(eq78(0.5, 1)[0]), Math.sqrt(0.5), 1e-12),
        near('Eq 7.8 at a = 0 gives √3', Math.sqrt(eq78(0.5, 1)[1]), Math.sqrt(3), 1e-12),
      ];
    },
  },
  {
    id: 'a5-week5-centres',
    topic: 'A5',
    title: 'Week 5 cuboid: centres of rotation of the coupled modes (chart simulation) agree with the eigen-solution',
    source: 'Week 5 Q2 worked solution (Eq 7.4 eigenvectors, recomputed in the research notes)',
    run: () => {
      // XY plane: a = 0.5 m, b = 0.5 m; YZ plane: a = 0.5 m, c = 1 m; U = 0.5. Heights above the spring plane (m).
      const [xyLo, xyUp] = eq78(0.5, 2).map(Math.sqrt);
      const [yzLo, yzUp] = eq78(0.5, 1.25).map(Math.sqrt);
      const hXY = [eq78Centre(0.5, 1, xyLo) * 0.5, eq78Centre(0.5, 1, xyUp) * 0.5];
      const hYZ = [eq78Centre(0.5, 0.5, yzLo) * 1, eq78Centre(0.5, 0.5, yzUp) * 1];
      // Direct check in CoM coordinates (XY plane): m = 1, ky = 1 per spring (2 per corner symbol), kx = 0.5 ky.
      const { modes } = planarModes(
        [
          { x: -0.5, y: -0.5, kx: 1, ky: 2 },
          { x: 0.5, y: -0.5, kx: 1, ky: 2 },
        ],
        1,
        0.5 / 3
      );
      const above = (v: number[]) => v[0] / v[2] + 0.5; // X/Θ is the height above G; G is 0.5 m above the springs
      return [
        near('XY lower: 0.7953 m below the springs', hXY[0], -0.7953, 1e-3),
        near('XY upper: 0.6287 m above the springs (0.13 m above G)', hXY[1], 0.6287, 1e-3),
        near('YZ lower: 3.277 m below the springs', hYZ[0], -3.277, 1e-3),
        near('YZ upper: 0.6103 m above the springs', hYZ[1], 0.6103, 1e-3),
        near('Eq 7.4 form = CoM eigen-solution (lower)', above(modes[0].vec), hXY[0], 1e-9),
        near('Eq 7.4 form = CoM eigen-solution (upper)', above(modes[2].vec), hXY[1], 1e-9),
        isTrue('a = 0: lower mode is pure sway (no centre), upper is pure rock about G', eq78Centre(0.5, 0, Math.sqrt(0.5)) === Infinity && eq78Centre(0.5, 0, Math.sqrt(3)) === 0),
      ];
    },
  },
  {
    id: 'a5-official-2017-2018',
    topic: 'A5',
    title: 'Official 2017 A2 K matrix; 2018 A1.4: four equivalent forms and the swapped one',
    source: 'Exam pack: official 2017 A2(b), 2018 A1.4 (d)',
    run: () => {
      const kx = 1.3;
      const ky = 2.1;
      const a = 0.4;
      const b = 0.7;
      const c = 1.1;
      const K = planarK([
        { x: -b, y: -a, kx, ky },
        { x: c, y: -a, kx, ky },
      ]);
      // 2018 A1.4 test numbers
      const m = 3;
      const I = 1.7;
      const kX = 2;
      const kY = 5;
      const h = 0.6;
      const s = 0.9;
      const Kg = planarK([
        { x: -s, y: -h, kx: kX, ky: kY },
        { x: s, y: -h, kx: kX, ky: kY },
      ]);
      const Mg = [
        [m, 0, 0],
        [0, m, 0],
        [0, 0, I],
      ];
      const atG = blockModes(Kg, Mg).map((q) => q.omega);
      const lvl = shiftOrigin(Kg, Mg, h);
      const atMount = blockModes(lvl.K, lvl.M).map((q) => q.omega);
      const dK = [
        [2 * kX, 0],
        [0, 2 * kY * h * h],
      ];
      const dM = [
        [m, -s * m],
        [-s * m, I + m * s * s],
      ];
      const dW = blockModes(dK, dM).map((q) => q.omega);
      return [
        near('K13 = 2kx a = 1.04', K[0][2], 1.04, 1e-12),
        near('K23 = ky(c − b) = 0.84', K[1][2], 0.84, 1e-12),
        near('K33 = 2kx a² + ky(b² + c²) = 3.986', K[2][2], 3.986, 1e-12),
        near('2018 (a): ω = 1.04110 rad/s', atG[0], 1.041104, 1e-5),
        near('2018 (a): ω = 2.42099 rad/s', atG[2], 2.420992, 1e-5),
        nearAbs('mount-level coordinates: K13 → 0', lvl.K[0][2], 0, 1e-12),
        near('mount-level coordinates: M13 = −mh', lvl.M[0][2], -m * h, 1e-12),
        near('same frequencies at mount level (1.04110)', atMount[0], atG[0], 1e-9),
        near('same frequencies at mount level (2.42099)', atMount[2], atG[2], 1e-9),
        near('2018 (d), a and h swapped: 0.76984 rad/s', dW[0], 0.769841, 1e-5),
        near('2018 (d): 2.18271 rad/s', dW[1], 2.182707, 1e-5),
      ];
    },
  },
  {
    id: 'a5-bounce-pitch',
    topic: 'A5',
    title: 'Bounce–pitch: LA4 car, 2021 minibus nodes, decoupling k1a = k2b',
    source: 'Reader LA4 Eq 4.13–4.17; 2021 A1.5 worked solution',
    run: () => {
      const car = bouncePitchModes(1000, 810, 18e3, 1.0, 22e3, 1.5);
      const bus = bouncePitchModes(3000, 5070, 90e3, 1.3, 90e3, 1.7);
      const dec = bouncePitchModes(1000, 810, 18e3, 1.0, 12e3, 1.5);
      return [
        near('LA4 car ω1 = 5.8593 rad/s', car.omega[0], 5.8593, 1e-4),
        near('LA4 car ω2 = 9.4341 rad/s', car.omega[1], 9.4341, 1e-4),
        near('LA4 ratio r1 = Z/Θ = −2.6461 m → node +2.6461 m', car.nodes[0], 2.6461, 1e-4),
        near('LA4 ratio r2 = 0.3061 m → node −0.3061 m', car.nodes[1], -0.3061, 1e-3),
        near('minibus f1 = 1.1969 Hz', bus.omega[0] / TAU, 1.19691, 1e-4),
        near('minibus f2 = 1.4651 Hz', bus.omega[1] / TAU, 1.46513, 1e-4),
        near('minibus node 1 = +3.4849 m (behind the rear axle)', bus.nodes[0], 3.48494, 1e-4),
        near('nodes multiply to −I/m = −1.69 m²', bus.nodes[0] * bus.nodes[1], -1.69, 1e-6),
        nearAbs('k2 = 12 kN/m decouples the LA4 car (K12 = 0)', dec.K[0][1], 0, 1e-9),
        near('then pure bounce √(30000/1000) = 5.4772 rad/s', dec.omega[0], Math.sqrt(30), 1e-9),
        isTrue('pure bounce has no node', !Number.isFinite(dec.nodes[0])),
      ];
    },
  },
  {
    id: 'a5-inclined',
    topic: 'A5',
    title: 'Inclined isolator (LA7 Eq 7.11) and the cabinet K (2022 A1.4)',
    source: 'Reader LA7 Eq 7.11; 2022 A1.4 worked solution',
    run: () => {
      const mt = inclinedMount(0, 0, 3, 1, 0.6);
      const kx = 1.3;
      const ky = 2.1;
      const a = 0.4;
      const b = 0.7;
      const c = 1.1;
      const cab = planarK([
        { x: c, y: a, kx, ky: 0 },
        { x: c, y: -b, kx, ky },
      ]);
      const cr = centreOfRotation(0.3, 0, 0.2);
      return [
        near('kx = k1cos²θ + k2sin²θ = 2.36236', mt.kx, 2.362358, 1e-6),
        near('kxy = (k1 − k2)sinθcosθ = 0.93204', mt.kxy ?? 0, 0.932039, 1e-6),
        near('ky = 1.63764', mt.ky, 1.637642, 1e-6),
        near('cabinet K13 = kx(b − a) = 0.39', cab[0][2], 0.39, 1e-12),
        near('cabinet K23 = ky c = 2.31', cab[1][2], 2.31, 1e-12),
        near('cabinet K33 = kx(a² + b²) + ky c² = 3.386', cab[2][2], 3.386, 1e-12),
        near('centre of rotation height X/Θ = 1.5 m', cr.y, 1.5, 1e-12),
      ];
    },
  },
  {
    id: 'a5-damping-above-root2',
    topic: 'A5',
    title: 'Modal damping keeps ζ per mode; above √2 more damping transmits more (2025 A3.5)',
    source: 'Summary notes A5; LA7 Eq 7.1; 2025 A3.5 worked solution',
    run: () => {
      const K = [
        [400e3, 0],
        [0, 2 * 200e3 * 1.44],
      ];
      const M = [
        [2000, 0],
        [0, 1500],
      ];
      const T = (z: number) => {
        const Cd = modalDamping(K, M, z);
        const w = Math.sqrt(400e3 / 2000);
        const W = 5 * w;
        // force k on the mass, then the force through spring and damper (k + iWc)X over k: equal to the base-motion T
        const r = harmonicResponse(K, M, [K[0][0], 0], W, Cd);
        const c = Cd[0][0];
        return Math.hypot(K[0][0] * r[0].re - W * c * r[0].im, K[0][0] * r[0].im + W * c * r[0].re) / K[0][0];
      };
      return [near('T(r = 5, ζ = 0.05) = 0.0466', T(0.05), 0.04657, 2e-3), near('T(r = 5, ζ = 0.3) = 0.1307', T(0.3), 0.1307, 2e-3), isTrue('more damping, more transmission above √2', T(0.3) > T(0.05))];
    },
  },
  {
    id: 'a5-generators',
    topic: 'A5',
    title: 'Every A5 generator builds valid problems at every tier (60 seeds); no trap within 2 % of an answer',
    run: () =>
      generators.map((g) => {
        let bad = '';
        for (let s = 1; s <= 60 && !bad; s++)
          for (const t of g.tiers) {
            const inst = g.generate(makeRng(s * 7919 + 13), t);
            if (inst.hints.length !== 4) bad = `needs 4 hints (seed ${s}, tier ${t})`;
            if (inst.hints.some((h) => /NaN|undefined|Infinity/.test(h))) bad = `hint text has NaN/undefined (seed ${s}, tier ${t})`;
            if (/NaN|undefined/.test(inst.prompt)) bad = `prompt has NaN/undefined (seed ${s}, tier ${t})`;
            for (const p of inst.parts) {
              if (p.kind === 'numeric') {
                if (!Number.isFinite(p.answer)) bad = `${p.id} not finite (seed ${s}, tier ${t})`;
                for (const tr of p.traps || []) if (Math.abs(tr.value - p.answer) <= 0.02 * Math.abs(p.answer)) bad = `${p.id}: trap within 2 % (seed ${s}, tier ${t})`;
              }
              if (p.kind === 'matrix') {
                const big = Math.max(...p.answer.flat().map(Math.abs));
                if (p.answer.flat().some((x) => !Number.isFinite(x))) bad = `${p.id} matrix not finite (seed ${s}, tier ${t})`;
                for (const tr of p.traps || []) if (!tr.value.some((r, i) => r.some((x, j) => Math.abs(x - p.answer[i][j]) > 0.02 * big))) bad = `${p.id}: matrix trap within 2 % (seed ${s}, tier ${t})`;
              }
              if (p.kind === 'choice') {
                const nC = p.options.filter((o) => o.correct).length;
                if (p.multi ? nC < 1 : nC !== 1) bad = `${p.id}: ${nC} correct options (seed ${s}, tier ${t})`;
              }
            }
          }
        return isTrue(`${g.id}`, !bad, bad);
      }),
  },
];
