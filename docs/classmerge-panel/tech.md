# Class Merge — Tech Spec

Panel: classmerge (universal kit: parry + dodge roll for everyone · classes stop gating anything ·
characters = stat spreads + quirks). Role: TECH IMPLEMENTER · Target: server-authoritative 20Hz sim
+ client prediction.
Read basis: `character-classes.ts` + `characters.ts` end to end + every `classAttr`/`classForCharacter`
consumer (grep-verified complete: progression.ts:4/45-47, GameRoom.ts:63/4334, ArenaScene.ts:29/7806-7809,
level-up-model.ts:15/380/396-397, leveling.ts:36-41), the parry implementation (GameRoom.ts:808-829,
executeParry 5369-5388, resolveParry 5725-5783, applyParryAugments 5393+), `movement.ts` +
`prediction.ts` end to end, the InputCmd path (GameRoom.ts:716-761, consume ~2240), ALL 11
`damagePlayer` call sites (grep-verified exhaustive), `augments.ts` gate machinery (286-315),
`docs/jumpfeel-panel/tech.md` (stance machine, stanceSeq), `docs/enemycombo-panel/tech-implementer.md`
(v19 claims, juggle channels), `docs/ultimate-panel/tech-server.md` (allocFlex law),
`docs/dualwield-panel/tech-server.md` (schema ledger), `docs/classmerge-panel/devils-advocate.md`
(premise corrections + guardrails — incorporated throughout, marked [DA]).

---

## 0. Premise corrections banked first ([DA] §0 — all verified against the tree)

1. **Parry is ALREADY universal.** The `"parry"` handler (GameRoom.ts:808-829) checks
   alive/budget/window/cooldown — never weapon class, never character class. The merge adds ONE new
   verb (the roll), not two.
2. **The caster mechanic ALREADY rides the weapon.** RMB bolt, cooldown, pierce, INT grades all
   live on `WeaponDef.cast` + `tags.classPool === "caster"` (weapons.ts:192-214, 1012-1081; fire
   gate GameRoom.ts:2545-2551; beam-overcharge gate 3115-3118). **There is no caster-mechanic code
   move.** What dies is the free INT *feed* (caster characters auto-growing INT) — that is an
   economy hole with a named mitigation (§2.4), not a migration.
3. **Augment gates are ALREADY weapon-delivery gates** (`augmentGateForWeapon`, augments.ts:288-300,
   snapshotted at earn-time via `sigGateQueue` — the G-09 beam-fix pattern, progression.ts:51-56).
   Character class never enters. The generalization the directive asks for is DONE; this wave's job
   is to **not break it** (§1.2 KEEP list).
4. **Dodge does not exist**, by written law: constants.ts:372-373 — the jump is "PURE movement, NOT
   a dodge (no i-frames — the parry stays the only defensive tool)". This wave repeals that line
   explicitly (the comment is rewritten, not orphaned — [DA] guardrail 1).

Existing substrate the roll extends (never replaces):

| Need | Precedent | Where |
|---|---|---|
| Timed authoritative i-frame verb | parry: immediate grant on accept, generous 0.52s window (10 ticks), buffered on cooldown, server-owned | GameRoom.ts:808-829, 5369-5388; constants.ts:608-636 |
| Committed-movement stance + steering override | jump wave: `CombatState.stance` 0-3, frozen `dashDirX/Y` + `dashSpeed`, synced `moveStance`, `stanceSeq` soft-resync | jumpfeel-panel/tech.md §2.1-2.2, §3.3 |
| One-shot input edge on the acked timeline | `cmd.jump` (GameRoom.ts:2242-2245), the jump wave's `pound` | tech.md §1.3 |
| Deterministic pending replay of unsynced timers | `PendingPredCmd.jumpCdBefore/jumpBufBefore` | prediction.ts:79-93 |
| Snapshot-at-edge anti-rewrite | `sigGateQueue` (G-09) — the C-key identity lock reuses this posture | progression.ts:51-56 |
| Data-driven per-entity behavior without scattered ifs | boss primitives' emit-sink; `TOUGH_COMBOS` module library | boss-primitives.ts, enemy-combos plan |

---

## 1. THE DISSOLUTION MIGRATION

### 1.1 Every character-class consumer and its fate

| Consumer | Where | Fate |
|---|---|---|
| `CharClassId`, `CharClassDef`, `CHAR_CLASSES` | character-classes.ts:21-71 | **DELETE** (types + the 5 archetype defs + blurbs) |
| `CHARACTER_CLASS` 40→5 map | character-classes.ts:74-120 | **RE-SOURCE**: rename to `CHARACTER_LINEAGE` — it stops gating growth and becomes the quirk/spread bucket key (§6). The data survives verbatim; only its meaning changes. |
| `classForCharacter()` | character-classes.ts:123-125 | **DELETE**; replaced by `lineageForCharacter()` + `spreadForCharacter()` + `quirkForCharacter()` in the renamed file |
| `isPlayableCharacter()` | character-classes.ts:17-19 | **KEEP verbatim** (untrusted-id guard for devEquip/cycleCharacter; unrelated to class) — stays in the same hand-maintained, generator-safe file |
| The file itself | character-classes.ts | **RENAME → `character-kit.ts`** (spreads + quirks + lineage + the id guard). Hand-maintained home survives the roster generator by the same rule as today (its own header, line 11) |
| `levelUpPlayer` auto-allocation | progression.ts:45-47 (+ import line 4) | **DELETE** the two `allocate(cls.*)` calls → §2.1 |
| Flex-timeout default → classAttr | GameRoom.ts:4334 (+ import line 63) | **RE-SOURCE** → `defaultFlexAttr(player)` (§2.3) |
| HUD class label "…[Bruiser] — grows STR" | ArenaScene.ts:7806-7809 (+ import 29) | **RE-SOURCE** → `[quirk name]` from `runCharacter` (§1.4); no "grows X" clause |
| Level-up auto-growth banner | level-up-model.ts:380, 396-397 (+ import 15) | **DELETE** `autoAttribute`/`automaticGrowth` from `levelBuildContext`; the window now presents "3 POINTS" (§2.2). The rest of `levelBuildContext` (weapon grades, set text) is weapon-sourced — KEEP |
| `M0_CLASS_ATTR`/`M0_REQ_ATTR` | leveling.ts:36-41 | **DELETE** (already dead — zero consumers, grep-verified; only a comment in character-classes.ts references them) |
| §12/§38 doc comments ("1 auto class-attr + 1 auto req-attr + 1 flex") | leveling.ts:3-5, state.ts:62-64 (flexPending), characters.ts:1-4 header, DIMENSION_DRIFTERS_MASTER_SPEC.md §38 | **REWRITE** to the universal-kit law in the same commits that change the code they annotate |
| constants.ts:372-373 "parry stays the only defensive tool" | constants.ts | **REPEAL explicitly**: rewrite to the §3.2 channel-split law (jump = movement, parry = WHITE + rewards, roll = RED-projectile/melee escape, no overlap of rewards) |
| Character card blurbs (`CHAR_CLASSES[x].blurb`) | character-classes.ts:41-69 → client card | **RE-SOURCE** → `QuirkDef.blurb` (§6); the card redesign is the client wave's one real UI task |

