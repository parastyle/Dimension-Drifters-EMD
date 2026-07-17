# Dual-Wield — Client Tech Spec (rendering, playback, UX surfaces)

Panel: dual-wield system for one-handed weapons of the same class (user directive).
Role: CLIENT TECH IMPLEMENTER. Companion docs in this folder own the systems law (which
weapons may pair, damage/cadence math) and the server law (state fields, acceptance,
hitboxes). Where this doc names a synced field or a message, the server doc is the
authority on the final name; the shapes below are what the client needs to exist.

Ground rule inherited from everything read for this spec: the client never invents combat
truth. One `attackSeq` stream per player stays the only attack wire; the pair renders from
it deterministically.

---

## 1. What ships today (the precedent, and where it breaks)

### 1.1 The authored-dual mount path (SpriteRig.ts)

`SpriteRig.equipWeapon(spriteId, def, manifest)` (SpriteRig.ts:1951) builds
`this.weapons[]` — one entry per hand:

- Entry 0 = `manifest.parts[0]` attached to the FRONT hand; entry 1 exists only when
  `def.dual && manifest.parts.length >= 2` and attaches `parts[1]` to the BACK hand
  (SpriteRig.ts:1982-1984).
- Each entry stores `{ img, hand, baseScale }` where `baseScale = def.displayLength / part.w`
  and the origin is `worn ? 0.4 : def.gripFrac` (SpriteRig.ts:1976-1977).
- Exactly ONE `this.weaponDef` drives everything downstream: idle rest angle, swing-style
  dispatch, combo family selection, melee tell, tome visual, `weaponLengthScale`,
  `attackScaleY`.
- Z-stack has three authored branches (2H / dual / single, each with a worn sub-branch)
  built once at equip (SpriteRig.ts:1988-2021).
- Render pass: entry 1 rotates by `backWeaponAngle` when a pose set it, else mirrors
  `weaponAngle`, plus a fixed `off = 0.32` lean (SpriteRig.ts:5427-5432). Off-hand travel
  comes from `swingBackOffX/Y`; the rake/scissor close-blade sampler
  (`sampleCloseBladePose`, SpriteRig.ts:347) emits `backAngle/backGrip*` and already knows
  `hasRearWeapon = this.weapons.length > 1` (SpriteRig.ts:4633).
- Alternation precedent: authored combo steps carry `hand: "lead" | "off" | "both"`
  (melee.ts:136, e.g. twin-bowie rake steps at melee.ts:275-322), and jiggle ownership
  routes `ownFront/ownBack` off that field (SpriteRig.ts:4455-4456).

### 1.2 The dual assumption that breaks for arbitrary pairs

Everything above assumes the two pieces are **two parts of one sprite sharing one def**:

1. **One `displayLength`/`gripFrac`/`worn` for both hands.** A paired bowie (62px,
   gripFrac 0.16) + hatchet (~90px, different grip) cannot share `baseScale` inputs, the
   origin, or `businessLength` fed to the close-blade sampler
   (`poseInput.businessLength = (1 - mountOrigin) * def.displayLength`, SpriteRig.ts:4629).
2. **`parts[1]` as the off-hand texture.** An arbitrary off-hand weapon's art is ITS OWN
   manifest's `parts[0]`; its `parts[1]` doesn't exist (only authored duals slice two).
3. **One swing vocabulary.** `meleeComboSelectionFor(def, style)` picks one family; a
   dagger + short-sword pair has two families. The rig has one combo-state block
   (`comboFamily/comboStep/...`, SpriteRig.ts:997-1014).
4. **One equip-change key.** `ArenaScene.equipWeapons()` re-equips only when
   `this.equipped.get(id) !== player.weapon` (ArenaScene.ts:2326) — a string, not a pair.
5. **One weapon id for VFX/audio/HUD.** `spawnSlash → vfxPlayer.playSwing(weapon.id, …)`
   (ArenaScene.ts:9037), `playWeaponSourceAudio(weapon, …)`, junction resource line, the
   `activeSig` (ArenaScene.ts:8484-8490) — all single-def.
