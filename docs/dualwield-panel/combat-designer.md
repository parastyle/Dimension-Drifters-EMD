# Dual-wield pairs — moment-to-moment combat & animation design

Role: COMBAT/ANIMATION DESIGNER, dual-wield panel.
Feature: the player pairs two DIFFERENT one-handed weapons of the same class (`tags.grip: "1H"`, same `tags.classPool`) into ONE build choice.
Scope: feel, rhythm, animation, VFX, readability, and the deterministic per-hand law. Power/ammo/slot economics belong to the systems designer; render plumbing to the tech implementer. No source files are modified by this doc.

Bedrock read (all anchors current as of branch `feat/v0.117-feel-and-colossus`):

- Shipped dual rendering: `packages/client/src/entities/SpriteRig.ts:1948-2029` — `equipWeapon` attaches `manifest.parts[0]` to the front hand and, for `def.dual`, `parts[1]` to the back hand, each pivoted at `def.gripFrac` (or 0.4 when `isWornWeapon`), scaled to `def.displayLength / part.w`. **One def, one manifest, one displayLength for both hands** — the pair system's core render ask is per-hand defs.
- Shipped lead/off alternation: the close-blade pose (`SpriteRig.ts:420-585`) routes `hand === "off"` onto the BACK hand (`offStrikes`, `offUsesBack` at `:483`, `:4753`, `:4841`), parks the idle hand at guard, and swaps the planted foot (`:533`). The rake family already ships a lead → off → BOTH bar (`packages/shared/src/melee.ts:273-323`, scissor drag with `secondaryActiveStart`).
- Combo chain law: `comboStepForChain` (`melee.ts:1442-1471`) — uint32 advance guard, same-identity check, cadence window `comboGraceMs` = clamp(0.35 × effectiveCooldown, 120ms, 300ms) past readyAt (`SpriteRig.ts:587-590`). `comboStepForAttackSeq` (`melee.ts:1427-1432`) defines the wrap law: ordinal = `(seq - 1) >>> 0`.
- Attack beat sync: the server bumps `attackSeq` exactly ONCE per accepted attack of EVERY delivery — gun shot, thrown, cast, melee swing (`packages/server/src/rooms/GameRoom.ts:2522-2560`, `stampAttackBeat` `:2823-2828`). Synced as uint32 + `attackTick` + `attackHeld` (`packages/shared/src/state.ts:142-150`). Client consumes it via `setAttackBeat` (`SpriteRig.ts:1744-1758`) and the owner predicts `localPredictedAttackSeq + 1` (`ArenaScene.ts:6410-6416`).
- Swing clock: `swingDescriptorFor(def, effectiveCooldown)` (`melee.ts:1384-1423`), pose window = `SWING_WINDOW_FRAC` (0.64) × effective cooldown, chop impact at 0.52 (`constants.ts:592-593`).
- Per-weapon geometry: `gunMuzzleReach` = `GUN_HAND_FORWARD` (12) + `(1 − gripFrac) × displayLength` (`weapons.ts:314-318`); `meleeReach` floors range at the sprite tip (`weapons.ts:333-336`).
- Painted-edge ribbon (PER): per-step `comboRibbon` consumed by the rope/fallback renderers (`packages/client/src/vfx/vfx-render.js:466-534`) — profile, radialStart/End, widthMultiplier, end treatment.
- Paper-cutout recipes P1–P5: `docs/paper-panel/art-director.md` ("turn through the sheet" law; P1 through-plane turn 160ms, P3 two-piece fold, P5 ruffle 110ms).

---

## 0. The one law everything hangs on: THE METRONOME LAW

A pair is ONE weapon slot, ONE server attack stream, ONE `attackSeq`. The server keeps exactly one cooldown clock (`c.cd`) and stamps one beat per accepted attack, exactly as today. **Which hand acts is never sent over the wire — it is derived from the beat ordinal.**

