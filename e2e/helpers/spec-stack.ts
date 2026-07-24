import type { IncomingMessage, ServerResponse } from "node:http";
import { createRequire } from "node:module";
import { type AddressInfo, createServer as createTcpServer } from "node:net";
import path from "node:path";
import { pathToFileURL } from "node:url";
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
const SERVER_ROOT = path.join(REPO_ROOT, "packages/server");
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

interface ViteMiddlewareServer {
  middlewares: {
    use(
      handler: (request: IncomingMessage, response: ServerResponse, next: () => void) => void,
    ): void;
  };
}

/** Redirect only HTML entry requests through the client's existing dev `?port=` escape hatch. */
function privateGamePortPlugin(gamePort: number): Record<string, unknown> {
  return {
    name: "dd-e2e-private-game-port",
    configureServer(server: ViteMiddlewareServer): void {
      server.middlewares.use((request, response, next) => {
        const url = new URL(request.url ?? "/", "http://dd-e2e.local");
        if (url.pathname !== "/" || url.searchParams.has("port")) {
          next();
          return;
        }
        url.searchParams.set("port", String(gamePort));
        response.statusCode = 302;
        response.setHeader("location", `${url.pathname}${url.search}${url.hash}`);
        response.end();
      });
    },
  };
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

async function loadVite(): Promise<ViteModule> {
  // Vite belongs to @dd/client, not the root — resolve through that workspace's package boundary.
  const requireFromClient = createRequire(pathToFileURL(path.join(CLIENT_ROOT, "package.json")));
  const viteEntry = requireFromClient.resolve("vite");
  return (await import(pathToFileURL(viteEntry).href)) as ViteModule;
}

async function findFreeLoopbackPort(): Promise<number> {
  return await new Promise<number>((resolve, reject) => {
    const server = createTcpServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("temporary TCP listener did not expose a port"));
        return;
      }
      server.close((error) => (error ? reject(error) : resolve(address.port)));
    });
  });
}

/** Start the production Colyseus setup and a reload-proof source-serving Vite instance. */
export async function startSpecStack(): Promise<StackStart> {
  const previousDevTools = process.env.DD_DEV_TOOLS;
  process.env.DD_DEV_TOOLS = "1";

  let gameServer: Awaited<ReturnType<typeof createGameServer>>;
  try {
    const requireFromServer = createRequire(pathToFileURL(path.join(SERVER_ROOT, "package.json")));
    const colyseusEntry = requireFromServer.resolve("colyseus");
    const requireFromColyseus = createRequire(pathToFileURL(colyseusEntry));
    const schemaCjsEntry = requireFromColyseus.resolve("@colyseus/schema");
    const { Encoder } = requireFromColyseus("@colyseus/schema") as {
      Encoder: { BUFFER_SIZE: number };
    };
    Encoder.BUFFER_SIZE = Math.max(Encoder.BUFFER_SIZE, 64 * 1_024);
    const schemaEsmEntry = path.resolve(path.dirname(schemaCjsEntry), "../esm/index.mjs");
    const { Encoder: EsmEncoder } = (await import(pathToFileURL(schemaEsmEntry).href)) as {
      Encoder: { BUFFER_SIZE: number };
    };
    EsmEncoder.BUFFER_SIZE = Math.max(EsmEncoder.BUFFER_SIZE, 64 * 1_024);
    // Feature specs use ArenaScene's dev-only `?port=` escape hatch, so the owner's DEFAULT_PORT stack can
    // remain live while this suite owns an ephemeral game listener.
    gameServer = await withTimeout(createGameServer(0), STARTUP_TIMEOUT_MS, "Colyseus startup");
  } catch (error) {
    if (previousDevTools === undefined) delete process.env.DD_DEV_TOOLS;
    else process.env.DD_DEV_TOOLS = previousDevTools;

    throw error;
  }

  const gameAddress = gameServer.transport.server?.address();
  if (!gameAddress || typeof gameAddress === "string") {
    await gameServer.gracefullyShutdown(false);
    throw new Error("Colyseus did not expose its ephemeral TCP port");
  }
  const gamePort = gameAddress.port;

  let viteServer: ViteDevServer | undefined;
  try {
    const vite = await loadVite();
    const vitePort = await findFreeLoopbackPort();
    viteServer = await vite.createServer({
      root: CLIENT_ROOT,
      plugins: [privateGamePortPlugin(gamePort)],
      clearScreen: false,
      logLevel: "warn",
      server: {
        host: "127.0.0.1",
        port: vitePort,
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
