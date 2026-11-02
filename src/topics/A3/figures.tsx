// Static figures for A3 problem instances: a 2023 A1.3-style table of modes and a vertical 2-DoF chain sketch.
import type { ComponentType } from 'react';
import { Figure, Ground, MassBlock, Spring } from '../../ui/diagrams';

/** Table of modes as printed in 2023 A1.3: one row per mode, entries for each DoF, frequency in Hz. */
export function modeTableFigure(f: number[], rows: number[][], decimals = 3): ComponentType {
  const n = rows[0]?.length ?? 0;
  function ModeTable() {
    return (
      <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
        <table className="table mono small" style={{ borderCollapse: 'collapse', minWidth: 0 }} aria-label="Table of mode shapes: one row per mode">
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '3px 8px' }}>Mode</th>
              <th style={{ textAlign: 'right', padding: '3px 8px' }}>f (Hz)</th>
              {Array.from({ length: n }, (_, j) => (
                <th key={j} style={{ textAlign: 'right', padding: '3px 6px' }}>
                  DoF {j + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                <td style={{ padding: '3px 8px' }}>{i + 1}</td>
                <td style={{ textAlign: 'right', padding: '3px 8px' }}>{f[i].toFixed(3)}</td>
                {row.map((v, j) => (
                  <td key={j} style={{ textAlign: 'right', padding: '3px 6px' }}>
                    {(v < 0 ? '−' : '') + Math.abs(v).toFixed(decimals)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  return ModeTable;
}

/** Vertical chain ground–k1–m1–k2–m2 with optional labels (e.g. "foundation block", "machine"). */
export function chainFigure(label1 = 'm₁', label2 = 'm₂', k1 = 'k₁', k2 = 'k₂'): ComponentType {
  function ChainSketch() {
    return (
      <Figure width={240} height={250} label={`Two-mass chain: ground, spring ${k1}, mass ${label1}, spring ${k2}, mass ${label2}`}>
        <Ground x={90} y={232} w={120} />
        <Spring x1={90} y1={232} x2={90} y2={170} coils={5} amp={9} />
        <MassBlock x={90} y={150} w={110} h={40} label={label1} />
        <Spring x1={90} y1={130} x2={90} y2={78} coils={5} amp={9} />
        <MassBlock x={90} y={58} w={80} h={40} label={label2} />
        <text x={110} y={205} className="diagram-label">
          {k1}
        </text>
        <text x={110} y={108} className="diagram-label">
          {k2}
        </text>
        <line x1={175} y1={150} x2={175} y2={118} stroke="var(--text-2)" strokeWidth={1.5} />
        <path d="M175 112 l-4 8 h8 z" fill="var(--text-2)" />
        <text x={183} y={136} className="diagram-label">
          x₁
        </text>
        <line x1={160} y1={58} x2={160} y2={26} stroke="var(--text-2)" strokeWidth={1.5} />
        <path d="M160 20 l-4 8 h8 z" fill="var(--text-2)" />
        <text x={168} y={44} className="diagram-label">
          x₂
        </text>
      </Figure>
    );
  }
  return ChainSketch;
}
