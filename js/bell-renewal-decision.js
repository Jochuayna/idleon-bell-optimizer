"use strict";
window.BellOptimizer=window.BellOptimizer||{};
BellOptimizer.bellRenewalDecision=(function(){
  var DEFAULT_TIMEOUT_MS=45000;
  var ASSET_VERSION=(function(){if(typeof document==="undefined"||!document.currentScript)return "";try{return new URL(document.currentScript.src,location.href).searchParams.get("v")||"";}catch(error){return "";}}());
  function versionedAsset(path){return path+(ASSET_VERSION?"?v="+encodeURIComponent(ASSET_VERSION):"");}
  function finite(value){return typeof value==="number"&&Number.isFinite(value);}
  function unavailable(message,detail,tooClose){return {status:"unavailable",confidence:"UNAVAILABLE",headline:tooClose?"TOO CLOSE TO CALL":"DECISION UNAVAILABLE",confidenceLabel:tooClose?"Model completed":"Unavailable",reason:message||"The Keep/Renew decision is unavailable for this state.",detail:detail||null};}
  function decisionZone(result){var rows=result&&result.shallowResults||[],last=rows[rows.length-1],region=result&&result.sharedReservationRegions,detail=last?{backend:"HYBRID_SHALLOW_DIRECTIONAL",continueEstimate:null,continueLower:last.continueValueLowerBound,continueUpper:last.continueValueUpperBound,renewEstimate:null,renewLower:last.renewValueLowerBound,renewUpper:last.renewValueUpperBound,warning:region&&region.unresolvedThrough!=null?"Your reward level is inside the unresolved reservation-threshold band through level "+region.unresolvedThrough+".":"Shallow Renewal depths could not separate the immediate choices."}:null;return {status:"uncertain",confidence:"DIRECTIONAL_ONLY",headline:"DECISION ZONE",confidenceLabel:"Model uncertainty",reason:"The Keep/Renew model can't separate the two choices confidently at your current reward level.",detail:detail,action:null};}
  function buildPolicyOptions(snapshot,rewardIndex){
    if(!snapshot||!Array.isArray(snapshot.rewardLevels)||!Number.isInteger(rewardIndex)||rewardIndex<0||rewardIndex>6)return {ok:false,error:"The selected Bell reward is unavailable."};
    var options={selectedRewardIndex:rewardIndex,currentSelectedLevel:snapshot.rewardLevels[rewardIndex],rewardLevels:snapshot.rewardLevels.slice(0,7),currentRawRingIndex:snapshot.currentRawRingIndex,currentRingingExp:snapshot.currentRingingExp,ringingExpPerHour:snapshot.ringingExpPerHour,currentRenewalCurrency:snapshot.currentRenewalCurrency,cavernsOwned:snapshot.cavernsOwned,bellUpgrade42Owned:snapshot.bellUpgrade42Owned,bellUpgrade60Owned:snapshot.bellUpgrade60Owned,bellUpgrade86Owned:snapshot.bellUpgrade86Owned,majorBellBonus:snapshot.majorBellBonus};
    if(!Number.isSafeInteger(options.currentSelectedLevel)||options.currentSelectedLevel<0)return {ok:false,error:"The selected reward level cannot be evaluated safely."};
    if(!Number.isInteger(options.currentRawRingIndex)||options.currentRawRingIndex<0||!finite(options.currentRingingExp)||options.currentRingingExp<0||!finite(options.ringingExpPerHour)||options.ringingExpPerHour<=0||!finite(options.currentRenewalCurrency)||options.currentRenewalCurrency<0)return {ok:false,error:"The imported Bell run state is incomplete."};
    return {ok:true,options:options};
  }
  function normalize(result){
    if(!result||!result.ok){if(result&&["SHALLOW_POLICY_UNRESOLVED","SHALLOW_POLICY_ACTION_CHANGED"].indexOf(result.status)>=0)return decisionZone(result);return unavailable(result&&result.reason||"The Keep/Renew calculation could not be completed.",result&&result.status);}
    var backend=result.backend||(/HYBRID/.test(result.status||"")?"HYBRID_APPROXIMATE":"EXACT");
    var detail={backend:backend,continueEstimate:backend==="EXACT"?result.expectedTerminalLevelIfContinueNow:result.continueValueEstimate,continueLower:backend==="EXACT"?result.expectedTerminalLevelIfContinueNow:result.continueValueLowerBound,continueUpper:backend==="EXACT"?result.expectedTerminalLevelIfContinueNow:result.continueValueUpperBound,renewEstimate:backend==="EXACT"?result.expectedTerminalLevelIfRenewNow:result.renewValueEstimate,renewLower:backend==="EXACT"?result.expectedTerminalLevelIfRenewNow:result.renewValueLowerBound,renewUpper:backend==="EXACT"?result.expectedTerminalLevelIfRenewNow:result.renewValueUpperBound,warning:null};
    if(result.action==="POLICY_UNCERTAIN_APPROX"||result.action==="INDIFFERENT")return unavailable("Continuing and renewing are too close to separate confidently.",result.action,true);
    if(result.action==="RENEW_FAVORED_BUT_UNAVAILABLE"){
      detail.warning="The model favors renewing, but you do not currently have enough Renewal currency.";
      return {status:"ready",confidence:"DIRECTIONAL_ONLY",headline:"RENEW IS FAVORED",confidenceLabel:"Directional",reason:detail.warning,detail:detail,action:"RENEW_FAVORED_BUT_UNAVAILABLE"};
    }
    if(result.action!=="CONTINUE"&&result.action!=="RENEW_NOW")return unavailable("The Keep/Renew calculation is unavailable for this state.",result.action);
    var directional=Boolean(result.renewalLimitBindingPossible||result.renewalLimitBindingObserved||result.highVarianceDecision);
    var confidence=directional?"DIRECTIONAL_ONLY":backend==="EXACT"?"CERTIFIED":"HIGH_CONFIDENCE";
    var keep=result.action==="CONTINUE";
    if(directional)detail.warning=result.renewalLimitBindingPossible||result.renewalLimitBindingObserved?"The modeled Renewal depth may affect the long-horizon value.":"An imminent high-variance payout makes this direction less certain.";
    return {status:"ready",confidence:confidence,headline:directional?(keep?"KEEP IS FAVORED":"RENEW IS FAVORED"):(keep?"KEEP RINGING":"RENEW NOW"),confidenceLabel:directional?"Directional":"High confidence",reason:keep?"Continuing has a higher modeled expected value than renewing now from your current account state.":"A fresh run has a higher modeled expected value than continuing this run from your current account state.",detail:detail,action:result.action};
  }
  function createController(config){
    config=config||{};var worker=null,workerAccountKey=null,generation=0,timer=null,onState=typeof config.onState==="function"?config.onState:function(){},usesDefaultWorker=!config.workerFactory,workerFactory=config.workerFactory||function(){return new Worker(versionedAsset("js/bell-renewal-policy-worker.js"));},timeoutMs=finite(config.timeoutMs)?config.timeoutMs:DEFAULT_TIMEOUT_MS,setTimer=config.setTimer||setTimeout,clearTimer=config.clearTimer||clearTimeout,protocol=config.protocol!==undefined?config.protocol:(typeof location!=="undefined"?location.protocol:"");
    function accountKey(snapshot){return JSON.stringify({rewardLevels:snapshot.rewardLevels,raw:snapshot.currentRawRingIndex,exp:snapshot.currentRingingExp,rate:snapshot.ringingExpPerHour,currency:snapshot.currentRenewalCurrency,caverns:snapshot.cavernsOwned,u42:snapshot.bellUpgrade42Owned,u60:snapshot.bellUpgrade60Owned,u86:snapshot.bellUpgrade86Owned,major:snapshot.majorBellBonus});}
    function clearTimerOnly(){if(timer!==null){clearTimer(timer);timer=null;}}
    function stopWorker(){if(worker){worker.terminate();worker=null;}workerAccountKey=null;}
    function invalidate(){generation++;clearTimerOnly();stopWorker();return generation;}
    function evaluate(snapshot,rewardIndex){
      var built=buildPolicyOptions(snapshot,rewardIndex),requestGeneration=++generation,key=built.ok?accountKey(snapshot):null;clearTimerOnly();if(worker&&workerAccountKey!==key)stopWorker();
      if(!built.ok){var bad=unavailable(built.error,"INVALID_ADAPTER_INPUT");onState(bad);return {generation:requestGeneration,cancel:invalidate};}
      if(usesDefaultWorker&&protocol==="file:"){onState(unavailable("The Keep/Renew model requires localhost or the published site. The run forecast below is still available.","FILE_WORKER_UNAVAILABLE"));return {generation:requestGeneration,cancel:invalidate};}
      var preparing=!worker;onState({status:"loading",confidence:null,headline:preparing?"Preparing your Keep/Renew model…":"Updating Keep/Renew…",confidenceLabel:"",reason:preparing?"This first analysis can take a little while on advanced accounts. Once ready, switching rewards is fast. The run forecast is available below while this finishes.":"Using the prepared account model for this reward."});
      if(!worker){try{worker=workerFactory();workerAccountKey=key;}catch(error){onState(unavailable("Keep/Renew could not start in this browser.","WORKER_START_FAILED"));return {generation:requestGeneration,cancel:invalidate};}worker.onmessage=function(event){var payload=event&&event.data||{};if(payload.generation!==generation)return;clearTimerOnly();onState(payload.ok===false?unavailable(payload.reason||"The Keep/Renew calculation failed.",payload.status):normalize(payload.result));};worker.onerror=function(){clearTimerOnly();stopWorker();onState(unavailable("Keep/Renew could not be calculated. The run forecast is still available.","WORKER_FAILED"));};}
      timer=setTimer(function(){if(requestGeneration!==generation)return;clearTimerOnly();stopWorker();onState(unavailable("Keep/Renew took too long to calculate. The run forecast is still available.","POLICY_TIMEOUT"));},timeoutMs);
      worker.postMessage({type:"SOLVE_POLICY",generation:requestGeneration,options:built.options});
      return {generation:requestGeneration,cancel:invalidate};
    }
    return {evaluate:evaluate,invalidate:invalidate,get generation(){return generation;}};
  }
  return {DEFAULT_TIMEOUT_MS:DEFAULT_TIMEOUT_MS,buildPolicyOptions:buildPolicyOptions,normalize:normalize,createController:createController};
}());
