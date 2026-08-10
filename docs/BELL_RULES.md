# Bell Rules

## Confirmed Bell Rewards

The reward order and per-level effects below are confirmed from the game bundle. Percentages are stored as percentage values, not decimal multipliers.

| Index | Reward | Effect per level |
| ---: | --- | ---: |
| 0 | Bucket Fill Rate | 10 percent |
| 1 | All Villager EXP | 0.5 percent |
| 2 | Harp Note Gains | 10 percent |
| 3 | Daily Lamp Wishes | 0.3 percent |
| 4 | Extra Rupie Chance | 0.5 percent |
| 5 | Double Torch Chance | 2 percent |
| 6 | Coins From Fountain | 0.2 percent |

## Controlled Major-Payout Observations

| Event | Raw index transition | Human ring reached | Selected reward | Reward transition | Observed payout | Double proc observed |
| ---: | --- | ---: | --- | --- | ---: | --- |
| 1 | `18 -> 19` | 20 | `[17][6]` Coins From Fountain | `7 -> 950` | 943 | No |
| 2 | `38 -> 39` | 40 | `[17][1]` All Villager EXP | `8 -> 949` | 941 | No |

These controlled observations verify:

- Major payouts occur when the zero-based raw ring index reaches `19`, `39`, `59`, and so on. These correspond to human-readable rings 20, 40, 60, and so on.
- Exactly one of the seven reward indexes increased in each controlled event.
- The normal observed payout amount is not constant across these events (`943` versus `941`).
- No double proc occurred in either controlled event.

Confirmed timing values may be derived only from the raw index:

```text
humanRing = rawIndex + 1
ringsUntilMajor = 0                                  when humanRing is a multiple of 20
ringsUntilMajor = 20 - (humanRing modulo 20)         otherwise
nextMajorPayoutRing = humanRing + ringsUntilMajor
majorPayoutsCompleted = floor(humanRing / 20)
```

The observations do not establish that `943` or `941` is stored directly. The major-bonus component is now confirmed, but no exact outcome is predicted because the normal random gain and double trigger are not imported or rolled by this prototype.

## Confirmed Game-Bundle Ring-Award Logic

Each Bell ring selects one available reward index. Its normal gain is:

```text
normalRingGain = floor(1 + ringExtraLevelDecimal + randomFloat)
```

On every 20th human-readable ring, the game additionally awards:

```text
majorBonus = StudyBolaiaBonuses(4)
```

The underlying Bell-study input and calculation are now confirmed:

```text
bolaiaBellStudyLevel = $.data.Holes::parsed[26][4]
majorBellBonus = bolaiaBellStudyLevel * 20
```

Real-save evidence: level `47` produces `47 * 20 = 940` major bonus.

The combined gain before a possible double is:

```text
totalGainBeforeDouble = normalRingGain + (isMajorRing ? majorBonus : 0)
```

This explains both controlled observations with the imported and calculated major bonus `940`:

- `940 + 3 = 943`
- `940 + 1 = 941`

### Double Behavior

Bell upgrade 86 ownership is confirmed at `$.data.Holes::parsed[13][86]`. Ownership is `rawValue > 0`. When owned, each ring has an independent 25 percent chance to duplicate the entire gain awarded by that ring:

```text
finalGain = doubleTriggered
  ? totalGainBeforeDouble * 2
  : totalGainBeforeDouble
```

The duplicated amount includes the major 20th-ring bonus. Examples:

- Doubled `943` is `1886`.
- Doubled `941` is `1882`.

Confirmed ownership paths also exist for upgrades 42 and 60:

- Upgrade 42: `$.data.Holes::parsed[13][42]`
- Upgrade 60: `$.data.Holes::parsed[13][60]`

Their ownership state can be imported, but their effect values are not yet imported or calculated.

### Reward Selection Availability

One random reward index is chosen per ring. The available index range depends on caverns unlocked:

| Caverns unlocked | Available reward indexes | Reward count | Exact probability per available reward |
| ---: | --- | ---: | ---: |
| 0-10 | 0 through 3 | 4 | 1/4 = 25% |
| 11-15 | 0 through 5 | 6 | 1/6 = 16.6667% |
| 16+ | 0 through 6 | 7 | 1/7 = 14.2857% |

