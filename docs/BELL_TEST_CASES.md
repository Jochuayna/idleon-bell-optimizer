# Bell Parser Test Cases

The built-in browser test runner covers the confirmed save parser and pure Bell ring-award functions without npm or external dependencies. Open the Developer JSON Inspector and click **Run Developer Tests**.

Keep real save data private. Record only the smallest sanitized fixture needed to reproduce a case.

## Ringing EXP/hour dependency tests

- Jar regression: levels 11 and 13 with talent 5 produce 6.5×, 20.5×, and 133.25× combined.
- Monument static bases are 1 and 250; cover both branches and the slot-9 recursion guard.
- Measurement covers numeric and `TOT` static values plus quantity multipliers below, at, and above 5.
- Missing Monument or Measurement dependencies must prevent a falsely complete EXP/hour result.

## Manual rate and progression tests

- Parse plain values; K, M, B, T, Q, QQ; lowercase suffixes; and scientific notation.
- Reject zero, negatives, nonfinite values, unknown suffixes, and trailing junk.
- Cover zero, one, and multiple completed rings; excess EXP; one and several major boundaries; fresh-reset progression; progress below 100%; EXP conservation; and the iteration safety boundary.

## Fresh-run planner tests

- Per-run probabilities 0, 1, 50%, and extremely small values.
- Expected attempts equals `1/p`; confidence thresholds meet the requested confidence and one fewer attempt remains below it.
- Exact, fractional, insufficient, and zero-generation renewal currency cases.
- Affordable attempts, maximum affordable cumulative chance, Lantern uses, and total Lantern hours.
- `86.7Q/hr` fresh checkpoint reaches human ring 600, and the planner calls the shared target evaluator rather than duplicating its distribution.

## Current-versus-reset decision tests

- Default outlook is 48 hours; Advanced selections cover 24, 48, 72, and custom positive durations.
- Continue carries imported raw ring, Ringing EXP, and reward level through the full outlook; fresh starts all three at zero.
- Direct 48-hour Bell-roll and major-payout counts equal the first two chained 24-hour opportunity windows.
- Recommendation and feasibility labels use the full-outlook analytical probabilities.
- Gain Pace remains two hours and Fresh-run Odds remains one two-hour Lantern.
- Already reached, much/slightly better in each direction, nearly equal, impossible, near-certain, and unaffordable cases.
- Exactly 25 renewal currency, missing manual EXP/hour, objective-specific quality, probability-primary behavior, and fixed renewal/Lantern cost context.
- Both paths use one identical duration; continue starts from imported reward progress and reset from zero.
- The existing fresh-run confidence planner remains unchanged.
- The 16K Fountain regression (`0%` current, `0.0004%` fresh, P90 `3.97K` versus an `16K` target) is cooked rather than similar/saveable.
- Both effectively impossible paths, feasible-only similarity, zero-percent quality, P90 below half the goal, and fresh practicality above 1,000 attempts.
- Long waits render as days, months, or years, and the player table contains no duplicate Lantern-use column.

## Gain Pace tests

- First fresh window is exactly 100%; subsequent windows carry raw ring and remaining Ringing EXP.
- Expected gain, gain/hour, ordinary/major counts, cumulative totals, custom duration, marginal current-versus-fresh efficiency, and iteration safety.
- Exact 75/50/25/10 milestone crossings and no-severe-drop-off behavior.
- Fountain/Villager wording stays objective-specific, and running pace analysis does not change recommendation policy.
- Two hours produces eight 15-minute subwindows; exact progress and expected gain reconcile with the full checkpoint.
- Three-window smoothing, first-30-minute baseline, grouped milestones, Negligible second-Lantern value, and temporary later major-payout spikes.
- Cumulative share is monotonic, reconciles to the full checkpoint, reaches 100%, and is near 90% after the representative first 15 minutes.
- Second-Lantern values below 10% use explicit negligible-value wording.

