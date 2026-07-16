# VFX ↔ Hitbox Audit (§20 WYSIWYG)

Audit date: 2026-07-16. Scope: the current merged 317-weapon roster (base plus expansion), projectiles, player quakes/parries/chains, boss telegraphs, and enemy contact. `WEAPONS` imports and merges the expansion table at `packages/shared/src/weapons.ts:15` and `packages/shared/src/weapons.ts:1257-1260`.

## Rating and measurement rules

| Rank | Player-facing meaning |
|---|---|
| **P0** | A dodging player can be hit outside the primary warning, or a large/repeated damage footprint is absent or materially misplaced. |
| **P1** | Aiming/dodge feedback is materially wrong, conditional, or wrong for a meaningful subset of sources. |
| **P2** | Conservative overdraw, decorative overhang, or secondary feedback is inaccurate but seldom creates a surprise hit. |

Distances are world pixels. A positive delta means the visual extends beyond the authoritative footprint (false danger/false aim promise); a negative delta means damaging reach is underdrawn. Particle trails, sparks, smoke, and debris are treated as decoration unless they resemble a boundary. For melee, “VFX outer reach” is the maximum nominal extent along aim: the VFX origin offset plus the layer radius or painted-hero half-width; it is not a per-pixel alpha trace.

## Ranked disposition

| ID | Rank | Gap | Measured discrepancy | Fix side |
|---|---:|---|---:|---|
| NET-1 | **P0** | Remote plain melee, quake, and chain attacks have no source-footprint event | Entire attack footprint absent for non-owning clients | **Code/protocol**: sync accepted attack sequence, epoch, aim/target, weapon, and authoritative secondary results |
| TG-1 | **P0** | Belt-mode boss telegraphs are drawn in world geometry after only projecting their origin | Depth dimensions are 2× correct screen size; rings can be displaced inward by `0.5R` | **Code scale/transform**: project every vertex/ellipse axis, not only `(x,y)` |
| QK-1 | **P0** | Procedural quake fallback underdraws its circular AoE | final `Ry = 0.366R`; hidden vertical reach `0.634R` top-down | **Code scale**: construct the final danger ellipse directly from authoritative `R` |
| ML-1 | **P1** | Fixed fallback melee VFX radius/origin is unrelated to swept-blade reach | 33/128 underdraw, 94/128 overdraw; range `-70` to `+112` px in audited examples | **Code scale**, then authored **art scale** outliers |
| ML-2 | **P1** | Swing-overlay phase is not remapped to the descriptor’s active interval | default arc shows through `p=.35`; ordinary edge remains active to `.74` | **Code timing** |
| ML-3 | **P1** | Two-hand orbit draws the grip away from the body after reach was computed | up to `+22.8` px visible tip beyond hit reach | **Code geometry** or authoritative reach constant/data |
| EX-1 | **P1** | Explosion is rendered at a dead-reckoned client position, not a synced detonation position | runtime/network-dependent; unbounded by a shared constant | **Code/protocol** |
| EX-2 | **P1** | Blast tests enemy centers, while the painted ring reads as body contact | false-negative band equals enemy radius (`12–230` px in current rows) | **Code geometry** or explicit center-marker art convention |
| PR-1 | **P1** | One `PROJECTILE_RADIUS=10` serves radically different projectile art | solid footprint from `1.3` to `54` px half-extent; magma glow reaches `23.8` px | **Constant/data + code geometry**; art-scale only ordinary bullets |
| PR-2 | **P1** | Projectile contact is point-sampled after movement | at 20 Hz, 1000 px/s moves 50 px/tick versus a 44 px minimum enemy-contact diameter | **Code geometry**: swept circle/capsule |
| CH-1 | **P1** | Local chain VFX re-selects stale targets with a different seed wedge | all 24 chain rows differ by `0.20–0.56` rad per side; some reach differs too | **Code/protocol** |
| NV-2 | **P1** | Deferred Conflagration burn pulse has no footprint VFX | entire second cone absent | **Code/protocol** |
| NV-3 | **P1** | Remote whiff parry/knockback/Brand activation has no source VFX | entire 135 px action radius absent | **Code/protocol** |
| QK-2 | **P1** | Painted quake hero remains circular in belt mode | `Ry=R` drawn versus correct projected `Ry=0.5R` | **Code scale** |
| TG-2 | **P1** | Horde cone telegraphs repeat the belt transform defect | direction y is compressed, but radius/sector geometry is not | **Code transform** |
| EX-3 | **P2** | Explosion decoration crosses the exact procedural boundary | disc `+5%`, sparks `+10%`, composer shards to `+24%` center distance | **Art scale/style** |
| PA-1 | **P2** | Parry/knockback visuals do not show `PARRY_RADIUS` | base ring `30` vs `135` (`-105`, `-77.8%`); Bulwark max `51` (`-84`, `-62.2%`) | **Art/code scale** |
| CT-1 | **P2** | Character/enemy body art is much larger than contact circles | normal enemy half-height/radius `1.27–3.17×`; tough swarm `5.38×` | **Art footprint** or collision **data**, depending intended balance |
| TG-3 | **P2** | Top-down boss hazards hit the player center, not the visible body | conservative miss band roughly the player’s 24 px radius | **Art convention**: show the ground hurt-point/footprint |

