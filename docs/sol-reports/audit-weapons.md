# Weapon Use Audit — Sol `audit-weapons`

## Scope and method

Read-only static audit of the current main worktree. I traced weapon definition and combat helpers in `@dd/shared`, authoritative acceptance/collision in `GameRoom`, owner/remote aim and VFX in `ArenaScene`/`SpriteRig`, and the catalog guards. I made no game-code or test changes and did not run a build that could rewrite generated output.

The source hard-fails at 343 durable weapon ids: 334 active plus 9 archived (`packages/shared/src/weapon-resource.ts:283-320`). A read-only catalog census of the existing shared build found the 334 active rows split into 124 melee, 114 ranged, and 96 caster weapons. The same census found 119 guns, 22 beams, and 141 gun/beam definitions with art-space muzzle data. These categories are not all mutually exclusive at the mechanic level.

## Executive assessment

The ordinary top-down path is substantially better than the genre baseline: mouse aim is independent of movement, camera/DPR conversion is explicit, authority re-aims from the server body toward the cursor point, gun cadence carries sub-tick remainder, top-down melee is temporally swept, point-blank gun collision starts at the body, and damage is server-owned.

It is not yet safe to call weapon hit registration globally trustworthy. The old melee-tip and point-blank-gun failures are largely closed, but current projectile collision neither follows the shared projectile-envelope system nor continuously sweeps thrown/scatter rows. A second P0 lets one beam’s local damage-looking line point somewhere other than authority.

**Biggest correctness risk — projectile hit registration.** Fast thrown weapons can pass between discrete 20 Hz samples, while large/long projectile art still collides as a radius-10 body. This affects real hits and directly violates the standing VFX-collision law.

**Biggest feel win — weapon-swap readiness reconciliation.** The server already preserves per-instance cooldown debt and buffers through a 150 ms draw lock; the owner client predicts with one weapon-agnostic cooldown. Making the owner’s ready state match authority would remove both post-swap dead time and premature “ghost” muzzle/swing feedback.

## Prioritized findings

### P0-1 — Projectile authority violates the shared envelope and fast thrown weapons can tunnel

**Evidence:** The standing law requires all damage-bearing silhouettes to share one envelope (`packages/shared/src/hit-envelope.ts:2-7`), and the shared resolver already supports per-weapon radius plus longitudinal half-length (`packages/shared/src/hit-envelope.ts:338-353`). Nevertheless, `projectileVisualScale` is explicitly client-only (`packages/shared/src/weapons.ts:723-726`), and the room uses `PROJECTILE_RADIUS` directly for broad phase, enemy contact, and worm contact (`packages/server/src/rooms/GameRoom.ts:13087-13119`, `packages/server/src/rooms/GameRoom.ts:13145-13168`). Only guns/casts, or any friendly projectile’s first step, are swept; later thrown/scatter steps use a point sample (`packages/server/src/rooms/GameRoom.ts:12955-12972`).

This is observable in shipped data:

- Hand Mortar authors `projectileVisualScale: 5` (`packages/shared/src/weapons.ts:2038-2052`), making its 16 px reference shell 80 px long (`packages/client/src/vfx/gun-projectile-art.ts:69-73`), but authority still gives it a 20 px-diameter collision body.
- The 940 px/s Kunai (`packages/shared/src/weapons-expansion.generated.ts:15971-16020`) advances 47 px per 20 Hz tick (`packages/shared/src/constants.ts:79-81`). Against the radius-12 Mote Swarm (`packages/shared/src/enemies.ts:605-613`), two successive radius-22 contact samples leave a real three-pixel centerline gap after the first swept step. Iron Chakram and Quicksilver Skinning Cleaver have the same issue at 920 and 900 px/s (`packages/shared/src/weapons-expansion.generated.ts:1467-1507`, `packages/shared/src/weapons-expansion.generated.ts:16022-16070`).
- The catalog “visual/server agreement” test compares the resolver with the same authored/default numbers; it never measures rendered projectile alpha or proves that `GameRoom` calls the resolver (`tests/v7-hit-envelope-law.test.ts:191-214`, `tests/v7-hit-envelope-law.test.ts:254-273`). The owner ledger even locks Hand Mortar’s scale and radius apart (`tests/owner-notes-weapon-pose.test.ts:4-10`).

