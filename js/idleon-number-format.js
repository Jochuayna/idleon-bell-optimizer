"use strict";
window.BellOptimizer = window.BellOptimizer || {};

BellOptimizer.idleonNumberFormat = (function () {
  var suffixes = { 3: "K", 6: "M", 9: "B", 12: "T", 15: "Q", 18: "QQ" };

  function trimZeros(text) {
    return text.indexOf(".") === -1 ? text : text.replace(/0+$/, "").replace(/\.$/, "");
  }

  function threeSignificantDigits(value) {
    if (value === 0) return "0";
    var decimals = Math.max(0, 2 - Math.floor(Math.log10(Math.abs(value))));
    return trimZeros(value.toFixed(decimals));
  }

  function formatParts(sign, significant, exponent) {
    var digits = String(significant).padStart(3, "0");
    var text;
    if (exponent < 3) {
      var decimalPosition = exponent + 1;
      if (decimalPosition <= 0) text = "0." + "0".repeat(-decimalPosition) + digits;
      else if (decimalPosition >= digits.length) text = digits + "0".repeat(decimalPosition - digits.length);
      else text = digits.slice(0, decimalPosition) + "." + digits.slice(decimalPosition);
      text = trimZeros(text);
    } else if (exponent >= 21) {
      text = trimZeros(digits.charAt(0) + "." + digits.slice(1)) + "e" + exponent;
    } else {
      var tier = Math.floor(exponent / 3) * 3;
      var position = exponent - tier + 1;
      text = position >= digits.length ? digits + "0".repeat(position - digits.length) : digits.slice(0, position) + "." + digits.slice(position);
      text = trimZeros(text) + suffixes[tier];
    }
    return sign + text;
  }

  function formatExactDecimal(text) {
    var match = String(text).trim().match(/^([+-]?)(\d+)(?:\.(\d+))?$/);
    if (!match) return null;
    var sign = match[1] === "-" ? "-" : "";
    var integer = match[2];
    var fraction = match[3] || "";
    var combined = integer + fraction;
    var first = combined.search(/[1-9]/);
    if (first === -1) return "0";
    var exponent = integer.length - first - 1;
    var significant = Number(combined.slice(first, first + 3).padEnd(3, "0"));
    if (Number(combined.charAt(first + 3) || "0") >= 5) significant += 1;
    if (significant === 1000) { significant = 100; exponent += 1; }
    return formatParts(sign, significant, exponent);
  }

  function format(value) {
    if (typeof value === "bigint") return formatExactDecimal(value.toString());
    if (typeof value === "string") return formatExactDecimal(value) || "—";
    if (typeof value !== "number" || Number.isNaN(value)) return "—";
    if (value === Infinity) return "∞";
    if (value === -Infinity) return "-∞";
    if (value === 0) return "0";
    var sign = value < 0 ? "-" : "";
    var absolute = Math.abs(value);
    if (absolute < 1000) {
      var small = threeSignificantDigits(absolute);
      return small === "1000" ? sign + "1K" : sign + small;
    }
    var scientific = absolute.toExponential(2).split("e");
    return formatParts(sign, Math.round(Number(scientific[0]) * 100), Number(scientific[1]));
  }

  function parse(text) {
    var original = String(text === undefined || text === null ? "" : text).trim();
    if (!original) return { ok: false, error: "Enter the Bell EXP per hour shown in IdleOn." };
    var match = original.match(/^([+]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)\s*(QQ|K|M|B|T|Q)?$/i);
    if (!match) return { ok: false, error: "Enter a positive number using plain digits, scientific notation, or K, M, B, T, Q, or QQ." };
    var base = Number(match[1]);
    var suffix = (match[2] || "").toUpperCase();
    var multipliers = { "": 1, K: 1e3, M: 1e6, B: 1e9, T: 1e12, Q: 1e15, QQ: 1e18 };
    var value = base * multipliers[suffix];
    if (!Number.isFinite(value)) return { ok: false, error: "Bell EXP per hour must be a finite number." };
    if (value <= 0) return { ok: false, error: "Bell EXP per hour must be greater than zero." };
    return { ok: true, value: value, normalizedSuffix: suffix };
  }

  return { format: format, parse: parse, trimZeros: trimZeros };
}());
