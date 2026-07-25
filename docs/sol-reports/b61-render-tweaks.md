# B61 render tweaks — T2 boundary shelf and T4 decal alpha

## Scope

Implemented only T2 and T4 in `packages/client/src/scenes/arena/floor-renderer.ts`. The
`FLOOR_STYLES` tile-role arrays are unchanged, and there are no map generation, collision, playable
bounds, boss, or art changes.

## T2 — finite plateau shelf

`drawArena` now derives the painted terrain extent from the 512px tile cadence. In the normal
4800px arena this is 5120px, so the renderer covers the 320px outboard bands with
`palette.pitVoid` at depth -14.5. All four bands belong to one `Graphics` object named
`arena-boundary-void`. That object is the single addressable beyond-shelf layer reserved by R3: a
future parallax pass can replace it without changing the shelf, rim machinery, or gameplay rail.

Four synthetic `PitSegment` runs follow the arena rectangle with outward normals and reuse
`buildPaintedRims` with the active dimension's existing `rim.png`. The south, camera-facing edge
gets the full authored wall; north, east, and west use the existing derived lip. The original 6px
`boundaryRail` remains above both at depth -12 and continues to communicate the exact gameplay
bound.

The T2 block is 41 lines in `drawArena`, including the layer-separation comments. It is render-only:
no collision or playable coordinate changed. Live captures deliberately look 200px beyond the
south rail so the rail, shelf face, and separate void are visible together:

- Re-authored Ashlands: `docs/sol-reports/b61-evidence/shelf-ashlands.png`
- Old-art Frostfell: `docs/sol-reports/b61-evidence/shelf-frostfell.png`

Both packs render the same shelf topology; only their existing rim art differs.

## T4 — per-pack decal alpha

`DimensionFloorStyle` now carries all three role values, with a per-pack override seam and these
defaults:

| Role | Shipped alpha |
| --- | ---: |
| `flat` | **0.18** |
| `edge` | 0.52 |
| `solid` | 0.64 |

Open-floor scatter reads `decalAlphaFlat`. Pit debris selects the alpha from its actual authored
role, so low-projection solid debris uses the solid value rather than being flattened into the edge
value. Every pack currently inherits the defaults; a pack can override any subset without changing
render logic.

### Alpha ladder

`docs/sol-reports/b61-evidence/decal-alpha-ladder.png` uses the same paused live Ashlands frame for
all five panels. The frame contains 43 visible rendered enemies. Only the depth -15 flat-decal alpha
changes between 0.065, 0.12, 0.18, 0.25, and 0.35; enemy, tile, pit, edge-decal, solid-decal, camera,
and simulation state are identical.

Findings:

- **0.065:** effectively absent in the busy frame.
- **0.12:** wear begins to register, but is still easy to lose under enemies and tile linework.
- **0.18:** visible as subordinate ground wear without pulling attention from enemies, the cool
  safe ring, or hot pit rims. This is the shipped default.
- **0.25:** clearer locally, still subordinate to the horde.
- **0.35:** strongest decal read, but the horde remains dominant; more alpha mainly strengthens the
  few occupied locations rather than solving arena-wide wear coverage.

### Density recommendation

Density was measured, not changed. The current 4800px arena evaluates
`round(7 × (4800² / 2400²)) = 28` scatter candidates. The captured seed accepted 16 flat decals
arena-wide, with three inside the 1920×1080 frame. Finding a three-decal spawn-centred view took
seven seeded launches, so the ladder is denser than a typical view; 16 uniformly distributed marks
average only about 1.44 marks per 1920×1080 arena view before camera/spawn-clear bias.

Alpha 0.18 solves visibility where a mark exists, but this budget is too sparse to carry all spatial
wear once base tiles are pristine. Recommend a separate density gate at
`round(10 × area) = 40` candidates, a 43% candidate increase. At the captured seed's 16/28
acceptance rate, that projects to about 23 accepted marks arena-wide and about 2.1 per 1920×1080
view. Re-capture that value before shipping a density change; no density change is included here.

## Verification

- `pnpm typecheck`: clean.
- `pnpm test`: full rerun green — 220 files, 2,764 tests passed, 20 skipped. An initial full run had
  one transient V5M damage assertion; its isolated rerun passed, followed by the clean full rerun.
- Live capture console/page errors: none.
- `git diff --check`: clean; edited source and report use LF endings.

VERDICT: T2 = one replaceable void layer plus four outward reused-rim shelf runs (41-line `drawArena` block); T4 = shipped flat alpha 0.18 (edge 0.52, solid 0.64); ladder = `docs/sol-reports/b61-evidence/decal-alpha-ladder.png`; captures = `docs/sol-reports/b61-evidence/shelf-ashlands.png`, `docs/sol-reports/b61-evidence/shelf-frostfell.png`; tests = `pnpm typecheck` clean and full `pnpm test` green (220 files / 2,764 passed / 20 skipped).
