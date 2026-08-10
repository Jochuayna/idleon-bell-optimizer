"use strict";
window.BellOptimizer = window.BellOptimizer || {};

BellOptimizer.bellRunReplacement = (function () {
  var MODEL_VERSION = "bell-run-replacement-v1";
  var DECISION_RULE = "ev-and-elite-upside-v1";
  var RENEWAL_COST = 25;
  var STRONG_THRESHOLD = 0.75;
  var DIRECTIONAL_THRESHOLD = 0.60;
  var APPROXIMATION_GUARD = 0.02;
  var MATERIAL_RELATIVE_ADVANTAGE = 0.20;
  var SUPPORTING_RELATIVE_ADVANTAGE = 0.10;
  var MATERIAL_SUPERIORITY = 0.65;
  var SUPPORTING_SUPERIORITY = 0.55;
  var ELITE_PERCENTILE = 0.80;
  var EXCEPTIONAL_PERCENTILE = 0.90;
  var EV_NEAR_TIE = 0.05;
  var EV_SAFETY_LIMIT = 0.20;
  // The analytical approximation guard already treats two percentage points as
  // numerically uncertain.  Use that same uncertainty on both sides of the EV
  // safety transition so conflicting EV/upside signals cannot reverse at one
  // floating-point cutoff.
  var EV_SAFETY_UNCERTAINTY = APPROXIMATION_GUARD;
  var EV_SAFETY_LOWER = EV_SAFETY_LIMIT - EV_SAFETY_UNCERTAINTY;
  var EV_SAFETY_UPPER = EV_SAFETY_LIMIT + EV_SAFETY_UNCERTAINTY;
  var P80_STRONG_GAP = 0.10;
  var PROBABILITY_TOLERANCE = 0.01;
  var UTILITY_TOLERANCE = 0.01;
  var EXCESS_RELATIVE_TOLERANCE = 0.05;

  function finite(value) { return typeof value === "number" && Number.isFinite(value); }
  function failure(code, reason) { return { ok: false, available: false, decision: "UNAVAILABLE", code: code, reason: reason }; }

  function validate(options) {
    if (!options || !Array.isArray(options.rewardLevels) || options.rewardLevels.length < 7) return failure("INVALID_REWARD_LEVELS", "Seven imported Bell reward levels are required.");
    if (!options.rewardLevels.slice(0, 7).every(function (value) { return finite(value) && value >= 0; })) return failure("INVALID_REWARD_LEVELS", "Seven finite nonnegative Bell reward levels are required.");
    if (!Number.isInteger(options.selectedRewardIndex) || options.selectedRewardIndex < 0 || options.selectedRewardIndex > 6) return failure("INVALID_REWARD", "A Bell reward index from 0 through 6 is required.");
    if (!Number.isInteger(options.currentRawRingIndex) || options.currentRawRingIndex < 0 || !finite(options.currentRingingExp) || options.currentRingingExp < 0) return failure("INVALID_RINGING_STATE", "The imported Ringing state is unavailable or malformed.");
    if (!finite(options.currentRenewalCurrency) || options.currentRenewalCurrency < 0) return failure("INVALID_RENEWAL_CURRENCY", "Current Renewal currency is unavailable or malformed.");
    return null;
  }

  function summarize(projection) {
    return {
      startingRewardLevel: projection.startingRewardLevel,
      expectedEndingLevel: projection.expectedFinalRewardLevel,
      medianEndingLevel: projection.medianFinalRewardLevel,
      likelyRange: { p25: projection.p25, p75: projection.p75 },
      broaderRange: { p10: projection.p10, p90: projection.p90 },
      timeToTaperHours: projection.timeUntilTaperHours,
      remainingBellRolls: projection.futureRings,
      remainingMajorPayouts: projection.futureMajorPayouts,
      startingRawRingIndex: projection.currentRawRingIndex,
      taperRawRingIndex: projection.taperRawRingIndex,
      calculationMode: projection.calculationMode,
      approximate: projection.approximate
    };
  }

  function relativeExpectedAdvantage(currentMean, freshMean) {
    if (!finite(currentMean) || !finite(freshMean)) return null;
    var difference = Math.abs(currentMean - freshMean);
    if (difference === 0) return 0;
    return difference / Math.max(1, Math.min(Math.abs(currentMean), Math.abs(freshMean)));
  }

  function normalPdf(value) { return Math.exp(-0.5 * value * value) / Math.sqrt(2 * Math.PI); }
  function expectedRegret(comparison) {
    if (!comparison || !finite(comparison.expectedFinishDifference)) return { available: false, regretIfKeep: null, regretIfRenew: null, method: "UNAVAILABLE" };
    if (Array.isArray(comparison.differenceDistribution)) {
      var keep = 0, renew = 0;
      comparison.differenceDistribution.forEach(function (entry) {
        if (entry.difference < 0) keep += -entry.difference * entry.probability;
        else if (entry.difference > 0) renew += entry.difference * entry.probability;
      });
      return { available: true, regretIfKeep: keep, regretIfRenew: renew, method: "EXACT_ANALYTICAL" };
    }
    var mean = comparison.expectedFinishDifference, variance = comparison.differenceVariance;
    if (!finite(variance) || variance < 0) return { available: false, regretIfKeep: null, regretIfRenew: null, method: "UNAVAILABLE" };
    if (variance <= 1e-12) return { available: true, regretIfKeep: Math.max(-mean, 0), regretIfRenew: Math.max(mean, 0), method: "DETERMINISTIC" };
    var sigma = Math.sqrt(variance), z = mean / sigma, cdf = BellOptimizer.targetEvaluator.normalCdf;
    var positive = sigma * normalPdf(z) + mean * cdf(z);
    var negative = sigma * normalPdf(z) - mean * cdf(-z);
    return { available: true, regretIfKeep: Math.max(0, negative), regretIfRenew: Math.max(0, positive), method: "ANALYTICAL_APPROXIMATION" };
  }

  function inverseNormalCdf(probability) {
    var low = -10, high = 10;
    for (var index = 0; index < 70; index += 1) {
      var middle = (low + high) / 2;
      if (BellOptimizer.targetEvaluator.normalCdf(middle) < probability) low = middle; else high = middle;
    }
    return (low + high) / 2;
  }

  function pathQuantile(path, probability) {
    if (path.distribution) {
      var cumulative = 0;
      for (var gain = 0; gain < path.distribution.length; gain += 1) {
        cumulative += path.distribution[gain];
        if (cumulative + 1e-14 >= probability) return path.startingRewardLevel + gain;
      }
      return path.startingRewardLevel + path.distribution.length - 1;
    }
    if (path.variance <= 1e-12) return path.expectedFinalRewardLevel;
    return path.expectedFinalRewardLevel + inverseNormalCdf(probability) * Math.sqrt(path.variance);
  }

  function pathCdf(path, value) {
    return BellOptimizer.bellRunForecast.pathCdf(path, value);
  }

  function exceedanceAndExcess(path, threshold) {
    if (path.distribution) {
      var probability = 0, excess = 0;
      path.distribution.forEach(function (chance, gain) {
        var value = path.startingRewardLevel + gain;
        if (value >= threshold) probability += chance;
        if (value > threshold) excess += (value - threshold) * chance;
      });
      return { probability: Math.max(0, Math.min(1, probability)), expectedExcess: Math.max(0, excess) };
    }
    if (path.variance <= 1e-12) return { probability: path.expectedFinalRewardLevel >= threshold ? 1 : 0, expectedExcess: Math.max(0, path.expectedFinalRewardLevel - threshold) };
    var deviation = Math.sqrt(path.variance), z = (threshold - path.expectedFinalRewardLevel) / deviation;
    var probabilityAbove = 1 - BellOptimizer.targetEvaluator.normalCdf(z);
    return { probability: Math.max(0, Math.min(1, probabilityAbove)), expectedExcess: Math.max(0, deviation * normalPdf(z) + (path.expectedFinalRewardLevel - threshold) * probabilityAbove) };
  }

  function quarticPercentileUtility(path, fresh) {
    if (path.distribution) {
      var utility = 0;
      path.distribution.forEach(function (chance, gain) {
        var percentile = pathCdf(fresh, path.startingRewardLevel + gain);
        utility += chance * Math.pow(percentile, 4);
      });
      return Math.max(0, Math.min(1, utility));
    }
    if (path === fresh && !fresh.distribution) return 0.2;
    if (path.variance <= 1e-12) return Math.pow(pathCdf(fresh, path.expectedFinalRewardLevel), 4);
    var samples = 128, total = 0, deviation = Math.sqrt(path.variance);
    for (var index = 0; index < samples; index += 1) {
      var probability = (index + 0.5) / samples;
      var value = path.expectedFinalRewardLevel + inverseNormalCdf(probability) * deviation;
      total += Math.pow(pathCdf(fresh, value), 4);
    }
    return Math.max(0, Math.min(1, total / samples));
  }

  function metricDirection(current, fresh, tolerance) {
    if (current > fresh + tolerance) return "KEEP";
    if (fresh > current + tolerance) return "RENEW";
    return "EVEN";
  }

  function eliteUpside(current, fresh) {
    var p80 = pathQuantile(fresh, ELITE_PERCENTILE), p90 = pathQuantile(fresh, EXCEPTIONAL_PERCENTILE);
    var currentP80 = exceedanceAndExcess(current, p80), freshP80 = exceedanceAndExcess(fresh, p80);
    var currentP90 = exceedanceAndExcess(current, p90), freshP90 = exceedanceAndExcess(fresh, p90);
    var currentUtility = quarticPercentileUtility(current, fresh), freshUtility = quarticPercentileUtility(fresh, fresh);
    var probabilityDirection = metricDirection(currentP80.probability, freshP80.probability, PROBABILITY_TOLERANCE);
    var excessTolerance = Math.max(1, Math.min(currentP80.expectedExcess, freshP80.expectedExcess) * EXCESS_RELATIVE_TOLERANCE);
    var excessDirection = metricDirection(currentP80.expectedExcess, freshP80.expectedExcess, excessTolerance);
    var utilityDirection = metricDirection(currentUtility, freshUtility, UTILITY_TOLERANCE);
    var votes = { KEEP: 0, RENEW: 0, EVEN: 0 };
    [probabilityDirection, excessDirection, utilityDirection].forEach(function (direction) { votes[direction] += 1; });
    var direction = votes.KEEP >= 2 ? "KEEP" : votes.RENEW >= 2 ? "RENEW" : "EVEN";
    var consensus = direction === "EVEN" ? "NO_CONSENSUS" : votes[direction] === 3 ? "UNANIMOUS" : "MAJORITY";
    return {
      freshP80Level: p80, freshP90Level: p90,
      currentP80Probability: currentP80.probability, freshP80Probability: freshP80.probability,
      currentP90Probability: currentP90.probability, freshP90Probability: freshP90.probability,
      currentExpectedExcessP80: currentP80.expectedExcess, freshExpectedExcessP80: freshP80.expectedExcess,
      currentQuarticUtility: currentUtility, freshQuarticUtility: freshUtility,
      probabilityDirection: probabilityDirection, excessDirection: excessDirection, utilityDirection: utilityDirection,
      direction: direction, consensus: consensus, votes: votes,
      p80ProbabilityGap: Math.abs(currentP80.probability - freshP80.probability)
    };
  }

  function downgrade(decision) {
    return decision === "KEEP" ? "KEEP_FAVORED" : decision === "KEEP_FAVORED" ? "TOO_CLOSE" : decision === "RENEW" ? "RENEW_FAVORED" : decision === "RENEW_FAVORED" ? "TOO_CLOSE" : decision;
  }

  function classifyPolicy(input) {
    var difference = input.expectedFinishDifference, relative = input.relativeExpectedAdvantage, upside = input.upside;
    if (!finite(difference) || !finite(relative) || !upside) return { decision: "UNAVAILABLE", confidence: "UNAVAILABLE", rationale: "The EV and elite-upside comparison is unavailable." };
    var evDirection = Math.abs(difference) <= 1e-12 || relative < EV_NEAR_TIE ? "EVEN" : difference > 0 ? "KEEP" : "RENEW";
    var preservation = input.currentStartingLevel >= upside.freshP90Level ? "ALREADY_P90" : input.currentStartingLevel >= upside.freshP80Level ? "ALREADY_P80" : "NONE";
    var conflicting = upside.direction !== "EVEN" && evDirection !== "EVEN" && upside.direction !== evDirection;
    var safety = conflicting && relative > EV_SAFETY_UPPER + 1e-12 ? "BLOCKS_UPSIDE_OVERRIDE" : conflicting && relative >= EV_SAFETY_LOWER - 1e-12 ? "UNCERTAIN_TRANSITION" : "PASS";
    var decision, rationale;
    if (preservation === "ALREADY_P90") {
      decision = "KEEP";
      rationale = "The imported reward level has already reached the account-specific fresh P90 threshold, so its achieved elite result is preserved.";
    } else if (preservation === "ALREADY_P80") {
      decision = evDirection === "KEEP" || upside.direction === "KEEP" ? "KEEP" : "KEEP_FAVORED";
      rationale = "The imported reward level has already reached the account-specific fresh P80 threshold; renewal is blocked by elite preservation.";
    } else if (upside.direction === "EVEN") {
      decision = evDirection === "EVEN" ? "TOO_CLOSE" : relative >= EV_SAFETY_LIMIT ? (evDirection === "KEEP" ? "KEEP" : "RENEW") : (evDirection === "KEEP" ? "KEEP_FAVORED" : "RENEW_FAVORED");
      rationale = evDirection === "EVEN" ? "Neither expected value nor elite-upside metrics establish a clear direction." : "Elite-upside metrics do not agree, so expected value supplies only the supported decision strength.";
    } else if (evDirection === "EVEN") {
      decision = upside.consensus === "UNANIMOUS" && upside.p80ProbabilityGap >= P80_STRONG_GAP ? (upside.direction === "KEEP" ? "KEEP" : "RENEW") : (upside.direction === "KEEP" ? "KEEP_FAVORED" : "RENEW_FAVORED");
      rationale = "Expected finishes are near tied, so the account-relative elite-upside consensus determines the direction.";
    } else if (evDirection === upside.direction) {
      decision = upside.consensus === "UNANIMOUS" || relative >= EV_SAFETY_LIMIT ? (evDirection === "KEEP" ? "KEEP" : "RENEW") : (evDirection === "KEEP" ? "KEEP_FAVORED" : "RENEW_FAVORED");
      rationale = "Expected value and elite-upside metrics favor the same path.";
    } else if (safety === "UNCERTAIN_TRANSITION") {
      decision = "TOO_CLOSE";
      rationale = "Expected value and elite upside conflict inside the EV-safety uncertainty region, so neither direction is promoted.";
    } else if (safety === "BLOCKS_UPSIDE_OVERRIDE") {
      decision = evDirection === "KEEP" ? "KEEP" : "RENEW";
      rationale = "The opposing upside signal fails the 20% expected-value safety floor, preventing a lottery-tail override.";
    } else if (upside.consensus === "UNANIMOUS") {
      decision = upside.p80ProbabilityGap >= P80_STRONG_GAP ? (upside.direction === "KEEP" ? "KEEP" : "RENEW") : (upside.direction === "KEEP" ? "KEEP_FAVORED" : "RENEW_FAVORED");
      rationale = "All elite-upside metrics favor the opposite path, and its expected value remains within the 20% safety floor.";
    } else {
      decision = "TOO_CLOSE";
      rationale = "Expected value and elite upside conflict without unanimous upside evidence.";
    }
    var nearBoundary = Math.abs(relative - EV_NEAR_TIE) <= APPROXIMATION_GUARD || Math.abs(relative - EV_SAFETY_LOWER) <= APPROXIMATION_GUARD || Math.abs(relative - EV_SAFETY_UPPER) <= APPROXIMATION_GUARD || Math.abs(upside.p80ProbabilityGap - P80_STRONG_GAP) <= APPROXIMATION_GUARD;
    var guarded = Boolean(input.approximate && preservation === "NONE" && nearBoundary && decision !== "TOO_CLOSE");
    if (guarded) { decision = downgrade(decision); rationale += " Approximation uncertainty crosses a policy boundary, so confidence is downgraded."; }
    return {
      decision: decision, expectedDirection: evDirection, elitePreservation: preservation, evSafetyStatus: safety,
      upsideDirection: upside.direction, upsideConsensus: upside.consensus, approximationGuardApplied: guarded,
      overlapClassification: decision === "TOO_CLOSE" ? "NO_MEANINGFUL_MODELED_ADVANTAGE" : decision.indexOf("KEEP") === 0 ? "CURRENT_OUTCOME_FAVORED" : "FRESH_OUTCOME_FAVORED",
      confidence: input.approximate ? (guarded ? "APPROXIMATE_THRESHOLD_GUARDED" : "ANALYTICAL_APPROXIMATION") : "EXACT_ANALYTICAL",
      rationale: rationale
    };
  }

  function evaluate(options) {
    options = options || {};
    var invalid = validate(options);
    if (invalid) return invalid;
    var forecast = BellOptimizer.bellRunForecast;
    if (!forecast) return failure("FORECAST_UNAVAILABLE", "Bell Run Forecast is unavailable.");

    var currentLevel = options.rewardLevels[options.selectedRewardIndex];
    var currentTaper = forecast.findRingingTaperBoundary(options);
    if (!currentTaper.ok) return failure(currentTaper.code, currentTaper.reason);
    var current = forecast.projectRewardToTaper(Object.assign({}, options, { currentRewardLevel: currentLevel, taper: currentTaper }));
    if (!current.ok) return failure(current.code, current.reason);

    var fresh = forecast.buildFreshTaperBaseline(options);
    if (!fresh.ok) return failure(fresh.code, fresh.reason);
    var comparison = forecast.compareProjectedFinishDistributions(current, fresh);
    if (!comparison.ok) return failure(comparison.code, comparison.reason);
    comparison.relativeExpectedAdvantage = relativeExpectedAdvantage(current.expectedFinalRewardLevel, fresh.expectedFinalRewardLevel);
    comparison.differenceVariance = current.variance + fresh.variance;
    var upside = eliteUpside(current, fresh);
    var classification = classifyPolicy({ expectedFinishDifference: comparison.expectedFinishDifference, relativeExpectedAdvantage: comparison.relativeExpectedAdvantage, currentStartingLevel: current.startingRewardLevel, upside: upside, approximate: comparison.approximate || current.approximate || fresh.approximate });
    var regret = expectedRegret(comparison);
    var affordable = options.currentRenewalCurrency >= RENEWAL_COST;

    return {
      ok: true,
      available: true,
      modelVersion: MODEL_VERSION,
      objective: "Finish the imported current run versus replace it with one complete fresh run.",
      selectedRewardIndex: options.selectedRewardIndex,
      selectedRewardName: BellOptimizer.BELL_REWARDS[options.selectedRewardIndex].name,
      decision: classification.decision,
      mathematicalPreference: classification.decision,
      confidence: classification.confidence,
      overlapClassification: classification.overlapClassification,
      elitePreservation: classification.elitePreservation,
      evSafetyStatus: classification.evSafetyStatus,
      upsideDirection: classification.upsideDirection,
      upsideConsensus: classification.upsideConsensus,
      expectedDirection: classification.expectedDirection,
      approximationGuardApplied: classification.approximationGuardApplied,
      decisionRule: DECISION_RULE,
      currentRun: summarize(current),
      freshReplacement: summarize(fresh),
      comparison: {
        expectedAdvantageCurrentMinusFresh: comparison.expectedFinishDifference,
        absoluteExpectedAdvantage: Math.abs(comparison.expectedFinishDifference),
        relativeExpectedAdvantage: comparison.relativeExpectedAdvantage,
        probabilityCurrentBeatsFresh: comparison.currentWinProbability,
        probabilityFreshBeatsCurrent: comparison.freshWinProbability,
        probabilityTie: comparison.tieProbability,
        differenceLikelyRange: { p25: comparison.differenceP25, p75: comparison.differenceP75 },
        differenceBroaderRange: { p10: comparison.differenceP10, p90: comparison.differenceP90 },
        calculationMode: comparison.calculationMode,
        approximate: comparison.approximate
        ,expectedRegretIfKeep: regret.regretIfKeep
        ,expectedRegretIfRenew: regret.regretIfRenew
        ,expectedRegretMethod: regret.method
        ,classificationRationale: classification.rationale
        ,eliteUpside: upside
      },
      renewal: {
        renewalCost: RENEWAL_COST,
        currentRenewalCurrency: options.currentRenewalCurrency,
        affordableNow: affordable,
        canPerformPreferredActionNow: classification.decision.indexOf("RENEW") !== 0 || affordable
      },
      assumptions: {
        futureRenewalsModeled: false,
        futureLanternsModeled: false,
        currentBranchEndpoint: "The imported run's own verified Bell taper boundary.",
        freshBranchEndpoint: "A fresh reset run's own verified Bell taper boundary."
      }
    };
  }

  return { MODEL_VERSION: MODEL_VERSION, DECISION_RULE: DECISION_RULE, RENEWAL_COST: RENEWAL_COST, STRONG_THRESHOLD: STRONG_THRESHOLD, DIRECTIONAL_THRESHOLD: DIRECTIONAL_THRESHOLD, APPROXIMATION_GUARD: APPROXIMATION_GUARD, ELITE_PERCENTILE: ELITE_PERCENTILE, EXCEPTIONAL_PERCENTILE: EXCEPTIONAL_PERCENTILE, EV_NEAR_TIE: EV_NEAR_TIE, EV_SAFETY_LIMIT: EV_SAFETY_LIMIT, EV_SAFETY_LOWER: EV_SAFETY_LOWER, EV_SAFETY_UPPER: EV_SAFETY_UPPER, evaluate: evaluate, _test: { classifyPolicy: classifyPolicy, relativeExpectedAdvantage: relativeExpectedAdvantage, expectedRegret: expectedRegret, eliteUpside: eliteUpside, exceedanceAndExcess: exceedanceAndExcess, quarticPercentileUtility: quarticPercentileUtility } };
}());
