# Technical implementer: put the parry beat on the blade

## Verdict

Replace the regular-enemy body blink with a weapon-owned attack performance, but keep an exact, quiet geometry layer. The shipped read should be:

1. the **weapon/striking hand** lights and chambers;
2. a **range-sized white timing circle** announces the incoming beat;
3. once the server commits the strike, the boss-panel **painted-edge underlay** shows the exact sector that will hit;
4. the blade reaches contact on the same patch that applies damage and bumps `atkSeq`.

This is the melee-parry sibling of last night's boss contract: source performance first, optional painted foreshadow second, exact fairness edge always (`docs/telegraph-panel/tech-implementer.md:3-11`). White remains the parry verb, reinforced by a continuous double edge and inward motion rather than hue alone (`docs/telegraph-panel/devils-advocate.md:46-54`, `docs/telegraph-panel/devils-advocate.md:127-132`). No new art is required.

Two corrections are non-negotiable:

- Do not replace the body blink with an animation-only tell. Twenty overlapping rigs can occlude one another; the underlay remains the ruler.
- Do not call the current horde cone “exact.” The authoritative hit is a sector, but the current client draws that sector from a 120 ms-old, pre-lunge rig and reacquires its own target. The server first lunges, then aims and hits from the new origin (`packages/server/src/rooms/GameRoom.ts:3420-3425`, `packages/server/src/rooms/GameRoom.ts:3447-3464`).

## What `EnemyState.windup` carries today

`EnemyState.windup` is one normalized number: `0` means no parryable attack and `0..1` is wind-up progress. It carries no duration, target, attack origin, aim, range, arc, weapon hand, combo index, or resolve tick (`packages/shared/src/state.ts:139-156`). The attack definition supplies first-hit `windup` and follow-up `swingGap`; Ronin uses `0.52 s` and `0.34 s`, while Vault Ronin uses `0.46 s` and `0.30 s` (`packages/shared/src/enemies.ts:388-398`, `packages/shared/src/enemies.ts:437-448`). Derived rusher/swarm/zoner lunges use `0.46 s`, or `0.32 s` for swarms (`packages/shared/src/constants.ts:559-574`, `packages/shared/src/enemies.ts:551-579`). Heavy shifters reach `0.72 s` (`data/dimension-shifters.json:78-87`).

The server runs exact 50 ms substeps at 20 Hz and broadcasts immediately after the stepped batch (`packages/shared/src/constants.ts:15-18`, `packages/server/src/rooms/GameRoom.ts:997-1002`, `packages/server/src/rooms/GameRoom.ts:1640-1660`). In `stepDuelists` it:

1. subtracts `dt` from the combo timer;
2. if the timer crossed zero, lunges and calls `duelistSwing` immediately;
3. changes to the next wind-up or recovery;
4. only then writes `enemy.windup = 1 - st.t / st.wind` when the resulting phase is still `windup`, otherwise `0` (`packages/server/src/rooms/GameRoom.ts:3371-3372`, `packages/server/src/rooms/GameRoom.ts:3420-3442`).

`duelistSwing` bumps `atkSeq` and runs the authoritative sector test in the same call; an un-parried player loses HP there (`packages/server/src/rooms/GameRoom.ts:3466-3491`). Consequently, damage does **not** arrive on a separately observable `windup === 1` patch. Normally the last nonzero patch is 50 ms before damage, then the damage patch contains `windup = 0` plus the changed `atkSeq`. Durations that are exact multiples of 50 ms can expose a floating-point-clamped `1.0` for one patch, but that patch is still normally 50 ms before the hit. `atkSeq`, not a sampled `1.0`, is the unambiguous resolve edge.

### Phase accuracy and the “early blink”

With no skipped/batched patch, the present server samples are:

