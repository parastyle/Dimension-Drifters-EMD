# Arena map QoL review

**Lens:** a player navigating a 4,800 × 4,800 procedural arena while aiming, kiting, reading tells, and trying to keep a squad together. Findings are ranked by player harm, then leverage. **S** is a focused client/shared/server edit, **M** crosses a few seams or needs seeded tuning, and **L** needs a stronger generation/validation model.

**Prior-panel boundary:** this review does not repeat the parked requests for zone reward pricing, ranged-AI flanking around cover, rewards for player-authored pit kills, a first-crossing zone name card, a full party strip, or the already-shipped grounding/rim/art pass. It calls out the current zone/POI work only where the shipped implementation breaks its own navigation promise. There are **22 findings**.

## P0 — run-ending, misleading, or unfair under pressure

### QOL-01 — A close-range boss kill can extract the squad before anyone chooses — **M**

The extract gate opens at the boss's exact death coordinate, and any living body inside its 90 px circle immediately begins the extraction boundary. The guaranteed boss weapon drop is created only after the gate opens. A melee player standing on the corpse can therefore auto-bank on the next simulation pass, skip the advertised extract-versus-rift decision, and lose the practical chance to inspect the capstone drop. `packages/server/src/rooms/GameRoom.ts:6327-6343`, `packages/server/src/rooms/GameRoom.ts:8594-8614`, `packages/server/src/rooms/GameRoom.ts:8677-8687`

**Concrete fix:** give extract a 0.75–1.0 second arming beat, require a fresh enter after arming, then use a short explicit hold with **HOLD TO EXTRACT — BANK & END** copy. During the arming beat, vacuum or reserve the guaranteed boss drop so the portal cannot end the run before the reward is readable.

### QOL-02 — A jump or slide-hop pressed at the lip can lose to the pit phase — **M**

Horizontal movement and slide momentum are integrated first; grounded pitfall resolution runs next; only later does `stepSlideStance` launch a buffered slide-hop and the standard jump buffer seed vertical velocity. At 20 Hz, a valid last-moment press can move the player's center into the pit and deal 15% max-HP damage before the accepted traversal input makes them airborne. `packages/server/src/rooms/GameRoom.ts:3281-3297`, `packages/server/src/rooms/GameRoom.ts:3414-3466`, `packages/server/src/rooms/GameRoom.ts:3558-3571`

**Concrete fix:** consume ready standard-jump and slide-hop launch edges before horizontal integration and pit sampling. Keep landing/fall resolution later, and add regression tests for a player one movement tick from a lip with both tap-jump and slide-hop inputs.

### QOL-03 — The extract portal can be placed inside a landmark or over a pit — **M**

Bosses explicitly ignore compound POI collision and pit death, so a boss can die on either terrain type. `openPortal` copies that raw death position into the extract gate; only the deeper rift is passed through `safeSpawnPos`. The result can be a visible-but-unenterable extract circle under a compound collider or a gate whose center immediately causes a pit fall. `packages/server/src/rooms/GameRoom.ts:3823-3846`, `packages/server/src/rooms/GameRoom.ts:8599-8614`

**Concrete fix:** solve the two gates as a pair of full-footprint safe discs. Place extract on the nearest reachable ground disc outside every POI child, place rift at least `2 × EXTRACT_RADIUS + 80` px away, and re-solve both after either nudge. Preserve a short beam from the corpse to the relocated gate so the reward still reads as coming from the kill.

### QOL-04 — The gate's most important world read renders behind the battlefield — **S**

Both gate rings and their labels live in a container at depth `1`, while POI sprites use `depth = poi.y` and actors are likewise y-sorted. The offscreen locator also disappears as soon as the target point merely enters the raw camera rectangle. Thus an on-screen gate can be buried by an XL landmark, bodies, or the HUD-safe edge while its locator has already vanished. `packages/client/src/scenes/ArenaScene.ts:5023-5044`, `packages/client/src/scenes/arena/floor-renderer.ts:38-40`, `packages/client/src/scenes/arena/floor-renderer.ts:928-933`, `packages/client/src/scenes/arena/floor-renderer.ts:994-998`, `packages/client/src/scenes/ArenaScene.ts:7383-7394`

