"use strict";
window.BellOptimizer = window.BellOptimizer || {};

BellOptimizer.bellDashboardViewModel = (function () {
  function deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.keys(value).forEach(function (key) { deepFreeze(value[key]); });
    return Object.freeze(value);
  }
  function percent(value) {
    if (typeof value !== "number" || !Number.isFinite(value)) return "Unavailable";
    return (value * 100).toFixed(value * 100 >= 10 ? 1 : 2).replace(/\.0$/, "") + "%";
  }
  function decorateChanges(changes,baseState,format,pools) {
    var levels=baseState&&Array.isArray(baseState.bellMethodLevels)?baseState.bellMethodLevels.slice(0,6):null,rateBefore=null;
    return (changes||[]).map(function(change){
      var pool=pools&&pools[change.resourcePoolId],index=/^bell-method-([0-5])$/.test(change.candidateId)?Number(change.candidateId.slice(-1)):null,beforeMethods=null,afterMethods=null,breakpoints=0;
      if(levels&&index!=null){beforeMethods=BellOptimizer.bellMechanics.calculateBellImprovementMethods(levels,baseState.upgrade45Owned);levels[index]+=change.levelsGained;afterMethods=BellOptimizer.bellMechanics.calculateBellImprovementMethods(levels,baseState.upgrade45Owned);breakpoints=Math.max(0,afterMethods.upgrade45Exponent-beforeMethods.upgrade45Exponent);}
      var bridge=(index===1||index===3)&&breakpoints>0,item={id:change.candidateId,name:change.source,currentLevel:change.currentValue,targetLevel:change.targetValue,levelsGained:change.levelsGained,resource:change.resource&&change.resource.name?change.resource.name:"Unknown resource",cost:change.totalCost,costDisplay:format(change.totalCost),remaining:pool&&Number.isFinite(pool.remaining)?pool.remaining:change.remainingBalance,remainingDisplay:pool&&Number.isFinite(pool.remaining)?format(pool.remaining):Number.isFinite(change.remainingBalance)?format(change.remainingBalance):"Unavailable",rateBefore:rateBefore,rateBeforeDisplay:Number.isFinite(rateBefore)?format(rateBefore)+"/hr":null,rateAfter:change.cumulativeProjectedRate,rateAfterDisplay:format(change.cumulativeProjectedRate)+"/hr",semantic:"VERIFIED_CURRENTLY_AFFORDABLE",isMethodScalingBridge:bridge,bridgeVia:bridge?change.source:null,methodBreakpointsCrossed:breakpoints,methodMultiplierBefore:beforeMethods&&beforeMethods.upgrade45Multiplier,methodMultiplierAfter:afterMethods&&afterMethods.upgrade45Multiplier,methodMultiplierBeforeDisplay:beforeMethods?"×"+format(beforeMethods.upgrade45Multiplier):null,methodMultiplierAfterDisplay:afterMethods?"×"+format(afterMethods.upgrade45Multiplier):null};
      rateBefore=change.cumulativeProjectedRate;return item;
    });
  }
  function build(input) {
    input=input||{};
    var format=input.formatter,optimizer=input.optimizerResult,next=input.nextTargets||{purchases:[],methodThreshold:null};
    if(typeof format!=="function")return deepFreeze({ok:false,state:"unavailable",message:"Dashboard number formatting is unavailable."});
    if(!optimizer||!optimizer.ok)return deepFreeze({ok:false,state:"partial",message:"Your save was imported, but a complete Ring Rate optimization is unavailable.",warnings:input.warnings||[]});
    var pools=Object.create(null);(optimizer.resourcePools||[]).forEach(function(pool){pools[pool.resourcePoolId]=pool;});
    var changes=decorateChanges(optimizer.recommendedChanges,input.baseState,format,pools);if(changes.length)changes[0].rateBefore=optimizer.currentRate,changes[0].rateBeforeDisplay=format(optimizer.currentRate)+"/hr";
    var unavailable=(optimizer.excludedOpportunities||[]),lockedCount=unavailable.filter(function(item){return item.reason==="LOCKED_OR_PROGRESSION_GATED"||item.reason==="CAPPED";}).length;
    var purchases=(next.purchases||[]).slice(0,3).map(function(item){return {id:item.candidateId,name:item.source,currentLevel:item.currentLevel,nextLevel:item.nextLevel,resource:item.resource&&item.resource.name?item.resource.name:"Unknown resource",cost:item.nextCost,costDisplay:format(item.nextCost),balance:item.currentBalance,balanceDisplay:format(item.currentBalance),shortfall:item.resourceShortfall,shortfallDisplay:format(item.resourceShortfall),projectedRate:item.projectedRateAfterNextPurchase,projectedRateDisplay:format(item.projectedRateAfterNextPurchase)+"/hr",relativeGain:item.relativeGainAfterNextPurchase,relativeGainDisplay:percent(item.relativeGainAfterNextPurchase),semantic:item.semantic};});
    var threshold=next.methodThreshold&&next.methodThreshold.levelsNeeded>0&&next.methodThreshold.levelsNeeded<=5?{currentTotal:next.methodThreshold.currentTotalMethodLevels,nextLevel:next.methodThreshold.nextThreshold,levelsNeeded:next.methodThreshold.levelsNeeded,legalMethods:(next.methodThreshold.legalCandidateMethods||[]).slice(),semantic:next.methodThreshold.semantic}:null;
    return deepFreeze({ok:true,state:changes.length?changes.length===1?"one-upgrade":"optimized":"nothing-affordable",current:{rate:optimizer.currentRate,display:format(optimizer.currentRate)+"/hr",label:"Your Ring Rate"},optimized:{rate:optimizer.optimizedRate,display:format(optimizer.optimizedRate)+"/hr",label:"Your account could reach"},gain:{absolute:optimizer.absoluteGain,absoluteDisplay:"+"+format(optimizer.absoluteGain)+"/hr",relative:optimizer.relativeGain,relativeDisplay:"+"+percent(optimizer.relativeGain)},changes:changes,nextTargets:purchases,methodThreshold:threshold,lockedCount:lockedCount,coinSelectionRequired:(optimizer.excludedOpportunities||[]).some(function(item){return item.candidateId==="bell-method-0"&&item.reason==="RESOURCE_BALANCE_UNRESOLVED";}),warnings:(optimizer.warnings||[]).slice(),completeness:optimizer.completeness});
  }
  return {build:build,deepFreeze:deepFreeze,decorateChanges:decorateChanges};
}());
