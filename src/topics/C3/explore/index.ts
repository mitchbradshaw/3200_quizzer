import type { ExploreItem } from '../../../engine/types';
import Aliasing from './Aliasing';
import LeakageLab, { LEAK_CHALLENGE } from './LeakageLab';
import CoherenceLab, { COH_CHALLENGE } from './CoherenceLab';

export const explore: ExploreItem[] = [
  {
    id: 'alias',
    title: 'Sampling and aliasing',
    summary: 'A sine, its samples and the slowest sine through them. Drag the true frequency along the folding diagram, watch a strobe make a wheel turn backwards, and see why only an analogue filter prevents aliasing.',
    component: Aliasing,
    minutes: 6,
  },
  {
    id: 'leakage',
    title: 'FFT lab: resolution, leakage and windows',
    summary: 'Change $f_s$, the record length and the window. See $\\Delta f = 1/T$, $N/2$ lines, on-line vs off-line tones, the jump where the record meets its repeat, and amplitude correction. Then repair the 2022 A3.5 spectrum.',
    component: LeakageLab,
    challenge: { id: LEAK_CHALLENGE, title: 'repair the 2022 A3.5 spectrum, cheaply' },
    minutes: 8,
  },
  {
    id: 'coherence',
    title: 'Noise lab: H₁, H₂ and coherence',
    summary: 'Measure a beam’s FRF with noise on the force or the sensor. Compare $H_1$, $H_2$ and the truth, watch coherence fall at anti-resonances, nodes and above a soft tip’s bandwidth, and plan a clean test.',
    component: CoherenceLab,
    challenge: { id: COH_CHALLENGE, title: 'plan a clean modal test' },
    minutes: 8,
  },
];
