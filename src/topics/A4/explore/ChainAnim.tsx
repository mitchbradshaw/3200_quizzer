// Animated two-mass chain ground–k1–m1–k2–m2 (horizontal like 2024 A1.2, or vertical like a machine with an
// absorber on top). Steady-state motion at the forcing frequency, slowed down for display. The parent passes
// pixel amplitudes (signed for undamped systems: negative = anti-phase with the force); all per-frame work
// is setAttribute on refs inside useRaf.
import { useRef } from 'react';
import { useRaf } from '../../../anim/hooks';
import { springPath } from '../../../ui/diagrams';

export interface ChainAnimProps {
  /** Amplitudes in px (signed: negative = moves opposite to the force). */
  a1: number;
  a2: number;
  /** Phase lag (rad) of each mass behind the force, for damped systems. */
  p1?: number;
  p2?: number;
  /** Which mass carries the harmonic force. */
  driven: 1 | 2;
  vertical?: boolean;
  /** Draw a rotating unbalance on m1 instead of a force arrow (a machine). */
  unbalance?: boolean;
  labels?: { m1?: string; m2?: string; k1?: string; k2?: string };
  /** Slowed-down display frequency (Hz). */
  displayHz?: number;
  ariaLabel: string;
  /** Freeze the motion (e.g. reduced-motion preference). */
  paused?: boolean;
  /** CSS max-width of the drawing (px). */
  maxWidth?: number;
}

interface Geo {
  vb: string;
  P: (s: number, o: number) => [number, number];
  s1: number;
  s2: number;
  L1: number;
  H1: number;
  L2: number;
  H2: number;
  forceOff: number;
  maxA: number;
}

const H_GEO: Geo = {
  vb: '0 0 520 128',
  P: (s, o) => [26 + s, 62 + o],
  s1: 170,
  s2: 352,
  L1: 64,
  H1: 50,
  L2: 64,
  H2: 50,
  forceOff: -44,
  maxA: 38,
};

const V_GEO: Geo = {
  vb: '0 0 230 320',
  P: (s, o) => [100 + o, 300 - s],
  s1: 112,
  s2: 238,
  L1: 54,
  H1: 118,
  L2: 40,
  H2: 74,
  forceOff: 84,
  maxA: 26,
};

const fx = (n: number) => n.toFixed(1);