**Concrete fix:** split each gate into a ground disc below actors and a protected thin halo/icon/label above world occluders but below HUD. Keep the edge locator until the complete gate circle is inside a padded HUD-safe viewport, and force a three-second locator pulse when the gates first open even if their centers are technically on-screen.

### QOL-05 — “Spawn 720 px away” is not a postcondition — **M**

The director computes a point on a 720 px ring, clamps it to the arena caps, then lets `safeSpawnPos` snap it off pits and POIs. It never rechecks distance or visibility after those corrections. Near an edge—or beside a broad pit/cluster—the final enemy can arrive far inside the promised warning ring, including close to the anchor who caused the cap. `packages/shared/src/constants.ts:287-295`, `packages/server/src/rooms/GameRoom.ts:8304-8315`, `packages/server/src/rooms/GameRoom.ts:8330-8348`, `packages/shared/src/mapgen.ts:1211-1236`

**Concrete fix:** generate several candidates, apply the real safe-position correction to each, then reject any final point closer than a tuned minimum (start at `0.85 × SPAWN_RING`) to every living player or inside a conservative gameplay-camera rectangle. If none pass, defer that spawn tick instead of converting distance into surprise.

## P1 — repeatedly costly or confusing during ordinary combat

### QOL-06 — A two-tile “hop me” crossing has almost no real tolerance — **M**

The map contract and local rim test accept up to two 80 px pit cells. A normal hop has a nominal horizontal budget of `320 px/s × 0.55 s = 176 px`: only 16 px beyond the 160 px void before takeoff/landing clearance, steering, tick cadence, and the late-launch ordering in QOL-02. The navigation audit nevertheless adds a categorical hop edge for one or two pit cells, and the renderer gives both the same positive lip vocabulary. `packages/shared/src/constants.ts:21`, `packages/shared/src/constants.ts:218-224`, `packages/shared/src/constants.ts:387-390`, `packages/shared/src/mapgen.ts:1347-1364`, `packages/client/src/scenes/arena/floor-renderer.ts:1054-1066`

**Concrete fix:** either reduce tap-hop-certified gaps to one tile or add a small authoritative coyote/landing assist that makes two tiles genuinely comfortable. Replace the tile-count proof with a continuous traversal test using body radius, live movement speed, fixed-tick launch timing, and a valid landing disc; drive the rim mark from that result.

### QOL-07 — The strongest zone material can disagree with the exact boundary by 256 px — **M**

Painted ground is chosen once per 512 px tile from the zone at that tile's center, while the authoritative zone grid is 80 px and the exact overlay is only 2.5–12% wash plus a 3 px seam on one sixth of boundary cells. Near an irregular boundary, the high-area painted material can extend several zone cells across the truth and overpower the correct low-alpha seam. During combat this teaches “I am in Cover/Scar” from the wrong layer. `packages/client/src/scenes/arena/floor-renderer.ts:660-676`, `packages/client/src/scenes/arena/floor-renderer.ts:1357-1375`, `packages/client/src/scenes/arena/floor-renderer.ts:1390-1412`

**Concrete fix:** classify 512 px blocks as zone-specific only when their footprint is wholly inside one zone; use a neutral transition tile for mixed blocks. Raise the exact seam—not the whole wash—to a restrained 24–32 px dual-material edge above path wear, and verify it in combat-density/grayscale captures.

### QOL-08 — The rim has a binary answer for three traversal verbs — **M**

Every local segment is reduced to `hop` or `go around`: restrained notches for up to `MAP_MAX_JUMP_TILES`, chevrons otherwise. The new held distance leap reaches 372 px, while slide-hop reach varies with retained momentum. A wide edge marked “go around” may be a valid held leap, and a notch says nothing about whether a ground slide must hop now. `packages/client/src/scenes/arena/floor-renderer.ts:1442-1447`, `packages/client/src/scenes/arena/floor-renderer.ts:1474-1499`, `packages/shared/src/constants.ts:438-449`, `packages/shared/src/constants.ts:467-485`

