# B44 no weapon drift

B43's GameRoom/SpriteRig split landed first at `9ac832f`; B44 was then implemented against those
ownership boundaries. Weapon attacks can still animate, spin, flip, shake, recoil visually, and
deal their authored damage, but they no longer write the player root.

## Removed weapon-motion sources

| # | Source | Removed character movement | In-place replacement and reach |
|---:|---|---|---|
| 1 | Cinderbrand Cleaver `performance.forwardDrift` | 72 px/s for 1/3 s on held beats | Attack animation remains; melee range 158 -> 182 preserves the former 182 px effective reach. |
| 2 | Coyote Trickster's Sparkmitt `performance.forwardDrift` | 48 px/s for 0.12 s on held beats | Glove animation/combo remains; melee range 150 -> 156 preserves 155.76 px effective reach. |
| 3 | Venomtongue Trident `performance.lunge` | 128 px forward lunge | Lunge choreography remains in place; range 195 -> 323. |
| 4 | Frostfang Rakes `performance.lunge` | 64 px forward lunge | Rake choreography remains in place; range 108 -> 172. |
| 5 | Thunderhead Stormfists `performance.lunge` | 480 px invulnerable destination dash with deferred impact | Punch/quake remain planted; melee range 200 -> 680 and quake placement stays 480 px with its original 180 px radius, damage, and timing. Weapon-lunge immunity was removed with the movement. |
| 6 | Quarry-Splitter Bardiche combo `rootMotion` | 96 px front-flip travel | The front flip remains as a rig animation at the planted root; range 240 -> 336. |
| 7 | Riftstep Katana finisher `finisherDashImpulse` / `dashImpulse` | Finisher impulse on the player body | Hook is now `finisher-reach`; final-beat range multiplier 1.12 -> 1.36 preserves the captured 203.3 px finisher reach at 204 px. |
| 8 | Gravedigger's Spade base `performance.lunge` | 144 px front-flip travel | The continuous front flip remains in place; range 210 -> 354. |
| 9 | Cogwright's Tesla-Rod cursor warp | Player root teleported to the validated cursor before bursting | The player stays planted; the same nav-validated cursor endpoint receives the same burst, damage, radius, cooldown, and VFX. |
| 10 | Universal gun locomotion recoil | Server impulse plus matching owner-predicted body recoil for every gun | Gun/hand kick, camera response, muzzle VFX, projectile range, damage, and cadence remain. The displacement policy and five authored multipliers (Sanctus Siege Bombard, Calamity Howitzer, Barrett .50 Cal, M50 Anti-Materiel Rifle, Confetti Cannon) were deleted. |

The pending-lunge state machine, destination-impact deferral, lunge invulnerability, weapon
root-motion attack mode, server gun impulse, client gun prediction impulse, and their schema,
generator, and utility valuation paths were removed rather than reclassified.

## Reach and at-range DPS guard

| Weapon | Legacy effective reach | Planted effective reach | Delta | Preserved damage/cooldown | DPS |
|---|---:|---:|---:|---:|---:|
| Cinderbrand Cleaver | 182 | 182 | 0% | 5.5556 / 0.3333 s | 16.6667 |
| Coyote Trickster's Sparkmitt | 155.76 | 156 | +0.15% | 1.0588 / 0.12 s | 8.8235 |
| Venomtongue Trident | 323 | 323 | 0% | 9 / 0.46 s | 19.5652 |
| Frostfang Rakes | 172 | 172 | 0% | 6 / 0.3 s | 20 |
| Thunderhead Stormfists | 680 | 680 | 0% | 6 melee + 8 quake / 0.8 s | 17.5 |
| Gravedigger's Spade | 354 | 354 | 0% | 8 / 0.6 s | 13.3333 |
| Quarry-Splitter Bardiche | 336 | 336 | 0% | 15 / 0.88 s | 17.0455 |
| Riftstep Katana finisher | 203.3 | 204 | +0.34% | 6.5 / 0.35 s | 18.5714 |
| Cogwright's Tesla-Rod | Validated cursor endpoint | Same endpoint | 0% | 4 / 0.36 s | 11.1111 |
| All guns | Authored projectile envelope | Unchanged | 0% | Damage and cadence unchanged | Unchanged |

