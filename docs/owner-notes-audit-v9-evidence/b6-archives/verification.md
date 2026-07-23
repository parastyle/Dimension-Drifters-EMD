# B6 Archive Verification

Acceptance evidence is enforced by
`tests/b6-weapon-archives.test.ts` and the serialized pre-archive inventory at
`tests/fixtures/b6-archived-weapon-bank-v1.json`.

## Acceptance results

- Exact archive census: 343 durable = 332 active + 11 archived.
- Exact state delta: the prior nine archived IDs plus only
  `x2-coffin-nail-carbine` and `x2-psalter-of-the-burning-halo`.
- Both IDs remain canonical `WEAPONS` and weapon-resource keys with their
  original names.
- Both IDs are absent from the active catalog, active expansion catalog,
  ordinary selection roster, power-banded drop pool, enemy wield identities,
  Testing-Grounds roster, portal deep links, and all four acquisition
  provenances.
- The serialized bank sanitizer accepts both historical IDs and preserves them
  exactly. The archive migration then reports those same two IDs, values the
  two instances, and removes them without substitution.

## Validation results

| Command | Result |
| --- | --- |
| `pnpm gen` | PASS; generated catalog retained both rows and the portal emitted 332 active weapons |
| `pnpm gen:check` | PASS; cache-dependent VFX/character checks used their documented fresh-checkout skips |
| `pnpm assets:check` | PASS; 426 sprite entries, 781 parts, 431 atlas frames, 320 cards |
| `pnpm typecheck` | PASS; shared, server, and client |
| `pnpm test` | PASS; 139 files, 1,803 tests |
| Built server ephemeral-port smoke | PASS; listened on port 53170 and shut down cleanly |

The server smoke used port `0` (OS-assigned ephemeral port); ports 5180 and
2567 were not used.
