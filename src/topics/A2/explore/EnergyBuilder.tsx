// Energy builder: sort candidate energy terms into T, V or "not a term" for seven systems and
// watch M and K assemble symbolically, entry by entry, with each entry marked against the answer.
import { useMemo, useState, type ComponentType, type KeyboardEvent } from 'react';
import { Badge, Button, Callout, Readout, Readouts, Segmented, SimLayout, Sym, Toggle } from '../../../ui/kit';
import { Rich, TeX } from '../../../ui/Rich';
import { PredictReveal } from '../../../ui/PredictReveal';
import { completeChallenge, useProgress } from '../../../app/store';
import { hashString, makeRng } from '../../../engine/rng';
import { assemble, barSystem, beltSystem, boxSystem, cartRodSystem, entryTeX, hoodSystem, nestSystem, platformSystem, type Bucket, type SystemDef, type Tile } from '../systems';
import { BarFigure, BeltFigure, BoxFigure, CartRodFigure, HoodFigure, NestFigure, PlatformFigure } from '../figures';
import { termName } from '../speech';
import { SymMatrix } from './SymMatrix';

export const BUILDER_CHALLENGE = 'a2-builder-four';

// Generic (non-round) reference values: the display is symbolic, the numbers only decide ✓/✗.
const SYSTEMS: { sys: SystemDef; Fig: ComponentType; short: string }[] = [
  { sys: cartRodSystem({ m: 2.3, M: 1.7, L: 0.9, k: 37 }), Fig: CartRodFigure, short: 'Rod on a cart' },
  { sys: barSystem({ m: 1.3, J: 0.7, k1: 2.9, a: 0.6, k2: 3.7, b: 0.8 }), Fig: BarFigure, short: 'Bar on springs' },
  { sys: nestSystem({ m: 1.9, I: 0.45, h: 1.3, k: 2.2 }), Fig: NestFigure, short: 'Nest swing' },
  { sys: beltSystem({ IT: 0.31, IP: 0.77, R1: 0.37, R2: 0.83, k: 5.3 }), Fig: BeltFigure, short: 'Belt drive' },
  { sys: platformSystem({ m: 2.6, IG: 0.53, k1: 3.1, k2: 4.7, a: 0.45 }), Fig: PlatformFigure, short: 'Folding legs' },
  { sys: boxSystem({ m: 2.2, kx: 3.3, ky: 1.9, a: 0.7, b: 1.1, c: 0.45 }), Fig: BoxFigure, short: 'Box (3 DoF)' },
  { sys: hoodSystem({ m: 2.7, I: 0.9, kx: 3.1, ky: 1.3, s: 0.6, d: 0.45 }), Fig: HoodFigure, short: 'Range hood (3 DoF)' },
];

const BUCKETS: { id: Bucket; label: string; hint: string }[] = [
  { id: 'T', label: 'T: kinetic', hint: 'key T' },
  { id: 'V', label: 'V: potential', hint: 'key V' },
  { id: 'none', label: 'Not a term', hint: 'key N' },
];
const bucketName = (b: Bucket) => (b === 'T' ? 'T' : b === 'V' ? 'V' : '“not a term”');

const grid = <T,>(n: number, f: (i: number, j: number) => T): T[][] => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => f(i, j)));
const maxAbs = (A: number[][]) => A.reduce((m, r) => r.reduce((mm, x) => Math.max(mm, Math.abs(x)), m), 0) || 1;

function det(A: number[][]): number {
  if (A.length === 2) return A[0][0] * A[1][1] - A[0][1] * A[1][0];
  return A[0][0] * (A[1][1] * A[2][2] - A[1][2] * A[2][1]) - A[0][1] * (A[1][0] * A[2][2] - A[1][2] * A[2][0]) + A[0][2] * (A[1][0] * A[2][1] - A[1][1] * A[2][0]);
}

/** One EoM row in symbols: Σ M_ij q̈_j + Σ K_ij q_j = 0. */
function eomRow(sys: SystemDef, i: number): string {
  const term = (e: string, v: string) => (/ [+-] /.test(e) ? `(${e})\\,${v}` : `${e}\\,${v}`);
  const parts: string[] = [];
  sys.coords.forEach((c, j) => sys.Msym[i][j] !== '0' && parts.push(term(sys.Msym[i][j], `\\ddot{${c}}`)));
  sys.coords.forEach((c, j) => sys.Ksym[i][j] !== '0' && parts.push(term(sys.Ksym[i][j], c)));
  return `${parts.map((p, k) => (k === 0 ? p : p.startsWith('-') ? ` - ${p.slice(1)}` : ` + ${p}`)).join('')} = 0`;
}

