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
];};
