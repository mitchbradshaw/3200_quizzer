// Tick helper for short linear plots: the shared automatic ticks can leave only "0" on a 110–170 px tall
// symmetric axis, so these plots pass explicit ticks (a 1/2/5 step giving 3–5 ticks inside [lo, hi]).

/** Nice tick values inside [lo, hi], aiming for about `target` intervals; always includes 0 when it is in range. */
export function niceTicks(lo: number, hi: number, target = 4): number[] {
  const span = hi - lo;
  if (!(span > 0) || !Number.isFinite(span)) return [0];
  const raw = span / target;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const f = raw / mag;
  const step = (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * mag;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9 * span; v += step) out.push(Math.abs(v) < 1e-9 * span ? 0 : Number(v.toPrecision(12)));
  return out;
}
