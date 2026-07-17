# Devil's Advocate — Stat-Frequency Ultimates

Role: attack the proposal before it costs us a milestone. Everything below is grounded in the current
code (verified 2026-07-16, branch `feat/v0.117-feel-and-colossus`). I am not arguing "don't build
ultimates." I am arguing that **the frequency-mapping premise is broken as specified**, that three of
the four example ultimates directly cannibalize systems we shipped or are shipping this week, and that
the netcode/readability bill is larger than the pitch admits. If the panel proceeds, the guardrails at
the bottom are the floor, not a wishlist.

---

## 0. What the code actually says (so we argue about the real game)

- **Attributes are 5, not "primary + secondary" free picks**: `ATTRS = ["str","dex","int","con","luk"]`
  (`packages/shared/src/leveling.ts:28`).
- **Two of every three points are AUTO-allocated.** `levelUpPlayer` (`packages/server/src/rooms/progression.ts:36-61`)
  grants +1 class attr and +1 requirement attr per level from `classForCharacter(player.character)`,
  and only ONE flex point goes through `chooseAttribute` (`packages/server/src/rooms/GameRoom.ts:1196`).
- **Level cap 30** → at cap: ~29 auto points in the class attr, ~29 in the req attr, ~29 flex picks.
- **Character swap re-aims auto-growth live** — the comment in progression.ts says so explicitly
  ("swapping character (C) re-aims future growth").
- `SCHEMA_VERSION` is currently **18** (`packages/shared/src/constants.ts:13`) — not 17 as the panel
  brief assumed. Whoever lands synced ultimate state takes **19** and must coordinate with the
  enemy-combo wave running in parallel.
- `ACTION_MSGS_PER_TICK = 8` (`constants.ts:137`); beams deliberately start/stop through **input
  state**, not action messages (`GameRoom.test.ts:2964`), so they can't be budget-starved or spammed.
- Teleports have exactly one sanctioned mechanism: `zeroMoveVel` bumps `teleportSeq`
  (`GameRoom.ts:5186-5200`) and the client hard-snaps (`prediction.ts:254-255`). Beams also re-anchor
  on it (`GameRoom.ts:3098-3145`).
- Beam heat/overheat is fully server-authoritative — that is the house standard for "UI truth."
- The telegraph language just shipped: **white = parryable, red = dodge** (§8, telegraph panel), and
  tough-enemy combos + Serraketh action-tick weak-point play are being designed **right now** around
  players having to respect those telegraphs.

---

## 1. The frequency mapping is decided at the character-select screen, not "throughout the run"

The pitch says the ultimate is earned "based on the stat points you added throughout the run." But
2 of 3 points per level are automatic and keyed to the worn character's class. A Bruiser's top-two
frequency is STR+CON at level 2 and stays STR+CON forever unless the player **fights the system**:

- To change your ultimate you must dump **every single flex point** into one off-class attr, and even
  then you only *tie* the auto attrs (29 flex vs 29 auto), never beat them. **Under this design, ties
  are not an edge case — they are the deterministic end state of the only strategy that expresses
  choice.** If the tiebreak is "first to reach N" or attr-list order, players will discover it and the
  system reads as rigged.
- Conversely, a player who allocates flex the way the stats system *wants* (patching weaknesses,
  grabbing CON to survive) never moves their ultimate at all. **The feature punishes exactly the
  players who use the stat system as designed and rewards monomaniacal dumping.**
- Character swap (C) re-aims auto growth mid-run. So the "identity" the ultimate is supposed to
  crystallize can be flipped by wearing a different character for ten levels. Does the ultimate
  re-derive live? If yes, players will swap-character to fish for the strong ultimate. If no, we've
  added hidden snapshot rules nobody can see.

**Perverse incentives, concretely:**
1. *CON tax*: if the CON ultimate is defensive (it will be — theme), then picking CON to not die also
   locks you out of the fun offensive ultimate. Survival picks become double-punished.
2. *LUK trap*: LUK is a Scoundrel class attr; for everyone else it's a meme dump. If the LUK ultimate
   is strong, the meta becomes "wear Scoundrel, ult, swap back" — the ultimate system becomes a
   character-swap exploit, not a build expression.
3. *Balanced builds get nothing coherent*: a genuinely spread build ends in a 3-way tie decided by
   tiebreak trivia. The one playstyle the attribute system currently supports best has the least
   legible ultimate outcome.

**Demand**: before any VFX work, the panel must produce the exact mapping function
`(str,dex,int,con,luk) → (primaryUlt, secondaryMod)` including tiebreak, and simulate it against the
three canonical builds (pure class-follow, full flex-dump, balanced). If two of the three land on the
same ultimate, the premise has failed and we should map ultimates to something the player actually
chooses (e.g., a pick at level 10/20, weighted by stats) instead of inferring intent from frequency.

