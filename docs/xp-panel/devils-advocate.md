# Satisfying XP — Devil's Advocate

## Ruling

Do not bolt homing particles onto today's instant XP. That version is cheap, attractive, and dishonest: the authoritative XP and any level-up have already happened before a post-patch wisp can cross the arena. Also do not serialize one moving gem per kill or vacuum the whole screen by default.

The accepted design is **real, server-authoritative, spatially aggregated XP Echoes**. A kill creates or feeds a bounded field pile. A living player must route within a modest catch radius; the server then latches the pile to one collector, runs a short tick-described flight, and grants its value to the whole squad on the exact tick the painted orb reaches the collector. This is an economy change, not “juice,” and it should be approved and balanced as such.

## What exists today

- XP has no pickup phase. The common death primitive returns the dead enemy's `xpValue`, multiplied for a tough enemy; callers delete the killed rows and call `grantXp` in the same simulation path (`packages/server/src/rooms/GameRoom.ts:3120-3124`, `packages/server/src/rooms/GameRoom.ts:3133-3138`, `packages/server/src/rooms/GameRoom.ts:3176-3178`, `packages/server/src/rooms/GameRoom.ts:2459-2468`). Chain lightning, explosions, Emberguard waves, and friendly projectiles likewise grant their accumulated XP directly after deleting kills (`packages/server/src/rooms/GameRoom.ts:2304-2318`, `packages/server/src/rooms/GameRoom.ts:3252-3268`, `packages/server/src/rooms/GameRoom.ts:3282-3290`, `packages/server/src/rooms/GameRoom.ts:3828-3853`).
- `grantXp` applies the full amount to every player row, with no killer or alive filter; `levelUpPlayer` immediately consumes thresholds, raises levels, allocates stats, opens flex/signature obligations, and refreshes `xpToNext` (`packages/server/src/rooms/GameRoom.ts:2465-2469`, `packages/server/src/rooms/progression.ts:33-53`). That is genuine squad-shared progression, including downed squadmates.
- The wire exposes `level`, `xp`, and `xpToNext` directly on every `PlayerState` (`packages/shared/src/state.ts:43-48`). The HUD reads that authoritative ratio every frame and begins easing the cyan fill toward it immediately; a level wrap snaps the displayed ratio down (`packages/client/src/scenes/ArenaScene.ts:6239-6248`). A cosmetic flight started from the same patch therefore trails the real bar unless the UI deliberately conceals truth.
- `PickupState` is not generic. Its schema is a weapon drop: public/server-only weapon identity, rarity, affix, known state, and coarse weapon class, with no `kind`, `value`, or XP field (`packages/shared/src/state.ts:208-231`). The only authoritative pickup map is `MapSchema<PickupState>` (`packages/shared/src/state.ts:256-264`), and its server interaction finds a nearby weapon, equips/swaps it, then deletes consumed `drop*` rows (`packages/server/src/rooms/GameRoom.ts:850-868`, `packages/server/src/rooms/GameRoom.ts:881-906`). Reusing that row would entangle passive XP with the R/E weapon-grab contract.
- The client can cheaply invent death-origin cosmetics: it retains each enemy rig until an authoritative row disappears, then uses that last rendered position for poof, audio, corpse launch, and kill FX (`packages/client/src/scenes/ArenaScene.ts:2867-2896`, `packages/client/src/scenes/ArenaScene.ts:2912-2945`). But disappearance is not proof of XP: the same branch explicitly covers enemies that left view, pit deaths, and muted bulk removal (`packages/client/src/scenes/ArenaScene.ts:2867-2889`). Client inference is useful presentation input, not an economy event.
- The repository's own Brotato comparison already calls this boundary correctly: Dimension Drifters has squad-shared per-kill XP and no material pickups; adding a pickup magnet only makes sense with a currency/pickup economy change (`docs/BROTATO_PARITY.md:11-17`, `docs/BROTATO_PARITY.md:41-45`).

