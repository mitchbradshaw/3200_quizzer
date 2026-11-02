// Drawing pieces for the B6 design studio and the bending-vs-torsion comparer: supports drawn inside a
// <Plot> (data coordinates x/L, deflection 0), a member schematic with loads and masses, and a check line.
import type { ReactNode } from 'react';
import { usePlot } from '../../../plot/Plot';
import type { StudioScenario } from '../studioModel';

export type EndKind = 'clamp' | 'pin' | 'free';

/** Supports at x/L = 0 and 1 of a Plot whose y = 0 is the undeformed member. */
export function PlotEnds({ left, right }: { left: EndKind; right: EndKind }) {
  const { sx, sy } = usePlot();
  const y0 = sy(0);
  const one = (x: number, end: EndKind, side: -1 | 1, key: string): ReactNode => {
    if (end === 'free') return null;
    if (end === 'pin')
      return (
        <g key={key} stroke="var(--text-2)" strokeWidth={1.4} fill="var(--surface)">
          <path d={`M${x} ${y0}L${x - 7} ${y0 + 12}L${x + 7} ${y0 + 12}Z`} />
          <line x1={x - 11} y1={y0 + 14} x2={x + 11} y2={y0 + 14} stroke="var(--text-3)" />
        </g>
      );
    const hatch: ReactNode[] = [];
    for (let k = -3; k <= 3; k++) hatch.push(<line key={k} x1={x} y1={y0 + k * 6} x2={x + side * 6} y2={y0 + k * 6 + 5} />);
    return (
      <g key={key} stroke="var(--text-3)" strokeWidth={1.1}>
        <line x1={x} y1={y0 - 20} x2={x} y2={y0 + 20} stroke="var(--text-2)" strokeWidth={2.6} />
        {hatch}
      </g>
    );
  };
  return (
    <g pointerEvents="none">
      {one(sx(0), left, -1, 'l')}
      {one(sx(1), right, 1, 'r')}
    </g>
  );
}

/** A small "✓ / ✗ label: detail" line; colour is backed by the icon and the words. */
export function CheckLine({ ok, label, detail }: { ok: boolean; label: string; detail: ReactNode }) {
  return (
    <div className="row gap-s" style={{ alignItems: 'flex-start', margin: '4px 0' }}>
      <span aria-hidden="true" style={{ color: ok ? 'var(--ok)' : 'var(--bad)', fontWeight: 700, minWidth: 14 }}>
        {ok ? '✓' : '✗'}
      </span>
      <span className="small">
        <strong style={{ color: ok ? 'var(--ok)' : 'var(--bad)' }}>
          {label} {ok ? 'met' : 'not met'}
        </strong>
        {': '}
        {detail}
      </span>
    </div>
  );
}

