# Weapons armory audit — superseded runtime note

The original 2026-07-19 audit predated B27 and tested a player-created two-weapon link. That
runtime feature has been retired. Its ARM-WPN-01 findings, reproduction steps, state-field names,
and screenshots no longer describe a supported workflow.

Current weapon law:

- each Active or Pack position contains one independent weapon instance;
- switching positions equips only the selected instance;
- a weapon renders two hands only when its own catalog definition is authored as a dual;
- bank, extraction, loss, rarity, affix, provenance, and source-tier identity remain per instance;
- the nested `player.dualWield` row remains only as the compatibility container for gear, Drive,
  prestige, and relic state.

The audit's catalog, art, attack, VFX, damage-number, flourish, exact-pickup, and Weaponsmith
artifacts remain historical evidence for their original 2026-07-19 run. They are not a current
acceptance gate. B27 verification lives in
`docs/owner-notes-audit-v11-evidence/b27-premade-duals/`.
