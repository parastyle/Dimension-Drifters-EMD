import { writeFile } from "node:fs/promises";
import { createMetaAccountV5, ROOM_NAME } from "@dd/shared";
import { Client } from "../../../packages/client/node_modules/colyseus.js/build/esm/index.mjs";

const GAME_URL = "ws://127.0.0.1:2591";
const CONTROL_URL = "http://127.0.0.1:2592";
const CHARACTER_ID = "proto-cowboy-hidden-face";
const OUTPUT = new URL("./live-network-evidence.json", import.meta.url);

const client = new Client(GAME_URL);
const account = createMetaAccountV5();
const room = await client.create(ROOM_NAME, {
  metaAccount: account,
  selectedCharacterId: CHARACTER_ID,
  belt: false,
});

function self(): any {
  return room.state?.players?.get?.(room.sessionId);
}

async function waitFor(predicate: () => boolean, label: string, timeoutMs = 10_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error(`timed out waiting for ${label}`);
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

await waitFor(() => !!self(), "joined player");
room.send("toggleTraining");
await waitFor(() => room.state?.mode === "training", "Testing Grounds");

async function stage(kind: string, augment = ""): Promise<any> {
  const response = await fetch(
    `${CONTROL_URL}/stage?kind=${encodeURIComponent(kind)}&augment=${encodeURIComponent(augment)}`,
  );
  if (!response.ok) throw new Error(`stage ${kind} failed: ${await response.text()}`);
  return response.json();
}

async function open(kind: string, augment = ""): Promise<{ staged: any; receipt: any }> {
  const staged = await stage(kind, augment);
  const receipt = await new Promise<any>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`no ${kind} chest receipt`)), 10_000);
    const dispose = room.onMessage("chestOpened", (payload) => {
      clearTimeout(timeout);
      dispose?.();
      resolve(payload);
    });
    room.send("openChest", { chestId: staged.chestId });
  });
  return { staged, receipt };
}

const opened = [];
for (const kind of ["money", "weapon", "trinket", "potion", "pet"]) {
  opened.push({ kind, ...(await open(kind)) });
}
const augmentChest = await open("augment", "hollowpoints");

room.send("devEquip", { weapon: "x-gun-revolver-cannon" });
await waitFor(() => self()?.weapon === "x-gun-revolver-cannon", "Revolver Cannon equip");
const combatSetupResponse = await fetch(`${CONTROL_URL}/combat`);
if (!combatSetupResponse.ok)
  throw new Error(`combat stage failed: ${await combatSetupResponse.text()}`);
const combatSetup = await combatSetupResponse.json();
await new Promise((resolve) => setTimeout(resolve, 100));

const seqBefore = self().attackSeq;
room.send("attack", { aimX: 1, aimY: 0, tx: 950, ty: 480 });
await waitFor(() => self().attackSeq > seqBefore, "accepted augmented shot");
await new Promise((resolve) => setTimeout(resolve, 500));

const targetIds = new Set(["b55-pierce-a", "b55-pierce-b"]);
const receipts: any[] = [];
room.state.combatReceipts.forEach((receipt: any) => {
  if (receipt.seq > 0 && targetIds.has(receipt.targetId)) {
    receipts.push({
      seq: receipt.seq,
      tick: receipt.tick,
      targetId: receipt.targetId,
      sourcePlayerId: receipt.sourcePlayerId,
      weaponId: receipt.weaponId,
      delivery: receipt.delivery,
      damage: receipt.damage,
    });
  }
});
receipts.sort((a, b) => a.seq - b.seq);

const evidence = {
  capturedAt: new Date().toISOString(),
  ports: { client: 5195, game: 2591, control: 2592 },
  forbiddenPortsUsed: false,
  character: self().character,
  mode: room.state.mode,
  opened: opened.map(({ kind, staged, receipt }) => ({
    kind,
    chestId: staged.chestId,
    seed: staged.roomSeed,
    receipt,
  })),
  augmentChest: {
    chestId: augmentChest.staged.chestId,
    seed: augmentChest.staged.roomSeed,
    receipt: augmentChest.receipt,
    synchronizedAugments: self().augments,
  },
  combatProof: {
    setup: combatSetup,
    attackSeqBefore: seqBefore,
    attackSeqAfter: self().attackSeq,
    hitTargets: receipts,
    distinctTargetsHit: new Set(receipts.map((receipt) => receipt.targetId)).size,
  },
  ultimateDisabled: {
    archetype: self().ultimate.archetype,
    charge: self().ultimate.charge,
    phase: self().ultimate.phase,
  },
};

await writeFile(OUTPUT, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
console.log(JSON.stringify(evidence, null, 2));
await room.leave();
