// Numerical quadrature.

/** Composite Simpson's rule on [a, b] with n (made even) intervals. */
export function simpson(f: (x: number) => number, a: number, b: number, n = 400): number {
  if (n % 2) n++;
  const h = (b - a) / n;
  let s = f(a) + f(b);
  for (let i = 1; i < n; i++) s += f(a + i * h) * (i % 2 ? 4 : 2);
  return (s * h) / 3;
}

/** Trapezoidal rule on sampled data. */
export function trapz(xs: ArrayLike<number>, ys: ArrayLike<number>): number {
  let s = 0;
  for (let i = 1; i < xs.length; i++) s += 0.5 * (xs[i] - xs[i - 1]) * (ys[i] + ys[i - 1]);
  return s;
}

/** n+1 evenly spaced samples of [a, b]. */
export function linspace(a: number, b: number, n: number): number[] {
  const out = new Array<number>(n + 1);
  for (let i = 0; i <= n; i++) out[i] = a + ((b - a) * i) / n;
  return out;
}

/** n+1 log-spaced samples of [a, b] (a, b > 0). */
export function logspace(a: number, b: number, n: number): number[] {
  const la = Math.log(a);
  const lb = Math.log(b);
  const out = new Array<number>(n + 1);
  for (let i = 0; i <= n; i++) out[i] = Math.exp(la + ((lb - la) * i) / n);
  return out;
}
