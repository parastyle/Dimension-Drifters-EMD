# Weapon bank — post-B27 technical contract

Status: current delta over the original 2026-07-18 design panel. The original document assumed
that players could combine two bank instances into one runtime item; B27 removed that assumption.

## Canonical identity

`WeaponBankEntryV1` has one live shape: a `single` entry whose `entryId` is its weapon
`instanceId`. Every entry has exactly one base weapon, rarity, affix, provenance, and source World
Tier. Stash, Intake, expedition reservations, Active positions, Pack positions, curator counts,
sales, extraction, defeat, and prestige all operate on those independent entries.

Every entry occupies one Stash row and one physical Carry position. A pre-made dual weapon is still
one entry and one position because both hands are authored by that single weapon definition.

## Save compatibility

Bank version remains 1. The sanitizer accepts the obsolete two-member JSON shape only at the
local-trust boundary. It validates both exact instances, rebuilds them as two canonical single
entries, expands saved Carry placements into adjacent cells, and selects the former first member
when the old composite was active. No live union member or runtime grouping survives sanitization.

The migration is one-way and lossless. A temporarily over-capacity Stash caused only by expanding
an old saved row remains loadable; ordinary additions stay blocked until capacity is available.

## Runtime and settlement

- Carry commit moves selected entries; it never copies them.
- Active and Pack positions are independent and may contain same-class weapons.
- Switching positions preserves each instance's cooldown and exact private identity.
- Found weapons mint an instance only after an accepted grab.
- Victory returns carried entries; defeat removes at-risk entries; safe Stash and Intake keep their
  existing settlement rules.
- Archived-weapon salvage removes only the archived single entry and needs no identifier remap.
- Home sale, shelf purchases, curator weighting, tier checks, prestige reset, and account revision
  transactions retain their existing single-entry rules.

## Wire compatibility

No schema bump is required. `SCHEMA_VERSION` remains 37. The first four fields of the nested
`player.dualWield` row are inert tombstones with their previous widths and indexes. `gearUpper`,
`gearLower`, `weaponResource`, `prestige`, and `relics` remain at indexes 4–8 unchanged.

There is no bind, unbind, composite drop, split-card art, grouping filter, or second equipped
instance in the runtime protocol.
