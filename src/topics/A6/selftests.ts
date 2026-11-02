// Self-tests for topic A6: reference values from official 2019 Q1e–f, 2017 A2, 2019 Q2, the 2023–2025 worked solutions
// (research notes A6.6), properties of proportional vs non-proportional damping, the MATLAB-style formatter and the generators.
import type { SelfTest } from '../../selftest/types';
import { isTrue, near, nearAbs } from '../../selftest/assert';
import type { C } from '../../physics/complex';
import { cabs, cmul, csub } from '../../physics/complex';
import { dampedModes, dampedModesSorted, fromEigenvalue, modeRatio, rayleighCoefficients, rayleighZeta, sortEigenvalues } from '../../physics/damped';
import { genSymEig } from '../../physics/linalg';
import { makeRng } from '../../engine/rng';
import { c4, drillSystem, eigListText, matlabCell, matlabDrill, matlabEig, ratio, sFromColumn, sortedModes } from './physics';
import { analyse, examOut, genOut, questions, readings, workedReading } from './drill';
import { generators } from './solve';

const TAU = 2 * Math.PI;
const z = (re: number, im = 0): C => ({ re, im });

export const tests: SelfTest[] = [
  {
    id: 'a6-2019-q1e',
    topic: 'A6',
    title: 'Official 2019 Q1e: −12.1 ± 1647.3i → ζ = 0.0073; −321 ± 5825.0i → ζ = 0.055',
    source: 'Official 2019 Q1e (answer b, statement c true); research notes ST-A6-01, 02',
    run: () => {
      const a = fromEigenvalue(z(-12.1, 1647.3));
      const b = fromEigenvalue(z(-321, 5825.0));
      return [
        near('mode 1 ωn = 1647.3444 rad/s', a.wn, 1647.3444, 1e-7),
        near('mode 1 ζ = 0.0073452', a.zeta, 0.0073452, 1e-4),
        near('mode 2 ωn = 5833.838 rad/s', b.wn, 5833.838, 1e-6),
        near('mode 2 ζ = 0.0550238', b.zeta, 0.0550238, 1e-5),
        near('the −Re/Im trap would give 0.0551073 (0.15 % off: harmless here)', 321 / 5825, 0.0551073, 1e-5),
        near('ωd/ωn of mode 2 = 0.99849 (damped ≈ undamped)', b.wd / b.wn, 0.99849, 1e-5),
      ];
    },
  },
  {
    id: 'a6-2023-2025',
    topic: 'A6',
    title: '2023 A1.1 and 2025 A1.5: unsorted eigenvalues, ζ and damped frequencies',
    source: '2023 A1.1 and 2025 A1.5 worked solutions (research notes ST-A6-03, 04)',
    run: () => {
      const d23 = sortEigenvalues([z(-0.2717, 31.1078), z(-0.2717, -31.1078), z(-0.038, 11.3775), z(-0.038, -11.3775)]);
      const d25 = sortEigenvalues([z(-0.1455, 53.0366), z(-0.1455, -53.0366), z(-0.0171, 15.2933), z(-0.0171, -15.2933)]);
      return [
        isTrue('2023: sorting puts the 11.38 rad/s pair first although it was printed second', Math.abs(d23[0].wn - 11.377563) < 1e-5 && d23.length === 2),
        near('2023 ζ₁ = 0.0033399', d23[0].zeta, 0.0033399, 1e-4),
        near('2023 ωn1 = 11.377563 rad/s (1.81080 Hz)', d23[0].wn / TAU, 1.8108, 1e-5),
        near('2023 ζ₂ = 0.0087338', d23[1].zeta, 0.0087338, 1e-4),
        near('2023 ωn2 = 31.108987 rad/s (4.95115 Hz)', d23[1].wn / TAU, 4.95115, 1e-5),
        near('2025 fd1 = 15.2933/2π = 2.43400 Hz', d25[0].wd / TAU, 2.434, 1e-5),
        near('2025 fd2 = 8.44104 Hz', d25[1].wd / TAU, 8.44104, 1e-5),
        near('2025 ζ₁ = 0.0011181', d25[0].zeta, 0.0011181, 1e-4),
        near('2025 ζ₂ = 0.0027434', d25[1].zeta, 0.0027434, 1e-4),
      ];
    },
  },
  {
    id: 'a6-matlab-p',
    topic: 'A6',
    title: 'Reading printed P matrices: official 2019 Q1f, 2023 A1.2, 2024 A1.1 (P without D)',
    source: 'Official 2019 Q1f (answer c); 2023 A1.2 and 2024 A1.1 worked solutions (research notes ST-A6-11..13)',
    run: () => {
      // 2019 P1, rows wheel x, rail x, wheel v, rail v.
      const m1 = ratio(z(0.06, -0.0012), z(0.998, 0)); // mode 1 rail/wheel (velocity rows)
      const m2 = ratio(z(0.0917, -0.0103), z(-0.996, 0)); // mode 2 wheel/rail
      // 2023 P column 3 (mode 1), rows X1, X2, V1, V2.
      const v23 = ratio(z(0.8804, 0), z(0.466, -0.0003));
      const x23 = ratio(z(-0.0003, -0.0774), z(-0.0002, -0.041));
      // 2024 P (no D), rows X1, X2, V1, V2.
      const col1 = [z(-0.0002, -0.0213), z(-0.0001, 0.0025), z(0.9928, 0), z(-0.1176, -0.0051)];
      const col3 = [z(0, 0.0054), z(0.0006, 0.0683), z(-0.0785, -0.001), z(-0.9946, 0)];
      const s1 = ratio(col1[2], col1[0]).z;
      const s3 = ratio(col3[2], col3[0]).z;
      return [
        near('2019 mode 1 |rail/wheel| = 0.060132', m1.mag, 0.060132, 1e-4),
        nearAbs('2019 mode 1 angle −1.146° (almost in phase)', m1.deg, -1.146, 0.01),
        near('2019 mode 2 |wheel/rail| = 0.092647', m2.mag, 0.092647, 1e-4),
        nearAbs('2019 mode 2 angle 173.59° (almost OUT of phase: statement (c) false)', m2.deg, 173.591, 0.01),
        near('2023 mode 1 V₂/V₁ = 1.889270', v23.z.re, 1.88927, 1e-4),
        nearAbs('2023 mode 1 angle ≈ 0.037° (in phase)', v23.deg, 0.0369, 0.002),
        near('2023 X₂/X₁ from the displacement rows = 1.8878 (same ratio, fewer digits)', x23.z.re, 1.887796, 1e-3),
        near('2024 s(col 1) from V₁/X₁: |s| ≈ 46.61 rad/s', cabs(s1), 46.608, 1e-3),
        near('2024 s(col 3): |s| ≈ 14.54 rad/s → columns 3–4 are mode 1', cabs(s3), 14.5382, 1e-3),
        near('2024 mode 1 V₂/V₁ = 12.668', ratio(col3[3], col3[2]).z.re, 12.66801, 1e-4),
        near('2024 mode 2 V₂/V₁ = −0.11845', ratio(col1[3], col1[2]).z.re, -0.118453, 1e-4),
      ];
    },
  },
  {
    id: 'a6-proportional',
    topic: 'A6',
    title: 'Proportional damping C = 0.5M + 0.001K: ζᵢ = α/2ωᵢ + βωᵢ/2 and real mode shapes',
    source: 'LA9 Eqs 9.4–9.7; research notes ST-A6-07 (numbers recomputed)',
    run: () => {
      const M = [
        [2, 0],
        [0, 1],
      ];
      const K = [
        [3000, -1000],
        [-1000, 1000],
      ];
      const Cd = M.map((r, i) => r.map((m, j) => 0.5 * m + 0.001 * K[i][j]));
      const md = dampedModesSorted(M, Cd, K);
      const r = md.map((m) => ratio(m.X[1], m.X[0]));
      return [
        near('mode 1 s = −0.5 + 22.35509i (Im)', md[0].s.im, 22.35509, 1e-6),
        nearAbs('mode 1 Re s = −0.5', md[0].s.re, -0.5, 1e-9),
        near('mode 1 ζ = 0.022361 = α/2ω + βω/2', md[0].zeta, rayleighZeta(0.5, 0.001, Math.sqrt(500)), 1e-9),
        near('mode 2 ωn = 44.72136 rad/s (unchanged by damping)', md[1].wn, 44.72136, 1e-6),
        near('mode 2 ζ = 0.027951', md[1].zeta, 0.027951, 1e-4),
        near('mode 1 ratio X₂/X₁ = 2 (the undamped value)', r[0].mag, 2, 1e-9),
        nearAbs('mode 1 angle 0°', r[0].deg, 0, 1e-6),
        nearAbs('mode 2 |angle| = 180°', Math.abs(r[1].deg), 180, 1e-6),
      ];
    },
  },
  {
    id: 'a6-nonproportional',
    topic: 'A6',
    title: 'Non-proportional damping (damper on mass 1 only): complex modes, phases 8.64° and 162.79°',
    source: 'Research notes ST-A6-08 (numbers recomputed with numpy)',
    run: () => {
      const M = [
        [2, 0],
        [0, 1],
      ];
      const K = [
        [3000, -1000],
        [-1000, 1000],
      ];
      const md = dampedModesSorted(
        M,
        [
          [20, 0],
          [0, 0],
        ],
        K
      );
      const r = md.map((m) => ratio(m.X[1], m.X[0]));
      const resid = md.map((m) => {
        // (M s² + C s + K) X should vanish.
        const s2 = cmul(m.s, m.s);
        let worst = 0;
        for (let i = 0; i < 2; i++) {
          let acc: C = { re: 0, im: 0 };
          for (let j = 0; j < 2; j++) {
            const a: C = { re: M[i][j] * s2.re + (i === 0 && j === 0 ? 20 : 0) * m.s.re + K[i][j], im: M[i][j] * s2.im + (i === 0 && j === 0 ? 20 : 0) * m.s.im };
            acc = { re: acc.re + cmul(a, m.X[j]).re, im: acc.im + cmul(a, m.X[j]).im };
          }
          worst = Math.max(worst, cabs(acc));
        }
        return worst;
      });
      return [
        nearAbs('mode 1 angle 8.636°', r[0].deg, 8.6358, 0.001),
        nearAbs('mode 2 angle 162.794°', r[1].deg, 162.7938, 0.001),
        near('mode 1 ωn = 22.5299 rad/s (shifted from 22.3607)', md[0].wn, 22.5299, 1e-5),
        near('mode 2 ωn = 44.3855 rad/s (shifted from 44.7214)', md[1].wn, 44.3855, 1e-5),
        nearAbs('(Ms² + Cs + K)X = 0 for both modes', Math.max(...resid), 0, 1e-8),
      ];
    },
  },
  {
    id: 'a6-sdof-forms',
    topic: 'A6',
    title: 'SDOF eigenvalues: ζ = 0.05, ζ = 2 (overdamped) and the 2017 A2 sway form',
    source: 'LA9 Eq 9.9; official 2017 A2(f) formula (research notes ST-A6-05, 06, 10)',
    run: () => {
      const one = (m: number, c: number, k: number) => dampedModes([[m]], [[c]], [[k]]);
      const a = one(1, 2 * 0.05 * 10, 100);
      const b = one(1, 2 * 2 * 1, 1).map((x) => x.s.re).sort((p, q) => p - q);
      const sway = one(100, 2 * 200, 2 * 5e4);
      return [
        near('ζ = 0.05, ωn = 10: s = −0.5 + 9.987492i', a[0].s.im, 9.987492, 1e-6),
        nearAbs('Re s = −ζωn = −0.5', a[0].s.re, -0.5, 1e-9),
        near('ζ = 2: slow real root −0.267949', b[1], -0.267949, 1e-5),
        near('ζ = 2: fast real root −3.732051', b[0], -3.732051, 1e-6),
        near('2017 A2 form: λ = −cx/m ± i√(2kx/m − (cx/m)²) = −2 ± 31.559468i', sway[0].s.im, 31.559468, 1e-6),
        nearAbs('2017 A2 form: Re λ = −2', sway[0].s.re, -2, 1e-9),
      ];
    },
  },
  {
    id: 'a6-rayleigh',
    topic: 'A6',
    title: 'Rayleigh design (ζ = 0.02 at 10 and 100 rad/s) and the 2019 Q2 belt drive ζ = (c/2k)ωn',
    source: 'LA9 Eq 9.7; official 2019 Q2(5)–(6) formula (research notes ST-A6-09, 15)',
    run: () => {
      const { alpha, beta } = rayleighCoefficients(0.02, 10, 0.02, 100);
      const R1 = 0.05;
      const R2 = 0.15;
      const k = 2e4;
      const c = 30;
      const K = [
        [2 * k * R1 * R1, -2 * k * R1 * R2],
        [-2 * k * R1 * R2, 2 * k * R2 * R2],
      ];
      const Cd = K.map((r) => r.map((v) => (v * c) / k));
      const md = dampedModes(
        [
          [0.05, 0],
          [0, 0.4],
        ],
        Cd,
        K
      ).filter((m) => m.s.im > 0);
      const wn = Math.sqrt(2 * k * (R1 * R1 / 0.05 + R2 * R2 / 0.4));
      return [
        near('α = 0.3636364 s⁻¹', alpha, 0.3636364, 1e-6),
        near('β = 3.636364×10⁻⁴ s', beta, 3.636364e-4, 1e-6),
        near('ζ at √1000 rad/s = 0.0114992 (the dip between targets)', rayleighZeta(alpha, beta, Math.sqrt(1000)), 0.0114992, 1e-5),
        near('belt: ζ = cωn/2k = 0.048894', (c * wn) / (2 * k), 0.048894, 1e-5),
        near('belt: state-space ζ agrees', md[0].zeta, 0.048894, 1e-5),
        near('belt: s = −3.1875 + 65.11405i', md[0].s.im, 65.11405, 1e-6),
      ];
    },
  },
  {
    id: 'a6-free-free',
    topic: 'A6',
    title: 'Free pair with a damper between the masses: −1 ± 14.10674i and a double zero (rigid body)',
    source: 'Research notes ST-A6-14 (state space + LA8)',
    run: () => {
      const md = dampedModes(
        [
          [1, 0],
          [0, 1],
        ],
        [
          [1, -1],
          [-1, 1],
        ],
        [
          [100, -100],
          [-100, 100],
        ]
      );
      const osc = md.find((m) => m.s.im > 0);
      const small = md.filter((m) => cabs(m.s) < 1e-6).length;
      return [near('Im s = 14.10674', osc ? osc.s.im : NaN, 14.10674, 1e-6), nearAbs('Re s = −1', osc ? osc.s.re : NaN, -1, 1e-9), isTrue('two eigenvalues at s = 0 (rigid body)', small === 2, `${small} found`)];
    },
  },
  {
    id: 'a6-matlab-format',
    topic: 'A6',
    title: 'MATLAB-style [P, D]: unit columns, largest entry real, V = sX, “-0.0000” printing, s ≈ V/X',
    source: 'LA9 p62 (MATLAB normalisation); research notes A6.5A recipe and C-A3-3',
    run: () => {
      const rng = makeRng(2023);
      let worstNorm = 0;
      let worstVsX = 0;
      let worstImag = 0;
      let worstEst = 0;
      for (let n = 0; n < 40; n++) {
        const sys = drillSystem(rng);
        const cols = matlabEig(sys.M, sys.C, sys.K, [2, 1], [1, -1]);
        for (const c of cols) {
          const nrm = Math.sqrt(c.v.reduce((t, q) => t + q.re * q.re + q.im * q.im, 0));
          worstNorm = Math.max(worstNorm, Math.abs(nrm - 1));
          let big = 0;
          let at = 0;
          c.v.forEach((q, i) => {
            if (cabs(q) > big) {
              big = cabs(q);
              at = i;
            }
          });
          worstImag = Math.max(worstImag, Math.abs(c.v[at].im));
          for (let i = 0; i < 2; i++) worstVsX = Math.max(worstVsX, cabs(csub(cmul(c.s, c.v[i]), c.v[2 + i])));
          const est = sFromColumn(c.v.map(c4), 2);
          worstEst = Math.max(worstEst, Math.abs(cabs(est.s) / cabs(c.s) - 1));
        }
      }
      return [
        nearAbs('every column has unit 2-norm', worstNorm, 0, 1e-12),
        nearAbs('largest entry of each column is real', worstImag, 0, 1e-15),
        nearAbs('velocity rows = s × displacement rows', worstVsX, 0, 1e-9),
        isTrue('|V/X| from the printed 4-decimal column is within 2 % of |s|', worstEst < 0.02, `worst ${(worstEst * 100).toFixed(2)} %`),
        isTrue('tiny negative prints as “-0.0000 - 0.0299i”', matlabCell({ re: -0.00003, im: -0.0299 }) === '-0.0000 - 0.0299i', matlabCell({ re: -0.00003, im: -0.0299 })),
        isTrue('2023-style D entry prints as “-0.2717 +31.1078i”', eigListText([{ re: -0.2717, im: 31.1078 }])[0][0] === '-0.2717 +31.1078i', eigListText([{ re: -0.2717, im: 31.1078 }])[0][0]),
      ];
    },
  },
  {
    id: 'a6-drill-replays',
    topic: 'A6',
    title: 'MATLAB drill replays read from the printed numbers: 2019 Q1e–f, 2023 A1.1–1.2, 2024 A1.1, 2025 A1.5',
    source: 'Official 2019 Q1e–f; 2023 A1.1–1.2, 2024 A1.1, 2025 A1.5 worked solutions (research notes ST-A6-01..04, 11..13)',
    run: () => {
      const ans = (out: ReturnType<typeof examOut>, id: string) => {
        const p = questions(out).find((q) => q.id === id);
        if (!p) return NaN;
        if (p.kind === 'numeric') return p.answer;
        return p.kind === 'choice' ? p.options.findIndex((o) => o.correct) : NaN;
      };
      const pick = (out: ReturnType<typeof examOut>, id: string) => {
        const p = questions(out).find((q) => q.id === id);
        return p && p.kind === 'choice' ? p.options.find((o) => o.correct)?.text ?? '' : '';
      };
      const y19 = examOut('y2019');
      const y23 = examOut('y2023');
      const y24 = examOut('y2024');
      const y25 = examOut('y2025');
      const a19 = analyse(y19, { r: 0, c: 2 }, { r: 1, c: 2 });
      const v19 = analyse(y19, { r: 3, c: 2 }, { r: 2, c: 2 });
      return [
        near('2019 ζ₁ from −12.1 ± 1647.3i = 0.0073452', ans(y19, 'z1'), 0.0073452, 1e-4),
        isTrue('2019: columns 1–2 are mode 1 (printed in order)', pick(y19, 'cols') === 'Columns 1–2'),
        near('2019 mode 1 rail/wheel = +0.06013 (velocity rows, in phase)', ans(y19, 'r1'), 0.060132, 1e-3),
        near('2019 mode 2 rail/wheel = −10.794 (wheel/rail 0.0926∠173.6°)', ans(y19, 'r2'), -10.7936, 1e-3),
        isTrue('2019 mode 2 is almost out of phase (official Q1f answer c)', pick(y19, 'ph2') === 'Almost out of phase'),
        isTrue('inspector: ratio of the two rounded 2019 mode-2 displacements is flagged', a19.tone === 'bad' && /Rounded/.test(a19.text), a19.tone),
        isTrue('inspector: v_rail/v_wheel in column 3 reads out of phase', v19.tone === 'ok' && /out of phase/.test(v19.text), v19.text),
        isTrue('2023: columns 3–4 are mode 1 (the higher mode was printed first)', pick(y23, 'cols') === 'Columns 3–4'),
        near('2023 ζ₁ = 0.0033399', ans(y23, 'z1'), 0.0033399, 1e-4),
        near('2023 f₁ = 1.81080 Hz', ans(y23, 'f1'), 1.8108, 1e-4),
        near('2023 mode 1 V₂/V₁ = 1.88927 (in phase)', ans(y23, 'r1'), 1.88927, 1e-4),
        isTrue('2023 mode 2 is out of phase (V₂/V₁ = −0.397)', pick(y23, 'ph2') === 'Almost out of phase'),
        near('2024 |s| of columns 1–2 from V₁/X₁ = 46.608 rad/s', ans(y24, 'w12'), 46.608, 1e-3),
        isTrue('2024: columns 3–4 are mode 1', pick(y24, 'cols') === 'Columns 3–4'),
        near('2024 mode 1 V₂/V₁ = 12.669 (12.668 − 0.161i)', ans(y24, 'r1'), 12.669, 1e-3),
        near('2024 mode 2 V₂/V₁ = −0.11856', ans(y24, 'r2'), -0.11856, 1e-3),
        near('2025 fd₁ = 2.43400 Hz', ans(y25, 'fd1'), 2.434, 1e-4),
        near('2025 fd₂ = 8.44104 Hz', ans(y25, 'fd2'), 8.44104, 1e-5),
        near('2025 ζ₁ = 0.0011181', ans(y25, 'z1'), 0.0011181, 1e-4),
      ];
    },
  },
  {
    id: 'a6-drill-generated',
    topic: 'A6',
    title: 'Generated MATLAB drills (150 seeds × 3 variants): answers from the printed digits match the exact modes',
    source: 'Consistency of explore/MatlabDrill with the state-space eigen-solution (LA9 Eqs 9.12–9.14)',
    run: () => {
      let bad = '';
      let worstRatio = 0;
      let worstW = 0;
      for (let seed = 1; seed <= 150 && !bad; seed++)
        for (const v of ['PD', 'P', 'eig'] as const) {
          const out = genOut(seed * 104729, v);
          const qs = questions(out);
          const d = matlabDrill(makeRng(seed * 104729)); // the same system genOut printed
          const exact = sortedModes(d.sys.M, d.sys.C, d.sys.K);
          for (const q of qs) {
            if (q.kind === 'numeric' && !Number.isFinite(q.answer)) bad = `${q.id} not finite (seed ${seed}, ${v})`;
            if (q.kind === 'numeric') for (const t of q.traps || []) if (Math.abs(t.value - q.answer) <= 0.02 * Math.abs(q.answer)) bad = `${q.id}: trap within 2 % (seed ${seed}, ${v})`;
            if (q.kind === 'choice' && q.options.filter((o) => o.correct).length !== 1) bad = `${q.id}: needs one correct option (seed ${seed}, ${v})`;
          }
          const R = readings(out);
          if (R.r1 && R.r2) {
            const e1 = modeRatio(exact[0].X, 0, 1);
            const e2 = modeRatio(exact[1].X, 0, 1);
            worstRatio = Math.max(worstRatio, Math.abs(R.r1.mag / e1.mag - 1), Math.abs(R.r2.mag / e2.mag - 1));
          }
          if (v === 'P') worstW = Math.max(worstW, Math.abs(R.e1.wn / exact[0].wn - 1), Math.abs(R.e2.wn / exact[1].wn - 1));
          if (/NaN|undefined|Infinity/.test(workedReading(out))) bad = `NaN in the worked reading (seed ${seed}, ${v})`;
        }
      return [
        isTrue('every question finite, traps > 2 % away, one correct option', !bad, bad),
        nearAbs('worst relative error of |V₂/V₁| from printed digits vs exact |X₂/X₁|', worstRatio, 0, 0.01),
        nearAbs('worst relative error of |s| ≈ |V/X| (P only) vs exact ωn', worstW, 0, 0.03),
      ];
    },
  },
  {
    id: 'a6-sim-claims',
    topic: 'A6',
    title: 'Numbers quoted in the A6 simulations (s-plane, complex modes, Rayleigh designer)',
    source: 'Research notes SIM-A6-1..3 and ST-A6-07..09; recomputed here',
    run: () => {
      const chain = (m1: number, m2: number, k1: number, k2: number, c1: number, c2: number) =>
        dampedModesSorted(
          [
            [m1, 0],
            [0, m2],
          ],
          [
            [c1 + c2, -c2],
            [-c2, c2],
          ],
          [
            [k1 + k2, -k2],
            [-k2, k2],
          ]
        );
      const twice = chain(2, 1, 2000, 1000, 40, 0).map((m) => modeRatio(m.X, 0, 1));
      const prop = chain(2, 1, 2000, 1000, 4, 2);
      const y24 = chain(1.5, 1, 3000, 230, 0.6, 0.3);
      const r24 = y24.map((m) => modeRatio(m.X, 0, 1));
      const frame = genSymEig(
        [
          [5000, -2500, 0],
          [-2500, 5000, -2500],
          [0, -2500, 2500],
        ],
        [
          [1, 0, 0],
          [0, 1, 0],
          [0, 0, 1],
        ]
      ).omega2.map(Math.sqrt);
      const up = fromEigenvalue(z(-0.5, 2 * 9.987492));
      return [
        nearAbs('c₁ = 40: mode 1 angle 17.90°', twice[0].phaseDeg, 17.904, 0.01),
        near('c₁ = 40: |X₂/X₁| = 1.937 (−2.4 % from 1.985)', twice[0].mag, 1.9372, 1e-3),
        near('C = 0.002K: ζ₁ = βω₁/2 = 0.02236', prop[0].zeta, 0.022361, 1e-4),
        near('C = 0.002K: ζ₂ = 0.04472', prop[1].zeta, 0.044721, 1e-4),
        nearAbs('C ∝ K: real modes, angles 0° and 180°', Math.abs(modeRatio(prop[0].X, 0, 1).phaseDeg) + Math.abs(180 - Math.abs(modeRatio(prop[1].X, 0, 1).phaseDeg)), 0, 1e-6),
        near('2024-like chain: mode 1 |X₂/X₁| = 12.66', r24[0].mag, 12.6615, 1e-3),
        nearAbs('2024-like chain: mode 1 angle −0.94°', r24[0].phaseDeg, -0.94, 0.01),
        near('2024-like chain: mode 2 |X₂/X₁| = 0.1186', r24[1].mag, 0.1186, 2e-3),
        near('2024-like chain: ωn = 14.555 and 46.599 rad/s', y24[0].wn + y24[1].wn, 14.5547 + 46.5988, 1e-4),
        near('frame (k/m = 2500 s⁻²) ω₁ = 22.252 rad/s = 100 sin(π/14)', frame[0], 100 * Math.sin(Math.PI / 14), 1e-9),
        near('frame ω₂ = 62.349 rad/s', frame[1], 62.349, 1e-4),
        near('frame ω₃ = 90.097 rad/s', frame[2], 90.097, 1e-4),
        near('stiffness-only β = 1 ms: ζ₃ = 0.0450', rayleighZeta(0, 0.001, frame[2]), 0.04505, 1e-3),
        near('mass-only α = 2: ζ₁ = 0.0449', rayleighZeta(2, 0, frame[0]), 0.044940, 1e-3),
        near('s-plane: Re s fixed at −0.5, Im doubled → ωn = 19.981 rad/s', up.wn, 19.981, 1e-4),
        near('… and ζ halves to 0.02502', up.zeta, 0.025023, 1e-3),
        near('ζ = 2 slow root −0.2679ωn', -2 + Math.sqrt(3), -0.267949, 1e-5),
      ];
    },
  },
  {
    id: 'a6-generators',
    topic: 'A6',
    title: 'Every A6 generator builds valid problems at every tier (60 seeds)',
    run: () =>
      generators.map((g) => {
        let bad = '';
        for (let s = 1; s <= 60 && !bad; s++)
          for (const t of g.tiers) {
            const inst = g.generate(makeRng(s * 7919 + 29), t);
            if (inst.hints.length !== 4) bad = `needs 4 hints (seed ${s}, tier ${t})`;
            for (const p of inst.parts) {
              if (p.kind === 'numeric') {
                if (!Number.isFinite(p.answer)) bad = `${p.id} not finite (seed ${s}, tier ${t})`;
                for (const tr of p.traps || []) if (Math.abs(tr.value - p.answer) <= 0.02 * Math.abs(p.answer)) bad = `${p.id}: trap within 2 % of the answer (seed ${s}, tier ${t})`;
              }
              if (p.kind === 'choice' && p.options.filter((o) => o.correct).length !== 1) bad = `${p.id} must have exactly one correct option (seed ${s}, tier ${t})`;
            }
            if (/NaN|undefined|Infinity/.test(inst.prompt + inst.hints.join(' '))) bad = `NaN/undefined in text (seed ${s}, tier ${t})`;
          }
        return isTrue(`${g.id}`, !bad, bad);
      }),
  },
];
