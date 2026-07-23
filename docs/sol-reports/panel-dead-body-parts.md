# Dead / Unused Body Parts Design Panel

## Reading map

- `packages/client/src/sprites/pose-language.ts` — pose vocabulary, facing datum, and per-part transform generation.
- `packages/client/src/entities/SpriteRig.ts` — runtime application of pose transforms, facing, weapon grip points, and animation state.
- `packages/shared/src/weapons.ts` — weapon schema and shared grip/tag definitions.
- `data/weapon-concepts-300.json` — manifest evidence for grip, stance, hand, foot, and weapon-specific exceptions.
- `docs/sol-reports/v7-hands-affine.md` — prior hand-affine audit, laws, and known failure modes.
- `tests/owner-notes-weapon-pose.test.ts` — owner-note regression coverage and recent B8 stance expectations.
- `packages/client/src/sprites/manifest.ts` and `packages/client/src/sprites/whole-art-character.ts` — six-part manifest offsets, whole-art eligibility, and facing-neutral part identity.
- `packages/client/src/sprites/firing-stance.ts` — aimed, casting-hand, and worn/fist-gun ownership.
- `tools/artkit/gen-weapon-expansion.mjs` and `tests/data-consistency.test.ts` — strict generated-data ingress and round-trip test pattern.
- `docs/sol-reports/impl-b8-pose.md` — B8 intent and the explicit Saint-Bough unclaimed-hand seam.
- `packages/client/src/sprites/pose-language.test.ts`, `packages/client/src/entities/SpriteRig.ranged.test.ts`, `packages/client/src/entities/SpriteRig.dualwield.test.ts`, `tests/v6g-systemic-owner-orders.test.ts`, and `packages/client/src/sprites/gear-parts.test.ts` — current pose, grip, dual, head-fit, and socket laws.

> Owner, 2026-07-23T16:22: “Many one handed weapons are leaving the unused hand on the other side of the character's orientation. Making it look weird, both hands should be on the side of the character he/she is facing during these times they would otherwise be idle. Get a team of Sols understanding when our characters have dead (unused) body parts, and what they should be doing”

## Panel ruling

The report agrees with the visual diagnosis but not with the suspected transform failure:

1. The root mirror is working. The hand is not stuck at world-left.
2. The direct bug is a whole-art idle exception that deliberately disables the generic support-hand pose. The unused hand therefore remains at its authored negative rig-local X socket, which the healthy root mirror keeps on the far/trailing side in both facings.
3. Deleting that exception is not enough. Several generic idle targets are themselves behind center, and the target is only softly blended with the far-side manifest socket.
4. “Unused” must be decided per hand, per frame. A hand that is gripping, guarding, pumping, paging, casting, throwing, flourishing, or recovering is active even when it is not the striking hand.
5. The universal facing-side rule belongs to genuinely idle or terminal-recovery hands. It must yield to exact grips and authored action owners. Feet need a separate planted-stance law; putting both feet on the facing side would be unbalanced.

The implementation should replace the blanket whole-art bypass with an explicit appendage-state resolver, a five-pose hand vocabulary, and an absolute facing-local idle target. Existing weapon/grip/muzzle authority must remain untouched.

## A. Taxonomy: when a body part is actually “dead”

### Operational definition

A rendered part is **dead** when it is visible but has no semantic job for the current frame and receives only its manifest socket, generic locomotion, breathing, or spring residual. Motion alone does not make a part alive. The current unused whole-art hand breathes and jiggles, but it is still semantically dead because no guard, grip, recovery, or prop interaction owns it (`packages/client/src/entities/SpriteRig.ts:10048-10060`, `packages/client/src/entities/SpriteRig.ts:10168-10218`).

Every appendage should resolve to exactly one state, in priority order:

1. **Hard-constrained** — exact weapon grip, receiver, or other physical contact.
2. **Action-owned** — anticipation, strike, shot, throw, cast, channel, reload/mechanism, flourish, brace, or named choreography.
3. **Recovering** — an authored return path from the action to neutral.
4. **Authored idle** — a deliberate ready/rest pose with restrained secondary motion.
5. **Structurally absent/replaced** — no rendered part, or equipment intentionally replaces it.
6. **Unowned fallback** — the defect state. A visible hand or foot reaches this state with only its original socket and generic noise.

This is a state-classification problem, not a `tags.grip === "1H"` shortcut. `poseSupportHandFor` currently makes only a coarse hard-2H/both/paired-aim distinction (`packages/client/src/sprites/pose-language.ts:2358-2368`).