| Attack beat | First nonzero white sample | Last sample before damage | Current rendered maximum before snap |
|---|---:|---:|---:|
| Ronin first, `D=.52` | `w=.096`, 470 ms early | `w=.962`, 50 ms early | about `.58` |
| Ronin follow-up, `D=.34` | `w=.147`, 290 ms early | `w=.882`, 50 ms early | about `.41` |
| Generic lunge, `D=.46` | `w=.109`, 410 ms early | `w=.978`, 50 ms early | about `.56` |
| Swarm lunge, `D=.32` | `w=.156`, 270 ms early | `w=.937`, 50 ms early | about `.44` |
| Heavy shifter first, `D=.72` | `w=.069`, 670 ms early | `w=.972`, 50 ms early | about `.67` |

The first two columns follow directly from `w = 1 - remaining / D` on a 50 ms grid. The third is the idealized no-jitter result of the current client smoother. `ArenaScene` exponentially lerps upward with `1 - 0.02 ** deltaSeconds`, but snaps immediately on any decrease (`packages/client/src/scenes/ArenaScene.ts:3093-3106`). That formula has a roughly 256 ms time constant and catches only 17.8% of a step in 50 ms. The visual therefore never approaches the authoritative peak before it snaps away.

What playtest calls the body blink is not a rig animation or tint. It is a high-depth white `fillCircle` over the body plus a fixed-size ring that shrinks from 52 px to 22 px, unrelated to the attack's 50-152 px range (`packages/client/src/scenes/ArenaScene.ts:3107-3145`). It begins hundreds of milliseconds early, reaches its last authoritative sample 50 ms early, remains visually far behind that sample, and clears on the damage patch.

The weapon is genuinely late. The server bumps `atkSeq` in the same function that applies damage, and only after that patch does `syncEnemies` call `triggerSwing` (`packages/server/src/rooms/GameRoom.ts:3475-3490`, `packages/client/src/scenes/ArenaScene.ts:2794-2810`). Voltedge has a `0.28 s` cooldown (`packages/shared/src/weapons.ts:849-860`); its client pose lasts `0.28 * 0.64 = 179.2 ms`, with the arc's active cut beginning at normalized `.16` (`packages/shared/src/constants.ts:495-503`, `packages/shared/src/melee.ts:108-120`, `packages/shared/src/melee.ts:659-705`). Thus the visible active cut begins about **29 ms after damage** and its nominal `.52` impact beat is about **93 ms after damage**, before network delivery time is counted. That is the director's reported failure: the body says “hit” while the sword is only beginning a new wind-up.

Remote spatial presentation compounds it. Enemy roots render 120 ms behind the server timeline (`packages/shared/src/constants.ts:141-147`), while the white field is read directly. `ArenaScene` samples the enemy root from the delayed snapshot buffer (`packages/client/src/scenes/ArenaScene.ts:2940-2948`) and then derives a cone aim by independently finding the nearest current player (`packages/client/src/scenes/ArenaScene.ts:3117-3139`). Timing is current; body origin and aim are not.

## Parry semantics that must not change

The server's response window is `PARRY_IFRAMES = .52 s`; a whiff spends a `.60 s` cooldown, an early press can buffer for `.20 s`, and a successful chain refreshes cooldown to `.12 s` (`packages/shared/src/constants.ts:512-537`). `GameRoom` decrements invulnerability before enemy AI, and the strike counts as parried only if `pc.invuln > 0` when the sector test lands (`packages/server/src/rooms/GameRoom.ts:1884-1901`, `packages/server/src/rooms/GameRoom.ts:3481-3486`). Successful parry still owns the existing `parriedSeq` flash, cooldown refresh, launch, heal, and high-chain stagger (`packages/server/src/rooms/GameRoom.ts:3504-3549`).

White therefore means **this attack accepts parry**, not “press on this exact video frame.” For a `.52 s` or shorter wind-up, a press from the first visible claim can cover the hit. For the `.72 s` heavy wind-up, only the final `.52 s` is actually coverable. The new weapon stays recognizably white from Claim, while the fast collapsing circle marks the final impact cadence. The local `parryGfx` ring can remain: it explains the player's predicted ready/i-frame/cooldown state and mirrors the same constants (`packages/client/src/scenes/ArenaScene.ts:5396-5428`).

