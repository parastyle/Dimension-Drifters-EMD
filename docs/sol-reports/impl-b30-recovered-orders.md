# B30 Recovered Skipped-Window Orders

Branch: `sol/b30-recovered-orders`

## Per-order plan

1. `x2-quicksilver-streetsweeper`: convert the semi-auto weapon from shotgun behavior to the Graveshot grenade arc/explosion contract while preserving cadence and DPS within ±10%; remove pump motion and plant the support hand on the horizontal foregrip.
2. Archive `x2-hollowmother-spore-totem`: remove it from active weapon data and every pack/pool reference, following the established archive/deletion pattern.
3. Archive `x2-codex-of-forked-tongues`: remove it from active weapon data and every pack/pool reference, following the established archive/deletion pattern.
4. Archive `x2-voltscript-codicil`: remove it from active weapon data and every pack/pool reference, following the established archive/deletion pattern.
5. Archive `x2-bonepicker-coachgun`: remove it from active weapon data and every pack/pool reference; the later archive order supersedes prior hold-fix notes.
6. `x2-frostgig-harpoon`: move the held weapon above the shoulder in both facings.
7. `x2-fool-s-gold-revolver`: change grip data only so the hand lands at the handle/trigger midpoint.
8. `x2-sunbreaker-railgun`: move the weapon forward while keeping the stock near the shoulder.
9. `x2-buckshot-briar`: increase render metadata scale by 25%, without editing source art.
10. `x2-cinderfang-derringer`: increase render metadata scale by 20%, without editing source art.
11. `x2-hailshard-resonator`: remove the rogue swinging VFX separately from its intended ice particles, then assert that only the visible ice attack contributes damaging extent.
12. `tombstone-greatsword`: audit and correct any stale damaging extent left behind by its removed VFX.
13. `x2-coyote-trickster-s-sparkmitt`: remove its VFX entirely and rely on the existing attack animation.
14. `x2-saintspar-lochaber`: make the blade face up during UP motion and down during DOWN motion.
15. `x2-quarry-splitter-bardiche`: reduce render metadata scale by 20%; replace the attack with one front flip ending in a slam whose hit envelope follows the visible flip arc and impact.
16. `x2-choir-iron-greataxe`: change its attack VFX from holy to flame, without adding radial or ambient effects.
17. `gravediggers-spade`: reverse the incorrect flip direction, speed the motion up 3×, and make the attack a forward jump with at least six complete spins before landing.
18. `x2-sanctified-headsman`: reorder/extend the combo so an overhead chop comes first, followed by the existing slash.
19. `x2-brimstone-falcata`: configure a premade mirrored off-hand dual-wield presentation and a Garen-style whirlwind with both swords outstretched; use full-revolution swept damage and preserve DPS within ±10%.
20. `x2-rimebound-folio`: keep the weapon active; implement an opening book state from existing art if needed and fire envelope-true ice projectiles from it.

The owner grouped the four archive actions into one numbered order, so the twenty implementation bullets above represent the requested **19 owner orders**.

## Tombstone and expunged-VFX audit approach

Identify every weapon whose VFX was removed in B15, B24, or B28 from repository history, owner-note audit records, and generated weapon metadata. For each affected weapon, compare the current visible attack extent (weapon/animation/projectile visuals only) with the damaging hit envelope through the existing hit-envelope law helpers. Add one batch regression test covering the complete set. Any stale VFX-derived reach, radius, sweep, linger, or auxiliary hitbox will be removed or constrained to the remaining visual attack, and every offender will be recorded here.

## Progress

- Report initialized before implementation as required.

## Per-order implementation results

1. `x2-quicksilver-streetsweeper`: reclassified to `grenade-launcher` with a semi-auto edge latch, lobbed grenade trajectory, 62px explosion, siege-ordnance audio, and a planted horizontal-foregrip hand. The old and new nominal DPS are both 66.67. Pump handling and pump animation ownership are absent.
2. `x2-hollowmother-spore-totem`: archived through the durable archive flag and excluded from active catalogs, gallery/dev-equip, drops, packs, and account unlock acquisition.
3. `x2-codex-of-forked-tongues`: archived and removed from the starter/purchase path. `x2-rimebound-folio` replaces its active starter-family slot.
4. `x2-voltscript-codicil`: archived and excluded from every active acquisition surface.
5. `x2-bonepicker-coachgun`: archived under the later authoritative note and excluded from the gun, shotgun, gallery, drop, and pack censuses.
6. `x2-frostgig-harpoon`: uses the overhead hold in both facings.
7. `x2-fool-s-gold-revolver`: grip-only change to the painted handle/trigger midpoint (`0.38, 0.64`); no revolver animation surface was changed.
8. `x2-sunbreaker-railgun`: both painted contact anchors moved rearward on the sprite so the stock meets the shoulder while the rendered gun sits farther forward.
9. `x2-buckshot-briar`: render metadata increased from 96px to 120px (exactly +25%); no PNG or collision scalar changed.
10. `x2-cinderfang-derringer`: render metadata increased from 46px to 55.2px (exactly +20%); no PNG or collision scalar changed.
11. `x2-hailshard-resonator`: removed the rogue swing/continuous presentation and its inherited melee hitbox. The retained attack is a five-projectile forward ice cone with its own bounded ice explosions; the server test proves exactly the projectile payload and no melee swing registration.
12. `tombstone-greatsword`: removed the stale quake damage/VFX extent. Its only remaining damage envelope is the current visible blade reach.
13. `x2-coyote-trickster-s-sparkmitt`: suppresses all weapon VFX while retaining the authored eight-step animation combo.
14. `x2-saintspar-lochaber`: the existing ordered two-step sequence now resolves blade thickness/sign so the overhead/down beat faces down and the rising/up beat faces up.
15. `x2-quarry-splitter-bardiche`: render metadata reduced from 320px to 256px (exactly -20%). Its old quake and three-beat hook combo were replaced by one authoritative 2-pi front-flip fan, 96px forward root motion, and an impact-timed execution slam.
16. `x2-choir-iron-greataxe`: replaced the legacy holy/quake fallback with blade-owned `fire-bolt` flame motion and explicitly suppresses the legacy quake renderer. No radial or ambient layer remains.
17. `gravediggers-spade`: corrected the forward-flip sign, added a 144px forward jump, and presents six complete full-body turns in 0.2s. The accepted attack retains its original 0.6s cooldown and one 2-pi damage union, preventing the six visual turns from multiplying DPS.
18. `x2-sanctified-headsman`: authoritative two-step combo is overhead chop first, then the existing slash; ordinary blade reach is retained.
19. `x2-brimstone-falcata`: now a premade dual weapon. The single installed sprite is mirrored for the off side, the two swords are opposed during a Garen-style ground whirlwind, and one full 2-pi swept attack retains the exact prior 21.43 DPS.
20. `x2-rimebound-folio`: kept active. The original book sprite procedurally becomes two splayed leaves while open, then fires a seven-icicle forward volley with frost-shard particles. The inherited invisible melee envelope is suppressed, so only the visible projectiles damage.

