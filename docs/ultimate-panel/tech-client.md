# Client Tech — ULTIMATE Abilities

Role: client tech implementer on the ultimate panel. Everything below is grounded in the settled code
on `feat/v0.117-feel-and-colossus` (verified 2026-07-16). Cross-references the devil's-advocate
guardrails (G1–G10, `docs/ultimate-panel/devils-advocate.md`) where they bind the client. I do not
re-litigate the mapping-function debate — I specify how the client presses, predicts, renders, and
tests whatever the server panel lands, on the assumption that every field of ultimate truth (charge,
ready, resolved id, active window) is server-authoritative per the beam-heat standard.

Vocabulary used throughout, matching the shipped schema (`packages/shared/src/state.ts`):
proposed synced fields on `PlayerState` are `ultId` (resolved archetype), `ultCharge` (quantized
`uint8` 0–100, the `integrityQ`/`armorQ` precedent), `ultSeq` (`uint32`, bumps once per accepted
activation), `ultTick` (`uint32`, acceptance tick — the `attackTick` twin), `ultTargetX/Y`
(server-clamped), and `ultActiveUntilTick` for windowed archetypes. Server panel owns the exact set;
SCHEMA_VERSION → 19 coordination is G10.

---

## 1. THE NEW BUTTON

### Recommendation: **F**, tap-to-cast (JustDown), aim = cursor. Rebindable later.

**The real current bindings** (from `ArenaScene.ts:1674-1676` key registration plus the update-loop
handlers at `:2972-3104` and the pointer paths at `:6396` / `:6568` / `:9284`):

| Input | Bound to |
|---|---|
| W/A/S/D | movement (seq'd input cmd, `:9420`) |
| SPACE | jump — intent RIDES the next seq'd cmd (`:3038`, `jumpQueued`) |
| RMB | fire / **hold-to-channel beam** via `fireHeld` input state (`:9435`) |
| LMB | parry (`sendParry`, `:6562`) |
| R | grab / tap-drop / hold-salvage (`:3006-3035`) |
| E | interact-grab near pickup; else cycle/browse (`:3043-3063`) |
| Q | cycle weapon / gallery page (`:3050-3072`) |
| 1/2/3 | belt arsenal slots (`:3056-3059`); 1–5 also level-window picks (`:5350`) |
| TAB | belt bag / training summon menu (`:3082-3091`) |
| F | **belt-only** shopkeeper trade, gated on `nearShop` (`:3093-3101`) |
| T / B / C / M | training toggle / dev boss / character swap / mute |
| Arrows+ENTER | level-window navigation (`:5315-5332`) |

**Why F:**
- It is the only near-WASD key that is free in the modes where ultimates matter. Its sole binding
  today is the belt shopkeeper trade, and that is already proximity-gated (`nearShop`,
  `SHOP_RADIUS`) — a deliberate non-combat pocket.
- It is reachable without lifting fingers off WASD/Space, which matters because every archetype aims
  with the cursor (right hand is committed to the mouse; both mouse buttons are taken, and RMB
  specifically owns HOLD semantics for the beam — an ultimate on a mouse button would collide with
  the fire/parry muscle memory at the exact moment of panic).
- "Press F" is the genre convention the devil's advocate already conceded (§6 of their doc).
- SHIFT was considered and rejected: five rapid presses of a not-ready button trips the Windows
  Sticky Keys dialog in-browser — an unacceptable failure mode for a hype button. G/X/V/Z are
  reachable but conventionless.

**Belt conflict resolution:** keep the existing precedence — inside `SHOP_RADIUS`, F = trade;
outside it, F = ultimate. Concretely: the ultimate branch in the update loop checks
`!(this.belt && nearShop)` before firing. The shop radius is small, static, and self-announcing
(the shopkeeper is a visible NPC), so "F did nothing" can't happen ambiguously — but flag to the
designer that moving trade to G kills the caveat entirely if playtest shows misfires.

### Hold-vs-tap semantics: TAP. One press, one cast, on keydown.

- **Tap on `Phaser.Input.Keyboard.JustDown(this.keys.F)`.** Casting on keyup (release) would add the
  player's entire hold time as latency — the exact bug the R-grab fix removed at `:3004-3005`
  ("grab on JustDOWN, not release"). An ultimate is the most latency-sensitive press in the game.
- **No hold-to-charge.** Charge is passive/authoritative (`ultCharge` accrues server-side, G7). A
  second hold-resource vocabulary would collide head-on with RMB's beam charge/heat language that
  just shipped. HOLD stays the beam's word.
- **Not-ready feedback is local and free:** pressing F while `ultCharge < 100` (or before unlock)
  plays a dull dry-click (`AudioBus` key `ult:dry`), pulses the charge arc once, and sends nothing.
  No message, no budget spend, no server round-trip to be told no.
- **Gamepad: not supported today.** Grep for gamepad across `packages/client/src` returns nothing —
  keyboard+mouse only (`this.input.keyboard`, `this.input.activePointer`). Note for the future: when
  a pad lands, ultimate maps to LB/L1 (the "both thumbs stay on sticks" slot); nothing in this design
  precludes it because activation is a single edge + a cursor point.

### Input plumbing: a budgeted one-shot ACTION message, not input state.

```
this.room.send("ultimate", { tx, ty });   // cursor world point, computed like attack's (:6423-6443)
```

- **Why a message and not a `fireHeld`-style input field:** the input command stream (`stepNetInput`,
  `:9419-9455`) carries *levels* — things that are true for a whole 50ms tick (movement axes, beam
  held, aim). `fireHeld` exists because a beam is sustained. An ultimate is an *edge*, exactly like
  attack/parry/grab, and those are all budgeted `onMessage` actions on the server
  (`GameRoom.ts:765-829`, `takeAction`, `ACTION_MSGS_PER_TICK = 8`, `constants.ts:137`). The
  devil's-advocate G9 says the same: "activation = budgeted action message... do not invent a third
  transport." Respect the seq + budget laws by *reusing* them, not extending them.
- **One exception rides the existing stream anyway:** aim. The seq'd input cmd already carries
  `aimX/aimY/targetX/targetY` every 50ms (`:9441-9448`), so the server has fresh continuous aim for
  any archetype that needs a facing at resolve time. The message's `tx/ty` is the click-instant
  cursor snapshot for point-targeted archetypes (teleport destination, fireball target), coerced and
  clamped server-side like attack's `tx/ty` (`GameRoom.ts:796-801` precedent — trust nothing off the
  wire).