### Scenario taxonomy

| Scenario | Hand/foot state | What “alive” means | Does the idle-hand rule apply? |
|---|---|---|---|
| 1H weapon, neutral | Weapon hand hard-constrained; off-hand authored idle | Off-hand guards, frames, interacts, or rests intentionally on the facing side | Yes, to the off-hand |
| 1H weapon, locomoting | Weapon hand carries; off-hand idle plus locomotion | Preserve the selected job while allowing a small counter-swing; never cross the facing-side floor | Yes, after locomotion is composed |
| Swing anticipation/active | Striking hand action-owned; off-hand usually guard/counterbalance-owned | Off-hand may tighten, oppose, frame, or catch; it must not be mistaken for idle | No while action-owned |
| Swing recovery | Both participating hands recovering | Continuous return to the same authored idle target; no final-frame snap to the manifest socket | At terminal recovery only |
| Thrown weapon windup/release/recovery | Both hands action/recovery-owned | Throwing hand completes the arc; the other hand spots/counters; both recover toward the facing side | No during the authored throw; yes after recovery |
| Between throws | Held/draw hand carries the next implement; other hand authored idle | Compact low guard or ready-to-draw posture, not a far-side park | Yes |
| 1H pistol/gun neutral or aimed | Lead hand grips/aims; off-hand guards | Low sternum guard/recoil-catch on the facing side | Yes when not otherwise interactive |
| Pump/lever/bolt cycle | Support hand mechanism-owned | Follow the painted mechanism point and its accepted-shot clock | No |
| True magazine reload | Lead hand maintains the weapon; support hand reload-owned | Reach magazine, receiver, chamber, or pump, then recover | No; the audit found no general reload-pose state in this pose path, so it needs explicit state plumbing rather than idle inference |
| Caster charge/channel | Weapon hand holds/emits; off-hand action-owned | Off-hand shapes, frames, points, or sustains the spell | No |
| Tome page action | Tome hand carries; off-hand page-owned | Touch/trace/turn the page; recover to a book-ready pose | No during the page action |
| 2H weapon with secondary point | Both hands hard-constrained | Exact primary and secondary painted contacts | Never |
| Dual-wield / paired worn weapons | Both hands active | Each hand carries its own weapon and receives pair choreography | Never |
| Fists / glove pair | Both hands are the weapon | Guard, strike, and pair rhythm; no “free” hand exists | Never |
| Flourish / draw / stow | Relevant hand and often support hand action-owned | Follow the flourish until ownership fades, then return continuously | No while owned |
| Feet, idle | Both feet planted | Natural separation, ground contact, and class-appropriate weight distribution | Hand rule does not apply |
| Feet, locomotion/action | Locomotion or attack-footwork-owned | A planted/support foot and a moving/committing foot with bounded stance geometry | Hand rule does not apply |

The existing phase machinery already distinguishes melee anticipation/active/recovery, gun recoil/recovery, tome page phases, and channel charge/active/cooling (`packages/client/src/entities/SpriteRig.ts:9580-9649`). The missing layer is an explicit per-part semantic classification.

## B. Diagnosis: why the off-hand is on the wrong side

### The mirror is correct

The rig creates the hand at its manifest offset and identifies the positive-X hand as `front` (`packages/client/src/entities/SpriteRig.ts:2447-2469`). Facing is committed from cursor/aim or movement, then applied once as the signed root scale (`packages/client/src/entities/SpriteRig.ts:8383-8431`). World aim is converted to canonical local aim with the facing sign folded into cosine (`packages/client/src/entities/SpriteRig.ts:8574-8575`). `aimRelativePoint` likewise states that the container owns the world flip (`packages/client/src/sprites/pose-language.ts:2328-2341`).

Therefore:

- A negative rig-local X hand is the far/trailing hand while facing RIGHT.
- The root mirror turns that same negative local X into positive world X while facing LEFT, which is still the far/trailing side relative to LEFT.
- The bug is not “always world-left.” It is “always negative facing-local X.”

The current mirror test proves only that two vectors are antipodal (`packages/client/src/sprites/pose-language.test.ts:251-257`). It does not prove that a semantic idle target lies in the correct facing half-plane.

### Direct cause: the whole-art idle bypass

The whole-art path sets `preserveAuthoredRestHandSpread` during rig construction (`packages/client/src/entities/SpriteRig.ts:2442-2445`). In neutral idle, that flag forces `poseSupportHand = -1`, explicitly skipping the support-hand resolver to avoid occluding an earlier prototype hand behind the body (`packages/client/src/entities/SpriteRig.ts:9702-9713`).

