import {
  ACTION_MSGS_PER_TICK,
  AUGMENTS,
  BELT_LEVEL_IDS,
  BELT_Y0,
  beltLevelFor,
  beltPitAtX,
  CRIT_MULT,
  clampBeltFloorY,
  critChanceFor,
  DEFAULT_WEAPON,
  DEPTH_MAX,
  DIMENSIONS,
  DROP_POOL,
  DUMMY_HP,
  draftAugments,
  ENEMY_KINDS,
  EnemyState,
  FISTS_WEAPON,
  getDimension,
  isPitAtPx,
  MAX_ENEMIES,
  META_FORTUNE_LUK,
  META_POWER_STR,
  META_VITALITY_HP,
  makeRng,
  PARRY_CHAIN_RIPOSTE_AT,
  PARRY_IFRAMES,
  PIT_FALL_DAMAGE_FRAC,
  PickupState,
  PLAYER_MAX_HP,
  REVIVE_HP_FRAC,
  SET_BONUS_2,
  SET_BONUS_3,
  SHIFTER_KIND_IDS,
  salvageValue,
  swingDescriptorFor,
  scripValue,
  TILE_GROUND,
  TILE_PIT,
  WEAPON_IDS,
  WEAPONS,
  weaponEffectEmitterPoint,
  weaponSetBonus,
  ZONE_RADIUS,
  ZONE_TTL,
  ZoneState,
} from "@dd/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The authoritative 20Hz tick (GameRoom) had ZERO tests (audit cluster ②) — only live co-op exercised the
// boss phases / rez / wipe / melee integration. This harness stubs the Colyseus `Room` base so we can
// `new GameRoom()`, register handlers, join fake clients, drive `update(dt)` ticks, and assert the state.
vi.mock("colyseus", () => {
  class Room {
    state: unknown;
    clients: { sessionId: string }[] = [];
    roomId = "test";
    setState(s: unknown) {
      this.state = s;
    }
    onMessage() {}
    setSimulationInterval() {}
    setPatchRate() {}
    broadcast() {}
    broadcastPatch() {}
  }
  return { Room, Client: class {} };
});

// Imported AFTER the mock so GameRoom extends the stub Room.
const { GameRoom } = await import("./GameRoom.js");

// biome-ignore lint/suspicious/noExplicitAny: the harness reaches private room internals (update/combat) on purpose.
type AnyRoom = any;

function makeRoom(options?: { dimensionId?: string; bossRush?: boolean; belt?: boolean }) {
  const room = new GameRoom() as AnyRoom;
  const handlers = new Map<string, (c: { sessionId: string }, m?: unknown) => void>();
  room.onMessage = (type: string, fn: (c: { sessionId: string }, m?: unknown) => void) =>
    handlers.set(type, fn);
  room.clients = [];
  room.roomId = "test";
  room.onCreate(options);
  return {
    room,
    state: () => room.state,
    join(sessionId: string) {
      room.clients.push({ sessionId });
      room.onJoin({ sessionId });
    },
    send(sessionId: string, type: string, msg?: unknown) {
      handlers.get(type)?.({ sessionId }, msg);
    },
    tick(times = 1, dtMs = 50) {
      for (let i = 0; i < times; i++) room.update(dtMs);
    },
  };
}

describe("GameRoom — Coilshot authored pre-throw draw", () => {
  it("releases the authoritative projectile only after the visible revolution window", () => {
    const h = makeRoom();
    h.join("coilshot-draw");
    const player = h.state().players.get("coilshot-draw");
    const combat = h.room.combat.get(player.id);
    const weapon = WEAPONS["x2-coilshot-meteor"];
    if (!weapon?.thrown) throw new Error("Coilshot thrown fixture is required");
    player.weapon = weapon.id;
    combat.lastWeapon = weapon.id;
    combat.aimX = 1;
    combat.aimY = 0;
    combat.targetX = player.x + weapon.thrown.range;
    combat.targetY = player.y;

    h.room.throwWeapon(player, combat, weapon);
    expect(h.state().projectiles.size).toBe(0);
    expect(h.room.pendingWeaponThrows).toHaveLength(1);
    h.tick(7);
    expect(h.state().projectiles.size).toBe(0);
    h.tick(1);
    expect(
      [...h.state().projectiles.values()].some(
        (projectile: { sourceWeaponId?: string }) => projectile.sourceWeaponId === weapon.id,
      ),
    ).toBe(true);
  });
});

describe("GameRoom — join/leave + host", () => {
  it("a join adds a living, full-HP player on the spawn disc; the first joiner is host", () => {
    const h = makeRoom();
    h.join("p1");
    const p = h.state().players.get("p1");
    expect(p).toBeDefined();
    expect(p.alive).toBe(true);
    expect(p.hp).toBe(PLAYER_MAX_HP);
    expect(p.weapon).toBe(DEFAULT_WEAPON);
    expect(h.room.hostId).toBe("p1");
    expect(h.state().schemaVersion).toBeGreaterThan(0); // §4 handshake stamped
  });

  it("when the host leaves, the role hands off to a remaining player", () => {
    const h = makeRoom();
    h.join("p1");
    h.join("p2");
    h.room.clients = h.room.clients.filter((c: { sessionId: string }) => c.sessionId !== "p1");
    h.room.onLeave({ sessionId: "p1" });
    expect(h.room.hostId).toBe("p2");
    expect(h.state().players.has("p1")).toBe(false);
  });
});

describe("GameRoom — §6 rez-or-dead death model", () => {
  it("a player at 0 HP goes DOWNED and STAYS down (no auto-respawn)", () => {
    const h = makeRoom();
    h.join("p1");
    h.join("p2"); // keep one alive so the run doesn't wipe
    h.state().players.get("p1").hp = 0;
    h.tick(10); // way past the old 3s respawn window
    const p1 = h.state().players.get("p1");
    expect(p1.alive).toBe(false);
    expect(p1.hp).toBe(0);
  });

  it("the whole squad down → the run WIPES (outcome 'defeat')", () => {
    const h = makeRoom();
    h.join("p1");
    h.state().players.get("p1").hp = 0;
    h.tick(1);
    expect(h.state().players.get("p1").alive).toBe(false);
    expect(h.state().outcome).toBe("defeat");
  });

  it("the Gravedigger's Spade REVIVES a downed ally at 30% HP within range", () => {
    const h = makeRoom();
    h.join("p1");
    h.join("p2");
    const p1 = h.state().players.get("p1");
    const p2 = h.state().players.get("p2");
    // p1 goes down; p2 stands on the body wielding the rez spade. Anchor to the mapgen-guaranteed clear
    // spawn disc (240px radius) so a random pit can't snap a player off-position and flake the rez.
    p1.x = h.room.map.spawnX;
    p1.y = h.room.map.spawnY;
    p1.hp = 0;
    p2.x = h.room.map.spawnX;
    p2.y = h.room.map.spawnY + 10; // ~10px away, well inside REZ_RADIUS (96)
    p2.weapon = "gravediggers-spade";
    h.tick(1); // p1 registers as downed
    expect(p1.alive).toBe(false);
    h.send("p2", "attack", { aimX: 0, aimY: 1 }); // swing the spade
    h.tick(2);
    expect(p1.alive).toBe(true);
    // Revived to ~30% of max HP (+ a touch of regen from the ticks after the revive).
    const revived = Math.round(PLAYER_MAX_HP * REVIVE_HP_FRAC);
    expect(p1.hp).toBeGreaterThanOrEqual(revived);
    expect(p1.hp).toBeLessThan(revived + 5);
  });
});

describe("GameRoom — §16 boss phase machine", () => {
  function spawnBossAt(h: ReturnType<typeof makeRoom>, hpFrac: number) {
    h.send("p1", "spawnBoss");
    h.tick(1);
    let boss: EnemyState | undefined;
    h.state().enemies.forEach((e: EnemyState) => {
      if (e.kind === "old-rust") boss = e;
    });
    if (boss) boss.hp = 420 * hpFrac; // boss maxHp = kind.hp × enemyHpScale(1p) = 420
    h.tick(1);
    return boss;
  }

  it("paces (phase 1) at full HP", () => {
    const h = makeRoom();
    h.join("p1");
    const boss = spawnBossAt(h, 1);
    expect(boss).toBeDefined();
    expect(h.state().bossPhase).toBe(1);
  });

  it("escalates to punch-slams (phase 2) at ≤50% and enrage (phase 3) at ≤20%", () => {
    const h2 = makeRoom();
    h2.join("p1");
    spawnBossAt(h2, 0.4);
    expect(h2.state().bossPhase).toBe(2);

    const h3 = makeRoom();
    h3.join("p1");
    spawnBossAt(h3, 0.15);
    expect(h3.state().bossPhase).toBe(3);
  });
});

describe("GameRoom — §20 swept melee connects in the live tick", () => {
  it("a swing damages an enemy the blade sweeps across", () => {
    const h = makeRoom();
    h.join("p1");
    const p1 = h.state().players.get("p1");
    p1.x = h.room.map.spawnX;
    p1.y = h.room.map.spawnY;
    p1.weapon = "gravediggers-spade"; // a pure-edge MELEE weapon (the default cleaver is THROWN)
    h.tick(1); // let the weapon-swap init settle
    // Plant a critter right in front along +x, within the spade's reach (150) and the clear spawn disc.
    const e = new EnemyState();
    e.id = "victim";
    e.kind = "critter";
    e.hp = 50;
    e.x = h.room.map.spawnX + 50;
    e.y = h.room.map.spawnY;
    h.state().enemies.set("victim", e);
    h.send("p1", "attack", { aimX: 1, aimY: 0 });
    h.tick(4); // resolveSwing registers the swept blade; stepMeleeSwings samples it over the active window
    // The critter (3 HP base, here 50) should have taken edge damage from the sweep.
    const after = h.state().enemies.get("victim");
    expect(after === undefined || after.hp < 50).toBe(true);
  });
});

describe("GameRoom — §17 dimension wiring", () => {
  it("scopes the dimensionId + boss kind to the joined dimension", () => {
    const h = makeRoom({ dimensionId: "frostfell" });
    h.join("p1");
    expect(h.state().dimensionId).toBe("frostfell");
    h.send("p1", "spawnBoss");
    h.tick(1);
    let boss: EnemyState | undefined;
    h.state().enemies.forEach((e: EnemyState) => {
      if (ENEMY_KINDS[e.kind]?.archetype === "boss") boss = e;
    });
    expect(boss?.kind).toBe(getDimension("frostfell").boss); // "the-hollow-king", not "old-rust"
  });

  it("an unknown dimensionId falls back to Wild West", () => {
    const h = makeRoom({ dimensionId: "atlantis" });
    expect(h.state().dimensionId).toBe("wild-west");
    h.join("p1");
    h.send("p1", "spawnBoss");
    h.tick(1);
    let boss: EnemyState | undefined;
    h.state().enemies.forEach((e: EnemyState) => {
      if (ENEMY_KINDS[e.kind]?.archetype === "boss") boss = e;
    });
    expect(boss?.kind).toBe("old-rust");
  });
});

describe("GameRoom — §17 shifter-incursion director", () => {
  it("phases a tier-1 shifter IN on the timer, then phases it OUT after its window", () => {
    const h = makeRoom();
    h.join("p1");
    // Pave the arena (all ground) so the shifter — which spawns far on the ring then drifts toward the
    // player — can't wander onto a random pit and pit-die the same tick (terrain noise vs the lifecycle
    // under test; only the boss is pit-immune by design).
    h.room.map.tiles.fill(TILE_GROUND);
    // Fast-forward to the first incursion: tier-0 (early) → the weakest shifter (Marshal).
    h.state().elapsed = 10;
    h.room.shifterCd = 0.01;
    h.tick(1);
    expect(h.room.shifterId).not.toBeNull();
    const shifter = h.state().enemies.get(h.room.shifterId);
    expect(shifter).toBeDefined();
    expect(SHIFTER_KIND_IDS).toContain(shifter.kind);
    expect(shifter.kind).toBe(SHIFTER_KIND_IDS[0]); // tier 0 → first in the tier-ordered roster
    expect(h.room.shifterWaves).toBe(1);

    // PHASE-OUT: force the hunt window to expire — the survivor rifts back out (removed from state).
    const sid = h.room.shifterId;
    h.room.shifterTimer = 0.01;
    h.tick(1);
    expect(h.room.shifterId).toBeNull();
    expect(h.state().enemies.has(sid)).toBe(false);
  });

  it("holds incursions while the dimension boss is up", () => {
    const h = makeRoom();
    h.join("p1");
    h.send("p1", "spawnBoss"); // boss now alive → bossId set
    h.tick(1);
    h.state().elapsed = 10;
    h.room.shifterCd = 0.01;
    h.tick(1);
    expect(h.room.shifterId).toBeNull(); // no incursion started during the boss fight
  });
});

describe("GameRoom — §20 universal lunge", () => {
  it("a rusher (critter) TELEGRAPHS a lunge and it's PARRYABLE", () => {
    const h = makeRoom();
    h.join("p1");
    const p = h.state().players.get("p1");
    p.x = h.room.map.spawnX;
    p.y = h.room.map.spawnY;
    // a critter just outside touch range but inside lunge approach — it should wind up + jump, not just chip.
    const e = new EnemyState();
    e.id = "lunger";
    e.kind = "critter";
    e.hp = 999;
    e.x = h.room.map.spawnX + 50;
    e.y = h.room.map.spawnY;
    h.state().enemies.set("lunger", e);
    const pc = h.room.combat.get("p1");
    let sawWindup = false;
    for (let i = 0; i < 30; i++) {
      pc.invuln = 1; // hold a parry stance every tick (i-frames up)
      h.tick(1);
      if ((h.state().enemies.get("lunger")?.windup ?? 0) > 0) sawWindup = true;
    }
    expect(sawWindup).toBe(true); // §8 white-tell telegraph ramped → readable + parryable
    expect(p.parriedSeq).toBeGreaterThan(0); // a lunge connected during the parry window → negated
  });

  it("a critter's lunge HITS an un-parrying player (the telegraphed attack is real)", () => {
    const h = makeRoom();
    h.join("p1");
    const p = h.state().players.get("p1");
    p.x = h.room.map.spawnX;
    p.y = h.room.map.spawnY;
    p.hp = 100;
    // The companion test proves a parry NEGATES the lunge; this proves it LANDS without one. We assert the
    // discrete lunge hit (≥ LUNGE_MIN_DAMAGE 5, derived 6.4 for a critter), NOT passive touch chip —
    // passive contact (4/s × dt ≈ 0.2/tick) is smaller than per-tick regen, so it clamps right back to maxHp.
    // On the clear spawn disc (no pits) the windup→strike is fully deterministic.
    const e = new EnemyState();
    e.id = "lunger2";
    e.kind = "critter";
    e.hp = 999;
    e.x = h.room.map.spawnX + 30; // inside the derived approach (64) → winds up immediately
    e.y = h.room.map.spawnY;
    h.state().enemies.set("lunger2", e);
    h.tick(14); // windup (~0.46s ≈ 9 ticks) → the jab connects ~tick 11; a few regen ticks can't refill 6.4
    expect(p.hp).toBeLessThan(96); // a real, regen-proof chunk of HP gone
  });

  it("§8 v0.114 consecutive parries BUILD a chain → heal + (at RIPOSTE_AT) STAGGER the attacker", () => {
    const h = makeRoom();
    h.join("p1");
    const p = h.state().players.get("p1");
    p.hp = 40; // wounded — the chain-heal should visibly claw HP back on top of regen
    const e = new EnemyState();
    e.id = "flurry";
    e.kind = "critter";
    e.hp = 99999; // never dies — keep the flurry coming
    h.state().enemies.set("flurry", e);
    const pc = h.room.combat.get("p1");
    let maxChain = 0;
    // The map seed is non-deterministic per room, and each parry knocks the attacker back — so to isolate the
    // CHAIN cadence from re-approach drift we PIN both bodies adjacent every tick. The combo machine's own
    // rhythm (windup→swing→recover, one swing per ~1s < the 1.4s chain window) then gates the parries, so the
    // chain builds deterministically past the riposte threshold regardless of map/run order.
    for (let i = 0; i < 120; i++) {
      p.x = h.room.map.spawnX;
      p.y = h.room.map.spawnY;
      e.x = h.room.map.spawnX + 30;
      e.y = h.room.map.spawnY;
      pc.invuln = 1; // always parrying → every connecting lunge is a parry
      h.tick(1);
      maxChain = Math.max(maxChain, pc.parryChain);
    }
    expect(p.parriedSeq).toBeGreaterThan(1); // multiple lunges were parried over the fight
    // The chain climbed to at least the riposte threshold at some point → the heal + stagger branch ran.
    expect(maxChain).toBeGreaterThanOrEqual(PARRY_CHAIN_RIPOSTE_AT);
    expect(p.hp).toBeGreaterThan(40); // parrying the flurry clawed HP back (heal on top of regen)
  });
});

describe("GameRoom — §8 v0.117 PROJECTILE PARRY (deflect, don't phase through)", () => {
  it("a hostile bullet caught in the parry i-frame window GLANCES OFF + fades (base: no damage taken)", () => {
    const h = makeRoom();
    h.join("p1");
    const p = h.state().players.get("p1");
    p.x = h.room.map.spawnX;
    p.y = h.room.map.spawnY;
    p.hp = 100;
    const pc = h.room.combat.get("p1");
    pc.invuln = 1; // holding a parry stance → i-frames up
    // A hostile spit born right on the player: after one tick's move it overlaps → it must DEFLECT, not pass.
    h.room.fireProjectile({ x: p.x, y: p.y }, { x: p.x + 100, y: p.y }, 300, 8);
    h.tick(1);
    let spark: { hostile: boolean; kind: string } | undefined;
    h.state().projectiles.forEach((pr: { hostile: boolean; kind: string }) => {
      spark = pr;
    });
    expect(spark).toBeDefined(); // the bullet LIVES ON (deflected), not a silent phase-through
    expect(spark?.hostile).toBe(false); // no longer a threat
    expect(spark?.kind).toBe("deflect"); // base parry → Superman side-glance spark (client fades it out)
    expect(p.parriedSeq).toBeGreaterThan(0); // the parry registered → flash + crisp ding fire
    expect(p.hp).toBe(100); // a parried bullet deals you zero
  });

  it("with the Deflector augment the parried bullet RICOCHETS BACK as a friendly counter", () => {
    const h = makeRoom();
    h.join("p1");
    const p = h.state().players.get("p1");
    p.x = h.room.map.spawnX;
    p.y = h.room.map.spawnY;
    p.hp = 100;
    p.augments = "deflector"; // §8 the level-up upgrade that turns the glance into offense
    h.room.combat.get("p1").invuln = 1;
    h.room.fireProjectile({ x: p.x, y: p.y }, { x: p.x + 100, y: p.y }, 300, 8);
    h.tick(1);
    let counter: { hostile: boolean; kind: string } | undefined;
    h.state().projectiles.forEach((pr: { hostile: boolean; kind: string }) => {
      counter = pr;
    });
    expect(counter?.kind).toBe("counter"); // bounce-back streak, not the fading glance
    expect(counter?.hostile).toBe(false); // now hunts the horde
    expect(p.hp).toBe(100); // you still take zero
  });

  it("without parry i-frames the same bullet HITS (the deflect is earned, not free)", () => {
    const h = makeRoom();
    h.join("p1");
    const p = h.state().players.get("p1");
    p.x = h.room.map.spawnX;
    p.y = h.room.map.spawnY;
    p.hp = 100;
    h.room.combat.get("p1").invuln = 0; // NOT parrying
    h.room.fireProjectile({ x: p.x, y: p.y }, { x: p.x + 100, y: p.y }, 300, 8);
    h.tick(1);
    expect(p.hp).toBeLessThan(100); // it landed — a real hit
  });
});

describe("GameRoom — §13 damageEnemy (the one damage primitive, both paths)", () => {
  // Place the boss `dx` px right of the clear spawn disc centre, at 1 HP. The boss is pit-immune, but the
  // PLAYER who must reach it is not — anchoring to spawnX/spawnY keeps the attacker on guaranteed ground.
  function spawnLowBoss(h: ReturnType<typeof makeRoom>, dx: number) {
    h.send("p1", "spawnBoss");
    h.tick(1);
    h.state().enemies.forEach((e: EnemyState) => {
      if (ENEMY_KINDS[e.kind]?.archetype === "boss") {
        e.hp = 1;
        e.x = h.room.map.spawnX + dx;
        e.y = h.room.map.spawnY;
      }
    });
  }

  it("killing the boss with a SWING opens the extraction portal", () => {
    const h = makeRoom();
    h.join("p1");
    const p = h.state().players.get("p1");
    p.x = h.room.map.spawnX;
    p.y = h.room.map.spawnY;
    p.weapon = "gravediggers-spade"; // pure-edge melee
    h.tick(1);
    spawnLowBoss(h, 100); // within the spade's reach (150) and the clear disc
    h.send("p1", "attack", { aimX: 1, aimY: 0 });
    h.tick(4);
    expect(h.state().portalOpen).toBe(true);
  });

  it("killing the boss with a THROWN projectile ALSO opens the portal (locks the deduped path)", () => {
    const h = makeRoom();
    h.join("p1");
    const p = h.state().players.get("p1");
    p.x = h.room.map.spawnX;
    p.y = h.room.map.spawnY;
    p.weapon = "rusty-cleaver"; // thrown
    h.tick(1);
    spawnLowBoss(h, 120); // a short throw away, still on the clear disc
    h.send("p1", "attack", { aimX: 1, aimY: 0 });
    h.tick(10); // cleaver flies out + connects
    expect(h.state().portalOpen).toBe(true);
  });

  it("a dummy never dies — a lethal swing resets its HP to DUMMY_HP", () => {
    const h = makeRoom();
    h.join("p1");
    const p = h.state().players.get("p1");
    p.x = h.room.map.spawnX;
    p.y = h.room.map.spawnY;
    p.weapon = "gravediggers-spade";
    h.tick(1);
    const e = new EnemyState();
    e.id = "dum";
    e.kind = "dummy";
    e.hp = 1;
    e.x = h.room.map.spawnX + 80; // within the spade's swept reach, on the clear disc
    e.y = h.room.map.spawnY;
    h.state().enemies.set("dum", e);
    h.send("p1", "attack", { aimX: 1, aimY: 0 });
    h.tick(4);
    const after = h.state().enemies.get("dum");
    expect(after).toBeDefined(); // never removed
    expect(after.hp).toBe(DUMMY_HP); // reset, not killed
  });

  it("a kill grants XP (the squad's xp/level advances)", () => {
    const h = makeRoom();
    h.join("p1");
    const p = h.state().players.get("p1");
    p.x = h.room.map.spawnX;
    p.y = h.room.map.spawnY;
    p.weapon = "gravediggers-spade";
    h.tick(1);
    const before = p.xp + (p.level - 1) * 1e6;
    const e = new EnemyState();
    e.id = "v";
    e.kind = "critter";
    e.hp = 1;
    e.x = h.room.map.spawnX + 45; // within the spade's swept reach, on the clear disc
    e.y = h.room.map.spawnY;
    h.state().enemies.set("v", e);
    h.send("p1", "attack", { aimX: 1, aimY: 0 });
    // The XP Echo now has an authored 260ms settle plus its bounded magnet flight before payout.
    h.tick(16);
    expect(h.state().enemies.has("v")).toBe(false); // killed
    expect(p.xp + (p.level - 1) * 1e6).toBeGreaterThan(before); // §12 xp granted
  });
});

describe("GameRoom — §16 v0.116 BOSS RUSH gauntlet", () => {
  /** Pin an invincible attacker on the spawn disc + keep it swing-ready (no level-up window stalls). */
  function pinAttacker(h: ReturnType<typeof makeRoom>) {
    const p = h.state().players.get("p1");
    p.x = h.room.map.spawnX;
    p.y = h.room.map.spawnY;
    p.maxHp = 1e9;
    p.hp = 1e9;
    p.flexPending = 0; // never let a level-up window block the test's attacks
    p.sigPending = 0;
    return p;
  }

  /** Drop the live boss to 1 HP within the spade's reach, then swing → it dies this beat. Returns false if
   *  no boss is up. */
  function killCurrentBoss(h: ReturnType<typeof makeRoom>): boolean {
    let found = false;
    h.state().enemies.forEach((e: EnemyState) => {
      if (ENEMY_KINDS[e.kind]?.archetype === "boss") {
        e.hp = 1;
        e.x = h.room.map.spawnX + 100;
        e.y = h.room.map.spawnY;
        found = true;
      }
    });
    if (!found) return false;
    h.send("p1", "attack", { aimX: 1, aimY: 0 });
    h.tick(4);
    return true;
  }

  it("starts in bossrush mode + drops the first boss after the breather (NO trash horde)", () => {
    const h = makeRoom({ bossRush: true });
    h.join("p1");
    pinAttacker(h);
    expect(h.state().mode).toBe("bossrush");
    h.tick(90); // 90 × 50ms = 4.5s > BOSSRUSH_BREATHER (3.5s) → the first boss drops
    let bosses = 0;
    let trash = 0;
    h.state().enemies.forEach((e: EnemyState) => {
      if (ENEMY_KINDS[e.kind]?.archetype === "boss") bosses++;
      else trash++;
    });
    expect(bosses).toBe(1); // exactly one gauntlet boss
    expect(trash).toBe(0); // the survival horde is suppressed in boss rush
  });

  it("killing a boss ADVANCES the gauntlet (no portal, depth escalates) and clearing all 10 WINS", () => {
    const h = makeRoom({ bossRush: true });
    h.join("p1");
    const p = pinAttacker(h);
    p.weapon = "gravediggers-spade"; // pure-edge melee
    h.tick(90); // first boss in
    expect(h.state().depth).toBe(1);
    expect(killCurrentBoss(h)).toBe(true);
    expect(h.state().portalOpen).toBe(false); // boss rush NEVER opens the extraction portal mid-gauntlet
    expect(h.state().depth).toBe(2); // escalated to boss 2
    // Grind the remaining gauntlet: wait each breather, re-pin the attacker, kill the boss.
    let guard = 0;
    while (h.state().outcome === "active" && guard++ < 40) {
      h.tick(90); // the breather → the next boss drops
      pinAttacker(h);
      killCurrentBoss(h);
    }
    expect(h.state().outcome).toBe("victory"); // cleared all 10 bosses → banked win
    expect(h.state().enemies.size).toBe(0); // field cleaned for the win screen
  });
});

describe("GameRoom — §4 untrusted-input handlers (anti-cheat surface)", () => {
  it("debugSpawn does nothing in arena mode (training-gated)", () => {
    const h = makeRoom();
    h.join("p1");
    const before = h.state().enemies.size;
    h.send("p1", "debugSpawn", { kind: "critter", count: 5 });
    expect(h.state().enemies.size).toBe(before);
  });

  it("debugSpawn rejects an unknown or 'dummy' kind", () => {
    const h = makeRoom();
    h.join("p1");
    h.send("p1", "toggleTraining"); // → training mode
    h.send("p1", "debugSpawn", { kind: "no-such-kind", count: 3 });
    let critters = 0;
    h.state().enemies.forEach((e: EnemyState) => {
      if (e.kind === "critter") critters++;
    });
    expect(critters).toBe(0); // bad id spawned nothing
  });

  it("an extreme/non-unit aim is normalized to a unit vector", () => {
    const h = makeRoom();
    h.join("p1");
    h.send("p1", "attack", { aimX: 99, aimY: 0 });
    const c = h.room.combat.get("p1");
    expect(Math.hypot(c.aimX, c.aimY)).toBeCloseTo(1, 6);
  });

  it("chooseAugment ignores an id that wasn't in the offered draft", () => {
    const h = makeRoom();
    h.join("p1");
    const p = h.state().players.get("p1");
    p.sigPending = 1;
    p.sigOffer = ""; // nothing offered this pick
    h.send("p1", "chooseAugment", { id: "brand" });
    expect(p.augments).toBe(""); // rejected
    expect(p.sigPending).toBe(1); // unspent
  });
});

describe("GameRoom — §6/§15 run-ending + rule-defining transitions", () => {
  it("a living player in the open portal flips the run to VICTORY", () => {
    const h = makeRoom();
    h.join("p1");
    const p = h.state().players.get("p1");
    // Stand the player and the portal on the clear spawn disc — a random pit under an arbitrary coordinate
    // would chip + snap the player off the portal mouth and flake the victory check.
    p.x = h.room.map.spawnX;
    p.y = h.room.map.spawnY;
    h.state().portalOpen = true;
    h.state().portalX = h.room.map.spawnX;
    h.state().portalY = h.room.map.spawnY;
    h.tick(2);
    expect(h.state().outcome).toBe("victory");
  });

  it("a zoner puddle damages a player WITH parry i-frames up — DoT is UNPARRYABLE", () => {
    const h = makeRoom();
    h.join("p1");
    const p = h.state().players.get("p1");
    // On the clear spawn disc so the only thing that can chip the player is the puddle, not a random pit.
    p.x = h.room.map.spawnX;
    p.y = h.room.map.spawnY;
    p.hp = 100;
    const z = new ZoneState();
    z.id = "puddle";
    z.x = h.room.map.spawnX;
    z.y = h.room.map.spawnY;
    z.radius = ZONE_RADIUS;
    h.state().zones.set("puddle", z);
    h.room.zoneMeta.set("puddle", ZONE_TTL); // give the puddle life
    const pc = h.room.combat.get("p1");
    for (let i = 0; i < 6; i++) {
      pc.invuln = 1; // hold a parry every tick
      h.tick(1);
    }
    expect(p.hp).toBeLessThan(100); // the puddle ignored the i-frames
  });
});

describe("GameRoom — §17 pitfall + terrain-death + §9 gun cadence", () => {
  // These run in TRAINING mode: it disables the arena spawn director (§21), so the only entities in play are
  // the ones the test plants — no random horde to chip the player or fall in our test pit. The pitfall /
  // pit-death / reload phases themselves run mode-agnostically, so the rules under test are unchanged.
  function training() {
    const h = makeRoom();
    h.join("p1");
    h.send("p1", "toggleTraining");
    return h;
  }
  // Force the tile under a world-px point to a pit (post-gen override — bypasses the cleared spawn disc).
  function forcePit(h: ReturnType<typeof makeRoom>, px: number, py: number, rad = 0) {
    const m = h.room.map;
    const tx = Math.floor(px / m.tileSize);
    const ty = Math.floor(py / m.tileSize);
    for (let dy = -rad; dy <= rad; dy++)
      for (let dx = -rad; dx <= rad; dx++) m.tiles[(ty + dy) * m.cols + (tx + dx)] = TILE_PIT;
  }

  it("a GROUNDED player over a pit falls: chip damage + snap-back to last ground + fellSeq", () => {
    const h = training();
    const p = h.state().players.get("p1");
    const sx = h.room.map.spawnX;
    const sy = h.room.map.spawnY;
    p.x = sx;
    p.y = sy;
    h.tick(1); // stand on cleared ground → records lastGround at (sx,sy)
    const fellBefore = p.fellSeq;
    // Open a pit 3 tiles south and step onto it, grounded.
    const pitY = sy + 3 * h.room.map.tileSize;
    forcePit(h, sx, pitY);
    p.x = sx;
    p.y = pitY;
    p.height = 0;
    h.room.combat.get("p1").pitGrace = 0;
    h.tick(1);
    expect(p.fellSeq).toBeGreaterThan(fellBefore); // the fall fired
    expect(isPitAtPx(h.room.map, p.x, p.y)).toBe(false); // snapped back onto solid ground
    expect(Math.round(p.x)).toBe(Math.round(sx)); // … specifically the last-ground spot
    expect(Math.round(p.y)).toBe(Math.round(sy));
    expect(p.hp).toBeCloseTo(PLAYER_MAX_HP * (1 - PIT_FALL_DAMAGE_FRAC), 0); // took the chip (± a regen tick)
  });

  it("an AIRBORNE player (mid-jump) clears the pit — no fall", () => {
    const h = training();
    const p = h.state().players.get("p1");
    const sx = h.room.map.spawnX;
    const sy = h.room.map.spawnY;
    const pitY = sy + 3 * h.room.map.tileSize;
    forcePit(h, sx, pitY);
    p.x = sx;
    p.y = pitY;
    p.height = 100; // mid-hop, well above GROUND_EPSILON
    const fellBefore = p.fellSeq;
    h.tick(1);
    expect(p.fellSeq).toBe(fellBefore); // the hop carried over the gap
    expect(p.hp).toBe(PLAYER_MAX_HP); // no chip
  });

  it("a non-boss enemy that ends a tick over a pit DIES with NO xp (terrain kill, §17)", () => {
    const h = training();
    const p = h.state().players.get("p1");
    const sx = h.room.map.spawnX;
    const sy = h.room.map.spawnY;
    p.x = sx;
    p.y = sy;
    const xpBefore = p.xp;
    const levelBefore = p.level;
    // A 3x3 pit block 3 tiles east; plant a critter dead-centre so one tick of chase can't walk it off.
    const pitX = sx + 3 * h.room.map.tileSize;
    forcePit(h, pitX, sy, 1);
    const e = new EnemyState();
    e.id = "doomed";
    e.kind = "critter";
    e.hp = 999;
    e.x = pitX;
    e.y = sy;
    h.state().enemies.set("doomed", e);
    h.tick(1);
    expect(h.state().enemies.has("doomed")).toBe(false); // fell in → despawned
    expect(p.xp).toBe(xpBefore); // terrain kills are free CC, not score
    expect(p.level).toBe(levelBefore);
  });

  it("a gun fires past its authored magazine through Drive with reload fields retired", () => {
    const h = training();
    const p = h.state().players.get("p1");
    const gunId = "x-gun-coffin-shotgun";
    const gun = WEAPONS[gunId]?.gun;
    if (!gun) throw new Error("fixture weapon is not a gun");
    p.weapon = gunId;
    h.tick(1);
    expect([p.maxCharges, p.charges]).toEqual([0, 0]);
    const c = h.room.combat.get("p1");
    for (let i = 0; i < 240 && p.attackSeq < gun.magazine + 2; i++) {
      h.send("p1", "attack", { aimX: 1, aimY: 0 }); // hold the trigger: the attack buffer re-arms each tick
      h.tick(1);
    }
    expect(p.attackSeq).toBeGreaterThan(gun.magazine);
    expect([p.maxCharges, p.charges, c.reloadCd]).toEqual([0, 0, 0]);
    expect(c.drive.valueF).toBeLessThan(100);
  });

  it("§38 a CASTER weapon conjures a piercing arcane orb on a cooldown (no ammo)", () => {
    const h = training();
    const p = h.state().players.get("p1");
    const staffId = "x-staff-arcane-lance";
    const staff = WEAPONS[staffId];
    if (!staff?.cast) throw new Error("fixture weapon is not a caster");
    p.weapon = staffId;
    h.tick(1);
    let sawOrb = false;
    let orbEl = "";
    for (let i = 0; i < 60 && !sawOrb; i++) {
      h.send("p1", "attack", { aimX: 1, aimY: 0 }); // hold the cast trigger
      h.tick(1);
      h.state().projectiles.forEach((pr: { kind: string }) => {
        if (pr.kind.startsWith("orb")) {
          sawOrb = true;
          orbEl = pr.kind;
        }
      });
    }
    expect(sawOrb).toBe(true); // the cast delivery fired a projectile (not a melee swing)
    expect(orbEl).toBe("orb:arcane"); // element-tinted per the weapon
  });

  it("§41 the HAND MORTAR's shell explodes — AoE damages an enemy NEAR the impact, not just on the line", () => {
    const h = training();
    const p = h.state().players.get("p1");
    p.weapon = "x-gun-hand-mortar";
    h.tick(1);
    const dummy = [...h.state().enemies.values()].find((e: { kind: string }) => e.kind === "dummy");
    if (!dummy) throw new Error("no training dummy");
    const hp0 = dummy.hp;
    // Fire from far enough that the shell EXPIRES level with the dummy (muzzle reach ~90 + range 560),
    // offset 90px to the side — a plain bullet on that line never touches it, but the 130px blast where
    // the shell dies must catch it.
    // §50 PIN both bodies to fixed mid-arena coordinates AND clear the RNG-placed landmarks: projectiles
    // COLLIDE with POIs (stepProjectiles poiAt reflection), so a random map roll could park a landmark on
    // the 650px firing line and kill the shell early — the source of this test's ~40% parallel-run flake
    // (the per-run Math.random stream differs between full/isolated runs, so it looked scheduler-dependent).
    h.room.map.pois.length = 0;
    h.room.map.tiles.fill(TILE_GROUND); // pits are RNG too — the pinned spots must be solid
    dummy.x = 2400;
    dummy.y = 2400;
    p.x = dummy.x - 650;
    p.y = dummy.y + 90;
    h.send("p1", "attack", { aimX: 1, aimY: 0, tx: p.x + 600, ty: p.y });
    // The dummy REGENERATES, so assert the blast by catching the hp DIP tick-by-tick (a single check after
    // the full flight would see it healed back).
    let dipped = false;
    for (let i = 0; i < 44 && !dipped; i++) {
      h.tick(1);
      if (dummy.hp < hp0) dipped = true;
    }
    expect(dipped).toBe(true);
  });

  it("§43 the HAILSHOT HAND-MAUL's recovered direct cannonball fires without an explosion", () => {
    // This weapon shipped as a default 6-damage slug for months because its authored gun lived beside
    // behavior. V3R keeps the recovered kit but moves the old blast payload into the direct cannonball.
    const h = training();
    const p = h.state().players.get("p1");
    p.weapon = "x2-hailshot-hand-maul";
    h.tick(1);
    const dummy = [...h.state().enemies.values()].find((e: { kind: string }) => e.kind === "dummy");
    if (!dummy) throw new Error("no training dummy");
    const hp0 = dummy.hp;
    // Pin the dummy on the direct line: the owner order explicitly removes the old off-line blast.
    h.room.map.pois.length = 0;
    h.room.map.tiles.fill(TILE_GROUND);
    dummy.x = 2400;
    dummy.y = 2400;
    p.x = dummy.x - 300;
    p.y = dummy.y;
    h.send("p1", "attack", { aimX: 1, aimY: 0, tx: dummy.x, ty: dummy.y });
    let dipped = false;
    for (let i = 0; i < 44 && !dipped; i++) {
      h.tick(1);
      if (dummy.hp < hp0) dipped = true;
    }
    expect(dipped).toBe(true);
  });

  it("§40.3 the WHIRLWIND's full-circle sweep hits an enemy BEHIND the aim", () => {
    const h = training();
    const p = h.state().players.get("p1");
    p.weapon = "x-sword-whirlwind";
    h.tick(1);
    const dummy = [...h.state().enemies.values()].find((e: { kind: string }) => e.kind === "dummy");
    if (!dummy) throw new Error("no training dummy");
    // Stand just RIGHT of the dummy and aim FURTHER RIGHT — the dummy sits directly BEHIND the aim.
    p.x = dummy.x + 100;
    p.y = dummy.y;
    const hp0 = dummy.hp;
    h.send("p1", "attack", { aimX: 1, aimY: 0, tx: p.x + 400, ty: p.y });
    h.tick(16); // the 4π swept edge crosses the full circle over the swing's active window
    expect(dummy.hp).toBeLessThan(hp0); // a flat-arc weapon aimed away could never hit this
  });

  it("§40.2 a QUAKE detonates when the chop's blade LANDS, not at click (shared delay)", () => {
    const h = training();
    const p = h.state().players.get("p1");
    p.weapon = "tombstone-greatsword";
    h.tick(1);
    // Park a dummy-adjacent target: use the training dummy itself (it sits in the Testing Grounds).
    const dummy = [...h.state().enemies.values()].find((e: { kind: string }) => e.kind === "dummy");
    if (!dummy) throw new Error("no training dummy");
    const hp0 = dummy.hp;
    // Swing AT the dummy (cursor point on it, within QUAKE_REACH of the player — move the player next to it).
    p.x = dummy.x - 100;
    p.y = dummy.y;
    h.send("p1", "attack", { aimX: 1, aimY: 0, tx: dummy.x, ty: dummy.y });
    h.tick(1); // the swing resolves THIS tick — pre-§40.2 the quake damaged here
    expect(dummy.hp).toBe(hp0); // blade still in the air → no damage yet
    // delay = cooldown 0.78 × SWING_WINDOW_FRAC 0.64 × CHOP_IMPACT_FRAC 0.52 ≈ 0.26s ≈ 5.2 ticks @50ms
    h.tick(7);
    expect(dummy.hp).toBeLessThan(hp0); // the blade landed → the quake erupted
  });

  it("§37 a shot flies at the CURSOR POINT (tx/ty), not the client's aim vector", () => {
    const h = training();
    const p = h.state().players.get("p1");
    p.weapon = "x-gun-revolver-cannon";
    h.tick(1);
    const px = p.x; // wherever the player actually is after equip
    const py = p.y;
    // The aim VECTOR says "straight right" (aimX=1); the cursor POINT is straight UP from the real player.
    // The §37 fix makes the bullet follow the POINT (flies up) — before the fix it followed the vector (right).
    const tx = px;
    const ty = py - 400;
    let vx = 0;
    let vy = 0;
    let got = false;
    for (let i = 0; i < 30 && !got; i++) {
      h.send("p1", "attack", { aimX: 1, aimY: 0, tx, ty });
      h.tick(1);
      h.state().projectiles.forEach((pr: { kind: string; vx: number; vy: number }) => {
        if (pr.kind.startsWith("slug")) {
          vx = pr.vx;
          vy = pr.vy;
          got = true;
        }
      });
    }
    expect(got).toBe(true);
    expect(vy).toBeLessThan(0); // flew UP toward the cursor point
    expect(Math.abs(vx)).toBeLessThan(Math.abs(vy) * 0.2); // mostly vertical — NOT the rightward aim vector
  });
});

describe("GameRoom — §4 v0.107 seq'd input protocol (queue / ack / fixed timestep / hostile payloads)", () => {
  it("consumes one command per tick and mirrors ackSeq + mvx/mvy on synced state", () => {
    const h = makeRoom();
    h.join("p1");
    const p = h.state().players.get("p1");
    h.send("p1", "input", { seq: 1, dx: 1, dy: 0 });
    h.tick(1);
    expect(p.ackSeq).toBe(1); // consumed + acked
    expect(p.mvx).toBeGreaterThan(0); // steering velocity mirrored for the predicting client
    const mv1 = p.mvx;
    h.tick(1); // queue starved → held fallback keeps steering (ack unchanged)
    expect(p.ackSeq).toBe(1);
    expect(p.mvx).toBeGreaterThan(mv1); // still accelerating on the held command
  });

  it("drains a BURST straight to the newest command (no latency ratchet) and acks its seq", () => {
    const h = makeRoom();
    h.join("p1");
    const p = h.state().players.get("p1");
    // 3 commands in one tick window (within the per-tick message budget — the client's own burst clamp
    // sends at most ~3 after a stall): the tick must jump to the FRESHEST, not chew 1-per-tick.
    for (let s = 1; s <= 3; s++) h.send("p1", "input", { seq: s, dx: 1, dy: 0 });
    h.tick(1);
    expect(p.ackSeq).toBe(3); // the freshest intent, not seq 1 with a +100ms backlog behind it
  });

  it("SURVIVES hostile input payloads (garbage seq/dx, replays, floods) without crashing or moving", () => {
    const h = makeRoom();
    h.join("p1");
    const p = h.state().players.get("p1");
    const x0 = p.x;
    // Garbage seq types + NaN dx — must not throw (a raw assignment into uint32 ackSeq would kill the
    // process) and must not move the player.
    h.send("p1", "input", { seq: "x", dx: "boom", dy: Number.NaN });
    h.send("p1", "input", { seq: Number.NaN, dx: 1, dy: 0 });
    h.send("p1", "input", { seq: -5, dx: 1, dy: 0 });
    h.tick(2);
    expect(p.ackSeq).toBe(0); // nothing legitimate consumed
    expect(Math.abs(p.x - x0)).toBeLessThan(0.001);
    // Replayed / regressed seqs are dropped (monotonicity).
    h.send("p1", "input", { seq: 10, dx: 1, dy: 0 });
    h.tick(1);
    expect(p.ackSeq).toBe(10);
    h.send("p1", "input", { seq: 10, dx: -1, dy: 0 }); // replay — dropped
    h.send("p1", "input", { seq: 9, dx: -1, dy: 0 }); // regression — dropped
    h.tick(1);
    expect(p.ackSeq).toBe(10); // still the original
    // Flood: hundreds of messages in one tick — budget caps acceptance, queue caps memory, no throw.
    for (let i = 0; i < 300; i++) h.send("p1", "input", { seq: 100 + i, dx: 0, dy: 1 });
    const rec = h.room.inputs.get("p1");
    expect(rec.queue.length).toBeLessThanOrEqual(8);
    h.tick(1);
    expect(p.ackSeq).toBeGreaterThan(10); // the freshest accepted command landed
  });

  it("survives the uint32 seq WRAP: 0xFFFFFFFF → 0 continues the stream (channel never bricks)", () => {
    const h = makeRoom();
    h.join("p1");
    const p = h.state().players.get("p1");
    const rec = h.room.inputs.get("p1");
    rec.lastSeq = 0xffffffff; // a marathon session at the counter's edge
    h.send("p1", "input", { seq: 0, dx: 1, dy: 0 }); // the wrapped next seq
    h.tick(1);
    expect(rec.lastSeq).toBe(0); // accepted — wrap-aware delta, not a plain <= compare
    expect(p.mvx).toBeGreaterThan(0); // and it actually steered
    h.send("p1", "input", { seq: 1, dx: 1, dy: 0 }); // stream continues normally past the wrap
    h.tick(1);
    expect(p.ackSeq).toBe(1);
  });

  it("consumes + acks even while FROZEN in the level window (queues must never pin), but does not move", () => {
    const h = makeRoom();
    h.join("p1");
    const p = h.state().players.get("p1");
    p.flexPending = 1; // freeze (level-up window)
    p.flexTimer = 999;
    const x0 = p.x;
    h.send("p1", "input", { seq: 1, dx: 1, dy: 0 });
    h.tick(1);
    expect(p.ackSeq).toBe(1); // acked through the freeze
    expect(p.x).toBe(x0); // but no movement
    expect(p.mvx).toBe(0); // and the steering velocity is held at zero (no glide on unfreeze)
  });

  it("a teleport bumps teleportSeq and drops queued/held intent (the client's hard-resync signal)", () => {
    const h = makeRoom();
    h.join("p1");
    const p = h.state().players.get("p1");
    const ts0 = p.teleportSeq;
    h.send("p1", "input", { seq: 1, dx: 1, dy: 0 });
    h.tick(1);
    expect(p.mvx).toBeGreaterThan(0);
    h.room.zeroMoveVel("p1"); // any teleport site (pit / rift / restart / training / revive)
    expect(p.teleportSeq).toBe(ts0 + 1);
    expect(p.mvx).toBe(0);
    h.tick(1); // the held direction was dropped too — no stale-intent glide after the teleport
    expect(p.mvx).toBe(0);
  });

  it("FIXED TIMESTEP: a 150ms stall integrates as three exact 50ms sub-steps (catch-up, not dt-stretch)", () => {
    const h = makeRoom();
    h.join("p1");
    const p = h.state().players.get("p1");
    const t0 = h.state().tick;
    const e0 = h.state().elapsed;
    h.room.update(150); // one laggy invocation
    expect(h.state().tick).toBe(t0 + 3); // 3 whole sub-steps ran
    expect(h.state().elapsed).toBeCloseTo(e0 + 0.15, 5);
    // And two 25ms invocations accumulate into exactly one sub-step (no drift, no double-step).
    const t1 = h.state().tick;
    h.room.update(25);
    expect(h.state().tick).toBe(t1); // not enough accumulated yet
    h.room.update(25);
    expect(h.state().tick).toBe(t1 + 1);
    void p;
  });
});

describe("GameRoom — §7 v0.105 de-clunk input buffering (attack / parry / jump)", () => {
  // The bug: a press that lands one tick BEFORE the server cooldown clears used to be silently EATEN —
  // the client had already played the whole swing/brace/hop, so the input felt dropped. These pin the fix:
  // a press is queued for a short window and fires the instant the cooldown drains, WITHOUT re-sending.
  function armedFister() {
    const h = makeRoom();
    h.join("p1");
    const p = h.state().players.get("p1");
    p.weapon = FISTS_WEAPON; // a plain melee weapon (no ammo/charges), cooldown 0.32s
    h.tick(1); // let the weapon (re)initialise so it doesn't reset cd on the tick under test
    return { h, p, c: h.room.combat.get("p1") };
  }

  it("BUFFERS an attack that arrives a tick early and fires it when the cooldown drains", () => {
    const { h, c } = armedFister();
    const fists = WEAPONS[FISTS_WEAPON];
    if (!fists) throw new Error("fists weapon missing from the arsenal");
    const fistsCd = fists.cooldown;
    c.cd = 0.08; // just over one tick out — the message arrives while still on cooldown
    h.send("p1", "attack", { aimX: 1, aimY: 0 });
    expect(c.attackBuffer).toBeGreaterThan(0); // queued, not consumed yet (cd still > 0)
    h.tick(2); // drain the cd over two ticks — NO re-send
    expect(c.cd).toBeCloseTo(fistsCd, 5); // the buffered swing fired → cooldown re-armed to the weapon's
    expect(c.attackBuffer).toBe(0); // and the buffer was consumed
  });

  it("DROPS a buffered attack on a weapon SWAP (no free cooldown-bypassing hit on the new weapon)", () => {
    const { h, c } = armedFister();
    c.cd = 0.5; // the OLD (slow) weapon is mid-cooldown
    h.send("p1", "attack", { aimX: 1, aimY: 0 }); // queue a press for the OLD weapon
    expect(c.attackBuffer).toBeGreaterThan(0);
    h.send("p1", "cycleWeapon", { dir: 1 }); // swap within the buffer window (the swap zeroes cd)
    h.tick(1);
    expect(c.attackBuffer).toBe(0); // the stale buffer was dropped on the swap...
    expect(c.cd).toBeLessThanOrEqual(0); // ...so the new weapon did NOT auto-fire (cd never re-armed)
  });

  it("does NOT fire a STALE attack once the buffer window lapses (no phantom swing after release)", () => {
    const { h, c } = armedFister();
    c.cd = 0.5; // far out — well past the ~0.15s buffer window
    h.send("p1", "attack", { aimX: 1, aimY: 0 }); // a single press, never re-sent
    h.tick(12); // 0.6s: buffer expires (~0.15s) long before the cd (0.5s) drains
    expect(c.attackBuffer).toBe(0); // decayed away
    expect(c.cd).toBeLessThanOrEqual(0); // cd drained and STAYED drained — the stale press never fired
  });

  it("BUFFERS a parry pressed during its cooldown and fires it when the cd clears (chain-parry desync fix)", () => {
    const h = makeRoom();
    h.join("p1");
    const c = h.room.combat.get("p1");
    c.parryCd = 0.08; // a chain press lands while the parry is still cooling down
    h.send("p1", "parry");
    expect(c.parryBuffer).toBeGreaterThan(0); // queued (not dropped)
    h.tick(2); // drain the parry cd — NO re-send
    expect(c.invuln).toBeGreaterThan(PARRY_IFRAMES - 0.11); // the buffered parry fired → i-frames granted
    expect(c.parryBuffer).toBe(0);
  });

  it("BUFFERS a jump pressed on cooldown and hops the instant the player is grounded + ready", () => {
    const h = makeRoom();
    h.join("p1");
    const c = h.room.combat.get("p1");
    const p = h.state().players.get("p1");
    c.jumpCd = 0.08; // pressed during the post-landing dead window
    p.height = 0; // grounded
    h.send("p1", "jump");
    expect(c.jumpBuffer).toBeGreaterThan(0); // queued
    h.tick(2); // drain the jump cd — NO re-send
    expect(p.height).toBeGreaterThan(0); // lifted off → the buffered hop fired
    expect(c.jumpBuffer).toBe(0);
  });
});

describe("GameRoom — §6 dimension chain (v0.103: extract-vs-descend, bank-or-lose, depth scaling)", () => {
  // Open both gates ON the clear spawn disc so a planted player can deterministically step into either.
  function openGatesAtSpawn(h: ReturnType<typeof makeRoom>) {
    const st = h.state();
    st.portalOpen = true;
    st.portalX = h.room.map.spawnX;
    st.portalY = h.room.map.spawnY;
    st.riftOpen = true;
    st.riftX = h.room.map.spawnX;
    st.riftY = h.room.map.spawnY;
  }

  it("killing the boss opens BOTH gates: the extract portal AND the deeper rift", () => {
    const h = makeRoom();
    h.join("p1");
    const p = h.state().players.get("p1");
    p.x = h.room.map.spawnX;
    p.y = h.room.map.spawnY;
    p.weapon = "gravediggers-spade";
    h.tick(1);
    h.send("p1", "spawnBoss");
    h.tick(1);
    h.state().enemies.forEach((e: EnemyState) => {
      if (ENEMY_KINDS[e.kind]?.archetype === "boss") {
        e.hp = 1;
        e.x = h.room.map.spawnX + 100;
        e.y = h.room.map.spawnY;
      }
    });
    h.send("p1", "attack", { aimX: 1, aimY: 0 });
    h.tick(4);
    expect(h.state().portalOpen).toBe(true);
    expect(h.state().riftOpen).toBe(true); // the greed decision has two doors
    expect(h.state().riftX).not.toBe(0); // rift placed somewhere real
  });

  it("a rift descent: depth+1, NEW dimension + seeds, field cleared, squad carried, run still active", () => {
    const h = makeRoom({ dimensionId: "wild-west" });
    h.join("p1");
    const p = h.state().players.get("p1");
    p.level = 7; // mid-run progression that must SURVIVE the descent
    p.salvaged = 5;
    p.weapon = "gravediggers-spade";
    p.hp = 61;
    const e = new EnemyState(); // some horde that must NOT follow through the rift
    e.id = "left-behind";
    e.kind = "critter";
    e.hp = 99;
    e.x = h.room.map.spawnX + 2000; // far away — can't reach + shove the channeler mid-hold
    e.y = h.room.map.spawnY;
    h.state().enemies.set("left-behind", e);
    const seedBefore = h.state().seedTerrain;
    // HOLD the rift — it's a channel (RIFT_CHANNEL_SECONDS), not a tripwire.
    p.x = h.room.map.spawnX;
    p.y = h.room.map.spawnY;
    openGatesAtSpawn(h);
    h.state().portalOpen = false; // isolate the rift path (both gates share the spawn point here)
    h.tick(10); // ~0.5s — mid-channel: charged but NOT committed
    expect(h.state().depth).toBe(1);
    expect(h.state().riftCharge).toBeGreaterThan(0);
    h.tick(30); // past the 1.6s channel → the squad commits
    const st = h.state();
    expect(st.depth).toBe(2);
    expect(st.dimensionId).not.toBe("wild-west"); // moved to a FRESH dimension
    expect(st.seedTerrain).not.toBe(seedBefore); // new map minted
    expect(st.enemies.size).toBe(0); // the old horde stayed behind
    expect(st.outcome).toBe("active"); // the run continues
    expect(st.portalOpen).toBe(false);
    expect(st.riftOpen).toBe(false);
    // The squad carried through intact — that's the greed (levels, arsenal, carried salvage, chip damage).
    expect(p.level).toBe(7);
    expect(p.salvaged).toBe(5);
    expect(p.weapon).toBe("gravediggers-spade");
    expect(p.hp).toBeGreaterThanOrEqual(61); // chip damage carried (+ ~2s of always-on regen while channeling)…
    expect(p.hp).toBeLessThan(80); // …NOT healed back to full by the descent
    // Repositioned onto the NEW map's clear spawn disc.
    const d = Math.hypot(p.x - h.room.map.spawnX, p.y - h.room.map.spawnY);
    expect(d).toBeLessThanOrEqual(150);
  });

  it("extraction BANKS the squad's carried salvage (victory reserves the bank)", () => {
    const h = makeRoom();
    h.join("p1");
    const p = h.state().players.get("p1");
    p.salvaged = 7;
    p.x = h.room.map.spawnX;
    p.y = h.room.map.spawnY;
    openGatesAtSpawn(h);
    h.state().riftOpen = false; // isolate the extract path
    h.tick(1);
    expect(h.state().outcome).toBe("victory");
    expect(h.state().bankedSalvage).toBe(7); // banked…
    expect(p.salvaged).toBe(0); // …and no longer carried
  });

  it("a WIPE loses everything carried (bank-or-LOSE) — banked survives", () => {
    const h = makeRoom();
    h.join("p1");
    const p = h.state().players.get("p1");
    h.state().bankedSalvage = 12; // an earlier extraction's bank
    p.salvaged = 9; // this run's carry
    p.hp = 0;
    h.tick(1);
    expect(h.state().outcome).toBe("defeat");
    expect(p.salvaged).toBe(0); // carried salvage is GONE
    expect(h.state().bankedSalvage).toBe(12); // the bank is safe
  });

  it("stepping OUT of the rift drains the channel — no accidental commit", () => {
    const h = makeRoom();
    h.join("p1");
    const p = h.state().players.get("p1");
    p.x = h.room.map.spawnX;
    p.y = h.room.map.spawnY;
    openGatesAtSpawn(h);
    h.state().portalOpen = false;
    h.tick(10); // build some charge…
    expect(h.state().riftCharge).toBeGreaterThan(0);
    // …then step OUT — beyond the 90px rift ring but INSIDE the 240px guaranteed-clear spawn disc
    // (any further and a random pit could snap the player straight back into the rift → flaky).
    p.x = h.room.map.spawnX + 150;
    h.tick(30);
    expect(h.state().depth).toBe(1); // never committed
    expect(h.state().riftCharge).toBe(0); // charge drained
  });

  it("EXPLOIT GUARD: a cycled (conjured) weapon salvages for NOTHING; an enemy drop pays (provenance)", () => {
    const h = makeRoom();
    h.join("p1");
    const p = h.state().players.get("p1");
    p.x = h.room.map.spawnX;
    p.y = h.room.map.spawnY;
    // The old infinite-money loop: cycle a weapon out of thin air, salvage it, repeat.
    h.send("p1", "cycleWeapon", { dir: 1 });
    h.send("p1", "salvageWeapon");
    h.send("p1", "cycleWeapon", { dir: 1 });
    h.send("p1", "salvageWeapon");
    expect(p.salvaged).toBe(0); // conjured weapons are worthless — the printer is dead
    // An ENEMY-DROPPED weapon carries provenance → it pays.
    const pk = new PickupState();
    pk.id = "drop900";
    pk.weapon = "gravediggers-spade";
    pk.x = p.x;
    pk.y = p.y;
    h.state().pickups.set("drop900", pk);
    h.room.earnedPickups.add("drop900"); // as maybeDropWeapon marks it
    h.send("p1", "grabWeapon");
    h.send("p1", "salvageWeapon");
    expect(p.salvaged).toBe(1); // earned → banked-able
  });

  it("EXPLOIT GUARD: toggling into the Testing Grounds ABORTS the run — carried salvage is lost", () => {
    const h = makeRoom();
    h.join("p1");
    const p = h.state().players.get("p1");
    h.state().bankedSalvage = 4;
    p.salvaged = 9; // deep-run carry someone tries to launder through the workshop
    h.send("p1", "toggleTraining");
    expect(p.salvaged).toBe(0); // the expedition is over — only extraction banks
    expect(h.state().bankedSalvage).toBe(4); // the bank itself is untouched
  });

  it("deeper spawns are spongier: a depth-3 spawn carries more HP than depth-1", () => {
    const h = makeRoom();
    h.join("p1");
    // Compare the same kind's spawn HP at depth 1 vs 3 via the live spawn path.
    const hpAt = (depth: number) => {
      h.state().depth = depth;
      h.state().enemies.clear();
      // Spawn many so at least one lands regardless of tough rolls; take a non-tough one's hp.
      for (let i = 0; i < 12; i++)
        h.room.spawnEnemy([{ x: h.room.map.spawnX, y: h.room.map.spawnY }]);
      let hp = 0;
      h.state().enemies.forEach((e: EnemyState) => {
        if (!e.tough && e.kind === "critter") hp = Math.max(hp, e.hp);
      });
      return hp;
    };
    const shallow = hpAt(1);
    const deep = hpAt(3);
    if (shallow > 0 && deep > 0) expect(deep).toBeGreaterThan(shallow); // ×1.5 at depth 3
  });
});

describe("GameRoom — §10/§13 loot spine (v0.104: rarity, affix, mystery drops, provenance value)", () => {
  it("killing the BOSS guarantees a mystery drop with a rolled rarity/affix (earned)", () => {
    const h = makeRoom();
    h.join("p1");
    const p = h.state().players.get("p1");
    p.x = h.room.map.spawnX;
    p.y = h.room.map.spawnY;
    p.weapon = "gravediggers-spade";
    h.tick(1);
    h.send("p1", "spawnBoss");
    h.tick(1);
    h.state().enemies.forEach((e: EnemyState) => {
      if (ENEMY_KINDS[e.kind]?.archetype === "boss") {
        e.hp = 1;
        e.x = h.room.map.spawnX + 100;
        e.y = h.room.map.spawnY;
      }
    });
    h.send("p1", "attack", { aimX: 1, aimY: 0 });
    h.tick(4);
    let loot: PickupState | undefined;
    h.state().pickups.forEach((pk: PickupState) => {
      if (!pk.known) loot = pk;
    });
    expect(loot).toBeDefined(); // §13 "no guaranteed weapon drops except bosses" — this IS the boss
    expect(loot?.known).toBe(false); // mystery: type+rarity telegraphed, identity hidden
    expect(DROP_POOL).toContain(loot?.weapon); // identity comes from the power-banded pool
    expect(h.room.earnedPickups.has(loot?.id)).toBe(true); // loot drops carry salvage value
  });

  it("grabbing a drop applies its rolled rarity + affix to the held weapon (the reveal)", () => {
    const h = makeRoom();
    h.join("p1");
    const p = h.state().players.get("p1");
    p.x = h.room.map.spawnX;
    p.y = h.room.map.spawnY;
    const pk = new PickupState();
    pk.id = "drop800";
    pk.weapon = "tombstone-greatsword";
    pk.rarity = 4; // Legendary
    pk.affix = "keen";
    pk.known = false;
    pk.x = p.x;
    pk.y = p.y;
    h.state().pickups.set("drop800", pk);
    h.room.earnedPickups.add("drop800");
    h.send("p1", "grabWeapon");
    expect(p.weapon).toBe("tombstone-greatsword");
    expect(p.weaponRarity).toBe(4);
    expect(p.weaponAffix).toBe("keen");
  });

  it("salvaging an earned weapon pays its RARITY value; cycling shreds the loot identity", () => {
    const h = makeRoom();
    h.join("p1");
    const p = h.state().players.get("p1");
    p.x = h.room.map.spawnX;
    p.y = h.room.map.spawnY;
    const pk = new PickupState();
    pk.id = "drop801";
    pk.weapon = "tombstone-greatsword";
    pk.rarity = 4; // Legendary → salvage 8
    pk.affix = "keen";
    pk.x = p.x;
    pk.y = p.y;
    h.state().pickups.set("drop801", pk);
    h.room.earnedPickups.add("drop801");
    h.send("p1", "grabWeapon");
    h.send("p1", "salvageWeapon");
    expect(p.salvaged).toBe(salvageValue(4)); // 8 — the tier drives the parts value
    expect(p.weaponRarity).toBe(0); // identity shredded with the weapon
    // A cycled (conjured) weapon carries NO loot identity.
    h.send("p1", "cycleWeapon", { dir: 1 });
    expect(p.weaponRarity).toBe(0);
    expect(p.weaponAffix).toBe("");
  });

  it("A11: grabbing while holding a weapon SWAPS — the held weapon drops as a pickup, not destroyed", () => {
    const h = makeRoom();
    h.join("p1");
    const p = h.state().players.get("p1");
    p.x = h.room.map.spawnX;
    p.y = h.room.map.spawnY;
    // Holding an EARNED Legendary Keen weapon.
    p.weapon = "tombstone-greatsword";
    p.weaponRarity = 4;
    p.weaponAffix = "keen";
    const c = h.room.combat.get("p1");
    c.heldEarned = true;
    // A plain Common weapon on the floor, in reach.
    const pk = new PickupState();
    pk.id = "drop700";
    pk.weapon = "rusty-cleaver";
    pk.x = p.x;
    pk.y = p.y;
    h.state().pickups.set("drop700", pk);
    h.send("p1", "grabWeapon");
    // Now wielding the grabbed weapon (unearned — the floor pickup carried no provenance)...
    expect(p.weapon).toBe("rusty-cleaver");
    expect(c.heldEarned).toBe(false);
    // ...and the Legendary was NOT destroyed — it's back on the floor as a grabbable pickup with its
    // full identity + earned provenance intact (the data-loss booby trap is closed).
    let dropped: PickupState | undefined;
    h.state().pickups.forEach((x: PickupState) => {
      if (x.weapon === "tombstone-greatsword") dropped = x;
    });
    expect(dropped).toBeDefined();
    expect(dropped?.rarity).toBe(4);
    expect(dropped?.affix).toBe("keen");
    expect(h.room.earnedPickups.has(dropped?.id ?? "")).toBe(true);
  });

  it("a rarity/affix genuinely changes dealt damage (Legendary Keen > plain, WYSIWYG)", () => {
    // §30 suppress the crit roll (base 5%) so the damage assertion is deterministic — random ≥ crit chance.
    const rng = vi.spyOn(Math, "random").mockReturnValue(1);
    const hitFor = (rarity: number, affix: string) => {
      const h = makeRoom();
      h.join("p1");
      const p = h.state().players.get("p1");
      p.x = h.room.map.spawnX;
      p.y = h.room.map.spawnY;
      p.weapon = "gravediggers-spade";
      p.weaponRarity = rarity;
      p.weaponAffix = affix;
      h.tick(1);
      const e = new EnemyState();
      e.id = "victim";
      e.kind = "critter";
      e.hp = 500;
      e.x = h.room.map.spawnX + 50;
      e.y = h.room.map.spawnY;
      h.state().enemies.set("victim", e);
      h.send("p1", "attack", { aimX: 1, aimY: 0 });
      h.tick(4);
      return 500 - (h.state().enemies.get("victim")?.hp ?? 0);
    };
    const plain = hitFor(0, "");
    const legendary = hitFor(4, "keen");
    expect(plain).toBeGreaterThan(0);
    expect(legendary).toBeCloseTo(plain * 1.45 * 1.12, 1); // exactly rarity × affix
    rng.mockRestore();
  });

  it("EXPLOIT GUARD: the Testing Grounds mints NO loot — not from toughs, debug BOSSES, or wielders", () => {
    const h = makeRoom();
    h.join("p1");
    h.send("p1", "toggleTraining");
    const before = h.state().pickups.size;
    // Kill toughs, a BOSS, and a weapon-WIELDER in training — none may mint a drop (the verify-found
    // laundering exploit: reroll boss loot risk-free in the workshop, then carry it into the run).
    for (let i = 0; i < 40; i++) {
      const e = new EnemyState();
      e.id = `t${i}`;
      e.kind = "critter";
      e.hp = 0.0001;
      e.tough = true;
      h.state().enemies.set(e.id, e);
      h.room.damageEnemy(e, e.id, 1, []);
    }
    for (let i = 0; i < 12; i++) {
      const b = new EnemyState();
      b.id = `b${i}`;
      b.kind = "old-rust"; // archetype boss — dropLoot(…,1) path
      b.hp = 0.0001;
      h.state().enemies.set(b.id, b);
      h.room.damageEnemy(b, b.id, 1, []);
      const r = new EnemyState();
      r.id = `r${i}`;
      r.kind = "ronin"; // wieldsWeapon — maybeDropWeapon path
      r.hp = 0.0001;
      h.state().enemies.set(r.id, r);
      h.room.damageEnemy(r, r.id, 1, []);
    }
    expect(h.state().pickups.size).toBe(before); // ZERO drops of any kind in the workshop
    // And a loot identity acquired elsewhere is SHED on entering training (no power laundering).
    const p = h.state().players.get("p1");
    p.weaponRarity = 5;
    p.weaponAffix = "frenzied";
    h.send("p1", "toggleTraining"); // back to arena
    h.send("p1", "toggleTraining"); // into training again — sheds the loot identity
    expect(p.weaponRarity).toBe(0);
    expect(p.weaponAffix).toBe("");
  });
});

describe("GameRoom — §M14 golden tick snapshot (the hand-numbered phase order is a CONTRACT)", () => {
  // update() sequences ~20 mutating phases by hand-numbered comments; ArenaScene chains order-dependent
  // calls. A reorder compiles + lints clean and silently changes the sim. This drives a FIXED, fully-seeded
  // scenario and digests the final state, so a reorder that shifts any value fails the gate. Math.random is
  // backed by a seeded mulberry32 (map gen + spawn director + spreads all deterministic). The digest rounds
  // FP to integers: a phase reorder moves whole HP/positions; cross-platform libm noise (CI is Linux, dev is
  // Windows) stays sub-pixel and rounds away — so this is robust without a brittle byte-hash.
  function runScript(): Record<string, unknown> {
    const rng = makeRng(0x1234abcd);
    const spy = vi.spyOn(Math, "random").mockImplementation(() => rng.next());
    try {
      const h = makeRoom({ dimensionId: "wild-west" });
      h.join("p1");
      h.join("p2");
      // Manually plant two critters on the clear spawn disc (deterministic ints — no spawn-ring libm in the
      // sensitive path), then run a scripted attack cadence. The spawn director still runs (exercised), but
      // the digest's HP/positions come from this controlled duel.
      for (const [id, dx] of [
        ["c1", 70],
        ["c2", -70],
      ] as const) {
        const e = new EnemyState();
        e.id = id;
        e.kind = "critter";
        e.hp = 12;
        e.x = h.room.map.spawnX + dx;
        e.y = h.room.map.spawnY;
        h.state().enemies.set(id, e);
      }
      for (let t = 0; t < 60; t++) {
        if (t % 6 === 0) h.send("p1", "attack", { aimX: 1, aimY: 0 });
        if (t % 6 === 3) h.send("p2", "attack", { aimX: -1, aimY: 0 });
        h.tick(1);
      }
      const s = h.state();
      const players = [...s.players.values()]
        // biome-ignore lint/suspicious/noExplicitAny: schema rows, read in the test harness.
        .map((p: any) => ({
          id: p.id,
          alive: p.alive,
          hp: Math.round(p.hp),
          x: Math.round(p.x),
          y: Math.round(p.y),
          level: p.level,
        }))
        .sort((a, b) => a.id.localeCompare(b.id));
      return {
        outcome: s.outcome,
        mode: s.mode,
        dimensionId: s.dimensionId,
        elapsed: Math.round(s.elapsed * 100) / 100,
        players,
        plantedAlive: ["c1", "c2"].filter((id) => s.enemies.has(id)).length,
        portalOpen: s.portalOpen,
        bossSpawned: h.room.bossSpawned,
      };
    } finally {
      spy.mockRestore();
    }
  }

  it("is fully deterministic under a seeded RNG (no un-seeded random source leaks into the tick)", () => {
    expect(runScript()).toEqual(runScript());
  });

  it("matches the golden digest (a phase reorder would shift this)", () => {
    expect(runScript()).toMatchInlineSnapshot(`
      {
        "bossSpawned": false,
        "dimensionId": "wild-west",
        "elapsed": 3,
        "mode": "arena",
        "outcome": "active",
        "plantedAlive": 1,
        "players": [
          {
            "alive": true,
            "hp": 100,
            "id": "p1",
            "level": 1,
            "x": 2536,
            "y": 2342,
          },
          {
            "alive": true,
            "hp": 90,
            "id": "p2",
            "level": 1,
            "x": 2405,
            "y": 2333,
          },
        ],
        "portalOpen": false,
      }
    `);
  });
});

// ── §29 v0.118 the 3-slot ARSENAL (belt mode): grabs accumulate into slots + bag; swap/cycle/stash move
// weapons between hand, slots, and bag; loot identity + earned provenance ride along. ──
describe("GameRoom — §29 belt arsenal (3 slots + bag)", () => {
  // Drop a fully-identified, earned pickup at the player's feet and grab it.
  function grabAt(
    h: AnyRoom,
    pid: string,
    weapon: string,
    rarity = 2,
    affix = "keen",
    earned = true,
  ) {
    const p = h.state().players.get("p1");
    const pk = new PickupState();
    pk.id = pid;
    pk.weapon = weapon;
    pk.rarity = rarity;
    pk.affix = affix;
    pk.x = p.x;
    pk.y = p.y;
    h.state().pickups.set(pid, pk);
    if (earned) h.room.earnedPickups.add(pid);
    h.send("p1", "grabWeapon");
  }

  it("seeds 3 slots — slot 0 = the starting weapon, 1 & 2 empty, active 0", () => {
    const h = makeRoom({ belt: true });
    h.join("p1");
    const p = h.state().players.get("p1");
    expect(p.slots.length).toBe(3);
    expect(p.slots[0].weapon).toBe(DEFAULT_WEAPON);
    expect(p.slots[1].weapon).toBe("");
    expect(p.slots[2].weapon).toBe("");
    expect(p.activeSlot).toBe(0);
  });

  it("grabs ACCUMULATE into empty slots (no drop) and equip each grabbed weapon", () => {
    const h = makeRoom({ belt: true });
    h.join("p1");
    const p = h.state().players.get("p1");
    const before = h.state().pickups.size;
    grabAt(h, "drop900", "tombstone-greatsword", 4, "keen");
    // Filled slot 1, switched to it, held the new weapon — nothing dropped to the floor.
    expect(p.activeSlot).toBe(1);
    expect(p.weapon).toBe("tombstone-greatsword");
    expect(p.weaponRarity).toBe(4);
    expect(p.slots[0].weapon).toBe(DEFAULT_WEAPON); // starting weapon preserved
    expect(h.state().pickups.size).toBe(before); // consumed the drop, dropped nothing new
    grabAt(h, "drop901", "rusty-cleaver", 1, "");
    expect(p.activeSlot).toBe(2);
    expect(p.slots[2].weapon).toBe("rusty-cleaver");
  });

  it("swapSlot switches the held weapon and remembers each slot's loot identity", () => {
    const h = makeRoom({ belt: true });
    h.join("p1");
    const p = h.state().players.get("p1");
    grabAt(h, "drop902", "tombstone-greatsword", 4, "keen"); // → slot 1, active 1
    h.send("p1", "swapSlot", { slot: 0 });
    expect(p.activeSlot).toBe(0);
    expect(p.weapon).toBe(DEFAULT_WEAPON);
    expect(p.weaponRarity).toBe(0); // the conjured starter carries no loot identity
    h.send("p1", "swapSlot", { slot: 1 });
    expect(p.weapon).toBe("tombstone-greatsword");
    expect(p.weaponRarity).toBe(4);
    expect(p.weaponAffix).toBe("keen");
    expect(h.room.combat.get("p1").heldEarned).toBe(true); // provenance survives the round-trip
  });

  it("cycleSlot skips empty slots", () => {
    const h = makeRoom({ belt: true });
    h.join("p1");
    const p = h.state().players.get("p1");
    grabAt(h, "drop903", "tombstone-greatsword", 4, "keen"); // slot1 filled, active 1; slot2 empty
    h.send("p1", "cycleSlot", { dir: 1 }); // from 1 → skip empty 2 → wrap to filled 0
    expect(p.activeSlot).toBe(0);
    h.send("p1", "cycleSlot", { dir: 1 }); // 0 → 1 (skip empty 2 not reached first)
    expect(p.activeSlot).toBe(1);
  });

  it("a 4th grab (all slots full) overflows the old active weapon to the BAG, never destroyed", () => {
    const h = makeRoom({ belt: true });
    h.join("p1");
    const p = h.state().players.get("p1");
    grabAt(h, "drop904", "tombstone-greatsword", 4, "keen"); // slot1, active1
    grabAt(h, "drop905", "rusty-cleaver", 1, ""); // slot2, active2
    // slots: [starter, tombstone, cleaver], all full, active 2 (cleaver)
    grabAt(h, "drop906", "wyrmtooth-dagger", 3, "swift"); // full → cleaver overflows to bag
    expect(p.bag.length).toBe(1);
    expect(p.bag[0].weapon).toBe("rusty-cleaver");
    expect(p.slots[2].weapon).toBe("wyrmtooth-dagger");
    expect(p.weapon).toBe("wyrmtooth-dagger");
  });

  it("sellWeapon pays SCRIP by rarity at the shopkeeper — earned only, proximity-gated", () => {
    const h = makeRoom({ belt: true });
    h.join("p1");
    const p = h.state().players.get("p1");
    const shopX = h.state().beltShopX;
    expect(shopX).toBeGreaterThan(0); // the level places a vendor
    grabAt(h, "drop910", "tombstone-greatsword", 4, "keen", true); // earned Legendary → slot 1
    grabAt(h, "drop911", "rusty-cleaver", 1, "", false); // UNEARNED → slot 2
    // Too far from the vendor → rejected.
    p.x = shopX + 400;
    h.send("p1", "sellWeapon", { from: "slot", index: 1 });
    expect(p.scrip).toBe(0);
    expect(p.slots[1].weapon).toBe("tombstone-greatsword");
    // At the vendor → the earned Legendary pays its tier's scrip.
    p.x = shopX;
    h.send("p1", "sellWeapon", { from: "slot", index: 1 });
    expect(p.scrip).toBe(scripValue(4, true));
    expect(p.slots[1].weapon).toBe(""); // sold → slot cleared
    // The unearned cleaver sells for NOTHING (still removed).
    const before = p.scrip;
    h.send("p1", "sellWeapon", { from: "slot", index: 2 });
    expect(p.scrip).toBe(before); // +0
    expect(p.slots[2].weapon).toBe("");
  });

  it("belt loot drops land ON the deck band, nudged clear of pits", () => {
    const h = makeRoom({ belt: true });
    h.join("p1");
    const level = beltLevelFor("sky-carrier");
    const before = new Set<string>(h.state().pickups.keys());
    // Drop at a PIT x (1600 ∈ the 1560–1670 gap) with a y ABOVE the band — placePickupPos must nudge it
    // onto solid deck and clamp it into the depth band (not scatter it via the procgen-map spawn).
    h.room.dropLoot(1600, BELT_Y0 - 500, 1);
    const id = [...h.state().pickups.keys()].find((k) => !before.has(k));
    const pk = h.state().pickups.get(id);
    expect(pk).toBeTruthy();
    expect(beltPitAtX(level, pk.x)).toBe(false); // off the pit
    expect(pk.y).toBeGreaterThanOrEqual(BELT_Y0); // inside the depth band
    expect(pk.y).toBeLessThanOrEqual(BELT_Y0 + DEPTH_MAX);
  });

  it("belt join RESTORES persisted scrip (clamped to uint16); arena ignores it", () => {
    const belt = makeRoom({ belt: true });
    belt.room.clients.push({ sessionId: "pB" });
    belt.room.onJoin({ sessionId: "pB" }, { scrip: 123 });
    expect(belt.state().players.get("pB").scrip).toBe(123);
    belt.room.clients.push({ sessionId: "pC" });
    belt.room.onJoin({ sessionId: "pC" }, { scrip: 999999 });
    expect(belt.state().players.get("pC").scrip).toBe(65535); // clamped
    const arena = makeRoom();
    arena.room.clients.push({ sessionId: "pA" });
    arena.room.onJoin({ sessionId: "pA" }, { scrip: 500 });
    expect(arena.state().players.get("pA").scrip).toBe(0); // non-belt never seeds
  });

  it("bagStore frees a slot into the bag; bagEquip pulls it back", () => {
    const h = makeRoom({ belt: true });
    h.join("p1");
    const p = h.state().players.get("p1");
    grabAt(h, "drop907", "tombstone-greatsword", 4, "keen"); // slot1, active1
    h.send("p1", "bagStore", { slot: 1 }); // stash the active slot → bag
    expect(p.slots[1].weapon).toBe("");
    expect(p.weapon).toBe(FISTS_WEAPON); // active slot emptied → fists
    expect(p.bag.length).toBe(1);
    h.send("p1", "bagEquip", { index: 0, slot: 1 }); // pull it back into the (empty) slot 1
    expect(p.slots[1].weapon).toBe("tombstone-greatsword");
    expect(p.bag.length).toBe(0); // consumed (slot was empty)
    expect(p.weapon).toBe("tombstone-greatsword"); // re-mirrored into the active hand
  });
});

// ── §30 v0.118 CRIT (Brotato parity): LUK/DEX crit chance, rolled per damage source in damageEnemy. ──
describe("GameRoom — §30 crit", () => {
  it("critChanceFor scales with LUK/DEX off a 5% base and caps", () => {
    expect(critChanceFor(1, 1)).toBeCloseTo(0.05, 5); // baseline
    expect(critChanceFor(6, 1)).toBeCloseTo(0.15, 5); // +2%/LUK × 5
    expect(critChanceFor(1, 6)).toBeCloseTo(0.09, 5); // +0.8%/DEX × 5
    expect(critChanceFor(99, 99)).toBe(0.75); // clamped
  });

  it("a landed crit DOUBLES damage and bumps critFlash; a miss does neither", () => {
    const h = makeRoom();
    h.join("p1");
    const enemy = new EnemyState();
    enemy.id = "e";
    enemy.kind = "grunt";
    enemy.hp = 1000; // stays > 0 so damageEnemy returns before the kind/death path
    h.state().enemies.set("e", enemy);
    // Roll 0 < 0.5 → crit.
    const rng = vi.spyOn(Math, "random").mockReturnValue(0);
    let hp = enemy.hp;
    h.room.damageEnemy(enemy, "e", 10, [], 0.5);
    expect(hp - enemy.hp).toBe(10 * CRIT_MULT);
    expect(enemy.critFlash).toBe(1);
    // Roll 0.9 ≥ 0.5 → no crit.
    rng.mockReturnValue(0.9);
    hp = enemy.hp;
    h.room.damageEnemy(enemy, "e", 10, [], 0.5);
    expect(hp - enemy.hp).toBe(10);
    expect(enemy.critFlash).toBe(1); // unchanged
    // crit chance 0 (non-player source) never crits even on a 0 roll.
    rng.mockReturnValue(0);
    hp = enemy.hp;
    h.room.damageEnemy(enemy, "e", 10, [], 0);
    expect(hp - enemy.hp).toBe(10);
    rng.mockRestore();
  });
});

// ── §30 v0.118 weapon class SET-BONUS (Brotato parity #2): N-of-a-class in the loadout escalates that
// class's held damage. ──
describe("GameRoom — §30 weapon set-bonus", () => {
  const melee = WEAPON_IDS.filter((id) => WEAPONS[id]?.tags.classPool === "melee");
  const ranged = WEAPON_IDS.filter((id) => WEAPONS[id]?.tags.classPool === "ranged");

  it("escalates the held weapon's class bonus at 2 and 3 of a class", () => {
    const m0 = melee[0] as string;
    const m1 = melee[1] as string;
    const m2 = melee[2] as string;
    expect(weaponSetBonus([m0, "", ""], m0)).toBe(1); // lone weapon → no bonus
    expect(weaponSetBonus([m0, m1, ""], m0)).toBeCloseTo(1 + SET_BONUS_2, 5); // 2 of a class
    expect(weaponSetBonus([m0, m1, m2], m0)).toBeCloseTo(1 + SET_BONUS_3, 5); // 3 of a class
  });

  it("counts only the HELD weapon's class — a mixed loadout gives no bonus", () => {
    const m0 = melee[0] as string;
    const r0 = ranged[0] as string;
    // held is melee, but only ONE melee in the loadout (+ a ranged + empty) → no melee set-bonus.
    expect(weaponSetBonus([m0, r0, ""], m0)).toBe(1);
    // held is ranged with two ranged → ranged bonus (independent of the melee count).
    if (ranged.length >= 2)
      expect(weaponSetBonus([r0, ranged[1] as string, m0], r0)).toBeCloseTo(1 + SET_BONUS_2, 5);
  });

  it("unknown / empty ids are ignored", () => {
    const m0 = melee[0] as string;
    expect(weaponSetBonus(["", "nope", ""], m0)).toBe(1); // only the held's class counts; none in list
    expect(weaponSetBonus([m0, "nope", ""], m0)).toBe(1); // only 1 real melee
  });
});

// ── §30 v0.118 HARVEST (Brotato parity #3): extraction banks a LUK-scaled premium on carried salvage. ──
describe("GameRoom — §30 harvest bonus", () => {
  it("banks a LUK-scaled premium at extraction (capped)", () => {
    const h = makeRoom();
    h.join("p1");
    const p = h.state().players.get("p1");
    p.luk = 6; // +4%/LUK over 1 → +20%
    p.salvaged = 100;
    h.state().portalOpen = true;
    h.state().portalX = p.x;
    h.state().portalY = p.y;
    h.room.checkExtraction([{ x: p.x, y: p.y }]);
    expect(h.state().outcome).toBe("victory");
    expect(h.state().bankedSalvage).toBe(120); // 100 carried + 20% harvest
    expect(p.salvaged).toBe(0); // banked out
  });

  it("no LUK investment → no harvest premium (just the carried salvage)", () => {
    const h = makeRoom();
    h.join("p1");
    const p = h.state().players.get("p1");
    p.luk = 1;
    p.salvaged = 50;
    h.state().portalOpen = true;
    h.state().portalX = p.x;
    h.state().portalY = p.y;
    h.room.checkExtraction([{ x: p.x, y: p.y }]);
    expect(h.state().bankedSalvage).toBe(50);
  });
});

// ── §31 v0.118 META-PROGRESSION: permanent upgrades bought with scrip, seeded from the persisted account
// on a belt join and applied to the starting stats. ──
describe("GameRoom — §31 meta upgrades", () => {
  it("seeds + applies persisted upgrade levels on a belt join (clamped)", () => {
    const h = makeRoom({ belt: true });
    h.room.clients.push({ sessionId: "pU" });
    h.room.onJoin({ sessionId: "pU" }, { up: { vitality: 2, fortune: 1, power: 3 } });
    const p = h.state().players.get("pU");
    expect(p.upVitality).toBe(2);
    expect(p.upFortune).toBe(1);
    expect(p.upPower).toBe(3);
    expect(p.maxHp).toBe(PLAYER_MAX_HP + 2 * META_VITALITY_HP);
    expect(p.hp).toBe(p.maxHp);
    expect(p.luk).toBe(1 + META_FORTUNE_LUK);
    expect(p.str).toBe(1 + 3 * META_POWER_STR);
    // over-max / garbage clamps.
    h.room.clients.push({ sessionId: "pV" });
    h.room.onJoin({ sessionId: "pV" }, { up: { vitality: 99, fortune: -5, power: "x" } });
    const q = h.state().players.get("pV");
    expect(q.upVitality).toBe(3); // catalog max
    expect(q.upFortune).toBe(0);
    expect(q.upPower).toBe(0);
  });

  it("non-belt ignores upgrades entirely", () => {
    const h = makeRoom();
    h.room.clients.push({ sessionId: "pU" });
    h.room.onJoin({ sessionId: "pU" }, { up: { vitality: 3 } });
    const p = h.state().players.get("pU");
    expect(p.upVitality).toBe(0);
    expect(p.maxHp).toBe(PLAYER_MAX_HP);
  });

  it("buyUpgrade at the shop deducts scrip + bumps the level & stat; rejects far / broke / maxed", () => {
    const h = makeRoom({ belt: true });
    h.join("pU");
    const p = h.state().players.get("pU");
    const shopX = h.state().beltShopX;
    p.scrip = 100;
    p.x = shopX;
    h.send("pU", "buyUpgrade", { id: "vitality" }); // cost 30
    expect(p.upVitality).toBe(1);
    expect(p.scrip).toBe(70);
    expect(p.maxHp).toBe(PLAYER_MAX_HP + META_VITALITY_HP);
    // too far from the vendor → rejected.
    p.x = shopX + 500;
    h.send("pU", "buyUpgrade", { id: "vitality" });
    expect(p.upVitality).toBe(1);
    // can't afford → rejected.
    p.x = shopX;
    p.scrip = 5;
    h.send("pU", "buyUpgrade", { id: "fortune" }); // cost 40
    expect(p.upFortune).toBe(0);
    expect(p.scrip).toBe(5);
  });
});

// ── §33 v0.118 FOOTFALL QUAKE — the colossus stomp you JUMP over or PARRY. ──
describe("GameRoom — §33 footfall quake", () => {
  it("hits grounded flat-footed players; airborne (jump) or i-frames (parry) negate it", () => {
    const h = makeRoom();
    h.join("p1");
    const p = h.state().players.get("p1");
    p.x = 1000;
    p.y = 1000;
    p.hp = 100;
    p.height = 0;
    const c = h.room.combat.get("p1");
    c.invuln = 0;
    // grounded + flat-footed inside the radius → takes it.
    h.room.applyBossQuake(1000, 1000, 300, 30, 500);
    expect(p.hp).toBeLessThan(100);
    // AIRBORNE (mid-jump) → immune.
    p.hp = 100;
    p.height = 50;
    h.room.applyBossQuake(1000, 1000, 300, 30, 500);
    expect(p.hp).toBe(100);
    // grounded but PARRYING (i-frame window) → negated + white parry flash.
    p.height = 0;
    c.invuln = 0.2;
    const seq = p.parriedSeq;
    h.room.applyBossQuake(1000, 1000, 300, 30, 500);
    expect(p.hp).toBe(100);
    expect(p.parriedSeq).toBe(seq + 1);
    // outside the radius → nothing.
    p.x = 5000;
    c.invuln = 0;
    h.room.applyBossQuake(1000, 1000, 300, 30, 500);
    expect(p.hp).toBe(100);
  });
});

// ── §36 belt bosses (bespoke arena fights now run belt finales) must stay ON the deck when they reposition. ──
describe("GameRoom — §36 belt boss stays on the deck", () => {
  it("moveBoss clamps a repositioning boss to the level length + floor band", () => {
    const h = makeRoom({ belt: true });
    h.join("p1");
    h.room.spawnBoss(); // belt path lands it on the deck
    const boss = h.room.bossId ? h.state().enemies.get(h.room.bossId) : undefined;
    expect(boss).toBeTruthy();
    const level = h.room.beltLevel;
    const r = ENEMY_KINDS[boss.kind]?.radius ?? 40;
    // A blink/charge primitive drives moveBoss WAY off the deck: past the level, far below the depth band.
    h.room.bossSink.moveBoss(9_999_999, -9_999_999);
    expect(boss.x).toBeGreaterThanOrEqual(r);
    expect(boss.x).toBeLessThanOrEqual(level.length - r);
    expect(boss.y).toBe(clampBeltFloorY(level, boss.x, -9_999_999, r)); // pulled onto the floor band
    expect(boss.y).toBeGreaterThanOrEqual(BELT_Y0);
    expect(boss.y).toBeLessThanOrEqual(BELT_Y0 + DEPTH_MAX);
  });
  it("in the top-down arena moveBoss is unclamped (exact passthrough)", () => {
    const h = makeRoom(); // non-belt
    h.join("p1");
    h.room.spawnBoss();
    const boss = h.room.bossId ? h.state().enemies.get(h.room.bossId) : undefined;
    expect(boss).toBeTruthy();
    h.room.bossSink.moveBoss(1234, 5678);
    expect(boss.x).toBe(1234);
    expect(boss.y).toBe(5678);
  });
  it("summoned boss ADDS land on the deck band (a telegraphed spot off the band is pulled in)", () => {
    const h = makeRoom({ belt: true });
    h.join("p1");
    const level = h.room.beltLevel;
    const kindId = getDimension(h.state().dimensionId).roster[0]; // a real trash kind for this dimension
    if (!kindId) throw new Error("dimension roster is empty");
    h.room.spawnBossAddAt(kindId, 3000, -50_000); // telegraphed WAY above the deck
    const add = [...h.state().enemies.values()].find((e: EnemyState) => e.kind === kindId);
    expect(add, `${kindId} add spawned`).toBeTruthy();
    const r = ENEMY_KINDS[kindId]?.radius ?? 40;
    expect(add.y).toBe(clampBeltFloorY(level, add.x, -50_000, r));
    expect(add.y).toBeGreaterThanOrEqual(BELT_Y0);
    expect(add.y).toBeLessThanOrEqual(BELT_Y0 + DEPTH_MAX);
    expect(add.x).toBeLessThanOrEqual(level.length - r);
  });
});

// ── §36 every dimension's finale boss must be a REGISTERED kind AND run its (bespoke) fight in belt mode
// without throwing — the primitives (dashes/fans/telegraphs) were authored for the arena, so this pins that
// they survive on the deck. ──
describe("GameRoom — §36 dimension finale bosses run in belt mode", () => {
  for (const dim of Object.values(DIMENSIONS)) {
    it(`${dim.id}: boss "${dim.boss}" spawns + survives 60 belt ticks`, () => {
      const h = makeRoom({ belt: true });
      h.join("p1");
      h.join("p2");
      h.room.spawnBoss(dim.boss);
      const boss = h.room.bossId ? h.state().enemies.get(h.room.bossId) : undefined;
      expect(boss, `${dim.boss} is a registered boss kind`).toBeTruthy();
      expect(boss.kind).toBe(dim.boss); // the override was accepted (not silently defaulted)
      expect(() => h.tick(60, 50)).not.toThrow(); // 3s of the fight's primitives, on the deck
    });
  }
});

// ── §36 every belt level must resolve to a REAL dimension whose finale boss is a registered kind (a typo'd
// dimensionId silently falls back to wild-west; an unregistered boss kind spawns nothing). ──
describe("GameRoom — §36 belt levels are well-formed", () => {
  for (const id of BELT_LEVEL_IDS) {
    it(`${id}: real dimension + a registered boss finale`, () => {
      const level = beltLevelFor(id);
      expect(level.id).toBe(id);
      const dim = getDimension(level.dimensionId);
      expect(
        dim.id,
        `${id} dimensionId "${level.dimensionId}" resolves (not the wild-west fallback)`,
      ).toBe(level.dimensionId);
      expect(ENEMY_KINDS[dim.boss]?.archetype, `${dim.boss} is a registered boss`).toBe("boss");
      expect(level.rooms.some((r) => r.boss)).toBe(true); // has a boss finale room
      expect(level.rooms.length).toBeGreaterThanOrEqual(2);
    });
  }
});

// §38 the signature draft is WEAPON-GATED: parry augments are universal, gun/cast augments only offered to
// the matching delivery (so ranged/caster get a signature, and melee never draws a dead gun/cast pick).
describe("GameRoom — §38 weapon-gated signature draft", () => {
  const GUN_AUGS = Object.values(AUGMENTS)
    .filter((a) => a.weapon === "gun")
    .map((a) => a.id);
  const CAST_AUGS = Object.values(AUGMENTS)
    .filter((a) => a.weapon === "cast")
    .map((a) => a.id);
  /** All ids that can EVER appear across many draws for a given weapon kind. */
  const seen = (weaponKind?: "gun" | "cast") => {
    const s = new Set<string>();
    for (let i = 0; i < 400; i++)
      for (const id of draftAugments(Math.random, weaponKind)) s.add(id);
    return s;
  };
  it("melee (no weapon kind) never offers gun OR cast augments", () => {
    const s = seen(undefined);
    for (const id of [...GUN_AUGS, ...CAST_AUGS]) expect(s.has(id)).toBe(false);
    expect(s.size).toBeGreaterThan(0); // still offers the parry pool
  });
  it("a gun draft can offer gunslinger augments but never caster ones", () => {
    const s = seen("gun");
    expect(GUN_AUGS.some((id) => s.has(id))).toBe(true);
    for (const id of CAST_AUGS) expect(s.has(id)).toBe(false);
  });
  it("a cast draft can offer caster augments but never gunslinger ones", () => {
    const s = seen("cast");
    expect(CAST_AUGS.some((id) => s.has(id))).toBe(true);
    for (const id of GUN_AUGS) expect(s.has(id)).toBe(false);
  });
});

// Re-seed nothing between files — each makeRoom() is independent.
beforeEach(() => {});

// ── §44 SERVER SAFETY (Sol audit Wave 2) — dev-gated debug RPCs, entity caps, the action-message budget,
// and the parry/level-window gate. These are the "one hostile client DoSes the shared node process /
// farms risk-free damage" holes; each test drives the real handler + tick paths. ──────────────────────
describe("GameRoom — §44 safety gates", () => {
  const asProd = (fn: () => void) => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      fn();
    } finally {
      process.env.NODE_ENV = prev;
    }
  };

  it("action messages beyond the per-tick budget are IGNORED, and the budget refills next tick", () => {
    const h = makeRoom();
    h.join("p1");
    const p = h.state().players.get("p1");
    // Spend the whole budget on right-aimed attacks…
    for (let i = 0; i < ACTION_MSGS_PER_TICK; i++)
      h.send("p1", "attack", { aimX: 1, aimY: 0, tx: p.x + 100, ty: p.y });
    expect(p.aimDir).toBe(0);
    // …then an UP-aimed attack over budget: it must be ignored (aimDir unchanged).
    h.send("p1", "attack", { aimX: 0, aimY: 1, tx: p.x, ty: p.y + 100 });
    expect(p.aimDir).toBe(0);
    // A tick refills the budget — the same message now lands.
    h.tick(1);
    h.send("p1", "attack", { aimX: 0, aimY: 1, tx: p.x, ty: p.y + 100 });
    expect(p.aimDir).toBeCloseTo(Math.PI / 2, 5);
  });

  it("debug summon can NEVER push the room past MAX_ENEMIES (the spawn-director cap now binds it too)", () => {
    const h = makeRoom();
    h.join("p1");
    h.send("p1", "toggleTraining");
    // Flood: five max-count summons across ticks (each send costs one action token).
    for (let i = 0; i < 5; i++) {
      h.send("p1", "debugSpawn", { kind: "ronin", count: 30 });
      h.tick(1);
    }
    expect(h.state().enemies.size).toBeLessThanOrEqual(MAX_ENEMIES);
  });

  it("parry during the level-up window is DEFERRED, not executed — no risk-free invulnerable horde-scan", () => {
    const h = makeRoom();
    h.join("p1");
    const p = h.state().players.get("p1");
    const c = h.room.combat.get("p1");
    p.flexPending = 1; // the frozen-invincible level window is open
    h.send("p1", "parry");
    expect(c.invuln).toBe(0); // executeParry did NOT run…
    expect(c.parryBuffer).toBeGreaterThan(0); // …the press was queued instead
    // The window closes → the tick consumes the buffer under the common `acting` gate.
    p.flexPending = 0;
    p.flexTimer = 0;
    h.tick(1);
    expect(c.invuln).toBeGreaterThan(0);
  });

  it("in PRODUCTION the debug RPCs are unreachable — training/summon/boss-picker/dev-equip all no-op", () => {
    const h = makeRoom();
    h.join("p1");
    asProd(() => {
      h.send("p1", "toggleTraining");
      expect(h.state().mode).toBe("arena"); // the Testing Grounds do not exist on a public deploy
      h.send("p1", "spawnBossDef", { kind: "moss-stone-golem" });
      expect(
        [...h.state().enemies.values()].some(
          (e: { kind: string }) => e.kind === "moss-stone-golem",
        ),
      ).toBe(false);
      const before = h.state().players.get("p1").weapon;
      h.send("p1", "devEquip", { weapon: "x-sword-bone" });
      expect(h.state().players.get("p1").weapon).toBe(before);
    });
    // Back in dev the same client CAN enter training (the gate reads the env per call).
    h.send("p1", "toggleTraining");
    expect(h.state().mode).toBe("training");
  });

  it("in PRODUCTION belt joins ignore client-authored scrip/upgrades (no 65,535-scrip walk-ins)", () => {
    const h = makeRoom({ belt: true });
    asProd(() => {
      h.room.clients.push({ sessionId: "rich" });
      h.room.onJoin(
        { sessionId: "rich" },
        { scrip: 65535, up: { vitality: 9, fortune: 9, power: 9 } },
      );
    });
    const p = h.state().players.get("rich");
    expect(p.scrip).toBe(0);
    expect(p.upVitality).toBe(0);
    expect(p.upPower).toBe(0);
  });
});

describe("improve2 integrity regressions", () => {
  it("G-01 restores identity cooldown/global Drive debt and keeps an immediate quick-swap press buffered", () => {
    const h = makeRoom();
    h.join("swap-ledger");
    const player = h.state().players.get("swap-ledger");
    const combat = h.room.combat.get("swap-ledger");
    const gunId = WEAPON_IDS.find((id) => WEAPONS[id]?.gun);
    if (!gunId) throw new Error("expected a gun fixture");
    player.weapon = gunId;
    h.tick(1);
    combat.cd = 0.6;
    combat.drive.valueF = 80;
    combat.drive.recoveryDebtF = 0.8;
    player.weaponResource.valueQ = 8000;

    h.send("swap-ledger", "cycleWeapon", { dir: 1 });
    const swappedId = player.weapon;
    expect(swappedId).not.toBe(gunId);
    h.send("swap-ledger", "attack", { aimX: 1, aimY: 0 });
    h.tick(2);
    expect(player.attackSeq).toBe(0);
    h.tick(1);
    expect(player.attackSeq).toBe(1);

    player.weapon = gunId; // server-side setup return; the carousel ledger still owns the old debt
    h.tick(1);
    expect(combat.cd).toBeGreaterThan(0.4);
    expect([combat.reloadCd, player.maxCharges, player.charges]).toEqual([0, 0, 0]);
    expect(combat.drive.valueF).toBeLessThanOrEqual(80);
    expect(combat.drive.recoveryDebtF).toBeGreaterThan(0);
  });

  it("G-02 grants parry augments only after a resolved success receipt", () => {
    const h = makeRoom();
    h.join("parry-success");
    const player = h.state().players.get("parry-success");
    const combat = h.room.combat.get("parry-success");
    player.hp = 40;
    player.augments = "second-wind,counterblade,bulwark";

    h.send("parry-success", "parry");
    expect(player.hp).toBe(40);
    expect(h.state().projectiles.size).toBe(0);
    expect(combat.bulwarkShield).toBe(0);

    const attacker = new EnemyState();
    attacker.id = "parry-attacker";
    attacker.kind = "critter";
    attacker.x = player.x + 40;
    attacker.y = player.y;
    h.room.resolveParry(player, combat, attacker, attacker.id);
    expect(player.hp).toBeGreaterThan(40);
    expect(h.state().projectiles.size).toBeGreaterThan(0);
    expect(combat.bulwarkShield).toBeGreaterThan(0);
  });

  it("G-03 suppresses known weapon drops during a boss and uses 2%/6% ordinary rates", () => {
    const h = makeRoom();
    h.join("drop-law");
    const row = Object.entries(ENEMY_KINDS).find(
      ([, kind]) =>
        !!kind.wieldsWeapon && !!kind.dropWeapon && !kind.shifter && kind.archetype !== "boss",
    );
    if (!row) throw new Error("expected a weapon-wielding enemy fixture");
    const enemy = new EnemyState();
    enemy.id = "drop-law-enemy";
    enemy.kind = row[0];
    enemy.x = h.room.map.spawnX;
    enemy.y = h.room.map.spawnY;
    const rng = vi.spyOn(Math, "random").mockReturnValue(0.03);

    h.room.bossId = "alive-boss";
    h.room.maybeDropWeapon(enemy);
    expect(h.state().pickups.size).toBe(0);
    h.room.bossId = null;
    h.room.maybeDropWeapon(enemy);
    expect(h.state().pickups.size).toBe(0); // 3% misses trash's 2%
    enemy.tough = true;
    h.room.maybeDropWeapon(enemy);
    expect(h.state().pickups.size).toBe(1); // but lands inside tough's 6%
    rng.mockRestore();
  });

  it("polish #7 writes fixed-ring hit/final-blow ownership from the accepted source, not proximity", async () => {
    const { CombatDelivery, COMBAT_RECEIPT_CAP } = await import("@dd/shared");
    const h = makeRoom();
    h.join("author");
    h.join("nearby");
    const author = h.state().players.get("author");
    const nearby = h.state().players.get("nearby");
    author.x = 100;
    author.y = 100;
    nearby.x = 600;
    nearby.y = 600;
    const victim = new EnemyState();
    victim.id = "receipt-victim";
    victim.kind = "critter";
    victim.x = nearby.x + 1;
    victim.y = nearby.y;
    victim.hp = 1;
    h.state().enemies.set(victim.id, victim);
    const rows = [...h.state().combatReceipts];
    const kills: string[] = [];

    h.room.damageEnemy(
      victim,
      victim.id,
      5,
      kills,
      0,
      author.id,
      "six-shooter",
      CombatDelivery.Gun,
      author.x,
      author.y,
    );
    const receipt = [...h.state().combatReceipts].find((row) => row.seq === 1);
    expect(receipt?.sourcePlayerId).toBe("author");
    expect(receipt?.sourcePlayerId).not.toBe("nearby");
    expect(receipt?.targetId).toBe(victim.id);
    expect(receipt?.finalBlow).toBe(true);
    expect(receipt?.delivery).toBe(CombatDelivery.Gun);
    expect(h.state().combatReceipts.length).toBe(COMBAT_RECEIPT_CAP);
    expect([...h.state().combatReceipts]).toEqual(rows);
    expect(h.state().schemaVersion).toBe(33);
  });
});

const { BOSS_PROJECTILE_BUDGET: HOSTILE_PROJECTILE_CEILING } = await import("@dd/shared");

// ── §46 terminal-room quiescence + arena-wide hostile-projectile admission (audit follow-up). ────────────
describe("GameRoom — §46 terminal quiescence + hostile projectile ceiling", () => {
  it("a WIPE clears every combat transient, idles enemy AI, and restart revives the full simulation", () => {
    const h = makeRoom();
    h.join("p1");
    const p = h.state().players.get("p1");
    const rangedEntry = Object.entries(ENEMY_KINDS).find(([, kind]) => Boolean(kind.ranged));
    if (!rangedEntry) throw new Error("test roster needs a ranged enemy");
    const [kindId, kind] = rangedEntry;

    const enemy = new EnemyState();
    enemy.id = "terminal-spitter";
    enemy.kind = kindId;
    enemy.hp = kind.hp;
    enemy.x = h.room.map.spawnX + 120;
    enemy.y = h.room.map.spawnY;
    h.state().enemies.set(enemy.id, enemy);
    h.room.fireProjectile(enemy, p, 0, 1);

    const zone = new ZoneState();
    zone.id = "terminal-zone";
    zone.x = p.x;
    zone.y = p.y;
    zone.radius = ZONE_RADIUS;
    h.state().zones.set(zone.id, zone);
    h.room.zoneMeta.set(zone.id, ZONE_TTL);
    h.room.addTelegraphRow(0, p.x, p.y, 100, 1, 0);
    h.room.pendingQuakes.push({ t: 10, x: p.x, y: p.y, radius: 100, damage: 10, crit: 0 });

    const enemyAi = vi.spyOn(h.room, "stepSpitters");
    p.hp = 0;
    h.tick(1); // phase 7 detects the wipe and enters the shared terminal teardown
    expect(h.state().outcome).toBe("defeat");

    enemyAi.mockClear();
    h.tick(8);
    expect(h.state().enemies.size).toBe(0);
    expect(h.state().projectiles.size).toBe(0);
    expect(h.state().zones.size).toBe(0);
    expect(h.state().telegraphs.size).toBe(0);
    expect(h.room.pendingQuakes).toHaveLength(0);
    expect(enemyAi).not.toHaveBeenCalled(); // terminal ticks never enter phase 5 AI

    h.send("p1", "restart");
    expect(h.state().outcome).toBe("active");
    expect(p.alive).toBe(true);
    enemyAi.mockClear();
    h.tick(1);
    expect(h.state().elapsed).toBeGreaterThan(0);
    expect(enemyAi).toHaveBeenCalledOnce(); // restart restored the ordinary phase pipeline
  });

  it("spitter volleys obey the hostile ceiling, and a parry-reflection frees exactly one slot", () => {
    const h = makeRoom();
    h.join("p1");
    const p = h.state().players.get("p1");
    // Map-RNG law: this test pins a volley path near spawn — random POIs/pits under it (likelier since
    // the QOL-03 gate-disc solver reshapes spawn-adjacent terrain) would annihilate the volley mid-step.
    h.room.map.pois.length = 0;
    h.room.map.tiles.fill(TILE_GROUND);
    const safe = { x: h.room.map.spawnX + 120, y: h.room.map.spawnY };

    // Saturate through the central primitive: excess hostile shots are rejected before ids/state are minted.
    for (let i = 0; i < HOSTILE_PROJECTILE_CEILING + 20; i++)
      h.room.fireProjectile(safe, { x: safe.x + 1, y: safe.y }, 0, 1);
    expect(h.room.bossSink.hostileProjectiles()).toBe(HOSTILE_PROJECTILE_CEILING);
    expect(h.state().projectiles.size).toBe(HOSTILE_PROJECTILE_CEILING);

    const rangedEntry =
      Object.entries(ENEMY_KINDS).find(([, kind]) => (kind.ranged?.spread?.count ?? 0) > 1) ??
      Object.entries(ENEMY_KINDS).find(([, kind]) => Boolean(kind.ranged));
    if (!rangedEntry) throw new Error("test roster needs a ranged enemy");
    const [kindId, kind] = rangedEntry;
    const spitter = new EnemyState();
    spitter.id = "budget-spitter";
    spitter.kind = kindId;
    spitter.hp = kind.hp;
    spitter.x = p.x + 100;
    spitter.y = p.y;
    h.state().enemies.set(spitter.id, spitter);
    h.room.enemyFireCd.set(spitter.id, 0);
    h.room.stepSpitters(0.05, [{ x: p.x, y: p.y }]);
    expect(h.state().projectiles.size).toBe(HOSTILE_PROJECTILE_CEILING); // full volley rejected

    const reflected = [...h.state().projectiles.values()][0];
    if (!reflected) throw new Error("expected a projectile to reflect");
    reflected.x = p.x;
    reflected.y = p.y;
    reflected.vx = 0;
    reflected.vy = 0;
    h.room.combat.get("p1").invuln = 1;
    h.room.stepProjectiles(0.05);
    expect(reflected.hostile).toBe(false);
    expect(h.room.bossSink.hostileProjectiles()).toBe(HOSTILE_PROJECTILE_CEILING - 1);

    h.room.enemyFireCd.set(spitter.id, 0);
    h.room.stepSpitters(0.05, [{ x: p.x, y: p.y }]);
    expect(h.room.bossSink.hostileProjectiles()).toBe(HOSTILE_PROJECTILE_CEILING);
    expect(h.state().projectiles.size).toBe(HOSTILE_PROJECTILE_CEILING + 1); // one friendly + ceiling hostile

    h.room.enemyFireCd.set(spitter.id, 0);
    h.room.stepSpitters(0.05, [{ x: p.x, y: p.y }]);
    expect(h.state().projectiles.size).toBe(HOSTILE_PROJECTILE_CEILING + 1);
    h.room.fireProjectile(safe, { x: safe.x + 1, y: safe.y }, 0, 1, false, "friendly");
    expect(h.state().projectiles.size).toBe(HOSTILE_PROJECTILE_CEILING + 2); // friendlies are never capped
  });
});

// §44 P0 — appended clock regressions. These deliberately inspect the room's private accepted-swing rail;
// the harness is already `AnyRoom`, and asserting the descriptor avoids coupling timing to enemy AI/mapgen.
describe("GameRoom — §44 one effective-cooldown swing clock", () => {
  function acceptedSwing(weaponId: string, affix = "") {
    const h = makeRoom();
    h.join("clock-player");
    const player = h.state().players.get("clock-player");
    player.weapon = weaponId;
    player.weaponAffix = affix;
    h.tick(1); // settle swap; the next attack establishes the authoritative accepted epoch
    h.send("clock-player", "attack", { aimX: 1, aimY: 0 });
    h.tick(1);
    const active = h.room.meleeSwings.get("clock-player");
    if (!active) throw new Error(`expected accepted swing for ${weaponId}`);
    return { h, active };
  }

  it("keeps a slow 0.9s weapon's edge active at the pose midpoint", () => {
    const { h, active } = acceptedSwing("x-sword-coffin");
    expect(WEAPONS["x-sword-coffin"]?.cooldown).toBe(0.9);
    const toMidPose = active.swing.poseSeconds / 2 - active.elapsed;
    h.room.stepMeleeSwings(toMidPose);
    const atMidPose = h.room.meleeSwings.get("clock-player");
    expect(atMidPose).toBeDefined();
    expect(atMidPose.elapsed).toBeCloseTo(atMidPose.swing.poseSeconds / 2);
    expect(atMidPose.elapsed).toBeGreaterThanOrEqual(atMidPose.swing.activeStartSeconds);
    expect(atMidPose.elapsed).toBeLessThan(atMidPose.swing.activeEndSeconds);
  });

  it("has no active edge after a fast 0.22s weapon's pose ends", () => {
    const { h, active } = acceptedSwing("x-sword-buzzsaw");
    expect(WEAPONS["x-sword-buzzsaw"]?.cooldown).toBe(0.22);
    h.room.stepMeleeSwings(active.swing.poseSeconds - active.elapsed + 0.001);
    expect(h.room.meleeSwings.has("clock-player")).toBe(false);
  });

  it("shortens a Swift-affixed weapon's pose window with its effective cooldown", () => {
    const plain = acceptedSwing("x-sword-coffin").active.swing;
    const swift = acceptedSwing("x-sword-coffin", "swift").active.swing;
    expect(swift.effectiveCooldown).toBeCloseTo(plain.effectiveCooldown * 0.82);
    expect(swift.poseSeconds).toBeCloseTo(plain.poseSeconds * 0.82);
    expect(swift.poseSeconds).toBeLessThan(plain.poseSeconds);
  });
});

// Audit findings #15/#14 — appended only: hidden loot identity and transition-only Brand sync.
describe("GameRoom — audit sync privacy and churn regressions", () => {
  it("keeps a mystery pickup's weapon and affix off synced state until it is grabbed", () => {
    const h = makeRoom();
    h.join("loot-player");
    const player = h.state().players.get("loot-player");

    h.room.dropLoot(player.x, player.y, 1);
    const pickup = [...h.state().pickups.values()][0] as PickupState | undefined;
    expect(pickup).toBeDefined();
    expect(pickup?.known).toBe(false);
    expect(pickup?.weaponPublic).toBe("");
    expect(pickup?.affixPublic).toBe("");

    const hidden = h.room.hiddenPickupIdentities.get(pickup?.id ?? "") as
      | { weapon: string; rarity: number; affix: string }
      | undefined;
    expect(hidden?.weapon).toBeTruthy();
    expect(pickup?.weapon).toBe(hidden?.weapon); // available only on the non-serialized server object
    expect(pickup?.rarity).toBe(hidden?.rarity); // rarity remains the intentional public glow

    if (!pickup || !hidden) throw new Error("expected a server-only mystery identity");
    player.x = pickup.x;
    player.y = pickup.y;
    h.send("loot-player", "grabWeapon");

    expect(h.state().pickups.has(pickup.id)).toBe(false);
    expect(player.weapon).toBe(hidden.weapon);
    expect(player.weaponRarity).toBe(hidden.rarity);
    expect(player.weaponAffix).toBe(hidden.affix);
  });

  it("keeps the synced branded flag stable between apply and precise expiry", () => {
    const h = makeRoom();
    h.join("brand-player");
    const player = h.state().players.get("brand-player");
    player.augments = "brand";

    const enemy = new EnemyState();
    enemy.id = "brand-target";
    enemy.kind = "dummy";
    enemy.hp = DUMMY_HP;
    enemy.x = player.x + 10;
    enemy.y = player.y;
    h.state().enemies.set(enemy.id, enemy);

    h.room.applyParryAugments(player, h.room.combat.get(player.id));
    expect(enemy.branded).toBe(1);
    const initialPrecise = h.room.brandedTimers.get(enemy.id) as number;
    h.tick(1);
    expect(enemy.branded).toBe(1);
    expect(h.room.brandedTimers.get(enemy.id)).toBeLessThan(initialPrecise);

    const remaining = h.room.brandedTimers.get(enemy.id) as number;
    h.tick(Math.ceil(remaining / 0.05) + 1);
    expect(h.room.brandedTimers.has(enemy.id)).toBe(false);
    expect(enemy.branded).toBe(0);
  });
});

// §50 WHIRLWIND per-revolution damage (playtest: a held spin "blink hit" enemies once per press despite
// the blade sweeping 4π). Each completed 2π re-arms the swing's hit-once set server-side.
describe("GameRoom — §50 spin re-hits per revolution", () => {
  it("ONE whirlwind press (4π sweep) dips a pinned enemy at least twice", () => {
    const h = makeRoom();
    h.join("p1");
    h.send("p1", "toggleTraining");
    h.tick(1);
    const p = h.state().players.get("p1");
    p.weapon = "x-sword-whirlwind";
    h.tick(1);
    h.room.map.pois.length = 0;
    h.send("p1", "debugSpawn", { kind: "ronin", count: 1 });
    h.tick(1);
    const found = [...h.state().enemies.entries()].find(
      ([, e]: [string, { kind: string }]) => e.kind === "ronin",
    ) as [string, { x: number; y: number; hp: number }];
    const [rid, r] = found;
    r.hp = 100000;
    let dips = 0;
    let lastHp = r.hp;
    h.send("p1", "attack", { aimX: 1, aimY: 0, tx: p.x + 100, ty: p.y });
    for (let t = 0; t < 24; t++) {
      h.tick(1);
      const e = h.state().enemies.get(rid);
      if (!e) break;
      e.x = p.x + 80;
      e.y = p.y;
      if (e.hp < lastHp) {
        dips++;
        lastHp = e.hp;
      }
    }
    expect(dips).toBeGreaterThanOrEqual(2);
  });
});

describe("GameRoom — melee parry telegraph commitment", () => {
  it("advertises and resolves the same fixed post-lunge sector", () => {
    const h = makeRoom();
    h.join("p1");
    h.room.map.tiles.fill(TILE_GROUND);
    const p1 = h.state().players.get("p1");
    p1.x = h.room.map.spawnX;
    p1.y = h.room.map.spawnY;

    const enemy = new EnemyState();
    enemy.id = "locked-ronin";
    enemy.kind = "ronin";
    enemy.hp = 999;
    enemy.x = p1.x + 140;
    enemy.y = p1.y;
    h.state().enemies.set(enemy.id, enemy);

    let row: AnyRoom;
    for (let i = 0; i < 16 && !row; i++) {
      h.tick(1);
      row = h.state().telegraphs.get(`melee:${enemy.id}`);
    }
    expect(row).toBeDefined();
    expect(row.shape).toBe(2); // the authoritative player-center sector
    const committed = {
      x: row.x,
      y: row.y,
      range: row.a,
      halfArc: row.b,
      rot: row.rot,
    };

    // Move the original target away after Lock and place another player inside the advertised fixed sector.
    p1.x = committed.x - Math.cos(committed.rot) * (committed.range + 80);
    p1.y = committed.y - Math.sin(committed.rot) * (committed.range + 80);
    h.join("p2");
    const p2 = h.state().players.get("p2");
    p2.x = committed.x + Math.cos(committed.rot) * committed.range * 0.55;
    p2.y = committed.y + Math.sin(committed.rot) * committed.range * 0.55;
    p2.hp = p2.maxHp;

    const attackBefore = enemy.atkSeq;
    for (let i = 0; i < 8 && enemy.atkSeq === attackBefore; i++) h.tick(1);
    expect(enemy.atkSeq).toBe(attackBefore + 1);
    expect(enemy.x).toBeCloseTo(committed.x, 6);
    expect(enemy.y).toBeCloseTo(committed.y, 6);
    expect(p2.hp).toBeLessThan(p2.maxHp);
    expect(h.state().telegraphs.has(`melee:${enemy.id}`)).toBe(false);
  });
});

// ── XP PANEL: authoritative Echo field → Reach latch → arrival grant. APPENDED regression coverage;
// existing XP/leveling assertions above remain untouched as the historical compatibility net. ──────────────
const XP_PANEL = await import("@dd/shared");

describe("GameRoom — server-authoritative XP Echoes", () => {
  it("a paid death outside Reach drops exact tough XP and grants nothing before collection", () => {
    const h = makeRoom();
    h.join("p1");
    const player = h.state().players.get("p1");
    player.x = h.room.map.spawnX;
    player.y = h.room.map.spawnY;
    const enemy = new EnemyState();
    enemy.id = "xp-far";
    enemy.kind = "critter";
    enemy.tough = true;
    enemy.hp = 1;
    enemy.x = player.x + XP_PANEL.BASE_XP_MOTE_REACH + 90;
    enemy.y = player.y;
    const kills: string[] = [];

    h.room.damageEnemy(enemy, enemy.id, 999, kills);

    expect(kills).toEqual([enemy.id]);
    expect(player.xp).toBe(0);
    expect(h.state().xpEchoes.size).toBe(1);
    const echo = [...h.state().xpEchoes.values()][0];
    expect(echo?.value).toBe((ENEMY_KINDS.critter?.xpValue ?? 0) * XP_PANEL.TOUGH_XP_MULT);
    h.tick(30);
    expect(player.xp).toBe(0); // no combat TTL or whole-screen vacuum
    expect(h.state().xpEchoes.size).toBe(1);
  });

  it("latches one collector, changes no progression before collectTick, then grants the full squad", () => {
    const h = makeRoom();
    h.join("p1");
    h.join("p2");
    const p1 = h.state().players.get("p1");
    const p2 = h.state().players.get("p2");
    p1.x = h.room.map.spawnX;
    p1.y = h.room.map.spawnY;
    p2.x = p1.x + 500;
    p2.y = p1.y;
    p2.alive = false; // downed squadmates receive XP but cannot attract a new Echo
    h.room.dropXp(p1.x + 100, p1.y, 5);
    const echo = [...h.state().xpEchoes.values()][0];
    expect(echo).toBeDefined();

    for (let i = 0; i < 12 && !echo.collectorId; i++) h.tick(1);
    expect(echo.collectorId).toBe("p1");
    expect(p1.xp).toBe(0);
    expect(p2.xp).toBe(0);
    while (h.state().tick + 1 < echo.collectTick) h.tick(1);
    expect(p1.xp).toBe(0);
    expect(p1.flexPending).toBe(0);
    h.tick(1);
    expect(echo.delivered).toBe(true); // one-patch receipt latch
    expect(p1.xp).toBe(5);
    expect(p2.xp).toBe(5); // full value, never split by party size or alive state
    h.tick(1);
    expect(h.state().xpEchoes.has(echo.id)).toBe(false);
  });

  it("chooses the nearest eligible player with a stable session-id tie break", () => {
    const h = makeRoom();
    h.join("p2");
    h.join("p1");
    const p1 = h.state().players.get("p1");
    const p2 = h.state().players.get("p2");
    const x = h.room.map.spawnX;
    const y = h.room.map.spawnY;
    p1.x = x - 60;
    p1.y = y;
    p2.x = x + 60;
    p2.y = y;
    h.room.dropXp(x, y, 1);
    const echo = [...h.state().xpEchoes.values()][0];

    for (let i = 0; i < 10 && !echo.collectorId; i++) h.tick(1);

    expect(echo.collectorId).toBe("p1");
  });

  it("caps 200 paid sources at 48 synchronized rows while conserving their exact summed value", () => {
    const h = makeRoom();
    h.join("p1");
    const player = h.state().players.get("p1");
    player.x = 100;
    player.y = 100;
    for (let i = 0; i < 200; i++) {
      h.room.dropXp(600 + (i % 10) * 100, 600 + Math.floor(i / 10) * 100, 1);
    }

    expect(h.state().xpEchoes.size).toBe(XP_PANEL.MAX_XP_ECHOES);
    expect([...h.state().xpEchoes.values()].reduce((sum, echo) => sum + echo.value, 0)).toBe(200);
  });

  it("retargets a guaranteed flight when its collector disconnects without losing or duplicating value", () => {
    const h = makeRoom();
    h.join("p1");
    h.join("p2");
    const p1 = h.state().players.get("p1");
    const p2 = h.state().players.get("p2");
    p1.x = h.room.map.spawnX;
    p1.y = h.room.map.spawnY;
    p2.x = p1.x + 700;
    p2.y = p1.y;
    h.room.dropXp(p1.x + 90, p1.y, 2);
    const echo = [...h.state().xpEchoes.values()][0];
    for (let i = 0; i < 10 && !echo.collectorId; i++) h.tick(1);
    expect(echo.collectorId).toBe("p1");

    h.room.clients = h.room.clients.filter(
      (client: { sessionId: string }) => client.sessionId !== "p1",
    );
    h.room.onLeave({ sessionId: "p1" });
    h.tick(1);

    expect(echo.collectorId).toBe("p2");
    expect(echo.value).toBe(2);
    for (let i = 0; i < 12 && p2.xp === 0; i++) h.tick(1);
    expect(p2.xp).toBe(2);
  });

  it("does not create a receipt when every current player is already at the level cap", () => {
    const h = makeRoom();
    h.join("p1");
    h.state().players.get("p1").level = XP_PANEL.LEVEL_CAP;

    h.room.dropXp(1000, 1000, 20);

    expect(h.state().xpEchoes.size).toBe(0);
  });
});

// SYNCED ATTACK BEAT — appended-only server/shared contract tests. The constant is loaded here instead of
// editing the established import block so this file's historical tests remain byte-for-byte untouched.
const { ATTACK_HELD_WINDOW: ATTACK_HELD_WINDOW_TICKS } = await import("@dd/shared");

describe("GameRoom — synced authoritative attack beat", () => {
  it("bumps once per accepted melee swing, never per hit or whirlwind revolution", () => {
    const h = makeRoom();
    h.join("melee-beat");
    h.state().mode = "training";
    h.room.map.tiles.fill(TILE_GROUND);
    h.room.map.pois.length = 0;
    const player = h.state().players.get("melee-beat");
    player.weapon = "x-sword-whirlwind";
    h.tick(1); // settle the weapon swap before arming an attack

    const enemy = new EnemyState();
    enemy.id = "beat-target";
    enemy.kind = "ronin";
    enemy.hp = 100000;
    enemy.x = player.x + 80;
    enemy.y = player.y;
    h.state().enemies.set(enemy.id, enemy);

    h.send("melee-beat", "attack", { aimX: 1, aimY: 0 });
    expect(player.attackSeq).toBe(0); // request arrival is not the authoritative edge
    const acceptedTick = h.state().tick + 1;
    h.tick(1);
    expect(player.attackSeq).toBe(1);
    expect(player.attackTick).toBe(acceptedTick);

    for (let i = 0; i < 24; i++) {
      enemy.x = player.x + 80;
      enemy.y = player.y;
      h.tick(1);
    }
    expect(enemy.hp).toBeLessThan(100000); // the swept state machine actually processed hits/revolutions
    expect(player.attackSeq).toBe(1);

    h.send("melee-beat", "attack", { aimX: 1, aimY: 0 });
    h.tick(1);
    expect(player.attackSeq).toBe(2); // the next accepted descriptor is exactly one new edge
  });

  it("bumps once when a gun shot actually fires and stamps that acceptance tick", () => {
    const h = makeRoom();
    h.join("gun-beat");
    const player = h.state().players.get("gun-beat");
    player.weapon = "x-gun-revolver-cannon";
    h.tick(1);

    h.send("gun-beat", "attack", { aimX: 1, aimY: 0 });
    expect(player.attackSeq).toBe(0);
    const acceptedTick = h.state().tick + 1;
    h.tick(1);

    expect(player.attackSeq).toBe(1);
    expect(player.attackTick).toBe(acceptedTick);
    expect(player.attackHeld).toBe(true);
  });

  it("refreshes attackHeld across rapid accepted shots, then clears it at the tick window", () => {
    const h = makeRoom();
    h.join("held-beat");
    const player = h.state().players.get("held-beat");
    player.weapon = "x-gun-gatling";
    h.tick(1);

    let lapsedDuringRapidFire = false;
    for (let i = 0; i < 10 && player.attackSeq < 3; i++) {
      h.send("held-beat", "attack", { aimX: 1, aimY: 0 });
      h.tick(1);
      if (player.attackSeq > 0 && !player.attackHeld) lapsedDuringRapidFire = true;
    }
    expect(player.attackSeq).toBeGreaterThanOrEqual(3);
    expect(lapsedDuringRapidFire).toBe(false);
    expect(player.attackHeld).toBe(true);
    expect(player.attackTick).toBe(h.state().tick); // loop stops on the latest accepted shot

    h.tick(ATTACK_HELD_WINDOW_TICKS - 1);
    expect(player.attackHeld).toBe(true);
    h.tick(1);
    expect(player.attackHeld).toBe(false);
  });

  it("does not treat an accepted parry as an attack beat", () => {
    const h = makeRoom();
    h.join("parry-beat");
    const player = h.state().players.get("parry-beat");
    const combat = h.room.combat.get("parry-beat");

    h.send("parry-beat", "parry");

    expect(combat.invuln).toBeGreaterThan(0); // parry was accepted and executed
    expect(combat.parryCd).toBeGreaterThan(0);
    expect(player.attackSeq).toBe(0);
    expect(player.attackTick).toBe(0);
    expect(player.attackHeld).toBe(false);
  });

  it("does not bump for a cooldown-gated attack whose buffer lapses", () => {
    const h = makeRoom();
    h.join("gated-beat");
    const player = h.state().players.get("gated-beat");
    player.weapon = FISTS_WEAPON;
    h.tick(1);
    const combat = h.room.combat.get("gated-beat");
    combat.cd = 0.5;

    h.send("gated-beat", "attack", { aimX: 1, aimY: 0 });
    h.tick(4); // 0.20s: beyond the 0.15s attack buffer, still inside the forced cooldown

    expect(combat.attackBuffer).toBe(0);
    expect(player.attackSeq).toBe(0);
    expect(player.attackTick).toBe(0);
    expect(player.attackHeld).toBe(false);
  });

  it("stamps an accepted caster cast on the same shared attack beat", () => {
    const h = makeRoom();
    h.join("cast-beat");
    const player = h.state().players.get("cast-beat");
    player.weapon = "x-staff-arcane-lance";
    h.tick(1);

    h.send("cast-beat", "attack", { aimX: 1, aimY: 0 });
    h.tick(1);

    expect(player.attackSeq).toBe(1);
    expect(player.attackTick).toBe(h.state().tick);
    expect(h.state().projectiles.size).toBeGreaterThan(0);
  });
});

// BEAM PANEL REGRESSIONS — appended-only authoritative channel coverage.
const {
  BEAM_MIN_CHARGE_SECONDS: BEAM_CHARGE_SECONDS,
  BEAM_OVERHEAT_LOCK_SECONDS: BEAM_LOCK_SECONDS,
  DRIVE_BEAM_RESTART_THRESHOLD: BEAM_RESTART_DRIVE,
  BeamPhase: SyncedBeamPhase,
} = await import("@dd/shared");

const TEST_BEAM_WEAPON = "x2-mesa-spine-thunder-stave";

function makeBeamRoom(sessionId: string) {
  const h = makeRoom();
  h.join(sessionId);
  const player = h.state().players.get(sessionId);
  player.x = h.room.map.spawnX;
  player.y = h.room.map.spawnY;
  player.weapon = TEST_BEAM_WEAPON;
  h.room.map.pois.length = 0;
  h.tick(1); // settle the swap before the first held edge
  return { h, player, combat: h.room.combat.get(sessionId) };
}

function putBeamDummy(
  h: ReturnType<typeof makeRoom>,
  player: { x: number; y: number },
  id = "beam-dummy",
) {
  const enemy = new EnemyState();
  enemy.id = id;
  enemy.kind = "dummy";
  enemy.hp = 100_000;
  enemy.x = player.x + 180;
  enemy.y = player.y;
  h.state().enemies.set(id, enemy);
  return enemy;
}

function sendBeamFrame(
  h: ReturnType<typeof makeRoom>,
  sessionId: string,
  seq: number,
  fireHeld: boolean,
) {
  const player = h.state().players.get(sessionId);
  h.send(sessionId, "input", {
    seq,
    dx: 0,
    dy: 0,
    jump: false,
    fireHeld,
    aimX: 1,
    aimY: 0,
    targetX: player.x + 500,
    targetY: player.y,
  });
  h.tick(1);
}

describe("GameRoom — beam channel authority", () => {
  it("keeps charge non-damaging and opens authority only after the 0.65s gate", () => {
    const { h, player, combat } = makeBeamRoom("beam-charge");
    const enemy = putBeamDummy(h, player);
    const hp = enemy.hp;
    const chargeTicks = Math.round(BEAM_CHARGE_SECONDS / 0.05);

    for (let seq = 1; seq < chargeTicks; seq++) sendBeamFrame(h, player.id, seq, true);
    expect(enemy.hp).toBe(hp);
    expect(combat.beamPhase).toBe(1);
    expect(h.state().beams.get(player.id)?.phase).toBe(SyncedBeamPhase.Charging);

    sendBeamFrame(h, player.id, chargeTicks, true);
    expect(combat.beamPhase).toBe(2);
    expect(h.state().beams.get(player.id)?.phase).toBe(SyncedBeamPhase.Active);
    expect(enemy.hp).toBe(hp); // the first live slice is still held for the 0.25s crit quantum
  });

  it("deals actual-dt DPS through one swept-grid query per live server tick", () => {
    const random = vi.spyOn(Math, "random").mockReturnValue(1);
    try {
      const { h, player, combat } = makeBeamRoom("beam-dps");
      const enemy = putBeamDummy(h, player);
      const hp = enemy.hp;
      const chargeTicks = Math.round(BEAM_CHARGE_SECONDS / 0.05);
      for (let seq = 1; seq < chargeTicks; seq++) sendBeamFrame(h, player.id, seq, true);

      const query = vi.spyOn(h.room.enemyGrid, "queryAabb");
      const queryCounts: number[] = [];
      const originalSweep = h.room.damageBeamSweep.bind(h.room);
      vi.spyOn(h.room, "damageBeamSweep").mockImplementation((...args: unknown[]) => {
        const before = query.mock.calls.length;
        const result = originalSweep(...args);
        queryCounts.push(query.mock.calls.length - before);
        return result;
      });
      sendBeamFrame(h, player.id, chargeTicks, true);
      expect(enemy.hp).toBe(hp);
      sendBeamFrame(h, player.id, chargeTicks + 1, true);
      expect(hp - enemy.hp).toBeCloseTo(combat.beamDescriptor.damagePerSecond * 0.1, 6);
      for (let i = 2; i < 20; i++) sendBeamFrame(h, player.id, chargeTicks + i, true);

      expect(queryCounts).toHaveLength(20);
      expect(queryCounts.every((count) => count === 1)).toBe(true);
      expect(hp - enemy.hp).toBeCloseTo(combat.beamDescriptor.damagePerSecond, 6);
      expect(combat.beamChannelT).toBeCloseTo(1, 8);
    } finally {
      random.mockRestore();
    }
  });

  it("empties Drive after the old channel cap and restarts on the same 68-tick cycle", () => {
    const { h, player, combat } = makeBeamRoom("beam-heat");
    const chargeTicks = Math.round(BEAM_CHARGE_SECONDS / 0.05);
    for (let seq = 1; seq < chargeTicks; seq++) sendBeamFrame(h, player.id, seq, true);
    for (let i = 0; i < 25; i++) sendBeamFrame(h, player.id, chargeTicks + i, true);

    expect(combat.beamPhase).toBe(0);
    expect(combat.drive.valueF).toBe(0);
    expect(player.weaponResource.valueQ).toBe(0);
    expect(combat.drive.beamLockEndTick - h.state().tick).toBe(
      Math.round(BEAM_LOCK_SECONDS / 0.05),
    );
    expect(combat.drive.beamRequireRelease).toBe(true);
    expect(h.state().beams.get(player.id)?.phase).toBe(SyncedBeamPhase.Overheated);

    let recoveryTicks = 0;
    let seq = chargeTicks + 25;
    for (let i = 0; i < 35; i++) {
      sendBeamFrame(h, player.id, seq++, true);
      recoveryTicks++;
    }
    expect(combat.beamPhase).toBe(0);
    expect(combat.drive.valueF).toBeCloseTo(35, 8);
    expect(combat.drive.beamRequireRelease).toBe(true); // recovery cannot queue a held restart

    while (combat.drive.valueF + 1e-9 < BEAM_RESTART_DRIVE) {
      sendBeamFrame(h, player.id, seq++, false);
      recoveryTicks++;
    }
    expect(recoveryTicks).toBe(68); // old heat: 30 lock + 38 cool; Drive: 68 / (20/s @ 20Hz)
    sendBeamFrame(h, player.id, seq, true);
    expect(combat.drive.beamRequireRelease).toBe(false);
    expect(combat.beamPhase).toBe(1);
    expect(h.state().beams.get(player.id)?.phase).toBe(SyncedBeamPhase.Charging);
  });

  it("starts and stops through input state without spending ACTION_MSGS_PER_TICK", () => {
    const { h, player, combat } = makeBeamRoom("beam-budget");
    const input = h.room.inputs.get(player.id);
    expect(input.actionBudget).toBe(ACTION_MSGS_PER_TICK);

    for (let i = 0; i < ACTION_MSGS_PER_TICK * 2; i++) {
      h.send(player.id, "attack", { aimX: 1, aimY: 0 });
    }
    expect(input.actionBudget).toBe(ACTION_MSGS_PER_TICK);

    sendBeamFrame(h, player.id, 1, true);
    expect(combat.beamPhase).toBe(1);
    sendBeamFrame(h, player.id, 2, false);
    expect(combat.beamPhase).toBe(0);
    expect(input.actionBudget).toBe(ACTION_MSGS_PER_TICK);
  });

  it("keeps the authoritative muzzle origin attached while the shooter moves during fire", () => {
    const { h, player } = makeBeamRoom("beam-moving-origin");
    const chargeTicks = Math.round(BEAM_CHARGE_SECONDS / 0.05);
    for (let seq = 1; seq <= chargeTicks; seq++) sendBeamFrame(h, player.id, seq, true);

    const beforePlayerX = player.x;
    const beforePlayerY = player.y;
    const beforeRow = h.state().beams.get(player.id);
    expect(beforeRow?.phase).toBe(SyncedBeamPhase.Active);
    const beforeOriginX = beforeRow.originX;
    const beforeOriginY = beforeRow.originY;
    const muzzleOffsetX = beforeOriginX - beforePlayerX;
    const muzzleOffsetY = beforeOriginY - beforePlayerY;

    h.send(player.id, "input", {
      seq: chargeTicks + 1,
      dx: 0,
      dy: 1,
      jump: false,
      fireHeld: true,
      aimX: 1,
      aimY: 0,
      targetX: player.x + 500,
      targetY: player.y,
    });
    h.tick(1);

    const movedRow = h.state().beams.get(player.id);
    expect(player.y).toBeGreaterThan(beforePlayerY);
    expect(movedRow.phase).toBe(SyncedBeamPhase.Active);
    expect(movedRow.previousOriginX).toBeCloseTo(beforeOriginX, 8);
    expect(movedRow.previousOriginY).toBeCloseTo(beforeOriginY, 8);
    expect(movedRow.originX - player.x).toBeCloseTo(muzzleOffsetX, 8);
    expect(movedRow.originY - player.y).toBeCloseTo(muzzleOffsetY, 8);
    expect(movedRow.originY - beforeOriginY).toBeCloseTo(player.y - beforePlayerY, 8);
  });
});

// Wave 1 append-only coverage: the room owns one compatibility root and routes combat through the
// dedicated, fixed-cap worm collection instead of manufacturing ordinary EnemyState segment rows.
const wormRoomShared = await import("@dd/shared");

function makeSerrakethRoom() {
  const h = makeRoom();
  h.join("worm-host");
  h.send("worm-host", "spawnBossDef", { kind: "seam-eater" });
  const runtime = h.room.bossController?.wormRuntime;
  const root = h.state().enemies.get(h.room.bossId);
  expect(runtime).toBeDefined();
  expect(root).toBeDefined();
  return { h, runtime, root };
}

describe("GameRoom - Serraketh authoritative integration", () => {
  it("spawns through spawnBossDef and routes a radius hit to the addressed segment only", () => {
    const { h, runtime, root } = makeSerrakethRoom();
    expect(h.state().bossKind).toBe("seam-eater");
    expect(h.state().wormBoss.active).toBe(true);
    expect(h.state().wormBoss.ownerId).toBe(root.id);
    expect(h.state().enemies.size).toBe(1);

    const rootHp = root.hp;
    const neighborHp = runtime.localHp[3];
    h.room.detonate(runtime.x[2], runtime.y[2], 0, 80, 0);

    expect(runtime.active[2]).toBe(0);
    expect(runtime.condition[2]).toBe(wormRoomShared.WormSegmentCondition.Destroyed);
    expect(runtime.localHp[3]).toBe(neighborHp);
    expect(root.hp).toBe(rootHp - 80);
    expect(h.state().enemies.has(root.id)).toBe(true);
    expect([...h.state().xpEchoes.values()].map((echo: { value: number }) => echo.value)).toEqual([
      3,
    ]);
  });

  it("holds twelve live parts in twelve fixed wire rows without spending twelve enemy rows", () => {
    const { h, runtime } = makeSerrakethRoom();
    expect(runtime.beginRegrow(1, 1)).toBe(2);
    expect(runtime.effectiveBodyCount).toBe(wormRoomShared.WORM_MAX_SEGMENTS);
    expect(runtime.resolveRegrow(111)).toBe(2);

    const state = h.state();
    expect(state.wormBoss.segments.length).toBe(wormRoomShared.WORM_MAX_SEGMENTS);
    expect(state.wormBoss.activeMask).toBe((1 << wormRoomShared.WORM_MAX_SEGMENTS) - 1);
    expect(state.enemies.size).toBe(1);
    expect(h.room.effectiveEnemyBodies()).toBe(wormRoomShared.WORM_MAX_SEGMENTS);
    expect(state.enemies.size + state.wormBoss.segments.length).toBeLessThanOrEqual(
      wormRoomShared.WORM_MAX_SEGMENTS + 1,
    );
  });

  it("locks anatomy Echoes until the one terminal core release and conserves exactly 110 XP", () => {
    const { h, runtime, root } = makeSerrakethRoom();
    h.room.detonate(runtime.x[2], runtime.y[2], 0, 80, 0);
    expect(h.room.lockedWormEchoIds.size).toBe(1);
    expect(h.state().xpEchoes.get([...h.room.lockedWormEchoIds][0]).collectorId).toBe("");

    const kills: string[] = [];
    h.room.damageWormSlots([0], root.hp * 4, "test:finale", kills, 0, false);
    for (const id of kills) h.state().enemies.delete(id);

    expect(h.room.lockedWormEchoIds.size).toBe(0);
    expect(
      [...h.state().xpEchoes.values()].reduce(
        (sum: number, echo: { value: number }) => sum + echo.value,
        0,
      ),
    ).toBe(wormRoomShared.WORM_TOTAL_XP);
    expect(h.state().wormBoss.active).toBe(false);
    expect(h.state().portalOpen).toBe(true);
  });
});

// §51 WAVE 1 — tough-enemy combo authority. APPENDED ONLY: these drive the same room/tick harness as the
// historical suite and pin the panel's tick edges, geometry promises, physics caps, and duel-token law.
const enemyComboShared = await import("@dd/shared");

function makeEnemyComboRoom(depth = 1) {
  const h = makeRoom();
  h.join("combo-victim");
  h.room.map.pois.length = 0;
  h.room.map.tiles.fill(TILE_GROUND); // map-RNG law: every pinned combo position is known solid ground
  h.room.spawnAccum = -1_000_000;
  h.room.shifterCd = 1_000_000;
  h.state().depth = depth;
  const player = h.state().players.get("combo-victim");
  player.x = h.room.map.spawnX;
  player.y = h.room.map.spawnY;
  player.hp = player.maxHp;
  return { h, player, combat: h.room.combat.get(player.id) };
}

function addComboEnemy(
  h: ReturnType<typeof makeRoom>,
  player: { x: number; y: number },
  id: string,
  kind = "ronin",
  dx = 120,
) {
  const enemy = new EnemyState();
  enemy.id = id;
  enemy.kind = kind;
  enemy.tough = true;
  enemy.hp = 100_000;
  enemy.x = player.x + dx;
  enemy.y = player.y;
  h.state().enemies.set(id, enemy);
  return enemy;
}

function forceComboStart(
  h: ReturnType<typeof makeRoom>,
  enemy: InstanceType<typeof EnemyState>,
  player: AnyRoom,
  roll: number,
) {
  const st = { phase: "idle", t: 0, hits: 0, wind: 0 };
  h.room.comboState.set(enemy.id, st);
  const random = vi.spyOn(Math, "random").mockReturnValue(roll);
  try {
    h.room.commitCombo(enemy, enemy.id, ENEMY_KINDS[enemy.kind], st, player, false);
  } finally {
    random.mockRestore();
  }
  return st as AnyRoom;
}

function pinVictimInFront(player: AnyRoom, enemy: AnyRoom) {
  player.x = enemy.x - 60;
  player.y = enemy.y;
  player.vx = 0;
  player.vy = 0;
  player.mvx = 0;
  player.mvy = 0;
}

describe("GameRoom — §51 tough-enemy melee combos (Wave 1 authority)", () => {
  it("negotiates 143px ahead of the slow facing anchor, then never moves the marker or landing", () => {
    const { h, player } = makeEnemyComboRoom(1);
    const enemy = addComboEnemy(h, player, "combo-leaper", "vault-ronin", 300);
    player.aimDir = Math.PI; // live mouse aim points LEFT; approach bearing/facing is RIGHT by law

    h.tick(1); // idle → leapwind: marker exists from the decision tick
    const st = h.room.comboState.get(enemy.id);
    const row = h.state().telegraphs.get(st.tg);
    expect(st.phase).toBe("leapwind");
    expect(row.danger).toBe(0); // white duel offer, never the legacy red assault marker
    expect(row.x - player.x).toBeCloseTo(143, 6);
    expect(row.y).toBeCloseTo(player.y, 6);
    expect(enemy.comboSeq).toBe(0); // marker decision is not a documented wire edge
    const promisedX = row.x;
    const promisedY = row.y;

    player.aimDir = 0;
    player.x += 5; // legal post-marker movement inside the footprint cannot renegotiate the promise
    h.tick(6); // exact 0.30s offer → liftoff
    expect(enemy.comboSeq).toBe(1);
    expect(enemy.comboFlags & enemyComboShared.COMBO_FLAG_AIRBORNE).toBeTruthy();
    expect(h.state().telegraphs.get(st.tg).x).toBe(promisedX);
    expect(h.state().telegraphs.get(st.tg).y).toBe(promisedY);

    h.tick(7); // exact fixed 0.35s arc
    expect(enemy.x).toBeCloseTo(promisedX, 6);
    expect(enemy.y).toBeCloseTo(promisedY, 6);
    expect(enemy.comboFlags & enemyComboShared.COMBO_FLAG_AIRBORNE).toBe(0);
    expect(h.state().telegraphs.has(st.tg ?? "")).toBe(false);
    expect(enemy.comboSeq).toBe(1); // no strike Lock has happened yet
  });

  it("commits each cone at Lock=0.65 and resolves only the frozen advertised sector", () => {
    const { h, player } = makeEnemyComboRoom(1);
    const enemy = addComboEnemy(h, player, "combo-lock", "ronin", 140);
    h.tick(1); // grounded K1 begins

    let row: AnyRoom;
    for (let i = 0; i < 10 && !row; i++) {
      h.tick(1);
      row = h.state().telegraphs.get(`melee:${enemy.id}`);
    }
    expect(row).toBeDefined();
    expect(enemy.comboSeq).toBe(1); // first strike Lock, exactly once
    const frozen = { x: row.x, y: row.y, rot: row.rot, a: row.a, b: row.b };
    const hp = player.hp;
    player.x = row.x - Math.cos(row.rot) * (row.a + 100);
    player.y = row.y - Math.sin(row.rot) * (row.a + 100);

    h.tick(1);
    const still = h.state().telegraphs.get(`melee:${enemy.id}`);
    expect({ x: still.x, y: still.y, rot: still.rot, a: still.a, b: still.b }).toEqual(frozen);
    const attack = enemy.atkSeq;
    for (let i = 0; i < 4 && enemy.atkSeq === attack; i++) h.tick(1);
    expect(enemy.atkSeq).toBe(attack + 1);
    expect(player.hp).toBe(hp); // leaving after Lock beats the committed wedge; it never homes
    expect(enemy.comboSeq).toBe(1); // step two has begun, but has not reached its own Lock
  });

  it("holds a parried bait at its displaced point for 8 ticks, returns bounded, and loses to parry two", () => {
    const { h, player, combat } = makeEnemyComboRoom(3);
    const enemy = addComboEnemy(h, player, "combo-bait", "ronin", 120);
    const random = vi.spyOn(Math, "random").mockReturnValue(0.9); // K3 advanced 40% partition
    try {
      h.tick(1);
    } finally {
      random.mockRestore();
    }
    const st = h.room.comboState.get(enemy.id);
    expect(st.comboId).toBe("k3-gale-cross");
    combat.invuln = 1;
    h.tick(9); // bait resolves into the first parry
    expect(st.phase).toBe("return");
    expect(st.returnsLeft).toBe(0);
    expect(enemy.comboSeq).toBe(2); // bait Lock + return-start edge (return Lock does not double-bump)
    expect(enemy.comboFlags & enemyComboShared.COMBO_FLAG_EMPOWERED).toBeTruthy();

    const recoil0 = enemy.x;
    h.tick(1);
    const recoil1 = enemy.x;
    h.tick(1);
    const displaced = enemy.x;
    expect(Math.abs(recoil1 - recoil0)).toBeLessThanOrEqual(90.000001);
    expect(Math.abs(displaced - recoil1)).toBeLessThanOrEqual(90.000001);
    expect(Math.abs(displaced - recoil0)).toBeGreaterThan(100);
    expect(st.displacedX).toBeCloseTo(displaced, 6);
    const returnStart = st.stepStartTick;

    h.tick(7);
    expect(enemy.x).toBeCloseTo(displaced, 6);
    expect(h.state().telegraphs.has(`melee:${enemy.id}`)).toBe(false);
    h.tick(1);
    expect((h.state().tick - returnStart) >>> 0).toBeGreaterThanOrEqual(8);
    expect(enemy.x).toBeCloseTo(displaced, 6);

    let row: AnyRoom;
    for (let i = 0; i < 24 && !row; i++) {
      h.tick(1);
      row = h.state().telegraphs.get(`melee:${enemy.id}`);
    }
    expect(row).toBeDefined();
    expect(enemy.x).toBeCloseTo(displaced, 6); // path-plan origin is the post-knockback position
    player.x = row.x + Math.cos(row.rot) * row.a * 0.5;
    player.y = row.y + Math.sin(row.rot) * row.a * 0.5;
    player.vx = 0;
    player.vy = 0;
    combat.invuln = 1;
    const attack = enemy.atkSeq;
    for (let i = 0; i < 20 && enemy.atkSeq === attack; i++) {
      player.x = row.x + Math.cos(row.rot) * row.a * 0.5;
      player.y = row.y + Math.sin(row.rot) * row.a * 0.5;
      h.tick(1);
    }
    expect(enemy.atkSeq).toBe(attack + 1);
    expect(player.parriedSeq).toBe(2);
    expect(st.phase).toBe("recover");
    expect(enemy.comboFlags).toBe(0);
    expect(enemy.comboSeq).toBe(2);
  });

  it("launches and air-keeps at most twice, caps damage/control, and grants touchdown mercy", () => {
    const { h, player, combat } = makeEnemyComboRoom(5);
    const enemy = addComboEnemy(h, player, "combo-juggle", "vault-ronin", 120);
    const st = forceComboStart(h, enemy, player, 0.9); // K4 Sky Hook, without re-testing its leap opener
    expect(st.comboId).toBe("k4-sky-hook");
    const hp = player.hp;

    for (let i = 0; i < 20 && player.juggledSeq === 0; i++) {
      pinVictimInFront(player, enemy);
      h.tick(1);
    }
    expect(player.juggledSeq).toBe(1);
    expect(player.vh).toBe(enemyComboShared.JUGGLE_LAUNCH_VH);
    expect(combat.vh).toBe(enemyComboShared.JUGGLE_LAUNCH_VH);
    const launchTick = st.launchTick;

    for (let i = 0; i < 40 && player.juggledSeq < 3; i++) {
      pinVictimInFront(player, enemy);
      h.tick(1);
    }
    expect(player.juggledSeq).toBe(3); // launcher + exactly two air hits
    expect(st.juggleHits).toBe(enemyComboShared.JUGGLE_MAX_AIR_HITS);
    expect(enemy.comboSeq).toBe(3); // each of the three strike Locks, no extra churn
    expect(st.phase).toBe("recover");
    expect(enemy.comboFlags).toBe(0);
    expect(hp - player.hp).toBeLessThanOrEqual(
      player.maxHp * enemyComboShared.COMBO_DAMAGE_CAP_FRAC,
    );

    for (let i = 0; i < 40 && player.height > 0; i++) h.tick(1);
    expect(player.height).toBe(0);
    expect(((h.state().tick - launchTick) >>> 0) * 0.05).toBeLessThanOrEqual(
      enemyComboShared.JUGGLE_MAX_CONTROL_SECONDS,
    );
    expect(combat.juggleMercy).toBeGreaterThan(0);
  });

  it("lets an airborne parry ride upward and immediately breaks the remaining juggle string", () => {
    const { h, player, combat } = makeEnemyComboRoom(5);
    const enemy = addComboEnemy(h, player, "combo-air-parry", "vault-ronin", 120);
    const st = forceComboStart(h, enemy, player, 0.9);
    for (let i = 0; i < 20 && player.juggledSeq === 0; i++) {
      pinVictimInFront(player, enemy);
      h.tick(1);
    }
    expect(player.height).toBeGreaterThanOrEqual(0);
    combat.invuln = 1;
    for (let i = 0; i < 20 && st.phase !== "recover"; i++) {
      pinVictimInFront(player, enemy);
      h.tick(1);
    }
    expect(player.parriedSeq).toBe(1);
    expect(player.juggledSeq).toBe(1); // the air-keep was negated, so no second juggle edge
    expect(player.vh).toBeGreaterThan(0); // existing PARRY_LAUNCH converts their string into the player's ride
    expect(st.phase).toBe("recover");
    expect(h.room.duelTokens.has(player.id)).toBe(false);
    expect(enemy.comboFlags).toBe(0);
  });

  it("serializes two tough attackers through one victim duel/aerial token", () => {
    const { h, player } = makeEnemyComboRoom(1);
    const first = addComboEnemy(h, player, "combo-token-a", "ronin", 120);
    const second = addComboEnemy(h, player, "combo-token-b", "ronin", -120);
    h.tick(1);
    const a = h.room.comboState.get(first.id);
    const b = h.room.comboState.get(second.id);
    expect(h.room.duelTokens.size).toBe(1);
    expect(h.room.duelTokens.get(player.id)).toBe(first.id);
    expect(a.comboId).toBe("k1-sanren");
    expect(b.comboId ?? "").toBe("");
    expect(b.phase).toBe("idle");
  });

  it("ships schema 19, named depth decks, and guardrail-safe authored literals", () => {
    expect(enemyComboShared.SCHEMA_VERSION).toBe(33);
    expect(new EnemyState().comboSeq).toBe(0);
    expect(new EnemyState().comboFlags).toBe(0);
    expect(herePlayerJuggledDefault()).toBe(0);
    expect(ENEMY_KINDS.ronin?.combos).toContainEqual({ combo: "k3-gale-cross", minDepth: 3 });
    expect(ENEMY_KINDS["vault-ronin"]?.combos).toContainEqual({
      combo: "k4-sky-hook",
      minDepth: 5,
    });
    expect(ENEMY_KINDS["shifter-cinder-marshal"]?.combos).toEqual([
      { combo: "k1-sanren", minDepth: 1 },
    ]);
    expect(ENEMY_KINDS["shifter-grave-warden"]?.combos).toContainEqual({
      combo: "h4-coffin-lid",
      minDepth: 6,
    });
    for (const def of Object.values(enemyComboShared.TOUGH_COMBOS)) {
      expect(def.frontOffset).toBeGreaterThanOrEqual(143);
      expect(def.frontOffset).toBeLessThanOrEqual(156);
      expect(def.steps.filter((step) => step.kind === "airkeep").length).toBeLessThanOrEqual(2);
      for (const step of def.steps) {
        expect(step.windupTicks).toBeGreaterThanOrEqual(6);
        expect(step.step).toBeLessThanOrEqual(enemyComboShared.COMBO_STEP_MAX);
      }
    }
  });
});

function herePlayerJuggledDefault() {
  const h = makeEnemyComboRoom();
  return h.player.juggledSeq;
}

// Jump-feel J1 — appended authoritative fixtures. Every pinned position starts from an all-ground map;
// individual tests then author only the pit geometry they need.
function makeJumpFeelRoom(id = "jump-feel") {
  const h = makeRoom();
  h.join(id);
  h.room.map.pois.length = 0;
  h.room.map.tiles.fill(TILE_GROUND);
  h.room.spawnAccum = -1_000_000;
  h.room.shifterCd = 1_000_000;
  const player = h.state().players.get(id);
  player.x = h.room.map.spawnX;
  player.y = h.room.map.spawnY;
  player.hp = player.maxHp;
  const combat = h.room.combat.get(id);
  combat.lastGroundX = player.x;
  combat.lastGroundY = player.y;
  return { h, player, combat };
}

function sendJumpFeelInput(
  h: ReturnType<typeof makeRoom>,
  id: string,
  seq: number,
  fields: {
    dx?: number;
    dy?: number;
    jump?: boolean;
    crouchHeld?: boolean;
    pound?: boolean;
    fireHeld?: boolean;
  } = {},
) {
  h.send(id, "input", {
    seq,
    dx: fields.dx ?? 0,
    dy: fields.dy ?? 0,
    jump: fields.jump ?? false,
    crouchHeld: fields.crouchHeld ?? false,
    pound: fields.pound ?? false,
    fireHeld: fields.fireHeld ?? false,
    aimX: 1,
    aimY: 0,
    targetX: 0,
    targetY: 0,
  });
  h.tick(1);
}

function addJumpDummy(
  h: ReturnType<typeof makeRoom>,
  id: string,
  x: number,
  y: number,
  hp = 1_000,
) {
  const enemy = new EnemyState();
  enemy.id = id;
  enemy.kind = "dummy";
  enemy.hp = hp;
  enemy.x = x;
  enemy.y = y;
  h.state().enemies.set(id, enemy);
  return enemy;
}

describe("GameRoom — jump-feel J1 authoritative stance/physics", () => {
  it("runs the 1250/900/2200 profile at ≈47px/0.55s and clears the required 160px gap", () => {
    let height = 0;
    let vh = enemyComboShared.JUMP_VELOCITY;
    let peak = 0;
    let ticks = 0;
    do {
      const next = enemyComboShared.stepVertical(height, vh, 0.05);
      height = next.height;
      vh = next.vh;
      peak = Math.max(peak, height);
      ticks++;
    } while (height > 0 && ticks < 30);
    expect(peak).toBeGreaterThan(45);
    expect(peak).toBeLessThan(48);
    expect(ticks * 0.05).toBeCloseTo(0.55, 8);
    expect(enemyComboShared.verticalPhase(0, 0)).toBe("grounded");
    expect(enemyComboShared.verticalPhase(10, 100)).toBe("rising");
    expect(enemyComboShared.verticalPhase(10, 0)).toBe("apex");
    expect(enemyComboShared.verticalPhase(10, -100)).toBe("falling");
    expect(
      enemyComboShared.verticalTimeToGround(0, enemyComboShared.JUMP_VELOCITY) *
        enemyComboShared.MOVE_SPEED,
    ).toBeGreaterThan(160);

    const { h, player } = makeJumpFeelRoom("hop-gap");
    const { cols, tileSize } = h.room.map;
    const row = Math.floor(player.y / tileSize);
    const col = Math.floor(player.x / tileSize);
    h.room.map.tiles[row * cols + col + 1] = TILE_PIT;
    h.room.map.tiles[row * cols + col + 2] = TILE_PIT;
    const farEdge = (col + 3) * tileSize;
    player.x = (col + 1) * tileSize - 1;
    player.y = (row + 0.5) * tileSize;
    const fell = player.fellSeq;
    sendJumpFeelInput(h, player.id, 1, { jump: true });
    let seq = 2;
    while (player.height > 0 && seq < 30) {
      sendJumpFeelInput(h, player.id, seq++, { dx: 1 });
    }
    sendJumpFeelInput(h, player.id, seq, { dx: 1 });
    expect(player.x).toBeGreaterThan(farEdge);
    expect(player.fellSeq).toBe(fell);
  });

  it("keeps wire fields transition-only and distinguishes organic aborts from forced cancels", () => {
    const { h, player, combat } = makeJumpFeelRoom("stance-edges");
    expect([player.moveStance, player.poundSeq, player.stanceSeq]).toEqual([0, 0, 0]);
    sendJumpFeelInput(h, player.id, 1, { jump: true, dx: 1 });
    expect(player.moveStance).toBe(enemyComboShared.STANCE_DASH);
    h.tick(3);
    expect([player.moveStance, player.poundSeq, player.stanceSeq]).toEqual([
      enemyComboShared.STANCE_DASH,
      0,
      0,
    ]);
    h.room.damagePlayer(player, 1);
    expect(combat.stance).toBe(enemyComboShared.STANCE_NONE);
    expect([player.moveStance, player.stanceSeq]).toEqual([0, 1]);
    h.room.damagePlayer(player, 1);
    expect(player.stanceSeq).toBe(1); // no transition, no wire churn
  });

  it("launches on the first Space edge, samples live WASD, and honors cooldown", () => {
    const locked = makeJumpFeelRoom("long-jump-immediate");
    sendJumpFeelInput(locked.h, locked.player.id, 1, { jump: true, dy: 1 });
    expect(locked.combat.stance).toBe(enemyComboShared.STANCE_DASH);
    expect(locked.combat.dashBaseDirX).toBeCloseTo(0, 6);
    expect(locked.combat.dashBaseDirY).toBeCloseTo(1, 6);
    expect(locked.player.height).toBeGreaterThan(0);

    const cooldown = makeJumpFeelRoom("long-jump-cooldown");
    cooldown.combat.distJumpCd = 1;
    sendJumpFeelInput(cooldown.h, cooldown.player.id, 1, { jump: true, dx: 1 });
    expect(cooldown.combat.stance).toBe(enemyComboShared.STANCE_NONE);
    expect(cooldown.player.height).toBe(0);
  });

  it("soft-steers at <=45°/s within ±27° and reaches the authored 372px", () => {
    const reach = makeJumpFeelRoom("dash-reach");
    const startX = reach.player.x;
    sendJumpFeelInput(reach.h, reach.player.id, 1, { jump: true, dx: 1 });
    expect(reach.combat.stance).toBe(enemyComboShared.STANCE_DASH);
    for (let i = 0; i < 20 && reach.combat.stance === enemyComboShared.STANCE_DASH; i++)
      reach.h.tick(1);
    expect(reach.player.x - startX).toBeCloseTo(enemyComboShared.DIST_JUMP_REACH, 5);
    expect(reach.player.x - startX).toBeGreaterThan(320);
    expect(reach.combat.lastLandingTier).toBe(enemyComboShared.LANDING_TIER_HEAVY);
    expect(enemyComboShared.DIST_JUMP_CYCLE_SPEED).toBe(enemyComboShared.DIST_JUMP_SPEED);
    expect(reach.combat.distJumpCd).toBeGreaterThan(0);

    const steer = makeJumpFeelRoom("dash-steer");
    sendJumpFeelInput(steer.h, steer.player.id, 1, { jump: true, dy: 1 });
    let maxTurn = 0;
    let seq = 2;
    while (steer.combat.stance === enemyComboShared.STANCE_DASH && seq < 30) {
      const before = steer.combat.dashSteer;
      sendJumpFeelInput(steer.h, steer.player.id, seq++, { dx: 1 });
      if (steer.combat.stance === enemyComboShared.STANCE_DASH) {
        expect(Math.abs(steer.combat.dashSteer - before)).toBeLessThanOrEqual(
          enemyComboShared.DIST_JUMP_STEER_RADIANS_PER_SECOND * 0.05 + 1e-9,
        );
        maxTurn = Math.max(maxTurn, Math.abs(steer.combat.dashSteer));
      }
    }
    expect(maxTurn).toBeGreaterThan(0);
    expect(maxTurn).toBeLessThanOrEqual(enemyComboShared.DIST_JUMP_MAX_STEER_RADIANS + 1e-9);
  });

  it("routes the raw distance-jump landing through safeSpawnPos before freezing its direction", () => {
    const { h, player, combat } = makeJumpFeelRoom("dash-clamp");
    const rawX = player.x + enemyComboShared.DIST_JUMP_REACH;
    const rawY = player.y;
    const tx = Math.floor(rawX / h.room.map.tileSize);
    const ty = Math.floor(rawY / h.room.map.tileSize);
    h.room.map.tiles[ty * h.room.map.cols + tx] = TILE_PIT;
    const expected = enemyComboShared.safeSpawnPos(
      h.room.map,
      rawX,
      rawY,
      enemyComboShared.PLAYER_RADIUS,
    );
    const dx = expected.x - player.x;
    const dy = expected.y - player.y;
    const d = Math.hypot(dx, dy);
    sendJumpFeelInput(h, player.id, 1, { jump: true, dx: 1 });
    expect(combat.dashDirX).toBeCloseTo(dx / d, 6);
    expect(combat.dashDirY).toBeCloseTo(dy / d, 6);
    expect(combat.dashSpeed).toBeCloseTo(
      Math.min(enemyComboShared.DIST_JUMP_SPEED, d / enemyComboShared.DIST_JUMP_AIRTIME),
      6,
    );
  });

  it("gates pound above 24px, honors the 90px truth radius/cap, and lands into no-parry recovery", () => {
    const { h, player, combat } = makeJumpFeelRoom("pound-truth");
    player.height = enemyComboShared.POUND_MIN_HEIGHT;
    sendJumpFeelInput(h, player.id, 1, { pound: true });
    expect(combat.stance).toBe(enemyComboShared.STANCE_NONE);
    expect(combat.jumpBuffer).toBeGreaterThan(0); // late-air press keeps the landing-hop buffer

    player.height = 200;
    player.vh = 0;
    combat.vh = 0;
    combat.jumpBuffer = 0;
    combat.invuln = 1; // landing must surrender even a pre-existing parry window
    const inside = addJumpDummy(
      h,
      "pound-inside",
      player.x + enemyComboShared.POUND_RADIUS,
      player.y,
    );
    const outside = addJumpDummy(
      h,
      "pound-outside",
      player.x - enemyComboShared.POUND_RADIUS - 0.01,
      player.y,
    );
    const insideHp = inside.hp;
    const outsideHp = outside.hp;
    sendJumpFeelInput(h, player.id, 2, { pound: true });
    expect(combat.stance).toBe(enemyComboShared.STANCE_POUND);
    expect(combat.vh).toBe(0); // first gather tick
    const poundSeq = player.poundSeq;
    for (let i = 0; i < 10 && player.poundSeq === poundSeq; i++) h.tick(1);
    expect(insideHp - inside.hp).toBe(enemyComboShared.POUND_DAMAGE_CAP);
    expect(outside.hp).toBe(outsideHp);
    expect(player.poundSeq).toBe((poundSeq + 1) & 0xff);
    expect(combat.lastLandingTier).toBe(enemyComboShared.LANDING_TIER_HEAVY);
    expect(combat.jumpCd).toBeCloseTo(enemyComboShared.POUND_JUMP_COOLDOWN, 8);
    expect(combat.recoveryT).toBeCloseTo(enemyComboShared.POUND_RECOVERY_SECONDS, 8);
    expect(combat.invuln).toBe(0);

    const hp = player.hp;
    const parried = player.parriedSeq;
    h.room.applyBossQuake(player.x, player.y, 100, 7, 0);
    expect(player.hp).toBe(hp - 7);
    expect(player.parriedSeq).toBe(parried);
    h.send(player.id, "parry");
    expect(combat.invuln).toBe(0);
  });

  it("caps the decaying pound shove below one bodywidth and never pushes a pack across a pit lip", () => {
    const { h, player, combat } = makeJumpFeelRoom("pound-pit");
    const { cols, tileSize } = h.room.map;
    const row = Math.floor(player.y / tileSize);
    const col = Math.floor(player.x / tileSize);
    const pitX = (col + 1) * tileSize;
    for (let y = row - 1; y <= row + 1; y++) h.room.map.tiles[y * cols + col + 1] = TILE_PIT;
    player.x = pitX - 61;
    player.y = (row + 0.5) * tileSize;
    player.height = 25;
    combat.vh = 0;
    const pack = [-60, 0, 60].map((dy, i) =>
      addJumpDummy(h, `pound-pack-${i}`, pitX - 1, player.y + dy, 1_000),
    );
    const before = pack.map((enemy) => enemy.x);
    sendJumpFeelInput(h, player.id, 1, { pound: true });
    for (let i = 0; i < 12; i++) h.tick(1);
    for (let i = 0; i < pack.length; i++) {
      const enemy = pack[i]!;
      expect(h.state().enemies.has(enemy.id)).toBe(true);
      expect(isPitAtPx(h.room.map, enemy.x, enemy.y)).toBe(false);
      expect(Math.hypot(enemy.x - before[i]!, 0)).toBeLessThanOrEqual(40);
    }
  });

  it("keeps pit grace on a separate null-immunity channel so quakes cannot auto-parry", () => {
    const { h, player, combat } = makeJumpFeelRoom("pit-mercy");
    const { cols, tileSize } = h.room.map;
    const row = Math.floor(player.y / tileSize);
    const col = Math.floor(player.x / tileSize);
    combat.lastGroundX = player.x - tileSize;
    combat.lastGroundY = player.y;
    h.room.map.tiles[row * cols + col] = TILE_PIT;
    player.x = (col + 0.5) * tileSize;
    player.y = (row + 0.5) * tileSize;
    h.tick(1);
    expect(combat.pitGrace).toBeGreaterThan(0);
    expect(combat.invuln).toBe(0);
    const hp = player.hp;
    const parried = player.parriedSeq;
    const parryCd = combat.parryCd;
    h.room.applyBossQuake(player.x, player.y, 100, 20, 0);
    expect(player.hp).toBe(hp);
    expect(player.parriedSeq).toBe(parried);
    expect(combat.parryCd).toBe(parryCd);
  });

  it("classifies landing tiers at the exact 300/520 boundaries", () => {
    expect(enemyComboShared.landingThumpTier(299.999)).toBe(enemyComboShared.LANDING_TIER_SOFT);
    expect(enemyComboShared.landingThumpTier(300)).toBe(enemyComboShared.LANDING_TIER_SOLID);
    expect(enemyComboShared.landingThumpTier(520)).toBe(enemyComboShared.LANDING_TIER_SOLID);
    expect(enemyComboShared.landingThumpTier(520.001)).toBe(enemyComboShared.LANDING_TIER_HEAVY);
    expect(enemyComboShared.landingThumpTier(200, 620, true)).toBe(
      enemyComboShared.LANDING_TIER_HEAVY,
    );
  });

  it("gives a committed pound descent priority over enemy launcher/air-keep vh writes", () => {
    const { h, player, combat } = makeJumpFeelRoom("pound-priority");
    player.height = 100;
    combat.vh = 0;
    sendJumpFeelInput(h, player.id, 1, { pound: true });
    h.tick(1); // gather completes; the committed descent now owns vh
    expect(combat.vh).toBe(-enemyComboShared.POUND_SPEED);
    const enemy = addJumpDummy(h, "pound-launcher", player.x - 40, player.y);
    enemy.kind = "vault-ronin";
    const juggled = player.juggledSeq;
    h.room.comboSwing(
      enemy,
      enemy.id,
      { targetId: player.id, juggleCombo: true, comboDamage: 0 },
      { kind: "launcher", windupTicks: 6, step: 0, damageMult: 0, launch: { vh: 480, push: 0 } },
      { range: 200, halfArc: 1.2, damageMult: 0, knockbackMult: 0 },
      { x: enemy.x, y: enemy.y, aimX: 1, aimY: 0 },
    );
    expect(combat.stance).toBe(enemyComboShared.STANCE_POUND);
    expect(combat.vh).toBe(-enemyComboShared.POUND_SPEED);
    expect(player.vh).toBe(-enemyComboShared.POUND_SPEED);
    expect(player.juggledSeq).toBe(juggled);
  });

  it("ships schema 21 with the three appended uint8 stance/VFX defaults", () => {
    const player = new enemyComboShared.PlayerState();
    expect(enemyComboShared.SCHEMA_VERSION).toBe(33);
    expect([player.moveStance, player.poundSeq, player.stanceSeq]).toEqual([0, 0, 0]);
  });
});

// Wave 21a — appended class-dissolution economy, identity-snapshot, quirk-seam, and schema fixtures.
describe("GameRoom — classmerge 21a", () => {
  const attrTotal = (player: { str: number; dex: number; int: number; con: number; luk: number }) =>
    player.str + player.dex + player.int + player.con + player.luk;

  it("drains every timed-out decision in one pass through weapon default + normal ballast", () => {
    const h = makeRoom();
    h.join("timeout");
    h.send("timeout", "toggleTraining");
    h.send("timeout", "devEquip", { character: "cc-asha-the-ash-walker" });
    const player = h.state().players.get("timeout");
    player.weapon = "x-staff-arcane-lance";
    player.flexPending = 2;
    player.flexTimer = 0.01;
    const beforeTotal = attrTotal(player);
    const beforeInt = player.int;

    h.tick(1);

    expect(player.flexPending).toBe(0);
    expect(player.flexTimer).toBe(0);
    expect(player.int - beforeInt).toBe(4);
    expect(attrTotal(player) - beforeTotal).toBe(6);
  });

  it("keeps C cosmetic mid-run, then snapshots the worn identity on restart and rift descent", () => {
    const h = makeRoom();
    h.join("identity");
    const player = h.state().players.get("identity");
    const combat = h.room.combat.get("identity");
    expect(player.runCharacter).toBe("drifter");
    expect([player.str, player.dex, player.int, player.con, player.luk]).toEqual([2, 2, 2, 2, 2]);

    h.send("identity", "cycleCharacter");
    expect(player.character).toBe("cc-asha-the-ash-walker");
    expect(player.runCharacter).toBe("drifter");
    expect(combat.identityCharacter).toBe("drifter");
    expect([player.str, player.dex, player.int, player.con, player.luk]).toEqual([2, 2, 2, 2, 2]);

    h.room.restartRun();
    expect(player.runCharacter).toBe("cc-asha-the-ash-walker");
    expect(combat.identityCharacter).toBe(player.runCharacter);
    expect([player.str, player.dex, player.int, player.con, player.luk]).toEqual([2, 2, 2, 3, 1]);

    player.str += 5; // earned allocation survives the next boundary's spread-delta rebase
    h.tick(1); // refill the action budget
    h.send("identity", "cycleCharacter");
    expect(player.character).toBe("cc-bastion-vance");
    h.room.transitionDimension();
    expect(player.runCharacter).toBe("cc-bastion-vance");
    expect([player.str, player.dex, player.int, player.con, player.luk]).toEqual([8, 1, 1, 4, 1]);
  });

  it("re-snapshots every training cycle by spread delta and preserves allocated points", () => {
    const h = makeRoom();
    h.join("training-kit");
    const player = h.state().players.get("training-kit");
    h.send("training-kit", "toggleTraining");
    player.dex += 4;
    const allocatedTotal = attrTotal(player) - 10;
    h.send("training-kit", "cycleCharacter");

    expect(player.character).toBe("cc-asha-the-ash-walker");
    expect(player.runCharacter).toBe(player.character);
    expect([player.str, player.dex, player.int, player.con, player.luk]).toEqual([2, 6, 2, 3, 1]);
    expect(attrTotal(player) - 10).toBe(allocatedTotal);
    expect(player.maxHp).toBe(PLAYER_MAX_HP + enemyComboShared.CON_HP_PER);
    expect(player.hp).toBe(player.maxHp);
  });

  it("applies a cached scalar quirk at the existing parry knockback computation", () => {
    const h = makeRoom();
    h.join("kuro");
    h.send("kuro", "toggleTraining");
    h.send("kuro", "devEquip", { character: "cc-kuro-oni-the-demon-mask" });
    const player = h.state().players.get("kuro");
    const combat = h.room.combat.get("kuro");
    const enemy = new EnemyState();
    enemy.id = "temple-wall-target";
    enemy.kind = "critter";
    enemy.hp = 20;
    enemy.x = player.x + 40;
    enemy.y = player.y;
    h.state().enemies.set(enemy.id, enemy);
    const before = enemy.x;

    h.room.executeParry(player, combat);

    expect(combat.quirk.id).toBe("temple-wall");
    expect(enemy.x - before).toBeCloseTo(enemyComboShared.PARRY_KNOCKBACK * 2, 6);
  });

  it("applies a pure onParrySuccess descriptor through the nearest-ally heal seam", () => {
    const h = makeRoom();
    h.join("asha");
    h.join("ally");
    h.send("asha", "toggleTraining");
    h.send("asha", "devEquip", { character: "cc-asha-the-ash-walker" });
    const player = h.state().players.get("asha");
    const ally = h.state().players.get("ally");
    const combat = h.room.combat.get("asha");
    player.x = h.room.map.spawnX;
    player.y = h.room.map.spawnY;
    ally.x = player.x + 20;
    ally.y = player.y;
    ally.hp = 20;
    const enemy = new EnemyState();
    enemy.id = "mend-target";
    enemy.kind = "critter";
    enemy.hp = 20;
    enemy.x = player.x + 40;
    enemy.y = player.y;
    const before = ally.hp;

    h.room.resolveParry(player, combat, enemy, enemy.id);

    expect(combat.quirk.id).toBe("mend-the-broken");
    expect(ally.hp - before).toBe(enemyComboShared.PARRY_CHAIN_HEAL);
  });

  it("appends runCharacter at schema 21 with a safe Drifter default", () => {
    const player = new enemyComboShared.PlayerState();
    expect(enemyComboShared.SCHEMA_VERSION).toBe(33);
    expect(player.runCharacter).toBe("drifter");
  });
});

// Wave 23 — the Megabonk slide consumes 21b's contact-only dodge budget. Every spatial fixture starts
// on the cleared spawn disc/all-ground map so map generation cannot decide whether an authored hit connects.
// V7-MOVE — fixed tumble roll. Compatibility wire names remain `slide*`; behavior is one roll sentence.
function sendRollInput(
  h: ReturnType<typeof makeRoom>,
  id: string,
  seq: number,
  fields: {
    dx?: number;
    dy?: number;
    roll?: boolean;
    jump?: boolean;
    pound?: boolean;
    fireHeld?: boolean;
  } = {},
) {
  h.send(id, "input", {
    seq,
    dx: fields.dx ?? 0,
    dy: fields.dy ?? 0,
    jump: fields.jump ?? false,
    crouchHeld: false,
    pound: fields.pound ?? false,
    slide: fields.roll ?? false,
    slideHeld: fields.roll ?? false,
    fireHeld: fields.fireHeld ?? false,
    aimX: 1,
    aimY: 0,
    targetX: 0,
    targetY: 0,
  });
  h.tick(1);
}

function makeRollRoom(id = "roll-player") {
  const fixture = makeJumpFeelRoom(id);
  return { ...fixture, combatInput: fixture.h.room.inputs.get(id) };
}

function beginRoll(fixture: ReturnType<typeof makeRollRoom>, seq = 1, dx = 1, dy = 0) {
  sendRollInput(fixture.h, fixture.player.id, seq, { dx, dy, roll: true });
  expect(fixture.combat.stance).toBe(enemyComboShared.STANCE_SLIDE);
  expect(fixture.combat.slidePhase).toBe(enemyComboShared.SLIDE_PHASE_GROUND);
}

function addRollMeleeEnemy(fixture: ReturnType<typeof makeRollRoom>, id: string) {
  const enemy = addJumpDummy(fixture.h, id, fixture.player.x - 40, fixture.player.y, 1_000);
  enemy.kind = "vault-ronin";
  return enemy;
}

describe("GameRoom — V7 fixed tumble roll", () => {
  it("reserves one traversal edge after four catch-up heartbeats exhaust the ordinary tick budget", () => {
    const fixture = makeRollRoom("roll-reserved-edge");
    for (let seq = 1; seq <= enemyComboShared.INPUT_MSGS_PER_TICK; seq++) {
      fixture.h.send(fixture.player.id, "input", {
        seq,
        dx: 1,
        dy: 0,
        jump: false,
        crouchHeld: false,
        pound: false,
        slide: false,
        slideHeld: false,
        fireHeld: false,
        aimX: 1,
        aimY: 0,
        targetX: 0,
        targetY: 0,
      });
    }
    const edgeSeq = enemyComboShared.INPUT_MSGS_PER_TICK + 1;
    fixture.h.send(fixture.player.id, "input", {
      seq: edgeSeq,
      dx: -1,
      dy: 0,
      jump: false,
      crouchHeld: false,
      pound: false,
      slide: true,
      slideHeld: true,
      fireHeld: false,
      aimX: -1,
      aimY: 0,
      targetX: 0,
      targetY: 0,
    });

    fixture.h.tick(1);

    expect(fixture.player.ackSeq).toBe(edgeSeq);
    expect(fixture.combat.stance).toBe(enemyComboShared.STANCE_SLIDE);
    expect(fixture.combat.momentumX).toBeLessThan(0);
  });

  it("accepts from rest, freezes cardinal/diagonal direction, and travels 188 px in eight ticks", () => {
    for (const [name, dx, dy] of [
      ["east", 1, 0],
      ["west", -1, 0],
      ["northeast", 1, -1],
      ["southwest", -1, 1],
    ] as const) {
      const fixture = makeRollRoom(`roll-distance-${name}`);
      const startX = fixture.player.x;
      const startY = fixture.player.y;
      beginRoll(fixture, 1, dx, dy);
      for (let seq = 2; seq <= enemyComboShared.ROLL_DURATION_TICKS; seq++)
        sendRollInput(fixture.h, fixture.player.id, seq, { dx: -dy, dy: dx });
      expect(fixture.combat.stance).toBe(enemyComboShared.STANCE_NONE);
      const movedX = fixture.player.x - startX;
      const movedY = fixture.player.y - startY;
      expect(Math.hypot(movedX, movedY)).toBeCloseTo(enemyComboShared.ROLL_DISTANCE, 6);
      const length = Math.hypot(dx, dy);
      expect(movedX / enemyComboShared.ROLL_DISTANCE).toBeCloseTo(dx / length, 6);
      expect(movedY / enemyComboShared.ROLL_DISTANCE).toBeCloseTo(dy / length, 6);
      expect(fixture.combat.rollCd).toBeGreaterThan(2.9);
      expect([fixture.player.momentumX, fixture.player.momentumY]).toEqual([0, 0]);
    }
  });

  it("rejects the immediate repeat for three seconds, then accepts a new edge", () => {
    const fixture = makeRollRoom("roll-cooldown");
    beginRoll(fixture);
    fixture.h.tick(enemyComboShared.ROLL_DURATION_TICKS - 1);
    expect(fixture.combat.stance).toBe(enemyComboShared.STANCE_NONE);
    sendRollInput(fixture.h, fixture.player.id, 2, { dx: 1, roll: true });
    expect(fixture.combat.stance).toBe(enemyComboShared.STANCE_NONE);
    fixture.h.tick(Math.ceil(enemyComboShared.ROLL_COOLDOWN / 0.05));
    beginRoll(fixture, 3);
  });

  it("derives exactly five contact opening ticks before the vulnerable moving tail", () => {
    const fixture = makeRollRoom("roll-defensive-window");
    beginRoll(fixture);
    const hp = fixture.player.hp;
    const parried = fixture.player.parriedSeq;
    for (let tick = 1; tick <= enemyComboShared.ROLL_IFRAME_TICKS; tick++) {
      fixture.h.room.applyBossMelee(
        fixture.player.x - 20,
        fixture.player.y,
        1,
        0,
        80,
        1,
        7,
        0,
      );
      expect(fixture.player.hp).toBe(hp);
      if (tick < enemyComboShared.ROLL_IFRAME_TICKS) fixture.h.tick(1);
    }
    expect(fixture.player.parriedSeq).toBe(parried);
    fixture.h.tick(1);
    fixture.h.room.applyBossMelee(
      fixture.player.x - 20,
      fixture.player.y,
      1,
      0,
      80,
      1,
      7,
      0,
    );
    expect(fixture.player.hp).toBe(hp - 7);
  });

  it("null-whiffs hostile projectiles and locked melee without reflection or parry reward", () => {
    const projectileFixture = makeRollRoom("roll-projectile");
    beginRoll(projectileFixture);
    projectileFixture.h.room.fireProjectile(
      { x: projectileFixture.player.x, y: projectileFixture.player.y },
      { x: projectileFixture.player.x + 1, y: projectileFixture.player.y },
      0,
      13,
    );
    const projectile = [...projectileFixture.h.state().projectiles.values()].at(-1);
    expect(projectile).toBeDefined();
    if (!projectile) throw new Error("expected hostile roll fixture projectile");
    projectileFixture.h.room.stepProjectiles(0.05);
    expect(projectileFixture.player.hp).toBe(projectileFixture.player.maxHp);
    expect(projectileFixture.h.state().projectiles.has(projectile.id)).toBe(true);
    expect(projectile.hostile).toBe(true);

    const locked = makeRollRoom("roll-locked-melee");
    beginRoll(locked);
    const enemy = addRollMeleeEnemy(locked, "roll-duelist");
    locked.combat.parryChain = 2;
    const enemyX = enemy.x;
    const parried = locked.player.parriedSeq;
    locked.h.room.duelistSwing(
      enemy,
      enemy.id,
      locked.player,
      { range: 200, halfArc: 1.2, damage: 20 },
      { aimX: 1, aimY: 0 },
    );
    expect(locked.player.hp).toBe(locked.player.maxHp);
    expect(locked.player.parriedSeq).toBe(parried);
    expect(locked.combat.parryChain).toBe(2);
    expect(enemy.x).toBe(enemyX);
  });

  it("does not broaden the opening to AoE, quake, beam, ring, or puddle damage", () => {
    const cases = [
      [
        "aoe",
        (f: ReturnType<typeof makeRollRoom>) =>
          f.h.room.applyBossAoE(f.player.x, f.player.y, 80, 9, 0),
      ],
      [
        "quake",
        (f: ReturnType<typeof makeRollRoom>) =>
          f.h.room.applyBossQuake(f.player.x, f.player.y, 80, 9, 0),
      ],
      [
        "beam",
        (f: ReturnType<typeof makeRollRoom>) =>
          f.h.room.damageBeamRect(f.player.x - 20, f.player.y, 40, 20, 0, 9, 0),
      ],
      [
        "ring",
        (f: ReturnType<typeof makeRollRoom>) =>
          f.h.room.damageRingBand(f.player.x - 50, f.player.y, 50, 2, 0, 0, 9),
      ],
    ] as const;
    for (const [name, damage] of cases) {
      const fixture = makeRollRoom(`roll-${name}`);
      beginRoll(fixture);
      const hp = fixture.player.hp;
      damage(fixture);
      expect(fixture.player.hp).toBe(hp - 9);
    }

    const puddle = makeRollRoom("roll-puddle");
    beginRoll(puddle);
    const zone = new ZoneState();
    zone.id = "roll-puddle-zone";
    zone.x = puddle.player.x;
    zone.y = puddle.player.y;
    zone.radius = ZONE_RADIUS;
    puddle.h.state().zones.set(zone.id, zone);
    puddle.h.room.zoneMeta.set(zone.id, ZONE_TTL);
    const hp = puddle.player.hp;
    puddle.h.room.stepZones(0.05);
    expect(puddle.player.hp).toBeLessThan(hp);
  });

  it("keeps pit cancellation and the attack/parry channel split", () => {
    const pit = makeRollRoom("roll-pit");
    beginRoll(pit);
    const map = pit.h.room.map;
    const col = Math.floor(pit.player.x / map.tileSize);
    const row = Math.floor(pit.player.y / map.tileSize);
    for (let y = row - 2; y <= row + 2; y++)
      for (let x = col - 1; x <= col + 4; x++) map.tiles[y * map.cols + x] = TILE_PIT;
    const fell = pit.player.fellSeq;
    pit.h.tick(1);
    expect(pit.player.fellSeq).toBe((fell + 1) & 0xff);
    expect(pit.combat.stance).toBe(enemyComboShared.STANCE_NONE);

    const attack = makeRollRoom("roll-attack");
    beginRoll(attack);
    attack.h.send(attack.player.id, "attack", { aimX: 1, aimY: 0 });
    expect(attack.combat.stance).toBe(enemyComboShared.STANCE_SLIDE);
    attack.h.tick(enemyComboShared.ROLL_ATTACK_CANCEL_TICKS - 1);
    attack.h.send(attack.player.id, "attack", { aimX: 1, aimY: 0 });
    expect(attack.combat.stance).toBe(enemyComboShared.STANCE_NONE);
    expect(attack.combat.attackBuffer).toBeGreaterThan(0);

    const parry = makeRollRoom("roll-parry-lock");
    beginRoll(parry);
    for (let tick = 1; tick < enemyComboShared.ROLL_PARRY_LOCK_TICKS; tick++) {
      parry.h.send(parry.player.id, "parry");
      parry.h.tick(1);
      expect(parry.combat.invuln).toBe(0);
    }
    parry.h.send(parry.player.id, "parry");
    parry.h.tick(1);
    expect(parry.combat.invuln).toBeGreaterThan(0);
  });

  it("buffers Space through the roll tail into the default long jump", () => {
    const fixture = makeRollRoom("roll-to-long-jump");
    beginRoll(fixture);
    sendRollInput(fixture.h, fixture.player.id, 2, { dx: 1, jump: true });
    expect(fixture.combat.jumpBuffer).toBeGreaterThan(0);
    fixture.h.tick(enemyComboShared.ROLL_DURATION_TICKS - 1);
    expect(fixture.combat.stance).toBe(enemyComboShared.STANCE_DASH);
    expect(fixture.player.height).toBeGreaterThan(0);
  });

  it("keeps the append-only predictor wire defaults", () => {
    const player = new enemyComboShared.PlayerState();
    expect([player.momentumX, player.momentumY, player.slidePhase, player.slidePhaseTick]).toEqual([
      0, 0, 0, 0,
    ]);
  });
});

// MAP QOL wave — appended only. These lock the intentional post-schema-23 ordering and the new objective /
// director postconditions without weakening any historical deterministic fixture above.
describe("GameRoom — MAP QOL extraction intent and tick-order fairness", () => {
  it("creates the guaranteed boss drop before arming gates, then denies corpse-position carryover until a fresh hold", () => {
    const h = makeRoom();
    h.join("qol-extract");
    h.room.map.tiles.fill(TILE_GROUND);
    h.room.spawnAccum = -1_000_000;
    h.room.shifterCd = 1_000_000;
    const player = h.state().players.get("qol-extract");
    player.x = h.room.map.spawnX;
    player.y = h.room.map.spawnY;
    const boss = new EnemyState();
    boss.id = "qol-boss";
    boss.kind = "old-rust";
    boss.hp = 1;
    boss.x = player.x;
    boss.y = player.y;
    h.state().enemies.set(boss.id, boss);
    const order: string[] = [];
    const realDrop = h.room.dropLoot.bind(h.room);
    const realOpen = h.room.openPortal.bind(h.room);
    const dropSpy = vi.spyOn(h.room, "dropLoot").mockImplementation((...args: unknown[]) => {
      order.push("drop");
      return realDrop(...args);
    });
    const openSpy = vi.spyOn(h.room, "openPortal").mockImplementation((...args: unknown[]) => {
      order.push("gate");
      return realOpen(...args);
    });
    try {
      h.room.damageEnemy(boss, boss.id, 1, []);
    } finally {
      dropSpy.mockRestore();
      openSpy.mockRestore();
    }
    expect(order.slice(0, 2)).toEqual(["drop", "gate"]);
    expect(h.state().pickups.size).toBeGreaterThan(0);
    expect([h.state().portalX, h.state().portalY]).toEqual([player.x, player.y]);

    // More than arm+hold time while pre-held on the corpse must never bank the run.
    h.tick(40);
    expect(h.state().outcome).toBe("active");
    // Leave after arming, freshly enter, and complete the explicit 0.75s hold.
    player.x = h.state().portalX + enemyComboShared.EXTRACT_RADIUS + 30;
    player.y = h.state().portalY;
    h.tick(1);
    player.x = h.state().portalX;
    h.tick(14);
    expect(h.state().outcome).toBe("active");
    h.tick(1);
    expect(h.state().outcome).toBe("victory");
  });

  it("launches an accepted standard jump before same-tick movement can sample the pit", () => {
    const fixture = makeJumpFeelRoom("qol-jump-lip");
    const map = fixture.h.room.map;
    const row = Math.floor(fixture.player.y / map.tileSize);
    const col = Math.floor(fixture.player.x / map.tileSize);
    const lip = (col + 1) * map.tileSize;
    map.tiles[row * map.cols + col + 1] = TILE_PIT;
    fixture.player.x = lip - 8;
    fixture.player.y = (row + 0.5) * map.tileSize;
    fixture.combat.lastGroundX = fixture.player.x;
    fixture.combat.lastGroundY = fixture.player.y;
    const input = fixture.h.room.inputs.get(fixture.player.id);
    input.mvx = enemyComboShared.MOVE_SPEED;
    fixture.player.mvx = input.mvx;
    const fell = fixture.player.fellSeq;
    sendJumpFeelInput(fixture.h, fixture.player.id, 1, { dx: 1, jump: true });
    expect(fixture.player.x).toBe(lip - 8);
    expect(isPitAtPx(map, fixture.player.x, fixture.player.y)).toBe(false);
    expect(fixture.player.height).toBeGreaterThan(0);
    expect(fixture.player.fellSeq).toBe(fell);
  });

  it("launches the default long jump before its same-tick lip movement and pit sample", () => {
    const fixture = makeJumpFeelRoom("qol-long-jump-lip");
    const map = fixture.h.room.map;
    const row = Math.floor(fixture.player.y / map.tileSize);
    const col = Math.floor(fixture.player.x / map.tileSize);
    const lip = (col + 1) * map.tileSize;
    map.tiles[row * map.cols + col + 1] = TILE_PIT;
    fixture.player.x = lip - 20;
    fixture.player.y = (row + 0.5) * map.tileSize;
    fixture.combat.lastGroundX = fixture.player.x;
    fixture.combat.lastGroundY = fixture.player.y;
    const fell = fixture.player.fellSeq;
    sendJumpFeelInput(fixture.h, fixture.player.id, 1, {
      dx: 1,
      jump: true,
    });
    expect(fixture.player.x).toBe(lip - 20);
    expect(isPitAtPx(map, fixture.player.x, fixture.player.y)).toBe(false);
    expect(fixture.combat.stance).toBe(enemyComboShared.STANCE_DASH);
    expect(fixture.player.height).toBeGreaterThan(0);
    expect(fixture.player.fellSeq).toBe(fell);
  });
});

describe("GameRoom — MAP QOL final enemy-spawn fairness", () => {
  it("keeps every final clamp/snap-in result outside all living warning circles and camera rectangles across seeds", () => {
    const h = makeRoom();
    h.join("qol-spawn-a");
    h.join("qol-spawn-b");
    const a = h.state().players.get("qol-spawn-a");
    const b = h.state().players.get("qol-spawn-b");
    a.x = 120;
    a.y = 120;
    b.x = 520;
    b.y = 120;
    const rng = enemyComboShared.makeRng(0x51a0f00d);
    const random = vi.spyOn(Math, "random").mockImplementation(() => rng.next());
    let spawned = 0;
    try {
      for (let seed = 0; seed < 40; seed++) {
        h.room.map = enemyComboShared.generateArena({
          seedTerrain: seed * 2654435761,
          seedHazard: seed * 40503 + 7,
          seedTheme: seed + 1,
          seedDecor: seed * 13 + 5,
        });
        h.state().enemies.clear();
        h.room.enemyGrid.clear();
        expect(h.room.spawnEnemy([{ x: a.x, y: a.y }]), `seed ${seed} deferred`).toBe(true);
        const enemy = [...h.state().enemies.values()][0] as EnemyState | undefined;
        expect(enemy).toBeDefined();
        if (!enemy) continue;
        spawned++;
        for (const player of [a, b]) {
          const dx = enemy.x - player.x;
          const dy = enemy.y - player.y;
          expect(Math.hypot(dx, dy)).toBeGreaterThanOrEqual(
            enemyComboShared.SPAWN_RING * 0.85 - 1e-6,
          );
          expect(
            Math.abs(dx) <= enemyComboShared.SPAWN_RING * 0.8 &&
              Math.abs(dy) <= enemyComboShared.SPAWN_RING * 0.5,
          ).toBe(false);
        }
      }
    } finally {
      random.mockRestore();
    }
    expect(spawned).toBe(40);
  });

  it("defers the spawn credit when every corrected candidate snaps inside the warning distance", () => {
    const h = makeRoom();
    h.join("qol-spawn-defer");
    const player = h.state().players.get("qol-spawn-defer");
    player.x = h.room.map.spawnX;
    player.y = h.room.map.spawnY;
    h.room.map.pois.length = 0;
    h.room.map.tiles.fill(TILE_PIT);
    const col = Math.floor(player.x / h.room.map.tileSize);
    const row = Math.floor(player.y / h.room.map.tileSize);
    h.room.map.tiles[row * h.room.map.cols + col] = TILE_GROUND;
    h.state().enemies.clear();
    h.room.enemyGrid.clear();
    h.room.spawnAccum = 2;
    h.room.runSpawnDirector(0.05, [{ x: player.x, y: player.y }]);
    expect(h.state().enemies.size).toBe(0);
    expect(h.room.spawnAccum).toBeCloseTo(2.05, 8);
  });
});

// ULT U1 — appended server-core coverage. Positions are pinned on an all-ground arena so map RNG cannot
// change target order, swept-capsule contacts, or nav-valid endpoint assertions.
function makeUltimateRoom(
  family: number,
  variant: "str" | "dex" | "int" | "con" | "luk",
  id = "ult-player",
) {
  const h = makeRoom();
  h.join(id);
  h.room.map.pois.length = 0;
  h.room.map.tiles.fill(TILE_GROUND);
  h.room.spawnAccum = -999;
  const player = h.state().players.get(id);
  player.x = 1000;
  player.y = 1000;
  const combat = h.room.combat.get(id);
  player.ultFamily = family;
  player.ultVariant = variant;
  player.ultArchetype = enemyComboShared.ultimateCodeFor(family, variant);
  combat.ultChargeF = 1;
  player.ultCharge = 100;
  return { h, id, player, combat };
}

function addUltimateEnemy(
  h: ReturnType<typeof makeRoom>,
  id: string,
  x: number,
  y: number,
  hp = 1000,
  kind = "boothill",
) {
  const enemy = new EnemyState();
  enemy.id = id;
  enemy.kind = kind;
  enemy.x = x;
  enemy.y = y;
  enemy.hp = hp;
  h.state().enemies.set(id, enemy);
  h.room.insertEnemyGrid(id, enemy);
  return enemy;
}

describe("ULT U1 unlock timeout, charge truth, and validation", () => {
  it("drains AFK decisions through +2 pick/+1 ballast and attunes on the fifth decision", () => {
    const h = makeRoom();
    h.join("ult-afk");
    const player = h.state().players.get("ult-afk");
    player.weapon = "x-staff-arcane-lance"; // deterministic INT timeout default
    player.flexPending = 5;
    player.flexTimer = 0.01;
    h.tick();
    expect(enemyComboShared.ATTRS.reduce((n, attr) => n + player.allocRun[attr], 0)).toBe(15);
    expect(player.allocRun.int).toBe(15);
    expect(enemyComboShared.ultimateFamilyForCode(player.ultArchetype)).toBe(
      enemyComboShared.UltimateFamily.SunspiteComet,
    );
  });

  it("credits applied personal damage once, emits the ready edge, and enforces every anti-farm gate", () => {
    const { h, id, player, combat } = makeUltimateRoom(
      enemyComboShared.UltimateFamily.Seismarch,
      "dex",
      "ult-charge",
    );
    const enemy = addUltimateEnemy(h, "charge-target", 1100, 1000, 10000);
    const reset = () => {
      combat.ultChargeF = 0;
      combat.ultAccrualThisTick = 0;
      player.ultCharge = 0;
    };
    reset();
    h.room.damageEnemy(
      enemy,
      enemy.id,
      30,
      [],
      0,
      id,
      "rusty-cleaver",
      enemyComboShared.CombatDelivery.Melee,
    );
    expect(player.ultCharge).toBe(1); // DEX Seismarch's +15% still quantizes one displayed point.

    reset();
    const dummy = addUltimateEnemy(h, "charge-dummy", 1100, 1000, DUMMY_HP, "dummy");
    h.room.damageEnemy(dummy, dummy.id, 30, [], 0, id, "rusty-cleaver", 1);
    expect(player.ultCharge).toBe(0);

    reset();
    h.state().mode = "training";
    h.room.damageEnemy(enemy, enemy.id, 30, [], 0, id, "rusty-cleaver", 1);
    expect(player.ultCharge).toBe(0);
    h.state().mode = "arena";

    reset();
    h.room.damageEnemy(
      enemy,
      enemy.id,
      300,
      [],
      0,
      id,
      "ult:test",
      enemyComboShared.CombatDelivery.Ultimate,
    );
    expect(player.ultCharge).toBe(0); // delayed ultimate payloads never charge their own next cast.

    reset();
    for (let i = 0; i < 8; i++)
      h.room.damageEnemy(enemy, enemy.id, 1000, [], 0, id, "rusty-cleaver", 1);
    expect(combat.ultChargeF).toBeCloseTo(enemyComboShared.ULT_CHARGE_TICK_CAP, 8);

    combat.ultAccrualThisTick = 0;
    combat.ultChargeF = 0.99;
    player.ultCharge = 99;
    const seq = player.ultSeq;
    h.room.damageEnemy(enemy, enemy.id, 30, [], 0, id, "rusty-cleaver", 1);
    expect(player.ultCharge).toBe(100);
    expect(player.ultSeq).toBe((seq + 1) & 0xffff);
  });

  it("rejects uncharged, downed, juggled, and level-window activations before spending", () => {
    const { h, id, player, combat } = makeUltimateRoom(
      enemyComboShared.UltimateFamily.DimensionDoor,
      "int",
      "ult-gates",
    );
    combat.ultChargeF = 0.99;
    player.ultCharge = 99;
    h.send(id, "ultimate", { tx: 1200, ty: 1000 });
    h.tick();
    expect(player.ultPhase).toBe(enemyComboShared.UltimatePhase.Idle);
    combat.ultBuffer = 0;

    combat.ultChargeF = 1;
    player.ultCharge = 100;
    combat.juggleArmed = true;
    h.send(id, "ultimate", { tx: 1200, ty: 1000 });
    h.tick();
    expect(player.ultPhase).toBe(enemyComboShared.UltimatePhase.Idle);
    combat.ultBuffer = 0;

    combat.juggleArmed = false;
    player.flexPending = 1;
    player.flexTimer = 5;
    h.send(id, "ultimate", { tx: 1200, ty: 1000 });
    h.tick();
    expect(player.ultPhase).toBe(enemyComboShared.UltimatePhase.Idle);
    combat.ultBuffer = 0;
    player.flexPending = 0;
    player.flexTimer = 0;

    player.alive = false;
    h.send(id, "ultimate", { tx: 1200, ty: 1000 });
    expect(combat.ultBuffer).toBe(0);
    player.alive = true;
    h.send(id, "ultimate", { tx: 1200, ty: 1000 });
    h.tick();
    expect(player.ultPhase).toBe(enemyComboShared.UltimatePhase.Windup);
    expect(combat.ultChargeF).toBe(0);
  });
});

describe("ULT U1 five authoritative family executions", () => {
  it("Seismarch leaps to the resolved point, damages the inner ring, and opens a stun+ICD window", () => {
    const { h, id, player } = makeUltimateRoom(
      enemyComboShared.UltimateFamily.Seismarch,
      "dex",
      "ult-seis",
    );
    const enemy = addUltimateEnemy(h, "seis-dummy", 1200, 1000, DUMMY_HP, "dummy");
    const teleportSeq = player.teleportSeq;
    h.send(id, "ultimate", { tx: 1200, ty: 1000 });
    h.tick(
      1 + enemyComboShared.ULT_SEISMARCH_WINDUP_TICKS + enemyComboShared.ULT_SEISMARCH_AIR_TICKS,
    );
    expect(player.x).toBeCloseTo(1200, 4);
    expect(player.teleportSeq).toBe(teleportSeq + 2); // scripted-motion start and landing
    expect(enemy.hp).toBeLessThan(DUMMY_HP);
    expect(h.room.poundEnemyEffects.get(enemy.id)?.staggerT).toBeGreaterThan(1);
    expect(h.room.ultimateStunUntil.has(enemy.id)).toBe(true);
  });

  it("Alpha Strike captures only the nearest hard cap and hits on its fixed two-tick cadence", () => {
    const { h, id, player } = makeUltimateRoom(
      enemyComboShared.UltimateFamily.AlphaStrike,
      "int",
      "ult-alpha",
    );
    const enemies: EnemyState[] = [];
    for (let i = 0; i < enemyComboShared.ULT_ALPHA_MAX_TARGETS + 3; i++) {
      const enemy = addUltimateEnemy(h, `alpha-${i}`, 1080 + i * 45, 1000);
      h.room.poundEnemyEffects.set(enemy.id, { vx: 0, vy: 0, staggerT: 10 });
      enemies.push(enemy);
    }
    h.send(id, "ultimate", { tx: 1500, ty: 1000 });
    h.tick();
    const captured = h.room.combat.get(id).ult.targets.map((target: { id: string }) => target.id);
    expect(captured).toEqual(
      enemies.slice(0, enemyComboShared.ULT_ALPHA_MAX_TARGETS).map((e) => e.id),
    );
    h.tick(16);
    expect(enemies.slice(0, 5).every((enemy) => enemy.hp < 1000)).toBe(true);
    expect(enemies.slice(5).every((enemy) => enemy.hp === 1000)).toBe(true);
    const receipts = [...h.state().combatReceipts]
      .filter(
        (row) =>
          row.seq > 0 &&
          row.sourcePlayerId === id &&
          row.delivery === enemyComboShared.CombatDelivery.Ultimate,
      )
      .sort((a, b) => a.tick - b.tick);
    expect(receipts).toHaveLength(5);
    expect(receipts.slice(1).map((row, i) => row.tick - receipts[i].tick)).toEqual([2, 2, 2, 2]);
    expect(player.ultEndTick).toBeGreaterThan(player.ultResolveTick);
  });

  it("Event Horizon sweeps one capsule hit per on-line target and leaves off-line/behind bodies untouched", () => {
    const { h, id, player } = makeUltimateRoom(
      enemyComboShared.UltimateFamily.EventHorizon,
      "luk",
      "ult-event",
    );
    const onLine = addUltimateEnemy(h, "event-line", 1200, 1000);
    const offLine = addUltimateEnemy(h, "event-off", 1200, 1200);
    const behind = addUltimateEnemy(h, "event-behind", 850, 1000);
    for (const enemy of [onLine, offLine, behind])
      h.room.poundEnemyEffects.set(enemy.id, { vx: 0, vy: 0, staggerT: 10 });
    const teleportSeq = player.teleportSeq;
    h.send(id, "ultimate", { aimX: 1, aimY: 0, tx: 1600, ty: 1000 });
    h.tick(12);
    expect(onLine.hp).toBeLessThan(1000);
    expect(offLine.hp).toBe(1000);
    expect(behind.hp).toBe(1000);
    expect(h.room.ultimateBrands.has(onLine.id)).toBe(true);
    expect(player.teleportSeq).toBe(teleportSeq + 2);
    expect(player.mvx).toBe(0);
    expect(player.mvy).toBe(0);
  });

  it("Sunspite launches one WYSIWYG fireball through the existing explode/detonate receipt pipeline", () => {
    const { h, id } = makeUltimateRoom(
      enemyComboShared.UltimateFamily.SunspiteComet,
      "luk",
      "ult-comet",
    );
    const direct = addUltimateEnemy(h, "comet-direct", 1400, 1000);
    const near = addUltimateEnemy(h, "comet-near", 1500, 1000);
    const far = addUltimateEnemy(h, "comet-far", 1700, 1000);
    for (const enemy of [direct, near, far])
      h.room.poundEnemyEffects.set(enemy.id, { vx: 0, vy: 0, staggerT: 10 });
    h.send(id, "ultimate", { aimX: 1, aimY: 0, tx: 2000, ty: 1000 });
    h.tick(1 + enemyComboShared.ULT_FIREBALL_WINDUP_TICKS);
    const projectile = [...h.state().projectiles.values()].find(
      (row) => row.kind === "fireball" && !row.hostile,
    );
    expect(projectile?.explodeR).toBe(enemyComboShared.ULT_NUKE_RADIUS);
    h.tick(20);
    expect(direct.hp).toBeLessThan(1000);
    expect(near.hp).toBeLessThan(1000);
    expect(far.hp).toBe(1000);
    expect(
      [...h.state().combatReceipts].some(
        (row) =>
          row.seq > 0 &&
          row.sourcePlayerId === id &&
          row.weaponId === "ult:sunspite-comet" &&
          row.delivery === enemyComboShared.CombatDelivery.Ultimate,
      ),
    ).toBe(true);
  });

  it("Dimension Door clamps nav range, bumps teleportSeq once, creates a decoy, and honors the return ticket", () => {
    const { h, id, player } = makeUltimateRoom(
      enemyComboShared.UltimateFamily.DimensionDoor,
      "dex",
      "ult-door",
    );
    const origin = { x: player.x, y: player.y };
    const teleportSeq = player.teleportSeq;
    h.send(id, "ultimate", { tx: 9000, ty: 1000 });
    h.tick();
    expect(
      Math.hypot(player.ultTargetX - origin.x, player.ultTargetY - origin.y),
    ).toBeLessThanOrEqual(enemyComboShared.ULT_BLINK_RANGE + 1e-6);
    h.tick(enemyComboShared.ULT_BLINK_WINDUP_TICKS);
    expect(player.teleportSeq).toBe(teleportSeq + 1);
    expect(h.room.ultimateDecoys.has(id)).toBe(true);
    h.tick(enemyComboShared.ULT_BLINK_RECOVERY_TICKS + 1);
    expect(player.ultPhase).toBe(enemyComboShared.UltimatePhase.Idle);
    h.send(id, "ultimate", {});
    h.tick();
    expect(player.x).toBeCloseTo(origin.x, 4);
    expect(player.y).toBeCloseTo(origin.y, 4);
    expect(player.teleportSeq).toBe(teleportSeq + 2);
    expect(h.room.ultimateDecoys.has(id)).toBe(false);
  });

  it("Alpha Strike's STR finisher applies the shared stun ICD exactly once", () => {
    const { h, id } = makeUltimateRoom(
      enemyComboShared.UltimateFamily.AlphaStrike,
      "str",
      "ult-alpha-stun",
    );
    const enemy = addUltimateEnemy(h, "alpha-stun-target", 1120, 1000, 1000, "critter");
    h.room.poundEnemyEffects.set(enemy.id, { vx: 0, vy: 0, staggerT: 10 });
    h.send(id, "ultimate", { tx: enemy.x, ty: enemy.y });
    h.tick(3);
    expect(enemy.hp).toBeLessThan(1000);
    expect(enemy.hp).toBeGreaterThan(0);
    expect(h.state().enemies.has(enemy.id)).toBe(true);
    expect(h.room.combat.get(id).ult?.variant).toBe("str");
    const firstUntil = h.room.ultimateStunUntil.get(enemy.id);
    expect(firstUntil).toBeGreaterThan(h.state().tick);
    expect(h.room.applyUltimateStun(enemy, enemy.id, 0.5)).toBe(false);
    expect(h.room.ultimateStunUntil.get(enemy.id)).toBe(firstUntil);
  });
});

describe("ULT U1 lifecycle, co-op, and schema 25", () => {
  it("cancels on an external teleport, preserves charge through downing, and keeps downed owners inert", () => {
    const { h, id, player, combat } = makeUltimateRoom(
      enemyComboShared.UltimateFamily.EventHorizon,
      "str",
      "ult-life",
    );
    h.join("ult-life-ally");
    h.send(id, "ultimate", { aimX: 1, aimY: 0, tx: 1400, ty: 1000 });
    h.tick();
    h.room.zeroMoveVel(id); // pit/rift/revive share this authoritative external teleport signal.
    h.tick();
    expect(player.ultPhase).toBe(enemyComboShared.UltimatePhase.Idle);

    combat.ultChargeF = 0.5;
    player.ultCharge = 50;
    player.hp = 0;
    h.tick();
    expect(player.alive).toBe(false);
    expect(combat.ultChargeF).toBe(0.5);
    expect(player.ultCharge).toBe(50);
  });

  it("ships schema 25 with nine nested wire fields and direct PlayerState accessors for U2", () => {
    const h = makeRoom();
    h.join("ult-schema");
    const player = h.state().players.get("ult-schema");
    expect(h.state().schemaVersion).toBe(33);
    expect(enemyComboShared.SCHEMA_VERSION).toBe(33);
    expect([
      player.ultimate.archetype,
      player.ultimate.charge,
      player.ultimate.phase,
      player.ultimate.seq,
      player.ultimate.startTick,
      player.ultimate.resolveTick,
      player.ultimate.endTick,
      player.ultimate.targetX,
      player.ultimate.targetY,
    ]).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0]);
    player.ultCharge = 42;
    expect(player.ultimate.charge).toBe(42);
  });
});

// Pet P1 — appended server authority, bonus-seam, G-01, lifecycle, and settlement coverage.
function joinPet(
  h: ReturnType<typeof makeRoom>,
  id: string,
  petId: (typeof enemyComboShared.PET_IDS)[number],
  bondXp = 0,
  configure?: (account: ReturnType<typeof enemyComboShared.createMetaAccountV2>) => void,
) {
  const account = enemyComboShared.createMetaAccountV2();
  account.pets[petId] = { bondXp };
  account.selectedPetId = petId;
  configure?.(account);
  const client = { sessionId: id };
  h.room.clients.push(client);
  h.room.onJoin(client, { metaAccount: account, selectedPetId: petId });
  return {
    player: h.state().players.get(id),
    combat: h.room.combat.get(id),
    pet: h.room.petRuns.get(id),
    account: h.room.metaAccounts.get(id),
  };
}

describe("pet v1 join snapshot, lock, and schema 25", () => {
  it("sanitizes an unowned request, syncs only id/band, and ignores attempted mid-run selection", () => {
    const h = makeRoom();
    const account = enemyComboShared.createMetaAccountV2();
    account.pets["hearth-newt"] = { bondXp: 2700 };
    account.selectedPetId = "hearth-newt";
    const client = { sessionId: "pet-lock" };
    h.room.clients.push(client);
    h.room.onJoin(client, { metaAccount: account, selectedPetId: "brass-crab" });
    const player = h.state().players.get("pet-lock");
    expect([h.state().schemaVersion, enemyComboShared.SCHEMA_VERSION]).toEqual([33, 33]);
    expect({ petId: player.petId, petLevelBand: player.petLevelBand }).toEqual({
      petId: "hearth-newt",
      petLevelBand: 3,
    });
    expect(player.petLevel).toBeUndefined();
    expect(player.petBondXp).toBeUndefined();
    h.send("pet-lock", "selectPet", { petId: "verdant-wing" });
    expect(player.petId).toBe("hearth-newt");
    expect(h.room.petRuns.get("pet-lock").level).toBe(9);
  });
});

describe("pet v1 approved roster bonus enforcement", () => {
  it("Verdant Wing multiplies only HP regen while its retired charge capstone cannot fork Drive", () => {
    const h = makeRoom();
    const { player, combat } = joinPet(h, "verdant-max", "verdant-wing", 3600);
    h.state().mode = "training";
    player.hp = 50;
    const derivedCon = enemyComboShared.spreadAdjustedCon(player.con);
    const baseRegen = enemyComboShared.deriveStats({ con: derivedCon }).regen;
    h.room.stepSim(0.05);
    expect(player.hp).toBeCloseTo(50 + baseRegen * 1.5 * 0.05, 6);

    player.weapon = "x-gun-coffin-shotgun";
    h.room.restoreWeaponResource(player, combat, true, false);
    combat.drive.valueF = 42.25;
    combat.drive.recoveryDebtF = 0.7;
    player.weaponResource.valueQ = 4225;
    combat.cd = 0.4;
    h.room.saveWeaponResource(player, combat);
    player.weapon = "rusty-cleaver";
    h.room.restoreWeaponResource(player, combat, true, false);
    player.weapon = "x-gun-coffin-shotgun";
    h.room.restoreWeaponResource(player, combat, false, false);
    expect({
      charges: player.charges,
      maxCharges: player.maxCharges,
      cooldown: combat.cd,
      reload: combat.reloadCd,
      drive: combat.drive.valueF,
      debt: combat.drive.recoveryDebtF,
    }).toEqual({
      charges: 0,
      maxCharges: 0,
      cooldown: 0.4,
      reload: 0,
      drive: 42.25,
      debt: 0.7,
    });
    const shotgun = combat.weaponLedger.get("x-gun-coffin-shotgun");
    shotgun.cooldown = 0.05;
    player.weapon = "rusty-cleaver";
    h.room.restoreWeaponResource(player, combat, false, false);
    h.room.stepStowedWeaponResources(player, combat, 0.05);
    expect(shotgun).toEqual({ cooldown: 0 });
    expect(combat.drive.valueF).toBe(42.25);
  });

  it("Hearth Newt scales received event heals once and keeps its descent capstone exactly 15%", () => {
    const h = makeRoom();
    const { player } = joinPet(h, "hearth-max", "hearth-newt", 3600);
    player.hp = 50;
    h.room.applyHeal(player, 10);
    expect(player.hp).toBe(62);
    player.hp = 50;
    h.room.transitionDimension();
    expect(player.hp).toBe(65);
  });

  it("Lodestar Moth extends owner-centred reach and latches its 600px boundary sweep", () => {
    const h = makeRoom();
    const { player } = joinPet(h, "moth-max", "lodestar-moth", 3600);
    expect(h.room.xpMoteReach(player)).toBe(360);
    const echo = new enemyComboShared.XpEchoState();
    echo.id = "pet-moth-echo";
    echo.x = player.x + 500;
    echo.y = player.y;
    echo.value = 10;
    h.state().xpEchoes.set(echo.id, echo);
    h.room.beginXpBoundary("descent");
    expect(echo.collectorId).toBe(player.id);
  });

  it("Copper Snail expands only earned pickup reach and raises only the capstone bag admission", () => {
    const h = makeRoom();
    const { player } = joinPet(h, "copper-max", "copper-snail", 3600);
    expect(h.room.bagCapacity(player)).toBe(13);
    const unearned = new PickupState();
    unearned.id = "drop-pet-unearned";
    unearned.weapon = "x-gun-gatling";
    unearned.weaponPublic = unearned.weapon;
    unearned.x = player.x + 80;
    unearned.y = player.y;
    h.state().pickups.set(unearned.id, unearned);
    const earned = new PickupState();
    earned.id = "drop-pet-earned";
    earned.weapon = "x-gun-coffin-shotgun";
    earned.weaponPublic = earned.weapon;
    earned.x = player.x + 80;
    earned.y = player.y;
    h.state().pickups.set(earned.id, earned);
    h.room.earnedPickups.add(earned.id);
    h.send(player.id, "grabWeapon");
    expect(h.state().pickups.has(earned.id)).toBe(false);
    expect(h.state().pickups.has(unearned.id)).toBe(true);

    const low = makeRoom();
    const lowPet = joinPet(low, "copper-nine", "copper-snail", 2700);
    expect(low.room.bagCapacity(lowPet.player)).toBe(12);
  });

  it("Gilded Gecko mints only earned-sale fractions and stops at the approved level-10 cap", () => {
    const h = makeRoom({ belt: true });
    const { player, pet } = joinPet(h, "gecko-max", "gilded-gecko", 3600);
    expect(h.room.petSalePayout(player, 4, false)).toBe(0);
    expect(h.room.petSalePayout(player, 4, true)).toBe(72);
    expect(h.room.petSalePayout(player, 4, true)).toBe(72);
    expect(h.room.petSalePayout(player, 4, true)).toBe(66);
    expect(h.room.petSalePayout(player, 4, true)).toBe(60);
    expect(pet.geckoMinted).toBe(30);
    expect(pet.geckoFraction).toBeCloseTo(6, 8);
  });

  it("Brass Crab cannot accelerate retired reload debt; stowed cadence still ages once", () => {
    const h = makeRoom();
    const { player, combat } = joinPet(h, "brass-max", "brass-crab", 3600);
    h.state().mode = "training";
    player.weapon = "x-gun-coffin-shotgun";
    h.room.restoreWeaponResource(player, combat, true, false);
    combat.cd = 0.5;
    h.room.saveWeaponResource(player, combat);
    player.weapon = "rusty-cleaver";
    h.room.restoreWeaponResource(player, combat, true, false);
    const shotgun = combat.weaponLedger.get("x-gun-coffin-shotgun");
    h.room.stepStowedWeaponResources(player, combat, 0.2);
    expect(shotgun.cooldown).toBeCloseTo(0.3, 8);
    player.alive = false;
    h.room.stepStowedWeaponResources(player, combat, 0.2);
    expect(shotgun.cooldown).toBeCloseTo(0.1, 8);
    expect([player.charges, player.maxCharges, combat.reloadCd]).toEqual([0, 0, 0]);
  });

  it("Pale Firefly uses the owner's level for 156px reach and exactly 40% revive HP", () => {
    const h = makeRoom();
    const rezzer = joinPet(h, "firefly-max", "pale-firefly", 3600).player;
    const target = joinPet(h, "firefly-target", "slate-tortoise", 0).player;
    target.x = rezzer.x + 150;
    target.y = rezzer.y;
    target.alive = false;
    target.hp = 0;
    h.room.tryRez(rezzer, 96);
    expect(target.alive).toBe(true);
    expect(target.hp).toBe(Math.round(target.maxHp * 0.4));
  });

  it("Slate Tortoise mitigates only typed neutral hazards and refreshes a preserved 3s regen window", () => {
    const h = makeRoom();
    const { player, pet } = joinPet(h, "tortoise-max", "slate-tortoise", 3600);
    h.state().mode = "training";
    player.maxHp = 200;
    player.hp = 200;
    h.room.damagePlayer(player, 20, "pit");
    expect(player.hp).toBe(183);
    player.hp = 200;
    h.room.damagePlayer(player, 20, "enemy");
    expect(player.hp).toBe(180);
    player.hp = 100;
    h.room.damagePitFall(player);
    expect(pet.tortoisePitRegenSeconds).toBe(3);
    h.room.damagePitFall(player);
    expect(pet.tortoisePitRegenSeconds).toBe(3);
    player.hp = 50;
    const baseRegen = enemyComboShared.deriveStats({
      con: enemyComboShared.spreadAdjustedCon(player.con),
    }).regen;
    h.room.stepSim(0.05);
    expect(player.hp).toBeCloseTo(50 + baseRegen * 1.5 * 0.05, 6);
    expect(pet.tortoisePitRegenSeconds).toBeCloseTo(2.95, 8);
  });
});

describe("pet v1 Bond XP qualification, terminal banking, and lifecycle", () => {
  it("requires 60 seconds plus three accepted outcomes once per epoch", () => {
    const h = makeRoom();
    const { pet } = joinPet(h, "bond-eligibility", "verdant-wing", 0);
    pet.dimensionPresenceSeconds = 59.95;
    pet.acceptedActionsThisDimension = 3;
    h.room.awardPetDimensionClear();
    expect(pet.pendingBondXp).toBe(0);
    h.room.beginNextPetDimension();
    pet.dimensionPresenceSeconds = 60;
    pet.acceptedActionsThisDimension = 2;
    h.room.awardPetDimensionClear();
    expect(pet.pendingBondXp).toBe(0);
    h.room.beginNextPetDimension();
    pet.dimensionPresenceSeconds = 60;
    pet.acceptedActionsThisDimension = 3;
    h.room.awardPetDimensionClear();
    h.room.awardPetDimensionClear();
    expect({ pending: pet.pendingBondXp, clears: pet.clearReceipts }).toEqual({
      pending: 100,
      clears: 1,
    });
  });

  it("training/dummy attacks never qualify a Bond action or clear receipt", () => {
    const h = makeRoom();
    const { player, pet } = joinPet(h, "bond-training", "verdant-wing", 0);
    h.room.toggleTraining();
    h.send(player.id, "attack", { aimX: 1, aimY: 0 });
    h.tick(2);
    expect(pet.acceptedActionsThisDimension).toBe(0);
    pet.dimensionPresenceSeconds = 120;
    pet.acceptedActionsThisDimension = 99;
    h.room.awardPetDimensionClear();
    expect(pet.pendingBondXp).toBe(0);
  });

  it("banks selected-pet-only XP on defeat, victory, and extraction, idempotently", () => {
    const settle = (kind: "defeat" | "victory" | "extract") => {
      const h = makeRoom();
      const joined = joinPet(h, `bond-${kind}`, "hearth-newt", 0, (account) => {
        account.pets["verdant-wing"] = { bondXp: 120 };
        account.pets["slate-tortoise"] = { bondXp: 0 };
      });
      joined.pet.pendingBondXp = 100;
      joined.pet.clearReceipts = 1;
      if (kind === "extract") h.room.completeExtraction();
      else h.room.enterTerminalOutcome(kind);
      h.room.enterTerminalOutcome(kind === "defeat" ? "defeat" : "victory");
      return joined.account;
    };
    const defeat = settle("defeat");
    const victory = settle("victory");
    const extraction = settle("extract");
    expect(defeat.pets["hearth-newt"].bondXp).toBe(100);
    expect(victory.pets["hearth-newt"].bondXp).toBe(180);
    expect(extraction.pets["hearth-newt"].bondXp).toBe(180);
    expect([
      defeat.pets["verdant-wing"].bondXp,
      victory.pets["verdant-wing"].bondXp,
      extraction.pets["verdant-wing"].bondXp,
    ]).toEqual([120, 120, 120]);
  });

  it("preserves the exact pet snapshot, counters, Drive, and debt through down/revive", () => {
    const h = makeRoom();
    const owner = joinPet(h, "pet-downed", "verdant-wing", 3600);
    const ally = joinPet(h, "pet-rezzer", "hearth-newt", 0);
    owner.player.weapon = "x-gun-coffin-shotgun";
    h.room.restoreWeaponResource(owner.player, owner.combat, true, false);
    owner.combat.drive.valueF = 42.25;
    owner.combat.drive.recoveryDebtF = 0.7;
    owner.player.weaponResource.valueQ = 4225;
    owner.pet.pendingBondXp = 240;
    owner.pet.acceptedActionsThisDimension = 7;
    const sameRuntime = owner.pet;
    owner.player.hp = 0;
    h.tick();
    expect(owner.player.alive).toBe(false);
    const downedDrive = owner.combat.drive.valueF;
    const downedDebt = owner.combat.drive.recoveryDebtF;
    h.room.tryRez(ally.player, 10000);
    expect(owner.player.alive).toBe(true);
    expect(h.room.petRuns.get(owner.player.id)).toBe(sameRuntime);
    expect({
      petId: owner.player.petId,
      band: owner.player.petLevelBand,
      pending: owner.pet.pendingBondXp,
      actions: owner.pet.acceptedActionsThisDimension,
      drive: owner.combat.drive.valueF,
      debt: owner.combat.drive.recoveryDebtF,
      mirror: owner.player.weaponResource.valueQ,
      tombstones: [owner.player.maxCharges, owner.player.charges, owner.combat.reloadCd],
    }).toEqual({
      petId: "verdant-wing",
      band: 3,
      pending: 240,
      actions: 7,
      drive: downedDrive,
      debt: downedDebt,
      mirror: Math.floor(downedDrive * 100),
      tombstones: [0, 0, 0],
    });
  });

  it("keeps Slate's terminal-victory pity roll separate from defeat settlement", () => {
    const victory = makeRoom();
    const won = joinPet(victory, "slate-win", "verdant-wing", 0, (account) => {
      account.slateTortoisePityMisses = 7;
    });
    victory.room.enterTerminalOutcome("victory");
    expect(won.account.pets["slate-tortoise"]).toEqual({ bondXp: 0 });

    const defeat = makeRoom();
    const lost = joinPet(defeat, "slate-loss", "verdant-wing", 0, (account) => {
      account.slateTortoisePityMisses = 7;
    });
    defeat.room.enterTerminalOutcome("defeat");
    expect(lost.account.pets["slate-tortoise"]).toBeUndefined();
    expect(lost.account.slateTortoisePityMisses).toBe(7);
  });
});

describe("pet v1 owner-private protocol seams", () => {
  it("sends Copper earned-pickup eligibility only to an eligible owner", () => {
    const h = makeRoom();
    const copperMessages: Array<{ type: string; payload: unknown }> = [];
    const otherMessages: Array<{ type: string; payload: unknown }> = [];
    const copperAccount = enemyComboShared.createMetaAccountV2();
    copperAccount.pets["copper-snail"] = { bondXp: 120 };
    copperAccount.selectedPetId = "copper-snail";
    const copper = {
      sessionId: "copper-private",
      send: (type: string, payload: unknown) => copperMessages.push({ type, payload }),
    };
    const other = {
      sessionId: "non-copper-private",
      send: (type: string, payload: unknown) => otherMessages.push({ type, payload }),
    };
    h.room.clients.push(copper, other);
    h.room.onJoin(copper, { metaAccount: copperAccount });
    h.room.onJoin(other, { metaAccount: enemyComboShared.createMetaAccountV2() });
    copperMessages.length = 0;
    otherMessages.length = 0;

    h.room.earnedPickups.add("drop-earned-private");
    h.room.publishPetPickupEligibility();
    expect(copperMessages).toEqual([
      { type: "petPickupEligibility", payload: { ids: ["drop-earned-private"] } },
    ]);
    expect(otherMessages).toEqual([]);
  });
});

// Server-latency wave — append-only proof that callback-time arrivals feed the next fixed step.
describe("GameRoom — immediate input arrivals between 20Hz steps", () => {
  it("accepts mid-interval commands, drains to newest held state, and preserves skipped edges", () => {
    const { h, player } = makeBeamRoom("latency-mid-interval");
    h.tick(1, 20); // accumulator is partway to the next fixed 50ms step
    h.send(player.id, "input", {
      seq: 1,
      dx: 1,
      dy: 0,
      jump: true,
      fireHeld: true,
      aimX: 1,
      aimY: 0,
      targetX: player.x + 500,
      targetY: player.y,
    });
    h.tick(1, 20); // still no authoritative step; a normal heartbeat arrives after the edge
    h.send(player.id, "input", {
      seq: 2,
      dx: -1,
      dy: 0,
      jump: false,
      fireHeld: true,
      aimX: 1,
      aimY: 0,
      targetX: player.x + 500,
      targetY: player.y,
    });
    expect(h.room.inputs.get(player.id).queue).toHaveLength(2);

    h.tick(1, 10);
    expect(player.ackSeq).toBe(2); // fixed-step consumption remains drain-to-newest
    expect(player.mvx).toBeLessThan(0); // newest held movement owns the step
    expect(player.height).toBeGreaterThan(0); // older one-shot jump survives the drain
    expect(h.state().beams.get(player.id)?.startSeq).toBe(1); // first fire edge owns the epoch
    expect(h.room.inputs.get(player.id).queue).toHaveLength(0);
  });
});

// Dual-wield server core — append-only coverage for schema 27 and the reconciled panel laws.
function makeDualWieldFixture(
  leadId: string,
  offId: string,
  options: {
    leadRarity?: number;
    offRarity?: number;
    leadAffix?: string;
    offAffix?: string;
    leadEarned?: boolean;
    offEarned?: boolean;
    scrip?: number;
    leadCharges?: number;
    offCharges?: number;
    leadCooldown?: number;
    offCooldown?: number;
    leadReload?: number;
    offReload?: number;
  } = {},
) {
  const h = makeRoom({ belt: true });
  h.join(`dual-${leadId}-${offId}`);
  h.state().mode = "training";
  const player = h.state().players.values().next().value;
  const combat = h.room.combat.get(player.id);
  player.x = h.state().beltShopX;
  player.y = BELT_Y0 + DEPTH_MAX * 0.5;
  player.activeSlot = 0;
  player.weapon = leadId;
  player.weaponRarity = options.leadRarity ?? 0;
  player.weaponAffix = options.leadAffix ?? "";
  player.scrip = options.scrip ?? 100;
  combat.lastWeapon = leadId;
  combat.heldEarned = options.leadEarned ?? false;

  const lead = player.slots[0];
  lead.weapon = leadId;
  lead.rarity = player.weaponRarity;
  lead.affix = player.weaponAffix;
  lead.earned = combat.heldEarned;
  lead.resourceWeapon = leadId;
  lead.resourceReady = true;
  player.maxCharges = 0;
  player.charges = 0;
  combat.cd = options.leadCooldown ?? 0;
  combat.reloadCd = 0;
  lead.cooldown = combat.cd;
  lead.reload = 0;
  lead.resourceCharges = 0;

  const off = player.slots[1];
  off.weapon = offId;
  off.rarity = options.offRarity ?? 0;
  off.affix = options.offAffix ?? "";
  off.earned = options.offEarned ?? false;
  off.resourceWeapon = offId;
  off.resourceReady = true;
  off.cooldown = options.offCooldown ?? 0;
  off.reload = 0;
  off.resourceCharges = 0;

  h.send(player.id, "bindPair", { off: 1 });
  return { h, player, combat, lead, off };
}

describe("GameRoom — dual-wield schema 27 server core", () => {
  it("shares one eligibility census across class, grip, delivery, authored-dual, beam, and thrown exclusions", () => {
    const sabre = WEAPONS["rattler-sabre"]!;
    const katana = WEAPONS["x-sword-neon-katana"]!;
    const revolver = WEAPONS["x-gun-revolver-cannon"]!;
    const nailgun = WEAPONS["x-gun-nailgun"]!;
    expect(enemyComboShared.pairEligible(sabre, katana)).toBe(true);
    expect(enemyComboShared.pairEligible(revolver, nailgun)).toBe(true);
    expect(enemyComboShared.pairEligible(sabre, revolver)).toBe(false);
    expect(
      enemyComboShared.pairEligible(sabre, {
        ...katana,
        id: "two-hand",
        tags: { ...katana.tags, grip: "2H" },
      }),
    ).toBe(false);
    expect(enemyComboShared.pairEligible(sabre, WEAPONS["twin-bowie-fangs"])).toBe(false);
    expect(enemyComboShared.pairEligible(sabre, WEAPONS["rusty-cleaver"])).toBe(false);
    expect(enemyComboShared.pairEligible(sabre, sabre)).toBe(false);

    const cast = {
      ...sabre,
      id: "test-wand-a",
      cast: { damage: 4, speed: 500, range: 500, cooldown: 0.4, bulletKind: "orb" },
      tags: { ...sabre.tags, classPool: "caster", delivery: "projectile" },
    };
    const castOff = { ...cast, id: "test-wand-b", tags: { ...cast.tags, family: "orb" } };
    expect(enemyComboShared.pairEligible(cast as never, castOff as never)).toBe(true);
    expect(
      enemyComboShared.pairEligible(
        cast as never,
        { ...castOff, beam: WEAPONS["x2-voltcaster-machine-pistol"]!.beam } as never,
      ),
    ).toBe(false);
  });

  it("charges the better half's real sell value, unbinds free, and preserves anti-launder identity", () => {
    const f = makeDualWieldFixture("rattler-sabre", "x2-sandsong-saber", {
      leadRarity: 1,
      offRarity: 3,
      leadAffix: "keen",
      offAffix: "swift",
      leadEarned: true,
      offEarned: true,
      scrip: 100,
    });
    expect(f.player.offhandSlot).toBe(1);
    expect(f.player.scrip).toBe(100 - scripValue(3, true));
    const identities = [
      [f.lead.weapon, f.lead.rarity, f.lead.affix, f.lead.earned],
      [f.off.weapon, f.off.rarity, f.off.affix, f.off.earned],
    ];
    f.h.send(f.player.id, "unbindPair");
    expect(f.player.offhandSlot).toBe(255);
    expect(f.player.scrip).toBe(100 - scripValue(3, true));
    expect([
      [f.lead.weapon, f.lead.rarity, f.lead.affix, f.lead.earned],
      [f.off.weapon, f.off.rarity, f.off.affix, f.off.earned],
    ]).toEqual(identities);

    const noLaunder = makeDualWieldFixture("rattler-sabre", "x2-sandsong-saber", {
      leadRarity: 2,
      offRarity: 4,
      leadEarned: true,
      offEarned: false,
      scrip: 100,
    });
    expect(noLaunder.player.scrip).toBe(100 - scripValue(2, true));
    noLaunder.h.send(noLaunder.player.id, "unbindPair");
    noLaunder.h.send(noLaunder.player.id, "sellWeapon", { from: "slot", index: 1 });
    expect(noLaunder.player.scrip).toBe(100 - scripValue(2, true));
  });

  it("moves zero cooldown, reload, or ammo state across bind and unbind", () => {
    const f = makeDualWieldFixture("x-gun-revolver-cannon", "x-gun-nailgun", {
      leadCharges: 2,
      offCharges: 7,
      leadCooldown: 0.31,
      offCooldown: 0.47,
      leadReload: 0.83,
      offReload: 1.07,
    });
    const paired = {
      lead: [f.combat.cd, f.combat.reloadCd, f.player.charges],
      off: [f.off.cooldown, f.off.reload, f.off.resourceCharges],
    };
    f.h.send(f.player.id, "unbindPair");
    expect({
      lead: [f.combat.cd, f.combat.reloadCd, f.player.charges],
      off: [f.off.cooldown, f.off.reload, f.off.resourceCharges],
    }).toEqual(paired);
  });

  it("THE DRAIN-RATE TEST: the paired-off cooldown advances exactly once per 20Hz tick", () => {
    const f = makeDualWieldFixture("rattler-sabre", "x2-sandsong-saber", { offCooldown: 1 });
    f.h.tick(10);
    expect(f.off.cooldown).toBeCloseTo(0.5, 8);
    f.h.send(f.player.id, "unbindPair");
    f.h.tick(10);
    expect(f.off.cooldown).toBeCloseTo(0, 8);
  });

  it("loads 0.72x the incoming weapon cooldown and builds per-hand SwingDescriptors", () => {
    const f = makeDualWieldFixture("rattler-sabre", "x2-sandsong-saber", { offAffix: "swift" });
    const leadCooldown = enemyComboShared.weaponAttackCooldown(WEAPONS["rattler-sabre"]!);
    const offCooldown = enemyComboShared.weaponAttackCooldown(WEAPONS["x2-sandsong-saber"]!);
    f.combat.drawLock = 0;
    f.combat.handGate = 0;
    f.combat.cd = 0;
    f.off.cooldown = 0;
    f.h.room.resolveHandAttack(f.player, f.combat, 0, f.off, 0, false);
    expect(f.combat.handGate).toBeCloseTo(enemyComboShared.PAIR_TEMPO * offCooldown, 8);
    expect(f.h.room.meleeSwings.get(`${f.player.id}:0`).swing.effectiveCooldown).toBeCloseTo(
      enemyComboShared.PAIR_TEMPO * leadCooldown,
      8,
    );

    f.combat.handGate = 0;
    f.off.cooldown = 0;
    f.h.room.resolveHandAttack(f.player, f.combat, 1, f.off, 1, false);
    expect(f.combat.handGate).toBeCloseTo(enemyComboShared.PAIR_TEMPO * leadCooldown, 8);
    expect(f.h.room.meleeSwings.get(`${f.player.id}:1`).swing.effectiveCooldown).toBeCloseTo(
      enemyComboShared.PAIR_TEMPO * offCooldown,
      8,
    );
  });

  it("bills one Drive debit per accepted gun hand using the post-cap contribution", () => {
    const f = makeDualWieldFixture("x-gun-revolver-cannon", "x-gun-nailgun");
    f.combat.drawLock = 0;
    f.combat.handGate = 0;
    f.combat.cd = 0;
    f.off.cooldown = 0;
    const full = f.combat.drive.valueF;
    f.h.room.resolveHandAttack(f.player, f.combat, 0, f.off);
    const afterLead = f.combat.drive.valueF;
    expect(full - afterLead).toBe(10);
    expect([f.player.charges, f.off.resourceCharges, f.combat.reloadCd]).toEqual([0, 0, 0]);

    f.combat.handGate = 0;
    f.off.cooldown = 0;
    const offWeapon = WEAPONS["x-gun-nailgun"]!;
    const offProfile = enemyComboShared.weaponResourceProfile(offWeapon.id)!;
    const offInterval = enemyComboShared.effectiveAcceptedWeaponInterval(
      offWeapon,
      enemyComboShared.weaponAttackCooldown(offWeapon),
    );
    const contribution = f.h.room.pairOffhandDamageMultiplier(f.player, f.off);
    f.h.room.resolveHandAttack(f.player, f.combat, 1, f.off);
    expect(afterLead - f.combat.drive.valueF).toBeCloseTo(
      enemyComboShared.driveCostForProfile(offProfile, offInterval) * contribution,
      8,
    );
    expect(f.player.attackSeq).toBe(2);

    const dryHand = enemyComboShared.dualHandForSeq(
      (f.player.attackSeq + 1) >>> 0,
      f.player.pairBaseSeq,
    );
    f.combat.drive.valueF = 0;
    f.combat.handGate = 0;
    f.combat.cd = 0;
    f.off.cooldown = 0;
    f.combat.attackBuffer = 1;
    f.h.room.stepSim(0.05);
    expect(f.player.attackSeq).toBe(2);
    expect(
      enemyComboShared.dualHandForSeq((f.player.attackSeq + 1) >>> 0, f.player.pairBaseSeq),
    ).toBe(dryHand);
  });

  it("counts a linked pair as one set entry and applies the union of requirements to both hands", () => {
    const f = makeDualWieldFixture("rattler-sabre", "x-sword-neon-katana");
    expect(enemyComboShared.classCount(f.h.room.loadoutIds(f.player), "melee")).toBe(1);
    f.player.dex = 1;
    const union = enemyComboShared.pairRequirementPenalty(
      WEAPONS["rattler-sabre"]!,
      WEAPONS["x-sword-neon-katana"]!,
      f.player,
    );
    const pairedLead = f.h.room.heldDamageMult(
      WEAPONS["rattler-sabre"],
      WEAPONS["rattler-sabre"]!.scalingGrades,
      f.player,
      0,
    );
    expect(union).toBe(enemyComboShared.REQ_PENALTY_FLOOR);
    f.h.send(f.player.id, "unbindPair");
    expect(enemyComboShared.classCount(f.h.room.loadoutIds(f.player), "melee")).toBe(2);
    const soloLead = f.h.room.heldDamageMult(
      WEAPONS["rattler-sabre"],
      WEAPONS["rattler-sabre"]!.scalingGrades,
      f.player,
      0,
    );
    expect(pairedLead).toBeLessThan(soloLead * 0.3);
  });

  it("enforces the 1.37x throughput cap and the 1.45x matched-family cap", () => {
    const assertCap = (leadId: string, offId: string, cap: number) => {
      const lead = WEAPONS[leadId]!;
      const off = WEAPONS[offId]!;
      const leadDamage = enemyComboShared.pairDamagePerUse(lead);
      const offDamage = enemyComboShared.pairDamagePerUse(off);
      const mult = enemyComboShared.dualOffhandDamageMultiplier(lead, off);
      const ratio =
        (lead.cooldown * (leadDamage + offDamage * mult)) /
        (leadDamage * enemyComboShared.PAIR_TEMPO * (lead.cooldown + off.cooldown));
      expect(ratio).toBeLessThanOrEqual(cap + 1e-9);
    };
    assertCap("rattler-sabre", "x2-sandsong-saber", enemyComboShared.DUAL_THROUGHPUT_CAP);
    assertCap("rattler-sabre", "x-sword-neon-katana", enemyComboShared.DUAL_MATCHED_THROUGHPUT_CAP);
  });

  it("derives gun/caster parity through uint32 wrap and advances melee through the six-beat chain", () => {
    expect([1, 2, 3, 4].map((seq) => enemyComboShared.dualHandForSeq(seq, 0))).toEqual([
      0, 1, 0, 1,
    ]);
    expect(enemyComboShared.dualHandForSeq(0, 0xffffffff)).toBe(0);
    expect(enemyComboShared.dualHandForSeq(1, 0xffffffff)).toBe(1);
    expect(enemyComboShared.DUAL_MELEE_PAIR_BAR).toEqual([
      "lead",
      "off",
      "lead",
      "off",
      "lead",
      "both",
    ]);

    let previousSeq: number | undefined;
    let previousAt = 0;
    let previousStep = 0;
    let expires = 0;
    const steps: number[] = [];
    for (let seq = 1; seq <= 6; seq++) {
      const at = seq * 100;
      const step = enemyComboShared.comboStepForChain(
        seq,
        at,
        "pair",
        "arc",
        6,
        previousSeq,
        previousAt,
        "pair",
        previousSeq === undefined ? undefined : "arc",
        previousStep,
        expires,
      );
      steps.push(step);
      previousSeq = seq;
      previousAt = at;
      previousStep = step;
      expires = at + 200;
    }
    expect(steps).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("attributes overlapping paired melee receipts to each firing hand's weapon id and ships schema 27", () => {
    const f = makeDualWieldFixture("rattler-sabre", "x2-sandsong-saber");
    const enemy = new EnemyState();
    enemy.id = "dual-receipt-target";
    enemy.kind = "critter";
    enemy.hp = 1000;
    enemy.x = f.player.x + 60;
    enemy.y = f.player.y;
    f.h.state().enemies.set(enemy.id, enemy);
    f.h.room.insertEnemyGrid(enemy.id, enemy);
    f.combat.drawLock = 0;
    f.combat.cd = 0;
    f.off.cooldown = 0;
    f.h.room.resolveHandAttack(f.player, f.combat, 0, f.off, 0, false);
    f.combat.handGate = 0;
    f.off.cooldown = 0;
    f.h.room.resolveHandAttack(f.player, f.combat, 1, f.off, 1, false);
    for (let i = 0; i < 10; i++) f.h.room.stepMeleeSwings(0.05);
    const weaponIds = [...f.h.state().combatReceipts]
      .filter((receipt) => receipt.seq > 0 && receipt.sourcePlayerId === f.player.id)
      .map((receipt) => receipt.weaponId);
    expect(new Set(weaponIds)).toEqual(new Set(["rattler-sabre", "x2-sandsong-saber"]));

    const fresh = new enemyComboShared.PlayerState();
    expect(enemyComboShared.SCHEMA_VERSION).toBe(33);
    expect(new enemyComboShared.ArenaState().schemaVersion).toBe(33);
    expect(fresh.dualWield).toMatchObject({
      offhandSlot: 255,
      pairBaseSeq: 0,
      offCharges: 0,
      offMaxCharges: 0,
    });
    expect([fresh.offhandSlot, fresh.pairBaseSeq, fresh.offCharges, fresh.offMaxCharges]).toEqual([
      255, 0, 0, 0,
    ]);
  });
});

// Server-tuning wave — appended regression laws for the shared pivot, melee goldens, and grid separation.
describe("server-tuning wave — momentum, melee pressure, and enemy separation", () => {
  it("retains at least 95.8% movement speed on a full reversal after the 90% gate reduction", () => {
    const reversed = enemyComboShared.steerVelocity(
      { vx: enemyComboShared.MOVE_SPEED, vy: 0 },
      { dx: -1, dy: 0 },
      0.05,
    );
    const retention = Math.hypot(reversed.vx, reversed.vy) / enemyComboShared.MOVE_SPEED;
    expect(enemyComboShared.MOVE_HITCH_DIP).toBe(0.042); // 0.42 → 0.042
    expect(retention).toBeCloseTo(1 - enemyComboShared.MOVE_HITCH_DIP, 10);
    expect(retention).toBeGreaterThanOrEqual(0.958);
  });

  it("pins the faster melee roster and 1.30x authoritative swing sectors", () => {
    expect(ENEMY_KINDS.critter?.speed).toBe(210); // 168 → 210
    expect(ENEMY_KINDS["mote-swarm"]?.speed).toBe(281.25); // 225 → 281.25
    expect(ENEMY_KINDS.pricklepulp?.speed).toBe(77.5); // 62 → 77.5
    expect(ENEMY_KINDS.ronin?.speed).toBe(195); // 156 → 195
    expect(ENEMY_KINDS["vault-ronin"]?.speed).toBe(180); // 150 → 180 (leap rail)
    expect(ENEMY_KINDS["frozen-knight"]?.speed).toBe(187.5); // 150 → 187.5
    expect(ENEMY_KINDS["shifter-cinder-marshal"]?.speed).toBeCloseTo(158.4, 10); // 132 → 158.4

    const critterMelee = enemyComboShared.effectiveMelee(ENEMY_KINDS.critter);
    if (!critterMelee) throw new Error("critter must retain its derived melee definition");
    expect(critterMelee.range).toBeCloseTo(62.4, 10); // (18 + 30) × 1.30
    expect(critterMelee.halfArc).toBeCloseTo(1.235, 10); // 0.95 × 1.30
    expect(ENEMY_KINDS.ronin?.melee?.range).toBeCloseTo(179.4, 10);
    expect(ENEMY_KINDS.ronin?.melee?.halfArc).toBeCloseTo(1.17, 10);
    expect(ENEMY_KINDS["vault-ronin"]?.melee?.range).toBeCloseTo(182, 10);
    expect(ENEMY_KINDS["vault-ronin"]?.melee?.halfArc).toBeCloseTo(1.235, 10);
    expect(ENEMY_KINDS["frozen-knight"]?.melee?.range).toBeCloseTo(187.2, 10);
    expect(ENEMY_KINDS["frozen-knight"]?.melee?.halfArc).toBeCloseTo(1.196, 10);

    const sanren = enemyComboShared.TOUGH_COMBOS["k1-sanren"];
    if (!sanren) throw new Error("K1 Sanren tuning fixture is required");
    expect(sanren.frontOffset).toBe(143); // 110 → 143; preserves negotiated 0.8× opener geometry
    expect(sanren.steps[0]?.range).toBeCloseTo(179.4, 10);
    expect(sanren.steps[0]?.halfArc).toBeCloseTo(1.17, 10);
    expect(sanren.steps.map((step) => step.windupTicks)).toEqual([8, 6, 15]);
    expect(enemyComboShared.TOUGH_COMBOS["h1-sweep-overhead"]?.steps[0]?.halfArc).toBeCloseTo(
      2.951,
      10,
    ); // 2.27 → 2.951
  });

  function addStackedEnemy(
    h: ReturnType<typeof makeRoom>,
    id: string,
    x: number,
    y: number,
  ): EnemyState {
    const enemy = new EnemyState();
    enemy.id = id;
    enemy.kind = "critter";
    enemy.hp = 100;
    enemy.x = x;
    enemy.y = y;
    h.state().enemies.set(id, enemy);
    return enemy;
  }

  it("de-overlaps two exactly stacked living enemies within eight 20Hz separation ticks", () => {
    const h = makeRoom();
    const a = addStackedEnemy(h, "separate-a", 2000, 1800);
    const b = addStackedEnemy(h, "separate-b", 2000, 1800);
    for (let tick = 0; tick < 8; tick++) {
      h.room.rebuildEnemyGrid();
      h.room.resolveEnemyCollisions();
    }
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(35.5);
  });

  it("settles a crowd of 20 coincident enemies to a non-overlap equilibrium without full scans", () => {
    const h = makeRoom();
    const crowd: EnemyState[] = [];
    for (let i = 0; i < 20; i++) crowd.push(addStackedEnemy(h, `crowd-${i}`, 2400, 1800));
    for (let tick = 0; tick < 80; tick++) {
      h.room.rebuildEnemyGrid();
      h.room.resolveEnemyCollisions();
    }
    let minimumGap = Number.POSITIVE_INFINITY;
    for (let i = 0; i < crowd.length; i++) {
      for (let j = i + 1; j < crowd.length; j++) {
        const a = crowd[i];
        const b = crowd[j];
        if (!a || !b) throw new Error("crowd fixture index escaped its fixed bounds");
        minimumGap = Math.min(minimumGap, Math.hypot(a.x - b.x, a.y - b.y));
      }
    }
    expect(minimumGap).toBeGreaterThanOrEqual(35.5);
  });

  it("never displaces a player while separating enemies from the same occupied point", () => {
    const h = makeRoom();
    h.join("separation-player");
    const player = h.state().players.get("separation-player");
    const before = { x: player.x, y: player.y };
    addStackedEnemy(h, "player-stack-a", player.x, player.y);
    addStackedEnemy(h, "player-stack-b", player.x, player.y);
    h.room.rebuildEnemyGrid();
    h.room.resolveEnemyCollisions();
    expect({ x: player.x, y: player.y }).toEqual(before);
  });
});

function joinGearAccount(
  h: ReturnType<typeof makeRoom>,
  id: string,
  configure: (account: ReturnType<typeof enemyComboShared.createMetaAccountV3>) => void,
) {
  const account = enemyComboShared.createMetaAccountV3();
  configure(account);
  const client = { sessionId: id };
  h.room.clients.push(client);
  h.room.onJoin(client, { metaAccount: account });
  return {
    player: h.state().players.get(id),
    combat: h.room.combat.get(id),
    gear: h.room.gearRuns.get(id),
    account: h.room.metaAccounts.get(id),
  };
}

function equipGearSet(
  account: ReturnType<typeof enemyComboShared.createMetaAccountV3>,
  setId: string,
) {
  for (const slot of enemyComboShared.GEAR_SLOTS) {
    const suffix = slot === "facialHair" ? "facial-hair" : slot === "torso" ? "shirt" : slot;
    const id = `${setId}-${suffix}`;
    if (!enemyComboShared.isGearId(id)) throw new Error(`missing gear fixture ${id}`);
    account.ownedGear.push(id);
    account.equippedGear[slot] = id;
  }
}

describe("gear G2 join authority and frozen runtime", () => {
  it("gives validated v3 gear precedence while leaving legacy character kits as the no-loadout fallback", () => {
    const h = makeRoom();
    const geared = joinGearAccount(h, "gear-neon", (account) =>
      equipGearSet(account, "neon-mirage"),
    );
    expect(enemyComboShared.ATTRS.map((attr) => geared.player[attr])).toEqual([1, 4, 1, 2, 2]);
    expect(geared.player.gearSeeded).toBe(true);
    expect(geared.combat.quirk.id).toBe("package-deal");
    expect(geared.combat.mods.drawLockMult).toBe(0);
    expect(geared.player.runCharacter).toBe("drifter");
    expect([geared.player.upVitality, geared.player.upFortune, geared.player.upPower]).toEqual([
      0, 0, 0,
    ]);
    expect(
      enemyComboShared.decodeGearCosmetics(geared.player.gearUpper, geared.player.gearLower),
    ).toEqual(geared.account.equippedGear);
    expect(enemyComboShared.ATTRS.map((attr) => geared.player.allocRun[attr])).toEqual([
      0, 0, 0, 0, 0,
    ]);

    h.state().mode = "training";
    h.send("gear-neon", "cycleCharacter");
    expect(enemyComboShared.ATTRS.map((attr) => geared.player[attr])).toEqual([1, 4, 1, 2, 2]);
    expect(geared.combat.quirk.id).toBe("package-deal");

    const fallback = makeRoom();
    fallback.join("legacy-character");
    const legacyPlayer = fallback.state().players.get("legacy-character");
    expect(legacyPlayer.gearSeeded).toBe(false);
    expect(fallback.room.gearRuns.has("legacy-character")).toBe(false);
    expect(fallback.room.combat.get("legacy-character").quirk.id).toBe("unwritten");
    expect([legacyPlayer.gearUpper, legacyPlayer.gearLower]).toEqual(["", ""]);
  });

  it("runs a hat's legacy descriptor through the same authoritative parry interpreter", () => {
    const gearRoom = makeRoom();
    const geared = joinGearAccount(gearRoom, "gear-asha", (account) => {
      account.ownedGear.push("ash-walker-hat");
      account.equippedGear.hat = "ash-walker-hat";
    });
    gearRoom.join("gear-ally");
    const gearAlly = gearRoom.state().players.get("gear-ally");
    geared.player.x = gearAlly.x = 500;
    geared.player.y = gearAlly.y = 500;
    gearAlly.hp = 40;
    gearRoom.room.applyParryQuirk(geared.player, geared.combat, 7);
    const gearHeal = gearAlly.hp - 40;

    const legacyRoom = makeRoom();
    legacyRoom.join("legacy-asha");
    legacyRoom.join("legacy-ally");
    const legacyPlayer = legacyRoom.state().players.get("legacy-asha");
    const legacyCombat = legacyRoom.room.combat.get("legacy-asha");
    const legacyAlly = legacyRoom.state().players.get("legacy-ally");
    legacyPlayer.character = "cc-asha-the-ash-walker";
    legacyRoom.room.snapshotRunCharacter(legacyPlayer, legacyCombat, true);
    legacyPlayer.x = legacyAlly.x = 500;
    legacyPlayer.y = legacyAlly.y = 500;
    legacyAlly.hp = 40;
    legacyRoom.room.applyParryQuirk(legacyPlayer, legacyCombat, 7);
    expect([gearHeal, legacyAlly.hp - 40]).toEqual([7, 7]);
  });

  it("applies migrated starter-line gear once and leaves upgrade tombstones out of run power", () => {
    const old = enemyComboShared.createMetaAccountV2();
    old.upgrades = { vitality: 3, fortune: 2, power: 1 };
    const migrated = enemyComboShared.sanitizeMetaAccountV3(old);
    const h = makeRoom();
    const client = { sessionId: "gear-upgrade-migration" };
    h.room.clients.push(client);
    h.room.onJoin(client, { metaAccount: migrated });
    const player = h.state().players.get(client.sessionId);
    expect([player.str, player.dex, player.int, player.con, player.luk]).toEqual([3, 2, 2, 2, 4]);
    expect(player.maxHp).toBe(PLAYER_MAX_HP + 60);
    expect(player.hp).toBe(player.maxHp);
    expect([player.upVitality, player.upFortune, player.upPower]).toEqual([0, 0, 0]);
    expect(enemyComboShared.ATTRS.map((attr) => player.allocRun[attr])).toEqual([0, 0, 0, 0, 0]);
  });
});

// METAGAME WAVE 2 — append-only server escrow/materialization/outcome coverage.
const roomBankId = (n: number) => `wi_${n.toString(36).padStart(22, "0")}`;
const roomPairId = (n: number) => `wp_${n.toString(36).padStart(22, "0")}`;
const roomBankInstance = (
  n: number,
  weaponId: string,
  rarity: import("@dd/shared").WeaponRarityId = "common",
  affix: import("@dd/shared").WeaponAffixId = "",
): import("@dd/shared").WeaponInstanceV1 => ({
  instanceId: roomBankId(n),
  weaponId,
  rarity,
  affix,
  provenance: "enemy-drop",
  sourceWorldTier: 0,
});
const roomBankSingle = (
  n: number,
  weaponId = "rusty-cleaver",
): import("@dd/shared").SingleWeaponEntryV1 => {
  const weapon = roomBankInstance(n, weaponId);
  return { kind: "single", entryId: weapon.instanceId, weapon };
};
function joinWeaponAccount(
  h: ReturnType<typeof makeRoom>,
  id: string,
  entries: import("@dd/shared").WeaponBankEntryV1[],
  placements: import("@dd/shared").CarryPlacementV1[],
  activeEntryId = "",
) {
  const messages: Array<{ type: string; payload: unknown }> = [];
  const client = {
    sessionId: id,
    send: (type: string, payload: unknown) => messages.push({ type, payload }),
  };
  const account = enemyComboShared.createMetaAccountV4();
  account.weaponBank.stash.push(...entries);
  h.room.clients.push(client);
  h.room.onJoin(client, {
    metaAccount: account,
    carry: {
      requestId: `carry-${id}`,
      expectedRevision: account.revision,
      placements,
      activeEntryId,
      requestedWorldTier: 0,
    },
  });
  return {
    client,
    messages,
    player: h.state().players.get(id),
    account: h.room.metaAccounts.get(id) as import("@dd/shared").MetaAccountV4,
  };
}

describe("GameRoom — weapon bank carry and exact pair projection", () => {
  it("materializes exact ids into Active/Pack, keeps one zero-value starter floor, and projects a pair once", () => {
    const h = makeRoom({ belt: true });
    const pair: import("@dd/shared").PairedWeaponEntryV1 = {
      kind: "pair",
      entryId: roomPairId(1),
      lead: roomBankInstance(1, "rattler-sabre", "legendary", "brutal"),
      offhand: roomBankInstance(2, "x2-sandsong-saber", "rare", "keen"),
    };
    const safe = roomBankSingle(3);
    const joined = joinWeaponAccount(
      h,
      "bank-pair-carry",
      [pair, safe],
      [{ entryId: pair.entryId, zone: "active", start: 1 }],
      pair.entryId,
    );
    expect(joined.player.slots[0]).toMatchObject({
      weapon: DEFAULT_WEAPON,
      homeIssue: true,
      earned: false,
      bankEntryId: "",
    });
    expect(
      joined.player.slots.slice(1, 3).map((slot: import("@dd/shared").ArsenalSlot) => ({
        weapon: slot.weapon,
        instanceId: slot.instanceId,
        entryId: slot.bankEntryId,
        role: slot.bankPairRole,
      })),
    ).toEqual([
      {
        weapon: pair.lead.weaponId,
        instanceId: pair.lead.instanceId,
        entryId: pair.entryId,
        role: "lead",
      },
      {
        weapon: pair.offhand.weaponId,
        instanceId: pair.offhand.instanceId,
        entryId: pair.entryId,
        role: "offhand",
      },
    ]);
    expect([joined.player.activeSlot, joined.player.offhandSlot]).toEqual([1, 2]);
    expect(joined.account.weaponBank.stash).toEqual([safe]);
    expect(joined.account.weaponBank.expedition?.entries).toHaveLength(1);
    expect(joined.messages.some((message) => message.type === "weaponManifest")).toBe(true);

    h.room.completeExtraction();
    expect(joined.account.weaponBank.expedition).toBeNull();
    expect(joined.account.weaponBank.stash).toEqual([safe, pair]);
  });

  it("mints a found instance only on accepted grab and settles carried+found through extraction", () => {
    const h = makeRoom({ belt: true });
    const joined = joinWeaponAccount(h, "bank-found", [], [], "");
    const pickup = new PickupState();
    pickup.id = "drop-bank-found";
    pickup.weapon = "rusty-cleaver";
    pickup.weaponPublic = "rusty-cleaver";
    pickup.rarity = 4;
    pickup.affix = "brutal";
    pickup.affixPublic = "brutal";
    pickup.x = joined.player.x;
    pickup.y = joined.player.y;
    h.state().pickups.set(pickup.id, pickup);
    h.room.earnedPickups.add(pickup.id);
    h.room.pickupWeaponBankMeta.set(pickup.id, {
      provenance: "enemy-drop",
      ownerId: "",
      ownerLockUntil: 0,
    });
    expect(joined.account.weaponBank.expedition?.entries).toHaveLength(0);

    h.send(joined.player.id, "grabWeapon");
    const found = joined.account.weaponBank.expedition?.entries[0];
    expect(found).toMatchObject({ stakeOrigin: "found", location: "active" });
    expect(found?.entry.kind).toBe("single");
    if (found?.entry.kind !== "single") return;
    expect(found.entry.weapon).toMatchObject({
      weaponId: "rusty-cleaver",
      rarity: "legendary",
      affix: "brutal",
      provenance: "enemy-drop",
      sourceWorldTier: 0,
    });
    expect(enemyComboShared.WEAPON_INSTANCE_ID_RE.test(found.entry.weapon.instanceId)).toBe(true);
    expect(joined.player.slots[joined.player.activeSlot].instanceId).toBe(
      found.entry.weapon.instanceId,
    );

    h.room.completeExtraction();
    expect(joined.account.weaponBank.stash).toEqual([found.entry]);
  });
});

describe("GameRoom — at-stake ledger across down/rez, wipe, disconnect, and shop settlement", () => {
  it("down and revive preserve exact escrow; a downed owner still banks with squad extraction", () => {
    const h = makeRoom({ belt: true });
    const carried = roomBankSingle(10);
    const owner = joinWeaponAccount(
      h,
      "bank-downed-owner",
      [carried],
      [{ entryId: carried.entryId, zone: "active", start: 1 }],
      carried.entryId,
    );
    const ally = joinWeaponAccount(h, "bank-downed-ally", [], [], "");
    const exactExpedition = owner.account.weaponBank.expedition;
    owner.player.hp = 0;
    h.tick();
    expect(owner.player.alive).toBe(false);
    expect(owner.account.weaponBank.expedition).toBe(exactExpedition);
    expect(owner.player.slots[1].instanceId).toBe(carried.weapon.instanceId);
    h.room.tryRez(ally.player, 10000);
    expect(owner.player.alive).toBe(true);
    expect(owner.account.weaponBank.expedition).toBe(exactExpedition);

    owner.player.alive = false;
    h.room.completeExtraction();
    expect(owner.account.weaponBank.stash).toEqual([carried]);
  });

  it("a terminal wipe deletes the whole active/pack/found stake and never touches safe Stash", () => {
    const h = makeRoom({ belt: true });
    const doomed = roomBankSingle(20);
    const safe = roomBankSingle(21);
    const joined = joinWeaponAccount(
      h,
      "bank-wipe",
      [doomed, safe],
      [{ entryId: doomed.entryId, zone: "active", start: 1 }],
      doomed.entryId,
    );
    const found = roomBankSingle(22);
    const row = {
      entry: found,
      stakeOrigin: "found" as const,
      location: "field" as const,
      start: 255,
    };
    joined.account.weaponBank.expedition?.entries.push(row);
    h.room.weaponRuns.get(joined.player.id).entries.set(found.entryId, row);
    joined.player.hp = 0;
    h.tick();
    expect(h.state().outcome).toBe("defeat");
    expect(joined.account.weaponBank.expedition).toBeNull();
    expect(joined.account.weaponBank.stash).toEqual([safe]);
    expect(joined.account.weaponBank.lastCarry.activeEntryId).toBe(doomed.entryId);
  });

  it("transport leave neither saves nor loses escrow; rejoin restores debt and the later result decides", () => {
    const h = makeRoom({ belt: true });
    const carried = roomBankSingle(30);
    const joined = joinWeaponAccount(
      h,
      "bank-disconnect",
      [carried],
      [{ entryId: carried.entryId, zone: "active", start: 1 }],
      carried.entryId,
    );
    const samePlayer = joined.player;
    samePlayer.slots[1].cooldown = 0.73;
    samePlayer.slots[1].resourceReady = true;
    h.room.clients = h.room.clients.filter(
      (client: { sessionId: string }) => client.sessionId !== joined.player.id,
    );
    h.room.onLeave(joined.client);
    expect(joined.account.weaponBank.expedition?.entries[0]?.entry).toEqual(carried);
    expect(joined.account.weaponBank.stash).toEqual([]);

    h.room.clients.push(joined.client);
    h.room.onJoin(joined.client, {});
    expect(h.state().players.get(joined.player.id)).toBe(samePlayer);
    expect(samePlayer.slots[1].cooldown).toBe(0.73);
    expect(joined.account.weaponBank.expedition?.entries).toHaveLength(1);

    h.room.clients = h.room.clients.filter(
      (client: { sessionId: string }) => client.sessionId !== joined.player.id,
    );
    h.room.onLeave(joined.client);
    h.room.enterTerminalOutcome("victory");
    expect(joined.account.weaponBank.expedition).toBeNull();
    expect(joined.account.weaponBank.stash).toEqual([carried]);
  });

  it("home sale consumes one exact id once and a replay returns the receipt without printing Scrip", () => {
    const h = makeRoom({ belt: true });
    const sold = roomBankSingle(40);
    const joined = joinWeaponAccount(
      h,
      "bank-home-sale",
      [sold],
      [{ entryId: sold.entryId, zone: "active", start: 1 }],
      sold.entryId,
    );
    h.room.completeExtraction();
    const revision = joined.account.revision;
    h.send(joined.player.id, "sellStashEntry", {
      requestId: "sale-once",
      expectedRevision: revision,
      entryId: sold.entryId,
      from: "stash",
    });
    expect(joined.account.scrip).toBe(4);
    expect(joined.account.weaponBank.stash).toEqual([]);
    h.send(joined.player.id, "sellStashEntry", {
      requestId: "sale-once",
      expectedRevision: revision,
      entryId: sold.entryId,
      from: "stash",
    });
    expect(joined.account.scrip).toBe(4);
    expect(joined.messages.filter((message) => message.type === "stashSaleReceipt")).toHaveLength(
      2,
    );
  });
});

describe("GameRoom - weapon-bank explicit abandon boundary", () => {
  it("forfeits the workshop initiator's stake without letting a host destroy an ally's manifest", () => {
    const solo = makeRoom({ belt: true });
    const doomed = roomBankSingle(50);
    const safe = roomBankSingle(51);
    const joined = joinWeaponAccount(
      solo,
      "bank-workshop-solo",
      [doomed, safe],
      [{ entryId: doomed.entryId, zone: "active", start: 1 }],
      doomed.entryId,
    );
    solo.send(joined.player.id, "toggleTraining");
    expect(solo.state().mode).toBe("training");
    expect(joined.account.weaponBank.stash).toEqual([safe]);
    expect(joined.account.weaponBank.expedition?.entries).toEqual([]);
    expect(
      joined.player.slots.some(
        (slot: import("@dd/shared").ArsenalSlot) =>
          slot.weapon === DEFAULT_WEAPON && slot.homeIssue,
      ),
    ).toBe(true);

    const coop = makeRoom({ belt: true });
    const hostStake = roomBankSingle(52);
    const host = joinWeaponAccount(
      coop,
      "bank-workshop-host",
      [hostStake],
      [{ entryId: hostStake.entryId, zone: "active", start: 1 }],
      hostStake.entryId,
    );
    const allyStake = roomBankSingle(53);
    const ally = joinWeaponAccount(
      coop,
      "bank-workshop-ally",
      [allyStake],
      [{ entryId: allyStake.entryId, zone: "active", start: 1 }],
      allyStake.entryId,
    );
    const allyReservation = ally.account.weaponBank.expedition;
    coop.send(host.player.id, "toggleTraining");
    expect(coop.state().mode).toBe("training");
    expect(host.account.weaponBank.expedition?.entries).toEqual([]);
    expect(host.account.weaponBank.stash).toEqual([]);
    expect(ally.account.weaponBank.expedition).toBe(allyReservation);
    expect(ally.account.weaponBank.expedition?.entries[0]?.entry).toEqual(allyStake);
  });
});

// METAGAME WAVE 3 — append-only Drive authority, economy, and equivalence coverage.
describe("GameRoom — schema-31 Drive authority", () => {
  it("ships the nested quantized mirror while affordability remains on the private float", () => {
    const h = makeRoom();
    h.join("drive-float");
    const player = h.state().players.get("drive-float");
    const combat = h.room.combat.get(player.id);
    const weapon = WEAPONS["x-gun-revolver-cannon"]!;
    const profile = enemyComboShared.weaponResourceProfile(weapon.id)!;
    const interval = enemyComboShared.effectiveAcceptedWeaponInterval(
      weapon,
      enemyComboShared.weaponAttackCooldown(weapon),
    );
    const cost = enemyComboShared.driveCostForProfile(profile, interval);

    expect(enemyComboShared.SCHEMA_VERSION).toBe(33);
    expect(h.state().schemaVersion).toBe(33);
    expect(player.weaponResource).toBe(player.dualWield.weaponResource);
    expect(player.weaponResource).toMatchObject({
      valueQ: 10_000,
      regenMode: 1,
      beamLockEndTick: 0,
    });

    combat.drive.valueF = cost - 0.001;
    player.weaponResource.valueQ = Math.floor(cost * 100); // deliberately optimistic mirror
    expect(
      h.room.trySpendWeaponResource(
        player,
        combat,
        weapon,
        weapon.id,
        enemyComboShared.CombatDelivery.Gun,
        0,
        interval,
        1,
        0,
        "tap",
      ).accepted,
    ).toBe(false);

    combat.drive.valueF = cost;
    expect(
      h.room.trySpendWeaponResource(
        player,
        combat,
        weapon,
        weapon.id,
        enemyComboShared.CombatDelivery.Gun,
        0,
        interval,
        1,
        0,
        "tap",
      ).accepted,
    ).toBe(true);
    expect(combat.drive.valueF).toBe(0);
    expect(player.weaponResource.valueQ).toBe(0);

    combat.drive.valueF = 42.259;
    h.room.commitWeaponResourceTick(player, combat);
    expect(player.weaponResource.valueQ).toBe(4225);
  });

  it("implements the anti-turtle modes, debt edge, 640px threat boundary, and pause law", () => {
    const h = makeRoom();
    h.join("drive-regen");
    const player = h.state().players.get("drive-regen");
    const combat = h.room.combat.get(player.id);
    const step = () => {
      h.room.beginWeaponResourceTick(player, combat, 0.05);
      h.room.commitWeaponResourceTick(player, combat);
    };

    combat.drive.valueF = 0;
    combat.drive.recoveryDebtF = 0;
    step();
    expect([combat.drive.valueF, combat.drive.regenMode]).toEqual([
      1,
      enemyComboShared.DriveRegenMode.Floor,
    ]);

    const threat = new EnemyState();
    threat.id = "drive-threat";
    threat.kind = "critter";
    threat.hp = 999;
    threat.x = player.x + enemyComboShared.DRIVE_THREAT_RADIUS;
    threat.y = player.y;
    h.state().enemies.set(threat.id, threat);
    h.room.enemyGrid.insert(threat.id, threat.x, threat.y);
    combat.drive.valueF = 0;
    step();
    expect([combat.drive.valueF, combat.drive.regenMode]).toEqual([
      1.75,
      enemyComboShared.DriveRegenMode.Engaged,
    ]);

    threat.x = player.x + enemyComboShared.DRIVE_THREAT_RADIUS + 0.01;
    h.room.enemyGrid.update(threat.id, threat.x, threat.y);
    combat.drive.valueF = 0;
    step();
    expect([combat.drive.valueF, combat.drive.regenMode]).toEqual([
      1,
      enemyComboShared.DriveRegenMode.Floor,
    ]);

    h.room.setWeaponResourceRegenOverride(player.id, "forceEngaged");
    combat.drive.valueF = 0;
    combat.drive.recoveryDebtF = 0.1;
    step();
    expect([combat.drive.valueF, combat.drive.regenMode]).toEqual([
      1,
      enemyComboShared.DriveRegenMode.Floor,
    ]);
    step(); // debt is sampled before aging: its final tick is still floor-only
    expect([combat.drive.valueF, combat.drive.regenMode]).toEqual([
      2,
      enemyComboShared.DriveRegenMode.Floor,
    ]);
    step();
    expect([combat.drive.valueF, combat.drive.regenMode]).toEqual([
      3.75,
      enemyComboShared.DriveRegenMode.Engaged,
    ]);

    combat.drive.engagedRecoveryMult = 99;
    combat.drive.valueF = 0;
    step();
    expect(combat.drive.valueF).toBeCloseTo(2.065, 8); // 35/s × the one +18% generic cap
    combat.drive.engagedRecoveryMult = 1;

    player.ultPhase = enemyComboShared.UltimatePhase.Active;
    combat.drive.valueF = 0;
    step();
    expect([combat.drive.valueF, combat.drive.regenMode]).toEqual([
      1,
      enemyComboShared.DriveRegenMode.Floor,
    ]);
    player.ultPhase = enemyComboShared.UltimatePhase.Idle;

    h.room.setWeaponResourceRegenOverride(player.id, "paused");
    combat.drive.valueF = 0;
    step();
    expect([combat.drive.valueF, combat.drive.regenMode]).toEqual([
      0,
      enemyComboShared.DriveRegenMode.Paused,
    ]);
  });

  it("sustains baseline fists for 60 seconds without leaking engaged bonus through debt", () => {
    const h = makeRoom();
    h.join("drive-melee-baseline");
    h.state().mode = "training";
    const player = h.state().players.get("drive-melee-baseline");
    const combat = h.room.combat.get(player.id);
    player.weapon = FISTS_WEAPON;
    h.tick(1);
    combat.drive.valueF = 100;
    combat.drive.recoveryDebtF = 0;
    player.weaponResource.valueQ = 10_000;
    h.room.setWeaponResourceRegenOverride(player.id, "forceEngaged");

    const postAttackValues: number[] = [];
    let lastSeq = player.attackSeq;
    for (let tick = 0; tick < 1_200; tick++) {
      h.send(player.id, "attack", { aimX: 1, aimY: 0 });
      h.tick(1);
      if (player.attackSeq !== lastSeq) {
        postAttackValues.push(combat.drive.valueF);
        lastSeq = player.attackSeq;
      }
    }

    expect(postAttackValues.length).toBeGreaterThan(160);
    // The first accepted tick legitimately receives the already-cleared engaged credit. Once its debit
    // stamps recovery debt, every later accepted baseline beat is flat on the guaranteed floor.
    const plateau = postAttackValues[1]!;
    for (const value of postAttackValues.slice(2)) {
      expect(Math.abs(value - plateau)).toBeLessThanOrEqual(enemyComboShared.DRIVE_COST_QUANTUM);
    }
    expect(combat.drive.regenMode).toBe(enemyComboShared.DriveRegenMode.Floor);
    expect(combat.drive.recoveryDebtF).toBeGreaterThan(0);
  });

  it("routes every solo tap delivery through the one spend seam before its attack beat", () => {
    const cases = [
      [FISTS_WEAPON, enemyComboShared.CombatDelivery.Melee],
      ["twin-bowie-fangs", enemyComboShared.CombatDelivery.Melee],
      ["rusty-cleaver", enemyComboShared.CombatDelivery.Thrown],
      ["x-gun-revolver-cannon", enemyComboShared.CombatDelivery.Gun],
      ["x-staff-arcane-lance", enemyComboShared.CombatDelivery.Cast],
    ] as const;

    for (const [weaponId, delivery] of cases) {
      const h = makeRoom();
      h.join(`drive-seam-${weaponId}`);
      h.state().mode = "training";
      const player = h.state().players.values().next().value;
      player.weapon = weaponId;
      h.tick(1);
      const spend = vi.spyOn(h.room, "trySpendWeaponResource");
      h.send(player.id, "attack", { aimX: 1, aimY: 0 });
      h.tick(1);

      expect(player.attackSeq).toBe(1);
      expect(spend).toHaveBeenCalledTimes(1);
      expect(spend.mock.calls[0]?.[4]).toBe(delivery);
      expect(spend.mock.calls[0]?.[9]).toBe("tap");
      spend.mockRestore();
    }
  });

  it("keeps Drive and global debt outside the carousel identity ledger", () => {
    const h = makeRoom();
    h.join("drive-carousel");
    const player = h.state().players.get("drive-carousel");
    const combat = h.room.combat.get(player.id);
    player.weapon = "x-sword-bone";
    h.tick(1);
    h.send(player.id, "attack", { aimX: 1, aimY: 0 });
    h.tick(1);
    const value = combat.drive.valueF;
    const debt = combat.drive.recoveryDebtF;
    const firstWeapon = player.weapon;

    for (let i = 0; i < ACTION_MSGS_PER_TICK; i++) {
      h.send(player.id, "cycleWeapon", { dir: i % 2 === 0 ? 1 : -1 });
    }
    expect(player.weapon).toBe(firstWeapon);
    expect(combat.drive.valueF).toBe(value);
    expect(combat.drive.recoveryDebtF).toBe(debt);

    h.tick(1);
    expect(combat.drive.valueF).toBeCloseTo(value + 1, 8);
    expect(combat.drive.recoveryDebtF).toBeCloseTo(debt - 0.05, 8);
  });
});

// METAGAME WAVE 6 — append-only public prestige, clear eligibility, and receipt coverage.
describe("GameRoom — schema-31 public prestige ceremony", () => {
  it("publishes join prestige, requires and consumes one game-clear receipt, then refreshes the wire row", () => {
    const h = makeRoom();
    const messages: Array<{ type: string; payload: unknown }> = [];
    const client = {
      sessionId: "prestige-public",
      send: (type: string, payload: unknown) => messages.push({ type, payload }),
    };
    const supplied = enemyComboShared.createMetaAccountV4();
    supplied.prestige = 4;
    supplied.scrip = 777;
    supplied.weaponBank.stash.push(roomBankSingle(88, "rattler-sabre"));
    h.room.clients.push(client);
    h.room.onJoin(client, { metaAccount: supplied });
    const player = h.state().players.get(client.sessionId);
    const account = h.room.metaAccounts.get(client.sessionId) as import("@dd/shared").MetaAccountV4;
    expect([player.prestige, player.dualWield.prestige]).toEqual([4, 4]);

    h.send(client.sessionId, "prestigeReset", {
      requestId: "before-clear",
      expectedRevision: account.revision,
    });
    expect(account.prestige).toBe(4);
    expect(messages.some((message) => message.type === "prestigeReceipt")).toBe(false);

    h.room.enterTerminalOutcome("victory");
    messages.length = 0;
    h.tick(1);
    h.send(client.sessionId, "prestigeReset", {
      requestId: "earned-clear",
      expectedRevision: account.revision,
    });
    expect(account).toMatchObject({ prestige: 5, scrip: 777 });
    expect(account.weaponBank.stash).toEqual([]);
    expect([player.prestige, player.dualWield.prestige]).toEqual([5, 5]);
    expect(messages.find((message) => message.type === "prestigeReceipt")?.payload).toMatchObject({
      ok: true,
      prestige: 5,
      removedEntries: 1,
      removedPhysical: 1,
      scripPaid: 0,
      revision: account.revision,
    });
    expect(messages.at(-1)).toMatchObject({ type: "metaAccount", payload: account });

    messages.length = 0;
    h.tick(1);
    h.send(client.sessionId, "prestigeReset", {
      requestId: "same-clear-again",
      expectedRevision: account.revision,
    });
    expect(account.prestige).toBe(5);
    expect(messages.some((message) => message.type === "prestigeReceipt")).toBe(false);
  });

  it("appends one uint8 public count to the existing nested cosmetic and Drive tail row", () => {
    const tailSymbols = Object.getOwnPropertySymbols(enemyComboShared.DualWieldState);
    const metadata = (
      enemyComboShared.DualWieldState as unknown as Record<
        symbol,
        Record<number, { name: string; type: string }>
      >
    )[tailSymbols[0]!];
    if (!metadata) throw new Error("DualWieldState schema metadata is required");
    expect(metadata[7]).toMatchObject({ name: "prestige", type: "uint8" });
    expect(enemyComboShared.SCHEMA_VERSION).toBe(33);
  });
});

describe("GameRoom — Drive beam equivalence and seam", () => {
  it("spends 25 ignition plus exactly 25 net-three active ticks even under engaged recovery", () => {
    const { h, player, combat } = makeBeamRoom("drive-beam-equivalence");
    h.room.setWeaponResourceRegenOverride(player.id, "forceEngaged");
    const spend = vi.spyOn(h.room, "trySpendWeaponResource");
    const chargeTicks = Math.round(BEAM_CHARGE_SECONDS / 0.05);
    for (let seq = 1; seq <= chargeTicks; seq++) sendBeamFrame(h, player.id, seq, true);

    expect(combat.beamPhase).toBe(2);
    expect(combat.drive.valueF).toBeCloseTo(72, 8);
    expect(player.weaponResource.valueQ).toBe(7200);
    for (let i = 1; i < 24; i++) {
      sendBeamFrame(h, player.id, chargeTicks + i, true);
    }
    expect(combat.beamPhase).toBe(2);
    expect(combat.drive.valueF).toBeCloseTo(3, 8);
    expect(player.weaponResource.valueQ).toBe(300);
    sendBeamFrame(h, player.id, chargeTicks + 24, true);
    expect(combat.beamPhase).toBe(0);
    expect(combat.drive.valueF).toBe(0);

    const reasons = spend.mock.calls.map((call) => call[9]);
    expect(reasons.filter((reason) => reason === "beam-ignite")).toHaveLength(1);
    expect(reasons.filter((reason) => reason === "beam-active")).toHaveLength(25);
    expect(combat.drive.recoveryDebtF).toBeCloseTo(3.4, 8);
    spend.mockRestore();
  });

  it("bills pre-ignition cancel once and never invents an empty lock", () => {
    const { h, player, combat } = makeBeamRoom("drive-beam-cancel");
    const spend = vi.spyOn(h.room, "trySpendWeaponResource");
    sendBeamFrame(h, player.id, 1, true);
    sendBeamFrame(h, player.id, 2, false);

    expect(combat.beamPhase).toBe(0);
    expect(combat.drive.valueF).toBeCloseTo(81, 8); // first full-bar credit caps; release tick adds one
    expect(combat.drive.beamLockEndTick).toBe(0);
    expect(spend.mock.calls.map((call) => call[9])).toEqual(["beam-cancel"]);
    spend.mockRestore();
  });

  it("maps Pressurized's approved vent and half-lock to its old 45-tick restart row", () => {
    const { h, player, combat } = makeBeamRoom("drive-beam-pressurized");
    combat.mods = {
      ...combat.mods,
      beamVentMult: 1.25,
      beamOverheatLockMult: 0.5,
    };
    const chargeTicks = Math.round(BEAM_CHARGE_SECONDS / 0.05);
    for (let seq = 1; seq < chargeTicks; seq++) sendBeamFrame(h, player.id, seq, true);
    for (let i = 0; i < 25; i++) sendBeamFrame(h, player.id, chargeTicks + i, true);

    expect(combat.drive.valueF).toBe(0);
    expect(combat.drive.beamLockEndTick - h.state().tick).toBe(15);
    let seq = chargeTicks + 25;
    let recoveryTicks = 0;
    while (combat.drive.valueF + 1e-9 < BEAM_RESTART_DRIVE) {
      sendBeamFrame(h, player.id, seq++, false);
      recoveryTicks++;
    }
    expect(recoveryTicks).toBe(45); // old: 15 lock + ceil(0.65 / (0.35 × 1.25) × 20) = 30
    sendBeamFrame(h, player.id, seq, true);
    expect(combat.beamPhase).toBe(1);
  });

  it("makes beam empty global: baseline fists can resume but cannot rebuild the 68-point reactor", () => {
    const { h, player, combat } = makeBeamRoom("drive-beam-global-empty");
    const chargeTicks = Math.round(BEAM_CHARGE_SECONDS / 0.05);
    for (let seq = 1; seq < chargeTicks; seq++) sendBeamFrame(h, player.id, seq, true);
    for (let i = 0; i < 25; i++) sendBeamFrame(h, player.id, chargeTicks + i, true);
    expect(combat.drive.valueF).toBe(0);

    sendBeamFrame(h, player.id, chargeTicks + 25, false); // required release edge
    player.weapon = FISTS_WEAPON;
    h.tick(1);
    const beforeFists = player.attackSeq;
    for (let tick = 0; tick < 100; tick++) {
      h.send(player.id, "attack", { aimX: 1, aimY: 0 });
      h.tick(1);
    }

    expect(player.attackSeq).toBeGreaterThan(beforeFists);
    expect(combat.drive.valueF).toBeLessThan(7);
    expect(combat.drive.valueF).toBeLessThan(BEAM_RESTART_DRIVE);
  });
});

describe("GameRoom — bank §2.3 stale-expedition abandonment at join", () => {
  // The account blob lives in localStorage while settlement lives in room memory: kill the client
  // mid-run and the next join arrives with the old expedition still open. The law (bank-systems
  // §2.3, no reservation machinery) settles it as DEFEAT before the new carry — the stake is lost,
  // the bank un-bricks, and the fresh carry commits at the revision the client actually built
  // against (the abandonment settlement must not advance it).
  it("settles an open expedition as defeat, then commits the new carry at the client's revision", () => {
    const h = makeRoom({ belt: true });
    const doomed = roomBankSingle(41, "rattler-sabre");
    const kept = roomBankSingle(42);
    const messages: Array<{ type: string; payload: unknown }> = [];
    const client = {
      sessionId: "bank-stale-expedition",
      send: (type: string, payload: unknown) => messages.push({ type, payload }),
    };
    const account = enemyComboShared.createMetaAccountV4();
    account.weaponBank.stash.push(kept);
    account.weaponBank.expedition = {
      runId: "run_dead-room",
      commitRevision: account.revision,
      status: "committed",
      entries: [{ entry: doomed, stakeOrigin: "committed", location: "active", start: 0 }],
    };
    h.room.clients.push(client);
    h.room.onJoin(client, {
      metaAccount: account,
      carry: {
        requestId: "carry-after-abandon",
        expectedRevision: account.revision,
        placements: [{ entryId: kept.entryId, zone: "active", start: 0 }],
        activeEntryId: kept.entryId,
        requestedWorldTier: 0,
      },
    });
    const joined = h.room.metaAccounts.get(
      "bank-stale-expedition",
    ) as import("@dd/shared").MetaAccountV4;
    // The stale stake is gone forever — never banked, never carried forward.
    expect(joined.weaponBank.stash).toEqual([]);
    expect(joined.weaponBank.expedition?.entries.map((row) => row.entry.entryId)).toEqual([
      kept.entryId,
    ]);
    expect(joined.weaponBank.expedition?.runId).not.toBe("run_dead-room");
    // The player is in the room with the NEW carry materialized — the join was not rejected.
    expect(h.state().players.get("bank-stale-expedition")).toBeTruthy();
    // The honest ledger: the owner is told exactly what abandoning cost.
    const receipt = messages.find((m) => m.type === "expeditionAbandonReceipt");
    expect(receipt?.payload).toMatchObject({ ok: true, outcome: "defeat", lostEntries: 1 });
  });
});

// W4A — append-only archive migration and Testing-Grounds exclusion coverage.
describe("GameRoom — W4A archived weapon retirement", () => {
  it("auto-salvages archived instances across every bank location and repairs a mixed-pair carry", () => {
    const h = makeRoom({ belt: true });
    const archivedLead = roomBankInstance(
      91,
      "x2-mistral-kusarigama",
      "rare",
      "keen",
    );
    const survivingOffhand = roomBankInstance(92, "rattler-sabre", "rare", "swift");
    const mixedPair: import("@dd/shared").PairedWeaponEntryV1 = {
      kind: "pair",
      entryId: roomPairId(91),
      lead: archivedLead,
      offhand: survivingOffhand,
    };
    const intakeWeapon = roomBankInstance(
      93,
      "x2-ferrous-serpent",
      "legendary",
      "brutal",
    );
    const intake: import("@dd/shared").SingleWeaponEntryV1 = {
      kind: "single",
      entryId: intakeWeapon.instanceId,
      weapon: intakeWeapon,
    };
    const expeditionWeapon = roomBankInstance(94, "x2-locust-flail");
    const expeditionEntry: import("@dd/shared").SingleWeaponEntryV1 = {
      kind: "single",
      entryId: expeditionWeapon.instanceId,
      weapon: expeditionWeapon,
    };
    const account = enemyComboShared.createMetaAccountV4();
    account.scrip = 7;
    account.weaponBank.stash.push(mixedPair);
    account.weaponBank.intake.push(intake);
    account.weaponBank.lastCarry = {
      placements: [{ entryId: mixedPair.entryId, zone: "active", start: 0 }],
      activeEntryId: mixedPair.entryId,
    };
    account.weaponBank.expedition = {
      runId: "run_archive-old",
      commitRevision: account.revision,
      status: "committed",
      entries: [
        { entry: expeditionEntry, stakeOrigin: "found", location: "field", start: 255 },
      ],
    };
    const messages: Array<{ type: string; payload: unknown }> = [];
    const client = {
      sessionId: "archive-join",
      send: (type: string, payload: unknown) => messages.push({ type, payload }),
    };
    h.room.clients.push(client);
    h.room.onJoin(client, {
      metaAccount: account,
      carry: {
        requestId: "carry-after-archive",
        expectedRevision: account.revision,
        placements: [{ entryId: mixedPair.entryId, zone: "active", start: 0 }],
        activeEntryId: mixedPair.entryId,
        requestedWorldTier: 0,
      },
    });

    const joined = h.room.metaAccounts.get("archive-join") as import("@dd/shared").MetaAccountV4;
    const expectedPayout =
      scripValue(2, true) + scripValue(4, true) + scripValue(0, true);
    expect(joined.scrip).toBe(7 + expectedPayout);
    expect(joined.weaponBank.stash).toEqual([]);
    expect(joined.weaponBank.intake).toEqual([]);
    expect(joined.weaponBank.expedition?.entries).toHaveLength(1);
    expect(joined.weaponBank.expedition?.entries[0]?.entry).toEqual({
      kind: "single",
      entryId: survivingOffhand.instanceId,
      weapon: survivingOffhand,
    });
    expect(joined.weaponBank.lastCarry).toEqual({
      placements: [
        { entryId: survivingOffhand.instanceId, zone: "active", start: 0 },
      ],
      activeEntryId: survivingOffhand.instanceId,
    });
    expect(h.state().players.get("archive-join")?.weapon).toBe("rattler-sabre");
    expect(messages.find((message) => message.type === "weaponArchiveSalvageReceipt")?.payload)
      .toMatchObject({
        payout: expectedPayout,
        salvagedInstances: 3,
        affectedEntries: 3,
      });
  });

  it("omits archived ids from every Testing-Grounds page and rejects direct dev-equip", () => {
    const h = makeRoom();
    h.join("archive-gallery");
    h.send("archive-gallery", "toggleTraining");
    const roster = h.room.constructor.GALLERY_ROSTER as string[];
    expect(roster).toHaveLength(326);
    for (const id of enemyComboShared.ARCHIVED_WEAPON_IDS) expect(roster).not.toContain(id);
    const before = h.state().players.get("archive-gallery").weapon;
    h.send("archive-gallery", "devEquip", { weapon: "x2-mistral-kusarigama" });
    expect(h.state().players.get("archive-gallery").weapon).toBe(before);
  });
});

// HIT-REGISTRATION PANEL regressions - append-only authority coverage for the two field reports.
describe("GameRoom - hit registration regressions", () => {
  function addProjectileTarget(
    h: ReturnType<typeof makeRoom>,
    id: string,
    kind: string,
    x: number,
    y: number,
  ) {
    const enemy = new EnemyState();
    enemy.id = id;
    enemy.kind = kind;
    enemy.hp = 100_000;
    enemy.x = x;
    enemy.y = y;
    h.state().enemies.set(id, enemy);
    h.room.rebuildEnemyGrid();
    return enemy;
  }

  it("registers a belt melee edge-of-arc hit at the maximum rendered weapon reach", () => {
    const h = makeRoom({ belt: true });
    h.join("edge-melee");
    const player = h.state().players.get("edge-melee");
    const weapon = WEAPONS["x2-stormpetal-odachi"];
    if (!weapon) throw new Error("Stormpetal Odachi fixture is required");
    player.weapon = weapon.id;
    h.tick(1); // settle the weapon swap
    player.x = 1_000;
    player.y = BELT_Y0 + DEPTH_MAX / 2;

    // SpriteRig's two-hand orbit carries the grip 76 * 0.30 = 22.8 px from the root before extending the
    // business end. Put the target's near edges on the visual blade capsule at maximum reach and exactly on
    // the player's authored 90 px belt tolerance: both painted/collider edges clip and therefore must hit.
    const renderedGripReach = 76 * 0.3;
    const renderedTip = Math.max(
      weapon.range,
      (1 - weapon.gripFrac) * weapon.displayLength + renderedGripReach,
    );
    const target = new EnemyState();
    target.id = "edge-melee-target";
    target.kind = "dummy";
    target.hp = 100_000;
    const targetRadius = ENEMY_KINDS[target.kind]?.radius ?? 24;
    target.x = player.x + renderedTip + targetRadius + enemyComboShared.MELEE_BLADE_HALFWIDTH;
    target.y = player.y + enemyComboShared.DEPTH_TOL_PLAYER + targetRadius;
    h.state().enemies.set(target.id, target);
    h.room.rebuildEnemyGrid();

    h.send(player.id, "attack", { aimX: 1, aimY: 0, tx: target.x, ty: target.y });
    h.tick(16);

    expect(target.hp).toBeLessThan(100_000);
  });

  it("deals full point-blank gun damage when a long muzzle starts inside a colossus collider", () => {
    const h = makeRoom();
    h.join("point-blank-gun");
    h.room.map.pois.length = 0;
    h.room.map.tiles.fill(TILE_GROUND);
    const player = h.state().players.get("point-blank-gun");
    const weapon = WEAPONS["x2-sunbreaker-railgun"];
    if (!weapon?.gun) throw new Error("Sunbreaker Railgun fixture is required");
    player.weapon = weapon.id;
    h.tick(1);

    const bossX = 2_000;
    const bossY = 2_000;
    const boss = addProjectileTarget(
      h,
      "point-blank-colossus",
      "dimensional-colossus",
      bossX,
      bossY,
    );
    // Muzzle reach is 210 px. From x = boss - 40 it spawns at boss + 170: inside the colossus/projectile
    // overlap (170 + 10), then its 1,400 px/s first step exits to boss + 240.
    player.x = bossX - 40;
    player.y = bossY;
    const combat = h.room.combat.get(player.id);
    combat.aimX = 1;
    combat.aimY = 0;
    combat.targetX = bossX + 500;
    combat.targetY = bossY;
    h.room.fireGun(player, combat, weapon);
    const projectiles = [...h.state().projectiles.values()];
    if (!projectiles.length) throw new Error("point-blank gun did not create a projectile");
    const expectedDamage = projectiles.reduce((sum, projectile) => {
      const projectileMeta = h.room.projectileMeta.get(projectile.id);
      if (projectileMeta) projectileMeta.crit = 0;
      return sum + (projectileMeta?.damage ?? 0);
    }, 0);
    if (!(expectedDamage > 0)) throw new Error("point-blank projectile needs positive damage");

    h.room.stepProjectiles(0.05);

    expect(boss.hp).toBeCloseTo(100_000 - expectedDamage, 8);
  });

  it("counts a friendly projectile that spawns inside a collider as a tick-one hit", () => {
    const h = makeRoom();
    h.join("spawn-inside");
    h.room.map.pois.length = 0;
    h.room.map.tiles.fill(TILE_GROUND);
    const boss = addProjectileTarget(h, "inside-colossus", "dimensional-colossus", 2_000, 2_000);
    const radius = ENEMY_KINDS[boss.kind]?.radius ?? 24;
    const damage = 37;
    h.room.fireProjectile(
      { x: boss.x + radius, y: boss.y },
      { x: boss.x + radius + 1, y: boss.y },
      1_400,
      damage,
      false,
      "slug",
      1,
      2,
    );

    h.room.stepProjectiles(0.05);

    expect(boss.hp).toBe(100_000 - damage);
  });

  it("keeps a from-range projectile as a full-damage control", () => {
    const h = makeRoom();
    h.join("range-control");
    h.room.map.pois.length = 0;
    h.room.map.tiles.fill(TILE_GROUND);
    const boss = addProjectileTarget(h, "range-colossus", "dimensional-colossus", 2_000, 2_000);
    const damage = 37;
    h.room.fireProjectile(
      { x: boss.x - 500, y: boss.y },
      { x: boss.x, y: boss.y },
      1_000,
      damage,
      false,
      "slug",
      1,
      2,
    );
    // Leave two collider-width samples beyond the nominal ten-step center crossing so this control does
    // not hinge on the final floating-point integration landing on exactly x = 2,000 under a full run.
    for (let tick = 0; tick < 12 && boss.hp === 100_000; tick++) h.room.stepProjectiles(0.05);

    expect(boss.hp).toBe(100_000 - damage);
  });

  it("registers spawn-inside contact against a live multi-segment worm collider", () => {
    const { h, runtime, root } = makeSerrakethRoom();
    h.room.map.pois.length = 0;
    h.room.map.tiles.fill(TILE_GROUND);
    h.room.rebuildEnemyGrid();
    const slot = 0;
    const damage = 31;
    const radius = runtime.segmentRadius(slot);
    const hp = root.hp;
    h.room.fireProjectile(
      { x: runtime.x[slot] + radius, y: runtime.y[slot] },
      { x: runtime.x[slot] + radius + 1, y: runtime.y[slot] },
      1_400,
      damage,
      false,
      "slug",
      1,
      2,
    );

    h.room.stepProjectiles(0.05);

    // Segment armor may reduce the authored damage, but range may not turn the contact into zero damage.
    expect(root.hp).toBeLessThan(hp);
  });
});

// Owner-ledger W-POSE authority coverage: append-only channel and shared spout-origin contracts.
describe("GameRoom — authored weapon performances", () => {
  it("drains Storm-Sphere Drive per second and stops damage at empty until release", async () => {
    const { CombatDelivery } = await import("@dd/shared");
    const h = makeRoom();
    h.join("storm-aura");
    const player = h.state().players.get("storm-aura");
    const combat = h.room.combat.get("storm-aura");
    const weapon = WEAPONS["x2-fulgurite-storm-sphere"];
    if (!weapon?.performance?.aura) throw new Error("Storm-Sphere aura fixture is required");
    player.weapon = weapon.id;
    combat.lastWeapon = weapon.id;
    h.room.setWeaponResourceRegenOverride(player.id, "paused");
    combat.drive.valueF = 1;
    player.weaponResource.valueQ = 100;
    const input = h.room.inputs.get(player.id);
    input.held.fireHeld = true;
    input.lastFreshFireTick = h.state().tick;
    const detonate = vi.spyOn(h.room, "detonate");

    h.room.beginWeaponResourceTick(player, combat, 0.05);
    h.room.stepPlayerAura(player, player.id, combat, weapon, 0.05, true);
    h.room.commitWeaponResourceTick(player, combat);

    expect(player.weaponResource.valueQ).toBe(0);
    expect(combat.auraActive).toBe(false);
    expect(combat.auraRequireRelease).toBe(true);
    expect(player.attackHeld).toBe(false);
    expect(detonate).toHaveBeenCalledTimes(1);
    expect(detonate.mock.calls[0]?.[7]).toBe(CombatDelivery.Aura);

    h.room.beginWeaponResourceTick(player, combat, 0.05);
    h.room.stepPlayerAura(player, player.id, combat, weapon, 0.05, true);
    h.room.commitWeaponResourceTick(player, combat);
    expect(player.weaponResource.valueQ).toBe(0);
    expect(detonate).toHaveBeenCalledTimes(1);

    input.held.fireHeld = false;
    h.room.stepPlayerAura(player, player.id, combat, weapon, 0.05, true);
    expect(combat.auraRequireRelease).toBe(false);
  });

  it("spawns Hollowbarrel pellets at the shared spout and sweeps from the shooter", async () => {
    const h = makeRoom();
    h.join("scatter-spout");
    const player = h.state().players.get("scatter-spout");
    const combat = h.room.combat.get("scatter-spout");
    const weapon = WEAPONS["x2-hollowbarrel-spell-scattergun-staff"];
    if (!weapon?.scatter) throw new Error("Hollowbarrel scatter fixture is required");
    player.x = 1_500;
    player.y = 1_500;
    combat.targetX = player.x + 500;
    combat.targetY = player.y;
    combat.aimX = 1;
    combat.aimY = 0;
    const origin = weaponEffectEmitterPoint(weapon, player, 0);
    const random = vi.spyOn(Math, "random").mockReturnValue(0.5);

    h.room.fireScatter(player, combat, weapon);

    expect(h.state().projectiles.size).toBe(weapon.scatter.count);
    for (const projectile of h.state().projectiles.values()) {
      const meta = h.room.projectileMeta.get(projectile.id);
      expect(projectile.x).toBeCloseTo(origin.x, 8);
      expect(projectile.y).toBeCloseTo(origin.y, 8);
      expect(meta?.firstCollisionX).toBe(player.x);
      expect(meta?.firstCollisionY).toBe(player.y);
    }
    random.mockRestore();
  });
});

// Owner-ledger W-ZONE authority coverage. These append the growth, tick, Drive, and landing contracts.
describe("GameRoom — shared procedural weapon ground zones", () => {
  it("grows Gravewax over held time through the continuous Drive seam and never creates a beam", async () => {
    const { weaponResourceProfile, ZoneKind } = await import("@dd/shared");
    const h = makeRoom();
    h.join("grave-zone");
    h.room.map.pois.length = 0;
    h.room.map.tiles.fill(TILE_GROUND);
    const player = h.state().players.get("grave-zone");
    const combat = h.room.combat.get(player.id);
    const weapon = WEAPONS["x2-gravewax-seance-globe"];
    if (!weapon?.groundZone) throw new Error("Gravewax ground-zone fixture is required");
    player.weapon = weapon.id;
    combat.lastWeapon = weapon.id;
    combat.targetX = player.x + 120;
    combat.targetY = player.y;
    combat.aimX = 1;
    combat.aimY = 0;
    const input = h.room.inputs.get(player.id);
    input.held.fireHeld = true;
    input.lastFreshFireTick = h.state().tick;
    const driveBefore = player.weaponResource.valueQ;

    h.room.stepPlayerGroundZone(player, player.id, combat, weapon, 0.05, true);
    const zone = [...h.state().zones.values()].find((row) => row.ownerId === player.id);
    if (!zone) throw new Error("held Gravewax did not create a zone");
    const firstRadius = zone.radius;
    for (let i = 0; i < 5; i++) {
      input.lastFreshFireTick = h.state().tick;
      h.room.stepPlayerGroundZone(player, player.id, combat, weapon, 0.05, true);
    }

    expect(zone.kind).toBe(ZoneKind.Weapon);
    expect(zone.radius).toBeGreaterThan(firstRadius);
    expect(zone.radius).toBeLessThanOrEqual(weapon.groundZone.maxRadius);
    expect(player.weaponResource.valueQ).toBeLessThan(driveBefore);
    expect(weaponResourceProfile(weapon.id)?.branch).toBe("zone");
    expect(weapon.beam).toBeUndefined();
    expect(h.state().beams.size).toBe(0);
  });

  it("ticks poison damage and applies Frostquill's authored slow on the server", async () => {
    const { ZoneStyle } = await import("@dd/shared");
    const h = makeRoom();
    h.join("zone-ticks");
    h.room.map.pois.length = 0;
    h.room.map.tiles.fill(TILE_GROUND);
    const player = h.state().players.get("zone-ticks");
    const enemy = new EnemyState();
    enemy.id = "zone-target";
    enemy.kind = "critter";
    enemy.x = player.x + 80;
    enemy.y = player.y;
    enemy.hp = 1_000;
    h.state().enemies.set(enemy.id, enemy);
    h.room.rebuildEnemyGrid();
    const poison = WEAPONS["x2-snakeoil-tincture-scepter"];
    const frost = WEAPONS["x2-frostquill-compendium"];
    if (!poison?.groundZone || !frost?.groundZone)
      throw new Error("poison/frost ground-zone fixtures are required");

    const poisonZone = h.room.spawnWeaponGroundZoneAt(
      player,
      poison,
      enemy.x,
      enemy.y,
      poison.groundZone.damagePerSecond,
    );
    const frostZone = h.room.spawnWeaponGroundZoneAt(player, frost, enemy.x, enemy.y, 0);
    h.room.stepZones(0.05);
    h.room.stepZones(0.05);

    expect(poisonZone?.style).toBe(ZoneStyle.Poison);
    expect(frostZone?.style).toBe(ZoneStyle.Ice);
    expect(enemy.hp).toBeLessThan(1_000);
    expect(h.room.enemyGroundZoneSlow(enemy.id)).toBe(frost.groundZone.slowMultiplier);
    expect(h.room.enemyZoneSlow.get(enemy.id)?.untilTick).toBeGreaterThan(h.state().tick);
  });

  it("converts Carrion Effigy to an own-sprite arc grenade that blooms poison only on landing", async () => {
    const { thrownProjectileSpriteId, ZoneStyle } = await import("@dd/shared");
    const h = makeRoom();
    h.join("carrion-grenade");
    h.room.map.pois.length = 0;
    h.room.map.tiles.fill(TILE_GROUND);
    const player = h.state().players.get("carrion-grenade");
    const combat = h.room.combat.get(player.id);
    const weapon = WEAPONS["x2-carrion-effigy"];
    if (!weapon?.thrown || weapon.groundZone?.trigger !== "landing")
      throw new Error("Carrion landing-grenade fixture is required");
    player.weapon = weapon.id;
    combat.lastWeapon = weapon.id;
    combat.targetX = player.x + weapon.thrown.range;
    combat.targetY = player.y;
    combat.aimX = 1;
    combat.aimY = 0;

    h.room.throwWeapon(player, combat, weapon);
    const projectile = [...h.state().projectiles.values()][0];
    if (!projectile) throw new Error("Carrion did not launch its grenade");
    const meta = h.room.projectileMeta.get(projectile.id);
    expect(weapon.scatter).toBeUndefined();
    expect(projectile.kind).toBe(`thrown:${weapon.id}`);
    expect(thrownProjectileSpriteId(projectile.kind)).toBe(weapon.id);
    expect(projectile.bornTick).toBe(h.state().tick);
    expect(meta?.landingZoneDamage).toBeGreaterThan(0);
    expect(h.state().zones.size).toBe(0);

    for (let i = 0; i < 20 && h.state().projectiles.size > 0; i++) h.room.stepProjectiles(0.05);
    const landed = [...h.state().zones.values()].find((row) => row.weaponId === weapon.id);
    expect(h.state().projectiles.size).toBe(0);
    expect(landed?.style).toBe(ZoneStyle.Poison);
    expect(landed?.radius).toBe(weapon.groundZone.initialRadius);
  });
});

// W-CONVERT — append-only server proof for Cogwright's full-distance authoritative cursor warp.
describe("GameRoom — Cogwright Tesla-Rod warp", () => {
  it("lands at the server-validated cursor with no weapon-range cap and bursts on arrival", () => {
    const h = makeRoom();
    h.join("tesla-warp");
    h.room.map.pois.length = 0;
    h.room.map.tiles.fill(TILE_GROUND);
    const player = h.state().players.get("tesla-warp");
    const combat = h.room.combat.get(player.id);
    const weapon = WEAPONS["x2-cogwright-s-tesla-rod"];
    if (!weapon?.warp) throw new Error("Cogwright warp fixture is required");

    player.x = 320;
    player.y = 360;
    player.weapon = weapon.id;
    combat.lastWeapon = weapon.id;
    combat.cd = 0;
    const target = { x: 1_520, y: 960 };
    const expected = h.room.navValidDest(
      player,
      combat,
      target.x,
      target.y,
      Number.POSITIVE_INFINITY,
    );
    expect(Math.hypot(expected.x - player.x, expected.y - player.y)).toBeGreaterThan(weapon.range);

    const enemy = new EnemyState();
    enemy.id = "warp-arrival-dummy";
    enemy.kind = "dummy";
    enemy.hp = 1_000;
    enemy.x = expected.x;
    enemy.y = expected.y;
    h.state().enemies.set(enemy.id, enemy);
    h.room.enemyGrid.insert(enemy.id, enemy.x, enemy.y);
    const teleportSeq = player.teleportSeq;

    combat.targetX = target.x;
    combat.targetY = target.y;
    h.room.warpWeaponToCursor(player, combat, weapon);

    expect(player.x).toBeCloseTo(expected.x, 6);
    expect(player.y).toBeCloseTo(expected.y, 6);
    expect(player.teleportSeq).toBe(teleportSeq + 1);
    expect(enemy.hp).toBeLessThan(1_000);
    expect(h.room.meleeSwings.has(player.id)).toBe(false);
    expect(
      [...h.state().combatReceipts.values()].some(
        (receipt) =>
          receipt.weaponId === weapon.id &&
          receipt.delivery === enemyComboShared.CombatDelivery.Warp,
      ),
    ).toBe(true);
  });
});

// NB BUG SQUAD: append-only authoritative projectile attribution and cadence regressions.
describe("GameRoom - NB projectile contracts", () => {
  function projectileRoom(id: string, weaponId: string) {
    const h = makeRoom();
    h.join(id);
    h.state().mode = "training";
    h.room.map.pois.length = 0;
    h.room.map.tiles.fill(TILE_GROUND);
    h.state().enemies.clear();
    const player = h.state().players.get(id);
    player.x = 2_400;
    player.y = 2_400;
    player.weapon = weaponId;
    h.tick(1);
    return { h, player };
  }

  it("emits Galvanic's accepted trigger as four ordered, authoritatively attributed rounds", () => {
    const weaponId = "x2-galvanic-overcasters";
    const weapon = WEAPONS[weaponId];
    if (!weapon?.gun?.burst) throw new Error("Galvanic burst fixture is required");
    const { h, player } = projectileRoom("galvanic", weaponId);
    const firstProjectileSeq = h.room.projectileSeq;

    h.send(player.id, "attack", {
      aimX: 1,
      aimY: 0,
      tx: player.x + weapon.gun.range,
      ty: player.y,
    });
    h.tick(4);

    const rounds = [...h.state().projectiles.values()].filter(
      (row) => row.sourceWeaponId === weaponId,
    );
    expect(weapon.gun.burst).toEqual({ count: 4, intervalSeconds: 0.05 });
    expect(h.room.projectileSeq - firstProjectileSeq).toBe(4);
    expect(rounds).toHaveLength(4);
    const firstBornTick = rounds[0]?.bornTick;
    expect(firstBornTick).toBeDefined();
    expect(rounds.map((row) => row.bornTick)).toEqual([
      firstBornTick,
      firstBornTick! + 1,
      firstBornTick! + 2,
      firstBornTick! + 3,
    ]);
    expect(rounds.every((row) => row.sourcePlayerId === player.id)).toBe(true);
    h.tick(6);
    expect(h.room.projectileSeq - firstProjectileSeq).toBe(4);
  });

  it("makes every Arcanist held-fire cadence request an accepted projectile beat", () => {
    const weaponId = "x-staff-arcane-lance";
    const weapon = WEAPONS[weaponId];
    if (!weapon?.cast) throw new Error("Arcanist cast fixture is required");
    const { h, player } = projectileRoom("arcanist", weaponId);
    const cadence = enemyComboShared.weaponAttackCooldown(weapon);
    const projectileCount = weapon.cast.volley?.count ?? 1;

    expect(cadence).toBe(weapon.cast.cooldown);
    for (let shot = 0; shot < 4; shot++) {
      const attackSeq = player.attackSeq;
      const projectileSeq = h.room.projectileSeq;
      h.send(player.id, "attack", {
        aimX: 1,
        aimY: 0,
        tx: player.x + weapon.cast.range,
        ty: player.y,
      });
      h.tick(1);
      expect(player.attackSeq, `accepted shot ${shot + 1}`).toBe(attackSeq + 1);
      expect(h.room.projectileSeq, `volley for shot ${shot + 1}`).toBe(
        projectileSeq + projectileCount,
      );
      h.tick(Math.ceil(cadence / 0.05));
    }
  });
});

// NW-MELEE/NW-THROWN append-only server-authority contracts.
describe("GameRoom - NW melee and thrown mechanics", () => {
  it("applies Glacier Headtaker's authored freeze through the shared enemy slow status map", () => {
    const h = makeRoom();
    h.join("glacier");
    h.state().enemies.clear();
    const player = h.state().players.get("glacier");
    player.x = 2_400;
    player.y = 2_400;
    const enemy = new EnemyState();
    enemy.id = "freeze-target";
    enemy.kind = "critter";
    enemy.hp = 100;
    enemy.x = player.x + 80;
    enemy.y = player.y;
    h.state().enemies.set(enemy.id, enemy);
    h.room.rebuildEnemyGrid();
    const combat = h.room.combat.get(player.id);
    combat.aimX = 1;
    combat.aimY = 0;
    const definition = WEAPONS["x2-glacier-headtaker"];
    if (!definition?.hitStatus) throw new Error("Glacier freeze fixture is required");
    const swing = swingDescriptorFor(definition, definition.cooldown);

    h.room.resolveSwing(player, combat, definition, swing);
    h.room.stepMeleeSwings(swing.activeEndSeconds + 0.001);

    expect(enemy.hp).toBeLessThan(100);
    expect(h.room.enemyZoneSlow.get(enemy.id)).toEqual({
      multiplier: 0.1,
      untilTick: 16,
    });
  });

  it("selects Carrion Cudgel's nearest fresh ricochet target and consumes one hop", () => {
    const h = makeRoom();
    h.state().enemies.clear();
    const near = new EnemyState();
    near.id = "near";
    near.kind = "critter";
    near.hp = 10;
    near.x = 30;
    near.y = 0;
    const far = new EnemyState();
    far.id = "far";
    far.kind = "critter";
    far.hp = 10;
    far.x = 0;
    far.y = 80;
    h.state().enemies.set(near.id, near);
    h.state().enemies.set(far.id, far);
    const projectile = { x: 0, y: 0, vx: -120, vy: 0 };
    const meta = {
      ttl: 0.01,
      hit: new Set(["spent"]),
      pierce: 0,
      pierceMax: 1,
      ricochetHops: 1,
      ricochetRange: 260,
    };

    expect(h.room.redirectThrownRicochet(projectile, meta)).toBe(true);
    expect(projectile.vx).toBeCloseTo(120);
    expect(projectile.vy).toBeCloseTo(0);
    expect(meta).toMatchObject({ pierce: 1, ricochetHops: 0 });
    expect(meta.ttl).toBeCloseTo(260 / 120);
  });

  it("registers Mournveil's held fan-spin as one full authoritative damage arc", () => {
    const h = makeRoom();
    h.join("mournveil");
    const player = h.state().players.get("mournveil");
    const combat = h.room.combat.get(player.id);
    combat.aimX = 1;
    combat.aimY = 0;
    const definition = WEAPONS["x2-mournveil-scythe"];
    if (!definition) throw new Error("Mournveil fan-spin fixture is required");

    h.room.resolveSwing(player, combat, definition, swingDescriptorFor(definition, definition.cooldown));
    const active = h.room.meleeSwings.get(player.id);

    expect(definition.performance).toMatchObject({ continuous: true, action: "default-swing" });
    expect(active?.swingArc).toBeCloseTo(Math.PI * 2);
    expect(active?.swing.style).toBe("spin");
  });
});
