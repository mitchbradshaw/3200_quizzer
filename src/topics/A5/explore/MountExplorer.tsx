// Drag-the-mounts explorer: a planar rigid block (sway x, bounce y, rock θ about G) on mounts placed
// around its outline. K is assembled live (summary notes A5: Δx = x − yᵢθ, Δy = y + xᵢθ), the coupling
// terms are highlighted and explained, and each mode is animated about its centre of rotation.
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as RPointerEvent } from 'react';
import { useRaf } from '../../../anim/hooks';
import { springPath, svgPoint } from '../../../ui/diagrams';
import { Badge, Button, Callout, Readout, Readouts, Segmented, Select, SimLayout, Slider, Toggle } from '../../../ui/kit';
import { PredictReveal } from '../../../ui/PredictReveal';
import { Rich } from '../../../ui/Rich';
import { completeChallenge, useProgress } from '../../../app/store';
import { fmt } from '../../../engine/format';
import { inclinedMount, type Mount } from '../../../physics/rigidbody';
import { energySplit, modeCentre, planarModes, shiftOrigin, stiffnessCentres } from '../physics';
import { MatrixView } from './MatrixView';
import { useStaged } from './useStaged';

export const DECOUPLE_CHALLENGE = 'a5-decouple-box';

const VW = 600;
const VH = 380;
const CX = 300;
const CY = 182;
const SPR = 44; // spring length (px)
const STUB = 12; // bracket offset (px)
const A_PX = 18; // largest corner displacement in the animation (px)
const F_VIS = 0.8; // on-screen animation frequency (Hz)
const TAU = 2 * Math.PI;
const MODE_VAR = ['var(--m1)', 'var(--m2)', 'var(--m3)'];
/** Text halo: keeps SVG labels readable where they cross springs or lines. */
const HALO = { paintOrder: 'stroke', stroke: 'var(--surface)', strokeWidth: 4, strokeLinejoin: 'round' } as const;

type Edge = 'bottom' | 'right' | 'top' | 'left';
interface Geo {
  xc: number;
  yc: number;
  edge: Edge;
  corner: boolean;
}
interface MountS {
  p: number; // position along the outline, 0..1 from the bottom-left corner, anticlockwise
  kx: number; // N/m (principal, along the mount's own x axis)
  ky: number; // N/m
  phi: number; // inclination (deg, anticlockwise)
  label: string;
}
interface BodyS {
  w: number;
  h: number;
  gu: number; // G offset from the block centre, as a fraction of w
  gv: number; // ... and of h
  m: number;
  I: number;
}
interface PresetDef {
  id: string;
  name: string;
  note: string;
  body: BodyS;
  unit: 1e3 | 1e6;
  /** Positions relative to G (m). */
  mounts: { x: number; y: number; kx: number; ky: number; phi?: number; label: string }[];
}

const C24 = Math.SQRT2;
const PRESETS: PresetDef[] = [
  {
    id: 'box2024',
    name: '2024 box on four rubber springs',
    note: 'Front view. The front and back mid-edge springs coincide at $x = 0$ in this view, so that mount carries $2k_x$ and $2k_y$; $k_x = 8k_y$.',
    body: { w: 4, h: 2 * C24, gu: 0, gv: 0, m: 2000, I: 4000 },
    unit: 1e6,
    mounts: [
      { x: -2, y: -C24, kx: 40e6, ky: 5e6, label: 'left' },
      { x: 0, y: -C24, kx: 80e6, ky: 10e6, label: 'front + back' },
      { x: 2, y: -C24, kx: 40e6, ky: 5e6, label: 'right' },
    ],
  },
  {
    id: 'box2024-5',
    name: '2024 box + fifth corner spring',
    note: 'The fifth spring under the right-front corner sits at $(a, -c)$ in this view, on top of the right mid-edge spring, so mount 3 carries $2k_x$ and $2k_y$.',
    body: { w: 4, h: 2 * C24, gu: 0, gv: 0, m: 2000, I: 4000 },
    unit: 1e6,
    mounts: [
      { x: -2, y: -C24, kx: 40e6, ky: 5e6, label: 'left' },
      { x: 0, y: -C24, kx: 80e6, ky: 10e6, label: 'front + back' },
      { x: 2, y: -C24, kx: 80e6, ky: 10e6, label: 'right + 5th' },
    ],
  },
  {
    id: 'machine2017',
    name: '2017 machine, springs 0.5 m below G',
    note: 'Official 2017 A2 layout with numbers: left end $b$ = 0.9 m and right end $c$ = 1.05 m from G, both $a$ = 0.5 m below G. G is 0.15 m right of the block centre.',
    body: { w: 2.4, h: 1.2, gu: 0.0625, gv: -0.1 / 1.2, m: 600, I: 360 },
    unit: 1e3,
    mounts: [
      { x: -0.9, y: -0.5, kx: 150e3, ky: 400e3, label: 'left end' },
      { x: 1.05, y: -0.5, kx: 150e3, ky: 400e3, label: 'right end' },
    ],
  },
  {
    id: 'machine2017-raised',
    name: '2017 machine, springs at G’s height',
    note: 'Both ends moved up the sides to the height of G ($a = 0$); G is still off-centre, so $b$ = 1.35 m ≠ $c$ = 1.05 m.',
    body: { w: 2.4, h: 1.2, gu: 0.0625, gv: -0.1 / 1.2, m: 600, I: 360 },
    unit: 1e3,
    mounts: [
      { x: -1.35, y: 0, kx: 150e3, ky: 400e3, label: 'left end' },
      { x: 1.05, y: 0, kx: 150e3, ky: 400e3, label: 'right end' },
    ],
  },
  {
    id: 'cabinet2022',
    name: '2022 wall cabinet (a ≠ b)',
    note: 'Wall on the right. Upper anchor: horizontal $k_x$ only, $a$ = 0.25 m above G. Lower anchor (corner): $k_x$ and a vertical bracket $k_y$, $b$ = 0.5 m below G; $c$ = 0.3 m.',
    body: { w: 0.6, h: 1.0, gu: 0, gv: 0, m: 40, I: (40 * (0.36 + 1)) / 12 },
    unit: 1e3,
    mounts: [
      { x: 0.3, y: 0.25, kx: 50e3, ky: 0, label: 'upper anchor' },
      { x: 0.3, y: -0.5, kx: 50e3, ky: 80e3, label: 'lower anchor' },
    ],
  },
  {
    id: 'cabinet2022-ab',
    name: '2022 wall cabinet with a = b',
    note: 'Upper anchor moved to $a = b$ = 0.5 m above G: the horizontal forces now balance about G.',
    body: { w: 0.6, h: 1.0, gu: 0, gv: 0, m: 40, I: (40 * (0.36 + 1)) / 12 },
    unit: 1e3,
    mounts: [
      { x: 0.3, y: 0.5, kx: 50e3, ky: 0, label: 'upper anchor' },
      { x: 0.3, y: -0.5, kx: 50e3, ky: 80e3, label: 'lower anchor' },
    ],
  },
  {
    id: 'rangehood2025',
    name: '2025 range hood (top view)',
    note: 'Top view, wall on the left: $x$ away from the wall, $y$ along it. Three mounts at $d$ = 0.5 m, $s$ = 0.5 m; each has $k_x$ = 0.24 MN/m axial and $k_y = k_x/3$ transverse; $I$ = 15 kg m² (not a uniform block).',
    body: { w: 1, h: 1, gu: 0, gv: 0, m: 28, I: 15 },
    unit: 1e3,
    mounts: [
      { x: -0.5, y: 0.5, kx: 240e3, ky: 80e3, label: 'top mount' },
      { x: -0.5, y: 0, kx: 240e3, ky: 80e3, label: 'middle mount' },
      { x: -0.5, y: -0.5, kx: 240e3, ky: 80e3, label: 'bottom mount' },
    ],
  },
  {
    id: 'la7corners',
    name: 'Reader LA7: uniform body on corner springs',
    note: 'Each corner symbol is two physical springs ($2k_x$, $2k_y$ per side). $U = k_x/k_y$ = 0.5 and $a/b$ = 1, so LA7 Eq 7.8 gives 0.554 and 1.563 × $\\omega_y$ (compare the chart simulation).',
    body: { w: 1, h: 1, gu: 0, gv: 0, m: 100, I: 100 / 6 },
    unit: 1e3,
    mounts: [
      { x: -0.5, y: -0.5, kx: 10e3, ky: 20e3, label: 'left pair' },
      { x: 0.5, y: -0.5, kx: 10e3, ky: 20e3, label: 'right pair' },
    ],
  },
];

