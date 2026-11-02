// "Read the MATLAB output" drill. Generated state-space eig outputs (pairs mostly printed higher-mode-first, unit-length
// columns, tiny "0.0000" entries) and replays of the outputs printed in official 2019 Q1e–f, 2023 A1.1–1.2, 2024 A1.1 and
// 2025 A1.5. Click an entry to see what it is; click two entries of P to divide them (first ÷ second); answer the
// reading questions with the app's trap-aware checker. Challenge: three outputs read cleanly.
// The data and the reading logic live in ../drill.ts (pure, self-tested); this file is the interactive shell.
import { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Callout, Card, ProgressBar, Readout, Readouts, Segmented, SimLayout } from '../../../ui/kit';
import { ChoiceInput, NumericInput, type PartResult } from '../../../ui/inputs';
import { PredictReveal } from '../../../ui/PredictReveal';
import { Rich } from '../../../ui/Rich';
import { completeChallenge, useProgress } from '../../../app/store';
import { hashString } from '../../../engine/rng';
import { cabs } from '../../../physics/complex';
import { fromEigenvalue } from '../../../physics/damped';
import { MatlabBlock } from '../MatlabBlock';
import { parseMatlabCell, ratio } from '../physics';
import { analyse, describeEig, describeEntry, examOut, genOut, questions, workedReading, type Pick, type SourceKey, type Variant } from '../drill';

export const A6_MATLAB_CHALLENGE = 'a6-read-three-outputs';
const GOAL = 3;

// ---------------------------------------------------------------- component
const SOURCES: { value: SourceKey; label: string }[] = [
  { value: 'gen', label: 'Generated' },
  { value: 'y2019', label: '2019' },
  { value: 'y2023', label: '2023' },
  { value: 'y2024', label: '2024' },
  { value: 'y2025', label: '2025' },
];

