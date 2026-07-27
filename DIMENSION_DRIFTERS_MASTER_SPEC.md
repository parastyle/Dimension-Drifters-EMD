# DIMENSION DRIFTERS — LEAN CANON INDEX

**Status:** living canon · **Rebuilt:** 2026-07-25 · **Convention:** `[LOCKED]` means owner-decided
until a later dated entry explicitly supersedes it.

This is an index of decisions that code cannot safely explain by itself. It is not a system guide,
architecture document, tuning table, content census, roadmap, or changelog.

## How this stays true

1. A lock is written **here in the same commit as the decision**. Never land a design decision and
   promise to update this file later.
2. `docs/sol-reports/design-lock-*.md` remain the detailed decision records. This file is the
   current index: one current truth plus its supersession citation.
3. Anything cheaply checkable belongs in a test, not prose. The canon invariant test protects the
   highest-risk deleted-system seams.
4. A later dated owner ruling supersedes an earlier one. A later observation reopens an earlier
   “done” claim. Missing or contradictory rulings stay in **Open questions**; agents never guess.
   [Citation: notes-ledger evidence order and ambiguity rule](docs/sol-reports/notes-ledger-v9.md#method-normalization-and-accounting).
5. Implementation reports may explain **how** a lock shipped, but cannot create canon. Recommended
   defaults are not locks until the owner accepts them.

## Standing laws and bans

- **L01 `[LOCKED]` — No chains, tassels, ropes, loose wrap ends, or other dangling visuals that
  imply unsupported physics.** Why: the game has no simulation that can make them move truthfully;
  static dangles advertise motion the game cannot deliver. [Citation: B2/B3 standing-law
  integrations](docs/sol-reports/impl-b3-integrator.md); [executable fan census](tests/b3-fan-hybrids.test.ts).
- **L02 `[LOCKED]` — No player-enveloping auras.** Strike-local flashes, trails, and hand/foot
  effects are legal; a character-wrapping weapon glow is not. Why: auras erase the character
  silhouette and turn weapon identity into ambient clutter. [Citation: B23 owner correction and
  permanent law](docs/sol-reports/impl-b23-kungfu-v2.md#understanding), commit `cbaa4ae`.
- **L03 `[LOCKED]` — Character hands and hand/foot wrap weapons have no fingers, thumbs, toes,
  knuckles, or articulated digits.** Why: digits break the detached blob construction and create
  impossible grip/orientation expectations. [Citation: pill-grunt lock `1f06dca`;
  no-thumb roster](docs/sol-reports/impl-char-rig-batch3.md); B19 art gates
  `docs/sol-reports/impl-b19-art-*.md`.
- **L04 `[LOCKED]` — Melee and weapon attacks never displace the player root.** Choreography may
  flip, spin, stretch, or translate rendered parts at a planted root. B45 classified physical gun
  recoil as the sole weapon-fire exception. Why: attack-authored travel fought movement authority
  and caused position snaps. [Citation: B44 planted-attack ruling](docs/sol-reports/impl-b44-no-weapon-drift.md),
  commit `4d2c5ab`; [B45 exception](docs/sol-reports/impl-b45-gun-recoil.md), commit `8d70bf3`.
- **L05 `[LOCKED]` — Never interrupt live gameplay with a modal.** Pickups, capsule rewards,
  disassembly, and other run events use world interactions, HUD text, or brief non-blocking
  receipts. Why: a modal steals combat input while the authoritative room continues. [Citation:
  B20 non-modal reward contract](docs/sol-reports/impl-b20-l2-chests-relics.md);
  [audit of legacy modal failures](docs/sol-reports/audit-design-practice.md#8-onboarding-teaches-the-wrong-verbs--high).
- **L06 `[LOCKED]` — Large visual migrations are render-layer only.** Enumerate every affected
  surface before work, screenshot-gate every surface, and keep the game playable after every
  merge. Why: broad visual work must not silently rewrite authority or leave one mode/facing/path
  stale. [Citation: standing migration contract](docs/sol-reports/night-summary-2026-07-24.md#open-items-for-you);
  [B57 gate obligation](docs/sol-reports/design-lock-b57-dimension-loop.md#6-implementation-lanes-serial-each-independently-shippable).
- **L07 `[LOCKED]` — New special-effect art defaults to generated-image subjects, one subject per
  art assignment.** Why: subject isolation preserves provenance and prevents a multi-subject sheet
  from hiding inconsistent scale/style. [Citation: production-law disposition
  in notes ledger v9](docs/sol-reports/notes-ledger-v9.md#section-a--done--skip);
  [B11 one-subject execution](docs/sol-reports/notes-ledger-v10.md#standing-numbered-batch-view).
- **L08 `[LOCKED]` — Pilot, approve, then fleet any large art batch.** Why: an approved anchor
  catches style drift before it multiplies across a roster. [Citation: art-production lock
  `e178c1b`; executable reference-anchor policy in
  `tools/artkit/style.json`; pill-grunt anchor update `1f06dca`.]
- **L09 `[LOCKED]` — Movement is stupid simple. Feel comes from ANIMATION, never from modulating
  speed.** The character travels at ONE constant speed. The only permitted modifiers are attacking,
  parrying, and an explicit environmental slow (ice and similar). No turn weight, no reversal hitch,
  no acceleration curve, no momentum, no per-direction variance — diagonal equals cardinal. Stopping
  is crisp; a legitimate stop must not be eased by the presentation layer.
  Why: the owner originally requested direction-change "weight" and then retracted it after playing
  it — the dip read as lurching, not as heft. Owner ruling, 2026-07-26 (verbatim): *"earlier in
  development I asked for that weight of movement while switching directions. We dont need any of
  that. As long as we have good animations, and crisp movement we should make the movement feel
  stupid simple."* and *"There should be no character lurching."*
  Consequence: `MOVE_HITCH_MIN_ANGLE` / `MOVE_HITCH_DIP` / `MOVE_HITCH_MIN_SPEED` /
  `MOVE_RECOVER_ACCEL` / `MOVE_STOP_DECEL` are DELETED and must not return. Anything that makes
  movement feel better belongs in the rig — gait, limb physics, flourishes — not in the speed model.
  [Citation: lurch removal `34095d94`; the dip was `MOVE_HITCH_DIP = 0.042`, i.e. 95.8% of 320 px/s
  = the observed 306.56 oscillation.]

## Current locked decisions and supersession chain

Every line states the current decision, date, what it replaces, and its evidence.

### B20 — economy and progression

- **D01 `[LOCKED 2026-07-23/24]` — No player stats, levels, XP, stat allocation, weapon scaling
  grades, or weapon requirements.** Supersedes old spec §§7, 10–12 and signature-per-five-levels.
  [Citation: B20 rules 1 and dispositions](docs/sol-reports/design-lock-b20.md#the-locked-rules),
  teardown commit `9e4641c`.
- **D02 `[LOCKED 2026-07-23/24]` — Any character may use any weapon; authored weapon damage is
  flat rather than character-stat-derived.** Supersedes class stat bias, stat gates, and
  the former stat-derived `heldDamageMult` scaling. [Citation: B20 rules 1–2
  and dispositions](docs/sol-reports/design-lock-b20.md#the-locked-rules), commit `9e4641c`.
- **D03 `[LOCKED 2026-07-23/24; renamed 2026-07-25]` — Dimensional capsules are the sole in-run
  itemization channel.** Supersedes shops, enemy-store economy, and player-facing “chest” wording.
  [Citation: B20 rule 4](docs/sol-reports/design-lock-b20.md#the-locked-rules);
  [B57 capsule fiction](docs/sol-reports/design-lock-b57-dimension-loop.md#4b-fiction-who-you-work-for-locked-2026-07-25),
  commit `90aae40`.
- **D04 `[LOCKED 2026-07-23/24]` — No shopkeeper, shop UI, or sell flow.** Supersedes the
  shopkeeper economy because it gated fun behind an overused stop. Art may remain archived.
  [Citation: B20 rule 5](docs/sol-reports/design-lock-b20.md#the-locked-rules);
  removal commit `05fda7a`.
- **D05 `[LOCKED 2026-07-23/24]` — Disassemble unwanted weapons where they lie or from the bag;
  receive money immediately without a menu interruption.** Supersedes selling.
  [Citation: B20 rule 6](docs/sol-reports/design-lock-b20.md#the-locked-rules);
  [L3 implementation](docs/sol-reports/impl-b20-l3-economy.md#disassembly-value-curve).
- **D06 `[LOCKED 2026-07-23/24]` — Money is pure meta currency: no in-run sink, zero carried in
  from the bank, and 100% of run money banks on terminal settlement including death.** Supersedes
  run-only Gems and partial/manual banking. [Citation: B20 rule 7
  and B57 death loop](docs/sol-reports/design-lock-b20.md#the-locked-rules);
  [L3 banking](docs/sol-reports/impl-b20-l3-economy.md#banking-flow).
- **D07 `[LOCKED 2026-07-23/24]` — Banked money buys out-of-run booster packs containing pets,
  permanent weapon-pool unlocks, and characters.** Supersedes the hub/shop meta economy.
  [Citation: B20 rule 8](docs/sol-reports/design-lock-b20.md#the-locked-rules);
  pack commit `fa592f4`.
- **D08 `[LOCKED 2026-07-23/24]` — A duplicate pack pull visibly refunds 50% of that pull’s
  rarity-weighted cost on its card flip.** Supersedes silent or flat duplicate conversion.
  [Citation: B20 rule 9](docs/sol-reports/design-lock-b20.md#the-locked-rules);
  [L4 refund table](docs/sol-reports/impl-b20-l4-booster-meta.md#pack-tuning).
### B55 — capsule contents, augments, ultimates

- **D09 `[LOCKED 2026-07-25]` — “Trinket” is the player-facing term for the retained relic
  system, and eligible trinkets can carry augment payloads.** Supersedes the orphaned
  level/signature augment lane and B20’s unimplemented acquisition gap. [Citation: B55 commit
  `6b63880`, `docs/sol-reports/impl-b55-chest-contents.md#augments-on-trinkets`.]
- **D10 `[LOCKED 2026-07-25]` — Capsule content classes are trinkets/augments, weapons, pets, HP
  potions, and money.** Supersedes the narrower B20 chest table; exact weights remain code/tuning,
  not canon prose. [Citation: B57 B55 disposition](docs/sol-reports/design-lock-b57-dimension-loop.md#5-dispositions);
  B55 commit `6b63880`.]
- **D11 `[LOCKED 2026-07-25]` — Ultimates are OFF until further notice behind one reversible
  shared gate.** Supersedes B20’s proposed rare-trinket ultimate grants and the interim hardcoded
  Sunspite assignment. [Citation: B57 disposition](docs/sol-reports/design-lock-b57-dimension-loop.md#5-dispositions);
  B55 commit `6b63880`, `docs/sol-reports/impl-b55-chest-contents.md#outcome`.]

### B57 — the dimension loop

- **D12 `[LOCKED 2026-07-25]` — A run chains dimensions: big procedural grind room → timed portal
  → short authored boss sequence and boss → new harder grind room; death ends the run.**
  Supersedes the endless corporate-tower framing and the old boss-then-extract endpoint.
  [Citation: B57 loop](docs/sol-reports/design-lock-b57-dimension-loop.md#1-the-loop), commit `570696a`.
- **D13 `[LOCKED 2026-07-25]` — No hub, home base, persistent mid-run space, crystals, or portal
  currency.** Supersedes hub/base-building and crystal drafts. [Citation: B57 rules 1–2
  and dispositions](docs/sol-reports/design-lock-b57-dimension-loop.md#2-locked-rules).
- **D14 `[LOCKED 2026-07-25]` — Boss portals appear at random room positions as visible,
  time-limited events; their type is readable before commitment; concurrency is unlimited.**
  Supersedes a singular fixed exit. [Citation: B57 rules 4–7
  ](docs/sol-reports/design-lock-b57-dimension-loop.md#2-locked-rules).
- **D15 `[LOCKED 2026-07-25]` — Portal type selects both the authored boss sequence and the
  destination room type.** Supersedes linear dimension order; this is the branching choice.
  [Citation: B57 rules 6–7](docs/sol-reports/design-lock-b57-dimension-loop.md#2-locked-rules).
- **D16 `[LOCKED 2026-07-25]` — Ignoring portals is survivable but losing: enemy count, speed,
  and toughness escalate, then a closing lethal gas circle guarantees every room ends.**
  Supersedes indefinitely safe grinding. [Citation: B57 rules 8–9
  ](docs/sol-reports/design-lock-b57-dimension-loop.md#2-locked-rules).
- **D17 `[LOCKED 2026-07-25]` — Boss completion awards a cool weapon carried onward, and
  difficulty escalates with each dimension.** Supersedes crystal rewards and flat chained rooms.
  [Citation: B57 rules 10–11](docs/sol-reports/design-lock-b57-dimension-loop.md#2-locked-rules).
- **D18 `[LOCKED 2026-07-25]` — There is one map system; grind rooms and boss-sequence scenes are
  map data, never separate “arena”/“belt” gameplay modes.** Supersedes the B34 mode flag and
  endless-elevator identity. [Citation: B57 mode collapse
  ](docs/sol-reports/design-lock-b57-dimension-loop.md#4-the-mode-collapse-this-is-why-the-vision-is-also-the-refactor).

### Combat, movement, and session behavior

- **D19 `[LOCKED 2026-07-24]` — Self movement is owner-authored inside a bounded, swept,
  epoch-aware server envelope; combat, damage, enemies, loot, and economy remain server-owned.**
  Supersedes strict server-only locomotion reconciliation. [Citation: B42 outcome
  ](docs/sol-reports/impl-b42-relaxed-authority.md), commit `3a05a22`.
- **D20 `[LOCKED 2026-07-24]` — Ordinary/tough melee enemies telegraph, lock a target and
  nav-valid lunge, then commit; walking/strafe is not an evasion after lock, while parry, roll,
  airborne jump, or authored defensive displacement is.** Supersedes cone-at-impact melee.
  [Citation: B33 owner-approved contract](docs/sol-reports/impl-b33-commit-melee.md#timing-and-locked-lunge-design),
  commit `7a32051`.
- **D21 `[LOCKED 2026-07-24]` — Successful parries react by incidence: below lifts, left/right
  slides away proportional to prevented damage, above braces without displacement; guard poses
  cycle through three variants per weapon subtype.** Supersedes the one-reaction parry.
  [Citation: B26 design and implementation](docs/sol-reports/impl-b26-parry.md#stage-0--design-contract),
  commit `24e22dd`.
- **D22 `[LOCKED by 2026-07-06]` — Pause exists; online pause requires every player’s
  confirmation.** Supersedes unilateral multiplayer pause; it does not authorize blocking
  reward/onboarding modals during live simulation. [Citation:
  audit finding quoting the surviving pause lock](docs/sol-reports/audit-design-practice.md#6-no-pause--high).

## Fiction and art canon

- **F01 `[LOCKED 2026-07-25]` — The player works for the Dimension Police Department (DPD).**
  This is the employer and primary fiction anchor. [Citation: B57 fiction lock
  ](docs/sol-reports/design-lock-b57-dimension-loop.md#4b-fiction-who-you-work-for-locked-2026-07-25),
  commit `90aae40`.
- **F02 `[LOCKED 2026-07-25]` — Player-facing “chests” are dimensional capsules: armored DPD
  armory resupply pods.** Internal identifiers may remain `chest`; player-facing copy may not.
  [Citation: B57 fiction lock](docs/sol-reports/design-lock-b57-dimension-loop.md#4b-fiction-who-you-work-for-locked-2026-07-25).
- **F03 `[LOCKED 2026-07-25]` — A dimensional capsule has registered sealed and open states;
  opening reveals an illuminated weapon-rack armory interior.** [Citation: B58 art commit
  `394f7de`, `docs/sol-reports/impl-b58-art-capsule.md`.]
- **F04 `[LOCKED 2026-07-25]` — Future organization names, HUD chrome, pack naming, and run
  framing must extend DPD fiction rather than invent a competing employer.** [Citation: B57
  fiction lock](docs/sol-reports/design-lock-b57-dimension-loop.md#4b-fiction-who-you-work-for-locked-2026-07-25).
- **F05 `[LOCKED 2026-06-15/16]` — Art is rough, chunky, gritty dark-comic flat cel: bold
  silhouette readability, desaturated grime, and Madness-Combat-like pill-grunt energy.**
  Reference rendering/motion language only, never another work’s content. [Citation: art lock
  `e178c1b`; pill-grunt lock `1f06dca`; executable profile `tools/artkit/style.json`.]
- **F06 `[LOCKED 2026-06-15]` — Every design is original and trademark-distinct.** Style
  anchors govern outline, palette, proportion, and mood—not characters, costumes, names, or
  iconography. [Citation: art lock `e178c1b`; `tools/artkit/style.json` `referenceFamily`.]
- **F07 `[LOCKED 2026-06-16]` — A playable character is one upright, planted, rounded
  pill/egg/cone torso with no waist or realistic anatomy; identity comes from iconic headgear
  over a faceless void with at most two dot-eyes.** [Citation: pill-grunt lock `1f06dca`;
  `tools/artkit/style.json` `identityRefRenderRules`.]
- **F08 `[LOCKED 2026-06-16]` — Players are limbless full-build figures: body, two detached blob
  hands, and two detached blob feet, all separated by visible gaps; base character art is
  empty-handed and has no cape or billowing cloth.** [Citation: pill-grunt lock `1f06dca`;
  no-thumb roster](docs/sol-reports/impl-char-rig-batch3.md).
- **F09 `[LOCKED 2026-06-15]` — Enemies stay in the same limbless language but may be full,
  hands-only, or pure blob according to the creature.** [Citation: variable-construction lock
  `e178c1b`; executable profile `tools/artkit/style.json`.]
- **F10 `[LOCKED 2026-06-14]` — Weapon/prop identity art is flat orthographic broadside,
  entirely in plane, facing right with business end right and grip/stock left.** [Citation:
  art orientation lock `e178c1b`; `tools/artkit/style.json` `identityRefRenderRules`.]
- **F11 `[LOCKED 2026-06-14]` — In-world identity sprites show the object at rest with zero
  baked smoke, fire, particles, trails, aura, bloom, muzzle flash, or ground shadow; runtime
  render layers own motion/light/VFX. Card art may show action and VFX.** [Citation: at-rest
  art lock `e178c1b`; executable identity/card rules in `tools/artkit/style.json`.]
- **F12 `[LOCKED 2026-06-15]` — The world/actors use a dark desaturated base so saturated neon
  combat VFX are the loud color.** [Citation: art palette lock `e178c1b`;
  `tools/artkit/style.json` `styleBlock` and `_palette`.]
- **F13 `[LOCKED 2026-06-15]` — Detail stays at the same character baseline across the roster;
  bosses become bigger, not more detailed, and hand-drawn art scales uniformly without static
  stretching.** [Citation: uniform-detail/scale locks `e178c1b`;
  executable profile `tools/artkit/style.json`.]
- **F14 `[LOCKED 2026-06-14/16]` — Approved golden reference images propagate form and style;
  new siblings use approved anchors without copying costume or color identity.** [Citation:
  golden-anchor lock `e178c1b`; pill-grunt reference update `1f06dca`.]

## Open questions — do not guess

- **Q01 `[OPEN]` — What owner-visible condition, if any, turns ultimates back on, and what replaces
  the retired stat/level assignment model when that happens?** [Citation: B55 “until further
  notice,” commit `6b63880`; B57 disposition
  ](docs/sol-reports/design-lock-b57-dimension-loop.md#5-dispositions).
- **Q02 `[OPEN — OWNER REVIEW REQUIRED]` — Is an HP potion an instant capsule pickup that heals
  exactly 35% max HP, or something else?** [Citation: explicit B55 assumption, commit `6b63880`,
  `docs/sol-reports/impl-b55-chest-contents.md#hp-potion-assumption--owner-review-required`.]
- **Q03 `[OPEN — OWNER REVIEW REQUIRED]` — Does a capsule pet temporarily replace the active pet
  for the run without unlocking it, or follow a different ownership/replacement rule?** [Citation:
  explicit B55 assumption, commit `6b63880`,
  `docs/sol-reports/impl-b55-chest-contents.md#chest-pet-assumption--owner-review-required`.]
- **Q04 `[OPEN]` — Do capsules arrive by a visible drop/impact, or may they already exist when a
  room loads?** [Citation: B57 recommendation explicitly not locked
  ](docs/sol-reports/design-lock-b57-dimension-loop.md#4b-fiction-who-you-work-for-locked-2026-07-25).
- **Q05 `[OPEN]` — What are the guaranteed portal cadence, portal lifetime, gas start/shrink
  timing, and safe-zone interaction values?** [Citation: B57 tunable defaults
  ](docs/sol-reports/design-lock-b57-dimension-loop.md#3-orchestrator-recommended-defaults-tunable).
- **Q06 `[OPEN]` — Which visible portal types exist, and what destination room plus authored boss
  sequence does each type select?** [Citation: B57 L4–L5 leave the branch table/content roster
  unchosen](docs/sol-reports/design-lock-b57-dimension-loop.md#6-implementation-lanes-serial-each-independently-shippable).
- **Q07 `[OPEN]` — How many authored scenes precede each boss, and are sequence lengths uniform or
  portal-specific?** [Citation: B57 describes a short sequence but does not lock its exact
  production length](docs/sol-reports/design-lock-b57-dimension-loop.md#1-the-loop).
- **Q08 `[OPEN]` — In co-op, should added players increase enemy count/pressure, enemy HP, or a
  ruled mixture?** [Citation: verified unresolved scaling conflict
  ](docs/sol-reports/audit-design-practice.md#3-co-op-scales-hp-not-pressure--high).
- **Q09 `[OPEN]` — Is revival a universal squad interaction, or intentionally restricted to the
  Gravedigger’s Spade and rare revive trinket?** [Citation: verified current restriction and
  unapproved recommendation](docs/sol-reports/audit-design-practice.md#4-rez-or-dead-is-gated-behind-one-weapon--high).
- **Q10 `[OPEN]` — What is the supported co-op player count, and are new players allowed to join
  an active run; if yes, what catch-up and spawn rule applies?** [Citation: spec/code conflict
  ](docs/sol-reports/audit-design-practice.md#18-join-in-progress-is-open-and-uncushioned--medium).
- **Q11 `[OPEN]` — Should enemy kills award money, or should the authored but unused enemy-money
  fields be deleted?** [Citation: verified dead reward data
  ](docs/sol-reports/audit-design-practice.md#16-kills-pay-nothing-the-money-fields-are-dead--medium).
- **Q12 `[OPEN]` — What runs-to-full-collection target owns pack prices, rarity weights, and the
  locked 50% duplicate refund; should total refunds be capped below pack price?** [Citation:
  unresolved economy tail](docs/sol-reports/audit-design-practice.md#17-the-booster-pack-tail-pays-you-to-open-it--medium).
- **Q13 `[OPEN]` — Are selectable difficulty/assist modes part of the product, and if so what do
  they change or reward?** [Citation: no decision found
  ](docs/sol-reports/audit-design-practice.md#22-no-difficulty-options--low).
- **Q14 `[OPEN]` — What authenticated authority ultimately owns bank/unlock progression in
  multiplayer?** [Citation: current client-owned state is explicitly interim
  ](docs/sol-reports/audit-design-practice.md#23-the-unlock-economy-is-client-owned--low).
- **Q15 `[OPEN]` — Are exact weapon instances meant to persist in the current between-run stash,
  or must the stash be removed so persistence is unlock-pool-only as B20 ruled?** [Citation:
  unresolved B20/code contradiction
  ](docs/sol-reports/audit-design-practice.md#7-design-canon-has-diverged-from-the-build--high);
  [B20 rule 10](docs/sol-reports/design-lock-b20.md#the-locked-rules).

## Deliberately absent

If a reader needs counts, schemas, APIs, constants, dependency versions, architecture, controls,
room messages, catalog contents, implementation history, or tuning values, read the code, generated
catalogs, tests, and detailed Sol reports. Their presence here would be rot, not canon.