export default function ChainAnim({ a1, a2, p1 = 0, p2 = 0, driven, vertical, unbalance, labels = {}, displayHz = 0.6, ariaLabel, paused, maxWidth }: ChainAnimProps) {
  const G = vertical ? V_GEO : H_GEO;
  const svgRef = useRef<SVGSVGElement>(null);
  const m1Ref = useRef<SVGGElement>(null);
  const m2Ref = useRef<SVGGElement>(null);
  const k1Ref = useRef<SVGPathElement>(null);
  const k2Ref = useRef<SVGPathElement>(null);
  const fRef = useRef<SVGPathElement>(null);
  const dotRef = useRef<SVGCircleElement>(null);
  const t = useRef(0);
  const clampA = (a: number) => Math.max(-G.maxA, Math.min(G.maxA, a));
  const A1 = clampA(a1);
  const A2 = clampA(a2);

  const draw = (phase: number) => {
    const d1 = A1 * Math.sin(phase - p1);
    const d2 = A2 * Math.sin(phase - p2);
    const tr = (d: number) => (vertical ? `translate(0 ${fx(-d)})` : `translate(${fx(d)} 0)`);
    m1Ref.current?.setAttribute('transform', tr(d1));
    m2Ref.current?.setAttribute('transform', tr(d2));
    const [ax, ay] = G.P(0, 0);
    const [bx, by] = G.P(G.s1 + d1 - G.L1 / 2, 0);
    const [cx, cy] = G.P(G.s1 + d1 + G.L1 / 2, 0);
    const [ex, ey] = G.P(G.s2 + d2 - G.L2 / 2, 0);
    k1Ref.current?.setAttribute('d', springPath(ax, ay, bx, by, vertical ? 6 : 7, 9));
    k2Ref.current?.setAttribute('d', springPath(cx, cy, ex, ey, 6, 9));
    // force: arrow along the chain axis beside the driven mass, length ∝ sin(phase)
    const sF = (driven === 1 ? G.s1 + d1 : G.s2 + d2);
    const len = 30 * Math.sin(phase);
    if (!unbalance) {
      const [x0, y0] = G.P(sF, G.forceOff);
      const [x1, y1] = G.P(sF + len, G.forceOff);
      const ux = Math.sign(len) * (vertical ? 0 : 1);
      const uy = Math.sign(len) * (vertical ? -1 : 0);
      const h = Math.min(7, Math.abs(len));
      const hx = x1 - ux * h;
      const hy = y1 - uy * h;
      const nx = -uy * h * 0.55;
      const ny = ux * h * 0.55;
      fRef.current?.setAttribute('d', `M${fx(x0)} ${fx(y0)}L${fx(x1)} ${fx(y1)}M${fx(hx + nx)} ${fx(hy + ny)}L${fx(x1)} ${fx(y1)}L${fx(hx - nx)} ${fx(hy - ny)}`);
    } else {
      // rotating unbalance on m1: dot at angle phase (vertical component ∝ sin(phase) = the applied force)
      const r = 13;
      dotRef.current?.setAttribute('cx', fx(r * Math.cos(phase)));
      dotRef.current?.setAttribute('cy', fx(-r * Math.sin(phase)));
    }
  };

  useRaf(
    (dt) => {
      if (!paused) t.current += dt;
      draw(2 * Math.PI * displayHz * t.current);
    },
    true,
    svgRef
  );

  const [g0x, g0y] = G.P(0, 0);
  const m1c = G.P(G.s1, 0);
  const m2c = G.P(G.s2, 0);
  const w1 = vertical ? G.H1 : G.L1;
  const h1 = vertical ? G.L1 : G.H1;
  const w2 = vertical ? G.H2 : G.L2;
  const h2 = vertical ? G.L2 : G.H2;
  const k1Lab = G.P(G.s1 / 2 - 12, vertical ? -30 : -22);
  const k2Lab = G.P((G.s1 + G.s2) / 2, vertical ? -30 : -22);
  const fLab = G.P(driven === 1 ? G.s1 : G.s2, G.forceOff + (vertical ? 12 : -8));

  return (
    <svg ref={svgRef} viewBox={G.vb} className="anim" role="img" aria-label={ariaLabel} style={{ maxWidth: maxWidth ?? (vertical ? 230 : 560), margin: '0 auto' }}>
      {/* ground / wall */}
      {vertical ? (
        <g stroke="var(--text-3)" strokeWidth={1.2}>
          <line x1={g0x - 70} y1={g0y} x2={g0x + 70} y2={g0y} strokeWidth={2} />
          {Array.from({ length: 13 }, (_, i) => (
            <line key={i} x1={g0x - 66 + i * 11} y1={g0y} x2={g0x - 72 + i * 11} y2={g0y + 8} />
          ))}
        </g>
      ) : (
        <g stroke="var(--text-3)" strokeWidth={1.2}>
          <line x1={g0x} y1={g0y - 40} x2={g0x} y2={g0y + 40} strokeWidth={2} />
          {Array.from({ length: 10 }, (_, i) => (
            <line key={i} x1={g0x} y1={g0y - 38 + i * 8.5} x2={g0x - 8} y2={g0y - 32 + i * 8.5} />
          ))}
          <line x1={g0x} y1={g0y + 36} x2={500} y2={g0y + 36} strokeWidth={1.5} />
        </g>
      )}
      {/* rest positions */}
      {vertical ? (
        <>
          <line x1={m1c[0] - w1 / 2 - 14} x2={m1c[0] - w1 / 2 - 4} y1={m1c[1]} y2={m1c[1]} stroke="var(--text-3)" />
          <line x1={m2c[0] - w2 / 2 - 14} x2={m2c[0] - w2 / 2 - 4} y1={m2c[1]} y2={m2c[1]} stroke="var(--text-3)" />
        </>
      ) : (
        <>
          <line x1={m1c[0]} x2={m1c[0]} y1={m1c[1] + 40} y2={m1c[1] + 52} stroke="var(--text-3)" />
          <line x1={m2c[0]} x2={m2c[0]} y1={m2c[1] + 40} y2={m2c[1] + 52} stroke="var(--text-3)" />
        </>
      )}
      <path ref={k1Ref} fill="none" stroke="var(--text-2)" strokeWidth={1.8} strokeLinejoin="round" />
      <path ref={k2Ref} fill="none" stroke="var(--text-2)" strokeWidth={1.8} strokeLinejoin="round" />
      <text x={k1Lab[0]} y={k1Lab[1]} className={vertical ? 'diagram-label' : 'plot-note'} textAnchor="middle" style={vertical ? undefined : { fontSize: 15 }}>
        {labels.k1 ?? 'k₁'}
      </text>
      <text x={k2Lab[0]} y={k2Lab[1]} className={vertical ? 'diagram-label' : 'plot-note'} textAnchor="middle" style={vertical ? undefined : { fontSize: 15 }}>
        {labels.k2 ?? 'k₂'}
      </text>
      <g ref={m1Ref}>
        <rect x={m1c[0] - w1 / 2} y={m1c[1] - h1 / 2} width={w1} height={h1} rx={5} fill="var(--surface-2)" stroke="var(--text-2)" strokeWidth={2} />
        {!vertical && (
          <>
            <circle cx={m1c[0] - 18} cy={m1c[1] + 30} r={5} fill="none" stroke="var(--text-3)" />
            <circle cx={m1c[0] + 18} cy={m1c[1] + 30} r={5} fill="none" stroke="var(--text-3)" />
          </>
        )}
        {unbalance ? (
          <g transform={`translate(${m1c[0] + w1 / 2 - 24} ${m1c[1]})`}>
            <circle r={15} fill="none" stroke="var(--text-3)" />
            <circle ref={dotRef} cx={13} cy={0} r={4.5} fill="var(--accent)" />
            <circle r={2} fill="var(--text-3)" />
          </g>
        ) : null}
        <text x={unbalance ? m1c[0] - 18 : m1c[0]} y={m1c[1] + 5} textAnchor="middle" className="diagram-label" style={vertical ? undefined : { fontSize: 17 }}>
          {labels.m1 ?? 'm₁'}
        </text>
      </g>
      <g ref={m2Ref}>
        <rect x={m2c[0] - w2 / 2} y={m2c[1] - h2 / 2} width={w2} height={h2} rx={5} fill="var(--surface-2)" stroke="var(--text-2)" strokeWidth={2} />
        {!vertical && (
          <>
            <circle cx={m2c[0] - 18} cy={m2c[1] + 30} r={5} fill="none" stroke="var(--text-3)" />
            <circle cx={m2c[0] + 18} cy={m2c[1] + 30} r={5} fill="none" stroke="var(--text-3)" />
          </>
        )}
        <text x={m2c[0]} y={m2c[1] + 5} textAnchor="middle" className="diagram-label" style={vertical ? undefined : { fontSize: 17 }}>
          {labels.m2 ?? 'm₂'}
        </text>
      </g>
      {!unbalance && (
        <>
          <path ref={fRef} fill="none" stroke="var(--accent)" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
          <text x={fLab[0]} y={fLab[1]} className="plot-note" textAnchor="middle" fill="var(--accent)" style={{ fontSize: 14 }}>
            F₀ sin Ωt
          </text>
        </>
      )}
    </svg>
  );
}
