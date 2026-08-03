"use strict";
window.BellOptimizer = window.BellOptimizer || {};

BellOptimizer.gainPace = (function () {
  var DEFAULT_WINDOW_COUNT = 10;
  var MILESTONE_PERCENTAGES = [75, 50, 25, 10];
  var DEFAULT_SUBWINDOW_MINUTES = 15;

  function evaluateWindow(options) {
    if (typeof options.durationHours !== "number" || !Number.isFinite(options.durationHours) || options.durationHours <= 0) return { ok: false, error: "Checkpoint duration must be greater than zero." };
    var progression = BellOptimizer.bellMechanics.advanceRingingProgress({ startingRawRingIndex: options.startingRawRingIndex, startingRingingExp: options.startingRingingExp, ringingExpPerHour: options.ringingExpPerHour, durationHours: options.durationHours });
    if (!progression.ok) return progression;
    var majorRingCount = progression.majorRingsCrossed;
    var ordinaryRingCount = progression.ringsCompleted - majorRingCount;
    var expectedRewardGain = options.selectionProbability * (ordinaryRingCount * options.expectedOrdinaryRingGain + majorRingCount * options.expectedMajorRingGain);
    return { ok: true, startingRawRing: options.startingRawRingIndex, endingRawRing: progression.endingRawRing, startingHumanRing: options.startingRawRingIndex + 1, endingHumanRing: progression.endingHumanRing, startingRingingExp: options.startingRingingExp, endingRingingExp: progression.endingProgressExp, ringsCompleted: progression.ringsCompleted, ordinaryRingsCrossed: ordinaryRingCount, majorRingsCrossed: majorRingCount, expectedRewardGain: expectedRewardGain, expectedEndingRewardLevel: options.startingSelectedRewardLevel + expectedRewardGain, expectedGainPerHour: expectedRewardGain / options.durationHours, durationHours: options.durationHours };
  }

  function findMilestones(windows) {
    return MILESTONE_PERCENTAGES.map(function (threshold) {
      var match = windows.find(function (window) { return window.efficiencyPercent <= threshold; });
      return { threshold: threshold, window: match || null };
    });
  }

  function classifyRelativeValue(percent) {
    if (percent >= 75) return "Excellent value";
    if (percent >= 50) return "Good value";
    if (percent >= 25) return "Reduced value";
    if (percent >= 10) return "Very low value";
    return "Negligible value";
  }
  function secondLanternValueMessage(percent) {
    return percent < 10 ? "A second Lantern on the same run has negligible expected value." : classifyRelativeValue(percent) + ".";
  }

  function smoothSubwindowPaces(subwindows) {
    return subwindows.map(function (window, index) {
      var start = Math.max(0, index - 1), end = Math.min(subwindows.length - 1, index + 1), sum = 0;
      for (var neighbor = start; neighbor <= end; neighbor += 1) sum += subwindows[neighbor].expectedGainPerHour;
      return sum / (end - start + 1);
    });
  }

  function groupMilestones(subwindows) {
    var groups = [];
    MILESTONE_PERCENTAGES.forEach(function (threshold) {
      var match = subwindows.find(function (window) { return window.withinLanternEfficiencyPercent <= threshold; });
      if (!match) return;
      var group = groups.find(function (candidate) { return candidate.windowNumber === match.windowNumber; });
      if (!group) { group = { windowNumber: match.windowNumber, window: match, thresholds: [] }; groups.push(group); }
      group.thresholds.push(threshold);
    });
    return groups;
  }

  function analyzeFirstCheckpointSubwindows(options) {
    var subwindowMinutes = options.subwindowMinutes || DEFAULT_SUBWINDOW_MINUTES;
    var subwindowHours = subwindowMinutes / 60;
    var count = Math.round(options.durationHours / subwindowHours);
    if (!Number.isFinite(subwindowMinutes) || subwindowMinutes <= 0 || Math.abs(count * subwindowHours - options.durationHours) > 1e-9 || count < 2) return { ok: false, error: "Checkpoint duration must divide into at least two complete subwindows." };
    var raw = 0, progress = 0, cumulative = 0, subwindows = [];
    for (var index = 0; index < count; index += 1) {
      var result = evaluateWindow(Object.assign({}, options, { durationHours: subwindowHours, startingRawRingIndex: raw, startingRingingExp: progress, startingSelectedRewardLevel: cumulative }));
      if (!result.ok) return result;
      cumulative += result.expectedRewardGain;
      result.windowNumber = index + 1; result.startHour = index * subwindowHours; result.endHour = (index + 1) * subwindowHours; result.cumulativeExpectedRewardLevel = cumulative;
      subwindows.push(result); raw = result.endingRawRing; progress = result.endingRingingExp;
    }
    var smoothed = smoothSubwindowPaces(subwindows);
    var firstThirtyCount = Math.round(0.5 / subwindowHours);
    if (firstThirtyCount < 1 || firstThirtyCount > subwindows.length) return { ok: false, error: "Subwindows must provide the first 30-minute baseline." };
    var baseline = subwindows.slice(0, firstThirtyCount).reduce(function (sum, window) { return sum + window.expectedGainPerHour; }, 0) / firstThirtyCount;
    subwindows.forEach(function (window, index) { window.smoothedGainPerHour = smoothed[index]; window.withinLanternEfficiencyPercent = baseline > 0 ? 100 * smoothed[index] / baseline : null; window.cumulativeGainShare = cumulative > 0 ? window.cumulativeExpectedRewardLevel / cumulative : null; });
    var milestoneGroups = groupMilestones(subwindows);
    var severeGroup = milestoneGroups.find(function (group) { return group.thresholds.indexOf(25) !== -1; });
    return { ok: true, subwindowMinutes: subwindowMinutes, subwindows: subwindows, fullFirstCheckpointExpectedGain: cumulative, firstThirtyMinuteAverageGainPerHour: baseline, milestoneGroups: milestoneGroups, severeSlowdown: severeGroup ? severeGroup.window : null, cumulativeExpectedRewardLevel: cumulative };
  }

  function analyzeFreshRollingWindows(options) {
    var count = options.windowCount === undefined ? DEFAULT_WINDOW_COUNT : options.windowCount;
    if (!Number.isInteger(count) || count < 1 || count > DEFAULT_WINDOW_COUNT) return { ok: false, error: "Analyze between 1 and " + DEFAULT_WINDOW_COUNT + " rolling windows." };
    var raw = 0, progress = 0, cumulative = 0, windows = [];
    for (var index = 0; index < count; index += 1) {
      var windowResult = evaluateWindow(Object.assign({}, options, { startingRawRingIndex: raw, startingRingingExp: progress, startingSelectedRewardLevel: cumulative }));
      if (!windowResult.ok) return { ok: false, error: windowResult.error, windows: windows, safetyStopped: Boolean(windowResult.iterationLimitReached) };
      cumulative += windowResult.expectedRewardGain;
      windowResult.windowNumber = index + 1;
      windowResult.startHour = index * options.durationHours;
      windowResult.endHour = (index + 1) * options.durationHours;
      windowResult.cumulativeExpectedRewardLevel = cumulative;
      windowResult.efficiencyPercent = index === 0 ? 100 : windows[0].expectedRewardGain > 0 ? 100 * windowResult.expectedRewardGain / windows[0].expectedRewardGain : null;
      windowResult.relativeValueClassification = classifyRelativeValue(windowResult.efficiencyPercent === null ? 0 : windowResult.efficiencyPercent);
      windows.push(windowResult);
      raw = windowResult.endingRawRing;
      progress = windowResult.endingRingingExp;
    }
    var milestones = findMilestones(windows);
    var dropOffMilestone = milestones.find(function (milestone) { return milestone.threshold === 25; });
    return { ok: true, windows: windows, freshRunBaselineGain: windows[0].expectedRewardGain, milestones: milestones, efficiencyDropOff: dropOffMilestone && dropOffMilestone.window ? dropOffMilestone.window : null, firstNegligibleWindow: windows.find(function (window) { return window.efficiencyPercent < 10; }) || null, cumulativeExpectedRewardLevel: cumulative };
  }

  function compareCurrentToFresh(options) {
    var current = evaluateWindow(options.current);
    var fresh = evaluateWindow(Object.assign({}, options.fresh, { startingRawRingIndex: 0, startingRingingExp: 0, startingSelectedRewardLevel: 0 }));
    if (!current.ok || !fresh.ok) return { ok: false, error: (current.ok ? fresh : current).error };
    return { ok: true, currentWindow: current, freshWindow: fresh, currentEfficiencyPercent: fresh.expectedRewardGain > 0 ? 100 * current.expectedRewardGain / fresh.expectedRewardGain : null };
  }

  return { DEFAULT_WINDOW_COUNT: DEFAULT_WINDOW_COUNT, DEFAULT_SUBWINDOW_MINUTES: DEFAULT_SUBWINDOW_MINUTES, MILESTONE_PERCENTAGES: MILESTONE_PERCENTAGES, evaluateWindow: evaluateWindow, findMilestones: findMilestones, classifyRelativeValue: classifyRelativeValue, secondLanternValueMessage: secondLanternValueMessage, smoothSubwindowPaces: smoothSubwindowPaces, groupMilestones: groupMilestones, analyzeFirstCheckpointSubwindows: analyzeFirstCheckpointSubwindows, analyzeFreshRollingWindows: analyzeFreshRollingWindows, compareCurrentToFresh: compareCurrentToFresh };
}());
