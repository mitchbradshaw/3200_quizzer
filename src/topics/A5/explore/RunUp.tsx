// Range hood on three wall mounts (2025 A2): the fan runs up through the rigid-body resonances.
// Shows |X|, |Y|, |Θ| (or the force transmitted to the wall) against speed, the y anti-resonance,
// and an isolation check of every mode against the running speed (LA7 p47: run at ≥ 2× the highest mode).
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRaf } from '../../../anim/hooks';
import { springPath } from '../../../ui/diagrams';
import { Band, Dot, HLine, Handle, Line, Plot, PlotText, VLine } from '../../../plot/Plot';
import { Badge, Button, Callout, Readout, Readouts, Segmented, SimLayout, Slider } from '../../../ui/kit';
import { LineKey } from './LineKey';
import { useStaged } from './useStaged';
import { PredictReveal } from '../../../ui/PredictReveal';
import { Rich } from '../../../ui/Rich';
import { completeChallenge, useProgress } from '../../../app/store';
import { fmt } from '../../../engine/format';
import { harmonicResponse } from '../../../physics/mdof';
import { planarK } from '../../../physics/rigidbody';
import { cabs, carg, type C } from '../../../physics/complex';
import { blockModes, modalDamping, rangehoodMounts } from '../physics';

export const RUNUP_CHALLENGE = 'a5-isolate-hood';

const TAU = 2 * Math.PI;
const NPLOT = 3600; // rpm, end of the speed axis
const VW = 360;
const VH = 260;
const WALL = 40;
const MODE_VAR = ['var(--m1)', 'var(--m2)', 'var(--m3)'];
const rpm2rad = (n: number) => (n * TAU) / 60;
const rad2rpm = (w: number) => (w * 60) / TAU;

interface Hood {
  kx: number; // N/m per mount (axial)
  q: number; // ky / kx
  s: number;
  d: number;
  m: number;
  I: number;
  mbR: number;
}
const H2025: Hood = { kx: 0.24e6, q: 1 / 3, s: 0.5, d: 0.5, m: 28, I: 15, mbR: 0.02 };

