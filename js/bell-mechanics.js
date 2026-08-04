"use strict";
window.BellOptimizer = window.BellOptimizer || {};

// The order and per-level effects come from the game bundle, but the save paths are not yet confirmed.
const BELL_REWARDS = Object.freeze([
  Object.freeze({ index: 0, id: "bucket-fill-rate", name: "Bucket Fill Rate", effectPerLevel: 10, unit: "percent" }),
  Object.freeze({ index: 1, id: "all-villager-exp", name: "All Villager EXP", effectPerLevel: 0.5, unit: "percent" }),
  Object.freeze({ index: 2, id: "harp-note-gains", name: "Harp Note Gains", effectPerLevel: 10, unit: "percent" }),
  Object.freeze({ index: 3, id: "daily-lamp-wishes", name: "Daily Lamp Wishes", effectPerLevel: 0.3, unit: "percent" }),
  Object.freeze({ index: 4, id: "extra-rupie-chance", name: "Extra Rupie Chance", effectPerLevel: 0.5, unit: "percent" }),
  Object.freeze({ index: 5, id: "double-torch-chance", name: "Double Torch Chance", effectPerLevel: 2, unit: "percent" }),
  Object.freeze({ index: 6, id: "coins-from-fountain", name: "Coins From Fountain", effectPerLevel: 0.2, unit: "percent" })
]);

BellOptimizer.BELL_REWARDS = BELL_REWARDS;

// Authoritative Bell Improvement Method array order from Holes[16], BellExpPerHR, and BellUpgAfford.
const BELL_METHODS = Object.freeze([
  Object.freeze({ index:0, name:"Bell Ring Method", effect:"Bell Ring", unit:"EXP/hour", resourceName:"Coins", resourcePath:"$.data.Money_<active character>", contributesToRing:true }),
  Object.freeze({ index:1, name:"Bell Clean Method", effect:"Bell Clean", unit:"EXP/hour", resourceName:"Mythril", resourcePath:"$.data.Holes::parsed[9][3]", contributesToRing:false }),
  Object.freeze({ index:2, name:"Bell Ring Method", effect:"Bell Ring", unit:"EXP/hour", resourceName:"Gaming Bits", resourcePath:"$.data.Gaming[0]", contributesToRing:true }),
  Object.freeze({ index:3, name:"Bell Ping Method", effect:"Bell Ping", unit:"EXP/hour", resourceName:"Eighth Note from the Harp", resourcePath:"$.data.Holes::parsed[9][14]", contributesToRing:false }),
  Object.freeze({ index:4, name:"Bell Ring Method", effect:"Bell Ring", unit:"EXP/hour", resourceName:"Atoms", resourcePath:"$.data.Divinity[39]", contributesToRing:true }),
  Object.freeze({ index:5, name:"Bell Ring Method", effect:"Bell Ring", unit:"EXP/hour", resourceName:"Decent Rupie", resourcePath:"$.data.Holes::parsed[9][25]", resourceId:"holes-9-25-decent-rupie-great-jar", contributesToRing:true })
]);
BellOptimizer.BELL_METHODS = BELL_METHODS;

const BELL_RATE_RESOURCES = Object.freeze({
  fountainGoldCoins: Object.freeze({ id:"holes-9-32-fountain-gold-coins", name:"Gold Coins from Fountain", path:"$.data.Holes::parsed[9][32]" }),
  cobaltine: Object.freeze({ id:"holes-9-4-cobaltine-bucket-1", name:"Cobaltine", path:"$.data.Holes::parsed[9][4]", source:"Bucket 1", exactNameVerified:true })
});
BellOptimizer.BELL_RATE_RESOURCES = BELL_RATE_RESOURCES;

