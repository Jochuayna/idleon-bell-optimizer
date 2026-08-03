"use strict";
global.window = {};
global.BellOptimizer = window.BellOptimizer = {};
global.document = { querySelector: function () { return { addEventListener: function () {} }; } };

[
  "idleon-number-format", "bell-mechanics", "bell-rate-upgrade-candidates", "bell-rate-optimizer", "bell-rate-section", "bell-account-validation", "bell-history-snapshot", "bell-history-comparison", "bell-history-storage", "bell-history-import", "save-import-workflow", "save-parsing",
  "target-evaluator", "objective-selection", "reset-lantern-planner", "current-reset-decision", "gain-pace",
  "remaining-opportunities", "current-run-distribution", "developer-mode", "compare-saves", "json-inspector", "bell-history-tests",
  "parser-tests"
].forEach(function (name) { require("../js/" + name + ".js"); });

(async function(){var result=BellOptimizer.runSaveParserTests(),history=await BellOptimizer.runBellHistoryTests(),presentation=require("./ui-presentation-tests.js")(),results=result.results.concat(history.results,presentation),passed=result.passed+history.passed+presentation.filter(function(x){return x.passed;}).length,total=result.total+history.total+presentation.length;results.filter(function(test){return !test.passed;}).forEach(function(test){console.error("FAIL: "+test.name+(test.error?": "+test.error:""));});console.log(passed+"/"+total+" calculation/parser/history/presentation tests passed");if(passed!==total)process.exitCode=1;}());
