// Pure logic of the A6 "Read the MATLAB output" drill (no React): the exam outputs as printed in official 2019 Q1e–f,
// 2023 A1.1–A1.2, 2024 A1.1 and 2025 A1.5, generated outputs, the questions a student answers from the PRINTED numbers,
// the worked reading, and the inspector's descriptions of entries and ratios. Used by explore/MatlabDrill.tsx and the
// A6 self-tests.
import type { ChoicePart, NumericPart } from '../../engine/types';
import { fmt, tex } from '../../engine/format';
import { makeRng } from '../../engine/rng';
import type { C } from '../../physics/complex';
import { cabs, cdiv } from '../../physics/complex';
import { fromEigenvalue } from '../../physics/damped';
import { eigListText, fieldWidths, matlabCell, matlabDrill, parseMatlabCell, ratio, sFromColumn, signedRatio } from './physics';

const TAU = 2 * Math.PI;

export type Variant = 'PD' | 'P' | 'eig';
export type SourceKey = 'gen' | 'y2019' | 'y2023' | 'y2024' | 'y2025';
export type Pick = { r: number; c: number };
export type Part = NumericPart | ChoicePart;

export interface Out {
  key: string;
  title: string;
  blurb: string;
  command: string;
  variant: Variant;
  /** Row meanings of P, as TeX. */
  rows: [string, string, string, string];
  /** Names of the two masses (mass 1 = rows 1 and 3). */
  mass: [string, string];
  P?: { cells: string[][]; v: C[][] };
  D?: string[][];
  eig?: string[][];
  /** Eigenvalue of each column (printed, or the exact one when only P is shown). */
  s: C[];
  /** Whether the eigenvalues are given to the student (D, an eig list or the question text). */
  sKnown: boolean;
  /** First column (0 or 2) of each mode's conjugate pair. */
  m1: number;
  m2: number;
  /** Name of the ratio asked for, as TeX, e.g. X_2/X_1. */
  rName: string;
  source: string;
}

// ---------------------------------------------------------------- outputs printed in the papers
const pad = (cells: string[][]) => {
  const w = Math.max(...cells.flat().map((t) => t.trim().length));
  return cells.map((row) => row.map((t) => t.trim().padStart(w)));
};
const parseAll = (cells: string[][]) => cells.map((row) => row.map(parseMatlabCell));
const diagText = (s: C[]) => {
  const Dm = s.map((_, i) => s.map((z, j) => (i === j ? z : { re: 0, im: 0 })));
  const w = fieldWidths(Dm);
  return Dm.map((row) => row.map((z) => matlabCell(z, w.wRe, w.wIm)));
};
const conjPair = (re: number, im: number): C[] => [
  { re, im },
  { re, im: -im },
];

const P2019 = pad([
  ['-0.000 - 0.0006i', '-0.000 + 0.0006i', '-0.0000 - 0.0000i', '-0.0000 + 0.0000i'],
  ['-0.000 - 0.0000i', '-0.000 + 0.0000i', '0.0000 + 0.0002i', '0.0000 - 0.0002i'],
  ['0.998 + 0.0000i', '0.998 + 0.0000i', '0.0917 - 0.0103i', '0.0917 + 0.0103i'],
  ['0.060 - 0.0012i', '0.060 + 0.0012i', '-0.996 + 0.0000i', '-0.996 + 0.0000i'],
]);
const P2023 = pad([
  ['-0.0003 - 0.0299i', '-0.0003 + 0.0299i', '-0.0002 - 0.0410i', '-0.0002 + 0.0410i'],
  ['0.0001 + 0.0119i', '0.0001 - 0.0119i', '-0.0003 - 0.0774i', '-0.0003 + 0.0774i'],
  ['0.9290 + 0.0000i', '0.9290 - 0.0000i', '0.4660 - 0.0003i', '0.4660 + 0.0003i'],
  ['-0.3688 + 0.0007i', '-0.3688 - 0.0007i', '0.8804 + 0.0000i', '0.8804 - 0.0000i'],
]);
const P2024 = pad([
  ['-0.0002 - 0.0213i', '-0.0002 + 0.0213i', '0.000 + 0.0054i', '0.000 - 0.0054i'],
  ['-0.0001 + 0.0025i', '-0.0001 - 0.0025i', '0.0006 + 0.0683i', '0.0006 - 0.0683i'],
  ['0.9928 + 0.000i', '0.9928 + 0.000i', '-0.0785 - 0.001i', '-0.0785 + 0.001i'],
  ['-0.1176 - 0.0051i', '-0.1176 + 0.0051i', '-0.9946 + 0.000i', '-0.9946 + 0.000i'],
]);
const S2019 = [...conjPair(-12.1, 1647.3), ...conjPair(-321, 5825.0)];
const S2023 = [...conjPair(-0.2717, 31.1078), ...conjPair(-0.038, 11.3775)];
const S2025 = [...conjPair(-0.1455, 53.0366), ...conjPair(-0.0171, 15.2933)];
const XV: [string, string, string, string] = ['X_1', 'X_2', 'V_1', 'V_2'];
const PD_CMD = '[P,D] = eig([zeros(2),eye(2);-inv(M)*K,-inv(M)*C])';

