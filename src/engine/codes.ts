// Topic codes match the sections of MECH3200_Exam_Summary_Notes.pdf. Pure module (no React).
export const TOPIC_CODES = [
  'A1', 'A2', 'A3', 'A4', 'A5', 'A6',
  'B1', 'B2', 'B3', 'B4', 'B5', 'B6',
  'C1', 'C2', 'C3', 'C4',
] as const;

export type TopicCode = (typeof TOPIC_CODES)[number];
export type Part = 'A' | 'B' | 'C';
export type Tier = 1 | 2 | 3;

export const PART_TITLES: Record<Part, string> = {
  A: 'Part A: discrete systems',
  B: 'Part B: continuous systems',
  C: 'Part C: measurement & applications',
};

export function isTopicCode(s: string): s is TopicCode {
  return (TOPIC_CODES as readonly string[]).includes(s);
}
