import { createHash } from "node:crypto";

export const CORPORATE_GRID_MODEL_VERSION = 1;
export const SUPPORTED_LDTK_JSON_VERSION = "1.5.3";
export const SYNTHESIZED_ANCHOR_TARGET = 8;

const GRID_SIZE = 60;
const LEVEL_WIDTH = 5160;
const LEVEL_HEIGHT = 1080;
const COLS = LEVEL_WIDTH / GRID_SIZE;
const ROWS = LEVEL_HEIGHT / GRID_SIZE;
const REQUIRED_LEVELS = [
  "Office_Red_Carpet_Gallery",
  "Office_Random_Dude_Portrait_Hall",
  "Office_Marble_Gallery",
];
const REQUIRED_LAYERS = new Map([
  ["Gameplay_Markers", "Entities"],
  ["Collision_IntGrid", "IntGrid"],
  ["Lane_Guides", "IntGrid"],
  ["Office_Material_Tiles", "Tiles"],
  ["Parallax_City_Backdrop", "Tiles"],
]);
const REQUIRED_TILESETS = new Map([
  [
    "V13_ImageGen_Office_Material_Variants_60",
    "tilesets/v13_imagegen_material_variant_modules_60.png",
  ],
  ["V13_City_Parallax_Backdrop_60", "tilesets/v13_city_parallax_backdrop_60.png"],
]);
const ENTITY_COUNTS = new Map([
  ["PlayerSpawn", 1],
  ["EnemySpawn", 2],
  ["CameraBounds", 1],
  ["EndWall", 2],
  ["ElevatorMarker", 3],
  ["CombatLane", 5],
]);
const FLOOR_IDS = new Map([
  ["Office_Red_Carpet_Gallery", "office-red-carpet-gallery"],
  ["Office_Random_Dude_Portrait_Hall", "office-random-dude-portrait-hall"],
  ["Office_Marble_Gallery", "office-marble-gallery"],
]);

export class CorporateGridImportError extends Error {
  constructor(message) {
    super(message);
    this.name = "CorporateGridImportError";
  }
}

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const isSafeInt = (value) => Number.isSafeInteger(value);
const compareText = (a, b) => String(a).localeCompare(String(b), "en");
const byPosition = (a, b) =>
  a.y - b.y || a.x - b.x || compareText(a.type ?? "", b.type ?? "") || compareText(a.iid, b.iid);

function fail(sourceLabel, subject, message) {
  throw new CorporateGridImportError(
    `[corporate-grid import] source=${JSON.stringify(sourceLabel)} ${subject}: ${message}`,
  );
}

function requireObject(value, sourceLabel, subject) {
  if (!isObject(value)) fail(sourceLabel, subject, "must be an object");
  return value;
}

function requireArray(value, sourceLabel, subject) {
  if (!Array.isArray(value)) fail(sourceLabel, subject, "must be an array");
  return value;
}

function indexUnique(items, key, sourceLabel, subject) {
  const out = new Map();
  for (const item of items) {
    const value = item?.[key];
    if ((typeof value !== "string" && !isSafeInt(value)) || value === "")
      fail(sourceLabel, subject, `has an invalid ${key}`);
    if (out.has(value)) fail(sourceLabel, subject, `duplicates ${key} ${JSON.stringify(value)}`);
    out.set(value, item);
  }
  return out;
}

function requireExactIdentifiers(items, expected, sourceLabel, subject, key = "identifier") {
  const observed = new Map();
  for (const item of items) {
    if (typeof item?.[key] !== "string")
      fail(sourceLabel, subject, "contains an item without an identifier");
    observed.set(item[key], (observed.get(item[key]) ?? 0) + 1);
  }
  for (const identifier of expected) {
    const count = observed.get(identifier) ?? 0;
    if (count !== 1)
      fail(sourceLabel, subject, `must define ${identifier} exactly once (observed ${count})`);
  }
  for (const identifier of observed.keys()) {
    if (!expected.includes(identifier))
      fail(sourceLabel, subject, `contains unsupported ${identifier}`);
  }
}

