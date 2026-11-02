# Authoring guide: adding topics, questions and simulations

This app is React 18 + TypeScript, bundled by esbuild into one self-contained `index.html`.
Every topic (A1–A6, B1–B6, C1–C4, matching the Exam Summary Notes) lives in its own folder
`src/topics/<code>/` and exports one `TopicDef` (see `src/engine/types.ts`, the content contract).
**`src/topics/A1/` is the reference implementation: copy its patterns.**

## Commands

```bash
npm install                 # once (or set M32_TOOLCHAIN to a folder whose node_modules has the deps)
npm run build               # -> index.html (open by double-clicking)
npm test                    # physics + topic self-tests under Node (same list as #/selftest)
npm run typecheck           # tsc --strict
node scripts/crawl.mjs A4   # headless browser (1280 px): every A4 route, console errors / crashes / overflow / fps
node scripts/shot.mjs A4/explore/absorber a4.png --width 1280   # screenshot one route (no leading #/ needed)
```

When several people (or agents) edit different topics at once:

```bash
M32_ONLY=A4 node scripts/build.mjs --out /tmp/m32-A4.html   # other topics replaced by empty stubs
M32_ONLY=A4 node scripts/test.mjs A4
node scripts/crawl.mjs A4 --file /tmp/m32-A4.html --shots /tmp/a4-shots
```

## Folder layout for a topic

```
src/topics/A4/
  index.ts        TopicDef: { ...TOPIC_META.A4, cards, flashcards, mcqs, games, shortAnswers, solve, explore, traps? }
  learn.ts        cards: ConceptCard[], flashcards: Flashcard[]
  quiz.ts         mcqs: MCQ[], games: Game[], shortAnswers: ShortAnswer[]
  solve.ts        generators: SolveGenerator[]
  explore/        one React component per simulation + index.ts (ExploreItem[])
  selftests.ts    tests: SelfTest[]  (already wired into src/selftest/registry.ts)
  physics.ts      optional: extra pure functions this topic needs (keep src/physics/* unchanged)
```

## Text: the `Rich` format

All prose fields are `Rich` strings: `$inline TeX$`, `$$display TeX$$`, `**bold**`, `*italic*`,
`` `code` ``, a blank line for a new paragraph, `- ` bullets, `1. ` numbered lists. In TS string
literals backslashes are doubled: `'$\\omega_n = \\sqrt{k/m}$'`. Units go outside the maths:
`'$\\omega_n$ = 14.1 rad/s'`. Use `\\$` for a literal dollar sign.

## Learn

