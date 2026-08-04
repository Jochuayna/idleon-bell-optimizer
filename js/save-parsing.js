"use strict";
window.BellOptimizer = window.BellOptimizer || {};

BellOptimizer.saveParsing = (function () {
  var RENEWAL_COST = 25;
  function failure(code, message, path) {
    return { ok: false, error: { code: code, message: message, path: path || null } };
  }

  function calculateNextRingRequiredExp(rawRingIndex) {
    return (5 + 3 * rawRingIndex) * Math.pow(1.05, rawRingIndex);
  }

  function isPlainObject(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    var prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  function parseNestedSaveField(container, fieldName, options) {
    options = options || {};
    var path = options.path || "$.data." + fieldName;
    var parsedPath = options.parsedPath || path + "::parsed";
    var codeName = options.codeName || String(fieldName).replace(/[^A-Za-z0-9]+/g, "_").toUpperCase();
    if (!container || typeof container !== "object" || !Object.prototype.hasOwnProperty.call(container, fieldName)) return failure(options.missingCode || "MISSING_" + codeName, "The save does not contain " + path.replace(/^\$\./, "") + ".", path);
    var raw = container[fieldName];
    var value;
    var representation;
    if (typeof raw === "string") {
      if (!raw.trim()) return failure(options.emptyCode || "EMPTY_" + codeName, path.replace(/^\$\./, "") + " is empty.", path);
      try { value = JSON.parse(raw); }
      catch (error) { return failure(options.invalidSerializedCode || "INVALID_SERIALIZED_" + codeName + "_JSON", path.replace(/^\$\./, "") + " contains invalid serialized JSON: " + error.message, parsedPath); }
      representation = "serialized-string";
    } else if (Array.isArray(raw) || isPlainObject(raw)) {
      value = raw;
      representation = Array.isArray(raw) ? "array" : "plain-object";
    } else return failure(options.unsupportedTypeCode || "UNSUPPORTED_" + codeName + "_TYPE", path.replace(/^\$\./, "") + " must contain an array, object, or JSON-encoded array/object.", path);
    if (!Array.isArray(value) && !isPlainObject(value)) return failure(options.invalidStructureCode || "INVALID_" + codeName + "_STRUCTURE", path.replace(/^\$\./, "") + " does not contain an array or plain object.", parsedPath);
    return { ok: true, value: value, representation: representation, path: path, parsedPath: parsedPath };
  }

  function parseHolesField(data) {
    return parseNestedSaveField(data, "Holes", { path: "$.data.Holes", parsedPath: "$.data.Holes::parsed", codeName: "DATA_HOLES", missingCode: "MISSING_DATA_HOLES", emptyCode: "EMPTY_DATA_HOLES", invalidSerializedCode: "INVALID_SERIALIZED_HOLES_JSON", unsupportedTypeCode: "UNSUPPORTED_DATA_HOLES_TYPE", invalidStructureCode: "INVALID_DATA_HOLES_STRUCTURE" });
  }

  function parseSpelunkField(data) {
    return parseNestedSaveField(data, "Spelunk", { path: "$.data.Spelunk", parsedPath: "$.data.Spelunk::parsed", codeName: "DATA_SPELUNK", missingCode: "MISSING_DATA_SPELUNK", emptyCode: "EMPTY_DATA_SPELUNK", invalidSerializedCode: "INVALID_SERIALIZED_SPELUNK_JSON", unsupportedTypeCode: "UNSUPPORTED_DATA_SPELUNK_TYPE", invalidStructureCode: "INVALID_DATA_SPELUNK_STRUCTURE" });
  }

  function parseBellRewardLevels(outerJsonText) {
    var outer;
    try {
      outer = JSON.parse(outerJsonText);
    } catch (error) {
      return failure("INVALID_OUTER_JSON", "The outer save is not valid JSON: " + error.message, "$");
    }

    if (!outer || typeof outer !== "object" || Array.isArray(outer) || !Object.prototype.hasOwnProperty.call(outer, "data")) {
      return failure("MISSING_DATA", "The outer save does not contain a data object.", "$.data");
    }
    if (!outer.data || typeof outer.data !== "object" || Array.isArray(outer.data)) {
      return failure("MISSING_DATA", "The outer save does not contain a valid data object.", "$.data");
    }
    var holesResult = parseHolesField(outer.data);
    if (!holesResult.ok) return holesResult;
    var holes = holesResult.value;

    var spelunkResult = parseSpelunkField(outer.data);
    if (!spelunkResult.ok) return spelunkResult;
    var spelunk = spelunkResult.value;

    function readNestedNonnegative(container, outerIndex, innerIndex, label, code, rootPath) {
      var arrayPath = rootPath + "[" + outerIndex + "]";
      var path = arrayPath + "[" + innerIndex + "]";
      if (!container || typeof container !== "object" || !Object.prototype.hasOwnProperty.call(container, outerIndex)) return failure("MISSING_" + code + "_ARRAY", label + " array [" + outerIndex + "] is missing.", arrayPath);
      if (!Array.isArray(container[outerIndex])) return failure(code + "_ARRAY_NOT_ARRAY", label + " parent is not an array.", arrayPath);
      if (!Object.prototype.hasOwnProperty.call(container[outerIndex], innerIndex)) return failure("MISSING_" + code, label + " is missing.", path);
      var value = container[outerIndex][innerIndex];
      if (typeof value !== "number") return failure("NONNUMERIC_" + code, label + " is not numeric.", path);
      if (!Number.isFinite(value)) return failure("NONFINITE_" + code, label + " is not finite.", path);
      if (value < 0) return failure("NEGATIVE_" + code, label + " cannot be negative.", path);
      return { ok: true, value: value, path: path };
    }

    if (!holes || typeof holes !== "object" || !Object.prototype.hasOwnProperty.call(holes, 1)) {
      return failure("MISSING_VILLAGER_INDEX_1", "The parsed data.Holes value does not contain first-villager index [1].", "$.data.Holes::parsed[1]");
    }
    if (!Array.isArray(holes[1])) {
      return failure("VILLAGER_INDEX_1_NOT_ARRAY", "The value at parsed data.Holes[1] is not an array.", "$.data.Holes::parsed[1]");
    }
    if (!Object.prototype.hasOwnProperty.call(holes[1], 0)) {
      return failure("MISSING_VILLAGER_INDEX_0", "The parsed data.Holes[1] array does not contain index [0].", "$.data.Holes::parsed[1][0]");
    }
    var villagerLevel0 = holes[1][0];
    if (typeof villagerLevel0 !== "number") {
      return failure("NONNUMERIC_VILLAGER_LEVEL_0", "The first villager level is not numeric.", "$.data.Holes::parsed[1][0]");
    }
    if (!Number.isFinite(villagerLevel0)) {
      return failure("NONFINITE_VILLAGER_LEVEL_0", "The first villager level is not finite.", "$.data.Holes::parsed[1][0]");
    }
    if (villagerLevel0 < 0) {
      return failure("NEGATIVE_VILLAGER_LEVEL_0", "The first villager level cannot be negative.", "$.data.Holes::parsed[1][0]");
    }
    var cavernsOwned = Math.min(18, Math.floor(villagerLevel0));

    if (!holes || typeof holes !== "object" || !Object.prototype.hasOwnProperty.call(holes, 13)) {
      return failure("MISSING_BELL_UPGRADES_INDEX_13", "The parsed data.Holes value does not contain Bell upgrade index [13].", "$.data.Holes::parsed[13]");
    }
    if (!Array.isArray(holes[13])) {
      return failure("BELL_UPGRADES_INDEX_13_NOT_ARRAY", "The value at parsed data.Holes[13] is not an array.", "$.data.Holes::parsed[13]");
    }

    function readUpgradeOwnership(upgradeIndex) {
      var path = "$.data.Holes::parsed[13][" + upgradeIndex + "]";
      if (!Object.prototype.hasOwnProperty.call(holes[13], upgradeIndex)) return failure("MISSING_BELL_UPGRADE_" + upgradeIndex, "Bell upgrade index [13][" + upgradeIndex + "] is missing.", path);
      var rawValue = holes[13][upgradeIndex];
      if (typeof rawValue !== "number") return failure("NONNUMERIC_BELL_UPGRADE_" + upgradeIndex, "Bell upgrade [" + upgradeIndex + "] ownership value is not numeric.", path);
      if (!Number.isFinite(rawValue)) return failure("NONFINITE_BELL_UPGRADE_" + upgradeIndex, "Bell upgrade [" + upgradeIndex + "] ownership value is not finite.", path);
      if (rawValue < 0) return failure("NEGATIVE_BELL_UPGRADE_" + upgradeIndex, "Bell upgrade [" + upgradeIndex + "] ownership value cannot be negative.", path);
      return { ok: true, rawValue: rawValue, owned: rawValue > 0, path: path };
    }

    var upgrade42 = readUpgradeOwnership(42);
    if (!upgrade42.ok) return upgrade42;
    var upgrade45 = readUpgradeOwnership(45);
    if (!upgrade45.ok) return upgrade45;
    var upgrade60 = readUpgradeOwnership(60);
    if (!upgrade60.ok) return upgrade60;
    var upgrade86 = readUpgradeOwnership(86);
    if (!upgrade86.ok) return upgrade86;
    var normalRingGainDetails = BellOptimizer.bellMechanics.calculateNormalRingGainRange(upgrade42.owned, upgrade60.owned);

    if (!Object.prototype.hasOwnProperty.call(holes, 16)) {
      return failure("MISSING_BELL_METHODS_INDEX_16", "The parsed data.Holes value does not contain Bell Improvement Methods index [16].", "$.data.Holes::parsed[16]");
    }
    if (!Array.isArray(holes[16])) {
      return failure("BELL_METHODS_INDEX_16_NOT_ARRAY", "The value at parsed data.Holes[16] is not an array.", "$.data.Holes::parsed[16]");
    }
    var bellMethodLevels = [];
    for (var methodIndex = 0; methodIndex < 6; methodIndex += 1) {
      var methodPath = "$.data.Holes::parsed[16][" + methodIndex + "]";
      if (!Object.prototype.hasOwnProperty.call(holes[16], methodIndex)) return failure("MISSING_BELL_METHOD_LEVEL_" + methodIndex, "Bell Improvement Method level [" + methodIndex + "] is missing.", methodPath);
      var methodLevel = holes[16][methodIndex];
      if (typeof methodLevel !== "number") return failure("NONNUMERIC_BELL_METHOD_LEVEL_" + methodIndex, "Bell Improvement Method level [" + methodIndex + "] is not numeric.", methodPath);
      if (!Number.isFinite(methodLevel)) return failure("NONFINITE_BELL_METHOD_LEVEL_" + methodIndex, "Bell Improvement Method level [" + methodIndex + "] is not finite.", methodPath);
      if (methodLevel < 0) return failure("NEGATIVE_BELL_METHOD_LEVEL_" + methodIndex, "Bell Improvement Method level [" + methodIndex + "] cannot be negative.", methodPath);
      bellMethodLevels.push(methodLevel);
    }
    var bellMethodDetails = BellOptimizer.bellMechanics.calculateBellImprovementMethods(bellMethodLevels, upgrade45.owned);

    if (!holes || typeof holes !== "object" || !Object.prototype.hasOwnProperty.call(holes, 17)) {
      return failure("MISSING_BELL_INDEX_17", "The parsed data.Holes value does not contain index [17].", "$.data.Holes::parsed[17]");
    }
    if (!Array.isArray(holes[17])) {
      return failure("BELL_INDEX_17_NOT_ARRAY", "The value at parsed data.Holes[17] is not an array.", "$.data.Holes::parsed[17]");
    }
    if (holes[17].length < 7) {
      return failure("TOO_FEW_BELL_VALUES", "The Bell reward array contains fewer than seven values.", "$.data.Holes::parsed[17]");
    }

    var values = holes[17].slice(0, 7);
    for (var i = 0; i < values.length; i += 1) {
      if (typeof values[i] !== "number") {
        return failure("NONNUMERIC_BELL_VALUE", "Bell reward value [" + i + "] is not numeric.", "$.data.Holes::parsed[17][" + i + "]");
      }
      if (!Number.isFinite(values[i])) {
        return failure("NONFINITE_BELL_VALUE", "Bell reward value [" + i + "] is not finite.", "$.data.Holes::parsed[17][" + i + "]");
      }
    }

    if (!Object.prototype.hasOwnProperty.call(holes, 18)) {
      return failure("MISSING_RING_INDEX_18", "The parsed data.Holes value does not contain index [18].", "$.data.Holes::parsed[18]");
    }
    if (!Array.isArray(holes[18])) {
      return failure("RING_INDEX_18_NOT_ARRAY", "The value at parsed data.Holes[18] is not an array.", "$.data.Holes::parsed[18]");
    }
    if (!Object.prototype.hasOwnProperty.call(holes[18], 0)) {
      return failure("MISSING_RINGING_EXP_INDEX_0", "The parsed data.Holes[18] array does not contain Ringing progress index [0].", "$.data.Holes::parsed[18][0]");
    }
    var currentRingingExp = holes[18][0];
    if (typeof currentRingingExp !== "number") {
      return failure("NONNUMERIC_CURRENT_RINGING_EXP", "Current Ringing EXP is not numeric.", "$.data.Holes::parsed[18][0]");
    }
    if (!Number.isFinite(currentRingingExp)) {
      return failure("NONFINITE_CURRENT_RINGING_EXP", "Current Ringing EXP is not finite.", "$.data.Holes::parsed[18][0]");
    }
    if (currentRingingExp < 0) {
      return failure("NEGATIVE_CURRENT_RINGING_EXP", "Current Ringing EXP cannot be negative.", "$.data.Holes::parsed[18][0]");
    }
    if (!Object.prototype.hasOwnProperty.call(holes[18], 1)) {
      return failure("MISSING_RING_INDEX_1", "The parsed data.Holes[18] array does not contain index [1].", "$.data.Holes::parsed[18][1]");
    }
    var bellRingIndex = holes[18][1];
    if (typeof bellRingIndex !== "number") {
      return failure("NONNUMERIC_BELL_RING_INDEX", "The Bell ring index is not numeric.", "$.data.Holes::parsed[18][1]");
    }
    if (!Number.isFinite(bellRingIndex)) {
      return failure("NONFINITE_BELL_RING_INDEX", "The Bell ring index is not finite.", "$.data.Holes::parsed[18][1]");
    }
    if (bellRingIndex < 0) {
      return failure("NEGATIVE_BELL_RING_INDEX", "The Bell ring index cannot be negative.", "$.data.Holes::parsed[18][1]");
    }
    if (!Number.isInteger(bellRingIndex)) {
      return failure("NONINTEGER_BELL_RING_INDEX", "The Bell ring index must be a whole zero-based index.", "$.data.Holes::parsed[18][1]");
    }

    function readRenewalValue(index, fieldName, codeName) {
      var path = "$.data.Holes::parsed[18][" + index + "]";
      if (!Object.prototype.hasOwnProperty.call(holes[18], index)) return failure("MISSING_" + codeName, "The parsed data.Holes[18] array does not contain renewal index [" + index + "].", path);
      var value = holes[18][index];
      if (typeof value !== "number") return failure("NONNUMERIC_" + codeName, fieldName + " is not numeric.", path);
      if (!Number.isFinite(value)) return failure("NONFINITE_" + codeName, fieldName + " is not finite.", path);
      if (value < 0) return failure("NEGATIVE_" + codeName, fieldName + " cannot be negative.", path);
      return { ok: true, value: value, path: path };
    }

    function readOptionalActivityValue(index, fieldName, codeName) {
      if (!Object.prototype.hasOwnProperty.call(holes[18], index) || holes[18][index] == null) return { ok:true, value:null, path:"$.data.Holes::parsed[18][" + index + "]", unavailable:true };
      return readRenewalValue(index, fieldName, codeName);
    }
    var pingProgressResult = readOptionalActivityValue(2, "Current Bell Ping progress", "CURRENT_BELL_PING_PROGRESS");
    if (!pingProgressResult.ok) return pingProgressResult;
    var pingIndexResult = readOptionalActivityValue(3, "Bell Ping zero-based index", "BELL_PING_INDEX");
    if (!pingIndexResult.ok) return pingIndexResult;
    var cleanProgressResult = readOptionalActivityValue(4, "Current Bell Clean progress", "CURRENT_BELL_CLEAN_PROGRESS");
    if (!cleanProgressResult.ok) return cleanProgressResult;
    var cleanIndexResult = readRenewalValue(5, "Bell Clean method index", "BELL_CLEAN_INDEX");
    if (!cleanIndexResult.ok) return cleanIndexResult;
    if ((pingIndexResult.value !== null && !Number.isInteger(pingIndexResult.value)) || !Number.isInteger(cleanIndexResult.value)) return failure("NONINTEGER_BELL_ACTIVITY_INDEX", "Bell Ping and Clean indexes must be whole zero-based indexes.", !Number.isInteger(pingIndexResult.value) ? pingIndexResult.path : cleanIndexResult.path);
    var renewalCurrencyResult = readRenewalValue(6, "Current renewal currency", "CURRENT_RENEWAL_CURRENCY");
    if (!renewalCurrencyResult.ok) return renewalCurrencyResult;
    var lifetimeRenewalsResult = readRenewalValue(7, "Lifetime Bell renewals", "LIFETIME_BELL_RENEWALS");
    if (!lifetimeRenewalsResult.ok) return lifetimeRenewalsResult;
    var renewalCurrencyPerHour = 10;
    var currentRenewalCurrency = renewalCurrencyResult.value;
    var lifetimeBellRenewals = lifetimeRenewalsResult.value;
    var immediatelyAvailableRenewals = Math.floor(currentRenewalCurrency / RENEWAL_COST);
    var bellRingNumber = bellRingIndex + 1;
    var nextRingRequiredExp = calculateNextRingRequiredExp(bellRingIndex);
    var remainingExpToNextRing = Math.max(0, nextRingRequiredExp - currentRingingExp);
    var ringProgressFraction = nextRingRequiredExp > 0 ? currentRingingExp / nextRingRequiredExp : 0;
    var ringProgressPercent = ringProgressFraction * 100;
    var ringsUntilMajor = bellRingNumber % 20 === 0 ? 0 : 20 - (bellRingNumber % 20);
    var nextMajorPayoutRing = bellRingNumber + ringsUntilMajor;
    var majorPayoutsCompleted = Math.floor(bellRingNumber / 20);

    if (!Object.prototype.hasOwnProperty.call(holes, 26)) {
      return failure("MISSING_BOLAIA_INDEX_26", "The parsed data.Holes value does not contain index [26].", "$.data.Holes::parsed[26]");
    }
    if (!Array.isArray(holes[26])) {
      return failure("BOLAIA_INDEX_26_NOT_ARRAY", "The value at parsed data.Holes[26] is not an array.", "$.data.Holes::parsed[26]");
    }
    if (!Object.prototype.hasOwnProperty.call(holes[26], 4)) {
      return failure("MISSING_BOLAIA_INDEX_4", "The parsed data.Holes[26] array does not contain index [4].", "$.data.Holes::parsed[26][4]");
    }
    var bolaiaBellStudyLevel = holes[26][4];
    if (typeof bolaiaBellStudyLevel !== "number") {
      return failure("NONNUMERIC_BOLAIA_BELL_STUDY_LEVEL", "The Bolaia Bell study level is not numeric.", "$.data.Holes::parsed[26][4]");
    }
    if (!Number.isFinite(bolaiaBellStudyLevel)) {
      return failure("NONFINITE_BOLAIA_BELL_STUDY_LEVEL", "The Bolaia Bell study level is not finite.", "$.data.Holes::parsed[26][4]");
    }
    if (bolaiaBellStudyLevel < 0) {
      return failure("NEGATIVE_BOLAIA_BELL_STUDY_LEVEL", "The Bolaia Bell study level cannot be negative.", "$.data.Holes::parsed[26][4]");
    }
    var majorBellBonus = bolaiaBellStudyLevel * 20;

    var jar11 = readNestedNonnegative(holes, 24, 11, "Jar collectible 11 level", "JAR_11_LEVEL", "$.data.Holes::parsed");
    if (!jar11.ok) return jar11;
    var jar36 = readNestedNonnegative(holes, 24, 36, "Jar collectible 36 level", "JAR_36_LEVEL", "$.data.Holes::parsed");
    if (!jar36.ok) return jar36;
    var jarLegendTalent = readNestedNonnegative(spelunk, 18, 29, "Jar Legend talent 29 level", "JAR_LEGEND_TALENT_29", "$.data.Spelunk::parsed");
    if (!jarLegendTalent.ok) return jarLegendTalent;
    var jarDetails = BellOptimizer.bellMechanics.calculateRingingJarContribution(jar11.value, jar36.value, jarLegendTalent.value);

    function optionalNestedNumber(container, indexes, rootPath) {
      var current = container;
      var path = rootPath;
      for (var depth = 0; depth < indexes.length; depth += 1) {
        path += "[" + indexes[depth] + "]";
        if (current == null || !Object.prototype.hasOwnProperty.call(current, indexes[depth])) return { ok: false, path: path, reason: "missing" };
        current = current[indexes[depth]];
      }
      if (typeof current !== "number" || !Number.isFinite(current) || current < 0) return { ok: false, path: path, reason: "invalid" };
      return { ok: true, value: current, path: path };
    }
    var rateInputs = {
      monumentReward7Level: optionalNestedNumber(holes, [15, 7], "$.data.Holes::parsed"),
      monumentSlot9Level: optionalNestedNumber(holes, [15, 9], "$.data.Holes::parsed"),
      monumentCosmoLevel: optionalNestedNumber(holes, [4, 0], "$.data.Holes::parsed"),
      fountainLevel: optionalNestedNumber(holes, [31, 0, 13], "$.data.Holes::parsed"),
      fountainMarbleLevel: optionalNestedNumber(holes, [32, 0, 13], "$.data.Holes::parsed"),
      measurementCosmoLevel: optionalNestedNumber(holes, [5, 3], "$.data.Holes::parsed"),
      measurementLevel: optionalNestedNumber(holes, [22, 2], "$.data.Holes::parsed")
    };
    var klaKeys = Object.keys(outer.data).filter(function (key) { return /^KLA_\d+$/.test(key); }).sort(function (a, b) { return Number(a.slice(4)) - Number(b.slice(4)); });
    var killsLeftArrays = []; var klaPaths = []; var klaError = null;
    if (!klaKeys.length) klaError = "No data.KLA_n character arrays were found.";
    klaKeys.forEach(function (key) {
      if (klaError) return;
      var rootPath = "$.data." + key; var path = rootPath + "::parsed";
      var klaResult = parseNestedSaveField(outer.data, key, { path:rootPath, parsedPath:path, codeName:"DATA_" + key });
      if (!klaResult.ok) { klaError = klaResult.error.message + " Path: " + klaResult.error.path; return; }
      if (!Array.isArray(klaResult.value)) { klaError = path + " is not an array."; return; }
      killsLeftArrays.push(klaResult.value); klaPaths.push(path);
    });
    var riftLevelResult = optionalNestedNumber(outer.data, ["Rift", 0], "$.data");
    var overkillDetails = !klaError && riftLevelResult.ok ? BellOptimizer.bellMechanics.calculateOverkillQuantities(killsLeftArrays, riftLevelResult.value) : { ok: false, error: klaError || "Missing or invalid Rift level at $.data.Rift[0]." };
    var unresolvedRateDependencies = Object.keys(rateInputs).filter(function (name) { return !rateInputs[name].ok; }).map(function (name) { return name + " at " + rateInputs[name].path; });
    if (!overkillDetails.ok) unresolvedRateDependencies.push("OverkillQTY(0..6): " + overkillDetails.error);
    var rateDependencyLabels = { monumentReward7Level:"Monument reward 7", monumentSlot9Level:"Monument slot 9", monumentCosmoLevel:"Monument Cosmo", fountainLevel:"Fountain Monumental Boost", fountainMarbleLevel:"Fountain marble scaling", measurementCosmoLevel:"Measurement Cosmo", measurementLevel:"Ringing Measurement" };
    var rateDependencyIssues = Object.keys(rateInputs).filter(function (name) { return !rateInputs[name].ok; }).map(function (name) { return { dependency:rateDependencyLabels[name] || name, status:rateInputs[name].reason === "missing" ? "Missing" : "Invalid", reason:"A required imported progression value could not be verified." }; });
    if (!overkillDetails.ok) rateDependencyIssues.push({ dependency:"Death Note", status:"Incomplete", reason:"Death Note kills-left data is missing or invalid for this save." });
    var ringingRateBreakdown = BellOptimizer.bellMechanics.calculateRingingRateBreakdown({
      monumentReward7Level: rateInputs.monumentReward7Level.ok ? rateInputs.monumentReward7Level.value : NaN,
      monumentSlot9Level: rateInputs.monumentSlot9Level.ok ? rateInputs.monumentSlot9Level.value : NaN,
      monumentCosmoLevel: rateInputs.monumentCosmoLevel.ok ? rateInputs.monumentCosmoLevel.value : NaN,
      fountainLevel: rateInputs.fountainLevel.ok ? rateInputs.fountainLevel.value : NaN,
      fountainMarbleLevel: rateInputs.fountainMarbleLevel.ok ? rateInputs.fountainMarbleLevel.value : NaN,
      measurementCosmoLevel: rateInputs.measurementCosmoLevel.ok ? rateInputs.measurementCosmoLevel.value : NaN,
      measurementLevel: rateInputs.measurementLevel.ok ? rateInputs.measurementLevel.value : NaN,
      overkillQuantities: overkillDetails.ok ? overkillDetails.overkillQuantities : null,
      ringingMethodMultiplier: bellMethodDetails.ringingMethodMultiplier,
      jar11Multiplier: jarDetails.jar11Multiplier,
      jar36Multiplier: jarDetails.jar36Multiplier,
      unresolvedDependencies: unresolvedRateDependencies
    });
    ringingRateBreakdown.dependencyIssues = rateDependencyIssues;

    function numericLike(value) {
      if (typeof value === "number" && Number.isFinite(value)) return value;
      if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
      return null;
    }
    function atNumeric(container, indexes) {
      var current = container;
      for (var ni = 0; ni < indexes.length; ni += 1) {
        if (current == null || !Object.prototype.hasOwnProperty.call(current, indexes[ni])) return null;
        current = current[indexes[ni]];
      }
      return numericLike(current);
    }
    var gemItems = null;
    if (Object.prototype.hasOwnProperty.call(outer.data, "GemItemsPurchased")) {
      var gemItemsResult = parseNestedSaveField(outer.data, "GemItemsPurchased", { path:"$.data.GemItemsPurchased", parsedPath:"$.data.GemItemsPurchased::parsed", codeName:"DATA_GEM_ITEMS_PURCHASED" });
      if (gemItemsResult.ok) gemItems = gemItemsResult.value;
    }
    var cosmoArrays = [holes[4], holes[5], holes[6]];
    var cosmoSpent = cosmoArrays.reduce(function (total, levels) { return total + (Array.isArray(levels) ? levels.reduce(function (sum, level) { return sum + (numericLike(level) || 0); }, 0) : 0); }, 0);
    var cosmoPointsLeft = Math.round((atNumeric(holes, [1, 2]) || 0) + (atNumeric(gemItems, [4]) || 0) - cosmoSpent);
    var measurementCostReductionLevel = atNumeric(holes, [31, 2, 14]);
    var measurementCostReductionMarble = atNumeric(holes, [32, 2, 14]);
    var measurementCostReductionMarbleMultiplier = measurementCostReductionMarble === 0 ? 1 : 1.5 + 0.5 * measurementCostReductionMarble;
    var characterNames = Array.isArray(outer.charNames) ? outer.charNames.slice() : [];
    var coinCharacters = characterNames.map(function (name, index) {
      return { index:index, name:String(name || ("Character " + (index + 1))), path:"$.data.Money_" + index, coins:numericLike(outer.data["Money_" + index]) };
    }).filter(function (character) { return typeof character.coins === "number" && Number.isFinite(character.coins) && character.coins >= 0; });
    var bellRateUpgradeState = {
      rateInputs: {
        monumentReward7Level: rateInputs.monumentReward7Level.value,
        monumentSlot9Level: rateInputs.monumentSlot9Level.value,
        monumentCosmoLevel: rateInputs.monumentCosmoLevel.value,
        fountainLevel: rateInputs.fountainLevel.value,
        fountainMarbleLevel: rateInputs.fountainMarbleLevel.value,
        measurementCosmoLevel: rateInputs.measurementCosmoLevel.value,
        measurementLevel: rateInputs.measurementLevel.value
      },
      bellMethodLevels: bellMethodDetails.bellMethodLevels.slice(), upgrade45Owned: bellMethodDetails.upgrade45Owned,
      bellMethodsOwned: Math.min(6, (atNumeric(holes, [18, 5]) || 0) + 1),
      methodOwnedResources: [null, atNumeric(holes,[9,3]), atNumeric(outer.data,["Gaming",0]), atNumeric(holes,[9,14]), atNumeric(outer.data,["Divinity",39]), atNumeric(holes,[9,25])],
      jar11Level: jar11.value, jar36Level: jar36.value, jarLegendTalentLevel: jarLegendTalent.value,
      overkillQuantities: overkillDetails.ok ? overkillDetails.overkillQuantities.slice() : [], overkillDetails: overkillDetails,
      cosmoPointsLeft: cosmoPointsLeft, cosmoMaxLevels: [[3,4,2,4,4,1,1,1,1],[4,3,2,3,4,3,1,1,1,1,1,1],[1,4,2,4,3,4,1,1,1,1,1,1]],
      fountainCurrency: atNumeric(holes,[9,32]), fountainUnlockLevel: atNumeric(holes,[31,0,18]), marbleCurrency: atNumeric(holes,[11,81]),
      measurementCurrency: atNumeric(holes,[9,4]),
      measurementCostReductionPercent: measurementCostReductionLevel == null || measurementCostReductionMarble == null ? null : Math.round(measurementCostReductionMarbleMultiplier * measurementCostReductionLevel),
      sourcePaths: { gemItemsPurchased:"$.data.GemItemsPurchased::parsed", fountainCurrency:"$.data.Holes::parsed[9][32]", marbleCurrency:"$.data.Holes::parsed[11][81]", measurementCurrency:"$.data.Holes::parsed[9][4]", measurementCostReduction:"$.data.Holes::parsed[31][2][14]" }
    };
    bellRateUpgradeState.coinCharacters = coinCharacters;
    bellRateUpgradeState.activeCharacterIndex = null;
    var bellRateUpgradeCandidates = ringingRateBreakdown.complete && BellOptimizer.bellRateUpgradeCandidates ? BellOptimizer.bellRateUpgradeCandidates.generate(bellRateUpgradeState) : { ok:false, candidates:[] };
    var bellActivityRates = ringingRateBreakdown.complete ? BellOptimizer.bellMechanics.calculateBellActivityRates({ bellMethodQuantities:bellMethodDetails.bellMethodQuantities, monumentMultiplier:ringingRateBreakdown.monumentMultiplier, measurementMultiplier:ringingRateBreakdown.measurementMultiplier, jar11Multiplier:ringingRateBreakdown.jar11Multiplier, jar36Multiplier:ringingRateBreakdown.jar36Multiplier }) : { ok:false, error:"Automatic Bell activity rates require a complete verified Ring reconstruction." };

    var rewards = values.map(function (value, index) {
      var definition = BellOptimizer.BELL_REWARDS[index];
      return { index: index, id: definition.id, name: definition.name, level: value };
    });

    return {
      ok: true,
      data: {
        outerPath: "$.data.Holes",
        parsedPath: "$.data.Holes::parsed[17]",
        displayPath: "data.Holes -> parsed -> [17]",
        bellRingIndexPath: "$.data.Holes::parsed[18][1]",
        bellRingIndexDisplayPath: "data.Holes -> parsed -> [18][1]",
        bellRingIndex: bellRingIndex,
        bellRingNumber: bellRingNumber,
        rawRingIndex: bellRingIndex,
        humanRing: bellRingNumber,
        currentRingingExpPath: "$.data.Holes::parsed[18][0]",
        currentRingingExp: currentRingingExp,
        nextRingRequiredExp: nextRingRequiredExp,
        remainingExpToNextRing: remainingExpToNextRing,
        ringProgressFraction: ringProgressFraction,
        ringProgressPercent: ringProgressPercent,
        ringsUntilMajor: ringsUntilMajor,
        nextMajorPayoutRing: nextMajorPayoutRing,
        majorPayoutsCompleted: majorPayoutsCompleted,
        currentBellPingProgress: pingProgressResult.value,
        currentBellPingProgressPath: pingProgressResult.path,
        bellPingIndex: pingIndexResult.value,
        bellPingIndexPath: pingIndexResult.path,
        currentBellCleanProgress: cleanProgressResult.value,
        currentBellCleanProgressPath: cleanProgressResult.path,
        bellCleanIndex: cleanIndexResult.value,
        bellCleanIndexPath: cleanIndexResult.path,
        renewalCurrencyPerHour: renewalCurrencyPerHour,
        renewalCurrencyPerHourPath: "BellExpPerHR(3) verified constant",
        currentRenewalCurrency: currentRenewalCurrency,
        currentRenewalCurrencyPath: renewalCurrencyResult.path,
        lifetimeBellRenewals: lifetimeBellRenewals,
        lifetimeBellRenewalsPath: lifetimeRenewalsResult.path,
        renewalCost: RENEWAL_COST,
        immediatelyAvailableRenewals: immediatelyAvailableRenewals,
        bolaiaBellStudyLevelPath: "$.data.Holes::parsed[26][4]",
        bolaiaBellStudyLevelDisplayPath: "data.Holes -> parsed -> [26][4]",
        bolaiaBellStudyLevel: bolaiaBellStudyLevel,
        majorBellBonus: majorBellBonus,
        bellUpgrade42RawValue: upgrade42.rawValue,
        bellUpgrade45RawValue: upgrade45.rawValue,
        bellUpgrade60RawValue: upgrade60.rawValue,
        bellUpgrade86RawValue: upgrade86.rawValue,
        bellUpgrade42Owned: upgrade42.owned,
        bellUpgrade45Owned: upgrade45.owned,
        bellUpgrade60Owned: upgrade60.owned,
        bellUpgrade86Owned: upgrade86.owned,
        wholeRingDoubleEnabled: upgrade86.owned,
        normalRingGainDetails: normalRingGainDetails,
        bellUpgrade42Path: upgrade42.path,
        bellUpgrade45Path: upgrade45.path,
        bellUpgrade60Path: upgrade60.path,
        bellUpgrade86Path: upgrade86.path,
        villagerLevel0Path: "$.data.Holes::parsed[1][0]",
        villagerLevel0DisplayPath: "data.Holes -> parsed -> [1][0]",
        villagerLevel0: villagerLevel0,
        cavernsOwned: cavernsOwned,
        bellMethodLevelsPath: "$.data.Holes::parsed[16][0..5]",
        bellMethodLevels: bellMethodDetails.bellMethodLevels,
        totalBellMethodLevels: bellMethodDetails.totalBellMethodLevels,
        upgrade45Owned: bellMethodDetails.upgrade45Owned,
        upgrade45Exponent: bellMethodDetails.upgrade45Exponent,
        upgrade45Multiplier: bellMethodDetails.upgrade45Multiplier,
        bellMethodQuantities: bellMethodDetails.bellMethodQuantities,
        ringingMethodBonusPercent: bellMethodDetails.ringingMethodBonusPercent,
        ringingMethodMultiplier: bellMethodDetails.ringingMethodMultiplier,
        jar11Level: jar11.value,
        jar11LevelPath: jar11.path,
        jar36Level: jar36.value,
        jar36LevelPath: jar36.path,
        jarLegendTalentLevel: jarLegendTalent.value,
        jarLegendTalentLevelPath: jarLegendTalent.path,
        jarLegendBonusPercent: jarDetails.jarLegendBonusPercent,
        jar11BonusPercent: jarDetails.jar11BonusPercent,
        jar36BonusPercent: jarDetails.jar36BonusPercent,
        jar11Multiplier: jarDetails.jar11Multiplier,
        jar36Multiplier: jarDetails.jar36Multiplier,
        combinedRingingJarMultiplier: jarDetails.combinedRingingJarMultiplier,
        ringingRateInputPaths: rateInputs,
        killsLeftArrayPaths: klaPaths,
        riftLevelPath: "$.data.Rift[0]",
        riftLevel: riftLevelResult.ok ? riftLevelResult.value : null,
        overkillDetails: overkillDetails,
        ringingRateBreakdown: ringingRateBreakdown,
        bellActivityRates: bellActivityRates,
        bellRateUpgradeState: bellRateUpgradeState,
        bellRateUpgradeCandidates: bellRateUpgradeCandidates,
        bellRateCoinCharacters: coinCharacters,
        activeCharacterIndex: null,
        values: values,
        rewards: rewards
      }
    };
  }

  return { status: "confirmed-bell-fields-import", RENEWAL_COST: RENEWAL_COST, calculateNextRingRequiredExp: calculateNextRingRequiredExp, parseNestedSaveField: parseNestedSaveField, parseHolesField: parseHolesField, parseSpelunkField: parseSpelunkField, parseBellRewardLevels: parseBellRewardLevels };
}());