The game's helper is confirmed inclusive on both bounds:

```text
randomInt(min, max) = min + floor(randomFloat * (max - min + 1))
```

Every available reward is therefore equally likely, and exactly one reward is selected per ring.

The first villager level is confirmed at `$.data.Holes::parsed[1][0]`, and cavern count is calculated as:

```text
cavernsOwned = Math.min(18, Math.floor(villagerLevel0))
```

Real-save evidence: `villagerLevel0 = 24` produces `cavernsOwned = 18`, making all seven Bell rewards available at exactly `1/7` each. The cavern field remains editable for controlled testing after import.

### Verified Normal Ring-Gain Range Logic

```text
upgrade42Contribution = upgrade42Owned ? 30 : 0
upgrade60FallbackContribution = upgrade60Owned ? 30 : 0

if upgrade60Owned and randomFloat > 0.8:
    ringExtraLevelDecimal = 2
else:
    ringExtraLevelDecimal =
      (upgrade42Contribution + upgrade60FallbackContribution) / 100

normalRingGain = floor(1 + ringExtraLevelDecimal + randomFloat)
```

The generic Bell-upgrade helper returns `0` when the corresponding upgrade is not owned; otherwise upgrades 42 and 60 supply the verified effect value `30`.

| Ownership | Fallback decimal | Minimum normal gain | Maximum normal gain | Special 3-level outcome |
| --- | ---: | ---: | ---: | --- |
| Neither | 0 | 1 | 1 | No |
| Upgrade 42 only | 0.3 | 1 | 2 | No |
| Upgrade 60 only | 0.3 | 1 | 3 | Yes |
| Both | 0.6 | 1 | 3 | Yes |

The upgrade-60 special branch is triggered by `randomFloat > 0.8`, corresponding to a 20 percent chance for the game's uniform random float. The 3-level result is possible only through this special branch.

## Exact Analytical Normal-Gain Probabilities

The upgrade-60 special roll and the normal-gain roll are independent uniform random values on `[0, 1)`. The prototype combines their probabilities analytically using reduced fractions; it does not sample or run Monte Carlo trials.

| Ownership | P(1) | P(2) | P(3) | Expected normal gain |
| --- | ---: | ---: | ---: | ---: |
| Neither | 100% | 0% | 0% | 1 |
| Upgrade 42 only | 70% | 30% | 0% | 1.3 |
| Upgrade 60 only | 56% | 24% | 20% | 1.64 |
| Upgrades 42 and 60 | 32% | 48% | 20% | 1.88 |

When upgrade 86 is owned, the independent whole-ring double has probability 25 percent. For any pre-double expected gain `E`:

```text
expectedAfterDouble = E * (0.75 * 1 + 0.25 * 2)
                    = E * 1.25
```

For the confirmed account owning upgrades 42, 60, and 86:

- Expected ordinary-ring gain before double: `1.88`
- Expected ordinary-ring gain after double: `1.88 * 1.25 = 2.35`
- Expected major-ring gain with bonus 940: `(940 + 1.88) * 1.25 = 1177.35`

Major-ring outcome distributions add the supplied major bonus before applying the whole-ring double, so doubled outcomes include the entire bonus.

## Manually Supplied Prototype Inputs

The current developer preview uses a mix of confirmed imported data and manual inputs:

- Major bonus every 20th ring is imported from the confirmed Bolaia study level and calculated as `level * 20`. The field remains editable for controlled manual testing.
- Minimum and maximum normal ring gain are calculated from imported upgrade 42/60 ownership. Both fields remain editable for controlled testing.
- Whether doubling is enabled is imported from upgrade 86 ownership but remains manually editable for controlled testing.
- Double chance remains `25` percent from confirmed game logic.

These inputs calculate ranges and exact analytical expectations. They do not select rewards, roll random outcomes, or simulate a run.

## Selected-Reward Target Evaluator

The first functional evaluator analyzes one manually selected Bell reward at a time using the imported account snapshot:

- Current seven reward levels
- Current zero-based ring index and derived human-readable ring
- Derived cavern count and exact reward-selection fraction
- Exact ordinary gain distribution
- Imported major bonus and exact major-ring distribution
- Imported whole-ring-double state and confirmed 25 percent chance

