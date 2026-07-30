---
name: ddv2-project-context
description: "DDv2 = Dimension Drifters, an online co-op bullet-heaven; user works on it across multiple computers"
metadata: 
  node_type: memory
  type: project
  originSessionId: a77d4384-de26-420e-a954-33923a9ca83d
---

`C:\Users\Exped\DDv2` = **Dimension Drifters**, an online co-op bullet-heaven (repo:
github.com/parastyle/Dimension-Drifters-EMD, remote `origin`, default branch `master`). The user
develops it from **multiple computers**, so committing/pushing keeps machines in sync — but confirm
before pushing (outward-facing).

Design bible: `DIMENSION_DRIFTERS_MASTER_SPEC.md` (single source of truth, §-numbered). Not wave-based
like Brotato — it's a dimension-chain roguelite (survive → boss at ~120s → extract or descend deeper),
with parry as the signature defensive skill and an 11-strong data-driven boss framework
(`packages/shared/src/bosses.ts` + `boss-primitives.ts`, run by `server/.../BossController.ts`). A new
boss = an `EnemyKind` body (size = `renderScale`) + a `BossDef` of telegraphed attack modules — pure
data. Dev boss picker (Tab menu) summons any `BOSS_DEF_IDS` entry via the `spawnBossDef` message.

Work-in-progress on branch `feat/v0.117-feel-and-colossus` (pushed to origin as of 2026-07-08).
- v0.117 feel pass: melee reach fix, projectile-parry (base = side-glance+fade "Superman"; bounce-back
  gated behind the new `deflector` augment), camera graceful follow (no look-ahead), movement de-hitch,
  GOROGOTH the colossus boss, boss juice. `docs/BROTATO_PARITY.md` (crit + set-bonuses recommended next).
