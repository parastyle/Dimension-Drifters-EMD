import type { WeaponDef } from "@dd/shared";
import Phaser from "phaser";
import { SPRITES, type SpriteManifest } from "../sprites/manifest.js";

/** On-screen height of the body part, in px. Everything else scales from this. (tuning) */
const TARGET_BODY_H = 84;
/** Vertical "look" toward the cursor (local player): how far the torso leans + the held weapon tilts
 *  with the aim's up/down. Subtle by design — "to some degree". (tuning) */
const BODY_LOOK_LEAN = 0.14;
const WEAPON_LOOK_TILT = 0.6;

export interface RigAnim {
  /** Movement direction this frame (≈0 length when idle). */
  moveX: number;
  moveY: number;
  /** Aim direction toward the cursor (local player only). */
  aimX: number;
  aimY: number;
  /** §9 synced aim angle (radians) — points a REMOTE player's gun (the local player uses aimX/aimY). */
  aimDir: number;
  isSelf: boolean;
  /** §20 momentum (Stage A): the impulse velocity (px/s) shoving the body — drives a lean/jolt flinch.
   *  Optional (enemies have no momentum); defaults to 0. */
  recoilX?: number;
  recoilY?: number;
}

/**
 * Sliced-procedural character/enemy rig (§18, §28.11). Renders a subject's harvest-sliced
 * parts (body + detached hands/feet, cut by tools/artkit/guards/slice.mjs) as separate
 * sprites in a container, then drives them with PURELY PROCEDURAL animation — bob, squash,
 * lean, independent hand/foot drift, walk shuffle, side-profile facing flip, and the front
 * hand reaching toward the cursor (the weapon anchor, §9). No frame animation (§18).
 *
 * Cosmetic + client-side only: decoupled from the authoritative sim (§14), so it can desync
 * harmlessly. The container position is driven by synced state; everything inside is flavour.
 * Works for any build — hands-only floaters and pure blobs just have fewer parts.
 */
