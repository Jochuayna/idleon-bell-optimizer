"use strict";
window.BellOptimizer=window.BellOptimizer||{};
BellOptimizer.bellBenchmarkSnapshot=(function(){
  var VERSION=1;
  function exact(value){return BellOptimizer.bellHistorySnapshot.decimalString(value);}
  function finite(value){return typeof value==="number"&&Number.isFinite(value)&&value>=0;}
  function stable(value){if(Array.isArray(value))return "["+value.map(stable).join(",")+"]";if(value&&typeof value==="object")return "{"+Object.keys(value).sort().map(function(key){return JSON.stringify(key)+":"+stable(value[key]);}).join(",")+"}";return JSON.stringify(value);}
  function hash(text){var a=2166136261,b=2246822519;for(var index=0;index<text.length;index+=1){a=Math.imul(a^text.charCodeAt(index),16777619);b=Math.imul(b+text.charCodeAt(index),3266489917);}return (a>>>0).toString(16).padStart(8,"0")+(b>>>0).toString(16).padStart(8,"0");}
  function build(data,options){
    options=options||{};
    if(!data||!data.bellActivityRates||!data.bellActivityRates.ok)return {ok:false,error:"Verified Bell activity rates are unavailable."};
    var rate=data.ringingRateBreakdown,quantities=data.bellMethodQuantities;
    if(!rate||!rate.complete||!Array.isArray(quantities)||quantities.length<6)return {ok:false,error:"Verified Bell factor data is incomplete."};
    var factors={
      monumentMultiplier:exact(rate.monumentMultiplier),measurementMultiplier:exact(rate.measurementMultiplier),
      ringMethodsMultiplier:exact(1+(quantities[0]+quantities[2]+quantities[4]+quantities[5])/100),
      pingMethodsMultiplier:exact(1+quantities[3]/100),cleanMethodsMultiplier:exact(1+quantities[1]/100),
      jar11Multiplier:exact(data.jar11Multiplier),jar36Multiplier:exact(data.jar36Multiplier)
    };
    var availability={ring:true,ping:true,clean:true,monument:finite(rate.monumentMultiplier),measurement:finite(rate.measurementMultiplier),ringMethods:true,pingMethods:true,cleanMethods:true,jar11:finite(data.jar11Multiplier),jar36:finite(data.jar36Multiplier)};
    var payload={schemaVersion:VERSION,rates:{ringExact:exact(data.bellActivityRates.ringExpPerHour),pingExact:exact(data.bellActivityRates.pingExpPerHour),cleanExact:exact(data.bellActivityRates.cleanExpPerHour),baseRate:"10"},factors:factors,availability:availability};
    var snapshot=Object.assign({schemaVersion:VERSION,id:options.id||("benchmark-"+Date.now()+"-"+Math.random().toString(36).slice(2,10)),alias:String(options.alias||"Benchmark Account").slice(0,120),detectedName:options.detectedName?String(options.detectedName).slice(0,120):null,importedAt:new Date(options.importedAt||Date.now()).toISOString(),fingerprint:"benchmark-"+hash(stable(payload))},payload);
    return {ok:true,snapshot:snapshot};
  }
  function validate(snapshot){
    var errors=[],rateKeys=["ringExact","pingExact","cleanExact","baseRate"],factorKeys=["monumentMultiplier","measurementMultiplier","ringMethodsMultiplier","pingMethodsMultiplier","cleanMethodsMultiplier","jar11Multiplier","jar36Multiplier"];
    if(!snapshot||snapshot.schemaVersion!==VERSION)errors.push("Unsupported benchmark snapshot schema.");
    if(!snapshot||!snapshot.rates||rateKeys.some(function(key){return typeof snapshot.rates[key]!=="string";}))errors.push("Benchmark rates are incomplete.");
    if(!snapshot||!snapshot.factors||factorKeys.some(function(key){return typeof snapshot.factors[key]!=="string";}))errors.push("Benchmark factors are incomplete.");
    if(snapshot&&Object.keys(snapshot).some(function(key){return ["rawJson","rawSave","parsedSave","saveText","Holes","Spelunk","KLA"].indexOf(key)!==-1;}))errors.push("Raw save data is not allowed.");
    return {ok:errors.length===0,errors:errors};
  }
  return {SCHEMA_VERSION:VERSION,build:build,validate:validate};
}());
