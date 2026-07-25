# Audit — Missing Design & Production Best Practice

> Read-only sweep, 2026-07-25, branch `feat/v0.118-metagame`. Lens: **game design + production**, compared
> against shipped genre peers (Brotato, Vampire Survivors, Hades, Risk of Rain 2, Deep Rock Galactic,
> Vermintide). A parallel auditor covers engineering internals — this report deliberately skips
> performance/pooling, persistence corruption, CI, error handling, reconnection, memory leaks and test
> coverage, and also skips netcode feel, movement/animation architecture and file structure (all already
> in flight).
>
> Every finding below was verified against the code on this branch. Where an older audit
> (`docs/POLISH_AUDIT.md`, `docs/IMPROVEMENT_AUDIT.md`, `docs/GAMEFEEL_AUDIT.md`) already named an item,
> it is marked **[known]** and the point being made is about *why it is still open*, not the discovery.

---

## 1. Ranked findings

| # | Finding | Area | Sev | Effort | One-line fix |
|---|---|---|---|---|---|
| 1 | Augments and 19-of-20 ultimates are orphaned — B20 deleted their only acquisition lane and never replaced it | Progression | **Critical** | M | Grant augments from chests/relics; roll `ultFamily` from character instead of hardcoding Sunspite |
| 2 | Every accessibility/feedback setting is implemented and consumed but has **no UI** | Accessibility | **Critical** | S | One options panel in `MenuScene` writing `updateSettings` |
| 3 | Co-op scales enemy **HP**, never enemy **count** — 4 players fight the same 80 enemies at ×2.8 HP | Co-op | **High** | M | Add a player-count term to `spawnInterval` + `MAX_ENEMIES`; cut `ENEMY_HP_PER_PLAYER` |
| 4 | Rez-or-dead is gated behind exactly one weapon in a 338-weapon catalog | Co-op | **High** | M | Add a universal hold-to-revive interact; keep the Spade as the fast/ranged option |
| 5 | Weapon identity is invisible — 338 weapons, no behaviour text anywhere in the client | Content legibility | **High** | M | Render `WeaponDef.description` + a derived behaviour line on the card and pickup |
| 6 | No pause of any kind, in a co-op game whose spec `[LOCKED]` a consensus pause | Polish | **High** | M | Server `pauseVote` message + a client pause overlay |
| 7 | Design canon has diverged from the build: spec 19 days / 534 commits stale, `[LOCKED]` sections describe deleted systems | Production | **High** | M | One reconciliation pass; make the §25 write-back part of the merge gate |
| 8 | Onboarding teaches the wrong verbs: one 18-line modal + 5 hints that all cover tier-2 mechanics | Onboarding | **High** | M | Retarget the hint budget at parry/fire/pickup; split the legend into pages |
| 9 | Relics have no description — the HUD shows 2-character codes | Content legibility | **High** | S | Add `desc` to relic defs; show it on pickup and on hover |
| 10 | No teammate awareness layer at all: no names, no colours, no squad HP, no off-screen marker, no ping | Co-op | **High** | M | Player colour + name, squad HP strip, off-screen chevrons |
| 11 | The greed loop has no money stake — a wipe banks 100% of run money, identical to a win | Progression | Medium | S | Bank a fraction on defeat, or bank only at the extraction terminal |
| 12 | The player has no depth privilege — a 1.7× elite standing below you draws over you | Readability | Medium | S | Self-rig outline + a small depth bias for the local player |
| 13 | No music; 5 ambient beds ship in `public/` and the manifest but are never played | Audio | Medium | M | Wire the ambient beds per dimension; add a run-loop bed |
| 14 | No run summary — death and victory are a single word-wrapped `Text` blob | Polish | Medium | M | A real end card: time, floors, kills, money, weapons, per-player |
| 15 | Six Wild-West enemies (incl. a boss) share the `boothill` sprite, separated only by scale and glow | Readability | Medium | M | Silhouette-differentiate the shared roster, or retire duplicates |
| 16 | Kills pay nothing; `moneyValue` and `TOUGH_MONEY_MULT` are dead data across the whole catalog | Progression | Medium | S | Either wire kill money or delete the fields |
| 17 | Booster-pack tail pays you to open it — refund applies after price, so the last band is free-or-profitable | Economy | Medium | S | Cap `refundTotal` at `price - 1`, or refund at pull-cost not pack-multiplier |
| 18 | Join-in-progress is wide open and uncushioned, contradicting spec §22; `MAX_PLAYERS = 10` contradicts the 2–4 framing | Co-op | Medium | M | Decide the model; catch-up kit + spawn-with-squad if JIP stays |
| 19 | Zero telemetry — 338 weapons and no way to know which are used, broken, or dominant | Content health | Medium | M | Emit a per-run event blob (weapons held, time held, damage share, deaths) |
| 20 | No keybind remapping and no gamepad, against a spec that promises both | Accessibility | Medium | L | A binding indirection layer + Phaser gamepad plugin |
| 21 | Endless tower runs on 3 authored floors × 3 crops, 5 dimension-boss mappings, 1 shared ultimate | Content variety | Medium | L | More floors/variants; map the remaining 8 boss defs to floors |
| 22 | No difficulty options and no assist toggles | Accessibility | Low | M | A run-modifier row on the destinations tab |
| 23 | The unlock economy is entirely client-owned (`MenuScene` → `localStorage`) | Production | Low | M | Move `openBoosterPack` behind a server call when accounts land |

---

## 2. Findings in detail

### 1. Augments and ultimates are orphaned — Critical

The B20 teardown (`docs/sol-reports/design-lock-b20.md`, rule 1) deleted levels, XP and stats. Two shipped
build-depth systems used level-ups as their *only* acquisition lane, and B20's dispositions table said they
would be re-homed ("Stat-frequency ultimate unlocks (#50) → Ultimates become rare relic grants"). That never
happened, and both systems are now dead in the shipped build:

- **Augments.** `packages/shared/src/augments.ts` holds 16 augment defs with real tuning
  (`BRAND_DAMAGE_MULT = 1.3`, `AUG_CAST_SPLIT_MAX = 3`, …) and `desc` strings written for a card UI. The
  server *reads* them in ~10 combat paths (`packages/server/src/rooms/room/room-combat.ts:2652, 4042, 4044,
  4202, 4217, 5473`; `room-enemies.ts:1124, 2626`). The only *write* in the entire server is
  `packages/server/src/rooms/room/room-progression.ts:2826` — `player.augments = "";` — with the comment
  *"Augments remain an empty hook until a non-level acquisition lane owns them."* Every `countAugment` call
  in the game returns 0, forever.