export function examOut(key: Exclude<SourceKey, 'gen'>): Out {
  if (key === 'y2019')
    return {
      key,
      title: 'Replay: official 2019 Q1e–f (wheel on a rail)',
      blurb: 'A wheel (mass 1) on a rail (mass 2) with contact and pad damping. The damped eigenvalues are $-12.1 \\pm 1647.3i$ and $-321 \\pm 5825.0i$ s⁻¹ (given in the question, not as $D$). Rows of $P_1$: wheel displacement, rail displacement, wheel velocity, rail velocity.',
      command: '[P1,D1] = eig(A);  P1',
      variant: 'P',
      rows: ['x_{wheel}', 'x_{rail}', 'v_{wheel}', 'v_{rail}'],
      mass: ['wheel', 'rail'],
      P: { cells: P2019, v: parseAll(P2019) },
      s: S2019,
      sKnown: true,
      m1: 0,
      m2: 2,
      rName: 'x_{rail}/x_{wheel}',
      source: 'Official 2019 Q1e–f (official answers: 1(e) b, 1(f) c); recurs as Week 6 Q3–Q4',
    };
  if (key === 'y2023')
    return {
      key,
      title: 'Replay: 2023 A1.1–A1.2 (two masses, [P, D])',
      blurb: 'A two-mass damped system solved with velocity as a separate variable. Rows of $P$: $X_1$, $X_2$, $V_1$, $V_2$. Mode 1 is the mode with the lower natural frequency.',
      command: PD_CMD,
      variant: 'PD',
      rows: XV,
      mass: ['mass 1', 'mass 2'],
      P: { cells: P2023, v: parseAll(P2023) },
      D: diagText(S2023),
      s: S2023,
      sKnown: true,
      m1: 2,
      m2: 0,
      rName: 'X_2/X_1',
      source: '2023 A1.1–A1.2 (no official solution; worked-solution values ζ₁ = 0.00334, ζ₂ = 0.00873, mode 1 = [1; 1.89])',
    };
  if (key === 'y2024')
    return {
      key,
      title: 'Replay: 2024 A1.1 (P printed, D missing)',
      blurb: 'A chain support–$(k_1, c_1)$–mass 1–$(k_2, c_2)$–mass 2. Only $P$ was printed (rows $X_1$, $X_2$, $V_1$, $V_2$), so the modes must be told apart from $P$ itself.',
      command: `${PD_CMD};  P`,
      variant: 'P',
      rows: XV,
      mass: ['mass 1', 'mass 2'],
      P: { cells: P2024, v: parseAll(P2024) },
      s: [...conjPair(-0.4376, 46.6062), ...conjPair(-0.1279, 14.5612)],
      sKnown: false,
      m1: 2,
      m2: 0,
      rName: 'X_2/X_1',
      source: '2024 A1.1 (no official solution; worked solution: mode 1 [1; 12.7] in phase, mode 2 [1; −0.118] out of phase)',
    };
  return {
    key,
    title: 'Replay: 2025 A1.5 (eigenvalues only)',
    blurb: 'A lightly damped two-mass model. `eig(A)` printed only the eigenvalues, in its own order.',
    command: 'eig(A)',
    variant: 'eig',
    rows: XV,
    mass: ['mass 1', 'mass 2'],
    eig: eigListText(S2025),
    s: S2025,
    sKnown: true,
    m1: 2,
    m2: 0,
    rName: 'X_2/X_1',
    source: '2025 A1.5 (no official solution; worked solution: ωd₁ = 15.2933 rad/s = 2.434 Hz, ωd₂ = 53.0366 rad/s)',
  };
}