**Problem:** Direct hits can miss between ticks, and the damage-looking shell/blade can overlap a target well outside the authoritative body. The current guard gives false confidence.

**Best-practice standard:** A fast bullet-heaven projectile uses continuous previous-to-current collision. Its collision primitive is derived from the trimmed damaging silhouette (normally a velocity-aligned capsule), while glows, trails, smoke, and punctuation are explicitly decorative.

**Concrete fix:** Resolve `projectileDamageEnvelopeFor(sourceWeapon, delivery)` once into `ProjectileMeta` at spawn; source weapon and delivery are already captured (`packages/server/src/rooms/GameRoom.ts:1134-1161`, `packages/server/src/rooms/GameRoom.ts:10514-10550`). Sweep every friendly projectile every tick with that oriented capsule, including thrown and scatter. Generate/authenticate radius and half-length from each projectile identity’s trimmed alpha at final scale, excluding declared decorative layers. Add regressions for Kunai versus a Mote Swarm and Hand Mortar’s rendered bounds, and a source guard requiring `GameRoom` to consume the shared resolver.

### P0-2 — Seraph’s local beam points at the cursor while authority collides a lagged angle

**Evidence:** Seraph’s Knuckle-Reliquary authors a 0.22 s sweep lag (`packages/shared/src/weapons-expansion.generated.ts:14099-14106`). Authority applies that lag/turn cap during charge and active damage (`packages/server/src/rooms/GameRoom.ts:8074-8080`, `packages/server/src/rooms/GameRoom.ts:8234-8242`) and collides the resulting replicated angle with a supersampled swept band (`packages/server/src/rooms/GameRoom.ts:8530-8621`). The local renderer then branches on the exact Seraph id and replaces the row’s angle with the current live-cursor angle (`packages/client/src/vfx/BeamRenderer.ts:617-634`); `ArenaScene` supplies that cursor only for Seraph (`packages/client/src/scenes/ArenaScene.ts:15560-15565`). Its test explicitly requires cursor termination but checks only the length cap (`packages/client/src/vfx/BeamRenderer.test.ts:28-35`).

**Problem:** During cursor turns, the owner can see the energetic beam crossing a target that takes no damage; teammates see the authoritative lagged line. This is both a hit-readability failure and a catalog one-off.

**Best-practice standard:** A damage-looking beam must depict the exact authoritative origin, angle, length, and width. Responsive intent feedback may lead authority, but it must read as a reticle/ghost guide rather than the damage band.

**Concrete fix:** Delete the client id branch and make aiming policy data-driven in `BeamDef`. If Seraph is meant to hard-lock to the cursor, authority must resolve and replicate that endpoint/angle and omit sweep lag for this policy. If lag is intentional, render the replicated row exactly and add a clearly non-damaging cursor reticle or faint intent guide.

### P1-1 — Swap prediction does not know per-weapon cooldown debt or draw lock

**Evidence:** Authority saves/restores cooldown debt per slot/weapon (`packages/server/src/rooms/GameRoom.ts:2977-3037`), advances stowed debt (`packages/server/src/rooms/GameRoom.ts:3071-3093`), and applies a 0.15 s draw lock (`packages/shared/src/constants.ts:448-456`). Acceptance waits for both restored cooldown and draw lock (`packages/server/src/rooms/GameRoom.ts:5824-5854`), while early input is buffered through that lock (`packages/server/src/rooms/GameRoom.ts:1502-1530`).

The owner has one scalar `localAtkCd` (`packages/client/src/scenes/ArenaScene.ts:1582-1585`). It is checked/set from whichever weapon is currently held (`packages/client/src/scenes/ArenaScene.ts:10147-10185`) and is not reconciled in the identity-change/equip path (`packages/client/src/scenes/ArenaScene.ts:3297-3410`).

**Problem:** Swapping away from a slow weapon can retain unnecessary local lockout even when the incoming weapon is ready. Swapping to a weapon with remaining server debt can instead play a predicted swing, flash, sound, and attack beat before authority accepts it. The server buffer prevents some lost inputs, but not the felt hesitation or false feedback.

