"use strict";
window.BellOptimizer = window.BellOptimizer || {};

BellOptimizer.bellRenewalPolicy = (function () {
  var OBJECTIVE_VERSION = "bell-renewal-objective-v1";
  var POLICY_VERSION = "bell-renewal-policy-v1";
  var HORIZON_VERSION = "bell-renewal-horizon-v1";
  var RENEWAL_COST = 25;
  var RENEWAL_GENERATION_PER_HOUR = 10;
  var MAX_RENEWALS = 2;
  var MAX_PAYOUT_EPOCHS = 100;
  var MAX_BREAKPOINTS = 10000;
  var MAX_NON_LEVEL_STATES = 5000;
  var EPSILON = 1e-10;

  function finite(value) { return typeof value === "number" && Number.isFinite(value); }
  function clamp01(value) { return Math.max(0, Math.min(1, value)); }
  function close(a, b) { return Math.abs(a - b) <= EPSILON * Math.max(1, Math.abs(a), Math.abs(b)); }
  function unavailable(code, reason, extra) {
    return Object.assign({ ok: false, available: false, status: code, action: "POLICY_UNAVAILABLE", reason: reason }, extra || {});
  }
  function isMajorCompletedRaw(raw) { return raw >= 0 && (raw + 1) % 20 === 0; }
  function requirement(raw) { return BellOptimizer.bellMechanics.calculateRingingRequirement(raw); }

  function policyAssumptions() {
    return [
      "FINITE_RECEDING_HORIZON", "LINEAR_RAW_BELL_LEVEL_UTILITY", "SELECTED_REWARD_ONLY",
      "CURRENT_BELL_MECHANICS_HELD_CONSTANT", "RENEWAL_COST_25", "RENEWAL_GENERATION_10_PER_HOUR",
      "MAXIMUM_TWO_RENEWALS_MODELED_IN_V1", "NO_TARGET", "NO_LANTERN",
      "NO_DOWNSTREAM_PRACTICAL_REWARD_UTILITY", "UNUSED_RENEWAL_CURRENCY_HAS_ZERO_TERMINAL_UTILITY",
      "CURRENT_MODELED_FRESH_RESET_SEMANTICS_ASSUMED"
    ];
  }

  function validate(options) {
    if (!options || typeof options !== "object") return unavailable("INVALID_POLICY_INPUT", "Policy options are required.");
    if ("targetLevel" in options || "targetRing" in options) return unavailable("TARGET_INPUT_NOT_SUPPORTED", "bell-renewal-policy-v1 is target-free.");
    if ("lanternHours" in options || "lanternCount" in options) return unavailable("LANTERN_INPUT_NOT_SUPPORTED", "bell-renewal-policy-v1 is Lantern-free.");
    if (!Number.isInteger(options.selectedRewardIndex) || options.selectedRewardIndex < 0 || options.selectedRewardIndex > 6) return unavailable("INVALID_REWARD", "A selected reward index from 0 through 6 is required.");
    var level = options.currentSelectedLevel;
    if (level === undefined && Array.isArray(options.rewardLevels)) level = options.rewardLevels[options.selectedRewardIndex];
    if (!Number.isSafeInteger(level) || level < 0) return unavailable("UNSAFE_SELECTED_LEVEL", "The selected reward level must be a nonnegative safe integer.");
    if (!Number.isInteger(options.currentRawRingIndex) || options.currentRawRingIndex < 0 || !finite(options.currentRingingExp) || options.currentRingingExp < 0) return unavailable("INVALID_RINGING_STATE", "The Ringing index and progress must be finite and nonnegative.");
    if (!finite(options.ringingExpPerHour) || options.ringingExpPerHour <= 0) return unavailable("INVALID_BELL_RATE", "A finite positive Bell EXP/hour is required.");
    if (!finite(options.currentRenewalCurrency) || options.currentRenewalCurrency < 0) return unavailable("INVALID_RENEWAL_CURRENCY", "Renewal currency must be finite and nonnegative.");
    if (typeof options.bellUpgrade42Owned !== "boolean" || typeof options.bellUpgrade60Owned !== "boolean" || typeof options.bellUpgrade86Owned !== "boolean" || !finite(options.majorBellBonus) || options.majorBellBonus < 0 || !Number.isSafeInteger(options.majorBellBonus)) return unavailable("INVALID_PAYOUT_MECHANICS", "Verified integer Bell payout mechanics are required.");
    var pool = BellOptimizer.bellMechanics.getRewardSelectionProbabilities(options.cavernsOwned);
    if (!pool.ok) return unavailable("INVALID_REWARD_POOL", pool.error);
    if (!pool.rewards[options.selectedRewardIndex].available) return unavailable("LOCKED_REWARD", "The selected reward is not in the active Bell pool.", { action: "LOCKED_REWARD" });
    return { ok: true, level: level, pool: pool, selectionProbability: pool.rewards[options.selectedRewardIndex].probabilityValue };
  }

  function payoutDistributions(options, selectionProbability) {
    var ordinaryBase = BellOptimizer.bellMechanics.applyWholeRingDoubleToDistribution(
      BellOptimizer.bellMechanics.getNormalGainProbabilityDistribution(options.bellUpgrade42Owned, options.bellUpgrade60Owned),
      options.bellUpgrade86Owned, 25
    );
    var majorResult = BellOptimizer.bellMechanics.getMajorRingOutcomeDistribution(options.bellUpgrade42Owned, options.bellUpgrade60Owned, options.majorBellBonus, options.bellUpgrade86Owned, 25);
    if (!majorResult.ok) return null;
    function selected(distribution) {
      return BellOptimizer.targetEvaluator.buildSelectedRewardRingDistribution(distribution, selectionProbability).map(function (entry) {
        return { gain: entry.gain, probability: entry.probability };
      });
    }
    return { ordinary: selected(ordinaryBase), major: selected(majorResult.afterDouble) };
  }

  function determineHorizon(options) {
    if (options.horizonHours !== undefined) {
      if (!finite(options.horizonHours) || options.horizonHours < 0) return unavailable("INVALID_HORIZON", "The planning horizon must be finite and nonnegative.");
      return { ok: true, horizonHours: options.horizonHours, explicit: true };
    }
    var result = BellOptimizer.bellRenewalCandidateAnalysis.determinePlanningHorizon(options);
    if (!result.ok) return unavailable("HORIZON_UNAVAILABLE", result.reason || "The account-specific horizon is unavailable.");
    return { ok: true, horizonHours: result.horizonHours, explicit: false, source: result };
  }

  function countReachablePayouts(raw, progress, rate, hours) {
    var result = BellOptimizer.bellMechanics.advanceRingingProgress({ startingRawRingIndex: raw, startingRingingExp: progress, ringingExpPerHour: rate, durationHours: hours });
    return result.ok ? { ok: true, count: result.ringsCompleted, result: result } : { ok: false, reason: result.error };
  }

  function solveBellRenewalPolicy(options) {
    var validation = validate(options);
    if (!validation.ok) return validation;
    var horizon = determineHorizon(options);
    if (!horizon.ok) return horizon;
    var horizonHours = horizon.horizonHours;
    var currentCount = countReachablePayouts(options.currentRawRingIndex, options.currentRingingExp, options.ringingExpPerHour, horizonHours);
    var freshCount = countReachablePayouts(0, 0, options.ringingExpPerHour, horizonHours);
    if (!currentCount.ok || !freshCount.ok) return unavailable("INVALID_RINGING_STATE", (currentCount.reason || freshCount.reason));
    var futurePayoutEpochs = Math.max(currentCount.count, freshCount.count);
    var affordableOverHorizon = Math.max(0, Math.floor((options.currentRenewalCurrency + RENEWAL_GENERATION_PER_HOUR * horizonHours + EPSILON) / RENEWAL_COST));
    var limitMetadata = { futurePayoutEpochs: futurePayoutEpochs, exactPayoutLimit: MAX_PAYOUT_EPOCHS, renewalsAffordableOverHorizon: affordableOverHorizon, modeledRenewalLimit: MAX_RENEWALS };
    if (futurePayoutEpochs > MAX_PAYOUT_EPOCHS) return unavailable("POLICY_UNAVAILABLE_EXACT_LIMIT", "The exact policy would exceed the future-payout limit.", limitMetadata);

    var distributions = payoutDistributions(options, validation.selectionProbability);
    if (!distributions) return unavailable("INVALID_PAYOUT_MECHANICS", "Selected-reward payout distributions are unavailable.");
    var memo = new Map(), nonLevelStates = new Set(), retainedLevels = new Map(), currentContinuePoints = new Map();
    var stats = { memoizationCount: 0, nonLevelBellmanStates: 0, retainedValueFunctionBreakpoints: 0, maximumRenewalDepthUsed: 0, payoutTransitions: 0 };
    var failure = null;

    function elapsed(state) { return horizonHours - state.t; }
    function currency(state, renewalCountOverride) { return options.currentRenewalCurrency + RENEWAL_GENERATION_PER_HOUR * elapsed(state) - RENEWAL_COST * (renewalCountOverride === undefined ? state.k : renewalCountOverride); }
    function affordability(state) {
      var beforeSpend = options.currentRenewalCurrency + RENEWAL_GENERATION_PER_HOUR * elapsed(state) - RENEWAL_COST * state.k;
      var difference = beforeSpend - RENEWAL_COST;
      var tolerance = Number.EPSILON * Math.max(1, Math.abs(beforeSpend), RENEWAL_COST) * 8;
      return { affordable: difference >= 0, boundaryUncertain: difference < 0 && difference >= -tolerance, balance: beforeSpend };
    }
    function nonLevelKey(state) { return [state.r, state.x.toPrecision(15), state.k, state.t.toPrecision(15), state.f ? 1 : 0, state.original ? 1 : 0].join("|"); }
    function memoKey(state, level) { return nonLevelKey(state) + "|" + level; }
    function retain(state, level) {
      var key = nonLevelKey(state), levels = retainedLevels.get(key);
      if (!levels) { levels = new Set(); retainedLevels.set(key, levels); nonLevelStates.add(key); stats.nonLevelBellmanStates = nonLevelStates.size; }
      if (!levels.has(level)) { levels.add(level); stats.retainedValueFunctionBreakpoints += 1; }
      if (stats.retainedValueFunctionBreakpoints > MAX_BREAKPOINTS) failure = unavailable("POLICY_UNAVAILABLE_BREAKPOINT_LIMIT", "The sparse value function exceeded its breakpoint safety cap.", limitMetadata);
      if (stats.nonLevelBellmanStates > MAX_NON_LEVEL_STATES) failure = unavailable("POLICY_UNAVAILABLE_MEMO_LIMIT", "The exact policy exceeded its non-level-state safety cap.", limitMetadata);
    }
    function nextEvent(state) {
      var needed = requirement(state.r) - state.x;
      if (!finite(needed)) return null;
      var dt = needed <= EPSILON ? 0 : needed / options.ringingExpPerHour;
      if (dt > state.t + EPSILON) return { reachable: false, hours: dt };
      var nextRaw = state.r + 1;
      return { reachable: true, hours: Math.max(0, dt), state: { r: nextRaw, x: Math.max(0, state.x + options.ringingExpPerHour * Math.max(0, dt) - requirement(state.r)), k: state.k, t: Math.max(0, state.t - Math.max(0, dt)), f: true, original: false }, major: isMajorCompletedRaw(nextRaw), completedRaw: nextRaw };
    }
    function continueValue(state, level) {
      var event = nextEvent(state);
      if (!event || !event.reachable) return { value: level, event: event, distribution: [{ value: level, probability: 1 }] };
      stats.payoutTransitions += 1;
      var payout = event.major ? distributions.major : distributions.ordinary;
      var expected = 0, outcomes = [];
      for (var i = 0; i < payout.length; i += 1) {
        var nextLevel = level + payout[i].gain;
        if (!Number.isSafeInteger(nextLevel)) { failure = unavailable("UNSAFE_SELECTED_LEVEL", "A payout would exceed safe integer precision."); return { value: NaN, event: event, distribution: [] }; }
        var future = optimalValue(event.state, nextLevel);
        if (failure) return { value: NaN, event: event, distribution: [] };
        expected += payout[i].probability * future;
        outcomes.push({ value: future, probability: payout[i].probability });
      }
      return { value: expected, event: event, distribution: outcomes };
    }
    function canModelRenew(state) { return state.k < MAX_RENEWALS && (state.original || state.f); }
    function renewValue(state, ignoreAffordability) {
      if (!canModelRenew(state)) return { available: false, value: null, reason: "RENEWAL_PROGRESS_OR_DEPTH_REQUIRED" };
      var afford = affordability(state);
      if (!ignoreAffordability && !afford.affordable) return { available: false, value: null, reason: afford.boundaryUncertain ? "AFFORDABILITY_BOUNDARY" : "INSUFFICIENT_CURRENCY", affordability: afford };
      var renewed = { r: 0, x: 0, k: state.k + 1, t: state.t, f: false, original: false };
      stats.maximumRenewalDepthUsed = Math.max(stats.maximumRenewalDepthUsed, renewed.k);
      var forced = continueValue(renewed, 0);
      if (!forced.event || !forced.event.reachable) return { available: true, value: 0, cannotReachFreshPayout: true, affordability: afford };
      return { available: true, value: forced.value, forcedProgression: true, nextEvent: forced.event, affordability: afford };
    }
    function optimalValue(state, level) {
      if (failure) return NaN;
      if (state.t <= EPSILON) return level;
      var key = memoKey(state, level);
      if (memo.has(key)) return memo.get(key);
      retain(state, level); if (failure) return NaN;
      var cont = continueValue(state, level), best = cont.value;
      var renew = renewValue(state, false);
      if (renew.available && !renew.cannotReachFreshPayout && renew.value > best) best = renew.value;
      memo.set(key, best); stats.memoizationCount = memo.size;
      return best;
    }

    function currentContinueValue(state, level) {
      var result = continueValue(state, level);
      if (!failure && finite(result.value)) currentContinuePoints.set(level, result.value);
      return result;
    }

    function mergeCollinearPoints(points) {
      var sorted = points.slice().sort(function (a, b) { return a.level - b.level; });
      if (sorted.length < 3) return sorted;
      var merged = [sorted[0]];
      for (var i = 1; i < sorted.length - 1; i += 1) {
        var previous = merged[merged.length - 1], current = sorted[i], nextPoint = sorted[i + 1];
        var leftWidth = current.level - previous.level, rightWidth = nextPoint.level - current.level;
        var leftSlope = leftWidth ? (current.value - previous.value) / leftWidth : null;
        var rightSlope = rightWidth ? (nextPoint.value - current.value) / rightWidth : null;
        if (leftSlope === null || rightSlope === null || !close(leftSlope, rightSlope)) merged.push(current);
      }
      merged.push(sorted[sorted.length - 1]);
      return merged;
    }

    var initial = { r: options.currentRawRingIndex, x: options.currentRingingExp, k: 0, t: horizonHours, f: options.progressedSinceRenewal !== false, original: true };
    var currentLevel = validation.level;
    var continueNow = currentContinueValue(initial, currentLevel);
    if (failure) return Object.assign(failure, { performance: stats });
    var renewActual = renewValue(initial, false);
    var renewHypothetical = renewActual.available ? renewActual : renewValue(initial, true);
    if (failure) return Object.assign(failure, { performance: stats });
    var renewValueNow = renewHypothetical.available && !renewHypothetical.cannotReachFreshPayout ? renewHypothetical.value : null;

    function difference(level) {
      var c = currentContinueValue(initial, level);
      if (failure) return NaN;
      return renewValueNow === null ? Infinity : c.value - renewValueNow;
    }
    var threshold = null, lower = null, upper = null, tie = false, thresholdMode = renewValueNow === null ? "RENEWAL_HAS_NO_REACHABLE_PAYOUT" : "EXACT_SPARSE_MONOTONE_SEARCH";
    if (renewValueNow !== null) {
      var atZero = difference(0);
      if (failure) return Object.assign(failure, { performance: stats });
      if (atZero >= -EPSILON) { threshold = 0; lower = 0; upper = 0; tie = close(atZero, 0); }
      else {
        lower = 0; upper = 1;
        while (difference(upper) < -EPSILON) {
          if (failure) return Object.assign(failure, { performance: stats });
          lower = upper;
          if (upper > Math.floor(Number.MAX_SAFE_INTEGER / 2)) return unavailable("UNSAFE_THRESHOLD_PRECISION", "The reservation threshold cannot be bracketed safely.", { performance: stats });
          upper *= 2;
        }
        while (lower + 1 < upper) { var mid = lower + Math.floor((upper - lower) / 2); if (difference(mid) >= -EPSILON) upper = mid; else lower = mid; if (failure) return Object.assign(failure, { performance: stats }); }
        threshold = upper; tie = close(difference(threshold), 0);
      }
    }

    var actualContinue = continueNow.value, actualRenew = renewActual.available && !renewActual.cannotReachFreshPayout ? renewActual.value : null;
    var hypotheticalRenewBetter = renewValueNow !== null && renewValueNow > actualContinue + EPSILON * Math.max(1, Math.abs(renewValueNow), Math.abs(actualContinue));
    var action, optimal;
    if (actualRenew !== null && close(actualContinue, actualRenew)) { action = "INDIFFERENT"; optimal = Math.max(actualContinue, actualRenew); }
    else if (actualRenew !== null && actualRenew > actualContinue) { action = "RENEW_NOW"; optimal = actualRenew; }
    else if (hypotheticalRenewBetter && !renewActual.available) { action = "RENEW_FAVORED_BUT_UNAVAILABLE"; optimal = actualContinue; }
    else { action = "CONTINUE"; optimal = actualContinue; }
    var chosenOther = action === "RENEW_NOW" ? actualContinue : actualRenew;
    var advantage = chosenOther === null ? 0 : Math.max(0, optimal - chosenOther);
    var next = nextEvent(initial), nextMajorRaw = initial.r + (19 - initial.r % 20);
    if (nextMajorRaw <= initial.r) nextMajorRaw += 20;
    var highVarianceReasons = [];
    if (next && next.reachable && next.major && validation.selectionProbability < 0.5 && action === "CONTINUE" && renewValueNow !== null && actualContinue > renewValueNow) highVarianceReasons.push("EXPECTED_VALUE_FAVORS_CONTINUE_BEFORE_LOW_SELECTION_PROBABILITY_MAJOR");
    var currencyNow = currency(initial);
    var affordableNow = Math.max(0, Math.floor((currencyNow + EPSILON) / RENEWAL_COST));
    var sparseCurrentPoints = Array.from(currentContinuePoints.entries()).map(function (entry) { return { level: entry[0], value: entry[1] }; });
    var mergedCurrentPoints = mergeCollinearPoints(sparseCurrentPoints);
    return {
      ok: true, available: true, status: "EXACT_POLICY_AVAILABLE",
      objectiveVersion: OBJECTIVE_VERSION, policyVersion: POLICY_VERSION, horizonVersion: HORIZON_VERSION, horizonHours: horizonHours,
      action: action, currentSelectedLevel: currentLevel, reservationLevelNow: threshold,
      distanceFromReservationLevel: threshold === null ? null : currentLevel - threshold,
      expectedTerminalLevelUnderOptimalPolicy: optimal,
      expectedTerminalLevelIfContinueNow: actualContinue,
      expectedTerminalLevelIfRenewNow: renewValueNow,
      expectedAdvantageOfChosenAction: advantage,
      renewBelow: threshold === null ? null : threshold,
      continueAtOrAbove: threshold,
      tieAtBoundary: tie,
      nextDecisionEvent: next && next.reachable ? { type: next.major ? "MAJOR_BELL_PAYOUT" : "ORDINARY_BELL_PAYOUT", hoursFromNow: next.hours, completedRawRingIndex: next.completedRaw, humanRingNumber: next.completedRaw + 1 } : { type: "HORIZON_TERMINATION" },
      nextMajor: { rawRingIndex: nextMajorRaw, humanRingNumber: nextMajorRaw + 1 },
      renewalCurrencyNow: currencyNow, renewalsAffordableNow: affordableNow, renewalsAffordableOverHorizon: affordableOverHorizon,
      maxRenewalsModeled: MAX_RENEWALS, renewalLimitBindingPossible: affordableOverHorizon > MAX_RENEWALS,
      policyMode: "EXACT_ADAPTIVE_BELLMAN", thresholdMode: thresholdMode, thresholdLowerBound: lower, thresholdUpperBound: upper,
      highVarianceDecision: highVarianceReasons.length > 0, highVarianceReasons: highVarianceReasons,
      assumptions: policyAssumptions(), warnings: ["RESET_SEMANTICS_MODEL_ASSUMED"],
      horizonEdgeAssumption: "UNUSED_RENEWAL_CURRENCY_HAS_ZERO_TERMINAL_UTILITY",
      resetSemanticsStatus: "RESET_SEMANTICS_MODEL_ASSUMED",
      recedingHorizonInstruction: "Recalculate after another Bell payout, Renewal, account import, Bell rate change, upgrade, or mechanics change.",
      performance: Object.assign({}, stats, { futurePayoutEpochs: futurePayoutEpochs, exactPayoutLimit: MAX_PAYOUT_EPOCHS, breakpointLimit: MAX_BREAKPOINTS, maximumRenewalDepthUsed: stats.maximumRenewalDepthUsed, exactSafetyLimitsApproached: stats.retainedValueFunctionBreakpoints > MAX_BREAKPOINTS * 0.8 || futurePayoutEpochs > MAX_PAYOUT_EPOCHS * 0.8 }),
      sparseValueFunction: { representation: "MEMOIZED_SPARSE_INTEGER_LEVEL_POINTS_WITH_COLLINEAR_CURRENT_SEGMENTS_MERGED", denseFromZero: false, evaluatedCurrentStatePoints: sparseCurrentPoints.length, mergedCurrentStateBreakpoints: mergedCurrentPoints },
      renewalAffordabilityStatus: renewActual.reason || "AVAILABLE",
      freshPayoutReachableAfterRenewal: !(renewHypothetical && renewHypothetical.cannotReachFreshPayout)
    };
  }

  return {
    OBJECTIVE_VERSION: OBJECTIVE_VERSION, POLICY_VERSION: POLICY_VERSION, HORIZON_VERSION: HORIZON_VERSION,
    RENEWAL_COST: RENEWAL_COST, RENEWAL_GENERATION_PER_HOUR: RENEWAL_GENERATION_PER_HOUR,
    MAX_RENEWALS: MAX_RENEWALS, MAX_PAYOUT_EPOCHS: MAX_PAYOUT_EPOCHS, MAX_BREAKPOINTS: MAX_BREAKPOINTS,
    solveBellRenewalPolicy: solveBellRenewalPolicy, policyAssumptions: policyAssumptions
  };
}());
