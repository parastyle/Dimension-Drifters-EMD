import Phaser from "phaser";
import { SPRITES } from "../../sprites/manifest.js";
import { SpriteRig } from "../../entities/SpriteRig.js";
import { partTexture } from "../../entities/rig/rig-core.js";
import {
  PresentationFrameClock,
  createPresentedActorState,
  type PresentationFrame,
  type PresentedActorState,
} from "../../entities/rig/rig-presentation.js";
import { WEAPONS, weaponDisplaySpriteId, classifyParryIncidence, randomSeed } from "@dd/shared";
import { AudioBus } from "../../audio/AudioBus.js";
import { ensureWholeArtCharacterTextures } from "../../sprites/whole-art-character.js";
import { BATTLE_ROSTER, PLAYER_TEAM } from "./battle-roster.js";
import { BattleSim, MIDLINE_X, type BattleEvent, type Unit } from "./battle-sim.js";

/**
 * Draws the slice-1 fight and routes the player's input into it.
 *
 * Owns NO rules — every number it renders comes from `BattleSim`, which is pure and testable. If something
 * behaves wrong the bug is in the sim; if something looks wrong it is in here.
 *
 * Reuses the existing presentation stack wholesale: `SpriteRig` for the whole-art characters, the real
 * weapon catalog with its lazy art loader, B26's directional parry poses, and the shared `AudioBus`.
 */

/**
 * Characters are authored against a ~1200-wide arena; this stage is 3840 across, so they need roughly 3x to
 * read at a comparable on-screen size once the stage letterboxes down.
 *
 * Weapon size needs no correction here. `setRigScale` scales the rig's root container and nothing anywhere
 * compensates for it, so the weapon-to-character ratio is scale-invariant — identical to the arena at any
 * value of this constant.
 */
const RIG_SCALE = 3.2;

/**
 * How far above a unit's feet its bar and name sit, in canvas px. Must stay BELOW the roster's 180px lane
 * spacing or a nameplate floats nearer the unit in the row behind it than its own.
 */
const NAMEPLATE_RISE = 240;

/** Team accents. Deliberately not red/blue — the ruin is green, so the sides are warm vs cold. */
const TEAM_COLOR = [0xffc266, 0x8fd4ff] as const;
const ROLE_LABEL: Record<string, string> = {
  vanguard: "VANGUARD",
  medic: "MEDIC",
  ranged: "RANGED",
};

/** Frozen presentation time after a moment worth feeling. Short — hit-stop reads as weight, not as lag. */
const HIT_STOP_DEATH_MS = 150;
const HIT_STOP_PLAYER_PARRY_MS = 110;

interface RigEntry {
  readonly rig: SpriteRig;
  readonly unit: Unit;
  /** One reused pose sample per actor — allocating a fresh one per frame is what the presentation layer
   *  was explicitly restructured to avoid. */
  readonly presented: PresentedActorState;
  equipped: boolean;
  deadPopped: boolean;
  /** Gate for the hit/heal tint — see `flashOnce`. */
  flashReadyAtMs: number;
}

interface FloatingNumber {
  readonly text: Phaser.GameObjects.Text;
  x: number;
  y: number;
  ageMs: number;
}

export class BattleFight {
  readonly sim: BattleSim;

  private readonly scene: Phaser.Scene;
  private readonly rigLayer: Phaser.GameObjects.Container;
  private readonly fxLayer: Phaser.GameObjects.Graphics;
  private readonly hudLayer: Phaser.GameObjects.Container;
  private readonly entries: RigEntry[] = [];
  private readonly labels = new Map<string, Phaser.GameObjects.Text>();
  private readonly pendingArt = new Set<string>();
  private readonly failedArt = new Set<string>();
  private readonly floaters: FloatingNumber[] = [];
  private readonly floaterPool: Phaser.GameObjects.Text[] = [];
  private readonly bannerText: Phaser.GameObjects.Text;
  private readonly statusText: Phaser.GameObjects.Text;
  private readonly frameClock = new PresentationFrameClock();
  private readonly audio = new AudioBus();
  private keys?: {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
    guard: Phaser.Input.Keyboard.Key;
  };
  private frame: PresentationFrame;
  private clockMs = 0;
  private hitStopMs = 0;
  /** Fades in only while somebody is being thrown back, so the boundary stays invisible until it bites. */
  private midlineFlash = 0;

