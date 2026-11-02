// Transverse vibration of uniform Euler–Bernoulli beams (summary notes B3; LB4–LB5 and the handout
// "Mode shapes for transverse vibration of uniform beams", course reader p. 91).
// Positions are xi = x/L in [0, 1]. Mode shapes use the handout's standard forms with C1 = sigma and are
// normalised so that the integral of Y^2 over xi in [0, 1] is 1 (i.e. integral of Y^2 dx = L).
import { brent, scanRoots } from './roots';

export type BeamBC = 'pinned-pinned' | 'clamped-clamped' | 'free-free' | 'clamped-free' | 'clamped-pinned' | 'free-pinned';
export type BeamEnd = 'clamped' | 'pinned' | 'free';

export interface BeamBCInfo {
  id: BeamBC;
  label: string;
  left: BeamEnd;
  right: BeamEnd;
  rigidModes: number;
}

/** The six handout boundary conditions. Ends: left is xi = 0, right is xi = 1 (summary notes B3 table). */
export const BEAM_BCS: BeamBCInfo[] = [
  { id: 'pinned-pinned', label: 'Pinned–pinned', left: 'pinned', right: 'pinned', rigidModes: 0 },
  { id: 'clamped-clamped', label: 'Clamped–clamped', left: 'clamped', right: 'clamped', rigidModes: 0 },
  { id: 'free-free', label: 'Free–free', left: 'free', right: 'free', rigidModes: 2 },
  { id: 'clamped-free', label: 'Clamped–free (cantilever)', left: 'clamped', right: 'free', rigidModes: 0 },
  { id: 'clamped-pinned', label: 'Clamped–pinned', left: 'clamped', right: 'pinned', rigidModes: 0 },
  { id: 'free-pinned', label: 'Free–pinned', left: 'free', right: 'pinned', rigidModes: 1 },
];

/** Lookup of BEAM_BCS by id. */
export function beamBCInfo(bc: BeamBC): BeamBCInfo {
  const info = BEAM_BCS.find((b) => b.id === bc);
  if (!info) throw new RangeError(`unknown beam boundary condition: ${bc}`);
  return info;
}

function checkMode(i: number): void {
  if (!Number.isInteger(i) || i < 1) throw new RangeError(`mode number must be an integer >= 1 (got ${i})`);
}

// ---------------------------------------------------------------------------------------------
// Characteristic equations in lambda = beta L, written so they stay O(1) for large lambda.
//   clamped-clamped, free-free: cos l cosh l = 1   ->  cos l - sech l = 0, root i in (i pi, (i+1) pi)
//   clamped-free:               cos l cosh l = -1  ->  cos l + sech l = 0, root i in ((i-1) pi, i pi)
//   clamped-pinned, free-pinned: tan l = tanh l    ->  sin l - cos l tanh l = 0, root i in (i pi, i pi + pi/2)
// ---------------------------------------------------------------------------------------------
type Family = 'pp' | 'cc' | 'cf' | 'cp';
const familyOf = (bc: BeamBC): Family =>
  bc === 'pinned-pinned' ? 'pp' : bc === 'clamped-free' ? 'cf' : bc === 'clamped-pinned' || bc === 'free-pinned' ? 'cp' : 'cc';

function elasticRoot(fam: Family, i: number): number {
  const PI = Math.PI;
  switch (fam) {
    case 'pp':
      return i * PI;
    case 'cc':
      return brent((l) => Math.cos(l) - 1 / Math.cosh(l), i * PI, (i + 1) * PI, 1e-15);
    case 'cf':
      return brent((l) => Math.cos(l) + 1 / Math.cosh(l), (i - 1) * PI, i * PI, 1e-15);
    case 'cp':
      return brent((l) => Math.sin(l) - Math.cos(l) * Math.tanh(l), i * PI, i * PI + PI / 2, 1e-15);
  }
}

const rootCache: Partial<Record<Family, number[]>> = {};