export function parseCorporateGridJson(text, sourceLabel = "<memory>") {
  try {
    return JSON.parse(text);
  } catch (error) {
    fail(
      sourceLabel,
      "project",
      `contains invalid JSON (${error instanceof Error ? error.message : String(error)})`,
    );
  }
}

function validateDefinitions(project, sourceLabel) {
  const defs = requireObject(project.defs, sourceLabel, "defs");
  const layers = requireArray(defs.layers, sourceLabel, "defs.layers");
  const entities = requireArray(defs.entities, sourceLabel, "defs.entities");
  const tilesets = requireArray(defs.tilesets, sourceLabel, "defs.tilesets");
  requireExactIdentifiers(layers, [...REQUIRED_LAYERS.keys()], sourceLabel, "layer definitions");
  requireExactIdentifiers(entities, [...ENTITY_COUNTS.keys()], sourceLabel, "entity definitions");
  requireExactIdentifiers(
    tilesets,
    [...REQUIRED_TILESETS.keys()],
    sourceLabel,
    "tileset definitions",
  );

  const layerById = indexUnique(layers, "identifier", sourceLabel, "layer definitions");
  indexUnique(layers, "uid", sourceLabel, "layer definitions");
  for (const [identifier, expectedType] of REQUIRED_LAYERS) {
    const layer = layerById.get(identifier);
    if (layer.type !== expectedType || layer.__type !== expectedType)
      fail(sourceLabel, `layer ${identifier}`, `must have type ${expectedType}`);
    if (layer.gridSize !== GRID_SIZE)
      fail(sourceLabel, `layer ${identifier}`, `gridSize must be ${GRID_SIZE}`);
  }
  const collisionValues = layerById
    .get("Collision_IntGrid")
    .intGridValues.map((entry) => `${entry.identifier}:${entry.value}`)
    .sort()
    .join(",");
  if (collisionValues !== "End_Wall_Blocker:3,Solid_Wall_Or_Trim:1")
    fail(
      sourceLabel,
      "Collision_IntGrid definition",
      `values drifted (observed ${collisionValues})`,
    );
  const laneValues = layerById
    .get("Lane_Guides")
    .intGridValues.map((entry) => `${entry.identifier}:${entry.value}`)
    .sort()
    .join(",");
  if (laneValues !== "Combat_Lane_Center:1,Lane_Boundary_Guide:2")
    fail(sourceLabel, "Lane_Guides definition", `values drifted (observed ${laneValues})`);

  const entityById = indexUnique(entities, "identifier", sourceLabel, "entity definitions");
  indexUnique(entities, "uid", sourceLabel, "entity definitions");
  for (const [identifier, entity] of entityById) {
    if ((entity.fieldDefs?.length ?? 0) !== 0)
      fail(sourceLabel, `entity ${identifier}`, "custom fields are unsupported");
  }

  const tilesetByUid = indexUnique(tilesets, "uid", sourceLabel, "tileset definitions");
  for (const [identifier, expectedPath] of REQUIRED_TILESETS) {
    const tileset = tilesets.find((entry) => entry.identifier === identifier);
    if (tileset.relPath !== expectedPath)
      fail(sourceLabel, `tileset ${identifier}`, `relPath must be ${JSON.stringify(expectedPath)}`);
    if (
      tileset.tileGridSize !== GRID_SIZE ||
      tileset.spacing !== 0 ||
      tileset.padding !== 0 ||
      !isSafeInt(tileset.pxWid) ||
      !isSafeInt(tileset.pxHei) ||
      tileset.pxWid % GRID_SIZE !== 0 ||
      tileset.pxHei % GRID_SIZE !== 0
    )
      fail(sourceLabel, `tileset ${identifier}`, "must be an unpadded 60px-aligned tileset");
  }
  if (
    layerById.get("Office_Material_Tiles").tilesetDefUid !==
      tilesets.find((entry) => entry.identifier === "V13_ImageGen_Office_Material_Variants_60")
        .uid ||
    layerById.get("Parallax_City_Backdrop").tilesetDefUid !==
      tilesets.find((entry) => entry.identifier === "V13_City_Parallax_Backdrop_60").uid
  )
    fail(sourceLabel, "tileset definitions", "tile-layer references drifted");

  return { layerById, entityById, tilesetByUid };
}

