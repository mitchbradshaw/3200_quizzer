import type { ExploreItem } from '../../../engine/types';
import RayleighLab from './RayleighLab';
import DunkerleyLab from './DunkerleyLab';
import HolzerLab from './HolzerLab';
import OrderGame, { ORDER_CHALLENGE } from './OrderGame';
import FEMLab from './FEMLab';

export const explore: ExploreItem[] = [
  {
    id: 'rayleigh',
    title: 'Rayleigh trial-shape lab',
    summary:
      'Pick (or blend) a trial shape for a cantilever or pinned beam, add a point mass, and watch $\\omega_R^2 = V_{max}/T_{max}$ stay above the exact fundamental. See why the static deflection wins and why $x^2$ is 27 % high.',
    component: RayleighLab,
    minutes: 7,
  },
  {
    id: 'dunkerley',
    title: 'Dunkerley with added masses',
    summary:
      'Drag engines, rotors or a machine along a cantilever, pinned or clamped beam. See each mass’s term $(\\omega_{11}/\\omega_{kk})^2$, the Dunkerley lower bound, Rayleigh’s upper bound and the exact value, and why a mass at a node changes nothing.',
    component: DunkerleyLab,
    minutes: 7,
  },
  {
    id: 'holzer',
    title: 'Holzer residual-torque plot',
    summary:
      'Edit a disc–shaft chain, march $\\theta_{i+1} = \\theta_i - T_i/k_i$ at a trial $\\omega$, and read every natural frequency where the residual crosses zero, with its mode shape. Free or fixed far end.',
    component: HolzerLab,
    minutes: 7,
  },
  {
    id: 'order',
    title: 'Order the estimates',
    summary:
      'Put Dunkerley, Rayleigh, Holzer and FEM estimates in order for five real scenarios, then answer the recurring exam question: which orders are possible?',
    component: OrderGame,
    challenge: { id: ORDER_CHALLENGE, title: 'order every set of estimates' },
    minutes: 8,
  },
  {
    id: 'fem',
    title: 'FE mesh refinement',
    summary: 'Mesh a cantilever with 1–24 beam elements: consistent mass converges from above, lumped mass from below, and one element only resembles the fundamental.',
    component: FEMLab,
    minutes: 5,
  },
];