/** First n elastic roots beta_i L (pinned-pinned i pi; clamped-clamped and free-free cos cosh = 1; clamped-free cos cosh = -1; clamped-pinned and free-pinned tan = tanh), memoised (summary notes B3 table, handout). */
export function betaL(bc: BeamBC, n: number): number[] {
  const fam = familyOf(bc);
  const list = (rootCache[fam] ??= []);
  while (list.length < n) list.push(elasticRoot(fam, list.length + 1));
  return list.slice(0, Math.max(0, n));
}

// ---------------------------------------------------------------------------------------------
// Mode-shape coefficients. With z = lambda xi the handout forms are
//   form A (clamped-clamped, clamped-free, clamped-pinned): Y = cosh z - cos z - sigma (sinh z - sin z)
//   form B (free-free, free-pinned):                         Y = cosh z + cos z - sigma (sinh z + sin z)
// and cosh z - sigma sinh z = A e^(z - lambda) + (1 + sigma)/2 e^(-z), with A = (1 - sigma) e^lambda / 2
// evaluated in closed form, so nothing overflows or cancels catastrophically near the far end.
// ---------------------------------------------------------------------------------------------
interface Coef {
  fam: Family;
  form: 'A' | 'B' | 'S';
  lam: number;
  sigma: number;
  A: number; // (1 - sigma) e^lambda / 2
  B: number; // (1 + sigma) / 2
  norm: number; // multiplier making the integral of Y^2 over [0,1] exactly 1
}

const coefCache = new Map<string, Coef>();

function coef(bc: BeamBC, i: number): Coef {
  checkMode(i);
  const key = `${bc}|${i}`;
  const hit = coefCache.get(key);
  if (hit) return hit;
  const fam = familyOf(bc);
  const lam = betaL(bc, i)[i - 1];
  let cf: Coef;
  if (fam === 'pp') {
    cf = { fam, form: 'S', lam, sigma: Math.SQRT2, A: 0, B: 0, norm: 1 };
  } else {
    const e = Math.exp(-lam);
    const s = Math.sin(lam);
    const co = Math.cos(lam);
    let sigma: number;
    let A: number;
    if (fam === 'cf') {
      // sigma = (sinh l - sin l)/(cosh l + cos l); 1 - sigma = (e^-l + cos l + sin l)/(cosh l + cos l)
      const den = 1 + e * e + 2 * co * e; // 2 e^-l (cosh l + cos l)
      sigma = (1 - e * e - 2 * s * e) / den;
      A = (e + co + s) / den;
    } else {
      // sigma = (cosh l - cos l)/(sinh l - sin l); 1 - sigma = (cos l - sin l - e^-l)/(sinh l - sin l)
      const den = 1 - e * e - 2 * s * e; // 2 e^-l (sinh l - sin l)
      sigma = (1 + e * e - 2 * co * e) / den;
      A = (co - s - e) / den;
    }
    const form = bc === 'free-free' || bc === 'free-pinned' ? 'B' : 'A';
    cf = { fam, form, lam, sigma, A, B: (1 + sigma) / 2, norm: 1 };
    // Exact normalisation from the identity d/dxi G = 4 lambda^4 Y^2, with
    // G = xi (lambda^4 Y^2 - 2 Y' Y''' + Y''^2) + 3 Y Y''' - Y' Y''  (Y'''' = lambda^4 Y).
    const G = (xi: number) => {
      const [y, y1, y2, y3] = rawDerivs(cf, xi);
      return xi * (lam ** 4 * y * y - 2 * y1 * y3 + y2 * y2) + 3 * y * y3 - y1 * y2;
    };
    const int = (G(1) - G(0)) / (4 * lam ** 4);
    cf.norm = int > 0 ? 1 / Math.sqrt(int) : 1;
  }
  coefCache.set(key, cf);
  return cf;
}

