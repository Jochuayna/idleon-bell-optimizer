"use strict";
window.BellOptimizer = window.BellOptimizer || {};

BellOptimizer.bellRateSection = (function () {
  var DEFAULT_BELL_STAT="Bell Ring";
  function buildBreakdown(data) {
    var rate = data.ringingRateBreakdown;
    if (!rate || !rate.complete) { var issues=rate&&Array.isArray(rate.dependencyIssues)?rate.dependencyIssues:[],first=issues[0],message=first&&first.dependency==="Death Note"?"Bell rate could not be reconstructed because Death Note data is incomplete for this save.":first&&/Jar/i.test(first.dependency)?"Bell rate could not be reconstructed because the Jar bonus data could not be verified.":"Bell rate could not be reconstructed because required Bell data is incomplete for this save.";return { ok:false, error:message, dependencyIssues:issues }; }
    return { ok:true, calculatedRate:rate.calculatedRate, exactRate:rate.calculatedRate, baseRate:rate.baseRate, monumentMultiplier:rate.monumentMultiplier, measurementMultiplier:rate.measurementMultiplier, methodMultiplier:data.ringingMethodMultiplier, jar11Multiplier:data.jar11Multiplier, jar36Multiplier:data.jar36Multiplier, monument:{ reward7Level:data.bellRateUpgradeState.rateInputs.monumentReward7Level, slot9Level:data.bellRateUpgradeState.rateInputs.monumentSlot9Level, cosmoLevel:data.bellRateUpgradeState.rateInputs.monumentCosmoLevel, fountainLevel:data.bellRateUpgradeState.rateInputs.fountainLevel, marbleLevel:data.bellRateUpgradeState.rateInputs.fountainMarbleLevel, rawBonusPercent:(rate.monumentMultiplier-1)*100, multiplier:rate.monumentMultiplier }, measurement:{ level:data.bellRateUpgradeState.rateInputs.measurementLevel, cosmoLevel:data.bellRateUpgradeState.rateInputs.measurementCosmoLevel, deathNotePoints:Array.isArray(rate.overkillQuantities)?rate.overkillQuantities.reduce(function(sum,value){return sum+value;},0):null, scaling:rate.measurementMulti, rawBonusPercent:rate.measurementBonusPercent, multiplier:rate.measurementMultiplier }, methods:{ levels:data.bellMethodLevels.slice(), upgrade45Owned:data.upgrade45Owned, rawPercent:data.ringingMethodBonusPercent, multiplier:data.ringingMethodMultiplier }, jars:{ jar11Level:data.jar11Level, jar11RawPercent:data.jar11BonusPercent, jar11Multiplier:data.jar11Multiplier, jar36Level:data.jar36Level, jar36RawPercent:data.jar36BonusPercent, jar36Multiplier:data.jar36Multiplier } };
  }

  function extraRolls(candidate, baselineRate, hours) {
    if (!Number.isFinite(candidate.projectedBellExpPerHour)) return null;
    var before=BellOptimizer.bellMechanics.advanceRingingProgress({startingRawRingIndex:0,startingRingingExp:0,ringingExpPerHour:baselineRate,durationHours:hours});
    var after=BellOptimizer.bellMechanics.advanceRingingProgress({startingRawRingIndex:0,startingRingingExp:0,ringingExpPerHour:candidate.projectedBellExpPerHour,durationHours:hours});
    return before.ok&&after.ok?after.ringsCompleted-before.ringsCompleted:null;
  }

  function buildUpgradePaths(state) {
    var candidates=BellOptimizer.bellRateUpgradeCandidates.generate(state);
    if(!candidates.ok)return candidates;
    var plans=BellOptimizer.bellRateOptimizer.comparePlans(state,{mode:"practical",objective:"highest-rate",searchSafetyLimit:10,minimumPracticalRateGainPercent:.25});
    if(!plans.ok)return plans;
    candidates.candidates.forEach(function(candidate){candidate.additionalBellRollsAfter48Hours=extraRolls(candidate,candidates.baselineRate,48);});
    return {ok:true,candidates:candidates.candidates,baselineRate:candidates.baselineRate,plans:plans,invalidCandidateWarnings:candidates.candidates.filter(function(candidate){return candidate.validationValid===false;}).map(function(candidate){return {id:candidate.id,name:candidate.name,errors:candidate.validationErrors.slice()};})};
  }
  function candidatesForStat(candidates, stat, affordableFirst) {
    var filtered=candidates.filter(function(candidate){return candidate.validationValid!==false&&(candidate.effects||[candidate.effect||"Bell Ring"]).indexOf(stat)!==-1&&(candidate.projectedAffectedValue!=null||candidate.capped);}).map(function(candidate){
      var view=Object.assign({},candidate),rates=candidate.affectedRates&&candidate.affectedRates[stat];
      view.selectedStat=stat;
      view.effect=candidate.id==="measurement-ringing"?stat+" multiplier":stat;
      if(rates){view.currentAffectedValue=rates.current;view.projectedAffectedValue=rates.projected;view.absoluteAffectedGain=rates.gain;view.affectedPercentageGain=rates.percentage;}
      return view;
    });
    if(!affordableFirst)return filtered.slice().sort(function(a,b){return Number(!!a.capped)-Number(!!b.capped);});
    function group(candidate){return candidate.capped?2:candidate.affordableNow?0:1;}
    return filtered.map(function(candidate,index){return {candidate:candidate,index:index};}).sort(function(a,b){return group(a.candidate)-group(b.candidate)||a.index-b.index;}).map(function(entry){return entry.candidate;});
  }
  function primaryRecommendation(candidates, stat) {
    var active=candidatesForStat(candidates,stat,false).filter(function(candidate){return !candidate.capped&&candidate.deterministicPurchase&&candidate.complete&&candidate.absoluteAffectedGain>0;});
    var affordable=active.filter(function(candidate){return candidate.affordableNow;});
    var pool=affordable.length?affordable:active;
    if(!pool.length)return null;
    var selected=pool.reduce(function(best,candidate){return !best||candidate.absoluteAffectedGain>best.absoluteAffectedGain?candidate:best;},null);
    return {candidate:selected,affordable:affordable.length>0,stat:stat,reason:(affordable.length?"Largest affordable ":"Largest available ")+stat+" rate increase."};
  }
  function activeCandidateCount(candidates,stat){return candidatesForStat(candidates,stat,false).filter(function(candidate){return !candidate.capped&&candidate.projectedAffectedValue!=null;}).length;}
  function shouldShowCandidateTable(candidates,stat){return activeCandidateCount(candidates,stat)>=2;}
  function noActiveCandidateMessage(stat){return "No further verified "+stat+" rate upgrades are currently available.";}
  function defaultViewState(){return {selectedStat:DEFAULT_BELL_STAT,affordableFirst:false,plansExpanded:false,optimizerPlan:null,runResult:null};}
  function formatRateGain(value,formatter){
    if(!Number.isFinite(value)||value<0)return "Unavailable";
    if(value===0)return "0/hr";
    var displayed=formatter(value);
    return (displayed==="0"?value.toFixed(6).replace(/0+$/,"").replace(/\.$/,""):displayed)+"/hr";
  }
  return { DEFAULT_BELL_STAT:DEFAULT_BELL_STAT, buildBreakdown:buildBreakdown, buildUpgradePaths:buildUpgradePaths, candidatesForStat:candidatesForStat, primaryRecommendation:primaryRecommendation, activeCandidateCount:activeCandidateCount, shouldShowCandidateTable:shouldShowCandidateTable, noActiveCandidateMessage:noActiveCandidateMessage, defaultViewState:defaultViewState, formatRateGain:formatRateGain };
}());