function validateLayerInstance(layer, definition, level, sourceLabel) {
  const subject = `level ${level.identifier} layer ${layer?.__identifier ?? "<missing>"}`;
  if (layer.__type !== definition.__type || layer.layerDefUid !== definition.uid)
    fail(sourceLabel, subject, "does not match its layer definition");
  if (
    layer.__gridSize !== GRID_SIZE ||
    layer.__cWid !== COLS ||
    layer.__cHei !== ROWS ||
    layer.__pxTotalOffsetX !== 0 ||
    layer.__pxTotalOffsetY !== 0 ||
    layer.pxOffsetX !== 0 ||
    layer.pxOffsetY !== 0
  )
    fail(sourceLabel, subject, `must be an unoffset ${COLS}x${ROWS} grid at ${GRID_SIZE}px`);
}

function compileGrid(layer, legalValues, level, sourceLabel) {
  const values = requireArray(
    layer.intGridCsv,
    sourceLabel,
    `level ${level.identifier} layer ${layer.__identifier}.intGridCsv`,
  );
  if (values.length !== COLS * ROWS)
    fail(
      sourceLabel,
      `level ${level.identifier} layer ${layer.__identifier}`,
      `must contain ${COLS * ROWS} cells (observed ${values.length})`,
    );
  for (let index = 0; index < values.length; index++) {
    const value = values[index];
    if (!isSafeInt(value) || !legalValues.has(value))
      fail(
        sourceLabel,
        `level ${level.identifier} layer ${layer.__identifier} cell (${index % COLS},${Math.floor(index / COLS)})`,
        `has illegal value ${String(value)}`,
      );
  }
  return [...values];
}

function compileTileLayer(layer, tileset, level, sourceLabel) {
  const subject = `level ${level.identifier} layer ${layer.__identifier}`;
  if (
    layer.__tilesetDefUid !== tileset.uid ||
    layer.__tilesetRelPath !== tileset.relPath ||
    layer.overrideTilesetUid != null ||
    (layer.autoLayerTiles?.length ?? 0) !== 0
  )
    fail(sourceLabel, subject, "tileset reference or tile mode drifted");
  const tileCount = (tileset.pxWid / GRID_SIZE) * (tileset.pxHei / GRID_SIZE);
  const indices = Array(COLS * ROWS).fill(-1);
  const flips = Array(COLS * ROWS).fill(0);
  for (const tile of requireArray(layer.gridTiles, sourceLabel, `${subject}.gridTiles`)) {
    if (
      !Array.isArray(tile.px) ||
      tile.px.length !== 2 ||
      !tile.px.every(isSafeInt) ||
      tile.px[0] % GRID_SIZE !== 0 ||
      tile.px[1] % GRID_SIZE !== 0
    )
      fail(sourceLabel, subject, "contains a tile with an invalid pixel position");
    const col = tile.px[0] / GRID_SIZE;
    const row = tile.px[1] / GRID_SIZE;
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS)
      fail(sourceLabel, subject, `contains an out-of-bounds tile at (${col},${row})`);
    if (!isSafeInt(tile.t) || tile.t < 0 || tile.t >= tileCount)
      fail(sourceLabel, subject, `contains illegal tile index ${String(tile.t)}`);
    if (!isSafeInt(tile.f) || tile.f < 0 || tile.f > 3)
      fail(sourceLabel, subject, `contains illegal flip flags ${String(tile.f)}`);
    if (tile.a !== 1) fail(sourceLabel, subject, "contains a non-opaque tile");
    const index = row * COLS + col;
    if (indices[index] !== -1) fail(sourceLabel, subject, `duplicates tile cell (${col},${row})`);
    indices[index] = tile.t;
    flips[index] = tile.f;
  }
  return {
    id:
      layer.__identifier === "Parallax_City_Backdrop"
        ? "parallax-city-backdrop"
        : "office-material-tiles",
    tilesetId: tileset.identifier,
    indices,
    flips,
  };
}

