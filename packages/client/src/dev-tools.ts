interface ClientDevToolEnvironment {
  readonly VITE_DD_DEV_TOOLS?: string;
}

/** The production bundle honors debug query parameters only with this exact build capability. */
export function clientDevToolsEnabled(
  env: ClientDevToolEnvironment = import.meta.env as ClientDevToolEnvironment,
): boolean {
  return env.VITE_DD_DEV_TOOLS === "1";
}
