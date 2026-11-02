// Legend whose line samples match the plot exactly (solid, dashed or dotted), so curves of the same
// colour family can be told apart. Uses the shared .legend styles.
import type { ReactNode } from 'react';

export function LineKey({ items }: { items: { label: ReactNode; color: string; dash?: string; width?: number }[] }) {
  return (
    <div className="legend">
      {items.map((it, i) => (
        <span key={i} className="legend-item">
          <svg width="26" height="10" aria-hidden="true">
            <line x1="1" y1="5" x2="25" y2="5" stroke={it.color} strokeWidth={it.width ?? 2} strokeDasharray={it.dash} />
          </svg>
          {it.label}
        </span>
      ))}
    </div>
  );
}
