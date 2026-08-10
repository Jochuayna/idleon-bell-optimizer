"use strict";
window.BellOptimizer = window.BellOptimizer || {};

BellOptimizer.bellRunForecast = (function () {
  var FORECAST_SCHEMA_VERSION = "bell-run-forecast-v1";
  var TAPER_POLICY_VERSION = "bell-taper-v1";
  var TIER_MODEL_VERSION = "bell-run-tier-v1";
  var DEFAULT_TAPER_POLICY = Object.freeze({ version: TAPER_POLICY_VERSION, thresholdRolls: 3, rollingWindowHours: 24, maximumRawRingIndex: 100000 });
  var EPSILON = 1e-12;
  var EXACT_COMPARISON_PAIR_LIMIT = 2000000;

  function finite(value) { return typeof value === "number" && Number.isFinite(value); }
  function clampProbability(value) { return Math.max(0, Math.min(1, value)); }
  function failure(code, message) { return { ok: false, available: false, code: code, reason: message }; }
  function normalizeRate(value) {
    if (finite(value)) return value;
    if (typeof value === "string" && /^[+]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim())) {
      var parsed = Number(value);
      if (finite(parsed)) return parsed;
    }
    return null;
  }
  function policyFrom(input) {
    var source = input || {};
    return {
      version: source.version || TAPER_POLICY_VERSION,
      thresholdRolls: source.thresholdRolls === undefined ? 3 : source.thresholdRolls,
      rollingWindowHours: source.rollingWindowHours === undefined ? 24 : source.rollingWindowHours,
      maximumRawRingIndex: source.maximumRawRingIndex === undefined ? 100000 : source.maximumRawRingIndex
    };
  }
  function validatePolicy(policy) {
    return policy && Number.isInteger(policy.thresholdRolls) && [1, 3, 5].indexOf(policy.thresholdRolls) !== -1 &&
      finite(policy.rollingWindowHours) && policy.rollingWindowHours > 0 && Number.isInteger(policy.maximumRawRingIndex) && policy.maximumRawRingIndex > 0;
  }
  function requirement(raw) { return BellOptimizer.bellMechanics.calculateRingingRequirement(raw); }
  function rollsFromBoundary(raw, rate, hours, stopAfter) {
    var available = rate * hours;
    if (!finite(available)) return null;
    var completed = 0;
    while (completed <= stopAfter) {
      var cost = requirement(raw + completed);
      if (!finite(cost)) return completed;
      if (available + EPSILON < cost) break;
      available -= cost;
      completed += 1;
    }
    return completed;
  }
  function boundaryIsTapered(raw, rate, policy) {
    var rolls = rollsFromBoundary(raw, rate, policy.rollingWindowHours, policy.thresholdRolls);
    return rolls === null ? null : rolls <= policy.thresholdRolls;
  }
  function expFromStateToBoundary(startRaw, startProgress, endRaw) {
    if (endRaw <= startRaw) return 0;
    var sum = -startProgress;
    var correction = 0;
    for (var raw = startRaw; raw < endRaw; raw += 1) {
      var value = requirement(raw);
      if (!finite(value)) return null;
      var adjusted = value - correction;
      var next = sum + adjusted;
      correction = (next - sum) - adjusted;
      sum = next;
    }
    return Math.max(0, sum);
  }
  function countMajorCrossings(startRaw, endRaw) {
    return Math.floor((endRaw + 1) / 20) - Math.floor((startRaw + 1) / 20);
  }

  function findRingingTaperBoundary(options) {
    options = options || {};
    var policy = policyFrom(options.policy);
    if (!validatePolicy(policy)) return failure("INVALID_TAPER_POLICY", "The taper policy is malformed.");
    var rate = normalizeRate(options.ringingExpPerHour);
    if (rate === null || rate <= 0) return failure("RATE_UNAVAILABLE", "A finite positive reconstructed Bell EXP/hour is required.");
    var startRaw = options.currentRawRingIndex;
    var startProgress = options.currentRingingExp;
    if (!Number.isInteger(startRaw) || startRaw < 0 || !finite(startProgress) || startProgress < 0) return failure("INVALID_RINGING_STATE", "The imported Ringing index or progress is malformed.");
    var currentRequirement = requirement(startRaw);
    if (!finite(currentRequirement)) return failure("INVALID_RINGING_STATE", "The current Ringing requirement is outside the supported numeric range.");
    var normalized = BellOptimizer.bellMechanics.advanceRingingProgress({ startingRawRingIndex: startRaw, startingRingingExp: startProgress, ringingExpPerHour: rate, durationHours: 0 });
    if (!normalized.ok) return failure("INVALID_RINGING_STATE", normalized.error || "The imported Ringing state could not be normalized.");
    var normalizedRaw = normalized.endingRawRing;
    var normalizedProgress = normalized.endingProgressExp;
    var immediateBankedRings = normalized.ringsCompleted;
    var currentDay = BellOptimizer.bellMechanics.advanceRingingProgress({ startingRawRingIndex: startRaw, startingRingingExp: startProgress, ringingExpPerHour: rate, durationHours: policy.rollingWindowHours });
    if (!currentDay.ok) return failure("TAPER_SEARCH_LIMIT", currentDay.error || "The current rolling-window progression could not be calculated.");
    var normalizedDay = BellOptimizer.bellMechanics.advanceRingingProgress({ startingRawRingIndex: normalizedRaw, startingRingingExp: normalizedProgress, ringingExpPerHour: rate, durationHours: policy.rollingWindowHours });
    if (!normalizedDay.ok) return failure("TAPER_SEARCH_LIMIT", normalizedDay.error || "The normalized rolling-window progression could not be calculated.");
    var alreadyTapered = immediateBankedRings === 0 && currentDay.ringsCompleted <= policy.thresholdRolls;
    var reachesTaperImmediately = immediateBankedRings > 0 && normalizedDay.ringsCompleted <= policy.thresholdRolls;
    var taperRaw = normalizedRaw;
    if (!alreadyTapered && !reachesTaperImmediately) {
      var low = normalizedRaw;
      var step = 1;
      var high = null;
      while (normalizedRaw + step <= policy.maximumRawRingIndex) {
        var candidate = normalizedRaw + step;
        var predicate = boundaryIsTapered(candidate, rate, policy);
        if (predicate === null) return failure("TAPER_SEARCH_LIMIT", "The taper predicate exceeded the supported numeric range.");
        if (predicate) { high = candidate; break; }
        low = candidate;
        step *= 2;
      }
      if (high === null && low < policy.maximumRawRingIndex) {
        var maximumPredicate = boundaryIsTapered(policy.maximumRawRingIndex, rate, policy);
        if (maximumPredicate) high = policy.maximumRawRingIndex;
      }
      if (high === null) return failure("TAPER_SEARCH_LIMIT", "No finite taper boundary was found within the safety limit.");
      while (low + 1 < high) {
        var midpoint = low + Math.floor((high - low) / 2);
        if (boundaryIsTapered(midpoint, rate, policy)) high = midpoint;
        else low = midpoint;
      }
      taperRaw = high;
    }
    var expRequired = expFromStateToBoundary(startRaw, startProgress, taperRaw);
    if (!finite(expRequired)) return failure("TAPER_SEARCH_LIMIT", "EXP to the taper boundary exceeded the supported numeric range.");
    var timeUntil = expRequired / rate;
    if (!finite(timeUntil)) return failure("TAPER_SEARCH_LIMIT", "Time to taper exceeded the supported numeric range.");
    var verificationProgress = taperRaw === normalizedRaw ? normalizedProgress : 0;
    var verification = BellOptimizer.bellMechanics.advanceRingingProgress({ startingRawRingIndex: taperRaw, startingRingingExp: verificationProgress, ringingExpPerHour: rate, durationHours: policy.rollingWindowHours });
    if (!verification.ok || verification.ringsCompleted > policy.thresholdRolls) return failure("TAPER_SEARCH_LIMIT", "The taper boundary failed progression verification.");
    return {
      ok: true, available: true, policyVersion: policy.version, thresholdRolls: policy.thresholdRolls, rollingWindowHours: policy.rollingWindowHours,
      startingRawRingIndex: startRaw, originalRawRingIndex: startRaw, originalRingingExp: startProgress,
      normalizedRawRingIndex: normalizedRaw, normalizedRingingExp: normalizedProgress, immediateBankedRings: immediateBankedRings,
      taperRawRingIndex: taperRaw, taperHumanRingNumber: taperRaw + 1,
      timeUntilTaperHours: timeUntil, expRequiredUntilTaper: expRequired,
      searchedFutureRings: taperRaw - normalizedRaw, totalRingsUntilTaper: taperRaw - startRaw, ringsRemainingUntilTaper: taperRaw - startRaw,
      majorPayoutsRemainingUntilTaper: countMajorCrossings(startRaw, taperRaw), rollsInNextWindowAtTaper: verification.ringsCompleted,
      alreadyTapered: alreadyTapered, reachesTaperImmediately: reachesTaperImmediately,
      taperStatus: alreadyTapered ? "ALREADY_TAPERED" : reachesTaperImmediately ? "REACHES_TAPER_IMMEDIATELY" : "REACHES_TAPER_AFTER_TIME",
      note: alreadyTapered || reachesTaperImmediately ? "Ringing continues beyond the practical taper at a decreasing pace." : null
    };
  }

  function buildMechanics(options) {
    var probabilities = BellOptimizer.bellMechanics.getRewardSelectionProbabilities(options.cavernsOwned);
    if (!probabilities.ok) return failure("INVALID_MECHANICS", probabilities.error);
    var index = options.selectedRewardIndex;
    if (!Number.isInteger(index) || index < 0 || index >= BellOptimizer.BELL_REWARDS.length) return failure("INVALID_REWARD", "A Bell reward index from 0 through 6 is required.");
    var selected = probabilities.rewards[index];
    if (!selected.available) return failure("LOCKED_REWARD", "The selected Bell reward is not unlocked for this account.");
    if (![options.majorBellBonus].every(function (value) { return finite(value) && value >= 0; })) return failure("INVALID_MECHANICS", "The major Bell bonus is unavailable or malformed.");
    if (typeof options.bellUpgrade42Owned !== "boolean" || typeof options.bellUpgrade60Owned !== "boolean" || typeof options.bellUpgrade86Owned !== "boolean") return failure("INVALID_MECHANICS", "Verified Bell upgrade ownership is required.");
    var ordinaryBeforeDouble = BellOptimizer.bellMechanics.getNormalGainProbabilityDistribution(options.bellUpgrade42Owned, options.bellUpgrade60Owned);
    var ordinary = BellOptimizer.bellMechanics.applyWholeRingDoubleToDistribution(ordinaryBeforeDouble, options.bellUpgrade86Owned, 25);
    var majorResult = BellOptimizer.bellMechanics.getMajorRingOutcomeDistribution(options.bellUpgrade42Owned, options.bellUpgrade60Owned, options.majorBellBonus, options.bellUpgrade86Owned, 25);
    if (!majorResult.ok) return failure("INVALID_MECHANICS", majorResult.error);
    function expected(distribution) { return distribution.reduce(function (sum, entry) { return sum + entry.gain * entry.probabilityValue; }, 0); }
    return { ok: true, available: true, selectionProbability: selected.probabilityValue, availableRewardCount: probabilities.availableCount, ordinaryGainDistribution: ordinary, majorGainDistribution: majorResult.afterDouble, expectedOrdinaryRingGain: expected(ordinary), expectedMajorRingGain: expected(majorResult.afterDouble) };
  }

  function quantileExact(probabilities, probability) {
    var cumulative = 0;
    for (var index = 0; index < probabilities.length; index += 1) { cumulative += probabilities[index]; if (cumulative + 1e-14 >= probability) return index; }
    return probabilities.length - 1;
  }
  function inverseNormalCdf(p) {
    var low = -9, high = 9;
    for (var i = 0; i < 80; i += 1) { var mid = (low + high) / 2; if (BellOptimizer.targetEvaluator.normalCdf(mid) < p) low = mid; else high = mid; }
    return (low + high) / 2;
  }
  function approximateQuantile(mean, variance, probability) {
    if (variance <= EPSILON) return Math.max(0, Math.round(mean));
    return Math.max(0, Math.floor(mean + inverseNormalCdf(probability) * Math.sqrt(variance) + 0.5));
  }
  function distributionVariance(probabilities, mean) {
    var variance = 0;
    for (var i = 0; i < probabilities.length; i += 1) variance += (i - mean) * (i - mean) * probabilities[i];
    return Math.max(0, variance);
  }

  function projectRewardToTaper(options) {
    var mechanics = options.mechanics || buildMechanics(options);
    if (!mechanics.ok) return mechanics;
    var taper = options.taper || findRingingTaperBoundary(options);
    if (!taper.ok) return taper;
    var startLevel = options.currentRewardLevel;
    if (!finite(startLevel) || startLevel < 0) return failure("INVALID_REWARD_LEVELS", "The selected reward level is malformed.");
    var distributionOptions = { currentRing: options.currentRawRingIndex + 1, targetRing: taper.taperRawRingIndex + 1, selectionProbability: mechanics.selectionProbability, ordinaryGainDistribution: mechanics.ordinaryGainDistribution, majorGainDistribution: mechanics.majorGainDistribution, expectedOrdinaryRingGain: mechanics.expectedOrdinaryRingGain, expectedMajorRingGain: mechanics.expectedMajorRingGain };
    var additional = BellOptimizer.targetEvaluator.calculateAdditionalLevelDistribution(distributionOptions);
    var probabilities = null, moments, mode;
    if (additional.ok) {
      probabilities = additional.probabilities;
      var mean = BellOptimizer.targetEvaluator.expectedFromDistribution(probabilities);
      moments = { mean: mean, variance: distributionVariance(probabilities, mean) };
      mode = "Exact analytical";
    } else if (additional.code === "COMPUTATION_LIMIT") {
      moments = BellOptimizer.targetEvaluator.aggregateMoments(distributionOptions, additional.ordinaryRingCount, additional.majorRingCount);
      mode = "Analytical approximation";
    } else return failure(additional.code || "INVALID_MECHANICS", additional.error || "The reward distribution could not be calculated.");
    var futureRings = taper.ringsRemainingUntilTaper;
    var majorCount = taper.majorPayoutsRemainingUntilTaper;
    function q(p) { return startLevel + (probabilities ? quantileExact(probabilities, p) : approximateQuantile(moments.mean, moments.variance, p)); }
    return {
      ok: true, available: true, currentSelectedRewardLevel: startLevel, currentRawRingIndex: options.currentRawRingIndex,
      taperRawRingIndex: taper.taperRawRingIndex, timeUntilTaperHours: taper.timeUntilTaperHours, futureRings: futureRings,
      futureMajorPayouts: majorCount, expectedOrdinarySelectedRewardEvents: (futureRings - majorCount) * mechanics.selectionProbability,
      expectedMajorSelectedRewardEvents: majorCount * mechanics.selectionProbability, expectedAdditionalRewardLevels: moments.mean,
      expectedFinalRewardLevel: startLevel + moments.mean, medianFinalRewardLevel: q(.5), p10: q(.1), p25: q(.25), p75: q(.75), p90: q(.9),
      variance: moments.variance, calculationMode: mode, approximate: !probabilities, distribution: probabilities,
      startingRewardLevel: startLevel, mechanics: mechanics, taper: taper
    };
  }

  function calculateCurrentConcentrationContext(options) {
    if (!Array.isArray(options.rewardLevels) || options.rewardLevels.length < 7 || !options.rewardLevels.slice(0, 7).every(function (value) { return finite(value) && value >= 0; })) return failure("INVALID_REWARD_LEVELS", "Seven finite nonnegative Bell reward levels are required.");
    var mechanics = options.mechanics || buildMechanics(options);
    if (!mechanics.ok) return mechanics;
    var highest = mechanics.availableRewardCount - 1;
    var total = options.rewardLevels.slice(0, highest + 1).reduce(function (sum, value) { return sum + value; }, 0);
    var selectedLevel = options.rewardLevels[options.selectedRewardIndex];
    var payoutShare = total > 0 ? selectedLevel / total : null;
    var historical = BellOptimizer.targetEvaluator.evaluateCurrentRun({ currentLevel: selectedLevel, currentRing: options.currentRawRingIndex + 1, selectionProbability: mechanics.selectionProbability, ordinaryGainDistribution: mechanics.ordinaryGainDistribution, majorGainDistribution: mechanics.majorGainDistribution, expectedOrdinaryRingGain: mechanics.expectedOrdinaryRingGain, expectedMajorRingGain: mechanics.expectedMajorRingGain });
    return { ok: true, available: true, selectedCurrentRewardLevel: selectedLevel, totalCurrentUnlockedBellLevels: total, payoutShare: payoutShare, expectedPayoutShare: mechanics.selectionProbability, concentrationRatio: payoutShare === null ? null : payoutShare / mechanics.selectionProbability, zeroTotalStatus: total === 0 ? "ZERO_TOTAL_LEVELS" : null, selectedLevelExpectedValue: historical.expectedLevel, selectedLevelDifferenceFromExpectation: historical.difference, selectedLevelPercentile: finite(historical.percentile) ? clampProbability(historical.percentile) : null, historicalCalculationMode: historical.mode, approximate: historical.mode !== "Exact analytical", mechanicsStabilityWarning: "This historical context assumes the currently imported Bell mechanics applied throughout the run; it does not reconstruct individual selections, major payouts, doubles, or payout order." };
  }

  function buildFreshTaperBaseline(options) {
    var mechanics = options.mechanics || buildMechanics(options);
    if (!mechanics.ok) return mechanics;
    var freshOptions = Object.assign({}, options, { currentRawRingIndex: 0, currentRingingExp: 0, currentRewardLevel: 0, mechanics: mechanics });
    var taper = findRingingTaperBoundary(freshOptions);
    if (!taper.ok) return taper;
    var projection = projectRewardToTaper(Object.assign({}, freshOptions, { taper: taper }));
    if (!projection.ok) return projection;
    projection.freshRewardLevels = [0, 0, 0, 0, 0, 0, 0];
    projection.cacheSignature = createForecastCacheSignature(options, mechanics);
    return projection;
  }

  function createForecastCacheSignature(options, mechanics) {
    var policy = policyFrom(options.policy);
    var rate = normalizeRate(options.ringingExpPerHour);
    return JSON.stringify({ schemaVersion: FORECAST_SCHEMA_VERSION, rate: rate === null ? null : String(rate), availableRewardCount: mechanics.availableRewardCount, selectionProbability: String(mechanics.selectionProbability), upgrade42: options.bellUpgrade42Owned, upgrade60: options.bellUpgrade60Owned, upgrade86: options.bellUpgrade86Owned, majorBonus: String(options.majorBellBonus), taperPolicyVersion: policy.version, taperThreshold: policy.thresholdRolls, rollingWindowHours: policy.rollingWindowHours });
  }

  function pathCdf(path, value) {
    var additional = value - path.startingRewardLevel;
    if (path.distribution) {
      if (additional < 0) return 0;
      var point = Math.floor(additional);
      var belowLimit = Math.min(path.distribution.length - 1, point - 1);
      var sum = 0; for (var i = 0; i <= belowLimit; i += 1) sum += path.distribution[i];
      if (point >= 0 && point < path.distribution.length) sum += .5 * path.distribution[point];
      return clampProbability(sum);
    }
    if (path.variance <= EPSILON) return value < path.expectedFinalRewardLevel ? 0 : value > path.expectedFinalRewardLevel ? 1 : .5;
    return clampProbability(BellOptimizer.targetEvaluator.normalCdf((value + .5 - path.expectedFinalRewardLevel) / Math.sqrt(path.variance)));
  }

  function compareProjectedFinishDistributions(current, fresh) {
    if (!current || !fresh || !current.ok || !fresh.ok) return failure("INVALID_PROJECTION", "Both current and fresh projections are required.");
    var left = current, right = fresh;
    if (current.distribution && fresh.distribution && current.distribution.length * fresh.distribution.length > EXACT_COMPARISON_PAIR_LIMIT) {
      left = Object.assign({}, current, { distribution: null });
      right = Object.assign({}, fresh, { distribution: null });
    }
    var compared = BellOptimizer.automaticRunEvaluation.compareFinalDistributions(left, right);
    return { ok: true, available: true, currentWinProbability: compared.continueWinProbability, freshWinProbability: compared.resetWinProbability, tieProbability: compared.tieProbability, currentSuperiority: compared.continueSuperiority, freshSuperiority: compared.resetSuperiority, expectedFinishDifference: compared.expectedDifference, differenceVariance: compared.variance, differenceMedian: compared.differenceMedian, differenceP10: compared.differenceP10, differenceP25: compared.differenceP25, differenceP75: compared.differenceP75, differenceP90: compared.differenceP90, calculationMode: compared.calculationMode, approximate: compared.approximate, differenceDistribution: compared.differenceDistribution };
  }

  function tierKey(percentile) {
    return percentile < .01 ? "ABSOLUTELY_COOKED" : percentile < .10 ? "COOKED" : percentile < .25 ? "WEAK_RUN" : percentile < .75 ? "TYPICAL_RUN" : percentile < .90 ? "SAVEABLE_RUN" : percentile < .99 ? "STRONG_RUN" : "EXCEPTIONAL_RUN";
  }
  function classifyProjectedRunTier(superiority, options) {
    options = options || {};
    if (!finite(superiority) || superiority < 0 || superiority > 1) return failure("INVALID_SUPERIORITY", "A superiority probability from zero through one is required.");
    var boundaries = [.01, .10, .25, .75, .90, .99];
    var distance = Math.min.apply(null, boundaries.map(function (value) { return Math.abs(superiority - value); }));
    var low = options.plausibleLowPercentile;
    var high = options.plausibleHighPercentile;
    return { ok: true, available: true, tierKey: tierKey(superiority), centralTier: tierKey(superiority), superiorityPercentile: superiority, tierModelVersion: TIER_MODEL_VERSION, approximate: Boolean(options.approximate), boundaryProximity: distance, uncertaintyRange: finite(low) && finite(high) ? { lowPercentile: low, highPercentile: high } : null, plausibleLowTier: finite(low) ? tierKey(low) : null, plausibleHighTier: finite(high) ? tierKey(high) : null };
  }

  function evaluateBellRunForecast(options) {
    options = options || {};
    if (Object.prototype.hasOwnProperty.call(options, "targetLevel") || Object.prototype.hasOwnProperty.call(options, "targetRing") || Object.prototype.hasOwnProperty.call(options, "durationHours")) return failure("TARGET_OR_FIXED_HORIZON_NOT_ACCEPTED", "Bell Run Forecast does not accept a target or fixed forecast horizon.");
    if (!Array.isArray(options.rewardLevels) || options.rewardLevels.length < 7 || !options.rewardLevels.slice(0, 7).every(function (value) { return finite(value) && value >= 0; })) return failure("INVALID_REWARD_LEVELS", "Seven finite nonnegative Bell reward levels are required.");
    var mechanics = buildMechanics(options);
    if (!mechanics.ok) return mechanics;
    var common = Object.assign({}, options, { mechanics: mechanics, currentRewardLevel: options.rewardLevels[options.selectedRewardIndex] });
    var taper = findRingingTaperBoundary(common); if (!taper.ok) return taper;
    var concentration = calculateCurrentConcentrationContext(common); if (!concentration.ok) return concentration;
    var current = projectRewardToTaper(Object.assign({}, common, { taper: taper })); if (!current.ok) return current;
    var fresh = buildFreshTaperBaseline(common); if (!fresh.ok) return fresh;
    var comparison = compareProjectedFinishDistributions(current, fresh); if (!comparison.ok) return comparison;
    var low = pathCdf(fresh, current.p25), high = pathCdf(fresh, current.p75);
    var tier = classifyProjectedRunTier(comparison.currentSuperiority, { approximate: comparison.approximate || current.approximate || fresh.approximate, plausibleLowPercentile: Math.min(low, high), plausibleHighPercentile: Math.max(low, high) });
    return { ok: true, available: true, schemaVersion: FORECAST_SCHEMA_VERSION, selectedRewardIndex: options.selectedRewardIndex, concentration: concentration, taper: taper, currentProjection: current, freshBaseline: fresh, comparison: comparison, projectedTier: tier, cacheSignature: createForecastCacheSignature(options, mechanics), actionComparison: null };
  }

  return { FORECAST_SCHEMA_VERSION: FORECAST_SCHEMA_VERSION, TAPER_POLICY_VERSION: TAPER_POLICY_VERSION, TIER_MODEL_VERSION: TIER_MODEL_VERSION, DEFAULT_TAPER_POLICY: DEFAULT_TAPER_POLICY, EXACT_COMPARISON_PAIR_LIMIT: EXACT_COMPARISON_PAIR_LIMIT, findRingingTaperBoundary: findRingingTaperBoundary, calculateCurrentConcentrationContext: calculateCurrentConcentrationContext, projectRewardToTaper: projectRewardToTaper, buildFreshTaperBaseline: buildFreshTaperBaseline, createForecastCacheSignature: createForecastCacheSignature, pathCdf: pathCdf, compareProjectedFinishDistributions: compareProjectedFinishDistributions, classifyProjectedRunTier: classifyProjectedRunTier, evaluateBellRunForecast: evaluateBellRunForecast, _test: { boundaryIsTapered: boundaryIsTapered, rollsFromBoundary: rollsFromBoundary, expFromStateToBoundary: expFromStateToBoundary, countMajorCrossings: countMajorCrossings, pathCdf: pathCdf } };
}());
