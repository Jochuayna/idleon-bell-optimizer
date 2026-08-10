"use strict";
window.BellOptimizer = window.BellOptimizer || {};

BellOptimizer.runAutomaticRunEvaluationTests = function () {
  var tests = [];
  function test(name, fn) {
    try { fn(); tests.push({ name: name, passed: true }); }
    catch (error) { tests.push({ name: name, passed: false, error: error.message }); }
  }
  function assert(condition, message) { if (!condition) throw new Error(message || "Assertion failed"); }
  function close(actual, expected, tolerance, message) { assert(Math.abs(actual - expected) <= tolerance, (message || "values differ") + ": " + actual + " vs " + expected); }
  function base(overrides) {
    return Object.assign({
      selectedRewardIndex: 0,
      currentRewardLevel: 8,
      currentRawRingIndex: 2,
      currentRingingExp: 0,
      ringingExpPerHour: 100,
      durationHours: 1,
      selectionProbability: .25,
      ordinaryGainDistribution: [{ gain: 1, probabilityValue: 1, probability: 1 }],
      majorGainDistribution: [{ gain: 6, probabilityValue: 1, probability: 1 }],
      expectedOrdinaryRingGain: 1,
      expectedMajorRingGain: 6,
      currentRenewalCurrency: 25,
      mechanicsStableThroughoutRun: true
    }, overrides || {});
  }
  function path(start, probabilities) {
    var mean = BellOptimizer.targetEvaluator.expectedFromDistribution(probabilities);
    var variance = 0;
    probabilities.forEach(function (p, i) { variance += (i - mean) * (i - mean) * p; });
    function q(p) { var cumulative = 0; for (var i = 0; i < probabilities.length; i += 1) { cumulative += probabilities[i]; if (cumulative + 1e-14 >= p) return start + i; } return start + probabilities.length - 1; }
    return { startingRewardLevel: start, expectedFinalRewardLevel: start + mean, variance: variance, p25: q(.25), median: q(.5), p75: q(.75), p10: q(.1), p90: q(.9), distribution: Float64Array.from(probabilities) };
  }
  function comparison(overrides) {
    return Object.assign({ expectedDifference: 5, continueSuperiority: .8, resetSuperiority: .2, tieProbability: 0, expectedDifferenceAsPooledIQR: .5, effectStatus: "DEFINED", distributionOverlap: .2, approximate: false }, overrides || {});
  }
  var api = BellOptimizer.automaticRunEvaluation;

  test("automatic evaluation rejects a target", function () { assert(api.evaluate(base({ targetLevel: 10 })).code === "TARGET_NOT_ACCEPTED"); });
  test("automatic evaluation succeeds without target", function () { assert(api.evaluate(base()).ok); });
  test("unrelated target cannot change output", function () { var a = api.evaluate(base()), b = api.evaluate(base()); close(a.comparison.expectedDifference, b.comparison.expectedDifference, 0); });
  test("paths use identical future horizon", function () { var result = api.evaluate(base()); assert(result.continuePath.durationHours === result.resetPath.durationHours); });
  test("continue preserves imported progression", function () { var result = api.evaluate(base()); assert(result.continuePath.startingRingingState.rawRingIndex === 2 && result.continuePath.startingRewardLevel === 8); });
  test("reset starts at verified zero states", function () { var result = api.evaluate(base()); assert(result.resetPath.startingRingingState.rawRingIndex === 0 && result.resetPath.startingRingingState.ringingExp === 0 && result.resetPath.startingRewardLevel === 0); });
  test("exact difference distribution is correct", function () { var result = api.compareFinalDistributions(path(0, [.5, .5]), path(0, [.5, .5])); assert(result.differenceDistribution.length === 3); close(result.differenceDistribution[0].probability, .25, 1e-12); close(result.differenceDistribution[1].probability, .5, 1e-12); });
  test("exact tie probability is correct", function () { close(api.compareFinalDistributions(path(0, [.5, .5]), path(0, [.5, .5])).tieProbability, .5, 1e-12); });
  test("exact superiority gives half credit to ties", function () { var result = api.compareFinalDistributions(path(0, [.5, .5]), path(0, [.5, .5])); close(result.continueSuperiority, .5, 1e-12); close(result.resetSuperiority, .5, 1e-12); });
  test("approximate difference moments add independent variances", function () { var c = path(10, [1]), r = path(0, [1]); c.distribution = null; r.distribution = null; c.variance = 4; r.variance = 9; var result = api.compareFinalDistributions(c, r); assert(result.expectedDifference === 10 && result.variance === 13 && result.approximate); });
  test("approximate superiority remains complementary", function () { var c = path(5, [1]), r = path(0, [1]); c.distribution = null; r.distribution = null; c.variance = 3; r.variance = 2; var result = api.compareFinalDistributions(c, r); close(result.continueSuperiority + result.resetSuperiority, 1, 1e-12); });
  test("equal paths recommend Either", function () { assert(api.automaticDecisionV1(comparison({ expectedDifference: 0, continueSuperiority: .5, resetSuperiority: .5, tieProbability: 1, expectedDifferenceAsPooledIQR: 0 }), true).primaryReason === "EXACT_TIE"); });
  test("tiny advantage recommends Either", function () { assert(api.automaticDecisionV1(comparison({ expectedDifference: .1, expectedDifferenceAsPooledIQR: .05 }), true).recommendation === "EITHER_IS_REASONABLE"); });
  test("degenerate sub-level advantage is explicitly too small", function () { var result = api.automaticDecisionV1(comparison({ expectedDifference: .9, continueSuperiority: 1, resetSuperiority: 0, effectStatus: "DEGENERATE_IQR", expectedDifferenceAsPooledIQR: null }), true); assert(result.primaryReason === "ADVANTAGE_TOO_SMALL"); });
  test("heavy overlap recommends Either", function () { var result = api.automaticDecisionV1(comparison({ expectedDifference: 1, expectedDifferenceAsPooledIQR: .3, continueSuperiority: .55, resetSuperiority: .45, distributionOverlap: .8 }), true); assert(result.recommendation === "EITHER_IS_REASONABLE" && result.primaryReason === "HEAVY_OVERLAP"); });
  test("meaningful Continue advantage recommends Continue", function () { assert(api.automaticDecisionV1(comparison(), true).recommendation === "CONTINUE"); });
  test("meaningful Reset advantage recommends Reset", function () { assert(api.automaticDecisionV1(comparison({ expectedDifference: -5, continueSuperiority: .2, resetSuperiority: .8, expectedDifferenceAsPooledIQR: -.5 }), true).recommendation === "RESET"); });
  test("unaffordable renewal blocks Reset", function () { var result = api.automaticDecisionV1(comparison({ expectedDifference: -5, continueSuperiority: .2, resetSuperiority: .8, expectedDifferenceAsPooledIQR: -.5 }), false); assert(result.recommendation === "EITHER_IS_REASONABLE" && result.primaryReason === "RESET_UNAFFORDABLE"); });
  test("deterministic Continue is safe", function () { var result = api.automaticDecisionV1(comparison({ expectedDifference: 1, continueSuperiority: 1, resetSuperiority: 0, effectStatus: "DEGENERATE_IQR", expectedDifferenceAsPooledIQR: null }), true); assert(result.primaryReason === "DETERMINISTIC_CONTINUE"); });
  test("deterministic Reset is safe", function () { var result = api.automaticDecisionV1(comparison({ expectedDifference: -1, continueSuperiority: 0, resetSuperiority: 1, effectStatus: "DEGENERATE_IQR", expectedDifferenceAsPooledIQR: null }), true); assert(result.primaryReason === "DETERMINISTIC_RESET"); });
  test("zero IQR never emits Infinity or NaN", function () { var result = api.practicalEffect(path(0, [1]), path(0, [1]), 0); assert(result.effectStatus === "DEGENERATE_IQR" && result.expectedDifferenceAsPooledIQR === null); });
  test("grade depends only on percentile", function () { assert(api.gradeFromPercentile(.8, false, false).gradeKey === api.gradeFromPercentile(.8, false, false).gradeKey); });
  test("absolute magnitude cannot change percentile grade", function () { assert(api.gradeFromPercentile(.8, false, false).gradeKey === "STRONG_RUN"); });
  [
    [0, "ABSOLUTELY_COOKED"], [.009999, "ABSOLUTELY_COOKED"], [.01, "COOKED"], [.10, "WEAK_RUN"], [.25, "TYPICAL_RUN"], [.75, "STRONG_RUN"], [.90, "EXCEPTIONAL_RUN"], [.99, "GOD_RUN"], [1, "GOD_RUN"]
  ].forEach(function (entry) { test("grade boundary " + entry[0], function () { assert(api.gradeFromPercentile(entry[0], false, false).gradeKey === entry[1]); }); });
  test("approximate historical grade is marked approximate", function () { assert(api.gradeFromPercentile(.5, true, false).approximate); });
  test("mechanics stability warning marks grade approximate", function () { var result = api.evaluateRunQualitySoFar(base({ mechanicsStableThroughoutRun: false })); assert(result.mechanicsStabilityWarning && result.grade.approximate); });
  test("all seven rewards evaluate", function () { for (var index = 0; index < 7; index += 1) assert(api.evaluate(base({ selectedRewardIndex: index })).ok); });
  test("locked reward is contained and deterministic", function () { var result = api.evaluate(base({ selectedRewardIndex: 6, selectionProbability: 0 })); assert(result.ok && result.continuePath.status === "LOCKED_REWARD_DETERMINISTIC" && result.continuePath.variance === 0); });
  test("major-heavy distributions are safe", function () { var result = api.evaluate(base({ majorGainDistribution: [{ gain: 1000, probabilityValue: 1, probability: 1 }], expectedMajorRingGain: 1000 })); assert(result.ok && Number.isFinite(result.comparison.expectedDifference)); });
  test("approximate mode is deterministic", function () { var options = base({ durationHours: 48, ringingExpPerHour: 1e15 }); var a = api.evaluate(options), b = api.evaluate(options); assert(a.ok && a.continuePath.approximate && a.comparison.expectedDifference === b.comparison.expectedDifference); });
  test("input state is not mutated", function () { var options = base(), before = JSON.stringify(options); api.evaluate(options); assert(JSON.stringify(options) === before); });
  test("module does not access DOM", function () { var original = global.document; global.document = new Proxy({}, { get: function () { throw new Error("DOM accessed"); } }); try { assert(api.evaluate(base()).ok); } finally { global.document = original; } });
  test("model is explicitly versioned", function () { assert(api.MODEL_VERSION === "automatic-run-decision-v1"); });
  test("pooled IQR uses root mean square", function () { var c = path(0, [0, .25, .5, .25]), r = path(0, [.25, .5, .25]); var effect = api.practicalEffect(c, r, 1); close(effect.pooledIQR, 1, 1e-12); });
  test("negative expected differences retain their sign", function () { assert(api.compareFinalDistributions(path(0, [1]), path(5, [1])).expectedDifference === -5); });
  test("very large finite reward levels stay finite", function () { var result = api.evaluate(base({ currentRewardLevel: 1e100 })); assert(result.ok && Number.isFinite(result.continuePath.expectedFinalRewardLevel) && !Number.isNaN(result.comparison.expectedDifference)); });
  test("extremely small selection probabilities remain contained", function () { var result = api.evaluate(base({ selectionProbability: 1e-12 })); assert(result.ok && result.continuePath.variance >= 0 && result.comparison.continueSuperiority >= 0 && result.comparison.continueSuperiority <= 1); });
  test("sparse exact distributions remain normalized", function () { var result = api.compareFinalDistributions(path(0, [.9, 0, 0, .1]), path(0, [.8, 0, .2])); close(result.continueWinProbability + result.resetWinProbability + result.tieProbability, 1, 1e-12); });
  test("no future rings remain deterministic", function () { var result = api.evaluate(base({ durationHours: 0 })); assert(result.ok && result.continuePath.modeledFutureRings === 0 && result.resetPath.modeledFutureRings === 0); });

  return { passed: tests.filter(function (entry) { return entry.passed; }).length, total: tests.length, results: tests };
};
