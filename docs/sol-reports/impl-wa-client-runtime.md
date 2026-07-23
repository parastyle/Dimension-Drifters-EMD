# Whole-art client runtime implementation

Date: 2026-07-23
Branch: `sol/wa-client-runtime`
Scope: Wave 3, Sol 3

## Runtime locations

- `PLAYER_SPRITE` lives in `packages/client/src/scenes/ArenaScene.ts`; it will derive from the shared `DEFAULT_CHARACTER`, whose integrated value is `proto-sheriff`.
- Ordinary player character resolution, whole-art texture readiness, rig construction, and the degraded retained-base fallback all live in `ArenaScene.addBlob`.
- Authoritative character reconciliation and rig rebuilding live in `ArenaScene.syncBlobs`.
- The ordinary gear disconnect is at those same construction/reconciliation call sites: ordinary rigs will not receive `GEAR_PARTS_MANIFEST`, will never call `equipSyncedGear`, and the unused per-patch `syncedGearLoadouts` decoding/cache will be removed. Gear dependencies remain only for the dev-only archived gear probe.
- Character selection is transported by `ArenaScene.init` data and the room `joinOpts`; the client bounds the transport shape but passes the value through without duplicating server validation.

## Implementation plan

1. Inspect the integrated shared whole-art registry/default and the existing ArenaScene creation, texture barrier, reconciliation, join, and dev-probe paths.
2. Derive the player default from shared `DEFAULT_CHARACTER` and centralize ordinary render-id resolution against the shared whole-art subset.
3. Carry bounded `selectedCharacterId` through scene initialization and room join options without client-side roster validation.
4. Remove ordinary gear-manifest construction, synced-gear equip calls, and per-patch gear-tail decoding while preserving the dev-only archived gear probe.
5. Preserve the pending texture barrier and add a terminal-missing-only retained Drifter base fallback with a clear diagnostic.
6. Rebuild rigs when the authoritative resolved whole-art id changes, without re-entering wardrobe synchronization.
7. Replace directly coupled ArenaScene tests with behavioral coverage for sheriff fallback, selected whole-art creation, inert legacy gear tails, terminal asset-failure visibility, and whole-art-to-whole-art rebuild.
8. Run targeted tests, `pnpm typecheck`, and the full `pnpm test` suite; review LF-only scoped changes and commit them on this branch.

## Incremental log

- Created this report before runtime/test edits and recorded the authoritative Sol 3 scope.
- Confirmed the integrated Sol 1 contract exports `DEFAULT_CHARACTER = "proto-sheriff"`, `WHOLE_ART_CHARACTERS`, `WholeArtCharacter`, and `isWholeArtCharacter`.
- Changed `PLAYER_SPRITE` to derive from `DEFAULT_CHARACTER` and added `resolveOrdinaryPlayerCharacterId`, which maps absent, unknown, Drifter, and legacy `cc-*` state to the shared sheriff for ordinary rendering.
- Added the bounded `WholeArtCharacter` scene-init field and passed `selectedCharacterId` unchanged into `joinOpts`; no transport-side roster validation was added.
- Reworked `addBlob` so a pending whole-art load creates no rig, a ready load constructs the selected whole-art rig, and only a terminal `missing` result logs an asset failure and constructs the retained Drifter base. Every ordinary construction omits the gear manifest and never equips synced gear.
- Simplified `syncBlobs` to compare resolved whole-art ids and rebuild on an authoritative whole-art change. Legacy gear tails are inert.
- Removed the Arena `RemoteGearLoadout` cache/import, its lifecycle reset, all per-patch gear decoding, and every ordinary `equipSyncedGear` call. `GEAR_PARTS_MANIFEST` remains only in the dev-only archived gear visibility probe.
- Replaced the active-Drifter-wardrobe expectation with behavioral creation/reconciliation coverage. The suite proves:
  - (a) absent, empty, Drifter, legacy `cc-*`, and unknown ids render as the shared sheriff;
  - (b) every shared selected whole-art id constructs its own rig;
  - (c) legacy gear tails produce neither a gear-manifest constructor argument nor an equip call;
  - (d) pending assets never flash the dummy, while terminal missing constructs a visible retained Drifter base and logs clearly;
  - (e) a sheriff-to-samurai authoritative change removes and rebuilds the rig.
- Added a source-contract assertion proving the bounded `selectedCharacterId` value is copied from init data into room join options without client-side validation.

## Verification

- Focused runtime/archived-compatibility run: `ArenaScene.dualwield.test.ts` plus `remote-gear.test.ts` passed, 2 files and 20 tests.
- `pnpm typecheck`: passed across shared, client, and server.
- Full `pnpm test`: passed, 147 files and 1,870 tests.
- The isolated worktree initially lacked gitignored ArtKit test prerequisites. The local locked ArtKit dependencies and ignored audit/preview fixtures were restored only to run the complete gate; they are not part of the tracked diff.
- `git diff --check`: passed. All tracked touched text files are LF-only.
- No live application stack was booted; the orchestrator retains the live visual check.
- Tracked files touched: `packages/client/src/scenes/ArenaScene.ts`, `packages/client/src/scenes/ArenaScene.dualwield.test.ts`, and `docs/sol-reports/impl-wa-client-runtime.md`.

Verdict: PLAYER_SPRITE now = sheriff (`DEFAULT_CHARACTER` / `proto-sheriff`), no ordinary gear-bake path, terminal-missing fallback visible + tested, files touched = ArenaScene runtime + directly coupled test + implementation report, tests proving (a)-(e) = sheriff fallback + selected whole-art creation + zero legacy-tail gear calls + terminal-failure visibility + whole-art-to-whole-art rebuild.
