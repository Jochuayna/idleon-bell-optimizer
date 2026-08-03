# Bell Save Fields

The Bell reward-level array, Ringing state, verified Bell-rate dependencies, and Phase 3 resource paths explicitly marked **Confirmed** below are source-backed. Entries marked Unconfirmed or Incomplete remain discovery boundaries.

## Confirmed Bell Reward Levels

| Detail | Confirmed value |
| --- | --- |
| Outer path | `$.data.Holes` |
| Storage type | Serialized JSON string |
| Parsed path | `$.data.Holes::parsed[17]` |
| Status | **Confirmed** |
| Evidence | A real IdleOn save produced seven values matching the Bell levels displayed in game, in the reward order below. |

| Parsed index | Bell reward |
| ---: | --- |
| `[17][0]` | Bucket Fill Rate |
| `[17][1]` | All Villager EXP |
| `[17][2]` | Harp Note Gains |
| `[17][3]` | Daily Lamp Wishes |
| `[17][4]` | Extra Rupie Chance |
| `[17][5]` | Double Torch Chance |
| `[17][6]` | Coins From Fountain |

The importer reads only the first seven finite numeric values at parsed index `[17]`. Additional values are left untouched and ignored.

## Confirmed Bell Ring Index

| Detail | Confirmed value |
| --- | --- |
| Outer path | `$.data.Holes` |
| Storage type | Serialized JSON string |
| Parsed path | `$.data.Holes::parsed[18][1]` |
| Internal name | `bellRingIndex` |
| Interpretation | Zero-based Bell ring index |
| Human-readable value | `bellRingNumber = bellRingIndex + 1` |
| Value validation | Finite, nonnegative number |
| Status | **Confirmed** |
| Evidence | Controlled saves showed raw `18` before one click and raw `19` after that click triggered the 20th-ring major payout. The selected reward increased on the same click. Therefore internal index `19` represents the human-readable 20th Bell ring. Earlier controlled saves also showed raw `0`, raw `1`, and raw `692`. |

The interface must display the derived one-based `bellRingNumber`, while developer details preserve and show the raw `bellRingIndex`.

## Confirmed Ringing Progress

| Detail | Confirmed value |
| --- | --- |
| Current Ringing EXP path | `$.data.Holes::parsed[18][0]` |
| Raw zero-based ring index path | `$.data.Holes::parsed[18][1]` |
| Human ring | `rawRingIndex + 1` |
| Next-ring requirement | Calculated; it is not imported from a confirmed stored field |
| Bell EXP/hour | Not mapped yet |

Bell EXP/hour is currently a manual player-entered value, not an imported save field. Ring index and current progress remain imported; the next requirement and duration progression are calculated from verified formulas.

The fresh-run planner reuses imported `currentRenewalCurrency` at `[18][6]`, the verified constant `renewalCurrencyPerHour = 10`, the verified renewal cost of 25, and already imported Bell mechanics. Lantern inventory has no confirmed imported field and is not claimed or estimated.

The current-versus-reset engine adds no save paths. It reuses imported ring progress, selected reward level, renewal currency, and mechanics. Its Bell EXP/hour and checkpoint duration are manual values.

Gain Pace adds no save fields. It reuses imported Ringing progress, reward mechanics, and the automatically reconstructed Bell Ring EXP/hour.

## Confirmed Ringing Jar and partial-rate fields

| Mechanic | Candidate JSON path | Status | Evidence |
|---|---|---|---|
| Jar collectible 11 level | `$.data.Holes::parsed[24][11]` | Confirmed | Real save and bundle `JarCollectibleBonus(11)` |
| Jar collectible 36 level | `$.data.Holes::parsed[24][36]` | Confirmed | Real save and bundle `JarCollectibleBonus(36)` |
| Shared Jar Legend talent 29 | `$.data.Spelunk::parsed[18][29]` | Confirmed | Real save and traced Legend talent input |
| Monument 0 reward 7 level | `$.data.Holes::parsed[15][7]` | Confirmed | Real save value 62410; scaling inputs remain unresolved |
| Measurement 2 purchased level | `$.data.Holes::parsed[22][2]` | Confirmed | Real save value 499; quantity dependency remains unresolved |

The requirement calculation uses the raw index: `(5 + 3 * rawRingIndex) * Math.pow(1.05, rawRingIndex)`. The importer preserves exact nonnegative progress, including progress above the calculated requirement. The player-facing progress bar alone is clamped to 100 percent.

