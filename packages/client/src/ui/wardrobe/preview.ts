import { GEAR_CATALOG, GEAR_SLOTS, type GearId, type GearSlot, isGearId } from "@dd/shared";
import type Phaser from "phaser";
import {
  assembleBoilerplate,
  assembleGearLoadout,
  type BoilerplateAssemblyPart,
  boilerplateTextureKey,
  ensureGearAssemblyTextures,
  ensureGearPartFrame,
  GEAR_BAKE_FRAMES,
  GEAR_BAKED_PART_IDS,
  GEAR_PARTS_MANIFEST,
  type GearAssemblyPart,
  type GearBakedPartId,
  type GearExtraAssembly,
  type GearLoadoutAssembly,
  type GearPartsManifest,
  gearTextureKey,
  isGearReplacementManifest,
  MAX_HAT_SLOTS,
} from "../../sprites/gear-parts.js";
import {
  type GearTextureBakeAcquireInput,
  type GearTextureBakeLease,
  gearTextureBakeCacheForScene,
} from "../../sprites/gear-texture-baker.js";
import { WARDROBE_LAYOUT } from "./layout.js";

export interface WardrobePreviewBounds {
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
  boilerplate?: BoilerplateAssemblyPart;
  gear?: GearAssemblyPart;
}

export interface WardrobePreviewBakeCache {
  acquireForGeneration(
    input: GearTextureBakeAcquireInput,
    generation: number,
    isCurrent: (generation: number) => boolean,
  ): Promise<GearTextureBakeLease | null>;
}

export interface WardrobePreviewDependencies {
  readonly manifest?: GearPartsManifest | null;
  readonly bakeCache?: WardrobePreviewBakeCache;
}

const TARGET_BODY_HEIGHT = 76;

function emptyBounds(): WardrobePreviewBounds {
  return {
    minX: Number.POSITIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
  };
}

function finiteBounds(bounds: WardrobePreviewBounds): WardrobePreviewBounds {
  if (
    Number.isFinite(bounds.minX) &&
    Number.isFinite(bounds.minY) &&
    Number.isFinite(bounds.maxX) &&
    Number.isFinite(bounds.maxY)
  ) {
    return bounds;
  }
  return { minX: -42, minY: -48, maxX: 42, maxY: 54 };
}

