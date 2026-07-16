# Devil's advocate: do not turn the Driftblade into a template factory

## Ruling

The feedback is right about the result and dangerous about the implied solution.

The long-katana weapon is **`driftblade` / Driftblade**: the hand-authored data calls it the "really long sword" demonstration and a Masamune-homage nodachi. It is a two-handed, XL weapon tagged `family: "sword"`, with `displayLength: 320`, `range: 300`, `cooldown: 0.62`, and no authored `swingStyle` (`packages/shared/src/weapons.ts:667-701`). Shared resolution therefore gives it base style `orbit`, then classifies its two-handed XL sword shape as combo variant `greatsword` (`packages/shared/src/melee.ts`, `swingStyleFor()` and `meleeComboSelectionFor()`).

That is not the literal katana-id weapon. `x-sword-neon-katana` / Voltedge is M, one-handed, and tagged `family: "sword"`; it resolves to the `hero-spin` arc variant (`packages/shared/src/weapons.ts:849-883`). If the remembered clip ends in one clean 360-degree release, that clip is Voltedge. The data phrase **long** uniquely points to Driftblade, whose third hit is the charged step-slash described below.

Do **not** copy Driftblade's exact three motions onto every greatsword, claymore, nodachi, bardiche, and glaive. The current combo is a strong animation prototype and an untrustworthy combat promise. Stage 1 deliberately leaves the server on one centered sweep, while the rendered sequence shows a shoulder chop, a short hilt strike, and a narrow charged slam. More copies would multiply the lie, the screen noise, and the sameness before the accepted-step and authoritative-path backlog is complete.

The acceptable answer to “more combos like that” is:

1. preserve Driftblade as the reference for **contrast and continuity**, not as a reusable motion tuple;
2. finish accepted combo-step sync and server path authority;
3. build one deliberately different greatsword pilot;
4. admit a blade-polearm pilot only after it proves a distinct leverage vocabulary and passes co-op readability.

Until then, no family-wide rollout.

## What the Driftblade combo actually is

`MELEE_COMBO_VARIANT_SEQUENCES.greatsword` is:

1. `MELEE_COMBO_SEQUENCES.chop[0]` — **shoulder chop**;
2. `POMMEL_BASH_COMBO_STEP` — **pommel bash**;
3. `TRUE_CHARGED_SLAM_COMBO_STEP` — **true charged step-slash**.

That selection is authored in `packages/shared/src/melee.ts:471-499`. `SpriteRig` does not render Driftblade's base `orbit` style while a combo pose is live: it substitutes the combo family (`chop`) as `poseStyle`, uses the ordinary chop branch for step 1, then dispatches the two signature methods `applyPommelBash()` and `applyTrueChargedSlam()` (`packages/client/src/entities/SpriteRig.ts`, combo dispatch in `animate()`). The fake-3D orbit remains the descriptor's base style and clock, but not the visible three-step choreography.

At the neutral 0.62 s cooldown, `poseSeconds = cooldown × 0.64 = 396.8 ms`. The authored visual beats are therefore:

| Step | Visual active / impact / follow end | What the rig does |
|---|---:|---|
| Shoulder chop | 95–206 / 206 / 262 ms | Eases into a high two-handed coil, then uses a quadratic accelerating fall, torso stretch-to-squash, and a low-guard exit. |
| Pommel bash | 48–119 / 111 / 175 ms | Collapses hand spacing from about `0.42H` to `0.24H`, points the blade behind the hands, drives a compact hilt punch, then spends the rest of the pose loading the finisher. |
| True charged step-slash | 183–254 / 242 / 317 ms | Draws behind the body, compresses projected weapon length as low as `0.22×`, steps in, restores the enormous blade during a quadratic fall, compresses the body at contact, and holds a planted finish. |

### Why it feels cool

It is not cool merely because there are three animations.

