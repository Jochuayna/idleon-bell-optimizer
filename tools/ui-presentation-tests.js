"use strict";
var fs=require("fs"),path=require("path"),root=path.join(__dirname,".."),html=fs.readFileSync(path.join(root,"index.html"),"utf8"),scripts=fs.readdirSync(path.join(root,"js")).filter(function(name){return name.endsWith(".js")&&name.indexOf("tests")===-1;}).map(function(name){return fs.readFileSync(path.join(root,"js",name),"utf8");}).join("\n"),ids=Array.from(html.matchAll(/\sid="([^"]+)"/g),function(m){return m[1];});
function result(name,passed){return {name:name,passed:!!passed};}
module.exports=function(){var referenced=Array.from(scripts.matchAll(/querySelector(?:All)?\("#([A-Za-z][\w-]*)"\)/g),function(m){return m[1];}),main=(html.match(/<section id="main-result-card"[\s\S]*?<\/section>/)||[""])[0];return [
  result("UI has no duplicate ids",new Set(ids).size===ids.length),
  result("static id selector references resolve",referenced.every(function(id){return ids.indexOf(id)!==-1;})),
  result("rate disclosures expose expandable state hooks",/class="rate-factor-details"/.test(html)&&/aria-expanded/.test(scripts)),
  result("exact Bell rate is absent from normal visual flow",/id="normal-bell-rate-exact" class="visually-hidden"/.test(html)),
  result("obsolete reconstruction copy is absent",html.indexOf("Automatically reconstructed from verified imported save fields.")===-1&&scripts.indexOf("Automatically reconstructed from verified imported save fields.")===-1),
  result("obsolete Step 2 copy is absent",html.indexOf("What do you care about?")===-1&&html.indexOf("Choose the Bell reward you want this run checked against.")===-1),
  result("obsolete distribution subtitle is absent",html.indexOf("Where the Bell levels accumulated in this run.")===-1),
  result("main result omits Continue Fresh table",main.indexOf("path-comparison")===-1),
  result("Continue Fresh comparison remains advanced",/id="continue-fresh-details"/.test(html)&&/id="decision-continue-ring"/.test(html)),
  result("Progress History remains reachable before import",/id="bell-rate-section" class="panel bell-rate-section"/.test(html)&&!/id="bell-rate-section"[^>]*hidden/.test(html)&&/id="bell-rate-history-tab"/.test(html)),
  result("Developer Tools panel is absent from public layout",/id="developer-tools"[^>]*hidden/.test(html)),
  result("normal Advanced Details remain available",/id="advanced-details"/.test(html)&&html.indexOf("Show Advanced Details")!==-1)
  ,result("redundant public release copy is absent",["Verified account factors and Bell-focused upgrade paths.","Candidates use complete Bell Ring, Ping, or Clean rates without changing the imported save.","Progress History is local and never saves automatically.","Compared continuing and renewing over the same","Manual controls, imported values, and full statistics"].every(function(text){return html.indexOf(text)===-1&&scripts.indexOf(text)===-1;}))
  ,result("history privacy copy is concise with details available",html.indexOf("Bell History stays in this browser. Full Idleon saves are processed locally and are not retained or uploaded.")!==-1&&html.indexOf("Local storage and privacy details")!==-1)
  ,result("renewal methodology moved to Advanced Details",/id="advanced-details"[\s\S]*id="decision-resource-text"/.test(html)&&main.indexOf('id="decision-resource-text"')===-1)
  ,result("high-end explanation is not repeated in remaining-opportunities copy",scripts.indexOf("Even the high-end likely result is about")===-1)
  ,result("history detail rates use shared exact formatter",/\["Bell Ring",format\(item\.rates\.ringExact\)\]/.test(scripts)&&/\["Bell Ping",format\(item\.rates\.pingExact\)\]/.test(scripts)&&/\["Bell Clean",format\(item\.rates\.cleanExact\)\]/.test(scripts))
  ,result("paste input remains lightweight",/pasteArea\.addEventListener\("input"[\s\S]*?pasteArea\.value\.length[\s\S]*?JSON ready to import\./.test(scripts)&&!/pasteArea\.addEventListener\("input"[\s\S]{0,500}(?:JSON\.parse|parseBellRewardLevels|saveImportWorkflow\.run)/.test(scripts))
  ,result("multi-upgrade plan search is lazy",/normal-multi-upgrade-plans"\)\.addEventListener\("toggle"/.test(scripts)&&/Open this section to calculate multi-upgrade plans\./.test(scripts))
  ,result("successful import does not retain raw JSON in rendering",/render:function\(result\)\{importStatus\.textContent="Calculating rates\.\.\.";importFromText\(null,result\);\}/.test(scripts))
  ,result("public mode skips hidden developer rendering",/if \(BellOptimizer\.developerMode && BellOptimizer\.developerMode\.enabled\) \{\s*document\.querySelector\("#rate-source-details"\)/.test(scripts))
  ,result("Compare Accounts is a top-level tab",/id="bell-rate-benchmark-tab"[^>]*>Compare Accounts</.test(html)&&/id="bell-rate-benchmark-panel"/.test(html))
  ,result("Progress History no longer contains benchmark mode",html.indexOf("benchmark-history-mode")===-1&&html.indexOf("history-mode-switch")===-1&&/id="personal-history-content"/.test(html))
  ,result("Compare Accounts has separate prefixed controls",["bell-rate-benchmark-panel","benchmark-json-paste","benchmark-file","benchmark-import-button","benchmark-clear-button","benchmark-rate-body","benchmark-factor-body","benchmark-overall-summary","benchmark-rankings"].every(function(id){return ids.indexOf(id)!==-1;}))
  ,result("Bell Rate shortcut opens Compare Accounts",/id="benchmark-shortcut"/.test(html)&&/benchmark-shortcut"\)\.addEventListener\("click",function\(\)\{selectBellRateTab\("benchmark"\)/.test(scripts))
  ,result("benchmark paste has no parsing event",!/benchmark-json-paste[\s\S]{0,500}addEventListener\("(?:input|change|blur)"/.test(scripts))
  ,result("benchmark controller cannot call active renderer or History",(function(){var source=fs.readFileSync(path.join(root,"js","bell-benchmark-section.js"),"utf8");return source.indexOf("importFromText")===-1&&source.indexOf("bellHistorySection.setCurrent")===-1&&source.indexOf("initializeBellRateOptimizerUI")===-1&&source.indexOf("bellRateOptimizer")===-1;})())
  ,result("benchmark controller has no IndexedDB dependency",(function(){var source=fs.readFileSync(path.join(root,"js","bell-benchmark-section.js"),"utf8");return source.indexOf("indexedDB")===-1&&source.indexOf("bellHistoryStorage")===-1;})())
  ,result("benchmark raw textarea clears after success",/benchmark-json-paste"\)\.value=""/.test(scripts))
  ,result("benchmark comparison initializes lazily",/if\(benchmark\)BellOptimizer\.bellBenchmarkSection\.open\(\)/.test(scripts)&&/function open\(\)\{initialize\(\);renderComparison\(\);\}/.test(scripts)&&!/bellBenchmarkSection\.open\(\)/.test(scripts.replace(/if\(benchmark\)BellOptimizer\.bellBenchmarkSection\.open\(\)/,"")))
  ,result("benchmark opportunity cards precede detail tables",html.indexOf('id="benchmark-rankings"')<html.indexOf('id="benchmark-rate-body"')&&html.indexOf('id="benchmark-rate-body"')<html.indexOf('id="benchmark-factor-body"'))
  ,result("benchmark replacement controls collapse after success",/benchmark-replace-controls"\)\.open=false/.test(scripts)&&/if\(!built\.ok\)throw built\.error/.test(scripts))
];};
