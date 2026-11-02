import type { ExploreItem } from '../../../engine/types';
import ChainModes from './ChainModes';
import DetPlot from './DetPlot';
import ModalIC, { A3_MODE1_CHALLENGE } from './ModalIC';

export const explore: ExploreItem[] = [
  {
    id: 'chain',
    title: 'Two-mass chain: the modes in motion',
    summary: 'Animate mode 1, mode 2 or both. Change the masses and springs and watch $\\omega_1$, $\\omega_2$, the mode ratios and the nodes; free the chain to get a rigid-body mode.',
    component: ChainModes,
    minutes: 6,
  },
  {
    id: 'det',
    title: 'The frequency equation det(K − ω²M)',
    summary: 'Plot $\\det(K-\\lambda M)$ against $\\lambda = \\omega^2$: the roots are the natural frequencies. Drag a trial $\\omega^2$ and see why rows 1 and 2 only agree on a mode shape at a root.',
    component: DetPlot,
    minutes: 5,
  },
  {
    id: 'modal-ic',
    title: 'Initial conditions → modal coordinates',
    summary: 'Set initial displacements and velocities, see $Y_0 = P^{-1}X_0$ and each mode’s share of $x_1(t)$, $x_2(t)$. Challenge: excite only mode 1.',
    component: ModalIC,
    challenge: { id: A3_MODE1_CHALLENGE, title: 'excite only mode 1' },
    minutes: 7,
  },
];
