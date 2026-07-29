import { createHash } from "node:crypto";

export const SUPPORTED_LDTK_JSON_VERSION = "1.5.3";

const TERRAIN_LAYER = "Terrain";
const ZONES_LAYER = "Zones";
const GAMEPLAY_LAYER = "Gameplay";
const PLAYER_SPAWN = "PlayerSpawn";
// The LDtk owner playground is an offline 4,800px authoring canvas, not a runtime arena-size source.
// Runtime arenas use the shared 38,400px constants; keeping this compact avoids a 480x480 JSON paint grid.
const AUTHORED_CANVAS_PX = 4_800;
const AUTHORED_TILE_PX = 80;
const LEVEL_FIELDS = new Map([
  ["DisplayName", "String"],
  ["InitialDimensionId", "String"],
]);

export class LdtkImportError extends Error {
  constructor(message) {
    super(message);
    this.name = "LdtkImportError";
  }
}

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const isSafeInt = (value) => Number.isSafeInteger(value);

function formatLocation(context) {
  const source = context.sourceLabel ?? "<memory>";
  const level = context.levelId ?? "<project>";
  const subject = context.subject ?? "project";
  const iid = context.iid ?? "<missing>";
  const col = context.col ?? 0;
  const row = context.row ?? 0;
  const worldX = context.worldX ?? 0;
  const worldY = context.worldY ?? 0;
  return (
    `source=${JSON.stringify(source)} level=${JSON.stringify(level)} ${subject}IID=${JSON.stringify(iid)} ` +
    `tile=(${col},${row}) world=(${worldX},${worldY})`
  );
}

function fail(context, message) {
  throw new LdtkImportError(`[LDtk import] ${formatLocation(context)}: ${message}`);
}

function projectContext(project, sourceLabel) {
  return { sourceLabel, subject: "project", iid: project?.iid };
}

function levelContext(_project, level, sourceLabel) {
  return {
    sourceLabel,
    levelId: normalizeArenaIdLoose(level?.identifier),
    subject: "level",
    iid: level?.iid,
    worldX: isSafeInt(level?.worldX) ? level.worldX : 0,
    worldY: isSafeInt(level?.worldY) ? level.worldY : 0,
  };
}

function layerContext(project, level, layer, sourceLabel, col = 0, row = 0) {
  return {
    ...levelContext(project, level, sourceLabel),
    subject: "layer",
    iid: layer?.iid,
    col,
    row,
    worldX: (isSafeInt(level?.worldX) ? level.worldX : 0) + col * 80 + 40,
    worldY: (isSafeInt(level?.worldY) ? level.worldY : 0) + row * 80 + 40,
  };
}

function entityContext(project, level, _layer, entity, sourceLabel) {
  const px = Array.isArray(entity?.px) ? entity.px : [0, 0];
  const x = isSafeInt(px[0]) ? px[0] : 0;
  const y = isSafeInt(px[1]) ? px[1] : 0;
  return {
    ...levelContext(project, level, sourceLabel),
    subject: "entity",
    iid: entity?.iid,
    col: Math.floor(x / 80),
    row: Math.floor(y / 80),
    worldX: (isSafeInt(level?.worldX) ? level.worldX : 0) + x,
    worldY: (isSafeInt(level?.worldY) ? level.worldY : 0) + y,
  };
}

function normalizeArenaIdLoose(value) {
  return typeof value === "string"
    ? value
        .trim()
        .toLowerCase()
        .replace(/[_\s]+/g, "-")
    : "<invalid>";
}

export function normalizeArenaId(value, context = {}) {
  if (typeof value !== "string" || value.trim() === "")
    fail(context, "level identifier is missing");
  const normalized = normalizeArenaIdLoose(value);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized))
    fail(
      context,
      `level identifier ${JSON.stringify(value)} does not normalize to a lowercase kebab-case arena ID`,
    );
  return normalized;
}

export function parseLdtkJson(text, sourceLabel = "<memory>") {
  try {
    return JSON.parse(text);
  } catch (error) {
    fail(
      { sourceLabel, subject: "project", iid: "<unparsed>" },
      `invalid JSON (${error instanceof Error ? error.message : String(error)})`,
    );
  }
}

