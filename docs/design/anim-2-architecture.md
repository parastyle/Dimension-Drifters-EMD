# Animation continuity architecture (`anim-2-architecture`)

## 1 a.m. summary

The rig teleports because most of its 544 “blend” lines blend **freshly computed targets inside one frame**; they do not blend from what was actually visible last frame. The same Phaser objects are used as scratch space and rendered output while rest, attack, flourish, constraints, movement, and recoil write them in sequence, so a changed owner becomes an immediate target replacement and the last writer wins. One narrow combo-step bridge already proves the right idea—latch the rendered pose once, keep the accepted combo clock running, and blend to its live target—but it misses first attack/flourish/movement entry, root and shadow, and its generic deadline overlaps authoritative hit windows on 36 of 51 measured steps. Do not rewrite 10,713 lines: add one allocation-free target/resolution/commit seam, make channel ownership and authority deadlines explicit there, migrate the existing bridge into it, then move the highest-conflict writers into contributions incrementally. The combos, choreography, beats, server clock, and hit windows stay unchanged.

## Mandate and working constraints

This report diagnoses why `SpriteRig.ts` can still visibly teleport despite extensive interpolation vocabulary, then proposes the smallest architecture that makes visual continuity systematic. The investigation will distinguish direct transform assignment, restarted or re-sampled blends, authored-pose versus rendered-pose handoff at combo boundaries, and last-writer-wins conflicts among attack, rest, flourish, movement, recoil, and dual-wield systems. The recommendation must preserve every existing combo pose, beat, server-accepted timing, and hit window: only how the rendered body travels between already-authored poses is in scope. This is diagnosis and options work only; no product code, tests, assets, catalogs, generated files, or live services will be changed.

## Investigation log

- **Recorded before code investigation:** the owner requires an incremental path suitable for a 10,713-line rig and cannot afford a rewrite. Claims below will be labeled as measured or inferred and tied to code locations.
- **Verified:** the checkout is on `feat/v0.118-metagame`. The reporting README requires a durable report written and updated throughout the run; this work order explicitly sets the report-of-record location to `docs/design/anim-2-architecture.md`, which this investigation follows. No repository `AGENTS.md` adds further instructions.
- **Workspace safety:** the other untracked `docs/design/anim-{1,3,4}-*.md` files belong to the other panel arms and will not be touched.

## Verified measurements (first pass)

- `packages/client/src/entities/SpriteRig.ts` is **10,713 lines**. A case-insensitive `lerp|blend|interpolate|ease|tween|smooth` scan matches **544 distinct lines** and 619 total tokens. This verifies the stated 544 figure as matching lines, not calls.
- `packages/shared/src/melee.ts` is **2,141 lines** and contains the combo step timing/path/choreography contract (`melee.ts:177-202`); `packages/client/src/sprites/pose-language.ts` is **2,381 lines** and is selected/sampled separately by the rig (`SpriteRig.ts:3121-3179`).
- A syntactic census in that file finds 31 `.x =`, 32 `.y =`, 26 `.rotation =`, 4 `.angle =`, 28 `.setRotation(...)`, 42 `.setPosition(...)`, 42 `.setScale(...)`, 16 `.scaleX =`, and 15 `.scaleY =` occurrences. These are not all defects: the counts include pure sampler outputs, initialization, death animation, labels/VFX, and deliberate final render commits. The attack-path subset is classified below rather than equating assignment with a visible snap.
- The frame is rebuilt imperatively: `animate()` resets torso/root and attack channels (`SpriteRig.ts:8235-8265`, `8325-8368`), then attack, pose-language, flourish, hand, foot, weapon, movement-kit, art-offset, and transition passes mutate the same Phaser nodes through `SpriteRig.ts:10541`. Therefore many direct writes are target calculation/final commits, but there is no general contract that a newly selected target begins at the previously rendered pose.
- A direct parse of the retained katana after-capture JSON currently finds 14 captures, **2,031** frame records, 62 covered steps, 146 accepted sequence increments, and zero `rigAttackSeq !== attackSeq` frames (`docs/owner-notes-audit-v7-evidence/katana-movesets/after/catalog-live-capture.json`). The prose report at `docs/sol-reports/v7-katana-bespoke.md:137` says 1,845 frames and 140 beats; those counts do not match the checked-in JSON, so I do not repeat them as measured facts. The invariant that matters here—zero sequence divergence—is independently present in every retained frame.