  /**
   * Queue every texture the fight needs during the scene's own preload, so `create` can build rigs against
   * textures that already exist. `ensureWholeArtCharacterTextures` is explicit that callers must wait for
   * `ready` before constructing a rig — otherwise Phaser paints a boilerplate placeholder and the character
   * silently renders as the wrong art.
   */
  static preload(scene: Phaser.Scene): void {
    for (const spec of BATTLE_ROSTER) {
      ensureWholeArtCharacterTextures(scene, spec.spriteId);
      const def = WEAPONS[spec.weaponId];
      if (!def) continue;
      const spriteId = weaponDisplaySpriteId(def);
      const manifest = SPRITES[spriteId as keyof typeof SPRITES];
      if (!manifest) continue;
      for (const part of manifest.parts) {
        const key = `${spriteId}:${part.role}`;
        if (!scene.textures.exists(key)) {
          scene.load.image(key, `sprites/${spriteId}/${part.file}`);
        }
      }
    }
  }

  constructor(scene: Phaser.Scene, actorLayer: Phaser.GameObjects.Container) {
    this.scene = scene;
    // A fresh seed every fight, so what you watch is a fight rather than a recording. The seed is shown in
    // the HUD and `BattleSim` is fully deterministic from it, so an interesting one can be replayed.
    this.sim = new BattleSim(BATTLE_ROSTER, randomSeed());

    this.rigLayer = scene.add.container(0, 0);
    this.fxLayer = scene.add.graphics();
    this.hudLayer = scene.add.container(0, 0);
    actorLayer.add([this.rigLayer, this.fxLayer, this.hudLayer]);
    this.frame = this.frameClock.advance(scene.time.now, 16, true);

    for (const unit of this.sim.units) {
      const rig = new SpriteRig(scene, unit.x, unit.y, false, unit.spec.id, unit.spec.spriteId);
      rig.setRigScale(RIG_SCALE);
      this.rigLayer.add(rig.root);
      const presented = createPresentedActorState(this.frame);
      presented.actorId = unit.spec.id;
      presented.weaponId = unit.spec.weaponId;
      this.entries.push({
        rig,
        unit,
        presented,
        equipped: false,
        deadPopped: false,
        flashReadyAtMs: 0,
      });

      const label = scene.add
        .text(unit.x, unit.y, "", {
          fontFamily: "monospace",
          fontSize: "26px",
          color: "#ffffff",
          align: "center",
        })
        .setOrigin(0.5, 1);
      this.hudLayer.add(label);
      this.labels.set(unit.spec.id, label);
    }

    this.bannerText = scene.add
      .text(MIDLINE_X, 220, "", { fontFamily: "monospace", fontSize: "72px", color: "#ffffff" })
      .setOrigin(0.5)
      .setAlpha(0);
    // Sits clear of the foreground vine overlay, which draws over the bottom corners, and carries a heavy
    // stroke because it reads against whatever the stage happens to have there.
    this.statusText = scene.add
      .text(MIDLINE_X, 1985, "", {
        fontFamily: "monospace",
        fontSize: "32px",
        color: "#f2f6f9",
        align: "center",
        stroke: "#05070a",
        strokeThickness: 7,
      })
      .setOrigin(0.5, 1);
    this.hudLayer.add([this.bannerText, this.statusText]);

    this.bindInput();
  }

  // -------------------------------------------------------------------------------------------
  // Input / takeover
  // -------------------------------------------------------------------------------------------