## Current run distribution tests

- Preserve all seven confirmed reward mappings and display order.
- Total imported levels; shares sum to approximately one; zero totals produce seven zero shares.
- Identify highest, lowest, and selected-reward shares.
- Future selection remains independent of historical shares and preserves the cavern-derived 1/4, 1/6, and 1/7 brackets.
- Player-facing distribution copy never describes historical percentages as selection weights.

| Test | Expected result |
| --- | --- |
| Valid Bell array import | Returns the first seven finite numbers from parsed `data.Holes[17]`. |
| Correct reward order | Maps indexes 0-6 to the confirmed `BELL_REWARDS` order. |
| Invalid outer JSON | Returns `INVALID_OUTER_JSON`. |
| Missing `data.Holes` | Returns `MISSING_DATA_HOLES`. |
| Malformed serialized Holes JSON | Returns `INVALID_SERIALIZED_HOLES_JSON`. |
| Missing index 17 | Returns `MISSING_BELL_INDEX_17`. |
| Too few Bell values | Returns `TOO_FEW_BELL_VALUES`. |
| Nonnumeric Bell value | Returns `NONNUMERIC_BELL_VALUE` with the value path. |
| Additional values after index 6 | Succeeds and returns only indexes 0-6. |
| Raw ring index `0` | Returns `bellRingIndex: 0` and displays `bellRingNumber: 1`. |
| Raw ring index `1` | Returns `bellRingIndex: 1` and displays `bellRingNumber: 2`. |
| Raw ring index `18` | Returns `bellRingIndex: 18` and displays `bellRingNumber: 19`. |
| Raw ring index `19` | Returns `bellRingIndex: 19` and displays `bellRingNumber: 20`. |
| Raw ring index `692` | Returns `bellRingIndex: 692` and displays `bellRingNumber: 693`. |
| Raw ring index `0` requirement | Returns exactly `5`. |
| Raw ring index `508` requirement | Produces approximately `88.9T`, matching the controlled game display. |
| Human ring conversion | Raw index `508` displays human ring `509`. |
| Remaining Ringing EXP | Requirement `5` with progress `2` returns `3`. |
| Ring progress percentage | Requirement `5` with progress `2.5` returns fraction `0.5` and `50%`. |
| Progress above 100 percent | Progress `10` against requirement `5` preserves fraction `2` and `200%`; remaining is zero. |
| Missing or invalid progress | Returns structured `MISSING_RINGING_EXP_INDEX_0` or `NONNUMERIC_CURRENT_RINGING_EXP`. |
| Negative Ringing progress | Returns `NEGATIVE_CURRENT_RINGING_EXP`. |
| Fractional raw ring index | Returns `NONINTEGER_BELL_RING_INDEX`. |
| Renewal generation rate `10` | Returns `renewalCurrencyPerHour: 10`. |
| Current renewal currency `1179.191` | Preserves the exact fractional value. |
| Lifetime renewals `61` | Returns `lifetimeBellRenewals: 61`. |
| Affordable renewal floor | Currency `1179.191036` at cost `25` returns `47`. |
| Currency below `25` | Returns `0` immediately available renewals. |
| Currency exactly `25` | Returns `1` immediately available renewal. |
| Missing renewal fields | Returns a structured field-specific `MISSING_*` error. |
| Invalid renewal fields | Nonnumeric and nonfinite values return structured field-specific errors. |
| Negative renewal fields | Rate, current currency, and lifetime count are rejected with field-specific `NEGATIVE_*` errors. |
| Number suffix boundaries | `1K`, `1M`, `1B`, `1T`, `1Q`, `1QQ`, `1e21`, and `1e24` appear at their respective powers of 1,000. |
| Number trailing zeros | `1,200,000` displays as `1.2M`, not `1.20M`. |
| Very large number | Values above `e24` continue through three-power scientific tiers. |
| NaN and Infinity | Formatter returns safe display tokens and never throws. |
| Static method multipliers | Exactly `[5, 10, 8, 13, 12, 15]`. |
| Upgrade 45 unowned | Multiplier is zero; quantities remain `2 * methodLevel`. |
| Upgrade 45 owned | Uses `1.1 ^ floor(totalLevels / 25)` with a minimum of one. |
| Total below/exactly 25 | Exponents are respectively zero and one. |
| Exponent flooring | Total level `49` still uses exponent one. |
| Six method quantities | Each index uses its matching verified static multiplier. |
| Ringing method selection | Sum includes only methods 0, 2, 4, and 5. |
| Real-save method regression | Levels `[407,387,512,520,351,417]` produce total `2594`, exponent `103`, scaling about `18341.995`, Ringing bonus about `608880866.827%`, and multiplier about `6088809.668x`. |
| Zero method levels | Quantities are zero and Ringing multiplier is one. |
| Invalid method data | Missing array/indexes, nonnumeric, negative, nonfinite levels, and missing/invalid upgrade 45 ownership are rejected. |
| Missing `[18][1]` | Returns `MISSING_RING_INDEX_1`. |
| Nonnumeric ring index | Returns `NONNUMERIC_BELL_RING_INDEX`. |
| Negative ring index | Returns `NEGATIVE_BELL_RING_INDEX`. |
| Verified major-payout event 1 | Before: Coins From Fountain `7`, raw index `18`. After one ring: Coins From Fountain `950`, raw index `19`. Observed difference: `943`. No double proc occurred. |
| Verified major-payout event 2 | Before: All Villager EXP `8`, raw index `38`. After one ring: All Villager EXP `949`, raw index `39`. Observed difference: `941`. No double proc occurred. |
| Timing before a major boundary | Raw index `18` gives human ring `19`, 1 ring remaining, next major ring `20`, and 0 completed major payouts. |
| Timing on a major boundary | Raw index `19` gives human ring `20`, 0 rings remaining, next major ring `20`, and 1 completed major payout. |
| Major bonus plus normal gain 3 | `940 + 3 = 943`. |
| Major bonus plus normal gain 1 | `940 + 1 = 941`. |
| Doubled 943 | `943 * 2 = 1886`. |
| Doubled 941 | `941 * 2 = 1882`. |
| Manual major payout ranges | Inputs 940, 1-3, and doubling produce normal range 941-943 and doubled range 1882-1886. |
| Bolaia study level `0` | Returns `bolaiaBellStudyLevel: 0` and `majorBellBonus: 0`. |
| Bolaia study level `1` | Returns `bolaiaBellStudyLevel: 1` and `majorBellBonus: 20`. |
| Bolaia study level `47` | Returns `bolaiaBellStudyLevel: 47` and `majorBellBonus: 940`. |
| Missing `[26][4]` | Returns `MISSING_BOLAIA_INDEX_4`. |
| Nonnumeric Bolaia level | Returns `NONNUMERIC_BOLAIA_BELL_STUDY_LEVEL`. |
| Negative Bolaia level | Returns `NEGATIVE_BOLAIA_BELL_STUDY_LEVEL`. |
| Upgrade ownership raw `0` | All three ownership booleans are false; whole-ring double is disabled. |
| Upgrade ownership raw `1` | All three ownership booleans are true; upgrade 86 enables whole-ring double. |
| Upgrade ownership raw greater than `1` | Positive values still mean owned. |
| Missing upgrade index 42 | Returns `MISSING_BELL_UPGRADE_42`. |
| Missing upgrade index 60 | Returns `MISSING_BELL_UPGRADE_60`. |
| Missing upgrade index 86 | Returns `MISSING_BELL_UPGRADE_86`. |
| Nonnumeric upgrade value | Returns the applicable `NONNUMERIC_BELL_UPGRADE_*` error. |
| Negative upgrade value | Returns the applicable `NEGATIVE_BELL_UPGRADE_*` error. |
| Neither upgrade 42 nor 60 owned | Fallback decimal 0; normal gain range 1-1; no special 3-level outcome. |
| Only upgrade 42 owned | Contribution 30; fallback decimal 0.3; normal gain range 1-2; no special outcome. |
| Only upgrade 60 owned | Fallback contribution 30; fallback decimal 0.3; normal gain range 1-3; special outcome enabled. |
| Both upgrades owned | Contributions 30 + 30; fallback decimal 0.6; normal gain range 1-3; special outcome enabled at 20 percent. |
| Confirmed imported both-owned range | A save with both ownership values positive returns minimum 1 and maximum 3. |
| Upgrade 60 special branch | With upgrade 60 owned and `randomFloat = 0.81`, decimal 2 produces normal gain 3. |
| Exact distribution with neither upgrade | P(1)=100%, expected gain 1. |
| Exact distribution with upgrade 42 only | P(1)=70%, P(2)=30%, expected gain 1.3. |
| Exact distribution with upgrade 60 only | P(1)=56%, P(2)=24%, P(3)=20%, expected gain 1.64. |
| Exact distribution with upgrades 42 and 60 | P(1)=32%, P(2)=48%, P(3)=20%, expected gain 1.88. |
| Expected normal gain after double | With upgrades 42, 60, and 86: `1.88 * 1.25 = 2.35`. |
| Major-ring analytical outcomes | Bonus 940 produces pre-double outcomes 941/942/943 and post-double outcomes 941/942/943/1882/1884/1886 with exact combined probabilities. Expected post-double gain is 1177.35. |
| Reward selection at 0 caverns | Indexes 0-3 available at exactly 1/4 each; indexes 4-6 locked. |
| Reward selection at 10 caverns | Indexes 0-3 remain available at 1/4 each. |
| Reward selection at 11 caverns | Indexes 0-5 available at exactly 1/6 each; index 6 locked. |
| Reward selection at 15 caverns | Indexes 0-5 remain available at 1/6 each. |
| Reward selection at 16 caverns | All indexes 0-6 available at exactly 1/7 each. |
| Larger cavern count | All seven rewards remain available at 1/7 each. |
| Invalid cavern count | Nonfinite, negative, and nonnumeric values are rejected. |
| Exact probability sum | Available reward fractions sum exactly to 1 in every cavern bracket. |
| Villager level 0 | Returns 0 caverns. |
| Villager level 10 | Returns 10 caverns. |
| Villager level 11 | Returns 11 caverns and unlocks the six-reward bracket. |
| Villager level 16 | Returns 16 caverns and unlocks all seven rewards. |
| Villager level 18 | Returns 18 caverns. |
| Villager level 24 | Caps at 18 caverns. |
| Decimal villager level | Floors the raw value before applying the cap. |
| Missing `[1][0]` | Returns `MISSING_VILLAGER_INDEX_0`. |
| Invalid first villager level | Nonnumeric, nonfinite, and negative values return structured errors. |
| No future rings | Future and major counts are zero; distribution is all mass at zero additional gain. |
| One ordinary future ring | Uses the selected-reward zero outcome plus the ordinary gain distribution. |
| Cross exactly one major ring | Counts one major and no ordinary rings for interval 19 to 20. |
| Cross multiple major rings | Counts every divisible-by-20 ring after current and through target. |
| Reward probabilities 1/4, 1/6, 1/7 | Expected selected gain scales by the appropriate imported cavern bracket. |
| Double disabled and enabled | Uses pre-double or whole-ring doubled distributions respectively. |
| Target already reached | Returns target probability 1. |
| Unreachable target | Returns target probability 0. |
| Target ring before current | Returns `TARGET_RING_BEFORE_CURRENT`. |
| Target distribution normalization | Convolved probabilities sum to 1 within floating-point tolerance. |
| Distribution expectation | Mean of the full distribution matches the direct expected-value formula within tolerance. |
| Exact mode below limit | A 100-ring interval remains `Exact analytical` and returns the exact distribution. |
| Approximation above limit | A 501-ring interval returns a successful result labeled `Analytical approximation`. |
| Approximate mean | A 624-ring mean matches the direct ordinary-plus-major expected-value formula within tolerance. |
| Approximate percentile ordering | Increasing the observed reward level increases its approximated current percentile. |
| Deterministic zero variance | Zero variance returns safe 0/1 target probabilities, fixed quantiles, and a midpoint percentile at the deterministic value. |
| Approximate probability bounds | Approximate probabilities remain in the inclusive range 0 to 1. |
| Continuity correction | At threshold 10 with mean 10 and variance 4, the target calculation uses boundary 9.5 (`z = -0.25`). |
| Long current run | A 624-ring current comparison completes in approximation mode without an exact-limit message. |