The owner grouped the four archive actions into one order; the twenty implementation rows above therefore close the requested nineteen owner orders.

## Expunged-VFX hit-envelope audit result

The new batch law sweeps the complete 322-weapon B24 fallback-removal cohort, plus the explicit B15 removals (`rusty-cleaver`, `tombstone-greatsword`, `x-sword-anchor`) and B28 partial/complete removals (`drift-greatkatana-tempest-regent`, `drift-nodachi-gatebreaker`, `x2-thunderhead-voulge`). It compares physical blade reach, any visible extension tip, every visible projectile delivery, explosions, quake, and aura channels with the canonical damaging envelope.

`tombstone-greatsword` was the sole stale removed-VFX damaging-extent offender. Its obsolete quake was still contributing a damage/resource extent after the visual treatment disappeared. The quake is now absent from weapon authority, hit-envelope output, Drive pricing, and VFX resolution. No other B15/B24/B28 weapon failed the law. Hailshard and Rimebound also received explicit `suppressMeleeHitbox` metadata so their projectile-only visuals cannot inherit a generic melee capsule.

## Deletions and compatibility notes

- Removed active/pool eligibility for the four archived IDs while retaining durable archived rows for bank migration and salvage compatibility.
- Removed Streetsweeper pump/shotgun semantics; Hailshard and Sparkmitt rogue VFX; Tombstone, Bardiche, and Choir Iron quake surfaces; and Choir Iron's holy fallback.
- No source PNG was edited or deleted. Buckshot, Cinderfang, and Bardiche sizes are render metadata.
- No network schema changed, so no schema bump or pin migration was required. Catalog, tier, archive, gun, shotgun, combo-routing, resource, portal, and Weaponsmith pins were migrated to current truth.
- Tombstone, Choir Iron, and Quarry keep their prior reviewed rarity through explicit manual floors after obsolete quake utility was removed.

## Verification

- `pnpm gen`: PASS (336 generated expansion rows; 338 active portal weapons).
- `pnpm gen:check`: PASS.
- `pnpm typecheck`: PASS across shared, client, and server.
- `pnpm test`: PASS, 178 files / 2,267 tests.
- `pnpm assets:check`: PASS, 478 sprite entries / 1,007 parts.
- `git diff --check`: PASS.
- Playwright live gate: PASS in 2.8 minutes on private ephemeral client `65369` and game `65368`; default ports 5180/2567 were not used.
- Live receipt: 32 accepted captures (16 surviving weapons x both facings), 32 screenshots, and four rejected archive equip attempts on `proto-cowboy-hidden-face`.

## Evidence and files

Evidence is under `docs/owner-notes-audit-v11-evidence/b30-recovered-orders/`: `live-gate.json` contains the machine-readable projectile, grip, pose, orbit, VFX, procedural-leaf, archive-rejection, and port receipts; `live-gate-summary.md` and 32 facing screenshots provide the human review surface.

Files touched: 84 total at report time (45 modified tracked files and 39 new files). The new files are this report, two B30 unit-law suites, the private-port Playwright gate, and 35 evidence artifacts. Modified files span weapon source/generation, shared envelope/resource/tier/archive authority, server attack authority, client rig/pose/VFX/audio behavior, portal/Weaponsmith active counts, and migrated regression tests.

Verdict: 19 orders done; 4 archived (`x2-hollowmother-spore-totem`, `x2-codex-of-forked-tongues`, `x2-voltscript-codicil`, `x2-bonepicker-coachgun`); expunged-VFX audit offenders: `tombstone-greatsword` (sole offender, fixed); evidence path: `docs/owner-notes-audit-v11-evidence/b30-recovered-orders/`; files touched: 84 (45 modified, 39 new).
