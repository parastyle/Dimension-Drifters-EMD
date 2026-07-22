import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { bootArena, runArenaSpec, waitForDevWeapon } from "../helpers/arena-harness.js";

const WEAPON_ID = "x-sword-bone";
const MAGMA_TEXTURE = "scatter:vfx/x-sword-bone-scatter.png";
const EVIDENCE_DIR = path.resolve("docs/owner-notes-audit-v8-evidence/a2-bone-sword");

interface MagmaEvidence {
  attackSeq: number;
  projectileIds: string[];
  kinds: string[];
  paintedIds: string[];
  textureLoaded: boolean;
  textureFrameTotal: number;
}

test.use({ viewport: { width: 640, height: 360 } });

test("Wyrmtooth emits six real projectiles using its original painted magma balls", async ({
  page,
}) => {
  await runArenaSpec(page, async (baseURL) => {
    await bootArena(page, baseURL, `weapon:${WEAPON_ID}`);
    await waitForDevWeapon(page, WEAPON_ID);
    await page.locator("#game-root canvas").click({ position: { x: 320, y: 180 } });
    await page.mouse.move(520, 180);

    const beforeSeq = await page.evaluate(() => {
      const arena = (globalThis as any).ddGame.scene.getScene("arena");
      const self = arena.room.state.players.get(arena.room.sessionId);
      arena.room.send("attack", {
        aimX: 1,
        aimY: 0,
        tx: Number(self.x) + 500,
        ty: Number(self.y),
      });
      return self.attackSeq >>> 0;
    });

    let evidence: MagmaEvidence | null = null;
    await expect
      .poll(
        async () => {
          evidence = await page.evaluate(
            ({ wanted, textureKey }) => {
              const arena = (globalThis as any).ddGame.scene.getScene("arena");
              const room = arena.room;
              const self = room.state.players.get(room.sessionId);
              const projectileIds: string[] = [];
              const kinds: string[] = [];
              const paintedIds: string[] = [];
              room.state.projectiles.forEach((row: any, key: string) => {
                if (row.sourcePlayerId !== room.sessionId || row.sourceWeaponId !== wanted) return;
                const id = String(row.id ?? key);
                projectileIds.push(id);
                kinds.push(String(row.kind));
                const container = arena.projectiles.get(id);
                if (
                  container?.list?.some(
                    (child: any) => child?.texture?.key === textureKey,
                  )
                )
                  paintedIds.push(id);
              });
              const texture = arena.textures.get(textureKey);
              return {
                attackSeq: self.attackSeq >>> 0,
                projectileIds,
                kinds,
                paintedIds,
                textureLoaded: arena.textures.exists(textureKey),
                textureFrameTotal: Number(texture?.frameTotal ?? 0),
              } satisfies MagmaEvidence;
            },
            { wanted: WEAPON_ID, textureKey: MAGMA_TEXTURE },
          );
          return evidence;
        },
        {
          message: "the accepted Wyrmtooth swing should render its complete painted magma volley",
          timeout: 15_000,
          intervals: [50, 50, 50, 50, 100],
        },
      )
      .toMatchObject({
        attackSeq: beforeSeq + 1,
        textureLoaded: true,
        projectileIds: expect.arrayContaining([
          expect.any(String),
          expect.any(String),
          expect.any(String),
          expect.any(String),
          expect.any(String),
          expect.any(String),
        ]),
        paintedIds: expect.arrayContaining([
          expect.any(String),
          expect.any(String),
          expect.any(String),
          expect.any(String),
          expect.any(String),
          expect.any(String),
        ]),
      });

    expect(evidence).not.toBeNull();
    expect(evidence!.projectileIds).toHaveLength(6);
    expect(evidence!.paintedIds).toEqual(evidence!.projectileIds);
    expect(evidence!.kinds).toEqual(Array(6).fill("magma"));
    // Phaser includes the spritesheet's __BASE entry in frameTotal: eight authored ball frames + base.
    expect(evidence!.textureFrameTotal).toBe(9);

    await mkdir(EVIDENCE_DIR, { recursive: true });
    await writeFile(
      path.join(EVIDENCE_DIR, "live-capture.json"),
      `${JSON.stringify({ capturedAt: new Date().toISOString(), ...evidence }, null, 2)}\n`,
      "utf8",
    );
  });
});
