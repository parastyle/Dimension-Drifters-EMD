# Serraketh, the Seam-Eater — flagship modular worm encounter

## Decision

Build the second flagship around **Serraketh, the Seam-Eater**, an extradimensional wyrm that lives in the white seam between worlds and makes a body from whatever dimension it is consuming. It is not a native desert worm or a Neon-Cyber scrap centipede. Its plates contain stolen strata: rusted mesa iron, frozen cathedral steel, mossed temple stone, black basalt, and severed circuit-board traces. This lets the boss belong to the full Dimension Drifters premise rather than one biome in `data/dimensions-design.json`.

Serraketh complements Vastaghar instead of competing with him:

- Vastaghar is vertical scale, one screen-filling lower body, and a repeated footstep rhythm.
- Serraketh is horizontal motion, many independently vulnerable parts, routing, target priority, and a silhouette the squad physically rewrites.
- Vastaghar asks “can the squad master one beat?” Serraketh asks “which organ do we cut, and what anatomy do we want to fight next?”

The player memory should be: **we watched a living chain tunnel under a Scar, cut out its saw-ring, sent the severed tail into a panic, stopped it growing the segment back, escaped a tightening coil through Cover, and finally reduced a dimension-eating wyrm to a furious head-stub.**

## The fight in one sentence

> Read where the Seam-Eater will surface, break the organs that produce the patterns you fear, and prevent its severed pieces from stitching themselves back on.

## Why this is Terraria-style segmentation done better

The encounter keeps the joy of a long modular target without inheriting the common failure modes of a multi-hit worm.

1. **Segments are anatomy, not duplicate hurtboxes.** Breaking one visibly shortens the chain and removes, weakens, or relocates a specific attack.
2. **Piercing does not multiply core damage.** One accepted player attack contributes to shared core HP once per chain; it may still score honest local integrity damage on every segment it overlaps.
3. **A split creates one short co-op problem, not two full bosses.** The head-side chain remains Serraketh. The tail-side chain becomes a time-limited panicked stub with a separate, simple purpose.
4. **Regrowth adds anatomy, never heals the boss bar.** Failure increases reach and restores organs; it does not erase core damage already earned.
5. **Burrowing is traceable.** The moving ground bulge and fixed eruption claim are authoritative, visible, and never an off-screen dice roll.
6. **A shorter worm is not simply a faster, harder worm.** It gains bounded agility but loses reach, projectile sources, quake count, and coil coverage. Cutting it is always a net reward.
7. **There is no recursive worm explosion.** At most one main chain and one severed stub exist, and the encounter has a hard twelve-segment active cap.

## What the shipped framework actually provides

The current boss framework is a strong foundation for casts, but not yet a gameplay-segment system.

- `BossController` owns one boss `EnemyState`, selects phases from `boss.hp / maxHp`, moves that one body, and runs deterministic modules. Each primitive computes its telegraphs and payload together at fixed coordinates. Resolved rows survive at `t = 1` for a broadcast generation; cancellation removes them without a false impact. Serraketh must preserve those truth and cancellation rules.
- `footfallQuake`, `meleeCombo`, landing zones, projectiles, and generic telegraph shapes already provide honest server-owned jump/parry, melee-parry, eruption, and ranged plumbing. Use those where their geometry matches.
- The World-Titan art is multipart, but its synchronization is one root: `world-titan` has `body` and `foot-1` through `foot-4` in the sprite manifest, `SpriteRig` creates them inside one container, and the container follows one interpolated `EnemyState`. Per-foot offsets are client-side procedural flavor; no foot has authoritative position, HP, or topology.
- `EnemyState` has only identity, kind, position, HP, tier, attack sequence, Brand, wind-up, and crit flash. `ArenaState` has one `bossKind`, one `bossPhase`, and a generic telegraph map. There is no parent id, chain id, slot, rotation, armor state, or segment generation.
- Remote enemies use tick-stamped typed-array snapshot rings on the shared 20 Hz timeline with a 120 ms presentation delay. Worm parts should use the same interpolation discipline rather than frame-following an already delayed head.
- The existing `SpatialGrid` is the correct broad phase for projectile, melee, and radius queries. Segment targeting must join a grid-backed query path and must not add a new projectile-by-every-segment scan.
- The wire schema is currently version 15 and field order is protocol. Any authoritative segment contract must be append-only and bump `SCHEMA_VERSION` from 15 to 16 once.

Therefore Serraketh needs a small deterministic **worm encounter director** beside the generic boss machine. It can continue emitting ordinary telegraphs, projectiles, quakes, melee contacts, and XP Echoes through existing room plumbing, but it must own chain topology, segment transforms, split/regrowth state, attack exclusivity, and core-damage deduplication. A pure `BossDef` with independent cooldown modules cannot express this encounter cleanly.

## Authoritative encounter contract

This is design-facing scope, not a request to turn every future boss into a worm.

