import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";
import {
  ARENA_HEIGHT,
  WEAPONS,
  weaponArtMuzzlePointsForShot,
  weaponDisplaySpriteId,
} from "../packages/shared/dist/index.js";

const REPO_ROOT = path.resolve(import.meta.dirname, "..");
const DEFAULT_OUTPUT = path.join(REPO_ROOT, "packages/client/public/muzzle-reference");
const DEFAULT_TOLERANCE_PX = 3;
const ROTATING_SAMPLE_BUCKETS = 24;
/** Owner-reported regressions remain in every sampled run even when their family representative or
 * rotating daily bucket changes. This is coverage, never a per-weapon geometry exception. */
const OWNER_REPORTED_MUZZLE_REGRESSIONS = Object.freeze(["x2-buzzard-s-burnout"]);
const args = process.argv.slice(2);

function option(name) {
  const prefix = `--${name}=`;
  return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function hasFlag(name) {
  return args.includes(`--${name}`);
}

function stableHash(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function isoDayBucket(date = new Date()) {
  return Math.floor(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 86_400_000,
  );
}

function catalogRows() {
  return Object.values(WEAPONS)
    .filter(
      (weapon) =>
        !weapon.archived && (weapon.gun || weapon.beam) && weapon.groundZone?.trigger !== "channel",
    )
    .sort((a, b) => a.id.localeCompare(b.id));
}

function excludedNonMuzzleRows() {
  return Object.values(WEAPONS)
    .filter(
      (weapon) =>
        !weapon.archived && (weapon.gun || weapon.beam) && weapon.groundZone?.trigger === "channel",
    )
    .map((weapon) => ({
      weaponId: weapon.id,
      reason:
        "runtime channel ground-zone dispatch supersedes the legacy gun block; no muzzle spawn exists",
    }));
}

function sampledRows(rows, dayBucket) {
  const selected = new Map();
  const add = (weapon, reason) => {
    const prior = selected.get(weapon.id);
    selected.set(weapon.id, { weapon, reasons: [...new Set([...(prior?.reasons ?? []), reason])] });
  };

  for (const weapon of rows) {
    if (!weapon.expansion) add(weapon, "base-roster");
    if ((weapon.muzzle?.points.length ?? 1) > 1) add(weapon, "multi-barrel");
    if ((weapon.gun?.burst?.count ?? 1) > 1) add(weapon, "burst");
    if (weapon.dual) add(weapon, "dual");
  }
  for (const id of OWNER_REPORTED_MUZZLE_REGRESSIONS) {
    const weapon = rows.find((candidate) => candidate.id === id);
    if (!weapon) throw new Error(`owner-reported muzzle regression is not an active delivery: ${id}`);
    add(weapon, "owner-reported-regression");
  }

  const byFamily = new Map();
  for (const weapon of rows) {
    const key = `${weapon.gun ? "gun" : "beam"}:${weapon.tags.family}`;
    const family = byFamily.get(key) ?? [];
    family.push(weapon);
    byFamily.set(key, family);
  }
  for (const [family, weapons] of byFamily) {
    const representative = [...weapons].sort(
      (a, b) => stableHash(`${family}:${a.id}`) - stableHash(`${family}:${b.id}`),
    )[0];
    if (representative) add(representative, `family:${family}`);
  }

  const rotatingBucket = dayBucket % ROTATING_SAMPLE_BUCKETS;
  for (const weapon of rows) {
    if (stableHash(weapon.id) % ROTATING_SAMPLE_BUCKETS === rotatingBucket)
      add(weapon, `rotating:${rotatingBucket}/${ROTATING_SAMPLE_BUCKETS}`);
  }
  return [...selected.values()].sort((a, b) => a.weapon.id.localeCompare(b.weapon.id));
}

function selectedRows(rows) {
  const requested = option("weapon")?.split(",").filter(Boolean);
  if (requested?.length) {
    return requested.map((id) => {
      const weapon = WEAPONS[id];
      if (
        !weapon ||
        weapon.archived ||
        (!weapon.gun && !weapon.beam) ||
        weapon.groundZone?.trigger === "channel"
      )
        throw new Error(`not an active gun-delivery weapon: ${id}`);
      return { weapon, reasons: ["explicit"] };
    });
  }
  const full = hasFlag("full") || (!hasFlag("sample") && process.env.DD_FULL_MUZZLE_SWEEP !== "0");
  if (full) return rows.map((weapon) => ({ weapon, reasons: ["full-catalog"] }));
  return sampledRows(rows, isoDayBucket());
}

const catalog = catalogRows();
const excludedRows = excludedNonMuzzleRows();
const selection = selectedRows(catalog);
const selectionKind = option("weapon")
  ? "explicit"
  : selection.length === catalog.length
    ? "full"
    : "sample";
const baseURL = process.env.DD_E2E_BASE_URL ?? "http://localhost:5180";
const privateHarness =
  process.env.DD_E2E_BASE_URL !== undefined &&
  !/^https?:\/\/(?:localhost|127\.0\.0\.1):5180\/?$/i.test(baseURL);
const outputRoot = path.resolve(option("output") ?? DEFAULT_OUTPUT);
const capturesRoot = path.join(outputRoot, "captures");
const screenshotMode = option("screenshots") ?? (selectionKind === "full" ? "all" : "none");
const tolerancePx = Number(option("tolerance") ?? DEFAULT_TOLERANCE_PX);
const writeContactSheet =
  hasFlag("contact-sheet") || (selectionKind === "full" && outputRoot === DEFAULT_OUTPUT);

if (!Number.isFinite(tolerancePx) || tolerancePx <= 0)
  throw new Error("--tolerance must be positive");
if (!["all", "stationary", "none"].includes(screenshotMode))
  throw new Error("--screenshots must be all, stationary, or none");

if (hasFlag("list")) {
  console.log(
    JSON.stringify(
      {
        selection: selectionKind,
        catalogCount: catalog.length,
        selectedCount: selection.length,
        excludedNonMuzzleRows: excludedRows,
        weapons: selection.map(({ weapon, reasons }) => ({ id: weapon.id, reasons })),
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

await mkdir(outputRoot, { recursive: true });
if (screenshotMode !== "none") await mkdir(capturesRoot, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: [
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
    "--disable-backgrounding-occluded-windows",
  ],
});
const context = await browser.newContext({ viewport: { width: 640, height: 360 } });
const page = await context.newPage();
const browserErrors = [];
page.on("console", (message) => {
  if (message.type() === "error") browserErrors.push(`[console] ${message.text()}`);
});
page.on("pageerror", (error) => browserErrors.push(`[pageerror] ${error.stack ?? error.message}`));

function caseScreenshotPath(weaponId, mode) {
  return path.join(capturesRoot, `${weaponId}--${mode}.jpg`);
}

function publicArtifactPath(absolutePath) {
  const publicRoot = path.join(REPO_ROOT, "packages/client/public");
  const relative = path.relative(publicRoot, absolutePath).replaceAll(path.sep, "/");
  return relative.startsWith("..")
    ? path.relative(REPO_ROOT, absolutePath).replaceAll(path.sep, "/")
    : relative;
}

async function waitForWeapon(weaponId) {
  for (let attempt = 0; attempt < 4; attempt++) {
    await page.evaluate((wanted) => {
      const arena = globalThis.ddGame?.scene?.getScene("arena");
      arena?.room?.send("devEquip", { weapon: wanted });
    }, weaponId);
    const ready = await page
      .waitForFunction(
        (wanted) => {
          const arena = globalThis.ddGame?.scene?.getScene("arena");
          const room = arena?.room;
          const self = room?.sessionId ? room.state?.players?.get(room.sessionId) : undefined;
          const rig = room?.sessionId ? arena.blobs?.get(room.sessionId) : undefined;
          return (
            room?.state?.mode === "training" &&
            self?.weapon === wanted &&
            rig?.heldWeaponDef?.(0)?.id === wanted &&
            rig?.weapons?.[0]?.img?.active &&
            rig?.weapons?.[0]?.img?.visible
          );
        },
        weaponId,
        { timeout: 2_500 },
      )
      .then(() => true)
      .catch(() => false);
    if (ready) return;
    await page.waitForTimeout(200);
  }
  throw new Error(`devEquip did not settle for ${weaponId}`);
}

async function resetPrivateTrainingGrounds() {
  if (!privateHarness) return;
  await page.keyboard.up("w").catch(() => undefined);
  await page.evaluate(() => {
    globalThis.ddGame?.scene?.getScene("arena")?.room?.send("toggleTraining");
  });
  await page.waitForFunction(
    () => globalThis.ddGame?.scene?.getScene("arena")?.room?.state?.mode === "arena",
    undefined,
    { timeout: 5_000 },
  );
  await page.waitForTimeout(75);
  await page.evaluate(() => {
    globalThis.ddGame?.scene?.getScene("arena")?.room?.send("toggleTraining");
  });
  await page.waitForFunction(
    () => {
      const arena = globalThis.ddGame?.scene?.getScene("arena");
      const room = arena?.room;
      const self = room?.sessionId ? room.state?.players?.get(room.sessionId) : undefined;
      return room?.state?.mode === "training" && self?.alive;
    },
    undefined,
    { timeout: 5_000 },
  );
}

async function beginCase(weapon, mode) {
  // Stay clear of the right-side weapon dock: beam input is intentionally suppressed over interactive UI.
  await page.mouse.move(430, 180);
  await page.waitForFunction(
    () => {
      const arena = globalThis.ddGame?.scene?.getScene("arena");
      const self = arena?.room?.state?.players?.get(arena.room.sessionId);
      return !!self && Math.cos(self.aimDir) >= 0.98;
    },
    undefined,
    { timeout: 3_000 },
  );
  const preflight = await page.evaluate(
    ({ wanted, motion, arenaHeight }) => {
      const arena = globalThis.ddGame.scene.getScene("arena");
      const room = arena.room;
      const self = room.state.players.get(room.sessionId);
      const rig = arena.blobs.get(room.sessionId);
      if (!self || !rig) throw new Error("arena probe lost the local player");
      const startAttackSeq = self.attackSeq >>> 0;
      const startTick = room.state.tick >>> 0;
      const startX = self.x;
      const startY = self.y;
      const startAimDir = self.aimDir;
      const moveY = motion === "strafing" ? (startY < arenaHeight * 0.5 ? 1 : -1) : 0;
      const existingProjectiles = new Set();
      room.state.projectiles.forEach((row) => {
        existingProjectiles.add(row.id);
      });
      const probe = {
        weaponId: wanted,
        mode: motion,
        startAttackSeq,
        startTick,
        startX,
        startY,
        fireHeld: false,
        moveX: 0,
        moveY,
        existingProjectiles,
        seenProjectiles: new Set(),
        shots: [],
        beam: undefined,
        predictedFrames: [],
        firstCaptureReady: false,
        canvasRect: undefined,
      };

      const toScreen = (worldX, worldY) => {
        const canvas = document.querySelector("#game-root canvas");
        const camera = arena.cameras.main;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        return {
          x: rect.left + ((worldX - camera.worldView.x) * camera.zoom * rect.width) / canvas.width,
          y: rect.top + ((worldY - camera.worldView.y) * camera.zoom * rect.height) / canvas.height,
        };
      };

      const visibleMuzzles = (definition) => {
        const liveRig = arena.blobs.get(room.sessionId);
        const out = [];
        for (let barrelIndex = 0; barrelIndex < definition.points.length; barrelIndex++) {
          const center = { x: 0, y: 0 };
          const directArtCenter = { x: 0, y: 0 };
          const point = definition.points[barrelIndex];
          const wrote = definition.beam
            ? liveRig?.writeWeaponMuzzle?.(0, center, definition.pointIndices[barrelIndex])
            : liveRig?.writeWeaponMuzzleForShot?.(definition.acceptedSeq, barrelIndex, center);
          liveRig?.writeWeaponMuzzle?.(
            point.part === 1 ? 1 : 0,
            directArtCenter,
            definition.pointIndices[barrelIndex],
          );
          if (!wrote) continue;
          const held = liveRig?.weapons?.find((candidate) => candidate.partIndex === point.part);
          const rootMatrix = liveRig.root.getWorldTransformMatrix();
          out.push({
            barrelIndex,
            part: point.part,
            x: center.x,
            y: center.y,
            directArtCenter,
            rigRoot: { x: liveRig.root.x, y: liveRig.root.y },
            rigRootMatrix: {
              a: rootMatrix.a,
              b: rootMatrix.b,
              c: rootMatrix.c,
              d: rootMatrix.d,
              tx: rootMatrix.tx,
              ty: rootMatrix.ty,
            },
            weaponLocal: held
              ? {
                  x: held.img.x,
                  y: held.img.y,
                  rotation: held.img.rotation,
                  scaleX: held.img.scaleX,
                  scaleY: held.img.scaleY,
                  originX: held.img.originX,
                  originY: held.img.originY,
                  width: held.img.width,
                  height: held.img.height,
                  textureKey: held.img.texture?.key,
                  frameName: held.img.frame?.name,
                }
              : undefined,
            screen: toScreen(center.x, center.y),
            artPoint: {
              x: point.x,
              y: point.y,
              normalizedX: point.x / point.width,
              normalizedY: point.y / point.height,
              width: point.width,
              height: point.height,
              part: point.part,
            },
          });
        }
        return out;
      };

      const uniqueOrigins = (rows) => {
        const origins = [];
        for (const row of rows) {
          const steps = row.flightAgeTicks ?? ((room.state.tick - row.bornTick) >>> 0) + 1;
          const candidate = {
            x: row.x - row.vx * steps * 0.05,
            y: row.y - row.vy * steps * 0.05,
            bornTick: row.bornTick >>> 0,
            projectileId: row.id,
            visibleSpawnOrigin: row.visibleSpawnOrigin,
            spriteMuzzleAtSpawn: row.spriteMuzzleAtSpawn,
          };
          if (
            !origins.some(
              (origin) => Math.hypot(origin.x - candidate.x, origin.y - candidate.y) < 0.35,
            )
          )
            origins.push(candidate);
        }
        return origins;
      };

      const match = (origins, painted) => {
        const remaining = new Set(painted.map((_, index) => index));
        return origins.map((origin) => {
          let bestIndex = -1;
          let bestDelta = Number.POSITIVE_INFINITY;
          const candidates = remaining.size ? [...remaining] : painted.map((_, index) => index);
          for (const index of candidates) {
            const point = painted[index];
            const delta = Math.hypot(origin.x - point.x, origin.y - point.y);
            if (delta < bestDelta) {
              bestDelta = delta;
              bestIndex = index;
            }
          }
          if (bestIndex >= 0) remaining.delete(bestIndex);
          const point = painted[bestIndex];
          const visibleOrigin = origin.visibleSpawnOrigin;
          const spawnMuzzle = origin.spriteMuzzleAtSpawn;
          const presentationDeltaPx =
            visibleOrigin && spawnMuzzle
              ? Math.hypot(visibleOrigin.x - spawnMuzzle.x, visibleOrigin.y - spawnMuzzle.y)
              : Number.POSITIVE_INFINITY;
          return {
            ...origin,
            screen: toScreen(origin.x, origin.y),
            paintedMuzzle: point,
            authorityDeltaPx: bestDelta,
            visibleSpawnOrigin: visibleOrigin
              ? { ...visibleOrigin, screen: toScreen(visibleOrigin.x, visibleOrigin.y) }
              : undefined,
            spriteMuzzleAtSpawn: spawnMuzzle
              ? { ...spawnMuzzle, screen: toScreen(spawnMuzzle.x, spawnMuzzle.y) }
              : undefined,
            presentationDeltaPx,
            deltaPx: presentationDeltaPx,
          };
        });
      };

      const observer = () => {
        const current = room.state.players.get(room.sessionId);
        if (!current?.alive || current.weapon !== probe.weaponId) return;
        const definition = globalThis.__ddMuzzleProbe.definition;
        if (!definition) return;
        const painted = visibleMuzzles(definition);

        const unseen = [];
        room.state.projectiles.forEach((row) => {
          if (
            row.sourcePlayerId === room.sessionId &&
            row.sourceWeaponId === probe.weaponId &&
            !probe.existingProjectiles.has(row.id) &&
            !probe.seenProjectiles.has(row.id)
          ) {
            const rendered = arena.projectiles?.get(row.id);
            const visibleSpawnOrigin = rendered
              ? {
                  x: rendered.getData?.("spawnOriginX"),
                  y: rendered.getData?.("spawnOriginY"),
                }
              : undefined;
            const spriteMuzzleAtSpawn = rendered
              ? {
                  x: rendered.getData?.("spawnMuzzleX"),
                  y: rendered.getData?.("spawnMuzzleY"),
                }
              : undefined;
            if (
              !Number.isFinite(visibleSpawnOrigin?.x) ||
              !Number.isFinite(visibleSpawnOrigin?.y) ||
              !Number.isFinite(spriteMuzzleAtSpawn?.x) ||
              !Number.isFinite(spriteMuzzleAtSpawn?.y)
            )
              return;
            probe.seenProjectiles.add(row.id);
            unseen.push({
              id: row.id,
              x: row.x,
              y: row.y,
              vx: row.vx,
              vy: row.vy,
              bornTick: row.bornTick,
              flightAgeTicks: row.flightAgeTicks,
              visibleSpawnOrigin,
              spriteMuzzleAtSpawn,
            });
          }
        });
        const byTick = new Map();
        for (const row of unseen) {
          const rows = byTick.get(row.bornTick) ?? [];
          rows.push(row);
          byTick.set(row.bornTick, rows);
        }
        for (const [bornTick, rows] of byTick) {
          const shotIndex = probe.shots.length;
          const shotPainted = probe.predictedFrames[shotIndex]?.paintedMuzzles ?? painted;
          probe.shots.push({
            kind: "projectile",
            shotIndex,
            bornTick,
            observedTick: room.state.tick >>> 0,
            player: { x: current.x, y: current.y, aimDir: current.aimDir },
            motionDistancePx: Math.hypot(current.x - probe.startX, current.y - probe.startY),
            lanes: match(uniqueOrigins(rows), shotPainted),
            paintedMuzzles: shotPainted,
            predictedAtMs: probe.predictedFrames[shotIndex]?.atMs,
          });
        }

        if (definition.beam && !probe.beam) {
          const rows = [];
          room.state.beams?.forEach?.((row, key) => {
            if (
              row.ownerId === room.sessionId &&
              row.weaponId === probe.weaponId &&
              row.phase === 2
            ) {
              const entry = arena.beamRenderer?.entries?.find(
                (candidate) => candidate.key === `${key}:${row.seq}` && candidate.body?.visible,
              );
              const bodyPoint = entry?.body?.points?.[0];
              const visibleSpawnOrigin =
                entry?.body && bodyPoint
                  ? {
                      x: entry.body.x + bodyPoint.x * entry.body.scaleX,
                      y: entry.body.y + bodyPoint.y * entry.body.scaleY,
                    }
                  : undefined;
              const nearestMuzzle = visibleSpawnOrigin
                ? painted.reduce(
                    (nearest, point) =>
                      !nearest ||
                      Math.hypot(point.x - visibleSpawnOrigin.x, point.y - visibleSpawnOrigin.y) <
                        Math.hypot(
                          nearest.x - visibleSpawnOrigin.x,
                          nearest.y - visibleSpawnOrigin.y,
                        )
                        ? point
                        : nearest,
                    undefined,
                  )
                : undefined;
              if (!visibleSpawnOrigin || !nearestMuzzle) return;
              rows.push({
                key,
                x: row.originX,
                y: row.originY,
                phase: row.phase,
                seq: row.seq,
                visibleSpawnOrigin,
                spriteMuzzleAtSpawn: nearestMuzzle
                  ? { x: nearestMuzzle.x, y: nearestMuzzle.y }
                  : undefined,
              });
            }
          });
          if (rows.length) {
            probe.beam = {
              kind: "beam",
              shotIndex: 0,
              bornTick: room.state.tick >>> 0,
              observedTick: room.state.tick >>> 0,
              player: { x: current.x, y: current.y, aimDir: current.aimDir },
              motionDistancePx: Math.hypot(current.x - probe.startX, current.y - probe.startY),
              lanes: match(
                rows.map((row) => ({ ...row, bornTick: room.state.tick >>> 0 })),
                painted,
              ),
              paintedMuzzles: painted,
            };
          }
        }

        if (!probe.firstCaptureReady && (probe.shots.length || probe.beam)) {
          probe.firstCaptureReady = true;
          probe.fireHeld = false;
          probe.moveX = 0;
          probe.moveY = 0;
          arena.stepNetInput?.(50, false, false, 0, 0);
        }
      };

      globalThis.__ddMuzzleProbe = {
        probe,
        observer,
        definition: undefined,
        visibleMuzzles,
        originalRoomSend: undefined,
        burstTimers: [],
      };
      arena.events.on("postupdate", observer);
      return { startAttackSeq, startTick, startX, startY, startAimDir, moveY };
    },
    { wanted: weapon.id, motion: mode, arenaHeight: ARENA_HEIGHT },
  );

  const acceptedSeq = (preflight.startAttackSeq + 1) >>> 0;
  if (!weapon.muzzle) throw new Error(`${weapon.id} has no art-space muzzle definition`);
  const points = weapon.beam
    ? weapon.muzzle.points
    : weaponArtMuzzlePointsForShot(weapon.muzzle, acceptedSeq);
  const pointIndices = points.map((point) => weapon.muzzle.points.indexOf(point));
  await page.evaluate(
    (definition) => {
      globalThis.__ddMuzzleProbe.definition = definition;
      const arena = globalThis.ddGame.scene.getScene("arena");
      const entry = globalThis.__ddMuzzleProbe;
      const room = arena.room;
      entry.originalRoomSend = room.send;
      room.send = function (...sendArgs) {
        const [type] = sendArgs;
        if (type === "attack" && !entry.probe.predictedFrames.length) {
          const capture = (round) => {
            entry.probe.predictedFrames[round] = {
              atMs: performance.now(),
              paintedMuzzles: entry.visibleMuzzles(definition),
            };
          };
          capture(0);
          for (let round = 1; round < definition.burstCount; round++) {
            entry.burstTimers.push(
              window.setTimeout(
                () => capture(round),
                definition.burstIntervalSeconds * round * 1000,
              ),
            );
          }
        }
        return entry.originalRoomSend.apply(this, sendArgs);
      };
      if (arena.verbs?.isLegendOpen?.()) arena.verbs.toggleLegend(arena.time.now);
      arena.verbs?.releaseInputLatchIf?.(true);
      arena.game.hasFocus = true;
      arena.input.activePointer.rightButtonDown = () => globalThis.__ddMuzzleProbe.probe.fireHeld;
      globalThis.__ddMuzzleProbe.timer = window.setInterval(() => {
        const probe = globalThis.__ddMuzzleProbe?.probe;
        if (!probe) return;
        arena.stepNetInput?.(50, false, false, probe.moveX, probe.moveY);
      }, 50);
    },
    {
      acceptedSeq,
      beam: !!weapon.beam,
      burstCount: weapon.gun?.burst?.count ?? 1,
      burstIntervalSeconds: weapon.gun?.burst?.intervalSeconds ?? 0,
      pointIndices,
      points: points.map((point) => ({
        part: point.part,
        x: point.x,
        y: point.y,
        width: weapon.muzzle.parts[point.part]?.width ?? weapon.muzzle.parts[0].width,
        height: weapon.muzzle.parts[point.part]?.height ?? weapon.muzzle.parts[0].height,
      })),
    },
  );
  return { ...preflight, acceptedSeq, points };
}

async function triggerCase(weapon, mode) {
  const started = await beginCase(weapon, mode);
  if (mode === "strafing") {
    await page.keyboard.down(started.moveY > 0 ? "s" : "w");
    await page.waitForFunction(
      () => {
        const entry = globalThis.__ddMuzzleProbe?.probe;
        const arena = globalThis.ddGame?.scene?.getScene("arena");
        const self = arena?.room?.state?.players?.get(arena.room.sessionId);
        return !!entry && !!self && Math.hypot(self.x - entry.startX, self.y - entry.startY) >= 12;
      },
      undefined,
      { timeout: 5_000 },
    );
  } else {
    await page.waitForTimeout(100);
  }
  await page.evaluate(() => {
    globalThis.__ddMuzzleProbe.probe.fireHeld = true;
  });
  await page.waitForFunction(
    () => globalThis.__ddMuzzleProbe?.probe?.firstCaptureReady === true,
    undefined,
    { timeout: weapon.beam ? 20_000 : 8_000 },
  );

  const firstCapture = await page.evaluate(() => {
    const probe = globalThis.__ddMuzzleProbe.probe;
    return probe.beam ?? probe.shots[0];
  });
  const screenshotWanted =
    screenshotMode === "all" || (screenshotMode === "stationary" && mode === "stationary");
  let screenshot;
  if (screenshotWanted) {
    const maxDelta = Math.max(0, ...firstCapture.lanes.map((lane) => lane.deltaPx));
    await page.evaluate(
      ({ id, labelMode, lanes, delta, tolerance }) => {
        document.getElementById("__dd-muzzle-overlay")?.remove();
        const layer = document.createElement("div");
        layer.id = "__dd-muzzle-overlay";
        layer.style.cssText =
          "position:fixed;inset:0;z-index:2147483647;pointer-events:none;font:12px/1.35 ui-monospace,monospace;color:white";
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("width", "100%");
        svg.setAttribute("height", "100%");
        svg.style.cssText = "position:absolute;inset:0;overflow:visible";
        for (const lane of lanes) {
          const painted = lane.spriteMuzzleAtSpawn.screen;
          const origin = lane.visibleSpawnOrigin.screen;
          const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
          line.setAttribute("x1", painted.x);
          line.setAttribute("y1", painted.y);
          line.setAttribute("x2", origin.x);
          line.setAttribute("y2", origin.y);
          line.setAttribute("stroke", lane.deltaPx <= tolerance ? "#6dff90" : "#ff5570");
          line.setAttribute("stroke-width", "2");
          svg.append(line);
          for (const [point, color, radius] of [
            [painted, "#31d7ff", 6],
            [origin, lane.deltaPx <= tolerance ? "#6dff90" : "#ff334f", 3],
          ]) {
            const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            circle.setAttribute("cx", point.x);
            circle.setAttribute("cy", point.y);
            circle.setAttribute("r", radius);
            circle.setAttribute("fill", "none");
            circle.setAttribute("stroke", color);
            circle.setAttribute("stroke-width", "2");
            svg.append(circle);
          }
        }
        const legend = document.createElement("div");
        legend.style.cssText =
          "position:absolute;left:8px;top:8px;padding:7px 9px;border:1px solid #786d90;border-radius:5px;background:#11101ddd";
        legend.innerHTML = `<b>${id}</b><br>${labelMode} · max visible Δ ${delta.toFixed(2)}px<br><span style="color:#31d7ff">○ sprite muzzle at admission</span> · <span style="color:#6dff90">○ visible spawn origin</span>`;
        layer.append(svg, legend);
        document.body.append(layer);
      },
      {
        id: weapon.id,
        labelMode: mode,
        lanes: firstCapture.lanes,
        delta: maxDelta,
        tolerance: tolerancePx,
      },
    );
    const absolute = caseScreenshotPath(weapon.id, mode);
    await page.screenshot({ path: absolute, type: "jpeg", quality: 72, fullPage: true });
    screenshot = publicArtifactPath(absolute);
  }

  await page.evaluate(() => {
    document.getElementById("__dd-muzzle-overlay")?.remove();
    const arena = globalThis.ddGame?.scene?.getScene("arena");
    arena?.scene?.resume();
  });

  const wantedShots = weapon.gun?.burst?.count ?? 1;
  if (weapon.gun && wantedShots > 1) {
    await page.waitForFunction(
      (count) => globalThis.__ddMuzzleProbe?.probe?.shots?.length >= count,
      wantedShots,
      { timeout: 8_000 },
    );
  }
  await page.waitForTimeout(80);
  const capture = await page.evaluate(() => {
    const entry = globalThis.__ddMuzzleProbe;
    const arena = globalThis.ddGame?.scene?.getScene("arena");
    const probe = entry.probe;
    if (entry.timer) window.clearInterval(entry.timer);
    for (const timer of entry.burstTimers ?? []) window.clearTimeout(timer);
    if (entry.originalRoomSend) arena.room.send = entry.originalRoomSend;
    arena?.events?.off("postupdate", entry.observer);
    if (arena?.input?.activePointer) arena.input.activePointer.rightButtonDown = () => false;
    arena?.stepNetInput?.(50, false, false, 0, 0);
    const result = {
      shots: probe.beam ? [probe.beam] : probe.shots,
      finalPlayer: (() => {
        const self = arena?.room?.state?.players?.get(arena.room.sessionId);
        return self ? { x: self.x, y: self.y } : undefined;
      })(),
    };
    globalThis.__ddMuzzleProbe = undefined;
    return result;
  });
  const shots = capture.shots;
  const lanes = shots.flatMap((shot) => shot.lanes);
  const maxDeltaPx = Math.max(0, ...lanes.map((lane) => lane.presentationDeltaPx));
  const maxAuthorityDeltaPx = Math.max(0, ...lanes.map((lane) => lane.authorityDeltaPx));
  if (mode === "strafing") {
    await page.keyboard.up("w");
    await page.keyboard.up("s");
  }
  return {
    mode,
    acceptedSeq: started.acceptedSeq,
    startTick: started.startTick,
    startPlayer: { x: started.startX, y: started.startY },
    finalPlayer: capture.finalPlayer,
    motionDistancePx: Math.max(0, ...shots.map((shot) => shot.motionDistancePx)),
    shots,
    maxDeltaPx,
    maxAuthorityDeltaPx,
    passed: lanes.length > 0 && maxDeltaPx <= tolerancePx,
    screenshot,
  };
}

const results = [];
const startedAt = Date.now();
try {
  const first = selection[0]?.weapon;
  if (!first) throw new Error("gun-delivery catalog is empty");
  await page.goto(`${baseURL}/?dev=weapon:${encodeURIComponent(first.id)}`, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  await page.waitForFunction(
    (wanted) => {
      const arena = globalThis.ddGame?.scene?.getScene("arena");
      const room = arena?.room;
      const self = room?.sessionId ? room.state?.players?.get(room.sessionId) : undefined;
      return room?.state?.mode === "training" && self?.weapon === wanted;
    },
    first.id,
    { timeout: 30_000 },
  );
  await page.locator("#game-root canvas").click({ position: { x: 320, y: 180 } });
  await page.mouse.move(430, 180);

  for (let index = 0; index < selection.length; index++) {
    const { weapon, reasons } = selection[index];
    if (index > 0) await resetPrivateTrainingGrounds();
    await waitForWeapon(weapon.id);
    let cases;
    let error;
    let attempts = 0;
    do {
      attempts++;
      cases = [];
      error = undefined;
      if (attempts > 1) {
        await resetPrivateTrainingGrounds();
        await waitForWeapon(weapon.id);
      }
      try {
        cases.push(await triggerCase(weapon, "stationary"));
        if (privateHarness) {
          await resetPrivateTrainingGrounds();
          await waitForWeapon(weapon.id);
        } else {
          await page.waitForTimeout(100);
        }
        cases.push(await triggerCase(weapon, "strafing"));
      } catch (caught) {
        await page.keyboard.up("w").catch(() => undefined);
        await page.keyboard.up("s").catch(() => undefined);
        error = caught instanceof Error ? (caught.stack ?? caught.message) : String(caught);
        await page
          .evaluate(() => {
            const arena = globalThis.ddGame?.scene?.getScene("arena");
            const entry = globalThis.__ddMuzzleProbe;
            if (entry?.timer) window.clearInterval(entry.timer);
            for (const timer of entry?.burstTimers ?? []) window.clearTimeout(timer);
            if (entry?.originalRoomSend && arena?.room) arena.room.send = entry.originalRoomSend;
            if (entry?.observer) arena?.events?.off("postupdate", entry.observer);
            if (arena?.input?.activePointer)
              arena.input.activePointer.rightButtonDown = () => false;
            arena?.scene?.resume();
            arena?.stepNetInput?.(50, false, false, 0, 0);
            globalThis.__ddMuzzleProbe = undefined;
          })
          .catch(() => undefined);
        if (privateHarness && attempts < 3) {
          console.log(`${weapon.id}: transient live trial failed; retrying (${attempts}/3)`);
        }
      }
    } while (error && privateHarness && attempts < 3);
    const firstShot = cases[0]?.shots?.[0];
    const artPoint = firstShot?.paintedMuzzles?.[0]?.artPoint;
    const artParts = (weapon.muzzle?.parts ?? []).map((dimensions, part) => ({
      part,
      partFile: `part-${part + 1}.png`,
      width: dimensions.width,
      height: dimensions.height,
      points: (weapon.muzzle?.points ?? [])
        .filter((point) => point.part === part)
        .map((point) => ({
          x: point.x,
          y: point.y,
          normalizedX: point.x / dimensions.width,
          normalizedY: point.y / dimensions.height,
          derived: point.derived,
          overrideReason: point.overrideReason,
        })),
    }));
    const initialAuthorityDeltaPx = Math.max(
      0,
      ...(cases[0]?.shots?.[0]?.lanes ?? []).map((lane) => lane.authorityDeltaPx),
    );
    const maxAuthorityDeltaPx = Math.max(0, ...cases.map((entry) => entry.maxAuthorityDeltaPx));
    results.push({
      weaponId: weapon.id,
      name: weapon.name,
      deliveryKind: weapon.gun ? "gun" : "beam",
      family: weapon.tags.family,
      spriteId: weaponDisplaySpriteId(weapon),
      partFile: "part-1.png",
      displayLength: weapon.displayLength,
      expansion: !!weapon.expansion,
      dual: !!weapon.dual,
      muzzleCount: weapon.muzzle?.points.length ?? 0,
      burstCount: weapon.gun?.burst?.count ?? 1,
      sampleReasons: reasons,
      attempts,
      artPoint,
      artParts,
      cases,
      maxDeltaPx: Math.max(0, ...cases.map((entry) => entry.maxDeltaPx)),
      maxAuthorityDeltaPx,
      initialAuthorityDeltaPx,
      passed:
        !error &&
        cases.length === 2 &&
        cases.every((entry) => entry.passed) &&
        initialAuthorityDeltaPx <= tolerancePx,
      error,
    });
    const row = results.at(-1);
    console.log(
      `[${index + 1}/${selection.length}] ${weapon.id}: ${row.passed ? "PASS" : "FAIL"} visibleDelta=${row.maxDeltaPx.toFixed(2)}px auth0Delta=${row.initialAuthorityDeltaPx.toFixed(2)}px`,
    );
  }
} finally {
  await context.close().catch(() => undefined);
  await browser.close().catch(() => undefined);
}

const unexpectedBrowserErrors = browserErrors.filter(
  (message) => !message.includes("Texture key already in use: dd-sprites"),
);
const failed = results.filter((weapon) => !weapon.passed);
const summary = {
  schemaVersion: 1,
  capturedAt: new Date().toISOString(),
  durationSeconds: (Date.now() - startedAt) / 1_000,
  baseURL,
  selection: selectionKind,
  catalogCount: catalog.length,
  selectedCount: selection.length,
  tolerancePx,
  samplePolicy: {
    always: [
      "base roster",
      "one per gun/beam family",
      "all multi-barrel",
      "all burst",
      "all dual",
      "owner-reported muzzle regressions",
    ],
    rotation: `stable id hash, one of ${ROTATING_SAMPLE_BUCKETS} UTC-daily buckets`,
    fullFlag: "--full or DD_FULL_MUZZLE_SWEEP=1",
  },
  passedWeapons: results.length - failed.length,
  failedWeapons: failed.length,
  maxDeltaPx: Math.max(0, ...results.map((weapon) => weapon.maxDeltaPx)),
  maxPresentationDeltaPx: Math.max(0, ...results.map((weapon) => weapon.maxDeltaPx)),
  maxInitialAuthorityDeltaPx: Math.max(
    0,
    ...results.map((weapon) => weapon.initialAuthorityDeltaPx),
  ),
  unexpectedBrowserErrors,
  excludedNonMuzzleRows: excludedRows,
};
const table = { summary, weapons: results };
const tablePath = path.join(outputRoot, "sweep.json");
await writeFile(tablePath, `${JSON.stringify(table, null, 2)}\n`);
console.log(JSON.stringify({ ...summary, table: path.relative(REPO_ROOT, tablePath) }, null, 2));

if (writeContactSheet) {
  const { spawn } = await import("node:child_process");
  await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [path.join(REPO_ROOT, "tools/gen-muzzle-reference.mjs")],
      {
        cwd: REPO_ROOT,
        stdio: "inherit",
      },
    );
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`contact sheet exited ${code}`)),
    );
  });
}

if (failed.length || unexpectedBrowserErrors.length) process.exitCode = 1;