**Best-practice standard:** Fast weapon swapping should preserve each weapon’s debt without transferring it, expose the short draw gate, and predict only the readiness state authority will accept.

**Concrete fix:** Replicate owner-only effective ready time for each arsenal instance plus draw-lock end, or mirror the server ledger client-side keyed by immutable instance/slot. On an identity edge, rebase the local scheduler from that weapon’s debt instead of retaining the previous scalar. Show the 150 ms draw/queued-attack state, and bind full attack VFX to the accepted `attackSeq`; a lightweight input cue can remain immediate.

### P1-2 — Belt melee is lane-authoritative but still presented as cursor-angle-authoritative

**Evidence:** Belt cursor coordinates are correctly projected for display and unprojected before sending to the sim (`packages/client/src/scenes/ArenaScene.ts:9601-9637`, `packages/client/src/scenes/ArenaScene.ts:10444-10454`). Guns/casts use that point. Belt melee does not: authority reduces aim to left/right and tests horizontal reach plus a depth window (`packages/server/src/rooms/GameRoom.ts:8769-8795`). The owner rig and slash still rotate directly along `selfAim` and place their target endpoint toward the cursor (`packages/client/src/scenes/ArenaScene.ts:10396-10438`).

**Problem:** A diagonal-looking belt slash is not the collision shape. It can hit an enemy elsewhere in the horizontal lane or fail on an enemy that appears aligned with the diagonal ribbon but lies outside the depth tolerance.

**Best-practice standard:** A belt/brawler lane model is valid, but the attack pose, telegraph, and collision must all communicate the same quantized facing and depth band. Continuous cursor-angle art implies continuous cursor-angle collision.

**Concrete fix:** Choose and test one contract. Preferred for the existing SoR-style mode: keep lane collision, quantize melee pose/VFX to left/right, and draw a brief floor/depth contact band matching `DEPTH_TOL_PLAYER`; leave guns/casts on continuous cursor aim. Alternatively, run the same unprojected swept-blade geometry used in top-down. Do not combine a lane hitbox with a diagonal damage ribbon.

### P1-3 — Bound-pair set bonuses and “final” DPS previews disagree with authority

**Evidence:** Authority deliberately excludes the linked off-hand from class-set counting because a pair is one build choice (`packages/server/src/rooms/GameRoom.ts:3439-3448`). The arsenal HUD instead constructs the loadout from all three visible slot identities (`packages/client/src/scenes/ArenaScene.ts:13731-13739`); the level-up model does the same (`packages/client/src/ui/level-up-model.ts:114-120`, `packages/client/src/ui/level-up-model.ts:404-420`). Pair preview applies `weaponSetBonus` to that client list (`packages/client/src/ui/pair-preview.ts:85-103`), and `ArenaScene` passes the pre-bind slot list while claiming the result is final (`packages/client/src/scenes/ArenaScene.ts:14637-14677`, `packages/client/src/scenes/ArenaScene.ts:14766-14777`).

The same panel appends “Separate magazines” for a gun pair (`packages/client/src/ui/pair-preview.ts:112-126`), although authority explicitly treats magazine/reload as authoring inputs and uses one shared Drive bar (`packages/server/src/rooms/GameRoom.ts:5882-5907`); the bound-state UI itself correctly says “one shared Drive bar” (`packages/client/src/scenes/ArenaScene.ts:14753-14761`).

**Problem:** A lead/off/third-class layout can show +8% or +18% that the server does not apply, and the bind preview can overstate both per-hand damage and pair DPS. Contradictory magazine/Drive language obscures actual dual-wield ergonomics.

**Best-practice standard:** Inspected damage and loadout bonuses must be computed from the same effective loadout that authority consumes. A confirmation labeled final must model the post-action state.

**Concrete fix:** Move `effectiveLoadoutIds(player)`/pair-count policy to shared code and use it in server damage, HUD, level-up context, and preview. Build the proposed post-bind state before calculating the preview, including the deterministic bag target. Remove “Separate magazines”; show “shared Drive, separate cooldown debts” and the exact set-bonus delta. Add a pair regression where two same-class hands plus an off-class third slot must not earn a two-piece set bonus.

### P2-1 — Count/cadence orders have inconsistent payload semantics and no nominal-DPS invariant