Probability tests use exact reduced fractions internally. Display percentages may be rounded for readability. These are analytical calculations, not Monte Carlo simulations.

The two payout observations verify that the normal payout amount is not constant. They do not establish where an amount is stored or how it is calculated.

## Test Record Template

- Test name:
- Sanitized fixture:
- Expected result:
- Actual result:
- Evidence/source:
- Status: Not run

## Future Extraction Templates

These mechanics remain unverified and are not part of the implemented importer.

### Levels-per-20th-ring Extraction

- Fixture:
- Expected value:
- Candidate JSON path:
- Actual result:
- Status: Not run

### Reset Count Extraction

- Fixture:
- Expected value:
- Candidate JSON path:
- Actual result:
- Status: Not run
# Phase 2 rate reconstruction cases

- [ ] Import every newly confirmed Holes rate field and retain its exact parsed path.
- [ ] Verify Cosmo `floor`, Fountain `round`, Monument `ceil`/`max`, and Measurement threshold branches.
- [x] Verify all seven Overkill quantities from serialized `data.KLA_n` arrays.
- [ ] A missing Overkill dependency must keep the calculated total incomplete.
- [ ] No manual-rate fallback is present; an incomplete automatic reconstruction remains visibly unavailable.

Real-fixture regression: World 1 and World 2 each reproduce every ordered screenshot entry after the game display rounding is applied. Worlds 3–7 also reproduce their ordered entries. Expected Overkill quantities are `300, 220, 280, 260, 260, 280, 360`; expected Measurement multiplier is `467.74464×`; expected reconstructed rate is approximately `86.7Q/hr`. Verify that Monument, Measurement, Bell Method, and Jar helper outputs are percent bonuses converted exactly once with `1 + bonus/100`.
# Phase 3 candidate tests

