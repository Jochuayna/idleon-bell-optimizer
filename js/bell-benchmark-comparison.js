"use strict";
window.BellOptimizer=window.BellOptimizer||{};
BellOptimizer.bellBenchmarkComparison=(function(){
  var FACTORS=[
    {id:"monument",name:"Monument",key:"monumentMultiplier",availabilityKey:"monument",stats:["ring","ping"]},
    {id:"measurement",name:"Measurement",key:"measurementMultiplier",availabilityKey:"measurement",stats:["ring","ping"]},
    {id:"ring-methods",name:"Ring Methods",key:"ringMethodsMultiplier",availabilityKey:"ringMethods",stats:["ring"]},
    {id:"ping-method",name:"Ping Method",key:"pingMethodsMultiplier",availabilityKey:"pingMethods",stats:["ping"]},
    {id:"clean-method",name:"Clean Method",key:"cleanMethodsMultiplier",availabilityKey:"cleanMethods",stats:["clean"]},
    {id:"jar-11",name:"Jar 11",key:"jar11Multiplier",availabilityKey:"jar11",stats:["ring"]},
    {id:"jar-36",name:"Jar 36",key:"jar36Multiplier",availabilityKey:"jar36",stats:["ring"]}
  ];
  function decimal(value){
    var text=String(value).trim().toLowerCase(),match=text.match(/^([+-]?)(\d+)(?:\.(\d*))?(?:e([+-]?\d+))?$/);if(!match)throw new Error("Invalid exact decimal value.");
    var negative=match[1]==="-",whole=match[2],fraction=match[3]||"",exponent=Number(match[4]||0),digits=(whole+fraction).replace(/^0+(?=\d)/,"")||"0",scale=fraction.length-exponent;
    if(scale<0){digits+="0".repeat(-scale);scale=0;}
    var coefficient=BigInt(digits)*(negative?-1n:1n);return {coefficient:coefficient,scale:scale};
  }
  function normalize(value){var coefficient=value.coefficient,scale=value.scale;if(coefficient===0n)return "0";var negative=coefficient<0n;if(negative)coefficient=-coefficient;var digits=coefficient.toString();if(scale){digits=digits.padStart(scale+1,"0");digits=digits.slice(0,-scale)+"."+digits.slice(-scale);digits=digits.replace(/0+$/,"").replace(/\.$/,"");}return (negative?"-":"")+digits;}
  function align(a,b){var scale=Math.max(a.scale,b.scale);return {a:a.coefficient*10n**BigInt(scale-a.scale),b:b.coefficient*10n**BigInt(scale-b.scale),scale:scale};}
  function compareExact(a,b){var pair=align(decimal(a),decimal(b));return pair.a<pair.b?-1:pair.a>pair.b?1:0;}
  function subtract(a,b){var pair=align(decimal(a),decimal(b));return normalize({coefficient:pair.a-pair.b,scale:pair.scale});}
  function multiply(a,b){var left=decimal(a),right=decimal(b);return normalize({coefficient:left.coefficient*right.coefficient,scale:left.scale+right.scale});}
  function ratio(numerator,denominator,places){var top=decimal(numerator),bottom=decimal(denominator);if(bottom.coefficient===0n)return top.coefficient===0n?{kind:"equal-zero",text:"equal"}:{kind:"undefined",text:"not comparable"};if(top.coefficient===0n)return {kind:"finite",numerator:"0",denominator:normalize(bottom),text:"0"};var scaledTop=top.coefficient*10n**BigInt(bottom.scale),scaledBottom=bottom.coefficient*10n**BigInt(top.scale),precision=places===undefined?6:places,quotient=scaledTop*10n**BigInt(precision)/scaledBottom,raw=normalize({coefficient:quotient,scale:precision});return {kind:"finite",numerator:normalize(top),denominator:normalize(bottom),text:raw};}
  function computeRates(model,factorOverride){var factors=Object.assign({},model.factors,factorOverride||{}),base=model.rates.baseRate;return {ring:multiply(multiply(multiply(multiply(multiply(base,factors.monumentMultiplier),factors.measurementMultiplier),factors.ringMethodsMultiplier),factors.jar11Multiplier),factors.jar36Multiplier),ping:multiply(multiply(multiply(base,factors.monumentMultiplier),factors.measurementMultiplier),factors.pingMethodsMultiplier),clean:multiply(base,factors.cleanMethodsMultiplier)};}
  function combinedScenario(user,benchmark,stat,factorIds){
    var definitions=FACTORS.filter(function(item){return item.stats.indexOf(stat)!==-1&&(factorIds===undefined||factorIds.indexOf(item.id)!==-1);});
    if(!definitions.length)return {available:false,error:"No applicable verified factors."};
    var unavailable=definitions.some(function(item){return user.availability[item.availabilityKey]!==true||benchmark.availability[item.availabilityKey]!==true||typeof user.factors[item.key]!=="string"||typeof benchmark.factors[item.key]!=="string";});
    if(unavailable)return {available:false,error:"Combined result unavailable"};
    var override={};definitions.forEach(function(item){override[item.key]=benchmark.factors[item.key];});
    return {available:true,stat:stat,factorIds:definitions.map(function(item){return item.id;}),modeledRate:computeRates(user,override)[stat]};
  }
  function rateComparison(userValue,benchmarkValue){var order=compareExact(benchmarkValue,userValue),gap=order>=0?subtract(benchmarkValue,userValue):subtract(userValue,benchmarkValue);return {user:userValue,benchmark:benchmarkValue,order:order,gap:gap,ratio:order>=0?ratio(benchmarkValue,userValue):ratio(userValue,benchmarkValue),leader:order>0?"benchmark":order<0?"user":"equal"};}
  function compare(user,benchmark){
    var userCheck=BellOptimizer.bellBenchmarkSnapshot.validate(user),benchmarkCheck=BellOptimizer.bellBenchmarkSnapshot.validate(benchmark);if(!userCheck.ok||!benchmarkCheck.ok)return {ok:false,error:"A sanitized Bell comparison model is incomplete."};
    var rates={ring:rateComparison(user.rates.ringExact,benchmark.rates.ringExact),ping:rateComparison(user.rates.pingExact,benchmark.rates.pingExact),clean:rateComparison(user.rates.cleanExact,benchmark.rates.cleanExact)},baseline=computeRates(user),factors=[],rankings={ring:[],ping:[],clean:[]};
    FACTORS.forEach(function(definition){var mine=user.factors[definition.key],theirs=benchmark.factors[definition.key],order=compareExact(theirs,mine),scenarios={},factorRatio=order>=0?ratio(theirs,mine):ratio(mine,theirs);definition.stats.forEach(function(stat){var override={};override[definition.key]=theirs;var modeled=computeRates(user,override)[stat],gain=subtract(modeled,baseline[stat]);scenarios[stat]={modeledRate:modeled,absoluteGain:gain,relativeGain:ratio(modeled,baseline[stat]),multiplierGain:ratio(theirs,mine)};if(order>0&&compareExact(gain,"0")>0)rankings[stat].push({factorId:definition.id,name:definition.name,stat:stat,modeledRate:modeled,absoluteGain:gain,relativeGain:scenarios[stat].relativeGain,multiplierGain:scenarios[stat].multiplierGain});});factors.push({id:definition.id,name:definition.name,key:definition.key,stats:definition.stats.slice(),userValue:mine,benchmarkValue:theirs,order:order,ratio:factorRatio,benchmarkAhead:order>0,scenarios:scenarios});});
    Object.keys(rankings).forEach(function(stat){rankings[stat].sort(function(a,b){return -compareExact(a.absoluteGain,b.absoluteGain);});});
    var combined={};Object.keys(rankings).forEach(function(stat){combined[stat]={listed:combinedScenario(user,benchmark,stat,rankings[stat].slice(0,3).map(function(item){return item.factorId;})),full:combinedScenario(user,benchmark,stat)};});
    return {ok:true,rates:rates,factors:factors,rankings:rankings,combined:combined,userModeledRates:baseline};
  }
  return {FACTORS:FACTORS,compareExact:compareExact,subtract:subtract,multiply:multiply,ratio:ratio,computeRates:computeRates,combinedScenario:combinedScenario,compare:compare};
}());
