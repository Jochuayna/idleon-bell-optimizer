"use strict";
window.BellOptimizer=window.BellOptimizer||{};

BellOptimizer.bellRunViewModel=(function(){
  var TIER_LABELS=Object.freeze({ABSOLUTELY_COOKED:"Absolutely Cooked",COOKED:"Cooked",WEAK_RUN:"Weak Run",TYPICAL_RUN:"Typical Run",SAVEABLE_RUN:"Saveable Run",STRONG_RUN:"Strong Run",EXCEPTIONAL_RUN:"Exceptional Run"});
  function finite(value){return typeof value==="number"&&Number.isFinite(value);}
  function percent(value){return finite(value)?(value*100).toFixed(value*100<10?1:0).replace(/\.0$/," ").trim()+"%":"—";}
  function time(hours){if(!finite(hours))return "Time unavailable";if(hours<1/60)return "Less than 1 minute";if(hours<1)return Math.max(1,Math.round(hours*60))+" minutes";if(hours<48)return (Math.round(hours*10)/10).toLocaleString()+" hours";return (Math.round(hours/24*10)/10).toLocaleString()+" days";}
  function tierPresentation(key){
    if(key==="ABSOLUTELY_COOKED"||key==="COOKED")return {direction:"Well behind a typical fresh run",interpretation:"This reward is projected to finish well below a typical fresh run. Much of its remaining upside depends on future major payouts."};
    if(key==="WEAK_RUN")return {direction:"Behind a typical fresh run",interpretation:"This reward is currently weak compared with a typical fresh run. Future major payouts can still move the result."};
    if(key==="TYPICAL_RUN")return {direction:"Close to a typical fresh run",interpretation:"This reward is roughly in line with a typical fresh run."};
    if(key==="SAVEABLE_RUN")return {direction:"Ahead of a typical fresh run",interpretation:"This reward is ahead of a typical fresh run, though future major payouts still matter to its finish."};
    return {direction:"Well ahead of a typical fresh run",interpretation:"This reward is substantially ahead of a typical fresh run."};
  }
  function playerCalculationMode(projection,comparison){
    var projectionApproximate=Boolean(projection&&projection.approximate),comparisonApproximate=Boolean(comparison&&comparison.approximate);
    if(projectionApproximate&&comparisonApproximate)return "Analytical approximation";
    if(projectionApproximate||comparisonApproximate)return "Hybrid analytical estimate";
    return projection&&projection.calculationMode==="Exact analytical"?"Exact analytical":"Analytical estimate";
  }
  function buildForecast(input){
    input=input||{};var result=input.forecast,format=input.formatter||String,reward=input.reward;
    if(!result||!result.ok)return {ok:false,message:result&&result.reason||"The Bell Run Forecast is unavailable for this save."};
    var projection=result.currentProjection,concentration=result.concentration,taper=result.taper,tierKey=result.projectedTier.tierKey,presentation=tierPresentation(tierKey),human=result.currentProjection.currentRawRingIndex+1,ringsUntilMajor=20-(human%20);if(ringsUntilMajor===0)ringsUntilMajor=20;var nextMajor=human+ringsUntilMajor;
    return {ok:true,rewardIndex:result.selectedRewardIndex,rewardName:reward.name,tierKey:tierKey,tierLabel:TIER_LABELS[tierKey]||tierKey,currentLevel:projection.currentSelectedRewardLevel,expectedFinish:projection.expectedFinalRewardLevel,direction:presentation.direction,interpretation:presentation.interpretation,currentDisplay:format(projection.currentSelectedRewardLevel),finishDisplay:"~"+format(projection.expectedFinalRewardLevel),rangeDisplay:format(projection.p25)+"–"+format(projection.p75),wideRangeDisplay:format(projection.p10)+"–"+format(projection.p90),concentrationDisplay:percent(concentration.payoutShare),expectedShareDisplay:"Typical share "+percent(concentration.expectedPayoutShare),nextMajorDisplay:"Ring "+nextMajor.toLocaleString(),ringsToMajorDisplay:ringsUntilMajor+" Bell roll"+(ringsUntilMajor===1?"":"s")+" away",taperRingDisplay:"Around ring "+taper.taperHumanRingNumber.toLocaleString(),taperTimeDisplay:time(taper.timeUntilTaperHours)+" at the current rate",opportunityDisplay:taper.ringsRemainingUntilTaper.toLocaleString()+" Bell roll"+(taper.ringsRemainingUntilTaper===1?"":"s"),majorDisplay:taper.majorPayoutsRemainingUntilTaper.toLocaleString()+" major payout"+(taper.majorPayoutsRemainingUntilTaper===1?"":"s"),calculationMode:projection.calculationMode,playerCalculationMode:playerCalculationMode(projection,result.comparison),superiorityDisplay:percent(result.comparison.currentSuperiority),additionalDisplay:"+"+format(projection.expectedAdditionalRewardLevels),approximate:projection.approximate||result.comparison.approximate,assumption:concentration.mechanicsStabilityWarning};
  }
  function replacementPresentation(result,format){
    if(!result||!result.ok)return {ok:false,headline:"KEEP/RENEW UNAVAILABLE",confidenceLabel:"Unavailable",reason:result&&result.reason||"The current run could not be compared with a fresh replacement."};
    var copy={KEEP:["KEEP THIS RUN","Strong modeled advantage","This run has a strong account-relative elite outlook or has already secured an elite result."],KEEP_FAVORED:["KEEP IS FAVORED","Directional advantage","The combined expected-value and elite-upside model favors keeping this run."],TOO_CLOSE:["TOO CLOSE TO CALL","Objectives conflict","Expected value and elite upside do not support a clear replacement decision."],RENEW_FAVORED:["RENEW IS FAVORED","Directional advantage","The combined expected-value and elite-upside model favors a fresh replacement."],RENEW:["RENEW NOW","Strong modeled advantage","A fresh run restores substantially stronger elite upside without failing the expected-value safety floor."]}[result.decision];
    if(!copy)return {ok:false,headline:"KEEP/RENEW UNAVAILABLE",confidenceLabel:"Unavailable",reason:"The replacement decision is unavailable."};
    var freshFavored=result.decision.indexOf("RENEW")===0,reason=copy[2];
    if(freshFavored&&!result.renewal.affordableNow)reason+=" The model favors replacing this run, but you need "+format(Math.max(0,result.renewal.renewalCost-result.renewal.currentRenewalCurrency))+" more Renewal currency before you can do that.";
    var currentWin=result.comparison.probabilityCurrentBeatsFresh,freshWin=result.comparison.probabilityFreshBeatsCurrent,leader=currentWin>=freshWin?"Current":"Fresh",probability=Math.max(currentWin,freshWin),ordinarySummary=leader+" wins about "+percent(probability)+" of outcomes";
    var elite=result.comparison.eliteUpside||{},decisionDirection=result.decision.indexOf("KEEP")===0?"KEEP":result.decision.indexOf("RENEW")===0?"RENEW":"EVEN",evDifference=result.comparison.expectedAdvantageCurrentMinusFresh||0,evDirection=result.expectedDirection||"EVEN";
    var rationaleKind="ordinary_superiority",rationaleLabel="MODELED EDGE",rationaleMetric=ordinarySummary,rationaleDetail=reason;
    if(result.elitePreservation&&result.elitePreservation!=="NONE"){
      rationaleKind="elite_preservation";rationaleLabel="ELITE RESULT SECURED";rationaleMetric="Already above fresh "+(result.elitePreservation==="ALREADY_P90"?"top-10% result":"top-20% result");rationaleDetail=rationaleMetric+". Bell reward levels cannot decrease, so the achieved elite result is preserved.";
    }else if(result.decision==="TOO_CLOSE"){
      rationaleKind="overlap";rationaleLabel="OUTCOMES OVERLAP";rationaleMetric="Outcomes remain closely matched";rationaleDetail="Expected value and elite upside do not agree strongly enough for a clear Keep or Renew direction.";
    }else if(result.upsideDirection===decisionDirection&&(evDirection==="EVEN"||evDirection!==decisionDirection)){
      var freshFavored=decisionDirection==="RENEW",first=freshFavored?"Fresh":"Current",second=freshFavored?"Current":"Fresh",firstChance=freshFavored?elite.freshP80Probability:elite.currentP80Probability,secondChance=freshFavored?elite.currentP80Probability:elite.freshP80Probability;
      rationaleKind="elite_upside";rationaleLabel="ELITE UPSIDE";rationaleMetric=first+" top-20% chance "+percent(firstChance)+" · "+second+" "+percent(secondChance);rationaleDetail=(evDirection==="EVEN"?"Expected finishes are close":"The opposing path retains a slight ordinary expected-finish edge")+", but "+first.toLowerCase()+" has substantially more account-relative elite upside. "+copy[0].replace(" NOW","").replace(" THIS RUN","").replace(" IS FAVORED","")+" is favored.";
    }else if(result.evSafetyStatus==="BLOCKS_UPSIDE_OVERRIDE"||result.upsideConsensus==="NO_CONSENSUS"){
      var evLeader=evDifference>=0?"Current":"Fresh";
      rationaleKind="expected_value";rationaleLabel="EXPECTED FINISH EDGE";rationaleMetric=evLeader+" expected "+percent(result.comparison.relativeExpectedAdvantage)+" higher";rationaleDetail="Elite-upside metrics do not establish a safe opposing direction, so the expected-finish advantage drives this result.";
    }
    return {ok:true,decision:result.decision,headline:copy[0],confidenceLabel:copy[1],reason:rationaleDetail,rationaleKind:rationaleKind,rationaleLabel:rationaleLabel,rationaleMetric:rationaleMetric,currentExpectedValue:result.currentRun.expectedEndingLevel,freshExpectedValue:result.freshReplacement.expectedEndingLevel,currentExpected:format(result.currentRun.expectedEndingLevel),currentRange:format(result.currentRun.likelyRange.p25)+"–"+format(result.currentRun.likelyRange.p75),freshExpected:format(result.freshReplacement.expectedEndingLevel),freshRange:format(result.freshReplacement.likelyRange.p25)+"–"+format(result.freshReplacement.likelyRange.p75),outcomeSummary:ordinarySummary,calculationMode:result.comparison.calculationMode+(result.comparison.approximate?" · approximate":""),affordableNow:result.renewal.affordableNow,assumption:"No future Lantern"};
  }
  // When the reset-aware bar is available it decides the verdict: the keep bar
  // rises with the number of re-rolls the player plans to make.
  function topShare(value){if(!finite(value))return "—";if(value<0.001)return "fewer than 1 in 1,000";return "the top "+percent(value);}
  function budgetPresentation(base,budget,format,rewardName){
    if(!base||!base.ok||!budget||!budget.ok)return base;
    var copy={KEEP:["KEEP THIS RUN","Well above your keep bar"],KEEP_FAVORED:["KEEP IS FAVORED","Above your keep bar"],TOO_CLOSE:["TOO CLOSE TO CALL","Right at your keep bar"],RENEW_FAVORED:["RENEW IS FAVORED","Below your keep bar"],RENEW:["RENEW NOW","Well below your keep bar"]}[budget.decision];
    if(!copy)return base;
    var count=budget.rerollsPlanned,plural=count===1?"re-roll":"re-rolls",banked=budget.renewalsBankedNow,bar=format(budget.keepBar),current=format(budget.currentExpectedFinish),reward=rewardName||"this reward";
    var reason="Keep bar with "+count.toLocaleString()+" "+plural+": "+bar+" on "+reward+(count===1?" (an average fresh run).":" ("+topShare(budget.keepBarTopShare)+" of fresh runs).")+" This run: "+current+" expected.",confidence=copy[1];
    if(budget.rerollsSource==="DEFAULT_CAP")reason+=" Default plan; "+banked.toLocaleString()+" Renewals banked.";
    if(banked<1)reason+=" No Renewal banked yet.";
    if(budget.earlyPhase){confidence=budget.decision==="TOO_CLOSE"?"Too early to judge":confidence;reason+=" Too early to judge: check again around ring "+budget.checkHumanRingNumber.toLocaleString()+".";}
    if(budget.decision.indexOf("RENEW")===0&&!budget.affordableNow)reason+=" Need "+format(budget.renewalCurrencyNeeded)+" more Renewal currency to Renew.";
    return Object.assign({},base,{decision:budget.decision,headline:copy[0],confidenceLabel:confidence,reason:reason,rationaleKind:"keep_bar",rationaleLabel:"Keep bar · "+count.toLocaleString()+" "+plural,rationaleMetric:bar,affordableNow:budget.affordableNow,assumption:"Each re-roll is judged about "+budget.checkHours+" hours in.",keepBar:budget.keepBar,keepBarDisplay:bar,rerollsPlanned:count,rerollsSource:budget.rerollsSource,defaultRerolls:budget.defaultRerolls,renewalsBankedNow:banked,resetAware:true});
  }
  function build(input){var model=buildForecast(input);if(model.ok)model.replacement=budgetPresentation(replacementPresentation(input&&input.replacement,input&&input.formatter||String),input&&input.renewalBudget,input&&input.formatter||String,model.rewardName);return model;}
  return {TIER_LABELS:TIER_LABELS,build:build,tierPresentation:tierPresentation,replacementPresentation:replacementPresentation,budgetPresentation:budgetPresentation,playerCalculationMode:playerCalculationMode};
}());