- **Ultimates.** `packages/shared/src/combat.ts:146-171` authors a 5-family × 4-variant grid (20 cells:
  Seismarch, AlphaStrike, SunspiteComet, EventHorizon, DimensionDoor), and the server implements at least
  four of the families (`room-combat.ts:722, 942, 1046, 1153`; `room-progression.ts:3480, 3678, 4235`; the
  `ULT_SEISMARCH_*`, `ULT_PHASE_BRAND_*`, `ULT_DOOR_*` constants). Both assignment sites hardcode one cell:
  `room-progression.ts:2828-2830` and `:3028-3030` — *"B20 interim: every identity uses the same flat,
  damage-meter Sunspite ultimate."* Every player, every character, every run gets the same ultimate.

**Why this is the top finding.** With levels gone, in-run build variety is now *only* the weapons you find
plus 15 relics (9 of which are flat additive stat lines). That is the thinnest build layer in the genre by a
wide margin — Brotato has ~200 items, RoR2 ~110, Hades ~300 boons. Two systems that would have fixed it are
already built and are sitting at zero. Meanwhile the verb legend still advertises the dead lane to players:
`packages/client/src/ui/verb-legend.ts:132` reads `"[F] Ultimate · Unlock through stat picks"`, and stat
picks no longer exist.

**Minimal fix.** (a) Add `augment` as a rare-relic-band chest reward in `packages/shared/src/chests.ts`
`rollChestReward` — the draft/gating helpers (`draftAugments`, `augmentGateForWeapon`) already exist and are
pure. (b) Replace the two hardcoded `ultimateCodeFor(UltimateFamily.SunspiteComet, "str")` calls with a
lookup keyed on `player.character` (or on the first rare relic drawn). Both are small diffs against existing,
tested machinery.

---

### 2. Every accessibility setting exists but has no UI — Critical

`packages/client/src/settings.ts` defines a complete, sanitised, persisted settings model
(`localStorage["dd.settings.v1"]`):

| Setting | Values | Consumed at |
|---|---|---|
| `damageNumbers` | all / own / off | `ui/damage-numbers.ts:185-193` |
| `damageNumberStyle` | detailed / aggregate | same |
| `damageNumberScale` | 0.8 – 1.4 | same |
| `hitConfirmAudio` | bool | `ArenaScene.ts:2491` |
| `confirmVolume` | 0 – 1.5 | `AudioBus.ts:593` |
| `hitSparks` | bool | vfx |
| `screenShake` | 0 / 0.5 / 1 | `ArenaScene.ts:11074` (inside `shakeCam`) |
| `hitStop` | bool | `ArenaScene.ts:11027` |
| `flashes` | full / reduced | 12 sites, e.g. `ArenaScene.ts:2412, 3597, 6813` |
| `colorblindAssist` | off / shapes | `vfx/colorblind-assist.ts`, `ArenaScene.ts:5734, 5995, 6375, 7277` |
| `renderScale` | auto / native / performance | `main.ts:77-81` → `render-dpr.ts` |

All eleven are genuinely wired. But the only `updateSettings(...)` call sites in the whole client are
`audio/AudioBus.ts:239` (confirm volume) and `ArenaScene.ts:2467` (the onboarding-seen flag). **No screen
writes any of them.** `MenuScene.ts` does not import `settings.ts` at all; its only settings UI is a
three-button audio row (`MenuScene.ts:3560-3608`: volume −/+/mute). The in-arena equivalent is `M` for mute.

So a photosensitive player cannot reduce flashes, a colourblind player cannot turn on shape assists, a player
who gets motion sick cannot turn off shake or hit-stop, and a player who cannot read the damage numbers cannot
scale them — unless they hand-edit localStorage. The work is done; the door is missing. This is the single
cheapest high-value item in the report.

**Minimal fix.** One `OPTIONS` tab in `MenuScene` (the tab row already exists at `MenuScene.ts:1224`) plus a
`[Esc]`-reachable copy in-arena, both writing through the existing `updateSettings` patch API. No new model,
no persistence work, no server work.

---

### 3. Co-op scales HP, not pressure — High

```
enemyHpScale(n)   = 1 + 0.6 * (n - 1)          enemies.ts:1421   ENEMY_HP_PER_PLAYER = 0.6
toughChance(...)  = ... + 0.08 * (n - 1) ...   enemies.ts:1409   TOUGH_CHANCE_PER_PLAYER = 0.08
spawnInterval(elapsed, depth)                   enemies.ts:1440   -- no player-count term
MAX_ENEMIES = 80                                constants.ts:377  -- flat
```

`runSpawnDirector` (`packages/server/src/rooms/room/room-enemies.ts:2995-3006`) takes no player count and
enforces the flat 80 cap. `constants.ts:592-596` states the intent explicitly: *"difficulty scaling by PLAYER
COUNT (not by multiplying the horde)."*

At four players that means: the same ≤80 bodies on screen, each with **×2.8 HP**, arriving at the **same
rate**. Per-capita there are 20 enemies instead of 80 — a quarter of the targets, each taking nearly three
times as long to kill. This is the classic co-op bullet-sponge failure mode: the fantasy of a bullet-heaven is
*more things to shoot*, and adding players currently removes them. Genre peers all go the other way — RoR2
scales the director credit budget by player count, Deep Rock scales swarm size and composition, Vermintide
scales horde size — precisely because sponge scaling makes weapons feel worse the more friends you bring.

There is a good design instinct buried in here worth keeping: the trash horde scales on `livingCount()`
(`room-enemies.ts:3090`, "rez-or-dead spiral fix") while bosses scale on `players.size` so a capstone does not
soften when allies go down. That asymmetry is correct — it is only the *axis* that is wrong.

**Minimal fix.** Add a player-count divisor to `spawnInterval` and a player-count term to the cap
(`MAX_ENEMIES_BASE + MAX_ENEMIES_PER_PLAYER * (n-1)`), then drop `ENEMY_HP_PER_PLAYER` to ~0.15–0.25 so
individual TTK stays roughly flat. Both functions are pure and unit-tested, so this is a tuning change with a
test update, not a rewrite. *(Note: the cap raise is coupled to the perf work the engineering auditor owns —
land the formula first, raise the cap when the budget allows.)*