6. **One beam per owner.** `BeamRenderer` rows and the dock's beam status key off
   `state.beams.get(self.id)` (ArenaScene.ts:8204) — a per-owner singleton.

---

## 2. Rendering two arbitrary weapons

### 2.1 Per-hand weapon spec inside the rig

Extend the `weapons[]` entry from `{ img, hand, baseScale }` to carry its own identity:

```ts
type HeldPiece = {
  img: Phaser.GameObjects.Image;
  hand: { img; ox; oy };
  baseScale: number;      // thisDef.displayLength / part.w  (already per-part)
  def: WeaponDef;         // NEW — per-hand def (displayLength, gripFrac, gun, tags…)
  worn: boolean;          // NEW — isWornWeapon(def) per hand
  spriteId: string;       // NEW — for VFX/texture bookkeeping
  tellRim?: Image; tellEcho?: Image;   // unchanged, lazily allocated
};
```

New equip entry point (keep the old one as a wrapper so nothing else churns):

```ts
equipLoadout(lead: { spriteId; def; manifest },
             off?: { spriteId; def; manifest }): void
// equipWeapon(spriteId, def, manifest)  →  equipLoadout({...}, def.dual ? same-manifest-part-2 : undefined)
```

Rules:

- Lead attaches `lead.manifest.parts[0]` to the front hand. Off attaches
  `off.manifest.parts[0]` to the back hand — **not** `parts[1]`. The authored-dual path
  (`def.dual`) becomes the degenerate case: off = same manifest, `parts[1]`, same def.
- Origin and scale resolve per hand from that hand's def (`worn ? 0.4 : def.gripFrac`;
  `def.displayLength / part.w`). Two different sprites now each hold their true size —
  no shared `baseScale` assumption anywhere.
- Z-stack: reuse the existing dual branch but test worn-ness **per hand** (worn claw in
  one hand, held dagger in the other must interleave correctly: worn piece over its hand,
  held piece under its hand). This is a 4-way interleave of the two existing sub-branches,
  built once at equip like today.
- `this.weaponDef` stays = the LEAD def (idle pose, facing rules, tell defaults). Every
  read that concerns the off-hand piece must migrate to `weapons[1].def`; §7 lists them.
- `weaponLengthScale`/`attackScaleY` (signature channels) apply per-hand only when the
  swing owns that hand — the render pass already has the branch point at
  SpriteRig.ts:5430-5435; scale by `w.def`-derived base instead of the shared `base`.

### 2.2 Idle pose for a mixed pair

Idle rest angle today is computed once (`restA`, SpriteRig.ts:4390) and copied to entry 1
plus the 0.32 lean. Keep that — it already reads well for twin knives — but derive the
lean from the off def's size so a hatchet doesn't hover like a toothpick:
`lean = 0.32 * clamp(offDef.displayLength / leadDef.displayLength, 0.7, 1.3)`. Cheap, no
new authoring.

### 2.3 Art loading

