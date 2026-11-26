"use strict";
window.BellOptimizer=window.BellOptimizer||{};
BellOptimizer.runBellRenewalBudgetTests=function(){
  var api=BellOptimizer.bellRenewalBudget,internal=api._test,forecast=BellOptimizer.bellRunForecast,tests=[];
  function test(name,run){tests.push({name:name,run:run});}
  function near(a,b,tolerance){return Math.abs(a-b)<=tolerance;}
  function base(overrides){return Object.assign({selectedRewardIndex:6,rewardLevels:[1000,1000,1000,1000,1000,1000,1500],currentRawRingIndex:520,currentRingingExp:0,ringingExpPerHour:1e14,currentRenewalCurrency:75,cavernsOwned:18,majorBellBonus:940,bellUpgrade42Owned:true,bellUpgrade60Owned:true,bellUpgrade86Owned:true},overrides||{});}
  function withLevel(level,overrides){return base(Object.assign({rewardLevels:[1000,1000,1000,1000,1000,1000,level]},overrides||{}));}
  function coin(){return internal.createOutcomes([0,1],[1,1]);}

  test("one re-roll is worth an average fresh run",function(){return internal.rerollWorth(coin(),1)[1]===0.5;});
  test("worth follows average of max(fresh, worth of one fewer)",function(){var worth=internal.rerollWorth(coin(),4);return near(worth[2],0.75,1e-12)&&near(worth[3],0.875,1e-12)&&near(worth[4],0.9375,1e-12);});
  test("average of max handles bars outside the outcomes",function(){var outcomes=internal.createOutcomes([10,20,30],[1,2,1]);return near(outcomes.averageOfMax(0),20,1e-12)&&near(outcomes.averageOfMax(100),100,1e-12)&&near(outcomes.averageOfMax(20),22.5,1e-12);});
  test("share at least counts outcomes on the bar",function(){var outcomes=internal.createOutcomes([10,20,30],[1,2,1]);return near(outcomes.shareAtLeast(20),0.75,1e-12)&&near(outcomes.shareAtLeast(20.01),0.25,1e-12)&&outcomes.shareAtLeast(31)===0&&outcomes.shareAtLeast(-5)===1;});
  test("worth equals playing the keep-or-re-roll rule over every outcome",function(){
    var values=[0,3,4,9,20],weights=[4,3,2,2,1],outcomes=internal.createOutcomes(values,weights),worth=internal.rerollWorth(outcomes,3),total=0,sum=0;
    values.forEach(function(a,i){values.forEach(function(b,j){values.forEach(function(c,k){var weight=weights[i]*weights[j]*weights[k],kept=a>=worth[2]?a:b>=worth[1]?b:c;total+=weight;sum+=weight*kept;});});});
    return near(sum/total,worth[3],1e-9);
  });
  test("classification bands sit at two and eight percent of the bar",function(){var c=internal.classify;return c(109,100).decision==="KEEP"&&c(103,100).decision==="KEEP_FAVORED"&&c(101,100).decision==="TOO_CLOSE"&&c(99,100).decision==="TOO_CLOSE"&&c(96,100).decision==="RENEW_FAVORED"&&c(90,100).decision==="RENEW";});

  test("with one re-roll the bar is the fresh expected finish",function(){var result=api.evaluate(base({plannedRerolls:1})),fresh=forecast.buildFreshTaperBaseline(base());return result.ok&&near(result.keepBar,fresh.expectedFinalRewardLevel,1e-6)&&near(result.singleRerollBar,result.keepBar,1e-9);});
  test("the bar rises with every extra re-roll",function(){var previous=-Infinity;return [1,2,3,5,10,25,100,500].every(function(count){var bar=api.evaluate(base({plannedRerolls:count})).keepBar,ok=bar>previous;previous=bar;return ok;});});
  test("fewer fresh runs reach a higher bar",function(){var few=api.evaluate(base({plannedRerolls:3})),many=api.evaluate(base({plannedRerolls:100}));return few.keepBarTopShare>many.keepBarTopShare&&many.keepBarTopShare>0&&few.keepBarTopShare<1;});
  test("the default plan is the Renewals banked",function(){var result=api.evaluate(base({currentRenewalCurrency:75}));return result.rerollsPlanned===3&&result.renewalsBankedNow===3&&result.rerollsSource==="BANKED_RENEWALS"&&result.defaultRerolls===3;});
  test("a large bank is capped by default and says so",function(){var result=api.evaluate(base({currentRenewalCurrency:17450}));return result.renewalsBankedNow===698&&result.rerollsPlanned===api.DEFAULT_REROLL_CAP&&result.rerollsSource==="DEFAULT_CAP"&&result.defaultRerolls===api.DEFAULT_REROLL_CAP;});
  test("the player's plan overrides the default in both directions",function(){var up=api.evaluate(base({currentRenewalCurrency:17450,plannedRerolls:400})),down=api.evaluate(base({currentRenewalCurrency:17450,plannedRerolls:4}));return up.rerollsPlanned===400&&down.rerollsPlanned===4&&up.rerollsSource==="PLAYER_SETTING"&&up.keepBar>down.keepBar;});
  test("invalid plans are rejected",function(){return [0,-3,2.5,NaN,"12"].every(function(value){var result=api.evaluate(base({plannedRerolls:value}));return !result.ok&&result.code==="INVALID_PLANNED_REROLLS";});});
  test("plans above the supported maximum are capped and flagged",function(){var result=api.evaluate(base({plannedRerolls:api.MAX_REROLLS+500}));return result.ok&&result.rerollsPlanned===api.MAX_REROLLS&&result.rerollCapApplied===true;});
  test("no banked Renewal uses the single re-roll bar and reports the shortfall",function(){var result=api.evaluate(base({currentRenewalCurrency:10}));return result.ok&&result.renewalsBankedNow===0&&result.rerollsPlanned===1&&result.affordableNow===false&&result.renewalCurrencyNeeded===15&&near(result.keepBar,result.singleRerollBar,1e-9);});
  test("the same run is kept with few re-rolls and renewed with many",function(){
    var fresh=forecast.buildFreshTaperBaseline(base()).expectedFinalRewardLevel,options=withLevel(Math.round(fresh*1.25));
    var few=api.evaluate(Object.assign({},options,{plannedRerolls:1})),many=api.evaluate(Object.assign({},options,{plannedRerolls:400}));
    return few.decision==="KEEP"&&many.decision==="RENEW"&&near(few.currentExpectedFinish,many.currentExpectedFinish,1e-9);
  });
  test("a run still in its early rings is never called a Renew",function(){
    var result=api.evaluate(base({currentRawRingIndex:60,rewardLevels:[0,0,0,0,0,0,0],plannedRerolls:400}));
    return result.ok&&result.earlyPhase===true&&result.checkRawRingIndex>60&&result.decision==="TOO_CLOSE"&&result.relativeAdvantage<-0.08;
  });
  test("a run past the check point is judged normally",function(){var result=api.evaluate(base({currentRawRingIndex:520,plannedRerolls:400}));return result.ok&&result.earlyPhase===false&&result.checkRawRingIndex<=520&&result.decision==="RENEW";});
  test("expected finish matches the replacement model's current run",function(){var options=base(),result=api.evaluate(options),replacement=BellOptimizer.bellRunReplacement.evaluate(options);return near(result.currentExpectedFinish,replacement.currentRun.expectedEndingLevel,1e-6)&&near(result.freshExpectedFinish,replacement.freshReplacement.expectedEndingLevel,1e-6);});
  test("malformed inputs fail closed",function(){return !api.evaluate(base({currentRenewalCurrency:-1})).ok&&!api.evaluate(base({ringingExpPerHour:0})).ok&&!api.evaluate(base({rewardLevels:null})).ok&&!api.evaluate(base({rewardLevels:[1,1,1,1,1,1,-5]})).ok;});

  test("major-payout tally agrees with the exact distribution",function(){
    var options=base(),fresh=forecast.buildFreshTaperBaseline(options),mechanics=fresh.mechanics,target=401;
    var distributionOptions={currentRing:1,targetRing:target,selectionProbability:mechanics.selectionProbability,ordinaryGainDistribution:mechanics.ordinaryGainDistribution,majorGainDistribution:mechanics.majorGainDistribution,expectedOrdinaryRingGain:mechanics.expectedOrdinaryRingGain,expectedMajorRingGain:mechanics.expectedMajorRingGain};
    var exact=BellOptimizer.targetEvaluator.calculateAdditionalLevelDistribution(distributionOptions);
    if(!exact.ok)return false;
    var precise=internal.outcomesFromDistribution(exact.probabilities,0),tallied=internal.outcomesFromMajors(mechanics,exact.majorRingCount,exact.ordinaryRingCount,0);
    var a=internal.rerollWorth(precise,200),b=internal.rerollWorth(tallied,200);
    return near(precise.mean,tallied.mean,1e-6*precise.mean)&&[1,5,25,100,200].every(function(count){return Math.abs(a[count]-b[count])<=0.005*a[count];});
  });
  test("a long run uses the major-payout tally and keeps the bar ordering",function(){
    var options=base({ringingExpPerHour:4e17,majorBellBonus:1120,currentRawRingIndex:700}),one=api.evaluate(Object.assign({},options,{plannedRerolls:1})),many=api.evaluate(Object.assign({},options,{plannedRerolls:300}));
    return one.ok&&many.ok&&one.approximate===true&&many.keepBar>one.keepBar*1.5&&near(one.keepBar,one.freshExpectedFinish,1e-6*one.keepBar);
  });
  test("playing the rule roll by roll lands on the predicted worth",function(){
    var options=base(),fresh=forecast.buildFreshTaperBaseline(options),mechanics=fresh.mechanics,p=mechanics.selectionProbability,taper=fresh.taper.taperRawRingIndex,count=10,seed=12345;
    function random(){seed=(seed*1664525+1013904223)%4294967296;return seed/4294967296;}
    function draw(distribution){var u=random(),sum=0;for(var i=0;i<distribution.length;i+=1){sum+=distribution[i].probabilityValue;if(u<sum)return distribution[i].gain;}return distribution[distribution.length-1].gain;}
    function play(from,to){var level=0;for(var raw=from;raw<to;raw+=1)if(random()<p)level+=draw((raw+1)%20===0?mechanics.majorGainDistribution:mechanics.ordinaryGainDistribution);return level;}
    var worth=[NaN];for(var n=1;n<=count;n+=1)worth.push(api.evaluate(Object.assign({},options,{plannedRerolls:n})).keepBar);
    var check=api.evaluate(options).checkRawRingIndex,ordinary=0,major=0;for(var raw=check;raw<taper;raw+=1){if((raw+1)%20===0)major+=1;else ordinary+=1;}
    var remaining=p*(ordinary*mechanics.expectedOrdinaryRingGain+major*mechanics.expectedMajorRingGain),trials=1500,sum=0;
    for(var trial=0;trial<trials;trial+=1){var left=count;while(true){var seen=play(0,check);if(left>1&&seen+remaining<worth[left-1]){left-=1;continue;}sum+=seen+play(check,taper);break;}}
    return Math.abs(sum/trials-worth[count])<=0.03*worth[count];
  });

  test("the verdict copy names the bar, the plan and the standing",function(){
    var options=withLevel(4000,{currentRenewalCurrency:17450}),budget=api.evaluate(options),replacement=BellOptimizer.bellRunReplacement.evaluate(options),view=BellOptimizer.bellRunViewModel;
    var plain=view.replacementPresentation(replacement,String),shown=view.budgetPresentation(plain,budget,String,"Coins From Fountain");
    return shown.resetAware===true&&shown.decision===budget.decision&&/^Keep bar · 50 re-rolls$/.test(shown.rationaleLabel)&&shown.rationaleMetric===String(budget.keepBar)&&/698 Renewals banked/.test(shown.reason)&&/Coins From Fountain/.test(shown.reason)&&/This run: /.test(shown.reason)&&shown.reason.length<200&&shown.currentExpected===plain.currentExpected&&shown.freshExpected===plain.freshExpected;
  });
  test("one re-roll is explained as an average fresh run",function(){var options=base({currentRenewalCurrency:25}),view=BellOptimizer.bellRunViewModel,shown=view.budgetPresentation(view.replacementPresentation(BellOptimizer.bellRunReplacement.evaluate(options),String),api.evaluate(options),String,"Coins From Fountain");return /^Keep bar · 1 re-roll$/.test(shown.rationaleLabel)&&/average fresh run/.test(shown.reason)&&!/banked/.test(shown.reason);});
  test("an early run is told to wait for the check point",function(){var options=base({currentRawRingIndex:60,rewardLevels:[0,0,0,0,0,0,0]}),view=BellOptimizer.bellRunViewModel,shown=view.budgetPresentation(view.replacementPresentation(BellOptimizer.bellRunReplacement.evaluate(options),String),api.evaluate(options),String,"Coins From Fountain");return shown.confidenceLabel==="Too early to judge"&&/Too early to judge: check again around ring /.test(shown.reason);});
  test("a Renew verdict without a banked Renewal states the shortfall",function(){var options=base({currentRenewalCurrency:10,rewardLevels:[1000,1000,1000,1000,1000,1000,100]}),view=BellOptimizer.bellRunViewModel,budget=api.evaluate(options),shown=view.budgetPresentation(view.replacementPresentation(BellOptimizer.bellRunReplacement.evaluate(options),String),budget,String,"Coins From Fountain");return budget.decision.indexOf("RENEW")===0&&/No Renewal banked yet/.test(shown.reason)&&/Need 15 more Renewal currency/.test(shown.reason)&&shown.affordableNow===false;});
  test("without the reset-aware result the original verdict is untouched",function(){var view=BellOptimizer.bellRunViewModel,plain=view.replacementPresentation(BellOptimizer.bellRunReplacement.evaluate(base()),String);return view.budgetPresentation(plain,null,String,"x")===plain&&view.budgetPresentation(plain,{ok:false},String,"x")===plain;});
  test("the Run view model carries the reset-aware verdict through build",function(){var options=base({currentRenewalCurrency:17450}),scenario=BellOptimizer.bellRunRateScenario.evaluate({baseOptions:options,futureRate:null,reward:BellOptimizer.BELL_REWARDS[6],formatter:String});return scenario.ok&&scenario.display.renewalBudget.ok&&scenario.display.model.replacement.resetAware===true&&scenario.display.model.replacement.rerollsPlanned===50;});
  test("a planned count on the base options reaches the scenario verdict",function(){var options=base({currentRenewalCurrency:17450,plannedRerolls:7}),scenario=BellOptimizer.bellRunRateScenario.evaluate({baseOptions:options,futureRate:2e14,reward:BellOptimizer.BELL_REWARDS[6],formatter:String});return scenario.display.model.replacement.rerollsPlanned===7&&scenario.actual.model.replacement.rerollsPlanned===7;});

  var results=tests.map(function(item){try{return {name:item.name,passed:Boolean(item.run())};}catch(error){return {name:item.name,passed:false,error:error.message};}});return {passed:results.filter(function(x){return x.passed;}).length,total:results.length,results:results};
};