function compileEntity(entity, definition, level, sourceLabel) {
  const subject = `level ${level.identifier} entity ${entity?.__identifier ?? "<missing>"}`;
  if (
    entity.defUid !== definition.uid ||
    typeof entity.iid !== "string" ||
    entity.iid === "" ||
    !Array.isArray(entity.px) ||
    entity.px.length !== 2 ||
    !entity.px.every(isSafeInt) ||
    !Array.isArray(entity.__pivot) ||
    entity.__pivot.length !== 2 ||
    !entity.__pivot.every((value) => typeof value === "number" && Number.isFinite(value)) ||
    !isSafeInt(entity.width) ||
    !isSafeInt(entity.height) ||
    entity.width <= 0 ||
    entity.height <= 0 ||
    (entity.fieldInstances?.length ?? 0) !== 0
  )
    fail(sourceLabel, subject, "shape or definition reference drifted");
  const [x, y] = entity.px;
  const [pivotX, pivotY] = entity.__pivot;
  const minX = x - entity.width * pivotX;
  const minY = y - entity.height * pivotY;
  const maxX = minX + entity.width;
  const maxY = minY + entity.height;
  if (minX < 0 || minY < 0 || maxX > LEVEL_WIDTH || maxY > LEVEL_HEIGHT)
    fail(sourceLabel, subject, "extends outside the level bounds");
  return {
    type: entity.__identifier,
    iid: entity.iid,
    x,
    y,
    width: entity.width,
    height: entity.height,
    pivotX,
    pivotY,
    bounds: { minX, minY, maxX, maxY },
  };
}

function midpointAnchor(left, right, laneBounds, ordinal) {
  return {
    id: `synthetic-${String(ordinal + 1).padStart(2, "0")}`,
    x: Math.round((left + right) / 2 / GRID_SIZE) * GRID_SIZE,
    y: Math.round((laneBounds.minY + laneBounds.maxY) / 2 / GRID_SIZE) * GRID_SIZE,
    source: "synthetic",
  };
}

function endBlockerBounds(collisionGrid, level, sourceLabel) {
  const blockerColumns = new Set();
  for (let index = 0; index < collisionGrid.length; index++) {
    if (collisionGrid[index] === 3) blockerColumns.add(index % COLS);
  }
  const leftColumns = [...blockerColumns].filter((col) => col < COLS / 2);
  const rightColumns = [...blockerColumns].filter((col) => col >= COLS / 2);
  if (leftColumns.length === 0 || rightColumns.length === 0)
    fail(
      sourceLabel,
      `level ${level.identifier} Collision_IntGrid`,
      "value-3 end blockers must exist at both hall ends",
    );
  return {
    minX: (Math.max(...leftColumns) + 1) * GRID_SIZE,
    maxX: Math.min(...rightColumns) * GRID_SIZE,
  };
}

export function synthesizeEnemyAnchors(
  authored,
  playableBounds,
  laneBounds,
  target = SYNTHESIZED_ANCHOR_TARGET,
) {
  const anchors = authored
    .map((entry) => ({ id: entry.iid, x: entry.x, y: entry.y, source: "authored" }))
    .sort((a, b) => a.x - b.x || a.y - b.y || compareText(a.id, b.id));
  let syntheticOrdinal = 0;
  while (anchors.length < target) {
    const points = [playableBounds.minX, ...anchors.map((entry) => entry.x), playableBounds.maxX];
    let bestIndex = 0;
    let bestGap = -1;
    for (let index = 0; index < points.length - 1; index++) {
      const gap = points[index + 1] - points[index];
      if (gap > bestGap) {
        bestGap = gap;
        bestIndex = index;
      }
    }
    const anchor = midpointAnchor(
      points[bestIndex],
      points[bestIndex + 1],
      laneBounds,
      syntheticOrdinal++,
    );
    while (anchors.some((entry) => entry.x === anchor.x)) anchor.x += GRID_SIZE;
    anchors.push(anchor);
    anchors.sort((a, b) => a.x - b.x || a.y - b.y || compareText(a.id, b.id));
  }
  return anchors;
}