function requireObject(value, context, label) {
  if (!isObject(value)) fail(context, `${label} must be an object`);
  return value;
}

function requireArray(value, context, label) {
  if (!Array.isArray(value)) fail(context, `${label} must be an array`);
  return value;
}

function requireExactIdentifiers(items, expected, context, label) {
  const counts = new Map();
  for (const item of items) {
    const identifier = item?.identifier;
    if (typeof identifier !== "string")
      fail(context, `${label} contains an item without an identifier`);
    counts.set(identifier, (counts.get(identifier) ?? 0) + 1);
  }
  for (const identifier of expected) {
    const count = counts.get(identifier) ?? 0;
    if (count !== 1)
      fail(context, `${label} must define ${identifier} exactly once (observed ${count})`);
  }
  for (const [identifier] of counts)
    if (!expected.includes(identifier))
      fail(context, `${label} contains unsupported ${identifier}`);
}

function indexUnique(items, key, context, label) {
  const out = new Map();
  for (const item of items) {
    const value = item?.[key];
    if ((typeof value !== "string" && !isSafeInt(value)) || value === "")
      fail(context, `${label} has an invalid ${key}`);
    if (out.has(value)) fail(context, `${label} duplicates ${key} ${JSON.stringify(value)}`);
    out.set(value, item);
  }
  return out;
}

function validateProjectDefinitions(project, sourceLabel, gridSize) {
  const context = projectContext(project, sourceLabel);
  const defs = requireObject(project.defs, context, "defs");
  const layers = requireArray(defs.layers, context, "defs.layers");
  const entities = requireArray(defs.entities, context, "defs.entities");
  const enums = requireArray(defs.enums, context, "defs.enums");
  const levelFields = requireArray(defs.levelFields, context, "defs.levelFields");
  const tilesets = requireArray(defs.tilesets, context, "defs.tilesets");
  const externalEnums = requireArray(defs.externalEnums, context, "defs.externalEnums");

  if (tilesets.length !== 0)
    fail(context, "tilesets are unsupported; authored arenas use logical IntGrids only");
  if (externalEnums.length !== 0)
    fail(context, "external enums are unsupported; keep definitions embedded");

  requireExactIdentifiers(
    layers,
    [TERRAIN_LAYER, ZONES_LAYER, GAMEPLAY_LAYER],
    context,
    "layer definitions",
  );
  const layerById = indexUnique(layers, "identifier", context, "layer definitions");
  indexUnique(layers, "uid", context, "layer definitions");
  const expectedLayerTypes = new Map([
    [TERRAIN_LAYER, "IntGrid"],
    [ZONES_LAYER, "IntGrid"],
    [GAMEPLAY_LAYER, "Entities"],
  ]);
  for (const [identifier, type] of expectedLayerTypes) {
    const definition = layerById.get(identifier);
    if (definition.__type !== type || definition.type !== type)
      fail(context, `${identifier} must be a ${type} layer definition`);
    if (definition.gridSize !== gridSize)
      fail(
        context,
        `${identifier} gridSize must be ${gridSize}, observed ${String(definition.gridSize)}`,
      );
    if (definition.pxOffsetX !== 0 || definition.pxOffsetY !== 0)
      fail(context, `${identifier} layer definition offsets must both be zero`);
    if ((definition.autoRuleGroups?.length ?? 0) !== 0 || definition.tilesetDefUid != null)
      fail(context, `${identifier} may not use AutoLayers or a tileset`);
  }

  const terrainValues = requireArray(
    layerById.get(TERRAIN_LAYER).intGridValues,
    context,
    "Terrain values",
  );
  const zoneValues = requireArray(
    layerById.get(ZONES_LAYER).intGridValues,
    context,
    "Zones values",
  );
  const valuePairs = (values) =>
    values
      .map((entry) => `${entry?.identifier}:${String(entry?.value)}`)
      .sort()
      .join(",");
  if (valuePairs(terrainValues) !== "")
    fail(
      context,
      `Terrain IntGrid values must be empty for continuous ground, observed ${valuePairs(terrainValues)}`,
    );
  if (valuePairs(zoneValues) !== "Cover:1,Scar:2")
    fail(
      context,
      `Zones IntGrid values must be exactly Cover:1 and Scar:2, observed ${valuePairs(zoneValues)}`,
    );
  if ((layerById.get(GAMEPLAY_LAYER).intGridValues?.length ?? 0) !== 0)
    fail(context, "Gameplay entity layer may not define IntGrid values");

  requireExactIdentifiers(entities, [PLAYER_SPAWN], context, "entity definitions");
  const entityById = indexUnique(entities, "identifier", context, "entity definitions");
  indexUnique(entities, "uid", context, "entity definitions");
  if ((entityById.get(PLAYER_SPAWN).fieldDefs?.length ?? 0) !== 0)
    fail(context, `${PLAYER_SPAWN} must not define custom fields`);
  requireExactIdentifiers(enums, [], context, "enum definitions");

  requireExactIdentifiers(
    levelFields,
    [...LEVEL_FIELDS.keys()],
    context,
    "level field definitions",
  );
  for (const field of levelFields) {
    const expectedType = LEVEL_FIELDS.get(field.identifier);
    if (field.__type !== expectedType)
      fail(context, `level field ${field.identifier} must have type ${expectedType}`);
  }

  return {
    layerById,
    entityById,
    levelFieldById: indexUnique(levelFields, "identifier", context, "level fields"),
  };
}

