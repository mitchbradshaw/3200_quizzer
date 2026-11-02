// Static figures for the A5 Solve generators (symbolic labels; the numbers are in the givens table).
// Theme-aware (CSS variables only) and scalable (viewBox + width 100 %).
import type { ComponentType, ReactNode } from 'react';
import { Arrow, Figure, Ground, Spring } from '../../ui/diagrams';

const BODY = 'var(--surface-2)';
const EDGE = 'var(--text-2)';
/** Math-italic serif for symbols in SVG (matches the TeX in the prompt: l is not mistaken for a tick). */
const MATH = { fontStyle: 'italic', fontFamily: "KaTeX_Math, 'Times New Roman', serif", fontSize: '13px' } as const;

/** A symbol typeset like the prompt's TeX (italic serif), with an optional plain suffix. */
function M({ s, after }: { s: string; after?: string }) {
  return (
    <>
      <tspan style={MATH}>{s}</tspan>
      {after && <tspan>{after}</tspan>}
    </>
  );
}

/** Centre of mass G. Its label sits lower-left so it never collides with the θ arrow of <Axes>. */
function G({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={5} fill="var(--surface)" stroke="var(--text)" strokeWidth={1.6} />
      <path d={`M${x - 5} ${y}H${x + 5}M${x} ${y - 5}V${y + 5}`} stroke="var(--text)" strokeWidth={1.2} />
      <text x={x - 7} y={y + 16} className="diagram-label" textAnchor="end">
        G
      </text>
    </g>
  );
}

/** Plain SVG label with an optional subscript (KaTeX is not available inside SVG). */
function Lab({ x, y, b, s, anchor }: { x: number; y: number; b: string; s?: string; anchor?: 'start' | 'middle' | 'end' }) {
  return (
    <text x={x} y={y} className="plot-note" textAnchor={anchor}>
      {b}
      {s && (
        <tspan dy={3} fontSize="0.8em">
          {s}
        </tspan>
      )}
    </text>
  );
}

/** Coordinate arrows at G: x right, y up, theta anticlockwise. */
function Axes({ x, y, len = 34, xl = 'x', yl = 'y' }: { x: number; y: number; len?: number; xl?: string; yl?: string }) {
  return (
    <g>
      <Arrow x1={x} y1={y} x2={x + len} y2={y} color="var(--text-3)" width={1.3} head={6} />
      <Arrow x1={x} y1={y} x2={x} y2={y - len} color="var(--text-3)" width={1.3} head={6} />
      <text x={x + len + 3} y={y + 4} className="plot-note">
        {xl}
      </text>
      <text x={x - 4} y={y - len - 4} className="plot-note" textAnchor="end">
        {yl}
      </text>
      <path d={`M${x + 16} ${y - 7} A 17 17 0 0 0 ${x + 7} ${y - 16}`} fill="none" stroke="var(--text-3)" strokeWidth={1.3} />
      <path d={`M${x + 7} ${y - 16} l 1 6 M${x + 7} ${y - 16} l 6 1`} fill="none" stroke="var(--text-3)" strokeWidth={1.3} />
      <text x={x + 19} y={y - 15} className="plot-note">
        θ
      </text>
    </g>
  );
}

/** Dimension line with end ticks and a label (a plain string label is typeset as a math symbol). */
function Dim({ x1, y1, x2, y2, label, dx = 0, dy = 0 }: { x1: number; y1: number; x2: number; y2: number; label: ReactNode; dx?: number; dy?: number }) {
  const vertical = Math.abs(x2 - x1) < 1;
  const tick = vertical ? `M${x1 - 4} ${y1}H${x1 + 4}M${x2 - 4} ${y2}H${x2 + 4}` : `M${x1} ${y1 - 4}V${y1 + 4}M${x2} ${y2 - 4}V${y2 + 4}`;
  return (
    <g stroke="var(--text-3)" strokeWidth={1}>
      <line x1={x1} y1={y1} x2={x2} y2={y2} strokeDasharray="3 3" />
      <path d={tick} />
      <text x={(x1 + x2) / 2 + dx} y={(y1 + y2) / 2 + dy} className="plot-note" textAnchor="middle" stroke="none" fill="var(--text)">
        {typeof label === 'string' ? <M s={label} /> : label}
      </text>
    </g>
  );
}