export function genOut(seed: number, variant: Variant): Out {
  const d = matlabDrill(makeRng(seed));
  const v = [0, 1, 2, 3].map((r) => d.pc.map((c) => c.v[r]));
  const what =
    variant === 'eig'
      ? '`eig(A)` printed only the eigenvalues, in its own order.'
      : variant === 'P'
        ? 'Only $P$ was printed (rows $X_1$, $X_2$, $V_1$, $V_2$): tell the modes apart from $P$ itself.'
        : 'Rows of $P$: $X_1$, $X_2$, $V_1$, $V_2$; $D$ holds the eigenvalues.';
  return {
    key: `gen-${variant}-${seed}`,
    title: `Generated output (seed ${seed})`,
    blurb: `A chain support–$(k_1, c_1)$–mass 1–$(k_2, c_2)$–mass 2 with light damping, solved with velocity as a separate variable. ${what} Mode 1 is the lower-frequency mode.`,
    command: variant === 'eig' ? 'eig(A)' : variant === 'P' ? `${PD_CMD};  P` : PD_CMD,
    variant,
    rows: XV,
    mass: ['mass 1', 'mass 2'],
    P: variant === 'eig' ? undefined : { cells: d.text.P, v },
    D: variant === 'PD' ? d.text.D : undefined,
    eig: variant === 'eig' ? d.text.eig : undefined,
    s: d.pc.map((c) => c.s),
    sKnown: variant !== 'P',
    m1: d.k1,
    m2: d.k2,
    rName: 'X_2/X_1',
    source: `Generated like 2023 A1.1 (${d.higherFirst ? 'higher mode printed first' : 'printed in ascending order this time'}); M = diag(${d.sys.m[0]}, ${d.sys.m[1]}) kg, k = ${d.sys.k[0]}, ${d.sys.k[1]} N/m, c = ${d.sys.c[0]}, ${d.sys.c[1]} N s/m`,
  };
}

// ---------------------------------------------------------------- readings and questions
type Trap = { value: number; message: string; trapId?: string };
const keep = (answer: number, list: Trap[]) => list.filter((t) => Number.isFinite(t.value) && Math.abs(t.value - answer) > 0.03 * Math.abs(answer));
export const phaseWord = (deg: number) => (Math.abs(deg) < 20 ? 'in phase' : Math.abs(deg) > 160 ? 'out of phase' : 'neither');
export const cTeX = (z: C, sig = 4) => `${tex(z.re, sig)} ${z.im < 0 ? '-' : '+'} ${tex(Math.abs(z.im), sig)}i`;
const colOf = (out: Out, k: number): C[] => (out.P ? [0, 1, 2, 3].map((r) => out.P!.v[r][k]) : []);

/** What a student can read off: |s| per pair (given, or V/X from P), mode ratios from the velocity rows. */
export function readings(out: Out) {
  /** V_j/X_j estimates of each pair's eigenvalue from the printed P (best-resolved displacement row). */
  const est = out.P ? [0, 2].map((k) => sFromColumn(colOf(out, k), 2).s) : null;
  const sPair = [0, 2].map((k, i) => (out.sKnown || !est ? out.s[k] : est[i]));
  const sOf = (k: number) => sPair[k === 0 ? 0 : 1];
  const e1 = fromEigenvalue(sOf(out.m1));
  const e2 = fromEigenvalue(sOf(out.m2));
  const r = (k: number) => (out.P ? ratio(out.P.v[3][k], out.P.v[2][k]) : null);
  /** Eigenvalues printed against their columns (D or an eig list), or only recoverable from P? */
  const attached = !!out.D || !!out.eig;
  return { est, sPair, e1, e2, r1: r(out.m1), r2: r(out.m2), attached };
}

