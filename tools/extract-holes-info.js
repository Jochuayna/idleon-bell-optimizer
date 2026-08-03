"use strict";

// Read-only source helper: splits the static HolesInfo return array without executing the game bundle.
const fs = require("fs");
const source = fs.readFileSync("refrence/N.js.txt", "utf8");
const functionName = process.argv[2] && !/^\d+$/.test(process.argv[2]) ? process.argv[2] : "na.HolesInfo";
const argOffset = functionName === "na.HolesInfo" ? 2 : 3;
const functionStart = source.indexOf(functionName + " = function()");
const returnStart = source.indexOf("return [", functionStart) + "return ".length;
function splitArray(expression, openingIndex) {
  let depth = 0;
  let quote = "";
  let escaped = false;
  let itemStart = openingIndex + 1;
  const result = [];
  for (let index = openingIndex + 1; index < expression.length; index += 1) {
    const character = expression[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = "";
      continue;
    }
    if (character === "\"" || character === "'") { quote = character; continue; }
    if (character === "[" || character === "(" || character === "{") depth += 1;
    else if (character === "]" || character === ")" || character === "}") depth -= 1;
    if (character === "," && depth === 0) {
      result.push(expression.slice(itemStart, index).trim());
      itemStart = index + 1;
    }
    if (character === "]" && depth < 0) {
      result.push(expression.slice(itemStart, index).trim());
      break;
    }
  }
  return result;
}

const items = splitArray(source, returnStart);
/*
  if (quote) {
    if (escaped) escaped = false;
    else if (character === "\\") escaped = true;
    else if (character === quote) quote = "";
    continue;
  }
  if (character === "\"" || character === "'") { quote = character; continue; }
  if (character === "[" || character === "(" || character === "{") depth += 1;
  else if (character === "]" || character === ")" || character === "}") depth -= 1;
  if (character === "," && depth === 0) {
    items.push(source.slice(itemStart, index).trim());
    itemStart = index + 1;
  }
  if (character === "]" && depth < 0) {
    items.push(source.slice(itemStart, index).trim());
    break;
  }
} */

const requested = process.argv.slice(argOffset);
(requested.length ? requested : items.map((_, index) => String(index))).forEach((path) => {
  const indexes = path.split(".").map(Number);
  let value = items[indexes[0]];
  for (let depthIndex = 1; depthIndex < indexes.length; depthIndex += 1) {
    value = splitArray(value, value.indexOf("["))[indexes[depthIndex]];
  }
  console.log(path + ": " + value);
});
