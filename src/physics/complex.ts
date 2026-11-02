// Minimal complex arithmetic on plain objects. Pure functions, no allocation tricks.
export interface C {
  re: number;
  im: number;
}

export const c = (re: number, im = 0): C => ({ re, im });
export const ZERO: C = { re: 0, im: 0 };
export const ONE: C = { re: 1, im: 0 };
export const I: C = { re: 0, im: 1 };

export const cadd = (a: C, b: C): C => ({ re: a.re + b.re, im: a.im + b.im });
export const csub = (a: C, b: C): C => ({ re: a.re - b.re, im: a.im - b.im });
export const cmul = (a: C, b: C): C => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re });
export const cscale = (a: C, s: number): C => ({ re: a.re * s, im: a.im * s });
export const cneg = (a: C): C => ({ re: -a.re, im: -a.im });
export const cconj = (a: C): C => ({ re: a.re, im: -a.im });
export const cabs = (a: C): number => Math.hypot(a.re, a.im);
export const cabs2 = (a: C): number => a.re * a.re + a.im * a.im;
/** Argument in (-pi, pi]. */
export const carg = (a: C): number => Math.atan2(a.im, a.re);

export function cdiv(a: C, b: C): C {
  // Smith's algorithm for stability.
  if (Math.abs(b.re) >= Math.abs(b.im)) {
    const r = b.im / b.re;
    const d = b.re + b.im * r;
    return { re: (a.re + a.im * r) / d, im: (a.im - a.re * r) / d };
  }
  const r = b.re / b.im;
  const d = b.re * r + b.im;
  return { re: (a.re * r + a.im) / d, im: (a.im * r - a.re) / d };
}

export const cinv = (a: C): C => cdiv(ONE, a);
export const cfromPolar = (r: number, theta: number): C => ({ re: r * Math.cos(theta), im: r * Math.sin(theta) });

export function cexp(a: C): C {
  const e = Math.exp(a.re);
  return { re: e * Math.cos(a.im), im: e * Math.sin(a.im) };
}

/** Principal square root. */
export function csqrt(a: C): C {
  const r = cabs(a);
  if (r === 0) return { re: 0, im: 0 };
  const re = Math.sqrt((r + a.re) / 2);
  const im = Math.sign(a.im || 1) * Math.sqrt(Math.max(0, (r - a.re) / 2));
  return { re, im };
}

export function cpowInt(a: C, n: number): C {
  let out = ONE;
  for (let k = 0; k < n; k++) out = cmul(out, a);
  return out;
}

export const cisNear = (a: C, b: C, tol = 1e-9): boolean => cabs(csub(a, b)) <= tol * Math.max(1, cabs(a), cabs(b));

/** e.g. "-12.1 + 1647.3i" with `sig` significant figures. */
export function cformat(a: C, sig = 4): string {
  const f = (x: number) => (Math.abs(x) < 1e-12 ? '0' : Number(x.toPrecision(sig)).toString());
  const sign = a.im < 0 ? '−' : '+';
  return `${f(a.re)} ${sign} ${f(Math.abs(a.im))}i`;
}