## What actually hits

| Producer | Authoritative hit | Presentation consequence |
|---|---|---|
| Explicit duelists, leapers, and melee shifters | An **instant player-center sector** of radius `m.range` and half-angle `m.halfArc`, from the enemy's position **after** its resolve lunge. `inMeleeArc` checks distance then dot product (`packages/shared/src/enemies.ts:648-666`, `packages/server/src/rooms/GameRoom.ts:3473-3482`). | A swept-blade trail would be fiction. The exact fairness edge is a sector, but it must be anchored at the committed post-lunge origin, not the current rig. |
| Derived rusher/swarm/zoner lunge | The same one-hit sector, with derived range/arc/damage/step (`packages/shared/src/enemies.ts:551-579`). | Use the same parry tell. The range guide includes the lunge step because the discrete hit can reach beyond the current body. |
| Rusher/swarm/zoner passive touch | Separately, continuous contact damage: a radius test top-down and horizontal/depth lane gate in belt mode (`packages/server/src/rooms/GameRoom.ts:2120-2149`). | Do not imply that parrying the discrete lunge disables the persistent touch/DoT threat. The white footprint describes only the parryable sector. |
| Boss `meleeCombo` | A fixed-origin player-center sector authored once into a white `TelegraphState`; the boss is planted while it winds (`packages/shared/src/boss-primitives.ts:546-575`, `packages/server/src/rooms/BossController.ts:170-205`). | It already has honest geometry. Route its `kindTag=6` through the same weapon-pose/glow language without replacing its row clock. |

Even in belt mode, horde `duelistSwing` still calls the Euclidean `inMeleeArc`; it is not a belt lane. Build its sector in world space and project every vertex through the same affine Y transform, just as the boss renderer now does (`packages/client/src/scenes/ArenaScene.ts:340-396`). If design later changes enemy damage to a swept capsule or belt lane, update the authoritative test first and then the underlay; do not draw the desired future mechanic over today's sector.

## Make the future sector authoritative

The client cannot reconstruct an exact post-lunge sector from today's wire because target choice, lunge cap, aim, and hit all happen at resolve. Make a small server commitment at the Lock beat.

### Wire and state change

Append `ownerId: string` to `TelegraphState` and bump `SCHEMA_VERSION`. Its existing `x/y/a/b/rot`, white `danger`, and `kindTag` already describe the whole sector (`packages/shared/src/state.ts:185-205`). This is preferable to adding four duplicate geometry floats to every `EnemyState`.

Extend the server-private combo entry with:

```ts
strike?: {
  x: number;
  y: number;
  aimX: number;
  aimY: number;
  telegraphId: string;
};
```

At the first server step where normalized `enemy.windup >= .65`:

1. choose the current nearest living target once;
2. run the same capped-lunge calculation as `duelistLunge` to obtain the future attack origin;
3. store that origin and the target-relative aim;
4. create a white `TgShape.Cone` row with `x/y = future origin`, `a = m.range`, `b = m.halfArc`, `rot = atan2(aimY, aimX)`, `kindTag = 6`, and `ownerId = enemy.id`;
5. stop the current `.28 * speed` wind-up creep after Lock so the committed source cannot drift (`packages/server/src/rooms/GameRoom.ts:3365-3369`).

Before Lock, the player sees a deliberately approximate range circle; no supposedly exact sector is shown. At resolve, move the enemy to the stored origin, pass the stored aim into `duelistSwing`, test every player's then-current position against that fixed sector, remove the row, and clear `strike`. A player can still dodge out after Lock; the attack no longer rotates unfairly to chase them.

Do **not** give the melee row its own countdown. `EnemyState.windup` remains the sole horde timing source. In `renderTelegraphs`, rows with `ownerId` read `effectiveT = state.enemies.get(ownerId)?.windup ?? 0`; ordinary boss rows continue to read `row.t`. The horde row is static geometry created once at Lock, so it adds no per-tick geometry or `row.t` churn. Remove it on the resolve patch without pinning it at `t=1`: unlike boss landing-zone payoff, melee resolve is identified by the owner's `atkSeq`, and leaving the sector up one extra patch would advertise danger after damage.

