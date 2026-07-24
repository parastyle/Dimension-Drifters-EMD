import { readFileSync } from "node:fs";
import { DEFAULT_CHARACTER, WHOLE_ART_CHARACTERS } from "@dd/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

const blobRuntime = vi.hoisted(() => ({
  textureState: "ready" as "ready" | "pending" | "missing",
  constructedRigs: [] as Array<{ args: unknown[]; rig: unknown }>,
}));

vi.mock("phaser", () => {
  const target = function PhaserStub() {};
  let stub: unknown;
  stub = new Proxy(target, {
    get(inner, property) {
      if (property === "prototype") return inner.prototype;
      if (property === Symbol.toPrimitive) return () => 0;
      return stub;
    },
    apply: () => 0,
    construct: () => ({}),
  });
  return { default: stub };
});

vi.mock("../sprites/whole-art-character.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../sprites/whole-art-character.js")>();
  return {
    ...actual,
    ensureWholeArtCharacterTextures: vi.fn(() => blobRuntime.textureState),
  };
});

vi.mock("../entities/SpriteRig.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../entities/SpriteRig.js")>();
  class SpriteRigStub {
    readonly setRigScale = vi.fn();
    readonly equipSyncedGear = vi.fn(() => true);
    readonly destroy = vi.fn();

    constructor(...args: unknown[]) {
      blobRuntime.constructedRigs.push({ args, rig: this });
    }
  }
  return { ...actual, SpriteRig: SpriteRigStub };
});

const { ArenaScene, resolveOrdinaryPlayerCharacterId } = await import("./ArenaScene.js");
const arenaSource = readFileSync(new URL("./ArenaScene.ts", import.meta.url), "utf8");

beforeEach(() => {
  blobRuntime.textureState = "ready";
  blobRuntime.constructedRigs.length = 0;
});

interface BlobSyncRigHarness {
  equipSyncedGear(
    gearUpper: string,
    gearLower: string,
    manifest: unknown,
    prestige: number,
  ): boolean;
}

interface BlobSyncPlayerHarness {
  character: string;
  dualWield: {
    gearUpper: string;
    gearLower: string;
    prestige: number;
  };
}

interface BlobSyncArenaHarness {
  room: {
    sessionId: string;
    state: {
      players: {
        forEach(callback: (player: BlobSyncPlayerHarness, id: string) => void): void;
        has(id: string): boolean;
      };
    };
  };
  blobs: Map<string, BlobSyncRigHarness>;
  charOf: Map<string, string>;
  addBlob(player: BlobSyncPlayerHarness, id: string): void;
  removeBlob(id: string): void;
  syncBlobs(): void;
}

function blobSyncScene(
  character: string,
  previouslyRenderedCharacter = character,
): {
  scene: BlobSyncArenaHarness;
  rig: BlobSyncRigHarness;
  addBlob: ReturnType<typeof vi.fn>;
  removeBlob: ReturnType<typeof vi.fn>;
} {
  const player: BlobSyncPlayerHarness = {
    character,
    dualWield: {
      gearUpper: "synced-upper",
      gearLower: "synced-lower",
      prestige: 2,
    },
  };
  const rig: BlobSyncRigHarness = {
    equipSyncedGear: vi.fn(() => true),
  };
  const addBlob = vi.fn();
  const removeBlob = vi.fn();
  const scene = Object.create(ArenaScene.prototype) as BlobSyncArenaHarness;
  scene.room = {
    sessionId: "local-player",
    state: {
      players: {
        forEach: (callback) => callback(player, "remote-player"),
        has: (id) => id === "remote-player",
      },
    },
  };
  scene.blobs = new Map([["remote-player", rig]]);
  scene.charOf = new Map([["remote-player", previouslyRenderedCharacter]]);
  scene.addBlob = addBlob;
  scene.removeBlob = removeBlob;
  return { scene, rig, addBlob, removeBlob };
}

describe("ArenaScene whole-art join handoff", () => {
  it("passes the bounded scene selection through unchanged for server validation", () => {
    const initStart = arenaSource.indexOf("  init(data?: {");
    const connectStart = arenaSource.indexOf("  private async connect(", initStart);
    const initSource = arenaSource.slice(initStart, connectStart);
    const joinStart = arenaSource.indexOf("        const joinOpts = {", connectStart);
    const joinEnd = arenaSource.indexOf("        };", joinStart);
    const joinSource = arenaSource.slice(joinStart, joinEnd);

    expect(initSource).toContain("selectedCharacterId?: WholeArtCharacter;");
    expect(initSource).toContain("this.selectedCharacterId = data?.selectedCharacterId;");
    expect(joinSource).toContain("selectedCharacterId: this.selectedCharacterId,");
    expect(joinSource).not.toContain("isWholeArtCharacter");
  });
});

interface BlobCreationRigHarness {
  setRigScale(scale: number): void;
  equipSyncedGear(...args: unknown[]): boolean;
}

