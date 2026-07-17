# Two Jumps — Movement-Feel Designer

Panel: jump feel (satisfying standard jump + optional ground pound · crouch-charged distance jump). Role: movement-feel design (platformer arc craft translated to top-down 20 Hz co-op). Design only; modifies no source.

## 0. The physics we inherit (readback, with citations)

- **Current jump:** `JUMP_VELOCITY = 303 px/s` under `GRAVITY = 1350 px/s²` (`packages/shared/src/constants.ts:390-391`) → apex **34 px**, airtime **0.449 s**, symmetric parabola. Integrated by the pure `stepVertical(height, vh, dt)` (`packages/shared/src/movement.ts:193-201`), run identically on the server (`GameRoom.ts:2488`) and in client prediction (`packages/client/src/net/prediction.ts:100-124` — `stepPredictedVertical` replays the buffered-jump phase over acked `height/vh`). Cooldown 0.7 s, input buffer 0.25 s sized to the post-landing dead window (`constants.ts:376-384`).
- **Input:** Space edge-trigger rides the sequence-numbered `{seq, dx, dy, jump}` command (`ArenaScene.ts:3038`, `:9443`; `GameRoom.ts:2240-2244`). A Space pressed mid-air today is *not wasted* — it re-arms `jumpBuffer` and fires on landing.
- **What airborne means:** `height > GROUND_EPSILON (0.5)` clears pits (`GameRoom.ts:2364`) and footfall quakes (`GameRoom.ts:4599`); it grants **no i-frames** — §5 is explicit that the jump is "PURE MOVEMENT, NOT a dodge" (`constants.ts:372-375`), and melee arc tests are 2D ground-plane, so airborne players remain strikeable. Attacking/firing mid-air has no grounded gate today.
- **Pits:** tiles are **80 px** (`MAP_TILE`); the connectivity guarantee only ever *requires* hops over gaps ≤ `MAP_MAX_JUMP_TILES = 2` (**160 px**), sized off hop reach 0.45 s × 320 px/s ≈ 144 px (`constants.ts:202-209`). But pit *features* grow from blobs of radius 2–3 tiles (`mapgen.ts:337-358`) — real pits are commonly **4–7 tiles (320–560 px)** across, today strictly walk-around terrain.
- **The vertical axis is contested:** parry-launch kicks `vh` +420 (cap 640) (`constants.ts:679-680`), and the enemy-combo panel's juggles set `vh` 480 (launcher) / 360 (air-keep) (`docs/enemycombo-panel/designer.md` §4). Any jump retune must keep the height *ordering* readable: voluntary player heights < enemy-authored lofts.
- **Landing feel today:** `landSquash` on the rig (`SpriteRig.ts:931-932`) + `JIGGLE_LAND_HAND_KICK` — one flat tier regardless of fall speed.

Server tick = 50 ms; every authored duration below is a multiple of 0.05 s. Every trigger below rides the existing command stream and is replayable in prediction — that is a hard design constraint, not an implementation detail.

---

## 1. THE STANDARD JUMP — same verb, better arc, plus a pound

### 1.1 The asymmetric-gravity arc

The platformer trick: **rise fast, hang at the top, fall faster than you rose.** A symmetric parabola (what we have) spends equal time in the boring halves and lands softly. Replace the single `GRAVITY` with a three-zone profile keyed off the sign/magnitude of `vh` — still pure and deterministic given `(height, vh, dt)`, so `stepVertical` stays one shared function with three constants instead of one:

| Constant | Value | Zone |
|---|---:|---|
| `JUMP_VELOCITY` | 303 → **335 px/s** | launch kick ("slightly higher", per the directive) |
| `GRAVITY_RISE` | **1250 px/s²** | while `vh > +80` — snappier rise than a bigger jump would naively give |
| `GRAVITY_APEX` | **900 px/s²** | while `\|vh\| ≤ 80` — the float window, the "hang" that makes a jump feel owned |
| `GRAVITY_FALL` | **2200 px/s²** | while `vh < −80` — the decisive comedown |

Resulting arc (exact integration):

