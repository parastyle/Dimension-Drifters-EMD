import { readFileSync } from "node:fs";
import { DEFAULT_CHARACTER, WEAPONS, type WeaponDef, WHOLE_ART_CHARACTERS } from "@dd/shared";
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

const { ArenaScene } = await import("./ArenaScene.js");
const arenaSource = readFileSync(new URL("./ArenaScene.ts", import.meta.url), "utf8");

beforeEach(() => {
  blobRuntime.textureState = "ready";
  blobRuntime.constructedRigs.length = 0;
});

type EquipPiece = { def: WeaponDef };

interface RigHarness {
  weaponSwapPending: boolean;
  heldWeaponDef(hand: 0 | 1): WeaponDef | undefined;
  setDualWieldBaseSeq(pairBaseSeq: number): void;
  beginWeaponSwap(oldId: string, newId: string, epochMs: number): void;
  unequip(def: WeaponDef, preservePendingSwap?: boolean): void;
  equipLoadout(lead: EquipPiece, off?: EquipPiece, pairBaseSeq?: number): void;
  equipWeapon(spriteId: string, def: WeaponDef): void;
  setAttackBeat(seq: number, held: boolean, epochMs: number): void;
  finishWeaponSwapWithoutArt(): void;
}

interface ArenaHarness {
  room: {
    sessionId: string;
    state: {
      players: {
        forEach(callback: (player: PlayerHarness, id: string) => void): void;
      };
    };
  };
  blobs: Map<string, RigHarness>;
  equipped: Map<string, string>;
  equippedOffhand: Map<string, string>;
  failedArt: Set<string>;
  pendingArt: Set<string>;
  animClock: number;
  ensureWeaponArt(spriteId: string): boolean;
  attackClientEpoch(tick: number, remote: boolean): number;
  equipWeapons(): void;
}

interface PlayerHarness {
  weapon: string;
  activeSlot: number;
  slots: Array<{ weapon: string }>;
  dualWield?: { offhandSlot: number; pairBaseSeq: number };
  attackSeq: number;
  attackHeld: boolean;
  attackTick: number;
}

