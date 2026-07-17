import {
  ACTION_MSGS_PER_TICK,
  AUGMENTS,
  BELT_LEVEL_IDS,
  beltLevelFor,
  beltPitAtX,
  draftAugments,
  BELT_Y0,
  clampBeltFloorY,
  CRIT_MULT,
  critChanceFor,
  DEFAULT_WEAPON,
  DEPTH_MAX,
  DIMENSIONS,
  DROP_POOL,
  DUMMY_HP,
  ENEMY_KINDS,
  EnemyState,
  FISTS_WEAPON,
  getDimension,
  isPitAtPx,
  makeRng,
  MAX_ENEMIES,
  META_FORTUNE_LUK,
  META_POWER_STR,
  META_VITALITY_HP,
  PARRY_CHAIN_RIPOSTE_AT,
  PARRY_IFRAMES,
  PIT_FALL_DAMAGE_FRAC,
  PickupState,
  PLAYER_MAX_HP,
  REVIVE_HP_FRAC,
  SHIFTER_KIND_IDS,
  salvageValue,
  scripValue,
  SET_BONUS_2,
  SET_BONUS_3,
  TILE_GROUND,
  TILE_PIT,
  weaponSetBonus,
  WEAPON_IDS,
  WEAPONS,
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
    h.tick(5);
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

  it("a gun empties to a reload, then refills the magazine after reloadSeconds (§9)", () => {
    const h = training();
    const p = h.state().players.get("p1");
    const gunId = "x-gun-revolver-cannon";
    const gun = WEAPONS[gunId]?.gun;
    if (!gun) throw new Error("fixture weapon is not a gun");
    p.weapon = gunId;
    h.tick(1); // equip → ammo readout initialises to the magazine
    expect(p.maxCharges).toBe(gun.magazine);
    expect(p.charges).toBe(gun.magazine);
    const c = h.room.combat.get("p1");
    let emptied = false;
    for (let i = 0; i < 240 && !emptied; i++) {
      h.send("p1", "attack", { aimX: 1, aimY: 0 }); // hold the trigger: the attack buffer re-arms each tick
      h.tick(1);
      if (p.charges === 0) emptied = true;
    }
    expect(emptied).toBe(true); // spent the whole magazine
    expect(c.reloadCd).toBeGreaterThan(0); // reload armed on empty
    // Release the trigger (stop sending attack) and let the reload timer run out.
    h.tick(Math.ceil(gun.reloadSeconds / 0.05) + 2);
    expect(p.charges).toBe(p.maxCharges); // magazine refilled
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

  it("§43 the HAILSHOT HAND-MAUL's recovered explosive gun fires — the sibling-block data-loss stays fixed", () => {
    // This weapon shipped as a default 6-damage slug for months: its authored 16-damage explosive gun
    // lived in a `gun` block NEXT TO behavior, which the old generator silently ignored (Sol audit P0).
    // Prove the recovered kit end-to-end in the sim: the shell explodes, catching a dummy OFF the line.
    const h = training();
    const p = h.state().players.get("p1");
    p.weapon = "x2-hailshot-hand-maul";
    h.tick(1);
    const dummy = [...h.state().enemies.values()].find((e: { kind: string }) => e.kind === "dummy");
    if (!dummy) throw new Error("no training dummy");
    const hp0 = dummy.hp;
    // Shell expires ~muzzle reach + range 540 past spawn; 45px off the line, only the 60px blast reaches.
    // §50 pinned geometry + cleared landmarks — same RNG flake class as the mortar test above.
    h.room.map.pois.length = 0;
    h.room.map.tiles.fill(TILE_GROUND);
    dummy.x = 2400;
    dummy.y = 2400;
    p.x = dummy.x - 630;
    p.y = dummy.y + 45;
    h.send("p1", "attack", { aimX: 1, aimY: 0, tx: p.x + 600, ty: p.y });
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
            "hp": 100,
            "id": "p2",
            "level": 1,
            "x": 2362,
            "y": 2379,
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
  function grabAt(h: AnyRoom, pid: string, weapon: string, rarity = 2, affix = "keen", earned = true) {
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
      expect(dim.id, `${id} dimensionId "${level.dimensionId}" resolves (not the wild-west fallback)`).toBe(
        level.dimensionId,
      );
      expect(ENEMY_KINDS[dim.boss]?.archetype, `${dim.boss} is a registered boss`).toBe("boss");
      expect(level.rooms.some((r) => r.boss)).toBe(true); // has a boss finale room
      expect(level.rooms.length).toBeGreaterThanOrEqual(2);
    });
  }
});

// §38 the signature draft is WEAPON-GATED: parry augments are universal, gun/cast augments only offered to
// the matching delivery (so ranged/caster get a signature, and melee never draws a dead gun/cast pick).
describe("GameRoom — §38 weapon-gated signature draft", () => {
  const GUN_AUGS = Object.values(AUGMENTS).filter((a) => a.weapon === "gun").map((a) => a.id);
  const CAST_AUGS = Object.values(AUGMENTS).filter((a) => a.weapon === "cast").map((a) => a.id);
  /** All ids that can EVER appear across many draws for a given weapon kind. */
  const seen = (weaponKind?: "gun" | "cast") => {
    const s = new Set<string>();
    for (let i = 0; i < 400; i++) for (const id of draftAugments(Math.random, weaponKind)) s.add(id);
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
      expect([...h.state().enemies.values()].some((e: { kind: string }) => e.kind === "moss-stone-golem")).toBe(false);
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
      h.room.onJoin({ sessionId: "rich" }, { scrip: 65535, up: { vitality: 9, fortune: 9, power: 9 } });
    });
    const p = h.state().players.get("rich");
    expect(p.scrip).toBe(0);
    expect(p.upVitality).toBe(0);
    expect(p.upPower).toBe(0);
  });
});

