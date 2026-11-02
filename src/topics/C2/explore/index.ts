import type { ExploreItem } from '../../../engine/types';
import FrfViews from './FrfViews';
import HalfPowerDrill, { DRILL_CHALLENGE } from './HalfPowerDrill';
import ModalTest from './ModalTest';

export const explore: ExploreItem[] = [
  {
    id: 'frf-views',
    title: 'Four views of one FRF (and the Nyquist circle)',
    summary: 'Magnitude, phase, real and imaginary parts of an SDOF or 2-DoF FRF, linked by one frequency cursor. Switch receptance ↔ mobility ↔ accelerance and see where Re H is zero, Im H peaks and the phase passes −90°, 0° or +90°.',
    component: FrfViews,
    minutes: 8,
  },
  {
    id: 'half-power',
    title: 'Half-power drill: read ζ off the plot',
    summary: 'A fresh FRF each round: drag two markers to the half-power points (−3 dB on |H|, or the peak and trough of Re H) and see how close your $\\zeta = (\\omega_2-\\omega_1)/2\\omega_n$ is.',
    component: HalfPowerDrill,
    challenge: { id: DRILL_CHALLENGE, title: 'three damping estimates within 8 %' },
    minutes: 6,
  },
  {
    id: 'mode-shapes',
    title: 'Mode shapes from rows and columns',
    summary: 'A pinned–pinned beam measured at three points. Rove the accelerometer (a column) or the hammer (a row), read Im H at each resonance, and see reciprocity and what a point at a node does (2024 A3.5).',
    component: ModalTest,
    minutes: 8,
  },
];
