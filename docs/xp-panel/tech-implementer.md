# Satisfying XP — technical implementation panel

## Decision

Ship **client-cosmetic XP motes over the existing instant authoritative grant** first. A kill should still award the squad in the server tick that accepts the death; every client should then stage painted motes from the enemy's last rendered position into that client's own drifter (`packages/server/src/rooms/GameRoom.ts:2461-2469`; `packages/client/src/scenes/ArenaScene.ts:2867-2895`). This is a zero-protocol presentation layer, not a collectible pretending to own progression.

That is the narrow change which delivers the director's “XP flies toward you” request without silently redesigning co-op progression. The current server already makes XP squad-shared by passing a kill's numeric value into `grantXp()`, which calls `levelUpPlayer()` for every player; there is no killer-owned XP rail to preserve (`packages/server/src/rooms/GameRoom.ts:2461-2469`). `levelUpPlayer()` immediately mutates XP, carries level remainders, opens level-choice state, and updates the next threshold, so delaying that call behind a visual flight would also delay real gameplay state (`packages/server/src/rooms/progression.ts:33-53`).

Do **not** introduce real synced motes in this polish pass. That version is valid only if design explicitly wants positioning, magnet radius, uncollected XP, transition behavior, and collection timing to become rules.

## What exists today

The death primitive subtracts HP, treats dummies as non-deaths, performs boss/loot/drop bookkeeping, pushes the dead enemy id for deletion, and returns the enemy kind's `xpValue` multiplied by the tough multiplier (`packages/server/src/rooms/GameRoom.ts:3120-3181`; `packages/shared/src/constants.ts:374-380`). Its callers delete the accumulated enemy ids and then call `grantXp()` with the numeric total; the swept-melee path shows that ordering directly (`packages/server/src/rooms/GameRoom.ts:2455-2469`). The regression test likewise observes the enemy disappear and the player's XP/level total increase; it does not collect an intervening entity (`packages/server/src/rooms/GameRoom.test.ts:499-518`).

`PickupState` is a weapon/loot schema: position, public/server weapon identity, rarity, affix, known state, and coarse weapon class are its complete fields; it has no pickup kind, XP value, magnet owner, or velocity (`packages/shared/src/state.ts:208-231`). The server's pickup interaction is an explicit `grabWeapon` message which scans for the nearest in-range weapon and swaps/equips it; consumed `drop*` rows are then deleted (`packages/server/src/rooms/GameRoom.ts:850-907`). The fixed tick only ages weapon re-grab grace because pickups are R-key grabs, not walk-over collections (`packages/server/src/rooms/GameRoom.ts:1883-1888`). Reusing this map for XP would therefore couple two incompatible interaction contracts.

The synced progression rail is already sufficient for client confirmation: `PlayerState` carries `level`, `xp`, and `xpToNext`, with a comment that the values are synced for the HUD and squad-shared (`packages/shared/src/state.ts:43-48`). `ArenaState` separately syncs maps of players, enemies, pickups, projectiles, and zones; there is no XP-entity collection (`packages/shared/src/state.ts:256-265`). The repository's own Brotato parity note reaches the same conclusion: DD has per-kill XP rather than material pickups, so a literal pickup magnet would otherwise be an economy change (`docs/BROTATO_PARITY.md:41-45`, `docs/BROTATO_PARITY.md:107-115`).

The client already owns the correct visible death origin. When an enemy id vanishes, `syncEnemies()` reads the still-live rig, removes it from tracking, and emits the death poof/audio from `rig.x, rig.y`; it only destroys the rig after that decision (`packages/client/src/scenes/ArenaScene.ts:2867-2895`). This is better than a stale authoritative coordinate for WYSIWYG presentation because it is the position at which that client actually saw the body die. The same branch already suppresses rift bulk-clear celebrations and separates pit falls, which award no XP server-side (`packages/client/src/scenes/ArenaScene.ts:2881-2895`; `packages/server/src/rooms/GameRoom.ts:2119-2131`; `packages/server/src/rooms/GameRoom.test.ts:731-753`).

