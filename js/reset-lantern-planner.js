"use strict";
window.BellOptimizer = window.BellOptimizer || {};

BellOptimizer.resetLanternPlanner = (function () {
  var CONFIDENCES = [0.5, 0.75, 0.9, 0.95];

  function cumulativeChance(probability, runs) {
    if (!Number.isFinite(probability) || probability <= 0 || runs <= 0) return 0;
    if (probability >= 1) return 1;
    return Math.max(0, Math.min(1, -Math.expm1(runs * Math.log1p(-probability))));
  }

  function runsForConfidence(probability, confidence) {
    if (!Number.isFinite(probability) || probability <= 0) return Infinity;
    if (probability >= 1) return 1;
    if (!Number.isFinite(confidence) || confidence <= 0) return 0;
    if (confidence >= 1) return Infinity;
    var runs = Math.ceil(Math.log1p(-confidence) / Math.log1p(-probability));
    return Math.max(1, runs);
  }

  function classifyPracticality(attemptsFor50) {
    if (!Number.isFinite(attemptsFor50) || attemptsFor50 > 1000) return "Not realistically farmable";
    if (attemptsFor50 <= 10) return "Practical";
    if (attemptsFor50 <= 100) return "Expensive";
    return "Extreme";
  }

  function formatWaitTime(hours) {
    if (!Number.isFinite(hours)) return "No generation rate";
    if (hours <= 0) return "Available now";
    if (hours < 48) {
      var wholeHours = Math.floor(hours), minutes = Math.round((hours - wholeHours) * 60);
      if (minutes === 60) { wholeHours += 1; minutes = 0; }
      return wholeHours + (wholeHours === 1 ? " hour" : " hours") + (minutes ? " " + minutes + (minutes === 1 ? " minute" : " minutes") : "");
    }
    var days = hours / 24;
    if (days < 60) { var wholeDays = Math.floor(days), extraHours = Math.round((days - wholeDays) * 24); return wholeDays + (wholeDays === 1 ? " day" : " days") + (extraHours ? " " + extraHours + (extraHours === 1 ? " hour" : " hours") : ""); }
    var months = days / 30.4375;
    if (months < 24) { var wholeMonths = Math.floor(months), extraDays = Math.round(days - wholeMonths * 30.4375); return wholeMonths + (wholeMonths === 1 ? " month" : " months") + (extraDays ? " " + extraDays + (extraDays === 1 ? " day" : " days") : ""); }
    var years = days / 365.25, wholeYears = Math.round(years);
    if (years >= 10) return "about " + wholeYears.toLocaleString() + " years";
    var floorYears = Math.floor(years), extraMonths = Math.round((years - floorYears) * 12);
    return floorYears + (floorYears === 1 ? " year" : " years") + (extraMonths ? " " + extraMonths + (extraMonths === 1 ? " month" : " months") : "");
  }

  function calculateResourcePlan(probability, currentCurrency, currencyPerHour, renewalCost, lanternDurationHours) {
    if (![currentCurrency, currencyPerHour, renewalCost, lanternDurationHours].every(function (value) { return typeof value === "number" && Number.isFinite(value) && value >= 0; }) || renewalCost <= 0 || lanternDurationHours <= 0) return { ok: false, error: "Renewal values, cost, and Lantern duration must be finite and nonnegative; cost and duration must be greater than zero." };
    var affordableRunsNow = Math.floor(currentCurrency / renewalCost);
    var tiers = CONFIDENCES.map(function (confidence) {
      var requiredRuns = runsForConfidence(probability, confidence);
      var renewalCurrencyRequired = Number.isFinite(requiredRuns) ? requiredRuns * renewalCost : Infinity;
      var additionalCurrencyNeeded = Number.isFinite(renewalCurrencyRequired) ? Math.max(0, renewalCurrencyRequired - currentCurrency) : Infinity;
      var renewalGenerationHours = additionalCurrencyNeeded === 0 ? 0 : currencyPerHour > 0 ? additionalCurrencyNeeded / currencyPerHour : Infinity;
      return { confidence: confidence, requiredRuns: requiredRuns, cumulativeChance: Number.isFinite(requiredRuns) ? cumulativeChance(probability, requiredRuns) : 0, lanternUsesRequired: requiredRuns, totalLanternHours: Number.isFinite(requiredRuns) ? requiredRuns * lanternDurationHours : Infinity, renewalCurrencyRequired: renewalCurrencyRequired, additionalCurrencyNeeded: additionalCurrencyNeeded, renewalGenerationHours: renewalGenerationHours, affordableNow: Number.isFinite(requiredRuns) && affordableRunsNow >= requiredRuns };
    });
    return { ok: true, probability: probability, expectedRuns: probability > 0 ? 1 / probability : Infinity, affordableRunsNow: affordableRunsNow, maximumCurrentCumulativeChance: cumulativeChance(probability, affordableRunsNow), renewalCost: renewalCost, lanternDurationHours: lanternDurationHours, practicality: classifyPracticality(tiers[0].requiredRuns), tiers: tiers };
  }

  function evaluateFreshRun(options) {
    var progression = BellOptimizer.bellMechanics.advanceRingingProgress({ startingRawRingIndex: 0, startingRingingExp: 0, ringingExpPerHour: options.ringingExpPerHour, durationHours: options.lanternDurationHours });
    if (!progression.ok) return progression;
    var evaluation = BellOptimizer.targetEvaluator.evaluateTarget({ currentLevel: 0, currentRing: 0, targetLevel: options.targetLevel, targetRing: progression.endingHumanRing, selectionProbability: options.selectionProbability, ordinaryGainDistribution: options.ordinaryGainDistribution, majorGainDistribution: options.majorGainDistribution, expectedOrdinaryRingGain: options.expectedOrdinaryRingGain, expectedMajorRingGain: options.expectedMajorRingGain });
    if (!evaluation.ok) return evaluation;
    var resources = calculateResourcePlan(evaluation.probabilityOfTarget, options.currentRenewalCurrency, options.renewalCurrencyPerHour, options.renewalCost, options.lanternDurationHours);
    if (!resources.ok) return resources;
    return { ok: true, progression: progression, evaluation: evaluation, resources: resources, successProbabilityPerFreshRun: evaluation.probabilityOfTarget };
  }

  return { CONFIDENCES: CONFIDENCES, cumulativeChance: cumulativeChance, runsForConfidence: runsForConfidence, classifyPracticality: classifyPracticality, formatWaitTime: formatWaitTime, calculateResourcePlan: calculateResourcePlan, evaluateFreshRun: evaluateFreshRun };
}());
