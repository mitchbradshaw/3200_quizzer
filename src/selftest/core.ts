// Tests for the core maths helpers (complex, roots, quadrature, RK4, units).
import type { SelfTest } from './types';
import { near, nearAbs, isTrue } from './assert';
import { c, cmul, cdiv, csqrt, cabs } from '../physics/complex';
import { brent, scanRoots } from '../physics/roots';
import { simpson } from '../physics/integrate';
import { integrate } from '../physics/ode';
import { convertFreq } from '../physics/units';

export const coreTests: SelfTest[] = [
  {
    id: 'core-complex',
    topic: 'core',
    title: 'Complex arithmetic',
    run: () => {
      const a = c(3, 4);
      const b = c(1, -2);
      const q = cdiv(cmul(a, b), b);
      const r = csqrt(c(-4, 0));
      return [
        near('|3+4i| = 5', cabs(a), 5, 1e-12),
        nearAbs('(a·b)/b = a (real part)', q.re, 3, 1e-12),
        nearAbs('(a·b)/b = a (imag part)', q.im, 4, 1e-12),
        nearAbs('√(−4) = 2i', r.im, 2, 1e-12),
      ];
    },
  },
  {
    id: 'core-roots',
    topic: 'core',
    title: 'Root finding (Brent, scan with pole rejection)',
    run: () => {
      const r = brent((x) => Math.cos(x) - x, 0, 1);
      // z tan z = 1 has roots near 0.8603, 3.4256; tan has poles at pi/2, 3pi/2 that must be rejected.
      const zs = scanRoots((z) => z * Math.tan(z) - 1, 0.01, 4, 4000);
      return [
        near('cos x = x  →  x = 0.739085', r, 0.7390851332, 1e-9),
        near('z tan z = 1, first root 0.8603', zs[0], 0.8603335890, 1e-8),
        near('z tan z = 1, second root 3.4256', zs[1], 3.4256184595, 1e-8),
        isTrue('poles of tan z rejected (exactly 2 roots below 4)', zs.length === 2, `found ${zs.length}`),
      ];
    },
  },
  {
    id: 'core-quadrature',
    topic: 'core',
    title: "Simpson's rule",
    run: () => [
      near('∫₀^π sin x dx = 2', simpson(Math.sin, 0, Math.PI, 200), 2, 1e-8),
      near('∫₀^1 x⁴ dx = 0.2', simpson((x) => x ** 4, 0, 1, 100), 0.2, 1e-8),
    ],
  },
  {
    id: 'core-rk4',
    topic: 'core',
    title: 'RK4 on an undamped oscillator (one period)',
    run: () => {
      const wn = 2 * Math.PI;
      const out = integrate((_t, y) => [y[1], -wn * wn * y[0]], [1, 0], 0, 1, 1e-3);
      const yEnd = out.y[out.y.length - 1];
      return [nearAbs('x(T) = x(0) = 1', yEnd[0], 1, 1e-8), nearAbs('v(T) = 0', yEnd[1], 0, 1e-6)];
    },
  },
  {
    id: 'core-units',
    topic: 'core',
    title: 'Frequency units',
    run: () => [
      near('3000 rpm = 50 Hz', convertFreq(3000, 'rpm', 'Hz'), 50, 1e-12),
      near('50 Hz = 314.159 rad/s', convertFreq(50, 'Hz', 'rad/s'), 314.1592654, 1e-9),
      near('100 rad/s = 954.93 rpm', convertFreq(100, 'rad/s', 'rpm'), 954.9296586, 1e-9),
    ],
  },
];
