import { expect, test } from "@playwright/test";
import { bootArena, runArenaSpec } from "../helpers/arena-harness.js";

/**
 * MOVEMENT JITTER PROBE (§7 owner report 2026-07-18): drive a continuous ultra-tight
 * 8-direction circle exactly like keyboard play and measure the RENDERED self-rig
 * per-frame displacement plus the synced server position, to locate the "jumpy /
 * teleports a little in each direction" pops (predictor vs reconciliation vs law).
 * The stats print to stdout; the assertions are the minimal liveness bounds so the
 * probe stays green while tuning work is in flight.
 */

interface Sample {
  t: number;
  delta: number;
  rx: number;
  ry: number;
  sx: number;
  sy: number;
  teleportSeq: number;
  fellSeq: number;
}

interface InputTrace {
  kind: "sent" | "predicted" | "applied";
  tick: number;
  seq: number;
  dx: number;
  dy: number;
}

interface ProbePlayer {
  x: number;
  y: number;
  ackSeq: number;
  teleportSeq: number;
  fellSeq: number;
}

interface ProbeArena {
  room: {
    sessionId: string;
    state: { tick: number; players: { get(id: string): ProbePlayer | undefined } };
    send(type: string, payload?: unknown): unknown;
    onStateChange(callback: (state: ProbeArena["room"]["state"]) => void): void;
  };
  predictor: {
    tick(cmd: { seq: number; dx: number; dy: number }): void;
  };
  blobs: { get(id: string): { x: number; y: number } };
  events: { on(type: string, callback: (time: number, delta: number) => void): void };
}

