// Topic A3: 2-DoF modes and modal analysis (LA3–LA5, LA8).
import type { TopicDef } from '../../engine/types';
import { TOPIC_META } from '../meta';
import { cards, flashcards } from './learn';
import { games, mcqs, shortAnswers } from './quiz';
import { generators } from './solve';
import { explore } from './explore';

const topic: TopicDef = {
  ...TOPIC_META.A3,
  cards,
  flashcards,
  mcqs,
  games,
  shortAnswers,
  solve: generators,
  explore,
  traps: [
    { id: 'a3-ratio-inverted', title: 'Mode ratio upside down', detail: 'Quote the ratio the question names (course: $r = A_2/A_1$); $A_1/A_2$ is its inverse.' },
    { id: 'a3-wrong-mode', title: 'Ratio or frequency of the other mode', detail: 'Each mode ratio uses its own $\\omega_i^2$; mode 1 is the lower frequency.' },
    { id: 'a3-inertial-coupling', title: 'Mass coupling dropped from K − ω²M', detail: 'With a non-diagonal $M$ the off-diagonal of $K-\\omega^2M$ is $k_{12}-\\omega^2m_{12}$.' },
    { id: 'a3-modal-force-transpose', title: 'Modal forces need Pᵀ', detail: '$\\tilde f = P^TF$ (columns of $P$), not $PF$ and not $F$ itself.' },
    { id: 'a3-equal-modal-amplitudes', title: 'Same amplitude in every mode', detail: 'Each mode’s share comes from $P^{-1}X_0$ and $P^{-1}\\dot X_0$ (official 2018 A1.7(d)).' },
    { id: 'a3-rigid-not-uniform', title: 'Rigid mode is not always [1 1]', detail: 'Solve $KA = 0$: a belt drive gives $[1,\\,R_1/R_2]$.' },
    { id: 'a3-row-vs-column', title: 'Mode table read the wrong way', detail: 'With one row per mode, $x_j$ uses the DoF-$j$ entry of each mode (a column of the table).' },
    { id: 'a3-d-omega2', title: 'Undamped eig output D holds ω²', detail: '`eig(inv(M)*K)` returns $\\omega^2$: take the square root (official 2019 Q1).' },
    { id: 'a3-single-mode-scale', title: 'Mode ratio not scaled by x₀', detail: 'To excite mode $i$ only: $x_{20} = r_ix_{10}$ (or $\\theta_0 = r_ix_0$), not $r_i$ itself.' },
  ],
};

export default topic;