- **The verbs contrast.** A broad blade-led chop is followed by a short grip-led jab, then a delayed whole-body finisher. The contact carrier changes from blade, to hilt, to planted edge. Three recolored slashes would not create this rhythm.
- **The cadence has punctuation.** Normal-cooldown impacts land around 206 ms, 111 ms, and 242 ms. The middle beat is roughly twice as quick as the finisher, so the sequence reads medium–fast–slow instead of metronomic.
- **The anticipation curves express mass.** Step 1 eases into the coil and accelerates into the fall. The pommel uses a brisk cubic-out drive. Step 3 subdivides charge, edge-on compression, step-in, quadratic fall, contact tail, plant, and haul-out. The blade does not rotate at one generic angular velocity.
- **The silhouettes are readable without VFX.** The 320 px nodachi begins broadside, reverses so the blade visibly trails the hands during the bash, becomes nearly edge-on during the charge, then returns to full length at the strike. Hand-spacing, depth, body scale, shadow shape, and weapon length all change the paper cutout's outline.
- **Every exit prepares the next entrance.** Step 1 finishes low; the pommel snatches naturally from that guard and ends loaded behind the shoulder; step 3 consumes that load. The combo hold keeps the authored guard through the legal attack cadence instead of snapping to idle.
- **The motion returns to procedural life.** Combat ownership reaches weight 1 through the dangerous interval, releases through follow-through, and the spring preserves bounded terminal local velocity at the handoff (`actionOwnershipAt()` and `stepJigglePart()` in `SpriteRig.ts`). The weapon does not simply stop when the authored curve ends.

Those are the properties to reproduce. The literal shoulder-chop → pommel → charged-slam sequence is not.

## The impressive part is also currently dishonest

`swingDescriptorWithComboStep()` copies combo metadata onto the client descriptor but intentionally does not replace its active interval, impact, geometry, or damage. The server registers the base descriptor plus `weapon.swingArc`, reach, edge damage, and one hit set, then samples `bladeAngleAt()` from `aim − arc/2` to `aim + arc/2` (`packages/shared/src/melee.ts:714-740`, `:765-771`; `packages/server/src/rooms/GameRoom.ts:2315-2344`, `:2459-2539`).

For neutral Driftblade, the authoritative active interval is about **150–286 ms on every step**, using one centered positive sweep of **2.3 rad at 300 px reach**. The combo path fields remain dormant:

| Step | What the picture promises | What damage actually does | Failure |
|---|---|---|---|
| Shoulder chop | Active 95–206 ms; `0.75×` arc concept | Centered 2.3 rad sweep, active 150–286 ms | The blade looks dangerous about 54 ms before authority starts and begins recovery while the server can still hit. |
| Pommel bash | Short `capsule`, `0.55×` range, `0.75×` damage, hilt impact at 111 ms | Full 300 px sword sweep, `1×` damage, active 150–286 ms | The visible strike has ended roughly 31 ms before damage begins; distant blade-side enemies can be hit by a hilt attack that never touched them. |
| Charged step-slash | Narrow `fan`, `0.72×` arc, `1.12×` range, `1.25×` damage, impact at 242 ms | Same 2.3 rad / 300 px / `1×` sweep; descriptor impact remains about 206 ms | The picture promises narrower, longer, later, stronger contact. None of those gameplay claims is true yet. |

The local paper/painted edge-ribbon path also receives ArenaScene's original base descriptor, not the rig's enriched step snapshot (`packages/client/src/scenes/ArenaScene.ts:5968-5981`, `:6082-6101`; `packages/client/src/vfx/VfxPlayer.ts:376-416`). The character can perform a pommel bash while the supplementary swing renderer describes the centered blade sweep. Making that flourish larger would strengthen the wrong explanation.

The new attack beat solves **occurrence and epoch**, not combo identity. `attackSeq`, `attackTick`, and the three-tick `attackHeld` latch let observers start a remote rig on the delayed server timeline (`packages/shared/src/state.ts:136-143`; `ArenaScene.routePlayerAttacks()`). But `triggerSwing()` still advances a private client combo counter. A coalesced sequence jump triggers one pose, a join during the latch starts from the observer's local chain state, and an unaccepted owner prediction is not reconciled to an authoritative step. No synced `comboStep` means two clients may show different motions for the same accepted hit.