## Early seam finding: a narrow bridge already exists, but its coverage is the bug

**Measured:** `beginComboStageTransition()` snapshots the already-rendered `this.parts` and weapon transforms once (`SpriteRig.ts:4036-4059`); `applyComboStageTransition()` is a late writer that blends that latched snapshot toward the newly computed frame (`SpriteRig.ts:4062-4095`, called at `10538-10542`). This specific bridge does **not** restart every animation frame and its `from` pose is correctly latched. It begins only when `triggerSwing()` decides an existing chain advanced to a different step (`SpriteRig.ts:4991-5022`, `5088-5090`). Its duration is bounded to 80% of the generic descriptor anticipation and capped (`SpriteRig.ts:705-712`); the later catalog measurement shows why that generic clock is not always the authoritative combo-step deadline.

**Measured:** that bridge explicitly excludes the root (`SpriteRig.ts:715-722`, `4057-4058`). Commit `c072111` then added per-katana choreography that mutates body, feet, weapon, shadow, and also `this.root.rotation` (`SpriteRig.ts:8661-8715`, especially `8694`). Body/hands/feet/weapons are subsequently covered by `this.parts`/weapon capture; root rotation is not. At the accepted frame where `setSwing()` changes the step, `animate()` samples the new step at `tt = 0`, assigns its new `paperRotation`, and the late bridge cannot restore the prior rendered root rotation. **Inference, grounded in the write order:** any unequal `paperRotation` at step N's rendered end versus step N+1's start is a one-frame whole-rig snap even while every child transform is cross-faded.

The bridge predates the katana commit: blame assigns it to `45e7bb20` (2026-07-20), whereas bespoke choreography arrived in `c072111` (2026-07-22). The katana change did not create the general last-writer/coverage structure, but it added a large, owner-visible channel at exactly the seam the existing bridge declares out of scope. The measured conclusion below is “longstanding architecture, newly exposed/worsened by larger choreography,” not “the katana sampler itself is discontinuous.”

## Assignment census and attack-path classification

The transform-write scan contains **232** direct local transform assignments/setter calls when `.angle` (four attachment-only writes) is excluded. The census is:

| Region | Direct writes | Classification |
|---|---:|---|
| Pure helpers, `SpriteRig.ts:647-1411` | 15 | Sampler outputs/spring state. Five writes at `738-742` are the existing cross-fade math, so syntax alone does not make them teleports. |
| Construction/mount, `2327-2710` | 21 | Initial texture/socket placement, outside combat transitions. |
| World/lifecycle/death, `3067-3992` | 60 | Includes the authoritative/world `root.setPosition` seam at `3066-3068`, stow snapshot copies, spawn setup, and deliberately discontinuous death theatre. World `x/y` must stay outside a pose smoother. |
| Combo cleanup, `4146-4153` | 5 | `releaseAttackVisuals()` immediately re-seats weapons and resets shadow transform; it is called by `resetSwingCombo()` (`4013-4033`) on swaps, down/death, and unequip. This is an attack-lifetime boundary, not an approach. |
| Miscellaneous runtime/VFX, `4335-5493` | 27 | Tell/source/page visuals and output scratch; not core body ownership. |
| Late movement/enemy/boss/followers, `7299-7951` | 36 | Includes late weapon re-seating, enemy combo overrides, and boss foot placement. These execute after ordinary weapon/body authorship. |
| Main pose pipeline, `8235-10475` | **52** | The relevant concentration: root/body reset, combo release assignments, final hand/foot commits, ranged grip replacement, two-hand constraint replacement, and orbit/signature/ordinary weapon placement. |
| VFX tail, `10573-10707` | 16 | Pair/aura/shadow visuals. The shadow's final transform is committed at `10689-10711`, after the current combo bridge. |

The attack/combo-path direct sets are not isolated accidents. The frame starts by assigning a fresh root/body base (`8235-8265`), later assigns the final hands (`10020-10021`), may replace ranged hand positions exactly (`10024-10043`), replaces the two-hand rear grip (`10046-10105`), assigns feet (`10225-10229`), and chooses one of several exact weapon placement branches (`10234-10486`). These are correct as **target construction**, but today those same Phaser node fields are also the rendered output. A target discontinuity therefore becomes a screen discontinuity unless a bespoke late bridge happens to cover it.

## Blend lifecycle: the important blends are mostly spatial, not temporal

