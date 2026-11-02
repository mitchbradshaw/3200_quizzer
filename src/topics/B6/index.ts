// Topic B6: the B2 design problem (summary notes B6 template, expanded to 7 steps).
import type { TopicDef } from '../../engine/types';
import { TOPIC_META } from '../meta';
import { cards, flashcards, traps } from './learn';
import { games, mcqs, shortAnswers } from './quiz';
import { generators } from './solve';
import { explore } from './explore';
import { traps as b5Traps } from '../B5/learn';

// B6 feedback reuses two B5 traps (% change vs % of; tip stiffness; drop ratio); register them here too so the
// trap log can name them when B6 is studied on its own.
const shared = b5Traps.filter((t) => ['b5-pct-change', 'b5-tip-stiffness', 'b5-drop-ratio'].includes(t.id));

const topic: TopicDef = {
  ...TOPIC_META.B6,
  cards,
  flashcards,
  mcqs,
  games,
  shortAnswers,
  solve: generators,
  explore,
  traps: [...traps, ...shared],
  seeAlso: [
    { label: 'B3 beam tables, mode shapes and section scaling', href: '#/B3/learn' },
    { label: 'B4 forced response by modal superposition', href: '#/B4/learn' },
    { label: 'B5 Dunkerley lab: added masses in detail', href: '#/B5/explore/dunkerley' },
  ],
};

export default topic;