function expandRotatedBounds(
  bounds: WardrobePreviewBounds,
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

function isBakedPartId(value: string): value is GearBakedPartId {
  return (GEAR_BAKED_PART_IDS as readonly string[]).includes(value);
}

function expandFixedPartBounds(bounds: WardrobePreviewBounds, node: PreviewNode): void {
  const partId = node.boilerplate?.source.id;
  if (!partId || !isBakedPartId(partId)) return;
  const frame = GEAR_BAKE_FRAMES[partId];
  expandRotatedBounds(
    bounds,
    node.x,
    node.y,
    node.scaleX,
    node.scaleY,
    node.rotation,
    -frame.origin.x * frame.width,
    -frame.origin.y * frame.height,
    (1 - frame.origin.x) * frame.width,
    (1 - frame.origin.y) * frame.height,
  );
}

function expandExtraBounds(bounds: WardrobePreviewBounds, node: PreviewNode): void {
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

/** The preview's six-part envelope is frozen by the replacement contract, never by garment alpha. */
export function wardrobeFixedPartBounds(
  manifest: GearPartsManifest,
  targetBodyHeight = TARGET_BODY_HEIGHT,
): WardrobePreviewBounds {
  const bounds = emptyBounds();
  for (const [order, part] of assembleBoilerplate(manifest, targetBodyHeight).parts.entries()) {
    expandFixedPartBounds(bounds, {
      image: undefined as unknown as Phaser.GameObjects.Image,
      depth: part.depth,
      order,
      x: part.x,
      y: part.y,
      scaleX: part.scale,
      scaleY: part.scale,
      rotation: part.rotation,
      boilerplate: part,
    });
  }
  return finiteBounds(bounds);
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

function loadoutKey(
  loadout: Readonly<Record<GearSlot, GearId>>,
  prestige: number,
  previewId?: GearId,
): string {
  return `${GEAR_SLOTS.map((slot) => loadout[slot]).join("|")}|${prestige}|${previewId ?? "equipped"}`;
}

/**
 * Menu-only retained pose consumer. Recipe selection and rendering are owned by the exact scene-scoped
 * bake cache used by SpriteRig; this class only places its six handles and shared cloak/hat extras.
 */
export class WardrobeCharacterPreview {
  readonly root: Phaser.GameObjects.Container;

  private readonly artRoot: Phaser.GameObjects.Container;
  private readonly shadow: Phaser.GameObjects.Ellipse;
  private readonly caption: Phaser.GameObjects.Text;
  private readonly status: Phaser.GameObjects.Text;
  private readonly manifest: GearPartsManifest | null;
  private readonly replacementContract: boolean;
  private readonly bakeCache?: WardrobePreviewBakeCache;
  private readonly partNodes = new Map<GearBakedPartId, PreviewNode>();
  private extraNodes: PreviewNode[] = [];
  private overflowLabel?: Phaser.GameObjects.Text;
  private currentLease?: GearTextureBakeLease;
  private currentKey = "";
  private requestGeneration = 0;
  private alive = true;

  constructor(
    private readonly scene: Phaser.Scene,
    dependencies: WardrobePreviewDependencies = {},
  ) {
    this.manifest =
      dependencies.manifest === undefined ? GEAR_PARTS_MANIFEST : dependencies.manifest;
    this.replacementContract = isGearReplacementManifest(this.manifest);
    this.bakeCache = this.replacementContract
      ? (dependencies.bakeCache ?? gearTextureBakeCacheForScene(scene))
      : undefined;
    const art = WARDROBE_LAYOUT.previewArt;
    const caption = WARDROBE_LAYOUT.previewCaption;
    const status = WARDROBE_LAYOUT.previewStatus;
    const centerX = art.x + art.width / 2;
    this.shadow = scene.add
      .ellipse(centerX, art.y + art.height - 12, 126, 20, 0x000000, 0.42)
      .setOrigin(0.5);
    this.artRoot = scene.add.container(0, 0);
    this.caption = scene.add
      .text(
        caption.x + caption.width / 2,
        caption.y + caption.height / 2,
        "DRIFTER · EQUIPPED SIX-PART BAKE",
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
    this.root = scene.add.container(0, 0, [this.shadow, this.artRoot, this.caption, this.status]);

    if (this.manifest) {
      this.installBoilerplatePose(this.manifest);
      if (!this.replacementContract) {
        this.status
          .setText("V1 COMPATIBILITY · REPLACEMENT CONTRACT UNAVAILABLE")
          .setColor("#ff9a6a");
      }
    } else {
      this.status.setText("PREVIEW ART CONTRACT UNAVAILABLE").setColor("#ff9a6a");
      this.shadow.setVisible(false);
    }
    scene.events.once("shutdown", () => this.shutdown());
  }

  refresh(
    equippedLoadout: Readonly<Record<GearSlot, GearId>>,
    prestige: number,
    previewId?: GearId,
  ): void {
    const manifest = this.manifest;
    if (!manifest || !this.alive) return;

    const draft = { ...equippedLoadout };
    const previewCandidate = previewId !== undefined && isGearId(previewId) ? previewId : undefined;
    const validPreviewId =
      previewCandidate && equippedLoadout[GEAR_CATALOG[previewCandidate].slot] !== previewCandidate
        ? previewCandidate
        : undefined;
    if (validPreviewId) draft[GEAR_CATALOG[validPreviewId].slot] = validPreviewId;
    const boundedPrestige = Number.isFinite(prestige)
      ? Math.min(MAX_HAT_SLOTS, Math.max(0, Math.floor(prestige)))
      : 0;
    const key = loadoutKey(draft, boundedPrestige, validPreviewId);
    if (key === this.currentKey) return;
    this.currentKey = key;
    const generation = ++this.requestGeneration;
    if (!this.replacementContract) {
      this.refreshCompatibility(draft, boundedPrestige, generation, validPreviewId);
      return;
    }

    const bakeCache = this.bakeCache;
    if (!bakeCache) return;
    if (this.currentLease) {
      this.status
        .setText(
          validPreviewId ? "VISUAL DRAFT LOADING · LAST COMPLETE HELD" : "EQUIPPED BAKE LOADING…",
        )
        .setColor("#6f8994");
    }

    void bakeCache
      .acquireForGeneration(
        { manifest, loadout: draft, prestige: boundedPrestige },
        generation,
        (candidate) => this.alive && candidate === this.requestGeneration,
      )
      .then((lease) => {
        if (!lease) return;
        if (!this.alive || generation !== this.requestGeneration) {
          lease.release();
          return;
        }
        this.commitLease(lease, validPreviewId);
      })
      .catch(() => {
        if (!this.alive || generation !== this.requestGeneration) return;
        this.status.setText("PREVIEW BAKE DELAYED · LAST COMPLETE HELD").setColor("#ffb24a");
      });
  }

  private refreshCompatibility(
    loadout: Readonly<Record<GearSlot, GearId>>,
    prestige: number,
    generation: number,
    previewId?: GearId,
  ): void {
    const manifest = this.manifest;
    if (!manifest) return;
    const assembly = assembleGearLoadout(manifest, loadout, prestige);
    const textureState = ensureGearAssemblyTextures(this.scene, assembly);
    this.rebuildCompatibilityAssembly(assembly);
    this.caption.setText(
      previewId
        ? `DRIFTER · ${GEAR_CATALOG[previewId].slot.toUpperCase()} VISUAL DRAFT`
        : "DRIFTER · EQUIPPED V1 COMPATIBILITY",
    );
    if (textureState === "pending") {
      this.status.setText("V1 GARMENTS LOADING · BOILERPLATE HELD").setColor("#6f8994");
      this.scene.load.once("complete", () => {
        if (!this.alive || generation !== this.requestGeneration) return;
        this.rebuildCompatibilityAssembly(assembly);
        this.status
          .setText("V1 COMPATIBILITY · REPLACEMENT CONTRACT UNAVAILABLE")
          .setColor("#ff9a6a");
      });
      return;
    }
    this.status
      .setText(
        textureState === "missing"
          ? "V1 COMPATIBILITY · SOME ART UNAVAILABLE"
          : "V1 COMPATIBILITY · REPLACEMENT CONTRACT UNAVAILABLE",
      )
      .setColor(textureState === "missing" ? "#ffb24a" : "#ff9a6a");
  }

  private installBoilerplatePose(manifest: GearPartsManifest): void {
    const nodes: PreviewNode[] = [];
    let order = 0;
    for (const part of assembleBoilerplate(manifest, TARGET_BODY_HEIGHT).parts) {
      if (!isBakedPartId(part.source.id)) continue;
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
        boilerplate: part,
      };
      nodes.push(node);
      this.partNodes.set(part.source.id, node);
    }
    nodes.sort((a, b) => a.depth - b.depth || a.order - b.order);
    this.artRoot.add(nodes.map((node) => node.image));
    this.layoutComposite(wardrobeFixedPartBounds(manifest));
    this.shadow.setVisible(nodes.length === GEAR_BAKED_PART_IDS.length);
  }

  private commitLease(lease: GearTextureBakeLease, previewId?: GearId): void {
    for (const partId of GEAR_BAKED_PART_IDS) {
      const node = this.partNodes.get(partId);
      const handle = lease.handles[partId];
      if (!node || !handle || !this.scene.textures.exists(handle.textureKey)) {
        lease.release();
        this.status.setText("PREVIEW BAKE DELAYED · LAST COMPLETE HELD").setColor("#ffb24a");
        return;
      }
    }

    // Six synchronous texture writes make the static pose as atomic as the gameplay rig commit.
    for (const partId of GEAR_BAKED_PART_IDS) {
      const node = this.partNodes.get(partId) as PreviewNode;
      const handle = lease.handles[partId];
      node.image.setTexture(handle.textureKey).setOrigin(handle.origin.x, handle.origin.y);
    }

    this.rebuildExtras(lease.extras);
    const previousLease = this.currentLease;
    this.currentLease = lease;
    previousLease?.release();
    this.caption.setText(
      previewId
        ? `DRIFTER · ${GEAR_CATALOG[previewId].slot.toUpperCase()} VISUAL DRAFT`
        : "DRIFTER · EQUIPPED SIX-PART BAKE",
    );
    if (lease.readiness === "fallback" || lease.diagnostics.length > 0) {
      this.status.setText("SOCKET VERIFIED · SOME ART UNAVAILABLE").setColor("#ffb24a");
    } else {
      this.status.setText("SHARED BAKE · SIX-PART VERIFIED").setColor("#6f8994");
    }
  }

  private rebuildExtras(extras: GearExtraAssembly): void {
    for (const node of this.extraNodes) node.image.destroy();
    this.extraNodes = [];
    this.overflowLabel?.destroy();
    this.overflowLabel = undefined;

    const body = this.partNodes.get("body");
    const head = this.partNodes.get("head");
    if (!body || !head) return;
    let order = GEAR_BAKED_PART_IDS.length;
    if (extras.cloak) {
      const cloak = this.createExtraNode(extras.cloak, body, head, order++);
      if (cloak) this.extraNodes.push(cloak);
    }
    let below: PreviewNode | undefined;
    for (const spec of [...extras.hats].sort((a, b) => a.stackIndex - b.stackIndex)) {
      const node = this.createExtraNode(spec, body, head, order++, below);
      if (!node) continue;
      this.extraNodes.push(node);
      below = node;
    }

    const allNodes = [...this.partNodes.values(), ...this.extraNodes].sort(
      (a, b) => a.depth - b.depth || a.order - b.order,
    );
    this.artRoot.removeAll(false);
    this.artRoot.add(allNodes.map((node) => node.image));

    const bounds = wardrobeFixedPartBounds(this.manifest as GearPartsManifest);
    for (const node of this.extraNodes) expandExtraBounds(bounds, node);
    if (extras.towerOverflow > 0 && below) {
      const socket = topSocketPosition(below);
      this.overflowLabel = this.scene.add
        .text(socket.x, socket.y - 2, `+${extras.towerOverflow}`, {
          fontFamily: "monospace",
          fontSize: "9px",
          color: "#f3df9d",
          fontStyle: "bold",
          stroke: "#101014",
          strokeThickness: 3,
        })
        .setOrigin(0.5, 1);
      this.artRoot.add(this.overflowLabel);
      expandRotatedBounds(bounds, socket.x, socket.y - 2, 1, 1, 0, -18, -14, 18, 2);
    }
    this.layoutComposite(finiteBounds(bounds));
  }

  private rebuildCompatibilityAssembly(assembly: GearLoadoutAssembly): void {
    for (const node of this.extraNodes) node.image.destroy();
    this.extraNodes = [];
    this.overflowLabel?.destroy();
    this.overflowLabel = undefined;

    const body = this.partNodes.get("body");
    const head = this.partNodes.get("head");
    if (!body || !head) return;
    let order = GEAR_BAKED_PART_IDS.length;
    let belowHat: PreviewNode | undefined;
    for (const spec of assembly.parts) {
      const node = this.createExtraNode(
        spec,
        body,
        head,
        order++,
        spec.stackIndex >= 0 ? belowHat : undefined,
      );
      if (!node) continue;
      this.extraNodes.push(node);
      if (spec.stackIndex >= 0) belowHat = node;
    }

    const allNodes = [...this.partNodes.values(), ...this.extraNodes].sort(
      (a, b) => a.depth - b.depth || a.order - b.order,
    );
    this.artRoot.removeAll(false);
    this.artRoot.add(allNodes.map((node) => node.image));

    const bounds = wardrobeFixedPartBounds(this.manifest as GearPartsManifest);
    for (const node of this.extraNodes) expandExtraBounds(bounds, node);
    if (assembly.towerOverflow > 0 && belowHat) {
      const socket = topSocketPosition(belowHat);
      this.overflowLabel = this.scene.add
        .text(socket.x, socket.y - 2, `+${assembly.towerOverflow}`, {
          fontFamily: "monospace",
          fontSize: "9px",
          color: "#f3df9d",
          fontStyle: "bold",
          stroke: "#101014",
          strokeThickness: 3,
        })
        .setOrigin(0.5, 1);
      this.artRoot.add(this.overflowLabel);
      expandRotatedBounds(bounds, socket.x, socket.y - 2, 1, 1, 0, -18, -14, 18, 2);
    }
    this.layoutComposite(finiteBounds(bounds));
  }

  private createExtraNode(
    spec: GearAssemblyPart,
    body: PreviewNode,
    head: PreviewNode,
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
      const headMountScale = head.boilerplate?.source.mountScale || 1;
      x = socket.x;
      y = socket.y;
      scaleX = (head.scaleX / headMountScale) * spec.source.mountScale * spec.stackScale;
      scaleY = (head.scaleY / headMountScale) * spec.source.mountScale * spec.stackScale;
      rotation = head.rotation + spec.rotation;
    } else if (["head", "face.eyes", "face.mouth"].includes(spec.source.receiver)) {
      const source = head.boilerplate;
      if (!source || !this.manifest) return undefined;
      const anchor = source.source.receiverAnchor;
      const localX =
        (spec.source.receiverAnchor.xL - anchor.xL) * this.manifest.socketFrame.bodyHeightL;
      const localY =
        (spec.source.receiverAnchor.yL - anchor.yL) * this.manifest.socketFrame.bodyHeightL;
      const headMountScale = source.source.mountScale || 1;
      const parentScaleX = spec.source.receiver === "head" ? head.scaleX / headMountScale : head.scaleX;
      const parentScaleY = spec.source.receiver === "head" ? head.scaleY / headMountScale : head.scaleY;
      const dx = localX * parentScaleX;
      const dy = localY * parentScaleY;
      const cosine = Math.cos(head.rotation);
      const sine = Math.sin(head.rotation);
      x = head.x + cosine * dx - sine * dy;
      y = head.y + sine * dx + cosine * dy;
      scaleX = parentScaleX * spec.source.mountScale * spec.stackScale;
      scaleY = parentScaleY * spec.source.mountScale * spec.stackScale;
      rotation = head.rotation + spec.rotation;
    } else if (isBakedPartId(spec.source.receiver)) {
      const receiver = this.partNodes.get(spec.source.receiver);
      if (!receiver) return undefined;
      x = receiver.x;
      y = receiver.y;
      scaleX = receiver.scaleX * spec.source.mountScale * spec.stackScale;
      scaleY = receiver.scaleY * spec.source.mountScale * spec.stackScale;
      rotation = receiver.rotation + spec.rotation;
    } else {
      if (!this.manifest) return undefined;
      const localX = spec.source.receiverAnchor.xL * this.manifest.socketFrame.bodyHeightL;
      const localY = spec.source.receiverAnchor.yL * this.manifest.socketFrame.bodyHeightL;
      const dx = localX * body.scaleX;
      const dy = localY * body.scaleY;
      const cosine = Math.cos(body.rotation);
      const sine = Math.sin(body.rotation);
      x = body.x + cosine * dx - sine * dy;
      y = body.y + sine * dx + cosine * dy;
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

  private layoutComposite(bounds: WardrobePreviewBounds): void {
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

  private shutdown(): void {
    if (!this.alive) return;
    this.alive = false;
    this.requestGeneration++;
    this.currentLease?.release();
    this.currentLease = undefined;
  }
}