| Metric | Today | Proposed |
|---|---:|---:|
| Apex height | 34 px | **≈ 47 px** (+38%) |
| Time to apex | 0.22 s | **0.29 s** (0.20 rise + 0.09 float) |
| Apex float (\|vh\| ≤ 80 band) | ~0.12 s | **~0.18 s** — the readable "top of the jump" beat |
| Fall time | 0.22 s | **0.25 s** (0.09 float + 0.16 fall) |
| Total airtime | 0.449 s | **≈ 0.55 s** |
| Landing speed | 303 px/s | **≈ 445 px/s** — the ground *arrives*; feeds the thump tiers (§3) |
| Hop reach at MOVE_SPEED 320 | 144 px | **≈ 175 px** (2.2 tiles) |

Why these proportions: rise time 0.29 s vs fall 0.25 s with a 47% faster fall *acceleration* is the classic 60/40 platformer asymmetry — the eye reads "leap… hang… THUD" instead of a metronome. Landing 47% hotter than takeoff is what makes the same input feel weightier without touching a single landing effect.

Knock-on checks:
- **Quake dodge** stays honest and gets slightly *more* forgiving (airtime 0.45 → 0.55 s widens the jump-timing window over `footfallQuake` by one tick) — acceptable; the quake's difficulty is the read, not the frame-perfect hop.
- **Required pits** (160 px) clear with 9% more margin; nothing about `MAP_MAX_JUMP_TILES` changes.
- **Buffer math:** dead window becomes 0.70 − 0.55 = **0.15 s** < `JUMP_BUFFER_SECONDS 0.25` — the buffer comment at `constants.ts:380-384` needs its arithmetic updated, behavior unchanged.
- **Input semantics: tap Space, unchanged.** All new inputs live on held/mid-air Space (below), so the 100%-of-players verb is untouched.
- The profile is per-axis, not per-cause, so parry-launch and juggle lofts ride it too: parry-launch 420 apex 65 → **72 px**; juggle launcher 480 apex 85 → **93 px**, full airtime ≈ 0.71 → **0.75 s**; cap 640 → **166 px**. Ordering preserved except one narrow spot flagged in §4.3.

### 1.2 The OPTIONAL ground pound

**Input: Space again mid-air.** Chosen over `S+Space` because S is a *movement direction* in a top-down game — thousands of jumps happen while holding S, and any modifier-chord reading of it would misfire constantly. Space-mid-air is nearly free real estate: today it only re-arms the landing buffer. Disambiguation rule that preserves that QoL:

- Space while airborne at `height > POUND_MIN_HEIGHT = 24 px` → **POUND**.
- Space while airborne at `height ≤ 24 px` (the first/last sliver of the arc) → buffered next hop, exactly as today. A press meant as "jump again when I land" almost always happens on late descent — the buffer keeps working; a press near apex unambiguously means *down*.

**Pound mechanics (press → impact in 0.13–0.22 s):**

| Beat | Numbers | Feel |
|---|---|---|
| Gather | **0.10 s** hang: `vh = 0`, gravity suspended; rig snaps to a knees-up fold (paper cutout creases), shadow underneath darkens | The anticipation beat — without it the pound reads as a glitch fall |
| Slam | `vh = −1400 px/s` **constant** (gravity bypassed — deterministic descent). Horizontal control zeroed. From standard apex 47 px: 0.034 s; from a juggle loft 93 px: 0.066 s; from cap 166 px: 0.119 s | A drawn vertical line, not a fall |
| Impact | AoE radius **90 px**; damage `10 + 0.1 × trigger height` (standard jump ≈ **15**, juggle escape ≈ **19**, cap **26**); radial knockback impulse **260 px/s** via `addImpulse`; **0.35 s** enemy stagger. Boss takes damage only. No friendly damage | The payoff (§3 tier-3 landing, always) |
| Recovery | **0.25 s** self-root: no move, no parry, no jump (firing allowed) | The price — see below |
| Cooldown | sets `jumpCd = 0.9 s` on impact (vs 0.7 normal) | not a bunny-pound loop |

**Why it doesn't obsolete existing verbs:**
- Damage ~one light melee hit inside a radius smaller than every real AoE (`QUAKE_REACH 260`, boss quakes) — it's a **spacing tool** (knockback + stagger), not a nuke. Melee stays the damage verb, parry stays the defensive verb.
- **No quake interaction:** the pound is not a parry; a pound that grounds you inside an unresolved quake ring eats the quake (`applyQuake` grounded check unchanged). Jump-over remains the one movement answer to quakes — the pound actually *ends* your quake immunity early, which is the correct self-punishing texture.
- **Juggle escape, honestly priced:** pounding out of an enemy loft grounds you before the next air-keep's wedge and ends the string by geometry — but the 0.25 s no-parry recovery is strictly worse than the air-parry escape (which knocks the juggler 154 px and pays `PARRY_LAUNCH`). Pound = the panic button, air-parry = the mastery button. This slots into the enemy-combo panel's escape ladder without weakening it.
- **The emergent tech** (deliberate): distance jump (§2) over the pack → pound in the middle. Leap velocity zeroes on pound trigger, so the combo is a committed dive into melee range with a 0.25 s bill on arrival.

