import type { ExploreItem } from '../../../engine/types';
import ForcedLab from './ForcedLab';
import NodeForce from './NodeForce';
import UnbalanceSweep, { WING_T_CHALLENGE } from './UnbalanceSweep';

export const explore: ExploreItem[] = [
  {
    id: 'lab',
    title: 'Modal superposition lab',
    summary: 'Drag a harmonic point force along the beam and sweep its frequency. Signed bars show each mode’s amplitude $a_i$; the animated shape is their sum. Which mode wins, and why is it not always the closest one?',
    component: ForcedLab,
    minutes: 8,
  },
  {
    id: 'node',
    title: 'A force at a node',
    summary: 'Modes 1–4 stacked under one force line. When the force sits on a node of mode $i$, $Y_i(x_e) = 0$ and that mode gets no excitation at any frequency. Add a sensor to see which modes a test can measure.',
    component: NodeForce,
    minutes: 4,
  },
  {
    id: 'unbalance',
    title: 'Unbalance sweep and the thinnest wing',
    summary: 'Rotor unbalance $me\\Omega^2$ on the 2022 eVTOL wing: compare two speeds, switch between take-off and cruise bending, and size the wing thickness $t$ for a 0.1 mm tip limit (in-plane, $y \\propto 1/t$ while the critical speeds stay put).',
    component: UnbalanceSweep,
    challenge: { id: WING_T_CHALLENGE, title: 'size the thinnest wing for 0.1 mm' },
    minutes: 7,
  },
];
