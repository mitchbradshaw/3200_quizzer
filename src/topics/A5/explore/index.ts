import type { ExploreItem } from '../../../engine/types';
import MountExplorer, { DECOUPLE_CHALLENGE } from './MountExplorer';
import BouncePitch, { BP_CHALLENGE } from './BouncePitch';
import RunUp, { RUNUP_CHALLENGE } from './RunUp';
import CornerChart from './CornerChart';

export const explore: ExploreItem[] = [
  {
    id: 'mounts',
    title: 'Drag the mounts: coupling, modes and centres of rotation',
    summary: 'A block on mounts around its outline. Drag mounts and the centre of mass, set $k_x$, $k_y$ and tilt, and watch $K$ change live: which terms couple sway, bounce and rock, and why. Each mode animates about its centre of rotation. Presets: 2017 machine, 2022 cabinet, 2024 box (± fifth spring), 2025 range hood, LA7 corner springs.',
    component: MountExplorer,
    challenge: { id: DECOUPLE_CHALLENGE, title: 'decouple the 2024 box' },
    minutes: 10,
  },
  {
    id: 'bounce-pitch',
    title: 'Bounce and pitch: nodes, decoupling and heave',
    summary: 'Car, minibus or pilot cabin on two springs. Animate both modes with their nodes ($x_n = -Z/\\Theta$), find when $k_1a = k_2b$ decouples them, and see whether deck heave excites pitch.',
    component: BouncePitch,
    challenge: { id: BP_CHALLENGE, title: 'decouple unequal springs' },
    minutes: 7,
  },
  {
    id: 'charts',
    title: 'Corner-spring chart: LA7 Eq 7.8 and Fig 2.11',
    summary: 'A uniform body on springs at its four lower corners: both coupled sway–rock frequencies as multiples of bounce, against $a/b$ for any $U = k_x/k_y$, with the centres of rotation and the Week 5 cuboid ranking overlaid.',
    component: CornerChart,
    minutes: 5,
  },
  {
    id: 'runup',
    title: 'Run-up and isolation: the 2025 range hood',
    summary: 'Run the fan up through the rigid-body resonances: the $y$ anti-resonance, the force growing as $\\Omega^2$, and an isolation check of every mode against the running speed.',
    component: RunUp,
    challenge: { id: RUNUP_CHALLENGE, title: 'isolate at 1200 rpm' },
    minutes: 7,
  },
];
