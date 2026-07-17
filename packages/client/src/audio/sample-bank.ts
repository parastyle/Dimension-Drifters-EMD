/**
 * §50 SAMPLE BANK — the (future) generated-SFX layer that sits BESIDE the procedural AudioBus synth.
 * Zero samples exist today (no ElevenLabs key yet), so this module's prime directive is graceful
 * absence: every public call is a cheap, silent no-op that returns `false`/`null` until real files
 * land, and callers keep their existing synthesis as the fallback branch.
 *
 * Design decisions (see docs/soundkit-integration.md for the full wiring plan):
 *
 * 1. MANIFEST = FETCHED JSON, NOT A GENERATED TS MODULE. The soundkit generator
 *    (tools/soundkit, authoring manifest at tools/soundkit/sfx-manifest.json) copies its manifest to
 *    `public/audio/sfx/manifest.json` ONLY when it actually renders mp3s, and only lists ids whose
 *    files were written. Vite serves `public/` at the site root, so ONE runtime fetch of that URL
 *    doubles as the presence probe for the whole sample set:
 *      - manifest absent (today) → single quiet 404, bank marks itself "absent", everything degrades
 *        to synthesis. No per-sample 404 spam, ever: sample files are only fetched for ids the
 *        served manifest vouches for.
 *      - A generated TS module was rejected because (a) importing a file that does not exist yet
 *        would break `tsc --noEmit` right now, and (b) it would bake availability into the bundle,
 *        so dropping new mp3s into public/ would require a rebuild instead of a refresh.
 *
 * 2. AUDIOCONTEXT SEAM = INJECTED PROVIDER. AudioBus creates its AudioContext lazily inside
 *    `resume()` (first user gesture) and keeps `ctx`/`master` private. This bank therefore takes a
 *    {@link SampleBankSource} — a `getContext()` (+ optional `getDestination()`) provider — instead
 *    of importing AudioBus. Post-commit, AudioBus grows two one-line getters (`get context()`,
 *    `get masterNode()`) and the composition root does
 *    `sampleBank.attach({ getContext: () => bus.context, getDestination: () => bus.masterNode })`.
 *    Routing through AudioBus's master gain means samples inherit the persisted volume, mute ramps,
 *    and any future ducking for free. Until attached (or before the first gesture), the context is
 *    null and every play returns false → synthesis fallback.
 *
 * 3. LAZY DECODE, ROUND-ROBIN VARIATIONS. Buffers decode on the first request for an id (all
 *    variations of that id together). While decoding, `sampleAvailable()`/`playSample()` return
 *    false — the caller's synth branch covers the gap, so there is no audible hole and no await in
 *    the hot path. Variations round-robin per id; an optional per-id `minIntervalMs` guards
 *    rapid-fire cues against machine-gunning.
 *
 * 4. OWN VOICE CAP. The bank bounds its concurrent sample voices independently of AudioBus's
 *    24-voice synth pool (samples are full decoded buffers, not two-node blips). Tiered like
 *    AudioBus so reward ticks can never starve parry/hurt/boss cues.
 *
 * 5. NORMALIZATION = PER-ENTRY TRIM TABLE. Generated mp3s arrive unnormalized; {@link GAIN_TRIM}
 *    holds a linear per-id trim (default 1) tuned by ear once files exist, multiplied under the
 *    caller's `volume`.
 *
 * Dependency-light on purpose: no Phaser import (the Phaser sound manager would create a SECOND
 * AudioContext unless carefully configured; plain WebAudio through the injected context keeps one
 * clock, one master gain, one autoplay-policy surface). No imports at all, in fact — only DOM lib
 * types — so it compiles standalone and never entangles the uncommitted work in neighboring files.
 */

// ── manifest types ─────────────────────────────────────────────────────────────────────────────

/** One entry of tools/soundkit/sfx-manifest.json (as copied to public/audio/sfx/manifest.json). */
export interface SfxManifestEntry {
  /** Stable sample id; also the file stem: `<id>.mp3`, or `<id>-v1.mp3`..`-vN.mp3` when varied. */
  id: string;
  /** Grouping used by the generator (e.g. "combat", "boss", "reward"). Free-form here. */
  category: string;
  /** Generator-side priority label (e.g. "P0"). Playback priority is set per call-site instead. */
  priority: string;
  /** The generation prompt — carried for provenance/regeneration, unused at runtime. */
  prompt: string;
  /** Target duration the sample was generated at. */
  durationSeconds: number;
  /** True for sustain loops (beam sustain, Serraketh rumble) — play via {@link SampleBank.startLoop}. */
  loop: boolean;
  /** Number of rendered variations (absent/≤1 → single file `<id>.mp3`). */
  variations?: number;
  /** The AudioBus `play()` event this sample replaces (or layers over) — the wiring key. */
  replaces?: string;
}