/** Side view of the member: supports, loads, masses, length and the cross-section. */
export function MemberSketch({ sc, dimText, thickText, mu, massX }: { sc: StudioScenario; dimText: string; thickText: string; mu: number[]; massX: number[] }) {
  const X0 = 64;
  const X1 = 486;
  const Y = 62;
  const px = (x: number) => X0 + (X1 - X0) * x;
  const pinned = sc.bc === 'pinned-pinned';
  const hatchL: ReactNode[] = [];
  for (let k = -3; k <= 3; k++) hatchL.push(<line key={k} x1={X0} y1={Y + k * 8} x2={X0 - 7} y2={Y + k * 8 + 6} />);
  const pin = (x: number) => (
    <g stroke="var(--text-2)" strokeWidth={1.4} fill="var(--surface)">
      <path d={`M${x} ${Y + 6}L${x - 9} ${Y + 22}L${x + 9} ${Y + 22}Z`} />
      <line x1={x - 14} y1={Y + 25} x2={x + 14} y2={Y + 25} stroke="var(--text-3)" />
    </g>
  );
  const loadLabel = sc.forceKind === 'unbalance' ? 'meΩ²' : 'P';
  return (
    <svg viewBox="0 0 640 124" width="100%" role="img" aria-label={`${sc.title}: ${pinned ? 'pinned at both bearings' : 'clamped at the root, free at the tip'}, loads at ${sc.forces.map((x) => `${x}L`).join(' and ')}`} style={{ display: 'block' }}>
      {/* member */}
      <rect x={X0} y={Y - 5} width={X1 - X0} height={10} rx={2} fill="var(--surface-3)" stroke="var(--text-2)" strokeWidth={1.2} />
      {/* supports */}
      {pinned ? (
        <>
          {pin(X0)}
          {pin(X1)}
        </>
      ) : (
        <g stroke="var(--text-3)" strokeWidth={1.2}>
          <line x1={X0} y1={Y - 30} x2={X0} y2={Y + 30} stroke="var(--text-2)" strokeWidth={3} />
          {hatchL}
        </g>
      )}
      {/* loads: harmonic, so drawn as double-headed arrows */}
      {sc.forces.map((x, i) => (
        <g key={i} stroke="var(--text)" fill="var(--text)" strokeWidth={1.5}>
          <line x1={px(x)} y1={Y - 9} x2={px(x)} y2={Y - 40} />
          <path d={`M${px(x)} ${Y - 7}l-4 -7h8z`} stroke="none" />
          <path d={`M${px(x)} ${Y - 42}l-4 7h8z`} stroke="none" />
          <text x={px(x) + 6} y={Y - 32} className="diagram-label" stroke="none" style={{ fontSize: 12 }}>
            {loadLabel}
          </text>
        </g>
      ))}
      {/* added masses */}
      {mu.map((m, k) => {
        if (!(m > 0)) return null;
        const s = 8 + 12 * Math.sqrt(Math.min(m, 3) / 3);
        const x = Math.min(X1, Math.max(X0, px(massX[k])));
        return <rect key={k} x={x - s / 2} y={Y - s / 2} width={s} height={s} rx={2} fill="var(--surface)" stroke="var(--text)" strokeWidth={1.6} opacity={0.9} />;
      })}
      {/* length */}
      <g stroke="var(--text-3)" strokeWidth={1}>
        <line x1={X0} y1={Y + 38} x2={X1} y2={Y + 38} />
        <line x1={X0} y1={Y + 33} x2={X0} y2={Y + 43} />
        <line x1={X1} y1={Y + 33} x2={X1} y2={Y + 43} />
      </g>
      <text x={(X0 + X1) / 2} y={Y + 54} textAnchor="middle" className="diagram-label" style={{ fontSize: 12 }}>
        L = {sc.L.toFixed(sc.L < 10 ? 2 : 1)} m{pinned ? ' between the bearings' : ''}
      </text>
      {/* cross-section */}
      {sc.section === 'rect' ? (
        <g>
          <rect x={556} y={30} width={7} height={64} fill="var(--surface-3)" stroke="var(--text-2)" strokeWidth={1.3} />
          <text x={571} y={66} className="diagram-label" style={{ fontSize: 12 }}>
            w = {dimText}
          </text>
          <text x={542} y={110} className="diagram-label" style={{ fontSize: 12 }}>
            t = {thickText}
          </text>
        </g>
      ) : (
        <g>
          <circle cx={566} cy={58} r={26} fill="none" stroke="var(--text-2)" strokeWidth={4} />
          <line x1={540} y1={58} x2={592} y2={58} stroke="var(--text-3)" strokeDasharray="3 3" />
          <text x={566} y={53} textAnchor="middle" className="diagram-label" style={{ fontSize: 12 }}>
            d
          </text>
          <text x={566} y={102} textAnchor="middle" className="diagram-label" style={{ fontSize: 12 }}>
            d = {dimText}
          </text>
          <text x={566} y={117} textAnchor="middle" className="diagram-label" style={{ fontSize: 12 }}>
            t = {thickText}
          </text>
        </g>
      )}
      <text x={X0 - 4} y={14} className="diagram-label" style={{ fontSize: 12, fill: 'var(--text-2)' }}>
        {pinned ? 'pinned bearings, defect load' : sc.forceKind === 'unbalance' ? 'clamped root, rotor unbalance loads' : 'clamped root, defect load'}
      </text>
    </svg>
  );
}