Cancellation rules are equally strict: death, target loss, run reset, forced stagger, or transition out of wind-up removes the row and unwinds the weapon without impact. An `atkSeq` change plus row removal is resolve; row removal without `atkSeq` is cancel.

## Replace exponential smoothing with a 20 Hz phase sampler

Change `enemyWindup: Map<string, number>` into a retained sampler per enemy:

```ts
interface WindupSample {
  serverT: number;
  previousT: number;
  serverTick: number;
  previousTick: number;
  observedAtMs: number;
  ratePerSecond: number;
  lastAtkSeq: number;
}
```

On a positive advancing patch, estimate the normalized slope from authoritative ticks:

```ts
rate = (serverT - previousT) / ((serverTick - previousTick) * TICK_MS / 1000);
shownT = Math.min(0.985, serverT + rate * Math.min(now - observedAtMs, TICK_MS) / 1000);
remainingMs = (1 - shownT) / rate * 1000;
```

This is interpolation/extrapolation across one known 50 ms stair, not a new attack clock. It removes the 256 ms phase lag, catches a late first sample up to its current phase, never replays missed milestones, and never predicts resolve. If a patch is late, hold at `.985`; only `atkSeq`/the authoritative reset may cross contact. On `windup = 0`:

- changed `atkSeq` -> sample contact immediately and enter follow-through;
- unchanged `atkSeq` -> cancel and return to rest within 80 ms, with no impact flash.

Skipped/batched server ticks use the tick delta in the denominator, so the slope remains correct. A new positive wind-up after a resolve starts a new sample epoch rather than smoothing from the previous combo beat.

## `SpriteRig` implementation

Enemy weapons already exist as ordinary Phaser `Image`s inside each rig. `ArenaScene` equips `kind.wieldsWeapon` when it creates the enemy (`packages/client/src/scenes/ArenaScene.ts:2762-2785`), and `SpriteRig.equipWeapon` mounts one image per hand at the authored grip and display length (`packages/client/src/entities/SpriteRig.ts:1007-1051`). The rig already has public `triggerSwing` and `triggerBrace` hooks (`packages/client/src/entities/SpriteRig.ts:1093-1177`) and a rich arc sampler that moves the weapon, hands, torso, and follow-through (`packages/client/src/entities/SpriteRig.ts:2617-2695`).

The required API does **not** exist yet. `weapons` is private (`packages/client/src/entities/SpriteRig.ts:501-510`); `flash()` and `restTint()` affect only `parts`, not weapon images (`packages/client/src/entities/SpriteRig.ts:1203-1223`); and the final weapon pass overwrites position, rotation, and scale every frame (`packages/client/src/entities/SpriteRig.ts:3147-3157`). Therefore, do not tween or tint a private weapon from `ArenaScene`.

Add three public hooks backed by scalar state consumed inside `animate()`:

```ts
setMeleeTell(phase: number, aimWorld: number, remainingMs: number, locked: boolean): void;
resolveMeleeTell(timeMs: number, aimWorld: number): void;
cancelMeleeTell(timeMs: number): void;
```

Implementation details:

- `setMeleeTell` samples the anticipation portion of the existing weapon-family pose. For an arc, stretch the current draw-back branch (`tt < activeStart`) over Claim/Load, hold the authored back angle through Lock, then advance the blade to one epsilon before its target-axis crossing during the final commit. Hands and torso consume the same ownership envelope; feet plant at Lock.
- `resolveMeleeTell` starts at the contact sample and runs only follow-through/recovery. It must not call today's `triggerSwing` at phase zero. Preserve the combo direction/step progression, but seed the pose clock at contact so there is no second wind-up after damage.
- Apply tell scale and tint in the final weapon loop, after its normal `setScale`. Multiply length and thickness by at most `1.06`; never accumulate scale frame over frame.
- During Claim/Load, preserve the painted weapon and use a mild luminance pulse. During the final 150 ms, pulse `TintModes.FILL` white for 30-45 ms beats on the existing weapon image, returning to its normal tint between pulses. Native/post-FX glow may enrich high quality but carries no gameplay information.
- One or two existing `kindTag=6` holy/steel sparks may gather toward the weapon at milestones. The installed foreshadow recipe already points melee to a white additive spark component (`packages/client/src/scenes/arena/vfx.ts:91-97`, `packages/client/src/scenes/arena/vfx.ts:320-346`).
- For enemies with no equipped weapon, drive the same pose and white pulse on the leading hand/striking part. If the rig lacks that part, use a four-ray procedural glint at the attack-side anchor. Never fall back to whitening the full body.

`ArenaScene` calls `setMeleeTell` **before** `rig.animate`, just as boss pose inputs are now resolved before animation (`packages/client/src/scenes/ArenaScene.ts:3056-3088`). Weapon aim comes from the committed owner row after Lock. Before Lock it may face the current nearest target cosmetically, but that cosmetic aim cannot drive the exact edge.

## Range circle and exact footprint

Delete the body `fillCircle` and the fixed 52->22 px ring. Replace the current horde-only `strokeEnemyMeleeCone` path with the boss renderer's shared geometry/cadence functions.

### Approximate range circle: Claim onward

Before the strike is locked, draw a low-mass white range envelope centered on the attacking rig:

- radius `m.range + m.step` for a lunge-capable attack, so it conservatively includes the maximum advance;
- radius `m.range` for a planted source;
- world circle projected to an ellipse in belt view;
- one dark terrain keyline, a thin white rim, and four cardinal weapon-shaped notches; no fill.

This circle is explicitly approximate. Its job is “this weapon can reach about this far after the step,” not “every point inside will be hit.” The exact sector takes over that job at Lock.

At the final 150 ms (three 20 Hz ticks), launch a second bright beat ring from the range rim toward the weapon/hand anchor. It should move in three readable steps—outer, mid, contact—with per-frame interpolation between samples. Leave the four range notches behind, so the player retains the range read while the moving ring communicates time. Under reduced motion, keep the ring fixed and light 4/8, 6/8, then 8/8 notches instead; timing remains encoded by count and line weight rather than motion or color.

### Exact sector: Lock onward

The committed `TelegraphState` uses the existing `buildTelegraphGeometry(TgShape.Cone, x, y, range, halfArc, rot, ...)` path, which constructs in world space and projects every vertex (`packages/client/src/scenes/ArenaScene.ts:340-396`). Draw it through `drawTelegraph` with `danger=0` and melee `kindTag=6`: the current implementation already provides a terrain keyline, continuous white double edge, and inward cadence ticks (`packages/client/src/scenes/ArenaScene.ts:3366-3406`, `packages/client/src/scenes/ArenaScene.ts:3426-3477`). No filled cone is permitted.

This is why the director no longer experiences “all cones are cones.” The dominant pre-hit read is the weapon plus range circle. The thin wedge appears only after commitment because the actual server hit really is a sector; it is now anchored at the post-lunge origin that will actually be tested.

Keep the exact sector on `telegraphGroundGfx`, which already sits above terrain and below actor rigs (`packages/client/src/scenes/ArenaScene.ts:1300-1310`). Keep the compact moving beat/source glint on the high white layer so it survives bodies. Paint is decorative and may cull; the exact edge and range/timing grammar may not. This preserves the boss-panel rule that timing travels on an edge instead of filling threatened area (`docs/telegraph-panel/tech-implementer.md:114-130`).

## Exact beat timeline

The normalized phase describes performance; the final three server ticks describe contact timing.

