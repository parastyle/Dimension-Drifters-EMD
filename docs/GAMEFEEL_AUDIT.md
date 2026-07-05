# Dimension Drifters — Game-Feel Clunkiness Audit (v0.105 investigation)

> Generated 2026-07-05 by a 54-agent find→adversarial-verify→synthesize workflow (6 lenses). **Group A (fix tonight) SHIPPED in v0.105.** Groups **B (prediction/netcode batch)** and **C (owner tuning calls)** are OPEN — they need a ruling or a coordinated batch, see the tail of this report.

# Dimension Drifters — Game-Feel Clunkiness Report (verified findings, ranked)

**Sources:** 38 verified findings across 6 lenses (input-latency, movement-feel, camera, animation-transitions, attack-feel, friction-ux), deduped to 27 items. All line references reflect the *corrected* citations from verification, not the original finder's drift.

**Three root causes explain most of the list:**
1. **No client prediction + a τ=154ms exponential render lerp** (`ArenaScene.ts:1724` / `:1017`, `t = 1 - 0.0015^(dt/1000)`) — self and every entity render 26–49px behind authoritative positions; every teleport glides; every impulse gets low-passed into mush. The uncommitted v0.105 steering stacks a second filter in series.
2. **Server eats inputs instead of buffering** (attack `GameRoom.ts:1090`, parry `:401`, jump `:533`) — visible swings/braces/hops that do nothing.
3. **Binary/wall-clock animation logic** in `SpriteRig.ts` — one-frame pops for facing, gait, swing-end, brace, weapon swap.

---

## A) Fix tonight — small/medium, high player-felt impact, low risk

Ranked by (felt severity × cheapness). All are client-cosmetic or server changes verified safe against determinism, server authority, and the test suite (caveats inline).

### A1. Client cooldown ignores loot affix multiplier — literally one line *(high / trivial)*
`packages/client/src/scenes/ArenaScene.ts:1851` sets `localAtkCd` without `lootCooldownMult(self.weaponAffix)`; server applies it everywhere (`GameRoom.ts:1061, 1071, 1083, 1088`; affix values `shared/src/loot.ts:54-71`). Heavy on a 0.3s sword: server min-gap tick-rounds to 400ms vs 300ms client sends → **exactly 50% of swings are ghosts** (realized 0.625× DPS vs advertised ~1.04×). Swift/Light/Hollow's speed bonus is physically unusable (client never sends faster than base) — Light is a strict 0.88× damage downgrade. Half the loot table lies. Fix: multiply at :1851. Pair with A2 to kill residual tick-grid ghosting (0.36s vs 0.4s).

### A2. Server eats early attacks and parries — buffer instead of clear *(high / small)*
- Attack: `GameRoom.ts:1090` unconditionally clears `c.attacking` even when the gate at `:1059` rejected it; client sends exactly once per cooldown (`ArenaScene.ts:1847, :1891`) after already playing the full swing (`:1855`), slash VFX (`:1884/:1886`), and gun camera kick (`:1876`). Note cd decays *before* the gate (`:1038`), so only arrivals >1 tick early are eaten — worst offenders are off-grid melee: Twin Bowie Fangs 0.18s → 200ms server gap, Buzzcutter 0.22s → 250ms. Result: swing passes through an enemy, nothing happens.
- Parry: silent drop at `GameRoom.ts:401`. The *common* real clunk (verifier downgraded "phantom parry" to rare-on-LAN) is the **chain-gate desync**: server refreshes to `PARRY_CHAIN_CD=0.12` immediately (`GameRoom.ts:2036`) but the client only learns via `parriedSeq` ~50-125ms later (`ArenaScene.ts:2153`), so the client gate (`:1903`) blocks chain presses the server would accept.
- Fix: replace booleans with a queued timestamp, fire when `cd <= 0 && age < ~150ms`. **Caveat from verification:** do NOT expire against `state.elapsed` — it freezes outside active arena play (`GameRoom.ts:1004-1006`); use an accumulating sim clock or decrementing timer. Same pattern for parry.