  private bindInput(): void {
    const keyboard = this.scene.input.keyboard;
    if (!keyboard) return;
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = {
      up: keyboard.addKey(K.W),
      down: keyboard.addKey(K.S),
      left: keyboard.addKey(K.A),
      right: keyboard.addKey(K.D),
      guard: keyboard.addKey(K.SPACE),
    };
    // Space would otherwise scroll the page while guarding.
    keyboard.addCapture([K.SPACE, K.W, K.A, K.S, K.D]);

    const squad = BATTLE_ROSTER.filter((spec) => spec.team === PLAYER_TEAM);
    squad.forEach((spec, index) => {
      keyboard.on(`keydown-${["ONE", "TWO", "THREE", "FOUR"][index]}`, () => {
        const unit = this.sim.unit(spec.id);
        if (!unit?.alive) return;
        this.sim.setControlled(unit.controlled ? undefined : spec.id);
      });
    });
    keyboard.on("keydown-ESC", () => this.sim.setControlled(undefined));
  }

  private pumpInput(): void {
    const controlled = this.sim.controlled;
    if (!controlled || !this.keys) {
      this.sim.setIntent(0, 0, false);
      return;
    }
    const { up, down, left, right, guard } = this.keys;
    this.sim.setIntent(
      (right.isDown ? 1 : 0) - (left.isDown ? 1 : 0),
      (down.isDown ? 1 : 0) - (up.isDown ? 1 : 0),
      guard.isDown,
    );
  }

  // -------------------------------------------------------------------------------------------

  update(deltaMs: number): void {
    const raw = Math.min(deltaMs, 50); // a stalled tab must not teleport the fight

    // Hit-stop freezes the SIM and the presentation clock together. `PresentationFrameClock` takes a
    // `running` flag for exactly this, so springs and gait resume where they left off instead of snapping.
    if (this.hitStopMs > 0) {
      this.hitStopMs = Math.max(0, this.hitStopMs - raw);
      this.frame = this.frameClock.advance(this.scene.time.now, raw, false);
      for (const entry of this.entries) entry.rig.animate(entry.presented);
      return;
    }

    this.clockMs += raw;
    this.frame = this.frameClock.advance(this.scene.time.now, raw, true);
    this.pumpInput();
    this.sim.step(raw);

    for (const event of this.sim.takeEvents()) this.playEvent(event);
    for (const entry of this.entries) this.syncRig(entry, raw);
    this.stepFloaters(raw);

    this.rigLayer.sort("depth");
    this.drawEffects();
    this.drawLabels();
    this.drawBanner();
    this.drawStatus();
  }

  // -------------------------------------------------------------------------------------------
  // Rigs
  // -------------------------------------------------------------------------------------------

  private syncRig(entry: RigEntry, deltaMs: number): void {
    const { rig, unit } = entry;
    if (!unit.alive) {
      if (!entry.deadPopped) {
        entry.deadPopped = true;
        rig.deathPop(unit.spec.team === 0 ? -120 : 120, -180, "crumple");
      }
      rig.stepDeathPop(deltaMs);
      return;
    }

    this.ensureWeapon(entry);
    rig.setPosition(unit.x, unit.y);

    // Gait comes from ACTUAL rendered movement, exactly as ArenaScene derives it — so a unit walking to a
    // new stance animates, and one holding position stands still.
    const invDt = deltaMs > 0 ? 1000 / deltaMs : 0;
    let moveX = rig.x - rig.renderPrevX;
    let moveY = rig.y - rig.renderPrevY;
    const speed = Math.hypot(moveX, moveY) * invDt;
    const length = Math.hypot(moveX, moveY);
    if (length > 0.001) {
      moveX /= length;
      moveY /= length;
    } else {
      moveX = 0;
      moveY = 0;
    }
    rig.renderPrevX = rig.x;
    rig.renderPrevY = rig.y;

    // Everyone faces the midline: team 0 looks right, team 1 looks left. `aimDxPx` is what commits the
    // sprite flip, so it must be a real horizontal offset, not a normalized axis.
    const facing = unit.spec.team === 0 ? 1 : -1;
    const pose = entry.presented;
    pose.frame = this.frame;
    pose.rootX = unit.x;
    pose.rootY = unit.y;
    pose.hp = unit.hp;
    pose.alive = true;
    pose.moveX = moveX;
    pose.moveY = moveY;
    pose.speed = speed;
    pose.aimX = facing;
    pose.aimY = 0;
    pose.aimDxPx = facing * 1000;
    pose.aimDir = facing === 1 ? 0 : Math.PI;
    pose.isSelf = unit.controlled;
    pose.jumpVh = 0;
    rig.animate(pose);
    rig.setDepth(unit.y);
  }

