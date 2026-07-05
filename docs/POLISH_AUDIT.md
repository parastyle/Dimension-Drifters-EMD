# Dimension Drifters — Polish Audit (v0.108 discovery)

> 5-lens polish-opportunity sweep, 2026-07-05. **Group A (audio + combat/HUD juice) SHIPPED in v0.108.** Groups B (larger cosmetic sweep) and C (owner-decision copy/balance) are OPEN — see the tail of the report.

These anchors match the findings. I have enough verified context to synthesize confidently. The findings are internally consistent on line references (the core `updateCombatFx` at 2447-2459, `updateHud` HP ratio at 2628-2634, ammo readout at 2652-2658 all confirmed). Here is the synthesis.

---

# POLISH BUILD LIST — Ranked & Deduped

## RECOMMENDATION — the coherent slice to ship this pass

Ship **"The First Feel Pass": the procedural audio spine + the combat/danger juice that rides on the exact same event anchors.** Build `AudioBus.ts` once (A1), wire it to the two constant-fire combat events and the reward/big-moment stingers (A2–A4), and gate it behind a default-conservative volume/mute (A5). In the *same* edit sweep — because they touch the identical `updateCombatFx`/`updateHud` lines — land the four highest-leverage visual wins that make every hit and every close call legible: magnitude-driven damage numbers + crit-feel pop (A6), the low-HP red vignette that doubles as the hurt-flash (A7), lerped/chip-trail bars (A8), and the arena/menu camera fade-ins (A9) plus the flashBanner entrance pop (A10) that lifts every boss/loot/depth beat at once. This is one contiguous, low-risk, no-schema, no-owner-ruling batch that converts the game from "silent prototype" to "shipped-feeling" in a single coherent pass: **you hear every shot, feel every big hit, sense every near-death, and every transition reads as intentional.** Everything heavier (end-cards, boss bar, ambient world texture) or debatable (copy, balance, minimap) is deferred to B/C.

---

## GROUP A — SHIP THIS PASS
*(high value · small/medium · low risk · client-cosmetic · no owner ruling)*

### A1 — Procedural Web Audio SFX core `AudioBus.ts` *(foundation — build first)*
- **File:** NEW `packages/client/src/audio/AudioBus.ts` (~200 lines). Instantiate in `ArenaScene.create()` beside `this.vfxPlayer = new VfxPlayer(this)` at **ArenaScene.ts:385**; store as `this.audio`.
- **Sketch:** Single lazy `AudioContext`, `resume()`d inside the existing RMB/LMB/keydown gesture handlers in `create()` to satisfy autoplay policy. Master `GainNode` → destination; `master.gain = volume × (muted?0:1)`. Primitives: `tone(freq,dur,{type,gain,sweepTo,curve})` (Oscillator→Gain ADSR via `setValueAtTime`+`exponentialRampToValueAtTime` to 0.0001); `noise(dur,{gain,filter,freq,q})` from one shared 1s mono noise buffer through a BiquadFilter; `blip(freqs[],step,opts)` for arpeggios. Add `play(event,{x,y}?)` dispatcher with a **per-event throttle map** (hit≥25ms, shot≥30ms). Optional `StereoPannerNode` from `(worldX − camera.midX)` clamped. Hard-cap ~24 concurrent voices via a Set counter (inc on start, dec on `ended`), drop over budget.
- **Note:** Merges the two audio-core findings (combat-focused + scene/transition-focused) into one module — they are the same engine.

### A2 — Wire the two highest-frequency combat sounds *(gun-shot per bulletKind + enemy-hit thunk)*
- **Files:**
  - Gun-shot self — after `spawnMuzzleFlash` in `sendAttack` at **ArenaScene.ts:2133** (`weapon.gun.bulletKind` in scope at :2132).
  - Gun-shot remote — after `spawnMuzzleFlash` in `syncProjectiles` at **ArenaScene.ts:1342** (`pr.kind`).
  - Enemy-hit — the `enemy.hp < prev` block, **ArenaScene.ts:2454** (verified: `rig.flash()` + `spawnDamageNumber` here).
- **Sketch:** `this.audio.play('shot:'+bulletKind, {x,y})` after each muzzle flash. Per-kind synth mirroring the GUN_FX split (`projectile-factory.ts:15-21`): slug = 90ms bandpass~700Hz noise + 140→60Hz sine thump; pellet = 120ms lowpass noise, gain 0.4; tracer = 40ms bandpass~1600Hz click, gain 0.18, throttle 40ms; nail = 60ms highpass ~2kHz tick; ricochet = 70ms noise + 900→1500Hz zing. Enemy-hit at :2454: `this.audio.play('hit',{x:rig.x,y:rig.y})` — 55ms triangle 180→90Hz + noise transient, gain subtly scaled by `prev - enemy.hp`. Throttle hit ≥25ms so an AoE tick plays one layered thunk.

