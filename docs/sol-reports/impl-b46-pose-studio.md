# B46 Weapon Pose/Animation Studio

## Integration choice

The studio extends the existing Weaponsmith tool instead of introducing a second backend or animation format. Weaponsmith now serves catalog-row validation/save/snapshot/restore/regen endpoints on its existing port, while `packages/client/pose-studio.html` is a Vite multi-page entry that proxies those endpoints during development.

The stage boots a minimal Phaser scene and imports the shipped client rig modules (`SpriteRig`, rig pose/combat data, character texture manifests, and weapon texture manifests). No game-runtime source was changed. Catalog authoring remains in `data/weapon-concepts-300.json`; save and regen use that row and the existing `pnpm gen` pipeline.

Launch with:

```text
pnpm pose-studio
```

Then open `http://127.0.0.1:5180/pose-studio.html`.

## UI map

- Header: searchable active-weapon picker, `WHOLE_ART_CHARACTERS` picker, dirty/validation/regen state, snapshot, restore, save, and save-plus-regen controls.
- Stage: real rig rendering for left and right facings side by side, onion-skin previous beat, zoom, combat-scale toggle, and draggable primary-grip, secondary-grip, idle-hand, and path-target handles.
- Transport: play/pause, loop, 0.1x–2x speed, beat selection, scrub readout, beat boundaries, active window, impact marker, and follow-through window.
- Tweak panel: supported timing fields, path kind/arc/range/damage multipliers, motion, ribbon profile, idle pose language, display length, and grip fraction.
- Laws panel: confirms melee displacement authoring is hidden, gun recoil is read-only and B45-owned, and chain/aura authoring is unavailable.

## Authoring behavior

Dragging the primary and secondary handles updates `gripPoints.primary` and `gripPoints.secondary`. The idle-hand handle snaps only to a pose supported by the real `IDLE_HAND_POSE_SPECS` registry and reports the selected authoring value. The path handle updates the selected combo beat's expressible `path.rangeMultiplier`, `path.deltaAngle`, and `path.arcMultiplier`; it does not invent free-form control points.

Numeric and select inputs are validated against the existing generator constraints. The server accepts only the editable catalog paths exposed by this studio and rejects unknown or prohibited changes with a field-specific message. It therefore cannot silently write movement/displacement, recoil, chain, aura, or a parallel animation structure.

Snapshot keeps one in-memory copy of the selected on-disk row. Restore writes that exact row back. Save replaces the matching catalog row, and save-plus-regen runs `pnpm gen`, reports its exit status, and provides the reload-game hint.

## Live proof

The proof ran headlessly on private loopback ports 57622/57623 with `proto-cowboy-hidden-face` and `x2-voltfang-tachi`. It confirmed both Phaser facings rendered, scrubbed to `Beat 2 · voltage rise · 42%`, advanced playback, dragged `gripPoints.primary.x` from 0.11 to 0.12, saved the changed JSON row, and completed regeneration with exit code 0 and no page errors.

The transient Voltfang edit was restored after evidence capture so the pinned source contract and full suite remain unchanged. Machine-readable results are in `docs/owner-notes-audit-v11-evidence/b46-pose-studio/live-proof.json`; retained screenshots cover the complete studio, edited state, post-regen state, stage, timeline, and panel.

## Verification

- `pnpm typecheck` — passed.
- `pnpm test` — passed: 208 files, 2,704 tests.
- `pnpm vitest run tests/pose-studio-roundtrip.test.ts` — passed.
- Live save plus `pnpm gen` — passed.
- Round-trip unit proof: temporary catalog load, programmatic supported edit, validated save, reload, and deep equality.

## Files touched

- `package.json`
- `packages/client/pose-studio.html`
- `packages/client/src/pose-studio/main.ts`
- `packages/client/src/pose-studio/model.ts`
- `packages/client/src/pose-studio/stage.ts`
- `packages/client/src/pose-studio/style.css`
- `packages/client/vite.config.ts`
- `tools/weaponsmith/catalog-row-store.mjs`
- `tools/weaponsmith/server.mjs`
- `tools/portal/gen-portal.mjs`
- `tools/portal/index.html`
- `tests/pose-studio-roundtrip.test.ts`
- `docs/owner-notes-audit-v11-evidence/b46-pose-studio/*`
- `docs/sol-reports/impl-b46-pose-studio.md`

VERDICT: studio boots; drag-edit round-trip proven; laws enforced; evidence path `docs/owner-notes-audit-v11-evidence/b46-pose-studio/`; files touched are the additive pose-studio client, Weaponsmith catalog API, Vite/portal/package wiring, round-trip test, evidence, and this report.
