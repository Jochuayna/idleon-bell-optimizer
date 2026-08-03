"use strict";
window.BellOptimizer = window.BellOptimizer || {};

BellOptimizer.targetEvaluator = (function () {
  var MAX_FUTURE_RINGS = 500;
  var MAX_ADDITIONAL_LEVELS = 250000;

  function countFutureMajorRings(currentRing, targetRing) {
    return Math.floor(targetRing / 20) - Math.floor(currentRing / 20);
  }

  function buildSelectedRewardRingDistribution(gainDistribution, selectionProbability) {
    var outcomes = new Map();
    outcomes.set(0, 1 - selectionProbability);
    gainDistribution.forEach(function (entry) {
      var probability = selectionProbability * entry.probabilityValue;
      outcomes.set(entry.gain, (outcomes.get(entry.gain) || 0) + probability);
    });
    return Array.from(outcomes.entries()).map(function (pair) { return { gain: Number(pair[0]), probability: pair[1] }; }).filter(function (entry) { return entry.probability > 0; }).sort(function (a, b) { return a.gain - b.gain; });
  }

  function validateOutcomeDistribution(distribution) {
    return Array.isArray(distribution) && distribution.length > 0 && distribution.every(function (entry) {
      return Number.isInteger(entry.gain) && entry.gain >= 0 && Number.isFinite(entry.probability) && entry.probability >= 0;
    });
  }

  function convolveRepeated(probabilities, currentMaximum, ringDistribution, repetitions) {
    var ringMaximum = ringDistribution[ringDistribution.length - 1].gain;
    for (var ring = 0; ring < repetitions; ring += 1) {
      var nextMaximum = currentMaximum + ringMaximum;
      var next = new Float64Array(nextMaximum + 1);
      for (var currentGain = 0; currentGain <= currentMaximum; currentGain += 1) {
        var currentProbability = probabilities[currentGain];
        if (currentProbability === 0) continue;
        for (var outcomeIndex = 0; outcomeIndex < ringDistribution.length; outcomeIndex += 1) {
          var outcome = ringDistribution[outcomeIndex];
          next[currentGain + outcome.gain] += currentProbability * outcome.probability;
        }
      }
      probabilities = next;
      currentMaximum = nextMaximum;
    }
    return { probabilities: probabilities, maximum: currentMaximum };
  }

  function calculateAdditionalLevelDistribution(options) {
    var futureRings = options.targetRing - options.currentRing;
    if (!Number.isInteger(options.currentRing) || !Number.isInteger(options.targetRing) || options.currentRing < 0 || options.targetRing < 0) return { ok: false, code: "INVALID_RING", error: "Current and target rings must be nonnegative whole numbers." };
    if (futureRings < 0) return { ok: false, code: "TARGET_RING_BEFORE_CURRENT", error: "Target ring cannot be earlier than the current ring." };
    var majorRingCount = countFutureMajorRings(options.currentRing, options.targetRing);
    var ordinaryRingCount = futureRings - majorRingCount;
    var expectedAdditionalGain = options.selectionProbability * (ordinaryRingCount * options.expectedOrdinaryRingGain + majorRingCount * options.expectedMajorRingGain);
    if (futureRings > MAX_FUTURE_RINGS) return { ok: false, code: "COMPUTATION_LIMIT", error: "Exact distribution is limited to " + MAX_FUTURE_RINGS + " future rings.", futureRings: futureRings, majorRingCount: majorRingCount, ordinaryRingCount: ordinaryRingCount, expectedAdditionalGain: expectedAdditionalGain };
    var ordinarySelected = buildSelectedRewardRingDistribution(options.ordinaryGainDistribution, options.selectionProbability);
    var majorSelected = buildSelectedRewardRingDistribution(options.majorGainDistribution, options.selectionProbability);
    if (!validateOutcomeDistribution(ordinarySelected) || !validateOutcomeDistribution(majorSelected)) return { ok: false, code: "INVALID_OUTCOMES", error: "Gain outcomes must be nonnegative whole numbers for exact convolution." };
    var maximumAdditional = ordinaryRingCount * ordinarySelected[ordinarySelected.length - 1].gain + majorRingCount * majorSelected[majorSelected.length - 1].gain;
    if (maximumAdditional > MAX_ADDITIONAL_LEVELS) return { ok: false, code: "COMPUTATION_LIMIT", error: "Exact distribution would exceed the " + MAX_ADDITIONAL_LEVELS.toLocaleString() + "-level state-span limit.", futureRings: futureRings, majorRingCount: majorRingCount, ordinaryRingCount: ordinaryRingCount, expectedAdditionalGain: expectedAdditionalGain };
    var state = { probabilities: new Float64Array(1), maximum: 0 };
    state.probabilities[0] = 1;
    state = convolveRepeated(state.probabilities, state.maximum, ordinarySelected, ordinaryRingCount);
    state = convolveRepeated(state.probabilities, state.maximum, majorSelected, majorRingCount);
    return { ok: true, probabilities: state.probabilities, futureRings: futureRings, majorRingCount: majorRingCount, ordinaryRingCount: ordinaryRingCount, expectedAdditionalGain: expectedAdditionalGain, maximumAdditionalGain: state.maximum };
  }

  function probabilityAtLeast(probabilities, thresholdAdditional) {
    if (thresholdAdditional <= 0) return 1;
    if (thresholdAdditional >= probabilities.length) return 0;
    var total = 0;
    for (var index = thresholdAdditional; index < probabilities.length; index += 1) total += probabilities[index];
    return Math.max(0, Math.min(1, total));
  }

  function quantileAdditional(probabilities, percentile) {
    var cumulative = 0;
    for (var index = 0; index < probabilities.length; index += 1) {
      cumulative += probabilities[index];
      if (cumulative + 1e-14 >= percentile) return index;
    }
    return probabilities.length - 1;
  }

  function expectedFromDistribution(probabilities) {
    var expected = 0;
    for (var index = 0; index < probabilities.length; index += 1) expected += index * probabilities[index];
    return expected;
  }

  function distributionSum(probabilities) {
    var sum = 0;
    for (var index = 0; index < probabilities.length; index += 1) sum += probabilities[index];
    return sum;
  }

  function ringDistributionMoments(distribution) {
    var mean = distribution.reduce(function (sum, entry) { return sum + entry.gain * entry.probability; }, 0);
    var secondMoment = distribution.reduce(function (sum, entry) { return sum + entry.gain * entry.gain * entry.probability; }, 0);
    return { mean: mean, variance: Math.max(0, secondMoment - mean * mean) };
  }

  function aggregateMoments(options, ordinaryRingCount, majorRingCount) {
    var ordinarySelected = buildSelectedRewardRingDistribution(options.ordinaryGainDistribution, options.selectionProbability);
    var majorSelected = buildSelectedRewardRingDistribution(options.majorGainDistribution, options.selectionProbability);
    var ordinary = ringDistributionMoments(ordinarySelected);
    var major = ringDistributionMoments(majorSelected);
    return {
      mean: ordinaryRingCount * ordinary.mean + majorRingCount * major.mean,
      variance: ordinaryRingCount * ordinary.variance + majorRingCount * major.variance,
      ordinary: ordinary,
      major: major
    };
  }

  function normalCdf(value) {
    var sign = value < 0 ? -1 : 1;
    var x = Math.abs(value) / Math.sqrt(2);
    var t = 1 / (1 + 0.3275911 * x);
    var erf = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return 0.5 * (1 + sign * erf);
  }

  function inverseNormalCdf(probability) {
    if (probability <= 0 || probability >= 1) throw new Error("Probability must be between 0 and 1.");
    var a = [-39.6968302866538, 220.946098424521, -275.928510446969, 138.357751867269, -30.6647980661472, 2.50662827745924];
    var b = [-54.4760987982241, 161.585836858041, -155.698979859887, 66.8013118877197, -13.2806815528857];
    var c = [-0.00778489400243029, -0.322396458041136, -2.40075827716184, -2.54973253934373, 4.37466414146497, 2.93816398269878];
    var d = [0.00778469570904146, 0.32246712907004, 2.445134137143, 3.75440866190742];
    var lower = 0.02425;
    var upper = 1 - lower;
    var q; var r;
    if (probability < lower) {
      q = Math.sqrt(-2 * Math.log(probability));
      return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }
    if (probability > upper) {
      q = Math.sqrt(-2 * Math.log(1 - probability));
      return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }
    q = probability - 0.5;
    r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }

  function approximateProbabilityAtLeast(mean, variance, threshold) {
    if (threshold <= 0) return 1;
    if (variance === 0) return mean >= threshold ? 1 : 0;
    var z = (threshold - 0.5 - mean) / Math.sqrt(variance);
    return Math.max(0, Math.min(1, 1 - normalCdf(z)));
  }

  function approximatePercentile(mean, variance, percentile, minimumValue) {
    if (variance === 0) return Math.max(minimumValue, Math.round(mean));
    return Math.max(minimumValue, Math.floor(mean + inverseNormalCdf(percentile) * Math.sqrt(variance) + 0.5));
  }

  function approximateCdfAtObserved(mean, variance, observed) {
    if (variance === 0) return observed < mean ? 0 : observed > mean ? 1 : 0.5;
    return Math.max(0, Math.min(1, normalCdf((observed + 0.5 - mean) / Math.sqrt(variance))));
  }

  function evaluateApproximateTarget(options, distributionMetadata) {
    var moments = aggregateMoments(options, distributionMetadata.ordinaryRingCount, distributionMetadata.majorRingCount);
    var expectedFinalLevel = options.currentLevel + moments.mean;
    var thresholdAdditional = Math.ceil(options.targetLevel - options.currentLevel);
    return {
      ok: true,
      mode: "Analytical approximation",
      approximate: true,
      currentLevel: options.currentLevel,
      targetLevel: options.targetLevel,
      futureRings: distributionMetadata.futureRings,
      majorRingCount: distributionMetadata.majorRingCount,
      ordinaryRingCount: distributionMetadata.ordinaryRingCount,
      expectedAdditionalGain: moments.mean,
      expectedFinalLevel: expectedFinalLevel,
      varianceAdditionalGain: moments.variance,
      probabilityOfTarget: approximateProbabilityAtLeast(moments.mean, moments.variance, thresholdAdditional),
      percentiles: {
        p10: options.currentLevel + approximatePercentile(moments.mean, moments.variance, 0.10, 0),
        p25: options.currentLevel + approximatePercentile(moments.mean, moments.variance, 0.25, 0),
        median: options.currentLevel + approximatePercentile(moments.mean, moments.variance, 0.50, 0),
        p75: options.currentLevel + approximatePercentile(moments.mean, moments.variance, 0.75, 0),
        p90: options.currentLevel + approximatePercentile(moments.mean, moments.variance, 0.90, 0)
      },
      limitReason: distributionMetadata.error
    };
  }

  function evaluateTarget(options) {
    if (!Number.isFinite(options.currentLevel) || options.currentLevel < 0 || !Number.isFinite(options.targetLevel) || options.targetLevel < 0) return { ok: false, code: "INVALID_LEVEL", error: "Current and target levels must be finite and nonnegative." };
    var distribution = calculateAdditionalLevelDistribution(options);
    var expectedFinalLevel = options.currentLevel + (distribution.expectedAdditionalGain || 0);
    if (!distribution.ok && distribution.code === "COMPUTATION_LIMIT") return evaluateApproximateTarget(options, distribution);
    if (!distribution.ok) return Object.assign(distribution, { expectedFinalLevel: expectedFinalLevel });
    var threshold = Math.ceil(options.targetLevel - options.currentLevel);
    return Object.assign(distribution, {
      mode: "Exact analytical",
      approximate: false,
      currentLevel: options.currentLevel,
      targetLevel: options.targetLevel,
      expectedFinalLevel: expectedFinalLevel,
      probabilityOfTarget: probabilityAtLeast(distribution.probabilities, threshold),
      percentiles: {
        p10: options.currentLevel + quantileAdditional(distribution.probabilities, 0.10),
        p25: options.currentLevel + quantileAdditional(distribution.probabilities, 0.25),
        median: options.currentLevel + quantileAdditional(distribution.probabilities, 0.50),
        p75: options.currentLevel + quantileAdditional(distribution.probabilities, 0.75),
        p90: options.currentLevel + quantileAdditional(distribution.probabilities, 0.90)
      },
      distributionExpectedFinalLevel: options.currentLevel + expectedFromDistribution(distribution.probabilities),
      probabilitySum: distributionSum(distribution.probabilities)
    });
  }

  function classifyCurrentPercentile(percentile, currentLevel, expectedLevel) {
    if (percentile !== null) {
      if (percentile <= 0.10) return "Far below expectation";
      if (percentile < 0.40) return "Below expectation";
      if (percentile <= 0.60) return "Near expectation";
      if (percentile < 0.90) return "Above expectation";
      return "Far above expectation";
    }
    var scale = Math.max(1, expectedLevel);
    var relativeDifference = (currentLevel - expectedLevel) / scale;
    if (relativeDifference <= -0.25) return "Far below expectation";
    if (relativeDifference < -0.10) return "Below expectation";
    if (relativeDifference <= 0.10) return "Near expectation";
    if (relativeDifference < 0.25) return "Above expectation";
    return "Far above expectation";
  }

  function evaluateCurrentRun(options) {
    var directExpected = options.selectionProbability * ((options.currentRing - Math.floor(options.currentRing / 20)) * options.expectedOrdinaryRingGain + Math.floor(options.currentRing / 20) * options.expectedMajorRingGain);
    var distribution = calculateAdditionalLevelDistribution(Object.assign({}, options, { currentRing: 0, targetRing: options.currentRing }));
    var percentile = null;
    var mode = "Exact analytical";
    if (distribution.ok) {
      var cumulativeBelow = 0;
      var levelIndex = Math.floor(options.currentLevel);
      if (levelIndex >= distribution.probabilities.length) percentile = 1;
      else {
        for (var index = 0; index < levelIndex; index += 1) cumulativeBelow += distribution.probabilities[index];
        percentile = cumulativeBelow + 0.5 * distribution.probabilities[levelIndex];
      }
    } else if (distribution.code === "COMPUTATION_LIMIT") {
      var ordinaryRingCount = options.currentRing - Math.floor(options.currentRing / 20);
      var majorRingCount = Math.floor(options.currentRing / 20);
      var moments = aggregateMoments(options, ordinaryRingCount, majorRingCount);
      percentile = approximateCdfAtObserved(moments.mean, moments.variance, options.currentLevel);
      mode = "Analytical approximation";
    }
    return {
      currentLevel: options.currentLevel,
      expectedLevel: directExpected,
      difference: options.currentLevel - directExpected,
      percentile: percentile,
      mode: mode,
      label: classifyCurrentPercentile(percentile, options.currentLevel, directExpected),
      percentileLimited: percentile === null
    };
  }

  return {
    MAX_FUTURE_RINGS: MAX_FUTURE_RINGS,
    MAX_ADDITIONAL_LEVELS: MAX_ADDITIONAL_LEVELS,
    countFutureMajorRings: countFutureMajorRings,
    buildSelectedRewardRingDistribution: buildSelectedRewardRingDistribution,
    calculateAdditionalLevelDistribution: calculateAdditionalLevelDistribution,
    evaluateTarget: evaluateTarget,
    evaluateCurrentRun: evaluateCurrentRun,
    expectedFromDistribution: expectedFromDistribution,
    distributionSum: distributionSum,
    ringDistributionMoments: ringDistributionMoments,
    aggregateMoments: aggregateMoments,
    normalCdf: normalCdf,
    approximateProbabilityAtLeast: approximateProbabilityAtLeast,
    approximateCdfAtObserved: approximateCdfAtObserved
  };
}());