### A3. Teleport snap threshold in `interpolate()` — two lines, fixes three bugs *(high / trivial)*
`ArenaScene.ts:1721-1733` has no max-gap check; `followSelf`/`centerCam` (`:1736-1772`) track the blob. Rift descent (`GameRoom.ts:2529-2530`), restart (`:778-779`), and pit snap-back (`:993-994`) become camera fly-bys: a 3000px descent starts the pan at ~19,500 px/s (corner-to-corner ~44,100 px/s), 0.63–1.23s to settle — the 500ms violet flash (`:741`) is half-gone by 250ms. Fix: `if (hypot(gap) > ~200-400px) setPosition` — max legitimate gap is ~49px steady-state + hit-stop accrual, so 200px is safe. Also converts pit-fall rubber-banding into a readable snap (see A18 for the full staging).

### A4. Camera shake: starvation + spam — one prioritized helper *(high / small)*
Phaser 4.1.0 drops overlapping shakes (`Shake.js:168-171`); **all 8 call sites omit `force`**. Gun recoil (`ArenaScene.ts:1876`) runs 70% duty on the gatling (56ms shake per 80ms shot), 44% on 0.16s guns — so got-hit (`:2168`, 100ms/0.005), boss slam (`:1110`, 200ms/0.014), fall (`:769`), explosions (`arena/vfx.ts:377, :421`), portal (`:1369`), and level-up (`:2288`) shakes are silently swallowed most of the time you're firing. Meanwhile banners (`:1369`, 180ms/0.006 — same intensity as fall damage) and level-ups shake the camera for pure UI events. Fix: route all shakes through one helper — `cam.shake(dur, intensity, true)` when new intensity ≥ running, drop otherwise — and **delete** the banner/level-up shakes outright.

### A5. Gait is binary and the "moving" check is dead code — full-stride jog for 1.3s after stopping *(high / small)*
`ArenaScene.ts:1796-1808` normalizes the render delta to unit length; `SpriteRig.ts:358` tests `> 0.02` against an always-length-1 vector, so `moving` stays true until the render delta < 0.001px — **~1.31s after key release** at 60fps (τ=154ms lerp decay from the 49px gap). Feet stride at fixed full amplitude (`SpriteRig.ts:488-501`, lift s·16, ±7 stride, 11rad/s), lean pinned at ±0.16rad (`:382`), and on the flip to idle a foot at max stride teleports ~16·s px. A↔D reversal snaps the torso 0.32rad (~18°) in one frame. Fix: pass raw px/s velocity (plumb `deltaMs` into `animateBlobs`), gate moving on speed > ~20px/s, keep a smoothed 0..1 `gait` crossfade, scale stride+lean by `min(1, speed/MOVE_SPEED)`; rescale the facing threshold (`:365`) and lean term accordingly. Slightly more than three lines, still small.

### A6. Facing is a one-frame full-body mirror flip *(high / small)*
`SpriteRig.ts:364-370` — 84px body (`TARGET_BODY_H :27`) plus up to a 125px weapon (`weapons.ts:757`) mirrors in a single frame every time aim crosses vertical; the 0.05 deadzone on normalized aimX is a ~5.7° total band, so near-vertical aim close to the character strobes the rig on consecutive frames. Remote flips quantize to 50ms ticks. Fix: lerp a `facingBlend` −1..1 over ~80–120ms through scaleX=0 (reads as a turn) + real hysteresis (commit at |aimX|>0.18, release at 0.05). Client-cosmetic only — attack aim uses `selfAim` (`ArenaScene.ts:1891`).

