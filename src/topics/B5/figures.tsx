// Static figures for B5 problem instances: a beam (cantilever, pinned, clamped, or free–free pinned at its
// mode-1 nodes) carrying labelled point masses or rotors, a disc–shaft chain for Holzer, and a shaft fixed at
// one end with a disc at the other. Each factory returns a zero-prop component for SolveInstance.figure.
import type { ComponentType, ReactNode } from 'react';
import { Figure } from '../../ui/diagrams';

export type BeamSupport = 'cantilever' | 'pinned' | 'clamped' | 'nodes';

export interface BeamMark {
  /** Position as a fraction of L. */
  x: number;
  /** Label above the mass, e.g. "A" or "M = ?". */
  label: string;
  /** Position text under the beam, e.g. "0.35L" (omit for none). */
  at?: string;
  /** Block on the beam (engine, machine, tip mass) or a rotor disc through it. */
  kind?: 'block' | 'rotor';
  /** Relative size 0.6–1.6 (default 1). */
  size?: number;
}

export interface BeamFigureOpts {
  support: BeamSupport;
  masses: BeamMark[];
  /** Harmonic point forces (drawn as double-headed arrows above the beam), e.g. { x: 2/3, label: 'P sin Ωt' }. */
  forces?: { x: number; label: string; at?: string }[];
  /** Text under the length dimension, e.g. "L = 3 m" (default "L"). */
  length?: string;
  /** Caption at the top left, e.g. "uniform cantilever (wing)". */
  caption?: string;
  /** Accessible description. */
  label: string;
}

const W = 440;
const X0 = 46;
const X1 = 394;
const Y = 78;
const px = (x: number) => X0 + (X1 - X0) * x;

function clamp(x: number, side: -1 | 1): ReactNode {
  const hatch: ReactNode[] = [];
  for (let k = -3; k <= 3; k++) hatch.push(<line key={k} x1={x} y1={Y + k * 8} x2={x + side * 8} y2={Y + k * 8 + 6} />);
  return (
    <g stroke="var(--text-3)" strokeWidth={1.2}>
      <line x1={x} y1={Y - 30} x2={x} y2={Y + 30} stroke="var(--text-2)" strokeWidth={3} />
      {hatch}
    </g>
  );
}

function pin(x: number, dashed = false): ReactNode {
  return (
    <g stroke="var(--text-2)" strokeWidth={1.4} fill="var(--surface)" strokeDasharray={dashed ? '3 2' : undefined}>
      <path d={`M${x} ${Y + 5}L${x - 9} ${Y + 21}L${x + 9} ${Y + 21}Z`} />
      <line x1={x - 13} y1={Y + 24} x2={x + 13} y2={Y + 24} stroke="var(--text-3)" />
    </g>
  );
}