**Measured:** the combo-stage bridge latches its `from` once and does not restart per frame. Ranged aim also latches its raise epoch unless the previous settle has ended (`SpriteRig.ts:3260-3265`), and flourish channels retain `startMs` (`3381-3407`, sampled at `3584-3605`). I did not find evidence that the combo cross-fade itself is reinitialized each `animate()` call.

**Measured structural problem:** most other uses of “blend” interpolate two values freshly recomputed in the *same* frame. For example, hand `hx/hy` starts from current-frame rest/movement (`9847-9856`), is spatially mixed toward pose/ranged/grip targets (`9870-9907`, `9949-9965`), then assigned to the image (`10020-10021`). Feet follow the same pattern (`10128-10181`, commit at `10225-10229`). The torso is reset to movement base (`8258-8265`) before action additives. None uses the last rendered transform as its `from`. If an owner flag or target changes between frames, these hundreds of blends offer no temporal continuity at all.

There is one explicit restart-like edge outside the combo bridge: toggling reduced-motion while a flourish is active writes each active channel's `startMs = sceneNow` (`SpriteRig.ts:8015-8023`). That intentionally restarts its phase rather than latching the currently rendered flourish pose. It is not the reported ordinary combo path, but it demonstrates that continuity is managed locally and can regress independently.

## Authority over presentation at transition frames

- **Continued combo step N -> N+1:** good for covered child nodes. `triggerSwing()` recognizes a continuing chain and changed step (`4991-5022`), snapshots the **actual already-rendered** parts/weapons before replacing `swingStart`/descriptor (`5088-5091`), and resolves the new step on its unchanged accepted clock. At elapsed zero, the late bridge returns the captured pose exactly (`4036-4095`). This is the right handoff model.
- **Rest/flourish -> first combo step:** not covered. A new chain has `continues === false`, so `comboStageAdvances` stays false (`4991-5022`) and no snapshot begins at `5088`. `triggerSwing()` also cancels a live flourish immediately (`4861-4869`; `cancelFlourish()` clears active channels at `3317-3333`). The next `animate()` constructs the first authored pose from `tt = 0`, not from the body actually visible before the accepted attack. For legacy arc choreography, the authored `tt=0` branch sets a prior guard and torso lean (`9253-9267`) rather than the rest pose. For the new katana choreography, `tt=0` sets weapon angle to aim (`8661-8681`) while rest is aim minus `PI/15` (`235-240`, `8552-8554`): a measurable 0.209 rad / 12 degree first-frame weapon cut. Some primitives also replace two-hand spacing at `tt=0` (sampler defaults and primitive writes in `packages/shared/src/melee.ts:233-258`, `294-485`).
- **Combo timeout -> rest:** substantially better. Expiry clears live chain state but retains `comboHoldPose` (`SpriteRig.ts:8105-8110`, `4198-4219`); the held end pose fades all combo additives to rest over 120 ms (`8568-8598`, `9341-9375`). This seam should be preserved, not redesigned by changing combo data.
- **Swap/down/death/non-combo reset:** `resetSwingCombo()` immediately calls `releaseAttackVisuals()` and clears hold/transition (`4013-4033`, `4098-4219`). Weapon swap retains an outgoing weapon proxy, but body/hand ownership is still rebuilt rather than latched (`3417-3486`, `4667-4718`). These are visible interrupt seams not covered by combo-step continuity.
- **Remote accepted beat:** the descriptor remains correctly keyed to the reconstructed authoritative epoch (`ArenaScene.ts:3403-3410`, `3413-3459`, `3629-3660`; `SpriteRig.ts:4859-4874`). A remote packet can therefore arrive with the presentation epoch already in the past; the current bridge measures elapsed from that epoch (`SpriteRig.ts:4064-4068`) and may partly or fully consume its <=80 ms visual bridge on the first rendered frame. Delaying the accepted clock to “make the blend visible” would be the wrong fix because it would desynchronize presentation from hit authority.

## The current bridge has an authority deadline bug; do not merely widen it

I ran a throwaway, source-importing Vitest probe over the current catalog and removed the probe afterward. **Measured:** 51 combo steps belong to weapons whose combo timing drives the server's authoritative hit envelope. On **36/51** of those steps, the current bridge duration remains nonzero after the server-authored active window has started; at the worst case (`x2-marrowpike-ranseur`, step 1), **74.145% of the prior pose remains at active start**. The smallest authoritative anticipation among those steps is only 6.144 ms. The cause is direct in code:

