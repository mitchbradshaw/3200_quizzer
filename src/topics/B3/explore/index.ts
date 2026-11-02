import type { ExploreItem } from '../../../engine/types';
import ModeShapes from './ModeShapes';
import FrequencyRatios from './FrequencyRatios';
import SectionScaling, { WING_CHALLENGE } from './SectionScaling';

export const explore: ExploreItem[] = [
  {
    id: 'modes',
    title: 'Mode shapes and nodes for every support',
    summary: 'All six handout boundary conditions, animated, with the nodes marked and the clamp, pin and free-end symbols drawn. Why is the cantilever node at 0.783L, and what do the rounded handout constants do near a free end?',
    component: ModeShapes,
    minutes: 6,
  },
  {
    id: 'ratios',
    title: 'The βL table and the ratio trick',
    summary: 'A measured $f_1$ gives $f_2$, $f_3$ without $EI$: $f_i = (\\beta_i L/\\beta_1 L)^2 f_1$. Compare the spacing of every BC with a string’s harmonics, then change the supports or the vibrating length.',
    component: FrequencyRatios,
    minutes: 5,
  },
  {
    id: 'sections',
    title: 'Section scaling: what d, t, w and L change',
    summary: 'Thin tube: $\\omega \\propto d/L^2$ and $t$ cancels. Rectangle: $\\omega \\propto$ depth in the bending direction. Deflection still depends on $t$. Ends with the eVTOL wing-width design challenge.',
    component: SectionScaling,
    challenge: { id: WING_CHALLENGE, title: 'size the narrowest eVTOL wing' },
    minutes: 7,
  },
];