function compileLevel(level, definitions, sourceLabel, floorIndex) {
  const subject = `level ${level?.identifier ?? "<missing>"}`;
  if (
    typeof level.iid !== "string" ||
    level.iid === "" ||
    !isSafeInt(level.uid) ||
    level.pxWid !== LEVEL_WIDTH ||
    level.pxHei !== LEVEL_HEIGHT
  )
    fail(sourceLabel, subject, `must be ${LEVEL_WIDTH}x${LEVEL_HEIGHT}px with valid IDs`);
  const layers = requireArray(level.layerInstances, sourceLabel, `${subject}.layerInstances`);
  requireExactIdentifiers(
    layers,
    [...REQUIRED_LAYERS.keys()],
    sourceLabel,
    `${subject} layers`,
    "__identifier",
  );
  const layerById = new Map(layers.map((layer) => [layer.__identifier, layer]));
  indexUnique(layers, "iid", sourceLabel, `${subject} layers`);
  for (const [identifier, definition] of definitions.layerById)
    validateLayerInstance(layerById.get(identifier), definition, level, sourceLabel);

  const collisionGrid = compileGrid(
    layerById.get("Collision_IntGrid"),
    new Set([0, 1, 3]),
    level,
    sourceLabel,
  );
  const laneGrid = compileGrid(
    layerById.get("Lane_Guides"),
    new Set([0, 1, 2]),
    level,
    sourceLabel,
  );
  const gameplay = layerById.get("Gameplay_Markers");
  if (
    (gameplay.intGridCsv?.length ?? 0) !== 0 ||
    (gameplay.gridTiles?.length ?? 0) !== 0 ||
    (gameplay.autoLayerTiles?.length ?? 0) !== 0
  )
    fail(sourceLabel, `${subject} Gameplay_Markers`, "must contain entities only");
  const rawEntities = requireArray(
    gameplay.entityInstances,
    sourceLabel,
    `${subject} Gameplay_Markers.entityInstances`,
  );
  const counts = new Map();
  for (const entity of rawEntities)
    counts.set(entity?.__identifier, (counts.get(entity?.__identifier) ?? 0) + 1);
  for (const [identifier, expected] of ENTITY_COUNTS) {
    const observed = counts.get(identifier) ?? 0;
    if (observed !== expected)
      fail(
        sourceLabel,
        `${subject} Gameplay_Markers`,
        `requires ${expected} ${identifier} entities (observed ${observed})`,
      );
  }
  for (const identifier of counts.keys()) {
    if (!ENTITY_COUNTS.has(identifier))
      fail(sourceLabel, `${subject} Gameplay_Markers`, `contains unsupported ${identifier}`);
  }
  const entities = rawEntities
    .map((entity) =>
      compileEntity(entity, definitions.entityById.get(entity.__identifier), level, sourceLabel),
    )
    .sort(byPosition);
  const grouped = (type) => entities.filter((entity) => entity.type === type);
  const camera = grouped("CameraBounds")[0];
  const endWalls = grouped("EndWall");
  const combatLanes = grouped("CombatLane");
  const intGridEndBlockers = endBlockerBounds(collisionGrid, level, sourceLabel);
  const entityEndBlockers = {
    minX: Math.max(
      ...endWalls.map((entry) => entry.bounds.maxX).filter((x) => x <= LEVEL_WIDTH / 2),
    ),
    maxX: Math.min(
      ...endWalls.map((entry) => entry.bounds.minX).filter((x) => x >= LEVEL_WIDTH / 2),
    ),
  };
  if (
    intGridEndBlockers.minX !== entityEndBlockers.minX ||
    intGridEndBlockers.maxX !== entityEndBlockers.maxX
  )
    fail(
      sourceLabel,
      `${subject} end blockers`,
      `Collision_IntGrid value-3 bounds ${JSON.stringify(intGridEndBlockers)} must align with EndWall bounds ${JSON.stringify(entityEndBlockers)}`,
    );
  const playableBounds = {
    minX: Math.max(camera.bounds.minX, entityEndBlockers.minX, intGridEndBlockers.minX),
    maxX: Math.min(camera.bounds.maxX, entityEndBlockers.maxX, intGridEndBlockers.maxX),
  };
  const laneCenters = combatLanes.map((entry) => entry.y).sort((a, b) => a - b);
  for (const y of laneCenters) {
    const row = Math.floor(y / GRID_SIZE);
    if (laneGrid[row * COLS + Math.floor(COLS / 2)] !== 1)
      fail(sourceLabel, subject, `CombatLane y=${y} is not backed by a Lane_Guides value-1 row`);
  }
  const laneBounds = {
    minY: laneCenters[0],
    maxY: laneCenters[laneCenters.length - 1],
  };
  const authoredEnemySpawns = grouped("EnemySpawn");
  const waveAnchors = synthesizeEnemyAnchors(authoredEnemySpawns, playableBounds, laneBounds);
  const materialTileset = definitions.tilesetByUid.get(
    layerById.get("Office_Material_Tiles").__tilesetDefUid,
  );
  const backdropTileset = definitions.tilesetByUid.get(
    layerById.get("Parallax_City_Backdrop").__tilesetDefUid,
  );
  const renderLayers = [
    compileTileLayer(layerById.get("Parallax_City_Backdrop"), backdropTileset, level, sourceLabel),
    compileTileLayer(layerById.get("Office_Material_Tiles"), materialTileset, level, sourceLabel),
  ];
  return {
    id: FLOOR_IDS.get(level.identifier),
    sourceIdentifier: level.identifier,
    floorIndex,
    iid: level.iid,
    width: LEVEL_WIDTH,
    height: LEVEL_HEIGHT,
    gridSize: GRID_SIZE,
    cols: COLS,
    rows: ROWS,
    renderLayers,
    collisionGrid,
    laneGrid,
    laneBounds,
    playableBounds,
    cameraBounds: camera.bounds,
    playerSpawns: grouped("PlayerSpawn"),
    authoredEnemySpawns,
    waveAnchors,
    endWalls,
    elevatorMarkers: grouped("ElevatorMarker"),
    combatLanes,
  };
}

