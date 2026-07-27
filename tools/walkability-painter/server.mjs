#!/usr/bin/env node
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname } from "node:path";
import {
  COLLISION_COORDINATE_SPACE,
  COLLISION_DATA_PATH,
  COLLISION_FORMAT_VERSION,
  readCollisionFile,
  readPrefabCollision,
  writePrefabCollision,
} from "./collision-store.mjs";
import { deriveAlphaSeed, loadPrefabCatalog } from "./prefab-catalog.mjs";

const PORT = Number(process.env.WALKABILITY_PAINTER_API_PORT) || 5051;
const HOST = process.env.HOST;
const MIME = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

function json(response, value, status = 200) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(value));
}

function body(request) {
  return new Promise((resolveBody, rejectBody) => {
    let value = "";
    request.on("data", (chunk) => {
      value += chunk;
      if (value.length > 2_000_000) rejectBody(new Error("Request body is too large."));
    });
    request.on("end", () => {
      try {
        resolveBody(JSON.parse(value || "{}"));
      } catch {
        rejectBody(new Error("Request body must be valid JSON."));
      }
    });
    request.on("error", rejectBody);
  });
}

async function prefabById(id) {
  return (await loadPrefabCatalog()).find((candidate) => candidate.id === id);
}

function serveArt(response, prefab) {
  if (!existsSync(prefab.path) || statSync(prefab.path).isDirectory()) {
    return json(response, { error: "Prefab art is unavailable." }, 404);
  }
  response.writeHead(200, {
    "Content-Type": MIME[extname(prefab.path).toLowerCase()] ?? "application/octet-stream",
    "Cache-Control": "no-store",
  });
  createReadStream(prefab.path).pipe(response);
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://127.0.0.1:${PORT}`);
  const path = url.pathname;
  try {
    if (path === "/api/walkability-painter/catalog" && request.method === "GET") {
      const prefabs = await loadPrefabCatalog({ refresh: url.searchParams.has("refresh") });
      const saved = readCollisionFile().polygonsByPrefab;
      return json(response, {
        version: COLLISION_FORMAT_VERSION,
        coordinateSpace: COLLISION_COORDINATE_SPACE,
        dataFile: "data/prefab-walkability.json",
        prefabs: prefabs.map(({ path: _path, repoOwned: _repoOwned, ...prefab }) => ({
          ...prefab,
          authored: Object.hasOwn(saved, prefab.id),
          polygonCount: saved[prefab.id]?.length ?? 0,
          artUrl: `/api/walkability-painter/art/${encodeURIComponent(prefab.id)}`,
        })),
      });
    }

    const prefabPrefix = "/api/walkability-painter/prefab/";
    if (path.startsWith(prefabPrefix) && request.method === "GET") {
      const id = decodeURIComponent(path.slice(prefabPrefix.length));
      const prefab = await prefabById(id);
      if (!prefab) return json(response, { error: "Unknown prefab id." }, 404);
      const saved = readPrefabCollision(id);
      const polygons = saved ?? (await deriveAlphaSeed(prefab));
      return json(response, {
        id,
        width: prefab.width,
        height: prefab.height,
        source: prefab.source,
        artUrl: `/api/walkability-painter/art/${encodeURIComponent(id)}`,
        authored: saved !== undefined,
        origin: saved === undefined ? "alpha-seed" : "saved",
        polygons,
      });
    }

    const seedPrefix = "/api/walkability-painter/seed/";
    if (path.startsWith(seedPrefix) && request.method === "GET") {
      const id = decodeURIComponent(path.slice(seedPrefix.length));
      const prefab = await prefabById(id);
      if (!prefab) return json(response, { error: "Unknown prefab id." }, 404);
      return json(response, {
        id,
        width: prefab.width,
        height: prefab.height,
        origin: "alpha-seed",
        polygons: await deriveAlphaSeed(prefab),
      });
    }

    const artPrefix = "/api/walkability-painter/art/";
    if (path.startsWith(artPrefix) && request.method === "GET") {
      const id = decodeURIComponent(path.slice(artPrefix.length));
      const prefab = await prefabById(id);
      if (!prefab) return json(response, { error: "Unknown prefab id." }, 404);
      return serveArt(response, prefab);
    }

    if (path === "/api/walkability-painter/save" && request.method === "POST") {
      const payload = await body(request);
      const prefab = await prefabById(payload.id);
      if (!prefab) return json(response, { error: "Unknown prefab id." }, 404);
      const polygons = writePrefabCollision(
        prefab.id,
        payload.polygons,
        { width: prefab.width, height: prefab.height },
        COLLISION_DATA_PATH,
      );
      return json(response, {
        ok: true,
        id: prefab.id,
        polygons,
        polygonCount: polygons.length,
        dataFile: "data/prefab-walkability.json",
        savedAt: new Date().toISOString(),
      });
    }

    return json(response, { error: "Not found." }, 404);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return json(
      response,
      { error: message },
      /must|required|outside|usable/.test(message) ? 422 : 500,
    );
  }
});

server.listen(PORT, HOST, () => {
  console.log(
    `walkability painter API -> http://${HOST ?? "127.0.0.1"}:${PORT} (data: ${COLLISION_DATA_PATH})`,
  );
});
