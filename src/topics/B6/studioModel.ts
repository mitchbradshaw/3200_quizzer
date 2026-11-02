// Pure model behind the B6 design studio: three B2 scenarios (2022 eVTOL wing, 2023 wind-turbine blade,
// 2024 hydro shaft) and the template's checks: frequency margin, forced amplitude, added masses.
// SI units, rad/s unless named Hz. Bending frequencies of thin sections do not depend on the thickness;
// the forced response scales as 1/EI, i.e. as 1/t at fixed frequencies (summary notes B3, B4, B6).
import { betaL, modeShape } from '../../physics/beams';
import { bareOmega1, feBeam, feShapeSamples, pointStiffness, type MassBeam } from '../B5/physics';
import { TAU, southwellCoef, torsionHz } from './physics';

export type StudioId = 'wing' | 'blade' | 'shaft';

/** Grid along the member (x/L) used for every drawn and summed shape. */
export const NX = 81;
export const XS: Float64Array = Float64Array.from({ length: NX }, (_, k) => k / (NX - 1));

export interface StudioMass {
  id: string;
  label: string;
  /** Default position, fraction of L. */
  x: number;
  xRange: [number, number];
  /** Default amount in `unit`. */
  value: number;
  max: number;
  /** kg, or % of the member's own mass. */
  unit: 'kg' | '%';
}

export interface StudioScenario {
  id: StudioId;
  title: string;
  /** Short name for the scenario switch. */
  short: string;
  /** One-line context (Rich). */
  blurb: string;
  bc: 'clamped-free' | 'pinned-pinned';
  beam: MassBeam;
  section: 'rect' | 'tube';
  E: number;
  rho: number;
  /** Shear modulus for torsion (absent: torsion not part of this design). */
  G?: number;
  torsionBC?: 'fixed-free' | 'fixed-fixed';
  L: number;
  /** Free dimension that sets the frequencies (rectangle depth in the bending plane, or tube diameter). */
  dim: { tex: string; name: string; unit: 'mm' | 'm'; toSI: number; min: number; max: number; init: number; tip: string };
  /** Thickness: sets the amplitude (and the member's mass), not the frequencies. ratio: t = value × dimension. */
  thick: { tex: string; name: string; unit: 'mm' | ''; toSI: number; min: number; max: number; init: number; step: number; tip: string; ratio?: boolean };
  /** Maximum running speed (rad/s) and its text. */
  OmegaMax: number;
  speedText: string;
  /** Excitation frequency = q × running speed. */
  q: number;
  qText: string;
  /** Requirement f1 ≥ n × q × running frequency. */
  n: number;
  nText: string;
  /** Load positions (fractions of L), equal and in phase. */
  forces: number[];
  forceKind: 'unbalance' | 'constant';
  /** Imbalance m e per load (kg m) for unbalance; amplitude P per load (N) otherwise. */
  me?: number;
  P?: number;
  forceText: string;
  /** Amplitude limit (m) anywhere along the member, at every speed up to the maximum. */
  limit: number;
  limitText: string;
  masses: StudioMass[];
  massText: string;
  /** Validity notes: assumption and which way it biases the answer. */
  validity: { what: string; bias: string }[];
}

const rpm = (n: number) => (n * TAU) / 60;

// 2024 hydro shaft: length from the first torsional critical speed (fixed–fixed, f = c/2L, 7200 rpm).
const SHAFT_E = 210e9;
const SHAFT_RHO = 7850;
const SHAFT_G = SHAFT_E / (2 * (1 + 0.3));
const SHAFT_L = Math.sqrt(SHAFT_G / SHAFT_RHO) / (2 * (7200 / 60));

