"use strict";
window.BellOptimizer = window.BellOptimizer || {};

BellOptimizer.bellRateScenario = (function () {
  var SCHEMA_VERSION = 1;
  var ATTAINABILITY = "RNG_MANUAL_SCENARIO";
  var JAR_WARNING = "Projected Ring Rate is mechanically valid, but this scenario does not estimate the probability, Tall Jar count, or time required to reach this collectible level.";
  var NAME_WARNING = "Jar labels retain the current production names (Big Beef Rock and Twisted Rupie); alternate names still require confirmation.";

  function finite(value) { return typeof value === "number" && Number.isFinite(value); }
  function safeLevel(value) { return finite(value) && Number.isSafeInteger(value) && value >= 0; }
  function failure(code, message, details) { return { ok:false, schemaVersion:SCHEMA_VERSION, error:{ code:code, message:message, details:details || null } }; }
  function cloneCalculationState(state) {
    return {
      rateInputs:Object.assign({}, state.rateInputs),
      bellMethodLevels:state.bellMethodLevels.slice(0, 6),
      upgrade45Owned:Boolean(state.upgrade45Owned),
      jar11Level:state.jar11Level,
      jar36Level:state.jar36Level,
      jarLegendTalentLevel:state.jarLegendTalentLevel,
      overkillQuantities:state.overkillQuantities.slice(0, 7)
    };
  }
  function validateBaseState(state) {
    if (!state || typeof state !== "object" || Array.isArray(state)) return failure("MISSING_BASE_STATE", "A valid imported Bell-rate calculation state is required.");
    if (!state.rateInputs || typeof state.rateInputs !== "object") return failure("MISSING_RATE_INPUTS", "The imported Bell-rate inputs are missing.");
    var rateKeys=["monumentReward7Level","monumentSlot9Level","monumentCosmoLevel","fountainLevel","fountainMarbleLevel","measurementCosmoLevel","measurementLevel"];
    if (!rateKeys.every(function (key) { return finite(state.rateInputs[key]) && state.rateInputs[key] >= 0; })) return failure("INVALID_RATE_INPUTS", "The imported Bell-rate inputs are incomplete or invalid.");
    if (!Array.isArray(state.bellMethodLevels) || state.bellMethodLevels.length < 6 || !state.bellMethodLevels.slice(0,6).every(safeLevel)) return failure("INVALID_METHOD_LEVELS", "Six valid Bell Method levels are required.");
    if (!safeLevel(state.jar11Level) || !safeLevel(state.jar36Level)) return failure("MISSING_JAR_DATA", "Valid imported Jar 11 and Jar 36 levels are required.");
    if (!safeLevel(state.jarLegendTalentLevel)) return failure("MISSING_JAR_LEGEND_SCALING", "A valid imported Jar Legend scaling level is required.");
    if (!Array.isArray(state.overkillQuantities) || state.overkillQuantities.length < 7 || !state.overkillQuantities.slice(0,7).every(function (value) { return finite(value) && value >= 0; })) return failure("INVALID_MEASUREMENT_DATA", "Seven valid Death Note quantities are required for the canonical Ring-rate calculation.");
    return { ok:true };
  }
  function validateTarget(value, key) {
    if (!finite(value)) return failure("NONFINITE_OVERRIDE", key + " must be a finite number.", { override:key });
    if (!Number.isSafeInteger(value)) return failure("UNSAFE_OVERRIDE", key + " must be a safe whole-number level.", { override:key });
    if (value < 0) return failure("NEGATIVE_OVERRIDE", key + " cannot be negative.", { override:key });
    return { ok:true };
  }
  var OVERRIDES = Object.freeze({
    jar11Level:Object.freeze({ candidateId:"jar11", source:"Jar collectible 11 (Big Beef Rock)", path:"$.data.Holes::parsed[24][11]" }),
    jar36Level:Object.freeze({ candidateId:"jar36", source:"Jar collectible 36 (Twisted Rupie)", path:"$.data.Holes::parsed[24][36]" })
  });
  function factors(rate) {
    return { baseRate:rate.baseRate, monumentMultiplier:rate.monumentMultiplier, measurementMultiplier:rate.measurementMultiplier, ringMethodsMultiplier:rate.ringingMethodMultiplier, jar11Multiplier:rate.jar11Multiplier, jar36Multiplier:rate.jar36Multiplier };
  }
  function evaluate(input) {
    input=input || {};
    var stateCheck=validateBaseState(input.baseState); if(!stateCheck.ok)return stateCheck;
    var requested=input.overrides == null ? {} : input.overrides;
    if (!requested || typeof requested !== "object" || Array.isArray(requested)) return failure("INVALID_OVERRIDES", "Scenario overrides must be an object.");
    var unknown=Object.keys(requested).filter(function(key){return !Object.prototype.hasOwnProperty.call(OVERRIDES,key);});
    if(unknown.length)return failure("UNSUPPORTED_OVERRIDE", "This scenario contains an unsupported override.", { overrides:unknown });
    var projectedState=cloneCalculationState(input.baseState), overrideResults=[];
    var keys=Object.keys(OVERRIDES).filter(function(key){return requested[key] !== undefined;});
    for(var index=0;index<keys.length;index+=1){
      var key=keys[index], check=validateTarget(requested[key],key); if(!check.ok)return check;
      var definition=OVERRIDES[key], current=projectedState[key], target=requested[key];
      projectedState[key]=target;
      overrideResults.push({ candidateId:definition.candidateId, source:definition.source, sourcePath:definition.path, currentValue:current, targetValue:target, delta:target-current, attainability:ATTAINABILITY, hypotheticalDowngrade:target<current, warnings:[JAR_WARNING].concat(target<current?["This lower-level result is hypothetical; the collectible cannot be downgraded through this scenario."]:[]) });
    }
    var baseline=BellOptimizer.bellRateUpgradeCandidates.recompute(cloneCalculationState(input.baseState),{});
    if(!baseline || !baseline.complete || !finite(baseline.calculatedRate))return failure("INVALID_BASE_RATE", "The imported state could not produce a complete verified Bell Ring Rate.");
    var projected=BellOptimizer.bellRateUpgradeCandidates.recompute(projectedState,{});
    if(!projected || !projected.complete || !finite(projected.calculatedRate))return failure("UNSAFE_PROJECTED_RATE", "The hypothetical values produced an incomplete or numerically unsafe Bell Ring Rate.");
    var absoluteGain=projected.calculatedRate-baseline.calculatedRate;
    var relativeGain=baseline.calculatedRate===0?(absoluteGain===0?0:null):absoluteGain/baseline.calculatedRate;
    return { ok:true, schemaVersion:SCHEMA_VERSION, currentRate:baseline.calculatedRate, projectedRate:projected.calculatedRate, absoluteGain:absoluteGain, relativeGain:relativeGain, overrides:overrideResults, currentFactors:factors(baseline), projectedFactors:factors(projected), assumptions:["Jar targets are hypothetical manual inputs.","All non-overridden imported Bell-rate mechanics remain fixed."], warnings:keys.length?[JAR_WARNING,NAME_WARNING]:[], diagnostics:{scenarioRecomputations:2,canonicalRateFormulaCalls:2} };
  }
  function searchSingleJarTarget(input) {
    input=input || {};
    var key=input.jarId === "jar11" ? "jar11Level" : input.jarId === "jar36" ? "jar36Level" : null;
    if(!key)return failure("INVALID_JAR_ID", "Select jar11 or jar36 for a single-Jar target search.");
    if(!finite(input.targetRate) || input.targetRate < 0)return failure("INVALID_TARGET_RATE", "Target Bell Ring Rate must be finite and nonnegative.");
    var stateCheck=validateBaseState(input.baseState);if(!stateCheck.ok)return stateCheck;
    var maxCheck=validateTarget(input.maximumJarLevel,"maximumJarLevel");if(!maxCheck.ok)return maxCheck;
    var current=input.baseState[key];
    if(input.maximumJarLevel<current)return failure("MAXIMUM_BELOW_CURRENT", "The hypothetical maximum Jar level cannot be below the imported current level.");
    var currentResult=evaluate({baseState:input.baseState,overrides:{}});if(!currentResult.ok)return currentResult;
    var common={ok:true,schemaVersion:SCHEMA_VERSION,jarId:input.jarId,currentRate:currentResult.currentRate,targetRate:input.targetRate,attainability:ATTAINABILITY,assumptions:["The maximum Jar level is a user-supplied hypothetical bound."],warnings:[JAR_WARNING,NAME_WARNING]};
    if(currentResult.currentRate>=input.targetRate)return Object.assign(common,{reachableUnderScenario:true,minimumJarLevel:current,projectedRate:currentResult.currentRate,overshoot:currentResult.currentRate-input.targetRate,searchBounds:{minimum:current,maximum:input.maximumJarLevel},diagnostics:{binarySearchIterations:0,scenarioEvaluations:1}});
    var maximumResult=evaluate({baseState:input.baseState,overrides:(function(){var value={};value[key]=input.maximumJarLevel;return value;}())});
    if(!maximumResult.ok)return maximumResult;
    if(maximumResult.projectedRate<input.targetRate)return Object.assign(common,{reachableUnderScenario:false,minimumJarLevel:null,projectedRate:maximumResult.projectedRate,overshoot:null,searchBounds:{minimum:current,maximum:input.maximumJarLevel},diagnostics:{binarySearchIterations:0,scenarioEvaluations:2}});
    var low=current+1,high=input.maximumJarLevel,iterations=0,evaluations=2,best=null;
    while(low<=high){var middle=low+Math.floor((high-low)/2),overrides={};overrides[key]=middle;var result=evaluate({baseState:input.baseState,overrides:overrides});evaluations+=1;if(!result.ok)return result;iterations+=1;if(result.projectedRate>=input.targetRate){best={level:middle,rate:result.projectedRate};high=middle-1;}else low=middle+1;}
    return Object.assign(common,{reachableUnderScenario:true,minimumJarLevel:best.level,projectedRate:best.rate,overshoot:best.rate-input.targetRate,searchBounds:{minimum:current,maximum:input.maximumJarLevel},diagnostics:{binarySearchIterations:iterations,scenarioEvaluations:evaluations}});
  }
  return { SCHEMA_VERSION:SCHEMA_VERSION, ATTAINABILITY:ATTAINABILITY, OVERRIDES:OVERRIDES, evaluate:evaluate, searchSingleJarTarget:searchSingleJarTarget, validateBaseState:validateBaseState };
}());