// Verified game-version constants from CustomLists.HolesInfo[61].
var BELL_METHOD_MULTIPLIERS = Object.freeze([5, 10, 8, 13, 12, 15]);
// Verified from the local game bundle tables and formulas.
var RINGING_JAR_BASES = Object.freeze({ jar11: 25, jar36: 75, legendTalentPerLevel: 20 });
var RINGING_MONUMENT_STATIC_BASES = Object.freeze({ reward7: 1, reward9: 250 });
var RINGING_MEASUREMENT_CONSTANTS = Object.freeze({ quantityType: 6, staticValue: 10 });
var RINGING_RATE_CONSTANTS = Object.freeze({
  baseRate: 10,
  monumentCosmoPerLevel: 25,
  measurementCosmoPerLevel: 25,
  // CustomLists.HoleFountUPG[0][13][6]. The adjacent [5] value (2.50) is not the effect read by Fountain_BonTOT.
  fountainMonumentBoost: 1,
  measurementQuantityDivisor: 125,
  measurementFirstSlope: 18,
  measurementSecondSlope: 8,
  deathNoteThresholds: Object.freeze([25000, 100000, 250000, 500000, 1000000, 5000000, 100000000, 1000000000])
});
// Verified from CustomLists.DeathNoteMobs, MapAFKtarget, and MapDetails in the local bundle.
var DEATH_NOTE_WORLD_MAP_INDEXES = Object.freeze([
  Object.freeze([1,17,2,14,16,19,24,26,27,28,8,15,13,18,31]),
  Object.freeze([51,52,53,57,58,59,60,62,63,64,65]),
  Object.freeze([101,103,104,105,106,107,108,109,110,111,112,113,116,117]),
  Object.freeze([151,152,153,154,155,156,157,158,159,160,161,162,163]),
  Object.freeze([201,202,203,204,205,206,207,208,209,210,211,212,213]),
  Object.freeze([251,252,253,254,255,256,257,258,259,260,261,262,263,264]),
  Object.freeze([301,302,303,304,305,306,307,308,309,310,311,312,315,316,317,318,319,320,321])
]);
var DEATH_NOTE_MAP_REQUIREMENTS = Object.freeze([
  Object.freeze([21,0,25,50,60,90,120,130,30,0,20000,35000,2500,5000,0]),
  Object.freeze([100,120,150,200,250,300,500,1000,2000,3000,1]),
  Object.freeze([1000,2000,3000,4000,6000,8000,11000,15000,18000,22000,35000,120000,250000,0]),
  Object.freeze([5000,12000,18000,25000,40000,60000,90000,120000,150000,190000,250000,300000,350000]),
  Object.freeze([15000,25000,40000,50000,75000,100000,200000,300000,450000,600000,1000000,3000000,60000]),
  Object.freeze([30000,50000,100000,250000,400000,1100000,3200000,8000000,12000000,25000000,70000000,100000000,150000000,100]),
  Object.freeze([100000,250000,10000000,5000000,20000000,0,250000000,60000000,0,500000000,1000000000,0,2000000,6000000,1000000000,60000000,125000000,250000000,350000000])
]);

function calculateRingingJarContribution(jar11Level, jar36Level, jarLegendTalentLevel) {
  var values = [jar11Level, jar36Level, jarLegendTalentLevel];
  if (!values.every(function (value) { return typeof value === "number" && Number.isFinite(value) && value >= 0; })) return { ok: false, error: "Jar levels and Legend talent level must be finite and nonnegative." };
  var jarLegendBonusPercent = jarLegendTalentLevel * RINGING_JAR_BASES.legendTalentPerLevel;
  var shared = 1 + jarLegendBonusPercent / 100;
  var jar11BonusPercent = jar11Level * RINGING_JAR_BASES.jar11 * shared;
  var jar36BonusPercent = jar36Level * RINGING_JAR_BASES.jar36 * shared;
  var jar11Multiplier = 1 + jar11BonusPercent / 100;
  var jar36Multiplier = 1 + jar36BonusPercent / 100;
  return { ok: true, jarLegendBonusPercent: jarLegendBonusPercent, jar11BonusPercent: jar11BonusPercent, jar36BonusPercent: jar36BonusPercent, jar11Multiplier: jar11Multiplier, jar36Multiplier: jar36Multiplier, combinedRingingJarMultiplier: jar11Multiplier * jar36Multiplier };
}

function calculateMonumentRogBonus(inputs) {
  var sharedScale = 1;
  if (inputs.rewardIndex !== 9) sharedScale = 1 + inputs.slot9BonusPercent / 100 + inputs.cosmoBonusPercent / 100;
  if (inputs.monumentIndex === 0) sharedScale *= 1 + inputs.fountainBonusPercent / 100;
  if (inputs.staticBase < 30) return inputs.level * inputs.staticBase * Math.max(1, sharedScale);
  return 0.1 * Math.ceil(10 * (inputs.level / (250 + inputs.level)) * inputs.staticBase * Math.max(1, sharedScale));
}

function calculateMeasurementBaseBonus(inputs) {
  var cosmoMultiplier = 1 + inputs.cosmoBonusPercent / 100;
  if (typeof inputs.staticValue === "string" && inputs.staticValue.indexOf("TOT") !== -1) return cosmoMultiplier * Number(inputs.staticValue.replace("TOT", "")) * inputs.level / (100 + inputs.level);
  return cosmoMultiplier * Number(inputs.staticValue) * inputs.level;
}

function calculateMeasurementMulti(quantityFound) {
  return quantityFound < 5 ? 1 + 18 * quantityFound / 100 : 1 + (18 * quantityFound + 8 * (quantityFound - 5)) / 100;
}

function calculateCosmoBonus(level, perLevel) {
  if (![level, perLevel].every(function (value) { return typeof value === "number" && Number.isFinite(value) && value >= 0; })) return NaN;
  return Math.floor(level * perLevel);
}

function calculateFountainBonus(level, marbleLevel, staticEffect) {
  if (![level, marbleLevel, staticEffect].every(function (value) { return typeof value === "number" && Number.isFinite(value) && value >= 0; })) return NaN;
  var marbleMultiplier = marbleLevel === 0 ? 1 : 1.5 + 0.5 * marbleLevel;
  return Math.round(marbleMultiplier * level * staticEffect);
}