**Pound payoff dressing:** 40 ms hit-stop on connect; camera thump 3 px / 90 ms; dust ring 0→90 px in 120 ms tinted the player's color rim (co-op: *whose* pound is instantly legible, and distinct from enemy red / boss gold rings); quake-crack decal component at low count + 4–6 paper shards; bass thud + paper "whump".

---

## 2. THE DISTANCE JUMP — crouch, commit, clear the pit

### 2.1 Input: HOLD Space

- Tap (released < **0.15 s**) → standard jump, exactly as today.
- Held ≥ 0.15 s while grounded → **crouch commits** (point of no return).

Why hold-Space and not a new key/chord: RMB is fire (and the beam family already owns *hold-RMB*), LMB is parry, S+Space fails as above — hold-vs-tap on the same key is the established grammar in this codebase (drop key: "TAP = drop, HOLD = salvage", `SALVAGE_HOLD_SECONDS = 0.6`, `ArenaScene.ts:2973`). One key, two verbs, zero new bindings. Held state rides the command stream as a `jumpHeld` flag beside the existing edge bit — same shape as `fireHeld` (`GameRoom.ts:5194`), fully replayable in prediction.

### 2.2 The crouch beat — 0.50 s, and why not "a second"

The directive says the character "crouches for a second". Authored literally, 1.0 s of self-root is a death sentence in this game: enemy melee wind-ups run 0.25–0.95 s (`docs/enemycombo-panel/designer.md` §2), so a 1.0 s root lets any tough that *starts* its wind-up as you crouch land a guaranteed hit — the move would be unusable in combat and the pit-crossing fantasy dies. **0.50 s (10 ticks)** keeps the root shorter than every full melee sentence while still being an unmistakable, deliberate stop — and it rhymes with the enemy Negotiated Leap's own crouch grammar (0.30 s offer + 0.25 s settle), so "deep crouch = big movement incoming" stays one visual language for both sides. If playtest says it still reads too brief, 0.60 s is the ceiling; never 1.0.

