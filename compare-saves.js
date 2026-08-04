"use strict";
window.BellOptimizer = window.BellOptimizer || {};

BellOptimizer.saveComparison = (function () {
  var MAX_DISPLAYED = 500;
  var MAX_NODES = 100000;
  var MISSING = { missing: true };
  var saves = { a: null, b: null };
  var sourcePreference = { a: "", b: "" };
  var comparisonRows = [];
  var displayedRows = [];

  function valueType(value) {
    if (value === MISSING) return "missing";
    if (Array.isArray(value)) return "array";
    if (value === null) return "null";
    return typeof value;
  }

  function shortValue(value) {
    if (value === MISSING) return "<missing>";
    var text;
    try { text = JSON.stringify(value); } catch (error) { text = String(value); }
    if (text === undefined) text = String(value);
    return text.length > 500 ? text.slice(0, 497) + "..." : text;
  }

  function joinPath(parent, key, arrayParent) {
    if (arrayParent) return parent + "[" + key + "]";
    return parent + (/^[A-Za-z_$][\w$]*$/.test(key) ? "." + key : "[" + JSON.stringify(key) + "]");
  }

  function parseSave(text) {
    var outer;
    try { outer = JSON.parse(text); }
    catch (error) { return { ok: false, message: "Invalid outer JSON: " + error.message }; }
    var envelope = BellOptimizer.saveParsing.normalizeSaveEnvelope(outer);
    if (!envelope.ok) return { ok:false, message:envelope.error.message };
    var holesResult = BellOptimizer.saveParsing.parseHolesField(envelope.data);
    if (!holesResult.ok) return { ok: false, message: holesResult.error.message };
    return { ok: true, value: holesResult.value };
  }

  function setLoadStatus(side, type, text) {
    var element = document.querySelector("#compare-status-" + side);
    element.className = "compare-save-status " + type;
    element.textContent = text;
  }

  function acceptLoadedSave(side, text, sourceLabel) {
    var result = parseSave(text);
    if (!result.ok) { saves[side] = null; setLoadStatus(side, "error", result.message); return; }
    saves[side] = result.value;
    setLoadStatus(side, "success", sourceLabel + " loaded locally. Parsed data.Holes is " + valueType(result.value) + ".");
  }

  function loadSide(side) {
    var file = document.querySelector("#compare-file-" + side);
    var paste = document.querySelector("#compare-paste-" + side);
    if (sourcePreference[side] === "file" && file.files.length) {
      var reader = new FileReader();
      reader.onload = function () { acceptLoadedSave(side, String(reader.result), file.files[0].name); };
      reader.onerror = function () { setLoadStatus(side, "error", "The selected file could not be read."); };
      reader.readAsText(file.files[0]); return;
    }
    if (sourcePreference[side] === "paste" && paste.value.trim()) { acceptLoadedSave(side, paste.value, "Pasted Save " + side.toUpperCase()); return; }
    if (file.files.length) { sourcePreference[side] = "file"; loadSide(side); return; }
    if (paste.value.trim()) { sourcePreference[side] = "paste"; loadSide(side); return; }
    setLoadStatus(side, "error", "Choose a file or paste a save first.");
  }

  function valuesEqual(a, b) {
    return a === b || (typeof a === "number" && typeof b === "number" && Number.isNaN(a) && Number.isNaN(b));
  }

  function compareParsed(a, b) {
    var rows = [];
    var stack = [{ a: a, b: b, path: "$.data.Holes::parsed", arrayAncestor: false }];
    var visited = 0;
    while (stack.length && visited < MAX_NODES) {
      var item = stack.pop(); visited += 1;
      var typeA = valueType(item.a); var typeB = valueType(item.b);
      var bothContainers = item.a !== MISSING && item.b !== MISSING && item.a !== null && item.b !== null && typeof item.a === "object" && typeof item.b === "object" && typeA === typeB;
      if (bothContainers) {
        var keys = Array.from(new Set(Object.keys(item.a).concat(Object.keys(item.b))));
        for (var i = keys.length - 1; i >= 0; i -= 1) {
          var key = keys[i]; var hasA = Object.prototype.hasOwnProperty.call(item.a, key); var hasB = Object.prototype.hasOwnProperty.call(item.b, key);
          stack.push({ a: hasA ? item.a[key] : MISSING, b: hasB ? item.b[key] : MISSING, path: joinPath(item.path, key, Array.isArray(item.a) || Array.isArray(item.b)), arrayAncestor: item.arrayAncestor || Array.isArray(item.a) || Array.isArray(item.b) });
        }
      } else {
        var changed = typeA !== typeB || !valuesEqual(item.a, item.b);
        var numeric = typeof item.a === "number" && Number.isFinite(item.a) && typeof item.b === "number" && Number.isFinite(item.b);
        rows.push({ path: item.path, valueA: item.a, valueB: item.b, displayA: shortValue(item.a), displayB: shortValue(item.b), type: typeA === typeB ? typeA : typeA + " -> " + typeB, changed: changed, numeric: numeric, difference: numeric ? item.b - item.a : null, arrayAncestor: item.arrayAncestor });
      }
    }
    return { rows: rows, visited: visited, truncated: stack.length > 0 };
  }

  function runComparison() {
    if (saves.a === null || saves.b === null) {
      document.querySelector("#compare-summary").textContent = "Load both valid saves before comparing."; return;
    }
    var result = compareParsed(saves.a, saves.b);
    comparisonRows = result.rows;
    document.querySelector("#compare-summary").textContent = "Compared parsed data.Holes locally across " + result.visited.toLocaleString() + (result.truncated ? "+ nodes; the 100,000-node safety limit was reached." : " nodes.");
    applyFilters();
  }

  function matchesSearch(row, query) {
    if (!query) return true;
    var lower = query.toLowerCase();
    if (row.path.toLowerCase().includes(lower)) return true;
    var number = Number(query);
    return query.trim() !== "" && Number.isFinite(number) && ((typeof row.valueA === "number" && row.valueA === number) || (typeof row.valueB === "number" && row.valueB === number) || (row.difference !== null && row.difference === number));
  }

  function applyFilters() {
    var changedOnly = document.querySelector("#filter-changed-only").checked;
    var numericOnly = document.querySelector("#filter-numeric-only").checked;
    var arrayOnly = document.querySelector("#filter-array-paths").checked;
    var parsedOnly = document.querySelector("#filter-parsed-only").checked;
    var query = document.querySelector("#compare-search").value.trim();
    var filtered = comparisonRows.filter(function (row) {
      return (!changedOnly || row.changed) && (!numericOnly || (row.changed && row.numeric)) && (!arrayOnly || row.arrayAncestor) && (!parsedOnly || row.path.indexOf("$.data.Holes::parsed") === 0) && matchesSearch(row, query);
    });
    displayedRows = filtered.slice(0, MAX_DISPLAYED);
    renderRows(displayedRows, filtered.length);
  }

  function addCell(row, text, className) { var cell = document.createElement("div"); cell.className = className || ""; cell.textContent = text; row.appendChild(cell); }
  function renderRows(rows, total) {
    var output = document.querySelector("#compare-differences"); output.replaceChildren();
    var summary = document.querySelector("#compare-summary");
    var changedCount = rows.filter(function (row) { return row.changed; }).length;
    summary.textContent = total + " matching comparison row" + (total === 1 ? "" : "s") + "; " + rows.length + " displayed" + (total > MAX_DISPLAYED ? " (500-result limit applied)." : ".");
    document.querySelector("#copy-displayed-differences").disabled = changedCount === 0;
    if (!rows.length) { var empty = document.createElement("p"); empty.className = "muted"; empty.textContent = "No rows match the current filters."; output.appendChild(empty); return; }
    var header = document.createElement("div"); header.className = "difference-row difference-header";
    ["Parsed path", "Save A", "Save B", "Difference", "Type"].forEach(function (label) { addCell(header, label); }); output.appendChild(header);
    rows.forEach(function (item) {
      var row = document.createElement("div"); row.className = "difference-row" + (item.changed ? " changed" : " unchanged");
      addCell(row, item.path, "difference-path"); addCell(row, item.displayA); addCell(row, item.displayB); addCell(row, item.difference === null ? "—" : String(item.difference), item.difference === null ? "" : "numeric-difference"); addCell(row, item.type); output.appendChild(row);
    });
  }

  function copyDisplayed() {
    var changed = displayedRows.filter(function (row) { return row.changed; });
    var text = changed.map(function (row) { return [row.path, "Save A: " + row.displayA, "Save B: " + row.displayB, "Difference: " + (row.difference === null ? "n/a" : row.difference), "Type: " + row.type].join("\t"); }).join("\n");
    if (!text) return;
    function copied() { document.querySelector("#compare-summary").textContent = changed.length + " displayed difference" + (changed.length === 1 ? "" : "s") + " copied. No full save data was copied."; }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(copied).catch(function () { fallbackCopy(text, copied); });
    else fallbackCopy(text, copied);
  }
  function fallbackCopy(text, callback) { var area = document.createElement("textarea"); area.value = text; area.setAttribute("readonly", ""); area.style.position = "fixed"; area.style.opacity = "0"; document.body.appendChild(area); area.select(); try { document.execCommand("copy"); callback(); } finally { document.body.removeChild(area); } }

  function initializeSide(side) {
    var file = document.querySelector("#compare-file-" + side); var paste = document.querySelector("#compare-paste-" + side);
    file.addEventListener("change", function () { if (file.files.length) sourcePreference[side] = "file"; });
    paste.addEventListener("input", function () { if (paste.value.trim()) sourcePreference[side] = "paste"; });
    document.querySelector("#load-save-" + side).addEventListener("click", function () { loadSide(side); });
  }
  function initialize() {
    initializeSide("a"); initializeSide("b");
    document.querySelector("#compare-two-saves").addEventListener("click", runComparison);
    ["#filter-changed-only", "#filter-numeric-only", "#filter-array-paths", "#filter-parsed-only"].forEach(function (selector) { document.querySelector(selector).addEventListener("change", applyFilters); });
    document.querySelector("#compare-search").addEventListener("input", applyFilters);
    document.querySelector("#copy-displayed-differences").addEventListener("click", copyDisplayed);
  }
  if (BellOptimizer.developerMode && BellOptimizer.developerMode.enabled) initialize();
  return { parseSave: parseSave, compareParsed: compareParsed };
}());