function Post({ x, y, side }: { x: number; y: number; side: 'left' | 'right' }) {
  return <Ground x={x} y={y} w={22} vertical side={side} />;
}

/** Official 2017 A2: machine on isolators, springs a below G, left end b and right end c from G. */
export const MachineFig: ComponentType = () => (
  <Figure width={360} height={210} label="Machine on two isolator mounts below its centre of mass">
    <rect x={60} y={36} width={240} height={84} rx={4} fill={BODY} stroke={EDGE} strokeWidth={1.8} />
    <G x={170} y={72} />
    <Axes x={170} y={72} />
    {[100, 280].map((x) => (
      <g key={x}>
        <Spring x1={x} y1={120} x2={x} y2={172} coils={5} amp={7} />
        <Ground x={x} y={172} w={40} />
      </g>
    ))}
    <Spring x1={100} y1={126} x2={50} y2={126} coils={4} amp={5} />
    <Post x={50} y={126} side="left" />
    <Spring x1={280} y1={126} x2={330} y2={126} coils={4} amp={5} />
    <Post x={330} y={126} side="right" />
    <Lab x={108} y={160} b="k" s="y" />
    <Lab x={288} y={160} b="k" s="y" />
    <Lab x={64} y={142} b="k" s="x" />
    <Lab x={300} y={142} b="k" s="x" />
    <Dim x1={150} y1={72} x2={150} y2={120} label="a" dx={-8} dy={4} />
    <Dim x1={100} y1={195} x2={170} y2={195} label="b" dy={-4} />
    <Dim x1={170} y1={195} x2={280} y2={195} label="c" dy={-4} />
  </Figure>
);

/** 2024 A2: box 2a x 2c (front view), rubber springs at the mid-points of the bottom edges. */
export const BoxFig: ComponentType = () => (
  <Figure width={360} height={230} label="Front view of the box on rubber springs at the mid-points of its bottom edges">
    <rect x={70} y={30} width={220} height={130} rx={3} fill={BODY} stroke={EDGE} strokeWidth={1.8} />
    <G x={180} y={95} />
    <Axes x={180} y={95} />
    {[70, 180, 290].map((x) => (
      <g key={x}>
        <rect x={x - 7} y={160} width={14} height={8} fill="var(--surface-3)" stroke={EDGE} />
        <Spring x1={x} y1={168} x2={x} y2={196} coils={4} amp={6} />
        <Ground x={x} y={196} w={36} />
      </g>
    ))}
    <text x={192} y={186} className="plot-note">
      front + back
    </text>
    <text x={20} y={186} className="plot-note">
      left
    </text>
    <text x={300} y={186} className="plot-note">
      right
    </text>
    <Dim x1={70} y1={18} x2={290} y2={18} label={<>2<M s="a" /></>} dy={-3} />
    <Dim x1={315} y1={95} x2={315} y2={160} label="c" dx={10} dy={4} />
    <Dim x1={335} y1={30} x2={335} y2={160} label={<>2<M s="c" /></>} dx={12} dy={4} />
    <text x={20} y={224} className="plot-note">
      each spring: vertical k<tspan dy={3} fontSize="0.8em">y</tspan>
      <tspan dy={-3}>, shear k</tspan>
      <tspan dy={3} fontSize="0.8em">x</tspan>
      <tspan dy={-3}> (box depth 2b into the page)</tspan>
    </text>
  </Figure>
);