**Concrete fix:** keep the static lip strictly about **tap jump** and make that meaning explicit with one stable tap glyph. Let the existing held-leap preview carry the long-crossing answer, and add a short forward lip flare only while the local player is ground-sliding toward a pit inside the next two simulation ticks. Do not encode variable slide reach into permanent terrain art.

### QOL-09 — The distance-leap preview validates the endpoint, not the flight — **M**

Client and server both project a 372 px endpoint and pass only that endpoint through `safeSpawnPos`. The dashed preview therefore remains a straight “valid” line through compound POI circles. During the actual leap, per-tick POI projection distorts the path while dash velocity keeps driving forward, so the player can collide, scrape around a lobe, or land away from the promised marker. `packages/client/src/net/prediction.ts:293-331`, `packages/server/src/rooms/GameRoom.ts:2841-2881`, `packages/server/src/rooms/GameRoom.ts:3360-3379`

**Concrete fix:** add one shared swept-circle query against every POI child and arena cap. Use it in both preview and authority: shorten the target to the first safe contact (or reject the launch), tint the obstructed part of the dash line, and draw the actual landing disc rather than only a point.

### QOL-10 — A ground pound can damage through a pit, then punish the player one tick later — **S**

Pitfall sampling happens before vertical integration. A pound that touches down over a pit is skipped as airborne in that pass, then immediately runs `applyPoundImpact`; on the next tick the now-grounded player falls and snaps back. The terrain simultaneously says “no floor here” and grants a full floor impact. `packages/server/src/rooms/GameRoom.ts:3414-3430`, `packages/server/src/rooms/GameRoom.ts:2902-2924`, `packages/server/src/rooms/GameRoom.ts:3573-3597`

**Concrete fix:** at the landing edge, test the full landing disc before dispatching pound impact. If unsafe, suppress damage/CC, resolve the pit fall immediately, and play a distinct swallowed-impact effect at the lip; never show the normal pound ring over void.

### QOL-11 — The one-tile perimeter can become a 56 px kiting gutter — **M**

Only one 80 px border tile is forced to ground. With a 24 px player radius and a pit allowed immediately inside that tile, the usable center band between arena clamp and pit edge is only 56 px—barely one player, not a player passing a horde. Validation checks only the outermost row/column, so long cap-adjacent pits and corner traps still pass. `packages/shared/src/constants.ts:203-207`, `packages/shared/src/mapgen.ts:404-420`, `packages/shared/src/mapgen.ts:1436-1444`

**Concrete fix:** reserve a two-tile pressure perimeter (three tiles at corners), or validate an equivalent continuous clear width after pit generation. Add cap tests with a player plus a large normal enemy moving in opposite directions; the perimeter should be an escape lane, not a cul-de-sac.

### QOL-12 — “Everything is reachable” does not mean “I can kite back out” — **L**

The new navigation audit is a real improvement over the earlier panels: it inflates POIs and checks every navigable cell. But it still accepts a single connected component, a single approach cell within three tiles of each cluster, and hop-only articulation points. It does not cap dead-end depth, require two independent exits from a POI court, or measure a choke under simultaneous player/enemy bodies. `packages/shared/src/mapgen.ts:1295-1314`, `packages/shared/src/mapgen.ts:1368-1400`

**Concrete fix:** build a pressure graph from player-radius cells with corridor-width annotations. Reject long cul-de-sacs, require two vertex-disjoint walking exits from each cluster court and each outer zone to Commons, and treat hop links as optional shortcuts rather than the sole escape. Run the check at player radius and at the largest non-boss enemy radius.

### QOL-13 — A late joiner spawns into live threat with zero insertion protection — **M**

Every arena join uses a random ±100 px offset at the center regardless of elapsed time, nearby enemies, hostile zones, or active boss geometry. The combat record starts with `invuln = 0`; unlike revive/restart policy, joining does not clear or avoid threats. A friend joining an established run can load into a center pile and take damage before understanding the map or camera. `packages/server/src/rooms/GameRoom.ts:2316-2361`, `packages/server/src/rooms/GameRoom.ts:2394-2441`, `packages/shared/src/constants.ts:304-316`

