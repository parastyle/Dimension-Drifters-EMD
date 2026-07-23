import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Client } from "../packages/client/node_modules/colyseus.js/build/esm/index.mjs";

const serverPort = Number(process.argv[2]);
const evidencePath = path.resolve(
  process.argv[3] ??
    "docs/owner-notes-audit-v9-evidence/b5-attackroot/live-dash-position.json",
);
if (!Number.isInteger(serverPort) || serverPort <= 0 || serverPort === 2567)
  throw new Error(`Expected a private server port, received ${process.argv[2]}`);

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
async function waitUntil(predicate, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = predicate();
    if (value) return value;
    await wait(20);
  }
  throw new Error(`${label} timed out after ${timeoutMs} ms`);
}

const client = new Client(`ws://127.0.0.1:${serverPort}`);
const room = await client.create("arena", { dimensionId: "shattered-frontier" });
const frames = [];
const sample = () => {
  const player = room.state?.players?.get(room.sessionId);
  if (!player) return;
  frames.push({
    observedAtMs: performance.now(),
    tick: room.state.tick,
    weapon: player.weapon,
    attackSeq: player.attackSeq,
    attackTick: player.attackTick,
    x: player.x,
    y: player.y,
    hp: player.hp,
  });
};
room.onStateChange(sample);

try {
  await waitUntil(() => room.state?.players?.get(room.sessionId), 10_000, "player join");
  room.send("toggleTraining");
  await waitUntil(() => room.state?.mode === "training", 10_000, "training mode");

  room.send("devEquip", { weapon: "x2-thunderhead-stormfists" });
  const storm = await waitUntil(
    () => {
      const player = room.state.players.get(room.sessionId);
      return player?.weapon === "x2-thunderhead-stormfists" ? player : undefined;
    },
    10_000,
    "Stormfists equip",
  );
  const stormStart = { x: storm.x, y: storm.y, seq: storm.attackSeq, tick: room.state.tick };
  const aimX = storm.x < 2_400 ? 1 : -1;
  room.send("attack", {
    aimX,
    aimY: 0,
    tx: storm.x + aimX * 480,
    ty: storm.y,
  });
  await waitUntil(
    () => room.state.players.get(room.sessionId)?.attackSeq !== stormStart.seq,
    10_000,
    "Stormfists acceptance",
  );
  await waitUntil(
    () => {
      const player = room.state.players.get(room.sessionId);
      return player && Math.hypot(player.x - stormStart.x, player.y - stormStart.y) > 0.01;
    },
    10_000,
    "Stormfists destination",
  );
  await wait(150);
  const stormEndPlayer = room.state.players.get(room.sessionId);
  const stormEnd = {
    x: stormEndPlayer.x,
    y: stormEndPlayer.y,
    seq: stormEndPlayer.attackSeq,
    tick: room.state.tick,
  };
  const stormFrames = frames.filter(
    (frame) =>
      frame.weapon === "x2-thunderhead-stormfists" &&
      frame.tick >= stormStart.tick &&
      frame.tick <= stormEnd.tick,
  );
  const stormTravel = Math.hypot(stormEnd.x - stormStart.x, stormEnd.y - stormStart.y);

  room.send("devEquip", { weapon: "x2-sparkknuckle-hex-mitt" });
  const spark = await waitUntil(
    () => {
      const player = room.state.players.get(room.sessionId);
      return player?.weapon === "x2-sparkknuckle-hex-mitt" ? player : undefined;
    },
    10_000,
    "Sparkknuckle equip",
  );
  const sparkStart = { x: spark.x, y: spark.y, seq: spark.attackSeq, tick: room.state.tick };
  let expectedSeq = sparkStart.seq;
  for (let beat = 0; beat < 4; beat++) {
    room.send("attack", {
      aimX: 1,
      aimY: 0,
      tx: sparkStart.x + 150,
      ty: sparkStart.y,
    });
    expectedSeq = (expectedSeq + 1) >>> 0;
    await waitUntil(
      () => room.state.players.get(room.sessionId)?.attackSeq === expectedSeq,
      10_000,
      `Sparkknuckle beat ${beat + 1}`,
    );
    await wait(380);
  }
  const sparkEndPlayer = room.state.players.get(room.sessionId);
  const sparkEnd = {
    x: sparkEndPlayer.x,
    y: sparkEndPlayer.y,
    seq: sparkEndPlayer.attackSeq,
    tick: room.state.tick,
  };
  const sparkTravel = Math.hypot(sparkEnd.x - sparkStart.x, sparkEnd.y - sparkStart.y);

  const evidence = {
    capturedAt: new Date().toISOString(),
    transport: `ws://127.0.0.1:${serverPort}`,
    privatePort: serverPort,
    stormfists: {
      start: stormStart,
      end: stormEnd,
      legalTravelPx: stormTravel,
      authoredDistancePx: 480,
      authoredDurationSeconds: 0.025,
      observedFrames: stormFrames,
      pass:
        stormEnd.seq === ((stormStart.seq + 1) >>> 0) &&
        stormTravel > 0 &&
        stormTravel <= 480 + 1e-6,
    },
    sparkknuckle: {
      start: sparkStart,
      end: sparkEnd,
      comboBeats: (sparkEnd.seq - sparkStart.seq) >>> 0,
      authoritativeTravelPx: sparkTravel,
      pass: ((sparkEnd.seq - sparkStart.seq) >>> 0) === 4 && sparkTravel <= 1e-6,
    },
    pass:
      stormEnd.seq === ((stormStart.seq + 1) >>> 0) &&
      stormTravel > 0 &&
      stormTravel <= 480 + 1e-6 &&
      ((sparkEnd.seq - sparkStart.seq) >>> 0) === 4 &&
      sparkTravel <= 1e-6,
  };
  await mkdir(path.dirname(evidencePath), { recursive: true });
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  if (!evidence.pass) throw new Error(`B5 live gate failed: ${JSON.stringify(evidence)}`);
  console.log(JSON.stringify(evidence, null, 2));
} finally {
  await room.leave();
}
