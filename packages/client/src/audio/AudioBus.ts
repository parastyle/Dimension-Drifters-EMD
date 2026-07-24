/**
 * §19 v0.108 PROCEDURAL AUDIO — a tiny Web Audio synth the whole game plays through. Zero assets: every
 * sound is generated live from oscillators + a shared noise buffer, so there's nothing to download, load,
 * or license, and the bundle doesn't grow. The game was 100% silent; this is the "feels shipped" layer.
 *
 * Design:
 * - ONE lazily-created `AudioContext`, `resume()`d on the first user gesture (autoplay policy). If the
 *   browser has no Web Audio (or it throws), every method is a safe no-op — the game just stays silent.
 * - A master `GainNode` carries the persisted volume × mute; changes ramp (no clicks).
 * - `play(event, opts)` is the ONLY thing the scene calls. It dispatches to a per-event synth recipe,
 *   throttles high-frequency events (a horde AoE can't machine-gun a node storm), caps concurrent voices,
 *   and pans by world-x relative to the camera centre so a kill on your left is heard on your left.
 * - Volume/mute persist to localStorage; conservative default (0.35, unmuted) — co-op, don't blast a join.
 */

import { loadSettings, updateSettings } from "../settings.js";
import { type PlaySampleOpts, type SampleLoopHandle, sampleBank } from "./sample-bank.js";

const LS_VOL = "dd.audio.vol";
const LS_MUTED = "dd.audio.muted";

/** Optional per-sound modifiers. `x` (world px) pans; `amt` (0..1) scales gain/pitch for magnitude cues. */
export interface PlayOpts {
  x?: number;
  amt?: number;
  /** Stable beam owner for per-channel sustain throttling (bounded to the room-sized voice table). */
  ownerId?: string;
}

type Ctx = AudioContext;
type VoicePriority = "low" | "normal" | "critical";
type BossScoreState = "off" | "entrance" | "phase1" | "phase2" | "phase3" | "final" | "death";

export class AudioBus {
  private ctx: Ctx | null = null;
  private master: GainNode | null = null;
  /** Non-spatial titan bed: four voices maximum, behind the shared SFX priority/voice cap. */
  private bossMusicGain: GainNode | null = null;
  private bossScoreState: BossScoreState = "off";
  private bossPulseAt = 0;
  private bossMusicVoices = 0;
  private noiseBuf: AudioBuffer | null = null;
  private failed = false;
  private volume: number;
  private muted: boolean;
  private confirmVolume: number;
  /** Live voice count (bounded so a burst can't spawn hundreds of nodes). */
  private voices = 0;
  private static readonly MAX_VOICES = 24;
  /** Camera world-centre X, refreshed each frame — the pan reference. */
  private camMidX = 0;
  private halfViewW = 960;
  /** Last play time (ctx seconds) per throttle key, to rate-limit spammy events. */
  private readonly lastAt = new Map<string, number>();
  private readonly beamSustainAt = new Map<string, number>();
  /**
   * §50 soundkit — sample sustain loops (integration doc §4). One handle per beam owner (bounded to
   * 16, matching `beamSustainAt`) plus the Serraketh rumble. `lastFedMs` is a WALL-CLOCK keepalive:
   * the emitting streams (`beam:sustain` fires every frame while a beam is held; `boss:rumble:start`
   * likewise while the worm is burrowed) refresh it, and the watchdog below reaps any loop whose
   * stream went quiet — lost release edge, owner disconnect, scene swap, tab hide — so no loop can
   * outlive its cause. (ArenaScene never shuts down, so scene-lifecycle hooks could not carry this.)
   */
  private readonly beamLoops = new Map<string, { handle: SampleLoopHandle; lastFedMs: number }>();
  private bossRumble: { handle: SampleLoopHandle; lastFedMs: number } | null = null;
  private loopWatchdog: ReturnType<typeof setInterval> | null = null;
  private static readonly BEAM_LOOP_STALE_MS = 400;
  private static readonly RUMBLE_STALE_MS = 1500;
  /**
   * §50 soundkit — cues routed through the generic sample-first gate at the top of `play()`
   * (integration doc §2.2): no layering, no amt-driven params, no loop lifecycle, no throttle.
   * Everything with per-cue nuance keeps an explicit in-case branch instead.
   */
  private static readonly PURE_REPLACEMENTS: ReadonlySet<string> = new Set([
    "grab",
    "revive",
    "extract",
    "descent",
    "fall",
    "pitdeath",
    "levelup",
  ]);

  constructor() {
    let v = 0.35;
    let m = false;
    const confirmVolume = loadSettings().feedback.confirmVolume ?? 1;
    try {
      const rawV = localStorage.getItem(LS_VOL);
      if (rawV !== null) v = Math.max(0, Math.min(1, Number.parseFloat(rawV) || 0));
      m = localStorage.getItem(LS_MUTED) === "1";
    } catch {
      /* localStorage can throw in private mode — fall back to defaults */
    }
    this.volume = v;
    this.muted = m;
    this.confirmVolume = confirmVolume;
    // §50 soundkit seam (integration doc §1.2): AudioBus construction IS the composition root (the
    // scenes share one instance via the game registry), so attach the sample bank to this bus's
    // audio graph here and probe for the served manifest ONCE. With zero samples shipped (today)
    // the fetch 404s quietly, the bank marks itself "absent", and every sample branch below is a
    // permanent cheap no-op — the synth recipes run byte-identical.
    sampleBank.attach({
      getContext: () => this.context,
      getDestination: () => this.masterNode,
    });
    void sampleBank.loadManifest();
  }

  /** Create + resume the AudioContext. MUST be called from within a user-gesture handler (click/keydown)
   *  the first time, per the browser autoplay policy. Cheap + idempotent after that. */
  resume(): void {
    if (this.failed) return;
    if (!this.ctx) {
      try {
        const Ctor: typeof AudioContext | undefined =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) {
          this.failed = true;
          return;
        }
        const ctx = new Ctor();
        const master = ctx.createGain();
        master.connect(ctx.destination);
        const bossMusicGain = ctx.createGain();
        bossMusicGain.gain.value =
          this.bossScoreState === "off" || this.bossScoreState === "death" ? 0.0001 : 0.15;
        bossMusicGain.connect(master);
        // Self-heal: if the context ever suspends (mobile tab-hide / OS audio-focus loss) the scheduled
        // sources' `ended` events don't fire on the frozen clock, so `voices` could pin at the cap. Re-baseline
        // it (and the throttle map) whenever the context returns to running (adversarial-verify finding).
        ctx.onstatechange = () => {
          if (ctx.state === "running") {
            this.voices = 0;
            this.bossMusicVoices = 0;
            this.lastAt.clear();
            this.beamSustainAt.clear();
            // §50 soundkit hygiene (doc §4.3): beam state is unknown after a suspend, so stop +
            // clear the loop table with the same re-baseline. If the beam is still held, the live
            // `beam:sustain` stream restarts its loop within a frame.
            for (const l of this.beamLoops.values()) l.handle.stop(0.05);
            this.beamLoops.clear();
          }
        };
        // Auto-resume when the tab becomes visible again, so audio recovers WITHOUT needing a fresh click.
        try {
          document.addEventListener("visibilitychange", () => {
            if (!document.hidden) this.resume();
          });
        } catch {
          /* no document (SSR/test) — ignore */
        }
        // One reusable 1-second white-noise buffer (every noise burst reads a slice of it).
        const len = Math.max(1, Math.floor(ctx.sampleRate));
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
        this.ctx = ctx;
        this.master = master;
        this.bossMusicGain = bossMusicGain;
        this.noiseBuf = buf;
        this.applyGain(0);
        // §50 soundkit optional warm-up (doc §1.2): now that a context exists, pre-decode the
        // latency-critical cues. With the manifest absent (today) this is a no-op.
        sampleBank.preload([
          "parry-clang",
          "player-hurt",
          "impact-flesh",
          "confirm-tick",
          "confirm-armor-tink",
          "confirm-crit-ping",
          "confirm-kill-thock",
          "confirm-ratchet-grain",
          "player-jump",
          "player-land",
          "player-dodge",
          "player-roll-whoosh",
          "boss-slam-generic",
          "ultimate-ready-chime",
        ]);
      } catch {
        this.failed = true;
        return;
      }
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  /** Refresh the pan reference (call once per frame from the render loop). */
  setListener(midX: number, halfViewW: number): void {
    this.camMidX = midX;
    this.halfViewW = Math.max(1, halfViewW);
  }

  get vol(): number {
    return this.volume;
  }
  get isMuted(): boolean {
    return this.muted;
  }
  get confirmVol(): number {
    return this.confirmVolume;
  }
  /** §50 soundkit seam (doc §1.1) — read-only context for the sample bank; null pre-gesture. */
  get context(): AudioContext | null {
    return this.ctx;
  }
  /** §50 soundkit seam (doc §1.1) — the master gain, so samples inherit volume/mute/ducking. */
  get masterNode(): AudioNode | null {
    return this.master;
  }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    try {
      localStorage.setItem(LS_VOL, this.volume.toFixed(3));
    } catch {
      /* ignore */
    }
    this.applyGain();
  }

  setConfirmVolume(v: number, persist = true): void {
    this.confirmVolume = Math.max(0, Math.min(1.5, v));
    if (persist) updateSettings({ feedback: { confirmVolume: this.confirmVolume } });
  }

