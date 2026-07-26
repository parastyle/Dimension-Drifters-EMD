import { createMetaAccountV5 } from "@dd/shared";
import {
  type DurableSettlementReceipt,
  SETTLEMENT_FAILPOINTS,
  SettlementStore,
} from "../settlement-store.js";

const [databasePath, failpoint] = process.argv.slice(2);
if (!databasePath || !failpoint) {
  throw new Error("usage: settlement-crash-worker <database-path> <failpoint>");
}
if (!SETTLEMENT_FAILPOINTS.some((candidate) => candidate === failpoint)) {
  throw new Error(`unknown settlement failpoint: ${failpoint}`);
}

const accountId = "acct_process_kill_matrix_000001";
const runId = "run_process_kill_matrix_000001";
const initial = createMetaAccountV5();
initial.scrip = 10;
const next = structuredClone(initial);
next.revision++;
next.scrip = 110;
const receipt: DurableSettlementReceipt = {
  version: 1,
  accountId,
  runId,
  outcome: "victory",
  accountRevision: next.revision,
  account: next,
  money: {
    outcome: "victory",
    banked: 100,
    previousBank: 10,
    bankTotal: 110,
  },
};

process.env.DD_SETTLEMENT_FAILPOINT = failpoint;
const store = new SettlementStore(databasePath);
store.commitSettlement({
  accountId,
  runId,
  expectedRevision: initial.revision,
  account: next,
  receipt,
});
throw new Error(`failpoint did not kill worker: ${failpoint}`);
