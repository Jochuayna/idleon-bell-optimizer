"use strict";

global.window = {};
global.BellOptimizer = window.BellOptimizer = {};
["bell-mechanics", "target-evaluator", "bell-renewal-candidate-analysis", "bell-renewal-policy", "bell-renewal-policy-approx"].forEach(function (name) {
  require("../js/" + name + ".js");
});

var M = BellOptimizer.bellMechanics;
var A = BellOptimizer.bellRenewalPolicyApprox;
var depths = [2, 4, 6, 8];

function rateFor(count, startRaw) {
  var total = 0;
  startRaw = startRaw || 0;
  for (var i = startRaw; i < startRaw + count; i++) total += M.calculateRingingRequirement(i);
  return total + Math.max(1e-7, total * 1e-12);
}

function base(overrides) {
  return Object.assign({
    selectedRewardIndex: 0,
    currentSelectedLevel: 100,
    rewardLevels: [100, 0, 0, 0, 0, 0, 0],
    currentRawRingIndex: 0,
    currentRingingExp: 0,
    ringingExpPerHour: rateFor(40),
    cavernsOwned: 18,
    bellUpgrade42Owned: true,
    bellUpgrade60Owned: true,
    bellUpgrade86Owned: true,
    majorBellBonus: 940,
    currentRenewalCurrency: 200,
    horizonHours: 1
  }, overrides || {});
}

var cases = [
  { id: "A_STRONG_CURRENT", options: base({ currentRawRingIndex: 300, ringingExpPerHour: rateFor(100), currentSelectedLevel: 5000, rewardLevels: [5000,0,0,0,0,0,0] }) },
  { id: "B_WEAK_CURRENT", options: base({ currentRawRingIndex: 300, ringingExpPerHour: rateFor(100), currentSelectedLevel: 0, rewardLevels: [0,0,0,0,0,0,0] }) },
  { id: "C_NEAR_FRESH", options: base({ currentSelectedLevel: 3, rewardLevels: [3,0,0,0,0,0,0], currentRenewalCurrency: 25 }) },
  { id: "D_HIGH_CURRENCY", options: base({ currentRenewalCurrency: 1000 }) },
  { id: "E_LOW_CURRENCY", options: base({ currentRenewalCurrency: 0 }) },
  { id: "F_HIGH_VARIANCE_EARLY", options: base({ currentRawRingIndex: 18, ringingExpPerHour: rateFor(40,18), currentSelectedLevel: 0, rewardLevels: [0,0,0,0,0,0,0] }) },
  { id: "G_FAST_EARLY_PAYOUTS", options: base({ ringingExpPerHour: rateFor(100) }) },
  { id: "H_LARGE_MAJOR", options: base({ majorBellBonus: 5000 }) },
  { id: "I_SEVEN_REWARDS", options: base({ cavernsOwned: 18 }) },
  { id: "J_SIX_REWARDS", options: base({ cavernsOwned: 11, selectedRewardIndex: 5, rewardLevels: [0,0,0,0,0,100,0] }) }
];

var output = cases.map(function (scenario) {
  return {
    id: scenario.id,
    results: depths.map(function (depth) {
      var started = Date.now();
      var result = A.solveHybridPolicy(scenario.options, {
        maxRenewalsModeled: depth,
        maximumValueError: 0.5,
        maxBreakpointsPerFunction: 1024
      });
      return {
        depth: depth,
        ok: result.ok,
        status: result.status,
        action: result.action,
        threshold: result.reservationLevelEstimate,
        thresholdBounds: [result.reservationLevelLowerBound, result.reservationLevelUpperBound],
        value: result.expectedTerminalLevelEstimate,
        valueBounds: [result.expectedTerminalLevelLowerBound, result.expectedTerminalLevelUpperBound],
        advantage: result.expectedAdvantageEstimate,
        error: result.accumulatedValueErrorBound,
        deepestRenewalLayerAffectingValue: result.performance && result.performance.deepestRenewalLayerAffectingValue,
        runtimeMilliseconds: Date.now() - started
      };
    })
  };
});

console.log(JSON.stringify(output, null, 2));