> **Alternation law.** Let `n = (attackSeq − 1) >>> 0` (the shipped wrap law, `melee.ts:1427-1432`). For guns and casters, `hand(n) = n & 1 ? OFF : LEAD`. For melee, the hand comes from the six-beat pair bar's step table (§2.3), resolved through the shipped `comboStepForChain` with `sequenceLength = 6` — same duplicate-beat, snapshot-gap, weapon-change, and cadence-expiry restarts, byte-for-byte.

> **Interleave law (the rhythm of unequal cooldowns).** The wind-up belongs to the INCOMING weapon. After accepting hand H's attack, the server sets the gap to the OTHER weapon's effective cooldown scaled by the pair tempo:
> `c.cd = PAIR_TEMPO × effCooldown(nextWeapon)`, with `PAIR_TEMPO = 0.72` (systems designer owns the final constant; 0.72 is the feel target — see DPS note in §2.2).
> Full cycle `T = 0.72 × (c_A + c_B)`. Each weapon swings once per cycle. The fast weapon snaps in on a SHORT gap right after the heavy one lands — a pickup note after the downbeat — and the heavy weapon arrives on a LONG gather. Unequal pairs are syncopated by construction; equal pairs degenerate to a clean metronome.

Everything below — melee bars, gun triggers, cast rhythm, ribbons, remote playback — is this one law wearing three different class costumes.

---

## 1. MELEE PAIRS

Worked pair used throughout: **Rattler Sabre** (`rattler-sabre`: cooldown 0.30s, displayLength 100, swingArc 2.4, style arc, dex-forward, `weapons.ts:817-828`) + a heavier 1H hand-axe archetype ("Spitting Hatchet": cooldown 0.55s, displayLength 84, style chop) — the expansion batch's 1H axes slot here; Voltedge (`x-sword-neon-katana`, 0.28s) + Sabre is the near-equal degenerate case and needs no special handling.

### 1.1 Per-hand SwingDescriptors — each weapon keeps its own voice

Each accepted beat builds its descriptor **from the weapon that is actually swinging**, timed by the gap that preceded it:

- Beat gap `g_n = 0.72 × effCooldown(weapon_n)` (loot affix applied, as today at `GameRoom.ts:2557`).
- Descriptor: `swingDescriptorFor(def_hand, g_n)` → pose window `0.64 × g_n`, style from `def_hand.swingStyle` (sabre arcs with active 0.16–0.74 of pose; hatchet chops with active 0.30–0.52, impact at the authored 52% landing).
- The rig plays the beat on the hand from the alternation law: lead beats run the existing front-hand paths; off beats route through the shipped `offUsesBack` seam (`SpriteRig.ts:4753`, `:4841`) — rear hand owns the swing envelope (`ownBack = own`, `:4456`), lead weapon settles to guard exactly as the rake off-step already does (`:4756-4760`).

**Sabre + Hatchet timeline (ms from bar start), PAIR_TEMPO 0.72:**

| beat | hand | weapon | gap before | pose window (0.64×gap) | active window | impact |
|---|---|---|---|---|---|---|
| 0 | lead | sabre (arc, forehand) | 216 | 138 | 22–102 | ~74 |
| 1 | off | hatchet (chop, shoulder) | 396 | 253 | 76–132 | 132 |
| 2 | lead | sabre (arc, reverse) | 216 | 138 | 14–83 | ~62 |
| 3 | off | hatchet (chop, rising reverse) | 396 | 253 | 35–127 | 127 |
| 4 | lead | sabre (arc, overhead spike) | 216 | 138 | 39–83 | 72 |
| 5 | BOTH | **Crossfall finisher** | 396 + 100 gather | 317 | see §1.4 | 149 |

Bar length ≈ 1.94s. Audible rhythm: *tick… THOCK… tick… THOCK… tick… CRASH* — a 3:5 swing. The hatchet is the downbeat; the sabre is the grace note. This is free characterization: pair a stiletto with a cleaver and the game plays a different drum pattern than dagger + dagger, with zero new animation code — the per-weapon descriptors ARE the rhythm.

### 1.2 Per-hand PER ribbons — each edge paints its own weight

Ribbons resolve per BEAT from the swinging weapon, not per pair:

