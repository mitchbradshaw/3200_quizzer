// Standing waves on a string, rod or shaft with fixed–fixed, fixed–free or free–free ends.
// Same wave equation, same shapes for the same ends; only the wave speed (and so the frequency ladder) changes.
import { useMemo, useRef, useState } from 'react';
import { hasRigidMode, shearModulus, waveModeShape, waveNodes, waveOmegas, waveRoot, type WaveBC } from '../../../physics/waves';
import { useRaf } from '../../../anim/hooks';
import { Dot, HLine, Line, LivePath, Plot, livePathD, sample, type PlotScales } from '../../../plot/Plot';
import { Button, Legend, Readout, Readouts, Segmented, SimLayout, Slider, modeColor } from '../../../ui/kit';
import { PredictReveal } from '../../../ui/PredictReveal';
import { Rich } from '../../../ui/Rich';
import { fmtSig } from '../../../engine/format';
import { MATERIALS, type Member } from '../physics';
import { MemberView, type MemberApi } from './MemberView';

const BC_OPTIONS: { value: WaveBC; label: string }[] = [
  { value: 'fixed-fixed', label: 'fixed–fixed' },
  { value: 'fixed-free', label: 'fixed–free' },
  { value: 'free-free', label: 'free–free' },
];

const END_TEXT: Record<Member, { fixed: string; free: string; what: string }> = {
  string: { fixed: '$y = 0$', free: '$\\partial y/\\partial x = 0$ (a ring sliding on a frictionless guide: no transverse force)', what: 'transverse displacement $y$' },
  rod: { fixed: '$u = 0$', free: '$\\partial u/\\partial x = 0$ (no axial stress)', what: 'axial displacement $u$ (drawn 18 px at full scale)' },
  shaft: { fixed: '$\\theta = 0$', free: '$\\partial\\theta/\\partial x = 0$ (no torque)', what: 'angle of twist $\\theta$ (spokes on discs along the shaft)' },
};

const XS = Array.from({ length: 121 }, (_, i) => i / 120);