Every hand then starts from `hnd.ox`; the family target is applied only if its index equals `poseSupportHand` (`packages/client/src/entities/SpriteRig.ts:10048-10086`). With `-1`, neither hand receives an idle target. The unused hand is left at the negative manifest socket.

That socket is not subtle:

- `proto-samurai` has body height 168 and `hand-l.ox = -118.08` source pixels (`packages/client/src/sprites/manifest.ts:4303-4315`, `packages/client/src/sprites/manifest.ts:4337-4345`).
- `proto-sheriff` has `hand-l.ox = -137` (`packages/client/src/sprites/manifest.ts:4379-4390`, `packages/client/src/sprites/manifest.ts:4413-4421`).
- `proto-witch` has `hand-l.ox = -135.78` (`packages/client/src/sprites/manifest.ts:4455-4466`, `packages/client/src/sprites/manifest.ts:4489-4497`).

The six-part whole-art set is explicit—body, head, two hands, two feet—and the eligible roster is the playable `proto-*` subset (`packages/client/src/sprites/whole-art-character.ts:5-24`). The bypass therefore targets exactly the rigs named in the owner's concern.

### Why simply removing the bypass still fails

The generic target is a soft interpolation, not an absolute placement. `samplePoseLanguage` produces an `offBlend` of roughly 0.86–0.96, then `SpriteRig` lerps from the manifest-based hand position toward that target (`packages/client/src/sprites/pose-language.ts:2286-2290`, `packages/client/src/entities/SpriteRig.ts:10082-10085`). A residual 4–14% of a very large negative socket is enough to keep a small positive target behind center.

Several idle targets are also authored behind or too close to center:

- Default 1H blade: `idle.forward = -0.07`, `offHandBlend = 0.86` (`packages/client/src/sprites/pose-language.ts:134-142`).
- Rapier refinement: `idle.forward = -0.045` (`packages/client/src/sprites/pose-language.ts:411-420`).
- Optional pistol clasp: `idle.forward = -0.025` (`packages/client/src/sprites/pose-language.ts:383-395`).
- 1H blunt, pistol, and focus are only `+0.035`, `+0.04`, and `+0.035` respectively (`packages/client/src/sprites/pose-language.ts:172-180`, `packages/client/src/sprites/pose-language.ts:210-218`, `packages/client/src/sprites/pose-language.ts:286-294`).

Using the Samurai manifest as a concrete trace, its left hand normalizes to about `-53.42` rig pixels. A default blade target is `-0.07 * 76 = -5.32` pixels; an 0.86 lerp still lands near `-12.05` pixels. Blunt, pistol, and focus can remain slightly negative because their positive targets are smaller than the retained manifest residual. No final half-plane guard exists.

Idle anchors are also aim-relative. Near a vertical cursor angle, lateral displacement contributes to local X. The systemic fix should therefore resolve idle placement in a facing-local horizontal/vertical basis, optionally add a bounded aim bias, and enforce the facing-side post-condition after all offsets.

### Recovery exposes a second discontinuity

Generic recovery interpolates back to the family idle anchor and releases ownership (`packages/client/src/sprites/pose-language.ts:2229-2233`); tests assert terminal recovery exactly equals idle at the sampler level (`packages/client/src/sprites/pose-language.test.ts:213-225`). On a whole-art rig, the next neutral frame changes `poseSupportHand` to `-1` and abandons that anchor. The hand can therefore recover intentionally, then snap or spring toward the far-side manifest rest one frame later.

The new design must make terminal recovery and neutral idle resolve through the same absolute target.

## C. Feet: current behavior and required policy

Feet are not bypassed in the same way as hands, but their composition can create dead-looking gaps:

1. Each foot starts at the authored `ft.ox/oy`.
2. Locomotion stride, lift, and inertia are added.
3. The generic family stance is added even in idle; its blend is 0.78 at rest and 1.0 in active (`packages/client/src/sprites/pose-language.ts:2292-2307`, `packages/client/src/entities/SpriteRig.ts:10329-10360`).
4. A named blade stance can then add another offset on top of the already-composed generic stance (`packages/client/src/entities/SpriteRig.ts:10361-10371`).
5. Attack-foot targets may then interpolate toward a third `ft.ox`-relative target (`packages/client/src/entities/SpriteRig.ts:10373-10390`).
6. Spring residual is finally added, but there is no final stance-width, foot-crossing, ground-band, or body-gap validity check (`packages/client/src/entities/SpriteRig.ts:10391-10430`).