## 1. Melee swept edge

### Authoritative geometry

The accepted swing descriptor carries `poseSeconds`, active start/end, and impact time (`packages/shared/src/melee.ts:313-323`). Its active fractions are chop `.30–.52`, pivot `.10–.62`, punch `.16/.24–.52`, thrust `.14–.38`, derived orbit bounds, spin `0–1`, and ordinary arc `.16–.74` (`packages/shared/src/melee.ts:351-392`). The blade angle sweeps from `aim−swingArc/2` to `aim+swingArc/2` (`packages/shared/src/melee.ts:395-410`).

The authoritative edge is a segment of `meleeReach(weapon)` with `MELEE_BLADE_HALFWIDTH=21`; an enemy hits when its circle is within `enemyRadius+21` of that segment (`packages/shared/src/melee.ts:23-29`, `packages/shared/src/melee.ts:432-446`). `meleeReach` is `max(range, (1−gripFrac)×displayLength)` at the fixed render scale (`packages/shared/src/weapons.ts:292-305`). `GameRoom` stores that reach, arc, and half-width (`packages/server/src/rooms/GameRoom.ts:2219-2248`) and advances/supersamples the edge only during the active interval; belt mode instead uses forward reach plus a depth lane (`packages/server/src/rooms/GameRoom.ts:2365-2437`).

### Visual geometry

The held sprite is scaled to `displayLength` and anchored at `gripFrac` (`packages/client/src/entities/SpriteRig.ts:391-419`). The ordinary VFX is centered `0.6×weapon.range` down-aim and is always called with `VFX_RADIUS_DEFAULT=74` (`packages/client/src/scenes/ArenaScene.ts:5121-5139`; constant at `packages/shared/src/weapons.ts:494-500`). `VfxPlayer` substitutes a generated pack’s authored `vfxRadius`, otherwise retaining that 74 px fallback (`packages/client/src/vfx/VfxPlayer.ts:261-286`). Fallback suite radii are: twin `1.0R`, thrust `1.35×1.4R=1.89R`, heavy slash `1.2R`, fast trail `1.0R`, ordinary slash `1.0R` (`packages/client/src/vfx/VfxPlayer.ts:84-126`; render multipliers at `packages/client/src/vfx/vfx-render.js:223-310`). Painted heroes use a `2.4R`-wide box (`packages/client/src/vfx/vfx-render.js:838-852`).

### Spatial results

Static evaluation of the 128 primary non-gun/non-cast/non-thrown/non-quake melee rows gives 33 nominal endpoints inside authoritative reach, 94 outside, and one effectively equal; 65 are within ±20 px. Seventeen underdraw and 49 overdraw by at least 20 px. These values include the `0.6×range` origin offset and suite multiplier, but exclude decorative elemental flourishes.

