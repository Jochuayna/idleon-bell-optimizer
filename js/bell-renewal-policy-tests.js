"use strict";
window.BellOptimizer = window.BellOptimizer || {};

BellOptimizer.runBellRenewalPolicyTests = function () {
  var tests = [];
  function test(name, fn) { try { fn(); tests.push({ name: name, passed: true }); } catch (error) { tests.push({ name: name, passed: false, error: error.message }); } }
  function assert(value, message) { if (!value) throw new Error(message || "Assertion failed"); }
  function close(a, b, tolerance, message) { assert(Math.abs(a - b) <= tolerance, (message || "Values differ") + ": " + a + " vs " + b); }
  function base(overrides) { return Object.assign({ selectedRewardIndex: 0, currentSelectedLevel: 0, rewardLevels: [0,0,0,0,0,0,0], currentRawRingIndex: 10, currentRingingExp: 0, ringingExpPerHour: 5, cavernsOwned: 18, bellUpgrade42Owned: false, bellUpgrade60Owned: false, bellUpgrade86Owned: false, majorBellBonus: 20, currentRenewalCurrency: 50, horizonHours: 1 }, overrides || {}); }
  function solve(overrides) { return BellOptimizer.bellRenewalPolicy.solveBellRenewalPolicy(base(overrides)); }
  var api = BellOptimizer.bellRenewalPolicy;

  test("versioned identifiers", function () { assert(api.OBJECTIVE_VERSION === "bell-renewal-objective-v1" && api.POLICY_VERSION === "bell-renewal-policy-v1" && api.HORIZON_VERSION === "bell-renewal-horizon-v1"); });
  test("fresh state has no renewal advantage", function () { var r=solve({currentRawRingIndex:0,currentSelectedLevel:0});assert(r.ok&&r.action!=="RENEW_NOW"); });
  test("reservation threshold exists", function () { var r=solve();assert(r.ok&&Number.isSafeInteger(r.reservationLevelNow)); });
  test("threshold zero means always continue", function () { var r=solve({currentRawRingIndex:0,currentSelectedLevel:0});assert(r.reservationLevelNow===0); });
  test("exact tie at threshold is reported", function () { var r=solve({currentRawRingIndex:0,currentSelectedLevel:0,currentRenewalCurrency:25,majorBellBonus:0,ringingExpPerHour:5,horizonHours:1});assert(r.action==="INDIFFERENT"&&r.tieAtBoundary&&r.reservationLevelNow===0); });
  test("level below positive threshold renews", function () { var r=solve(),below=r.reservationLevelNow-1;if(below>=0){var b=solve({currentSelectedLevel:below});assert(b.action==="RENEW_NOW"||b.action==="INDIFFERENT");} });
  test("level at threshold continues or ties", function () { var r=solve(),at=solve({currentSelectedLevel:r.reservationLevelNow});assert(at.action==="CONTINUE"||at.action==="INDIFFERENT"); });
  test("far above threshold continues", function () { var r=solve({currentSelectedLevel:100000});assert(r.action==="CONTINUE"); });
  test("strong zero-future-gain run protected", function () { var r=solve({currentRawRingIndex:100,currentSelectedLevel:100000,ringingExpPerHour:.001,horizonHours:.001});assert(r.action==="CONTINUE"); });
  test("rare high runs naturally move above threshold", function () { var t=solve().reservationLevelNow;[100,1000,10000].forEach(function(level){var r=solve({currentSelectedLevel:t+level});assert(r.action==="CONTINUE");}); });
  test("one ring before major sees major event", function () { var req=BellOptimizer.bellMechanics.calculateRingingRequirement(18);var r=solve({currentRawRingIndex:18,ringingExpPerHour:req,majorBellBonus:1000});assert(r.nextDecisionEvent.type==="MAJOR_BELL_PAYOUT"); });
  test("two rings before major remains exact", function () { assert(solve({currentRawRingIndex:17,ringingExpPerHour:100,majorBellBonus:1000}).ok); });
  test("nineteen rings before major remains exact", function () { assert(solve({currentRawRingIndex:0,ringingExpPerHour:100,majorBellBonus:1000}).ok); });
  test("zero major bonus", function () { assert(solve({majorBellBonus:0}).ok); });
  test("large major bonus", function () { assert(solve({majorBellBonus:10000}).ok); });
  test("whole-ring double enabled", function () { assert(solve({bellUpgrade86Owned:true}).ok); });
  test("whole-ring double disabled", function () { assert(solve({bellUpgrade86Owned:false}).ok); });
  test("four reward pool", function () { assert(solve({cavernsOwned:0}).ok); });
  test("six reward pool", function () { assert(solve({cavernsOwned:11}).ok); });
  test("seven reward pool", function () { assert(solve({cavernsOwned:16}).ok); });
  test("immediate banked ring is processed", function () { var req=BellOptimizer.bellMechanics.calculateRingingRequirement(10),r=solve({currentRingingExp:req});assert(r.ok&&r.nextDecisionEvent.hoursFromNow===0); });
  test("multiple banked rings are processed", function () { var exp=0;for(var i=10;i<13;i++)exp+=BellOptimizer.bellMechanics.calculateRingingRequirement(i);var r=solve({currentRingingExp:exp});assert(r.ok&&r.performance.payoutTransitions>1); });
  test("banked major remains major", function () { var req=BellOptimizer.bellMechanics.calculateRingingRequirement(18),r=solve({currentRawRingIndex:18,currentRingingExp:req});assert(r.nextDecisionEvent.type==="MAJOR_BELL_PAYOUT"&&r.nextDecisionEvent.hoursFromNow===0); });
  test("every ordinary payout is a decision transition", function () { var r=solve({currentRawRingIndex:0,ringingExpPerHour:100,horizonHours:1});assert(r.performance.payoutTransitions>=r.performance.futurePayoutEpochs); });
  test("horizon before next payout terminates", function () { var r=solve({ringingExpPerHour:.001,horizonHours:.001});assert(r.nextDecisionEvent.type==="HORIZON_TERMINATION"); });
  test("renew unavailable now", function () { var r=solve({currentRenewalCurrency:0});assert(r.renewalsAffordableNow===0); });
  test("renew becomes affordable over horizon", function () { var r=solve({currentRenewalCurrency:20,horizonHours:1});assert(r.renewalsAffordableNow===0&&r.renewalsAffordableOverHorizon>=1); });
  test("renew favored but unavailable", function () { var r=solve({currentSelectedLevel:0,currentRenewalCurrency:0});assert(["RENEW_FAVORED_BUT_UNAVAILABLE","CONTINUE","INDIFFERENT"].indexOf(r.action)!==-1); });
  test("exactly 25 is affordable", function () { assert(solve({currentRenewalCurrency:25}).renewalsAffordableNow===1); });
  test("marginally below 25 is not silently affordable", function () { assert(solve({currentRenewalCurrency:25-1e-8}).renewalsAffordableNow===0); });
  test("forced progress prevents immediate double renewal", function () { var r=solve({currentRenewalCurrency:100});assert(r.ok&&r.performance.maximumRenewalDepthUsed<=2); });
  test("two-renewal cap exposed", function () { assert(solve({currentRenewalCurrency:100}).maxRenewalsModeled===2); });
  test("binding renewal limit reported", function () { assert(solve({currentRenewalCurrency:100}).renewalLimitBindingPossible); });
  test("no fresh payout prevents useless renewal", function () { var r=solve({currentRawRingIndex:100,currentSelectedLevel:0,ringingExpPerHour:.001,horizonHours:.001});assert(r.action!=="RENEW_NOW"&&!r.freshPayoutReachableAfterRenewal); });
  test("terminal utility preserves current level", function () { var r=solve({currentSelectedLevel:77,ringingExpPerHour:.001,horizonHours:0});close(r.expectedTerminalLevelUnderOptimalPolicy,77,1e-12); });
  test("current action is receding-horizon only", function () { var r=solve();assert(/Recalculate/.test(r.recedingHorizonInstruction)&&!("permanentRenewalTime" in r)); });
  test("no rarity penalty", function () { var r=solve();assert(r.assumptions.indexOf("LINEAR_RAW_BELL_LEVEL_UTILITY")!==-1); });
  test("target is rejected", function () { assert(solve({targetLevel:100}).status==="TARGET_INPUT_NOT_SUPPORTED"); });
  test("Lantern is rejected", function () { assert(solve({lanternHours:2}).status==="LANTERN_INPUT_NOT_SUPPORTED"); });
  test("horizon-edge assumption explicit", function () { assert(solve().horizonEdgeAssumption==="UNUSED_RENEWAL_CURRENCY_HAS_ZERO_TERMINAL_UTILITY"); });
  test("reset assumption warning explicit", function () { var r=solve();assert(r.warnings.indexOf("RESET_SEMANTICS_MODEL_ASSUMED")!==-1); });
  test("expected result fields", function () { var r=solve();[r.expectedTerminalLevelUnderOptimalPolicy,r.expectedTerminalLevelIfContinueNow,r.expectedAdvantageOfChosenAction].forEach(function(v){assert(finite(v));});function finite(v){return typeof v==="number"&&Number.isFinite(v);} });
  test("threshold contract fields", function () { var r=solve();assert("renewBelow" in r&&"continueAtOrAbove" in r&&"tieAtBoundary" in r&&r.thresholdMode); });
  test("100 future payouts allowed", function () { var rate=0,total=0;for(var i=0;i<100;i++)total+=BellOptimizer.bellMechanics.calculateRingingRequirement(i);rate=total;var r=solve({currentRawRingIndex:0,ringingExpPerHour:rate,horizonHours:1,currentRenewalCurrency:0});assert(r.status!=="POLICY_UNAVAILABLE_EXACT_LIMIT"); });
  test("101 future payouts contained", function () { var total=0;for(var i=0;i<101;i++)total+=BellOptimizer.bellMechanics.calculateRingingRequirement(i);var r=solve({currentRawRingIndex:0,ringingExpPerHour:total+1,horizonHours:1});assert(!r.ok&&r.status==="POLICY_UNAVAILABLE_EXACT_LIMIT"&&r.futurePayoutEpochs>=101); });
  test("unsafe selected level contained", function () { assert(solve({currentSelectedLevel:Number.MAX_SAFE_INTEGER+1}).status==="UNSAFE_SELECTED_LEVEL"); });
  test("locked reward", function () { var r=solve({selectedRewardIndex:6,currentSelectedLevel:0,cavernsOwned:10});assert(r.action==="LOCKED_REWARD"); });
  test("invalid Bell rate", function () { assert(solve({ringingExpPerHour:0}).status==="INVALID_BELL_RATE"); });
  test("invalid Ringing state", function () { assert(solve({currentRawRingIndex:-1}).status==="INVALID_RINGING_STATE"); });
  test("invalid payout mechanics", function () { assert(solve({majorBellBonus:-1}).status==="INVALID_PAYOUT_MECHANICS"); });
  test("deterministic repeated evaluation", function () { assert(JSON.stringify(solve())===JSON.stringify(solve())); });
  test("input is not mutated", function () { var input=base(),before=JSON.stringify(input);api.solveBellRenewalPolicy(input);assert(JSON.stringify(input)===before); });
  test("module has no DOM access", function () { assert(!/document\.|querySelector|getElementById/.test(api.solveBellRenewalPolicy.toString())); });
  test("module exposes no persistence", function () { assert(!("save" in api)&&!("load" in api)); });
  test("taper version unchanged", function () { assert(BellOptimizer.bellRunForecast.TAPER_POLICY_VERSION==="bell-taper-v1"); });
  test("tier version unchanged", function () { assert(BellOptimizer.bellRunForecast.TIER_MODEL_VERSION==="bell-run-tier-v1"); });
  test("candidate analysis remains analysis-only", function () { var r=BellOptimizer.bellRenewalCandidateAnalysis.analyzeBellRenewalCandidates(base({rewardLevels:[0,0,0,0,0,0,0]}));assert(r.recommendation===null); });
  test("target evaluator unchanged", function () { assert(typeof BellOptimizer.targetEvaluator.evaluateTarget==="function"); });
  test("automatic evaluator remains available", function () { assert(Boolean(BellOptimizer.automaticRunEvaluation)); });
  test("history remains available", function () { assert(Boolean(BellOptimizer.bellHistorySnapshot)); });
  test("benchmark remains available", function () { assert(Boolean(BellOptimizer.bellBenchmarkComparison)); });
  test("upgrade paths remain available", function () { assert(Boolean(BellOptimizer.bellRateOptimizer)); });

  return { passed: tests.filter(function (entry) { return entry.passed; }).length, total: tests.length, results: tests };
};
