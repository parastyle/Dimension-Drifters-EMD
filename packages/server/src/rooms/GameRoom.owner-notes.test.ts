import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WEAPONS } from "@dd/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface TestClient {
  sessionId: string;
  send: ReturnType<typeof vi.fn>;
}

vi.mock("colyseus", () => {
  class Room {
    state: unknown;
    clients: TestClient[] = [];
    roomId = "owner-notes-test";
    setState(state: unknown): void {
      this.state = state;
    }
    onMessage(): void {}
    setSimulationInterval(): void {}
    setPatchRate(): void {}
    broadcast(): void {}
    broadcastPatch(): void {}
  }
  return { Room, Client: class {} };
});

const { GameRoom } = await import("./GameRoom.js");

type Handler = (client: TestClient, message?: unknown) => void;
// biome-ignore lint/suspicious/noExplicitAny: focused room harness deliberately reaches registration seams.
type AnyRoom = any;

let scratchDir = "";
let notesPath = "";
let priorNodeEnv: string | undefined;
let priorDevTools: string | undefined;
let priorNotesPath: string | undefined;

beforeEach(() => {
  scratchDir = mkdtempSync(join(tmpdir(), "dd-owner-notes-"));
  notesPath = join(scratchDir, "nested", "owner-notes.jsonl");
  priorNodeEnv = process.env.NODE_ENV;
  priorDevTools = process.env.DD_DEV_TOOLS;
  priorNotesPath = process.env.DD_OWNER_NOTES_PATH;
  process.env.NODE_ENV = "test";
  process.env.DD_DEV_TOOLS = "1";
  process.env.DD_OWNER_NOTES_PATH = notesPath;
});

afterEach(() => {
  if (priorNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = priorNodeEnv;
  if (priorDevTools === undefined) delete process.env.DD_DEV_TOOLS;
  else process.env.DD_DEV_TOOLS = priorDevTools;
  if (priorNotesPath === undefined) delete process.env.DD_OWNER_NOTES_PATH;
  else process.env.DD_OWNER_NOTES_PATH = priorNotesPath;
  rmSync(scratchDir, { recursive: true, force: true });
});

function makeRoom() {
  const room = new GameRoom() as AnyRoom;
  const handlers = new Map<string, Handler>();
  room.onMessage = (type: string, handler: Handler) => handlers.set(type, handler);
  room.clients = [];
  room.onCreate();
  const client: TestClient = { sessionId: "owner-session", send: vi.fn() };
  room.clients.push(client);
  room.onJoin(client);
  return {
    room,
    client,
    send(type: string, message?: unknown): void {
      handlers.get(type)?.(client, message);
    },
  };
}

function records(): Record<string, unknown>[] {
  return readFileSync(notesPath, "utf8")
    .trimEnd()
    .split("\n")
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

describe("GameRoom owner-note persistence", () => {
  it("appends valid JSONL and derives weapon context from the authoritative active slot", () => {
    const harness = makeRoom();
    harness.send("toggleTraining");
    const player = harness.room.state.players.get(harness.client.sessionId);
    player.weapon = "gravediggers-spade";

    harness.send("ownerNote", {
      type: "weapon",
      note: "  first line\r\nsecond line\u0000  ",
      weaponId: "client-spoof",
      weaponName: "Client Spoof",
    });
    harness.send("ownerNote", { type: "game", note: "General follow-up" });

    const [weapon, game] = records();
    expect(weapon).toMatchObject({
      session: harness.client.sessionId,
      mode: "training",
      type: "weapon",
      weaponId: player.weapon,
      weaponName: WEAPONS[player.weapon]?.name,
      note: "first line\nsecond line",
    });
    expect(Number.isNaN(Date.parse(String(weapon?.ts)))).toBe(false);
    expect(game).toMatchObject({
      session: harness.client.sessionId,
      mode: "training",
      type: "game",
      note: "General follow-up",
    });
    expect(game).not.toHaveProperty("weaponId");
    expect(game).not.toHaveProperty("weaponName");
    expect(harness.client.send).toHaveBeenCalledWith("ownerNoteAck", { saved: true });
  });

  it("caps accepted note text at 2000 characters", () => {
    const harness = makeRoom();
    harness.send("toggleTraining");
    harness.send("ownerNote", { type: "game", note: "x".repeat(2_500) });

    expect(records()[0]?.note).toHaveLength(2_000);
  });

  it("rejects writes outside training and when dev tools are disabled", () => {
    const harness = makeRoom();
    harness.send("ownerNote", { type: "game", note: "arena attempt" });
    expect(existsSync(notesPath)).toBe(false);
    expect(harness.client.send).toHaveBeenLastCalledWith("ownerNoteAck", {
      saved: false,
      reason: "Testing Grounds only",
    });

    harness.send("toggleTraining");
    delete process.env.DD_DEV_TOOLS;
    harness.send("ownerNote", { type: "game", note: "production attempt" });
    expect(existsSync(notesPath)).toBe(false);
    expect(harness.client.send).toHaveBeenLastCalledWith("ownerNoteAck", {
      saved: false,
      reason: "dev tools disabled",
    });
  });
});
