// Topic A4: forced 2-DoF response, receptances, anti-resonances and dynamic vibration absorbers (LA6, LC4 §3.5).
import type { TopicDef } from '../../engine/types';
import { TOPIC_META } from '../meta';
import { cards, flashcards } from './learn';
import { games, mcqs, shortAnswers } from './quiz';
import { generators } from './solve';
import { explore } from './explore';

const topic: TopicDef = {
  ...TOPIC_META.A4,
  cards,
  flashcards,
  mcqs,
  games,
  shortAnswers,
  solve: generators,
  explore,
  traps: [
    { id: 'a4-antires-own', title: 'Anti-resonance at the wrong frequency', detail: 'A driving-point zero is the natural frequency of the system with the **forced** coordinate held fixed: force on $m_1$ → $\\sqrt{k_2/m_2}$; force on $m_2$ → $\\sqrt{(k_1+k_2)/m_1}$. Not the forced mass’s own $\\sqrt{k_1/m_1}$.' },
    { id: 'a4-cross-zero', title: 'Expecting a cross receptance to vanish', detail: 'In a 2-DoF chain $\\alpha_{12} = k_2/\\Delta$: a constant numerator, so it is never zero.' },
    { id: 'a4-round-down', title: 'Rounding a minimum mass ratio down', detail: 'Week 5: 0.986 → report 0.99. Rounding to 0.98 puts the lower resonance inside the band.' },
    { id: 'a4-both-limits', title: 'Unequal margins: compute both μ candidates', detail: 'With different margins below and above, either limit can bind: compute $\\mu_L$ from $r_1 = 1 - x_{lo}$ and $\\mu_U$ from $r_2 = 1 + x_{hi}$ and take the larger. Only for equal margins is the lower one always larger.' },
    { id: 'a4-k2-scale', title: 'Absorber spring not matched to its mass', detail: 'Tuning needs $k_2 = m_2\\Omega^2$ (= $\\mu k_1$ when $\\Omega = \\omega_{11}$). Change $m_2$ and you must change $k_2$ with it.' },
    { id: 'a4-damped-zero', title: 'Complete suppression with a damped absorber', detail: 'Damping fills in the anti-resonance; exact suppression needs an undamped absorber. Damping caps the new peaks instead.' },
    { id: 'a4-absorber-rigid', title: 'Absorber on a rigidly fixed item', detail: 'If the support imposes the displacement, an absorber cannot change it; it needs a flexibly mounted primary.' },
    { id: 'a4-qtheta-sign', title: 'Inconsistent signs in K₁₂ and Q_θ', detail: 'Use the same positive directions for the coupling stiffness and the generalised force (virtual work). 2023 A2.5: 8.80 rad/s, not 4.23 rad/s.' },
  ],
};

export default topic;