---

### 4. Rez-or-dead is gated behind one weapon — High

`packages/shared/src/state.ts:123-125` documents the model: 0 HP → `alive = false`, body persists, **no
auto-respawn, no timer**. Recovery paths are exactly two:

1. An ally swings a weapon with a `rez` block within `REZ_RADIUS = 96` px
   (`room-combat.ts:2166, 2169-2203`). `rez:` appears **once** in the entire 338-weapon catalog —
   `packages/shared/src/weapons.ts:1605`, the Gravedigger's Spade.
2. The `revive` rare relic ("Second Wind"), one use per run (`relics.ts:262-271`,
   `room-progression.ts:4455-4469`).

`RESPAWN_SECONDS = 3` still sits in `constants.ts:386` and `CombatState.respawn` is still declared, but it is
initialised to 0 and never counted down — vestigial.

The downed experience is a spectate camera (`ArenaScene.ts:8976-9024`) and a line of text that names the
solution by weapon: *"A squadmate with Gravedigger's Spade can revive you."* (`ArenaScene.ts:12226`). A rift
descent explicitly carries downed bodies through still down (`room-progression.ts:4870-4871`).

So the realistic four-player failure case is: nobody rolled the Spade, one player goes down at floor 3, and
they spectate for the rest of the run with no agency and no path back. Every co-op peer avoids this — Deep
Rock, Vermintide, Payday and RoR2 all have a *universal* revive interaction; item-gated revives are a bonus
tier on top, never the only tier. The `rez`-carrier design is a good idea; it is being asked to carry the
whole floor.

**Minimal fix.** Add a hold-to-revive interact on `E` over a downed ally (the `E` interact channel and the
hold-progress pattern from disassembly already exist), at a longer channel and lower return HP than the
Spade. The Spade keeps its identity as the *fast, ranged, mid-combat* rez.

---

### 5. Weapon identity is invisible — High

`WeaponDef` declares `description?: string` (`packages/shared/src/weapons.ts:709-710`), 101 of the 337
generated weapons carry one, and its **only reader is the authoring tool** (`tools/weaponsmith/server.mjs:562`).
Grep for `.description` across `packages/client/src` returns zero non-test hits.

What a player actually sees before committing to a weapon:

- **In-world pickup / card** (`packages/client/src/scenes/arena/card-art.ts:585-591`): name, rarity tint, and a
  subtitle of `grip · family · element` — e.g. *"1H · Saber · Physical"*. Plus a live `base + bonus = total`
  damage equation and a charges/durability readout.
- **Armory / carry view** (`packages/client/src/ui/armory/model.ts:275-301`): name, rarity·affix, physical
  size, at-risk value, class/family/delivery, provenance. **No damage, no cooldown, no range, no DPS.**

So the difference between *Coyote's Grin* and *Sandsong Saber* — one of which might ricochet, chain, overheat,
or fire a five-pellet cone — is communicated by a family noun and an element noun. The `WeaponDef` schema has
~80 optional behaviour blocks (`gun`, `beam`, `cast`, `thrown`, `quake`, `scatter`, `chainLightning`,
`groundZone`, `hybridProjectile`, `warp`, `rapidThrust`, `hitStatus`…) and none of them surface as text.

This is the highest-leverage *content* finding, because it is what makes a 338-weapon catalog feel like 338
weapons rather than 338 skins. Brotato, RoR2 and Hades all lead with a one-line behaviour string on every item;
none of them ask the player to infer mechanics from a family name.

**Minimal fix.** (a) Render `description` on the card when present. (b) Where it is absent, derive a one-line
behaviour string from the blocks that exist — a pure function in shared, e.g. `"Fires 5 pellets · pierces 2 ·
bounces off walls"` from `gun.pellets/pierce/bounces`. That is deterministic, testable, needs no authoring
pass, and covers all 338 immediately. (c) Add damage/cooldown/range to the armory row.

---

### 6. No pause — High

There is no pause key, no pause menu, no server pause message. The server's full message surface is:

```
bagEquip bagStore beginDisassembleFloor cancelDisassembleFloor cycleCharacter cycleSlot cycleWeapon
debugArm* devEquip disassembleBagWeapon disassembleFloorWeapon dropWeapon galleryPage grabWeapon jump
openChest ownerNote parry restart spawnBoss spawnBossDef swapSlot toggleTraining useElevator
```

The only `scene.pause()` in the arena is `ArenaScene.ts:2783`, and it fires only on the *post-run* branch of
the top-right button, opening the Wardrobe over a finished run. Modal surfaces (verb legend, backpack, summon
menu, owner-note bubble) block *input* but the simulation keeps running underneath — see
`verb-legend.ts:363 isModalBlocking()` consumed at `ArenaScene.ts:4562-4566`.

Two consequences. First, a solo player literally cannot stop the game — no bathroom break, no doorbell,
nothing. Every shipped roguelite has this, including the ones with no menu at all. Second, the verb legend
that pops on first run (finding 8) opens *over a live arena* with enemies spawning behind it.

The master spec already ruled on this twice — §12 and §20, both `[LOCKED]`: *"Pause exists but is
consensus-based: it only pauses once every player confirms (no unilateral pause in online co-op)."* It was
simply never built.

**Minimal fix.** Solo (`players.size === 1`) → immediate `Esc` pause that halts the tick. Multiplayer → a
`pauseVote` message and a HUD strip showing who has confirmed, exactly as specced. Ship the solo half first;
it is most of the value.

---

### 7. Design canon has diverged from the build — High

The master spec opens with its own protocol:

> *"If code and this doc disagree, that's a bug in one of them — reconcile immediately."*
> *"Update protocol: bump version + date on every edit; record reversals in §25."*

Current state:

- `DIMENSION_DRIFTERS_MASTER_SPEC.md` header: **"Doc version: v0.117 · Last updated: 2026-07-06."** The branch
  is `feat/v0.118-metagame`, today is 2026-07-25, and `git rev-list --count master..HEAD` is **534 commits**.
  The §25 decision log's newest entry is 2026-07-06.
- **§11 Stats & Attributes `[LOCKED]`** and **§12 Leveling `[LOCKED]`** describe in detail a five-attribute,
  30-level, 3-points-per-level system with signature nodes every 5 levels. All of it was deleted by B20 on
  2026-07-23. `packages/shared/src/leveling.ts` now opens with *"There is no numeric player-stat or level
  progression state."*