### A3 — Reward/skill stingers *(parry ding · level-up arpeggio · loot chime · death crunch · grab blip)*
- **Files:** Local parry — after `room.send('parry')` at **ArenaScene.ts:2173**. Parry spark (remote) — **:2467**. Level-up — `spawnLevelUp` **:2492**. Loot reveal — `flashBanner` **:2509** (`rar.color`/`self.weaponRarity` in scope). Enemy death — `spawnPoof` **:1139**; pit death `spawnFallStreak` **:1136**. Grab — `room.send('grabWeapon')` **:974**.
- **Sketch:** Each a one-line `this.audio.play(...)`. Parry ding (fire on LOCAL at :2173, distance-scaled at :2467) = two detuned sines 1400+2100Hz, 180ms, gain 0.35. Level-up = ascending 523/659/784/1046Hz triangle arpeggio, 70ms steps. Loot chime = base pitch rising with `self.weaponRarity`. Death crunch = 45ms lowpass~400Hz noise + pitch-down sine, gain 0.25, throttle 30ms; pit death = 300→80Hz downward "whoo". Grab = 880→1320Hz two-note blip.

### A4 — Big-moment low-frequency events *(boss slam · descent/extract whoosh · player-hurt oof · fall thud · revive)*
- **Files:** Boss slam — `spawnExplosion + shakeCam(200,0.014)` in `renderBossSlam` at **ArenaScene.ts:1288**. Descent/extract — `cameras.main.flash` at **:833** + banner **:840**. Player hurt — self.hp-drop block **:2483-2485** (`prevSelfHp − self.hp` in scope). Fall/pit — local flash+shake **:871**. Revive — green flash on `revivedSeq` **:2055**.
- **Sketch:** All pair with an existing shake/flash — the shake wants a boom under it. Boss slam = 60→30Hz sine sweep 400ms, gain 0.5, + bandpass~120Hz rumble. Descent = downward whoosh (noise 1200→200Hz over 600ms + sub-drop); extract-success = the same inverted (upward triumphant). Hurt = 120ms lowpass noise + 200→120Hz sine, gain by damage. Fall = 80Hz sine 90ms thud after the whoosh. Revive = warm rising 2-note chord.

