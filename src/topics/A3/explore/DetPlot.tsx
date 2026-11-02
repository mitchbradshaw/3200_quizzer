// The frequency equation as a curve: det(K − λM) against λ = ω². Its roots are the natural frequencies (squared).
// Drag a trial λ and compare the mode ratio that row 1 and row 2 of (K − λM)A = 0 each predict: they agree only at a root.
import { useMemo, useState } from 'react';
import { Dot, Handle, HLine, Line, Plot, VLine, sample } from '../../../plot/Plot';
import { Badge, Button, Legend, Readout, Readouts, SimLayout, Slider } from '../../../ui/kit';
import { PredictReveal } from '../../../ui/PredictReveal';
import { Rich } from '../../../ui/Rich';
import { fmt, tex } from '../../../engine/format';
import { chainKM, det2, quadCoeffs, rowRatios, twoDof } from '../physics';

type Sys = { m1: number; m2: number; k1: number; k2: number; k3: number };
const PRESETS: Record<string, Sys & { label: string }> = {
  equal: { m1: 1, m2: 1, k1: 400, k2: 400, k3: 0, label: 'Equal, free top' },
  fixed: { m1: 1, m2: 1, k1: 400, k2: 400, k3: 400, label: 'Fixed both ends' },
  weak: { m1: 1, m2: 1.5, k1: 400, k2: 20, k3: 300, label: 'Weak coupling' },
  free: { m1: 1, m2: 1, k1: 0, k2: 400, k3: 0, label: 'Free–free' },
};
const SUP: Record<string, string> = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
const sup = (n: number) => String(n).replace(/[-0-9]/g, (c) => SUP[c]);

/** Two little arrow pairs: the shape [1, r] that one row of (K − λM)A = 0 predicts (arrow length ∝ amplitude). */
function RowShapes({ r1, r2, color }: { r1: number; r2: number; color: string }) {
  const arrow = (x: number, y: number, a: number) => {
    const L = Math.max(-2.2, Math.min(2.2, a)) * 22;
    if (!Number.isFinite(L) || Math.abs(L) < 1) return <circle cx={x} cy={y} r={3} fill={color} />;
    const s = Math.sign(L);
    return (
      <g stroke={color} fill={color} strokeWidth={2.6}>
        <line x1={x} y1={y} x2={x} y2={y - L + s * 7} />
        <path d={`M${x} ${y - L} l-6 ${s * 9} h12 z`} stroke="none" />
      </g>
    );
  };
  const lab = (r: number) => (Number.isFinite(r) ? fmt(r, 3) : '∞');
  return (
    <svg viewBox="0 0 300 200" className="anim" style={{ maxWidth: 330 }} role="img" aria-label={`Row 1 predicts the mode shape 1 to ${lab(r1)}; row 2 predicts 1 to ${lab(r2)}`}>
      {[
        { y: 58, r: r1, t: 'row 1 says' },
        { y: 152, r: r2, t: 'row 2 says' },
      ].map((row) => (
        <g key={row.t}>
          <line x1={112} x2={290} y1={row.y} y2={row.y} stroke="var(--border)" />
          <text x={4} y={row.y + 5} className="plot-note" style={{ fontSize: 15 }}>
            {row.t}
          </text>
          {arrow(150, row.y, 1)}
          {arrow(240, row.y, row.r)}
          <text x={150} y={row.y + 40} textAnchor="middle" className="plot-note" style={{ fontSize: 13 }}>
            m₁: 1
          </text>
          <text x={240} y={row.y + 40} textAnchor="middle" className="plot-note" style={{ fontSize: 13 }}>
            {`m₂: ${lab(row.r)}`}
          </text>
        </g>
      ))}
    </svg>
  );
}

/** "aλ² − bλ + c" with a coefficient of 1 left out. */
const quadTeX = (a: number, b: number, c: number) => `${Math.abs(a - 1) < 1e-12 ? '' : tex(a, 4)}\\lambda^2 - ${tex(b, 4)}\\lambda + ${tex(c, 4)}`;

