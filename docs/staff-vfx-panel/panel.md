# Staff VFX Panel

Owner order, verbatim: “I want a panel of Sols on creating bespoke VFX for the staves, right now they're almost all 'shoot a tiny monocolor dot', not something befitting of a mage.”

## Ground-truth audit

The checked-in catalog contains **99 caster weapons**: the two active hand-authored staves plus 97 generated expansion weapons. The authored taxonomy is 7 elements and 18 family strings:

- elements: arcane 13, fire 16, frost 11, holy 13, shock 20, toxic 13, void 13;
- families: almanac 1, bestiary 1, chapbook 1, compendium 1, focus 8, gauntlet 20, grimoire 5, ledger 1, manuscript 1, orb 12, psalter 1, relic/totem 19, rod 1, scepter 5, spellbook 3, staff 9, tome 4, wand 6;
- delivery: beam 21, melee-arc 46, melee-slam 22, projectile 10.

That means “staff VFX” must cover the entire caster class, including books, foci, relics, and spell-gauntlets. The renderer may normalize those 18 content families into a smaller visual-form vocabulary, but it may not exclude any caster row.

### Why the dot happens

The two hand-authored casts are reduced on the server to the same visual kind, `orb:<element>` (`packages/server/src/rooms/GameRoom.ts:9891-9930`). On the client, `packages/client/src/scenes/arena/projectile-factory.ts:24` maps every `orb` to one generic `GunFx`; `makeBullet` at `packages/client/src/scenes/arena/projectile-factory.ts:208-210` then renders the same three concentric circles for every orb. The predicted source cue is likewise explicitly a “small arcane flash” in `packages/client/src/scenes/ArenaScene.ts:9549-9566`. There is no per-weapon caster VFX spec or resolver in those paths. Element suffixes recolor the generic result, but cannot change its silhouette, cast grammar, trail, impact, grade, or family identity. That is the precise source of “tiny monocolor dot.”

### Existing instruments to reuse

- The painted particle factory is already preloaded by `ArenaScene`. The owner's 48-pack reference describes an earlier 8 × 6 program; the current `packages/client/src/vfx/particle-manifest.ts` has grown to **96 packs (12 elements × 8 shapes)**. `elementPack()` and `particleBurst()` in `packages/client/src/vfx/particles.ts` provide the element-safe access seam. This pass needs only the existing bolt, mote, orb, ring, shard, spark, splat, and wisp vocabulary—no new bitmap assets.
- `packages/client/src/vfx/BeamRenderer.ts` already owns authoritative beam width/length, pooled ropes, charge/ignite/sustain/release phases, element paint, and bounded retained objects. Caster recipes should ornament its source glyph, never replace or fork beam truth.
- The flourish framework in `packages/client/src/sprites/pose-language.ts` and `packages/client/src/entities/SpriteRig.ts` already has magic-specific focus/tome poses, after-attack flourishes, page scheduling, and a reduced-motion sampling path. Casting should arm those existing channels instead of inventing a parallel body-animation clock.
- The ultimate quality bar is staged anticipation → execution → aftermath, with body-first posing, element-shaped material, one readable core, optional painted punctuation, and strict protected-depth discipline (`packages/client/src/vfx/ultimate-vfx.ts` and `docs/ultimate-panel/vfx-director.md`). Ordinary casts should borrow the grammar at a smaller scale, not borrow ultimate-sized noise.
- The drift-katana treatment demonstrates the desired content strategy: shared family machinery plus a small explicit adopter/signature table. A recipe identity can be systemic while selected weapons still receive memorable authored punctuation.

## Position paper 1 — The Visionary

Powerful ARPG casting is not primarily “more particles.” It is a legible transfer of authority from the character into the world.

PSO2-class casting sells charge and release through the whole silhouette: hands and implement claim space before the projectile exists. Hades makes effects readable through decisive shape language and extremely clean anticipation/payoff timing. Path of Exile-class spells make material identity persist through the complete journey—source, travel, contact, and residue belong to the same element. The common lesson is continuity. A fire spell cannot become an arbitrary orange bead between an excellent pose and an excellent explosion.

Every Dimension Drifters cast therefore needs four connected beats:

1. **Claim:** a short cast circle, glyph, page fan, halo, or line appears at the implement as the body commits.
2. **Carry:** the projectile has an element-colored hot core, a family silhouette, and a velocity-aligned trail. Even a fast bolt occupies a readable length, not a pinprick.
3. **Answer:** contact opens into a blossom whose radius and particle weight reflect damage tier.
4. **Recover:** the existing arm/body flourish completes the sentence. It is a tasteful hand turn, staff catch, tome page, or focus settle—not a victory dance after every click.

The family silhouette is more important than another color. Staves draw circles and stable axes; lances inscribe a straight claim on space; tomes emit leaf/page shapes; codices build squared or diamond glyphs; orbs carry rings; relics stamp wards; gauntlets punch compact sigils. Element then chooses the material inside that silhouette. Grade controls finish: extra lip, secondary ring, or a few additional painted fragments—not gameplay-looking size inflation.

Six signatures should prove the ceiling. Arcanist's Lance must leave a ruler-straight arcane line. Codex of Forked Tongues should kick loose two page leaves. Null Grimoire should travel through a hollow square aperture. Sunmote Reliquary Staff should crown its source with a solar halo. Mesa-Spine Thunder Stave should fork a restrained lightning crown. Obsidian Maw Void-Staff should close two dark “jaw” wedges at impact. These touches are recognizable at combat zoom and still use the common recipe grammar.

## Position paper 2 — The Systems Designer

Ninety-nine bespoke implementations would make the first screenshot impressive and the hundredth balance/content edit unsafe. The stable unit is a **resolved recipe**, derived from existing `WeaponDef` truth:

```text
weapon tags/name + damage sources
        │
        ├── element (7 caster palettes/material packs)
        ├── form (staff/tome/codex/lance/orb/focus/relic/gauntlet)
        └── grade (adept/master/pinnacle from INT scaling)
                    │
                    └── optional signature override (6 ids)
```

Element selects palette and painted particle family. Form selects source glyph, projectile geometry, trail profile, impact petal geometry, and flourish flavor. Grade selects bounded polish counts and line weights. A separate damage tier—computed from the weapon's authored cast/gun/scatter/quake/chain/beam source—sets impact scale. Grade must not pretend to be hitbox size, and visual impact must not alter damage.

The resolver should return `undefined` for non-casters and a frozen, explicitly non-default recipe for every caster. It should never rely on a 99-row mapping. The only id-keyed data is the six-entry signature table. Semantic normalization handles generated family proliferation:

- `lance` words → lance;
- codex/codicil/manuscript/ledger/compendium words → codex;
- book families and book words → tome;
- staff/stave/rod/scepter/wand → staff;
- orb/globe/marble/sphere → orb;
- relic/totem/censer/idol/reliquary → relic;
- gauntlet/glove/mitt/fist/bracer → gauntlet;
- remaining focus implements → focus.

Runtime layering should be narrow:

- predicted/accepted cast source: one procedural `Graphics` glyph plus a bounded painted burst;
- authoritative projectile row: at most four child objects (trail, glow/body, hot core, optional painted frame/signature geometry), with no per-frame particle emitter;
- authoritative projectile removal: one procedural blossom plus a bounded painted burst;
- beam: retain the existing pooled renderer and draw the recipe's glyph into its existing retained source graphics;
- body: arm the existing after-attack flourish/page mechanism. Rapid fire naturally postpones the recovery flourish until the actor becomes quiet.

The appended resolver test is the catalog tripwire: enumerate all `WEAPONS` where `classPool === "caster"`, assert the census remains 99 for this branch, and assert every id resolves a non-default recipe with valid element/form/grade/source/projectile/impact fields. Future content can grow the catalog without adding renderer code.

## Position paper 3 — The Performance Skeptic

This feature must add **zero server entities, zero schema fields, zero messages, and zero damage decisions**. The server already admits only 8 action messages per player per 20 Hz tick (`packages/shared/src/constants.ts:228-235`), caps enemies at 80 and XP Echoes at 48 (`packages/shared/src/constants.ts:384,419`), and caps hostile boss projectiles at 120 (`packages/shared/src/constants.ts:751`; admission in `packages/server/src/rooms/GameRoom.ts:9751-9759`). Friendly projectiles remain TTL/rate-bounded but do not have a hard arena-wide cap—the existing condition only rejects at the hostile budget. This pass must report that fact, not disguise it with a new client/server fork.

The visual budget is consequently event- and row-based:

- **Persistent projectile cost:** maximum four child objects per authoritative projectile, no child emitters, no per-frame allocations, and no independent lifetime. The container dies exactly when its server row disappears.
- **Punctuation admission:** maximum 8 new caster punctuation events and 24 painted caster particles in one render frame. Procedural core glyph/blossom remains readable when the painted allowance is exhausted. This is deliberately close to the existing telegraph cap (12 retained images, 18 particles/frame) and below the global ten-pack composer budget because this pass does not call full packs at all.
- **Per event:** normal cast ≤6 painted particles, reduced motion ≤2; impact ≤8 normally and ≤2 reduced; lifetimes 180–460 ms. Signatures spend from the same allowance.
- **Beam cost:** no new rope or state row. Recipe glyph lines are drawn into the BeamRenderer's already-retained `Graphics` object.
- **Motion/accessibility:** reduced motion removes orbit, rotation, pulsing, satellites, and page drift; it keeps a static source mark, hot projectile silhouette, short trail, and quick impact ring so combat information does not disappear.
- **Depth:** ground flourish stays below danger truth; airborne caster decoration stays below the protected tell/HUD bands. No camera shake or hit stop is added to routine spells.

The dangerous implementation would call `particleBurst()` on every projectile every frame. The approved implementation uses the painted pack as a static body frame and spends particles only at source/impact edges. Four players can fill the screen with magic without multiplying network load or turning each server projectile into an unbounded particle emitter.

## Panel decision

Adopt an **element × form × grade recipe resolver**, with damage-tier impact scaling and exactly six signature overrides. Apply it to every caster weapon, not only ids containing `staff`.

The implementation contract is:

1. Every caster resolves a non-default immutable recipe; non-casters do not.
2. Every caster attack gets a family glyph/source punctuation and uses the existing flourish system for recovery/body readability.
3. Every caster-owned authoritative projectile uses the recipe body/trail and receives the recipe impact blossom when its row disappears. Damage, collision, trajectory, and lifetime remain server truth.
4. Beam weapons keep the six-track BeamRenderer and gain only their recipe-driven source glyph.
5. Reduced motion preserves static shape and timing while removing decorative travel/orbit.
6. Painted packs are bounded accents; procedural geometry is the never-missing readability layer.
7. The six signature passes are:
   - `x-staff-arcane-lance` — **arcane lance line**;
   - `x2-codex-of-forked-tongues` — **forked page flutter**;
   - `x2-null-grimoire-of-the-hollow-page` — **hollow-page aperture**;
   - `x2-sunmote-reliquary-staff` — **sunmote corona**;
   - `x2-mesa-spine-thunder-stave` — **mesa lightning crown**;
   - `x2-obsidian-maw-void-staff` — **obsidian maw**.

This is the same quality model as the drift-katana reference: systemic coverage first, then a deliberately small signature roster that shows how far the system can bend without becoming 99 one-offs.