- **Radial span** from that weapon's `meleeReach` (`weapons.ts:333-336`): sabre ribbon spans radial 0.30–1.0 of reach 132; hatchet spans 0.42–1.0 of its shorter reach — the axe's ribbon is a stubby, massed wedge; the sabre's a long open-c. Two visibly different arcs from one player, honestly sized (§14 WYSIWYG: ribbon span never exceeds the authoritative reach).
- **Width** from `tags.size`: S → widthMultiplier 0.85, M → 1.0 (both under the shipped ceilings enforced at `vfx-render.js:530-534`).
- **Weight** from cooldown: ribbons for beats with gap ≥ 300ms take end `"torn"` or `"squared"` + `setupEcho: "neutral-dim"` (the heavy hand telegraphs its gather); gaps < 250ms take `"clean"` ends, no echo.
- **Tint**: each hand's ribbon uses ITS weapon's element tint; both keep the wielder's co-op outline color (readability, §5).
- **Off-hand attenuation**: off-beat ribbons render at 0.92 alpha and 8% narrower than the same profile on a lead beat — the lead hand is the melody line.

### 1.3 The pair combo grammar — the six-beat bar

Answering the panel question (lead-lead-both? adopt lead's combos?): **adopt the LEAD weapon's family combo as the spine on lead beats; the OFF weapon interleaves its own family's first two steps as accents; beat 6 is the paired finisher.** Neither weapon's 3-step solo combo plays verbatim — the pair has its own bar, built from parts both weapons already own:

```
PAIR_BAR (sequenceLength = 6)
beat 0  lead  leadFamily[0]        (opener)
beat 1  off   offFamily[0]         (accent)
beat 2  lead  leadFamily[1]        (reverse)
beat 3  off   offFamily[1]         (reverse accent)
beat 4  lead  leadFamily[2]        (the lead's finisher, DEMOTED to a spike:
                                    knockback halved, ribbon width ×0.9 —
                                    it must not outshine beat 5)
beat 5  BOTH  CROSSFALL            (§1.4)
```

- Families come from each weapon's own `meleeComboSelectionFor` resolution (`melee.ts:1251-1333`); signature variants (hero-spin etc.) resolve for the family lookup only — note `hero-spin` already excludes duals (`melee.ts:1305` requires `!def.dual`), which is correct here too: pairs get the bar, not solo signatures.
- LEAD is a player choice at pairing time (drag order / hand icon on the pair card — coordinate with the dock UX redesign in flight, `docs/dockux-panel/`). Swapping lead/off is a free re-pair and re-runs the ceremony (§4.2).
- Chain bookkeeping reuses `comboStepForChain` unchanged with `weaponId = pairId`, `family = leadFamily`, `sequenceLength = 6`. Cadence window per incoming beat = `comboGraceMs(g_{n+1})` — dropping the trigger mid-bar restarts at beat 0 after 120–300ms, exactly the shipped feel.

### 1.4 The paired finisher — CROSSFALL

The payoff for committing to the bar: **both weapons strike together**, generalizing the rake scissor (the shipped both-hands precedent, `melee.ts:302-322`).

- **Gather**: gap before beat 5 = `0.72 × max(c_A, c_B) + 100ms`. During the last 140ms both weapons draw to opposite chambers (lead at `aim − 1.35 rad`, off at `aim + 1.35 rad`), body crouches `scaleY × 0.94` — the extra tenth of a second is the inhale that tells everyone the big one is coming.
- **Strike** (pose window 317ms in the worked pair, timing fractions of pose): lead sweeps forehand `direction +1`, active 0.20–0.52; off sweeps reverse `direction −1`, active 0.26–0.58 (the scissor's 0.06 stagger — simultaneous reads as one fat blur; 0.06 apart reads as two blades meeting); shared `impact: 0.47`, `followEnd: 0.80`. Path authoring (stage-1 inert, like all `path` data): `kind: "dual-sweep"`, `arcMultiplier 0.9`, `rangeMultiplier 1.05`, `damageMultiplier 1.30`, `knockback 84`.
- **Body**: paper-crush at the cross — `scaleX × 0.80`, `scaleY × 0.93` peaking over the impact ±0.25 window, `rotation` wobble ±0.045 (the scissor's shipped body treatment, `SpriteRig.ts:4740-4744`), plus one P5 paper ruffle on contact.
- **Ribbons**: TWO ribbons, one per hand, mirrored `hooked-comma` profiles whose hooks meet at the aim line — tinted per weapon, forming an X. This is the only moment a pair shows two simultaneous ribbons (§5 cap).
- **Hold**: on kill or on bar end, weapons freeze crossed for the existing combo hold (`comboHoldPose`, release over `COMBO_HOLD_RELEASE_MS`) — the pair's poster pose.
- **Rest**: after beat 5, `c.cd = 0.72 × c_lead + 120ms` — the bar breathes before beat 0 returns.
- **Server truth**: per the stage-1 residual law (`SpriteRig.ts:4476-4477`), damage per beat remains the shipped single centered sweep resolved from the SWINGING weapon's stats (the server derives hand from seq identically — it owns seq). Crossfall's dual path and 1.30 multiplier are authored data awaiting the accepted-path protocol; day one it deals the lead weapon's sweep. Ship it anyway — the rhythm and the X are the feature.

### 1.5 Mixed mounts

If one weapon is worn (claw/knuckle, `isWornWeapon`, `melee.ts:1357-1362`) and the other held, each hand resolves its own mount independently: per-piece origin (0.4 worn / `gripFrac` held, `SpriteRig.ts:1977`) and per-hand z-rule (worn: hand under weapon; held: weapon under hand — the two branches at `:1999-2008` applied per hand instead of per def). Bottom→top for a held-lead + worn-off pair: feet, body, off-HAND, off-WEAPON, lead-WEAPON, lead-HAND.

---

## 2. GUN PAIRS

Worked pair: **Revolver Cannon** (`x-gun-revolver-cannon`: fireRate 0.5, mag 6, reload 1.4s, slug/heavy muzzle, recoil 0.004) + **Ricochet Pistol** (`x-gun-ricochet-pistol`: fireRate 0.34, mag 8, reload 1.2s, ricochet/spark muzzle, recoil 0.002).

### 2.1 Alternating barrels

- `stampAttackBeat` already fires per gun shot (`GameRoom.ts:2522-2528`), so the metronome law applies directly: `hand(n) = n & 1`, gap before a shot of gun G = `0.72 × fireRate(G)`. Worked cycle: …REVOLVER —245ms— pistol —360ms— REVOLVER… (0.605s/cycle). Boom-crack-boom-crack, unevenly spaced: a gunslinger, not a metronome.
- **Both arms track aim.** Today the gun branch aims only the front hand (`SpriteRig.ts:4376-4383`). Dual guns: both weapon angles follow `aimLocal`; the OFF gun rides 0.09 rad below the aim line and 4px shorter extension when it isn't firing — two barrels, clearly one is "live".
- **Muzzle truth per hand**: flash + bullet spawn at THAT gun's `gunMuzzleReach(def_hand)` (`weapons.ts:315-318` — revolver muzzles at 12 + 0.88×94 ≈ 95px, pistol at ≈ 86px), displaced ±10px along the aim normal (lead +, off −, × `characterScale`). Two distinct flash origins are the strongest per-hand read in the game.
- **Shared reticle, converging fire**: each bullet's spawn ANGLE is `atan2(cursor − ownBarrel)` so the two offset streams converge at the cursor. Never parallel — parallel reads as a shotgun choke; convergence reads as two guns, one intent.

### 2.2 Recoil choreography

Per shot, applied to the FIRING hand only:

- Arm kick: weapon angle −(25 × recoil) rad instantaneous (revolver 0.10 rad, pistol 0.05 rad), ease-out recovery over 90ms.
- Grip slide: firing hand −6px along aim, recovering with the arm.
- Body: counter-rotation `±0.018 rad` alternating with the firing side, plus the gun's own camera `recoil` kick as shipped. The alternating body micro-twist is the "gunslinger shimmy" — at the worked cadence it oscillates at ~1.7Hz, visible but under the paper-ruffle ±0.12 rotation budget.
- Muzzle flash keeps each gun's authored `muzzle`/`muzzleColor` — heavy orange bloom left, spark-teal crack right.

### 2.3 Staggered reloads — one gun always lives

Requirement to systems: **independent per-hand magazines** (synced; see §6). Choreography:

- When gun A empties, A leaves the alternation and reloads for its own `reloadSeconds`; **B fires solo at its native `fireRate`** (not the pair gap) — the tempo audibly shifts from syncopated duet to steady solo, which IS the reload telegraph.
- Reload animation (paper-cutout): the empty gun flips DOWN through edge-on (P1, 160ms) to a hip carry, hangs open (a 2px white edge sliver blinks at 50% of reload — the "cylinder closed" tick), then flips back up with a 90ms overshoot snap. The living gun's arm raises 4px — covering fire.
- Re-entry: the returned gun rejoins on the next beat that the parity/liveness law (§6) hands it. Because mags are unequal (6 vs 8), reloads naturally desynchronize after the first cycle — the choreography self-staggers without any scheduling code, and simultaneous-empty (the ONLY dead window) happens at most once per ~3 cycles even if the player never feathers the trigger.
- Dual tracer identity: bullets keep per-gun `bulletKind`; the shared reticle gains two 3px side ticks (lead right, off left), each tinted per gun, blinking on that gun's shot and hollowing while that gun reloads. The reticle is the pair's ammo glance — no eyes-down to the dock mid-fight.

---

## 3. CASTER PAIRS

Both shipped casters are 2H staffs (`x-staff-arcane-lance`, `x-staff-storm-rod`) — this section specs the 1H wand/rod lane so the class ships pair-ready; the power model (shared vs per-hand cast cooldowns, INT scaling of the pair) is the systems designer's, and this visual grammar fits either.

- **Alternating cast hands**: metronome law over `cast.cooldown` — gap before hand H's bolt = `0.72 × castCooldown(H)`. Casts already stamp the beat (`GameRoom.ts:2546-2551`), so `hand(n) = n & 1` with no reload override.
- **Bolt truth per hand**: bolt spawns at the casting implement's tip (`implementTipReach` lane, `weapons.ts:320-321`) with that weapon's `bulletKind`/element — a frost wand and an ember rod paint alternating blue/orange streaks down the same aim line.
- **Twin glyphs (the idle identity)**: each hand traces a faint glyph ring — radius 14px, alpha 0.18, counter-rotating (lead +0.6 rad/s, off −0.6) — in its weapon's element color. On a cast, the casting glyph flares to alpha 0.85 / scale 1.35 and decays over 120ms while the other dims 40% for the same window. The cast HAND drives: wrist flick +0.22 rad, 3px forward jab, body lean 0.03 rad toward the casting side. Tome/page machinery (`setAttackBeat`'s tome path, `SpriteRig.ts:1760+`) stays single-implement; wand pairs use glyphs, not pages.
- **Conjunction (paired payoff, if the power model allows)**: every 6th beat, both hands cast together after a 120ms gather (glyphs swell to radius 22 and touch): twin bolts spiral around the shared aim line — helix radius 12px, period 140px — converging at the cursor. Damage = two ordinary bolts (WYSIWYG, no hidden multiplier until systems says otherwise); the braid is pure presentation. If systems declines, beat 6 is simply a both-glyph flare on an ordinary alternating cast.

---

## 4. THE PAIRED IDENTITY — a pair reads as ONE choice

### 4.1 Idle stance

Both drawn, deliberately asymmetric:

- Lead at the shipped rest (`restA = −π/2 + 0.16 + lookY tilt`, sway `sin(t × 2.6) × 0.04`, `SpriteRig.ts:4390-4391`).
- Off-hand at `−π/2 − 0.12` (mirrored, slightly lower), sway amplitude 0.03 at phase offset `+π × 0.37` — counter-phased but NOT anti-phased; perfect opposition reads mechanical, 0.37π reads alive.
- Guns: both barrels at aim (per §2.1); casters: twin glyphs (§3). Walking: the existing gait untouched — the silhouette cue is simply "two things in two hands, neither on the back".

### 4.2 The pairing ceremony — a paper-cutout moment (460ms)

On pair-equip (style-bible law: turns happen THROUGH the sheet, never in it):

1. **0–160ms**: lead piece flips in through edge-on (P1: `scaleX = cos(πq)`, skew 0.10 sin, face swap at q=0.5) into the front hand.
2. **70–230ms**: off piece runs the same P1 into the back hand (70ms stagger — one card dealt after the other).
3. **230–360ms**: both sweep to cross at chest height forming an X, 130ms hold; a 2px white edge-glint sliver flashes at the crossing point (the pickup-shimmer sliver rule, paper-panel §1); one soft card-snap SFX ("shk").
4. **360–460ms**: snap out to idle stance, 100ms, with one P5 body ruffle.

The X-cross is the pair's signature frame — the same X Crossfall lands on and the dock card fans into. One shape, three surfaces.

### 4.3 Dock card treatment

A dock UX redesign is in flight (`docs/dockux-panel/`) — these are pair REQUIREMENTS for that panel, not final art:

- ONE slot, one card: two mini weapon sprites fanned ±9°, lead in front.
- The cooldown sweep shows the PAIR CYCLE: a two-color wheel, arcs sized to each weapon's `0.72 × cd` share and tinted per element, live dot at the current beat. The wheel IS the rhythm made visible.
- Melee: six bar pips, the 6th larger (finisher), brightening as the bar fills; resets on chain expiry.
- Guns: two ammo pip rows (6 + 8 in the worked pair), the reloading row hollow with a sweep.
- Pairing/unpairing and lead-swap live wherever the dock panel puts loadout; the ceremony (§4.2) plays on every confirm.

---

## 5. READABILITY — two streams, one fighter

Rules, in priority order:

1. **One damaging ribbon at a time**, except Crossfall's crossed pair — the only 2-ribbon moment. Cap ribbons per wielder at 2, ever.
2. Off-beat attenuation (−8% width, 0.92 alpha, §1.2) keeps a hierarchy: lead = melody, off = counterpoint. In a 4-player co-op scrum, a dual wielder's output must not read as two players — both hands share the wielder's outline/co-op tint and differ only in element tint and origin hand.
3. Muzzle flashes never merge: the ±10px barrel offset (§2.1) plus per-gun flash styles guarantees two point sources; suppress-window logic (`lastSelfMuzzleAt`, `ArenaScene.ts:988-989`) applies per HAND, not per player, so predicted-vs-state flashes cannot double on one barrel while eating the other.
4. Enemy-facing clarity: the finisher gather (extra 100ms crouch + chambered X) is the pair's only extended telegraph, and it is body-language, consistent with the diegetic-telegraph work (§50). Ordinary alternation needs no telegraph — individual beats are no stronger than the solo weapon's.
5. Audio: per-hand source audio uses each weapon's own voice (`playWeaponSourceAudio` already keys off the weapon def, `ArenaScene.ts:2428+`); pan lead/off ±15% for the wielder only. Crossfall gets one combined heavier swish, not two stacked.

---

## 6. REMOTE PLAYBACK — deterministic per-hand resolution from `attackSeq`

Synced signals, unchanged plus one addition: pair weapon identity (one pair id resolving to two defs + lead order), `attackSeq`/`attackTick`/`attackHeld`, `aimDir`, and — NEW, guns only — per-hand charges (systems designer: e.g. an appended `chargesOff` uint8 beside the existing readout). Everything else derives:

```
n = (attackSeq − 1) >>> 0                       // shipped wrap law (melee.ts:1427)

MELEE:  pairStep = comboStepForChain(seq, acceptedAtMs, pairId, leadFamily, 6,
                    prevSeq, prevAcceptedAtMs, prevWeaponId, prevFamily,
                    prevStep, prevExpiresAtMs)   // melee.ts:1442 — verbatim reuse
        hand     = PAIR_BAR[pairStep].hand       // 0,2,4→lead  1,3→off  5→both
        swing    = swingDescriptorFor(def[hand], 0.72 × effCd(def[hand]))
                   enriched with PAIR_BAR[pairStep]   // swingDescriptorWithComboStep seam

GUNS:   hand = exactlyOneBarrelLive(chargesLead, chargesOff, reloadState)
                 ? livingHand                    // solo-fire during a reload
                 : (n & 1 ? OFF : LEAD)

CAST:   hand = n & 1 ? OFF : LEAD
```

Why this is safe, case by case (all inherited from shipped machinery):

- **Duplicate beat** (`advance === 0`): keeps its step/hand (`melee.ts:1462`) — re-renders can't flip a hand.
- **Snapshot gap** (`advance > 1`): restarts at bar opener / parity-of-n — a late joiner or a lossy patch converges within one bar (≤ ~1.9s melee, ≤ 1 cycle guns). `ArenaScene`'s join path already refuses to manufacture a second owner swing (`:2386-2390`); hand resolution rides the same beat it does or doesn't play.
- **Owner prediction**: the owner predicts `localPredictedAttackSeq + 1` (`ArenaScene.ts:6413-6416`) and resolves hand from the SAME law over the predicted seq. Confirmation consumes the high-water slot; a rejected beat falls into the chain-restart law that already governs combo steps. Predicted hand and confirmed hand can only disagree if seq itself disagrees — and then the restart is the correct answer.
- **Gun reload override determinism**: reload start/end is server-authoritative and observable by every client through the synced per-hand charges; `exactlyOneBarrelLive` is a pure function of synced state, so all clients pick the same barrel for the same beat. (Melee/cast have no override — pure parity/bar.)
- **Server agreement**: the server owns `attackSeq`, so it resolves the same hand with the same arithmetic when picking which weapon's stats to swing/fire per beat (§1.1, §2.1) and which gap to load into `c.cd` (§0). No new wire fields for melee/cast; ONE small synced field for gun off-hand ammo.

Wrap note: `attackSeq = 0` means "never attacked" (`ArenaScene.ts:2388`); the `(seq − 1)` ordinal starts the first accepted attack on beat 0 = LEAD, so the pair always opens on the lead hand — including after uint32 wrap, per the documented wrap law.

---

## 7. Timing appendix (worked pairs, PAIR_TEMPO 0.72)

| quantity | Sabre 0.30 + Hatchet 0.55 | Revolver 0.5 + Ricochet 0.34 |
|---|---|---|
| gap into fast hand | 216ms | 245ms |
| gap into heavy hand | 396ms | 360ms |
| cycle (both hands once) | 612ms | 605ms |
| melee bar (6 beats + gather) | ~1.94s | — |
| finisher gather bonus | +100ms | — |
| finisher pose window | 317ms | — |
| Crossfall off-hand stagger | 0.06 × pose ≈ 19ms | — |
| post-finisher rest | 0.72 × 0.30 + 120 = 336ms | — |
| reload flip down/up | — | 160ms / 160ms (+90ms snap) |
| solo-fire cadence during reload | — | living gun's native fireRate |
| ceremony total | 460ms | 460ms |
| chain grace per beat | clamp(0.35 × gap, 120, 300)ms | n/a (held trigger) |
| recoil arm kick / recovery | — | 0.10 / 0.05 rad, 90ms |
| glyph flare (casters) | 120ms decay | — |

Open handoffs: PAIR_TEMPO and all damage/ammo economics → systems designer. Per-hand def/manifest attachment in `equipWeapon`, dual-aim gun branch, per-hand muzzle suppress, `chargesOff` schema → tech implementer. Pair card + pairing flow → dock UX panel (`docs/dockux-panel/`). Crossfall dual-sweep server path → the accepted-path protocol, whenever stage 3 lands; nothing in this design blocks on it.
