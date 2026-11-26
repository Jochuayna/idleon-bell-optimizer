"use strict";
window.BellOptimizer = window.BellOptimizer || {};

// Presentation only: puts the matching IdleOn icon in front of labels that name
// a game item. Nothing here reads or changes save data, and a label that
// matches no rule is simply left without an icon.
BellOptimizer.gameIcons = (function () {
  var BASE = "assets/icons/";
  var VERSION = (function () {
    var script = document.currentScript;
    try { return script ? new URL(script.src).searchParams.get("v") : null; } catch (error) { return null; }
  }());

  // Resources that upgrades are paid in.
  var RESOURCE_RULES = [
    [/Decent Rupie/i, "decent-rupie"],
    [/Gaming Bits/i, "gaming-bits"],
    [/Eighth Note/i, "eighth-note"],
    [/\bAtoms\b/i, "atoms"],
    [/\bMythril\b/i, "mythril"],
    [/\bCobaltine\b/i, "cobaltine"],
    [/Gold Coins from Fountain/i, "gold-coin"],
    [/\bCoins\b/i, "coins"],
    [/\bCosmo point/i, "cosmo"]
  ];
  // Named sources of Bell rate. First match wins, so specific names come first.
  var SOURCE_RULES = [
    [/Big Beef Rock/i, "jar-big-beef-rock"],
    [/Twisted Rupie/i, "jar-twisted-rupie"],
    [/\bskull\b|Death Note/i, "death-note"],
    [/\bCosmo\b/i, "cosmo"],
    [/Measurement/i, "measurement"],
    [/Monument/i, "monument"],
    [/Bell Ping/i, "bell-ping"],
    [/Bell Clean/i, "bell-clean"],
    [/Bell Ring|Bell Improvement/i, "bell-ring"]
  ];

  // Each group names the elements that act as item labels and which rules apply.
  var GROUPS = [
    { selector: ".rate-factor > span:first-child, .rate-factor-details > summary > span:first-child, .bell-stat-filter-button, .upgrade-candidate-card h4, .upgrade-opportunity-card h4, .dashboard-plan-item > div:first-child > small, .dashboard-next-target-item > div:first-child > small, .upgrade-candidate-card > div:first-child > strong, .upgrade-opportunity-card > div:first-child > strong", rules: SOURCE_RULES },
    { selector: ".rate-detail-grid > span", rules: RESOURCE_RULES, only: /^Method \d/ },
    { selector: ".dashboard-plan-item strong, .dashboard-next-target-item strong, .bridge-cost, .upgrade-candidate-card b, .upgrade-opportunity-card b", rules: RESOURCE_RULES, only: /\d/ }
  ];

  function match(rules, text) {
    for (var index = 0; index < rules.length; index += 1) if (rules[index][0].test(text)) return rules[index][1];
    return null;
  }

  function iconFor(text) { return match(RESOURCE_RULES, text) || match(SOURCE_RULES, text); }

  function source(name) { return BASE + name + ".png" + (VERSION ? "?v=" + encodeURIComponent(VERSION) : ""); }

  function create(name) {
    var image = document.createElement("img");
    image.className = "game-icon";
    image.src = source(name);
    image.alt = "";
    image.width = 20;
    image.height = 20;
    image.decoding = "async";
    return image;
  }

  function decorateNode(node, group) {
    var text = node.textContent.trim();
    var name = text && (!group.only || group.only.test(text)) ? match(group.rules, text) : null;
    var current = node.querySelector(":scope > img.game-icon");
    if ((current ? current.dataset.icon : null) === name) return;
    if (current) current.remove();
    if (!name) return;
    var image = create(name);
    image.dataset.icon = name;
    node.insertBefore(image, node.firstChild);
  }

  function decorate(root) {
    GROUPS.forEach(function (group) {
      var nodes = (root || document).querySelectorAll(group.selector);
      for (var index = 0; index < nodes.length; index += 1) decorateNode(nodes[index], group);
    });
  }

  var scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    (window.requestAnimationFrame || window.setTimeout)(function () { scheduled = false; decorate(document); });
  }

  // The header bell rings when clicked and, every so often, on its own. It
  // stays still for anyone who has asked their device for reduced motion.
  var RING_MIN_MS = 30000, RING_MAX_MS = 75000;
  function startBell() {
    var bell = document.querySelector(".brand-mark");
    if (!bell) return;
    var reduced = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
    function ring() {
      if (reduced && reduced.matches) return;
      bell.classList.remove("is-ringing");
      void bell.offsetWidth; // lets a click mid-swing restart the swing
      bell.classList.add("is-ringing");
    }
    bell.addEventListener("click", ring);
    bell.addEventListener("animationend", function () { bell.classList.remove("is-ringing"); });
    (function scheduleRing() {
      window.setTimeout(function () {
        if (!document.hidden) ring();
        scheduleRing();
      }, RING_MIN_MS + Math.random() * (RING_MAX_MS - RING_MIN_MS));
    }());
  }

  function start() {
    startBell();
    decorate(document);
    var main = document.querySelector("main");
    if (main && window.MutationObserver) new MutationObserver(schedule).observe(main, { childList: true, subtree: true, characterData: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();

  return { iconFor: iconFor, decorate: decorate };
}());