This explains how feet can widen, cross, or leave odd gaps during locomotion/action composition without any mirror defect.

### Feet ruling

Feet should **not** both be forced onto the facing side. Both feet are active in a planted stance:

- **Idle:** resolve to a natural plant independent of upper-body aim. Weapon class may choose width and fore/aft bias, but both feet remain grounded and bracket the body.
- **Locomotion:** locomotion owns stride/lift. Weapon stance contributes only a bounded posture bias that fades with gait; it must not be added twice.
- **Action:** authored footwork may override the neutral plant while it owns the phase.
- **Recovery:** return continuously to the same planted neutral stance.

Use three foot profiles:

| Foot profile | Default classes | Intent |
|---|---|---|
| `loose-plant` | Pistols, light ranged, focus/tome/caster | Narrow relaxed base, small rear-foot trail |
| `combat-plant` | 1H melee, thrown, polearm, long gun | Moderate stagger, clear lead/support foot |
| `wide-plant` | Heavy 2H, great/colossal blades, named samurai guards | Lower center of mass and deliberate broad base |

Named stances such as Voltedge's `near-ear-blade-up` may select `wide-plant`, but a named stance must replace—not stack with—the generic foot stance. Existing named stance data already carries explicit front/back foot anchors (`packages/client/src/sprites/pose-language.ts:1351-1365`).

## D. Ranked idle-hand design language

The vocabulary is a priority list as well as a visual ranking. An exact semantic job always beats a generic rest pose.

| Rank | Pose name | Use | Design notes |
|---:|---|---|---|
| 1 | `secondary-grip` | A valid secondary grip/handle/shaft exists | Hard constraint to the painted point. This is not visually “idle,” but it is the highest-priority neutral hand job. |
| 2 | `mirror-guard` | 1H blades, rapiers, close blades, stab-ready weapons | Open/raised defensive hand toward the target; best fighting-game silhouette and clearest answer to the owner note. |
| 3 | `low-guard` | Pistols, 1H blunt, thrown-ready, generic fallback | Compact hand below sternum on the facing side; readable without crowding the weapon. |
| 4 | `casting-gesture` | Wands, foci, orbs, tomes, caster gauntlets | Open framing/pointing/page-ready hand. Channel/page/shot animation temporarily owns and intensifies it. |
| 5 | `hip-rest` | Relaxed walking props and selected oversized 1H implements | Rest on the facing-side belt/hip. Use sparingly because a back-layer hand can disappear behind the torso. |

The six-piece bitmap rig has no finger bones or finger sprites (`packages/client/src/sprites/whole-art-character.ts:5-12`). “Finger curl” cannot be a real animation in this scope. Passive versus interactive must be expressed with whole-hand position, rotation, scale, and a small breathing trace. New finger art/parts would be a separate rig expansion.

### Class defaults

| Resolved weapon lane | Default neutral hand job |
|---|---|
| `one-hand-blade`, rapier, thrust-ready katana | `mirror-guard` |
| `close-blade` | `mirror-guard`; active ward/rake choreography wins |
| `one-hand-blunt`, ordinary 1H exotic melee | `low-guard` |
| `pistol`, compact 1H gun | `low-guard`; recoil catch and reload override it |
| `thrown` between throws | `low-guard`; both-hand throw/recovery overrides it |
| `focus`, `tome`, wand/orb/scepter, `fist-gun` caster gauntlet | `casting-gesture` |
| One-hand walking staff | `hip-rest` when stationary, bounded counter-swing while walking |
| 2H with valid secondary point | `secondary-grip` |
| Dual, paired aimed, fists, glove pair | No idle hand; both hands are active |

The current catalog makes a caster-aware default mandatory. `data/weapon-concepts-300.json` declares 324 authored rows—121 melee, 108 ranged, 95 caster (`data/weapon-concepts-300.json:2-8`). A read-only parse found 128 authored 1H rows, of which 127 are non-banned; caster is the largest 1H lane. A universal hip park would make many magical weapons look less alive, not more.

### Universal facing-side rule

For every hand classified as `authored-idle` or at terminal recovery:

1. Resolve an **absolute** facing-local target relative to the body, not a partial blend from the manifest's opposite-side socket.
2. Idle pose X is horizontal facing-space; vertical placement remains screen Y. Aim may add a small bounded bias but may not choose the half-plane.
3. Enforce a final local post-condition after locomotion, micro-motion, and pose bias:

   `resolvedHandLocalX - bodyLocalX >= facingSideFloor`

