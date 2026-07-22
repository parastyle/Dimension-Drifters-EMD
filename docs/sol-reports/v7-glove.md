# V7-GLOVE Sol Report

## Status

- 2026-07-21: Work started on branch `feat/v0.118-metagame`.
- Live-first reproduction completed against the already-running `http://localhost:5180` / `2567` stack with `x2-coyote-trickster-s-sparkmitt`, held for 2.5 seconds wall time. No implementation files had been changed.
- Before evidence: `docs/owner-notes-audit-v7-evidence/glove/before-idle.png`, `before-held-0650ms.png`, `before-held-2500ms.png`, and `before-live-capture.json`.
- Captured 36 rendered rig frames spanning accepted attack sequences 0–5. The hidden receiver hands and visible glove sprites remained on the same anchors (`0 px` glove-to-hand delta), but the peak glove travel inside any accepted beat was only `0.576 px`, or `0.372%` of the rendered body width. Maximum single-frame travel was `0.107 px`.
- The owner report is confirmed: zero captured frames retained an active swing/punch descriptor, while all 36 frames were owned by the steady performance pose. The only motion was sub-pixel idle/jiggle drift.

## Root cause

- NG2 correctly made the glove sprites replace the hand art while retaining the original hand nodes as transform authorities.
- W-CONVERT correctly made Sparkmitt and Hex-Mitt render as two glove parts via `def.glovePair`.
- V6M correctly authored Sparkmitt's eight-beat punch combo and 0.12 s held cadence.
- The live equip convergence check in `ArenaScene.equipWeapons()` recognizes only `def.dual` as a same-weapon second hand. A `def.glovePair` rig therefore looks permanently mismatched (`heldOffMatches === false`). Because lazy expansion art remains in the pending set, `equipWeapon()` runs again every frame; `equipLoadout()` calls `resetSwingCombo()` every frame after each predicted/accepted `triggerSwing()`. Unit tests equip once and therefore never exercise this live reset loop.
- Result: the V6M punch path writes real offsets to the retained hand channels and the visible glove sprites would follow them, but the live render loop erases the punch descriptor before `SpriteRig.animate()` can sample it.

## Implementation

- Fixed live equip convergence so `def.glovePair` is recognized as the same weapon occupying the rear receiver. A post-fix live probe recorded zero re-equip calls during hold and immediately exposed the previously hidden V6M punch path.
- Added a systemic monk lane for empty fists and every close-range worn punch weapon. It excludes projectile/beam gauntlets, claw/rake weapons, and stronger authored performances such as Thunderhead Stormfists' lunge.
- The monk lane uses fast straight punches with a deep chamber, full extension/retraction, accepted-hand routing for real lead/rear alternation, mirrored hip/torso rotation, and a small whole-paper forward shoulder step. The rear-channel routing bug that could zero an off-hand punch was also fixed.
- Monk presentation now has a 240 ms minimum readability envelope. Sparkmitt still accepts a new punch every 120 ms, so the requested numerous flurry cadence is unchanged; the longer presentation envelope prevents its former 76.8 ms pose from starting and ending entirely between low-rate rendered frames.
- Paired monk gloves now treat the accepted `swingHand` as the sole lead/rear authority. The per-hand combo chain's authored `comboPose.hand` can no longer override it on later cycles and turn an intended alternation into repeated rear strikes; the live gate records and asserts the accepted hand order as well as both hands' actual travel.
- Sparkmitt and Hex-Mitt now use the existing server-owned `performance.forwardDrift` seam while held (`48 px/s` and `42 px/s`, respectively), rather than faking root motion in the renderer.
- Current systemic close-punch coverage includes: Bare Fists, Revenant Knuckle, Sparkknuckle Hex-Mitt, Cinderpalm Brand-Glove, Pyreclap Mauler, Frostknuckle Rimewrap, Stormcradle Faradaygloves, Blightgrip Spore-Mitt, Ironbrand Heatfist, Prismhex Diffraction Gauntlet, and Coyote Trickster's Sparkmitt. Thunderhead Stormfists keeps its stronger authored lunge; Wyrmscale Hex-Talon keeps rake; ranged/beam gauntlets keep firing poses.
- Added permanent live gate `e2e/tests/v7-glove-live-gate.spec.ts`. It holds Sparkmitt for 2.5 seconds and fails on per-frame re-equip, visible receiver hands, glove/hand anchor disagreement, missing lead/rear alternation, either fist below `40%` character-width peak travel, insufficient body rotation, or missing forward drift.

## Validation log

- Focused glove-render/classification coverage: **4/4 passing**.
- First live-gate iteration proved the reset fix (`0` re-equip calls, `29` accepted held beats) and measured a `1.171x`-body-width lead strike plus `0.198 rad` body rotation. Its software-rendered 1280 px capture undersampled every 76.8 ms rear strike while screenshots blocked RAF, so that run correctly failed rather than weakening the `40%` per-hand law.
- The permanent gate now captures its uninterrupted 2.5-second measurement at 640x360 and records evidence screenshots in a separate replay, preventing image encoding from hiding the fast rear-hand frames.
- Permanent live gate: **passing repeatedly**, including inside the complete e2e invocation. One uninterrupted warm-stack capture recorded 48 natural render frames over 2.755 s, 17 accepted beats, strict `0,1,0,1...` hand order, `0` re-equips, `0 px` glove/hidden-hand anchor error, `0.224 rad` body rotation, and `4.751 px` visible forward shoulder travel. All 11 naturally phase-complete punches cleared the owner threshold (`0.585x`–`0.901x` character width).
- The final evidence JSON was rewritten after restoring the client service and records 41 natural render frames over 2.962 s, 18 accepted beats, `0` re-equips, strict alternation, `0.225 rad` body rotation, `4.390 px` forward shoulder travel, and live mounted-rig lead/rear peaks of `1.116x` / `1.542x` character width. Every gate assertion is `true`.
- Visual QA passed for the rewritten after frames: `after-held-0420ms.png` and `after-held-2500ms.png` show the previously torso-locked Sparkmitt traveling into the open lane. The JSON retains every natural frame, consecutive-frame displacement, both fixed-phase punch traces, and every gate assertion.
- `pnpm typecheck`: **passing** across shared/client/server.
- `npx vitest run --maxWorkers=1 --minWorkers=1 --reporter=dot`: **128/128 files, 1718/1718 tests passing**. The first parallel launch ended at the worker IPC layer; the first serial pass exposed one unrelated Boss Rush timing flake, which passed both its isolated rerun and the second complete serial pass.
- `node tools/artkit/gen-weapon-expansion.mjs --check`: **passing**. Focused Biome check on the glove-owned files is clean; `git diff --check` is clean.
- Complete external-stack Playwright run: the V7 glove gate passed, with 13/20 specs passing overall. Seven non-glove specs remained red: moving Overcasters burst count, the sibling muzzle catalog command, a dual-pistol timing threshold, the V6.1 Headsman command, two V6A navigation/reload failures, and XP Echo navigation loss. An isolated retry confirmed external instability and the 5180 client later stopped accepting connections; no stop/kill command was issued. The client-only Vite process was restored on 5180, the original 2567 server process remained untouched, and the glove gate passed again after warmup. Both ports are listening at handoff.
- Concurrent V7-HIT/muzzle source edits were preserved. The full e2e aggregate is therefore not all green, but no remaining failure names a glove file or fails the V7 glove gate.
