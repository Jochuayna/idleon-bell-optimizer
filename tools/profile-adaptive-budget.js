"use strict";

global.window = {};
global.BellOptimizer = window.BellOptimizer = {};
["bell-mechanics", "target-evaluator", "bell-renewal-candidate-analysis", "bell-renewal-policy", "bell-renewal-policy-approx"].forEach(function (name) {
  require("../js/" + name + ".js");
});

var M = BellOptimizer.bellMechanics;
var A = BellOptimizer.bellRenewalPolicyApprox;
var payouts = Number(process.argv[2] || 160);
var mode = process.argv[3] || "adaptive";
var profiled = process.argv[4] !== "unprofiled";
var renewalDepth = Number(process.argv[5] || 8);

function rateFor(count) {
  var total = 0;
  for (var i = 0; i < count; i++) total += M.calculateRingingRequirement(i);
  return total + Math.max(1e-7, total * 1e-12);
}

var options = {
  selectedRewardIndex: 0,
  currentSelectedLevel: 0,
  rewardLevels: [0, 0, 0, 0, 0, 0, 0],
  currentRawRingIndex: 0,
  currentRingingExp: 0,
  ringingExpPerHour: rateFor(payouts),
  cavernsOwned: 18,
  bellUpgrade42Owned: true,
  bellUpgrade60Owned: true,
  bellUpgrade86Owned: true,
  majorBellBonus: 940,
  currentRenewalCurrency: 200,
  horizonHours: 1
};
var configuration = {
  maxRenewalsModeled: renewalDepth,
  maximumValueError: 0.5,
  maxBreakpointsPerFunction: 1024,
  errorBudgetMode: mode,
  profilePerformance: profiled
};
var started = Date.now();
var result = A.solveHybridPolicy(options, configuration);
var diagnostic = result.breakpointDiagnostic || null;
var performance = result.performance || {};
var output = {
  payouts: payouts,
  renewalDepth: renewalDepth,
  mode: mode,
  runtimeSeconds: (Date.now() - started) / 1000,
  ok: result.ok,
  status: result.status,
  action: result.action,
  threshold: result.reservationLevelEstimate,
  thresholdBounds: [result.reservationLevelLowerBound, result.reservationLevelUpperBound],
  errorBound: result.accumulatedValueErrorBound,
  expectedTerminalPolicyValue: result.expectedTerminalLevelEstimate,
  expectedTerminalBounds: [result.expectedTerminalLevelLowerBound, result.expectedTerminalLevelUpperBound],
  continueNowValue: result.continueValueEstimate,
  renewNowValue: result.renewValueEstimate,
  expectedAdvantage: result.expectedAdvantageEstimate,
  maximumRenewalDepthReached: result.maximumRenewalDepthReached,
  futurePayoutEpochs: result.futurePayoutEpochs,
  performance: {
    graphNodesDiscovered: performance.graphNodesDiscovered,
    graphEdgesDiscovered: performance.graphEdgesDiscovered,
    nodesEvaluated: performance.nodesEvaluated,
    maximumBreakpointsRetained: performance.maximumBreakpointsRetained,
    breakpointsBeforeCompression: performance.breakpointsBeforeCompression,
    breakpointsAfterCompression: performance.breakpointsAfterCompression,
    expectationShiftedPointsVisited: performance.expectationShiftedPointsVisited,
    adaptiveBudgetEnabled: performance.adaptiveBudgetEnabled,
    localAllowanceMinimum: performance.localAllowanceMinimum,
    localAllowanceMedian: performance.localAllowanceMedian,
    localAllowanceP75: performance.localAllowanceP75,
    localAllowanceP90: performance.localAllowanceP90,
    localAllowanceMaximum: performance.localAllowanceMaximum,
    localErrorUsedMinimum: performance.localErrorUsedMinimum,
    localErrorUsedMedian: performance.localErrorUsedMedian,
    localErrorUsedP90: performance.localErrorUsedP90,
    localErrorUsedMaximum: performance.localErrorUsedMaximum,
    globalHeadroomMinimum: performance.globalHeadroomMinimum,
    globalHeadroomAtRoot: performance.globalHeadroomAtRoot,
    nodesWithZeroCompressionError: performance.nodesWithZeroCompressionError,
    nodesUsingLessThan25PercentAllowance: performance.nodesUsingLessThan25PercentAllowance,
    nodesUsing25To75PercentAllowance: performance.nodesUsing25To75PercentAllowance,
    nodesUsingMoreThan75PercentAllowance: performance.nodesUsingMoreThan75PercentAllowance,
    maxCompressionSlotsToRoot: performance.maxCompressionSlotsToRoot,
    globalBudgetViolations: performance.globalBudgetViolations
    ,deepestRenewalLayerAffectingValue: performance.deepestRenewalLayerAffectingValue
    ,renewalValueAffectingNodesByTargetDepth: performance.renewalValueAffectingNodesByTargetDepth
  },
  times: result.performanceProfile ? result.performanceProfile.times : null,
  counts: result.performanceProfile ? result.performanceProfile.counts : null,
  breakpointDiagnostic: diagnostic ? Object.assign({}, diagnostic, { sanitizedReplay: undefined }) : null
};
if (diagnostic && diagnostic.sanitizedReplay) {
  var replay = diagnostic.sanitizedReplay;
  var adaptiveAllowance = A.budgeting.adaptiveAllowance(
    diagnostic.totalConfiguredErrorBudget,
    diagnostic.accumulatedChildError,
    diagnostic.remainingCompressionSlotsToRoot
  );
  var adaptive = A.piecewise.compress({
    points: replay.points,
    tailSlope: replay.tailSlope,
    errorBound: replay.errorBound
  }, adaptiveAllowance, replay.maxPoints);
  output.replayComparison = {
    inheritedError: diagnostic.accumulatedChildError,
    remainingCompressionSlotsToRoot: diagnostic.remainingCompressionSlotsToRoot,
    uniformAllowance: diagnostic.localCompressionAllowance,
    uniformRetainedBreakpoints: diagnostic.postCompressionBreakpointCount,
    adaptiveAllowance: adaptiveAllowance,
    adaptiveSucceeded: adaptive.ok,
    adaptiveRetainedBreakpoints: adaptive.ok ? adaptive.value.points.length : adaptive.compressedBreakpointCount,
    adaptiveLocalErrorUsed: adaptive.ok ? adaptive.value.compression.localCompressionError : adaptive.breakpointDiagnostic && adaptive.breakpointDiagnostic.achievedLocalCompressionError,
    adaptiveResultingError: adaptive.ok ? adaptive.value.errorBound : null,
    adaptiveRemainingHeadroom: adaptive.ok ? diagnostic.totalConfiguredErrorBudget - adaptive.value.errorBound : null
  };
}
console.log(JSON.stringify(output, null, 2));