**Concrete fix:** for non-initial joins, choose the free spawn-disc point that maximizes distance from enemies, zones, POIs, and other players; if the minimum threat distance is still poor, use the nearest safe Commons point. Grant 1.5 seconds of insertion grace that ends on attack, and show its boundary clearly without granting offensive immunity.

### QOL-14 — Co-op spawn spread is random overlap, not a formation — **S**

Join, restart, and rift descent independently roll every player inside the same 200 px square. Ten players can overlap heavily, after which the body solver untangles them only after movement begins. This produces opening shoves and downed/living piles on a fresh dimension. `packages/server/src/rooms/GameRoom.ts:2123-2129`, `packages/server/src/rooms/GameRoom.ts:2351-2360`, `packages/server/src/rooms/GameRoom.ts:3341-3358`, `packages/server/src/rooms/GameRoom.ts:8651-8666`

**Concrete fix:** assign stable spawn slots from sorted session IDs on two concentric rings inside the guaranteed-clear disc, with at least `2 × PLAYER_RADIUS + 12` px separation. Pass each slot through safe placement and orient all players toward the same open Commons heading.

### QOL-15 — The shipped cluster deal has no Commons landmark court — **S**

The placement comment promises four Cover courts, one sparse Commons navigation cluster, and one Scar claim. The actual desired-zone array contains five Cover entries and one Scar entry. Validation checks six clusters and member counts, but not the intended zone allocation, so this wrong distribution ships cleanly and removes the central neutral landmark the player could use as “home.” `packages/shared/src/mapgen.ts:805-821`, `packages/shared/src/mapgen.ts:892-907`, `packages/shared/src/mapgen.ts:1426-1435`

**Concrete fix:** change the deal to four Cover, one Commons, one Scar; validate the exact zone histogram and require the Commons anchor outside the spawn ring but connected to its strongest wear-route trunk.

### QOL-16 — Twenty-eight POIs do not create twenty-eight usable callouts — **M**

The generator guarantees 28 landmarks and a useful XL cadence, but each dimension offers only six or seven visual metas and the chosen image is a modulo of kind, zone, and cluster. Repetition is inevitable and no landmark carries a semantic/callout identity, so “meet at the obelisk” cannot be distinguished from the other copies of the obelisk. `packages/shared/src/constants.ts:226-240`, `packages/shared/src/mapgen.ts:666-669`, `packages/client/src/scenes/arena/floor-renderer.ts:946-960`

**Concrete fix:** reserve one non-repeating `navAnchor` meta per macro cluster, with a short dimension-local noun and a distinct silhouette/accent; satellites may repeat. Surface the noun only on ping, gate routing, or a brief proximity caption—never as 28 permanent labels.

### QOL-17 — Pickup safety checks the center against pits, not the pickup footprint — **M**

All weapon drops correctly route through `placePickupPos`, and `safeSpawnPos` correctly inflates POI collision by pickup radius. Against pits, however, it tests only `isPitAtPx(nx, ny)`. A 46 px-radius pickup can be centered on the last ground pixel while much of its halo/art hangs over the void, reading as “loot in the pit” even though it remains technically grabbable. `packages/shared/src/mapgen.ts:1211-1235`, `packages/server/src/rooms/GameRoom.ts:6417-6449`

**Concrete fix:** add a shared nearest-safe-disc placement helper that samples the full pickup radius against pit tiles and POI children. Use it for mystery drops, enemy-held weapon drops, manual drops, portals, and any future map terminal; preserve the original corpse bearing when several safe cells tie.

### QOL-18 — Safe loot can still disappear under a landmark's overhead art — **S**

Pickup beam, glow, spinner, and label all sit in a depth-2 container, while POI images are y-sorted at world-scale depths. The landmark fade reacts only when the local player's body is behind the sprite, not when a pickup, downed ally, or objective is occluded. A safely pushed-out drop can therefore remain behind a tall PNG overhang with no readable beacon. `packages/client/src/scenes/ArenaScene.ts:2263-2312`, `packages/client/src/scenes/arena/floor-renderer.ts:990-1001`, `packages/client/src/scenes/ArenaScene.ts:7345-7368`

