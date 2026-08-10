"use strict";
window.BellOptimizer = window.BellOptimizer || {};

BellOptimizer.runBellRenewalCandidateAnalysisTests = function () {
  var tests=[];
  function test(name,fn){try{fn();tests.push({name:name,passed:true});}catch(error){tests.push({name:name,passed:false,error:error.message});}}
  function assert(value,message){if(!value)throw new Error(message||"Assertion failed");}
  function close(a,b,t,message){assert(Math.abs(a-b)<=t,(message||"Values differ")+": "+a+" vs "+b);}
  function base(overrides){return Object.assign({selectedRewardIndex:0,rewardLevels:[10,10,10,10,10,10,10],currentRawRingIndex:0,currentRingingExp:0,ringingExpPerHour:100,cavernsOwned:18,bellUpgrade42Owned:true,bellUpgrade60Owned:true,bellUpgrade86Owned:true,majorBellBonus:20,currentRenewalCurrency:50},overrides||{});}
  function analyze(overrides){return BellOptimizer.bellRenewalCandidateAnalysis.analyzeBellRenewalCandidates(base(overrides));}
  function reason(result,tag){return result.candidates.filter(function(x){return x.candidate.reasonTags.indexOf(tag)!==-1;});}
  function sumRequirements(start,count){var total=0;for(var raw=start;raw<start+count;raw+=1)total+=BellOptimizer.bellMechanics.calculateRingingRequirement(raw);return total+1e-7;}
  var api=BellOptimizer.bellRenewalCandidateAnalysis;

  test("module versions are explicit",function(){assert(api.MODEL_VERSION==="bell-renewal-candidate-analysis-v1"&&api.HORIZON_POLICY_VERSION==="bell-renewal-horizon-v1");});
  test("fresh current state analyzes",function(){assert(analyze({rewardLevels:[0,0,0,0,0,0,0]}).ok);});
  test("zero elapsed compares current against fresh",function(){var r=analyze(),c=r.candidates[0];assert(c.candidate.elapsedHours===0&&c.freshSameTimeProjection.futureRings===0);});
  test("strong early run preserves current level",function(){var r=analyze({rewardLevels:[1000,0,0,0,0,0,0]}),c=r.candidates[r.candidates.length-1];assert(c.currentProjection.expectedFinalRewardLevel>=1000);});
  test("weak early run analyzes independently",function(){assert(analyze({rewardLevels:[0,100,100,100,100,100,100]}).ok);});
  test("strong late run has quality context",function(){var r=analyze({currentRawRingIndex:80,rewardLevels:[1000,10,10,10,10,10,10]});assert(r.candidates[0].runQualityContext.tier.ok);});
  test("weak late run remains valid",function(){assert(analyze({currentRawRingIndex:80,rewardLevels:[1,100,100,100,100,100,100]}).ok);});
  test("average run with many rolls has candidates",function(){assert(analyze({ringingExpPerHour:1e10}).candidates.length>10);});
  test("average run with few rolls has contained candidates",function(){assert(analyze({currentRawRingIndex:100,ringingExpPerHour:1}).candidates.length>=2);});
  test("one ring before major includes major",function(){assert(reason(analyze({currentRawRingIndex:18,horizonHours:10}),"MAJOR_RING").some(function(x){return x.candidate.rawRingIndex===19;}));});
  test("two rings before major includes before and major",function(){var r=analyze({currentRawRingIndex:17,horizonHours:10});assert(reason(r,"BEFORE_MAJOR").length&&reason(r,"MAJOR_RING").length);});
  test("nineteen rings before major retains near rings",function(){var r=analyze({currentRawRingIndex:0,horizonHours:10});assert(reason(r,"NEAR_TERM_RING").length>5);});
  test("multiple majors are represented",function(){assert(reason(analyze({ringingExpPerHour:1e10}),"MAJOR_RING").length>2);});
  test("high rate includes many majors",function(){assert(reason(analyze({ringingExpPerHour:1e20}),"MAJOR_RING").length>20);});
  test("large major bonus changes major context",function(){var a=reason(analyze({majorBellBonus:0}),"MAJOR_RING")[0],b=reason(analyze({majorBellBonus:1000}),"MAJOR_RING")[0];assert(b.majorContext.expectedSelectedRewardGainFromMajor>a.majorContext.expectedSelectedRewardGainFromMajor);});
  test("zero major bonus is accepted",function(){assert(analyze({majorBellBonus:0}).ok);});
  test("four reward pool selection probability",function(){close(analyze({cavernsOwned:0}).selectionProbability,.25,1e-12);});
  test("six reward pool selection probability",function(){close(analyze({cavernsOwned:11}).selectionProbability,1/6,1e-12);});
  test("seven reward pool selection probability",function(){close(analyze({cavernsOwned:16}).selectionProbability,1/7,1e-12);});
  test("whole-ring double enabled increases major variance",function(){var a=reason(analyze({bellUpgrade86Owned:false}),"MAJOR_RING")[0],b=reason(analyze({bellUpgrade86Owned:true}),"MAJOR_RING")[0];assert(b.majorContext.majorSelectedRewardVariance>a.majorContext.majorSelectedRewardVariance);});
  test("whole-ring double disabled remains valid",function(){assert(analyze({bellUpgrade86Owned:false}).ok);});
  test("one immediate banked ring is a candidate",function(){var r=analyze({currentRingingExp:sumRequirements(0,1),horizonHours:1});assert(r.boundarySummary.immediateBankedRings===1&&reason(r,"IMMEDIATE_BANKED_RING").length===1);});
  test("many immediate banked rings are candidates",function(){var r=analyze({currentRingingExp:sumRequirements(0,8),horizonHours:1});assert(r.boundarySummary.immediateBankedRings===8&&reason(r,"IMMEDIATE_BANKED_RING").length===8);});
  test("banked major is represented",function(){var r=analyze({currentRawRingIndex:18,currentRingingExp:sumRequirements(18,1),horizonHours:1});assert(reason(r,"MAJOR_RING").some(function(x){return x.candidate.rawRingIndex===19;}));});
  test("zero-time banked payout has no infinite rate",function(){var r=analyze({currentRingingExp:sumRequirements(0,2),horizonHours:1}),c=reason(r,"IMMEDIATE_BANKED_RING")[0];assert(c.marginalEfficiency.status==="IMMEDIATE_BANKED_PAYOUT"&&c.marginalEfficiency.selectedRewardGainPerHour===null);});
  test("five-roll milestone included",function(){assert(reason(analyze(),"FAST_SLOWDOWN").length===1);});
  test("three-roll milestone included",function(){assert(reason(analyze(),"PRACTICAL_SLOWDOWN").length===1);});
  test("one-roll milestone included",function(){assert(reason(analyze(),"DEEP_SLOWDOWN").length===1);});
  test("horizon candidate included",function(){assert(reason(analyze(),"HORIZON_BOUNDARY").length===1);});
  test("duplicate boundary reason tags merge",function(){var r=analyze(),deep=reason(r,"DEEP_SLOWDOWN")[0];assert(deep.candidate.reasonTags.indexOf("FINAL_REACHABLE_RING")!==-1||deep.candidate.reasonTags.indexOf("HORIZON_BOUNDARY")!==-1);});
  test("every major through horizon represented",function(){var r=analyze({ringingExpPerHour:1e10}),final=r.boundarySummary.finalReachableRawRing,expected=0;for(var raw=r.boundarySummary.normalizedRawRingIndex+1;raw<=final;raw+=1)if((raw+1)%20===0)expected++;assert(reason(r,"MAJOR_RING").length===expected);});
  test("current expected finish is monotonic by raw boundary",function(){var r=analyze(),last=-Infinity;r.candidates.slice().sort(function(a,b){return a.candidate.rawRingIndex-b.candidate.rawRingIndex||a.candidate.elapsedHours-b.candidate.elapsedHours;}).forEach(function(c){assert(c.currentProjection.expectedFinalRewardLevel+1e-9>=last);last=c.currentProjection.expectedFinalRewardLevel;});});
  test("all quantiles are ordered",function(){analyze().candidates.forEach(function(c){var p=c.currentProjection;assert(p.p10<=p.p25&&p.p25<=p.medianFinalRewardLevel&&p.medianFinalRewardLevel<=p.p75&&p.p75<=p.p90);});});
  test("same-time fresh uses exact elapsed time",function(){analyze().candidates.forEach(function(c){assert(c.freshSameTimeProjection.timeUntilTaperHours===c.candidate.elapsedHours);});});
  test("exact same-time comparison exists",function(){assert(analyze().candidates.some(function(c){return !c.sameTimeComparison.approximate;}));});
  test("approximate same-time comparison exists",function(){assert(analyze({ringingExpPerHour:1e20}).candidates.some(function(c){return c.sameTimeComparison.approximate;}));});
  test("replacement context uses candidate median",function(){var c=analyze().candidates[0];assert(c.replacementContext.median.threshold===c.currentProjection.medianFinalRewardLevel);});
  test("replacement probability falls with threshold",function(){var c=analyze().candidates[0].replacementContext;assert(c.p25.probabilityGreater>=c.median.probabilityGreater&&c.median.probabilityGreater>=c.p75.probabilityGreater);});
  test("replacement attempts rise as probability falls",function(){var c=analyze().candidates[0].replacementContext;if(c.p25.estimatedAttempts&&c.p75.estimatedAttempts)assert(c.p25.estimatedAttempts<=c.p75.estimatedAttempts);});
  test("tiny replacement probability is bounded",function(){var c=analyze({rewardLevels:[1e9,0,0,0,0,0,0]}).candidates[0].replacementContext.median;assert(c.status==="NOT_REALISTICALLY_REPLACEABLE"&&c.estimatedAttempts===null);});
  test("replacement thresholds are ordered",function(){var c=analyze().candidates[0];assert(c.replacementContext.p25.threshold<=c.replacementContext.median.threshold&&c.replacementContext.median.threshold<=c.replacementContext.p75.threshold);});
  test("renewal unaffordable now",function(){assert(analyze({currentRenewalCurrency:24}).candidates[0].affordability.renewalsAffordableNow===0);});
  test("renewal affordable now",function(){assert(analyze({currentRenewalCurrency:25}).candidates[0].affordability.renewalsAffordableNow===1);});
  test("renewal currency generation follows elapsed time",function(){var c=analyze().candidates.slice(-1)[0];close(c.affordability.currencyGeneratedByCandidateTime,c.candidate.elapsedHours*10,1e-9);});
  test("ordinary segment has marginal efficiency",function(){assert(analyze().candidates.some(function(c){return c.marginalEfficiency.status==="AVAILABLE"&&!c.marginalEfficiency.containsMajorPayout;}));});
  test("major segment is marked",function(){assert(analyze().candidates.some(function(c){return c.marginalEfficiency.containsMajorPayout;}));});
  test("strong run quality is independent from marginal rate",function(){var r=analyze({currentRawRingIndex:100,rewardLevels:[1e6,0,0,0,0,0,0],ringingExpPerHour:1}),c=r.candidates[0];assert(c.runQualityContext.tier.tierKey==="EXCEPTIONAL_RUN"&&c.marginalEfficiency.status==="REFERENCE_POINT");});
  test("weak run can retain positive marginal efficiency",function(){var r=analyze({currentRawRingIndex:18,rewardLevels:[0,100,100,100,100,100,100],majorBellBonus:1000,horizonHours:10});assert(r.candidates.some(function(c){return c.marginalEfficiency.containsMajorPayout&&c.marginalEfficiency.segmentExpectedGain>0;}));});
  test("same mean different variance does not imply dominance",function(){var a={startingRewardLevel:0,distribution:Float64Array.from([.5,0,.5])},b={startingRewardLevel:0,distribution:Float64Array.from([0,1])};assert(!api.firstOrderStochasticallyDominates(a,b)&&!api.firstOrderStochasticallyDominates(b,a));});
  test("safe first-order dominance is detected",function(){var a={startingRewardLevel:0,distribution:Float64Array.from([0,1])},b={startingRewardLevel:0,distribution:Float64Array.from([1])};assert(api.firstOrderStochasticallyDominates(a,b));});
  test("safe candidate dominance is marked without removal",function(){var better={candidate:{id:"a",elapsedHours:0,rawRingIndex:1,endingProgressExp:0},currentProjection:{startingRewardLevel:0,distribution:Float64Array.from([0,1])},affordability:{projectedRenewalCurrency:25}},worse={candidate:{id:"b",elapsedHours:1,rawRingIndex:1,endingProgressExp:0},currentProjection:{startingRewardLevel:0,distribution:Float64Array.from([1])},affordability:{projectedRenewalCurrency:35}},rows=api.markSafeDominance([better,worse]);assert(rows.length===2&&rows[1].dominated&&rows[1].dominatedByCandidateId==="a");});
  test("expected value alone cannot establish dominance",function(){var a={startingRewardLevel:0,distribution:null,expectedFinalRewardLevel:10},b={startingRewardLevel:0,distribution:null,expectedFinalRewardLevel:1};assert(!api.firstOrderStochasticallyDominates(a,b));});
  test("locked reward is contained",function(){var r=analyze({selectedRewardIndex:6,cavernsOwned:10});assert(!r.ok&&r.code==="LOCKED_REWARD");});
  test("invalid rate is contained",function(){var r=analyze({ringingExpPerHour:0});assert(!r.ok&&r.code==="RATE_UNAVAILABLE");});
  test("repeated inputs are deterministic",function(){var a=analyze(),b=analyze();assert(JSON.stringify(a)===JSON.stringify(b));});
  test("input state is not mutated",function(){var o=base(),before=JSON.stringify(o);api.analyzeBellRenewalCandidates(o);assert(JSON.stringify(o)===before);});
  test("target input is rejected",function(){assert(analyze({targetLevel:100}).code==="INVALID_MECHANICS");});
  test("Lantern input is rejected",function(){assert(analyze({lanternHours:2}).code==="INVALID_MECHANICS");});
  test("taper model version unchanged",function(){assert(BellOptimizer.bellRunForecast.TAPER_POLICY_VERSION==="bell-taper-v1");});
  test("tier model version unchanged",function(){assert(BellOptimizer.bellRunForecast.TIER_MODEL_VERSION==="bell-run-tier-v1");});
  test("forecast schema remains available",function(){assert(BellOptimizer.bellRunForecast.FORECAST_SCHEMA_VERSION==="bell-run-forecast-v1");});
  test("public target evaluator remains available",function(){assert(typeof BellOptimizer.targetEvaluator.evaluateTarget==="function");});
  test("automatic prototype remains available",function(){assert(Boolean(BellOptimizer.automaticRunPrototype));});
  test("Personal History remains available",function(){assert(Boolean(BellOptimizer.bellHistorySnapshot));});
  test("Compare Accounts remains available",function(){assert(Boolean(BellOptimizer.bellBenchmarkComparison));});
  test("analysis has no recommendation",function(){var r=analyze();assert(r.recommendation===null&&r.status==="ANALYSIS_ONLY_NO_RECOMMENDATION");});
  test("only selected reward is evaluated",function(){var r=analyze();assert(r.selectedRewardIndex===0&&!r.rewardForecasts);});
  test("same-time fresh projections are cached",function(){var r=analyze();assert(r.cacheStats.uniqueSameTimeFreshProjections<=r.candidates.length);});
  test("explicit horizon is supported",function(){var r=analyze({horizonHours:2});assert(r.horizon.explicitOverride&&r.horizon.horizonHours===2);});
  test("default horizon reaches deep slowdown",function(){var r=analyze();assert(!r.horizon.explicitOverride&&r.horizon.freshDeepSlowdownRawRing!==null);});
  test("candidate count remains under safety cap",function(){assert(analyze({ringingExpPerHour:1e20}).candidates.length<=api.MAX_CANDIDATES);});
  test("extreme horizon never emits infinite currency",function(){var r=analyze({ringingExpPerHour:1e-300,horizonHours:1e308});assert(!r.ok&&r.code==="HORIZON_UNAVAILABLE");});

  return {passed:tests.filter(function(x){return x.passed;}).length,total:tests.length,results:tests};
};
