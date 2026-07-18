import { GEAR_SLOTS, type GearId, type GearSlot } from "@dd/shared";
import type Phaser from "phaser";
import {
  assembleBoilerplate,
  assembleGearLoadout,
  boilerplateTextureKey,
  ensureBoilerplateTextures,
  ensureGearAssemblyTextures,
  ensureGearPartFrame,
  GEAR_PARTS_MANIFEST,
  type GearAssemblyPart,
  type GearLoadoutAssembly,
  type GearTextureState,
  gearTextureKey,
} from "../../sprites/gear-parts.js";
import { WARDROBE_LAYOUT } from "./layout.js";

interface PreviewBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

interface PreviewNode {
  image: Phaser.GameObjects.Image;
  depth: number;
  order: number;
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  gear?: GearAssemblyPart;
}

const TARGET_BODY_HEIGHT = 76;

function emptyBounds(): PreviewBounds {
  return { minX: -42, minY: -48, maxX: 42, maxY: 54 };
}

function expandRotatedBounds(
  bounds: PreviewBounds,
  x: number,
  y: number,
  scaleX: number,
  scaleY: number,
  rotation: number,
  left: number,
  top: number,
  right: number,
  bottom: number,
): void {
  const cosine = Math.cos(rotation);
  const sine = Math.sin(rotation);
  for (const localX of [left, right]) {
    for (const localY of [top, bottom]) {
      const dx = localX * scaleX;
      const dy = localY * scaleY;
      const px = x + cosine * dx - sine * dy;
      const py = y + sine * dx + cosine * dy;
      bounds.minX = Math.min(bounds.minX, px);
      bounds.minY = Math.min(bounds.minY, py);
      bounds.maxX = Math.max(bounds.maxX, px);
      bounds.maxY = Math.max(bounds.maxY, py);
    }
  }
}

function expandGearBounds(bounds: PreviewBounds, node: PreviewNode): void {
  const spec = node.gear;
  if (!spec) return;
  const alpha = spec.source.alphaBounds;
  expandRotatedBounds(
    bounds,
    node.x,
    node.y,
    node.scaleX,
    node.scaleY,
    node.rotation,
    alpha.left - spec.source.pivotSource.x,
    alpha.top - spec.source.pivotSource.y,
    alpha.left + alpha.width - spec.source.pivotSource.x,
    alpha.top + alpha.height - spec.source.pivotSource.y,
  );
}

function topSocketPosition(node: PreviewNode): { x: number; y: number } {
  const spec = node.gear;
  const top = spec?.topSocketSource;
  if (!spec || !top) {
    return {
      x: node.x,
      y: node.y - TARGET_BODY_HEIGHT * (spec?.stackScale ?? 1) * 0.5,
    };
  }
  const localX = (top.x - spec.source.pivotSource.x) * node.scaleX;
  const localY = (top.y - spec.source.pivotSource.y) * node.scaleY;
  const cosine = Math.cos(node.rotation);
  const sine = Math.sin(node.rotation);
  return {
    x: node.x + cosine * localX - sine * localY,
    y: node.y + sine * localX + cosine * localY,
  };
}

function loadoutKey(loadout: Readonly<Record<GearSlot, GearId>>, prestige: number): string {
  return `${GEAR_SLOTS.map((slot) => loadout[slot]).join("|")}|${prestige}`;
}

/**
 * Menu-only retained composite. It deliberately consumes the same validated manifest, cropped frames,
 * receiver sockets, and prestige-hat stacking math as SpriteRig, while owning no gameplay transforms.
 */
export class WardrobeCharacterPreview {
  readonly root: Phaser.GameObjects.Container;

  private readonly artRoot: Phaser.GameObjects.Container;
  private readonly shadow: Phaser.GameObjects.Ellipse;
  private readonly status: Phaser.GameObjects.Text;
  private assembly?: GearLoadoutAssembly;
  private currentKey = "";
  private renderedKey = "";
  private waitingForLoad = false;
  private alive = true;

  private readonly onLoadComplete = (): void => {
    this.waitingForLoad = false;
    if (this.alive) this.syncArt();
  };