## 2. Each example ultimate cannibalizes a system we just paid for

- **Far teleport on cursor** deletes the positioning game. The entire §8/telegraph investment — red
  dash lanes to thread, quake rings to jump, Colossus footstep zones — assumes escape is *earned* by
  reading and moving. A cursor-range blink is a universal "I ignore the telegraph" button. It also
  guts jump (Space) as the vertical dodge verb. If it ships, it needs range short enough that it does
  NOT clear the largest red AoE at its edge (measurable: teleport range < 0.8× the widest shipped red
  zone radius, currently the Colossus quake), and it must not grant i-frames during travel.
- **Alpha strike (untargetable multi-dash)** is aimed at the throat of the parallel tough-enemy-combo
  work. Those enemies exist to force sustained engagement: parryable flurries (`enemies.ts:394-400`),
  Serraketh's action-tick weak-point rhythm. An untargetability window + auto-multi-hit is "skip the
  combo, skip the weak-point dance." If bosses/toughs are not tagged with hard target caps and damage
  caps per ultimate, the marquee fights become ult-dumps. Also: untargetable ≠ uncollidable —
  player-player body collision is load-bearing in prediction (`prediction.ts:129`), so "phase through"
  needs an explicit collision-mask story, not a boolean.
- **Fireball** vs the beam. We just shipped charge/sustain/overheat beams with authoritative heat as
  the INT-flavored power fantasy. A big-nuke projectile ultimate for INT is the same fantasy with
  less counterplay, and it competes for the projectile budget (`hostileProjectileCount` discipline
  exists for a reason — a 4-player fireball volley plus explosive-gun chains is exactly the flake we
  just pinned in tests). If INT's ultimate isn't *beam-shaped* (e.g., a heat-free overdrive window),
  we're admitting the beam identity didn't land.
- **Phase attack** is the vaguest and therefore the most dangerous: "phase" implies ignoring
  collision, which touches SpatialGrid queries, contact damage, projectile ownership, and the
  prediction contract simultaneously. Vague pitch + five subsystems = the feature that slips a week.

## 3. Charge economy will be farmed unless it's designed against farming on day one

Any "charge by doing X" meter in a bullet-heaven is a faucet attached to infinite trash:

- **Trash-farming**: if charge scales with kills or damage dealt, dense waves = permanent ultimate
  uptime, and the ultimate becomes a rotation button, not a moment. Charge must come from something
  rate-limited (time-gated trickle + bounded combat bonus with per-second caps), and the cap math
  must be written down: **target ≤ 1 ultimate per player per 60–90s at expected cap-level kill
  rates, verified by a sim test, not vibes.**
- **Co-op charge stealing**: if charge is fed by kills/last-hits, four players compete for the same
  trash and the melee Bruiser starves the ranged INT player or vice versa. Charge sources must be
  personal (own damage, own parries, time) — never shared-pool or last-hit.
- **Training/debug leak**: `debugSpawn` exists (`GameRoom.ts:1180`) — charge gain must be disabled or
  irrelevant in training mode or we ship a free pre-charged ultimate into every run start if any
  state carries over.
- **Death/DC laundering**: define now whether charge survives death, disconnect-rejoin, and character
  swap. Every one of those is an exploit surface if "yes" is chosen by accident.

## 4. Netcode traps, per archetype — none of these are optional

- **Far teleport**: MUST reuse `zeroMoveVel` + `teleportSeq` (`GameRoom.ts:5186-5200`). Cursor point
  is a client claim — server clamps to max range, re-validates against arena bounds and (decide!)
  wall/POI collision, and the beam anchor logic (`GameRoom.ts:3098`) already expects the seq bump.
  Any bespoke "set x/y" path will ghost-glide on the owning client — we have a test proving the
  contract (`GameRoom.test.ts:1015`); the ultimate needs its own.