describe("improve2 integrity regressions", () => {
  it("G-01 restores per-weapon cooldown/ammo debt and keeps an immediate quick-swap press buffered", () => {
    const h = makeRoom();
    h.join("swap-ledger");
    const player = h.state().players.get("swap-ledger");
    const combat = h.room.combat.get("swap-ledger");
    const gunId = WEAPON_IDS.find((id) => WEAPONS[id]?.gun);
    if (!gunId) throw new Error("expected a gun fixture");
    player.weapon = gunId;
    h.tick(1);
    combat.cd = 0.6;
    combat.reloadCd = 0.5;
    player.charges = 1;

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
    expect(combat.reloadCd).toBeGreaterThan(0.3);
    expect(player.charges).toBe(1);
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
      ([, kind]) => !!kind.wieldsWeapon && !!kind.dropWeapon && !kind.shifter && kind.archetype !== "boss",
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
    expect(h.state().schemaVersion).toBe(23);
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

    h.room.clients = h.room.clients.filter((client: { sessionId: string }) => client.sessionId !== "p1");
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
  BEAM_RESTART_HEAT: BEAM_RESTART_THRESHOLD,
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

  it("overheats at the bounded channel cap, cannot queue while held, then cools to restart", () => {
    const { h, player, combat } = makeBeamRoom("beam-heat");
    const chargeTicks = Math.round(BEAM_CHARGE_SECONDS / 0.05);
    for (let seq = 1; seq < chargeTicks; seq++) sendBeamFrame(h, player.id, seq, true);
    for (let i = 0; i < 25; i++) sendBeamFrame(h, player.id, chargeTicks + i, true);

    const resource = combat.beamLedger.get(TEST_BEAM_WEAPON);
    expect(combat.beamPhase).toBe(0);
    expect(resource.heat).toBe(1);
    expect(resource.lockT).toBeCloseTo(BEAM_LOCK_SECONDS, 8);
    expect(resource.requireRelease).toBe(true);
    expect(h.state().beams.get(player.id)?.phase).toBe(SyncedBeamPhase.Overheated);

    let seq = chargeTicks + 25;
    for (let i = 0; i < 40; i++) sendBeamFrame(h, player.id, seq++, true);
    expect(combat.beamPhase).toBe(0);
    expect(resource.heat).toBe(1); // no cooling and no queued restart while the trigger remains held

    while (resource.heat > BEAM_RESTART_THRESHOLD) sendBeamFrame(h, player.id, seq++, false);
    sendBeamFrame(h, player.id, seq, true);
    expect(resource.requireRelease).toBe(false);
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
    expect([...h.state().xpEchoes.values()].map((echo: { value: number }) => echo.value)).toEqual([3]);
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
    expect([...h.state().xpEchoes.values()].reduce(
      (sum: number, echo: { value: number }) => sum + echo.value,
      0,
    )).toBe(wormRoomShared.WORM_TOTAL_XP);
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
  it("negotiates 110px ahead of the slow facing anchor, then never moves the marker or landing", () => {
    const { h, player } = makeEnemyComboRoom(1);
    const enemy = addComboEnemy(h, player, "combo-leaper", "vault-ronin", 300);
    player.aimDir = Math.PI; // live mouse aim points LEFT; approach bearing/facing is RIGHT by law

    h.tick(1); // idle → leapwind: marker exists from the decision tick
    const st = h.room.comboState.get(enemy.id);
    const row = h.state().telegraphs.get(st.tg);
    expect(st.phase).toBe("leapwind");
    expect(row.danger).toBe(0); // white duel offer, never the legacy red assault marker
    expect(row.x - player.x).toBeCloseTo(110, 6);
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
    expect(((h.state().tick - returnStart) >>> 0)).toBeGreaterThanOrEqual(8);
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
    expect(hp - player.hp).toBeLessThanOrEqual(player.maxHp * enemyComboShared.COMBO_DAMAGE_CAP_FRAC);

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
    expect(enemyComboShared.SCHEMA_VERSION).toBe(23);
    expect(new EnemyState().comboSeq).toBe(0);
    expect(new EnemyState().comboFlags).toBe(0);
    expect(herePlayerJuggledDefault()).toBe(0);
    expect(ENEMY_KINDS.ronin?.combos).toContainEqual({ combo: "k3-gale-cross", minDepth: 3 });
    expect(ENEMY_KINDS["vault-ronin"]?.combos).toContainEqual({ combo: "k4-sky-hook", minDepth: 5 });
    expect(ENEMY_KINDS["shifter-cinder-marshal"]?.combos).toEqual([
      { combo: "k1-sanren", minDepth: 1 },
    ]);
    expect(ENEMY_KINDS["shifter-grave-warden"]?.combos).toContainEqual({
      combo: "h4-coffin-lid",
      minDepth: 6,
    });
    for (const def of Object.values(enemyComboShared.TOUGH_COMBOS)) {
      expect(def.frontOffset).toBeGreaterThanOrEqual(110);
      expect(def.frontOffset).toBeLessThanOrEqual(120);
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
    expect(enemyComboShared.verticalTimeToGround(0, enemyComboShared.JUMP_VELOCITY) * enemyComboShared.MOVE_SPEED)
      .toBeGreaterThan(160);

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
    sendJumpFeelInput(h, player.id, 1, { crouchHeld: true, dx: 1 });
    expect(player.moveStance).toBe(enemyComboShared.STANCE_CROUCH);
    h.tick(3);
    expect([player.moveStance, player.poundSeq, player.stanceSeq]).toEqual([1, 0, 0]);
    sendJumpFeelInput(h, player.id, 2, { crouchHeld: false });
    expect([player.moveStance, player.stanceSeq]).toEqual([0, 0]);

    sendJumpFeelInput(h, player.id, 3, { crouchHeld: true, dx: 1 });
    h.room.damagePlayer(player, 1);
    expect(combat.stance).toBe(enemyComboShared.STANCE_NONE);
    expect([player.moveStance, player.stanceSeq]).toEqual([0, 1]);
    h.room.damagePlayer(player, 1);
    expect(player.stanceSeq).toBe(1); // no transition, no wire churn
  });

  it("enforces early-release/cooldown cancels and samples the launch tick's live WASD", () => {
    const early = makeJumpFeelRoom("crouch-early");
    sendJumpFeelInput(early.h, early.player.id, 1, { crouchHeld: true, dx: 1 });
    sendJumpFeelInput(early.h, early.player.id, 2, { crouchHeld: true, dx: 1 });
    sendJumpFeelInput(early.h, early.player.id, 3, { crouchHeld: true, dx: 1 });
    sendJumpFeelInput(early.h, early.player.id, 4, { crouchHeld: false });
    expect(early.combat.stance).toBe(enemyComboShared.STANCE_NONE);
    expect(early.player.height).toBe(0);

    const locked = makeJumpFeelRoom("crouch-lock");
    for (let seq = 1; seq <= 9; seq++) {
      sendJumpFeelInput(locked.h, locked.player.id, seq, { crouchHeld: true, dx: 1 });
    }
    sendJumpFeelInput(locked.h, locked.player.id, 10, { crouchHeld: true, dy: 1 });
    expect(locked.combat.stance).toBe(enemyComboShared.STANCE_DASH);
    expect(locked.combat.dashBaseDirX).toBeCloseTo(0, 6);
    expect(locked.combat.dashBaseDirY).toBeCloseTo(1, 6);

    const cooldown = makeJumpFeelRoom("crouch-cooldown");
    cooldown.combat.distJumpCd = 1;
    for (let seq = 1; seq <= 10; seq++) {
      sendJumpFeelInput(cooldown.h, cooldown.player.id, seq, { crouchHeld: true, dx: 1 });
    }
    expect(cooldown.combat.stance).toBe(enemyComboShared.STANCE_NONE);
    expect(cooldown.player.height).toBe(0);
  });

  it("soft-steers at <=45°/s within ±27°, reaches 372px, and cycles slower than MOVE_SPEED", () => {
    const reach = makeJumpFeelRoom("dash-reach");
    const startX = reach.player.x;
    for (let seq = 1; seq <= 10; seq++) {
      sendJumpFeelInput(reach.h, reach.player.id, seq, { crouchHeld: true, dx: 1 });
    }
    expect(reach.combat.stance).toBe(enemyComboShared.STANCE_DASH);
    for (let i = 0; i < 20 && reach.combat.stance === enemyComboShared.STANCE_DASH; i++) reach.h.tick(1);
    expect(reach.player.x - startX).toBeCloseTo(enemyComboShared.DIST_JUMP_REACH, 5);
    expect(reach.player.x - startX).toBeGreaterThan(320);
    expect(reach.combat.lastLandingTier).toBe(enemyComboShared.LANDING_TIER_HEAVY);
    expect(enemyComboShared.DIST_JUMP_CYCLE_SPEED).toBeLessThan(enemyComboShared.MOVE_SPEED);
    expect(reach.combat.distJumpCd).toBeGreaterThan(0);

    const steer = makeJumpFeelRoom("dash-steer");
    for (let seq = 1; seq <= 10; seq++) {
      sendJumpFeelInput(steer.h, steer.player.id, seq, { crouchHeld: true, dy: 1 });
    }
    let maxTurn = 0;
    let seq = 11;
    while (steer.combat.stance === enemyComboShared.STANCE_DASH && seq < 30) {
      const before = steer.combat.dashSteer;
      sendJumpFeelInput(steer.h, steer.player.id, seq++, { dx: 1, crouchHeld: true });
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
    const expected = enemyComboShared.safeSpawnPos(h.room.map, rawX, rawY, enemyComboShared.PLAYER_RADIUS);
    const dx = expected.x - player.x;
    const dy = expected.y - player.y;
    const d = Math.hypot(dx, dy);
    for (let seq = 1; seq <= 10; seq++) {
      sendJumpFeelInput(h, player.id, seq, { crouchHeld: true, dx: 1 });
    }
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
    expect(enemyComboShared.SCHEMA_VERSION).toBe(23);
    expect([player.moveStance, player.poundSeq, player.stanceSeq]).toEqual([0, 0, 0]);
  });
});

// Wave 21a — appended class-dissolution economy, identity-snapshot, quirk-seam, and schema fixtures.
describe("GameRoom — classmerge 21a", () => {
  const attrTotal = (player: {
    str: number;
    dex: number;
    int: number;
    con: number;
    luk: number;
  }) => player.str + player.dex + player.int + player.con + player.luk;

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
    expect(enemyComboShared.SCHEMA_VERSION).toBe(23);
    expect(player.runCharacter).toBe("drifter");
  });
});

// Wave 23 — the Megabonk slide consumes 21b's contact-only dodge budget. Every spatial fixture starts
// on the cleared spawn disc/all-ground map so map generation cannot decide whether an authored hit connects.
function sendSlideInput(
  h: ReturnType<typeof makeRoom>,
  id: string,
  seq: number,
  fields: {
    dx?: number;
    dy?: number;
    slide?: boolean;
    slideHeld?: boolean;
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
    slide: fields.slide ?? false,
    slideHeld: fields.slideHeld ?? fields.slide ?? false,
    fireHeld: fields.fireHeld ?? false,
    aimX: 1,
    aimY: 0,
    targetX: 0,
    targetY: 0,
  });
  h.tick(1);
}

function makeSlideRoom(id = "slide-player") {
  const fixture = makeJumpFeelRoom(id);
  return { ...fixture, combatInput: fixture.h.room.inputs.get(id) };
}

function beginSlide(fixture: ReturnType<typeof makeSlideRoom>, seq = 1, dx = 1, dy = 0) {
  const speed = Math.hypot(dx, dy) || 1;
  fixture.combatInput.mvx = (dx / speed) * enemyComboShared.SLIDE_ENTRY_SPEED;
  fixture.combatInput.mvy = (dy / speed) * enemyComboShared.SLIDE_ENTRY_SPEED;
  fixture.player.mvx = fixture.combatInput.mvx;
  fixture.player.mvy = fixture.combatInput.mvy;
  sendSlideInput(fixture.h, fixture.player.id, seq, { dx, dy, slide: true });
  expect(fixture.combat.stance).toBe(enemyComboShared.STANCE_SLIDE);
}

function addSlideMeleeEnemy(
  fixture: ReturnType<typeof makeSlideRoom>,
  id: string,
  offsetX = -40,
) {
  const enemy = addJumpDummy(
    fixture.h,
    id,
    fixture.player.x + offsetX,
    fixture.player.y,
    1_000,
  );
  enemy.kind = "vault-ronin";
  return enemy;
}

describe("GameRoom — schema-23 Megabonk slide inherits the 21b dodge laws", () => {
  it("accepts only grounded, cold-armed, non-juggled movement-gated entry commands", () => {
    const fixture = makeSlideRoom("slide-gates");
    fixture.combatInput.mvx = enemyComboShared.SLIDE_ENTRY_SPEED;
    fixture.player.mvx = enemyComboShared.SLIDE_ENTRY_SPEED;
    fixture.player.height = 1;
    sendSlideInput(fixture.h, fixture.player.id, 1, { dx: 1, slide: true });
    expect(fixture.combat.stance).toBe(enemyComboShared.STANCE_NONE);

    fixture.player.height = 0;
    fixture.combat.slideColdArmed = false;
    sendSlideInput(fixture.h, fixture.player.id, 2, { dx: 1, slide: true });
    expect(fixture.combat.stance).toBe(enemyComboShared.STANCE_NONE);

    fixture.combat.slideColdArmed = true;
    fixture.combat.juggleArmed = true;
    sendSlideInput(fixture.h, fixture.player.id, 3, { dx: 1, slide: true });
    expect(fixture.combat.stance).toBe(enemyComboShared.STANCE_NONE);

    fixture.combat.juggleArmed = false;
    beginSlide(fixture, 4);
  });

  it("derives exactly five immune phase ticks before phase tick six becomes vulnerable", () => {
    const fixture = makeSlideRoom("slide-window");
    beginSlide(fixture);
    const hp = fixture.player.hp;
    const dodged = fixture.player.dodgedSeq;
    for (let tick = 0; tick < 5; tick++) {
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
      if (tick < 4) fixture.h.tick(1);
    }
    expect(fixture.combat.slidePhaseTick).toBe(enemyComboShared.SLIDE_IFRAME_TICKS);
    expect(fixture.player.dodgedSeq).toBe((dodged + 5) & 0xff);

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

  it("null-whiffs enemy contact DPS during the slide opening", () => {
    const fixture = makeSlideRoom("slide-contact");
    const contactEntry = Object.entries(ENEMY_KINDS).find(([, kind]) => kind.contactDamage > 0);
    if (!contactEntry) throw new Error("test roster needs a contact-damage enemy");
    const [kindId, kind] = contactEntry;
    const enemy = addJumpDummy(
      fixture.h,
      "slide-contact-enemy",
      fixture.player.x + kind.radius + enemyComboShared.PLAYER_RADIUS,
      fixture.player.y,
    );
    enemy.kind = kindId;
    fixture.combat.stance = enemyComboShared.STANCE_SLIDE;
    fixture.combat.slidePhase = enemyComboShared.SLIDE_PHASE_GROUND;
    fixture.combat.slidePhaseTick = 0;
    fixture.combat.momentumX = enemyComboShared.SLIDE_SPEED_CAP;
    fixture.combat.momentumY = 0;
    fixture.player.moveStance = enemyComboShared.STANCE_SLIDE;
    const hp = fixture.player.hp;
    const dodged = fixture.player.dodgedSeq;
    fixture.h.tick(1);
    expect(fixture.player.hp).toBe(hp);
    expect(fixture.player.dodgedSeq).toBeGreaterThan(dodged);
    const contacted = fixture.player.dodgedSeq;
    enemy.x = fixture.player.x + 1_000;
    enemy.y = fixture.player.y + 1_000;
    fixture.h.tick(1);
    expect(fixture.player.dodgedSeq).toBe(contacted); // no cosmetic edge without real contact
  });

  it("null-whiffs hostile projectiles without reflecting or consuming them", () => {
    const fixture = makeSlideRoom("slide-projectile");
    beginSlide(fixture);
    fixture.h.room.fireProjectile(
      { x: fixture.player.x, y: fixture.player.y },
      { x: fixture.player.x + 1, y: fixture.player.y },
      0,
      13,
    );
    const projectile = [...fixture.h.state().projectiles.values()].at(-1);
    if (!projectile) throw new Error("expected hostile slide fixture projectile");
    const hp = fixture.player.hp;
    fixture.h.room.stepProjectiles(0.05);
    expect(fixture.player.hp).toBe(hp);
    expect(fixture.h.state().projectiles.has(projectile.id)).toBe(true);
    expect(projectile.hostile).toBe(true);
  });

  it("null-whiffs the duelist sweep without parry knockback, chain, or riposte rewards", () => {
    const fixture = makeSlideRoom("slide-duelist");
    beginSlide(fixture);
    const enemy = addSlideMeleeEnemy(fixture, "slide-duelist-enemy");
    fixture.combat.parryChain = 2;
    const hp = fixture.player.hp;
    const enemyX = enemy.x;
    const parried = fixture.player.parriedSeq;
    const dodged = fixture.player.dodgedSeq;
    fixture.h.room.duelistSwing(
      enemy,
      enemy.id,
      fixture.player,
      { range: 200, halfArc: 1.2, damage: 20 },
      { aimX: 1, aimY: 0 },
    );
    expect(fixture.player.hp).toBe(hp);
    expect(fixture.player.parriedSeq).toBe(parried);
    expect(fixture.player.dodgedSeq).toBe((dodged + 1) & 0xff);
    expect(fixture.combat.parryChain).toBe(2);
    expect([fixture.player.vx, fixture.player.vy]).toEqual([0, 0]);
    expect(enemy.x).toBe(enemyX);
  });

  it("null-whiffs boss/worm melee wedges without accepting a worm parry", () => {
    const fixture = makeSlideRoom("slide-worm-wedge");
    beginSlide(fixture);
    const acceptWormParry = vi.fn();
    fixture.h.room.bossController = { acceptWormParry };
    const hp = fixture.player.hp;
    const parried = fixture.player.parriedSeq;
    fixture.h.room.applyBossMelee(
      fixture.player.x - 20,
      fixture.player.y,
      1,
      0,
      80,
      1,
      15,
      200,
    );
    expect(fixture.player.hp).toBe(hp);
    expect(fixture.player.parriedSeq).toBe(parried);
    expect(acceptWormParry).not.toHaveBeenCalled();
  });

  it("null-whiffs the juggle launcher and never arms the juggle", () => {
    const fixture = makeSlideRoom("slide-launcher");
    beginSlide(fixture);
    const enemy = addSlideMeleeEnemy(fixture, "slide-launcher-enemy");
    const hp = fixture.player.hp;
    const juggled = fixture.player.juggledSeq;
    fixture.h.room.comboSwing(
      enemy,
      enemy.id,
      { targetId: fixture.player.id, juggleCombo: true, comboDamage: 0 },
      { kind: "launcher", windupTicks: 6, step: 0, damageMult: 1, launch: { vh: 480, push: 90 } },
      { range: 200, halfArc: 1.2, damageMult: 1, knockbackMult: 1 },
      { x: enemy.x, y: enemy.y, aimX: 1, aimY: 0 },
    );
    expect(fixture.player.hp).toBe(hp);
    expect(fixture.player.juggledSeq).toBe(juggled);
    expect(fixture.combat.juggleArmed).toBe(false);
    expect(fixture.combat.stance).toBe(enemyComboShared.STANCE_SLIDE);
  });

  it("keeps boss AoE damage unchanged during slide i-frames", () => {
    const fixture = makeSlideRoom("slide-aoe");
    beginSlide(fixture);
    const hp = fixture.player.hp;
    fixture.h.room.applyBossAoE(fixture.player.x, fixture.player.y, 80, 9, 0);
    expect(fixture.player.hp).toBe(hp - 9);
  });

  it("keeps grounded quake damage unchanged during slide i-frames", () => {
    const fixture = makeSlideRoom("slide-quake");
    beginSlide(fixture);
    const hp = fixture.player.hp;
    fixture.h.room.applyBossQuake(fixture.player.x, fixture.player.y, 80, 9, 0);
    expect(fixture.player.hp).toBe(hp - 9);
  });

  it("keeps beam-lane damage unchanged during slide i-frames", () => {
    const fixture = makeSlideRoom("slide-beam");
    beginSlide(fixture);
    const hp = fixture.player.hp;
    fixture.h.room.damageBeamRect(
      fixture.player.x - 20,
      fixture.player.y,
      40,
      20,
      0,
      9,
      0,
    );
    expect(fixture.player.hp).toBe(hp - 9);
  });

  it("keeps ring-band damage unchanged during slide i-frames", () => {
    const fixture = makeSlideRoom("slide-ring");
    beginSlide(fixture);
    const hp = fixture.player.hp;
    fixture.h.room.damageRingBand(
      fixture.player.x - 50,
      fixture.player.y,
      50,
      2,
      0,
      0,
      9,
    );
    expect(fixture.player.hp).toBe(hp - 9);
  });

  it("keeps puddle damage unchanged during slide i-frames", () => {
    const fixture = makeSlideRoom("slide-puddle");
    beginSlide(fixture);
    const zone = new ZoneState();
    zone.id = "slide-puddle-zone";
    zone.x = fixture.player.x;
    zone.y = fixture.player.y;
    zone.radius = ZONE_RADIUS;
    fixture.h.state().zones.set(zone.id, zone);
    fixture.h.room.zoneMeta.set(zone.id, ZONE_TTL);
    const hp = fixture.player.hp;
    fixture.h.room.stepZones(0.05);
    expect(fixture.player.hp).toBeLessThan(hp);
  });

  it("keeps pit falls unchanged and force-cancels a sliding player", () => {
    const fixture = makeSlideRoom("slide-pit");
    beginSlide(fixture);
    const map = fixture.h.room.map;
    const col = Math.floor(fixture.player.x / map.tileSize);
    const row = Math.floor(fixture.player.y / map.tileSize);
    for (let y = row - 2; y <= row + 2; y++)
      for (let x = col - 1; x <= col + 4; x++) map.tiles[y * map.cols + x] = TILE_PIT;
    const hp = fixture.player.hp;
    const fell = fixture.player.fellSeq;
    fixture.h.tick(1);
    expect(fixture.player.fellSeq).toBe((fell + 1) & 0xff);
    expect(fixture.player.hp).toBeLessThan(hp);
    expect(fixture.combat.stance).toBe(enemyComboShared.STANCE_NONE);
  });

  it("keeps air-keep damage/juggle writes and force-clears slide carry", () => {
    const fixture = makeSlideRoom("slide-airkeep");
    beginSlide(fixture);
    const enemy = addSlideMeleeEnemy(fixture, "slide-airkeep-enemy");
    const hp = fixture.player.hp;
    const juggled = fixture.player.juggledSeq;
    const stanceSeq = fixture.player.stanceSeq;
    fixture.h.room.comboSwing(
      enemy,
      enemy.id,
      { targetId: fixture.player.id, juggleCombo: true, comboDamage: 0, juggleHits: 0 },
      { kind: "airkeep", windupTicks: 6, step: 1, damageMult: 1, airkeep: { vh: 0, push: 0 } },
      { range: 200, halfArc: 1.2, damageMult: 1, knockbackMult: 1 },
      { x: enemy.x, y: enemy.y, aimX: 1, aimY: 0 },
    );
    expect(fixture.player.hp).toBeLessThan(hp);
    expect(fixture.player.juggledSeq).toBe((juggled + 1) & 0xff);
    expect(fixture.combat.stance).toBe(enemyComboShared.STANCE_NONE);
    expect(fixture.player.stanceSeq).toBe((stanceSeq + 1) & 0xff);
    expect([fixture.combat.momentumX, fixture.combat.momentumY]).toEqual([0, 0]);
  });

  it("bounds ground carving while integrating the ten-sample momentum curve", () => {
    const fixture = makeSlideRoom("slide-direction");
    const startX = fixture.player.x;
    const startY = fixture.player.y;
    beginSlide(fixture);
    for (let seq = 2; seq <= 10; seq++)
      sendSlideInput(fixture.h, fixture.player.id, seq, { dy: 1 });
    let expectedX = 0;
    let expectedY = 0;
    let speed: number = enemyComboShared.SLIDE_SPEED_CAP;
    let momentumX = speed;
    let momentumY = 0;
    for (let tick = 0; tick < enemyComboShared.SLIDE_GROUND_TICKS; tick++) {
      if (tick > 0) {
        const angle = enemyComboShared.slideSteeredAngle(
          momentumX,
          momentumY,
          0,
          1,
          0.05,
          false,
        );
        momentumX = Math.cos(angle) * speed;
        momentumY = Math.sin(angle) * speed;
      }
      expectedX += momentumX * 0.05;
      expectedY += momentumY * 0.05;
      speed = enemyComboShared.slideGroundNextSpeed(speed);
      const scale = speed / Math.hypot(momentumX, momentumY);
      momentumX *= scale;
      momentumY *= scale;
    }
    expect(fixture.player.x - startX).toBeCloseTo(expectedX, 6);
    expect(fixture.player.y - startY).toBeCloseTo(expectedY, 6);
    expect(fixture.combat.stance).toBe(enemyComboShared.STANCE_NONE);
  });

  it("disarms on slide end and rejects a new edge until six qualifying run ticks", () => {
    const fixture = makeSlideRoom("slide-rearm");
    beginSlide(fixture);
    fixture.h.tick(9);
    expect(fixture.combat.stance).toBe(enemyComboShared.STANCE_NONE);
    expect(fixture.combat.slideColdArmed).toBe(false);

    sendSlideInput(fixture.h, fixture.player.id, 2, { dx: 1, slide: true });
    expect(fixture.combat.stance).toBe(enemyComboShared.STANCE_NONE);
    fixture.h.tick(5);
    expect(fixture.combat.slideColdRearmTicks).toBe(enemyComboShared.SLIDE_COLD_REARM_TICKS);
    expect(fixture.combat.slideColdArmed).toBe(true);
    sendSlideInput(fixture.h, fixture.player.id, 3, { dx: 1, slideHeld: false });
    beginSlide(fixture, 4);
  });

  it("enforces the attack, parry, and slide-hop channel split on exact ticks", () => {
    const attack = makeSlideRoom("slide-attack-split");
    beginSlide(attack);
    attack.h.send(attack.player.id, "attack", { aimX: 1, aimY: 0 });
    expect(attack.combat.stance).toBe(enemyComboShared.STANCE_SLIDE);
    expect(attack.combat.attackBuffer).toBe(0);
    attack.h.tick(5);
    expect(attack.combat.slidePhaseTick * 0.05).toBeCloseTo(
      enemyComboShared.SLIDE_ATTACK_CANCEL_SECONDS,
      8,
    );
    attack.h.send(attack.player.id, "attack", { aimX: 1, aimY: 0 });
    expect(attack.combat.stance).toBe(enemyComboShared.STANCE_NONE);
    expect(attack.combat.attackBuffer).toBeGreaterThan(0);

    const fromParry = makeSlideRoom("parry-slide-gate");
    fromParry.combat.invuln = 0.1;
    fromParry.combatInput.mvx = enemyComboShared.SLIDE_ENTRY_SPEED;
    fromParry.player.mvx = enemyComboShared.SLIDE_ENTRY_SPEED;
    sendSlideInput(fromParry.h, fromParry.player.id, 1, { dx: 1, slide: true });
    expect(fromParry.combat.stance).toBe(enemyComboShared.STANCE_NONE);

    const parry = makeSlideRoom("slide-parry-lock");
    beginSlide(parry);
    for (let tick = 1; tick <= 9; tick++) {
      parry.h.send(parry.player.id, "parry");
      parry.h.tick(1);
      expect(parry.combat.invuln).toBe(0);
    }
    parry.h.send(parry.player.id, "parry");
    parry.h.tick(1);
    expect(parry.combat.invuln).toBeGreaterThan(0); // earliest acceptance is consume + 10

    const jump = makeSlideRoom("slide-hop-buffer");
    beginSlide(jump);
    sendSlideInput(jump.h, jump.player.id, 2, { dx: 1, jump: true, slideHeld: true });
    expect(jump.combat.stance).toBe(enemyComboShared.STANCE_SLIDE);
    expect(jump.combat.slidePhase).toBe(enemyComboShared.SLIDE_PHASE_AIR);
    expect(jump.player.height).toBeGreaterThan(0);
  });

  it("bumps stanceSeq on forced slide cancellation but not natural recovery", () => {
    const forced = makeSlideRoom("slide-forced-cancel");
    beginSlide(forced);
    const forcedSeq = forced.player.stanceSeq;
    forced.h.room.zeroMoveVel(forced.player.id);
    expect(forced.combat.stance).toBe(enemyComboShared.STANCE_NONE);
    expect(forced.player.stanceSeq).toBe((forcedSeq + 1) & 0xff);
    expect(forced.combat.slideColdArmed).toBe(false);
    expect([forced.combat.momentumX, forced.combat.momentumY]).toEqual([0, 0]);

    const natural = makeSlideRoom("slide-natural-end");
    beginSlide(natural);
    const naturalSeq = natural.player.stanceSeq;
    natural.h.tick(9);
    expect(natural.combat.stance).toBe(enemyComboShared.STANCE_NONE);
    expect(natural.player.stanceSeq).toBe(naturalSeq);
  });

  it("ships schema 23 with the dodge edge and appended slide predictor state", () => {
    const player = new enemyComboShared.PlayerState();
    expect(enemyComboShared.SCHEMA_VERSION).toBe(23);
    expect(player.dodgedSeq).toBe(0);
    expect([player.momentumX, player.momentumY, player.slidePhase, player.slidePhaseTick]).toEqual([
      0, 0, 0, 0,
    ]);
  });
});

describe("GameRoom — appended schema-23 slide momentum and chain laws", () => {
  it("movement-gates cold entry even when the slide edge and a direction arrive together", () => {
    const fixture = makeSlideRoom("slide-movement-gate");
    expect(Math.hypot(fixture.player.mvx, fixture.player.mvy)).toBe(0);
    sendSlideInput(fixture.h, fixture.player.id, 1, { dx: 1, slide: true });
    expect(fixture.combat.stance).toBe(enemyComboShared.STANCE_NONE);
    expect(fixture.combat.slidePhase).toBe(enemyComboShared.SLIDE_PHASE_OFF);
    expect([fixture.player.momentumX, fixture.player.momentumY]).toEqual([0, 0]);
  });

  it("installs the 544 pop and the exact post-integration 0.97 decay values", () => {
    const fixture = makeSlideRoom("slide-decay-values");
    const startX = fixture.player.x;
    beginSlide(fixture);
    expect(fixture.player.x - startX).toBeCloseTo(enemyComboShared.SLIDE_SPEED_CAP * 0.05, 8);
    let expected: number = enemyComboShared.SLIDE_SPEED_CAP;
    for (let tick = 1; tick <= 5; tick++) {
      expected = enemyComboShared.slideGroundNextSpeed(expected);
      expect(Math.hypot(fixture.combat.momentumX, fixture.combat.momentumY)).toBeCloseTo(
        expected,
        8,
      );
      if (tick < 5) fixture.h.tick(1);
    }
  });

  it("preserves 96% at slide-hop launch and keeps airborne magnitude through three-zone gravity", () => {
    const fixture = makeSlideRoom("slide-hop-preservation");
    beginSlide(fixture);
    sendSlideInput(fixture.h, fixture.player.id, 2, {
      dx: 1,
      jump: true,
      slideHeld: true,
    });
    const takeoffSpeed =
      enemyComboShared.SLIDE_SPEED_CAP *
      enemyComboShared.SLIDE_GROUND_DECAY ** 2 *
      enemyComboShared.SLIDE_HOP_RETENTION;
    expect(fixture.combat.slidePhase).toBe(enemyComboShared.SLIDE_PHASE_AIR);
    expect(fixture.combat.vh).toBeLessThan(enemyComboShared.SLIDE_HOP_VERTICAL_VELOCITY);
    expect(Math.hypot(fixture.combat.momentumX, fixture.combat.momentumY)).toBeCloseTo(
      takeoffSpeed,
      8,
    );
    const beforeAirTick = Math.hypot(fixture.combat.momentumX, fixture.combat.momentumY);
    sendSlideInput(fixture.h, fixture.player.id, 3, { dy: 1, slideHeld: true });
    expect(fixture.player.height).toBeGreaterThan(0);
    expect(Math.hypot(fixture.combat.momentumX, fixture.combat.momentumY)).toBeCloseTo(
      beforeAirTick,
      8,
    );
  });

  it("accepts the landing buffer at age 3 and expires it after age 3", () => {
    const hit = makeSlideRoom("slide-land-hit");
    hit.combat.stance = enemyComboShared.STANCE_SLIDE;
    hit.combat.slidePhase = enemyComboShared.SLIDE_PHASE_AIR;
    hit.combat.momentumX = 400;
    hit.combat.momentumY = 0;
    hit.player.moveStance = enemyComboShared.STANCE_SLIDE;
    hit.h.room.finishPlayerLanding(hit.player, hit.combat, enemyComboShared.STANCE_SLIDE, -300);
    hit.h.room.stepSlideStance(hit.player, hit.combat);
    hit.h.room.stepSlideStance(hit.player, hit.combat);
    hit.h.room.stepSlideStance(hit.player, hit.combat);
    expect(hit.combat.slidePhaseTick).toBe(enemyComboShared.SLIDE_LAND_WINDOW_TICKS);
    expect(hit.h.room.acceptSlideLandingChain(hit.player, hit.combat, hit.combatInput)).toBe(true);
    expect(hit.combat.slidePhase).toBe(enemyComboShared.SLIDE_PHASE_GROUND);
    expect(Math.hypot(hit.combat.momentumX, hit.combat.momentumY)).toBeCloseTo(
      enemyComboShared.slideLandingSpeed(400),
      8,
    );
    const acceptedSpeed = Math.hypot(hit.combat.momentumX, hit.combat.momentumY);
    expect(hit.h.room.acceptSlideLandingChain(hit.player, hit.combat, hit.combatInput)).toBe(false);
    expect(Math.hypot(hit.combat.momentumX, hit.combat.momentumY)).toBeCloseTo(acceptedSpeed, 8);

    const miss = makeSlideRoom("slide-land-miss");
    miss.combat.stance = enemyComboShared.STANCE_SLIDE;
    miss.combat.slidePhase = enemyComboShared.SLIDE_PHASE_AIR;
    miss.combat.momentumX = 400;
    miss.combat.momentumY = 0;
    miss.player.moveStance = enemyComboShared.STANCE_SLIDE;
    miss.h.room.finishPlayerLanding(
      miss.player,
      miss.combat,
      enemyComboShared.STANCE_SLIDE,
      -300,
    );
    for (let age = 1; age <= enemyComboShared.SLIDE_LAND_WINDOW_TICKS; age++)
      miss.h.room.stepSlideStance(miss.player, miss.combat);
    expect(miss.combat.stance).toBe(enemyComboShared.STANCE_SLIDE);
    miss.h.room.stepSlideStance(miss.player, miss.combat);
    expect(miss.combat.stance).toBe(enemyComboShared.STANCE_NONE);
    expect([miss.combat.momentumX, miss.combat.momentumY]).toEqual([0, 0]);
  });

  it("honors the two-tick pre-landing press buffer without requiring the key to remain held", () => {
    const fixture = makeSlideRoom("slide-preland-buffer");
    fixture.combat.stance = enemyComboShared.STANCE_SLIDE;
    fixture.combat.slidePhase = enemyComboShared.SLIDE_PHASE_AIR;
    fixture.combat.slidePrelandTicks = enemyComboShared.SLIDE_PRELAND_BUFFER_TICKS;
    fixture.combat.momentumX = 400;
    fixture.combat.momentumY = 0;
    fixture.player.moveStance = enemyComboShared.STANCE_SLIDE;
    fixture.combatInput.held.slideHeld = false;
    fixture.h.room.finishPlayerLanding(
      fixture.player,
      fixture.combat,
      enemyComboShared.STANCE_SLIDE,
      -300,
    );
    expect(fixture.combat.slidePhase).toBe(enemyComboShared.SLIDE_PHASE_GROUND);
    expect(Math.hypot(fixture.combat.momentumX, fixture.combat.momentumY)).toBeCloseTo(452, 8);
  });

  it("lets a fresh high airborne Space press cash slide carry into pound", () => {
    const fixture = makeSlideRoom("slide-air-pound");
    fixture.combat.stance = enemyComboShared.STANCE_SLIDE;
    fixture.combat.slidePhase = enemyComboShared.SLIDE_PHASE_AIR;
    fixture.combat.momentumX = 400;
    fixture.combat.momentumY = 0;
    fixture.combat.vh = 50;
    fixture.player.moveStance = enemyComboShared.STANCE_SLIDE;
    fixture.player.height = 50;
    fixture.player.vh = 50;
    sendSlideInput(fixture.h, fixture.player.id, 1, { pound: true });
    expect(fixture.combat.stance).toBe(enemyComboShared.STANCE_POUND);
    expect([fixture.combat.momentumX, fixture.combat.momentumY]).toEqual([0, 0]);
    expect(fixture.player.moveStance).toBe(enemyComboShared.STANCE_POUND);
  });

  it("cannot resolve portal or weapon interactions until slide stance ends", () => {
    const fixture = makeSlideRoom("slide-interactions");
    beginSlide(fixture);
    fixture.h.state().portalOpen = true;
    fixture.h.state().portalX = fixture.player.x;
    fixture.h.state().portalY = fixture.player.y;
    const weapon = fixture.player.weapon;
    const pickups = fixture.h.state().pickups.size;
    fixture.h.room.checkExtraction([{ x: fixture.player.x, y: fixture.player.y }]);
    fixture.h.send(fixture.player.id, "dropWeapon");
    expect(fixture.h.state().outcome).toBe("active");
    expect(fixture.player.weapon).toBe(weapon);
    expect(fixture.h.state().pickups.size).toBe(pickups);
    fixture.h.room.zeroMoveVel(fixture.player.id);
    fixture.h.room.checkExtraction([{ x: fixture.player.x, y: fixture.player.y }]);
    expect(fixture.h.state().outcome).toBe("victory");
  });

  it("converges perfect chains below the ceiling and makes sloppy chains decay", () => {
    let takeoff: number = enemyComboShared.SLIDE_SPEED_CAP;
    for (let chain = 0; chain < 128; chain++) {
      const nextStart = enemyComboShared.slideLandingSpeed(
        enemyComboShared.slideHopSpeed(takeoff),
      );
      expect(nextStart).toBeLessThanOrEqual(enemyComboShared.SLIDE_SPEED_CAP);
      takeoff = enemyComboShared.slideGroundNextSpeed(
        enemyComboShared.slideGroundNextSpeed(nextStart),
      );
    }
    expect(takeoff).toBeCloseTo(477.4, 1);
    expect(
      enemyComboShared.slideLandingSpeed(enemyComboShared.slideHopSpeed(takeoff)),
    ).toBeCloseTo(507.4, 1);
    expect(enemyComboShared.slideLandingSpeed(100_000)).toBe(
      enemyComboShared.SLIDE_SPEED_CAP,
    );

    const sloppyFixedPoint = (groundTicks: number) => {
      const decay = enemyComboShared.SLIDE_GROUND_DECAY ** groundTicks;
      const retention =
        enemyComboShared.SLIDE_HOP_RETENTION * enemyComboShared.SLIDE_LANDING_RETENTION;
      return (decay * enemyComboShared.SLIDE_LANDING_KICK) / (1 - decay * retention);
    };
    const sloppy = [3, 4, 5].map(sloppyFixedPoint);
    expect(sloppy[0]).toBeCloseTo(392, 0);
    expect(sloppy[1]).toBeCloseTo(330.9, 1);
    expect(sloppy[2]).toBeCloseTo(285.1, 1);
    expect(sloppy[0]).toBeLessThan(takeoff);
    expect(sloppy[2]).toBeLessThan(sloppy[1] as number);
  });

  it("clamps corrupted authority momentum at the server movement assignment site", () => {
    const fixture = makeSlideRoom("slide-authority-cap");
    beginSlide(fixture);
    fixture.combat.momentumX = 100_000;
    fixture.combat.momentumY = 0;
    fixture.h.tick(1);
    expect(Math.hypot(fixture.combat.momentumX, fixture.combat.momentumY)).toBeCloseTo(
      enemyComboShared.SLIDE_SPEED_CAP * enemyComboShared.SLIDE_GROUND_DECAY,
      8,
    );
    expect(Math.hypot(fixture.player.momentumX, fixture.player.momentumY)).toBeLessThanOrEqual(
      enemyComboShared.SLIDE_SPEED_CAP,
    );
  });

  it("defines i-frames only on opening phase ticks 1 through 5", () => {
    expect(
      enemyComboShared.slideContactInvulnerable(
        enemyComboShared.STANCE_SLIDE,
        enemyComboShared.SLIDE_PHASE_GROUND,
        0,
      ),
    ).toBe(false);
    for (let tick = 1; tick <= enemyComboShared.SLIDE_IFRAME_TICKS; tick++) {
      expect(
        enemyComboShared.slideContactInvulnerable(
          enemyComboShared.STANCE_SLIDE,
          enemyComboShared.SLIDE_PHASE_GROUND,
          tick,
        ),
      ).toBe(true);
    }
    expect(
      enemyComboShared.slideContactInvulnerable(
        enemyComboShared.STANCE_SLIDE,
        enemyComboShared.SLIDE_PHASE_AIR,
        enemyComboShared.SLIDE_IFRAME_TICKS,
      ),
    ).toBe(true);
    expect(
      enemyComboShared.slideContactInvulnerable(
        enemyComboShared.STANCE_SLIDE,
        enemyComboShared.SLIDE_PHASE_GROUND,
        enemyComboShared.SLIDE_IFRAME_TICKS + 1,
      ),
    ).toBe(false);
    expect(
      enemyComboShared.slideContactInvulnerable(
        enemyComboShared.STANCE_SLIDE,
        enemyComboShared.SLIDE_PHASE_LAND_WINDOW,
        0,
      ),
    ).toBe(false);
  });

  it("leads negotiated combo landings by fast slide velocity before freezing the promise", () => {
    const { h, player } = makeEnemyComboRoom(1);
    const enemy = addComboEnemy(h, player, "slide-lead-leaper", "vault-ronin", 300);
    player.mvx = enemyComboShared.SLIDE_SPEED_CAP;
    player.mvy = 0;
    player.vx = 0;
    player.vy = 0;
    const st: AnyRoom = { phase: "idle", t: 0, hits: 0, wind: 0 };
    h.room.comboState.set(enemy.id, st);
    const random = vi.spyOn(Math, "random").mockReturnValue(0);
    try {
      h.room.commitCombo(enemy, enemy.id, ENEMY_KINDS[enemy.kind], st, player, true);
    } finally {
      random.mockRestore();
    }
    const row = h.state().telegraphs.get(st.tg);
    expect(st.negotiatedTargetX - player.x).toBeCloseTo(140, 8);
    expect(st.negotiatedTargetY).toBeCloseTo(player.y, 8);
    expect(row.x - player.x).toBeCloseTo(250, 8);
  });

  it("stamps schema 23 on the room and initializes the appended momentum state", () => {
    const fixture = makeSlideRoom("slide-schema-23");
    expect(fixture.h.state().schemaVersion).toBe(23);
    expect(enemyComboShared.SCHEMA_VERSION).toBe(23);
    expect([
      fixture.player.momentumX,
      fixture.player.momentumY,
      fixture.player.slidePhase,
      fixture.player.slidePhaseTick,
    ]).toEqual([0, 0, 0, 0]);
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
    expect(fixture.player.x).toBeGreaterThan(lip);
    expect(isPitAtPx(map, fixture.player.x, fixture.player.y)).toBe(true);
    expect(fixture.player.height).toBeGreaterThan(0);
    expect(fixture.player.fellSeq).toBe(fell);
  });

  it("launches a ready buffered slide-hop before its same-tick lip movement and pit sample", () => {
    const fixture = makeSlideRoom("qol-slide-hop-lip");
    beginSlide(fixture);
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
    sendSlideInput(fixture.h, fixture.player.id, 2, {
      dx: 1,
      jump: true,
      slideHeld: true,
    });
    expect(fixture.player.x).toBeGreaterThan(lip);
    expect(isPitAtPx(map, fixture.player.x, fixture.player.y)).toBe(true);
    expect(fixture.combat.slidePhase).toBe(enemyComboShared.SLIDE_PHASE_AIR);
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
