"use strict";
window.BellOptimizer = window.BellOptimizer || {};

BellOptimizer.bellTargetViewModel = (function () {
  function freeze(value){return BellOptimizer.bellDashboardViewModel.deepFreeze(value);}
  function planChanges(plan,format,baseState,baseRate){var changes=BellOptimizer.bellDashboardViewModel.decorateChanges((plan&&plan.recommendedChanges)||[],baseState,format,{});if(changes.length&&Number.isFinite(baseRate)){changes[0].rateBefore=baseRate;changes[0].rateBeforeDisplay=format(baseRate)+"/hr";}return changes;}
  function build(result,format,baseState){
    if(typeof format!=="function")return freeze({ok:false,state:"invalid",message:"Target number formatting is unavailable."});
    if(!result||!result.ok)return freeze({ok:false,state:"invalid",title:"Enter a valid Ring Rate goal",message:result&&result.error?result.error.message:"The Ring Rate goal could not be calculated."});
    var status=result.deterministic.status,common={ok:true,currentDisplay:format(result.current.rate)+"/hr",goalDisplay:format(result.targetRate)+"/hr",semantic:status};
    if(status==="TARGET_ALREADY_MET")return freeze(Object.assign(common,{state:"already-met",title:"Goal already reached",message:"No purchases needed.",plan:[]}));
    if(status==="TARGET_REACHABLE_NOW")return freeze(Object.assign(common,{state:"reachable",title:common.goalDisplay+" is reachable with current resources",planReachesDisplay:format(result.deterministic.targetPlan.rate)+"/hr",plan:planChanges(result.deterministic.targetPlan,format,baseState,result.current.rate)}));
    if(status==="TARGET_REACHABLE_NOW_BOUNDED_PLAN")return freeze(Object.assign(common,{state:"partial",title:"Goal appears reachable",message:"A concise purchase plan could not be completed within the current safety limit.",plan:[]}));
    return freeze(Object.assign(common,{state:"unreachable",title:common.goalDisplay+" isn’t reachable with current resources",bestDisplay:format(result.deterministic.maximumAffordableRate)+"/hr",shortfallDisplay:format(result.deterministic.shortfall.absolute)+"/hr",plan:planChanges(result.deterministic.maximumPlan,format,baseState,result.current.rate),collectibleEntryAvailable:true}));
  }
  return {build:build};
}());
