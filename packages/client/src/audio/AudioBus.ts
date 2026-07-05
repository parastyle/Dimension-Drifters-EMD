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

const LS_VOL = "dd.audio.vol";
const LS_MUTED = "dd.audio.muted";

/** Optional per-sound modifiers. `x` (world px) pans; `amt` (0..1) scales gain/pitch for magnitude cues. */
export interface PlayOpts {
  x?: number;
  amt?: number;
}

type Ctx = AudioContext;

export class AudioBus {
  private ctx: Ctx | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private failed = false;
  private volume: number;
  private muted: boolean;
  /** Live voice count (bounded so a burst can't spawn hundreds of nodes). */
  private voices = 0;
  private static readonly MAX_VOICES = 24;
  /** Camera world-centre X, refreshed each frame — the pan reference. */
  private camMidX = 0;
  private halfViewW = 960;
  /** Last play time (ctx seconds) per throttle key, to rate-limit spammy events. */
  private readonly lastAt = new Map<string, number>();

  constructor() {
    let v = 0.35;
    let m = false;
    try {
      const rawV = localStorage.getItem(LS_VOL);
      if (rawV !== null) v = Math.max(0, Math.min(1, Number.parseFloat(rawV) || 0));
      m = localStorage.getItem(LS_MUTED) === "1";
    } catch {
      /* localStorage can throw in private mode — fall back to defaults */
    }
    this.volume = v;
    this.muted = m;
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
        // Self-heal: if the context ever suspends (mobile tab-hide / OS audio-focus loss) the scheduled
        // sources' `ended` events don't fire on the frozen clock, so `voices` could pin at the cap. Re-baseline
        // it (and the throttle map) whenever the context returns to running (adversarial-verify finding).
        ctx.onstatechange = () => {
          if (ctx.state === "running") {
            this.voices = 0;
            this.lastAt.clear();
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
        this.noiseBuf = buf;
        this.applyGain(0);
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

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    try {
      localStorage.setItem(LS_VOL, this.volume.toFixed(3));
    } catch {
      /* ignore */
    }
    this.applyGain();
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

  /** Count a voice on start, uncount on ended; returns false if we're over the concurrency budget. */
  private claim(node: AudioScheduledSourceNode): boolean {
    if (this.voices >= AudioBus.MAX_VOICES) return false;
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
    o: { type?: OscillatorType; gain?: number; sweepTo?: number; x?: number; delay?: number } = {},
  ): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t0 = ctx.currentTime + (o.delay ?? 0);
    const osc = ctx.createOscillator();
    if (!this.claim(osc)) return;
    osc.type = o.type ?? "sine";
    osc.frequency.setValueAtTime(freq, t0);
    if (o.sweepTo && o.sweepTo > 0) osc.frequency.exponentialRampToValueAtTime(o.sweepTo, t0 + dur);
    const g = ctx.createGain();
    const peak = Math.max(0.0002, o.gain ?? 0.3);
    g.gain.setValueAtTime(0.0002, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0002, t0 + dur);
    osc.connect(g).connect(this.out(o.x));
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
    } = {},
  ): void {
    const ctx = this.ctx;
    if (!ctx || !this.noiseBuf) return;
    const t0 = ctx.currentTime;
    const src = ctx.createBufferSource();
    if (!this.claim(src)) return;
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
    switch (event) {
      // High-frequency combat — per gun bulletKind (mirrors the GUN_FX visual split).
      case "shot:slug":
        if (this.throttled("shot", 30)) return;
        this.noise(0.09, { gain: 0.32, type: "bandpass", freq: 700, q: 1.2, x });
        this.tone(150, 0.11, { type: "sine", gain: 0.3, sweepTo: 60, x });
        break;
      case "shot:pellet":
        if (this.throttled("shot", 40)) return;
        this.noise(0.13, { gain: 0.4, type: "lowpass", freq: 1400, q: 0.7, x });
        break;
      case "shot:tracer":
        if (this.throttled("shot", 45)) return;
        this.noise(0.04, { gain: 0.16, type: "bandpass", freq: 1700, q: 2, x });
        break;
      case "shot:nail":
        if (this.throttled("shot", 35)) return;
        this.noise(0.05, { gain: 0.2, type: "highpass", freq: 2000, q: 1, x });
        break;
      case "shot:ricochet":
        if (this.throttled("shot", 35)) return;
        this.noise(0.06, { gain: 0.18, type: "bandpass", freq: 1100, q: 3, x });
        this.tone(900, 0.08, { type: "sine", gain: 0.16, sweepTo: 1600, x });
        break;
      case "hit": // melee/bullet landing on an enemy
        if (this.throttled("hit", 25)) return;
        this.tone(180, 0.06, { type: "triangle", gain: 0.12 + 0.18 * amt, sweepTo: 90, x });
        this.noise(0.045, { gain: 0.1 + 0.12 * amt, type: "lowpass", freq: 1200, x });
        break;
      case "bighit": // a crushing blow (magnitude cue)
        if (this.throttled("bighit", 60)) return;
        this.tone(120, 0.14, { type: "square", gain: 0.34, sweepTo: 55, x });
        this.noise(0.09, { gain: 0.28, type: "lowpass", freq: 900, x });
        break;
      // Reward / skill stingers.
      case "parry": // the crispest sound in the game — this IS the skill beat
        this.tone(1400, 0.18, { type: "sine", gain: 0.3 + 0.12 * amt });
        this.tone(2100, 0.16, { type: "sine", gain: 0.18 + 0.08 * amt, delay: 0.005 });
        break;
      case "levelup":
        this.blip([523, 659, 784, 1046], 0.07, "triangle", 0.26);
        break;
      case "loot": // pitch rises with rarity (amt = rarity/6)
        this.blip([660 + amt * 500, 990 + amt * 600, 1320 + amt * 700], 0.08, "sine", 0.22);
        break;
      case "death":
        if (this.throttled("death", 30)) return;
        this.noise(0.05, { gain: 0.22, type: "lowpass", freq: 500, x });
        this.tone(220, 0.09, { type: "triangle", gain: 0.14, sweepTo: 70, x });
        break;
      case "pitdeath":
        this.tone(300, 0.32, { type: "sine", gain: 0.2, sweepTo: 80, x });
        break;
      case "grab":
        this.tone(880, 0.06, { type: "sine", gain: 0.2 });
        this.tone(1320, 0.07, { type: "sine", gain: 0.2, delay: 0.06 });
        break;
      // Big low-frequency moments (the shake wants a boom under it).
      case "bossslam":
        this.tone(60, 0.4, { type: "sine", gain: 0.5, sweepTo: 30, x });
        this.noise(0.35, { gain: 0.3, type: "bandpass", freq: 120, q: 0.8, x });
        break;
      case "descent":
        this.noise(0.6, { gain: 0.34, type: "lowpass", freq: 1200, q: 0.6, sweepTo: 200 });
        this.tone(180, 0.6, { type: "sine", gain: 0.3, sweepTo: 50 });
        break;
      case "extract":
        this.blip([392, 523, 659, 880], 0.1, "triangle", 0.3);
        break;
      case "hurt":
        if (this.throttled("hurt", 120)) return;
        this.noise(0.12, { gain: 0.14 + 0.18 * amt, type: "lowpass", freq: 900 });
        this.tone(200, 0.11, { type: "sine", gain: 0.16 + 0.14 * amt, sweepTo: 120 });
        break;
      case "fall":
        this.tone(80, 0.09, { type: "sine", gain: 0.3, sweepTo: 55, delay: 0.18 });
        this.tone(300, 0.24, { type: "sine", gain: 0.16, sweepTo: 90 });
        break;
      case "revive":
        this.tone(523, 0.16, { type: "triangle", gain: 0.26 });
        this.tone(784, 0.2, { type: "triangle", gain: 0.24, delay: 0.09 });
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