export const SCENARIOS: Record<StudioId, StudioScenario> = {
  wing: {
    id: 'wing',
    title: 'eVTOL wing (2022)',
    short: 'Wing 2022',
    blurb: 'A carbon-fibre wing fixed at the aircraft centre carries two rotors whose unbalance shakes it **in its own plane**. The section is a thin $w \\times t$ rectangle, so the in-plane frequencies depend on the width $w$ only.',
    bc: 'clamped-free',
    beam: 'cantilever',
    section: 'rect',
    E: 280e9,
    rho: 1600,
    L: 3,
    dim: { tex: 'w', name: 'width', unit: 'mm', toSI: 1e-3, min: 100, max: 1000, init: 300, tip: 'w: the wing’s depth in the plane of the unbalance forces; ω ∝ w' },
    thick: { tex: 't', name: 'thickness', unit: 'mm', toSI: 1e-3, min: 0.5, max: 12, init: 3, step: 0.05, tip: 't: wing thickness; EI = E t w³/12 and ρA = ρ w t both ∝ t, so t sets the amplitude (∝ 1/t), not the frequencies' },
    OmegaMax: rpm(2400),
    speedText: '2400 rpm',
    q: 1,
    qText: 'unbalance at the rotor speed',
    n: 2.5,
    nText: 'the lowest critical speed must be at least 2.5 × the top rotor speed (2022 B2.1)',
    forces: [0.5, 0.9],
    forceKind: 'unbalance',
    me: 1e-3,
    forceText: 'two in-phase unbalances $me$ = 1 kg mm at 0.5L and 0.9L, $P = me\\,\\Omega^2$',
    limit: 0.1e-3,
    limitText: '0.1 mm at every speed up to 2400 rpm',
    masses: [
      { id: 'A', label: 'rotor A', x: 0.5, xRange: [0.2, 1], value: 5, max: 15, unit: 'kg' },
      { id: 'B', label: 'rotor B', x: 0.9, xRange: [0.2, 1], value: 5, max: 15, unit: 'kg' },
    ],
    massText: 'Two 5 kg rotors. The paper quotes them as 20 % of the wing mass (−23.4 %); on the wing sized in the earlier parts they are about 55 % each.',
    validity: [
      { what: 'Fixed root: the fuselage is far heavier and stiffer than the wing (official 2018 B2.5).', bias: 'a flexible or light root makes the real frequencies **lower**' },
      { what: 'Response computed on the bare wing (rotor masses left out of the modes).', bias: 'the masses lower $\\omega_1$ towards the forcing, so the real response is **larger**' },
      { what: 'In-plane bending only. Out of plane the depth is $t \\ll w$, so those frequencies are $t/w$ times lower (2022 B2.4).', bias: 'cruise, with the spin axes tilted, needs its own check' },
      { what: 'Uniform thin rectangle, undamped, rotors as point masses and point forces.', bias: 'damping only matters near resonance, which the margin keeps away' },
    ],
  },
  blade: {
    id: 'blade',
    title: 'Wind-turbine blade (2023)',
    short: 'Blade 2023',
    blurb: 'An 86.4 m blade fixed at the hub, modelled as a thin tube of diameter $d$ and wall $t = $ (ratio)$\\,d$. A bearing defect at mid-length forces it at $1.8\\,\\Omega$; the tip speed sets $\\Omega = V/L$.',
    bc: 'clamped-free',
    beam: 'cantilever',
    section: 'tube',
    E: 13.23e9,
    rho: 1820,
    G: 4.79e9,
    torsionBC: 'fixed-free',
    L: 86.4,
    dim: { tex: 'd', name: 'tube diameter', unit: 'm', toSI: 1, min: 4, max: 24, init: 10, tip: 'd: mean tube diameter; thin tube ω ∝ r = d/2, independent of the wall' },
    thick: { tex: 't/d', name: 'wall ratio', unit: '', toSI: 1, min: 0.002, max: 0.02, init: 0.003, step: 0.0001, tip: 't/d: wall thickness as a fraction of the diameter (the paper fixes 0.005); EI = Eπr³t, so the amplitude ∝ 1/t', ratio: true },
    OmegaMax: 150 / 86.4,
    speedText: '150 m/s tip speed (16.6 rpm)',
    q: 1.8,
    qText: 'bearing defect at 1.8 × the rotor speed',
    n: 2,
    nText: 'the first critical speed must be at least 2 × the defect frequency (2023 B2.1)',
    forces: [0.5],
    forceKind: 'constant',
    P: 4e6,
    forceText: 'defect force $P$ = 4 MN at mid-length (the paper asks for the largest allowable $P$)',
    limit: 0.005 * 86.4,
    limitText: '0.5 % of L = 0.432 m',
    masses: [{ id: 'T', label: 'tip mass', x: 1, xRange: [0.5, 1], value: 5, max: 20, unit: '%' }],
    massText: 'A tip mass (tip brake or receptor) as a % of the blade mass. 2023 had no added-mass part; 2025 asked the reverse question (tips that lower $f_1$ by 5 %).',
    validity: [
      { what: 'Fixed hub: the hub and tower are far stiffer and heavier than the blade.', bias: 'a flexible root makes the real frequencies **lower**' },
      { what: 'No rotation: centrifugal tension stiffens a spinning blade (Rayleigh adds $\\int T\\phi^{\\prime 2}dx$).', bias: 'real bending frequencies are **higher** (+4.5 % for the 2023 design; see the plot): the margin is conservative' },
      { what: 'One point force at mid-length replaces the distributed loading.', bias: 'right resultant, but it under-excites mode 1 (about 16 % low, 2023 worked solution)' },
      { what: 'Uniform thin tube, undamped; real blades taper.', bias: 'taper raises $f_1$ (less mass near the tip)' },
    ],
  },
  shaft: {
    id: 'shaft',
    title: 'Hydropower shaft (2024)',
    short: 'Shaft 2024',
    blurb: `A steel thin tube between the generator and turbine rotors. Torsion: the rotors’ inertia holds both ends (fixed–fixed), so 7200 rpm gives $L = c/2f$ = ${SHAFT_L.toFixed(2)} m. Bending: pinned at the rotors’ bearings; a bearing defect at 0.6L forces it at $1.4 \\times$ 115.4 rpm.`,
    bc: 'pinned-pinned',
    beam: 'pinned',
    section: 'tube',
    E: SHAFT_E,
    rho: SHAFT_RHO,
    G: SHAFT_G,
    torsionBC: 'fixed-fixed',
    L: SHAFT_L,
    dim: { tex: 'd', name: 'tube diameter', unit: 'm', toSI: 1, min: 0.2, max: 1.2, init: 0.5, tip: 'd: mean tube diameter (the paper uses 0.7 m); bending ω ∝ d, torsion independent of d' },
    thick: { tex: 't', name: 'wall thickness', unit: 'mm', toSI: 1e-3, min: 10, max: 80, init: 30, step: 0.5, tip: 't: wall thickness; the amplitude ∝ 1/t at unchanged frequencies (2024 B2.5)' },
    OmegaMax: rpm(115.4),
    speedText: '115.4 rpm',
    q: 1.4,
    qText: 'bearing defect at 1.4 × the running speed',
    n: 4,
    nText: 'the first bending critical speed must be at least 4 × the defect frequency. This is a studio requirement: the 2024 paper fixes d = 0.7 m',
    forces: [0.6],
    forceKind: 'constant',
    P: 1e4,
    forceText: 'defect force $P$ = 10 kN at 0.6L (studio value)',
    limit: NaN, // set below: 30 % less than the 0.7 m × 30 mm design (2024 B2.5)
    limitText: '30 % below the original 0.7 m × 30 mm design (2024 B2.5)',
    masses: [
      { id: 'G', label: 'generator rotor', x: 0, xRange: [0, 0.3], value: 200, max: 500, unit: '%' },
      { id: 'T', label: 'turbine rotor', x: 1, xRange: [0.7, 1], value: 200, max: 500, unit: '%' },
    ],
    massText: 'Rotors as % of the shaft mass, on the pinned bearings (x = 0 and L) by default. Slide one inboard to see what changes.',
    validity: [
      { what: 'Torsion: rotors “fixed by their inertia” (fixed–fixed).', bias: 'it gives the shaft’s own modes; finite rotors add a much **lower** mode, the two rotors twisting against each other through the shaft (a big end inertia is not a fixed end, 2021 B2.5)' },
      { what: 'Bending: self-aligning bearings as pins on rigid supports.', bias: 'flexible bearings or foundations make the real frequencies **lower**' },
      { what: 'Rotors exactly at the bearings, i.e. at nodes of every bending mode (2024 B2.6).', bias: 'if they overhang or sit inboard they **lower** the bending frequencies' },
      { what: 'Uniform thin tube, undamped, defect as one point force.', bias: 'fine well below resonance, as here' },
    ],
  },
};