/** 2022 A1.4: cabinet on a wall to its right; upper anchor (k_x) a above G, lower anchor (k_x, k_y) b below G, wall at c. */
export const CabinetFig: ComponentType = () => (
  <Figure width={360} height={230} label="Cabinet hung on a vertical wall by two anchors">
    <line x1={300} y1={14} x2={300} y2={222} stroke="var(--text-3)" strokeWidth={2} />
    <Ground x={300} y={118} w={200} vertical side="right" />
    <rect x={130} y={24} width={150} height={170} rx={3} fill={BODY} stroke={EDGE} strokeWidth={1.8} />
    <G x={205} y={104} />
    <Axes x={205} y={104} len={30} />
    <Spring x1={280} y1={60} x2={300} y2={60} coils={3} amp={5} />
    <Spring x1={280} y1={186} x2={300} y2={186} coils={3} amp={5} />
    <Spring x1={268} y1={194} x2={268} y2={214} coils={3} amp={5} />
    <path d="M258 214H300" stroke={EDGE} strokeWidth={2.2} />
    <Lab x={246} y={56} b="k" s="x" />
    <Lab x={246} y={182} b="k" s="x" />
    <Lab x={232} y={214} b="k" s="y" />
    <Dim x1={150} y1={60} x2={150} y2={104} label="a" dx={-8} dy={4} />
    <Dim x1={150} y1={104} x2={150} y2={186} label="b" dx={-8} dy={4} />
    <Dim x1={205} y1={130} x2={280} y2={130} label="c" dy={-4} />
    <text x={20} y={20} className="plot-note">
      wall on the right
    </text>
  </Figure>
);

/** 2025 A2: range hood, top view; wall on the left, mounts at (−d, +s), (−d, 0), (−d, −s); fan at G. */
export const RangehoodFig: ComponentType = () => (
  <Figure width={360} height={230} label="Top view of a range hood on three wall mounts">
    <line x1={40} y1={14} x2={40} y2={216} stroke="var(--text-3)" strokeWidth={2} />
    <Ground x={40} y={115} w={200} vertical side="left" />
    <rect x={90} y={30} width={170} height={170} rx={3} fill={BODY} stroke={EDGE} strokeWidth={1.8} />
    {[45, 115, 185].map((y) => (
      <g key={y}>
        <Spring x1={40} y1={y} x2={90} y2={y} coils={4} amp={5} />
        <circle cx={90} cy={y} r={3.5} fill={EDGE} />
      </g>
    ))}
    <circle cx={175} cy={115} r={30} fill="none" stroke="var(--text-3)" strokeDasharray="4 3" />
    <circle cx={175 + 21} cy={115 + 21} r={4} fill="var(--text-2)" />
    <G x={175} y={115} />
    <Axes x={175} y={115} len={30} />
    <Dim x1={90} y1={150} x2={175} y2={150} label="d" dy={-4} />
    <Dim x1={280} y1={45} x2={280} y2={115} label="s" dx={9} dy={4} />
    <Dim x1={300} y1={30} x2={300} y2={200} label={<>2<M s="s" /></>} dx={13} dy={4} />
    <text x={46} y={225} className="plot-note">
      each mount: axial k<tspan dy={3} fontSize="0.8em">x</tspan>
      <tspan dy={-3}> along x, transverse k</tspan>
      <tspan dy={3} fontSize="0.8em">y</tspan>
      <tspan dy={-3}> along y</tspan>
    </text>
  </Figure>
);

/** Bounce–pitch: body with spring k1 at −a (front, left) and k2 at +b (rear, right); the cabin has both at distance l. */
export function bouncePitchFig(kind: 'car' | 'cabin'): ComponentType {
  const car = kind === 'car';
  const gx = car ? 150 : 175; // G: nearer the front for the car, midway for the cabin
  return function BouncePitchFig() {
    return (
      <Figure width={360} height={200} label={car ? 'Side view of a vehicle body on front and rear springs' : 'Cabin on two isolators at equal distances from G, on a deck'}>
        <rect x={40} y={50} width={280} height={56} rx={car ? 14 : 3} fill={BODY} stroke={EDGE} strokeWidth={1.8} />
        <G x={gx} y={78} />
        <Axes x={gx} y={78} len={28} xl={car ? 'x (rear)' : 'x'} yl="z" />
        {[85, 265].map((x) => (
          <g key={x}>
            <Spring x1={x} y1={106} x2={x} y2={146} coils={4} amp={6} />
            {car ? <circle cx={x} cy={156} r={10} fill="var(--surface)" stroke={EDGE} strokeWidth={1.6} /> : null}
          </g>
        ))}
        <Ground x={180} y={car ? 166 : 146} w={300} />
        <Lab x={93} y={132} b="k" s="1" />
        <Lab x={273} y={132} b="k" s="2" />
        <Dim x1={85} y1={30} x2={gx} y2={30} label={car ? <M s="a" after=" (front)" /> : 'l'} dy={-4} />
        <Dim x1={gx} y1={30} x2={265} y2={30} label={car ? <M s="b" after=" (rear)" /> : 'l'} dy={-4} />
        {!car && (
          <text x={40} y={172} className="plot-note">
            deck (may heave with <tspan style={MATH}>y</tspan>
            <tspan dy={3} fontSize="0.8em">
              b
            </tspan>
            <tspan dy={-3}>)</tspan>
          </text>
        )}
      </Figure>
    );
  };
}

