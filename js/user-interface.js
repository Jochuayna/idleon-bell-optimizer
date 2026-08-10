"use strict";
window.BellOptimizer = window.BellOptimizer || {};

BellOptimizer.userInterface = (function () {
  var form = document.querySelector("#optimizer-form");
  var goal = document.querySelector("#optimization-goal");
  var weights = document.querySelector("#custom-weights");
  var fileInput = document.querySelector("#json-file");
  var fileName = document.querySelector("#file-name");
  var pasteArea = document.querySelector("#json-paste");
  var importButton = document.querySelector("#import-bell-levels");
  var importStatus = document.querySelector("#import-status");
  var importSource = "";
  var importedProbabilityOwnership = null;
  var importedEvaluatorState = null;
  var activeImportedResult = null;
  var importedRingingProgress = null;
  var importedRenewalState = null;
  var calculatedRingingRate = null;
  var importedBellRateState = null;
  var importedDashboardData = null;
  var normalBellRateUpgradeData = null;
  var dashboardRingRateGoal = null;
  var selectedBellStat = BellOptimizer.bellRateSection.DEFAULT_BELL_STAT;
  var selectedGoal = { name: "Fountain", rewardIndex: 6, rewardName: "Coins From Fountain" };
  var latestRunHistoryContext = null;
  var activeImportFailureStage = null;
  var canonicalNoAccountState = null;
  var renewalDecisionController = BellOptimizer.bellRenewalDecision.createController({ onState: renderRenewalDecisionState });

  function renderRenewalDecisionState(state) {
    var host=document.querySelector("#advanced-renewal-result"),title=document.querySelector("#advanced-renewal-title"),confidence=document.querySelector("#advanced-renewal-confidence"),reason=document.querySelector("#advanced-renewal-reason"),details=document.querySelector("#advanced-renewal-details"),warning=document.querySelector("#advanced-renewal-warning"),format=BellOptimizer.idleonNumberFormat.format;
    if(!title)return;
    host.hidden=false;
    title.textContent=state.headline;confidence.textContent=state.confidenceLabel||"";reason.textContent=state.reason||"";details.hidden=!state.detail;var summary=details.querySelector("summary");if(summary)summary.textContent=state.headline==="DECISION ZONE"?"Why is this uncertain?":"Why this recommendation?";
    if(!state.detail)return;
    function interval(estimate,lower,upper){if(Number.isFinite(lower)&&Number.isFinite(upper)&&Math.abs(upper-lower)>1e-9)return format(lower)+"–"+format(upper);if(Number.isFinite(estimate))return format(estimate);if(Number.isFinite(lower))return format(lower);return "Unavailable";}
    document.querySelector("#advanced-renewal-continue").textContent=interval(state.detail.continueEstimate,state.detail.continueLower,state.detail.continueUpper);
    document.querySelector("#advanced-renewal-renew").textContent=interval(state.detail.renewEstimate,state.detail.renewLower,state.detail.renewUpper);
    document.querySelector("#advanced-renewal-backend").textContent=state.detail.backend==="EXACT"?"Exact analytical":state.detail.backend==="HYBRID_SHALLOW_DIRECTIONAL"?"Shallow directional":"Hybrid analytical";
    warning.hidden=!state.detail.warning;warning.textContent=state.detail.warning||"";
  }

  function requestAdvancedRenewalDecision(){var snapshot=automaticPrototypeSnapshot();if(snapshot&&Number.isInteger(selectedGoal.rewardIndex))renewalDecisionController.evaluate(snapshot,selectedGoal.rewardIndex);else renderRenewalDecisionState({headline:"KEEP/RENEW UNAVAILABLE",confidenceLabel:"Unavailable",reason:"Import a complete save before running advanced analysis.",detail:null});}

  function renderReplacementDecision(model){
    var decision=model&&model.replacement,title=document.querySelector("#run-decision-title"),details=document.querySelector("#run-decision-details");
    if(!decision||!decision.ok){var unavailableReason=decision&&decision.reason||"The replacement comparison is unavailable.";title.textContent=decision&&decision.headline||"KEEP/RENEW UNAVAILABLE";document.querySelector("#run-decision-confidence").textContent="Unavailable";document.querySelector("#run-decision-reason").textContent=unavailableReason;document.querySelector("#run-decision-reason-detail").textContent=unavailableReason;details.hidden=true;return;}
    document.querySelector("#run-forecast-hero").dataset.decision=decision.decision.toLowerCase().replace(/_/g,"-");
    details.open=false;
    title.textContent=decision.headline;document.querySelector("#run-decision-confidence").textContent=decision.confidenceLabel;document.querySelector("#run-decision-reason").textContent=decision.reason;document.querySelector("#run-decision-reason-detail").textContent=decision.reason;details.hidden=false;document.querySelector("#run-decision-continue").textContent=decision.currentExpected;document.querySelector("#run-decision-renew").textContent=decision.freshExpected;document.querySelector("#run-primary-fresh-range").textContent=decision.freshRange;var rationaleMetric=document.querySelector("#run-primary-modeled-edge");rationaleMetric.previousElementSibling.textContent=decision.rationaleLabel;rationaleMetric.textContent=decision.rationaleMetric;document.querySelector("#run-decision-warning").textContent=decision.assumption;
  }

  function invalidateSelectedRewardEvaluation(message) {
    document.querySelector("#decision-summary").hidden = true;
    document.querySelector("#remaining-opportunities-card").hidden = true;
    document.querySelector("#main-result-quality").textContent = "SET A GOAL";
    document.querySelector("#main-result-action").textContent = message || "Check this reward to calculate a new result.";
    document.querySelector("#main-result-type").textContent = "Waiting";
    ["#main-result-chance", "#main-result-expected", "#main-result-range", "#main-result-high-end", "#main-result-goal"].forEach(function (selector) { document.querySelector(selector).textContent = "—"; });
    document.querySelector("#main-result-difference").textContent = "No result is shown until the currently selected reward is recalculated.";
  }

  function addRateDetails(selector, rows) {
    var host=document.querySelector(selector);host.replaceChildren();rows.forEach(function(row){var label=document.createElement("span"),value=document.createElement("strong");label.textContent=row[0];value.textContent=row[1];host.appendChild(label);host.appendChild(value);});
  }
  function planSummary(plan, baselineRate) {
    if(!plan||!plan.orderedPurchases.length)return "No Bell-rate purchases selected.";
    var format=BellOptimizer.idleonNumberFormat.format,text="Current → projected: "+format(baselineRate)+" → "+format(plan.bellRate)+"/hr. Absolute gain: +"+format(plan.bellRate-baselineRate)+"/hr ("+plan.percentageRateGain.toFixed(4)+"%). Extra rolls: 2h +"+plan.additional2HourRolls+", 48h +"+plan.additional48HourRolls+". Purchases: "+plan.orderedPurchases.map(function(step){return step.upgradeName+" "+step.levelBefore+" → "+step.levelAfter+" for "+format(step.cost)+" "+step.resource.name;}).join("; ")+". ";
    var maxConsumed=plan.orderedPurchases.reduce(function(max,step){return Math.max(max,step.resourcePoolConsumedPercent||0);},0);if(maxConsumed>0)text+=" Resource pool consumed: "+maxConsumed.toFixed(2)+"%.";if(maxConsumed>=75)text+=" This spends most of this resource pool.";return text;
  }
  function renderCandidateRows() {
    if(!normalBellRateUpgradeData)return;var format=BellOptimizer.idleonNumberFormat.format,items=BellOptimizer.bellRateSection.candidatesForStat(normalBellRateUpgradeData.candidates,selectedBellStat,true),available=document.querySelector("#normal-available-upgrades"),next=document.querySelector("#normal-next-upgrades");available.replaceChildren();next.replaceChildren();function card(c){var row=document.createElement("article"),title=document.createElement("div"),metrics=document.createElement("div"),name=document.createElement("strong"),level=document.createElement("span");row.className="upgrade-candidate-card"+(c.affordableNow?" affordable":"");name.textContent=c.name;level.textContent=c.capped?"Capped":"Level "+c.currentLevel+" → "+c.nextLevel;title.append(name,level);[["Cost",c.cost==null?"Not a direct purchase":format(c.cost)+(c.costResource?" "+c.costResource.name:"")],["Rate gain",c.capped?"—":"+"+BellOptimizer.bellRateSection.formatRateGain(c.absoluteAffectedGain,format)],["New "+selectedBellStat.replace("Bell ",""),c.capped?"—":format(c.projectedAffectedValue)+"/hr"]].forEach(function(pair){var item=document.createElement("div"),label=document.createElement("small"),value=document.createElement("b");label.textContent=pair[0];value.textContent=pair[1];item.append(label,value);metrics.appendChild(item);});row.append(title,metrics);return row;}items.filter(function(c){return !c.capped&&c.affordableNow&&c.deterministicPurchase;}).forEach(function(c){available.appendChild(card(c));});items.filter(function(c){return !c.capped&&!c.affordableNow&&c.deterministicPurchase&&c.cost!=null;}).forEach(function(c){next.appendChild(card(c));});if(!available.children.length)available.appendChild(document.createTextNode("No verified "+selectedBellStat+" upgrades are affordable right now."));if(!next.children.length)next.appendChild(document.createTextNode("No verified direct upgrades are waiting on resources."));
  }
  function renderPrimaryRateRecommendation() {
    if(!normalBellRateUpgradeData)return;var count=BellOptimizer.bellRateSection.activeCandidateCount(normalBellRateUpgradeData.candidates,selectedBellStat);document.querySelector("#normal-multi-upgrade-plans").hidden=selectedBellStat!=="Bell Ring";document.querySelector("#normal-upgrade-paths-summary").textContent=count+" verified "+selectedBellStat+" source"+(count===1?"":"s")+" shown by availability.";
  }
  function renderUpgradeOpportunities(){
    if(!normalBellRateUpgradeData)return;var candidates=normalBellRateUpgradeData.candidates;function affects(c){return (c.effects||[c.effect||"Bell Ring"]).indexOf(selectedBellStat)!==-1;}function list(selector,items,formatter){var host=document.querySelector(selector);host.replaceChildren();items.forEach(function(item){var card=document.createElement("article"),name=document.createElement("strong"),detail=document.createElement("span");card.className="upgrade-opportunity-card";name.textContent=item.name;detail.textContent=formatter(item);card.append(name,detail);host.appendChild(card);});if(!items.length)host.appendChild(document.createTextNode("None in this imported account."));}list("#normal-progression-opportunities",candidates.filter(function(c){return c.eligibilityCategory==="Progression targets"&&affects(c);}),function(c){var gain=c.affectedPercentageGain==null?c.percentageRateGain:c.affectedPercentageGain;return "About "+Math.round(c.cost).toLocaleString()+" kills needed"+(Number.isFinite(gain)?" · projected "+selectedBellStat+" gain +"+gain.toFixed(4)+"%.":".");});list("#normal-rng-opportunities",candidates.filter(function(c){return c.eligibilityCategory==="RNG-dependent"&&affects(c);}),function(c){return (c.id==="jar-11"?"Big Beef Rock Jar next level":c.id==="jar-36"?"Twisted Rupie Jar next level":"Future account progression")+(c.percentageRateGain==null?"":" · hypothetical +"+c.percentageRateGain.toFixed(4)+"%");});list("#normal-capped-sources",candidates.filter(function(c){return (c.eligibilityCategory==="Capped"||c.status==="progression-gated")&&affects(c);}),function(c){return c.capped?"Current verified cap reached.":"Not currently unlocked.";});
  }
  function renderNormalBellRate(result) {
    var section=document.querySelector("#bell-rate-section"),format=BellOptimizer.idleonNumberFormat.format,view=BellOptimizer.bellRateSection.buildBreakdown(result.data);section.hidden=false;document.querySelector("#bell-rate-breakdown-tab").click();
    function factor(value){if(value>=1000000)return format(value);if(value>=1000)return (value/1000).toFixed(2).replace(/0+$/,"").replace(/\.$/,"")+"K";if(value>=100)return value.toFixed(2).replace(/0+$/,"").replace(/\.$/,"");return String(value);}
    if(!view.ok){document.querySelector("#normal-rate-status").textContent=view.error;return;}
    document.querySelector("#normal-bell-rate").textContent=format(view.calculatedRate)+" EXP/hour";document.querySelector("#normal-bell-rate").title=format(view.exactRate)+" EXP/hour";document.querySelector("#normal-bell-rate-exact").textContent=format(view.exactRate)+" EXP/hour";document.querySelector("#normal-rate-total").textContent=format(view.calculatedRate)+"/hr";document.querySelector("#normal-rate-monument").textContent="×"+factor(view.monumentMultiplier);document.querySelector("#normal-rate-measurement").textContent="×"+factor(view.measurementMultiplier);document.querySelector("#normal-rate-methods").textContent="×"+factor(view.methodMultiplier);document.querySelector("#normal-rate-jar11").textContent="×"+factor(view.jar11Multiplier);document.querySelector("#normal-rate-jar36").textContent="×"+factor(view.jar36Multiplier);document.querySelector("#normal-rate-status").textContent="";
    addRateDetails("#normal-monument-details",[["Monument reward 7 level",view.monument.reward7Level.toLocaleString()],["Monument slot 9 level",view.monument.slot9Level.toLocaleString()],["Monument Cosmo level",String(view.monument.cosmoLevel)],["Monumental Boost level",String(view.monument.fountainLevel)],["Monumental Boost marble level",String(view.monument.marbleLevel)],["Raw Monument bonus percent","+"+format(view.monument.rawBonusPercent)+"%"],["Final Monument multiplier","×"+format(view.monument.multiplier)]]);
    addRateDetails("#normal-measurement-details",[["Ringing Measurement level",String(view.measurement.level)],["Measurement Cosmo level",String(view.measurement.cosmoLevel)],["Total Death Note points",view.measurement.deathNotePoints.toLocaleString()],["Measurement scaling","×"+String(view.measurement.scaling)],["Raw Measurement bonus percent","+"+String(view.measurement.rawBonusPercent)+"%"],["Final Measurement multiplier","×"+String(view.measurement.multiplier)]]);
    var methodRows=view.methods.levels.map(function(level,index){var method=BellOptimizer.BELL_METHODS[index];return ["Method "+index+" — "+method.effect+" • "+method.resourceName,"Level "+level.toLocaleString()];});methodRows.push(["Upgrade 45",view.methods.upgrade45Owned?"Owned":"Not owned"],["Bell Ring methods raw percent sum","+"+format(view.methods.rawPercent)+"%"],["Final Bell Ring Methods multiplier","×"+format(view.methods.multiplier)]);addRateDetails("#normal-method-details",methodRows);
    addRateDetails("#normal-jar11-details",[["Big Beef Rock Jar level",String(view.jars.jar11Level)],["Raw bonus","+"+String(view.jars.jar11RawPercent)+"%"],["Multiplier","×"+String(view.jars.jar11Multiplier)]]);addRateDetails("#normal-jar36-details",[["Twisted Rupie Jar level",String(view.jars.jar36Level)],["Raw bonus","+"+String(view.jars.jar36RawPercent)+"%"],["Multiplier","×"+String(view.jars.jar36Multiplier)]]);
    try { var generated=result.data.bellRateUpgradeCandidates;if(!generated||!generated.ok)throw new Error(generated&&generated.error||"Unknown candidate error");var plans={progressionAndRngOpportunities:generated.candidates};normalBellRateUpgradeData={ok:true,candidates:generated.candidates,baselineRate:generated.baselineRate,plans:null,state:result.data.bellRateUpgradeState,precomputedCandidates:generated,invalidCandidateWarnings:generated.candidates.filter(function(candidate){return candidate.validationValid===false;}).map(function(candidate){return {id:candidate.id,name:candidate.name,errors:candidate.validationErrors.slice()};})};document.querySelector("#normal-upgrade-paths-status").textContent="";document.querySelector("#normal-practical-plan").textContent="Open this section to calculate multi-upgrade plans.";document.querySelector("#normal-maximum-plan").textContent="Open this section to calculate multi-upgrade plans.";document.querySelector("#normal-search-warning").textContent="";renderPrimaryRateRecommendation();renderCandidateRows();
      var candidateWarnings=normalBellRateUpgradeData.invalidCandidateWarnings;if(candidateWarnings.length)document.querySelector("#normal-upgrade-paths-status").textContent=candidateWarnings.length+" invalid upgrade candidate"+(candidateWarnings.length===1?" was":"s were")+" excluded safely. Rate Breakdown and save import remain available.";
      renderUpgradeOpportunities();
    } catch(error){normalBellRateUpgradeData=null;console.error("Bell Rate Upgrade Paths failed to render:",error);document.querySelector("#normal-upgrade-paths-status").textContent="Upgrade Paths could not be loaded.";}
  }

  function dashboardStateWithCharacter() {
    if(!importedBellRateState)return null;
    var state=JSON.parse(JSON.stringify(importedBellRateState)),selected=document.querySelector("#dashboard-active-character").value;
    if(selected!==""){
      var character=state.coinCharacters.find(function(item){return item.index===Number(selected);});
      if(character){state.activeCharacterIndex=character.index;state.activeCharacterName=character.name;state.methodOwnedResources[0]=character.coins;}
    }
    return state;
  }

  function dashboardMetric(label,value){var item=document.createElement("div"),name=document.createElement("span"),number=document.createElement("strong");name.textContent=label;number.textContent=value;item.appendChild(name);item.appendChild(number);return item;}

  function renderDashboardPlan(host,changes,options){
    options=options||{};
    var pairs;
    host.replaceChildren();
    changes.forEach(function(change){var row=document.createElement("article");row.className="dashboard-plan-item"+(change.isMethodScalingBridge?" method-scaling-bridge":""),pairs=[];if(change.isMethodScalingBridge){pairs.push(["Global Method scaling","via "+change.bridgeVia+" · Level "+change.currentLevel+" → "+change.targetLevel]);pairs.push(["Why it helps",change.methodBreakpointsCrossed+" Method scaling breakpoint"+(change.methodBreakpointsCrossed===1?"":"s")]);pairs.push(["Global Method multiplier",change.methodMultiplierBeforeDisplay+" → "+change.methodMultiplierAfterDisplay]);pairs.push(["Ring Rate",(change.rateBeforeDisplay||"Current")+" → "+change.rateAfterDisplay]);}else{pairs.push([change.name,"Level "+change.currentLevel+" → "+change.targetLevel]);pairs.push(["Cost",change.costDisplay+" "+change.resource]);if(!options.hideRemaining)pairs.push(["Remaining",change.remainingDisplay+" "+change.resource]);pairs.push(["Ring Rate after",change.rateAfterDisplay]);}pairs.forEach(function(pair){var item=document.createElement("div"),label=document.createElement("small"),value=document.createElement("strong");label.textContent=pair[0];value.textContent=pair[1];item.appendChild(label);item.appendChild(value);row.appendChild(item);});if(change.isMethodScalingBridge){var cost=document.createElement("p");cost.className="bridge-cost";cost.textContent="Cost: "+change.costDisplay+" "+change.resource;row.appendChild(cost);}host.appendChild(row);});
  }

  function renderDashboardNextTargets(model){
    var section=document.querySelector("#dashboard-next-targets"),host=document.querySelector("#dashboard-next-target-list"),moreHost=document.querySelector("#dashboard-more-target-list"),more=document.querySelector("#dashboard-more-targets");host.replaceChildren();moreHost.replaceChildren();function targetRow(target){var row=document.createElement("article");row.className="dashboard-next-target-item";[[target.name,"Level "+target.currentLevel+" → "+target.nextLevel],["Need",target.shortfallDisplay+" more "+target.resource],["Projected gain",target.relativeGainDisplay],["Projected Ring Rate",target.projectedRateDisplay]].forEach(function(pair){var item=document.createElement("div"),label=document.createElement("small"),value=document.createElement("strong");label.textContent=pair[0];value.textContent=pair[1];item.appendChild(label);item.appendChild(value);row.appendChild(item);});return row;}if(model.nextTargets[0])host.appendChild(targetRow(model.nextTargets[0]));model.nextTargets.slice(1).forEach(function(target){moreHost.appendChild(targetRow(target));});more.hidden=model.nextTargets.length<=1;more.open=false;document.querySelector("#dashboard-more-target-count").textContent=String(Math.max(0,model.nextTargets.length-1));
    var threshold=document.querySelector("#dashboard-method-threshold");threshold.hidden=!model.methodThreshold;if(model.methodThreshold){threshold.textContent=model.methodThreshold.levelsNeeded+" more total Method level"+(model.methodThreshold.levelsNeeded===1?"":"s")+" reaches your next ×1.1 Method scaling step.";}
    var locked=document.querySelector("#dashboard-locked-sources");locked.hidden=model.lockedCount===0;document.querySelector("#dashboard-locked-count").textContent=String(model.lockedCount);
    section.hidden=model.nextTargets.length===0&&!model.methodThreshold&&model.lockedCount===0;
  }

  function renderDashboard(result){
    importedDashboardData=result.data;
    importedBellRateState=result.data.bellRateUpgradeState;
    var characterSelect=document.querySelector("#dashboard-active-character"),previous=characterSelect.value;characterSelect.replaceChildren();var prompt=document.createElement("option");prompt.value="";prompt.textContent="Choose a character";characterSelect.appendChild(prompt);result.data.bellRateCoinCharacters.forEach(function(character){var option=document.createElement("option");option.value=String(character.index);option.textContent=(character.index+1)+": "+character.name+" ("+BellOptimizer.idleonNumberFormat.format(character.coins)+" Coins)";characterSelect.appendChild(option);});if(Array.from(characterSelect.options).some(function(option){return option.value===previous;}))characterSelect.value=previous;
    var state=dashboardStateWithCharacter(),optimizer=BellOptimizer.bellRateOptimizer.optimizeCurrentlyAffordable(state),next=BellOptimizer.bellRateTargetSolver.buildNextTargets(state),model=BellOptimizer.bellDashboardViewModel.build({optimizerResult:optimizer,nextTargets:next,baseState:state,formatter:BellOptimizer.idleonNumberFormat.format});
    document.querySelector("#dashboard-no-save").hidden=true;document.querySelector("#dashboard-content").hidden=false;dashboardRingRateGoal=null;document.querySelector("#collectible-jar11-current").textContent="Current: "+state.jar11Level.toLocaleString();document.querySelector("#collectible-jar36-current").textContent="Current: "+state.jar36Level.toLocaleString();document.querySelector("#collectible-jar11-input").value="";document.querySelector("#collectible-jar36-input").value="";document.querySelector("#collectible-what-if-result").hidden=true;document.querySelector("#collectible-goal-search").hidden=true;document.querySelector("#collectible-what-if-status").textContent="Enter one or both hypothetical Jar levels.";
    if(!model.ok){document.querySelector("#dashboard-optimizer-message").textContent=model.message;document.querySelector("#dashboard-plan-details").hidden=true;return;}
    document.querySelector("#dashboard-current-rate").textContent=model.current.display;document.querySelector("#run-workspace-ring-rate").textContent=model.current.display;document.querySelector("#dashboard-rate-before").textContent=model.current.display;document.querySelector("#dashboard-rate-after").textContent=model.optimized.display;document.querySelector("#dashboard-relative-gain").textContent=model.gain.relativeDisplay;document.querySelector("#dashboard-absolute-gain").textContent=model.gain.absoluteDisplay;
    document.querySelector("#dashboard-optimizer-card").dataset.state=model.state;document.querySelector("#dashboard-optimizer-title").textContent=model.state==="nothing-affordable"?"No affordable upgrades right now":model.state==="one-upgrade"?"Best upgrade available now":"Upgrades you can afford now";document.querySelector("#dashboard-optimizer-message").textContent=model.state==="nothing-affordable"?"Your current Ring Rate is shown above. Start with the next upgrade target below.":model.changes.length+" verified upgrade "+(model.changes.length===1?"change is":"changes are")+" available with your current resources.";
    document.querySelector("#dashboard-coin-control").hidden=!model.coinSelectionRequired;document.querySelector("#dashboard-coin-control").classList.toggle("is-plan-relevant",model.changes.some(function(change){return change.id==="bell-method-0";}));document.querySelector("#dashboard-plan-details").hidden=model.changes.length===0;document.querySelector("#dashboard-plan-count").textContent=model.changes.length+" upgrade "+(model.changes.length===1?"change":"changes");renderDashboardPlan(document.querySelector("#dashboard-plan-list"),model.changes);renderDashboardNextTargets(model);document.querySelector("#dashboard-goal-result").hidden=true;document.querySelector("#dashboard-goal-status").textContent="";
  }

  function renderDashboardTarget(model){
    var result=document.querySelector("#dashboard-goal-result"),metrics=document.querySelector("#dashboard-goal-metrics"),plan=document.querySelector("#dashboard-goal-plan"),planSection=document.querySelector("#dashboard-goal-plan-section");result.hidden=false;result.dataset.state=model.state;document.querySelector("#dashboard-goal-result-title").textContent=model.title;metrics.replaceChildren();plan.replaceChildren();planSection.hidden=!model.plan||model.plan.length===0;document.querySelector("#dashboard-collectible-future").hidden=model.state!=="unreachable";document.querySelector("#collectible-goal-search").hidden=model.state!=="unreachable";
    if(!model.ok){document.querySelector("#dashboard-goal-status").className="import-status error";document.querySelector("#dashboard-goal-status").textContent=model.message;result.hidden=true;return;}
    document.querySelector("#dashboard-goal-status").className="import-status "+(model.state==="unreachable"?"warning":"success");document.querySelector("#dashboard-goal-status").textContent=model.state==="reachable"?"A smaller target-reaching plan is shown below.":model.state==="already-met"?"Your imported account already meets this goal.":"Your best currently-affordable result and remaining shortfall are shown below.";
    metrics.appendChild(dashboardMetric("Current",model.currentDisplay));if(model.state==="reachable")metrics.appendChild(dashboardMetric("Plan reaches",model.planReachesDisplay));if(model.state==="unreachable"){metrics.appendChild(dashboardMetric("Best now",model.bestDisplay));metrics.appendChild(dashboardMetric("Shortfall",model.shortfallDisplay));}renderDashboardPlan(plan,model.plan,{hideRemaining:true});
  }

  function collectibleMode(){return document.querySelector('[name="collectible-target-mode"]:checked').value;}
  function syncCollectibleInputs(){
    var delta=collectibleMode()==="delta",jar11=document.querySelector("#collectible-jar11-input"),jar36=document.querySelector("#collectible-jar36-input");
    jar11.placeholder=delta?"Increase by":"Target level";jar36.placeholder=delta?"Increase by":"Target level";
  }
  function parseCollectibleLevel(input,label){
    var text=input.value.trim();if(!text)return {ok:true,empty:true};var value=Number(text);
    if(!Number.isSafeInteger(value)||value<0)return {ok:false,message:label+" must be a nonnegative whole number."};
    return {ok:true,value:value};
  }
  function targetLevelCard(item){
    var card=document.createElement("article"),title=document.createElement("strong"),levels=document.createElement("span");
    title.textContent=item.source.replace(/^Jar collectible \d+ \(|\)$/g,"");levels.textContent="Level "+item.currentValue.toLocaleString()+" → "+item.targetValue.toLocaleString()+" · "+(item.delta>=0?"+":"")+item.delta.toLocaleString();card.append(title,levels);return card;
  }
  function renderCollectibleScenario(result){
    var host=document.querySelector("#collectible-what-if-result"),levels=document.querySelector("#collectible-target-levels"),format=BellOptimizer.idleonNumberFormat.format;levels.replaceChildren();
    if(!result.ok){host.hidden=true;return;}
    result.overrides.forEach(function(item){levels.appendChild(targetLevelCard(item));});
    document.querySelector("#collectible-projected-rate").textContent=format(result.projectedRate)+"/hr";
    document.querySelector("#collectible-current-to-projected").textContent=format(result.currentRate)+"/hr → "+format(result.projectedRate)+"/hr";
    document.querySelector("#collectible-absolute-gain").textContent=(result.absoluteGain>=0?"+":"")+format(result.absoluteGain)+"/hr";
    document.querySelector("#collectible-relative-gain").textContent=(result.relativeGain>=0?"+":"")+(result.relativeGain*100).toFixed(2).replace(/0+$/,"" ).replace(/\.$/,"")+"%";
    host.hidden=false;
  }
  function renderCollectibleCombinations(result){
    var host=document.querySelector("#collectible-combinations"),status=document.querySelector("#collectible-combination-status"),format=BellOptimizer.idleonNumberFormat.format;host.replaceChildren();
    if(!result.ok||!result.jars||!result.jars.enabled){status.className="import-status error";status.textContent=result.error?result.error.message:"Collectible target search is unavailable.";return;}
    if(result.jars.status!=="HYPOTHETICAL_TARGET_REACHABLE"){status.className="import-status warning";status.textContent=result.jars.reason||"The goal is not reached within those hypothetical maximum levels.";return;}
    status.className="import-status success";status.textContent="Possible target combinations";
    result.jars.options.slice(0,12).forEach(function(option){var row=document.createElement("article"),pairs=[["Big Beef Rock","Level "+option.jar11Target+" · +"+option.jar11Delta],["Twisted Rupie","Level "+option.jar36Target+" · +"+option.jar36Delta],["Projected Ring Rate",format(option.projectedRate)+"/hr"],["Goal overshoot","+"+format(option.overshoot)+"/hr"]];row.className="collectible-combination-row";pairs.forEach(function(pair){var cell=document.createElement("div"),label=document.createElement("small"),value=document.createElement("strong");label.textContent=pair[0];value.textContent=pair[1];cell.append(label,value);row.appendChild(cell);});host.appendChild(row);});
  }

  form.addEventListener("submit", function (event) { event.preventDefault(); });
  document.querySelector(".advanced-content").appendChild(document.querySelector("#ring-import-developer-details"));

  goal.addEventListener("change", function () {
    weights.hidden = goal.value !== "custom";
  });

  fileInput.addEventListener("change", function () {
    fileName.textContent = fileInput.files.length ? fileInput.files[0].name + " selected for local import or inspection" : "No file selected";
    if (fileInput.files.length) { importSource = "file"; importButton.disabled = false; }
  });

  pasteArea.addEventListener("input", function () {
    if (pasteArea.value.length) {
      importSource = "paste";
      importStatus.className = "import-status";
      importStatus.textContent = "JSON ready to import.";
      importButton.disabled = false;
    }
  });

  document.querySelector("#normal-multi-upgrade-plans").addEventListener("toggle", function () {
    var details=this;
    if(!details.open||!normalBellRateUpgradeData||normalBellRateUpgradeData.plans||normalBellRateUpgradeData.loadingPlans)return;
    var importData=normalBellRateUpgradeData;
    importData.loadingPlans=true;
    document.querySelector("#normal-practical-plan").textContent="Building upgrade pathsâ€¦";
    document.querySelector("#normal-maximum-plan").textContent="Building upgrade pathsâ€¦";
    setTimeout(function(){
      try {
        var completed=BellOptimizer.bellRateSection.buildUpgradePaths(importData.state,importData.precomputedCandidates);
        if(normalBellRateUpgradeData!==importData)return;
        if(!completed.ok)throw new Error(completed.error||"Unknown optimizer error");
        importData.plans=completed.plans;
        document.querySelector("#normal-practical-plan").textContent=planSummary(completed.plans.practicalPlan,completed.baselineRate);
        document.querySelector("#normal-maximum-plan").textContent=planSummary(completed.plans.bellOnlyMaximum,completed.baselineRate);
        document.querySelector("#normal-search-warning").textContent=(completed.plans.searchMethod==="exact"?"Exact within the current safety limit.":completed.plans.searchMethod+" within the current safety limit.")+(completed.plans.searchLimitWarning?" The result may improve if the search limit is increased.":"");
      } catch(error) {
        console.error("Bell multi-upgrade plans failed:",error);
        document.querySelector("#normal-practical-plan").textContent="Multi-upgrade plans could not be calculated.";
        document.querySelector("#normal-maximum-plan").textContent="";
      } finally { importData.loadingPlans=false; }
    },0);
  });

  function showImportError(text) {
    importStatus.className = "import-status error";
    importStatus.textContent = text;
  }

  function formatDuration(hours) {
    if (!Number.isFinite(hours) || hours < 0) return "Unavailable";
    var seconds = Math.round(hours * 3600);
    if (seconds < 60) return seconds + (seconds === 1 ? " second" : " seconds");
    var minutes = Math.round(seconds / 60);
    if (minutes < 60) return minutes + (minutes === 1 ? " minute" : " minutes");
    var wholeHours = Math.floor(minutes / 60), remainingMinutes = minutes % 60;
    return wholeHours + (wholeHours === 1 ? " hour" : " hours") + (remainingMinutes ? " " + remainingMinutes + (remainingMinutes === 1 ? " minute" : " minutes") : "");
  }

  function renderPlannerNumber(value, maximumFractionDigits) {
    if (!Number.isFinite(value)) return "Unavailable";
    return value.toLocaleString(undefined, { maximumFractionDigits: maximumFractionDigits === undefined ? 2 : maximumFractionDigits });
  }

  function getRunOutlookHours() {
    var selected = document.querySelector("#run-outlook-select").value;
    return selected === "custom" ? Number(document.querySelector("#custom-outlook-hours").value) : Number(selected);
  }

  function calculateFreshRunPlan() {
    var status = document.querySelector("#fresh-run-planner-status"), results = document.querySelector("#fresh-run-planner-results");
    if (!importedEvaluatorState || !importedRenewalState || !Number.isFinite(calculatedRingingRate)) { status.className = "import-status error"; status.textContent = "Automatic Bell EXP/hour reconstruction is unavailable for this save."; results.hidden = true; return; }
    if (!Number.isInteger(selectedGoal.rewardIndex)) { status.className = "import-status error"; status.textContent = "Choose Fountain or Villager EXP for the fresh-run planner."; results.hidden = true; return; }
    var targetText = document.querySelector("#fresh-run-target").value.trim(), target = Number(targetText), duration = Number(document.querySelector("#planner-lantern-duration").value);
    if (targetText === "" || !Number.isFinite(target) || target < 0) { status.className = "import-status error"; status.textContent = "Enter a finite, nonnegative fresh-run target level."; results.hidden = true; return; }
    if (!Number.isFinite(duration) || duration <= 0) { status.className = "import-status error"; status.textContent = "Custom Lantern duration must be greater than zero."; results.hidden = true; return; }
    var plan = BellOptimizer.resetLanternPlanner.evaluateFreshRun(Object.assign({ ringingExpPerHour: calculatedRingingRate, lanternDurationHours: duration, targetLevel: target, currentRenewalCurrency: importedRenewalState.currentCurrency, renewalCurrencyPerHour: importedRenewalState.currencyPerHour, renewalCost: importedRenewalState.renewalCost }, evaluatorMechanics(selectedGoal.rewardIndex)));
    if (!plan.ok) { status.className = "import-status error"; status.textContent = plan.error; results.hidden = true; return; }
    var probability = plan.successProbabilityPerFreshRun;
    document.querySelector("#fresh-run-checkpoint").textContent = "One " + renderPlannerNumber(duration, 2) + "-hour Lantern";
    document.querySelector("#planner-checkpoint-ring").textContent = "About ring " + plan.progression.endingHumanRing.toLocaleString();
    document.querySelector("#planner-per-run-chance").textContent = formatPercentValue(probability) + " (" + friendlyResultType(plan.evaluation.mode) + ")";
    document.querySelector("#planner-average-runs").textContent = Number.isFinite(plan.resources.expectedRuns) ? renderPlannerNumber(plan.resources.expectedRuns, 1) + " attempts" : "Unavailable";
    document.querySelector("#planner-affordable-runs").textContent = plan.resources.affordableRunsNow.toLocaleString() + " runs (" + formatPercentValue(plan.resources.maximumCurrentCumulativeChance) + " cumulative chance)";
    var warning = document.querySelector("#planner-practicality-warning"), fiftyTier = plan.resources.tiers[0];
    warning.hidden = plan.resources.practicality !== "Not realistically farmable";
    if (!warning.hidden) document.querySelector("#planner-practicality-message").textContent = "Reaching this target would require about " + (Number.isFinite(fiftyTier.requiredRuns) ? BellOptimizer.idleonNumberFormat.format(fiftyTier.requiredRuns) : "an unavailable number of") + " fresh attempts for a 50% chance. Lower the target or use a later checkpoint.";
    var body = document.querySelector("#confidence-table-body"); body.replaceChildren();
    plan.resources.tiers.forEach(function (tier) {
      var row = document.createElement("div"); row.className = "confidence-row"; row.setAttribute("role", "row");
      var waitText = BellOptimizer.resetLanternPlanner.formatWaitTime(tier.renewalGenerationHours);
      var values = [Math.round(tier.confidence * 100) + "%", Number.isFinite(tier.requiredRuns) ? tier.requiredRuns.toLocaleString() : "Unavailable", Number.isFinite(tier.renewalCurrencyRequired) ? tier.renewalCurrencyRequired.toLocaleString() : "Unavailable", waitText];
      values.forEach(function (value) { var cell = document.createElement("span"); cell.textContent = value; row.appendChild(cell); }); body.appendChild(row);
    });
    document.querySelector("#fresh-preview-raw-ring").textContent = plan.progression.endingRawRing.toLocaleString();
    document.querySelector("#fresh-preview-ring").textContent = plan.progression.endingHumanRing.toLocaleString();
    document.querySelector("#fresh-preview-rings").textContent = plan.progression.ringsCompleted.toLocaleString();
    document.querySelector("#fresh-preview-majors").textContent = plan.progression.majorRingsCrossed.toLocaleString();
    document.querySelector("#advanced-fresh-probability").textContent = formatPercentValue(probability);
    document.querySelector("#advanced-fresh-method").textContent = plan.evaluation.mode;
    document.querySelector("#advanced-affordable-attempts").textContent = plan.resources.affordableRunsNow.toLocaleString();
    document.querySelector("#advanced-planner-currency").textContent = renderPlannerNumber(importedRenewalState.currentCurrency, 6) + " / " + renderPlannerNumber(importedRenewalState.currencyPerHour, 3) + " per hour";
    document.querySelector("#advanced-planner-cost").textContent = importedRenewalState.renewalCost.toLocaleString();
    results.hidden = false; status.className = "import-status success"; status.textContent = "Fresh-run resource plan calculated for " + selectedGoal.rewardName + ". This is not a recommendation to reset the current run.";
  }

  function calculateCurrentResetDecision() {
    var status = document.querySelector("#simple-evaluator-status"), summary = document.querySelector("#decision-summary");
    if (!importedEvaluatorState || !importedRingingProgress || !importedRenewalState) { status.className = "import-status error"; status.textContent = "Import a valid save before comparing the current run with a fresh reset."; summary.hidden = true; return; }
    if (!Number.isFinite(calculatedRingingRate)) { status.className = "import-status error"; status.textContent = "Automatic Bell EXP/hour reconstruction is unavailable for this save."; summary.hidden = true; document.querySelector("#main-result-quality").textContent = "RATE UNAVAILABLE"; document.querySelector("#main-result-action").textContent = "The verified Bell Ring rate dependencies could not all be reconstructed."; return; }
    if (!Number.isInteger(selectedGoal.rewardIndex)) { status.className = "import-status error"; status.textContent = "Choose one Bell reward for this comparison."; summary.hidden = true; return; }
    var targetText = document.querySelector("#simple-target-level").value.trim(), target = Number(targetText), duration = getRunOutlookHours();
    if (targetText === "" || !Number.isFinite(target) || target < 0) { status.className = "import-status error"; status.textContent = "Enter a finite, nonnegative target level."; summary.hidden = true; return; }
    if (!Number.isFinite(duration) || duration <= 0) { status.className = "import-status error"; status.textContent = "The Advanced run outlook must be greater than zero hours."; summary.hidden = true; return; }
    var objective = BellOptimizer.objectiveSelection.resolve(importedEvaluatorState.rewardLevels, selectedGoal.rewardIndex);
    if (!objective.ok) { status.className = "import-status error"; status.textContent = objective.error; summary.hidden = true; return; }
    var decision = BellOptimizer.currentResetDecision.evaluateDecision(Object.assign({ selectedRewardIndex: objective.rewardIndex, currentRawRingIndex: importedRingingProgress.rawRingIndex, currentHumanRing: importedEvaluatorState.currentRing, currentRingingExp: importedRingingProgress.currentRingingExp, currentRewardLevel: objective.currentLevel, targetLevel: target, ringingExpPerHour: calculatedRingingRate, durationHours: duration, currentRenewalCurrency: importedRenewalState.currentCurrency, renewalCurrencyPerHour: importedRenewalState.currencyPerHour }, evaluatorMechanics(objective.rewardIndex)));
    if (!decision.ok) { status.className = "import-status error"; status.textContent = decision.error; summary.hidden = true; return; }
    var continueEvaluation = decision.continuePath.evaluation, resetEvaluation = decision.resetPath.evaluation, recommendation = decision.recommendation;
    document.querySelector("#main-result-quality").textContent = recommendation.label;
    document.querySelector("#main-result-card").dataset.quality = recommendation.label.toLowerCase().replace(/\s+/g,"-");
    var outlookLabel = renderPlannerNumber(duration, 2) + (duration === 1 ? " hour" : " hours");
    document.querySelector("#decision-objective-line").textContent = "For " + BellOptimizer.idleonNumberFormat.format(target) + " " + selectedGoal.name + " over the next " + outlookLabel;
    document.querySelector("#main-result-action").textContent = recommendation.action + " — " + recommendation.explanation;
    document.querySelector("#main-result-type").textContent = recommendation.action;
    document.querySelector("#main-result-chance").textContent = formatPercentValue(continueEvaluation.probabilityOfTarget);
    document.querySelector("#main-result-expected").textContent = formatWholeLevel(continueEvaluation.expectedFinalLevel);
    document.querySelector("#main-result-range").textContent = BellOptimizer.idleonNumberFormat.format(continueEvaluation.percentiles.p25) + "–" + BellOptimizer.idleonNumberFormat.format(continueEvaluation.percentiles.p90);
    document.querySelector("#main-result-expected-label").textContent = "Expected after " + outlookLabel;
    document.querySelector("#main-result-range-label").textContent = "Likely range after " + outlookLabel;
    document.querySelector("#main-result-high-end").textContent = BellOptimizer.idleonNumberFormat.format(continueEvaluation.percentiles.p90);
    document.querySelector("#main-result-goal").textContent = BellOptimizer.idleonNumberFormat.format(target) + " " + selectedGoal.name;
    var highEnd = continueEvaluation.percentiles.p90;
    var highEndRelation = highEnd < target * 0.75 ? "far below" : (highEnd < target ? "below" : (highEnd === target ? "at" : "above"));
    document.querySelector("#main-result-difference").textContent = "Your high-end likely result is about " + BellOptimizer.idleonNumberFormat.format(highEnd) + ", " + highEndRelation + " your " + BellOptimizer.idleonNumberFormat.format(target) + " goal.";
    document.querySelector("#decision-current-chance").textContent = formatPercentValue(continueEvaluation.probabilityOfTarget);
    document.querySelector("#decision-reset-chance").textContent = formatPercentValue(resetEvaluation.probabilityOfTarget);
    var resourceText = "Renewing costs 25 renewal currency. The fresh comparison uses one 2-hour Lantern, then passive progress through the rest of the " + outlookLabel + " outlook; Lantern inventory is not known.";
    if (decision.affordableRenewals < 1) resourceText += " One renewal needs " + renderPlannerNumber(decision.additionalCurrencyForOne, 3) + " more currency (" + BellOptimizer.resetLanternPlanner.formatWaitTime(decision.hoursUntilOneRenewal) + ").";
    document.querySelector("#decision-resource-text").textContent = resourceText;
    document.querySelector("#decision-continue-ring").textContent = decision.continuePath.progression.endingHumanRing.toLocaleString();
    document.querySelector("#decision-reset-ring").textContent = decision.resetPath.progression.endingHumanRing.toLocaleString();
    document.querySelector("#decision-continue-probability").textContent = formatPercentValue(continueEvaluation.probabilityOfTarget);
    document.querySelector("#decision-reset-probability").textContent = formatPercentValue(resetEvaluation.probabilityOfTarget);
    document.querySelector("#decision-continue-expected").textContent = formatWholeLevel(continueEvaluation.expectedFinalLevel);
    document.querySelector("#decision-reset-expected").textContent = formatWholeLevel(resetEvaluation.expectedFinalLevel);
    document.querySelector("#decision-continue-range").textContent = BellOptimizer.idleonNumberFormat.format(continueEvaluation.percentiles.p25) + "–" + BellOptimizer.idleonNumberFormat.format(continueEvaluation.percentiles.p90);
    document.querySelector("#decision-reset-range").textContent = BellOptimizer.idleonNumberFormat.format(resetEvaluation.percentiles.p25) + "–" + BellOptimizer.idleonNumberFormat.format(resetEvaluation.percentiles.p90);
    document.querySelector("#advanced-decision-duration").textContent = renderPlannerNumber(duration, 2) + " hours";
    document.querySelector("#advanced-decision-difference").textContent = (recommendation.probabilityDifference >= 0 ? "+" : "") + (recommendation.probabilityDifference * 100).toFixed(2) + " percentage points";
    document.querySelector("#advanced-continue-method").textContent = continueEvaluation.mode;
    document.querySelector("#advanced-reset-method").textContent = resetEvaluation.mode;
    document.querySelector("#advanced-continue-rolls").textContent = decision.continuePath.progression.ringsCompleted.toLocaleString();
    document.querySelector("#advanced-reset-rolls").textContent = decision.resetPath.progression.ringsCompleted.toLocaleString();
    document.querySelector("#advanced-continue-majors").textContent = decision.continuePath.progression.majorRingsCrossed.toLocaleString();
    document.querySelector("#advanced-reset-majors").textContent = decision.resetPath.progression.majorRingsCrossed.toLocaleString();
    document.querySelector("#advanced-decision-affordable").textContent = decision.affordableRenewals.toLocaleString();
    document.querySelector("#advanced-time-one-renewal").textContent = BellOptimizer.resetLanternPlanner.formatWaitTime(decision.hoursUntilOneRenewal);
    document.querySelector("#advanced-decision-percentiles").textContent = "Continue P10/P25/Median/P75/P90: " + [continueEvaluation.percentiles.p10, continueEvaluation.percentiles.p25, continueEvaluation.percentiles.median, continueEvaluation.percentiles.p75, continueEvaluation.percentiles.p90].join(" / ") + ". Fresh reset: " + [resetEvaluation.percentiles.p10, resetEvaluation.percentiles.p25, resetEvaluation.percentiles.median, resetEvaluation.percentiles.p75, resetEvaluation.percentiles.p90].join(" / ") + ".";
    summary.hidden = false; status.className = "import-status success"; status.textContent = "Run evaluation complete. Probability results are estimates, not guarantees.";
    renderRemainingOpportunities(decision, target, duration);
    calculateGainPace(2);
  }

  function renderRemainingOpportunities(decision, target, outlookHours) {
    var analysis = BellOptimizer.remainingOpportunities.analyze(Object.assign({
      startingRawRingIndex: importedRingingProgress.rawRingIndex,
      startingRingingExp: importedRingingProgress.currentRingingExp,
      ringingExpPerHour: calculatedRingingRate
    }, evaluatorMechanics(selectedGoal.rewardIndex)));
    if (!analysis.ok) { document.querySelector("#remaining-opportunities-card").hidden = true; return; }
    var wholeDailyWindows = outlookHours === 24 ? 1 : outlookHours === 48 ? 2 : outlookHours === 72 ? 3 : 0;
    var outlookRolls = wholeDailyWindows ? analysis.windows.slice(0, wholeDailyWindows).reduce(function (sum, windowResult) { return sum + windowResult.ringsCompleted; }, 0) : decision.continuePath.progression.ringsCompleted;
    var outlookMajors = wholeDailyWindows ? analysis.windows.slice(0, wholeDailyWindows).reduce(function (sum, windowResult) { return sum + windowResult.majorRingsCrossed; }, 0) : decision.continuePath.progression.majorRingsCrossed;
    document.querySelector("#decision-outlook-reason").textContent = "Over the next " + renderPlannerNumber(outlookHours, 2) + (outlookHours === 1 ? " hour" : " hours") + ", this run gets about " + outlookRolls.toLocaleString() + " more Bell " + (outlookRolls === 1 ? "roll" : "rolls") + " and " + outlookMajors.toLocaleString() + " major " + (outlookMajors === 1 ? "payout" : "payouts") + ".";
    var evaluation = decision.continuePath.evaluation,resetEvaluation=decision.resetPath.evaluation,format=BellOptimizer.idleonNumberFormat.format;
    document.querySelector("#remaining-opportunities-title").textContent = "What this result means";
    var copy = document.querySelector("#remaining-opportunities-copy"); copy.replaceChildren();
    var explanationSentences=["Your current run has a "+formatPercentValue(evaluation.probabilityOfTarget)+" chance to reach "+format(target)+" within "+renderPlannerNumber(outlookHours,2)+(outlookHours===1?" hour.":" hours.")];
    if(evaluation.probabilityOfTarget>=resetEvaluation.probabilityOfTarget)explanationSentences.push("Continuing is "+(evaluation.probabilityOfTarget===resetEvaluation.probabilityOfTarget?"no worse than":"still better than")+" resetting"+(evaluation.probabilityOfTarget<.5&&resetEvaluation.probabilityOfTarget<.5?", but neither path is likely to reach the goal.":" for this goal."));else explanationSentences.push("A fresh reset has the higher calculated goal chance, although neither outcome is guaranteed.");
    explanationSentences.push("You should gain about "+analysis.windows[0].ringsCompleted.toLocaleString()+" rolls in the first 24 hours. After that, progress slows to "+analysis.laterDailyPace+" as ring requirements rise.");
    explanationSentences.forEach(function(text){var paragraph=document.createElement("p");paragraph.textContent=text;copy.appendChild(paragraph);});
    document.querySelector("#remaining-opportunities-note").textContent = "This is a probability-based outlook, not a guaranteed result.";
    document.querySelector("#remaining-opportunities-card").hidden = false;

    var labels = ["Next 24 hours", "Hours 24–48", "Hours 48–72"];
    var tableBody = document.querySelector("#remaining-opportunities-table-body"); tableBody.replaceChildren();
    var rawBody = document.querySelector("#opportunities-raw-window-values"); rawBody.replaceChildren();
    analysis.windows.forEach(function (windowResult, index) {
      var row = document.createElement("div"); row.className = "opportunities-row";
      [labels[index], windowResult.startingHumanRing.toLocaleString(), windowResult.endingHumanRing.toLocaleString(), windowResult.ringsCompleted.toLocaleString(), windowResult.majorRingsCrossed.toLocaleString(), "+" + BellOptimizer.idleonNumberFormat.format(windowResult.expectedRewardGain)].forEach(function (value) { var cell = document.createElement("span"); cell.textContent = value; row.appendChild(cell); });
      tableBody.appendChild(row);
      var rawLine = document.createElement("code");
      rawLine.textContent = labels[index] + ": ending raw ring " + windowResult.endingRawRing + ", ending Ringing EXP " + windowResult.endingRingingExp + ", next requirement " + windowResult.endingRequirementExp;
      rawBody.appendChild(rawLine);
    });
    document.querySelector("#opportunities-raw-details").hidden = false;
  }

  function calculateGainPace(duration) {
    if (!importedEvaluatorState || !importedRingingProgress || !Number.isFinite(calculatedRingingRate) || !Number.isInteger(selectedGoal.rewardIndex)) return;
    var mechanics = evaluatorMechanics(selectedGoal.rewardIndex);
    var common = Object.assign({ ringingExpPerHour: calculatedRingingRate, durationHours: duration }, mechanics);
    var comparison = BellOptimizer.gainPace.compareCurrentToFresh({ current: Object.assign({}, common, { startingRawRingIndex: importedRingingProgress.rawRingIndex, startingRingingExp: importedRingingProgress.currentRingingExp, startingSelectedRewardLevel: importedEvaluatorState.rewardLevels[selectedGoal.rewardIndex] }), fresh: common });
    var rolling = BellOptimizer.gainPace.analyzeFreshRollingWindows(Object.assign({}, common, { windowCount: 10 }));
    var within = BellOptimizer.gainPace.analyzeFirstCheckpointSubwindows(Object.assign({}, common, { subwindowMinutes: 15 }));
    if (!comparison.ok || !rolling.ok || !within.ok) return;
    var format = BellOptimizer.idleonNumberFormat.format, current = comparison.currentWindow;
    var relativePercent = comparison.currentEfficiencyPercent;
    document.querySelector("#lantern-strategy-note").textContent = relativePercent !== null && relativePercent >= 25 ? "Lantern strategy: a second Lantern may still be worthwhile on this unusually early run." : "Lantern strategy: use one Lantern immediately after resetting. A second Lantern on the same run usually gives very little value because later rings become much slower.";
    var secondWindow = rolling.windows[1];
    var firstSubwindow = within.subwindows[0], firstSharePercent = firstSubwindow.cumulativeGainShare === null ? null : firstSubwindow.cumulativeGainShare * 100;
    document.querySelector("#advanced-gain-current-hourly").textContent = format(current.expectedGainPerHour) + "/hour";
    document.querySelector("#advanced-gain-current-rings").textContent = current.ringsCompleted.toLocaleString();
    document.querySelector("#advanced-gain-current-majors").textContent = current.majorRingsCrossed.toLocaleString();
    document.querySelector("#advanced-first-lantern-share").textContent = firstSharePercent === null ? "Unavailable" : firstSharePercent.toFixed(1).replace(/\.0$/, "") + "%";
    document.querySelector("#advanced-first-lantern-message").textContent = firstSharePercent === null ? "Cumulative value is unavailable." : "About " + firstSharePercent.toFixed(1).replace(/\.0$/, "") + "% of the first Lantern's expected value is earned during its first 15 minutes. A second Lantern is " + (secondWindow ? secondWindow.relativeValueClassification.toLowerCase() : "not available for comparison") + ".";
    var body = document.querySelector("#pace-window-body"); body.replaceChildren();
    rolling.windows.forEach(function (windowResult) { var row = document.createElement("div"); row.className = "pace-window-row"; var values = [renderPlannerNumber(windowResult.startHour, 2) + "–" + renderPlannerNumber(windowResult.endHour, 2) + "h", windowResult.startingHumanRing.toLocaleString() + "–" + windowResult.endingHumanRing.toLocaleString(), windowResult.majorRingsCrossed.toLocaleString(), "+" + format(windowResult.expectedRewardGain), format(windowResult.expectedGainPerHour), windowResult.efficiencyPercent === null ? "Unavailable" : windowResult.efficiencyPercent.toFixed(2).replace(/0+$/, "").replace(/\.$/, "") + "% — " + windowResult.relativeValueClassification]; values.forEach(function (value) { var cell = document.createElement("span"); cell.textContent = value; row.appendChild(cell); }); body.appendChild(row); });
    var subBody = document.querySelector("#pace-subwindow-body"); subBody.replaceChildren();
    within.subwindows.forEach(function (windowResult) { var row = document.createElement("div"); row.className = "pace-subwindow-row"; var values = [Math.round(windowResult.startHour * 60) + "–" + Math.round(windowResult.endHour * 60) + "m", windowResult.startingHumanRing.toLocaleString() + "–" + windowResult.endingHumanRing.toLocaleString(), windowResult.majorRingsCrossed.toLocaleString(), "+" + format(windowResult.expectedRewardGain), format(windowResult.expectedGainPerHour), format(windowResult.smoothedGainPerHour) + "/hr (" + windowResult.withinLanternEfficiencyPercent.toFixed(1).replace(/\.0$/, "") + "%)", windowResult.cumulativeGainShare === null ? "Unavailable" : (windowResult.cumulativeGainShare * 100).toFixed(1).replace(/\.0$/, "") + "%"]; values.forEach(function (value) { var cell = document.createElement("span"); cell.textContent = value; row.appendChild(cell); }); subBody.appendChild(row); });
    var milestoneContainer = document.querySelector("#within-lantern-milestones"); milestoneContainer.replaceChildren();
    within.milestoneGroups.forEach(function (group) { var item = document.createElement("div"); item.textContent = group.thresholds.join("%, ") + "% thresholds: around " + Math.round(group.window.endHour * 60) + " minutes, ring " + group.window.endingHumanRing.toLocaleString() + ", smoothed pace " + format(group.window.smoothedGainPerHour) + "/hr."; milestoneContainer.appendChild(item); });
  }

  document.querySelector("#calculate-fresh-run-plan").addEventListener("click", calculateFreshRunPlan);
  document.querySelector("#run-outlook-select").addEventListener("change", function () { document.querySelector("#custom-outlook-field").hidden = this.value !== "custom"; });

  function refreshMechanicsPreview() {
    var range = BellOptimizer.bellMechanics.calculatePossibleFinalGainRanges({
      majorBonus: document.querySelector('[name="majorBonus"]').value,
      minimumNormalGain: document.querySelector('[name="minimumNormalGain"]').value,
      maximumNormalGain: document.querySelector('[name="maximumNormalGain"]').value,
      doubleEnabled: document.querySelector('[name="doubleEnabled"]').checked,
      doubleChance: document.querySelector('[name="doubleLevelChance"]').value
    });
    document.querySelector("#normal-major-range").textContent = range.ok ? range.normalMajorRange.minimum + "-" + range.normalMajorRange.maximum : "Invalid manual inputs";
    document.querySelector("#doubled-major-range").textContent = range.ok ? range.doubledMajorRange.minimum + "-" + range.doubledMajorRange.maximum : "Invalid manual inputs";
    document.querySelector("#expert-major-range").textContent = range.ok ? range.normalMajorRange.minimum + "–" + range.normalMajorRange.maximum : "Unavailable";
    document.querySelector("#expert-doubled-major-range").textContent = range.ok ? range.doubledMajorRange.minimum + "–" + range.doubledMajorRange.maximum : "Unavailable";
    var currentRingRaw = document.querySelector('[name="currentRing"]').value.trim();
    var currentRing = Number(currentRingRaw);
    document.querySelector("#next-ring-is-major").textContent = currentRingRaw !== "" && Number.isFinite(currentRing) && currentRing >= 0 ? (BellOptimizer.bellMechanics.isMajorRing(currentRing + 1) ? "Yes - ring " + (currentRing + 1) : "No - ring " + (currentRing + 1)) : "Unknown";
  }

  function formatProbability(probability) {
    var percent = probability.probabilityValue * 100;
    return percent.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1") + "%";
  }

  function formatExpected(value) {
    return value.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
  }

  function renderDistribution(targetSelector, distribution) {
    var target = document.querySelector(targetSelector);
    target.replaceChildren();
    distribution.forEach(function (entry) {
      if (entry.probability.numerator === 0) return;
      var item = document.createElement("span");
      item.textContent = entry.gain + ": " + formatProbability(entry);
      target.appendChild(item);
    });
  }

  function refreshProbabilityPreview() {
    if (!importedProbabilityOwnership) return;
    var mechanics = BellOptimizer.bellMechanics;
    var upgrade42Owned = importedProbabilityOwnership.upgrade42Owned;
    var upgrade60Owned = importedProbabilityOwnership.upgrade60Owned;
    var doubleEnabled = document.querySelector('[name="doubleEnabled"]').checked;
    var doubleChance = Number(document.querySelector('[name="doubleLevelChance"]').value);
    var majorBonus = Number(document.querySelector('[name="majorBonus"]').value);
    if (!Number.isFinite(doubleChance) || doubleChance < 0 || doubleChance > 100 || !Number.isFinite(majorBonus) || majorBonus < 0) return;
    var normalBefore = mechanics.getNormalGainProbabilityDistribution(upgrade42Owned, upgrade60Owned);
    var normalAfter = mechanics.applyWholeRingDoubleToDistribution(normalBefore, doubleEnabled, doubleChance);
    var expectedBefore = mechanics.getExpectedNormalGain(upgrade42Owned, upgrade60Owned);
    var expectedAfter = mechanics.getExpectedGainAfterWholeRingDouble(upgrade42Owned, upgrade60Owned, doubleEnabled, doubleChance);
    var major = mechanics.getMajorRingOutcomeDistribution(upgrade42Owned, upgrade60Owned, majorBonus, doubleEnabled, doubleChance);
    var expectedMajor = mechanics.getExpectedMajorRingGain(upgrade42Owned, upgrade60Owned, majorBonus, doubleEnabled, doubleChance);
    [1, 2, 3].forEach(function (gain) {
      var entry = normalBefore.find(function (candidate) { return candidate.gain === gain; });
      document.querySelector("#probability-gain-" + gain).textContent = entry ? formatProbability(entry) : "0%";
      document.querySelector("#expert-probability-gain-" + gain).textContent = entry ? formatProbability(entry) : "0%";
    });
    document.querySelector("#expected-normal-before").textContent = formatExpected(expectedBefore.value);
    document.querySelector("#expected-normal-after").textContent = formatExpected(expectedAfter.value);
    document.querySelector("#expected-major-after").textContent = expectedMajor.ok ? formatExpected(expectedMajor.afterDouble.value) : "Invalid inputs";
    document.querySelector("#expert-expected-normal").textContent = formatExpected(expectedBefore.value);
    document.querySelector("#expert-expected-normal-double").textContent = formatExpected(expectedAfter.value);
    document.querySelector("#expert-expected-major").textContent = expectedMajor.ok ? formatExpected(expectedMajor.afterDouble.value) : "Unavailable";
    renderDistribution("#normal-distribution-before", normalBefore);
    renderDistribution("#normal-distribution-after", normalAfter);
    if (major.ok) { renderDistribution("#major-distribution-before", major.beforeDouble); renderDistribution("#major-distribution-after", major.afterDouble); }
    renderDistribution("#expert-normal-distribution-before", normalBefore);
    renderDistribution("#expert-normal-distribution-after", normalAfter);
    if (major.ok) { renderDistribution("#expert-major-distribution-before", major.beforeDouble); renderDistribution("#expert-major-distribution-after", major.afterDouble); }
    document.querySelector("#probability-details").hidden = false;
  }

  function refreshRewardSelectionPreview() {
    var raw = document.querySelector('[name="cavernsOwned"]').value.trim();
    var cavernCount = raw === "" ? NaN : Number(raw);
    var result = BellOptimizer.bellMechanics.getRewardSelectionProbabilities(cavernCount);
    var summary = document.querySelector("#available-reward-summary");
    var list = document.querySelector("#reward-selection-list");
    list.replaceChildren();
    if (!result.ok) { summary.textContent = result.error; return; }
    summary.textContent = result.availableCount + " rewards, indexes 0-" + result.highestAvailableIndex;
    result.rewards.forEach(function (reward) {
      var row = document.createElement("div");
      row.className = "reward-probability-row" + (reward.available ? "" : " locked");
      var name = document.createElement("span");
      name.textContent = reward.name;
      var probability = document.createElement("strong");
      probability.textContent = reward.available ? reward.probability.numerator + "/" + reward.probability.denominator + " = " + formatProbability(reward) : "Locked";
      row.appendChild(name); row.appendChild(probability); list.appendChild(row);
    });
    document.querySelector("#expert-available-reward-summary").textContent = summary.textContent;
    var expertList=document.querySelector("#expert-reward-selection-list");expertList.replaceChildren();Array.from(list.children).forEach(function(row){expertList.appendChild(row.cloneNode(true));});
  }

  function formatPercentValue(value) {
    return (value * 100).toFixed(4).replace(/0+$/, "").replace(/\.$/, "") + "%";
  }

  function friendlyResultType(mode) {
    return mode === "Exact analytical" ? "Exact" : "Estimated";
  }

  function friendlyQuality(percentile, fallbackLabel) {
    if (percentile !== null) {
      if (percentile < 0.10) return "Very Bad";
      if (percentile < 0.35) return "Below Average";
      if (percentile < 0.65) return "Average";
      if (percentile < 0.90) return "Good";
      return "Great";
    }
    if (fallbackLabel === "Far below expectation") return "Very Bad";
    if (fallbackLabel === "Below expectation") return "Below Average";
    if (fallbackLabel === "Above expectation") return "Good";
    if (fallbackLabel === "Far above expectation") return "Great";
    return "Average";
  }

  function friendlyAction(percentile) {
    if (percentile === null || (percentile >= 0.35 && percentile < 0.65)) return "This run is near expectation.";
    return percentile >= 0.65 ? "This run is ahead of expectation." : "This run is behind expectation.";
  }

  function formatWholeLevel(value) {
    return BellOptimizer.idleonNumberFormat.format(Math.round(value));
  }

  function selectGoal(button) {
    var rewardIndex = Number(button.dataset.rewardIndex);
    if (!Number.isInteger(rewardIndex)) return;
    var rewardChanged = selectedGoal.rewardIndex !== rewardIndex;
    document.querySelectorAll(".goal-preset[data-reward-index]").forEach(function (candidate) {
      var selected = candidate === button;
      candidate.classList.toggle("selected", selected);
      candidate.setAttribute("aria-pressed", String(selected));
    });
    selectedGoal = { name: button.dataset.goal, rewardIndex: rewardIndex, rewardName: BellOptimizer.BELL_REWARDS[rewardIndex].name };
    document.querySelector("#target-reward").value = String(rewardIndex);
    document.querySelector("#selected-goal-description").textContent = selectedGoal.rewardName + " target";
    document.querySelector("#summary-current-goal").textContent = selectedGoal.name;
    document.querySelector("#fresh-run-target-label").textContent = "Fresh-run " + selectedGoal.rewardName + " target level";
    if (rewardChanged) invalidateSelectedRewardEvaluation("Reward changed to " + selectedGoal.rewardName + ". Click Check My Run to calculate it.");
    refreshCurrentRunDistribution();
    if(importedEvaluatorState)renderRunForecast();
    renewalDecisionController.invalidate();
    var advancedResult=document.querySelector("#advanced-renewal-result");if(advancedResult)advancedResult.hidden=true;
  }

  function refreshCurrentRunDistribution() {
    var section = document.querySelector("#current-run-distribution");
    if (!importedEvaluatorState) { section.hidden = true; return; }
    var analysis = BellOptimizer.currentRunDistribution.analyze(importedEvaluatorState.rewardLevels, importedEvaluatorState.cavernsOwned, selectedGoal.rewardIndex);
    if (!analysis.ok) { section.hidden = true; return; }
    function percent(value, digits) { return (value * 100).toFixed(digits).replace(/\.0+$/, "").replace(/(\.\d*[1-9])0+$/, "$1") + "%"; }
    var body = document.querySelector("#current-distribution-table-body"); body.replaceChildren();
    analysis.rewards.forEach(function (reward) {
      var row = document.createElement("div"); row.className = "current-distribution-row";
      [reward.name, reward.currentLevel.toLocaleString(), percent(reward.shareOfCurrentLevels, 1)].forEach(function (value) { var cell = document.createElement("span"); cell.textContent = value; row.appendChild(cell); });
      body.appendChild(row);
    });
    document.querySelector("#distribution-future-chance").textContent = "Future chance per reward: " + analysis.futureSelectionFraction.numerator + "/" + analysis.futureSelectionFraction.denominator + " = " + percent(analysis.futureSelectionProbabilityValue, 2);
    document.querySelector("#advanced-distribution-total").textContent = String(analysis.totalCurrentBellLevels);
    var advancedBody = document.querySelector("#advanced-distribution-table-body"); advancedBody.replaceChildren();
    analysis.rewards.forEach(function (reward) {
      var row = document.createElement("div"); row.className = "advanced-distribution-row";
      var fraction = reward.futureSelectionProbability.numerator + "/" + reward.futureSelectionProbability.denominator;
      var values=[reward.index + " — " + reward.name,String(reward.currentLevel),percent(reward.shareOfCurrentLevels,2),percent(reward.futureSelectionProbabilityValue,2)+" ("+fraction+")"];
      values.forEach(function (value,index) { var cell = document.createElement("span"); cell.textContent = value;if(index===2)cell.title="Exact share: "+String(reward.shareOfCurrentLevels);if(index===3)cell.title="Exact probability: "+String(reward.futureSelectionProbabilityValue);row.appendChild(cell); });
      advancedBody.appendChild(row);
    });
    section.hidden = false;
  }

  function showCustomWeights(button) {
    document.querySelectorAll(".goal-preset").forEach(function (candidate) { candidate.classList.toggle("selected", candidate === button); candidate.setAttribute("aria-pressed", String(candidate === button)); });
    selectedGoal = { name: "Custom", rewardIndex: null, rewardName: "Custom weights" };
    document.querySelector("#summary-current-goal").textContent = "Custom";
    document.querySelector("#selected-goal-description").textContent = "Custom multi-reward evaluation is not implemented yet.";
    document.querySelector("#optimization-goal").value = "custom";
    document.querySelector("#custom-weights").hidden = false;
    document.querySelector("#advanced-details").open = true;
    refreshCurrentRunDistribution();
  }

  function evaluatorMechanics(rewardIndex) {
    var state = importedEvaluatorState;
    var mechanics = BellOptimizer.bellMechanics;
    var rewardProbabilities = mechanics.getRewardSelectionProbabilities(state.cavernsOwned);
    var normalBeforeDouble = mechanics.getNormalGainProbabilityDistribution(state.upgrade42Owned, state.upgrade60Owned);
    var ordinaryDistribution = mechanics.applyWholeRingDoubleToDistribution(normalBeforeDouble, state.doubleEnabled, state.doubleChance);
    var majorDistributions = mechanics.getMajorRingOutcomeDistribution(state.upgrade42Owned, state.upgrade60Owned, state.majorBonus, state.doubleEnabled, state.doubleChance);
    return {
      selectionProbability: rewardProbabilities.rewards[rewardIndex].probabilityValue,
      ordinaryGainDistribution: ordinaryDistribution,
      majorGainDistribution: majorDistributions.afterDouble,
      expectedOrdinaryRingGain: mechanics.getExpectedGainAfterWholeRingDouble(state.upgrade42Owned, state.upgrade60Owned, state.doubleEnabled, state.doubleChance).value,
      expectedMajorRingGain: mechanics.getExpectedMajorRingGain(state.upgrade42Owned, state.upgrade60Owned, state.majorBonus, state.doubleEnabled, state.doubleChance).afterDouble.value
    };
  }

  function automaticPrototypeSnapshot() {
    if (!importedEvaluatorState || !importedRingingProgress || !importedRenewalState || !Number.isFinite(calculatedRingingRate)) return null;
    return {
      rewardLevels: importedEvaluatorState.rewardLevels.slice(),
      currentRawRingIndex: importedRingingProgress.rawRingIndex,
      currentRingingExp: importedRingingProgress.currentRingingExp,
      ringingExpPerHour: calculatedRingingRate,
      currentRenewalCurrency: importedRenewalState.currentCurrency,
      renewalCurrencyPerHour: importedRenewalState.currencyPerHour,
      renewalCost: importedRenewalState.renewalCost,
      cavernsOwned: importedEvaluatorState.cavernsOwned,
      bellUpgrade42Owned: importedEvaluatorState.upgrade42Owned,
      bellUpgrade60Owned: importedEvaluatorState.upgrade60Owned,
      bellUpgrade86Owned: importedEvaluatorState.doubleEnabled,
      majorBellBonus: importedEvaluatorState.majorBonus,
      mechanicsForReward: function (rewardIndex) { return evaluatorMechanics(rewardIndex); }
    };
  }

  function syncRunRewardControls() {
    if (!importedEvaluatorState) return;
    var probabilities=BellOptimizer.bellMechanics.getRewardSelectionProbabilities(importedEvaluatorState.cavernsOwned),firstAvailable=null,selectedAvailable=false;
    document.querySelectorAll(".goal-preset[data-reward-index]").forEach(function(button){var index=Number(button.dataset.rewardIndex),reward=probabilities.rewards[index],available=Boolean(reward&&reward.available),level=button.querySelector(".run-reward-level");if(available&&firstAvailable===null)firstAvailable=button;if(index===selectedGoal.rewardIndex)selectedAvailable=available;button.disabled=!available;button.classList.toggle("locked",!available);button.title=available?"Current level "+importedEvaluatorState.rewardLevels[index].toLocaleString():"Locked until more Caverns are owned";if(level)level.textContent=available?BellOptimizer.idleonNumberFormat.format(importedEvaluatorState.rewardLevels[index]):"Locked";});
    if(!selectedAvailable&&firstAvailable)selectGoal(firstAvailable);
  }

  function renderRunForecast() {
    var empty=document.querySelector("#run-forecast-empty"),resultHost=document.querySelector("#run-forecast-result"),hero=document.querySelector("#run-forecast-hero"),snapshot=automaticPrototypeSnapshot();
    if(!snapshot||!Number.isInteger(selectedGoal.rewardIndex)){latestRunHistoryContext=null;BellOptimizer.bellHistorySection.setRunContext(null);empty.hidden=false;resultHost.hidden=true;empty.querySelector("strong").textContent="Import a save with a complete Bell Ring rate to forecast this run.";return null;}
    var state=importedEvaluatorState,options={selectedRewardIndex:selectedGoal.rewardIndex,rewardLevels:snapshot.rewardLevels,currentRawRingIndex:snapshot.currentRawRingIndex,currentRingingExp:snapshot.currentRingingExp,ringingExpPerHour:snapshot.ringingExpPerHour,currentRenewalCurrency:snapshot.currentRenewalCurrency,cavernsOwned:state.cavernsOwned,majorBellBonus:state.majorBonus,bellUpgrade42Owned:state.upgrade42Owned,bellUpgrade60Owned:state.upgrade60Owned,bellUpgrade86Owned:state.doubleEnabled},forecast=BellOptimizer.bellRunForecast.evaluateBellRunForecast(options),replacement=BellOptimizer.bellRunReplacement.evaluate(options),model=BellOptimizer.bellRunViewModel.build({forecast:forecast,replacement:replacement,reward:BellOptimizer.BELL_REWARDS[selectedGoal.rewardIndex],formatter:BellOptimizer.idleonNumberFormat.format});
    if(!model.ok){latestRunHistoryContext=null;BellOptimizer.bellHistorySection.setRunContext(null);empty.hidden=false;resultHost.hidden=true;empty.querySelector("strong").textContent=model.message;return model;}
    latestRunHistoryContext=BellOptimizer.bellHistorySnapshot.runContextFromViewModel(model);BellOptimizer.bellHistorySection.setRunContext(latestRunHistoryContext);
    function text(id,value){document.querySelector("#"+id).textContent=value;}
    renderReplacementDecision(model);
    empty.hidden=true;resultHost.hidden=false;hero.dataset.tier=model.tierKey.toLowerCase().replace(/_/g,"-");text("run-forecast-reward",model.rewardName);text("run-forecast-tier",model.tierLabel);text("run-forecast-current",model.currentDisplay);text("run-forecast-finish",model.finishDisplay);text("run-forecast-range",model.rangeDisplay);text("run-forecast-direction",model.direction);text("run-forecast-interpretation",model.interpretation);text("run-forecast-concentration",model.concentrationDisplay);text("run-forecast-expected-share",model.expectedShareDisplay);text("run-forecast-next-major",model.nextMajorDisplay);text("run-forecast-rings-to-major",model.ringsToMajorDisplay);text("run-forecast-taper-ring",model.taperRingDisplay);text("run-forecast-taper-time",model.taperTimeDisplay);text("run-forecast-opportunities",model.opportunityDisplay);text("run-forecast-majors",model.majorDisplay);text("run-forecast-mode",model.playerCalculationMode);text("run-forecast-superiority",model.superiorityDisplay);text("run-forecast-additional",model.additionalDisplay);text("run-forecast-wide-range",model.wideRangeDisplay);text("run-forecast-assumption",model.assumption);
    if(replacement&&replacement.ok){var format=BellOptimizer.idleonNumberFormat.format,pct=function(value){return (value*100).toFixed(2).replace(/\.00$/,"").replace(/(\.\d)0$/,"$1")+"%";};text("expert-run-selected-reward",replacement.selectedRewardName);text("expert-run-decision",replacement.decision);text("expert-run-current-level",format(replacement.currentRun.startingRewardLevel));text("expert-run-current-taper","Ring "+(replacement.currentRun.taperRawRingIndex+1).toLocaleString());text("expert-run-fresh-taper","Ring "+(replacement.freshReplacement.taperRawRingIndex+1).toLocaleString());text("expert-run-current-expected",format(replacement.currentRun.expectedEndingLevel));text("expert-run-fresh-expected",format(replacement.freshReplacement.expectedEndingLevel));text("expert-run-current-likely",format(replacement.currentRun.likelyRange.p25)+"–"+format(replacement.currentRun.likelyRange.p75));text("expert-run-fresh-likely",format(replacement.freshReplacement.likelyRange.p25)+"–"+format(replacement.freshReplacement.likelyRange.p75));text("expert-run-current-wide",format(replacement.currentRun.broaderRange.p10)+"–"+format(replacement.currentRun.broaderRange.p90));text("expert-run-fresh-wide",format(replacement.freshReplacement.broaderRange.p10)+"–"+format(replacement.freshReplacement.broaderRange.p90));text("expert-run-current-win",pct(replacement.comparison.probabilityCurrentBeatsFresh));text("expert-run-ties",pct(replacement.comparison.probabilityTie));text("expert-run-affordable",replacement.renewal.affordableNow?"Yes":"No");text("expert-run-rolls",replacement.currentRun.remainingBellRolls.toLocaleString());text("expert-run-majors",replacement.currentRun.remainingMajorPayouts.toLocaleString());text("expert-run-mode",replacement.comparison.calculationMode+(replacement.comparison.approximate?" · approximate":""));}
    if(replacement&&replacement.ok){var replacementFormat=BellOptimizer.idleonNumberFormat.format,advantage=replacement.comparison.expectedAdvantageCurrentMinusFresh;document.querySelector("#expert-run-expected-advantage").textContent=(advantage>=0?"Current +":"Fresh +")+replacementFormat(Math.abs(advantage));document.querySelector("#expert-run-relative-advantage").textContent=pct(replacement.comparison.relativeExpectedAdvantage);document.querySelector("#expert-run-regret-keep").textContent=replacementFormat(replacement.comparison.expectedRegretIfKeep);document.querySelector("#expert-run-regret-renew").textContent=replacementFormat(replacement.comparison.expectedRegretIfRenew);document.querySelector("#expert-run-rationale").textContent=replacement.comparison.classificationRationale;}
    if(replacement&&replacement.ok&&replacement.comparison.eliteUpside){var elite=replacement.comparison.eliteUpside,eliteFormat=BellOptimizer.idleonNumberFormat.format;document.querySelector("#expert-elite-p80").textContent=eliteFormat(elite.freshP80Level);document.querySelector("#expert-elite-p90").textContent=eliteFormat(elite.freshP90Level);document.querySelector("#expert-elite-p80-probability").textContent=pct(elite.currentP80Probability)+" / "+pct(elite.freshP80Probability);document.querySelector("#expert-elite-p90-probability").textContent=pct(elite.currentP90Probability)+" / "+pct(elite.freshP90Probability);document.querySelector("#expert-elite-p80-excess").textContent=eliteFormat(elite.currentExpectedExcessP80)+" / "+eliteFormat(elite.freshExpectedExcessP80);document.querySelector("#expert-elite-utility").textContent=elite.currentQuarticUtility.toFixed(3)+" / "+elite.freshQuarticUtility.toFixed(3);document.querySelector("#expert-elite-ev-relative").textContent=pct(replacement.comparison.relativeExpectedAdvantage);document.querySelector("#expert-elite-preservation").textContent=replacement.elitePreservation.replace(/_/g," ");document.querySelector("#expert-elite-ev-safety").textContent=replacement.evSafetyStatus.replace(/_/g," ");document.querySelector("#expert-elite-consensus").textContent=replacement.upsideDirection+" · "+replacement.upsideConsensus;}
    return model;
  }

  function evaluateSelectedTarget() {
    var status = document.querySelector("#target-evaluator-status");
    var results = document.querySelector("#target-results");
    if (!importedEvaluatorState) { status.className = "import-status error"; status.textContent = "Import a valid save before evaluating a target."; results.hidden = true; return; }
    var rewardIndex = Number(document.querySelector("#target-reward").value);
    var targetLevelRaw = document.querySelector("#target-reward-level").value.trim();
    var targetRingRaw = document.querySelector("#target-ring").value.trim();
    var targetLevel = Number(targetLevelRaw);
    var targetRing = Number(targetRingRaw);
    if (targetLevelRaw === "" || targetRingRaw === "" || !Number.isFinite(targetLevel) || targetLevel < 0 || !Number.isInteger(targetRing) || targetRing < 0) { status.className = "import-status error"; status.textContent = "Enter a nonnegative target level and a whole-number target ring."; results.hidden = true; return; }
    var mechanics = evaluatorMechanics(rewardIndex);
    var options = Object.assign({ currentLevel: importedEvaluatorState.rewardLevels[rewardIndex], currentRing: importedEvaluatorState.currentRing, targetLevel: targetLevel, targetRing: targetRing }, mechanics);
    var evaluation = BellOptimizer.targetEvaluator.evaluateTarget(options);
    if (!evaluation.ok) { status.className = "import-status error"; status.textContent = evaluation.error; results.hidden = true; return; }
    results.hidden = false;
    document.querySelector("#result-calculation-method").textContent = evaluation.mode;
    document.querySelector("#result-future-rings").textContent = evaluation.futureRings;
    document.querySelector("#result-major-rings").textContent = evaluation.majorRingCount;
    document.querySelector("#result-expected-level").textContent = formatExpected(evaluation.expectedFinalLevel);
    document.querySelector("#result-target-probability").textContent = formatPercentValue(evaluation.probabilityOfTarget);
    document.querySelector("#result-percentiles").textContent = "P10 " + evaluation.percentiles.p10 + " | P25 " + evaluation.percentiles.p25 + " | Median " + evaluation.percentiles.median + " | P75 " + evaluation.percentiles.p75 + " | P90 " + evaluation.percentiles.p90;
    status.className = "import-status success";
    status.textContent = evaluation.mode + " target evaluation completed for " + BellOptimizer.BELL_REWARDS[rewardIndex].name + " only.";
    var currentComparison = BellOptimizer.targetEvaluator.evaluateCurrentRun(Object.assign({ currentLevel: importedEvaluatorState.rewardLevels[rewardIndex], currentRing: importedEvaluatorState.currentRing }, mechanics));
    document.querySelector("#current-selected-level").textContent = currentComparison.currentLevel;
    document.querySelector("#expected-current-level").textContent = formatExpected(currentComparison.expectedLevel);
    document.querySelector("#current-level-difference").textContent = (currentComparison.difference >= 0 ? "+" : "") + formatExpected(currentComparison.difference);
    document.querySelector("#current-comparison-method").textContent = currentComparison.mode;
    document.querySelector("#current-level-percentile").textContent = currentComparison.percentile === null ? "Not calculable" : formatPercentValue(currentComparison.percentile);
    document.querySelector("#current-comparison-label").textContent = currentComparison.label;
    document.querySelector("#main-result-quality").textContent = friendlyQuality(currentComparison.percentile, currentComparison.label).toUpperCase();
    document.querySelector("#main-result-action").textContent = friendlyAction(currentComparison.percentile);
    document.querySelector("#main-result-type").textContent = friendlyResultType(evaluation.mode);
    document.querySelector("#main-result-chance").textContent = formatPercentValue(evaluation.probabilityOfTarget);
    document.querySelector("#main-result-expected").textContent = formatWholeLevel(evaluation.expectedFinalLevel);
    document.querySelector("#main-result-range").textContent = BellOptimizer.idleonNumberFormat.format(evaluation.percentiles.p25) + "–" + BellOptimizer.idleonNumberFormat.format(evaluation.percentiles.p90);
    var absoluteDifference = Math.abs(currentComparison.difference);
    document.querySelector("#main-result-difference").textContent = "You are " + formatWholeLevel(absoluteDifference) + " levels " + (currentComparison.difference >= 0 ? "above" : "below") + " average.";
  }

  function checkMyRun() {
    if (!Number.isInteger(selectedGoal.rewardIndex)) { var unavailableStatus = document.querySelector("#simple-evaluator-status"); unavailableStatus.className = "import-status error"; unavailableStatus.textContent = "Custom multi-reward evaluation is not implemented yet. Choose Fountain or Villager EXP."; return; }
    document.querySelector("#target-reward").value = String(selectedGoal.rewardIndex);
    document.querySelector("#target-reward-level").value = document.querySelector("#simple-target-level").value;
    document.querySelector("#target-ring").value = document.querySelector("#simple-target-ring").value;
    if (document.querySelector("#simple-target-ring").value.trim()) evaluateSelectedTarget();
    calculateCurrentResetDecision();
  }

  function initializeBellRateOptimizerUI(result) {
    importedBellRateState = result.data.bellRateUpgradeState;
    var numberFormat = BellOptimizer.idleonNumberFormat;
    var characterSelect = document.querySelector("#bell-rate-character-select");
    var runButton = document.querySelector("#run-bell-rate-optimizer");
    var constraintHost = document.querySelector("#bell-rate-resource-constraints");
    if (!characterSelect || !runButton || !constraintHost) throw new Error("A Phase 5 optimizer control is missing.");
    characterSelect.replaceChildren();
    var promptOption=document.createElement("option"); promptOption.value=""; promptOption.textContent="Select the character that will spend coins"; characterSelect.appendChild(promptOption);
    result.data.bellRateCoinCharacters.forEach(function(character){var option=document.createElement("option");option.value=String(character.index);option.textContent=(character.index+1)+": "+character.name+" ("+numberFormat.format(character.coins)+" coins)";characterSelect.appendChild(option);});
    runButton.disabled=false;
    var generatedPools=result.data.bellRateUpgradeCandidates, uniquePools={};
    constraintHost.replaceChildren();
    var constraintTable=document.createElement("table");constraintTable.className="candidate-table";constraintTable.innerHTML="<thead><tr><th>Resource</th><th>Owned</th><th>Disable</th><th>Max spend</th><th>Min reserve</th><th>Max %</th><th>Max levels</th></tr></thead><tbody></tbody>";
    if(generatedPools.ok)generatedPools.candidates.forEach(function(c){if(!c.resourcePoolId||!c.deterministicPurchase||uniquePools[c.resourcePoolId])return;uniquePools[c.resourcePoolId]=true;var row=document.createElement("tr");row.dataset.poolId=c.resourcePoolId;row.dataset.owned=String(c.ownedResource);row.innerHTML="<td></td><td></td><td><input type=\"checkbox\" data-constraint=\"disabled\"></td><td><input type=\"number\" min=\"0\" data-constraint=\"maximumAmount\"></td><td><input type=\"number\" min=\"0\" data-constraint=\"minimumReserve\"></td><td><input type=\"number\" min=\"0\" max=\"100\" data-constraint=\"maximumPercent\"></td><td><input type=\"number\" min=\"0\" data-constraint=\"maximumLevels\"></td>";row.children[0].textContent=c.costResource.name;row.children[1].textContent=Number.isFinite(c.ownedResource)?numberFormat.format(c.ownedResource):"Unresolved";constraintTable.tBodies[0].appendChild(row);});
    constraintHost.appendChild(constraintTable);
  }

  function importCheckpoint(name, options) {
    if(activeImportFailureStage===name)throw new Error("Injected active-import failure after "+name);
    if (options && typeof options.checkpoint === "function") options.checkpoint(name);
  }

  function applyImportedResult(result, options) {
    options = options || {};
    normalBellRateUpgradeData=null;
    var upgradeViewReset=BellOptimizer.bellRateSection.defaultViewState();
    selectedBellStat=upgradeViewReset.selectedStat;
    document.querySelectorAll(".bell-stat-filter-button").forEach(function(button){var selected=button.dataset.bellStat===selectedBellStat;button.classList.toggle("selected",selected);button.setAttribute("aria-pressed",String(selected));});
    document.querySelector("#normal-multi-upgrade-plans").open=upgradeViewReset.plansExpanded;
    document.querySelector("#current-run-distribution").open=false;
    document.querySelector("#bell-rate-section").hidden=false;
    document.querySelector("#normal-bell-rate").textContent="—";
    document.querySelector("#normal-bell-rate-exact").textContent="";
    document.querySelector("#normal-upgrade-paths-status").textContent="Upgrade Paths will load after import.";
    ["#normal-practical-plan","#normal-maximum-plan","#normal-progression-opportunities","#normal-rng-opportunities","#normal-capped-sources","#normal-available-upgrades","#normal-next-upgrades"].forEach(function(selector){document.querySelector(selector).replaceChildren();});
    document.querySelector("#bell-rate-character-select").value="";
    document.querySelector("#bell-rate-optimizer-summary").replaceChildren();
    document.querySelector("#bell-rate-plan-comparison").replaceChildren();
    invalidateSelectedRewardEvaluation("A new save was imported. Click Check My Run to calculate the selected reward from its new level.");
    result.data.values.forEach(function (value, index) {
      document.querySelector('[name="reward' + (index + 1) + '"]').value = value;
    });
    document.querySelector('[name="currentRing"]').value = result.data.bellRingNumber;
    document.querySelector('[name="majorBonus"]').value = result.data.majorBellBonus;
    document.querySelector('[name="doubleEnabled"]').checked = result.data.wholeRingDoubleEnabled;
    document.querySelector('[name="doubleLevelChance"]').value = 25;
    document.querySelector('[name="minimumNormalGain"]').value = result.data.normalRingGainDetails.minimumNormalGain;
    document.querySelector('[name="maximumNormalGain"]').value = result.data.normalRingGainDetails.maximumNormalGain;
    document.querySelector('[name="cavernsOwned"]').value = result.data.cavernsOwned;
    importCheckpoint("after-fallback-fields", options);
    importCheckpoint("account-status", options);
    importStatus.className = "import-status success";
    importStatus.textContent = "Your Bell data was imported locally and is ready to check.";
    importCheckpoint("after-account-status", options);
    pasteArea.value = "";
    document.querySelector("#save-import-panel").classList.add("is-imported");
    document.querySelector("#compact-account-bar").hidden = false;
    document.querySelector("#summary-current-ring").textContent = result.data.bellRingNumber;
    document.querySelector("#summary-rewards-unlocked").textContent = BellOptimizer.bellMechanics.getAvailableRewards(result.data.cavernsOwned).rewards.length;
    document.querySelector("#provenance-ring-value").textContent = "Raw: " + result.data.rawRingIndex.toLocaleString() + " · Human: " + result.data.humanRing.toLocaleString();
    document.querySelector("#provenance-progress-value").textContent = "Raw EXP: " + String(result.data.currentRingingExp);
    document.querySelector("#provenance-major-value").textContent = "Study level: " + result.data.bolaiaBellStudyLevel.toLocaleString() + " · Bonus: " + result.data.majorBellBonus.toLocaleString();
    document.querySelector("#provenance-upgrade42-value").textContent = "Raw: " + result.data.bellUpgrade42RawValue + " · Owned: " + (result.data.bellUpgrade42Owned ? "Yes" : "No");
    document.querySelector("#provenance-upgrade60-value").textContent = "Raw: " + result.data.bellUpgrade60RawValue + " · Owned: " + (result.data.bellUpgrade60Owned ? "Yes" : "No");
    document.querySelector("#provenance-upgrade86-value").textContent = "Raw: " + result.data.bellUpgrade86RawValue + " · Owned: " + (result.data.bellUpgrade86Owned ? "Yes" : "No");
    document.querySelector("#provenance-cavern-value").textContent = "Villager level: " + result.data.villagerLevel0.toLocaleString() + " · Caverns: " + result.data.cavernsOwned.toLocaleString();
    document.querySelector("#import-summary").hidden = false;
    importedRingingProgress = { rawRingIndex: result.data.rawRingIndex, currentRingingExp: result.data.currentRingingExp, nextRingRequiredExp: result.data.nextRingRequiredExp };
    importedRenewalState = { currentCurrency: result.data.currentRenewalCurrency, currencyPerHour: result.data.renewalCurrencyPerHour, renewalCost: result.data.renewalCost };
    document.querySelector("#renewal-current-currency").textContent = result.data.currentRenewalCurrency.toLocaleString(undefined, { maximumFractionDigits: 6 });
    document.querySelector("#renewal-currency-rate").textContent = result.data.renewalCurrencyPerHour.toLocaleString() + "/hr";
    document.querySelector("#renewals-available-now").textContent = result.data.immediatelyAvailableRenewals.toLocaleString();
    document.querySelector("#lifetime-renewals").textContent = result.data.lifetimeBellRenewals.toLocaleString();
    document.querySelector("#renewal-cost").textContent = result.data.renewalCost.toLocaleString();
    var numberFormat = BellOptimizer.idleonNumberFormat;
    document.querySelector("#ringing-current-ring").textContent = result.data.humanRing.toLocaleString();
    document.querySelector("#ringing-progress-values").textContent = numberFormat.format(result.data.currentRingingExp) + " / " + numberFormat.format(result.data.nextRingRequiredExp);
    document.querySelector("#ringing-progress-percent").textContent = result.data.ringProgressPercent.toFixed(1).replace(/\.0$/, "") + "%";
    var visualProgress = Math.max(0, Math.min(100, result.data.ringProgressPercent));
    document.querySelector("#ring-progress-fill").style.width = visualProgress + "%";
    var progressTrack = document.querySelector(".ring-progress-track");
    progressTrack.setAttribute("aria-valuenow", String(visualProgress));
    progressTrack.setAttribute("aria-valuetext", result.data.ringProgressPercent.toFixed(2).replace(/0+$/, "").replace(/\.$/, "") + "% actual progress");
    document.querySelector("#raw-ringing-exp").textContent = String(result.data.currentRingingExp);
    document.querySelector("#raw-ringing-index").textContent = String(result.data.rawRingIndex);
    document.querySelector("#raw-ringing-requirement").textContent = String(result.data.nextRingRequiredExp);
    document.querySelector("#total-method-levels").textContent = result.data.totalBellMethodLevels.toLocaleString();
    document.querySelector("#upgrade-45-method-owned").textContent = result.data.upgrade45Owned ? "Yes" : "No";
    document.querySelector("#upgrade-45-method-multiplier").textContent = numberFormat.format(result.data.upgrade45Multiplier) + "×";
    document.querySelector("#ringing-method-multiplier").textContent = numberFormat.format(result.data.ringingMethodMultiplier) + "×";
    var methodList = document.querySelector("#method-quantity-list");
    methodList.replaceChildren();
    result.data.bellMethodLevels.forEach(function (level, index) {
      var row = document.createElement("div");
      row.className = "method-row";
      var label = document.createElement("span");
      label.textContent = "Method " + index + " — level " + level.toLocaleString();
      var quantity = document.createElement("strong");
      quantity.textContent = numberFormat.format(result.data.bellMethodQuantities[index]);
      row.appendChild(label); row.appendChild(quantity); methodList.appendChild(row);
    });
    document.querySelector("#raw-method-levels").textContent = JSON.stringify(result.data.bellMethodLevels);
    document.querySelector("#raw-upgrade-45").textContent = String(result.data.bellUpgrade45RawValue);
    document.querySelector("#raw-upgrade-45-multiplier").textContent = String(result.data.upgrade45Multiplier);
    document.querySelector("#raw-ringing-method-multiplier").textContent = String(result.data.ringingMethodMultiplier);
    document.querySelector("#ringing-jar-11").textContent = result.data.jar11Level.toLocaleString() + " / " + numberFormat.format(result.data.jar11Multiplier) + "×";
    document.querySelector("#ringing-jar-36").textContent = result.data.jar36Level.toLocaleString() + " / " + numberFormat.format(result.data.jar36Multiplier) + "×";
    document.querySelector("#ringing-jar-talent").textContent = result.data.jarLegendTalentLevel.toLocaleString() + " (shared +" + result.data.jarLegendBonusPercent.toLocaleString() + "%)";
    document.querySelector("#ringing-jar-combined").textContent = numberFormat.format(result.data.combinedRingingJarMultiplier) + "×";
    var rateBreakdown = result.data.ringingRateBreakdown;
    calculatedRingingRate = rateBreakdown.complete ? rateBreakdown.calculatedRate : null;
    document.querySelector("#fresh-run-planner").hidden = !Number.isFinite(calculatedRingingRate);
    document.querySelector("#advanced-auto-rate").textContent = Number.isFinite(calculatedRingingRate) ? numberFormat.format(calculatedRingingRate) + "/hr (automatic)" : "Automatic reconstruction unavailable";
    if (Number.isFinite(calculatedRingingRate)) {
      var remainingAutomatic = Math.max(0, importedRingingProgress.nextRingRequiredExp - importedRingingProgress.currentRingingExp);
      var automaticPreview = BellOptimizer.bellMechanics.advanceRingingProgress({ startingRawRingIndex:importedRingingProgress.rawRingIndex, startingRingingExp:importedRingingProgress.currentRingingExp, ringingExpPerHour:calculatedRingingRate, durationHours:2 });
      var automaticFresh = BellOptimizer.bellMechanics.advanceRingingProgress({ startingRawRingIndex:0, startingRingingExp:0, ringingExpPerHour:calculatedRingingRate, durationHours:2 });
      document.querySelector("#advanced-time-to-next-ring").textContent = formatDuration(remainingAutomatic / calculatedRingingRate);
      document.querySelector("#advanced-remaining-exp").textContent = numberFormat.format(remainingAutomatic);
      if (automaticPreview.ok) {
        document.querySelector("#advanced-lantern-ending-ring").textContent = automaticPreview.endingHumanRing.toLocaleString(); document.querySelector("#advanced-lantern-rings").textContent = automaticPreview.ringsCompleted.toLocaleString(); document.querySelector("#advanced-lantern-majors").textContent = automaticPreview.majorRingsCrossed.toLocaleString(); document.querySelector("#advanced-lantern-progress").textContent = automaticPreview.endingProgressPercent.toFixed(1).replace(/\.0$/, "") + "%"; document.querySelector("#advanced-lantern-ending-exp").textContent = String(automaticPreview.endingProgressExp); document.querySelector("#advanced-lantern-requirement").textContent = String(automaticPreview.endingRequirementExp);
      }
      if (automaticFresh.ok) { document.querySelector("#fresh-preview-ring").textContent = automaticFresh.endingHumanRing.toLocaleString(); document.querySelector("#fresh-preview-raw-ring").textContent = automaticFresh.endingRawRing.toLocaleString(); document.querySelector("#fresh-preview-rings").textContent = automaticFresh.ringsCompleted.toLocaleString(); document.querySelector("#fresh-preview-majors").textContent = automaticFresh.majorRingsCrossed.toLocaleString(); }
    }
    document.querySelector("#rate-monument-multiplier").textContent = Number.isFinite(rateBreakdown.monumentMultiplier) ? numberFormat.format(rateBreakdown.monumentMultiplier) + "×" : "Unresolved";
    document.querySelector("#rate-measurement-multiplier").textContent = Number.isFinite(rateBreakdown.measurementMultiplier) ? numberFormat.format(rateBreakdown.measurementMultiplier) + "×" : "Unresolved";
    document.querySelector("#rate-method-multiplier").textContent = numberFormat.format(result.data.ringingMethodMultiplier) + "×";
    document.querySelector("#rate-overkill-quantities").textContent = rateBreakdown.overkillQuantities ? rateBreakdown.overkillQuantities.join(", ") : "Unresolved";
    document.querySelector("#rate-measurement-quantity").textContent = Number.isFinite(rateBreakdown.measurementQuantityFound) ? String(rateBreakdown.measurementQuantityFound) : "Unresolved";
    document.querySelector("#rate-measurement-base").textContent = Number.isFinite(rateBreakdown.measurementBaseBonus) ? numberFormat.format(rateBreakdown.measurementBaseBonus) : "Unresolved";
    document.querySelector("#rate-measurement-bonus").textContent = Number.isFinite(rateBreakdown.measurementBonusPercent) ? numberFormat.format(rateBreakdown.measurementBonusPercent) + "%" : "Unresolved";
    document.querySelector("#rate-calculated-total").textContent = rateBreakdown.complete ? numberFormat.format(rateBreakdown.calculatedRate) + "/hr" : "Incomplete";
    var rateIssues = Array.isArray(rateBreakdown.dependencyIssues) ? rateBreakdown.dependencyIssues : [];
    document.querySelector("#rate-breakdown-status").textContent = rateBreakdown.complete ? "Every dependency is verified for this import." : BellOptimizer.bellRateSection.buildBreakdown(result.data).error;
    var rateIssueHost=document.querySelector("#rate-dependency-issues");rateIssueHost.replaceChildren();rateIssues.forEach(function(issue){var row=document.createElement("div");row.className="rate-dependency-issue";[issue.dependency,issue.status,issue.reason].forEach(function(text,index){var node=document.createElement(index===0?"strong":"span");node.textContent=text;row.appendChild(node);});rateIssueHost.appendChild(row);});
    if (BellOptimizer.developerMode && BellOptimizer.developerMode.enabled) {
    document.querySelector("#rate-source-details").textContent = JSON.stringify({ KLAPaths: result.data.killsLeftArrayPaths, RiftLevelPath: result.data.riftLevelPath, RiftLevel: result.data.riftLevel, MonumentInputs: result.data.ringingRateInputPaths, MonumentSlot9BonusPercent: rateBreakdown.monumentSlot9BonusPercent, MonumentCosmoBonusPercent: rateBreakdown.monumentCosmoBonusPercent, MonumentFountainBonusPercent: rateBreakdown.monumentFountainBonusPercent, MonumentReward7BonusPercent: rateBreakdown.monumentReward7BonusPercent, MeasurementCosmoBonusPercent: rateBreakdown.measurementCosmoBonusPercent, OverkillQuantities: rateBreakdown.overkillQuantities, MeasurementQuantityFound: rateBreakdown.measurementQuantityFound, MeasurementMulti: rateBreakdown.measurementMulti, MeasurementBaseBonus: rateBreakdown.measurementBaseBonus, MeasurementBonusPercent: rateBreakdown.measurementBonusPercent }, null, 2);
    var candidateResult = result.data.bellRateUpgradeCandidates;
    var candidateBody = document.querySelector("#bell-rate-candidates-body");
    candidateBody.replaceChildren();
    document.querySelector("#bell-rate-candidates-status").textContent = candidateResult.ok ? candidateResult.candidates.length + " independent one-step candidates. Incomplete and progression-only sources remain visible." : "Candidate calculation incomplete: " + (candidateResult.error || "missing verified input") ;
    if (candidateResult.ok) candidateResult.candidates.forEach(function (candidate) {
      var row = document.createElement("tr");
      function cell(text) { var td=document.createElement("td"); td.textContent=text; row.appendChild(td); }
      cell(candidate.name);
      cell(candidate.capped ? "Capped" : candidate.currentLevel == null ? "—" : String(candidate.currentLevel));
      cell(candidate.capped ? "—" : candidate.cost == null ? "Not deterministic" : numberFormat.format(candidate.cost) + (candidate.costResource ? " " + candidate.costResource.name : ""));
      cell(candidate.capped ? "—" : candidate.ownedResource == null ? "Unresolved" : numberFormat.format(candidate.ownedResource));
      cell(candidate.capped ? "Capped" : candidate.affordableNow ? "Affordable" : "Not affordable");
      cell(candidate.absoluteRateGain == null ? "Incomplete" : numberFormat.format(candidate.absoluteRateGain) + "/hr");
      cell(candidate.percentageRateGain == null ? "Incomplete" : candidate.percentageRateGain.toFixed(6).replace(/0+$/, "").replace(/\.$/, "") + "%");
      cell(candidate.projectedBellExpPerHour == null ? "Incomplete" : numberFormat.format(candidate.projectedBellExpPerHour) + "/hr");
      cell(candidate.additionalBellRollsAfter2Hours == null ? "Incomplete" : String(candidate.additionalBellRollsAfter2Hours));
      cell(candidate.status + (candidate.prerequisite && candidate.prerequisite !== "None" ? " — " + candidate.prerequisite : ""));
      candidateBody.appendChild(row);
    });
    document.querySelector("#bell-rate-candidate-source-details").textContent = candidateResult.ok ? JSON.stringify(candidateResult.candidates.map(function (candidate) { return { id:candidate.id, system:candidate.system, levelPath:candidate.levelPath, effectFormula:candidate.effectFormula, costFormula:candidate.costFormula, currentLevel:candidate.currentLevel, nextLevel:candidate.nextLevel, currentEffect:candidate.currentEffect, nextLevelEffect:candidate.nextLevelEffect, cost:candidate.cost, costResource:candidate.costResource, ownedResource:candidate.ownedResource, affordableNow:candidate.affordableNow, prerequisite:candidate.prerequisite, currentTotalBellExpPerHour:candidate.currentTotalBellExpPerHour, projectedBellExpPerHour:candidate.projectedBellExpPerHour, absoluteRateGain:candidate.absoluteRateGain, percentageRateGain:candidate.percentageRateGain, projectedFreshRingAfter2Hours:candidate.projectedFreshRingAfter2Hours, additionalBellRollsAfter2Hours:candidate.additionalBellRollsAfter2Hours, status:candidate.status, complete:candidate.complete }; }), null, 2) : "Candidate inputs are incomplete.";
    }
    document.querySelector("#raw-jar-11").textContent = String(result.data.jar11Level);
    document.querySelector("#raw-jar-36").textContent = String(result.data.jar36Level);
    document.querySelector("#raw-jar-talent").textContent = String(result.data.jarLegendTalentLevel);
    var developerDetails = document.querySelector("#ring-import-developer-details");
    developerDetails.className = "confirmed-import-details success";
    document.querySelector("#ring-source-details").textContent = "Confirmed source: " + result.data.bellRingIndexDisplayPath + " | Raw bellRingIndex: " + result.data.bellRingIndex + " | Derived humanRing: " + result.data.bellRingNumber;
    document.querySelector("#next-major-ring").textContent = result.data.nextMajorPayoutRing;
    document.querySelector("#rings-until-major").textContent = result.data.ringsUntilMajor;
    document.querySelector("#major-payouts-completed").textContent = result.data.majorPayoutsCompleted;
    document.querySelector("#major-timing-details").hidden = false;
    document.querySelector("#bolaia-study-level").textContent = result.data.bolaiaBellStudyLevel;
    document.querySelector("#calculated-major-bonus").textContent = result.data.majorBellBonus;
    document.querySelector("#bolaia-source-path").textContent = result.data.bolaiaBellStudyLevelDisplayPath;
    document.querySelector("#bolaia-import-details").hidden = false;
    [42, 60, 86].forEach(function (upgradeIndex) {
      var prefix = "bellUpgrade" + upgradeIndex;
      document.querySelector("#upgrade-" + upgradeIndex + "-raw").textContent = result.data[prefix + "RawValue"];
      document.querySelector("#upgrade-" + upgradeIndex + "-owned").textContent = result.data[prefix + "Owned"] ? "Owned" : "Not owned";
      document.querySelector("#upgrade-" + upgradeIndex + "-path").textContent = result.data[prefix + "Path"];
    });
    document.querySelector("#upgrade-import-details").hidden = false;
    document.querySelector("#upgrade-42-contribution").textContent = result.data.normalRingGainDetails.upgrade42Contribution;
    document.querySelector("#upgrade-60-contribution").textContent = result.data.normalRingGainDetails.upgrade60FallbackContribution;
    document.querySelector("#fallback-ring-decimal").textContent = result.data.normalRingGainDetails.fallbackRingExtraDecimal;
    document.querySelector("#special-three-enabled").textContent = result.data.normalRingGainDetails.specialThreeLevelOutcomeAvailable ? "Yes" : "No";
    document.querySelector("#special-trigger-chance").textContent = result.data.normalRingGainDetails.specialTriggerChance + "%";
    document.querySelector("#normal-gain-import-details").hidden = false;
    document.querySelector("#villager-level-0").textContent = result.data.villagerLevel0;
    document.querySelector("#calculated-caverns-owned").textContent = result.data.cavernsOwned;
    document.querySelector("#cavern-source-path").textContent = result.data.villagerLevel0DisplayPath;
    document.querySelector("#cavern-import-details").hidden = false;
    importedProbabilityOwnership = { upgrade42Owned: result.data.bellUpgrade42Owned, upgrade60Owned: result.data.bellUpgrade60Owned };
    importedEvaluatorState = { rewardLevels: result.data.values.slice(), currentRing: result.data.bellRingNumber, cavernsOwned: result.data.cavernsOwned, upgrade42Owned: result.data.bellUpgrade42Owned, upgrade60Owned: result.data.bellUpgrade60Owned, doubleEnabled: result.data.wholeRingDoubleEnabled, doubleChance: 25, majorBonus: result.data.majorBellBonus };
    importCheckpoint("after-canonical-assignment", options);
    syncRunRewardControls();
    importCheckpoint("run-render", options);
    renderRunForecast();
    importCheckpoint("after-run-render", options);
    renewalDecisionController.invalidate();
    document.querySelector("#advanced-renewal-result").hidden=true;
    if (BellOptimizer.developerMode && BellOptimizer.developerMode.enabled && BellOptimizer.automaticRunPrototype) BellOptimizer.automaticRunPrototype.invalidateAccount();
    refreshMechanicsPreview();
    refreshProbabilityPreview();
    refreshRewardSelectionPreview();
    refreshCurrentRunDistribution();
    importCheckpoint("compare-update", options);
    BellOptimizer.bellBenchmarkSection.setActiveAccount(result.data);
    importCheckpoint("after-compare-update", options);
    try { renderDashboard(result); } catch (error) { console.error("Bell Dashboard failed to render:",error);document.querySelector("#dashboard-no-save").hidden=false;document.querySelector("#dashboard-no-save").querySelector("strong").textContent="Your save imported, but the Ring Rate Dashboard could not be displayed.";document.querySelector("#dashboard-content").hidden=true; }
    importCheckpoint("rate-render", options);
    renderNormalBellRate(result);
    importCheckpoint("after-rate-render", options);
    if (!options.suppressHistory) try { BellOptimizer.bellHistorySection.setCurrent(result.data,latestRunHistoryContext).catch(function(error){console.error("Bell Progress History could not use the current import:",error);}); } catch (error) { console.error("Bell Progress History could not use the current import:",error); }
    try {
      initializeBellRateOptimizerUI(result);
    } catch (error) {
      console.error("Bell Rate Optimizer UI failed to initialize:", error);
      var optimizerStatus=document.querySelector("#bell-rate-optimizer-status");
      if(optimizerStatus)optimizerStatus.textContent="Bell Rate Optimizer is unavailable: "+BellOptimizer.saveImportWorkflow.safeMessage(error);
    }
    importCheckpoint("after-character-options", options);
    importCheckpoint("after-last-visible-update", options);
  }

  function prepareImportedResult(result) {
    if (!result || !result.ok || !result.data) throw new Error("The imported Bell account is incomplete.");
    var data=result.data;
    if (!Array.isArray(data.values) || data.values.length < 7 || !data.values.slice(0,7).every(function(value){return typeof value==="number"&&Number.isFinite(value)&&value>=0;})) throw new Error("The imported Bell reward levels are incomplete.");
    if (!data.ringingRateBreakdown || !data.bellRateUpgradeState || !data.normalRingGainDetails) throw new Error("The imported Bell mechanics could not be derived.");
    var stagedEvaluator={rewardLevels:data.values.slice(0,7),currentRing:data.bellRingNumber,cavernsOwned:data.cavernsOwned,upgrade42Owned:data.bellUpgrade42Owned,upgrade60Owned:data.bellUpgrade60Owned,doubleEnabled:data.wholeRingDoubleEnabled,doubleChance:25,majorBonus:data.majorBellBonus};
    var selectedIndex=selectedGoal&&Number.isInteger(selectedGoal.rewardIndex)?selectedGoal.rewardIndex:0,availability=BellOptimizer.bellMechanics.getRewardSelectionProbabilities(data.cavernsOwned);
    if(!availability.rewards[selectedIndex]||!availability.rewards[selectedIndex].available){var first=availability.rewards.find(function(reward){return reward.available;});selectedIndex=first?first.index:0;}
    var rate=data.ringingRateBreakdown.complete?data.ringingRateBreakdown.calculatedRate:null;
    if(Number.isFinite(rate)){
      var options={selectedRewardIndex:selectedIndex,rewardLevels:stagedEvaluator.rewardLevels,currentRawRingIndex:data.rawRingIndex,currentRingingExp:data.currentRingingExp,ringingExpPerHour:rate,currentRenewalCurrency:data.currentRenewalCurrency,cavernsOwned:data.cavernsOwned,majorBellBonus:data.majorBellBonus,bellUpgrade42Owned:data.bellUpgrade42Owned,bellUpgrade60Owned:data.bellUpgrade60Owned,bellUpgrade86Owned:data.wholeRingDoubleEnabled};
      var forecast=BellOptimizer.bellRunForecast.evaluateBellRunForecast(options),replacement=BellOptimizer.bellRunReplacement.evaluate(options),reward=BellOptimizer.BELL_REWARDS[selectedIndex],model=BellOptimizer.bellRunViewModel.build({forecast:forecast,replacement:replacement,reward:reward,formatter:BellOptimizer.idleonNumberFormat.format});
      if(!model||!model.ok)throw new Error(model&&model.message?model.message:"The Run forecast could not be prepared.");
    }
    var breakdown=BellOptimizer.bellRateSection.buildBreakdown(data);
    if(!breakdown)throw new Error("The Bell Rate view could not be prepared.");
    return {result:result,evaluatorState:stagedEvaluator};
  }

  var IMPORT_SEMANTIC_CONTROLS=["#dashboard-goal-input","#dashboard-active-character","#bell-rate-character-select","#simple-target-level","#simple-target-ring","#target-reward","#target-reward-level","#target-ring","#collectible-jar11-input","#collectible-jar36-input","#collectible-jar11-max","#collectible-jar36-max",'[name="reward1"]','[name="reward2"]','[name="reward3"]','[name="reward4"]','[name="reward5"]','[name="reward6"]','[name="reward7"]','[name="currentRing"]','[name="majorBonus"]','[name="minimumNormalGain"]','[name="maximumNormalGain"]','[name="doubleEnabled"]','[name="doubleLevelChance"]','[name="cavernsOwned"]'];
  function captureImportControl(selector){var node=document.querySelector(selector),saved;if(!node)return null;saved={selector:selector,value:node.value,checked:"checked" in node?node.checked:null};if(node.tagName==="SELECT")saved.options=Array.from(node.options).map(function(option){return {value:option.value,text:option.textContent,disabled:option.disabled};});return saved;}
  function restoreImportControl(saved){var node=saved&&document.querySelector(saved.selector);if(!node)return;if(node.tagName==="SELECT"&&Array.isArray(saved.options)){node.replaceChildren();saved.options.forEach(function(item){var option=document.createElement("option");option.value=item.value;option.textContent=item.text;option.disabled=item.disabled;node.appendChild(option);});}node.value=saved.value;if(saved.checked!==null&&"checked" in node)node.checked=saved.checked;}
  function captureSemanticImportState() {
    var controls={},disclosures={},selectedTab=document.querySelector('#bell-rate-tabs [aria-selected="true"]');
    IMPORT_SEMANTIC_CONTROLS.forEach(function(selector){var saved=captureImportControl(selector);if(saved)controls[selector]=saved;});
    document.querySelectorAll("details[id]").forEach(function(node){disclosures[node.id]=node.open;});
    return {
      globals:{importedProbabilityOwnership:importedProbabilityOwnership,importedEvaluatorState:importedEvaluatorState,importedRingingProgress:importedRingingProgress,importedRenewalState:importedRenewalState,calculatedRingingRate:calculatedRingingRate,importedBellRateState:importedBellRateState,importedDashboardData:importedDashboardData,normalBellRateUpgradeData:normalBellRateUpgradeData,dashboardRingRateGoal:dashboardRingRateGoal,selectedBellStat:selectedBellStat,selectedGoal:Object.assign({},selectedGoal),latestRunHistoryContext:latestRunHistoryContext},
      benchmark:BellOptimizer.bellBenchmarkSection.captureState(),workspace:document.body.dataset.workspace||"run",rateTab:selectedTab?selectedTab.id:null,controls:controls,disclosures:disclosures,
      normalized:BellOptimizer.activeImportTransaction.normalizedSemanticSnapshot({activeAccountId:activeImportedResult&&activeImportedResult.data&&activeImportedResult.data.fingerprint,selectedRewardIndex:selectedGoal.rewardIndex,selectedBellStat:selectedBellStat,dashboardGoal:dashboardRingRateGoal,workspace:document.body.dataset.workspace||"run",rateTab:selectedTab?selectedTab.id:null,benchmarkFingerprint:(BellOptimizer.bellBenchmarkSection._getSession().activeBenchmarkSnapshot||{}).fingerprint,disclosureState:disclosures,controlState:Object.keys(controls).reduce(function(out,key){out[key]={value:controls[key].value,checked:controls[key].checked,options:controls[key].options?controls[key].options.map(function(item){return item.value+"|"+item.text+"|"+item.disabled;}):null};return out;},{})})
    };
  }

  function restoreSemanticControls(snapshot) {
    Object.keys(snapshot.controls||{}).forEach(function(selector){restoreImportControl(snapshot.controls[selector]);});
    selectedGoal=Object.assign({},snapshot.globals.selectedGoal);var rewardButton=Number.isInteger(selectedGoal.rewardIndex)?document.querySelector('.goal-preset[data-reward-index="'+selectedGoal.rewardIndex+'"]'):null;if(rewardButton)selectGoal(rewardButton);
    selectedBellStat=snapshot.globals.selectedBellStat;document.querySelectorAll(".bell-stat-filter-button").forEach(function(button){var selected=button.dataset.bellStat===selectedBellStat;button.classList.toggle("selected",selected);button.setAttribute("aria-pressed",String(selected));});
    normalBellRateUpgradeData=snapshot.globals.normalBellRateUpgradeData||normalBellRateUpgradeData;renderPrimaryRateRecommendation();renderCandidateRows();renderUpgradeOpportunities();
    if(normalBellRateUpgradeData&&normalBellRateUpgradeData.plans){document.querySelector("#normal-practical-plan").textContent=planSummary(normalBellRateUpgradeData.plans.practicalPlan,normalBellRateUpgradeData.baselineRate);document.querySelector("#normal-maximum-plan").textContent=planSummary(normalBellRateUpgradeData.plans.bellOnlyMaximum,normalBellRateUpgradeData.baselineRate);}
    dashboardRingRateGoal=snapshot.globals.dashboardRingRateGoal;
    if(dashboardRingRateGoal!=null&&importedBellRateState){var targetResult=BellOptimizer.bellRateTargetSolver.solve({baseState:dashboardStateWithCharacter(),targetRate:dashboardRingRateGoal}),targetModel=BellOptimizer.bellTargetViewModel.build(targetResult,BellOptimizer.idleonNumberFormat.format,dashboardStateWithCharacter());renderDashboardTarget(targetModel);}
    Object.keys(snapshot.disclosures||{}).forEach(function(id){var node=document.getElementById(id);if(node&&node.tagName==="DETAILS")node.open=snapshot.disclosures[id];});
    if(snapshot.rateTab){var tabName=snapshot.rateTab.indexOf("upgrades")!==-1?"upgrades":snapshot.rateTab.indexOf("benchmark")!==-1?"benchmark":snapshot.rateTab.indexOf("history")!==-1?"history":"breakdown";selectBellRateTab(tabName);}
    selectWorkspace(snapshot.workspace||"run");
  }

  function restorePreviousImportState(previous,snapshot) {
    activeImportFailureStage=null;
    selectedGoal=Object.assign({},snapshot.globals.selectedGoal);selectedBellStat=snapshot.globals.selectedBellStat;
    applyImportedResult(previous,{rollback:true,suppressHistory:true});
    importedProbabilityOwnership=snapshot.globals.importedProbabilityOwnership;importedEvaluatorState=snapshot.globals.importedEvaluatorState;importedRingingProgress=snapshot.globals.importedRingingProgress;importedRenewalState=snapshot.globals.importedRenewalState;calculatedRingingRate=snapshot.globals.calculatedRingingRate;importedBellRateState=snapshot.globals.importedBellRateState;importedDashboardData=snapshot.globals.importedDashboardData;latestRunHistoryContext=snapshot.globals.latestRunHistoryContext||null;BellOptimizer.bellHistorySection.setRunContext(latestRunHistoryContext);
    BellOptimizer.bellBenchmarkSection.restoreState(snapshot.benchmark);restoreSemanticControls(snapshot);renewalDecisionController.invalidate();if(BellOptimizer.automaticRunPrototype)BellOptimizer.automaticRunPrototype.invalidateAccount();
  }

  function restoreEmptyImportState(snapshot) {
    activeImportFailureStage=null;
    snapshot=canonicalNoAccountState||snapshot;
    var g=snapshot.globals;importedProbabilityOwnership=g.importedProbabilityOwnership;importedEvaluatorState=g.importedEvaluatorState;importedRingingProgress=g.importedRingingProgress;importedRenewalState=g.importedRenewalState;calculatedRingingRate=g.calculatedRingingRate;importedBellRateState=g.importedBellRateState;importedDashboardData=g.importedDashboardData;normalBellRateUpgradeData=g.normalBellRateUpgradeData;dashboardRingRateGoal=g.dashboardRingRateGoal;selectedBellStat=g.selectedBellStat;selectedGoal=Object.assign({},g.selectedGoal);latestRunHistoryContext=g.latestRunHistoryContext||null;BellOptimizer.bellHistorySection.setRunContext(latestRunHistoryContext);
    document.querySelector("#save-import-panel").classList.remove("is-imported");document.querySelector("#compact-account-bar").hidden=true;document.querySelector("#import-summary").hidden=true;document.querySelector("#run-forecast-result").hidden=true;document.querySelector("#run-forecast-empty").hidden=false;document.querySelector("#dashboard-content").hidden=true;document.querySelector("#dashboard-no-save").hidden=false;
    ["normal-practical-plan","normal-maximum-plan","normal-progression-opportunities","normal-rng-opportunities","normal-capped-sources","normal-available-upgrades","normal-next-upgrades","bell-rate-optimizer-summary","bell-rate-plan-comparison","method-quantity-list","bell-rate-candidates-body","rate-dependency-issues","current-distribution-table-body","advanced-distribution-table-body","reward-selection-list","expert-reward-selection-list","confidence-table-body","remaining-opportunities-copy","remaining-opportunities-table-body","opportunities-raw-window-values","pace-window-body","pace-subwindow-body","within-lantern-milestones"].forEach(function(id){var node=document.getElementById(id);if(node)node.replaceChildren();});
    document.querySelector("#normal-bell-rate").textContent="—";document.querySelector("#normal-bell-rate-exact").textContent="";document.querySelector("#normal-rate-status").textContent="Import a save to reconstruct Bell rates.";["rate-monument-multiplier","rate-measurement-multiplier","rate-method-multiplier","rate-calculated-total","advanced-auto-rate","ringing-current-ring","ringing-progress-values","ringing-progress-percent"].forEach(function(id){var node=document.getElementById(id);if(node)node.textContent="—";});
    BellOptimizer.bellBenchmarkSection.restoreState(snapshot.benchmark);restoreSemanticControls(snapshot);renewalDecisionController.invalidate();if(BellOptimizer.automaticRunPrototype)BellOptimizer.automaticRunPrototype.invalidateAccount();
  }

  function importFromText(text, parsedResult) {
    var result=parsedResult||BellOptimizer.saveParsing.parseBellRewardLevels(text);
    if(!result.ok){showImportError(result.error.message+(result.error.path?" Path: "+result.error.path:""));return {ok:false,error:result.error};}
    var transaction=BellOptimizer.activeImportTransaction.execute(result,{
      getCurrent:function(){return activeImportedResult;},
      stage:prepareImportedResult,
      capture:function(){return activeImportedResult?captureSemanticImportState():(canonicalNoAccountState||captureSemanticImportState());},
      commit:function(staged){applyImportedResult(staged.result);},
      beforeActivate:function(){importCheckpoint("before-final-activation");},
      afterActivate:function(){importCheckpoint("after-final-activation");},
      restorePrevious:restorePreviousImportState,
      restoreEmpty:restoreEmptyImportState,
      setCurrent:function(value){activeImportedResult=value;}
    });
    if(!transaction.ok)throw transaction.error;
    return transaction;
  }

  function runImportText(text) {
    importButton.disabled = true;
    importStatus.className = "import-status";
    importStatus.textContent = "Importing save...";
    return BellOptimizer.saveImportWorkflow.runDeferred(text, {
      parseSave:function(value){return BellOptimizer.saveParsing.parseBellRewardLevels(value);},
      render:function(result){importStatus.textContent="Calculating rates...";importFromText(null,result);},
      onProgress:function(message){importStatus.textContent=message+"...";},
      onError:function(stage,error){console.error("IdleOn save import failed:",error);showImportError("Save import failed — "+stage+": "+BellOptimizer.saveImportWorkflow.safeMessage(error));}
    }).finally(function(){text=null;importButton.disabled=false;});
  }

  BellOptimizer.saveImportWorkflow.attach(importButton, function () {
    try {
      importButton.disabled = true;
      importStatus.className = "import-status";
      importStatus.textContent = "Reading save...";
      if (importSource === "file" && fileInput.files.length) {
        var reader = new FileReader();
        reader.onload = function () { runImportText(String(reader.result)); };
        reader.addEventListener("error",function(){importButton.disabled=false;});
        reader.onerror = function () { var error=new Error("The selected file could not be read.");console.error("IdleOn save import failed:",error);showImportError("Save import failed — Reading input: "+error.message); };
        reader.readAsText(fileInput.files[0]); return;
      }
      if (importSource === "paste" && pasteArea.value.length) { runImportText(pasteArea.value); return; }
      if (fileInput.files.length) {
        var fallbackReader = new FileReader();
        fallbackReader.onload = function () { runImportText(String(fallbackReader.result)); };
        fallbackReader.addEventListener("error",function(){importButton.disabled=false;});
        fallbackReader.onerror = function () { var error=new Error("The selected file could not be read.");console.error("IdleOn save import failed:",error);showImportError("Save import failed — Reading input: "+error.message); };
        fallbackReader.readAsText(fileInput.files[0]); return;
      }
      if (pasteArea.value.length) { runImportText(pasteArea.value); return; }
      showImportError("Save import failed — Reading input: Select a JSON file or paste JSON before importing.");
      importButton.disabled=false;
    } catch (error) {
      importButton.disabled=false;
      console.error("IdleOn save import failed:", error);
      showImportError("Save import failed — Reading input: "+BellOptimizer.saveImportWorkflow.safeMessage(error));
    }
  });

  document.createElement("button").addEventListener("click", function () {
    if (!importedBellRateState) return;
    var state=JSON.parse(JSON.stringify(importedBellRateState));
    var selected=document.querySelector("#bell-rate-character-select").value;
    if (selected!=="") {
      var character=state.coinCharacters.find(function(item){return item.index===Number(selected);});
      if(character){state.activeCharacterIndex=character.index;state.activeCharacterName=character.name;state.methodOwnedResources[0]=character.coins;}
    }
    var result=BellOptimizer.bellRateOptimizer.optimize(state,{objective:document.querySelector("#bell-rate-optimizer-objective").value,maxUpgradesPerPool:Number(document.querySelector("#bell-rate-optimizer-max").value)});
    var status=document.querySelector("#bell-rate-optimizer-status");
    if(!result.ok){status.textContent="Optimizer could not run: "+result.error;return;}
    status.textContent=result.searchMethod+" search; "+result.statesEvaluated+" states evaluated.";
    document.querySelector("#bell-rate-optimizer-summary").textContent="Bell rate: "+numberFormat.format(result.baselineBellRate)+"/hr → "+numberFormat.format(result.optimizedBellRate)+"/hr ("+result.percentageIncrease.toFixed(6).replace(/0+$/,"").replace(/\.$/,"")+"%). Rings: 2h "+result.baseline2HourEndingRing+" → "+result.optimized2HourEndingRing+"; 48h "+result.baseline48HourEndingRing+" → "+result.optimized48HourEndingRing+".";
    function renderList(selector,items,formatter,empty){var host=document.querySelector(selector);host.replaceChildren();if(!items.length){host.textContent=empty;return;}var list=document.createElement("ol");items.forEach(function(item){var li=document.createElement("li");li.textContent=formatter(item);list.appendChild(li);});host.appendChild(list);}
    renderList("#bell-rate-optimizer-purchases",result.orderedPurchases,function(p){return p.upgradeName+": level "+p.levelBefore+" → "+p.levelAfter+", cost "+numberFormat.format(p.cost)+", rate "+numberFormat.format(p.rateBefore)+" → "+numberFormat.format(p.rateAfter)+"/hr";},"No legal positive-gain purchases are affordable under the selected limits.");
    var resourceEntries=Object.keys(result.remainingResources).map(function(path){return {path:path,value:result.remainingResources[path]};});
    renderList("#bell-rate-optimizer-resources",resourceEntries,function(r){return r.path+": "+(Number.isFinite(r.value)?numberFormat.format(r.value):"unresolved");},"No resources were affected.");
    renderList("#bell-rate-optimizer-work-toward",result.bestUpgradesToWorkToward.slice(0,10),function(c){return c.name+": need "+numberFormat.format(Math.max(0,c.cost-c.ownedResource))+" more "+c.costResource.name+"; +"+c.percentageRateGain.toFixed(4)+"% Bell rate.";},"No complete unaffordable deterministic upgrades found.");
    renderList("#bell-rate-optimizer-opportunities",result.progressionAndRngOpportunities,function(c){return c.name+": "+c.eligibilityCategory+"; "+c.status+(c.percentageRateGain==null?"":"; +"+c.percentageRateGain.toFixed(4)+"% hypothetical rate");},"No progression, RNG, or capped opportunities found.");
  });

  var bellRatePresetControl=document.querySelector("#bell-rate-resource-preset");
  if(bellRatePresetControl)bellRatePresetControl.addEventListener("change",function(){var preset=this.value;if(preset==="custom")return;document.querySelectorAll("#bell-rate-resource-constraints tr[data-pool-id]").forEach(function(row){var percent=row.querySelector('[data-constraint="maximumPercent"]'),reserve=row.querySelector('[data-constraint="minimumReserve"]');row.querySelector('[data-constraint="maximumAmount"]').value="";row.querySelector('[data-constraint="maximumLevels"]').value="";percent.value=preset==="25"?25:preset==="50"?50:"";reserve.value=preset==="reserve25"&&Number.isFinite(Number(row.dataset.owned))?Number(row.dataset.owned)*.25:"";});});

  var bellRateRunButton=document.querySelector("#run-bell-rate-optimizer");
  if(bellRateRunButton)bellRateRunButton.addEventListener("click", function () {
    if(!importedBellRateState)return;var state=JSON.parse(JSON.stringify(importedBellRateState)),selected=document.querySelector("#bell-rate-character-select").value;
    if(selected!==""){var character=state.coinCharacters.find(function(item){return item.index===Number(selected);});if(character){state.activeCharacterIndex=character.index;state.activeCharacterName=character.name;state.methodOwnedResources[0]=character.coins;}}
    var constraints={};document.querySelectorAll("#bell-rate-resource-constraints tr[data-pool-id]").forEach(function(row){var values={};row.querySelectorAll("[data-constraint]").forEach(function(input){if(input.type==="checkbox")values[input.dataset.constraint]=input.checked;else if(input.value!=="")values[input.dataset.constraint]=Number(input.value);});constraints[row.dataset.poolId]=values;});
    var options={mode:document.querySelector("#bell-rate-optimizer-mode").value,objective:document.querySelector("#bell-rate-optimizer-objective").value,searchSafetyLimit:Number(document.querySelector("#bell-rate-optimizer-max").value),minimumPracticalRateGainPercent:Number(document.querySelector("#bell-rate-practical-threshold").value),targetEndingRing:Number(document.querySelector("#bell-rate-target-ring").value)||null,targetChance:(Number(document.querySelector("#bell-rate-target-chance").value)||0)/100,maximumExcessProgress:document.querySelector("#bell-rate-maximum-excess").checked,resourceConstraints:constraints};
    if(options.objective==="reach-target-chance"&&importedEvaluatorState){var probabilityInputs=evaluatorMechanics(selectedGoal.rewardIndex);options.targetProbabilityOptions=Object.assign({durationHours:2,currentLevel:0,targetLevel:Number(document.querySelector("#simple-target-level").value)||Number(document.querySelector("#target-reward-level").value)},probabilityInputs);}
    var result=BellOptimizer.bellRateOptimizer.comparePlans(state,options),status=document.querySelector("#bell-rate-optimizer-status");if(!result.ok){status.textContent="Optimizer could not run: "+result.error;return;}status.textContent=result.searchMethod+" search; "+result.statesEvaluated+" states evaluated."+(result.searchLimitWarning?" Warning: the safety limit may have truncated the Bell-only maximum.":"");
    var recommended=result.recommendedPlan;document.querySelector("#bell-rate-optimizer-summary").textContent=recommended.label+": "+numberFormat.format(recommended.bellRate)+"/hr; 2h ring "+recommended.twoHourEndingRing+"; 48h ring "+recommended.fortyEightHourEndingRing+"."+(recommended.breakpointMessage?" "+recommended.breakpointMessage:"");
    function renderList(selector,items,formatter,empty){var host=document.querySelector(selector);host.replaceChildren();if(!items.length){host.textContent=empty;return;}var list=document.createElement("ol");items.forEach(function(item){var li=document.createElement("li");li.textContent=formatter(item);list.appendChild(li);});host.appendChild(list);}
    renderList("#bell-rate-optimizer-purchases",recommended.orderedPurchases,function(p){return p.upgradeName+": level "+p.levelBefore+" to "+p.levelAfter+", cost "+numberFormat.format(p.cost)+", +"+p.marginalPercentageGain.toFixed(4)+"% rate, 2h rolls +"+p.individualAdditional2HourRolls+", 48h rolls +"+p.individualAdditional48HourRolls+", "+(p.resourcePoolConsumedPercent==null?"unknown":p.resourcePoolConsumedPercent.toFixed(2)+"%")+" of pool consumed."+(p.noProjectedRollGain?" Improves Bell rate but does not add a projected Bell roll at the selected horizons.":"");},"No legal positive-gain purchases are selected for this plan.");
    var comparison=document.querySelector("#bell-rate-plan-comparison");comparison.replaceChildren();var table=document.createElement("table");table.className="candidate-table";table.innerHTML="<thead><tr><th>Plan</th><th>Bell rate</th><th>Resources spent</th><th>2-hour ring</th><th>48-hour ring</th><th>Target chance</th></tr></thead><tbody></tbody>";[result.noSpending,result.practicalPlan,result.bellOnlyMaximum].forEach(function(plan){var row=document.createElement("tr"),spent=Object.keys(plan.resourcesSpent).map(function(pool){return numberFormat.format(plan.resourcesSpent[pool])+" "+pool;}).join(", ")||"None";[plan.label,numberFormat.format(plan.bellRate)+"/hr",spent,String(plan.twoHourEndingRing),String(plan.fortyEightHourEndingRing),plan.targetProbability==null?"Not applicable":(plan.targetProbability*100).toFixed(2)+"%"].forEach(function(value){var td=document.createElement("td");td.textContent=value;row.appendChild(td);});table.tBodies[0].appendChild(row);});comparison.appendChild(table);
    var resourceEntries=Object.keys(recommended.resourcesSpent).map(function(pool){return {pool:pool,value:recommended.resourcesSpent[pool]};});renderList("#bell-rate-optimizer-resources",resourceEntries,function(r){return r.pool+": "+numberFormat.format(r.value)+" spent";},"No resources spent.");
    renderList("#bell-rate-optimizer-work-toward",result.bestUpgradesToWorkToward.slice(0,10),function(c){return c.name+": need "+numberFormat.format(Math.max(0,c.cost-c.ownedResource))+" more "+c.costResource.name+"; +"+c.percentageRateGain.toFixed(4)+"% Bell rate.";},"No complete unaffordable deterministic upgrades found.");renderList("#bell-rate-optimizer-opportunities",result.progressionAndRngOpportunities,function(c){return c.name+": "+c.eligibilityCategory+"; "+c.status+(c.percentageRateGain==null?"":"; +"+c.percentageRateGain.toFixed(4)+"% hypothetical rate");},"No progression, RNG, or capped opportunities found.");
  });

  function selectBellRateTab(tabName) {
    var breakdown=tabName==="breakdown",upgrades=tabName==="upgrades",benchmark=tabName==="benchmark",history=tabName==="history";document.querySelector("#bell-rate-breakdown-tab").setAttribute("aria-selected",String(breakdown));document.querySelector("#bell-rate-upgrades-tab").setAttribute("aria-selected",String(upgrades));document.querySelector("#bell-rate-benchmark-tab").setAttribute("aria-selected",String(benchmark));document.querySelector("#bell-rate-history-tab").setAttribute("aria-selected",String(history));document.querySelector("#bell-rate-breakdown-panel").hidden=!breakdown;document.querySelector("#bell-rate-upgrades-panel").hidden=!upgrades;document.querySelector("#bell-rate-benchmark-panel").hidden=!benchmark;document.querySelector("#bell-rate-history-panel").hidden=!history;if(benchmark)BellOptimizer.bellBenchmarkSection.open();if(history)BellOptimizer.bellHistorySection.refresh();
  }
  function selectWorkspace(workspace,options){
    options=options||{};if(["run","rate","compare","history"].indexOf(workspace)===-1)return;
    var run=document.querySelector("#run-optimizer-workspace"),rate=document.querySelector("#rate-optimizer-workspace"),tabs=document.querySelector("#bell-rate-tabs"),title=document.querySelector("#bell-rate-title");
    document.body.dataset.workspace=workspace;run.hidden=workspace!=="run";rate.hidden=workspace==="run";tabs.hidden=workspace==="compare"||workspace==="history";
    document.querySelectorAll(".app-navigation [data-workspace]").forEach(function(button){if(button.dataset.workspace===workspace)button.setAttribute("aria-current","page");else button.removeAttribute("aria-current");});
    if(workspace==="compare"){title.textContent="Compare Accounts";selectBellRateTab("benchmark");}
    else if(workspace==="history"){title.textContent="Progress History";selectBellRateTab("history");}
    else if(workspace==="rate"){title.textContent="Bell Rate";var active=document.querySelector('#bell-rate-tabs [aria-selected="true"]');if(!active||active.id==="bell-rate-benchmark-tab"||active.id==="bell-rate-history-tab")selectBellRateTab("breakdown");}
    if(options.scroll){document.querySelector(workspace==="run"?"#run-optimizer-workspace":"#rate-optimizer-workspace").scrollIntoView({behavior:"smooth",block:"start"});}
  }
  document.querySelector("#bell-rate-breakdown-tab").addEventListener("click",function(){selectBellRateTab("breakdown");});
  document.querySelector("#bell-rate-upgrades-tab").addEventListener("click",function(){selectBellRateTab("upgrades");});
  document.querySelector("#bell-rate-benchmark-tab").addEventListener("click",function(){selectBellRateTab("benchmark");});
  document.querySelector("#bell-rate-history-tab").addEventListener("click",function(){selectBellRateTab("history");});
  document.querySelector("#benchmark-shortcut").addEventListener("click",function(){selectWorkspace("compare",{scroll:true});});
  document.querySelector("#nav-run-optimizer").addEventListener("click",function(){selectWorkspace("run");});
  document.querySelector("#nav-rate-optimizer").addEventListener("click",function(){selectWorkspace("rate");});
  document.querySelector("#header-open-compare").addEventListener("click",function(){selectWorkspace("compare");});
  document.querySelector("#header-open-history").addEventListener("click",function(){selectWorkspace("history");});
  document.querySelector("#run-open-rate-optimizer").addEventListener("click",function(){selectWorkspace("rate",{scroll:true});});
  document.querySelector("#rate-open-run-optimizer").addEventListener("click",function(){selectWorkspace("run",{scroll:true});});
  document.querySelector("#change-save-button").addEventListener("click",function(){document.querySelector("#save-import-panel").classList.remove("is-imported");document.querySelector("#compact-account-bar").hidden=true;document.querySelector("#json-file").focus();});
  document.querySelector("#dashboard-open-breakdown").addEventListener("click",function(){selectBellRateTab("breakdown");document.querySelector("#bell-rate-section").scrollIntoView({behavior:"smooth",block:"start"});});
  document.querySelector("#dashboard-open-upgrades").addEventListener("click",function(){selectBellRateTab("upgrades");document.querySelector("#bell-rate-section").scrollIntoView({behavior:"smooth",block:"start"});});
  document.querySelector("#dashboard-active-character").addEventListener("change",function(){var legacy=document.querySelector("#bell-rate-character-select");if(legacy)legacy.value=this.value;if(importedDashboardData)try{renderDashboard({data:importedDashboardData});}catch(error){console.error("Bell Dashboard character selection failed:",error);}});
  document.querySelector("#dashboard-find-plan").addEventListener("click",function(){
    var status=document.querySelector("#dashboard-goal-status"),parsed=BellOptimizer.idleonNumberFormat.parse(document.querySelector("#dashboard-goal-input").value);
    if(!importedBellRateState){status.className="import-status error";status.textContent="Import your save before setting a Ring Rate goal.";return;}
    if(!parsed.ok){status.className="import-status error";status.textContent="Enter a positive Ring Rate using plain digits, scientific notation, or K, M, B, T, Q, or QQ.";document.querySelector("#dashboard-goal-result").hidden=true;return;}
    status.className="import-status";status.textContent="Finding a verified plan…";
    try{var baseState=dashboardStateWithCharacter(),targetResult=BellOptimizer.bellRateTargetSolver.solve({baseState:baseState,targetRate:parsed.value}),model=BellOptimizer.bellTargetViewModel.build(targetResult,BellOptimizer.idleonNumberFormat.format,baseState);dashboardRingRateGoal=parsed.value;renderDashboardTarget(model);}catch(error){console.error("Bell Ring Rate goal failed:",error);renderDashboardTarget(BellOptimizer.bellTargetViewModel.build({ok:false,error:{message:BellOptimizer.saveImportWorkflow.safeMessage(error)}},BellOptimizer.idleonNumberFormat.format));}
  });
  document.querySelectorAll('[name="collectible-target-mode"]').forEach(function(input){input.addEventListener("change",syncCollectibleInputs);});
  syncCollectibleInputs();
  document.querySelector("#calculate-collectible-what-if").addEventListener("click",function(){
    var status=document.querySelector("#collectible-what-if-status"),jar11=parseCollectibleLevel(document.querySelector("#collectible-jar11-input"),"Big Beef Rock Jar"),jar36=parseCollectibleLevel(document.querySelector("#collectible-jar36-input"),"Twisted Rupie Jar");
    if(!importedBellRateState){status.className="import-status error";status.textContent="Import your save before exploring collectible levels.";return;}
    if(!jar11.ok||!jar36.ok){status.className="import-status error";status.textContent=(jar11.ok?jar36:jar11).message;document.querySelector("#collectible-what-if-result").hidden=true;return;}
    if(jar11.empty&&jar36.empty){status.className="import-status error";status.textContent="Enter at least one hypothetical Jar level.";document.querySelector("#collectible-what-if-result").hidden=true;return;}
    var input={baseState:dashboardStateWithCharacter()},mode=collectibleMode();if(!jar11.empty)input[mode==="delta"?"jar11Delta":"jar11Level"]=jar11.value;if(!jar36.empty)input[mode==="delta"?"jar36Delta":"jar36Level"]=jar36.value;
    try{var scenario=BellOptimizer.bellRateTargetSolver.manualJarScenario(input);if(!scenario.ok)throw new Error(scenario.error.message);renderCollectibleScenario(scenario);status.className="import-status success";status.textContent="Hypothetical Ring Rate calculated from the verified Bell formula.";}catch(error){console.error("Collectible what-if failed:",error);status.className="import-status error";status.textContent=BellOptimizer.saveImportWorkflow.safeMessage(error);document.querySelector("#collectible-what-if-result").hidden=true;}
  });
  document.querySelector("#dashboard-collectible-future").addEventListener("click",function(){var details=document.querySelector("#dashboard-collectible-what-if");details.open=true;details.scrollIntoView({behavior:"smooth",block:"start"});document.querySelector("#collectible-jar11-max").focus();});
  document.querySelector("#find-collectible-combinations").addEventListener("click",function(){
    var status=document.querySelector("#collectible-combination-status"),max11=parseCollectibleLevel(document.querySelector("#collectible-jar11-max"),"Big Beef Rock maximum"),max36=parseCollectibleLevel(document.querySelector("#collectible-jar36-max"),"Twisted Rupie maximum");
    if(!importedBellRateState||dashboardRingRateGoal==null){status.className="import-status error";status.textContent="Enter an unreachable Ring Rate goal first.";return;}
    if(!max11.ok||!max36.ok||max11.empty||max36.empty){status.className="import-status error";status.textContent=(!max11.ok?max11.message:!max36.ok?max36.message:"Enter both hypothetical maximum levels.");return;}
    try{var result=BellOptimizer.bellRateTargetSolver.solve({baseState:dashboardStateWithCharacter(),targetRate:dashboardRingRateGoal,jarScenario:{enabled:true,jar11MaxLevel:max11.value,jar36MaxLevel:max36.value}});renderCollectibleCombinations(result);}catch(error){console.error("Collectible combination search failed:",error);status.className="import-status error";status.textContent=BellOptimizer.saveImportWorkflow.safeMessage(error);}
  });
  document.querySelectorAll(".rate-factor-details").forEach(function(details){var summary=details.querySelector("summary");function syncExpanded(){summary.setAttribute("aria-expanded",String(details.open));}syncExpanded();details.addEventListener("toggle",syncExpanded);});
  try { BellOptimizer.bellHistorySection.bind();BellOptimizer.bellHistorySection.initialize().catch(function(error){console.error("Bell Progress History initialization failed:",error);}); } catch(error) { console.error("Bell Progress History controls failed to initialize:",error); }
  try { BellOptimizer.bellHistoryPresentation.initialize(); } catch(error) { console.error("Bell Progress History presentation failed to initialize:",error); }
  try { BellOptimizer.bellBenchmarkSection.bind(); } catch(error) { console.error("Benchmark Compare controls failed to initialize:",error); }
  if (BellOptimizer.developerMode && BellOptimizer.developerMode.enabled) {
    try { BellOptimizer.automaticRunPrototype.initialize({ getSnapshot: automaticPrototypeSnapshot }); } catch(error) { console.error("Automatic Run Evaluator Prototype failed to initialize:",error); }
  }
  document.querySelectorAll(".bell-stat-filter-button").forEach(function(button){button.addEventListener("click",function(){selectedBellStat=button.dataset.bellStat;document.querySelectorAll(".bell-stat-filter-button").forEach(function(item){var selected=item===button;item.classList.toggle("selected",selected);item.setAttribute("aria-pressed",String(selected));});renderPrimaryRateRecommendation();renderCandidateRows();renderUpgradeOpportunities();});});
  selectWorkspace("run");
  document.querySelector(".decision-calibration p").textContent="Fresh P80 defines elite upside. Achieved P80/P90 results are preserved; opposing upside cannot override an expected finish more than 20% worse. P80 probability, expected P80 excess, and quartic percentile utility vote by consensus.";

  ['[name="majorBonus"]', '[name="minimumNormalGain"]', '[name="maximumNormalGain"]', '[name="doubleEnabled"]', '[name="doubleLevelChance"]', '[name="currentRing"]'].forEach(function (selector) {
    document.querySelector(selector).addEventListener("input", refreshMechanicsPreview);
    document.querySelector(selector).addEventListener("change", refreshMechanicsPreview);
    document.querySelector(selector).addEventListener("input", refreshProbabilityPreview);
    document.querySelector(selector).addEventListener("change", refreshProbabilityPreview);
  });
  refreshMechanicsPreview();
  document.querySelector('[name="cavernsOwned"]').addEventListener("input", refreshRewardSelectionPreview);
  document.querySelector('[name="cavernsOwned"]').addEventListener("change", refreshRewardSelectionPreview);
  refreshRewardSelectionPreview();
  document.querySelector("#evaluate-target").addEventListener("click", evaluateSelectedTarget);
  document.querySelector("#check-my-run").addEventListener("click", checkMyRun);
  document.querySelector("#run-advanced-renewal").addEventListener("click", requestAdvancedRenewalDecision);
  document.querySelectorAll(".goal-preset[data-reward-index]").forEach(function (button) { button.addEventListener("click", function () { selectGoal(button); }); });
  selectGoal(document.querySelector('.goal-preset[data-reward-index="6"]'));
  canonicalNoAccountState=captureSemanticImportState();

  return { status: "ready", importBellLevelsFromText: runImportText, refreshMechanicsPreview: refreshMechanicsPreview, refreshRewardSelectionPreview: refreshRewardSelectionPreview, evaluateSelectedTarget: evaluateSelectedTarget, checkMyRun: checkMyRun, selectGoal: selectGoal, friendlyQuality: friendlyQuality, _test:{setImportFailureStage:function(stage){activeImportFailureStage=stage||null;},captureSemanticImportState:captureSemanticImportState} };
}());