// ---------------------------------------------------------------------------------------------
// Section, frequencies, requirement
// ---------------------------------------------------------------------------------------------

export interface Design {
  /** Free dimension in its display unit (mm or m). */
  dim: number;
  /** Thickness in its display unit (mm, or the ratio t/d). */
  thick: number;
  /** Amounts in each mass's unit, and positions (fractions of L). */
  massValues: number[];
  massX: number[];
}

export const initialDesign = (sc: StudioScenario): Design => ({
  dim: sc.dim.init,
  thick: sc.thick.init,
  massValues: sc.masses.map((m) => m.value),
  massX: sc.masses.map((m) => m.x),
});

export const dimSI = (sc: StudioScenario, d: Design): number => d.dim * sc.dim.toSI;
export const thickSI = (sc: StudioScenario, d: Design): number => (sc.thick.ratio ? d.thick * dimSI(sc, d) : d.thick * sc.thick.toSI);

/** I (m^4) and A (m^2): rectangle bending across `dim` (I = t dim^3/12), or thin tube I = pi r^3 t, A = 2 pi r t. */
export function sectionOf(sc: StudioScenario, dimM: number, tM: number): { I: number; A: number } {
  if (sc.section === 'rect') return { I: (tM * dimM ** 3) / 12, A: dimM * tM };
  const r = dimM / 2;
  return { I: Math.PI * r ** 3 * tM, A: 2 * Math.PI * r * tM };
}