**Concrete fix:** keep the pickup halo on the ground, but when its screen point overlaps a POI's opaque overhead bounds, redraw only a small rarity beacon and label in the protected world-response layer. Do the same for downed/rally icons; do not lift the full pickup sprite above actors.

### QOL-19 — A minimap is too much; one rally locator is missing — **M**

The existing edge-arrow implementation already solves bearing and distance cleanly, but its type and update path are hardcoded to extract and rift. A full minimap would add a noisy second pit/POI rendering and still would not create a shared callout. The smallest map fix is a squad-owned destination that reuses the proven locator. `packages/client/src/scenes/ArenaScene.ts:7372-7382`, `packages/client/src/scenes/ArenaScene.ts:7445-7460`

**Concrete fix:** add one 12-second rally ping, snapped to the nearest `navAnchor` when close, with its noun and stable squad color. Show one `rallyArrow` with bearing/distance to living players and automatically retarget it to a downed ally when no manual ping exists. Do **not** build a minimap unless seeded playtests still fail regrouping after anchors, rally, and zone seams ship.

## P2 — useful polish after the navigation contract is sound

### QOL-20 — Wear routes can omit an entire landmark cluster — **S**

Cosmetic routes choose the eight largest global POIs, not one representative per macro cluster. With six clusters and a seed-dependent distribution of the dealt size classes, a court can receive no trail at all while another receives several; the already-subtle 5–5.5% wear then cannot serve as a dependable “follow this back toward home” cue. `packages/client/src/scenes/arena/floor-renderer.ts:545-581`, `packages/client/src/scenes/arena/floor-renderer.ts:1016-1050`

**Concrete fix:** select one reachable anchor POI per cluster first, then spend the two remaining route slots on XL landmarks. Slightly strengthen only the shared spawn/Commons trunk and route intersections, leaving wilderness branches at the current quiet alpha.

### QOL-21 — Sliding into a POI ends as silent velocity deletion — **S**

After compound collision, the server compares authored slide speed with actual displacement and cancels the stance when retained speed drops below entry speed. That is mechanically sensible, but there is no collision-specific presentation seam, so a 544 px/s slide into a solid landmark simply becomes “my move stopped.” `packages/server/src/rooms/GameRoom.ts:3360-3379`, `packages/server/src/rooms/GameRoom.ts:3382-3411`

**Concrete fix:** on the local predictor's clipped-slide edge, play a short scrape/thud, a two-frame contact spark at the exact compound child normal, and a tiny tangential skid. Keep the authoritative cancellation and do not add stun or damage.

### QOL-22 — The permanent cyan “safe” ring stops being safe immediately — **S**

The center clearing and cyan ring are permanent floor art, but the spawn director treats the center like any other player-anchored battlefield once the run starts. The ring can therefore read as a sanctuary or protected reset point when it is only a generation clearance guarantee. `packages/client/src/scenes/arena/floor-renderer.ts:1435-1440`, `packages/client/src/scenes/arena/floor-renderer.ts:1501-1503`, `packages/server/src/rooms/GameRoom.ts:8291-8301`

**Concrete fix:** fade the safety rail over the first 8–10 seconds. Leave a smaller neutral “home/rally” glyph that matches the Commons nav anchor, so the center retains wayfinding value without promising immunity.

## The five changes I would ship first

1. **QOL-01:** arm extract after the boss drop, require a fresh hold, and prevent accidental corpse-position extraction.
2. **QOL-02:** launch accepted jump and slide-hop inputs before horizontal movement and pitfall sampling.
3. **QOL-03:** place extract and rift as a jointly validated pair of reachable, full-footprint safe discs.
4. **QOL-05:** validate the final corrected enemy spawn distance and defer unfair capped/snap-in candidates.
5. **QOL-04:** split gate ground art from its protected halo/label and keep the locator until the full gate is visibly clear.
