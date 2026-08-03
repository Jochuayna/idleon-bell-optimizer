# Bell Optimizer - Static Prototype

Bell Optimizer is planned as a free, browser-based helper for the Bell in Legends of IdleOn. The broader goal is to let a player upload or paste an IdleOn JSON export, choose what they want to optimize, and receive probability-based advice about whether a current Bell run is cooked, weak, saveable, strong, or exceptional.

The normal interface is a four-step player flow: import a save, choose Fountain or Villager EXP, enter a goal level and ring, and read one result card. It imports confirmed Bell fields, including current Ringing progress, Bell Improvement Methods, renewal currency, and the two Ringing Jar collectibles plus their shared Legend talent. **It does not yet reconstruct final Bell EXP/hour because the Monument Cosmo/Fountain dependencies and Measurement's Workbench Overkill dependency are not fully mapped. It also does not recommend resets, import or spend Lanterns, or plan Lantern inventory.**

Bell Ring EXP/hour is reconstructed automatically from verified save fields and game formulas. There is no manual rate fallback: if a required dependency cannot be verified, rate-dependent results are shown as unavailable.

The Fresh-run Odds planner combines that checkpoint with the existing analytical reward evaluator. For a Fountain or Villager EXP target, it reports the chance per independent renewed run, average attempts, attempts for 50%, 75%, 90%, and 95% confidence, renewal currency and generation wait time, and required Lantern uses. One attempt is defined as one Bell renewal plus one Lantern use. Lantern inventory is not imported, and the planner does not tell you whether to reset the current run.

The main decision card compares continuing the imported run with renewing now over the same **48-hour outlook by default**. Advanced Details can switch this to 24, 48, 72, or custom hours. Continue carries the imported ring, Ringing EXP, and selected reward level; fresh starts from zero. Target probability is the primary metric. Expected level, percentile range, renewal cost, and current affordability are supporting context. The recommendation is specific to the selected Fountain or Villager EXP target; it is not a global judgment of all Bell rewards.

Before comparing probability differences, the decision engine classifies each path as Reached, Realistic, Possible, Long shot, or Effectively impossible. This prevents two tiny probabilities from being described as similar or a zero-chance run from being called Saveable. The compact result card shows the objective, target, active outlook, Bell rolls, major payouts, both chances, and the current path's P90 high-end likely outcome.

Gain Pace remains a separate two-hour Lantern comparison: it asks whether another Lantern on this run is efficient relative to the first Lantern after a reset. Fresh-run Odds also remains a one-Lantern reroll-planning tool. Neither inherits the 48-hour Step 4 outlook.

Gain Pace separates Lantern-to-Lantern value from slowdown inside the first Lantern. Full checkpoint windows are classified from Excellent to Negligible relative to the first checkpoint. The first checkpoint is also divided into 15-minute subwindows, smoothed across three adjacent intervals, and compared with the average pace of the first 30 minutes so major-payout timing does not dominate the slowdown signal.

The normal summary leads with cumulative value share: how much of the complete first Lantern's expected gain has already accumulated by each point. It does not suggest interrupting a Lantern early; Lanterns apply their full duration, so the actionable comparison is another full Lantern on the same run versus the first full Lantern after a reset.

Current Run Distribution is descriptive imported context. It totals the seven confirmed reward levels and shows each reward's share of the accumulated levels in confirmed index order. These historical shares never alter future RNG: the future selection chance continues to come only from the cavern-derived 1/4, 1/6, or 1/7 reward bracket.

The selected-reward target evaluator calculates the expected final level, target probability, and percentile range for one reward between the imported current ring and a manually entered target ring. It uses an exact analytical distribution within 500 rings and a 250,000-level outcome span. Beyond either limit, it switches to a clearly labeled, continuity-corrected analytical normal approximation based on the separate ordinary- and major-ring means and variances.

A temporary developer-only JSON inspector is available at the bottom of the page. It can parse and recursively search an export locally to help identify candidate Bell save fields. Any string search result can be tested with **Parse and Open** and browsed under its original path, such as `$.data.Spelunk::parsed`. It never uploads the JSON, changes it, fills optimizer fields, or claims that a candidate path is confirmed.

## How to open it

1. Open the `D:\Idleon Bell Optimizer` folder in File Explorer.
2. Double-click `index.html`.
3. The page opens in your normal browser. No installation or server is needed.

If Windows asks which app to use, choose Chrome, Edge, or Firefox.

## The four-step flow

1. Import an IdleOn save by file or pasted JSON. The summary shows the current Bell ring, unlocked reward count, and selected goal without exposing save paths.
2. Choose **Fountain** or **Villager EXP**. Balanced is marked as unavailable; Custom opens its unfinished weight controls inside Advanced Details.
3. Enter **I want at least** and **By ring**, then click **Check My Run**.
4. Read the main card: run quality, expectation-only action text, goal chance, expected finish, likely range, and current difference from average.