During the crouch (movement PAUSED, as directed):
- Velocity decays via `MOVE_STOP_DECEL 2600` (~0.12 s to zero — a plant, not a freeze-frame teleport); input dx/dy stops driving position.
- Rig folds into a **paper crouch**: y-scale → 0.70, feet tuck, weapon crossed low — the cutout visibly *creases* (paper-panel vocabulary).
- Charge tell builds over the full 0.5 s: inward dust inhale (mirror of the leap Offer beat), rim shimmer 0→full, an aim chevron on the ground showing the launch heading (see 2.3) that brightens as launch approaches. Co-op and enemies-with-eyes both read it.
- **No i-frames, no armor.** The crouch is a wager. Getting tagged mid-crouch cancels the leap (refunds no cooldown) and applies the hit normally — pick your moment.
- Launch fires **automatically at 0.50 s** (crouch-commit design, like the enemy leap's committed arc). No hold-to-delay: fixed duration keeps the beat learnable and the prediction replay trivial.

### 2.3 Launch: fast, long, direction-SOFT-LOCKED

- **Heading source:** the held WASD direction, sampled continuously during the crouch, **locked at the launch tick**. The crouch *is* the aim phase — you commit your feet, then steer your intent for half a second, then the launch freezes it. If WASD is neutral at launch: last non-zero move heading; final fallback, aim direction. (Sampling at crouch-*start* was rejected: it punishes the 0.15 s hold-detection blur and makes the chevron a lie.)
- **Soft-lock defined:** mid-air steering ≤ **45°/s**. Over the full 0.60 s flight that is ±27° total — enough to fudge a landing lip, never enough to U-turn. Speed is fixed (WASD magnitude does nothing mid-flight; direction input only bends the heading at the capped rate).
- **The numbers:**

| Metric | Value |
|---|---:|
| Horizontal speed | **620 px/s** (1.94× MOVE_SPEED; 31 px/tick — under the interp-snap envelope sized off `IMPULSE_MAX 780` ≈ 39 px/tick, `constants.ts:92-96`) |
| Vertical kick | `vh = 380` under the §1 profile → apex **≈ 59 px**, visibly above the standard 47 |
| Airtime | **≈ 0.60 s** |
| Reach | **≈ 372 px = 4.65 tiles** |

- **Pit clearance target, from the real map:** required hops are ≤ 2 tiles (160 px) and the standard jump already owns those. Organic pit *features* run 4–7 tiles. The distance jump is tuned to clear a **4-tile / 320 px gap with 16% margin** — it converts the *common* grand pit from a detour into a route, while 6–7-tile monsters stay uncrossable terrain so the map's macro-shape still matters. Overshooting a too-wide pit lands you airborne-over-void → the existing fall rule fires honestly (15% chip + snap back + 0.6 s grace, `constants.ts:395-400`) — mis-aim is priced, not fatal.
- **Landing recovery:** touch down at 60% MOVE_SPEED recovering via `MOVE_RECOVER_ACCEL 2600` (~0.08 s to full) — a readable plant that reuses the turn-hitch grammar rather than a new stun. Tier-3 thump (horizontal energy counts: impact reads ≈ 500 px/s vertical + the 620 forward — see §3).
- **Cooldown:** own timer `leapCd = 2.5 s`; landing also sets `jumpCd = 0.4 s`.
- **Not a sprint exploit, by arithmetic:** full cycle = 0.15 hold + 0.50 root + 0.60 flight = 1.25 s for 372 px ≈ **298 px/s average — slower than walking** (320). Chained leaps only ever pay off when the *pit* is the obstacle, which is exactly the job description. The 2.5 s cooldown is there for rhythm, not balance.
- **Mid-flight verbs:** firing allowed (as all airborne states today), parry allowed, **pound allowed** (zeroes forward velocity — the §1.2 dive tech). Quakes and pits are cleared while airborne, unchanged rule.

---

## 3. THE SHARED SATISFACTION LAYER — every jump, one payoff system

All client-side dressing on existing rails; server ships only `height`/`vh` it already syncs.

1. **Squash & stretch (rig scale, art aspect preserved per §28.4):** takeoff stretch y 1.06 / x 0.94 for 80 ms; nothing at apex (the float IS the apex read); landing squash by tier (below), decaying on the existing `landSquash` spring (`SpriteRig.ts:931`).
2. **Landing thump tiers by impact `vh`:**

| Tier | Impact speed | Squash | Dust | Camera | Sound | Jiggle |
|---|---|---:|---|---|---|---|
| T1 soft | < 300 px/s (short lofts, keep-resets) | 0.10 | 3 motes | — | felt tap | LAND_HAND_KICK ×1.0 |
| T2 solid | 300–520 (**standard jump lands here at ≈445** — the free upgrade) | 0.18 | 6-mote ring | — | thump | ×1.4 |
| T3 heavy | > 520, or any pound / distance-jump landing (horizontal adds 0.3× its speed to effective impact: 500 + 186 → T3) or juggle full-fall (≈630) | 0.26 | 10-mote ring + crack decal (low count) | 2–3 px, 70–90 ms | bass thud | ×2.0, feet get plant kick |

3. **Shadow = the height channel:** the ground-tracked shadow blob scales 1.0 → 0.82 and alpha 1.0 → 0.6 linearly over height 0 → 60 px (clamped). This is not just juice — it is the **co-op legibility of quake immunity**: who is airborne when the ring resolves must be readable at a glance across the arena.
4. **Jiggle handoff:** landing fires `JIGGLE_LAND_HAND_KICK` scaled by tier; the ownership-envelope handoff (`SpriteRig.ts:214`) means the hands/feet overshoot and settle procedurally — no authored landing anim needed.
5. **Camera:** standard jump gets *nothing* (a 100×/run verb must never fatigue the camera); T3 only, vertical-bob biased, ≤ 3 px ≤ 90 ms.
6. **Audio:** takeoff "fwip" (paper flick — quieter than the landing, always), tiered thumps, pound bass + shard tick. The sound hierarchy IS the weight hierarchy.
7. **Paper-cutout moments:** crouch fold + pound gather are rig poses (creases), pound impact spends one paper-shard burst within the existing per-frame budgets (`ArenaScene.ts:190-194` grammar).

---

## 4. INTERACTION LAWS

1. **No i-frames on any jump — LOCKED.** §5's "pure movement, not a dodge" stands (`constants.ts:372-375`); parry remains the only defensive verb. Jumps beat exactly the *ground-slaved* set: pits, footfall quakes (`GameRoom.ts:4599`), and RED low sweeps authored as jumpable (enemy-combo H1 step 1). Ordinary melee/projectiles hit airborne players (2D arc tests) — z-clearance semantics unchanged.
2. **Attacking mid-air stays legal** (it is today; no grounded gate exists). The pound is the only aerial-*exclusive* verb, and the distance jump adds no attack restrictions — jumping must never feel like holstering.
3. **Juggle-height treaty** (with `docs/enemycombo-panel/designer.md` §4): under the new gravity profile the height ladder is — standard jump **47** < distance jump **59** < air-keep reset 360 → **53** (!) < launcher 480 → **93** < cap 640 → **166**. The keep-reset at 53 px lands *between* our two voluntary jumps and muddies the "enemy lofts sit above player jumps" read. **One-line ask to that panel: raise keep-reset vh 360 → 400 (apex ≈ 65 px)** so every enemy-authored height clears every voluntary height; their cadence math shifts by ≤ 0.05 s (one tick). Launcher and cap need no change. Pound-from-juggle is the priced escape per §1.2; DI and air-parry are untouched.
4. **Pound vs quake-parry roles:** pound never negates a quake, never counts as a parry, and grants no immunity on impact — it *surrenders* airborne quake immunity early. The Colossus triangle stays: jump the ring, parry the ring, or be grounded and pay.
5. **Co-op readability of the pound:** player-tinted expanding ring (unique vs enemy red / boss gold), no friendly damage/knockback, shadow+gather pose telegraphs it ~0.13 s before impact, and the T3 thump is spatialized. Two players pounding the same pack double-stagger but knockback is radial from each — no stacking exploit beyond 2× a light hit's damage.
6. **Netcode law for every number above:** all three verbs are deterministic functions of the command stream (`jump` edge + `jumpHeld` flag + airborne state), stepped by the same shared pure functions server-side and in `stepPredictedVertical` replay — the jump-reconciliation precedent (`prediction.ts:36-39, 100-124`) extends, it does not fork. Any mechanic that can't be expressed that way doesn't ship.

## Tuning appendix (the one table to argue about)

| Constant (proposed) | Value | Anchor |
|---|---:|---|
| `JUMP_VELOCITY` | 335 (was 303) | apex 47 px, airtime 0.55 s |
| `GRAVITY_RISE / APEX / FALL` | 1250 / 900 / 2200 (was flat 1350) | apex band \|vh\| ≤ 80; landing ≈ 445 px/s |
| `POUND_MIN_HEIGHT` | 24 px | below = keep today's buffer semantics |
| Pound gather / slam / recovery | 0.10 s / vh −1400 const / 0.25 s | press→impact 0.13–0.22 s |
| Pound AoE / damage / knockback / stagger | r 90 px / 10 + 0.1·h (cap 26) / 260 px/s / 0.35 s | one light hit + spacing |
| Pound `jumpCd` on impact | 0.9 s | vs 0.7 base |
| Hold threshold / crouch | 0.15 s / 0.50 s fixed | tap ≤ 0.15 s stays the old jump |
| Leap speed / vh / airtime / reach | 620 px/s / 380 / 0.60 s / ≈372 px | clears 4 tiles (320 px) +16% |
| Soft-lock steer | ≤ 45°/s (±27° total) | fudge, never U-turn |
| `leapCd` / landing `jumpCd` / landing speed dip | 2.5 s / 0.4 s / 60% recovering at 2600 px/s² | cycle avg 298 px/s < MOVE_SPEED |
| Thump tiers | <300 / 300–520 / >520 px/s (+0.3× horizontal) | standard = T2, pound & leap & juggle-fall = T3 |
| Shadow scale/alpha | 1.0→0.82 / 1.0→0.6 over 0–60 px | quake-immunity legibility |
| Ask to enemy-combo panel | keep-reset vh 360 → 400 | enemy lofts stay above voluntary jumps |

Through-line: the tap stays sacred, every new input lives on held/mid-air Space, every height is deterministic and predicted, every landing pays out on one tiered thump system, and nothing airborne ever becomes a dodge.
