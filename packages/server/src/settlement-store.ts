import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import {
  type MetaAccountV5,
  type MoneyBankReceipt,
  type PetProgressReceipt,
  sanitizeMetaAccountV5,
} from "@dd/shared";
import type { WeaponSettlementResult } from "./rooms/progression.js";

const ACCOUNT_ID_PATTERN = /^acct_[A-Za-z0-9_-]{16,80}$/;
const RUN_ID_PATTERN = /^run_[A-Za-z0-9_-]{8,96}$/;
const UNIQUE_SETTLEMENT_ERROR =
  "UNIQUE constraint failed: settlements.account_id, settlements.run_id";

export const SETTLEMENT_FAILPOINTS = [
  "after-settlement-intent",
  "after-transaction-begin",
  "after-account-load",
  "after-account-update",
  "after-settlement-finalize",
  "after-commit",
  "after-receipt-read",
] as const;

export type SettlementFailpoint = (typeof SETTLEMENT_FAILPOINTS)[number];

export interface DurableSettlementReceipt {
  readonly version: 1;
  readonly accountId: string;
  readonly runId: string;
  readonly outcome: "defeat" | "victory";
  readonly accountRevision: number;
  readonly account: MetaAccountV5;
  readonly money: MoneyBankReceipt;
  readonly pet?: PetProgressReceipt;
  readonly weapon?: WeaponSettlementResult;
}

export interface SettlementCommit {
  readonly accountId: string;
  readonly runId: string;
  readonly expectedRevision: number;
  readonly account: MetaAccountV5;
  readonly receipt: DurableSettlementReceipt;
}

export interface SettlementCommitResult {
  readonly receipt: DurableSettlementReceipt;
  /** True only when SQLite raised the `(account_id, run_id)` UNIQUE constraint. */
  readonly replayedFromUniqueConstraint: boolean;
}

interface AccountRow {
  readonly revision: number;
  readonly snapshot_json: string;
}

interface SettlementRow {
  readonly state: "pending" | "committed";
  readonly expected_revision: number;
  readonly receipt_json: string;
}

export function isDurableAccountId(value: unknown): value is string {
  return typeof value === "string" && ACCOUNT_ID_PATTERN.test(value);
}

export function isDurableRunId(value: unknown): value is string {
  return typeof value === "string" && RUN_ID_PATTERN.test(value);
}

function parseAccount(row: AccountRow | undefined, accountId: string): MetaAccountV5 | undefined {
  if (!row) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(row.snapshot_json);
  } catch (error) {
    throw new Error(`corrupt durable account snapshot for ${accountId}`, { cause: error });
  }
  const account = sanitizeMetaAccountV5(parsed);
  if (account.revision !== row.revision) {
    throw new Error(`durable account revision mismatch for ${accountId}`);
  }
  return account;
}

function parseReceipt(
  row: SettlementRow | undefined,
  accountId: string,
  runId: string,
): DurableSettlementReceipt | undefined {
  if (!row) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(row.receipt_json);
  } catch (error) {
    throw new Error(`corrupt durable settlement receipt for ${accountId}/${runId}`, {
      cause: error,
    });
  }
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    Array.isArray(parsed) ||
    (parsed as { version?: unknown }).version !== 1 ||
    (parsed as { accountId?: unknown }).accountId !== accountId ||
    (parsed as { runId?: unknown }).runId !== runId
  ) {
    throw new Error(`invalid durable settlement receipt for ${accountId}/${runId}`);
  }
  const receipt = parsed as DurableSettlementReceipt;
  const account = sanitizeMetaAccountV5(receipt.account);
  if (account.revision !== receipt.accountRevision) {
    throw new Error(`durable settlement account revision mismatch for ${accountId}/${runId}`);
  }
  return { ...receipt, account };
}

function sqliteUniqueSettlement(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    error.code === "ERR_SQLITE_ERROR" &&
    error.message.includes(UNIQUE_SETTLEMENT_ERROR)
  );
}

function defaultFailpoint(phase: SettlementFailpoint): void {
  if (process.env.DD_SETTLEMENT_FAILPOINT !== phase) return;
  process.stderr.write(`[settlement-failpoint] ${phase}\n`);
  process.kill(process.pid, "SIGKILL");
  throw new Error(`settlement failpoint did not terminate process: ${phase}`);
}

export function defaultSettlementDatabasePath(): string {
  const configured = process.env.DD_ACCOUNT_DB_PATH?.trim();
  if (configured) return configured === ":memory:" ? configured : resolve(configured);
  return fileURLToPath(new URL("../../../data/accounts.sqlite", import.meta.url));
}

