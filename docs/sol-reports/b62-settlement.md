# B62 durable settlement

## Durable store and schema

The server now owns account and terminal-run state in a process-wide SQLite database implemented with
Node's built-in `node:sqlite`. The default file is `data/accounts.sqlite`; `DD_ACCOUNT_DB_PATH` overrides
it for tests or an isolated deployment. Startup sets `journal_mode=WAL`, `synchronous=FULL`,
`foreign_keys=ON`, and a 5-second busy timeout. No service or network datastore was added.

`account_snapshots` is a STRICT table keyed by `account_id`. It stores the canonical revision, complete
sanitized `MetaAccountV5` JSON, and update time. The snapshot includes money, pets, prestige, exact weapon
bank, and any open expedition escrow.

`settlements` is a STRICT terminal journal containing:

- `settlement_id` insertion order;
- `account_id` and `run_id`;
- `state`, either `pending` or `committed`;
- expected and resulting account revisions;
- outcome and the complete immutable receipt JSON, including the resulting account;
- prepare and commit times; and
- `UNIQUE (account_id, run_id)`, the settlement idempotency key.

An account/latest-settlement index supports revision-based reconnect recovery. The database is server-only
runtime data and its files are ignored by Git.

## Commit and acknowledgement ordering

Settlement first synchronizes exact weapon state, then computes money, pet, prestige, and weapon results
against a cloned account. It does not mark the room account settled or send a result at this point.

1. SQLite inserts the complete result as a `pending` settlement intent and commits that intent.
2. A second `BEGIN IMMEDIATE` validates the expected account revision.
3. The account snapshot replacement and transition of that settlement to `committed` occur in one
   transaction.
4. SQLite commits, and the server reads the committed receipt back.
5. Only then does the room replace its working account, zero run money, set already-settled markers, send
   money/pet/weapon/account receipts, and expose the terminal room outcome.

A crash after the intent commit cannot erase the decision. Store startup finishes every pending intent
before serving a join. A crash after the apply commit leaves the account and receipt complete. Repeating
the operation attempts the bare insert, lets SQLite raise the `(account_id, run_id)` UNIQUE violation, and
returns the already committed receipt without applying account changes again.

On join, the server loads the durable account before considering the client cache. It looks up an exact
terminal receipt for a supplied stale run ID and also recovers the latest receipt when the client's known
revision is older. A committed terminal snapshot has no open expedition, so it cannot reach the
open-expedition abandonment/defeat path. The browser requests account recovery after installing callbacks,
which covers owner messages that crossed the transport during `onJoin`. The request returns the current
durable account and any newer committed receipt.

The Colyseus synchronized schema remains version 47 because no synchronized field, order, or type changed.
The additions are private join options and owner message handlers.

## Client persistence

The browser keeps a stable random account ID in `dd.accountId.v1`; it is identity only, not money or
settlement truth. A blocked identity write prevents a run from starting instead of creating an
unrecoverable anonymous result. Server `metaAccount` messages replace the client working copy; a failed
cache write is surfaced while the UI states that the server copy is safe.

`savePetMetaAccount` now writes one complete account cache record, reads it back for exact verification,
and throws `MetaAccountStorageError` on write or verification failure. It no longer makes a second
independent `dd.beltScrip` write or swallows errors. The booster purchase path does not advance its
in-memory account or report success when that cache operation fails.

## Process-kill failpoint matrix

`packages/server/src/settlement-store.test.ts` spawns a real Node process for every phase. The child calls
`process.kill(process.pid, "SIGKILL")`; the parent opens the same SQLite file as a restarted process and
requires the correct resulting account and exactly one committed receipt before performing any explicit
retry.

| Failpoint | Durable state at kill | Required restart result |
| --- | --- | --- |
| `after-settlement-intent` | Pending intent committed | Startup applies the account and commits one receipt |
| `after-transaction-begin` | Pending intent; apply transaction uncommitted | Rolled-back apply is completed once |
| `after-account-load` | Pending intent; account unchanged | Account advances once and receipt commits |
| `after-account-update` | Pending intent; update rolls back with transaction | Account advances once and receipt commits |
| `after-settlement-finalize` | Account/final marker transaction rolls back atomically | Both changes are applied once |
| `after-commit` | Account and receipt committed | Restart reads them without adding credit |
| `after-receipt-read` | Commit complete, acknowledgement not delivered | Reconnect/retry returns the same receipt |

The fixture begins at balance 10 and settles 100. After every kill, restart observes balance 110 and one
receipt. Two subsequent calls with the same run ID each exercise the actual UNIQUE constraint, return the
identical receipt, leave the balance at 110, and leave the row count at one.

Room-level recovery additionally discards all in-memory maps and closes/reopens SQLite, then joins with a
revision-0 cache containing no completed run ID. It receives the committed victory, does not receive an
abandonment receipt, preserves the banked 125, and starts a different run.

## Live crash/restart result

`packages/server/src/settlement-restart.integration.test.ts` runs two real Colyseus server processes and
the real client transport against one temporary SQLite file. The first process completed the actual
`completeRewardBoundary("extract")` route for run `run_KDZcbNSflqtJ1IOs` with 177 run money. Before killing
it, the client observed the committed victory receipt and canonical account balance 177.

I killed server PID 51264 with `SIGKILL`, not a graceful room shutdown. I then started PID 8580 against
the same database and joined with a revision-0 client account containing neither the completed run ID nor
the terminal state. The recovery request returned the victory receipt with `banked: 177` and
`bankTotal: 177`, returned the canonical balance 177, and supplied a fresh run
`run_eA4C-Sj76j8xjwwA`. Direct SQLite inspection found one settlement row for the extracted run.

## Verification and scope

- `pnpm gen`: passed.
- `pnpm gen:check`: passed; it reported the existing unavailable untracked VFX-reference and character
  scale measurement warnings.
- `pnpm typecheck`: passed.
- `pnpm test`: passed, 227 files; 2,786 passed and 20 skipped (2,806 total).
- Protected map-art files and parallel accessibility/pause and weapon/relic-description areas were not
  touched.

Verdict: SQLite WAL + STRICT account snapshots/settlement journal shipped; all seven post-intent/apply/commit failpoints recover correctly; `(account_id, run_id)` idempotency was proven by real UNIQUE violations returning one identical receipt and balance; generation, checks, typecheck, and all 2,786 active tests passed; live SIGKILL/restart recovered the banked 177 victory exactly once.
