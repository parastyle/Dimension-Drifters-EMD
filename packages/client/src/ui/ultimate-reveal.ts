import {
  UltimateFamily,
  UltimatePhase,
  ultimateFamilyForCode,
  ultimateVariantForCode,
} from "@dd/shared";
import type Phaser from "phaser";

export type UltimateSeqEdge = "none" | "ready" | "cast";

export function ultimateSeqEdge(
  previous: number | undefined,
  next: number,
  charge: number,
  phase: number,
): UltimateSeqEdge {
  if (previous === undefined) return "none";
  const distance = ((next & 0xffff) - (previous & 0xffff)) & 0xffff;
  if (distance === 0 || distance >= 0x8000) return "none";
  return charge >= 100 && phase === UltimatePhase.Idle ? "ready" : "cast";
}

export interface UltimateInputGate {
  alive: boolean;
  modal: boolean;
  nearShop: boolean;
  unlocked: boolean;
  charge: number;
  phase: number;
  pending: boolean;
  doorReturn: boolean;
}

/** Client affordance only. The server repeats every one of these checks authoritatively. */
export function ultimateInputAffordance(gate: UltimateInputGate): "send" | "dry" | "blocked" {
  if (!gate.alive || gate.modal || gate.nearShop) return "blocked";
  if (gate.pending) return "blocked";
  if (gate.doorReturn) return "send";
  if (!gate.unlocked || gate.charge < 100 || gate.phase !== UltimatePhase.Idle) return "dry";
  return "send";
}

export function canReleaseUltimateReveal(
  pending: boolean,
  releaseLatch: boolean,
  alive: boolean,
): boolean {
  return pending && !releaseLatch && alive;
}

export const ULTIMATE_FAMILY_NAME: Readonly<Record<number, string>> = {
  [UltimateFamily.Seismarch]: "SEISMARCH",
  [UltimateFamily.AlphaStrike]: "ALPHA STRIKE",
  [UltimateFamily.SunspiteComet]: "SUNSPITE COMET",
  [UltimateFamily.EventHorizon]: "EVENT HORIZON",
  [UltimateFamily.DimensionDoor]: "DIMENSION DOOR",
};

export const ULTIMATE_FAMILY_COLOR: Readonly<Record<number, number>> = {
  [UltimateFamily.Seismarch]: 0x9fcf8f,
  [UltimateFamily.AlphaStrike]: 0x78c9df,
  [UltimateFamily.SunspiteComet]: 0xd9a85f,
  [UltimateFamily.EventHorizon]: 0x9b75d6,
  [UltimateFamily.DimensionDoor]: 0x8f82d8,
};

export const ULTIMATE_FAMILY_VERB: Readonly<Record<number, string>> = {
  [UltimateFamily.Seismarch]: "F — leap and author the fault line",
  [UltimateFamily.AlphaStrike]: "F — become the six-cut verdict",
  [UltimateFamily.SunspiteComet]: "F — hurl the synchronized comet",
  [UltimateFamily.EventHorizon]: "F — phase through and brand the horde",
  [UltimateFamily.DimensionDoor]: "F — fold distance · F again to return",
};

const VARIANT_NAME: Readonly<Record<string, string>> = {
  dex: "DEX drift",
  int: "INT drift",
  con: "CON drift",
  luk: "LUK drift",
  str: "STR drift",
};

export interface UltimateRevealDescriptor {
  code: number;
  family: number;
  name: string;
  variant: string;
  accent: number;
  verb: string;
}

export function ultimateRevealDescriptor(code: number): UltimateRevealDescriptor {
  const family = ultimateFamilyForCode(code);
  const variant = ultimateVariantForCode(code);
  return {
    code,
    family,
    name: ULTIMATE_FAMILY_NAME[family] ?? "ULTIMATE",
    variant: variant ? (VARIANT_NAME[variant] ?? `${variant.toUpperCase()} drift`) : "",
    accent: ULTIMATE_FAMILY_COLOR[family] ?? 0xc9a84c,
    verb: ULTIMATE_FAMILY_VERB[family] ?? "F — cast ultimate",
  };
}