- **§13** specifies "Gems" as the currency; the game uses `scrip`/money. **§21** specifies a Wizard-of-Legend
  hub with pack opening and shoot-back training dummies; the game has a Phaser menu with tabs. **§22** says
  *"no mid-run drop-in"*; join-in-progress is wide open (finding 18). **§20** promises a rebind layer and
  controller binds; neither exists (finding 20).
- `docs/sol-reports/design-lock-b20.md` rule 5 is *"LOCKED — No shopkeeper"* and rule 10 is *"LOCKED — No
  weapon stashing between runs."* The build now has a belt Trading Post (`docs/input-map.md:72, 99-101`) and a
  144-capacity weapon stash (`packages/shared/src/bank.ts:7-11`). Those may well be correct later decisions —
  but nothing in the repo records the reversal, so the lock doc now reads as canon while contradicting the
  shipped game.
- `BACKLOG.md` header: **"Updated: 2026-06-15 · matches master spec v0.52."** It still lists as open work
  items that shipped six weeks ago and describes a stat/leveling design that no longer exists.

This matters more than it looks for an agent-driven codebase. Every Sol, every subagent, and every future
audit reads these files as ground truth. A `[LOCKED]` section describing a deleted system is not neutral
staleness — it is an active instruction to re-implement the wrong thing. (This report itself had to reconcile
four contradictory sources before it could start.)

**Minimal fix.** One reconciliation pass: mark §11/§12/§13/§21/§22 as superseded with a pointer to the B20
lock and the beat-em-up conversion; append the missing §25 entries for B20 through B52 (the night summaries
already contain the material); retire or re-date `BACKLOG.md`. Then make "spec §25 entry written" a line item
on the merge gate the way "tests green" already is.

---

### 8. Onboarding teaches the wrong verbs — High

The onboarding surface is better than "nothing" and worse than it looks. `packages/client/src/ui/verb-legend.ts`
has genuine first-run detection (`showFirstRun`, `verbLegendSeen` persisted) and a real progressive-hint
budget. The problem is what it spends the budget on.

**The first-run modal** (`verb-legend.ts:61-186`, opened from `ArenaScene.ts:2471`) is a 760×490 panel
containing **18 control lines** in two columns plus a three-entry colour key, shown once, over a live arena,
with no pause behind it. It includes lines a first-time player has no use for and cannot act on:
`[Z/X] gallery page`, `[T] Enter Testing Grounds`, `[G/T] Game / weapon note in Grounds`, `[C] Change
cosmetic`. It also carries dead copy: `[F] Ultimate · Unlock through stat picks` — stat picks were deleted
(finding 1).

**The five context hints** (`verb-legend.ts:16-25`), each shown a maximum of twice, throttled to one per 3.2s:

| id | copy | when it can fire |
|---|---|---|
| `beamOverheat` | `DRIVE empty · [RMB] Release` | only while holding a beam weapon |
| `juggle` | `[LMB] Air parry` | only mid-juggle |
| `ultimateReady` | `[F] Ultimate` | only at full charge |
| `pitFall` | `[Space] Hold to leap gaps` | only at a pit |
| `empoweredReturn` | `Gold glint — parry again or step out` | only in an empowered parry chain |

Every one of these is a **tier-2** verb. Not one teaches the three things the entire game runs on: **fire**,
**parry the white glint**, and **pick up a weapon**. The parry is the game's signature skill and its only
first-contact teaching is one line inside a wall of 18.

Compare the peers. Brotato teaches by *removing* verbs — you only move, and every other system arrives one
wave at a time. Vampire Survivors teaches with a single line and lets the first 60 seconds be unloseable.
Hades gates each verb behind its own room with a dedicated on-screen prompt and cannot proceed until you use
it. All three use **progressive disclosure against a safe first minute**. DD has the mechanism for exactly
that — `offerHint` is already a throttled, persisted, count-capped budget — and points it at the wrong verbs.

**Minimal fix.** No new system needed. (a) Add `firstFire`, `firstParry` and `firstPickup` to `CONTEXT_HINTS`
and fire them from the existing trigger pattern (first enemy in range; first white glint on screen; first
pickup within prompt radius). (b) Cut the four dev/gallery lines and the dead ultimate line from the first-run
panel and move the rest behind a second page. (c) Pause behind the first-run modal once finding 6 lands.
*(POLISH_AUDIT B11 proposed a first-run toast and C5 flagged the copy as an owner decision — the copy
question is still open and is the only real blocker here.)*

---

### 9. Relics have no description — High

`packages/shared/src/relics.ts` — 9 common + 6 rare = **15 relics**, the entire in-run modifier layer now that
augments are dead. `CommonRelicDef` is `{ id, label, hud, value }` and `RareRelicDef` is `{ id, label, hud }`.
There is **no description field** on either. `hud` is a two-character code.

The HUD renders `RELICS EN RG PR · [RV]` (`ArenaScene.ts:2823-2837, 12166-12183`). A player who picks up
"Wide Guard" is told `PR` and given no indication that it is +8 px of parry radius, or that it stacks 20 times.
Note the contrast: `AugmentDef` *does* have a `desc` field (`augments.ts:26`) with real copy written — the
system that was cut kept its tooltips, the system that survived never got them.

Fifteen items is also thin on its own terms (see finding 1), and nine of them being flat additive stat lines
means most pickups do not change how you play. But the legibility fix is a day's work and multiplies whatever
the count ends up being.

**Minimal fix.** Add `desc: string` to both relic def types, write 15 one-liners, render on the pickup banner
and on relic-row hover.

---

### 10. No teammate awareness layer — High

In a 2–4 player co-op game (`MAX_PLAYERS` is actually 10 — `constants.ts:359`), the client provides:

| Aid | State |
|---|---|
| Player names | **Absent.** `PlayerState` has no name field at all (`packages/shared/src/state.ts:117-236`). |
| Per-player colour or tint | **Absent.** `addBlob` (`ArenaScene.ts:4470-4491`) builds every rig identically from the chosen character sprite. `isSelf` is passed to `SpriteRig` and stored (`rig-core.ts:2079`) but never used for a visual mark. |
| "Which one am I" | **Indirect only** — the camera follows you, and there is a parry-state ring under the local drifter (`ArenaScene.ts:10291-10322`) that reads as a mechanic indicator, not identity. It hides while downed and behind modals. |
| Teammate HP / squad frames | **Absent.** The only HP bar is the local one. |
| Off-screen teammate indicator | **Absent.** Edge arrows exist, but only for the extraction portal and the rift (`updateEdgeArrow`, `ArenaScene.ts:10418-10490`). |
| Ping / marker | **Absent.** |
| Chat | **Absent** — no surface, no server message. |
| Emotes | **Dead code.** `packages/client/src/sprites/icon-manifest-emotes.ts` exists with zero importers. |

