// Fixed-step ODE integration, decoupled from the display frame rate.
export type Deriv = (t: number, y: readonly number[]) => number[];

export function rk4Step(f: Deriv, t: number, y: readonly number[], h: number): number[] {
  const n = y.length;
  const k1 = f(t, y);
  const y2 = new Array<number>(n);
  for (let i = 0; i < n; i++) y2[i] = y[i] + (h / 2) * k1[i];
  const k2 = f(t + h / 2, y2);
  for (let i = 0; i < n; i++) y2[i] = y[i] + (h / 2) * k2[i];
  const k3 = f(t + h / 2, y2);
  for (let i = 0; i < n; i++) y2[i] = y[i] + h * k3[i];
  const k4 = f(t + h, y2);
  const out = new Array<number>(n);
  for (let i = 0; i < n; i++) out[i] = y[i] + (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
  return out;
}

/** Integrate from t0 to t1 with step h, returning samples every `every` steps. */
export function integrate(f: Deriv, y0: readonly number[], t0: number, t1: number, h: number, every = 1) {
  const ts: number[] = [t0];
  const ys: number[][] = [y0.slice()];
  let y = y0.slice();
  let t = t0;
  const steps = Math.max(1, Math.round((t1 - t0) / h));
  const hh = (t1 - t0) / steps;
  for (let s = 1; s <= steps; s++) {
    y = rk4Step(f, t, y, hh);
    t = t0 + s * hh;
    if (s % every === 0 || s === steps) {
      ts.push(t);
      ys.push(y);
    }
  }
  return { t: ts, y: ys };
}

/**
 * Accumulates wall-clock time and advances the state in fixed steps, so the physics is
 * identical at 30, 60 or 144 fps. `advance` returns the number of steps taken.
 */
export class FixedStepper {
  t = 0;
  private acc = 0;
  constructor(
    public f: Deriv,
    public y: number[],
    public h = 1 / 1000,
    public maxStepsPerFrame = 400
  ) {}
  advance(dtWall: number, timeScale = 1): number {
    this.acc += Math.min(dtWall, 0.1) * timeScale;
    let n = 0;
    while (this.acc >= this.h && n < this.maxStepsPerFrame) {
      this.y = rk4Step(this.f, this.t, this.y, this.h);
      this.t += this.h;
      this.acc -= this.h;
      n++;
    }
    if (n >= this.maxStepsPerFrame) this.acc = 0;
    return n;
  }
  reset(y: number[], t = 0) {
    this.y = y.slice();
    this.t = t;
    this.acc = 0;
  }
}
