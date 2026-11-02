// LA7 Eq 7.8–7.9 (handout Fig 2.11): a uniform body on springs at its four lower corners. The two coupled
// sway–rock frequencies as multiples of the bounce frequency ωy = √(4ky/m), against a/b (a = height of G
// above the spring plane, b = half the spring spacing), for U = kx/ky. Week 5 Q2 (rank the cuboid's modes)
// is overlaid. Static: curves are sampled in useMemo, nothing runs per frame.
import { useMemo, useState } from 'react';
import { Dot, HLine, Handle, Line, Plot, PlotText, VLine, sample } from '../../../plot/Plot';
import { Ground, Spring } from '../../../ui/diagrams';
import { Badge, Button, Readout, Readouts, SimLayout, Slider } from '../../../ui/kit';
import { PredictReveal } from '../../../ui/PredictReveal';
import { Rich } from '../../../ui/Rich';
import { fmt } from '../../../engine/format';
import { eq78, eq78Centre } from '../physics';
import { LineKey } from './LineKey';
import { useStaged } from './useStaged';

const AB_MAX = 2;
const FAMILY = [0.25, 0.5, 1, 2]; // the handout chart's curves
const MODE_VAR = ['var(--m1)', 'var(--m2)', 'var(--m3)'];
const HALO = { paintOrder: 'stroke', stroke: 'var(--surface)', strokeWidth: 4, strokeLinejoin: 'round' } as const;

/** ω/ωy of the lower and upper coupled sway–rock modes (LA7 Eq 7.8 with V = 1 + (a/b)²). */
function ratios(U: number, ab: number): [number, number] {
  const [lo, up] = eq78(U, 1 + ab * ab);
  return [Math.sqrt(lo), Math.sqrt(up)];
}

/** Share of a coupled mode's kinetic energy in translation: h_G²/(h_G² + ρ²), with ρ² = (a² + b²)/3 for the uniform body. */
function swayShare(hAboveSprings: number, ab: number): number {
  if (!Number.isFinite(hAboveSprings)) return 1;
  const hG = hAboveSprings - ab;
  const rho2 = (ab * ab + 1) / 3;
  return (hG * hG) / (hG * hG + rho2);
}

// Week 5 cuboid (U = 0.5): XY plane a/b = 1, YZ plane a/c = 0.5. Tags sit above each point, clear of the curves.
const WEEK5 = [
  { ab: 1, r: 0.55408, tag: 'XY' },
  { ab: 0.5, r: 0.65864, tag: 'YZ' },
  { ab: 1, r: 1.56301, tag: 'XY' },
  { ab: 0.5, r: 1.66319, tag: 'YZ' },
];

