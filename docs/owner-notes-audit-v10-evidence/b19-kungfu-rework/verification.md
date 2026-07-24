# B19 Kung-Fu Wraps Rework Evidence

## Result

The private-port live gate passed on `proto-cowboy-hidden-face` with eight captures: four wrap styles in right and left facings. It recorded every full combo signature, hand- and foot-anchored beats, the live SpriteRig visibility/mount audit, authoritative position samples, cadence, VFX events, and port isolation in [live-gate.json](./live-gate.json).

- Client port: `52790`
- Game port: `52789`
- Protected ports not used: `5180`, `2567`
- Captures: `8`
- Screenshots: `16` (`hand` and `foot` for every style/facing)
- Rig result per capture: two `part-1` hand overlays, two `part-2` foot overlays, two hidden base hands, two hidden base feet
- Combo result per capture: exact motion/limb signature with punch and kick evidence
- Displacement result per capture: at least five authoritative samples, correct facing direction, nav-limited travel within the authored path budget

## Live cadence and travel

| Wrap | Observed mean cadence | Authored path budget | Right travel | Left travel |
| --- | ---: | ---: | ---: | ---: |
| Muay Thai | 783.3 ms | 39.0 px | 50.0 px | 50.0 px |
| Wing Chun | 245.8 ms | 26.0 px | 14.6 px | 15.0 px |
| Drunken Fist | 522.9 ms | 50.4 px | 38.1 px | 38.1 px |
| Iron Palm | 963.8 ms | 36.0 px | 20.0 px | 20.0 px |

The live order is Wing Chun, Drunken Fist, Muay Thai, Iron Palm from fastest to slowest. Travel can be shortened or redirected by the authoritative nav gate; the 12 px audit tolerance also permits one 50 ms server-step boundary around the sampled combo window.

## Visual QA

Representative hand/foot captures across all four styles and both facings were inspected. The wrap art remains digit-free and single-item, the same hand source is duplicated across two hand joints, the same foot source is duplicated across two foot joints, hand and foot frames remain distinct, and no bare third fist or mixed bare/wrapped foot is visible.

All sixteen retained PNGs are named:

`<weapon-id>-<right|left>-<hand|foot>.png`

## Automated verification

- `pnpm gen` — passed
- `pnpm gen:check` — passed
- `pnpm typecheck` — passed
- `pnpm test` — 167 files, 2,235 tests passed
- `pnpm assets:check` — passed, 478 sprite entries / 1,007 parts
- `pnpm exec playwright test --config=e2e/playwright.config.ts b14-kungfu-wraps-live-gate.spec.ts` — passed, 1 test in 1.6 minutes
- `git diff --check` — passed

Focused coverage includes distinct combo signatures, 20 nominal DPS retention inside the 18–22 band, per-beat server displacement and pit clamping, local correction smoothing, remote snapshot interpolation, exact 2+2 mount plans, both facings, single-item art connectivity, foot muzzles, and per-style limb-aware VFX/SFX routing.