export function questions(out: Out): Part[] {
  const R = readings(out);
  const w = (R.attached || !R.est ? R.sPair : R.est).map(cabs);
  const parts: Part[] = [];
  const how = R.attached ? '$|s|$' : '$|V_j/X_j|$';
  const tail = !R.attached && out.sKnown ? ` That matches the given pair with $|s| = ${tex(cabs(out.s[out.m1]), 5)}$ rad/s.` : '';
  const colsQ: ChoicePart = {
    kind: 'choice',
    id: 'cols',
    label: 'Which columns hold **mode 1** (the lower natural frequency)?',
    options: [
      { text: 'Columns 1–2', correct: out.m1 === 0, why: `${how} ≈ ${fmt(w[0], 4)} rad/s for columns 1–2 against ${fmt(w[1], 4)} rad/s for columns 3–4.${out.m1 === 0 ? tail : ''}` },
      { text: 'Columns 3–4', correct: out.m1 === 2, why: `${out.m1 === 2 ? 'Yes: the smaller' : 'No: the larger'} ${how}, ${fmt(w[1], 4)} rad/s.${out.m1 === 2 ? ` MATLAB printed the higher mode first.${tail}` : ''}` },
    ],
  };
  const z1: NumericPart = {
    kind: 'numeric',
    id: 'z1',
    label: 'Damping ratio of mode 1, $\\zeta_1$',
    answer: R.e1.zeta,
    unit: '',
    traps: keep(R.e1.zeta, [
      { value: R.e2.zeta, message: 'That is the other pair. Mode 1 is the pair with the smaller $|s|$, wherever MATLAB printed it.', trapId: 'matlab-unsorted' },
      { value: R.e1.zeta * R.e1.wn, message: 'That is the decay rate $\\zeta\\omega_n = -\\mathrm{Re}\\,s$ in s⁻¹; divide by $|s|$.' },
    ]),
  };
  const ratioPart = (id: string, mode: 1 | 2): NumericPart | null => {
    const r = mode === 1 ? R.r1 : R.r2;
    const o = mode === 1 ? R.r2 : R.r1;
    if (!r || !o) return null;
    const ans = signedRatio(r);
    return {
      kind: 'numeric',
      id,
      label: `Mode ${mode} shape: $${out.rName}$ as one real number (its sign shows the phase)`,
      answer: ans,
      unit: '',
      traps: keep(ans, [
        { value: 1 / ans, message: `Upside down: the question asks for $${out.rName}$.` },
        { value: signedRatio(o), message: `That is mode ${mode === 1 ? 2 : 1}’s column. Identify the modes by $|s|$ first.`, trapId: 'matlab-unsorted' },
        { value: -ans, message: 'Right size, wrong sign: read the angle of the complex ratio (near 0° is +, near 180° is −).', trapId: 'a6-phase-from-magnitude' },
      ]),
    };
  };
  const phaseQ = (mode: 1 | 2): ChoicePart | null => {
    const r = mode === 1 ? R.r1 : R.r2;
    if (!r) return null;
    const word = phaseWord(r.deg);
    return {
      kind: 'choice',
      id: `ph${mode}`,
      label: `In mode ${mode}, how do ${the(out.mass[0])} and ${the(out.mass[1])} move?`,
      options: [
        { text: 'Almost in phase', correct: word === 'in phase', why: `The angle of $${out.rName}$ is ${fmt(r.deg, 4)}°.` },
        { text: 'Almost out of phase', correct: word === 'out of phase', why: `The angle of $${out.rName}$ is ${fmt(r.deg, 4)}°: near 180° means out of phase.` },
        { text: 'Neither: the angle is far from 0° and 180°', correct: word === 'neither', why: 'Only a strongly non-proportional damper gives such an angle.' },
      ],
    };
  };
  const push = (p: Part | null) => p && parts.push(p);

  if (out.variant === 'eig') {
    const s1 = R.sPair[out.m1 === 0 ? 0 : 1];
    const s2 = R.sPair[out.m1 === 0 ? 1 : 0];
    parts.push(
      {
        kind: 'numeric',
        id: 'fd1',
        label: 'Damped natural frequency of mode 1, $f_{d1}$',
        answer: Math.abs(s1.im) / TAU,
        unit: 'Hz',
        freq: true,
        traps: keep(Math.abs(s1.im) / TAU, [{ value: Math.abs(s2.im) / TAU, message: 'That is the other mode: the list is not sorted, so order the pairs by $|s|$.', trapId: 'matlab-unsorted' }]),
      },
      {
        kind: 'numeric',
        id: 'fd2',
        label: 'Damped natural frequency of mode 2, $f_{d2}$',
        answer: Math.abs(s2.im) / TAU,
        unit: 'Hz',
        freq: true,
        traps: keep(Math.abs(s2.im) / TAU, [{ value: Math.abs(s1.im) / TAU, message: 'That is mode 1.', trapId: 'matlab-unsorted' }]),
      },
      z1
    );
    return parts;
  }
  if (out.variant === 'PD') {
    parts.push(colsQ, z1, {
      kind: 'numeric',
      id: 'f1',
      label: 'Undamped natural frequency of mode 1, $f_1$',
      answer: R.e1.wn / TAU,
      unit: 'Hz',
      freq: true,
      traps: keep(R.e1.wn / TAU, [{ value: R.e2.wn / TAU, message: 'That is mode 2: sort by $|s|$.', trapId: 'matlab-unsorted' }]),
    });
    push(ratioPart('r1', 1));
    push(phaseQ(2));
    return parts;
  }
  // P printed: identify the modes from P (and the given eigenvalues, 2019), then read the shapes.
  if (!out.sKnown) {
    const est = sFromColumn(colOf(out, 0), 2);
    const wEst = cabs(est.s);
    const other = colOf(out, 0);
    parts.push({
      kind: 'numeric',
      id: 'w12',
      label: 'Estimate $|s|$ for columns 1–2 from $V_j/X_j$ (the natural frequency of that mode)',
      answer: wEst,
      unit: 'rad/s',
      tol: 0.05,
      traps: keep(wEst, [
        { value: cabs(other[2 + (1 - est.row)]) / Math.max(1e-4, cabs(other[est.row])), message: 'Pair each velocity with its own displacement: $V_1/X_1$ or $V_2/X_2$.', trapId: 'a6-mixed-columns' },
        { value: cabs(other[2 + est.row]) / Math.max(1e-4, cabs(other[1 - est.row])), message: 'Pair each velocity with its own displacement, and divide by the better-resolved one.', trapId: 'a6-mixed-columns' },
      ]),
    });
  } else parts.push(z1);
  parts.push(colsQ);
  push(ratioPart('r1', 1));
  push(ratioPart('r2', 2));
  if (out.key === 'y2019') push(phaseQ(2));
  return parts;
}