/** Unnormalised [Y, dY/dxi, d2Y/dxi2, d3Y/dxi3] of the standard form. */
function rawDerivs(cf: Coef, xi: number): [number, number, number, number] {
  const l = cf.lam;
  const z = l * xi;
  if (cf.form === 'S') {
    const a = Math.SQRT2;
    const sz = Math.sin(z);
    const cz = Math.cos(z);
    return [a * sz, a * l * cz, -a * l * l * sz, -a * l * l * l * cz];
  }
  const ep = cf.A * Math.exp(z - l); // all derivatives of A e^(z - l) w.r.t. z equal it
  const em = cf.B * Math.exp(-z); // derivatives alternate in sign
  const sz = Math.sin(z);
  const cz = Math.cos(z);
  const sg = cf.sigma;
  // trig part T(z) and its z-derivatives
  let t0: number, t1: number, t2: number, t3: number;
  if (cf.form === 'A') {
    t0 = -cz + sg * sz;
    t1 = sz + sg * cz;
    t2 = cz - sg * sz;
    t3 = -sz - sg * cz;
  } else {
    t0 = cz - sg * sz;
    t1 = -sz - sg * cz;
    t2 = -cz + sg * sz;
    t3 = sz + sg * cz;
  }
  return [ep + em + t0, l * (ep - em + t1), l * l * (ep + em + t2), l * l * l * (ep - em + t3)];
}

/** Handout mode-shape constant C1 = sigma_i: clamped-free (sinh l - sin l)/(cosh l + cos l); clamped-clamped, free-free, clamped-pinned, free-pinned (cosh l - cos l)/(sinh l - sin l); pinned-pinned C1 = sqrt 2 (the amplitude of C1 sin beta x). */
export function sigma(bc: BeamBC, i: number): number {
  return coef(bc, i).sigma;
}

/** Normalised mode shape Y_i(xi), e.g. cantilever Y = cosh bx - cos bx - sigma (sinh bx - sin bx), with integral of Y^2 over [0,1] = 1 (tip value of a cantilever +/-2). Free-pinned: free at xi = 0, pinned at xi = 1 (handout). */
export function modeShape(bc: BeamBC, i: number, xi: number): number {
  const cf = coef(bc, i);
  return cf.norm * rawDerivs(cf, xi)[0];
}

/** Normalised [Y, dY/dxi, d2Y/dxi2, d3Y/dxi3] at xi (divide the k-th entry by L^k for x-derivatives); curvature and shear follow from entries 2 and 3. */
export function modeShapeDerivs(bc: BeamBC, i: number, xi: number): [number, number, number, number] {
  const cf = coef(bc, i);
  const d = rawDerivs(cf, xi);
  return [cf.norm * d[0], cf.norm * d[1], cf.norm * d[2], cf.norm * d[3]];
}

/** n + 1 samples of the normalised mode shape on xi = 0, 1/n, ..., 1 (for plotting). */
export function modeShapeSamples(bc: BeamBC, i: number, n = 200): Float64Array {
  const cf = coef(bc, i);
  const out = new Float64Array(n + 1);
  for (let k = 0; k <= n; k++) out[k] = cf.norm * rawDerivs(cf, k / n)[0];
  return out;
}

const nodeCache = new Map<string, number[]>();

/** Interior zeros of Y_i in (0, 1), excluding the ends (e.g. free-free mode 1 at 0.224 and 0.776; cantilever mode 2 at 0.783; summary notes B3). */
export function nodes(bc: BeamBC, i: number): number[] {
  checkMode(i);
  if (bc === 'pinned-pinned') {
    const out: number[] = [];
    for (let k = 1; k < i; k++) out.push(k / i);
    return out;
  }
  const key = `${bc}|${i}`;
  const hit = nodeCache.get(key);
  if (hit) return hit.slice();
  const eps = 1e-5; // keeps clear of end zeros, where rounding could fake a sign change
  const f = (xi: number) => modeShape(bc, i, xi);
  const found = scanRoots(f, eps, 1 - eps, 400 * (i + 2)).filter((x) => x > 1e-6 && x < 1 - 1e-6);
  nodeCache.set(key, found);
  return found.slice();
}

/** Natural frequency w_i = (beta_i L)^2 sqrt(E I/(rhoA L^4)) in rad/s (summary notes B3; LB4). */
export const beamOmega = (bL: number, E: number, I: number, rhoA: number, L: number): number =>
  bL * bL * Math.sqrt((E * I) / (rhoA * L ** 4));