4. Let the existing signed root scale perform the only world LEFT/RIGHT mirror. Do not multiply the new local target by facing a second time.
5. In composed world space, the testable form is:

   `(handWorldX - bodyWorldX) * committedFacing >= worldFacingMargin`

6. Clamp micro-motion before it can cross the floor.
7. Hard grip, dual, cast/channel, mechanism, flourish, brace, throw, and action choreography owners bypass this rule explicitly—not by accident.

Use a small positive normalized floor, initially `0.03 * bodyHeight`, then validate it against real hand alpha bounds. The stronger live acceptance criterion is that some visible hand alpha remains on the facing half-plane and the hand is not fully occluded by the torso.

## E. Proposed data/schema addition

### Shared schema

Add a compact presentation-only hook to `WeaponDef`:

```ts
export type IdleHandPose =
  | "secondary-grip"
  | "mirror-guard"
  | "low-guard"
  | "casting-gesture"
  | "hip-rest";

export type IdleFootPose = "loose-plant" | "combat-plant" | "wide-plant";

export interface WeaponPoseLanguageDef {
  idle?: IdleHandPose;
  feet?: IdleFootPose;
}

export interface WeaponDef {
  // existing fields...
  poseLanguage?: WeaponPoseLanguageDef;
}
```

`poseLanguage.idle` is a per-weapon override. Family/class defaults remain in the client pose registry so the data does not repeat the same field across 324 rows. `poseLanguage.feet` is also optional and reserved for genuine stance exceptions. No recovery field is needed: terminal recovery must always converge to the selected idle profile.

This belongs beside the existing presentation hooks `stance`, `performance`, and `gripPoints` (`packages/shared/src/weapons.ts:458-475`, `packages/shared/src/weapons.ts:532-539`).

### Resolution order

Resolve the hand job in this order:

1. Structural absence or replacement.
2. Per-frame explicit owner: action, combo hand=`off|both`, cast/channel, page, throw, reload/mechanism, flourish, brace.
3. Dual/glove/fists: both active.
4. 2H/mounted with valid secondary grip: `secondary-grip`.
5. `def.poseLanguage?.idle`.
6. Family/class default table.
7. `low-guard` as a fail-safe, with a test that records any use of this last fallback as an authoring failure for current catalog rows.

`tags.grip` remains necessary but is insufficient. Grip truth and secondary anchors already live in shared data (`packages/shared/src/weapons.ts:44-82`, `packages/shared/src/weapons.ts:758-770`).

### JSON and generator

For generated weapons, add the optional top-level object:

```json
"poseLanguage": {
  "idle": "mirror-guard",
  "feet": "wide-plant"
}
```

Generator work:

- Add `"poseLanguage"` to `TOP_KEYS`; unknown keys currently fail strict generation (`tools/artkit/gen-weapon-expansion.mjs:70-78`, `tools/artkit/gen-weapon-expansion.mjs:210-215`).
- Add `POSE_LANGUAGE_KEYS`, `IDLE_HAND_POSES`, and `IDLE_FOOT_POSES`.
- Parse only the two optional enum fields; reject unknown keys and invalid values.
- If `idle === "secondary-grip"`, fail generation unless a secondary grip exists.
- Emit the validated object onto `WeaponDef` in `mapWeapon` (`tools/artkit/gen-weapon-expansion.mjs:723-816`).
- Regenerate `packages/shared/src/weapons-expansion.generated.ts` through the canonical generator; never hand-edit it (`tools/artkit/gen-weapon-expansion.mjs:1172-1181`).
- Extend the authored-field survival test exactly as `gripPoints` and handling tags are checked today (`tests/data-consistency.test.ts:259-262`).

Base-catalog exceptions such as Voltedge are authored directly in `packages/shared/src/weapons.ts`; generated exceptions belong in `data/weapon-concepts-300.json`.

## F. Interaction with existing systems

### Dual wield

Both hands are active even at neutral. The generic idle resolver must not touch either weapon hand. Alternating melee already assigns support work to the non-striking hand, while Crossfall/both-hand and paired-aim paths suppress a free-hand job (`packages/client/src/entities/SpriteRig.dualwield.test.ts:78-101`). Add a neutral dual classification test because current `poseSupportHandFor` does not treat every non-aimed dual neutral as a hard exclusion.

### Thrown weapons