| Example | Authoritative reach | Nominal visual outer reach | Delta | Rank | Evidence |
|---|---:|---:|---:|---:|---|
| Mesa-Heart Geodes | 360 | 290 | **−70** | P1 | row `packages/shared/src/weapons-expansion.generated.ts:10641-10680`; fallback/origin rules above |
| Bone Sword (`x-sword-bone`) | 150 | no directional swing layer; impact/scatter suite only | primary VFX absent | P1 | weapon `packages/shared/src/weapons.ts:884-916`; suite `packages/client/src/vfx/weapon-vfx.generated.ts:138-161` |
| Cinderchoke Brazier-Orb | 320 | 266 | **−54** | P1 | row `packages/shared/src/weapons-expansion.generated.ts:10397-10435`; ordinary fallback/origin rules above |
| Buzzcutter | 122 | 234 asset bound | **+112** | P1 | weapon `packages/shared/src/weapons.ts:729-751`; authored `R=134` hero `packages/client/src/vfx/weapon-vfx.generated.ts:25-58` |
| Voltedge | 138 | 239 | **+101** | P1 | weapon `packages/shared/src/weapons.ts:849-871`; authored `R=142`, edge `1.1` `packages/client/src/vfx/weapon-vfx.generated.ts:100-137` |
| Driftblade | 304 (sprite-tip floor) | 374 asset bound | **+70** | P1 | weapon `packages/shared/src/weapons.ts:670-699`; authored `R=162` hero `packages/client/src/vfx/weapon-vfx.generated.ts:59-72` |
| Coffin Blade | 180 | 236 asset bound | **+56** | P1 | weapon `packages/shared/src/weapons.ts:800-821`; authored `R=114` hero `packages/client/src/vfx/weapon-vfx.generated.ts:86-99` |

The sprite-tip floor is generally correct, but the two-hand orbit places the grip `TARGET_BODY_H×0.3 = 76×0.3 = 22.8` px away before extending the sprite (`packages/client/src/entities/SpriteRig.ts:36-37`, `packages/client/src/entities/SpriteRig.ts:1291-1305`, `packages/client/src/entities/SpriteRig.ts:1340-1346`). Ten current weapons therefore show some tip beyond `meleeReach`; the maximum is 22.8 px. Example: Stormpetal Odachi has `range=300`, `displayLength=335`, `gripFrac=.05`, hence authoritative reach `318.25`, while the orbit tip can reach `341.05` (`packages/shared/src/weapons-expansion.generated.ts:671-705`). **ML-3, P1.**

### Timing result

VFX playback uses the same `poseSeconds`, but retains layer-local phases (`packages/client/src/vfx/VfxPlayer.ts:319-330`). The default slash is visible only at `p=.05–.35` (`packages/client/src/vfx/vfx-render.js:274-286`) while ordinary arc damage is active at `.16–.74`: only `.19/.58 = 32.8%` of the damaging interval has the slash overlay. Twin slash overlaps `.21/.58 = 36.2%`; thrust overlaps `.21/.24 = 87.5%`. A representative two-hand orbit with `swingArc=3.1` is active about `.343–.743`, while its fallback heavy slash ends at `.35`, leaving almost the whole damaging interval without the overlay. The weapon sprite still animates locally, so this is **P1**, not a total no-warning case.

**Recommended correction:** calculate VFX origin and radius from `meleeReach`, expose a danger-edge layer whose centerline/width is the swept segment (`reach`, `MELEE_BLADE_HALFWIDTH`), and remap its normalized phase to `[activeStartSeconds, activeEndSeconds]`. Apply authored art scaling only after that shared code path is exact. Either add orbit `gripR` to authoritative reach or move the rendered grip so the visible tip remains at `meleeReach`.

## 2. Explosions

There are 31 `gun.explode` and 44 `scatter.explode` configurations in the merged roster. The server copies the exact gun/scatter radius into projectile metadata (`packages/server/src/rooms/GameRoom.ts:2830-2874`, `packages/server/src/rooms/GameRoom.ts:2901-2912`, `packages/server/src/rooms/GameRoom.ts:3020-3036`) and detonates using `r²` against each enemy center (`packages/server/src/rooms/GameRoom.ts:3200-3216`, invoked on projectile death at `packages/server/src/rooms/GameRoom.ts:3742-3748`). Examples include Hand Mortar `R=130` (`packages/shared/src/weapons.ts:1089-1120`), Wyrmtooth `R=56` (`packages/shared/src/weapons.ts:884-916`), and expansion blast radii 40 and 70 (`packages/shared/src/weapons-expansion.generated.ts:6299-6350`, `packages/shared/src/weapons-expansion.generated.ts:6890-6938`).

