# Systems Scout: Spring-Driven Gameplay

Ranked by fun-per-effort. Contract: sync causes and outcomes; let each client spend private spring state on feel.

### 1. Spring-Loaded Telegraphs

**Mechanic:** Enemy limbs/weapons visibly preload during windup, then snap on the accepted contact edgeâ€”tension becomes a learnable attack language.
**Authority:** Usually zero new wire: drive from `EnemyState.windup/atkSeq`, `TelegraphState.t/rot`, or worm `action*` ticks; add only `tellDir8:uint8` where no authoritative rotation exists.
**Risk:** Wobble can blur the hit pose; keep full authored ownership through contact and provide a rigid reduced-motion fallback.

### 2. Poise Without Bars

**Mechanic:** Hits build poise damage that appears as worsening body/weapon instability; the final break produces a real server-side stagger.
**Authority:** Add `poiseQ:uint8` and `staggerSeq:uint8` to enemies. Existing `CombatReceiptState` supplies hit direction/magnitude; clients map poise to equilibrium/damping, but the server alone trips the threshold.
**Risk:** Physical wobble is an imprecise meter, so bosses need a small icon/color fallback and LOD must not hide imminent breaks.

### 3. Shared Wind and Current Fields

**Mechanic:** Storms, vacuums, rivers, or dimensional shear push actors/projectiles while every loose rig part leans in the same world-space vector.
**Authority:** One `FieldState {id,x,y,radius,fxQ,fyQ,epochTick}` per zone; server movement and self prediction share `sampleField()`, while clients use the vector only as spring excitation.
**Risk:** Any server/predictor sampler mismatch causes reconciliation churn; remote lean must use the field vector, not noisy snapshot acceleration.

### 4. One-to-Many Seismic Pulses

**Mechanic:** A boss shockwave ripples through players, enemies, foliage, signs, and debris in distance order; spring velocity also drives local creak/thump layers.
**Authority:** Reuse one ring `TelegraphState` (`x/y/a/b/t/kindTag`); server damage and client excitation sample the same radius-over-tick equationâ€”no per-prop sync.
**Risk:** Offscreen LOD can miss the wave and crowds can become noisy; wake by event tick, while the ground ring remains the exact danger truth.

### 5. Co-op Conduit Tethers

**Mechanic:** Two players maintain a tension band to charge a shared shield/beam; overextension snaps it, while sweeping the line across enemies can discharge it.
**Authority:** A row needs `aId,bId,restLen,maxLen,tensionQ,stateSeq`; endpoints already sync. Server owns charge, crossing, and break tests; client springs sell the rope and plugs.
**Risk:** Predicted-self plus delayed-remote endpoints misstate stretch; use synced `tensionQ` for gameplay color/audio and render geometry only for feel.

### 6. Three-Number Soft-Body Boss

**Mechanic:** A slime, storm mass, or paper colossus sloshes between broad forms, exposing a vulnerable sector as it compresses and rebounds.
**Authority:** Beyond the existing root, sync `deformMode:uint8`, `strainQ:uint8`, and `deformEpochTick:uint32`; server hitbox presets key off mode, clients expand them into a seeded spring graph.
**Risk:** Individual client nodes cannot be hittable. Use generous preset sectors/telegraphs so divergent cosmetic lobes never lie about collision.

### 7. Resonance Machinery

**Mechanic:** Squads strike pylons at the right phase to pump amplitude, open gates, invert hazards, or overload an enemy shield.
**Authority:** Per pylon, sync only `xQ:int16`, `vQ:int16`, and `driveSeq:uint16`; the server runs an extracted shared exact solver at 20 Hz and adjudicates windows, clients integrate between `ArenaState.tick`s.
**Risk:** Latency punishes narrow zero-crossing timing; use wide phase bands, server grace, and correction blends after each quantized snapshot.

### 8. Tearable Paper Terrain

**Mechanic:** Bridges, curtains, and floor sheets visibly bow under crowds, then tear along predefined seams to open routes or drop enemies.
**Authority:** Generate the seam graph from existing map seeds; sync only `intactMask:uint32` plus `tearSeq:uint16`. Server load-from-positions breaks bits; clients spring the surviving mesh and derive creaks from velocity.
**Risk:** Client spring stress must never choose a tear; visual strain should mirror the server load proxy, and collision changes only when the mask patch lands.