  constructor(private readonly scene: Phaser.Scene) {
    const art = WARDROBE_LAYOUT.previewArt;
    const caption = WARDROBE_LAYOUT.previewCaption;
    const status = WARDROBE_LAYOUT.previewStatus;
    const centerX = art.x + art.width / 2;
    this.shadow = scene.add
      .ellipse(centerX, art.y + art.height - 12, 126, 20, 0x000000, 0.42)
      .setOrigin(0.5);
    this.artRoot = scene.add.container(0, 0);
    const captionText = scene.add
      .text(
        caption.x + caption.width / 2,
        caption.y + caption.height / 2,
        "DRIFTER · EQUIPPED COMPOSITE",
        {
          fontFamily: "monospace",
          fontSize: "10px",
          color: "#b8b1c4",
          fontStyle: "bold",
        },
      )
      .setOrigin(0.5);
    this.status = scene.add
      .text(status.x + status.width / 2, status.y + status.height / 2, "ASSEMBLING EQUIPPED ART…", {
        fontFamily: "monospace",
        fontSize: "8px",
        color: "#6f8994",
      })
      .setOrigin(0.5);
    this.root = scene.add.container(0, 0, [this.shadow, this.artRoot, captionText, this.status]);
    scene.events.once("shutdown", () => {
      this.alive = false;
      scene.load.off("complete", this.onLoadComplete);
    });
  }

  refresh(loadout: Readonly<Record<GearSlot, GearId>>, prestige: number): void {
    const manifest = GEAR_PARTS_MANIFEST;
    if (!manifest) {
      this.status.setText("PREVIEW ART CONTRACT UNAVAILABLE").setColor("#ff9a6a");
      this.artRoot.removeAll(true);
      this.shadow.setVisible(false);
      return;
    }
    const boundedPrestige = Number.isFinite(prestige) ? Math.max(0, Math.floor(prestige)) : 0;
    const key = loadoutKey(loadout, boundedPrestige);
    if (key !== this.currentKey || !this.assembly) {
      this.currentKey = key;
      this.assembly = assembleGearLoadout(manifest, loadout, boundedPrestige);
      this.renderedKey = "";
    }
    this.syncArt();
  }

  private armLoadCompletion(): void {
    if (this.waitingForLoad) return;
    this.waitingForLoad = true;
    this.scene.load.once("complete", this.onLoadComplete);
  }

  private syncArt(): void {
    const manifest = GEAR_PARTS_MANIFEST;
    const assembly = this.assembly;
    if (!manifest || !assembly) return;
    const boilerplateState = ensureBoilerplateTextures(this.scene, manifest);
    const gearState = ensureGearAssemblyTextures(this.scene, assembly);
    if (boilerplateState === "pending" || gearState === "pending") this.armLoadCompletion();

    const renderKey = `${this.currentKey}|${boilerplateState}|${gearState}`;
    if (renderKey === this.renderedKey) return;
    this.renderedKey = renderKey;
    if (boilerplateState !== "ready") {
      this.artRoot.removeAll(true);
      this.shadow.setVisible(false);
      this.setStatus(boilerplateState, gearState);
      return;
    }

    this.rebuildComposite(assembly);
    this.setStatus(boilerplateState, gearState);
  }

  private setStatus(boilerplate: GearTextureState, gear: GearTextureState): void {
    if (boilerplate === "missing") {
      this.status.setText("BOILERPLATE ART UNAVAILABLE").setColor("#ff9a6a");
    } else if (boilerplate === "pending") {
      this.status.setText("ASSEMBLING EQUIPPED ART…").setColor("#6f8994");
    } else if (gear === "pending") {
      this.status.setText("EQUIPPED LAYERS LOADING…").setColor("#6f8994");
    } else if (gear === "missing") {
      this.status.setText("SOCKET VERIFIED · SOME ART UNAVAILABLE").setColor("#ffb24a");
    } else {
      this.status.setText("MANIFEST · SOCKET VERIFIED").setColor("#6f8994");
    }
  }

