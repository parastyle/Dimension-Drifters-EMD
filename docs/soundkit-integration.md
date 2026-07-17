# Soundkit integration plan — wiring generated SFX into AudioBus

**Status:** planning doc. Applies AFTER the current feedback-wave work in
`packages/client/src/audio/AudioBus.ts` commits. Nothing here edits existing files yet; the only
shipped code is the standalone `packages/client/src/audio/sample-bank.ts`.

**Ground truth today:** no ElevenLabs key exists, so **zero samples exist**. Every design below
must (and does) degrade to the current synthesis with no errors, no 404 spam, and no audible holes.

---

## 1. The seam

`SampleBank` never imports AudioBus or Phaser. It receives the audio graph through an injected
provider (`SampleBankSource`), so it compiles and runs standalone, and samples route through
AudioBus's master gain — inheriting persisted volume, mute ramps, and any future ducking for free.

### 1.1 Two one-line getters on AudioBus (the only AudioBus edit)

AudioBus creates its `AudioContext` lazily in `resume()` (first user gesture) and keeps `ctx` /
`master` private. Post-commit, expose them read-only:

```ts
// AudioBus.ts — add near the vol/isMuted getters
get context(): AudioContext | null {
  return this.ctx;
}
get masterNode(): AudioNode | null {
  return this.master;
}
```

### 1.2 Composition root (same registry pattern as the shared AudioBus)

Both `MenuScene` and `ArenaScene` currently do
`this.audio = (this.game.registry.get("audio") as AudioBus | undefined) ?? new AudioBus();`.
Wherever the bus is first created, attach the bank:

```ts
import { sampleBank } from "../audio/sample-bank.js";

sampleBank.attach({
  getContext: () => this.audio.context,
  getDestination: () => this.audio.masterNode,
});
void sampleBank.loadManifest(); // fire-and-forget; absent manifest = permanent cheap no-op
```

Optional warm-up for latency-critical cues at ArenaScene `create()`:

```ts
sampleBank.preload(["parry-clang", "player-hurt", "boss-slam-impact"]);
```

### 1.3 Missing-file probing — how and why

- The soundkit generator (authoring manifest: `tools/soundkit/sfx-manifest.json`) **copies the
  manifest to `packages/client/public/audio/sfx/manifest.json` only when it renders mp3s, and only
  lists ids whose files were actually written.** Vite serves `public/` at the site root.
- `SampleBank.loadManifest()` performs **one** fetch of that URL. Today it 404s once (a single
  Network-tab entry, not a console error, not a throw), the bank marks itself `absent`, and every
  subsequent call is an O(1) map miss returning `false`.
- Per-sample mp3 fetches happen **only** for ids the served manifest vouches for, so there is no
  per-file 404 probing ever. Decode is lazy (first request per id), all variations of an id
  together; while decoding, `sampleAvailable()`/`playSample()` return `false` and the synth branch
  covers the gap.
- A fetched JSON was chosen over a generated TS module because importing a not-yet-existing module
  would break `tsc --noEmit` today, and a TS module would bake availability into the bundle —
  dropping new mp3s into `public/` should only require a refresh, not a rebuild.

### 1.4 Fallback guarantee (the contract call sites rely on)

`playSample(id, opts): boolean` — `false` means "I did not make a sound; run your synth."
That covers: manifest absent/loading, id unknown, buffers still decoding, decode failed, no
context yet (pre-gesture), context suspended, voice cap hit, any Web Audio exception.
**One exception:** a `minIntervalMs` suppression returns `true` — the event was handled by
*intentional* silence; falling back to synth there would reintroduce the machine-gun the guard
exists to prevent.

---

## 2. Call-site change shape

All wiring lives **inside `AudioBus.play()`** — it is already the single dispatcher every scene
calls, it already computes `x`/`amt`, and keeping the branch there means zero changes at the ~50
scene call sites.

### 2.1 Pure replacement (the default shape)

At the top of a `case`, before the synth recipe:

