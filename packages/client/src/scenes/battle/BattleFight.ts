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
import { WEAPONS, weaponDisplaySpriteId, classifyParryIncidence } from "@dd/shared";
import { ensureWholeArtCharacterTextures } from "../../sprites/whole-art-character.js";
import { BATTLE_ROSTER } from "./battle-roster.js";
import { BattleSim, MIDLINE_X, type BattleEvent, type Unit } from "./battle-sim.js";

/**
 * Draws the slice-1 fight. Owns NO rules — every number it renders comes from `BattleSim`, which is
 * pure and testable. If something behaves wrong, the bug is in the sim; if something looks wrong, it
 * is in here.
 *
 * Reuses the existing presentation stack wholesale: `SpriteRig` for the whole-art characters, the real
 * weapon catalog with its lazy art loader, and B26's directional parry poses. Nothing here is bespoke
 * art — the question this slice asks is whether the assets the project already owns are fun in this
 * shape, and new art would only muddy the answer.
 */

/** Characters are authored against a ~1280-wide arena; this stage is 3840 across, so they need roughly
 *  3x to read at the same on-screen size once the stage letterboxes down. */
const RIG_SCALE = 3.6;

/**
 * How far above a unit's feet its bar and name sit, in canvas px.
 *
 * Must stay BELOW the roster's 180px lane spacing or a nameplate floats nearer the unit in the row behind
 * it than its own — a live capture at 310 had the front rank's bars reading as the middle rank's.
 */
const NAMEPLATE_RISE = 240;

/** Team accents. Deliberately not red/blue — the ruin is green, so the sides are warm vs cold. */
const TEAM_COLOR = [0xffc266, 0x8fd4ff] as const;
const ROLE_LABEL: Record<string, string> = {
  vanguard: "VANGUARD",
  medic: "MEDIC",
  ranged: "RANGED",
};

interface RigEntry {
  readonly rig: SpriteRig;
  readonly unit: Unit;
  /** One reused pose sample per actor — allocating a fresh one per frame is what the presentation
   *  layer was explicitly restructured to avoid. */
  readonly presented: PresentedActorState;
  /** Resolved once the weapon's sliced art finishes loading. */
  equipped: boolean;
  deadPopped: boolean;
  /** Gate for the hit/heal tint — see `flashOnce`. */
  flashReadyAtMs: number;
}

export class BattleFight {
  readonly sim = new BattleSim(BATTLE_ROSTER);

  private readonly scene: Phaser.Scene;
  private readonly rigLayer: Phaser.GameObjects.Container;
  private readonly fxLayer: Phaser.GameObjects.Graphics;
  private readonly hudLayer: Phaser.GameObjects.Container;
  private readonly entries: RigEntry[] = [];
  private readonly labels = new Map<string, Phaser.GameObjects.Text>();
  private readonly pendingArt = new Set<string>();
  private readonly failedArt = new Set<string>();
  private readonly bannerText: Phaser.GameObjects.Text;
  /** The rigs' single frame clock — gait, springs and mechanisms all read this one source. */
  private readonly frameClock = new PresentationFrameClock();
  private frame: PresentationFrame;
  private clockMs = 0;
  /** Fades in only while somebody is being thrown back, so the boundary stays invisible until it bites. */
  private midlineFlash = 0;