## What to test visually

1. Confirm the JSON upload box, paste area, Bell-level import button, and limited-import notice are visible.
2. Confirm Fountain is selected initially and Villager EXP changes the selected reward.
3. Confirm Advanced Details and Developer Tools are both closed initially.
4. Click the upload box, choose a JSON file, and explicitly click **Import Bell Levels from JSON**.
5. Run a selected-reward evaluation and confirm the current-run comparison uses only neutral expectation labels.
6. Confirm the result says **Exact analytical** for a short range and **Analytical approximation** for a range over 500 rings.
7. Confirm reset, Lantern, saveability, and strategy placeholders are absent from the normal page.
8. Expand Advanced Details and confirm Ringing the Bell shows current ring, formatted progress and requirement, progress percentage, and the automatically reconstructed Bell Ring EXP/hour. Bell Ping and Bell Clean are separate meters and are not used for Ring roll projections.
9. Enter `86.7Q` in Bell EXP per hour and calculate. Confirm a time-to-next-ring result, a two-hour current-run preview, and the fresh-reset preview in Advanced Details.
10. Enter a fresh-run target, calculate Fresh-run Odds, and verify the four confidence rows. Costs use the imported fractional renewal currency and the verified cost of 25 per attempt.
   The normal table intentionally shows only confidence, attempts, renewal currency, and natural-language wait time. Each attempt still means one renewal and one two-hour Lantern.
11. Enter a goal level and click **Check My Run**. Confirm Step 4 defaults to a 48-hour Continue-versus-Fresh outlook, while Gain Pace and Fresh-run Odds remain two-hour Lantern calculations. Advanced Details should offer 24, 48, 72, and custom outlooks.
9. Narrow the browser window. Sections should stack without horizontal scrolling or clipped text.
10. Expand **Developer Tools: JSON Inspector** to test local JSON searches and unconfirmed candidate discovery.
11. Click **Run Developer Tests** and confirm all built-in parser, Bell-mechanics, evaluator, and interface contract tests pass.
12. Choose a target reward, target level, and target ring, then click **Evaluate Selected Reward**. Lantern and reset fields are marked as unused and do not affect this result.

## File structure

- `index.html` - page content and accessible structure
- `styles.css` - visual design and responsive layout
- `js/save-parsing.js` - confirmed Bell reward, ring-index, and Bolaia study import with structured validation errors
- `js/idleon-number-format.js` - reusable IdleOn-style K/M/B/T/Q/QQ and scientific-tier formatting
- `js/parser-tests.js` - dependency-free tests for the confirmed Bell-level importer
- `js/target-evaluator.js` - analytical selected-reward target probability and percentile evaluator
- `js/compare-saves.js` - local-only comparison of parsed `data.Holes` from two saves
- `js/bell-mechanics.js` - future Bell rules and formulas
- `js/simulations.js` - future probability simulations
- `js/optimization-goals.js` - future goal definitions and weights
- `js/run-evaluation.js` - future ratings and saveability logic
- `js/user-interface.js` - current interface interactions
- `js/json-inspector.js` - temporary local-only save-field discovery tools
- `docs/BELL_RULES.md` - confirmed reward definitions and unverified mechanic placeholders
- `docs/BELL_SAVE_FIELDS.md` - confirmed Bell reward path and unconfirmed remaining paths
- `docs/BELL_TEST_CASES.md` - implemented parser cases and future extraction templates

The JavaScript files use ordinary browser scripts so the project continues to work when `index.html` is opened directly. There is no framework, build system, npm, server, or external dependency.
# Phase 2 Bell-rate status

Advanced Details now shows a complete source-backed Bell Rate Breakdown. Per-character Death Note “kills left” arrays are serialized at `data.KLA_0`, `data.KLA_1`, and so on; their ordered totals match the supplied Death Note screenshots across all seven worlds. The reconstructed Overkill quantities feed Measurement and the final automatic Bell rate. Monster kills are included once through Measurement and are not applied as a second multiplier.

The audited final rate formula treats the Monument, Measurement, Bell Method, and Jar helper results as percent bonuses, then converts each exactly once with `1 + bonus / 100`. For the private regression fixture, the independent reconstruction is approximately `86.7Q/hr` at IdleOn display precision. This comparison is a verification result, not a fitted or hardcoded rate.

## Phase 3 one-step Bell-rate candidates