export default function DetPlot() {
  const [p, setP] = useState<Sys>(PRESETS.equal);
  const [lam, setLam] = useState(300);
  const set = (key: keyof Sys) => (v: number) => setP((q) => ({ ...q, [key]: v }));

  const d = useMemo(() => {
    const { K, M } = chainKM(p.m1, p.m2, p.k1, p.k2, p.k3);
    const s = twoDof(K, M);
    const q = quadCoeffs(K, M);
    const u1 = K[0][0] / M[0][0];
    const u2 = K[1][1] / M[1][1];
    const lamMax = 1.25 * Math.max(s.omega2[1], u1, u2);
    const vertex = q.b / (2 * q.a);
    const pMin = q.c - (q.b * q.b) / (4 * q.a);
    const pMax = Math.max(q.c, det2(K, M, lamMax));
    const e = Math.floor(Math.log10(Math.max(Math.abs(pMin), Math.abs(pMax), 1e-9)));
    const scale = Math.pow(10, e);
    const curve = sample((l) => det2(K, M, l) / scale, 0, lamMax, 240);
    return { K, M, s, q, u1, u2, lamMax, vertex, yMin: (pMin / scale) * 1.15, yMax: (pMax / scale) * 1.1, e, scale, curve };
  }, [p]);

  const l = Math.min(Math.max(0, lam), d.lamMax);
  const pv = det2(d.K, d.M, l);
  const rr = rowRatios(d.K, d.M, l);
  const agree = Math.abs(rr.row1 - rr.row2) <= 0.02 * Math.max(1, Math.abs(rr.row1), Math.abs(rr.row2));
  const nearRoot = d.s.omega2.findIndex((w2) => Math.abs(w2 - l) <= 0.006 * d.lamMax);
  const shapeColor = agree && nearRoot >= 0 ? `var(--m${nearRoot + 1})` : 'var(--accent)';

  const preset = (k: keyof typeof PRESETS) => setP(PRESETS[k]);

  return (
    <div>
      <SimLayout
        visual={
          <>
            <Plot
              x={{ min: 0, max: d.lamMax, label: 'trial λ = ω² (rad²/s²)' }}
              y={{ min: d.yMin, max: d.yMax, label: `det(K − λM) (×10${sup(d.e)} N²/m²)` }}
              height={300}
              ariaLabel="The frequency determinant against omega squared; its roots are the natural frequencies squared"
            >
              <HLine y={0} dash={false} color="var(--text-2)" width={1.2} />
              <VLine x={d.u1} label="k₁₁/m₁₁" labelY="bottom" />
              <VLine x={d.u2} label="k₂₂/m₂₂" labelY={Math.abs(d.u2 - d.u1) < 0.08 * d.lamMax ? 'top' : 'bottom'} />
              <Line points={d.curve} color="var(--text)" width={2.4} />
              <Dot x={d.s.omega2[0]} y={0} r={6} color="var(--m1)" label="ω₁²" labelPos="above" />
              <Dot x={d.s.omega2[1]} y={0} r={6} color="var(--m2)" label="ω₂²" labelPos="above" />
              <Handle x={l} y={pv / d.scale} axis="x" clampX={[0, d.lamMax]} onChange={(x) => setLam(x)} color="var(--accent)" label="trial ω²" ariaLabel="Trial value of omega squared" />
            </Plot>
            <Legend
              items={[
                { label: 'det(K − λM)', color: 'var(--text)' },
                { label: 'uncoupled k₁₁/m₁₁, k₂₂/m₂₂', color: 'var(--text-3)', dash: true },
              ]}
            />
            <Rich
              className="note"
              text={`$\\det(K-\\lambda M) = ${quadTeX(d.q.a, d.q.b, d.q.c)}$ (N²/m²): a parabola that starts at $\\det K$ (zero only if nothing holds the system) and dips below zero between the two roots.`}
            />
          </>
        }
        controls={
          <>
            <Readouts>
              <Readout tex="\omega" tip="trial frequency √λ" value={Math.sqrt(l)} unit="rad/s" />
              <Readout tex="r_{\text{row 1}}" tip="ratio A₂/A₁ that row 1 predicts: −(k₁₁ − λm₁₁)/(k₁₂ − λm₁₂)" value={rr.row1} sig={3} />
              <Readout tex="r_{\text{row 2}}" tip="ratio A₂/A₁ that row 2 predicts: −(k₂₁ − λm₂₁)/(k₂₂ − λm₂₂)" value={rr.row2} sig={3} />
            </Readouts>
            <Rich className="note" text={`At the trial point $\\det(K-\\lambda M) = ${tex(pv, 3)}$ N²/m².`} />
            <Badge tone={agree ? 'ok' : 'warn'}>{agree ? `✓ rows agree: ω = ${fmt(Math.sqrt(l), 4)} rad/s is a natural frequency` : '✗ rows disagree: not a natural frequency'}</Badge>
            <RowShapes r1={rr.row1} r2={rr.row2} color={shapeColor} />
            <div className="row gap-s wrap">
              <Button size="sm" onClick={() => setLam(d.s.omega2[0])}>
                Snap to ω₁²
              </Button>
              <Button size="sm" onClick={() => setLam(d.s.omega2[1])}>
                Snap to ω₂²
              </Button>
            </div>
            <Readouts>
              <Readout tex="\omega_1" tip="lower root, √λ₁" value={d.s.omega[0]} unit="rad/s" tone="m1" />
              <Readout tex="\omega_2" tip="higher root, √λ₂" value={d.s.omega[1]} unit="rad/s" tone="m2" />
            </Readouts>
            <Slider label="lower mass" tex="m_1" tip="mass on the ground spring (kg)" value={p.m1} min={0.5} max={5} step={0.1} unit="kg" onChange={set('m1')} />
            <Slider label="upper mass" tex="m_2" tip="outer mass (kg)" value={p.m2} min={0.5} max={5} step={0.1} unit="kg" onChange={set('m2')} />
            <Slider label="ground spring" tex="k_1" tip="wall to m₁ (N/m)" value={p.k1} min={0} max={1000} step={10} unit="N/m" onChange={set('k1')} />
            <Slider label="coupling spring" tex="k_2" tip="between the masses (N/m)" value={p.k2} min={2} max={1000} step={2} unit="N/m" onChange={set('k2')} />
            <Slider label="outer spring" tex="k_3" tip="m₂ to the right wall (N/m)" value={p.k3} min={0} max={1000} step={10} unit="N/m" onChange={set('k3')} />
            <div className="row gap-s wrap">
              <span className="muted small">Presets:</span>
              {(Object.keys(PRESETS) as (keyof typeof PRESETS)[]).map((k) => (
                <Button key={k} size="sm" onClick={() => preset(k)}>
                  {PRESETS[k].label}
                </Button>
              ))}
            </div>
          </>
        }
      />
      <PredictReveal
        id="a3-det-uncoupled"
        question="At $\lambda = k_{11}/m_{11}$ (the frequency² of $m_1$ with $m_2$ held still), is $\det(K-\lambda M)$ positive, zero or negative?"
        options={['Positive', 'Zero', 'Negative']}
        answer={2}
        explain="At $\lambda = k_{11}/m_{11}$ the first bracket vanishes, leaving $-(k_{12}-\lambda m_{12})^2 = -k_2^2 < 0$. The parabola is positive at $\lambda = 0$ and for large $\lambda$, so one root lies below $k_{11}/m_{11}$ and one above. The same holds at $k_{22}/m_{22}$: coupling always pushes the two natural frequencies apart."
        tryIt="drag the trial point onto the k₁₁/m₁₁ line."
        onApply={() => setLam(d.u1)}
      />
      <PredictReveal
        id="a3-det-weak"
        question="Keep $k_3 > 0$ and make the coupling spring $k_2$ tiny. Where do the two roots go?"
        options={['They merge into one root', 'Onto the uncoupled values k₁₁/m₁₁ and k₂₂/m₂₂', 'Both move to zero']}
        answer={1}
        explain="$\det = (k_{11}-\lambda m_1)(k_{22}-\lambda m_2) - k_2^2$: as $k_2 \to 0$ the last term vanishes and the roots become $k_{11}/m_1$ and $k_{22}/m_2$, two independent SDOF systems. Stronger coupling pushes them further apart."
        tryIt="press “Weak coupling” and compare the dots with the dashed lines; then raise k₂."
        onApply={() => preset('weak')}
      />
      <PredictReveal
        id="a3-det-free"
        question="Set $k_1 = k_3 = 0$ so nothing holds the masses. What happens to the curve at $\lambda = 0$?"
        options={['It passes through zero: a root at ω = 0', 'It becomes a straight line', 'Nothing special happens there']}
        answer={0}
        explain="The curve starts at $\det K$, and $\det K = 0$ for an unrestrained system, so $\omega = 0$ is a root: the rigid-body mode (both masses move together, no spring stretched). The other root is $k_2(1/m_1 + 1/m_2)$."
        tryIt="press “Free–free” and look at the left end of the curve."
        onApply={() => {
          preset('free');
          setLam(0);
        }}
      />
    </div>
  );
}
