"use strict";

// Read-only audit helper: extracts literal tables from the bundle text without importing or executing it.
const fs = require("fs");
const lines = fs.readFileSync("refrence/N.js.txt", "utf8").split(/\r?\n/);
const mapTargets = lines[250233].match(/return "(.*)"\.split/)[1].split(" ");
const deathNoteWorlds = Array.from(lines[250493].matchAll(/"([^"]*)"\.split/g), match => match[1].split(" ")).slice(0, 7);
let mapDetailsLiteral = lines[250217].trim().replace(/^return /, "").replace(/;$/, "");
mapDetailsLiteral = mapDetailsLiteral.replace(/(^|[\[,])\s*(-?)\.(\d+)/g, "$1$20.$3");
const mapDetails = JSON.parse(mapDetailsLiteral);
const worldMapIndexes = deathNoteWorlds.map(world => world.map(monster => mapTargets.indexOf(monster)));
const worldMapRequirements = worldMapIndexes.map(world => world.map(index => mapDetails[index][0][0]));
process.stdout.write(JSON.stringify({ deathNoteWorlds, worldMapIndexes, worldMapRequirements }, null, 2));
