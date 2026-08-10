"use strict";
window.BellOptimizer = window.BellOptimizer || {};

BellOptimizer.automaticRunEvaluation = (function () {
  var MODEL_VERSION = "automatic-run-decision-v1";
  var DEFAULT_OUTLOOK_HOURS = 48;
  var EPSILON = 1e-12;
  var POLICY = Object.freeze({
    continueSuperiority: 0.60,
    continueEffect: 0.20,
    resetSuperiority: 2 / 3,
    resetEffect: 0.25,
    degenerateMinimumAdvantage: 1,
    nearThresholdTolerance: 0.02
  });

  function clampProbability(value) { return Math.max(0, Math.min(1, value)); }
  function finite(value) { return typeof value === "number" && Number.isFinite(value); }
  function normalCdf(value) { return BellOptimizer.targetEvaluator.normalCdf(value); }

  function inverseNormalCdf(probability) {
    var low = -9, high = 9;
    for (var iteration = 0; iteration < 80; iteration += 1) {
      var middle = (low + high) / 2;
      if (normalCdf(middle) < probability) low = middle; else high = middle;
    }
    return (low + high) / 2;
  }

  function distributionVariance(probabilities, mean) {
    var variance = 0;
    for (var index = 0; index < probabilities.length; index += 1) {
      var difference = index - mean;
      variance += difference * difference * probabilities[index];
    }
    return Math.max(0, variance);
  }

  function quantileAdditional(probabilities, percentile) {
    var cumulative = 0;
    for (var index = 0; index < probabilities.length; index += 1) {
      cumulative += probabilities[index];
      if (cumulative + 1e-14 >= percentile) return index;
    }
    return probabilities.length - 1;
  }

  function approximateQuantile(mean, variance, probability, minimum) {
    if (variance <= EPSILON) return Math.max(minimum, Math.round(mean));
    return Math.max(minimum, Math.floor(mean + inverseNormalCdf(probability) * Math.sqrt(variance) + 0.5));
  }

  function buildPathProjection(options, kind) {
    var isContinue = kind === "continue";
    var startingRawRingIndex = isContinue ? options.currentRawRingIndex : 0;
    var startingRingingExp = isContinue ? options.currentRingingExp : 0;
    var startingRewardLevel = isContinue ? options.currentRewardLevel : 0;
    var durationHours = options.durationHours === undefined ? DEFAULT_OUTLOOK_HOURS : options.durationHours;
    var progression = BellOptimizer.bellMechanics.advanceRingingProgress({
      startingRawRingIndex: startingRawRingIndex,
      startingRingingExp: startingRingingExp,
      ringingExpPerHour: options.ringingExpPerHour,
      durationHours: durationHours
    });
    if (!progression.ok) return progression;
    var currentRing = startingRawRingIndex + 1;
    var targetRing = progression.endingHumanRing;
    var distributionOptions = {
      currentRing: currentRing,
      targetRing: targetRing,
      selectionProbability: options.selectionProbability,
      ordinaryGainDistribution: options.ordinaryGainDistribution,
      majorGainDistribution: options.majorGainDistribution,
      expectedOrdinaryRingGain: options.expectedOrdinaryRingGain,
      expectedMajorRingGain: options.expectedMajorRingGain
    };
    var additional = BellOptimizer.targetEvaluator.calculateAdditionalLevelDistribution(distributionOptions);
    var ordinaryCount = additional.ordinaryRingCount;
    var majorCount = additional.majorRingCount;
    var moments;
    var probabilities = null;
    var mode;
    if (additional.ok) {
      probabilities = additional.probabilities;
      var exactMean = BellOptimizer.targetEvaluator.expectedFromDistribution(probabilities);
      moments = { mean: exactMean, variance: distributionVariance(probabilities, exactMean) };
      mode = "Exact analytical";
    } else if (additional.code === "COMPUTATION_LIMIT") {
      moments = BellOptimizer.targetEvaluator.aggregateMoments(distributionOptions, ordinaryCount, majorCount);
      mode = "Analytical approximation";
    } else return additional;
    var quantile = function (p) {
      return startingRewardLevel + (probabilities ? quantileAdditional(probabilities, p) : approximateQuantile(moments.mean, moments.variance, p, 0));
    };
    var unavailable = options.selectionProbability === 0;
    return {
      ok: true,
      kind: kind,
      status: unavailable ? "LOCKED_REWARD_DETERMINISTIC" : moments.variance <= EPSILON ? "DETERMINISTIC" : "AVAILABLE",
      durationHours: durationHours,
      startingRewardLevel: startingRewardLevel,
      expectedAdditionalLevels: moments.mean,
      expectedFinalRewardLevel: startingRewardLevel + moments.mean,
      variance: moments.variance,
      median: quantile(0.50), p10: quantile(0.10), p25: quantile(0.25), p75: quantile(0.75), p90: quantile(0.90),
      calculationMode: mode,
      approximate: !probabilities,
      distribution: probabilities,
      modeledFutureRings: progression.ringsCompleted,
      modeledMajorPayouts: progression.majorRingsCrossed,
      startingRingingState: { rawRingIndex: startingRawRingIndex, humanRing: startingRawRingIndex + 1, ringingExp: startingRingingExp },
      endingRingingState: { rawRingIndex: progression.endingRawRing, humanRing: progression.endingHumanRing, ringingExp: progression.endingProgressExp, requirementExp: progression.endingRequirementExp },
      progression: progression
    };
  }

  function exactDifferenceDistribution(continuePath, resetPath) {
    var values = new Map();
    var offset = continuePath.startingRewardLevel - resetPath.startingRewardLevel;
    continuePath.distribution.forEach(function (continueProbability, continueGain) {
      if (!continueProbability) return;
      resetPath.distribution.forEach(function (resetProbability, resetGain) {
        if (!resetProbability) return;
        var difference = offset + continueGain - resetGain;
        values.set(difference, (values.get(difference) || 0) + continueProbability * resetProbability);
      });
    });
    return Array.from(values.entries()).map(function (entry) { return { difference: entry[0], probability: entry[1] }; }).sort(function (a, b) { return a.difference - b.difference; });
  }

  function differenceQuantile(distribution, probability) {
    var cumulative = 0;
    for (var index = 0; index < distribution.length; index += 1) {
      cumulative += distribution[index].probability;
      if (cumulative + 1e-14 >= probability) return distribution[index].difference;
    }
    return distribution[distribution.length - 1].difference;
  }

  function exactOverlap(continuePath, resetPath) {
    var continueMap = new Map();
    var resetMap = new Map();
    continuePath.distribution.forEach(function (p, gain) { if (p) continueMap.set(continuePath.startingRewardLevel + gain, p); });
    resetPath.distribution.forEach(function (p, gain) { if (p) resetMap.set(resetPath.startingRewardLevel + gain, p); });
    var overlap = 0;
    continueMap.forEach(function (probability, value) { overlap += Math.min(probability, resetMap.get(value) || 0); });
    return clampProbability(overlap);
  }

  function practicalEffect(continuePath, resetPath, expectedDifference) {
    var continueIQR = Math.max(0, continuePath.p75 - continuePath.p25);
    var resetIQR = Math.max(0, resetPath.p75 - resetPath.p25);
    // Root-mean-square IQR treats both independent path spreads symmetrically.
    var pooledIQR = Math.sqrt((continueIQR * continueIQR + resetIQR * resetIQR) / 2);
    if (pooledIQR <= EPSILON) return { continueIQR: continueIQR, resetIQR: resetIQR, pooledIQR: 0, expectedDifferenceAsPooledIQR: null, effectStatus: "DEGENERATE_IQR" };
    return { continueIQR: continueIQR, resetIQR: resetIQR, pooledIQR: pooledIQR, expectedDifferenceAsPooledIQR: expectedDifference / pooledIQR, effectStatus: "DEFINED" };
  }

  function compareFinalDistributions(continuePath, resetPath) {
    var expectedDifference = continuePath.expectedFinalRewardLevel - resetPath.expectedFinalRewardLevel;
    var denominator = Math.max(Math.abs(resetPath.expectedFinalRewardLevel), EPSILON);
    var relative = expectedDifference / denominator;
    var differenceVariance = continuePath.variance + resetPath.variance;
    var exact = Boolean(continuePath.distribution && resetPath.distribution);
    var continueWin = 0, resetWin = 0, tie = 0, quantiles, differenceDistribution = null, overlap = null;
    if (exact) {
      differenceDistribution = exactDifferenceDistribution(continuePath, resetPath);
      differenceDistribution.forEach(function (entry) {
        if (entry.difference > 0) continueWin += entry.probability;
        else if (entry.difference < 0) resetWin += entry.probability;
        else tie += entry.probability;
      });
      quantiles = { p10: differenceQuantile(differenceDistribution, .10), p25: differenceQuantile(differenceDistribution, .25), median: differenceQuantile(differenceDistribution, .50), p75: differenceQuantile(differenceDistribution, .75), p90: differenceQuantile(differenceDistribution, .90) };
      overlap = exactOverlap(continuePath, resetPath);
    } else if (differenceVariance <= EPSILON) {
      continueWin = expectedDifference > EPSILON ? 1 : 0;
      resetWin = expectedDifference < -EPSILON ? 1 : 0;
      tie = Math.abs(expectedDifference) <= EPSILON ? 1 : 0;
      quantiles = { p10: expectedDifference, p25: expectedDifference, median: expectedDifference, p75: expectedDifference, p90: expectedDifference };
    } else {
      var standardDeviation = Math.sqrt(differenceVariance);
      // Outcomes are integer levels: half-unit boundaries approximate D<0, D=0, D>0.
      resetWin = normalCdf((-0.5 - expectedDifference) / standardDeviation);
      continueWin = 1 - normalCdf((0.5 - expectedDifference) / standardDeviation);
      tie = Math.max(0, 1 - continueWin - resetWin);
      quantiles = { p10: expectedDifference + inverseNormalCdf(.10) * standardDeviation, p25: expectedDifference + inverseNormalCdf(.25) * standardDeviation, median: expectedDifference, p75: expectedDifference + inverseNormalCdf(.75) * standardDeviation, p90: expectedDifference + inverseNormalCdf(.90) * standardDeviation };
    }
    var effect = practicalEffect(continuePath, resetPath, expectedDifference);
    return Object.assign({
      expectedDifference: expectedDifference,
      relativeExpectedDifference: finite(relative) ? relative : null,
      variance: differenceVariance,
      continueWinProbability: clampProbability(continueWin),
      resetWinProbability: clampProbability(resetWin),
      tieProbability: clampProbability(tie),
      continueSuperiority: clampProbability(continueWin + tie / 2),
      resetSuperiority: clampProbability(resetWin + tie / 2),
      differenceMedian: quantiles.median, differenceP10: quantiles.p10, differenceP25: quantiles.p25, differenceP75: quantiles.p75, differenceP90: quantiles.p90,
      calculationMode: exact ? "Exact analytical" : "Analytical approximation",
      approximate: !exact,
      differenceDistribution: differenceDistribution,
      distributionOverlap: overlap
    }, effect);
  }

  function gradeFromPercentile(percentile, approximate, mechanicsStabilityWarning) {
    if (!finite(percentile) || percentile < 0 || percentile > 1) return { ok: false, gradeKey: "INSUFFICIENT_DATA", percentile: percentile, approximate: true };
    var gradeKey = percentile < .01 ? "ABSOLUTELY_COOKED" : percentile < .10 ? "COOKED" : percentile < .25 ? "WEAK_RUN" : percentile < .75 ? "TYPICAL_RUN" : percentile < .90 ? "STRONG_RUN" : percentile < .99 ? "EXCEPTIONAL_RUN" : "GOD_RUN";
    return { ok: true, gradeKey: gradeKey, label: gradeKey.replace(/_/g, " "), percentile: percentile, approximate: Boolean(approximate || mechanicsStabilityWarning), mechanicsStabilityWarning: Boolean(mechanicsStabilityWarning) };
  }

  function evaluateRunQualitySoFar(options) {
    var result = BellOptimizer.targetEvaluator.evaluateCurrentRun({ currentLevel: options.currentRewardLevel, currentRing: options.currentRawRingIndex + 1, selectionProbability: options.selectionProbability, ordinaryGainDistribution: options.ordinaryGainDistribution, majorGainDistribution: options.majorGainDistribution, expectedOrdinaryRingGain: options.expectedOrdinaryRingGain, expectedMajorRingGain: options.expectedMajorRingGain });
    var warning = options.mechanicsStableThroughoutRun !== true;
    return {
      importedCurrentLevel: result.currentLevel,
      expectedLevelAfterCompletedRings: result.expectedLevel,
      differenceFromExpected: result.difference,
      historicalPercentile: result.percentile,
      calculationMode: result.mode,
      approximate: result.mode !== "Exact analytical",
      mechanicsStabilityWarning: warning,
      completedModeledRings: options.currentRawRingIndex + 1,
      grade: gradeFromPercentile(result.percentile, result.mode !== "Exact analytical", warning)
    };
  }

  function automaticDecisionV1(comparison, renewalAffordable) {
    if (!comparison || !finite(comparison.expectedDifference)) return { recommendation: "EITHER_IS_REASONABLE", primaryReason: "INSUFFICIENT_DATA", supportingReasons: [], nearThreshold: false, modelVersion: MODEL_VERSION };
    var difference = comparison.expectedDifference;
    var degenerate = comparison.effectStatus === "DEGENERATE_IQR";
    var effect = comparison.expectedDifferenceAsPooledIQR;
    if (Math.abs(difference) <= EPSILON && comparison.tieProbability >= 1 - EPSILON) return { recommendation: "EITHER_IS_REASONABLE", primaryReason: "EXACT_TIE", supportingReasons: [], nearThreshold: false, modelVersion: MODEL_VERSION };
    var continueEffect = degenerate ? difference >= POLICY.degenerateMinimumAdvantage : effect >= POLICY.continueEffect;
    var resetEffect = degenerate ? -difference >= POLICY.degenerateMinimumAdvantage : -effect >= POLICY.resetEffect;
    var continuePass = comparison.continueSuperiority >= POLICY.continueSuperiority && difference > 0 && continueEffect;
    var resetMathPass = comparison.resetSuperiority >= POLICY.resetSuperiority && difference < 0 && resetEffect;
    var near = Math.abs(comparison.continueSuperiority - POLICY.continueSuperiority) <= POLICY.nearThresholdTolerance || Math.abs(comparison.resetSuperiority - POLICY.resetSuperiority) <= POLICY.nearThresholdTolerance || (!degenerate && (Math.abs(effect - POLICY.continueEffect) <= POLICY.nearThresholdTolerance || Math.abs(-effect - POLICY.resetEffect) <= POLICY.nearThresholdTolerance));
    if (continuePass) return { recommendation: "CONTINUE", primaryReason: degenerate ? "DETERMINISTIC_CONTINUE" : "CONTINUE_MEANINGFUL_ADVANTAGE", supportingReasons: comparison.approximate && near ? ["APPROXIMATE_BORDERLINE"] : [], nearThreshold: near, modelVersion: MODEL_VERSION };
    if (resetMathPass && !renewalAffordable) return { recommendation: "EITHER_IS_REASONABLE", primaryReason: "RESET_UNAFFORDABLE", supportingReasons: [degenerate ? "DETERMINISTIC_RESET" : "RESET_MEANINGFUL_ADVANTAGE"], nearThreshold: near, modelVersion: MODEL_VERSION };
    if (resetMathPass) return { recommendation: "RESET", primaryReason: degenerate ? "DETERMINISTIC_RESET" : "RESET_MEANINGFUL_ADVANTAGE", supportingReasons: comparison.approximate && near ? ["APPROXIMATE_BORDERLINE"] : [], nearThreshold: near, modelVersion: MODEL_VERSION };
    var effectTooSmall = degenerate ? Math.abs(difference) < POLICY.degenerateMinimumAdvantage : Math.abs(effect) < Math.min(POLICY.continueEffect, POLICY.resetEffect);
    var reason = Math.abs(difference) <= EPSILON ? "EXACT_TIE" : effectTooSmall ? "ADVANTAGE_TOO_SMALL" : comparison.distributionOverlap !== null && comparison.distributionOverlap > .60 ? "HEAVY_OVERLAP" : "SUPERIORITY_TOO_CLOSE";
    return { recommendation: "EITHER_IS_REASONABLE", primaryReason: reason, supportingReasons: comparison.approximate && near ? ["APPROXIMATE_BORDERLINE"] : [], nearThreshold: near, modelVersion: MODEL_VERSION };
  }

  function validateOptions(options) {
    if (!options || Object.prototype.hasOwnProperty.call(options, "targetLevel") || Object.prototype.hasOwnProperty.call(options, "targetRing")) return { ok: false, code: "TARGET_NOT_ACCEPTED", error: "Automatic run evaluation does not accept a target." };
    if (!Number.isInteger(options.selectedRewardIndex) || options.selectedRewardIndex < 0 || options.selectedRewardIndex > 6) return { ok: false, code: "INVALID_REWARD" };
    if (![options.currentRewardLevel, options.currentRawRingIndex, options.currentRingingExp].every(function (value) { return finite(value) && value >= 0; }) || !Number.isInteger(options.currentRawRingIndex)) return { ok: false, code: "INVALID_CURRENT_STATE" };
    if (!finite(options.ringingExpPerHour) || options.ringingExpPerHour <= 0 || !finite(options.selectionProbability) || options.selectionProbability < 0 || options.selectionProbability > 1) return { ok: false, code: "INVALID_MECHANICS" };
    return { ok: true };
  }

  function evaluate(options) {
    var validation = validateOptions(options);
    if (!validation.ok) return validation;
    var continuePath = buildPathProjection(options, "continue");
    var resetPath = buildPathProjection(options, "reset");
    if (!continuePath.ok || !resetPath.ok) return { ok: false, code: "PATH_EVALUATION_FAILED", error: (continuePath.ok ? resetPath : continuePath).error };
    var comparison = compareFinalDistributions(continuePath, resetPath);
    var qualitySoFar = evaluateRunQualitySoFar(options);
    var renewalAffordable = finite(options.currentRenewalCurrency) && options.currentRenewalCurrency >= 25;
    return { ok: true, modelVersion: MODEL_VERSION, selectedRewardIndex: options.selectedRewardIndex, durationHours: continuePath.durationHours, continuePath: continuePath, resetPath: resetPath, comparison: comparison, qualitySoFar: qualitySoFar, recommendation: automaticDecisionV1(comparison, renewalAffordable), renewalAffordable: renewalAffordable };
  }

  return {
    MODEL_VERSION: MODEL_VERSION,
    DEFAULT_OUTLOOK_HOURS: DEFAULT_OUTLOOK_HOURS,
    POLICY: POLICY,
    buildPathProjection: buildPathProjection,
    exactDifferenceDistribution: exactDifferenceDistribution,
    compareFinalDistributions: compareFinalDistributions,
    practicalEffect: practicalEffect,
    gradeFromPercentile: gradeFromPercentile,
    evaluateRunQualitySoFar: evaluateRunQualitySoFar,
    automaticDecisionV1: automaticDecisionV1,
    evaluate: evaluate
  };
}());
