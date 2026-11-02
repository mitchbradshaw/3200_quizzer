// Plot label in data coordinates with a halo in the surface colour, so it stays legible where it crosses
// curves or grid lines (both themes). Use inside <Plot>.
import type { ReactNode } from 'react';
import { usePlot } from '../../../plot/Plot';

export default function HaloText({
  x,
  y,
  children,
  anchor = 'start',
  color = 'var(--text-2)',
  dx = 0,
  dy = 0,
  size,
}: {
  x: number;
  y: number;
  children: ReactNode;
  anchor?: 'start' | 'middle' | 'end';
  color?: string;
  dx?: number;
  dy?: number;
  size?: number;
}) {
  const { sx, sy } = usePlot();
  const px = sx(x);
  const py = sy(y);
  if (!Number.isFinite(px) || !Number.isFinite(py)) return null;
  return (
    <text
      className="plot-note"
      x={px + dx}
      y={py + dy}
      textAnchor={anchor}
      fill={color}
      pointerEvents="none"
      style={{ paintOrder: 'stroke', stroke: 'var(--surface)', strokeWidth: 3.5, strokeLinejoin: 'round', fontSize: size }}
    >
      {children}
    </text>
  );
}
