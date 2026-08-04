"use strict";
window.BellOptimizer = window.BellOptimizer || {};

BellOptimizer.saveImportWorkflow = (function () {
  function safeMessage(error) {
    if (!error) return "Unknown error.";
    if (typeof error === "string") return error.slice(0, 300);
    return String(error.message || error).slice(0, 300);
  }
  function run(text, handlers) {
    var stage="Parsing JSON";
    try {
      JSON.parse(text);
      stage="Parsing IdleOn save";
      var result=handlers.parseSave(text);
      if(!result||!result.ok){var parserError=result&&result.error,publicNestedFormatError=parserError&&typeof parserError.path==="string"&&parserError.path.indexOf("$.data.")===0;throw new Error(parserError?(publicNestedFormatError?"This save contains Idleon data in an unsupported or incomplete format. Try exporting a fresh JSON save.":parserError.message+(parserError.path?" Path: "+parserError.path:"")):"The save parser returned no result.");}
      stage="Rendering imported data";
      handlers.render(result);
      return {ok:true,result:result};
    } catch(error) {
      if(handlers.onError)handlers.onError(stage,error);
      return {ok:false,stage:stage,error:error};
    }
  }
  function attach(button, listener) {
    if(!button||typeof button.addEventListener!=="function")return false;
    button.addEventListener("click",listener);return true;
  }
  return {run:run,attach:attach,safeMessage:safeMessage};
}());
