// Live matrix display (HTML table, cheap to re-render) with non-zero coupling terms highlighted.
import { TeX } from '../../../ui/Rich';
import { fmtSig } from '../../../engine/format';

export function MatrixView({
  A,
  labels,
  name,
  scale = 1,
  sig = 4,
  unit,
  tol = 1e-6,
}: {
  A: number[][];
  /** Coordinate labels as TeX, e.g. ['x', 'y', '\\theta']. */
  labels: string[];
  /** Matrix name as TeX, e.g. 'K'. */
  name: string;
  /** Entries are divided by this before display (e.g. 1e6 for MN). */
  scale?: number;
  sig?: number;
  unit?: string;
  /** Relative size (vs the largest diagonal entry) below which an entry counts as zero. */
  tol?: number;
}) {
  let big = 0;
  for (let i = 0; i < A.length; i++) big = Math.max(big, Math.abs(A[i][i]));
  const isZero = (x: number) => Math.abs(x) <= tol * (big || 1);
  const cell = { padding: '3px 7px', textAlign: 'right' as const, minWidth: 54, borderRadius: 5, fontVariantNumeric: 'tabular-nums' as const };
  return (
    <figure style={{ margin: '4px 0' }} aria-label={`Matrix ${name}`}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <TeX>{`${name} =`}</TeX>
        <table style={{ borderCollapse: 'separate', borderSpacing: 2, borderLeft: '2px solid var(--text-2)', borderRight: '2px solid var(--text-2)', borderRadius: 6, padding: '0 3px', fontSize: '0.88rem' }}>
          <thead>
            <tr>
              <th />
              {labels.map((l) => (
                <th key={l} style={{ fontWeight: 400, color: 'var(--text-3)', padding: '0 4px' }}>
                  <TeX>{l}</TeX>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {A.map((row, i) => (
              <tr key={i}>
                <th style={{ fontWeight: 400, color: 'var(--text-3)', paddingRight: 4 }}>
                  <TeX>{labels[i]}</TeX>
                </th>
                {row.map((x, j) => {
                  const off = i !== j;
                  const z = isZero(x);
                  const hot = off && !z;
                  return (
                    <td
                      key={j}
                      title={hot ? `coupling term ${name}(${i + 1},${j + 1}) ≠ 0` : undefined}
                      style={{
                        ...cell,
                        color: hot ? 'var(--warn)' : z ? 'var(--text-3)' : 'var(--text)',
                        background: hot ? 'var(--warn-soft)' : undefined,
                        fontWeight: hot ? 650 : 400,
                        outline: hot ? '1px solid var(--warn)' : undefined,
                      }}
                    >
                      {z ? '0' : fmtSig(x / scale, sig)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {unit && <figcaption className="muted small">{unit}</figcaption>}
    </figure>
  );
}