For a target human-readable ring:

```text
futureRings = targetRing - currentRing
futureMajorRings = count of rings divisible by 20 where
                   currentRing < ring <= targetRing
ordinaryFutureRings = futureRings - futureMajorRings

expectedSelectedRewardGain =
  rewardSelectionProbability *
  (
    ordinaryFutureRings * expectedOrdinaryRingGain +
    futureMajorRings * expectedMajorRingGain
  )
```

The exact analytical distribution adds a zero-gain outcome for rings that select another reward, then combines each independent ring distribution with dynamic programming. Ordinary and every-20th-ring distributions are handled separately. It returns target probability and final-level P10, P25, median, P75, and P90.

This is not Monte Carlo simulation. To keep a local browser responsive, exact convolution is limited to 500 future rings and a maximum 250,000-level outcome span.

When either exact limit is exceeded, the evaluator analytically calculates a mean and variance for the selected reward on an ordinary ring and on a major ring. Each per-ring distribution includes zero when a different reward is selected, the complete verified gain distribution when the target reward is selected, and whole-ring double outcomes when enabled. Independent ring means and variances are then summed. A continuity-corrected normal approximation supplies target probability, current percentile, P10, P25, median, P75, and P90. Zero-variance cases are handled deterministically.

Every result is labeled **Exact analytical** or **Analytical approximation**. The approximation is never presented as exact.

The current-run comparison uses neutral expectation labels only. It evaluates the selected reward under the currently imported mechanics; it does not produce optimization ratings or reset advice. Historical comparisons assume those current mechanics applied throughout the run, so a run where study level, upgrade ownership, or available rewards changed has an additional source of approximation.

## Bell Renewal Currency

The following are confirmed for the current game version:

- Renewal currency generation rate is imported separately from the current balance.
- Current renewal currency is a finite, nonnegative balance and may be fractional.
- Lifetime Bell renewals is the cumulative number of renewals completed; it is not the current balance or the number affordable now.
- One Bell renewal costs exactly `25` renewal currency.
- Immediately affordable renewals are derived as `Math.floor(currentRenewalCurrency / 25)`.

These facts support account-state display only. They do not establish when a player should renew, how Lanterns should be used, or any renewal-generation forecast.

## Ringing the Bell Progress

Confirmed imported fields:

- `parsedHoles[18][0]` is current Ringing EXP/progress.
- `parsedHoles[18][1]` is the zero-based raw ring index.
- `humanRing = rawRingIndex + 1`.

The verified requirement for the next ring is calculated rather than read from another confirmed save field:

```text
nextRingRequiredExp =
  (5 + 3 * rawRingIndex) * Math.pow(1.05, rawRingIndex)
```

Remaining EXP is clamped at zero, but the underlying progress fraction and percentage may exceed 100 percent. Only the visual bar is capped. Bell Ring EXP/hour is reconstructed automatically; `[18][5]` is Bell Clean state, not a rate.

Player-facing large values use approximately three significant digits with `K`, `M`, `B`, `T`, `Q`, `QQ`, then `e21`, `e24`, `e27`, and continuing scientific tiers. Exact imported values remain visible in Developer Tools.

## Bell Improvement Methods

Verified game-version method multipliers from `CustomLists.HolesInfo[61]`:

```text
[5, 10, 8, 13, 12, 15]
```

Upgrade 45 returns zero when unowned. When owned, its multiplier is `max(1, 1.1 ^ floor(totalMethodLevels / 25))`. Each method quantity is:

```text
2 * methodLevel * max(1, upgrade45Multiplier * staticMethodMultiplier)
```

This `max` is important: when upgrade 45 is unowned, its zero multiplier produces the unscaled `2 * methodLevel` quantity. Ringing uses only methods 0, 2, 4, and 5. Their quantities sum to a percentage, and `ringingMethodMultiplier = 1 + ringingMethodBonusPercent / 100`.

