# MECH3200 Vibrations Lab

An interactive study app for UQ **MECH3200 Advanced Dynamics & Vibrations**. It is built from the course reader,
the Exam Summary Notes, the 2016–2025 papers and the Week 1–12 quizzes, and has three aims:

- build intuition for what each parameter does,
- show which method fits which kind of question,
- drill exam-style set-ups until they are fast and correct.

## Opening it

Double-click **`index.html`**. It runs in Chrome, Edge, Firefox or Safari. The code, styles and maths fonts are all
inside that one file, so it works offline and needs no install.

Your progress is saved in the browser's local storage, separately for each browser. The app covers:

- flashcard boxes,
- attempts,
- mastery,
- the trap log,
- your daily streak,
- sprint history.

To back it up or move it to another browser, use **⚙ Settings → Export / Import progress**. If local storage is
blocked (some private windows), the app still works and warns you that progress will only last until you close the page.

## What's in it

**Home** shows the topic map grouped into Part A (discrete systems), Part B (continuous systems) and Part C
(measurement & applications). Each topic has a mastery ring. From Home you can open:

- **Mixed review**: flashcards that are due across all topics, plus a short set from your weakest topics.
- **Quick sprint**: about 12 auto-marked items in 20 minutes, weighted towards weak topics.
- **Mock paper**: 60 minutes, about a third of a real paper in its real proportions (A1, A2 chain, A3, B1, B2 chain), at 1.8 min per mark.

Every topic has the same four tabs. The URLs are bookmarkable, e.g. `#/A4/explore`.

| Tab | What it does |
|---|---|
| **Learn** | Concept cards: what it is, when to use it, how to use it, common traps, formula box and "more" detail. Flashcards use five Leitner boxes, reviewed after 0, 1, 3, 7 and 14 days; a miss sends a card back to box 1. |
| **Explore** | Simulations with sliders, draggable points, presets, live readouts (units, symbol tooltips) and plots. Each has predict-then-reveal prompts; some have a challenge. |
| **Solve** | Randomised exam-style problems at three levels (Warm-up / Exam / Stretch). Answers are checked to ±2 % (frequencies accepted in Hz, rad/s or rpm; you can type expressions such as `2*pi*50`). Hints step through concept → set-up → substitution → full worked solution. A "Show the formula" link opens the relevant card. Every problem shows its seed so you can replay it, and cites similar past questions. |
| **Quiz** | MCQs in the course style ("which statement is INCORRECT / MOST correct") with an explanation for every option. Also "which method would you use?" sorting and matching games, and word-limited short answers that you mark against key points. |

Other screens:

- **Trap log** (`#/traps`): every named mistake the app has caught in your answers (Hz vs rad/s, Pᵀ vs P⁻¹, force vs base excitation, damping above √2…). A trap counts as beaten once you get that item right.
- **Session summary** (`#/session`): what you missed this session, and why.
- **Self-test** (`#/selftest`): every physics function checked against reference values from the summary notes, the reader's tables and exact solutions. These include:
  - cantilever βL 1.875 / 4.694 / 7.855 and ratios 1 : 6.27 : 17.55,
  - free–free nodes at 0.224L and 0.776L,
  - absorber r₁r₂ = 1 when β = 1,
  - Dunkerley ≤ exact ≤ Rayleigh,
  - T = 1 at r = √2,
  - half-power ζ recovered from a synthetic FRF,
  - analytic vs RK4 SDOF response.

## Topics and content

Generated from the content by `node scripts/inventory.mjs`.

