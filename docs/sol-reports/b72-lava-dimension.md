# B72 — additive procedural Lava Foundry dimension

## Scope and invariants

`lava-foundry` is a sixth, additive dimension. It does not replace or alias `ashlands`. It enters the
same `GameRoom`, `ArenaScene`, client predictor, authoritative server movement, combat, enemy, weapon,
boss, chest, progression, and netcode paths as the five existing dimensions. Its Ashlands enemy/boss
selection is deliberate content reuse; the map itself has a distinct dimension id and generator.

The existing generator remains the exact code path for `wild-west`, `frostfell`, `verdant-ruins`,
`ashlands`, and `neon-cyber`. `generateDimensionArena` delegates byte-for-byte to the historical
`generateArena` unless the id is exactly `lava-foundry`.

Platform and hero-room display objects use `setScale(room.nativeScale)`, where the generated registry
type fixes `nativeScale` to the literal `1`. No platform or mega-room calls `setDisplaySize`. Each of
the three `mega-connected` PNGs is registered and placed as one indivisible hero-room prefab. Debris
is explicitly `nonColliding: true` and is never consulted by navigation.

## Minimal shipping import

Imported 31 PNGs, 66,636,796 bytes total. No raw generation directories, diagnostics, previews, or
prior-iteration output were copied. A final SHA-256 audit matched all 31 imported PNGs to the source
package; all four normalized manifests parsed to the same JSON value as their source files.

Platforms:

- `platforms/01-broken-turntable-arena.png`
- `platforms/02-broken-reactor-arena.png`
- `platforms/03-broken-security-gate-platform.png`
- `platforms/04-broken-glass-observatory.png`
- `platforms/05-broken-lavafall-overlook.png`
- `platforms/06-broken-mega-arena-4k.png`

Indivisible `mega-connected` hero rooms:

- `mega-connected/01-dual-turntable-bridge-4k.png`
- `mega-connected/02-security-to-turntable-bridge-4k.png`
- `mega-connected/03-glass-to-reactor-vertical-bridge-4k.png`

Decorative, non-colliding debris:

- `debris/01-snapped-catwalk-slab.png`
- `debris/02-bent-grated-rectangle.png`
- `debris/03-half-ring-rim-fragment.png`
- `debris/04-red-rail-strip.png`
- `debris/05-cracked-landing-pad.png`
- `debris/06-wide-wedge-deck.png`
- `debris/07-compact-service-panel.png`
- `debris/08-broken-threshold-chunk.png`
- `debris/09-pipe-bundle-walkway.png`
- `debris/10-small-t-junction-chunk.png`
- `debris/11-diagonal-ripped-deck.png`
- `debris/12-square-bolted-plate.png`
- `debris/13-curved-guardrail-chunk.png`
- `debris/14-lava-rock-stepping-slab.png`
- `debris/15-split-double-panel.png`
- `debris/16-narrow-maintenance-beam.png`
- `debris/17-wide-jump-islet.png`
- `debris/18-broken-corner-elbow.png`
- `debris/19-emergency-marker-plate.png`
- `debris/20-fractured-glass-tile.png`

Endlessly tiled lava layers:

- `lava/lava-background-4k-loop.png`
- `lava/lava-flow-overlay-v1.png`

The four shipping manifests were copied with identical JSON data into `data/lava-foundry/metadata/`;
only repository-required LF endings/JSON layout were normalized:

- `v9-master-manifest.json`
- `mega-connected-assets-manifest.json`
- `broken-output-platforms-manifest.json`
- `broken-bridge-pieces-manifest.json`

The generator validates every manifest reference against the imported file, reads the PNG header,
checks native width/height, and emits the nine-entry `PlatformPrefab` registry. The registered ids are
`broken-turntable-arena`, `broken-reactor-arena`, `broken-security-gate-platform`,
`broken-glass-observatory`, `broken-lavafall-overlook`, `broken-mega-arena`,
`dual-turntable-bridge`, `security-to-turntable-bridge`, and
`glass-to-reactor-vertical-bridge`.

## Collision data contract for B73 walkability painter

The sole editable collision authority is
`data/lava-foundry/collision-surfaces.json`. It is keyed by the exact prefab id and uses source-PNG
pixels:

```json
{
  "formatVersion": 1,
  "dimensionId": "lava-foundry",
  "units": "source-pixels",
  "visibleBounds": {
    "broken-reactor-arena": [33, 32, 1498, 882]
  },
  "prefabs": {
    "broken-reactor-arena": {
      "coordinateSpace": "source-pixels",
      "provenance": {
        "kind": "authored",
        "author": "b73-walkability-painter"
      },
      "surfaces": [
        {
          "id": "main-deck",
          "polygon": [
            { "x": 120, "y": 180 },
            { "x": 1420, "y": 180 },
            { "x": 1420, "y": 760 },
            { "x": 120, "y": 760 }
          ],
          "holes": [
            [
              { "x": 650, "y": 380 },
              { "x": 850, "y": 380 },
              { "x": 850, "y": 560 },
              { "x": 650, "y": 560 }
            ]
          ]
        }
      ]
    }
  }
}
```

Painter rules:

1. Replace only the matching `prefabs[prefabId]` entry. Do not rename prefab ids or alter native PNG
   dimensions.
2. `polygon` is a walkable outer boundary in source-image pixels. It must contain at least three
   finite points. `holes` are non-walkable openings inside that boundary; multiple surfaces and
   multiple holes are supported.
3. Keep `coordinateSpace: "source-pixels"` and set `provenance.kind` to `"authored"`. Other provenance
   strings/numbers are allowed for author/tool/revision notes.
