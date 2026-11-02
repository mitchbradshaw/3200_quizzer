// A matrix with TeX entries drawn as an HTML grid between brackets, so each entry can carry its own
// right/wrong mark (colour plus a ✓/✗ glyph). Used by the A2 explore activities.
import type { CSSProperties } from 'react';
import { TeX } from '../../../ui/Rich';

const LINE = '1.5px solid var(--text-2)';
const bracket = (side: 'l' | 'r'): CSSProperties => ({
  width: 6,
  flex: 'none',
  borderTop: LINE,
  borderBottom: LINE,
  borderLeft: side === 'l' ? LINE : 'none',
  borderRight: side === 'r' ? LINE : 'none',
  borderRadius: side === 'l' ? '3px 0 0 3px' : '0 3px 3px 0',
});

export function SymMatrix({ name, entries, status, unit, compact }: { name: string; entries: string[][]; status?: (boolean | null)[][]; unit?: string; compact?: boolean }) {
  const n = entries[0]?.length ?? 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, maxWidth: '100%', overflowX: 'auto', padding: '2px 0' }}>
      <span style={{ flex: 'none' }}>
        <TeX>{`${name} =`}</TeX>
      </span>
      <div style={{ display: 'flex', alignItems: 'stretch', flex: 'none' }}>
        <span style={bracket('l')} aria-hidden="true" />
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${n}, auto)`, gap: compact ? '2px 6px' : '3px 10px', padding: '3px 4px' }}>
          {entries.flatMap((row, i) =>
            row.map((e, j) => {
              const st = status?.[i]?.[j];
              return (
                <div
                  key={`${i}-${j}`}
                  style={{
                    textAlign: 'center',
                    padding: '2px 5px',
                    borderRadius: 5,
                    whiteSpace: 'nowrap',
                    background: st === true ? 'color-mix(in srgb, var(--ok) 13%, transparent)' : st === false ? 'color-mix(in srgb, var(--bad) 13%, transparent)' : undefined,
                  }}
                >
                  <TeX>{e}</TeX>
                  {st != null && (
                    <span aria-label={st ? 'matches' : 'does not match'} style={{ marginLeft: 4, fontSize: '0.75rem', color: st ? 'var(--ok)' : 'var(--bad)' }}>
                      {st ? '✓' : '✗'}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
        <span style={bracket('r')} aria-hidden="true" />
      </div>
      {unit && <span className="muted small" style={{ flex: 'none' }}>{unit}</span>}
    </div>
  );
}