export function compileCorporateGridProject(project, { sourceLabel = "<memory>" } = {}) {
  requireObject(project, sourceLabel, "project");
  if (project.jsonVersion !== SUPPORTED_LDTK_JSON_VERSION)
    fail(
      sourceLabel,
      "project",
      `unsupported jsonVersion ${String(project.jsonVersion)}; supported=${SUPPORTED_LDTK_JSON_VERSION}`,
    );
  if (project.externalLevels !== false || project.simplifiedExport !== false)
    fail(sourceLabel, "project", "requires embedded levels and the full LDtk export");
  const definitions = validateDefinitions(project, sourceLabel);
  const levels = requireArray(project.levels, sourceLabel, "project.levels");
  requireExactIdentifiers(levels, REQUIRED_LEVELS, sourceLabel, "project levels");
  indexUnique(levels, "uid", sourceLabel, "project levels");
  indexUnique(levels, "iid", sourceLabel, "project levels");
  const levelById = new Map(levels.map((level) => [level.identifier, level]));
  const floors = REQUIRED_LEVELS.map((identifier, index) =>
    compileLevel(levelById.get(identifier), definitions, sourceLabel, index),
  );
  const tilesets = [...REQUIRED_TILESETS.entries()].map(([identifier, sourcePath]) => {
    const definition = project.defs.tilesets.find((entry) => entry.identifier === identifier);
    return {
      id: identifier,
      sourcePath,
      publicPath: `maps/corporate-grid/${sourcePath.split("/").at(-1)}`,
      width: definition.pxWid,
      height: definition.pxHei,
      gridSize: definition.tileGridSize,
      cols: definition.pxWid / definition.tileGridSize,
      rows: definition.pxHei / definition.tileGridSize,
    };
  });
  const content = { modelVersion: CORPORATE_GRID_MODEL_VERSION, tilesets, floors };
  return {
    ...content,
    revision: `sha256:${createHash("sha256").update(JSON.stringify(content)).digest("hex")}`,
  };
}

export function renderCorporateGridCatalog(catalog) {
  return [
    "// AUTO-GENERATED by tools/mapkit/gen-corporate-grid.mjs - DO NOT EDIT.",
    "// Canonical source: data/maps/corporate-grid/corporate_grid_v13_imagegen_material_variants.ldtk",
    "",
    'import type { CorporateGridMapCatalog } from "./corporate-grid-map.js";',
    "",
    `export const CORPORATE_GRID_MAP = ${JSON.stringify(catalog, null, 2)} as const satisfies CorporateGridMapCatalog;`,
    "",
  ].join("\n");
}
