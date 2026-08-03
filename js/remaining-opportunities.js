"use strict";
window.BellOptimizer = window.BellOptimizer || {};

BellOptimizer.remainingOpportunities = (function () {
  var WINDOW_HOURS = 24;
  var WINDOW_COUNT = 3;

  function analyze(options) {
    var raw = options.startingRawRingIndex;
    var progress = options.startingRingingExp;
    var windows = [];
    for (var index = 0; index < WINDOW_COUNT; index += 1) {
      var result = BellOptimizer.gainPace.evaluateWindow(Object.assign({}, options, {
        durationHours: WINDOW_HOURS,
        startingRawRingIndex: raw,
        startingRingingExp: progress,
        startingSelectedRewardLevel: 0
      }));
      if (!result.ok) return result;
      result.periodStartHour = index * WINDOW_HOURS;
      result.periodEndHour = (index + 1) * WINDOW_HOURS;
      result.endingRequirementExp = BellOptimizer.bellMechanics.calculateRingingRequirement(result.endingRawRing);
      windows.push(result);
      raw = result.endingRawRing;
      progress = result.endingRingingExp;
    }
    return { ok: true, windows: windows, laterDailyPace: describeDailyPace(windows[2].ringsCompleted) };
  }

  function describeDailyPace(rolls) {
    if (rolls === 0) return "less than 1 roll per day";
    if (rolls === 1) return "about 1 roll per day";
    if (rolls === 2) return "about 2 rolls per day";
    if (rolls <= 5) return "about 3–5 rolls per day";
    return "about " + Math.round(rolls) + " rolls per day";
  }

  function countPhrase(count, singular, plural) {
    return Math.round(count).toLocaleString() + " " + (Math.round(count) === 1 ? singular : plural);
  }

  function headingForQuality(quality) {
    return {
      "ABSOLUTELY COOKED": "Why this run is cooked",
      COOKED: "Why this run is cooked",
      "WEAK RUN": "Why this run is weak",
      "SAVEABLE RUN": "Why this run is still saveable",
      "STRONG RUN": "Why this run is worth keeping",
      "EXCEPTIONAL RUN": "Why this run is exceptional",
      "GOD RUN": "Why this run is exceptional"
    }[quality] || "Why this recommendation makes sense";
  }

  function buildExplanation(options) {
    var first = options.windows[0];
    var rollText = countPhrase(first.ringsCompleted, "Bell roll", "Bell rolls");
    var majorText = first.majorRingsCrossed === 0 ? "none of them are major payouts" : "including " + countPhrase(first.majorRingsCrossed, "major payout", "major payouts");
    var remainingOpportunityText = first.majorRingsCrossed === 0 ? rollText + " coming in the next 24 hours, but none of them are major payouts" : rollText + " and " + countPhrase(first.majorRingsCrossed, "major payout", "major payouts") + " coming in the next 24 hours";
    var paragraphs = [];
    if (options.quality === "ABSOLUTELY COOKED" || options.quality === "COOKED" || options.quality === "WEAK RUN") {
      paragraphs.push("At your current Bell EXP rate, you’ll get about " + rollText + " in the next 24 hours, " + majorText + ".");
      paragraphs.push("After that, progress slows to " + options.laterDailyPace + ". The Bell can continue indefinitely. The Bell keeps slowing as ring requirements increase.");
      paragraphs.push("Your high-end likely " + options.objectiveName + " result is about " + options.format(options.p90) + ", " + (options.p90 < options.target * 0.75 ? "far below" : "below") + " your " + options.format(options.target) + " goal.");
    } else if (options.quality === "SAVEABLE RUN") {
      paragraphs.push("You still have about " + remainingOpportunityText + ", so this run still has some room to improve.");
      paragraphs.push("Your likely " + options.objectiveName + " range is " + options.format(options.p25) + "–" + options.format(options.p90) + " against a goal of " + options.format(options.target) + ".");
      paragraphs.push("After that, progress slows to " + options.laterDailyPace + ". The Bell can continue indefinitely. The Bell keeps slowing as ring requirements increase.");
    } else {
      paragraphs.push("You still have about " + remainingOpportunityText + ", and the run is already ahead of a fresh reset for this goal.");
      paragraphs.push("Your likely " + options.objectiveName + " range is " + options.format(options.p25) + "–" + options.format(options.p90) + ".");
      paragraphs.push("After that, progress slows to " + options.laterDailyPace + ". The Bell can continue indefinitely. The Bell keeps slowing as ring requirements increase.");
    }
    return {
      heading: headingForQuality(options.quality),
      paragraphs: paragraphs,
      note: "This range accounts for how many Bell rolls remain, how many are major payouts, and the chance each roll lands on " + options.objectiveName + "."
    };
  }

  return { WINDOW_HOURS: WINDOW_HOURS, WINDOW_COUNT: WINDOW_COUNT, analyze: analyze, describeDailyPace: describeDailyPace, countPhrase: countPhrase, headingForQuality: headingForQuality, buildExplanation: buildExplanation };
}());