- Verify all six Bell Method cost curves and owned-resource mappings.
- Verify methods 0, 2, 4, and 5 contribute directly to Ringing; methods 1 and 3 have zero direct gain away from an upgrade-45 exponent boundary.
- Verify independent one-level deltas for Monument rewards 7 and 9, Monumental Boost, marble scaling, Ringing Measurement, Jar 11, and Jar 36.
- Verify Cosmo enhanced caps, Measurement cost reduction, affordable/unaffordable states, and incomplete active-character coins.
- Verify the next finite Death Note threshold changes the correct world point total and Measurement multiplier.
- Verify candidate generation does not mutate imported state, retains incomplete candidates, preserves the `86.67207128535534Q/hr` baseline, fully recomputes each after-rate, and uses the existing progression function.

# Phase 4 optimizer tests

- Verify the export exposes ordered character names and per-character `Money_n`, while active-character selection remains explicit because `UserInfo[0]` is absent.
- Verify one purchase deducts its exact cost and increments one level; a repeated purchase uses the newly increased cost.
- Verify independent Gaming Bits and Divinity pools can both be spent, while same-pool candidates compete.
- Verify unaffordable, zero-gain, capped, RNG, progression, and incomplete candidates cannot be automatic purchases.
- Verify original imported state is unchanged, identical inputs are deterministic, and every purchase's before-rate equals the preceding purchase's after-rate.
- Verify final-rate, 2-hour-roll, and 48-hour-roll objectives use full recomputation and existing Ringing progression.
- Verify the optimizer result is never worse than no purchase and preserves the verified `86.67207128535534Q/hr` fixture baseline.

