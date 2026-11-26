"use strict";
window.BellOptimizer = window.BellOptimizer || {};

// Reset-aware Keep/Renew bar.
//
// The replacement model compares finishing this run with ONE fresh run, so it
// gives the same answer to a player with one Renewal and a player with seven
// hundred. This model sets the bar by how many re-rolls the player can make.
//
// The player's loop is: Renew, let the fresh run ring for a short check period
// (the tool's own tip is one 2-hour Lantern), look at it, and either keep it
// or Renew again. With one re-roll left you keep whatever you get, so that
// re-roll is worth an average fresh run. With more, you keep a fresh run only
// if it beats what the remaining re-rolls are expected to give:
//
//   worth(1) = average fresh run
//   worth(n) = average of max(fresh run, worth(n - 1))
//
// The current run is worth keeping when its expected finish is at least
// worth(n). The bar therefore rises with the number of re-rolls and is an
// average fresh run when only one is available.
//
// The time and Lanterns a re-roll costs are not modeled, so by default the
// plan uses the Renewals banked up to DEFAULT_REROLL_CAP. A player with the
// patience or Lanterns for more can raise it.
BellOptimizer.bellRenewalBudget = (function () {
  var MODEL_VERSION = "bell-renewal-budget-v1";
  var RENEWAL_COST = 25;
  var CHECK_HOURS = 2;
  var DEFAULT_REROLL_CAP = 50;
  var MAX_REROLLS = 5000;
  var NEAR_TIE = 0.02;
  var STRONG_ADVANTAGE = 0.08;
  // Major payouts are tallied on a grid this many steps per smallest payout.
  var MAJOR_GRID_STEPS = 64;
  var NEGLIGIBLE = 1e-15;

  function finite(value) { return typeof value === "number" && Number.isFinite(value); }
  function failure(code, reason) { return { ok: false, available: false, decision: "UNAVAILABLE", code: code, reason: reason }; }

  // A fresh run's expected finish as seen at the check point, as sorted values
  // with running totals so "average of max(value, bar)" is a single lookup.
  function createOutcomes(values, weights) {
    var count = values.length, total = 0, index;
    for (index = 0; index < count; index += 1) total += weights[index];
    var cumulativeWeight = new Float64Array(count + 1), cumulativeValue = new Float64Array(count + 1);
    for (index = 0; index < count; index += 1) {
      var weight = weights[index] / total;
      cumulativeWeight[index + 1] = cumulativeWeight[index] + weight;
      cumulativeValue[index + 1] = cumulativeValue[index] + weight * values[index];
    }
    // Number of outcomes strictly below the bar.
    function below(bar) {
      var low = 0, high = count;
      while (low < high) { var middle = (low + high) >> 1; if (values[middle] < bar) low = middle + 1; else high = middle; }
      return low;
    }
    return {
      mean: cumulativeValue[count],
      averageOfMax: function (bar) { var cut = below(bar); return bar * cumulativeWeight[cut] + (cumulativeValue[count] - cumulativeValue[cut]); },
      shareAtLeast: function (bar) { return Math.max(0, Math.min(1, 1 - cumulativeWeight[below(bar)])); }
    };
  }

  function outcomesFromDistribution(probabilities, offset) {
    var values = [], weights = [];
    for (var index = 0; index < probabilities.length; index += 1) if (probabilities[index] > 0) { values.push(index + offset); weights.push(probabilities[index]); }
    return createOutcomes(values, weights);
  }

  // For runs too long for the exact level-by-level distribution. Major payouts
  // decide how good a run is and are few, so their total is built exactly on a
  // fine grid; the many small ordinary payouts are added as their mean and
  // spread. This keeps the long upper tail a single bell curve would miss.
  function outcomesFromMajors(mechanics, majorCount, ordinaryCount, offset) {
    var p = mechanics.selectionProbability, gains = mechanics.majorGainDistribution, smallest = Infinity, largest = 0, index, g;
    for (g = 0; g < gains.length; g += 1) if (gains[g].probabilityValue > 0) { smallest = Math.min(smallest, gains[g].gain); largest = Math.max(largest, gains[g].gain); }
    var width = smallest > 0 && finite(smallest) ? Math.max(smallest / MAJOR_GRID_STEPS, 1e-9) : 1;
    var perMajor = Math.ceil(largest / width) + 1, totals = new Float64Array(1), reach = 0;
    totals[0] = 1;
    for (var major = 0; major < majorCount; major += 1) {
      var next = new Float64Array(reach + perMajor + 1);
      for (index = 0; index <= reach; index += 1) {
        var mass = totals[index];
        if (mass < NEGLIGIBLE) continue;
        next[index] += (1 - p) * mass;
        for (g = 0; g < gains.length; g += 1) {
          // Split between the two nearest grid points so the average is exact.
          var position = gains[g].gain / width, lower = Math.floor(position), share = position - lower, weight = p * gains[g].probabilityValue * mass;
          next[index + lower] += weight * (1 - share);
          if (share > 0) next[index + lower + 1] += weight * share;
        }
      }
      totals = next; reach += perMajor;
    }
    var first = 0, second = 0;
    mechanics.ordinaryGainDistribution.forEach(function (entry) { first += entry.gain * entry.probabilityValue; second += entry.gain * entry.gain * entry.probabilityValue; });
    var ordinaryMean = ordinaryCount * p * first, ordinarySpread = Math.sqrt(Math.max(0, ordinaryCount * (p * second - p * p * first * first)));
    // Three points reproduce a bell curve's mean, spread and tail weight.
    var nodes = ordinarySpread > 0 ? [[-Math.sqrt(3) * ordinarySpread, 1 / 6], [0, 2 / 3], [Math.sqrt(3) * ordinarySpread, 1 / 6]] : [[0, 1]];
    var points = [];
    for (index = 0; index < totals.length; index += 1) {
      if (totals[index] < NEGLIGIBLE) continue;
      for (var n = 0; n < nodes.length; n += 1) points.push([index * width + ordinaryMean + nodes[n][0] + offset, totals[index] * nodes[n][1]]);
    }
    points.sort(function (a, b) { return a[0] - b[0]; });
    return createOutcomes(points.map(function (point) { return point[0]; }), points.map(function (point) { return point[1]; }));
  }

  // worth[n] for n = 1..count: the expected finish from spending up to n re-rolls well.
  function rerollWorth(outcomes, count) {
    var worth = [NaN, outcomes.mean];
    for (var n = 2; n <= count; n += 1) worth.push(outcomes.averageOfMax(worth[n - 1]));
    return worth;
  }

  function classify(currentExpected, bar) {
    var relative = (currentExpected - bar) / Math.max(1, Math.abs(bar));
    var decision = Math.abs(relative) < NEAR_TIE ? "TOO_CLOSE" : relative >= STRONG_ADVANTAGE ? "KEEP" : relative > 0 ? "KEEP_FAVORED" : relative <= -STRONG_ADVANTAGE ? "RENEW" : "RENEW_FAVORED";
    return { decision: decision, relativeAdvantage: relative };
  }

  function evaluate(options) {
    options = options || {};
    var forecast = BellOptimizer.bellRunForecast, evaluator = BellOptimizer.targetEvaluator, mechanicsApi = BellOptimizer.bellMechanics;
    if (!forecast || !evaluator || !mechanicsApi) return failure("FORECAST_UNAVAILABLE", "Bell Run Forecast is unavailable.");
    if (!Array.isArray(options.rewardLevels) || !Number.isInteger(options.selectedRewardIndex)) return failure("INVALID_REWARD", "A selected Bell reward and its levels are required.");
    var currentLevel = options.rewardLevels[options.selectedRewardIndex];
    if (!finite(currentLevel) || currentLevel < 0) return failure("INVALID_REWARD_LEVELS", "The selected reward level is malformed.");
    var currency = options.currentRenewalCurrency, rate = options.ringingExpPerHour;
    if (!finite(currency) || currency < 0) return failure("INVALID_RENEWAL_CURRENCY", "Current Renewal currency is unavailable or malformed.");
    if (!finite(rate) || rate <= 0) return failure("RATE_UNAVAILABLE", "A finite positive Bell EXP/hour is required.");
    var planned = options.plannedRerolls;
    if (planned !== undefined && planned !== null && (!Number.isInteger(planned) || planned < 1)) return failure("INVALID_PLANNED_REROLLS", "Planned re-rolls must be a whole number of at least 1.");

    var fresh = forecast.buildFreshTaperBaseline(options);
    if (!fresh.ok) return failure(fresh.code, fresh.reason);
    var currentTaper = forecast.findRingingTaperBoundary(options);
    if (!currentTaper.ok) return failure(currentTaper.code, currentTaper.reason);
    var current = forecast.projectRewardToTaper(Object.assign({}, options, { currentRewardLevel: currentLevel, taper: currentTaper, mechanics: fresh.mechanics }));
    if (!current.ok) return failure(current.code, current.reason);

    // Where a fresh run stands when it is checked.
    var mechanics = fresh.mechanics, taperRaw = fresh.taper.taperRawRingIndex;
    var checked = mechanicsApi.advanceRingingProgress({ startingRawRingIndex: 0, startingRingingExp: 0, ringingExpPerHour: rate, durationHours: CHECK_HOURS });
    var checkRaw = checked.ok ? Math.min(checked.endingRawRing, taperRaw) : taperRaw;
    var distributionOptions = { currentRing: 1, targetRing: checkRaw + 1, selectionProbability: mechanics.selectionProbability, ordinaryGainDistribution: mechanics.ordinaryGainDistribution, majorGainDistribution: mechanics.majorGainDistribution, expectedOrdinaryRingGain: mechanics.expectedOrdinaryRingGain, expectedMajorRingGain: mechanics.expectedMajorRingGain };
    var atCheck = evaluator.calculateAdditionalLevelDistribution(distributionOptions), outcomes, exact;
    if (atCheck.ok) {
      // Expected finish = level at the check + the average gain still to come.
      var remaining = fresh.expectedFinalRewardLevel - evaluator.expectedFromDistribution(atCheck.probabilities);
      outcomes = outcomesFromDistribution(atCheck.probabilities, remaining);
      exact = true;
    } else if (atCheck.code === "COMPUTATION_LIMIT") {
      var expectedAtCheck = mechanics.selectionProbability * (atCheck.ordinaryRingCount * mechanics.expectedOrdinaryRingGain + atCheck.majorRingCount * mechanics.expectedMajorRingGain);
      outcomes = outcomesFromMajors(mechanics, atCheck.majorRingCount, atCheck.ordinaryRingCount, fresh.expectedFinalRewardLevel - expectedAtCheck);
      exact = false;
    } else return failure(atCheck.code || "INVALID_MECHANICS", atCheck.error || "The fresh-run check distribution could not be calculated.");

    var banked = Math.floor(currency / RENEWAL_COST + 1e-9), affordableNow = banked >= 1;
    var chosen = planned !== undefined && planned !== null;
    var requested = chosen ? planned : Math.min(banked, DEFAULT_REROLL_CAP);
    // With nothing banked the bar shown is the one a single Renewal would set.
    var rerolls = Math.max(1, Math.min(requested, MAX_REROLLS));
    var worth = rerollWorth(outcomes, rerolls), bar = worth[rerolls];
    var currentExpected = current.expectedFinalRewardLevel;
    var classification = classify(currentExpected, bar);
    // A run that has not reached the check point is still in its fast early
    // rings: more is about to be revealed for almost no time, so it is too
    // early to spend a Renewal on it and too early to call it a keeper.
    var earlyPhase = options.currentRawRingIndex < checkRaw && !currentTaper.alreadyTapered;
    var decision = classification.decision;
    if (earlyPhase) decision = classification.relativeAdvantage >= NEAR_TIE ? "KEEP_FAVORED" : "TOO_CLOSE";

    function sample(n) { return n <= rerolls ? { rerolls: n, bar: worth[n], topShare: outcomes.shareAtLeast(worth[n]) } : null; }
    return {
      ok: true,
      available: true,
      modelVersion: MODEL_VERSION,
      objective: "Keep this run only if its expected finish beats what the planned re-rolls are expected to give.",
      selectedRewardIndex: options.selectedRewardIndex,
      decision: decision,
      relativeAdvantage: classification.relativeAdvantage,
      currentExpectedFinish: currentExpected,
      keepBar: bar,
      keepBarTopShare: outcomes.shareAtLeast(bar),
      currentTopShare: outcomes.shareAtLeast(currentExpected),
      rerollsPlanned: rerolls,
      rerollsSource: chosen ? "PLAYER_SETTING" : banked > DEFAULT_REROLL_CAP ? "DEFAULT_CAP" : "BANKED_RENEWALS",
      defaultRerolls: Math.max(1, Math.min(banked, DEFAULT_REROLL_CAP)),
      rerollCapApplied: requested > MAX_REROLLS,
      renewalsBankedNow: banked,
      affordableNow: affordableNow,
      renewalCurrencyNeeded: Math.max(0, RENEWAL_COST - currency),
      singleRerollBar: worth[1],
      barByRerolls: [1, 3, 10, 25, 50, 100, 250, 500, 1000].map(sample).filter(Boolean),
      earlyPhase: earlyPhase,
      checkHours: CHECK_HOURS,
      checkRawRingIndex: checkRaw,
      checkHumanRingNumber: checkRaw + 1,
      freshExpectedFinish: fresh.expectedFinalRewardLevel,
      calculationMode: exact ? "Exact analytical" : "Analytical approximation",
      approximate: !exact,
      assumptions: {
        futureRenewalsModeled: true,
        futureLanternsModeled: false,
        check: "Each re-roll is judged after " + CHECK_HOURS + " hours of ringing at the current rate, by its expected finish.",
        time: "The time or Lanterns spent re-rolling are not counted; lower the planned re-rolls to reflect them.",
        keptRun: "A kept run is treated as final; the option to Renew it later is not counted."
      }
    };
  }

  return {
    MODEL_VERSION: MODEL_VERSION, RENEWAL_COST: RENEWAL_COST, CHECK_HOURS: CHECK_HOURS, DEFAULT_REROLL_CAP: DEFAULT_REROLL_CAP, MAX_REROLLS: MAX_REROLLS, NEAR_TIE: NEAR_TIE, STRONG_ADVANTAGE: STRONG_ADVANTAGE,
    evaluate: evaluate,
    _test: { createOutcomes: createOutcomes, outcomesFromDistribution: outcomesFromDistribution, outcomesFromMajors: outcomesFromMajors, rerollWorth: rerollWorth, classify: classify }
  };
}());
