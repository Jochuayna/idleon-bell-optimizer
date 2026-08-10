"use strict";
window.BellOptimizer = window.BellOptimizer || {};

BellOptimizer.bellRenewalCandidateAnalysis = (function () {
  var MODEL_VERSION = "bell-renewal-candidate-analysis-v1";
  var HORIZON_POLICY_VERSION = "bell-renewal-horizon-v1";
  var RENEWAL_COST = 25;
  var RENEWAL_GENERATION_PER_HOUR = 10;
  var MAX_CANDIDATES = 2500;
  var REPLACEMENT_PROBABILITY_FLOOR = 1e-6;
  var EPSILON = 1e-12;

  function finite(value) { return typeof value === "number" && Number.isFinite(value); }
  function fail(code, reason) { return { ok: false, available: false, code: code, status: code, reason: reason }; }
  function cloneReasons(reasons) { return Array.from(new Set(reasons)).sort(); }
  function requirement(raw) { return BellOptimizer.bellMechanics.calculateRingingRequirement(raw); }
  function countMajors(startRaw, endRaw) { return Math.floor((endRaw + 1) / 20) - Math.floor((startRaw + 1) / 20); }
  function isMajorBoundary(raw) { return raw > 0 && (raw + 1) % 20 === 0; }
  function expToBoundary(startRaw, startProgress, endRaw) {
    if (endRaw <= startRaw) return 0;
    var sum = -startProgress, correction = 0;
    for (var raw = startRaw; raw < endRaw; raw += 1) {
      var value = requirement(raw);
      if (!finite(value)) return null;
      var adjusted = value - correction, next = sum + adjusted;
      correction = (next - sum) - adjusted; sum = next;
    }
    return Math.max(0, sum);
  }
  function timeToBoundary(options, raw) {
    var exp = expToBoundary(options.currentRawRingIndex, options.currentRingingExp, raw);
    return exp === null ? null : exp / options.ringingExpPerHour;
  }
  function validateBase(options) {
    if (!options || !Number.isInteger(options.selectedRewardIndex) || options.selectedRewardIndex < 0 || options.selectedRewardIndex > 6) return fail("INVALID_REWARD_LEVEL", "A selected Bell reward index from 0 through 6 is required.");
    if (!Array.isArray(options.rewardLevels) || options.rewardLevels.length < 7 || !options.rewardLevels.slice(0, 7).every(function (v) { return finite(v) && v >= 0; })) return fail("INVALID_REWARD_LEVEL", "Seven finite nonnegative Bell reward levels are required.");
    if (!Number.isInteger(options.currentRawRingIndex) || options.currentRawRingIndex < 0 || !finite(options.currentRingingExp) || options.currentRingingExp < 0) return fail("INVALID_RINGING_STATE", "The imported Ringing state is invalid.");
    if (!finite(options.ringingExpPerHour) || options.ringingExpPerHour <= 0) return fail("RATE_UNAVAILABLE", "A finite positive reconstructed Bell EXP/hour is required.");
    var probabilities = BellOptimizer.bellMechanics.getRewardSelectionProbabilities(options.cavernsOwned);
    if (!probabilities.ok || typeof options.bellUpgrade42Owned !== "boolean" || typeof options.bellUpgrade60Owned !== "boolean" || typeof options.bellUpgrade86Owned !== "boolean" || !finite(options.majorBellBonus) || options.majorBellBonus < 0) return fail("INVALID_MECHANICS", "Verified reward-pool and Bell payout mechanics are required.");
    if (!probabilities.rewards[options.selectedRewardIndex].available) return fail("LOCKED_REWARD", "The selected Bell reward is locked.");
    return { ok: true, probabilities: probabilities, selectionProbability: probabilities.rewards[options.selectedRewardIndex].probabilityValue };
  }

  function determinePlanningHorizon(options) {
    if (options.horizonHours !== undefined) {
      if (!finite(options.horizonHours) || options.horizonHours < 0) return fail("HORIZON_UNAVAILABLE", "The explicit planning horizon must be finite and nonnegative.");
      var freshExplicit = BellOptimizer.bellMechanics.advanceRingingProgress({ startingRawRingIndex: 0, startingRingingExp: 0, ringingExpPerHour: options.ringingExpPerHour, durationHours: options.horizonHours });
      if (!freshExplicit.ok) return fail("HORIZON_UNAVAILABLE", freshExplicit.error);
      return { ok: true, available: true, policyVersion: HORIZON_POLICY_VERSION, explicitOverride: true, horizonHours: options.horizonHours, freshDeepSlowdownRawRing: null, freshDeepSlowdownHumanRing: null, freshTotalRollsThroughHorizon: freshExplicit.ringsCompleted, freshMajorCountThroughHorizon: freshExplicit.majorRingsCrossed, freshProgression: freshExplicit };
    }
    var deep = BellOptimizer.bellRunForecast.findRingingTaperBoundary({ currentRawRingIndex: 0, currentRingingExp: 0, ringingExpPerHour: options.ringingExpPerHour, policy: { thresholdRolls: 1 } });
    if (!deep.ok) return fail("HORIZON_UNAVAILABLE", deep.reason || "The fresh deep-slowdown horizon is unavailable.");
    var fresh = BellOptimizer.bellMechanics.advanceRingingProgress({ startingRawRingIndex: 0, startingRingingExp: 0, ringingExpPerHour: options.ringingExpPerHour, durationHours: deep.timeUntilTaperHours });
    if (!fresh.ok) return fail("HORIZON_UNAVAILABLE", fresh.error);
    return { ok: true, available: true, policyVersion: HORIZON_POLICY_VERSION, explicitOverride: false, horizonHours: deep.timeUntilTaperHours, freshDeepSlowdownRawRing: deep.taperRawRingIndex, freshDeepSlowdownHumanRing: deep.taperHumanRingNumber, freshTotalRollsThroughHorizon: deep.totalRingsUntilTaper, freshMajorCountThroughHorizon: deep.majorPayoutsRemainingUntilTaper, freshProgression: fresh };
  }

  function addBoundary(map, raw, elapsed, reasons, metadata) {
    if (!Number.isInteger(raw) || raw < 0 || !finite(elapsed) || elapsed < 0) return;
    var key = raw + "|" + elapsed.toPrecision(15);
    var existing = map.get(key);
    if (existing) {
      existing.reasonTags = cloneReasons(existing.reasonTags.concat(reasons));
      Object.keys(metadata || {}).forEach(function (name) { if (existing[name] === undefined) existing[name] = metadata[name]; });
      return existing;
    }
    var item = Object.assign({ id: "candidate-" + (map.size + 1), rawRingIndex: raw, humanRingNumber: raw + 1, elapsedHours: elapsed, reasonTags: cloneReasons(reasons) }, metadata || {});
    map.set(key, item); return item;
  }

  function generateRenewalCandidateBoundaries(options) {
    var validation = validateBase(options); if (!validation.ok) return validation;
    var horizon = options.horizon || determinePlanningHorizon(options); if (!horizon.ok) return horizon;
    var normalized = BellOptimizer.bellMechanics.advanceRingingProgress({ startingRawRingIndex: options.currentRawRingIndex, startingRingingExp: options.currentRingingExp, ringingExpPerHour: options.ringingExpPerHour, durationHours: 0 });
    if (!normalized.ok) return fail("INVALID_RINGING_STATE", normalized.error);
    var horizonProgression = BellOptimizer.bellMechanics.advanceRingingProgress({ startingRawRingIndex: options.currentRawRingIndex, startingRingingExp: options.currentRingingExp, ringingExpPerHour: options.ringingExpPerHour, durationHours: horizon.horizonHours });
    if (!horizonProgression.ok) return fail("CANDIDATE_SEARCH_LIMIT", horizonProgression.error);
    var finalRaw = horizonProgression.endingRawRing;
    var map = new Map();
    addBoundary(map, options.currentRawRingIndex, 0, ["CURRENT_STATE"], { endingProgressExp: options.currentRingingExp });
    for (var immediateRaw = options.currentRawRingIndex + 1; immediateRaw <= normalized.endingRawRing; immediateRaw += 1) {
      var immediateReasons = ["IMMEDIATE_BANKED_RING"];
      if (isMajorBoundary(immediateRaw)) immediateReasons.push("MAJOR_RING");
      var spentToImmediate = expToBoundary(options.currentRawRingIndex, 0, immediateRaw);
      addBoundary(map, immediateRaw, 0, immediateReasons, { immediateBanked: true, endingProgressExp: Math.max(0, options.currentRingingExp - spentToImmediate) });
      if (map.size > MAX_CANDIDATES) return fail("CANDIDATE_SEARCH_LIMIT", "Candidate count exceeded the safety limit.");
    }
    var futureMajors = [];
    for (var raw = normalized.endingRawRing + 1; raw <= finalRaw; raw += 1) if (isMajorBoundary(raw)) futureMajors.push(raw);
    var secondMajor = futureMajors.length >= 2 ? futureMajors[1] : finalRaw;
    for (var near = normalized.endingRawRing + 1; near <= Math.min(finalRaw, secondMajor); near += 1) {
      var nearReasons = [near === normalized.endingRawRing + 1 ? "NEXT_RING" : "NEAR_TERM_RING"];
      if (isMajorBoundary(near + 1)) nearReasons.push("BEFORE_MAJOR");
      if (isMajorBoundary(near)) nearReasons.push("MAJOR_RING");
      if (isMajorBoundary(near - 1)) nearReasons.push("AFTER_MAJOR");
      addBoundary(map, near, timeToBoundary(options, near), nearReasons);
    }
    futureMajors.forEach(function (majorRaw) {
      if (majorRaw - 1 >= normalized.endingRawRing) addBoundary(map, majorRaw - 1, timeToBoundary(options, majorRaw - 1), ["BEFORE_MAJOR"]);
      addBoundary(map, majorRaw, timeToBoundary(options, majorRaw), ["MAJOR_RING"]);
      if (majorRaw + 1 <= finalRaw) addBoundary(map, majorRaw + 1, timeToBoundary(options, majorRaw + 1), ["AFTER_MAJOR"]);
    });
    [[5,"FAST_SLOWDOWN"],[3,"PRACTICAL_SLOWDOWN"],[1,"DEEP_SLOWDOWN"]].forEach(function (entry) {
      var milestone = BellOptimizer.bellRunForecast.findRingingTaperBoundary({ currentRawRingIndex: options.currentRawRingIndex, currentRingingExp: options.currentRingingExp, ringingExpPerHour: options.ringingExpPerHour, policy: { thresholdRolls: entry[0] } });
      if (milestone.ok && milestone.timeUntilTaperHours <= horizon.horizonHours + EPSILON) addBoundary(map, milestone.taperRawRingIndex, milestone.timeUntilTaperHours, [entry[1]], { paceMilestone: { thresholdRolls: entry[0], rollsInFollowing24Hours: milestone.rollsInNextWindowAtTaper } });
    });
    var finalBoundaryTime = timeToBoundary(options, finalRaw);
    addBoundary(map, finalRaw, finalBoundaryTime, ["FINAL_REACHABLE_RING"]);
    addBoundary(map, finalRaw, horizon.horizonHours, ["HORIZON_BOUNDARY"], { endingProgressExp: horizonProgression.endingProgressExp });
    if (map.size > MAX_CANDIDATES) return fail("CANDIDATE_SEARCH_LIMIT", "Candidate count exceeded the safety limit.");
    var candidates = Array.from(map.values()).sort(function (a,b) { return a.elapsedHours - b.elapsedHours || a.rawRingIndex - b.rawRingIndex || a.id.localeCompare(b.id); });
    candidates.forEach(function (candidate,index) { candidate.id = "candidate-" + index; });
    return { ok: true, available: true, modelVersion: MODEL_VERSION, horizon: horizon, originalRawRingIndex: options.currentRawRingIndex, normalizedRawRingIndex: normalized.endingRawRing, normalizedRingingExp: normalized.endingProgressExp, immediateBankedRings: normalized.ringsCompleted, finalReachableRawRing: finalRaw, candidates: candidates };
  }

  function makeTaper(startRaw, endRaw, elapsed) {
    return { ok: true, taperRawRingIndex: endRaw, timeUntilTaperHours: elapsed, ringsRemainingUntilTaper: endRaw - startRaw, majorPayoutsRemainingUntilTaper: countMajors(startRaw, endRaw) };
  }
  function projectCurrentPathToCandidate(options, candidate) {
    return BellOptimizer.bellRunForecast.projectRewardToTaper(Object.assign({}, options, { currentRewardLevel: options.rewardLevels[options.selectedRewardIndex], taper: makeTaper(options.currentRawRingIndex, candidate.rawRingIndex, candidate.elapsedHours) }));
  }
  function projectFreshPathForSameTime(options, elapsedHours) {
    var progression = BellOptimizer.bellMechanics.advanceRingingProgress({ startingRawRingIndex: 0, startingRingingExp: 0, ringingExpPerHour: options.ringingExpPerHour, durationHours: elapsedHours });
    if (!progression.ok) return fail("CANDIDATE_SEARCH_LIMIT", progression.error);
    var freshOptions = Object.assign({}, options, { rewardLevels: [0,0,0,0,0,0,0], currentRawRingIndex: 0, currentRingingExp: 0, currentRewardLevel: 0 });
    var projected = BellOptimizer.bellRunForecast.projectRewardToTaper(Object.assign({}, freshOptions, { taper: makeTaper(0, progression.endingRawRing, elapsedHours) }));
    if (projected.ok) projected.sameTimeProgression = progression;
    return projected;
  }

  function cdfAt(path, threshold, strict) {
    var additionalThreshold = threshold - path.startingRewardLevel;
    if (path.distribution) {
      var cutoff = strict ? Math.floor(additionalThreshold) : Math.ceil(additionalThreshold) - 1;
      var cumulative = 0;
      for (var i=0;i<=Math.min(cutoff,path.distribution.length-1);i+=1) if (i>=0) cumulative += path.distribution[i];
      return Math.max(0,Math.min(1,1-cumulative));
    }
    if (path.variance <= EPSILON) return strict ? (path.expectedFinalRewardLevel > threshold ? 1 : 0) : (path.expectedFinalRewardLevel >= threshold ? 1 : 0);
    var boundary = strict ? threshold + .5 : threshold - .5;
    return Math.max(0,Math.min(1,1-BellOptimizer.targetEvaluator.normalCdf((boundary-path.expectedFinalRewardLevel)/Math.sqrt(path.variance))));
  }
  function replacementAtThreshold(freshComplete, threshold, freshDurationHours) {
    var greater = cdfAt(freshComplete, threshold, true), atLeast = cdfAt(freshComplete, threshold, false);
    if (greater < REPLACEMENT_PROBABILITY_FLOOR) return { threshold: threshold, probabilityGreater: greater, probabilityAtLeast: atLeast, status: "NOT_REALISTICALLY_REPLACEABLE", estimatedAttempts: null, estimatedFreshRunHours: null, estimatedRenewalCurrency: null };
    var attempts = 1 / greater;
    var hours = attempts * freshDurationHours, currency = attempts * RENEWAL_COST;
    if (!finite(hours) || !finite(currency)) return { threshold: threshold, probabilityGreater: greater, probabilityAtLeast: atLeast, status: "REPLACEMENT_ESTIMATE_OUT_OF_RANGE", estimatedAttempts: null, estimatedFreshRunHours: null, estimatedRenewalCurrency: null };
    return { threshold: threshold, probabilityGreater: greater, probabilityAtLeast: atLeast, status: "ESTIMATE_AVAILABLE", estimatedAttempts: attempts, estimatedFreshRunHours: hours, estimatedRenewalCurrency: currency };
  }
  function calculateCandidateReplacementContext(candidatePath, freshComplete) {
    var duration = freshComplete.taper.timeUntilTaperHours;
    return { defaultThreshold: "MEDIAN", median: replacementAtThreshold(freshComplete,candidatePath.medianFinalRewardLevel,duration), p25: replacementAtThreshold(freshComplete,candidatePath.p25,duration), p75: replacementAtThreshold(freshComplete,candidatePath.p75,duration) };
  }
  function calculateCandidateMarginalEfficiency(previous, current) {
    var duration = current.candidate.elapsedHours - previous.candidate.elapsedHours;
    var gain = current.currentProjection.expectedFinalRewardLevel - previous.currentProjection.expectedFinalRewardLevel;
    var rings = current.currentProjection.futureRings - previous.currentProjection.futureRings;
    var majors = current.currentProjection.futureMajorPayouts - previous.currentProjection.futureMajorPayouts;
    var rate = duration > EPSILON ? gain / duration : null;
    var status = duration <= EPSILON && rings > 0 ? "IMMEDIATE_BANKED_PAYOUT" : duration <= EPSILON ? "ZERO_TIME_NO_PAYOUT" : finite(rate) ? "AVAILABLE" : "RATE_OUT_OF_RANGE";
    return { label: "MARGINAL EFFICIENCY", segmentExpectedGain: gain, segmentDurationHours: duration, selectedRewardGainPerHour: finite(rate) ? rate : null, status: status, containsMajorPayout: majors > 0, ordinaryRings: rings - majors, majorRings: majors };
  }

  function firstOrderStochasticallyDominates(a,b) {
    if (!a || !b || !a.distribution || !b.distribution || a.startingRewardLevel !== b.startingRewardLevel) return false;
    var maximum = Math.max(a.distribution.length,b.distribution.length), cdfA=0,cdfB=0,strict=false;
    for(var i=0;i<maximum;i+=1){cdfA += a.distribution[i]||0; cdfB += b.distribution[i]||0; if(cdfA>cdfB+1e-10)return false;if(cdfA<cdfB-1e-10)strict=true;}
    return strict || Math.abs(cdfA-cdfB)<=1e-10;
  }
  function markSafeDominance(results) {
    results.forEach(function (candidate) { candidate.dominated=false;candidate.dominatedByCandidateId=null;candidate.dominanceReason=null; });
    results.forEach(function (candidate,index) {
      for(var i=0;i<results.length;i+=1){if(i===index)continue;var other=results[i];
        var noLater=other.candidate.elapsedHours<=candidate.candidate.elapsedHours+EPSILON;
        var sameOrBetterState=other.candidate.rawRingIndex===candidate.candidate.rawRingIndex && (other.candidate.endingProgressExp||0)>=(candidate.candidate.endingProgressExp||0);
        var noMoreCurrency=true; // Every analyzed candidate has the same verified one-Renewal cost of 25.
        if(noLater&&sameOrBetterState&&noMoreCurrency&&firstOrderStochasticallyDominates(other.currentProjection,candidate.currentProjection)){candidate.dominated=true;candidate.dominatedByCandidateId=other.candidate.id;candidate.dominanceReason="EXACT_FIRST_ORDER_STOCHASTIC_DOMINANCE_WITH_NO_LATER_TIME_AND_EQUAL_STATE";break;}
      }
    }); return results;
  }

  function analyzeRenewalCandidate(options,candidate,freshComplete,freshCache) {
    var current=projectCurrentPathToCandidate(options,candidate);if(!current.ok)return current;
    var cacheKey=String(candidate.elapsedHours),fresh=freshCache.get(cacheKey);
    if(!fresh){fresh=projectFreshPathForSameTime(options,candidate.elapsedHours);freshCache.set(cacheKey,fresh);}if(!fresh.ok)return fresh;
    var comparison=BellOptimizer.bellRunForecast.compareProjectedFinishDistributions(current,fresh);
    var qualityComparison=BellOptimizer.bellRunForecast.compareProjectedFinishDistributions(current,freshComplete);
    var qualityTier=BellOptimizer.bellRunForecast.classifyProjectedRunTier(qualityComparison.currentSuperiority,{approximate:qualityComparison.approximate});
    var currencyNow=options.currentRenewalCurrency,generated=candidate.elapsedHours*RENEWAL_GENERATION_PER_HOUR,projected=currencyNow+generated;
    if(!finite(generated)||!finite(projected))return fail("HORIZON_UNAVAILABLE","The planning horizon produces Renewal-currency values outside the supported numeric range.");
    var affordability={currentRenewalCurrency:currencyNow,renewalCost:RENEWAL_COST,renewalsAffordableNow:Math.floor(currencyNow/RENEWAL_COST),currencyGeneratedByCandidateTime:generated,projectedRenewalCurrency:projected,renewalsAffordableAtCandidate:Math.floor(projected/RENEWAL_COST)};
    var cumulativeGain=current.expectedAdditionalRewardLevels,cumulativeRate=candidate.elapsedHours>EPSILON?cumulativeGain/candidate.elapsedHours:null;
    var freshRate=candidate.elapsedHours>EPSILON?fresh.expectedAdditionalRewardLevels/candidate.elapsedHours:null;
    if(!finite(cumulativeRate))cumulativeRate=null;if(!finite(freshRate))freshRate=null;
    return {ok:true,available:true,candidate:candidate,currentProjection:current,freshSameTimeProjection:fresh,sameTimeComparison:comparison,replacementContext:calculateCandidateReplacementContext(current,freshComplete),affordability:affordability,cumulativeEfficiency:{label:"MARGINAL EFFICIENCY",currentExpectedGainPerHour:cumulativeRate,freshExpectedGainPerHour:freshRate,status:candidate.elapsedHours<=EPSILON?"ZERO_TIME": "AVAILABLE"},runQualityContext:{projectedCompleteRunSuperiority:qualityComparison.currentSuperiority,tier:qualityTier},majorContext:null,dominated:false,dominatedByCandidateId:null,dominanceReason:null};
  }

  function attachMajorContexts(results,options,selectionProbability) {
    var majorDistribution=BellOptimizer.bellMechanics.getMajorRingOutcomeDistribution(options.bellUpgrade42Owned,options.bellUpgrade60Owned,options.majorBellBonus,options.bellUpgrade86Owned,25).afterDouble;
    var selected=BellOptimizer.targetEvaluator.buildSelectedRewardRingDistribution(majorDistribution,selectionProbability);
    var moments=BellOptimizer.targetEvaluator.ringDistributionMoments(selected),byRaw=new Map();results.forEach(function(r){if(!byRaw.has(r.candidate.rawRingIndex)||r.candidate.elapsedHours<(byRaw.get(r.candidate.rawRingIndex).candidate.elapsedHours))byRaw.set(r.candidate.rawRingIndex,r);});
    results.forEach(function(result){if(result.candidate.reasonTags.indexOf("MAJOR_RING")===-1)return;var raw=result.candidate.rawRingIndex,before=byRaw.get(raw-1);result.majorContext={ringsUntilMajor:raw-options.currentRawRingIndex,hoursUntilMajor:result.candidate.elapsedHours,majorHumanRingNumber:raw+1,expectedSelectedRewardGainFromMajor:moments.mean,majorSelectedRewardVariance:moments.variance,expectedCumulativeBeforeMajor:before?before.currentProjection.expectedFinalRewardLevel:null,expectedCumulativeAfterMajor:result.currentProjection.expectedFinalRewardLevel};});
  }

  function analyzeBellRenewalCandidates(options) {
    if(options&&("targetLevel" in options||"targetRing" in options||"lanternHours" in options))return fail("INVALID_MECHANICS","Candidate analysis does not accept target or Lantern inputs.");
    var validation=validateBase(options);if(!validation.ok)return validation;
    if(!finite(options.currentRenewalCurrency)||options.currentRenewalCurrency<0)return fail("INVALID_MECHANICS","Current Renewal currency must be finite and nonnegative.");
    var horizon=determinePlanningHorizon(options);if(!horizon.ok)return horizon;
    var boundaries=generateRenewalCandidateBoundaries(Object.assign({},options,{horizon:horizon}));if(!boundaries.ok)return boundaries;
    var freshComplete=BellOptimizer.bellRunForecast.buildFreshTaperBaseline(Object.assign({},options,{currentRewardLevel:0,policy:{thresholdRolls:1}}));if(!freshComplete.ok)return freshComplete;
    var cache=new Map(),results=[];
    for(var i=0;i<boundaries.candidates.length;i+=1){var analyzed=analyzeRenewalCandidate(options,boundaries.candidates[i],freshComplete,cache);if(!analyzed.ok)return analyzed;results.push(analyzed);}
    results.sort(function(a,b){return a.candidate.elapsedHours-b.candidate.elapsedHours||a.candidate.rawRingIndex-b.candidate.rawRingIndex;});
    for(var j=0;j<results.length;j+=1)results[j].marginalEfficiency=j===0?{label:"MARGINAL EFFICIENCY",status:"REFERENCE_POINT",segmentExpectedGain:0,segmentDurationHours:0,selectedRewardGainPerHour:null,containsMajorPayout:false,ordinaryRings:0,majorRings:0}:calculateCandidateMarginalEfficiency(results[j-1],results[j]);
    attachMajorContexts(results,options,validation.selectionProbability);markSafeDominance(results);
    return {ok:true,available:true,status:"ANALYSIS_ONLY_NO_RECOMMENDATION",modelVersion:MODEL_VERSION,horizonPolicyVersion:HORIZON_POLICY_VERSION,horizon:horizon,boundarySummary:boundaries,freshCompleteBaseline:freshComplete,candidates:results,selectedRewardIndex:options.selectedRewardIndex,selectionProbability:validation.selectionProbability,renewalConstants:{cost:RENEWAL_COST,generationPerHour:RENEWAL_GENERATION_PER_HOUR},recommendation:null,cacheStats:{uniqueSameTimeFreshProjections:cache.size}};
  }

  return {MODEL_VERSION:MODEL_VERSION,HORIZON_POLICY_VERSION:HORIZON_POLICY_VERSION,RENEWAL_COST:RENEWAL_COST,RENEWAL_GENERATION_PER_HOUR:RENEWAL_GENERATION_PER_HOUR,MAX_CANDIDATES:MAX_CANDIDATES,determinePlanningHorizon:determinePlanningHorizon,generateRenewalCandidateBoundaries:generateRenewalCandidateBoundaries,projectCurrentPathToCandidate:projectCurrentPathToCandidate,projectFreshPathForSameTime:projectFreshPathForSameTime,calculateCandidateReplacementContext:calculateCandidateReplacementContext,calculateCandidateMarginalEfficiency:calculateCandidateMarginalEfficiency,firstOrderStochasticallyDominates:firstOrderStochasticallyDominates,markSafeDominance:markSafeDominance,analyzeRenewalCandidate:analyzeRenewalCandidate,analyzeBellRenewalCandidates:analyzeBellRenewalCandidates};
}());