This is exactly the wrong moment to multiply signature variants: the more distinct the steps become, the more visible that disagreement becomes.

## The actual large-blade roster

These tables enumerate runtime `WeaponDef` data, not unused concept names. “Current result” is derived by the live shared resolver. Expansion rows exist in `WEAPONS` but are held out of the active `WEAPON_IDS` roster.

### Active large sword-tagged or sword-named entries

| Weapon id | Display name | Data family / size | Current style and combo result |
|---|---|---|---|
| `tombstone-greatsword` | Tombstone Greatsword | `sword` / L | `chop`; `quake-mauler` (shoulder, pommel, fulcrum flip) |
| `x-sword-whirlwind` | Dervish Greatblade | `greatsword` / L | authored `spin`; deliberately no three-step combo |
| `driftblade` | Driftblade | `sword` / XL | base `orbit`; `greatsword` visual combo |
| `x-sword-anchor` | Drowned Anchor | `sword` / L | `orbit`; no combo |
| `x-sword-coffin` | Reaper's Lid | `sword` / L | `orbit`; no combo |
| `x-sword-bone` | Wyrmtooth | `sword` / L | `orbit`; no combo; also owns magma scatter/explosions |

Source blocks: `packages/shared/src/weapons.ts:594-701`, `:753-823`, and `:884-926`. The anchor and coffin are important counterexamples: a `sword` tag is not permission to animate an implement as a katana. The Dervish is another: forcing its coherent two-revolution spin into a three-step reset would be a regression.

### Expansion big swords

| Weapon id | Display name | Data family / size | Current style and combo result |
|---|---|---|---|
| `x2-gravechill-nodachi` | Gravechill Nodachi | `nodachi` / XL | quake → `chop`; `quake-mauler` |
| `x2-tombwarden-claymore` | Tombwarden Claymore | `broadsword` / XL | quake → `chop`; `quake-mauler` |
| `x2-riftcleaver-greatblade` | Riftcleaver Greatblade | `energy-blade` / L | `orbit`; `greatsword` visual combo via its name |
| `x2-dustreaper-zweihander` | Dustreaper Zweihander | `broadsword` / XL | `orbit`; `greatsword` visual combo |
| `x2-stormpetal-odachi` | Stormpetal Odachi | `nodachi` / XL | `orbit`; `greatsword` visual combo |

Source entries begin at `packages/shared/src/weapons-expansion.generated.ts:153`, `:274`, `:426`, `:546`, and `:671`.

The resolver already gives **four weapons the exact Driftblade tuple** once expansion content is considered. That is already at the edge of sameness before anyone responds to the feedback by adding more.

### Sword-adjacent blade polearms

This scope includes blade-dominant polearms—bardiche, glaive, naginata, halberd, fauchard, lochaber, and voulge—and excludes predominantly thrusting spears, pikes, partisans, and ranseurs.

| Weapon id | Display name | Data family / size | Current style and combo result |
|---|---|---|---|
| `x2-permafrost-bardiche` | Permafrost Bardiche | `axe` / XL | `orbit`; no combo |
| `x2-dustdevil-glaive` | Dustdevil Glaive | `glaive` / L | quake → `chop`; `quake-mauler` |
| `x2-rimethorn-naginata` | Rimethorn Naginata | `naginata` / L | `orbit`; no combo |
| `x2-reliquary-halberd` | Reliquary Halberd | `halberd` / XL | `orbit`; no combo |
| `x2-quarry-splitter-bardiche` | Quarry-Splitter Bardiche | `glaive` / XL | quake → `chop`; `quake-mauler` |
| `x2-wickfire-fauchard` | Wickfire Fauchard | `glaive` / L | `orbit`; no combo |
| `x2-saintspar-lochaber` | Saintspar Lochaber | `halberd` / L | `orbit`; no combo |
| `x2-thunderhead-voulge` | Thunderhead Voulge | `glaive` / XL | `orbit`; no combo |
| `x2-blightfork-glaive` | Blightfork Glaive | `glaive` / L | `orbit`; no combo |
| `x2-riftcaller-naginata` | Riftcaller Naginata | `naginata` / XL | `orbit`; no combo |