The procedural composite receives the synced `explodeR`; its stroked ring reaches exactly `R`, flash reaches `.8R`, disc reaches `1.05R`, and sparks reach `1.1R` (`packages/client/src/scenes/arena/vfx.ts:386-438`, `packages/client/src/scenes/arena/vfx.ts:441-503`). This core boundary is a **pass**. The new composer only dispatches at `R≥100`, scales as `clamp(R/110,.28,2.4)`, and clamps trajectory radius to `28–280` (`packages/client/src/scenes/arena/vfx.ts:343-360`, `packages/client/src/vfx/fx-composer.ts:211-215`, `packages/client/src/vfx/fx-composer.ts:242-255`). Its rings reach `1.02–1.12` of pack scale and shard centers travel `.72–1.24R` (`packages/client/src/vfx/fx-composer.ts:257-321`). Treat those as decorative **EX-3, P2**; the exact procedural ring must remain visually dominant.

Two functional gaps remain:

- **EX-1, P1:** the client spawns the explosion where its dead-reckoned container happens to be when the row disappears (`packages/client/src/scenes/ArenaScene.ts:2253-2273`), after extrapolation/correction (`packages/client/src/scenes/ArenaScene.ts:2278-2299`). The server does not sync the detonation `(x,y)`. Error depends on latency, loss, interpolation, and projectile speed; no static bound exists. Sync a detonation event/sequence with authoritative position and radius.
- **EX-2, P1:** `detonate` uses center distance ≤ `R`, not circle contact. A painted blast visibly touching an enemy can miss across a band equal to that enemy’s radius (current enemy radii 12–230 px; definitions at `packages/shared/src/enemies.ts:40-65`). Either test `R+enemy.radius`, or make the danger convention explicitly center-based with a ground-center marker.

## 3. Projectiles

All projectile collisions use the single `PROJECTILE_RADIUS=10` (`packages/shared/src/constants.ts:303-310`). Hostile contact is `10+PLAYER_RADIUS`; friendly contact is `10+enemy.radius` (`packages/server/src/rooms/GameRoom.ts:3678-3739`). `GUN_FX.size` is explicitly muzzle-flash size, not bullet geometry (`packages/client/src/scenes/arena/projectile-factory.ts:14-25`); `makeBullet` selects its own shapes (`packages/client/src/scenes/arena/projectile-factory.ts:164-226`).

| Render kind | Primary visible half-extent | Delta from `R=10` | Rank |
|---|---:|---:|---:|
| slug | circle `9` | `−1` / `−10%` | P2 |
| pellet | circle `4` | `−6` / `−60%` | **P1** |
| tracer | `7.5×1.5` rectangle | `−2.5` forward; `−8.5` cross-flight | **P1** |
| nail | `9×1.3` rectangle | `−1` forward; `−8.7` cross-flight | **P1** |
| ricochet | ring `7` | `−3` / `−30%` | P2 |
| orb | glow `13` | `+3` / `+30%` | P2 |
| grenade | ellipse `7.5×5` | `−2.5` / `−5` | **P1** |

Those dimensions come directly from `packages/client/src/scenes/arena/projectile-factory.ts:192-225`. Motion trails are excluded because they sit behind the contact point.

| Other projectile | Visual | Delta from `R=10` | Rank | Evidence |
|---|---:|---:|---:|---|
| Enemy spit | pulsing glow `12→16.8` | `+2→+6.8` | P2 | `packages/client/src/scenes/arena/projectile-factory.ts:57-79` |
| Thrown cleaver | blade length `108` (half `54`); glow `R=38` | `+44` longitudinal; `+28` glow | **P1** | `packages/client/src/scenes/arena/projectile-factory.ts:81-95` |
| Magma/scatter | painted ball `R=18`; pulsing glow `17→23.8` | `+8`; glow `+7→+13.8` | **P1** | `packages/client/src/scenes/arena/projectile-factory.ts:97-145` |
| Counter/deflect | blade `11×2` half-extent | `+1` forward; `−8` cross-flight | P2 | `packages/client/src/scenes/arena/projectile-factory.ts:147-161` |

The selection route checks `GUN_FX` before choosing magma/cleaver/counter/spit (`packages/client/src/scenes/ArenaScene.ts:2182-2191`). Expansion kind `spark` (`packages/shared/src/weapons-expansion.generated.ts:11380-11425`) is absent from `GUN_FX`, so it falls through to hostile-looking green spit despite the factory’s unused generic gun fallback. **PR-1, P1:** add `spark` to the map and move authoritative radius into projectile state or kind data; use circles/capsules that match each solid asset. Shrinking the cleaver to 20 px would destroy its weapon read, so that source needs per-kind swept capsule geometry.

