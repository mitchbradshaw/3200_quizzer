// Monospace MATLAB-style matrix output ("P =", "D ="). When the container is too narrow it splits the columns into
// "Columns 1 through 2" / "Columns 3 through 4" blocks, exactly as MATLAB does in a narrow command window.
import type { ComponentType, CSSProperties } from 'react';
import { useWidth } from '../../anim/hooks';

export interface MatlabMatrix {
  name: string;
  /** Text cells [row][column], e.g. from matlabText(). */
  cells: string[][];
}

const FONT_PX = 13;
const CHAR_W = 0.61 * FONT_PX;

const preStyle: CSSProperties = {
  fontFamily: 'var(--mono)',
  fontSize: FONT_PX,
  lineHeight: 1.45,
  whiteSpace: 'pre',
  margin: 0,
};
const boxStyle: CSSProperties = {
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '8px 10px',
  overflowX: 'auto',
  maxWidth: '100%',
};
const cellBtn: CSSProperties = {
  font: 'inherit',
  color: 'inherit',
  background: 'none',
  border: 0,
  padding: 0,
  margin: 0,
  cursor: 'pointer',
  borderRadius: 4,
};

/** How many columns fit side by side in `width` px. */
function perChunk(width: number, cellLen: number, nCols: number): number {
  const fit = Math.floor((width - 24) / ((cellLen + 2) * CHAR_W));
  return Math.max(1, Math.min(nCols, fit >= nCols ? nCols : fit >= 2 ? 2 : 1));
}

export function MatlabBlock({
  matrices,
  onCell,
  isSelected,
  colTint,
  label,
}: {
  matrices: MatlabMatrix[];
  /** Makes cells clickable (keyboard: Tab + Enter). */
  onCell?: (name: string, row: number, col: number) => void;
  isSelected?: (name: string, row: number, col: number) => boolean;
  /** Optional background tint per column (e.g. mode colours once a column is identified). */
  colTint?: (name: string, col: number) => string | undefined;
  label?: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>(560);
  return (
    <div ref={ref} style={boxStyle} role="group" aria-label={label ?? 'MATLAB output'}>
      {matrices.map((m) => {
        const nCols = m.cells[0]?.length ?? 0;
        const cellLen = m.cells[0]?.[0]?.length ?? 17;
        const per = perChunk(width, cellLen, nCols);
        const chunks: number[][] = [];
        for (let c = 0; c < nCols; c += per) chunks.push(Array.from({ length: Math.min(per, nCols - c) }, (_, k) => c + k));
        return (
          <div key={m.name} style={{ marginBottom: 6 }}>
            <div style={preStyle}>{`${m.name} =`}</div>
            {chunks.map((cols) => (
              <div key={cols[0]} style={{ marginTop: 4 }}>
                {chunks.length > 1 && <div style={{ ...preStyle, color: 'var(--text-3)' }}>{`  Columns ${cols[0] + 1}${cols.length > 1 ? ` through ${cols[cols.length - 1] + 1}` : ''}`}</div>}
                {m.cells.map((row, i) => (
                  <div key={i} style={preStyle}>
                    {'  '}
                    {cols.map((j) => {
                      const text = row[j];
                      const sel = isSelected?.(m.name, i, j);
                      const tint = colTint?.(m.name, j);
                      const style: CSSProperties = {
                        ...(onCell ? cellBtn : {}),
                        // 'transparent' (not undefined) so a clickable cell never shows the browser's default button face.
                        background: sel ? 'var(--accent-soft)' : tint ?? 'transparent',
                        outline: sel ? '2px solid var(--accent)' : undefined,
                        borderRadius: 4,
                      };
                      return (
                        <span key={j}>
                          {onCell ? (
                            <button type="button" style={style} aria-pressed={!!sel} aria-label={`${m.name} row ${i + 1} column ${j + 1}: ${text.trim()}`} onClick={() => onCell(m.name, i, j)}>
                              {text}
                            </button>
                          ) : (
                            <span style={style}>{text}</span>
                          )}
                          {'  '}
                        </span>
                      );
                    })}
                  </div>
                ))}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

/** A static figure for a Solve instance: the MATLAB output block plus an optional command line above it. */
export function matlabFigure(matrices: MatlabMatrix[], command?: string): ComponentType {
  function MatlabOutput() {
    return (
      <div>
        {command && (
          <div style={{ ...preStyle, color: 'var(--text-2)', marginBottom: 4, whiteSpace: 'pre-wrap' }}>
            {`>> ${command}`}
          </div>
        )}
        <MatlabBlock matrices={matrices} label="MATLAB output" />
      </div>
    );
  }
  return MatlabOutput;
}