/** A uniform beam with its supports, labelled masses (positions underneath) and the length dimension. */
export function beamFigure(o: BeamFigureOpts): ComponentType {
  function BeamFig() {
    const s = o.support;
    return (
      <Figure width={W} height={150} label={o.label}>
        {o.caption && (
          <text x={8} y={14} className="diagram-label" style={{ fontSize: 12, fill: 'var(--text-2)' }}>
            {o.caption}
          </text>
        )}
        <rect x={X0} y={Y - 4} width={X1 - X0} height={8} rx={2} fill="var(--surface-3)" stroke="var(--text-2)" strokeWidth={1.2} />
        {s === 'cantilever' && clamp(X0, -1)}
        {s === 'clamped' && (
          <>
            {clamp(X0, -1)}
            {clamp(X1, 1)}
          </>
        )}
        {s === 'pinned' && (
          <>
            {pin(X0)}
            {pin(X1)}
          </>
        )}
        {s === 'nodes' && (
          <>
            {pin(px(0.224), true)}
            {pin(px(0.776), true)}
            <text x={px(0.5)} y={Y + 40} textAnchor="middle" className="diagram-label" style={{ fontSize: 11, fill: 'var(--text-3)' }}>
              model: pinned at the mode-1 nodes, 0.224L from each end
            </text>
          </>
        )}
        {o.masses.map((m, i) => {
          const x = px(Math.min(1, Math.max(0, m.x)));
          const k = m.size ?? 1;
          if (m.kind === 'rotor') {
            const h = 30 * k;
            return (
              <g key={i}>
                <rect x={x - 5} y={Y - h} width={10} height={2 * h} rx={3} fill="var(--surface-2)" stroke="var(--text)" strokeWidth={1.6} />
                <text x={x} y={Y - h - 6} textAnchor="middle" className="diagram-label" style={{ fontSize: 12 }}>
                  {m.label}
                </text>
              </g>
            );
          }
          const b = 18 * k;
          const cx = Math.min(X1 - b / 2 + 4, Math.max(X0 + b / 2, x));
          return (
            <g key={i}>
              <rect x={cx - b / 2} y={Y - 4 - b} width={b} height={b} rx={2} fill="var(--surface-2)" stroke="var(--text)" strokeWidth={1.6} />
              <text x={cx} y={Y - 10 - b} textAnchor="middle" className="diagram-label" style={{ fontSize: 12 }}>
                {m.label}
              </text>
            </g>
          );
        })}
        {(o.forces ?? []).map((f, i) => {
          const x = px(Math.min(1, Math.max(0, f.x)));
          return (
            <g key={`f${i}`} stroke="var(--text)" fill="var(--text)" strokeWidth={1.5}>
              <line x1={x} y1={Y - 9} x2={x} y2={Y - 42} />
              <path d={`M${x} ${Y - 7}l-4 -7h8z`} stroke="none" />
              <path d={`M${x} ${Y - 44}l-4 7h8z`} stroke="none" />
              <text x={x + 7} y={Y - 32} className="diagram-label" stroke="none" style={{ fontSize: 12 }}>
                {f.label}
              </text>
            </g>
          );
        })}
        {[...o.masses, ...(o.forces ?? [])]
          .filter((m) => m.at)
          .map((m, i) => (
            <g key={`at${i}`} stroke="var(--text-3)" strokeWidth={1}>
              <line x1={px(m.x)} y1={Y + (s === 'nodes' ? 6 : 28)} x2={px(m.x)} y2={Y + (s === 'nodes' ? 14 : 36)} />
              <text x={px(m.x)} y={Y + (s === 'nodes' ? 26 : 48)} textAnchor="middle" className="diagram-label" stroke="none" style={{ fontSize: 11 }}>
                {m.at}
              </text>
            </g>
          ))}
        <g stroke="var(--text-3)" strokeWidth={1}>
          <line x1={X0} y1={Y + 58} x2={X1} y2={Y + 58} />
          <line x1={X0} y1={Y + 53} x2={X0} y2={Y + 63} />
          <line x1={X1} y1={Y + 53} x2={X1} y2={Y + 63} />
        </g>
        <text x={(X0 + X1) / 2} y={Y + 70} textAnchor="middle" className="diagram-label" style={{ fontSize: 12 }}>
          {o.length ?? 'L'}
        </text>
      </Figure>
    );
  }
  return BeamFig;
}

