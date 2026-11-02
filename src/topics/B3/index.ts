// Topic B3: transverse vibration of beams (LB4–LB5 and the beam-table handout).
import type { TopicDef } from '../../engine/types';
import { TOPIC_META } from '../meta';
import { cards, flashcards } from './learn';
import { games, mcqs, shortAnswers } from './quiz';
import { generators } from './solve';
import { explore } from './explore';

const topic: TopicDef = {
  ...TOPIC_META.B3,
  cards,
  flashcards,
  mcqs,
  games,
  shortAnswers,
  solve: generators,
  explore,
  traps: [
    { id: 'b3-rho-vs-rhoA', title: 'ρ instead of ρA', detail: 'Beam formulas need the mass per unit length $\\rho A$ (kg/m), not the density (LB4 caution box).' },
    { id: 'b3-ratio-not-squared', title: 'βL ratio not squared', detail: '$\\omega \\propto (\\beta L)^2$: cantilever $f_2/f_1 = (4.694/1.875)^2 = 6.27$, not 2.50.' },
    { id: 'b3-wrong-bc-row', title: 'Wrong row of the beam table', detail: 'Read the supports first: hub or root → clamped–free; bearings → pinned; in flight → free–free; massive posts → clamped–clamped.' },
    { id: 'b3-wrong-plane', title: 'Wrong bending plane', detail: 'Take the section depth in the bending direction: in-plane wing bending uses $tw^3/12$ (ω ∝ w), out-of-plane $wt^3/12$ (ω ∝ t).' },
    { id: 'b3-wrong-section', title: 'Tube vs rectangle formula', detail: 'Thin tube $I/A = r^2/2$; solid rectangle $I/A = h^2/12$; solid circle $d^2/16$.' },
    { id: 'b3-vibrating-length', title: 'βL refers to the vibrating length', detail: 'When a test clamps part of the beam, scale by $(L_{test}/L_{new})^2$.' },
    { id: 'b3-margin', title: 'Margin or excitation multiple forgotten', detail: 'Require $\\omega_1 \\ge n\\,\\Omega_{exc}$, with $\\Omega_{exc}$ the excitation (e.g. 1.8Ω), in rad/s.' },
  ],
};

export default topic;
