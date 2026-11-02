// Self-tests for topic A3: reference values from the Week 3–5 quizzes, 2022–2025 worked solutions, the official
// 2017–2019 answers and the reader's worked examples (research notes A3.6), plus property and generator checks.
import type { SelfTest } from '../../selftest/types';
import { ascending, isTrue, near, nearAbs } from '../../selftest/assert';
import { genSymEig } from '../../physics/linalg';
import { modalFreeResponse, modalInitialConditions, modes } from '../../physics/mdof';
import { integrate } from '../../physics/ode';
import { makeRng } from '../../engine/rng';
import { chainKM, det2, inv2, modeTable, mul, mulT, quad, rowRatios, twoDof } from './physics';
import { generators } from './solve';

const TAU = 2 * Math.PI;

export const tests: SelfTest[] = [
  {
    id: 'a3-week3',
    topic: 'A3',
    title: 'Week 3 quiz: forging chain f₁, free wagons f₂, torsion ratio r₂',
    source: 'Week 3 Q1–Q3 worked solutions (research notes ST-A3-05, 06, 08)',
    run: () => {
      const q1 = twoDof(chainKM(211094, 105547, 3.65e8, 7.3e8, 0).K, chainKM(211094, 105547, 3.65e8, 7.3e8, 0).M);
      const q2 = twoDof(
        [
          [44e6, -44e6],
          [-44e6, 44e6],
        ],
        [
          [73000, 0],
          [0, 81000],
        ]
      );
      const q3 = twoDof(
        [
          [2, -1],
          [-1, 1],
        ],
        [
          [1, 0],
          [0, 2],
        ]
      );
      return [
        near('Q1 ω₁ = 32.9451 rad/s', q1.omega[0], 32.9451, 1e-5),
        near('Q1 f₁ = 5.24338 Hz (the asked “ω₁ (Hz)”)', q1.omega[0] / TAU, 5.24338, 1e-5),
        near('Q1 ω₂ = 104.9678 rad/s', q1.omega[1], 104.9678, 1e-5),
        near('Q1 r₁ = 1.186141', q1.r[0], 1.186141, 1e-5),
        near('Q1 r₂ = −1.686141', q1.r[1], -1.686141, 1e-5),
        near('Q1 r₁r₂ = −m₁/m₂ = −2', q1.r[0] * q1.r[1], -2, 1e-9),
        nearAbs('Q2 ω₁ = 0 (rigid)', q2.omega[0], 0, 1e-6),
        near('Q2 f₂ = 5.38769 Hz', q2.omega[1] / TAU, 5.38769, 1e-5),
        near('Q2 flexible ratio −m₁/m₂ = −0.901235', q2.r[1], -0.901235, 1e-5),
        near('Q3 r₂ = (3 − √17)/4 = −0.280776', q3.r[1], (3 - Math.sqrt(17)) / 4, 1e-9),
        near('Q3 r₁ = (3 + √17)/4 = 1.780776', q3.r[0], (3 + Math.sqrt(17)) / 4, 1e-9),
      ];
    },
  },
  {
    id: 'a3-reader',
    topic: 'A3',
    title: 'Reader examples: double pendulum, LA4 car, two-gear shaft (golden ratio)',
    source: 'LA4 Eqs 4.4–4.8, 4.11–4.17, p30 (research notes ST-A3-01..03)',
    run: () => {
      const dp = twoDof(
        [
          [2, 0],
          [0, 1],
        ],
        [
          [2, 1],
          [1, 1],
        ]
      );
      const car = modes(
        [
          [40000, 15000],
          [15000, 67500],
        ],
        [
          [1000, 0],
          [0, 810],
        ]
      );
      const carRatio = (j: number) => car.P[0][j] / car.P[1][j]; // Ax/Aθ
      const gear = twoDof(
        [
          [2, -1],
          [-1, 1],
        ],
        [
          [1, 0],
          [0, 1],
        ]
      );
      return [
        near('double pendulum ω₁ = √(2 − √2) = 0.765367', dp.omega[0], Math.sqrt(2 - Math.SQRT2), 1e-9),
        near('double pendulum ω₂ = √(2 + √2) = 1.847759', dp.omega[1], Math.sqrt(2 + Math.SQRT2), 1e-9),
        near('double pendulum θ₂/θ₁ = +√2 (mode 1)', dp.r[0], Math.SQRT2, 1e-9),
        near('double pendulum θ₂/θ₁ = −√2 (mode 2)', dp.r[1], -Math.SQRT2, 1e-9),
        near('LA4 car ω₁ = 5.85929 rad/s', car.omega[0], 5.85929, 1e-5),
        near('LA4 car ω₂ = 9.43409 rad/s', car.omega[1], 9.43409, 1e-5),
        near('LA4 car mode 1 Ax/Aθ = −2.64611 m/rad', carRatio(0), -2.64611, 1e-5),
        near('LA4 car mode 2 Ax/Aθ = +0.30611 m/rad', carRatio(1), 0.30611, 1e-4),
        near('nodes multiply to −J/m = −0.81 m²', carRatio(0) * carRatio(1), -0.81, 1e-9),
        near('gear shaft ω₁ = 0.618034 √(k/I)', gear.omega[0], (Math.sqrt(5) - 1) / 2, 1e-9),
        near('gear shaft θ₃/θ₁ = 1.618034 (corrected label, C-A3-1)', gear.r[0], (1 + Math.sqrt(5)) / 2, 1e-9),
      ];
    },
  },
  {
    id: 'a3-2022',
    topic: 'A3',
    title: '2022 A2.2–A2.5 cart–rod: frequencies, ratios, modal ICs, single-mode angle',
    source: '2022 A2.2–A2.5 worked solution (research notes ST-A3-14)',
    run: () => {
      const M = [
        [8, 3],
        [3, 4],
      ];
      const K = [
        [10, 0],
        [0, 30],
      ];
      const s = twoDof(K, M);
      const Y0 = mul(inv2(s.P), [1, 0]);
      return [
        near('ω₁ = 1.089589 rad/s', s.omega[0], 1.089589, 1e-6),
        near('ω₂ = 3.314620 rad/s', s.omega[1], 3.31462, 1e-6),
        near('r₁ = θ/x = 0.141048', s.r[0], 0.141048, 1e-5),
        near('r₂ = −2.363270', s.r[1], -2.36327, 1e-6),
        near('y₁₀ = 0.943678 for X₀ = [1; 0]', Y0[0], 0.943678, 1e-5),
        near('y₂₀ = 0.056322', Y0[1], 0.056322, 1e-4),
        near('θ(t) amplitude r₁y₁₀ = 0.133103 rad', s.r[0] * Y0[0], 0.133103, 1e-4),
        near('single-mode angle θ₀ = r₁x₀ = 8.08° for x₀ = 1', (s.r[0] * 180) / Math.PI, 8.0815, 1e-3),
      ];
    },
  },
  {
    id: 'a3-2023',
    topic: 'A3',
    title: '2023 A2.3–A2.4 platform modes and A1.3 truncated superposition',
    source: '2023 A2.3–A2.4 and A1.3 worked solutions (research notes ST-A3-15, 16)',
    run: () => {
      const M = [
        [20, 0],
        [0, 1.6773],
      ];
      const K = [
        [225, 100],
        [100, 80],
      ];
      const s = modes(K, M);
      const xt = (j: number) => s.P[0][j] / s.P[1][j];
      // Table A1.1 (rows = modes), DoF 3 entries and frequencies; Y0 as given.
      const dof3 = [0.352, -0.432, 0.409, 0.478, 0.273, -0.711];
      const f = [1.227, 3.441, 6.212, 7.843, 9.274, 9.905];
      const y0 = [0.03, 0.05, 0.1, 0.12, 0.18, 0.29];
      const coef = dof3.map((p, i) => p * y0[i]);
      return [
        near('ω₁ = 2.090372 rad/s', s.omega[0], 2.090372, 1e-5),
        near('ω₂ = 7.387560 rad/s', s.omega[1], 7.38756, 1e-5),
        near('mode 1 X/Θ = −0.726708 m/rad', xt(0), -0.726708, 1e-4),
        near('mode 2 X/Θ = +0.115404 m/rad', xt(1), 0.115404, 1e-4),
        near('x₃: cos 7.709t coefficient 0.01056 m', coef[0], 0.01056, 1e-9),
        near('x₃: cos 21.62t coefficient −0.0216 m', coef[1], -0.0216, 1e-9),
        near('x₃: cos 39.03t coefficient 0.0409 m', coef[2], 0.0409, 1e-9),
        near('ω₃ = 2π(6.212) = 39.03115 rad/s', TAU * f[2], 39.03115, 1e-6),
        near('three modes: x₃(0) = 0.02986 m', coef[0] + coef[1] + coef[2], 0.02986, 1e-6),
        near('all six modes: x₃(0) = −0.06983 m (truncation poor)', coef.reduce((a, b) => a + b, 0), -0.06983, 1e-3),
      ];
    },
  },
  {
    id: 'a3-modal-ic',
    topic: 'A3',
    title: 'Week 4 Q4 hammer blow: P⁻¹ (not Pᵀ), modal velocities, max foundation displacement',
    source: 'Week 4 Q4 worked solution (research notes ST-A3-10); summary notes trap 3',
    run: () => {
      const P = [
        [1, 1],
        [1.0595, -2.3593],
      ];
      const Pi = inv2(P);
      const yd = mul(Pi, [0, 147]);
      const A = yd[0] / 37.48;
      const B = yd[1] / 188.67;
      let mx = 0;
      for (let t = 0; t <= 20; t += 2e-5) mx = Math.max(mx, Math.abs(A * Math.sin(37.48 * t) + B * Math.sin(188.67 * t)));
      const viaLib = modalInitialConditions(P, [0, 0], [0, 147]).yd0;
      const wrong = mulT(P, [0, 147]);
      return [
        near('P⁻¹₁₁ = 0.690096', Pi[0][0], 0.690096, 1e-5),
        near('P⁻¹₁₂ = 0.2925', Pi[0][1], 0.2925, 1e-4),
        near('ẏ₁₀ = 42.9975 mm/s', yd[0], 42.9975, 1e-5),
        near('ẏ₂₀ = −42.9975 mm/s', yd[1], -42.9975, 1e-5),
        near('library modalInitialConditions agrees', viaLib[0], yd[0], 1e-12),
        near('x₁ mode-1 amplitude 1.147213 mm', A, 1.147213, 1e-5),
        near('x₁ mode-2 amplitude −0.227898 mm', B, -0.227898, 1e-5),
        near('max |x₁| over 20 s = 1.37511 mm', mx, 1.37511, 2e-4),
        isTrue('Pᵀẋ₀ differs from P⁻¹ẋ₀ (the trap is real)', Math.abs(wrong[0] - yd[0]) > 10, `Pᵀẋ₀ = [${wrong.map((v) => v.toFixed(2))}]`),
      ];
    },
  },
  {
    id: 'a3-modal-forces',
    topic: 'A3',
    title: 'Modal forces PᵀF (Week 4 Q2, official 2019 Q1c) and the step response (2019 Q1d)',
    source: 'Week 4 Q2 worked solution; official 2019 Q1c–d answers (research notes ST-A3-09, 12, 13)',
    run: () => {
      const Pw = [
        [-2.6461, 0.3061],
        [1, 1],
      ];
      const ft = mulT(Pw, [-100, -1275]);
      const pf = mul(Pw, [-100, -1275]);
      const P19 = [
        [0.998, -0.092],
        [0.06, 0.996],
      ];
      const f19 = mulT(P19, [13, -13]); // kN
      const y1 = (f19[0] * 1000) / 1.224e9;
      const y2 = (f19[1] * 1000) / 23.41e9;
      return [
        near('Week 4 Q2: (PᵀF)₁ = −1010.39', ft[0], -1010.39, 1e-5),
        near('Week 4 Q2: (PᵀF)₂ = −1305.61', ft[1], -1305.61, 1e-5),
        near('Week 4 Q2 distractor: (PF)₁ = −125.67', pf[0], -125.6675, 1e-5),
        near('2019 Q1c: f̃₁ = 12.194 kN', f19[0], 12.194, 1e-6),
        near('2019 Q1c: f̃₂ = −14.144 kN', f19[1], -14.144, 1e-6),
        near('2019 Q1d: ω₁ = √(0.2714×10⁷) = 1647.42 rad/s', Math.sqrt(0.2714e7), 1647.42, 1e-5),
        near('2019 Q1d: x₁ coefficient P₁₁y₁ = 9.9425 µm', 0.998 * y1 * 1e6, 9.9425, 1e-4),
        near('2019 Q1d: x₁ coefficient P₁₂y₂ = +0.0556 µm', -0.092 * y2 * 1e6, 0.05558, 1e-3),
      ];
    },
  },
  {
    id: 'a3-rigid',
    topic: 'A3',
    title: 'Semi-definite systems: belt drive, geared drive, free three-rotor shaft, LA8 repeated roots',
    source: 'Official 2019 Q2 and 2018 A2 formulas; Week 5 Q4; LA8 Eqs 8.5–8.12 (research notes ST-A3-04, 11, 20, 21)',
    run: () => {
      // Belt drive sample: IT = 0.05, IP = 0.4, R1 = 0.05, R2 = 0.15, k = 2e4 (each side).
      const R1 = 0.05;
      const R2 = 0.15;
      const k = 2e4;
      const belt = twoDof(
        [
          [2 * k * R1 * R1, -2 * k * R1 * R2],
          [-2 * k * R1 * R2, 2 * k * R2 * R2],
        ],
        [
          [0.05, 0],
          [0, 0.4],
        ]
      );
      const kFor10Hz = (TAU * 10) ** 2 / (2 * (R1 * R1 / 0.05 + R2 * R2 / 0.4));
      // Geared drive: Im = 0.2, IL = 3, G = 4, kT = 1e4; coordinates θG, θL.
      const gear = twoDof(
        [
          [1e4, -1e4],
          [-1e4, 1e4],
        ],
        [
          [0.2 * 16, 0],
          [0, 3],
        ]
      );
      const shaft = modes(
        [
          [1, -1, 0],
          [-1, 2, -1],
          [0, -1, 1],
        ],
        [
          [1, 0, 0],
          [0, 2, 0],
          [0, 0, 1],
        ]
      );
      const wing = genSymEig(
        [
          [1, -2, 1],
          [-2, 4, -2],
          [1, -2, 1],
        ],
        [
          [1, 0, 0],
          [0, 2, 0],
          [0, 0, 1],
        ]
      );
      const Pw = [
        [1, -1, 1],
        [1, 0, -1],
        [1, 1, 1],
      ];
      const Mw = [
        [1, 0, 0],
        [0, 2, 0],
        [0, 0, 1],
      ];
      const col = (j: number) => Pw.map((r) => r[j]);
      return [
        nearAbs('belt: ω₁ = 0 (rigid)', belt.omega[0], 0, 1e-6),
        near('belt: rigid θ₂/θ₁ = R₁/R₂ = 1/3', belt.r[0], 1 / 3, 1e-9),
        near('belt: ω² = 4250 s⁻²', belt.omega2[1], 4250, 1e-9),
        near('belt: flexible θ₂/θ₁ = −(R₂/R₁)(I_T/I_P) = −0.375', belt.r[1], -0.375, 1e-9),
        near('belt: k for 10 Hz = 18 578 N/m', kFor10Hz, 18578.1, 1e-5),
        near('gear: ω² = 6458.333 s⁻²', gear.omega2[1], 6458.333, 1e-6),
        near('gear: flexible θ_L/θ_G = −I_mG²/I_L → θ_G/θ_L = −0.9375', 1 / gear.r[1], -0.9375, 1e-9),
        ...[0, 1, 2].map((i) => nearAbs(`free shaft λ${i + 1} = ${i}`, shaft.omega2[i], i, 1e-9)),
        near('free shaft mode 3 = [1, −1, 1]', shaft.P[1][2], -1, 1e-9),
        nearAbs('LA8 wing: λ₁ = 0', wing.omega2[0], 0, 1e-9),
        nearAbs('LA8 wing: λ₂ = 0 (repeated)', wing.omega2[1], 0, 1e-9),
        near('LA8 wing: λ₃ = 4', wing.omega2[2], 4, 1e-9),
        nearAbs('LA8 wing: [1 1 1] ⟂_M [−1 0 1]', quad(col(0), Mw, col(1)), 0, 1e-12),
        near('LA8 wing: modal masses diag(4, 2, 4)', quad(col(0), Mw, col(0)) + quad(col(1), Mw, col(1)) + quad(col(2), Mw, col(2)), 10, 1e-12),
      ];
    },
  },
  {
    id: 'a3-2024-2025',
    topic: 'A3',
    title: '2025 A1.4 slope chain, 2025 A2.3 range hood, 2024 A2.4 box on springs',
    source: '2025 A1.4, A2.3 and 2024 A2.4 worked solutions (research notes ST-A3-17..19)',
    run: () => {
      const slope = twoDof(
        [
          [2, -2],
          [-2, 3],
        ],
        [
          [1, 0],
          [0, 1],
        ]
      );
      const hood = modes(
        [
          [2.4e5, -1.2e5],
          [-1.2e5, 1.8e5],
        ],
        [
          [28, 0],
          [0, 15],
        ]
      );
      const box = modes(
        [
          [1.6e8, 0, 1.6e8 * Math.SQRT2],
          [0, 0.2e8, 0],
          [1.6e8 * Math.SQRT2, 0, 3.6e8],
        ],
        [
          [2000, 0, 0],
          [0, 2000, 0],
          [0, 0, 4000],
        ]
      );
      return [
        near('2025 A1.4 ω₁ = 0.662153 √(k/m)', slope.omega[0], 0.662153, 1e-6),
        near('2025 A1.4 ω₂ = 2.135779 √(k/m)', slope.omega[1], 2.135779, 1e-6),
        near('2025 A1.4 r₁ = (√17 − 1)/4 = 0.780776', slope.r[0], (Math.sqrt(17) - 1) / 4, 1e-9),
        near('2025 A1.4 r₂ = −(√17 + 1)/4 = −1.280776', slope.r[1], -(Math.sqrt(17) + 1) / 4, 1e-9),
        near('2025 A2.3 ω₁ = 64.6879 rad/s', hood.omega[0], 64.6879, 1e-5),
        near('2025 A2.3 ω₂ = 128.0113 rad/s', hood.omega[1], 128.0113, 1e-5),
        near('2024 A2.4 rocking-dominated 69.5981 rad/s', box.omega[0], 69.5981, 1e-4),
        near('2024 A2.4 bounce 100.000 rad/s', box.omega[1], 100, 1e-6),
        near('2024 A2.4 sway-dominated 406.394 rad/s', box.omega[2], 406.394, 1e-4),
      ];
    },
  },
  {
    id: 'a3-properties',
    topic: 'A3',
    title: 'Properties on 200 random chains: orthogonality, r₁r₂ = −m₁/m₂, straddling, rows agree at roots',
    source: 'LA5 Eqs 5.5–5.12; summary notes A3; research notes F24, F32',
    run: () => {
      const rng = makeRng(31415);
      let worstOrth = 0;
      let worstProd = 0;
      let worstRows = 0;
      let worstDet = 0;
      let straddle = true;
      let below = true;
      for (let n = 0; n < 200; n++) {
        const m1 = rng.uniform(0.5, 5);
        const m2 = rng.uniform(0.5, 5);
        const k1 = rng.uniform(10, 1000);
        const k2 = rng.uniform(10, 1000);
        const k3 = rng.chance(0.5) ? 0 : rng.uniform(10, 1000);
        const { K, M } = chainKM(m1, m2, k1, k2, k3);
        const s = twoDof(K, M);
        const A1 = [1, s.r[0]];
        const A2 = [1, s.r[1]];
        const scale = Math.sqrt(quad(A1, M, A1) * quad(A2, M, A2));
        worstOrth = Math.max(worstOrth, Math.abs(quad(A1, M, A2)) / scale, Math.abs(quad(A1, K, A2)) / (scale * s.omega2[1]));
        worstProd = Math.max(worstProd, Math.abs(s.r[0] * s.r[1] + m1 / m2));
        for (const l of s.omega2) {
          const rr = rowRatios(K, M, l);
          worstRows = Math.max(worstRows, Math.abs(rr.row1 - rr.row2) / Math.max(1, Math.abs(rr.row1)));
          worstDet = Math.max(worstDet, Math.abs(det2(K, M, l)) / (K[0][0] * K[1][1]));
        }
        const u1 = K[0][0] / M[0][0];
        const u2 = K[1][1] / M[1][1];
        if (!(s.omega2[0] <= Math.min(u1, u2) * (1 + 1e-12) && s.omega2[1] >= Math.max(u1, u2) * (1 - 1e-12))) straddle = false;
        if (k3 === 0 && !(s.omega2[0] < k1 / m1 && k1 / m1 < s.omega2[1])) below = false;
      }
      return [
        nearAbs('max normalised A⁽¹⁾ᵀMA⁽²⁾ and A⁽¹⁾ᵀKA⁽²⁾', worstOrth, 0, 1e-9),
        nearAbs('max |r₁r₂ + m₁/m₂|', worstProd, 0, 1e-9),
        nearAbs('rows 1 and 2 give the same ratio at each root', worstRows, 0, 1e-7),
        nearAbs('det(K − λM) = 0 at each root (relative)', worstDet, 0, 1e-9),
        isTrue('roots straddle k₁₁/m₁₁ and k₂₂/m₂₂ in every case', straddle),
        isTrue('free top: ω₁² < k₁/m₁ < ω₂² in every case (official 2018 A1.7(c))', below),
      ];
    },
  },
  {
    id: 'a3-superposition-rk4',
    topic: 'A3',
    title: 'Modal superposition X = PY matches RK4 integration of M x″ + K x = 0',
    source: 'Exact modal solution vs numerical integration (LA5 Eqs 5.25–5.31)',
    run: () => {
      const { K, M } = chainKM(2.5, 1, 5000, 25000, 0);
      const s = twoDof(K, M);
      const x0 = [3, -1];
      const v0 = [0, 147];
      const { y0, yd0 } = modalInitialConditions(s.P, x0, v0);
      const out = integrate(
        (_t, y) => {
          const a = mul(inv2(M), mul(K, [y[0], y[1]]));
          return [y[2], y[3], -a[0], -a[1]];
        },
        [...x0, ...v0],
        0,
        0.4,
        1e-5,
        100
      );
      let err = 0;
      out.t.forEach((t, i) => {
        const x = modalFreeResponse(s.P, s.omega, y0, yd0, t);
        err = Math.max(err, Math.abs(x[0] - out.y[i][0]), Math.abs(x[1] - out.y[i][1]));
      });
      const tab = modeTable(chainKM(1, 1, 1, 1).M, chainKM(1, 1, 1, 1).K);
      return [
        nearAbs('max |modal − RK4| over 0.4 s (mm)', err, 0, 1e-6),
        near('unit-length mode rows (MATLAB style)', Math.hypot(...tab.rows[1]), 1, 1e-12),
        ascending('table frequencies ascending', tab.f),
      ];
    },
  },
  {
    id: 'a3-generators',
    topic: 'A3',
    title: 'Every A3 generator builds valid problems at every tier (60 seeds)',
    run: () =>
      generators.map((g) => {
        let bad = '';
        for (let s = 1; s <= 60 && !bad; s++)
          for (const t of g.tiers) {
            const inst = g.generate(makeRng(s * 7919 + 13), t);
            if (inst.hints.length !== 4) bad = `needs 4 hints (seed ${s}, tier ${t})`;
            for (const p of inst.parts) {
              if (p.kind === 'numeric') {
                if (!Number.isFinite(p.answer)) bad = `${p.id} not finite (seed ${s}, tier ${t})`;
                for (const tr of p.traps || []) if (Math.abs(tr.value - p.answer) <= 0.02 * Math.abs(p.answer)) bad = `${p.id}: trap within 2 % of the answer (seed ${s}, tier ${t})`;
              }
              if (p.kind === 'matrix' && p.answer.some((r) => r.some((v) => !Number.isFinite(v)))) bad = `${p.id} matrix not finite (seed ${s}, tier ${t})`;
              if (p.kind === 'choice' && !p.options.some((o) => o.correct)) bad = `${p.id} has no correct option (seed ${s}, tier ${t})`;
            }
            if (/NaN|undefined|Infinity/.test(inst.prompt + inst.hints.join(' '))) bad = `NaN/undefined in text (seed ${s}, tier ${t})`;
          }
        return isTrue(`${g.id}`, !bad, bad);
      }),
  },
];