**Evidence:** Gun `damage` is defined per bullet/pellet and fixed pellets/burst rounds therefore multiply payload (`packages/shared/src/weapons.ts:693-712`); burst follow-ups spend no second input or Drive (`packages/server/src/rooms/GameRoom.ts:10576-10610`). Parallel muzzles and random-pellet rolls divide a trigger pool (`packages/server/src/rooms/GameRoom.ts:10695-10737`), and cast volleys also divide one total payload (`packages/server/src/rooms/GameRoom.ts:10839-10895`). Fixed scatter count remains damage per projectile (`packages/server/src/rooms/GameRoom.ts:11115-11141`). Beam DPS is normalized per time and caps aggregate multi-target output (`packages/shared/src/combat.ts:351-366`).

At the 192-row arena cap (`packages/shared/src/weapons.ts:154-161`), `fireProjectile` rejects rows one at a time (`packages/server/src/rooms/GameRoom.ts:10492-10501`), so a fixed multi-muzzle/pellet volley can be partially admitted and lose payload based on loop order. In addition, the supposedly seeded fixed-gun path uses global `Math.random()` for a one-pellet spread (`packages/server/src/rooms/GameRoom.ts:10695-10720`); a read-only census found 14 active definitions on that path, including Grit Snubnose (`packages/shared/src/weapons-expansion.generated.ts:4385-4396`).

**Problem:** “Increase projectile/burst count” sometimes preserves nominal DPS, sometimes multiplies it, and sometimes loses it under row pressure. Content orders can silently alter damage and Drive efficiency. Spread replay is nondeterministic despite the adjacent source comment promising room-seeded headings.

**Best-practice standard:** Every multi-projectile definition declares whether damage is per trigger or per projectile; the shared simulator derives per-row damage, resource cost, and advertised DPS from that declaration. Gameplay RNG is server-seeded and reproducible. Capacity policy is atomic or deliberately degrades presentation rather than damage.

**Concrete fix:** Add a shared `payloadSemantics: "perTrigger" | "perProjectile"` and central volley builder for gun, burst, cast, scatter, and multi-muzzle emission. Reserve an entire damage volley atomically or collapse excess rows into non-colliding visuals/one aggregate collision row. Replace the single-pellet `Math.random()` path with the existing seeded volley RNG. Add catalog snapshots for neutral accepted DPS, Drive per damage, and before/after count/cadence changes.

### P2-2 — Muzzle source points are well guarded, but full live-pose equivalence is not

**Evidence:** The shared affine is precise and is the sole art-point transform (`packages/shared/src/weapon-muzzle.ts:26-100`). Authority selects generated art-space points and applies a canonical stance/recoil transform (`packages/shared/src/weapons.ts:988-1036`, `packages/server/src/rooms/GameRoom.ts:10646-10671`). The client transforms the same points through the final live image/root matrix (`packages/client/src/entities/SpriteRig.ts:3318-3373`) and reanchors observed rounds to that live tip (`packages/client/src/scenes/ArenaScene.ts:7006-7077`).

The source guard is strong: every gun/beam must have a muzzle (`packages/shared/src/weapons.ts:2209-2222`), and all 141 are regenerated from installed PNG alpha with documented exceptions (`tests/v5g-gun-muzzle-alpha.test.ts:12-66`). But canonical stance selection still contains family/name heuristics (`packages/shared/src/weapons.ts:884-935`), while pose tests cover representative semantic poses and reviewed PCA outliers rather than every live aim/facing/recoil/dual/belt affine (`tests/weapon-orientation-fixer.test.ts:20-65`).

**Problem:** The barrel point in source art is trustworthy; “the authority projectile starts on the exact barrel pixel visible this frame across all weapons” is not proven. Procedural hand motion, jiggle, flourish, dual-hand choice, and client reanchoring can move presentation away from the canonical authority pose.

**Best-practice standard:** Damage origin and rendered origin share the complete transform, or the allowed discrepancy is explicitly bounded and tested across the whole ranged catalog.

**Concrete fix:** Add a catalog matrix that captures all 141 ranged weapons at left/right and representative aim, recoil, burst, dual-wield, and belt poses; compare final client muzzle to the canonical/replicated authority origin within the existing one-pixel law. Replace name regexes with explicit pose-family metadata as exceptions emerge. If live procedural motion intentionally differs, render a decorative connector from the live barrel to the immutable authority origin rather than moving the damage-bearing projectile/beam.