Two players who pick the same character are visually identical. There is no way to say "over here", no way to
know a teammate is at 5 HP, and no way to find them when they are off-screen. The revive design (finding 4)
makes this worse: you must reach a downed ally to save them, and nothing tells you where they are.

**Minimal fix, ranked by value-per-hour.** (1) A per-player accent colour derived from session id, applied as
a rim tint on the rig and a small ground ring — solves identity and self-location at once. (2) A squad HP
strip in the HUD corner. (3) Reuse `updateEdgeArrow` for downed teammates. Names and ping can wait for an
account layer.

---

### 11. The greed loop has no money stake — Medium

`packages/server/src/rooms/room/room-economy.ts:1794-1805` runs identically for `outcome === "defeat"` and
`"victory"`:

```ts
account.scrip = Math.min(META_ACCOUNT_SCRIP_MAX, previousBank + runMoney);
if (player) player.scrip = 0;
```

**100% of run money banks on a wipe.** The stake in "bank or lose" is *carried weapons* only
(`packages/server/src/rooms/progression.ts:207-247`, `settleWeaponExpedition`). The doc comment at
`constants.ts:622` still describes extraction as the thing that banks money; in practice nothing is lost.

Since money is the sole meta currency and packs are the sole sink, this removes the tension from the entire
descend-or-extract decision for the progression axis. Pushing one floor deeper is strictly positive EV in
money terms; the only downside is losing weapons you happened to be carrying, which are themselves ephemeral.
Peers keep the stake sharp — RoR2 keeps nothing on death, Brotato pays out per wave survived, Hades keeps only
the meta currency and burns the run currency.

**Minimal fix.** Bank a fraction on defeat (e.g. 40%), or move banking to the extraction terminal so a wipe
banks nothing. One conditional in `settleRunMoney`; the tests that pin the current behaviour are the only
other surface.

---

### 12. The player has no depth privilege — Medium

Actors are y-sorted into one band: `blob.setDepth(blob.y)` for players (`ArenaScene.ts:9285`) and
`rig.setDepth(rig.y)` for enemies (`ArenaScene.ts:5896`). That is the correct top-down convention. The problem
is what sits in that band: up to 80 enemies, elites at `TOUGH_SCALE = 1.7`, and bosses at `renderScale` up to
10+ — while the local player has no outline, no rim light, and no colour distinction (finding 10).

A tough standing one pixel below you draws over you at 1.7× size. There is a landmark occlusion fade for
scenery (`ArenaScene.ts:10386-10409`, POIs ease to 45% alpha when the player is behind them) but nothing
equivalent for actors. The rest of the depth discipline is genuinely tight — VFX are hard-bounded at
`RECEIPT_VFX_MAX_DEPTH = 99860` (`vfx/hit-effects.ts:3-9`), telegraph footprints sit at depth 3 with response
boundaries at 99997, HUD at 100000+ — so VFX cannot hide the HUD and actors cannot hide VFX. The one gap is
actor-vs-actor, and it lands on the one actor that must never be lost.

**Minimal fix.** A thin self-only outline or ground ring on the local rig (the parry ring at
`ArenaScene.ts:10291-10322` is the existing pattern to extend), plus a small constant depth bias for the local
player. Both client-only, both cosmetic.

---

### 13. No music; the ambient beds are unwired — Medium

The audio system is one of the strongest parts of this build (see §3), but the score layer is missing.

- **316 tracked mp3s** in `packages/client/public/audio/sfx/` with a served 155-entry manifest.
- **Five ambient beds exist and ship**: `ambient-ashlands`, `-frostfell`, `-neon-cyber`, `-verdant-ruins`,
  `-wild-west`, present in `public/audio/sfx/` and in `tools/soundkit/sfx-manifest.json:954, 987, …`. Grep for
  any of those ids across `packages/client/src` returns **zero hits**. Nothing plays them.
- **There is no music track.** The only score is an adaptive *boss* bed —
  `AudioBus.setBossScore(state)` (`audio/AudioBus.ts:243-280`), a procedural pulse whose cadence tightens per
  phase (entrance 1.2s → phase2/3 0.75s), on its own gain node at 0.15, with a proper duck channel
  (`duckBossScore`, `:283-292`). That is good work, and it means outside a boss fight the game is silent
  except for combat SFX.

Music is not decoration in this genre — Brotato, Vampire Survivors, Hades and RoR2 all lean on a driving loop
to carry pacing between pressure peaks, and DD's floors are a flat 120s spawn ramp (see finding 21) that would
benefit most from exactly that. Also note the five beds are named for the *old* dimension roster
(ashlands/frostfell/neon-cyber/verdant-ruins/wild-west) — the current run structure is a corporate tower, so
they may be orphaned by the LDtk pivot rather than merely unwired.

**Minimal fix.** Wire the ambient beds to the active dimension through the existing `SampleBank` loop path
(`sample-bank.ts` already supports the 7 loop entries), and decide whether the corporate tower needs its own
bed. A run-loop music track is a separate, larger content decision.

---

### 14. No run summary — Medium

Both terminal states are a single word-wrapped `Phaser.Text`:

- **Death / wipe**: `ArenaScene.ts:2752-2762` (created), `:12206-12250` (composed). Contains a damage recap
  ("Downed by …", "Previous hit: …"), a recovery hint, a money line, a settlement stakes line and a pet line.
  The recap is genuinely thoughtful — it names the cause of death and the counter — but it is prose in one text
  object, not a screen.
- **Victory**: `ArenaScene.ts:2915-2925`, `:7800-7820` — `EXTRACTED · DEPTH N` plus the same lines.

What is absent: time survived, floors cleared, kills, damage dealt, money earned this run, weapons found, any
per-player breakdown, and any comparison to previous runs. `settlementPresentation`
(`packages/client/src/ui/settlement.ts:43-93`) reports weapons kept/lost and nothing else.