  /**
   * Lazy-load a weapon's sliced parts, on the same contract players and enemies use. The expansion arsenal
   * is not boot-loaded, so equipping at construction would draw Phaser's `__MISSING` box forever — the
   * exact bug that made cultist weapons invisible in the arena.
   */
  private ensureWeapon(entry: RigEntry): void {
    if (entry.equipped) return;
    const def = WEAPONS[entry.unit.spec.weaponId];
    if (!def) return;
    const spriteId = weaponDisplaySpriteId(def);
    const manifest = SPRITES[spriteId as keyof typeof SPRITES];
    if (!manifest || this.failedArt.has(spriteId)) {
      entry.equipped = true; // no art authored — fight on with empty hands rather than retrying forever
      return;
    }
    const ready = manifest.parts.every((part) =>
      this.scene.textures.exists(partTexture(this.scene, spriteId, part.role).key),
    );
    if (ready) {
      entry.rig.equipWeapon(spriteId, def, manifest);
      entry.equipped = true;
      return;
    }
    if (this.pendingArt.has(spriteId)) return;
    this.pendingArt.add(spriteId);
    for (const part of manifest.parts) {
      this.scene.load.image(`${spriteId}:${part.role}`, `sprites/${spriteId}/${part.file}`);
    }
    this.scene.load.once(Phaser.Loader.Events.COMPLETE, () => {
      if (manifest.parts.some((p) => !this.scene.textures.exists(`${spriteId}:${p.role}`))) {
        this.failedArt.add(spriteId);
        console.warn(`[dd] battle weapon art failed to load: ${spriteId}`);
      }
    });
    this.scene.load.start();
  }

  // -------------------------------------------------------------------------------------------
  // Events → animation, sound, numbers
  // -------------------------------------------------------------------------------------------

  private playEvent(event: BattleEvent): void {
    const entry =
      "unitId" in event ? this.entries.find((e) => e.unit.spec.id === event.unitId) : undefined;
    switch (event.type) {
      case "attack": {
        const target = this.sim.unit(event.targetId);
        const source = entry?.unit;
        const aim =
          target && source ? Math.atan2(target.y - source.y, target.x - source.x) : 0;
        entry?.rig.triggerSwing(this.clockMs, aim);
        break;
      }
      case "parry": {
        // B26's directional parry, reused exactly: the incidence classifier picks which of the three
        // authored guard reactions plays, so a bolt from the left braces differently from one from above.
        const reaction = classifyParryIncidence(event.fromX, event.fromY);
        entry?.rig.triggerParrySuccess(this.clockMs, 1, reaction);
        this.midlineFlash = Math.max(this.midlineFlash, 0.35);
        this.audio.play("parry", { x: entry?.unit.x, amt: 0.7 });
        // Only the PLAYER's own parry earns hit-stop. The AI parries several times a second, and freezing
        // for each would turn the whole fight into a stutter.
        if (event.byPlayer) {
          this.hitStopMs = HIT_STOP_PLAYER_PARRY_MS;
          if (entry) this.spawnNumber(entry.unit.x, entry.unit.y - 300, "PARRY", "#8fd4ff");
        }
        break;
      }
      case "hit":
        if (entry) {
          this.flashOnce(entry, 0xff5555);
          this.spawnNumber(entry.unit.x, entry.unit.y - 260, `${event.amount}`, "#ff8f8f");
          this.audio.play("hit", { x: entry.unit.x, amt: 0.4 });
        }
        break;
      case "heal": {
        const patient = this.entries.find((e) => e.unit.spec.id === event.targetId);
        if (patient) {
          this.flashOnce(patient, 0x66ffcc);
          this.spawnNumber(patient.unit.x, patient.unit.y - 260, `+${event.amount}`, "#8effcf");
        }
        break;
      }
      case "death":
        this.hitStopMs = HIT_STOP_DEATH_MS;
        this.audio.play("death", { x: entry?.unit.x, amt: 0.8 });
        break;
      default:
        break;
    }
  }