/** Member mass rho A L (kg). */
export const memberMass = (sc: StudioScenario, d: Design): number => sc.rho * sectionOf(sc, dimSI(sc, d), thickSI(sc, d)).A * sc.L;

const ROOTS: Record<StudioScenario['bc'], number[]> = {
  'clamped-free': betaL('clamped-free', 3),
  'pinned-pinned': betaL('pinned-pinned', 3),
};

/** beta_i L for the scenario's bending BC (i = 1..3). */
export const rootsOf = (sc: StudioScenario): number[] => ROOTS[sc.bc];

/** First three bending natural frequencies (rad/s): (beta_i L)^2 (s/L^2), s = dim sqrt(E/12 rho) or r sqrt(E/2 rho); independent of t. */
export function bendingOmegas(sc: StudioScenario, dimM: number): number[] {
  const s = sc.section === 'rect' ? dimM * Math.sqrt(sc.E / (12 * sc.rho)) : (dimM / 2) * Math.sqrt(sc.E / (2 * sc.rho));
  return ROOTS[sc.bc].map((b) => (b * b * s) / (sc.L * sc.L));
}

/** First three torsional frequencies (Hz), c = sqrt(G/rho); independent of d and t. Empty if torsion is not modelled. */
export function torsionHzs(sc: StudioScenario): number[] {
  if (!sc.G || !sc.torsionBC) return [];
  const c = Math.sqrt(sc.G / sc.rho);
  return [1, 2, 3].map((n) => torsionHz(sc.torsionBC!, n, c, sc.L));
}

/** Highest excitation frequency (rad/s) = q × maximum running speed. */
export const excitationMax = (sc: StudioScenario): number => sc.q * sc.OmegaMax;

/** Required first natural frequency (rad/s) = n × q × Omega_max. */
export const requiredOmega = (sc: StudioScenario): number => sc.n * excitationMax(sc);

/** Smallest free dimension (display unit) meeting the requirement: omega_1 is proportional to it. */
export function minDim(sc: StudioScenario): number {
  const w1 = bendingOmegas(sc, sc.dim.toSI)[0]; // at dim = 1 display unit
  return requiredOmega(sc) / w1;
}

// ---------------------------------------------------------------------------------------------
// Forced response by modal superposition (3 modes, bare member)
// ---------------------------------------------------------------------------------------------

const GRID: Record<StudioScenario['bc'], Float64Array[]> = {
  'clamped-free': [1, 2, 3].map((i) => Float64Array.from(XS, (x) => modeShape('clamped-free', i, x))),
  'pinned-pinned': [1, 2, 3].map((i) => Float64Array.from(XS, (x) => modeShape('pinned-pinned', i, x))),
};