/** The full reading, worked from the printed numbers. */
export function workedReading(out: Out): string {
  const R = readings(out);
  const where = out.variant === 'eig' ? 'entries' : 'columns';
  const m1c = `${where} ${out.m1 + 1}–${out.m1 + 2}`;
  const lines: string[] = [];
  if (R.attached || !R.est)
    lines.push(`**Pairs.** ${R.sPair.map((s, i) => `${where} ${i * 2 + 1}–${i * 2 + 2}: $s = ${cTeX(s)}$, $|s| = ${tex(cabs(s), 5)}$ rad/s`).join('; ')}.`);
  else
    lines.push(
      `**Pairs from P.** $s \\approx V_j/X_j$ with the better-resolved displacement row: ${R.est.map((s, i) => `columns ${i * 2 + 1}–${i * 2 + 2}: $s \\approx ${cTeX(s, 3)}$, $|s| \\approx ${tex(cabs(s), 4)}$ rad/s`).join('; ')}.${out.sKnown ? ` So ${m1c} go with the given pair $${cTeX(out.s[out.m1])}$.` : ''}`
    );
  lines.push(
    `**Mode 1** is the smaller $|s|$: ${m1c}${out.m1 === 2 ? ' (MATLAB printed the higher mode first)' : ''}.`,
    out.sKnown
      ? `**Mode 1:** $\\omega_n = ${tex(R.e1.wn, 5)}$ rad/s ($f = ${tex(R.e1.wn / TAU, 4)}$ Hz), $\\zeta_1 = ${tex(R.e1.zeta, 4)}$, $\\omega_d = ${tex(R.e1.wd, 6)}$ rad/s ($f_d = ${tex(R.e1.wd / TAU, 4)}$ Hz). **Mode 2:** $\\omega_n = ${tex(R.e2.wn, 5)}$ rad/s, $\\zeta_2 = ${tex(R.e2.zeta, 4)}$, $\\omega_d = ${tex(R.e2.wd, 6)}$ rad/s ($f_d = ${tex(R.e2.wd / TAU, 4)}$ Hz).`
      : `**Frequencies:** mode 1 $\\omega_n \\approx ${tex(R.e1.wn, 3)}$ rad/s ($\\approx ${tex(R.e1.wn / TAU, 3)}$ Hz), mode 2 $\\approx ${tex(R.e2.wn, 3)}$ rad/s ($\\approx ${tex(R.e2.wn / TAU, 3)}$ Hz).`
  );
  if (R.r1 && R.r2) {
    const sh = (r: { mag: number; deg: number }) => `$${tex(r.mag, 4)}${angTeX(r.deg)}$ ⇒ **${fmt(signedRatio(r), 4)}** (${phaseWord(r.deg)})`;
    lines.push(`**Shapes** from the velocity rows, $${out.rName} = V_2/V_1$ inside one column: mode 1 ${sh(R.r1)}; mode 2 ${sh(R.r2)}.`);
  }
  if (!out.sKnown) lines.push('Without $D$ the damping ratios are too sensitive to rounding to quote: the frequencies and shapes are what the output supports.');
  return lines.join('\n\n');
}

