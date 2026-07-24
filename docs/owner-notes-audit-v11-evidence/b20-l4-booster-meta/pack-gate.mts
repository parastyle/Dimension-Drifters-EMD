import { writeFile } from "node:fs/promises";
import {
  createMetaAccountV5,
  openBoosterPack,
  PET_IDS,
  sanitizeMetaAccountV5WithDiagnostics,
} from "@dd/shared";

const outputPath =
  process.argv[2] ??
  "docs/owner-notes-audit-v11-evidence/b20-l4-booster-meta/pack-observations.json";
const seed = 77;
const account = createMetaAccountV5();
account.scrip = 500;
for (const id of PET_IDS) {
  if (id !== "pale-firefly") account.pets[id] = { bondXp: 0 };
}

const result = openBoosterPack(account, "pet", seed);
if (!result.ok) throw new Error(`deterministic PET PACK failed: ${result.reason}`);
const duplicateLines = result.receipt.pulls
  .filter((pull) => pull.duplicate)
  .map((pull) => `duplicate -> +${pull.refund} money`);
if (duplicateLines.length !== 2) {
  throw new Error(`expected two duplicate card flips, received ${duplicateLines.length}`);
}

const roundTrip = sanitizeMetaAccountV5WithDiagnostics(JSON.parse(JSON.stringify(result.account)));
const observations = {
  verdict: "pass",
  seed,
  packType: result.receipt.packType,
  price: result.receipt.price,
  pulls: result.receipt.pulls,
  duplicateLines,
  refundTotal: result.receipt.refundTotal,
  endingBalance: result.receipt.balance,
  persisted: {
    version: roundTrip.account.version,
    balance: roundTrip.account.scrip,
    unlockedPet: !!roundTrip.account.pets["pale-firefly"],
    valid: roundTrip.ok,
    bankErrors: roundTrip.bank.errors,
  },
};

await writeFile(outputPath, `${JSON.stringify(observations, null, 2)}\n`, "utf8");
process.stdout.write(
  `[b20-l4-pack] PASS seed=${seed} duplicates=${duplicateLines.length} output=${outputPath}\n`,
);