`totalMethodLevels` is the sum of all six Method levels, including Clean Method 1 and Ping Method 3. Those two Methods do not contribute their own quantities directly to Bell Ring. Away from a multiple-of-25 boundary, buying either produces zero Bell Ring gain. If the purchase crosses one or more total-Method multiples of 25, however, Upgrade 45 increases its global exponential multiplier and legitimately rescales Methods 0, 2, 4, and 5. Ring recommendations must describe such purchases as global Method-scaling bridges rather than direct Clean/Ping contributions to Ring.

## Ringing EXP/hour dependency trace

The bundle uses `10 × Monument × Measurement × Method × Jar11 × Jar36`. Verified Jar bases are 25 and 75, and Legend talent 29 adds 20% to both Jar bonuses per talent level. Levels 11 and 13 with talent level 5 produce `6.5×`, `20.5×`, and `133.25×` combined.

Extracted directly from the local bundle: `HolesInfo[37][7] = 1`, `HolesInfo[37][9] = 250`, `HolesInfo[52][2] = 6`, and `HolesInfo[55][2] = 10` (numeric content, no `TOT`). Measurement quantity type 6 calls the sum of Workbench `OverkillQTY(0..6) / 125`; its complete save-backed inputs remain unresolved. Monument reward 7 also needs slot-9, Cosmo, and Fountain calculations, so final Ringing EXP/hour is deliberately unavailable.

## Manual Ringing EXP/hour and progression

Until that dependency tree is mapped, Bell EXP/hour is manually copied from the in-game Ringing screen. It is not a save import and is never inferred from partial factors. Supported notation includes plain/scientific numbers and K, M, B, T, Q, and QQ suffixes.

Duration progression starts with imported raw ring index and progress, adds reconstructed `rate × hours`, pays each requirement `(5 + 3 × rawIndex) × 1.05^rawIndex`, increments the raw index, and carries excess EXP. A fresh preview uses raw index 0 and progress 0. Human-readable rings divisible by 20 count as crossed major payout rings. The preview has a 100,000-ring safety limit.

## Fresh-run Reset and Lantern resource planner

A fresh attempt begins at reward level 0, raw ring index 0, and Ringing progress 0. Its checkpoint uses the automatically reconstructed Bell Ring rate over two hours by default. The selected reward probability is calculated by the existing exact/approximated target evaluator, including reward selection, ordinary and major gains, whole-ring doubles, and zero gain when another reward is selected.

For per-run probability `p`, expected attempts are `1 / p`. Required attempts for confidence `c` are `ceil(log(1-c) / log(1-p))`; cumulative chance is `1-(1-p)^runs`. One attempt conventionally requires one renewal and one Lantern use. Renewal cost is 25, while current currency and generation rate are imported. Lantern inventory is not imported. Runs are treated as independent with unchanged mechanics and manual EXP/hour. These are fresh-run odds and resource requirements, not a current-run reset recommendation.

## Current run versus fresh reset decision

The primary recommendation uses a 48-hour outlook by default, with Advanced overrides for 24, 48, 72, or custom hours. Continue starts from imported raw ring, Ringing EXP, and selected reward level. Fresh starts from raw ring 0, Ringing EXP 0, and reward level 0. Both advance at the same automatically reconstructed Bell Ring EXP/hour and use the shared analytical target evaluator.

The fresh strategy is described as one two-hour Lantern followed by passive progress through the remainder of the outlook. Since the verified progression function holds EXP/hour constant, this is mathematically equivalent to one uninterrupted full-outlook advance. It costs 25 renewal currency and one Lantern use; Lantern inventory is not known.

Gain Pace remains a two-hour Lantern-efficiency comparison, and Fresh-run Odds remains a one-Lantern reroll planner. Their horizons do not change with the primary run outlook.

## Current run distribution

The seven imported levels at `$.data.Holes::parsed[17]` are summed as `totalCurrentBellLevels`. Each reward's descriptive current share is `level / total`, or zero when the total is zero. Rows remain in the confirmed reward order. Highest, lowest, and selected-reward shares describe only where accumulated levels landed in this run.

Future selection chance is read independently from the verified cavern bracket: 1/4 for indexes 0–3, 1/6 for indexes 0–5, or 1/7 for indexes 0–6. Current shares never become selection inputs.

