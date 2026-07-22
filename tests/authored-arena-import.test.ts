import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as shared from "@dd/shared";
import { describe, expect, it } from "vitest";
import {
  compileLdtkProject,
  parseLdtkJson,
  renderGeneratedCatalog,
} from "../tools/levels/ldtk-import.mjs";

// biome-ignore lint/suspicious/noExplicitAny: fixtures intentionally exercise untrusted JSON shapes.
type JsonObject = Record<string, any>;

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..");
const SOURCE = join(REPO, "data", "arenas", "dimension-drifters.ldtk");
const GENERATED = join(REPO, "packages", "shared", "src", "authored-arenas.generated.ts");
const FIXTURES = join(HERE, "fixtures", "ldtk");
const GENERATOR = join(REPO, "tools", "levels", "gen-authored-arenas.mjs");

const readProject = (): JsonObject => JSON.parse(readFileSync(SOURCE, "utf8"));
const gameplayLayer = (project: JsonObject): JsonObject =>
  project.levels[0].layerInstances.find((layer: JsonObject) => layer.__identifier === "Gameplay");
const layerNamed = (project: JsonObject, identifier: string): JsonObject =>
  project.levels[0].layerInstances.find((layer: JsonObject) => layer.__identifier === identifier);
const fieldNamed = (entity: JsonObject, identifier: string): JsonObject =>
  entity.fieldInstances.find((field: JsonObject) => field.__identifier === identifier);
const byRowColIid = (a: JsonObject, b: JsonObject): number =>
  a.__grid[1] - b.__grid[1] || a.__grid[0] - b.__grid[0] || a.iid.localeCompare(b.iid);

function applyMutation(project: JsonObject, mutation: JsonObject): void {
  const level = project.levels[0];
  switch (mutation.kind) {
    case "set-json-version":
      project.jsonVersion = mutation.value;
      return;
    case "set-level-dimensions":
      level.pxWid = mutation.width;
      level.pxHei = mutation.height;
      return;
    case "set-layer-grid-size":
      layerNamed(project, mutation.layer).__gridSize = mutation.value;
      return;
    case "set-int-grid-cell": {
      const layer = layerNamed(project, mutation.layer);
      layer.intGridCsv[mutation.row * layer.__cWid + mutation.col] = mutation.value;
      return;
    }
    case "build-stranded-island": {
      const terrain = layerNamed(project, "Terrain");
      for (let row = mutation.top; row <= mutation.bottom; row++)
        for (let col = mutation.left; col <= mutation.right; col++)
          terrain.intGridCsv[row * terrain.__cWid + col] =
            col >= mutation.islandLeft &&
            col <= mutation.islandRight &&
            row >= mutation.islandTop &&
            row <= mutation.islandBottom
              ? 0
              : 1;
      return;
    }
    case "remove-cluster-tree": {
      const gameplay = gameplayLayer(project);
      const clusters = gameplay.entityInstances
        .filter((entity: JsonObject) => entity.__identifier === "PoiCluster")
        .sort(byRowColIid);
      const removed = clusters[mutation.clusterOrdinal];
      gameplay.entityInstances = gameplay.entityInstances.filter(
        (entity: JsonObject) =>
          entity.iid !== removed.iid &&
          !(
            entity.__identifier === "Landmark" &&
            fieldNamed(entity, "Cluster").__value.entityIid === removed.iid
          ),
      );
      return;
    }
    case "set-landmark-cluster-ref": {
      const landmarks = gameplayLayer(project)
        .entityInstances.filter((entity: JsonObject) => entity.__identifier === "Landmark")
        .sort(byRowColIid);
      fieldNamed(landmarks[mutation.landmarkOrdinal], "Cluster").__value.entityIid =
        mutation.entityIid;
      return;
    }
    case "remove-player-spawn": {
      const gameplay = gameplayLayer(project);
      gameplay.entityInstances = gameplay.entityInstances.filter(
        (entity: JsonObject) => entity.__identifier !== "PlayerSpawn",
      );
      return;
    }
    default:
      throw new Error(`unknown fixture mutation ${String(mutation.kind)}`);
  }
}