## Attack the tempting answers

### 1. “Just make confirmed cosmetic motes fly to the bar”

**Steelman.** This needs no schema change, no server scan, no persistence rules, and no balance retune. Enemy-removal positions already exist on the client, and the synced XP delta supplies a confirmed total. Spatially bin the corpses, emit a few painted wisps, and the director gets motion this week.

**Attack.** Confirmation happens at the same patch that already changes XP, stats, `flexPending`, and possibly `level`. Holding only the cyan foreground fill does not undo that: the level badge/modal and new stats still reveal that XP landed. Holding all progression presentation is worse—the server freezes movement/action while `flexPending` or `sigPending` is open, so the screen could pretend the level has not happened while control is already suspended (`packages/server/src/rooms/GameRoom.ts:1622-1623`, `packages/server/src/rooms/GameRoom.ts:1712-1718`, `packages/server/src/rooms/GameRoom.ts:1904-1910`). The game-feel audit identifies visible action with missing or displaced authoritative consequence as a root failure and specifically treats slash/hitbox disagreement as a WYSIWYG defect (`docs/GAMEFEEL_AUDIT.md:9-12`, `docs/GAMEFEEL_AUDIT.md:93-96`). “The mote is only a receipt” is technically defensible and perceptually evasive; a thing flying from a corpse into an XP bar reads as the cause of that fill.

**Verdict: reject as the primary design.** It is an acceptable low-scope fallback only if it is framed as an afterimage: authoritative fill and level-up happen first, the already-lit segment pulses, and the wisp dissolves into it. Never delay or reverse the bar to make the fiction appear causal.

### 2. “Make every XP point a real synced gem”

**Steelman.** This is perfectly legible. The field shows what remains uncollected, player movement determines collection, and the bar changes on contact. It creates the Vampire Survivors route-planning loop with no semantic trick.

**Attack.** Per-point entities multiply the hottest event in a bullet-heaven: every trash death. The current schema warning says full StateView/AOI filtering is not wired and is only considered tolerable at 2–4 players, not the later 10-player load target (`packages/shared/src/state.ts:17-23`). Any new synchronized field also requires a schema-version bump (`packages/shared/src/state.ts:256-260`). Moving each gem through x/y at 20 Hz would pay simulation, serialization, reliable-patch, client-object, and tween costs for economy confetti. The existing painted burst helper itself creates one Phaser image and one tween per particle (`packages/client/src/vfx/particles.ts:37-72`), so “reuse the particle system” does not make per-gem load free.

**Verdict: reject the unit-of-XP entity model.** Truth does not require granular replication; it requires an authoritative value and an authoritative collection epoch.

### 3. “Real gems, but magnetize everything immediately”

**Steelman.** The classic acceleration curve—loose drift, snap, streak, arrival ping—is inherently satisfying. A large vacuum also prevents cleanup chores and stranded rewards.

**Attack.** If every kill instantly latches from anywhere, geography is cosmetic and the system is only delayed instant XP with more machinery. It deletes the choice to step through danger for a pile, makes a magnet-range upgrade meaningless, and turns ranged/kiting play into free progression. Brotato's useful lesson is not merely “things fly”: it bounds the field at 50, merges overflow, bags missed materials, and reserves the all-vacuum release for wave end (`docs/BROTATO_PARITY.md:94-98`, `docs/BROTATO_PARITY.md:107-115`). The tension before the release is part of the payoff.

**Verdict: reject always-on/global magnet.** Use a limited catch radius during combat and a staged cleanup vacuum only when the encounter is actually over.

### 4. “Keep instant XP; this game is not about walking over gems”

**Steelman.** The present rule is simple, co-op-friendly, and killer-agnostic. It never strands progression behind a horde, never makes a ranged teammate steal a melee teammate's drops, and keeps loot-floor attention reserved for weapons. The code and parity document both describe lockstep squad XP as deliberate, not an omission (`packages/server/src/rooms/GameRoom.ts:2465-2469`, `docs/BROTATO_PARITY.md:11-17`). Hades is the useful contrast: rewards feel valuable partly because they are staged into deliberate beats rather than sprayed continuously.