export class SettlementStore {
  readonly path: string;
  private readonly database: DatabaseSync;
  private readonly failpoint: (phase: SettlementFailpoint) => void;

  constructor(
    path = defaultSettlementDatabasePath(),
    failpoint: (phase: SettlementFailpoint) => void = defaultFailpoint,
  ) {
    this.path = path;
    this.failpoint = failpoint;
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.database = new DatabaseSync(path);
    this.database.exec("PRAGMA busy_timeout = 5000");
    this.database.exec("PRAGMA foreign_keys = ON");
    this.database.exec("PRAGMA journal_mode = WAL");
    this.database.exec("PRAGMA synchronous = FULL");
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS account_snapshots (
        account_id TEXT PRIMARY KEY NOT NULL,
        revision INTEGER NOT NULL CHECK (revision BETWEEN 0 AND 4294967295),
        snapshot_json TEXT NOT NULL,
        updated_at_ms INTEGER NOT NULL
      ) STRICT;

      CREATE TABLE IF NOT EXISTS settlements (
        settlement_id INTEGER PRIMARY KEY,
        account_id TEXT NOT NULL,
        run_id TEXT NOT NULL,
        state TEXT NOT NULL CHECK (state IN ('pending', 'committed')),
        expected_revision INTEGER NOT NULL CHECK (expected_revision BETWEEN 0 AND 4294967295),
        outcome TEXT NOT NULL CHECK (outcome IN ('defeat', 'victory')),
        account_revision INTEGER NOT NULL CHECK (account_revision BETWEEN 0 AND 4294967295),
        receipt_json TEXT NOT NULL,
        prepared_at_ms INTEGER NOT NULL,
        committed_at_ms INTEGER,
        FOREIGN KEY (account_id) REFERENCES account_snapshots(account_id),
        UNIQUE (account_id, run_id)
      ) STRICT;

      CREATE INDEX IF NOT EXISTS settlements_account_latest
      ON settlements (account_id, settlement_id DESC);
    `);
    this.recoverPendingSettlements();
  }

  close(): void {
    this.database.close();
  }

  journalMode(): string {
    const row = this.database.prepare("PRAGMA journal_mode").get() as
      | { journal_mode?: unknown }
      | undefined;
    return typeof row?.journal_mode === "string" ? row.journal_mode : "";
  }

  settlementCount(accountId: string, runId: string): number {
    const row = this.database
      .prepare(
        `SELECT COUNT(*) AS count
         FROM settlements
         WHERE account_id = ? AND run_id = ? AND state = 'committed'`,
      )
      .get(accountId, runId) as { count?: unknown } | undefined;
    return typeof row?.count === "number" ? row.count : Number(row?.count ?? 0);
  }

  getAccount(accountId: string): MetaAccountV5 | undefined {
    if (!isDurableAccountId(accountId)) return undefined;
    const row = this.database
      .prepare("SELECT revision, snapshot_json FROM account_snapshots WHERE account_id = ?")
      .get(accountId) as AccountRow | undefined;
    return parseAccount(row, accountId);
  }

  loadOrCreateAccount(accountId: string, initial: MetaAccountV5): MetaAccountV5 {
    if (!isDurableAccountId(accountId)) throw new Error("invalid durable account id");
    const account = sanitizeMetaAccountV5(initial);
    this.database
      .prepare(
        `INSERT INTO account_snapshots (account_id, revision, snapshot_json, updated_at_ms)
         VALUES (?, ?, ?, ?)
         ON CONFLICT (account_id) DO NOTHING`,
      )
      .run(accountId, account.revision, JSON.stringify(account), Date.now());
    const stored = this.getAccount(accountId);
    if (!stored) throw new Error(`failed to initialize durable account ${accountId}`);
    return stored;
  }

  replaceAccount(
    accountId: string,
    expectedRevision: number,
    replacement: MetaAccountV5,
  ): MetaAccountV5 {
    if (!isDurableAccountId(accountId)) throw new Error("invalid durable account id");
    const account = sanitizeMetaAccountV5(replacement);
    const result = this.database
      .prepare(
        `UPDATE account_snapshots
         SET revision = ?, snapshot_json = ?, updated_at_ms = ?
         WHERE account_id = ? AND revision = ?`,
      )
      .run(account.revision, JSON.stringify(account), Date.now(), accountId, expectedRevision);
    if (result.changes !== 1) {
      throw new Error(
        `durable account revision conflict for ${accountId}: expected ${expectedRevision}`,
      );
    }
    return account;
  }

  getSettlement(accountId: string, runId: string): DurableSettlementReceipt | undefined {
    if (!isDurableAccountId(accountId) || !isDurableRunId(runId)) return undefined;
    const row = this.getSettlementRow(accountId, runId);
    if (row?.state === "pending") return this.applyPendingSettlement(accountId, runId);
    return parseReceipt(row, accountId, runId);
  }

  getLatestSettlement(accountId: string): DurableSettlementReceipt | undefined {
    if (!isDurableAccountId(accountId)) return undefined;
    const row = this.database
      .prepare(
        `SELECT state, expected_revision, receipt_json
         FROM settlements
         WHERE account_id = ?
         ORDER BY settlement_id DESC
         LIMIT 1`,
      )
      .get(accountId) as SettlementRow | undefined;
    if (!row) return undefined;
    if (row.state === "pending") {
      let pending: unknown;
      try {
        pending = JSON.parse(row.receipt_json);
      } catch (error) {
        throw new Error(`corrupt latest durable settlement receipt for ${accountId}`, {
          cause: error,
        });
      }
      const pendingRunId =
        typeof pending === "object" &&
        pending !== null &&
        !Array.isArray(pending) &&
        typeof (pending as { runId?: unknown }).runId === "string"
          ? (pending as { runId: string }).runId
          : "";
      if (!isDurableRunId(pendingRunId)) {
        throw new Error(`invalid latest durable settlement receipt for ${accountId}`);
      }
      return this.applyPendingSettlement(accountId, pendingRunId);
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(row.receipt_json);
    } catch (error) {
      throw new Error(`corrupt latest durable settlement receipt for ${accountId}`, {
        cause: error,
      });
    }
    const runId =
      typeof parsed === "object" &&
      parsed !== null &&
      !Array.isArray(parsed) &&
      typeof (parsed as { runId?: unknown }).runId === "string"
        ? (parsed as { runId: string }).runId
        : "";
    return parseReceipt(row, accountId, runId);
  }

  private getSettlementRow(accountId: string, runId: string): SettlementRow | undefined {
    return this.database
      .prepare(
        `SELECT state, expected_revision, receipt_json
         FROM settlements
         WHERE account_id = ? AND run_id = ?`,
      )
      .get(accountId, runId) as SettlementRow | undefined;
  }

  private recoverPendingSettlements(): void {
    const pending = this.database
      .prepare(
        `SELECT account_id, run_id
         FROM settlements
         WHERE state = 'pending'
         ORDER BY settlement_id`,
      )
      .all() as Array<{ account_id: string; run_id: string }>;
    for (const row of pending) {
      this.applyPendingSettlement(row.account_id, row.run_id);
    }
  }

  /**
   * Finish an already durable intent. Account replacement and the committed marker share one transaction,
   * so startup can always distinguish "apply it" from "already applied".
   */
  private applyPendingSettlement(accountId: string, runId: string): DurableSettlementReceipt {
    this.database.exec("BEGIN IMMEDIATE");
    let transactionOpen = true;
    try {
      this.failpoint("after-transaction-begin");
      const row = this.getSettlementRow(accountId, runId);
      if (!row) throw new Error(`pending settlement disappeared for ${accountId}/${runId}`);
      const receipt = parseReceipt(row, accountId, runId);
      if (!receipt) throw new Error(`pending settlement receipt missing for ${accountId}/${runId}`);
      if (row.state === "committed") {
        this.database.exec("ROLLBACK");
        transactionOpen = false;
        return receipt;
      }

      const current = this.database
        .prepare("SELECT revision, snapshot_json FROM account_snapshots WHERE account_id = ?")
        .get(accountId) as AccountRow | undefined;
      const currentAccount = parseAccount(current, accountId);
      if (!currentAccount || currentAccount.revision !== row.expected_revision) {
        throw new Error(
          `durable account revision conflict for ${accountId}: expected ${row.expected_revision}`,
        );
      }
      this.failpoint("after-account-load");

      const update = this.database
        .prepare(
          `UPDATE account_snapshots
           SET revision = ?, snapshot_json = ?, updated_at_ms = ?
           WHERE account_id = ? AND revision = ?`,
        )
        .run(
          receipt.account.revision,
          JSON.stringify(receipt.account),
          Date.now(),
          accountId,
          row.expected_revision,
        );
      if (update.changes !== 1) {
        throw new Error(
          `durable account revision conflict for ${accountId}: expected ${row.expected_revision}`,
        );
      }
      this.failpoint("after-account-update");

      const finalize = this.database
        .prepare(
          `UPDATE settlements
           SET state = 'committed', committed_at_ms = ?
           WHERE account_id = ? AND run_id = ? AND state = 'pending'`,
        )
        .run(Date.now(), accountId, runId);
      if (finalize.changes !== 1) {
        throw new Error(`failed to finalize durable settlement ${accountId}/${runId}`);
      }
      this.failpoint("after-settlement-finalize");

      this.database.exec("COMMIT");
      transactionOpen = false;
      this.failpoint("after-commit");
      const committed = this.getSettlementRow(accountId, runId);
      if (committed?.state !== "committed") {
        throw new Error(`committed settlement receipt missing for ${accountId}/${runId}`);
      }
      const committedReceipt = parseReceipt(committed, accountId, runId);
      if (!committedReceipt) {
        throw new Error(`committed settlement receipt missing for ${accountId}/${runId}`);
      }
      this.failpoint("after-receipt-read");
      return committedReceipt;
    } catch (error) {
      if (transactionOpen) this.database.exec("ROLLBACK");
      throw error;
    }
  }

  commitSettlement(commit: SettlementCommit): SettlementCommitResult {
    const { accountId, runId, expectedRevision } = commit;
    if (!isDurableAccountId(accountId)) throw new Error("invalid durable account id");
    if (!isDurableRunId(runId)) throw new Error("invalid durable run id");
    const account = sanitizeMetaAccountV5(commit.account);
    if (
      commit.receipt.accountId !== accountId ||
      commit.receipt.runId !== runId ||
      commit.receipt.accountRevision !== account.revision ||
      commit.receipt.outcome !== commit.receipt.money.outcome
    ) {
      throw new Error("settlement receipt does not match its durable commit");
    }
    const receipt: DurableSettlementReceipt = {
      ...commit.receipt,
      account,
    };

    // Phase 1 is its own durable transaction. Once this returns, even SIGKILL cannot erase the
    // terminal decision: constructor recovery will finish the account replacement before serving joins.
    this.database.exec("BEGIN IMMEDIATE");
    let intentTransactionOpen = true;
    try {
      try {
        this.database
          .prepare(
            `INSERT INTO settlements
              (account_id, run_id, state, expected_revision, outcome, account_revision,
               receipt_json, prepared_at_ms, committed_at_ms)
             VALUES (?, ?, 'pending', ?, ?, ?, ?, ?, NULL)`,
          )
          .run(
            accountId,
            runId,
            expectedRevision,
            receipt.outcome,
            account.revision,
            JSON.stringify(receipt),
            Date.now(),
          );
      } catch (error) {
        if (!sqliteUniqueSettlement(error)) throw error;
        this.database.exec("ROLLBACK");
        intentTransactionOpen = false;
        const existing = this.getSettlement(accountId, runId);
        if (!existing) {
          throw new Error(
            `unique settlement exists without a readable receipt for ${accountId}/${runId}`,
          );
        }
        return { receipt: existing, replayedFromUniqueConstraint: true };
      }
      // Reject a stale new run before its pending intent becomes durable. The INSERT remains first so a
      // retry of an already committed run still exercises the UNIQUE key and returns its immutable result.
      const current = this.database
        .prepare("SELECT revision, snapshot_json FROM account_snapshots WHERE account_id = ?")
        .get(accountId) as AccountRow | undefined;
      const currentAccount = parseAccount(current, accountId);
      if (!currentAccount || currentAccount.revision !== expectedRevision) {
        throw new Error(
          `durable account revision conflict for ${accountId}: expected ${expectedRevision}`,
        );
      }
      this.database.exec("COMMIT");
      intentTransactionOpen = false;
      this.failpoint("after-settlement-intent");
      const committed = this.applyPendingSettlement(accountId, runId);
      return { receipt: committed, replayedFromUniqueConstraint: false };
    } catch (error) {
      if (intentTransactionOpen) this.database.exec("ROLLBACK");
      throw error;
    }
  }
}

let sharedSettlementStore: SettlementStore | undefined;

export function getSettlementStore(): SettlementStore {
  sharedSettlementStore ??= new SettlementStore();
  return sharedSettlementStore;
}

export function closeSettlementStore(): void {
  sharedSettlementStore?.close();
  sharedSettlementStore = undefined;
}
