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

  function format(value) {
    if (typeof value !== "number" || Number.isNaN(value)) return "—";
    if (value === Infinity) return "∞";
    if (value === -Infinity) return "-∞";
    if (value === 0) return "0";
    var sign = value < 0 ? "-" : "";
    var absolute = Math.abs(value);
    if (absolute < 1000) return sign + threeSignificantDigits(absolute);
    var exponent = Math.floor(Math.log10(absolute) / 3) * 3;
    if (exponent < 3) exponent = 3;
    var scaled = absolute / Math.pow(10, exponent);
    var suffix = suffixes[exponent] || "e" + exponent;
    return sign + threeSignificantDigits(scaled) + suffix;
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
