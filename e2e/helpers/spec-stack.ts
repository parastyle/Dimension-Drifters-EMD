import { createRequire } from "node:module";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { DEFAULT_PORT } from "@dd/shared";
import { createGameServer } from "../../packages/server/dist/index.js";
import type { StackStart } from "./real-stack.js";

/**
 * The feature-spec twin of `startRealStack` (deliberately NOT a modification of it — the smoke keeps
 * its untouched stack). Identical production Colyseus + source-serving Vite, with two Vite settings
 * that only matter for LONG, interaction-heavy specs:
 *
 *  - `server.hmr: false` — Vite's dev websocket can drop under headless CPU spikes; its client then
 *    polls and full-RELOADS the page, wiping a spec's page-side probes mid-assertion. Specs never
 *    edit source, so HMR carries zero value here.
 *  - `optimizeDeps.include + holdUntilCrawlEnd` — the arena chunk is lazy-imported, so its deps are
 *    otherwise discovered mid-run, re-optimized, and broadcast as another full-reload. Pre-bundling
 *    the entire (two-package) dep surface makes late discovery impossible.
 */

const REPO_ROOT = path.resolve(import.meta.dirname, "../..");
const CLIENT_ROOT = path.join(REPO_ROOT, "packages/client");
const STARTUP_TIMEOUT_MS = 15_000;
const SHUTDOWN_TIMEOUT_MS = 8_000;

interface ViteDevServer {
  httpServer: {
    address(): AddressInfo | string | null;
  } | null;
  listen(): Promise<unknown>;
  close(): Promise<void>;
}

interface ViteModule {
  createServer(options: Record<string, unknown>): Promise<ViteDevServer>;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${timeoutMs}ms`)),
      timeoutMs,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function hasErrorCode(error: unknown, code: string): boolean {
  let current = error;
  for (let depth = 0; depth < 5 && current && typeof current === "object"; depth++) {
    if ("code" in current && current.code === code) return true;
    current = "cause" in current ? current.cause : undefined;
  }
  return false;
}

async function loadVite(): Promise<ViteModule> {
  // Vite belongs to @dd/client, not the root — resolve through that workspace's package boundary.
  const requireFromClient = createRequire(pathToFileURL(path.join(CLIENT_ROOT, "package.json")));
  const viteEntry = requireFromClient.resolve("vite");
  return (await import(pathToFileURL(viteEntry).href)) as ViteModule;
}

/** Start the production Colyseus setup and a reload-proof source-serving Vite instance. */
export async function startSpecStack(): Promise<StackStart> {
  const previousDevTools = process.env.DD_DEV_TOOLS;
  process.env.DD_DEV_TOOLS = "1";

  let gameServer: Awaited<ReturnType<typeof createGameServer>>;
  try {
    // ArenaScene derives its endpoint from location.hostname + DEFAULT_PORT (same constraint as the smoke).
    gameServer = await withTimeout(
      createGameServer(DEFAULT_PORT),
      STARTUP_TIMEOUT_MS,
      "Colyseus startup",
    );
  } catch (error) {
    if (previousDevTools === undefined) delete process.env.DD_DEV_TOOLS;
    else process.env.DD_DEV_TOOLS = previousDevTools;

    if (hasErrorCode(error, "EADDRINUSE")) {
      const reason = `feature spec skipped: client DEFAULT_PORT ${DEFAULT_PORT} is already in use`;
      console.warn(`[e2e] ${reason}`);
      return { status: "skipped", reason };
    }
    throw error;
  }

  let viteServer: ViteDevServer | undefined;
  try {
    const vite = await loadVite();
    viteServer = await vite.createServer({
      root: CLIENT_ROOT,
      clearScreen: false,
      logLevel: "warn",
      server: {
        host: "127.0.0.1",
        port: 0,
        strictPort: true,
        hmr: false,
      },
      optimizeDeps: {
        // The complete npm dep surface of @dd/client (workspace packages are served as source).
        include: ["phaser", "colyseus.js"],
        holdUntilCrawlEnd: true,
      },
    });
    await withTimeout(viteServer.listen(), STARTUP_TIMEOUT_MS, "Vite startup");
    const address = viteServer.httpServer?.address();
    if (!address || typeof address === "string") {
      throw new Error("Vite did not expose its ephemeral TCP port");
    }
    const runningViteServer = viteServer;

    let closed = false;
    return {
      status: "ready",
      baseURL: `http://127.0.0.1:${address.port}`,
      async close(): Promise<void> {
        if (closed) return;
        closed = true;
        const failures: unknown[] = [];

        try {
          await withTimeout(runningViteServer.close(), SHUTDOWN_TIMEOUT_MS, "Vite shutdown");
        } catch (error) {
          failures.push(error);
        }

        try {
          await withTimeout(
            gameServer.gracefullyShutdown(false),
            SHUTDOWN_TIMEOUT_MS,
            "Colyseus shutdown",
          );
        } catch (error) {
          failures.push(error);
        } finally {
          if (gameServer.transport.server?.listening) gameServer.transport.shutdown();
          if (previousDevTools === undefined) delete process.env.DD_DEV_TOOLS;
          else process.env.DD_DEV_TOOLS = previousDevTools;
        }

        if (failures.length > 0) throw new AggregateError(failures, "spec-stack teardown failed");
      },
    };
  } catch (error) {
    if (viteServer) {
      await withTimeout(
        viteServer.close(),
        SHUTDOWN_TIMEOUT_MS,
        "failed Vite startup cleanup",
      ).catch(() => undefined);
    }
    try {
      await withTimeout(
        gameServer.gracefullyShutdown(false),
        SHUTDOWN_TIMEOUT_MS,
        "failed Colyseus startup cleanup",
      );
    } finally {
      if (gameServer.transport.server?.listening) gameServer.transport.shutdown();
      if (previousDevTools === undefined) delete process.env.DD_DEV_TOOLS;
      else process.env.DD_DEV_TOOLS = previousDevTools;
    }
    throw error;
  }
}
