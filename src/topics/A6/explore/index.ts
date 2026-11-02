import type { ExploreItem } from '../../../engine/types';
import SPlane from './SPlane';
import ComplexModes from './ComplexModes';
import MatlabDrill, { A6_MATLAB_CHALLENGE } from './MatlabDrill';
import Rayleigh from './Rayleigh';

export const explore: ExploreItem[] = [
  {
    id: 'splane',
    title: 'Eigenvalues in the s-plane',
    summary: 'Drag an eigenvalue or change $\\zeta$ and watch it slide round the circle $|s| = \\omega_n$. Read $\\omega_n = |s|$, $\\zeta = -\\mathrm{Re}\\,s/|s|$ and $\\omega_d = \\mathrm{Im}\\,s$, then load the eigenvalues printed in 2019 and 2023.',
    component: SPlane,
    minutes: 5,
  },
  {
    id: 'complex-modes',
    title: 'Complex modes as rotating phasors',
    summary: 'Each mass moves as the shadow of its own rotating arrow. Proportional damping keeps the arrows at 0° or 180° (real modes); a single damper twists them into complex modes.',
    component: ComplexModes,
    minutes: 6,
  },
  {
    id: 'matlab',
    title: 'Read the MATLAB output',
    summary: 'Unsorted `[P, D]` outputs with tiny “0.0000” entries, generated or replayed from 2019, 2023, 2024 and 2025. Inspect entries, divide them, and read $\\zeta$, $\\omega_n$, the mode shapes and their phase. Challenge: three clean readings.',
    component: MatlabDrill,
    challenge: { id: A6_MATLAB_CHALLENGE, title: 'read three outputs without a slip' },
    minutes: 10,
  },
  {
    id: 'rayleigh',
    title: 'Rayleigh damping designer',
    summary: '$\\zeta(\\omega) = \\alpha/2\\omega + \\beta\\omega/2$: which modes the mass and stiffness parts damp, the belt drive with $C \\propto K$, and fitting α, β to two target damping ratios.',
    component: Rayleigh,
    minutes: 5,
  },
];