`stepProjectiles` first advances a point and then performs overlap checks (`packages/server/src/rooms/GameRoom.ts:3619-3631`). At `TICK_RATE=20` (`packages/shared/src/constants.ts:16-18`), a 1000 px/s round advances 50 px/tick. The minimum current enemy contact diameter is `2×(10+12)=44` px, so a visually continuous fast bullet can tunnel through a small enemy. **PR-2, P1:** sweep the previous-to-current center segment with the same per-kind radius.

## 4. Quake

`quake.radius` is authoritative world radius; `quake.vfx.radius` is documented as an art multiplier where 1 is exact (`packages/shared/src/weapons.ts:83-104`). `GameRoom` stores `quake.radius` and detonates the shared center-radius AoE at descriptor impact (`packages/server/src/rooms/GameRoom.ts:1990-1997`, `packages/server/src/rooms/GameRoom.ts:2309-2324`). The local client uses the same clamped epicenter and delay (`packages/client/src/scenes/ArenaScene.ts:3601-3624`).

The painted hero path sets width to `2R×quake.vfx.radius` (`packages/client/src/scenes/arena/vfx.ts:519-568`); Tombstone uses `R=270`, multiplier 1 (`packages/shared/src/weapons.ts:594-623`), so its top-down horizontal scale is exact. The other 39 current quake rows have no quake hero and use the procedural ellipse (`packages/client/src/scenes/arena/vfx.ts:628-669`). It begins `44×26`, then receives `scaleX=2R/44` and `scaleY=scaleX×.62`, yielding:

`Rx = R`; `Ry = 13 × (2R/44) × .62 = 0.366R`.

Thus **QK-1, P0** hides `0.634R` (63.4%) of vertical damaging reach top-down: an `R=150` Gravechill ring shows about 55 px and leaves 95 px unshown (`packages/shared/src/weapons-expansion.generated.ts:153-191`); an `R=178` Godsbone ring shows about 65.2 px and leaves 112.8 px (`packages/shared/src/weapons-expansion.generated.ts:11599-11636`). In belt mode, a projected circle should have `Ry=.5R`; fallback `Ry=.366R` is still 26.7% short, while the Tombstone hero remains circular and overdraws depth by 2× (**QK-2, P1**). Build the final top-down/belt ellipse directly; do not multiply the seed ellipse’s aspect ratio a second time.

## 5. Boss telegraphs

Boss patterns emit shared circle, rect/lane, cone, and ring specifications (`packages/shared/src/boss-primitives.ts:28-60`). Landing, footfall, and corrosive-pool rows preserve authored center/radius (`packages/shared/src/boss-primitives.ts:275-341`); beam, ring, dash, melee, and blink primitives construct both telegraph and active geometry from the same parameters (`packages/shared/src/boss-primitives.ts:416-601`). The controller advances `t` and applies the payload from that active spec (`packages/server/src/rooms/BossController.ts:189-278`, `packages/server/src/rooms/BossController.ts:403-439`). Rect and annulus point tests are shared (`packages/shared/src/boss-primitives.ts:374-413`); server damage consumes the same circle/rect/ring/cone parameters (`packages/server/src/rooms/GameRoom.ts:2643-2737`, `packages/server/src/rooms/GameRoom.ts:3563-3594`). `RING_BAND_HALF=46` is shared by server and client (`packages/shared/src/constants.ts:436`; primitive use at `packages/shared/src/boss-primitives.ts:460-501`).

Top-down rendering is exact for the authoritative **player-center** convention: rect is `2a×2b`, cone uses `a/rot/b`, ring stroke is `2×RING_BAND_HALF`, and circle is diameter `2a` (`packages/client/src/scenes/ArenaScene.ts:2087-2164`). Players do dodge what is drawn, subject only to **TG-3, P2**: the player’s visible body is not its hurt point.

Belt rendering fails that correspondence. World y is projected by `0.5` (`packages/client/src/scenes/ArenaScene.ts:140-143`, `packages/client/src/scenes/ArenaScene.ts:3008-3011`), but telegraph sync projects only the origin and explicitly leaves radii world-scale (`packages/client/src/scenes/ArenaScene.ts:2008-2037`).