The authored `throw-release` path explicitly places both hands through non-idle windup/release/recovery (`packages/client/src/sprites/pose-language.ts:2017-2053`). Preserve it. At terminal recovery, both paths must meet the selected facing-side ready pose without a whole-art snap. The new throwing-star rows are explicit `1H` `throw-release` weapons (`data/weapon-concepts-300.json:16237-16257`).

### Casters

Charging/channeling is active, not idle. The existing beam/channel phase promotes off-hand ownership (`packages/client/src/sprites/pose-language.ts:2236-2249`, `packages/client/src/entities/SpriteRig.ts:9637-9649`). Tome firing has a dedicated free casting-hand target (`packages/client/src/sprites/firing-stance.ts:136-145`, `packages/client/src/entities/SpriteRig.ts:10043-10109`). The new idle vocabulary should supply the neutral `casting-gesture`; the active channel/page owner must override it.

### Guns and mechanisms

True 2H guns resolve the back hand from the painted secondary point after the primary firing grip, including pump/lever/bolt offsets (`packages/client/src/entities/SpriteRig.ts:10247-10306`). V7 established that these accepted-shot mechanism phases must stay after the canonical primary grip and must not alter the muzzle affine (`docs/sol-reports/v7-hands-affine.md:31-37`). The idle resolver yields entirely.

For 1H pistols, the free hand uses `low-guard` until recoil/reload owns it. For worn/fist guns such as Hellmouth, the emitted hand and free casting/reload hand need explicit active roles rather than rifle-style secondary-grip inference. Existing fist-gun data already defines facing-side aimed anchors (`packages/client/src/sprites/firing-stance.ts:106-115`).

### Existing head-fit and grip laws

Do not weaken them. Head-fit tests are the correct precedent: they compose actual mounted geometry at both facings and require the result to land within tolerance (`packages/client/src/sprites/gear-parts.test.ts:458-501`, `packages/client/src/sprites/gear-parts.test.ts:548-576`). Grip laws similarly require every forward 2H staff's second hand to be farther up the shaft (`tests/v6g-systemic-owner-orders.test.ts:268-296`). The idle rule should add a composed-result invariant beside these laws, not replace their source-space constraints.

## G. Bespoke weapon and lane call-outs

| Weapon/lane | Recommendation | Reason |
|---|---|---|
| **Hellmouth Palmcaster** (`x2-hellmouth-palmcaster`) | `casting-gesture`; active shot/reload brace owns the off-hand | It is a 1H caster gauntlet implemented as a rapid pellet gun with magazine/reload (`data/weapon-concepts-300.json:14626-14663`), not a pistol or rifle foregrip. This is the owner's named repro. |
| **Saint-Bough Frost Crozier** (`x2-saint-bough-frost-crozier`) | Stationary `hip-rest`; walking facing-side counter-swing; quake action owns recovery | B8 intentionally made it a one-hand walking staff with primary-only grip (`data/weapon-concepts-300.json:11933-11941`). The implementation report explicitly says it “leaves the far hand unclaimed” (`docs/sol-reports/impl-b8-pose.md:56-60`). |
| **Voltedge** (`x-sword-neon-katana`) | `mirror-guard` plus `wide-plant` | Its weapon hand is blade-up near the ear and every attack is a stab (`tests/owner-notes-weapon-pose.test.ts:218-247`); an extended off-hand makes the thrust line intentional. |
| **Rapier lane**, especially Hexbloom Rapier | `mirror-guard`, replacing the negative-forward duelist wing | The special rapier idle target is explicitly behind center (`packages/client/src/sprites/pose-language.ts:411-420`); Hexbloom is a 1H rapier (`data/weapon-concepts-300.json:400-416`). |
| **Fool's Gold Revolver** | `low-guard` | B8 supplies only an exact primary grip (`data/weapon-concepts-300.json:5490-5493`); the off-hand still needs a neutral job. |
| **One-hand tomes/books**, including Null Grimoire and Emberleaf Chapbook | `casting-gesture` | Page/cast interaction is more alive than hip rest; active page/channel ownership must win. Null Grimoire is a 1H grimoire (`data/weapon-concepts-300.json:10536-10546`). |
| **Continuous caster props**, including Hailshard Resonator, Fulgurite Storm-Sphere, Cinderchoke, and Coffin-Nail Rosary Orb | `casting-gesture`; authored spin/overhead/shake/recoil owns active frames | These props have unusual performance verbs; Hailshard is a continuous 1H spin focus (`data/weapon-concepts-300.json:12445-12495`). |
| **Hollowbarrel Spell-Scattergun Staff** and **Sunbreaker Railgun** | Preserve `secondary-grip`; never apply idle pose | B8 pins exact two-hand contact points (`tests/owner-notes-weapon-pose.test.ts:250-273`). |
| **1H throwers**, especially Boothook/Frostgig/Sunlance and the throwing-star family | `low-guard` between attacks; both-hand authored recovery | Throw performance owns both hands; terminal recovery must meet neutral (`data/weapon-concepts-300.json:16237-16280`). |
| **Oversized 1H props**: Throne-of-Ash Coal-Scepter, Carrion Roost Necro-Scepter, Dust-Devil Flail, Snakebite Dart-Slinger | Visual-review override, usually `hip-rest` or `casting-gesture` | A generic low guard may collide with or visually fail to counterbalance these unusually long props; Carrion Roost is 184 px while still 1H (`data/weapon-concepts-300.json:11720-11758`). |
| **Kagewake / Hushglass and other authored 1H combo bars** | Idle default only outside the combo; explicit `off`/`both` beats win | Kagewake contains lead, off, and both-hand beats (`data/weapon-concepts-300.json:15357-15389`); Hushglass ends with a both-hand beat (`data/weapon-concepts-300.json:15393-15426`). |
| **Fists, dual weapons, glove pairs** | Explicit exclusion; no idle hand | Both hands are active equipment/attack surfaces. |