function calculateDeathNoteRank(kills, eclipseSkullUnlocked) {
  if (typeof kills !== "number" || !Number.isFinite(kills) || kills < 0) return NaN;
  if (kills < 25000) return 0;
  if (kills < 100000) return 1;
  if (kills < 250000) return 2;
  if (kills < 500000) return 3;
  if (kills < 1000000) return 4;
  if (kills < 5000000) return 5;
  if (kills < 100000000) return 7;
  return kills > 1000000000 && eclipseSkullUnlocked ? 20 : 10;
}

function calculateOverkillQuantities(killsLeftArrays, riftLevel) {
  if (!Array.isArray(killsLeftArrays) || killsLeftArrays.length === 0) return { ok: false, error: "At least one parsed KLA character array is required." };
  if (typeof riftLevel !== "number" || !Number.isFinite(riftLevel) || riftLevel < 0) return { ok: false, error: "Rift level must be finite and nonnegative." };
  var requiredMap = Math.max.apply(null, DEATH_NOTE_WORLD_MAP_INDEXES.reduce(function (all, world) { return all.concat(world); }, []));
  for (var character = 0; character < killsLeftArrays.length; character += 1) {
    var array = killsLeftArrays[character];
    if (!Array.isArray(array) || array.length <= requiredMap) return { ok: false, error: "Every KLA character array must contain all required Death Note map indexes." };
  }
  var eclipseSkullUnlocked = riftLevel >= 20;
  var worldDetails = DEATH_NOTE_WORLD_MAP_INDEXES.map(function (mapIndexes, worldIndex) {
    var monsterKills = mapIndexes.map(function (mapIndex, monsterIndex) {
      var requirement = DEATH_NOTE_MAP_REQUIREMENTS[worldIndex][monsterIndex];
      return killsLeftArrays.reduce(function (total, characterArray) {
        var entry = characterArray[mapIndex]; var rawKillsLeft = Array.isArray(entry) ? entry[0] : NaN;
        var killsLeft = typeof rawKillsLeft === "number" ? rawKillsLeft : typeof rawKillsLeft === "string" && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(rawKillsLeft.trim()) ? Number(rawKillsLeft) : NaN;
        if (typeof killsLeft !== "number" || !Number.isFinite(killsLeft)) return NaN;
        return total + requirement - killsLeft;
      }, 0);
    });
    if (monsterKills.some(function (value) { return !Number.isFinite(value); })) return null;
    var ranks = monsterKills.map(function (kills) { return calculateDeathNoteRank(Math.max(0, kills), eclipseSkullUnlocked); });
    return { worldIndex: worldIndex, mapIndexes: mapIndexes.slice(), monsterKills: monsterKills, ranks: ranks, overkillQuantity: ranks.reduce(function (sum, rank) { return sum + rank; }, 0) };
  });
  if (worldDetails.some(function (world) { return world === null; })) return { ok: false, error: "A required KLA map entry is missing or nonnumeric." };
  return { ok: true, riftLevel: riftLevel, eclipseSkullUnlocked: eclipseSkullUnlocked, characterCount: killsLeftArrays.length, worldDetails: worldDetails, overkillQuantities: worldDetails.map(function (world) { return world.overkillQuantity; }) };
}