// ── public option/seam types ───────────────────────────────────────────────────────────────────

/** Playback priority tiers, mirroring AudioBus's reserved-headroom scheme. */
export type SamplePriority = "low" | "normal" | "critical";

/**
 * The AudioContext seam. `getContext()` returns AudioBus's live context (null before the first
 * user gesture / when Web Audio is unavailable). `getDestination()` should return AudioBus's
 * master GainNode so samples inherit volume/mute/ducking; omitted → `ctx.destination`.
 */
export interface SampleBankSource {
  getContext(): AudioContext | null;
  getDestination?(): AudioNode | null;
}

export interface PlaySampleOpts {
  /** Linear gain 0..1 (multiplied by the per-entry {@link GAIN_TRIM}). Default 1. */
  volume?: number;
  /** playbackRate (pitch+speed). Small jitter (0.97..1.03) de-machine-guns rapid cues. Default 1. */
  rate?: number;
  /** Stereo pan -1..1. Callers compute it from world-x exactly like AudioBus's `out()`. */
  pan?: number;
  /** Voice-cap tier. Default "normal". */
  priority?: SamplePriority;
  /** Per-id rate limit in ms; a call inside the window returns TRUE (handled: intentional silence,
   *  do NOT fall back to synth — that would reintroduce the machine-gun this guard exists to stop). */
  minIntervalMs?: number;
}

export interface StartLoopOpts {
  volume?: number;
  rate?: number;
  pan?: number;
  /** Seconds to ramp in from silence. Default 0.05 (declick). */
  fadeInSec?: number;
}

/** A live sustain loop. Idempotent `stop()`; always check `alive` before reusing. */
export interface SampleLoopHandle {
  readonly id: string;
  readonly alive: boolean;
  /** Ramp to silence over `fadeOutSec` (default 0.08) then release the voice. Safe to call twice. */
  stop(fadeOutSec?: number): void;
  /** Retarget the loop's gain (e.g. beam `amt` changes) without restarting it. */
  setVolume(volume: number, rampSec?: number): void;
}

// ── per-entry gain trim (the normalization table) ──────────────────────────────────────────────

/**
 * Linear gain trim per sample id, applied under the caller's `volume`. Generated mp3s arrive
 * unnormalized (ElevenLabs SFX loudness varies wildly per prompt), so this is where they get
 * levelled by ear against the existing synth once files exist. Missing id → 1. Keep every value
 * ≤ ~1.5; if a sample needs more, regenerate it hotter instead of boosting decode noise.
 */
export const GAIN_TRIM: Readonly<Record<string, number>> = {
  // Populated during the tuning pass once samples land, e.g.:
  // "parry-clang": 0.8,
  // "boss-slam-impact": 1.2,
};

// ── internals ──────────────────────────────────────────────────────────────────────────────────

type ManifestState = "unloaded" | "loading" | "ready" | "absent";
type SampleState = "idle" | "loading" | "ready" | "failed";

interface SampleSlot {
  state: SampleState;
  buffers: AudioBuffer[];
  /** Round-robin cursor into `buffers`. */
  rr: number;
}

interface LiveLoop extends SampleLoopHandle {
  _src: AudioBufferSourceNode;
  _gain: GainNode;
  _alive: boolean;
}

const DEFAULT_MANIFEST_PATH = "audio/sfx/manifest.json";

export class SampleBank {
  /** Bounded concurrent sample voices (one-shots + running loops). */
  private static readonly MAX_VOICES = 12;

  private source: SampleBankSource | null;
  private manifestState: ManifestState = "unloaded";
  private manifestUrl: string;
  private readonly entries = new Map<string, SfxManifestEntry>();
  /** `replaces` cue → sample id, for cue-driven lookup at AudioBus call sites. */
  private readonly cueToId = new Map<string, string>();
  private readonly slots = new Map<string, SampleSlot>();
  /** Live one-shot sources (Set, not a counter — `ended` removal can't drift). */
  private readonly oneShots = new Set<AudioBufferSourceNode>();
  private readonly loops = new Set<LiveLoop>();
  /** Last play time (ctx seconds) per id, for `minIntervalMs`. */
  private readonly lastPlayAt = new Map<string, number>();
  /** Self-heal: when the context leaves+re-enters "running", stranded one-shots are flushed. */
  private lastCtxState: AudioContextState | null = null;