- Keep one boss core and one boss bar. The head-side chain owns Serraketh's shared HP and phase.
- Append a dedicated stable-id segment collection after existing arena fields. A segment needs, at minimum, chain/slot identity, anatomy class, authoritative position and rotation, active/burrowed state, quantized local integrity/armor state, and a topology/action sequence.
- Use a fixed pool of **12 logical segment slots**. Activate, deactivate, and reclassify stable slots; do not reorder a synchronized array every time a body piece breaks.
- Reset a segment's client snapshot ring on burrow/emerge, split, reattach, or topology sequence change. Never interpolate a severed piece across the arena to its new parent.
- Freeze the encounter's scaled maximum core HP at spawn and synchronize enough information for an honest boss bar. Client lookup of the roster's base HP is not sufficient after player/depth scaling.
- Keep segment art transforms cosmetic inside each segment's root. Gameplay position, orientation, integrity, and active state remain server-owned.
- Reserve segment ids outside generic enemy kill bookkeeping. A broken body piece must not independently open the portal, roll normal loot, clear the boss controller, or count against ordinary horde completion.
- Insert active hurt segments into a grid-backed target index. Dedupe shared-core contribution by attack/projectile/source epoch after exact geometry. Local break damage may apply to multiple honestly overlapped segments; shared HP takes the largest eligible contribution once.
- A player may take at most one body-contact hit from a given chain in a **350 ms contact epoch**, even if several overlapping segment circles touch them. No multi-segment blender deaths.
- The severed stub redistributes existing slots. Regrowth may activate dormant slots but may never exceed 12 active parts across both chains.

The expected wire load is bounded: ten parts at entrance, at most twelve after a failed regrowth, and normally six to eight by desperation. The encounter uses no ordinary adds. Spinner volleys obey the arena-wide hostile-projectile budget of 120 and have a stricter encounter budget of **16 live spinner shards**.

## Fantasy and silhouette

Serraketh eats the boundary between dimensions. Its mouth is a hinged, paper-shear maw rather than a circular sandworm throat. Its neck is an armored registration collar. Each body chamber holds a compressed piece of stolen world. Two toothed shear-rings rotate around the spine and cut new rifts. The tail ends in a long stitch-needle used to close those rifts behind it.

The creature is enormous but fully readable in ordinary camera play: roughly **780–900 px** from maw to needle at ten parts, wide enough to cross a screen without requiring Vastaghar's off-screen framing. The chain is a sequence of overlapping cards with visible joints, not one rubber hose. A destroyed segment disappears from the silhouette; surviving neighbors pull together over 300–450 ms and expose a temporary torn stump cap.

Dimension response is restrained. The base silhouette remains void-charcoal, gunmetal, bone paper, and one rift accent. The current dimension supplies one stolen-material treatment:

| Dimension | Stolen plate read | Accent behavior |
|---|---|---|
| Wild West | Rusted claim iron and dry mesa strata | Amber seam dust and red-rust edge |
| Frostfell | Frozen cathedral steel and fractured blue ice | Cold-cyan seam, frost filaments |
| Verdant Ruins | Mossed jade masonry wrapped in root fibers | Plasma-lime wound shapes, spores |
| Ashlands | Cooled basalt slabs with flat ember fissures | Ember-orange cracks, ash inhale |
| Neon-Cyber | Charcoal riot plate and severed circuit traces | Cyan/magenta trace pulse |

Do not mix five saturated biomes on one sprite. Serraketh wears the dimension it is currently eating; the cross-dimensional idea comes from the reusable anatomy and encounter context.

## Segment anatomy

Entrance topology, from front to back:

`HEAD — NECK — BODY — SPINNER — BODY — BODY — SPINNER — BODY — BODY — TAIL`

That is ten active parts: one head, one neck, five weak body chambers, two armored spinner organs, and one armored tail.

| Class | Combat role | Defense | Local-break consequence |
|---|---|---|---|
| **Rift Maw / head** | Owns shared core, burrow choice, eruption, bite punish | 35% core damage while plated; 135% during a declared exposed-maw window | Never removed before death. At final HP it becomes the panicked head-stub. |
| **Anchor Collar / neck** | Holds head to the train and transmits parry counters | Heavy armor; 15% core damage normally, 75% while cracked after a counter | Cannot be an early easy sever. Once downstream anatomy is sufficiently reduced, breaking it extends the final head punish and removes one quake relay. |
| **Stolen Chamber / body** | Primary weak point and preferred sever target | Unarmored; 100% core contribution | Segment tears away, chain shortens, adjacent links splice, coil reach shrinks. |
| **Shear Ring / spinner** | Fires shard fans and creates Rib Quakes | Closed shell: 20% core. A Rib Quake parry opens it for 2.2 s at 90% core contribution | Destroying it permanently removes one volley origin and one quake from cascade patterns. |
| **Stitch-Needle / tail** | Closes coils, performs the parryable Stitch-Reap, leads a severed stub | 25% core normally. A successful tail parry exposes it for 2.0 s at 100% | Destroying it removes Stitch-Reap and makes every later coil keep a wider escape gap. |

Suggested local integrity, expressed against scaled maximum core HP so party/depth scaling remains coherent:

- Body: **4.5%** each.
- Spinner: **3% shell + 4% exposed organ**.
- Tail: **5.5%**, damage accepted mainly during exposed windows.
- Neck: **5%**, eligible for a true break only after 35% core HP or when four downstream parts are already gone.

Local integrity damage and shared core damage are parallel outcomes of the same hit; destroying a part does not add a second burst of boss-bar damage. This keeps the bar honest and prevents break thresholds from becoming hidden bonus DPS.

### Feedback without six extra health bars

Do not put a nameplate over every circle. Segment condition is visible on the sprite and in the boss bar:

