// Static figures for C1 Solve problems (exam-style plots with data tips). Each factory returns a
// ComponentType so a generated instance can carry its own figure.
import type { ComponentType } from 'react';
import { Dot, HLine, Line, Plot, VLine, sample } from '../../plot/Plot';
import { Legend } from '../../ui/kit';
import { halfSineSpectrum, spectrumDropFrequency } from '../../physics/transducers';

const MODE_COLORS = ['var(--m1)', 'var(--m2)', 'var(--m3)'];
const hzTxt = (f: number) => (f >= 1000 ? `${(f / 1000).toPrecision(3)} kHz` : `${Math.round(f)} Hz`);

/** Force spectrum (dB re plateau) of a half-sine pulse with a noise floor, the −10/−20 dB levels and the modes. */
export function spectrumFigure(p: { tau: number; modes: number[]; floorDb: number; tipLabel: string }): ComponentType {
  const f10 = spectrumDropFrequency(p.tau, 10);
  const f20 = spectrumDropFrequency(p.tau, 20);
  const lo = 10 ** Math.floor(Math.log10(Math.min(p.modes[0], f10) / 2));
  const hi = Math.min(1e5, 10 ** Math.ceil(Math.log10(Math.max(p.modes[p.modes.length - 1], f20) * 1.5)));
  const n = 10 ** (p.floorDb / 20);
  const pts = sample((f) => 10 * Math.log10(halfSineSpectrum(f, p.tau) ** 2 + n * n), lo, hi, 500, true);
  const Fig = () => (
    <div>
      <Plot x={{ min: lo, max: hi, log: true, label: 'frequency (Hz, log)' }} y={{ min: -70, max: 5, label: 'force (dB re plateau)', ticks: [-60, -40, -20, -10, 0] }} height={240} ariaLabel={`${p.tipLabel} tip force spectrum with the structure's natural frequencies`}>
        <Line points={pts} color="var(--text)" width={2.2} />
        <HLine y={-10} color="var(--text-2)" dash="8 4" label="−10 dB" />
        <HLine y={-20} color="var(--text-2)" dash="3 3" label="−20 dB" />
        <Dot x={f10} y={-10} color="var(--text-2)" />
        <Dot x={f20} y={-20} color="var(--text-2)" hollow />
        {p.modes.map((f, i) => (
          <VLine key={i} x={f} color={MODE_COLORS[i % 3]} width={2} label={`f${i + 1}`} labelY={i % 2 ? 'bottom' : 'top'} />
        ))}
      </Plot>
      <Legend
        items={[
          { label: `${p.tipLabel} tip, measured force spectrum`, color: 'var(--text)' },
          { label: `−10 dB at ${hzTxt(f10)}`, color: 'var(--text-2)', dash: '8 4' },
          { label: `−20 dB at ${hzTxt(f20)}`, color: 'var(--text-2)', dash: '3 3' },
          ...p.modes.map((f, i) => ({ label: `f${i + 1} = ${hzTxt(f)}`, color: MODE_COLORS[i % 3] })),
        ]}
      />
    </div>
  );
  return Fig;
}