For a roguelite, the end card is where the run becomes a story and where the next-run pull is generated —
Hades, RoR2 and Brotato all invest heavily here. This is `POLISH_AUDIT` **B1**, still open since 2026-07-05,
with the copy blocked on an owner decision (**C3**).

**Minimal fix.** The data mostly exists on `room.state`. A card with depth, elapsed, money earned, weapons
found, and a per-player row (character, weapon, downs) would cover it. Copy needs an owner pass.

---

### 15. Six Wild-West enemies share one sprite — Medium

In `packages/shared/src/enemies.ts`, `sprite: "boothill"` is reused by **six** kinds: `boothill`, `old-rust`
(a boss), `ronin`, `gatlin`, `vault-ronin`, `dust-ranger`. `sprite: "grull"` is reused by three. They are
separated only by `renderScale` (1.15 / 1.18 / 1.22 / 1.5), the tough glow, and the weapon in hand.

Those six are behaviourally very different — a spitter, a boss, a 3-hit duelist, a scatter-shot, a leaper with
a red landing marker, and a dodge-rolling ranger. At swarm density with 80 bodies, a player cannot tell which
one is about to lunge at them. This is the one place where the readability discipline elsewhere in the build
(telegraphs, elite glow, depth bands) is undercut at the source.

The 27 generated themed enemies each have a bespoke sprite and are all present in the manifest — so this is
specifically the legacy Wild-West roster, and it is the roster the corporate tower currently draws from.

**Minimal fix.** Silhouette-differentiate the four combat variants (weapon-in-hand already differs; scale and
palette are cheap levers), or retire the duplicates in favour of the themed roster now that it exists.

---

### 16. Kills pay nothing; the money fields are dead — Medium

`EnemyKind.moneyValue` is authored across the whole roster (`enemies.ts:72`, values 1–110 at `:694-1036`, plus
every generated dimension enemy), and `TOUGH_MONEY_MULT = 4` sits in `constants.ts:601`. **Neither has a single
consumer in the server.** Boss money was explicitly retired: `room-progression.ts:4579-4586` sets
`encounter.setVictoryMoney(0)`.

Money comes from exactly two places: chests (`chests.ts:321-323`, `int(8,16) + floor(elapsed/60)`) and
disassembly (`economy.ts:6-14`, tier 1→4 up to tier 5→60).

Two problems. First, killing things — the thing the player spends 100% of their time doing — has no economic
feedback at all, which flattens the moment-to-moment reward loop that Brotato and Vampire Survivors build their
entire dopamine curve on. Second, ~40 authored numbers across the roster are lying to every future reader; a
Sol tuning enemy value will tune a dead field.

**Minimal fix.** Either wire `moneyValue` into the kill path as a small drop (it pairs naturally with the
existing owned-money-drop vacuum in `room-economy.ts:1897`), or delete the fields and the constant. Do one; do
not leave it ambiguous.

---

### 17. The booster-pack tail pays you to open it — Medium

`packages/shared/src/booster-packs.ts:306-360`. The dupe protection is good: `lockedPackCandidates` builds a
pool of *only* not-yet-owned items, so you can never pull something from a previous pack. But the three pulls
sample that snapshot with replacement, and the refund is added **after** the price is deducted:

```ts
scrip: account.scrip - price,        // :319
...
next.scrip = ... + refundTotal;      // :352
```

Refunds are `(price / 3) × rarityCostMultiplier × 0.5` (`:225-229`) — for a character pack that is 125 per
legendary dupe against a 150 price. When the locked pool for a band narrows to one legendary item, all three
pulls hit it: one unlock plus two refunds = **−150 + 250 = +100 net profit, and you keep the character**. A
weapon pack in the same position nets +60.

This is not an unbounded printer (once the pool empties, `openBoosterPack` returns `sold-out`), but it means
the most expensive stretch of the collection — the legendary tail, which should be the long chase — is free or
better. That inverts the pacing curve exactly where it should bite hardest.

For calibration, a Monte-Carlo run of the actual weights (`{common:55, uncommon:28, rare:13, legendary:4}`
with empty-band filtering, 40 trials) gives **≈93 weapon packs / ≈8,350 scrip** to unlock all 265 locked
weapons, plus ~1,650 for characters and ~360 for pets — call it **≈10,400 scrip for a full collection**. No one
in the repo has computed this, and there is no stated target for how many runs that should represent. That
absence is the real finding: pack prices, refund rates and chest money were each set independently, and nobody
owns the resulting curve.

**Minimal fix.** Clamp `refundTotal` to `price - 1` (one line at `:352`). Separately, write down the intended
runs-to-full-collection and check the arithmetic against it.

---

### 18. Join-in-progress is open and uncushioned — Medium

`GameRoom.ts:534` — `override maxClients = MAX_PLAYERS` with `MAX_PLAYERS = 10` (`constants.ts:359`). There is
no `lock()`/`unlock()` anywhere in the server. A run in progress is always joinable.

`onJoin` (`room-progression.ts:2933-3258`) gives the joiner `PLAYER_MAX_HP`, `DEFAULT_WEAPON`, `scrip = 0`, and
spawns them **at the map spawn disc** (`player.x = this.map.spawnX + (Math.random()*200-100)`, `:3115-3116`) —
the arena origin, not with the squad, however far the squad has travelled. They inherit the room's live
`depth`, so at depth 5 they arrive with a starter weapon into `depthHpScale(5) = ×2.0` enemies and
`depthDamageScale(5) = ×1.48` damage, with no relics and no catch-up. Their arrival also raises
`enemyHpScale(n)` for everyone.

Matchmaking filters on **creation-time** options only (`packages/server/src/index.ts:18`), so a quick-join
asking for dimension A can land in a run that has since descended to dimension C. To the team's credit this is
acknowledged and surfaced as an amber toast (`packages/client/src/net/matchmaking.ts:115-131`).

Master spec §22 `[LOCKED]` says the opposite: *"Matchmaking/joining only in the pre-run lobby + reconnects —
no mid-run drop-in for new players (simplifies netcode)."* And the framing everywhere else is 2–4 players
while the cap is 10.

**Minimal fix.** Decide the model and write it down. If JIP stays: spawn the joiner near the squad, give them a
depth-appropriate starter kit (a tier-matched weapon and a couple of common relics), and count only
`players.size` at floor start for HP scaling so late joiners do not spike difficulty mid-floor.

