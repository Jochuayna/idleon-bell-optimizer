"use strict";

var fs = require("fs");
var path = require("path");

var DEFAULT_ROOT = path.resolve(__dirname, "..");
var LARGE_REFERENCE_JSON_BYTES = 128 * 1024;
var APPROVED_SANITIZED_ROOT = "tests/fixtures";

function normalizedRelative(root, filePath) {
  return path.relative(root, filePath).split(path.sep).join("/");
}

function isApprovedSanitizedFixture(relativePath, size) {
  return relativePath.startsWith(APPROVED_SANITIZED_ROOT + "/")
    && relativePath.endsWith(".sanitized.json")
    && size <= 64 * 1024;
}

function forbiddenReason(root, filePath, size) {
  var relativePath = normalizedRelative(root, filePath);
  var lowerPath = relativePath.toLowerCase();
  var baseName = path.basename(lowerPath);

  if (isApprovedSanitizedFixture(relativePath, size)) return null;
  if (baseName === "idleon-save-debug.json") return "private debug-save filename";
  if (baseName.endsWith(".json") && /calibration/.test(baseName)) return "calibration export filename";
  if (baseName.endsWith(".json") && /(?:idleon[-_ ]?save|save[-_ ]?export|account[-_ ]?export)/.test(baseName)) return "account/save export filename";
  if (lowerPath.startsWith("reference/") && baseName.endsWith(".json")) return size >= LARGE_REFERENCE_JSON_BYTES
    ? "large JSON account export under reference"
    : "JSON file in the private/reference save location";
  return null;
}

function walk(root, directory, findings) {
  fs.readdirSync(directory, { withFileTypes: true }).forEach(function (entry) {
    if (entry.name === ".git" || entry.name === "node_modules") return;
    var fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(root, fullPath, findings);
      return;
    }
    if (!entry.isFile()) return;
    var size = fs.statSync(fullPath).size;
    var reason = forbiddenReason(root, fullPath, size);
    if (reason) findings.push({ path: normalizedRelative(root, fullPath), reason: reason });
  });
}

function checkReleaseTree(root) {
  root = path.resolve(root || DEFAULT_ROOT);
  var findings = [];
  walk(root, root, findings);
  findings.sort(function (a, b) { return a.path.localeCompare(b.path); });
  return { ok: findings.length === 0, root: root, findings: findings };
}

function run(root) {
  var result = checkReleaseTree(root);
  if (result.ok) {
    console.log("Release safety check passed: no forbidden private save exports found.");
    return 0;
  }
  console.error("Release safety check failed. Remove these private files from the public project:");
  result.findings.forEach(function (finding) {
    console.error("- " + finding.path + " (" + finding.reason + ")");
  });
  return 1;
}

if (require.main === module) process.exitCode = run(process.argv[2]);

module.exports = {
  LARGE_REFERENCE_JSON_BYTES: LARGE_REFERENCE_JSON_BYTES,
  checkReleaseTree: checkReleaseTree,
  forbiddenReason: forbiddenReason,
  run: run
};
