# B62 database isolation

## Isolation approach

Vitest now loads `vitest.setup.ts` before every test file. The setup creates a fresh temporary
directory whose prefix includes `VITEST_WORKER_ID`, then points `DD_ACCOUNT_DB_PATH` at an on-disk
`accounts.sqlite` inside that directory before the test module is imported. This isolates files
even when Vitest reuses a worker and prevents parallel workers from reaching the repository-level
`data/accounts.sqlite`.

Teardown closes the shared settlement-store singleton only when that file was created, restores the
prior environment value, and removes the temporary directory. The conditional close avoids loading
`node:sqlite` in unrelated client/shared test files.

No settlement behavior, schema, ordering, idempotency constraint, or transport test was changed.

## Durability coverage

The seven SIGKILL failpoint cases still use `mkdtempSync` to create a real database file and pass its
path as an argument to `settlement-crash-worker.ts`. After the child is killed, the parent opens the
same file and verifies recovery and exactly-once replay.

The restart integration test still creates a real temporary database path and explicitly supplies
it as `DD_ACCOUNT_DB_PATH` to both server child processes. The second process and the parent-side
inspection therefore read the file written by the first process. The setup does not replace either
suite's explicit path with `:memory:`.

The real Colyseus integration test remains unchanged and still obtains the server-side WebSocket,
calls `terminate()`, reconnects with the reconnection token, and verifies one settlement.

## Dev-server default decision

The runtime default remains `data/accounts.sqlite`. That stable path preserves accounts across a
normal single-node solo-dev restart. Starting a second server is an intentional multi-instance
configuration that already requires a distinct `DD_PORT`; it should also set a distinct
`DD_ACCOUNT_DB_PATH`. Deriving the database from a transient process or port would silently fragment
the durable default and is outside this test-isolation fix.

## Verification

- `pnpm gen:check`: PASS
- `pnpm typecheck`: PASS
- Targeted real transport, seven-failpoint matrix, and restart integration: PASS (3 files, 13 tests)
- Consecutive full run 1: PASS — 228 files; 2,790 passed, 20 skipped; 30.77 s
- Consecutive full run 2: PASS — 228 files; 2,790 passed, 20 skipped; 29.04 s
- Consecutive full run 3: PASS — 228 files; 2,790 passed, 20 skipped; 28.48 s

verdict: per-test-file, worker-tagged on-disk temp SQLite isolation with cleanup; full runs 1/2/3 PASS (228 files, 2,790 passed, 20 skipped each); retain `data/accounts.sqlite` for the single-node dev default and require `DD_ACCOUNT_DB_PATH` for a second intentional instance.