/** Normalised bending mode shapes Y_i on the XS grid (integral of Y^2 over [0, 1] = 1). */
export const modeGrid = (sc: StudioScenario): Float64Array[] => GRID[sc.bc];

export interface Response {
  /** Excitation frequency (rad/s) and force amplitude per load (N). */
  Omega: number;
  F: number;
  /** Static scale F L^3/(EI) (m). */
  scale: number;
  /** Dynamic factors 1/(1 - Omega^2/omega_i^2). */
  dyn: number[];
  /** Modal amplitudes a_i (m): y(x) = sum a_i Y_i(x). */
  a: number[];
  /** Signed deflection amplitude on XS (m). */
  y: Float64Array;
  /** Largest |y| (m), where (x/L), and each mode's contribution there (m). */
  yMax: number;
  at: number;
  parts: number[];
  /** y_max / (F L^3/EI): the response coefficient S. */
  S: number;
}

/** Steady-state amplitude at running-speed fraction s (Omega_run = s Omega_max), loads in phase, 3 bending modes. */
export function response(sc: StudioScenario, d: Design, s: number): Response {
  const dm = dimSI(sc, d);
  const { I } = sectionOf(sc, dm, thickSI(sc, d));
  const W = bendingOmegas(sc, dm);
  const run = s * sc.OmegaMax;
  const Omega = sc.q * run;
  const F = sc.forceKind === 'unbalance' ? (sc.me ?? 0) * run * run : sc.P ?? 0;
  const scale = (F * sc.L ** 3) / (sc.E * I);
  const roots = ROOTS[sc.bc];
  const dyn = W.map((w) => 1 / (1 - (Omega * Omega) / (w * w)));
  const a = roots.map((b, k) => {
    const yf = sc.forces.reduce((acc, x) => acc + modeShape(sc.bc, k + 1, x), 0);
    return (scale * yf * dyn[k]) / b ** 4;
  });
  const G = GRID[sc.bc];
  const y = new Float64Array(NX);
  let yMax = 0;
  let iMax = 0;
  for (let j = 0; j < NX; j++) {
    const v = a[0] * G[0][j] + a[1] * G[1][j] + a[2] * G[2][j];
    y[j] = v;
    if (Math.abs(v) > yMax) {
      yMax = Math.abs(v);
      iMax = j;
    }
  }
  const parts = a.map((ai, k) => ai * G[k][iMax]);
  return { Omega, F, scale, dyn, a, y, yMax, at: XS[iMax], parts, S: scale > 0 ? yMax / scale : 0 };
}

/** Largest amplitude over the running range s in (0, 1] (Infinity if a resonance lies inside it). */
export function worstCase(sc: StudioScenario, d: Design): { yMax: number; s: number } {
  const W = bendingOmegas(sc, dimSI(sc, d));
  if (excitationMax(sc) >= W[0]) return { yMax: Infinity, s: W[0] / excitationMax(sc) };
  let best = 0;
  let at = 1;
  for (let k = 1; k <= 60; k++) {
    const s = k / 60;
    const r = response(sc, d, s).yMax;
    if (r > best) {
      best = r;
      at = s;
    }
  }
  return { yMax: best, s: at };
}

// ---------------------------------------------------------------------------------------------
// Added masses: Dunkerley (lower bound), Rayleigh with the bare mode (upper bound), FE (exact)
// ---------------------------------------------------------------------------------------------

export interface MassCheck {
  /** Mass ratios M/(rho A L). */
  mu: number[];
  /** Dunkerley terms (omega_11/omega_kk)^2 (0 for a mass at a support). */
  terms: number[];
  /** omega_1 (with masses) / omega_11 by Dunkerley, Rayleigh (bare mode) and FE. */
  rD: number;
  rR: number;
  rX: number;
  /** FE first mode with the masses on XS-like samples (max 1). */
  shape: Float64Array;
}

const FE_ENDS: Record<MassBeam, ['clamped' | 'pinned', 'free' | 'pinned' | 'clamped']> = {
  cantilever: ['clamped', 'free'],
  pinned: ['pinned', 'pinned'],
  clamped: ['clamped', 'clamped'],
};