**Attack.** Instant invisible XP wastes kill geography and gives the director no object to accelerate, catch, cluster, or vacuum. The current bar's `0.25` linear ease is polish on a number patch, not a collectible payoff (`packages/client/src/scenes/ArenaScene.ts:6242-6248`). If “XP flies toward you” is a real product direction, preserving instant XP means either violating that direction or accepting a knowingly false metaphor.

**Verdict: reject for this direction.** Keep squad sharing, but move the award from death time to collection-arrival time.

## Accepted design: XP Echoes

### The rule players can understand

1. A paid kill drops XP at the corpse. Several nearby kills become one brighter Echo; value never disappears.
2. An Echo waits on the field until an alive player comes within the catch radius. Walking the route is the risk.
3. Crossing that radius irreversibly catches the Echo for the squad. It whips toward that one collector over roughly 250–450 ms.
4. The orb touching the collector, the server deleting the Echo, the squad XP changing, the bar filling, and any level-up opening are one authoritative tick event.
5. When an encounter truly closes—belt room cleared, boss defeated, or dimension transition committed—remaining Echoes enter a staggered global cleanup vacuum. Normal combat never has global vacuum.

The pickup belongs to the squad but has one physical collector. Every client sees the same orb choose the same body; it does not clone itself and fly to every local player. On arrival, the existing squad-wide `grantXp` behavior remains, so collection helps every roster member (`packages/server/src/rooms/GameRoom.ts:2465-2469`). A downed collector's body already persists in world, so a latched flight can still visibly finish there; only a disconnected/missing collector requires deterministic retargeting (`packages/shared/src/state.ts:31-33`).

### Bounded authoritative representation

Add a separate `XpEchoState`, not fields on `PickupState`:

```ts
XpEchoState {
  id: string
  x: number
  y: number
  value: number
  collectorId: string // empty while resting
  launchTick: uint32
  collectTick: uint32
  seed: uint16
}
```

Add `xpEchoes: MapSchema<XpEchoState>` to `ArenaState` and bump `SCHEMA_VERSION`, as required for any synced-field change (`packages/shared/src/state.ts:256-264`). The row has only two wire phases:

- **Resting:** fixed x/y/value. It changes only when nearby death value merges into it.
- **Latched:** one update writes collector and two ticks. There are no synchronized flight positions. At `collectTick`, the server calls `grantXp(value)` once and deletes the row.

Use the already-synchronized fixed simulation tick as the epoch. It advances every 50 ms and is explicitly intended to map client presentation to the server timeline despite patch-arrival jitter (`packages/shared/src/state.ts:313-317`, `packages/shared/src/constants.ts:18`). This copies the sound idea behind `SwingDescriptor`: one immutable shared clock carries pose, active, and impact times, and the server constructs it only when the action is accepted (`packages/shared/src/melee.ts:609-615`, `packages/shared/src/melee.ts:656-705`, `packages/server/src/rooms/GameRoom.ts:1982-1988`). XP needs a smaller `XpFlightDescriptor` that derives duration, pop fraction, curve sign, and arrival fraction from distance plus `seed`; it does not need a new timestamp every frame.

The collection latch, not a hidden mid-flight collision, is the gameplay decision. Once caught, the award is guaranteed even if the collector keeps moving or is downed. The renderer homes the last part of the curve onto that collector's current rendered body, but predicted time alone may advance only to 90%: final contact is edge-fired by observing the authoritative row deletion/XP patch. On that frame the leader snaps the last few pixels, the receipt ring fires, and the HUD reads the new XP. Network delay can postpone the whole receipt, never separate orb contact from bar fill. If the collector disconnects, the server resets the row to resting or retargets the nearest living player with a fresh epoch; it never deletes unpaid value.

