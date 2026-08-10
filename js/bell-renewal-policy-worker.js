"use strict";
self.window=self;
self.BellOptimizer=self.BellOptimizer||{};
var assetVersion=(function(){try{return new URL(self.location.href).searchParams.get("v")||"";}catch(error){return "";}}());
function versionedAsset(path){return path+(assetVersion?"?v="+encodeURIComponent(assetVersion):"");}
importScripts.apply(null,["bell-mechanics.js","target-evaluator.js","bell-run-forecast.js","bell-renewal-candidate-analysis.js","bell-renewal-policy.js","bell-renewal-policy-approx.js"].map(versionedAsset));
var policyContext={graphLimitKeys:new Set(),shallowSessions:{1:BellOptimizer.bellRenewalPolicyApprox.createEvaluationSession(),2:BellOptimizer.bellRenewalPolicyApprox.createEvaluationSession()}};
self.onmessage=function(event){
  var message=event&&event.data||{};
  if(message.type!=="SOLVE_POLICY")return;
  try{var result=BellOptimizer.bellRenewalPolicyApprox.solvePolicy(message.options,undefined,policyContext);self.postMessage({ok:true,generation:message.generation,result:result});}
  catch(error){self.postMessage({ok:false,generation:message.generation,status:"WORKER_SOLVER_FAILURE",reason:error&&error.message?error.message:"Keep/Renew calculation failed."});}
};