- the server replaces generic descriptor timing with `comboStep.timing.activeStart/activeEnd` for authoritative-envelope weapons (`packages/server/src/rooms/GameRoom.ts:7310-7315`, `7377-7387`, `7418-7445`);
- the client enriches a descriptor with `comboTiming` but intentionally leaves its generic `activeStartSeconds` unchanged (`packages/shared/src/melee.ts:1988-2015`);
- `beginComboStageTransition()` sizes the bridge from that unchanged generic field (`SpriteRig.ts:4038-4040`).

This does not change server damage, but it can make a rendered blade/hand still show the old step while the new step is already dangerous. Therefore “call the current bridge on more paths” is not safe by itself. Any generalized resolver needs a per-channel deadline: damage-bearing weapon, its grip, and any parent transform affecting its world affine must equal the accepted step by the **earliest authoritative active start**, using `comboTiming.activeStart * poseSeconds` when applicable. Purely cosmetic body/foot squash can keep a longer visual release only if it does not move that damaging affine.

## Who owns the pose each frame?

There is no single arbiter. There are several good *local* ownership rules, followed by writers that sit outside them:

- The primary action branch is mutually exclusive: enemy melee tell, ranged stance, or ordinary melee (`SpriteRig.ts:8380-8550`).
- Procedural jiggle has an explicit ownership envelope and even preserves velocity when authored control hands back (`SpriteRig.ts:848-860`, `1546-1633`). This is a useful small-scale model for the proposed system.
- Pose-language is suppressed for close-blade/crossfall/melee-tell cases (`9514-9554`), and flourish uses a “stronger owner” predicate and cancellation (`9578-9607`).

But the complete frame then continues. Root/body are already written by movement, recoil, brace, and attack; pose-language and flourish add again; final hands/feet are assigned; two-hand/ranged/orbit constraints replace those results; ultimate, jump/tumble, enemy-combo, and boss passes mutate the same nodes later (`SpriteRig.ts:9468-9781`, `9831-10118`, `10232-10490`). `applyJumpFeelPose()` explicitly runs after weapon placement and then re-seats weapons (`7184-7300`, call at `10488`), while `applyEnemyComboPresentationPose()` writes the same body/hands/weapons next (`7302-7398`, call at `10489`). The combo bridge then overwrites all captured child transforms, and the shadow is assigned later still (`10538-10555`, `10680-10711`). That is ordered mutation, not resolved ownership.

One exact interrupt illustrates the consequence. On a new slide/tumble, `animate()` records the stance edge (`8060-8069`); the late movement pass consumes the discrete `slideTick` (or a tick-based fallback) directly (`7185-7194`). With an eight-tick, 0.4 s roll (`packages/shared/src/constants.ts:561-563`), the first nonzero tick is progress 1/8, and `rollTumbleRotation()` returns `2*PI*progress` (`packages/client/src/vfx/jump-effects.ts:12-23`): **45 degrees is added to root rotation on that first nonzero rendered tick** (`SpriteRig.ts:7214-7223`). No prior rendered root pose is latched, and the combo bridge does not cover root. This is a teleport by construction when tumble interrupts a swing/flourish.

## Was `c072111` the cause?

**Verdict: it exposed and amplified a pre-existing architectural seam; it did not introduce a generally discontinuous sampler.** The commit's `SpriteRig.ts` change is narrowly visible at the weapon-specific selection and new choreography branch (`SpriteRig.ts:8581-8592`, `8661-8715`). It did not create the stage bridge, imperative pose pipeline, flourish cancellation, or late movement order. `sampleKatanaChoreography()` explicitly returns exact neutral identity at `t=1` (`packages/shared/src/melee.ts:233-303`), and the current 17-test continuity file passes; a separate probe across all 14 active katanas found zero non-identity ends. The ordinary non-spin pose window is 0.64x accepted cooldown (`packages/shared/src/constants.ts:802`; `packages/shared/src/melee.ts:1879-1937`), while the sampler also returns identity at the `t=1` boundary for other styles. This makes an intrinsically discontinuous end sampler an unlikely explanation for ordinary full-cadence chaining.