// ------------------------------------------------------------------ outline geometry

function perimToGeo(p: number, w: number, h: number): Geo {
  const P = 2 * (w + h);
  let s = (((p % 1) + 1) % 1) * P;
  const eps = 1e-9 * P;
  let g: Geo;
  if (s < w) g = { xc: -w / 2 + s, yc: -h / 2, edge: 'bottom', corner: false };
  else if ((s -= w) < h) g = { xc: w / 2, yc: -h / 2 + s, edge: 'right', corner: false };
  else if ((s -= h) < w) g = { xc: w / 2 - s, yc: h / 2, edge: 'top', corner: false };
  else {
    s -= w;
    g = { xc: -w / 2, yc: h / 2 - s, edge: 'left', corner: false };
  }
  g.corner = Math.abs(Math.abs(g.xc) - w / 2) < eps + 1e-9 && Math.abs(Math.abs(g.yc) - h / 2) < eps + 1e-9;
  return g;
}

function geoToPerim(xc: number, yc: number, w: number, h: number): number {
  const P = 2 * (w + h);
  const dB = Math.abs(yc + h / 2);
  const dT = Math.abs(yc - h / 2);
  const dL = Math.abs(xc + w / 2);
  const dR = Math.abs(xc - w / 2);
  const mn = Math.min(dB, dT, dL, dR);
  let s: number;
  if (mn === dB) s = Math.min(w, Math.max(0, xc + w / 2));
  else if (mn === dR) s = w + Math.min(h, Math.max(0, yc + h / 2));
  else if (mn === dT) s = w + h + Math.min(w, Math.max(0, w / 2 - xc));
  else s = 2 * w + h + Math.min(h, Math.max(0, h / 2 - yc));
  return (s / P) % 1;
}

/** Nearest outline point, snapped to corners, edge mid-points and points level with / plumb under G. */
function projectSnap(xc: number, yc: number, w: number, h: number, gx: number, gy: number, snap: number): { xc: number; yc: number } {
  let x = Math.max(-w / 2, Math.min(w / 2, xc));
  let y = Math.max(-h / 2, Math.min(h / 2, yc));
  const dB = Math.abs(y + h / 2);
  const dT = Math.abs(y - h / 2);
  const dL = Math.abs(x + w / 2);
  const dR = Math.abs(x - w / 2);
  const mn = Math.min(dB, dT, dL, dR);
  if (mn === dB || mn === dT) {
    y = mn === dB ? -h / 2 : h / 2;
    for (const t of [-w / 2, 0, w / 2, gx]) if (Math.abs(x - t) < snap) x = t;
  } else {
    x = mn === dL ? -w / 2 : w / 2;
    for (const t of [-h / 2, 0, h / 2, gy]) if (Math.abs(y - t) < snap) y = t;
  }
  return { xc: x, yc: y };
}

function fromPreset(pr: PresetDef): { body: BodyS; mounts: MountS[] } {
  const b = pr.body;
  const gx = b.gu * b.w;
  const gy = b.gv * b.h;
  return {
    body: { ...b },
    mounts: pr.mounts.map((q) => ({ p: geoToPerim(q.x + gx, q.y + gy, b.w, b.h), kx: q.kx, ky: q.ky, phi: q.phi ?? 0, label: q.label })),
  };
}

// ------------------------------------------------------------------ drawing helpers

type V2 = [number, number];
const rot = (v: V2, a: number): V2 => [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a)];

interface SpringDraw {
  key: string;
  /** Start in the body frame: px from G, v up. */
  su: number;
  sv: number;
  /** Fixed anchor in SVG coordinates. */
  ax: number;
  ay: number;
  width: number;
  anchor: string;
}

function anchorPath(ax: number, ay: number, dx: number, dy: number): string {
  const px = -dy;
  const py = dx;
  let d = `M${(ax + px * 10).toFixed(1)} ${(ay + py * 10).toFixed(1)}L${(ax - px * 10).toFixed(1)} ${(ay - py * 10).toFixed(1)}`;
  for (const t of [-8, -2, 4]) {
    const x0 = ax + px * t;
    const y0 = ay + py * t;
    d += `M${x0.toFixed(1)} ${y0.toFixed(1)}L${(x0 + dx * 6 + px * 5).toFixed(1)} ${(y0 + dy * 6 + py * 5).toFixed(1)}`;
  }
  return d;
}

const fmtU = (x: number, u: string, sig = 3) => `${fmt(x, sig)} ${u}`;

