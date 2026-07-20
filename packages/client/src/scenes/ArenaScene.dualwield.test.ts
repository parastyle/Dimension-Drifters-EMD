import { WEAPONS, type WeaponDef } from "@dd/shared";
import { describe, expect, it, vi } from "vitest";

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

const { ArenaScene } = await import("./ArenaScene.js");

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
