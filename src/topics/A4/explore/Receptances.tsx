// Receptances α11, α12, α22 of the chain ground–k1–m1–k2–m2 (LA6 Eq 6.10–6.13): log magnitude against the
// forcing frequency, resonances in mode colours, the anti-resonance of each driving-point receptance, a
// draggable forcing frequency and the steady-state motion of the two masses.
import { useMemo, useRef, useState } from 'react';
import { chainFrequencies } from '../../../physics/absorber';
import { receptance } from '../../../physics/mdof';
import { cabs, carg } from '../../../physics/complex';
import { Handle, Line, Plot, VLine, type AxisSpec } from '../../../plot/Plot';
import { Button, Legend, Readout, Readouts, Segmented, SimLayout, Slider, Toggle } from '../../../ui/kit';
import { PredictReveal } from '../../../ui/PredictReveal';
import { Rich } from '../../../ui/Rich';
import ChainAnim from './ChainAnim';
import HaloText from './HaloText';
import { chainReceptances, featureGrid, ladderCeil } from '../physics';

const Y: AxisSpec = { min: 1e-3, max: 1e2, log: true };
const ZETA1 = 0.02; // light stiffness-proportional damping: ζ = 2 % in mode 1
const clampY = (v: number) => Math.max(Y.min * 1.2, Math.min(Y.max / 1.2, v));

interface PanelProps {
  label: string;
  pts: { x: Float64Array; y: Float64Array };
  active: boolean;
  w: [number, number];
  zero?: number;
  zeroLabel?: string;
  note?: string;
  xMax: number;
  W: number;
  onW?: (w: number) => void;
  handleY?: number;
  top?: boolean;
  bottom?: boolean;
}

function Panel({ label, pts, active, w, zero, zeroLabel, note, xMax, W, onW, handleY, top, bottom }: PanelProps) {
  return (
    <Plot
      x={{ min: 0, max: xMax, label: bottom ? 'forcing frequency Ω (rad/s)' : undefined }}
      y={{ ...Y, label }}
      height={bottom ? 168 : 146}
      cursorX={onW ? null : W}
      ariaLabel={`${label} against forcing frequency`}
    >
      <VLine x={w[0]} color="var(--m1)" label={top ? 'ω₁' : undefined} />
      <VLine x={w[1]} color="var(--m2)" label={top ? 'ω₂' : undefined} />
      {zero !== undefined && <VLine x={zero} color="var(--text-2)" dash="2 3" label={zeroLabel} labelY="bottom" />}
      <Line points={pts} color="var(--text)" width={active ? 2.2 : 1.4} opacity={active ? 1 : 0.38} />
      {note && (
        <HaloText x={xMax * 0.985} y={0.0022} anchor="end" color="var(--text-2)">
          {note}
        </HaloText>
      )}
      {onW && handleY !== undefined && <Handle x={W} y={clampY(handleY)} axis="x" onChange={(x) => onW(x)} clampX={[0.2, xMax]} color="var(--accent)" label="Ω" ariaLabel="forcing frequency Ω" />}
    </Plot>
  );
}

