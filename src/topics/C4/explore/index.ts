import type { ExploreItem } from '../../../engine/types';
import Isolation, { ISO_CHALLENGE } from './Isolation';
import Strategy, { STRAT_CHALLENGE } from './Strategy';
import Seat from './Seat';

export const explore: ExploreItem[] = [
  {
    id: 'isolation',
    title: 'Isolation designer: static sag, start-up and running',
    summary: 'Mount an unbalanced compressor. Choose the mounts by their static sag and damping, then run it up: the floor force and the machine’s excursion over the whole start-up, not just at speed. Soft mounts isolate; damping (or a heavier inertia block) tames the start-up.',
    component: Isolation,
    challenge: { id: ISO_CHALLENGE, title: 'mount the compressor' },
    minutes: 7,
  },
  {
    id: 'strategy',
    title: 'Choose a strategy',
    summary: 'Randomised scenarios: an unbalanced fan, a pump at a fixed speed on a resonant frame, a variable-speed drive, a microscope on a busy floor, a lively footbridge, flutter… Balance, retune, damp, isolate, absorb, go active or fix the instability? See what each choice does to the response.',
    component: Strategy,
    challenge: { id: STRAT_CHALLENGE, title: 'five first choices in a row' },
    minutes: 8,
  },
  {
    id: 'seat',
    title: 'Seat suspension and end-stops',
    summary: 'A haul-truck seat on a soft suspension, driven by the cab floor near its resonance (2023 A3.4). When the travel runs out it strikes the end-stop: see where the acceleration spikes come from, and why a softer seat needs more rattle space.',
    component: Seat,
    minutes: 5,
  },
];
