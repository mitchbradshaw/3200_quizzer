// Scalar root finding.

/** Brent's method on a bracket [a, b] with f(a), f(b) of opposite sign. Returns NaN if not bracketed. */
export function brent(f: (x: number) => number, a: number, b: number, tol = 1e-13, maxIter = 200): number {
  let fa = f(a);
  let fb = f(b);
  if (fa === 0) return a;
  if (fb === 0) return b;
  if (fa * fb > 0) return NaN;
  if (Math.abs(fa) < Math.abs(fb)) {
    [a, b] = [b, a];
    [fa, fb] = [fb, fa];
  }
  let cc = a;
  let fc = fa;
  let mflag = true;
  let d = 0;
  for (let i = 0; i < maxIter; i++) {
    let s: number;
    if (fa !== fc && fb !== fc) {
      s =
        (a * fb * fc) / ((fa - fb) * (fa - fc)) +
        (b * fa * fc) / ((fb - fa) * (fb - fc)) +
        (cc * fa * fb) / ((fc - fa) * (fc - fb));
    } else {
      s = b - (fb * (b - a)) / (fb - fa);
    }
    const q = (3 * a + b) / 4;
    const cond1 = !((s > Math.min(q, b) && s < Math.max(q, b)));
    const cond2 = mflag && Math.abs(s - b) >= Math.abs(b - cc) / 2;
    const cond3 = !mflag && Math.abs(s - b) >= Math.abs(cc - d) / 2;
    const cond4 = mflag && Math.abs(b - cc) < tol;
    const cond5 = !mflag && Math.abs(cc - d) < tol;
    if (cond1 || cond2 || cond3 || cond4 || cond5) {
      s = (a + b) / 2;
      mflag = true;
    } else {
      mflag = false;
    }
    const fs = f(s);
    d = cc;
    cc = b;
    fc = fb;
    if (fa * fs < 0) {
      b = s;
      fb = fs;
    } else {
      a = s;
      fa = fs;
    }
    if (Math.abs(fa) < Math.abs(fb)) {
      [a, b] = [b, a];
      [fa, fb] = [fb, fa];
    }
    if (fb === 0 || Math.abs(b - a) < tol * Math.max(1, Math.abs(b))) return b;
  }
  return b;
}

export function bisect(f: (x: number) => number, a: number, b: number, tol = 1e-12, maxIter = 300): number {
  let fa = f(a);
  if (fa * f(b) > 0) return NaN;
  for (let i = 0; i < maxIter; i++) {
    const m = (a + b) / 2;
    const fm = f(m);
    if (fm === 0 || (b - a) / 2 < tol) return m;
    if (fa * fm < 0) b = m;
    else {
      a = m;
      fa = fm;
    }
  }
  return (a + b) / 2;
}

/**
 * All roots of f in [a, b] found by scanning n sub-intervals for sign changes and polishing with Brent.
 * Sign changes across poles (e.g. tan) are rejected: a genuine root has |f| small compared with
 * the bracket values.
 */
export function scanRoots(f: (x: number) => number, a: number, b: number, n = 2000, maxRoots = Infinity): number[] {
  const roots: number[] = [];
  const h = (b - a) / n;
  let x0 = a;
  let f0 = f(x0);
  for (let i = 1; i <= n && roots.length < maxRoots; i++) {
    const x1 = a + i * h;
    const f1 = f(x1);
    if (f0 === 0) {
      if (!roots.length || Math.abs(roots[roots.length - 1] - x0) > h / 2) roots.push(x0);
    } else if (f0 * f1 < 0 && Number.isFinite(f0) && Number.isFinite(f1)) {
      const r = brent(f, x0, x1);
      const fr = Math.abs(f(r));
      if (Number.isFinite(r) && fr <= 1e-6 * Math.max(1, Math.abs(f0), Math.abs(f1))) roots.push(r);
    }
    x0 = x1;
    f0 = f1;
  }
  return roots;
}

/** Newton's method with numerical derivative fallback. */
export function newton(f: (x: number) => number, x0: number, df?: (x: number) => number, tol = 1e-13, maxIter = 100): number {
  let x = x0;
  for (let i = 0; i < maxIter; i++) {
    const fx = f(x);
    const h = 1e-7 * Math.max(1, Math.abs(x));
    const d = df ? df(x) : (f(x + h) - f(x - h)) / (2 * h);
    if (d === 0) break;
    const dx = fx / d;
    x -= dx;
    if (Math.abs(dx) < tol * Math.max(1, Math.abs(x))) break;
  }
  return x;
}
