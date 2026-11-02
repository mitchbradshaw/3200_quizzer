// Static problem figures for the B2 generators. Factories return prop-less components (SolveInstance.figure).
import type { ComponentType } from 'react';
import { Figure, Ground } from '../../ui/diagrams';

type End = 'fixed' | 'free' | 'disc';

function Wall({ x, y }: { x: number; y: number }) {
  return <Ground x={x} y={y} w={56} vertical side={x < 100 ? 'left' : 'right'} />;
}

/** A string fixed at both ends, with an optional pluck triangle and a finger (touch or press) marker. */
export function stringFigure(opts: { pluck?: number; finger?: { at: number; kind: 'touch' | 'press' }; label?: string } = {}): ComponentType {
  const x0 = 40;
  const x1 = 320;
  const y = 80;
  const X = (f: number) => x0 + (x1 - x0) * f;
  return function StringFig() {
    const a = opts.pluck;
    const f = opts.finger;
    // A firm press makes a new fixed end: only the segment holding the pluck point is pulled aside.
    const seg: [number, number] = f && f.kind === 'press' && a !== undefined ? (a > f.at ? [f.at, 1] : [0, f.at]) : [0, 1];
    return (
      <Figure width={360} height={160} label={opts.label ?? 'A string fixed at both ends'}>
        <Wall x={x0} y={y} />
        <Wall x={x1} y={y} />
        {a !== undefined ? (
          <>
            <line x1={x0} y1={y} x2={x1} y2={y} stroke="var(--text-3)" strokeDasharray="4 4" />
            {seg[0] > 0 && <line x1={x0} y1={y} x2={X(seg[0])} y2={y} stroke="var(--m1)" strokeWidth={2.2} />}
            {seg[1] < 1 && <line x1={X(seg[1])} y1={y} x2={x1} y2={y} stroke="var(--m1)" strokeWidth={2.2} />}
            <polyline points={`${X(seg[0])},${y} ${X(a)},${y - 34} ${X(seg[1])},${y}`} fill="none" stroke="var(--m1)" strokeWidth={2.2} />
            <text x={X(a)} y={y - 42} textAnchor="middle" className="plot-note">
              pluck
            </text>
          </>
        ) : (
          <line x1={x0} y1={y} x2={x1} y2={y} stroke="var(--m1)" strokeWidth={2.2} />
        )}
        {f && (
          <g>
            <rect x={X(f.at) - 7} y={y + 4} width={14} height={f.kind === 'press' ? 22 : 16} rx={6} fill="var(--surface-3)" stroke="var(--accent)" strokeWidth={1.6} />
            <text x={X(f.at)} y={y + 42} textAnchor="middle" className="plot-note">
              {f.kind === 'press' ? 'press firmly (new fixed end)' : 'touch lightly (forces a node)'}
            </text>
          </g>
        )}
        <line x1={x0} y1={y + 58} x2={x1} y2={y + 58} stroke="var(--text-3)" strokeWidth={1} />
        <text x={(x0 + x1) / 2} y={y + 72} textAnchor="middle" className="plot-note">
          L
        </text>
      </Figure>
    );
  };
}