However, the commit made interruptions much more visible by adding body, foot, shadow, weapon-depth, and (for backflip) whole-root rotation channels. A probe measured a possible wrapped root-angle difference of PI when a backflip is interrupted, while that root channel is outside the existing bridge. It also measured up to **6.08 px** of `t=0` two-hand-spacing difference among the katana primitives; the first attack has no bridge. The checked-in test fabricates `boundaryPose()` records and exercises the transform helper (`SpriteRig.combo-continuity.test.ts:73-138`), then tests sampler identity/distinctness (`171-246`); it does not instantiate the actual writer order, test rest/flourish entry, cover root/shadow, or interrupt a step. Thus the commit is not “bad animation data”; it made an old missing-system guarantee easy to see.

## Proposed architecture: one target, one resolver, one commit

The smallest durable change is a **pose-resolution seam**, not a new animation system. Keep every existing sampler and clock. Stop letting those samplers' final mutations be indistinguishable from rendered state.

```text
CURRENT
base assignments -> attack mutations -> pose/flourish mutations -> hard constraints
 -> late movement/enemy mutations -> child-only combo bridge -> followers -> shadow assignment

INCREMENTAL TARGET
existing samplers/contributors -> RigPoseFrame target
 -> resolve weights/priorities + owner transitions + authority deadlines
 -> one commit to root/parts/weapons/shadow -> head/gear/VFX followers
```

Use an allocation-free retained `RigPoseFrame` with transform channels for local root rotation/scale (never world `x/y`), body, each hand, each foot, each weapon, and shadow/halo. A `PoseContribution` needs only:

```ts
interface PoseContribution {
  owner: PoseOwnerKey;             // e.g. attack:seq:hand, flourish:start, move:stance:epoch
  mask: PoseChannelMask;
  mode: "replace" | "additive" | "constraint";
  priority: number;
  weight: number;
  target: RigPoseFrame;
  exactByMs?: number;              // accepted active-start deadline for damaging affine channels
}
```

The initial priority/mode table should encode existing intent, not redesign it: rest/base; locomotion additive; weapon-family pose; flourish; accepted combat/tell/brace; exact ranged/two-hand/orbit constraints; movement/ultimate/downed interrupts. `constraint` is the explicit replacement for today's hidden late-setter ownership. Per-hand masks let dual wield change one hand without unnecessarily restarting the other.

At the resolver, each channel keeps `{ rendered, winningOwner, from, transitionStartedAt, transitionEndsAt }`. On the exact frame a winning owner changes:

1. latch `from = rendered` **once**;
2. continue sampling the new owner from its original accepted `sceneNow - swingStart` clock;
3. blend from that fixed `from` toward the newly composed live target; do not resample `from` on following frames;
4. if another owner interrupts mid-bridge, latch the current resolved output once and begin the new bridge there;
5. force damaging weapon/grip/root-affine channels to target no later than `exactByMs`; commit every Phaser transform once after resolution.

This preserves which pose is sampled and when. The resolver changes only the travel between owner poses. Same-owner sampler continuity remains a testable producer contract; owner changes cannot cut because they all pass through the same retained channel state. Shortest-path angle mixing (`mixAngle`, `SpriteRig.ts:700-703`) stays centralized rather than being reimplemented by each writer.

There is one hard physical limit to state plainly. If a remote action is first observed after its active deadline, or an authored active start is shorter than one rendered frame (the measured minimum is 6.144 ms), the client cannot both show intermediate frames and show exact damaging geometry on time. In that case the resolver must favor authority for the weapon affine and may smooth only cosmetic body/feet channels. Guaranteed smoothness **and** exact hit alignment would require prediction/lookahead or changing authored boundaries, both outside this mandate. The architecture makes that tradeoff explicit instead of silently leaving 74.1% of the old weapon pose active.

## Cheaper patches compared honestly

| Option | What it fixes | What it misses / risk | Verdict |
|---|---|---|---|
| Add more `lerp`/tween calls at obvious setters | One witnessed snap | Endpoints are still recomputed, interrupts restart independently, last writer can overwrite it; Phaser tweens run on another lifetime from accepted action state | Reject. The 544-line count is already the evidence. |
| Invoke the existing combo bridge on first attack and flourish cancellation; add root | Likely fixes the owner's most visible rest/flourish -> attack and interrupted-backflip cuts with a small diff | Shadow and later writers remain outside; whole-pose dual changes; current timing is unsafe on 36/51 authoritative steps; future systems bypass it | Viable emergency patch only **after** fixing the deadline, not the durable answer. |
| Make every combo's final pose match the next authored start | Can remove selected stage cuts | Changes owner-approved pose data, does not solve interrupts/swaps/dual/rest, and scales combinatorially by weapon/order | Reject under the hard constraint. |
| Smooth every final transform every frame | Systemic visual low-pass with little producer work | Delays active weapon geometry, softens intentional impacts, and makes local/remote timing frame-rate-dependent | Reject for combat channels. Useful only for explicitly cosmetic followers. |
| Single target/resolution/commit seam, then incremental contributions | Central latching, explicit authority deadlines, one ownership table, one commit | More engineering than a one-line patch; parity and affine tests are mandatory | Recommended. It is the smallest change that can become a system property. |

