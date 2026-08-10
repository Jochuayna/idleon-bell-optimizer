# Bell Progress History

Bell Progress History stores small Bell-only snapshots in the current browser using IndexedDB. It never uploads history to GitHub or another service.

New snapshots may also include an optional sanitized `runContext` describing the production Run Optimizer result selected when the player presses **Save Current Snapshot**. It stores the reward index/identifier/name, raw reward level, production tier key/label, production Keep/Renew state, and available raw current/fresh expected finishes. Older snapshots remain valid without this field. History does not recalculate run quality, migrate old snapshots, or store full forecast distributions and policy diagnostics.

## What is stored

- Exact Ring, Ping, and Clean rates as decimal strings
- Six Bell Improvement Method levels and their verified labels
- Monument, Measurement, Bell Method, and Jar multipliers
- Ring, Ping, and Clean progress and zero-based indexes
- Death Note points
- Verified Bell-relevant resource balances
- Sanitized next-upgrade summaries
- Snapshot id, fingerprint, date, source-date type, and optional label

The raw Idleon JSON, serialized Holes data, full parsed save, character data, unrelated inventory, files, and blobs are never stored. Historical save text is discarded immediately after Bell extraction.

## Storage and privacy

The IndexedDB database is `idleon-bell-history`, version 1. It contains the `snapshots` object store with `id` as its key and indexes for `capturedAt` and `fingerprint`. Browser profiles have separate history. Clearing site data may delete it, and history does not sync between devices.

GitHub Pages supplies the static application files but does not receive snapshots. IndexedDB may work under `file://`, but persistence is more reliable through GitHub Pages or localhost.

History is limited to 100 snapshots. Nothing is automatically deleted or automatically saved. Duplicate Bell states share a fingerprint that excludes the label, date, and id; the existing row is kept by default.

## Imports, comparisons, and backups

Import Past Saves accepts up to 50 JSON files per batch, with a 25 MB limit per file. The existing parser extracts a snapshot without changing the active optimizer state. File modification time becomes the default historical date.

Since Last Snapshot compares the current unsaved import with the newest stored snapshot. Any-two comparison reports elapsed time; exact rate changes; Method, multiplier, Death Note, and activity-index changes; and stored recommendation changes. It describes correlation only and does not claim causation.

Export Bell History creates a Bell-only JSON backup. Restore validates the export type/version and every snapshot, then merges entries by fingerprint. Existing history is not erased. Delete All Local History requires confirmation.

## Manual browser smoke test

1. Open the optimizer normally.
2. Import a valid current save.
3. Open Bell Rate → Progress History.
4. Save the current snapshot.
5. Reload and confirm it remains.
6. Import a newer or different save and confirm Since Last Snapshot appears.
7. Save the newer snapshot.
8. Compare the two stored snapshots.
9. Export Bell History.
10. Delete all local history and confirm the list is empty.
11. Restore the exported backup and confirm both rows return.
12. Recheck Rate Breakdown, Upgrade Paths, and Step 4 after each action.

If storage is blocked, Progress History must show the failure while the rest of Bell Optimizer continues working.
