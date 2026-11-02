// Topic A6: damped MDOF systems and complex modes (LA9).
import type { TopicDef } from '../../engine/types';
import { TOPIC_META } from '../meta';
import { cards, flashcards } from './learn';
import { games, mcqs, shortAnswers } from './quiz';
import { generators } from './solve';
import { explore } from './explore';

const topic: TopicDef = {
  ...TOPIC_META.A6,
  cards,
  flashcards,
  mcqs,
  games,
  shortAnswers,
  solve: generators,
  explore,
  traps: [
    { id: 'a6-real-part-zwd', title: 'Real part of s is −ζωn, not −ζωd', detail: 'The decay rate uses the undamped natural frequency (official 2018 A1.6(c)).' },
    { id: 'a6-zeta-re-im', title: 'ζ = −Re s/|s|, not −Re/Im', detail: '$-\\mathrm{Re}/\\mathrm{Im} = \\zeta/\\sqrt{1-\\zeta^2}$: wrong once damping is not tiny.' },
    { id: 'a6-physical-single-mode', title: 'Physical coordinates contain every mode', detail: 'Only a modal coordinate has the single-mode form $e^{-\\zeta\\omega_nt}(A\\cos\\omega_dt + B\\sin\\omega_dt)$ (official 2019 Q1e).' },
    { id: 'a6-tiny-entries', title: 'Ratio built on a rounded “0.0000” entry', detail: 'Use the velocity rows (|s| times larger) or the best-resolved displacement entry.' },
    { id: 'a6-phase-from-magnitude', title: 'In/out of phase judged from magnitudes', detail: 'Read the angle of the complex ratio: near 0° in phase, near 180° out of phase.' },
    { id: 'a6-mixed-columns', title: 'Ratio taken across columns or rows', detail: 'A mode ratio uses two entries of one column; $s = V_j/X_j$ pairs a velocity with its own displacement.' },
    { id: 'a6-d-omega2', title: 'Undamped eig(inv(M)*K) gives ω²', detail: 'Its D holds $\\omega^2$; the state-space D holds $s$.' },
    { id: 'a6-rayleigh-diagonal', title: 'Rayleigh damping keeps PᵀCP diagonal', detail: '$P^TCP = \\alpha P^TMP + \\beta P^TKP$ (official 2018 A1.1(c) is false).' },
  ],
};

export default topic;