Source entries begin at `weapons-expansion.generated.ts:869`, `:1591`, `:1667`, `:1745`, `:1936`, `:1976`, `:2057`, `:2136`, `:2257`, and `:2304`.

These families are not interchangeable. A glaive's identity comes from reach, haft leverage, hand sliding, hooking, and recovery around a remote mass. Giving it the greatsword pommel/TCS tuple because both sprites are long would erase the exact shape information the data is trying to preserve.

## How proliferation fails

### 1. It turns visual variety into false hitboxes

Under the single-sweep server truth, reverse cuts still damage along the positive centered sweep, a pommel still hits at blade reach, a narrow slam still damages a broad fan, and a nominal finisher still deals ordinary edge damage. A more distinctive animation creates a more specific promise, so its mismatch is worse than a generic orbit. “Cosmetic only” is not a defense when players aim and dodge by the picture.

### 2. It spends the hostile-readability budget

The enemy parry glint has a 280 ms lead and only a 60 ms crest (`SpriteRig.ts`, `MELEE_GLINT_LEAD_MS` and `MELEE_GLINT_CREST_MS`). A 320–335 px friendly blade, body squash, depth swap, paper ribbon, painted edge, quake, and confirmed-hit stack all compete with that crest. The new attack beat means remote allies now contribute real swing silhouettes too. Ten players are allowed (`MAX_PLAYERS = 10`), so “it looks fine on the owner in Testing Grounds” proves almost nothing.

No big-sword flourish is worth hiding an enemy's parry window, projectile, or safe floor edge. Friendly spectacle is third in the hierarchy: hostile danger first, confirmed consequence second, weapon flavor third.

### 3. Big commitment poses fight commitment-free movement

The signature channels intentionally move visible art while the authoritative root and hurtbox remain grounded. Movement is not locked by attacking. That preserves bullet-heaven control, but a long charge, planted foot, buried blade, or world-anchored polearm can then skate at full movement speed and reverse direction without mechanical cost.

The answer is not to sneak a movement penalty into animation work. It is to author poses that remain credible while translated by an unconstrained root, or explicitly propose server-owned commitment as a separate combat change. A 400 ms planted greatsword that glides sideways is neither responsive nor weighty; it is pantomime.

### 4. Normalized timing does not guarantee good cadence

The descriptor correctly scales pose duration from effective cooldown. Swift (`0.82×`) and Heavy (`1.20×`) therefore preserve normalized fractions, but not perceptual quality. Driftblade's `0.61–0.64` contact tail lasts about 10 ms on Swift, 12 ms neutral, and 14 ms Heavy—less than one 60 Hz frame. Conversely, assigning the same tuple to Drowned Anchor (`0.95 s`) would produce a Heavy pose near 730 ms and leave a long loaded hold before the next legal attack.

The pommel's snap can become syrup; the charge can become unreadably brief; the held guard can look like an animation lock even while locomotion remains live. Every carrier needs absolute-time review at its real cooldown extremes. A normalized table is not a universal animation.

### 5. Remote rendering makes every branch a multiplayer cost

`routePlayerAttacks()` scans players, maps accepted ticks to client epochs, reconstructs an effective descriptor, and calls `triggerSwing()` once per observed sequence change. Remote big swords currently add pose work but not `VfxPlayer` surfaces; preserve that boundary. Do not let “more combos” quietly allocate remote tweens, Graphics, particles, ribbons, or per-frame objects.