- **v0.118 BEAT-'EM-UP CONVERSION — now REAL and in-game** (not a prototype). Belt-scroller lives INSIDE
  the real `ArenaScene` behind a `belt` flag (launch: `?belt=1` or the `C` key on the menu), keeping ALL
  systems (weapons/enemies/HP/bosses/augments/loot/co-op netcode). Sim stays flat 2D (x=belt, y=DEPTH,
  band `[BELT_Y0, BELT_Y0+DEPTH_MAX]`); perspective is CLIENT-ONLY (`beltY()` projection + `projectBelt()`
  post-pass). Plan/status in `docs/BEATEMUP_CONVERSION.md` (Stages 4/5/6 marked done). SHIPPED so far:
  - Authored level `SKY_CARRIER` in `shared/belt-map.ts` (per-x floor band + jumpable pits + rooms/gates +
    `shopX`); server room state machine (`beltLockX`/`beltRoomName` gates) in GameRoom.
  - **3-slot ARSENAL + bag + scrip** (SCHEMA v10): `PlayerState.slots[3]`/`activeSlot`/`bag`/`scrip`,
    `ArsenalSlot` schema. Belt grabs ACCUMULATE into empty slots → overflow to bag → drop only when full.
    Keys 1/2/3 + Q/E swap; Tab bag overlay; click-to-swap chips. Arena/training keep the old carousel
    (gated on `this.belt`). Messages: swapSlot/cycleSlot/bagStore/bagEquip/sellWeapon.
  - **Shopkeeper** at `beltShopX` (2050): world NPC + `F: TRADE` sell-for-scrip overlay, proximity-gated,
    earned-only (`scripValue`). Belt loot drops clamp to the deck (`placePickupPos`).
  - **Depth-tolerant lane combat** (SoR4): belt melee = forward reach + `|Δy|≤DEPTH_TOL_PLAYER`; enemy
    contact tight (`DEPTH_TOL_ENEMY`); moving-in-depth shrinks hurtbox (`DEPTH_DODGE_MULT`).
  - Feel: fixed-size weapons (drop `characterScale` from reach), Madness-Combat limb inertia, drifting
    parallax cloud band (procedural), belt boss-telegraph projection.
  - **§30 Brotato-parity trio (v0.118, done):** CRIT (`critChanceFor` LUK/DEX, ×2, gold `N!` numbers +
    hit-stop, synced `EnemyState.critFlash`), weapon-class SET-BONUSES (`weaponSetBonus` off `tags.classPool`,
    +8%/+18% at 2/3-of-a-class, HUD `⚔ SET +N%`), and HARVEST (LUK-scaled banked-salvage premium at
    extraction). Deferred parity: pickup-magnet + wave/shop/economy redesign (need a design chat).
  - **§32/§33 (v0.118, done):** EVERY enemy now wields + drops one of our weapons (post-merge pass in
    enemies.ts assigns a signature weapon by archetype — blade/gun — hashed off the kind id; drop 0.22;
    handless blobs skip the render but still drop). New COLOSSUS boss VASTAGHAR "the World-Tread"
    (`world-titan`, renderScale 13 → only lower body on screen): a `footfallQuake` primitive drops a ground
    shockwave each footstep you JUMP over (airborne-immune) or PARRY (white kindTag-7 cue → `applyBossQuake`);
    it's the belt Bridge finale + summonable via the dev picker. Verified live (rigScale 13, quake telegraph
    fires, no errors).
  - **§31 spend-sink + polish (v0.118, done):** META-PROGRESSION spend sink — `shared/meta.ts` catalog
    (Vitality/Fortune/Power, 3 levels, escalating scrip cost), `PlayerState.upVitality/upFortune/upPower`
    (SCHEMA v12), `buyUpgrade` at the shopkeeper (server-authoritative, proximity-gated), persisted in
    localStorage `dd.beltUpgrades` + restored via join options + applied to starting stats. Shop overlay has
    a BUY band. Scrip persists across runs (`dd.beltScrip`) + LUK-scaled HARVEST premium at extraction.
    Per-room Codex BACKDROPS (Catwalk + Arena Mouth, `public/belt/sky-*.png`, wired to the room-swap).
    Procedural deck PLATING detail (seams/joints — real texture still blocked). Crit% shown in HUD.
  - **§34–§36 (v0.118, done — 2026-07-11 overnight session):**
    - §34 AIM FIX (user's #1 bug "attacks don't flow to the cursor"): belt aim mixed a projected cursor with
      a world self-y. Now `selfAim` = pure SCREEN direction `(wp.x-self.x, wp.y-beltY(self.y))` (rig+VFX point
      at the cursor); the send path un-projects ONCE (`saY/=BELT_FORESHORTEN`, renormalize) so the server gets
      the true world char→cursor direction. VERIFIED BY DERIVATION: `saY/F == cwy-self.y_world` exactly.
    - §35 element VFX: melee swings of un-authored expansion weapons use an ELEMENT-tinted fallback suite
      (`VfxPlayer.ELEMENT_SUITES`); gun bullets/muzzle tint by element via `"<kind>:<element>"` bulletKind
      suffix parsed in `projectile-factory.gunFx`/`baseKind`.
    - §35 UI borders: 6 Codex-rendered panel frames (gilded/techhud/bonegothic/minimal/arcane/grungesteel)
      keyed → `packages/client/public/ui/border-*.png`; chooser artifact `tools/artkit/build-border-chooser.mjs`
      → `out/border-chooser.html` (published). NOT yet wired to live panels — waiting on the user's pick.
    - §36 BOSS VARIETY: each dimension's themed finale boss used to fall back to CLASSIC_BOSS (all 5 levels =
      same fight). `bosses.ts` `DIMENSION_BOSS_DEFS` now maps each onto a distinct EXISTING tested fight
      (old-rust→Quickdraw, the-hollow-king→Nihil, moss-stone-golem→Grull, molten-brute→Ver'Kaln,
      warden-mech→Metronome) — art/name/HP still key on the KIND, only mechanics change. Regression test in
      BossController.test.ts. Also: 4 belt LEVELS now (sky-carrier/frost-chasm/verdant-ruin/neon-undergrid),
      each its own dimension+roster+palette+boss; server was hardcoding sky-carrier (fixed).
    - §36 GAME-FEEL (from a Phaser/2D-sword-VFX research pass): `spawnHitSpark` (directional steel-sliver fan
      along the blow vector on EVERY hit, element-tinted for the local player, gold on crit) + `spawnSpeedLines`
      (converging "focus" streaks, big/crit only). Punch-zoom deliberately SKIPPED: `cam.zoom` feeds the aim
      projection + audio pan, so a transient zoom would re-introduce aim drift.
    - §36 BELT-SAFETY (found while de-risking the boss remap — arena bosses now run belt finales): the boss
      sink's `moveBoss` AND `spawnBossAddAt` set y unclamped (map-based), so a blink/charge boss or its summoned
      adds could leave the deck depth band / float over a pit in belt. Both now clamp x→level length + y→
      `clampBeltFloorY` in belt (arena unchanged). Smoke test spawns all 5 dimension bosses + ticks 60 belt
      frames with no throw.
    - §36 5th BELT LEVEL: there were 5 dimensions but only 4 belt levels — added `ASHLAND_FORGE` (ashlands
      dimension, volcanic, roster cinder-imp/ember-mote/slag-crawler/ember-spitter/magma-duelist, boss
      molten-brute→Ver'Kaln) in belt-map.ts so all 5 dimensions are reachable. Menu is dynamic (BELT_LEVEL_IDS
      → cards + number keys, `layout()` reflows the grid), so no menu change needed. LIVE-VERIFIED: loads
      dimensionId "ashlands", spawns the volcanic roster, shopX 1880. Guard test: every belt level resolves to
      a real dimension + a registered finale boss.
    - VERIFICATION: `pnpm -r build` (full production tsc + vite) is the definitive gate — it caught a
      strict-mode test error vitest + scoped `--noEmit` missed.
  - **§37–§38 (v0.118, done — 2026-07-13):**
    - §38 CLASSES (user approved P0+P1 from the design audit): `shared/character-classes.ts` buckets the 40
      skins into 5 archetypes (Bruiser/Duelist/Caster/Warden/Scoundrel) driving per-level auto-growth
      (progression.ts reads the WORN character); new `cast` WeaponDef delivery (piercing arcane orb, no ammo,
      INT-scaled; 2 staff weapons in the pool; client renders "orb" bullet kind); signature drafts are
      weapon-gated (gun: hollowpoints/ricochet-rounds · cast: overcharge/arc-split; parry pool stays universal).
    - §37 AIM: projectiles now aim from the AUTHORITATIVE body at the cursor WORLD POINT (aimDir() in
      GameRoom; rig-derived vectors skewed while moving). DPR ROOT-CAUSE: the DOM pointer listener stored CSS
      px but the hi-DPI buffer is window×RENDER_DPR — scale by (scale.width/rect.width) or every cursor point
      lands short on scaled displays. Facing flips on RAW px offset from the midpoint (±6px), not normalized aim.
    - §37 UI: user picked CLEAN MINIMAL border — drawn PROCEDURALLY (drawPanelFrame in ArenaScene: double line,
      cyan corner ticks, top hairline) on bag/shop/level-up panels (the rendered border PNGs are opaque; ornate
      styles would need alpha re-key + 9-slice).
    - §37 STAGE ART + DEPTH: `tools/artkit/gen-belt-backdrops.mjs` (gen-tiles pattern, concurrent codex) painted
      1672×941 vistas for all 4 themed levels → `public/belt/bg-<level>.png`, preloaded under PER-LEVEL keys
      (`belt-bg:<id>` — a shared key showed the previous level's art after a swap) and gated the sky-carrier
      per-room texture swap. DEPTH_MAX 870→1300 (+50%), TOL 90/57, BELT_VIEW_H 1060, all floor margins ×1.5.
    - Codex CLI CODE audits on Windows need `--dangerously-bypass-approvals-and-sandbox` (the sandbox can't
      spawn reads: "windows sandbox: spawn setup refresh"). Audit reports in the session scratchpad; safe-tier
      perf fixes (bundle split, alloc cleanups, teleportSeq reset) still TODO pending user approval.
    - ~23 commits ahead of origin, all LOCAL (user has not yet said push).
  - **DESIGN PIVOT (2026-07-14, user ruling):** the user prefers the ORIGINAL TOP-DOWN arena maps and wants to
    "continue with them from now on" — the belt-scroller/TMNT perspective "was too hard to pull off." Belt mode
    stays in the codebase (don't rip it out) but TOP-DOWN is the primary mode for new work. Watch for lingering
    belt-first assumptions (menu leads with belt levels; polish/testing habits target belt).
  - **§39 (2026-07-14): DEV PORTAL** — `tools/portal/gen-portal.mjs` → `tools/portal/index.html` (serve via the
    `portal` launch entry, localhost:5300): catalogs all bosses/weapons/characters/levels with one-click
    `?dev=boss:<kind>|weapon:<id>|char:<id>` deep-links into a fresh SOLO training room (client.create, never
    joinOrCreate — non-host dev messages were silently dropped) + per-asset change-proposal notes. Server:
    training-only `devEquip` message; `filterBy(belt,beltLevel,dimensionId,bossRush)` on the room so a level
    pick can never join a mismatched live room (was a black-screen cause). THE big black-screen root cause:
    update() ran in the window between room-resolve and the FIRST state patch (state.players undefined → threw
    every frame → permanent black; only reproduced on real machines, never in the fast preview) — guarded now.
    DPR follow-up: top-down cursor math (`px + cam.scrollX`) was only valid pre-§37; both aim sites now use
    cam.getWorldPoint (exact at any zoom/DPR).
  392 tests pass; headless preview screenshots time out (rAF throttled) — verify via `preview_eval` on
  `globalThis.ddGame` (menu C-launch is flaky; retry the keydown emit). DANGER: running `pnpm --filter
  @dd/shared build` while the dev server's tsc-watch is live races `shared/dist` → vite serves a stale
  module graph (e.g. "no export coneAngles") + reload-thrash; fix = restart the preview server. TODO
  (need direction / bigger): cheat-resistant scrip/upgrade persistence needs a server ACCOUNT store (today
  client-supplied + clamped — self-harm only); deck-plating TEXTURE (Phaser-4 GeometryMask2 won't bind to a
  TileSprite); ¾-view belt CHARACTER/ENEMY art (rig uses sliced parts — big); broader belt VFX projection.

Local env gotcha: [[ddv2-local-lint-crlf]].