---

### 19. Zero telemetry — Medium

There is no analytics of any kind. The only feedback rail is `packages/server/src/owner-notes.ts`, which
appends to `data/owner-notes.jsonl` — 557 notes, all authored by one person, and gated to
`mode: "training"` only.

That is a genuinely good tool for what it is (see §3), but it means the answer to "which of the 338 weapons are
used, which are dominant, which are broken, which has never been picked up by anyone" is **nobody knows**. The
balance layer that does exist is static and formula-based — `weaponTierPowerBudget` (`weapon-tiers.ts:48-176`)
and the `isDropEligible` band gate (`loot.ts:273-280`, 0.6×–2.2× of the class median) — and the code is honest
about its ambition: *"it exists to catch ORDER-OF-MAGNITUDE outliers before they enter the drop pool, not to
fine-balance."*

At this catalog size a static formula is the right floor, but it cannot tell you that a weapon feels awful, or
that one gun is picked 40× more than any other. Every peer at this content scale instruments runs.

**Minimal fix.** On run settle, emit one JSON blob per player: weapons held and time-held, damage share by
weapon, relics taken, floor reached, cause of death. Append it next to `owner-notes.jsonl`. Even single-player
data across 50 owner runs would surface the dead weapons immediately.

---

### 20. No remapping, no gamepad — Medium

Keys are one hardcoded literal — `ArenaScene.ts:2502-2538`:

```ts
keyboard.addKeys("W,A,S,D,R,P,Q,E,Z,X,F,G,H,T,B,C,M,TAB,ESC,SPACE,SHIFT,CTRL,ONE,...,ENTER")
```

Every binding is a direct `JustDown(this.keys.X)` call site. `input-routing.ts` routes *contexts*, not physical
keys, so there is no indirection layer to hang a rebind on. `settings.ts` has no keybind section.

**Gamepad support is zero** — no `gamepad` / `navigator.getGamepads` / `Phaser.Input.Gamepad` anywhere in
`packages/client/src`, and the plugin is never enabled in `main.ts`. Mouse is mandatory: RMB fires, LMB parries,
cursor aims.

Master spec §20 `[LOCKED]` promises both: *"optional aim-assist/snap for controller players (Steam = heavy
controller base)"* and *"(Controller binds + a rebind layer come with the HUD deliverable.)"*

Also relevant to accessibility: several actions are hold-only with no toggle alternative — `E` hold to
disassemble, `Space` hold to crouch/leap, hold-to-prestige in the menu.

This is genuinely large and genuinely deferrable, but it should be deferred *deliberately*, with a note that a
Steam release cannot ship without it.

---

### 21. Content variety at the tail — Medium

- **Floors.** The "endless corporate tower" runs on **3 authored floor layouts** × 3 crop variants =
  9 distinct layouts, selected by depth
  (`packages/shared/src/corporate-grid-map.ts:145-153, 277-290`): `office-red-carpet-gallery`,
  `office-random-dude-portrait-hall`, `office-marble-gallery`.
- **Bosses.** 13 boss defs exist in `BOSSES` (`bosses.ts:1216-1230`) — real, distinct, multi-phase fights with
  a telegraph DSL. But only **5** are mapped to dimensions (`DIMENSION_BOSS_DEFS`, `bosses.ts:1237-1243`); the
  rest are reachable only through the dev picker and Boss Rush.
- **Ultimates.** 1 of 20 (finding 1).
- **Pacing.** A floor is a flat `BOSS_SPAWN_SECONDS = 120` with a monotonic spawn ramp
  (`SPAWN_INTERVAL_START 1.9 → SPAWN_INTERVAL_MIN 0.65` over `SPAWN_RAMP_SECONDS 240`). There is no wave table
  and no authored rest beat — the belt room/gate structure (`belt-map.ts`) provides the only rhythm. Peers all
  build an explicit tension curve: Brotato ramps spawn budget *within* a wave then hard-stops, VS marks events
  by minute, RoR2 alternates director spend with teleporter charges.

None of this is broken. It is the shape of a game whose content pipeline has produced enormous breadth
(338 weapons, 37 characters, 49 enemy kinds, 13 bosses) and comparatively little of the *structural* variety
that makes runs feel different — floors, boss rotation, and build branches.

---

### 22. No difficulty options — Low

No difficulty selection, no ascension/danger ladder, no assist toggles. Difficulty is a single implicit axis:
how deep you choose to descend (`depthHpScale`, `depthDamageScale`, `DEPTH_TOUGH_PER`, `DEPTH_BOSS_ACCEL`).
That axis is well-built and is a legitimate design choice — but it means a struggling player has no lever
except "stop descending", and a strong player has no lever except "descend more", with no recognition either
way. Brotato's Danger 0–5 and RoR2's Eclipse ladder both exist to give the curve a name and a reward.

---

### 23. The unlock economy is client-owned — Low

`openBoosterPack` is called from `packages/client/src/scenes/MenuScene.ts:1561` and the result is written to
`localStorage` via `savePetMetaAccount`. There is no server-side purchase path. The server acknowledges the
model on join — `room-progression.ts:2977-2981`: *"client-authored progression is only honoured while dev
tools are on… INTERIM until an authenticated account store owns progression."*

That guard is the right call and covers the worst case. Flagging it here only because the *design* question is
unresolved: if unlocks are meant to feel earned across a co-op squad, they eventually need an authority, and
the pack-open flow is the surface that will have to move. Not urgent.

---

## 3. What this build does right

Calibration matters, so these are the places DD is at or above shipped-genre standard. None of this is padding
— each was verified in code.

**Combat feedback is better than most shipped indies in this genre.**
- Damage numbers are derived from an **authoritative HP delta only**, never from a receipt
  (`packages/client/src/combat-feedback.ts:89-97, 574-607`); receipts merely decorate, and a partially-covered
  delta is downgraded to `"mixed"` rather than lying. That is a discipline most games never impose on
  themselves. Attribution is a first-class type (`self | teammate | mixed | unattributed`).
- Hit-stop runs on a **leaky-bucket budget** — 250ms of freeze per 1000ms window
  (`ArenaScene.ts:10566-10567`), with priority beats (parry, final blow, quake connect) bypassing the bucket,
  per-tier refractory periods, and a hard rule that rapid/beam deliveries freeze 0ms. The comment says it
  plainly: *"so a horde clear can't freeze ~40% of the time."*