`$.data.Holes::parsed[18][5]` is the Bell Clean method/unlock index. Renewal currency generation is the verified `BellExpPerHR(3) = 10` constant.

## Confirmed Bell Improvement Methods

| Detail | Confirmed value |
| --- | --- |
| Method levels | `$.data.Holes::parsed[16][0..5]` |
| Upgrade 45 ownership | `$.data.Holes::parsed[13][45]` |
| Ownership rule | Raw value greater than zero means owned |
| Static multipliers | `[5, 10, 8, 13, 12, 15]` from `CustomLists.HolesInfo[61]` |
| Status | **Confirmed** |

The save stores levels and ownership. Upgrade scaling, six method quantities, and the combined Ringing method multiplier are calculated from verified bundle logic rather than imported as separate fields.

## Confirmed Bolaia Bell Study Level

| Detail | Confirmed value |
| --- | --- |
| Outer path | `$.data.Holes` |
| Storage type | Serialized JSON string |
| Parsed path | `$.data.Holes::parsed[26][4]` |
| Field meaning | Bolaia Bell study level |
| Formula | `majorBellBonus = bolaiaBellStudyLevel * 20` |
| Status | **Confirmed** |
| Real-save evidence | Study level `47` produces major Bell bonus `940` because `47 * 20 = 940`. |

## Confirmed Bell Upgrade Ownership

Upgrade ownership values are stored in the parsed array at `$.data.Holes::parsed[13]`. Ownership is derived as `rawValue > 0`; raw values are not assumed to be limited to `0` or `1`.

| Upgrade | Parsed path | Meaning | Derived field | Status | Evidence |
| ---: | --- | --- | --- | --- | --- |
| 42 | `$.data.Holes::parsed[13][42]` | Bell upgrade 42 ownership | `bellUpgrade42Owned` | **Confirmed** | Real save raw value was `1`. |
| 60 | `$.data.Holes::parsed[13][60]` | Bell upgrade 60 ownership | `bellUpgrade60Owned` | **Confirmed** | Real save raw value was `1`. |
| 86 | `$.data.Holes::parsed[13][86]` | Bell upgrade 86 ownership | `bellUpgrade86Owned` and `wholeRingDoubleEnabled` | **Confirmed** | Real save raw value was `1`. |

These paths store ownership only. Upgrade 42 and 60 use verified game-bundle effect constants of `30`; those constants are not imported from separate save paths, and no such effect-value paths are assumed.

## Confirmed First Villager Level and Cavern Count

| Detail | Confirmed value |
| --- | --- |
| Parsed path | `$.data.Holes::parsed[1][0]` |
| Field meaning | First villager level (`villagerLevel0`) |
| Cavern formula | `cavernsOwned = Math.min(18, Math.floor(villagerLevel0))` |
| Status | **Confirmed** |
| Real-save evidence | Raw first villager level `24` produces `Math.min(18, 24) = 18` caverns. |

The importer preserves the finite, nonnegative raw level and derives the capped integer cavern count. Cavern count then selects the confirmed reward-availability bracket.

### Verified Major-Payout Observation

| State | Coins From Fountain `[17][6]` | Raw ring index `[18][1]` |
| --- | ---: | ---: |
| Before major payout | 7 | 18 |
| After one ring | 950 | 19 |

- Observed reward increase: `950 - 7 = 943`
- Reward selected: Coins From Fountain
- This observation does **not** establish that `943` is stored directly anywhere.
- The major-payout formula remains unverified and must not be inferred from this single observation.

## Confirmed Bell Renewal Fields

Bell renewal data shares the parsed `[18]` array with the Bell ring index. Fractional current currency is preserved exactly by the importer.

| Mechanic | Parsed path | Meaning | Status | Evidence |
| --- | --- | --- | --- | --- |
| Renewal generation rate | `BellExpPerHR(3)` constant | `renewalCurrencyPerHour` | **Confirmed** | The bundle returns `10`; `[18][5]` is Bell Clean state. |
| Current renewal currency | `$.data.Holes::parsed[18][6]` | `currentRenewalCurrency`, the current spendable balance | **Confirmed** | Values changed passively over time and decreased after spending on a renewal. |
| Lifetime Bell renewals | `$.data.Holes::parsed[18][7]` | `lifetimeBellRenewals`, the historical number completed | **Confirmed** | Controlled renewal changed `60 -> 61`. |