Both paths use the same automatically reconstructed Bell Ring EXP/hour and duration. Continue starts from imported raw ring, Ringing EXP, and selected reward level; reset starts from zero. Both call the shared progression and target-evaluator engines. Target probability is primary: a difference of at least +10 percentage points is `KEEP THIS RUN`, +2 to below +10 is `KEEP FOR NOW`, within 2 points is `EITHER PATH IS SIMILAR`, -2 to above -10 is `RESET IS SLIGHTLY BETTER`, and at most -10 is `RESET IS MUCH BETTER`.

Guardrails override those thresholds: an already reached target or two near-certain paths favor keeping; two zero-probability paths mean the checkpoint is too early; missing manual rate or invalid probabilities prevent a recommendation; and an unaffordable reset becomes `KEEP FOR NOW` with the currency wait shown. A reset path costs 25 currency and one checkpoint Lantern use.

Feasibility is evaluated before probability differences: at least 35% is `Realistic`, at least 5% is `Possible`, at least 0.1% is `Long shot`, and lower is `Effectively impossible`; an unreached target with probability below 0.1% and P90 below 75% of target is also effectively impossible. Reached targets are classified separately.

Recommendation precedence is: reached target, current feasibility, fresh feasibility, probability difference, then renewal affordability. An extremely bad current path (below 0.1%, P90 below half the target, with reset odds or expected finish better) is `ABSOLUTELY COOKED`. Two effectively impossible paths are never called similar; the result instead says the target is too high for the checkpoint.

Quality is objective-specific: `Cooked`, `Weak`, `Saveable`, `Strong`, or `Exceptional`. Zero-probability paths and paths whose P90 is below half the target cannot be Saveable. Exceptional still requires a materially better current path and at least the 90th current-run percentile.

Fresh-run practicality uses attempts required for 50% confidence: 10 or fewer is Practical, 11–100 Expensive, 101–1,000 Extreme, and above 1,000 Not realistically farmable. Long generation waits display hours, days, months, or approximate years rather than giant raw hour counts.

## Gain Pace and efficiency drop-off

A pace window calls the verified Ringing progression engine, then computes expected selected-reward gain as `selectionProbability × (ordinaryRings × expectedOrdinaryGain + majorRings × expectedMajorGain)`. Gain per hour is that window gain divided by its duration. This is selected-reward gain efficiency, not Bell EXP efficiency.

The baseline is the first checkpoint window of a fresh run, never the nearly-free instantaneous rate at raw ring 0. Rolling windows carry the exact ending raw ring and remaining Ringing EXP into the next window. Efficiency is `100 × windowGain / firstFreshWindowGain`; the first window at or below 25% is the player-facing efficiency drop-off. Milestones at 75%, 50%, 25%, and 10% mean mild slowdown, noticeable slowdown, severe diminishing returns, and minimal value.

Expected finish is a projected total reward level at a checkpoint. Expected gain is levels added during one window. Gain pace is expected selected-reward levels per hour in that window. These values do not alter target probability or the keep/reset recommendation.

Lantern-to-Lantern value keeps the full checkpoint windows. Relative values are Excellent at 75%+, Good at 50%+, Reduced at 25%+, Very low at 10%+, and Negligible below 10%. A later window containing a major payout may spike temporarily without changing the first point at which full-window value became negligible.

First-Lantern slowdown divides the first checkpoint into 15-minute subwindows (eight for two hours), carrying exact raw ring and Ringing EXP. Pace is smoothed with a centered three-subwindow average, using available neighbors at the edges. The baseline is the average raw gain pace over the first 30 minutes, not the first 15 minutes. Milestones use the smoothed pace and thresholds reached in one subwindow are grouped.

Each subwindow also reports `cumulativeGainShare = cumulativeExpectedGain / fullFirstCheckpointExpectedGain`. This cumulative share is the primary normal-view explanation; the smoothed thresholds remain diagnostic details. It is informational only and never advises stopping a Lantern before its full duration.

The verified full structure is:

```text
RingingExpPerHour =
  10
  * Monument multiplier
  * Measurement multiplier
  * Ringing method multiplier
  * Jar collectible 11 multiplier
  * Jar collectible 36 multiplier
```

