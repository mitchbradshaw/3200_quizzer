// Topic B5: approximate methods (Rayleigh, Dunkerley, Holzer, FEM) and the B2 added-mass part.
import type { TopicDef } from '../../engine/types';
import { TOPIC_META } from '../meta';
import { cards, flashcards, traps } from './learn';
import { games, mcqs, shortAnswers } from './quiz';
import { generators } from './solve';
import { explore } from './explore';

const topic: TopicDef = {
  ...TOPIC_META.B5,
  cards,
  flashcards,
  mcqs,
  games,
  shortAnswers,
  solve: generators,
  explore,
  traps,
  seeAlso: [
    { label: 'B6 design studio: added masses in a full B2 problem', href: '#/B6/explore/studio' },
    { label: 'B3 beam tables and mode shapes', href: '#/B3/learn' },
  ],
};

export default topic;