  /**
   * Queue every texture the fight needs during the scene's own preload, so `create` can build rigs
   * against textures that already exist. `ensureWholeArtCharacterTextures` is explicit that callers must
   * wait for `ready` before constructing a rig — otherwise Phaser paints a boilerplate placeholder and
   * the character silently renders as the wrong art.
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
      .text(MIDLINE_X, 220, "", {
        fontFamily: "monospace",
        fontSize: "72px",
        color: "#ffffff",
      })
      .setOrigin(0.5)
      .setAlpha(0);
    this.hudLayer.add(this.bannerText);
  }

  update(deltaMs: number): void {
    const dt = Math.min(deltaMs, 50); // a stalled tab must not teleport the fight
    this.clockMs += dt;
    this.frame = this.frameClock.advance(this.scene.time.now, dt, true);
    this.sim.step(dt);

    for (const event of this.sim.takeEvents()) this.playEvent(event);
    for (const entry of this.entries) this.syncRig(entry, dt);

    this.rigLayer.sort("depth");
    this.drawEffects();
    this.drawLabels();
    this.drawBanner();
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

    // Gait comes from ACTUAL rendered movement, exactly as ArenaScene derives it — so a unit walking
    // to a new stance animates, and one holding position stands still.
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
    pose.isSelf = false;
    pose.jumpVh = 0;
    rig.animate(pose);
    rig.setDepth(unit.y);
  }

  /**
   * Lazy-load a weapon's sliced parts, on the same contract players and enemies use. The expansion
   * arsenal is not boot-loaded, so equipping at construction would draw Phaser's `__MISSING` box
   * forever — the exact bug that made cultist weapons invisible in the arena.
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
  // Events → animation
  // -------------------------------------------------------------------------------------------

  private playEvent(event: BattleEvent): void {
    const entry =
      "unitId" in event ? this.entries.find((e) => e.unit.spec.id === event.unitId) : undefined;
    switch (event.type) {
      case "attack": {
        const target = this.sim.unit(event.targetId);
        const aim = target ? Math.atan2(target.y - entry!.unit.y, target.x - entry!.unit.x) : 0;
        entry?.rig.triggerSwing(this.clockMs, aim);
        break;
      }
      case "parry": {
        // B26's directional parry, reused exactly: the incidence classifier picks which of the three
        // authored guard reactions plays, so a bolt from the left braces differently from one from above.
        const reaction = classifyParryIncidence(event.fromX, event.fromY);
        entry?.rig.triggerParrySuccess(this.clockMs, 1, reaction);
        this.midlineFlash = Math.max(this.midlineFlash, 0.35);
        break;
      }
      case "hit":
        if (entry) this.flashOnce(entry, 0xff5555);
        break;
      case "heal": {
        const patient = this.entries.find((e) => e.unit.spec.id === event.targetId);
        if (patient) this.flashOnce(patient, 0x66ffcc);
        break;
      }
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
   * the entire fight. The gate guarantees off-time between pops, which is what makes a flash read as a
   * flash at all.
   */
  private flashOnce(entry: RigEntry, color: number): void {
    if (this.clockMs < entry.flashReadyAtMs) return;
    entry.flashReadyAtMs = this.clockMs + 230;
    entry.rig.flash(90, color);
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
      g.lineBetween(MIDLINE_X, 900, MIDLINE_X, 1500);
    }

    for (const shot of this.sim.projectiles) {
      const target = this.sim.unit(shot.targetId);
      // THE most important read in the fight (design log): rank bolts by consequence, not by count.
      // A faint line to the intended victim is what turns "three bolts" into "that one's for your medic".
      if (target?.alive) {
        g.lineStyle(3, TEAM_COLOR[shot.team] ?? 0xffffff, 0.16);
        g.lineBetween(shot.x, shot.y, target.x, target.y);
      }
      g.fillStyle(TEAM_COLOR[shot.team] ?? 0xffffff, 0.9);
      g.fillCircle(shot.x, shot.y, 13);
      g.fillStyle(0xffffff, 0.5);
      g.fillCircle(shot.x, shot.y, 6);
    }

    for (const unit of this.sim.units) {
      if (!unit.alive) continue;
      const width = 150;
      const x = unit.x - width / 2;
      const y = unit.y - NAMEPLATE_RISE;
      g.fillStyle(0x000000, 0.55);
      g.fillRect(x - 3, y - 3, width + 6, 20);
      g.fillStyle(TEAM_COLOR[unit.spec.team] ?? 0xffffff, 0.95);
      g.fillRect(x, y, width * (unit.hp / unit.spec.maxHp), 14);
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
      // Stance is shown as an arrow because it is the only decision a unit makes and the owner needs to
      // see it being made — an autobattler you cannot read is just a screensaver.
      const arrow = unit.stance === "forward" ? "▲" : unit.stance === "back" ? "▼" : "■";
      label.setText(`${unit.spec.name}  ${arrow}\n${ROLE_LABEL[unit.spec.role] ?? ""}`);
      label.setPosition(unit.x, unit.y - NAMEPLATE_RISE - 10);
      label.setColor(unit.slung ? "#ff9090" : "#ffffff");
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
    this.bannerText.setText(winner === 0 ? "DRIFTERS HOLD THE RUIN" : "WARDENS HOLD THE RUIN");
  }

  destroy(): void {
    for (const entry of this.entries) entry.rig.destroy();
    this.rigLayer.destroy(true);
    this.fxLayer.destroy();
    this.hudLayer.destroy(true);
  }
}
