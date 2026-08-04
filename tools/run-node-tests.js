"use strict";
global.window = {};
global.BellOptimizer = window.BellOptimizer = {};
global.document = { querySelector: function () { return { addEventListener: function () {} }; } };

[
  "idleon-number-format", "bell-mechanics", "bell-rate-upgrade-candidates", "bell-rate-optimizer", "bell-rate-section", "bell-account-validation", "bell-history-snapshot", "bell-history-comparison", "bell-history-storage", "bell-history-import", "save-import-workflow", "save-parsing", "bell-benchmark-snapshot", "bell-benchmark-comparison", "bell-benchmark-section", "bell-benchmark-tests",
  "target-evaluator", "objective-selection", "reset-lantern-planner", "current-reset-decision", "gain-pace",
  "remaining-opportunities", "current-run-distribution", "developer-mode", "compare-saves", "json-inspector", "bell-history-tests",
  "parser-tests"
].forEach(function (name) { require("../js/" + name + ".js"); });

(async function(){var result=BellOptimizer.runSaveParserTests(),history=await BellOptimizer.runBellHistoryTests(),benchmark=BellOptimizer.runBellBenchmarkTests(),presentation=require("./ui-presentation-tests.js")(),results=result.results.concat(history.results,benchmark.results,presentation),passed=result.passed+history.passed+benchmark.passed+presentation.filter(function(x){return x.passed;}).length,total=result.total+history.total+benchmark.total+presentation.length;results.filter(function(test){return !test.passed;}).forEach(function(test){console.error("FAIL: "+test.name+(test.error?": "+test.error:""));});console.log(passed+"/"+total+" calculation/parser/history/benchmark/presentation tests passed");if(passed!==total)process.exitCode=1;}());