- Intact: clean plate and dark joint.
- Wounded below 55% local integrity: one large high-contrast crack, not progressive texture noise.
- Break-ready below 20%: joint flutters edge-on and sheds one or two inward motes.
- Armor opened: shell petals physically rotate away and the weak rift core becomes visible.
- Boss bar: ten small anatomy notches at entrance. A notch cracks, opens, then tears out. Regrown notches unfold in a paler treatment. The central fill remains shared core HP.

## Movement grammar

The head follows server-authored paths; every live segment trails that path by accumulated arc length. Do not solve the chain as independent chase enemies. The design needs four explicit motion modes:

1. **Surface slither.** A broad S-curve with bounded turn rate. Players can read and flank the line; the worm never pivots every segment around a target in one tick.
2. **Dive.** Head, neck, and each following part pitch into the same entry seam in order. Parts become non-hurting only as their own slot crosses below ground; the chain does not disappear all at once.
3. **Burrow.** No targetable body. A non-damaging painted ground bulge follows the authoritative route. Serraketh may cross beneath pits and POIs because this is underground transit, but the visible bulge remains continuous and the final eruption is placed on validated solid ground clear of POI collision.
4. **Emerge.** The head resolves one red eruption. Surviving parts peel out behind it along the route at 100 ms intervals. Those follow-through appearances are spectacle, not ten stacked AoEs.

Each destroyed segment reduces trail spacing and total length immediately after the tear recovery. Each lost part also adds **4% surface speed, capped at +28%**, but removes its reach/attack contribution. Turn rate and eruption wind-up do not accelerate. The reward remains fewer threats and more open arena, not an unreadable missile-worm.

## Diegetic telegraph language

Every major hit follows the established causal sentence: attacker, painted world consequence, exact thin underlay.

### Burrow dive and eruption

**Attacker claim.** The maw clamps sideways, the Anchor Collar compresses, and the shear-rings tilt into the intended entry axis within the first 80 ms. Each segment then pitches into the seam in order. The body cannot continue an ordinary slither animation through this commitment.

**Painted foreshadow.** Once underground, a raised ridge of cracked floor, lifting pebbles, reverse-falling dust, and short dimensional paper fibers travels over the route. This bulge is intentionally non-damaging and can be irregular. It tells the squad where the creature is, not an exact future hitbox.

**Eruption claim.** The bulge stops. A full **145 px** eruption perimeter appears immediately and remains fixed for a **0.90 s** wind-up. Ground material inhales: frost creeps inward in Frostfell, roots lift in Verdant, embers draw down in Ashlands, dead traces wake in Neon, and dust pulls into a pinched seam in the West. The head silhouette becomes visible as a dark card edge beneath the ground during Lock.

**Truth layer.** The eruption is red/dodge-only. The complete exact circle exists from Claim; `t` drives cadence and edge energy, never radius. Jump height does not negate the eruption because the head and debris travel vertically through the player space. A jump can help reposition, but it is not immunity.

### White counter grammar

White remains a verb, never generic boss brightness.

- **Rib Quake:** a spinner shell plants, the adjacent body cards compress, and the shell rim glints white for the final 150 ms. Stone/ice/root/ember/circuit cracks remain material-colored. The ground wave is jumpable or parryable.
- **Stitch-Reap:** the tail needle draws across the body, tail card bends opposite the swing, and only the needle/edge glints white. It is parryable or dodgeable, but not jump-immune; this is a vertical weapon sweep, not a ground wave.
- **Eruption, constricting body contact, and red maw bites:** never flash white, including their nuke-tier or bright elemental impacts.
- **Spinner shards:** use the existing parryable projectile read on the projectile itself. The entire firing organ does not pulse white unless the incoming contact is actually in a parry window.

### Cancellation and topology changes

A segment break, split, phase change, or death cancels uncommitted casts owned by the affected organ. Their underlays and source poses release without impact. A spinner destroyed at 95% wind-up does not fire a posthumous volley. Committed, already live hazards may finish only if their source-independent geometry is still truthful and the transition script explicitly allows it.

## Arena-zone choreography

Serraketh reads the generated map's three exact macro-regions. It does not assume a hand-authored boss room.

### Commons — teach and regroup

- The entrance and first eruption occur in or just outside the central Commons, where the whole chain can be read without POI occlusion or pit ambiguity.
- The learning coil is wide, C-shaped, and keeps two grounded exits.
- Commons is never permanently occupied. After a major coil or regrowth attempt, Serraketh dives and releases the center for at least one attack card.

### Cover — break sightlines, complicate the route

- Cover is the favorable answer to spinner shard pressure because existing POIs stop projectiles in both directions.
- A Cover coil threads around the outside of two validated POI courts. The worm never visually passes through a landmark and never erupts under one.
- Cover is not a free bunker: the tail gap points through a lane between courts, so the squad must rotate rather than remain behind one object.
- Decorative cracks may run up to a POI base, but exact body/eruption geometry cannot hide under opaque art.

### Scar — dangerous shortcut and regrowth ground

- Scar is the worm's preferred regrowth location: exposed dimensional wounds make the fiction obvious.
- A Scar coil follows the pit spine without turning pit void into a false floor. The worm is never a bridge.
- Every Scar constrict validates **two grounded exits at least three player-bodies wide**. A third, faster escape may cross an already hoppable one- or two-tile pit gap. The choice is safe long route versus mastered jump shortcut.
- The burrow bulge may travel visibly beneath a pit as a rim-to-rim distortion, but eruption and targetable buds always occupy solid, reachable ground.