  /** Feed the authored titan score state once per frame. Pulses are AudioBus-owned and never spatialized. */
  setBossScore(state: BossScoreState): void {
    const ctx = this.ctx;
    const gain = this.bossMusicGain;
    const changed = state !== this.bossScoreState;
    this.bossScoreState = state;
    if (!ctx || !gain || ctx.state !== "running") return;
    if (changed) {
      gain.gain.cancelScheduledValues(ctx.currentTime);
      gain.gain.setTargetAtTime(
        state === "off" || state === "death" ? 0.0001 : 0.15,
        ctx.currentTime,
        0.08,
      );
      this.bossPulseAt = ctx.currentTime + (state === "final" ? 0.6 : 0);
    }
    if (state === "off" || state === "death" || ctx.currentTime < this.bossPulseAt) return;

    if (state === "entrance") {
      this.musicTone(48, 0.86, "sine", 0.34, 31);
      this.bossPulseAt = ctx.currentTime + 1.2;
    } else if (state === "phase1") {
      this.musicTone(55, 0.28, "sine", 0.28, 42);
      this.musicTone(330, 0.055, "triangle", 0.08, 280, 0.75);
      this.bossPulseAt = ctx.currentTime + 1;
    } else if (state === "phase2") {
      this.musicTone(58, 0.25, "sine", 0.28, 44);
      this.bossPulseAt = ctx.currentTime + 0.75;
    } else if (state === "phase3") {
      this.musicTone(58, 0.25, "sine", 0.26, 44);
      this.musicTone(120, 0.13, "triangle", 0.13, 82, 0.375);
      this.musicTone(87, 0.3, "sine", 0.08, 82, 0.375);
      this.bossPulseAt = ctx.currentTime + 0.75;
    } else {
      // Final Tread's real contacts remain the percussion; this is only a restrained post-breath floor.
      this.musicTone(52, 0.22, "sine", 0.2, 38);
      this.bossPulseAt = ctx.currentTime + 0.75;
    }
  }

  /** Brief authored bed duck; combat/reward SFX stay on the unducked master path. */
  duckBossScore(db: number, durationSeconds: number): void {
    const ctx = this.ctx;
    const gain = this.bossMusicGain;
    if (!ctx || !gain) return;
    const base = this.bossScoreState === "off" || this.bossScoreState === "death" ? 0.0001 : 0.15;
    const ducked = Math.max(0.0001, base * 10 ** (-Math.max(0, db) / 20));
    gain.gain.cancelScheduledValues(ctx.currentTime);
    gain.gain.setTargetAtTime(ducked, ctx.currentTime, 0.025);
    gain.gain.setTargetAtTime(base, ctx.currentTime + Math.max(0.05, durationSeconds), 0.1);
  }

  /** Toggle mute; returns the new muted state. */
  toggleMute(): boolean {
    this.muted = !this.muted;
    try {
      localStorage.setItem(LS_MUTED, this.muted ? "1" : "0");
    } catch {
      /* ignore */
    }
    this.applyGain();
    return this.muted;
  }

  private applyGain(ramp = 0.03): void {
    if (!this.ctx || !this.master) return;
    const g = this.muted ? 0.0001 : Math.max(0.0001, this.volume);
    this.master.gain.setTargetAtTime(g, this.ctx.currentTime, ramp);
  }

  // ── synth primitives ────────────────────────────────────────────────────────────────────────────

