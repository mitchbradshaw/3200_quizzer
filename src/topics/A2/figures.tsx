// Static coordinate diagrams for the A2 systems (Solve figures and the Energy builder).
// Plain SVG with viewBox + width 100%, theme colours only. Positive directions follow the papers:
// every rotation arrow is drawn in the positive sense the problem text states (θ anticlockwise
// unless said otherwise; an arc running from `from` to `to` with to > from is anticlockwise).
import type { ReactNode } from 'react';
import { Arrow, Ground, Spring } from '../../ui/diagrams';

/** A lowered, smaller subscript inside SVG <text> (e.g. I{sub('T')}), so labels never show raw underscores. */
const sub = (s: string) => (
  <tspan baselineShift="sub" fontSize="75%">
    {s}
  </tspan>
);

/** Arc with an arrowhead. Angles in degrees, maths convention (anticlockwise positive, y up). */
export function ArcArrow({ cx, cy, r, from, to, label, color = 'var(--text-2)', labelR }: { cx: number; cy: number; r: number; from: number; to: number; label?: ReactNode; color?: string; labelR?: number }) {
  const rad = (d: number) => (d * Math.PI) / 180;
  const pt = (d: number) => [cx + r * Math.cos(rad(d)), cy - r * Math.sin(rad(d))] as const;
  const [x0, y0] = pt(from);
  const [x1, y1] = pt(to);
  const ccw = to > from;
  const large = Math.abs(to - from) > 180 ? 1 : 0;
  const d = `M${x0.toFixed(1)} ${y0.toFixed(1)}A${r} ${r} 0 ${large} ${ccw ? 0 : 1} ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  // tangent at the end, in screen coordinates
  const a = rad(to);
  const tx = ccw ? -Math.sin(a) : Math.sin(a);
  const ty = ccw ? -Math.cos(a) : Math.cos(a);
  const h = 6;
  const nx = -ty;
  const ny = tx;
  const head = `M${x1.toFixed(1)} ${y1.toFixed(1)}L${(x1 - h * tx + (h / 2) * nx).toFixed(1)} ${(y1 - h * ty + (h / 2) * ny).toFixed(1)}L${(x1 - h * tx - (h / 2) * nx).toFixed(1)} ${(y1 - h * ty - (h / 2) * ny).toFixed(1)}Z`;
  const mid = rad((from + to) / 2);
  const lr = labelR ?? r + 10;
  return (
    <g>
      <path d={d} fill="none" stroke={color} strokeWidth={1.5} />
      <path d={head} fill={color} stroke="none" />
      {label && (
        <text x={cx + lr * Math.cos(mid)} y={cy - lr * Math.sin(mid) + 4} textAnchor="middle" className="diagram-label" fill={color}>
          {label}
        </text>
      )}
    </g>
  );
}

/** Horizontal dimension line with end ticks and a centred label. */
export function Dim({ x1, x2, y, label, vertical = false }: { x1: number; x2: number; y: number; label: string; vertical?: boolean }) {
  if (vertical) {
    // x1..x2 are y-coordinates, y is the x position
    return (
      <g stroke="var(--text-3)" strokeWidth={1}>
        <line x1={y} y1={x1} x2={y} y2={x2} />
        <line x1={y - 4} y1={x1} x2={y + 4} y2={x1} />
        <line x1={y - 4} y1={x2} x2={y + 4} y2={x2} />
        <text x={y + 6} y={(x1 + x2) / 2 + 4} className="plot-note" stroke="none">
          {label}
        </text>
      </g>
    );
  }
  return (
    <g stroke="var(--text-3)" strokeWidth={1}>
      <line x1={x1} y1={y} x2={x2} y2={y} />
      <line x1={x1} y1={y - 4} x2={x1} y2={y + 4} />
      <line x1={x2} y1={y - 4} x2={x2} y2={y + 4} />
      <text x={(x1 + x2) / 2} y={y - 5} textAnchor="middle" className="plot-note" stroke="none">
        {label}
      </text>
    </g>
  );
}

function Fig({ w, h, label, children, max = 420 }: { w: number; h: number; label: string; children: ReactNode; max?: number }) {
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" style={{ maxWidth: max, display: 'block' }} role="img" aria-label={label}>
      {children}
    </svg>
  );
}

const CoM = ({ x, y, r = 6 }: { x: number; y: number; r?: number }) => (
  <g>
    <circle cx={x} cy={y} r={r} fill="var(--surface)" stroke="var(--text)" strokeWidth={1.4} />
    <path d={`M${x} ${y - r}A${r} ${r} 0 0 1 ${x + r} ${y}L${x} ${y}Z M${x} ${y + r}A${r} ${r} 0 0 1 ${x - r} ${y}L${x} ${y}Z`} fill="var(--text)" />
  </g>
);

// ------------------------------------------------------------------ cart with a swinging rod (2022 A2)

export function CartRodFigure() {
  const px = 214;
  const py = 100;
  const th = (17 * Math.PI) / 180;
  const ex = px + 100 * Math.sin(th);
  const ey = py + 100 * Math.cos(th);
  return (
    <Fig w={360} h={215} label="Cart of mass m tied to a wall by spring k, with a uniform rod of mass M and length 2L pinned to it; coordinates x (cart) and θ (rod from the vertical)">
      <Ground x={30} y={84} w={90} vertical side="left" />
      <line x1={30} y1={131} x2={335} y2={131} stroke="var(--text-3)" strokeWidth={2} />
      <Spring x1={30} y1={84} x2={110} y2={84} coils={5} amp={7} />
      <text x={70} y={70} textAnchor="middle" className="diagram-label">
        k
      </text>
      <rect x={110} y={58} width={140} height={52} rx={4} fill="var(--surface-2)" stroke="var(--text-2)" strokeWidth={1.6} />
      <text x={160} y={89} textAnchor="middle" className="diagram-label">
        m
      </text>
      <circle cx={135} cy={121} r={9} fill="var(--surface)" stroke="var(--text-2)" strokeWidth={1.5} />
      <circle cx={225} cy={121} r={9} fill="var(--surface)" stroke="var(--text-2)" strokeWidth={1.5} />
      <Arrow x1={160} y1={40} x2={215} y2={40} label="x" />
      <line x1={160} y1={34} x2={160} y2={46} stroke="var(--text-2)" strokeWidth={1.5} />
      <line x1={px} y1={py} x2={px} y2={208} stroke="var(--text-3)" strokeDasharray="3 4" />
      <line x1={px} y1={py} x2={ex} y2={ey} stroke="var(--text)" strokeWidth={5} strokeLinecap="round" />
      <circle cx={px} cy={py} r={3.5} fill="var(--surface)" stroke="var(--text)" strokeWidth={1.5} />
      <CoM x={(px + ex) / 2} y={(py + ey) / 2} r={4.5} />
      <ArcArrow cx={px} cy={py} r={58} from={-90} to={-90 + 17} label="θ" labelR={70} />
      <text x={ex + 8} y={ey - 2} className="diagram-label">
        M, 2L
      </text>
      <text x={(px + ex) / 2 + 9} y={(py + ey) / 2 + 4} className="plot-note">
        G (L below pivot)
      </text>
    </Fig>
  );
}

// ------------------------------------------------------------------ rigid bar on two springs

export function BarFigure() {
  return (
    <Fig w={360} h={190} label="Rigid bar with centre of mass G on spring k1 a distance a to the left and spring k2 a distance b to the right; coordinates y (bounce, up) and θ (pitch, anticlockwise)">
      <rect x={50} y={70} width={260} height={16} rx={3} fill="var(--surface-2)" stroke="var(--text-2)" strokeWidth={1.6} />
      <Spring x1={100} y1={148} x2={100} y2={86} coils={5} amp={8} />
      <Spring x1={270} y1={148} x2={270} y2={86} coils={5} amp={8} />
      <Ground x={100} y={148} w={44} />
      <Ground x={270} y={148} w={44} />
      <text x={84} y={122} textAnchor="end" className="diagram-label">
        k₁
      </text>
      <text x={286} y={122} className="diagram-label">
        k₂
      </text>
      <CoM x={170} y={78} />
      <Arrow x1={170} y1={66} x2={170} y2={28} label="y" />
      <ArcArrow cx={170} cy={78} r={30} from={-25} to={40} label="θ" labelR={42} />
      <text x={56} y={62} className="plot-note">
        m, J about G
      </text>
      <Dim x1={100} x2={170} y={174} label="a" />
      <Dim x1={170} x2={270} y={174} label="b" />
    </Fig>
  );
}

// ------------------------------------------------------------------ nest swing (2021 A2), view along A–A

export function NestFigure() {
  // View along A–A (as 2021 Fig. A2.1(3)). θ: rope from the vertical; the dashed line is the plate's
  // position if it only followed the rope (perpendicular to it); φ: the plate's extra rotation
  // relative to the rope. Both are drawn anticlockwise (the same sense), as in the paper.
  const tx = 132;
  const ty = 24;
  const h = 150;
  const thDeg = 14;
  const phDeg = 16;
  const th = (thDeg * Math.PI) / 180;
  const ax = tx + h * Math.sin(th);
  const ay = ty + h * Math.cos(th);
  const ang = ((thDeg + phDeg) * Math.PI) / 180; // plate angle above the horizontal
  const half = 62;
  const nx = Math.cos(th);
  const ny = -Math.sin(th);
  const pxv = Math.cos(ang);
  const pyv = -Math.sin(ang);
  const phLabel = (45 * Math.PI) / 180;
  return (
    <Fig w={300} h={244} label="Nest swing seen along the axis A–A: rope at angle θ from the vertical, plate rotated by φ relative to the rope (both anticlockwise), torsional stiffness k at the plate centre, distance h from the beam to A–A" max={340}>
      <Ground x={tx} y={ty} w={90} side="above" />
      <line x1={tx} y1={ty} x2={tx} y2={ty + 178} stroke="var(--text-3)" strokeDasharray="3 4" />
      <line x1={tx} y1={ty} x2={ax} y2={ay} stroke="var(--text)" strokeWidth={2} />
      <line x1={ax - half * nx} y1={ay - half * ny} x2={ax + half * nx} y2={ay + half * ny} stroke="var(--text-3)" strokeDasharray="4 4" />
      <line x1={ax - half * pxv} y1={ay - half * pyv} x2={ax + half * pxv} y2={ay + half * pyv} stroke="var(--text)" strokeWidth={6} strokeLinecap="round" />
      <circle cx={ax} cy={ay} r={7} fill="var(--surface)" stroke="var(--text-2)" strokeWidth={1.5} />
      <path d={`M${ax - 3} ${ay}a3 3 0 1 1 3 3`} fill="none" stroke="var(--text-2)" strokeWidth={1.2} />
      <ArcArrow cx={tx} cy={ty} r={46} from={-90} to={-90 + thDeg} label="θ" labelR={57} />
      <ArcArrow cx={ax} cy={ay} r={40} from={thDeg} to={thDeg + phDeg} />
      <text x={ax + 48 * Math.cos(phLabel)} y={ay - 48 * Math.sin(phLabel) + 2} textAnchor="middle" className="diagram-label">
        φ
      </text>
      <text x={ax - 4} y={ay + 27} textAnchor="middle" className="diagram-label">
        k
      </text>
      <text x={ax + 22} y={ay + 40} className="plot-note">
        plate m, I
      </text>
      <text x={tx + 0.6 * h * Math.sin(th) + 8} y={ty + 0.6 * h * Math.cos(th)} className="diagram-label">
        h
      </text>
      <text x={6} y={222} className="plot-note">
        dashed: plate square to the rope
      </text>
      <text x={6} y={238} className="plot-note">
        φ: plate rotation relative to the rope
      </text>
    </Fig>
  );
}

// ------------------------------------------------------------------ belt drive (official 2019 Q2)

export function BeltFigure() {
  const c1 = { x: 90, y: 92, r: 30 };
  const c2 = { x: 262, y: 92, r: 62 };
  // external tangents: they touch each circle at angle φ from the vertical, sin φ = (r₂ − r₁)/d
  const ang = Math.asin((c2.r - c1.r) / (c2.x - c1.x));
  const t = (c: typeof c1, sign: number) => [c.x - c.r * Math.sin(ang), c.y - sign * c.r * Math.cos(ang)] as const;
  const [a1x, a1y] = t(c1, 1);
  const [a2x, a2y] = t(c2, 1);
  const [b1x, b1y] = t(c1, -1);
  const [b2x, b2y] = t(c2, -1);
  return (
    <Fig w={360} h={190} label="Belt drive: motor pulley radius R1 (inertia I_T) and driven pulley radius R2 (inertia I_P) joined by a belt of stiffness k on each side; θ1 and θ2 in the same sense">
      <line x1={a1x} y1={a1y} x2={a2x} y2={a2y} stroke="var(--text-2)" strokeWidth={2} />
      <line x1={b1x} y1={b1y} x2={b2x} y2={b2y} stroke="var(--text-2)" strokeWidth={2} />
      <circle cx={c1.x} cy={c1.y} r={c1.r} fill="var(--surface-2)" stroke="var(--text)" strokeWidth={1.6} />
      <circle cx={c2.x} cy={c2.y} r={c2.r} fill="var(--surface-2)" stroke="var(--text)" strokeWidth={1.6} />
      <line x1={c1.x} y1={c1.y} x2={c1.x + c1.r * 0.7} y2={c1.y - c1.r * 0.7} stroke="var(--text-2)" />
      <line x1={c2.x} y1={c2.y} x2={c2.x + c2.r * 0.7} y2={c2.y - c2.r * 0.7} stroke="var(--text-2)" />
      <text x={c1.x - 6} y={c1.y - 16} className="plot-note">
        R₁
      </text>
      <text x={c2.x - 4} y={c2.y - 26} className="plot-note">
        R₂
      </text>
      <text x={c1.x} y={c1.y + 22} textAnchor="middle" className="plot-note">
        I{sub('T')}
      </text>
      <text x={c2.x} y={c2.y + 30} textAnchor="middle" className="plot-note">
        I{sub('P')}
      </text>
      <text x={176} y={(a1y + a2y) / 2 - 8} textAnchor="middle" className="diagram-label">
        k
      </text>
      <text x={176} y={(b1y + b2y) / 2 + 18} textAnchor="middle" className="diagram-label">
        k
      </text>
      <ArcArrow cx={c1.x} cy={c1.y} r={c1.r + 12} from={110} to={170} label="θ₁" labelR={c1.r + 24} />
      <ArcArrow cx={c2.x} cy={c2.y} r={c2.r + 10} from={-10} to={40} label="θ₂" labelR={c2.r + 22} />
    </Fig>
  );
}

// ------------------------------------------------------------------ folding-leg platform (2023 A2, case II)

export function PlatformFigure() {
  const cx = 180;
  const top = 44;
  const pivotY = 56;
  const l = 150;
  const fx = l * Math.cos(Math.PI / 6);
  const fy = l * Math.sin(Math.PI / 6);
  const mx = fx / 2;
  const my = fy / 2;
  return (
    <Fig w={360} h={175} label="Folding-leg platform, case II: platform on two legs pinned at its centre of mass, horizontal spring k1 between the leg mid-points, one vertical spring k2 at distance a right of the CoM; downward force f at the left edge, distance b from the CoM">
      <rect x={cx - 120} y={top} width={240} height={12} rx={2} fill="var(--surface-2)" stroke="var(--text-2)" strokeWidth={1.6} />
      <line x1={cx} y1={pivotY} x2={cx - fx} y2={pivotY + fy} stroke="var(--text)" strokeWidth={3} />
      <line x1={cx} y1={pivotY} x2={cx + fx} y2={pivotY + fy} stroke="var(--text)" strokeWidth={3} />
      <circle cx={cx} cy={pivotY} r={4} fill="var(--surface)" stroke="var(--text)" strokeWidth={1.5} />
      <circle cx={cx - fx} cy={pivotY + fy + 4} r={4} fill="var(--surface)" stroke="var(--text-2)" />
      <circle cx={cx + fx} cy={pivotY + fy + 4} r={4} fill="var(--surface)" stroke="var(--text-2)" />
      <Ground x={cx} y={pivotY + fy + 8} w={330} />
      <Spring x1={cx - mx} y1={pivotY + my} x2={cx + mx} y2={pivotY + my} coils={7} amp={5} />
      <text x={cx} y={pivotY + my + 18} textAnchor="middle" className="diagram-label">
        k₁
      </text>
      <Spring x1={cx + mx} y1={top + 12} x2={cx + mx} y2={pivotY + my} coils={3} amp={6} />
      <text x={cx + mx + 10} y={pivotY + my - 8} className="diagram-label">
        k₂
      </text>
      <line x1={cx - mx} y1={top + 12} x2={cx - mx} y2={pivotY + my} stroke="var(--text-3)" strokeDasharray="3 3" />
      <text x={cx - mx - 6} y={pivotY + my - 6} textAnchor="end" className="plot-note">
        removed in (II)
      </text>
      <Arrow x1={cx} y1={top - 2} x2={cx} y2={10} label="x" />
      {/* θ anticlockwise about the CoM: the right end rises */}
      <ArcArrow cx={cx} cy={top + 6} r={132} from={-9} to={9} label="θ" labelR={145} />
      <Arrow x1={cx - 120} y1={6} x2={cx - 120} y2={top - 2} />
      <text x={cx - 126} y={28} textAnchor="end" className="diagram-label">
        f
      </text>
      <Dim x1={cx} x2={cx + mx} y={top - 6} label="a" />
      <Dim x1={cx - 120} x2={cx} y={top - 20} label="b" />
    </Fig>
  );
}

// ------------------------------------------------------------------ box on four rubber springs (2024 A2), x–y view

export function BoxFigure() {
  const gx = 170;
  const gy = 86;
  const a = 100;
  const c = 54;
  const gr = gy + c + 34;
  return (
    <Fig w={340} h={214} label="Box 2a long and 2c high seen in the x–y plane on springs at the mid-points of the bottom edges: left and right at x = ∓a, front and back at x = 0, all a depth c below G; coordinates x, y and θ (anticlockwise) at G">
      <rect x={gx - a} y={gy - c} width={2 * a} height={2 * c} rx={3} fill="var(--surface-2)" stroke="var(--text-2)" strokeWidth={1.6} />
      {[gx - a + 6, gx, gx + a - 6].map((sx, i) => (
        <g key={i}>
          <Spring x1={sx} y1={gr} x2={sx} y2={gy + c} coils={4} amp={6} />
          <Ground x={sx} y={gr} w={26} />
        </g>
      ))}
      <text x={gx + 10} y={gy + c + 22} className="plot-note">
        front &amp; back
      </text>
      <CoM x={gx} y={gy} />
      <Arrow x1={gx + 8} y1={gy} x2={gx + 52} y2={gy} label="x" />
      <Arrow x1={gx} y1={gy - 8} x2={gx} y2={gy - 46} label="y" />
      <ArcArrow cx={gx} cy={gy} r={24} from={110} to={170} label="θ" labelR={35} />
      <Dim x1={gy} x2={gy + c} y={gx - a - 16} label="" vertical />
      <text x={gx - a - 30} y={gy + c / 2 + 4} className="diagram-label">
        c
      </text>
      <Dim x1={gx} x2={gx + a} y={gy - c - 8} label="a" />
      <text x={gx} y={gr + 30} textAnchor="middle" className="plot-note">
        each spring: k{sub('y')} axial (vertical), k{sub('x')} shear
      </text>
    </Fig>
  );
}

// ------------------------------------------------------------------ range hood on three wall mounts (2025 A2), top view

export function HoodFigure() {
  const wall = 34;
  const back = 84;
  const front = 246;
  const cx = 170;
  const cy = 108;
  const s = 70;
  return (
    <Fig w={340} h={234} label="Range hood seen from above: wall on the left, three mounts a distance d behind the centre of mass at y = +s, 0, −s, each with axial stiffness kx and transverse stiffness ky; coordinates x away from the wall, y along the wall, θ anticlockwise; the fan is centred on the centre of mass">
      <Ground x={wall} y={cy} w={190} vertical side="left" />
      <rect x={back} y={cy - s - 16} width={front - back} height={2 * s + 32} rx={3} fill="var(--surface-2)" stroke="var(--text-2)" strokeWidth={1.6} />
      {[-s, 0, s].map((dy, i) => (
        <Spring key={i} x1={wall} y1={cy + dy} x2={back} y2={cy + dy} coils={3} amp={5} />
      ))}
      <text x={wall + 4} y={cy - s - 22} className="plot-note">
        k{sub('x')}, k{sub('y')} per mount
      </text>
      <circle cx={cx} cy={cy} r={32} fill="none" stroke="var(--text-3)" strokeDasharray="4 4" />
      <CoM x={cx} y={cy} />
      <Arrow x1={cx + 8} y1={cy} x2={cx + 46} y2={cy} label="x" />
      <Arrow x1={cx} y1={cy - 8} x2={cx} y2={cy - 46} label="y" />
      <ArcArrow cx={cx} cy={cy} r={20} from={110} to={170} label="θ" labelR={42} />
      <Dim x1={back} x2={cx} y={cy + s + 8} label="d" />
      <Dim x1={cy - s} x2={cy} y={front + 12} label="s" vertical />
      <text x={(back + front) / 2} y={cy + s + 42} textAnchor="middle" className="plot-note">
        fan at the CoM: F{sub('0')} = m{sub('b')}RΩ²
      </text>
    </Fig>
  );
}

// ------------------------------------------------------------------ coupled rail cars (official 2017 A1)

export function RailCarsFigure() {
  return (
    <Fig w={360} h={130} label="Two rail cars of masses m1 and m2 joined by a coupling spring k, free to roll; coordinates x1 and x2 to the right">
      <line x1={10} y1={112} x2={350} y2={112} stroke="var(--text-3)" strokeWidth={2} />
      {[30, 210].map((x0, i) => (
        <g key={i}>
          <rect x={x0} y={48} width={120} height={46} rx={4} fill="var(--surface-2)" stroke="var(--text-2)" strokeWidth={1.6} />
          <circle cx={x0 + 25} cy={103} r={8} fill="var(--surface)" stroke="var(--text-2)" />
          <circle cx={x0 + 95} cy={103} r={8} fill="var(--surface)" stroke="var(--text-2)" />
          <text x={x0 + 60} y={76} textAnchor="middle" className="diagram-label">
            {i ? 'm₂' : 'm₁'}
          </text>
          <Arrow x1={x0 + 40} y1={30} x2={x0 + 85} y2={30} label={i ? 'x₂' : 'x₁'} />
          <line x1={x0 + 40} y1={24} x2={x0 + 40} y2={36} stroke="var(--text-2)" strokeWidth={1.5} />
        </g>
      ))}
      <Spring x1={150} y1={71} x2={210} y2={71} coils={4} amp={6} />
      <text x={180} y={60} textAnchor="middle" className="diagram-label">
        k
      </text>
    </Fig>
  );
}

// ------------------------------------------------------------------ motor, gearbox and load (official 2018 A2)

export function GearFigure() {
  return (
    <Fig w={360} h={166} label="Motor of inertia I_m drives through a gear reduction G a shaft of torsional stiffness k_T to a load of inertia I_L; coordinates θ_G at the gear and θ_L at the load">
      <rect x={20} y={36} width={70} height={46} rx={4} fill="var(--surface-2)" stroke="var(--text-2)" strokeWidth={1.6} />
      <text x={55} y={64} textAnchor="middle" className="diagram-label">
        I{sub('m')}
      </text>
      <line x1={90} y1={59} x2={112} y2={59} stroke="var(--text)" strokeWidth={4} />
      <circle cx={120} cy={59} r={10} fill="var(--surface)" stroke="var(--text)" strokeWidth={1.5} />
      <circle cx={120} cy={99} r={30} fill="var(--surface)" stroke="var(--text)" strokeWidth={1.5} />
      <text x={120} y={22} textAnchor="middle" className="plot-note">
        ratio G : 1
      </text>
      <Spring x1={150} y1={99} x2={262} y2={99} coils={8} amp={5} />
      <text x={206} y={86} textAnchor="middle" className="diagram-label">
        k{sub('T')}
      </text>
      <rect x={262} y={74} width={74} height={50} rx={4} fill="var(--surface-2)" stroke="var(--text-2)" strokeWidth={1.6} />
      <text x={299} y={104} textAnchor="middle" className="diagram-label">
        I{sub('L')}
      </text>
      <ArcArrow cx={120} cy={99} r={38} from={290} to={340} />
      <text x={150} y={146} className="diagram-label">
        θ{sub('G')}
      </text>
      <ArcArrow cx={299} cy={99} r={36} from={60} to={120} label={<>θ{sub('L')}</>} labelR={46} />
      <text x={14} y={158} className="plot-note">
        motor angle = Gθ{sub('G')}
      </text>
    </Fig>
  );
}