Only the Ringing method component is fully imported and calculated. Monument, Measurement, Jar 11, and Jar 36 remain under mapping, so final Ringing EXP/hour must not be displayed as calculated.

## Unverified Mechanics

The following mechanics must not be implemented until they are supported by reliable evidence and test cases:

- **Ring-cost formula:** Unverified. Add formula and source evidence here.
- **Random reward outcome:** The available ranges are verified from the bundle, but the inclusive random-integer behavior still needs observed-save validation before public release.
- **Other villager and cavern fields:** Only the first villager level and derived capped cavern count are confirmed for this mechanic.
- **Renewal strategy and effects:** The currency fields and cost are confirmed, but recommendation timing, renewal effects, and retained state are not implemented here.
- **Lantern interaction:** Unverified. Document timing and Bell interaction here.
- **Run recovery:** Unverified. Define and validate what makes a run realistically recoverable here.

Confirmed and unconfirmed Bell save paths are tracked separately in `BELL_SAVE_FIELDS.md`.
# Phase 2 Ringing EXP/hour trace

The exact bundle call site is `10 × (1 + MonumentROGbonuses(0,7)/100) × (1 + MeasurementBonusTOTAL(2,0)/100) × (1 + sum(BellMethodsQTY(0,2,4,5))/100) × (1 + JarCollectibleBonus(11)/100) × (1 + JarCollectibleBonus(36)/100)`. Each helper returns a **percent bonus**, not a multiplier or an already-combined total. The `1 + percent/100` conversion happens exactly once per factor.

- `CosmoBonusQTY(0,0) = floor(25 × Holes[4][0])`.
- `Fountain_BonTOT(0,13) = round(Fountain_MarbleBon(0,13) × Holes[31][0][13] × HoleFountUPG[0][13][6])`. The exact static value at `[6]` is `1`; the adjacent `2.50` is at `[5]` and is not read by this helper. The marble factor is `1` at marble level zero and otherwise `1.5 + 0.5 × Holes[32][0][13]`.
- `MonumentROGbonuses(0,9)` uses `Holes[15][9]`, static base `250`, excludes slot-9 recursion and Cosmo, includes the Fountain factor, and returns `0.1 × ceil(10 × level/(250+level) × 250 × max(1, sharedScale))`.
- `MonumentROGbonuses(0,7)` uses `Holes[15][7]`, static base `1`, and returns `level × max(1, (1 + slot9/100 + Cosmo/100) × (1 + Fountain/100))`.
- `CosmoBonusQTY(1,3) = floor(25 × Holes[5][3])`.
- Measurement base 2 is `(1 + Cosmo/100) × 10 × Holes[22][2]`.
- `MeasurementQTYfound(6,99) = sum(OverkillQTY(0..6)) / 125`.
- Measurement scaling is `1 + 18q/100` below 5, otherwise `1 + (18q + 8(q-5))/100`. Measurement bonus percent is base × scaling.

`OverkillQTY` is not stored in `data.Holes`. It iterates each world's static Death Note mob list, maps mob IDs through `MapAFKtarget`, totals `MapDetails[map][0][0] - KillsLeft2Advance[map][0]` across every character, then converts each mob total to points: 0 below 25K; 1 below 100K; 2 below 250K; 3 below 500K; 4 below 1M; 5 below 5M; 7 below 100M; 20 only above 1B with Rift bonus 3; otherwise 10. Exported character arrays are serialized at `data.KLA_0`, `data.KLA_1`, and so on. Rift bonus 3 uses `data.Rift[0] >= 20`.

The real fixture reconstructs Overkill quantities `[300, 220, 280, 260, 260, 280, 360]`. Their sum is `1960`; `MeasurementQTYfound(6,99) = 1960 / 125 = 15.68`. Measurement scaling is `4.6768`, base bonus is `9980%`, final Measurement bonus is `46674.464%`, and the Measurement multiplier is `467.74464×`.

The Monument panel renders the raw `MonumentROGbonuses` result in its reward description and separately formats `1 + result/100` as multiplier notation. The Bell Improvement panel inserts each raw `BellMethodsQTY` into its method description; Ringing sums methods 0, 2, 4, and 5 as percent bonuses before converting that sum once.

