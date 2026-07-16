import {
  CHOP_IMPACT_FRAC,
  isWornWeapon,
  MOVE_SPEED,
  swingDescriptorFor,
  type SwingDescriptor,
  type WeaponDef,
} from "@dd/shared";
import Phaser from "phaser";
import { SPRITES, type SpriteManifest } from "../sprites/manifest.js";

/** §28 the packed sprite MULTIATLAS key (tools/artkit/pack-atlas.mjs → public/sprites/dd-sprites.json). When
 *  loaded, every non-expansion part lives here as the frame "<id>/<role>", so the WebGL batcher binds ONE
 *  texture for a whole screen of rigs instead of one per part. ArenaScene boot-loads it under this key. */
export const SPRITE_ATLAS = "dd-sprites";

/** Resolve the texture for a sprite part: the packed atlas frame "<id>/<role>" if the atlas is loaded and
 *  has it, else the loose per-part texture "<id>:<role>" (back-compat — e.g. the atlas missing a frame, or
 *  a future on-demand expansion sprite). Returns args to spread into `scene.add.image(x, y, key, frame?)`.
 *  Exported so other renderers (e.g. ground weapon-pickups) resolve textures the same way. */
export function partTexture(
  scene: Phaser.Scene,
  spriteId: string,
  role: string,
): { key: string; frame?: string } {
  const frame = `${spriteId}/${role}`;
  if (scene.textures.exists(SPRITE_ATLAS) && scene.textures.get(SPRITE_ATLAS).has(frame)) {
    return { key: SPRITE_ATLAS, frame };
  }
  return { key: `${spriteId}:${role}` };
}

/** On-screen height of the body part, in px. Everything else scales from this. (tuning) */
const TARGET_BODY_H = 76; // §37 slightly smaller characters (was 84) — reads better in the zoomed-out belt
/** §7 v0.112 procedural gait — px travelled per full stride cycle (2 steps). Distance-based, so the step
 *  cadence MATCHES actual speed (no jog-in-place, no fixed loop that runs after you stop). (tuning) */
const STRIDE_LEN = 150;
/** Vertical "look" toward the cursor (local player): how far the torso leans + the held weapon tilts
 *  with the aim's up/down. Subtle by design — "to some degree". (tuning) */
const BODY_LOOK_LEAN = 0.14;
const WEAPON_LOOK_TILT = 0.6;

/** §42 a WORN weapon (gauntlet/claw/glove/knuckles) is worn ON the hand, not held by the cuff: the rig
 *  mounts its pivot where the hand sits INSIDE the glove and renders the art OVER the hand. Matched by
 *  the gauntlet/fist FAMILIES plus worn WORDS in the name (the melee claws hide under "exotic-melee");
 *  word-boundaries keep held gear out ("Knucklebone Censer-Orb" is a censer on a chain, not knuckles). */
export { isWornWeapon };

