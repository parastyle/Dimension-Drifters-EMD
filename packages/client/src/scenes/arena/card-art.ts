import {
  type Attr,
  type DamageSource,
  RARITIES,
  RARITY_CURSED,
  WEAPONS,
  weaponDamageSources,
} from "@dd/shared";
import Phaser from "phaser";
import { partTexture } from "../../entities/SpriteRig.js";
import { SPRITES } from "../../sprites/manifest.js";

/**
 * §9 weapon-card art + carousel-card builder, extracted from ArenaScene. Pure presentation: bakes the
 * full-bleed card-art texture, draws the icon-driven §9 card and compact dock pieces, and returns the
 * live Text handles the scene refreshes only while the inspector is visible.
 */

/** One inspector card: its container plus the live Text handles refreshed from authoritative state. */
export type Card = {
  id: string;
  container: Phaser.GameObjects.Container;
  /** One live "base + bonus = total" line per damage source (blade / magma / quake / …). */
  sources: { text: Phaser.GameObjects.Text; src: DamageSource }[];
  /** Min-requirement tokens, recoloured green/red vs the player's live attributes. */
  reqTokens: { text: Phaser.GameObjects.Text; attr: Attr; need: number }[];
  /** Charges (thrown, live) or durability (melee, static for now) readout. */
  resource: Phaser.GameObjects.Text;
  /** Paired entries keep the lead card full-size and add one compact, truthful off-hand strip. */
  offSummary: Phaser.GameObjects.Container;
  offSummaryPaper: Phaser.GameObjects.Graphics;
  offName: Phaser.GameObjects.Text;
  offStats: Phaser.GameObjects.Text;
  offGrades: Phaser.GameObjects.Text;
};

/** Lightweight, stat-free roster entry used by the mirrored-L dock. Neighbour chips carry art + a key
 *  badge ONLY (dockux-panel §1.4) — identity at rest is silhouette + colour; the name lives on dwell. */
export type DockChip = {
  id: string;
  container: Phaser.GameObjects.Container;
  art: Phaser.GameObjects.Image;
  paper: Phaser.GameObjects.Graphics;
  order: Phaser.GameObjects.Text;
  pairGlyph: Phaser.GameObjects.Text;
};

/** The authoritative active-weapon core at the dock's bottom-right elbow. `loot` (tier · affix) lives in
 *  the fading `chrome` layer (dockux-panel §1.4): ammo is combat truth, "Rare · Keen" is not. */
export type DockJunction = {
  container: Phaser.GameObjects.Container;
  art: Phaser.GameObjects.Image;
  chrome: Phaser.GameObjects.Container;
  chromePaper: Phaser.GameObjects.Graphics;
  emptyHands: Phaser.GameObjects.Graphics;
  index: Phaser.GameObjects.Text;
  loot: Phaser.GameObjects.Text;
  truth: Phaser.GameObjects.Container;
  truthPaper: Phaser.GameObjects.Graphics;
  resourcePlate: Phaser.GameObjects.Graphics;
  name: Phaser.GameObjects.Text;
  resource: Phaser.GameObjects.Text;
  resource2: Phaser.GameObjects.Text;
};

/** Per-weapon accent colour for card frames (rarity tinting lands with the loot system). Also keys the
 *  pickup-beacon tint in the scene's `syncPickups`. */
export const WEAPON_ACCENT: Record<string, number> = {
  "rusty-cleaver": 0xff8a2b,
  "tombstone-greatsword": 0x9cff3b,
  "twin-bowie-fangs": 0x6fd6ff,
  driftblade: 0x6f8bff,
  "x-sword-neon-katana": 0x5dcaa5,
  "x-sword-bone": 0xff7a3c,
  "x-gun-revolver-cannon": 0xffb24a,
  "x-gun-coffin-shotgun": 0xff8a3c,
  "x-gun-gatling": 0xfff0a0,
  "x-gun-nailgun": 0xd6dde6,
  "x-gun-ricochet-pistol": 0x5dd6ff,
};

/** Grade → chip colour (§10 S/A/B/C/D/E). */
export const GRADE_COL: Record<string, number> = {
  S: 0xffd479,
  A: 0xff8a2b,
  B: 0x9cff3b,
  C: 0x6fd6ff,
  D: 0x6f8bff,
  E: 0x9a9484,
};

/** Bake the FULL-BLEED card art (cover-fit + rounded clip) into a per-card texture so it transforms
 *  cleanly with the carousel (masks don't follow container transforms). Returns the texture key. */