  constructor(source?: SampleBankSource, manifestUrl?: string) {
    this.source = source ?? null;
    // Vite guarantees BASE_URL ends with "/". Guard anyway for odd test harnesses.
    const base =
      typeof import.meta.env?.BASE_URL === "string" ? import.meta.env.BASE_URL : "/";
    this.manifestUrl = manifestUrl ?? `${base}${DEFAULT_MANIFEST_PATH}`;
  }

  /** Late-bind the AudioContext seam (AudioBus creates its context lazily on first gesture). */
  attach(source: SampleBankSource): void {
    this.source = source;
  }

  /**
   * Fetch + parse the served manifest once. Idempotent; never throws. Absent manifest (today's
   * reality: no ElevenLabs key, no files) → "absent" and the bank is permanently a cheap no-op
   * for this session. Call it fire-and-forget from the composition root: `void bank.loadManifest()`.
   */
  async loadManifest(): Promise<void> {
    if (this.manifestState !== "unloaded") return;
    this.manifestState = "loading";
    if (typeof fetch !== "function") {
      this.manifestState = "absent";
      return;
    }
    try {
      const res = await fetch(this.manifestUrl, { cache: "no-cache" });
      if (!res.ok) {
        this.manifestState = "absent";
        return;
      }
      const raw: unknown = await res.json();
      const list = Array.isArray(raw)
        ? raw
        : Array.isArray((raw as { entries?: unknown[] })?.entries)
          ? (raw as { entries: unknown[] }).entries
          : [];
      for (const item of list) {
        const e = item as Partial<SfxManifestEntry> | null;
        if (!e || typeof e.id !== "string" || e.id.length === 0) continue;
        const entry: SfxManifestEntry = {
          id: e.id,
          category: typeof e.category === "string" ? e.category : "misc",
          priority: typeof e.priority === "string" ? e.priority : "",
          prompt: typeof e.prompt === "string" ? e.prompt : "",
          durationSeconds: typeof e.durationSeconds === "number" ? e.durationSeconds : 0,
          loop: e.loop === true,
          variations:
            typeof e.variations === "number" && e.variations > 1
              ? Math.floor(e.variations)
              : undefined,
          replaces: typeof e.replaces === "string" && e.replaces.length > 0 ? e.replaces : undefined,
        };
        this.entries.set(entry.id, entry);
        if (entry.replaces !== undefined && !this.cueToId.has(entry.replaces))
          this.cueToId.set(entry.replaces, entry.id);
      }
      this.manifestState = this.entries.size > 0 ? "ready" : "absent";
    } catch {
      // Network/parse failure ≡ no samples. Silent by design.
      this.manifestState = "absent";
    }
  }

  /** The sample id whose `replaces` names this AudioBus cue, if any (and only if its files exist). */
  sampleForCue(cue: string): string | null {
    return this.cueToId.get(cue) ?? null;
  }

  /** Read-only view of the loaded manifest (empty until loaded / when absent). */
  manifestEntries(): ReadonlyMap<string, SfxManifestEntry> {
    return this.entries;
  }

  /**
   * True only when `id` is manifest-listed AND at least one variation is decoded and ready NOW.
   * First query for an idle id kicks its lazy decode (deliberate side effect: querying an id is
   * the declaration of intent to play it soon) and returns false — the caller's synth branch
   * covers the gap. Thus `sampleAvailable(id) ? playSample(id, o) : synth()` is always audible
   * and never machine-guns a 404: unlisted ids never touch the network.
   */
  sampleAvailable(id: string): boolean {
    if (this.manifestState === "unloaded") void this.loadManifest();
    const entry = this.entries.get(id);
    if (!entry) return false;
    const slot = this.slots.get(id);
    if (!slot) {
      void this.ensureDecoded(entry);
      return false;
    }
    return slot.state === "ready" && slot.buffers.length > 0;
  }

  /** Optional warm-up for latency-critical ids (parry, hurt, boss slam) at scene start. */
  preload(ids: readonly string[]): void {
    if (this.manifestState === "unloaded") {
      void this.loadManifest().then(() => {
        for (const id of ids) {
          const e = this.entries.get(id);
          if (e) void this.ensureDecoded(e);
        }
      });
      return;
    }
    for (const id of ids) {
      const e = this.entries.get(id);
      if (e) void this.ensureDecoded(e);
    }
  }