## Incremental sequence; no rewrite required

1. **Make the current bridge authority-safe before expanding it.** Compute the deadline from the accepted step's authoritative timing when `comboTiming` applies, not only generic `activeStartSeconds`; gate final blade/grip/root-affine error at active samples. This buys truthful rendering and prevents a broader resolver from institutionalizing today's overlap bug. Expected scope: the duration helper/call around `SpriteRig.ts:705-712`, `4038-4040`, plus shared/server-parity tests; no combo data change.

2. **Introduce a passive final seam with zero behavior change.** At frame start retain the actually rendered core pose. Let today's code compute exactly as it does, read that result into `target`, and commit it unchanged through one function. Include local root rotation/scale, `this.parts`, weapons, and shadow; explicitly exclude world root `x/y`. Move follower reads to after the commit. A parity test should prove target/committed transforms are bit-identical at representative idle, every combo phase, flourish, dual, recoil, tumble, jump, and remote sample. This buys one observation/commit boundary without a risky pose rewrite.

3. **Move the existing combo bridge into retained resolver state and cover all action-owner edges.** The central owner calculation detects rest/flourish -> accepted attack, continued step, accepted attack -> retained 120 ms release, and mid-bridge replacement. It latches actual output once. Delete `comboStageTransition` only after parity. This fixes the common complaint without changing `swingStart`, `tt`, combo selection, or hit windows.

4. **Add channel masks and movement interrupts.** Root/body/hands/feet/weapon/shadow get separate winner keys; dual-wield beats affect the selected hand(s), while tumble/jump/crouch and ultimate declare only the channels they actually own. The measured first-tick 45-degree tumble cut now starts from the current root pose. This buys predictable attack/movement coexistence and avoids whole-rig restarts for an off-hand beat.

5. **Migrate writers into contributions by conflict, not file order.** First attack + flourish (the observed collision), then ranged/two-hand/orbit constraints, then movement/recoil, and finally rest/pose-language. During migration, the untouched calculations remain a `legacy` target layer. Once a producer contributes, direct node writes for its channels are removed. This progressively eliminates last-writer-wins without a flag day.

6. **Extract the stable resolver, not the choreography.** After it proves itself in `SpriteRig.ts`, move the generic frame/channel/transition machinery to a small `pose-resolution.ts`; leave weapon-specific formulas and accepted clocks where they are. The 10,713-line file becomes less coupled, but this is refactoring after behavior is gated, not a prerequisite rewrite.

Each step is independently shippable and reversible. The owner can stop after step 3 if the visible complaint is solved; steps 4-6 turn the fix into the long-term ownership model.

## Cost and risk

These are engineering estimates, not measured implementation diffs:

- **Authority-safe bridge + passive seam (steps 1-2):** roughly 200-350 new/refactored lines and 40-100 call-site/order edits, concentrated near the transform helper/types (`SpriteRig.ts:700-743`, `364-375`), state (`2162-2172`), existing bridge (`4036-4095`), and final frame tail (`10488-10711`). This is around 2-4% of the rig, not a rewrite.
- **Owner transitions for attack/flourish (step 3):** roughly another 100-250 lines plus focused tests around `cancelFlourish()`, `triggerSwing()`, expiry, and final resolution. Expected total touched surface remains well under 5% of `SpriteRig.ts`.
- **Full contribution migration (steps 4-6):** likely 800-1,500 lines touched over several PRs, much of it mechanical replacement inside `animate()`. It is medium/high regression risk if attempted at once, which is why the passive seam and parity gate come first.
- **Runtime cost:** one retained transform record per core node and O(parts + weapons) composition/commit per frame. The rig already loops those same small arrays multiple times (`SpriteRig.ts:4044-4059`, `10497-10512`); the design requires no per-frame allocation and no Phaser tweens.