/** Inclined mounts below G at (±l, −h), axes tilted phi from the vertical with their tops leaning inwards (both, or the right one only). */
function vMountFig(bothTilted: boolean): ComponentType {
  return function VMountFigure() {
    return (
      <Figure width={360} height={210} label={bothTilted ? 'Machine on two inclined mounts' : 'Machine on an upright left mount and an inclined right mount'}>
        <rect x={70} y={30} width={220} height={80} rx={3} fill={BODY} stroke={EDGE} strokeWidth={1.8} />
        <G x={180} y={66} />
        <Axes x={180} y={66} len={28} />
        <Spring x1={110} y1={110} x2={bothTilted ? 84 : 110} y2={178} coils={4} amp={6} />
        <Spring x1={250} y1={110} x2={276} y2={178} coils={4} amp={6} />
        <Ground x={bothTilted ? 84 : 110} y={178} w={34} />
        <Ground x={276} y={178} w={34} />
        {bothTilted && (
          <>
            <path d="M110 110V160" stroke="var(--text-3)" strokeDasharray="3 3" />
            <path d="M110 145 A 35 35 0 0 1 97 142" fill="none" stroke="var(--text-3)" />
            <text x={84} y={140} className="plot-note">
              φ
            </text>
          </>
        )}
        <path d="M250 110V160" stroke="var(--text-3)" strokeDasharray="3 3" />
        <path d="M250 145 A 35 35 0 0 0 263 142" fill="none" stroke="var(--text-3)" />
        <text x={268} y={140} className="plot-note">
          φ
        </text>
        <Dim x1={160} y1={66} x2={160} y2={110} label="h" dx={-8} dy={4} />
        <Dim x1={110} y1={198} x2={180} y2={198} label="l" dy={-4} />
        <Dim x1={180} y1={198} x2={250} y2={198} label="l" dy={-4} />
        <text x={292} y={118} className="plot-note">
          k₁ along axis
        </text>
        <text x={292} y={132} className="plot-note">
          k₂ across it
        </text>
      </Figure>
    );
  };
}
export const VMountFig: ComponentType = vMountFig(true);
/** Coupling tier 3: the left mount is upright, only the right one is tilted. */
export const VMountOneFig: ComponentType = vMountFig(false);

/** A block (w x h) with numbered mounts at given positions from G (G at the block centre). */
export function mountsFigure(w: number, h: number, mounts: { x: number; y: number; ky: number }[]): ComponentType {
  return function MountsFig() {
    const s = Math.min(240 / w, 130 / h);
    const cx = 180;
    const cy = 100;
    const X = (x: number) => cx + x * s;
    const Y = (y: number) => cy - y * s;
    return (
      <Figure width={360} height={210} label="Block with numbered mounts">
        <rect x={X(-w / 2)} y={Y(h / 2)} width={w * s} height={h * s} rx={3} fill={BODY} stroke={EDGE} strokeWidth={1.8} />
        <G x={cx} y={cy} />
        <Axes x={cx} y={cy} len={26} />
        {mounts.map((m, i) => (
          <g key={i}>
            <circle cx={X(m.x)} cy={Y(m.y)} r={9} fill="var(--surface)" stroke="var(--accent)" strokeWidth={2} />
            <text x={X(m.x)} y={Y(m.y) + 4} textAnchor="middle" className="plot-note">
              {i + 1}
            </text>
          </g>
        ))}
        <text x={14} y={204} className="plot-note">
          positions in the table are measured from G
        </text>
      </Figure>
    );
  };
}