The verified current-version renewal cost is `25` currency. `immediatelyAvailableRenewals = Math.floor(currentRenewalCurrency / 25)`. This affordable count is derived and is not another save field.

## Other Save Fields

| Mechanic | Candidate JSON path | Status | Evidence |
| --- | --- | --- | --- |
| Levels per 20th ring | Not identified | Unconfirmed | Awaiting comparison against known in-game value. |
| Double-level chance | Not identified | Unconfirmed | Awaiting comparison against known in-game value. |
| Lantern hours | Not identified | Unconfirmed | Awaiting comparison against known in-game value. |
| Bell rings per hour inputs | Not identified | Unconfirmed | May require calculation; no formula or source is confirmed. |
# Phase 2 rate fields

| Mechanic | Candidate JSON path | Status | Evidence |
|---|---|---|---|
| Monument reward 7 level | `$.data.Holes::parsed[15][7]` | Confirmed | Direct `MonumentROGbonuses(0,7)` bundle read |
| Monument slot 9 level | `$.data.Holes::parsed[15][9]` | Confirmed | Direct `MonumentROGbonuses(0,9)` bundle read |
| Monument Cosmo level | `$.data.Holes::parsed[4][0]` | Confirmed | `CosmoBonusQTY(0,0)` |
| Fountain Monumental Boost level | `$.data.Holes::parsed[31][0][13]` | Confirmed | `Fountain_BonTOT(0,13)` |
| Fountain Monumental Boost marble level | `$.data.Holes::parsed[32][0][13]` | Confirmed | `Fountain_MarbleBon(0,13)` |
| Measurement Cosmo level | `$.data.Holes::parsed[5][3]` | Confirmed | `CosmoBonusQTY(1,3)` |
| Ringing Measurement level | `$.data.Holes::parsed[22][2]` | Confirmed | `MeasurementBonusTOTAL(2,0)` |
| Per-character Death Note kill arrays | `$.data.KLA_0` through `$.data.KLA_10` (each a serialized JSON array) | Confirmed | Ordered reconstructed kill totals match consecutive screenshot monsters across all seven worlds; Overkill totals match every screenshot footer |
| Rift level for eclipse skull rank | `$.data.Rift[0]` | Confirmed | `RiftStuff("riftBonus",3)` returns 1 at Rift level 20+; fixture value is 61 |
# Phase 3 Bell-rate candidate fields

| Candidate input or resource | Save path | Status | Evidence |
|---|---|---|---|
| Bell Method levels 0–5 | `$.data.Holes::parsed[16][0..5]` | Confirmed | `BellCosts`, `BellMethodsQTY`, and the Bell purchase handler |
| Method 0 owned coins | `$.data.Money_<active character>` | Incomplete | The game spends `Money`; the exported JSON has `Money_0..n` but does not identify the active character |

# Phase 4 account-selection and sequencing fields

| Mechanic | Save path | Status | Evidence |
|---|---|---|---|
| Character names | `$.charNames[index]` | Confirmed | Ordered names correspond to the suffixed character save fields |
| Per-character coins | `$.data.Money_<index>` | Confirmed | Exported once per character; bundle Bell Method 0 subtracts the live `Money` attribute |
| Active character | Not present in this export | Explicit fallback | Bundle identifies the live player through `UserInfo[0]`, but the debug export does not retain that value; user selection is required |
| Method 1 currency | `$.data.Holes::parsed[9][3]` | Path confirmed, localized label unresolved | Bell purchase branch directly subtracts this index; UI draws only the HolesInfo[29] font glyph |
| Cobaltine (Bucket 1) | `$.data.Holes::parsed[9][4]` | Confirmed | Ringing Measurement resource selector 4 and purchase branch agree |
| Method 3 currency | `$.data.Holes::parsed[9][14]` | Path confirmed, localized label unresolved | Bell purchase branch directly subtracts this index |
| Method 5 Decent Rupie | `$.data.Holes::parsed[9][25]` | Confirmed | Teal/cyan Decent Rupie produced by the Great Jar; Bell purchase branch directly subtracts this exact index |

The indexed fallback labels are intentional. No player-facing resource name is asserted without a source-backed localization string.

# Phase 5 constraint boundary