export default function Receptances() {
  const [m1, setM1] = useState(1);
  const [m2, setM2] = useState(1);
  const [k1, setK1] = useState(1000);
  const [k2, setK2] = useState(1000);
  const [drive, setDrive] = useState<1 | 2>(1);
  const [W, setWraw] = useState(12);
  const [damped, setDamped] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const [w1, w2] = chainFrequencies(m1, k1, m2, k2);
  const za = Math.sqrt(k2 / m2); // α11 = 0 (m1 held → m2 on k2)
  const zb = Math.sqrt((k1 + k2) / m1); // α22 = 0 (m2 held → m1 on k1 + k2)
  const xMax = ladderCeil(1.45 * w2);
  const setW = (x: number) => setWraw(Math.max(0.2, Math.min(xMax, x)));
  const Wc = Math.min(W, xMax);

  const K = useMemo(() => [[k1 + k2, -k2], [-k2, k2]], [k1, k2]);
  const M = useMemo(() => [[m1, 0], [0, m2]], [m1, m2]);
  const Cd = useMemo(() => {
    const a = (2 * ZETA1) / w1; // C = aK gives ζ_i = a ω_i / 2
    return K.map((row) => row.map((v) => a * v));
  }, [K, w1]);

  const curves = useMemo(() => {
    const xs = featureGrid(0.2, xMax, 520, [w1, w2, za, zb]);
    const n = xs.length;
    const y11 = new Float64Array(n);
    const y12 = new Float64Array(n);
    const y22 = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      if (damped) {
        const R = receptance(K, M, xs[i], Cd);
        y11[i] = cabs(R[0][0]) * 1000;
        y12[i] = cabs(R[0][1]) * 1000;
        y22[i] = cabs(R[1][1]) * 1000;
      } else {
        const r = chainReceptances(m1, k1, m2, k2, xs[i]);
        y11[i] = Math.abs(r.a11) * 1000;
        y12[i] = Math.abs(r.a12) * 1000;
        y22[i] = Math.abs(r.a22) * 1000;
      }
    }
    return { a11: { x: xs, y: y11 }, a12: { x: xs, y: y12 }, a22: { x: xs, y: y22 } };
  }, [m1, m2, k1, k2, damped, xMax, w1, w2, za, zb, K, M, Cd]);

  // Receptances at the current forcing frequency (mm/N). Undamped: signed (sign = phase 0° or 180°).
  const r = chainReceptances(m1, k1, m2, k2, Wc);
  const Rd = damped ? receptance(K, M, Wc, Cd) : null;
  const col = drive === 1 ? 0 : 1;
  const X1 = damped ? cabs(Rd![0][col]) * 1000 : (drive === 1 ? r.a11 : r.a12) * 1000;
  const X2 = damped ? cabs(Rd![1][col]) * 1000 : (drive === 1 ? r.a12 : r.a22) * 1000;
  const ph1 = damped ? -carg(Rd![0][col]) : X1 < 0 ? Math.PI : 0;
  const ph2 = damped ? -carg(Rd![1][col]) : X2 < 0 ? Math.PI : 0;
  const stat = drive === 1 ? 1000 / k1 : 1000 / k1 + 1000 / k2;
  const scale = 34 / Math.max(Math.abs(X1), Math.abs(X2), 2.5 * stat);
  const phaseWord = (x: number, ph: number) => {
    if (Math.abs(x) < 1e-9 * stat) return 'stands still';
    const deg = ((ph * 180) / Math.PI + 360) % 360;
    if (!damped) return deg < 90 ? 'in phase with F' : 'in anti-phase with F (180°)';
    return `lags F by ${deg.toFixed(0)}°`;
  };
  const atZero = drive === 1 ? Math.abs(Wc - za) / za < 0.004 : Math.abs(Wc - zb) / zb < 0.004;

  const preset = (a: number, b: number, c: number, d: number, w?: number) => {
    setM1(a);
    setM2(b);
    setK1(c);
    setK2(d);
    if (w !== undefined) setWraw(w);
  };

  const hY = drive === 1 ? Math.abs(X1) : Math.abs(X2);

  return (
    <div ref={wrapRef}>
      <SimLayout
        visual={
          <>
            <ChainAnim
              a1={damped ? Math.abs(X1) * scale : X1 * scale}
              a2={damped ? Math.abs(X2) * scale : X2 * scale}
              p1={damped ? ph1 : 0}
              p2={damped ? ph2 : 0}
              driven={drive}
              ariaLabel={`Two masses on springs from a wall; force on mass ${drive}; steady-state motion at the chosen forcing frequency`}
            />
            <Panel label="|α₁₁| (mm/N)" pts={curves.a11} active={drive === 1} w={[w1, w2]} zero={za} zeroLabel="√(k₂/m₂)" xMax={xMax} W={Wc} onW={drive === 1 ? setW : undefined} handleY={hY} top />
            <Panel label="|α₁₂| (mm/N)" pts={curves.a12} active w={[w1, w2]} note="α₁₂ = α₂₁ = k₂/Δ: never zero (constant numerator)" xMax={xMax} W={Wc} />
            <Panel label="|α₂₂| (mm/N)" pts={curves.a22} active={drive === 2} w={[w1, w2]} zero={zb} zeroLabel="√((k₁+k₂)/m₁)" xMax={xMax} W={Wc} onW={drive === 2 ? setW : undefined} handleY={hY} bottom />
            <Legend
              items={[
                { label: 'resonance ω₁ (mode 1)', color: 'var(--m1)', dash: true },
                { label: 'resonance ω₂ (mode 2)', color: 'var(--m2)', dash: true },
                { label: 'anti-resonance', color: 'var(--text-2)', dash: true },
              ]}
            />
            <p className="muted small">
              Drag the Ω handle (or use the slider). Faded panel: the receptance not used by the current force. Animation slowed to 0.6 Hz; amplitudes to scale with each other.
            </p>
          </>
        }
        controls={
          <>
            <Segmented
              label="Where the force acts"
              value={drive}
              onChange={(v) => setDrive(v)}
              options={[
                { value: 1, label: 'Force on m₁' },
                { value: 2, label: 'Force on m₂' },
              ]}
            />
            <Slider label="forcing frequency" tex="\Omega" tip="frequency of the harmonic force F₀ sin Ωt" value={Wc} min={0.2} max={xMax} step={xMax / 1000} unit="rad/s" onChange={setW} />
            <Slider label="lower mass" tex="m_1" tip="mass attached to the wall through k₁" value={m1} min={0.25} max={4} log unit="kg" onChange={setM1} />
            <Slider label="upper mass" tex="m_2" tip="mass attached to m₁ through k₂" value={m2} min={0.25} max={4} log unit="kg" onChange={setM2} />
            <Slider label="wall spring" tex="k_1" tip="spring from the wall to m₁" value={k1} min={250} max={4000} log unit="N/m" onChange={setK1} />
            <Slider label="coupling spring" tex="k_2" tip="spring between m₁ and m₂" value={k2} min={250} max={4000} log unit="N/m" onChange={setK2} />
            <Toggle checked={damped} onChange={setDamped} label="light damping (ζ₁ = 2 %)" />
            <Readouts>
              <Readout tex="\omega_1" tip="lower natural frequency: root of det(K − Ω²M) = 0" value={w1} unit="rad/s" tone="m1" />
              <Readout tex="\omega_2" tip="upper natural frequency" value={w2} unit="rad/s" tone="m2" />
              <Readout tex="\sqrt{k_2/m_2}" tip="zero of α₁₁: natural frequency with m₁ held fixed" value={za} unit="rad/s" />
              <Readout tex="\sqrt{\tfrac{k_1+k_2}{m_1}}" tip="zero of α₂₂: natural frequency with m₂ held fixed" value={zb} unit="rad/s" />
              <Readout tex="\Omega" tip="forcing frequency" value={Wc} unit="rad/s" />
              <Readout tex="f" tip="forcing frequency in Hz = Ω/2π" value={Wc / (2 * Math.PI)} unit="Hz" />
              <Readout
                tex="X_1/F_0"
                tip={`${drive === 1 ? 'α₁₁' : 'α₁₂'}: amplitude of m₁ per newton of force${damped ? ' (magnitude)' : ' (signed: negative = anti-phase)'}`}
                value={Math.abs(X1) < 1e-9 * stat ? 0 : X1}
                unit="mm/N"
                sig={3}
              />
              <Readout
                tex="X_2/F_0"
                tip={`${drive === 1 ? 'α₂₁' : 'α₂₂'}: amplitude of m₂ per newton of force${damped ? ' (magnitude)' : ' (signed: negative = anti-phase)'}`}
                value={Math.abs(X2) < 1e-9 * stat ? 0 : X2}
                unit="mm/N"
                sig={3}
              />
            </Readouts>
            <Rich
              className="note"
              text={`At $\\Omega$ = ${Wc.toFixed(1)} rad/s: $m_1$ ${phaseWord(X1, ph1)}, $m_2$ ${phaseWord(X2, ph2)}.${
                atZero && !damped
                  ? drive === 1
                    ? ` **Anti-resonance:** $m_2$ swings with $X_2 = -F_0/k_2$, so spring $k_2$ cancels the force on $m_1$.`
                    : ` **Anti-resonance:** $m_1$ swings with $X_1 = -F_0/k_2$, so spring $k_2$ cancels the force on $m_2$.`
                  : ''
              }`}
            />
            <div className="row gap-s wrap">
              <span className="muted small">Presets:</span>
              <Button size="sm" onClick={() => preset(1, 1, 1000, 1000)}>
                m₁ = m₂, k₁ = k₂
              </Button>
              <Button size="sm" onClick={() => preset(2, 1, 2000, 1000)}>
                m₁ = 2m₂, k₁ = 2k₂
              </Button>
              <Button size="sm" onClick={() => preset(1, 0.25, 1000, 250)}>
                tuned absorber
              </Button>
            </div>
          </>
        }
      />
      <PredictReveal
        id="a4-rec-top-mass"
        question="Put the force on the **top** mass $m_2$. At which forcing frequency does $m_2$ itself stand still?"
        options={['$\\sqrt{k_2/m_2}$', '$\\sqrt{k_1/m_1}$', '$\\sqrt{(k_1+k_2)/m_1}$', 'never']}
        answer={2}
        explain="$\alpha_{22} = (k_1 + k_2 - m_1\Omega^2)/\Delta$ is zero when $m_1$, with $m_2$ held fixed, would resonate on $k_1 + k_2$. There $m_1$ moves with $X_1 = -F_0/k_2$, so spring $k_2$ pulls on $m_2$ with exactly $-F_0$: $m_1$ acts as an absorber for $m_2$ (official 2018 A1.8). $\sqrt{k_2/m_2}$ is the zero of $\alpha_{11}$, for a force on $m_1$."
        tryIt="switch the force to m₂ and drag Ω onto the dotted line of the α₂₂ panel."
        onApply={() => {
          setDrive(2);
          setDamped(false);
          setWraw(zb);
        }}
      />
      <PredictReveal
        id="a4-rec-cross"
        question="Can the cross receptance $\alpha_{12} = X_1/F_2$ of this chain ever be zero?"
        options={['yes, at $\\sqrt{k_2/m_2}$', 'yes, at $\\sqrt{(k_1+k_2)/m_1}$', 'no, never']}
        answer={2}
        explain="$\alpha_{12} = \alpha_{21} = k_2/\Delta$: the numerator is the constant $k_2$, so a force on one mass always reaches the other through the spring. Only the driving-point receptances $\alpha_{11}$, $\alpha_{22}$ have zeros, each between $\omega_1$ and $\omega_2$ (2024 A1.3). In longer chains only the end-to-end cross receptances are zero-free."
        tryIt="force m₁ and park Ω on the α₁₁ zero: m₁ stops but m₂ keeps moving."
        onApply={() => {
          setDrive(1);
          setDamped(false);
          setWraw(za);
        }}
      />
      <PredictReveal
        id="a4-rec-double-m2"
        question="Double the upper mass $m_2$. Which anti-resonance moves?"
        options={['only the zero of $\\alpha_{11}$', 'only the zero of $\\alpha_{22}$', 'both zeros', 'neither']}
        answer={0}
        explain="The zero of $\alpha_{11}$ is $\sqrt{k_2/m_2}$, so it falls by $1/\sqrt2$. The zero of $\alpha_{22}$ is $\sqrt{(k_1+k_2)/m_1}$: with $m_2$ held fixed its mass drops out. Both resonances move, and each zero stays between them (interlacing)."
        tryIt="watch the two dotted lines while you double m₂."
        onApply={() => setM2(Math.min(4, m2 * 2))}
      />
    </div>
  );
}