- Camera shake goes through **one prioritised mixer** with declared source classes, a distance-falloff tier for
  the colossus, and an owner ruling capping player-weapon shake at 5% amplitude
  (`camera-shake.ts:3-14`, `ArenaScene.ts:11073-11086`).

**The audio system is a real system, not a placeholder.** 316 tracked mp3s behind a 155-entry manifest, a
2,277-line Web Audio bus, tiered voice budgets (synth 16/20/24 by priority, samples 6/9/12), per-cue and
per-gun-family throttles, pitch jitter to fight fatigue, stereo panning from world-x, an adaptive per-phase
boss score with a proper duck channel, and beam-loop watchdogs so a lost release edge cannot strand a loop.
The `ConfirmDirector` (`combat-feedback.ts:241-379`) is the standout: above 5 hit-frames per 300ms it flips
from per-hit ticks to a **ratchet grain** — a real answer to the "40 enemies at once" problem that most games
solve by simply clipping.

**The telegraph system is a first-class wire concept.** `TelegraphState` is synced schema
(`state.ts:403-424`) with an explicit danger class (parryable-white vs dodge-red), and every boss primitive
computes the telegraph shape and the damage payload **in one pass** so the footprint you read is exactly the
hitbox (`boss-primitives.ts:19-22`). Ordinary enemies get a synced `windup` float driving a rig tell with
authored per-enemy read times (ronin `windup: 0.52`). Projectile tells tighten a ring onto the incoming slug
within 150px. Colourblind assist has real lead-time constants for the glint (`MELEE_FIRST_GLINT_LEAD_MS = 450`).

**Chest loot is properly instanced.** Rolls are seeded on the opener's id (`chests.ts:261-268`), every player
opens the same chest once for their own independent roll, and overflow drops are owner-locked
(`room-economy.ts:598-600`). No loot competition, no need/greed friction — this is the correct co-op answer and
it matches the B20 lock exactly.

**Fair spawning.** `findFairEnemySpawn` (`room-enemies.ts:3050+`) validates every candidate against **every**
living player's warning circle and a conservative camera rectangle before accepting it. No off-screen ambush,
no spawn-on-face. Many shipped games in this genre do not do this.

**The tier/power system is a genuine content-health tool.** `weaponTierPowerBudget`
(`weapon-tiers.ts:48-176`) is a deterministic closed-form power estimator covering beams, charged projectiles,
guns with pellets/burst/pierce/bounce, casts, quakes, chains, scatters and zones. `data/weapon-tiers.json` is a
checked-in cache of it, and `tests/weapon-tiers.test.ts` asserts `weapon.tier === derivedWeaponTier(weapon)`
for every active id plus a non-dominance census. The `isDropEligible` band gate turns the power budget itself
into the curation mechanism — an expansion weapon enters the drop pool by being *tuned into band*, never by
fiat. That is a better answer to "340 weapons" than most teams reach.

**Constants are documented like a design doc.** `packages/shared/src/constants.ts` annotates almost every
scalar with the section it implements, the ruling that set it, and whether it is provisional. It is the single
most useful file in the repo for understanding intent.

**The owner-notes rail is a good instrument.** In-game `G`/`T` capture straight to `data/owner-notes.jsonl`
with weapon id and session, feeding a batch-audit workflow. 557 notes have driven ~30 batches of fixes. The gap
is that it is the *only* instrument (finding 19), not that it is a bad one.

**The `docs/input-map.md` survey and the B20 lock doc are exemplary artifacts** — both are the kind of written
contract that normally does not exist on a project this fast. The problem is not that the team does not write
things down; it is that the writing has stopped being reconciled against the build (finding 7).

---

## 4. Recommended sequencing

Grouped so each block shares an edit surface and can land as one gate.

**Block A — one week, unblocks everything else.** *Cheap, high-visibility, no design decisions needed.*
1. **Finding 2** — the options panel. Nothing else in this report is as cheap per unit of value; it also makes
   findings 12/13/15 tunable by the player while they are being fixed.
2. **Finding 9** — relic descriptions (15 one-liners).
3. **Finding 5a** — render `WeaponDef.description` where present, plus the derived behaviour line.
4. **Finding 17** — one-line refund clamp.
5. **Finding 16** — decide: wire `moneyValue` or delete it.

**Block B — the co-op block.** *These four interact; do them together or the fixes fight each other.*
6. **Finding 3** — move player scaling from HP to spawn pressure. Do this first in the block; findings 4 and
   18 both change what "more players" means.
7. **Finding 4** — universal hold-to-revive.
8. **Finding 10** — player accent colour + squad HP strip + downed-teammate chevron.
9. **Finding 18** — rule on join-in-progress and on 2–4 vs 10; align spec §22.

**Block C — the run-shape block.** *Restores in-run depth and closes the greed loop.*
10. **Finding 1** — re-home augments onto chests; roll ultimates per character. Biggest single gain in
    run-to-run variety, against machinery that already exists and is tested.
11. **Finding 11** — put a money stake on defeat.
12. **Finding 14** — the real end card (needs owner copy).

**Block D — first-contact.** *Do after A and C so what you teach is the game that actually ships.*
13. **Finding 6** — solo pause first, consensus pause second.
14. **Finding 8** — retarget the hint budget at fire/parry/pickup, page the legend, strip the dead copy.
15. **Finding 12** — self outline.

**Block E — production hygiene, run in parallel with all of the above.**
16. **Finding 7** — the spec reconciliation pass, and add "§25 entry written" to the merge gate. Do this
    *before* Block C, because Block C will otherwise generate more undocumented canon.
17. **Finding 19** — the per-run telemetry blob. Cheap, and it is the only way to ever know whether Block C
    worked.

**Deliberately deferred, with a note.** Findings 20 (rebind/gamepad), 21 (content variety), 22 (difficulty
options), 23 (economy authority). Each is genuinely large and none of them is what makes a first-time player
bounce. But 20 is a hard gate on a Steam release and should be scheduled, not just deferred.

**Honest severity note.** Of everything here, the items a brand-new player would actually bounce off are:
**5** (they cannot tell what any weapon does), **8** (they are not taught the parry), **10** (in co-op they
cannot find themselves or their team), **6** (they cannot stop playing), and **2** (if they need any
accessibility accommodation at all, there is no door). **1**, **3** and **11** are what a player who *stays*
will get bored by. Everything else is polish debt — real, but survivable.