These are not all per-ID hardcodes. Most should be satisfied by class defaults plus state ownership. Only the visually exceptional rows need `poseLanguage` overrides.

## H. Testability: the laws the implementation must add

### 1. Pure catalog-wide hand law

Add pure, exported seams such as:

- `classifyHandRole(def, frameState, hand)`
- `idleHandPoseFor(def)`
- `resolveIdleHandTarget(def, profile, aimWorld, facing, bodyHeight, manifestSocket)`

In `pose-language.test.ts`, enumerate every non-archived `WEAPONS` entry, both facings, representative world aims, idle, and terminal recovery. For every hand classified as idle/recovered:

```ts
expect((worldHandX - worldBodyX) * facing, diagnostic)
  .toBeGreaterThanOrEqual(worldFacingMargin);
```

Also assert:

- LEFT and RIGHT are exact mirrors after composing the root transform.
- Terminal recovery and the next idle sample are position-continuous.
- Every current catalog row resolves a named vocabulary entry without the last-resort fallback.
- Every sample is finite and bounded.
- Reduced motion removes only micro-motion, not semantic placement.

Diagnostics must include weapon ID, pose name, hand, state, facing, and aim.

### 2. Explicit exemption/ownership table

Pin representative cases:

- Dual: neither hand idle.
- Fists/glove pair: neither hand idle.
- 2H plus secondary point: both hands hard-constrained.
- Pump/lever/bolt: support hand mechanism-owned.
- Caster channel/tome page: free hand casting/page-owned.
- Thrown anticipation/active/recovery: both hands action/recovery-owned.
- 1H idle: exactly one idle hand.
- 1H action terminal recovery: idle hand returns to the same neutral target.

No test should silently skip an unclassified hand. Every visible hand must have a state.

### 3. Integrated whole-art rig law

Add a focused `packages/client/src/entities/SpriteRig.idle-parts.test.ts` rather than overloading the ranged suite. Use real manifest sockets for `proto-samurai`, `proto-sheriff`, and `proto-witch`. For every live 1H weapon:

- Settle facing RIGHT and LEFT.
- Sample idle, gait, reduced motion, and recovery-end.
- Assert the classified free-hand center and visible bounds satisfy the facing-side rule.
- Assert it is not fully hidden by the body bounds.
- Assert the weapon hand and primary grip are unchanged.
- Assert action-owned hands are unchanged bit-for-bit by the idle resolver.

This specifically catches the current whole-art bypass and the insufficient soft blend.

### 4. Feet law

Test each foot profile, both facings, gait `{0, 0.5, 1}`, stride phases `{0, π/2, π, 3π/2}`, and action phases:

- Both foot positions are finite and mirror correctly.
- Feet do not cross.
- Planted width stays within class-specific normalized bounds derived from existing manifest alpha geometry.
- Planted feet remain in the accepted ground-Y band and preserve the foot/hem gap.
- A named stance replaces the generic stance rather than double-adding it.
- Terminal recovery returns to the identical planted idle stance.
- Upper-body-only actions do not silently change foot-profile identity.