There is no authoritative final-blow owner on the client. The current corpse launch and weapon-kill FX explicitly approximate the killer as the nearest living player (`packages/client/src/scenes/ArenaScene.ts:2896-2915`). XP flight must therefore communicate “the squad paid you XP,” which is true, rather than “you made this kill,” which the protocol cannot prove.

## Genre bar, translated for this game

Use the shared readable grammar from Vampire Survivors, Brotato, and Hades rather than copying any one's economy:

1. **Birth:** a bright object visibly separates from the corpse.
2. **Read:** it scatters or hangs for roughly a tenth of a second, long enough to be perceived as a reward.
3. **Turn:** its tangent bends decisively toward the drifter rather than linearly tweening across the floor.
4. **Acceleration:** the last half of the trip is substantially faster than the first.
5. **Receipt:** the drifter, sound, and XP HUD answer on the same frame.

At horde density, legibility comes from phase contrast and synchronized receipt, not from making every unit large. A hundred tiny motes may exist, but only a bounded number of arrival pings should be audible or pulse the HUD.

## Authority choice and tradeoff

| Concern | Cosmetic flight, instant server XP — **ship this** | Real synced motes with server magnet simulation |
|---|---|---|
| Authority | Unchanged: death value is granted to every player immediately (`packages/server/src/rooms/GameRoom.ts:2461-2469`). | XP would be granted only when the server accepts a mote capture; this moves progression timing out of the current death path (`packages/server/src/rooms/GameRoom.ts:3120-3181`). |
| Protocol | None. Read the already-synced player XP and enemy removals (`packages/shared/src/state.ts:43-48`, `packages/shared/src/state.ts:256-265`). | Add a dedicated `XpMoteState` map; any added/reordered/retyped `@type` field requires a schema-version bump (`packages/shared/src/constants.ts:8-13`). |
| Co-op fairness | Every client flies the squad reward to its own local drifter; nobody can steal, strand, or delay XP because the server already advances everyone in lockstep (`packages/server/src/rooms/GameRoom.ts:2465-2469`). | A single shared mote needs deterministic attraction ownership, reassignment on death, and a rule for leaving the dimension. If collection still rewards the squad, location changes everyone's level timing; if it rewards only the collector, it breaks today's squad-shared rule (`packages/shared/src/state.ts:43-48`). |
| HUD timing | The authoritative bar begins its existing ease immediately; arrival adds confirmation, not truth. The current bar lerps upward and snaps on a level reset (`packages/client/src/scenes/ArenaScene.ts:6615-6624`). | Bar fill can be literally arrival-causal, but level windows and auto-allocation also begin later because those are opened inside `levelUpPlayer()` (`packages/server/src/rooms/progression.ts:34-53`). |
| WYSIWYG risk | The mote is an acknowledgement of an accepted reward. Guard it with an observed positive XP delta so ordinary despawns do not masquerade as XP. | The object can be literally collectible, but its visual path must track a 20 Hz authoritative path or predict/reconcile it; the shared tick is 20 Hz (`packages/shared/src/constants.ts:15-18`). |
| 100-mote cost | A fixed client image pool has no network or server cost. | One hundred moving schema rows mean 2,000 entity steps per second before per-client patch encoding, with at least x/y changing on each step; this is avoidable churn for a presentation-only goal (`packages/shared/src/constants.ts:15-18`). |
| Future design space | Does not create magnet-range items or uncollected-XP strategy. | Correct foundation only if the director wants those mechanics badly enough to balance and test them as progression rules. |

The one visible compromise in the recommended route is bar timing: state may advance a few hundred milliseconds before the corresponding mote arrives. Keep that compromise explicit. Do not delay authoritative `level`, `flexPending`, or modal behavior merely to sell a cosmetic; those fields are mutated together by the authoritative level-up function (`packages/server/src/rooms/progression.ts:34-53`).

