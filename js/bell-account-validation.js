"use strict";
window.BellOptimizer = window.BellOptimizer || {};

BellOptimizer.bellAccountValidation = (function () {
  var STATS=["Bell Ring","Bell Ping","Bell Clean"];
  function build(parsedData) {
    var state=parsedData&&parsedData.bellRateUpgradeState?parsedData.bellRateUpgradeState:parsedData;
    var generated=BellOptimizer.bellRateUpgradeCandidates.generate(state);
    if(!generated.ok)return {ok:false,error:generated.error};
    var rates=BellOptimizer.bellRateUpgradeCandidates.recompute(state,{}),methods=BellOptimizer.bellMechanics.calculateBellActivityRates({bellMethodQuantities:BellOptimizer.bellMechanics.calculateBellImprovementMethods(state.bellMethodLevels,state.upgrade45Owned).bellMethodQuantities,monumentMultiplier:rates.monumentMultiplier,measurementMultiplier:rates.measurementMultiplier,jar11Multiplier:rates.jar11Multiplier,jar36Multiplier:rates.jar36Multiplier});
    var summaries={};
    STATS.forEach(function(stat){var all=BellOptimizer.bellRateSection.candidatesForStat(generated.candidates,stat,false),active=all.filter(function(c){return !c.capped&&c.validationValid!==false&&c.projectedAffectedValue!=null;}),recommendation=BellOptimizer.bellRateSection.primaryRecommendation(generated.candidates,stat);summaries[stat]={candidateCount:all.length,activeCount:active.length,affordableCount:active.filter(function(c){return c.affordableNow;}).length,cappedCount:all.filter(function(c){return c.capped;}).length,recommendation:recommendation?{id:recommendation.candidate.id,name:recommendation.candidate.name,affordable:recommendation.affordable,currentRate:recommendation.candidate.currentAffectedValue,projectedRate:recommendation.candidate.projectedAffectedValue}:null};});
    var fallbackLabels=generated.candidates.filter(function(c){return /currency|resource \d|cavern resource/i.test((c.costResource&&c.costResource.name)||"");}).map(function(c){return c.costResource.name;}).filter(function(v,i,a){return a.indexOf(v)===i;});
    return {ok:true,rates:{ring:methods.ringExpPerHour,ping:methods.pingExpPerHour,clean:methods.cleanExpPerHour},methodLevels:state.bellMethodLevels.slice(0,6),stats:summaries,invalidCandidates:generated.candidates.filter(function(c){return c.validationValid===false;}).map(function(c){return {id:c.id,errors:c.validationErrors.slice()};}),fallbackResourceLabels:fallbackLabels};
  }
  function format(report,formatter){if(!report.ok)return "Bell validation unavailable: "+report.error;var lines=["Bell account validation","Rates: Ring "+formatter(report.rates.ring)+"/hr | Ping "+formatter(report.rates.ping)+"/hr | Clean "+formatter(report.rates.clean)+"/hr","Method levels: "+report.methodLevels.join(", ")];STATS.forEach(function(stat){var s=report.stats[stat],r=s.recommendation;lines.push(stat+": "+s.candidateCount+" candidates, "+s.affordableCount+" affordable, "+s.cappedCount+" capped; "+(r?(r.affordable?"recommend ":"work toward ")+r.name+" ("+formatter(r.currentRate)+" -> "+formatter(r.projectedRate)+")":BellOptimizer.bellRateSection.noActiveCandidateMessage(stat)));});lines.push("Invalid candidate warnings: "+report.invalidCandidates.length);lines.push("Fallback resource labels: "+(report.fallbackResourceLabels.join(", ")||"none"));return lines.join("\n");}
  return {build:build,format:format};
}());
