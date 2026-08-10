"use strict";
window.BellOptimizer = window.BellOptimizer || {};

BellOptimizer.runBellDashboardViewModelTests = function () {
  var dashboard=BellOptimizer.bellDashboardViewModel,target=BellOptimizer.bellTargetViewModel,tests=[];
  function test(name,run){tests.push({name:name,run:run});}
  function format(value){return String(Number(value).toFixed(1));}
  function change(id,from,to,cost,rate){return {candidateId:id,source:id==="bell-method-2"?"Bell Ring Method 2":"Ringing Measurement",system:"Synthetic",currentValue:from,targetValue:to,levelsGained:to-from,resourcePoolId:id,resource:{name:id==="bell-method-2"?"Gaming Bits":"Cobaltine"},totalCost:cost,remainingBalance:50,cumulativeProjectedRate:rate};}
  function optimizer(changes){return {ok:true,completeness:"EXACT",currentRate:100,optimizedRate:changes.length?150:100,absoluteGain:changes.length?50:0,relativeGain:changes.length?.5:0,recommendedChanges:changes,resourcePools:changes.map(function(item){return {resourcePoolId:item.resourcePoolId,remaining:50};}),excludedOpportunities:[],warnings:[],purchaseSequence:[]};}
  function next(){return {purchases:[{candidateId:"bell-method-4",source:"Bell Ring Method 4",currentLevel:3,nextLevel:4,nextCost:100,currentBalance:60,resourceShortfall:40,projectedRateAfterNextPurchase:120,relativeGainAfterNextPurchase:.2,resource:{name:"Opal"},semantic:"VERIFIED_RESOURCE_SHORTFALL"}],methodThreshold:{currentTotalMethodLevels:23,nextThreshold:25,levelsNeeded:2,legalCandidateMethods:["bell-method-2"],semantic:"ACCOUNT_PROGRESSION"}};}
  function build(changes,nextValue){return dashboard.build({optimizerResult:optimizer(changes),nextTargets:nextValue||next(),formatter:format});}
  test("current rate model",function(){return build([]).current.rate===100&&build([]).current.display==="100.0/hr";});
  test("optimized rate model",function(){return build([change("bell-method-2",1,2,10,150)]).optimized.rate===150;});
  test("relative gain model",function(){return build([change("bell-method-2",1,2,10,150)]).gain.relativeDisplay==="+50%";});
  test("repeated purchases are collapsed",function(){var m=build([change("bell-method-2",14,18,40,150)]);return m.changes.length===1&&m.changes[0].levelsGained===4;});
  test("resource cost display data",function(){return build([change("bell-method-2",1,2,10,150)]).changes[0].costDisplay==="10.0";});
  test("remaining resource balance",function(){return build([change("bell-method-2",1,2,10,150)]).changes[0].remainingDisplay==="50.0";});
  test("nothing affordable state",function(){return build([]).state==="nothing-affordable";});
  test("one upgrade state",function(){return build([change("bell-method-2",1,2,10,150)]).state==="one-upgrade";});
  test("several upgrades state",function(){return build([change("bell-method-2",1,2,10,130),change("measurement-ringing",2,3,20,150)]).state==="optimized";});
  test("early account next target",function(){return build([]).nextTargets[0].shortfallDisplay==="40.0";});
  test("next target preserves its verified resource name",function(){return build([]).nextTargets[0].resource==="Opal";});
  test("midgame multiple plan",function(){return build([change("bell-method-2",1,2,10,130),change("measurement-ringing",2,3,20,150)]).changes.length===2;});
  test("late account large values",function(){var o=optimizer([change("bell-method-2",100,125,1e18,1e20)]);o.currentRate=1e19;o.optimizedRate=1e20;o.absoluteGain=9e19;o.relativeGain=9;return dashboard.build({optimizerResult:o,nextTargets:next(),formatter:BellOptimizer.idleonNumberFormat.format}).optimized.display==="100QQ/hr";});
  test("locked systems grouped",function(){var o=optimizer([]);o.excludedOpportunities=[{reason:"LOCKED_OR_PROGRESSION_GATED"},{reason:"CAPPED"}];return dashboard.build({optimizerResult:o,nextTargets:next(),formatter:format}).lockedCount===2;});
  test("Method threshold context",function(){return build([]).methodThreshold.levelsNeeded===2;});
  test("distant Method threshold stays hidden",function(){var n=next();n.methodThreshold.levelsNeeded=12;return build([],n).methodThreshold===null;});
  test("Coin source unresolved",function(){var o=optimizer([]);o.excludedOpportunities=[{candidateId:"bell-method-0",reason:"RESOURCE_BALANCE_UNRESOLVED"}];return dashboard.build({optimizerResult:o,nextTargets:next(),formatter:format}).coinSelectionRequired;});
  test("partial optimizer failure remains contained",function(){return dashboard.build({optimizerResult:{ok:false},nextTargets:next(),formatter:format}).state==="partial";});
  test("Jar source is never an affordable plan change",function(){var o=optimizer([]);o.excludedOpportunities=[{candidateId:"jar-11",reason:"RNG_PROGRESSION_MANUAL_ONLY"}];return dashboard.build({optimizerResult:o,nextTargets:next(),formatter:format}).changes.length===0;});
  test("view model is immutable",function(){return Object.isFrozen(build([]))&&Object.isFrozen(build([]).nextTargets);});
  test("view model does not mutate optimizer result",function(){var o=optimizer([change("bell-method-2",1,2,10,150)]),before=JSON.stringify(o);dashboard.build({optimizerResult:o,nextTargets:next(),formatter:format});return JSON.stringify(o)===before;});
  test("Clean threshold bridge is labeled as global Method scaling",function(){var c=change("bell-method-1",4,5,10,150),o=optimizer([c]),state={bellMethodLevels:[4,4,4,4,4,4],upgrade45Owned:true};c.source="Bell Clean Method 1";var model=dashboard.build({optimizerResult:o,nextTargets:next(),baseState:state,formatter:format});return model.changes[0].isMethodScalingBridge&&model.changes[0].methodBreakpointsCrossed===1&&model.changes[0].bridgeVia==="Bell Clean Method 1";});
  test("Clean purchase away from threshold is not presented as a Ring bridge",function(){var c=change("bell-method-1",4,5,10,100),o=optimizer([c]),state={bellMethodLevels:[4,4,4,4,4,3],upgrade45Owned:true};c.source="Bell Clean Method 1";return !dashboard.build({optimizerResult:o,nextTargets:next(),baseState:state,formatter:format}).changes[0].isMethodScalingBridge;});
  function targetResult(status){return {ok:true,targetRate:130,current:{rate:100},deterministic:{status:status,maximumAffordableRate:150,targetPlan:{rate:132,recommendedChanges:[change("bell-method-2",1,2,10,132)]},maximumPlan:{recommendedChanges:[change("bell-method-2",1,4,40,150)]},shortfall:{absolute:status==="TARGET_NOT_REACHABLE_NOW"?20:0}}};}
  test("target already met",function(){return target.build(targetResult("TARGET_ALREADY_MET"),format).state==="already-met";});
  test("target reachable now",function(){var m=target.build(targetResult("TARGET_REACHABLE_NOW"),format);return m.state==="reachable"&&m.planReachesDisplay==="132.0/hr";});
  test("target unreachable now",function(){var m=target.build(targetResult("TARGET_NOT_REACHABLE_NOW"),format);return m.state==="unreachable"&&m.shortfallDisplay==="20.0/hr";});
  test("target result headline includes the entered goal",function(){return target.build(targetResult("TARGET_NOT_REACHABLE_NOW"),format).title==="130.0/hr isn’t reachable with current resources";});
  test("smaller target plan is used",function(){var m=target.build(targetResult("TARGET_REACHABLE_NOW"),format);return m.plan[0].targetLevel===2&&m.plan[0].targetLevel!==4;});
  test("invalid target is contained",function(){return !target.build({ok:false,error:{message:"Invalid target"}},format).ok;});
  var results=tests.map(function(item){try{return {name:item.name,passed:Boolean(item.run())};}catch(error){return {name:item.name,passed:false,error:error.message};}});return {passed:results.filter(function(x){return x.passed;}).length,total:results.length,results:results};
};
