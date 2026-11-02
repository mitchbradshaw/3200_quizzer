// Topic C4: vibration control (LC4, with LA7 isolation and the LA6 absorber). Content follows the reader and
// the Exam Summary Notes; see docs/AUTHORING.md for the structure (A1 is the reference topic).
import type { TopicDef } from '../../engine/types';
import { TOPIC_META } from '../meta';
import { cards, flashcards } from './learn';
import { games, mcqs, shortAnswers } from './quiz';
import { generators } from './solve';
import { explore } from './explore';

const topic: TopicDef = {
  ...TOPIC_META.C4,
  cards,
  flashcards,
  mcqs,
  games,
  shortAnswers,
  solve: generators,
  explore,
  traps: [
    { id: 'isolate-stiff', title: 'Isolation needs ωₙ ≪ Ω, not ωₙ ≫ Ω', detail: 'Stiff mounts ($r \\ll 1$) give $T \\approx 1$; between $r = 1$ and $\\sqrt2$ they amplify. Isolation needs the mount frequency well **below** the forcing frequency (official 2017–2019 A3.7(b)).' },
    { id: 'static-sag', title: 'ωₙ = √(g/δ), with δ in metres', detail: 'Not $g/\\delta$, and not $\\delta$ in mm: 10 mm of sag gives 31.3 rad/s = 4.98 Hz.' },
    { id: 'end-stop', title: 'Spikes come from the end-stop, not from resonance alone', detail: 'Resonance makes the relative travel large; when it exceeds the free travel the seat strikes a stiff stop and $F\\Delta t \\approx m\\Delta v$ gives a brief, large force (2023 A3.4).' },
    { id: 'absorber-rigid', title: 'An absorber cannot help a rigidly fixed object', detail: 'If the fixing imposes the motion (a camera bolted to a platform), there is no flexible primary to cancel; isolate it instead (2022 A1.1).' },
    { id: 'absorber-damping-role', title: 'Tuning cancels; absorber damping only limits the new peaks', detail: 'The anti-resonance comes from $\\sqrt{k_2/m_2} = \\Omega$. Damping lowers the two new peaks but leaves a non-zero response at the tuning frequency (official 2019 Q1(h)(c); 2024 A3.6(b)).' },
    { id: 'tmd-narrow', title: 'One TMD, one frequency', detail: 'A tuned absorber suits one dominant mode at one frequency; over a wide band or several modes its two new resonances get in the way (2024 A3.6(d),(e)).' },
  ],
  seeAlso: [
    { label: 'A1 Base excitation and isolation', href: '#/A1/explore/base', note: 'The transmissibility curve itself: every $\\zeta$ crosses at $\\sqrt2$.' },
    { label: 'A4 Absorbers', href: '#/A4/learn', note: 'The full two-DoF absorber: receptances, $\\beta \\ne 1$, sizing from a frequency margin.' },
    { label: 'A5 Rigid bodies on mounts', href: '#/A5/learn', note: 'Bounce and pitch of a cabin or machine on two mounts (official A3.8; 2022 A3.1).' },
  ],
};

export default topic;
