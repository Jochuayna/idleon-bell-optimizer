"use strict";
window.BellOptimizer = window.BellOptimizer || {};

BellOptimizer.jsonInspector = (function () {
  var MAX_RESULTS = 200;
  var MAX_NODES = 100000;
  var MAX_DEPTH = 100;
  var MAX_SERIALIZED_DEPTH = 10;
  var LIKELY_TERMS = ["bell", "hole", "holes", "cavern", "ring", "clean", "lantern", "lamp", "torch", "rupie", "harp", "villager", "fountain"];
  var loadedJson = null;
  var loadedJsonText = "";
  var loadedSource = "";
  var parsedValues = new Map();
  var parsedHoles = null;
  var browserHistory = [];
  var browserPageStart = 0;
  var browserSourceParsed = false;

  function isNumber(value) { return typeof value === "number" && Number.isFinite(value); }
  function joinPath(parent, key, isArrayIndex) {
    if (isArrayIndex) return parent + "[" + key + "]";
    return parent + (/^[A-Za-z_$][\w$]*$/.test(key) ? "." + key : "[" + JSON.stringify(key) + "]");
  }
  function preview(value, limit) {
    var text;
    try { text = JSON.stringify(value); } catch (error) { text = String(value); }
    if (text === undefined) text = String(value);
    limit = limit || 500;
    return text.length > limit ? text.slice(0, limit - 3) + "..." : text;
  }
  function parsedStringValue(value) {
    if (typeof value !== "string") return null;
    var trimmed = value.trim();
    if (trimmed.charAt(0) !== "[" && trimmed.charAt(0) !== "{") return null;
    try {
      var parsed = JSON.parse(trimmed);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch (error) { return null; }
  }
  function isOpenableValue(value) { return Array.isArray(value) || (value !== null && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype); }
  function resultActionType(value) { return isOpenableValue(value) ? "open" : parsedStringValue(value) ? "parse" : null; }
  function getViewerPage(value, start, limit) {
    var keys = isOpenableValue(value) ? Object.keys(value) : [];
    var safeStart = Math.max(0, Math.min(Math.floor(Number(start) || 0), Math.max(0, keys.length - 1)));
    var pageKeys = keys.slice(safeStart, safeStart + limit);
    return { value: value, total: keys.length, start: safeStart, end: safeStart + pageKeys.length, keys: pageKeys };
  }
  function findTextMatches(root, query) {
    var needle = String(query || "").trim().toLowerCase(); var matches = [];
    if (!needle) return matches;
    walk(root, function (value, path, property, parsed) {
      if (String(property).toLowerCase().includes(needle) || (typeof value === "string" && value.toLowerCase().includes(needle))) matches.push({ path: path, value: value, parsed: parsed });
      return matches.length < MAX_RESULTS * 5;
    });
    return matches;
  }

  function parseSerializedJson(value, originalPath) {
    if (typeof value !== "string") return { ok: false, code: "NOT_A_STRING", error: "The selected value is not a serialized JSON string.", path: originalPath };
    var trimmed = value.trim();
    if (!trimmed) return { ok: false, code: "EMPTY_SERIALIZED_JSON", error: "The selected string is empty and cannot be parsed as serialized JSON.", path: originalPath };
    try {
      return { ok: true, value: JSON.parse(trimmed), originalPath: originalPath, parsedPath: originalPath + "::parsed" };
    } catch (error) {
      return { ok: false, code: "INVALID_SERIALIZED_JSON", error: "The string at " + originalPath + " is not valid serialized JSON: " + error.message, path: originalPath };
    }
  }

  function walk(root, visitor, options) {
    options = options || {};
    var rootPath = options.rootPath || "$";
    var stack = [{ value: root, path: rootPath, property: rootPath, depth: 0, serializedDepth: options.serializedDepth || 0, parsed: options.parsed || false }];
    var visited = 0;
    var limitedByDepth = false;
    while (stack.length && visited < MAX_NODES) {
      var item = stack.pop();
      visited += 1;
      if (visitor(item.value, item.path, item.property, item.parsed) === false) break;
      if (item.depth >= MAX_DEPTH) { limitedByDepth = true; continue; }

      var serialized = item.serializedDepth < MAX_SERIALIZED_DEPTH ? parsedStringValue(item.value) : null;
      if (serialized) {
        var parsedPath = item.path + "::parsed";
        parsedValues.set(parsedPath, serialized);
        stack.push({ value: serialized, path: parsedPath, property: "::parsed", depth: item.depth + 1, serializedDepth: item.serializedDepth + 1, parsed: true });
      }
      if (item.value && typeof item.value === "object") {
        var keys = Object.keys(item.value);
        for (var i = keys.length - 1; i >= 0; i -= 1) {
          var key = keys[i];
          stack.push({ value: item.value[key], path: joinPath(item.path, key, Array.isArray(item.value)), property: key, depth: item.depth + 1, serializedDepth: item.serializedDepth, parsed: item.parsed });
        }
      }
    }
    return { visited: visited, truncated: stack.length > 0, limitedByDepth: limitedByDepth };
  }

  function refreshParsedIndex() {
    parsedValues = new Map();
    if (loadedJson !== null) walk(loadedJson, function () {});
    parsedHoles = parsedValues.get("$.data.Holes::parsed") || null;
    document.querySelector("#parsed-holes-control").hidden = parsedHoles === null;
    if (parsedHoles === null) closeParsedBrowser();
  }

  function parseText(text, sourceName) {
    if (!text.trim()) {
      loadedJson = null; loadedJsonText = ""; loadedSource = ""; parsedValues = new Map(); parsedHoles = null;
      updateExportAvailability();
      document.querySelector("#parsed-holes-control").hidden = true;
      setStatus("error", "No JSON was provided."); render([], "No results"); return false;
    }
    try {
      loadedJson = JSON.parse(text);
      loadedJsonText = text;
      loadedSource = sourceName;
      updateExportAvailability();
      refreshParsedIndex();
      var stats = walk(loadedJson, function () {});
      var parsedCount = parsedValues.size;
      setStatus("success", "Valid JSON loaded from " + sourceName + ". Inspected " + stats.visited.toLocaleString() + (stats.truncated ? "+" : "") + " nodes and found " + parsedCount + " serialized JSON value" + (parsedCount === 1 ? "" : "s") + ".");
      render([], parsedHoles ? "Parsed $.data.Holes is ready to browse or search." : "JSON loaded. No parseable serialized value was found at $.data.Holes.");
      return true;
    } catch (error) {
      loadedJson = null; loadedJsonText = ""; loadedSource = ""; parsedValues = new Map(); parsedHoles = null;
      updateExportAvailability();
      document.querySelector("#parsed-holes-control").hidden = true;
      closeParsedBrowser(); setStatus("error", "Invalid JSON: " + error.message); render([], "Fix the JSON error and try again."); return false;
    }
  }

  function setStatus(type, text) {
    var status = document.querySelector("#json-status");
    status.className = "inspector-status " + type;
    status.textContent = text;
  }
  function createFullExportPayload(originalText) {
    if (typeof originalText !== "string" || !originalText.trim()) return { ok: false, error: "No valid loaded JSON is available to export." };
    try { return { ok: true, text: originalText, root: JSON.parse(originalText) }; }
    catch (error) { return { ok: false, error: "The loaded JSON is no longer valid: " + error.message }; }
  }
  function isFullExportAvailable(root, originalText) { return root !== null && typeof originalText === "string" && originalText.trim().length > 0; }
  function updateExportAvailability() {
    var button = document.querySelector("#export-loaded-json");
    if (button) button.disabled = !isFullExportAvailable(loadedJson, loadedJsonText);
  }
  function downloadText(filename, text) {
    var blob = new Blob([text], { type: "application/json" }); var url = URL.createObjectURL(blob); var link = document.createElement("a");
    link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 0);
  }
  function requestFullExport() {
    if (loadedJson === null || !loadedJsonText) { setStatus("error", "Load valid JSON before exporting it."); return; }
    document.querySelector("#full-export-confirmation").hidden = false;
  }
  function confirmFullExport() {
    var payload = createFullExportPayload(loadedJsonText);
    if (!payload.ok) { setStatus("error", payload.error); return; }
    downloadText("idleon-save-debug.json", payload.text); document.querySelector("#full-export-confirmation").hidden = true;
    setStatus("success", "Downloaded the complete original loaded JSON as idleon-save-debug.json.");
  }
  function loadLocalDebugFixture() {
    var status = document.querySelector("#debug-fixture-status");
    status.textContent = "Trying to load reference/idleon-save-debug.json…";
    fetch("reference/idleon-save-debug.json", { cache: "no-store" }).then(function (response) {
      if (!response.ok) throw new Error("HTTP " + response.status);
      return response.text();
    }).then(function (text) {
      if (parseText(text, "local debug fixture")) status.textContent = "Loaded reference/idleon-save-debug.json locally after your explicit request.";
    }).catch(function (error) {
      status.textContent = location.protocol === "file:" ? "The browser blocked or could not find the local fixture under file://. Choose idleon-save-debug.json with the normal file picker instead. Nothing was loaded." : "Could not load reference/idleon-save-debug.json: " + error.message;
    });
  }

  function createResult(item) {
    var details = document.createElement("details"); details.className = "json-result";
    var summary = document.createElement("summary");
    var pathWrap = document.createElement("span"); pathWrap.className = "result-path";
    var path = document.createElement("code"); path.textContent = item.path; pathWrap.appendChild(path);
    if (item.parsed || item.path.includes("::parsed")) { var badge = document.createElement("span"); badge.className = "parsed-badge"; badge.textContent = "Parsed from serialized JSON"; pathWrap.appendChild(badge); }
    var label = document.createElement("span"); label.className = "result-label"; label.textContent = item.label || "Match";
    summary.appendChild(pathWrap); summary.appendChild(label); details.appendChild(summary);
    if (item.reasons && item.reasons.length) {
      var reasons = document.createElement("ul");
      item.reasons.forEach(function (reason) { var li = document.createElement("li"); li.textContent = reason; reasons.appendChild(li); });
      details.appendChild(reasons);
    }
    var value = document.createElement("pre"); value.textContent = preview(item.value); details.appendChild(value);
    var actionType = resultActionType(item.value);
    if (actionType === "open") {
      var openButton = document.createElement("button");
      openButton.type = "button"; openButton.className = "secondary-button open-result-button"; openButton.textContent = "Open Value";
      openButton.addEventListener("click", function () { openParsedValue(item.value, item.path, false); setStatus("success", "Opened " + item.path + " without modifying the loaded JSON."); });
      details.appendChild(openButton);
    } else if (actionType === "parse") {
      var parseButton = document.createElement("button");
      parseButton.type = "button";
      parseButton.className = "secondary-button parse-result-button";
      parseButton.textContent = "Parse and Open";
      parseButton.addEventListener("click", function () {
        var parsedResult = parseSerializedJson(item.value, item.path);
        if (!parsedResult.ok) { setStatus("error", parsedResult.error); return; }
        parsedValues.set(parsedResult.parsedPath, parsedResult.value);
        openParsedValue(parsedResult.value, parsedResult.parsedPath, true);
        setStatus("success", "Parsed and opened serialized JSON from " + item.path + ".");
      });
      details.appendChild(parseButton);
    }
    return details;
  }

  function render(results, emptyMessage, total) {
    var output = document.querySelector("#json-results"); var count = document.querySelector("#result-count"); output.replaceChildren();
    var shown = results.slice(0, MAX_RESULTS); count.textContent = shown.length ? shown.length + (total > shown.length ? " of " + total : "") + " shown" : "";
    if (!shown.length) { var message = document.createElement("p"); message.className = "muted"; message.textContent = emptyMessage || "No matches found."; output.appendChild(message); return; }
    shown.forEach(function (item) { output.appendChild(createResult(item)); });
    if (total > MAX_RESULTS) { var limit = document.createElement("p"); limit.className = "limit-warning"; limit.textContent = "Display limited to " + MAX_RESULTS + " results. Refine the search to see a smaller set."; output.appendChild(limit); }
  }

  function requireJson() { if (loadedJson === null) { setStatus("error", "Load valid JSON before using the inspector."); return false; } return true; }
  function parseSequence(text) {
    var parts = text.split(",").map(function (part) { return part.trim(); }).filter(Boolean);
    if (parts.length !== 7 || parts.some(function (part) { return !Number.isFinite(Number(part)); })) return null;
    return parts.map(Number);
  }
  function sequenceWindows(array, path, parsed) {
    var found = [];
    if (!Array.isArray(array) || array.length < 7) return found;
    for (var i = 0; i <= array.length - 7; i += 1) {
      var values = array.slice(i, i + 7);
      if (values.every(isNumber)) found.push({ path: array.length === 7 ? path : path + "[" + i + ".." + (i + 6) + "]", value: values, parentLength: array.length, parsed: parsed });
    }
    return found;
  }

  function search(parsedHolesOnly) {
    if (!requireJson()) return;
    if (parsedHolesOnly && parsedHoles === null) { setStatus("error", "No parseable serialized JSON is loaded at $.data.Holes."); return; }
    var textQuery = document.querySelector("#json-text-search").value.trim().toLowerCase();
    var numericRaw = document.querySelector("#json-number-search").value.trim();
    var sequenceRaw = document.querySelector("#json-sequence-search").value.trim();
    var numeric = numericRaw === "" ? null : Number(numericRaw);
    var sequence = sequenceRaw === "" ? null : parseSequence(sequenceRaw);
    if (!textQuery && numeric === null && !sequenceRaw) { setStatus("error", "Enter at least one search value."); return; }
    if (numericRaw && !Number.isFinite(numeric)) { setStatus("error", "The numeric search value is invalid."); return; }
    if (sequenceRaw && !sequence) { setStatus("error", "The sequence must contain exactly seven valid numbers separated by commas."); return; }
    var results = [];
    var root = parsedHolesOnly ? parsedHoles : loadedJson;
    var options = parsedHolesOnly ? { rootPath: "$.data.Holes::parsed", parsed: true, serializedDepth: 1 } : {};
    var stats = walk(root, function (value, path, property, parsed) {
      var matched = false; var reasons = [];
      if (textQuery && (String(property).toLowerCase().includes(textQuery) || (typeof value === "string" && value.toLowerCase().includes(textQuery)))) { matched = true; reasons.push("Property name or text value contains '" + textQuery + "'."); }
      if (numeric !== null && isNumber(value) && value === numeric) { matched = true; reasons.push("Numeric value exactly equals " + numeric + "."); }
      if (sequence && Array.isArray(value)) sequenceWindows(value, path, parsed).forEach(function (window) { if (window.value.every(function (number, index) { return number === sequence[index]; })) results.push({ path: window.path, value: window.value, parsed: window.parsed, label: "Seven-number sequence", reasons: [window.parentLength === 7 ? "The full array matches the requested sequence." : "A consecutive portion of a larger array matches the requested sequence."] }); });
      if (matched) results.push({ path: path, value: value, parsed: parsed, label: "Search match", reasons: reasons });
      return results.length < MAX_RESULTS * 5;
    }, options);
    setStatus("success", (parsedHolesOnly ? "Parsed Holes search" : "Search") + " completed locally" + (stats.truncated ? " with the 100,000-node safety limit applied." : "."));
    render(results, "No matching paths or values found.", results.length);
  }

  function pathReasons(path) { var lower = path.toLowerCase(); var terms = LIKELY_TERMS.filter(function (term) { return lower.includes(term); }); return terms.length ? ["Path contains likely Bell-related term(s): " + terms.join(", ") + "."] : []; }
  function manualLevels() { return [1,2,3,4,5,6,7].map(function (index) { var raw = document.querySelector('[name="reward' + index + '"]').value.trim(); return raw === "" ? null : Number(raw); }); }

  function collectCandidates() {
    var candidates = []; var manual = manualLevels(); var hasManual = manual.every(isNumber);
    walk(loadedJson, function (value, path, property, parsed) {
      if (Array.isArray(value)) {
        sequenceWindows(value, path, parsed).forEach(function (window) {
          var reasons = pathReasons(window.path); reasons.push(window.parentLength === 7 ? "Structure is an array containing exactly seven numeric values." : "Structure is a consecutive group of seven numeric values inside a larger array.");
          if (hasManual && window.value.every(function (number, index) { return number === manual[index]; })) reasons.push("Values exactly match the manually entered Bell reward levels.");
          else if (hasManual && window.value.some(function (number, index) { return number === manual[index]; })) reasons.push("One or more values match manual levels in the same positions.");
          candidates.push({ path: window.path, value: window.value, parsed: window.parsed, label: "Unconfirmed array candidate", reasons: reasons, score: reasons.length * 10 + pathReasons(window.path).length * 10 });
        });
      } else if (value && typeof value === "object") {
        var keys = Object.keys(value);
        if (keys.length === 7 && keys.every(function (key) { return isNumber(value[key]); })) { var objectReasons = pathReasons(path); objectReasons.push("Structure is an object with exactly seven numeric properties."); candidates.push({ path: path, value: value, parsed: parsed, label: "Unconfirmed object candidate", reasons: objectReasons, score: objectReasons.length * 10 + pathReasons(path).length * 10 }); }
      }
      return candidates.length < MAX_RESULTS * 5;
    });
    candidates.sort(function (a, b) { return b.score - a.score || a.path.localeCompare(b.path); }); return candidates;
  }
  function findCandidates() { if (!requireJson()) return; var candidates = collectCandidates(); setStatus("success", "Candidate scan completed across outer and parsed serialized JSON. Every result remains heuristic and unconfirmed."); render(candidates, "No seven-number candidate structures were found.", candidates.length); }
  function sortedNumbers(values) { return values.slice().sort(function (a, b) { return a - b; }); }
  function compareManual() {
    if (!requireJson()) return; var manual = manualLevels(); if (!manual.every(isNumber)) { setStatus("error", "Enter all seven manual Bell reward levels before comparing."); return; }
    var sortedManual = sortedNumbers(manual); var comparisons = [];
    collectCandidates().forEach(function (candidate) {
      if (!Array.isArray(candidate.value)) return; var values = candidate.value;
      var positional = values.reduce(function (count, value, index) { return count + (value === manual[index] ? 1 : 0); }, 0);
      var distance = values.reduce(function (sum, value, index) { return sum + Math.abs(value - manual[index]); }, 0);
      var reordered = sortedNumbers(values).every(function (value, index) { return value === sortedManual[index]; });
      var label = positional === 7 ? "Exact match" : reordered ? "Same numbers in a different order" : positional > 0 ? "Partial match (" + positional + "/7 positions)" : "Nearest numeric match (distance " + distance + ")";
      comparisons.push({ path: candidate.path, value: values, parsed: candidate.parsed, label: label, reasons: ["Total position-by-position numeric distance: " + distance + "."], rank: positional === 7 ? 0 : reordered ? 1 : positional > 0 ? 2 : 3, positional: positional, distance: distance });
    });
    comparisons.sort(function (a, b) { return a.rank - b.rank || b.positional - a.positional || a.distance - b.distance || a.path.localeCompare(b.path); });
    setStatus("success", "Manual comparison completed across outer and parsed serialized JSON. No fields were changed."); render(comparisons, "No candidate seven-number arrays were available to compare.", comparisons.length);
  }

  function valueType(value) { return Array.isArray(value) ? "Array" : value === null ? "Null" : typeof value === "object" ? "Object" : typeof value; }
  function openParsedValue(value, parsedPath, parsedSource) { browserHistory = [{ value: value, path: parsedPath }]; browserPageStart = 0; browserSourceParsed = parsedSource === undefined ? parsedPath.includes("::parsed") : Boolean(parsedSource); document.querySelector("#parsed-value-browser").hidden = false; renderParsedBrowser(); }
  function openParsedBrowser() { if (parsedHoles === null) { setStatus("error", "No parseable serialized JSON is loaded at $.data.Holes."); return; } openParsedValue(parsedHoles, "$.data.Holes::parsed"); }
  function closeParsedBrowser() { document.querySelector("#parsed-value-browser").hidden = true; browserHistory = []; }
  function navigateParsed(value, path) { browserHistory.push({ value: value, path: path }); browserPageStart = 0; renderParsedBrowser(); }
  function renderParsedBrowser() {
    if (!browserHistory.length) return;
    var current = browserHistory[browserHistory.length - 1]; var value = current.value; var keys = value && typeof value === "object" ? Object.keys(value) : [];
    document.querySelector("#parsed-value-path").textContent = current.path;
    document.querySelector("#value-browser-badge").textContent = browserSourceParsed ? "Parsed from serialized JSON" : "Direct JSON value";
    document.querySelector("#parsed-value-type").textContent = valueType(value);
    document.querySelector("#parsed-value-length").textContent = Array.isArray(value) ? "Length: " + value.length : value && typeof value === "object" ? "Properties: " + keys.length : "Value";
    document.querySelector("#parsed-browser-back").disabled = browserHistory.length <= 1;
    var crumbs = document.querySelector("#parsed-breadcrumbs"); crumbs.replaceChildren();
    browserHistory.forEach(function (entry, index) { var button = document.createElement("button"); button.type = "button"; button.className = "breadcrumb-button"; button.textContent = index === 0 ? entry.path : entry.path.slice(browserHistory[index - 1].path.length); button.addEventListener("click", function () { browserHistory = browserHistory.slice(0, index + 1); renderParsedBrowser(); }); crumbs.appendChild(button); });
    var children = document.querySelector("#parsed-children"); children.replaceChildren();
    var page = getViewerPage(value, browserPageStart, MAX_RESULTS);
    var controls = document.querySelector("#value-page-controls"); controls.hidden = keys.length <= MAX_RESULTS; document.querySelector("#value-page-start").value = String(page.start);
    page.keys.forEach(function (key) {
      var child = value[key]; var path = joinPath(current.path, key, Array.isArray(value)); var row = document.createElement("div"); row.className = "parsed-child";
      var info = document.createElement("div"); var keyCode = document.createElement("code"); keyCode.textContent = Array.isArray(value) ? "[" + key + "]" : key; var short = document.createElement("span"); short.textContent = valueType(child) + " - " + preview(child, 120); info.appendChild(keyCode); info.appendChild(short); row.appendChild(info);
      if (child && typeof child === "object") { var drill = document.createElement("button"); drill.type = "button"; drill.className = "secondary-button drill-button"; drill.textContent = "Open"; drill.addEventListener("click", function () { navigateParsed(child, path); }); row.appendChild(drill); }
      children.appendChild(row);
    });
    if (keys.length > MAX_RESULTS) { var warning = document.createElement("p"); warning.className = "limit-warning"; warning.textContent = "Showing entries " + (page.start + 1) + "–" + page.end + " of " + page.total + ". The underlying value is unchanged."; children.appendChild(warning); }
  }

  function loadFile(file) { var reader = new FileReader(); reader.onload = function () { parseText(String(reader.result), file.name); }; reader.onerror = function () { setStatus("error", "The selected file could not be read."); }; reader.readAsText(file); }
  function initialize() {
    var fileInput = document.querySelector("#json-file"); var pasteArea = document.querySelector("#json-paste");
    fileInput.addEventListener("change", function () { if (fileInput.files.length) loadFile(fileInput.files[0]); });
    pasteArea.addEventListener("change", function () { if (pasteArea.value.trim()) parseText(pasteArea.value, "pasted JSON"); });
    document.querySelector("#inspect-pasted-json").addEventListener("click", function () { parseText(pasteArea.value, "pasted JSON"); });
    document.querySelector("#run-json-search").addEventListener("click", function () { search(false); });
    document.querySelector("#search-parsed-holes").addEventListener("click", function () { search(true); });
    document.querySelector("#find-bell-candidates").addEventListener("click", findCandidates);
    document.querySelector("#compare-manual-levels").addEventListener("click", compareManual);
    document.querySelector("#open-parsed-holes").addEventListener("click", openParsedBrowser);
    document.querySelector("#close-parsed-browser").addEventListener("click", closeParsedBrowser);
    document.querySelector("#parsed-browser-back").addEventListener("click", function () { if (browserHistory.length > 1) { browserHistory.pop(); renderParsedBrowser(); } });
    document.querySelector("#show-value-page").addEventListener("click", function () { browserPageStart = Math.max(0, Math.floor(Number(document.querySelector("#value-page-start").value) || 0)); renderParsedBrowser(); });
    document.querySelector("#copy-opened-value").addEventListener("click", function () { if (!browserHistory.length) return; var text = JSON.stringify(browserHistory[browserHistory.length - 1].value, null, 2); if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { setStatus("success", "Copied the opened value only."); }, function () { setStatus("error", "The browser blocked clipboard access."); }); });
    document.querySelector("#export-loaded-json").addEventListener("click", requestFullExport);
    document.querySelector("#confirm-full-export").addEventListener("click", confirmFullExport);
    document.querySelector("#cancel-full-export").addEventListener("click", function () { document.querySelector("#full-export-confirmation").hidden = true; });
    document.querySelector("#load-debug-fixture").addEventListener("click", loadLocalDebugFixture);
    updateExportAvailability();
  }
  if (BellOptimizer.developerMode && BellOptimizer.developerMode.enabled) initialize();
  return { parseText: parseText, parseSerializedJson: parseSerializedJson, search: search, findCandidates: findCandidates, compareManual: compareManual, openParsedValue: openParsedValue, isOpenableValue: isOpenableValue, resultActionType: resultActionType, getViewerPage: getViewerPage, findTextMatches: findTextMatches, createFullExportPayload: createFullExportPayload, isFullExportAvailable: isFullExportAvailable };
}());