  /**
   * Hit/heal tint, rate-limited so it always gets to clear.
   *
   * `SpriteRig.flash` fills the whole silhouette and each new call cancels the previous expiry — correct
   * for the arena, where a hit is occasional. Here a vanguard eats several bolts plus melee every second,
   * so the tint was re-armed before it ever expired and both tanks rendered as flat coloured cut-outs for
   * the entire fight. The gate guarantees off-time, which is what makes a flash read as a flash.
   */
  private flashOnce(entry: RigEntry, color: number): void {
    if (this.clockMs < entry.flashReadyAtMs) return;
    entry.flashReadyAtMs = this.clockMs + 230;
    entry.rig.flash(90, color);
  }

  private spawnNumber(x: number, y: number, body: string, color: string): void {
    const text =
      this.floaterPool.pop() ??
      this.scene.add
        .text(0, 0, "", { fontFamily: "monospace", fontSize: "40px", fontStyle: "bold" })
        .setOrigin(0.5);
    text.setText(body).setColor(color).setAlpha(1).setVisible(true).setPosition(x, y);
    this.hudLayer.add(text);
    this.floaters.push({ text, x, y, ageMs: 0 });
  }

  private stepFloaters(deltaMs: number): void {
    const lifeMs = 700;
    for (let i = this.floaters.length - 1; i >= 0; i -= 1) {
      const floater = this.floaters[i];
      if (!floater) continue;
      floater.ageMs += deltaMs;
      const t = floater.ageMs / lifeMs;
      if (t >= 1) {
        floater.text.setVisible(false);
        this.floaterPool.push(floater.text);
        this.floaters.splice(i, 1);
        continue;
      }
      floater.text.setPosition(floater.x, floater.y - t * 120);
      floater.text.setAlpha(1 - t * t);
    }
  }

  // -------------------------------------------------------------------------------------------
  // Effects + HUD
  // -------------------------------------------------------------------------------------------