export default function EnergyBuilder() {
  const progress = useProgress();
  const [idx, setIdx] = useState(0);
  const [places, setPlaces] = useState<Record<string, Record<string, Bucket>>>({});
  const [sel, setSel] = useState<string | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [solved, setSolved] = useState<Record<string, boolean>>({});
  // Systems whose terms were placed by a "Show me" preset: they do not count towards the challenge until reset.
  const [shown, setShown] = useState<Record<string, boolean>>({});
  const [showTarget, setShowTarget] = useState(false);
  const { sys, Fig } = SYSTEMS[idx];
  const place = places[sys.id] || {};
  const n = sys.coords.length;
  const order = useMemo(() => makeRng(hashString(sys.id)).shuffle(sys.tiles), [sys]);
  // Plain-text accessible names ("cart: ½ m ẋ²"), once per system.
  const names = useMemo(() => new Map(sys.tiles.map((t) => [t.id, termName(t)])), [sys]);
  const live = assemble(sys, place);
  const mScale = maxAbs(sys.M);
  const kScale = maxAbs(sys.K);
  const near = (a: number, b: number, s: number) => Math.abs(a - b) <= 1e-9 * s;
  const mStatus = grid(n, (i, j) => near(live.M[i][j], sys.M[i][j], mScale));
  const kStatus = grid(n, (i, j) => near(live.K[i][j], sys.K[i][j], kScale));
  const mOk = mStatus.every((r) => r.every(Boolean));
  const kOk = kStatus.every((r) => r.every(Boolean));
  const nPlaced = sys.tiles.filter((t) => place[t.id]).length;
  const isChecked = !!checked[sys.id];
  const nSolved = SYSTEMS.filter((s) => solved[s.sys.id]).length;
  const challengeDone = !!progress.challenges[BUILDER_CHALLENGE];
  const singular = Math.abs(det(sys.K)) <= 1e-9 * Math.pow(kScale, n);

  const setPlace = (sysId: string, next: Record<string, Bucket>) => {
    setPlaces((p) => ({ ...p, [sysId]: next }));
    setChecked((c) => ({ ...c, [sysId]: false }));
  };
  const placeTile = (id: string | null, b: Bucket) => {
    if (!id || !sys.tiles.some((t) => t.id === id)) return;
    setPlace(sys.id, { ...place, [id]: b });
    setSel(null);
  };
  const unplace = (id: string) => {
    const { [id]: _drop, ...rest } = place;
    setPlace(sys.id, rest);
  };
  const onKey = (e: KeyboardEvent<HTMLButtonElement>, id: string) => {
    const k = e.key.toLowerCase();
    const b: Bucket | null = k === 't' ? 'T' : k === 'v' ? 'V' : k === 'n' || k === '0' ? 'none' : null;
    if (b) {
      e.preventDefault();
      placeTile(id, b);
    }
  };
  const check = () => {
    setChecked((c) => ({ ...c, [sys.id]: true }));
    const allRight = sys.tiles.every((t) => place[t.id] === t.belongs);
    if (allRight && !shown[sys.id]) {
      const next = { ...solved, [sys.id]: true };
      setSolved(next);
      if (SYSTEMS.filter((s) => next[s.sys.id]).length >= 4) completeChallenge(BUILDER_CHALLENGE);
    }
  };
  /** Place every tile where it belongs, then apply overrides (used by "Show me"). */
  const preset = (sysId: string, override: Record<string, Bucket> = {}) => {
    const i = SYSTEMS.findIndex((s) => s.sys.id === sysId);
    const s = SYSTEMS[i].sys;
    const p: Record<string, Bucket> = {};
    for (const t of s.tiles) p[t.id] = t.belongs;
    setIdx(i);
    setSel(null);
    setPlace(sysId, { ...p, ...override });
    setShown((s) => ({ ...s, [sysId]: true }));
  };

  const chip = (t: Tile) => (
    <span>
      <span className="muted small" style={{ display: 'block' }}>
        {t.role}
      </span>
      <Rich text={t.tex} inline />
    </span>
  );

  return (
    <div>
      <div className="row gap-s wrap" style={{ marginBottom: 6 }}>
        <span className="muted small">System:</span>
        <Segmented
          size="sm"
          label="Choose a system"
          value={idx}
          onChange={(i: number) => {
            setIdx(i);
            setSel(null);
          }}
          options={SYSTEMS.map((s, i) => ({ value: i, label: `${solved[s.sys.id] ? '✓ ' : ''}${s.short}`, title: s.sys.source }))}
        />
      </div>
      <SimLayout
        visual={
          <>
            <div className="row between">
              <strong>
                {sys.name} <span className="muted small">({sys.source})</span>
              </strong>
            </div>
            <Fig />
            <Rich className="small" text={sys.setup} />
            <p className="muted small" style={{ margin: '4px 0' }}>
              Pick a term, then its column (or drag it; with a term focused press T, V or N). Click a placed term to return it. Each term is one body’s or one spring’s complete energy, right or plausibly wrong.
            </p>
            <div className="pool" aria-label="Candidate energy terms">
              {order
                .filter((t) => !place[t.id])
                .map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`chip-card ${sel === t.id ? 'is-picked' : ''}`}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData('text/plain', t.id)}
                    onClick={() => setSel(sel === t.id ? null : t.id)}
                    onKeyDown={(e) => onKey(e, t.id)}
                    aria-pressed={sel === t.id}
                    aria-label={`${names.get(t.id)}. Candidate term: press T, V or N to place it.`}
                  >
                    {chip(t)}
                  </button>
                ))}
              {nPlaced === sys.tiles.length && <span className="muted small">All terms placed. Check when ready.</span>}
            </div>
            <div className="buckets" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
              {BUCKETS.map((b) => (
                <div key={b.id} className={`bucket ${sel ? 'is-target' : ''}`} onDragOver={(e) => e.preventDefault()} onDrop={(e) => placeTile(e.dataTransfer.getData('text/plain'), b.id)}>
                  <button type="button" className="bucket-head" onClick={() => placeTile(sel, b.id)} disabled={!sel} title={b.hint}>
                    {b.label}
                  </button>
                  {order
                    .filter((t) => place[t.id] === b.id)
                    .map((t) => {
                      const ok = t.belongs === b.id;
                      return (
                        <div key={t.id} className={`chip-card is-placed ${isChecked ? (ok ? 'cell-ok' : 'cell-bad') : ''}`}>
                          <button type="button" className="chip-text" onClick={() => unplace(t.id)} title="Return to the pool" aria-label={`${names.get(t.id)}, placed in ${bucketName(b.id)}. Press to return it to the pool.`}>
                            {chip(t)}
                          </button>
                          {isChecked && (
                            <div className="chip-why">
                              {ok ? '✓ ' : `✗ belongs in ${bucketName(t.belongs)}. `}
                              <Rich text={t.why} inline />
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              ))}
            </div>
          </>
        }
        controls={
          <>
            <div className="small">
              Coordinates{' '}
              {sys.coords.map((c, i) => (
                <span key={c} style={{ marginRight: 8 }}>
                  <Sym tex={c} tip={sys.coordTips[i]} />
                </span>
              ))}
              <span className="muted">(hover for directions)</span>
            </div>
            <div className="derived-label">Your M (from the terms in T)</div>
            <SymMatrix name="M" entries={grid(n, (i, j) => entryTeX(live.mPieces, i, j))} status={nPlaced ? mStatus : undefined} compact={n > 2} />
            <div className="derived-label">Your K (from the terms in V)</div>
            <SymMatrix name="K" entries={grid(n, (i, j) => entryTeX(live.kPieces, i, j))} status={nPlaced ? kStatus : undefined} compact={n > 2} />
            {nPlaced === 0 && <p className="muted small" style={{ margin: 0 }}>Each entry is marked ✓ or ✗ against the answer as soon as you place a term.</p>}
            <Readouts>
              <Readout label="terms placed" value={nPlaced} sig={2} text={`${nPlaced} / ${sys.tiles.length}`} tip="Every term must go somewhere" />
              <Readout label="M entries ✓" tip="entries of your M that match the answer (counted once you place a term)" text={nPlaced ? `${mStatus.flat().filter(Boolean).length} / ${n * n}` : '–'} tone={nPlaced && mOk ? 'ok' : undefined} />
              <Readout label="K entries ✓" tip="entries of your K that match the answer (counted once you place a term)" text={nPlaced ? `${kStatus.flat().filter(Boolean).length} / ${n * n}` : '–'} tone={nPlaced && kOk ? 'ok' : undefined} />
              <Readout label="systems solved" text={`${nSolved} / ${SYSTEMS.length}`} tone={nSolved >= 4 ? 'ok' : undefined} />
            </Readouts>
            <div className="row gap-s wrap">
              <Button variant="primary" onClick={check} disabled={nPlaced === 0}>
                Check the terms
              </Button>
              <Button
                onClick={() => {
                  setPlace(sys.id, {});
                  setShown((s) => ({ ...s, [sys.id]: false }));
                }}
              >
                Reset
              </Button>
            </div>
            {isChecked &&
              (sys.tiles.every((t) => place[t.id] === t.belongs) ? (
                <Callout kind="ok" title="Correct: these are the equations of motion">
                  {sys.coords.map((_, i) => (
                    <TeX key={i} display>
                      {eomRow(sys, i)}
                    </TeX>
                  ))}
                  {singular && <Rich text="$\\det K = 0$: the system can move without stretching any spring, so one natural frequency is zero (a rigid-body mode)." />}
                  {shown[sys.id] && !solved[sys.id] && <p className="muted small">These terms were placed by “Show me”, so this system does not count towards the challenge yet: press Reset and build it yourself.</p>}
                </Callout>
              ) : (
                <Callout kind="bad" title={`${sys.tiles.filter((t) => place[t.id] !== t.belongs).length} term(s) not where they belong`}>
                  {nPlaced < sys.tiles.length ? 'Place every term (wrong ones go in “not a term”). ' : ''}
                  Read the ✗ notes under each term. M {mOk ? 'matches' : 'does not match yet'}; K {kOk ? 'matches' : 'does not match yet'}.
                </Callout>
              ))}
            <Toggle checked={showTarget} onChange={setShowTarget} label="Show the target M and K" />
            {showTarget && (
              <>
                <SymMatrix name="M_{target}" entries={sys.Msym} compact={n > 2} />
                <SymMatrix name="K_{target}" entries={sys.Ksym} compact={n > 2} />
              </>
            )}
            <div className="row gap-s wrap">
              {challengeDone ? <Badge tone="ok">✓ Challenge complete: four systems built</Badge> : <Badge tone="accent">Challenge: build four systems correctly ({nSolved}/4)</Badge>}
            </div>
          </>
        }
      />
      <PredictReveal
        id="a2-build-split"
        question="Bar on two springs: you write the left spring’s energy split as $\tfrac12 k_1y^2 + \tfrac12 k_1(a\theta)^2$ instead of $\tfrac12 k_1(y - a\theta)^2$. Which part of K goes wrong?"
        options={['Only $K_{11}$', 'The coupling $K_{12}$ loses its $-k_1a$ part', 'Nothing: the two forms are equal', '$K_{22}$ doubles']}
        answer={1}
        explain="$\tfrac12 k_1(y - a\theta)^2 = \tfrac12 k_1y^2 - k_1a\,y\theta + \tfrac12 k_1a^2\theta^2$. Splitting drops exactly the cross term, so $K_{12}$ becomes $k_2b$ instead of $k_2b - k_1a$: the coupling, and with it both frequencies and mode shapes, are wrong (official 2017: elastic energy cannot be separated into translational and rotational parts)."
        tryIt="press Show me: every term is placed correctly except the left spring, which uses the split version. Watch the ✗ on K₁₂."
        onApply={() => preset('bar', { 'bar-V1': 'none', 'bar-V1-split': 'V' })}
      />
      <PredictReveal
        id="a2-build-cos1"
        question="Rod on a cart: if the gravity term is linearised with $\cos\theta \approx 1$, what is $K_{22}$?"
        options={['$MgL$', '0: the rod loses its restoring stiffness', '$2MgL$', '$\\tfrac43 MgL$']}
        answer={1}
        explain="$MgL(1-\cos\theta)$ with $\cos\theta \approx 1$ is exactly zero, so nothing enters $K_{22}$ and the rod’s equation has no restoring term. Keep $\cos\theta \approx 1-\theta^2/2$ in V: it gives $\tfrac12 MgL\theta^2$, i.e. $K_{22} = MgL$ (reader LA2 Example 2)."
        tryIt="press Show me: the gravity term is swapped for its cos θ ≈ 1 version."
        onApply={() => preset('cart', { 'grav-V': 'none', 'grav-cos1': 'V' })}
      />
      <PredictReveal
        id="a2-build-belt"
        question="Belt drive, with both belt sides in V. What is $\det K$?"
        options={['Positive: the belt resists every motion', 'Zero: the drive can rotate without stretching the belt', 'Negative']}
        answer={1}
        explain="$K = 2k\begin{bmatrix} R_1^2 & -R_1R_2 \\ -R_1R_2 & R_2^2\end{bmatrix}$ has $\det K = 4k^2(R_1^2R_2^2 - R_1^2R_2^2) = 0$. The rotation with $R_1\theta_1 = R_2\theta_2$ stretches nothing: a rigid-body mode at ω = 0 (official 2019 Q2(2)). A singular K is correct here, not a mistake."
        tryIt="press Show me, then Check the terms."
        onApply={() => preset('belt')}
      />
    </div>
  );
}
