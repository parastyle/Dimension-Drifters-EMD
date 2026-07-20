import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const rigSource = readFileSync(
  new URL("../packages/client/src/entities/SpriteRig.ts", import.meta.url),
  "utf8",
);
const arenaSource = readFileSync(
  new URL("../packages/client/src/scenes/ArenaScene.ts", import.meta.url),
  "utf8",
);
const poseSource = readFileSync(
  new URL("../packages/client/src/sprites/pose-language.ts", import.meta.url),
  "utf8",
);

function methodBody(source: string, signature: string, nextSignature: string): string {
  const start = source.indexOf(signature);
  const end = source.indexOf(nextSignature, start + signature.length);
  if (start < 0 || end < 0) throw new Error(`missing source seam ${signature}`);
  return source.slice(start, end);
}

describe("flourish implementation ownership panel", () => {
  it("routes authored head performance only through the existing floating-head spring input", () => {
    const headSync = methodBody(
      rigSource,
      "private syncBoilerplateHeadPose(",
      "private topSocketPosition(",
    );
    expect(headSync).toContain("input.authoredOffsetX =");
    expect(headSync).toContain("this.flourishHeadX");
    expect(headSync).toContain("input.authoredOffsetY =");
    expect(headSync).toContain("this.flourishHeadY");
    expect(headSync).toContain("stepFloatingHeadSpring(this.floatingHeadSpring, input)");
    expect(rigSource).not.toMatch(/flourishHead(?:X|Y).*scene\.tweens/);
  });

  it("cancels at strong action APIs before those actions can sample", () => {
    const swing = methodBody(rigSource, "triggerSwing(", "/** Sample a horde-melee anticipation");
    const brace = methodBody(rigSource, "triggerBrace(", "/** §8 Brand augment");
    expect(swing.indexOf('this.cancelFlourish("attack-input")')).toBeGreaterThanOrEqual(0);
    expect(swing.indexOf('this.cancelFlourish("attack-input")')).toBeLessThan(
      swing.indexOf("this.swingStart = timeMs"),
    );
    expect(brace).toContain('this.cancelFlourish("brace")');
    expect(rigSource).toContain('this.cancelFlourish("anim-input")');
    expect(rigSource).toContain('this.cancelFlourish("stronger-owner")');
  });

  it("keeps terminal eligibility tied to live sequence lengths and dual bar length", () => {
    expect(rigSource).toContain("isTerminalFlourishStep(step, sequence.length)");
    expect(rigSource).toContain("isTerminalFlourishStep(pairStep, DUAL_MELEE_PAIR_BAR.length)");
    expect(rigSource).not.toMatch(/terminalFlourishHand[^\n]*(?:===|==)\s*(?:2|5)/);
  });

  it("uses the equip convergence point once and starts incoming draw without a stow queue", () => {
    const equipWeapons = methodBody(
      arenaSource,
      "private equipWeapons(): void",
      "/** Invert the existing delayed server-timeline mapper",
    );
    expect(equipWeapons.match(/beginWeaponSwap/g)).toHaveLength(1);
    expect(arenaSource.match(/beginWeaponSwap/g)).toHaveLength(1);
    expect(equipWeapons).toContain("rig.equipWeapon(spriteId, def, manifest)");
    const completeSwap = methodBody(
      rigSource,
      "private completePendingWeaponSwap(): void",
      "private armAfterAttack(",
    );
    expect(completeSwap).toContain("this.startIncomingDraw(epochMs)");
    expect(completeSwap).not.toMatch(/timer|tween|delayedCall|await|Promise/);
  });

  it("keeps the flourish sampler allocation-free and free of tween/timer action clocks", () => {
    const sampler = methodBody(
      poseSource,
      "export function sampleFlourish(",
      "export type PoseActionPhase",
    );
    expect(sampler).not.toMatch(/\bnew\b|\[\]|Object\.|\.map\(|\.filter\(|\.reduce\(/);
    const runtime = methodBody(
      rigSource,
      "private startFlourishChannel(",
      "/** Allocation-free lifetime reset",
    );
    expect(runtime).not.toMatch(/scene\.tweens|delayedCall|setTimeout|Promise|await/);
  });

  it("retains raw local attack intent even when cooldown or acceptance rejects the request", () => {
    const animate = rigSource.slice(
      rigSource.indexOf("animate(timeMs: number, anim: RigAnim): void"),
    );
    expect(animate).toContain("this.scene.input?.activePointer?.rightButtonDown?.()");
    expect(animate).toContain("const flourishAttackIntent");
    expect(animate).toContain('this.cancelFlourish("anim-input")');
  });

  it("advances observed swap identity before lazy-art return and explicitly retries the pending attach", () => {
    const equipWeapons = methodBody(
      arenaSource,
      "private equipWeapons(): void",
      "/** Invert the existing delayed server-timeline mapper",
    );
    expect(equipWeapons).toContain("const retryingLazyArt =");
    expect(equipWeapons).toContain("rig.weaponSwapPending || this.pendingArt.has(spriteId)");
    expect(equipWeapons.indexOf("this.equipped.set(id, player.weapon)")).toBeLessThan(
      equipWeapons.indexOf("if (!this.ensureWeaponArt(spriteId))"),
    );
  });

  it("does not let Last Word's retained page event cancel its own flourish", () => {
    const animate = rigSource.slice(
      rigSource.indexOf("animate(timeMs: number, anim: RigAnim): void"),
    );
    expect(animate).toContain("const tomeFlourishOwnsPage =");
    expect(animate).toContain("this.tome && !tomeFlourishOwnsPage");
  });
});

// BAR-4 FIX — append-only inspector coverage for the Arena-to-rig frame-zero seam.
describe("flourish raw Arena cancellation panel", () => {
  it("captures every named raw action, including rejected requests, in one retained frame sample", () => {
    expect(arenaSource).toContain("private readonly rawFlourishIntent: RawFlourishIntent");
    expect(arenaSource).toContain("rawFlourishIntent.attack =");
    expect(arenaSource).toContain("rightButtonDown()");
    expect(arenaSource).toContain("rawFlourishIntent.parryOrBrace =");
    expect(arenaSource).toContain("leftButtonDown()");
    expect(arenaSource).toContain("rawFlourishIntent.jumpOrDodge =");
    expect(arenaSource).toContain("shiftSlidePressed");
    expect(arenaSource).toContain("ctrlSlidePressed");
    expect(arenaSource).toContain("rawFlourishIntent.interaction = weaponInput.pickup");
    expect(arenaSource).toContain(
      "rawFlourishIntent.weaponSelection = !!selfP && weaponInput.cycle",
    );
  });

  it("derives cancellation movement from desired WASD axes and shares those exact axes with net input", () => {
    const update = arenaSource.slice(arenaSource.indexOf("override update("));
    expect(update).toContain("rawFlourishIntent.desiredMoveX = levelWindowInputBlocked");
    expect(update).toContain("rawFlourishIntent.desiredMoveY = levelWindowInputBlocked");
    expect(update).toContain("rawFlourishIntentCancels(");
    expect(update).toContain(
      "rawFlourishIntent.desiredMoveX,\n      rawFlourishIntent.desiredMoveY,",
    );
    const movementIntent = methodBody(
      rigSource,
      "export function flourishMovementIntent(",
      "/** One per-frame Arena capture",
    );
    expect(movementIntent).toContain("MOVE_HITCH_MIN_ANGLE");
    expect(movementIntent).not.toMatch(/render|displacement|anim\.move|speed/);
  });

  it("cancels the self rig before hit-stop gating and before animateBlobs samples a pose", () => {
    const update = arenaSource.slice(arenaSource.indexOf("override update("));
    const captureAt = update.indexOf("const cancelFlourishThisFrame =");
    const cancelAt = update.indexOf('cancelFlourish("raw-arena-input")');
    const freezeGateAt = update.indexOf("if (this.time.now >= this.frozenUntil)");
    const animateAt = update.indexOf("this.animateBlobs(deltaMs)");
    expect(captureAt).toBeGreaterThanOrEqual(0);
    expect(cancelAt).toBeGreaterThan(captureAt);
    expect(cancelAt).toBeLessThan(freezeGateAt);
    expect(freezeGateAt).toBeLessThan(animateAt);
  });

  it("does not add bag, shop, or menu keys to the raw cancellation grammar", () => {
    const decision = methodBody(
      rigSource,
      "export function rawFlourishIntentCancels(",
      "export function nextFlourishStreakCount(",
    );
    expect(decision).not.toMatch(/bag|shop|menu|TAB|ESC|ultimate/);
  });
});
