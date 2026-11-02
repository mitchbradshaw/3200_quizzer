import type { ExploreItem } from '../../../engine/types';
import SeismicInstrument, { SEISMIC_CHALLENGE } from './SeismicInstrument';
import HammerTips from './HammerTips';

export const explore: ExploreItem[] = [
  {
    id: 'seismic',
    title: 'Seismic instrument: accelerometer or vibrometer?',
    summary: 'One mass on a spring in a case. Move the measured frequency, the damping and the proof mass: see the ±ε usable band, why ζ ≈ 0.7 widens it, why a stiff light sensor reads acceleration and a soft heavy one reads displacement. Then design one that is both wide-band and sensitive.',
    component: SeismicInstrument,
    challenge: { id: SEISMIC_CHALLENGE, title: '±5 % to 5 kHz with at least 2 nm per g' },
    minutes: 8,
  },
  {
    id: 'hammer',
    title: 'Hammer tip lab: pulse → spectrum → modes',
    summary: 'Pick rubber, plastic, aluminium or steel, change the hammer mass and the structure, and watch the contact time set the 10–20 dB useful range. Which of the cantilever’s modes does each tip excite (2023 A3.1)?',
    component: HammerTips,
    minutes: 7,
  },
];