### A7. Melee swing hard-snaps from full extension to rest *(high / small)*
`SpriteRig.ts:426-445`: swing eases out for `cooldown*470`ms (`:427`), then the first frame past `dur` reverts to `restA` (`:424`) — a 2.5–3.0rad (up to ~170°) rotation discontinuity. Driftblade (cd 0.62, arc 2.3, `weapons.ts:582-584`): ~2.56rad snap ~96×/min under held RMB; katana (cd 0.28): 132ms swing → snap → 148ms rest, ~3.5 snaps/sec; worst arcs are greatsword/Reaper's Lid/Wyrmtooth (3.0) and Drowned Anchor (3.1). Fix: reserve the last ~25% of `dur` (or extend toward `cooldown*700`) as an ease-in return to rest. Purely additive — re-trigger can't interrupt mid-swing (`ArenaScene.ts:1843-1855`).

### A8. Tick-lock the patch broadcast *(medium / small)*
`GameRoom.ts:597` (sim) and `:600` (patch) are two independent 50ms Node timers (`@colyseus/core 0.16.24 Room.js:347-350` and `:216`); phase drifts under load, worst case every tick's results wait a full extra 50ms — the "sometimes fine, sometimes laggy" +0–50ms. Fix: `setPatchRate(0)` and call `this.broadcastPatch()` as the last line of `update()`. **Must also add a `broadcastPatch() {}` stub to the vi.mock Room class in `GameRoom.test.ts:28-42`** or every tick-driving test throws.

### A9. Hit-stop triple fix: whiff-freeze, kill-stop budget, frozen rig clocks *(medium / small)*
- Quake weapons call `hitStop(130)` on **every click including whiffs** (`ArenaScene.ts:1871`, client-predicted branch, before the send at `:1891`) — a rhythmic 130ms judder swinging at air. Gate it on a client-side `inMeleeArc` hit test (precedented by chain VFX at `:2571`); keep ≤40ms predicted on click if any.
- Kill-stop (45ms, <420px, throttled 110ms trigger-to-trigger, `:1001-1008`) reaches **~41% frozen time** while burning down an accumulated horde (verifier corrected the 29% figure upward). Budget it: cap total frozen ms per rolling second, reserve for toughs/pack-last.
- Freezes gate rendering (`:903-910`) but SpriteRig swings/braces run on wall-clock (`SpriteRig.ts:288-298`, `el` at `:426`, `bel` at `:400`) — a kill-stop skips ~34% of a katana swing; the 100ms parry stop (`:2154`) eats 100ms of the 450ms guard hold at the exact parry beat; `deathPop`/glow tweens (`:189-205`, `:222-230`) keep running while everything else freezes. Fix: scene-level unfrozen-delta animation clock (or shift `swingStart`/`braceStart` by freeze duration on release); pause the tweens.

### A10. Weapon swap pop-in + lazy-load ghost weapon *(medium / small)*
`SpriteRig.equipWeapon` (`SpriteRig.ts:236-283`) destroys/creates in one frame; on lazy-loaded drop art, `ArenaScene.ts:700-703` returns without unequipping, so the rig keeps drawing and swinging the **old** weapon with the old `cooldown*470` timing while the server and send-cadence (`:1848-1851`) already use the new one — during the loot spine's celebration moment. `swingStart` is never reset (mid-swap, elapsed time carries into the new def's timeline). Fix: unequip immediately on state change, equip with a ~120ms raise tween when art lands, reset `swingStart` in `equipWeapon`.

### A11. R grab/drop/salvage cluster — grab is a destructive booby trap *(high / medium)*
(a) Grab fires on JustUp, not JustDown (`ArenaScene.ts:862-864`) — latency = hold time + RTT. (b) `canSalvage` lockout within 46px of any pickup (`:854`); worse, the client ignores the server-only `pickupGrace` (`GameRoom.ts:292, :500`) so **R is completely dead for 0.7s after your own drop**. (c) Server grab replaces `player.weapon` and spawns no pickup for the held weapon (`GameRoom.ts:494-523`, esp. `:508-522`) — swapping into a drop permanently deletes your possibly-Legendary held weapon. (d) No highlight of which pickup R will take (`:845-853`). Fix: server-side swap (drop held weapon as a pickup with grace — verified compatible with `GameRoom.test.ts:744/828/849`), JustDown grab, disambiguate salvage on hold-time not proximity, highlight ring + name label (note: it will mispredict during grace unless grace is synced/approximated).

