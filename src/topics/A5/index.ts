// Topic A5: rigid bodies on resilient mounts (isolation). See docs/AUTHORING.md.
import type { TopicDef, TrapDef } from '../../engine/types';
import { TOPIC_META } from '../meta';
import { cards, flashcards } from './learn';
import { games, mcqs, shortAnswers } from './quiz';
import { generators } from './solve';
import { explore } from './explore';

const traps: TrapDef[] = [
  { id: 'a5-shear', title: 'Shear stiffness of every mount', detail: 'Every mount below G resists sway with its $k_x$ (2024: $K_{xx} = 4k_x$, $K_{x\\theta} = 4k_xc$, including the front and back springs on $x = 0$).' },
  { id: 'a5-spring-count', title: 'Per-mount vs total stiffness', detail: 'Count the springs: “each mount” (2025: the 3 is already inside $K$), “springs at each end total $k_x$” (2017), “$2k_x$” per side in LA7 means two springs.' },
  { id: 'a5-wrong-face', title: 'Wrong face for the moment of inertia', detail: 'Rocking about $z$ uses the face perpendicular to $z$: $I_z = m[(2a)^2+(2c)^2]/12$ (2024), not the $2a \\times 2b$ face.' },
  { id: 'a5-uncoupled', title: 'Uncoupled values quoted as natural frequencies', detail: '$\\sqrt{K_{ii}/M_{ii}}$ of a coupled coordinate is not a natural frequency: the coupled pair lies one below and one above them.' },
  { id: 'a5-symmetric', title: 'Symmetric positions are not enough', detail: 'Bounce and pitch decouple only when $k_1a = k_2b$ (equal moments), not merely when the springs are at equal distances.' },
  { id: 'a5-highest-mode', title: 'Isolation checked on one mode only', detail: 'Every rigid-body mode transmits: the running speed must be at least twice the **highest** one (LA7 p47).' },
  { id: 'a5-letters', title: 'Letters change meaning between papers', detail: 'LA7: $a$ = height of G, $b$ = half-span. 2018 A1.4: $h$ = height, $a$ = half-span. 2024: $a$, $b$, $c$ = half-length, half-depth, half-height. Read each figure.' },
];

const topic: TopicDef = {
  ...TOPIC_META.A5,
  cards,
  flashcards,
  mcqs,
  games,
  shortAnswers,
  solve: generators,
  explore,
  traps,
};

export default topic;