function calculateRingingRateBreakdown(inputs) {
  var unresolved = Array.isArray(inputs.unresolvedDependencies) ? inputs.unresolvedDependencies.slice() : [];
  var monumentCosmoBonusPercent = calculateCosmoBonus(inputs.monumentCosmoLevel, RINGING_RATE_CONSTANTS.monumentCosmoPerLevel);
  var monumentFountainBonusPercent = calculateFountainBonus(inputs.fountainLevel, inputs.fountainMarbleLevel, RINGING_RATE_CONSTANTS.fountainMonumentBoost);
  var monumentSlot9BonusPercent = calculateMonumentRogBonus({ monumentIndex: 0, rewardIndex: 9, level: inputs.monumentSlot9Level, staticBase: RINGING_MONUMENT_STATIC_BASES.reward9, slot9BonusPercent: 0, cosmoBonusPercent: 0, fountainBonusPercent: monumentFountainBonusPercent });
  var monumentReward7BonusPercent = calculateMonumentRogBonus({ monumentIndex: 0, rewardIndex: 7, level: inputs.monumentReward7Level, staticBase: RINGING_MONUMENT_STATIC_BASES.reward7, slot9BonusPercent: monumentSlot9BonusPercent, cosmoBonusPercent: monumentCosmoBonusPercent, fountainBonusPercent: monumentFountainBonusPercent });
  var monumentMultiplier = 1 + monumentReward7BonusPercent / 100;
  var measurementCosmoBonusPercent = calculateCosmoBonus(inputs.measurementCosmoLevel, RINGING_RATE_CONSTANTS.measurementCosmoPerLevel);
  var overkillsValid = Array.isArray(inputs.overkillQuantities) && inputs.overkillQuantities.length >= 7 && inputs.overkillQuantities.slice(0, 7).every(function (value) { return typeof value === "number" && Number.isFinite(value) && value >= 0; });
  if (!overkillsValid && unresolved.indexOf("OverkillQTY(0..6): per-character KillsLeft2Advance save records") === -1) unresolved.push("OverkillQTY(0..6): per-character KillsLeft2Advance save records");
  var measurementQuantityFound = overkillsValid ? inputs.overkillQuantities.slice(0, 7).reduce(function (sum, value) { return sum + value; }, 0) / RINGING_RATE_CONSTANTS.measurementQuantityDivisor : null;
  var measurementMulti = overkillsValid ? calculateMeasurementMulti(measurementQuantityFound) : null;
  var measurementBaseBonus = calculateMeasurementBaseBonus({ level: inputs.measurementLevel, staticValue: RINGING_MEASUREMENT_CONSTANTS.staticValue, cosmoBonusPercent: measurementCosmoBonusPercent });
  var measurementBonusPercent = overkillsValid ? measurementBaseBonus * measurementMulti : null;
  var measurementMultiplier = overkillsValid ? 1 + measurementBonusPercent / 100 : null;
  var finalRate = calculateRingingExpPerHour({ monumentMultiplier: monumentMultiplier, measurementMultiplier: measurementMultiplier, ringingMethodMultiplier: inputs.ringingMethodMultiplier, jar11Multiplier: inputs.jar11Multiplier, jar36Multiplier: inputs.jar36Multiplier });
  return { ok: unresolved.length === 0 && finalRate.ok, complete: unresolved.length === 0 && finalRate.ok, unresolvedDependencies: unresolved, baseRate: 10, monumentSlot9BonusPercent: monumentSlot9BonusPercent, monumentCosmoBonusPercent: monumentCosmoBonusPercent, monumentFountainBonusPercent: monumentFountainBonusPercent, monumentReward7BonusPercent: monumentReward7BonusPercent, monumentMultiplier: monumentMultiplier, measurementCosmoBonusPercent: measurementCosmoBonusPercent, overkillQuantities: overkillsValid ? inputs.overkillQuantities.slice(0, 7) : null, measurementQuantityFound: measurementQuantityFound, measurementMulti: measurementMulti, measurementBaseBonus: measurementBaseBonus, measurementBonusPercent: measurementBonusPercent, measurementMultiplier: measurementMultiplier, ringingMethodMultiplier: inputs.ringingMethodMultiplier, jar11Multiplier: inputs.jar11Multiplier, jar36Multiplier: inputs.jar36Multiplier, calculatedRate: finalRate.ok && unresolved.length === 0 ? finalRate.value : null };
}

function calculateRingingExpPerHour(factors) {
  var names = ["monumentMultiplier", "measurementMultiplier", "ringingMethodMultiplier", "jar11Multiplier", "jar36Multiplier"];
  var missing = names.filter(function (name) { return typeof factors[name] !== "number" || !Number.isFinite(factors[name]); });
  if (missing.length) return { ok: false, error: "Final Ringing EXP/hour is unavailable because verified dependencies are missing.", missingDependencies: missing };
  return { ok: true, value: 10 * factors.monumentMultiplier * factors.measurementMultiplier * factors.ringingMethodMultiplier * factors.jar11Multiplier * factors.jar36Multiplier };
}

function calculateBellActivityRates(inputs) {
  var quantities=inputs.bellMethodQuantities;
  if(!Array.isArray(quantities)||quantities.length<6)return {ok:false,error:"Six Bell Method quantities are required."};
  var monument=inputs.monumentMultiplier,measurement=inputs.measurementMultiplier;
  if(![monument,measurement].every(function(value){return typeof value==="number"&&Number.isFinite(value)&&value>=0;}))return {ok:false,error:"Verified Monument and Measurement multipliers are required."};
  var jar11=typeof inputs.jar11Multiplier==="number"?inputs.jar11Multiplier:1,jar36=typeof inputs.jar36Multiplier==="number"?inputs.jar36Multiplier:1;
  return {ok:true,ringExpPerHour:10*monument*measurement*(1+(quantities[0]+quantities[2]+quantities[4]+quantities[5])/100)*jar11*jar36,pingExpPerHour:10*monument*measurement*(1+quantities[3]/100),cleanExpPerHour:10*(1+quantities[1]/100),renewalCurrencyPerHour:10};
}

var RINGING_PROGRESSION_ITERATION_LIMIT = 100000;
function calculateRingingRequirement(rawRingIndex) {
  return (5 + 3 * rawRingIndex) * Math.pow(1.05, rawRingIndex);
}