| Topic | Concept cards | Flashcards | Simulations | Problem types | MCQs | Games | Short answers |
|---|---|---|---|---|---|---|---|
| A1 SDOF essentials | 4 | 22 | 4 | 7 | 11 | 2 | 2 |
| A2 Equations of motion by Lagrange | 6 | 30 | 4 | 8 | 18 | 2 | 3 |
| A3 2-DoF modes and modal analysis | 5 | 28 | 3 | 7 | 15 | 2 | 2 |
| A4 Forced 2-DoF response and absorbers | 6 | 30 | 4 | 7 | 16 | 2 | 4 |
| A5 Rigid bodies on resilient mounts | 5 | 30 | 4 | 7 | 14 | 2 | 3 |
| A6 Damped MDOF and complex modes | 4 | 25 | 4 | 5 | 17 | 2 | 2 |
| B1 Big ideas of continuous systems | 5 | 28 | 0 | 0 | 25 | 3 | 2 |
| B2 Strings, rods and shafts | 5 | 30 | 6 | 7 | 14 | 2 | 2 |
| B3 Transverse vibration of beams | 6 | 30 | 3 | 7 | 16 | 2 | 2 |
| B4 Forced beam response | 5 | 25 | 3 | 7 | 15 | 2 | 2 |
| B5 Approximate methods | 6 | 30 | 5 | 7 | 14 | 3 | 2 |
| B6 The B2 design problem | 6 | 26 | 2 | 4 | 12 | 2 | 3 |
| C1 Transducers and excitation | 4 | 30 | 2 | 5 | 16 | 2 | 3 |
| C2 FRFs and modal parameters | 4 | 30 | 3 | 7 | 19 | 2 | 4 |
| C3 Signal processing | 5 | 30 | 3 | 7 | 16 | 2 | 3 |
| C4 Vibration control | 5 | 30 | 3 | 4 | 15 | 2 | 3 |
| **Total** | 81 | 454 | 53 | 96 | 253 | 34 | 42 |

### A1 SDOF essentials (LA1, LA7)
- **Explore:** Mass–spring–damper; Door-closer challenge (challenge: close fastest without slamming); Forced response: amplitude and phase; Base excitation and isolation
- **Solve:** Static sag → natural frequency; Free vibration: amplitude and maximum speed; Steady-state amplitude under a harmonic force; Allowable floor vibration (base excitation); Door-closer damping; Building on a damped foundation (ground motion); Isolator design for a target transmissibility
- **Learn:** Natural frequency and free response; Damping regimes and critical damping; Forced response (force on the mass); Base excitation, transmissibility and isolation

### A2 Equations of motion by Lagrange (LA1–LA2)
- **Explore:** Energy builder: T and V → M and K (challenge: build M and K correctly for four systems); Spring deflection = translation + rotation × lever arm; Pendulum (rod) on a cart; Rigid bar on springs: bounce and pitch (challenge: decouple bounce and pitch)
- **Solve:** Rigid bar on two springs (bounce–pitch); Pendulum (rod) on a cart; Nest swing: absolute vs relative rotation; Folding-leg platform: mechanism kinematics; Box on four rubber springs (3 DoF); Range hood on wall mounts with an unbalanced fan; Unrestrained systems: rail cars, belt drive, gear train; Lagrange recipe: steps, which T and V, matching a given EoM
- **Learn:** The Lagrange recipe; Kinetic energy → M: use absolute velocities; Potential energy → K: deflection = translation + rotation × lever arm; Gravity, pendulums and static equilibrium; Generalised forces, dampers and moving bases; Checking M and K: symmetry, coupling and zero-frequency modes

### A3 2-DoF modes and modal analysis (LA3–LA5, LA8)
- **Explore:** Two-mass chain: the modes in motion; The frequency equation det(K − ω²M); Initial conditions → modal coordinates (challenge: excite only mode 1)
- **Solve:** Natural frequencies and mode shapes from M and K; Free response to initial conditions (Y₀ = P⁻¹X₀); Initial conditions that excite only one mode; Modal superposition from a table of modes; Semi-definite systems: rigid-body and flexible modes; Modal forces Pᵀ F and the modal step response; Orthogonality checks, modal mass and nodes
- **Learn:** Natural frequencies: det(K − ω²M) = 0; Mode shapes and the modal matrix P; Orthogonality, modal mass and modal forces; Free response from initial conditions; Rigid-body (semi-definite) modes and repeated roots