All finite former-travel weapons are within 0.34%, well inside the requested +/-10%. The
executable guard verifies reach, damage, cooldown, quake placement, and Tesla endpoint semantics.

## Kept and classified non-weapon motion

| Motion | Classification | Audit result |
|---|---|---|
| Dodge roll | `dodge-roll` | Opens an explicit timed server-motion epoch. |
| Jump / distance jump | `distance-jump` | Opens an explicit timed epoch; ordinary hop is not a separate movement verb under the current movement law. |
| Slide-hop | `slide-hop` | Retained in the closed source registry as the required classification; currently dormant, so any future reactivation must use the typed epoch API. |
| Parry side slide | `parry-slide` | One-tick epoch; live gate converged both clients. |
| Parry launch | `parry-launch` | Launch-duration epoch. |
| Parry brace | No displacement | Audited clean: brace changes defense/pose but does not write position or velocity. |
| Enemy committed lunge | Enemy-side motion, untouched | The enemy body continues its B33 commit. Player responses are `enemy-commit-hit` or `enemy-commit-launch`. |
| Passive enemy contact push | `enemy-contact-hit` | Impulse-duration epoch. |
| Hostile projectile push | `hostile-projectile-hit` | Impulse-duration epoch. |
| Pit recovery / snap-back | `pit-snapback` | Named placement epoch. |
| Elevator boarding | `elevator-boarding` | One epoch owns departure and arrival placement; live gate was clean. |
| Revive placement | `revive-placement` | Every revive path is named. |
| Run, descent, and dimension placement | `teleport-placement` | Every generic authoritative placement is named. |
| Movement-owning ultimate | `ultimate` | Timed and placement writes share the named ultimate epoch. |

`SERVER_MOTION_SOURCES` is the closed census. `beginServerMotion` and `zeroMoveVel` require its
union type, and the B44 census test rejects weapon/attack source names. Initial spawn/join placement
and ordinary client-input, impulse-decay, body-collision, and navigation integration are not
exceptional server-motion sources.

## Regression and verification evidence

The relaxed-authority regression runs Sparkmitt's full combo while continuously moving and repeats
the proof with Cinderbrand and Venomtongue: zero envelope rejections, correction sequence unchanged,
and no weapon server-motion epoch. The live gate covers Sparkmitt, Venomtongue, and Stormfists with
two real clients, then separately proves the correction rail, parry slide epoch, and elevator epoch.

- `pnpm gen`: pass
- `pnpm gen:check`: pass
- `pnpm typecheck`: pass
- Full `pnpm test`: pass, 197 files / 2,394 tests
- Private live gate: pass on OS-assigned port 54741; ports 5180 and 2567 untouched
- Evidence: `docs/owner-notes-audit-v11-evidence/b44-no-weapon-drift/`

Clean-checkout test collection also stopped depending on ignored Artkit-local `pngjs` and
orientation artifacts: `pngjs` is now a declared root dev dependency, the relevant image tests use
declared/tracked inputs, and Weaponsmith's combined-preview fixture mounts a tracked body image.
These changes do not alter runtime playfeel.

Files touched are the weapon catalog/schema/generated output; shared combat, movement-authority,
state, resource, tier, and enemy-melee helpers; B43 GameRoom room modules; ArenaScene/prediction and
SpriteRig assertions; migrated motion/content tests plus the B44 census; generator/live/Weaponsmith
tools; package metadata; and this report/evidence.

VERDICT: 10 weapon motion source families removed; non-weapon sources all classified; rubberband dead (telemetry); reach-preservation list: Cinderbrand Cleaver, Coyote Trickster's Sparkmitt, Venomtongue Trident, Frostfang Rakes, Thunderhead Stormfists, Gravedigger's Spade, Quarry-Splitter Bardiche, Riftstep Katana, Cogwright's Tesla-Rod, all guns; evidence path: docs/owner-notes-audit-v11-evidence/b44-no-weapon-drift/; files touched: catalog/schema/generated data, shared/server/client motion paths, migrated and B44 tests, generator/live/Weaponsmith tools, dependency metadata, evidence/report.