function describeCentre(vec: number[], m: number, I: number, size: number): string {
  const c = modeCentre(vec, 40 * size);
  const e = energySplit(vec, m, I);
  if (!c) return e[0] > 0.98 ? 'pure sway: no rotation, no centre' : e[1] > 0.98 ? 'pure bounce: no rotation, no centre' : 'a translation with almost no rotation (centre far away)';
  const r = Math.hypot(c.x, c.y);
  if (r < 0.01 * size) return 'pure rock about G';
  const parts: string[] = [];
  if (Math.abs(c.y) >= 0.01 * size) parts.push(`${fmt(Math.abs(c.y), 3)} m ${c.y < 0 ? 'below' : 'above'}`);
  if (Math.abs(c.x) >= 0.01 * size) parts.push(`${fmt(Math.abs(c.x), 3)} m ${c.x < 0 ? 'left of' : 'right of'}`);
  return `rotation about a point ${parts.join(' and ')} G`;
}

// ------------------------------------------------------------------ component

export default function MountExplorer() {
  const progress = useProgress();
  // Opening the page: the block renders first, then its controls (stages 1 and 2), the matrices and mode
  // table (stage 3) and the predict-then-reveal questions (stages 4 and 5), each in its own short task.
  const stage = useStaged(5);
  const [bodyOpen, setBodyOpen] = useState(false);
  const [presetId, setPresetId] = useState('box2024');
  const init = useMemo(() => fromPreset(PRESETS[0]), []);
  const [body, setBody] = useState<BodyS>(init.body);
  const [mounts, setMounts] = useState<MountS[]>(init.mounts);
  const [sel, setSel] = useState(0);
  const [mode, setMode] = useState(0); // -1 = off
  const [coords, setCoords] = useState<'G' | 'mount'>('G');
  const [showCentres, setShowCentres] = useState(true);
  const [edited, setEdited] = useState(false);
  const preset = PRESETS.find((p) => p.id === presetId) || PRESETS[0];
  const unit = preset.unit;
  const uName = unit === 1e6 ? 'MN' : 'kN';
  const kRange = useMemo(() => 2.5 * Math.max(...preset.mounts.map((q) => Math.max(q.kx, q.ky))), [preset]);

  const load = (id: string) => {
    const pr = PRESETS.find((p) => p.id === id) || PRESETS[0];
    const s = fromPreset(pr);
    setPresetId(pr.id);
    setBody(s.body);
    setMounts(s.mounts);
    setSel(0);
    setEdited(false);
    setCoords('G');
  };

  const { w, h, m, I } = body;
  const gx = body.gu * w;
  const gy = body.gv * h;
  const size = Math.max(w, h);
  const ppm = Math.min(460 / w, 236 / h, 260);
  const Gx = CX + gx * ppm;
  const Gy = CY - gy * ppm;

  // ---- physics
  const geos = useMemo(() => mounts.map((q) => perimToGeo(q.p, w, h)), [mounts, w, h]);
  // Mount positions from G. Round-off from the outline parametrisation (e.g. 4.4e-16 m for a mount under G)
  // is snapped to exactly 0, so the labels read 0 m and symmetric layouts give exactly zero coupling terms.
  const rel = useMemo(() => {
    const tiny = 1e-9 * size;
    const snap = (v: number) => (Math.abs(v) < tiny ? 0 : v);
    return geos.map((g) => ({ x: snap(g.xc - gx), y: snap(g.yc - gy) }));
  }, [geos, gx, gy, size]);
  const phys: Mount[] = useMemo(
    () =>
      mounts.map((q, i) => {
        const { x, y } = rel[i];
        return q.phi ? inclinedMount(x, y, q.kx, q.ky, (q.phi * Math.PI) / 180) : { x, y, kx: q.kx, ky: q.ky };
      }),
    [mounts, rel]
  );
  const { K, M, modes } = useMemo(() => planarModes(phys, m, I), [phys, m, I]);
  const centres = useMemo(() => {
    // Round-off (e.g. 1e-16 m for a symmetric layout) must read as exactly 0 in the readouts and the text.
    const c = stiffnessCentres(phys);
    const snap = (v: number) => (Number.isFinite(v) && Math.abs(v) < 1e-9 * size ? 0 : v);
    return { ...c, xbar: snap(c.xbar), ybar: snap(c.ybar) };
  }, [phys, size]);
  const big = Math.max(K[0][0], K[1][1], K[2][2], 1e-9);
  const cpl = (i: number, j: number) => Math.abs(K[i][j]) > 1e-6 * big;
  const decoupled = !cpl(0, 1) && !cpl(0, 2) && !cpl(1, 2);
  const allRestrained = modes.every((md) => md.omega > 1e-6);
  const solved = presetId === 'box2024' && !edited && decoupled && allRestrained;
  const done = !!progress.challenges[DECOUPLE_CHALLENGE];
  const hLevel = Number.isFinite(centres.ybar) ? -centres.ybar : 0; // mount-level origin: h below G
  const shown = useMemo(() => (coords === 'G' ? { K, M } : shiftOrigin(K, M, hLevel)), [coords, K, M, hLevel]);

  // ---- drawing data (rest pose)
  const kMax = Math.max(...mounts.map((q) => Math.max(q.kx, q.ky)), 1);
  const springs: SpringDraw[] = useMemo(() => {
    const out: SpringDraw[] = [];
    const DOWN: V2 = [0, -1];
    const UP: V2 = [0, 1];
    const LEFT: V2 = [-1, 0];
    const RIGHT: V2 = [1, 0];
    mounts.forEach((q, i) => {
      const g = geos[i];
      const pu = (g.xc - gx) * ppm;
      const pv = (g.yc - gy) * ppm;
      const phi = (q.phi * Math.PI) / 180;
      let vDir: V2;
      let hDir: V2;
      let vStart: V2 = [pu, pv];
      let hStart: V2 = [pu, pv];
      if (g.corner) {
        vDir = g.yc < 0 ? DOWN : UP;
        hDir = g.xc < 0 ? LEFT : RIGHT;
      } else if (g.edge === 'bottom' || g.edge === 'top') {
        vDir = g.edge === 'bottom' ? DOWN : UP;
        hDir = g.xc < 0 ? LEFT : RIGHT;
        if (!phi) hStart = [pu, pv + (g.edge === 'bottom' ? -STUB : STUB)];
      } else {
        hDir = g.edge === 'left' ? LEFT : RIGHT;
        vDir = g.yc > 0 ? UP : DOWN;
        if (!phi) vStart = [pu + (g.edge === 'left' ? -STUB : STUB), pv];
      }
      if (phi) {
        vDir = rot(vDir, phi);
        hDir = rot(hDir, phi);
      }
      const add = (key: string, start: V2, dir: V2, k: number) => {
        if (k <= 0) return;
        const ax = Gx + start[0] + dir[0] * SPR;
        const ay = Gy - (start[1] + dir[1] * SPR);
        out.push({ key, su: start[0], sv: start[1], ax, ay, width: 1.2 + 2.2 * Math.sqrt(k / kMax), anchor: anchorPath(ax, ay, dir[0], -dir[1]) });
      };
      add(`h${i}`, hStart, hDir, q.kx);
      add(`v${i}`, vStart, vDir, q.ky);
    });
    return out;
  }, [mounts, geos, gx, gy, ppm, Gx, Gy, kMax]);

  // ---- animation state (refs; no React state per frame)
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<SVGGElement>(null);
  const springEls = useRef<(SVGPathElement | null)[]>([]);
  const drag = useRef<{ kind: 'mount' | 'G'; i: number } | null>(null);
  const t = useRef(0);
  const corners: V2[] = [
    [-w / 2 - gx, -h / 2 - gy],
    [w / 2 - gx, -h / 2 - gy],
    [w / 2 - gx, h / 2 - gy],
    [-w / 2 - gx, h / 2 - gy],
  ];
  const modeVis = useMemo(() => {
    const md = mode >= 0 ? modes[mode] : undefined;
    if (!md) return null;
    const [X, Y, T] = md.vec;
    let dmax = 0;
    for (const [cx, cy] of corners) dmax = Math.max(dmax, Math.hypot(X - cy * T, Y + cx * T));
    if (!(dmax > 0)) return null;
    const s = A_PX / (dmax * ppm);
    return { xv: s * X * ppm, yv: s * Y * ppm, th: s * T };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, modes, ppm, w, h, gx, gy]);
  const live = useRef({ springs, modeVis, Gx, Gy });
  live.current = { springs, modeVis, Gx, Gy };

  const drawPose = (amp: number) => {
    const L = live.current;
    const mv = L.modeVis;
    const xv = mv ? mv.xv * amp : 0;
    const yv = mv ? mv.yv * amp : 0;
    const th = mv ? mv.th * amp : 0;
    bodyRef.current?.setAttribute('transform', `translate(${(L.Gx + xv).toFixed(2)} ${(L.Gy - yv).toFixed(2)}) rotate(${((-th * 180) / Math.PI).toFixed(3)})`);
    const c = Math.cos(th);
    const s = Math.sin(th);
    L.springs.forEach((sp, i) => {
      const X = L.Gx + xv + sp.su * c - sp.sv * s;
      const Y = L.Gy - (yv + sp.su * s + sp.sv * c);
      springEls.current[i]?.setAttribute('d', springPath(X, Y, sp.ax, sp.ay, 5, 5, 6));
    });
  };
  const animating = mode >= 0 && !!modeVis;
  useRaf(
    (dt) => {
      if (drag.current) return;
      t.current += dt;
      drawPose(Math.sin(TAU * F_VIS * t.current));
    },
    animating,
    wrapRef
  );
  useEffect(() => {
    if (!animating || drag.current) drawPose(0);
  });

  // ---- interaction
  const toBlock = (e: RPointerEvent<SVGElement>) => {
    const pt = svgPoint(svgRef.current as SVGSVGElement, e.clientX, e.clientY);
    return { xc: (pt.x - CX) / ppm, yc: -(pt.y - CY) / ppm };
  };
  const startDrag = (e: RPointerEvent<SVGElement>, kind: 'mount' | 'G', i: number) => {
    e.preventDefault();
    (e.currentTarget as SVGElement).setPointerCapture(e.pointerId);
    drag.current = { kind, i };
    if (kind === 'mount') setSel(i);
    drawPose(0);
  };
  const moveDrag = (e: RPointerEvent<SVGElement>) => {
    const d = drag.current;
    if (!d || !svgRef.current) return;
    const { xc, yc } = toBlock(e);
    if (d.kind === 'mount') {
      const sp = projectSnap(xc, yc, w, h, gx, gy, 9 / ppm);
      const p = geoToPerim(sp.xc, sp.yc, w, h);
      setMounts((ms) => ms.map((q, j) => (j === d.i ? { ...q, p } : q)));
    } else {
      let gu = Math.max(-0.4, Math.min(0.4, xc / w));
      let gv = Math.max(-0.4, Math.min(0.4, yc / h));
      if (Math.abs(gu * w) < 8 / ppm) gu = 0;
      if (Math.abs(gv * h) < 8 / ppm) gv = 0;
      setEdited(true); // moving G changes the body (the challenge allows moving mounts only)
      setBody((b) => ({ ...b, gu, gv }));
    }
  };
  const endDrag = (e: RPointerEvent<SVGElement>) => {
    drag.current = null;
    (e.currentTarget as SVGElement).releasePointerCapture?.(e.pointerId);
  };
  const keyMount = (e: KeyboardEvent<SVGGElement>, i: number) => {
    const step = e.shiftKey ? 0.025 : 0.005;
    const dp = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? step : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -step : 0;
    if (!dp) return;
    e.preventDefault();
    setSel(i);
    setMounts((ms) => ms.map((q, j) => (j === i ? { ...q, p: (((q.p + dp) % 1) + 1) % 1 } : q)));
  };
  const keyG = (e: KeyboardEvent<SVGGElement>) => {
    const st = e.shiftKey ? 0.05 : 0.01;
    const du = e.key === 'ArrowRight' ? st : e.key === 'ArrowLeft' ? -st : 0;
    const dv = e.key === 'ArrowUp' ? st : e.key === 'ArrowDown' ? -st : 0;
    if (!du && !dv) return;
    e.preventDefault();
    setEdited(true);
    setBody((b) => ({ ...b, gu: Math.max(-0.4, Math.min(0.4, b.gu + du)), gv: Math.max(-0.4, Math.min(0.4, b.gv + dv)) }));
  };
  const setMount = (patch: Partial<MountS>) => {
    setEdited(true);
    setMounts((ms) => ms.map((q, j) => (j === sel ? { ...q, ...patch } : q)));
  };
  const setB = (patch: Partial<BodyS>) => {
    setEdited(true);
    setBody((b) => ({ ...b, ...patch }));
  };
  const cur = mounts[Math.min(sel, mounts.length - 1)];
  const curRel = rel[Math.min(sel, mounts.length - 1)];
  /** Lengths for labels: anything below a nanometre-scale fraction of the block is round-off, shown as 0. */
  const fmtLen = (v: number) => fmt(Math.abs(v) < 1e-9 * size ? 0 : v, 3);

  // ---- text
  const kTxt = (x: number, what: 'rad' | 'm' | 'mrad') => `${fmt(x / unit, 4)} ${uName}${what === 'm' ? '/m' : what === 'rad' ? '/rad' : ' m/rad'}`;
  const explain: string[] = [];
  if (centres.sumKx <= 0) explain.push('No mount resists sway: $K_{xx} = 0$, so sway is a free (ω = 0) motion.');
  else if (cpl(0, 2))
    explain.push(
      `**Sway–rock coupled:** $K_{x\\theta} = -\\sum k_{x,i}y_i$ = ${kTxt(K[0][2], 'rad')}. The horizontal stiffness acts ${fmt(Math.abs(centres.ybar), 3)} m ${centres.ybar < 0 ? 'below' : 'above'} G ($\\bar y$), so a sway pushes with a moment about G and a rotation shears the mounts.`
    );
  else explain.push('**Sway and rock are decoupled:** the horizontal stiffness acts through G ($\\bar y = 0$).');
  if (centres.sumKy <= 0) explain.push('No mount resists bounce: $K_{yy} = 0$ (free vertical motion).');
  else if (cpl(1, 2))
    explain.push(
      `**Bounce–rock coupled:** $K_{y\\theta} = \\sum k_{y,i}x_i$ = ${kTxt(K[1][2], 'rad')}. The vertical stiffness is centred ${fmt(Math.abs(centres.xbar), 3)} m ${centres.xbar < 0 ? 'left' : 'right'} of G ($\\bar x$), so a bounce tips the block and a rotation changes the net vertical spring force.`
    );
  else explain.push('**Bounce and rock are decoupled:** the vertical stiffness is centred under G ($\\bar x = 0$).');
  if (cpl(0, 1)) explain.push(`**Sway–bounce coupled:** an inclined mount gives $K_{xy} = \\sum k_{xy}$ = ${kTxt(K[0][1], 'm')} (LA7 Eq 7.11): a vertical force now also moves the block sideways.`);
  else explain.push('$K_{xy} = 0$: every mount is upright, so sway and bounce link only through θ.');

  const fmax = Math.max(...modes.map((md) => md.omega)) / TAU;
  const view = (x: number, y: number) => x > 6 && x < VW - 6 && y > 6 && y < VH - 6;

  return (
    <div ref={wrapRef}>
      <SimLayout
        visual={
          <>
            <svg ref={svgRef} viewBox={`0 0 ${VW} ${VH}`} className="anim" role="group" aria-label="Rigid block on mounts. Drag the blue mount handles along the outline and drag G to move the centre of mass." style={{ touchAction: 'none' }}>
              {/* rest outline */}
              <rect x={CX - (w / 2) * ppm} y={CY - (h / 2) * ppm} width={w * ppm} height={h * ppm} fill="none" stroke="var(--text-3)" strokeDasharray="4 4" opacity={0.6} />
              {showCentres && Number.isFinite(centres.ybar) && (
                <line x1={18} x2={VW - 6} y1={Gy - centres.ybar * ppm} y2={Gy - centres.ybar * ppm} stroke="var(--warn)" strokeDasharray="7 4" strokeWidth={1.4} pointerEvents="none" />
              )}
              {showCentres && Number.isFinite(centres.xbar) && (
                <line x1={Gx + centres.xbar * ppm} x2={Gx + centres.xbar * ppm} y1={30} y2={VH - 20} stroke="var(--warn)" strokeDasharray="2 4" strokeWidth={1.6} pointerEvents="none" />
              )}
              {springs.map((sp, i) => (
                <g key={sp.key}>
                  <path ref={(el) => (springEls.current[i] = el)} d={springPath(Gx + sp.su, Gy - sp.sv, sp.ax, sp.ay, 5, 5, 6)} fill="none" stroke="var(--text-2)" strokeWidth={sp.width} strokeLinejoin="round" />
                  <path d={sp.anchor} fill="none" stroke="var(--text-3)" strokeWidth={1.3} />
                </g>
              ))}
              {/* centre of rotation of the animated mode (a fixed point, so static) */}
              {mode >= 0 &&
                modes[mode] &&
                (() => {
                  const c = modeCentre(modes[mode].vec, 40 * size);
                  const col = MODE_VAR[mode];
                  if (!c)
                    return (
                      <text x={12} y={20} className="plot-note" fill={col} style={HALO}>
                        Mode {mode + 1}: pure translation, no centre of rotation
                      </text>
                    );
                  const X = Gx + c.x * ppm;
                  const Y = Gy - c.y * ppm;
                  if (!view(X, Y)) {
                    const dx = X - Gx;
                    const dy = Y - Gy;
                    const L = Math.hypot(dx, dy) || 1;
                    const ex = Math.max(16, Math.min(VW - 16, Gx + (dx / L) * 175));
                    const ey = Math.max(16, Math.min(VH - 16, Gy + (dy / L) * 165));
                    return (
                      <g pointerEvents="none">
                        <line x1={Gx} y1={Gy} x2={ex} y2={ey} stroke={col} strokeDasharray="3 4" />
                        <circle cx={ex} cy={ey} r={4} fill={col} />
                        <text x={12} y={20} className="plot-note" fill={col} style={HALO}>
                          Mode {mode + 1}: centre of rotation off-screen ({fmt(Math.hypot(c.x, c.y), 3)} m from G)
                        </text>
                      </g>
                    );
                  }
                  const right = X < VW - 150;
                  return (
                    <g pointerEvents="none">
                      <circle cx={X} cy={Y} r={7} fill="none" stroke={col} strokeWidth={2.2} />
                      <path d={`M${X - 11} ${Y}H${X + 11}M${X} ${Y - 11}V${Y + 11}`} stroke={col} strokeWidth={1.6} />
                      <text x={X + (right ? 13 : -13)} y={Y + (Y > VH - 30 ? -9 : 17)} className="plot-note" fill={col} textAnchor={right ? 'start' : 'end'} style={{ ...HALO, fontWeight: 650 }}>
                        centre of rotation (mode {mode + 1})
                      </text>
                    </g>
                  );
                })()}
              <g ref={bodyRef} transform={`translate(${Gx} ${Gy})`}>
                <rect x={(-w / 2 - gx) * ppm} y={(-h / 2 + gy) * ppm} width={w * ppm} height={h * ppm} rx={4} fill="var(--surface-2)" stroke={mode >= 0 ? MODE_VAR[mode] : 'var(--text-2)'} strokeWidth={2} />
                {springs.map((sp) =>
                  Math.abs(sp.su - (geos[Number(sp.key.slice(1))].xc - gx) * ppm) > 0.5 || Math.abs(sp.sv - (geos[Number(sp.key.slice(1))].yc - gy) * ppm) > 0.5 ? (
                    <line key={`s${sp.key}`} x1={(geos[Number(sp.key.slice(1))].xc - gx) * ppm} y1={-(geos[Number(sp.key.slice(1))].yc - gy) * ppm} x2={sp.su} y2={-sp.sv} stroke="var(--text-2)" strokeWidth={2} />
                  ) : null
                )}
                {/* G */}
                <g
                  tabIndex={0}
                  role="button"
                  aria-label={`Centre of mass G, ${fmtLen(gx)} m right and ${fmtLen(gy)} m above the block centre. Drag or use the arrow keys to move it.`}
                  style={{ cursor: 'move' }}
                  onPointerDown={(e) => startDrag(e, 'G', 0)}
                  onPointerMove={moveDrag}
                  onPointerUp={endDrag}
                  onKeyDown={keyG}
                >
                  <circle r={16} fill="transparent" />
                  <circle r={7} fill="var(--surface)" stroke="var(--text)" strokeWidth={1.8} />
                  <path d="M-7 0H7M0 -7V7" stroke="var(--text)" strokeWidth={1.4} />
                  <text x={10} y={-9} className="diagram-label">
                    G
                  </text>
                </g>
                {mounts.map((q, i) => {
                  const g = geos[i];
                  const u = (g.xc - gx) * ppm;
                  const v = (g.yc - gy) * ppm;
                  return (
                    <g
                      key={i}
                      tabIndex={0}
                      role="slider"
                      aria-label={`Mount ${i + 1} (${q.label}) at x = ${fmtLen(rel[i].x)} m, y = ${fmtLen(rel[i].y)} m from G. Arrow keys move it along the outline.`}
                      aria-valuenow={Math.round(q.p * 1000) / 10}
                      style={{ cursor: 'grab' }}
                      onPointerDown={(e) => startDrag(e, 'mount', i)}
                      onPointerMove={moveDrag}
                      onPointerUp={endDrag}
                      onKeyDown={(e) => keyMount(e, i)}
                      onFocus={() => setSel(i)}
                    >
                      <circle cx={u} cy={-v} r={17} fill="transparent" />
                      <circle cx={u} cy={-v} r={i === sel ? 9 : 7.5} fill="var(--surface)" stroke="var(--accent)" strokeWidth={i === sel ? 3.2 : 2.2} />
                      <text x={u} y={-v + 4} textAnchor="middle" className="plot-note" fill="var(--accent)" style={{ fontWeight: 700 }}>
                        {i + 1}
                      </text>
                    </g>
                  );
                })}
              </g>
              {/* tags for the stiffness-centre lines, at the edges of the view and drawn last so nothing covers them */}
              {showCentres && Number.isFinite(centres.ybar) && (
                <text x={5} y={Gy - centres.ybar * ppm + 5} className="diagram-label" fill="var(--warn)" style={{ ...HALO, fontWeight: 700 }} pointerEvents="none">
                  ȳ
                </text>
              )}
              {showCentres && Number.isFinite(centres.xbar) && (
                <text x={Gx + centres.xbar * ppm} y={VH - 5} className="diagram-label" fill="var(--warn)" textAnchor="middle" style={{ ...HALO, fontWeight: 700 }} pointerEvents="none">
                  x̄
                </text>
              )}
            </svg>
            <div className="row gap-s wrap">
              <span className="muted small">Animate:</span>
              <Segmented
                size="sm"
                label="Mode to animate"
                value={mode}
                onChange={setMode}
                options={[
                  ...modes.map((md, i) => ({ value: i, label: <span style={{ color: MODE_VAR[i], fontWeight: 650 }}>{`Mode ${i + 1}`}</span>, title: `${fmt(md.omega / TAU, 3)} Hz` })),
                  { value: -1, label: 'Still' },
                ]}
              />
              <Toggle checked={showCentres} onChange={setShowCentres} label="stiffness centres x̄, ȳ" />
            </div>
            {showCentres && (
              <div className="legend">
                <span className="legend-item">
                  <svg width="26" height="10" aria-hidden="true">
                    <line x1="1" y1="5" x2="25" y2="5" stroke="var(--warn)" strokeWidth="1.6" strokeDasharray="7 4" />
                  </svg>
                  <Rich inline text="$\bar y$: height of the resultant horizontal mount force; $K_{x\theta} = -(\sum k_x)\,\bar y$" />
                </span>
                <span className="legend-item">
                  <svg width="26" height="10" aria-hidden="true">
                    <line x1="1" y1="5" x2="25" y2="5" stroke="var(--warn)" strokeWidth="1.8" strokeDasharray="2 4" />
                  </svg>
                  <Rich inline text="$\bar x$: centre of the vertical stiffness; $K_{y\theta} = (\sum k_y)\,\bar x$" />
                </span>
              </div>
            )}
            <p className="muted small">
              Drag the numbered mounts along the outline (they snap to corners, mid-points and to G’s height or plumb line) and drag G to move the centre of mass. The animation is slowed to {F_VIS} Hz and exaggerated.
            </p>
          </>
        }
        controls={
          stage >= 1 && (
            <>
              <Select label="Layout preset" value={presetId} onChange={load} options={PRESETS.map((p) => ({ value: p.id, label: p.name }))} />
              <Rich className="note" text={preset.note} />
              <div className="row gap-s wrap">
                <span className="muted small">Selected mount:</span>
                <Segmented size="sm" label="Selected mount" value={Math.min(sel, mounts.length - 1)} onChange={setSel} options={mounts.map((q, i) => ({ value: i, label: `${i + 1}`, title: q.label }))} />
                <Button
                  size="sm"
                  onClick={() => {
                    setEdited(true);
                    setMounts((ms) => [...ms, { p: (w + h + w / 2) / (2 * (w + h)), kx: preset.mounts[0].kx, ky: preset.mounts[0].ky, phi: 0, label: 'added' }]);
                    setSel(mounts.length);
                  }}
                  disabled={mounts.length >= 6}
                >
                  Add mount
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setEdited(true);
                    setMounts((ms) => ms.filter((_, j) => j !== sel));
                    setSel(0);
                  }}
                  disabled={mounts.length <= 1}
                >
                  Remove
                </Button>
              </div>
              {cur && (
                <>
                  <p className="small" style={{ margin: '2px 0' }}>
                    <b>Mount {Math.min(sel, mounts.length - 1) + 1}</b> ({cur.label}) at <i>x</i> = {fmtLen(curRel.x)} m, <i>y</i> = {fmtLen(curRel.y)} m from G
                  </p>
                  <Slider label={cur.phi ? 'stiffness along its tilted x axis' : 'horizontal stiffness'} tex="k_x" tip="stiffness of this mount along x (its own axis if tilted), N/m" value={cur.kx / unit} min={0} max={kRange / unit} step={kRange / unit / 500} unit={`${uName}/m`} onChange={(v) => setMount({ kx: v * unit })} />
                  <Slider label={cur.phi ? 'stiffness along its tilted y axis' : 'vertical stiffness'} tex="k_y" tip="stiffness of this mount along y (its own axis if tilted), N/m" value={cur.ky / unit} min={0} max={kRange / unit} step={kRange / unit / 500} unit={`${uName}/m`} onChange={(v) => setMount({ ky: v * unit })} />
                  <Slider label="tilt" tex="\varphi" tip="inclination of the mount's principal axes, anticlockwise (LA7 Eq 7.11)" value={cur.phi} min={-45} max={45} step={1} unit="°" onChange={(v) => setMount({ phi: v })} />
                  <Slider label="position along the outline" tex="s" tip="0 % = bottom-left corner, going anticlockwise (also: drag the mount or use the arrow keys)" value={cur.p * 100} min={0} max={99.9} step={0.1} unit="%" onChange={(v) => setMounts((ms) => ms.map((q, j) => (j === sel ? { ...q, p: v / 100 } : q)))} />
                </>
              )}
              {stage >= 2 && (
                <>
                  <details className="more" onToggle={(e) => setBodyOpen(e.currentTarget.open)}>
                    <summary>Body: mass, inertia, size</summary>
                    {/* rendered only once opened: nothing in a closed <details> is visible */}
                    {bodyOpen && (
                      <div className="more-body">
                        <Slider label="mass" tex="m" tip="mass of the rigid body (kg)" value={m} min={preset.body.m / 10} max={preset.body.m * 10} log unit="kg" onChange={(v) => setB({ m: v })} />
                        <Slider label="inertia about G" tex="I_G" tip="mass moment of inertia about G (kg m²)" value={I} min={preset.body.I / 10} max={preset.body.I * 10} log unit="kg m²" onChange={(v) => setB({ I: v })} />
                        <Slider label="width" tex="w" tip="block width (m)" value={w} min={0.4} max={6} step={0.05} unit="m" onChange={(v) => setB({ w: v })} />
                        <Slider label="height" tex="h" tip="block height (m)" value={h} min={0.4} max={6} step={0.05} unit="m" onChange={(v) => setB({ h: v })} />
                        <Button size="sm" onClick={() => setB({ gu: 0, gv: 0, I: (m * (w * w + h * h)) / 12 })}>
                          Uniform block: G central, I = m(w² + h²)/12
                        </Button>
                      </div>
                    )}
                  </details>
                  <Readouts>
                    {modes.map((md, i) => (
                      <Readout key={i} tex={`f_${i + 1}`} tip={`mode ${i + 1} natural frequency (ω = ${fmt(md.omega, 4)} rad/s)`} value={md.omega / TAU} unit="Hz" tone={(['m1', 'm2', 'm3'] as const)[i]} />
                    ))}
                    <Readout tex="\bar y" tip="height of the horizontal-stiffness resultant above G: K_xθ = −(Σkx)·ȳ" value={centres.ybar} unit="m" text={Number.isFinite(centres.ybar) ? undefined : 'no kₓ'} />
                    <Readout tex="\bar x" tip="position of the vertical-stiffness centre right of G: K_yθ = (Σky)·x̄" value={centres.xbar} unit="m" text={Number.isFinite(centres.xbar) ? undefined : 'no k_y'} />
                  </Readouts>
                  <Badge tone={decoupled ? 'ok' : 'warn'}>{decoupled ? '✓ K is diagonal: three independent motions' : `${[cpl(0, 1) && 'sway–bounce', cpl(0, 2) && 'sway–rock', cpl(1, 2) && 'bounce–rock'].filter(Boolean).join(', ')} coupled`}</Badge>
                </>
              )}
            </>
          )
        }
        below={
          stage >= 3 && (
            <div className="stack">
              <div className="row gap-s wrap" style={{ alignItems: 'flex-start' }}>
                <div style={{ minWidth: 0 }}>
                  <div className="row gap-s wrap">
                    <span className="muted small">Coordinates at:</span>
                    <Segmented
                      size="sm"
                      label="Coordinate origin"
                      value={coords}
                      onChange={setCoords}
                      options={[
                        { value: 'G', label: 'G (exam method)' },
                        { value: 'mount', label: 'mount level (reader LA7)' },
                      ]}
                    />
                  </div>
                  <MatrixView A={shown.K} labels={coords === 'G' ? ['x', 'y', '\\theta'] : ['x_1', 'y', '\\theta']} name="K" scale={unit} sig={4} unit={`K in ${uName}/m, ${uName}/rad, ${uName} m/rad; highlighted = coupling term`} />
                  <MatrixView A={shown.M} labels={coords === 'G' ? ['x', 'y', '\\theta'] : ['x_1', 'y', '\\theta']} name="M" sig={4} unit="M in kg and kg m²" />
                </div>
                <div style={{ flex: '1 1 260px', minWidth: 0 }}>
                  {coords === 'G' ? (
                    <ul className="small" style={{ paddingLeft: '1.2em', margin: '4px 0' }}>
                      {explain.map((s, i) => (
                        <li key={i}>
                          <Rich text={s} inline />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <Callout kind="info" title="Same body, origin moved">
                      <Rich
                        text={`Here $x_1 = x + h\\theta$ is the sway at the height of the horizontal-stiffness resultant, $h$ = ${fmt(hLevel, 3)} m below G. The sway–rock coupling has moved from $K$ into $M$ ($M_{x_1\\theta} = -mh$ = ${fmt(-m * hLevel, 4)} kg m) and $I$ became $I_G + mh^2$. The natural frequencies are exactly the same (official 2018 A1.4; LA7 Eq 7.4).`}
                      />
                    </Callout>
                  )}
                </div>
              </div>
              <table className="table small" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Mode</th>
                    <th>f (Hz)</th>
                    <th>shape</th>
                    <th>energy x / y / θ</th>
                  </tr>
                </thead>
                <tbody>
                  {modes.map((md, i) => {
                    const e = energySplit(md.vec, m, I);
                    return (
                      <tr key={i}>
                        <td>
                          <Button size="sm" variant={mode === i ? 'primary' : 'ghost'} onClick={() => setMode(i)}>
                            <span style={{ color: mode === i ? undefined : MODE_VAR[i], fontWeight: 650 }}>{i + 1}</span>
                          </Button>
                        </td>
                        <td>
                          {md.omega > 1e-6 ? fmt(md.omega / TAU, 4) : '0 (free)'}
                          <div className="muted">{fmtU(md.omega, 'rad/s', 4)}</div>
                        </td>
                        <td>{describeCentre(md.vec, m, I, size)}</td>
                        <td>{e.map((x) => `${Math.round(x * 100)} %`).join(' / ')}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <Rich
                className="note"
                text={`Isolation check (LA7 p47): the highest rigid-body mode is ${fmt(fmax, 3)} Hz, so the running speed should be at least ${fmt(2 * fmax, 3)} Hz (${fmt(120 * fmax, 4)} rpm) for every mode to be isolated.`}
              />
              <Callout kind="info" title={`Challenge: ${done ? 'complete ✓' : 'fully decouple the 2024 box'}`}>
                <Rich text="Load the **2024 box** preset and make $K$ diagonal (all three motions independent) by **moving mounts only**: no stiffness, body or mount-count changes. Hint: where must the horizontal stiffness act, and where must the vertical stiffness be centred?" />
                <div className="row gap-s wrap" style={{ marginTop: 6 }}>
                  {presetId !== 'box2024' || edited ? (
                    <Button size="sm" onClick={() => load('box2024')}>
                      Reset to the 2024 box
                    </Button>
                  ) : null}
                  <Button size="sm" variant="primary" disabled={!solved || done} onClick={() => completeChallenge(DECOUPLE_CHALLENGE)}>
                    {done ? '✓ Challenge complete' : solved ? 'Submit this layout' : 'Not decoupled yet'}
                  </Button>
                </div>
                {solved && !done && <Rich className="note" text="Decoupled: the horizontal stiffness now acts through G and the vertical stiffness is centred under it." />}
              </Callout>
            </div>
          )
        }
      />
      {stage >= 4 && (
        <>
          <PredictReveal
            id="a5-mounts-straddle"
            question="2024 box: the **uncoupled** sway and rock frequencies are $\sqrt{K_{xx}/m}$ = 282.8 rad/s and $\sqrt{K_{\theta\theta}/I_z}$ = 300 rad/s. Where are the two coupled sway–rock frequencies?"
            options={['Both between 282.8 and 300 rad/s', 'Close to 282.8 and 300 rad/s', 'One below 282.8 and one above 300 rad/s', 'Both below 282.8 rad/s']}
            answer={2}
            explain="Coupling pushes the pair apart: 69.6 and 406.4 rad/s (11.1 and 64.7 Hz), either side of both uncoupled values (2024 A2.4). Mode 1 turns about a point 1.51 m below G, just under the base; mode 3 about a point 1.33 m above G. Their heights multiply to $-I_z/m$ = −2 m²."
            tryIt="load the 2024 box and compare f₁ and f₃ with the uncoupled values."
            onApply={() => {
              load('box2024');
              setMode(0);
            }}
          />
          <PredictReveal
            id="a5-mounts-raise"
            question="2017 machine (springs 0.5 m below G). Move **both** ends up the sides to the height of G. Which coupling disappears?"
            options={['Sway–rock, $K_{x\\theta}$', 'Bounce–rock, $K_{y\\theta}$', 'Both', 'Neither']}
            answer={0}
            explain="$K_{x\theta} = -\sum k_{x,i}y_i = 0$ once the horizontal stiffness acts through G: sway becomes an SDOF with $\omega^2 = 2k_x/m$ (official 2017 A2(c)). $K_{y\theta} = k_y(c - b)$ stays, because G is off-centre ($b$ = 1.35 m, $c$ = 1.05 m). Drag G sideways to the middle of the block, then re-snap both mounts to its height ($a = 0$ and $b = c$): the last coupling vanishes too (2017 A2(d))."
            tryIt="load the 2017 preset, then drag both mounts up the sides until they snap to G’s height."
            onApply={() => {
              load('machine2017-raised');
              setMode(0);
            }}
          />
          <PredictReveal
            id="a5-mounts-fifth"
            question="2024 box: add a fifth spring under the right-hand bottom corner. Which new off-diagonal term appears?"
            options={['$K_{xy}$', '$K_{y\\theta}$', 'None: the frequencies just rise']}
            answer={1}
            explain="$K'_{y\theta} = k_ya$ = 10 MN/rad: the vertical stiffness centre moves to $\bar x = a/5$ = 0.4 m. Bounce now couples with rock and, through rock, with sway, so all three couple: 79.3, 115.8 and 455.9 rad/s (2024 A2.5). $K_{xy}$ stays 0 because every spring is upright."
            tryIt="switch to the five-spring preset and watch x̄ and the K matrix."
            onApply={() => {
              load('box2024-5');
              setMode(1);
            }}
          />
          <PredictReveal
            id="a5-mounts-cabinet"
            question="Wall cabinet: can you decouple **bounce** by sliding the anchors up or down the wall?"
            options={['Yes, by making $a = b$', 'Yes, by moving the upper anchor above the top', 'No: $K_{y\\theta} = k_yc$, and $c$ is fixed by the wall']}
            answer={2}
            explain="Moving the anchors along the wall changes only $K_{x\theta} = k_x(b - a)$: with $a = b$ sway decouples. $K_{y\theta} = k_yc$ needs the vertical support under G, which a wall mount cannot give (2022 A1.5)."
            tryIt="load the cabinet with a = b: sway is pure, but bounce and rock still couple."
            onApply={() => {
              load('cabinet2022-ab');
              setMode(0);
            }}
          />
        </>
      )}
      {stage >= 5 && (
        <>
          <PredictReveal
            id="a5-mounts-tilt"
            question="Tilt one bottom mount of the 2017 machine by 30°. Which entry, zero for every upright layout, becomes non-zero?"
            options={['$K_{xy}$', '$K_{yy}$', '$M_{12}$']}
            answer={0}
            explain="An inclined isolator has $k_{xy} = (k_1 - k_2)\sin\varphi\cos\varphi \ne 0$ (LA7 Eq 7.11), so $K_{xy} \ne 0$: a vertical force now moves the machine sideways, and vice versa (official 2018 A1.3(b)). $M$ never changes with the mounts."
            tryIt="select a mount and move the tilt slider."
            onApply={() => {
              load('machine2017');
              setMounts((ms) => ms.map((q, j) => (j === 1 ? { ...q, phi: 30 } : q)));
              setSel(1);
              setEdited(true);
            }}
          />
          <PredictReveal
            id="a5-mounts-coords"
            question="2024 box: switch to coordinates at **mount level**. What happens to the natural frequencies?"
            options={['They all change', 'Only the coupled pair changes', 'Nothing: the coupling moves from K into M']}
            answer={2}
            explain="With $x_1 = x + c\theta$ the mounts’ shear is just $x_1$, so $K$ loses $K_{x\theta}$, but G now moves $x_1 - c\theta$ and $M$ gains $M_{x_1\theta} = -mc$. The physics is unchanged, so the frequencies are identical (official 2018 A1.4: four of its five forms are equivalent)."
            tryIt="toggle the coordinate origin under the matrices."
            onApply={() => {
              load('box2024');
              setCoords('mount');
            }}
          />
        </>
      )}
    </div>
  );
}
