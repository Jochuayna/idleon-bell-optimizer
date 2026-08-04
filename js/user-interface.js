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
  var importedRingingProgress = null;
  var importedRenewalState = null;
  var calculatedRingingRate = null;
  var importedBellRateState = null;
  var normalBellRateUpgradeData = null;
  var selectedBellStat = BellOptimizer.bellRateSection.DEFAULT_BELL_STAT;
  var selectedGoal = { name: "Fountain", rewardIndex: 6, rewardName: "Coins From Fountain" };

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
    if(!normalBellRateUpgradeData)return;var body=document.querySelector("#normal-candidate-body"),format=BellOptimizer.idleonNumberFormat.format,affordableFirst=document.querySelector("#normal-candidate-affordable-first").checked,items=BellOptimizer.bellRateSection.candidatesForStat(normalBellRateUpgradeData.candidates,selectedBellStat,affordableFirst),activeCount=BellOptimizer.bellRateSection.activeCandidateCount(normalBellRateUpgradeData.candidates,selectedBellStat),showTable=activeCount>=2,note=document.querySelector("#single-candidate-note");document.querySelector("#normal-candidate-section").hidden=!showTable;note.hidden=activeCount!==1;note.textContent=activeCount===1?"Only one verified "+selectedBellStat+" rate upgrade is currently available.":"";body.replaceChildren();if(!showTable)return;items.forEach(function(c){var row=document.createElement("tr"),isCapped=!!c.capped,status=isCapped?"Capped":c.affordableNow?"Affordable":c.status==="passive or RNG-dependent"?"RNG-dependent":c.status==="progression-gated"?"Progression-gated":"Not affordable",cost=isCapped?"—":c.cost==null?"Not deterministic":format(c.cost)+(c.costResource?" "+c.costResource.name:"");[c.name,c.effect,isCapped?"Capped":c.currentLevel+" → "+c.nextLevel,cost,isCapped?"—":c.ownedResource==null?"—":format(c.ownedResource),status,isCapped?"—":"+"+BellOptimizer.bellRateSection.formatRateGain(c.absoluteAffectedGain,format),isCapped?"—":format(c.projectedAffectedValue)+"/hr"].forEach(function(value){var cell=document.createElement("td");cell.textContent=value;row.appendChild(cell);});body.appendChild(row);});
  }
  function renderPrimaryRateRecommendation() {
    if(!normalBellRateUpgradeData)return;var format=BellOptimizer.idleonNumberFormat.format,recommendation=BellOptimizer.bellRateSection.primaryRecommendation(normalBellRateUpgradeData.candidates,selectedBellStat);document.querySelector("#normal-multi-upgrade-plans").hidden=selectedBellStat!=="Bell Ring";document.querySelector("#primary-rate-recommendation-title").textContent=recommendation?"Best "+selectedBellStat+" upgrade":"";if(!recommendation){document.querySelector("#primary-rate-recommendation-main").textContent=BellOptimizer.bellRateSection.noActiveCandidateMessage(selectedBellStat);document.querySelector("#primary-rate-recommendation-rate").textContent="";document.querySelector("#primary-rate-recommendation-cost").textContent="";return;}var c=recommendation.candidate,status=recommendation.affordable?"Affordable":"Upgrade to Work Toward",missing=recommendation.affordable?"":" · Missing "+format(Math.max(0,c.cost-c.ownedResource));document.querySelector("#primary-rate-recommendation-main").textContent=c.name+" · "+status+" · "+c.currentLevel+" → "+c.nextLevel;document.querySelector("#primary-rate-recommendation-rate").textContent="+"+BellOptimizer.bellRateSection.formatRateGain(c.absoluteAffectedGain,format)+" · "+format(c.currentAffectedValue)+"/hr → "+format(c.projectedAffectedValue)+"/hr";document.querySelector("#primary-rate-recommendation-cost").textContent="Cost: "+format(c.cost)+" "+c.costResource.name+missing;
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
    try { normalBellRateUpgradeData=BellOptimizer.bellRateSection.buildUpgradePaths(result.data.bellRateUpgradeState);if(!normalBellRateUpgradeData.ok)throw new Error(normalBellRateUpgradeData.error||"Unknown optimizer error");var plans=normalBellRateUpgradeData.plans;document.querySelector("#normal-upgrade-paths-status").textContent="";document.querySelector("#normal-practical-plan").textContent=planSummary(plans.practicalPlan,normalBellRateUpgradeData.baselineRate);document.querySelector("#normal-maximum-plan").textContent=planSummary(plans.bellOnlyMaximum,normalBellRateUpgradeData.baselineRate);document.querySelector("#normal-search-warning").textContent=(plans.searchMethod==="exact"?"Exact within the current safety limit.":plans.searchMethod+" within the current safety limit.")+(plans.searchLimitWarning?" The result may improve if the search limit is increased.":"");renderPrimaryRateRecommendation();renderCandidateRows();
      var candidateWarnings=normalBellRateUpgradeData.invalidCandidateWarnings;if(candidateWarnings.length)document.querySelector("#normal-upgrade-paths-status").textContent=candidateWarnings.length+" invalid upgrade candidate"+(candidateWarnings.length===1?" was":"s were")+" excluded safely. Rate Breakdown and save import remain available.";
      function opportunityList(selector,items,formatter){var host=document.querySelector(selector);host.replaceChildren();var list=document.createElement("ul");items.forEach(function(item){var li=document.createElement("li");li.textContent=formatter(item);list.appendChild(li);});host.appendChild(list);}
      opportunityList("#normal-progression-opportunities",plans.progressionAndRngOpportunities.filter(function(c){return c.eligibilityCategory==="Progression targets";}),function(c){return c.name+": about "+Math.round(c.cost).toLocaleString()+" kills needed; projected Bell-rate gain +"+c.percentageRateGain.toFixed(4)+"%.";});opportunityList("#normal-rng-opportunities",plans.progressionAndRngOpportunities.filter(function(c){return c.eligibilityCategory==="RNG-dependent";}),function(c){var name=c.id==="jar-11"?"Big Beef Rock Jar next level":c.id==="jar-36"?"Twisted Rupie Jar next level":c.name;return name+(c.percentageRateGain==null?"":" — hypothetical +"+c.percentageRateGain.toFixed(4)+"%");});opportunityList("#normal-capped-sources",plans.progressionAndRngOpportunities.filter(function(c){return c.eligibilityCategory==="Capped";}),function(c){return c.name;});
    } catch(error){normalBellRateUpgradeData=null;console.error("Bell Rate Upgrade Paths failed to render:",error);document.querySelector("#normal-upgrade-paths-status").textContent="Upgrade Paths could not be loaded.";}
  }

  form.addEventListener("submit", function (event) { event.preventDefault(); });
  document.querySelector(".advanced-content").appendChild(document.querySelector("#ring-import-developer-details"));

  goal.addEventListener("change", function () {
    weights.hidden = goal.value !== "custom";
  });

  fileInput.addEventListener("change", function () {
    fileName.textContent = fileInput.files.length ? fileInput.files[0].name + " selected for local import or inspection" : "No file selected";
    if (fileInput.files.length) importSource = "file";
  });

  pasteArea.addEventListener("input", function () {
    if (pasteArea.value.trim()) importSource = "paste";
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
    });
    document.querySelector("#expected-normal-before").textContent = formatExpected(expectedBefore.value);
    document.querySelector("#expected-normal-after").textContent = formatExpected(expectedAfter.value);
    document.querySelector("#expected-major-after").textContent = expectedMajor.ok ? formatExpected(expectedMajor.afterDouble.value) : "Invalid inputs";
    renderDistribution("#normal-distribution-before", normalBefore);
    renderDistribution("#normal-distribution-after", normalAfter);
    if (major.ok) { renderDistribution("#major-distribution-before", major.beforeDouble); renderDistribution("#major-distribution-after", major.afterDouble); }
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
      [reward.index + " — " + reward.name, String(reward.currentLevel), String(reward.shareOfCurrentLevels), fraction + " (" + String(reward.futureSelectionProbabilityValue) + ")"].forEach(function (value) { var cell = document.createElement("span"); cell.textContent = value; row.appendChild(cell); });
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
    var generatedPools=BellOptimizer.bellRateUpgradeCandidates.generate(importedBellRateState), uniquePools={};
    constraintHost.replaceChildren();
    var constraintTable=document.createElement("table");constraintTable.className="candidate-table";constraintTable.innerHTML="<thead><tr><th>Resource</th><th>Owned</th><th>Disable</th><th>Max spend</th><th>Min reserve</th><th>Max %</th><th>Max levels</th></tr></thead><tbody></tbody>";
    if(generatedPools.ok)generatedPools.candidates.forEach(function(c){if(!c.resourcePoolId||!c.deterministicPurchase||uniquePools[c.resourcePoolId])return;uniquePools[c.resourcePoolId]=true;var row=document.createElement("tr");row.dataset.poolId=c.resourcePoolId;row.dataset.owned=String(c.ownedResource);row.innerHTML="<td></td><td></td><td><input type=\"checkbox\" data-constraint=\"disabled\"></td><td><input type=\"number\" min=\"0\" data-constraint=\"maximumAmount\"></td><td><input type=\"number\" min=\"0\" data-constraint=\"minimumReserve\"></td><td><input type=\"number\" min=\"0\" max=\"100\" data-constraint=\"maximumPercent\"></td><td><input type=\"number\" min=\"0\" data-constraint=\"maximumLevels\"></td>";row.children[0].textContent=c.costResource.name;row.children[1].textContent=Number.isFinite(c.ownedResource)?numberFormat.format(c.ownedResource):"Unresolved";constraintTable.tBodies[0].appendChild(row);});
    constraintHost.appendChild(constraintTable);
  }

  function importFromText(text, parsedResult) {
    var result = parsedResult || BellOptimizer.saveParsing.parseBellRewardLevels(text);
    if (!result.ok) {
      showImportError(result.error.message + (result.error.path ? " Path: " + result.error.path : ""));
      return;
    }
    normalBellRateUpgradeData=null;
    var upgradeViewReset=BellOptimizer.bellRateSection.defaultViewState();
    selectedBellStat=upgradeViewReset.selectedStat;
    document.querySelectorAll(".bell-stat-filter-button").forEach(function(button){var selected=button.dataset.bellStat===selectedBellStat;button.classList.toggle("selected",selected);button.setAttribute("aria-pressed",String(selected));});
    document.querySelector("#normal-candidate-affordable-first").checked=upgradeViewReset.affordableFirst;
    document.querySelector("#normal-multi-upgrade-plans").open=upgradeViewReset.plansExpanded;
    document.querySelector("#current-run-distribution").open=false;
    document.querySelector("#normal-candidate-section").hidden=false;
    document.querySelector("#single-candidate-note").hidden=true;
    document.querySelector("#bell-rate-section").hidden=false;
    document.querySelector("#normal-bell-rate").textContent="—";
    document.querySelector("#normal-bell-rate-exact").textContent="";
    document.querySelector("#normal-upgrade-paths-status").textContent="Upgrade Paths will load after import.";
    ["#normal-practical-plan","#normal-maximum-plan","#normal-progression-opportunities","#normal-rng-opportunities","#normal-capped-sources","#normal-candidate-body"].forEach(function(selector){document.querySelector(selector).replaceChildren();});
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
    importStatus.className = "import-status success";
    importStatus.textContent = "Your Bell data was imported locally and is ready to check.";
    pasteArea.value = "";
    document.querySelector("#summary-current-ring").textContent = result.data.bellRingNumber;
    document.querySelector("#summary-rewards-unlocked").textContent = BellOptimizer.bellMechanics.getAvailableRewards(result.data.cavernsOwned).rewards.length;
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
    refreshMechanicsPreview();
    refreshProbabilityPreview();
    refreshRewardSelectionPreview();
    refreshCurrentRunDistribution();
    try { renderNormalBellRate(result); } catch (error) { console.error("Bell Rate section failed to render:",error);document.querySelector("#bell-rate-section").hidden=false;document.querySelector("#normal-rate-status").textContent="Bell Rate breakdown could not be displayed."; }
    try { BellOptimizer.bellHistorySection.setCurrent(result.data).catch(function(error){console.error("Bell Progress History could not use the current import:",error);}); } catch (error) { console.error("Bell Progress History could not use the current import:",error); }
    try {
      initializeBellRateOptimizerUI(result);
    } catch (error) {
      console.error("Bell Rate Optimizer UI failed to initialize:", error);
      var optimizerStatus=document.querySelector("#bell-rate-optimizer-status");
      if(optimizerStatus)optimizerStatus.textContent="Bell Rate Optimizer is unavailable: "+BellOptimizer.saveImportWorkflow.safeMessage(error);
    }
  }

  function runImportText(text) {
    return BellOptimizer.saveImportWorkflow.run(text, {
      parseSave:function(value){return BellOptimizer.saveParsing.parseBellRewardLevels(value);},
      render:function(result){importFromText(text,result);},
      onError:function(stage,error){console.error("IdleOn save import failed:",error);showImportError("Save import failed — "+stage+": "+BellOptimizer.saveImportWorkflow.safeMessage(error));}
    });
  }

  BellOptimizer.saveImportWorkflow.attach(importButton, function () {
    try {
      if (importSource === "file" && fileInput.files.length) {
        var reader = new FileReader();
        reader.onload = function () { runImportText(String(reader.result)); };
        reader.onerror = function () { var error=new Error("The selected file could not be read.");console.error("IdleOn save import failed:",error);showImportError("Save import failed — Reading input: "+error.message); };
        reader.readAsText(fileInput.files[0]); return;
      }
      if (importSource === "paste" && pasteArea.value.trim()) { runImportText(pasteArea.value); return; }
      if (fileInput.files.length) {
        var fallbackReader = new FileReader();
        fallbackReader.onload = function () { runImportText(String(fallbackReader.result)); };
        fallbackReader.onerror = function () { var error=new Error("The selected file could not be read.");console.error("IdleOn save import failed:",error);showImportError("Save import failed — Reading input: "+error.message); };
        fallbackReader.readAsText(fileInput.files[0]); return;
      }
      if (pasteArea.value.trim()) { runImportText(pasteArea.value); return; }
      showImportError("Save import failed — Reading input: Select a JSON file or paste JSON before importing.");
    } catch (error) {
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
    var breakdown=tabName==="breakdown",upgrades=tabName==="upgrades",history=tabName==="history";document.querySelector("#bell-rate-breakdown-tab").setAttribute("aria-selected",String(breakdown));document.querySelector("#bell-rate-upgrades-tab").setAttribute("aria-selected",String(upgrades));document.querySelector("#bell-rate-history-tab").setAttribute("aria-selected",String(history));document.querySelector("#bell-rate-breakdown-panel").hidden=!breakdown;document.querySelector("#bell-rate-upgrades-panel").hidden=!upgrades;document.querySelector("#bell-rate-history-panel").hidden=!history;if(history)BellOptimizer.bellHistorySection.refresh();
  }
  document.querySelector("#bell-rate-breakdown-tab").addEventListener("click",function(){selectBellRateTab("breakdown");});
  document.querySelector("#bell-rate-upgrades-tab").addEventListener("click",function(){selectBellRateTab("upgrades");});
  document.querySelector("#bell-rate-history-tab").addEventListener("click",function(){selectBellRateTab("history");});
  document.querySelectorAll(".rate-factor-details").forEach(function(details){var summary=details.querySelector("summary");function syncExpanded(){summary.setAttribute("aria-expanded",String(details.open));}syncExpanded();details.addEventListener("toggle",syncExpanded);});
  try { BellOptimizer.bellHistorySection.bind();BellOptimizer.bellHistorySection.initialize().catch(function(error){console.error("Bell Progress History initialization failed:",error);}); } catch(error) { console.error("Bell Progress History controls failed to initialize:",error); }
  try { BellOptimizer.bellHistoryPresentation.initialize(); } catch(error) { console.error("Bell Progress History presentation failed to initialize:",error); }
  document.querySelector("#normal-candidate-affordable-first").addEventListener("change",renderCandidateRows);
  document.querySelectorAll(".bell-stat-filter-button").forEach(function(button){button.addEventListener("click",function(){selectedBellStat=button.dataset.bellStat;document.querySelectorAll(".bell-stat-filter-button").forEach(function(item){var selected=item===button;item.classList.toggle("selected",selected);item.setAttribute("aria-pressed",String(selected));});renderPrimaryRateRecommendation();renderCandidateRows();});});

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
  document.querySelectorAll(".goal-preset[data-reward-index]").forEach(function (button) { button.addEventListener("click", function () { selectGoal(button); }); });
  selectGoal(document.querySelector('.goal-preset[data-reward-index="6"]'));

  return { status: "ready", importBellLevelsFromText: runImportText, refreshMechanicsPreview: refreshMechanicsPreview, refreshRewardSelectionPreview: refreshRewardSelectionPreview, evaluateSelectedTarget: evaluateSelectedTarget, checkMyRun: checkMyRun, selectGoal: selectGoal, friendlyQuality: friendlyQuality };
}());