If a seed cannot satisfy a card's route and clearance contract, choose another zone/card. Never force the geometry into an invalid site because its cooldown came due.

## Attack cards

All timings are multiples of the 50 ms server tick. Damage is base damage before the existing depth multiplier. Only one major card owns the whole chain at a time; a spinner volley may occupy a declared additive slot when it does not contradict the major pose.

### 1. Seam Dive / Mawbreak Eruption — signature movement

- **Dive:** 0.65 s sequential fold, no floor damage after each part submerges.
- **Burrow:** 1.25–1.90 s painted-bulge travel, based on route length.
- **Eruption wind-up:** 0.90 s at one fixed valid point, 145 px radius.
- **Resolve:** 24 damage, 760 knockback, red/dodge-only.
- **Punish:** maw remains open for 1.35 s at 135% core contribution. If the eruption catches nobody, extend to 1.70 s.
- **Better play:** the Focus player routes the fixed eruption away from teammates and toward the side of the chain they want exposed.

### 2. Rib Quake — spinner counter lesson

- **Source:** one surviving spinner; alternate organs rather than choose randomly.
- **Wind-up:** 0.80 s; 250 px radius.
- **Resolve:** 22 damage, 850 knockback, ground-only white quake.
- **Response:** jump for reliable safety, or parry for offense.
- **Parry payoff:** negate the hit for that player, feed normal parry response, snap the spinner shell open for 2.2 s, and send a visible counter ripple one segment toward the head. Two spinner parries within 4 s also expose the maw for 1.0 s.
- **Jump payoff:** safe repositioning only. The shell remains closed, preserving the reliable-versus-greedy choice.

### 3. Stitch-Reap — tail parry and coil control

- **Wind-up:** 0.55 s planted tail draw.
- **Geometry:** 230 px melee wedge, 0.80 rad half-arc.
- **Resolve:** 18 damage, 520 knockback, white/parryable.
- **Response:** leave the wedge, cross behind the tail root, or parry. Jumping in place does not grant immunity.
- **Parry payoff:** tail is exposed for 2.0 s and the next coil gap gains an additional 90 px even if the tail survives.
- **Break payoff:** remove Stitch-Reap and permanently widen all coil exits.

### 4. Shear Bloom — destructible ranged pressure

- **Source:** each surviving spinner may emit one six-shot fan, but the two fans are staggered by 0.45 s.
- **Wind-up:** 0.65 s with the shell teeth opening and a short weapon-like glint in the dimension accent, not white.
- **Projectiles:** six parryable shards, 7 damage, moderate speed; encounter cap 16 live shards, arena cap 120 still authoritative.
- **Response:** use Cover, thread the fan gap, or parry individual shards.
- **Break payoff:** every dead spinner removes its entire six-shot half of the card. The card disappears when both are gone; it is not replaced by a generic radial burst.

### 5. Closing the Loop — zone-aware coil/constrict

- **Formation:** 1.60 s surface slither along a validated C-shaped spline. The future chain ribbon is dimly painted from Claim; segment bodies remain the exact live contact truth.
- **Lock:** 0.50 s. Tail and head face the escape gap; it cannot silently relocate after Lock.
- **Constrict:** 2.40 s, loop radius contracts by up to 170 px. The body is red contact danger and uses the chain-wide 350 ms hit epoch.
- **Responses:** exit through the visible gap, rotate through Cover lanes, or take a Scar jump shortcut. Crossing a body is an emergency damage trade, not a hard collision prison.
- **Counter:** a Stitch-Reap parry during formation stalls contraction for 0.80 s and exposes the nearest weak chamber.
- **Topology payoff:** fewer segments mean less circumference. The director must enlarge the missing arc, not stretch surviving segments to fake the old coverage.

### 6. Ribfall Cascade — learned jump/parry rhythm

- **Use:** Phase II onward, after Rib Quake has been shown alone.
- **Pattern:** surviving spinners and the neck relay fire ground quakes sequentially from tail toward head, never simultaneously.
- **Cadence:** 0.75 s between contacts, respecting jump and parry cooldowns.
- **Count:** one per surviving source, maximum three. Destroyed sources genuinely shorten the sequence.
- **Final payoff:** parrying the headward final contact exposes the maw for 1.25 s. Jumping all contacts is valid but earns no exposure.

### 7. Graft Hunger — authored regrowth urgency

- **Trigger:** once at 45% core HP, after the current card recovers.
- **Setup:** Serraketh dives to a valid Scar site and emerges in a planted feeding pose. The head remains damageable; the chain stops major attacks for 5.50 s.
- **Buds:** three targetable regrowth buds unfold on solid ground along the visible future chain path; solo spawns two. Each has modest local integrity and a full clear silhouette.
- **Pressure:** one surviving spinner may fire a reduced four-shot fan every 1.8 s. No eruption, coil, or quake overlaps the decision.
- **Choice:** damage the exposed maw for core progress, or destroy buds to keep the worm short. Co-op can split jobs.
- **Resolve:** each surviving bud activates one dormant weak Body slot. A severed stub that escaped guarantees one additional body slot, still under the twelve-part cap.
- **Fairness:** regrowth restores anatomy only. It never heals shared core HP, respawns a destroyed spinner/tail, or pays repeatable loot.

