"use strict";
window.BellOptimizer = window.BellOptimizer || {};

BellOptimizer.saveImportWorkflow = (function () {
  function safeMessage(error) {
    if (!error) return "Unknown error.";
    if (typeof error === "string") return error.slice(0, 300);
    return String(error.message || error).slice(0, 300);
  }
  var PUBLIC_SAVE_GUIDANCE = "This JSON does not appear to contain a complete IdleOn save. Use IdleOn Toolbox's Copy for Support or a raw-data export.";
  // A failure inside the parsed Holes/Spelunk arrays means the save itself was
  // recognized and a single value could not be read. Name that value instead of
  // telling the player to re-export a save that is already complete.
  function failureMessage(result) {
    var error=result&&result.error,path=error&&typeof error.path==="string"?error.path:"";
    if(!error||path.indexOf("::parsed[")===-1)return PUBLIC_SAVE_GUIDANCE;
    return "This is an IdleOn save, but one Bell value could not be read: "+safeMessage(error)+" ("+path.replace(/^\$\.data\./,"").replace("::parsed","")+")";
  }
  function run(text, handlers) {
    var stage="Parsing JSON";
    try {
      var outer=JSON.parse(text);
      stage="Parsing IdleOn save";
      var result=handlers.parseSave(outer);
      outer=null;
      if(!result||!result.ok){throw new Error(failureMessage(result));}
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
  return {run:run,runDeferred:runDeferred,attach:attach,safeMessage:safeMessage,failureMessage:failureMessage,PUBLIC_SAVE_GUIDANCE:PUBLIC_SAVE_GUIDANCE};
}());
