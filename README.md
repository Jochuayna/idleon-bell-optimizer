# Bell Optimizer

Bell Optimizer is a free browser-based tool for understanding and improving the Bell in Legends of Idleon. Import an Idleon save to decide whether a selected Bell reward run is worth continuing or Renewing, reconstruct Bell Ring, Ping, and Clean rates, compare accounts, and keep a private history of Bell progress.

> Unofficial community tool. Not affiliated with or endorsed by the creators of Legends of Idleon.

## Features

### Bell Rate Breakdown

- Automatically reconstructs Bell Ring EXP/hour from mapped save data and verified mechanics.
- Separately reconstructs Bell Ping and Bell Clean rates.
- Breaks down verified Monument, Measurement, Bell Improvement Method, Jar, Death Note, and other mapped contributions.
- Provides expandable multiplier details for players who want to inspect the calculation.

### Upgrade Paths

- Provides separate Bell Ring, Bell Ping, and Bell Clean views.
- Identifies affordable, unaffordable, capped, RNG-dependent, and progression-gated opportunities.
- Calculates each candidate using the complete rate for the affected Bell stat, including absolute rate gained and the projected new rate.
- Recommends the best affordable verified upgrade, or an **Upgrade to Work Toward** when no verified option is currently affordable.
- Offers optional **Affordable first** ordering and collapsed multi-upgrade plans for Bell Ring.

Upgrade advice is Bell-focused. Resources may have valuable uses elsewhere in Idleon that the tool does not evaluate.

### Run Optimizer

Select any unlocked Bell reward and compare the current run with a complete fresh replacement:

- Bucket Fill Rate
- All Villager EXP
- Harp Note Gains
- Daily Lamp Wishes
- Extra Rupie Chance
- Double Torch Chance
- Coins From Fountain

The Run Optimizer reports whether to keep the current run, whether Renewing is favored, or whether the outcomes are too close to separate clearly. It shows the current level, expected finish, likely range, remaining Bell opportunities, and concise rationale. No player-entered target is required.

The verdict uses a **keep bar** that rises with the number of re-rolls planned: one re-roll is worth an average fresh run, and each extra one raises the bar. **Re-rolls to plan for** defaults to the Renewals banked, up to 50, and each re-roll is judged about 2 hours into a fresh run.

An optional **Future Ring Rate** scenario lets players test a projected rate from the currently imported Ring state forward. The same projected rate is applied to continuing and to a fresh replacement, without changing the imported account. This scenario lasts only for the current page session, clears on a new save import, and is never stored in Progress History.

Advanced Details exposes Bell mechanics, Run and Rate model diagnostics, and source/provenance information for players who want to inspect the calculations.

### Compare

- Imports another player's save as a temporary benchmark without replacing the active account.
- Compares verified Bell rates and top-level factors.
- Keeps the benchmark in memory for the current session only; it is not added to Personal History.

### Progress History

- Stores up to 100 Bell-only snapshots in the browser's IndexedDB storage.
- Saves snapshots only when requested and never stores the complete Idleon save.
- Imports older saves for comparison without replacing the active optimizer save.
- Compares the current import with the newest snapshot or any two historical snapshots.
- Tracks Ring, Ping, Clean, Method, Monument, Measurement, Death Note, and other Bell progression changes.
- May record an optional sanitized Bell Run context: selected reward, level, run tier, recommendation, and available expected finishes.
- Supports Bell-only history export and restore.

### Local privacy

Idleon saves are processed entirely in the browser. They are not uploaded to GitHub or another server, and raw saves are not persisted. Personal History stores sanitized Bell-only snapshots locally in IndexedDB. Compare benchmarks and Future Ring Rate scenarios are session-only. Developer Tools are available only on localhost or `file://` when `?dev=1` is explicitly supplied; they remain unavailable on public hosts.

## How to use

1. Export your Idleon JSON save.
2. Open Bell Optimizer.
3. Choose the save file or paste its JSON, then import it.
4. Select the Bell reward that matters for the current run and review the Keep/Renew result.
5. Open Rate Optimizer to review reconstructed rates and Upgrade Paths.
6. Optionally compare another account or save a Personal History snapshot.

No installation, account, framework, npm package, or application server is required.

## Progress History and privacy

GitHub Pages can host the application files, but it does not receive or store imported saves. Save parsing and calculations happen on the player's device.

Bell Progress History uses IndexedDB, a private storage area maintained by the browser for the current site. No account is required. History does not automatically move to another browser or device, and clearing browser site data can erase it. Export a Bell History backup before clearing browser data, changing devices, or resetting a browser profile.

History snapshots contain Bell-related values used for comparisons, not the full Idleon save.

Compare benchmarks are not written to IndexedDB and clear when the page is refreshed.

## Running locally

1. Download or clone this repository.
2. Open `index.html` in Chrome, Edge, or Firefox.

Normal optimizer functionality works by opening `index.html` directly. Persistent Bell History is most reliable through GitHub Pages or localhost because browsers can handle `file://` storage differently.

To use a local web address, Python can optionally serve the folder:

```text
python -m http.server 8000
```

Then open `http://localhost:8000`. Python is optional and is not required for normal use.

Before packaging or publishing, run the privacy guard:

```text
node tools/release-safety-check.js
```

The complete local test runner invokes the same check automatically.

## GitHub Pages

The project can be published directly from the repository root because `index.html` is located there. Configure GitHub Pages to deploy the appropriate branch and root folder; no build command or generated output directory is needed.

GitHub Pages hosts only the static HTML, CSS, and JavaScript files. Imported save data remains in the visitor's browser.

### Release cache token

First-party CSS and JavaScript URLs in `index.html` share the token declared by the `bell-optimizer-release` meta tag. Before each deployment, replace that token on the meta tag and every `?v=` asset URL with one new release identifier. The validation suite fails if any production asset uses a different token. The Renewal worker inherits the token from `bell-renewal-decision.js`, and applies it to every worker dependency.

## Current limitations

- Balanced and Custom multi-reward objectives are not implemented yet.
- Recommendations focus on Bell gains and may suggest spending resources that are useful elsewhere.
- Progress History is local and does not cloud-sync.
- Lantern inventory is not imported.

## Project structure

- `index.html` — application entry point and page structure.
- `styles.css` — responsive visual design.
- `js/` — save parsing, Bell mechanics, rate reconstruction, optimization, history, and interface modules.
- `docs/` — mechanic, save-field, testing, history, and UI design documentation.
- `tools/` — local validation and automated test helpers.

## Development and validation

Bell Optimizer is a dependency-free static application built with plain HTML, CSS, and JavaScript. It has no framework, npm dependency, build process, or required server.

Automated coverage includes calculation, parser, History, privacy, cache-safety, and presentation behavior. Run the local test suite for the current validated count.

## Contributing or reporting problems

Open a GitHub Issue and include:

- What you expected.
- What happened instead.
- The browser you used.
- A screenshot when it helps explain the problem.

**Do not post or attach your complete Idleon save JSON to a public issue.** Describe the problem using non-sensitive values or screenshots instead.

## License and game assets

The project is currently distributed without a separate license file.

Legends of Idleon names and game-related trademarks belong to their respective owners.

## Game icons

The Bell in the header and the small item icons in `assets/icons/` are IdleOn game art by LavaFlame2, taken from the image set bundled with the IdleOn AutoReview Bot project. They are used only to depict and label the game items they show.
