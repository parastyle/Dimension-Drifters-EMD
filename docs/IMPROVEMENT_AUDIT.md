# Dimension Drifters — Improvement Audit

_Prioritized, actionable improvement report. Solo dev + AI agent. Generated 2026-06-19 (M0 "Prove the Game")._

Every finding below was adversarially verified against the actual code; the severities used here are the **post-verification adjusted** severities, which differ in several cases from the raw triage. File:line citations are load-bearing — they are where the fix goes.

---

## 1. TL;DR — the 10 highest-leverage improvements, ranked

1. **Build the dimension-chain / greed loop.** A run is currently one dimension that ends in a binary `victory`. The entire §6 "bank vs push deeper" loop, the 5 authored dimensions, shifter tier-escalation, and banked-salvage tension are all inert without it. (`GameRoom.ts:2210-2228`) — _Critical, large_
2. **Retune the XP curve.** L30 needs ~637k XP; a real 2-min-boss dimension reaches ~L8-9 = 0-1 of the 6 designed signature picks. The build/augment loop barely runs. Pure constant tuning. (`leveling.ts:10-21`) — _High (single highest-ROI fix), small_
3. **Wire the horde-render path (SpriteGPULayer + pooling) before raising MAX_ENEMIES.** Every enemy is a 4-8 GameObject `SpriteRig`; "SpriteGPULayer" was marked done but never written. This is the genre's CPU wall. (`ArenaScene.ts:785`, `SpriteRig.ts:60-164`) — _Critical, large_
4. **Wire StateView area-of-interest + Tier-2 soft-sync.** Every client gets the full entity stream; O(enemies × clients). Hard blocker for the 10p load test, and the cap-80 horde can't reach "hundreds per player" until it's done. (no `StateView` anywhere in server) — _Critical, large_
5. **Add a spatial-hash broad-phase.** Enemy separation is O(n²) every tick and _every_ AoE/contact/projectile query is a full enemy scan. One grid fixes all of them at once and is the single highest-leverage server perf change. (`GameRoom.ts:671-722`, `1928-1949`) — _High, medium_
6. **Build the in-run loot spine (rarity + 1 affix + Gems) and make salvage bank-or-lose.** No rarity, no affixes, no currency, salvage never persists. The loot dopamine loop and dormant LUK have nothing to read; 297 weapons are flat stat-blocks. (`weapons.ts` has no `rarity`/`affix`) — _Critical, large_
7. **Hit-stop on actual melee contact + kills, not just on quake-on-swing.** The most-used action (basic swing) has the least feedback; the one `hitStop()` call even fires on a whiff. (`ArenaScene.ts:1665`) — _High, medium_
8. **Surface the two combat verbs on screen.** RMB-fire and LMB-parry appear in _no_ HUD string; `index.html` still shows stale "open a 2nd tab" POC copy. A new player literally cannot discover how to fight. (`ArenaScene.ts:1983-1989`) — _High, small_
9. **Give the parry player-side feedback (cooldown / i-frame / chain ring).** The signature mechanic shows the local player nothing about their own state; `localParryCd` is tracked but never drawn. (`ArenaScene.ts:1693`) — _High, medium_
10. **Add the missing test guards on the progression + damage primitives and the codegen drift gate.** `progression.ts` (level-up loop), `damageEnemy` (the single damage hinge), and codegen stat-staleness all ship green today on a silent regression. (`progression.ts:35`, `GameRoom.ts:1572-1583`, `tests/data-consistency.test.ts:53-67`) — _High, small/medium each_

The pattern: **the moment-to-moment combat works, but the meta-loop that makes it a _game_ (chain → loot → bank → deeper) is unbuilt, the progression curve makes its own augment system unreachable, and the perf/netcode scaffolding for the stated 10p ceiling is deferred.** Fix the loop and the curve first (cheap, transformative), then the scale work (expensive, gating), then feel/onboarding polish.

---

## 2. Findings by severity

### CRITICAL

#### C1 · Dimension-chain / greed loop is unbuilt — a run is a single dimension ending in a binary win
**Problem.** The core §6 run structure ("the chain = the greed loop": extract to bank, or push deeper at higher difficulty) does not exist. Survive 120s → kill boss → step in portal → `state.outcome="victory"`, field cleared, terminal. No "extract vs push deeper" choice, no second dimension, no stacking difficulty, no depth metric. `grep` for `chainDepth|nextDimension|pushDeeper|runDepth` is empty. 5 dimensions + 4 extra bosses are authored but only the menu-picked one is reachable. The client even self-documents the gap (`ArenaScene.ts:469-470`: "the greed loop is 'bank now vs push deeper.' (Deeper-dimension continue… land with §13)").
**Evidence.** `GameRoom.ts:2210-2228` (checkExtraction → terminal victory); `state.ts:170-171` (outcome only active/victory/defeat, no depth field); spec §17 line 398 lists "P5 dimension-chain transitions" as the sole un-built phase.
**Fix.** On portal-step, instead of `victory`, advance to a `chainDepth`-incremented next dimension: carry squad + stats + arsenal + salvage, re-seed the map, pick the next `dimensionId`. Surface extract-vs-push at the portal (two interactables, or hold-to-extract). Reserve `victory` for an actual extraction.
**Effort.** Large.

#### C2 · SpriteGPULayer was never implemented — every enemy is a full multi-Image SpriteRig
**Problem.** Task #79 ("Multiatlas codegen + SpriteGPULayer for the swarm") is marked COMPLETED but only the multiatlas half shipped. There is no SpriteGPULayer / Blitter / RenderTexture layer anywhere in the client — `grep` returns nothing in src. Every enemy is a `SpriteRig` Container of 4-8 GameObjects (shadow + body + hands + feet + optional weapon + glow + label), each re-positioned/rotated/scaled per frame in `animate()`, with `new SpriteRig(...)` called **unconditionally** per enemy. The multiatlas kills texture rebinds (good) but the per-object transform + batcher cost per child is fully paid — at "hundreds per player" this is tens of thousands of transformed quads/frame on one render thread.
**Evidence.** `ArenaScene.ts:785` (`new SpriteRig` per enemy, no archetype branch to a lighter path); `SpriteRig.ts:60-164` (construct), `356-525` (per-frame child mutation); spec §28/§23.8/§5 name it load-bearing.
**Fix.** Render trash/swarm (the bulk of the count) as a single quad each (body only, no procedural rig) via a SpriteGPULayer / Blitter / RenderTexture-stamped layer; reserve the full `SpriteRig` for players + toughs + bosses + duelists. Gate by archetype the same way Tier-1/Tier-2 sync should split. Reconcile the task-list claim with reality.
**Effort.** Large. _(Companion to the pooling work in H-perf below.)_

#### C3 · StateView area-of-interest filtering is unwired — full entity stream to every client
**Problem.** No Colyseus `StateView` / AoI filtering anywhere in the server. Every client receives full per-tick patches for ALL players, ALL enemies (cap 80), ALL projectiles (uncapped), zones, pickups — regardless of camera proximity. Cost is O(players × entities); at 10p even the current 80 enemies = 800 per-entity patch streams every 50ms. Spec §4 line 70 and §27.2 line 780 explicitly flag this as required before the 10p load test; `state.ts:11` and `constants.ts:90` admit it in comments.
**Evidence.** `grep StateView|addAreaForView|setView|@filter` → only two doc comments, zero usage. `onJoin` (`GameRoom.ts:724-759`) assigns no `client.view`. `MAX_ENEMIES=80` (`constants.ts:92`); `fireProjectile` (`GameRoom.ts:1422`) has no count cap.
**Fix.** Give each client a `StateView` and `addAreaForView` around its camera position (radius ≈ screen + margin). Per §4 tiering: keep Tier-1 (players, toughs, boss, run state) globally visible, AoI-filter the trash horde + projectiles. Add a headless N-client bandwidth harness to measure bytes/client/sec at 10p before/after.
**Effort.** Large. _(Tightly coupled to C4 and the cap.)_

#### C4 · MAX_ENEMIES=80 + full Tier-1 sync can't reach the 10p horde budget
**Problem.** Spawn director hard-stops at 80 (a documented POC placeholder). The design target is "hundreds of enemies per player" + a 10p load test. At 80 total the genre fantasy is impossible at any player count, and because every enemy is full Tier-1 Schema synced to every client (no AoI — see C3), scaling the cap up multiplies bandwidth linearly. _Severity adjusted to **High** by verification only because it's acknowledged-deferred work, but it's the same blocker cluster as C3._
**Evidence.** `constants.ts:88-93`; `GameRoom.ts:2025` (`while … enemies.size < MAX_ENEMIES`); the cap is flat — no player-count scaling.
**Fix.** Wire Tier-2 split first: hard-sync players/toughs/bosses/loot, soft-sync the trash horde (spawn-seed broadcast or compact AoI batch so clients reconstruct positions). Then wire StateView (C3). _Only then_ raise `MAX_ENEMIES` toward budget, scaled by player count rather than flat.
**Effort.** Large.