export default function RunUp() {
  const progress = useProgress();
  // Opening the page: the run-up plot first, then the controls and animation (stage 1), the design
  // sliders and challenge (stage 2) and the predict-then-reveal questions (stage 3), each in its own short task.
  const stage = useStaged(3);
  const [hd, setHd] = useState<Hood>(H2025);
  const [N, setN] = useState(900);
  const [zeta, setZeta] = useState(0.02);
  const [view, setView] = useState<'disp' | 'force'>('disp');
  const Nmax = 1200;
  const set = (p: Partial<Hood>) => setHd((o) => ({ ...o, ...p }));
  const { kx, q, s, d, m, I, mbR } = hd;
  const ky = kx * q;

  const sys = useMemo(() => {
    const K = planarK(rangehoodMounts(kx, ky, s, d));
    const M = [
      [m, 0, 0],
      [0, m, 0],
      [0, 0, I],
    ];
    const modes = blockModes(K, M);
    const Cd = modalDamping(K, M, zeta);
    const Wa = Math.sqrt(K[2][2] / I); // y anti-resonance (force on y only)
    return { K, M, modes, Cd, Wa };
  }, [kx, ky, s, d, m, I, zeta]);
  const { K, M, modes, Cd, Wa } = sys;
  const kinds = modes.map((md) => (Math.abs(md.vec[0]) > 0.5 * Math.max(Math.abs(md.vec[1]), 1e-30) ? 'sway x' : 'coupled y–θ'));

  /** Complex amplitudes [X, Y, Θ] for unit-phase force F0 on x and on y (the y component lags 90°). */
  const solveAt = (W: number) => {
    const F0 = mbR * W * W;
    const r = harmonicResponse(K, M, [F0, F0, 0], W, Cd);
    const wall = [0, 1].map((i) => {
      let re = 0;
      let im = 0;
      for (let j = 0; j < 3; j++) {
        re += K[i][j] * r[j].re - W * Cd[i][j] * r[j].im;
        im += K[i][j] * r[j].im + W * Cd[i][j] * r[j].re;
      }
      return Math.hypot(re, im);
    });
    return { F0, r, Tx: F0 > 0 ? wall[0] / F0 : 1, Ty: F0 > 0 ? wall[1] / F0 : 1 };
  };

  const curves = useMemo(() => {
    const n = 600;
    const xs = new Float64Array(n + 1);
    const X = new Float64Array(n + 1);
    const Y = new Float64Array(n + 1);
    const T = new Float64Array(n + 1);
    const Tx = new Float64Array(n + 1);
    const Ty = new Float64Array(n + 1);
    for (let i = 0; i <= n; i++) {
      const Nn = 20 + ((NPLOT - 20) * i) / n;
      const res = solveAt(rpm2rad(Nn));
      xs[i] = Nn;
      X[i] = cabs(res.r[0]) * 1e3;
      Y[i] = cabs(res.r[1]) * 1e3;
      T[i] = cabs(res.r[2]) * 1e3;
      Tx[i] = res.Tx;
      Ty[i] = res.Ty;
    }
    return { X: { x: xs, y: X }, Y: { x: xs, y: Y }, T: { x: xs, y: T }, Tx: { x: xs, y: Tx }, Ty: { x: xs, y: Ty } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sys, mbR]);

  const W = rpm2rad(N);
  const now = solveAt(W);
  const wTop = Math.max(...modes.map((md) => md.omega));
  const isoN = rad2rpm(2 * wTop);
  const yDip = Math.max(1.2e-4, cabs(solveAt(Wa).r[1]) * 1e3); // |Y| at the anti-resonance (mm)
  const bandFrac = (NPLOT - isoN) / NPLOT; // share of the speed axis where every mode is isolated
  const bandLabel = bandFrac > 0.45 ? 'every mode isolated (speed ≥ 2× each)' : bandFrac > 0.1 ? 'isolated' : undefined;
  const is2025 = hd.kx === H2025.kx && hd.q === H2025.q && hd.s === H2025.s && hd.d === H2025.d && hd.m === H2025.m && hd.I === H2025.I;
  const solved = 2 * wTop <= rpm2rad(Nmax) + 1e-9;
  const done = !!progress.challenges[RUNUP_CHALLENGE];
  const verdict = (w: number, Nn: number) => {
    const r = rpm2rad(Nn) / w;
    if (Math.abs(r - 1) < 0.1) return { tone: 'bad' as const, txt: `r = ${fmt(r, 3)}: at resonance` };
    if (r < Math.SQRT2) return { tone: 'bad' as const, txt: `r = ${fmt(r, 3)}: not isolated (T > 1)` };
    if (r < 2) return { tone: 'warn' as const, txt: `r = ${fmt(r, 3)}: isolated, but under the 2× rule` };
    return { tone: 'ok' as const, txt: `r = ${fmt(r, 3)}: isolated (≥ 2×)` };
  };

  // ---- animation of the steady state at the current speed (slowed, exaggerated)
  const wrapRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<SVGGElement>(null);
  const fanRef = useRef<SVGGElement>(null);
  const springRefs = useRef<(SVGPathElement | null)[]>([]);
  const t = useRef(0);
  const ppm = Math.min(150, (VH - 40) / (2 * s + 0.24), (VW - WALL - 70) / (2 * d)); // px per metre of geometry
  const Gx = WALL + d * ppm + 30;
  const fanR = Math.min(34, 0.6 * d * ppm, 0.6 * s * ppm);
  const Gy = VH / 2;
  const mountY = [s, 0, -s];
  const amp = useMemo(() => {
    const X = now.r[0];
    const Y = now.r[1];
    const Th = now.r[2];
    const big = Math.max(cabs(X), cabs(Y), Math.abs(d) * cabs(Th), 1e-12);
    const sc = 12 / big; // px per metre of motion
    return { X, Y, Th, sc };
  }, [now, d]);
  const live = useRef({ amp, Gx });
  live.current = { amp, Gx };
  const drawPose = (ph: number) => {
    const L = live.current;
    const re = (z: C, lag: number) => cabs(z) * Math.cos(ph + carg(z) - lag);
    const x = re(L.amp.X, 0) * L.amp.sc;
    const y = re(L.amp.Y, Math.PI / 2) * L.amp.sc;
    const th = re(L.amp.Th, Math.PI / 2) * L.amp.sc * 1; // radians scaled with the same px/m factor over a 1 m arm
    const thv = th / ppm; // small visual rotation
    bodyRef.current?.setAttribute('transform', `translate(${(L.Gx + x).toFixed(2)} ${(Gy - y).toFixed(2)}) rotate(${((-thv * 180) / Math.PI).toFixed(3)})`);
    fanRef.current?.setAttribute('transform', `rotate(${((-ph * 180) / Math.PI).toFixed(1)})`);
    mountY.forEach((my, i) => {
      const u = -d * ppm;
      const v = my * ppm;
      const X = L.Gx + x + u * Math.cos(thv) - v * Math.sin(thv);
      const Y = Gy - (y + u * Math.sin(thv) + v * Math.cos(thv));
      springRefs.current[i]?.setAttribute('d', springPath(WALL, Gy - v, X, Y, 4, 5, 5));
    });
  };
  useRaf(
    (dt) => {
      t.current += dt;
      drawPose(TAU * 0.6 * t.current);
    },
    true,
    wrapRef
  );
  useEffect(() => drawPose(TAU * 0.6 * t.current));

  const yAxis = view === 'disp' ? { min: 1e-4, max: 100, log: true, label: '|X|, |Y| (mm), |Θ| (mrad)' } : { min: 0.01, max: 100, log: true, label: 'force to wall / F₀' };
  const handleY = view === 'disp' ? 30 : 30;

  return (
    <div ref={wrapRef}>
      <SimLayout
        visual={
          <>
            <Plot x={{ min: 0, max: NPLOT, label: 'fan speed (rpm)' }} y={yAxis} height={290} ariaLabel="Response of the range hood against fan speed">
              <Band x0={isoN} x1={NPLOT} color="var(--ok)" opacity={0.09} label={bandLabel} />
              {modes.map((md, i) => (
                <VLine key={i} x={rad2rpm(md.omega)} color={MODE_VAR[i]} label={`f${i + 1}`} />
              ))}
              <VLine x={Nmax} color="var(--text-2)" dash="2 3" label="max 1200" labelY="bottom" />
              {view === 'disp' ? (
                <>
                  <Line points={curves.Y} color="var(--text)" width={2.4} />
                  <Line points={curves.T} color="var(--text-2)" width={2} dash />
                  <Line points={curves.X} color="var(--text-3)" width={2} dash="2 3" />
                  <Dot x={rad2rpm(Wa)} y={yDip} color="var(--text)" hollow />
                  <PlotText x={rad2rpm(Wa)} y={yDip} anchor="middle" dy={20} color="var(--text)">
                    Y ≈ 0
                  </PlotText>
                </>
              ) : (
                <>
                  <HLine y={1} label="T = 1" />
                  <Line points={curves.Ty} color="var(--text)" width={2.4} />
                  <Line points={curves.Tx} color="var(--text-3)" width={2} dash="2 3" />
                </>
              )}
              <VLine x={N} color="var(--accent)" dash={false} width={1.2} />
              <Handle x={N} y={handleY} axis="x" clampX={[20, NPLOT]} onChange={(x) => setN(Math.round(x))} ariaLabel="fan speed (drag)" />
            </Plot>
            <LineKey
              items={
                view === 'disp'
                  ? [
                      { label: '|Y| along the wall (mm)', color: 'var(--text)', width: 2.4 },
                      { label: '|Θ| rotation (mrad)', color: 'var(--text-2)', dash: '5 4' },
                      { label: '|X| away from the wall (mm)', color: 'var(--text-3)', dash: '2 3' },
                      { label: 'fan speed (drag the handle)', color: 'var(--accent)', width: 1.4 },
                    ]
                  : [
                      { label: 'y force on the wall / F₀', color: 'var(--text)', width: 2.4 },
                      { label: 'x force on the wall / F₀', color: 'var(--text-3)', dash: '2 3' },
                      { label: 'fan speed (drag the handle)', color: 'var(--accent)', width: 1.4 },
                    ]
              }
            />
            <div className="row gap-s wrap">
              <Segmented
                size="sm"
                label="Plot"
                value={view}
                onChange={setView}
                options={[
                  { value: 'disp', label: 'displacements' },
                  { value: 'force', label: 'force to the wall' },
                ]}
              />
              <span className="muted small">Vertical lines: natural frequencies in mode colours; green band: speeds at least twice every mode.</span>
            </div>
          </>
        }
        controls={
          stage >= 1 && (
            <>
              <Slider label="fan speed" tex="N" tip="fan speed (rpm); also drag the handle on the plot" value={N} min={20} max={NPLOT} step={1} unit="rpm" onChange={(x) => setN(Math.round(x))} />
              <svg viewBox={`0 0 ${VW} ${VH}`} className="anim" style={{ maxWidth: 340 }} role="img" aria-label="Top view of the range hood on three wall mounts, moving at the current fan speed (slowed and exaggerated).">
                <line x1={WALL} y1={14} x2={WALL} y2={VH - 14} stroke="var(--text-3)" strokeWidth={2} />
                {Array.from({ length: 12 }, (_, i) => (
                  <line key={i} x1={WALL} y1={20 + i * 20} x2={WALL - 8} y2={26 + i * 20} stroke="var(--text-3)" />
                ))}
                {mountY.map((my, i) => (
                  <path key={i} ref={(el) => (springRefs.current[i] = el)} d={springPath(WALL, Gy - my * ppm, Gx - d * ppm, Gy - my * ppm, 4, 5, 5)} fill="none" stroke="var(--text-2)" strokeWidth={1.8} />
                ))}
                <g ref={bodyRef} transform={`translate(${Gx} ${Gy})`}>
                  <rect x={-d * ppm} y={-(s + 0.12) * ppm} width={(2 * d) * ppm} height={(2 * s + 0.24) * ppm} rx={4} fill="var(--surface-2)" stroke="var(--text-2)" strokeWidth={1.8} />
                  <circle r={fanR} fill="none" stroke="var(--text-3)" strokeDasharray="4 3" />
                  <g ref={fanRef}>
                    <line x1={0} y1={0} x2={fanR} y2={0} stroke="var(--text-3)" strokeWidth={2} />
                    <circle cx={fanR} cy={0} r={4.5} fill="var(--text-2)" />
                  </g>
                  <circle r={5} fill="var(--surface)" stroke="var(--text)" strokeWidth={1.6} />
                  <text x={8} y={-8} className="diagram-label">
                    G
                  </text>
                </g>
                <text x={WALL + 6} y={16} className="plot-note">
                  wall
                </text>
                <text x={VW - 8} y={VH - 8} textAnchor="end" className="plot-note">
                  top view, motion exaggerated
                </text>
              </svg>
              <Readouts>
                <Readout tex="F_0" tip="unbalance force m_bR·Ω² at this speed" value={now.F0} unit="N" />
                <Readout tex="|X|" tip="sway amplitude away from the wall" value={cabs(now.r[0]) * 1e3} unit="mm" sig={3} />
                <Readout tex="|Y|" tip="amplitude along the wall" value={cabs(now.r[1]) * 1e3} unit="mm" sig={3} />
                <Readout tex="|\Theta|" tip="rotation amplitude" value={cabs(now.r[2]) * 1e3} unit="mrad" sig={3} />
                <Readout tex="\Omega_a" tip="undamped y anti-resonance √(K_θθ/I)" value={rad2rpm(Wa)} unit="rpm" />
                <Readout tex="2f_{\max}" tip="speed needed to isolate every mode (LA7 p47)" value={isoN} unit="rpm" />
              </Readouts>
              <div className="stack">
                {modes.map((md, i) => {
                  const vd = verdict(md.omega, N);
                  return (
                    <div key={i} className="row gap-s wrap">
                      <span style={{ color: MODE_VAR[i], fontWeight: 650 }}>Mode {i + 1}</span>
                      <span className="small">
                        {fmt(rad2rpm(md.omega), 4)} rpm ({kinds[i]})
                      </span>
                      <Badge tone={vd.tone}>{vd.txt}</Badge>
                    </div>
                  );
                })}
              </div>
            </>
          )
        }
        below={
          stage >= 2 && (
            <div className="stack">
              <details className="more" open>
                <summary>Mounts, body and damping</summary>
                <div className="more-body">
                  <Slider label="axial stiffness per mount" tex="k_x" tip="each mount, perpendicular to the wall (N/m)" value={kx / 1e3} min={10} max={1000} log unit="kN/m" onChange={(x) => set({ kx: x * 1e3 })} />
                  <Slider label="transverse / axial" tex="k_y/k_x" tip="ratio of transverse to axial stiffness of each mount" value={q} min={0.1} max={1} step={0.01} onChange={(x) => set({ q: x })} />
                  <Slider label="half-spacing of mounts" tex="s" tip="mounts at y = +s, 0, −s (m)" value={s} min={0.2} max={0.7} step={0.01} unit="m" onChange={(x) => set({ s: x })} />
                  <Slider label="G to the wall mounts" tex="d" tip="lever arm of the transverse springs about G (m)" value={d} min={0.2} max={0.7} step={0.01} unit="m" onChange={(x) => set({ d: x })} />
                  <Slider label="mass" tex="m" tip="range hood mass (kg)" value={m} min={10} max={80} step={1} unit="kg" onChange={(x) => set({ m: x })} />
                  <Slider label="inertia about G" tex="I" tip="moment of inertia in the plane (kg m²)" value={I} min={2} max={40} step={0.5} unit="kg m²" onChange={(x) => set({ I: x })} />
                  <Slider label="unbalance" tex="m_bR" tip="unbalance of the fan (kg m); F₀ = m_bR Ω²" value={mbR} min={0.005} max={0.05} step={0.001} unit="kg m" onChange={(x) => set({ mbR: x })} />
                  <Slider label="damping ratio, every mode" tex="\zeta" tip="modal damping (the exam model is undamped)" value={zeta} min={0.005} max={0.4} step={0.005} sig={2} onChange={setZeta} />
                  <Button size="sm" onClick={() => setHd(H2025)}>
                    Reset to the 2025 design
                  </Button>
                </div>
              </details>
              <Rich
                className="note"
                text={`${is2025 ? '2025 design' : 'This design'}: modes at ${modes.map((md) => fmt(rad2rpm(md.omega), 4)).join(', ')} rpm. Every mode below the running speed is passed during run-up; $y$ stops at $\\Omega_a = \\sqrt{K_{\\theta\\theta}/I}$ = ${fmt(rad2rpm(Wa), 4)} rpm while θ and $x$ keep moving, and the maximum speed must be judged against **every** mode, the highest included.`}
              />
              <Callout kind="info" title={`Challenge: ${done ? 'complete ✓' : 'isolate every mode at 1200 rpm'}`}>
                <Rich text={`Redesign the mounts so that 1200 rpm is at least twice the highest rigid-body frequency (now ${fmt(rad2rpm(wTop), 4)} rpm). Which stiffness change does it, and what does the run-up now pass through?`} />
                <div className="row gap-s wrap" style={{ marginTop: 6 }}>
                  <Button size="sm" variant="primary" disabled={!solved || done} onClick={() => completeChallenge(RUNUP_CHALLENGE)}>
                    {done ? '✓ Challenge complete' : solved ? 'Submit this design' : `Needs 2 f_max ≤ 1200 rpm (now ${fmt(isoN, 4)})`}
                  </Button>
                </div>
                {solved && <Rich className="note" text="Every mode is now below 600 rpm, so the fan passes through all of them during start-up: this is where a little damping earns its keep." />}
              </Callout>
            </div>
          )
        }
      />
      {stage >= 3 && (
        <>
          <PredictReveal
            id="a5-run-suppressed"
            question="As the fan runs up from 0 to 1200 rpm, which coordinate momentarily stops moving at one particular speed?"
            options={['$x$, away from the wall', '$y$, along the wall', 'θ, the rotation', 'None of them']}
            answer={1}
            explain="The force on $y$ drives the coupled $(y, \theta)$ pair. $Y$’s numerator $0.75k_x - I\Omega^2$ vanishes at $\Omega = \sqrt{0.75k_x/I}$ = 109.5 rad/s = 1046 rpm; θ’s numerator is constant, and $x$ is an SDOF. There $|\Theta|$ = 2.0 mrad and $|X|$ = 0.625 mm (2025 A2.4)."
            tryIt="drag the fan-speed handle to the dip in |Y|."
            onApply={() => {
              setHd(H2025);
              setView('disp');
              setN(1046);
            }}
          />
          <PredictReveal
            id="a5-run-max"
            question="Is 1200 rpm a good maximum operating speed for the 2025 mounts?"
            options={['Yes: it is above the first resonance', 'No: a resonance lies just above it, and it is well under twice the highest mode']}
            answer={1}
            explain="The second coupled mode is at 1222 rpm, only 1.9 % above 1200 rpm, and the sway mode is at 1531 rpm. The reader’s rule (LA7 p47) wants the running speed at least twice the highest rigid-body frequency, about 3060 rpm here."
            tryIt="set the speed to 1200 rpm and read the three mode badges."
            onApply={() => {
              setHd(H2025);
              setN(1200);
            }}
          />
          <PredictReveal
            id="a5-run-halve"
            question="Halve every mount stiffness ($k_x$ and $k_y$). The speed at which $y$ stops…"
            options={['halves', 'falls by a factor √2', 'stays the same']}
            answer={1}
            explain="All stiffness terms halve while $M$ is unchanged, so every natural frequency, and the anti-resonance $\sqrt{K_{\theta\theta}/I}$, falls by √2: 1046 → 740 rpm."
            tryIt="halve kₓ (the ratio k_y/kₓ stays) and watch Ωa."
            onApply={() => {
              setHd({ ...H2025, kx: H2025.kx / 2 });
              setN(740);
            }}
          />
          <PredictReveal
            id="a5-run-damping"
            question="With soft mounts (every mode below 600 rpm), raise the damping ratio from 0.02 to 0.3. At 1200 rpm, the force transmitted to the wall…"
            options={['falls', 'rises', 'is unchanged']}
            answer={1}
            explain="1200 rpm is above $\sqrt2$ times every mode, where dampers pass force straight to the wall ($T \to 2\zeta/r$). Damping only helps while passing through the resonances during run-up (official 2018 A3.7; 2025 A3.5)."
            tryIt="soften kₓ to about 30 kN/m, show the force to the wall, then raise ζ."
            onApply={() => {
              setHd({ ...H2025, kx: 30e3 });
              setView('force');
              setN(1200);
              setZeta(0.3);
            }}
          />
        </>
      )}
    </div>
  );
}