/** Side view of a torsional chain: discs J₁…Jₙ on shaft segments k₁…, free start, free or fixed far end. */
export function chainFigure(J: string[], k: string[], far: 'free' | 'fixed', caption?: string): ComponentType {
  function ChainFig() {
    const n = J.length;
    const right = far === 'fixed' ? 380 : 400;
    const xs = J.map((_, i) => (n === 1 ? 70 : 60 + ((right - (far === 'fixed' ? 90 : 60) - 60) * i) / (n - 1)));
    const yc = 74;
    const last = far === 'fixed' ? right : xs[n - 1];
    return (
      <Figure width={440} height={140} label={`Torsional chain of ${n} discs on shafts, ${far === 'fixed' ? 'fixed to a wall at the far end' : 'free at both ends'}`}>
        {caption && (
          <text x={8} y={14} className="diagram-label" style={{ fontSize: 12, fill: 'var(--text-2)' }}>
            {caption}
          </text>
        )}
        <line x1={xs[0]} y1={yc} x2={last} y2={yc} stroke="var(--text-2)" strokeWidth={4} strokeLinecap="round" />
        {xs.map((x, i) => (
          <g key={i}>
            <rect x={x - 6} y={yc - 30} width={12} height={60} rx={3} fill="var(--surface-2)" stroke="var(--text)" strokeWidth={1.6} />
            <text x={x} y={yc + 46} textAnchor="middle" className="diagram-label" style={{ fontSize: 12 }}>
              {J[i]}
            </text>
          </g>
        ))}
        {k.map((lab, i) => {
          const a = xs[i];
          const b = i < n - 1 ? xs[i + 1] : last;
          return (
            <text key={`k${i}`} x={(a + b) / 2} y={yc - 10} textAnchor="middle" className="diagram-label" style={{ fontSize: 12 }}>
              {lab}
            </text>
          );
        })}
        {far === 'fixed' && (
          <g stroke="var(--text-3)" strokeWidth={1.2}>
            <line x1={right} y1={yc - 34} x2={right} y2={yc + 34} stroke="var(--text-2)" strokeWidth={3} />
            {[-3, -2, -1, 0, 1, 2, 3].map((j) => (
              <line key={j} x1={right} y1={yc + j * 9} x2={right + 8} y2={yc + j * 9 + 6} />
            ))}
          </g>
        )}
        <text x={xs[0]} y={yc - 40} textAnchor="middle" className="diagram-label" style={{ fontSize: 11, fill: 'var(--text-3)' }}>
          start: θ₁ = 1
        </text>
      </Figure>
    );
  }
  return ChainFig;
}

/** Uniform shaft fixed at the left with a rigid disc at the right (torsion); without `discText` the right end is simply free. */
export function shaftDiscFigure(shaftText: string, discText?: string, caption?: string): ComponentType {
  function ShaftDiscFig() {
    const yc = caption ? 74 : 66;
    return (
      <Figure width={440} height={caption ? 134 : 126} label={`Shaft fixed at one end (${shaftText})${discText ? `, carrying ${discText} at the other` : ', free at the other'}`}>
        {caption && (
          <text x={8} y={14} className="diagram-label" style={{ fontSize: 12, fill: 'var(--text-2)' }}>
            {caption}
          </text>
        )}
        <g stroke="var(--text-3)" strokeWidth={1.2}>
          <line x1={50} y1={yc - 34} x2={50} y2={yc + 34} stroke="var(--text-2)" strokeWidth={3} />
          {[-3, -2, -1, 0, 1, 2, 3].map((j) => (
            <line key={j} x1={50} y1={yc + j * 9} x2={42} y2={yc + j * 9 + 6} />
          ))}
        </g>
        <rect x={50} y={yc - 5} width={300} height={10} rx={2} fill="var(--surface-3)" stroke="var(--text-2)" strokeWidth={1.2} />
        {discText ? (
          <>
            <rect x={346} y={yc - 40} width={16} height={80} rx={3} fill="var(--surface-2)" stroke="var(--text)" strokeWidth={1.8} />
            <path d={`M372 ${yc - 22} a 14 22 0 0 1 0 44`} fill="none" stroke="var(--text-2)" strokeWidth={1.3} />
            <path d={`M372 ${yc + 22} l-5 -7 l9 1 z`} fill="var(--text-2)" />
            <text x={354} y={yc + 56} textAnchor="middle" className="diagram-label" style={{ fontSize: 12 }}>
              {discText}
            </text>
          </>
        ) : (
          <text x={352} y={yc + 24} textAnchor="middle" className="diagram-label" style={{ fontSize: 12 }}>
            free end
          </text>
        )}
        <text x={200} y={yc - 14} textAnchor="middle" className="diagram-label" style={{ fontSize: 12 }}>
          {shaftText}
        </text>
      </Figure>
    );
  }
  return ShaftDiscFig;
}

/** Several figures stacked (e.g. a member schematic above the candidate mode sketches). */
export function stackFigures(...figs: ComponentType[]): ComponentType {
  function Stacked() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {figs.map((F, i) => (
          <F key={i} />
        ))}
      </div>
    );
  }
  return Stacked;
}
