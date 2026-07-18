import type { PetId, PetStageBand } from "@dd/shared";
import type Phaser from "phaser";

export type PetPartSpringPreset = "flutter" | "antenna" | "tail" | "weighty";

export interface PetPartSpringManifest {
  preset: PetPartSpringPreset;
  hz: number;
  damping: number;
  maxDeg: number;
  dragGain: number;
}

export interface PetManifestPart {
  id: string;
  texture: string;
  class: string;
  slot: string;
  parent: string | null;
  pivotSource: { x: number; y: number };
  receiverAnchor: {
    frame: string;
    socket: string;
    xL: number;
    yL: number;
    raw: { x: number; y: number } | null;
  };
  restAngle: number;
  mountScale: number;
  plane: number;
  spring: PetPartSpringManifest | null;
  alphaBounds: { left: number; top: number; width: number; height: number };
  image: { width: number; height: number };
}

export interface PetManifestStage {
  stage: PetStageBand;
  stageName: string;
  body: {
    axisLength: number;
    rootSource: { x: number; y: number };
  };
  parts: PetManifestPart[];
}

export interface PetManifestEntry {
  id: PetId;
  displayName: string;
  stages: PetManifestStage[];
}

export interface PetPartsManifest {
  schemaVersion: number;
  socketFrame: { id: string };
  pets: PetManifestEntry[];
}

export interface PetAssemblyPart {
  source: PetManifestPart;
  x: number;
  y: number;
  originX: number;
  originY: number;
  rotation: number;
  scale: number;
  depth: number;
}

export interface PetStageAssembly {
  parts: PetAssemblyPart[];
  scale: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

const PET_STAGE_ENVELOPE = [0, 30, 37, 44] as const;
let manifestPromise: Promise<PetPartsManifest | null> | undefined;

function manifestShape(value: unknown): value is PetPartsManifest {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<PetPartsManifest>;
  return (
    candidate.schemaVersion === 1 &&
    candidate.socketFrame?.id === "PET_SOCKET_FRAME_V1" &&
    Array.isArray(candidate.pets)
  );
}

/** Fetch the generated socket/part data once. Texture files remain loose and are loaded per descriptor. */
export function loadPetPartsManifest(): Promise<PetPartsManifest | null> {
  manifestPromise ??= fetch("sprites/pets/pet-parts-manifest.json", { cache: "force-cache" })
    .then(async (response) => {
      if (!response.ok) return null;
      const value: unknown = await response.json();
      return manifestShape(value) ? value : null;
    })
    .catch(() => null);
  return manifestPromise;
}

export function petManifestStage(
  manifest: PetPartsManifest,
  petId: PetId,
  stageBand: PetStageBand,
): PetManifestStage | undefined {
  for (const pet of manifest.pets) {
    if (pet.id !== petId) continue;
    for (const stage of pet.stages) if (stage.stage === stageBand) return stage;
    return undefined;
  }
  return undefined;
}

export function petTextureKey(petId: PetId, stageBand: PetStageBand, partId: string): string {
  return `pet:${petId}:s${stageBand}:${partId}`;
}

export function petTextureUrl(petId: PetId, stageBand: PetStageBand, texture: string): string {
  return `sprites/pets/${petId}/s${stageBand}/${texture}`;
}

interface UnscaledPartPlacement {
  source: PetManifestPart;
  x: number;
  y: number;
  rotation: number;
}

function rotateX(x: number, y: number, angle: number): number {
  return x * Math.cos(angle) - y * Math.sin(angle);
}

function rotateY(x: number, y: number, angle: number): number {
  return x * Math.sin(angle) + y * Math.cos(angle);
}

/**
 * Convert normalized receiver sockets plus source pivots into retained-image transforms. The calculation
 * deliberately uses alpha bounds only for normalization; runtime images stay untrimmed, so their manifest
 * pivots remain exact and rotating a loose part cannot open a seam at its collar.
 */
export function assemblePetStage(
  stage: PetManifestStage,
  envelope = PET_STAGE_ENVELOPE[stage.stage],
): PetStageAssembly {
  const placements: UnscaledPartPlacement[] = [];
  const byId = new Map<string, UnscaledPartPlacement>();
  const rootX = stage.body.rootSource.x;
  const rootY = stage.body.rootSource.y;
  for (const source of stage.parts) {
    const rotation = (source.restAngle * Math.PI) / 180;
    let x = 0;
    let y = 0;
    if (source.parent !== null) {
      if (source.receiverAnchor.raw) {
        x = source.receiverAnchor.raw.x - rootX;
        y = source.receiverAnchor.raw.y - rootY;
      } else {
        const parent = byId.get(source.parent);
        const parentRotation = parent?.rotation ?? 0;
        const socketX = source.receiverAnchor.xL * stage.body.axisLength;
        const socketY = source.receiverAnchor.yL * stage.body.axisLength;
        x = (parent?.x ?? 0) + rotateX(socketX, socketY, parentRotation);
        y = (parent?.y ?? 0) + rotateY(socketX, socketY, parentRotation);
      }
    }
    const placement = { source, x, y, rotation };
    placements.push(placement);
    byId.set(source.id, placement);
  }

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const placement of placements) {
    const { source, rotation, x, y } = placement;
    const bounds = source.alphaBounds;
    const left = (bounds.left - source.pivotSource.x) * source.mountScale;
    const right = (bounds.left + bounds.width - source.pivotSource.x) * source.mountScale;
    const top = (bounds.top - source.pivotSource.y) * source.mountScale;
    const bottom = (bounds.top + bounds.height - source.pivotSource.y) * source.mountScale;
    for (let corner = 0; corner < 4; corner++) {
      const px = (corner & 1) === 0 ? left : right;
      const py = (corner & 2) === 0 ? top : bottom;
      const rx = x + rotateX(px, py, rotation);
      const ry = y + rotateY(px, py, rotation);
      minX = Math.min(minX, rx);
      minY = Math.min(minY, ry);
      maxX = Math.max(maxX, rx);
      maxY = Math.max(maxY, ry);
    }
  }
  if (!Number.isFinite(minX + minY + maxX + maxY)) minX = minY = maxX = maxY = 0;
  const rawWidth = Math.max(1, maxX - minX);
  const rawHeight = Math.max(1, maxY - minY);
  const scale = Math.max(0.0001, envelope / Math.max(rawWidth, rawHeight));
  const parts = placements
    .map<PetAssemblyPart>((placement) => ({
      source: placement.source,
      x: placement.x * scale,
      y: placement.y * scale,
      originX: placement.source.pivotSource.x / placement.source.image.width,
      originY: placement.source.pivotSource.y / placement.source.image.height,
      rotation: placement.rotation,
      scale: scale * placement.source.mountScale,
      depth: placement.source.plane,
    }))
    .sort((a, b) => a.depth - b.depth);
  return {
    parts,
    scale,
    minX: minX * scale,
    minY: minY * scale,
    maxX: maxX * scale,
    maxY: maxY * scale,
    width: rawWidth * scale,
    height: rawHeight * scale,
  };
}

