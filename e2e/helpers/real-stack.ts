import { createRequire } from "node:module";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { DEFAULT_PORT } from "@dd/shared";
import { createGameServer } from "../../packages/server/dist/index.js";

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

export interface RunningStack {
  status: "ready";
  baseURL: string;
  close(): Promise<void>;
}

export interface SkippedStack {
  status: "skipped";
  reason: string;
}

export type StackStart = RunningStack | SkippedStack;

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
  // Vite belongs to @dd/client, not the root. Resolve through that workspace's package boundary so the
  // smoke does not add or rely on a duplicate root Vite installation.
  const requireFromClient = createRequire(pathToFileURL(path.join(CLIENT_ROOT, "package.json")));
  const viteEntry = requireFromClient.resolve("vite");
  return (await import(pathToFileURL(viteEntry).href)) as ViteModule;
}

/** Start the production Colyseus setup and a source-serving Vite instance in this Playwright worker. */
export async function startRealStack(): Promise<StackStart> {
  const previousDevTools = process.env.DD_DEV_TOOLS;
  process.env.DD_DEV_TOOLS = "1";

  let gameServer: Awaited<ReturnType<typeof createGameServer>>;
  try {
    // ArenaScene derives this endpoint from location.hostname + DEFAULT_PORT. Until the client supports an
    // injected endpoint, this is the one non-ephemeral listener in the smoke.
    gameServer = await withTimeout(
      createGameServer(DEFAULT_PORT),
      STARTUP_TIMEOUT_MS,
      "Colyseus startup",
    );
  } catch (error) {
    if (previousDevTools === undefined) delete process.env.DD_DEV_TOOLS;
    else process.env.DD_DEV_TOOLS = previousDevTools;

    if (hasErrorCode(error, "EADDRINUSE")) {
      const reason = `real-stack smoke skipped: client DEFAULT_PORT ${DEFAULT_PORT} is already in use`;
      console.warn(`[e2e] ${reason}`);
      return {
        status: "skipped",
        reason,
      };
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

        if (failures.length > 0) throw new AggregateError(failures, "real-stack teardown failed");
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