The existing socket test that preserves foot/hem gaps across all torsos is a useful pattern (`packages/client/src/sprites/gear-parts.test.ts:732-793`).

### 5. Generator round trip

Extend `tests/data-consistency.test.ts` so every authored `poseLanguage` field survives JSON → generated TypeScript → `WEAPONS`, and add negative generator fixtures for unknown pose names, unknown keys, and `secondary-grip` without a secondary point.

### 6. Live evidence gate

Model the gate on V7's measured grip evidence, which checked accepted cycles, visible support-hand travel/contact, and unchanged muzzle error (`docs/sol-reports/v7-hands-affine.md:39-53`).

The new gate should:

- Sweep every live 1H weapon in quiet idle facing both directions and emit machine-readable body/hand/foot bounds.
- Capture representative natural frames for all five hand poses and all three foot profiles.
- Include Hellmouth, Saint-Bough, Voltedge, Fool's Gold, a rapier, a thrown weapon, a tome/channel caster, a dual pair, a 2H foregrip gun, and an authored mechanism cycle.
- Assert facing-side visible alpha, no total torso occlusion, recovery-to-idle continuity, foot separation/ground band, and explicit owner exemptions.
- Re-run the existing muzzle/grip gates to prove primary grips, secondary grips, mechanisms, and authoritative muzzle placement did not move.

## I. One-Sol implementation plan

### Scope

The follow-up implementation Sol should own:

- `packages/shared/src/weapons.ts`
- `data/weapon-concepts-300.json` only for proven overrides
- `tools/artkit/gen-weapon-expansion.mjs`
- regenerated `packages/shared/src/weapons-expansion.generated.ts`
- `packages/client/src/sprites/pose-language.ts`
- `packages/client/src/entities/SpriteRig.ts`
- focused pose/rig/data tests
- a new measured live gate and its evidence directory

It should not change combat authority, damage, cadence, projectile geometry, muzzle points, grip points except a separately proven art-contact defect, character art, or the six-part manifest offsets.

### Execution order

1. **Write failing laws first.** Reproduce the current whole-art failure using real negative manifest sockets and prove at least blade, blunt, pistol, focus, Saint-Bough, and Hellmouth land on the far half-plane.
2. **Add shared schema and generator plumbing.** Add the two enums and optional `poseLanguage` object, strict validation, generated output, and round-trip tests.
3. **Add semantic classification.** Make every visible hand resolve to hard-constrained, action-owned, recovering, authored-idle, absent/replaced, or an explicit test failure.
4. **Add the five-pose registry.** Keep family defaults in pose language and add only exceptional data overrides.
5. **Replace the whole-art bypass.** Preserve the original anti-occlusion intent through visible absolute targets; do not restore the old torso-occluded soft blend.
6. **Apply the facing-side post-condition late.** Compose idle target, movement, and micro-motion, clamp in canonical local space, then let the root mirror once.
7. **Unify recovery and idle.** Terminal recovery must feed the same target used on the following neutral frame.
8. **Normalize feet composition.** Select one neutral foot profile, let named stance replace the generic profile, and separate locomotion/action ownership.
9. **Protect existing owners.** Prove dual, 2H grips, cast/channel, thrown recovery, mechanisms, flourishes, and B8 named actions are unchanged.
10. **Generate evidence and validate.** Run generator checks, focused tests, shared/client typechecks, full unit suite, all existing grip/muzzle gates, and the new live idle-parts gate.

### Acceptance evidence

The handoff is complete only when:

- Every live 1H weapon passes the composed world-facing invariant on all three whole-art rigs in both facings.
- No visible hand is unclassified.
- Recovery-end and idle-start are continuous.
- Representative live frames show intentional silhouettes, not merely mathematically mirrored points.
- Feet stay planted/separated at idle and do not double-compose named stances.
- Existing exact secondary grips, accepted mechanism cycles, B8 poses, and muzzle-affine tolerances remain green.
- The report/evidence lists any remaining per-ID override rather than hiding it in `SpriteRig`.

Verdict: enforce one late absolute facing-local idle-hand rule for only idle/terminal-recovery hands; use the five-pose vocabulary `secondary-grip`, `mirror-guard`, `low-guard`, `casting-gesture`, and `hip-rest`; add optional `WeaponDef.poseLanguage { idle, feet }` with family defaults plus strict JSON-generator round trip; hand one implementation Sol the schema → classifier → SpriteRig resolver → feet normalization → catalog/unit/live evidence plan above.
