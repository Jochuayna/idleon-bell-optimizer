"use strict";
window.BellOptimizer = window.BellOptimizer || {};

// Coordinates active-account replacement without knowing anything about the
// account model or UI.  Derivation happens before capture/commit; a failed
// commit restores the previous stable account (or the captured empty state).
BellOptimizer.activeImportTransaction = (function () {
  function execute(candidate, handlers) {
    handlers = handlers || {};
    var staged, previous = typeof handlers.getCurrent === "function" ? handlers.getCurrent() : null;
    try {
      staged = handlers.stage(candidate);
    } catch (error) {
      if (handlers.onError) handlers.onError("Preparing imported data", error);
      return { ok:false, stage:"Preparing imported data", error:error, rolledBack:false };
    }
    var snapshot = typeof handlers.capture === "function" ? handlers.capture() : null;
    try {
      handlers.commit(staged);
      if (handlers.beforeActivate) handlers.beforeActivate(staged);
      if (handlers.setCurrent) handlers.setCurrent(candidate);
      if (handlers.afterActivate) handlers.afterActivate(staged);
      return { ok:true, staged:staged };
    } catch (error) {
      var rollbackError = null;
      try {
        if (previous && handlers.restorePrevious) handlers.restorePrevious(previous, snapshot);
        else if (handlers.restoreEmpty) handlers.restoreEmpty(snapshot);
        if (handlers.setCurrent) handlers.setCurrent(previous || null);
      } catch (restoreFailure) {
        rollbackError = restoreFailure;
      }
      if (handlers.onError) handlers.onError("Rendering imported data", error, rollbackError);
      return { ok:false, stage:"Rendering imported data", error:error, rollbackError:rollbackError, rolledBack:!rollbackError };
    }
  }
  function normalizedSemanticSnapshot(state) {
    state=state||{};
    function clonePlain(value){return value==null?value:JSON.parse(JSON.stringify(value));}
    return {
      activeAccountId:state.activeAccountId==null?null:String(state.activeAccountId),
      selectedRewardIndex:state.selectedRewardIndex==null?null:Number(state.selectedRewardIndex),
      selectedBellStat:state.selectedBellStat||null,
      dashboardGoal:state.dashboardGoal==null?null:String(state.dashboardGoal),
      workspace:state.workspace||null,
      rateTab:state.rateTab||null,
      benchmarkFingerprint:state.benchmarkFingerprint||null,
      disclosureState:clonePlain(state.disclosureState||{}),
      controlState:clonePlain(state.controlState||{})
    };
  }
  return { execute:execute, normalizedSemanticSnapshot:normalizedSemanticSnapshot };
}());
