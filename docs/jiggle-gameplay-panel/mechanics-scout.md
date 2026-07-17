# Spring-Driven Gameplay Menu

Ranked by fun-per-effort. Any damage, collision, or control effect needs a small server-authoritative copy of the scalar spring state; the current client rig can remain its renderer.

## 1. Momentum Flails
**Mechanic:** Flail, censer, and chain-blade hitboxes follow the spring endpoint; head speed sets damage, while a fully stretched release earns a crit or wider sweep.
**Cheap:** Uses existing 2D deflection/velocity, movement and turn impulses, elliptical reach cap, and bounded terminal-velocity handoff after an authored windup.
**Risk:** A physically trailing hitbox can feel inaccurate unless aim assist and generous swept collision preserve bullet-heaven readability.

## 2. Launch Pads You Can Load
**Mechanic:** Players and enemies compress pads by landing or standing on them; releasing at peak load launches harder, enabling traversal, crowd juggling, and co-op combo routes.
**Cheap:** Reuses landing impulses, the critically damped planted mode, displacement ceilings, and an ownership handoff from held compression to free recoil.
**Risk:** Forced launches can become frustrating near pits or let players bypass encounter boundaries.

## 3. Dangling Boss Weak Points
**Mechanic:** Armored bosses expose lanterns, hearts, or tail bulbs only while they swing outside the body; hits kick them farther, letting teammates sustain an opening.
**Cheap:** A weak point is a moving-equilibrium part with hit impulses, size-scaled frequency, elliptical limits, and the existing exact settle under boss turns.
**Risk:** Melee builds may lose access when the target swings away, so every weak point needs a close-range interaction route.

## 4. Grapple, Tension, Release
**Mechanic:** Hook terrain or a heavy enemy, pull until the tether enters its tension band, then release to slingshot—or hold to drag light enemies into the squad's kill zone.
**Cheap:** Moving anchor/equilibrium, capped deflection, spring velocity, and terminal handoff already describe stretch, pull, snapback, and release without a rope solver.
**Risk:** Collision correction and latency can make high-speed releases diverge unless the server owns the endpoint and launch impulse.

## 5. Stagger Is Stored Spring Energy
**Mechanic:** Heavy hits inject directional body spring energy; attacks are disrupted above a threshold, and moving with the recoil settles stagger faster than fighting it.
**Cheap:** Existing bounded impulses plus exact damping provide a continuous poise meter, direction, recovery curve, and stable stepping through hit-stop-sized frames.
**Risk:** Coupling visible flop to input lock can feel mushy; thresholds need hysteresis and very short maximum lockouts.

## 6. Disruptible Charge Wobble
**Mechanic:** Elites pump a dangling focus during charge-up; striking near maximum deflection overloads and cancels the cast, while a miss lets it snap through and fire.
**Cheap:** Driven equilibrium and injected hit impulses create the tell; displacement/velocity thresholds and exact zero-crossings supply deterministic success and release beats.
**Risk:** Crowds and network delay can obscure the timing window, so audio and a forgiving server-side grace interval are essential.

## 7. Cut-and-Snap Traps
**Mechanic:** Rooms contain tensioned cables holding blades, boulders, nets, or gates; cut the right anchor to transfer stored motion into a trap that affects both factions.
**Cheap:** Authored ownership stores the pose, bounded terminal-velocity handoff creates the snap, and LOD rebasing already prevents sleeping offscreen rigs from exploding.
**Risk:** Friendly fire and unclear cable-to-payload relationships could turn tactical setups into visual noise.

## 8. Tension Harvesting
**Mechanic:** Fishing, crystal pulling, and monster-part harvesting ask players to keep spring tension inside a moving safe band, easing off before the line snaps or loot escapes.
**Cheap:** Deflection is tension, velocity predicts a snap, damping defines resource temperament, and hard caps provide natural break/fail thresholds.
**Risk:** A sustained finesse minigame may fight the run's pace unless it lasts only a few seconds or teammates can defend the harvester.