Resource balances continue to come from the confirmed Phase 3 paths above. Spending caps, reserve amounts, percentage limits, disabled-pool choices, practical thresholds, and target objectives are manual planning inputs; they are not imported save fields. The optimizer deducts them only from cloned calculation state and never changes the loaded JSON.
| Method 1 resource | `$.data.Holes::parsed[9][3]` | Confirmed | Bell affordability and purchase handler |
| Method 2 Gaming Bits | `$.data.Gaming[0]` | Confirmed | Bell affordability and purchase handler |
| Method 3 resource | `$.data.Holes::parsed[9][14]` | Confirmed | Bell affordability and purchase handler |
| Method 4 Atoms | `$.data.Divinity[39]` | Confirmed | Bell affordability and purchase handler; the player-facing currency is Atoms |
| Method 5 Decent Rupie resource | `$.data.Holes::parsed[9][25]` | Confirmed | Exact index preserves its identity separately from the other two Decent Rupies |
| Monument reward 7 level | `$.data.Holes::parsed[15][7]` | Confirmed | Added from Bravery Monument result array, not directly purchased |
| Monument reward 9 level | `$.data.Holes::parsed[15][9]` | Confirmed | Added from Bravery Monument result array, not directly purchased |
| Monument Cosmo level | `$.data.Holes::parsed[4][0]` | Confirmed | `CosmoBonusQTY(0,0)` |
| Measurement Cosmo level | `$.data.Holes::parsed[5][3]` | Confirmed | `CosmoBonusQTY(1,3)` |
| Cosmo points | Derived from `$.data.Holes::parsed[1][2]`, `$.data.GemItemsPurchased::parsed[4]`, and all levels in `Holes[4..6]` | Confirmed | `CosmoPtsLeft` |
| Monumental Boost level | `$.data.Holes::parsed[31][0][13]` | Confirmed | `Fountain_BonTOT(0,13)` |
| Monumental Boost currency | `$.data.Holes::parsed[9][32]` | Confirmed | `HoleFountUPG[0][13][3] = 2`, so the resource index is `30 + 2` |
| Monumental Boost marble level | `$.data.Holes::parsed[32][0][13]` | Confirmed | `Fountain_MarbleBon(0,13)` |
| Marble owned | `$.data.Holes::parsed[11][81]` | Confirmed | `CanWeAfford_Marbleize` and purchase handler |
| Ringing Measurement level | `$.data.Holes::parsed[22][2]` | Confirmed | `MeasurementBaseBonus(2)` |
| Ringing Measurement Cobaltine | `$.data.Holes::parsed[9][4]` | Confirmed | Collected from Bucket 1; `HolesInfo[50][2] = 4` |
| Measurement cost-reduction level | `$.data.Holes::parsed[31][2][14]` | Confirmed | `Fountain_BonTOT(2,14)` in `MeasurementCost` |
| Measurement cost-reduction marble level | `$.data.Holes::parsed[32][2][14]` | Confirmed | `Fountain_MarbleBon(2,14)` |
| Jar 11 / Jar 36 levels | `$.data.Holes::parsed[24][11]`, `[24][36]` | Confirmed | `JarCollectibleBonus`; levels rise from random successful Enchanted Jars |
## Bell activity progress

| Mechanic | Candidate JSON path | Status | Evidence |
|---|---|---|---|
| Bell Ring progress / raw index | `$.data.Holes::parsed[18][0]`, `[18][1]` | Confirmed | `BellEXPreq(0)` and Bell completion branch |
| Bell Ping progress / raw index | `$.data.Holes::parsed[18][2]`, `[18][3]` | Confirmed | Generic `2 * BellType` storage and `BellEXPreq(1)` |
| Bell Clean progress / method index | `$.data.Holes::parsed[18][4]`, `[18][5]` | Confirmed | `BellEXPreq(2)` and successful Clean unlock branch |
| Renewal currency | `$.data.Holes::parsed[18][6]` | Confirmed | Renewal spend/generation behavior |
| Lifetime renewals | `$.data.Holes::parsed[18][7]` | Confirmed | Controlled renewal increment |
| Renewal generation | game constant `BellExpPerHR(3) = 10` | Confirmed | Bundle formula; it is not stored at `[18][5]` |
## Shared upgrade resource labels

| Resource | Exact path | Status |
|---|---|---|
| Gold Coins from Fountain | `$.data.Holes::parsed[9][32]` | Confirmed |
| Cobaltine | `$.data.Holes::parsed[9][4]` | Confirmed; collected from Bucket 1 |
