// Physical picture of a string (transverse), rod (axial) or shaft (torsion), redrawn every frame through refs.
// The parent's useRaf calls api.draw(u), where u(xi) in [-1, 1] is the displacement shape at this instant.
import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import type { Member } from '../physics';
import { Ground } from '../../../ui/diagrams';

export interface MemberApi {
  draw(u: (xi: number) => number): void;
}

export type EndKind = 'fixed' | 'free' | 'disc';

interface Props {
  member: Member;
  left: EndKind;
  right: EndKind;
  /** Stroke colour of the moving parts (a mode colour). */
  color: string;
  /** Node positions (xi) to mark. */
  nodes?: number[];
  height?: number;
  label: string;
  /** Small caption under the drawing. */
  caption?: string;
}

const W = 600;
const X0 = 54;
const X1 = 546;
const X = (xi: number) => X0 + (X1 - X0) * xi;
const N_STRING = 96;
const N_ROD = 25;
const N_DISC = 11;

export const MemberView = forwardRef<MemberApi, Props>(function MemberView({ member, left, right, color, nodes = [], height, label, caption }, ref) {
  const H = height ?? (member === 'rod' ? 104 : 124);
  const y0 = member === 'rod' ? 44 : H / 2 - 6;
  const amp = member === 'string' ? 0.3 * H : 0;
  const pathRef = useRef<SVGPathElement>(null);
  const ringL = useRef<SVGCircleElement>(null);
  const ringR = useRef<SVGCircleElement>(null);
  const barRef = useRef<SVGPathElement>(null);
  const markRefs = useRef<(SVGLineElement | null)[]>([]);
  const spokeRefs = useRef<(SVGLineElement | null)[]>([]);
  const discXs = useMemo(() => Array.from({ length: N_DISC }, (_, k) => k / (N_DISC - 1)), []);
  const rodXs = useMemo(() => Array.from({ length: N_ROD }, (_, k) => k / (N_ROD - 1)), []);
  const discR = (k: number) => (k === N_DISC - 1 && right === 'disc' ? 30 : 15);

  useImperativeHandle(
    ref,
    () => ({
      draw(u) {
        if (member === 'string') {
          let d = '';
          for (let i = 0; i <= N_STRING; i++) {
            const xi = i / N_STRING;
            d += `${i ? 'L' : 'M'}${X(xi).toFixed(1)} ${(y0 - amp * u(xi)).toFixed(1)}`;
          }
          pathRef.current?.setAttribute('d', d);
          ringL.current?.setAttribute('cy', (y0 - amp * u(0)).toFixed(1));
          ringR.current?.setAttribute('cy', (y0 - amp * u(1)).toFixed(1));
        } else if (member === 'rod') {
          const s = 18; // px of axial displacement at |u| = 1 (exaggerated)
          rodXs.forEach((xi, k) => {
            const x = X(xi) + s * u(xi);
            const el = markRefs.current[k];
            if (el) {
              el.setAttribute('x1', x.toFixed(1));
              el.setAttribute('x2', x.toFixed(1));
            }
          });
          const xl = X(0) + s * u(0);
          const xr = X(1) + s * u(1);
          barRef.current?.setAttribute('d', `M${xl.toFixed(1)} ${y0 - 15}H${xr.toFixed(1)}V${y0 + 15}H${xl.toFixed(1)}Z`);
        } else {
          const gain = 1.05; // rad of twist at |u| = 1 (exaggerated)
          discXs.forEach((xi, k) => {
            const r = discR(k) - 2;
            const phi = gain * u(xi);
            const el = spokeRefs.current[k];
            if (el) {
              el.setAttribute('x2', (X(xi) + r * Math.sin(phi)).toFixed(1));
              el.setAttribute('y2', (y0 - r * Math.cos(phi)).toFixed(1));
            }
          });
        }
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [member, y0, amp, right, rodXs, discXs]
  );

  const tri = (x: number, y: number) => `M${x} ${y}l-6 9h12z`;
  const nodeY = member === 'string' ? y0 : member === 'rod' ? y0 + 19 : y0 + 34;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="anim" role="img" aria-label={label}>
      {/* ends */}
      {left === 'fixed' && <Ground x={X0 - (member === 'shaft' ? 18 : 0)} y={y0} w={member === 'rod' ? 52 : 78} vertical side="left" />}
      {right === 'fixed' && <Ground x={X1 + (member === 'shaft' ? 18 : 0)} y={y0} w={member === 'rod' ? 52 : 78} vertical side="right" />}
      {member === 'string' && (
        <>
          <line x1={X0} x2={X1} y1={y0} y2={y0} stroke="var(--border)" strokeDasharray="3 5" />
          {left === 'free' && (
            <>
              <line x1={X0} x2={X0} y1={y0 - amp - 10} y2={y0 + amp + 10} stroke="var(--text-3)" strokeWidth={2} />
              <circle ref={ringL} cx={X0} cy={y0} r={6} fill="none" stroke="var(--text-2)" strokeWidth={2} />
            </>
          )}
          {right === 'free' && (
            <>
              <line x1={X1} x2={X1} y1={y0 - amp - 10} y2={y0 + amp + 10} stroke="var(--text-3)" strokeWidth={2} />
              <circle ref={ringR} cx={X1} cy={y0} r={6} fill="none" stroke="var(--text-2)" strokeWidth={2} />
            </>
          )}
          <path ref={pathRef} fill="none" stroke={color} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
          {nodes.map((xi) => (
            <circle key={xi} cx={X(xi)} cy={y0} r={4.5} fill="var(--surface)" stroke={color} strokeWidth={2} />
          ))}
        </>
      )}
      {member === 'rod' && (
        <>
          <path ref={barRef} d={`M${X0} ${y0 - 15}H${X1}V${y0 + 15}H${X0}Z`} fill="var(--surface-2)" stroke="var(--text-2)" strokeWidth={1.6} />
          {rodXs.map((xi, k) => (
            <line
              key={k}
              ref={(el) => {
                markRefs.current[k] = el;
              }}
              x1={X(xi)}
              x2={X(xi)}
              y1={y0 - 12}
              y2={y0 + 12}
              stroke={color}
              strokeWidth={2.2}
            />
          ))}
          {nodes.map((xi) => (
            <path key={xi} d={tri(X(xi), nodeY)} fill={color} />
          ))}
        </>
      )}
      {member === 'shaft' && (
        <>
          <rect x={X0} y={y0 - 5} width={X1 - X0} height={10} rx={3} fill="var(--surface-3)" stroke="var(--text-3)" />
          {discXs.map((xi, k) => (
            <g key={k}>
              <circle cx={X(xi)} cy={y0} r={discR(k)} fill="var(--surface)" stroke={k === N_DISC - 1 && right === 'disc' ? 'var(--m2)' : 'var(--text-2)'} strokeWidth={k === N_DISC - 1 && right === 'disc' ? 2.4 : 1.4} />
              <line
                ref={(el) => {
                  spokeRefs.current[k] = el;
                }}
                x1={X(xi)}
                y1={y0}
                x2={X(xi)}
                y2={y0 - discR(k) + 2}
                stroke={color}
                strokeWidth={2.6}
                strokeLinecap="round"
              />
            </g>
          ))}
          {right === 'disc' && (
            <text x={X(1)} y={y0 - discR(N_DISC - 1) - 6} textAnchor="middle" className="plot-note">
              disc Iₑ
            </text>
          )}
          {nodes.map((xi) => (
            <path key={xi} d={tri(X(xi), nodeY)} fill={color} />
          ))}
        </>
      )}
      {nodes.length > 0 && member !== 'string' && (
        <text x={X0} y={H - 4} className="plot-note">
          ▲ node
        </text>
      )}
      {caption && (
        <text x={X1} y={H - 4} textAnchor="end" className="plot-note">
          {caption}
        </text>
      )}
    </svg>
  );
});