- **Concept cards** (3–6 per topic, one idea each): `what`, `when` (the question cues that call for
  it), `how` (numbered steps), `traps` (mistake + why it is wrong + source), `formulas` (display
  maths, shown first), optional `more` (progressive disclosure), `lecture` (reader reference),
  `exploreIds` / `solveIds` (links to this topic's sims and generators).
- **Flashcards** (15–30): crisp recall, parameter effects (“double k₂: what happens to ω₂?”),
  method choice. Ids must be unique and stable (progress is keyed on them).

## Quiz

- **MCQs** (10–20 per topic) in the course style: `style` is `correct`, `incorrect`,
  `most-correct`, `value` or `best`. **Every option needs a `why`.** Write original wording; for
  recurring exam statements, paraphrase and cite (`source: 'Recurring: official 2016 B1.8, 2023 B1.8'`).
  Options are shuffled; set `fixedOrder: true` when there is “None of the above”. Add `trapId`
  when the distractor is a named trap. Words like *always, only, never, cannot, all* usually make
  a statement false: use them the way the papers do.
- **Games**: `sort` (cards into buckets, e.g. “which method would you use?”) and `match`
  (cue → method). Every item has a `why`.
- **Short answers** (optional, A3/B1 style): word limit, model answer, 3–5 key points (self-marked).

## Solve generators

```ts
{
  id: 'a4-absorber-size', title: 'Size an absorber for a frequency margin',
  tiers: [1, 2, 3],                 // 1 Warm-up (one formula), 2 Exam (paper style), 3 Stretch (twist/trap)
  source: 'Similar to 2023 A1.4; Week 5 Q1', cardId: 'a4-absorber', marks: 4,
  generate(rng, tier) { ... return { prompt, givens, parts, hints: [concept, setup, substitution, worked] }; },
}
```

- Randomise with `rng.step(a, b, step)`, `rng.pick([...])`, `rng.int`, `rng.nice(x, sig)` within the
  ranges the papers use. Same seed ⇒ same problem (seeds are shown and bookmarkable).
- `parts` kinds: `numeric` (answer in `unit`; `freq: true` lets the student answer in Hz/rad/s/rpm;
  `tol` default 0.02; `traps: [{ value, message, trapId }]` for known wrong answers), `choice`
  (pick the formula/method/statement, `why` per option), `order` (derivation steps in correct
  order; the UI shuffles), `matrix` (M, K, P, Y₀...; `columnsUpToScale` for mode shapes;
  `traps` with wrong matrices, e.g. Pᵀx₀), `terms` (Lagrange builder: each candidate energy term
  with `belongs: 'T' | 'V' | 'none'`, its numeric `M`/`K` contribution and a `why`; the UI derives
  M and K live from the student's choices and checks them).
- **Hints are exactly four** and use this instance's numbers: concept → set-up (the formula with
  symbols) → substitution (numbers in) → full worked solution (bold final answers with units).
- The checker already detects generic traps (2π, 60, 1000, ×2, √, sign, %, unit-labelled-wrong).
  Add topic-specific ones as `traps` so feedback names the actual mistake.
- Long multi-part chains that don't suit the 20-minute quick sprint: `sprint: false`.

## Explore (simulations)

A simulation is a React component (default export) listed in `explore/index.ts`:
`{ id, title, summary, component, challenge?: { id, title }, minutes }`.

Building blocks (all in `src/ui/kit.tsx`, `src/plot/Plot.tsx`, `src/ui/diagrams.tsx`, `src/anim/hooks.ts`):

- Layout: `<SimLayout visual={...} controls={...} below={...} />` (stacks in windows narrower than 860 px). The app is used on a laptop: design for 1280–1440 px wide windows.
- Controls: `<Slider label tex tip value min max step|log unit onChange />`, `<Segmented>`, `<Toggle>`, `<Button>`.
- Readouts: `<Readouts><Readout tex="\\omega_1" tip="..." value={w1} unit="rad/s" tone="m1" /></Readouts>`.
  **Every number has a unit; every symbol has a tooltip (`tip`).**
- Plots (SVG): `<Plot x={{min,max,log?,label}} y={...}>` with `<Line points>`, `<Area>`, `<VLine>`,
  `<HLine>`, `<Band>`, `<HBand>`, `<Dot>`, `<Stems>`, `<Bars>`, `<PlotText>`, draggable `<Handle>`
  (pointer + arrow keys), and `<LivePath>` + `livePathD()` for per-frame traces.
  Sample curves with `sample(f, a, b, n, log)` inside `useMemo`.
- Animation: `useRaf((dt, t) => {...}, active, wrapperRef)` runs only while the element is on
  screen and the tab is visible. **Inside it, update SVG attributes through refs; never setState
  every frame.** Use analytic solutions where they exist, else `FixedStepper` (RK4 at a fixed
  step, independent of frame rate). Heavy recomputation driven by sliders: `useMemo` +
  `useFrameThrottled(value)` or React's `useDeferredValue`. Precompute mode shapes.
- Mechanical drawings: `springPath`, `damperPaths`, `<Spring>`, `<Damper>`, `<Ground>`, `<MassBlock>`,
  `<Arrow>`, `svgPoint()` for dragging inside a scalable SVG (`viewBox` + `width="100%"`).
- **Predict-then-reveal**: at least two `<PredictReveal id question options answer explain tryIt onApply />`
  per simulation. `onApply` changes the sim so the student sees the answer happen.
- Challenges: call `completeChallenge(id)` (from `src/app/store`) when the goal is met.

Colour carries meaning only: `var(--m1)`, `var(--m2)`, `var(--m3)` are modes 1/2/3 **everywhere**
(blue/orange/green); `var(--ok)` / `var(--bad)` for right/wrong (always with an icon or text too);
`var(--pred)` dashed for a prediction; `var(--accent)` for interactive handles; `var(--text-3)` for
reference curves. Never hard-code colours (both themes must work).

## Self-tests

Add `SelfTest`s to `selftests.ts` with reference values and their source (summary notes, reader
tables, worked solutions), using `near`, `nearAbs`, `isTrue`, `ascending` from `src/selftest/assert.ts`.
Include a generator sanity test (every generator, every tier, ~50 seeds: finite answers, 4 hints),
as in `src/topics/A1/selftests.ts`.

## Physics library (`src/physics/`)

Pure functions, SI units, rad/s unless named Hz: `sdof`, `mdof`, `absorber`, `rigidbody`, `damped`,
`linalg`, `poly`, `complex`, `roots`, `integrate`, `ode`, `units`, `waves`, `beams`, `forcedBeam`,
`approx`, `frf`, `transducers`, `dsp`. Read the file before using a function; each export has a
doc comment with its formula and course reference.

## Gotchas

- Write TeX-heavy files with an editor (or the Write tool), not shell heredocs: some shells collapse a doubled backslash to a single one, so `'\\theta'` in a TS string becomes `'\theta'`, a tab escape.
- KaTeX: write `\angle{-0.7}°`, not `\angle -0.7°` (otherwise the minus is spaced as a binary operator).
- Traps must sit more than `tol + 1.5 %` away from the correct answer; closer ones are ignored by the checker (they could not be told apart from a near miss).
- MCQ `source` lines are shown only after the student answers, with answer letters stripped (options are shuffled, so a paper's letter would not match).
- `modeShape()` at a node returns ~1e-16, not 0: round before printing it in hints or tables.
- `NumericInput`/`ChoiceInput` keep internal state: give them a React `key` when reusing them outside `SolveRunner`.
- Cross-topic simulation links in a concept card: `exploreIds: ['B2/standing']`.
- `<Readouts min={170}>` for long values; `<Handle labelPos="left">` near the right edge; `<Legend>` items accept `dash: '2 3'`.
- `node scripts/test.mjs B3 --verbose` prints every check with its value.