```ts
case "hurt": {
  if (this.throttled("hurt", 120)) return;              // AudioBus throttle still gates BOTH paths
  if (
    sampleBank.playSample("player-hurt", {
      volume: 0.5 + 0.4 * amt,
      pan: this.panOf(x),                                // see §2.3
      rate: 0.97 + Math.random() * 0.06,                 // ±3% de-machine-gun jitter
      priority: "critical",
    })
  )
    return;                                              // sample played — skip synth
  this.noise(0.12, { ... });                             // existing synth, byte-identical
  this.tone(200, 0.11, { ... });
  break;
}
```

Equivalently, where a branch decision is needed before computing args, use the predicate form —
`sampleAvailable(id)` returns `true` only when a decoded buffer is ready *right now* (and kicks
the lazy decode as a side effect on first query), so this shape never leaves a silent hole:

```ts
sampleBank.sampleAvailable("loot-chime")
  ? sampleBank.playSample("loot-chime", { volume: 0.5 + 0.5 * amt, rate: 1 + amt * 0.3 })
  : this.blip([660 + amt * 500, 990 + amt * 600, 1320 + amt * 700], 0.08, "sine", 0.22);
```

Note the ordering: **AudioBus's existing per-event throttles run first** and gate both paths, so
sample playback inherits the exact rate-limiting the synth already has.

### 2.2 Generic pre-dispatch for un-special cues

Cues that need no layering, no `amt`-driven params, and no loop lifecycle can go through one
generic gate at the top of `play()`, driven by the manifest's `replaces` field:

```ts
// play(), after the running-state bail, before the switch:
const sid = sampleBank.sampleForCue(event);
if (sid !== null && PURE_REPLACEMENTS.has(event)) {
  if (sampleBank.playSample(sid, { volume: 0.4 + 0.5 * amt, pan: this.panOf(x) })) return;
}
```

`PURE_REPLACEMENTS` is a small `Set<string>` curated in AudioBus (e.g. `grab`, `revive`,
`extract`, `descent`, `fall`, `pitdeath`, `levelup`). Everything with per-cue nuance stays as an
explicit in-case branch (§2.1) or a layer (§3).

### 2.3 Pan helper

`playSample` takes a plain `pan: -1..1` (the bank is camera-agnostic). Add one private helper to
AudioBus so both paths share the same math its `out()` already uses:

```ts
private panOf(x?: number): number | undefined {
  return x === undefined ? undefined : Math.max(-1, Math.min(1, (x - this.camMidX) / this.halfViewW));
}
```

---

## 3. Layering cases (sample + synth together)

Some cues are *better* with the synth kept underneath — the synth carries the transient/sub layer
the compressed mp3 can't. For these, **ignore `playSample`'s return value** and always run the
synth; the sample is garnish, absence of garnish is fine:

| Cue | Layering |
|---|---|
| `parry` | Sample metal **clang** (`priority: "critical"`) layered OVER the existing 1400/2100 Hz sine pair. The sines are the skill-beat's pitch identity — never remove them. |
| `bossslam` | Sample debris/impact texture over the existing 60→30 Hz sine sub-boom. The synth sub is what the screen-shake sits on; the sample adds the "real" body. |
| `beam:overheat` | Sample steam-vent hiss over the existing square-wave groan (both at the same `critical`-when-`amt≥0.75` priority). |
| `beam:ignite` | Sample crack layered over synth; synth alone remains the fallback. |

```ts
case "parry":
  // Layer: fire-and-forget, result deliberately unused — synth ALWAYS plays.
  sampleBank.playSample("parry-clang", { volume: 0.7 + 0.3 * amt, priority: "critical" });
  this.tone(1400, 0.18, { type: "sine", gain: 0.3 + 0.12 * amt, priority: "critical" });
  this.tone(2100, 0.16, { type: "sine", gain: 0.18 + 0.08 * amt, delay: 0.005, priority: "critical" });
  break;
```

Voice budgets stay independent: the synth pair claims from AudioBus's 24-voice pool, the sample
from SampleBank's own 12-voice pool (tiered low ≤ 6 / normal ≤ 9 / critical ≤ 12), so layering
cannot starve either side.

---

## 4. Sustain loops (beam sustain, Serraketh underground rumble)

Manifest entries with `loop: true` are **not** played via `playSample` — they use
`startLoop(id, opts): SampleLoopHandle | null`. `null` ⇒ keep the existing pulsed-synth sustain
(`beam:sustain` case) exactly as-is.

### 4.1 Beam sustain (per-owner, `ownerId`-keyed)

