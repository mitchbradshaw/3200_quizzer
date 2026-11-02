// Modal test on a pinned–pinned beam with three measurement points: roving accelerometer (a column of the FRF
// matrix) or roving hammer (a row). Read Im H at each resonance to build the mode shape; see reciprocity, and
// what a point at a node does to the data (LC2-7 to LC2-13; 2024 A3.5).
import { useMemo, useRef, useState } from 'react';
import { type C, cabs } from '../../../physics/complex';
import { mulberry32 } from '../../../engine/rng';
import { useRaf } from '../../../anim/hooks';
import { Dot, Line, Plot, Stems, VLine, sample, type AxisSpec } from '../../../plot/Plot';
import { Badge, Button, Legend, Readout, Readouts, Segmented, SimLayout, Slider, Toggle } from '../../../ui/kit';
import { PredictReveal } from '../../../ui/PredictReveal';
import { Rich } from '../../../ui/Rich';
import { TAU, beamFRF, pinnedShape, type FrfForm } from '../physics';
import { niceTicks } from './axes';

const F1 = 20; // Hz, first natural frequency (pinned–pinned: f_r = r^2 F1)
const W1 = TAU * F1;
const N_MODES = 5;
const F_MAX = 230;
const MODE_COLORS = ['var(--m1)', 'var(--m2)', 'var(--m3)'];
// Accelerance noise level, m/s²/N: about 4 % of a resonant peak at the quarter points, and about the size of the
// off-resonance response that is left at a node of the mode being read (so, as the summary notes put it, a point
// at a node of a mode "sees only noise" there and its coherence drops).
const NOISE_A = 1;
const SUB = ['₁', '₂', '₃'];

type Test = 'column' | 'row';

/** Frequency grid in Hz: uniform plus dense points around each resonance. */
function grid(zeta: number): number[] {
  const pts: number[] = [];
  for (let i = 1; i <= 600; i++) pts.push((F_MAX * i) / 600);
  for (let r = 1; r <= 3; r++) {
    const fr = r * r * F1;
    const half = Math.max(10 * zeta, 0.03) * fr;
    for (let i = -60; i <= 60; i++) pts.push(fr + (half * i) / 60);
  }
  pts.sort((a, b) => a - b);
  return pts.filter((f, i) => f > 0 && (i === 0 || f - pts[i - 1] > 1e-6));
}