function advanceRingingProgress(inputs) {
  var raw = inputs.startingRawRingIndex;
  var progress = inputs.startingRingingExp;
  var rate = inputs.ringingExpPerHour;
  var duration = inputs.durationHours;
  if (![raw, progress, rate, duration].every(function (value) { return typeof value === "number" && Number.isFinite(value) && value >= 0; }) || !Number.isInteger(raw) || rate <= 0) return { ok: false, error: "Progression inputs must be finite and nonnegative, the raw ring must be a whole index, and Bell EXP per hour must be greater than zero." };
  var available = progress + rate * duration;
  if (!Number.isFinite(available)) return { ok: false, error: "The entered rate and duration produce a value too large to calculate safely." };
  var startRaw = raw, completed = 0, majorRingsCrossed = 0;
  while (true) {
    var requirement = calculateRingingRequirement(raw);
    if (!Number.isFinite(requirement)) return { ok: false, error: "The ring requirement exceeded the calculator's numeric range.", iterationLimitReached: true };
    if (available < requirement) break;
    if (completed >= RINGING_PROGRESSION_ITERATION_LIMIT) return { ok: false, error: "This preview crosses more than " + RINGING_PROGRESSION_ITERATION_LIMIT.toLocaleString() + " rings and was stopped to keep the browser responsive.", iterationLimitReached: true };
    available -= requirement;
    raw += 1; completed += 1;
    if ((raw + 1) % 20 === 0) majorRingsCrossed += 1;
  }
  var endingRequirement = calculateRingingRequirement(raw);
  return { ok: true, startingRawRing: startRaw, endingRawRing: raw, startingHumanRing: startRaw + 1, endingHumanRing: raw + 1, ringsCompleted: completed, endingProgressExp: available, endingRequirementExp: endingRequirement, endingProgressPercent: endingRequirement > 0 ? available / endingRequirement * 100 : 0, majorRingsCrossed: majorRingsCrossed, expAvailable: progress + rate * duration };
}

function calculateBellImprovementMethods(methodLevels, upgrade45Owned) {
  if (!Array.isArray(methodLevels) || methodLevels.length < 6 || !methodLevels.slice(0, 6).every(function (level) { return typeof level === "number" && Number.isFinite(level) && level >= 0; })) {
    return { ok: false, error: "Six finite, nonnegative Bell Improvement Method levels are required." };
  }
  var levels = methodLevels.slice(0, 6);
  var totalBellMethodLevels = levels.reduce(function (sum, level) { return sum + level; }, 0);
  var upgrade45Exponent = Math.floor(totalBellMethodLevels / 25);
  var upgrade45Multiplier = upgrade45Owned ? Math.max(1, Math.pow(1.1, upgrade45Exponent)) : 0;
  var bellMethodQuantities = levels.map(function (level, index) {
    return 2 * level * Math.max(1, upgrade45Multiplier * BELL_METHOD_MULTIPLIERS[index]);
  });
  var ringingMethodBonusPercent = bellMethodQuantities[0] + bellMethodQuantities[2] + bellMethodQuantities[4] + bellMethodQuantities[5];
  return {
    ok: true,
    bellMethodLevels: levels,
    totalBellMethodLevels: totalBellMethodLevels,
    upgrade45Owned: Boolean(upgrade45Owned),
    upgrade45Exponent: upgrade45Exponent,
    upgrade45Multiplier: upgrade45Multiplier,
    bellMethodQuantities: bellMethodQuantities,
    ringingMethodBonusPercent: ringingMethodBonusPercent,
    ringingMethodMultiplier: 1 + ringingMethodBonusPercent / 100
  };
}

function isMajorRing(humanRing) {
  return Number.isFinite(humanRing) && humanRing > 0 && humanRing % 20 === 0;
}

function combineNormalAndMajorGain(normalRingGain, majorBonus, majorRing) {
  return normalRingGain + (majorRing ? majorBonus : 0);
}

function applyDouble(totalGainBeforeDouble, doubleTriggered) {
  return doubleTriggered ? totalGainBeforeDouble * 2 : totalGainBeforeDouble;
}

var UPGRADE_42_EFFECT = 30;
var UPGRADE_60_FALLBACK_EFFECT = 30;
var UPGRADE_60_SPECIAL_TRIGGER_CHANCE = 20;

function calculateFallbackRingExtraDecimal(upgrade42Owned, upgrade60Owned) {
  var upgrade42Contribution = upgrade42Owned ? UPGRADE_42_EFFECT : 0;
  var upgrade60Contribution = upgrade60Owned ? UPGRADE_60_FALLBACK_EFFECT : 0;
  return (upgrade42Contribution + upgrade60Contribution) / 100;
}

function isSpecialThreeLevelOutcomeAvailable(upgrade60Owned) {
  return Boolean(upgrade60Owned);
}

function calculateMinimumPossibleNormalGain(upgrade42Owned, upgrade60Owned) {
  return Math.floor(1 + calculateFallbackRingExtraDecimal(upgrade42Owned, upgrade60Owned));
}

function calculateMaximumPossibleNormalGain(upgrade42Owned, upgrade60Owned) {
  if (isSpecialThreeLevelOutcomeAvailable(upgrade60Owned)) return 3;
  return Math.ceil(1 + calculateFallbackRingExtraDecimal(upgrade42Owned, upgrade60Owned));
}