  private rebuildComposite(assembly: GearLoadoutAssembly): void {
    const manifest = GEAR_PARTS_MANIFEST;
    if (!manifest) return;
    this.artRoot.removeAll(true);
    const bounds = emptyBounds();
    const nodes: PreviewNode[] = [];
    const receivers = new Map<string, PreviewNode>();
    const boilerplate = assembleBoilerplate(manifest, TARGET_BODY_HEIGHT);
    let order = 0;
    for (const part of boilerplate.parts) {
      const image = this.scene.add
        .image(part.x, part.y, boilerplateTextureKey(part.source.id))
        .setOrigin(part.originX, part.originY)
        .setScale(part.scale)
        .setRotation(part.rotation);
      const node: PreviewNode = {
        image,
        depth: part.depth,
        order: order++,
        x: part.x,
        y: part.y,
        scaleX: part.scale,
        scaleY: part.scale,
        rotation: part.rotation,
      };
      nodes.push(node);
      receivers.set(part.source.id, node);
    }

    const body = receivers.get("body");
    if (!body) return;
    const hats: GearAssemblyPart[] = [];
    for (const spec of assembly.parts) {
      if (spec.stackIndex >= 0) hats.push(spec);
      else {
        const node = this.createGearNode(spec, body, receivers, order++);
        if (!node) continue;
        nodes.push(node);
        expandGearBounds(bounds, node);
      }
    }

    hats.sort((a, b) => a.stackIndex - b.stackIndex);
    let below: PreviewNode | undefined;
    for (const spec of hats) {
      const node = this.createGearNode(spec, body, receivers, order++, below);
      if (!node) continue;
      nodes.push(node);
      expandGearBounds(bounds, node);
      below = node;
    }

    nodes.sort((a, b) => a.depth - b.depth || a.order - b.order);
    this.artRoot.add(nodes.map((node) => node.image));
    const art = WARDROBE_LAYOUT.previewArt;
    const width = Math.max(1, bounds.maxX - bounds.minX);
    const height = Math.max(1, bounds.maxY - bounds.minY);
    const scale = Math.min(1.65, (art.width * 0.9) / width, (art.height * 0.92) / height);
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    this.artRoot
      .setScale(scale)
      .setPosition(
        art.x + art.width / 2 - centerX * scale,
        art.y + art.height / 2 - centerY * scale,
      );
    this.shadow.setVisible(true).setScale(Math.min(1, Math.max(0.56, scale / 1.45)), 1);
  }

  private createGearNode(
    spec: GearAssemblyPart,
    body: PreviewNode,
    receivers: ReadonlyMap<string, PreviewNode>,
    order: number,
    belowHat?: PreviewNode,
  ): PreviewNode | undefined {
    const frame = ensureGearPartFrame(this.scene, spec);
    if (!frame) return undefined;
    let x: number;
    let y: number;
    let scaleX: number;
    let scaleY: number;
    let rotation: number;
    if (belowHat) {
      const socket = topSocketPosition(belowHat);
      x = socket.x;
      y = socket.y;
      scaleX = body.scaleX * spec.source.mountScale * spec.stackScale;
      scaleY = body.scaleY * spec.source.mountScale * spec.stackScale;
      rotation = body.rotation + spec.rotation;
    } else if (
      spec.source.receiver === "hand-l" ||
      spec.source.receiver === "hand-r" ||
      spec.source.receiver === "foot-l" ||
      spec.source.receiver === "foot-r"
    ) {
      const receiver = receivers.get(spec.source.receiver);
      if (!receiver) return undefined;
      x = receiver.x;
      y = receiver.y;
      scaleX = receiver.scaleX * spec.source.mountScale;
      scaleY = receiver.scaleY * spec.source.mountScale;
      rotation = receiver.rotation + spec.rotation;
    } else {
      x = spec.source.receiverAnchor.xL * manifestBodyHeight() * body.scaleX;
      y = spec.source.receiverAnchor.yL * manifestBodyHeight() * body.scaleY;
      scaleX = body.scaleX * spec.source.mountScale * spec.stackScale;
      scaleY = body.scaleY * spec.source.mountScale * spec.stackScale;
      rotation = body.rotation + spec.rotation;
    }
    const image = this.scene.add
      .image(x, y, gearTextureKey(spec.item), frame)
      .setOrigin(spec.originX, spec.originY)
      .setScale(scaleX, scaleY)
      .setRotation(rotation);
    return { image, depth: spec.depth, order, x, y, scaleX, scaleY, rotation, gear: spec };
  }
}

function manifestBodyHeight(): number {
  return GEAR_PARTS_MANIFEST?.socketFrame.bodyHeightL ?? 512;
}
