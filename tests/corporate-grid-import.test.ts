import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  compileCorporateGridProject,
  parseCorporateGridJson,
  renderCorporateGridCatalog,
  synthesizeEnemyAnchors,
} from "../tools/mapkit/corporate-grid-import.mjs";

// biome-ignore lint/suspicious/noExplicitAny: fixtures intentionally exercise untrusted LDtk JSON.
type JsonObject = Record<string, any>;

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..");
const SOURCE = join(
  REPO,
  "data",
  "maps",
  "corporate-grid",
  "corporate_grid_v13_imagegen_material_variants.ldtk",
);
const GENERATED = join(REPO, "packages", "shared", "src", "corporate-grid-map.generated.ts");

const readProject = (): JsonObject => parseCorporateGridJson(readFileSync(SOURCE, "utf8"), SOURCE);

function reverseHarmlessEditorArrays(project: JsonObject): JsonObject {
  const reordered = structuredClone(project);
  reordered.levels.reverse();
  reordered.defs.layers.reverse();
  reordered.defs.entities.reverse();
  reordered.defs.tilesets.reverse();
  for (const level of reordered.levels) {
    level.layerInstances.reverse();
    for (const layer of level.layerInstances) {
      layer.entityInstances.reverse();
      layer.gridTiles.reverse();
    }
  }
  return reordered;
}

describe("corporate-grid LDtk importer", () => {
  it("extracts the locked collision, lane, entity, and tile counts for all three floors", () => {
    const catalog = compileCorporateGridProject(readProject(), { sourceLabel: SOURCE });
    expect(catalog.modelVersion).toBe(1);
    expect(catalog.floors.map((floor) => floor.id)).toEqual([
      "office-red-carpet-gallery",
      "office-random-dude-portrait-hall",
      "office-marble-gallery",
    ]);
    expect(catalog.revision).toMatch(/^sha256:[0-9a-f]{64}$/);
    for (const floor of catalog.floors) {
      expect(floor).toMatchObject({
        width: 5160,
        height: 1080,
        gridSize: 60,
        cols: 86,
        rows: 18,
        laneBounds: { minY: 450, maxY: 930 },
        playableBounds: { minX: 120, maxX: 5040 },
        cameraBounds: { minX: 120, minY: 360, maxX: 5040, maxY: 1020 },
      });
      expect(floor.collisionGrid.filter((value) => value === 1)).toHaveLength(598);
      expect(floor.collisionGrid.filter((value) => value === 3)).toHaveLength(48);
      expect(floor.laneGrid.filter((value) => value === 1)).toHaveLength(430);
      expect(floor.laneGrid.filter((value) => value === 2)).toHaveLength(516);
      expect(floor.playerSpawns).toHaveLength(1);
      expect(floor.authoredEnemySpawns).toHaveLength(2);
      expect(floor.endWalls).toHaveLength(2);
      expect(floor.elevatorMarkers).toHaveLength(3);
      expect(floor.combatLanes).toHaveLength(5);
      expect(floor.renderLayers.map((layer) => layer.id)).toEqual([
        "parallax-city-backdrop",
        "office-material-tiles",
      ]);
      expect(
        floor.renderLayers
          .find((layer) => layer.id === "parallax-city-backdrop")
          ?.indices.filter((value) => value >= 0),
      ).toHaveLength(688);
      expect(
        floor.renderLayers
          .find((layer) => layer.id === "office-material-tiles")
          ?.indices.filter((value) => value >= 0),
      ).toHaveLength(1548);
    }
  });

  it("is byte-deterministic across repeat imports and harmless LDtk array reordering", () => {
    const project = readProject();
    const first = renderCorporateGridCatalog(
      compileCorporateGridProject(project, { sourceLabel: SOURCE }),
    );
    const repeat = renderCorporateGridCatalog(
      compileCorporateGridProject(structuredClone(project), { sourceLabel: SOURCE }),
    );
    const reordered = renderCorporateGridCatalog(
      compileCorporateGridProject(reverseHarmlessEditorArrays(project), {
        sourceLabel: SOURCE,
      }),
    );
    expect(Buffer.from(repeat)).toEqual(Buffer.from(first));
    expect(Buffer.from(reordered)).toEqual(Buffer.from(first));
  });

  it("synthesizes six deterministic, evenly dispersed anchors without replacing authored markers", () => {
    const catalog = compileCorporateGridProject(readProject(), { sourceLabel: SOURCE });
    for (const floor of catalog.floors) {
      expect(floor.waveAnchors).toHaveLength(8);
      expect(floor.waveAnchors.filter((anchor) => anchor.source === "authored")).toHaveLength(2);
      expect(floor.waveAnchors.filter((anchor) => anchor.source === "synthetic")).toHaveLength(6);
      expect(floor.waveAnchors.map((anchor) => anchor.x)).toEqual(
        [...floor.waveAnchors].map((anchor) => anchor.x).sort((a, b) => a - b),
      );
      expect(floor.waveAnchors.every((anchor) => anchor.x >= 120 && anchor.x <= 5040)).toBe(true);
      expect(floor.waveAnchors.every((anchor) => anchor.y >= 450 && anchor.y <= 930)).toBe(true);
    }
    expect(
      synthesizeEnemyAnchors(
        [
          { iid: "a", x: 800, y: 500 },
          { iid: "b", x: 4200, y: 800 },
        ],
        { minX: 120, maxX: 5040 },
        { minY: 450, maxY: 930 },
      ),
    ).toEqual(
      synthesizeEnemyAnchors(
        [
          { iid: "b", x: 4200, y: 800 },
          { iid: "a", x: 800, y: 500 },
        ],
        { minX: 120, maxX: 5040 },
        { minY: 450, maxY: 930 },
      ),
    );
  });

  it("keeps the committed generated catalog entirely generator-owned", () => {
    const expected = renderCorporateGridCatalog(
      compileCorporateGridProject(readProject(), { sourceLabel: SOURCE }),
    );
    expect(readFileSync(GENERATED, "utf8").replace(/\r\n/g, "\n")).toBe(expected);
  });
});
