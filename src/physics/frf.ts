// Frequency response functions and modal parameters (summary notes C2; LC2). Receptance H = X/F.
import { type C, cadd, cdiv, cscale, ONE } from './complex';

/** SDOF receptance H = 1/(k - m w^2 + i w c) (summary notes C2; LA1). */
export function sdofReceptance(k: number, m: number, c: number, w: number): C {
  return cdiv(ONE, { re: k - m * w * w, im: w * c });
}

/** Mobility (velocity/force) = i w H (summary notes C2). */
export const toMobility = (H: C, w: number): C => ({ re: -w * H.im, im: w * H.re });

/** Accelerance (acceleration/force) = -w^2 H (summary notes C2). */
export const toAccelerance = (H: C, w: number): C => cscale(H, -w * w);

export interface ModalTerm {
  /** Undamped natural frequency, rad/s. */
  wn: number;
  zeta: number;
  /** Mass-normalised mode shape (phi^T M phi = 1). */
  phi: number[];
}

/** Receptance H_jk = sum_r phi_jr phi_kr/(wn_r^2 - w^2 + 2 i zeta_r wn_r w) for mass-normalised modes; j and k are 0-based indices into phi (summary notes C2; LC2). */
export function modalSumFRF(modes: ModalTerm[], j: number, k: number, w: number): C {
  let H: C = { re: 0, im: 0 };
  for (const m of modes) {
    const num = m.phi[j] * m.phi[k];
    H = cadd(H, cdiv({ re: num, im: 0 }, { re: m.wn * m.wn - w * w, im: 2 * m.zeta * m.wn * w }));
  }
  return H;
}

/** Linear interpolation of the abscissa where y crosses level between samples (x0, y0) and (x1, y1). */
const cross = (x0: number, y0: number, x1: number, y1: number, level: number): number =>
  y1 === y0 ? (x0 + x1) / 2 : x0 + ((level - y0) * (x1 - x0)) / (y1 - y0);

/**
 * Half-power (-3 dB) method on a sampled |H| (summary notes C2): pick the peak (refined by a parabola
 * through the three highest samples), interpolate the two crossings of |H|max/sqrt2 at w1 < wn < w2, and
 * zeta = (w2 - w1)/(2 wn). A crossing missing from the data gives NaN for it and for zeta.
 */
export function halfPower(ws: number[], mags: number[]): { wn: number; zeta: number; w1: number; w2: number; peak: number } {
  const n = Math.min(ws.length, mags.length);
  if (n === 0) return { wn: NaN, zeta: NaN, w1: NaN, w2: NaN, peak: NaN };
  let ip = 0;
  for (let i = 1; i < n; i++) if (mags[i] > mags[ip]) ip = i;
  let wn = ws[ip];
  let peak = mags[ip];
  if (ip > 0 && ip < n - 1) {
    const [x0, x1, x2] = [ws[ip - 1], ws[ip], ws[ip + 1]];
    const [y0, y1, y2] = [mags[ip - 1], mags[ip], mags[ip + 1]];
    const d = (x1 - x0) * (y1 - y2) - (x1 - x2) * (y1 - y0);
    if (d !== 0) {
      const xv = x1 - (0.5 * ((x1 - x0) ** 2 * (y1 - y2) - (x1 - x2) ** 2 * (y1 - y0))) / d;
      if (xv > x0 && xv < x2) {
        // Lagrange parabola through the three samples, evaluated at its vertex.
        const L0 = ((xv - x1) * (xv - x2)) / ((x0 - x1) * (x0 - x2));
        const L1 = ((xv - x0) * (xv - x2)) / ((x1 - x0) * (x1 - x2));
        const L2 = ((xv - x0) * (xv - x1)) / ((x2 - x0) * (x2 - x1));
        const yv = y0 * L0 + y1 * L1 + y2 * L2;
        if (yv >= y1) {
          wn = xv;
          peak = yv;
        }
      }
    }
  }
  const level = peak / Math.SQRT2;
  let w1 = NaN;
  for (let i = ip; i > 0; i--) {
    if (mags[i - 1] <= level && mags[i] > level) {
      w1 = cross(ws[i - 1], mags[i - 1], ws[i], mags[i], level);
      break;
    }
  }
  let w2 = NaN;
  for (let i = ip; i < n - 1; i++) {
    if (mags[i + 1] <= level && mags[i] > level) {
      w2 = cross(ws[i], mags[i], ws[i + 1], mags[i + 1], level);
      break;
    }
  }
  return { wn, zeta: (w2 - w1) / (2 * wn), w1, w2, peak };
}