### A12. Banner spam + level-up toast rendered under the modal dim *(medium / small)*
`flashBanner` (`ArenaScene.ts:1350-1370`): fixed point h/2−80, 2.2s fade — two banners within 2.2s overprint exactly (loot reveals `:2183-2198`, boss `:1331-1334`, depth `:747-752`). LEVEL UP toast (depth 100003, `:2270-2288`) spawns the same frame the modal dim (depth 100010, 0.66 alpha, `:1419-1423`) opens — the celebration is ~66% dimmed out. Fix: queue/stack banners with ~300ms spacing, raise toast above the dim (or defer it), and remove the UI shakes (with A4).

### A13. Parry timing telegraphs animate at 20fps *(medium / small)*
The white-tell ring radius reads synced `enemy.windup` raw (`ArenaScene.ts:1055, :1084-1087`; server writes per 50ms tick, `GameRoom.ts:1978-1979`) — a 0.52s windup (`enemies.ts:206`) renders as ~10 discrete steps; same for boss-slam disc (`:1099-1106`) and rift arc (`:1977-1988`). The one cue you time a 0.45s parry against stairsteps while everything around it runs per-frame. Fix: keep prev/target per enemy and lerp over one patch interval (50ms). Use this variant — the "advance locally from known windup duration" variant is unsafe because the client can't distinguish windup (0.52s) from combo `swingGap` (0.34s) ramps.

### A14. Duelist's sword sweep is pinned to world +x, ignoring attack direction *(medium / medium)*
`ArenaScene.ts:957` fires `triggerSwing` with no `aimWorld`; `animateEnemies` passes `aimDir: 0` (`:1046`) → the mirror math pins the sweep to **world +x regardless of facing** (a left-facing ronin cuts behind its own back) while the server's cone tracks the targeted player (`shared/enemies.ts:377`, called at `GameRoom.ts:2016`). Fix: pass the nearest-player vector already computed for the telegraph cone (`:1064-1076`) as `aimWorld`. Bonus (can defer): feed `es.windup` into a rig coil pose — today the body shows nothing during windup except the 0.28× creep (`GameRoom.ts:1943-1947`); the read lives entirely in the UI overlay.

### A15. Jump hop stair-steps at 20Hz — cheap lerp now, dead-reckoning later *(medium / small)*
`blob.setHop(pl?.height ?? 0)` (`ArenaScene.ts:1810-1813`) applies synced height raw while x/y on the same rig are smoothed. Discrete Euler steps: 15.2/11.8/8.4/5.0/1.7px per tick, ~10 ticks, and the integration **overshoots the tuned 34px peak to ~42px**; landing is a ~15px one-frame snap with the +12% stretch (`SpriteRig.ts:514-520`) cutting off simultaneously, shadow stair-steps in sync (`:523-524`). Tonight: lerp `hopPx` with τ≈40–60ms + ~100ms scaleY 0.88 landing squash + dust (pit-fall dust at `:756` exists to crib from). Real fix is B3 — `vh` is not synced (`state.ts:72` syncs height only; `vh` lives in the server combat map, `GameRoom.ts:205`).

### A16. Jump inputs silently eaten — 0.25s post-landing dead window *(low / small)*
Gate at `GameRoom.ts:533` (handler `:528-536`) drops presses while `jumpCd > 0` or airborne; cooldown 0.7s vs actual airtime ~0.449s (`constants.ts:154-155`) leaves ~0.25s where SPACE does nothing, plus latency+tick staleness. Fix: queue `jumpQueued` and consume when grounded+ready — buffer **~0.25s** (verifier: the proposed 0.15s under-covers the window). No test asserts the rejection.

