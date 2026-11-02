// Extra pure functions for topic B1 (big ideas). They back the numbers quoted in the B1 cards and MCQs
// (FEM convergence, uneven spacing with an elastic support) and are checked in ./selftests.ts.
import { genSymEig } from '../../physics/linalg';
import { brent } from '../../physics/roots';

/**
 * Dimensionless natural frequencies w L / c of a uniform fixed–free rod (or shaft) modelled with N equal
 * two-node linear elements (LB9.2–9.3). Consistent mass: element m/6 [2 1; 1 2]; lumped: m/2 at each node.
 * Returns all N values, ascending. Exact values are (2n - 1) pi / 2.
 */
export function fixedFreeRodFEM(N: number, lumped = false): number[] {
  if (!Number.isInteger(N) || N < 1) throw new RangeError(`element count must be a positive integer (got ${N})`);
  const h = 1 / N; // element length as a fraction of L
  const n = N + 1;
  const K = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  const M = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (let e = 0; e < N; e++) {
    const ke = [
      [1 / h, -1 / h],
      [-1 / h, 1 / h],
    ];
    const me = lumped
      ? [
          [h / 2, 0],
          [0, h / 2],
        ]
      : [
          [(2 * h) / 6, h / 6],
          [h / 6, (2 * h) / 6],
        ];
    for (let a = 0; a < 2; a++)
      for (let b = 0; b < 2; b++) {
        K[e + a][e + b] += ke[a][b];
        M[e + a][e + b] += me[a][b];
      }
  }
  // Fixed end at node 0: delete its row and column.
  const Kr = K.slice(1).map((r) => r.slice(1));
  const Mr = M.slice(1).map((r) => r.slice(1));
  return genSymEig(Kr, Mr).omega2.map((w2) => Math.sqrt(Math.max(0, w2)));
}

/**
 * Roots z = w L / c of a string fixed at x = 0 and held by a spring k at x = L: tan z = -(T/(k L)) z
 * (reader Sample Problem 1(b), p. 77). `ratio` = T/(k L). Root n lies in ((n - 1/2) pi, n pi).
 */
export function elasticEndStringRoots(ratio: number, n: number): number[] {
  const out: number[] = [];
  for (let k = 1; k <= n; k++) {
    const f = (z: number) => Math.sin(z) + ratio * z * Math.cos(z); // = cos z (tan z + ratio z), no poles
    out.push(brent(f, (k - 0.5) * Math.PI + 1e-12, k * Math.PI, 1e-14));
  }
  return out;
}
