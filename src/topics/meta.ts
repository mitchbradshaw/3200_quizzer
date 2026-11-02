// Fixed metadata for every topic (codes, titles and lecture references follow the Exam Summary Notes).
import type { Part, TopicCode } from '../engine/codes';

export interface TopicMeta {
  code: TopicCode;
  part: Part;
  title: string;
  short: string;
  lectures: string;
  blurb: string;
  exam: string;
}

export const TOPIC_META: Record<TopicCode, TopicMeta> = {
  A1: { code: 'A1', part: 'A', title: 'SDOF essentials', short: 'SDOF', lectures: 'LA1, LA7', blurb: 'Natural frequency, damping, free and forced response, base excitation and transmissibility.', exam: 'A1 short numericals' },
  A2: { code: 'A2', part: 'A', title: 'Equations of motion by Lagrange', short: 'Lagrange', lectures: 'LA1–LA2', blurb: 'Build T and V, read off M and K: rigid bodies on springs, pendulum on a cart, swings.', exam: 'A2 derivation (20–24 marks)' },
  A3: { code: 'A3', part: 'A', title: '2-DoF modes and modal analysis', short: 'Modes', lectures: 'LA3–LA5, LA8', blurb: 'det(K − ω²M) = 0, mode shapes, orthogonality, modal coordinates and initial conditions.', exam: 'A1 and A2 parts' },
  A4: { code: 'A4', part: 'A', title: 'Forced 2-DoF response and absorbers', short: 'Absorbers', lectures: 'LA6, LC4 §3.5', blurb: 'Receptances, anti-resonances and sizing a dynamic vibration absorber.', exam: 'A1 (absorber sizing most years)' },
  A5: { code: 'A5', part: 'A', title: 'Rigid bodies on resilient mounts', short: 'Mounts', lectures: 'LA7 + handout', blurb: 'Sway–bounce–rock coupling from mount positions; bounce–pitch; isolation design.', exam: 'A1/A2 parts, A3 MCQs' },
  A6: { code: 'A6', part: 'A', title: 'Damped MDOF and complex modes', short: 'Damped modes', lectures: 'LA9', blurb: 'State-space eigenvalues s = −ζωₙ ± iω_d, complex mode shapes, reading MATLAB output.', exam: 'A1 short answers' },
  B1: { code: 'B1', part: 'B', title: 'Big ideas of continuous systems', short: 'Big ideas', lectures: 'LB1, LB5, LB9', blurb: 'Infinite modes, what sets the frequencies, orthogonality, Euler–Bernoulli and FEM limits.', exam: 'B1 MCQs' },
  B2: { code: 'B2', part: 'B', title: 'Strings, rods and shafts', short: 'Waves', lectures: 'LB2–LB3', blurb: 'Wave speed, boundary conditions, harmonics, axial vs torsion, end inertias.', exam: 'B1 MCQs, B2 torsion parts' },
  B3: { code: 'B3', part: 'B', title: 'Transverse vibration of beams', short: 'Beams', lectures: 'LB4–LB5 + handout', blurb: 'βL tables, mode shapes and nodes, frequency ratios, section scaling.', exam: 'B2 design (20 marks)' },
  B4: { code: 'B4', part: 'B', title: 'Forced beam response', short: 'Forced beams', lectures: 'LB6', blurb: 'Modal superposition: which modes a point force excites, and by how much.', exam: 'B2 forced-response part' },
  B5: { code: 'B5', part: 'B', title: 'Approximate methods', short: 'Approx. methods', lectures: 'LB7–LB9', blurb: 'Rayleigh (upper bound), Dunkerley (lower bound), Holzer and FEM; added masses.', exam: 'B1 MCQs, B2 added-mass part' },
  B6: { code: 'B6', part: 'B', title: 'The B2 design problem', short: 'B2 design', lectures: 'LB4–LB8', blurb: 'A guided, randomised B2 walkthrough: size it, find f₁–f₃, sketch, force it, add masses.', exam: 'B2 (20 marks)' },
  C1: { code: 'C1', part: 'C', title: 'Transducers and excitation', short: 'Transducers', lectures: 'LC1–LC2', blurb: 'Seismic instruments, accelerometer bandwidth, hammer tips and shakers.', exam: 'A3 MCQs' },
  C2: { code: 'C2', part: 'C', title: 'FRFs and modal parameters', short: 'FRFs', lectures: 'LC2', blurb: 'Receptance plots, half-power damping, real/imaginary and Nyquist views, mode shapes from FRFs.', exam: 'A3' },
  C3: { code: 'C3', part: 'C', title: 'Signal processing', short: 'DSP', lectures: 'LC3', blurb: 'Sampling, aliasing, resolution, leakage, windows, averaging and coherence.', exam: 'A3 numeric parts' },
  C4: { code: 'C4', part: 'C', title: 'Vibration control', short: 'Control', lectures: 'LC4', blurb: 'Source, path and receiver: balance, retune, isolate, damp, absorb or go active.', exam: 'A3 MCQs' },
};
