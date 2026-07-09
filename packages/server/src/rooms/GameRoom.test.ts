import {
  beltLevelFor,
  beltPitAtX,
  BELT_Y0,
  CRIT_MULT,
  critChanceFor,
  DEFAULT_WEAPON,
  DEPTH_MAX,
  DROP_POOL,
  DUMMY_HP,
  ENEMY_KINDS,
  EnemyState,
  FISTS_WEAPON,
  getDimension,
  isPitAtPx,
  makeRng,
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
        "plantedAlive": 2,
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
            "hp": 88,
            "id": "p2",
            "level": 1,
            "x": 2440,
            "y": 2312,
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

// Re-seed nothing between files — each makeRoom() is independent.
beforeEach(() => {});