### Aggregation and risk controls

- Start with a **32-Echo global cap**. A paid death first merges into a resting Echo in the same small spatial cell; at cap, it feeds the nearest resting Echo. Overflow changes value, never entity count and never destroys XP.
- Start the catch radius near **120 px**—five current player radii, enough to feel magnetic without collecting across a combat lane (`packages/shared/src/constants.ts:215`). This is a tuning proposal, not a derived constant.
- Latch at most two Echoes per collector per server tick. More nearby Echoes wait or merge, producing a readable train rather than a simultaneous starburst.
- No combat TTL and no passive whole-screen pull. A player who kites at range leaves a visible XP route; entering danger buys progression sooner.
- Cleanup vacuum is a safety valve and climax. It starts only after the encounter stops asking for route decisions, processes capped Echoes in value-descending stagger, and completes before a committed room/dimension teardown.
- Preserve the current squad grant. Do not split value by final blow, distance, or collector; the present loop awards every player row and is explicitly lockstep (`packages/shared/src/state.ts:43-48`, `packages/server/src/rooms/GameRoom.ts:2465-2469`).

### The flight should look expensive without being expensive

Use one fixed visual language so XP cannot be mistaken for hostile elemental bullets:

- **Resting/leader:** one random frame from `arcane-orb`.
- **Flight trail:** zero to two random frames from `arcane-mote`, attached procedurally behind the leader.
- **Level arrival:** keep the existing gold level-up burst/audio triggered by the authoritative level increment; it already fires when `self.level` rises (`packages/client/src/scenes/ArenaScene.ts:5917-5923`). Do not recolor ordinary XP by killing weapon or dimension.

Those are existing painted sheets. The manifest provides `arcane-mote` and `arcane-orb` alongside corresponding mote/orb families for blood, fire, frost, holy, nature, sand, shock, steel, toxic, void, and water (`packages/client/src/vfx/particle-manifest.ts:9-28`, `packages/client/src/vfx/particle-manifest.ts:34-52`, `packages/client/src/vfx/particle-manifest.ts:58-76`, `packages/client/src/vfx/particle-manifest.ts:82-105`). The full manifest is 12 element families × 8 shapes = 96 packs (`packages/client/src/vfx/particle-manifest.ts:9-107`). No new render is needed.

Do not call `particleBurst` for the homing body. That helper is deliberately a fire-and-forget outward scatter: it randomizes angle/speed/life, tweens to a fixed endpoint with `Quad.easeOut`, fades, and destroys each image (`packages/client/src/vfx/particles.ts:37-72`). Build a tiny `XpEchoRenderer` that selects frames from the particle spritesheets already queued during preload and samples an analytic curve (`packages/client/src/vfx/particles.ts:9-13`):

1. **Pop (first 15%):** 12–24 px away from the corpse on the seeded normal; scale from 0.65 to 1.0.
2. **Hook (15–70%):** cubic Bézier toward the collector with one clockwise/counter-clockwise control offset from `seed`.
3. **Snap (70–90%):** strong ease-in, trail length grows, leader scale compresses along velocity; hold just off the body if the collection patch is late.
4. **Receipt (authoritative deletion edge):** snap the final 10%, draw one small procedural ring at the collector, play a pitch-stepped ping, and let the HUD expose the XP from that same patch.

Value changes scale and trail length in three coarse tiers; it never creates one sprite per XP. A 40-XP tough pile is a larger/brighter orb, not 40 objects.

### What not to reuse

The 12 component packs include `lightning-ball` and `storm-call`, but they are combat-scale authored islands and the composer already caps itself at 10 pack plays per render frame (`packages/client/src/vfx/fx-composer.ts:17-30`, `packages/client/src/vfx/fx-composer.ts:183-204`). Spending storm clouds or lightning balls on ordinary XP would compete with the attack that owns those semantics and turn a horde clear into weather.