AudioBus already receives beam phase edges (`beam:ignite` / `beam:sustain` / `beam:release` /
`beam:overheat`) with a stable `opts.ownerId`. Hold handles in a bounded map beside the existing
`beamSustainAt` table:

```ts
private readonly beamLoops = new Map<string, SampleLoopHandle>();

case "beam:ignite": {
  // ...ignite one-shot (sample or synth)...
  const key = opts.ownerId ?? "solo";
  if (!this.beamLoops.has(key) && this.beamLoops.size < 16) {
    const h = sampleBank.startLoop("beam-sustain-loop", {
      volume: 0.25 + 0.5 * amt,
      pan: this.panOf(x),
      fadeInSec: 0.06,
    });
    if (h) this.beamLoops.set(key, h);
  }
  break;
}
case "beam:sustain": {
  const h = this.beamLoops.get(opts.ownerId ?? "solo");
  if (h?.alive) {
    h.setVolume(0.25 + 0.5 * amt);   // track intensity WITHOUT restarting
    return;                          // loop is carrying the sustain — skip the pulsed synth
  }
  // no loop (no sample / cap) → existing throttled pulse path, unchanged
  if (this.beamSustainThrottled(opts.ownerId, amt >= 0.55 ? 120 : 220)) return;
  // ...existing tone/noise pulses...
  break;
}
case "beam:release":
case "beam:overheat": {
  this.beamLoops.get(opts.ownerId ?? "solo")?.stop(0.1);
  this.beamLoops.delete(opts.ownerId ?? "solo");
  // ...existing release/overheat one-shots (sample-or-synth per §2/§3)...
  break;
}
```