const feBare = new Map<string, number>();

export function massRatios(sc: StudioScenario, d: Design): number[] {
  const mb = memberMass(sc, d);
  return sc.masses.map((m, k) => (m.unit === 'kg' ? d.massValues[k] / mb : d.massValues[k] / 100));
}

export function massCheck(sc: StudioScenario, d: Design, nel = 20): MassCheck {
  const mu = massRatios(sc, d);
  const w11 = bareOmega1(sc.beam);
  const terms = mu.map((m, k) => {
    const x = d.massX[k];
    const atSupport = x <= 1e-6 || (sc.beam !== 'cantilever' && x >= 1 - 1e-6);
    if (!(m > 0) || atSupport) return 0;
    return (w11 * w11 * m) / pointStiffness(sc.beam, Math.min(1, x));
  });
  const rD = 1 / Math.sqrt(1 + terms.reduce((s, t) => s + t, 0));
  const ke = mu.reduce((s, m, k) => s + m * modeShape(sc.bc, 1, Math.min(1, Math.max(0, d.massX[k]))) ** 2, 0);
  const rR = 1 / Math.sqrt(1 + ke);
  const [left, right] = FE_ENDS[sc.beam];
  const fe = feBeam({ left, right, nel, masses: mu.map((m, k) => ({ x: d.massX[k], M: m })), nModes: 1 });
  // Ratio to the bare beam on the same mesh, so the (tiny) discretisation error cancels.
  const key = `${sc.beam}|${nel}`;
  let bare = feBare.get(key);
  if (bare === undefined) {
    bare = feBeam({ left, right, nel, nModes: 1 }).omega[0];
    feBare.set(key, bare);
  }
  return { mu, terms, rD, rR, rX: fe.omega[0] / bare, shape: feShapeSamples(fe, 0, NX - 1) };
}

// ---------------------------------------------------------------------------------------------
// Validity: root flexibility and rotation stiffening (cantilevers)
// ---------------------------------------------------------------------------------------------

let rootCurve: { k: number[]; r: number[] } | null = null;

/** omega_1 / omega_1(clamped) of a uniform cantilever whose root is a rotational spring k_theta (FE; k in units EI/L). */
export function rootFlexCurve(): { k: number[]; r: number[] } {
  if (rootCurve) return rootCurve;
  const w0 = bareOmega1('cantilever');
  const k: number[] = [];
  const r: number[] = [];
  for (let j = 0; j <= 30; j++) {
    const kk = 0.1 * Math.pow(10, (4.5 * j) / 30); // 0.1 .. 3162
    k.push(kk);
    r.push(feBeam({ left: 'clamped', right: 'free', nel: 8, rootSpring: kk, nModes: 1 }).omega[0] / w0);
  }
  rootCurve = { k, r };
  return rootCurve;
}

let ks: number | null = null;

/** Southwell coefficient for a spinning cantilever's mode 1: omega^2 = omega_0^2 + K_s Omega^2 (K_s = 1.193). */
export function spinCoef(): number {
  if (ks === null) ks = southwellCoef(1);
  return ks;
}

// The shaft's limit: 30 % less than the response of the paper's design (d = 0.7 m, t = 30 mm) at full speed.
{
  const sc = SCENARIOS.shaft;
  const ref = worstCase({ ...sc, limit: 1 }, { dim: 0.7, thick: 30, massValues: [], massX: [] }).yMax;
  sc.limit = 0.7 * ref;
}

/** All three checks for a design: the bare margin, the amplitude limit, and the margin with the masses (Dunkerley). */
export function checks(sc: StudioScenario, d: Design, m?: MassCheck) {
  const w1 = bendingOmegas(sc, dimSI(sc, d))[0];
  const req = requiredOmega(sc);
  const worst = worstCase(sc, d);
  const mc = m ?? massCheck(sc, d);
  return {
    freq: w1 >= req * (1 - 1e-9),
    amp: worst.yMax <= sc.limit,
    mass: w1 * mc.rD >= req * (1 - 1e-9),
    w1,
    req,
    worst,
    mc,
  };
}