### 1.2 The KEEP list — the grep hazard, named ([DA] §6, guardrail 3)

**Nothing named `classPool` or `classCount` may change in this wave.** These are WEAPON-taxonomy
symbols that carry surviving build identity, not character-class symbols:

- `WeaponDef.tags.classPool: "melee" | "ranged" | "caster"` (weapons.ts:267) — feeds set bonuses
  (`weaponSetBonus`/`classCount`, weapons.ts:338-360), loot glyphs (`PickupState.weaponClass`,
  state.ts:246-248; ArenaScene.ts:2060, 2434), loot medians (loot.ts:249-267), the cast fire gate
  (GameRoom.ts:2546), the beam-overcharge gate (GameRoom.ts:3116), and `augmentGateForWeapon`.
- `augmentGateForWeapon` + `sigGateQueue` + `augmentDeliveriesForGate` + `draftAugments` weapon
  lanes (augments.ts:261-315) — **untouched end to end**. The parry-lane augments stay universal
  (they already are, because parry is). The `AugmentGate` enum does NOT grow a "roll" lane in this
  wave; if a dodge augment lane is ever wanted, it appends a new gate string then (append-only
  enum, the G-09 posture) — decision deferred, string not reserved.
- The migration deletes only: `CharClassId`, `CharClassDef`, `CHAR_CLASSES`, `classForCharacter`,
  and their four call-site files (§1.1). A CI-side tripwire test asserts
  `augmentGateForWeapon(WEAPONS[x])` outputs are byte-identical across the merge for a pinned
  weapon sample (melee/gun/cast/beam/thrown/cast-beam).

### 1.3 Caster INT-feed mitigation — chosen, shipped in 21a ([DA] §5)

