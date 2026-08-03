"use strict";
window.BellOptimizer = window.BellOptimizer || {};

BellOptimizer.bellRateUpgradeCandidates = (function () {
  var METHOD_BASE_COSTS = Object.freeze([15000000000, 100, 1000000, 300, 150, 1500]);
  var METHOD_COST_GROWTH = Object.freeze([1.25, 1.1, 1.5, 1.1, 1.1, 1.1]);
  var METHOD_RESOURCES = Object.freeze(BellOptimizer.BELL_METHODS.map(function (method) {
    return Object.freeze({ name: method.resourceName, path: method.resourcePath, id: method.resourceId || null });
  }));
  var RESOURCE_POOL_IDS = Object.freeze(["coins", "holes-9-3", "gaming-bits", "holes-9-14", "divinity-points", "holes-9-25"]);
  var DEATH_NOTE_NAMES = Object.freeze([
    Object.freeze(["Green Mushroom","Red Mushroom","Frog","Bored Bean","Slime","Baby Boa","Carrotman","Glublin","Wode Board","Gigafrog","Poop","Rat","Walking Stick","Nuttoo","Wood Mushroom"]),
    Object.freeze(["Sandy Pot","Mimic","Crabcake","Mafioso","Sand Castle","Pincermin","Mashed Potato","Tyson","Moonmoon","Sand Giant","Snelbie"]),
    Object.freeze(["Sheepie","Frost Flake","Sir Stache","Bloque","Mamooth","Snowman","Penguin","Thermister","Quenchie","Cryosnake","Bop Box","Neyeptune","Dedotated Ram","Bloodbone"]),
    Object.freeze(["Purp Mushroom","TV","Donut","Demon Genie","Soda Can","Flying Worm","Gelatinous Cuboid","Choccie","Biggole Wurm","Clammie","Octodar","Flombeige","Stilted Seeker"]),
    Object.freeze(["Suggma","Maccie","Mister Brightside","Cheese Nub","Stiltmole","Molti","Purgatory Stalker","Citringe","Lampar","Fire Spirit","Biggole Mole","Crawler","Tremor Wurm"]),
    Object.freeze(["Sprout Spirit","Ricecake","River Spirit","Baby Troll","Woodlin Spirit","Bamboo Spirit","Lantern Spirit","Mama Troll","Leek Spirit","Ceramic Spirit","Skydoggie Spirit","Royal Egg","Minichief Spirit","Samurai Guardian"]),
    Object.freeze(["Eggroll","Jellofish","KelpFish","Mantaray","Equinox Broadbass","Doodlefish","Lampsy Earl","Shellslug","Balloonfish","Noble Clam","Litterfish","Pufferblob","Demonblob","Spearfish","Coralcave Crab","Coralcave Guardian","Trench Fish","Boomy Mine","Pirate Underling"])
  ]);
  var RINGING_METHOD_INDEXES = Object.freeze([0, 2, 4, 5]);

  function finite(value) { return typeof value === "number" && Number.isFinite(value); }
  function validateCandidate(candidate) {
    var errors=[];
    if(candidate.capped){if(candidate.nextLevel!==null)errors.push("Capped candidate has a next level.");if(candidate.cost!==null)errors.push("Capped candidate has a purchase cost.");}
    Object.keys(candidate.affectedRates||{}).forEach(function(stat){var rate=candidate.affectedRates[stat],values=[rate.current,rate.projected,rate.gain];if(!values.every(finite)||rate.current<0||rate.projected<0)errors.push(stat+" rates are invalid.");else{var difference=rate.projected-rate.current,tolerance=Math.max(1,Math.abs(difference))*1e-10;if(Math.abs(rate.gain-difference)>tolerance)errors.push(stat+" absolute gain does not match projected minus current.");if(rate.gain>0&&rate.projected<=rate.current)errors.push(stat+" positive gain does not increase the projected rate.");}});
    if(candidate.deterministicPurchase&&candidate.complete&&!candidate.capped){if(!finite(candidate.cost)||candidate.cost<0)errors.push("Purchase cost is invalid.");if(!finite(candidate.ownedResource)||candidate.ownedResource<0)errors.push("Owned resource is invalid.");}
    candidate.validationErrors=errors;candidate.validationValid=errors.length===0;return candidate.validationValid;
  }
  function methodCost(index, level) { return METHOD_BASE_COSTS[index] * Math.pow(METHOD_COST_GROWTH[index], level); }
  function measurementCost(index, level, reductionPercent) {
    return (250 + 50 * level) * Math.pow(1.6, index - 6 * Math.floor(index / 10)) * Math.pow(1.1, level) / (1 + reductionPercent / 100);
  }
  function fountainUpgradeCost(level, baseCost, growth) { return baseCost === 1 ? (level + 1) * Math.pow(growth, level) : baseCost * Math.pow(growth, level); }
  function marbleCost(waterIndex, upgradeIndex, level) {
    if (waterIndex >= 2) return 250000 * Math.pow(2 * (5 + level), level);
    if (upgradeIndex === 13) return 1500 * Math.pow(10 + 5 * level, level);
    return 500 * Math.pow(5 + level, level);
  }
  function nextDeathNoteThreshold(kills, eclipseUnlocked) {
    var thresholds = [25000,100000,250000,500000,1000000,5000000,100000000];
    for (var index = 0; index < thresholds.length; index += 1) if (kills < thresholds[index]) return thresholds[index];
    if (eclipseUnlocked && kills <= 1000000000) return 1000000001;
    return null;
  }
  function cloneArray(values) { return values.slice(); }
  function recompute(state, changes) {
    var mechanics = BellOptimizer.bellMechanics;
    var rate = Object.assign({}, state.rateInputs, changes && changes.rateInputs || {});
    var methodLevels = cloneArray(changes && changes.methodLevels || state.bellMethodLevels);
    var methods = mechanics.calculateBellImprovementMethods(methodLevels, state.upgrade45Owned);
    var jar11 = changes && finite(changes.jar11Level) ? changes.jar11Level : state.jar11Level;
    var jar36 = changes && finite(changes.jar36Level) ? changes.jar36Level : state.jar36Level;
    var jars = mechanics.calculateRingingJarContribution(jar11, jar36, state.jarLegendTalentLevel);
    var overkills = cloneArray(changes && changes.overkillQuantities || state.overkillQuantities);
    return mechanics.calculateRingingRateBreakdown(Object.assign({}, rate, {
      overkillQuantities: overkills,
      ringingMethodMultiplier: methods.ringingMethodMultiplier,
      jar11Multiplier: jars.jar11Multiplier,
      jar36Multiplier: jars.jar36Multiplier
    }));
  }
  function projection(rate) {
    if (!finite(rate) || rate <= 0) return null;
    var result = BellOptimizer.bellMechanics.advanceRingingProgress({ startingRawRingIndex: 0, startingRingingExp: 0, ringingExpPerHour: rate, durationHours: 2 });
    return result.ok ? result : null;
  }
  function projectionHours(rate, hours) {
    if (!finite(rate) || rate <= 0) return null;
    var result = BellOptimizer.bellMechanics.advanceRingingProgress({ startingRawRingIndex: 0, startingRingingExp: 0, ringingExpPerHour: rate, durationHours: hours });
    return result.ok ? result : null;
  }
  function finalize(candidate, before, after, beforeProjection) {
    candidate.currentTotalBellExpPerHour = before.calculatedRate;
    candidate.projectedBellExpPerHour = after && after.complete ? after.calculatedRate : null;
    candidate.absoluteRateGain = candidate.projectedBellExpPerHour == null ? null : candidate.projectedBellExpPerHour - before.calculatedRate;
    candidate.percentageRateGain = candidate.absoluteRateGain == null ? null : candidate.absoluteRateGain / before.calculatedRate * 100;
    var afterProjection = projection(candidate.projectedBellExpPerHour);
    candidate.projectedFreshRingAfter2Hours = afterProjection ? afterProjection.endingHumanRing : null;
    candidate.additionalBellRollsAfter2Hours = afterProjection && beforeProjection ? afterProjection.ringsCompleted - beforeProjection.ringsCompleted : null;
    candidate.complete = candidate.projectedBellExpPerHour != null && candidate.costResolved !== false;
    candidate.effect = candidate.effect || "Bell Ring";
    candidate.effects = candidate.effects || [candidate.effect];
    candidate.currentAffectedValue = before.calculatedRate;
    candidate.projectedAffectedValue = candidate.projectedBellExpPerHour;
    candidate.absoluteAffectedGain = candidate.projectedAffectedValue == null ? null : candidate.projectedAffectedValue - candidate.currentAffectedValue;
    candidate.affectedPercentageGain = candidate.percentageRateGain;
    candidate.affectedRates = candidate.affectedRates || { "Bell Ring":{ current:candidate.currentAffectedValue, projected:candidate.projectedAffectedValue, gain:candidate.absoluteAffectedGain, percentage:candidate.affectedPercentageGain } };
    return candidate;
  }
  function finalizeMethod(candidate, before, after, beforeProjection, currentMethods, nextMethods, methodIndex) {
    finalize(candidate, before, after, beforeProjection);
    var metadata = BellOptimizer.BELL_METHODS[methodIndex];
    var currentRates = BellOptimizer.bellMechanics.calculateBellActivityRates({ bellMethodQuantities:currentMethods.bellMethodQuantities, monumentMultiplier:before.monumentMultiplier, measurementMultiplier:before.measurementMultiplier, jar11Multiplier:before.jar11Multiplier, jar36Multiplier:before.jar36Multiplier });
    var nextRates = BellOptimizer.bellMechanics.calculateBellActivityRates({ bellMethodQuantities:nextMethods.bellMethodQuantities, monumentMultiplier:before.monumentMultiplier, measurementMultiplier:before.measurementMultiplier, jar11Multiplier:before.jar11Multiplier, jar36Multiplier:before.jar36Multiplier });
    var key = metadata.effect === "Bell Ping" ? "pingExpPerHour" : metadata.effect === "Bell Clean" ? "cleanExpPerHour" : "ringExpPerHour";
    candidate.effect = metadata.effect;
    candidate.affectedUnit = metadata.unit;
    candidate.currentAffectedValue = currentRates[key];
    candidate.projectedAffectedValue = nextRates[key];
    candidate.affectedPercentageGain = currentRates[key] > 0 ? (nextRates[key] / currentRates[key] - 1) * 100 : null;
    candidate.absoluteAffectedGain = nextRates[key] - currentRates[key];
    candidate.effects = [metadata.effect];
    candidate.affectedRates = {}; candidate.affectedRates[metadata.effect] = { current:currentRates[key], projected:nextRates[key], gain:candidate.absoluteAffectedGain, percentage:candidate.affectedPercentageGain };
    if (!metadata.contributesToRing) {
      candidate.projectedFreshRingAfter2Hours = null;
      candidate.additionalBellRollsAfter2Hours = null;
      candidate.additionalBellRollsAfter48Hours = null;
    }
    return candidate;
  }
  function baseCandidate(options) {
    return Object.assign({ currentEffect: null, nextLevelEffect: null, cost: null, costResource: null, ownedResource: null, affordableNow: false, prerequisite: "None", status: "incomplete", costResolved: true }, options);
  }

  function generate(state) {
    if (!state || !Array.isArray(state.bellMethodLevels) || !Array.isArray(state.overkillQuantities)) return { ok: false, error: "Verified Bell-rate candidate inputs are incomplete.", candidates: [] };
    var before = recompute(state, {});
    if (!before.complete) return { ok: false, error: "The verified baseline Bell rate is incomplete.", candidates: [] };
    var beforeProjection = projection(before.calculatedRate);
    var candidates = [];

    state.bellMethodLevels.forEach(function (level, index) {
      var nextLevels = cloneArray(state.bellMethodLevels); nextLevels[index] += 1;
      var currentMethods = BellOptimizer.bellMechanics.calculateBellImprovementMethods(state.bellMethodLevels, state.upgrade45Owned);
      var nextMethods = BellOptimizer.bellMechanics.calculateBellImprovementMethods(nextLevels, state.upgrade45Owned);
      var owned = state.methodOwnedResources[index]; var cost = methodCost(index, level);
      var resourceResolved = finite(owned);
      var methodResource = index === 0 && state.activeCharacterIndex != null ? { name:"Coins (" + (state.activeCharacterName || ("character " + (state.activeCharacterIndex + 1))) + ")", path:"$.data.Money_" + state.activeCharacterIndex } : METHOD_RESOURCES[index];
      var metadata = BellOptimizer.BELL_METHODS[index];
      candidates.push(finalizeMethod(baseCandidate({
        id: "bell-method-" + index, name: metadata.name + " " + index, effect: metadata.effect, system: "Bell Methods",
        levelPath:"$.data.Holes::parsed[16]["+index+"]", effectFormula:"2 × level × max(1, upgrade45Multiplier × HolesInfo[61]["+index+"])", costFormula:METHOD_BASE_COSTS[index]+" × "+METHOD_COST_GROWTH[index]+"^level",
        currentLevel: level, nextLevel: level + 1, currentEffect: currentMethods.bellMethodQuantities[index], nextLevelEffect: nextMethods.bellMethodQuantities[index],
        cost: cost, costResource: methodResource, resourcePoolId:RESOURCE_POOL_IDS[index], purchaseKind:"bell-method", purchaseIndex:index, deterministicPurchase:true, ownedResource: resourceResolved ? owned : null, affordableNow: resourceResolved && owned >= cost,
        prerequisite: index < state.bellMethodsOwned ? "Unlocked" : "Requires additional Bell Methods unlocked", status: index >= state.bellMethodsOwned ? "progression-gated" : resourceResolved ? (owned >= cost ? "directly upgradeable now" : "upgradeable but currently unaffordable") : "incomplete: active character currency is not identified by the export",
        costResolved: resourceResolved
      }), before, recompute(state, { methodLevels: nextLevels }), beforeProjection, currentMethods, nextMethods, index));
    });

    function addRateInput(id, name, system, key, level, status, costDetails) {
      var nextInputs = {}; nextInputs[key] = level + 1;
      var after = recompute(state, { rateInputs: nextInputs });
      var candidate = finalize(baseCandidate(Object.assign({ id: id, name: name, system: system, currentLevel: level, nextLevel: level + 1, currentEffect: level, nextLevelEffect: level + 1, status: status }, costDetails || {})), before, after, beforeProjection);
      candidates.push(candidate);
      return { candidate:candidate, after:after };
    }
    var monument7Candidate = addRateInput("monument-reward-7", "Bravery Monument reward 7", "Monument", "monumentReward7Level", state.rateInputs.monumentReward7Level, "passive or RNG-dependent", { levelPath:"$.data.Holes::parsed[15][7]", effectFormula:"level × max(1, (1 + slot9/100 + Cosmo/100) × (1 + Fountain/100))", costFormula:"No deterministic purchase cost", costResolved: false, prerequisite: "Earned from Bravery Monument story results; no deterministic one-level purchase cost" });
    monument7Candidate.candidate.currentEffect=before.monumentReward7BonusPercent; monument7Candidate.candidate.nextLevelEffect=monument7Candidate.after.monumentReward7BonusPercent;
    var monument9Candidate = addRateInput("monument-slot-9", "Bravery Monument reward 9", "Monument", "monumentSlot9Level", state.rateInputs.monumentSlot9Level, "passive or RNG-dependent", { levelPath:"$.data.Holes::parsed[15][9]", effectFormula:"0.1 × ceil(10 × level/(250+level) × 250 × max(1, Fountain scale))", costFormula:"No deterministic purchase cost", costResolved: false, prerequisite: "Earned from Bravery Monument story results; no deterministic one-level purchase cost" });
    monument9Candidate.candidate.currentEffect=before.monumentSlot9BonusPercent; monument9Candidate.candidate.nextLevelEffect=monument9Candidate.after.monumentSlot9BonusPercent;

    [
      { id:"monument-cosmo", name:"Monument Cosmo scaling", key:"monumentCosmoLevel", type:0, node:0 },
      { id:"measurement-cosmo", name:"Measurement Cosmo scaling", key:"measurementCosmoLevel", type:1, node:3 }
    ].forEach(function (info) {
      var level = state.rateInputs[info.key], max = state.cosmoMaxLevels[info.type][info.node] + 1;
      if (level >= max) {
        var capped = finalize(baseCandidate({ id:info.id, name:info.name, system:"Cosmo", levelPath:"$.data.Holes::parsed["+(4+info.type)+"]["+info.node+"]", effectFormula:"floor(25 × level)", costFormula:"No further purchase", currentLevel:level, nextLevel:null, currentEffect:25*level, nextLevelEffect:null, cost:null, costResource:null, ownedResource:null, affordableNow:false, prerequisite:"Current enhanced cap " + max, status:"Capped", capped:true, deterministicPurchase:false, eligibilityCategory:"Capped" }), before, before, beforeProjection);
        capped.complete = true;
        candidates.push(capped);
      }
      else { var cosmoCandidate=addRateInput(info.id, info.name, "Cosmo", info.key, level, state.cosmoPointsLeft >= 1 ? "directly upgradeable now" : "upgradeable but currently unaffordable", { levelPath:"$.data.Holes::parsed["+(4+info.type)+"]["+info.node+"]", effectFormula:"floor(25 × level)", costFormula:"1 Cosmo point", cost:1, costResource:{name:"Cosmo point",path:"derived from $.data.Holes::parsed[1][2], $.data.GemItemsPurchased::parsed[4], and Cosmo levels"}, ownedResource:state.cosmoPointsLeft, affordableNow:state.cosmoPointsLeft>=1, prerequisite:"Previous Cosmo node owned; enhancement unlocked by $.data.Holes::parsed[5][2] >= 1" }); cosmoCandidate.candidate.currentEffect=25*level; cosmoCandidate.candidate.nextLevelEffect=25*(level+1); }
    });

    var fountainLevel = state.rateInputs.fountainLevel;
    var fountainCost = fountainUpgradeCost(fountainLevel, 250, 2.5);
    var fountainCandidate=addRateInput("fountain-monumental-boost", "Fountain Monumental Boost", "Fountain", "fountainLevel", fountainLevel, state.fountainCurrency >= fountainCost ? "directly upgradeable now" : "upgradeable but currently unaffordable", { levelPath:"$.data.Holes::parsed[31][0][13]", effectFormula:"round(Fountain marble multiplier × level × 1)", costFormula:"250 × 2.5^level", cost:fountainCost, costResource:BellOptimizer.BELL_RATE_RESOURCES.fountainGoldCoins, ownedResource:state.fountainCurrency, affordableNow:state.fountainCurrency>=fountainCost, prerequisite:"Fountain upgrade 18 at level 10 (currently " + state.fountainUnlockLevel + ")" });
    fountainCandidate.candidate.currentEffect=before.monumentFountainBonusPercent; fountainCandidate.candidate.nextLevelEffect=fountainCandidate.after.monumentFountainBonusPercent;
    var marbleLevel = state.rateInputs.fountainMarbleLevel;
    var nextMarbleInputs = { fountainMarbleLevel: marbleLevel + 1 };
    var mCost = marbleCost(0, 13, marbleLevel);
    candidates.push(finalize(baseCandidate({ id:"fountain-monumental-marble", name:"Monumental Boost marble scaling", system:"Fountain", levelPath:"$.data.Holes::parsed[32][0][13]", effectFormula:"level 0: 1; otherwise 1.5 + 0.5 × level", costFormula:"1500 × (10 + 5 × level)^level", currentLevel:marbleLevel, nextLevel:marbleLevel+1, currentEffect:marbleLevel===0?1:1.5+.5*marbleLevel, nextLevelEffect:1.5+.5*(marbleLevel+1), cost:mCost, costResource:{name:"Marble",path:"$.data.Holes::parsed[11][81]"}, ownedResource:state.marbleCurrency, affordableNow:state.marbleCurrency>=mCost, prerequisite:"Marbleization unlocked and upgrade not excluded by HolesInfo[76]", status:state.marbleCurrency>=mCost?"directly upgradeable now":"upgradeable but currently unaffordable" }), before, recompute(state,{rateInputs:nextMarbleInputs}), beforeProjection));

    var measurementLevel = state.rateInputs.measurementLevel;
    var measureCost = measurementCost(2, measurementLevel, state.measurementCostReductionPercent);
    var measurementCandidate=addRateInput("measurement-ringing", "Ringing Measurement", "Measurement", "measurementLevel", measurementLevel, state.measurementCurrency >= measureCost ? "directly upgradeable now" : "upgradeable but currently unaffordable", { effect:"Bell Ring", effects:["Bell Ring","Bell Ping"], levelPath:"$.data.Holes::parsed[22][2]", effectFormula:"(1 + Measurement Cosmo/100) × 10 × level × MeasurementMulti(Death Note/125)", costFormula:"(250 + 50×level) × 1.6^2 × 1.1^level / (1 + Fountain_BonTOT(2,14)/100)", cost:measureCost, costResource:BellOptimizer.BELL_RATE_RESOURCES.cobaltine, ownedResource:state.measurementCurrency, affordableNow:state.measurementCurrency>=measureCost, prerequisite:"Measurement index 2 unlocked by Measurer level" });
    measurementCandidate.candidate.currentEffect=before.measurementBonusPercent; measurementCandidate.candidate.nextLevelEffect=measurementCandidate.after.measurementBonusPercent;
    var measurementMethods=BellOptimizer.bellMechanics.calculateBellImprovementMethods(state.bellMethodLevels,state.upgrade45Owned);
    var currentActivityRates=BellOptimizer.bellMechanics.calculateBellActivityRates({bellMethodQuantities:measurementMethods.bellMethodQuantities,monumentMultiplier:before.monumentMultiplier,measurementMultiplier:before.measurementMultiplier,jar11Multiplier:before.jar11Multiplier,jar36Multiplier:before.jar36Multiplier});
    var nextActivityRates=BellOptimizer.bellMechanics.calculateBellActivityRates({bellMethodQuantities:measurementMethods.bellMethodQuantities,monumentMultiplier:measurementCandidate.after.monumentMultiplier,measurementMultiplier:measurementCandidate.after.measurementMultiplier,jar11Multiplier:measurementCandidate.after.jar11Multiplier,jar36Multiplier:measurementCandidate.after.jar36Multiplier});
    measurementCandidate.candidate.effects=["Bell Ring","Bell Ping"];
    measurementCandidate.candidate.affectedRates["Bell Ping"]={current:currentActivityRates.pingExpPerHour,projected:nextActivityRates.pingExpPerHour,gain:nextActivityRates.pingExpPerHour-currentActivityRates.pingExpPerHour,percentage:(nextActivityRates.pingExpPerHour/currentActivityRates.pingExpPerHour-1)*100};

    state.overkillDetails.worldDetails.forEach(function (world, worldIndex) {
      world.monsterKills.forEach(function (kills, monsterIndex) {
        var threshold = nextDeathNoteThreshold(kills, state.overkillDetails.eclipseSkullUnlocked);
        if (threshold == null) return;
        var currentRank = BellOptimizer.bellMechanics.calculateDeathNoteRank(kills, state.overkillDetails.eclipseSkullUnlocked);
        var nextRank = BellOptimizer.bellMechanics.calculateDeathNoteRank(threshold, state.overkillDetails.eclipseSkullUnlocked);
        var nextOverkills = cloneArray(state.overkillQuantities); nextOverkills[worldIndex] += nextRank-currentRank;
        candidates.push(finalize(baseCandidate({ id:"death-note-w"+(worldIndex+1)+"-m"+monsterIndex, name:(DEATH_NOTE_NAMES[worldIndex][monsterIndex]||("World "+(worldIndex+1)+" monster "+monsterIndex))+" next skull", system:"Death Note", levelPath:"derived from ordered $.data.KLA_n::parsed["+state.overkillDetails.worldDetails[worldIndex].mapIndexes[monsterIndex]+"][0] totals", effectFormula:"next skull points → world OverkillQTY → sum/125 → MeasurementMulti", costFormula:"next finite skull threshold − current ordered kill total", currentLevel:currentRank, nextLevel:nextRank, currentEffect:kills, nextLevelEffect:threshold, cost:Math.max(0,threshold-kills), costResource:{name:"Additional monster kills",path:state.overkillDetails.worldDetails[worldIndex].mapIndexes[monsterIndex]+" in serialized $.data.KLA_n arrays"}, ownedResource:kills, affordableNow:false, prerequisite:"Reach the next finite Death Note skull threshold", status:"progression-gated" }), before, recompute(state,{overkillQuantities:nextOverkills}), beforeProjection));
      });
    });

    [{index:11,key:"jar11Level",name:"Jar collectible 11 (Big Beef Rock)"},{index:36,key:"jar36Level",name:"Jar collectible 36 (Twisted Rupie)"}].forEach(function (jar) {
      var level=state[jar.key], change={}; change[jar.key]=level+1;
      var currentJars=BellOptimizer.bellMechanics.calculateRingingJarContribution(state.jar11Level,state.jar36Level,state.jarLegendTalentLevel);
      var nextJars=BellOptimizer.bellMechanics.calculateRingingJarContribution(jar.index===11?level+1:state.jar11Level,jar.index===36?level+1:state.jar36Level,state.jarLegendTalentLevel);
      candidates.push(finalize(baseCandidate({ id:"jar-"+jar.index, name:jar.name, system:"Jar", levelPath:"$.data.Holes::parsed[24]["+jar.index+"]", effectFormula:"level × HolesInfo[67]["+jar.index+"] bonus × (1 + Legend talent 29/100)", costFormula:"No deterministic targeted cost; random Enchanted Jar result", currentLevel:level, nextLevel:level+1, currentEffect:jar.index===11?currentJars.jar11BonusPercent:currentJars.jar36BonusPercent, nextLevelEffect:jar.index===11?nextJars.jar11BonusPercent:nextJars.jar36BonusPercent, costResolved:false, prerequisite:"Randomly selected when an Enchanted Jar succeeds; no deterministic targeted level cost", status:"passive or RNG-dependent" }), before, recompute(state,change), beforeProjection));
    });
    candidates.forEach(function (candidate) {
      if (candidate.id === "fountain-monumental-boost") Object.assign(candidate,{resourcePoolId:"fountain-currency-2",purchaseKind:"rate-input",purchaseKey:"fountainLevel",deterministicPurchase:true});
      if (candidate.id === "fountain-monumental-marble") Object.assign(candidate,{resourcePoolId:"marble",purchaseKind:"rate-input",purchaseKey:"fountainMarbleLevel",deterministicPurchase:true});
      if (candidate.id === "measurement-ringing") Object.assign(candidate,{resourcePoolId:"holes-9-4",purchaseKind:"rate-input",purchaseKey:"measurementLevel",deterministicPurchase:true});
      if (candidate.id === "monument-cosmo" && !candidate.capped) Object.assign(candidate,{resourcePoolId:"cosmo-points",purchaseKind:"rate-input",purchaseKey:"monumentCosmoLevel",deterministicPurchase:true});
      if (candidate.id === "measurement-cosmo" && !candidate.capped) Object.assign(candidate,{resourcePoolId:"cosmo-points",purchaseKind:"rate-input",purchaseKey:"measurementCosmoLevel",deterministicPurchase:true});
      if (["Monument","Cosmo","Fountain","Measurement","Death Note"].indexOf(candidate.system)!==-1) {
        var sharedMethods=BellOptimizer.bellMechanics.calculateBellImprovementMethods(state.bellMethodLevels,state.upgrade45Owned);
        var sharedCurrent=BellOptimizer.bellMechanics.calculateBellActivityRates({bellMethodQuantities:sharedMethods.bellMethodQuantities,monumentMultiplier:before.monumentMultiplier,measurementMultiplier:before.measurementMultiplier,jar11Multiplier:before.jar11Multiplier,jar36Multiplier:before.jar36Multiplier});
        candidate.effects=["Bell Ring","Bell Ping"];
        candidate.affectedRates=candidate.affectedRates||{};
        if (!candidate.capped && candidate.projectedBellExpPerHour!=null) {
          var projectedPing=sharedCurrent.pingExpPerHour*(candidate.projectedBellExpPerHour/before.calculatedRate);
          candidate.affectedRates["Bell Ping"]={current:sharedCurrent.pingExpPerHour,projected:projectedPing,gain:projectedPing-sharedCurrent.pingExpPerHour,percentage:(projectedPing/sharedCurrent.pingExpPerHour-1)*100};
        }
      }
      candidate.eligibilityCategory = candidate.capped || candidate.status === "currently capped" || candidate.status === "Capped" ? "Capped" : candidate.status === "progression-gated" ? "Progression targets" : candidate.status === "passive or RNG-dependent" ? "RNG-dependent" : candidate.status.indexOf("incomplete") === 0 ? "Incomplete" : candidate.affordableNow ? "Purchasable now" : "Purchasable after obtaining more currency";
      validateCandidate(candidate);
    });
    return { ok:true, baselineRate:before.calculatedRate, baselineFreshProjection:beforeProjection, baseline48HourProjection:projectionHours(before.calculatedRate,48), candidates:candidates };
  }

  return { METHOD_BASE_COSTS:METHOD_BASE_COSTS, METHOD_COST_GROWTH:METHOD_COST_GROWTH, METHOD_RESOURCES:METHOD_RESOURCES, RESOURCE_POOL_IDS:RESOURCE_POOL_IDS, RINGING_METHOD_INDEXES:RINGING_METHOD_INDEXES, nextDeathNoteThreshold:nextDeathNoteThreshold, calculateBellMethodCost:methodCost, calculateMeasurementCost:measurementCost, calculateFountainUpgradeCost:fountainUpgradeCost, calculateMarbleCost:marbleCost, validateCandidate:validateCandidate, recompute:recompute, generate:generate };
}());