| Shape | Correct belt screen geometry | Current draw | Discrepancy | Rank |
|---|---|---|---|---:|
| Circle/AoE | ellipse `Rx=R, Ry=.5R` | circle `Rx=Ry=R` | depth diameter 2×; false danger `0.5R` each side | **P0** |
| Horizontal lane | length `2a`, depth half-width `.5b` | `2a × 2b` | depth thickness 2× | **P0** |
| Vertical lane | screen half-length `.5a`, x half-width `b` | world dimensions | depth length 2× | **P0** |
| Angled lane/cone | transform every vertex/vector by `(x,.5y)` | unchanged rotation/dimensions | skew plus both hidden and false-danger wedges | **P0** |
| Ring | elliptical annulus centered at projected origin; y radii/band compressed | circular annulus | damaging band is near `.5R` in depth while warning is near `R` | **P0** |

This is **TG-1, P0**: in particular, belt rings can damage near the boss where the drawn circular band shows empty safe space. Apply the belt affine transform to primitive vertices, or render into world space and scale the telegraph container’s y axis about the same belt origin. The horde cone path compresses only aim-direction y (`packages/client/src/scenes/ArenaScene.ts:1965-2001`) and inherits the same radius/sector problem (**TG-2, P1**).

## 6. Parry

The authoritative press radius is `PARRY_RADIUS=135`, with base knockback 96 (`packages/shared/src/constants.ts:471-476`). Server enemy selection uses center distance ≤135; Iron changes knockback, while Brand also queries the same 135 px radius (`packages/server/src/rooms/GameRoom.ts:3241-3262`, `packages/server/src/rooms/GameRoom.ts:3306-3316`).

The local base timing ring uses `R=30` (`packages/client/src/scenes/ArenaScene.ts:3723-3755`). Bulwark’s extra ring grows only to `30×1.7=51` (`packages/client/src/scenes/ArenaScene.ts:3899-3911`). Successful-parry rings top out at `16×2.6=41.6`, with smaller flash/spark extents (`packages/client/src/scenes/ArenaScene.ts:4264-4304`). No visual denotes the 135 px knockback/Brand selection radius. **PA-1, P2:** retain the 30 px timing ring, but add a distinct low-opacity ground wave expanding exactly to 135 when the spatial effect fires. If body-touch semantics are desired, also include enemy radius in the server query; currently a 135 ring touching a large sprite can still miss its center.

## 7. Chain lightning

The authoritative hop cap is `CHAIN_MAX_RANGE=320` (`packages/shared/src/constants.ts:464-467`); nearest-hop selection rejects candidates beyond `hopRange` (`packages/shared/src/combat.ts:15-34`). The server seeds inside `meleeReach` and `swingArc/2`, then selects each link with `min(chain.range,320)` (`packages/server/src/rooms/GameRoom.ts:2250-2306`).

The client draws actual node-to-node bolt segments and applies the same hop cap (`packages/client/src/scenes/ArenaScene.ts:5038-5118`), so **drawn hop length itself passes**: every rendered segment is the selected distance and ≤ authoritative range. The reconstruction does not pass. It seeds with `weapon.range` and `weapon.halfArc` against rendered enemy positions (`packages/client/src/scenes/ArenaScene.ts:5052-5087`). All 24 current chain rows have a wider server half-sweep than the client half-arc, differing by `0.20–0.56` rad per side; sprite-tip flooring also changes reach for three rows. Voltedge is `1.15` rad server versus `.62` client (`packages/shared/src/weapons.ts:849-871`), while Voltfang is `1.20` versus `.64` (`packages/shared/src/weapons-expansion.generated.ts:193-238`).

**CH-1, P1:** local VFX can omit a real chain, choose a different seed, or draw a different target path, compounded by client interpolation. Do not re-simulate target selection for presentation. Sync accepted chain link IDs/positions; as an interim correction, seed with `meleeReach(weapon)` and `swingArc/2`.

## 8. Enemy contact

Each enemy row defines collision `radius` and `contactDamage` (`packages/shared/src/enemies.ts:40-65`); current examples span small radii at `packages/shared/src/enemies.ts:145-182` through large bosses at `packages/shared/src/enemies.ts:344-370`. Contact is authoritative at center separation `enemy.radius + PLAYER_RADIUS(24)` (`packages/server/src/rooms/GameRoom.ts:2120-2151`; player constant at `packages/shared/src/constants.ts:173-174`). Toughness scales the rendered rig by 1.7 without changing contact radius (`packages/shared/src/constants.ts:334-339`, `packages/client/src/scenes/ArenaScene.ts:1789-1811`).