  /**
   * Play one round-robin variation of `id`. Returns false ⇒ the caller should run its synthesis
   * fallback (sample missing/still decoding/no running context/voice cap). Exception: a
   * `minIntervalMs` suppression returns TRUE — the event was handled by intentional silence.
   */
  playSample(id: string, opts: PlaySampleOpts = {}): boolean {
    const ctx = this.runningContext();
    if (!ctx) return false;
    const entry = this.entries.get(id);
    if (!entry) return false;
    const slot = this.slots.get(id);
    if (!slot) {
      void this.ensureDecoded(entry);
      return false;
    }
    if (slot.state !== "ready" || slot.buffers.length === 0) return false;

    // Per-id rate limit (rapid-fire cues): inside the window = handled, deliberately silent.
    const minMs = opts.minIntervalMs ?? 0;
    if (minMs > 0) {
      const last = this.lastPlayAt.get(id) ?? -1;
      if (ctx.currentTime - last < minMs / 1000) return true;
    }

    const buf = slot.buffers[slot.rr % slot.buffers.length];
    if (!buf) return false;
    slot.rr = (slot.rr + 1) % slot.buffers.length;

    if (!this.hasVoiceHeadroom(opts.priority ?? "normal")) return false;

    try {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = Math.max(0.25, Math.min(4, opts.rate ?? 1));
      const gain = ctx.createGain();
      gain.gain.value = this.effectiveGain(id, opts.volume);
      src.connect(gain);
      this.connectOut(ctx, gain, opts.pan);
      this.oneShots.add(src);
      src.addEventListener("ended", () => {
        this.oneShots.delete(src);
      });
      src.start();
      this.lastPlayAt.set(id, ctx.currentTime);
      if (this.lastPlayAt.size > 128) this.lastPlayAt.clear(); // bound the table
      return true;
    } catch {
      return false; // any Web Audio hiccup ⇒ let synthesis carry the event
    }
  }

  /**
   * Start a sustain loop (entries with `loop: true`: beam sustain, Serraketh rumble). Returns
   * null ⇒ fall back to the existing pulsed synth sustain. The handle owns the lifecycle; scene
   * teardown MUST call `stop()` (or the blanket {@link stopAllLoops}) or the loop outlives the run.
   */
  startLoop(id: string, opts: StartLoopOpts = {}): SampleLoopHandle | null {
    const ctx = this.runningContext();
    if (!ctx) return null;
    const entry = this.entries.get(id);
    if (!entry) return null;
    const slot = this.slots.get(id);
    if (!slot) {
      void this.ensureDecoded(entry);
      return null;
    }
    if (slot.state !== "ready" || slot.buffers.length === 0) return null;
    const buf = slot.buffers[slot.rr % slot.buffers.length];
    if (!buf) return null;
    slot.rr = (slot.rr + 1) % slot.buffers.length;
    // Loops occupy a voice for their whole lifetime — always "critical" would starve one-shots,
    // so they claim at "normal" tier.
    if (!this.hasVoiceHeadroom("normal")) return null;

    try {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      src.playbackRate.value = Math.max(0.25, Math.min(4, opts.rate ?? 1));
      const gain = ctx.createGain();
      const target = this.effectiveGain(id, opts.volume);
      const fadeIn = Math.max(0.005, opts.fadeInSec ?? 0.05);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, target), ctx.currentTime + fadeIn);
      src.connect(gain);
      this.connectOut(ctx, gain, opts.pan);
      src.start();

