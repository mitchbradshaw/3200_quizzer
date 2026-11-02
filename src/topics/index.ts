// Topic registry. Each topic folder exports its TopicDef as default.
import type { TopicDef } from '../engine/types';
import type { Part, TopicCode } from '../engine/codes';
import { registerTraps } from '../engine/traps';
import A1 from './A1';
import A2 from './A2';
import A3 from './A3';
import A4 from './A4';
import A5 from './A5';
import A6 from './A6';
import B1 from './B1';
import B2 from './B2';
import B3 from './B3';
import B4 from './B4';
import B5 from './B5';
import B6 from './B6';
import C1 from './C1';
import C2 from './C2';
import C3 from './C3';
import C4 from './C4';

export const TOPICS: TopicDef[] = [A1, A2, A3, A4, A5, A6, B1, B2, B3, B4, B5, B6, C1, C2, C3, C4];
TOPICS.forEach((t) => registerTraps(t.traps));

export const topicByCode = (code: string): TopicDef | undefined => TOPICS.find((t) => t.code === code);
export const topicsInPart = (p: Part): TopicDef[] => TOPICS.filter((t) => t.part === p);
export const neighbours = (code: TopicCode): [TopicDef | undefined, TopicDef | undefined] => {
  const i = TOPICS.findIndex((t) => t.code === code);
  return [TOPICS[i - 1], TOPICS[i + 1]];
};
export const challengeIds = (t: TopicDef): string[] => t.explore.filter((e) => e.challenge).map((e) => e.challenge!.id);
