"use strict";
window.BellOptimizer = window.BellOptimizer || {};

BellOptimizer.bellRateOptimizer = (function () {
  var STATE_LIMIT = 50000;
  function finite(value) { return typeof value === "number" && Number.isFinite(value); }
  function clone(state) { return JSON.parse(JSON.stringify(state)); }
  function projections(rate) {
    var mechanics = BellOptimizer.bellMechanics;
    function at(hours) { return mechanics.advanceRingingProgress({ startingRawRingIndex:0, startingRingingExp:0, ringingExpPerHour:rate, durationHours:hours }); }
    return { twoHours:at(2), fortyEightHours:at(48) };
  }
  function score(rate, objective) {
    if (objective === "two-hour-rolls") return projections(rate).twoHours.ringsCompleted;
    if (objective === "forty-eight-hour-rolls") return projections(rate).fortyEightHours.ringsCompleted;
    return rate;
  }
  function applyPurchase(state, candidate) {
    var next = clone(state);
    if (candidate.purchaseKind === "bell-method") {
      next.methodOwnedResources[candidate.purchaseIndex] -= candidate.cost;
      next.bellMethodLevels[candidate.purchaseIndex] += 1;
    } else if (candidate.purchaseKey === "fountainLevel") {
      next.fountainCurrency -= candidate.cost; next.rateInputs.fountainLevel += 1;
    } else if (candidate.purchaseKey === "fountainMarbleLevel") {
      next.marbleCurrency -= candidate.cost; next.rateInputs.fountainMarbleLevel += 1;
    } else if (candidate.purchaseKey === "measurementLevel") {
      next.measurementCurrency -= candidate.cost; next.rateInputs.measurementLevel += 1;
    } else if (candidate.purchaseKey === "monumentCosmoLevel" || candidate.purchaseKey === "measurementCosmoLevel") {
      next.cosmoPointsLeft -= candidate.cost; next.rateInputs[candidate.purchaseKey] += 1;
    } else return null;
    return next;
  }
  function legalCandidates(state, poolId) {
    var result = BellOptimizer.bellRateUpgradeCandidates.generate(state);
    if (!result.ok) return [];
    return result.candidates.filter(function (candidate) {
      return candidate.validationValid !== false && candidate.resourcePoolId === poolId && candidate.deterministicPurchase && candidate.affordableNow && candidate.absoluteRateGain > 0 && candidate.eligibilityCategory === "Purchasable now";
    });
  }
  function optimizePool(baseState, poolId, objective, maxUpgrades, counter) {
    var best = { state:clone(baseState), purchases:[], rate:BellOptimizer.bellRateUpgradeCandidates.recompute(baseState,{}).calculatedRate };
    var seen = Object.create(null); var bounded = false;
    function visit(state, purchases) {
      if (counter.count >= STATE_LIMIT) { bounded = true; return; }
      counter.count += 1;
      var rate = BellOptimizer.bellRateUpgradeCandidates.recompute(state,{}).calculatedRate;
      var stateScore = score(rate, objective); var bestScore = score(best.rate, objective);
      if (stateScore > bestScore || stateScore === bestScore && rate > best.rate) best = { state:clone(state), purchases:purchases.slice(), rate:rate };
      if (purchases.length >= maxUpgrades) return;
      legalCandidates(state,poolId).forEach(function (candidate) {
        var next = applyPurchase(state,candidate); if (!next) return;
        var key = JSON.stringify(next.bellMethodLevels)+"|"+JSON.stringify(next.rateInputs)+"|"+candidate.resourcePoolId+"|"+(candidate.ownedResource-candidate.cost);
        if (seen[key] != null && seen[key] >= candidate.ownedResource-candidate.cost) return;
        seen[key]=candidate.ownedResource-candidate.cost;
        visit(next,purchases.concat(candidate.id));
      });
    }
    visit(baseState,[]); return { best:best, bounded:bounded };
  }
  function makeStep(state, id, stepNumber, baselineRate) {
    var generated=BellOptimizer.bellRateUpgradeCandidates.generate(state);
    var candidate=generated.candidates.find(function(c){return c.id===id;});
    if (!candidate || !candidate.affordableNow) return null;
    var next=applyPurchase(state,candidate); var after=BellOptimizer.bellRateUpgradeCandidates.recompute(next,{}).calculatedRate;
    var beforeProjection=projections(generated.baselineRate), afterProjection=projections(after);
    return { nextState:next, step:{stepNumber:stepNumber,upgradeId:id,upgradeName:candidate.name,resourcePoolId:candidate.resourcePoolId,levelBefore:candidate.currentLevel,levelAfter:candidate.nextLevel,cost:candidate.cost,resource:candidate.costResource,rateBefore:generated.baselineRate,rateAfter:after,marginalPercentageGain:(after/generated.baselineRate-1)*100,cumulativePercentageGain:(after/baselineRate-1)*100,individualAdditional2HourRolls:afterProjection.twoHours.ringsCompleted-beforeProjection.twoHours.ringsCompleted,individualAdditional48HourRolls:afterProjection.fortyEightHours.ringsCompleted-beforeProjection.fortyEightHours.ringsCompleted} };
  }
  function optimize(inputState, options) {
    options=options||{}; var objective=options.objective||"highest-rate"; var max=Math.max(0,Math.min(50,Math.floor(options.maxUpgradesPerPool==null?10:options.maxUpgradesPerPool)));
    var original=JSON.stringify(inputState); var state=clone(inputState);
    var initial=BellOptimizer.bellRateUpgradeCandidates.generate(state);
    if (!initial.ok) return {ok:false,error:initial.error};
    var pools={}; initial.candidates.forEach(function(c){if(c.resourcePoolId&&c.deterministicPurchase) pools[c.resourcePoolId]=true;});
    var counter={count:0}, chosen=[], bounded=false;
    Object.keys(pools).sort().forEach(function(pool){var result=optimizePool(state,pool,objective,max,counter); bounded=bounded||result.bounded; chosen=chosen.concat(result.best.purchases);});
    var purchases=[]; chosen.forEach(function(id){var made=makeStep(state,id,purchases.length+1,initial.baselineRate);if(made){state=made.nextState;purchases.push(made.step);}});
    var finalRate=BellOptimizer.bellRateUpgradeCandidates.recompute(state,{}).calculatedRate;
    var beforeP=projections(initial.baselineRate), afterP=projections(finalRate);
    var resources={}; purchases.forEach(function(p){var candidate=BellOptimizer.bellRateUpgradeCandidates.generate(state).candidates.find(function(c){return c.resourcePoolId===p.resourcePoolId;}); resources[p.resource.path]=null;});
    var finalCandidates=BellOptimizer.bellRateUpgradeCandidates.generate(state).candidates;
    initial.candidates.filter(function(c){return c.resourcePoolId&&c.costResource;}).forEach(function(c){var current=finalCandidates.find(function(x){return x.resourcePoolId===c.resourcePoolId;});resources[c.costResource.path]=current?current.ownedResource:c.ownedResource;});
    var workToward=initial.candidates.filter(function(c){return c.deterministicPurchase&&!c.affordableNow&&c.complete&&c.absoluteRateGain>0;}).sort(function(a,b){return b.percentageRateGain-a.percentageRateGain;});
    var opportunities=initial.candidates.filter(function(c){return c.eligibilityCategory==="Progression targets"||c.eligibilityCategory==="RNG-dependent"||c.eligibilityCategory==="Capped";});
    if (JSON.stringify(inputState)!==original) return {ok:false,error:"Optimizer mutated its input state."};
    return {ok:true,objective:objective,baselineBellRate:initial.baselineRate,optimizedBellRate:finalRate,absoluteIncrease:finalRate-initial.baselineRate,percentageIncrease:(finalRate/initial.baselineRate-1)*100,baseline2HourEndingRing:beforeP.twoHours.endingHumanRing,optimized2HourEndingRing:afterP.twoHours.endingHumanRing,additional2HourRolls:afterP.twoHours.ringsCompleted-beforeP.twoHours.ringsCompleted,baseline48HourEndingRing:beforeP.fortyEightHours.endingHumanRing,optimized48HourEndingRing:afterP.fortyEightHours.endingHumanRing,additional48HourRolls:afterP.fortyEightHours.ringsCompleted-beforeP.fortyEightHours.ringsCompleted,orderedPurchases:purchases,remainingResources:resources,searchMethod:bounded?"bounded exact":"exact",statesEvaluated:counter.count,bestUpgradesToWorkToward:workToward,progressionAndRngOpportunities:opportunities,optimizedState:state};
  }

  function poolOwned(state, poolId) {
    var index=BellOptimizer.bellRateUpgradeCandidates.RESOURCE_POOL_IDS.indexOf(poolId);
    if(index>=0)return state.methodOwnedResources[index];
    if(poolId==="fountain-currency-2")return state.fountainCurrency;
    if(poolId==="marble")return state.marbleCurrency;
    if(poolId==="holes-9-4")return state.measurementCurrency;
    if(poolId==="cosmo-points")return state.cosmoPointsLeft;
    return null;
  }
  function spendingLimit(owned, constraint) {
    if(!finite(owned))return 0;
    constraint=constraint||{}; if(constraint.disabled)return 0;
    var limits=[owned];
    if(finite(constraint.maximumAmount))limits.push(Math.max(0,constraint.maximumAmount));
    if(finite(constraint.minimumReserve))limits.push(Math.max(0,owned-constraint.minimumReserve));
    if(finite(constraint.maximumPercent))limits.push(Math.max(0,owned*constraint.maximumPercent/100));
    return Math.min.apply(Math,limits);
  }
  function targetProbability(rate, options) {
    var target=options.targetProbabilityOptions;if(!target)return null;
    var progress=BellOptimizer.bellMechanics.advanceRingingProgress({startingRawRingIndex:0,startingRingingExp:0,ringingExpPerHour:rate,durationHours:target.durationHours||2});
    if(!progress.ok)return null;
    var evaluation=BellOptimizer.targetEvaluator.evaluateTarget({currentLevel:target.currentLevel||0,currentRing:0,targetLevel:target.targetLevel,targetRing:progress.endingHumanRing,selectionProbability:target.selectionProbability,ordinaryGainDistribution:target.ordinaryGainDistribution,majorGainDistribution:target.majorGainDistribution,expectedOrdinaryRingGain:target.expectedOrdinaryRingGain,expectedMajorRingGain:target.expectedMajorRingGain});
    return evaluation.ok?evaluation.probabilityOfTarget:null;
  }
  function outcome(rate, objective, options) {
    var p=projections(rate);
    if(objective==="two-hour-rolls")return p.twoHours.ringsCompleted;
    if(objective==="forty-eight-hour-rolls")return p.fortyEightHours.ringsCompleted;
    if(objective==="reach-ending-ring")return p.twoHours.endingHumanRing;
    if(objective==="reach-target-chance")return targetProbability(rate,options);
    return rate;
  }
  function enumerate(inputState, options) {
    var base=clone(inputState), initial=BellOptimizer.bellRateUpgradeCandidates.generate(base);
    if(!initial.ok)return {ok:false,error:initial.error};
    var safety=Math.max(0,Math.min(50,Math.floor(options.searchSafetyLimit==null?10:options.searchSafetyLimit)));
    var constraints=options.resourceConstraints||{}, baselineOwned={}, states=[], seen=Object.create(null), bounded=false, count=0;
    initial.candidates.forEach(function(c){if(c.resourcePoolId&&baselineOwned[c.resourcePoolId]==null)baselineOwned[c.resourcePoolId]=poolOwned(base,c.resourcePoolId);});
    function visit(state, ids, spent, levelsByUpgrade) {
      if(count>=STATE_LIMIT){bounded=true;return;} count+=1;
      var rate=BellOptimizer.bellRateUpgradeCandidates.recompute(state,{}).calculatedRate;
      states.push({state:clone(state),ids:ids.slice(),spent:Object.assign({},spent),levelsByUpgrade:Object.assign({},levelsByUpgrade),rate:rate,projections:projections(rate)});
      var generated=BellOptimizer.bellRateUpgradeCandidates.generate(state);
      generated.candidates.filter(function(c){return c.deterministicPurchase&&c.affordableNow&&c.absoluteRateGain>0&&c.eligibilityCategory==="Purchasable now";}).forEach(function(c){
        var bought=levelsByUpgrade[c.id]||0, poolLevels=Object.keys(levelsByUpgrade).reduce(function(sum,id){return sum+(id.indexOf(c.resourcePoolId+"|")===0?levelsByUpgrade[id]:0);},0);
        var constraint=constraints[c.resourcePoolId]||{};
        if(bought>=safety||finite(constraint.maximumLevels)&&poolLevels>=constraint.maximumLevels)return;
        var nextSpent=(spent[c.resourcePoolId]||0)+c.cost;
        if(nextSpent>spendingLimit(baselineOwned[c.resourcePoolId],constraint)*(1+1e-12))return;
        var next=applyPurchase(state,c);if(!next)return;
        var nextLevels=Object.assign({},levelsByUpgrade);nextLevels[c.id]=bought+1;nextLevels[c.resourcePoolId+"|total"]=(nextLevels[c.resourcePoolId+"|total"]||0)+1;
        var nextSpentMap=Object.assign({},spent);nextSpentMap[c.resourcePoolId]=nextSpent;
        var key=JSON.stringify(next.bellMethodLevels)+"|"+JSON.stringify(next.rateInputs)+"|"+JSON.stringify(nextSpentMap);
        if(seen[key])return;seen[key]=true;visit(next,ids.concat(c.id),nextSpentMap,nextLevels);
      });
    }
    visit(base,[],{},{});return {ok:true,initial:initial,states:states,baselineOwned:baselineOwned,bounded:bounded,statesEvaluated:count,safety:safety};
  }
  function selectMaximum(enumeration, options) {
    var objective=options.objective||"highest-rate", target=objective==="reach-ending-ring"?options.targetEndingRing:objective==="reach-target-chance"?options.targetChance:null;
    var candidates=enumeration.states.slice();
    function value(state){if(state._objectiveValue===undefined)state._objectiveValue=outcome(state.rate,objective,options);return state._objectiveValue;}
    if(target!=null&&!options.maximumExcessProgress){var reached=candidates.filter(function(s){var v=value(s);return v!=null&&v>=target;});if(reached.length)return reached.sort(function(a,b){return a.ids.length-b.ids.length||a.rate-b.rate;})[0];}
    return candidates.sort(function(a,b){var av=value(a),bv=value(b);return (bv==null?-Infinity:bv)-(av==null?-Infinity:av)||b.rate-a.rate||a.ids.length-b.ids.length;})[0];
  }
  function selectPractical(enumeration, options) {
    var baseline=enumeration.initial.baselineRate, baseP=projections(baseline), min=finite(options.minimumPracticalRateGainPercent)?options.minimumPracticalRateGainPercent:.25;
    var baseExponent=Math.floor(enumeration.states[0].state.bellMethodLevels.reduce(function(a,b){return a+b;},0)/25);
    var material=enumeration.states.filter(function(s){if(!s.ids.length)return false;var p=s.projections,pct=(s.rate/baseline-1)*100,exp=Math.floor(s.state.bellMethodLevels.reduce(function(a,b){return a+b;},0)/25),poolCount=Object.keys(s.spent).filter(function(pool){return s.spent[pool]>0;}).length;return p.twoHours.ringsCompleted>baseP.twoHours.ringsCompleted||p.fortyEightHours.ringsCompleted>baseP.fortyEightHours.ringsCompleted||(poolCount===1&&pct>=min)||exp>baseExponent;});
    if(!material.length)return enumeration.states[0];
    return material.sort(function(a,b){var ap=a.projections,bp=b.projections,a2=ap.twoHours.ringsCompleted-baseP.twoHours.ringsCompleted,b2=bp.twoHours.ringsCompleted-baseP.twoHours.ringsCompleted,a48=ap.fortyEightHours.ringsCompleted-baseP.fortyEightHours.ringsCompleted,b48=bp.fortyEightHours.ringsCompleted-baseP.fortyEightHours.ringsCompleted;return b2-a2||b48-a48||a.ids.length-b.ids.length||b.rate-a.rate;})[0];
  }
  function buildPlan(baseState, selected, enumeration, label, options) {
    var state=clone(baseState), steps=[], baseRate=enumeration.initial.baselineRate, baseP=projections(baseRate), cumulativeSpent={},baseExponent=Math.floor(baseState.bellMethodLevels.reduce(function(a,b){return a+b;},0)/25);
    selected.ids.forEach(function(id){var made=makeStep(state,id,steps.length+1,baseRate);if(!made)return;state=made.nextState;cumulativeSpent[made.step.resourcePoolId]=(cumulativeSpent[made.step.resourcePoolId]||0)+made.step.cost;var now=projections(made.step.rateAfter);made.step.cumulativeAdditional2HourRolls=now.twoHours.ringsCompleted-baseP.twoHours.ringsCompleted;made.step.cumulativeAdditional48HourRolls=now.fortyEightHours.ringsCompleted-baseP.fortyEightHours.ringsCompleted;made.step.resourcePoolConsumedPercent=enumeration.baselineOwned[made.step.resourcePoolId]>0?100*cumulativeSpent[made.step.resourcePoolId]/enumeration.baselineOwned[made.step.resourcePoolId]:null;made.step.noProjectedRollGain=made.step.individualAdditional2HourRolls===0&&made.step.individualAdditional48HourRolls===0;made.step.crossesMethodScalingBreakpoint=Math.floor(state.bellMethodLevels.reduce(function(a,b){return a+b;},0)/25)>baseExponent;steps.push(made.step);});
    var rate=BellOptimizer.bellRateUpgradeCandidates.recompute(state,{}).calculatedRate,p=projections(rate);
    var firstMeaningful=steps.find(function(step){return step.cumulativeAdditional2HourRolls>0||step.cumulativeAdditional48HourRolls>0||step.crossesMethodScalingBreakpoint;});
    return {label:label,bellRate:rate,percentageRateGain:(rate/baseRate-1)*100,resourcesSpent:cumulativeSpent,twoHourEndingRing:p.twoHours.endingHumanRing,additional2HourRolls:p.twoHours.ringsCompleted-baseP.twoHours.ringsCompleted,fortyEightHourEndingRing:p.fortyEightHours.endingHumanRing,additional48HourRolls:p.fortyEightHours.ringsCompleted-baseP.fortyEightHours.ringsCompleted,targetProbability:targetProbability(rate,options),orderedPurchases:steps,breakpointMessage:firstMeaningful?"Buy "+firstMeaningful.stepNumber+" levels to reach the next meaningful breakpoint.":null};
  }
  function comparePlans(inputState, options) {
    options=options||{};var original=JSON.stringify(inputState),unconstrained=enumerate(inputState,Object.assign({},options,{resourceConstraints:{}}));if(!unconstrained.ok)return unconstrained;
    var constrained=options.mode==="player-budget"?enumerate(inputState,options):unconstrained;if(!constrained.ok)return constrained;
    var noState=unconstrained.states[0], practicalSelected=selectPractical(unconstrained,options), maximumSelected=selectMaximum(unconstrained,Object.assign({},options,{objective:"highest-rate",maximumExcessProgress:true})), playerSelected=selectMaximum(constrained,options);
    var noPlan=buildPlan(inputState,noState,unconstrained,"No spending",options), practicalPlan=buildPlan(inputState,practicalSelected,unconstrained,"Practical Bell Ring plan",options), maximumPlan=buildPlan(inputState,maximumSelected,unconstrained,"Bell Ring-only maximum",options), playerPlan=buildPlan(inputState,playerSelected,constrained,"Player-constrained Bell Ring plan",options), mode=options.mode||"practical";
    var result={ok:true,mode:mode,noSpending:noPlan,practicalPlan:practicalPlan,bellOnlyMaximum:maximumPlan,playerConstrainedPlan:playerPlan,recommendedPlan:mode==="maximum"?maximumPlan:mode==="player-budget"?playerPlan:practicalPlan,searchMethod:(unconstrained.bounded||constrained.bounded)?"bounded exact":"exact",statesEvaluated:unconstrained.statesEvaluated+(constrained===unconstrained?0:constrained.statesEvaluated),searchSafetyLimit:unconstrained.safety,searchLimitWarning:maximumSelected.ids.some(function(id){return maximumSelected.levelsByUpgrade[id]>=unconstrained.safety;}),bestUpgradesToWorkToward:unconstrained.initial.candidates.filter(function(c){return c.deterministicPurchase&&!c.affordableNow&&c.complete&&c.absoluteRateGain>0;}).sort(function(a,b){return b.percentageRateGain-a.percentageRateGain;}),progressionAndRngOpportunities:unconstrained.initial.candidates.filter(function(c){return c.eligibilityCategory==="Progression targets"||c.eligibilityCategory==="RNG-dependent"||c.eligibilityCategory==="Capped";})};
    if(JSON.stringify(inputState)!==original)return {ok:false,error:"Optimizer mutated its input state."};return result;
  }
  return { STATE_LIMIT:STATE_LIMIT, applyPurchase:applyPurchase, spendingLimit:spendingLimit, optimize:optimize, comparePlans:comparePlans };
}());