export function bakeCardArt(
  scene: Phaser.Scene,
  id: string,
  W: number,
  H: number,
  R: number,
): string {
  const key = `cardbg-${id}`;
  if (scene.textures.exists(key)) return key;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return key;
  ctx.beginPath();
  ctx.roundRect(0, 0, W, H, R);
  ctx.clip();
  const tex = scene.textures.exists(`card-${id}`) ? `card-${id}` : null;
  // §9 card ids are weapon ids, but several curated weapons borrow another sprite. Resolve that installed
  // part exactly like the rig, including its frame coordinates inside the packed dd-sprites source page.
  const spriteId = WEAPONS[id]?.sprite ?? id;
  const part = SPRITES[spriteId as keyof typeof SPRITES]?.parts[0];
  const tx = part ? partTexture(scene, spriteId, part.role) : null;
  const atlasFrame = tx?.frame ? scene.textures.get(tx.key).get(tx.frame) : null;
  if (tex) {
    const src = scene.textures.get(tex).getSourceImage() as CanvasImageSource & {
      width: number;
      height: number;
    };
    const sc = Math.max(W / src.width, H / src.height);
    const dw = src.width * sc;
    const dh = src.height * sc;
    ctx.drawImage(src, (W - dw) / 2, Math.min(0, (H - dh) * 0.12), dw, dh); // bias to the top
  } else if (tx?.frame && atlasFrame) {
    // No dedicated card art yet → contain-fit the atlas FRAME, not its whole multiatlas source page.
    ctx.fillStyle = "#15120d";
    ctx.fillRect(0, 0, W, H);
    const src = scene.textures.get(tx.key).getSourceImage(tx.frame) as CanvasImageSource;
    const availW = W * 0.86;
    const availH = H * 0.5;
    const sc = Math.min(availW / atlasFrame.cutWidth, availH / atlasFrame.cutHeight);
    const dw = atlasFrame.cutWidth * sc;
    const dh = atlasFrame.cutHeight * sc;
    ctx.drawImage(
      src,
      atlasFrame.cutX,
      atlasFrame.cutY,
      atlasFrame.cutWidth,
      atlasFrame.cutHeight,
      (W - dw) / 2,
      H * 0.07 + (availH - dh) / 2,
      dw,
      dh,
    );
  } else if (tx && scene.textures.exists(tx.key)) {
    // No dedicated card art yet → show the installed weapon sprite (contain-fit, upper area) on a
    // dark ground. §9 the loose-part path remains the fallback for runtime-loaded expansion art.
    ctx.fillStyle = "#15120d";
    ctx.fillRect(0, 0, W, H);
    const src = scene.textures.get(tx.key).getSourceImage() as CanvasImageSource & {
      width: number;
      height: number;
    };
    const availW = W * 0.86;
    const availH = H * 0.5;
    const sc = Math.min(availW / src.width, availH / src.height);
    const dw = src.width * sc;
    const dh = src.height * sc;
    ctx.drawImage(src, (W - dw) / 2, H * 0.07 + (availH - dh) / 2, dw, dh);
  } else {
    ctx.fillStyle = "#15120d";
    ctx.fillRect(0, 0, W, H);
  }
  scene.textures.addCanvas(key, canvas);
  return key;
}

function dockTextResolution(): number {
  return Math.max(2, Math.ceil(window.devicePixelRatio || 1));
}

/** Build a single mutable passive chip. Geometry is applied only when selection/viewport invalidates. */
export function buildDockChip(scene: Phaser.Scene, id: string): DockChip {
  const art = scene.add.image(0, 0, bakeCardArt(scene, id, 212, 296, 14));
  const paper = scene.add.graphics();
  const order = scene.add
    .text(0, 0, "", {
      fontFamily: "monospace",
      fontSize: "11px",
      color: "#f1e8cf",
      fontStyle: "bold",
    })
    .setOrigin(0.5, 0.5)
    .setShadow(0, 1, "#000000", 2, true, true)
    .setResolution(dockTextResolution());
  const pairGlyph = scene.add
    .text(0, 0, "⚯", {
      fontFamily: "sans-serif",
      fontSize: "13px",
      color: "#f1e8cf",
      fontStyle: "bold",
    })
    .setOrigin(0.5)
    .setShadow(0, 1, "#000000", 2, true, true)
    .setResolution(dockTextResolution())
    .setVisible(false);
  const container = scene.add.container(0, 0, [art, paper, order, pairGlyph]);
  return { id, container, art, paper, order, pairGlyph };
}