export interface RigAnim {
  /** Movement direction this frame (≈0 length when idle). */
  moveX: number;
  moveY: number;
  /** §7 v0.105 RAW render speed (px/s) — drives the gait blend so the walk cycle ramps with actual speed
   *  and fully stops when you do (not a binary flag that runs full-stride for ~1.3s after key-release). */
  speed?: number;
  /** Aim direction toward the cursor (local player only). */
  aimX: number;
  aimY: number;
  /** §37 RAW horizontal cursor offset from the character (px, unnormalized) — drives the facing FLIP so it
   *  commits exactly as the mouse crosses the character's midpoint (a normalized-aim threshold goes sticky
   *  when the cursor is far above/below: |aimX| stays tiny however clearly the midpoint was crossed). */
  aimDxPx?: number;
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
  /** §4 caller-updated scalar render history; avoids replacing one `{x,y}` per rig per frame in the scene. */
  renderPrevX: number;
  renderPrevY: number;
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
  /** §29 quantized display-list depth last sent to Phaser; unchanged writes force a global re-sort. */
  private lastDepth = Number.NaN;
  private facing = 1;
  /** §7 v0.105 de-clunk — smoothed 0..1 GAIT (≈ speed/MOVE_SPEED): scales the stride/lift/lean so the walk
   *  cycle ramps in + fades out instead of snapping on a binary flag (the old check was dead code that kept
   *  the jog running ~1.3s after you stopped). */
  private gait = 0;
  /** §7 v0.105 de-clunk — eased facing (−1..1). The mirror glides through 0 (reads as a TURN) instead of a
   *  one-frame full-body flip; `facing` stays the committed ±1 (drives aim math + keeps the label readable). */
  private facingBlend = 1;
  /** §7 v0.105 de-clunk — landing squash (0..1, decays) fired when the hop returns to the ground. */
  private landSquash = 0;
  /** §7 v0.111 TURN-COMMIT ("pull the reins") — the directional WEIGHT lives in the ANIMATION, not the
   *  trajectory. `heading` tracks the smoothed run direction; when it swings hard while moving, `turnCommit`
   *  fires a one-time decaying punch toward the new heading (`turnDir`) — the body plants + leans + the hands
   *  yank into the turn, like a rider hauling the reins before the horse commits. The character's path across
   *  the screen is UNCHANGED; this is pure procedural flourish. */
  private headingX = 1;
  private headingY = 0;
  private turnCommit = 0;
  private turnDirX = 1;
  private turnDirY = 0;
  /** §7 v0.112 procedural gait state: `velX/velY` = fast-smoothed render velocity, `slowVelX/slowVelY` =
   *  slow-smoothed. Their DIFFERENCE is an inertia signal — nonzero only while accelerating / decelerating /
   *  turning — that trails the hands + feet behind the body's motion (limbs with weight, reacting to input,
   *  not a fixed loop). `strideT` is the DISTANCE-accumulated stride phase (radians) so the walk cadence
   *  tracks real speed and stops when you do. */
  private velX = 0;
  private velY = 0;
  private slowVelX = 0;
  private slowVelY = 0;
  private strideT = 0;
  /** §7 v0.105 de-clunk — last `animate` clock (ms) to derive a frame dt for the eased blends; -1 = first. */
  private prevAnimMs = -1;
  /** §8 parry brace envelope duration (ms) ≈ PARRY_IFRAMES. Hoisted so `triggerBrace` can plateau a chain. */
  private static readonly BRACE_DUR = 450;
  /** Held weapon piece(s) — one per hand (dual-wield = two). Live INSIDE the container so the
   *  hand renders over the hilt and the facing-flip applies automatically. */
  private weapons: {
    img: Phaser.GameObjects.Image;
    hand: { img: Phaser.GameObjects.Image; ox: number; oy: number };
    /** The weapon's own display scale (displayLength/part.w). Applied each frame ÷ baseScale so the weapon
     *  is a FIXED on-screen size regardless of which (larger/smaller) character holds it. */
    baseScale: number;
  }[] = [];
  private weaponDef?: WeaponDef;
  private swingStart = -1e9;
  /** §44 immutable predicted/accepted swing clock. The normalized pose branches below are untouched; only
   *  their `tt` time base comes from this effective-cooldown descriptor. */
  private swing?: SwingDescriptor;
  /** §40 fake-3D ORBIT slash (two-handed melee): 0..1 progress while active, −1 otherwise. Set by the
   *  weapon-angle pass, consumed by the weapon render pass (which overrides position/rotation/scale/depth). */
  private orbitT = -1;
  /** Whether the orbiting blade is currently on the FAR side of the body (rendered behind it). */
  private orbitBehind = false;
  /** §40.3 GAREN-SPIN mode for the orbit pass: full revolutions + the body whirls (signed mirror-turns). */
  private orbitSpin = false;
  /** §41 this swing started while (or right as) the previous one ended — a SPAMMED chain. Spins drop their
   *  wind-in and run linear so back-to-back presses read as ONE continuous whirlwind. */
  private swingChained = false;
  /** §40 per-frame weapon POSITION offset from the hand (chop lift / thrust lunge). Reset each frame. */
  private swingOffX = 0;
  private swingOffY = 0;
  /** §20 world-space aim (radians) captured at swing-start, so the blade sweeps the server's swept arc. */
  private swingAimWorld = Number.NaN;
  private braceStart = -1e9;
  /** §5 jump: px the rendered art is lifted this frame (the hop arc). The container stays grounded so
   *  the camera + depth-sort use the ground position; only the visible parts rise. §7 v0.105 de-clunk:
   *  `hopPx` now EASES toward `hopTarget` (the synced height) so the 20Hz jump doesn't stair-step. */
  private hopPx = 0;
  private hopTarget = 0;
  /** §33 permanent art-lift (local px) for colossus lower-body framing — added to the hop each frame. */
  private baseLift = 0;
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
      const tx = partTexture(scene, spriteId, role);
      const img = scene.add.image(part.ox * this.scale, part.oy * this.scale, tx.key, tx.frame);
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
    this.renderPrevX = x;
    this.renderPrevY = y;

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
    const depth = Math.round(d);
    if (depth === this.lastDepth) return;
    this.lastDepth = depth;
    this.root.setDepth(depth);
  }

  /** §5 jump hop: lift the rendered art by `px` (peak of the arc). The container's logical position is
   *  untouched, so the camera + depth-sort stay grounded — only the visible body/hands/feet/weapon rise. */
  setHop(px: number): void {
    this.hopTarget = px;
  }

  /** §33 COLOSSUS framing: a PERMANENT upward art-lift (in body-heights) so a giant renders feet-at-the-
   *  ground with its torso towering off the top of the screen — "you only see his lower body". Like the hop,
   *  it moves ONLY the visible art (logical position, depth-sort + the grounded shadow stay put). `frac` = how
   *  many body-heights to lift; 0 = normal. */
  setLowerBodyFrame(frac: number): void {
    this.baseLift = frac * TARGET_BODY_H;
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
    // §7 v0.105 de-clunk: reset the swing clock on a swap — otherwise elapsed time from the OLD weapon's
    // swing carries into the NEW weapon's (different-length) timeline, so a fresh grab could pop mid-swing.
    this.swingStart = -1e9;
    this.swing = undefined;

    const frontHand = this.hands.find((h) => h.front);
    const backHand = this.hands.find((h) => !h.front);
    // §42 WORN gear pivots where the hand sits INSIDE the glove (~40% in from the cuff) instead of at the
    // authored gripFrac (the cuff) — gripFrac-mounting a gauntlet read as holding it by the opening and
    // smacking people with it, duel-challenge style.
    const worn = isWornWeapon(def);
    const attach = (
      part: SpriteManifest["parts"][number] | undefined,
      hand: typeof frontHand,
    ): Phaser.GameObjects.Image | undefined => {
      if (!part || !hand) return undefined;
      const tx = partTexture(this.scene, spriteId, part.role);
      const img = this.scene.add.image(hand.img.x, hand.img.y, tx.key, tx.frame);
      const wScale = def.displayLength / part.w;
      img.setOrigin(worn ? 0.4 : def.gripFrac, 0.5).setScale(wScale);
      this.root.add(img);
      this.weapons.push({ img, hand, baseScale: wScale });
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
      // §42 worn dual (twin claws): each glove renders OVER its hand — the hand is inside it.
      if (worn) {
        if (backHand) stack.push(backHand.img);
        if (backWpn) stack.push(backWpn);
        if (frontHand) stack.push(frontHand.img);
        if (frontWpn) stack.push(frontWpn);
      } else {
        if (backWpn) stack.push(backWpn);
        if (backHand) stack.push(backHand.img);
        if (frontWpn) stack.push(frontWpn);
        if (frontHand) stack.push(frontHand.img);
      }
    } else {
      if (backHand) stack.push(backHand.img);
      stack.push(this.body);
      // §42 worn single: the glove covers the hand (hand under, weapon on top); held: hand grips the hilt.
      if (worn) {
        if (frontHand) stack.push(frontHand.img);
        if (frontWpn) stack.push(frontWpn);
      } else {
        if (frontWpn) stack.push(frontWpn);
        if (frontHand) stack.push(frontHand.img);
      }
    }
    if (this.label) stack.push(this.label);
    for (const obj of stack) this.root.bringToTop(obj);
  }

  /** Start a swing animation (damage is server-authoritative). `timeMs` is the scene clock accepted/predicted
   *  epoch, shared locally by rig/VFX/quake; `aimWorld` freezes aim. The optional descriptor is computed once
  *  by ArenaScene from effective cooldown; server acceptance sync is the later protocol reconciliation. */
  triggerSwing(timeMs: number, aimWorld?: number, swing?: SwingDescriptor): void {
    const nextSwing =
      swing ??
      (this.weaponDef ? swingDescriptorFor(this.weaponDef, this.weaponDef.cooldown) : undefined);
    // §41 CHAIN detection: this press landed while (or within a beat of) the previous swing's window — a
    // spammed sequence. Spins use it to drop their wind-in and hold the whirl, so held/spammed RMB reads as
    // one continuous whirlwind instead of restarting the spin-up every press.
    if (this.swing) {
      const prevDur = this.swing.poseSeconds * 1000;
      this.swingChained = timeMs - this.swingStart <= prevDur + 150;
    } else {
      this.swingChained = false;
    }
    this.swingStart = timeMs;
    this.swing = nextSwing;
    this.swingAimWorld = aimWorld ?? Number.NaN;
  }

  /** Start a parry BRACE pose (§8) — raise the weapon to a horizontal block, draw the hands up into
   *  a guard, and dip into a brace, held ~the i-frame window. Purely a STANCE (no VFX yet; on-parry
   *  effects arrive with the level-up parry augments). */
  triggerBrace(timeMs: number): void {
    // §7 v0.105 de-clunk: on a CHAIN parry (a press landing while the guard is still up), don't restart the
    // envelope from 0 — that re-ramps the raise over ~81ms and flickers the guard OFF for a frame right in
    // the Sekiro rhythm. Restart at the PLATEAU time instead so the guard holds continuously.
    this.braceStart =
      timeMs - this.braceStart < SpriteRig.BRACE_DUR ? timeMs - 0.18 * SpriteRig.BRACE_DUR : timeMs;
  }

  /** §8 Brand augment: a persistent ember-orange tint marking a Marked enemy (takes more damage). */
  private branded = false;
  /** §6 DOWNED state — fades + grey-tints the rig (it's a body on the ground until a rez revives it). */
  private downed = false;
  /** §20 one reschedulable impact-flash expiry per rig — prevents timer races and teardown retention. */
  private flashTimer?: Phaser.Time.TimerEvent;

  /** Toggle the §8 Brand tint. Cheap + idempotent — the scene calls it each frame off the synced state. */
  setBranded(on: boolean): void {
    if (on === this.branded) return;
    this.branded = on;
    this.restTint();
  }

  /** §6 DOWNED look: fade + a cold grey tint (a body on the ground), or restore on revive. */
  setDowned(on: boolean): void {
    if (on === this.downed) return;
    this.downed = on;
    this.root.setAlpha(on ? 0.5 : 1);
    this.restTint();
  }

  /** Re-apply the resting tint (downed grey > Brand ember-orange > none). */
  private restTint(): void {
    for (const p of this.parts) {
      if (this.downed) p.setTint(0x556070).setTintMode(Phaser.TintModes.MULTIPLY);
      else if (this.branded) p.setTint(0xff7a4a).setTintMode(Phaser.TintModes.MULTIPLY);
      else p.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
    }
  }

  /** Brief impact flash on every part (§20 hit feedback / §6 revive pop), then back to the resting tint. */
  flash(ms = 80, color = 0xffffff): void {
    for (const p of this.parts) p.setTint(color).setTintMode(Phaser.TintModes.FILL);
    // §20 a newer hit owns the flash window: cancel the prior expiry so it cannot clear this tint early.
    this.flashTimer?.remove(false);
    this.flashTimer = this.scene.time.delayedCall(ms, () => {
      this.flashTimer = undefined;
      this.restTint();
    });
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
    // §20 the delayed callback closes over this rig; detach it before destroying the visible hierarchy.
    this.flashTimer?.remove(false);
    this.flashTimer = undefined;
    for (const w of this.weapons) w.img.destroy();
    this.root.destroy();
  }

  animate(timeMs: number, anim: RigAnim): void {
    const t = timeMs / 1000 + this.phase;
    // §7 v0.105 de-clunk: derive a frame dt from the (freeze-paused) animation clock for the eased blends,
    // clamped so a hit-stop gap or first frame can't produce a jump.
    // §7 v0.112 clamp to [0,100]: a scene restart / clock reset can make timeMs < prevAnimMs → a NEGATIVE dt
    // that would flip the exponential-blend signs and blow every eased value to infinity. Never allow that.
    const dtMs = this.prevAnimMs < 0 ? 16 : Math.max(0, Math.min(100, timeMs - this.prevAnimMs));
    this.prevAnimMs = timeMs;
    const s = this.scale;

    // §7 v0.105 GAIT: ease a 0..1 gait toward the real render speed (speed/MOVE_SPEED). Stride/lift/lean all
    // scale by it, so the walk ramps in + fully fades out with speed instead of a binary flag that ran the
    // full-stride jog for ~1.3s after key-release (and teleported a foot on the flip to idle).
    const targetGait = Math.min(1, (anim.speed ?? 0) / MOVE_SPEED);
    this.gait += (targetGait - this.gait) * (1 - Math.exp((-8 * dtMs) / 1000)); // τ≈125ms
    const gait = this.gait;

    // §7 v0.111 TURN-COMMIT ("pull the reins"): when the run HEADING swings hard, fire a one-time decaying
    // punch toward the new direction — the WEIGHT of committing to a turn, shown in animation (the trajectory
    // is untouched). Refractory via `turnCommit` so it fires ONCE per turn, not every frame while the tracked
    // heading catches up. Sharper turn (smaller dot) → bigger pull; a full reversal → a full-strength haul.
    this.turnCommit = Math.max(0, this.turnCommit - dtMs / 1000 / 0.24); // decays over ~0.24s
    const mvLen = Math.hypot(anim.moveX, anim.moveY);
    if (mvLen > 0.15) {
      const nx = anim.moveX / mvLen;
      const ny = anim.moveY / mvLen;
      const dot = nx * this.headingX + ny * this.headingY; // 1 = same way … −1 = reversal
      if (gait > 0.4 && dot < 0.72 && this.turnCommit < 0.06) {
        this.turnCommit = Math.min(1, (1 - dot) * 0.9);
        this.turnDirX = nx;
        this.turnDirY = ny;
        this.headingX = nx; // snap the tracked heading so the change doesn't re-trigger next frame
        this.headingY = ny;
      }
      const hk = 1 - Math.exp((-6 * dtMs) / 1000);
      this.headingX += (nx - this.headingX) * hk;
      this.headingY += (ny - this.headingY) * hk;
    }
    const commit = this.turnCommit;

    // §7 v0.112 PROCEDURAL GAIT: track the render velocity at two smoothings; their difference is an inertia
    // signal (nonzero only while the speed is CHANGING) that trails the limbs behind the body — free-moving
    // weight that reacts to input, not a hard-set loop. `strideT` accumulates by DISTANCE so the step cadence
    // matches real speed exactly (and freezes when you stop). `lagX/Y` are ~[-1,1] world-space inertia.
    const dtS = Math.max(0.001, dtMs / 1000);
    const spd = anim.speed ?? 0;
    const rvx = anim.moveX * spd;
    const rvy = anim.moveY * spd;
    this.velX += (rvx - this.velX) * (1 - Math.exp(-26 * dtS)); // fast (τ≈38ms)
    this.velY += (rvy - this.velY) * (1 - Math.exp(-26 * dtS));
    this.slowVelX += (rvx - this.slowVelX) * (1 - Math.exp(-7 * dtS)); // slow (τ≈140ms)
    this.slowVelY += (rvy - this.slowVelY) * (1 - Math.exp(-7 * dtS));
    const lagX = Math.max(-1.4, Math.min(1.4, (this.velX - this.slowVelX) / MOVE_SPEED));
    const lagY = Math.max(-1.4, Math.min(1.4, (this.velY - this.slowVelY) / MOVE_SPEED));
    this.strideT += ((spd * dtS) / STRIDE_LEN) * Math.PI * 2;
    if (this.strideT > Math.PI * 2e6) this.strideT -= Math.PI * 2e6; // keep it bounded over a long session
    const legPh = this.strideT;

    // Facing: toward the cursor for the local player, else toward movement (but a GUN-holder faces their
    // AIM even remotely, so the barrel + body read as pointing where they shoot). Mirror the whole
    // container; per-part offsets/aim are computed in local space so the flip stays coherent.
    const dirX = anim.isSelf ? anim.aimX : this.weaponDef?.gun ? Math.cos(anim.aimDir) : anim.moveX;
    // §37 facing flip. SELF: commit on the RAW pixel offset of the cursor from the character's midpoint
    // (±6px hysteresis kills strobe at the exact centre) — a normalized-|aimX| threshold went sticky when the
    // cursor sat far above/below (|aimX|≈0 however clearly the midpoint was crossed). Remotes/enemies keep the
    // small normalized deadzone (they aim from synced angles/movement, not a cursor).
    if (anim.isSelf && anim.aimDxPx !== undefined) {
      if (Math.abs(anim.aimDxPx) > 6) this.facing = anim.aimDxPx >= 0 ? 1 : -1;
    } else if (Math.abs(dirX) > 0.05) {
      this.facing = dirX >= 0 ? 1 : -1;
    }
    // §7 v0.105 de-clunk: EASE the visual mirror toward the committed facing, passing through scaleX≈0 —
    // that reads as a TURN, not a one-frame full-body flip. UNIFORM baseScale on both axes = a pure mirror,
    // never a stretch, so the hand-painted art keeps its aspect ratio at any size (§28.4).
    this.facingBlend += (this.facing - this.facingBlend) * (1 - Math.exp((-12 * dtMs) / 1000)); // τ≈83ms
    this.root.scaleX = this.facingBlend * this.baseScale;
    this.root.scaleY = this.baseScale;
    // Keep the "you" label a FIXED on-screen size + readable regardless of the character's rig scale: the
    // label is a child of the root (scaled by baseScale), so counter baseScale on both axes — else a bigger
    // character blows the text up (weapons counter the same way, §29). scaleX also counters the facing mirror.
    if (this.label) {
      const inv = 1 / (this.baseScale || 1);
      this.label.scaleX = this.facing * inv;
      this.label.scaleY = inv;
    }

    // Vertical "look" toward the cursor — local player only (others have no synced aim). aimY is screen
    // space (−up / +down) and is NOT touched by the facing mirror, so it leans correctly both ways.
    const lookY = anim.isSelf ? Math.max(-1, Math.min(1, anim.aimY)) : 0;

    // §7 v0.112 Bob + squash/stretch: the bob is STRIDE-synced when moving (two dips per stride = one per
    // footfall) and a slow breathing sway when idle — so it never runs a fixed loop out of step with the feet.
    const bob = gait * Math.sin(legPh * 2) + (1 - gait) * Math.sin(t * 2.2) * 0.55;
    this.body.y = bob * 3 * s * 4; // a touch of vertical bob, proportional to size
    this.body.scaleX = s * (1 + bob * 0.04);
    this.body.scaleY = s * (1 - bob * 0.06);
    // §MADNESS the torso leans HARD into the run + accel — a loose, weighty forward pitch (Madness-Combat
    // flash feel), not a stiff upright. Movement lean 0.16→0.34, accel lean 0.32→0.55.
    this.body.rotation = anim.moveX * 0.34 * gait + lagX * 0.55 + lookY * BODY_LOOK_LEAN;

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

    // §7 v0.111 turn-commit BODY: an exaggerated one-time lean + plant-dip into the new heading (decays), on
    // top of the steady movement lean above — reads as the rider hauling into the turn, then settling.
    if (commit > 0.01) {
      this.body.rotation += this.turnDirX * commit * 0.5; // haul the torso into the new direction
      this.body.y += (3 + this.turnDirY * 4) * commit * s; // plant/dip (a touch more when turning downward)
      this.body.scaleY *= 1 - commit * 0.06; // brief squash as the weight lands
    }

    // Parry BRACE (§8): a quick snap into a guard, hold through the i-frame window, ease out. Folds
    // into the weapon angle + hand positions below so the whole body reads as a block.
    let brace = 0;
    {
      const bel = timeMs - this.braceStart;
      const bdur = SpriteRig.BRACE_DUR; // ≈ PARRY_IFRAMES (0.45s)
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
    this.orbitT = -1; // §40 re-armed below only while an orbit-style swing window is live
    this.orbitSpin = false;
    this.swingOffX = 0;
    this.swingOffY = 0;
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
      // §44 use Phaser's scene epoch — the same clock as the VFX tween + quake timer. During local hit-stop
      // the rendered frame holds because animate is skipped, then resumes at the CURRENT swing phase instead
      // of extending authoritative danger. Pose shapes/envelopes below remain byte-for-byte normalized.
      const el = this.scene.time.now - this.swingStart;
      const style = this.swing?.style;
      const dur = (this.swing?.poseSeconds ?? 0) * 1000;
      if (style && el >= 0 && el < dur) {
        // §40 SWING-STYLE dispatch — one weapon, ONE animation, drawn from the per-type vocabulary
        // (arc / orbit / chop / pivot / thrust / spin). World aim → local (mirrored) shared by every style.
        const tt = el / dur;
        const aimW = Number.isNaN(this.swingAimWorld)
          ? anim.isSelf
            ? Math.atan2(anim.aimY, anim.aimX)
            : anim.aimDir
          : this.swingAimWorld;
        const aimLocal = Math.atan2(Math.sin(aimW), Math.cos(aimW) * this.facing);
        if (style === "orbit") {
          // Fake-3D WAIST ORBIT (the facing flip's scale-through-a-plane trick generalized) — flagged here,
          // fully rendered by the weapon pass below (position + rotation + foreshortening + depth swap).
          this.orbitT = tt;
        } else if (style === "spin") {
          // §40.3 GAREN SPIN — the orbit machinery in whirlwind mode: full revolutions, body mirror-turns.
          this.orbitT = tt;
          this.orbitSpin = true;
        } else if (style === "chop") {
          // OVERHEAD CHOP (quake/slam weapons — matches the ground-eruption VFX): raise the blade up-behind
          // over the head, SLAM it down-forward, hold the landed pose a beat, then settle back to rest.
          // §40.1 the BODY swings it too (paper-character posing, applied additively — the frame's base body
          // transform was set above): wind-up leans BACK + rises onto the toes; the slam hauls the torso
          // FORWARD and drives it down into a squat; the hold keeps the crouch while the quake erupts.
          const raiseA = -Math.PI / 2 - 0.85; // up + tilted behind the head
          const slamA = 0.85 + lookY * 0.25; // down-forward (biased a touch by the cursor's vertical)
          const lift = TARGET_BODY_H * 0.2;
          if (tt < 0.3) {
            const p = tt / 0.3;
            const e = p * (2 - p);
            weaponAngle = restA + (raiseA - restA) * e; // ease the raise
            this.swingOffY = -lift * p; // grip climbs as the blade goes overhead
            this.body.rotation -= 0.16 * e; // lean back behind the lift
            this.body.y -= 3.5 * s * e; // up onto the toes
            this.body.scaleY *= 1 + 0.05 * e; // slight stretch
          } else if (tt < CHOP_IMPACT_FRAC) {
            // §40.2 the blade LANDS exactly at CHOP_IMPACT_FRAC — the shared moment the quake detonates.
            const p = (tt - 0.3) / (CHOP_IMPACT_FRAC - 0.3);
            const e = p * p;
            weaponAngle = raiseA + (slamA - raiseA) * e; // ACCELERATE into the slam
            this.swingOffY = -lift + (lift + TARGET_BODY_H * 0.06) * e; // grip drives down past rest
            this.body.rotation += -0.16 + 0.38 * e; // haul the torso through: back → forward
            this.body.y += (-3.5 + 9.5 * e) * s; // toes → driven down
            this.body.scaleY *= 1 + 0.05 - 0.15 * e; // stretch → squash
          } else if (tt < 0.7) {
            weaponAngle = slamA; // the blade sits buried a beat — the quake erupts here
            this.swingOffY = TARGET_BODY_H * 0.06;
            this.body.rotation += 0.22; // held forward
            this.body.y += 6 * s; // held squat
            this.body.scaleY *= 0.9;
          } else {
            const p = (tt - 0.7) / 0.3;
            const e = 1 - p * (2 - p);
            weaponAngle = slamA + (restA - slamA) * (p * (2 - p));
            this.swingOffY = TARGET_BODY_H * 0.06 * e;
            this.body.rotation += 0.22 * e;
            this.body.y += 6 * s * e;
            this.body.scaleY *= 1 - 0.1 * e;
          }
        } else if (style === "pivot") {
          // §41 CLAW RAKE — how claws are actually used: the whole ARM swipes. The hand travels a fast
          // diagonal RAKE across the aim (side → across → side, pushing OUT at the middle of the swipe) while
          // the claw's rotation whips through the same sweep — arm + claw slash together, like dragging
          // talons across a target. (swingOff drives the front hand, §40.1, so the arm visibly moves.)
          const spin = Math.max(def.swingArc * 1.1, 2.6);
          const start = aimLocal - spin * 0.6;
          const end = aimLocal + spin * 0.4; // whips THROUGH the aim past the middle
          let prog = 0; // 0..1 across the active rake (drives both the whip and the arm path)
          if (tt < 0.1) {
            weaponAngle = restA + (start - restA) * (tt / 0.1); // snap-wind
          } else if (tt < 0.62) {
            prog = 1 - (1 - (tt - 0.1) / 0.52) ** 3; // vicious ease-out
            weaponAngle = start + (end - start) * prog;
          } else {
            prog = 1;
            const p = (tt - 0.62) / 0.38;
            weaponAngle = end + (restA - end) * (p * (2 - p));
          }
          // The ARM path: sweep laterally across the aim (perpendicular +R → −R) + a punch OUT along the
          // aim that peaks mid-rake, then snap back home over the recovery tail.
          const recover = tt < 0.62 ? 1 : 1 - (tt - 0.62) / 0.38;
          const lat = TARGET_BODY_H * 0.26 * (1 - 2 * prog) * recover; // across the swipe
          const out = TARGET_BODY_H * 0.3 * Math.sin(Math.PI * prog) * recover; // reach out mid-swipe
          const px = -Math.sin(aimLocal);
          const py = Math.cos(aimLocal);
          this.swingOffX = px * lat + Math.cos(aimLocal) * out;
          this.swingOffY = py * lat + Math.sin(aimLocal) * out;
          // Body: the shoulder DRIVES the rake — paper-twist peaks with the slash, torso leans into the swipe.
          const jab = Math.sin(Math.PI * Math.min(1, tt / 0.62)) * recover;
          this.body.scaleX *= 1 - 0.14 * jab;
          this.body.rotation += 0.11 * jab * Math.cos(aimLocal);
          this.body.y += 2 * s * jab;
        } else if (style === "punch") {
          // §42 PUNCH — worn blunt gauntlets/knuckles: the FIST drives, no blade to rake. Chamber (the
          // fist pulls back and to the side, shoulders winding), then the punch WHIPS through the aim on
          // a hook's curve and snaps back. Heavy (2H) maulers throw a full ROUNDHOUSE: deeper chamber,
          // wider arc, the whole torso pivots behind the blow. The glove points along its travel, and
          // swingOff carries the hand (§40.1) so the ARM visibly throws it.
          const heavy = def.twoHanded ? 1 : 0;
          const reach = TARGET_BODY_H * (0.5 + 0.25 * heavy);
          const hook = 0.55 + 0.75 * heavy; // roundhouse curvature: how far around the fist sweeps
          const wind = 0.16 + 0.08 * heavy; // chamber fraction of the swing window
          // §40.2/§42 the fist CONNECTS at CHOP_IMPACT_FRAC — the shared moment a quake gauntlet's
          // ground eruption detonates (server + VFX run on the same clock), so the blow SELLS the boom.
          const imp = CHOP_IMPACT_FRAC;
          let th = aimLocal; // fist direction from the shoulder
          let r = 0; // fist extension
          let drive = 0; // 0..1 body-commitment envelope
          if (tt < wind) {
            const p = tt / wind;
            th = aimLocal - hook * p; // wind around AND back
            r = reach * 0.3 * p;
            drive = 0.3 * p;
          } else if (tt < imp) {
            const p = (tt - wind) / (imp - wind);
            const e = 1 - (1 - p) ** 3; // explosive ease-out
            th = aimLocal + hook * (-1 + 1.35 * e); // whips THROUGH the aim into follow-through
            r = reach * (0.3 + 0.7 * e);
            drive = 0.3 + 0.7 * e;
          } else {
            const p = (tt - imp) / (1 - imp);
            const rec = 1 - p * (2 - p);
            th = aimLocal + hook * 0.35 * rec;
            r = reach * rec;
            drive = rec;
          }
          weaponAngle = th; // the fist leads along its own travel
          this.swingOffX = Math.cos(th) * r;
          this.swingOffY = Math.sin(th) * r;
          // Body: the punch comes from the HIPS — paper-twist (shoulders turning through), lean into the
          // blow, a dug-in crouch. A mauler commits the whole frame.
          this.body.scaleX *= 1 - (0.12 + 0.1 * heavy) * drive;
          this.body.rotation += (0.1 + 0.09 * heavy) * drive * Math.cos(aimLocal);
          this.body.y += (2.5 + 2.5 * heavy) * s * drive;
          if (heavy) this.body.scaleY *= 1 - 0.06 * drive;
        } else if (style === "thrust") {
          // THRUST — rapier/spear lunge: the blade locks along the aim and the grip STABS forward and back.
          weaponAngle = aimLocal;
          const lunge = TARGET_BODY_H * 0.55;
          const env =
            tt < 0.14
              ? -0.18 * (tt / 0.14) // small draw-back
              : tt < 0.38
                ? -0.18 + 1.18 * (((tt - 0.14) / 0.24) ** 2 * (3 - 2 * ((tt - 0.14) / 0.24))) // stab OUT
                : 1 - ((tt - 0.38) / 0.62) * (2 - (tt - 0.38) / 0.62); // ease back to rest
          this.swingOffX = Math.cos(aimLocal) * lunge * env;
          this.swingOffY = Math.sin(aimLocal) * lunge * env;
          // §40.1 body: the fencer LUNGES behind the stab — lean into the aim + a paper-stretch of the
          // torso along the thrust (scaleX up, scaleY in), sinking slightly as the front leg plants.
          const e = Math.max(0, env);
          this.body.rotation += 0.15 * e * Math.cos(aimLocal);
          this.body.scaleX *= 1 + 0.07 * e;
          this.body.scaleY *= 1 - 0.05 * e;
          this.body.y += 2.5 * s * e;
        } else {
          // ARC (the classic flat sweep) — §20 WYSIWYG: sweep the blade across `swingArc` CENTRED ON THE
          // AIM (frozen at swing-start), so the sprite passes through exactly what the swept hitbox damages.
          const start = aimLocal - def.swingArc / 2;
          const end = aimLocal + def.swingArc / 2;
          const back = start - 0.3; // a quick wind-back just past the start of the sweep
          if (tt < 0.16) {
            weaponAngle = restA + (back - restA) * (tt / 0.16); // wind up
          } else if (tt < 0.74) {
            const p = (tt - 0.16) / 0.58;
            weaponAngle = back + (end - back) * (1 - (1 - p) ** 2); // ease-out sweep through the arc
          } else {
            // §7 v0.105 de-clunk: ease the blade BACK to the rest tilt over the tail of the swing (arrives
            // at restA exactly at tt=1), so there's no discontinuity when the swing window closes.
            const p = (tt - 0.74) / 0.26;
            weaponAngle = end + (restA - end) * (p * (2 - p)); // easeOut return
          }
          // §40.1 body: a light LEAN-THROUGH with the sweep — back on the windup, through on the follow.
          const sw = tt < 0.16 ? -(tt / 0.16) : tt < 0.74 ? -1 + 2 * ((tt - 0.16) / 0.58) : 1 - (tt - 0.74) / 0.26;
          this.body.rotation += 0.07 * sw;
        }
      }
    }
    // Brace overrides the swing: raise the weapon toward a near-horizontal block (business end up).
    if (brace > 0) {
      const guard = -0.2; // near-horizontal, tipped slightly up = a raised guard
      weaponAngle += (guard - weaponAngle) * brace;
    }

    // §7 v0.112 Hands: the front hand still reaches toward the cursor (the aim anchor, direct — no lag on
    // aiming), but the SECONDARY motion is now procedural + input-driven: a fore-aft ARM SWING synced to the
    // stride (opposite its leg), a slow breathing sway when idle, and an INERTIA TRAIL that drags the hands
    // behind the body on any speed/direction change — so the arms read as free-moving weight, not a fixed loop.
    const reach = TARGET_BODY_H * (this.weapons.length > 0 ? 0.1 : 0.28);
    for (const hnd of this.hands) {
      const armPh = legPh + (hnd.front ? 0 : Math.PI); // arms out of phase with each other + the legs
      const swingX = Math.cos(armPh) * s * 8 * gait; // §MADNESS bigger fore-aft arm swing with the walk
      const bobY = Math.abs(Math.sin(legPh)) * s * 2 * gait; // a little vertical with each footfall
      const idleY = Math.sin(t * 2 + (hnd.front ? 0 : 1.3)) * s * 2.5 * (1 - gait); // breathing when idle
      // §MADNESS loose, dangly arms — a big inertia trail so the hands swing behind + overshoot the body on
      // every speed/direction change (the flash-animation follow-through), then settle.
      const trailX = -lagX * this.facing * s * 36;
      const trailY = -lagY * s * 30;
      let hx = hnd.ox + swingX + trailX;
      let hy = hnd.oy + bobY + idleY + trailY;
      if (hnd.front && anim.isSelf && Math.abs(anim.aimX) + Math.abs(anim.aimY) > 0.01) {
        hx += anim.aimX * this.facing * reach; // aim reach is DIRECT (no spring) so the barrel tracks true
        hy += anim.aimY * reach;
      }
      // §40.1 the FRONT hand GRIPS the weapon through the style's positional motion (chop lift/drive, thrust
      // lunge) — the weapon rides this hand, and the 2H block chains the back hand after it, so BOTH hands
      // visibly operate a two-handed swing instead of the blade detaching from a static arm.
      if (hnd.front) {
        hx += this.swingOffX;
        hy += this.swingOffY;
      }
      // §7 v0.111 turn-commit HANDS ("pull the reins"): yank both hands toward the new heading on a hard turn.
      if (commit > 0.01) {
        hx += this.turnDirX * this.facing * commit * s * 13;
        hy += this.turnDirY * commit * s * 13;
      }
      // Brace: draw both hands forward + up into a guard in front of the body.
      if (brace > 0) {
        const bx = TARGET_BODY_H * 0.16;
        const by = hnd.oy - TARGET_BODY_H * 0.08;
        hx += (bx - hx) * brace;
        hy += (by - hy) * brace;
      }
      hnd.img.x = hx;
      hnd.img.y = hy;
    }

    // Two-handed grip: place the back hand UP the haft from the front grip (along the weapon).
    // §40: skipped while an ORBIT slash is live — the orbit pass below owns both hands.
    if (this.weaponDef?.twoHanded && this.orbitT < 0) {
      const front = this.hands.find((h) => h.front);
      const back = this.hands.find((h) => !h.front);
      if (front && back) {
        const haft = TARGET_BODY_H * 0.42;
        back.img.x = front.img.x + Math.cos(weaponAngle) * haft;
        back.img.y = front.img.y + Math.sin(weaponAngle) * haft;
        back.img.rotation = 0;
      }
    }

    // Feet: alternating walk (lift + a small forward/back stride + a toe pivot) BLENDED by gait with a
    // gentle idle float. §7 v0.105 de-clunk: everything scales by `gait`, so the stride/lift/pivot shrink
    // smoothly to zero as you stop (no full-stride jog for a second after release, no foot teleport on the
    // walk↔idle flip); the idle float fades in as (1−gait).
    // §7 v0.112 the step CADENCE is driven by `legPh` (accumulated by DISTANCE, so it matches real speed and
    // freezes when you stop — no jog-in-place). Each foot lifts + strides fore-aft, plus an INERTIA TRAIL that
    // drags the planted foot as the body accelerates/turns (weight), and a breathing float when idle.
    for (let i = 0; i < this.feet.length; i++) {
      const ft = this.feet[i];
      if (!ft) continue;
      const ph = legPh + i * Math.PI; // legs out of phase
      const idle = Math.sin(t * 2.6 + i) * s * 3.5 * (1 - gait);
      const trailX = -lagX * this.facing * s * 20; // §MADNESS looser foot drag on a speed/direction change
      const trailY = -lagY * s * 12;
      ft.img.y = ft.oy - Math.max(0, Math.sin(ph)) * s * 19 * gait + idle + trailY; // §MADNESS higher foot lift
      ft.img.x = ft.ox + Math.cos(ph) * s * 10 * gait + trailX; // stride + drag
      ft.img.rotation = Math.cos(ph) * 0.14 * gait + lagX * this.facing * 0.18; // pivot + lean into accel
    }

    // Weapon(s): held in hand at the angle computed above (upright at rest → chop on swing).
    for (let i = 0; i < this.weapons.length; i++) {
      const w = this.weapons[i];
      if (!w) continue;
      const base = w.baseScale / (this.baseScale || 1); // fixed on-screen weapon size (§29)
      if (this.orbitT >= 0 && i === 0 && this.weaponDef) {
        // §40 FAKE-3D WAIST-ORBIT SLASH — the facing flip's "scale through a plane" trick generalized.
        // The grip travels an ELLIPSE around the waist (the ground circle seen by the game's tilted camera:
        // x = cosθ, y = sinθ·SQ) while the blade points RADIALLY outward. On screen a radial ground vector
        // projects to (cosθ, sinθ·SQ), so the blade's rotation follows that direction and its LENGTH scales
        // by that vector's magnitude — full profile when sweeping left/right, foreshortened "paper sword"
        // pointing toward/away from camera. The far half renders BEHIND the body. Sweep is centred on the
        // frozen aim so the blade still passes through exactly the arc the server damages (§20 WYSIWYG).
        const def = this.weaponDef;
        const SQ = 0.34; // camera tilt: how much a ground circle squashes vertically
        const aimW = Number.isNaN(this.swingAimWorld)
          ? anim.isSelf
            ? Math.atan2(anim.aimY, anim.aimX)
            : anim.aimDir
          : this.swingAimWorld;
        const aimLocal = Math.atan2(Math.sin(aimW), Math.cos(aimW) * this.facing);
        // The aim's azimuth on the GROUND circle (un-squash the screen direction).
        const azAim = Math.atan2(Math.sin(aimLocal) / SQ, Math.cos(aimLocal));
        const tt = this.orbitT;
        let th: number;
        if (this.orbitSpin) {
          // §40.3 WHIRLWIND: full revolutions matching the weapon's full-circle swingArc (2π per turn) —
          // the visual blade edge sweeps exactly what the server's swept damage does. Starts at the aim.
          // §41 SEAMLESS SPAM: a fresh spin eases in then runs LINEAR (constant whirl, no settle-out); a
          // CHAINED spin (spammed/held trigger) is pure linear — since each spin is integer revolutions, the
          // next one starts exactly where this one ends, angle- AND speed-continuous. One endless whirlwind.
          const a = 0.18; // ease-in fraction (C1-continuous into the linear run)
          const e = this.swingChained ? tt : tt < a ? (tt * tt) / (a * (2 - a)) : (2 * tt - a) / (2 - a);
          const turns = Math.max(1, Math.round(def.swingArc / (Math.PI * 2)));
          th = azAim + turns * Math.PI * 2 * e;
        } else {
          const e = tt * tt * (3 - 2 * tt); // smoothstep — wind in, whip through, settle out
          const windup = 1.5; // start this far behind the damage arc…
          const follow = 0.9; // …and carry through past it
          th = azAim - def.swingArc / 2 - windup + (def.swingArc + windup + follow) * e;
        }
        const rx = Math.cos(th);
        const ry = Math.sin(th) * SQ;
        const rlen = Math.hypot(rx, ry); // projected radial length: 1 sideways → SQ toward/away
        const rot = Math.atan2(ry, rx);
        const waistY = TARGET_BODY_H * 0.06;
        const gripR = TARGET_BODY_H * 0.3;
        const gx = rx * gripR;
        const gy = waistY + ry * gripR;
        w.img.setPosition(gx, gy);
        w.img.rotation = rot;
        w.img.setScale(base * rlen, base); // foreshorten the LENGTH only — the paper-sword effect
        // Both hands ride the haft (the orbit owns them during the spin). §40.1 the back hand's spacing keeps
        // a MINIMUM separation — a fully foreshortened radial collapsed both grips onto one point, reading as
        // a one-handed swing; clamping the projected haft (plus a tiny fixed split) keeps two visible grips.
        const front = this.hands.find((h) => h.front);
        const back = this.hands.find((h) => !h.front);
        if (front) front.img.setPosition(gx, gy);
        if (back) {
          const haft = TARGET_BODY_H * 0.42 * Math.max(rlen, 0.5);
          const ux = rlen > 1e-4 ? rx / rlen : 1;
          const uy = rlen > 1e-4 ? ry / rlen : 0;
          back.img.setPosition(gx + ux * haft, gy + uy * haft - TARGET_BODY_H * 0.05);
          back.img.rotation = 0;
        }
        // §40.1/§40.3 the BODY spins the swing (paper-character posing, additive on the frame's base).
        // §41 spins HOLD the whirl to the very end (each revolution set lands facing-normal, so there's no
        // pop) — and a CHAINED spin skips the entry ramp entirely, keeping the body whirling through spam.
        const spinT = this.orbitSpin
          ? this.swingChained
            ? 1
            : Math.min(1, this.orbitT / 0.12)
          : Math.sin(Math.PI * Math.min(1, this.orbitT / 0.9)); // rises, peaks mid-swing, settles
        if (this.orbitSpin) {
          // §40.3 GAREN SPIN — the body WHIRLS with the blade: the facing flip's signed scale-through-zero,
          // continuously. cos(θ) sweeps +1 → 0 → −1 → 0 → +1 each revolution: the torso narrows edge-on and
          // MIRRORS on the far half — on paper art that reads as the character turning full circles. A hard
          // athletic crouch + a dizzy wobble sell the commitment; the label/root are untouched (no UI flip).
          const c = Math.cos(th);
          this.body.scaleX *= (Math.abs(c) < 0.18 ? 0.18 : Math.abs(c)) * (c < 0 ? -1 : 1) * spinT +
            (1 - spinT); // blend the whirl in/out so entry/exit don't pop
          this.body.rotation += 0.06 * Math.sin(th * 2) * spinT; // slight wobble
          this.body.y += 5.5 * s * spinT; // dug-in crouch
          this.body.scaleY *= 1 - 0.09 * spinT;
        } else {
          // ORBIT: the chest TURNS WITH the blade — scale-through-a-plane on the torso (full profile when
          // the blade sweeps the sides, narrowed crossing front/back) + a crouch + lean toward the blade.
          this.body.scaleX *= 1 - 0.24 * (1 - Math.abs(rx)) * spinT; // paper-twist: chest follows the blade
          this.body.rotation += 0.1 * Math.sin(th) * spinT + 0.05 * rx * spinT; // lean toward the blade
          this.body.y += 4.5 * s * spinT; // crouch into the spin
          this.body.scaleY *= 1 - 0.07 * spinT;
        }
        // Depth: the far half of the orbit passes BEHIND the body.
        const behind = Math.sin(th) < 0;
        if (behind !== this.orbitBehind) {
          this.orbitBehind = behind;
          if (behind) this.root.moveBelow(w.img, this.body);
          else this.root.moveAbove(w.img, this.body);
        }
        continue;
      }
      // Orbit just ended → restore the weapon above the body once.
      if (this.orbitBehind && this.orbitT < 0) {
        this.orbitBehind = false;
        this.root.moveAbove(w.img, this.body);
      }
      const off = i === 1 ? 0.32 : 0; // dual back-knife leans a touch differently
      // §40.1 the FRONT HAND already carries swingOff (it grips the weapon through the motion) — the weapon
      // just rides its hand, so blade + both hands travel together.
      w.img.setPosition(w.hand.img.x, w.hand.img.y);
      w.img.rotation = weaponAngle + off;
      // Fixed on-screen weapon size: counter the rig's baseScale (characterScale/tough size-up) so the same
      // weapon reads the SAME size in every hand — the root mirror still flips it for facing.
      w.img.setScale(base);
    }

    // §5 jump hop: §7 v0.105 de-clunk — the synced height arrives in raw 20Hz Euler steps (~15px jumps),
    // visibly chunkier than the smoothed x/y. EASE the rendered lift toward the target (τ≈45ms) so the arc
    // reads continuous, and fire a brief LANDING SQUASH when it returns to the ground.
    const prevHop = this.hopPx;
    this.hopPx += (this.hopTarget - this.hopPx) * (1 - Math.exp((-22 * dtMs) / 1000));
    if (this.hopPx < 0.05 && this.hopTarget < 0.05) this.hopPx = 0;
    if (prevHop > 6 && this.hopPx <= 6 && this.hopTarget < 1) this.landSquash = 1; // touched down
    this.landSquash = Math.max(0, this.landSquash - dtMs / 110); // decays over ~110ms
    // After every part is positioned, lift the whole rig's ART up the arc. Feet lift most (they leave the
    // ground), so the silhouette reads as "off the ground" rather than just sliding up.
    // §33 the JUMP hop plus the permanent COLOSSUS lower-body lift both raise the art (never the shadow).
    const lift = this.hopPx + this.baseLift;
    if (lift > 0.01) {
      for (const p of this.parts) p.y -= lift;
      for (const w of this.weapons) w.img.y -= lift;
      // A touch of squash relief at the apex sells the leap (body stretches up) — from the JUMP only.
      if (this.hopPx > 0.01) this.body.scaleY *= 1 + Math.min(0.12, this.hopPx / 300);
    }
    if (this.landSquash > 0.01) this.body.scaleY *= 1 - 0.14 * this.landSquash; // squash on touchdown
    // §5/§20 the grounded shadow shrinks + fades as the rig rises, so height reads as altitude (the gap
    // between the lifted art and the planted shadow). The shadow itself never lifts.
    const shrink = Math.max(0.42, 1 - this.hopPx / 420);
    this.shadow.setScale(shrink, shrink).setAlpha(0.3 * shrink);
  }
}