The hole: post-merge nobody auto-grows INT, so `cast`/INT-scaled sources (weapons.ts:928, 1012+)
become a trap lane for non-INT builds. **Ship-first mitigation (data-only): INT-forward spreads on
the caster-lineage characters** (§6.2) seed the lane at L1, and the §2.3 timeout default
(`defaultFlexAttr` = the held weapon's best grade attr) means an AFK cast-wielder still grows INT.
**Fallback lever (pre-approved, flag-off):** a floor on `damageMultFromGrades` for `cast`-delivery
sources (weapons.ts:390-405 — `CAST_GRADE_FLOOR`, a min multiplier equivalent to ~a C-grade at the
player's level band) so cast weapons are never dead in hand. The floor ships as a constant + one
`Math.max` in the cast branch, activated only if playtest shows the spread seed is insufficient.
Balance test pins: a 1-INT player's cast bolt damage ≥ floor; an INT-spread character's L1 bolt
matches today's caster-at-L1 within ±10%.

### 1.4 The C key — the live-respec exploit, ruled ([DA] §3.3; the panel signs this)

**Ruling: identity snapshots at the run boundary; C mid-run is cosmetic.**

- Server-private `identityCharacter` captured at join, `restartRun`, and rift descent **is the
  quirk/spread source** for the whole run. `cycleCharacter` (GameRoom.ts:1021) mid-run changes
  `player.character` (the skin every client renders) but NOT the identity. No stat re-base, no
  quirk swap, no Harvest-LUK/boss-slam-CON swap exploits — the exploit class is closed by
  construction, the same snapshot-at-edge posture as `sigGateQueue`.
- **Training mode re-snapshots on every cycle** (and `devEquip` with a `character` always
  re-snapshots) so the dev portal and Testing Grounds iteration keep full-identity swapping —
  `?dev=char:<id>` deep-links (MenuScene.ts:108-119 → ArenaScene.ts:9063 → devEquip, guarded by
  `isPlayableCharacter`, GameRoom.ts:890) behave exactly as today.
- **Synced field**: `PlayerState.runCharacter` (string, appended) mirrors the identity so the local
  HUD + teammate cards render the true quirk without client-side edge bookkeeping (reconnects,
  late joins). HUD line (ArenaScene.ts:7808) becomes
  `C: <skin name> · KIT: <quirk name (runCharacter)>` — when skin ≠ identity the label shows both,
  which is the honest render of the ruling.
- Spread application: attrs are seeded `1/1/1/1/1 + spread` at the same three snapshot edges
  (join/restart/descent identity capture), then `deriveStats` re-runs (the `allocate` top-up rule,
  progression.ts:21-26). A training-mode identity swap re-bases by the spread DELTA
  (`attr += newSpread[a] − oldSpread[a]`), preserving allocated points, then re-derives maxHp.

---

## 2. THE ALLOCATION ECONOMY (sub-wave 21a)

### 2.1 `levelUpPlayer` — the removal

progression.ts:42-48 becomes:

```ts
// §12 (classmerge): ALL 3 points are the player's. No auto-growth; characters differ by
// starting spread + quirk (character-kit.ts), never by growth direction.
player.flexPending += POINTS_PER_LEVEL; // shared constant = 3
```

`classForCharacter` import dies; the §8 signature block (lines 49-56) is untouched — the sig gate
snapshot is weapon-sourced and survives verbatim. `consumeFlex` (28-33) is untouched: it already
refreshes `flexTimer = LEVELUP_WINDOW_SECONDS` per consumed pick while anything is owed, so 3 picks
get up to 5s EACH with zero new window code.

### 2.2 `chooseAttribute` when ALL points are player-chosen — server validation

The handler (GameRoom.ts:1196-1205) needs **no structural change**: `isAttr` narrows the untrusted
field, `flexPending > 0` bounds spend, `takeAction` budgets floods, `consumeFlex` + `syncFlexTimer`
close the loop — all per-point, so 3 rapid messages/level are already valid and budget-safe
(§44 budget is per-tick, and 3 messages across a human triple-click span ≥2 ticks). What changes:

- **Timeout auto-resolve resolves ALL owed flex picks in one pass** (GameRoom.ts:4332-4336):
  today's one-per-window loop would freeze an AFK player invincible for 15s/level. New law: on
  timeout, `while (flexPending > 0) { allocate(player, defaultFlexAttr(player), 1); flexPending--; }`
  then the sig auto-pick as today. (The sig pick keeps its own window cycle.)
- **Decision-fatigue mitigation is client-side only** ([DA] §4.1 priced): the level-up UI offers a
  per-attr chip with a `×N` spend-remaining affordance = N `chooseAttribute` messages; no macro
  message, no protocol change. The 3-pick flow is prototyped in the client wave before the panel
  commits ([DA] ship checklist) — the server economy above is identical either way, which is what
  makes the fallback ([DA]'s 2-auto-on-character `growA/growB`) a pure data re-add if playtest
  rejects manual-3: `levelUpPlayer` would re-gain two `allocate` calls reading `spreadGrowth`
  from character-kit.ts. The escape hatch costs nothing to keep alive.

### 2.3 The orphaned default → `defaultFlexAttr` ([DA] §4.2)

New pure shared helper in `leveling.ts` (or weapons.ts, beside `weaponDamageMult`):

```ts
/** AFK/timeout flex default: the held weapon's best scaling-grade attr (its primary source's
 *  grades, the §14 inheritance chain), falling back to CON (survivability is never a dead pick). */
export function defaultFlexAttr(def: WeaponDef | undefined): Attr; // pure, unit-tested
```

Grade rank S>A>B>C>D>E, tie-break by ATTRS order. GameRoom.ts:4334 becomes
`allocate(player, defaultFlexAttr(WEAPONS[player.weapon]), 1)` inside the §2.2 drain loop. This
feeds the caster mitigation (§1.3) and is the exact value the ultimate panel's AFK clause re-bases
onto.

### 2.4 The ultimate wave's flex counters become TOTAL counters — the exact code, named

The ultimate tech-server doc (docs/ultimate-panel/tech-server.md:35-55, 80-86, 369-391) plans:
`allocate(player, attr, n, source: "flex" | "auto" = "auto")` + server-only
`allocFlex: Record<Attr, number>` + `archetypeForAllocation(allocFlex)` + `ULT_UNLOCK_ALLOCS ≈ 6`.
Post-merge there is no "auto" source. **The ultimate wave must adjust, by name:**

1. **`allocate` keeps its current 3-arg signature** (progression.ts:21) — the `source` parameter is
   never built. Every level-path allocation increments the counter.
2. `allocFlex` → **`allocRun: Record<Attr, number>`** (total run allocations; timeout defaults
   count — they are the player's standing order, same as the old AFK-flex rule at
   ultimate-designer §1.1's AFK clause, now §2.3's helper).
3. `archetypeForAllocation(allocRun)` — same ranking/tie-break machinery, but tie-break rules 2-3
   of `docs/ultimate-panel/designer.md` §1.4 ("the worn character's classAttr, then reqAttr")
   re-base to **the identity character's spread bias** (highest spread attr of `identityCharacter`,
   §6.2), then raw totals.
4. `ULT_UNLOCK_ALLOCS` re-tunes ×3 (≈ 15-18) so attune/temper stay at the L6/L11 band the §1.3
   pacing table was authored for — or the triggers move to level thresholds directly ([DA] §4.3's
   two options; the ×3 spend count is my recommendation because it keeps "the ultimate is built
   from choices" true).
5. **Doc amendment gate:** `docs/ultimate-panel/designer.md` §1.1 (what counts) / §1.3 (pacing) /
   §1.4 (tie-breaks) / the AFK clause are amended when 21a lands and BEFORE any ultimate
   implementation wave starts ([DA] §4.3, guardrail 6). The amendment is part of 21a's deliverable.

---

## 3. THE DODGE ROLL (sub-wave 21b)

### 3.1 Stance-machinery verdict: RIDE IT — the roll is a stance, not a system

The jump wave ships exactly the machine a roll needs (tech.md §2.1-2.2): server-private
`CombatState.stance`, frozen-direction steering override (`dashDirX/Y`, `dashSpeed`), synced
`moveStance` (remote pose byte), and `stanceSeq` (the soft stance-resync signal built for forced
cancels). **Rolling = `STANCE_ROLL = 4`** on that machine. It structurally cannot land before the
jump wave without building the same machinery twice ([DA] §7.1) — that ordering is a hard gate.

**The two-dash-verbs objection, answered in one signed paragraph ([DA] guardrail 2):** the
crouch-dash and the roll share ONE implementation (a steering-override stance through the shared
stance step) but are kept as distinct stances because their grammars and jobs are disjoint: the
dash is a hold-commit, 260px, AIRBORNE pit-crosser with no i-frames on a 2.5s cooldown (a route
verb — it answers geography); the roll is a one-shot, ~150px, GROUNDED burst with a 0.25s i-frame
window on a 1.25s cooldown (a threat verb — it answers projectiles and locked melee sectors, and
explicitly does NOT clear pits or quakes). Merging them ("dash gains i-frames") would put i-frames
on the pit-crossing route verb and hand the quake/RED-AoE answer to a 260px flight — precisely the
telegraph-redefinition [DA] §2.3 forbids. Two stances, one machine, zero duplicated code.

Reuse inside `CombatState`: `dashDirX/dashDirY/dashSpeed` are reused for the roll's frozen
direction (stances are mutually exclusive, so the fields time-share). New fields (server-private,
no wire): `rollT: number` (seconds since roll start — derives the i-frame window and the stance
exit) and `rollCd: number` (aged beside `jumpCd`/`distJumpCd` at GameRoom.ts:2465-2469), plus
`rollBuffer: number` (the parry-buffer de-clunk, constants precedent PARRY_BUFFER_SECONDS).

### 3.2 Server state machine + the channel-split law

Commit (consume of `cmd.roll`, all laws re-checked at consume — the anti-cheat posture):
`alive && !inLevelWindow && stance === 0 && height <= GROUND_EPSILON && rollCd <= 0 &&
recoveryT <= 0` (a buffered press waits in `rollBuffer` like parry's). On commit:
`stance = STANCE_ROLL`, `rollT = 0`, `rollCd = ROLL_COOLDOWN`, direction = unit of the consume
tick's held `(dx,dy)` → fallback current steering heading `(input.mvx, input.mvy)` → fallback
`aimDir`; `dashSpeed = ROLL_SPEED`; `moveStance = 4`; **beam channel cancels** (`cancelBeam`, the
executeParry precedent at 5370). During the roll the movement phase overrides steering with the
frozen constants (the dash's exact mechanism); `attackBuffer`/`parryBuffer` queue normally and fire
when the stance exits (buffered, never eaten — v0.105 law). At `rollT ≥ ROLL_DURATION`: stance 0,
steering continues at `rollDir × MOVE_SPEED` (momentum, no hitch — the dash-landing rule).

Constants (shared, all `[tuning]`): `ROLL_DURATION = 0.30` (6 ticks), `ROLL_IFRAME_SECONDS = 0.25`
(5 ticks — granted from the consume tick, so it swallows the ~2-tick RTT gap the same way the
parry's deliberately generous 0.52s does; [DA] §7.4's number, written down), `ROLL_SPEED = 500`
(150px displacement — under the dash's 260px, [DA] §2.4), `ROLL_COOLDOWN = 1.25`
(≥ 2× PARRY_COOLDOWN 0.6 — chain-parry stays the high-skill sustain), `ROLL_BUFFER_SECONDS = 0.2`,
`STANCE_ROLL = 4`, `POINTS_PER_LEVEL = 3`, `CAST_GRADE_FLOOR` (flag-off, §1.3).

**The channel-split law ([DA] §2.5, adopted verbatim as the i-frame contract):**

> Parry answers WHITE (and keeps the ENTIRE reward ladder: launch, heal, chain, riposte, deflect,
> augments). Roll answers RED-projectile and locked melee sectors — safety and distance, ZERO
> rewards. Roll i-frames never cover ground AoE/DoT (slams, quakes, beam lanes, ring bands,
> puddles, pits). Roll is unusable while airborne — DI/air-parry stay the only juggle escapes.

**Consequently the roll must NOT write `c.invuln`.** `invuln` IS the parry-reward key: it triggers
`resolveParry` (launch/heal/chain) at 5700/5804, projectile REFLECT at 5928, quake negation +
`acceptWormParry` at 4601-4606. A roll that set `invuln` would accidentally parry. The roll's
window is a derived predicate — no new timer:

```ts
// GameRoom (private helper) — the ONE roll-dodge predicate:
private rollDodged(c: CombatState): boolean {
  return c.stance === STANCE_ROLL && c.rollT < ROLL_IFRAME_SECONDS;
}
```

### 3.3 The i-frame consultation surface — every damage path, enumerated

`damagePlayer` has exactly **11 call sites** (grep-verified exhaustive); the combo wave adds its
juggle branches inside `duelistSwing`. Check ORDER at consulting sites: parry `invuln` first
(reward ladder wins when both are live), then `rollDodged` (negate damage AND the knockback shove,
bump `dodgedSeq`, no other effect), else damage.

| # | Damage path | Where | Roll i-frames? |
|---|---|---|---|
| 1 | Enemy contact DPS | GameRoom.ts:2719-2744 (invuln gate at 2721) | **YES** — add `rollDodged` beside the invuln check; rolling through the horde is the verb's core fantasy, and contact is body-touch, not ground AoE |
| 2 | Hostile projectiles (horde + boss + worm spit) | 5914-5944 | **YES** — after the parry-reflect branch (5928): rolled bullet is NOT consumed (phases on, keeps flying — a dodge, not a block; the reflect stays parry-exclusive) |
| 3 | Duelist melee sweep (+ the combo wave's strike steps, which reuse this branch) | duelistSwing 5696-5718 | **YES** — whiff, no `resolveParry`, no return-step conversion (a roll is not a parry-bait trigger: the bait's read stays meaningful, [DA] §2.1's price) |
| 4 | Juggle LAUNCHER hit (combo wave, in duelistSwing) | enemycombo tech §5 | **YES during i-frames** (dodged = no launch, no `juggledSeq`); a launcher landing in roll RECOVERY force-cancels the stance (rank law below) |
| 5 | Boss melee wedge (incl. worm strikes — the worm's player damage routes here; `acceptWormParry` fires ONLY on parry) | applyBossMelee 5788-5819 | **YES** — same order as #3 |
| 6 | Juggle AIR-KEEP | combo wave | **N/A by construction** — air-keeps hit airborne players; the roll is grounded-only. DI + air-parry remain the only aerial answers ([DA] §2.2) |
| 7 | Boss unparryable AoE (punch-slam) | applyBossAoE 4562-4581 | **NO** (RED ground) |
| 8 | Footfall quake | applyBossQuake 4586-4614 | **NO** — jump clears it, parry negates it; a grounded roll is HIT (and because the roll never writes `invuln`, it cannot accidentally take the quake-parry branch at 4601) |
| 9 | Boss beam/dash lane | damageBeamRect 4618-4640 | **NO** (RED ground/lane) |
| 10 | Boss expanding ring band | damageRingBand 4644-4658 | **NO** (RED ground) |
| 11 | Zoner/boss puddles DoT | stepZones 6161-6185 | **NO** — the "walk out" law (6172-6173) extends to "roll out": the roll moves you 150px, it does not fireproof you |
| 12 | Pit-fall damage / terrain | 2350-2400 (2373/2390) | **NO** — terrain is not dodgeable; a roll whose grounded ticks cross a pit FALLS IN (`isPitAtPx` at grounded ticks — rolls do not clear pits; jump family owns gaps) |

Surface size: **5 consulting sites** (1-5; #4 lands with/after the combo wave), **7 explicitly
unchanged** (6-12). Each unchanged row is an assertion in the test plan, not an omission.

**Cancel/priority laws** (extending the jump doc's §4.1 rank law + §2.3 cancel table):
- Damage during the i-frame window: negated (that's the window). Damage during roll RECOVERY
  (ticks 5-6): lands normally but does NOT cancel the stance (the roll is 0.3s — cancel churn would
  outcost the remaining 2 ticks); a JUGGLE LAUNCHER in recovery force-cancels (launch takes the
  body — rank law, bump `stanceSeq`).
- Level-window freeze edge, death, every `zeroMoveVel` site: stance → 0 (+`stanceSeq`), `rollT`
  cleared, `zeroMoveVel`'s held-reset gains `roll: false` (GameRoom.ts:5194).
- Roll input while another stance is live (crouch/dash/pound) is IGNORED, not buffered across
  stances (one-deep machine, jump doc §2.3-5). Roll input while airborne: ignored (no air-roll,
  no buffer — the airborne answer set is deliberately parry/DI only).

### 3.4 Input encoding — coordination with the jump wave's grammar

**`roll: boolean` — one-shot edge flag on the seq'd InputCmd, the `jump`/`pound` pattern** — never
an `onMessage` action ([DA] §7.1: displacement must be predicted or the roll rubber-bands).
Key: **SHIFT** (`JustDown` → set on the next minted command), added to the ArenaScene `addKeys`
set. Zero collision with the jump wave's Space tap/hold/air grammar — Space's three meanings stay
Space's; the roll takes the one ergonomic free key ([DA] §1.1). The `dodgedSeq`-driven flash plus
the roll pose are the feedback; no legacy message twin is added (the roll is born on the command
stream — there is no pre-existing message to keep compatible).

```ts
// GameRoom InputCmd (~728) + prediction PredCmd + ArenaScene mint (~9442) — appended:
roll: boolean;   // one-shot edge (jump/pound pattern); coerced with === true like jump (747)
```

Direction is server-sampled at the consume tick (§3.2) — the client sends no roll vector (nothing
to trust off the wire beyond the already-clamped `dx/dy`).

### 3.5 Prediction — the roll is client-predicted movement, fully

Against the predictor's steer-every-tick assumption (prediction.ts:127-157 — `stepHorizontal`
steers from each command's `dx/dy`): the roll does NOT fight it, it rides the jump wave's
stance-override mechanism — while the replayed stance is ROLL, the horizontal step's steering is
**overridden to the frozen `rollDir × ROLL_SPEED`** (the dash's exact replay rule, jump tech §3.2),
which keeps every tick a pure function of the command stream. No new velocity-curve channel: the
roll is constant-speed for 6 ticks (a curve would demand a per-tick speed table mirrored in the
predictor — priced, rejected as feel-tuning that can ride `ROLL_SPEED` + duration alone).

- **Predicted**: roll entry (edge flag + `rollCdBefore`/`rollTBefore` rebase points appended to
  `PendingPredCmd` — the `jumpCdBefore` pattern, prediction.ts:79-93), the 6-tick displacement,
  the stance exit, and the LOCAL i-frame display (`rollingIFramed` derived from the predicted
  stance — the client's "I am invincible" render matches the consume tick it predicted).
- **Authoritative-only**: whether a specific hit was dodged (`dodgedSeq` edge → flash), and every
  server-forced cancel — which arrive via the jump wave's `stanceSeq` soft-resync verbatim
  (adopt `moveStance`, clear local stance timers, strip stance-deriving flags — `roll` joins
  `crouchHeld`/`pound` in the strip list). **No new reconciliation concept is introduced**; that
  is the payoff of landing after schema-20 ([DA] §7.2).
- Divergence classes: a denied roll (server saw cooldown the client's replay didn't) surfaces as a
  horizontal residual that glides via the error offset (sub-`INTERP_SNAP_PLAYER`: 150px max, but
  the residual is the per-patch difference, far smaller); a cancelled roll rides `stanceSeq`.
  Rolls never call `zeroMoveVel` (physics, not teleport).

### 3.6 Collision law during the roll

**No pass-through** ([DA] §7.3, adopted): the shared circle-separation solver (collision.ts) and
player-player pushout run unchanged; POI collision (`resolvePoiCollision`) and belt clamps run
every tick of the roll on BOTH ends (the predictor already applies them, prediction.ts:145-155) —
a mid-roll clip resolves identically server/client by construction. Arena/belt bounds clamp the
displacement (rolling into a wall just ends early spatially; the stance still times out). Pits:
§3.3 row 12 — grounded pit checks apply mid-roll. i-frames negate damage only, never geometry.

### 3.7 Remote rendering + schema fields + wire costs

- **Remote pose**: `moveStance = 4` edges drive the roll animation; direction from synced
  `mvx/mvy` (the override is mirrored into them, same as the dash). `stanceSeq` covers forced
  cancels. **Both fields are the jump wave's — the roll adds no stance wire.**
- **New synced field (the roll's only append):**

```ts
// state.ts PlayerState — appended after the jump wave's stanceSeq:
/** Bumped each time an incoming hit is NEGATED by roll i-frames — client fires the dodge flash
 *  (the parriedSeq pattern; cosmetic only, all damage math is server-side). */
@type("uint8") dodgedSeq = 0;
```

- 21a's append (§1.4): `@type("string") runCharacter = "drifter"` — after `sigGateQueue` + all
  fields the v19/v20 waves appended.
- **Wire cost**: `runCharacter` changes ~once per run (~20B once). Roll: 2 `moveStance` edges
  ≈ 4B/roll at a ≥1.25s cadence + `dodgedSeq` ~2B per negated hit — worst case (4 players rolling
  on cooldown through gunfire) **< 40 B/s total**, no per-tick unconditional mutations. The
  dissolution itself is wire-NEGATIVE in spirit: no auto-growth means attr fields change on player
  action instead of 2-per-level-per-player bursts (same bytes, fewer surprise patches).
- **Schema ledger + coordination statement**: committed `SCHEMA_VERSION = 18` (constants.ts:13);
  **19 = enemy-combo** (implementing NOW — owns GameRoom/state/constants/enemies/combat);
  **20 = jump** (claimed, `moveStance/poundSeq/stanceSeq`); **21 = classmerge-21a**
  (`runCharacter`); **22 = classmerge-21b** (`dodgedSeq`); ultimates take next-available after 22
  (its doc already says "claim the next free"); dual-wield's provisional 21 **renumbers behind
  all of these** (its own §14 already commits to yielding: "takes next-available at merge time").
  One wave = one bump; whoever merges later rebases appends after the earlier wave's fields.

---

## 4. QUIRK PLUMBING — the hook table, so quirks never scatter ifs through GameRoom

### 4.1 The pattern

New shared, pure, data-only module (inside `character-kit.ts`):

```ts
export interface QuirkDef {
  id: string; name: string; blurb: string;             // card + HUD strings (§1.1 re-source)
  /** SCALAR HOOKS — plain numbers, multiplied/added at EXISTING computation sites. */
  mods?: Partial<{
    rollCooldownMult: number;      // consulted where ROLL_COOLDOWN is applied (one site)
    parryIFrameMult: number;       // beside Iron Stance's mult (GameRoom.ts:5400 pattern)
    parryKnockbackMult: number;    // resolveParry's ironKnockback line (5735)
    critChanceAdd: number;         // critChanceFor call sites (server-rolled)
    regenMult: number;             // deriveStats consumers
    harvestMult: number;           // the HARVEST_PER_LUK site
    moveSpeedMult: number;         // ⚠ PREDICTOR-VISIBLE — see the mirror law
  }>;
  /** EFFECT HOOKS — rare; fire at named seams and return EFFECT DESCRIPTORS (data), which the
   *  seam applies through existing machinery (the boss-primitive emit-sink posture). Never a
   *  callback that mutates room state directly. */
  hooks?: Partial<{
    onParrySuccess: (ctx: QuirkCtx) => QuirkEffect[];  // seam: end of resolveParry
    onRollEnd:      (ctx: QuirkCtx) => QuirkEffect[];  // seam: roll stance exit
    onKill:         (ctx: QuirkCtx) => QuirkEffect[];  // seam: damageEnemy kill branch
  }>;
}
export const QUIRKS: Record<string, QuirkDef>;
export function quirkForCharacter(id: string): QuirkDef;  // via CHARACTER_LINEAGE; never undefined
```

Laws that keep it clean:
1. **One accessor, cached per identity edge**: GameRoom resolves `quirkForCharacter(identityCharacter)`
   into the player's `CombatState` at the §1.4 snapshot edges (`c.quirk`), so hot loops read a
   field, not a map walk. There is no `if (character === "cc-…")` anywhere — grep-enforceable.
2. **Scalar mods are consulted only at the site that already computes the number** (a `× (c.quirk.mods?.x ?? 1)`
   per site, each site listed in the touch list) — the same shape as Iron Stance's per-stack mults.
3. **Effect hooks return descriptors** (`{ kind: "heal", amount }`, `{ kind: "impulse", … }`)
   applied by the seam through `damagePlayer`/`addImpulse`/existing plumbing — testable as pure
   functions, and the seam list IS the audit surface.
4. **The predictor-mirror law**: any mod that changes PREDICTED movement (`moveSpeedMult`,
   roll-distance-style mods) must be a pure function of the SYNCED `runCharacter` and be threaded
   into the shared steppers' `speed` argument on BOTH ends (the beamSpeed precedent,
   GameRoom.ts:2274-2293 — speed is already a parameter). Ship-first quirk set: **no
   movement-speed quirks** (keep v1 mods off the prediction surface entirely; the law exists for
   when design wants one).

### 4.2 Five lineage quirks vs forty per-character — both priced ([DA] §3.2, guardrail 5)

- **5 lineage-bucket quirks (RECOMMENDED, ship-first)**: `CHARACTER_CLASS` → `CHARACTER_LINEAGE`
  (§1.1) keys 5 `QuirkDef`s (e.g. bruiser-lineage parry-knockback, duelist-lineage roll cadence,
  caster-lineage cast/beam economy, warden-lineage bulwark/regen, scoundrel-lineage crit/harvest —
  designer owns the content). Plumbing cost: the §4.1 table with 5 rows; balance surface 5; card
  redesign renders lineage name + quirk. The 40-char roster keeps flavor grouping without a 40-
  mechanic content cliff.
- **40 per-character quirks**: IDENTICAL plumbing (the table doesn't care — `quirkForCharacter`
  maps id→quirk directly instead of via lineage); the cost is pure content: 40 designed, balanced,
  VFX'd mechanics ≈ 8× the design/test/tuning bill, and every effect hook multiplies the seam
  audit. The architecture supports migrating 5 → 40 later by ADDING rows (lineage becomes the
  default, per-character overrides shadow it) — so choosing 5 now forecloses nothing. Someone
  signs the 8× bill by name before the 40 path opens.

### 4.3 Spreads (the stat half of identity)

`CHARACTER_SPREADS: Record<string, Partial<Record<Attr, number>>>` (character-kit.ts), authored
per LINEAGE for v1 (5 spreads, per-character overrides possible later): each spread sums to the
same total (+3 over baseline) and is **capped at +2 in any one attr** ([DA] guardrail 4), e.g.
caster-lineage `{ int: +2, con: +1 }`, scoundrel `{ luk: +2, dex: +1 }`. Applied at the §1.4
snapshot edges only. Derivation seed: the OLD `classAttr/reqAttr` pairs (bruiser STR+CON, duelist
DEX+LUK, caster INT+CON, warden CON+STR, scoundrel LUK+DEX) become `{classAttr:+2, reqAttr:+1}` —
**the character data migration is mechanical**: the deleted growth table IS the spread table's
first draft, preserving each lineage's day-one feel direction.

---

## 5. DETERMINISTIC TEST STRATEGY

Harness: the established `new GameRoom()` → `onCreate` → fake clients → `room.update(50)` loop;
pinned-position discipline (clear POIs, fill TILE_GROUND, author geometry); pin `Math.random` only
where rolls stack (the eee600a rule). The roll machine is RNG-free (flags + timers).

**I-frame windows PER DAMAGE PATH (one test per §3.3 row — the unchanged rows are assertions too):**
1. Contact: enemy overlapping a rolling player → hp unchanged + `dodgedSeq +1` during ticks 0-4;
   tick 5 (recovery) → damage lands; `parriedSeq` NEVER bumps from a roll.
2. Projectile: hostile bullet into roll → no damage, bullet NOT consumed (still flying next tick),
   no reflect; same bullet into parry `invuln` → reflected (the existing contract, regression-pinned).
3. Duelist sweep: locked arc resolves onto a roller → whiff, no `resolveParry` (no launch/heal/
   chain), no combo return-step conversion; onto a parrier → full ladder (regression).
4. Boss melee/worm wedge: roll → whiff and `acceptWormParry` NOT called; parry → called.
5. Quake: grounded roller in radius → HIT (and no white flash — proves roll never wrote `invuln`);
   airborne (jump) → clears (regression).
6. AoE / beam rect / ring band / puddle DoT / pit damage: rolling player takes them all (five
   one-liners that pin the channel-split law forever).
7. **Roll under juggle**: launcher into roll i-frames → no launch, no `juggledSeq`; launcher into
   roll recovery → stance cancelled + `stanceSeq` bump + launch applies; airborne (juggled) `roll`
   flag → ignored, no buffer.
8. **Cooldown enforcement**: second `cmd.roll` inside ROLL_COOLDOWN → ignored; press during
   cooldown tail → `rollBuffer` fires at drain (the parry-buffer twin); roll during crouch/dash/
   pound → ignored; roll in level window → ignored (frozen).
9. **Pit law**: author a pit strip mid-roll-path → `fellSeq +1` (rolls don't clear pits).
10. **Prediction contracts** (prediction.test.ts mock-server pattern): roll replays byte-exact
    (zero residual, no adopt); a server force-cancel (`stanceSeq` bump) → predictor drops the
    stance, does not resurrect it from pending `roll` flags, error offset glides; a denied roll
    (cooldown skew) folds into the error offset without an `INTERP_SNAP` pop; POI clip mid-roll
    replays identically (shared clamp).

**Migration invariants (character data migration — old rooms/replays don't exist, the data does):**
11. Roster totality: every id in `PLAYABLE_CHARACTERS` has a lineage, spread, and quirk
    (iterates the roster — the generator-clobber tripwire).
12. Spread conservation: every spread sums to +3, no attr > +2; join/restart applies spread once
    (attr totals = 1+spread+allocated, pinned at L1 and after 4 level-ups = +12 player points).
13. Economy: `levelUpPlayer` grants `flexPending += 3`, allocates nothing; timeout drains ALL owed
    flex into `defaultFlexAttr` in one window; `defaultFlexAttr` unit tests (S>A grade rank, cast
    weapon → int, ungraded → con).
14. C-key ruling: mid-run `cycleCharacter` changes `character` but not `runCharacter`/spread/quirk;
    training-mode cycle re-snapshots (spread delta applied, allocated points preserved, maxHp
    topped); `devEquip` invalid id rejected (`isPlayableCharacter` survives).
15. Gate tripwire: `augmentGateForWeapon` outputs byte-identical for the pinned 6-weapon sample;
    `sigGateQueue` snapshot flow untouched (existing G-09 tests stay green unmodified — that they
    NEED no edits is itself the assertion).
16. Caster floor (when flagged on): 1-INT cast bolt ≥ floor; INT-spread L1 bolt within ±10% of the
    pre-merge caster L1 baseline.

---

## 6. FILE / FUNCTION TOUCH LIST

**21a — economy + dissolution** (schema 21):
- `packages/shared/src/character-classes.ts` → **rename `character-kit.ts`**: delete
  `CharClassId/CharClassDef/CHAR_CLASSES/classForCharacter`; keep `isPlayableCharacter`; add
  `CHARACTER_LINEAGE` (renamed map), `CHARACTER_SPREADS`, `QUIRKS`, `quirkForCharacter`,
  `spreadForCharacter`, `QuirkDef/QuirkCtx/QuirkEffect`.
- `packages/shared/src/leveling.ts` — delete `M0_CLASS_ATTR/M0_REQ_ATTR`; add `POINTS_PER_LEVEL`,
  `defaultFlexAttr` (or weapons.ts); rewrite the §12 header.
- `packages/shared/src/state.ts` — append `runCharacter`; rewrite the flexPending comment.
- `packages/shared/src/constants.ts` — `SCHEMA_VERSION = 21`; `CAST_GRADE_FLOOR` (flag-off).
- `packages/shared/src/index.ts` — re-exports; `packages/shared/src/character-kit.test.ts` — NEW.
- `packages/server/src/rooms/progression.ts` — §2.1 removal; `progression.test.ts` re-pins.
- `packages/server/src/rooms/GameRoom.ts` — import 63; identity snapshot at join/restart/descent
  + `cycleCharacter` (1021) / `devEquip` (890) ruling; timeout drain + `defaultFlexAttr` (4334);
  quirk cache on `CombatState` + the §4.1 scalar sites (parry mults 5400/5735).
- `packages/client/src/ui/level-up-model.ts` — drop `autoAttribute/automaticGrowth`; 3-pick model.
- `packages/client/src/scenes/ArenaScene.ts` — HUD line 7806-7809 (skin + KIT label); level-up UI
  ×N spend affordance; character-card blurb re-source.
- `docs/ultimate-panel/designer.md` — the §2.4 amendments (§1.1/§1.3/§1.4/AFK), same deliverable.
- `DIMENSION_DRIFTERS_MASTER_SPEC.md` §38 — rewritten to the universal kit.

**21b — dodge roll** (schema 22, AFTER the jump wave):
- `packages/shared/src/constants.ts` — `ROLL_*`, `STANCE_ROLL`, `SCHEMA_VERSION = 22`; repeal/
  rewrite constants.ts:372-373.
- `packages/shared/src/state.ts` — append `dodgedSeq`.
- `packages/shared/src/movement.ts` — extend the jump wave's shared stance step (`stepJumpStance`
  → `stepStance`) with the ROLL branch; unit tests beside it.
- `packages/server/src/rooms/GameRoom.ts` — `InputCmd.roll` (~728/747); consume latch (~2242);
  `CombatState.rollT/rollCd/rollBuffer` + init (~2036); movement-phase override (~2283); timer
  aging (~2465); the 5 consulting damage sites (§3.3 #1-5) + `dodgedSeq` bumps; `zeroMoveVel`
  held-reset (5194); beam cancel on commit; NEW `GameRoom.roll.test.ts`.
- `packages/client/src/net/prediction.ts` — `PredCmd.roll`, `PendingPredCmd.rollCdBefore/
  rollTBefore`, stance-4 replay override, `roll` in the `stanceSeq` strip list; tests.
- `packages/client/src/scenes/ArenaScene.ts` — SHIFT sampler → mint (~9442); local/remote roll
  pose off predicted stance / `moveStance`; `dodgedSeq` flash; help strings.

---

## 7. THE WAVE TRAIN — full ordering across all five features, no deadlock

Two hard gates ([DA] §9, adopted): **jump(20) before classmerge-21b** (the stance machine + the
InputCmd/prediction/`stanceSeq` rails — dodge structurally cannot precede it), and
**classmerge-21a before ANY ultimate implementation** (the allocation law is the ultimate's
denominator; §2.4 amendments land with 21a).

| Order | Wave | Schema | Locks | Can start when |
|---|---|---|---|---|
| 1 | **enemy-combo** (NOW) | 19 | GameRoom, state, constants, enemies, combat | in flight |
| 2 | **jump J1** (shared) → **J2** (server) | 20 | constants, state, movement / GameRoom | after combo's shared+server merge |
| 2∥ | **jump J3** (client) | — | prediction, ArenaScene | after J1 |
| 3∥ | **classmerge-21a** (economy + dissolution + ultimate doc amendments) | 21 | character-kit, leveling, progression, level-up-model + small GameRoom/ArenaScene touches | after combo merges — runs PARALLEL with J2/J3 (file overlap is only GameRoom line 63/4334 + one ArenaScene HUD line vs J3's input/pose regions; 21a rebases those two touches last, or serializes behind J2 if the seat count forces it) |
| 4 | **classmerge-21b** (dodge roll) | 22 | GameRoom, movement, prediction, ArenaScene | after J2 AND 21a merge (hard gate 1) |
| 5 | **ultimates** | 23 (next-avail) | progression, GameRoom, state, constants, new ult modules | implementation only after 21a (hard gate 2) + after 21b's GameRoom lock frees (the ult must spec against the FINAL kit: roll i-frames vs ult invuln is one written law, and its shared/design waves can proceed in parallel from 21a's merge) |
| 6 | **dual-wield** | 24 (its doc already yields/renumbers) | GameRoom attack pipeline, PlayerState appends, client | after ultimates' server wave (both append PlayerState + rework the tick's player loop; dual-wield's own plan puts its schema wave "rebases last") |

Parallelizable at any time: jump J3 ∥ 21a; ultimate design/shared prep ∥ 21b; dual-wield curation/
design ∥ everything. Golden phase-order fixtures re-record at most twice (jump J4, 21b if the
stance step shifts internals — expected no-op both times). CI is the arbiter (`pnpm lint` CRLF
false-negative locally, per project memory).