function calculateNormalRingGainForRandom(upgrade42Owned, upgrade60Owned, randomFloat) {
  if (!Number.isFinite(randomFloat) || randomFloat < 0 || randomFloat >= 1) return { ok: false, error: "randomFloat must be finite and at least 0 but less than 1." };
  var specialTriggered = Boolean(upgrade60Owned) && randomFloat > 0.8;
  var ringExtraLevelDecimal = specialTriggered ? 2 : calculateFallbackRingExtraDecimal(upgrade42Owned, upgrade60Owned);
  return { ok: true, normalRingGain: Math.floor(1 + ringExtraLevelDecimal + randomFloat), ringExtraLevelDecimal: ringExtraLevelDecimal, specialTriggered: specialTriggered };
}

function calculateNormalRingGainRange(upgrade42Owned, upgrade60Owned) {
  return {
    upgrade42Contribution: upgrade42Owned ? UPGRADE_42_EFFECT : 0,
    upgrade60FallbackContribution: upgrade60Owned ? UPGRADE_60_FALLBACK_EFFECT : 0,
    fallbackRingExtraDecimal: calculateFallbackRingExtraDecimal(upgrade42Owned, upgrade60Owned),
    minimumNormalGain: calculateMinimumPossibleNormalGain(upgrade42Owned, upgrade60Owned),
    maximumNormalGain: calculateMaximumPossibleNormalGain(upgrade42Owned, upgrade60Owned),
    specialThreeLevelOutcomeAvailable: isSpecialThreeLevelOutcomeAvailable(upgrade60Owned),
    specialTriggerChance: UPGRADE_60_SPECIAL_TRIGGER_CHANCE
  };
}

function greatestCommonDivisor(a, b) {
  a = Math.abs(a); b = Math.abs(b);
  while (b) { var remainder = a % b; a = b; b = remainder; }
  return a || 1;
}

function fraction(numerator, denominator) {
  if (denominator === 0) throw new Error("Probability denominator cannot be zero.");
  var sign = denominator < 0 ? -1 : 1;
  var divisor = greatestCommonDivisor(numerator, denominator);
  return { numerator: sign * numerator / divisor, denominator: Math.abs(denominator) / divisor };
}

function addFractions(a, b) {
  return fraction(a.numerator * b.denominator + b.numerator * a.denominator, a.denominator * b.denominator);
}

function multiplyFractions(a, b) {
  return fraction(a.numerator * b.numerator, a.denominator * b.denominator);
}

function numberToFraction(value) {
  if (!Number.isFinite(value)) throw new Error("Value must be finite.");
  var text = String(value);
  if (text.indexOf("e") >= 0 || text.indexOf("E") >= 0) {
    var precision = 1000000000;
    return fraction(Math.round(value * precision), precision);
  }
  var parts = text.split(".");
  var denominator = parts.length === 2 ? Math.pow(10, parts[1].length) : 1;
  return fraction(Math.round(value * denominator), denominator);
}

function fractionValue(value) { return value.numerator / value.denominator; }

function probabilityEntry(gain, probability) {
  return { gain: gain, probability: probability, probabilityValue: fractionValue(probability) };
}

function getNormalGainProbabilityDistribution(upgrade42Owned, upgrade60Owned) {
  var fallbackHundredths = (upgrade42Owned ? UPGRADE_42_EFFECT : 0) + (upgrade60Owned ? UPGRADE_60_FALLBACK_EFFECT : 0);
  var fallbackOne = fraction(100 - fallbackHundredths, 100);
  var fallbackTwo = fraction(fallbackHundredths, 100);
  var fallbackBranch = upgrade60Owned ? fraction(80, 100) : fraction(1, 1);
  var specialBranch = upgrade60Owned ? fraction(20, 100) : fraction(0, 1);
  return [
    probabilityEntry(1, multiplyFractions(fallbackBranch, fallbackOne)),
    probabilityEntry(2, multiplyFractions(fallbackBranch, fallbackTwo)),
    probabilityEntry(3, specialBranch)
  ];
}

function expectedValueFromDistribution(distribution) {
  return distribution.reduce(function (total, entry) {
    return addFractions(total, multiplyFractions(numberToFraction(entry.gain), entry.probability));
  }, fraction(0, 1));
}

function getExpectedNormalGain(upgrade42Owned, upgrade60Owned) {
  var exact = expectedValueFromDistribution(getNormalGainProbabilityDistribution(upgrade42Owned, upgrade60Owned));
  return { exact: exact, value: fractionValue(exact) };
}

function getDoubleProbability(doubleEnabled, doubleChancePercent) {
  return doubleEnabled ? multiplyFractions(numberToFraction(doubleChancePercent), fraction(1, 100)) : fraction(0, 1);
}