| Beat | Authoritative condition | Rig/weapon | Circle and footprint |
|---|---|---|---|
| **Claim** | first positive `windup`, roughly `0-.15` | Silhouette changes in the same render frame. Weapon turns to aim, scales to `1.02`, first white edge pulse; no body flash. | Full approximate range rim punches in and settles. No exact wedge yet. |
| **Load** | `.15-.65` | Feet slow, hands draw the weapon visibly backward through the existing arc/chop/thrust anticipation. White identifies parryability; optional particles gather inward. | Range rim stays stable. Four fixed notches preserve distance. |
| **Lock** | first server sample `>=.65` | Server freezes ordinary creep, commits post-lunge origin/aim, and the weapon holds at maximum chamber. | Static exact sector row appears at the future hit origin with double edge/inward ticks. |
| **Armed** | estimated remaining `<= PARRY_IFRAMES * 1000` | Stronger value/scale pulse. This is especially important for wind-ups longer than `.52 s`; it says an immediate parry can now cover impact. | Range notches brighten in value/weight, not a new hue. |
| **Commit 3** | remaining `150..100 ms` | Weapon starts accelerating out of the hold; first 30-45 ms white fill pulse. | Bright beat ring leaves the range rim. |
| **Commit 2** | remaining `100..50 ms` | Blade is visibly inbound, not held still; second short pulse. | Beat ring reaches roughly 60% of its radial travel; inward ticks tighten. |
| **Commit 1** | remaining `50..0 ms` | Blade approaches one epsilon before contact. Sampler may advance only to `.985` while awaiting authority. | Beat ring reaches the weapon/hand anchor and holds just outside it. |
| **Resolve** | `atkSeq` changes and `windup` resets in the damage patch | Snap to contact, then continue only through follow-through. Clear weapon tell tint; successful parry adds the existing spark/recoil/freeze. | Remove exact sector and anticipation circles in that frame. No one-tick ghost. |
| **Cancel** | `windup` resets without `atkSeq` | 80 ms unwind, no contact/recoil. | Remove row/rings, no impact. |

Late observation samples the current row/weapon phase immediately. It does not replay Claim particles or restart a chamber. Hit-stop may hold a rendered frame, but the phase clock remains scene/server based; it must not extend the authoritative danger window.

## Colorblind and reduced-information contract

The tell remains valid in grayscale and without optional assets:

- high luminance on the **weapon/hand**, not a white wash over the character;
- continuous double edge for exact parry geometry;
- inward radial motion for timing;
- count/weight-changing notches for reduced motion;
- a visible chamber -> inbound blade -> contact silhouette;
- stable minimum screen-space line widths from the boss underlay.

White is reserved for parryable attacks. Dodge-only leap landing rows remain warm/broken/outward and must never inherit the weapon's white release pulse. The director's weapon-first cue and the advocate's redundant non-hue grammar are both required; neither is a quality setting.

## Performance with 20 simultaneous melee tells

The mandatory path is comfortably bounded if it stays batched and scalar-driven:

- **Server/network:** the existing `EnemyState.windup` remains the only field changing every tick. Each attack creates one static geometry row at Lock and removes it at resolve; `ownerId` and geometry are creation-only. Do not mirror `windup` into `row.t`.
- **Rigs:** all 20 already own their paper parts and equipped weapon images. Pose, tint, and a final scale multiplier mutate those existing objects. No per-enemy Tween, glow image, timer, or Graphics object.
- **Geometry:** use the single existing `telegraphGroundGfx`. At the renderer's minimum 24 arc samples (`packages/client/src/scenes/ArenaScene.ts:266-274`), 20 range circles plus 20 locked sectors are roughly 1,000 boundary vertices before strokes—small for one Graphics pass. Cache each locked sector by row id/geometry/projection/zoom as the boss renderer already does (`packages/client/src/scenes/ArenaScene.ts:3231-3289`).
- **Paint:** `TelegraphForeshadowPool` already caps persistent painted images at 12 and particles at 18 per frame; missing/capped art leaves the Graphics edge intact (`packages/client/src/scenes/arena/vfx.ts:133-145`, `packages/client/src/scenes/arena/vfx.ts:193-210`, `packages/client/src/scenes/arena/vfx.ts:295-308`). Preserve those caps. Prioritize nearest/on-screen attackers, but never cull weapon pose, range notches, or exact edge.
- **Lifecycle:** reuse map entries and scratch inputs; prune samplers/caches with the enemy, as the current client prunes `enemyWindup` on removal (`packages/client/src/scenes/ArenaScene.ts:2813-2825`). Late/offscreen rows retain phase but emit no catch-up particle burst.

