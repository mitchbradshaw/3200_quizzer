// Topic B4: forced response of beams by modal analysis (LB6 and the B2 forced-response parts).
import type { TopicDef } from '../../engine/types';
import { TOPIC_META } from '../meta';
import { cards, flashcards } from './learn';
import { games, mcqs, shortAnswers } from './quiz';
import { generators } from './solve';
import { explore } from './explore';

const topic: TopicDef = {
  ...TOPIC_META.B4,
  cards,
  flashcards,
  mcqs,
  games,
  shortAnswers,
  solve: generators,
  explore,
  traps: [
    { id: 'b4-signs', title: 'Modal contributions added without their signs', detail: 'Above $\\omega_i$ the dynamic factor $1/(1-\\Omega^2/\\omega_i^2)$ is negative (out of phase), and $Y_i$ changes sign along the beam. Add $a_iY_i(x)$ with signs.' },
    { id: 'b4-wrong-point', title: 'Mode value at the wrong point', detail: '$a_i$ uses $Y_i$ at the **force** $x_e$; the output point enters afterwards through $Y_i(x_{out})$.' },
    { id: 'b4-closest', title: '“The closest natural frequency always dominates”', detail: 'Compare $|a_iY_i(x_{out})|$: the stiffness factor $1/(\\beta_iL)^4$ and the grip $Y_i(x_e)$ matter as much as the dynamic factor (LB6 Ex 9.3).' },
    { id: 'b4-t-response', title: 'Thickness change ≠ response change', detail: 'Thin tube: $y \\propto 1/t$ at fixed frequencies, so a 30 % cut in response needs $1/0.7 - 1$ = +42.9 % thickness, not +30 %.' },
    { id: 'b3-wrong-plane', title: 'Wrong bending plane', detail: 'Take the section depth in the bending direction: in-plane wing bending uses $tw^3/12$ (ω ∝ w), out-of-plane $wt^3/12$ (ω ∝ t).' },
    { id: 'b3-margin', title: 'Margin or excitation multiple forgotten', detail: 'Require $\\omega_1 \\ge n\\,\\Omega_{exc}$, with $\\Omega_{exc}$ the excitation (e.g. 1.8Ω), in rad/s.' },
    { id: 'b3-ratio-not-squared', title: 'βL ratio not squared', detail: '$\\omega \\propto (\\beta L)^2$: cantilever $\\omega_2/\\omega_1 = (4.694/1.875)^2 = 6.27$, not 2.50.' },
    { id: 'b3-rho-vs-rhoA', title: 'ρ instead of ρA', detail: 'Beam formulas need the mass per unit length $\\rho A$ (kg/m), not the density (LB4 caution box).' },
  ],
  seeAlso: [
    { label: 'B3 mode shapes and nodes', href: '#/B3/explore/modes', note: 'Where the nodes are, for every support.' },
    { label: 'B6 the B2 design problem', href: '#/B6/learn', note: 'The whole 20-mark chain, of which this is the forced-response step.' },
  ],
};

export default topic;