The audited fixture-backed factors are: Monument `22838.666336×` (raw reward-7 helper `+2,283,766.6336%`), Measurement `467.74464×`, Bell Methods `6088809.66826782×` (raw selected-method sum `+608,880,866.826782%`), Jar 11 `6.5×`, and Jar 36 `20.5×`. Their calculated total is `86672071285355340 EXP/hour` (about `86.7Q/hr` at the game display precision). This result follows the indexed constants and formulas directly; it was not calibrated to the displayed rate.
# Phase 3 one-step candidate formulas

- Bell Method cost: method 0 uses `15,000,000,000 × 1.25^level`; method 2 uses `1,000,000 × 1.5^level`; methods 1, 3, 4, and 5 use their bases `100, 300, 150, 1500 × 1.1^level`. A candidate recomputes every method quantity so upgrade-45 exponent boundaries are preserved.
- Ringing Measurement cost: `(250 + 50L) × 1.6^2 × 1.1^L / (1 + Fountain_BonTOT(2,14)/100)`. `Fountain_BonTOT(2,14)` uses static effect `1`, its Fountain level, and marble multiplier.
- Monumental Boost cost: static base `250 × 2.5^L`; its resource selector is `2`, mapping to `Holes[9][32]`.
- Monumental Boost marble cost at water 0, slot 13: `1500 × (10 + 5L)^L`, paid from `Holes[11][81]`.
- Cosmo nodes cost one remaining Cosmo point and obey the enhanced caps in `HolesInfo[56..58]`. On the fixture, both Bell-rate Cosmo nodes are already at their legal enhanced caps.
- Monument reward levels are granted by Bravery Monument results. They have a calculable hypothetical one-level rate delta but no deterministic one-level currency cost.
- Jar collectible levels increase only when an Enchanted Jar succeeds and then randomly selects an owned collectible (subject to the verified focus modifier). They have no deterministic targeted next-level cost.
- Death Note candidates advance only to the next finite skull threshold. Their Measurement change is recomputed from the resulting point increase; they are progression candidates, not currency purchases.

# Phase 4 Bell-rate upgrade sequencing

- A legal purchase deducts the candidate's exact current cost from its own resource pool, adds exactly one level, regenerates the next cost, and reruns the full verified Bell-rate formula.
- Independent currencies are optimized independently and their non-conflicting legal sequences are combined. Candidates sharing a pool (including Cosmo points) compete for the same balance.
- Search excludes unaffordable branches, capped levels, unresolved costs/currencies, and zero-rate-gain steps. Methods 1 and 3 therefore remain documented but do not enter the current Ringing purchase search unless a future verified dependency gives them a positive recomputed gain.
- Marble is eligible only when the actual Marble balance covers its exact next cost. Death Note kills, targeted Jar outcomes, and Monument story rewards are never modeled as currency purchases.
- Exact exhaustive search is used below the state bound. If the state bound is reached, the completed explored portion is labeled `bounded exact`; there is no silent greedy fallback.
- Objectives evaluate the fully recomputed rate or the existing nonlinear Ringing progression at 2 or 48 hours. A displayed roll objective is not inferred from percentage gain.

# Phase 5 practical resource policy

- Maximum Bell Ring Rate preserves the Phase 4 behavior and is labeled as a Ring-only maximum that ignores other account uses for Gaming Bits, Atoms, Coins, Mythril, Eighth Notes, and Decent Rupie.
- Practical Bell Gains accepts a sequence when it adds a 2-hour roll, adds a 48-hour roll, reaches the configured cumulative rate threshold, or crosses `floor(totalBellMethodLevels / 25)` into a new Upgrade 45 exponent.
- The default practical rate threshold is `0.25%` cumulative gain. Tiny intermediate purchases may be retained when the completed sequence reaches a verified breakpoint; the plan does not recommend stopping midway through that sequence.
- A resource spending limit is `min(owned, maximumAmount, owned - minimumReserve, owned × maximumPercent / 100)`. Blank limits are omitted, and disabled pools have a zero limit.
- Resources remain independent and are never converted into a universal efficiency currency.
- Ending-ring and target-chance objectives stop at the first legal target-reaching plan unless maximum excess progress is requested. Ending-ring objectives use verified Ringing progression; target chance uses the analytical target evaluator.
- Every step reports marginal/cumulative Bell-rate gain, marginal/cumulative 2-hour and 48-hour rolls, and cumulative share of that resource pool consumed.
- Every after-rate is a complete formula recomputation. Two-hour roll changes use `advanceRingingProgress` from raw ring 0 and zero EXP.
## Bell Improvement Method classification

