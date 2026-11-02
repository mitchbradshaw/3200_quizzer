// Topic B1: big ideas of continuous systems. Concept cards and quizzes only (B1 is 8 MCQs in the exam);
// the simulations that show each idea live in B2–B5 and are linked through seeAlso.
import type { TopicDef, TrapDef } from '../../engine/types';
import { TOPIC_META } from '../meta';
import { cards, flashcards } from './learn';
import { games, mcqs, shortAnswers } from './quiz';

const traps: TrapDef[] = [
  { id: 'b1-ic-vs-modes', title: 'Initial conditions set amplitudes, not modes', detail: 'Initial conditions (and forcing) decide how much of each mode is excited ($C_n$, $D_n$). They never change $\\omega_n$ or the mode shapes.' },
  { id: 'b1-bc-matter', title: 'Boundary conditions set the frequency equation', detail: 'Change an end condition and every frequency and shape changes (clamped vs pinned beam: $\\omega_1 \\times 2.27$; fixed–fixed vs fixed–free rod: ×2).' },
  { id: 'b1-ode-vs-pde', title: 'ODEs for modes, the PDE for travelling waves', detail: 'Separation of variables gives ODEs that describe each mode (standing wave). General travelling waves need the PDE.' },
  { id: 'b1-large-amplitude', title: 'Large amplitude or nonlinear: no orthogonality, no superposition', detail: 'Orthogonality and modal superposition are linear (small-amplitude) results. Very large amplitudes, contact, buckling and crashes need nonlinear analysis (direct time integration).' },
  { id: 'b1-euler-limits', title: 'Euler–Bernoulli: long, thin beams only', detail: 'It neglects shear deformation and rotary inertia, so it over-predicts the frequencies of short, thick beams and high modes.' },
  { id: 'b1-fem-approx', title: 'FEM is approximate and converges with refinement', detail: 'Finite number of modes, accurate up to some frequency, better with smaller elements; not “always” an over- or under-estimate.' },
  { id: 'b1-forcing-not-model', title: 'Forcing does not change natural frequencies', detail: 'To correct wrong natural frequencies change the mass, stiffness or boundary conditions of the model, not the loads.' },
];

const topic: TopicDef = {
  ...TOPIC_META.B1,
  cards,
  flashcards,
  mcqs,
  games,
  shortAnswers,
  solve: [],
  explore: [],
  traps,
  seeAlso: [
    { label: 'B2 · Standing waves and end conditions', href: '#/B2/explore/standing', note: 'Boundary conditions set the frequency equation: switch between fixed–fixed, fixed–free and free–free and watch the modes and the frequency ladder change. Same shapes for a string, a rod and a shaft.' },
    { label: 'B2 · Pluck, touch and press a string', href: '#/B2/explore/pluck', note: 'Initial conditions set only the modal amplitudes: move the pluck point and the pitch stays put; a pluck at a node leaves that mode out.' },
    { label: 'B2 · Axial versus torsion', href: '#/B2/explore/axial-torsion', note: 'Frequencies scale with the wave speed: the same rod gives $\\sqrt{E/\\rho}$ for axial and $\\sqrt{G/\\rho}$ for torsion, independent of its diameter.' },
    { label: 'B2 · Whirling cable', href: '#/B2/explore/cable', note: 'What the frequencies depend on: tension (Ω, end mass) up, mass per length down; and why “model the end mass as fixed without loss of accuracy” is false.' },
    { label: 'B2 · Shaft with an end inertia', href: '#/B2/explore/end-inertia', note: 'A boundary that is neither fixed nor free: uneven spacing, and a new low mode that is not a “fixed end”.' },
    { label: 'B3 · Mode shapes and nodes for every support', href: '#/B3/explore/modes', note: 'Boundary conditions in bending: the node positions depend only on the supports, never on the material (2022 B1.5), and a free end moves most.' },
    { label: 'B3 · The βL table and the ratio trick', href: '#/B3/explore/ratios', note: 'Uneven spacing (cantilever 1 : 6.27 : 17.55) and strong boundary-condition sensitivity: clamping a pinned–pinned beam raises $\\omega_1$ by 2.27.' },
    { label: 'B4 · A force at a node', href: '#/B4/explore/node', note: 'Orthogonality at work: a force on a node of mode $i$ does not excite mode $i$, at any forcing frequency.' },
    { label: 'B4 · Modal superposition lab', href: '#/B4/explore/lab', note: 'Why a few modes are usually enough, and why “the first three modes suffice at any forcing frequency” is false.' },
    { label: 'B5 · FE mesh refinement', href: '#/B5/explore/fem', note: 'FEM is approximate and converges as the mesh is refined: consistent mass from above, lumped mass from below, so “always overestimates” is false.' },
    { label: 'B5 · Order the estimates', href: '#/B5/explore/order', note: 'Dunkerley ≤ exact ≤ Rayleigh, with a refined FE model at the exact value (2023 B1.8).' },
  ],
};

export default topic;