Profile with 20 simultaneous wind-ups for the target and the existing 30-Ronin debug summon as the stress case; the server already exposes and tests the capped debug path (`packages/server/src/rooms/GameRoom.test.ts:2083-2093`). Gates: no per-frame object-count growth, no more than the existing one windup scalar per enemy per tick, and no quality tier may drop exact edges.

## Build order

1. **Lock the timing in tests.** Add a deterministic 20 Hz test that records `windup`, `atkSeq`, and HP each tick for `.52`, `.34`, `.46`, and `.72` beats. Assert that damage and `atkSeq` coincide, the preceding sample is one tick earlier, and parry still negates the same sector. Extend the existing universal-lunge coverage rather than replacing it (`packages/server/src/rooms/GameRoom.test.ts:296-342`).
2. **Make geometry honest server-side.** Add `TelegraphState.ownerId` and schema bump; add the combo `strike` plan; commit at `.65`; suppress post-Lock creep; resolve from stored origin/aim; remove on resolve/cancel/death/reset. Add tests for a player moving out after Lock, another moving into the fixed sector, lunge-origin equality, and row cleanup.
3. **Share the underlay renderer.** Route owner rows through their owner's `windup`, reuse `buildTelegraphGeometry`/`drawTelegraph`, and delete the duplicate `strokeEnemyMeleeCone`. Add top-down and belt boundary captures for `range`, `halfArc`, rotation, and post-lunge origin.
4. **Install the phase sampler.** Replace exponential `enemyWindup` smoothing with tick-derived linear sampling, a one-tick `.985` cap, resolve by `atkSeq`, and cancellation by reset-without-sequence. Unit-test normal, skipped, batched, and late patches.
5. **Make `SpriteRig` perform.** Add `setMeleeTell`/`resolveMeleeTell`/`cancelMeleeTell`; sample the existing weapon-family anticipation; apply tint/scale inside the final weapon pass; add hand fallback. Ensure the resolve call starts at contact, never at a fresh swing phase zero.
6. **Replace the body cue.** Remove the body disc/fixed ring; add approximate max-reach rim, fixed notches, final three-tick collapsing beat, committed exact sector, and owner-row aim. Route boss `kindTag=6` through the same weapon vocabulary without changing its controller clock.
7. **Budget and accessibility pass.** Exercise 20 and 30 simultaneous wind-ups, grayscale, minimum zoom, reduced motion, missing painted textures, 50/120/250 ms delivery, death/cancel, chain stagger, and hit-stop. Decorative sparks degrade first; weapon pose, timing/range grammar, and exact edge never do.

## Release gates

- On a frame 100 ms before an un-parried hit, the weapon is visibly moving toward contact; it is not idle behind a white body disc.
- The contact frame, HP loss/parry result, `atkSeq`, blade contact, circle collapse, and sector removal agree within one rendered frame after the authoritative patch.
- A paused Lock frame's sector matches `inMeleeArc` from the stored post-lunge origin for player-center tests in top-down and belt projection.
- The approximate circle never understates maximum lunge reach; the exact sector never claims the full circle will hit.
- In grayscale with particles disabled, weapon/hand luminance, inward/count cadence, and the continuous double edge still identify “parry this” and its range.
- Twenty simultaneous tells create no per-frame game objects or tweens and retain all exact edges.

The final hierarchy is: **watch the weapon for the beat, read the circle for timing and approximate reach, trust the thin sector for exact safe space.**
