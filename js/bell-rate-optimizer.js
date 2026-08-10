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

  var AFFORDABLE_SCHEMA_VERSION=1;
  function automaticReason(candidate) {
    if(candidate.id==="jar-11"||candidate.id==="jar-36")return "RNG_PROGRESSION_MANUAL_ONLY";
    if(candidate.system==="Death Note")return "ACCOUNT_PROGRESSION_NOT_PURCHASE";
    if(candidate.system==="Monument")return "RNG_OR_STORY_PROGRESSION";
    if(candidate.capped)return "CAPPED";
    if(candidate.status==="progression-gated"||candidate.eligibilityCategory==="Progression targets")return "LOCKED_OR_PROGRESSION_GATED";
    if(!candidate.deterministicPurchase)return "NO_VERIFIED_PURCHASE_MECHANIC";
    if(!candidate.complete||candidate.costResolved===false||!finite(candidate.ownedResource))return "RESOURCE_BALANCE_UNRESOLVED";
    if(candidate.validationValid===false)return "INVALID_CANDIDATE";
    return null;
  }
  function ringAutomaticCandidate(candidate) {
    if(automaticReason(candidate)!==null)return false;
    if((candidate.effects||[candidate.effect||"Bell Ring"]).indexOf("Bell Ring")===-1&&candidate.purchaseKind!=="bell-method")return false;
    return candidate.eligibilityCategory==="Purchasable now"&&candidate.affordableNow;
  }
  function stateKey(state) {
    return JSON.stringify([state.bellMethodLevels,state.rateInputs,state.methodOwnedResources,state.cosmoPointsLeft,state.fountainCurrency,state.marbleCurrency,state.measurementCurrency]);
  }
  function candidateOrder(initial) {
    return initial.candidates.filter(function(candidate){return candidate.deterministicPurchase&&candidate.resourcePoolId;}).map(function(candidate){return candidate.id;}).filter(function(id,index,all){return all.indexOf(id)===index;}).sort();
  }
  function excludedOpportunities(initial) {
    return initial.candidates.map(function(candidate){var reason=automaticReason(candidate),methodCrossInteraction=candidate.purchaseKind==="bell-method";if(reason===null&&!methodCrossInteraction&&((candidate.effects||[candidate.effect||"Bell Ring"]).indexOf("Bell Ring")===-1))reason="DOES_NOT_AFFECT_BELL_RING";if(reason===null&&!candidate.affordableNow)reason="NOT_CURRENTLY_AFFORDABLE";return reason?{candidateId:candidate.id,source:candidate.name,system:candidate.system,reason:reason}:null;}).filter(Boolean);
  }
  function replayAffordablePlan(baseState, ids, baselineRate) {
    var state=clone(baseState),sequence=[],spent=Object.create(null),starting=Object.create(null),resourceNames=Object.create(null);
    ids.forEach(function(id,index){
      var generated=BellOptimizer.bellRateUpgradeCandidates.generate(state),candidate=generated.candidates.find(function(item){return item.id===id;});
      if(!candidate||!ringAutomaticCandidate(candidate))throw new Error("A selected purchase is no longer legal during replay: "+id);
      if(starting[candidate.resourcePoolId]===undefined)starting[candidate.resourcePoolId]=candidate.ownedResource+(spent[candidate.resourcePoolId]||0);
      resourceNames[candidate.resourcePoolId]=candidate.costResource;
      var next=applyPurchase(state,candidate),rate=BellOptimizer.bellRateUpgradeCandidates.recompute(next,{}).calculatedRate;
      spent[candidate.resourcePoolId]=(spent[candidate.resourcePoolId]||0)+candidate.cost;
      sequence.push({step:index+1,candidateId:candidate.id,source:candidate.name,system:candidate.system,currentValue:candidate.currentLevel,targetValue:candidate.nextLevel,resourcePoolId:candidate.resourcePoolId,resource:candidate.costResource,cost:candidate.cost,rateBefore:generated.baselineRate,rateAfter:rate,absoluteGain:rate-generated.baselineRate,relativeGain:generated.baselineRate>0?(rate/generated.baselineRate-1):null,affordability:"VERIFIED",prerequisites:candidate.prerequisite});
      state=next;
    });
    var groups=[];
    sequence.forEach(function(step){var last=groups[groups.length-1];if(last&&last.candidateId===step.candidateId){last.targetValue=step.targetValue;last.levelsGained+=1;last.totalCost+=step.cost;last.cumulativeProjectedRate=step.rateAfter;last.cumulativeGain=step.rateAfter-baselineRate;last.cumulativeRelativeGain=baselineRate>0?step.rateAfter/baselineRate-1:null;}else groups.push({candidateId:step.candidateId,source:step.source,system:step.system,currentValue:step.currentValue,targetValue:step.targetValue,levelsGained:1,resourcePoolId:step.resourcePoolId,resource:step.resource,totalCost:step.cost,startingBalance:starting[step.resourcePoolId],remainingBalance:null,cumulativeProjectedRate:step.rateAfter,cumulativeGain:step.rateAfter-baselineRate,cumulativeRelativeGain:baselineRate>0?step.rateAfter/baselineRate-1:null,affordability:"VERIFIED",prerequisites:step.prerequisites,reason:"Selected by exhaustive currently-affordable Bell Ring search."});});
    var pools=Object.keys(starting).sort().map(function(poolId){var total=spent[poolId]||0,remaining=starting[poolId]-total;groups.filter(function(group){return group.resourcePoolId===poolId;}).forEach(function(group){group.remainingBalance=remaining;});return {resourcePoolId:poolId,resource:resourceNames[poolId],startingBalance:starting[poolId],spent:total,remaining:remaining};});
    return {state:state,purchaseSequence:sequence,recommendedChanges:groups,resourcePools:pools};
  }
  function optimizeCurrentlyAffordableReference(inputState, options) {
    options=options||{};
    var started=Date.now(),original=JSON.stringify(inputState),base=clone(inputState),initial=BellOptimizer.bellRateUpgradeCandidates.generate(base);
    if(!initial.ok)return {ok:false,schemaVersion:AFFORDABLE_SCHEMA_VERSION,completeness:"UNAVAILABLE",error:initial.error};
    var maximumStates=Math.max(1,Math.floor(options.maximumStates==null?100000:options.maximumStates));
    var maximumCandidateLevels=Math.max(0,Math.floor(options.maximumCandidateLevels==null?1000:options.maximumCandidateLevels));
    var maximumFrontierEntries=Math.max(1,Math.floor(options.maximumFrontierEntries==null?100000:options.maximumFrontierEntries));
    var order=candidateOrder(initial),orderIndex=Object.create(null);order.forEach(function(id,index){orderIndex[id]=index;});
    var memo=Object.create(null),frontiers=Object.create(null),stats={legalPurchaseTransitionsConsidered:0,completeStatesEvaluated:0,statesMemoized:0,statesPruned:0,canonicalRateRecomputations:0},truncated=false,boundsHit=[];
    var baseline=initial.baselineRate,best={rate:baseline,state:clone(base),ids:[],counts:Object.create(null)};
    function hit(reason,candidateId){truncated=true;var key=reason+":"+(candidateId||"");if(boundsHit.indexOf(key)===-1)boundsHit.push(key);}
    function visit(state,ids,counts,minimumOrder) {
      if(stats.completeStatesEvaluated>=maximumStates){hit("MAXIMUM_STATES");return;}
      var key=stateKey(state);if(memo[key]){stats.statesPruned+=1;return;}memo[key]=true;stats.statesMemoized+=1;
      if(stats.statesMemoized>maximumFrontierEntries){hit("MAXIMUM_FRONTIER_ENTRIES");return;}
      var generated=BellOptimizer.bellRateUpgradeCandidates.generate(state);stats.completeStatesEvaluated+=1;stats.canonicalRateRecomputations+=1;
      if(!generated.ok)return;
      var rate=generated.baselineRate;
      if(rate>best.rate||rate===best.rate&&ids.length<best.ids.length){best={rate:rate,state:clone(state),ids:ids.slice(),counts:Object.assign(Object.create(null),counts)};}
      generated.candidates.filter(ringAutomaticCandidate).sort(function(a,b){return orderIndex[a.id]-orderIndex[b.id];}).forEach(function(candidate){
        var position=orderIndex[candidate.id];if(position<minimumOrder)return;
        stats.legalPurchaseTransitionsConsidered+=1;
        var count=counts[candidate.id]||0;
        if(count>=maximumCandidateLevels){hit("MAXIMUM_CANDIDATE_LEVELS",candidate.id);return;}
        var next=applyPurchase(state,candidate);if(!next)return;
        var nextCounts=Object.assign(Object.create(null),counts);nextCounts[candidate.id]=count+1;
        if(!frontiers[candidate.resourcePoolId])frontiers[candidate.resourcePoolId]=Object.create(null);frontiers[candidate.resourcePoolId][stateKey(next)]=true;
        visit(next,ids.concat(candidate.id),nextCounts,position);
      });
    }
    visit(base,[],Object.create(null),0);
    var replay;
    try{replay=replayAffordablePlan(base,best.ids,baseline);}catch(error){return {ok:false,schemaVersion:AFFORDABLE_SCHEMA_VERSION,completeness:"UNAVAILABLE",error:error.message};}
    var optimized=BellOptimizer.bellRateUpgradeCandidates.recompute(replay.state,{});stats.canonicalRateRecomputations+=1;
    var initialExcluded=excludedOpportunities(initial),activeCoin=initial.candidates.find(function(c){return c.id==="bell-method-0";});
    var warnings=["This optimizes Bell Ring Rate only and does not value competing non-Bell uses of these resources."];
    if(activeCoin&&automaticReason(activeCoin)==="RESOURCE_BALANCE_UNRESOLVED")warnings.push("Method 0 was excluded because the active character Coin balance was not explicitly selected.");
    if(truncated)warnings.push("Search bounds were reached; the result is optimal only within the reported bounds.");
    if(JSON.stringify(inputState)!==original)return {ok:false,schemaVersion:AFFORDABLE_SCHEMA_VERSION,completeness:"UNAVAILABLE",error:"Optimizer mutated its input state."};
    return {ok:true,schemaVersion:AFFORDABLE_SCHEMA_VERSION,completeness:truncated?"BOUNDED_EXACT":"EXACT",currentRate:baseline,optimizedRate:optimized.calculatedRate,absoluteGain:optimized.calculatedRate-baseline,relativeGain:baseline>0?optimized.calculatedRate/baseline-1:0,recommendedChanges:replay.recommendedChanges,purchaseSequence:replay.purchaseSequence,resourcePools:replay.resourcePools,excludedOpportunities:initialExcluded,optimizedState:replay.state,orderIndependent:true,assumptions:["Only verified deterministic purchases funded by current imported balances are eligible.","Presentation order is deterministic; independent-pool purchase order is not claimed to be unique."],warnings:warnings,search:{algorithm:"deterministic canonical purchase-multiset enumeration",statesEvaluated:stats.completeStatesEvaluated,statesMemoized:stats.statesMemoized,statesPruned:stats.statesPruned,legalPurchaseTransitionsConsidered:stats.legalPurchaseTransitionsConsidered,frontierStates:Object.keys(memo).length,frontierSizeByResourcePool:Object.keys(frontiers).sort().map(function(pool){return {resourcePoolId:pool,size:Object.keys(frontiers[pool]).length};}),combinedFrontierSize:Object.keys(memo).length,canonicalRateRecomputations:stats.canonicalRateRecomputations,bounds:{maximumStates:maximumStates,maximumFrontierEntries:maximumFrontierEntries,maximumCandidateLevels:maximumCandidateLevels,hit:boundsHit},truncated:truncated,runtimeMilliseconds:Date.now()-started}};
  }
  function exactAffordableCapacity(baseState,candidateId,limit,diagnostics) {
    var state=clone(baseState),ids=[],bounded=false;
    while(ids.length<limit){var generated=BellOptimizer.bellRateUpgradeCandidates.generate(state),candidate=generated.ok&&generated.candidates.find(function(item){return item.id===candidateId;});diagnostics.candidateGenerations+=1;if(!candidate||!ringAutomaticCandidate(candidate))break;var next=applyPurchase(state,candidate);if(!next)break;state=next;ids.push(candidateId);diagnostics.legalPurchaseTransitionsConsidered+=1;}
    var after=BellOptimizer.bellRateUpgradeCandidates.generate(state),still=after.ok&&after.candidates.find(function(item){return item.id===candidateId;});diagnostics.candidateGenerations+=1;if(ids.length>=limit&&still&&ringAutomaticCandidate(still))bounded=true;
    return {count:ids.length,ids:ids,state:state,bounded:bounded};
  }
  function methodPurchasePlan(baseState,maximumCandidateLevels,diagnostics) {
    var direct=[0,2,4,5],bridges=[1,3],capacities={},methodStates=1;
    direct.concat(bridges).forEach(function(index){var id="bell-method-"+index,result=exactAffordableCapacity(baseState,id,maximumCandidateLevels,diagnostics);capacities[index]=result.count;methodStates+=result.count;diagnostics.bounded=diagnostics.bounded||result.bounded;if(result.bounded)diagnostics.boundsHit.push("METHOD_LEVEL_LIMIT:"+id);});
    var ids=[];direct.forEach(function(index){for(var count=0;count<capacities[index];count+=1)ids.push("bell-method-"+index);});
    var currentTotal=baseState.bellMethodLevels.slice(0,6).reduce(function(sum,level){return sum+level;},0),directAdded=direct.reduce(function(sum,index){return sum+capacities[index];},0),bridgeCapacity=capacities[1]+capacities[3],highestExponent=baseState.upgrade45Owned?Math.floor((currentTotal+directAdded+bridgeCapacity)/25):Math.floor(currentTotal/25),bridgeNeeded=baseState.upgrade45Owned?Math.max(0,highestExponent*25-(currentTotal+directAdded)):0;
    bridges.forEach(function(index){var take=Math.min(bridgeNeeded,capacities[index]);for(var count=0;count<take;count+=1)ids.push("bell-method-"+index);bridgeNeeded-=take;});
    diagnostics.methodStatesEnumerated=methodStates;diagnostics.methodFrontierSize=1;diagnostics.methodStatesPruned=Math.max(0,methodStates-1);
    return {ids:ids,capacities:capacities,highestExponent:highestExponent};
  }
  function applyIdSequence(baseState,ids) {
    var state=clone(baseState),applied=[];
    for(var index=0;index<ids.length;index+=1){var generated=BellOptimizer.bellRateUpgradeCandidates.generate(state),candidate=generated.ok&&generated.candidates.find(function(item){return item.id===ids[index];});if(!candidate||!ringAutomaticCandidate(candidate))return {ok:false,error:"A decomposed purchase became illegal: "+ids[index]};state=applyPurchase(state,candidate);applied.push(ids[index]);}
    return {ok:true,state:state,ids:applied};
  }
  function maximizeIndependentGroups(baseState,maximumCandidateLevels,diagnostics) {
    var ids=[],state=clone(baseState),groups=["fountain-monumental-boost","fountain-monumental-marble","measurement-ringing"];
    groups.forEach(function(id){var count=0;while(count<maximumCandidateLevels){var generated=BellOptimizer.bellRateUpgradeCandidates.generate(state),candidate=generated.ok&&generated.candidates.find(function(item){return item.id===id;});diagnostics.candidateGenerations+=1;if(!candidate||!ringAutomaticCandidate(candidate))break;state=applyPurchase(state,candidate);ids.push(id);count+=1;diagnostics.legalPurchaseTransitionsConsidered+=1;}var finalGenerated=BellOptimizer.bellRateUpgradeCandidates.generate(state),next=finalGenerated.ok&&finalGenerated.candidates.find(function(item){return item.id===id;});diagnostics.candidateGenerations+=1;if(count>=maximumCandidateLevels&&next&&ringAutomaticCandidate(next)){diagnostics.bounded=true;diagnostics.boundsHit.push("INDEPENDENT_LEVEL_LIMIT:"+id);}diagnostics.independentGroupStates+=count+1;});
    return {state:state,ids:ids};
  }
  function optimizeCosmoGroup(baseState,maximumFrontierEntries,diagnostics) {
    var ids=["measurement-cosmo","monument-cosmo"],states=[],seen=Object.create(null),bounded=false;
    function visit(state,path,minimum){var key=stateKey(state);if(seen[key])return;seen[key]=true;if(states.length>=maximumFrontierEntries){bounded=true;return;}var rate=BellOptimizer.bellRateUpgradeCandidates.recompute(state,{}).calculatedRate;diagnostics.canonicalRateRecomputations+=1;states.push({state:clone(state),ids:path.slice(),rate:rate,points:path.length});for(var index=minimum;index<ids.length;index+=1){var generated=BellOptimizer.bellRateUpgradeCandidates.generate(state),candidate=generated.ok&&generated.candidates.find(function(item){return item.id===ids[index];});diagnostics.candidateGenerations+=1;if(!candidate||!ringAutomaticCandidate(candidate))continue;diagnostics.legalPurchaseTransitionsConsidered+=1;visit(applyPurchase(state,candidate),path.concat(ids[index]),index);}}
    visit(baseState,[],0);
    var frontier=states.filter(function(candidate){return !states.some(function(other){return other!==candidate&&other.points<=candidate.points&&other.rate>=candidate.rate&&(other.points<candidate.points||other.rate>candidate.rate);});});
    var best=states.reduce(function(current,item){return !current||item.rate>current.rate||item.rate===current.rate&&item.ids.length<current.ids.length||item.rate===current.rate&&item.ids.length===current.ids.length&&item.ids.join("|")<current.ids.join("|")?item:current;},null);
    diagnostics.cosmoStatesEnumerated=states.length;diagnostics.cosmoFrontierSize=frontier.length;diagnostics.cosmoStatesPruned=states.length-frontier.length;if(bounded){diagnostics.bounded=true;diagnostics.boundsHit.push("COSMO_FRONTIER_LIMIT");}
    return best||{state:clone(baseState),ids:[],rate:BellOptimizer.bellRateUpgradeCandidates.recompute(baseState,{}).calculatedRate};
  }
  function optimizeCurrentlyAffordable(inputState,options) {
    options=options||{};var started=Date.now(),original=JSON.stringify(inputState),base=clone(inputState),initial=BellOptimizer.bellRateUpgradeCandidates.generate(base);
    if(!initial.ok)return {ok:false,schemaVersion:AFFORDABLE_SCHEMA_VERSION,completeness:"UNAVAILABLE",error:initial.error};
    var maximumStates=Math.max(1,Math.floor(options.maximumStates==null?100000:options.maximumStates)),maximumFrontierEntries=Math.max(1,Math.floor(options.maximumFrontierEntries==null?100000:options.maximumFrontierEntries)),maximumCandidateLevels=Math.max(0,Math.floor(options.maximumCandidateLevels==null?1000:options.maximumCandidateLevels));
    var d={methodStatesEnumerated:0,methodFrontierSize:0,methodStatesPruned:0,cosmoStatesEnumerated:0,cosmoFrontierSize:0,cosmoStatesPruned:0,independentGroupStates:0,frontierCombinationStates:1,canonicalRateRecomputations:0,purchaseReplayTransitions:0,legalPurchaseTransitionsConsidered:0,candidateGenerations:0,bounded:false,boundsHit:[]};
    var methods=methodPurchasePlan(base,maximumCandidateLevels,d),methodApplied=applyIdSequence(base,methods.ids);if(!methodApplied.ok)return {ok:false,schemaVersion:AFFORDABLE_SCHEMA_VERSION,completeness:"UNAVAILABLE",error:methodApplied.error};
    var independent=maximizeIndependentGroups(methodApplied.state,maximumCandidateLevels,d),cosmo=optimizeCosmoGroup(independent.state,maximumFrontierEntries,d),allIds=methods.ids.concat(independent.ids,cosmo.ids),structuralWork=d.methodStatesEnumerated+d.independentGroupStates+d.cosmoStatesEnumerated;
    if(structuralWork>maximumStates){d.bounded=true;d.boundsHit.push("MAXIMUM_STATES_DIAGNOSTIC");}
    var replay;try{replay=replayAffordablePlan(base,allIds,initial.baselineRate);d.purchaseReplayTransitions=allIds.length;}catch(error){return {ok:false,schemaVersion:AFFORDABLE_SCHEMA_VERSION,completeness:"UNAVAILABLE",error:error.message};}
    var finalRate=BellOptimizer.bellRateUpgradeCandidates.recompute(replay.state,{}).calculatedRate;d.canonicalRateRecomputations+=1;
    var warnings=["This optimizes Bell Ring Rate only and does not value competing non-Bell uses of these resources."],activeCoin=initial.candidates.find(function(candidate){return candidate.id==="bell-method-0";});if(activeCoin&&automaticReason(activeCoin)==="RESOURCE_BALANCE_UNRESOLVED")warnings.push("Method 0 was excluded because the active character Coin balance was not explicitly selected.");if(d.bounded)warnings.push("A structural safety limit was reached; the result is optimal only inside the reported bound.");
    if(JSON.stringify(inputState)!==original)return {ok:false,schemaVersion:AFFORDABLE_SCHEMA_VERSION,completeness:"UNAVAILABLE",error:"Optimizer mutated its input state."};
    return {ok:true,schemaVersion:AFFORDABLE_SCHEMA_VERSION,completeness:d.bounded?"BOUNDED_EXACT":"EXACT",currentRate:initial.baselineRate,optimizedRate:finalRate,absoluteGain:finalRate-initial.baselineRate,relativeGain:initial.baselineRate>0?finalRate/initial.baselineRate-1:0,recommendedChanges:replay.recommendedChanges,purchaseSequence:replay.purchaseSequence,resourcePools:replay.resourcePools,excludedOpportunities:excludedOpportunities(initial),optimizedState:replay.state,orderIndependent:true,assumptions:["Only verified deterministic purchases funded by current imported balances are eligible.","Direct independent upgrades are monotone positive factors and are maximized exactly.","Bell Methods are coupled only through the verified total-level Upgrade 45 exponent.","Cosmo allocations remain coupled through their shared point balance."],warnings:warnings,search:{algorithm:"exact decomposed monotone groups with shared-Cosmo frontier",statesEvaluated:structuralWork,statesMemoized:d.methodFrontierSize+d.cosmoFrontierSize+d.independentGroupStates,statesPruned:d.methodStatesPruned+d.cosmoStatesPruned,legalPurchaseTransitionsConsidered:d.legalPurchaseTransitionsConsidered,frontierStates:d.methodFrontierSize+d.cosmoFrontierSize+d.independentGroupStates,frontierSizeByResourcePool:[],combinedFrontierSize:1,canonicalRateRecomputations:d.canonicalRateRecomputations,methodStatesEnumerated:d.methodStatesEnumerated,methodFrontierSize:d.methodFrontierSize,methodStatesPruned:d.methodStatesPruned,cosmoStatesEnumerated:d.cosmoStatesEnumerated,cosmoFrontierSize:d.cosmoFrontierSize,cosmoStatesPruned:d.cosmoStatesPruned,independentGroupStates:d.independentGroupStates,frontierCombinationStates:d.frontierCombinationStates,purchaseReplayTransitions:d.purchaseReplayTransitions,candidateGenerations:d.candidateGenerations,bounds:{maximumStates:maximumStates,maximumFrontierEntries:maximumFrontierEntries,maximumCandidateLevels:maximumCandidateLevels,hit:d.boundsHit},truncated:d.bounded,runtimeMilliseconds:Date.now()-started}};
  }
  function composeAffordableWithJarScenario(optimizationResult,jarOverrides){if(!optimizationResult||!optimizationResult.ok||!optimizationResult.optimizedState)return {ok:false,error:{code:"INVALID_OPTIMIZATION_RESULT",message:"A successful deterministic optimization result is required."}};return BellOptimizer.bellRateScenario.evaluate({baseState:optimizationResult.optimizedState,overrides:jarOverrides||{}});}
  return { STATE_LIMIT:STATE_LIMIT, applyPurchase:applyPurchase, spendingLimit:spendingLimit, optimize:optimize, comparePlans:comparePlans, optimizeCurrentlyAffordable:optimizeCurrentlyAffordable, optimizeCurrentlyAffordableReference:optimizeCurrentlyAffordableReference, composeAffordableWithJarScenario:composeAffordableWithJarScenario, automaticReason:automaticReason };
}());