### 8. Severed Hunger — the one split event

When an interior Body chamber tears at or below the 70% transition, the tailward pieces become a **Severed Hunger** stub. It is deliberately asymmetric:

- The head-side chain remains the boss and keeps the boss bar.
- The stub consists of the surviving tailward parts, led by its nearest spinner or tail. It has one small integrity pool based on those parts and no separate boss bar.
- For **8.0 s**, it surface-slithers in a broad predictable loop and uses only a delayed Stitch-Reap or one reduced shard fan. It cannot burrow, coil, regrow, or split again.
- The main chain stays partly emerged and uses only a slow, non-damaging ground-bulge feint. The squad can focus on the stub without two simultaneous flagship kits.
- Killing the stub tears all of its parts into locked segment Echoes, permanently denies their reattachment, and gives a 1.2 s open-maw punish on the main chain.
- If the timer expires, the stub dives through a clearly marked escape seam. It does not teleport back on. Its escape becomes one guaranteed extra Body during Graft Hunger.
- In solo, the main chain is fully dormant during the hunt. In co-op, it may turn and track the Focus player but cannot resolve damage.

This is the fight's signature cooperation beat: one or two players keep position on the exposed head while the rest butcher the panicked tail, but either job can be abandoned and regrouped without an instant wipe.

## Phase arc

### Entrance — The Margin Opens, 0.00–3.60 s

1. A thin black crease tears across the edge of the Commons. Exact combat markings remain live above it; this is not a cutscene.
2. The Rift Maw unfolds edge-on, bites the crease wider, and the ten body cards peel out one by one at 90 ms intervals.
3. The title appears only once the tail needle clears the seam: **SERRAKETH — THE SEAM-EATER**.
4. Input remains active. The boss is untargetable only until the head and first weak Body are fully visible.
5. First card is always one wide Commons Seam Dive with a long bulge route and a generous eruption punish.

### Phase I — Read the Body, 100–70%

Purpose: teach that the moving bulge predicts the head, body chambers are weak, white ground contacts permit jump/parry, and spinner/tail organs can be disarmed.

Suggested deck:

1. Seam Dive / Mawbreak Eruption.
2. One isolated Rib Quake.
3. Surface pass with one staggered Shear Bloom.
4. Stitch-Reap.
5. Wide Commons Closing the Loop, only after Stitch-Reap has been seen.

At least 55% of this phase's damageable time places a weak Body or declared open organ within ordinary melee reach. Do not make a modular boss spend the lesson permanently underground.

At 70%, finish the active recovery and begin the split transition. If players already destroyed an interior chamber, use its existing torn seam. If not, the lowest-integrity weak chamber becomes break-ready and the next accepted hit tears it; the boss bar does not hide an invulnerable floor.

### 70% transition — The Bad Cut, up to 9.50 s

The selected chamber turns edge-on, stretches like wet paper, and tears across the spine. The two chains recoil in opposite directions. Run Severed Hunger for up to 8.0 s, then give 1.2 s of main-maw punish whether the stub died or escaped. All old rows owned by the severed organs cancel cleanly.

### Phase II — Choose the Anatomy, 70–35%

Purpose: turn the learned pieces into routing and co-op priority decisions.

- Add Cover and Scar variants of Closing the Loop.
- Add Ribfall Cascade, with count derived from surviving organs.
- Allow Seam Dive to lead directly into a Cover or Scar coil, but never overlap two major danger windows.
- Run Graft Hunger once at 45%.
- If a spinner is destroyed, visibly remove its half of Shear Bloom and its beat from Ribfall. If the tail is destroyed, widen every coil. The encounter must not quietly substitute attacks to keep its original DPS budget.

The phase is successful when different squads produce visibly different worms: a projectile-heavy long chain, a short chain with an intact dangerous tail, or a toothless but mobile head-side train.

### Phase III — Nothing Grows Back, 35–8%

Purpose: pay off every sever and make the remaining anatomy desperate without invalidating prior mastery.

- Disable all regrowth.
- Burrow routes shorten, but the 0.90 s fixed eruption warning remains.
- Surface speed receives the bounded missing-segment bonus; attack wind-ups do not tighten.
- Alternate one major movement card with one surviving-organ card. A long intact worm has more coverage; a heavily cut worm has more speed but far fewer beats.
- The main chain may shed nonfunctional tailward scraps when their parent link breaks, but those scraps are paper/VFX only and never become extra attackers.
- If only head and neck remain, enter **Panicked Stump**: wide surface lunges, one Rib Quake relay, and frequent open-maw recoveries. No projectiles, coil, or surprise replacement move.

### Desperation — Swallow the Page, 8–0%

Serraketh makes one last readable attempt to consume the Commons:

1. **0.00–1.60:** surviving segments form the widest C they can honestly reach. Missing anatomy is a huge visible gap.
2. **1.60–2.35:** each surviving quake source fires toward the head on the known 0.75 s rhythm. These are white, jumpable/parryable contacts.
3. **2.35–3.25:** the maw claims a fixed 170 px red bite/eruption at the center edge of the C. Full perimeter is visible for 0.90 s.
4. **3.25–4.75:** the maw remains fully exposed. No new major cast begins. Players finish the fight or the sequence resets to a simpler Seam Dive; it does not loop the whole spectacle.

All remaining parts stay targetable during formation. A late segment break enlarges the escape gap and cancels only that organ's unresolved contact. Mastery changes the finale in real time.