`ArenaScene.equipWeapons()` must ensure BOTH sprites: call `ensureWeaponArt` for lead and
off ids; if either is pending, `rig.unequip(def)` (the existing "empty hands while
loading" rule, ArenaScene.ts:2334-2340) — don't equip half a pair, it reads as a bug. If
the OFF art 404s (`failedArt`), equip lead alone and log — the pair still fights (server
truth), only the off-hand render degrades.

Equip-change key becomes the pair signature: `equipped.set(id, `${player.weapon}|${player.offWeapon}`)`.

---

## 3. Per-hand swing playback from one attackSeq — the HAND PARITY LAW

### 3.1 The law (coordinate with the server doc)

One synced `attackSeq` (uint32, PlayerState state.ts:146) remains the only beat stream.
The hand for a beat is a **pure function of the sequence number**:

```ts
// packages/shared — single source of truth, used by server hit application,
// server ammo/cooldown ledger, and client rig/VFX/muzzle routing.
export function dualHandForSeq(attackSeq: number): 0 | 1 {   // 0 = lead, 1 = off
  return (attackSeq & 1) as 0 | 1;
}
```

Why parity-of-seq and not a synced hand bit or a pair-anchored counter:

- **Wrap-safe**: 2^32 is even, so parity is continuous across the uint32 wrap the whole
  attack pipeline already guards (`>>> 0` deltas, e.g. ArenaScene.ts:6413).
- **Prediction never drifts**: the local client predicts `localPredictedAttackSeq + 1`
  (ArenaScene.ts:6415) and plays that parity's hand instantly. If a predicted beat is
  later rejected, the next ACCEPTED seq re-derives the hand — there is no client-side
  toggle to desynchronize. This is the same reason `comboStepForChain` moved to
  seq-derived stepping.
- **Remote-cheap**: observers compute the hand from the seq they already consume in
  `routePlayerAttacks` (ArenaScene.ts:2368); zero new wire bytes.

Cost: the first swing after pairing may start on the off hand (seq parity is arbitrary at
pair time). That is a one-beat cosmetic quirk, invisible in play. If the systems designer
wants "lead always opens", the server doc must sync a `pairSeq` anchor and the law becomes
`(attackSeq - pairSeqAtPair) & 1` — the client consumes either through the same shared
function, so this decision is isolated to shared+server. **Ask: pick one in the server
doc; the client spec assumes plain parity.**

Strict alternation is also the cadence law the client mirrors: the server accepts a beat
when the NEXT hand (by parity) is off cooldown. `sendAttack`'s `localAtkCd`
(ArenaScene.ts:6392-6406) becomes two mirrors (`localAtkCdLead/Off`); the send gate and
the predicted descriptor use the next-parity hand's `def.cooldown × lootCooldownMult(thatHand's affix)`.

### 3.2 Rig routing

`triggerSwing(timeMs, aimWorld, swing)` gains the hand on the descriptor
(`SwingDescriptor.hand: 0 | 1`, filled by both callers from `dualHandForSeq`):

- **hand = 0 (lead)**: exactly today's playback. Off-hand piece holds guard (`restA` +
  lean), receiving no `backWeaponAngle` unless the lead pose authors one (scissor).
- **hand = 1 (off)**: mirror of the existing `offUsesBack` rake branch
  (SpriteRig.ts:4753-4760) generalized to every style: the sampled pose writes
  `backWeaponAngle` / `swingBackOffX/Y` / `ownBack`, while the lead settles from its prior
  hold exactly like the rake's "lead glove settles" branch. Implementation: the style
  dispatch already computes `weaponAngle/swingOffX/Y`; add a post-dispatch swap —
  `if (swingHand === 1) { backWeaponAngle = weaponAngle; swingBack = swingOff; weaponAngle = settleToward(restA); swingOff = 0; }`
  plus the ownership swap (`ownBack ↔ ownFront`). Poses that author BOTH hands
  (scissor, `hand:"both"` steps) bypass the swap — they only fire on authored duals whose
  family guarantees two identical pieces.
- **Per-hand pose vocabulary**: the descriptor's style/family/def come from the FIRING
  hand's def (`swingDescriptorFor(handDef, …)` at both call sites —
  `triggerAcceptedRigAttack` ArenaScene.ts:2419 and `sendAttack` ArenaScene.ts:6409). The
  close-blade sampler inputs (`businessLength`, `targetTipRadius`, mount origin,
  SpriteRig.ts:4620-4634) read the firing hand's def.
- **Per-hand combo chains**: duplicate the combo-state block per hand
  (`comboFamily/comboStep/comboExpiresAt/...` ×2, indexed by hand). A hand's chain
  advances only on that hand's beats; since hands strictly alternate, the per-hand beat
  index is `seq >> 1`, so `comboStepForChain` works unchanged fed with that hand's last
  accepted snapshot. V1 simplification (recommended): cap paired playback at each family's
  first two steps — alternating full three-step sentences across two families reads as
  noise at 0.18–0.3s cadences; revisit after feel review.
- **Melee tell** (`tellRim/tellEcho`): allocated on the firing hand's entry only; the
  existing lazy allocation already supports per-entry layers.

Off-hand timing derivation: there is none to derive — the off beat IS a first-class beat
with its own accepted epoch and its own descriptor (off def's effective cooldown). The
"stagger" emerges from the server's alternating acceptance, not from a client-side offset.
This keeps hit-stop/freeze mapping (`presentationEpochForWallEpoch`) untouched.

---

## 4. Per-hand PER ribbons, muzzle flashes, beams

### 4.1 Melee ribbons (VfxPlayer)

`spawnSlash` and the remote observed path pass `weapon.id` into
`vfxPlayer.playSwing(id, x, y, ang, radius, swing, element)` (ArenaScene.ts:9037-9045).
With per-hand defs, each beat passes the **firing hand's** weapon id — so each hand's
authored suite (WEAPON_VFX ribbons, hero skins, spawnAtCursor, element tint) drives its
own beats with zero VfxPlayer changes. One beat = one suite spawn, so the pool cap of 12
(VfxPlayer.ts:245) sees the same load as a fast single weapon — no budget change.

Anchor: add the firing hand's lateral offset so twin ribbons visibly originate from
different hands. Expose on the rig:

```ts
/** World-space anchor of a hand's held piece (post-jiggle, post-lift). */
handWorldAnchor(hand: 0 | 1): { x: number; y: number };
```

reading `weapons[hand].img` through `root`'s transform — the muzzle-flash fix (§29
"rendered barrel, not raw state") already established that rendered-transform anchoring is
the rule.

### 4.2 Gun pairs — per-hand muzzle flash + tracers

- **Predicted (self)**: `sendAttack`'s gun branch (ArenaScene.ts:6475-6502) resolves the
  firing hand via predicted parity, uses THAT hand's def for `gunMuzzleReach(handDef)`,
  `bulletKind`, `muzzle`, `muzzleColor`, element tint, recoil (`shakeCam` per-hand
  `gun.recoil`), and shot audio — then offsets the flash by `handWorldAnchor`. Two
  different guns paired = two different flash/tracer/sound profiles interleaving, free.
- **Authoritative (all clients)**: `syncProjectiles`' flash block
  (ArenaScene.ts:4537-4557) currently derives reach from `p.weapon`. It must pick the
  hand's def. Preferred: the server doc stamps each projectile with `hand: uint8` (it
  knows which magazine it debited). Fallback if the field is declined: derive from the
  shooter's `attackSeq` parity at spawn — racy across a same-frame double-kill of the seq
  but only misplaces a flash by ~16px for one frame. **Ask the server doc for the
  projectile `hand` field.**
- `lastSelfMuzzleAt` suppression (150ms, ArenaScene.ts:4537) stays global per shooter —
  alternating hands can't legitimately double-fire inside 150ms unless both cadences are
  extreme; if a gatling pair breaks this, make it `lastSelfMuzzleAt[hand]`.

### 4.3 Beams (casters pairing)

`BeamRenderer` rows, prediction state (`beamPrediction*`, ArenaScene.ts:1540-1547), the
dock beam status, and the wire are all one-beam-per-owner. Recommendation to the systems
designer: **v1 — a beam weapon may pair only as the LEAD, and RMB channels the lead beam
only; the off hand contributes its stat identity per the systems law, not a second beam.**
Dual visible beams need: beam rows keyed `${ownerId}:${hand}` (schema), a doubled
`MAX_PLAYERS` pool in BeamRenderer, per-hand heat HUD, and a sweep-lag law for two beams
sharing one aim — a panel of its own. `BeamRenderState.ownerId` is already a string key,
so the renderer generalizes later without rework; do not build it now.

---

## 5. Pairing UX — where, affordance, ceremony

Systems designer owns eligibility (1H + same class) and economy; this is the client flow.

**Where: the BAG panel** (`renderBagPanel`, ArenaScene.ts:8785). It is the only surface
where the player already sees held weapon + candidates together, and it's the low-stakes
moment (bag open = deliberately paused intent). The shop overlay keeps SELL semantics
untouched.

- With the bag open and the HELD weapon pair-eligible, every bag cell holding an eligible
  partner renders a `⚯` badge in its top-right corner and its border pulses (existing
  rarity stroke, +alpha pulse — reuse the grab-highlight pulse math ArenaScene.ts:6588).
- Click on a badged cell sends the new message (name per server doc; placeholder
  `bagPair { index }`). Non-badged cells keep today's `bagEquip` behavior — pairing is an
  additive affordance, not a mode.
- **Unpair**: when a pair is held, the bag title row gains an `UNPAIR ⚯` text button
  (needs one free bag cell — the server rejects otherwise and the client flashes the
  existing red banner path). Placeholder message `unpair {}`.
- **Confirmation**: none beyond the click — consistent with bagEquip/bagStore which are
  single-click and reversible. Pairing is reversible via unpair, so a modal would be
  ceremony in the wrong place.
- **The ceremony moment** (paper-cutout language, §50 paper panel): on the ACCEPTED pair
  (pair signature changes in state — the same edge that re-equips the rig), play a ~450ms
  non-blocking flourish: both pieces snap to the twin-bowie crossed-guard pose
  (the rake sequence's crossed hold already exists as an authored pose), a white
  `rig.flash`, one new audio cue (`pair` — a two-note metallic shing; falls back to
  `grab`), and `flashBanner("PAIRED — Bowie Fang × Rat-Tooth", rarityColor)`. Remote
  players see the same flourish from the same state edge — no extra wire.

---

## 6. Dock representation — INTEGRATION REQUIREMENTS for the dockux implementation

`docs/dockux-panel/` is redesigning dock+backpack; this spec does **not** restyle the
dock. Requirements the dockux implementation must absorb (written as contracts, not
pixels):

1. **A pair is ONE roster entry.** Q/E cycling, junction index ticks
   (`layoutCarouselDock` ArenaScene.ts:8155-8171), slot chips, and `wrappedDockOffset`
   all treat the pair atomically. Never render lead and off as separate cycle positions.
2. **Split junction card.** The selected-entry card must render TWO icons for a pair —
   recommended: diagonal split, lead icon upper-left, off icon lower-right, each keeping
   its own rarity edge tint; single-weapon rendering unchanged. Name line format:
   `"FANG × RAT-TOOTH"` with the existing 17-char ellipsis rule
   (ArenaScene.ts:8199).
3. **Resource line supports two readouts** (see §7). Contract: the junction exposes TWO
   resource slots; slot 2 hidden for single weapons.
4. **Neighbor chips**: a paired entry shows the lead icon with a `⚯` corner glyph (chips
   are too small for two icons at tier-2/3 sizes — weapon-dock-layout.ts:47-72).
5. **Focus/detail card** (`buildCard`/`refreshCarouselDockCard`): lead card full-size with
   an off-hand summary strip (name, damage, cooldown, grades line); the combined-output
   number comes from the systems doc's math, displayed once — do not show two DPS numbers.
6. **Pair/unpair affordance parity**: whatever drag/drop grammar dockux lands for
   bag↔slot moves must include a "drop onto held to PAIR / drag off-half out to UNPAIR"
   path that sends the SAME messages as §5 — one wire contract, two surfaces.
7. **Data access through one helper.** To keep dockux from scraping PlayerState in five
   places, the client will provide a pure view helper (new file or shared):
   `loadoutEntryView(self) → { leadId, offId?, rarity, affix, offRarity?, offAffix?, charges..., pairKey }`
   — the dock, arsenal chips (`slotView` ArenaScene.ts:8581), bag panel, and HUD text all
   read it. `weapon-dock-layout.ts` itself stays pure geometry and needs **no change**
   (the junction split is drawn inside the junction square it already positions).

Interim (pre-dockux): the current junction gets the split-icon treatment and second
resource row only — no chip/detail work — so dual-wield doesn't block on the redesign.

## 7. HUD truth — per-hand ammo/reload

Server doc fields the client consumes (mirroring the existing single-hand set,
state.ts:79-86): `offWeapon`, `offWeaponRarity`, `offWeaponAffix`, `offCharges`,
`offMaxCharges`. Empty string `offWeapon` = not paired (matches the `weapon === ""` slot
convention).

- **Junction resource** (`updateCarouselDockJunction` ArenaScene.ts:8208-8217): for a gun
  pair render two compact rows — `▮ 12/24` / `▮ 6/9` — each with its own color law
  (red RELOAD / amber last-25% / parchment), lead on top. The hand that fires NEXT
  (predicted parity) renders at full alpha, the other at 0.7 — the player reads the
  alternation without a tutorial.
- **Top weaponText** (ArenaScene.ts:7750-7780): append the off segment after the lead's:
  `⚔ Fang ◆◆◇ × Rat-Tooth ▮ 6/9`. Color rule: the line takes the WORST state of the two
  (either reloading → red) since it's a glance surface.
- **Two small bars**: not needed as new art — the two junction rows ARE the per-hand
  bars. Do not add floating world-space ammo bars; nothing else in the HUD floats over
  the rig and §37 clean-minimal says no.
- **sendAttack gating** (ArenaScene.ts:6400): gate the predicted shot on the FIRING
  hand's charges (`hand ? offCharges : charges`); an empty off hand means the server will
  fire the lead next regardless of parity — **coordination point**: the server doc must
  state the starvation rule (skip-to-ready-hand vs stall). Client mirrors whichever via
  the shared `nextDualHand(seq, leadReady, offReady)` helper — keep the rule in shared.

## 8. Remote players seeing pairs

- `equipWeapons()` pair signature (§2.3) re-equips remote rigs when either half changes;
  both manifests lazy-load per the existing `ensureWeaponArt` flow.
- Remote swings: `routePlayerAttacks` is already seq-driven; `triggerAcceptedRigAttack`
  picks the hand def via `dualHandForSeq(player.attackSeq)` and `player.offWeapon`, so
  observers replay the exact alternation the owner predicted — same law, same inputs.
- Remote source audio (`playWeaponSourceAudio`) and observed-signature ribbons follow the
  firing hand's def through the same call sites — no observer-specific code.
- Remote gun flashes: §4.2 (projectile `hand` field ask).
- Join-in-progress: the first observed beat path (ArenaScene.ts:2380-2391) works unchanged
  — parity comes from the synced seq, not from history.

## 9. Prediction edges

- **Swap-to-pair mid-fight**: the pair-signature change lands like any weapon swap —
  `equipLoadout` runs `resetSwingCombo/resetSecondaryMotion/clearMeleeTellState`
  (SpriteRig.ts:1959-1961), killing the in-flight pose; `localPredictedAttackSeq`
  continuity is untouched (it's per-player). The ceremony flourish (§5) plays over the
  fresh idle. Predicted beats sent before the pair message resolves are accepted against
  the OLD loadout by the server — the client's per-beat descriptor is built from the def
  it held at press time, matching.
- **Rejected predictions**: parity self-heals (§3.1) — the defining reason for the law.
  A ghost lead swing followed by an accepted beat on the same parity replays the same
  hand; no correction pass needed.
- **Unpair while firing**: `equipLoadout` destroys the off img mid-swing — safe: pose
  closures capture defs (values), not images; the quake `delayedCall` guards `this.room`
  (ArenaScene.ts:6456); VfxPlayer surfaces own their own lifetime. If the destroyed hand
  was mid-`triggerSwing`, the reset already blanks the swing exactly like today's swap.
- **Unpair/pair while a beam channels**: v1 forbids beam off-hands (§4.3); pairing WHILE
  channeling a lead beam is server-rejected until release (server doc) — client needs no
  special case beyond the banner.
- **Charges desync**: predicted flash gated on the predicted hand's charge field; a
  mispredicted hand (starvation rule edge) costs one flash at the wrong barrel for one
  beat — cosmetic, self-corrects, matches the existing 150ms-suppression tolerance class.

## 10. LOD

- Off-screen rigs already skip jiggle (`JIGGLE_LOD_MARGIN_PX`, SpriteRig.ts:4030-4034)
  and remote signature art (`REMOTE_SIGNATURE_LOD_MARGIN_PX = 220`, SpriteRig.ts:1618).
  A pair adds ONE Phaser Image per remote rig — negligible; it rides the same skips.
- Tell layers (`tellRim/tellEcho`): allocate for the firing hand only (already lazy);
  under the horde-lite tell path they never allocate — unchanged.
- VFX: one ribbon per beat (§4.1) — alternation does not double the spawn rate; the
  12-surface pool and `flashedShooters` one-flash-per-frame set hold as-is.
- Dock split icons render once per selection change (retained objects), no per-frame cost.

## 11. File / function touch list

**packages/shared** (coordinate — server doc co-owns):
- `src/weapons.ts` or `src/melee.ts` — `dualHandForSeq()`, `nextDualHand()` (starvation
  rule), pair-eligibility predicate (systems law), `loadoutEntryView` type.
- `src/state.ts` — consumed only: `offWeapon/offWeaponRarity/offWeaponAffix/offCharges/offMaxCharges`,
  projectile `hand` (server doc authors these).

**packages/client/src/entities/SpriteRig.ts**:
- `weapons[]` entry shape (`def/worn/spriteId`), `equipLoadout()` (+ `equipWeapon` wrapper),
  per-hand z-stack interleave, per-hand origin/scale.
- `triggerSwing` hand routing + post-dispatch hand swap; per-hand combo-state block;
  close-blade `poseInput` per-hand lengths; per-hand tell allocation; idle lean;
  `handWorldAnchor(hand)`.

**packages/client/src/scenes/ArenaScene.ts**:
- `equipWeapons()` pair signature + dual `ensureWeaponArt`; `routePlayerAttacks` /
  `triggerAcceptedRigAttack` hand-def selection; `sendAttack` dual cooldown mirrors,
  per-hand gating, per-hand predicted muzzle/cast flash + audio; `syncProjectiles`
  hand-aware flash; `spawnSlash` firing-hand def; `playWeaponSourceAudio` per-hand;
  `updateCarouselDockJunction` second resource row + `activeSig`/`heldSig` extension;
  weaponText off segment; `renderBagPanel` pair badge + `bagPair`/`unpair` sends +
  unpair button; ceremony flourish on pair-signature edge.

**packages/client/src/ui/weapon-dock-layout.ts** — no change (pure geometry holds).
**packages/client/src/scenes/arena/card-art.ts** — split-icon compositing for the interim
junction; detail-card off-strip lands with dockux.
**packages/client/src/vfx/BeamRenderer.ts** — no change in v1 (lead-only beams).

## 12. Test strategy

- **shared**: `dualHandForSeq` parity table incl. uint32 wrap (0xFFFFFFFF → 0 keeps
  alternation); `nextDualHand` starvation-rule table (both-ready / one-empty / both-empty)
  — MUST mirror the server doc's cases verbatim so both suites pin the same law.
- **close-blade-pose.test.ts** (exists, pure sampler): extend with asymmetric
  `businessLength` inputs — back-hand angle/grip derive from the off def's length; scissor
  regression pinned for authored duals.
- **Rig routing**: extract the post-dispatch hand swap into a pure function
  (`routeSwingChannels(sample, hand)` — inputs/outputs are plain numbers) and table-test
  lead/off/both routing; SpriteRig stays untestable-Phaser but the decision logic isn't.
- **Prediction reconcile** (prediction.test.ts style): scripted seq streams — predicted
  5,6 with 6 rejected, next accepted 6 → hand replays parity-0; verifies no drift.
- **Dock/HUD**: `loadoutEntryView` pure tests (paired/unpaired/empty-off/fists).
- **Lint/type**: local `pnpm lint` CRLF failure is environmental (memory note) — rely on CI.
- **Manual verify matrix** (run via `verify` skill, two browser clients): different-length
  1H melee pair (alternation, ribbons per hand, combo cap), gun pair (interleaved ammo
  drain, per-hand reload colors, muzzle offsets, remote view), mixed melee+gun if the
  systems law allows, pair→unpair mid-swing, swap-to-pair mid-fight, belt-mode projection,
  off-screen LOD, art-404 off-hand fallback.