  private drawEffects(): void {
    const g = this.fxLayer;
    g.clear();

    // The boundary is invisible until it acts on somebody — then it briefly shows itself.
    const slinging = this.sim.units.some((u) => u.alive && u.slung);
    this.midlineFlash = slinging
      ? Math.min(1, this.midlineFlash + 0.08)
      : Math.max(0, this.midlineFlash - 0.03);
    if (this.midlineFlash > 0.01) {
      g.lineStyle(6, 0xffffff, this.midlineFlash * 0.35);
      g.lineBetween(MIDLINE_X, 900, MIDLINE_X, 1900);
    }

    for (const shot of this.sim.projectiles) {
      const target = this.sim.unit(shot.targetId);
      // THE most important read in the fight (design log): rank bolts by consequence, not by count. A faint
      // line to the intended victim turns "three bolts" into "that one's for your medic".
      if (target?.alive) {
        g.lineStyle(3, TEAM_COLOR[shot.team] ?? 0xffffff, target.controlled ? 0.4 : 0.16);
        g.lineBetween(shot.x, shot.y, target.x, target.y);
      }
      g.fillStyle(TEAM_COLOR[shot.team] ?? 0xffffff, 0.9);
      g.fillCircle(shot.x, shot.y, 13);
      g.fillStyle(0xffffff, 0.5);
      g.fillCircle(shot.x, shot.y, 6);
    }

    const controlled = this.sim.controlled;
    if (controlled) {
      // Ring under the unit you drive, plus its live parry reach while guarding — the reach is the whole
      // skill, so it must be visible rather than memorised.
      g.lineStyle(5, 0xffffff, 0.5);
      g.strokeEllipse(controlled.x, controlled.y, 150, 60);
      if (this.sim.snapshot().elapsedMs >= controlled.parryReadyAtMs && this.keys?.guard.isDown) {
        g.lineStyle(4, 0x8fd4ff, 0.55);
        g.strokeCircle(controlled.x, controlled.y, controlled.spec.stats.parryReach);
      }
    }

    for (const unit of this.sim.units) {
      if (!unit.alive) continue;
      const width = 150;
      const x = unit.x - width / 2;
      const y = unit.y - NAMEPLATE_RISE;
      g.fillStyle(0x000000, 0.55);
      g.fillRect(x - 3, y - 3, width + 6, 20);
      g.fillStyle(TEAM_COLOR[unit.spec.team] ?? 0xffffff, 0.95);
      g.fillRect(x, y, width * (unit.hp / unit.spec.stats.maxHp), 14);
    }
  }

  private drawLabels(): void {
    for (const unit of this.sim.units) {
      const label = this.labels.get(unit.spec.id);
      if (!label) continue;
      if (!unit.alive) {
        label.setVisible(false);
        continue;
      }
      // Stance is shown as an arrow because it is the only decision an AI unit makes and it needs to be
      // readable — an autobattler you cannot read is a screensaver.
      const arrow = unit.stance === "forward" ? "▲" : unit.stance === "back" ? "▼" : "■";
      const role = ROLE_LABEL[unit.spec.role] ?? "";
      label.setText(
        unit.controlled ? `${unit.spec.name}  ◆YOU\n${role}` : `${unit.spec.name}  ${arrow}\n${role}`,
      );
      label.setPosition(unit.x, unit.y - NAMEPLATE_RISE - 10);
      label.setColor(unit.controlled ? "#8fd4ff" : unit.slung ? "#ff9090" : "#ffffff");
    }
  }

  private drawBanner(): void {
    const { winner, beatIndex } = this.sim.snapshot();
    if (winner === undefined) {
      this.bannerText.setAlpha(0.4);
      this.bannerText.setText(`BEAT ${beatIndex}`);
      return;
    }
    this.bannerText.setAlpha(1);
    this.bannerText.setText(winner === PLAYER_TEAM ? "DRIFTERS HOLD THE RUIN" : "WARDENS HOLD THE RUIN");
  }

  private drawStatus(): void {
    const squad = BATTLE_ROSTER.filter((spec) => spec.team === PLAYER_TEAM);
    const roster = squad
      .map((spec, index) => {
        const unit = this.sim.unit(spec.id);
        if (!unit?.alive) return `${index + 1}:${spec.name}✝`;
        return unit.controlled ? `[${index + 1}:${spec.name}]` : `${index + 1}:${spec.name}`;
      })
      .join("  ");
    const controlled = this.sim.controlled;
    const drive = controlled
      ? "WASD move · SPACE hold guard · ESC release"
      : "press 1-4 to take over a Drifter";
    const buffer = `${this.scene.scale.width}x${this.scene.scale.height}`;
    this.statusText.setText(`${roster}\n${drive}\nR restart · F 4K widescreen · buffer ${buffer} · seed ${this.sim.seed}`);
  }

  destroy(): void {
    for (const entry of this.entries) entry.rig.destroy();
    this.rigLayer.destroy(true);
    this.fxLayer.destroy();
    this.hudLayer.destroy(true);
  }
}
