"use strict";
global.window={};global.BellOptimizer=window.BellOptimizer={};
["idleon-number-format","bell-mechanics","bell-rate-upgrade-candidates","bell-rate-section","bell-account-validation"].forEach(function(name){require("../js/"+name+".js");});
function validateBellAccount(parsedSaveObject){return BellOptimizer.bellAccountValidation.build(parsedSaveObject);}
function printBellAccountReport(parsedSaveObject){var report=validateBellAccount(parsedSaveObject),text=BellOptimizer.bellAccountValidation.format(report,BellOptimizer.idleonNumberFormat.format);console.log(text);return report;}
module.exports={validateBellAccount:validateBellAccount,printBellAccountReport:printBellAccountReport};
if(require.main===module)console.log("Developer helper loaded. Require this module and pass an already-parsed Bell save object; no fixture is loaded automatically.");