function applyWholeRingDoubleToDistribution(distribution, doubleEnabled, doubleChancePercent) {
  var doubleProbability = getDoubleProbability(doubleEnabled, doubleChancePercent);
  var noDoubleProbability = addFractions(fraction(1, 1), fraction(-doubleProbability.numerator, doubleProbability.denominator));
  var outcomes = new Map();
  function addOutcome(gain, probability) {
    var key = String(gain);
    var existing = outcomes.get(key) || fraction(0, 1);
    outcomes.set(key, addFractions(existing, probability));
  }
  distribution.forEach(function (entry) {
    addOutcome(entry.gain, multiplyFractions(entry.probability, noDoubleProbability));
    if (doubleProbability.numerator > 0) addOutcome(entry.gain * 2, multiplyFractions(entry.probability, doubleProbability));
  });
  return Array.from(outcomes.entries()).map(function (pair) { return probabilityEntry(Number(pair[0]), pair[1]); }).filter(function (entry) { return entry.probability.numerator !== 0; }).sort(function (a, b) { return a.gain - b.gain; });
}

function getExpectedGainAfterWholeRingDouble(upgrade42Owned, upgrade60Owned, doubleEnabled, doubleChancePercent) {
  var distribution = applyWholeRingDoubleToDistribution(getNormalGainProbabilityDistribution(upgrade42Owned, upgrade60Owned), doubleEnabled, doubleChancePercent);
  var exact = expectedValueFromDistribution(distribution);
  return { exact: exact, value: fractionValue(exact) };
}

function getMajorRingOutcomeDistribution(upgrade42Owned, upgrade60Owned, majorBonus, doubleEnabled, doubleChancePercent) {
  if (!Number.isFinite(majorBonus) || majorBonus < 0) return { ok: false, error: "Major bonus must be finite and nonnegative." };
  var beforeDouble = getNormalGainProbabilityDistribution(upgrade42Owned, upgrade60Owned).map(function (entry) { return probabilityEntry(majorBonus + entry.gain, entry.probability); });
  var afterDouble = applyWholeRingDoubleToDistribution(beforeDouble, doubleEnabled, doubleChancePercent);
  return { ok: true, beforeDouble: beforeDouble, afterDouble: afterDouble };
}

function getExpectedMajorRingGain(upgrade42Owned, upgrade60Owned, majorBonus, doubleEnabled, doubleChancePercent) {
  var distributions = getMajorRingOutcomeDistribution(upgrade42Owned, upgrade60Owned, majorBonus, doubleEnabled, doubleChancePercent);
  if (!distributions.ok) return distributions;
  var beforeExact = expectedValueFromDistribution(distributions.beforeDouble);
  var afterExact = expectedValueFromDistribution(distributions.afterDouble);
  return { ok: true, beforeDouble: { exact: beforeExact, value: fractionValue(beforeExact) }, afterDouble: { exact: afterExact, value: fractionValue(afterExact) } };
}

function validateCavernCount(cavernsOwned) {
  if (typeof cavernsOwned !== "number" || !Number.isFinite(cavernsOwned)) return { ok: false, error: "Caverns owned must be a finite number." };
  if (cavernsOwned < 0) return { ok: false, error: "Caverns owned cannot be negative." };
  return { ok: true, value: cavernsOwned };
}

function getHighestAvailableRewardIndex(cavernsOwned) {
  var validation = validateCavernCount(cavernsOwned);
  if (!validation.ok) return validation;
  return { ok: true, value: cavernsOwned >= 16 ? 6 : cavernsOwned >= 11 ? 5 : 3 };
}

function getAvailableRewards(cavernsOwned) {
  var highest = getHighestAvailableRewardIndex(cavernsOwned);
  if (!highest.ok) return highest;
  return { ok: true, highestAvailableIndex: highest.value, rewards: BELL_REWARDS.slice(0, highest.value + 1) };
}

function getRewardSelectionProbabilities(cavernsOwned) {
  var available = getAvailableRewards(cavernsOwned);
  if (!available.ok) return available;
  var availableCount = available.rewards.length;
  return {
    ok: true,
    highestAvailableIndex: available.highestAvailableIndex,
    availableCount: availableCount,
    rewards: BELL_REWARDS.map(function (reward) {
      var isAvailable = reward.index <= available.highestAvailableIndex;
      var exactProbability = isAvailable ? fraction(1, availableCount) : fraction(0, 1);
      return { index: reward.index, id: reward.id, name: reward.name, available: isAvailable, probability: exactProbability, probabilityValue: fractionValue(exactProbability) };
    })
  };
}

