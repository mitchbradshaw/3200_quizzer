import { useMemo } from 'react';
import { TOPICS, challengeIds, topicsInPart } from '../topics';
import { PART_TITLES, type Part } from '../engine/codes';
import { dueCounts, mastery, storageAvailable, streak, useProgress } from '../app/store';
import { href } from '../app/router';
import { Badge, Callout, LinkButton, MasteryRing } from '../ui/kit';
import { Rich } from '../ui/Rich';

const PAPER = [
  { part: 'A1', marks: '16–20', what: 'short numericals: absorbers, damped eigen-output, base excitation, modal superposition' },
  { part: 'A2', marks: '20–24', what: 'Lagrange derivation for a 2–3 DoF system, frequencies, modes, forced response' },
  { part: 'A3', marks: '20', what: 'MCQs + word-limited answers: FFT, transducers, FRFs, isolation and control' },
  { part: 'B1', marks: '20', what: '8 MCQs: strings, rods, shafts, beams, approximate methods' },
  { part: 'B2', marks: '20', what: 'beam/shaft design problem: size it, f₁–f₃, sketches, forced response, added masses' },
];

export function Home() {
  const p = useProgress();
  const allCards = useMemo(() => TOPICS.flatMap((t) => t.flashcards), []);
  const { due, unseen } = dueCounts(p, allCards);
  const st = streak(p);
  const hitTraps = Object.values(p.traps).filter((t) => t.hits > 0).length;
  const beaten = Object.values(p.traps).filter((t) => t.beaten > 0).length;
  const acc = p.session.done ? Math.round((100 * p.session.correct) / p.session.done) : null;

  return (
    <div className="home">
      {!storageAvailable() && (
        <Callout kind="warn" title="Progress is not being saved">
          This browser is blocking local storage (e.g. a private window), so your progress lasts only until you close the page. Use ⚙ Settings → Export
          progress to keep it.
        </Callout>
      )}
      <section className="hero">
        <div>
          <h1>MECH3200 Vibrations Lab</h1>
          <p className="lede">
            Build intuition for what each parameter does, learn which method fits which question, and drill exam-style set-ups until they are fast and
            correct.
          </p>
        </div>
        <div className="stats">
          <div className="stat">
            <div className="stat-num">{st}</div>
            <div className="stat-label">day streak</div>
          </div>
          <a className="stat" href="#/review">
            <div className="stat-num">{due}</div>
            <div className="stat-label">cards due · {unseen} new</div>
          </a>
          <a className="stat" href="#/session">
            <div className="stat-num">{p.session.done}</div>
            <div className="stat-label">this session{acc !== null ? ` · ${acc}% right` : ''}</div>
          </a>
          <a className="stat" href="#/traps">
            <div className="stat-num">
              {beaten}/{hitTraps}
            </div>
            <div className="stat-label">traps beaten</div>
          </a>
        </div>
      </section>

      <section className="actions">
        <LinkButton href="#/review" variant="primary">
          Mixed review{due ? ` · ${due} due` : ''}
        </LinkButton>
        <LinkButton href="#/sprint/quick">Quick sprint · 20 min</LinkButton>
        <LinkButton href="#/sprint/mock">Mock paper · about 60 min</LinkButton>
      </section>

      {(['A', 'B', 'C'] as Part[]).map((part) => (
        <section key={part} className="part">
          <h2 className="part-title">{PART_TITLES[part]}</h2>
          <div className="topic-grid">
            {topicsInPart(part).map((t) => {
              const m = mastery(p, t.code, challengeIds(t));
              return (
                <a key={t.code} className="topic-tile" href={href(t.code)}>
                  <div className="tile-head">
                    <span className="tile-code">{t.code}</span>
                    <MasteryRing value={m.value} n={m.n} />
                  </div>
                  <div className="tile-title">{t.title}</div>
                  <div className="tile-blurb">
                    <Rich text={t.blurb} inline />
                  </div>
                  <div className="tile-meta">
                    <Badge>{t.lectures}</Badge>
                    {t.exam && <Badge tone="accent">{t.exam}</Badge>}
                  </div>
                  <div className="tile-counts">
                    {t.cards.length} cards · {t.explore.length} sims · {t.solve.length} problem types · {t.mcqs.length} MCQs
                  </div>
                </a>
              );
            })}
          </div>
        </section>
      ))}

      <section className="paper card">
        <h3 className="card-title">The paper at a glance (180 min, 100 marks)</h3>
        <table className="table">
          <tbody>
            {PAPER.map((r) => (
              <tr key={r.part}>
                <th>{r.part}</th>
                <td className="mono">{r.marks}</td>
                <td>{r.what}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted small">
          Habits that earn marks everywhere: convert units first (rpm ÷ 60 → Hz, × 2π → rad/s); formula → substitution → number with units; sanity-check
          (more stiffness raises ω, more mass lowers it; Dunkerley ≤ exact ≤ Rayleigh; higher modes have more nodes).
        </p>
      </section>
    </div>
  );
}
