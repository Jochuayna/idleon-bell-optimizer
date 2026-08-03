"use strict";
window.BellOptimizer = window.BellOptimizer || {};

BellOptimizer.objectiveSelection = (function () {
  function resolve(rewardLevels, rewardIndex) {
    if (!Array.isArray(rewardLevels) || rewardLevels.length < 7) return { ok: false, error: "Seven imported Bell reward levels are required." };
    if (!Number.isInteger(rewardIndex) || rewardIndex < 0 || rewardIndex > 6) return { ok: false, error: "The selected Bell reward index must be between 0 and 6." };
    var currentLevel = rewardLevels[rewardIndex];
    if (typeof currentLevel !== "number" || !Number.isFinite(currentLevel) || currentLevel < 0) return { ok: false, error: "The selected Bell reward has an invalid imported level." };
    return { ok: true, rewardIndex: rewardIndex, reward: BellOptimizer.BELL_REWARDS[rewardIndex], currentLevel: currentLevel };
  }

  function pathStartingLevels(currentLevel) {
    if (typeof currentLevel !== "number" || !Number.isFinite(currentLevel) || currentLevel < 0) return { ok: false, error: "The current reward level must be finite and nonnegative." };
    return { ok: true, continueStartingLevel: currentLevel, freshStartingLevel: 0 };
  }

  function projectionPreservesStartingLevel(evaluation, startingLevel) {
    if (!evaluation || !evaluation.ok || !evaluation.percentiles) return false;
    return [evaluation.expectedFinalLevel, evaluation.percentiles.p25, evaluation.percentiles.median, evaluation.percentiles.p75, evaluation.percentiles.p90].every(function (value) {
      return typeof value === "number" && Number.isFinite(value) && value >= startingLevel;
    });
  }

  return { resolve: resolve, pathStartingLevels: pathStartingLevels, projectionPreservesStartingLevel: projectionPreservesStartingLevel };
}());