  /** A panned output node feeding the master (StereoPanner where supported, else straight through). */
  private out(x?: number): AudioNode {
    if (!this.ctx || !this.master) return this.master as unknown as AudioNode;
    if (x === undefined || typeof this.ctx.createStereoPanner !== "function") return this.master;
    const p = this.ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, (x - this.camMidX) / this.halfViewW));
    p.connect(this.master);
    return p;
  }

  /** Reserve headroom for rule/skill cues. Reward ticks stop at 16 voices, ordinary cues at 20, while
   *  parry/hurt/boss/owner-overheat may use the complete bounded pool. */
  private claim(node: AudioScheduledSourceNode, priority: VoicePriority): boolean {
    const limit =
      priority === "critical"
        ? AudioBus.MAX_VOICES
        : priority === "normal"
          ? AudioBus.MAX_VOICES - 4
          : AudioBus.MAX_VOICES - 8;
    if (this.voices >= limit) return false;
    this.voices++;
    node.addEventListener("ended", () => {
      this.voices = Math.max(0, this.voices - 1);
    });
    return true;
  }

  /** An oscillator tone with an exponential ADSR + optional pitch sweep. */
  private tone(
    freq: number,
    dur: number,
    o: {
      type?: OscillatorType;
      gain?: number;
      sweepTo?: number;
      x?: number;
      delay?: number;
      priority?: VoicePriority;
      destination?: AudioNode;
    } = {},
  ): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t0 = ctx.currentTime + (o.delay ?? 0);
    const osc = ctx.createOscillator();
    if (!this.claim(osc, o.priority ?? "normal")) return;
    osc.type = o.type ?? "sine";
    osc.frequency.setValueAtTime(freq, t0);
    if (o.sweepTo && o.sweepTo > 0) osc.frequency.exponentialRampToValueAtTime(o.sweepTo, t0 + dur);
    const g = ctx.createGain();
    const peak = Math.max(0.0002, o.gain ?? 0.3);
    g.gain.setValueAtTime(0.0002, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0002, t0 + dur);
    osc.connect(g).connect(o.destination ?? this.out(o.x));
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  private musicTone(
    freq: number,
    dur: number,
    type: OscillatorType,
    gain: number,
    sweepTo: number,
    delay = 0,
  ): void {
    const ctx = this.ctx;
    const destination = this.bossMusicGain;
    if (!ctx || !destination || this.bossMusicVoices >= 4) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    if (!this.claim(osc, "low")) return;
    this.bossMusicVoices++;
    osc.addEventListener("ended", () => {
      this.bossMusicVoices = Math.max(0, this.bossMusicVoices - 1);
    });
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, sweepTo), t0 + dur);
    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(0.0002, t0);
    envelope.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + 0.012);
    envelope.gain.exponentialRampToValueAtTime(0.0002, t0 + dur);
    osc.connect(envelope).connect(destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  /** A filtered noise burst (the "air" of hits/shots/whooshes). */
  private noise(
    dur: number,
    o: {
      gain?: number;
      type?: BiquadFilterType;
      freq?: number;
      q?: number;
      sweepTo?: number;
      x?: number;
      priority?: VoicePriority;
    } = {},
  ): void {
    const ctx = this.ctx;
    if (!ctx || !this.noiseBuf) return;
    const t0 = ctx.currentTime;
    const src = ctx.createBufferSource();
    if (!this.claim(src, o.priority ?? "normal")) return;
    src.buffer = this.noiseBuf;
    src.playbackRate.value = 1;
    const filt = ctx.createBiquadFilter();
    filt.type = o.type ?? "bandpass";
    filt.frequency.setValueAtTime(Math.max(40, o.freq ?? 800), t0);
    if (o.sweepTo && o.sweepTo > 0)
      filt.frequency.exponentialRampToValueAtTime(o.sweepTo, t0 + dur);
    filt.Q.value = o.q ?? 1;
    const g = ctx.createGain();
    const peak = Math.max(0.0002, o.gain ?? 0.25);
    g.gain.setValueAtTime(peak, t0);
    g.gain.exponentialRampToValueAtTime(0.0002, t0 + dur);
    src.connect(filt).connect(g).connect(this.out(o.x));
    src.start(t0, Math.random() * 0.5, dur + 0.02);
  }

  /** True if `key` fired within `minMs` — used to rate-limit high-frequency events. */
  private throttled(key: string, minMs: number): boolean {
    const ctx = this.ctx;
    if (!ctx) return true;
    const now = ctx.currentTime;
    const last = this.lastAt.get(key) ?? -1;
    if (now - last < minMs / 1000) return true;
    this.lastAt.set(key, now);
    return false;
  }

  private beamSustainThrottled(ownerId: string | undefined, minMs: number): boolean {
    if (!ownerId) return this.throttled("beamSustain", minMs);
    const ctx = this.ctx;
    if (!ctx) return true;
    const last = this.beamSustainAt.get(ownerId) ?? -1;
    if (ctx.currentTime - last < minMs / 1000) return true;
    if (!this.beamSustainAt.has(ownerId) && this.beamSustainAt.size >= 16)
      this.beamSustainAt.clear();
    this.beamSustainAt.set(ownerId, ctx.currentTime);
    return false;
  }

  // ── §50 soundkit sample path (docs/soundkit-integration.md) ─────────────────────────────────────
  // Every helper below is a guaranteed no-op while zero samples exist (today): the bank's manifest
  // probe 404s once, `sampleForCue` returns null, `playSample`/`startLoop` return false/null, and
  // every call site falls through to the synth recipe unchanged.

  /** Doc §2.3 — the same world-x → pan math `out()` uses, shared by the sample path. */
  private panOf(x?: number): number | undefined {
    return x === undefined
      ? undefined
      : Math.max(-1, Math.min(1, (x - this.camMidX) / this.halfViewW));
  }

  /** Doc §2.1 sample-first shape: resolve the cue via the manifest's `replaces` mapping and try the
   *  sample. `false` ⇒ "I made no sound; run your synth" (the ONE exception: a `minIntervalMs`
   *  suppression returns true — handled by intentional silence, so the synth must NOT run). */
  private sampleFirst(cue: string, opts: PlaySampleOpts): boolean {
    const sid = sampleBank.sampleForCue(cue);
    return sid !== null && sampleBank.playSample(sid, opts);
  }

  /** Doc §4.1 — start the per-owner beam sustain loop (idempotent per key, bounded like
   *  `beamSustainAt`). Returns false ⇒ keep the existing pulsed-synth sustain. */
  private startBeamLoop(ownerId: string | undefined, amt: number, x?: number): boolean {
    const key = ownerId ?? "solo";
    if (this.beamLoops.has(key) || this.beamLoops.size >= 16) return false;
    const sid = sampleBank.sampleForCue("beam:sustain");
    if (sid === null) return false;
    const h = sampleBank.startLoop(sid, {
      volume: 0.25 + 0.5 * amt,
      pan: this.panOf(x),
      fadeInSec: 0.06,
    });
    if (!h) return false;
    this.beamLoops.set(key, { handle: h, lastFedMs: Date.now() });
    this.armLoopWatchdog();
    return true;
  }

  /** Doc §4.1 — per-owner loop stop on the release/overheat edges. Idempotent (`stop()` is safe
   *  twice, missing key is a no-op), so double edges cost nothing. */
  private stopBeamLoop(ownerId: string | undefined, fadeOutSec = 0.1): void {
    const key = ownerId ?? "solo";
    this.beamLoops.get(key)?.handle.stop(fadeOutSec);
    this.beamLoops.delete(key);
  }

  /** Doc §4.3 teardown sweep, AudioBus-side: a lightweight interval (armed only while loops are
   *  live, disarmed when none remain) that reaps any loop whose keepalive stream went quiet. This
   *  IS the blanket net — ArenaScene never shuts down, so `SHUTDOWN`/`DESTROY` hooks can't be the
   *  sweep; wall-clock staleness catches every exit path instead (release edge lost, owner
   *  disconnect, mute, scene swap, tab hide). */
  private armLoopWatchdog(): void {
    if (this.loopWatchdog !== null) return;
    this.loopWatchdog = setInterval(() => this.sweepStaleLoops(), 250);
  }

  private sweepStaleLoops(): void {
    const now = Date.now();
    for (const [key, l] of this.beamLoops) {
      if (!l.handle.alive || now - l.lastFedMs > AudioBus.BEAM_LOOP_STALE_MS) {
        l.handle.stop(0.1);
        this.beamLoops.delete(key);
      }
    }
    if (
      this.bossRumble &&
      (!this.bossRumble.handle.alive || now - this.bossRumble.lastFedMs > AudioBus.RUMBLE_STALE_MS)
    ) {
      this.bossRumble.handle.stop(0.5);
      this.bossRumble = null;
    }
    if (this.beamLoops.size === 0 && this.bossRumble === null && this.loopWatchdog !== null) {
      clearInterval(this.loopWatchdog);
      this.loopWatchdog = null;
    }
  }

  // ── the one public dispatcher ────────────────────────────────────────────────────────────────────

  /** Play a game event. Unknown events are silently ignored. Safe to call every frame — all rate-limits
   *  and the voice cap live in here, so the scene just fires intent. */
  play(event: string, opts: PlayOpts = {}): void {
    // Also bail while the context is NOT running (suspended tab): scheduling on a frozen clock would
    // accumulate `voices` against `ended` events that never fire, silently pinning + muting audio.
    if (this.failed || !this.ctx || this.ctx.state !== "running" || this.muted || this.volume <= 0)
      return;
    const x = opts.x;
    const amt = Math.max(0, Math.min(1, opts.amt ?? 0.5));
    const confirmGain = event.startsWith("confirm:") ? this.confirmVolume : 1;
    if (confirmGain <= 0) return;
    // §50 generic sample-first gate (doc §2.2) for un-special cues: no layering, no amt nuance, no
    // loop lifecycle. Manifest absent (today) ⇒ `sampleFirst` is false ⇒ the switch runs unchanged.
    if (
      AudioBus.PURE_REPLACEMENTS.has(event) &&
      this.sampleFirst(event, { volume: 0.4 + 0.5 * amt, pan: this.panOf(x) })
    )
      return;
    switch (event) {
      // Owner-only UI-space hit markers. No world x is passed to either path, keeping them center-mono.
      // The cue ids are manifest-ready; absent samples fall through to these synthesis defaults.
      case "confirm:hit":
        if (this.throttled("confirmTick", 40)) return;
        if (
          this.sampleFirst("confirm:hit", {
            volume: Math.min(1, (0.42 + 0.25 * amt) * confirmGain),
            rate: 0.97 + Math.random() * 0.06,
            priority: "low",
            minIntervalMs: 40,
          })
        )
          return;
        this.noise(0.024, {
          gain: (0.07 + 0.05 * amt) * confirmGain,
          type: "highpass",
          freq: 4200,
          q: 1.2,
          priority: "low",
        });
        this.tone(2350, 0.035, {
          type: "square",
          gain: (0.045 + 0.03 * amt) * confirmGain,
          sweepTo: 1900,
          priority: "low",
        });
        break;
      case "confirm:armor":
        if (this.throttled("confirmArmor", 60)) return;
        if (
          this.sampleFirst("confirm:armor", {
            volume: Math.min(1, (0.36 + 0.22 * amt) * confirmGain),
            priority: "low",
            minIntervalMs: 60,
          })
        )
          return;
        this.noise(0.03, {
          gain: (0.06 + 0.04 * amt) * confirmGain,
          type: "bandpass",
          freq: 5200,
          q: 6,
          priority: "low",
        });
        this.tone(3400, 0.05, {
          type: "triangle",
          gain: (0.04 + 0.03 * amt) * confirmGain,
          sweepTo: 3250,
          priority: "low",
        });
        break;
      case "confirm:ratchet":
        if (this.throttled("confirmRatchet", 48)) return;
        if (
          this.sampleFirst("confirm:ratchet", {
            volume: Math.min(1, (0.3 + 0.32 * amt) * confirmGain),
            priority: "low",
            minIntervalMs: 48,
          })
        )
          return;
        // Density changes gain only. Pitch remains fixed so intensity cannot impersonate semantics.
        this.noise(0.02, {
          gain: (0.05 + 0.05 * amt) * confirmGain,
          type: "highpass",
          freq: 4200,
          q: 1.2,
          priority: "low",
        });
        this.tone(2350, 0.026, {
          type: "square",
          gain: (0.035 + 0.03 * amt) * confirmGain,
          sweepTo: 1900,
          priority: "low",
        });
        break;
      case "confirm:crit":
        if (this.throttled("confirmCrit", 70)) return;
        if (
          this.sampleFirst("confirm:crit", {
            volume: Math.min(1, (0.55 + 0.3 * amt) * confirmGain),
            priority: "normal",
            minIntervalMs: 70,
          })
        )
          return;
        this.tone(2900, 0.055, {
          type: "sine",
          gain: (0.11 + 0.07 * amt) * confirmGain,
          sweepTo: 3800,
          priority: "normal",
        });
        this.noise(0.02, {
          gain: 0.05 * confirmGain,
          type: "highpass",
          freq: 6000,
          q: 1,
          priority: "normal",
        });
        break;
      case "confirm:kill":
        if (this.throttled("confirmKill", 70)) return;
        if (
          this.sampleFirst("confirm:kill", {
            volume: Math.min(1, 0.72 * confirmGain),
            rate: 1 + amt * 0.41,
            priority: "normal",
            minIntervalMs: 70,
          })
        )
          return;
        // amt is the semantic one-second kill-streak rung, not damage magnitude.
        this.tone(950 + 260 * amt, 0.06, {
          type: "triangle",
          gain: 0.14 * confirmGain,
          sweepTo: 520,
          priority: "normal",
        });
        this.tone(140, 0.05, {
          type: "sine",
          gain: 0.09 * confirmGain,
          sweepTo: 90,
          priority: "normal",
        });
        break;
      // High-frequency combat — per gun bulletKind (mirrors the GUN_FX visual split).
      case "wacky:wet-slap":
        if (this.throttled("wackyWetSlap", 55)) return;
        this.noise(0.085, { gain: 0.28, type: "bandpass", freq: 850, q: 0.8, x });
        this.tone(190, 0.08, { type: "sine", gain: 0.18, sweepTo: 105, x });
        break;
      case "wacky:squeak-hit":
        if (this.throttled("wackySqueak", 85)) return;
        this.tone(1180, 0.13, { type: "square", gain: 0.2, sweepTo: 1680, x });
        this.tone(760, 0.1, { type: "triangle", gain: 0.12, sweepTo: 1080, x });
        break;
      case "wacky:confetti-shot":
        if (this.throttled("shot", 65)) return;
        this.noise(0.18, { gain: 0.52, type: "lowpass", freq: 1250, q: 0.7, x });
        this.tone(105, 0.14, { type: "sine", gain: 0.38, sweepTo: 48, x });
        this.noise(0.055, { gain: 0.16, type: "highpass", freq: 3800, q: 1.4, x });
        break;
      case "shot:slug":
        if (this.throttled("shot", 30)) return;
        // Sample-first (doc §2.1/§5): AudioBus's throttle above gates BOTH paths; rate jitter +
        // round-robin variations de-machine-gun the sample. false ⇒ synth below, byte-identical.
        if (
          this.sampleFirst("shot:slug", {
            volume: 0.55,
            pan: this.panOf(x),
            rate: 0.96 + Math.random() * 0.08,
            minIntervalMs: 30,
          })
        )
          return;
        this.noise(0.09, { gain: 0.32, type: "bandpass", freq: 700, q: 1.2, x });
        this.tone(150, 0.11, { type: "sine", gain: 0.3, sweepTo: 60, x });
        break;
      case "shot:pellet":
        if (this.throttled("shot", 40)) return;
        if (
          this.sampleFirst("shot:pellet", {
            volume: 0.6,
            pan: this.panOf(x),
            rate: 0.96 + Math.random() * 0.08,
            minIntervalMs: 40,
          })
        )
          return;
        this.noise(0.13, { gain: 0.4, type: "lowpass", freq: 1400, q: 0.7, x });
        break;
      case "shot:tracer":
        if (this.throttled("shot", 45)) return;
        if (
          this.sampleFirst("shot:tracer", {
            volume: 0.28,
            pan: this.panOf(x),
            rate: 0.96 + Math.random() * 0.08,
            minIntervalMs: 45,
          })
        )
          return;
        this.noise(0.04, { gain: 0.16, type: "bandpass", freq: 1700, q: 2, x });
        break;
      case "shot:nail":
        if (this.throttled("shot", 35)) return;
        if (
          this.sampleFirst("shot:nail", {
            volume: 0.32,
            pan: this.panOf(x),
            rate: 0.96 + Math.random() * 0.08,
            minIntervalMs: 35,
          })
        )
          return;
        this.noise(0.05, { gain: 0.2, type: "highpass", freq: 2000, q: 1, x });
        break;
      case "shot:ricochet":
        if (this.throttled("shot", 35)) return;
        if (
          this.sampleFirst("shot:ricochet", {
            volume: 0.35,
            pan: this.panOf(x),
            rate: 0.96 + Math.random() * 0.08,
            minIntervalMs: 35,
          })
        )
          return;
        this.noise(0.06, { gain: 0.18, type: "bandpass", freq: 1100, q: 3, x });
        this.tone(900, 0.08, { type: "sine", gain: 0.16, sweepTo: 1600, x });
        break;
      case "shot:spark":
        if (this.throttled("shot", 38)) return;
        this.noise(0.055, { gain: 0.17, type: "highpass", freq: 2400, q: 2.4, x });
        this.tone(1320, 0.07, { type: "square", gain: 0.12, sweepTo: 620, x });
        this.tone(2360, 0.035, { type: "triangle", gain: 0.08, sweepTo: 1680, x });
        break;
      case "hit": // melee/bullet landing on an enemy
        if (this.throttled("hit", 25)) return;
        // Highest-frequency sound in the game — 4 manifest variations + jitter fight fatigue.
        if (
          this.sampleFirst("hit", {
            volume: 0.3 + 0.35 * amt,
            pan: this.panOf(x),
            rate: 0.96 + Math.random() * 0.08,
            minIntervalMs: 25,
          })
        )
          return;
        this.tone(180, 0.06, { type: "triangle", gain: 0.12 + 0.18 * amt, sweepTo: 90, x });
        this.noise(0.045, { gain: 0.1 + 0.12 * amt, type: "lowpass", freq: 1200, x });
        break;
      case "bighit": // a crushing blow (magnitude cue)
        if (this.throttled("bighit", 60)) return;
        if (
          this.sampleFirst("bighit", {
            volume: 0.5 + 0.4 * amt,
            pan: this.panOf(x),
            rate: 0.97 + Math.random() * 0.06,
          })
        )
          return;
        this.tone(120, 0.14, { type: "square", gain: 0.34, sweepTo: 55, x });
        this.noise(0.09, { gain: 0.28, type: "lowpass", freq: 900, x });
        break;
      // Accepted non-gun source/whiff vocabulary. Target/material impact remains a separate hit layer.
      case "melee:light":
        if (this.throttled(amt >= 0.75 ? "meleeLightSelf" : "meleeLight", 34)) return;
        // Sample-first for every melee family: same shape — throttle above gates both paths, amt
        // maps to gain only (manifest note: takes are tonally identical), jitter kills combing.
        if (
          this.sampleFirst("melee:light", {
            volume: 0.3 + 0.3 * amt,
            pan: this.panOf(x),
            rate: 0.96 + Math.random() * 0.08,
            minIntervalMs: 34,
          })
        )
          return;
        this.noise(0.1, {
          gain: 0.12 + 0.13 * amt,
          type: "bandpass",
          freq: 1450,
          q: 1.5,
          sweepTo: 760,
          x,
        });
        break;
      case "melee:claw":
        if (this.throttled(amt >= 0.75 ? "meleeClawSelf" : "meleeClaw", 34)) return;
        if (
          this.sampleFirst("melee:claw", {
            volume: 0.3 + 0.3 * amt,
            pan: this.panOf(x),
            rate: 0.96 + Math.random() * 0.08,
            minIntervalMs: 34,
          })
        )
          return;
        this.noise(0.085, {
          gain: 0.13 + 0.14 * amt,
          type: "highpass",
          freq: 1750,
          q: 1.8,
          sweepTo: 3100,
          x,
        });
        break;
      case "kungfu:iron-clang":
        if (this.throttled("kungFuIronClang", 110)) return;
        if (
          this.sampleFirst("parry-clang", {
            volume: 0.55 + 0.25 * amt,
            pan: this.panOf(x),
            rate: 0.94 + Math.random() * 0.08,
            minIntervalMs: 110,
            priority: "normal",
          })
        )
          return;
        this.noise(0.075, {
          gain: 0.18 + 0.14 * amt,
          type: "highpass",
          freq: 2_600,
          q: 1.4,
          sweepTo: 1_100,
          x,
        });
        this.tone(740, 0.09, {
          type: "square",
          gain: 0.1 + 0.08 * amt,
          sweepTo: 510,
          x,
        });
        this.tone(1_280, 0.055, {
          type: "triangle",
          gain: 0.07 + 0.05 * amt,
          sweepTo: 920,
          x,
        });
        break;
      case "b11:fire-dragon-sweep":
        if (this.throttled(amt >= 0.75 ? "b11DragonSelf" : "b11Dragon", 95)) return;
        this.noise(0.28, {
          gain: 0.18 + 0.18 * amt,
          type: "lowpass",
          freq: 760,
          q: 0.7,
          sweepTo: 170,
          x,
        });
        this.noise(0.16, {
          gain: 0.08 + 0.1 * amt,
          type: "bandpass",
          freq: 1_850,
          q: 1.2,
          sweepTo: 720,
          x,
        });
        this.tone(86, 0.3, {
          type: "sawtooth",
          gain: 0.08 + 0.11 * amt,
          sweepTo: 43,
          x,
        });
        break;
      case "b11:crystal-crack-hum":
        if (this.throttled(amt >= 0.75 ? "b11CrystalSelf" : "b11Crystal", 65)) return;
        this.noise(0.075, {
          gain: 0.12 + 0.14 * amt,
          type: "highpass",
          freq: 3_400,
          q: 2.2,
          sweepTo: 6_200,
          x,
        });
        this.tone(920, 0.18, {
          type: "triangle",
          gain: 0.07 + 0.08 * amt,
          sweepTo: 610,
          x,
        });
        this.tone(310, 0.26, {
          type: "sine",
          gain: 0.05 + 0.07 * amt,
          sweepTo: 370,
          x,
        });
        break;
      case "b11:arcane-lance-cast":
        if (this.throttled(amt >= 0.75 ? "b11LanceSelf" : "b11Lance", 45)) return;
        this.tone(240, 0.17, {
          type: "sawtooth",
          gain: 0.07 + 0.09 * amt,
          sweepTo: 1_080,
          x,
        });
        this.tone(680, 0.2, {
          type: "triangle",
          gain: 0.055 + 0.075 * amt,
          sweepTo: 1_360,
          x,
        });
        this.noise(0.11, {
          gain: 0.055 + 0.07 * amt,
          type: "bandpass",
          freq: 1_700,
          q: 3.4,
          sweepTo: 3_100,
          x,
        });
        break;
      case "b18:iron-gale-whoosh":
        if (this.throttled(amt >= 0.75 ? "b18IronGaleSelf" : "b18IronGale", 70)) return;
        this.noise(0.2, {
          gain: 0.13 + 0.15 * amt,
          type: "bandpass",
          freq: 2_100,
          q: 1.4,
          sweepTo: 620,
          x,
        });
        this.tone(510, 0.11, {
          type: "triangle",
          gain: 0.055 + 0.065 * amt,
          sweepTo: 270,
          x,
        });
        this.tone(1_120, 0.055, {
          type: "square",
          gain: 0.035 + 0.04 * amt,
          sweepTo: 760,
          x,
        });
        break;
      case "b18:ember-fire-roar":
        if (this.throttled(amt >= 0.75 ? "b18EmberRoarSelf" : "b18EmberRoar", 75)) return;
        this.noise(0.27, {
          gain: 0.17 + 0.17 * amt,
          type: "lowpass",
          freq: 980,
          q: 0.8,
          sweepTo: 230,
          x,
        });
        this.noise(0.13, {
          gain: 0.08 + 0.09 * amt,
          type: "bandpass",
          freq: 2_400,
          q: 1.7,
          sweepTo: 1_050,
          x,
        });
        this.tone(105, 0.28, {
          type: "sawtooth",
          gain: 0.065 + 0.085 * amt,
          sweepTo: 54,
          x,
        });
        break;
      case "b18:storm-thunder-crack":
        if (this.throttled(amt >= 0.75 ? "b18StormCrackSelf" : "b18StormCrack", 65)) return;
        this.noise(0.055, {
          gain: 0.2 + 0.2 * amt,
          type: "highpass",
          freq: 3_200,
          q: 1.1,
          sweepTo: 6_800,
          x,
        });
        this.noise(0.18, {
          gain: 0.11 + 0.12 * amt,
          type: "bandpass",
          freq: 1_450,
          q: 2.4,
          sweepTo: 420,
          x,
        });
        this.tone(72, 0.22, {
          type: "square",
          gain: 0.09 + 0.11 * amt,
          sweepTo: 38,
          x,
        });
        break;
      case "melee:heavy":
        if (this.throttled(amt >= 0.75 ? "meleeHeavySelf" : "meleeHeavy", 55)) return;
        if (
          this.sampleFirst("melee:heavy", {
            volume: 0.4 + 0.3 * amt,
            pan: this.panOf(x),
            rate: 0.97 + Math.random() * 0.06,
            minIntervalMs: 55,
          })
        )
          return;
        this.noise(0.16, {
          gain: 0.18 + 0.18 * amt,
          type: "lowpass",
          freq: 1050,
          sweepTo: 260,
          x,
        });
        this.tone(105, 0.15, {
          type: "sine",
          gain: 0.1 + 0.13 * amt,
          sweepTo: 58,
          x,
        });
        break;
      case "melee:crossfall":
        if (this.throttled(amt >= 0.75 ? "crossfallSelf" : "crossfall", 90)) return;
        if (
          this.sampleFirst("melee:crossfall", {
            volume: 0.5 + 0.35 * amt,
            pan: this.panOf(x),
            rate: 0.96 + Math.random() * 0.05,
            minIntervalMs: 90,
          })
        )
          return;
        this.noise(0.19, {
          gain: 0.2 + 0.18 * amt,
          type: "bandpass",
          freq: 1_250,
          q: 1.1,
          sweepTo: 310,
          x,
        });
        this.tone(94, 0.2, {
          type: "triangle",
          gain: 0.12 + 0.14 * amt,
          sweepTo: 48,
          x,
        });
        break;
      case "melee:blunt":
        if (this.throttled(amt >= 0.75 ? "meleeBluntSelf" : "meleeBlunt", 55)) return;
        if (
          this.sampleFirst("melee:blunt", {
            volume: 0.4 + 0.3 * amt,
            pan: this.panOf(x),
            rate: 0.97 + Math.random() * 0.06,
            minIntervalMs: 55,
          })
        )
          return;
        this.noise(0.14, {
          gain: 0.16 + 0.16 * amt,
          type: "bandpass",
          freq: 420,
          q: 0.8,
          sweepTo: 150,
          x,
        });
        this.tone(82, 0.17, {
          type: "triangle",
          gain: 0.11 + 0.12 * amt,
          sweepTo: 45,
          x,
        });
        break;
      case "melee:arcane":
        if (this.throttled(amt >= 0.75 ? "meleeArcaneSelf" : "meleeArcane", 45)) return;
        if (
          this.sampleFirst("melee:arcane", {
            volume: 0.3 + 0.3 * amt,
            pan: this.panOf(x),
            rate: 0.96 + Math.random() * 0.08,
            minIntervalMs: 45,
          })
        )
          return;
        this.tone(330 + amt * 130, 0.14, {
          type: "triangle",
          gain: 0.1 + 0.12 * amt,
          sweepTo: 780 + amt * 220,
          x,
        });
        this.noise(0.1, {
          gain: 0.07 + 0.08 * amt,
          type: "bandpass",
          freq: 1250,
          q: 3,
          x,
        });
        break;
      // Beam lifecycle. Sustain is a bounded, throttled pressure pulse; phase edges remain distinct.
      case "beam:charge":
        // Sample-first. The charge cue fires every frame of the windup (no AudioBus throttle — the
        // retriggered 0.24s synth IS the texture), but the 0.9s sample must not restack per frame:
        // `minIntervalMs` makes repeat calls inside the window "handled by intentional silence"
        // (returns true ⇒ skip synth), which is exactly the one-sample-carries-the-rise behavior.
        if (
          this.sampleFirst("beam:charge", {
            volume: 0.15 + 0.35 * amt,
            pan: this.panOf(x),
            rate: 0.9 + 0.2 * amt,
            minIntervalMs: 700,
          })
        )
          return;
        this.tone(150 + amt * 80, 0.24, {
          type: "sawtooth",
          gain: 0.045 + 0.085 * amt,
          sweepTo: 410 + amt * 220,
          x,
        });
        this.noise(0.18, {
          gain: 0.025 + 0.055 * amt,
          type: "bandpass",
          freq: 720,
          q: 3.5,
          sweepTo: 1850,
          x,
        });
        break;
      case "beam:ignite":
        // Layer (doc §3): the sample crack rides OVER the synth — result deliberately unused, the
        // synth ALWAYS plays and alone remains the fallback.
        this.sampleFirst("beam:ignite", { volume: 0.4 + 0.4 * amt, pan: this.panOf(x) });
        // Doc §4.1: the ignite edge also starts the per-owner sustain loop (no-op without samples).
        this.startBeamLoop(opts.ownerId, amt, x);
        this.noise(0.09, {
          gain: 0.12 + 0.2 * amt,
          type: "highpass",
          freq: 1700,
          q: 1.6,
          x,
        });
        this.tone(260 + amt * 120, 0.12, {
          type: "square",
          gain: 0.08 + 0.14 * amt,
          sweepTo: 95,
          x,
        });
        break;
      case "beam:sustain": {
        // Doc §4.1: when a sample loop is carrying this owner's sustain, retarget its gain WITHOUT
        // restarting and feed the keepalive — the pulsed synth is skipped while the loop lives.
        const live = this.beamLoops.get(opts.ownerId ?? "solo");
        if (live?.handle.alive) {
          live.lastFedMs = Date.now();
          live.handle.setVolume(0.25 + 0.5 * amt);
          return;
        }
        if (live) this.beamLoops.delete(opts.ownerId ?? "solo"); // dead handle hygiene
        // Not looping (no sample decoded yet / voice cap / no files — today): try a mid-beam start
        // (covers decode finishing after ignite), else the throttled pulse path runs unchanged.
        if (this.startBeamLoop(opts.ownerId, amt, x)) return;
        if (this.beamSustainThrottled(opts.ownerId, amt >= 0.55 ? 120 : 220)) return;
        this.tone(92 + amt * 105, 0.11, {
          type: "sawtooth",
          gain: 0.025 + 0.055 * amt,
          sweepTo: 104 + amt * 155,
          x,
        });
        this.noise(0.1, {
          gain: 0.018 + 0.045 * amt,
          type: "bandpass",
          freq: 520 + amt * 1280,
          q: 2.2,
          x,
        });
        break;
      }
      case "beam:redline":
        if (this.throttled("beamRedline", 260)) return;
        if (
          this.sampleFirst("beam:redline", {
            volume: 0.35 + 0.3 * amt,
            pan: this.panOf(x),
            priority: "critical",
          })
        )
          return;
        this.tone(1080 + amt * 360, 0.07, {
          type: "square",
          gain: 0.1 + 0.08 * amt,
          sweepTo: 820,
          x,
          priority: "critical",
        });
        break;
      case "beam:release":
        // Doc §4.1: the release edge always sweeps this owner's sustain loop (idempotent).
        this.stopBeamLoop(opts.ownerId, 0.1);
        if (this.sampleFirst("beam:release", { volume: 0.3 + 0.4 * amt, pan: this.panOf(x) }))
          return;
        this.noise(0.2, {
          gain: 0.07 + 0.13 * amt,
          type: "lowpass",
          freq: 1500,
          q: 0.9,
          sweepTo: 210,
          x,
        });
        this.tone(250, 0.18, {
          type: "sine",
          gain: 0.06 + 0.1 * amt,
          sweepTo: 80,
          x,
        });
        break;
      case "beam:overheat": {
        this.stopBeamLoop(opts.ownerId, 0.1);
        const priority: VoicePriority = amt >= 0.75 ? "critical" : "normal";
        // Layer (doc §3): steam-vent hiss over the square-wave groan, at the SAME priority as the
        // synth pair — result deliberately unused, the synth ALWAYS plays.
        this.sampleFirst("beam:overheat", {
          volume: 0.4 + 0.4 * amt,
          pan: this.panOf(x),
          priority,
        });
        this.noise(0.24, {
          gain: 0.13 + 0.2 * amt,
          type: "bandpass",
          freq: 340,
          q: 1.1,
          sweepTo: 95,
          x,
          priority,
        });
        this.tone(118, 0.27, {
          type: "square",
          gain: 0.11 + 0.16 * amt,
          sweepTo: 42,
          x,
          priority,
        });
        break;
      }
      // Vastaghar's manifest-ready score punctuation. Every id is sample-first; synth is the fallback.
      case "boss:titan:intro":
        if (this.sampleFirst(event, { volume: 0.82, priority: "critical" })) return;
        this.tone(52, 0.9, { type: "sine", gain: 0.3, sweepTo: 30, priority: "critical" });
        this.noise(0.72, {
          gain: 0.12,
          type: "lowpass",
          freq: 110,
          sweepTo: 62,
          priority: "critical",
        });
        break;
      case "boss:titan:lift":
        if (this.throttled("titanLift", 300)) return;
        if (this.sampleFirst(event, { volume: 0.35 + 0.35 * amt, pan: this.panOf(x) })) return;
        this.tone(85, 0.22, { type: "triangle", gain: 0.07 + 0.05 * amt, sweepTo: 130, x });
        this.noise(0.18, { gain: 0.035 + 0.035 * amt, type: "bandpass", freq: 420, x });
        break;
      case "boss:titan:glint":
        if (this.throttled("titanGlint", 120)) return;
        if (this.sampleFirst(event, { volume: 0.36 + 0.34 * amt, pan: this.panOf(x) })) return;
        this.tone(900, 0.15, { type: "triangle", gain: 0.07 + 0.05 * amt, sweepTo: 1_350, x });
        break;
      case "boss:titan:wheel":
        if (this.throttled("titanWheel", 500)) return;
        if (this.sampleFirst(event, { volume: 0.4 + 0.35 * amt, pan: this.panOf(x) })) return;
        this.noise(0.16, { gain: 0.08 + 0.07 * amt, type: "bandpass", freq: 680, x });
        this.tone(140, 0.2, { type: "triangle", gain: 0.08, sweepTo: 82, x });
        break;
      case "boss:titan:step":
        if (this.throttled("titanStep", 70)) return;
        if (
          this.sampleFirst(event, {
            volume: 0.62 + 0.38 * amt,
            pan: this.panOf(x),
            priority: "critical",
          })
        )
          return;
        this.tone(52, 0.42, { type: "sine", gain: 0.48, sweepTo: 26, x, priority: "critical" });
        this.noise(0.34, {
          gain: 0.24,
          type: "lowpass",
          freq: 150,
          sweepTo: 70,
          x,
          priority: "critical",
        });
        break;
      case "boss:titan:phase":
        if (this.throttled("titanPhase", 500)) return;
        if (this.sampleFirst(event, { volume: 0.82, priority: "critical" })) return;
        this.tone(196, 0.22, { type: "triangle", gain: 0.16, sweepTo: 165, priority: "critical" });
        this.tone(294, 0.28, {
          type: "triangle",
          gain: 0.17,
          sweepTo: 392,
          delay: 0.2,
          priority: "critical",
        });
        break;
      case "boss:titan:break":
        if (this.throttled("titanBreak", 400)) return;
        if (this.sampleFirst(event, { volume: 0.9, pan: this.panOf(x), priority: "critical" }))
          return;
        this.noise(0.14, { gain: 0.2, type: "bandpass", freq: 280, x, priority: "critical" });
        this.tone(78, 0.32, { type: "sine", gain: 0.24, sweepTo: 42, x, priority: "critical" });
        break;
      case "boss:titan:death":
        if (this.throttled("titanDeath", 800)) return;
        if (this.sampleFirst(event, { volume: 1, priority: "critical" })) return;
        this.tone(45, 0.62, { type: "sine", gain: 0.4, sweepTo: 22, priority: "critical" });
        this.noise(0.4, {
          gain: 0.2,
          type: "lowpass",
          freq: 320,
          sweepTo: 85,
          priority: "critical",
        });
        this.tone(330, 0.3, {
          type: "triangle",
          gain: 0.13,
          sweepTo: 494,
          delay: 0.55,
          priority: "critical",
        });
        break;
      // Reward / skill stingers.
      case "parry": // the crispest sound in the game — this IS the skill beat
        // Layer (doc §3): sample metal clang OVER the sine pair — result deliberately unused. The
        // 1400/2100 Hz sines are the skill-beat's pitch identity and are never removed.
        this.sampleFirst("parry", { volume: 0.7 + 0.3 * amt, priority: "critical" });
        this.tone(1400, 0.18, {
          type: "sine",
          gain: 0.3 + 0.12 * amt,
          priority: "critical",
        });
        this.tone(2100, 0.16, {
          type: "sine",
          gain: 0.18 + 0.08 * amt,
          delay: 0.005,
          priority: "critical",
        });
        break;
      case "levelup":
        this.blip([523, 659, 784, 1046], 0.07, "triangle", 0.26);
        break;
      case "pet:bond-progress":
        if (this.throttled("petBondProgress", 500)) return;
        if (this.sampleFirst("pet-bond-progress", { volume: 0.46, priority: "normal" })) return;
        // A soft paper/wood resolve, deliberately below and unlike the ultimate-ready chime.
        this.noise(0.09, { gain: 0.055, type: "bandpass", freq: 760, q: 0.8 });
        this.tone(294, 0.18, { type: "triangle", gain: 0.1, sweepTo: 370 });
        this.tone(440, 0.16, { type: "sine", gain: 0.065, delay: 0.09 });
        break;
      case "pet:evolve:awakened":
      case "pet:evolve:ascendant": {
        const ascendant = event === "pet:evolve:ascendant";
        const cue = ascendant ? "pet-evolve-ascendant" : "pet-evolve-awakened";
        if (this.sampleFirst(cue, { volume: ascendant ? 0.72 : 0.58, priority: "critical" }))
          return;
        this.noise(0.22, {
          gain: ascendant ? 0.12 : 0.09,
          type: "bandpass",
          freq: 620,
          q: 0.7,
          priority: "critical",
        });
        this.blip(ascendant ? [220, 294, 392, 587] : [294, 370, 440], 0.1, "triangle", 0.16);
        break;
      }
      // ULTIMATES. Every semantic cue is manifest-ready; the shipped ready chime is addressed by id
      // because it intentionally has `replaces: null`. Remote casts pass a restrained `amt` and read as
      // battlefield weather, while the owning player's cue keeps its full transient.
      case "ult:ready":
        if (this.throttled("ultimateReady", 500)) return;
        if (
          sampleBank.playSample("ultimate-ready-chime", {
            volume: 0.52,
            priority: "normal",
            minIntervalMs: 500,
          })
        )
          return;
        this.blip([523, 784, 1046], 0.075, "sine", 0.15);
        break;
      case "ult:dry":
        if (this.throttled("ultimateDry", 180)) return;
        if (this.sampleFirst(event, { volume: 0.28, priority: "low" })) return;
        this.tone(190, 0.08, { type: "square", gain: 0.07, sweepTo: 145, priority: "low" });
        break;
      case "ult:unlock":
        if (this.sampleFirst(event, { volume: 0.7, priority: "critical" })) return;
        this.blip([392, 523, 659, 988], 0.095, "triangle", 0.21);
        break;
      case "ult:temper":
        if (this.sampleFirst(event, { volume: 0.62, priority: "normal" })) return;
        this.tone(740, 0.22, { type: "triangle", gain: 0.14, sweepTo: 1180 });
        this.tone(1480, 0.08, { type: "sine", gain: 0.1, delay: 0.15 });
        break;
      case "ult:seismarch:charge":
        if (this.sampleFirst(event, { volume: 0.35 + 0.35 * amt, pan: this.panOf(x) })) return;
        this.noise(0.18, { gain: 0.09 + 0.1 * amt, type: "lowpass", freq: 360, x });
        this.tone(90, 0.2, { type: "sine", gain: 0.1 + 0.1 * amt, sweepTo: 62, x });
        break;
      case "ult:seismarch:launch":
        if (this.sampleFirst(event, { volume: 0.35 + 0.45 * amt, pan: this.panOf(x) })) return;
        this.noise(0.13, { gain: 0.13 + 0.12 * amt, type: "bandpass", freq: 720, x });
        break;
      case "ult:seismarch:impact":
        if (
          this.sampleFirst(event, {
            volume: 0.4 + 0.55 * amt,
            pan: this.panOf(x),
            priority: "critical",
          })
        )
          return;
        this.tone(54, 0.42, { type: "sine", gain: 0.28 * amt, sweepTo: 30, x });
        this.noise(0.34, { gain: 0.24 * amt, type: "lowpass", freq: 520, x });
        break;
      case "ult:alpha:lock":
        if (this.sampleFirst(event, { volume: 0.32 + 0.42 * amt, pan: this.panOf(x) })) return;
        this.tone(1260, 0.1, { type: "square", gain: 0.1 * amt, sweepTo: 1720, x });
        break;
      case "ult:alpha:hop":
        if (this.throttled(`ultimateAlphaHop:${opts.ownerId ?? "all"}`, 55)) return;
        if (this.sampleFirst(event, { volume: 0.24 + 0.34 * amt, pan: this.panOf(x) })) return;
        this.noise(0.055, { gain: 0.07 + 0.09 * amt, type: "highpass", freq: 2800, x });
        break;
      case "ult:alpha:finish":
        if (this.sampleFirst(event, { volume: 0.38 + 0.5 * amt, pan: this.panOf(x) })) return;
        this.tone(1800, 0.09, { type: "sine", gain: 0.16 * amt, sweepTo: 650, x });
        this.noise(0.11, { gain: 0.13 * amt, type: "bandpass", freq: 1700, x });
        break;
      case "ult:fire:charge":
        if (this.sampleFirst(event, { volume: 0.32 + 0.4 * amt, pan: this.panOf(x) })) return;
        this.tone(240, 0.24, { type: "sawtooth", gain: 0.1 * amt, sweepTo: 620, x });
        break;
      case "ult:fire:launch":
        if (this.sampleFirst(event, { volume: 0.35 + 0.48 * amt, pan: this.panOf(x) })) return;
        this.noise(0.18, { gain: 0.13 + 0.12 * amt, type: "bandpass", freq: 980, x });
        this.tone(260, 0.16, { type: "triangle", gain: 0.12 * amt, sweepTo: 105, x });
        break;
      case "ult:fire:impact":
        if (
          this.sampleFirst(event, {
            volume: 0.42 + 0.52 * amt,
            pan: this.panOf(x),
            priority: "critical",
          })
        )
          return;
        this.tone(48, 0.5, { type: "sine", gain: 0.3 * amt, sweepTo: 26, x });
        this.noise(0.42, { gain: 0.25 * amt, type: "lowpass", freq: 760, x });
        break;
      case "ult:phase:in":
      case "ult:phase:out":
        if (this.sampleFirst(event, { volume: 0.3 + 0.42 * amt, pan: this.panOf(x) })) return;
        this.noise(0.18, {
          gain: 0.08 + 0.1 * amt,
          type: "bandpass",
          freq: event.endsWith("in") ? 2100 : 950,
          sweepTo: event.endsWith("in") ? 720 : 2600,
          x,
        });
        break;
      case "ult:blink:charge":
      case "ult:blink:out":
      case "ult:blink:in":
      case "ult:blink:return":
        if (this.sampleFirst(event, { volume: 0.32 + 0.44 * amt, pan: this.panOf(x) })) return;
        this.noise(0.1, { gain: 0.08 + 0.1 * amt, type: "highpass", freq: 2300, x });
        this.tone(event.endsWith("in") ? 980 : 1320, 0.11, {
          type: "triangle",
          gain: 0.1 * amt,
          sweepTo: event.endsWith("return") ? 620 : 1880,
          x,
        });
        break;
      case "ult:crit-rider":
        if (this.sampleFirst(event, { volume: 0.35 + 0.4 * amt, pan: this.panOf(x) })) return;
        this.tone(2460, 0.12, { type: "sine", gain: 0.12 * amt, sweepTo: 3300, x });
        break;
      case "loot": // pitch rises with rarity (amt = rarity/6)
        // Sample-first with the same rarity read: the engine pitch-shifts a neutral take (doc §2.1).
        if (this.sampleFirst("loot", { volume: 0.5 + 0.5 * amt, rate: 1 + amt * 0.3 })) return;
        this.blip([660 + amt * 500, 990 + amt * 600, 1320 + amt * 700], 0.08, "sine", 0.22);
        break;
      case "xpTick": // one low-priority note per receipt bucket; never impersonates the loot arpeggio
        if (this.throttled("xpTick", 65)) return;
        // Manifest note: neutral take, engine ramps playbackRate ~1.0x→1.8x across the catch streak
        // (mirrors the synth's 430→930 Hz amt ramp). Low priority, same as the synth voice.
        if (
          this.sampleFirst("xpTick", {
            volume: 0.3 + 0.2 * amt,
            pan: this.panOf(x),
            rate: 1 + 0.8 * amt,
            priority: "low",
          })
        )
          return;
        this.tone(430 + amt * 500, 0.075, {
          type: "sine",
          gain: 0.08 + 0.06 * amt,
          x,
          priority: "low",
        });
        break;
      case "xpCadence": // one restrained resolve for a meaningful catch batch
        if (this.throttled("xpCadence", 300)) return;
        if (
          this.sampleFirst("xpCadence", {
            volume: 0.25 + 0.2 * amt,
            pan: this.panOf(x),
            rate: 1 + 0.15 * amt,
            priority: "low",
          })
        )
          return;
        this.tone(620 + amt * 220, 0.11, {
          type: "triangle",
          gain: 0.07 + 0.05 * amt,
          sweepTo: 760 + amt * 260,
          x,
          priority: "low",
        });
        break;
      case "death":
        if (this.throttled("death", 30)) return;
        if (
          this.sampleFirst("death", {
            volume: 0.4 + 0.2 * amt,
            pan: this.panOf(x),
            rate: 0.96 + Math.random() * 0.08,
            minIntervalMs: 30,
          })
        )
          return;
        this.noise(0.05, { gain: 0.22, type: "lowpass", freq: 500, x });
        this.tone(220, 0.09, { type: "triangle", gain: 0.14, sweepTo: 70, x });
        break;
      case "pitdeath":
        this.tone(300, 0.32, { type: "sine", gain: 0.2, sweepTo: 80, x });
        break;
      // §51 tough-combo presentation. All four ids are manifest-ready and sample-first; the compact synth
      // fallbacks keep the grammar audible until bespoke launch/land/swell/air-hit samples ship.
      case "enemy-combo:leap-launch":
        if (this.throttled("enemyComboLeapLaunch", 70)) return;
        if (
          this.sampleFirst("enemy-combo:leap-launch", {
            volume: 0.25 + 0.42 * amt,
            pan: this.panOf(x),
            priority: "normal",
            minIntervalMs: 70,
          })
        )
          return;
        this.noise(0.14, {
          gain: 0.06 + 0.1 * amt,
          type: "bandpass",
          freq: 1_150,
          sweepTo: 360,
          x,
        });
        this.tone(210, 0.12, { type: "triangle", gain: 0.07 + 0.05 * amt, sweepTo: 105, x });
        break;
      case "enemy-combo:leap-land":
        if (this.throttled("enemyComboLeapLand", 70)) return;
        if (
          this.sampleFirst("enemy-combo:leap-land", {
            volume: 0.28 + 0.44 * amt,
            pan: this.panOf(x),
            rate: 0.94,
            priority: "normal",
            minIntervalMs: 70,
          })
        )
          return;
        this.tone(105, 0.11, { type: "sine", gain: 0.1 + 0.12 * amt, sweepTo: 54, x });
        this.noise(0.08, { gain: 0.06 + 0.09 * amt, type: "lowpass", freq: 720, x });
        this.tone(1_800, 0.025, { type: "triangle", gain: 0.025 + 0.03 * amt, sweepTo: 1_250, x });
        break;
      case "enemy-combo:return-tell":
        if (this.throttled("enemyComboReturnTell", 120)) return;
        if (
          this.sampleFirst("enemy-combo:return-tell", {
            volume: 0.3 + 0.45 * amt,
            pan: this.panOf(x),
            rate: 0.96,
            priority: "normal",
            minIntervalMs: 120,
          })
        )
          return;
        this.tone(92, 0.42, { type: "sawtooth", gain: 0.07 + 0.08 * amt, sweepTo: 145, x });
        this.noise(0.16, {
          gain: 0.035 + 0.05 * amt,
          type: "bandpass",
          freq: 480,
          sweepTo: 1_650,
          x,
        });
        this.tone(1_250, 0.055, {
          type: "triangle",
          gain: 0.04 + 0.04 * amt,
          sweepTo: 2_400,
          x,
          delay: 0.34,
        });
        break;
      case "enemy-combo:airkeep-hit":
        if (this.throttled("enemyComboAirKeep", 65)) return;
        if (
          this.sampleFirst("enemy-combo:airkeep-hit", {
            volume: 0.24 + 0.4 * amt,
            pan: this.panOf(x),
            rate: 0.98,
            priority: "normal",
            minIntervalMs: 65,
          })
        )
          return;
        this.noise(0.07, { gain: 0.07 + 0.08 * amt, type: "highpass", freq: 1_500, x });
        this.tone(420, 0.09, { type: "triangle", gain: 0.08 + 0.07 * amt, sweepTo: 710, x });
        break;
      // Jump-feel movement family. The installed movement ids predate `replaces` mappings, so these
      // explicit sample-first branches address them directly and retain synth coverage during decode.
      case "jump":
        if (this.throttled(amt >= 0.75 ? "jumpSelf" : "jumpRemote", 70)) return;
        if (
          sampleBank.playSample("player-jump", {
            volume: 0.22 + 0.38 * amt,
            pan: this.panOf(x),
            rate: 0.96 + 0.08 * amt,
            priority: "low",
          })
        )
          return;
        this.tone(280, 0.09, {
          type: "triangle",
          gain: 0.07 + 0.07 * amt,
          sweepTo: 420,
          x,
          priority: "low",
        });
        this.noise(0.06, { gain: 0.035 + 0.04 * amt, type: "highpass", freq: 1300, x });
        break;
      case "slide":
        if (this.throttled(amt >= 0.75 ? "slideSelf" : "slideRemote", 120)) return;
        if (
          sampleBank.playSample("player-roll-whoosh", {
            volume: 0.24 + 0.42 * amt,
            pan: this.panOf(x),
            rate: 1.02 + 0.08 * amt,
            priority: amt >= 0.75 ? "normal" : "low",
          })
        )
          return;
        this.noise(0.13, { gain: 0.07 + 0.09 * amt, type: "highpass", freq: 900, x });
        this.tone(260, 0.1, { type: "triangle", gain: 0.045 + 0.04 * amt, sweepTo: 150, x });
        break;
      case "slide:scrape": {
        const scrapeKey = opts.ownerId ? `slideScrape:${opts.ownerId}` : "slideScrape";
        if (this.throttled(scrapeKey, 78)) return;
        // Manifest-ready optional replacement id. Until shipped, the filtered paper-noise recipe below
        // is the authoritative scrape loop and repeated calls sustain it without a long-lived node.
        if (
          sampleBank.playSample("player-slide-scrape", {
            volume: 0.035 + 0.1 * amt,
            pan: this.panOf(x),
            rate: 0.88 + 0.22 * amt,
            priority: "low",
          })
        )
          return;
        this.noise(0.095, {
          gain: 0.018 + 0.05 * amt,
          type: "bandpass",
          freq: 520 + 620 * amt,
          x,
          priority: "low",
        });
        break;
      }
      case "slide:hop":
        if (this.throttled("slideHop", 90)) return;
        this.noise(0.07, { gain: 0.04 + 0.05 * amt, type: "highpass", freq: 1200, x });
        this.tone(230, 0.075, { type: "triangle", gain: 0.04, sweepTo: 340, x });
        break;
      case "slide:dry":
        if (this.throttled("slideDry", 90)) return;
        this.noise(0.035, { gain: 0.035 * amt, type: "lowpass", freq: 520, x });
        this.tone(155, 0.04, { type: "triangle", gain: 0.045 * amt, sweepTo: 120, x });
        break;
      case "slide:whiff":
        if (this.throttled("slideWhiff", 55)) return;
        this.noise(0.045, { gain: 0.055 * amt, type: "highpass", freq: 2_100, x });
        this.tone(720, 0.025, { type: "triangle", gain: 0.025 * amt, sweepTo: 560, x });
        break;
      case "land":
        if (this.throttled(amt >= 0.75 ? "landHeavy" : "land", 55)) return;
        if (
          sampleBank.playSample("player-land", {
            volume: 0.2 + 0.55 * amt,
            pan: this.panOf(x),
            rate: 1.08 - 0.18 * amt,
            priority: amt >= 0.75 ? "normal" : "low",
          })
        )
          return;
        this.tone(135 - 35 * amt, 0.07 + 0.04 * amt, {
          type: "sine",
          gain: 0.08 + 0.2 * amt,
          sweepTo: 72 - 18 * amt,
          x,
        });
        this.noise(0.045 + 0.035 * amt, {
          gain: 0.04 + 0.11 * amt,
          type: "lowpass",
          freq: 1000 - 480 * amt,
          x,
        });
        break;
      case "pound:tuck":
        this.noise(0.06, { gain: 0.08 + 0.06 * amt, type: "highpass", freq: 1800, x });
        this.tone(500, 0.06, { type: "triangle", gain: 0.07, sweepTo: 700, x });
        break;
      case "pound:drop":
        this.tone(600, 0.18, { type: "sine", gain: 0.08 + 0.08 * amt, sweepTo: 180, x });
        break;
      case "pound:hit":
        if (this.throttled("poundHit", 90)) return;
        // `player-pound-slam` is a direct-id layer: it supplies the real stone/body debris while the
        // player sub-boom below stays distinct and one notch above the boss recipe in pitch.
        sampleBank.playSample("player-pound-slam", {
          volume: 0.28 + 0.36 * amt,
          pan: this.panOf(x),
          rate: 0.96 + 0.04 * amt,
          priority: amt >= 0.75 ? "critical" : "normal",
        });
        this.tone(72, 0.24, {
          type: "sine",
          gain: 0.2 + 0.24 * amt,
          sweepTo: 38,
          x,
          priority: amt >= 0.75 ? "critical" : "normal",
        });
        this.noise(0.16, {
          gain: 0.1 + 0.12 * amt,
          type: "lowpass",
          freq: 320,
          x,
        });
        break;
      case "leap:coil":
        if (this.throttled("leapCoil", 80)) return;
        this.tone(900 - 160 * amt, 0.025, {
          type: "square",
          gain: 0.055,
          sweepTo: 760 - 120 * amt,
          x,
          priority: "low",
        });
        this.noise(0.035, { gain: 0.035, type: "bandpass", freq: 2100, x, priority: "low" });
        break;
      case "leap:launch":
        if (
          sampleBank.playSample("player-dodge", {
            volume: 0.28 + 0.36 * amt,
            pan: this.panOf(x),
            rate: 0.9,
          })
        )
          return;
        this.noise(0.12, {
          gain: 0.1 + 0.12 * amt,
          type: "bandpass",
          freq: 900,
          sweepTo: 260,
          x,
        });
        this.tone(200, 0.12, { type: "triangle", gain: 0.09, sweepTo: 90, x });
        break;
      case "leap:skid":
        if (this.throttled("leapSkid", 120)) return;
        this.noise(0.14, {
          gain: 0.07 + 0.07 * amt,
          type: "bandpass",
          freq: 760,
          q: 1.4,
          sweepTo: 250,
          x,
          priority: "low",
        });
        break;
      case "grab":
        this.tone(880, 0.06, { type: "sine", gain: 0.2 });
        this.tone(1320, 0.07, { type: "sine", gain: 0.2, delay: 0.06 });
        break;
      case "pair":
        if (this.sampleFirst("pair", { volume: 0.48 + 0.32 * amt, pan: this.panOf(x) })) return;
        this.noise(0.045, { gain: 0.055 + 0.04 * amt, type: "highpass", freq: 2_700, x });
        this.tone(740, 0.09, { type: "triangle", gain: 0.13 + 0.06 * amt, sweepTo: 980, x });
        this.tone(1_320, 0.11, {
          type: "sine",
          gain: 0.12 + 0.06 * amt,
          sweepTo: 1_760,
          delay: 0.065,
          x,
        });
        break;
      // Big low-frequency moments (the shake wants a boom under it).
      case "bossslam":
        // Layer (doc §3): sample debris/impact texture over the sine sub-boom — result deliberately
        // unused. The synth sub is what the screen-shake sits on; the sample adds the "real" body.
        this.sampleFirst("bossslam", {
          volume: 0.6 + 0.4 * amt,
          pan: this.panOf(x),
          priority: "critical",
        });
        this.tone(60, 0.4, {
          type: "sine",
          gain: 0.5,
          sweepTo: 30,
          x,
          priority: "critical",
        });
        this.noise(0.35, {
          gain: 0.3,
          type: "bandpass",
          freq: 120,
          q: 0.8,
          x,
          priority: "critical",
        });
        break;
      case "descent":
        this.noise(0.6, { gain: 0.34, type: "lowpass", freq: 1200, q: 0.6, sweepTo: 200 });
        this.tone(180, 0.6, { type: "sine", gain: 0.3, sweepTo: 50 });
        break;
      case "extract":
        this.blip([392, 523, 659, 880], 0.1, "triangle", 0.3);
        break;
      case "wardrobe:equip":
        if (this.throttled("wardrobeEquip", 70)) return;
        this.tone(740, 0.055, { type: "triangle", gain: 0.11, sweepTo: 920 });
        this.tone(1180, 0.065, { type: "sine", gain: 0.08, delay: 0.035 });
        break;
      case "armory:stage":
        if (this.throttled("armoryStage", 70)) return;
        this.noise(0.035, { gain: 0.08, type: "bandpass", freq: 1800, q: 4 });
        this.tone(310, 0.08, { type: "triangle", gain: 0.1, sweepTo: 260 });
        break;
      case "drive:empty":
        if (this.throttled("driveEmpty", 220)) return;
        this.tone(190, 0.12, { type: "square", gain: 0.14, sweepTo: 115 });
        this.noise(0.08, { gain: 0.09, type: "bandpass", freq: 720, q: 5 });
        break;
      case "settlement:kept":
        this.blip([330, 440, 554, 659], 0.12, "triangle", 0.24);
        this.tone(988, 0.28, { type: "sine", gain: 0.14, delay: 0.4 });
        break;
      case "settlement:lost":
        this.tone(196, 0.24, { type: "triangle", gain: 0.18, sweepTo: 110 });
        this.tone(146, 0.38, { type: "sine", gain: 0.15, sweepTo: 73, delay: 0.12 });
        break;
      case "prestige:reveal":
        if (this.sampleFirst(event, { volume: 0.76, priority: "critical" })) return;
        this.noise(0.24, { gain: 0.13, type: "bandpass", freq: 1_450, q: 2.4 });
        this.blip([262, 392, 523, 784], 0.13, "triangle", 0.25);
        this.tone(1_176, 0.42, { type: "sine", gain: 0.14, delay: 0.48 });
        break;
      case "hurt":
        if (this.throttled("hurt", 120)) return;
        if (
          this.sampleFirst("hurt", {
            volume: 0.5 + 0.4 * amt,
            pan: this.panOf(x),
            rate: 0.97 + Math.random() * 0.06,
            priority: "critical",
          })
        )
          return;
        this.noise(0.12, {
          gain: 0.14 + 0.18 * amt,
          type: "lowpass",
          freq: 900,
          priority: "critical",
        });
        this.tone(200, 0.11, {
          type: "sine",
          gain: 0.16 + 0.14 * amt,
          sweepTo: 120,
          priority: "critical",
        });
        break;
      case "fall":
        this.tone(80, 0.09, { type: "sine", gain: 0.3, sweepTo: 55, delay: 0.18 });
        this.tone(300, 0.24, { type: "sine", gain: 0.16, sweepTo: 90 });
        break;
      case "revive":
        this.tone(523, 0.16, { type: "triangle", gain: 0.26 });
        this.tone(784, 0.2, { type: "triangle", gain: 0.24, delay: 0.09 });
        break;
      // §50 soundkit — Serraketh underground rumble (doc §4.2). NEW events with no synth
      // predecessor: nothing emits them yet and they no-op without samples, so today's audio is
      // untouched. Contract for the future scene glue: emit "boss:rumble:start" every frame while
      // the worm is burrowed (idempotent — first call starts the loop welling up over 0.4s, repeats
      // are the keepalive + gain retarget from proximity/phase amt) and "boss:rumble:stop" on
      // surfacing/eruption/boss death; a missed stop is reaped by the keepalive watchdog.
      case "boss:rumble:start": {
        if (this.bossRumble?.handle.alive) {
          this.bossRumble.lastFedMs = Date.now();
          this.bossRumble.handle.setVolume(0.2 + 0.6 * amt, 0.25);
          break;
        }
        this.bossRumble = null;
        // `serraketh-rumble-loop` has `replaces: null` in the manifest (brand-new cue, no synth
        // counterpart), so it is addressed by id rather than through `sampleForCue`.
        const h = sampleBank.startLoop("serraketh-rumble-loop", {
          volume: 0.2 + 0.6 * amt,
          pan: this.panOf(x),
          fadeInSec: 0.4, // doc §4.2: it should well up, not pop in
        });
        if (h) {
          this.bossRumble = { handle: h, lastFedMs: Date.now() };
          this.armLoopWatchdog();
        }
        break;
      }
      case "boss:rumble:stop":
        this.bossRumble?.handle.stop(0.5);
        this.bossRumble = null;
        break;
      default:
        break;
    }
  }

  /** An ascending arpeggio of notes (level-up / loot / extract stings). */
  private blip(freqs: number[], step: number, type: OscillatorType, gain: number): void {
    for (let i = 0; i < freqs.length; i++) {
      this.tone(freqs[i] ?? 440, step * 1.6, { type, gain, delay: i * step });
    }
  }
}