#### C5 · No in-run loot economy: rarity, affixes, Gems are entirely absent
**Problem.** §10/§13 lock 7 rarity tiers, exactly-one Terraria affix per weapon, and Gems currency — the spine of loot dopamine and the salvage→parts→pack meta. None exists. `WeaponDef` has no `rarity`/`affix` field; no Gems pickup, no rarity roll on drop, no cursed-purple telegraph. The only drop path (`maybeDropWeapon`) spawns a fixed-identity weapon at a flat chance. Weapons have zero power variance beyond static base stats, so the "mystery drop" loop and the dormant LUK attribute (synced, reset to 1, never read into any calc) have nothing to read.
**Evidence.** `weapons.ts` — zero `rarity`/`affix` (grep clean); `PickupState` (`state.ts:112-117`) is id/x/y/weapon only; `maybeDropWeapon` (`GameRoom.ts:1829-1840`).
**Fix.** Add `rarity` + single `affix` to `WeaponDef`; a roll-on-drop helper (rarity table + affix table touching cooldown/durability/charges/AoE per §10); wire the ghostly-purple cursed telegraph on `PickupState`; add a Gems field + vacuum pickup. Unlocks LUK, the cursed gamble tier, and gives the 297 weapons in-run variance.
**Effort.** Large. _(Prerequisite for promoting any expansion weapon — see M-power-budget.)_

---

### HIGH

