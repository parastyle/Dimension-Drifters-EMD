# Sol reports — the report of record

Every Sol maintains `docs/sol-reports/<slug>.md` FROM THE START of its run:
1. First action: write the work-order understanding + planned approach.
2. Update sections AS work completes (tables, decisions, files changed) — never save it all for the end.
3. Validation results are appended LAST.

Rationale: stdout reports die with hangs, killed pipes, and app restarts (three real incidents,
2026-07-21). The file survives all three; the orchestrator reads it regardless of how the process
ended. stdout remains best-effort duplication only.
