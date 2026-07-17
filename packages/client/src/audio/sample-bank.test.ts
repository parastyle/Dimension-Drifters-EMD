import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SampleBank, type SfxManifestEntry } from "./sample-bank.js";

/**
 * §50 soundkit — SampleBank unit suite (docs/soundkit-integration.md §7.1). Runs with a mocked
 * `fetch` and a stub AudioContext: no network, no real audio, no ElevenLabs key. The headline
 * invariant is the ABSENT WORLD (today's reality: zero samples on disk): every public call must be
 * a silent, throw-free no-op returning false/null so AudioBus's synth branches stay byte-identical.
 */

const MANIFEST_URL = "http://sfx.test/audio/sfx/manifest.json";

// ── stub audio graph ───────────────────────────────────────────────────────────────────────────

interface StubParam {
  value: number;
  setValueAtTime: ReturnType<typeof vi.fn>;
  exponentialRampToValueAtTime: ReturnType<typeof vi.fn>;
  setTargetAtTime: ReturnType<typeof vi.fn>;
}

function stubParam(): StubParam {
  return {
    value: 1,
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn(),
  };
}

class StubSource {
  buffer: { byteLength: number } | null = null;
  loop = false;
  playbackRate = stubParam();
  started = false;
  stopCalls = 0;
  private readonly listeners = new Map<string, Array<() => void>>();
  constructor(private readonly onStart: (s: StubSource) => void) {}
  connect(node: unknown): unknown {
    return node;
  }
  start(): void {
    this.started = true;
    this.onStart(this);
  }
  stop(_when?: number): void {
    this.stopCalls++;
  }
  addEventListener(type: string, fn: () => void): void {
    const list = this.listeners.get(type) ?? [];
    list.push(fn);
    this.listeners.set(type, list);
  }
  emit(type: string): void {
    for (const fn of this.listeners.get(type) ?? []) fn();
  }
}

interface StubCtx {
  state: AudioContextState;
  currentTime: number;
  destination: object;
  createBufferSource(): StubSource;
  createGain(): { gain: StubParam; connect(n: unknown): unknown };
  createStereoPanner(): { pan: StubParam; connect(n: unknown): unknown };
  decodeAudioData(bytes: ArrayBuffer): Promise<AudioBuffer>;
}

/** A stub context whose decodeAudioData tags buffers with the fetched byte length, so round-robin
 *  order is observable via `started[i].buffer.byteLength`. */
function makeCtx(): { ctx: StubCtx; started: StubSource[] } {
  const started: StubSource[] = [];
  const ctx: StubCtx = {
    state: "running",
    currentTime: 0,
    destination: {},
    createBufferSource: () => new StubSource((s) => started.push(s)),
    createGain: () => ({ gain: stubParam(), connect: (n: unknown) => n }),
    createStereoPanner: () => ({ pan: stubParam(), connect: (n: unknown) => n }),
    decodeAudioData: (bytes: ArrayBuffer) =>
      Promise.resolve({ byteLength: bytes.byteLength } as unknown as AudioBuffer),
  };
  return { ctx, started };
}

function asCtx(ctx: StubCtx | null): AudioContext | null {
  return ctx as unknown as AudioContext | null;
}

// ── mocked fetch ───────────────────────────────────────────────────────────────────────────────

/** `manifest === null` ⇒ 404 (the absent world). `files` maps basename → fake byte length. */
function mockFetch(manifest: unknown, files: Record<string, number> = {}) {
  const calls: string[] = [];
  const fn = vi.fn(async (url: unknown): Promise<unknown> => {
    const u = String(url);
    calls.push(u);
    if (u.endsWith("manifest.json")) {
      if (manifest === null) return { ok: false, status: 404 };
      return { ok: true, json: async () => manifest };
    }
    const size = files[u.slice(u.lastIndexOf("/") + 1)];
    if (size === undefined) return { ok: false, status: 404 };
    return { ok: true, arrayBuffer: async () => new ArrayBuffer(size) };
  });
  vi.stubGlobal("fetch", fn);
  return { fn, calls };
}

/** Let the fire-and-forget decode chain (fetch → arrayBuffer → decodeAudioData) settle. */
async function flush(): Promise<void> {
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));
}

const entry = (over: Partial<SfxManifestEntry> & { id: string }): SfxManifestEntry => ({
  category: "test",
  priority: "P0",
  prompt: "",
  durationSeconds: 0.3,
  loop: false,
  ...over,
});

