# Hit-Confirm Audio — the "tsk-tsk-tsk" layer

**Panel:** hit-effects · **Role:** hit-confirm audio designer
**Directive:** "make hit effects satisfying including all our senses… including sounds similar to the tsktsktsktsk you get when landing hits in CoD."

This document specifies the **player-centric hit-confirm layer**: the dry, rapid, UI-space tick that tells *you* — and only you — that *your* damage landed. It is a separate layer from the world-space impact sound the enemy makes (`hit` / `impact-flesh` / `impact-armor` etc., which stay panned, material-flavored, and audible to everyone nearby). Confirms are receipts, not physics. They are read off the authoritative combat-receipt ring and never synthesized from client-side guesses.

Everything here is a spec. No source files are modified by this document.

---

## 1. What the confirm layer is (and is not)

| | World impact layer (exists) | Confirm layer (this spec) |
|---|---|---|
| Answers | "something got hit over there" | "**I** hit. It counted." |
| Space | world — panned by target x via `out(x)` | UI — **center/mono, no pan** |
| Timbre | wet/meaty/clangy, material-flavored | dry, high-transient, click-like, material-agnostic |
| Audience | everyone in earshot | **owner only** |
| Trigger | client combat FX (HP drops, VFX events) | `CombatReceiptState` rows where `sourcePlayerId === myId` |
| Length | 60–400 ms with tails | **30–60 ms, zero tail** |

The CoD "tsktsktsk" works because it is *boring on purpose*: a near-identical, ultra-short, dry click that repeats at the weapon's hit rate. The information is carried by **rate and rhythm**, not by the sound's richness. Repetition is the message. So the base tick must be short enough to never overlap itself at realistic hit rates, and plain enough to survive a thousand repetitions per run without fatigue.

### Trigger source

`packages/shared/src/state.ts` — `CombatReceiptState` (the fixed ring on `ArenaState.combatReceipts`, consumed in `ArenaScene` around line 6946):

- `sourcePlayerId` → the co-op ownership gate (§7)
- `crit`, `finalBlow` → the ladder rungs (§4)
- `delivery` (`CombatDelivery` in `packages/shared/src/combat.ts`: Melee/Gun/Cast/Thrown/Beam/Quake/Chain/Parry/Scatter) → Beam gets special cadence law (§8); Parry receipts produce **no confirm** (the parry clang already owns that beat at critical priority — a tick under it is clutter)
- `damage` → subtle gain scaling only, never pitch (§4, "pitch is semantics")
- `seq` dedupe and `seq=0` skip exactly as the receipt ring contract requires

The per-receipt decision logic (rapid-fire law, ladder selection, beam cadence) lives in the **receipt consumer** (a small stateful "confirm director" beside the existing receipt handling in ArenaScene), not inside AudioBus. AudioBus keeps what it already owns: recipes, throttle backstops, voice caps. The scene fires intent; the bus enforces limits — same division of labor as every existing cue.

---

## 2. The tick itself — two authored forms

### 2a. Synthesis recipe (ships now, AudioBus idiom)

New `play()` cases. All are **center-mono: no `x` is ever passed**, so `out()` returns the master directly — zero panner nodes, and the confirm can never wander with the camera. Worst-case node cost per tick is 2 sources ≤ 60 ms, so even the ratchet ceiling (§3) holds ~2–4 live voices.