      const bank = this;
      const loop: LiveLoop = {
        id,
        _src: src,
        _gain: gain,
        _alive: true,
        get alive(): boolean {
          return this._alive;
        },
        stop(fadeOutSec?: number): void {
          if (!this._alive) return;
          this._alive = false;
          bank.loops.delete(this);
          const c = bank.source?.getContext() ?? null;
          try {
            if (c && c.state === "running") {
              const fade = Math.max(0.01, fadeOutSec ?? 0.08);
              this._gain.gain.setTargetAtTime(0.0001, c.currentTime, fade / 3);
              this._src.stop(c.currentTime + fade + 0.05);
            } else {
              this._src.stop(); // suspended/closed context: hard-stop is the safe cleanup
            }
          } catch {
            /* already stopped — fine */
          }
        },
        setVolume(volume: number, rampSec = 0.05): void {
          if (!this._alive) return;
          const c = bank.source?.getContext() ?? null;
          if (!c) return;
          const g = Math.max(0.0002, bank.effectiveGain(this.id, volume));
          this._gain.gain.setTargetAtTime(g, c.currentTime, Math.max(0.005, rampSec) / 3);
        },
      };
      this.loops.add(loop);
      return loop;
    } catch {
      return null;
    }
  }

  /** Blanket loop cleanup — call from scene `shutdown`/`destroy` so no sustain outlives the run. */
  stopAllLoops(fadeOutSec = 0.08): void {
    for (const loop of [...this.loops]) loop.stop(fadeOutSec);
  }

  /** Full teardown (loops stopped, decoded buffers dropped). The bank remains usable after. */
  dispose(): void {
    this.stopAllLoops(0.02);
    for (const src of this.oneShots) {
      try {
        src.stop();
      } catch {
        /* ignore */
      }
    }
    this.oneShots.clear();
    this.slots.clear();
    this.lastPlayAt.clear();
  }

  // ── private helpers ──────────────────────────────────────────────────────────────────────────

  /** The seam's context iff it exists AND is running; also runs the suspend self-heal. */
  private runningContext(): AudioContext | null {
    const ctx = this.source?.getContext() ?? null;
    if (!ctx) return null;
    const state = ctx.state;
    // Self-heal (mirrors AudioBus): a suspended context freezes the clock, so `ended` events for
    // in-flight one-shots may never fire and the voice pool would pin at the cap. On re-entry to
    // "running", flush stranded one-shots. Live loops survive suspension natively — keep them.
    if (state === "running" && this.lastCtxState !== null && this.lastCtxState !== "running") {
      for (const src of this.oneShots) {
        try {
          src.stop();
        } catch {
          /* ignore */
        }
      }
      this.oneShots.clear();
      this.lastPlayAt.clear();
    }
    this.lastCtxState = state;
    return state === "running" ? ctx : null;
  }

  /** Tiered headroom mirroring AudioBus: low ≤ 6, normal ≤ 9, critical ≤ 12 (of MAX_VOICES=12). */
  private hasVoiceHeadroom(priority: SamplePriority): boolean {
    const live = this.oneShots.size + this.loops.size;
    const limit =
      priority === "critical"
        ? SampleBank.MAX_VOICES
        : priority === "normal"
          ? SampleBank.MAX_VOICES - 3
          : SampleBank.MAX_VOICES - 6;
    return live < limit;
  }

  private effectiveGain(id: string, volume?: number): number {
    const trim = GAIN_TRIM[id] ?? 1;
    return Math.max(0, Math.min(2, (volume ?? 1) * trim));
  }

  /** Route through a StereoPanner (when supported and pan requested) into the seam destination. */
  private connectOut(ctx: AudioContext, from: AudioNode, pan?: number): void {
    const dest = this.source?.getDestination?.() ?? ctx.destination;
    if (pan !== undefined && typeof ctx.createStereoPanner === "function") {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      from.connect(p);
      p.connect(dest);
    } else {
      from.connect(dest);
    }
  }

  /** URL of one variation file. `variations: N (≥2)` ⇒ `<id>-v1..vN.mp3`; else `<id>.mp3`. */
  private urlFor(id: string, variation: number | null): string {
    const dir = this.manifestUrl.slice(0, this.manifestUrl.lastIndexOf("/") + 1);
    return variation === null ? `${dir}${id}.mp3` : `${dir}${id}-v${variation}.mp3`;
  }

  /**
   * Fetch + decode every variation of an entry, once. Only ids the served manifest lists get here,
   * and the generator only lists rendered files — so misses are exceptional, handled quietly, and
   * never retried in a loop (state sticks at "failed" for the session).
   */
  private async ensureDecoded(entry: SfxManifestEntry): Promise<void> {
    if (this.slots.has(entry.id)) return;
    const slot: SampleSlot = { state: "loading", buffers: [], rr: 0 };
    this.slots.set(entry.id, slot);
    const ctx = this.source?.getContext() ?? null;
    if (!ctx || typeof fetch !== "function") {
      // No context yet (pre-gesture) — allow a retry once one exists.
      this.slots.delete(entry.id);
      return;
    }
    const count = entry.variations ?? 1;
    const urls: string[] =
      count > 1
        ? Array.from({ length: count }, (_, i) => this.urlFor(entry.id, i + 1))
        : [this.urlFor(entry.id, null)];
    const decoded = await Promise.all(
      urls.map(async (url): Promise<AudioBuffer | null> => {
        try {
          const res = await fetch(url);
          if (!res.ok) return null;
          const bytes = await res.arrayBuffer();
          return await ctx.decodeAudioData(bytes);
        } catch {
          return null;
        }
      }),
    );
    for (const buf of decoded) if (buf) slot.buffers.push(buf);
    slot.state = slot.buffers.length > 0 ? "ready" : "failed";
  }
}

/**
 * Shared singleton for the composition root (mirrors the game-registry-shared AudioBus pattern:
 * MenuScene/ArenaScene both reach one instance). Import-safe: constructing does no I/O.
 */
export const sampleBank = new SampleBank();