export default function ModalTest() {
  const [xs, setXs] = useState<[number, number, number]>([0.25, 0.5, 0.75]);
  const [ref, setRef] = useState(0);
  const [test, setTest] = useState<Test>('column');
  const [form, setForm] = useState<FrfForm>('A');
  const [zeta, setZeta] = useState(0.02);
  const [noisy, setNoisy] = useState(true);
  const [mode, setMode] = useState(1);

  const unit = form === 'A' ? 'm/s²/N' : 'µm/N';
  const scale = form === 'A' ? 1 : 1e6;
  const fr = [1, 2, 3].map((r) => r * r * F1);

  /** Measured FRF between response point i and force point j (with deterministic measurement noise). */
  const frfs = useMemo(() => {
    const f = grid(zeta);
    return [0, 1, 2].map((p) => {
      const resp = test === 'column' ? p : ref;
      const force = test === 'column' ? ref : p;
      const rnd = mulberry32(101 + 17 * resp + 5 * force);
      const im: number[] = [];
      for (const ff of f) {
        const w = TAU * ff;
        const H: C = beamFRF(xs[resp], xs[force], w, W1, zeta, N_MODES, form);
        const n = noisy ? (rnd() * 2 - 1) * NOISE_A * (form === 'A' ? 1 : 1 / (w * w)) : 0;
        im.push((H.im + n) * scale);
      }
      // Readings at the three resonances, and the estimated coherence there (output-noise model).
      const read = fr.map((fq, r) => {
        const w = TAU * fq;
        const H = beamFRF(xs[resp], xs[force], w, W1, zeta, N_MODES, form);
        const nr = mulberry32(900 + 31 * resp + 7 * force + r)();
        const nLevel = NOISE_A * (form === 'A' ? 1 : 1 / (w * w));
        const val = (H.im + (noisy ? (nr * 2 - 1) * nLevel : 0)) * scale;
        const sig = cabs(H);
        const coh = noisy ? (sig * sig) / (sig * sig + nLevel * nLevel) : 1;
        return { val, coh };
      });
      return { f, im, read, resp, force };
    });
  }, [xs, ref, test, form, zeta, noisy]);

  const yMax = useMemo(() => {
    let mx = 0;
    for (const fr of frfs) for (const v of fr.im) mx = Math.max(mx, Math.abs(v));
    return mx * 1.12 || 1;
  }, [frfs]);
  const xAxis = useMemo<AxisSpec>(() => ({ min: 0, max: F_MAX, label: 'frequency (Hz)' }), []);
  const xAxisSmall = useMemo<AxisSpec>(() => ({ min: 0, max: F_MAX }), []);
  const yAxis = useMemo<AxisSpec>(() => ({ min: -yMax, max: yMax, label: `Im (${unit})`, ticks: niceTicks(-yMax, yMax, 2) }), [yMax, unit]);

  // Measured shape of the selected mode: Im readings normalised by the largest magnitude.
  const r = mode - 1;
  const vals = frfs.map((F) => F.read[r].val);
  // Divide by the largest-magnitude reading *with its sign*, so the normalised shape does not flip sign when the
  // data are converted between accelerance and receptance (a common factor −1/ωₙ², LC2-13).
  const big = vals.reduce((b, v) => (Math.abs(v) > Math.abs(b) ? v : b), 0);
  const nLevelR = NOISE_A * (form === 'A' ? 1 : 1 / (TAU * fr[r]) ** 2) * scale;
  const visible = Math.abs(big) > 4 * nLevelR;
  const shape = vals.map((v) => (big !== 0 ? v / big : 0));
  // Analytic shape fitted to the measured points (scale chosen by least squares, LC2-13).
  const an = xs.map((x) => pinnedShape(mode, x));
  const aa = an.reduce((s, a) => s + a * a, 0);
  const fit = aa > 1e-9 ? shape.reduce((s, m, i) => s + m * an[i], 0) / aa : 0;
  const analytic = useMemo(() => sample((x) => pinnedShape(mode, x), 0, 1, 200), [mode]);
  const fitted = useMemo(() => ({ x: analytic.x, y: Array.from(analytic.y, (v) => v * fit) }), [analytic, fit]);
  const refAtNode = Math.abs(pinnedShape(mode, xs[ref])) < 0.05;

  // ---------------------------------------------------------------- animated beam in the selected mode
  const wrapRef = useRef<HTMLDivElement>(null);
  const beamRef = useRef<SVGPathElement>(null);
  const ptRefs = [useRef<SVGGElement>(null), useRef<SVGGElement>(null), useRef<SVGGElement>(null)];
  const th = useRef(0);
  const BX0 = 30;
  const BX1 = 330;
  const BY = 78;
  const AMP = 26;
  useRaf(
    (dt) => {
      th.current = (th.current + TAU * 0.6 * dt) % TAU;
      const s = Math.sin(th.current);
      let d = '';
      for (let i = 0; i <= 60; i++) {
        const x = i / 60;
        const y = BY - AMP * s * fit * pinnedShape(mode, x);
        d += `${i ? 'L' : 'M'}${(BX0 + (BX1 - BX0) * x).toFixed(1)} ${y.toFixed(1)}`;
      }
      beamRef.current?.setAttribute('d', d);
      ptRefs.forEach((pr, i) => pr.current?.setAttribute('transform', `translate(0 ${(-AMP * s * (visible ? shape[i] : 0)).toFixed(1)})`));
    },
    true,
    wrapRef
  );

  const setX = (i: number, v: number) => setXs((old) => old.map((x, j) => (j === i ? v : x)) as [number, number, number]);
  const label = (p: number) => {
    const F = frfs[p];
    return `H${SUB[F.resp]}${SUB[F.force]}`;
  };

  const roving = test === 'column' ? 'accelerometer' : 'hammer';
  const fixed = test === 'column' ? 'hammer' : 'accelerometer';

  return (
    <div ref={wrapRef}>
      <SimLayout
        visual={
          <>
            <svg viewBox="0 0 360 150" className="anim" style={{ maxWidth: 560 }} role="img" aria-label={`Pinned–pinned beam with three measurement points vibrating in mode ${mode}`}>
              <line x1={BX0} x2={BX1} y1={BY} y2={BY} stroke="var(--border)" strokeDasharray="4 4" />
              <path ref={beamRef} d={`M${BX0} ${BY}L${BX1} ${BY}`} fill="none" stroke={MODE_COLORS[r]} strokeWidth={4} strokeLinecap="round" />
              {[BX0, BX1].map((x) => (
                <path key={x} d={`M${x} ${BY}l-9 15h18z`} fill="var(--surface-2)" stroke="var(--text-2)" strokeWidth={1.5} />
              ))}
              {xs.map((x, i) => {
                const px = BX0 + (BX1 - BX0) * x;
                const isRef = i === ref;
                const hammerHere = test === 'column' ? isRef : true;
                const accHere = test === 'column' ? true : isRef;
                return (
                  <g key={i}>
                    <g ref={ptRefs[i]}>
                      <circle cx={px} cy={BY} r={6} fill="var(--surface)" stroke="var(--text)" strokeWidth={2} />
                    </g>
                    <text x={px} y={BY + 34} textAnchor="middle" className="plot-note">
                      {`P${i + 1}`}
                    </text>
                    {hammerHere && (
                      <g opacity={isRef || test === 'row' ? 1 : 0.4}>
                        <rect x={px - 9} y={18} width={18} height={10} rx={2} fill="var(--surface-2)" stroke="var(--text)" strokeWidth={1.5} />
                        <line x1={px} x2={px} y1={4} y2={18} stroke="var(--text-2)" strokeWidth={3} />
                        <line x1={px} x2={px} y1={30} y2={46} stroke="var(--text-3)" strokeWidth={1.2} strokeDasharray="2 2" />
                      </g>
                    )}
                    {accHere && <rect x={px - 6} y={BY + 40} width={12} height={10} rx={2} fill={isRef && test === 'row' ? 'var(--accent)' : 'var(--text-2)'} opacity={0.85} />}
                  </g>
                );
              })}
              <text x={6} y={146} className="plot-note">
                {test === 'column' ? `hammer fixed at P${ref + 1}, accelerometer roves (a column)` : `accelerometer fixed at P${ref + 1}, hammer roves (a row)`}
              </text>
            </svg>
            {[0, 1, 2].map((p) => (
              <div key={p}>
                <div className="small">
                  <strong>{`P${p + 1}`}</strong>
                  <span className="muted">{` (x = ${xs[p].toFixed(2)}L): Im ${label(p)}, ${test === 'column' ? `accelerometer at P${p + 1}, hammer at P${ref + 1}` : `hammer at P${p + 1}, accelerometer at P${ref + 1}`}`}</span>
                </div>
                <Plot x={p === 2 ? xAxis : xAxisSmall} y={yAxis} height={p === 2 ? 140 : 110} ariaLabel={`Imaginary part of ${label(p)} against frequency`}>
                  {fr.map((f, i) => (
                    <VLine key={i} x={f} color={MODE_COLORS[i]} width={1.4} />
                  ))}
                  <Line points={{ x: frfs[p].f, y: frfs[p].im }} color="var(--text)" width={1.8} />
                  {fr.map((f, i) => (
                    <Dot key={i} x={f} y={frfs[p].read[i].val} color={MODE_COLORS[i]} r={i === r ? 5.5 : 3.5} />
                  ))}
                </Plot>
              </div>
            ))}
            <Legend items={fr.map((f, i) => ({ label: `mode ${i + 1}: ${f} Hz`, color: MODE_COLORS[i] }))} />
            <div className="small">
              <strong>{`Mode ${mode} shape from Im H at ${fr[r]} Hz`}</strong>
            </div>
            <Plot x={{ min: 0, max: 1, label: 'position x/L' }} y={{ min: -1.25, max: 1.25, label: 'shape (normalised)', ticks: [-1, 0, 1] }} height={170} ariaLabel={`Measured mode ${mode} shape with the theoretical shape`}>
              <Line points={fitted} color={MODE_COLORS[r]} width={1.6} dash />
              {visible && <Stems xs={xs} ys={shape} color={MODE_COLORS[r]} width={3} />}
            </Plot>
            <Legend
              items={[
                { label: 'measured: Im H at each point ÷ the largest', color: MODE_COLORS[r] },
                { label: `theory sin(${mode}πx/L), scaled to fit`, color: MODE_COLORS[r], dash: true },
              ]}
            />
          </>
        }
        controls={
          <>
            <Segmented
              label="Test"
              value={test}
              onChange={setTest}
              options={[
                { value: 'column', label: 'Roving accelerometer', title: 'fixed hammer: a column of H' },
                { value: 'row', label: 'Roving hammer', title: 'fixed accelerometer: a row of H' },
              ]}
            />
            <div className="row gap-s wrap">
              <span className="small">{`Fixed ${fixed} at`}</span>
              <Segmented
                size="sm"
                label={`Point where the ${fixed} stays`}
                value={ref}
                onChange={setRef}
                options={[0, 1, 2].map((i) => ({ value: i, label: `P${i + 1}` }))}
              />
            </div>
            <div className="row gap-s wrap">
              <span className="small">Mode to read</span>
              <Segmented size="sm" label="Mode" value={mode} onChange={setMode} options={[1, 2, 3].map((i) => ({ value: i, label: `${i}` }))} />
            </div>
            <Segmented
              size="sm"
              label="FRF form"
              value={form}
              onChange={setForm}
              options={[
                { value: 'A', label: 'Accelerance' },
                { value: 'H', label: 'Receptance' },
              ]}
            />
            {[0, 1, 2].map((i) => (
              <Slider key={i} label={`position of P${i + 1}`} tex={`x_${i + 1}/L`} tip={`P${i + 1} along the beam (0 and 1 are the supports)`} value={xs[i]} min={0} max={1} step={0.01} sig={2} onChange={(v) => setX(i, v)} />
            ))}
            <div className="row gap-s wrap">
              <span className="muted small">Points:</span>
              <Button size="sm" onClick={() => setXs([0.25, 0.5, 0.75])}>
                quarter points
              </Button>
              <Button size="sm" onClick={() => setXs([0.2, 0.45, 0.7])}>
                off the nodes
              </Button>
              <Button size="sm" onClick={() => setXs([0, 0.5, 1])}>
                ends and middle
              </Button>
            </div>
            <Slider label="modal damping" tex="\zeta" tip="damping ratio of every mode" value={zeta} min={0.005} max={0.05} step={0.001} sig={2} onChange={setZeta} />
            <Toggle checked={noisy} onChange={setNoisy} label="measurement noise" />
            {/* One row per point: Im H and its coherence side by side (two wide columns, so long units do not wrap). */}
            <Readouts min={150}>
              {frfs.flatMap((F, i) => [
                <Readout key={`im${i}`} tex={`\\text{Im}\\,H_{${F.resp + 1}${F.force + 1}}`} tip={`Im ${label(i)} at ${fr[r]} Hz (response at P${F.resp + 1}, force at P${F.force + 1})`} value={F.read[r].val} unit={unit} sig={3} tone={r === 0 ? 'm1' : r === 1 ? 'm2' : 'm3'} />,
                <Readout
                  key={`c${i}`}
                  tex={`\\gamma^2_{${F.resp + 1}${F.force + 1}}`}
                  label="coherence"
                  tip={`coherence of ${label(i)} at ${fr[r]} Hz: (signal power)/(signal + noise power). It drops when P${F.resp + 1} or the force point sits on a node of mode ${mode} (only the other modes' small off-resonance response is left), and is about 0 on a support, a node of every mode`}
                  value={F.read[r].coh < 1e-6 ? 0 : F.read[r].coh}
                  sig={3}
                  tone={F.read[r].coh > 0.9 ? 'ok' : F.read[r].coh > 0.5 ? 'warn' : 'bad'}
                />,
              ])}
            </Readouts>
            <div className="row gap-s wrap">
              <Badge tone={visible ? 'ok' : 'bad'}>{visible ? `shape ${shape.map((v) => (Math.abs(v) < 0.005 ? 0 : v).toFixed(2)).join(', ')}` : `mode ${mode} not seen in these FRFs`}</Badge>
              {refAtNode && <Badge tone="bad">{`P${ref + 1} is at a node of mode ${mode}`}</Badge>}
            </div>
            <Rich
              className="note"
              text={
                refAtNode
                  ? `The fixed ${fixed} sits on a node of mode ${mode}, so ${test === 'column' ? 'the hammer never excites it' : 'the accelerometer never sees it'}: the mode is missing from **every** FRF in this ${test}. Move the reference point.`
                  : `Reciprocity: $H_{ij} = H_{ji}$. Switching between a roving ${roving} and a roving ${fixed} gives the same numbers (within noise), so rows and columns give the same mode shapes.`
              }
            />
          </>
        }
      />
      <PredictReveal
        id="c2-modal-midspan"
        question="Points at the quarter points. Fix the **hammer at mid-span** (P2 = 0.5L) and rove the accelerometer. Which modes show up in the FRFs?"
        options={['all three', 'modes 1 and 3 only', 'mode 2 only']}
        answer={1}
        explain="Mid-span is a node of mode 2 (and 4) of a pinned–pinned beam: a force there does no work on that mode, so it is not excited and vanishes from the whole column. This is 2024 A3.5(b): with the shaker at 0.5L only modes 1 and 3 can be identified."
        tryIt="press quarter points, choose Roving accelerometer with the hammer fixed at P2, and look at mode 2’s line."
        onApply={() => {
          setXs([0.25, 0.5, 0.75]);
          setTest('column');
          setRef(1);
          setMode(2);
        }}
      />
      <PredictReveal
        id="c2-modal-reciprocity"
        question="With the hammer fixed at P1 you measured a column. You now fix the accelerometer at P1 and rove the hammer (a row). The mode-2 shape you get is…"
        options={['different, because force and response have swapped', 'the same: H₁ⱼ = Hⱼ₁ (reciprocity)', 'impossible to get from a row']}
        answer={1}
        explain="For a linear structure the FRF matrix is symmetric, so the row through P1 contains the same functions as the column through P1. The roving-hammer test (one accelerometer, many hits) relies on this; “rows cannot be used” is the false statement in official 2017 A3.6(b) and 2025 A3.4(b)."
        tryIt="read the mode-2 shape, then switch the Test to Roving hammer."
        onApply={() => {
          setRef(0);
          setMode(2);
          setTest('row');
        }}
      />
      <PredictReveal
        id="c2-modal-support"
        question="An accelerometer is placed right on a support (x = 0). Its coherence will be…"
        options={['high at every resonance', 'close to zero at all frequencies', 'low only at anti-resonances']}
        answer={1}
        explain="A support is a node of every mode, so the sensor records only noise that is uncorrelated with the force: coherence ≈ 0 everywhere (2024 A3.5(a)). A point exactly at the node of one mode loses only that mode."
        tryIt="press ends and middle with a roving accelerometer, and read the coherence of P1."
        onApply={() => {
          setXs([0, 0.5, 1]);
          setTest('column');
          setRef(1);
          setMode(1);
          setNoisy(true);
        }}
      />
      <PredictReveal
        id="c2-modal-form"
        question="Switch the data from accelerance to receptance. Does the measured mode shape change?"
        options={['yes, the high modes shrink', 'no: every point is multiplied by the same −1/ωₙ²']}
        answer={1}
        explain="At one natural frequency the conversion $H = A/(-\omega_n^2)$ scales every point by the same factor (and flips all signs together), so the normalised shape is unchanged (LC2-13). What does change is how the FRF looks: receptance shrinks the higher modes by $1/\omega^2$."
        tryIt="read mode 3’s shape, then switch the FRF form."
        onApply={() => {
          setMode(3);
          setForm('H');
        }}
      />
    </div>
  );
}