- **The jump-style seq ride was considered and rejected** for activation: jump rides the cmd stream
  (`:3038`, `prediction.ts` `PredCmd.jump`) because the *predictor must replay it deterministically*.
  We are not predicting displacement client-side for any archetype (see §2), so buying into the
  replay contract would cost a shared clamp/validation module inside `stepHorizontal` replay + a
  `teleportSeq` carve-out in `reconcile()` for zero felt benefit. The predictor stays untouched.
- **Modal gates, copied verbatim from `sendParry` (`:6567`):** no send when
  `!self?.alive || this.inLevelWindow(self) || this.levelWinInputReleaseLatch`. F is NOT added to
  `levelWindowModalKeys()` (`:5315`) — it does nothing inside the window — but the release latch
  already guarantees an F mashed during the window can't leak a cast on the closing frame, because
  the latch only clears once *all* modal keys and both mouse buttons are up (`:5335-5341`).
  Add `this.keys.F` to the released-check so holding F through window-close can't fire either.
- **Local debounce:** mirror the server's `ultReady` check with a local latch (`ultCastPending =
  true` until the `ultSeq` bump or 400ms timeout) so a double-tap sends one message. The server
  rejects duplicates anyway (`ultReady` gate + action budget); this just saves the budget slot.

---

## 2. Prediction / feel, per archetype

House rules this section obeys: damage/displacement truth is never client-computed; instant-press
feedback is always cosmetic (the `sendAttack`/`sendParry` model — predicted swing/brace on press,
authority confirms via synced seq, `:6390-6576`); teleports have exactly one sanctioned mechanism
(`zeroMoveVel` → `teleportSeq` bump → predictor hard-snap, `prediction.ts:254-306`, G3/guardrail
checklist).

### 2a. Far cursor teleport — **authoritative-only, masked by a fixed authored anticipation. Do NOT predict.**

The prompt offers predict-and-reconcile "like jump." Jump predicts cleanly because it is
deterministic off the command stream with zero external inputs (`stepPredictedVertical`,
`prediction.ts:102-125`). A teleport is not: the server clamps range, re-validates against arena
bounds and POI/wall collision, and can *reject* (dead/frozen/not-ready). A mispredicted arrival —
rig appears at the cursor, then `teleportSeq` bumps and the hard-snap (`prediction.ts:286-288`,
`INTERP_SNAP_PLAYER` cut at `:6252` "a teleport-sized jump snaps") relocates you to the server's
clamped point — is the single worst pop this game can produce, on its flashiest button. Worse, the
existing reconcile treats ANY `teleportSeq` change as a hard resync that zeroes the error offset and
clears pending; predicting through it means carving an "own predicted teleport" exception into the
most adversarially-reviewed module in the codebase.

Instead, spend the round-trip as *animation*:

1. **Press (0ms, local):** rig starts the **paper fold-up departure** — reuse the §50 paper-cutout
   language (`SpriteRig.playSpawnUnfold` is the arrival twin; add `playFoldUp`, ~120ms). Departure
   ring + `ult:teleport-out` audio fire instantly. Input feels consumed on the frame of the press.
2. **Server resolves (~60–125ms later):** validates, clamps, calls `zeroMoveVel` → `teleportSeq`
   bump → the predictor's existing hard-snap relocates truth; beams re-anchor for free (the
   `GameRoom.ts:3098` beam/teleport contract already exists and is tested, `GameRoom.test.ts:1015`).
   `ultSeq` bumps in the same tick.
3. **Arrival (client):** the `teleportSeq`/`ultSeq` edge triggers `playSpawnUnfold` + arrival burst
   *at the authoritative position*. The 120ms fold is tuned to cover one typical RTT, so on a median
   connection the unfold begins the moment the fold ends — it reads as one authored move, and the
   cast-to-safety timing is identical for a 15ms player and a 120ms player (no low-ping escape
   advantage; the server owns when your hurtbox left, which is the dodge-integrity posture the P0
   fixes just established).
4. **Failure path:** if no `ultSeq` bump arrives within 400ms of the send, unfold in place with a
   fizzle (grey scrap puff) and clear `ultCastPending`. The rig never moved, so nothing pops.

Prediction module cost: **zero lines changed in `prediction.ts`** — the teleport arrives through the
contract it already honors.

### 2b. Phase attack & 2c. Alpha strike — **local anticipation, server resolution, action-tick playback.**

Both are windowed, server-driven sequences (G4/G6: server-swept dash, server-picked targets and hop
schedule). The client's job splits into the owner's first 100ms and everyone's spectacle:

- **Owner anticipation (0ms, cosmetic):** on press, trigger a rig windup exactly like the parry brace
  (`rig.triggerBrace`, `:6573`) — phase: a desaturation shimmer + stance drop; alpha: a crouch-coil
  (the hammer front-flip super-slam precedent shows SpriteRig can carry iconic bespoke moves).
  Plus the instant cast audio. No movement, no transparency-that-lies: the player must not *look*
  untargetable before the server says so, or they'll eat a hit that "shouldn't have landed."
- **Resolution:** the `ultSeq` bump + `ultActiveUntilTick` open the real window. Owner position keeps
  flowing through the normal predictor during phase (the server moves/impulses you; corrections glide
  through the existing error offset — a phase dash server-side is just impulse + teleport-free
  movement, which reconcile absorbs by design). For **alpha strike**, if the server takes control of
  position per-hop, each hop lands as either (a) sub-`INTERP_SNAP_PLAYER` corrections that glide, or
  (b) a `teleportSeq` bump per hop that snaps — the server panel picks; the client handles both today
  with no new code. VFX-wise the hops are *drawn from synced action-tick state*, not from predicted
  position (see §5), so the spectacle can't desync from truth.
- **Feel math:** anticipation windows of 100–150ms are already the game's melee language (swing
  descriptors author `impactSeconds`, `:6456`), so the RTT hides inside a beat the player already
  reads as "windup," not as lag.
- **Damage presentation:** every hit rides the existing `combatReceipts` path
  (`CombatReceiptState`, `state.ts:320-334`) — crunch VFX, numbers, and hit-stop come from receipts
  exactly like current weapons. Hit-stop stays priority-budgeted (`:6832` — kill crunches are
  non-priority); only the alpha-strike *finisher* on the owner earns a priority freeze.

### 2d. Fireball — **standard projectile prediction: predicted launch flash, authoritative projectile.**

Copy the gun path verbatim (`sendAttack` gun branch, `:6475-6502`):

- On press: predicted muzzle-flash-equivalent (a charge-bloom at the staff/hand via
  `spawnMuzzleFlash` with a fireball-scale fx entry), predicted `ult:fireball-cast` audio, camera
  recoil kick, `lastSelfMuzzleAt`-style timestamp so `syncProjectiles` suppresses the duplicate
  spawn flash for self (the existing dedupe at the gun path's comment `:6479-6482`).
- The ball itself is the authoritative `ProjectileState` (kind `"fireball"`, `hostile = false`,
  `explodeR` already exists in the schema, `state.ts:290`) rendered by `syncProjectiles` /
  `moveProjectiles` like every other shot. **Do not spawn a local dummy projectile** — a big slow
  projectile that exists twice for 100ms is a visible ghost; a launch bloom that covers the
  round-trip is not.
- Detonation: server AoE (single damage event per enemy, G5), client renders the blast from the
  projectile's removal + receipts, reusing `fx-pack-nuke` / `fx-pack-ember-eruption` through the
  authored `fx-composer` path rather than a new bespoke burst.

---

## 3. READY/charge HUD — the junction's second dial

The beam heat arc just claimed the dock junction's upper-right shoulder
(`renderBeamHud`, `:7546-7611`: `x = junction.x + junctionSize*0.36`, `y = junction.y -
junctionSize*0.35`, radius `junctionSize*0.105`, arc geometry `start = π·0.72`, `span = π·1.56`;
belt fallback = weapon rail at `barX + 266·scale`). The ultimate arc becomes its **mirror on the
upper-LEFT shoulder** of the same junction: `x = junction.x - junctionSize*0.36`, same `y`, same
radius, same start/span geometry. Belt fallback sits `36·scale` left of the heat arc's rail slot.

One coherent resource vocabulary, one rule per dial:

| | Beam heat arc (exists) | Ultimate arc (new) |
|---|---|---|
| Filling means | **bad** — spend toward lock | **good** — charge toward READY |
| Palette | cyan→orange→red (`beamStatusColor`, `:7538`) | slate `0x52616c` track (same), fill in desaturated gold `0xC9A84C` that saturates to `0xffd479` only at 100 |
| Markers | white restart marker + red end tick | none — no thresholds to learn; READY is binary |
| At the cap | overheat pulse (alpha sine, `:7585`) | READY: slow breathing pulse + one-shot "F" key glyph fade-in beside the arc (the always-on controls line `:7848` gains "· F ult" once unlocked) |

Rules:
- **Authoritative truth only**: the arc renders `self.ultCharge / 100` and nothing else. The client
  never increments it, never lerps *ahead* of it — visual smoothing uses the XP-bar convention
  (lerp TOWARD the true ratio, `:7699`) so gains read as motion without ever claiming charge the
  server hasn't granted.
- Pre-unlock: the arc does not exist (no greyed-out mystery UI). It materializes in the unlock
  ceremony (§4).
- On spend (`ultSeq` bump): the arc drains with a 150ms sweep + afterimage, then resumes truth-lerp.
  During an active window (`ultActiveUntilTick`), the arc inverts to a draining white countdown of
  the window — the one moment it borrows urgency, because it is measuring something live.
- Drawn in the same `Graphics` pass style as `beamHudGfx` (one retained Graphics, cleared and
  redrawn per frame, screen-space, dock depth) — a new `ultHudGfx` sibling, laid out by a pure
  function (§6) so it's unit-testable like `weapon-dock-layout`.

---

## 4. Unlock ceremony

The unlock will almost always be *caused inside the level window* (stat allocation happens via
`chooseAttribute` during the flex freeze, `GameRoom.ts:1196`, `progression.ts:31`). The window is a
modal with a hard input latch (`levelWinInputReleaseLatch` + `levelWindowInputsReleased`,
`:2977-2982`, `:5335-5341`) and its own depth stack (dim at 100003, celebration text above at
100013, `:7494-7505`). The ceremony must respect that machinery, not fight it:

1. **Detect**: client observes the authoritative edge — `ultId` transitions empty → non-empty on
   self (or an explicit `ultUnlockedSeq` if the server panel prefers; either way it is a synced
   field, per the devil's-advocate demand that the unlock be an explicit authoritative event, §6).
2. **Queue, don't interrupt**: if `inLevelWindow(self) || levelWinInputReleaseLatch`, set
   `pendingUltReveal = true` and do nothing. The level window's own choice flow (1–5 keys, focus
   tweens `:5343-5369`) is sacred — the reveal plays on the first update frame where the window is
   closed AND the latch has cleared (the same edge that re-enables combat input, `:2978-2980`).
   This also means the reveal lands exactly when the player regains control — the button becomes
   pressable in the same breath it is announced.
3. **The reveal (non-modal, ~1.8s, skippable by just playing):**
   - the ultimate arc **paper-unfolds** into the junction's left shoulder (the §50 cutout language;
     `prefersReducedPaperMotion()` ⇒ a plain 200ms fade instead),
   - a banner via the existing `flashBanner` pathway (`:3079` precedent) names it — "ULTIMATE:
     PHASE STEP — F", gold, above the dock,
   - one audio sting (`ult:unlock`), no camera shake (the level-up toast rule: "a level-up is a UI
     beat, not an impact," `:7496`),
   - the "F" glyph pulses beside the arc until the first-ever cast (a one-time teach, stored in the
     same local persistence as the mute flag).
4. **Interrupt safety elsewhere**: death (`resetDeathRecap` path), rift descent, and belt transit all
   simply leave `pendingUltReveal` set; the queue check is "window closed, latch clear, self alive"
   so the ceremony survives being deferred across anything. Remote players' unlocks do not ceremony —
   their arc state is visible in the party HUD only via their casts (§5).

---

## 5. Remote-viewer rendering — everyone sees the whole spectacle

Pattern: the `attackSeq` routing loop, verbatim (`routePlayerAttacks`, `:2368-2399`). A new
`routeUltimates()` walks `state.players`, tracks `lastUltSeq` per id (wrap-aware `>>> 0` compare, the
`:6413-6414` idiom), and on a forward bump dispatches the archetype presentation for **all** players
— including self, where the synced edge *confirms and upgrades* the local anticipation instead of
double-playing it (the owner-predicts-first / edge-consumes-as-confirmation contract described at
`:2365-2367`, plus the `lastSelfMuzzleAt`-style dedupe for the fireball flash).

Timing uses `attackClientEpoch` unchanged (`:2358-2363`): remote ultimates play at
`ultTick`-mapped scene time including `INTERP_DELAY_MS`, so the phase shimmer and alpha hops meet the
*interpolated* remote body, not its raw state position — the exact reason that mapper exists.

Per archetype, what remotes render from synced truth:
- **Teleport**: departure fold at the pre-bump interpolated position (the snapshot buffer already
  holds it — the interpolator's teleport-sized-gap CUT at `:3462` and `:6252` tells us where the cut
  happened), arrival unfold at the new authoritative position. Both endpoints are server truth.
- **Phase**: a shader-free desaturation + outline treatment on the remote rig for the synced window
  (`ultTick` → `ultActiveUntilTick`), driven per-frame from state like the Brand tint (`:3687`) —
  no timers that can drift from the server window.
- **Alpha strike**: hops render from the synced schedule, WormBoss-style — `WormBossState` proves
  the pattern: `actionSeq / actionStartTick / actionResolveTick / actionEndTick / actionTargetX/Y`
  (`state.ts:368-377`) drive Serraketh's presentation deterministically on every client. Ultimate
  hop state is the same shape on `PlayerState` (or a small `UltActionState`); each client cues the
  dash streaks/impacts off tick math, and per-hit crunch comes from `combatReceipts`.
- **Fireball**: nothing special — the projectile and blast are ordinary synced entities.

Audio mirrors the beam's owner/remote split (`updateBeamFeedback`, `:9346-9416`): full `amt` for
your own cast, 0.3–0.4 spatialized for a mate's, phase-edge-triggered exactly once per
seq/phase change, sustained loops throttled inside `AudioBus`.

---

## 6. LOD / perf under 4 simultaneous ultimates

Budget posture: the design-max screen is 4 ults + a tough combo + a boss phase (devil's-advocate
§5). The client must hold the current frame floor there (their kill criterion #3).

- **One `UltimateVfx` class, WormBossVfx architecture** (`worm-boss-vfx.ts:28-55`): fixed-cap
  typed-array particle table (`PARTICLE_CAP`-style, shared across ALL owners — a global pool, not
  per-player), a small set of persistent `Graphics` objects cleared/redrawn per frame, **zero
  tweens, zero runtime allocation, zero Phaser emitters**. Four casters borrow from the same rows;
  when the pool saturates, oldest rows are reused (`borrow()` semantics) — the newest cast always
  gets its particles.
- **Pooled retained objects like BeamRenderer** (`BeamRenderer.ts:97-128`): anything rope/sprite
  shaped is allocated once for `MAX_PLAYERS` at scene start and keyed per `ownerId:ultSeq`, acquired
  and released — never created mid-cast.
- **Per-owner LOD, the enemy-anim precedent** (`:3414` — `visible && !reducedMotion && fullActive <
  fullLimit`): the LOCAL owner always gets the full treatment; remote casters get full only while
  on-screen and under a `fullLimit` of 2 simultaneous full-fidelity remote ults; beyond that,
  remotes drop to the core read (the exact-danger shapes + rig pose + one impact flash — never
  nothing, because a mate's ult is information).
- **The truth layer is never LOD'd**: any ultimate that creates danger or displacement keeps its
  mathematically literal shapes at full fidelity — the telegraph-layer contract ("exact danger
  edges... Never quality-gated," `:817`). Ally spectacle LODs; truth doesn't.
- **Layering (G8)**: all ultimate spectacle draws in the weapon-VFX band (~depth 9990, where beam
  bodies live) — strictly BELOW the protected telegraph/white-tell layers and the parry ring
  (99989) and danger vignette (99998). Named layer constants go in `vfx-layers.js`, not per-effect
  judgment calls. No white or red-orange fills in any ultimate palette (white = parryable,
  red = dodge are load-bearing).
- **Screen-feel budgets**: camera shake per cast ≤ the beam-ignite kick (55ms/0.0028, `:9368`);
  shake never stacks across simultaneous casters (the shake channel already arbitrates); hit-stop
  from remote ults is non-priority (budgeted away under chaos, `:6832`); no full-screen flashes —
  the flash-rate cap is a photosensitivity requirement.
- **Fill cost**: `RENDER_DPR` caps at 2 (`render-dpr.ts:12`) but 4 ults of additive overdraw is
  still the risk axis — the fireball blast and alpha streaks use the capsule/ellipse fill style of
  `BeamRenderer.drawCapsule` (bounded vertex count, one fill each) rather than particle carpets.

## 7. Reduced-motion path

`prefersReducedPaperMotion()` (`:233-236`) already gates unfolds, dock tweens, and level-window
motion (`:2088`, `:3317`, `:5213`, `:8263`). Ultimates follow the same single switch:

- Teleport: fold/unfold become 120ms fades — **the 120ms timing is kept** (it is RTT-masking and
  fairness, not decoration; reduced motion must not change cast-to-arrival timing).
- Phase/alpha: no dash streaks/afterimages; the rig pose changes + a static outline carry the state;
  hops indicated by simple position cuts with a single ground marker per hop.
- Fireball: blast renders as the literal damage circle (telegraph-grade ring) + one non-animated
  flash frame; no particle bloom.
- Ceremony: fades instead of unfolds (§4); READY pulse becomes a static saturated arc.
- No camera shake, no hit-stop changes (hit-stop is a timing device, not motion).

---

## 8. File / function touch list

**New modules**
| File | Contents |
|---|---|
| `packages/client/src/vfx/ultimate-vfx.ts` | `UltimateVfx` — pooled, allocation-free spectacle for all four archetypes (WormBossVfx architecture); per-archetype `cue*()` entry points driven by synced state; LOD + reduced-motion inside |
| `packages/client/src/ui/ultimate-hud-layout.ts` | pure layout fn: junction mirror-shoulder position + belt rail fallback from `WeaponDockLayout` + screen size (the `weapon-dock-layout.ts` testable-pure pattern) |
| `packages/client/src/ui/ultimate-reveal.ts` | ceremony sequencing (queue conditions, unfold/fade, banner copy, one-time F-glyph teach) as data + small helpers, scene provides Phaser objects |

**Modified**
| File | Change |
|---|---|
| `packages/client/src/scenes/ArenaScene.ts` | add `F` to `addKeys` (`:1674`); ultimate branch in `update()` input block (JustDown, modal gates, belt `nearShop` precedence); `sendUltimate()` beside `sendAttack`/`sendParry`; `routeUltimates()` beside `routePlayerAttacks` (+ `lastUltSeq` map, reset in `create`/shutdown nulls `:1476-1553`); `renderUltimateHud()` beside `renderBeamHud`; reveal queue check on the latch-clear edge (`:2978`); controls-line copy `:7848` gains "F ult" post-unlock; `ultCastPending` latch |
| `packages/client/src/entities/SpriteRig.ts` | `playFoldUp` (departure twin of `playSpawnUnfold`); windup poses for phase/alpha (the `triggerBrace`/iconic-melee pattern); phase-window tint hook |
| `packages/client/src/audio/AudioBus.ts` | keys: `ult:dry`, `ult:unlock`, `ult:teleport-out/in`, `ult:phase`, `ult:alpha-hop/finish`, `ult:fireball-cast`, remote-amt variants; throttle rules |
| `packages/client/src/vfx/vfx-layers.js` | named depth constants for the ultimate band (below telegraph/tell layers) |
| `packages/shared/src/state.ts`, `constants.ts` | server panel owns; client consumes `ultId/ultCharge/ultSeq/ultTick/ultTargetX/Y/ultActiveUntilTick`; SCHEMA_VERSION 19 (G10 coordination) |

**Deliberately untouched:** `packages/client/src/net/prediction.ts` — every archetype resolves
through contracts it already honors (teleportSeq hard-snap, impulse glide, pause/freeze). That is
the headline netcode property of this design.

## 9. Test strategy

- **Pure-module unit tests** (the `prediction.test.ts` / dock-layout style — node, no Phaser):
  `ultimate-hud-layout.test.ts` (junction mirror + belt fallback + tiny-screen clamps);
  a wrap-aware `ultSeq` edge helper extracted pure and tested across the uint32 wrap;
  reveal-queue state machine (window-open ⇒ queued; latch ⇒ still queued; clear+alive ⇒ fires once).
- **`prediction.test.ts` addition (regression, not new logic):** a `teleportSeq` bump mid-pending
  window (the ult-teleport cause) hard-snaps, clears pending, zeroes error — pinning that the
  ultimate teleport rides the existing contract byte-for-byte.
- **Input-gate tests** (scene-logic extracted or verified via the server's `GameRoom.test.ts`
  harness): no `ultimate` message while dead / in level window / latch held; one message per press
  under mash (`ultCastPending`); belt near-shop F precedence.
- **Snapshot/interp tests** (`snapshots.test.ts` pattern): remote ult playback epoch mapping —
  `ultTick` → scene time includes `INTERP_DELAY_MS` for remotes, excludes it for self.
- **Perf probe, manual but scripted:** Testing Grounds + `devEquip`/`spawnBossDef`, 4 clients
  (the multi-computer setup), all four casting inside one second during a Serraketh action —
  record frame time; kill criterion is dropping below the current max-chaos floor. Repeat with
  reduced-motion on.
- **Feel verification checklist** (the `/verify` posture): cast each archetype at 0ms and at
  ~120ms simulated latency; teleport must read as one authored move at both; fireball flash must
  never double; unlock during a level window must ceremony only after control returns.

---

**Summary of the two load-bearing choices.** The button is **F, tap-to-cast**: the only free
near-WASD key (its sole conflict, belt shop trade, is proximity-gated), cast on keydown per the
R-grab latency lesson, aimed by the cursor that the input stream already syncs — and activation is a
budgeted one-shot action message like attack/parry, not a new input-state field, because an ultimate
is an edge, not a level. On prediction, nothing displaces client-side: the teleport is
authoritative-only behind a fixed 120ms paper fold-up that masks the RTT and equalizes escape timing
across pings (arriving through the existing `zeroMoveVel`/`teleportSeq` hard-snap contract with zero
changes to `prediction.ts`), phase and alpha strike get instant cosmetic windups while the server
resolves windows and hop schedules that all clients replay from synced action-tick state
(WormBoss-style), and the fireball is the gun path verbatim — predicted launch flash, authoritative
projectile, receipt-driven blast.