// ---------------------------------------------------------------- the inspector
/** "mass 1" stays as it is; "wheel" becomes "the wheel". */
export const the = (m: string) => (m.startsWith('mass') ? m : `the ${m}`);
/** The entry exactly as MATLAB printed it, in code style. */
const printed = (out: Out, p: Pick) => `\`${out.P!.cells[p.r][p.c].trim()}\``;
/** Angle in TeX without scientific notation for tiny values; braces keep a minus sign unary after \angle. */
const angTeX = (deg: number) => `\\angle{${Math.abs(deg) < 0.001 ? '0' : tex(deg, 4)}}°`;

export function describeEntry(out: Out, p: Pick): string {
  const pair = p.c < 2 ? 'columns 1–2' : 'columns 3–4';
  const what = `${p.r < 2 ? 'displacement' : 'velocity'} of ${the(out.mass[p.r % 2])}`;
  return `$P_{${p.r + 1}${p.c + 1}}$ = ${printed(out, p)}: row ${p.r + 1} is $${out.rows[p.r]}$ (${what}); column ${p.c + 1} is the ${p.c % 2 ? 'conjugate' : '+imaginary'} member of the pair in ${pair}${out.sKnown ? `, eigenvalue $${cTeX(out.s[p.c])}$` : ''}.`;
}

