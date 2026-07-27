# B73 Walkability Painter

## Outcome

The owner now has a Pose Studio-style local authoring tool for painting prefab collision directly
over native platform art. It is tool and data only: this branch does not change movement, gameplay
collision, lava-dimension placement, the weapon catalog, or runtime collision resolution.

Launch from the repo root:

```powershell
pnpm walkability-painter
```

The command builds `@dd/shared`, starts the write API on port `5051`, and starts the existing client
Vite server on port `5180`. Open:

```text
http://localhost:5180/walkability-painter.html
```

If the client port is already occupied, set `PORT` to another port before launching. If the API port
is occupied, set `WALKABILITY_PAINTER_API_PORT`; the Vite proxy and API process both read it.

## What the tool provides

- A status-first prefab library: cyan dot means a prefab has saved collision; a hollow dot means it
  is untouched and displaying only an automatic seed.
- Manifest loading for the six lava V9 platforms and three connected hero-room prefabs, at native
  source dimensions and default `100% · 1:1` zoom.
- Repo art discovery under dimension, terrain, and prefab roots. Repo-owned art wins over an
  external handoff asset with the same prefab id.
- External package discovery through `LAVA_PACKAGE_ROOT` or the local lava V9 handoff directory.
  The tool serves those images in place and does not copy large assets into this repo.
- A polygon tool for clicking an irregular walkable region directly over the art.
- Select/edit mode with draggable vertices and exact pixel nudging.
- Multi-step undo and redo.
- Delete-region and explicitly confirmed auto-reseed operations.
- A cyan fill/stroke overlay showing the exact polygons that will be written for runtime
  consumption.
- A cursor standability read:
  - `YES`: the center plus 16 samples around the configured player footprint are inside the union
    of the walkable polygons.
  - `EDGE`: the center point is walkable but the preview footprint crosses the boundary.
  - `NO`: the center is outside the authored collision.
- A configurable `4`-`64` px preview footprint radius. This is an authoring probe; the saved data is
  only the exact polygon geometry, so B72 remains responsible for applying the runtime player shape.
- Explicit save only. Switching prefabs, reseeding, and closing the page guard unsaved work.
  Successful saves show the confirmed time, data path, prefab id, and polygon count.

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `V` | Select/edit tool |
| `P` | Polygon tool |
| Click first vertex or `Enter` | Close the active polygon |
| Double-click | Close an active polygon after at least three points |
| `Escape` | Cancel the active polygon; undo can restore it |
| `Backspace` | Remove the last vertex from the active polygon |
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` | Redo |
| Arrow keys | Nudge the selected vertex by 1 native pixel |
| `Shift` + arrow keys | Nudge the selected vertex by 10 native pixels |
| `Delete` | Delete the selected polygon |
| `A` | Request a fresh alpha-derived seed; a confirmation dialog protects in-memory work |
| `O` | Toggle the collision overlay |
| `Ctrl+S` | Explicitly save collision to the repo |

## Collision data format — full contract

The tracked runtime handoff is:

```text
data/prefab-walkability.json
```

The complete format is:

```json
{
  "version": 1,
  "coordinateSpace": "prefab-local-pixels",
  "polygonsByPrefab": {
    "prefab-id": [
      [
        [120, 80],
        [420, 96],
        [400, 260],
        [138, 248]
      ],
      [
        [500, 140],
        [620, 150],
        [608, 280]
      ]
    ]
  }
}
```

Contract:

- `version` is exactly `1`.
- `coordinateSpace` is exactly `"prefab-local-pixels"`.
- `polygonsByPrefab` is keyed by the stable prefab id from the art manifest.
- Each prefab value is an array of polygons.
- Each polygon is an array of `[x, y]` points.
- The origin is the PNG's top-left pixel.
- Positive `x` goes right and positive `y` goes down.
- Coordinates use the PNG's native, unscaled pixel dimensions.
- A polygon has at least three distinct points.
- The closing point is implicit; do not repeat the first point at the end.
- Multiple polygons are unioned into the prefab's walkable surface.
- All points must be finite and inside `[0, imageWidth] × [0, imageHeight]`.
- Presence of the prefab key means authored/saved. Absence means untouched; automatic seeds are
  preview-only until the owner chooses Save.
- The save server rounds coordinates to integer pixels, removes consecutive/closing duplicates,
  rejects empty, degenerate, oversized, or out-of-bounds data, sorts prefab ids, writes LF JSON, and
  replaces the file atomically.

This deliberately contains no world placement, transform, gameplay resolution, player radius, or
dimension-specific logic. B72 can load `polygonsByPrefab[prefabId]` directly and transform those
native points with its placed prefab.

## Automatic seed

Untouched prefabs never open blank:

1. The server reads the real PNG alpha channel and downsamples only for analysis, capped at 256 px
   wide.
2. It finds the largest connected visible-alpha components and discards tiny sparks/debris.
3. For each retained component it traces the upper visible envelope, insets from the art edge, and
   trims the lower 18% of each alpha column to avoid seeding the hanging platform wall as walkable.
4. It median-smooths and simplifies the outline, then maps every vertex back to native integer pixel
   coordinates.
5. The seed remains memory-only and the library continues to say `UNTOUCHED · AUTO SEED` until an
   explicit save.

The derivation is intentionally a fast first guess, not silent authorship. The owner corrects the
polygon against the cyan overlay and the standability probe.

## Live round-trip evidence

The tool was launched through the new package command with the Vite UI on port `5187` because the
default `5180` was already occupied by another worktree. The live `/api/walkability-painter` Vite
proxy then:

1. discovered all 9 real walkable lava V9 prefabs without copying the package;
2. loaded
   `claude-lava-procedural-v9-package-20260726/assets/platforms/01-broken-turntable-arena.png` at its
   native `1368 × 1007` size;
3. returned `origin: "alpha-seed"` with one 62-vertex polygon;
4. corrected a seed vertex and posted it through the live save endpoint;
5. reloaded the same prefab with `origin: "saved"`;
6. proved the reloaded polygon array exactly equalled the save response.

`tests/walkability-painter-roundtrip.test.ts` separately covers the disk store: it saves two native
pixel polygons to a temporary collision file, verifies normalization and LF output, reloads identical
data, and proves an invalid out-of-bounds write leaves the existing file unchanged.

Browser captures could not be produced. The connected browser runtime reported no available browser
backend, so `docs/sol-reports/b73-evidence/painter-ui.png` and
`docs/sol-reports/b73-evidence/painter-saved-overlay.png` do not exist; no captures were fabricated.

## Verification

- `pnpm typecheck` — passed.
- Full `pnpm test` suite with one worker
  (`pnpm run test -- --maxWorkers=1 --minWorkers=1`) — passed: 234 files, 2,828 tests passed,
  20 skipped. The serial worker avoids an unrelated reconnect integration timing flake seen only
  under the machine's fully parallel test load; that test also passed in isolation.
- `pnpm exec biome check` on all changed code/data files — passed.
- Live tool API/proxy + real lava PNG save/reload — passed as described above.
- Browser visual capture — unavailable because the browser runtime exposed zero backends.

VERDICT — launch `pnpm walkability-painter`; tools: native 1:1 polygon paint/edit, undo/redo, alpha seed, exact overlay, footprint stand probe, explicit atomic save; format: v1 `polygonsByPrefab` arrays in prefab-local native pixels; round-trip: real 1368×1007 lava platform saved/reloaded identically through the live Vite proxy plus a passing disk-store test; captures: `painter-ui.png` and `painter-saved-overlay.png` unavailable/not fabricated because no browser backend was present.
