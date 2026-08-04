"use strict";
window.BellOptimizer = window.BellOptimizer || {};

BellOptimizer.saveImportWorkflow = (function () {
  function safeMessage(error) {
    if (!error) return "Unknown error.";
    if (typeof error === "string") return error.slice(0, 300);
    return String(error.message || error).slice(0, 300);
  }
  var PUBLIC_SAVE_GUIDANCE = "This JSON does not appear to contain a complete IdleOn save. Use IdleOn Toolbox's Copy for Support or a raw-data export.";
  function run(text, handlers) {
    var stage="Parsing JSON";
    try {
      var outer=JSON.parse(text);
      stage="Parsing IdleOn save";
      var result=handlers.parseSave(outer);
      outer=null;
      if(!result||!result.ok){throw new Error(PUBLIC_SAVE_GUIDANCE);}
      stage="Rendering imported data";
      handlers.render(result);
      return {ok:true,result:result};
    } catch(error) {
      if(handlers.onError)handlers.onError(stage,error);
      return {ok:false,stage:stage,error:error};
    }
  }
  function runDeferred(text,handlers) {
    if(handlers.onProgress)handlers.onProgress("Reading save");
    return new Promise(function(resolve){
      setTimeout(function(){
        if(handlers.onProgress)handlers.onProgress("Parsing Bell data");
        resolve(run(text,handlers));
      },0);
    });
  }
  function attach(button, listener) {
    if(!button||typeof button.addEventListener!=="function")return false;
    button.addEventListener("click",listener);return true;
  }
  return {run:run,runDeferred:runDeferred,attach:attach,safeMessage:safeMessage,PUBLIC_SAVE_GUIDANCE:PUBLIC_SAVE_GUIDANCE};
}());