## Co-op roles without class locks

The topology naturally creates four soft jobs:

- **Router:** holds Focus and places the next fixed eruption in open Commons ground or on the safe side of a Scar, exposing the desired flank.
- **Butcher:** prioritizes cracked Body chambers and open organs, usually with short-range or high local-break damage.
- **Counter:** takes the high-value tail/spinner angle and converts white contacts into organ exposure.
- **Wrangler:** peels to the Severed Hunger or regrowth buds while keeping an escape route back to the squad.

Focus rotates after two consecutive major cards on one player, on down, or when that player enters a level-choice window. It never switches after Lock. In four-player play, the two-chain transition may spatially separate roles; outside that event, no card requires the party to stand in four assigned quadrants.

Solo adjustments:

- Two regrowth buds instead of three.
- Main chain deals no damage during Severed Hunger.
- Stub integrity is 65% of co-op baseline.
- Only one spinner fan may be live at a time.
- Every coil keeps two grounded exits even if a Scar jump shortcut exists.

Player-count scaling remains primarily boss/core and local-integrity HP. Do not multiply segment count, quake count, or projectile count by players.

## XP Echo payoff and anti-interruption rule

The reward budget is **110 XP at depth 1 before any future depth reward policy**: up to 35 represented by anatomy breaks and 75 in the final core. This matches flagship scale without making repeated regrowth an XP farm.

- Every first-time logical segment break produces a real, high-salience XP Echo at the tear point. Body chambers represent 3 XP, spinners 5, tail 5, and the Severed Hunger completion fills the remaining segment escrow up to 35.
- Regrown slots do not mint a second reward token. If broken again, their tear feeds value already escrowed in the finale rather than creating new XP.
- Segment Echoes visibly pop, settle, and remain on the field as trophies, but are **encounter-locked**: they cannot latch or grant during active combat. The current level-up window freezes and untargets a player, so immediate segment grants would randomly remove participants during the flagship dance.
- On boss death, cancel all danger first. The segment Echoes unlock and stream toward living players in chain order, then the 75-XP maw core launches as one reserved highest-tier Echo. Existing room/collector launch caps braid the stream rather than producing a single opaque flash.
- Unbroken segment escrow folds into the maw core. The squad earns the same total for killing Serraketh; cutting parts changes the fight and the celebration, not the run's total XP.
- Portal, guaranteed boss loot, and boss-rush advance wait for the defeat cleanup contract already used by bosses. No segment may trigger them.

This gives every cut an immediate tactical and visual payoff while keeping XP delivery in one safe reward sentence.

## Paper-cutout spectacle

Paper behavior should clarify topology, not beige-wash the art.

### Entrance

- The world seam is a narrow crop/crease, not a full-screen transition.
- Head and segments begin at near-zero signed scale on the spine axis, flip through edge-on, and settle with the existing paper-pop overshoot.
- The sequential unfold teaches that every card is a discrete body part before the player fires once.

### Segment break

- The breaking segment holds for 70 ms at its final hit pose, turns edge-on, then tears into two planar scraps that peel away from the spine.
- Neighboring parts recoil, reveal front/rear stump caps, then splice over 300–450 ms. Their authoritative roots move normally; presentation error is folded through their segment snapshot offsets rather than tweening gameplay positions.
- Cap full tear treatments at two simultaneous parts. Additional same-frame breaks use a short edge-on fold plus scraps so an AoE build cannot allocate an unbounded paper storm.
- The locked XP Echo rises from the negative space left by the card, making the reward literally occupy the removed anatomy.

### Split and regrowth

- The 70% sever pulls the two chain halves apart like a ripped strip. Use a thin crease aligned to the broken spine for 120 ms; do not freeze or fold the whole world.
- Regrowth buds begin as narrow curled strips. A surviving bud unfolds into a pale new Body card and joins at the exact dormant slot. It must not cross-fade from nothing or pop in fully formed.
- A killed bud crumples inward toward its locked Echo; it does not play a boss-scale death.

### Death

1. All telegraphs cancel and segment contact turns off on the authoritative death edge.
2. A pull travels tail-to-head: surviving cards rotate edge-on in sequence and collapse into the maw's void.
3. At 140 ms, play one `void-implosion` behind the silhouette; loose segment Echoes lift but remain readable in front.
4. At 300 ms, the armored head tears into upper/lower paper jaws.
5. At 360 ms, play the encounter's only `nuke` pack behind those jaws. Keep NORMAL smoke/debris behind the reward stream and the additive crest under 300 ms.
6. The XP chain flies, the core follows, boss loot becomes visible through the clearing smoke, and the portal/rift choice opens.

Routine eruptions use `quake-burst` at restrained radius. Spinner breaks use small dimension-appropriate shards. Regrowth uses inward motes and no hero pack. `nuke` is death-only.

## Audio and impact hierarchy

- Burrow bulge: low filtered scrape that pans with the authoritative bulge; no impact transient.
- Eruption Lock: rising paper-tension creak plus material inhale; resolve uses one deep body hit and the existing quake language.
- Rib Quake glint: short bright tick exactly 150 ms before contact; success uses the existing parry response, never the glint sound.
- Segment wound: dry plate crack. Segment break: distinct paper rip plus a descending joint snap.
- Stub escape: receding stitch-machine chatter, clearly a failed objective rather than a death.
- Regrowth resolve: one wet paper-unfold thrum per surviving bud, staggered by 100 ms.
- Death: scrape drops out at the authority edge, then void pull, jaw tear, delayed nuke body, and a clear tonal XP receipt.