### A17. Guns get zero muzzle feedback until the server round-trips *(medium / medium)*
Flash+bullet spawn only when the synced projectile appears (`ArenaScene.ts:1136-1168`, spawn at `:1158`; comment at `:1875` admits it) — ~60ms median localhost, ~117–125ms worst, +RTT online; only the camera shake (`:1876`) is click-instant, and after A2's missing-shot fix, an eaten shot today is a kick with no bullet. Melee already predicts (`:1855, :1884-1886`). Fix: predict the cosmetic flash at the barrel via shared `gunMuzzleReach` (client `:1154`, server `:1649` — same origin guaranteed) + optional local tracer replaced by the authoritative projectile. Damage stays server-side.

### A18. Pit fall reads as an invisible wall, with dust at the wrong spot *(medium / medium)*
`GameRoom.ts:975-1001`: 15% HP chip (`:989`, `PIT_FALL_DAMAGE_FRAC` `constants.ts:172`) + teleport to `lastGround` (`:993-994`, recorded `:983-984`); the client glides the rig backwards out of the pit over ~350ms and `spawnFallStreak` (`checkFalls` `:758-771`, fires at `:766`) plays at the **post-snap safe coordinates** because `fellSeq` and the teleport arrive in the same patch. Edge case: during the 0.6s grace you can drift ~190px over the pit, then rubber-band the full distance. Fix (client-only, all data present): on `fellSeq` bump, play sink-and-fade at the pre-snap rig position (`checkFalls` at `:894` runs before `interpolate` at `:904`, so it's available), hard-snap, pop on arrival. A3's snap threshold covers the worst of it if you only do one.

### A19. Camera bounds clamp is wrong at DPR>1 — the "verified non-issue" that isn't *(medium at hi-DPI / small)*
`centerCam` (`:1759-1772`) is correct, but `setBounds(0,0,4800,4800)` at `ArenaScene.ts:343` makes Phaser's per-frame `preRender` clamp (`Camera.js:589-597` → `BaseCamera.js:968-1019`) re-clamp with origin-0.5 math under this scene's `setOrigin(0,0)`: at `RENDER_DPR>1` max scroll falls short by `viewW*(DPR-1)/2` — **the local player walks off-screen near the right/bottom arena walls** (half a viewport at DPR 2) — and the center-when-viewport-exceeds-world branch is clamped away. Only coincidentally correct at DPR 1, which is why it looked fine in dev. Fix: remove `setBounds` (centerCam already clamps correctly) or compensate the bounds for origin/zoom.

### A20. Chain-parry re-trigger drops the guard pose for one frame *(low / small)*
`triggerBrace` (`SpriteRig.ts:296-298`) blindly resets `braceStart`; the envelope (`:400-405`) re-ramps from 0 over 81ms, so each chained press (landing anywhere in ~120–450ms of the prior brace) flickers the guard off — weapon (`:449-451`), hands (`:466-471`), body dip (`:408`) — during the Sekiro rhythm the i-frames just rewarded. Fix: if `bel < bdur`, restart at plateau time (`braceStart = timeMs - 0.18*bdur`); hoist `bdur` out of `animate()` so `triggerBrace` can see it.

### A21. Spectate camera hard-cuts between targets *(low / small)*
`followSelf` (`:1739-1751`) cuts to the first alive player in map iteration order the frame you die, and re-cuts on each subsequent down. Fix: pick nearest alive teammate; ease a `camTarget` (τ≈250–400ms) on target *changes* only.

---

## B) Needs the prediction/netcode batch

These share infrastructure and should land as one coordinated effort. The shared movement steppers were written pure for exactly this (`movement.ts:26-33`).

### B1. Client-side prediction for the self player *(the keystone — high / large)*
Merged from three independent findings that all confirmed the same chain. No prediction exists (`GameRoom.ts:223-229` comment; zero client references to any shared stepper). Full pipeline: 60Hz edge-triggered input (`main.ts:29-33`, `ArenaScene.ts:2654-2662`) → 20Hz tick (`GameRoom.ts:597`, `TICK_MS=50` `constants.ts:16-18`) → patch (`:600`) → τ=154ms render lerp (`ArenaScene.ts:1721-1733`). With v0.105 steering (τ≈71ms server-side) cascaded under the client lerp, **keydown → 90% rendered speed ≈ ~500ms**, and at full sprint the rendered body trails the authoritative one by v/λ ≈ **49px — two full PLAYER_RADIUS (24, `constants.ts:96`)**. Every dodge, pit edge, and portal radius resolves against a position you aren't looking at. Also resolves: melee WYSIWYG ~49px slash-vs-hitbox offset while strafing (slash drawn at rig `:1880-1886`, server sweeps live position `GameRoom.ts:1244/1354`), and most of the camera response lag.
Implementation: run `stepSteeredMovement + stepImpulse + stepVertical` client-side per frame from local input (**not** `stepPlayerMovement` — the `GameRoom.ts:229` comment is stale post-v0.105), render predicted, reconcile against patches with a small correction gain; must reconcile server-side body/POI collision pushouts. Keep the lerp for remotes.
Interim while B1 is in flight (client-only, one line): split the smoothing constant — keep 0.0015 for remotes, raise the self decay toward ~1e-5 (τ≈87ms, 90% in 200ms; verifier corrected 1e-6 → τ≈72ms/~23px trail, not 36ms/11px). Also spawn muzzle flashes at the rig's rendered position instead of state position (`:1158-1161`) so the flash stops floating 49px off the barrel.

### B2. Remote entities: snapshot-buffer interpolation + enemy velocity dead-reckoning *(high / medium)*
`EnemyState` syncs x/y only (`state.ts:93-94`); `interpolateEnemies` (`:1015-1023`) leaves the horde 26–35px behind at chase speeds (168/225 px/s, `enemies.ts:118/128`) — contact damage lands from bodies drawn short of reality. Projectiles already prove the pattern in-repo (vx/vy + dead-reckon + 0.18 correction blend, `:1188-1200`). Do: last-2-3-patch snapshot buffer at fixed ~100–120ms render delay + snap threshold (>200px) for pit/revive/rift repositions; derive per-enemy velocity from consecutive snapshots (no schema change) or add vx/vy with a `SCHEMA_VERSION` bump. **Caveats from verification:** during windups enemies creep at 0.28× (`GameRoom.ts:1944-1948`) so the parry-read lag is only ~7–10px; the real strike-instant gap is the single-tick 48–72px lunge dash (`GameRoom.ts:1958-1962`, `enemies.ts:209/304`) which is *not* predictable client-side — the fix for that is drawing telegraph cones from authoritative state (A14), not extrapolation; naive dead-reckoning overshoots on kills/turns, keep the gentle blend.

### B3. Vertical dead-reckoning for jumps *(medium / medium)*
Client-integrate the shared pure `stepVertical` between patches (`constants.ts:162` comment anticipates it). `vh` is server-private (`GameRoom.ts:205`), so estimate it from height deltas + a local last-jump timestamp against shared `JUMP_COOLDOWN`; optionally trigger the hop visual locally on keypress. Supersedes the A15 lerp.

### B4. Render impulses instantly — the §20 momentum layer never reaches the screen *(medium / medium)*
Discrete 300px/s knockback kicks (melee `GameRoom.ts:2053-2056`, projectiles `:2153-2156`, boss slam 660px/s `:1509-1512`, gun recoil ~190px/s `:1674-1675`; note the contact shove at `:1173` is dt-scaled *by design*) decay at k=9/s then pass through the k≈6.5/s render lerp — **peak rendered velocity ~93px/s vs 300 authoritative (~3× attenuation), peaking ~130ms late**. Synced vx/vy (`state.ts:78-80`) currently feeds only the cosmetic rig flinch (`SpriteRig.ts:387-394`). Fix: integrate synced vx/vy into rendered position as a locally-decaying offset (or exempt the impulse component once B1 lands) + a 1-frame camera kick on impulse events.

### B5. Move the render loop to requestAnimationFrame *(medium / medium — bundle here for risk management)*
`main.ts:29-33` `forceSetTimeOut: true` beats against vsync: aperiodic micro-judder on the constantly-scrolling 4800px arena, plus a hard ~60fps cap on 120/144Hz displays. **Do not** use a `visibilitychange` fallback — the shell passes `disable-backgrounding-occluded-windows` (`desktop/main.cjs:21-38`) so an occluded window can stay 'visible' while the compositor parks rAF, silently reintroducing the "no player on load" freeze (see memory note). Use an rAF-stall watchdog timer as the mandatory fallback, and note Phaser's TimeStep fixes rAF-vs-setTimeout at loop start (needs a loop restart or custom TimeStep).

### B6. Parry lag compensation + ack-driven i-frame ring *(low / medium — online-only)*
i-frames start at message arrival (`GameRoom.ts:404`) while the client ring claims protection from press time (`ArenaScene.ts:1905, :1928`) — a one-way-latency gap at the front edge where reactive parries live. **Verifier caveat:** `invuln` is a remaining-time countdown, so `PARRY_IFRAMES + latency` extends the *tail*, not the front — only the backdate-and-refund variant helps, and a felt-complete version (parry rewards, un-applying knockback) is heavier than it looks. Fine to defer until online play matters; A2's buffer fixes the common desync.

---

## C) Tuning judgement calls for the owner

### C1. Ship order for v0.105 steered movement — decide before committing
The steering (ACCEL 14/DECEL 24, `movement.ts:77-107`, applied `GameRoom.ts:931-935`) was tuned against server-side response (`constants.ts:27-29` "~165ms") but lands **~2.7× mushier** on screen because it cascades under the τ=154ms client lerp: rendered 90% rise ~448ms vs 354ms pre-steering. Options: (a) land B1 first so steering is the only filter and 14/s genuinely feels like 165ms; (b) if steering ships first, raise the self render-lerp decay (e.g. ~1e-5 → τ≈87ms) so combined 90% stays ≤~350ms. Either way, stop tuning ACCEL/DECEL against server-side numbers.

### C2. Level-up modal cadence — spec §12 is LOCKED, needs your ruling
~7–9 full-squad freezes in the first two minutes (cumulative XP to L10 = 100, `leveling.ts:10-16`; the code targets L13–15 by the 120s boss). Freeze: `GameRoom.ts:928` movement skip, `:1059` attack gate, modal `ArenaScene.ts:1416-1552`, sig draft chains a second modal (`progression.ts:47`). Enemies keep pathing during the freeze (only damage gated, `:1162`) — the window closes into a pile of lunging bodies, and the spec already flags that gap as NOT-YET-BUILT. The proposed fixes (non-modal card row with hotkeys, coalesce stacked picks, open only when no enemy within ~400px) all touch §12's "invincible breather" intent — design change, not a code fix. Note stacked levels already coalesce into one longer freeze (`progression.ts:29-32`).

### C3. Extraction: instant tripwire is documented intent (`GameRoom.ts:2584` "benign direction") — but it fires the climax for you
Portal opens on the boss corpse (`:2475-2477`) where the guaranteed drop also lands (`:1754`); `EXTRACT_RADIUS=90` (`constants.ts:316`) > `PICKUP_RADIUS=46`, so reaching the boss drop force-banks the run; `bodies` (`:946-952`) has no `inLevelWindow` filter, so a player frozen in the boss-XP level-up within 90px extracts the squad with zero input. Recommended (needs §6 spec parity + test updates at `GameRoom.test.ts:450/678`; rift-channel test at `:650` is the pattern): offset the portal like the rift (RIFT_OFFSET=420), give extraction a ~0.8s channel, exclude `inLevelWindow` players from portal checks.

### C4. Q/E cycle wiping loot identity is a deliberate anti-salvage-exploit (`GameRoom.ts:425-436`), pinned by tests (`GameRoom.test.ts:834-857`, exploit guard `:724-747`) — but one mispress erases a Legendary
"Q to cycle" is advertised on the HUD (`ArenaScene.ts:2351`) next to WASD. Safe fix if you want it: cache the earned loadout `{weaponId, rarity, affix, earned}` and restore when cycling returns to that id, **clearing the cache on salvage/drop/death/training-toggle** so the salvage-printer exploit stays closed; update the "cycling shreds identity" test expectation. Or scope Q/E to conjured weapons only. Your call on the design tradeoff.

### C5. Knockback constants retune — the numbers interact with discretization and other systems
The proposed "600 impulse / 18 friction keeps the shove" is wrong at 20Hz discrete integration: today's shove is ~41px (not 33), and 600/18 gives ~50px (+25%); raising IMPULSE_FRICTION without doubling `GUN_RECOIL_IMPULSE` (190, `constants.ts:364`) and PARRY_PUSH (130) halves those systems; the golden snapshot (`GameRoom.test.ts:929`) needs re-baking. Cheaper path: skip the retune and let B4 (instant impulse rendering) restore the punch — then re-evaluate.

### C6. Camera look-ahead and decoupled easing — feel preference
No deadzone/look-ahead/aim-offset exists; camera is welded to the blob lerp (`centerCam :1759-1772`; aim vector computed at `:1784-1793`, never used). Genre-standard cursor lean (12–18% of half-viewport toward pointer, own τ≈80–100ms) buys reaction time in your firing lane — but note the server steering (τ≈71ms) caps how snappy any camera tune can feel until B1; only the cursor-driven component fully bypasses it. Preserve the arena clamp (`:1766-1771`). Amount of lean is taste — yours to set.

### C7. Hit-stop catch-up lurch — verifier's own note: acceptable at current durations
After A9's budget, the residual post-freeze surge (~590px/s momentary catch-up burning a ~91px gap) is tolerable; if you want it crisper, blend the accrued gap over a fixed 80–100ms ramp on release, or exclude the local player from freezes. Judgement call on whether it's worth the medium effort before B1 makes it moot.

---

## Dedupe map (for traceability)
- **B1** merges: "No client-side prediction" (input-latency), "No client-side prediction: ~154ms smoothing" (movement-feel), "Local player movement lags ~300-370ms" (friction-ux, corrected to ~500ms), plus the melee-WYSIWYG offset's real fix (attack-feel).
- **A3** merges: "No teleport-snap threshold" (movement-feel) + "Teleport lerp-zip NOT fixed" (camera).
- **A5** merges: "Rig keeps walk animation 1.3s" + "Walk↔idle binary flag" (same normalized-moveX root).
- **A6** merges: both facing-flip findings (movement-feel + animation-transitions).
- **A9** merges: "Hit-stop fires on WHIFFS" (attack-feel) + "Hit-stop ~30-41% during clears" (friction-ux) + "Hit-stop freezes renderer not rig clocks" (animation-transitions); C7 carries the residual.
- **A15/B3** merge: three jump-staircase findings (input-latency, movement-feel, animation-transitions).
- **B4/C5** merge: both knockback-filtered findings (input-latency + movement-feel).
- **B5** merges: both setTimeout-render-loop findings (input-latency + camera).
- **A2** absorbs the phantom-parry finding (attack-feel, PARTIAL) — the verified real-world clunk is the chain-gate desync; lag-comp remainder is B6.
- The "verified non-issue" camera finding (PARTIAL) surfaced a real DPR>1 bounds bug → **A19**.
