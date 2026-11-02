// Topic B2: strings, rods and shafts (the wave systems). See docs/AUTHORING.md.
import type { TopicDef, TrapDef } from '../../engine/types';
import { TOPIC_META } from '../meta';
import { cards, flashcards } from './learn';
import { games, mcqs, shortAnswers } from './quiz';
import { generators } from './solve';
import { explore } from './explore';

const traps: TrapDef[] = [
  { id: 'b2-tension-ratio', title: 'Frequency ∝ √T', detail: 'Changing a string’s frequency by a factor $r$ needs the tension changed by $r^2$ (Week 7 Q1: 153.6 N, not 204.75 N).' },
  { id: 'b2-E-vs-G', title: 'Axial uses E, torsion uses G', detail: '$c_A = \\sqrt{E/\\rho}$, $c_T = \\sqrt{G/\\rho}$ with $G = E/2(1+\\nu)$, or the $G$ given for a composite. Torsion is always lower.' },
  { id: 'b2-end-condition', title: 'Read the end conditions: c/2L or c/4L', detail: 'Fixed–fixed and free–free: $nc/2L$. Fixed–free: $(2n-1)c/4L$ (1 : 3 : 5). Massive rotors count as fixed; a tip with nothing on it is free.' },
  { id: 'b2-heavy-end-not-fixed', title: 'A heavy end inertia is not a fixed end', detail: '$z\\tan z = I_a/I_e$: a large disc lowers the fundamental to about $\\sqrt{k_t/I_e}$ (2021 B2.5: −97 %); only the higher modes approach the fixed–fixed values.' },
  { id: 'b2-gear-squared', title: 'Reflected inertia scales with the speed ratio squared', detail: 'An inertia turning $n$ times faster than the shaft appears as $n^2 I$ on the shaft.' },
  { id: 'b2-rho-vs-rhol', title: 'ρ (kg/m³) vs ρl (kg/m)', detail: 'Strings and beams use the mass per unit length $\\rho_l = \\rho A$; rods and shafts use the density $\\rho$.' },
  { id: 'b2-touch-vs-press', title: 'Light touch = node; firm press = new fixed end', detail: 'A light touch keeps only the harmonics with a node at the finger; a firm press makes a shorter string with a new fundamental.' },
  { id: 'b2-variable-tension', title: 'Varying tension', detail: 'Swinging weight: $T = mg(3\\cos\\theta - 2\\cos\\theta_0)$, largest at the bottom. Rotating cable: largest at the hub; Ω, $m$ up raise the frequencies, $\\rho_l$ up lowers them.' },
];

const topic: TopicDef = {
  ...TOPIC_META.B2,
  cards,
  flashcards,
  mcqs,
  games,
  shortAnswers,
  solve: generators,
  explore,
  traps,
  seeAlso: [
    { label: 'B1 · The big ideas behind these MCQs', href: '#/B1/quiz', note: 'Initial vs boundary conditions, PDE vs ODE, orthogonality and model limits: the statements that open every B1 section.' },
    { label: 'B3 · Beams in bending: mode shapes', href: '#/B3/explore/modes', note: 'Contrast with the wave systems: a clamped beam end has zero slope, a free beam end slopes, and only a pinned–pinned beam has pure sine modes.' },
    { label: 'B3 · What d, t and L do to a beam', href: '#/B3/explore/sections', note: 'Bending depends on the section ($\\omega \\propto d/L^2$ for a thin tube) while a uniform shaft’s torsion does not: the 2024/2025 B1.5 option set.' },
    { label: 'B5 · Holzer residual-torque plot', href: '#/B5/explore/holzer', note: 'Discs on a shaft, lumped: the grinding tool of Reader Sample Problem 7 (142.4 Hz against the exact 141.9 Hz).' },
  ],
};

export default topic;