function calculatePossibleFinalGainRanges(inputs) {
  var minimumNormalGain = Number(inputs.minimumNormalGain);
  var maximumNormalGain = Number(inputs.maximumNormalGain);
  var majorBonus = Number(inputs.majorBonus);
  var doubleEnabled = Boolean(inputs.doubleEnabled);
  var doubleChance = Number(inputs.doubleChance);
  var values = [minimumNormalGain, maximumNormalGain, majorBonus, doubleChance];
  if (!values.every(Number.isFinite) || minimumNormalGain < 0 || maximumNormalGain < minimumNormalGain || majorBonus < 0 || doubleChance < 0 || doubleChance > 100) {
    return { ok: false, error: "Manual gain inputs must be finite and nonnegative; maximum gain must be at least minimum gain; double chance must be between 0 and 100." };
  }
  var normalMajorRange = {
    minimum: combineNormalAndMajorGain(minimumNormalGain, majorBonus, true),
    maximum: combineNormalAndMajorGain(maximumNormalGain, majorBonus, true)
  };
  var doubledMajorRange = {
    minimum: applyDouble(normalMajorRange.minimum, true),
    maximum: applyDouble(normalMajorRange.maximum, true)
  };
  return {
    ok: true,
    normalRingRange: { minimum: minimumNormalGain, maximum: maximumNormalGain },
    normalMajorRange: normalMajorRange,
    doubledMajorRange: doubledMajorRange,
    possibleMajorFinalRange: doubleEnabled && doubleChance > 0 ? { minimum: normalMajorRange.minimum, maximum: doubledMajorRange.maximum } : normalMajorRange,
    doubleEnabled: doubleEnabled,
    doubleChance: doubleChance
  };
}

BellOptimizer.bellMechanics = {
  status: "verified-ring-award-functions",
  BELL_REWARDS: BELL_REWARDS,
  BELL_METHOD_MULTIPLIERS: BELL_METHOD_MULTIPLIERS,
  RINGING_JAR_BASES: RINGING_JAR_BASES,
  RINGING_MONUMENT_STATIC_BASES: RINGING_MONUMENT_STATIC_BASES,
  RINGING_MEASUREMENT_CONSTANTS: RINGING_MEASUREMENT_CONSTANTS,
  calculateRingingJarContribution: calculateRingingJarContribution,
  calculateMonumentRogBonus: calculateMonumentRogBonus,
  calculateMeasurementBaseBonus: calculateMeasurementBaseBonus,
  calculateMeasurementMulti: calculateMeasurementMulti,
  calculateCosmoBonus: calculateCosmoBonus,
  calculateFountainBonus: calculateFountainBonus,
  calculateDeathNoteRank: calculateDeathNoteRank,
  calculateOverkillQuantities: calculateOverkillQuantities,
  DEATH_NOTE_WORLD_MAP_INDEXES: DEATH_NOTE_WORLD_MAP_INDEXES,
  DEATH_NOTE_MAP_REQUIREMENTS: DEATH_NOTE_MAP_REQUIREMENTS,
  calculateRingingRateBreakdown: calculateRingingRateBreakdown,
  RINGING_RATE_CONSTANTS: RINGING_RATE_CONSTANTS,
  calculateRingingExpPerHour: calculateRingingExpPerHour,
  calculateBellActivityRates: calculateBellActivityRates,
  RINGING_PROGRESSION_ITERATION_LIMIT: RINGING_PROGRESSION_ITERATION_LIMIT,
  calculateRingingRequirement: calculateRingingRequirement,
  advanceRingingProgress: advanceRingingProgress,
  calculateBellImprovementMethods: calculateBellImprovementMethods,
  isMajorRing: isMajorRing,
  combineNormalAndMajorGain: combineNormalAndMajorGain,
  applyDouble: applyDouble,
  UPGRADE_42_EFFECT: UPGRADE_42_EFFECT,
  UPGRADE_60_FALLBACK_EFFECT: UPGRADE_60_FALLBACK_EFFECT,
  UPGRADE_60_SPECIAL_TRIGGER_CHANCE: UPGRADE_60_SPECIAL_TRIGGER_CHANCE,
  calculateFallbackRingExtraDecimal: calculateFallbackRingExtraDecimal,
  calculateMinimumPossibleNormalGain: calculateMinimumPossibleNormalGain,
  calculateMaximumPossibleNormalGain: calculateMaximumPossibleNormalGain,
  isSpecialThreeLevelOutcomeAvailable: isSpecialThreeLevelOutcomeAvailable,
  calculateNormalRingGainForRandom: calculateNormalRingGainForRandom,
  calculateNormalRingGainRange: calculateNormalRingGainRange,
  getNormalGainProbabilityDistribution: getNormalGainProbabilityDistribution,
  getExpectedNormalGain: getExpectedNormalGain,
  applyWholeRingDoubleToDistribution: applyWholeRingDoubleToDistribution,
  getExpectedGainAfterWholeRingDouble: getExpectedGainAfterWholeRingDouble,
  getMajorRingOutcomeDistribution: getMajorRingOutcomeDistribution,
  getExpectedMajorRingGain: getExpectedMajorRingGain,
  validateCavernCount: validateCavernCount,
  getHighestAvailableRewardIndex: getHighestAvailableRewardIndex,
  getAvailableRewards: getAvailableRewards,
  getRewardSelectionProbabilities: getRewardSelectionProbabilities,
  fractionValue: fractionValue,
  calculatePossibleFinalGainRanges: calculatePossibleFinalGainRanges
};
