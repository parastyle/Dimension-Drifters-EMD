import { WHOLE_ART_CHARACTERS, type WholeArtCharacter } from "@dd/shared";
import type Phaser from "phaser";
import {
  WHOLE_ART_CHARACTER_PART_ROLES,
  type WholeArtCharacterPartRole,
  wholeArtCharacterManifest,
  wholeArtCharacterTextureKey,
  wholeArtCharacterTextureUrl,
} from "../../sprites/whole-art-character.js";

export interface CharacterPortraitPartLayout {
  readonly role: WholeArtCharacterPartRole;
  readonly key: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

function portraitPartOrder(role: WholeArtCharacterPartRole, offsetX: number): number {
  if (role.startsWith("foot")) return 0;
  if (role.startsWith("hand") && offsetX < 0) return 1;
  if (role === "body") return 2;
  if (role === "head") return 3;
  return 4;
}

/** Queue only the six authored cuts required by each ordinary character card. */
export function queueCharacterPreviewTextures(
  scene: Phaser.Scene,
  characterIds: readonly WholeArtCharacter[] = WHOLE_ART_CHARACTERS,
): void {
  for (const characterId of characterIds) {
    const manifest = wholeArtCharacterManifest(characterId);
    if (!manifest) continue;
    for (const role of WHOLE_ART_CHARACTER_PART_ROLES) {
      const part = manifest.parts.find((candidate) => candidate.role === role);
      if (!part) continue;
      const key = wholeArtCharacterTextureKey(characterId, role);
      if (!scene.textures.exists(key)) {
        scene.load.image(key, wholeArtCharacterTextureUrl(characterId, part));
      }
    }
  }
}

/** Fit the authored six-part silhouette inside a card without changing any part-to-part geometry. */
export function characterPortraitLayout(
  characterId: WholeArtCharacter,
  width: number,
  height: number,
): CharacterPortraitPartLayout[] {
  const manifest = wholeArtCharacterManifest(characterId);
  if (!manifest) return [];
  const parts = WHOLE_ART_CHARACTER_PART_ROLES.flatMap((role) => {
    const part = manifest.parts.find((candidate) => candidate.role === role);
    return part ? [{ role, part }] : [];
  });
  if (parts.length !== WHOLE_ART_CHARACTER_PART_ROLES.length) return [];

  const minX = Math.min(...parts.map(({ part }) => part.ox - part.w / 2));
  const maxX = Math.max(...parts.map(({ part }) => part.ox + part.w / 2));
  const minY = Math.min(...parts.map(({ part }) => part.oy - part.h / 2));
  const maxY = Math.max(...parts.map(({ part }) => part.oy + part.h / 2));
  const sourceWidth = Math.max(1, maxX - minX);
  const sourceHeight = Math.max(1, maxY - minY);
  const scale = Math.min((width * 0.92) / sourceWidth, (height * 0.92) / sourceHeight);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  return parts
    .sort((a, b) => portraitPartOrder(a.role, a.part.ox) - portraitPartOrder(b.role, b.part.ox))
    .map(({ role, part }) => ({
      role,
      key: wholeArtCharacterTextureKey(characterId, role),
      x: (part.ox - centerX) * scale,
      y: (part.oy - centerY) * scale,
      width: part.w * scale,
      height: part.h * scale,
    }));
}

export function buildCharacterPortrait(
  scene: Phaser.Scene,
  characterId: WholeArtCharacter,
  width: number,
  height: number,
): Phaser.GameObjects.Container {
  const images = characterPortraitLayout(characterId, width, height).map((part) =>
    scene.add
      .image(part.x, part.y, part.key)
      .setOrigin(0.5)
      .setDisplaySize(part.width, part.height),
  );
  return scene.add.container(0, 0, images);
}