test("tight-circle jitter probe: per-frame rig displacement stats", async ({ page }) => {
  await runArenaSpec(page, async (baseURL) => {
    await bootArena(page, baseURL, "weapon:rusty-cleaver");

    // Install the sampler inside Phaser's loop BEFORE driving input.
    await page.evaluate(() => {
      const game = (
        globalThis as unknown as { ddGame?: { scene: { keys: { arena: ProbeArena } } } }
      ).ddGame;
      if (!game) throw new Error("probe requires the live arena scene");
      const arena = game.scene.keys.arena;
      const id = arena.room.sessionId;
      const rig = arena.blobs.get(id);
      const samples: unknown[] = [];
      const inputTrace: InputTrace[] = [];
      (globalThis as unknown as { __probe?: unknown[] }).__probe = samples;
      (globalThis as unknown as { __inputTrace?: InputTrace[] }).__inputTrace = inputTrace;
      const sentBySeq = new Map<number, { dx: number; dy: number }>();
      const originalSend = arena.room.send.bind(arena.room);
      arena.room.send = (type: string, payload?: unknown) => {
        const input = payload as { seq?: number; dx?: number; dy?: number } | undefined;
        if (type === "input" && typeof input?.seq === "number") {
          const row = { dx: input.dx ?? 0, dy: input.dy ?? 0 };
          sentBySeq.set(input.seq, row);
          inputTrace.push({ kind: "sent", tick: arena.room.state.tick, seq: input.seq, ...row });
        }
        return originalSend(type, payload);
      };
      const originalPredict = arena.predictor.tick.bind(arena.predictor);
      arena.predictor.tick = (cmd: { seq: number; dx: number; dy: number }) => {
        inputTrace.push({
          kind: "predicted",
          tick: arena.room.state.tick,
          seq: cmd.seq,
          dx: cmd.dx,
          dy: cmd.dy,
        });
        return originalPredict(cmd);
      };
      let lastAppliedTick = -1;
      arena.room.onStateChange((state) => {
        if (state.tick === lastAppliedTick) return;
        lastAppliedTick = state.tick;
        const self = state.players.get(id);
        const cmd = sentBySeq.get(self?.ackSeq) ?? { dx: 0, dy: 0 };
        inputTrace.push({
          kind: "applied",
          tick: state.tick,
          seq: self?.ackSeq ?? 0,
          dx: cmd.dx,
          dy: cmd.dy,
        });
      });
      arena.events.on("postupdate", (time: number, delta: number) => {
        const self = arena.room.state.players.get(id);
        samples.push({
          t: time,
          delta,
          rx: rig.x,
          ry: rig.y,
          sx: self?.x,
          sy: self?.y,
          teleportSeq: self?.teleportSeq ?? 0,
          fellSeq: self?.fellSeq ?? 0,
        });
      });
    });

    // Drive the tight circle with REAL key events: 8 compass steps, 140ms each, ~5.6s.
    const seq: string[][] = [
      ["d"],
      ["d", "s"],
      ["s"],
      ["s", "a"],
      ["a"],
      ["a", "w"],
      ["w"],
      ["w", "d"],
    ];
    const held = new Set<string>();
    for (let step = 0; step < 40; step++) {
      const want = seq[step % seq.length];
      for (const k of [...held])
        if (!want.includes(k)) {
          await page.keyboard.up(k);
          held.delete(k);
        }
      for (const k of want)
        if (!held.has(k)) {
          await page.keyboard.down(k);
          held.add(k);
        }
      await page.waitForTimeout(140);
    }
    for (const k of [...held]) await page.keyboard.up(k);

    const stats = await page.evaluate(() => {
      const s = (globalThis as unknown as { __probe: Sample[] }).__probe;
      const inputTrace = (globalThis as unknown as { __inputTrace: InputTrace[] }).__inputTrace;
      const steps: { i: number; d: number; ang: number; legalCut: boolean }[] = [];
      const serverSteps: { i: number; sd: number }[] = [];
      for (let i = 1; i < s.length; i++) {
        const dx = s[i].rx - s[i - 1].rx;
        const dy = s[i].ry - s[i - 1].ry;
        const legalCut =
          s[i].teleportSeq !== s[i - 1].teleportSeq || s[i].fellSeq !== s[i - 1].fellSeq;
        steps.push({ i, d: Math.hypot(dx, dy), ang: Math.atan2(dy, dx), legalCut });
        const sd = Math.hypot(s[i].sx - s[i - 1].sx, s[i].sy - s[i - 1].sy);
        if (sd > 0.01) serverSteps.push({ i, sd });
      }
      // Authored pit/blink teleports are intentional cuts. Keep them visible as a separate readout while
      // holding ordinary reconciliation to the no-spike/no-reversal contract.
      const legalCutSteps = steps.filter((x) => x.legalCut && x.d > 0.3);
      const moving = steps.filter((x) => !x.legalCut && x.d > 0.3);
      const ds = moving.map((x) => x.d).sort((a, b) => a - b);
      const q = (p: number) => ds[Math.floor(ds.length * p)] ?? 0;
      const med = q(0.5);
      const spikes = moving.filter((x) => x.d > Math.max(med * 2.2, 3));
      let angJumps = 0;
      const angJumpSizes: number[] = [];
      for (let i = 1; i < moving.length; i++) {
        if (moving[i].i !== moving[i - 1].i + 1) continue;
        let da = Math.abs(moving[i].ang - moving[i - 1].ang);
        if (da > Math.PI) da = 2 * Math.PI - da;
        if (da > Math.PI / 2 && moving[i].d > 2 && moving[i - 1].d > 2) {
          angJumps++;
          angJumpSizes.push(da);
        }
      }
      const sds = serverSteps.map((x) => x.sd).sort((a, b) => a - b);
      const sMed = sds[Math.floor(sds.length / 2)] ?? 0;
      const bigPatch = new Set(serverSteps.filter((x) => x.sd > sMed * 1.6).map((x) => x.i));
      const spikesNearPatch = spikes.filter(
        (x) => bigPatch.has(x.i) || bigPatch.has(x.i - 1) || bigPatch.has(x.i + 1),
      ).length;
      const sentInputs = inputTrace.filter((x) => x.kind === "sent");
      const predictedInputs = inputTrace.filter((x) => x.kind === "predicted");
      const appliedInputs = inputTrace.filter((x) => x.kind === "applied");
      let adoptedInputs = 0;
      let skippedInputs = 0;
      let previousAck = appliedInputs[0]?.seq ?? 0;
      for (const row of appliedInputs.slice(1)) {
        if (row.seq === previousAck) continue;
        const advance = (row.seq - previousAck) >>> 0;
        adoptedInputs++;
        if (advance > 1 && advance < 0x80000000) skippedInputs += advance - 1;
        previousAck = row.seq;
      }
      return {
        frames: steps.length,
        movingFrames: moving.length,
        medStep: +med.toFixed(2),
        p95Step: +q(0.95).toFixed(2),
        maxStep: +(ds[ds.length - 1] ?? 0).toFixed(2),
        spikes: spikes.length,
        spikeSizes: spikes.slice(0, 10).map((x) => +x.d.toFixed(1)),
        legalTeleportCuts: legalCutSteps.length,
        legalTeleportMaxStep: +Math.max(0, ...legalCutSteps.map((x) => x.d)).toFixed(1),
        stalls: steps.length - moving.length,
        angJumps,
        angJumpSizesDeg: angJumpSizes.slice(0, 10).map((a) => Math.round((a * 180) / Math.PI)),
        serverPatchSteps: serverSteps.length,
        serverMedStep: +sMed.toFixed(1),
        serverMaxStep: +(sds[sds.length - 1] ?? 0).toFixed(1),
        spikesNearPatch,
        sentInputs: sentInputs.length,
        predictedInputs: predictedInputs.length,
        serverTicks: appliedInputs.length,
        adoptedInputs,
        skippedInputs,
        adoptionTrace: appliedInputs
          .filter((row, i) => i === 0 || row.seq !== appliedInputs[i - 1]?.seq)
          .slice(0, 16)
          .map((row) => `${row.tick}:${row.seq}:${row.dx},${row.dy}`),
      };
    });

    console.log(`[jitter-probe] ${JSON.stringify(stats)}`);
    expect(stats.frames).toBeGreaterThan(150);
    expect(stats.movingFrames).toBeGreaterThan(100);
    expect(stats.angJumps).toBe(0);
    expect(stats.spikes).toBe(0);
    expect(stats.maxStep).toBeLessThanOrEqual(stats.medStep * 2.2);
  });
});
