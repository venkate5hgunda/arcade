# Saved games and competing tabs

The redesign preserves the original `arcade:` keys and values: preferences,
player names, recent games, scores, per-game settings and `{state, savedAt}`
checkpoint maps. Game-specific validators and expiry rules still decide what
can resume. No checkpoint serializer changes in storage version 1.

## Migration and recovery

Before React mounts or prunes expired/invalid checkpoints, version 1 copies the
known Arcade local-storage values verbatim into
`arcade:redesign.storageBackup:v0`. It validates that backup before writing
`arcade:redesign.storageVersion`. Unrelated applications' data is excluded.
The backup is retained once; it is a migration snapshot, not a continuously
updated save. Invalid JSON is preserved as raw text rather than silently
rewritten. Existing complete/invalid game validators remain unchanged.

An unsupported version, malformed backup or failed migration prevents writes
through the redesign storage wrapper and shows recovery guidance. An open tab
also observes version advances by another tab. Games remain playable in memory;
keep the tab open if the browser cannot save. Reload after restoring storage
availability. A newer unsupported schema requires the matching newer app.

Expand **Offline & install → Download saved games** to export current known
values privately. Exports and migration backups can contain secret hands, roles
and word answers. Do not publish them or attach them to public issues. Host room
backups remain separately tab-scoped in session storage and are not included in
this local-game export.

The original application can still read version 1's unchanged legacy values;
the redesign marker and backup do not alter them. To restore the migration
snapshot after an intentional rollback, first close other Arcade tabs, export
current saves, then inspect the backup in browser storage tools and restore its
`values` entries verbatim. This intentionally replaces progress made after the
snapshot. Do not remove unrelated keys or clear all origin storage. An invalid
backup must be inspected rather than forced into a game.

## Coordinated changes

Web Locks serialize whole-key read/modify/write operations for checkpoints,
recent games, Tic-Tac-Toe win counts and numeric best scores. Each operation
re-reads storage while holding its key's lock. Different games preserve each
other's checkpoints; expiration cleanup re-reads rather than persisting a stale
catalog copy. Best scores use the maximum of saved and proposed values.

Each open game remembers the checkpoint it last read or saved. If another tab
changes that game, the stale tab can continue in memory but cannot overwrite or
delete the newer checkpoint. The warning explains how to reload the saved game.
Opening the game again establishes a fresh baseline. Frame/canvas instances in
one page share their expectation so cleanup cannot conflict with its own table.
Moves and resets finish the persistence attempt before showing their resulting
board/setup, so an immediate reload observes the accepted checkpoint or deletion.
This also applies when persistence fails: the game continues with visible guidance.

Theme, sound, haptics, scores, recent games and the shelf's resume links observe
other tabs and successful writes in their own page without writing back. Active
matches retain their current settings and names; changing another tab does not
silently change an ongoing match's rules or replace its board. Independent
settings/preferences use the latest individual key write.

Browsers without Web Locks use synchronous storage with stale-checkpoint
comparison. That fallback does not provide atomic cross-tab read/modify/write
coordination; use one active game tab there. Chromium and WebKit runs exercise
the real lock implementation. Abrupt process termination during a pending
operation is outside the browser's persistence guarantees.

## Evidence

[Migration checks](../../redesign/checks/unit/migration.check.ts) prove opaque
byte preservation, backup ordering, invalid/future versions and quota protection.
[Concurrency checks](../../redesign/checks/unit/concurrency.check.ts) prove
queued score/record/recent updates through the actual profile functions.
[Browser flows](../../redesign/checks/browser/storage.spec.ts) cover private
export, legacy resume, unsupported-version play, same-game conflicts/reload,
separate games, expiration cleanup, live shelf/preferences and version advances.
Complete game-specific immediate-reload and reset flows remain in the existing
foundation, puzzle, Pool and Hockey suites.
