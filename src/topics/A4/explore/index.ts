import type { ExploreItem } from '../../../engine/types';
import Receptances from './Receptances';
import AbsorberTuning, { TUNING_CHALLENGE } from './AbsorberTuning';
import AbsorberDamping from './AbsorberDamping';
import Suppress from './Suppress';

export const explore: ExploreItem[] = [
  {
    id: 'receptance',
    title: 'Receptances: resonances and anti-resonances',
    summary:
      'Force one mass of a two-mass chain and sweep the frequency. Every receptance peaks at $\\omega_1$ and $\\omega_2$, but only the driving-point ones, $\\alpha_{11}$ and $\\alpha_{22}$, can drop to zero, each in its own place. Why can $\\alpha_{12}$ never vanish?',
    component: Receptances,
    minutes: 6,
  },
  {
    id: 'absorber-tuning',
    title: 'Absorber tuning challenge',
    summary:
      'Pick the absorber mass and spring so the machine stands still at its operating speed and both new resonances clear a ±x % band, with the lightest absorber. Which new resonance binds, and why must $k_2$ follow $m_2$?',
    component: AbsorberTuning,
    challenge: { id: TUNING_CHALLENGE, title: 'lightest absorber that clears the band' },
    minutes: 8,
  },
  {
    id: 'absorber-damping',
    title: 'Damped absorber: fixed points and merging peaks',
    summary:
      'Add damping across the absorber spring: the zero fills in, the two peaks shrink, drift together and merge, and every curve passes through two fixed points. What does that do to the 2021 sizing?',
    component: AbsorberDamping,
    minutes: 6,
  },
  {
    id: 'suppress',
    title: 'Suppressed coordinate: bounce or pitch?',
    summary:
      'Push a platform on two springs with a harmonic force and move the force along it. At one frequency the centre of mass stands still and the platform only rocks; when can pitch be stopped instead, and why does the force position matter?',
    component: Suppress,
    minutes: 5,
  },
];