The correctness cost is larger than the raw CPU cost. A sequence jump, join-in-progress, weapon swap around acceptance, or rejected prediction can leave observers on different private combo steps. Ten inexpensive wrong animations are still wrong.

### 6. Five reskins make the original less special

Driftblade, Riftcleaver, Dustreaper, and Stormpetal already resolve to the same three-motion tuple. The weapon sprite, paint color, and particle element do not constitute different choreography. If all big swords acquire shoulder → pommel → charged slam, the first hour feels rich and the fifth weapon reveals the template.

Tombstone and Dervish demonstrate the healthier rule. Tombstone has quake-mauler punctuation; Dervish owns continuous spin; Driftblade owns medium–fast–slow guard flow. Preserve those verbs. Do not converge them for consistency.

## Hard measurable guardrails

These are ship gates, not tuning suggestions.

| Gate | Required measurement | Failure condition |
|---|---|---|
| **Authoritative path** | Sample visual contact geometry and server geometry every 16.7 ms for four aim directions and both facings. | Any claimed contact lies more than `MELEE_BLADE_HALFWIDTH` (21 px) outside authority, or visual active start/end differs by more than one 50 ms server tick. A hilt/capsule move using the full sword sweep fails categorically. |
| **Accepted identity** | Record `(weapon, family, variant, step, epoch)` on server, owner, and two observers under 0/100/200 ms RTT, coalesced patches, mid-chain join, timeout, rejection, and same-tick swap. | Any peer renders a different tuple, or a sequence jump advances only an inferred private counter. `attackSeq` alone does not pass this gate; sync an accepted `comboStep` (a `uint8` is sufficient) and derive motion from shared data. |
| **Damage honesty** | Compare damage, range, knockback, secondary sources, hit-stop tier, and impact VFX for every step. | Presentation implies a multiplier, second hit, hilt hit, extended range, or quake timing not produced by the server. Until path authority ships, all step-specific path multipliers and finisher emphasis stay visibly non-claims. |
| **Cadence envelope** | Capture Swift, neutral, and Heavy at 60 Hz and 144 Hz for every carrier. | Any named contact/hold beat is under 33 ms at Swift; pre-contact anticipation is under 80 ms for an ordinary big-sword hit or under 150 ms for a charged finisher; powered travel exceeds 220 ms; non-interactive full-body hold exceeds 300 ms before the next legal attack. |
| **No-commitment movement** | Replay identical full-speed strafe, diagonal, stop, and 180° reversal inputs with attacks on/off. | Root/hurtbox traces differ by more than 0.5 px, input response differs by a frame, or a supposedly world-planted weapon/foot slides for more than 80 ms while speed exceeds `0.5 × MOVE_SPEED`. If commitment is desired, it needs separate server design and approval. |
| **Hostile readability** | Ten-player overlap capture with the three longest blades, 80–100 mixed enemies, enemy melee tells, projectiles, floor danger, and parry glints; compare friendly spectacle on/off. | A friendly weapon or VFX can render over the protected glint core; the 60 ms crest loses more than 20% of its mask or drops below 4.5:1 local contrast; parry success falls more than 5 percentage points versus VFX-off baseline. |
| **Remote render budget** | Profile a 60 s, ten-player held-attack soak on minimum target hardware, with remote swings enabled and disabled. | Combo work adds more than 0.50 ms p95 or 1.0 ms max client frame time, creates any DisplayObject/tween/Graphics object per remote attack, allocates in the per-frame pose sampler, or grows heap by more than 1 MB after warm-up. |
| **VFX budget** | Count surfaces, emitters, draw calls, and pressure steals during the same soak. | A remote combo starts an authored swing surface; one accepted local swing owns more than one surface; combo layers raise the existing surface cap above 12; friendly effects pressure-steal a hostile tell or parry cue. |
| **Distinctiveness** | Show VFX-off, weapon-silhouette-normalized three-step clips to players without names or colors. | Fewer than 80% correctly distinguish the new combo from Driftblade, or the design differs only by sprite/VFX. An exact `[motion1, motion2, motion3]` tuple may ship on at most two named active weapons; the third carrier needs at least one structurally unique step. |