Risk by contract:

| Risk | Without gates | Required containment |
|---|---|---|
| Hit timing / WYSIWYG weapon position | **High**: current bridge already overlaps 36/51 authoritative active starts | Exact accepted-clock deadline per damage-bearing affine; <=1 px rendered blade/capsule error at every active sample; no transition may survive deadline |
| `attackSeq` / prediction / remote sync | Low if clocks are untouched, high if someone rebases transition time to receipt time | `swingStart`, `attackTick`, `attackSeq`, interpolation delay, and combo selection remain inputs only; reproduce the existing zero `rigAttackSeq - authority attackSeq` gate |
| Existing combo look | Medium during composition refactor | Bit-identical target-pose snapshots at authored phase samples; only resolved inter-owner travel may differ |
| Dual wield | Medium/high because current hard constraints overwrite hands independently | Per-hand masks, pair-bar coverage, and no restart of the untouched hand |
| Flourish/swap | Medium because weapon proxies and body channels have different lifetimes | Preserve outgoing proxy art; latch body/hand output at cancellation and lazy-art completion |
| Frame rate / hit stop | Medium | Continue using freeze-aware `sceneNow`; clamp only follower integration as today (`SpriteRig.ts:7956-7976`); test 16/33/50/100 ms frames and frozen clock |

The permanent regression matrix should cover: rest -> first attack; every N -> N+1 and wrap; accepted attack -> timeout release; mid-flourish accepted attack; swap/draw/stow; both dual hands and “both”; tumble, long jump, crouch, brace, recoil, ultimate; local predicted/confirmed and remote late observation. At each transition frame assert the first resolved sample equals the previously rendered transform for cosmetic channels, `from` remains unchanged through the bridge, owner changes increment exactly once, and damaging channels are exact by their accepted active deadline.

## What I would not change

- No edits to `packages/shared/src/melee.ts` combo sequences, `timing`, `path`, `choreography`, primitive, intensity, hand routing, damage, range, knockback, or hit windows. Those are the approved moves.
- No changes to `attackSeq`, `attackTick`, server combo selection, local prediction, remote interpolation delay, or `swingStart`. A visual transition consumes those clocks; it never creates another clock.
- No smoothing of authoritative/world `root.x/y` (`SpriteRig.setPosition()` at `3066-3068`). Player movement and network interpolation own those coordinates.
- No blanket suppression of tumble, jump, flourish, recoil, or dual wield to “avoid conflicts.” Their contributions need explicit composition, not deletion.
- No global tween per part. It would create competing retained state outside the accepted clock and recreate the restart/cancellation problem.
- No rig rewrite. The existing samplers, pose vocabulary, local ownership envelopes, and combo bridge are reusable; the missing piece is a boundary around them.

## Shipping verdict

Yes—this architecture angle is worth shipping first, but as a **staged seam**, not a grand pose-graph rewrite. The cheapest patch that merely calls the existing bridge more often would likely improve the demo and still leave the code structurally able to snap; worse, it would expand a bridge already measured past authoritative active starts. The first production change should make that deadline safe and establish a passive single commit seam. The next small change should route attack/flourish/rest owner changes through a latched resolver. That sequence addresses the owner's visible complaint quickly, preserves all 14 katana movesets and clocks, and creates the one place where future animation systems must declare ownership instead of silently becoming the new last writer.

## Validation

- `pnpm exec vitest run packages/client/src/entities/SpriteRig.combo-continuity.test.ts --reporter=dot`: **17/17 tests passed**.
- Throwaway catalog probe (removed after use): 51 authoritative-envelope combo steps; 36 bridge/active overlaps; worst prior-pose remainder 0.7414515671; minimum authoritative anticipation 6.144 ms; 14-katana `t=1` non-identity count 0; maximum `t=0` hand-spacing delta 6.08 px.
- Retained after-capture JSON reparse: 14 captures, 2,031 frame records, zero `rigAttackSeq`/`attackSeq` mismatches.
- Report structure check: all six required content areas present, 196 lines before this validation appendix, four balanced code fences, and zero trailing-whitespace lines. The workspace has no tracked-file diff; this arm created only `docs/design/anim-2-architecture.md`. The temporary evidence directory was removed. A Prettier binary is not installed in this workspace, so no Prettier check is claimed.