### P2-3 — Mouse aim is exact but there is no alternate-aim accessibility layer

**Evidence:** The client reads raw DOM pointer movement, correctly scales CSS coordinates into the render buffer, and feeds the camera transform (`packages/client/src/scenes/ArenaScene.ts:2555-2575`, `packages/client/src/scenes/ArenaScene.ts:9601-9637`). Facing follows the mouse rather than movement (`packages/client/src/scenes/ArenaScene.ts:9731-9742`), and fixed input carries aim/target to authority (`packages/client/src/scenes/ArenaScene.ts:15389-15408`, `packages/client/src/scenes/ArenaScene.ts:15741-15767`). There is no player aim-assist, target magnetism, lock-on, or gamepad target-selection stage in this path.

**Problem:** This is appropriate for precision mouse play, but the bullet-heaven/co-op control surface has no documented controller/stick or reduced-dexterity alternative. Belt mode is especially demanding because depth is visually compressed.

**Best-practice standard:** Keep raw mouse aim unassisted by default, while offering an optional, legible assist policy for stick/accessibility input. Target selection must be visible and authority must still validate the resulting direction/point.

**Concrete fix:** Add input-source-aware aim policy: raw cursor remains unchanged; right-stick/accessibility mode gets bounded angular magnetism or nearest-in-cone selection with a visible target reticle and immediate manual override. Send the resolved aim intent through the existing server-normalization path (`packages/server/src/rooms/GameRoom.ts:1502-1551`).

### P2-4 — Catalog census protects cardinality, not acquisition-role truth

**Evidence:** The hard census protects 334 active plus 9 archived ids (`packages/shared/src/weapon-resource.ts:283-320`), and the expansion generator has a field-level survival test after historical dropped mechanics (`tests/data-consistency.test.ts:119-180`). However, `WeaponDef.expansion` still says expansion weapons are absent from gallery/drop (`packages/shared/src/weapons.ts:786-789`), while `DROP_POOL` intentionally admits expansion rows inside a power band (`packages/shared/src/loot.ts:284-304`). The roster test only proves expansion rows are not in `WEAPON_IDS` while calling that “cycleable/droppable” (`tests/weapons.test.ts:370-386`).

**Problem:** The catalog is data-driven, but “active,” “cycle roster,” “gallery,” and “drop eligible” are conflated in comments/tests. A count can stay green while a weapon enters or leaves the wrong player-facing surface.

**Best-practice standard:** Large catalogs define explicit, independently tested acquisition/presentation roles; cardinality is a secondary invariant.

**Concrete fix:** Rename `WEAPON_IDS` to its actual role (for example `CURATED_CYCLE_IDS`) and expose explicit `ACTIVE`, `GALLERY`, `DROP`, and `ARCHIVED` sets. Update comments and tests to assert membership predicates and exact cross-set rules, plus census deltas, rather than inferring drop behavior from absence in the cycle list.

## What is trustworthy now

### Aiming and facing

- Top-down cursor tracking is direct, DPR/camera aware, independent of movement, and server-normalized. Authority recomputes the launch direction from its body to the submitted cursor point, avoiding predicted-body skew (`packages/server/src/rooms/GameRoom.ts:10562-10574`).
- Belt gun/cast/beam aiming correctly converts between projected screen depth and simulation depth (`packages/client/src/scenes/ArenaScene.ts:15389-15408`). Belt melee is the deliberate exception described in P1-2.
- There is no hidden mouse magnetism or aim assist in the traced player path.

### Firing model