Advanced Details includes a functional Bell Rate Upgrade Candidates table. It evaluates every mapped source independently by changing one legal input, rerunning the complete verified Bell-rate formula, and then using the existing Ringing progression function for a fresh two-hour projection. It does not spend resources, sequence purchases, or optimize a budget.

The normal Upgrade Paths view filters candidates into Bell Ring, Bell Ping, and Bell Clean. It shows absolute complete-rate gains, recommends the largest affordable active improvement for the selected stat, and keeps Ring multi-upgrade plans collapsed separately.

Purchasable candidates show their exact formula-backed cost and mapped owned resource. Monument story rewards and Jar enchant levels remain visible but are marked passive/RNG-dependent because the game does not offer a deterministic targeted one-level purchase. Death Note candidates represent the next finite skull threshold, not “one more kill.” The coin-funded Bell Method is incomplete when the export does not identify the active character whose `Money_n` value the game would spend.

## Phase 4 Bell-rate sequence optimizer

Advanced Details now contains a temporary functional **Bell Rate Optimizer**. It searches deterministic purchases separately inside each real resource pool, deducts each exact cost, recalculates the following level's cost, and reruns the complete verified Bell-rate and Ringing progression formulas after every purchase. The objectives are final Bell EXP/hour, fresh-run rolls after 2 hours, or fresh-run rolls after 48 hours. Search output identifies whether it was exact or bounded exact; it never silently substitutes a greedy percentage-first pass.

The export contains `charNames` and `data.Money_0..n`, but it does not contain the live `UserInfo[0]` value used by the game to identify the currently controlled character. Choose the coin-spending character explicitly before optimizing Method 0. The bundle displays cavern resources 3, 4, 14, and 25 as font glyphs without a traceable localized text label in the inspected path, so the tool deliberately retains the exact indexed fallback names instead of inventing labels.

Only deterministic, affordable purchases enter the sequence search. Unaffordable deterministic upgrades appear under **Best upgrades to work toward**. Death Note thresholds, Monument story rewards, Jar RNG outcomes, and capped Cosmo nodes remain separate opportunities and are never automatically purchased.

## Phase 5 practical and constrained plans

The Advanced Bell Rate Optimizer now distinguishes three policies:

- **Maximum Bell Rate** spends every legal positive-gain resource under the search safety limit. It is explicitly a Bell-only maximum, not the best overall account plan.
- **Practical Bell Gains** stops at material outcomes: a new 2-hour or 48-hour roll, a configured cumulative rate gain (default `0.25%` per pool), or a verified Bell Method exponent breakpoint.
- **Player Budget** applies independent per-resource limits for absolute spend, minimum reserve, maximum owned percentage, maximum levels, or completely disabled spending. Overlapping limits use the strictest result.

The functional comparison shows No spending, Practical plan, and Bell-only maximum together. Each selected step reports marginal and cumulative rate/roll changes plus the percentage of its own resource pool consumed. The setting formerly described as an upgrade budget is now correctly labeled **Search safety limit per upgrade**; reaching it produces a truncation warning.

## Private developer fixture

Developer Tools can export the complete JSON currently loaded in the browser as `idleon-save-debug.json`. The export requires a privacy confirmation because it may contain account and character information. Keep it private and never publish, commit, or distribute it.

For local reverse-engineering, place the downloaded file at `reference/idleon-save-debug.json`. The application never loads this path automatically. **Load Local Debug Fixture** attempts to read it only after an explicit click; browsers commonly block this under `file://`, in which case select the fixture with the normal JSON file picker. The optional filtered kill-data export remains disabled until safe filtering can be guaranteed.
## Bell upgrade-path robustness

Upgrade recommendations use the largest absolute gain among affordable, active candidates. If none are affordable, the largest valid active gain is shown as an **Upgrade to Work Toward**. If a stat has no active verified upgrades, the page says so without rendering an empty candidate table.

Every candidate is sanity-checked before filtering or optimization. Invalid rates, inconsistent gains, invalid costs/resources, and purchasable capped entries are excluded while save import and Rate Breakdown remain usable. A new save resets the Bell stat to Ring, clears Affordable first, collapses plans, and clears prior optimizer and Step 4 results.

`tools/validate-bell-account.js` is a developer helper that accepts an already-parsed Bell object. It prints only Bell rates, Method levels, candidate counts, recommendations, warnings, and unresolved generic resource labels. It never loads the private fixture automatically and never prints a save.
## Bell Progress History

The Progress History tab can preserve up to 100 Bell-only snapshots in IndexedDB, compare the current import or any two saved states, batch-extract past saves, and export or restore a Bell-only backup. Saving is always explicit. Full Idleon saves are processed locally and are never retained or uploaded. See [docs/BELL_HISTORY.md](docs/BELL_HISTORY.md).