# Phase 5 policy and constraint tests

- Verify Bell-only mode reproduces the Phase 4 maximum and remains at least as strong as the practical plan.
- Verify practical mode rejects negligible isolated purchases but retains a multi-level sequence that crosses the Upgrade 45 exponent and roll breakpoint.
- Verify a Clean Method 1 or Ping Method 3 purchase that remains inside the same `floor(totalMethodLevels / 25)` band produces zero Bell Ring gain.
- Verify a Clean Method 1 or Ping Method 3 purchase that crosses a 25-level boundary changes Bell Ring only through the resulting Upgrade 45 multiplier applied to Ring Methods 0, 2, 4, and 5.
- Verify maximum percentage, minimum reserve, absolute maximum spend, maximum levels, and disabled pools; overlapping limits use the strictest value.
- Verify target-ending-ring mode stops at the first target-reaching sequence unless excess progress is explicitly requested.
- Verify positive rate steps with no projected roll change carry the player-facing no-roll-gain warning.
- Verify search-limit truncation is reported, original state is never mutated, identical inputs are deterministic, and the baseline remains `86.67207128535534Q/hr`.
## Bell Method correctness pass

- Verify the six authoritative resource/effect mappings and fixture levels `407, 387, 512, 520, 351, 417`; Method 5 is Decent Rupie at the exact internal path `[9][25]`.
- Verify Methods 1 and 3 produce positive Bell Clean and Bell Ping marginal gains without changing Bell Ring roll projections.
- Verify owned one-time Cosmo rows display Capped, have no next cost, and cannot be purchased.
- Verify the automatic Bell Ring regression remains `86,672,071,285,355,340 EXP/hour` within floating-point tolerance.
- Verify `[18][2..5]` are Ping/Clean progress fields and renewal generation remains the verified constant `10/hour`.
## Upgrade Paths correctness pass

