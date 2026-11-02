// Topic C2: FRFs and modal parameters (reader LC2; summary notes C2).
import type { TopicDef } from '../../engine/types';
import { TOPIC_META } from '../meta';
import { cards, flashcards } from './learn';
import { games, mcqs, shortAnswers } from './quiz';
import { generators } from './solve';
import { explore } from './explore';

const topic: TopicDef = {
  ...TOPIC_META.C2,
  cards,
  flashcards,
  mcqs,
  games,
  shortAnswers,
  solve: generators,
  explore,
  traps: [
    { id: 'c2-re-im', title: 'Re H is zero at ωₙ; Im H peaks', detail: 'At resonance the FRF is purely imaginary: the real part crosses zero and the imaginary part is extreme (official 2018/2019 A3.6(a); 2023 A3.6(a)).' },
    { id: 'c2-bandwidth', title: 'Bandwidth is not ζ', detail: 'Half-power: $\\zeta = (\\omega_2 - \\omega_1)/(2\\omega_n)$. $\\Delta\\omega$ alone, or $\\Delta\\omega/\\omega_n$, are Week 12 Q1 distractors.' },
    { id: 'c2-half-power', title: 'Half power = |H|max/√2 (−3 dB)', detail: 'Not $|H|_{max}/2$: the half-amplitude points are $\\sqrt3$ times further apart.' },
    { id: 'c2-logdec-cycles', title: 'Log decrement: divide by the number of cycles', detail: '$\\delta = \\ln(X_0/X_m)/m$ is the decay **per cycle**, with $m$ the number of whole cycles between the two peaks (reader LC2-6, Eq 2.9). Using $\\ln(X_0/X_m)$ itself makes $\\zeta$ about $m$ times too big; dividing by $m \\pm 1$ miscounts the cycles.' },
    { id: 'c2-form', title: 'Know which FRF form you are reading', detail: 'Receptance −90° at resonance and $1/k$ at 0 Hz; mobility 0°; accelerance +90° and → 0 at low frequency. Convert with $\\omega$ in rad/s.' },
    { id: 'c2-reciprocity', title: 'Rows work as well as columns', detail: '$H_{ij} = H_{ji}$: a fixed accelerometer with a roving hammer gives the mode shapes too (official 2017 A3.6(b); 2025 A3.4(b)).' },
    { id: 'c2-damping-shape', title: 'More damping: lower, broader peaks', detail: 'Peak height $\\propto 1/2\\zeta$, half-power bandwidth $2\\zeta\\omega_n$; the phase change is more gradual (2024 A3.3(c)).' },
    { id: 'c2-phase-needed', title: 'Mode shapes need the phase', detail: 'Points measured one at a time need the FRF phase (or sign of Im H) to know which way each moves (2023 A3.3(c)).' },
    { id: 'c2-low-response', title: 'Coherence dips where the response is small', detail: 'Anti-resonances and nodes give tiny responses, so ordinary noise dominates there (Week 12 Q3).' },
  ],
};

export default topic;