// ARM-WPN-01 — append-only render-boundary coverage for remote bind, lazy swap, and unbind.
describe("ArenaScene dual-wield render synchronization", () => {
  it("equips the nested linked row into hand 1 and restores single stance when the link clears", () => {
    const player: PlayerHarness = {
      weapon: "rattler-sabre",
      activeSlot: 0,
      slots: [{ weapon: "rattler-sabre" }, { weapon: "x-sword-neon-katana" }],
      dualWield: { offhandSlot: 1, pairBaseSeq: 17 },
      attackSeq: 19,
      attackHeld: false,
      attackTick: 44,
    };
    let held: [WeaponDef | undefined, WeaponDef | undefined] = [undefined, undefined];
    let lazyArtReady = true;
    const beginWeaponSwap = vi.fn((_oldId: string, _newId: string, _epochMs: number) => {
      rig.weaponSwapPending = true;
    });
    const unequip = vi.fn((_def: WeaponDef, _preservePendingSwap?: boolean) => {
      held = [undefined, undefined];
    });
    const equipLoadout = vi.fn((lead: EquipPiece, off?: EquipPiece) => {
      held = [lead.def, off?.def];
      rig.weaponSwapPending = false;
    });
    const equipWeapon = vi.fn((_spriteId: string, def: WeaponDef) => {
      held = [def, undefined];
      rig.weaponSwapPending = false;
    });
    const rig: RigHarness = {
      weaponSwapPending: false,
      heldWeaponDef: (hand) => held[hand],
      setDualWieldBaseSeq: vi.fn(),
      beginWeaponSwap,
      unequip,
      equipLoadout,
      equipWeapon,
      setAttackBeat: vi.fn(),
      finishWeaponSwapWithoutArt: vi.fn(),
    };
    const scene = Object.create(ArenaScene.prototype) as ArenaHarness;
    scene.room = {
      sessionId: "local-player",
      state: { players: { forEach: (callback) => callback(player, "remote-player") } },
    };
    scene.blobs = new Map([["remote-player", rig]]);
    scene.equipped = new Map();
    scene.equippedOffhand = new Map();
    scene.failedArt = new Set();
    scene.pendingArt = new Set();
    scene.animClock = 1_000;
    scene.ensureWeaponArt = vi.fn((spriteId) =>
      spriteId === "x2-sandsong-saber" ? lazyArtReady : true,
    );
    scene.attackClientEpoch = vi.fn((_tick, remote) => {
      expect(remote).toBe(true);
      return 900;
    });

    scene.equipWeapons();

    expect(held.map((def) => def?.id)).toEqual(["rattler-sabre", "x-sword-neon-katana"]);
    expect(equipLoadout).toHaveBeenLastCalledWith(
      expect.objectContaining({ def: WEAPONS["rattler-sabre"] }),
      expect.objectContaining({ def: WEAPONS["x-sword-neon-katana"] }),
      17,
    );

    player.slots[1]!.weapon = "x2-sandsong-saber";
    player.dualWield!.pairBaseSeq = 23;
    lazyArtReady = false;
    scene.equipWeapons();

    expect(beginWeaponSwap).toHaveBeenLastCalledWith(
      "rattler-sabre|x-sword-neon-katana",
      "rattler-sabre|x2-sandsong-saber",
      1_000,
    );
    expect(unequip).toHaveBeenLastCalledWith(WEAPONS["rattler-sabre"], true);
    expect(held).toEqual([undefined, undefined]);

    lazyArtReady = true;
    scene.equipWeapons();
    expect(held.map((def) => def?.id)).toEqual(["rattler-sabre", "x2-sandsong-saber"]);
    expect(equipLoadout).toHaveBeenCalledTimes(2);

    player.dualWield!.offhandSlot = 255;
    scene.equipWeapons();

    expect(equipWeapon).toHaveBeenCalledOnce();
    expect(held.map((def) => def?.id)).toEqual(["rattler-sabre", undefined]);
    expect(scene.equippedOffhand.get("remote-player")).toBe("");
  });
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
  ])("renders legacy or missing character state %s as the shared sheriff fallback", (characterId) => {
    const { scene, rig, args } = createBlob(characterId);

    expect(args?.[5]).toBe(DEFAULT_CHARACTER);
    expect(args).toHaveLength(6);
    expect(rig?.equipSyncedGear).not.toHaveBeenCalled();
    expect(scene.charOf.get("remote-player")).toBe(DEFAULT_CHARACTER);
  });

  it.each(
    WHOLE_ART_CHARACTERS,
  )("constructs selected whole-art character %s without entering the gear path", (characterId) => {
    const { rig, args } = createBlob(characterId);

    expect(args?.[5]).toBe(characterId);
    expect(args).toHaveLength(6);
    expect(rig?.equipSyncedGear).not.toHaveBeenCalled();
  });

  it("does not flash the retained dummy while whole-art textures are pending", () => {
    blobRuntime.textureState = "pending";

    const { scene, rig, args } = createBlob("proto-sheriff");

    expect(args).toBeUndefined();
    expect(rig).toBeUndefined();
    expect(scene.blobs.size).toBe(0);
    expect(scene.charOf.size).toBe(0);
  });

  it("uses a visible retained base only after a terminal whole-art asset failure", () => {
    blobRuntime.textureState = "missing";
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      const { scene, rig, args } = createBlob("proto-witch");

      expect(args?.[5]).toBe("drifter");
      expect(args).toHaveLength(6);
      expect(rig?.equipSyncedGear).not.toHaveBeenCalled();
      expect(scene.blobs.has("remote-player")).toBe(true);
      expect(scene.charOf.get("remote-player")).toBe("proto-witch");
      expect(error).toHaveBeenCalledWith(
        expect.stringContaining(
          'whole-art character asset failure for "proto-witch"; rendering retained "drifter" base',
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

  it("keeps legacy Drifter gear tails inert after they resolve visually to the sheriff", () => {
    const { scene, rig, addBlob, removeBlob } = blobSyncScene("drifter", DEFAULT_CHARACTER);

    scene.syncBlobs();

    expect(rig.equipSyncedGear).not.toHaveBeenCalled();
    expect(removeBlob).not.toHaveBeenCalled();
    expect(addBlob).not.toHaveBeenCalled();
  });

  it("rebuilds for an authoritative whole-art-to-whole-art character change", () => {
    const { scene, rig, addBlob, removeBlob } = blobSyncScene("proto-samurai", "proto-sheriff");

    scene.syncBlobs();

    expect(removeBlob).toHaveBeenCalledWith("remote-player");
    expect(addBlob).toHaveBeenCalledOnce();
    expect(rig.equipSyncedGear).not.toHaveBeenCalled();
  });
});