const pendingTextures = new Set<string>();
const failedTextures = new Set<string>();

export type PetTextureState = "ready" | "pending" | "missing";

/** Queue only the selected form's loose cutouts; callers poll readiness on their retained rig. */
export function ensurePetStageTextures(
  scene: Phaser.Scene,
  petId: PetId,
  stage: PetManifestStage,
): PetTextureState {
  let missing = false;
  let queued = false;
  const queuedKeys: string[] = [];
  for (const part of stage.parts) {
    const key = petTextureKey(petId, stage.stage, part.id);
    if (scene.textures.exists(key)) continue;
    if (failedTextures.has(key)) {
      missing = true;
      continue;
    }
    if (pendingTextures.has(key)) {
      if (scene.load.isLoading()) continue;
      // A scene may have shut down before its loader emitted `complete`; heal that stale reservation.
      pendingTextures.delete(key);
    }
    pendingTextures.add(key);
    queuedKeys.push(key);
    scene.load.image(key, petTextureUrl(petId, stage.stage, part.texture));
    queued = true;
  }
  if (queued) {
    const onError = (file: Phaser.Loader.File): void => {
      if (!queuedKeys.includes(String(file.key))) return;
      failedTextures.add(String(file.key));
    };
    scene.load.on("loaderror", onError);
    scene.load.once("complete", () => {
      scene.load.off("loaderror", onError);
      for (const key of queuedKeys) {
        pendingTextures.delete(key);
        if (!scene.textures.exists(key)) failedTextures.add(key);
      }
    });
    if (!scene.load.isLoading()) scene.load.start();
  }
  for (const part of stage.parts) {
    const key = petTextureKey(petId, stage.stage, part.id);
    if (scene.textures.exists(key)) continue;
    if (failedTextures.has(key)) missing = true;
    else return "pending";
  }
  return missing ? "missing" : "ready";
}
