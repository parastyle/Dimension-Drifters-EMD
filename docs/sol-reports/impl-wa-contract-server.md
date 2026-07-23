# Implementation report — `wa-contract-server`

Date: 2026-07-23
Branch: `sol/wa-contract-server`
Worktree: `C:/Users/Exped/ddv2-wt/wa-contract-server`

## Understanding

This Sol establishes server/shared whole-art character authority before any client renderer or menu retirement. The generated roster must expose a typed whole-art subset and make `proto-sheriff` the single default. Ordinary joins must accept only a bounded `selectedCharacterId` from that subset, fall back to the sheriff for missing, legacy, or unknown values, and snapshot the character kit for every account version.

The active gear-derived run identity is intentionally retired: ordinary joins must not resolve a gear loadout, create `gearRuns`, seed gear cosmetics, or apply gear-derived stats, quirks, and modifiers. Persisted V3/V4 gear remains sanitized and round-trippable as archived save-compatible data. Pets and weapon Armory/Carry behavior remain unchanged.

## Implementation plan

1. Update the roster generator, regenerate `characters.ts`, and add a whole-art guard/cycler while retaining the full legacy roster and cycler.
2. Point schema constructor defaults at the shared default without changing schema field order or version.
3. Add bounded join selection validation and assign the authoritative whole-art character before the initial snapshot.
4. Route every ordinary account version through `snapshotRunCharacter`, keeping account sanitation but bypassing active gear-run creation.
5. Use the shared default in character snapshot fallback.
6. Restrict normal character cycling to the whole-art subset.
7. Neutralize the legacy invisible gear purchase/reward seam without deleting archived data or helpers.
8. Rewrite/add focused tests for selection, cycling, inert archived gear, explicit loss of gear power, schema compatibility, and unchanged pets.
9. Run generation, typecheck, the full unit suite, LF/diff checks, and one private-port server boot; then commit the scoped changes.

## Progress

- Read the authoritative Sol 1 scope, outline, risk note, and verification requirements.
- Confirmed no repository-root `AGENTS.md` is present.
- Added generated `WHOLE_ART_CHARACTERS`, `WholeArtCharacter`, `isWholeArtCharacter`, and `nextWholeArtCharacter` contracts; set `DEFAULT_CHARACTER` to `proto-sheriff` while retaining the complete legacy roster and `nextCharacter`.
- Changed both schema constructor identity defaults through the shared constant without adding or moving a decorated field.
- Added authoritative `selectedCharacterId?: unknown` join validation, sheriff fallback, and whole-art-only ordinary cycling.
- Retired ordinary `resolveGearLoadout -> gearRuns -> snapshotGearRun` activation. V3/V4 gear still passes the existing sanitizer and account projection, while ordinary combat now always derives from the selected/default character kit.
- Made the legacy `buyUpgrade` message an inert compatibility endpoint so it cannot charge for an invisible archived gear reward.
- Reframed gear tests around archive compatibility and explicit loss of neon gear spread/quirk/mod power; retained an explicit compatibility test for the archived snapshot helper.
- Added missing/valid/legacy/unknown selection cases, whole-art cycle confinement, schema position/default checks, full 113-row V4 gear round-trip coverage, and an unchanged migrated-pet snapshot assertion.
- Focused server tests are green: 318 passed across `GameRoom.test.ts` and `progression.test.ts`.
- `pnpm typecheck` is green.
- Installed the standalone Artkit package's declared dependencies locally so the required full generator could run; no dependency or lockfile change is tracked.
- `pnpm gen` completed. The fresh checkout lacks optional untracked character measurement artifacts, so the roster generator now preserves the 16 tracked legacy presentation scales while still generating/checking roster contracts instead of skipping the entire check.
- `pnpm gen:check` is green and reports `characters.ts` in sync.
- Supplied three ignored Artkit fixtures from a sibling worktree to satisfy two artifact-presence tests; these local files are not tracked and are not part of the commit.
- Final `pnpm typecheck` is green.
- Final full `pnpm test` is green: 146 test files and 1,853 tests passed. This includes the 113/96 gear census, retained gear manifest/baker suites, whole-art census, pet selection/snapshot/progression suites, Armory/Carry tests, and real Colyseus transport integration.
- `pnpm --filter @dd/server build` is green.
- Booted the compiled private server exactly once on `ws://localhost:38641`, observed `[dd-server] listening`, and stopped it cleanly with no stderr/module-init/census failure.
- LF and whitespace checks are clean. Tracked changes remain inside the Sol 1 partition plus this required implementation report.

## Files touched

- `tools/artkit/gen-character-roster.mjs`
- `packages/shared/src/characters.ts`
- `packages/shared/src/state.ts`
- `packages/server/src/rooms/GameRoom.ts`
- `packages/server/src/rooms/GameRoom.test.ts`
- `packages/server/src/rooms/progression.test.ts`
- `docs/sol-reports/impl-wa-contract-server.md`

Verdict: DEFAULT_CHARACTER + WHOLE_ART_CHARACTERS emitted, default/invalid spawn = sheriff proven by unit test, gear run identity retired but account-gear retained, files touched are the roster generator/generated roster, shared state, GameRoom and its two scoped test suites, plus this report, and the census/pet suites are green.
