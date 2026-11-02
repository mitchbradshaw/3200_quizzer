import type { ExploreItem } from '../../../engine/types';
import DesignStudio, { STUDIO_CHALLENGE } from './DesignStudio';
import BendTorsion from './BendTorsion';

export const explore: ExploreItem[] = [
  {
    id: 'studio',
    title: 'B2 design studio',
    summary:
      'Work the B2 template on three real papers (2022 eVTOL wing, 2023 wind-turbine blade, 2024 hydro shaft): size the free dimension against the frequency requirement, read the mode sketches and nodes, size the thickness for the amplitude limit, then add the masses and see whether the margin survives.',
    component: DesignStudio,
    challenge: { id: STUDIO_CHALLENGE, title: 'make the eVTOL wing pass all three checks' },
    minutes: 12,
  },
  {
    id: 'compare',
    title: 'Bending vs torsion',
    summary:
      'One thin steel tube, two kinds of mode. Compare shapes, nodes and frequency ladders for four support cases, and drag $d$, $t$ and $L$ to see which frequencies move: bending scales with the diameter, while torsion depends on neither the diameter nor the wall.',
    component: BendTorsion,
    minutes: 5,
  },
];