The project audit treats visible-versus-authoritative displacement as a WYSIWYG failure, not harmless decoration (`docs/GAMEFEEL_AUDIT.md:93-96`). Therefore the mote must remain a clearly secondary receipt: the real bar and level state move when the accepted patch arrives, while the mote's origin, path, and receipt feedback are faithful to what this client saw. If playtest reads it as a collectible that caused the already-completed grant, the cosmetic route has failed its communication test and the team must either shorten/reframe it or approve the real synced design.

## Zero-protocol client design

### 1. Confirm an XP event; do not infer one from removal alone

At the completed-patch callback, compute a monotonic cumulative-XP total for the local player from `(level, xp)` and the shared pure `xpToNextLevel(level)` curve. The client callback is already one completed server tick and currently restricts itself to data capture/reconciliation, making it the right place to record a scalar `pendingXpVisual` delta, not to create game objects (`packages/client/src/scenes/ArenaScene.ts:2531-2543`, `packages/client/src/scenes/ArenaScene.ts:7539-7589`; `packages/shared/src/leveling.ts:11-24`). Initialize the baseline on the first usable patch so joining a run never replays historical XP.

Cache each rendered enemy's expected XP weight when its rig is created: `ENEMY_KINDS[enemy.kind].xpValue`, multiplied by `TOUGH_XP_MULT` when `enemy.tough` is true. Both `kind` and `tough` are already synced on `EnemyState`, and the server uses that same value/multiplier at death (`packages/shared/src/state.ts:138-160`; `packages/server/src/rooms/GameRoom.ts:3176-3181`). This cache is visual metadata, not authority.

When `syncEnemies()` handles vanished rigs, make a mote candidate only when all of these are true:

- `pendingXpVisual > 0` for the accepted patch;
- the existing removal-FX mute is not active;
- the visible origin is not in a pit;
- the cached expected XP weight is positive;
- the local player exists and is not at the level cap.

The mute and pit gates deliberately mirror the current removal presentation (`packages/client/src/scenes/ArenaScene.ts:2881-2895`). Dummies return zero before they can enter the kill list, so they must never seed motes (`packages/server/src/rooms/GameRoom.ts:3133-3137`). Consume at most the pending XP budget across candidate removals, then clear any unmatched residue at the end of that reconciliation and convert it to one HUD-only pulse. Do not let residue attach to a later enemy.

This correlation is intentionally conservative. A combat kill and an unrelated non-pit despawn can theoretically share one patch because `EnemyState` carries no death reason (`packages/shared/src/state.ts:138-160`). The positive-XP budget prevents the common false positives—rift clears, pit falls, phase-outs with no simultaneous XP—but only a real death event or mote schema could remove the final ambiguity; the shifter timeout currently deletes its enemy row without calling the XP path (`packages/server/src/rooms/GameRoom.ts:4285-4295`).

### 2. Make the reward subjective, not falsely attributed

On every client, target `room.sessionId`'s live `SpriteRig`, not the nearest player. The HUD already resolves its subject through `sessionId`, and the server has awarded that subject the same squad XP (`packages/client/src/scenes/ArenaScene.ts:6566-6568`; `packages/server/src/rooms/GameRoom.ts:2465-2469`). Remote clients will see their own copy fly to themselves. That divergence is desirable for a local-only reward layer and has no gameplay consequence.

Spawn only for death origins inside the camera view plus a small margin. The current death treatment already checks `worldView` and destroys off-screen rigs rather than staging full paper deaths (`packages/client/src/scenes/ArenaScene.ts:2917-2954`). Off-screen shared kills should still update the authoritative HUD; they do not need a streak crossing half a 4,800 px arena (`packages/shared/src/constants.ts:155-159`).

### 3. Reuse the painted library, not its burst allocator

The generated manifest exposes the existing 96-pack library as twelve element families by eight shapes, including the mote/orb pair in every family (`packages/client/src/vfx/particle-manifest.ts:9-107`). Use `holy-mote` for ordinary/tough flight and `holy-orb` for the largest value tier. Both packs already exist as ten-frame, 96 px painted sheets (`packages/client/src/vfx/particle-manifest.ts:42-49`). The scene calls a preloader which iterates the complete manifest, and `elementPack()` already establishes steel as the fallback for missing/physical element names (`packages/client/src/scenes/ArenaScene.ts:991-997`; `packages/client/src/vfx/particles.ts:9-13`, `packages/client/src/vfx/particles.ts:77-82`).

