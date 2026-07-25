/** Debug authority is fail-closed: only this exact, explicit capability enables it. */
export function serverDevToolsEnabled(
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return env.DD_DEV_TOOLS === "1";
}