function validateSharedContract(shared, project, sourceLabel) {
  const context = projectContext(project, sourceLabel);
  const requiredFunctions = ["validateArena", "auditArenaNavigation"];
  for (const name of requiredFunctions)
    if (typeof shared?.[name] !== "function")
      fail(context, `shared map contract does not export ${name}`);
  const requiredIntegers = [
    "MAP_TILE",
    "MAP_BORDER_TILES",
    "MAP_SPAWN_CLEAR_TILES",
  ];
  for (const name of requiredIntegers)
    if (!isSafeInt(shared?.[name]))
      fail(context, `shared map contract does not export integer ${name}`);
  if (shared.MAP_TILE !== AUTHORED_TILE_PX)
    fail(
      context,
      `shared tile contract changed (expected ${AUTHORED_TILE_PX}px, observed ${shared.MAP_TILE}px); update the LDtk compiler deliberately`,
    );
}

function validateLayerInstance(
  project,
  level,
  layer,
  definition,
  sourceLabel,
  cols,
  rows,
  gridSize,
) {
  const context = layerContext(project, level, layer, sourceLabel);
  if (layer.__type !== definition.__type)
    fail(
      context,
      `${layer.__identifier} must have type ${definition.__type}, observed ${String(layer.__type)}`,
    );
  if (layer.layerDefUid !== definition.uid)
    fail(context, `${layer.__identifier} layerDefUid does not reference its definition`);
  if (layer.levelId !== level.uid)
    fail(context, `${layer.__identifier} levelId does not reference this level`);
  if (layer.__gridSize !== gridSize || layer.__cWid !== cols || layer.__cHei !== rows)
    fail(
      context,
      `${layer.__identifier} grid must be ${cols}x${rows} at ${gridSize}px, observed ${String(layer.__cWid)}x${String(layer.__cHei)} at ${String(layer.__gridSize)}px`,
    );
  if (
    layer.__pxTotalOffsetX !== 0 ||
    layer.__pxTotalOffsetY !== 0 ||
    layer.pxOffsetX !== 0 ||
    layer.pxOffsetY !== 0
  )
    fail(context, `${layer.__identifier} instance offsets must all be zero`);
  if (
    layer.__tilesetDefUid != null ||
    layer.__tilesetRelPath != null ||
    layer.overrideTilesetUid != null
  )
    fail(context, `${layer.__identifier} may not reference a tileset`);
  if ((layer.autoLayerTiles?.length ?? 0) !== 0 || (layer.gridTiles?.length ?? 0) !== 0)
    fail(context, `${layer.__identifier} may not contain AutoLayer or Tile layer output`);
}

