# Night summary — 2026-07-25 (feel-fix marathon: warps, vibration, head-snap + doctrine panels)

All merged to `feat/v0.118-metagame`, pushed, green: **216 test files / 2,775 tests**.

## The movement-feel arc (your evening playtest reports, fully closed)
1. **"Violent rubberbanding / warping"** → 3-Sol diagnosis team produced a 41-scenario telemetry
   map + server/client audits. Root causes: teleport-style placements (elevator boarding = 3,570px
   snap, Dimension Door, pit snap-backs, restarts) registered their motion epoch AFTER moving you;
   impulse windows one tick short for capped knockback composites; 8 client mismatches incl. a
   real epoch round-trip race. **B51** fixed all of it: 11 placement sites converted to
   epoch-first, windows derived from decay math, client mirrors. Before/after: 114 corrections /
   6,102px / 6 snaps → **0 / 0 / 0**.
2. **"ADADAD flip warping" + "vibraty movement"** → both added as permanent harness scenarios
   with a zero-band standard (not even silent corrections allowed). Both **clean** post-B51.
3. **"Head snaps back twice a second while walking"** → **B52** probe proved it (per-frame part
   traces), bisected to B51's own rendered-root derivative feeding the rig gait clock, fixed by
   driving self rigs from the predictor's fixed-tick locomotion vector. 9/9 smoothness sweep,
   zero part snaps. The probe is now a permanent regression gate.

## Note batches (all 26 evening notes + 2 recovered double-misses)
- **B48 gun holds** — 8 orders: hallowbore fan-hammer, boomstick lever, dustline lever-hand,
  gravedog real bullets w/ tracer look, arbalest/whisperbarb/powderkeg/thunderhead holds.
- **B49 melee/thrown** — 13 orders: Hailshard 360 ice-swing RESTORED (B30 over-cut), Spade
  per-revolution damage numbers + halved spin, **Doubleheader continuous Garen spin** (your
  twice-missed note — my sweep line-range bug, now timestamp-driven), axes get 2-hand overhead
  throws, void-star helix pairs, Frostknuckle second glove + snowflake shots, Cinderpalm dual
  fist-fire, Emberfist resize/reach, broadsword flip slowed, hollowmoon combo, frostfang hands.
- **B50 caster VFX** — purple orrery beam, Emberleaf opens while charging (centered fireball),
  Verdigris clean page-cone, Cinderquill archived.

## Doctrine panels (your "best formula" ask) — read these two
- [`panel-anim-doctrine.md`](panel-anim-doctrine.md) — how Brotato/Hades/Dead Cells-class games
  compose procedural rigs over fixed-tick sims; 8 ranked gaps in our stack.
- [`panel-netfeel-doctrine.md`](panel-netfeel-doctrine.md) — how co-op games hide a 20Hz sim at
  60fps; 8 ranked gaps.
- **Converging top recommendation:** one coherent per-render-frame PresentedActorState — root,
  velocity, aim, stance, and all six rig parts driven from a single monotonic render-rate clock,
  replacing tick-phase-dependent self stepping. This would structurally end the entire
  jitter/snap bug class we spent tonight fixing case-by-case. Recommended as the next big batch
  (one Sol, well-scoped by both reports) when you're ready.

## Also earlier today (same branch)
B27 pre-made duals, B28 weapon orders, B29 ranged presentation, B30/B31 recovered window,
B32 Frostbore break-action, B33 commit-melee, B34 corporate tower (LDtk pipeline + endless
elevator loop), B35-B41 corrections, B42 relaxed authority, B43 monolith split, B45 gun recoil,
B46/B47 Pose Studio with full transform gizmos.

Computer shut down after this summary, per your instruction. The dev stack will need
`pnpm dev` (+ the weaponsmith server for the Pose Studio — chip pending to auto-start it).
