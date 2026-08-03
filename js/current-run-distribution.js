"use strict";
window.BellOptimizer = window.BellOptimizer || {};

BellOptimizer.currentRunDistribution = (function () {
  function analyze(rewardLevels, cavernsOwned, selectedRewardIndex) {
    if (!Array.isArray(rewardLevels) || rewardLevels.length < BellOptimizer.BELL_REWARDS.length) return { ok: false, error: "Seven imported Bell reward levels are required." };
    var levels = rewardLevels.slice(0, BellOptimizer.BELL_REWARDS.length);
    if (!levels.every(function (level) { return typeof level === "number" && Number.isFinite(level) && level >= 0; })) return { ok: false, error: "Bell reward levels must be finite and nonnegative." };
    var probabilities = BellOptimizer.bellMechanics.getRewardSelectionProbabilities(cavernsOwned);
    if (!probabilities.ok) return probabilities;
    var total = levels.reduce(function (sum, level) { return sum + level; }, 0);
    var rewards = BellOptimizer.BELL_REWARDS.map(function (reward, index) {
      var probability = probabilities.rewards[index];
      return { index: reward.index, name: reward.name, currentLevel: levels[index], shareOfCurrentLevels: total > 0 ? levels[index] / total : 0, available: probability.available, futureSelectionProbability: probability.probability, futureSelectionProbabilityValue: probability.probabilityValue };
    });
    var ranked = total > 0 ? rewards.slice().sort(function (a, b) { return b.shareOfCurrentLevels - a.shareOfCurrentLevels || a.index - b.index; }) : [];
    var lowest = total > 0 ? rewards.slice().sort(function (a, b) { return a.shareOfCurrentLevels - b.shareOfCurrentLevels || a.index - b.index; })[0] : null;
    return { ok: true, totalCurrentBellLevels: total, rewards: rewards, highestShare: ranked[0] || null, lowestShare: lowest, selectedReward: Number.isInteger(selectedRewardIndex) ? rewards[selectedRewardIndex] || null : null, availableRewardCount: probabilities.availableCount, futureSelectionFraction: { numerator: 1, denominator: probabilities.availableCount }, futureSelectionProbabilityValue: 1 / probabilities.availableCount };
  }

  return { analyze: analyze };
}());