For distinctiveness, a new combo must differ from its nearest existing combo on at least **two** of these four axes: contact path, impact cadence, body/hand silhouette, and transition/end guard. Element, paint, trail shape, and damage number do not count.

## Narrow recommendation

Do not add a combo to Dervish Greatblade; its full-circle spin is already coherent with its authored damage coverage. Do not treat Drowned Anchor or Reaper's Lid as sword choreography just because their data family is `sword`. Do not add another hero finisher to Tombstone, Gravechill, Tombwarden, Dustdevil, or Quarry-Splitter; their quake-mauler route already culminates in the fulcrum-flip spectacle. Wyrmtooth's magma scatter makes it a poor clutter-control pilot.

After accepted-step and path authority pass, use **`x2-dustreaper-zweihander`** as the first greatsword pilot in Testing Grounds. It is a literal XL two-handed blade, has no quake layer competing for the impact, and is currently one of the redundant Driftblade-sequence carriers. Replace at least one of its three steps so the test asks whether a second big-sword identity works—not whether a new sprite makes the existing combo feel new.

Only after that passes should a poleblade pilot enter. Prefer a non-quake carrier such as **`x2-thunderhead-voulge`** or **`x2-wickfire-fauchard`**. Its sequence must visibly use haft leverage, hand travel, tip reach, and a hooked/dragging exit. It must not reuse pommel bash plus TCS.

The rollout ceiling is therefore **one new greatsword combo, then one genuinely different poleblade combo**. Broader family assignment waits for both to survive truth, cadence, readability, remote, and distinctiveness tests.

## Non-negotiable checklist

- [ ] The feedback reference is named correctly: Driftblade, not Voltedge; any clip ambiguity is resolved by its third-hit silhouette.
- [ ] The weapon's runtime id, data family, size, grip, effective cooldown range, base style, combo family, and variant are recorded.
- [ ] The server accepts and syncs the exact combo step; remote clients never infer it from a private counter.
- [ ] Buffered, rejected, duplicated, coalesced, reconnect, timeout, death/down, and weapon-swap cases produce the same step on every peer.
- [ ] Every visible contact carrier—edge, hilt, butt, hook, or tip—has matching authoritative geometry and timing.
- [ ] One accepted swing cannot visually promise two damage events unless the server owns two events.
- [ ] Finisher damage/range/knockback and secondary-source behavior are server-tested; dormant path metadata is not marketed through VFX.
- [ ] Swift, neutral, and Heavy captures pass the absolute-time cadence gates at 60 and 144 Hz.
- [ ] Full-speed strafing and reversal remain responsive, and no planted silhouette visibly skates beyond the movement gate.
- [ ] Both hands remain on a two-handed grip where required; no boundary pop, depth pop, mirror pop, or weapon duplication occurs.
- [ ] Terminal-velocity handoff returns combat-owned limbs to procedural jiggle without a snap or injected cut velocity.
- [ ] Enemy telegraphs, projectile lanes, floor danger, and the complete 60 ms parry-glint crest remain legible through ten-player spectacle.
- [ ] Remote combos remain pose-only unless a separately budgeted remote-VFX design is approved.
- [ ] The ten-player performance soak passes CPU, allocation, heap, surface-cap, and pressure-steal gates.
- [ ] The new sequence differs from Driftblade on at least two structural axes and reaches 80% VFX-off identification.
- [ ] No exact three-motion tuple ships on more than two named active weapons.
- [ ] Dervish spin, quake-mauler identity, and other existing signature verbs are not flattened into the new family template.
- [ ] The combo is still readable with all swing VFX disabled. If the pose needs a ribbon to explain the move, the pose is not done.

The bar is intentionally high because Driftblade works by being specific. The fastest way to answer the player warmly and ruin the thing they liked is to make every long blade speak with Driftblade's voice.
