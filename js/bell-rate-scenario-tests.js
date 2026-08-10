"use strict";
window.BellOptimizer = window.BellOptimizer || {};

BellOptimizer.runBellRateScenarioTests = function () {
  var api=BellOptimizer.bellRateScenario,tests=[];
  function test(name,run){tests.push({name:name,run:run});}
  function close(a,b,tolerance){return Math.abs(a-b)<=Math.max(1,Math.abs(b))*(tolerance||1e-12);}
  function state(changes){var value={rateInputs:{monumentReward7Level:100,monumentSlot9Level:20,monumentCosmoLevel:2,fountainLevel:4,fountainMarbleLevel:1,measurementCosmoLevel:2,measurementLevel:30},bellMethodLevels:[10,10,10,10,10,10],upgrade45Owned:true,jar11Level:5,jar36Level:8,jarLegendTalentLevel:2,overkillQuantities:[10,12,14,16,18,20,22]};return Object.assign(value,changes||{});}
  function direct(s,j11,j36){return BellOptimizer.bellRateUpgradeCandidates.recompute(Object.assign({},s,{jar11Level:j11,jar36Level:j36}),{}).calculatedRate;}
  test("scenario no overrides",function(){var s=state(),r=api.evaluate({baseState:s});return r.ok&&r.projectedRate===r.currentRate&&r.absoluteGain===0&&r.relativeGain===0&&r.overrides.length===0;});
  test("Jar 11 override",function(){var s=state(),r=api.evaluate({baseState:s,overrides:{jar11Level:9}});return r.ok&&r.overrides[0].candidateId==="jar11"&&r.projectedRate===direct(s,9,8);});
  test("Jar 36 override",function(){var s=state(),r=api.evaluate({baseState:s,overrides:{jar36Level:12}});return r.ok&&r.overrides[0].candidateId==="jar36"&&r.projectedRate===direct(s,5,12);});
  test("combined Jars use one full recomputation",function(){var s=state(),both=api.evaluate({baseState:s,overrides:{jar11Level:9,jar36Level:12}}),a=api.evaluate({baseState:s,overrides:{jar11Level:9}}),b=api.evaluate({baseState:s,overrides:{jar36Level:12}});return both.ok&&both.projectedRate===direct(s,9,12)&&!close(both.absoluteGain,a.absoluteGain+b.absoluteGain,1e-15);});
  test("target equal current",function(){var s=state(),r=api.evaluate({baseState:s,overrides:{jar11Level:5}});return r.projectedRate===r.currentRate&&r.absoluteGain===0&&r.relativeGain===0;});
  test("lower target remains hypothetical",function(){var r=api.evaluate({baseState:state(),overrides:{jar36Level:2}});return r.ok&&r.absoluteGain<0&&r.overrides[0].hypotheticalDowngrade&&r.overrides[0].warnings.some(function(x){return /cannot be downgraded/i.test(x);});});
  test("higher target increases rate",function(){var r=api.evaluate({baseState:state(),overrides:{jar36Level:9}});return r.ok&&r.absoluteGain>0;});
  test("large safe target is contained",function(){var r=api.evaluate({baseState:state(),overrides:{jar11Level:Number.MAX_SAFE_INTEGER}});return r.ok||r.error.code==="UNSAFE_PROJECTED_RATE";});
  test("negative target rejected",function(){return api.evaluate({baseState:state(),overrides:{jar11Level:-1}}).error.code==="NEGATIVE_OVERRIDE";});
  test("nonfinite target rejected",function(){return api.evaluate({baseState:state(),overrides:{jar11Level:Infinity}}).error.code==="NONFINITE_OVERRIDE";});
  test("unsafe integer rejected",function(){return api.evaluate({baseState:state(),overrides:{jar11Level:Number.MAX_SAFE_INTEGER+1}}).error.code==="UNSAFE_OVERRIDE";});
  test("missing base state rejected",function(){return api.evaluate({overrides:{jar11Level:1}}).error.code==="MISSING_BASE_STATE";});
  test("missing Jar data rejected",function(){var s=state();delete s.jar11Level;return api.evaluate({baseState:s}).error.code==="MISSING_JAR_DATA";});
  test("missing Legend scaling rejected",function(){var s=state();delete s.jarLegendTalentLevel;return api.evaluate({baseState:s}).error.code==="MISSING_JAR_LEGEND_SCALING";});
  test("base state never mutates",function(){var s=state(),before=JSON.stringify(s);api.evaluate({baseState:s,overrides:{jar11Level:20,jar36Level:30}});return JSON.stringify(s)===before;});
  test("repeated evaluation is deterministic",function(){var input={baseState:state(),overrides:{jar11Level:20,jar36Level:30}};return JSON.stringify(api.evaluate(input))===JSON.stringify(api.evaluate(input));});
  test("production recomputation remains authoritative",function(){var s=state(),r=api.evaluate({baseState:s,overrides:{jar11Level:20}});return r.projectedRate===BellOptimizer.bellRateUpgradeCandidates.recompute(Object.assign({},s,{jar11Level:20}),{}).calculatedRate;});
  test("override registry retains production labels",function(){return api.OVERRIDES.jar11Level.source.indexOf("Big Beef Rock")!==-1&&api.OVERRIDES.jar36Level.source.indexOf("Twisted Rupie")!==-1;});
  test("Jar 11 target search",function(){var s=state(),target=direct(s,12,8),r=api.searchSingleJarTarget({baseState:s,jarId:"jar11",targetRate:target,maximumJarLevel:30});return r.ok&&r.reachableUnderScenario&&r.minimumJarLevel===12;});
  test("Jar 36 target search",function(){var s=state(),target=direct(s,5,15),r=api.searchSingleJarTarget({baseState:s,jarId:"jar36",targetRate:target,maximumJarLevel:30});return r.ok&&r.reachableUnderScenario&&r.minimumJarLevel===15;});
  test("target already met",function(){var s=state(),r=api.searchSingleJarTarget({baseState:s,jarId:"jar11",targetRate:1,maximumJarLevel:20});return r.reachableUnderScenario&&r.minimumJarLevel===5&&r.diagnostics.binarySearchIterations===0;});
  test("target impossible under maximum",function(){var s=state(),r=api.searchSingleJarTarget({baseState:s,jarId:"jar11",targetRate:direct(s,100,8),maximumJarLevel:6});return r.ok&&!r.reachableUnderScenario&&r.minimumJarLevel===null;});
  test("binary search returns smallest satisfying level",function(){var s=state(),target=direct(s,17,8),r=api.searchSingleJarTarget({baseState:s,jarId:"jar11",targetRate:target,maximumJarLevel:100});return r.minimumJarLevel===17&&direct(s,16,8)<target;});
  test("Jar scenarios are always RNG manual",function(){var r=api.evaluate({baseState:state(),overrides:{jar11Level:8,jar36Level:9}});return r.overrides.every(function(x){return x.attainability==="RNG_MANUAL_SCENARIO";})&&api.searchSingleJarTarget({baseState:state(),jarId:"jar11",targetRate:1,maximumJarLevel:10}).attainability==="RNG_MANUAL_SCENARIO";});
  test("results make no affordability or Tall Jar probability claim",function(){var text=JSON.stringify(api.evaluate({baseState:state(),overrides:{jar11Level:8}}));return !/AFFORDABLE|ACHIEVABLE|GUARANTEED/.test(text)&&/does not estimate the probability, Tall Jar count, or time/.test(text);});
  test("unknown overrides are contained",function(){return api.evaluate({baseState:state(),overrides:{measurementLevel:10}}).error.code==="UNSUPPORTED_OVERRIDE";});
  test("search does not leak state",function(){var s=state(),before=JSON.stringify(s);api.searchSingleJarTarget({baseState:s,jarId:"jar36",targetRate:direct(s,5,20),maximumJarLevel:100});return JSON.stringify(s)===before;});
  var results=tests.map(function(item){try{return {name:item.name,passed:Boolean(item.run())};}catch(error){return {name:item.name,passed:false,error:error.message};}});return {passed:results.filter(function(x){return x.passed;}).length,total:results.length,results:results};
};