### A4 Forced 2-DoF response and absorbers (LA6, LC4 §3.5)
- **Explore:** Receptances: resonances and anti-resonances; Absorber tuning challenge (challenge: lightest absorber that clears the band); Damped absorber: fixed points and merging peaks; Suppressed coordinate: bounce or pitch?
- **Solve:** Size a tuned absorber for a frequency margin; Untuned absorber: β, new frequencies and retuning; Anti-resonance of a two-mass chain; How many resonances, and which receptance can vanish?; Forcing frequency that suppresses one coordinate; Isolator or absorber? A camera on a vibrating platform; Steady-state amplitudes X = (K − Ω²M)⁻¹F
- **Learn:** Forced 2-DoF response and receptances; Anti-resonances and suppressed coordinates; Sizing a tuned absorber (β = 1); Untuned absorbers (β ≠ 1) and retuning; Damped absorbers and tuned mass dampers; Absorber, isolator or damping?

### A5 Rigid bodies on resilient mounts (LA7 + handout)
- **Explore:** Drag the mounts: coupling, modes and centres of rotation (challenge: decouple the 2024 box); Bounce and pitch: nodes, decoupling and heave (challenge: decouple unequal springs); Corner-spring chart: LA7 Eq 7.8 and Fig 2.11; Run-up and isolation: the 2025 range hood (challenge: isolate at 1200 rpm)
- **Solve:** K and M from a mount table; Which motions couple, and how to decouple them; Bounce–pitch frequencies and nodes; Box on rubber springs, including a fifth spring; Range hood on three wall mounts: isolation check; Cabinet on a wall: K, decoupling and frequencies; Machine on isolator springs (official 2017 A2)
- **Learn:** From a mount table to K and M; Which motions couple, and how to decouple them; Frequencies, mode shapes and centres of rotation; Bounce and pitch: cars, minibuses and pilot cabins; Isolating a rigid body: check every mode

### A6 Damped MDOF and complex modes (LA9)
- **Explore:** Eigenvalues in the s-plane; Complex modes as rotating phasors; Read the MATLAB output (challenge: read three outputs without a slip); Rayleigh damping designer
- **Solve:** ζ, ωn and ωd from damped eigenvalues; Damping ratios and mode shapes from a MATLAB [P, D] output; Mode shapes from P alone (no D); Damped natural frequencies from a list of eigenvalues; Rayleigh damping: ζ = α/2ω + βω/2
- **Learn:** Reading a damped eigenvalue s; State space and reading MATLAB’s [P, D]; Complex mode shapes: magnitude and phase; Proportional (Rayleigh) damping

### B1 Big ideas of continuous systems (LB1, LB5, LB9)
- **Learn:** Continuous systems: a PDE and infinitely many modes; What sets the natural frequencies, and what does not; Boundary conditions, and how waves make modes; Orthogonality, superposition and the small-amplitude limit; Model limits: Euler–Bernoulli beams and finite elements

### B2 Strings, rods and shafts (LB2–LB3)
- **Explore:** Standing waves and end conditions; Pluck, touch and press a string (challenge: play the octave); Swinging weight: tension through the swing (challenge: an octave within each swing); Whirling cable: what Ω, m and ρₗ do; Axial versus torsion (and bending); Shaft with an end inertia (challenge: halve the fundamental)
- **Solve:** String frequencies from tension and mass per length; Pluck, touch or press: which harmonics sound?; Rods and shafts: material, end conditions, axial vs torsion; Torsional critical speed → shaft length and frequencies; Shaft with an end inertia ($z\tan z = I_a/I_e$); Swinging weight: tension and string frequency through the swing; Rotating cable with an end mass
- **Learn:** One wave equation, three members: what sets the wave speed; End conditions: frequencies, mode shapes and nodes; Strings: tension, pluck, touch and press; When the tension varies: swinging weights and rotating cables; Shafts with discs, rotors and gears: $z\tan z = I_a/I_e$