/** A shaft or rod with chosen ends: a wall for fixed, nothing for free, a large disc for an end inertia. */
export function shaftFigure(opts: { left: End; right: End; label: string; note?: string }): ComponentType {
  const x0 = 50;
  const x1 = 300;
  const y = 70;
  return function ShaftFig() {
    return (
      <Figure width={360} height={130} label={opts.label}>
        {opts.left === 'fixed' && <Wall x={x0} y={y} />}
        {opts.right === 'fixed' && <Wall x={x1} y={y} />}
        <rect x={x0} y={y - 9} width={x1 - x0} height={18} rx={3} fill="var(--surface-2)" stroke="var(--text-2)" strokeWidth={1.6} />
        <line x1={x0 - 8} y1={y} x2={x1 + 8} y2={y} stroke="var(--text-3)" strokeDasharray="6 3 1 3" />
        {opts.right === 'disc' && <ellipse cx={x1 + 6} cy={y} rx={11} ry={38} fill="var(--surface-3)" stroke="var(--m2)" strokeWidth={2} />}
        {opts.right === 'disc' && (
          <text x={x1 + 24} y={y - 26} className="plot-note">
            Iₑ
          </text>
        )}
        {opts.left === 'free' && (
          <text x={x0 - 4} y={y + 30} textAnchor="middle" className="plot-note">
            free
          </text>
        )}
        {opts.right === 'free' && (
          <text x={x1 + 4} y={y + 30} textAnchor="middle" className="plot-note">
            free
          </text>
        )}
        <text x={(x0 + x1) / 2} y={y - 18} textAnchor="middle" className="plot-note">
          {opts.note ?? 'L'}
        </text>
      </Figure>
    );
  };
}

/** A weight swinging on a string with angular amplitude theta0. */
export function swingFigure(theta0Deg: number): ComponentType {
  const px = 180;
  const py = 22;
  const R = 92;
  const t = (theta0Deg * Math.PI) / 180;
  return function SwingFig() {
    const bx = px + R * Math.sin(t);
    const by = py + R * Math.cos(t);
    return (
      <Figure width={360} height={140} label={`A weight swinging on a string with amplitude ${theta0Deg} degrees`}>
        <line x1={px - 40} y1={py} x2={px + 40} y2={py} stroke="var(--text-3)" strokeWidth={2} />
        <line x1={px} y1={py} x2={px} y2={py + R + 14} stroke="var(--text-3)" strokeDasharray="3 4" />
        <path d={`M${px - R * Math.sin(t)} ${py + R * Math.cos(t)} A${R} ${R} 0 0 0 ${bx} ${by}`} fill="none" stroke="var(--border)" strokeDasharray="4 4" />
        <line x1={px} y1={py} x2={bx} y2={by} stroke="var(--m1)" strokeWidth={2} />
        <circle cx={bx} cy={by} r={9} fill="var(--surface-3)" stroke="var(--text-2)" strokeWidth={1.6} />
        <text x={bx + 13} y={by + 4} className="plot-note">
          m
        </text>
        <text x={px + 8} y={py + 34} className="plot-note">
          θ₀ = {theta0Deg}°
        </text>
      </Figure>
    );
  };
}

/** A cable of length l whirled about A at Omega with an end mass m. */
export function cableFigure(): ComponentType {
  return function CableFig() {
    const ax = 60;
    const ay = 70;
    const bx = 290;
    return (
      <Figure width={360} height={140} label="A cable with an end mass rotating about A">
        <circle cx={ax} cy={ay} r={6} fill="var(--surface)" stroke="var(--text-2)" strokeWidth={2} />
        <text x={ax - 4} y={ay + 22} textAnchor="middle" className="plot-note">
          A
        </text>
        <path d={`M${ax} ${ay} Q ${(ax + bx) / 2} ${ay - 12} ${bx} ${ay}`} fill="none" stroke="var(--m1)" strokeWidth={2} />
        <circle cx={bx} cy={ay} r={11} fill="var(--surface-3)" stroke="var(--text-2)" strokeWidth={1.6} />
        <text x={bx} y={ay + 4} textAnchor="middle" className="diagram-label">
          m
        </text>
        <path d={`M${ax + 22} ${ay - 34} A 36 36 0 0 1 ${ax + 34} ${ay + 24}`} fill="none" stroke="var(--accent)" strokeWidth={1.6} />
        <text x={ax + 40} y={ay - 30} className="plot-note">
          Ω
        </text>
        <text x={(ax + bx) / 2} y={ay + 30} textAnchor="middle" className="plot-note">
          l, ρₗ
        </text>
      </Figure>
    );
  };
}
