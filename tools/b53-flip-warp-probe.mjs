import { spawnSync } from "node:child_process";
import path from "node:path";

const args = new Set(process.argv.slice(2));
const label = process.argv.slice(2).find((arg) => !arg.startsWith("--")) ?? "after";
const env = {
  ...process.env,
  DD_B53_TRACE_LABEL: label,
  DD_E2E_PER_TEST_STACK: "1",
};
if (args.has("--allow-failure")) env.DD_B53_ALLOW_FAILURE = "1";
const grep = args.has("--baseline") ? ["--grep", "B53 baseline"] : ["--grep", "B53 sweep"];
const pnpmEntry = path.join(
  path.dirname(process.execPath),
  "node_modules",
  "corepack",
  "dist",
  "pnpm.js",
);
const result = spawnSync(
  process.execPath,
  [pnpmEntry, "e2e", "e2e/tests/b53-flip-warp.probe.spec.ts", ...grep],
  {
    cwd: process.cwd(),
    env,
    stdio: "inherit",
  },
);
if (result.error) console.error(result.error);
process.exit(result.status ?? 1);