/** Resize/repaint one passive chip. This is deliberately event-driven rather than a frame update.
 *  Art + a 1 px accent outline (with a 1 px black outer rim) + the key badge only — no name at rest. */
export function layoutDockChip(
  chip: DockChip,
  width: number,
  height: number,
  order: string,
  scale: number,
  paired = false,
): void {
  const accent = WEAPON_ACCENT[chip.id] ?? 0xb9975b;
  chip.art.setCrop(0, 0, 212, 212).setDisplaySize(width, height);
  chip.paper.clear();
  chip.paper.fillStyle(0x000000, 0.22).fillRect(-width / 2 - 3, -height / 2 - 3, width, height);
  // 1 px black outer rim outside the accent line so light-accent chips still separate from bright floors.
  chip.paper
    .lineStyle(1, 0x000000, 0.9)
    .strokeRect(-width / 2 - 1, -height / 2 - 1, width + 2, height + 2);
  chip.paper.lineStyle(1, accent, 0.82).strokeRect(-width / 2, -height / 2, width, height);
  chip.paper
    .lineStyle(1, 0xf1e8cf, 0.24)
    .lineBetween(-width / 2 + 1, -height / 2 + 1, width / 2 - 1, -height / 2 + 1);

  // Key badge — an 18×14 css plate in the chip's outer corner reading `E` / `E2` / `Q` / `Q2`.
  const plateW = 18 * scale;
  const plateH = 14 * scale;
  chip.paper
    .fillStyle(0x0a0805, 0.9)
    .fillRoundedRect(width / 2 - plateW, -height / 2, plateW, plateH, 3)
    .lineStyle(1, 0xcfc6ae, 0.35)
    .strokeRoundedRect(width / 2 - plateW, -height / 2, plateW, plateH, 3);
  chip.order
    .setText(order)
    .setFontSize(Math.max(9, 11 * scale))
    .setPosition(width / 2 - plateW / 2, -height / 2 + plateH / 2);
  chip.pairGlyph
    .setVisible(paired)
    .setFontSize(Math.max(11, 13 * scale))
    .setPosition(-width / 2 + 9 * scale, -height / 2 + 8 * scale);
}

/** Build the fixed active core. Its truth layer (name + ammo badge) remains opaque while art/chrome —
 *  including the tier · affix loot line — fade independently (dockux-panel §1.4). */
export function buildDockJunction(scene: Phaser.Scene): DockJunction {
  const art = scene.add.image(0, 0, bakeCardArt(scene, "fists", 212, 296, 14));
  const chromePaper = scene.add.graphics();
  const emptyHands = scene.add.graphics();
  const index = scene.add
    .text(0, 0, "", {
      fontFamily: "monospace",
      fontSize: "10px",
      color: "#cfc6ae",
      fontStyle: "bold",
    })
    .setOrigin(0, 0)
    .setShadow(0, 1, "#000000", 2, true, true)
    .setResolution(dockTextResolution());
  const loot = scene.add
    .text(0, 0, "", {
      fontFamily: "monospace",
      fontSize: "11px",
      color: "#d8cfb8",
      fontStyle: "bold",
    })
    .setOrigin(0, 1)
    .setShadow(0, 1, "#000000", 2, true, true)
    .setResolution(dockTextResolution());
  const chrome = scene.add.container(0, 0, [chromePaper, emptyHands, loot, index]);
  const truthPaper = scene.add.graphics();
  const resourcePlate = scene.add.graphics();
  const name = scene.add
    .text(0, 0, "Unarmed", {
      fontFamily: "monospace",
      fontSize: "14px",
      color: "#f1e8cf",
      fontStyle: "bold",
    })
    .setOrigin(0, 0)
    .setShadow(0, 1, "#000000", 2, true, true)
    .setResolution(dockTextResolution());
  const resource = scene.add
    .text(0, 0, "", {
      fontFamily: "monospace",
      fontSize: "13px",
      color: "#f1e8cf",
      fontStyle: "bold",
    })
    .setOrigin(1, 0)
    .setShadow(0, 1, "#000000", 2, true, true)
    .setResolution(dockTextResolution());
  const resource2 = scene.add
    .text(0, 0, "", {
      fontFamily: "monospace",
      fontSize: "13px",
      color: "#f1e8cf",
      fontStyle: "bold",
    })
    .setOrigin(1, 0)
    .setShadow(0, 1, "#000000", 2, true, true)
    .setResolution(dockTextResolution());
  const truth = scene.add.container(0, 0, [truthPaper, resourcePlate, name, resource, resource2]);
  const container = scene.add.container(0, 0, [art, chrome, truth]);
  return {
    container,
    art,
    chrome,
    chromePaper,
    emptyHands,
    index,
    loot,
    truth,
    truthPaper,
    resourcePlate,
    name,
    resource,
    resource2,
  };
}