- Bell Ring is the default filter; Ring, Ping, and Clean candidate sets are disjoint.
- Stable canonical order is preserved unless Affordable first is enabled.
- Recommendations choose the largest affordable absolute gain and never choose capped candidates.
- Absolute gain equals the complete projected affected-stat rate minus its complete current rate.
- Ring Methods 2, 4, and 5 project the complete Bell Ring rate, including both Jar multipliers.
- Candidate columns omit per-upgrade 2-hour and 48-hour rolls; multi-upgrade plans retain both.
- Measurement exposes Death Note details without multiplying monster kills twice.
- Cobaltine at `[9][4]` funds Ringing Measurement. Ringing Measurement belongs to the Measurement system, appears under Ring and Ping with stat-specific complete rates, and never appears under Clean.
- Ping includes Method 3 plus all verified shared Monument and Measurement candidates, including Death Note progression. Clean currently has one active candidate, Method 1, so its duplicate candidate table stays hidden.
## Pre-UI robustness fixtures

Synthetic in-memory fixtures cover early, mid, late, nothing-affordable, mostly-capped, single-candidate, and no-active-candidate accounts. They contain only minimal invented values and no private save data.

Regression coverage verifies affordable-first and work-toward policy, capped/invalid exclusion, stat-specific complete rates, neutral no-active behavior, repeated stat switching, small and IdleOn-scale formatting, and a sanitized developer validation report.

On every successful new import, the Bell stat resets to Ring, Affordable first resets off, expanded multi-upgrade plans collapse, prior optimizer output is cleared, Step 4 is invalidated, and candidates/recommendations are rebuilt from the new save.
