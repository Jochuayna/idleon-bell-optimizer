"use strict";
window.BellOptimizer=window.BellOptimizer||{};
BellOptimizer.developerMode=(function(){
  function hasDevFlag(search){return /(?:^|[?&])dev=1(?:&|$)/.test(String(search||""));}
  function isAllowed(locationLike){if(!locationLike||!hasDevFlag(locationLike.search))return false;var protocol=String(locationLike.protocol||"").toLowerCase(),hostname=String(locationLike.hostname||"").toLowerCase(),local=protocol==="file:"||hostname==="localhost"||hostname==="127.0.0.1";return local;}
  var enabled=typeof location!=="undefined"&&isAllowed(location);
  function apply(){var panel=typeof document!=="undefined"?document.querySelector("#developer-tools"):null;if(panel)panel.hidden=!enabled;return enabled;}
  return {enabled:enabled,isAllowed:isAllowed,apply:apply};
}());
if(typeof document!=="undefined")BellOptimizer.developerMode.apply();