Keep XP on those one or two texture keys instead of coloring it by the presumed killing weapon. The protocol cannot prove the killing weapon; the existing removal effect explicitly substitutes the nearest living player's weapon (`packages/client/src/scenes/ArenaScene.ts:2896-2915`). Cycling through all twelve element families would both confuse reward semantics and fragment batching. Select a frame deterministically from the enemy id so a clear has variety without per-spawn asset decisions.

Do not call `particleBurst()` for the flight. That helper creates one Phaser image and one tween—with a completion closure—for every particle (`packages/client/src/vfx/particles.ts:37-74`). Do not call the component composer per mote either: `playFxPack()` creates separate images/tweens for the pack's core, rings, shrapnel, wisps, and ground pieces, even though it bounds full pack starts to ten per frame (`packages/client/src/vfx/fx-composer.ts:183-205`, `packages/client/src/vfx/fx-composer.ts:238-380`). The eight impact flipbooks are additive, body-diameter damage blooms and therefore remain impact language, not collection language (`packages/client/src/scenes/arena/vfx.ts:21-34`, `packages/client/src/scenes/arena/vfx.ts:363-429`). Lightning/storm component packs remain available for weapon or boss spectacle; they should not turn routine XP into an attack tell (`packages/client/src/vfx/fx-composer.ts:17-45`, `packages/client/src/vfx/fx-composer.ts:75-119`).

### 4. One clock, three phases, no tweens

Follow the architecture lesson of `SwingDescriptor`: capture immutable timing once, advance one age, and derive normalized phase with pure math. The shared swing clock stores effective cooldown, pose, active, and impact seconds in one immutable descriptor, then exposes progress helpers rather than letting each consumer invent a timer (`packages/shared/src/melee.ts:609-626`, `packages/shared/src/melee.ts:656-706`, `packages/shared/src/melee.ts:740-761`). XP should use its own client-local `XpFlightDescriptor`; it should not misuse melee's type or enter shared simulation data.

For each pooled mote, capture `seed`, `value`, `frame`, `popMs`, `homeMs`, and `maxMs` once. Update a fixed-slot structure-of-arrays with no vectors, closures, temporary arrays, or Phaser tweens:

```ts
// Semi-implicit, critically-damped homing after the birth-pop phase.
const dx = targetX - x[i];
const dy = targetY - y[i];
const u = clamp01((age[i] - popMs[i]) / homeMs[i]);
const s = u * u * (3 - 2 * u);
const omega = 5 + 15 * s;       // readable bend -> hard finish
const ax = omega * omega * dx - 2 * omega * vx[i];
const ay = omega * omega * dy - 2 * omega * vy[i];
vx[i] += ax * dt;
vy[i] += ay * dt;
// Clamp velocity by squared magnitude only when it exceeds the cap.
x[i] += vx[i] * dt;
y[i] += vy[i] * dt;
```

Before homing, use the seeded outward velocity for an 80–140 ms birth pop and decay it with scalar drag. Start the home phase with nonzero lateral velocity; the spring turns that tangent into the satisfying hook. Capture on squared distance below roughly 20–28 px, or force receipt at `maxMs` so a teleport cannot strand a cosmetic.

Update motes inside the scene's unfrozen visual block, after actor interpolation/animation and before `updateCombatFx()`/`updateHud()`. That block already advances the animation clock, paper deaths, interpolated actors, and rig animation only on unfrozen frames, while HUD/combat feedback follows later in the same frame (`packages/client/src/scenes/ArenaScene.ts:2748-2794`). A kill-stop therefore holds the fresh mote for one weighty beat, then the target coordinate is the newly rendered drifter position.

### 5. Fixed pool and overload behavior