### B3 Transverse vibration of beams (LB4–LB5 + handout)
- **Explore:** Mode shapes and nodes for every support; The βL table and the ratio trick; Section scaling: what d, t, w and L change (challenge: size the narrowest eVTOL wing)
- **Solve:** Size a rectangular wing for a frequency margin; Thin-tube blades and shafts: size d, find the frequencies; Blade length from a measured critical speed; The ratio trick: one measured frequency gives the rest; Node positions: sweet spots, pin tests, masses and forces; What does each change do to f₁?; Pick the supports, then the frequencies
- **Learn:** Beam equation, boundary conditions and natural frequencies; Mode shapes, nodes and sketches; The ratio trick and changing supports; Section scaling: what L, d, t, w and h change; Sizing a beam for a frequency margin (the B2.1 step); Using nodes: sweet spots, pin tests and masses

### B4 Forced beam response (LB6)
- **Explore:** Modal superposition lab; A force at a node; Unbalance sweep and the thinnest wing (challenge: size the thinnest wing for 0.1 mm)
- **Solve:** Response ratios with rotating unbalance; Wing thickness for an amplitude limit; Maximum allowable force for a deflection limit; Wall-thickness change for a response target; Which mode dominates the response?; Modal amplitudes aᵢ: build the table; Machine at mid-span of a clamped–clamped beam
- **Learn:** Modal superposition for a harmonic point force; Which modes respond, and how many do you need?; Rotating unbalance: comparing speeds and engines; Designing for an amplitude limit: t, P_max and % changes; Assumptions behind the forced-response model

### B5 Approximate methods (LB7–LB9)
- **Explore:** Rayleigh trial-shape lab; Dunkerley with added masses; Holzer residual-torque plot; Order the estimates (challenge: order every set of estimates); FE mesh refinement
- **Solve:** Tip mass from a measured frequency drop; Effect of added masses on f₁ (%); Critical speed of a shaft carrying rotors; Rayleigh: pinned beam with a point mass (sine shape); Holzer march on a 2–3 disc chain; Cantilever with a tip mass: bracket f₁; Torsional shaft with an end disc
- **Learn:** Rayleigh’s energy method (upper bound); Dunkerley’s method (lower bound); The B2 added-mass part; Holzer’s method (torsional chains); The finite element method; Comparing and ordering the estimates

### B6 The B2 design problem (LB4–LB8)
- **Explore:** B2 design studio (challenge: make the eVTOL wing pass all three checks); Bending vs torsion
- **Solve:** Design an eVTOL wing (cantilever, thin rectangle); Design check of a turbine blade (cantilevered thin tube); Design check of a hydropower shaft (torsion and bending); Torsional design of a hybrid-car half-axle
- **Learn:** The B2 design template (7 steps); Steps 1–2: model, convert and size; Step 3: sketching the modes; Step 4: torsion vs bending; Step 5: forced response in the design problem; Steps 6–7: added masses and validity

### C1 Transducers and excitation (LC1–LC2)
- **Explore:** Seismic instrument: accelerometer or vibrometer? (challenge: ±5 % to 5 kHz with at least 2 nm per g); Hammer tip lab: pulse → spectrum → modes
- **Solve:** Accelerometer: amplitude error and usable band; Displacement vibrometer: how far above resonance?; Impact duration → bandwidth; Which tip reaches the modes you need?; Coherence expectations by tip
- **Learn:** Seismic instruments: one model, two regimes; Accelerometer design: bandwidth against sensitivity; Impact hammers: tip, pulse length and useful range; Shakers, transducer choice and the signal chain

