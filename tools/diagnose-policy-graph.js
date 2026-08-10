"use strict";

global.window = {};
global.BellOptimizer = window.BellOptimizer = {};
["bell-mechanics", "target-evaluator", "bell-renewal-candidate-analysis", "bell-renewal-policy", "bell-renewal-policy-approx"].forEach(function (name) {
  require("../js/" + name + ".js");
});

var M = BellOptimizer.bellMechanics;
var A = BellOptimizer.bellRenewalPolicyApprox;
var payouts = Number(process.argv[2] || 709);
var renewalDepth = Number(process.argv[3] || 8);

function rateFor(count) {
  var total = 0;
  for (var i = 0; i < count; i++) total += M.calculateRingingRequirement(i);
  return total + Math.max(1e-7, total * 1e-12);
}

var result = A.solveHybridPolicy({
  selectedRewardIndex: 0,
  currentSelectedLevel: 0,
  rewardLevels: [0, 0, 0, 0, 0, 0, 0],
  currentRawRingIndex: 0,
  currentRingingExp: 0,
  ringingExpPerHour: rateFor(payouts),
  cavernsOwned: 18,
  bellUpgrade42Owned: true,
  bellUpgrade60Owned: true,
  bellUpgrade86Owned: true,
  majorBellBonus: 940,
  currentRenewalCurrency: 200,
  horizonHours: 1
}, {
  maxRenewalsModeled: renewalDepth,
  diagnosticGraphDiscoveryOnly: true,
  diagnosticMaxNonLevelStates: 2000000
});

var p = result.performance || {};
console.log(JSON.stringify({
  payouts: payouts,
  renewalDepth: renewalDepth,
  ok: result.ok,
  status: result.status,
  nodes: p.graphNodesDiscovered,
  edges: p.graphEdgesDiscovered,
  nodesByRenewalDepth: p.nodesByRenewalDepth,
  freshNodesByRenewalDepth: p.freshNodesByRenewalDepth,
  currentRunNodes: p.currentNodes,
  terminalNodes: p.terminalNodes,
  continueEdges: p.continueEdgesDiscovered,
  renewEdges: p.renewEdgesDiscovered,
  uniqueCanonicalFreshStates: p.uniqueFreshSubproblems,
  canonicalKeyRequests: p.canonicalNodeKeyRequests,
  canonicalKeyHits: p.canonicalNodeKeyHits,
  graphMetadataBytesEstimate: p.graphMetadataBytesEstimate,
  discoveryMilliseconds: p.graphDiscoveryMilliseconds,
  valueSurfacesConstructed: p.valueFunctionsConstructed,
  expectationTransforms: p.expectationTransformsActuallyCalculated,
  compressionOperations: p.compressionOperations
}, null, 2));
