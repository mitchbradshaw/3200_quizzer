// SVG pieces for beam diagrams, shared by the B3 and B4 simulations (pixel coordinates inside an <svg>).
// Per-frame updates go through beamPathD() + setAttribute on a ref, never through React state.
import type { ReactNode } from 'react';
import type { BeamEnd } from '../../../physics/beams';
import { Button, modeColor } from '../../../ui/kit';

/**
 * Support symbol at a beam end (x, y is the beam's end point on its axis):
 * clamped = thick wall with hatching on the outside; pinned = triangle on hatched ground; free = a small label.
 */
export function EndSymbol({ x, y, end, side, size = 1, showFree = true }: { x: number; y: number; end: BeamEnd; side: 'left' | 'right'; size?: number; showFree?: boolean }) {
  const dir = side === 'left' ? -1 : 1;
  if (end === 'clamped') {
    const h = 24 * size;
    const hatch: ReactNode[] = [];
    for (let k = -h + 3; k <= h; k += 7 * size) hatch.push(<line key={k} x1={x} y1={y + k} x2={x + dir * 8 * size} y2={y + k - 6 * size} />);
    return (
      <g stroke="var(--text-3)" strokeWidth={1.3} aria-hidden="true">
        <line x1={x} y1={y - h} x2={x} y2={y + h} strokeWidth={3} stroke="var(--text-2)" />
        {hatch}
      </g>
    );
  }
  if (end === 'pinned') {
    const s = 10 * size;
    const gy = y + 1.7 * s;
    const hatch: ReactNode[] = [];
    for (let k = -s * 1.4; k <= s * 1.4; k += 6 * size) hatch.push(<line key={k} x1={x + k} y1={gy} x2={x + k - 5 * size} y2={gy + 6 * size} />);
    return (
      <g aria-hidden="true">
        <path d={`M${x} ${y} L${x - s} ${gy} L${x + s} ${gy} Z`} fill="var(--surface-2)" stroke="var(--text-2)" strokeWidth={1.6} strokeLinejoin="round" />
        <g stroke="var(--text-3)" strokeWidth={1.2}>
          <line x1={x - s * 1.5} y1={gy} x2={x + s * 1.5} y2={gy} strokeWidth={1.8} stroke="var(--text-2)" />
          {hatch}
        </g>
        <circle cx={x} cy={y} r={2.8 * size} fill="var(--surface)" stroke="var(--text-2)" strokeWidth={1.4} />
      </g>
    );
  }
  if (!showFree) return null;
  return (
    <text x={x + dir * 6} y={y - 12} textAnchor={side === 'left' ? 'end' : 'start'} className="plot-note">
      free
    </text>
  );
}

/** Path data for a deflected beam: samples[k] at x = x0 + (x1 − x0) k/n, drawn at yAxis − scale·samples[k]·phase. */
export function beamPathD(samples: ArrayLike<number>, x0: number, x1: number, yAxis: number, scale: number, phase = 1): string {
  const n = samples.length - 1;
  let d = '';
  for (let k = 0; k <= n; k++) {
    const x = x0 + ((x1 - x0) * k) / n;
    const y = yAxis - scale * phase * samples[k];
    d += `${k ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return d;
}

/** Closed envelope band between +samples and −samples (for the swept region of a mode). */
export function envelopeD(samples: ArrayLike<number>, x0: number, x1: number, yAxis: number, scale: number): string {
  const n = samples.length - 1;
  let d = '';
  for (let k = 0; k <= n; k++) d += `${k ? 'L' : 'M'}${(x0 + ((x1 - x0) * k) / n).toFixed(1)} ${(yAxis - scale * samples[k]).toFixed(1)}`;
  for (let k = n; k >= 0; k--) d += `L${(x0 + ((x1 - x0) * k) / n).toFixed(1)} ${(yAxis + scale * samples[k]).toFixed(1)}`;
  return `${d}Z`;
}

/** Value of sampled data at xi in [0, 1] by linear interpolation. */
export function sampleAt(samples: ArrayLike<number>, xi: number): number {
  const n = samples.length - 1;
  const u = Math.max(0, Math.min(1, xi)) * n;
  const k = Math.min(n - 1, Math.floor(u));
  const f = u - k;
  return samples[k] * (1 - f) + samples[k + 1] * f;
}

/** "0.783L" style label for a position given as a fraction of L. */
export const posLabel = (xi: number, digits = 3): string => `${xi.toFixed(digits)}L`;

/** Snap-to-node buttons grouped by mode (mode name in its colour), e.g. "mode 2: 0.783L". */
export function NodeSnaps({ marks, onSnap, current, label = 'Snap the force to a node of' }: { marks: { x: number; i: number }[]; onSnap: (x: number) => void; current?: number; label?: string }) {
  const modes = [...new Set(marks.map((m) => m.i))].sort((a, b) => a - b);
  if (!modes.length) return <p className="muted small">No interior nodes in modes 1–4 for these supports.</p>;
  return (
    <div>
      <div className="muted small">{label}</div>
      {modes.map((i) => (
        <div key={i} className="row gap-s wrap" style={{ alignItems: 'center', marginTop: 4 }}>
          <span className="small" style={{ color: modeColor(i), fontWeight: 600, minWidth: 54 }}>{`mode ${i}`}</span>
          {marks
            .filter((m) => m.i === i)
            .map((m) => (
              <Button key={m.x} size="sm" variant={current !== undefined && Math.abs(current - m.x) < 5e-4 ? 'primary' : 'default'} onClick={() => onSnap(m.x)} title={`node of mode ${i} at x/L = ${m.x.toFixed(4)}`}>
                {posLabel(m.x)}
              </Button>
            ))}
        </div>
      ))}
    </div>
  );
}

/** The kit's readout grid with a fixed number of columns, for readouts whose text is longer than a number. */
export function ReadoutGrid({ cols = 2, children }: { cols?: number; children: ReactNode }) {
  return (
    <div className="readouts" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {children}
    </div>
  );
}