export default function MatlabDrill() {
  const prog = useProgress();
  const done = !!prog.challenges[A6_MATLAB_CHALLENGE];
  const [src, setSrc] = useState<SourceKey>('gen');
  const [variant, setVariant] = useState<Variant>('PD');
  const [seed, setSeed] = useState(3200);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [ePick, setEPick] = useState<{ name: string; r: number; c: number } | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [first, setFirst] = useState<Record<string, boolean>>({});
  const [clean, setClean] = useState<string[]>([]);

  const out = useMemo(() => (src === 'gen' ? genOut(seed, variant) : examOut(src)), [src, variant, seed]);
  const parts = useMemo(() => questions(out), [out]);
  const qSeed = hashString(out.key);

  const load = (s: SourceKey, v?: Variant, newSeed?: number) => {
    setSrc(s);
    if (v) setVariant(v);
    if (newSeed !== undefined) setSeed(newSeed);
    setPicks([]);
    setEPick(null);
    setRevealed(false);
    setFirst({});
  };

  const answered = parts.every((p) => p.id in first);
  const allRight = answered && parts.every((p) => first[p.id]);
  useEffect(() => {
    if (allRight && !revealed && !clean.includes(out.key)) setClean((c) => [...c, out.key]);
  }, [allRight, revealed, clean, out.key]);
  useEffect(() => {
    if (clean.length >= GOAL && !done) completeChallenge(A6_MATLAB_CHALLENGE);
  }, [clean.length, done]);

  const onResult = (id: string) => (r: PartResult) => setFirst((f) => (id in f ? f : { ...f, [id]: r.correct }));
  const colsKnown = revealed || first.cols === true;

  const onCell = (name: string, r: number, c: number) => {
    if (name === 'P') {
      setPicks((ps) => {
        const i = ps.findIndex((p) => p.r === r && p.c === c);
        if (i >= 0) return ps.filter((_, k) => k !== i);
        return ps.length >= 2 ? [ps[1], { r, c }] : [...ps, { r, c }];
      });
    } else setEPick((e) => (e && e.name === name && e.r === r && e.c === c ? null : { name, r, c }));
  };
  const isSelected = (name: string, r: number, c: number) => (name === 'P' ? picks.some((p) => p.r === r && p.c === c) : !!ePick && ePick.name === name && ePick.r === r && ePick.c === c);
  const tint = (name: string, col: number) => {
    if (!colsKnown || name === 'ans') return undefined;
    const m = Math.floor(col / 2) * 2 === out.m1 ? 1 : 2;
    return `color-mix(in srgb, var(--m${m}) 13%, transparent)`;
  };

  const matrices = [
    ...(out.P ? [{ name: 'P', cells: out.P.cells }] : []),
    ...(out.D ? [{ name: 'D', cells: out.D }] : []),
    ...(out.eig ? [{ name: 'ans', cells: out.eig }] : []),
  ];
  const ratioInfo = out.P && picks.length === 2 ? analyse(out, picks[0], picks[1]) : null;
  const eText = ePick ? (ePick.name === 'D' ? out.D![ePick.r][ePick.c] : out.eig![ePick.r][0]) : '';
  // Live readouts for the current selection: the picked eigenvalue, and first ÷ second of the picked P entries.
  const sPicked = eText ? parseMatlabCell(eText) : null;
  const eRead = sPicked && Number.isFinite(sPicked.re) && (sPicked.re !== 0 || sPicked.im !== 0) ? fromEigenvalue(sPicked) : null;
  const q = out.P && picks.length === 2 && cabs(out.P.v[picks[1].r][picks[1].c]) > 0 ? ratio(out.P.v[picks[0].r][picks[0].c], out.P.v[picks[1].r][picks[1].c]) : null;

  return (
    <div>
      <Callout kind="info" title={`Challenge: read ${GOAL} outputs without a slip`}>
        <Rich text="Answer every question of an output right at the first attempt (without revealing the reading) for three different outputs: generated ones or the exam replays. Click entries first to check what they are; clicking costs nothing." />
      </Callout>
      <SimLayout
        visual={
          <>
            <div className="row between">
              <strong>{out.title}</strong>
              <Badge tone="accent">{out.variant === 'PD' ? 'P and D' : out.variant === 'P' ? 'P only' : 'eigenvalues only'}</Badge>
            </div>
            <Rich text={out.blurb} />
            <div className="mono small muted">{`>> ${out.command}`}</div>
            <MatlabBlock matrices={matrices} onCell={onCell} isSelected={isSelected} colTint={tint} label="MATLAB output: click an entry to inspect it" />
            <div className="card" style={{ padding: '10px 12px' }}>
              <div className="small muted" style={{ marginBottom: 4 }}>
                Inspector
              </div>
              {!picks.length && !ePick && (
                <Rich
                  className="small"
                  text={out.P ? 'Click an entry of $P$ to see what it is; click a second one to divide them (first ÷ second). Click an eigenvalue to read $\\omega_n$, $\\zeta$ and $\\omega_d$.' : 'Click an eigenvalue to read $\\omega_n$, $\\zeta$ and $\\omega_d$ from it.'}
                />
              )}
              {ePick && <Rich className="small" text={describeEig(eText, out, ePick.name === 'D' ? ePick.c : ePick.r)} />}
              {out.P && picks.map((p, i) => <Rich key={`${p.r}-${p.c}`} className="small" text={`${picks.length === 2 ? (i ? '**÷** ' : '**First:** ') : ''}${describeEntry(out, p)}`} />)}
              {ratioInfo && (
                <Callout kind={ratioInfo.tone === 'ok' ? 'ok' : ratioInfo.tone === 'warn' ? 'warn' : 'bad'}>
                  <Rich text={ratioInfo.text} />
                </Callout>
              )}
            </div>
          </>
        }
        controls={
          <>
            <div className="small muted">Output</div>
            <Segmented size="sm" label="Which output" value={src} onChange={(s) => load(s)} options={SOURCES} />
            {src === 'gen' && (
              <>
                <Segmented
                  size="sm"
                  label="What is printed"
                  value={variant}
                  onChange={(v) => load('gen', v)}
                  options={[
                    { value: 'PD', label: 'P and D' },
                    { value: 'P', label: 'P only' },
                    { value: 'eig', label: 'eigenvalues only' },
                  ]}
                />
                <Button size="sm" variant="primary" onClick={() => load('gen', undefined, 1000 + Math.floor(Math.random() * 9000))}>
                  New output
                </Button>
              </>
            )}
            <div>
              <div className="small muted">{`Clean outputs: ${Math.min(clean.length, GOAL)} of ${GOAL}`}</div>
              <ProgressBar value={Math.min(clean.length, GOAL)} max={GOAL} tone={clean.length >= GOAL ? 'ok' : 'accent'} label="Outputs read cleanly" />
            </div>
            {done && <Badge tone="ok">✓ Challenge complete</Badge>}
            <div className="small muted">Your selection</div>
            <Readouts>
              <Readout tex="\omega_n" tip="|s| of the eigenvalue you clicked (rad/s)" value={eRead?.wn} unit="rad/s" />
              <Readout tex="\zeta" tip="−Re s/|s| of the eigenvalue you clicked" value={eRead?.zeta} sig={3} />
              <Readout tex="\omega_d" tip="|Im s| of the eigenvalue you clicked (rad/s)" value={eRead?.wd} unit="rad/s" sig={5} />
              <Readout tex="|a/b|" tip="magnitude of the first clicked entry of P divided by the second" value={q?.mag} sig={4} />
              <Readout tex="\angle(a/b)" tip="angle of first ÷ second in degrees: near 0 in phase, near ±180 out of phase" value={q?.deg} unit="°" sig={4} />
            </Readouts>
            <Rich
              className="small"
              text={[
                '**Reading order**\n',
                '1. Pair the conjugates: each ± pair (two adjacent columns) is **one** mode.',
                '2. Sort the pairs by $|s|$; without $D$, estimate $s = V_j/X_j$ inside a column. Mode 1 has the smaller $|s|$, wherever it is printed.',
                '3. $\\omega_n = |s|$, $\\zeta = -\\mathrm{Re}\\,s/|s|$, $\\omega_d = |\\mathrm{Im}\\,s|$.',
                '4. Shape: a ratio of two entries **of one column**, preferably the velocity rows (they are $|s|$ times larger, so they keep more digits).',
                '5. Angle near 0° in phase, near 180° out of phase; the magnitude says which mass dominates.',
              ].join('\n')}
            />
            <Rich className="note" text={`Source: ${out.source}.`} />
          </>
        }
        below={
          <Card title="Read the output">
            <ol className="parts">
              {parts.map((p) => (
                <li key={`${out.key}-${p.id}`} className="part">
                  <div className="part-label">
                    <Rich text={p.label} />
                  </div>
                  {p.kind === 'numeric' ? <NumericInput part={p} onResult={onResult(p.id)} /> : <ChoiceInput part={p} onResult={onResult(p.id)} seed={qSeed} />}
                </li>
              ))}
            </ol>
            <div className="row gap-s wrap">
              <Button size="sm" onClick={() => setRevealed(true)} disabled={revealed}>
                Show the full reading
              </Button>
              {allRight && !revealed && <Badge tone="ok">✓ Read cleanly</Badge>}
              {answered && !allRight && <Badge tone="warn">Not clean this time: try another output</Badge>}
            </div>
            {revealed && (
              <Callout kind="note" title="The reading">
                <Rich text={workedReading(out)} />
              </Callout>
            )}
          </Card>
        }
      />
      <PredictReveal
        id="a6-ml-first-pair"
        question="In the 2023 output, columns 1–2 hold the largest entry (0.9290) and their eigenvalue has $|s|$ = 31.1 rad/s. Are columns 1–2 mode 1?"
        options={['Yes: MATLAB lists mode 1 first', 'Not necessarily: compare |s| of both pairs. Here columns 3–4 (|s| = 11.4 rad/s) are mode 1', 'Yes: the largest entry marks the dominant mode']}
        answer={1}
        explain="`eig` does not sort. The pairs are $-0.2717 \pm 31.1078i$ ($|s| = 31.11$ rad/s) and $-0.0380 \pm 11.3775i$ ($|s| = 11.38$ rad/s), so mode 1 is in columns 3–4 with $\zeta_1 = 0.0380/11.378 = 0.00334$, and $\zeta_2 = 0.2717/31.109 = 0.00873$. Every column has an entry near 1 (unit length), so its size says nothing about the mode number."
        tryIt="open the 2023 replay and click both diagonal entries of D."
        onApply={() => {
          load('y2023');
          setEPick({ name: 'D', r: 2, c: 2 });
        }}
      />
      <PredictReveal
        id="a6-ml-tiny"
        question="In the 2019 $P_1$, mode 2’s wheel displacement prints as $-0.0000 - 0.0000i$. How do you get mode 2’s rail/wheel ratio?"
        options={['Divide by it anyway: it is only small', 'Use the velocity rows of the same column: v_rail/v_wheel', 'Use the displacement rows of column 1 instead']}
        answer={1}
        explain="Each column is $[X;\,sX]$ with $|s| \approx 5834$ rad/s here, so the velocity entries carry the digits: $v_{rail}/v_{wheel} = -0.996/(0.0917 - 0.0103i) = 10.79\angle{-173.6}°$, i.e. the rail dominates and the masses move almost **out** of phase (wheel/rail $= 0.0926\angle 173.6°$). That is why official 2019 Q1f(c), “mode 2 moves almost in phase”, is the incorrect statement."
        tryIt="open the 2019 replay, click P(4,3) then P(3,3)."
        onApply={() => {
          load('y2019');
          setPicks([
            { r: 3, c: 2 },
            { r: 2, c: 2 },
          ]);
        }}
      />
      <PredictReveal
        id="a6-ml-p-only"
        question="The 2024 output has no $D$. How can you tell which columns hold mode 1?"
        options={['You cannot without D', 'Estimate s = V₁/X₁ (or V₂/X₂) inside each column and compare |s|', 'Columns 1–2 are always mode 1']}
        answer={1}
        explain="Each column is $[X;\,sX]$, so $V_j/X_j = s$. Column 1: $0.9928/(-0.0002 - 0.0213i) = -0.44 + 46.61i$, $|s| \approx 46.6$ rad/s; column 3: $-0.9946/(0.0006 + 0.0683i) = -0.13 + 14.56i$, $|s| \approx 14.6$ rad/s. So columns 3–4 are mode 1 (printed second again), with shape $V_2/V_1 = 12.67\angle{-0.7}°$: [1; 12.7], in phase."
        tryIt="open the 2024 replay, click P(3,1) then P(1,1)."
        onApply={() => {
          load('y2024');
          setPicks([
            { r: 2, c: 0 },
            { r: 0, c: 0 },
          ]);
        }}
      />
    </div>
  );
}