function validateIntGrid(project, level, layer, sourceLabel, cols, rows, legalValues) {
  const context = layerContext(project, level, layer, sourceLabel);
  const csv = requireArray(layer.intGridCsv, context, `${layer.__identifier}.intGridCsv`);
  if (csv.length !== cols * rows)
    fail(
      context,
      `${layer.__identifier}.intGridCsv must contain ${cols * rows} cells, observed ${csv.length}`,
    );
  for (let index = 0; index < csv.length; index++) {
    const value = csv[index];
    if (!isSafeInt(value) || !legalValues.has(value)) {
      const col = index % cols;
      const row = Math.floor(index / cols);
      fail(
        layerContext(project, level, layer, sourceLabel, col, row),
        `${layer.__identifier} has illegal IntGrid value ${String(value)}; allowed values are ${[...legalValues].join(", ")}`,
      );
    }
  }
  if ((layer.entityInstances?.length ?? 0) !== 0)
    fail(context, `${layer.__identifier} IntGrid layer may not contain entities`);
  return csv;
}

function validateFieldInstances(project, level, layer, entity, sourceLabel, expected, fieldDefs) {
  const context = entityContext(project, level, layer, entity, sourceLabel);
  const fields = requireArray(
    entity.fieldInstances,
    context,
    `${entity.__identifier}.fieldInstances`,
  );
  const counts = new Map();
  for (const field of fields) {
    const identifier = field?.__identifier;
    counts.set(identifier, (counts.get(identifier) ?? 0) + 1);
    if (!expected.has(identifier))
      fail(context, `${entity.__identifier} has unsupported field ${String(identifier)}`);
    const expectedType = expected.get(identifier);
    if (field.__type !== expectedType)
      fail(context, `${entity.__identifier}.${identifier} must have type ${expectedType}`);
    const definition = fieldDefs.find((entry) => entry.identifier === identifier);
    if (!definition || field.defUid !== definition.uid)
      fail(context, `${entity.__identifier}.${identifier} does not reference its field definition`);
  }
  for (const identifier of expected.keys()) {
    const count = counts.get(identifier) ?? 0;
    if (count !== 1)
      fail(
        context,
        `${entity.__identifier} must have field ${identifier} exactly once (observed ${count})`,
      );
  }
  return new Map(fields.map((field) => [field.__identifier, field]));
}

function validateEntityPosition(
  project,
  level,
  layer,
  entity,
  definition,
  sourceLabel,
  cols,
  rows,
  gridSize,
) {
  const context = entityContext(project, level, layer, entity, sourceLabel);
  if (!Array.isArray(entity.px) || entity.px.length !== 2 || !entity.px.every(isSafeInt))
    fail(context, `${entity.__identifier}.px must contain two finite safe integers`);
  const [x, y] = entity.px;
  if (x < 0 || y < 0 || x >= cols * gridSize || y >= rows * gridSize)
    fail(context, `${entity.__identifier} is outside the fixed arena bounds`);
  if (x % gridSize !== gridSize / 2 || y % gridSize !== gridSize / 2)
    fail(context, `${entity.__identifier} must be centered in an ${gridSize}px grid cell`);
  const col = Math.floor(x / gridSize);
  const row = Math.floor(y / gridSize);
  if (
    !Array.isArray(entity.__grid) ||
    entity.__grid.length !== 2 ||
    entity.__grid[0] !== col ||
    entity.__grid[1] !== row
  )
    fail(context, `${entity.__identifier}.__grid does not match its pixel position`);
  if (entity.width !== definition.width || entity.height !== definition.height)
    fail(context, `${entity.__identifier} instance size does not match its definition`);
  if (!Array.isArray(entity.__pivot) || entity.__pivot[0] !== 0.5 || entity.__pivot[1] !== 0.5)
    fail(context, `${entity.__identifier} must use the centered [0.5,0.5] pivot`);
  if (entity.__worldX != null && entity.__worldX !== level.worldX + x)
    fail(context, `${entity.__identifier}.__worldX is stale`);
  if (entity.__worldY != null && entity.__worldY !== level.worldY + y)
    fail(context, `${entity.__identifier}.__worldY is stale`);
  return { x, y, col, row };
}