- **Phase/dash**: i-frame windows must be server-ticked numbers like parry's, never client timers.
  The dash path must be swept server-side (the beam's swept-capsule precedent) or a 20Hz tick will
  tunnel through enemies and, worse, through red zones — accidentally granting the dodge-everything
  button we said we wouldn't.
- **Alpha strike**: server picks targets (SpatialGrid query with a hard target cap), server drives
  the hop sequence on the action-tick model like Serraketh — the client only renders. Per-target hit
  caps and a "no re-stun within X ms" rule or four alpha strikes chain-stun a tough through its
  entire combo, which is the anti-pattern the combo work exists to prevent.
- **Fireball**: counts against the same projectile budget as everything else; explosion applies
  through the existing AoE damage path (one damage event per enemy per blast — the explosive-gun
  RNG-cause pinning we just did is the cautionary tale).
- **Activation transport**: an ultimate press is a one-shot — it should be a **budgeted action
  message** (`takeAction`, like `chooseAttribute`), NOT held input state; but its *aiming* (if any)
  rides existing input fields. Do not invent a third transport.
- **Schema**: every synced field (charge, ready, active-until, ultimate id) appends to PlayerState
  and bumps `SCHEMA_VERSION` → **19**, coordinated with the enemy-combo wave in the same window.
  Two branches both writing 19 with different field sets is a guaranteed corrupt-state report.

## 5. Readability at max chaos — ally ultimates must lose the argument with enemy telegraphs

"Pinnacle special effects" is where this feature kills players who did nothing wrong. Four
simultaneous ultimates + a tough combo + a boss phase is the design-max screen. Non-negotiables:

- Ally ultimate VFX render **below** the telegraph layer, always. White/red telegraph reads must
  survive a fireball detonation on top of them. This is a named layer contract in
  `vfx-layers.js` — not a per-effect judgment call.
- No full-screen flashes, no screen-shake stacking beyond the existing shake budget, no palette
  collisions with white (parryable) or red (dodge). Pinnacle ≠ opaque.
- Photosensitivity: the biggest effect in the game must respect a flash-rate cap. This is also the
  accessibility checkbox for the feature, alongside a rebindable key.

## 6. New-button cost

WASD + Space + RMB (hold-charge!) + LMB + E + C is already dense. The obvious candidates collide:
Q/R conflict with nothing today but F is near-universal genre convention; whatever is picked must be
rebindable and must not fire during beam-channel unless we define what happens to heat mid-cancel
(define it: ultimate cancels the beam through the normal release path, heat persists). Discoverability:
if the ultimate unlocks silently at some frequency threshold, nobody will know why they got it —
the unlock moment needs an explicit authoritative event and UI, which is more schema, more scope.

---

## Hard measurable guardrails

| # | Guardrail | Measure |
|---|-----------|---------|
| G1 | Mapping function is deterministic, tie-broken by explicit rule, published in shared/ | Unit test: 3 canonical builds → 3 distinct, documented outcomes |
| G2 | Ultimate frequency of use | ≤ 1 per player per 60s sustained; sim test at cap-level kill rates |
| G3 | Teleport range | < 0.8× largest shipped red-zone radius; no i-frames in transit |
| G4 | Alpha strike | Server target cap ≤ 5; per-target ≤ 1 hit per hop; toughs/bosses stun-immune to it or per-target stun ICD ≥ 2s |
| G5 | Fireball | Counts in projectile budget; ≤ 1 damage event per enemy per blast |
| G6 | Phase/dash | Swept server-side; i-frame window a server tick count ≤ parry's window |
| G7 | Charge sources | Personal-only (own damage/parries/time); zero gain in training mode; defined on death/DC/swap |
| G8 | VFX | Ally ultimate layers strictly below telegraphs; no white/red palette collision; flash-rate cap |
| G9 | Input | One rebindable key; activation = budgeted action message; beam-cancel semantics defined |
| G10 | Schema | All new synced fields appended; SCHEMA_VERSION 19 coordinated with the parallel combo wave |

## Non-negotiable checklist (authoritative data)

The following MUST live server-side on PlayerState / room state, mirrored to clients read-only
(the beam-heat standard — the client renders it, never computes it):

- [ ] `ultCharge` (server-accumulated; client never adds to it)
- [ ] `ultReady` / cooldown timestamp (server tick time, not wall clock)
- [ ] resolved ultimate id (server derives from attrs; client never sends "which ultimate I have")
- [ ] active-effect window (start tick + duration for i-frames/untargetability — server ticks only)
- [ ] teleport destination (server-clamped; applied via `zeroMoveVel` + `teleportSeq`)
- [ ] alpha-strike target list + hop schedule (server-selected, action-tick driven)
- [ ] all damage/stun/knockback from ultimates through the existing combat receipt path
- [ ] activation gated by `takeAction` budget + `ultReady` check (reject, don't trust)
- [ ] SCHEMA_VERSION bump + client mismatch reload path exercised
- [ ] regression tests: teleportSeq hard-snap for the ultimate teleport; charge-cap sim; alpha-strike
      target-cap; fireball single-damage-event; training-mode zero-charge

**Kill criteria** (walk away or redesign if): the mapping sim shows class auto-allocation determines
the ultimate for ≥ 2 of 3 canonical builds; playtest shows toughs/bosses dying inside ultimate
windows without their combo/weak-point mechanics firing; or the frame budget at 4-player
max-chaos with two simultaneous ultimates drops below the current floor.
