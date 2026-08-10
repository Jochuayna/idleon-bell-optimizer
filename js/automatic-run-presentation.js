"use strict";
window.BellOptimizer=window.BellOptimizer||{};
BellOptimizer.automaticRunPresentation=(function(){
  var CONFIDENCE_BANDS=Object.freeze({balancedSuperiority:0.55,balancedEffect:0.10,strongSuperiority:0.85,strongEffect:0.75,boundaryDistance:0.03});
  function finite(value){return typeof value==="number"&&Number.isFinite(value);}
  function formatProbability(value){if(!finite(value))return "—";var percent=Math.max(0,Math.min(1,value))*100;if(percent===0||percent===100)return percent.toFixed(0)+"%";if(percent<.1)return percent.toFixed(2).replace(/0+$/,"" ).replace(/\.$/,"")+"%";if(percent<10)return percent.toFixed(1).replace(/\.0$/,"" )+"%";return percent.toFixed(1).replace(/\.0$/,"" )+"%";}
  function mathematicalDirection(comparison){if(!comparison||!finite(comparison.expectedDifference))return "UNAVAILABLE";if(Math.abs(comparison.expectedDifference)<1e-12)return "BALANCED";return comparison.expectedDifference>0?"CONTINUE":"RESET";}
  function directionalConfidence(comparison,machineResult){
    var direction=mathematicalDirection(comparison);if(direction==="UNAVAILABLE")return {key:"UNAVAILABLE",label:"Confidence unavailable",direction:direction,approximateBoundary:false};
    if(direction==="BALANCED")return {key:"BALANCED",label:"Nearly balanced",direction:direction,approximateBoundary:false};
    var superiority=direction==="CONTINUE"?comparison.continueSuperiority:comparison.resetSuperiority;
    var effect=Math.abs(comparison.expectedDifferenceAsPooledIQR==null?0:comparison.expectedDifferenceAsPooledIQR);
    var prefix=direction==="CONTINUE"?"Continue":"Reset",key,label;
    if(superiority<CONFIDENCE_BANDS.balancedSuperiority||effect<CONFIDENCE_BANDS.balancedEffect){key="NEARLY_BALANCED";label="Nearly balanced";}
    else if(superiority>=CONFIDENCE_BANDS.strongSuperiority&&effect>=CONFIDENCE_BANDS.strongEffect){key="STRONG_"+direction;label="Strong "+prefix+" advantage";}
    else if((direction==="CONTINUE"&&superiority>=.60&&effect>=.20)||(direction==="RESET"&&superiority>=2/3&&effect>=.25)||(direction==="RESET"&&superiority>=.60&&effect>=.25)){key="MODERATE_"+direction;label="Moderate "+prefix+" advantage";}
    else {key="SLIGHT_"+direction;label="Slight "+prefix+" lean";}
    var policy=BellOptimizer.automaticRunEvaluation.POLICY;
    var near=Boolean(machineResult&&machineResult.nearThreshold)||comparison.approximate&&(Math.abs(superiority-(direction==="CONTINUE"?policy.continueSuperiority:policy.resetSuperiority))<=CONFIDENCE_BANDS.boundaryDistance||effect>0&&Math.abs(effect-(direction==="CONTINUE"?policy.continueEffect:policy.resetEffect))<=CONFIDENCE_BANDS.boundaryDistance);
    return {key:key,label:label,direction:direction,superiority:superiority,effect:effect,approximateBoundary:near};
  }
  function rewardStatus(result){if(!result||!result.ok)return {key:"UNAVAILABLE",heading:"Evaluation unavailable",description:"Required imported Bell data is incomplete."};if(result.continuePath.status==="LOCKED_REWARD_DETERMINISTIC")return {key:"LOCKED",heading:"Not currently selectable",description:"This reward is not currently part of your Bell reward pool, so there is no meaningful run evaluation for it yet."};if(result.continuePath.status==="DETERMINISTIC")return {key:"DETERMINISTIC",heading:"Unlocked and deterministic",description:"The modeled outcome has no remaining variance over this outlook."};return {key:"STOCHASTIC",heading:"Unlocked and stochastic",description:"This reward is currently selectable and modeled with its verified Bell probabilities."};}
  function decisionPresentation(result){
    var status=rewardStatus(result);if(status.key==="LOCKED")return {key:"REWARD_LOCKED",heading:"REWARD LOCKED",summary:status.description,showNormalDecision:false,mathematicalDirection:"BALANCED",confidence:{key:"LOCKED",label:"Not currently selectable"}};
    if(status.key==="UNAVAILABLE")return {key:"EVALUATION_UNAVAILABLE",heading:"EVALUATION UNAVAILABLE",summary:status.description,showNormalDecision:false,mathematicalDirection:"UNAVAILABLE",confidence:{key:"UNAVAILABLE",label:"Confidence unavailable"}};
    var direction=mathematicalDirection(result.comparison),confidence=directionalConfidence(result.comparison,result.recommendation),machine=result.recommendation;
    if(machine.primaryReason==="RESET_UNAFFORDABLE")return {key:"CONTINUE_FOR_NOW",heading:"CONTINUE FOR NOW",badge:"Reset is mathematically favored",summary:"A fresh run is projected to perform better, but you do not currently have enough renewal currency. Continue this run or wait until renewal becomes available.",showNormalDecision:true,mathematicalDirection:"RESET",confidence:confidence};
    var headings={CONTINUE:"CONTINUE",RESET:"RESET",EITHER_IS_REASONABLE:"EITHER IS REASONABLE"};
    return {key:machine.recommendation,heading:headings[machine.recommendation]||"EVALUATION UNAVAILABLE",badge:confidence.label,summary:machine.primaryReason.replace(/_/g," ").toLowerCase()+".",showNormalDecision:true,mathematicalDirection:direction,confidence:confidence};
  }
  function goalClassification(evaluation){var p=evaluation.probabilityOfTarget;if(p>=.50)return "Realistic";if(p>=.15)return "Ambitious";if(p>=.02)return "Exceptional";if(p>=.0001)return "Moonshot";return "Outside modeled range";}
  function optionalGoalCheck(snapshot,rewardIndex,targetLevel,automaticResult){
    if(!finite(targetLevel)||targetLevel<0)return {ok:false,error:"Enter a finite, nonnegative target level."};var mechanics=snapshot.mechanicsForReward(rewardIndex);
    function evaluate(level,currentRing,targetRing){return BellOptimizer.targetEvaluator.evaluateTarget(Object.assign({currentLevel:level,currentRing:currentRing,targetLevel:targetLevel,targetRing:targetRing},mechanics));}
    var continuing=evaluate(snapshot.rewardLevels[rewardIndex],snapshot.currentRawRingIndex+1,automaticResult.continuePath.endingRingingState.humanRing),reset=evaluate(0,0,automaticResult.resetPath.endingRingingState.humanRing);if(!continuing.ok||!reset.ok)return {ok:false,error:"The optional goal distribution could not be calculated."};
    var difference=continuing.probabilityOfTarget-reset.probabilityOfTarget,best=Math.max(continuing.probabilityOfTarget,reset.probabilityOfTarget),classification=goalClassification({probabilityOfTarget:best}),moonshot=best<.02;
    return {ok:true,targetLevel:targetLevel,continueChance:continuing.probabilityOfTarget,resetChance:reset.probabilityOfTarget,percentagePointDifference:difference*100,classification:classification,moonshot:moonshot,message:moonshot?((difference>=0?"Continuing":"A reset")+" has technically higher odds by "+Math.abs(difference*100).toFixed(2)+" percentage points, but this remains a moonshot either way."):"This target check does not change the automatic recommendation.",continueEvaluation:continuing,resetEvaluation:reset};
  }
  return {CONFIDENCE_BANDS:CONFIDENCE_BANDS,formatProbability:formatProbability,mathematicalDirection:mathematicalDirection,directionalConfidence:directionalConfidence,rewardStatus:rewardStatus,decisionPresentation:decisionPresentation,goalClassification:goalClassification,optionalGoalCheck:optionalGoalCheck};
}());