export function analyse(out: Out, a: Pick, b: Pick): { tone: 'ok' | 'warn' | 'bad'; text: string } {
  const v = out.P!.v;
  const za = v[a.r][a.c];
  const zb = v[b.r][b.c];
  if (a.r === b.r && a.c === b.c) return { tone: 'warn', text: 'The same entry twice: pick two different entries.' };
  if (Math.floor(a.c / 2) !== Math.floor(b.c / 2))
    return { tone: 'bad', text: `**Different modes.** Columns ${a.c + 1} and ${b.c + 1} belong to different eigenvalue pairs, so this ratio means nothing: a mode ratio is taken inside one column.` };
  if (a.c !== b.c) return { tone: 'warn', text: `Columns ${a.c + 1} and ${b.c + 1} are a **conjugate pair**: the same mode written twice. Take both entries from one column.` };
  const velA = a.r >= 2;
  const velB = b.r >= 2;
  const tinyA = cabs(za) < 6e-4;
  const tinyB = cabs(zb) < 6e-4;
  if (a.r % 2 === b.r % 2) {
    // A velocity and the displacement of the same mass: V/X = s.
    const x = velA ? zb : za;
    if (cabs(x) < 1e-9) return { tone: 'bad', text: `The displacement entry ${printed(out, velA ? b : a)} prints as zero, so it cannot give $s$. Use the other mass’s rows of this column.` };
    const s = velA ? cdiv(za, zb) : cdiv(zb, za);
    const tinyX = cabs(x) < 6e-4;
    const base = velA ? `$${out.rows[a.r]}/${out.rows[b.r]} = ${cTeX(s)}$` : `This is $X/V = 1/s$; turned over, $s \\approx ${cTeX(s)}$`;
    return {
      tone: tinyX ? 'warn' : 'ok',
      text: `${base}: an estimate of this column’s eigenvalue, $|s| \\approx ${tex(cabs(s), 4)}$ rad/s.${tinyX ? ' The displacement entry is a rounded 0.000x value, so the estimate is rough (good enough to tell the modes apart, not to quote ζ); a better-resolved displacement gives a firmer value.' : ''}`,
    };
  }
  if (velA !== velB)
    return { tone: 'bad', text: `This divides a ${velA ? 'velocity' : 'displacement'} by the other mass’s ${velB ? 'velocity' : 'displacement'}: that is $s$ (or $1/s$) times a mode ratio, not a mode ratio. Use two displacements or two velocities of one column.` };
  if (tinyA || tinyB) {
    const which = [tinyA ? printed(out, a) : '', tinyB ? printed(out, b) : ''].filter(Boolean).join(' and ');
    return { tone: 'bad', text: `**Rounded entries.** ${which} ${tinyA && tinyB ? 'have' : 'has'} at most one significant figure, so a ratio built on ${tinyA && tinyB ? 'them' : 'it'} is mostly rounding. Use the velocity rows of this column, which are $|s|$ times larger.` };
  }
  const q = ratio(za, zb);
  return {
    tone: 'ok',
    text: `Mode-shape ratio ${out.mass[a.r % 2]}/${out.mass[b.r % 2]} $= ${tex(q.mag, 4)}${angTeX(q.deg)}$: **${phaseWord(q.deg)}**${phaseWord(q.deg) === 'neither' ? ' in nor out of phase' : ''}; as one signed number ${fmt(signedRatio(q), 4)}.`,
  };
}

export function describeEig(text: string, out: Out, col: number): string {
  const s = parseMatlabCell(text);
  if (!Number.isFinite(s.re)) return 'Not an eigenvalue.';
  if (s.re === 0 && s.im === 0) return 'An off-diagonal entry of $D$: always zero. The eigenvalues are on the diagonal.';
  const e = fromEigenvalue(s);
  const pair = out.variant === 'eig' ? `entries ${col < 2 ? '1–2' : '3–4'} of the list` : `columns ${col < 2 ? '1–2' : '3–4'} of $P$`;
  return `$s = ${cTeX(s)}$ (with its conjugate, ${pair}): $\\omega_n = |s| = ${tex(e.wn, 5)}$ rad/s, $\\zeta = -\\mathrm{Re}\\,s/|s| = ${tex(e.zeta, 4)}$, $\\omega_d = ${tex(e.wd, 6)}$ rad/s ($f_d = ${tex(e.wd / TAU, 4)}$ Hz).`;
}