4. Run `node tools/mapkit/gen-lava-dimension.mjs`, then
   `node tools/mapkit/gen-lava-dimension.mjs --check`. The generator rejects unknown/missing ids,
   out-of-image coordinates, malformed polygons, manifest drift, or any native-size mismatch.

At runtime each polygon is translated by the placed PNG's world `x/y` with scale exactly 1, holes are
subtracted, and the result is sampled into the existing `ArenaMap` at 20 px. Empty alpha outside the
deck and authored holes remain lava; decorative debris never adds ground.

The shipped default uses `derived-alpha-v1`: alpha threshold 40, a 12 px derivation cell, a 48 px
actor-edge inset, lower-silhouette trimming, and molten-opening rejection. This follows the visible
deck silhouette rather than a bounding box. The reactor opening is retained as a lethal hole. These
defaults are intentionally replaceable by the painter without a code edit or a new runtime format.

## Room graph and placement

The generator constructs this abstract graph before choosing or placing art:

```text
spawn → route → hub → exit
                  ↘ branch → reward
```

Regular generation selects role-compatible prefabs deterministically, then places them at native
size relative to the graph edges. A candidate is rejected when it leaves the 4800×4800 arena, exceeds
32% overlap against the smaller visible bounds, or produces a graph-edge gap above the traversal
budget. Up to 32 seeded attempts are available; rejected-attempt count is retained in the layout.

A hero-room roll is rare (16%). When selected, one complete `mega-connected` image hosts the adjacent
`hub` and `reward` graph roles through `graphNodeIds: ["hub", "reward"]`; it is never cut into two
platforms. Five debris pieces are seeded away from rooms and traversal corridors, rendered only as
non-colliding decoration. No modular bridge snapping is used. Chunk streaming is intentionally absent.

## Traversal and existing-pipeline integration

The shipped distance-jump reach is 372 px. Lava layout generation caps every measured platform gap at
340 px, preserving 32 px of margin. The canonical evidence seed produced graph gaps of 138, 135, 112,
205, and 145 px. One hundred independently generated layouts passed the existing navigation audit at
that real cap.

The live private-server traversal capture used the normal predictor, sequence-numbered input,
authoritative `GameRoom` simulation, schema acknowledgement, existing distance-jump launch, and
existing collision. From a full-footprint-safe takeoff at `(3271.58, 1668.43)`, the player crossed the
200 px raster gap and settled on the route room at `(2835.58, 1668.43)`, height 0. The same live run
also exercised the existing chest director after 25 seconds. The finer 20 px raster has 5,707 valid
24 px full-footprint positions on this seed, and chest placement succeeded without a Lava-specific
pipeline.

The endless background is two independent `TileSprite` layers behind all world objects. Both tile
continuously, cover the camera at any zoom, drift slowly over time, and apply different slow camera
parallax rates. They are not screen-locked single images.

## Determinism

Canonical evidence seed:

```text
seedTerrain = 2654435761
seedHazard  = 97
seedTheme   = 7919
seedDecor   = 104729
```

Regenerating twice yields SHA-256
`d810d5d79e78f8a3d2d8126157d76018200150d738cf7745e1a047a09a6f08f2` over the tile raster plus
serialized lava layout.

## Visual regression evidence

Each old-dimension capture came from a real private server and the unchanged shared `ArenaScene`.
For every capture, the client joined the requested dimension, built its map, closed onboarding,
accepted held movement, and observed a changed authoritative player position before saving the image.

| Dimension | Live movement proof `(before → after)` | Capture |
| --- | --- | --- |
| Wild West | `(2485.33, 2367.30) → (2977.87, 2462.48)` | [regression-wild-west.png](b72-evidence/regression-wild-west.png) |
| Frostfell | `(2435.93, 2443.56) → (2939.03, 2412.39)` | [regression-frostfell.png](b72-evidence/regression-frostfell.png) |
| Verdant Ruins | `(2371.68, 2451.74) → (2818.79, 2477.93)` | [regression-verdant-ruins.png](b72-evidence/regression-verdant-ruins.png) |
| Ashlands | `(2470.53, 2474.95) → (2934.53, 2474.95)` | [regression-ashlands.png](b72-evidence/regression-ashlands.png) |
| Neon-Cyber | `(2454.96, 2391.15) → (2943.49, 2437.57)` | [regression-neon-cyber.png](b72-evidence/regression-neon-cyber.png) |

New dimension:

- [lava-overview.png](b72-evidence/lava-overview.png) — four native-scale authored rooms visible over
  fully tiled lava, with the player standing on the spawn room.
- [lava-traversal.png](b72-evidence/lava-traversal.png) — player settled on the route platform after the
  authoritative spawn-to-route distance jump; the traversed lava gap and source platform are visible.

The regression test also compares each old id's generated tiles, zone data, zone seeds, spawn, and
absence of lava metadata against a direct call to the historical generator.

## Verification

- `pnpm gen` — passed.
- `pnpm gen:check` — passed. Its pre-existing VFX-subject check skipped because the 360 untracked
  reference artifacts are not present; every available generated artifact was in sync.
- `pnpm typecheck` — passed.
- Focused Lava Foundry/mapgen/server progression/boss suites — passed.
- Full `pnpm test` — passed: 234 files, 2,842 tests passed, 20 skipped.
- Browser evidence run — six dimensions joined and rendered; all six accepted authoritative movement;
  Lava Foundry traversal landed across a generated gap.
- `data/weapon-concepts-300.json` — untouched.

VERDICT: dimension id `lava-foundry`; 9 platform/hero prefabs registered; collision format `lava-foundry/collision-surfaces.json` v1 source-pixel polygons with holes and per-prefab authored overrides; existing dimensions verified 5/5; deterministic seed/digest confirmed; tests green (234 files, 2,842 passed, 20 skipped).