The authoritative `Holes[16]` order is: Method 0, Bell Ring, Coins; Method 1, Bell Clean, Mythril; Method 2, Bell Ring, Gaming Bits; Method 3, Bell Ping, Eighth Note from the Harp; Method 4, Bell Ring, Atoms; Method 5, Bell Ring, Decent Rupie. Method 5 specifically spends the teal/cyan Decent Rupie produced by the Great Jar, stored at `$.data.Holes::parsed[9][25]`; this exact path distinguishes it from the other Decent Rupie resources.

Verified activity rates from `BellExpPerHR` are:

- Bell Ring: `10 × Monument × Measurement × (1 + (MethodQTY[0] + [2] + [4] + [5]) / 100) × Jar11 × Jar36`.
- Bell Ping: `10 × Monument × Measurement × (1 + MethodQTY[3] / 100)`.
- Bell Clean: `10 × (1 + MethodQTY[1] / 100)`.
- Renewal currency: constant `10/hour`.

These are separate progression meters, not interchangeable percentages. Bell Ping completion increments `Holes[7][4]` and creates an Opal. Bell Clean completion makes the verified `BellMethodsNewODDS` roll and, on success, increments `Holes[18][5]` to unlock another method. Only Bell Ring EXP/hour drives Ring roll projections.
## Upgrade Paths stat filtering

Upgrade candidates are separated into Bell Ring, Bell Ping, and Bell Clean dimensions. Bell Ring is the default. The player-facing Upgrade Paths view groups verified candidates into Available now, Next upgrades, Longer-term account goals, Collectible opportunities, and Capped / unavailable. Technical candidate identifiers and save paths remain outside the normal rows.

Candidate `Rate gained` is the complete affected-stat rate after the one-step change minus its complete current rate. Ring method candidates include Monument, Measurement, both Ringing Jar multipliers, and the recomputed method multiplier; Ping and Clean retain their separate verified formulas. Death Note remains an input inside the single Measurement multiplier and is never multiplied into Bell Ring a second time.

Ringing Measurement is a Measurement-system upgrade paid with Cobaltine from Bucket 1 (`$.data.Holes::parsed[9][4]`). It is not a Bell Improvement Method. Its verified multiplier contributes to both Bell Ring and Bell Ping, so it appears in both filters with a different complete affected-stat gain; it does not contribute to Bell Clean.

The authoritative Improvement Method distribution remains four Ring methods (0, 2, 4, 5), one Ping method (3), and one Clean method (1). Shared Monument and Measurement sources are not Improvement Methods. Because Ping is `10 × Monument × Measurement × (1 + MethodQTY[3]/100)`, every verified Monument and Measurement candidate—including applicable Cosmo, Fountain Monumental Boost, marble scaling, Ringing Measurement, and Death Note progression—appears under both Ring and Ping with stat-specific complete rates.
## Upgrade recommendation and safety policy

- Recommend the valid active affordable candidate with the largest absolute gain for the selected Bell stat.
- When none are affordable, show the largest valid active gain as an Upgrade to Work Toward.
- Capped, incomplete/unavailable, cross-stat, and invalid/non-finite candidates cannot be recommended or purchased.
- With no active verified candidate, show: `No further verified [Bell stat] rate upgrades are currently available.`
- Candidate current/projected rates must be finite and nonnegative, gain must equal projected minus current within floating-point tolerance, deterministic costs and owned values must be finite and nonnegative, and capped candidates must have neither a next level nor a cost.
- Ring, Ping, and Clean projections always use their complete independently reconstructed rate.

Ringing Measurement is a Measurement-system upgrade using Cobaltine at `$.data.Holes::parsed[9][4]`. It affects Bell Ring and Bell Ping, is not a Bell Improvement Method, and does not affect Bell Clean.
