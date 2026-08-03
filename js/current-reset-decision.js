"use strict";
window.BellOptimizer = window.BellOptimizer || {};

BellOptimizer.currentResetDecision = (function () {
  var RENEWAL_COST = 25;
  var DEFAULT_OUTLOOK_HOURS = 48;
  var RUN_QUALITY_THRESHOLDS = Object.freeze({ absoluteCooked: 0.0001, cooked: 0.0025, weak: 0.02, saveable: 0.15, strong: 0.50, exceptional: 0.90 });
  var COMPARISON_POLICY = Object.freeze({ meaningfulFeasibility: 0.02, eitherTolerance: 0.02 });
  var FEASIBILITY_THRESHOLDS = Object.freeze({ realistic: RUN_QUALITY_THRESHOLDS.saveable, possible: RUN_QUALITY_THRESHOLDS.weak, longShot: RUN_QUALITY_THRESHOLDS.absoluteCooked, p90ImpossibleRatio: 0.75, cookedP90Ratio: 0.5 });

  function classifyFeasibility(inputs) {
    if (inputs.currentLevel >= inputs.targetLevel) return "Reached";
    if (inputs.successProbability < FEASIBILITY_THRESHOLDS.longShot && inputs.p90FinalLevel < inputs.targetLevel * FEASIBILITY_THRESHOLDS.p90ImpossibleRatio) return "Effectively impossible";
    if (inputs.successProbability >= FEASIBILITY_THRESHOLDS.realistic) return "Realistic";
    if (inputs.successProbability >= FEASIBILITY_THRESHOLDS.possible) return "Possible";
    if (inputs.successProbability >= FEASIBILITY_THRESHOLDS.longShot) return "Long shot";
    return "Effectively impossible";
  }

  function objectiveQuality(inputs) {
    if (inputs.currentLevel >= inputs.targetLevel) return "GOD RUN";
    var probability = inputs.continueProbability;
    if (probability < RUN_QUALITY_THRESHOLDS.absoluteCooked) return "ABSOLUTELY COOKED";
    if (probability < RUN_QUALITY_THRESHOLDS.cooked) return "COOKED";
    if (probability < RUN_QUALITY_THRESHOLDS.weak) return "WEAK RUN";
    if (probability < RUN_QUALITY_THRESHOLDS.saveable) return "SAVEABLE RUN";
    if (probability < RUN_QUALITY_THRESHOLDS.strong) return "STRONG RUN";
    if (probability < RUN_QUALITY_THRESHOLDS.exceptional) return "EXCEPTIONAL RUN";
    return "GOD RUN";
  }

  function classifyComparison(inputs) {
    var current = inputs.continueProbability, reset = inputs.resetProbability;
    if (![current, reset].every(function (value) { return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1; })) return { ok: false, label: "COMPARISON UNAVAILABLE", explanation: "Both paths need a valid target probability before they can be compared." };
    var difference = current - reset;
    var continueFeasibility = classifyFeasibility({ currentLevel: inputs.currentLevel, targetLevel: inputs.targetLevel, successProbability: current, expectedFinalLevel: inputs.continueExpected, p90FinalLevel: inputs.continueP90 });
    var resetFeasibility = classifyFeasibility({ currentLevel: 0, targetLevel: inputs.targetLevel, successProbability: reset, expectedFinalLevel: inputs.resetExpected, p90FinalLevel: inputs.resetP90 });
    var quality = objectiveQuality({ continueProbability: current, currentLevel: inputs.currentLevel, targetLevel: inputs.targetLevel });
    var action, explanation;
    if (inputs.currentLevel >= inputs.targetLevel) { action = "Continue"; explanation = "Your goal is already reached, so continuing preserves this result."; }
    else if (current >= COMPARISON_POLICY.meaningfulFeasibility && reset >= COMPARISON_POLICY.meaningfulFeasibility && Math.abs(difference) <= COMPARISON_POLICY.eitherTolerance) { action = "Either is reasonable"; explanation = "Both paths have meaningful odds and are within the configured comparison tolerance."; }
    else if (reset > current) { action = "Reset"; explanation = "A fresh reset has the better chance of reaching your entered goal."; }
    else { action = "Continue"; explanation = "This run has the better chance of reaching your entered goal."; }
    if (action === "Reset" && inputs.affordableRenewals < 1) { action = "Continue"; explanation = "A fresh reset has better odds, but you do not currently have enough renewal currency."; }
    if (action === "Continue" && current < 0.01 && inputs.currentLevel < inputs.targetLevel) explanation = "This run is still better than resetting, but reaching the goal remains unlikely.";
    return { ok: true, label: quality, quality: quality, action: action, probabilityDifference: difference, continueFeasibility: continueFeasibility, resetFeasibility: resetFeasibility, explanation: explanation };
  }

  function evaluateDecision(options) {
    if (typeof options.ringingExpPerHour !== "number" || !Number.isFinite(options.ringingExpPerHour) || options.ringingExpPerHour <= 0) return { ok: false, error: "Enter a valid Bell EXP per hour before comparing the two paths." };
    var pathStarts = BellOptimizer.objectiveSelection.pathStartingLevels(options.currentRewardLevel);
    if (!pathStarts.ok) return pathStarts;
    var durationHours = options.durationHours === undefined ? DEFAULT_OUTLOOK_HOURS : options.durationHours;
    var continueProgress = BellOptimizer.bellMechanics.advanceRingingProgress({ startingRawRingIndex: options.currentRawRingIndex, startingRingingExp: options.currentRingingExp, ringingExpPerHour: options.ringingExpPerHour, durationHours: durationHours });
    var resetProgress = BellOptimizer.bellMechanics.advanceRingingProgress({ startingRawRingIndex: 0, startingRingingExp: 0, ringingExpPerHour: options.ringingExpPerHour, durationHours: durationHours });
    if (!continueProgress.ok || !resetProgress.ok) return { ok: false, error: (continueProgress.ok ? resetProgress : continueProgress).error };
    function evaluate(currentLevel, currentRing, targetRing) {
      return BellOptimizer.targetEvaluator.evaluateTarget({ currentLevel: currentLevel, currentRing: currentRing, targetLevel: options.targetLevel, targetRing: targetRing, selectionProbability: options.selectionProbability, ordinaryGainDistribution: options.ordinaryGainDistribution, majorGainDistribution: options.majorGainDistribution, expectedOrdinaryRingGain: options.expectedOrdinaryRingGain, expectedMajorRingGain: options.expectedMajorRingGain });
    }
    var continueEvaluation = evaluate(pathStarts.continueStartingLevel, options.currentHumanRing, continueProgress.endingHumanRing);
    var resetEvaluation = evaluate(pathStarts.freshStartingLevel, 0, resetProgress.endingHumanRing);
    if (!continueEvaluation.ok || !resetEvaluation.ok) return { ok: false, error: "One or both paths could not produce a valid probability." };
    if (!BellOptimizer.objectiveSelection.projectionPreservesStartingLevel(continueEvaluation, pathStarts.continueStartingLevel)) return { ok: false, error: "Current-path projection fell below its imported starting level." };
    var affordableRenewals = Math.floor(options.currentRenewalCurrency / RENEWAL_COST);
    var currentComparison = BellOptimizer.targetEvaluator.evaluateCurrentRun({ currentLevel: options.currentRewardLevel, currentRing: options.currentHumanRing, selectionProbability: options.selectionProbability, ordinaryGainDistribution: options.ordinaryGainDistribution, majorGainDistribution: options.majorGainDistribution, expectedOrdinaryRingGain: options.expectedOrdinaryRingGain, expectedMajorRingGain: options.expectedMajorRingGain });
    var recommendation = classifyComparison({ continueProbability: continueEvaluation.probabilityOfTarget, resetProbability: resetEvaluation.probabilityOfTarget, currentLevel: options.currentRewardLevel, targetLevel: options.targetLevel, continueExpected: continueEvaluation.expectedFinalLevel, resetExpected: resetEvaluation.expectedFinalLevel, continueP90: continueEvaluation.percentiles.p90, resetP90: resetEvaluation.percentiles.p90, affordableRenewals: affordableRenewals, currentPercentile: currentComparison.percentile });
    var additionalForOne = Math.max(0, RENEWAL_COST - options.currentRenewalCurrency);
    return { ok: true, durationHours: durationHours, selectedRewardIndex: options.selectedRewardIndex, currentStartingLevel: pathStarts.continueStartingLevel, freshStartingLevel: pathStarts.freshStartingLevel, continuePath: { progression: continueProgress, evaluation: continueEvaluation }, resetPath: { progression: resetProgress, evaluation: resetEvaluation }, recommendation: recommendation, currentRunQuality: recommendation.quality, affordableRenewals: affordableRenewals, renewalCost: RENEWAL_COST, additionalCurrencyForOne: additionalForOne, hoursUntilOneRenewal: additionalForOne === 0 ? 0 : options.renewalCurrencyPerHour > 0 ? additionalForOne / options.renewalCurrencyPerHour : Infinity, checkpointLanternUses: 1 };
  }

  return { RENEWAL_COST: RENEWAL_COST, DEFAULT_OUTLOOK_HOURS: DEFAULT_OUTLOOK_HOURS, RUN_QUALITY_THRESHOLDS: RUN_QUALITY_THRESHOLDS, COMPARISON_POLICY: COMPARISON_POLICY, FEASIBILITY_THRESHOLDS: FEASIBILITY_THRESHOLDS, classifyFeasibility: classifyFeasibility, objectiveQuality: objectiveQuality, classifyComparison: classifyComparison, evaluateDecision: evaluateDecision };
}());