export function bakeSplitDockArt(scene: Phaser.Scene, leadId: string, offId: string): string {
  const key = `dockpair-${leadId}-${offId}`;
  if (scene.textures.exists(key)) return key;
  const size = 212;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return key;
  const drawHalf = (id: string, upperLeft: boolean) => {
    const artKey = bakeCardArt(scene, id, 212, 296, 14);
    const src = scene.textures.get(artKey).getSourceImage() as CanvasImageSource;
    ctx.save();
    ctx.beginPath();
    if (upperLeft) {
      ctx.moveTo(0, 0);
      ctx.lineTo(size, 0);
      ctx.lineTo(0, size);
    } else {
      ctx.moveTo(size, 0);
      ctx.lineTo(size, size);
      ctx.lineTo(0, size);
    }
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(src, 0, 0, size, size, 0, 0, size, size);
    ctx.restore();
  };
  drawHalf(leadId, true);
  drawHalf(offId, false);
  scene.textures.addCanvas(key, canvas);
  return key;
}

/** Swap only authoritative junction art; paired entries bake both card faces into one atomic square. */
export function setDockJunctionLoadout(
  scene: Phaser.Scene,
  junction: DockJunction,
  leadId: string,
  offId?: string,
): void {
  junction.art
    .setTexture(
      offId ? bakeSplitDockArt(scene, leadId, offId) : bakeCardArt(scene, leadId, 212, 296, 14),
    )
    .setCrop(0, 0, 212, 212);
}

/** Colourblind-safe tier pips (dockux-panel §4): 0–6 small diamonds, Common 0 … Ultimate 5; Cursed's 6
 *  draw hollow. Colour stays the fast channel; pips are the truthful one. Pure — draws into `g`. */
export function drawTierPips(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  rarity: number,
  r: number,
): void {
  const tier = RARITIES[rarity];
  if (!tier || rarity <= 0) return;
  const count = rarity === RARITY_CURSED ? 6 : Math.min(5, rarity);
  const hollow = rarity === RARITY_CURSED;
  for (let i = 0; i < count; i++) {
    const cx = x + i * (r * 2 + 2);
    if (hollow) {
      g.lineStyle(1, tier.color, 0.95);
      g.beginPath();
      g.moveTo(cx, y - r);
      g.lineTo(cx + r, y);
      g.lineTo(cx, y + r);
      g.lineTo(cx - r, y);
      g.closePath();
      g.strokePath();
    } else {
      g.fillStyle(tier.color, 0.95);
      g.fillTriangle(cx, y - r, cx + r, y, cx - r, y);
      g.fillTriangle(cx, y + r, cx + r, y, cx - r, y);
    }
  }
}