The map is bounded (16, matching `beamSustainAt`'s bound) so a malicious/buggy owner stream cannot
grow it; `stop()` is idempotent, so double release/overheat edges are safe.

### 4.2 Serraketh underground rumble

Driven by boss phase edges the scene already consumes. Same handle pattern, held by ArenaScene's
boss-audio glue (or a `bossRumble: SampleLoopHandle | null` field in AudioBus keyed off dedicated
`boss:rumble:start` / `boss:rumble:stop` events — pick whichever side owns Serraketh phase state
after the waves commit):

- start on underground-phase enter (`fadeInSec: 0.4` — it should well up, not pop in),
- `setVolume` with proximity/phase intensity if the scene has it,
- `stop(0.5)` on surface/phase-exit **and** on boss death.

### 4.3 Teardown — the non-negotiable

Loops outlive frames by design, so scene lifecycle must sweep them:

```ts
// ArenaScene create():
this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => sampleBank.stopAllLoops(0.05));
this.events.once(Phaser.Scenes.Events.DESTROY, () => sampleBank.stopAllLoops(0.02));
```

Plus AudioBus-side hygiene in the same pass: clear `beamLoops` wherever `beamSustainAt` is reset
(the context `onstatechange` re-baseline). `stopAllLoops` is a blanket net — per-owner `stop()`
remains the primary path so one player's beam ending never cuts another's.

Suspend/resume: `SampleBank` self-heals like AudioBus — on a context that left and re-entered
`running`, stranded one-shots are flushed. Live loops survive suspension natively and are kept.

---

## 5. Variations on rapid-fire cues without machine-gunning

Three stacked mechanisms:

1. **AudioBus throttles stay in front.** `shot:*` (30–45 ms), `hit` (25 ms), `melee:*` (34–55 ms),
   `xpTick` (65 ms) already rate-limit the event before either path runs. Unchanged.
2. **Round-robin is automatic.** The bank cycles `<id>-v1..vN.mp3` per id, so consecutive shots
   never repeat a buffer (generate `variations: 3–4` for `shot:*`, `hit`, `melee:*`).
3. **Per-id `minIntervalMs` + rate jitter** for cues whose AudioBus throttle is deliberately loose:

```ts
sampleBank.playSample("shot-slug", {
  volume: 0.55,
  pan: this.panOf(x),
  rate: 0.96 + Math.random() * 0.08,   // ±4% pitch scatter — kills the "same file" comb effect
  minIntervalMs: 30,                    // returns true (handled-silent) inside the window
});
```

Remember §1.4: a `minIntervalMs` suppression returns `true` so the caller must NOT fall through to
synth — matching AudioBus's own `throttled() → return` behavior.

---

## 6. Volume normalization

Generated mp3s arrive unnormalized (ElevenLabs loudness varies per prompt). Strategy:

1. **Per-entry linear trim table** — `GAIN_TRIM` in `sample-bank.ts`, default `1`, applied under
   the caller's `volume` (`effective = volume × trim`, clamped ≤ 2).
2. **Tuning pass** once files land: A/B each sample against its synth counterpart at the default
   master volume (0.35) in-game; set trims so the sample sits at the same perceived level.
3. **Rule:** trims stay ≤ ~1.5. A sample needing more gets **regenerated hotter** — boosting a
   quiet lossy encode amplifies its noise floor.
4. Optional generator-side assist: the soundkit tool can run ffmpeg `loudnorm` to −16 LUFS before
   copying into `public/`, making most trims ≈ 1 and the table a fine-adjust, not a rescue.
   (Trim table stays regardless — perceived loudness vs. synth still needs per-cue taste.)

Master volume/mute/ducking need no per-sample handling: everything routes through AudioBus's
master gain via the seam.

---

## 7. Test plan

### 7.1 Unit (vitest, jsdom/happy-dom, mocked `fetch` + stub AudioContext)

`packages/client/src/audio/sample-bank.test.ts`:

- **Absent world (today's default):** `fetch` → 404. `loadManifest()` resolves; `sampleAvailable`
  / `playSample` / `startLoop` all return `false`/`null`; **zero throws, zero console output**;
  only ONE fetch total no matter how many calls follow.
- **No context:** manifest present, `getContext() → null` (pre-gesture) ⇒ `playSample` false;
  after context appears, decode proceeds (the pre-context slot is released for retry).
- **Availability lifecycle:** manifest lists `foo` (variations 3) ⇒ first `sampleAvailable("foo")`
  is `false` and triggers exactly 3 file fetches; after decode resolves it flips `true`.
- **Round-robin:** 4 plays of a 3-variation id start buffers in order v1, v2, v3, v1.
- **`minIntervalMs`:** two immediate calls ⇒ first `true` (played), second `true` (suppressed) with
  only one source started; after advancing the mock clock past the window, plays again.
- **Voice cap tiers:** fill 6 voices ⇒ `low` refused, `normal` ok; fill 9 ⇒ `normal` refused,
  `critical` ok; fill 12 ⇒ everything refused, all returning `false` (fallback), never throwing.
- **Loops:** `startLoop` on a `loop: true` entry returns a live handle; `stop()` twice is safe;
  `stopAllLoops()` empties the set; a stopped loop releases its voice slot.
- **Suspend self-heal:** stub state `running → suspended → running` with stranded one-shots ⇒
  pool flushes, `playSample` succeeds again.
- **Malformed manifest:** non-array JSON, entries missing `id` ⇒ skipped quietly, state `absent`
  when nothing valid remains.

### 7.2 Integration (after the AudioBus wiring lands)

- **No-key smoke (the critical one):** run the game with no `public/audio/sfx/` at all. Full
  session — shots, melee, beams, parry, boss slam, level-up, extract. Expect byte-identical synth
  behavior, zero console errors, exactly one manifest 404 in the Network tab.
- **Fixture kit:** drop 3–4 hand-made mp3s + a matching `manifest.json` into `public/audio/sfx/`
  (no ElevenLabs needed). Verify: replacement cues switch to samples, layered cues play both,
  missing-from-fixture cues still synth, variations audibly rotate.
- **Loop lifecycle:** hold a beam through release, overheat, owner disconnect, and scene restart
  (return to menu → re-enter arena) — no loop survives any exit path (assert `stopAllLoops` fired
  via a debug counter or WebAudio inspector).
- **Tab suspend:** hide the tab mid-firefight, return — audio (both paths) recovers without a
  click, no voice-pool pin on either pool.
- **Volume/mute:** master slider and mute affect samples and synth identically (shared master gain).

### 7.3 CI

- `npx tsc -p packages/client/tsconfig.json --noEmit` (already green with `sample-bank.ts`).
- `sample-bank.test.ts` joins the existing vitest run; it needs no network, no real audio, no key.
