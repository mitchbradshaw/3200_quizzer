// The βL table and the ratio trick: a measured f₁ gives f₂, f₃… without EI; changing supports or vibrating
// length rescales everything by (βL ratio)² × (length ratio)².
import { useMemo, useState } from 'react';
import { type BeamBC, betaL, frequencyRatios } from '../../../physics/beams';
import { Line, Plot, PlotText, Stems, Dot } from '../../../plot/Plot';
import { Legend, Readout, Readouts, Segmented, SimLayout, Slider, modeColor, More, Select } from '../../../ui/kit';
import { PredictReveal } from '../../../ui/PredictReveal';
import { Rich } from '../../../ui/Rich';
import { fmt } from '../../../engine/format';
import { BC_NAME, BC_ORDER, BC_SHORT, RIGID } from '../physics';
import { modeTone } from './ModeShapes';

const SUB = '₁₂₃₄₅';
const MODES = [1, 2, 3, 4, 5];

export default function FrequencyRatios() {
  const [bc, setBc] = useState<BeamBC>('clamped-free');
  const [f1, setF1] = useState(8);
  const [unit, setUnit] = useState<'Hz' | 'rpm'>('Hz');
  const [target, setTarget] = useState<BeamBC>('clamped-clamped');
  const [lr, setLr] = useState(1);

  const ratios = useMemo(() => frequencyRatios(bc, 5), [bc]);
  const fs = ratios.map((r) => r * f1);
  const conv = (f: number) => (unit === 'Hz' ? f : f * 60);
  const b1 = betaL(bc, 1)[0];
  const tRoots = betaL(target, 4);
  const fTarget = tRoots.map((b) => f1 * (b / b1) ** 2 * lr * lr);

  // Spectrum: stems at f1..f4 (staggered label heights), with the string's harmonic series for contrast.
  const fmin = f1 / 2.5;
  const fmax = fs[3] * 1.8;
  const harmonics = [2, 3, 4, 5, 6, 7, 8].map((k) => k * f1).filter((f) => f < fmax);

  // Ratio chart across BCs (log y): the four distinct families plus wave-system references.
  const fam: BeamBC[] = ['clamped-free', 'pinned-pinned', 'clamped-clamped', 'clamped-pinned'];
  const famOf = (b: BeamBC): BeamBC => (b === 'free-free' ? 'clamped-clamped' : b === 'free-pinned' ? 'clamped-pinned' : b);
  const lines = useMemo(() => fam.map((b) => ({ b, pts: frequencyRatios(b, 5).map((r, k) => [k + 1, r] as const) })), []);
  const strPts = MODES.map((i) => [i, i] as const);
  const rodPts = MODES.map((i) => [i, 2 * i - 1] as const);

  return (
    <div>
      <SimLayout
        visual={
          <>
            <Plot x={{ min: fmin, max: fmax, log: true, label: unit === 'Hz' ? 'frequency (Hz)' : 'frequency (Hz; labels in rpm)' }} y={{ min: 0, max: 1.3, ticks: [], noGrid: true }} height={190} ariaLabel="Spectrum: beam natural frequencies against the harmonic series of a string" margin={{ l: 14 }}>
              <Stems xs={harmonics} ys={harmonics.map(() => 0.42)} color="var(--text-3)" width={1.2} />
              {fs.slice(0, 4).map((f, k) => (
                <Stems key={k} xs={[f]} ys={[k % 2 ? 0.78 : 1.0]} color={modeColor(k + 1)} width={3} />
              ))}
              {fs.slice(0, 4).map((f, k) => (
                <PlotText key={`t${k}`} x={f} y={k % 2 ? 0.78 : 1.0} dy={-8} anchor="middle" color={modeColor(k + 1)}>
                  {`f${SUB[k]} = ${fmt(conv(f), 4)}${unit === 'rpm' ? ' rpm' : ' Hz'}`}
                </PlotText>
              ))}
            </Plot>
            <Legend items={[{ label: 'grey stems: a string’s harmonics 2f₁, 3f₁, … (evenly spaced, for contrast)', color: 'var(--text-3)' }]} />
            <Plot x={{ min: 0.8, max: 5.2, label: 'mode number i', ticks: MODES, format: (v) => String(v) }} y={{ min: 1, max: 100, log: true, label: 'ωᵢ / ω₁' }} height={230} ariaLabel="Frequency ratios against mode number for each boundary condition">
              <Line points={strPts} color="var(--text-3)" dash="2 4" width={1.4} />
              <Line points={rodPts} color="var(--text-3)" dash="7 4" width={1.4} />
              {lines.map((l) =>
                l.b === famOf(bc) ? null : <Line key={l.b} points={l.pts} color="var(--text-3)" width={1.2} opacity={0.7} />
              )}
              {lines
                .filter((l) => l.b === famOf(bc))
                .map((l) => (
                  <g key="sel">
                    <Line points={l.pts} color="var(--text)" width={2.4} />
                    {l.pts.map(([i, r]) => (
                      <Dot key={i} x={i} y={r} color={modeColor(i)} />
                    ))}
                    <PlotText x={5} y={l.pts[4][1]} dx={-8} dy={-9} anchor="end" color="var(--text)">
                      {`${BC_SHORT[bc]}: ${l.pts.slice(0, 3).map(([, r]) => r.toFixed(2)).join(' : ')}`}
                    </PlotText>
                  </g>
                ))}
              <PlotText x={5} y={5} dx={-4} dy={14} anchor="end" color="var(--text-3)">
                {'string 1:2:3'}
              </PlotText>
              <PlotText x={5} y={9} dx={-4} dy={-6} anchor="end" color="var(--text-3)">
                {'rod fixed–free 1:3:5'}
              </PlotText>
            </Plot>
            <Legend
              items={[
                { label: `${BC_SHORT[bc]} (selected)`, color: 'var(--text)' },
                { label: 'other beam BCs', color: 'var(--text-3)' },
                { label: 'wave systems (B2)', color: 'var(--text-3)', dash: true },
              ]}
            />
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ fontSize: '0.8rem' }} aria-label="Handout beta L table">
                <thead>
                  <tr>
                    <th style={{ padding: '4px 5px' }}>BCs</th>
                    <th style={{ padding: '4px 5px' }}>β₁L</th>
                    <th style={{ padding: '4px 5px' }}>β₂L</th>
                    <th style={{ padding: '4px 5px' }}>β₃L</th>
                    <th style={{ padding: '4px 5px' }}>ω₂/ω₁</th>
                    <th style={{ padding: '4px 5px' }}>ω₃/ω₁</th>
                  </tr>
                </thead>
                <tbody>
                  {BC_ORDER.map((b) => {
                    const r = betaL(b, 3);
                    const q = frequencyRatios(b, 3);
                    const on = b === bc;
                    const st = { padding: '4px 5px', fontWeight: on ? 700 : undefined, background: on ? 'var(--accent-soft)' : undefined };
                    return (
                      <tr key={b} onClick={() => setBc(b)} style={{ cursor: 'pointer' }}>
                        <td style={st} title={BC_NAME[b]}>
                          {BC_SHORT[b]}
                          {RIGID[b] ? <span className="muted"> +{RIGID[b]}R</span> : null}
                        </td>
                        {r.map((x, k) => (
                          <td key={k} style={st} className="mono">
                            {b === 'pinned-pinned' ? `${k + 1}π` : x.toFixed(3)}
                          </td>
                        ))}
                        <td style={st} className="mono">{q[1].toFixed(2)}</td>
                        <td style={st} className="mono">{q[2].toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="muted small">+nR: rigid-body modes at ω = 0 that the handout does not list. Click a row to select it.</p>
            </div>
          </>
        }
        controls={
          <>
            <div>
              <div className="muted small">Boundary conditions of the measured beam</div>
              <Segmented size="sm" label="Boundary conditions" value={bc} onChange={(v: BeamBC) => setBc(v)} options={BC_ORDER.map((b) => ({ value: b, label: BC_SHORT[b], title: BC_NAME[b] }))} />
              <div className="small" style={{ marginTop: 4 }}>
                <strong>{BC_NAME[bc]}</strong>
              </div>
            </div>
            <Slider label="measured" tex="f_1" tip="first natural frequency from a test (Hz)" value={f1} min={0.5} max={500} log unit="Hz" sig={3} onChange={setF1} />
            <div className="row gap-s wrap">
              <span className="muted small">Show in</span>
              <Segmented size="sm" label="Units" value={unit} onChange={setUnit} options={[{ value: 'Hz' as const, label: 'Hz' }, { value: 'rpm' as const, label: 'rpm' }]} />
            </div>
            <Readouts>
              {[2, 3, 4].map((i) => (
                <Readout key={i} tex={`f_${i}`} tip={`f${SUB[i - 1]} = (β${SUB[i - 1]}L/β₁L)² f₁ = ${ratios[i - 1].toFixed(3)} f₁`} value={conv(fs[i - 1])} unit={unit} sig={4} tone={modeTone(i)} />
              ))}
              <Readout tex="(\beta_2L/\beta_1L)^2" tip="ratio trick factor for mode 2 (no EI, ρA or L needed)" value={ratios[1]} sig={4} />
            </Readouts>
            <Rich className="note" text={`Ratio trick: $f_i = (\\beta_i L/\\beta_1 L)^2 f_1$. For ${BC_SHORT[bc]}: $f_2 = (${betaL(bc, 2)[1].toFixed(3)}/${b1.toFixed(3)})^2 \\times ${fmt(f1, 3)}$ = ${fmt(fs[1], 4)} Hz. Squaring matters: the unsquared ratio ${(betaL(bc, 2)[1] / b1).toFixed(3)} is a classic slip.`} />
            <More label="Change the supports or the vibrating length" open>
              <div className="row gap-s wrap">
                <span className="muted small">New supports</span>
                <Select value={target} onChange={(v) => setTarget(v as BeamBC)} label="New boundary conditions" options={BC_ORDER.map((b) => ({ value: b, label: BC_NAME[b] }))} />
              </div>
              <Slider label="measured length / new length" tex="L_c/L" tip="vibrating length in the test divided by the vibrating length in use (e.g. 0.85 when the handle is clamped)" value={lr} min={0.5} max={1.5} step={0.01} sig={3} onChange={setLr} />
              <Readouts>
                {[1, 2, 3].map((i) => (
                  <Readout key={i} tex={`f_${i}'`} tip={`new f${SUB[i - 1]} = f₁ (β${SUB[i - 1]}L_new/β₁L_test)² (L_c/L)²`} value={conv(fTarget[i - 1])} unit={unit} sig={4} tone={modeTone(i)} />
                ))}
                <Readout label="f₁ factor" tip="(β₁L_new/β₁L_test)² × (L_c/L)²" value={fTarget[0] / f1} sig={4} />
              </Readouts>
              <Rich className="note" text={`$\\omega \\propto (\\beta L)^2/L^2$: new $f_1$ = $f_1 \\times (${tRoots[0].toFixed(3)}/${b1.toFixed(3)})^2 \\times (${lr.toFixed(2)})^2$. ${RIGID[target] ? `The new supports also allow ${RIGID[target]} rigid-body mode${RIGID[target] > 1 ? 's' : ''} at ω = 0.` : ''}`} />
            </More>
          </>
        }
      />
      <PredictReveal
        id="b3-ratio-wing"
        question="A cantilevered wing has a measured $f_1$ = 8 Hz. What is $f_2$?"
        options={['16 Hz', '20 Hz', '50 Hz', '72 Hz']}
        answer={2}
        explain="$f_2 = (4.694/1.875)^2 \times 8 = 6.27 \times 8$ = 50.1 Hz, and $f_3 = 17.55 \times 8$ = 140 Hz (official 2018 B2.1). 20 Hz uses the unsquared ratio 2.50; 16 Hz assumes harmonics like a string; 72 Hz would need the 1 : 4 : 9 pinned–pinned spacing and the 9 of mode 3."
        tryIt="choose C–F and set the measured f₁ to 8 Hz."
        onApply={() => {
          setBc('clamped-free');
          setF1(8);
          setUnit('Hz');
        }}
      />
      <PredictReveal
        id="b3-ratio-clamp"
        question="The pins at both ends of a simply supported beam are replaced by clamps (same span). $f_1$ is multiplied by…"
        options={['1.51', '2.27', '4', 'nothing: it stays the same']}
        answer={1}
        explain="$(4.730/\pi)^2$ = 2.27. Clamps stop the end rotation, so the beam is stiffer in every mode. 1.51 forgets to square the βL ratio. Boundary conditions matter a lot: going the other way, to a cantilever, multiplies by $(1.875/\pi)^2$ = 0.356."
        tryIt="choose P–P as the measured beam and clamped–clamped as the new supports with Lc/L = 1."
        onApply={() => {
          setBc('pinned-pinned');
          setTarget('clamped-clamped');
          setLr(1);
        }}
      />
      <PredictReveal
        id="b3-ratio-rigid"
        question="A fuselage in flight is modelled as free–free with $f_1$ = 30 Hz. How many natural frequencies, **including rigid-body modes**, lie below 100 Hz?"
        options={['2', '3', '4']}
        answer={2}
        explain="Two rigid-body modes at 0 Hz (heave and pitch), then 30 Hz and $f_2 = 2.757 \times 30$ = 82.7 Hz; $f_3$ = 162 Hz is above. The handout lists only elastic modes, so count the ω = 0 modes only when a question asks you to (summary trap 10)."
        tryIt="choose F–F and set f₁ = 30 Hz."
        onApply={() => {
          setBc('free-free');
          setF1(30);
          setUnit('Hz');
        }}
      />
      <PredictReveal
        id="b3-ratio-racquet"
        question="A racquet clamped over its handle vibrates over 0.85 of its length, with $f_1$ = 48 Hz. Predict the third free–free frequency of the whole racquet in play."
        options={['≈ 260 Hz', '≈ 1193 Hz', '≈ 1403 Hz', '≈ 1651 Hz']}
        answer={1}
        explain="$f_3 = 48 \times (10.996/1.875)^2 \times 0.85^2$ = 48 × 34.39 × 0.7225 = 1193 Hz (Week 8 Q2). βL always refers to the vibrating length, so the clamped test is shorter and stiffer. 1651 Hz forgets the length factor, 1403 Hz uses 0.85 unsquared, and 260 Hz applies the free–free ratio to the cantilever's f₁."
        tryIt="set C–F, f₁ = 48 Hz, new supports free–free and Lc/L = 0.85."
        onApply={() => {
          setBc('clamped-free');
          setF1(48);
          setTarget('free-free');
          setLr(0.85);
        }}
      />
    </div>
  );
}