- Gun cadence preserves sub-tick remainder instead of quantizing fast guns to 20 Hz (`packages/server/src/rooms/GameRoom.ts:5702-5713`, `packages/server/src/rooms/GameRoom.ts:5882-5907`). Non-gun tap deliveries intentionally advance on the next legal room tick (`packages/shared/src/combat.ts:89-100`).
- Burst follow-ups use the shooter’s then-current authoritative body, aim, and art-space muzzle, producing a moving/tracking burst rather than replaying a stale origin (`packages/server/src/rooms/GameRoom.ts:10592-10610`, `packages/server/src/rooms/GameRoom.ts:10646-10674`).
- Beam damage is server-owned, continuously swept over origin/angular motion, and time-normalized; multiple rays deduplicate targets before applying the aggregate DPS budget (`packages/server/src/rooms/GameRoom.ts:8530-8685`). Seraph’s local override remains the exception.
- Nominal DPS is not automatically preserved when a content order changes fixed pellet, scatter, or burst count. Random pellets, casts, and parallel muzzles do preserve a declared trigger pool. That distinction is currently implicit.

### Hit registration

- The historical melee-tip miss is explicitly addressed by flooring reach at the visible business end (`packages/shared/src/weapons.ts:1072-1087`). Top-down authority creates a timed shared envelope (`packages/server/src/rooms/GameRoom.ts:7401-7452`) and supersamples angular travel through a blade segment that includes point-blank contact (`packages/server/src/rooms/GameRoom.ts:8851-8966`, `packages/shared/src/melee.ts:2126-2140`).
- The historical point-blank gun/cast dead zone is closed: launch is at the muzzle, but the first collision sweep begins at the authoritative player body (`packages/server/src/rooms/GameRoom.ts:10739-10761`, `packages/server/src/rooms/GameRoom.ts:12955-12972`).
- Hits and damage are server-authoritative. The client predicts pose, sound, flashes, and contact punctuation; it does not decide enemy damage (`packages/server/src/rooms/GameRoom.ts:1502-1551`, `packages/server/src/rooms/GameRoom.ts:13120-13138`).
- Overall hit registration is therefore **not fully trustworthy** until P0-1/P0-2 are fixed. Top-down melee and ordinary gun point-blank behavior are credible; projectile silhouette/sweep and Seraph beam truth are not.

### Weapon handling and readability

- The three-slot/bag model is authoritative and loss-aware: swap, stash, and equip preserve identities and swap occupied contents instead of destroying them (`packages/server/src/rooms/GameRoom.ts:1685-1764`). Dual-wield eligibility is shared, limited to different genuine one-handers of the same class/delivery (`packages/shared/src/weapons.ts:1105-1127`), and authority alternates hands with separate debts and a bounded throughput multiplier (`packages/shared/src/weapons.ts:1156-1172`, `packages/server/src/rooms/GameRoom.ts:7284-7398`).
- The HUD treats a bound pair as atomic and prevents selecting/stowing only its linked off-hand (`packages/client/src/scenes/ArenaScene.ts:13441-13459`, `packages/client/src/scenes/ArenaScene.ts:13664-13684`). Set-bonus numbers and preview truth still need P1-3.
- Draw/stow/after-attack flourishes are presentation, cancel on attack/input, and do not impose an extra combat lock (`packages/client/src/entities/SpriteRig.ts:3544-3613`, `packages/client/src/entities/SpriteRig.ts:3665-3708`, `packages/client/src/entities/SpriteRig.ts:8190-8213`). The server’s only universal swap gate is the explicit 150 ms draw lock.
- The VFX-collision law materially improves melee extensions, beam width/range, and point origins. Its readability benefit is undermined where projectile bodies and Seraph’s local line bypass the same truth.

## Catalog and guard conclusion

The 334-weapon catalog is mostly definition-driven: class, delivery, cadence, damage sources, dual eligibility, set bonus, Drive profile, muzzle coordinates, and most VFX identity flow from shared data. The strongest guards are the exact census, field-level expansion-codegen comparison, all-141 source-muzzle alpha check, and reviewed art-axis outliers.

They do not yet prove behavioral uniformity. The two important bypasses are a global server projectile constant/conditional sweep and an exact client weapon-id branch for Seraph. Projectile visual/collision tests compare shared authoring with itself, full live pose is sampled rather than exhaustively cross-checked, DPS semantics are implicit, and roster-role comments/tests are stale. The census protects existence; it does not make every weapon’s damage silhouette, preview, or acquisition role correct.

Verdict: CONDITIONAL FAIL — top-down melee, cadence, server authority, and art-space muzzle sources are substantially sound, but projectile hit registration and Seraph’s split beam truth keep the 334-weapon system below ship-trustworthy.