const MANIFEST: SfxManifestEntry[] = [
  entry({ id: "foo", variations: 3, replaces: "hit" }),
  entry({ id: "solo" }),
  entry({ id: "hum", loop: true, durationSeconds: 2.4 }),
];
const FILES: Record<string, number> = {
  "foo-v1.mp3": 1,
  "foo-v2.mp3": 2,
  "foo-v3.mp3": 3,
  "solo.mp3": 7,
  "hum.mp3": 10,
};

/** A bank with manifest + `foo` decoded and ready (the common warm starting point). */
async function readyBank(): Promise<{ bank: SampleBank; ctx: StubCtx; started: StubSource[] }> {
  mockFetch(MANIFEST, FILES);
  const { ctx, started } = makeCtx();
  const bank = new SampleBank({ getContext: () => asCtx(ctx) }, MANIFEST_URL);
  await bank.loadManifest();
  bank.sampleAvailable("foo"); // kick the lazy decode
  bank.sampleAvailable("hum");
  await flush();
  return { bank, ctx, started };
}

beforeEach(() => {
  vi.spyOn(console, "log");
  vi.spyOn(console, "warn");
  vi.spyOn(console, "error");
});

afterEach(() => {
  expect(console.log).not.toHaveBeenCalled();
  expect(console.warn).not.toHaveBeenCalled();
  expect(console.error).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("absent world (today's default: no manifest on disk)", () => {
  it("resolves quietly, no-ops every call, and fetches exactly once", async () => {
    const { fn } = mockFetch(null);
    const { ctx } = makeCtx();
    const bank = new SampleBank({ getContext: () => asCtx(ctx) }, MANIFEST_URL);
    await bank.loadManifest();
    await bank.loadManifest(); // idempotent
    for (let i = 0; i < 5; i++) {
      expect(bank.sampleAvailable("foo")).toBe(false);
      expect(bank.playSample("foo")).toBe(false);
      expect(bank.startLoop("hum")).toBeNull();
    }
    expect(bank.sampleForCue("hit")).toBeNull();
    bank.preload(["foo", "hum"]);
    await flush();
    expect(fn).toHaveBeenCalledTimes(1); // ONE manifest probe, zero per-file 404s
  });
});

describe("no context (pre-gesture)", () => {
  it("returns false without a context, then decodes once one appears", async () => {
    const { calls } = mockFetch(MANIFEST, FILES);
    let live: StubCtx | null = null;
    const bank = new SampleBank({ getContext: () => asCtx(live) }, MANIFEST_URL);
    await bank.loadManifest();
    expect(bank.playSample("foo")).toBe(false);
    expect(bank.sampleAvailable("foo")).toBe(false); // kicks decode → aborts (no ctx), slot released
    await flush();
    expect(calls.filter((u) => u.includes("foo-v"))).toHaveLength(0);
    const { ctx } = makeCtx();
    live = ctx;
    expect(bank.sampleAvailable("foo")).toBe(false); // retry now that a context exists
    await flush();
    expect(bank.sampleAvailable("foo")).toBe(true);
    expect(bank.playSample("foo")).toBe(true);
  });
});

describe("availability lifecycle", () => {
  it("first query is false + exactly one fetch per variation; flips true after decode", async () => {
    const { calls } = mockFetch(MANIFEST, FILES);
    const { ctx } = makeCtx();
    const bank = new SampleBank({ getContext: () => asCtx(ctx) }, MANIFEST_URL);
    await bank.loadManifest();
    expect(bank.sampleAvailable("foo")).toBe(false);
    expect(bank.sampleAvailable("foo")).toBe(false); // second query must not re-fetch
    await flush();
    expect(calls.filter((u) => u.includes("foo-v")).sort()).toEqual([
      "http://sfx.test/audio/sfx/foo-v1.mp3",
      "http://sfx.test/audio/sfx/foo-v2.mp3",
      "http://sfx.test/audio/sfx/foo-v3.mp3",
    ]);
    expect(bank.sampleAvailable("foo")).toBe(true);
    expect(bank.sampleForCue("hit")).toBe("foo");
  });

  it("skips malformed manifests and invalid entries quietly", async () => {
    mockFetch({ not: "an array" });
    const { ctx } = makeCtx();
    const bank = new SampleBank({ getContext: () => asCtx(ctx) }, MANIFEST_URL);
    await bank.loadManifest();
    expect(bank.manifestEntries().size).toBe(0);
    expect(bank.playSample("anything")).toBe(false);

    vi.unstubAllGlobals();
    mockFetch([{ id: "" }, { noId: true }, 42, null]);
    const bank2 = new SampleBank({ getContext: () => asCtx(ctx) }, MANIFEST_URL);
    await bank2.loadManifest();
    expect(bank2.manifestEntries().size).toBe(0); // nothing valid ⇒ absent
    expect(bank2.startLoop("hum")).toBeNull();
  });
});

describe("playback", () => {
  it("round-robins variations: v1, v2, v3, v1", async () => {
    const { bank, started } = await readyBank();
    for (let i = 0; i < 4; i++) expect(bank.playSample("foo")).toBe(true);
    expect(started.map((s) => s.buffer?.byteLength)).toEqual([1, 2, 3, 1]);
  });

  it("minIntervalMs: suppressed calls return TRUE (handled-silent) with one source started", async () => {
    const { bank, ctx, started } = await readyBank();
    expect(bank.playSample("foo", { minIntervalMs: 30 })).toBe(true); // played
    expect(bank.playSample("foo", { minIntervalMs: 30 })).toBe(true); // suppressed, NOT false
    expect(started).toHaveLength(1);
    ctx.currentTime += 0.05; // past the window
    expect(bank.playSample("foo", { minIntervalMs: 30 })).toBe(true);
    expect(started).toHaveLength(2);
  });

  it("voice cap tiers: low ≤ 6, normal ≤ 9, critical ≤ 12 — refusals return false, never throw", async () => {
    const { bank } = await readyBank();
    for (let i = 0; i < 6; i++) expect(bank.playSample("foo")).toBe(true);
    expect(bank.playSample("foo", { priority: "low" })).toBe(false);
    for (let i = 6; i < 9; i++) expect(bank.playSample("foo")).toBe(true);
    expect(bank.playSample("foo", { priority: "normal" })).toBe(false);
    for (let i = 9; i < 12; i++)
      expect(bank.playSample("foo", { priority: "critical" })).toBe(true);
    expect(bank.playSample("foo", { priority: "critical" })).toBe(false);
    expect(bank.playSample("foo", { priority: "normal" })).toBe(false);
    expect(bank.playSample("foo", { priority: "low" })).toBe(false);
  });

  it("releases a voice when a one-shot ends", async () => {
    const { bank, started } = await readyBank();
    for (let i = 0; i < 12; i++) bank.playSample("foo", { priority: "critical" });
    expect(bank.playSample("foo", { priority: "critical" })).toBe(false);
    started[0]?.emit("ended");
    expect(bank.playSample("foo", { priority: "critical" })).toBe(true);
  });
});

describe("loops", () => {
  it("startLoop returns a live handle; stop is idempotent and releases the voice", async () => {
    const { bank, started } = await readyBank();
    const h = bank.startLoop("hum");
    expect(h).not.toBeNull();
    expect(h?.alive).toBe(true);
    expect(started.at(-1)?.loop).toBe(true);
    h?.setVolume(0.5); // no throw while alive
    h?.stop();
    expect(h?.alive).toBe(false);
    h?.stop(); // safe twice
    expect(started.at(-1)?.stopCalls).toBe(1);
    // Voice slot released: the (12-voice) pool accepts a full refill.
    for (let i = 0; i < 12; i++)
      expect(bank.playSample("foo", { priority: "critical" })).toBe(true);
  });

  it("stopAllLoops sweeps every live loop (the blanket teardown net)", async () => {
    const { bank, started } = await readyBank();
    const a = bank.startLoop("hum");
    const b = bank.startLoop("hum");
    expect(a?.alive).toBe(true);
    expect(b?.alive).toBe(true);
    bank.stopAllLoops(0.05);
    expect(a?.alive).toBe(false);
    expect(b?.alive).toBe(false);
    expect(started.filter((s) => s.loop && s.stopCalls > 0)).toHaveLength(2);
  });

  it("startLoop on a missing/undecoded id returns null (synth sustain keeps running)", async () => {
    mockFetch(MANIFEST, FILES);
    const { ctx } = makeCtx();
    const bank = new SampleBank({ getContext: () => asCtx(ctx) }, MANIFEST_URL);
    await bank.loadManifest();
    expect(bank.startLoop("hum")).toBeNull(); // kicks decode, still loading
    expect(bank.startLoop("nope")).toBeNull(); // unlisted id — never touches the network
  });
});

describe("suspend self-heal", () => {
  it("flushes stranded one-shots when the context re-enters running", async () => {
    const { bank, ctx, started } = await readyBank();
    for (let i = 0; i < 12; i++) bank.playSample("foo", { priority: "critical" });
    expect(bank.playSample("foo", { priority: "critical" })).toBe(false); // pinned at the cap
    ctx.state = "suspended";
    expect(bank.playSample("foo")).toBe(false); // frozen clock ⇒ refuse quietly
    ctx.state = "running";
    expect(bank.playSample("foo", { priority: "critical" })).toBe(true); // pool flushed
    expect(started.slice(0, 12).every((s) => s.stopCalls > 0)).toBe(true);
  });
});