Camera shake follows meaning: none for bulge travel, light for a segment break, medium for eruption, and one strong bounded death impulse. Repeated Rib Quakes must not keep the camera shaking for more than 20% of a rolling ten-second window.

## Sprite art list for Codex image generation

Render **individual modular source images**, never a completed worm or spritesheet montage. Generate the intact master for a class first, then use image editing to create damage variants while preserving canvas, silhouette, pivot, connector positions, and lighting.

### Shared render specification

- 512 × 512 source canvas per asset; export each role as its own PNG after chroma removal.
- Flat fully opaque `#00ff00` field, no floor, shadow, particles, text, UI, or environmental background.
- Creature spine runs horizontally through `y = 256`; front/head direction is RIGHT.
- Three-quarter top-down view suitable for rotation in a top-down Phaser scene. Show enough top plane to read armor and cracks; avoid a pure side profile.
- Front and rear connector centers remain at the same authored points across every two-ended segment. Use overlapping registration collars so neighboring cards can overlap 12–16% without green gaps.
- HD 2D cel-shaded cutout look, not pixel art: bold simple silhouette, one heavy slightly uneven black outline, flat base + one shadow band + at most one hard highlight per material.
- Approximately 5–6 colors: void-charcoal, gunmetal, bone/off-white paper, one dimension material color, one rift accent, optional wound dark. No soft gradients, photoreal texture, bloom, or baked glow.
- Solid bright seam shapes may read as lit by contrast but must not radiate.
- Original and trademark-distinct. Do not imitate Terraria's Eater/Destroyer silhouettes, Dune sandworms, or a real centipede.

### Canonical identity prompt

> Serraketh, the Seam-Eater — an original extradimensional armored wyrm built from separate paper-cutout body cards, with a sideways hinged shear-maw, registration-collar joints, stolen world strata trapped inside its body chambers, rotating toothed shear organs, and a long stitch-needle tail. Void-charcoal and gunmetal armor over bone-paper inner layers, one flat rift accent, broad readable shapes, grim HD cel shading, heavy black contour, no legs, no generic round sandworm mouth, no baked VFX.

### Required segment assets

| Asset id | What to render | Variant constraints |
|---|---|---|
| `seam-eater-head-armored` | Oversized wedge head, sideways upper/lower shear jaws closed around a dark seam, armored brow, one small asymmetric rift eye, rear neck connector only | Strong right-facing silhouette; mouth plates hide the core |
| `seam-eater-head-exposed` | Same head and exact bounds, jaws sprung open around a torn off-white rift core | Edit from armored master; do not enlarge reach or move rear connector |
| `seam-eater-head-critical` | Same exposed head below 8%, missing brow corner and one large readable crack | No extra gore/detail; silhouette difference must survive game scale |
| `seam-eater-neck-armored` | Short heavy registration collar with layered locking plates, two connectors | More armored and compact than Body; no weapon teeth |
| `seam-eater-neck-cracked` | Same collar with plates shifted and one visible inner paper ligament | Exact anchors and silhouette footprint preserved |
| `seam-eater-body-intact` | Broad stolen-world chamber, overlapping dorsal plates, visibly softer off-white seam membrane at center | Primary weak-point silhouette; less armored than neck/spinner |
| `seam-eater-body-wounded` | Same body with one huge diagonal plate crack and exposed rift membrane | Edit master; one decisive crack, not noisy damage texture |
| `seam-eater-body-regrown` | Same anchors and collision silhouette, paler folded plates and curled edge tabs | Reads fresh/unstable without transparency or glow |
| `seam-eater-spinner-closed` | Thick armored body ring with six blunt shear teeth folded backward around the spine | Teeth stay inside authored collision silhouette while closed |
| `seam-eater-spinner-open` | Same spinner with shell petals and teeth rotated outward, exposing a bright flat rift bearing | Edit master; exposed state may widen visual only within declared gameplay radius |
| `seam-eater-spinner-wounded` | Open spinner with two broken teeth and one large bearing crack | Preserve connector points and outer bounds |
| `seam-eater-tail-armored` | Tapered tail card ending in a long flat stitch-needle laid along the spine | Needle reach and pivot must match the intended melee geometry |
| `seam-eater-tail-exposed` | Same tail with needle guard split and paper ligament visible | Edit master; no white baked onto the needle—the parry glint is engine VFX |
| `seam-eater-stump-front` | Small torn front-facing connector cap for the headward side of a break | Off-white fibrous paper center, dark registration rim |
| `seam-eater-stump-rear` | Matching rear-facing connector cap for the tailward side | Must overlap every neck/body/spinner connector cleanly |
| `seam-eater-regrowth-bud` | Compact curled strip/bud containing a tiny folded body plate | Targetable object, strong simple silhouette, not an enemy egg cliché |
| `seam-eater-regrowth-bud-wounded` | Same bud partly uncurled and split | Exact footprint preserved for truthful damage state |

### Dimension material passes

After canonical geometry is approved, edit `body-intact`, `body-wounded`, and the broad plates of head/spinner into five same-anchor material passes:

- Wild West: rusted claim iron, dry ochre strata, amber seam.
- Frostfell: steel-grey cathedral plate, glacier-blue ice, cold-cyan seam.
- Verdant Ruins: mossed jade stone, olive root binding, plasma-lime seam.
- Ashlands: black basalt slabs, dull-red shadow, flat ember-orange fissure.
- Neon-Cyber: charcoal enforcement plate, gunmetal collar, cyan/magenta circuit break.

Do not regenerate geometry separately for these passes. Use edits of the approved master so a material skin cannot change combat silhouette or connector alignment.

### Optional painted ground sources

If bespoke paint is preferable to composing the installed packs, render these as separate transparent-ready decals with no exact boundary baked in:

- `seam-eater-burrow-bulge`: elongated raised ground ridge with inward cracks and lifted debris, neutral enough to tint per dimension.
- `seam-eater-entry-seam`: narrow torn slit with paper fibers pulled underground.
- `seam-eater-eruption-claim`: irregular inward cracks and pebbles, explicitly decorative and intended to sit inside the exact 145 px perimeter.

These never replace the authoritative thin edge.

## Tuning locks and budgets

- Starting topology: 10 active parts.
- Hard active topology cap: 12 across main chain and stub.
- Starting core HP target: **1,500 base** before existing player/depth scaling; tune after time-to-kill tests, not by adding parts.
- Total depth-1 XP target: 110, fixed regardless of regrowth outcome.
- One major whole-chain card at a time.
- Maximum simultaneous telegraph claims: one major footprint plus up to two source-local organ tells.
- Maximum live spinner shards: 16; maximum per fan: 6.
- No ordinary add summons and no replacement horde during the encounter.
- Eruption fixed warning: 0.90 s in every phase.
- White contact glint: final 0.15 s, server-tick aligned.
- Ribfall cadence: 0.75 s.
- Contact damage: one hit per player per chain per 350 ms.
- Regrowth: one authored attempt at 45%; no core healing; no spinner/tail resurrection.
- Split: once; one stub; no recursive split.
- Missing-segment speed bonus: +4% each, +28% cap; no wind-up acceleration.
- Camera remains player-following. No hard arena-center lock or zoom that loses co-op bodies.

## Ship gates

### Anatomy truth

- Destroying each class changes both silhouette and its promised mechanic.
- A dead spinner never fires or contributes a quake. A dead tail never Stitch-Reaps. Missing Body length becomes real coil gap.
- One piercing projectile or wide melee attack cannot multiply shared-core damage across segments.
- One player cannot take stacked contact damage from overlapping segments in one chain epoch.
- Split/regrowth never exceed twelve active parts or create generic boss-death/loot side effects.

### Telegraph truth

- Burrow location is continuously visible; eruption point is fixed before the 0.90 s claim begins.
- Complete eruption/quake/melee/coil boundaries appear on the first observed cast patch and match server geometry.
- Source pose, world paint, exact edge, audio rise, and hit share the same authoritative clock.
- A destroyed source cancels its unresolved attack without an impact flash.
- White appears only on valid parry contacts. Eruption and body constrict remain red even when their VFX are bright.

### Zone and reachability

- Every selected eruption/bud is solid, reachable ground clear of POI collision.
- Cover blocks spinner projectiles honestly and never hides exact worm contact under an opaque landmark.
- Every Scar coil has two wide grounded exits; a pit hop is a bonus route, never the only route.
- The boss never becomes a bridge over a pit.

### Network and performance

- Segment position/rotation renders from tick-stamped typed-array rings and resets cleanly on topology changes.
- Ten-to-twelve moving parts plus sixteen shards stay within patch, object, and frame budgets in four-player horde-stress conditions.
- Segment hit queries use a spatial broad phase and stable dedupe; no new projectile × all-segments × all-enemies loop.
- Synced fields are appended, schema version is bumped once, and stale-client handshake behavior remains explicit.

### Encounter quality

- After one exposure, players can name Body, Spinner, and Tail and predict what each break removes.
- At least two viable cut orders emerge in four-player tests; one universal “always kill this first” order means organ tuning is too lopsided.
- The 70% split causes a clear temporary team choice without feeling like two bosses.
- Regrowth creates urgency without feeling like HP rollback.
- A heavily severed worm is easier overall but still animated and dangerous, not a motionless loot piñata.
- Segment Echoes visibly record the squad's cuts and never open a level-choice window mid-attack.
- Death cleanly transitions from danger to paper collapse to Echo stream to loot/portal.

## Explicit cuts

- No two equal boss bars after the split.
- No recursive splitting into many worms.
- No core healing from regrowth.
- No per-segment normal loot rolls or repeatable XP farming.
- No damage from the decorative traveling ground bulge.
- No ten simultaneous eruption circles when the chain emerges.
- No hard body collision that can imprison a player inside a closed coil.
- No multiplying shared damage through pierce, explosions, or wide melee.
- No white flash on red eruption, bite, coil, or nuke effects.
- No full-screen paper transition during active play.
- No routine `nuke`; reserve it for death.
- No single combined worm render. Every anatomy class and damage state is a separate modular sprite with fixed anchors.

Serraketh succeeds when the health bar is only half the story. The other half is lying across the arena in torn cards: the missing spinner that no longer fires, the tail the parrier opened, the stub the squad failed to catch, the pale chamber it grew back, and the widening gaps that prove the players—not a phase script—decided what the final monster became.
