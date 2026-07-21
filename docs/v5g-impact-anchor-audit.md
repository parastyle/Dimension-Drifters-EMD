# V5G2 impact-anchor audit

Classification rule: a visual that says **damage landed here** uses the cursor/impact point, clamped to the
weapon's authoritative placement reach. A visual that says **the implement is moving here** follows its
blade/tip. A source windup, aura, or continuous channel stays on the character because moving it would lie
about where the cast/channel originates. Projectile impacts already use the authoritative projectile end.

## Moved from character/weapon to clamped impact

| Weapon | Recipe | Previous anchor | V5G anchor |
|---|---|---|---|
| Hexbloom Rapier | `hexbloom-toxic-impact` | generic character-centred fallback | toxic impact at cursor, clamped to melee reach |
| Sermon Bell | `sermon-musical-notes` | body | notes at cursor on the descriptor impact beat, clamped to quake reach |
| Tombwarden Claymore | `tombwarden-dark-slash` | blade | dark slash at cursor on impact, clamped to quake reach |
| Hangman's Greatcleaver | `hangman-blood-spatter` | blade | non-gore spatter at cursor on impact, clamped to quake reach |
| Cinderbrand Pike | `cinderbrand-magma-impact` | generic character-centred fallback | magma impact at cursor, clamped to melee reach |

`nullspike-impact-circle` and both `void-caster-explosion` users were already impact semantics; they now
carry the same explicit `impact` classification/target-anchor contract. Void-caster quake art was already
drawn at the clamped quake epicentre.

## Legitimately character/implement anchored

| Classification | Recipes / systems | Why it stays attached |
|---|---|---|
| Projectile impact | `galvanic-blue-burst`, `riftglass-rainbow-volley` | source art starts at the tip; impact packs already spawn where the authoritative projectile ends |
| Weapon motion | `riftcleaver-crystal-shards`, `verdict-tip-procession`, `choir-iron-flame-slash`, `cinderbrand-fire-slash`, `sanctified-holy-slash`, `dustreaper-continuous-edge`, `gravechain-dominant-spin`, `thunderhead-electric-codex`, `quarry-quad-spatter`, `witherleaf-tip-spores`, `snakeoil-tip-sparks` | these are trails, edge accents, or tip sparks describing the moving implement, not a landed hit |
| Character action | `stormfist-blue-lunge` | the blue body accent describes the wielder's lunge |
| Chain path | `whispervolume-page-scatter` | pages occupy the resolved source-to-target chain links |
| Auras/channels | all `WEAPON_AURA_VFX_RECIPES`; caster source recipes; beam charge/channel source art | the gameplay area or cast source is character/muzzle-centred by design; their separate impact art remains target/projectile anchored |
| Warp endpoints | `TESLA_WARP_VFX_RECIPE` | departure belongs at the old character position and arrival belongs at the server-authoritative destination |

The unit gate requires every `WeaponEffectRecipe` to declare one of these classes, requires every `impact`
recipe to use the target anchor, rejects target anchors on non-impact recipes, and catalog-checks the five
owner-named weapons through the common clamp.