function cloneLevelWithFreshIids(project: JsonObject): JsonObject {
  const source = project.levels[0];
  const clone = structuredClone(source);
  clone.identifier = "zeta_arena";
  clone.iid = "63333333-3333-4333-8333-333333333333";
  clone.uid = 101;
  clone.worldX = 4800;
  fieldNamed({ fieldInstances: clone.fieldInstances }, "DisplayName").__value = "Zeta Arena";

  const oldLayerIids = new Map<string, string>();
  for (let index = 0; index < clone.layerInstances.length; index++) {
    const layer = clone.layerInstances[index];
    const oldIid = layer.iid;
    layer.iid = `64444444-4444-4444-8444-${String(index + 1).padStart(12, "0")}`;
    layer.levelId = 101;
    oldLayerIids.set(oldIid, layer.iid);
  }
  const gameplay = clone.layerInstances.find(
    (layer: JsonObject) => layer.__identifier === "Gameplay",
  );
  const entityIids = new Map<string, string>();
  for (let index = 0; index < gameplay.entityInstances.length; index++) {
    const entity = gameplay.entityInstances[index];
    const oldIid = entity.iid;
    entity.iid = `65000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
    entity.__worldX = clone.worldX + entity.px[0];
    entity.__worldY = clone.worldY + entity.px[1];
    entityIids.set(oldIid, entity.iid);
  }
  for (const entity of gameplay.entityInstances)
    for (const field of entity.fieldInstances) {
      const ref = field.__value;
      if (field.__type !== "EntityRef" || !ref) continue;
      ref.entityIid = entityIids.get(ref.entityIid);
      ref.layerIid = oldLayerIids.get(ref.layerIid);
      ref.levelIid = clone.iid;
    }
  return clone;
}

function reorderEditorArrays(project: JsonObject): JsonObject {
  const shuffled = structuredClone(project);
  shuffled.defs.layers.reverse();
  shuffled.defs.entities.reverse();
  shuffled.defs.enums.reverse();
  shuffled.defs.levelFields.reverse();
  for (const layer of shuffled.defs.layers) layer.intGridValues.reverse();
  for (const entity of shuffled.defs.entities) entity.fieldDefs.reverse();
  shuffled.levels.reverse();
  for (const level of shuffled.levels) {
    level.fieldInstances.reverse();
    level.layerInstances.reverse();
    for (const layer of level.layerInstances) {
      layer.entityInstances.reverse();
      for (const entity of layer.entityInstances) entity.fieldInstances.reverse();
    }
  }
  return shuffled;
}

describe("LDtk authored arena compiler", () => {
  it("compiles owner-playground through the shared arena laws", () => {
    const records = compileLdtkProject(readProject(), { shared, sourceLabel: SOURCE });
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      id: "owner-playground",
      displayName: "Owner Playground",
      initialDimensionId: "wild-west",
      cols: 60,
      rows: 60,
      tileSize: 80,
      spawnX: 2440,
      spawnY: 2440,
    });
    expect(records[0].tiles).toHaveLength(3600);
    expect(records[0].zoneIds).toHaveLength(3600);
    expect(records[0].poiClusters).toHaveLength(6);
    expect(records[0].pois).toHaveLength(24);
    expect(records[0].revision).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it("is byte-stable across repeat imports and harmless editor reordering", () => {
    const project = readProject();
    project.levels.push(cloneLevelWithFreshIids(project));
    const first = renderGeneratedCatalog(
      compileLdtkProject(project, { shared, sourceLabel: "two-level-order-a.ldtk" }),
    );
    const repeat = renderGeneratedCatalog(
      compileLdtkProject(structuredClone(project), {
        shared,
        sourceLabel: "two-level-order-a.ldtk",
      }),
    );
    const reordered = renderGeneratedCatalog(
      compileLdtkProject(reorderEditorArrays(project), {
        shared,
        sourceLabel: "two-level-order-a.ldtk",
      }),
    );
    expect(Buffer.from(repeat)).toEqual(Buffer.from(first));
    expect(Buffer.from(reordered)).toEqual(Buffer.from(first));
    expect(first.indexOf('"owner-playground"')).toBeLessThan(first.indexOf('"zeta-arena"'));
  });

  it("rejects every hostile fixture loudly, with identity and coordinates, without repairing source", () => {
    const fixtureNames = readdirSync(FIXTURES)
      .filter((name) => name.endsWith(".json"))
      .sort();
    const fixtures = fixtureNames.map((fixtureName) => ({
      fixtureName,
      fixture: JSON.parse(readFileSync(join(FIXTURES, fixtureName), "utf8")),
    }));
    const activeFixtures = fixtures.filter(({ fixture }) => fixture.handoff == null);
    const handoffFixtures = fixtures.filter(({ fixture }) => fixture.handoff != null);
    expect(activeFixtures).toHaveLength(10);
    expect(handoffFixtures.map(({ fixtureName }) => fixtureName)).toEqual([
      "blocked-spawn-disc.sol2-handoff.json",
      "disconnected-zone.sol2-handoff.json",
      "insufficient-gate-space.sol2-handoff.json",
      "overlapping-unsafe-poi.sol2-handoff.json",
    ]);
    for (const { fixture } of handoffFixtures) {
      expect(fixture.handoff).toBe("ldtk-runtime-integration");
      expect(fixture.missingSharedLaw).toBeTypeOf("string");
      expect(fixture.expectedWitness).toBeTypeOf("object");
    }
    for (const { fixtureName, fixture } of activeFixtures) {
      const project = readProject();
      applyMutation(project, fixture.mutation);
      const before = JSON.stringify(project);
      let message = "";
      try {
        compileLdtkProject(project, { shared, sourceLabel: fixtureName });
      } catch (error) {
        message = error instanceof Error ? error.message : String(error);
      }
      expect(message, `${fixtureName}: ${fixture.description}`).toContain(fixture.expected);
      expect(message).toContain(`source=${JSON.stringify(fixtureName)}`);
      expect(message).toMatch(/level="[^"]+"/);
      expect(message).toMatch(/(?:project|level|layer|entity)IID="[^"]+"/);
      expect(message).toMatch(/tile=\(\d+,\d+\) world=\(\d+,\d+\)/);
      expect(JSON.stringify(project), `${fixtureName} was mutated by validation`).toBe(before);
    }
  });

  it("--check detects valid source/generated drift and does not write", () => {
    const temp = mkdtempSync(join(tmpdir(), "dd-ldtk-import-"));
    try {
      const source = join(temp, "test.ldtk");
      const output = join(temp, "catalog.generated.ts");
      writeFileSync(source, readFileSync(SOURCE));
      execFileSync(process.execPath, [GENERATOR, "--source", source, "--out", output], {
        cwd: REPO,
        stdio: "pipe",
      });
      const generatedBefore = readFileSync(output, "utf8");
      const drifted = parseLdtkJson(readFileSync(source, "utf8"), source);
      const displayName = drifted.levels[0].fieldInstances.find(
        (field: JsonObject) => field.__identifier === "DisplayName",
      );
      displayName.__value = "Drifted Owner Playground";
      writeFileSync(source, `${JSON.stringify(drifted, null, 2)}\n`);

      const check = spawnSync(
        process.execPath,
        [GENERATOR, "--check", "--source", source, "--out", output],
        { cwd: REPO, encoding: "utf8" },
      );
      expect(check.status).toBe(1);
      expect(`${check.stdout}${check.stderr}`).toContain("is STALE");
      expect(readFileSync(output, "utf8")).toBe(generatedBefore);
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  });

  it("the committed generated catalog is exactly generator-owned output", () => {
    const expected = renderGeneratedCatalog(
      compileLdtkProject(readProject(), { shared, sourceLabel: SOURCE }),
    );
    expect(readFileSync(GENERATED, "utf8").replace(/\r\n/g, "\n")).toBe(expected);
  });
});
