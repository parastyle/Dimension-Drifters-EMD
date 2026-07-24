import { startSpecStack } from "./spec-stack.js";

/**
 * One fixed-port game server per Playwright invocation. Tests remain serialized in one worker and each
 * receives a fresh page/context, while the stack itself is released only after the suite has finished.
 */
export default async function startGlobalStack(): Promise<() => Promise<void>> {
  if (process.env.DD_E2E_PER_TEST_STACK === "1") return async () => undefined;

  const externalBaseURL = process.env.DD_E2E_BASE_URL;
  if (externalBaseURL) return async () => undefined;

  const stack = await startSpecStack();
  if (stack.status === "skipped") {
    throw new Error(`${stack.reason}; the shared e2e stack requires exclusive access to the port`);
  }

  process.env.DD_E2E_BASE_URL = stack.baseURL;
  return async (): Promise<void> => {
    delete process.env.DD_E2E_BASE_URL;
    await stack.close();
  };
}
