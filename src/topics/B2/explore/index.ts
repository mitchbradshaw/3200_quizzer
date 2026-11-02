import type { ExploreItem } from '../../../engine/types';
import StandingWaves from './StandingWaves';
import PluckTouch, { OCTAVE_CHALLENGE } from './PluckTouch';
import SwingingWeight, { SWING_CHALLENGE } from './SwingingWeight';
import WhirlingCable from './WhirlingCable';
import AxialTorsion from './AxialTorsion';
import EndInertia, { HALF_CHALLENGE } from './EndInertia';

export const explore: ExploreItem[] = [
  {
    id: 'standing',
    title: 'Standing waves and end conditions',
    summary: 'A string, a rod and a shaft with fixed–fixed, fixed–free or free–free ends: modes 1–3 with their nodes, the frequency ladder (1 : 2 : 3 or 1 : 3 : 5), and why the shapes depend on the ends but not on the member.',
    component: StandingWaves,
    minutes: 6,
  },
  {
    id: 'pluck',
    title: 'Pluck, touch and press a string',
    summary: 'Choose where to pluck and where to put a finger. See which harmonics survive in the spectrum and in the animated mode sum: the octave recipe of 2022 B1.2, and why a firm press is not a light touch.',
    component: PluckTouch,
    challenge: { id: OCTAVE_CHALLENGE, title: 'play the octave' },
    minutes: 6,
  },
  {
    id: 'swing',
    title: 'Swinging weight: tension through the swing',
    summary: 'A weight swings on a string with a constant amplitude. The string tension $T = mg(3\\cos\\theta - 2\\cos\\theta_0)$, and with it the string’s own pitch, peaks at the bottom of every swing: what $m$, $L$, $\\rho_l$ and $\\theta_0$ change (official 2016 B1.3–1.5, 2021 B1.2).',
    component: SwingingWeight,
    challenge: { id: SWING_CHALLENGE, title: 'an octave within each swing' },
    minutes: 5,
  },
  {
    id: 'cable',
    title: 'Whirling cable: what Ω, m and ρₗ do',
    summary: 'A mass whirled on a flexible cable: the tension is largest at the hub, the frequencies scale with $\\Omega$, rise with the end mass and fall with a heavier cable. How good is “treat the mass as a fixed end” (official 2018 B1.3–1.4, 2023 B1.1–1.2, tutorial W7.9)?',
    component: WhirlingCable,
    minutes: 6,
  },
  {
    id: 'axial-torsion',
    title: 'Axial versus torsion (and bending)',
    summary: 'The same rod in axial and torsional vibration side by side: $G < E$ puts torsion first by $1/\\sqrt{2(1+\\nu)}$, the diameter cancels from both, and only bending depends on the geometry.',
    component: AxialTorsion,
    minutes: 5,
  },
  {
    id: 'end-inertia',
    title: 'Shaft with an end inertia',
    summary: 'Solve $z\\tan z = I_a/I_e$ graphically and watch the roots move as the disc grows: a new low mode near $\\sqrt{k_t/I_e}$, higher modes heading to the fixed–fixed values, and the 2021 half-axle’s 97 % drop.',
    component: EndInertia,
    challenge: { id: HALF_CHALLENGE, title: 'halve the fundamental' },
    minutes: 7,
  },
];
