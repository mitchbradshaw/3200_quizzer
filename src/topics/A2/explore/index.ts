import type { ExploreItem } from '../../../engine/types';
import EnergyBuilder, { BUILDER_CHALLENGE } from './EnergyBuilder';
import LeverArm from './LeverArm';
import CartPendulum from './CartPendulum';
import BarSprings, { DECOUPLE_CHALLENGE } from './BarSprings';

export const explore: ExploreItem[] = [
  {
    id: 'builder',
    title: 'Energy builder: T and V → M and K',
    summary: 'Sort candidate energy terms into T, V or “not a term” for seven systems (2019–2025 exam systems, the pendulum on a cart and a bar on springs) and watch M and K assemble symbolically, entry by entry, with the equations of motion at the end.',
    component: EnergyBuilder,
    challenge: { id: BUILDER_CHALLENGE, title: 'build M and K correctly for four systems' },
    minutes: 12,
  },
  {
    id: 'lever',
    title: 'Spring deflection = translation + rotation × lever arm',
    summary: 'Translate and rotate a rigid block on springs. Each spring’s deflection is drawn as its two parts; compare the correct $\\tfrac12 k\\delta^2$ with the split (wrong) energy and see which K entries each spring feeds.',
    component: LeverArm,
    minutes: 6,
  },
  {
    id: 'cart',
    title: 'Pendulum (rod) on a cart',
    summary: 'The 2022 system, animated exactly. Change m, M, L and k and watch M, K, both frequencies and both mode shapes (with the node on the rod); start in one mode or a mix and compare the traces; drag k to zero to find the rigid-body mode.',
    component: CartPendulum,
    minutes: 8,
  },
  {
    id: 'bar',
    title: 'Rigid bar on springs: bounce and pitch',
    summary: 'Drag the springs along the bar. Watch the coupling $k_2b - k_1a$, the modes and their nodes, and switch coordinates to move the coupling from K into M without changing a frequency.',
    component: BarSprings,
    challenge: { id: DECOUPLE_CHALLENGE, title: 'decouple bounce and pitch' },
    minutes: 8,
  },
];
