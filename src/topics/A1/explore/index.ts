import type { ExploreItem } from '../../../engine/types';
import MassSpring from './MassSpring';
import DoorCloser, { DOOR_CHALLENGE } from './DoorCloser';
import ForcedResponse from './ForcedResponse';
import BaseExcitation from './BaseExcitation';

export const explore: ExploreItem[] = [
  {
    id: 'msd',
    title: 'Mass–spring–damper',
    summary: 'Drag the mass and let go. Change $m$, $k$ and $c$ and watch $\\omega_n$, $\\zeta$ and the free response: under-, critically and over-damped.',
    component: MassSpring,
    minutes: 5,
  },
  {
    id: 'door',
    title: 'Door-closer challenge',
    summary: 'Set the damper so the door shuts as fast as possible without slamming. Is there a single best setting, and does it depend on how far the door is opened?',
    component: DoorCloser,
    challenge: { id: DOOR_CHALLENGE, title: 'close fastest without slamming' },
    minutes: 4,
  },
  {
    id: 'forced',
    title: 'Forced response: amplitude and phase',
    summary: 'Drag the operating point through resonance. See where the damped peak sits, why it is $1/2\\zeta$ high, and how the phase swings from 0° to 180°.',
    component: ForcedResponse,
    minutes: 5,
  },
  {
    id: 'base',
    title: 'Base excitation and isolation',
    summary: 'Transmissibility against $r$ with a moving running speed: every curve crosses at $\\sqrt2$, and above it damping makes isolation worse.',
    component: BaseExcitation,
    minutes: 6,
  },
];