Pre-create **128** `Phaser.GameObjects.Image` instances and keep their dynamic state in typed arrays: `Float32Array` for position/velocity/age/times, `Uint16Array` for value/free slots, and `Uint8Array` for active/frame/tier. A fixed integer free stack makes acquire/release O(1). Set inactive images invisible/disabled; never destroy them during the run.

At capacity, do not allocate the 129th object and do not overwrite a visible one. Fold its XP value into the youngest active mote within the same source cluster; if none exists, add it to the frame's HUD-only receipt. This preserves the accepted numeric reward while making overload reduce decoration rather than correctness.

Use three visual value tiers rather than one image per XP point:

- ordinary: one 0.24–0.30 scale mote;
- tough/special: one 0.34–0.42 scale mote with a brighter arrival;
- boss/very large award: one 0.46–0.56 orb plus at most two motes.

One hundred ordinary deaths can therefore produce one hundred live images, while a 100-XP boss cannot produce another hundred by itself. Keep all flights on the same two texture sheets and one VFX depth band.

For reduced motion, reuse the scene's existing `prefers-reduced-motion` query and emit one straight, 120 ms aggregate mote per accepted patch with no scatter (`packages/client/src/scenes/ArenaScene.ts:198-203`).

## Receipt hooks

Aggregate all captures in a render frame into `arrivedCount` and `arrivedValue`; fire feedback once for the aggregate.

**Audio.** Add an `"xp"` case to `AudioBus.play()`: a short sine/triangle ping whose base pitch rises across a 400–500 ms collection streak, throttled to one audible ping every 35–45 ms. The bus already centralizes event dispatch, supports a normalized `amt`, throttles high-frequency sounds, caps live voices at 24, and safely ignores unknown events (`packages/client/src/audio/AudioBus.ts:19-41`, `packages/client/src/audio/AudioBus.ts:227-249`). Keep the existing four-note `levelup` stinger above this ramp (`packages/client/src/audio/AudioBus.ts:283-293`). Never schedule one oscillator per mote.

**Drifter.** On aggregate receipt, briefly scale/brighten one pooled halo at the local rig's chest. Drive it from the same scalar receipt pulse; do not call `SpriteRig.flash()`, which is already an impact/revive feedback primitive and allocates a delayed completion callback (`packages/client/src/entities/SpriteRig.ts:1429-1441`; `packages/client/src/scenes/ArenaScene.ts:5591-5599`, `packages/client/src/scenes/ArenaScene.ts:6183-6185`).

**HUD.** Add an `xpPulse` scalar set from `arrivedValue`, decay it in `updateHud()`, and use it to thicken/brighten `xpBarFill` for roughly 120 ms. The fill is a four-pixel cyan rectangle whose width is rewritten from `xpShown` each HUD frame, so pulse height/alpha rather than fighting that width assignment (`packages/client/src/scenes/ArenaScene.ts:1503-1508`, `packages/client/src/scenes/ArenaScene.ts:1540-1555`, `packages/client/src/scenes/ArenaScene.ts:6615-6624`). The authoritative ratio should continue to drive width immediately.

**Level edge.** The client already detects `self.level > prevLevel`, spawns the level-up celebration, and plays the level-up sound (`packages/client/src/scenes/ArenaScene.ts:6293-6299`). On that edge, set all live motes to a short `rush` home phase and suppress post-level collection pings after the stinger begins. This prevents stale old-level motes from chiming over the next bar.

If playtest insists that the bar must fill only as motes land, add a separate presentation ledger later and cap its lag at 250 ms. It must flush on a level edge, reconnect, modal open, teleport, rift transition, and level cap. Do not make the schema state or level-window opening wait for that ledger.

## Performance acceptance at 100 motes

The pass is ready only when all of these hold in a forced 100-kill clear:

- live images never exceed 128;
- warm-state spawn/update/receipt performs zero JS object, array, tween, timer, or closure allocation per mote;
- the update loop scans a fixed 128 slots and performs squared-distance capture checks, with square root only for an over-speed clamp;
- XP uses at most two particle texture keys and does not invoke component packs or impact flipbooks per mote;
- capture audio is throttled and never challenges the bus's 24-voice cap (`packages/client/src/audio/AudioBus.ts:34-41`, `packages/client/src/audio/AudioBus.ts:160-167`);
- rift clears, pit falls, dummy resets, shifter phase-outs without XP, first join, and post-cap kills produce no world motes; current rift transitions clear the enemy map, shifter timeout deletes without a grant, and `levelUpPlayer()` rejects grants at cap (`packages/server/src/rooms/GameRoom.ts:4414-4420`, `packages/server/src/rooms/GameRoom.ts:4285-4295`, `packages/server/src/rooms/progression.ts:33-35`);
- scene shutdown hides/destroys the 128 pooled images once and resets XP baselines, caches, free-stack state, streak audio, and HUD pulse.

Instrumentation targets: p95 `XpMotePool.update(100)` under **0.25 ms on the desktop baseline**, no retained growth after 10,000 acquire/release cycles, and no more than one audio dispatch per throttle window. These are acceptance targets, not assumptions about current performance.

## If real synced motes are approved later

Implement them as a new `XpMoteState`, never as overloaded `PickupState`. Minimum authoritative fields are id, x/y, value, and target/phase data; add a dedicated map to `ArenaState` and bump `SCHEMA_VERSION` because Colyseus field order is wire-significant (`packages/shared/src/state.ts:208-231`, `packages/shared/src/state.ts:256-265`; `packages/shared/src/constants.ts:8-13`).

The server must then:

1. spawn mote value at the exact enemy death position instead of granting it in the death tick;
2. choose the nearest living player deterministically, with stable session-id tie-breaks;
3. reassign when the target dies/leaves and define whether downed players attract;
4. simulate homing/capture at 20 Hz and grant the value to the whole squad on accepted capture;
5. define what rift descent, extraction, wipe, disconnect, and level cap do to uncollected value;
6. cap/merge server motes so a hundred-kill clear cannot grow without bound;
7. let clients interpolate/predict the same path and reconcile capture without a visible snap.

That route gives literal arrival-causal HUD fill and room for magnet-radius upgrades. It also makes “who walks near the pile” influence when the entire squad levels, while the current system levels everyone immediately and identically (`packages/server/src/rooms/GameRoom.ts:2465-2469`). Treat that as a signed design change with balance, protocol, reconnect, and co-op tests—not as the next VFX task.

## Build order

1. **Pool and math:** add a client-local `XpMotePool` with the 128-image/typed-array pool, immutable flight descriptor, fixed-step update, overload merge, reduced-motion mode, and shutdown reset. Test phase boundaries, capture, forced timeout, moving targets, and 10,000-cycle reuse before scene integration.
2. **Accepted-delta ledger:** in `onPatch()`, establish/reconstruct cumulative local XP and stage only positive deltas. Test first join, one kill, multiple kills in one patch, multi-level carry, level cap, and reconnect.
3. **Death-origin bridge:** cache visual XP weights on enemy creation and consume the patch budget inside the existing removal branch. Test ordinary/tough/boss values plus pit, rift clear, respawn clear, phase-out, dummy, off-screen, and mixed-removal patches.
4. **Scene clock/lifecycle:** construct the pool after preload/create, update it after actor animation in the unfrozen block, and reset it on shutdown/restart. Verify belt projection, camera movement, teleport, spectate/downed state, and two independent co-op cameras.
5. **Receipt:** add batched `"xp"` audio, drifter halo, HUD pulse, and level-edge rush/suppression. Keep existing authoritative bar width and level-up stinger.
6. **Density gate:** run 1/25/50/100/150 requested motes, confirm the 128 cap and merge behavior, profile p50/p95 update time, inspect texture batches, and verify zero warm-state per-mote allocations.
7. **Director tune:** expose only `popMs`, spring start/end omega, max speed, capture radius, tier scale, audio throttle, and HUD pulse strength. Lock those after testing at ordinary play speed, 100-mote clear density, reduced motion, and online latency.

The first shippable slice is steps 1–6 with no server/shared edits and no network message. Step 7 is feel tuning. The real-synced branch starts only after a separate economy/progression decision.
