// Four linked views of one FRF (magnitude, phase, real, imaginary) plus a Nyquist plot, for an SDOF or a
// 2-DoF chain, as receptance, mobility or accelerance. Hover any view (or use the probe slider) and the same
// frequency is marked in all of them.
import { useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { type C, cabs } from '../../../physics/complex';
import { modalSumFRF, sdofReceptance, type ModalTerm } from '../../../physics/frf';
import { modes as solveModes } from '../../../physics/mdof';
import { Dot, Line, Plot, VLine, type AxisSpec } from '../../../plot/Plot';
import { Button, Legend, Readout, Readouts, Segmented, SimLayout, Slider, Toggle } from '../../../ui/kit';
import { PredictReveal } from '../../../ui/PredictReveal';
import { Rich } from '../../../ui/Rich';
import { svgPoint } from '../../../ui/diagrams';
import { TAU, asForm, halfPowerExact, realExtremes, type FrfForm } from '../physics';
import { niceTicks } from './axes';

type Sys = 'sdof' | '2dof';
type Which = 'H11' | 'H21';
const MODE_COLORS = ['var(--m1)', 'var(--m2)'];
const FORM_INFO: Record<FrfForm, { name: string; sym: string; scale: number; unit: string; phaseAtRes: string }> = {
  H: { name: 'receptance', sym: 'H', scale: 1e6, unit: 'µm/N', phaseAtRes: '−90°' },
  M: { name: 'mobility', sym: 'M', scale: 1e3, unit: 'mm/s/N', phaseAtRes: '0°' },
  A: { name: 'accelerance', sym: 'A', scale: 1, unit: 'm/s²/N', phaseAtRes: '+90°' },
};

interface Sampled {
  w: number[];
  v: C[]; // scaled to display units
  mag: number[];
  ph: number[]; // unwrapped, degrees
  terms: C[][]; // per-mode contributions (scaled)
}

/** Frequency grid: uniform plus dense points around each resonance so narrow peaks are resolved. */
function grid(wMax: number, wr: number[], zeta: number): number[] {
  const pts: number[] = [];
  const n = 500;
  for (let i = 1; i <= n; i++) pts.push((wMax * i) / n);
  for (const w0 of wr) {
    const half = Math.max(8 * zeta, 0.02) * w0;
    for (let i = -100; i <= 100; i++) {
      const w = w0 + (half * i) / 100;
      if (w > 0 && w <= wMax) pts.push(w);
    }
  }
  pts.sort((a, b) => a - b);
  return pts.filter((w, i) => i === 0 || w - pts[i - 1] > 1e-9 * wMax);
}

function niceLogBounds(vals: number[]): [number, number] {
  let lo = Infinity;
  let hi = 0;
  for (const v of vals) {
    if (v > 0) {
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
  }
  if (!(hi > 0)) return [1e-3, 1];
  lo = Math.max(lo, hi * 1e-5);
  return [10 ** Math.floor(Math.log10(lo)), 10 ** Math.ceil(Math.log10(hi * 1.05))];
}

function linBounds(vals: number[], pad = 0.08): [number, number] {
  let lo = 0;
  let hi = 0;
  for (const v of vals) {
    if (Number.isFinite(v)) {
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
  }
  const span = hi - lo || 1;
  return [lo - pad * span, hi + pad * span];
}

const fmtV = (x: number) => Number(x.toPrecision(3)).toString();

export default function FrfViews() {
  const [sys, setSys] = useState<Sys>('sdof');
  const [form, setForm] = useState<FrfForm>('H');
  const [which, setWhich] = useState<Which>('H11');
  const [zeta, setZeta] = useState(0.065);
  const [k, setK] = useState(1e6);
  const [m, setM] = useState(100);
  const [k2r, setK2r] = useState(1);
  const [logMag, setLogMag] = useState(true);
  const [showTerms, setShowTerms] = useState(false);
  const [probe, setProbe] = useState(100);

  const info = FORM_INFO[form];

  // Modal model: SDOF (one term with phi = 1/sqrt(m)) or a 2-DoF chain k1 = k, k2 = k2r k, m1 = m2 = m.
  const model = useMemo(() => {
    if (sys === 'sdof') {
      const wn = Math.sqrt(k / m);
      return { wr: [wn], terms: [{ wn, zeta, phi: [1 / Math.sqrt(m), 0] }] as ModalTerm[], anti: NaN };
    }
    const k2 = k2r * k;
    const K = [
      [k + k2, -k2],
      [-k2, k2],
    ];
    const Mm = [
      [m, 0],
      [0, m],
    ];
    const res = solveModes(K, Mm);
    const terms: ModalTerm[] = res.omega.map((wn, i) => ({ wn, zeta, phi: [res.Pm[0][i], res.Pm[1][i]] }));
    return { wr: res.omega, terms, anti: Math.sqrt(k2 / m) };
  }, [sys, k, m, k2r, zeta]);

  const wMax = sys === 'sdof' ? 2 * model.wr[0] : 1.6 * model.wr[model.wr.length - 1];
  const jj = sys === 'sdof' ? 0 : which === 'H11' ? 0 : 1;

  const data = useMemo<Sampled>(() => {
    const w = grid(wMax, model.wr, zeta);
    const H = (ww: number, ts: ModalTerm[]) => (sys === 'sdof' && ts.length === 1 ? sdofReceptance(k, m, 2 * zeta * Math.sqrt(k * m), ww) : modalSumFRF(ts, jj, 0, ww));
    const scale = (z: C): C => ({ re: z.re * info.scale, im: z.im * info.scale });
    const v = w.map((ww) => scale(asForm(H(ww, model.terms), ww, form)));
    const mag = v.map(cabs);
    const ph: number[] = [];
    let prev = 0;
    v.forEach((z, i) => {
      let p = (Math.atan2(z.im, z.re) * 180) / Math.PI;
      if (i > 0) {
        while (p - prev > 180) p -= 360;
        while (p - prev < -180) p += 360;
      }
      ph.push(p);
      prev = p;
    });
    const terms = sys === '2dof' ? model.terms.map((t) => w.map((ww) => scale(asForm(modalSumFRF([t], jj, 0, ww), ww, form)))) : [];
    return { w, v, mag, ph, terms };
  }, [wMax, model, zeta, sys, k, m, jj, form, info.scale]);

  // Axis specs (memoised so the plots keep their scales between hover re-renders).
  const xAxis = useMemo<AxisSpec>(() => ({ min: 0, max: wMax, label: 'ω (rad/s)' }), [wMax]);
  const yMag = useMemo<AxisSpec>(() => {
    if (logMag) {
      const [lo, hi] = niceLogBounds(data.mag);
      return { min: lo, max: hi, log: true, label: `|${info.sym}| (${info.unit})` };
    }
    let hi = 0;
    for (const x of data.mag) hi = Math.max(hi, x);
    return { min: 0, max: hi * 1.08, label: `|${info.sym}| (${info.unit})` };
  }, [data, logMag, info]);
  const yPh = useMemo<AxisSpec>(() => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const p of data.ph) {
      lo = Math.min(lo, p);
      hi = Math.max(hi, p);
    }
    const a = Math.floor(lo / 90 - 0.01) * 90;
    const b = Math.ceil(hi / 90 + 0.01) * 90;
    const ticks: number[] = [];
    for (let t = a; t <= b; t += 90) ticks.push(t);
    return { min: a, max: b, label: 'phase (°)', ticks };
  }, [data]);
  const yRe = useMemo<AxisSpec>(() => {
    const [a, b] = linBounds(data.v.map((z) => z.re));
    return { min: a, max: b, label: `Re ${info.sym} (${info.unit})`, ticks: niceTicks(a, b) };
  }, [data, info]);
  const yIm = useMemo<AxisSpec>(() => {
    const [a, b] = linBounds(data.v.map((z) => z.im));
    return { min: a, max: b, label: `Im ${info.sym} (${info.unit})`, ticks: niceTicks(a, b) };
  }, [data, info]);

  // Memoised curves: hovering only re-renders the markers.
  const lines = useMemo(() => {
    const pts = (ys: number[]) => ({ x: data.w, y: ys });
    return {
      mag: <Line points={pts(data.mag)} color="var(--text)" width={2.2} />,
      ph: <Line points={pts(data.ph)} color="var(--text)" width={2} />,
      re: <Line points={pts(data.v.map((z) => z.re))} color="var(--text)" width={2.2} />,
      im: <Line points={pts(data.v.map((z) => z.im))} color="var(--text)" width={2.2} />,
      termsRe: data.terms.map((t, i) => <Line key={i} points={pts(t.map((z) => z.re))} color={MODE_COLORS[i]} width={1.4} dash />),
      termsIm: data.terms.map((t, i) => <Line key={i} points={pts(t.map((z) => z.im))} color={MODE_COLORS[i]} width={1.4} dash />),
      termsMag: data.terms.map((t, i) => <Line key={i} points={pts(t.map(cabs))} color={MODE_COLORS[i]} width={1.4} dash />),
    };
  }, [data]);

  // Probe (nearest sample to the probe frequency).
  const pi = useMemo(() => {
    let best = 0;
    for (let i = 1; i < data.w.length; i++) if (Math.abs(data.w[i] - probe) < Math.abs(data.w[best] - probe)) best = i;
    return best;
  }, [data, probe]);
  const pw = data.w[pi];
  const pv = data.v[pi];
  const onHover = (x: number | null) => {
    if (x !== null && Number.isFinite(x)) setProbe(Math.max(data.w[0], Math.min(wMax, x)));
  };

  // SDOF landmarks (receptance-based).
  const wn1 = model.wr[0];
  const hp = halfPowerExact(wn1, zeta);
  const rex = realExtremes(k, wn1, zeta);

  // ---------------------------------------------------------------- Nyquist (custom square SVG, equal scales)
  const nyq = useMemo(() => {
    let reMin = 0;
    let reMax = 0;
    let imMin = 0;
    let imMax = 0;
    for (const z of data.v) {
      reMin = Math.min(reMin, z.re);
      reMax = Math.max(reMax, z.re);
      imMin = Math.min(imMin, z.im);
      imMax = Math.max(imMax, z.im);
    }
    const span = Math.max(reMax - reMin, imMax - imMin) * 1.12 || 1;
    const cRe = (reMin + reMax) / 2;
    const cIm = (imMin + imMax) / 2;
    const X = (re: number) => 150 + ((re - cRe) / span) * 270;
    const Y = (im: number) => 150 - ((im - cIm) / span) * 270;
    let d = '';
    data.v.forEach((z, i) => (d += `${i ? 'L' : 'M'}${X(z.re).toFixed(1)} ${Y(z.im).toFixed(1)}`));
    return { X, Y, d, span };
  }, [data]);
  const nyqRef = useRef<SVGSVGElement>(null);
  const onNyq = (e: RPointerEvent<SVGSVGElement>) => {
    if (!nyqRef.current) return;
    const p = svgPoint(nyqRef.current, e.clientX, e.clientY);
    let best = 0;
    let bd = Infinity;
    data.v.forEach((z, i) => {
      const dd = (nyq.X(z.re) - p.x) ** 2 + (nyq.Y(z.im) - p.y) ** 2;
      if (dd < bd) {
        bd = dd;
        best = i;
      }
    });
    setProbe(data.w[best]);
  };

  const preset = (p: '2025' | '2024' | 'chain') => {
    if (p === '2025') {
      setSys('sdof');
      setForm('H');
      setK(1e6);
      setM(100);
      setZeta(0.065);
      setProbe(100);
    } else if (p === '2024') {
      setSys('sdof');
      setForm('H');
      setK(1e4);
      setM(1e4 / (TAU * 12) ** 2);
      setZeta(0.03);
      setProbe(TAU * 12);
    } else {
      setSys('2dof');
      setForm('H');
      setWhich('H11');
      setK(1e6);
      setM(100);
      setK2r(1);
      setZeta(0.02);
      setProbe(100);
    }
  };

  const modeLines = model.wr.map((w, i) => <VLine key={i} x={w} color={MODE_COLORS[i]} width={1.6} />);
  const probeDot = (y: number) => <Dot x={pw} y={y} color="var(--accent)" r={5} />;

  return (
    <div>
      <SimLayout
        visual={
          <>
            <Plot x={xAxis} y={yMag} height={220} onHover={onHover} cursorX={pw} ariaLabel="FRF magnitude against frequency">
              {modeLines}
              {showTerms && lines.termsMag}
              {lines.mag}
              {sys === 'sdof' && form === 'H' && (
                <>
                  <Dot x={hp[0]} y={((1 / (2 * zeta * k)) * info.scale) / Math.SQRT2} color="var(--m1)" hollow r={4} />
                  <Dot x={hp[1]} y={((1 / (2 * zeta * k)) * info.scale) / Math.SQRT2} color="var(--m1)" hollow r={4} label="half-power" labelPos="right" />
                </>
              )}
              {probeDot(data.mag[pi])}
            </Plot>
            <Plot x={xAxis} y={yPh} height={150} onHover={onHover} cursorX={pw} ariaLabel="FRF phase against frequency">
              {modeLines}
              {lines.ph}
              {probeDot(data.ph[pi])}
            </Plot>
            <Plot x={xAxis} y={yRe} height={170} onHover={onHover} cursorX={pw} ariaLabel="Real part of the FRF against frequency">
              {modeLines}
              {showTerms && lines.termsRe}
              {lines.re}
              {sys === 'sdof' && form === 'H' && (
                <>
                  <Dot x={rex.w1} y={rex.v1 * info.scale} color="var(--m1)" hollow r={4} label="peak" labelPos="left" />
                  <Dot x={rex.w2} y={rex.v2 * info.scale} color="var(--m1)" hollow r={4} label="trough" labelPos="right" />
                </>
              )}
              {probeDot(pv.re)}
            </Plot>
            <Plot x={xAxis} y={yIm} height={170} onHover={onHover} cursorX={pw} ariaLabel="Imaginary part of the FRF against frequency">
              {modeLines}
              {showTerms && lines.termsIm}
              {lines.im}
              {probeDot(pv.im)}
            </Plot>
            <Legend
              items={[
                { label: `${info.name} ${sys === '2dof' ? which : ''}`, color: 'var(--text)' },
                ...model.wr.map((w, i) => ({ label: `mode ${i + 1}: ${fmtV(w)} rad/s`, color: MODE_COLORS[i] })),
                ...(showTerms && sys === '2dof' ? [{ label: 'modal terms', color: 'var(--text-3)', dash: true }] : []),
              ]}
            />
            <p className="muted small">Hover over any plot (or the Nyquist circle, or use the probe slider): the same frequency is marked everywhere.</p>
          </>
        }
        controls={
          <>
            <Segmented
              label="System"
              value={sys}
              onChange={(s: Sys) => {
                setSys(s);
                setProbe(s === 'sdof' ? Math.sqrt(k / m) : 0.618 * Math.sqrt(k / m));
              }}
              options={[
                { value: 'sdof', label: 'SDOF' },
                { value: '2dof', label: '2-DoF chain' },
              ]}
            />
            <Segmented
              label="FRF form"
              value={form}
              onChange={setForm}
              options={[
                { value: 'H', label: 'Receptance', title: 'displacement / force' },
                { value: 'M', label: 'Mobility', title: 'velocity / force' },
                { value: 'A', label: 'Accelerance', title: 'acceleration / force' },
              ]}
            />
            {sys === '2dof' && (
              <Segmented
                size="sm"
                label="Which FRF"
                value={which}
                onChange={setWhich}
                options={[
                  { value: 'H11', label: 'H₁₁ (driving point)' },
                  { value: 'H21', label: 'H₂₁ (transfer)' },
                ]}
              />
            )}
            <Slider label="damping ratio" tex="\zeta" tip="modal damping ratio (both modes)" value={zeta} min={0.005} max={0.3} log sig={3} onChange={setZeta} />
            <Slider label="probe frequency" tex="\omega" tip="frequency marked in every view" value={pw} min={data.w[0]} max={wMax} step={wMax / 1000} unit="rad/s" sig={4} onChange={setProbe} />
            <details className="more">
              <summary>Stiffness and mass{sys === '2dof' ? ' (each of the two)' : ''}</summary>
              <div className="more-body">
                <Slider label="stiffness" tex="k" tip={sys === 'sdof' ? 'spring stiffness' : 'k₁ (to ground)'} value={k} min={1e3} max={1e7} log unit="N/m" sig={3} onChange={setK} />
                <Slider label="mass" tex="m" tip={sys === 'sdof' ? 'mass' : 'each mass, m₁ = m₂'} value={m} min={0.1} max={1000} log unit="kg" sig={3} onChange={setM} />
                {sys === '2dof' && <Slider label="coupling spring ratio" tex="k_2/k_1" tip="stiffness of the spring between the masses, relative to k₁" value={k2r} min={0.2} max={5} log sig={3} onChange={setK2r} />}
              </div>
            </details>
            <div className="row gap-s wrap">
              <Toggle checked={logMag} onChange={setLogMag} label="log magnitude" />
              {sys === '2dof' && <Toggle checked={showTerms} onChange={setShowTerms} label="show modal terms" />}
            </div>
            {/* Two wide columns: mobility and accelerance units (mm/s/N, m/s²/N) would wrap in the default grid. */}
            <Readouts min={140}>
              <Readout tex="\omega" tip="probe frequency" value={pw} unit="rad/s" sig={4} />
              <Readout tex="\angle" tip="phase of the response relative to the force" value={data.ph[pi]} unit="°" sig={3} />
              <Readout tex={`\\text{Re}\\,${info.sym}`} tip="real part at the probe" value={pv.re} unit={info.unit} sig={3} />
              <Readout tex={`\\text{Im}\\,${info.sym}`} tip="imaginary part at the probe" value={pv.im} unit={info.unit} sig={3} />
              <Readout tex={`|${info.sym}|`} tip={`${info.name} magnitude at the probe`} value={data.mag[pi]} unit={info.unit} sig={3} />
              {sys === 'sdof' ? (
                <>
                  <Readout tex="\omega_n" tip="√(k/m)" value={wn1} unit="rad/s" sig={4} tone="m1" />
                  <Readout tex="1/k" tip="receptance at 0 Hz, H(0)" value={(1 / k) * 1e6} unit="µm/N" sig={3} />
                  <Readout tex="\tfrac{1}{2\zeta k}" tip="receptance peak height |H|max ≈ Q·H(0)" value={(1 / (2 * zeta * k)) * 1e6} unit="µm/N" sig={3} />
                  <Readout tex="\omega_1" tip="lower half-power point, where |H| = |H(ωₙ)|/√2: ωₙ√(1−2ζ²−2ζ√(1+ζ²))" value={hp[0]} unit="rad/s" sig={4} />
                  <Readout tex="\omega_2" tip="upper half-power point: ωₙ√(1−2ζ²+2ζ√(1+ζ²)); (ω₂ − ω₁)/(2ωₙ) ≈ ζ" value={hp[1]} unit="rad/s" sig={4} />
                </>
              ) : (
                <>
                  <Readout tex="\omega_1" tip="first natural frequency" value={model.wr[0]} unit="rad/s" sig={4} tone="m1" />
                  <Readout tex="\omega_2" tip="second natural frequency" value={model.wr[1]} unit="rad/s" sig={4} tone="m2" />
                  <Readout tex="\omega_A" tip="anti-resonance of H₁₁ at √(k₂/m₂): mass 2 alone on k₂" value={model.anti} unit="rad/s" sig={4} />
                </>
              )}
            </Readouts>
            <svg
              ref={nyqRef}
              viewBox="0 0 300 300"
              className="anim"
              style={{ maxWidth: 300, touchAction: 'none', cursor: 'crosshair' }}
              role="img"
              aria-label="Nyquist plot: imaginary part against real part"
              onPointerMove={onNyq}
              onPointerDown={onNyq}
            >
              <rect x={1} y={1} width={298} height={298} rx={8} fill="var(--surface)" stroke="var(--border)" />
              {nyq.X(0) > 4 && nyq.X(0) < 296 && <line x1={nyq.X(0)} x2={nyq.X(0)} y1={6} y2={294} stroke="var(--text-3)" strokeWidth={1} />}
              {nyq.Y(0) > 4 && nyq.Y(0) < 296 && <line y1={nyq.Y(0)} y2={nyq.Y(0)} x1={6} x2={294} stroke="var(--text-3)" strokeWidth={1} />}
              <text x={292} y={Math.min(290, Math.max(14, nyq.Y(0) - 6))} textAnchor="end" className="plot-note">
                Re
              </text>
              <text x={Math.min(290, Math.max(8, nyq.X(0) + 5))} y={16} className="plot-note">
                Im
              </text>
              <path d={nyq.d} fill="none" stroke="var(--text)" strokeWidth={2} />
              {model.terms.map((t, i) => {
                const j = data.w.reduce((b, w, q) => (Math.abs(w - t.wn) < Math.abs(data.w[b] - t.wn) ? q : b), 0);
                return <circle key={i} cx={nyq.X(data.v[j].re)} cy={nyq.Y(data.v[j].im)} r={4.5} fill={MODE_COLORS[i]} />;
              })}
              <circle cx={nyq.X(pv.re)} cy={nyq.Y(pv.im)} r={6} fill="var(--surface)" stroke="var(--accent)" strokeWidth={3} />
            </svg>
            <p className="muted small">
              Nyquist plot: Im against Re on equal scales, frequency running along the curve. Each isolated mode traces a near-circle of diameter about 1/(2ζk) (receptance); the points race round it near ωₙ. Enrichment only: the course reads Re and Im separately.
            </p>
            <Rich
              className="note"
              text={
                sys === 'sdof'
                  ? `At $\\omega_n$ the ${info.name} is ${form === 'M' ? 'purely real (phase 0°)' : `purely imaginary (phase ${info.phaseAtRes})`}: Re ${form === 'M' ? 'peaks' : 'crosses zero'} and Im ${form === 'M' ? 'crosses zero' : 'is extreme'}. ${form === 'H' ? 'The receptance Re peak and trough mark the half-power points.' : ''}`
                  : which === 'H11'
                    ? 'Driving point: between the two resonances the FRF dips to an **anti-resonance** (phase rises 180°).'
                    : 'Transfer FRF: no anti-resonance between the modes; the phase keeps falling, 180° per mode.'
              }
            />
            <div className="row gap-s wrap">
              <span className="muted small">Presets:</span>
              <Button size="sm" onClick={() => preset('2025')}>
                2025 A3.3
              </Button>
              <Button size="sm" onClick={() => preset('2024')}>
                2024 A3.4
              </Button>
              <Button size="sm" onClick={() => preset('chain')}>
                2-DoF chain
              </Button>
            </div>
          </>
        }
      />
      <PredictReveal
        id="c2-views-double-zeta"
        question="Double the damping ratio of an isolated mode. The receptance peak height and the half-power bandwidth…"
        options={['both halve', 'height halves, bandwidth doubles', 'height doubles, bandwidth halves', 'height halves, bandwidth unchanged']}
        answer={1}
        explain="$|H|_{peak} \approx 1/(2\zeta k)$ halves and the half-power bandwidth $\approx 2\zeta\omega_n$ doubles: a lower, broader peak with a more gradual phase drop. “Larger damping gives sharper peaks” is the false statement in 2024 A3.3(c)."
        tryIt="SDOF receptance with linear magnitude: note the peak and the two half-power dots, then double ζ."
        onApply={() => {
          setSys('sdof');
          setForm('H');
          setLogMag(false);
          setZeta((z) => Math.min(0.3, 2 * z));
        }}
      />
      <PredictReveal
        id="c2-views-real-zero"
        question="Where is the real part of an SDOF receptance **zero**, and where are its peak and trough?"
        options={['zero at the half-power points, peak at ωₙ', 'zero at ωₙ, peak and trough at the half-power points', 'it is never zero']}
        answer={1}
        explain="$\text{Re}\,H \propto 1-\beta^2$ vanishes at $\omega_n$; its extremes sit exactly at $\omega_n\sqrt{1\mp2\zeta}$, the half-power points. Saying “the real part peaks at a natural frequency” is the classic false statement (official 2018/2019 A3.6(a), 2023 A3.6(a)); it is the imaginary part that peaks."
        tryIt="put the probe on the mode line and look at the Re and Im plots."
        onApply={() => {
          setSys('sdof');
          setForm('H');
          setProbe(Math.sqrt(k / m));
        }}
      />
      <PredictReveal
        id="c2-views-accel-phase"
        question="Switch to **accelerance**. What is its phase at the resonance?"
        options={['−90°', '0°', '+90°', '180°']}
        answer={2}
        explain="$A = -\omega^2 H$ adds 180° to the receptance phase: accelerance starts at +180°, passes +90° at $\omega_n$ and ends near 0°. Mobility ($i\omega H$) passes 0°. That is why the 2022 A3.4 plot starts at +180°: it is an accelerance-type FRF."
        tryIt="choose Accelerance and move the probe onto the mode."
        onApply={() => {
          setForm('A');
          setProbe(model.wr[0]);
        }}
      />
      <PredictReveal
        id="c2-views-anti"
        question="On a 2-DoF chain, what does the **driving-point** FRF $H_{11}$ show between its two resonances that the transfer FRF $H_{21}$ does not?"
        options={['a third, smaller resonance', 'an anti-resonance: a sharp dip where the phase rises 180°', 'nothing different']}
        answer={1}
        explain="$H_{11}$ has an anti-resonance at $\sqrt{k_2/m_2}$ (the frequency at which mass 2 alone on $k_2$ resonates and holds mass 1 still). The transfer FRF $H_{21}$ of a chain never vanishes: its phase just keeps falling, 180° per mode. Coherence often dips at anti-resonances because the response there is tiny."
        tryIt="press the 2-DoF chain preset, then switch between H₁₁ and H₂₁."
        onApply={() => preset('chain')}
      />
    </div>
  );
}