const compareText = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
function deriveZoneSeeds(project, level, zonesLayer, zoneIds, sourceLabel, cols) {
  const kinds = ["commons", "cover", "scar"];
  return kinds.map((kind, id) => {
    const index = zoneIds.indexOf(id);
    if (index < 0)
      fail(
        layerContext(project, level, zonesLayer, sourceLabel),
        `Zones contains no ${kind} cell (zone ${id})`,
      );
    return { id, kind, col: index % cols, row: Math.floor(index / cols) };
  });
}

function geometryFailureContext(
  project,
  level,
  layers,
  entities,
  sourceLabel,
  reason,
  cols,
  shared,
) {
  const terrain = layers.get(TERRAIN_LAYER);
  const zones = layers.get(ZONES_LAYER);
  const gameplay = layers.get(GAMEPLAY_LAYER);
  const spawn = entities.spawn;
  const stranded = /ground tile (\d+) stranded/.exec(reason);
  if (stranded) {
    const index = Number(stranded[1]);
    return layerContext(
      project,
      level,
      terrain,
      sourceLabel,
      index % cols,
      Math.floor(index / cols),
    );
  }
  if (reason.includes("border ring")) {
    for (let row = 0; row < level.pxHei / shared.MAP_TILE; row++)
      for (let col = 0; col < cols; col++) {
        const border =
          col < shared.MAP_BORDER_TILES ||
          row < shared.MAP_BORDER_TILES ||
          col >= cols - shared.MAP_BORDER_TILES ||
          row >= level.pxHei / shared.MAP_TILE - shared.MAP_BORDER_TILES;
        if (border && terrain.intGridCsv[row * cols + col] !== 0)
          return layerContext(project, level, terrain, sourceLabel, col, row);
      }
  }
  if (reason.includes("spawn")) return entityContext(project, level, gameplay, spawn, sourceLabel);
  if (reason.includes("zone") || reason.includes("Commons"))
    return layerContext(project, level, zones, sourceLabel);
  return layerContext(project, level, gameplay, sourceLabel);
}

function revisionFor(record) {
  return `sha256:${createHash("sha256").update(JSON.stringify(record)).digest("hex")}`;
}