The eight impact flipbooks are six-frame, 256 px additive body-impact strips for arcane, fire, frost, holy, shock, steel, toxic, and void (`packages/client/src/scenes/arena/vfx.ts:21-35`, `packages/client/src/scenes/arena/vfx.ts:359-424`). They are too large and too impact-coded for every receipt. Keep them on damaged bodies. XP gets the orb, at most two motes, and a procedural arrival ring.

### Mote-soup budget

- Maximum 32 resting leader images globally.
- Maximum 8 full flights on one client; each is one orb plus at most two motes, so the moving layer tops out at 24 images. Additional off-camera/remote flights render leader-only or no trail; their authoritative arrival still happens.
- Prioritize the local collector, then on-camera high-value Echoes. Degrade trail count first, then curve flourish, never arrival timing or value.
- The cap is intentionally in the neighborhood of existing presentation budgets: full hit FX is capped at 10 per frame, damage labels at 24, full ordinary paper deaths at 10, and pickup exits at 8 (`packages/client/src/scenes/ArenaScene.ts:153-157`). XP must join that budget culture rather than assume spare horde capacity.
- Reduced-motion mode shows a short straight glide or resting-orb dissolve plus the same arrival ring at `collectTick`; it does not change server duration or grant early. Existing pickup rendering already uses reduced-motion and visibility/budget fallbacks rather than treating flourish as mandatory state (`packages/client/src/scenes/ArenaScene.ts:1681-1683`, `packages/client/src/scenes/ArenaScene.ts:1911-1925`).

## Implementation seam

1. **Shared:** define `XpEchoState`, append `xpEchoes`, bump schema version, and add a pure `xpFlightDescriptorFor(distance, seed)` sampler. Keep the 96 painted assets untouched.
2. **Server:** move paid-death XP creation into the common `damageEnemy` death branch, which already centralizes dummy exclusion, boss/drop bookkeeping, and XP value (`packages/server/src/rooms/GameRoom.ts:3120-3124`, `packages/server/src/rooms/GameRoom.ts:3133-3178`). Remove the direct `grantXp` accumulators from chain, swept melee, detonation/wave, and projectile paths; grant only when a latched Echo reaches `collectTick` (`packages/server/src/rooms/GameRoom.ts:2304-2318`, `packages/server/src/rooms/GameRoom.ts:2383-2468`, `packages/server/src/rooms/GameRoom.ts:3252-3290`, `packages/server/src/rooms/GameRoom.ts:3828-3853`).
3. **Client:** render authoritative resting rows; derive flight position from the row's ticks and the existing server-tick timeline; finish on row deletion/XP patch. Keep level-up detection authoritative.
4. **Lifecycle:** clear or cleanup-vacuum Echoes explicitly at restart, training toggle, wipe, extraction, and descent. Never let a teardown silently discard live XP.

## Acceptance gates

- A paid kill outside catch range creates/merges an Echo and does **not** change XP.
- Terrain/dummy removal creates no Echo; a tough's Echo contains the tough multiplier.
- Crossing the catch radius writes one collector/epoch; XP remains unchanged until `collectTick`.
- On `collectTick`, the Echo is deleted and its value is granted exactly once to every current player, including a downed one.
- Two players entering on the same tick resolve one collector deterministically; all clients render the same target.
- A missing collector retargets/resets without duplication or loss.
- More than 32 simultaneous paid deaths never creates a 33rd row and never loses summed value.
- Cleanup vacuum cannot open a level window after the room has already destroyed its progression UI/state.
- Four-client horde soak: no per-flight x/y schema churn, no more than eight full client flights, no combat FX starvation, and no XP/bar update before the visible authoritative arrival.

The current regression test only asserts that a kill removes the enemy and advances XP after several ticks (`packages/server/src/rooms/GameRoom.test.ts:499-518`). Replace it with the field → latch → arrival sequence above. If that test cannot be made literal, the design has slipped back into cosmetic receipt theatre.