Every rig body is normalized to `TARGET_BODY_H=76`, then enemies receive optional `renderScale` (`packages/client/src/entities/SpriteRig.ts:36-37`, `packages/client/src/entities/SpriteRig.ts:223-243`, `packages/client/src/scenes/ArenaScene.ts:1789-1811`). Players additionally use the `CHARACTER_SCALE` table (`packages/shared/src/characters.ts:111-132`, applied at `packages/client/src/scenes/ArenaScene.ts:1581-1589`), so their nominal half-height is `38×1.06–1.25 = 40.3–47.5`, versus collision radius 24.

Across the 49 current enemy kinds, nominal enemy half-height divided by collision radius is `1.27–3.17×` before toughness. A normal radius-12 swarm has half-height 38: the authoritative player-contact separation is `12+24=36`, while nominal vertical silhouettes total `38+40.3–47.5=78.3–85.5`; they can overlap by about `42–50` px before damage. Tough scale raises the swarm ratio to `64.6/12=5.38×` and overlap-at-contact to about `69–76` px. This is conservative overdraw, not a surprise hit, hence **CT-1, P2**. The clean fix is an exact ground footprint/shadow at each collision radius (and the player’s 24 px hurt circle). Changing radii to match tall art would materially rebalance spacing and should be a deliberate data change, not an art-only cleanup.

## Damage-source visuals that are absent

| Rank | Source with no source-footprint visual | Evidence | Required fix |
|---:|---|---|---|
| **P0** | Remote player plain melee edge | Attack acceptance lives only in server combat state; `PlayerState` syncs weapon/aim and effect sequences but no attack sequence (`packages/shared/src/state.ts:35-42`, `packages/shared/src/state.ts:83-99`). Swing/VFX are started only from the owning client’s input path (`packages/client/src/scenes/ArenaScene.ts:3555-3578`, `packages/client/src/scenes/ArenaScene.ts:3662-3676`). | Sync accepted attack sequence/epoch and play the same rig/VFX for every observer. |
| **P0** | Remote player quake eruption | Server schedules it at acceptance (`packages/server/src/rooms/GameRoom.ts:2309-2324`); client eruption is local-input prediction only (`packages/client/src/scenes/ArenaScene.ts:3601-3624`). | Sync authoritative quake event with epicenter, radius, element, and impact epoch. |
| **P0** | Remote player chain bolt | Server applies links synchronously (`packages/server/src/rooms/GameRoom.ts:2250-2306`); bolt construction is local-input only (`packages/client/src/scenes/ArenaScene.ts:3662-3676`, `packages/client/src/scenes/ArenaScene.ts:5038-5118`). | Sync link IDs/positions and sequence. |
| **P1** | Deferred second Conflagration/Emberguard burn pulse | Server fires queued pulses later (`packages/server/src/rooms/GameRoom.ts:2191-2197`, queued at `packages/server/src/rooms/GameRoom.ts:3322-3330`); client draws only the initial local cone (`packages/client/src/scenes/ArenaScene.ts:3913-3941`). | Sync each pulse or a start event from which all clients schedule both exact cones. |
| **P1** | Remote whiff parry plus its knockback/Brand radius | The only synced parry sequence denotes a successful enemy-attack parry (`packages/shared/src/state.ts:94-96`); local press owns brace/rings (`packages/client/src/scenes/ArenaScene.ts:3692-3708`). | Sync parry-press sequence/epoch and augment mask/effect result. |

Projectile flight/impact, explosion core, enemy bodies/contact, zones, pits/falls, and boss/duelist/horde telegraphs do have a visual carrier; their correspondence defects are ranked above rather than listed as absent.

## Fix order

1. Add the accepted-attack/effect protocol (**NET-1**) so all clients receive authoritative melee, quake, chain, parry, burn-pulse, and explosion-event geometry.
2. Correct belt affine projection for every telegraph primitive (**TG-1**) and fix procedural quake aspect math (**QK-1**).
3. Introduce shared render geometry descriptors: melee edge origin/reach/active interval, per-kind projectile radius/capsule, and exact detonation event position.
4. Re-scale authored melee heroes and decorative explosion packs only after the shared danger boundaries are exact.
5. Add non-damaging ground-footprint conventions for player/enemy contact and parry radius; avoid balance-changing collision expansion unless design explicitly approves it.
