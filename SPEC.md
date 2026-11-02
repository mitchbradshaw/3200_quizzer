# MECH3200 Vibrations Lab: v1 build spec

**Goal.** An intuition-and-drill app for MECH3200. It teaches what each parameter does, which method fits which question, and how to set up exam questions quickly and correctly. It is used on a laptop for about 10–15 hours over 8–14 days, with time split evenly across Learn, Explore, Solve and Quiz. The source of truth is `MECH3200_Exam_Summary_Notes.pdf`, and the course reader wins any conflict. Every question is original and cites similar past questions (e.g. "similar to 2023 A1.4").

## v1 scope
- **All 16 topics** (A1–A6, B1–B6, C1–C4) get a hub with four tabs. B1 is concepts only, so its Explore and Solve tabs link to the B2–B5 activities that show each big idea in action.
- **Learn:** concept cards (what it is, when to use it, how to use it, common traps) and Leitner flashcards for every topic.
- **Explore:** every must-have interactive in the brief, each with predict-then-reveal prompts. They are built in priority order:
  - A2 → B3/B4/B6 → A4 → A3/A6 → C2/C3 → A5 → B5 → B2 → A1 → C1/C4 → B1.
- **Solve:**
  - Randomised exam-style generators at three difficulty levels: Warm-up, Exam and Stretch. Each problem shows a seed so it can be replayed.
  - A hint ladder: concept → set-up → substitution → full worked solution.
  - Answers are accepted within ±2 % (±1 % where the paper expects three significant figures), in Hz, rad/s or rpm.
  - When an answer is wrong, the app names the trap, e.g. "that's rad/s, the question asks for Hz" or "you used Pᵀ, not P⁻¹".
  - A link shows the relevant formula card.
- **Answer formats:**
  - Numbers with units.
  - MCQs.
  - Pick the formula.
  - Order the derivation steps.
  - Matrix entry: M, K, P and the modal initial conditions Y₀.
  - A T/V term builder for Lagrange problems (A2, A5) that derives M and K automatically and checks them.
- **Quiz:**
  - MCQs in the course style, including "which is incorrect" and "most correct", with an explanation for every option.
  - "Which method would you use?" sorting and matching games.
- **Home:**
  - A topic map grouped into Parts A, B and C, with a mastery ring for each topic.
  - A mixed review.
  - An exam sprint in two forms:
    - **Quick:** about 12 auto-marked items in 20 minutes, weighted towards weak topics and items due for review.
    - **Mock:** 60 minutes, about a third of a paper in the real proportions (A1, an A2 chain, A3, B1, a B2 chain) at the exam pace of 1.8 minutes a mark. Word-limited short answers show a model answer and a key-point checklist for self-marking.
- **Self-test page** at `#/selftest`.

## Deferred
- Phone and tablet layouts: the app is designed for a laptop screen only.
- Automatic marking of free-text answers.
- Sketching mode shapes freehand.
- Free-form symbolic algebra. The T/V builder works from a fixed palette of terms.
- Syncing progress across devices. Export and import cover this.

## Tech and delivery
- **Format:** one self-contained `index.html`, opened by double-clicking. All the JS, the CSS and KaTeX (with its fonts) are inlined, so it also works offline.
- **Stack:** React 18 and TypeScript, as you asked. The source tree is modular (`src/`), so topics can be built in parallel. esbuild bundles it into the single file (`npm run build`).
- **Physics and tests:** the physics is in pure TypeScript functions that also run under Node (`npm test`).
- **Maths:** KaTeX 0.16.11 is bundled, not loaded from a CDN.
- **Rendering:**
  - Plots and simulations are React-rendered SVG, so they're crisp and interactive (hover, drag handles).
  - Per-frame animation updates go through refs inside a `requestAnimationFrame` loop, so React doesn't re-render every frame.
  - A fixed-timestep RK4 integrator, or analytic solutions where they exist.
  - While a slider moves, heavy recomputation happens at most once a frame.
  - Mode shapes and beam roots are precomputed.
  - Animations pause when off-screen or when the tab is hidden.
- **Routing and storage:** hash routing (`#/A4/explore`, `#/sprint/mock`, `#/selftest`). Progress is kept in `localStorage`, wrapped in try/catch with an in-memory fallback.
- **Deliverables:** `index.html`, `README.md` (how to open it, what's in each topic, how to add questions) and this spec. A private hosted copy is published at the end.

## Visual style
- **Look:** clean and minimal. It follows the OS theme, with a manual light/dark toggle, and the greys are neutral.
- **Colour only carries meaning:**
  - Modes 1, 2 and 3 are blue, orange and green on every screen.
  - Correct and incorrect always show an icon and text, never colour alone.
  - Your prediction is dashed and the true answer is solid.
- **Text:**
  - Live readouts are in a monospace font.
  - Every number has units.
  - Symbols have tooltips.
- **Layout:** one idea per screen, with details behind "more".
- **Keyboard:** focus rings, arrow keys on sliders, Enter to check an answer.

## Progress tracking (light gamification)
- **Flashcards:** Leitner boxes 1–5, reviewed after 0, 1, 3, 7 and 14 days. A wrong answer sends the card back to box 1.
- **Topic mastery:** accuracy on the last ~10 Solve and Quiz attempts, weighted by difficulty level. Finishing an Explore challenge also counts.
- **Other progress features:**
  - A daily streak.
  - A "traps caught" tally for each named trap.
  - An end-of-session summary of what you missed, which trap it was, and a link back to it.
- **Mixed review:** flashcards that are due, plus Solve and Quiz items from your weakest topics.
- **Backup:** export and import your progress as a JSON file.

## Quality bar
- **Self-test values:**
  - Cantilever βL = 1.875 / 4.694 / 7.855, ratios 1 : 6.27 : 17.55.
  - Free–free mode-1 nodes at 0.224L and 0.776L.
  - For an absorber with β = 1, r₁r₂ = 1.
  - Dunkerley ≤ exact ≤ Rayleigh.
  - T = 1 at r = √2.
  - Half-power ζ recovered from a synthetic FRF.
  - The analytic SDOF response matches RK4.
  - Each topic adds its own checks.
- **Performance:** zero console errors and 60 fps.
- **Reviews:** two review rounds by fresh reviewer agents, using a headless browser at laptop widths (1280–1440 px), scored against the rubric. The target is an average of 8/10 or more.