### A5 — Volume + mute with localStorage persistence *(menu slider + M-to-mute)*
- **Files:** AudioBus owns the setting. In-arena hotkey — add `'M'` to the `keyboard.addKeys` string at **ArenaScene.ts:397**, then a `JustDown` toggle beside the Q/E/T/B handlers at **:1006-1009**. Menu UI — `MenuScene.ts` `create()` at **:38**.
- **Sketch:** `volume` (0..1) + `muted` persisted to `localStorage('dd.audio.vol'/'dd.audio.muted')`, applied to `master.gain`. **Default volume ~0.35, unmuted** (co-op — don't blast a first-join). MenuScene: slider + mute checkbox in the existing Phaser text/rect UI. In-arena: `if (JustDown(this.keys.M)) this.audio.toggleMute()` at ~:1009 + an 'AUDIO OFF/ON' toast via `flashBanner`. Ships audio respectful-by-default and instantly silenceable.

### A6 — Magnitude-driven damage numbers + crit-feel pop *(dedup: two findings merged)*
- **Files:** `vfx.ts:436-459` `spawnDamageNumber` (fixed 16px, caller color). Sole caller **ArenaScene.ts:2455** (always `"#FFE08A"`; `prev - enemy.hp` in scope). `shakeCam` (2436) + `hitStop` (2416) + `SpriteRig.flash(ms,color)` (SpriteRig.ts:355) already exist.
- **Sketch:** At :2455 compute `dmg = prev - enemy.hp`, pass it. Inside vfx pick fontSize/color by band: `<8`→13px dim amber `#d9b45a`; `8–20`→17px `#FFE08A`; `20–40`→22px `#ffab3b`; `>40`→28px white-hot `#fff2c0` red-stroke. Top band = BIG-HIT: start scale 1.6 → tween to 1.0 over ~120ms Back.easeOut, longer travel (`y-38`), and in the hit branch: `rig.flash(120,0xffffff)`, a white expanding impact ring (reuse `spawnParrySpark` ring at **:2522**, scale 2.6/220ms tinted to band color), and a throttled `shakeCam(60,0.003)` gated to the 420px proximity throttle already used for kill hit-stop at **:1162-1166**. Add ±6px x-jitter at spawn so rapid hits fan out. **Purely cosmetic off a number the client already has — zero balance change.** (Also subsumes the "hit-flash variety" finding's magnitude/branded-tint duration scaling — route `flash(dur,color)` through the same context: `branded>0`→ember `0xff7a4a`, dur by magnitude.)

### A7 — Low-HP red vignette + hurt-flash *(dedup: THREE findings merged into one overlay object)*
- **Files:** `updateHud()` HP ratio at **ArenaScene.ts:2628-2633** (verified). Self-hurt branch at **:2483-2485**. No screen-space overlay exists anywhere. Build the object once in `buildHud()`.
- **Sketch:** One persistent full-screen `scrollFactor(0)` red-edge vignette (Graphics with 4 `fillGradientStyle` edge rects, or a pre-baked RGBA ring texture), depth ~99998 (under HUD text 100000+), start alpha 0. Each frame after `ratio` (:2630): `target = ratio<0.3 ? Clamp((0.3-ratio)/0.3,0,1)*0.5 : 0`, then `v.alpha = Linear(v.alpha, target, 0.15)`; when `ratio<0.25` multiply by heartbeat `(0.75+0.25*sin(now/220))`. On a fresh hurt (hook :2483) punch alpha to ~0.25 and let it lerp back down — **this same object serves the "hurt-flash bloom" finding**, no second object. Hide when downed. Reads HP, changes nothing.
- **Optional add-on (same object, cheap):** the low-HP **audio heartbeat** from the "ambient life" finding — a 55Hz "lub-dub" on an accumulator in `update()` (`deltaMs` at :943) whose period lerps 1100→550ms across the 25%→0% band. Wire only after A1 lands; footstep tick is B-tier (can muddy at horde scale).

### A8 — Lerped bar fills + chip-damage ghost trail
- **Files:** HP width set directly at **ArenaScene.ts:2631** (verified `this.hpBarFill.width = 236*s*ratio`), XP at **:2640**, boss at **:1504**. No `hpShown`/lerp fields exist.
- **Sketch:** Add fields `hpShown,hpGhost,xpShown,bossShown` (init -1). In `updateHud`: `hpShown = Linear(hpShown, ratio, 0.25)`, drive fill width from `hpShown`. Chip trail: one dim-red rect behind `hpBarFill`, snaps up on heal but drains down slow — `hpGhost = Math.max(ratio, Linear(hpGhost, ratio, 0.06))`. Same lerp for XP (satisfying fill on kills) and boss (:1504). First-frame guard: `if (hpShown<0) hpShown=ratio`. Cheap, cosmetic.

### A9 — Scene fade-in on arena entry + menu→arena fade-out
- **Files:** `ArenaScene.create()` camera configured ~**:429** (no `fadeIn` anywhere — grep confirmed). `MenuScene.launch()` **:166-168** (instant `scene.start`).
- **Sketch:** In `create()` after camera setup: `this.cameras.main.fadeIn(420,0,0,0)`. In `launch()`: `this.cameras.main.fadeOut(300,0,0,0); this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('arena',{dimensionId:id}))`. Guard a double-launch flag so key+click doesn't start twice. ~10 lines, every run start feels intentional.

### A10 — flashBanner entrance pop *(dedup: two identical findings merged)*
- **Files:** `flashBanner()` at **ArenaScene.ts:1535-1560** — created at full size, only alpha→0 fade (:1551-1557). Feeds boss approach (:1517), depth/descent (:840), loot reveal (:2509).
- **Sketch:** Before the existing fade, set `setScale(1.25).setAlpha(0)` (or 0.82), entrance-tween to scale 1.0 + alpha 1 over ~180ms Back.easeOut, then chain the current 2200ms fade + a small upward drift (`y-=24`) so it rises as it settles (matches `spawnLevelUp` toast at :2598). Keep the stacking-slot logic (:1540) intact. ~6 lines; lifts every transient banner at once.

---

## GROUP B — WORTH DOING, but larger or needs care
*(build after A; each is real value but heavier surface, more per-frame care, or a correlation/state problem)*

- **B1 — VICTORY/DEFEAT end-cards** (ArenaScene.ts:594-604, :1522-1531, :2744-2755). Reuse `buildLevelShell` dim-overlay pattern (:1606-1640): dim rect + rounded card + title + stat rows from `room.state` (depth, bankedSalvage) + in-card Restart button (same handler as :539). Medium; card *structure* is cosmetic but **copy/wording is C-tier**.
- **B2 — Boss bar upgrade** (built :572-590, driven :1502-1508). Segment ticks (Graphics dividers), hit-flash (cache prev boss.hp, white tint ~80ms + `shakeCam(90,0.004)`), name/slide-in reveal on first-present. Medium, reuses `shakeCam`.
- **B3 — Descent transition rebuild** (:832-844). fadeOut(220) → floor rebuild under cover (:810-826) → fadeIn(320) + optional `zoomTo(*1.06)` landing punch. Overlaps A4/A9; do together but it's the heavier "sell the fall" version. Careful with rebuild ordering.
- **B4 — Kill FX: directional spark fan + kind-tinted poof** (`spawnPoof` :1139, death vector `ax/ay` at :1153). Tint param + 4-5 ADD rects along the launch vector (reuse `spawnBulletImpact` sparks vfx.ts:188-203). Cosmetic, medium.
- **B5 — Kill-streak/combo readout** (kill event :1117-1170, `lastKillStop` :1163). Client-only `killStreak`/`lastKillAt`, reset after ~2500ms lull, corner text ≥3 with heat ramp + pop tween. New client state → medium. (Streak *bonuses* would be C.)
- **B6 — Enemy telegraph/lunge whoosh + incoming-shot cue** (swing `triggerSwing` :1114; projectile tell `k` :2231-2252, latch per-id, clear at :1367; boss windup :1282). Needs per-projectile latch Set → slightly more care. Requires A1.
- **B7 — Ambient dust motes** (floor-renderer.ts:240-260 static only; tick after `renderProjectileTells()` :1051). Pool ~40-60 ADD circles bounded to `cam.worldView`, palette `dustDrift`. High value but a new per-frame system → medium.
- **B8 — Full-screen vignette + per-dimension color grade** (buildHud :480; palette at :820). Distinct from A7's *red danger* vignette — this is an always-on neutral/tinted frame, rebuilt on resize (:432) and dimension change. Coordinate with A7 so they don't stack awkwardly.
- **B9 — Ammo/reload pulse** (updateHud :2652-2658, verified; static red at :2678). Pulse `weaponText` alpha via sine while `charges<=0`, blink last `◆` at charges==1. Small, but lives in the hot HUD path — bundle with A8.
- **B10 — Reloading/spectate & smaller life cues:** restart-button hover/press (:528-539, mirror card pattern :1687), spawn safe-ring breathing tween (floor-renderer.ts:227-232, idiom at :1442-1449), POI wind sway (floor-renderer.ts:96-149 `tall` bucket), pit-edge shimmer (floor-renderer.ts:205-226), DOWNED spectate vignette+tag (:1944-1979 / :2744-2755). All small individually; grouped here as a "second cosmetic sweep."
- **B11 — First-run onboarding toast** (modeText :2733-2740; `flashBanner` :1535). localStorage `dd.seenIntro` → sequenced banners 'WASD · RMB fire · LMB parry' then 'Parry the WHITE ring…'. Cheap, but **exact teaching copy is C-tier** — build the mechanism, let Mike set words. (First-time parry teaching tell, :2226+/:2192, is the larger sibling — B.)
- **B12 — Flesh-hit vs wall bullet-impact variant** (vfx.ts:123-211; reconcile :1294-1361). Needs correlating a projectile removal to a nearby damaged enemy — the fiddliest, lowest value of the set. Ranked last.

---

## GROUP C — OWNER-DECISION (Mike rules; do NOT build)
*(balance / design / style / copy — flagged, not implemented)*

- **C1 — Off-screen threat/enemy chevron** (findings flag `owner_decision:true`; updateEdgeArrow :2295-2345). The *nearest-threat/boss chevron* is cheap, but "which enemies show / does it imply a full minimap" is a design scope call. **Mike: single boss-only chevron, or nearest-close-offscreen, or nothing?**
- **C2 — Menu card hover world-preview flavor** (flagged `owner_decision:true`; MenuScene.ts:124-136). The lift/glow tween is safe cosmetic (could ride B10), but **what dimension flavor text to surface is copy/design** — Mike picks the field + wording.
- **C3 — End-card copy** ("EXTRACTED"/"SQUAD WIPED", stat labels, "carried & lost" framing) — B1's structure is buildable; the words are Mike's.
- **C4 — Gate consequence tags** ('(keeps your N carried)' / '(risk your N carried…)', buildGate :1434-1440 / syncPortal :1458-1481). The at-risk mechanic exists; the greed-loop wording is a design/copy call.
- **C5 — Onboarding / parry-teach copy** (the exact instructional strings for B11 and the parry-teach tell).
- **C6 — Any "crit as real gameplay"** — A6 is explicitly cosmetic-only. If Mike wants the BIG-HIT threshold to be an actual server crit (real damage), that is balance and out of this pass.
- **C7 — Kill-streak *bonuses*** — the B5 readout is cosmetic; granting rewards for streaks is balance/design.
- **C8 — Default audio volume/mute posture** — A5 ships at `vol 0.35, unmuted` as a safe default, but the final loudness/mute-on-first-join stance for a co-op title is Mike's call to confirm.

---

**Build order for this pass:** A1 → A2/A3/A4 (same anchors, one sweep) → A5 → then the visual sweep A6/A7/A8 (all in `updateCombatFx`/`updateHud`, edit together) → A9 → A10. All Group A is no-schema, no-server, no-balance, and shares edit regions, so it lands as one contiguous, low-conflict changeset.