/** The n lowest elastic natural frequencies (rad/s) of a uniform beam: w_i = (beta_i L)^2 sqrt(E I/(rhoA L^4)). */
export function beamOmegas(bc: BeamBC, n: number, E: number, I: number, rhoA: number, L: number): number[] {
  return betaL(bc, n).map((bL) => beamOmega(bL, E, I, rhoA, L));
}

/** Frequency ratios w_i/w_1 = (beta_i L/beta_1 L)^2 (the ratio trick, summary notes B3: cantilever 1 : 6.27 : 17.55). */
export function frequencyRatios(bc: BeamBC, n: number): number[] {
  const r = betaL(bc, n);
  return r.map((x) => (x / r[0]) ** 2);
}

/** Rigid-body mode r (1-based) of an unrestrained beam, normalised to integral Y^2 dxi = 1: free-free 1 (translation) and sqrt3 (2 xi - 1) (rotation about the centre); free-pinned sqrt3 (1 - xi) (rotation about the pin at xi = 1). */
export function rigidModeShape(bc: BeamBC, r: number, xi: number): number {
  if (bc === 'free-free' && r === 1) return 1;
  if (bc === 'free-free' && r === 2) return Math.sqrt(3) * (2 * xi - 1);
  if (bc === 'free-pinned' && r === 1) return Math.sqrt(3) * (1 - xi);
  throw new RangeError(`${bc} has no rigid-body mode ${r}`);
}

// ---------------------------------------------------------------------------------------------
// Sections. A in m^2, I in m^4 (second moment about the bending neutral axis).
// ---------------------------------------------------------------------------------------------

/** Thin-walled tube of mean diameter d and wall t: A = 2 pi r t, I = pi r^3 t, r = d/2, so I/A = r^2/2 (summary notes B3). */
export function thinTube(d: number, t: number): { A: number; I: number } {
  const r = d / 2;
  return { A: 2 * Math.PI * r * t, I: Math.PI * r ** 3 * t };
}

/** Hollow circular section: A = pi (dOut^2 - dIn^2)/4, I = pi (dOut^4 - dIn^4)/64. */
export function hollowCircle(dOut: number, dIn: number): { A: number; I: number } {
  return { A: (Math.PI * (dOut ** 2 - dIn ** 2)) / 4, I: (Math.PI * (dOut ** 4 - dIn ** 4)) / 64 };
}

/** Solid circular section: A = pi d^2/4, I = pi d^4/64. */
export function solidCircle(d: number): { A: number; I: number } {
  return { A: (Math.PI * d * d) / 4, I: (Math.PI * d ** 4) / 64 };
}

/** Solid rectangle b wide bending across its depth h: A = b h, I = b h^3/12, so I/A = h^2/12 (summary notes B3). */
export function rectangle(b: number, h: number): { A: number; I: number } {
  return { A: b * h, I: (b * h ** 3) / 12 };
}

// ---------------------------------------------------------------------------------------------
// Static deflection shapes (unit tip value), used as Rayleigh trial shapes (LB7 Eqs 7.16–7.17).
// ---------------------------------------------------------------------------------------------

/** Cantilever under a tip load, unit tip value: phi = (3 xi^2 - xi^3)/2 (LB7 Eq 7.17). */
export const cantileverTipLoadShape = (xi: number): number => (3 * xi * xi - xi ** 3) / 2;

/** Second derivative of the tip-load shape: d2phi/dxi2 = 3 (1 - xi). */
export const cantileverTipLoadShapeD2 = (xi: number): number => 3 * (1 - xi);

/** Cantilever under a uniform load, unit tip value: phi = (6 xi^2 - 4 xi^3 + xi^4)/3 (LB7 Eq 7.16). */
export const cantileverUdlShape = (xi: number): number => (6 * xi * xi - 4 * xi ** 3 + xi ** 4) / 3;

/** Second derivative of the UDL shape: d2phi/dxi2 = 4 (1 - xi)^2. */
export const cantileverUdlShapeD2 = (xi: number): number => 4 * (1 - xi) ** 2;