### C2 FRFs and modal parameters (LC2)
- **Explore:** Four views of one FRF (and the Nyquist circle); Half-power drill: read ζ off the plot (challenge: three damping estimates within 8 %); Mode shapes from rows and columns
- **Solve:** ζ and k from a magnitude plot; ζ (and k) from the real and imaginary parts; Mode shapes from Im H at the resonances; Receptance, mobility and accelerance; Which sensors see which modes? (layout and coherence); Damping from a free decay (log decrement); Point-mass receptance and the wheel on the rail
- **Learn:** The FRF: definition, three forms and three regions; Real and imaginary parts (and the Nyquist circle); Natural frequency, damping and stiffness from a plot; Mode shapes from rows and columns of the FRF matrix

### C3 Signal processing (LC3)
- **Explore:** Sampling and aliasing; FFT lab: resolution, leakage and windows (challenge: repair the 2022 A3.5 spectrum, cheaply); Noise lab: H₁, H₂ and coherence (challenge: plan a clean modal test)
- **Solve:** Sampling rate and record length for a measurement; Largest line spacing that resolves given tones; Is this resolution achievable? Is this tone visible?; Where does an aliased tone appear?; Lines, samples and resolution of an FFT set-up; Choosing and correcting a window; Noise bias of H₁ and H₂, and the coherence
- **Learn:** Sampling rate, record length and resolution; Aliasing and the anti-aliasing filter; Leakage, whole periods and windows; Noise: averaging, H₁ and H₂; Coherence: how much of the response the force explains

### C4 Vibration control (LC4)
- **Explore:** Isolation designer: static sag, start-up and running (challenge: mount the compressor); Choose a strategy (challenge: five first choices in a row); Seat suspension and end-stops
- **Solve:** Isolator design by static sag; Check installed mounts: running and start-up; Strategy choice with numbers; Tuned absorber: tune, size, and what damping leaves
- **Learn:** Choosing a vibration-control strategy; Source control: balancing rotors and engines; Natural-frequency and damping control; Isolation design: static sag, start-up and running; Tuned absorbers (TMDs): when they fit

## Adding questions

All content is TypeScript data in `src/topics/<code>/`. The full guide is **[docs/AUTHORING.md](docs/AUTHORING.md)**, and
`src/topics/A1/` is the reference topic.

- **MCQ:** add an object to `mcqs` in `quiz.ts`. It needs `id`, `style`, `stem`, `options` (each with `text`, `correct` and `why`) and `source` (e.g. `'Similar to 2023 B1.8'`).
- **Flashcard:** add `{ id, front, back }` to `flashcards` in `learn.ts`.
- **Problem type:** add a `SolveGenerator` to `solve.ts`. Its `generate(rng, tier)` returns the prompt, the parts (numeric, choice, order, matrix or Lagrange terms) and four hints.
- **Simulation:** write a React component in `explore/` and list it in `explore/index.ts`.

Text fields accept `$inline$` and `$$display$$` TeX (KaTeX), `**bold**`, `*italic*` and `- ` lists.

## Building from source

```bash
npm install          # React 18, KaTeX, esbuild, TypeScript, playwright-core
npm run build        # -> index.html (single self-contained file)
npm test             # all self-tests under Node
npm run typecheck
node scripts/crawl.mjs              # headless Chrome/Edge: every route, console errors, overflow, frame times
node scripts/crawl.mjs A4 --width 1440
node scripts/shot.mjs A4/explore/absorber a4.png --width 1440 --theme dark
```

This folder lives on Google Drive, which copes badly with `node_modules`, where thousands of small files get synced.
So the dependencies can live elsewhere: run `npm install` in a local folder outside Drive and set `M32_TOOLCHAIN`
to that folder before running the scripts.

The stack is React 18 + TypeScript, bundled by esbuild into one file with inline JS, CSS and KaTeX woff2 fonts. The
physics is pure functions in `src/physics/`. Plots and simulations are React-rendered SVG, with per-frame updates
going through refs inside a `requestAnimationFrame` loop that pauses off-screen.