interface BlobCreationArenaHarness {
  room: { sessionId: string };
  blobs: Map<string, BlobCreationRigHarness>;
  charOf: Map<string, string>;
  centerCam(x: number, y: number): void;
  addBlob(
    player: {
      x: number;
      y: number;
      character?: string;
      dualWield?: { gearUpper: string; gearLower: string; prestige: number };
    },
    id: string,
  ): void;
}

function createBlob(character: string | undefined): {
  scene: BlobCreationArenaHarness;
  rig?: BlobCreationRigHarness;
  args?: unknown[];
} {
  const scene = Object.create(ArenaScene.prototype) as BlobCreationArenaHarness;
  scene.room = { sessionId: "local-player" };
  scene.blobs = new Map();
  scene.charOf = new Map();
  scene.centerCam = vi.fn();
  scene.addBlob(
    {
      x: 120,
      y: 240,
      character,
      dualWield: {
        gearUpper: "legacy-upper-tail",
        gearLower: "legacy-lower-tail",
        prestige: 7,
      },
    },
    "remote-player",
  );
  const construction = blobRuntime.constructedRigs.at(-1);
  return {
    scene,
    rig: construction?.rig as BlobCreationRigHarness | undefined,
    args: construction?.args,
  };
}

describe("ArenaScene whole-art ordinary player creation", () => {
  it.each([
    undefined,
    "",
    "drifter",
    "cc-asha-the-ash-walker",
    "unknown-character",
  ])("renders legacy or missing character state %s as the shared default fallback", (characterId) => {
    const { scene, rig, args } = createBlob(characterId);

    expect(args?.[5]).toBe(DEFAULT_CHARACTER);
    expect(args).toHaveLength(6);
    expect(rig?.equipSyncedGear).not.toHaveBeenCalled();
    expect(scene.charOf.get("remote-player")).toBe(DEFAULT_CHARACTER);
  });

  it.each(
    WHOLE_ART_CHARACTERS,
  )("constructs selected whole-art character %s without entering the gear path", (characterId) => {
    expect(resolveOrdinaryPlayerCharacterId(characterId)).toBe(characterId);
    const { rig, args } = createBlob(characterId);

    expect(args?.[5]).toBe(characterId);
    expect(args).toHaveLength(6);
    expect(rig?.equipSyncedGear).not.toHaveBeenCalled();
  });

  it("does not flash the retained dummy while whole-art textures are pending", () => {
    blobRuntime.textureState = "pending";

    const { scene, rig, args } = createBlob(DEFAULT_CHARACTER);

    expect(args).toBeUndefined();
    expect(rig).toBeUndefined();
    expect(scene.blobs.size).toBe(0);
    expect(scene.charOf.size).toBe(0);
  });

  it("uses a visible retained base only after a terminal whole-art asset failure", () => {
    blobRuntime.textureState = "missing";
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      const { scene, rig, args } = createBlob("proto-wizard");

      expect(args?.[5]).toBe("drifter");
      expect(args).toHaveLength(6);
      expect(rig?.equipSyncedGear).not.toHaveBeenCalled();
      expect(scene.blobs.has("remote-player")).toBe(true);
      expect(scene.charOf.get("remote-player")).toBe("proto-wizard");
      expect(error).toHaveBeenCalledWith(
        expect.stringContaining(
          'whole-art character asset failure for "proto-wizard"; rendering retained "drifter" base',
        ),
      );
    } finally {
      error.mockRestore();
    }
  });
});

describe("ArenaScene whole-art render-mode synchronization", () => {
  it.each(
    WHOLE_ART_CHARACTERS,
  )("never sends legacy gear tails into an existing %s rig", (characterId) => {
    const { scene, rig, addBlob, removeBlob } = blobSyncScene(characterId);

    scene.syncBlobs();

    expect(rig.equipSyncedGear).not.toHaveBeenCalled();
    expect(removeBlob).not.toHaveBeenCalled();
    expect(addBlob).not.toHaveBeenCalled();
  });

  it("keeps legacy Drifter gear tails inert after they resolve visually to the shared default", () => {
    const { scene, rig, addBlob, removeBlob } = blobSyncScene("drifter", DEFAULT_CHARACTER);

    scene.syncBlobs();

    expect(rig.equipSyncedGear).not.toHaveBeenCalled();
    expect(removeBlob).not.toHaveBeenCalled();
    expect(addBlob).not.toHaveBeenCalled();
  });

  it("rebuilds for an authoritative whole-art-to-whole-art character change", () => {
    const { scene, rig, addBlob, removeBlob } = blobSyncScene("proto-samurai", DEFAULT_CHARACTER);

    scene.syncBlobs();

    expect(removeBlob).toHaveBeenCalledWith("remote-player");
    expect(addBlob).toHaveBeenCalledOnce();
    expect(rig.equipSyncedGear).not.toHaveBeenCalled();
  });
});
