import { expect, test } from "@playwright/test";
import { type BrowserGame, bootArena, runArenaSpec } from "../helpers/arena-harness.js";

/** shared/src/constants.ts — twelve fixed slots, of which the first ten are active at spawn. */
const WORM_MAX_SEGMENTS = 12;

/** Chain spacing is WORM_PATH_OVERLAP_FACTOR (0.86) × the two radii (37..52px) ≈ 64..90px; the band
 *  below is deliberately generous so dives/reconnect catch-up never flake it, while still failing on
 *  a scattered (non-chain) or collapsed (all-zero) segment table. */
const CHAIN_GAP_MIN = 15;
const CHAIN_GAP_MAX = 300;

interface WormSnapshot {
  active: boolean;
  activeMask: number;
  segmentRows: number;
  bossKind: string;
  bossBarVisible: boolean;
  bossBarText: string;
  chains: { chain: number; ordinal: number; x: number; y: number }[];
}

// Small buffer keeps headless software-WebGL frame pacing honest (~20fps vs ~6fps at 1280×720).
test.use({ viewport: { width: 640, height: 360 } });

test("serraketh: spawnBossDef seam-eater activates the twelve-slot worm table with a coherent chain and a boss bar", async ({
  page,
}) => {
  await runArenaSpec(page, async (baseURL) => {
    // The §39 dev deep-link enters training and sends spawnBossDef("seam-eater") through the real flow.
    await bootArena(page, baseURL, "boss:seam-eater");

    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const game = (globalThis as unknown as { ddGame?: BrowserGame }).ddGame;
            const worm = game?.scene.getScene("arena").room?.state?.wormBoss;
            return worm?.active === true && (worm?.activeMask ?? 0) !== 0;
          }),
        { message: "the seam-eater deep-link should activate wormBoss", timeout: 30_000 },
      )
      .toBe(true);

    // Wait until every active slot has been posed (non-zero position) before snapshotting geometry.
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const game = (globalThis as unknown as { ddGame?: BrowserGame }).ddGame;
            const worm = game?.scene.getScene("arena").room?.state?.wormBoss;
            if (!worm?.segments) return false;
            const mask = worm.activeMask ?? 0;
            let posed = true;
            worm.segments.forEach((segment) => {
              const slot = segment.slot ?? 0;
              if ((mask & (1 << slot)) === 0) return;
              if (!(segment.x ?? 0) && !(segment.y ?? 0)) posed = false;
            });
            return posed;
          }),
        {
          message: "every active worm segment should carry an authoritative pose",
          timeout: 15_000,
        },
      )
      .toBe(true);

    const snapshot: WormSnapshot | null = await page.evaluate(() => {
      const game = (globalThis as unknown as { ddGame?: BrowserGame }).ddGame;
      const scene = game?.scene.getScene("arena") as unknown as {
        bossText?: { visible?: boolean; text?: string };
      };
      const room = game?.scene.getScene("arena").room;
      const state = room?.state;
      const worm = state?.wormBoss;
      if (!worm?.segments) return null;
      const chains: { chain: number; ordinal: number; x: number; y: number }[] = [];
      const mask = worm.activeMask ?? 0;
      let segmentRows = 0;
      worm.segments.forEach((segment) => {
        segmentRows++;
        const slot = segment.slot ?? 0;
        if ((mask & (1 << slot)) === 0) return;
        chains.push({
          chain: segment.chain ?? 0,
          ordinal: segment.ordinal ?? 0,
          x: segment.x ?? 0,
          y: segment.y ?? 0,
        });
      });
      return {
        active: worm.active === true,
        activeMask: mask,
        segmentRows,
        bossKind: state?.bossKind ?? "",
        bossBarVisible: scene?.bossText?.visible === true,
        bossBarText: scene?.bossText?.text ?? "",
        chains,
      };
    });

    expect(snapshot, "worm state must be readable").not.toBeNull();
    if (!snapshot) return;
    expect(snapshot.active).toBe(true);
    expect(snapshot.segmentRows, "the fixed slot table is always fully allocated").toBe(
      WORM_MAX_SEGMENTS,
    );
    expect(snapshot.activeMask).not.toBe(0);
    expect(snapshot.bossKind).toBe("seam-eater");

    // The active segments must form a coherent chain: sorted by ordinal within each chain id, every
    // adjacent pair sits inside the authored spacing band (no scattered slots, no zero-collapsed pile).
    const byChain = new Map<number, { ordinal: number; x: number; y: number }[]>();
    for (const row of snapshot.chains) {
      const bucket = byChain.get(row.chain) ?? [];
      bucket.push(row);
      byChain.set(row.chain, bucket);
    }
    expect(byChain.size, "at least one live chain").toBeGreaterThan(0);
    let adjacentPairs = 0;
    for (const [chainId, bucket] of byChain) {
      bucket.sort((a, b) => a.ordinal - b.ordinal);
      for (let i = 1; i < bucket.length; i++) {
        const previous = bucket[i - 1];
        const current = bucket[i];
        if (!previous || !current) continue;
        const gap = Math.hypot(current.x - previous.x, current.y - previous.y);
        adjacentPairs++;
        expect(
          gap,
          `chain ${chainId} segment ${previous.ordinal}→${current.ordinal} gap ${gap.toFixed(1)}px`,
        ).toBeGreaterThanOrEqual(CHAIN_GAP_MIN);
        expect(
          gap,
          `chain ${chainId} segment ${previous.ordinal}→${current.ordinal} gap ${gap.toFixed(1)}px`,
        ).toBeLessThanOrEqual(CHAIN_GAP_MAX);
      }
    }
    expect(adjacentPairs, "the spawn topology has ten linked segments").toBeGreaterThanOrEqual(5);

    // Boss-bar presence: the compatibility root enemy drives the HUD bar, labelled from bossKind.
    expect(snapshot.bossBarVisible, "the boss bar name plate should be visible").toBe(true);
    expect(snapshot.bossBarText.toUpperCase()).toContain("SERRAKETH");
  });
});