function compileLevel(project, level, definitions, shared, sourceLabel) {
  const levelCtx = levelContext(project, level, sourceLabel);
  const id = normalizeArenaId(level.identifier, levelCtx);
  const gridSize = AUTHORED_TILE_PX;
  const cols = AUTHORED_CANVAS_PX / gridSize;
  const rows = AUTHORED_CANVAS_PX / gridSize;
  if (
    !isSafeInt(level.pxWid) ||
    !isSafeInt(level.pxHei) ||
    level.pxWid !== AUTHORED_CANVAS_PX ||
    level.pxHei !== AUTHORED_CANVAS_PX
  )
    fail(
      levelCtx,
      `level dimensions must be ${AUTHORED_CANVAS_PX}x${AUTHORED_CANVAS_PX}px, observed ${String(level.pxWid)}x${String(level.pxHei)}px`,
    );
  if (!isSafeInt(level.uid) || !isSafeInt(level.worldX) || !isSafeInt(level.worldY))
    fail(levelCtx, "level uid/world coordinates must be finite safe integers");

  const layerInstances = requireArray(level.layerInstances, levelCtx, "level.layerInstances");
  const layerCounts = new Map();
  for (const layer of layerInstances)
    layerCounts.set(layer?.__identifier, (layerCounts.get(layer?.__identifier) ?? 0) + 1);
  for (const identifier of [TERRAIN_LAYER, ZONES_LAYER, GAMEPLAY_LAYER]) {
    const count = layerCounts.get(identifier) ?? 0;
    if (count !== 1)
      fail(levelCtx, `level must contain ${identifier} exactly once (observed ${count})`);
  }
  for (const [identifier] of layerCounts)
    if (![TERRAIN_LAYER, ZONES_LAYER, GAMEPLAY_LAYER].includes(identifier))
      fail(levelCtx, `level contains unsupported layer ${String(identifier)}`);
  const layers = new Map(layerInstances.map((layer) => [layer.__identifier, layer]));
  indexUnique(layerInstances, "iid", levelCtx, "layer instances");
  for (const [identifier, layer] of layers)
    validateLayerInstance(
      project,
      level,
      layer,
      definitions.layerById.get(identifier),
      sourceLabel,
      cols,
      rows,
      gridSize,
    );

  const terrainCsv = validateIntGrid(
    project,
    level,
    layers.get(TERRAIN_LAYER),
    sourceLabel,
    cols,
    rows,
    new Set([0]),
  );
  const zonesCsv = validateIntGrid(
    project,
    level,
    layers.get(ZONES_LAYER),
    sourceLabel,
    cols,
    rows,
    new Set([0, 1, 2]),
  );

  const gameplay = layers.get(GAMEPLAY_LAYER);
  if ((gameplay.intGridCsv?.length ?? 0) !== 0)
    fail(
      layerContext(project, level, gameplay, sourceLabel),
      "Gameplay entity layer may not contain IntGrid data",
    );
  const entityInstances = requireArray(
    gameplay.entityInstances,
    layerContext(project, level, gameplay, sourceLabel),
    "Gameplay.entityInstances",
  );
  indexUnique(
    entityInstances,
    "iid",
    layerContext(project, level, gameplay, sourceLabel),
    "Gameplay entities",
  );
  const positioned = [];
  for (const entity of entityInstances) {
    const context = entityContext(project, level, gameplay, entity, sourceLabel);
    const definition = definitions.entityById.get(entity.__identifier);
    if (!definition) fail(context, `unsupported gameplay entity ${String(entity.__identifier)}`);
    if (entity.defUid !== definition.uid)
      fail(context, `${entity.__identifier}.defUid does not reference its entity definition`);
    const position = validateEntityPosition(
      project,
      level,
      gameplay,
      entity,
      definition,
      sourceLabel,
      cols,
      rows,
      gridSize,
    );
    positioned.push({ entity, definition, ...position });
  }

  const spawns = positioned.filter((entry) => entry.entity.__identifier === PLAYER_SPAWN);
  if (spawns.length !== 1)
    fail(
      layerContext(project, level, gameplay, sourceLabel),
      `level must contain exactly one ${PLAYER_SPAWN} (observed ${spawns.length})`,
    );
  for (const spawn of spawns)
    validateFieldInstances(
      project,
      level,
      gameplay,
      spawn.entity,
      sourceLabel,
      new Map(),
      spawn.definition.fieldDefs,
    );

  const tiles = Uint8Array.from(terrainCsv);
  const zoneIds = Uint8Array.from(zonesCsv);
  const zoneSeeds = deriveZoneSeeds(
    project,
    level,
    layers.get(ZONES_LAYER),
    zoneIds,
    sourceLabel,
    cols,
  );
  const levelFields = requireArray(level.fieldInstances, levelCtx, "level.fieldInstances");
  const levelFieldCounts = new Map();
  for (const field of levelFields) {
    const identifier = field?.__identifier;
    levelFieldCounts.set(identifier, (levelFieldCounts.get(identifier) ?? 0) + 1);
    const expectedType = LEVEL_FIELDS.get(identifier);
    if (!expectedType) fail(levelCtx, `unsupported level field ${String(identifier)}`);
    if (field.__type !== expectedType)
      fail(levelCtx, `${identifier} must have type ${expectedType}`);
    const definition = definitions.levelFieldById.get(identifier);
    if (!definition || field.defUid !== definition.uid)
      fail(levelCtx, `${identifier} does not reference its level field definition`);
  }
  for (const [identifier, count] of levelFieldCounts)
    if (count !== 1) fail(levelCtx, `level field ${identifier} is duplicated`);
  const fieldValue = (identifier) =>
    levelFields.find((field) => field.__identifier === identifier)?.__value;
  const displayNameValue = fieldValue("DisplayName");
  const initialDimensionValue = fieldValue("InitialDimensionId");
  if (
    displayNameValue != null &&
    (typeof displayNameValue !== "string" || displayNameValue.trim() === "")
  )
    fail(levelCtx, "DisplayName must be a non-empty string when set");
  if (
    initialDimensionValue != null &&
    (typeof initialDimensionValue !== "string" ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(initialDimensionValue))
  )
    fail(levelCtx, "InitialDimensionId must be a lowercase kebab-case ID when set");

  const spawn = spawns[0];
  const map = {
    cols,
    rows,
    tileSize: gridSize,
    tiles,
    zoneIds,
    zoneSeeds,
    spawnX: spawn.x,
    spawnY: spawn.y,
    seeds: { seedTerrain: 0, seedHazard: 0, seedTheme: 0, seedDecor: 0 },
  };
  const entityMetadata = { spawn: spawn.entity };
  let arenaValidation;
  try {
    arenaValidation = shared.validateArena(map);
  } catch (error) {
    fail(
      layerContext(project, level, gameplay, sourceLabel),
      `shared validateArena threw: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (!arenaValidation.ok)
    fail(
      geometryFailureContext(
        project,
        level,
        layers,
        entityMetadata,
        sourceLabel,
        arenaValidation.reason,
        cols,
        shared,
      ),
      `shared validateArena rejected authored geometry: ${arenaValidation.reason} (spawn clear radius ${shared.MAP_SPAWN_CLEAR_TILES} tiles)`,
    );
  const navigation = shared.auditArenaNavigation(map);
  if (!navigation.ok)
    fail(
      geometryFailureContext(
        project,
        level,
        layers,
        entityMetadata,
        sourceLabel,
        navigation.reason,
        cols,
        shared,
      ),
      `shared auditArenaNavigation rejected authored geometry: ${navigation.reason}`,
    );

  const record = {
    id,
    displayName: displayNameValue?.trim() || id,
    initialDimensionId: initialDimensionValue ?? null,
    cols,
    rows,
    tileSize: gridSize,
    tiles: [...tiles],
    zoneIds: [...zoneIds],
    zoneSeeds,
    spawnX: spawn.x,
    spawnY: spawn.y,
  };
  return { ...record, revision: revisionFor(record) };
}

export function compileLdtkProject(project, { shared, sourceLabel = "<memory>" } = {}) {
  const projectCtx = projectContext(project, sourceLabel);
  requireObject(project, projectCtx, "LDtk project");
  const observedVersion = project.jsonVersion;
  if (observedVersion !== SUPPORTED_LDTK_JSON_VERSION)
    fail(
      projectCtx,
      `unsupported LDtk jsonVersion; supported=${SUPPORTED_LDTK_JSON_VERSION}, observed=${String(observedVersion)}. Upgrade the importer deliberately before saving with a newer LDtk version`,
    );
  validateSharedContract(shared, project, sourceLabel);
  if (project.externalLevels !== false)
    fail(projectCtx, "externalLevels must be false; external .ldtkl files are unsupported");
  if ((project.worlds?.length ?? 0) !== 0 || project.flags?.includes("MultiWorlds"))
    fail(projectCtx, "multi-world LDtk projects are unsupported");
  if (project.simplifiedExport !== false)
    fail(
      projectCtx,
      "simplifiedExport must be false so the pinned layer/entity contract is present",
    );
  if (typeof project.iid !== "string" || project.iid === "")
    fail(projectCtx, "project IID is missing");
  if (typeof project.dummyWorldIid !== "string" || project.dummyWorldIid === "")
    fail(projectCtx, "dummy world IID is missing");

  const definitions = validateProjectDefinitions(project, sourceLabel, shared.MAP_TILE);
  const levels = requireArray(project.levels, projectCtx, "levels");
  if (levels.length === 0) fail(projectCtx, "project must contain at least one embedded level");
  const normalizedLevels = new Map();
  const globalIids = new Map();
  for (const level of levels) {
    const context = levelContext(project, level, sourceLabel);
    const id = normalizeArenaId(level?.identifier, context);
    if (normalizedLevels.has(id))
      fail(
        context,
        `duplicate normalized arena ID ${JSON.stringify(id)} (first level IID ${JSON.stringify(normalizedLevels.get(id)?.iid)})`,
      );
    normalizedLevels.set(id, level);
    const registerIid = (iid, iidContext, label) => {
      if (typeof iid !== "string" || iid === "") return;
      if (globalIids.has(iid))
        fail(
          iidContext,
          `${label} IID duplicates ${JSON.stringify(iid)} already used by ${globalIids.get(iid)}`,
        );
      globalIids.set(iid, label);
    };
    registerIid(level?.iid, context, `level ${id}`);
    if (!Array.isArray(level?.layerInstances)) continue;
    for (const layer of level.layerInstances) {
      const layerCtx = layerContext(project, level, layer, sourceLabel);
      registerIid(layer?.iid, layerCtx, `layer ${String(layer?.__identifier)}`);
      if (!Array.isArray(layer?.entityInstances)) continue;
      for (const entity of layer.entityInstances)
        registerIid(
          entity?.iid,
          entityContext(project, level, layer, entity, sourceLabel),
          `entity ${String(entity?.__identifier)}`,
        );
    }
  }
  const compiled = levels.map((level) =>
    compileLevel(project, level, definitions, shared, sourceLabel),
  );
  compiled.sort((a, b) => compareText(a.id, b.id));
  return compiled;
}

function renderGrid(values, cols, indent) {
  const pad = " ".repeat(indent);
  const rows = [];
  for (let index = 0; index < values.length; index += cols)
    rows.push(`${pad}${values.slice(index, index + cols).join(", ")}`);
  return `[\n${rows.join(",\n")}\n${" ".repeat(Math.max(0, indent - 2))}]`;
}

function renderSmall(value, indent) {
  const pad = " ".repeat(indent);
  return JSON.stringify(value, null, 2).replace(/\n/g, `\n${pad}`);
}

export function renderGeneratedCatalog(records) {
  const lines = [
    "// AUTO-GENERATED by tools/levels/gen-authored-arenas.mjs — DO NOT EDIT.",
    "// Canonical source: data/arenas/dimension-drifters.ldtk",
    "// Re-run the standalone generator after saving the LDtk project.",
    "",
    "export type AuthoredArenaCatalogEntry = Readonly<{",
    "  id: string;",
    "  revision: string;",
    "  displayName: string;",
    "  initialDimensionId: string | null;",
    "  cols: number;",
    "  rows: number;",
    "  tileSize: number;",
    "  tiles: readonly number[];",
    "  zoneIds: readonly number[];",
    "  zoneSeeds: readonly Readonly<{ id: number; kind: string; col: number; row: number }>[];",
    "  spawnX: number;",
    "  spawnY: number;",
    "}>;",
    "",
    "export const AUTHORED_ARENAS = {",
  ];
  for (const record of [...records].sort((a, b) => compareText(a.id, b.id))) {
    lines.push(`  ${JSON.stringify(record.id)}: {`);
    for (const key of [
      "id",
      "revision",
      "displayName",
      "initialDimensionId",
      "cols",
      "rows",
      "tileSize",
    ])
      lines.push(`    ${key}: ${JSON.stringify(record[key])},`);
    lines.push(`    tiles: ${renderGrid(record.tiles, record.cols, 6)},`);
    lines.push(`    zoneIds: ${renderGrid(record.zoneIds, record.cols, 6)},`);
    lines.push(`    zoneSeeds: ${renderSmall(record.zoneSeeds, 4)},`);
    lines.push(`    spawnX: ${record.spawnX},`);
    lines.push(`    spawnY: ${record.spawnY},`);
    lines.push("  },");
  }
  lines.push(
    "} as const satisfies Readonly<Record<string, AuthoredArenaCatalogEntry>>;",
    "",
    "export type AuthoredArenaId = keyof typeof AUTHORED_ARENAS;",
    "",
  );
  return lines.join("\n");
}