function colorHex(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}

/** Non-modal paper folio. Scene input and simulation continue while this teaches the new button. */
export function playUltimateReveal(
  scene: Phaser.Scene,
  screenWidth: number,
  screenHeight: number,
  descriptor: UltimateRevealDescriptor,
  reducedMotion: boolean,
): Phaser.GameObjects.Container {
  const width = Math.min(620, Math.max(330, screenWidth - 56));
  const height = 154;
  const paper = scene.add.graphics();
  paper.fillStyle(0x17191f, 0.96).fillRoundedRect(-width / 2, -height / 2, width, height, 8);
  paper
    .lineStyle(3, descriptor.accent, 0.9)
    .strokeRoundedRect(-width / 2, -height / 2, width, height, 8);
  paper.lineStyle(1, 0xf4e8ca, 0.2).lineBetween(-width / 2 + 18, 0, width / 2 - 18, 0);
  const title = scene.add
    .text(0, -43, `ATTUNED — ${descriptor.name}`, {
      fontFamily: "monospace",
      fontSize: "25px",
      color: colorHex(descriptor.accent),
      fontStyle: "bold",
      align: "center",
    })
    .setOrigin(0.5);
  const variant = scene.add
    .text(0, -10, descriptor.variant, {
      fontFamily: "monospace",
      fontSize: "14px",
      color: "#f1e8cf",
      fontStyle: "bold",
    })
    .setOrigin(0.5);
  const verb = scene.add
    .text(0, 31, descriptor.verb, {
      fontFamily: "monospace",
      fontSize: "14px",
      color: "#cbd5df",
      align: "center",
    })
    .setOrigin(0.5);
  const root = scene.add
    .container(screenWidth / 2, Math.min(screenHeight - 140, screenHeight * 0.68), [
      paper,
      title,
      variant,
      verb,
    ])
    .setScrollFactor(0)
    .setDepth(100014)
    .setAlpha(0);
  if (reducedMotion) root.setAlpha(1);
  else root.setScale(0.03, 0.94);
  scene.tweens.add({
    targets: root,
    alpha: 1,
    scaleX: 1,
    scaleY: 1,
    duration: reducedMotion ? 200 : 260,
    ease: "Back.easeOut",
    onComplete: () => {
      scene.tweens.add({
        targets: root,
        alpha: 0,
        y: root.y - (reducedMotion ? 0 : 16),
        delay: 1180,
        duration: 380,
        ease: "Cubic.easeIn",
        onComplete: () => root.destroy(true),
      });
    },
  });
  return root;
}

export function playUltimateStamp(
  scene: Phaser.Scene,
  screenWidth: number,
  screenHeight: number,
  copy: string,
  accent = 0xffd479,
): Phaser.GameObjects.Text {
  const stamp = scene.add
    .text(screenWidth / 2, Math.min(screenHeight - 102, screenHeight * 0.74), copy, {
      fontFamily: "monospace",
      fontSize: "18px",
      color: colorHex(accent),
      backgroundColor: "#17191fe8",
      padding: { x: 12, y: 7 },
      fontStyle: "bold",
    })
    .setScrollFactor(0)
    .setOrigin(0.5)
    .setDepth(100014)
    .setAlpha(0)
    .setScale(1.16);
  scene.tweens.add({
    targets: stamp,
    alpha: 1,
    scale: 1,
    duration: 130,
    ease: "Back.easeOut",
    onComplete: () => {
      scene.tweens.add({
        targets: stamp,
        alpha: 0,
        y: stamp.y - 12,
        delay: 620,
        duration: 260,
        onComplete: () => stamp.destroy(),
      });
    },
  });
  return stamp;
}