export class SpriteRig {
  readonly root: Phaser.GameObjects.Container;
  private readonly scene: Phaser.Scene;
  private readonly scale: number;
  /** Rig-level UNIFORM scale multiplier (tough/boss size-up). Applied to BOTH axes every frame so
   *  the facing flip never stretches the sprite — art keeps its painted aspect ratio (§28.4). */
  private baseScale = 1;
  private readonly body: Phaser.GameObjects.Image;
  private readonly hands: {
    img: Phaser.GameObjects.Image;
    ox: number;
    oy: number;
    front: boolean;
  }[] = [];
  private readonly feet: { img: Phaser.GameObjects.Image; ox: number; oy: number }[] = [];
  private readonly parts: Phaser.GameObjects.Image[] = [];
  private readonly label?: Phaser.GameObjects.Text;
  private readonly phase: number;
  private facing = 1;
  /** Held weapon piece(s) — one per hand (dual-wield = two). Live INSIDE the container so the
   *  hand renders over the hilt and the facing-flip applies automatically. */
  private weapons: {
    img: Phaser.GameObjects.Image;
    hand: { img: Phaser.GameObjects.Image; ox: number; oy: number };
  }[] = [];
  private weaponDef?: WeaponDef;
  private swingStart = -1e9;
  /** §20 world-space aim (radians) captured at swing-start, so the blade sweeps the server's swept arc. */
  private swingAimWorld = Number.NaN;
  private braceStart = -1e9;
  /** §5 jump: px the rendered art is lifted this frame (the hop arc). The container stays grounded so
   *  the camera + depth-sort use the ground position; only the visible parts rise. */
  private hopPx = 0;
  /** §5/§20 ground shadow — stays grounded while the art lifts, so the gap reads as HEIGHT (jump /
   *  parry-launch / death-pop). Shrinks + fades as the rig rises. */
  private readonly shadow: Phaser.GameObjects.Ellipse;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    isSelf: boolean,
    id: string,
    spriteId: string,
  ) {
    const manifest = SPRITES[spriteId as keyof typeof SPRITES] as SpriteManifest | undefined;
    if (!manifest) throw new Error(`SpriteRig: no sprite manifest for "${spriteId}"`);
    this.scene = scene;
    this.scale = TARGET_BODY_H / manifest.body.h;

    // Build parts. Draw order (back→front): back hand, feet, body, front hand. The front
    // hand is the one on the side the art faces (right = +x); the other tucks behind.
    const make = (role: string): Phaser.GameObjects.Image | undefined => {
      const part = manifest.parts.find((p) => p.role === role);
      if (!part) return undefined;
      const img = scene.add.image(
        part.ox * this.scale,
        part.oy * this.scale,
        `${spriteId}:${role}`,
      );
      img.setOrigin(0.5).setScale(this.scale);
      this.parts.push(img);
      return img;
    };

    // Hands + feet first; the body is resolved separately so it always lands mid-stack
    // (and so we never double-create it from the parts loop).
    for (const p of manifest.parts) {
      if (p.role.startsWith("hand")) {
        const img = make(p.role);
        if (img)
          this.hands.push({ img, ox: p.ox * this.scale, oy: p.oy * this.scale, front: p.ox >= 0 });
      } else if (p.role.startsWith("foot")) {
        const img = make(p.role);
        if (img) this.feet.push({ img, ox: p.ox * this.scale, oy: p.oy * this.scale });
      }
    }
    const bodyImg = make("body");
    if (!bodyImg) throw new Error(`SpriteRig: "${spriteId}" has no body part`);
    this.body = bodyImg;

    const order: Phaser.GameObjects.GameObject[] = [];
    for (const f of this.feet) order.push(f.img);
    for (const h of this.hands) if (!h.front) order.push(h.img);
    order.push(this.body);
    for (const h of this.hands) if (h.front) order.push(h.img);

    this.label = isSelf
      ? scene.add
          .text(0, -TARGET_BODY_H * 0.62 - 12, "you", { fontSize: "12px", color: "#E8E4D8" })
          .setOrigin(0.5)
      : undefined;
    if (this.label) order.push(this.label);

    // §5/§20 ground shadow at the feet — drawn FIRST (behind everything) so it sits under the rig; it
    // stays put while the art lifts on the hop, so the gap reads as altitude.
    this.shadow = scene.add
      .ellipse(0, TARGET_BODY_H * 0.42, TARGET_BODY_H * 0.6, TARGET_BODY_H * 0.22, 0x000000, 0.3)
      .setOrigin(0.5);
    order.unshift(this.shadow);

    this.root = scene.add.container(x, y, order);

    // Per-rig phase offset so a crowd doesn't bob in lockstep. Derived from id (stable).
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 1000;
    this.phase = h / 1000;
  }

  setPosition(x: number, y: number): void {
    this.root.setPosition(x, y);
  }

  /** Top-down draw order: lower on screen renders in front. */
  setDepth(d: number): void {
    this.root.setDepth(d);
  }

  /** §5 jump hop: lift the rendered art by `px` (peak of the arc). The container's logical position is
   *  untouched, so the camera + depth-sort stay grounded — only the visible body/hands/feet/weapon rise. */
  setHop(px: number): void {
    this.hopPx = px;
  }

  /** §20 DEATH-POP (Stage B): launch the corpse — slide along (vx,vy), arc UP under a fake gravity, spin,
   *  and fade, then self-destroy. Purely client-local cosmetic (the enemy is already gone server-side, so
   *  this is the momentum layer applied on death — the start of the "Madness" feel). The caller must have
   *  already detached the rig from the animated set so `animate()` won't fight the tweens. */
  deathPop(vx: number, vy: number): void {
    const dur = 520;
    const spin = (Math.random() < 0.5 ? -1 : 1) * (2 + Math.random() * 3);
    const peak = 36 + Math.random() * 34;
    this.scene.tweens.add({
      targets: this.root,
      x: this.root.x + vx,
      y: this.root.y + vy,
      rotation: spin,
      alpha: 0,
      duration: dur,
      ease: "Quad.easeOut",
      onComplete: () => this.destroy(),
    });
    // The vertical arc rides the existing hop-lift (up at launch → 0 on landing).
    this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: dur,
      onUpdate: (tw) => this.setHop(Math.sin((tw.getValue() ?? 0) * Math.PI) * peak),
    });
  }

  /** Scale the whole rig UNIFORMLY (bosses/toughs are BIGGER, not more detailed — §28.6). Stored so
   *  `animate()` re-applies it to both axes (the facing flip only touches scaleX). */
  setRigScale(mult: number): void {
    this.baseScale = mult;
    this.root.setScale(mult);
  }

  /** Add a pulsing glow behind the body — the §15 "tough = glowier" tell. Lives in the container
   *  so it scales + moves with the rig. */
  addGlow(color: number): void {
    const glow = this.scene.add
      .ellipse(0, -TARGET_BODY_H * 0.35, TARGET_BODY_H * 1.9, TARGET_BODY_H * 1.9, color, 0.3)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.root.addAt(glow, 0); // behind every part
    this.scene.tweens.add({
      targets: glow,
      scale: 1.18,
      alpha: 0.5,
      duration: 620,
      yoyo: true,
      repeat: -1,
      ease: "Sine.inOut",
    });
  }

  /** Equip (or swap) a weapon — one piece per hand (dual-wield uses both hands + both sprite
   *  parts). Each piece is held UPRIGHT in its hand, pivoting at the grip, and is inserted just
   *  BELOW that hand in the container so the hand overlays the hilt. */
  equipWeapon(spriteId: string, def: WeaponDef, manifest: SpriteManifest): void {
    for (const w of this.weapons) w.img.destroy();
    this.weapons = [];
    this.weaponDef = def;

    const frontHand = this.hands.find((h) => h.front);
    const backHand = this.hands.find((h) => !h.front);
    const attach = (
      part: SpriteManifest["parts"][number] | undefined,
      hand: typeof frontHand,
    ): Phaser.GameObjects.Image | undefined => {
      if (!part || !hand) return undefined;
      const img = this.scene.add.image(hand.img.x, hand.img.y, `${spriteId}:${part.role}`);
      img.setOrigin(def.gripFrac, 0.5).setScale(def.displayLength / part.w);
      this.root.add(img);
      this.weapons.push({ img, hand });
      return img;
    };
    const frontWpn = attach(manifest.parts[0], frontHand);
    const backWpn =
      def.dual && manifest.parts.length >= 2 ? attach(manifest.parts[1], backHand) : undefined;

    // Explicit z-stack (bottom→top): each weapon overlays the BODY but tucks UNDER its hand.
    // Single-wield keeps the back hand behind the body; dual brings it forward so both read.
    const stack: Phaser.GameObjects.GameObject[] = [];
    for (const f of this.feet) stack.push(f.img);
    if (def.twoHanded) {
      // 2H: one weapon, BOTH hands gripping it above the body.
      stack.push(this.body);
      if (frontWpn) stack.push(frontWpn);
      if (backHand) stack.push(backHand.img);
      if (frontHand) stack.push(frontHand.img);
    } else if (def.dual) {
      stack.push(this.body);
      if (backWpn) stack.push(backWpn);
      if (backHand) stack.push(backHand.img);
      if (frontWpn) stack.push(frontWpn);
      if (frontHand) stack.push(frontHand.img);
    } else {
      if (backHand) stack.push(backHand.img);
      stack.push(this.body);
      if (frontWpn) stack.push(frontWpn);
      if (frontHand) stack.push(frontHand.img);
    }
    if (this.label) stack.push(this.label);
    for (const obj of stack) this.root.bringToTop(obj);
  }

  /** Start a swing animation (the actual damage is server-authoritative). `aimWorld` (radians) freezes the
   *  aim AT swing-start so the blade sweeps the same arc the server's swept hitbox uses (§20 WYSIWYG); omit
   *  for a swing with no captured aim (the animate loop then falls back to the live/synced aim). */
  triggerSwing(timeMs: number, aimWorld?: number): void {
    this.swingStart = timeMs;
    this.swingAimWorld = aimWorld ?? Number.NaN;
  }

  /** Start a parry BRACE pose (§8) — raise the weapon to a horizontal block, draw the hands up into
   *  a guard, and dip into a brace, held ~the i-frame window. Purely a STANCE (no VFX yet; on-parry
   *  effects arrive with the level-up parry augments). */
  triggerBrace(timeMs: number): void {
    this.braceStart = timeMs;
  }

  /** §8 Brand augment: a persistent ember-orange tint marking a Marked enemy (takes more damage). */
  private branded = false;

  /** Toggle the §8 Brand tint. Cheap + idempotent — the scene calls it each frame off the synced state. */
  setBranded(on: boolean): void {
    if (on === this.branded) return;
    this.branded = on;
    this.restTint();
  }

  /** Re-apply the resting tint (Brand ember-orange, or none). */
  private restTint(): void {
    for (const p of this.parts) {
      if (this.branded) p.setTint(0xff7a4a).setTintMode(Phaser.TintModes.MULTIPLY);
      else p.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
    }
  }

  /** Brief white impact flash on every part (§20 hit feedback), then back to the resting tint. */
  flash(ms = 80): void {
    for (const p of this.parts) p.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    this.scene.time.delayedCall(ms, () => this.restTint());
  }

  get x(): number {
    return this.root.x;
  }

  get y(): number {
    return this.root.y;
  }

  /** Drop to EMPTY HANDS (the §9 fists fallback) — clears any held weapon sprite but keeps `def` so the
   *  unarmed swing still animates with the fists range/arc. Used when a weapon is dropped/salvaged. */
  unequip(def: WeaponDef): void {
    for (const w of this.weapons) w.img.destroy();
    this.weapons = [];
    this.weaponDef = def;
  }

  destroy(): void {
    for (const w of this.weapons) w.img.destroy();
    this.root.destroy();
  }

  animate(timeMs: number, anim: RigAnim): void {
    const t = timeMs / 1000 + this.phase;
    const moving = Math.hypot(anim.moveX, anim.moveY) > 0.02;
    const s = this.scale;

    // Facing: toward the cursor for the local player, else toward movement (but a GUN-holder faces their
    // AIM even remotely, so the barrel + body read as pointing where they shoot). Mirror the whole
    // container; per-part offsets/aim are computed in local space so the flip stays coherent.
    const dirX = anim.isSelf ? anim.aimX : this.weaponDef?.gun ? Math.cos(anim.aimDir) : anim.moveX;
    if (Math.abs(dirX) > 0.05) this.facing = dirX >= 0 ? 1 : -1;
    // UNIFORM scale on both axes (baseScale), facing = a pure horizontal MIRROR — never a stretch,
    // so the hand-painted art keeps its aspect ratio at any size (§28.4).
    this.root.scaleX = this.facing * this.baseScale;
    this.root.scaleY = this.baseScale;
    if (this.label) this.label.scaleX = this.facing; // keep text readable through the flip

    // Vertical "look" toward the cursor — local player only (others have no synced aim). aimY is screen
    // space (−up / +down) and is NOT touched by the facing mirror, so it leans correctly both ways.
    const lookY = anim.isSelf ? Math.max(-1, Math.min(1, anim.aimY)) : 0;

    // Bob + squash/stretch on the body (scale multiplies the base part scale).
    const bob = Math.sin(t * 6);
    this.body.y = bob * 3 * s * 4; // a touch of vertical bob, proportional to size
    this.body.scaleX = s * (1 + bob * 0.04);
    this.body.scaleY = s * (1 - bob * 0.06);
    // Body leans back looking up, forward looking down (+ the existing movement lean).
    this.body.rotation = (moving ? anim.moveX * 0.16 : 0) + lookY * BODY_LOOK_LEAN;

    // §20 momentum FLINCH (Stage A): the torso leans + jolts with the impulse shove (gun recoil / hit
    // knockback). The whole body already slides via the server position; this is the additive flinch on
    // top so the push reads as weight, not a teleport. Same world axes as the movement lean above.
    const rcx = anim.recoilX ?? 0;
    const rcy = anim.recoilY ?? 0;
    const rk = Math.min(1, Math.hypot(rcx, rcy) / 520);
    if (rk > 0.01) {
      this.body.rotation += Math.max(-1, Math.min(1, rcx / 520)) * 0.22;
      this.body.y += Math.max(-1, Math.min(1, rcy / 520)) * 5 * s;
      this.body.scaleX *= 1 + rk * 0.06;
    }

    // Parry BRACE (§8): a quick snap into a guard, hold through the i-frame window, ease out. Folds
    // into the weapon angle + hand positions below so the whole body reads as a block.
    let brace = 0;
    {
      const bel = timeMs - this.braceStart;
      const bdur = 450; // ≈ PARRY_IFRAMES (0.45s)
      if (bel >= 0 && bel < bdur) {
        const tt = bel / bdur;
        brace = tt < 0.18 ? tt / 0.18 : tt > 0.7 ? 1 - (tt - 0.7) / 0.3 : 1;
      }
    }
    if (brace > 0) {
      this.body.y += brace * s * 7; // dip into the brace
      this.body.scaleY = s * (1 - bob * 0.06 - brace * 0.05); // slight squash
    }

    // Weapon angle — guns AIM along the cursor; melee weapons sit upright at rest then wind-up + chop on
    // swing. Computed BEFORE the hands so a two-handed grip can place the back hand on the haft.
    let weaponAngle = 0;
    if (this.weaponDef?.gun && this.weapons.length > 0) {
      // GUN: point the BARREL along the aim (live cursor for self, synced `aimDir` for others). No swing —
      // the shot is the muzzle flash. Into the rig's LOCAL space (the container mirror flips x), so the
      // barrel tracks the cursor whichever way the body faces.
      const aimAng = anim.isSelf ? Math.atan2(anim.aimY, anim.aimX) : anim.aimDir;
      weaponAngle = Math.atan2(Math.sin(aimAng), Math.cos(aimAng) * this.facing);
    } else if (this.weaponDef && this.weapons.length > 0) {
      const def = this.weaponDef;
      // Rest tilt follows the cursor's vertical: blade raises looking up, lowers looking down.
      const restA = -Math.PI / 2 + 0.16 + lookY * WEAPON_LOOK_TILT;
      weaponAngle = restA + Math.sin(t * 2.6) * 0.04; // gentle idle sway
      const el = timeMs - this.swingStart;
      const dur = def.cooldown * 470;
      if (el >= 0 && el < dur) {
        // §20 WYSIWYG: sweep the blade across `swingArc` CENTRED ON THE AIM (frozen at swing-start), so the
        // sprite passes through exactly what the server's swept hitbox damages. World aim → local (mirrored).
        const aimW = Number.isNaN(this.swingAimWorld)
          ? anim.isSelf
            ? Math.atan2(anim.aimY, anim.aimX)
            : anim.aimDir
          : this.swingAimWorld;
        const aimLocal = Math.atan2(Math.sin(aimW), Math.cos(aimW) * this.facing);
        const start = aimLocal - def.swingArc / 2;
        const end = aimLocal + def.swingArc / 2;
        const back = start - 0.3; // a quick wind-back just past the start of the sweep
        const tt = el / dur;
        weaponAngle =
          tt < 0.16
            ? restA + (back - restA) * (tt / 0.16) // wind up
            : back + (end - back) * (1 - (1 - (tt - 0.16) / 0.84) ** 2); // ease-out sweep through the arc
      }
    }
    // Brace overrides the swing: raise the weapon toward a near-horizontal block (business end up).
    if (brace > 0) {
      const guard = -0.2; // near-horizontal, tipped slightly up = a raised guard
      weaponAngle += (guard - weaponAngle) * brace;
    }

    // Hands drift independently; the front hand reaches toward the cursor. Reach is SHORT when
    // holding a weapon so the weapon stays tucked against the body (not floating far out).
    const reach = TARGET_BODY_H * (this.weapons.length > 0 ? 0.1 : 0.28);
    for (const hnd of this.hands) {
      const drift = Math.sin(t * 4.5 + (hnd.front ? 0 : 1)) * s * 8;
      if (hnd.front && anim.isSelf && Math.abs(anim.aimX) + Math.abs(anim.aimY) > 0.01) {
        hnd.img.x = hnd.ox + anim.aimX * this.facing * reach;
        hnd.img.y = hnd.oy + anim.aimY * reach + drift;
      } else {
        hnd.img.x = hnd.ox;
        hnd.img.y = hnd.oy + drift;
      }
      // Brace: draw both hands forward + up into a guard in front of the body.
      if (brace > 0) {
        const bx = TARGET_BODY_H * 0.16;
        const by = hnd.oy - TARGET_BODY_H * 0.08;
        hnd.img.x += (bx - hnd.img.x) * brace;
        hnd.img.y += (by - hnd.img.y) * brace;
      }
    }

    // Two-handed grip: place the back hand UP the haft from the front grip (along the weapon).
    if (this.weaponDef?.twoHanded) {
      const front = this.hands.find((h) => h.front);
      const back = this.hands.find((h) => !h.front);
      if (front && back) {
        const haft = TARGET_BODY_H * 0.42;
        back.img.x = front.img.x + Math.cos(weaponAngle) * haft;
        back.img.y = front.img.y + Math.sin(weaponAngle) * haft;
        back.img.rotation = 0;
      }
    }

    // Feet: alternating walk when moving (lift + a small forward/back stride + a toe pivot),
    // gentle float when idle. A touch more life than a pure vertical bob.
    for (let i = 0; i < this.feet.length; i++) {
      const ft = this.feet[i];
      if (!ft) continue;
      if (moving) {
        const ph = t * 11 + i * Math.PI; // legs out of phase
        ft.img.y = ft.oy - Math.max(0, Math.sin(ph)) * s * 16;
        ft.img.x = ft.ox + Math.cos(ph) * s * 7; // stride
        ft.img.rotation = Math.cos(ph) * 0.14; // slight pivot
      } else {
        ft.img.y = ft.oy + Math.sin(t * 3 + i) * s * 4;
        ft.img.x = ft.ox;
        ft.img.rotation = 0;
      }
    }

    // Weapon(s): held in hand at the angle computed above (upright at rest → chop on swing).
    for (let i = 0; i < this.weapons.length; i++) {
      const w = this.weapons[i];
      if (!w) continue;
      const off = i === 1 ? 0.32 : 0; // dual back-knife leans a touch differently
      w.img.setPosition(w.hand.img.x, w.hand.img.y);
      w.img.rotation = weaponAngle + off;
    }

    // §5 jump hop: after every part is positioned, lift the whole rig's ART up the arc. Feet lift most
    // (they leave the ground), so the silhouette reads as "off the ground" rather than just sliding up.
    if (this.hopPx > 0.01) {
      const lift = this.hopPx;
      for (const p of this.parts) p.y -= lift;
      for (const w of this.weapons) w.img.y -= lift;
      // A touch of squash relief at the apex sells the leap (body stretches up slightly mid-air).
      this.body.scaleY *= 1 + Math.min(0.12, lift / 300);
    }
    // §5/§20 the grounded shadow shrinks + fades as the rig rises, so height reads as altitude (the gap
    // between the lifted art and the planted shadow). The shadow itself never lifts.
    const shrink = Math.max(0.42, 1 - this.hopPx / 420);
    this.shadow.setScale(shrink, shrink).setAlpha(0.3 * shrink);
  }
}