export default function StandingWaves() {
  const [member, setMember] = useState<Member>('string');
  const [bc, setBc] = useState<WaveBC>('fixed-fixed');
  const [mode, setMode] = useState(1);
  // Default: a guitar A string, 0.65 m, 6.26 g/m at 128 N, so f1 = 110 Hz.
  const [T, setT] = useState(128); // N
  const [rl, setRl] = useState(0.00626); // kg/m
  const [matId, setMatId] = useState<(typeof MATERIALS)[number]['id']>('steel');
  const [L, setL] = useState(0.65);
  const mat = MATERIALS.find((m) => m.id === matId)!;
  const rigid = hasRigidMode(bc);
  const m = !rigid && mode === 0 ? 1 : mode;

  const G = shearModulus(mat.E, mat.nu);
  const c = member === 'string' ? Math.sqrt(T / rl) : member === 'rod' ? Math.sqrt(mat.E / mat.rho) : Math.sqrt(G / mat.rho);
  const f = waveOmegas(bc, c, L, 3).map((w) => w / (2 * Math.PI));
  const nodes = m >= 1 ? waveNodes(bc, m) : [];
  const shape = (xi: number) => (m === 0 ? 1 : waveModeShape(bc, m, xi));
  const wl = m === 0 ? Infinity : (2 * Math.PI * L) / waveRoot(bc, m); // wavelength 2 pi c / w
  const color = m === 0 ? 'var(--text-2)' : modeColor(m);

  const shapes = useMemo(() => [1, 2, 3].map((i) => sample((xi) => waveModeShape(bc, i, xi), 0, 1, 160)), [bc]);

  // ---- animation: y(x, t) = Y_m(x) cos(w t), slowed down so mode 1 takes 1.6 s; ratios between modes are true.
  const wrapRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<MemberApi>(null);
  const traceRef = useRef<SVGPathElement>(null);
  const scales = useRef<PlotScales | null>(null);
  const t = useRef(0);
  const buf = useRef<[number, number][]>(XS.map((x) => [x, 0]));
  const wScreen = m === 0 ? 0 : 2 * Math.PI * 0.62 * (waveRoot(bc, m) / waveRoot(bc, 1));
  useRaf(
    (dt) => {
      t.current += dt;
      // Rigid-body mode (f = 0): no restoring force, so the member just drifts as a whole; shown as a slow uniform shift.
      const a = m === 0 ? 0.6 * Math.sin(2 * Math.PI * 0.18 * t.current) : Math.cos(wScreen * t.current);
      viewRef.current?.draw((xi) => a * shape(xi));
      const b = buf.current;
      for (let i = 0; i < XS.length; i++) b[i][1] = a * shape(XS[i]);
      traceRef.current?.setAttribute('d', livePathD(b, scales.current));
    },
    true,
    wrapRef
  );

  const ratios = bc === 'fixed-free' ? '1 : 3 : 5' : '1 : 2 : 3';
  const left = bc === 'free-free' ? 'free' : 'fixed';
  const right = bc === 'fixed-fixed' ? 'fixed' : 'free';
  const memberName = member === 'string' ? 'string' : member === 'rod' ? 'rod (axial)' : 'shaft (torsion)';
  const modeOptions = [...(rigid ? [{ value: 0, label: '0 (rigid)' }] : []), { value: 1, label: '1' }, { value: 2, label: '2' }, { value: 3, label: '3' }];

  return (
    <div ref={wrapRef}>
      <SimLayout
        visual={
          <>
            <MemberView
              ref={viewRef}
              member={member}
              left={left}
              right={right}
              color={color}
              nodes={nodes}
              label={`Animated ${memberName}, ${bc}, mode ${m}`}
              caption={m === 0 ? 'rigid-body mode (f = 0): moves as a whole, no deformation' : `mode ${m}: ${nodes.length} interior node${nodes.length === 1 ? '' : 's'}`}
            />
            <Plot x={{ min: 0, max: 1, label: 'position x/L' }} y={{ min: -1.25, max: 1.25, label: 'mode shape', ticks: [-1, 0, 1] }} height={210} ariaLabel="Mode shapes 1 to 3 with the selected mode animated">
              <HLine y={0} dash={false} />
              {shapes.map((pts, i) => (
                <Line key={i} points={pts} color={modeColor(i + 1)} width={i + 1 === m ? 2.2 : 1.2} opacity={i + 1 === m ? 0.9 : 0.35} dash={i + 1 === m ? undefined : '4 3'} />
              ))}
              {m === 0 && <HLine y={1} color="var(--text-2)" label="rigid mode shape: Y(x) = 1" />}
              <LivePath pathRef={traceRef} scalesRef={scales} color={color} width={3} />
              {nodes.map((xi) => (
                <Dot key={xi} x={xi} y={0} color={color} hollow r={4.5} />
              ))}
            </Plot>
            <Legend
              items={[
                { label: `mode 1: ${fmtSig(f[0], 4)} Hz`, color: 'var(--m1)' },
                { label: `mode 2: ${fmtSig(f[1], 4)} Hz`, color: 'var(--m2)' },
                { label: `mode 3: ${fmtSig(f[2], 4)} Hz`, color: 'var(--m3)' },
              ]}
            />
            <Rich className="note" text={`Showing ${END_TEXT[member].what}. Fixed end: ${END_TEXT[member].fixed}. Free end: ${END_TEXT[member].free}. Hollow dots mark the nodes of the selected mode. The animation is slowed down; its speed ratios between modes are the true ones.`} />
          </>
        }
        controls={
          <>
            <div className="stack">
              <div>
                <div className="muted small">Member</div>
                <Segmented
                  label="Member"
                  value={member}
                  onChange={setMember}
                  options={[
                    { value: 'string', label: 'String' },
                    { value: 'rod', label: 'Rod (axial)' },
                    { value: 'shaft', label: 'Shaft (torsion)' },
                  ]}
                />
              </div>
              <div>
                <div className="muted small">End conditions</div>
                <Segmented label="End conditions" value={bc} onChange={setBc} options={BC_OPTIONS} />
              </div>
              <div>
                <div className="muted small">Mode to animate</div>
                <Segmented label="Mode" size="sm" value={m} onChange={setMode} options={modeOptions} />
              </div>
            </div>
            {member === 'string' ? (
              <>
                <Slider label="tension" tex="T" tip="string tension (N)" value={T} min={10} max={50000} log unit="N" onChange={setT} />
                <Slider label="mass per length" tex="\rho_l" tip="mass per unit length ρl = ρA (kg/m)" value={rl} min={0.0005} max={5} log unit="kg/m" onChange={setRl} />
              </>
            ) : (
              <div>
                <div className="muted small">Material</div>
                <Segmented label="Material" size="sm" value={matId} onChange={setMatId} options={MATERIALS.map((x) => ({ value: x.id, label: x.label }))} />
              </div>
            )}
            <Slider label="length" tex="L" tip="length between the ends (m)" value={L} min={0.3} max={300} log unit="m" onChange={setL} />
            <Readouts>
              <Readout tex="c" tip={member === 'string' ? 'wave speed √(T/ρl)' : member === 'rod' ? 'axial wave speed √(E/ρ)' : 'torsional wave speed √(G/ρ), G = E/2(1+ν)'} value={c} unit="m/s" />
              <Readout tex="f_1" tip="first non-zero natural frequency" value={f[0]} unit="Hz" tone="m1" />
              <Readout tex="f_2" tip="second natural frequency" value={f[1]} unit="Hz" tone="m2" />
              <Readout tex="f_3" tip="third natural frequency" value={f[2]} unit="Hz" tone="m3" />
              <Readout label="ratios" tip="f1 : f2 : f3" text={ratios} />
              <Readout tex="\lambda" tip="wavelength of the selected mode, 2πc/ω" value={wl} unit="m" text={m === 0 ? '∞' : undefined} />
            </Readouts>
            {rigid && <Rich className="note" text="Free–free also has a **rigid-body mode at $f = 0$**: the whole member translates (or spins) without deforming, because nothing pulls it back. Pick mode 0: it is drawn drifting slowly as a whole." />}
            {member === 'string' && (
              <div className="row gap-s wrap">
                <span className="muted small">Presets:</span>
                <Button
                  size="sm"
                  onClick={() => {
                    setBc('fixed-fixed');
                    setT(128);
                    setRl(0.00626);
                    setL(0.65);
                  }}
                >
                  Guitar A string (110 Hz)
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setBc('fixed-fixed');
                    setT(20000);
                    setRl(1.5);
                    setL(200);
                  }}
                >
                  Powerline (Reader SP1)
                </Button>
              </div>
            )}
          </>
        }
      />
      <PredictReveal
        id="b2-sw-member-shapes"
        question="With both ends fixed, switch from the string to the shaft. Do the mode shapes change?"
        options={['Yes: a shaft twists, so its shapes are different', 'No: same shapes; only the frequencies change', 'Only the node positions move']}
        answer={1}
        explain="String, rod and shaft obey the same wave equation, so with the same ends they have the same shapes ($\sin(n\pi x/L)$ here). Only the wave speed $c$, and so the frequency ladder, changes (LB3.5: “an equivalence in solutions for axial and torsional (& string) vibrations with the same boundary conditions”)."
        tryIt="set fixed–fixed, compare String and Shaft."
        onApply={() => {
          setBc('fixed-fixed');
          setMember('shaft');
        }}
      />
      <PredictReveal
        id="b2-sw-fixed-free"
        question="Make the ends fixed–free. What is $f_2/f_1$?"
        options={['2', '3', '4', '1.5']}
        answer={1}
        explain="A free end is an antinode, so the modes fit odd quarter-wavelengths: $f_n = (2n-1)c/4L$, giving 1 : 3 : 5. Mode 2 has one node, at $2L/3$; mode 3 has two, at $0.4L$ and $0.8L$."
        tryIt="choose fixed–free and animate mode 2."
        onApply={() => {
          setBc('fixed-free');
          setMode(2);
        }}
      />
      <PredictReveal
        id="b2-sw-fix-end"
        question="Start from fixed–free and fix the free end. What happens to $f_1$?"
        options={['It halves', 'No change', 'It doubles', 'It rises by √2']}
        answer={2}
        explain="$c/4L \to c/2L$: fixing the free end doubles the fundamental. An added constraint raises every mode (here 1, 3, 5 × $c/4L$ become 2, 4, 6 × $c/4L$). This is the drill rod whose bit jams in rock (official 2019 B1.6)."
        tryIt="read f₁ for fixed–free, then switch to fixed–fixed."
        onApply={() => {
          setBc('fixed-fixed');
          setMode(1);
        }}
      />
      <PredictReveal
        id="b2-sw-free-free"
        question="Free–free: where are the nodes of the first elastic mode?"
        options={['At both ends', 'One, at mid-length', 'Two, at 0.224L and 0.776L', 'There are none']}
        answer={1}
        explain="The shapes are $\cos(n\pi x/L)$: both ends are antinodes and mode 1 has a single node at $L/2$. (Nodes at $0.224L$ and $0.776L$ belong to a free–free **beam** in bending.) There is also the rigid-body mode at $f = 0$."
        tryIt="choose free–free and animate mode 1, then mode 0."
        onApply={() => {
          setBc('free-free');
          setMode(1);
        }}
      />
    </div>
  );
}