export default function CornerChart() {
  // Opening the page: the chart first, then the controls (stage 1), the notes (stage 2) and the
  // predict-then-reveal questions (stage 3), each in its own short task.
  const stage = useStaged(3);
  const [U, setU] = useState(0.5);
  const [ab, setAb] = useState(1);
  const [week5, setWeek5] = useState(true);
  const showW5 = week5 && Math.abs(U - 0.5) < 1e-9;

  const family = useMemo(
    () =>
      FAMILY.map((u) => ({
        U: u,
        lo: sample((x) => ratios(u, x)[0], 0, AB_MAX, 160),
        up: sample((x) => ratios(u, x)[1], 0, AB_MAX, 160),
        upEnd: ratios(u, AB_MAX)[1],
      })),
    []
  );
  const cur = useMemo(() => ({ lo: sample((x) => ratios(U, x)[0], 0, AB_MAX, 240), up: sample((x) => ratios(U, x)[1], 0, AB_MAX, 240) }), [U]);

  const [rLo, rUp] = ratios(U, ab);
  const V = 1 + ab * ab;
  // Mode numbers and colours follow frequency order (mode 1 = lowest), as everywhere in the app.
  const order = [
    { key: 'lo', r: rLo },
    { key: 'y', r: 1 },
    { key: 'up', r: rUp },
  ].sort((p, q) => p.r - q.r);
  const rank = (key: string) => order.findIndex((o) => o.key === key);
  const col = (key: string) => MODE_VAR[rank(key)];
  const hLo = eq78Centre(U, ab, rLo);
  const hUp = eq78Centre(U, ab, rUp);
  const sLo = swayShare(hLo, ab);
  const sUp = swayShare(hUp, ab);
  const describe = (h: number, share: number) => {
    if (!Number.isFinite(h)) return 'pure sway (no rotation)';
    if (Math.abs(h - ab) < 1e-6) return 'pure rock about G';
    const where = Math.abs(h) < 1e-6 ? 'on the spring plane' : `${fmt(Math.abs(h), 3)} $b$ ${h < 0 ? 'below' : 'above'} the springs`;
    return `rotation about a point ${where} (${Math.round(share * 100)} % of its kinetic energy in sway: ${share > 0.5 ? 'sway-dominated' : 'rock-dominated'})`;
  };

  // ---- schematic: body 2b wide, 2a tall (uniform, G at mid-height), springs at the lower corners
  const S = 46; // px per b
  const Y0 = 236; // spring plane
  const CXs = 150;
  const top = Y0 - Math.max(4, 2 * ab * S);
  const gY = Y0 - ab * S;
  const centreMark = (h: number, key: string, label: string) => {
    const c = col(key);
    if (!Number.isFinite(h)) {
      return (
        <text x={10} y={key === 'lo' ? 18 : 34} className="plot-note" fill={c} style={HALO}>
          {label}: pure sway, no centre
        </text>
      );
    }
    const y = Y0 - h * S;
    if (y < 12 || y > 312) {
      const up = y < 12;
      return (
        <text x={CXs} y={up ? 12 : 320} textAnchor="middle" className="plot-note" fill={c} style={{ ...HALO, fontWeight: 650 }}>
          {up ? '↑' : '↓'} {label} centre: {fmt(Math.abs(h), 3)} b {up ? 'above' : 'below'} the springs (off view)
        </text>
      );
    }
    const right = key === 'up';
    return (
      <g>
        <circle cx={CXs} cy={y} r={6} fill="none" stroke={c} strokeWidth={2.2} />
        <path d={`M${CXs - 10} ${y}H${CXs + 10}M${CXs} ${y - 10}V${y + 10}`} stroke={c} strokeWidth={1.5} />
        <text x={CXs + (right ? 14 : -14)} y={y + 4} textAnchor={right ? 'start' : 'end'} className="plot-note" fill={c} style={{ ...HALO, fontWeight: 650 }}>
          {label} centre
        </text>
      </g>
    );
  };

  return (
    <div>
      <SimLayout
        visual={
          <>
            <Plot x={{ min: 0, max: AB_MAX, label: 'a / b  (height of G above the springs ÷ half the spring spacing)' }} y={{ min: 0, max: 3.2, label: 'ω ÷ bounce frequency' }} height={330} ariaLabel="Coupled sway–rock frequencies as multiples of the bounce frequency against a over b">
              {family
                .filter((f) => Math.abs(f.U - U) > 1e-9)
                .map((f) => (
                  <g key={f.U}>
                    <Line points={f.lo} color="var(--text-3)" width={1.1} />
                    <Line points={f.up} color="var(--text-3)" width={1.1} />
                    <PlotText x={AB_MAX} y={f.upEnd} anchor="end" dy={-5} color="var(--text-3)">
                      U = {f.U}
                    </PlotText>
                  </g>
                ))}
              <HLine y={1} color="var(--text-2)" label="bounce" />
              <Line points={cur.lo} color="var(--text)" width={2.4} />
              <Line points={cur.up} color="var(--text)" width={2.4} dash="7 4" />
              <VLine x={ab} color="var(--accent)" dash={false} width={1.2} />
              {showW5 &&
                WEEK5.map((p, i) => (
                  <Dot key={i} x={p.ab} y={p.r} r={6.5} color="var(--text-2)" hollow label={p.tag} labelPos="above" />
                ))}
              <Dot x={ab} y={rLo} color={col('lo')} />
              <Dot x={ab} y={1} color={col('y')} />
              <Dot x={ab} y={rUp} color={col('up')} />
              <Handle x={ab} y={0.16} axis="x" clampX={[0, AB_MAX]} onChange={(x) => setAb(Math.round(x * 100) / 100)} ariaLabel="a over b (drag)" />
            </Plot>
            <LineKey
              items={[
                { label: `lower coupled mode, U = ${fmt(U, 3)}`, color: 'var(--text)', width: 2.4 },
                { label: 'upper coupled mode', color: 'var(--text)', width: 2.4, dash: '7 4' },
                { label: 'handout family U = 0.25, 0.5, 1, 2', color: 'var(--text-3)', width: 1.1 },
                { label: 'current a/b (drag the handle)', color: 'var(--accent)', width: 1.4 },
              ]}
            />
            <p className="muted small">
              Dots at the current a/b are coloured as modes 1, 2, 3 in order of frequency. Hollow dots: the Week 5 cuboid (U = 0.5), whose XY plane has a/b = 1 and YZ plane a/c = 0.5.
            </p>
          </>
        }
        controls={
          stage >= 1 && (
            <>
              <Slider label="shear / vertical stiffness" tex="U" tip="U = kx/ky, the ratio of each mount's horizontal (shear) to vertical stiffness" value={U} min={0.1} max={2.5} log sig={3} onChange={setU} />
              <Slider label="G height / half-spacing" tex="a/b" tip="a = height of G above the spring plane (half the body height for this uniform body); b = half the spring spacing" value={ab} min={0} max={AB_MAX} step={0.01} onChange={setAb} />
              <div className="row gap-s wrap">
                <Button size="sm" onClick={() => { setU(0.5); setAb(1); setWeek5(true); }}>
                  Week 5 cuboid (U = 0.5)
                </Button>
                <Button size="sm" onClick={() => setWeek5((w) => !w)}>
                  {week5 ? 'Hide' : 'Show'} Week 5 points
                </Button>
              </div>
              <svg viewBox="0 0 300 324" className="anim" style={{ maxWidth: 320 }} role="img" aria-label="Uniform body on corner springs with the centres of rotation of the two coupled modes">
                <line x1={20} x2={280} y1={Y0} y2={Y0} stroke="var(--text-3)" strokeDasharray="4 4" />
                <text x={278} y={Y0 - 5} textAnchor="end" className="plot-note">
                  spring plane
                </text>
                {[CXs - S, CXs + S].map((x) => (
                  <g key={x}>
                    <Spring x1={x} y1={Y0} x2={x} y2={Y0 + 34} coils={4} amp={6} />
                    <Ground x={x} y={Y0 + 34} w={34} />
                  </g>
                ))}
                <rect x={CXs - S} y={top} width={2 * S} height={Y0 - top} rx={2} fill="var(--surface-2)" stroke="var(--text-2)" strokeWidth={1.8} />
                <line x1={CXs} x2={CXs} y1={14} y2={316} stroke="var(--text-3)" strokeDasharray="2 4" />
                <circle cx={CXs} cy={gY} r={5} fill="var(--surface)" stroke="var(--text)" strokeWidth={1.6} />
                <text x={CXs - 8} y={gY - 7} textAnchor="end" className="diagram-label" style={HALO}>
                  G
                </text>
                {centreMark(hLo, 'lo', `mode ${rank('lo') + 1}`)}
                {centreMark(hUp, 'up', `mode ${rank('up') + 1}`)}
              </svg>
              <Readouts>
                <Readout tex={`\\omega_{${rank('lo') + 1}}/\\omega_y`} tip="lower coupled sway–rock mode (LA7 Eq 7.8, minus sign)" value={rLo} sig={3} tone={(['m1', 'm2', 'm3'] as const)[rank('lo')]} />
                <Readout tex={`\\omega_{${rank('y') + 1}}/\\omega_y`} tip="bounce: pure vertical translation, ωy = √(4ky/m)" value={1} sig={3} tone={(['m1', 'm2', 'm3'] as const)[rank('y')]} />
                <Readout tex={`\\omega_{${rank('up') + 1}}/\\omega_y`} tip="upper coupled sway–rock mode (LA7 Eq 7.8, plus sign)" value={rUp} sig={3} tone={(['m1', 'm2', 'm3'] as const)[rank('up')]} />
                <Readout tex="V" tip="V = 1 + (a/b)², the shape parameter in Eq 7.8" value={V} sig={3} />
              </Readouts>
              {U > 1 && rLo > 1 ? <Badge tone="warn">bounce is now the lowest mode (stiff shear, squat body)</Badge> : null}
            </>
          )
        }
        below={
          stage >= 2 && (
            <div className="stack">
              <Rich
                className="note"
                text={`$$\\Big(\\frac{\\omega_n}{\\omega_y}\\Big)^2 = \\tfrac12\\Big\\{\\Big[4U+\\tfrac{3(1-U)}{V}\\Big] \\mp \\sqrt{\\Big[4U+\\tfrac{3(1-U)}{V}\\Big]^2 - \\tfrac{12U}{V}}\\Big\\}, \\qquad U = \\frac{k_x}{k_y},\\quad V = 1 + \\Big(\\frac ab\\Big)^2$$`}
              />
              <ul className="small" style={{ paddingLeft: '1.2em', margin: 0 }}>
                <li>
                  <Rich inline text={`**Mode ${rank('lo') + 1}** (lower coupled, ${fmt(rLo, 3)} $\\omega_y$): ${describe(hLo, sLo)}.`} />
                </li>
                <li>
                  <Rich inline text={`**Mode ${rank('y') + 1}** (bounce, $\\omega_y = \\sqrt{4k_y/m}$): pure vertical translation; the springs are symmetric about G.`} />
                </li>
                <li>
                  <Rich inline text={`**Mode ${rank('up') + 1}** (upper coupled, ${fmt(rUp, 3)} $\\omega_y$): ${describe(hUp, sUp)}.`} />
                </li>
              </ul>
              <Rich
                className="note"
                text="How to use it: $a$ is the height of G above the spring plane and $b$ the **half** spacing; for the other vertical plane use the half spacing $c$ in place of $b$. Read both curves at $a/b$ (or $a/c$) for your $U$ and multiply by $\omega_y$. At $a = 0$ the pair separates into pure sway $\sqrt U\,\omega_y$ and pure rock $\sqrt3\,\omega_y$; the reader's Eq 7.6 (Fig 2.8) is the same result written with $S = (k_x/k_y)(\rho/b)^2$ and $T = (a/\rho)^2$."
              />
            </div>
          )
        }
      />
      {stage >= 3 && (
        <>
          <PredictReveal
            id="a5-chart-squat"
            question="$U$ = 0.5 and $a/b$ = 1. Make the body squatter, $a/b$ = 0.5 (G nearer the spring plane, or the springs further apart). What happens to the two coupled frequencies?"
            options={['Both fall', 'Both rise, towards their $a = 0$ limits $\\sqrt U\\,\\omega_y$ and $\\sqrt3\\,\\omega_y$', 'The lower rises and the upper falls', 'Nothing: only $U$ matters']}
            answer={1}
            explain="0.554 → 0.659 and 1.563 → 1.663 × $\omega_y$. As $a \to 0$ the coupling $4k_xa$ vanishes and the modes become pure sway, $\sqrt U\,\omega_y$ = 0.707 $\omega_y$, and pure rock, $\sqrt3\,\omega_y$: the points where every curve starts on the left. The reader notes there are benefits in mounting the springs further apart (LA7 p47)."
            tryIt="set U = 0.5 and drag a/b from 1 to 0.5."
            onApply={() => {
              setU(0.5);
              setAb(0.5);
            }}
          />
          <PredictReveal
            id="a5-chart-week5"
            question="Week 5 cuboid: 1 m (X) × 1 m (Y, up) × 2 m (Z), isolators exactly at the lower corners, $k_x/k_y = k_z/k_y$ = 0.5. Which in-plane mode has the lowest frequency?"
            options={['Bounce', 'The lower coupled mode in the XY plane', 'The lower coupled mode in the YZ plane', 'The upper coupled mode in the XY plane']}
            answer={1}
            explain="Use half-dimensions: $a$ = 0.5 m, $b$ = 0.5 m, $c$ = 1 m. XY plane: $a/b$ = 1 gives 0.554 $\omega_y$; YZ plane: $a/c$ = 0.5 gives 0.659 $\omega_y$; then bounce (1), 1.563 and 1.663. Soft shear ($U < 1$) puts both sway-dominated modes below bounce (Week 5 Q2)."
            tryIt="press Week 5 cuboid and compare the hollow dots."
            onApply={() => {
              setU(0.5);
              setAb(1);
              setWeek5(true);
            }}
          />
          <PredictReveal
            id="a5-chart-a0"
            question="$U$ = 0.5. Lower G all the way to the spring plane ($a \to 0$). What are the two sway–rock modes now?"
            options={['Pure sway at $\\sqrt U\\,\\omega_y$ and pure rock at $\\sqrt3\\,\\omega_y$', 'Still coupled, at 0.554 and 1.563 $\\omega_y$', 'Both equal to the bounce frequency']}
            answer={0}
            explain="With $a = 0$ the horizontal springs act through G, so $K_{x\theta} = 4k_xa = 0$. Sway: $\omega^2 = 4k_x/m$, i.e. $\sqrt U\,\omega_y$ = 0.707 $\omega_y$. Rock about G with $I = mb^2/3$ for this flat uniform body: $\omega^2 = 4k_yb^2/I = 12k_y/m$, i.e. $\sqrt3\,\omega_y$. (At $U$ = 3 the two would coincide: the reader's $S = 1$ case.)"
            tryIt="drag the handle to a/b = 0."
            onApply={() => {
              setU(0.5);
              setAb(0);
            }}
          />
        </>
      )}
    </div>
  );
}