function textColorInt(text: Phaser.GameObjects.Text, fallback: number): number {
  const c = text.style.color;
  if (typeof c !== "string" || !c.startsWith("#")) return fallback;
  const parsed = Number.parseInt(c.slice(1), 16);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Repaint the junction's paper frame for its current responsive size and loot accent. Type rides the
 *  dockux-panel §1.3 table: name 14 / loot 11 / ammo 13 / index 10 css at d=1, with hard floors, plus
 *  guaranteed backing plates so no glyph ever sits on raw art or raw arena (§1.5). */
export function layoutDockJunction(
  junction: DockJunction,
  size: number,
  accent: number,
  unarmed: boolean,
  dockScale = 1,
  rarity = 0,
  offAccent?: number,
): void {
  const half = size / 2;
  const footerHeight = Math.max(30, size * 0.3);
  junction.art.setDisplaySize(size, size);
  junction.chromePaper.clear();
  junction.chromePaper
    .fillStyle(0x000000, 0.32)
    .fillRect(-half - 5, -half - 5, size, size)
    .lineStyle(1, 0xf1e8cf, 0.24)
    .lineBetween(-half + 1, -half + 1, half - 1, -half + 1)
    .lineStyle(1, 0xcfc6ae, 0.22)
    .lineBetween(-half + 1, -half + 1, -half + 1, half - 1);
  junction.truthPaper.clear();
  junction.truthPaper
    .fillStyle(0x0a0805, 0.9)
    .fillRect(-half, half - footerHeight, size, footerHeight);
  if (offAccent === undefined) {
    junction.truthPaper.lineStyle(3, accent, 0.98).strokeRect(-half, -half, size, size);
  } else {
    junction.truthPaper
      .lineStyle(3, accent, 0.98)
      .lineBetween(-half, -half, half, -half)
      .lineBetween(-half, -half, -half, half)
      .lineStyle(3, offAccent, 0.98)
      .lineBetween(half, -half, half, half)
      .lineBetween(-half, half, half, half)
      .lineStyle(2, 0xf1e8cf, 0.72)
      .lineBetween(half, -half, -half, half);
  }

  junction.emptyHands.clear().setVisible(unarmed);
  if (unarmed) {
    junction.emptyHands
      .fillStyle(0x8f897a, 0.7)
      .fillRoundedRect(-size * 0.18, -size * 0.17, size * 0.36, size * 0.29, size * 0.07)
      .fillCircle(-size * 0.14, -size * 0.2, size * 0.075)
      .fillCircle(-size * 0.045, -size * 0.23, size * 0.075)
      .fillCircle(size * 0.05, -size * 0.22, size * 0.075)
      .fillCircle(size * 0.14, -size * 0.18, size * 0.07);
  }
  junction.index.setFontSize(Math.max(9, 10 * dockScale)).setPosition(-half + 5, -half + 4);
  // Footer line 1 = the weapon name (the one legible name the whole dock buys); line 2 = tier · affix.
  junction.name
    .setFontSize(Math.max(12, size * 0.125))
    .setPosition(-half + 5, half - footerHeight + 3);
  junction.loot.setFontSize(Math.max(10, size * 0.1)).setPosition(-half + 5, half - 3);
  junction.resource.setFontSize(Math.max(11, size * 0.115)).setPosition(half - 5, -half + 4);
  junction.resource2
    .setFontSize(Math.max(11, size * 0.115))
    .setPosition(half - 5, -half + 6 + junction.resource.displayHeight);

  // Backing plates (§1.5): index top-left at 0.78; the ammo/heat badge gets its own pill stroked in the
  // badge's live state colour — the single most-glanced number never sits on raw painted art.
  if (junction.index.text.length > 0) {
    junction.chromePaper
      .fillStyle(0x0a0805, 0.78)
      .fillRoundedRect(
        -half + 5 - 4,
        -half + 4 - 2,
        junction.index.displayWidth + 8,
        junction.index.displayHeight + 4,
        4,
      );
  }
  junction.resourcePlate.clear();
  if (junction.resource.text.length > 0 || junction.resource2.text.length > 0) {
    const rw = Math.max(junction.resource.displayWidth, junction.resource2.displayWidth);
    const rh =
      junction.resource.displayHeight +
      (junction.resource2.text.length > 0 ? junction.resource2.displayHeight + 2 : 0);
    const stateColor =
      junction.resource2.text.length > 0 && junction.resource2.alpha >= junction.resource.alpha
        ? textColorInt(junction.resource2, 0xf1e8cf)
        : textColorInt(junction.resource, 0xf1e8cf);
    junction.resourcePlate
      .fillStyle(0x0a0805, 0.88)
      .fillRoundedRect(half - 5 - rw - 4, -half + 4 - 2, rw + 8, rh + 4, 4)
      .lineStyle(1, stateColor, 0.6)
      .strokeRoundedRect(half - 5 - rw - 4, -half + 4 - 2, rw + 8, rh + 4, 4);
    const drawAmmoBar = (text: Phaser.GameObjects.Text) => {
      if (!text.text) return;
      const fraction = Math.max(0, Math.min(1, Number(text.getData("fraction")) || 0));
      const width = Math.max(26, text.displayWidth);
      const x = half - 5 - width;
      const y = text.y + text.displayHeight - 2;
      const color = textColorInt(text, 0xf1e8cf);
      junction.resourcePlate
        .fillStyle(0x24201a, 0.96)
        .fillRect(x, y, width, 2)
        .fillStyle(color, text.alpha)
        .fillRect(x, y, Math.max(fraction > 0 ? 1 : 0, width * fraction), 2);
    };
    drawAmmoBar(junction.resource);
    drawAmmoBar(junction.resource2);
  }
  // Redundant tier pips ride the loot line (chrome — they fade with it).
  if (rarity > 0 && junction.loot.text.length > 0) {
    const pipR = Math.max(2, junction.loot.displayHeight * 0.18);
    drawTierPips(
      junction.chromePaper,
      -half + 5 + junction.loot.displayWidth + 6 + pipR,
      half - 3 - junction.loot.displayHeight / 2,
      rarity,
      pipR,
    );
  }
}

/** Tiny vector icons for the §9 card (icon-driven — no word labels, §9). Drawn into `g`, centred at
 *  (x,y), fitting roughly a 2·s box, in the given colour. Pure — only touches the passed Graphics. */
export function drawIcon(
  g: Phaser.GameObjects.Graphics,
  kind: string,
  x: number,
  y: number,
  s: number,
  color: number,
): void {
  g.lineStyle(1.7, color, 1).fillStyle(color, 1);
  if (kind === "hit") {
    g.beginPath();
    g.arc(x - s * 0.3, y + s * 0.6, s * 1.5, -Math.PI * 0.58, -Math.PI * 0.04);
    g.strokePath(); // a slash arc
  } else if (kind === "throw") {
    g.beginPath();
    g.arc(x, y, s * 0.95, Math.PI * 0.35, Math.PI * 1.95);
    g.strokePath();
    g.fillTriangle(
      x + s * 0.85,
      y - s * 0.6,
      x + s * 1.35,
      y - s * 0.25,
      x + s * 0.7,
      y + s * 0.05,
    );
  } else if (kind === "shot") {
    // a bullet: a pointed slug with a motion streak (gun damage source)
    g.fillCircle(x + s * 0.55, y, s * 0.5);
    g.fillTriangle(x + s * 1.05, y, x + s * 0.55, y - s * 0.5, x + s * 0.55, y + s * 0.5);
    g.lineStyle(1.6, color, 0.7);
    g.beginPath();
    g.moveTo(x - s, y);
    g.lineTo(x + s * 0.05, y);
    g.strokePath();
  } else if (kind === "quake") {
    for (let i = 1; i <= 3; i++) {
      g.lineStyle(1.5, color, 1 - i * 0.16);
      g.beginPath();
      g.arc(x, y + s * 0.5, s * 0.42 * i, Math.PI * 1.12, Math.PI * 1.88);
      g.strokePath();
    }
  } else if (kind === "chain") {
    g.beginPath();
    g.moveTo(x + s * 0.4, y - s);
    g.lineTo(x - s * 0.35, y);
    g.lineTo(x + s * 0.15, y);
    g.lineTo(x - s * 0.4, y + s);
    g.strokePath(); // lightning bolt
  } else if (kind === "magma") {
    g.fillCircle(x + s * 0.25, y + s * 0.25, s * 0.6); // meteor head
    g.lineStyle(1.5, color, 0.8);
    g.beginPath();
    g.moveTo(x - s * 0.7, y - s * 0.7);
    g.lineTo(x, y);
    g.strokePath(); // trail
  } else if (kind === "blast") {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      g.beginPath();
      g.moveTo(x + Math.cos(a) * s * 0.38, y + Math.sin(a) * s * 0.38);
      g.lineTo(x + Math.cos(a) * s, y + Math.sin(a) * s);
      g.strokePath();
    }
  } else if (kind === "str") {
    g.beginPath();
    g.moveTo(x - s * 0.75, y + s * 0.15);
    g.lineTo(x, y - s * 0.75);
    g.lineTo(x + s * 0.75, y + s * 0.15);
    g.strokePath();
    g.beginPath();
    g.moveTo(x - s * 0.75, y + s * 0.75);
    g.lineTo(x, y - s * 0.15);
    g.lineTo(x + s * 0.75, y + s * 0.75);
    g.strokePath(); // double up-chevron (power)
  } else if (kind === "dex") {
    g.beginPath();
    g.moveTo(x - s * 0.85, y + s * 0.85);
    g.lineTo(x + s * 0.85, y - s * 0.85);
    g.strokePath();
    g.beginPath();
    g.moveTo(x + s * 0.15, y - s * 0.85);
    g.lineTo(x + s * 0.85, y - s * 0.85);
    g.lineTo(x + s * 0.85, y - s * 0.15);
    g.strokePath(); // slim arrow (finesse)
  } else if (kind === "int") {
    g.fillTriangle(x, y - s, x - s * 0.32, y, x + s * 0.32, y);
    g.fillTriangle(x, y + s, x - s * 0.32, y, x + s * 0.32, y);
    g.fillTriangle(x - s, y, x, y - s * 0.32, x, y + s * 0.32);
    g.fillTriangle(x + s, y, x, y - s * 0.32, x, y + s * 0.32); // 4-point sparkle (arcane)
  } else if (kind === "con" || kind === "durability") {
    g.beginPath();
    g.moveTo(x, y - s);
    g.lineTo(x + s * 0.82, y - s * 0.45);
    g.lineTo(x + s * 0.6, y + s * 0.65);
    g.lineTo(x, y + s);
    g.lineTo(x - s * 0.6, y + s * 0.65);
    g.lineTo(x - s * 0.82, y - s * 0.45);
    g.closePath();
    g.strokePath(); // shield
  } else if (kind === "luk") {
    const p: number[] = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 ? s * 0.42 : s;
      p.push(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    g.beginPath();
    g.moveTo(p[0] as number, p[1] as number);
    for (let i = 2; i < p.length; i += 2) g.lineTo(p[i] as number, p[i + 1] as number);
    g.closePath();
    g.strokePath(); // star (luck)
  } else if (kind === "req") {
    g.strokeRoundedRect(x - s * 0.75, y - s * 0.05, s * 1.5, s, 2);
    g.beginPath();
    g.arc(x, y - s * 0.05, s * 0.48, Math.PI, 0);
    g.strokePath(); // padlock
  } else if (kind === "charges") {
    g.fillTriangle(x, y - s, x + s * 0.7, y, x - s * 0.7, y);
    g.fillTriangle(x, y + s, x + s * 0.7, y, x - s * 0.7, y); // diamond pip
  }
}

/** Build one card: full-bleed art + a §5 tooltip slab — name + tag subtitle are the ONLY text; the
 *  damage sources, scaling, requirements and charges/durability are ICON-driven (§9). */
export function buildCard(scene: Phaser.Scene, id: string): Card {
  const def = WEAPONS[id];
  const W = 212;
  const H = 296;
  const R = 14;
  const ART_FRAC = 0.34; // top third is the painted art; the rest is the §5 tooltip slab
  const accent = WEAPON_ACCENT[id] ?? 0xb9975b;
  const accentHex = `#${accent.toString(16).padStart(6, "0")}`;
  const o: Phaser.GameObjects.GameObject[] = [];
  const L = -W / 2;
  const T = -H / 2;
  const padL = L + 13;
  const padR = -L - 13;
  const mk = (
    x: number,
    ty: number,
    size: number,
    color: string,
    str: string,
    ox = 0,
    bold = false,
  ): Phaser.GameObjects.Text =>
    scene.add
      .text(x, ty, str, { fontSize: `${size}px`, color, fontStyle: bold ? "bold" : "normal" })
      .setOrigin(ox, 0);

  // §5 layout: full-bleed painted art up top, a dark tooltip slab over the lower section.
  o.push(scene.add.image(0, 0, bakeCardArt(scene, id, W, H, R)));
  const panel = scene.add.graphics();
  panel.fillStyle(0x0a0805, 0.93).fillRect(L, T + H * ART_FRAC, W, H * (1 - ART_FRAC));
  o.push(panel);

  // Accent (rarity) frame.
  const frame = scene.add.graphics();
  frame.lineStyle(3, accent, 0.92).strokeRoundedRect(L + 1.5, T + 1.5, W - 3, H - 3, R);
  frame.lineStyle(1, 0x000000, 0.4).strokeRoundedRect(L + 5, T + 5, W - 10, H - 10, R - 4);
  o.push(frame);

  let y = T + H * ART_FRAC + 8;

  // Name (rarity-tinted) + subtitle (grip · family · element).
  o.push(mk(padL, y, 17, accentHex, def?.name ?? id, 0, true));
  y += 23;
  // dockux-panel §2.2: grip token + title-case subtitle tokens — `Dual-wield · Blade · Fire`.
  const titleCase = (token: string) => token.charAt(0).toUpperCase() + token.slice(1);
  const grip = def?.dual ? "Dual-wield" : def?.twoHanded ? "Two-handed" : "One-handed";
  const sub = def ? `${grip} · ${titleCase(def.tags.family)} · ${titleCase(def.tags.element)}` : "";
  o.push(mk(padL, y, 10, "#b9b3a3", sub));
  y += 15;
  const div = scene.add.graphics();
  div.lineStyle(1, accent, 0.3).lineBetween(padL, y, padR, y);
  o.push(div);
  y += 9;

  // ICON-DRIVEN (§9): one damage-type ICON per §14 source + its live "base + bonus = total" — no words.
  const icons = scene.add.graphics();
  o.push(icons);
  const sources: { text: Phaser.GameObjects.Text; src: DamageSource }[] = [];
  for (const src of (def ? weaponDamageSources(def) : []).slice(0, 4)) {
    drawIcon(icons, src.label, padL + 6, y + 7, 6, accent);
    if (src.count > 1) o.push(mk(padL + 15, y + 1, 10, "#8f897a", `×${src.count}`));
    const eqText = mk(padR, y, 13, "#ffd479", "", 1, true);
    sources.push({ text: eqText, src });
    o.push(eqText);
    y += 18;
  }
  y += 6;

  // Scaling: an ATTRIBUTE ICON + its grade letter (colour = grade) per scaling attribute.
  const grades = def?.scalingGrades ?? { str: "B" };
  let cx = padL;
  for (const [attr, g] of Object.entries(grades) as [Attr, string][]) {
    const col = GRADE_COL[g] ?? 0x9a9484;
    const cw = 40;
    const chip = scene.add.graphics();
    chip.fillStyle(0x000000, 0.4).fillRoundedRect(cx, y, cw, 18, 5);
    chip.lineStyle(1, col, 0.7).strokeRoundedRect(cx, y, cw, 18, 5);
    o.push(chip);
    drawIcon(icons, attr, cx + 11, y + 9, 6, 0xcfc6ae);
    o.push(
      scene.add
        .text(cx + cw - 7, y + 9, g, {
          fontSize: "13px",
          color: `#${col.toString(16).padStart(6, "0")}`,
          fontStyle: "bold",
        })
        .setOrigin(1, 0.5),
    );
    cx += cw + 6;
  }
  y += 25;

  // Minimum requirements: a PADLOCK + (attribute icon · number) per requirement. The NUMBER recolours
  // green/red met/unmet vs the player's live attributes (updateCarousel).
  const reqTokens: { text: Phaser.GameObjects.Text; attr: Attr; need: number }[] = [];
  const reqEntries = Object.entries(def?.requirements ?? {}) as [Attr, number][];
  if (reqEntries.length > 0) {
    drawIcon(icons, "req", padL + 6, y + 6, 6, 0x8f897a);
    let rx = padL + 22;
    for (const [attr, need] of reqEntries) {
      drawIcon(icons, attr, rx + 5, y + 6, 6, 0xb9b3a3);
      const tk = mk(rx + 14, y, 12, "#cfc6ae", String(need), 0, true);
      reqTokens.push({ text: tk, attr, need });
      o.push(tk);
      rx += 44;
    }
  }

  // Charges (thrown, live) or durability (melee) — an ICON + a live number, anchored at the card bottom.
  const resY = H / 2 - 22;
  drawIcon(icons, def?.thrown ? "charges" : "durability", padL + 6, resY + 6, 6, accent);
  const resource = mk(padL + 17, resY, 12, accentHex, "", 0, true);
  o.push(resource);

  // Pair-only summary strip. It stays hidden for ordinary cards and intentionally overlays the quiet
  // bottom resource row when shown: one compact strip is clearer than shrinking the lead's full card.
  const offSummaryPaper = scene.add.graphics();
  offSummaryPaper
    .fillStyle(0x070503, 0.97)
    .fillRect(L + 3, H / 2 - 68, W - 6, 64)
    .lineStyle(1, 0xcfc6ae, 0.5)
    .lineBetween(L + 4, H / 2 - 68, -L - 4, H / 2 - 68);
  const offName = mk(padL, H / 2 - 64, 12, "#f1e8cf", "", 0, true);
  const offStats = mk(padL, H / 2 - 46, 10, "#d8cfb8", "");
  const offGrades = mk(padL, H / 2 - 30, 9, "#9fb0c2", "");
  const offSummary = scene.add
    .container(0, 0, [offSummaryPaper, offName, offStats, offGrades])
    .setVisible(false);
  o.push(offSummary);

  // Crisp text — Phaser Text defaults to resolution 1, which blurs on high-DPI + when scaled.
  const res = Math.max(2, Math.ceil(window.devicePixelRatio || 1));
  for (const obj of o) if (obj instanceof Phaser.GameObjects.Text) obj.setResolution(res);
  for (const text of [offName, offStats, offGrades]) {
    text.setResolution(res).setShadow(0, 1, "#000000", 2, true, true);
  }

  const container = scene.add.container(0, 0, o).setScrollFactor(0).setDepth(100000);
  return {
    id,
    container,
    sources,
    reqTokens,
    resource,
    offSummary,
    offSummaryPaper,
    offName,
    offStats,
    offGrades,
  };
}
