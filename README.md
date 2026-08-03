# Bell Optimizer

Bell Optimizer is a free browser-based tool for understanding and improving the Bell in Legends of Idleon. Import an Idleon save to reconstruct Bell rates, compare verified upgrades, evaluate the current Bell run against a target, estimate fresh-run odds, and keep a private history of Bell progress.

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

### Current Run Evaluator

Evaluate a single Bell reward priority using a 48-hour outlook:

- Bucket Fill Rate
- All Villager EXP
- Harp Note Gains
- Daily Lamp Wishes
- Extra Rupie Chance
- Double Torch Chance
- Coins From Fountain

The evaluator compares continuing the imported run with starting fresh and returns **Continue**, **Reset**, or **Either is reasonable**. It reports target probability, expected result, likely range, high-end likely result, estimated Bell rolls, and Lantern guidance. Run quality is summarized as **Absolutely Cooked**, **Cooked**, **Weak Run**, **Saveable Run**, **Strong Run**, **Exceptional Run**, or **God Run**.

Advanced Details includes additional outlook controls and technical statistics without crowding the normal player flow.

### Fresh-run Odds

- Estimates the odds for independent renewed runs using one two-hour Lantern per attempt.
- Shows confidence-based attempt estimates and the renewal currency those attempts would require.
- Treats probability results as estimates, never guaranteed outcomes.

### Progress History

- Stores up to 100 Bell-only snapshots in the browser's IndexedDB storage.
- Saves snapshots only when requested and never stores the complete Idleon save.
- Imports older saves for comparison without replacing the active optimizer save.
- Compares the current import with the newest snapshot or any two historical snapshots.
- Tracks Ring, Ping, Clean, Method, Monument, Measurement, Death Note, and other Bell progression changes.
- Supports Bell-only history export and restore.

### Local privacy

Idleon saves are processed entirely in the browser. They are not uploaded to GitHub or another server, and the full save JSON is not retained in Bell History. Public Developer Tools are disabled.

## How to use

1. Export your Idleon JSON save.
2. Open Bell Optimizer.
3. Choose the save file or paste its JSON, then import it.
4. Review the reconstructed Bell rates and Upgrade Paths.
5. Select the Bell reward that matters for the current run.
6. Enter a target and click **Check My Run**.
7. Optionally save a Bell Progress snapshot for future comparisons.

No installation, account, framework, npm package, or application server is required.

## Progress History and privacy

GitHub Pages can host the application files, but it does not receive or store imported saves. Save parsing and calculations happen on the player's device.

Bell Progress History uses IndexedDB, a private storage area maintained by the browser for the current site. No account is required. History does not automatically move to another browser or device, and clearing browser site data can erase it. Export a Bell History backup before clearing browser data, changing devices, or resetting a browser profile.

History snapshots contain Bell-related values used for comparisons, not the full Idleon save.

## Running locally

1. Download or clone this repository.
2. Open `index.html` in Chrome, Edge, or Firefox.

Normal optimizer functionality works by opening `index.html` directly. Persistent Bell History is most reliable through GitHub Pages or localhost because browsers can handle `file://` storage differently.

To use a local web address, Python can optionally serve the folder:

```text
python -m http.server 8000
```

Then open `http://localhost:8000`. Python is optional and is not required for normal use.

## GitHub Pages

The project can be published directly from the repository root because `index.html` is located there. Configure GitHub Pages to deploy the appropriate branch and root folder; no build command or generated output directory is needed.

GitHub Pages hosts only the static HTML, CSS, and JavaScript files. Imported save data remains in the visitor's browser.

## Current limitations

- Balanced and Custom multi-reward objectives are not implemented yet.
- Recommendations focus on Bell gains and may suggest spending resources that are useful elsewhere.
- Progress History is local and does not cloud-sync.
- Probability results are estimates, not guarantees.
- Lantern inventory is not imported.

## Project structure

- `index.html` — application entry point and page structure.
- `styles.css` — responsive visual design.
- `js/` — save parsing, Bell mechanics, rate reconstruction, optimization, history, and interface modules.
- `docs/` — mechanic, save-field, testing, history, and UI design documentation.
- `tools/` — local validation and automated test helpers.

## Development and validation

Bell Optimizer is a dependency-free static application built with plain HTML, CSS, and JavaScript. It has no framework, npm dependency, build process, or required server.

Automated coverage includes calculation, parser, history, privacy, and presentation behavior. The current validated result is **419/419 tests passing**.

## Contributing or reporting problems

Open a GitHub Issue and include:

- What you expected.
- What happened instead.
- The browser you used.
- A screenshot when it helps explain the problem.

**Do not post or attach your complete Idleon save JSON to a public issue.** Describe the problem using non-sensitive values or screenshots instead.

## License and game assets

The project is currently distributed without a separate license file.

Legends of Idleon names and game-related trademarks belong to their respective owners. The interface uses an original Bell emblem rather than distributing the game's Bell sprite.