#### H1 · XP curve makes the level/augment loop unreachable
**Problem.** `XP_BASE=6, XP_GROWTH=1.45, LEVEL_CAP=30` → cumulative L30 ≈ 637,681 XP, L20 ≈ 15,514. Normal kills are worth 1-3 XP (toughs ×4). Worse than the finding assumed: the boss gates each dimension at **120s** and every player is **reset to L1 each run** (XP doesn't persist across the chain), so a real single-dimension run reaches ~L8-9 by the boss = **0-1** signature picks out of the 6 designed. The 9-card draft pool barely gets exercised; the "every run builds a different parry" promise collapses. The curve is steeper than kill-rate scaling can ever match.
**Evidence.** `leveling.ts:10-21`; `enemies.ts` xpValues (1-11); `TOUGH_XP_MULT=4` (`constants.ts:191`); `SIGNATURE_INTERVAL=5` (`augments.ts:115`); `grantXp` fires only on kills (`GameRoom.ts:1221-1227`), no time/depth XP; L1 reset at `GameRoom.ts:616-620`.
**Fix.** Pick one (all pure tuning): flatten the curve (`XP_GROWTH ≈ 1.12-1.18` or additive per-level step) so L30 is reachable in ~40-50 min of competent play; **or** scale enemy `xpValue` with run-time/depth; **or** persist XP across the chain (pairs naturally with C1). Add a test asserting `cumulative-XP-to-cap / expected-kill-XP-per-minute ≤ target run length`.
**Effort.** Small. **This is the single highest-ROI change in the audit.**

#### H2 · Difficulty scales only with run-time + player-count, never with chain depth
**Problem.** Every lever (`toughChance(elapsed, players)`, `enemyHpScale(players)`, `spawnInterval(elapsed)`, flat `BOSS_SPAWN_SECONDS=120`) is keyed to wall-clock + player count. Nothing scales with depth because depth doesn't exist (C1). Even once chaining lands, dimension 3 would be no harder than dimension 1 at the same clock. The §6 "difficulty escalates with depth" + "stacking elite-density/affix modifiers" promise has no hook.
**Evidence.** `enemies.ts:402-417` (no depth param); `constants.ts:198`; `DimensionDef` carries no difficulty band.
**Fix.** Thread `chainDepth` into the scaling functions (HP/tough/spawn-rate multiplier per dimension cleared; adjust the boss timer per depth). Seed the §6 affix/elite-density modifier as a per-depth roster reweight. Keep it data-driven on `DimensionDef` so each dimension carries its own base band.
**Effort.** Medium. _(Gated behind C1.)_

#### H3 · Hit-stop fires only on the quake weapon (and on swing, not contact)
**Problem.** Hit-stop is the core "juice" primitive, but `this.hitStop()` is invoked exactly once — inside the `weapon?.quake` branch of the input handler, **before** any hit is confirmed (fires on a whiff). A normal sword connecting, a kill, a parry, a gun hit, a chain proc → zero freeze. At horde scale the most-used action feels like it passes through wet paper.
**Evidence.** `ArenaScene.ts:1665` (only call site, in RMB handler); gun branch `1666-1670` and melee branch `1671-1684` never call it; `hitStop()` def `1752-1755`.
**Fix.** Fire a short hit-stop (~40-70ms) on confirmed melee edge contact (off synced hp-drop / kill seq, which `updateCombatFx` already reads) and a longer one (~90-120ms) on kill / successful parry. Scale magnitude by hit weight (heavy slam > dual-dagger). Keep it off whiffs.
**Effort.** Medium.

#### H4 · Every contact archetype lunges like a duelist AND keeps passive contact DPS
**Problem.** `effectiveMelee()` derives a telegraphed lunge for rusher/swarm/zoner, routing all three through `stepDuelists` — the same rhythm as the Ronin — while their continuous `contactDamage` still applies on top. The four §15 melee archetypes converge on one rhythm. Worst case: the zoner (pricklepulp, speed 62, designed slow UNPARRYABLE area-denier) now does puddle DoT **+** continuous contact **+** a parryable lunge simultaneously. Players can't read threat from behavior.
**Evidence.** `enemies.ts:277` (`LUNGE_ARCHETYPES = {rusher,swarm,zoner}`), `279-302`; `GameRoom.ts:951→967→stepDuelists`; contact loop `1006-1029` has no combo-phase guard; zoner `enemies.ts:128-137` + puddle `1967-1992`.
**Fix.** Exclude `zoner` from `LUNGE_ARCHETYPES` (puddle is its whole threat). Make swarm a no-lunge pure-pressure cloud (danger = numbers + contact). Reserve the lunge for the rusher, and drop/reduce passive `contactDamage` on its lunge frames so it isn't double-dipping. Three legible profiles instead of one.
**Effort.** Medium.

#### H5 · No reconnection support — a brief disconnect permanently drops the player
**Problem.** `onLeave` synchronously deletes the player with no `allowReconnection()` grace, violating spec §22 ("Reconnect grace = whole run"). On any transient blip (cross-region is enabled), the PlayerState — level, attributes, augments (per-run, non-recoverable), weapon, salvage — is destroyed. Client has no rejoin logic either (`connect()` only ever `joinOrCreate`s).
**Evidence.** `GameRoom.ts:761-771`; grep `allowReconnection|reconnect|consented` → none; client `ArenaScene.ts:631-667`.
**Fix.** Branch `onLeave` on `consented`: for unintended drops `await this.allowReconnection(client, RECONNECT_SECONDS)` and only delete on reject. Persist `room.reconnectionToken` client-side (sessionStorage); `connect()` tries `client.reconnect(token)` first, falls back to `joinOrCreate`. Keep combat/input maps alive during the grace window.
**Effort.** Medium.

#### H6 · Salvage is a non-persisted tally with no bank/loss stakes
**Problem.** §6/§13's tension is "bank on extract, lose on death." In code `player.salvaged` is one integer that increments on hold-R, is never written on victory, never zeroed on defeat — pure HUD feedback. No salvage bag, no parts, no Gems conversion, no meta persistence. Neither extracting nor dying has any consequence beyond the win/lose string. _(Deliberately deferred [LOCKED], but the greed loop has zero payload today.)_
**Evidence.** `state.ts:60-62` ("salvage-bag stub… real parts economy isn't built"); only writer `GameRoom.ts:438`; checkExtraction (`2218`) and defeat branch (`1052`) touch it nowhere.
**Fix.** On extract, persist the squad's salvage/parts to a returned run-result payload (drop it on a wipe) so the extract-vs-push decision has stakes. Convert `salvaged` into rarity-tiered parts once rarity exists (C5). Full pack-opening/hub meta (§21) can stay deferred; the bank-or-lose outcome should be real.
**Effort.** Medium. _(Pairs with C1 + C5.)_

#### H7 · 297 of 314 weapons are gated out of every run; active arsenal is 17
**Problem.** The +300 expansion is held out of the live drop/cycle/gallery pool. A real run surfaces only the 17 base ids, and even those reach the player only via the Testing-Grounds gallery (training mode) or **one** fixed enemy drop (only the Ronin sets `wieldsWeapon`). The "40-60 per class" arsenal-cycling fantasy (§10 / M0 exit criterion) is unreachable through normal play.
**Evidence.** `weapons.ts:1045-1049` (`WEAPON_IDS` excludes expansion + fists; `EXPANSION_WEAPON_IDS` for tooling only); `GameRoom.ts:568` (gallery, training only); `maybeDropWeapon` `1829` (gated on `kind.wieldsWeapon`).
**Fix.** Once rarity/drop rolls exist (C5), wire a general drop-on-kill pulling from a curated, dimension-themed slice of the expansion pool (concepts carry `theme`/`family`/`element` tags). Promote expansion weapons into the drop pool in waves as curated, not all-or-nothing.
**Effort.** Medium.

#### H8 · Spatial broad-phase missing — enemy separation is O(n²), every query is a full scan
**Problem.** `resolveEnemyCollisions()` runs every tick: all-pairs i/j loop × 2 relaxation iterations, with an inner per-player loop. At 80 ≈ 6.4k pair-checks (fine); at 600 ≈ ~720k `Math.hypot`/tick = ~14M/sec on one core before anything else. And **every** combat range query linear-scans the full enemy map with no broad-phase: contact damage (`1007-1029`), `stepProjectiles` friendly-hit (projectiles × enemies, `1928-1949`), `stepMeleeSwings` (swings × steps × enemies, `1207-1217`), detonate/ember/brand/chain (`1591/1607/1660/1125`).
**Evidence.** `GameRoom.ts:671-722` (called `981`); no spatial hash anywhere in server.
**Fix.** Add a uniform spatial-hash grid (cell ≈ 2×`ENEMY_RADIUS`): bucket enemies once per tick, test only same+neighbor cells → O(n²)→~O(n). Route **all** radius/arc/segment/projectile queries through it. Replace `Math.hypot` in the hot pair test with squared-distance compares. Single highest-leverage server perf change.
**Effort.** Medium.

#### H9 · The two core combat verbs (RMB fire, LMB parry) are never shown on screen
**Problem.** No on-screen instruction for the two buttons the whole loop runs on. The persistent banner lists Space/T/B but omits both mouse verbs. The only always-on text is stale POC copy in `index.html` ("WASD to move · open a 2nd tab to see co-op sync"). The menu hint has no controls primer. §21's onboarding hub doesn't exist in M0 — so there is **zero** path to learning the controls.
**Evidence.** `ArenaScene.ts:1983-1989` (modeText, no RMB/LMB); input read at `1641`/`1697` but never surfaced; `index.html:6,46-47`; `MenuScene.ts:68`.
**Fix.** Append `LMB parry · RMB fire` to the non-training modeText (it renders every frame — cheapest fix), and/or a one-time controls overlay on first arena entry. Replace the stale `index.html` POC copy with a real control legend or remove it.
**Effort.** Small.

#### H10 · Parry has no player-side feedback (cooldown / i-frame / chain)
**Problem.** The signature mechanic shows the local player nothing about their own state: no cooldown indicator after a whiff (`localParryCd` is tracked but never drawn), no i-frame/active-window cue, no chain-window indicator. A learner who parries early/late just sees nothing and can't tell whiff vs cooldown vs mistimed. §20 lists "parry rings" as a HUD element — unbuilt.
**Evidence.** `ArenaScene.ts:1693` (`localParryCd` tracked), `1781` (chain refresh), `1701` (only triggers a brace pose, comment notes "NO VFX yet"). (The successful-parry white spark exists at `1810-1850`, but only on success vs a telegraphed attack.)
**Fix.** Draw a player-anchored parry-state ring: a brief white flash during the active i-frame window, and a desaturating arc that sweeps back to full as `localParryCd` recovers after a whiff. Closes the learn-the-timing loop and satisfies the §20 element.
**Effort.** Medium.

#### H11 · progression.ts (XP→level→stat→augment) has zero direct tests
**Problem.** `levelUpPlayer` (multi-level while-loop, LEVEL_CAP clamp, +class/+req auto-allocation, `flexPending++`, every-5th `sigPending++`), `allocate` (re-derives maxHp + tops up HP on CON), and `consumeFlex` are the most consequential per-run mutations and are untested. The only related coverage is the pure `deriveStats`. An off-by-one in the loop, a dropped flex point on a double-level, or HP not topping up silently corrupts every run.
**Evidence.** `progression.ts:20,35,47,51`; grep of tests for `levelUpPlayer|allocate|consumeFlex` → none; `GameRoom.test.ts` never drives XP gain.
**Fix.** Add `tests/progression.test.ts`: single-level cross (xp carries remainder, +1 str/+1 req, flexPending=1); multi-level single call (loop N times, flexPending=N, xp below next); L5/L10 grant exactly one sigPending each; LEVEL_CAP stops + zeroes leftover; CON allocate raises maxHp by `CON_HP_PER` and bumps current hp (not above max).
**Effort.** Small.

#### H12 · No determinism/purity contract test for client-replicated calc helpers
**Problem.** Co-op correctness rests on server + client computing identical results for paths the client re-runs (`selectChainTargets`, `coneAngles`, `clampQuakeEpicenter`, `bladeAngleAt`). They're value-tested but nothing asserts they're **pure / Math.random-free** — the property that makes them safe to replicate. The runtime sim uses unseeded `Math.random()` in ~22 server-only places (fine), but the boundary is undocumented and untested: move a `Math.random()` into a shared helper and co-op desyncs the VFX with no failing test.
**Evidence.** Helpers in `combat.ts`/`enemies.ts`/`melee.ts` (currently clean); `fireScatter` even comments "this RNG is purely cosmetic" (`GameRoom.ts:1550`) — an assumption with no guard.
**Fix.** For each replicated helper assert `call N == call N+1` for fixed inputs (locks purity). Add a grep/lint gate failing if `Math.random` appears in the shared client-shared modules (`combat.ts`/`melee.ts`/`enemies.ts`), documenting the §4 server-authoritative-vs-replicated boundary.
**Effort.** Small.

#### H13 · dimensions.generated.ts rosters/bosses are not validated against ENEMY_KINDS
**Problem.** `data-consistency.test.ts` guards weapon cross-refs but the §17 dimension registry (partly codegen'd) has no equivalent. Each dimension's `roster: string[]` and `boss: string` are raw kind ids. A typo/renamed/removed kind fails **silently**: `pickEnemyKind` skips a missing id (thinning the pool), and a bad boss id → `ENEMY_KINDS[bad]` undefined → `spawnBoss` returns with no boss. Same risk for `SHIFTER_KIND_IDS`.
**Evidence.** `dimensions.ts:31-34`; `GameRoom.ts:2033` (roster→pickEnemyKind), `2085-2087` (`if (!kind) return`); no validation in tests.
**Fix.** Extend `data-consistency.test.ts`: for every dimension assert each roster id ∈ `ENEMY_KINDS` with `weight>0`, the boss id resolves to an `ENEMY_KINDS` entry with `archetype: 'boss'`, and every `SHIFTER_KIND_IDS` entry is real. Turns a renamed-kind regression into a build failure instead of a dead dimension found mid-playtest.
**Effort.** Small.

#### H14 · damageEnemy — the single shared damage primitive — is never asserted directly
**Problem.** `damageEnemy` branches (Brand ×1.3, dummy HP-reset-instead-of-die, boss→openPortal, tough→`TOUGH_XP_MULT`, ronin drop, XP return) are the correctness hinge for **all** offense. The integration test only checks coarse outcomes (`enemy.hp < 50`). Worse, `stepProjectiles` **re-implements** the kill/XP/dummy/boss logic inline instead of calling `damageEnemy` — so the two paths can drift with no test pinning equivalence.
**Evidence.** `GameRoom.ts:1572-1583` (primitive); duplicated path `1937-1947`; no XP/Brand/dummy/portal assertion in `GameRoom.test.ts`.
**Fix.** Harness tests: swing kill of a critter grants its `xpValue` squad-wide and bumps level/xp; tough yields `TOUGH_XP_MULT`; branded takes `BRAND_DAMAGE_MULT` more; dummy never dies (hp resets to `DUMMY_HP`); **killing the boss with a swing AND with a thrown projectile both open the portal** (locks the duplicated path).
**Effort.** Medium.

#### H15 · Codegen staleness is not gate-enforced — only the id bijection is checked
**Problem.** The data-consistency validator asserts only **set equality** of ids — it never re-runs `mapWeapon()` to compare generated stats to concept stats. Editing `weapon-concepts-300.json` (bump a damage/cooldown) and forgetting `node gen-weapon-expansion.mjs` passes typecheck+lint+test+build with stale stats baked into the 11.8k-line generated file. Same gap for `dimensions.generated.ts` and the manifests. CI runs only the four standard scripts; the audit's proposed mtime/regen check was never built.
**Evidence.** `tests/data-consistency.test.ts:53-67` (Set membership only); `.github/workflows/ci.yml:24-28`; `gen-weapon-expansion.mjs` has no `--check` mode.
**Fix.** Add `--check` to each `gen-*.mjs` (regenerate into memory, diff against committed file, exit non-zero on mismatch); wire `pnpm gen:check` into ci.yml between lint and build. ~15 LOC/script reusing the existing generation fn. Converts "forgot to re-bake" from a playtest bug into a CI failure for the whole pipeline. _(Tempered: expansion is held out of the active pool, so stale stats only bite on promotion — but the gate is the cheap insurance.)_
**Effort.** Medium.

#### H16 · 297-weapon VFX backlog is rendered but unreachable in the review UI
**Problem.** Phase-2 VFX rendering is done (297 `vfx-x2-*` subjects, 3 candidates each) but there's no way to review/pick/install them from the phone tool. The review server's `MANIFESTS` array omits `subjects-vfx-300.json`, so all 297 are invisible in the gallery/Arena/swipe UI. The only VFX picker is the Weaponsmith (8 weapons, zero `x2-*`). There is no batch curate-pick surface for the stated backlog.
**Evidence.** `tools/artkit/review/server.mjs:46-52` (MANIFESTS omits vfx); `gen-vfx-subjects.mjs:18`; `assignments.json` has 8 keys, 0 `x2-`.
**Fix.** Add `subjects-vfx-300.json` to `MANIFESTS` and give `categoryOf()` a VFX bucket (tag `kind:vfx`). The existing Arena (blind pairwise) + swipe passes then work. Extend `/api/install` (or add `/api/install-vfx`) so promoting a `vfx-x2-*` candidate copies it to the weapon's `assignments.json` image and runs `build-weapon-vfx.mjs`. Mostly wiring on existing infra; biggest unblock for the VFX backlog.
**Effort.** Medium.

---

### MEDIUM

#### M1 · Derived-lunge enemies don't get the directional white-tell cone
**Problem.** The client draws the WYSIWYG danger cone only for enemies whose kind has an explicit `melee` block (the rare Ronin). Derived lunges (rusher/swarm/zoner) set `windup` server-side and **are** parryable, but the client reads raw `ENEMY_KINDS[kind].melee` (undefined for them) → they show a vague white disc+ring with no "where will it hit" cone. Strong tell on the rare enemy, vague pulse on the common horde — backwards.
**Evidence.** `ArenaScene.ts:895` (`mel = ENEMY_KINDS[kind]?.melee`), `896` gates the cone; derived melee comes from `effectiveMelee()`, already exported.
**Fix.** Have the client call shared `effectiveMelee(ENEMY_KINDS[kind])` instead of reading raw `.melee`, so every telegraphing enemy draws the same range/halfArc cone. Near-trivial.
**Effort.** Small.

#### M2 · Boss bullet-wall slugs and all spitter projectiles lack the parryable-white tell
**Problem.** Every hostile projectile **is** parry-negated (invuln skips it) but nothing renders a white/ring cue, so players have no signal that a slug, spit, or Gatlin pellet can be parried — they only ever dodge. The boss P1 bullet-wall (its signature mechanic) and the whole spitter tier teach "ranged = run," burying half the parry's depth.
**Evidence.** `GameRoom.ts:1901-1910` (negated but unmarked); `fireBulletWall` `1320-1332`; `stepSpitters` `1377-1419`; spit projectiles are neon-green pulsing, not white-shrinking-ring; no parry-flash on a parried shot.
**Fix.** Add a shrinking white-ring + bright core to hostile projectiles as they near a player's hitbox (timing is free — constant velocity), and a brief white parry-flash on a parried projectile (reuse `parriedSeq`). Makes ranged parry discoverable and turns bullet-walls into the §16 skill-expression mechanic.
**Effort.** Medium.

#### M3 · 297-weapon expansion has no power budget — promotion is balance roulette
**Problem.** Base melee sits in a tight 13.3-19.6 raw-DPS band; the stat-drafted expansion spans much wider (raw-DPS ~5.7-35, range 80-1100) with long tails. There's no normalization, power-budget formula, or DPS validator, and `weaponDamageSources` sums multiple independently-graded sources (chain/quake/scatter/explode) with no aggregate cap — so curating "one by one" is manual eyeballing. Promoting an outlier silently introduces a best-in-slot or a dead stick.
**Evidence.** `weapons.ts:1043-1049` (gating), `360-421` (uncapped multi-source sum); no power validator anywhere.
**Fix.** Add a pure "effective power" estimator (Σ source base × count × grade-coeff / cooldown, with range/AoE weighting) and a gate test flagging any candidate outside ~0.7-1.3× the base band. Surface the score in the curation tool. Cheap insurance before any expansion weapon enters the drop pool (pairs with C5/H7).
**Effort.** Medium.

#### M4 · Parry chain-juggle loop has no risk ceiling
**Problem.** A successful parry refreshes the cooldown to `PARRY_CHAIN_CD` (0.12s, far below a duelist's 0.34s swingGap) and adds upward launch. The single-parry i-frame window (0.45s) already exceeds the swingGap, so once you read the first beat you can negate every subsequent hit of a multi-hit combo — no stagger, no escalating cost, no negation cap. Against faster flurries / multiple attackers it trends toward a no-risk "win button" (and Hair-Trigger rewards chaining with more free ripostes). Flattens the intended timing tension.
**Evidence.** `constants.ts:241` vs `247`; ronin swingGap `enemies.ts:200`; `GameRoom.ts:1801-1809`; the only consecutive-parry mechanic (`1636-1640`) adds reward, not cost.
**Fix.** Add a small rising cost: each consecutive chain-parry slightly tightens the i-frame window, or the chain cooldown ramps back toward full after N beats, or cap consecutive negations per combo. Keep the first-parry reward generous (the skill moment); kill the infinite no-risk tail.
**Effort.** Medium.

#### M5 · Spawn director/difficulty scales on raw player count, not living players
**Problem.** With the rez-or-dead model, players can be downed for long stretches. Enemy HP sponge + tough-chance scale off `state.players.size` (total connected, **incl. downed**), but spawn anchoring uses only living bodies. A squad of 10 with 8 downed still faces a horde scaled for 10 (~6.4× HP, +64pt tough) while 2 players fight — a death-spiral amplifier that makes near-wipes unrecoverable.
**Evidence.** `enemyHpScale`/`toughChance` called with `players.size` at `GameRoom.ts:2042,2048,2050,2100,2184,1358`; bodies built from alive-only at `803-807`; `ENEMY_HP_PER_PLAYER=0.6`.
**Fix.** Scale HP/tough off a `livingCount` (or a blend that decays toward it) so a mostly-downed squad faces a beatable horde and rezzes are achievable. Optionally keep boss HP keyed to a higher-water-mark; the trash horde should track who can actually fight.
**Effort.** Small.

#### M6 · No client-side prediction — own movement is lerped toward the server
**Problem.** `interpolate()` lerps **every** player including self toward the authoritative position; no prediction for the controlling player. Own movement starts ~1 RTT after a keypress then eases in — mushy proportional to latency, worse cross-region at 20Hz. `sendInput` sends only dx/dy with no sequence number, so there's no reconcile basis either. _(Intentionally deferred M0 item; shared `stepPlayerMovement` was written to be reusable client-side.)_
**Evidence.** `ArenaScene.ts:1515-1527` (lerps all, no self special-case); `sendInput` `2220-2228`; shared `stepPlayerMovement` imported at `GameRoom.ts:129`.
**Fix.** Predict self only: run shared `stepPlayerMovement` locally each frame against current input, render predicted position immediately, reconcile against server snapshots (store input sequence, replay unacked on correction). Keep the lerp for remote players. No server change.
**Effort.** Medium.

#### M7 · Enemy/remote-player interpolation has no extrapolation or snapshot buffer
**Problem.** Remote players + enemies use a single exponential lerp toward the latest snapshot — no interpolation-delay buffer, no velocity extrapolation. At 20Hz (50ms) any jitter or dropped patch makes them stutter/rubber-band. Projectiles **are** extrapolated from vx/vy (good); the moving entities that matter for dodging/aiming are not. `EnemyState` carries no vx/vy, so extrapolation isn't even possible.
**Evidence.** `ArenaScene.ts:1515-1527` + `850-858`; `EnemyState` `state.ts:83-101` (no vx/vy); projectiles dead-reckon at ~`1028`.
**Fix.** Add a small interpolation-delay buffer (render ~one tick in the past, lerp between the last two snapshots on a wall-clock timeline) for players + enemies; add vx/vy to `EnemyState` (or derive render-velocity, already computed) to extrapolate one tick when a snapshot is late.
**Effort.** Medium.

#### M8 · §22 moderation (host kick + AFK) and mid-run drop-in lock unimplemented; host migration ignores configured host
**Problem.** No kick handler, no AFK detection. `onJoin` admits anyone up to `maxClients` at any time including mid-run (a late joiner spawns L1 into a live boss fight). Host handoff just picks the first remaining player with no notify/re-validate, and `isHost` treats a null host as "everyone is host" — so in the window after the last host leaves, any client can fire host-only commands (restart/toggleTraining/spawnBoss).
**Evidence.** No kick/AFK in `onMessage` regs (`GameRoom.ts:326-537`); `onJoin` `724-759` (no run-state gate); host handoff `766-769`; `isHost` `297-299`.
**Fix.** Gate `onJoin` on lobby/run state (reject or seat-as-spectator if `elapsed>0`/`outcome!=active`). Add a host-only `kick` message + per-player AFK timer (last-input timestamp → auto-leave). Tighten `isHost` so a null host grants no one host powers. Optionally surface host identity in `ArenaState`.
**Effort.** Medium.

#### M9 · Per-tick / per-frame allocations create steady GC pressure
**Problem.** Hot loops allocate throwaway objects every tick/frame. Server: `[...enemies.values()]` each tick (`672`), fresh `ids`/`bodies`/`{x,y}` arrays (`801-807`), key-spread prunes (`1379`, `1685`, `1968`). Client: `enemyPrev.set(id,{x,y})` and `prevPos.set(id,{x,y})` allocate per entity per frame (`875`, `1602`), plus key-spread prunes (`565`, `813`, `1004`, `1510`). At 20Hz×N + 60fps this is sustained GC churn — the silent stutter source.
**Evidence.** Listed above. _(Minor: `1062` is `zones` not `pickups`; `nearestPoint` itself doesn't allocate.)_
**Fix.** Hoist reusable scratch arrays/objects to instance fields and refill in place (persistent enemy-list buffer; mutate the existing prev `{x,y}` instead of replacing). Prune maps in-place by iterating + deleting (Map tolerates deleting the current key) instead of spreading keys. Mechanical, low-risk.
**Effort.** Medium.

#### M10 · No object pooling for horde churn (rigs, projectiles, damage numbers, VFX)
**Problem.** Each spawned enemy `new SpriteRig` (4-8 GameObjects + tweens); each death `destroy()`s them + 2 more tweens. Each projectile is a fresh Container destroyed on expiry. Each hit creates a fresh `Text` + tween; each parry/level/explosion creates rings+sparks as one-shot objects. In a bullet-heaven this create/destroy is the dominant client GC cost. _(Note: `VfxPlayer` already pools the player's authored swing-VFX suite — the hottest local effect — so pooling exists; the server-driven horde churn is what's unpooled.)_
**Evidence.** `ArenaScene.ts:785/843/1015/1767/1810/1853`; `SpriteRig.ts:60-164`/`351-354`; `projectile-factory.ts`; `vfx.ts`.
**Fix.** Pools keyed by type: a `SpriteRig` free-list (reset + reposition on reuse), a projectile-Container pool, a ring-buffer of damage-number Texts + common VFX sprites (reuse via setActive/setVisible + restart tween). Companion to C2.
**Effort.** Large.

#### M11 · Client per-frame full-state reconciliation + per-enemy telegraph redraw scales with the whole horde
**Problem.** `update()` runs a fixed full-map sync pipeline every frame regardless of dirty state, each with a `[...keys()]` removal pass. `animateEnemies` clears + refills one shared `telegraphGfx` for the whole horde each frame, and for every telegraphing enemy runs an inner `players.forEach` to aim the cone (O(telegraphing × players)). `updateCombatFx` forEaches all enemies + all players every frame. None of it is camera-culled, so off-screen entities still cost full transform + procedural animate.
**Evidence.** `ArenaScene.ts:750-757`, `779-848`, `861-925`, `1759-1806`; no `cull`/`inView` anywhere in these paths.
**Fix.** Camera-cull the animate/telegraph/combat-fx work (skip for entities outside a padded camera worldView). Precompute each telegraphing enemy's nearest-player target once (or read it off synced state) instead of an inner `players.forEach` per enemy. Combined with C3/C4 keeps per-frame cost proportional to what's on screen.
**Effort.** Medium.

#### M12 · Both god-objects re-grew to an identical 2,229 lines — extraction overdue
**Problem.** STRUCTURE_AUDIT recorded `GameRoom.ts` 2,124 and `ArenaScene.ts` 2,113 and deferred extraction post-M0. Both are now **exactly 2,229** — they grew ~100+ lines apiece, with the boss/rez features landing straight into the monoliths. ArenaScene: 118 private fields (15 entity/diff Maps) + many methods; GameRoom: 9 ad-hoc per-entity Maps. The audit's own 2,500-line auto-extraction threshold is about to trip, and the trend is upward. The pattern is proven (progression.ts, floor-renderer.ts, vfx.ts already extracted) — it just isn't applied to new feature work.
**Evidence.** `wc -l` = 2229/2229 (vs `STRUCTURE_AUDIT.md:234` 2124/2113); fields `ArenaScene.ts:115-208`; god-Maps `GameRoom.ts:206-274`.
**Fix.** Hard rule: new gameplay systems land in their own module from the start, never inlined. Do the deferred extraction now: pull a `BossController` (5 boss scalars + `stepBoss`/`fireBulletWall`/`bossSlam`/`spawnBossAdds`, ~150 LOC) and a `ShifterDirector` out of GameRoom; an `EntitySyncManager` (entity Maps + `sync*`/`interpolate*`/`animate*`, ~600 LOC) + `HudManager` out of ArenaScene. Each is mechanical (clean signatures already) and shrinks the AI-agent context/merge surface.
**Effort.** Large.

#### M13 · Transient per-entity Maps have inconsistent cleanup across onLeave / restartRun / toggleTraining
**Problem.** 9 transient Maps each rely on a different cleanup path, and three lifecycle paths are inconsistent: `onLeave` deletes only `inputs`+`combat` (a leaving player's `meleeSwings` entry lingers until a lazy prune); `restartRun` clears 4 Maps + `burnPulses` but **not** `meleeSwings`/`comboState`/`pickupGrace` (an in-flight swing carries into the fresh run; comboState for just-cleared enemies orphans); `toggleTraining` likewise omits `comboState`/`meleeSwings`/`pickupGrace`/`burnPulses`.
**Evidence.** `GameRoom.ts:761-771` (onLeave), `600-654` (restartRun), `546-559` (toggleTraining); lazy prunes `1198`/`1685`/`1379`/`1968`. _(Note: `pickupGrace` is keyed by pickup id and self-prunes — not a player-scoped onLeave concern.)_
**Fix.** A single private `clearTransients(opts)` that resets every non-synced collection, called from `restartRun`, `toggleTraining`, and (scoped to the leaving id) `onLeave` — so adding a new Map forces touching one place. Removes a class of cross-run ghost-state bugs that fresh-room integration tests won't catch.
**Effort.** Small.

#### M14 · The hand-numbered tick/frame ordering contract has no compile-time or test guard
**Problem.** `GameRoom.update()` sequences ~20 mutating phases by hand-numbered comments (1, 2, 2.4, …, 8); `ArenaScene.update()` chains 25 order-dependent calls (equipWeapons before syncEnemies; interpolate before animateBlobs; checkFalls after syncBlobs). Reordering compiles + lints fine and silently changes sim/visual behavior. The integration harness tests **outcomes**, so a phase reorder yielding a plausible end state passes.
**Evidence.** `GameRoom.ts:779-1070`; `ArenaScene.ts:748-775` (comment admits hidden order-dependency around the hit-stop freeze).
**Fix.** (a) Extract `update()`'s phases into named zero-arg private methods (stepMovementPhase, stepCollisionPhase, …) — the names document the contract and shrink each unit for testing. (b) Add one golden-snapshot test: seed RNG, join 1 player, drive a fixed 60-tick input script, assert a hash of final `ArenaState`. The `makeRoom`/`tick` harness already exists.
**Effort.** Medium.

#### M15 · Per-dimension hazards and themed environment content are flavour-only
**Problem.** §17 promises per-dimension hazards that "damage everything" (kiting into hazards = skill expression) + themed ground/POI sets. In practice every dimension shares the one Wild-West pitfall; `DimensionDef.hazard` is a name+description string with **no** gameplay wiring (`grep .hazard` → zero reads); themed tiles/POI remain P4. The 5 dimensions are a palette + roster swap over identical terrain rules.
**Evidence.** `dimensions.ts:35-36` ("flavour now; hazard wiring later"); only real hazard is the theme-agnostic pit system; spec §17 line 398-399.
**Fix.** Wire at least one distinct hazard per dimension off `DimensionDef.hazard`, reusing the existing `ZoneState`/`stepZones` radius-DoT primitive (e.g. Frostfell ice-slick zones, Ashlands lava pools reusing the zoner-puddle damage). Comparatively cheap; makes the chain feel like a journey, not a recolour.
**Effort.** Medium. _(Pairs with C1.)_

#### M16 · Augment/build variety is shallow and melee-only
**Problem.** Per-run identity rests almost entirely on a fixed 9-card parry pool with 6 picks/run (3-of-9 draft) — and only for the melee class. No ranged/caster signature trees (OPEN), no in-run character variants, no weapon level-up (by design). Combined with the flat 17-weapon arsenal and absent rarity, two runs play similarly. _(Tempered: attribute allocation IS a real per-run choice via the 5-button picker — the finding's "auto-defaults to STR" is only the timeout fallback — and which weapons an attr build can wield diverges too.)_
**Evidence.** `augments.ts:28-104` (9 augments), `117` (`AUG_DRAFT_SIZE=3`); spec §8/§12 mark ranged/caster trees `[OPEN]`.
**Fix.** For M0 replayability: expand the parry pool a few cards beyond 9 (so 6 picks meaningfully diverge) and/or add a between-dimension boon pick at dimension-clear (also gives the chain a per-step choice). Longer-term, the ranged/caster signature trees are the real unlock — schedule after the chain + loot spine land.
**Effort.** Medium.

#### M17 · Several authoritative tick subsystems are untested
**Problem.** The harness covers join/host, rez-or-dead, boss phases, swept melee, dimensions, shifters, lunge — but leaves untested: §17 pitfall (chip + snap-back + grace + fellSeq), enemy pit-death, continuous contact DPS + knockback, zoner puddle DoT (explicitly **UNPARRYABLE** — a rule worth pinning), the extraction win condition (`checkExtraction → victory`), gun ammo/reload cadence, friendly-projectile pierce/kill. Exactly where a regression silently changes feel or breaks a run-ending transition.
**Evidence.** `GameRoom.ts:830-855`, `1000-1004`, `1007-1029`, `1995-2018` (UNPARRYABLE comment `2006`), `2211-2228`, `911-922`, `1924-1954`; none asserted in `GameRoom.test.ts`.
**Fix.** Prioritize run-ending + rule-defining cases: pit fall takes `PIT_FALL_DAMAGE_FRAC` + snap-back (and an airborne player does **not** fall); a parry-knock over a pit edge → instant despawn, no XP; a living player in the portal flips `outcome` to `victory`; zoner puddle damages a player **with parry i-frames up** (proves unparryable); a gun empties then refills after `reloadSeconds`. ~10 lines each on the existing harness.
**Effort.** Medium.

#### M18 · Untrusted-input handlers are validated in code but not regression-tested
**Problem.** Handlers harden against hostile clients (finite coercion, aim unit-normalization, `debugSpawn` training-gate + kind-validate + count clamp, `chooseAugment` must be in the offered draft) but the **server-side enforcement** has no test. A future refactor could drop the `sigOffer` check or the training gate and nothing fails.
**Evidence.** `GameRoom.ts:329-331`, `343-354`, `503-510`, `529-530`, `519`; no handler-level test in `GameRoom.test.ts`.
**Fix.** Harness tests for the rejections: `debugSpawn` in arena mode spawns nothing; unknown/`dummy` kind spawns nothing; count clamps to `DEBUG_SPAWN_MAX`; `chooseAugment` with an id not in `sigOffer` leaves augments + sigPending intact; an attack with `{aimX:99,aimY:0}` leaves `c.aimX/Y` a unit vector (`hypot≈1`). Locks the anti-cheat surface §4 calls out.
**Effort.** Small.

#### M19 · Run goal + bank-vs-push loop under-communicated
**Problem.** The banner does say "survive until the boss, then extract" (good), but: no run timer or "boss in N:NN" indicator despite the boss being time-gated (elapsed exists only in the hidden debug readout); the portal just says "▼ EXTRACT" with no hint that stepping in **banks** salvage and **ends** the run; the bank concept appears only post-extraction. `state.elapsed` is already synced, so the data for a countdown exists.
**Evidence.** `ArenaScene.ts` updateDebug (elapsed dev-only), syncPortal (bare label), victoryText (post-hoc); `BOSS_SPAWN_SECONDS=120`.
**Fix.** Add a lightweight objective line / "boss approaches in ~M:SS" countdown from existing `elapsed`, and expand the portal label (e.g. "EXTRACT — bank salvage & end run"). Makes the §6 greed decision legible at the moment of choice.
**Effort.** Medium.

#### M20 · The menu teaches nothing beyond the dimension picker
**Problem.** MenuScene (first impression) is purely a picker: title, one-line subtitle, themed cards (name + tagline + 4-colour palette strip), "click to drift in." No explanation of what the game is, no controls preview, no class/difficulty hint. Players pick blind. Since §21's hub doesn't exist, the menu is the only pre-combat surface.
**Evidence.** `MenuScene.ts:55-83`, `87-138`; `DimensionDef` has no difficulty/enemyTheme field.
**Fix.** Add a compact "How to play" footer (WASD / RMB fire / LMB parry / goal: survive → boss → extract) and a one-word enemy-theme hint per card (boss/roster/hazard.name already exist to feed it). Keeps the blind-pick feel while giving a mental model.
**Effort.** Medium.

#### M21 · Damage-number + white-tell readability unscaled and unbudgeted
**Problem.** Two comprehension-critical layers are fixed world-pixel with no `uiScale()` and no on-screen budget. (1) Damage numbers spawn one-per-hit per enemy with no pooling/aggregation cap — at horde scale a wall of overlapping numbers that obscures the playfield, and they don't grow on 4K. (2) The white parry tell draws a fixed r=24 disc + ring per telegraphing enemy in world units; many simultaneous winds-up stack indistinguishably — and since "white = parryable" is the one universal learnable cue, illegibility breaks the core defensive read.
**Evidence.** `ArenaScene.ts:1761-1771` (one `spawnDamageNumber` per hp-drop, no cap); `917-920` (fixed r=24 + ring, no `uiScale`); `spawnDamageNumber` `vfx.ts:425-448` (hardcoded 16px).
**Fix.** Budget damage numbers (aggregate stacked hits on the same enemy, cap concurrent count, pool them) and scale both damage text and white-tell radii by `uiScale()`. Prioritize the white tell — it gates the core parry read.
**Effort.** Medium.

#### M22 · The weapon card carousel ignores uiScale() — tiny/clipping on 4K
**Problem.** Every other HUD element grows with `uiScale()` (clamped [1, 2.1]) but the §9/§20 carousel uses hardcoded geometry: `setScale(isSel ? 1.0 : 0.62)`, fixed `selY = screenH()-170`, fixed `arcR=700`. On a 4K panel the HP/boss bars + text go 2.1× while the arsenal cards stay 1× — proportionally tiny — and the fixed 170px bottom offset floats them above the screen edge relative to the enlarged HP bar. Defeats the §28 4K work.
**Evidence.** `ArenaScene.ts:2053-2067` (no `uiScale` factor); vs `applyHudScale` `337-353`.
**Fix.** Multiply the carousel's selected/unselected scale, `selY` offset, and `arcR` by `uiScale()` (or a gentler sqrt of it). Verify legible at 1× laptop and ~2× 4K.
**Effort.** Small.

#### M23 · Swipe-triage "reroll" flag is a write-only dead-end
**Problem.** The review UI's swipe pass writes `approved`/`reroll` to `flags.json` and docs sell "a later batch re-roll can target the rejects," but nothing ever reads the `reroll` flag to act on it (the only consumers badge the grid). The sole reroll path is the per-asset modal button (one id at a time). A phone session of 50 rejects produces 50 flags a human must re-open one by one.
**Evidence.** `tools/artkit/review/server.mjs:30-45` (flags only badge), `197-222` (reroll single-id); `flags.json` is `{}`; `orchestrate.mjs:41-42` already parses `--only=` as a comma set.
**Fix.** Add "Re-roll all flagged": a POST endpoint + toolbar button that iterates `flags.json` for `status==="reroll"` and enqueues each through the existing reroll runner (or one orchestrate run with `--only=<flagged ids>`), clearing each flag as its job completes. ~20 lines; turns the swipe pass into the couch backlog-clearer it advertises.
**Effort.** Small.

#### M24 · No single "bake one subject end-to-end" CLI; README is stale
**Problem.** Concept→in-game is a multi-command gauntlet (orchestrate → manual pick → chroma-key → harvest-install, which auto-slices + auto-packs). The full chain is automated **only** in `review/server.mjs install()`, unreachable headlessly. The README still documents the old 3-step orchestrate flow and flags the `#00ff00` chroma-key guard as "still TODO" though `chroma-key.mjs` exists (and the same README lists it as ✅ done elsewhere — self-contradictory).
**Evidence.** `tools/artkit/README.md:12,17-24`; chain only in `review/server.mjs:228-249`; `harvest-install.mjs` auto-slices (`69-79`) + auto-packs (`205`).
**Fix.** Add `bake.mjs --ids=<id>[,…]` (or npm script) running chroma-key → harvest-install for the ids, reusing the proven `install()` sequence; skip the cardart phase for non-card subjects. Update the README to the real flow and delete the stale TODO line. Cheapest iteration-speed win in the pipeline.
**Effort.** Small.

#### M25 · No sync guard that sprite parts ↔ VFX entries stay aligned
**Problem.** The two codegen scripts (`harvest-install` → SPRITES, `build-weapon-vfx` → WEAPON_VFX) run independently and the prior audit's recommended cross-check (sprite parts present ⟺ VFX entry present) was never built. A weapon arted-but-not-VFX'd (or VFX'd-but-not-sliced) loads partially: both runtime lookups are undefined-tolerant, so it fails **silently** in-game.
**Evidence.** `tests/data-consistency.test.ts` (no SPRITES/WEAPON_VFX ref); `STRUCTURE_AUDIT.md:196-199` (still open); `ArenaScene.ts:495` + `VfxPlayer.ts:122` (undefined-tolerant lookups).
**Fix.** A test importing SPRITES + WEAPON_VFX asserting every weapon-tagged sprite id has a VFX entry and every VFX entry has a sprite (or is intentionally engine-only). Fails the build on a half-installed weapon.
**Effort.** Small.

#### M26 · pack-atlas silently drops a missing part with no overflow/missing-frame guard
**Problem.** A manifest part whose PNG is missing on disk is silently skipped (`existsSync → continue`, no warn). After packing there's no assertion that packed-frame-count equals existing-part-count and no warning when multipack kicks in (>1 page). For a normal (non-`x2-`) subject a missing atlas frame resolves to a never-loaded texture key → invisible placeholder = "missing limb at play time." Latent today (322 frames fit one page) but reachable as content grows.
**Evidence.** `pack-atlas.mjs:38-46` (silent skip), `49-61` (fixed 4096, no overflow assert); `harvest-install.mjs:97` (weapon textures sized `displayLength*2`); fallback only boot-loads loose parts for `x2-` subjects (`ArenaScene.ts:228-236`).
**Fix.** After `packAsync`, assert packed frames == existing part PNGs and log/fail any manifest part with no source file; warn if >1 page (multipack). Converts a silent missing-limb-at-playtime into a build error. _(The cleanup regex already handles `-N` pages correctly — that part of the original finding was over-stated.)_
**Effort.** Small.

---

### LOW

#### L1 · schemaVersion handshake only warns — a mismatched client stays connected
**Problem.** On a server/client schema mismatch the handshake only sets a status string + `console.error`, then falls through to the normal loop. Colyseus decodes by field order, so a stale client keeps decoding every patch with corrupted offsets (the field comment warns "HP reads as aim") and keeps sending inputs the server applies. Recovery is left to the user noticing a status line. _(Only fires on a real deploy/dev-build skew, never normal play, and isn't remotely exploitable — hence low.)_
**Evidence.** `ArenaScene.ts:649-656` (log only, no `room.leave`, no guard flag, no renderer check).
**Fix.** On mismatch hard-stop: `this.room.leave(false)`, set a `blocked` flag that short-circuits `update()` + input senders, render a blocking reload overlay.
**Effort.** Small.

#### L2 · No server backpressure / message-rate validation
**Problem.** Handlers validate field **values** (good) but nothing rate-limits how **often** a client sends. `cycleWeapon`/`cycleCharacter`/`dropWeapon`/`grabWeapon`/`chooseAugment` mutate synced state on every message with no cooldown — a malicious/buggy client at 10p can spam these to thrash state and inflate the patch stream for all clients (compounding the no-AoI problem). _(Requires a modified client; delta-encoding bounds per-field cost — low.)_
**Evidence.** `GameRoom.ts:398-403`, `406-409`, `413-431`, `445-465`, `525-537`; no token bucket anywhere.
**Fix.** A lightweight per-client, per-message-type cooldown (ignore cycle/drop/grab faster than a few/sec) + a global inbound rate cap; drop/disconnect on sustained flooding.
**Effort.** Small.

#### L3 · aimDir is reactive — a held-but-not-firing teammate's gun lags up to a full cooldown
**Problem.** `player.aimDir` (the only synced aim signal others use to point a remote player's weapon/bullets) is written **only** inside the `attack` handler. A remote player aiming but on cooldown/reload shows a frozen barrel pointing at their last shot until they fire again. Cosmetic, but undercuts the WYSIWYG/co-op-readability pillar; the live aim already sits in `CombatState` every tick.
**Evidence.** `aimDir` sole writer `GameRoom.ts:356`; movement loop `786-798` + attack-resolution `883-940` never touch it.
**Fix.** In the per-player tick set `player.aimDir = Math.atan2(c.aimY, c.aimX)` from live CombatState (gate to >0.01-rad change to avoid redundant patches). One number/player/tick.
**Effort.** Small.

#### L4 · Initial DOWNED overlay default text contradicts the §6 rez-or-dead model
**Problem.** `buildHud` authors `deathText` as "DOWNED — respawning…" — stale vs the shipped rez-or-dead model (no respawn). `updateHud` always overwrites it with correct copy before showing it, so it never actually renders the wrong string — but the authored default is a misleading source of truth.
**Evidence.** `ArenaScene.ts:391-401` (stale default), overwritten at `1992-2005`; the claimed "flash before updateHud" path does not actually exist.
**Fix.** Initialize `deathText` to the correct rez-or-dead copy (or empty string, since `updateHud` always sets it when visible). One line.
**Effort.** Small.

#### L5 · No client-render testability seam
**Problem.** The client package has no tests and no test script. Pure client geometry that can desync from the server lives inline in Phaser scene files: `interpolate()`, the height→ground-shadow projection, the gun-muzzle/aim-angle rig mapping. `gunMuzzleReach` is the one good counter-example (pulled into shared + tested). _(Narrower than originally claimed: the shared sim IS broadly tested — 12 test files — and the chain-bolt VFX already calls the shared, tested `selectChainTargets`.)_
**Evidence.** `packages/client/package.json` (no test script); `SpriteRig.ts:419-436,524`; `ArenaScene.ts:1515-1527`.
**Fix.** Extract the pure client-side geometry that can desync (interpolation step, height→shadow offset) into testable shared/client-pure modules and unit-test them, mirroring `gunMuzzleReach`. 2-3 extractions convert the highest-risk render-vs-sim mismatches from "spot it live" to "fails the gate." Lower priority than the sim gaps.
**Effort.** Large.

#### L6 · manifest.ts is regex-parsed out of generated TS in two places
**Problem.** `manifest.ts`'s geometry is the source of truth, but both `harvest-install.mjs` and `pack-atlas.mjs` re-read it by string-matching `export const SPRITES = {…} as const satisfies` then regex-normalising TS→JSON (the generator emits valid JSON keys but Biome reformats the file to unquoted keys + trailing commas, so a bare `JSON.parse` genuinely fails). harvest-install's own comment notes a prior clobber bug; the fragile parse is duplicated. A future formatting change breaks both consumers, and the failure mode (dropped subjects) is silent-ish. _(Offline tooling, not runtime — low.)_
**Evidence.** `harvest-install.mjs:154-169`, `pack-atlas.mjs:26-31`.
**Fix.** Emit a sibling `manifest.json` from the same object (the `.ts` imports the `.json`, or both are written together). Tools read the `.json` directly — no regex parsing, no duplication, typed game surface preserved.
**Effort.** Medium.

#### L7 · VFX candidate count is hardcoded inconsistently across tools
**Problem.** `CANDIDATES` is read per-call-site with three values: orchestrate default 3, review-reroll hardcodes 5, weaponsmith default 4 (the 297 batch was rendered at 3). "Best of N" differs by which tool you used, with no single config documenting the intended budget. A source-of-truth smell in a determinism-focused pipeline. _(Live divergence is effectively 3-vs-5; weaponsmith's UI always posts 3.)_
**Evidence.** `orchestrate.mjs:37`, `review/server.mjs:207`, `weaponsmith/server.mjs:191`.
**Fix.** Centralise the per-phase candidate budget (small config or documented env convention: refs=3, reroll=5) and reference it instead of hardcoding divergent numbers.
**Effort.** Small.

---

### Strengths to preserve (verified genuine, not paper)

These are load-bearing and the AI agent should **not** regress them:
- **Strict type safety.** `tsconfig.base.json` has `strict` + `noUncheckedIndexedAccess` + `noImplicitOverride` + `noFallthroughCasesInSwitch`; a word-boundary grep for `: any`/`as any`/`@ts-ignore` over non-generated src returns **zero** hits (the one `any` in `GameRoom.test.ts` carries a justified biome-ignore).
- **The "hand-authored core ⊕ generated extras" merge pattern, applied uniformly.** `WEAPONS = {...BASE, ...EXPANSION}`, `DIMENSIONS` merges `EXTRA_DIMENSIONS`, `ENEMY_KINDS` merges `DIMENSION_ENEMY_KINDS`; all generated files carry AUTO-GENERATED/DO-NOT-EDIT banners.
- **The AUDIT-4 override fix.** `build-weapon-vfx.mjs` deep-merges `weapon-vfx-overrides.json` **after** generation (re-bake can never clobber), the override is data not a code comment, and a test asserts every override id is real.

**Keep the invariant:** never hand-edit `*.generated.ts` — edit the source or the `*-overrides.json`. Worth a one-line note in CLAUDE.md so the agent treats it as a hard rule.

---

## 3. Suggested roadmap

Ordered. Each batch is a coherent slice; do them roughly in sequence because later batches depend on earlier ones (the chain unlocks loot/depth; the perf grid unlocks the 10p test).

### Batch A — "Make it a game" (the meta-loop). _~1-2 weeks. Highest leverage._
The single biggest gap is that there's no run _structure_ beyond one dimension, and the progression curve makes its own augment system unreachable. Do these together — they reinforce.
1. **H1 — retune the XP curve** (small). Do this first; it's a constant change that immediately makes the augment loop real and de-risks everything else you tune.
2. **C1 — dimension-chain transitions** (large). The keystone. Carry squad/stats/arsenal/salvage; portal offers extract-vs-push; reserve `victory` for extraction.
3. **H6 — salvage bank-or-lose payload** (medium) + **H2 — depth-scaled difficulty** (medium). These give the chain stakes and escalation. Both gated behind C1.
4. **H11 — progression.ts tests** (small) + **M14 golden-snapshot tick test** (medium) to lock the loop you just built before piling on.

### Batch B — "Loot dopamine + content reachability." _~1-2 weeks._
The 297 weapons and the LUK attribute are inert without rarity; the active arsenal is 17.
1. **C5 — rarity + 1 affix + Gems** (large). The spine; unlocks LUK, cursed gamble, in-run variance.
2. **M3 — weapon power-budget estimator + gate test** (medium). Build _before_ promoting any expansion weapon.
3. **H7 — general drop-on-kill from a curated themed slice** (medium), promoting expansion weapons in waves.
4. **H16 (review tool) + M23 + M24** (art-pipeline, small each): unblock VFX curation, batch-reroll, and a one-command bake so you can actually feed the drop pool fast.
5. **H15 codegen drift gate + M25 sprite↔VFX sync test + H13 roster validation** (small each): the data integrity guards that keep all this content from silently rotting.

### Batch C — "Combat feel + readability." _~1 week. Cheap, high perceived-quality._
Mostly client-side, mostly small.
1. **H3 — hit-stop on contact + kills** (medium) — the biggest feel win.
2. **H9 — show RMB/LMB on screen** (small) + **H10 — parry feedback ring** (medium) + **M19 — run-goal/portal copy** (medium): a new player can finally learn the game.
3. **H4 — de-blur the contact archetypes** (medium) + **M1 — derived-lunge white cone** (small) + **M2 — ranged parry tell** (medium): threat legibility.
4. **M4 — parry chain risk ceiling** (medium), **M5 — scale difficulty on living players** (small), **M21/M22 — readability + carousel uiScale** (medium/small): balance + 4K polish.
5. **M16 — widen the augment pool / between-dimension boon** (medium): build variety, pairs with Batch A.
6. **M15 — per-dimension hazards** (medium): make the chain feel like a journey.

### Batch D — "10p readiness" (scale + netcode). _~2-3 weeks. Required before the load test; do not raise MAX_ENEMIES until this is done._
This is the expensive, gating batch. Order matters: grid → soft-sync/AoI → cap raise.
1. **H8 — spatial-hash broad-phase** (medium). Do first; unblocks all the O(n²)/full-scan paths at once and is reusable by everything below.
2. **C2 — SpriteGPULayer horde-render path** (large) + **M10 — object pooling** (large) + **M11 — camera-culling** (medium): the client side of horde scale.
3. **C3 — StateView AoI** + **C4 — Tier-2 soft-sync** (large, paired). The server side. Add the headless N-client bandwidth harness here.
4. **Only now: raise `MAX_ENEMIES`, scaled by player count**, and run the 10p load test.
5. **H5 — reconnection** (medium), **M6 — client prediction** (medium), **M7 — interpolation buffer/extrapolation** (medium), **M8 — moderation/lobby lock** (medium): the multiplayer-quality layer. **M9 — GC scratch buffers** (medium) folds in naturally while you're in the hot loops.
6. **L1/L2/L3 — schema hard-stop, rate-limit, continuous aimDir** (small each): netcode hardening cleanup.

### Batch E — "Maintainability + test depth." _Ongoing / interleave._
Not a blocker, but the god-objects are actively regrowing and the test gaps will bite during A-D.
1. **M12 — extract BossController / ShifterDirector / EntitySyncManager / HudManager** (large). Do the boss + entity-sync extractions _before_ Batch D piles boss-phase and horde-render code into the 2.2k-line monoliths. Adopt the hard rule: new systems land in their own module.
2. **M13 — `clearTransients()` helper** (small), **H14 — damageEnemy tests** (medium), **M17 — untested tick subsystems** (medium), **M18 — input-handler regression tests** (small), **H12 — purity/determinism gate** (small): close the test gaps as you touch each system in A-D.
3. **L4-L7** (small/medium): the low-value cleanups — fix opportunistically when you're already in the file.

**One-line sequencing:** A (loop + curve) → B (loot + content) → C (feel + onboarding) → D (scale + netcode, the gate to 10p) → E threaded throughout. A and C are cheap and transformative; do them before the expensive D.

---

## 4. Rejected / already-handled

The verification pass produced **no outright-rejected findings** — every CONFIRMED finding survived adversarial check against the code. But several were **down-graded** or had **evidence corrected**, which is worth recording for honesty:

- **XP-curve finding — severity lowered critical → high.** The loop _functions_; the fix is pure constant tuning, not architectural. (And the real situation is worse than the original framing: 120s boss gate + L1 reset per run = ~0-1 picks, not 2-3.)
- **MAX_ENEMIES cap — lowered critical → high**, and **client prediction — lowered high → medium**: both are acknowledged-deferred POC work flagged in code/spec, not undiscovered defects.
- **schemaVersion handshake — lowered medium → low**: only fires on a real deploy/dev-build skew, not remotely exploitable, and an actionable warning already exists.
- **Object pooling — lowered high → medium**: the "no pooling _anywhere_" claim was false — `VfxPlayer` already pools the hottest local effect (the authored swing suite). The server-driven horde churn is the real unpooled surface.
- **aimDir, DOWNED-overlay-text — confirmed but low**: the DOWNED finding's claimed "flash before updateHud" race **does not exist** (updateHud sets text + visibility in one synchronous pass) — it's dead authored copy, zero runtime impact.
- **Client-render testability — confirmed but narrowed**: the original "shared sim is untested / only GameRoom.test.ts exists" evidence was **wrong** — there are 12 shared-sim test files, and the chain-bolt VFX already runs the shared, tested `selectChainTargets`. The real gap is only the inline rig/interp geometry.

Minor evidence corrections that did **not** change a verdict (recorded so they aren't re-litigated): Brand multiplier is ×1.3 not ×1.5; `pickupGrace` is keyed by pickup id (so the onLeave-scoping suggestion is moot) and `pack-atlas`'s multipack cleanup regex is actually correct; the 297 concepts simply **lack** `rarity`/`affix` keys rather than defaulting them `false`; the active arsenal is **17**, not 16; attribute allocation is a real player choice (the "auto-STR" is only the timeout fallback); several cited line numbers have drifted ±1-3 lines post-commit. None of these affect the fixes above.
