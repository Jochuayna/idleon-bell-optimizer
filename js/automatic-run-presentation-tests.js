"use strict";
window.BellOptimizer=window.BellOptimizer||{};
BellOptimizer.runAutomaticRunPresentationTests=function(){
  var tests=[];function test(name,fn){try{fn();tests.push({name:name,passed:true});}catch(error){tests.push({name:name,passed:false,error:error.message});}}function assert(value,message){if(!value)throw new Error(message||"Assertion failed");}function close(a,b,t){assert(Math.abs(a-b)<=t,a+" != "+b);}
  var presentation=BellOptimizer.automaticRunPresentation,prototype=BellOptimizer.automaticRunPrototype;
  function comparison(direction,superiority,effect,approximate){var cont=direction==="CONTINUE"?superiority:1-superiority,reset=1-cont,difference=direction==="CONTINUE"?5:-5;return {expectedDifference:difference,continueSuperiority:cont,resetSuperiority:reset,expectedDifferenceAsPooledIQR:direction==="CONTINUE"?effect:-effect,approximate:Boolean(approximate)};}
  function machine(recommendation,reason){return {recommendation:recommendation||"EITHER_IS_REASONABLE",primaryReason:reason||"SUPERIORITY_TOO_CLOSE",supportingReasons:[],nearThreshold:false};}
  function result(options){options=options||{};return {ok:true,continuePath:{status:options.status||"AVAILABLE",expectedFinalRewardLevel:10},resetPath:{expectedFinalRewardLevel:15},comparison:options.comparison||comparison("RESET",.8,.5,false),recommendation:options.machine||machine("RESET","RESET_MEANINGFUL_ADVANTAGE"),qualitySoFar:{grade:{label:"TYPICAL RUN"}}};}
  function baseOptions(overrides){return Object.assign({selectedRewardIndex:0,currentRewardLevel:8,currentRawRingIndex:2,currentRingingExp:0,ringingExpPerHour:100,durationHours:1,selectionProbability:.25,ordinaryGainDistribution:[{gain:1,probabilityValue:1,probability:1}],majorGainDistribution:[{gain:6,probabilityValue:1,probability:1}],expectedOrdinaryRingGain:1,expectedMajorRingGain:6,currentRenewalCurrency:25,mechanicsStableThroughoutRun:true},overrides||{});}
  function snapshot(){var mechanics={selectionProbability:.25,ordinaryGainDistribution:[{gain:1,probabilityValue:1,probability:1}],majorGainDistribution:[{gain:6,probabilityValue:1,probability:1}],expectedOrdinaryRingGain:1,expectedMajorRingGain:6};return {rewardLevels:[8,0,0,0,0,0,0],currentRawRingIndex:2,currentRingingExp:0,ringingExpPerHour:100,currentRenewalCurrency:25,renewalCurrencyPerHour:10,renewalCost:25,mechanicsForReward:function(){return mechanics;}};}
  test("prototype hidden outside developer mode",function(){assert(!prototype.shouldInitialize({enabled:false}));});
  test("prototype initializes only with developer gate",function(){assert(prototype.shouldInitialize({enabled:true}));});
  test("automatic engine works without target",function(){assert(BellOptimizer.automaticRunEvaluation.evaluate(baseOptions()).ok);});
  test("automatic engine continues rejecting target",function(){assert(BellOptimizer.automaticRunEvaluation.evaluate(baseOptions({targetLevel:20})).code==="TARGET_NOT_ACCEPTED");});
  test("changing external target cannot change grade",function(){var automatic=BellOptimizer.automaticRunEvaluation.evaluate(baseOptions());var before=automatic.qualitySoFar.grade.gradeKey;presentation.optionalGoalCheck(snapshot(),0,10,automatic);presentation.optionalGoalCheck(snapshot(),0,1000,automatic);assert(automatic.qualitySoFar.grade.gradeKey===before);});
  test("changing external target cannot change recommendation",function(){var automatic=BellOptimizer.automaticRunEvaluation.evaluate(baseOptions()),before=automatic.recommendation.recommendation;presentation.optionalGoalCheck(snapshot(),0,10,automatic);presentation.optionalGoalCheck(snapshot(),0,1000,automatic);assert(automatic.recommendation.recommendation===before);});
  test("optional goal result changes independently",function(){var automatic=BellOptimizer.automaticRunEvaluation.evaluate(baseOptions()),low=presentation.optionalGoalCheck(snapshot(),0,1,automatic),high=presentation.optionalGoalCheck(snapshot(),0,1000,automatic);assert(low.ok&&high.ok&&low.continueChance!==high.continueChance);});
  test("optional trivial goal is classified Realistic",function(){var automatic=BellOptimizer.automaticRunEvaluation.evaluate(baseOptions()),goal=presentation.optionalGoalCheck(snapshot(),0,0,automatic);assert(goal.classification==="Realistic");});
  test("locked reward suppresses normal grade",function(){assert(!presentation.decisionPresentation(result({status:"LOCKED_REWARD_DETERMINISTIC"})).showNormalDecision);});
  test("locked reward says Not currently selectable",function(){assert(presentation.rewardStatus(result({status:"LOCKED_REWARD_DETERMINISTIC"})).heading==="Not currently selectable");});
  test("locked reward does not show Continue or Reset",function(){assert(presentation.decisionPresentation(result({status:"LOCKED_REWARD_DETERMINISTIC"})).heading==="REWARD LOCKED");});
  test("unaffordable Reset shows Continue for now",function(){var view=presentation.decisionPresentation(result({machine:machine("EITHER_IS_REASONABLE","RESET_UNAFFORDABLE")}));assert(view.heading==="CONTINUE FOR NOW");});
  test("unaffordable Reset preserves mathematical direction",function(){var view=presentation.decisionPresentation(result({machine:machine("EITHER_IS_REASONABLE","RESET_UNAFFORDABLE")}));assert(view.mathematicalDirection==="RESET"&&view.badge==="Reset is mathematically favored");});
  test("renewal currency uses shared formatter",function(){assert(BellOptimizer.idleonNumberFormat.format(25)==="25"&&BellOptimizer.idleonNumberFormat.format(1202.5)==="1.2K");});
  test("Strong Continue confidence",function(){assert(presentation.directionalConfidence(comparison("CONTINUE",.9,1),machine()).label==="Strong Continue advantage");});
  test("Moderate Continue confidence",function(){assert(presentation.directionalConfidence(comparison("CONTINUE",.65,.3),machine()).label==="Moderate Continue advantage");});
  test("Slight Continue confidence",function(){assert(presentation.directionalConfidence(comparison("CONTINUE",.58,.23),machine()).label==="Slight Continue lean");});
  test("Nearly balanced confidence",function(){assert(presentation.directionalConfidence(comparison("CONTINUE",.52,.05),machine()).label==="Nearly balanced");});
  test("Slight Reset confidence",function(){assert(presentation.directionalConfidence(comparison("RESET",.58,.15),machine()).label==="Slight Reset lean");});
  test("Moderate Reset confidence",function(){assert(presentation.directionalConfidence(comparison("RESET",.63,.35),machine()).label==="Moderate Reset advantage");});
  test("Strong Reset confidence",function(){assert(presentation.directionalConfidence(comparison("RESET",.9,1),machine()).label==="Strong Reset advantage");});
  test("confidence does not mutate machine recommendation",function(){var m=machine("EITHER_IS_REASONABLE"),before=m.recommendation;presentation.directionalConfidence(comparison("CONTINUE",.9,1),m);assert(m.recommendation===before);});
  test("exact mode survives automatic projection",function(){assert(BellOptimizer.automaticRunEvaluation.evaluate(baseOptions()).continuePath.calculationMode==="Exact analytical");});
  test("approximate mode survives automatic projection",function(){assert(BellOptimizer.automaticRunEvaluation.evaluate(baseOptions({durationHours:48,ringingExpPerHour:1e15})).continuePath.calculationMode==="Analytical approximation");});
  test("projection exposes P25-P75",function(){var x=BellOptimizer.automaticRunEvaluation.evaluate(baseOptions()).continuePath;assert(Number.isFinite(x.p25)&&Number.isFinite(x.p75)&&x.p25<=x.p75);});
  test("projection exposes P10-P90",function(){var x=BellOptimizer.automaticRunEvaluation.evaluate(baseOptions()).continuePath;assert(Number.isFinite(x.p10)&&Number.isFinite(x.p90)&&x.p10<=x.p90);});
  test("expected difference direction is correct",function(){assert(presentation.mathematicalDirection({expectedDifference:-1})==="RESET"&&presentation.mathematicalDirection({expectedDifference:1})==="CONTINUE");});
  test("probability formatting rejects Infinity",function(){assert(presentation.formatProbability(Infinity)==="—");});
  test("probability formatting rejects NaN",function(){assert(presentation.formatProbability(NaN)==="—");});
  test("moonshot target does not alter main machine result",function(){var automatic=BellOptimizer.automaticRunEvaluation.evaluate(baseOptions()),before=automatic.recommendation.recommendation,goal=presentation.optionalGoalCheck(snapshot(),0,1e9,automatic);assert(goal.ok&&goal.moonshot&&automatic.recommendation.recommendation===before);});
  test("trivial target cannot force God Run",function(){var automatic=BellOptimizer.automaticRunEvaluation.evaluate(baseOptions()),before=automatic.qualitySoFar.grade.gradeKey;presentation.optionalGoalCheck(snapshot(),0,0,automatic);assert(automatic.qualitySoFar.grade.gradeKey===before);});
  test("new session begins without stale automatic result",function(){assert(prototype.createSessionState().automaticResult===null);});
  test("new session begins without stale goal result",function(){assert(prototype.createSessionState().goalResult===null);});
  test("account and goal generations are independent",function(){var s=prototype.createSessionState();assert(s.accountGeneration===0&&s.goalGeneration===0&&s.automaticGeneration===0);});
  test("confidence bands are documented constants",function(){assert(presentation.CONFIDENCE_BANDS.balancedSuperiority===.55&&presentation.CONFIDENCE_BANDS.strongSuperiority===.85);});
  test("approximate boundary is labeled",function(){var c=comparison("CONTINUE",.59,.19,true);assert(presentation.directionalConfidence(c,{nearThreshold:true}).approximateBoundary);});
  test("goal realism Realistic",function(){assert(presentation.goalClassification({probabilityOfTarget:.5})==="Realistic");});
  test("goal realism Ambitious",function(){assert(presentation.goalClassification({probabilityOfTarget:.15})==="Ambitious");});
  test("goal realism Exceptional",function(){assert(presentation.goalClassification({probabilityOfTarget:.02})==="Exceptional");});
  test("goal realism Moonshot",function(){assert(presentation.goalClassification({probabilityOfTarget:.0001})==="Moonshot");});
  test("goal realism Outside modeled range",function(){assert(presentation.goalClassification({probabilityOfTarget:0})==="Outside modeled range");});
  test("optional goal reports percentage-point difference",function(){var automatic=BellOptimizer.automaticRunEvaluation.evaluate(baseOptions()),goal=presentation.optionalGoalCheck(snapshot(),0,10,automatic);close(goal.percentagePointDifference,(goal.continueChance-goal.resetChance)*100,1e-12);});
  return {passed:tests.filter(function(t){return t.passed;}).length,total:tests.length,results:tests};
};