```ts
// ── hit-confirm layer: OWNER-ONLY, UI-space (never pass x — confirms are mono/center). ──
case "confirm:hit": // the tsk — dry high-transient click, ~35 ms, zero tail
  if (this.throttled("confirmHit", 40)) return; // backstop; director enforces 45 ms law
  this.noise(0.024, { gain: 0.07 + 0.05 * amt, type: "highpass", freq: 4200, q: 1.2, priority: "low" });
  this.tone(2350, 0.032, { type: "square", gain: 0.045 + 0.03 * amt, sweepTo: 1900, priority: "low" });
  break;
case "confirm:armor": // mitigation tink — glassy, higher, slightly ringy: "it landed but got eaten"
  if (this.throttled("confirmArmor", 60)) return;
  this.noise(0.03, { gain: 0.06 + 0.04 * amt, type: "bandpass", freq: 5200, q: 6, priority: "low" });
  this.tone(3400, 0.05, { type: "triangle", gain: 0.04 + 0.03 * amt, sweepTo: 3250, priority: "low" });
  break;
case "confirm:crit": // crit ping — bright, chirps UP, clearly above the tsk
  if (this.throttled("confirmCrit", 70)) return;
  this.tone(2900, 0.055, { type: "sine", gain: 0.11 + 0.07 * amt, sweepTo: 3800, priority: "normal" });
  this.noise(0.02, { gain: 0.05, type: "highpass", freq: 6000, q: 1, priority: "normal" });
  break;
case "confirm:kill": // kill thock — low, woody, resolves DOWN; amt = kill-streak rung 0..1 (§4)
  if (this.throttled("confirmKill", 70)) return;
  this.tone(950 + 260 * amt, 0.06, { type: "triangle", gain: 0.14, sweepTo: 520, priority: "normal" });
  this.tone(140, 0.05, { type: "sine", gain: 0.09, sweepTo: 90, priority: "normal" });
  break;
case "confirm:ratchet": // granular stream mode (§3); amt = stream density 0..1
  if (this.throttled("confirmRatchet", 48)) return; // backstop just under the 55 ms train
  this.noise(0.02, { gain: 0.05 + 0.05 * amt, type: "highpass", freq: 4200 + 1200 * amt, q: 1.2, priority: "low" });
  this.tone(2350 * (1 + 0.12 * amt), 0.026, { type: "square", gain: 0.035 + 0.03 * amt, sweepTo: 1900, priority: "low" });
  break;
```

Recipe rationale:

- **Highpass noise at ~4 kHz + a 30 ms square blip at ~2.3 kHz sweeping down** is the closest two-node approximation of the CoD marker: a woodblock-adjacent "tsk" with an airy top. The downward micro-sweep keeps it percussive rather than beepy.
- The existing `tone()` envelope (6 ms exponential attack → exponential decay over `dur`) is already ideal for clicks; no primitive changes needed.
- `amt` on `confirm:hit` carries **normalized damage** (this hit ÷ the weapon's expected per-hit, clamped 0..1). It moves gain by at most ~±35% and never pitch — magnitude is loudness; *meaning* is pitch (§4).
- Gains are deliberately small (peak ~0.14): the confirm layer is felt as texture, not as an event. It should disappear the instant you stop hitting.

### 2b. ElevenLabs manifest entries (for later; new `confirm` category)

To be appended to `tools/soundkit/sfx-manifest.json` when the pipeline runs. All `replaces` point at the **new** cues above (they are brand-new events, not replacements of existing world sounds). ElevenLabs tends to over-produce ultra-short sounds — prompts insist on dryness, and the integration pass should hard-trim to the target duration and kill any generated reverb tail.

```json
{
  "id": "confirm-tick",
  "category": "confirm",
  "priority": 1,
  "prompt": "Single tiny dry hit-marker tick, like a fingernail tap on hollow hardwood mixed with a soft high click, extremely short, completely dry, no reverb, no ring, no tail, no tonal note, no music.",
  "durationSeconds": 0.08,
  "loop": false,
  "variations": 4,
  "replaces": "confirm:hit",
  "notes": "THE tsk. The single most-repeated sound in the game (up to ~22/s discrete, then ratchet mode). 4 variations, tonally identical — variation exists only to de-machine-gun, never to add character. Engine adds 0.97..1.03 playbackRate jitter. Mono/center, never panned. Trim hard to <=80 ms; the transient is everything."
},
{
  "id": "confirm-armor-tink",
  "category": "confirm",
  "priority": 2,
  "prompt": "Tiny glassy metallic tink, like a fingernail flick on a thin porcelain cup, single very short bright ping with an instantly damped micro-ring, dry, no reverb, no tail, no music.",
  "durationSeconds": 0.1,
  "loop": false,
  "variations": 3,
  "replaces": "confirm:armor",
  "notes": "Mitigated/armored hit confirm — reads 'landed, but eaten'. Must sit clearly above confirm-tick in pitch and feel thinner, never more rewarding."
},
{
  "id": "confirm-crit-ping",
  "category": "confirm",
  "priority": 1,
  "prompt": "Small bright crystalline ping that chirps quickly upward in pitch, a crisp glassy marker blip rising like a tiny question resolved, very short, dry, minimal shimmer, no reverb tail, no melody, no music.",
  "durationSeconds": 0.12,
  "loop": false,
  "variations": 2,
  "replaces": "confirm:crit",
  "notes": "The crit rung: pitch rises = quality of hit. Louder than confirm-tick, still small next to parry-clang. Punches through ratchet mode as a discrete event."
},
{
  "id": "confirm-kill-thock",
  "category": "confirm",
  "priority": 1,
  "prompt": "Single satisfying low woody thock, like a heavy wooden mallet tapping a solid block once, deep dry knock with a tiny sub thump underneath, falls in pitch, instant stop, no ring, no reverb, no music.",
  "durationSeconds": 0.12,
  "loop": false,
  "variations": 3,
  "replaces": "confirm:kill",
  "notes": "The finality rung: pitch falls = it's over. Engine playbackRate-steps takes upward per kill-streak rung within 1 s (1.0/1.12/1.26/1.41, cap 4). Layered under (not replacing) the world-space kill-confirm-small/medium/large the enemy emits."
},
{
  "id": "confirm-ratchet-grain",
  "category": "confirm",
  "priority": 2,
  "prompt": "Very short dry granular tick, a single grain of a ratchet wheel click, tighter and smaller than a full tap, papery-crisp transient only, completely dry, no tail, no music.",
  "durationSeconds": 0.06,
  "loop": false,
  "variations": 3,
  "replaces": "confirm:ratchet",
  "notes": "Stream mode grain (>= ~14 hits/s). Fired on a fixed 55 ms train regardless of true hit rate; density maps to gain + slight rate rise. Must read as 'texture of many' next to confirm-tick's 'one'."
}
```

`GAIN_TRIM` seeds (tuned by ear once files land): `confirm-tick: 0.7`, `confirm-armor-tink: 0.6`, `confirm-crit-ping: 0.9`, `confirm-kill-thock: 1.0`, `confirm-ratchet-grain: 0.55`. All samples play with `pan: undefined` (center) and `priority` per the tier table in §6.

---

## 3. The rapid-fire law — discrete ticks, then the ratchet

This is how CoD and Destiny keep streams readable: below a rate ceiling every hit is its own marker (the rhythm *is* the weapon's identity — you can hear your fire rate in the confirms); above it, per-hit playback would smear into white noise, so the stream is **compressed into a fixed-rate granular ratchet whose intensity, not rate, carries the information**. Destiny's multi-hit weapons do exactly this: the tick train locks to a comfortable cadence and density rides gain/pitch.

Exact law (all state lives in the confirm director; AudioBus throttles are backstops only):

1. **Discrete regime.** Each owned receipt fires `confirm:hit` (or its ladder variant) with a **45 ms minimum interval** (≈22 Hz ceiling). Two hits 50 ms apart play as two ticks — the double-tap must stay audible; nail-gun-class weapons (35 ms shot throttle) land right at this edge and read as a fast tsk-tsk-tsk, which is the directive verbatim.
2. **Stream detection.** Rolling 300 ms window over owned, non-beam receipts. **≥ 5 receipts in the window (≈14+ Hz sustained) → enter ratchet mode.** One-frame multi-hits (a pellet fan hitting 6 targets on one tick) do *not* qualify by themselves: a single-tick burst collapses to **one tick with amt boosted by the count** (burst = one louder tsk, not a chord) unless the window was already hot.
3. **Ratchet regime.** Stop per-receipt playback. Fire `confirm:ratchet` on a **fixed 55 ms train (≈18 Hz)** while receipts keep arriving. Map `amt = clamp01((receiptsInWindow − 5) / 10)` — density rides gain (+~6 dB across the range) and a small pitch rise (~+2 semitones at max). The player hears "more" as *hotter*, not *faster*.
4. **Ladder punch-through.** `crit` and `finalBlow` receipts are **never absorbed into the ratchet**: they always fire their discrete `confirm:crit` / `confirm:kill` on top of (momentarily replacing the next grain of) the train, with their own 70 ms throttles. In a bullet-hose stream, crits and kills are exactly the events that must stay countable.
5. **Exit.** Window drops below 3 receipts for 250 ms → leave ratchet mode; the next receipt is discrete again. No exit sting — the texture just stops, which is itself the "target dead / you're missing" read.

Melee note: melee receipts arrive well under the ceiling and always stay discrete; the confirm rides ~1 frame after the world-space impact, which reads as one fused "crunch-tsk" — correct and desirable (the tsk is the receipt of the crunch).

---

## 4. The semantic ladder — pitch/timbre laddering

One axis, learnable in a single run: **pitch up = hit quality; pitch down + weight = finality; thin/metallic = mitigation.** Damage magnitude only moves gain. Pitch is reserved for *meaning* so the ladder never lies.

| Rung | Cue | Center pitch | Contour | Character | Trigger |
|---|---|---|---|---|---|
| Mitigated | `confirm:armor` | ~3.4 kHz | flat, micro-ring | thin, glassy tink | receipt vs armored band (armorQ/kind gate; wiring detail for implementation) |
| **Body (the tsk)** | `confirm:hit` | ~2.3 kHz | tiny down-sweep | dry woodblock click | every ordinary owned receipt |
| Crit | `confirm:crit` | 2.9→3.8 kHz | **chirps up** | bright sine ping | `receipt.crit` |
| Kill | `confirm:kill` | ~950 Hz → 520 | **falls, sub tap** | woody thock | `receipt.finalBlow` |

- **Kill-streak rung:** kills within a rolling 1 s window step `amt` 0 → 1/3 → 2/3 → 1 (pitch base 950→1210 Hz, cap 4 rungs, resets after 1 s of no kills). A mowing streak becomes a rising thock-thock-thock-thock — the closest audio analog of a killfeed, at zero extra vocabulary.
- **Crit + kill on one receipt:** play `confirm:kill` only. Finality outranks quality; two stacked stingers on one event is mud.
- **Ordering vs world layer:** the enemy's world-space death sound (`death` / future `kill-confirm-*`) still plays, panned, for everyone. The owner additionally gets the thock, center. They are pitched apart (thock ~950 Hz vs the death pop's noise body) precisely so they fuse rather than phase.

---

## 5. Stereo placement — confirms are UI

All confirm cues are **mono/center**: no `x` in synth calls, no `pan` in sample calls. Rationale: the confirm answers "did *my* input count", which is a property of the player, not of the world — the same reason CoD draws the hitmarker at the crosshair, not on the enemy. Center placement also keeps confirms trivially distinguishable from the panned world impacts even when timbres are similar, and it survives the camera whipping around a dodge without artifacts. The world impact layer keeps carrying all spatial information; the two layers triangulate: *where* (panned impact) + *that it counted* (center tick).

---

## 6. Mix priority — where confirms sit in the voice economy

AudioBus tiers (MAX_VOICES = 24): low ≤ 16, normal ≤ 20, critical ≤ 24. SampleBank mirrors at 6/9/12.

| Cue | Tier | Why |
|---|---|---|
| `confirm:hit`, `confirm:armor`, `confirm:ratchet` | **low** | The most numerous sounds in the game. Under horde pressure they shed first — correct: losing a tsk under a boss slam costs nothing, and the ratchet's fixed train self-heals on the next grain. |
| `confirm:crit`, `confirm:kill` | **normal** | Countable reward beats; may displace ambience-grade cues but must **never** touch the critical headroom. |
| — never — | critical | The reserved headroom belongs to parry, hurt, boss, beam:redline, overheat. Confirms are texture; rule/skill cues are law. |

Loudness staging (confirms duck under nothing and duck nothing — they win by *spectral placement*, not volume): the 2.3–4 kHz confirm band sits above the impact layer's meat (≤1.4 kHz) and below the parry clang's bell (1.4/2.1 kHz fundamentals but at critical priority and 3–6× the gain). Peak recipe gains (0.045–0.14) keep the whole layer well under `parry` (0.30+), `hurt` (0.16+), and `beam:redline` (0.10+ at 1 kHz, critical). The parry-glint (`parry-glint-cue`, a quiet subconscious timing aid) is protected by pitch distance (glint shimmer lives ≥6 kHz, authored soft) and by the confirm layer's zero tail — a 30 ms click cannot mask a 300 ms shimmer window. If tuning ever proves otherwise, the fix is dropping confirm gain, never raising glint gain.

---

## 7. Co-op law — you hear only your own

- Confirm cues fire **iff `receipt.sourcePlayerId === mySessionId`**. No exceptions — not for teammate crits, not for teammate kills, not for the final blow on a boss you softened to 1 HP.
- Teammates' hits remain audible **only** through the world-space impact/death layer, panned at the enemy's position. That layer is the shared truth; the confirm layer is a private channel.
- Rationale: in 4-player horde play the combined receipt rate trivially exceeds 40–60 Hz. Sharing confirms would (a) pin the ratchet at max density permanently, destroying its information content, and (b) break the ownership signal — the entire point of a hit-confirm is *your* input → *your* tick. CoD and Destiny are both strictly owner-only for the same reason.
- Spectate/death-cam: while dead and spectating a teammate, the confirm layer is **silent** (their receipts are not yours). The world layer carries the action.

---

## 8. Beams — confirms ride the pulse, not the tick rate

Per the tick-curtain finding (docs/improve2-panel/polish.md §9): beam damage flushes at a 50–250 ms per-descriptor cadence, and per-flush hit sounds turn a wide sweep into a curtain of chatter that spends the feedback budget meant for ignition/redline/kills. The confirm layer must not re-create that bug one layer up.

Law for `delivery === CombatDelivery.Beam` receipts:

- Beam receipts are **excluded from both the discrete regime and the stream window** (they never trip the ratchet).
- Instead, one soft `confirm:hit` (amt low, ~0.3) fires on a **fixed 260 ms pulse per owned beam** while at least one beam receipt arrived in the last pulse period — aligned with the same ~220–300 ms cadence the polish finding prescribes for the rolling damage number, so the number updates and the tick land as one fused pulse. Sweeping through 8 enemies vs 1 enemy changes the pulse's amt (target count, clamp01(n/6)), not its rate.
- `crit` quanta and `finalBlow` receipts inside a beam **do** fire their discrete ladder cues (70 ms throttles as usual) — kills inside the beam stay countable pops against the steady pulse, exactly the choreography the finding asks for.
- The beam's own sustain audio (`beam:sustain` pulses now; `beam-sustain-loop` sample later) is the *weapon voice*; the 260 ms confirm pulse is the *receipt voice*. Cadence-locking them is what makes "I am holding damage on something" feel continuous instead of chattering.

---

## 9. Settings surface

- **`dd.audio.confirmVol`** (0..1.5, default 1.0): a dedicated "Hit confirm volume" slider in audio settings, applied as a gain multiplier inside the confirm recipes (and as `volume` on confirm sample calls), persisted via the same try/catch localStorage idiom as `dd.audio.vol`. Not a separate GainNode bus — AudioBus's single-master architecture stays intact; a multiplier at the recipe layer is sufficient and free.
- Why separate from SFX master: confirm fatigue is real and personal. Some players find constant ticks stressful and want 30%; the CoD-trained want 130%. Coupling it to master SFX forces choosing between hearing telegraphs and tolerating ticks — a bad trade in a co-op game where telegraphs are survival.
- Range top is 1.5, not higher: at extreme gain the confirm layer would start masking the parry-glint band; the cap is a mix-integrity guard.
- **No separate on/off toggle** — 0 on the slider is off. One control, one concept.
- Future accessibility note (out of scope, worth recording): the confirm director's events are exactly the right tap point for a haptics/controller-rumble confirm and for a visual hit-marker — one receipt-driven director feeding three senses.

---

## 10. Acceptance checklist (for the implementing session)

1. Pistol at 3 Hz: three clean discrete tsks, center, no pan drift while circling a target.
2. Nailgun sustained on a pack: discrete ticks up to ~14 Hz, then an audibly *steadier* 18 Hz ratchet whose loudness rises with targets hit; release trigger → texture stops within 250 ms.
3. One crit inside the ratchet: an unmistakable up-chirp ping punches through without pausing the train.
4. Four kills in a second: four thocks stepping upward in pitch, then reset.
5. Teammate mowing a horde beside you while you idle: zero confirm-layer sound; their impacts stay panned world-space.
6. Wide beam across 8 enemies: a calm 260 ms pulse (not 8 curtains), kills popping discretely inside it.
7. Parry during a full ratchet stream: the clang is untouched (critical tier), and the glint cue before it remains audible.
8. Mute confirm slider to 0 mid-fight: world impacts remain; nothing else changes.
