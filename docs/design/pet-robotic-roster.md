# Robotic Pet Roster and Evolution Recast

## Mandate and working understanding

This document recasts the complete pet roster and its three evolution bands under the binding owner direction that every pet must read as **built, not grown**. Pets are mechanical companions—drones, constructs, automatons, and little robotic critters—with unmistakable manufactured signatures such as articulated joints, fitted plating, luminous optics, antennae, vents, rotors, exhaust, exposed servos, or contained energy cores. Metal or mineral naming alone is not sufficient: no pet may resolve visually as an organic, stone, clay, or “rock-turd” lump.

The existing roster count and the established branch-on-4 evolution decision will be preserved. Each roster entry will receive a robotic reinterpretation covering its mechanical creature identity, readable silhouette, built signature, and three-band mechanical escalation. Existing pets at greatest risk of the organic-lump read will be called out explicitly with replacement concepts.

## Assumptions

- This is a design-only reinterpretation; identifiers, implementation, balance, product code, and shipped assets remain untouched.
- Existing pet names may be retained as identifiers or material/color cues even where the visual concept is substantially replaced.
- “Cute,” “majestic,” and “strange” are welcome tonal outcomes, but construction must remain legible at gameplay scale.
- Evolution should create dramatic, PSO2-MAG-like silhouette divergence through machinery rather than biological growth.

## Locked roster and evolution decisions

- **Roster count:** 24 total identities: the eight shipped IDs plus the sixteen additions proposed by `pet-1-roster`.
- **Bands:** Hatchling at Bond levels 1–3, Awakened at 4–7, and Ascendant at 8–10. The names describe relationship maturity, not biological age.
- **Mechanical escalation:** Hatchling is a compact folded machine; Awakened deploys a specialized working frame; Ascendant becomes a legendary machine with a new chassis topology and a hero system. Scaling or recoloring alone never counts as evolution.
- **Branching:** keep the Ascendant-only two-way pilot on exactly four pets: Verdant Wing, Copper Snail, Slate Tortoise, and Biscuit Jackalope. Both endpoints remain cosmetic, share function and capstone, and retain their established stable branch/form keys.
- **Identity continuity:** keep every existing and proposed `petId`. Nature, animal, mineral, spectral, and occult words are model-line nicknames or visual motifs, not material claims. “Slate” means slate-gray armor; “ghost” means phase hardware; “verdant” means verdigris finish; “moonmilk” means lunar-white ceramic plating.
- **Non-negotiable construction read:** every band must show at least three manufactured cues, including one articulation cue (joint, hinge, rotor, track, gimbal, or telescoping member) and one powered cue (optic, core, exhaust, status light, coil, or energized seam).

## Mechanical evolution grammar

| Band | Mechanical job | Required silhouette change | Typical built escalation |
|---|---|---|---|
| **Hatchling** | Compact companion appliance or folded scout | One dominant chassis plus one clear directional feature; no smooth featureless bean, pebble, or puddle | Panel seams, one friendly optic cluster, protected joints, small antenna or exhaust port |
| **Awakened** | Deployed specialist frame | Change at least two of aspect ratio, stance, locomotion, appendage count, or negative space | Telescoping chassis, exposed servos, deployed tools/wings/legs, brighter contained core, functional vents |
| **Ascendant** | PSO2-MAG-style legend machine | Change at least three silhouette axes and add one unmistakable hero system | New frame architecture, extra limbs/rotors/plates, chrome or high-grade ceramic finish, stabilized energy core, satellite modules or major exhaust system |

The art test is mechanical as well as silhouetted: flatten each form to black at 64 px to verify divergence, then inspect the lit render at gameplay size and ask, “Can I point to how it was assembled and how it moves?” If the answer is no, or if the mass reads as rock, flesh, fur, smoke, ooze, or an animated object with no mechanism, the form fails.

## Shipped eight: robotic recast

These IDs and gameplay functions remain unchanged. The form descriptions below replace the visual premise, including organic wording in the earlier evolution draft.

### 1. `verdant-wing` — Verdant Wing

- **Mechanical creature:** a verdigris aerial survey drone modeled after a butterfly, using stamped fern-pattern aerofoils rather than leaves or living wings.
- **Silhouette:** a small central fuselage with a curled forward sensor boom and progressively wider tiers of cutwork wing plates. Black gaps between panels make every deployed wing count legible.
- **Built signature:** pale dew-lens optic, riveted wing ribs, visible pitch servos, copper antenna coils, and a rear vector-fan exhaust.
- **Hatchling — Foldwing Scout:** a round, unmistakably paneled fuselage inside two tightly folded aerofoils; the landing skid, lens bezel, and rear fan prevent a bud/seed read.
- **Awakened — Fernkite Interceptor:** the fuselage becomes narrow and pointed, four independent aerofoils deploy in a steep X, and exposed servo knuckles plus twin stabilizer antennae create a true flight frame.
- **Ascendant A — `canopy-seraph`:** six long chrome-edged aerofoils rise in three tiers around a small high-output core; three detached dew-lens satellites form a broken sensor halo. It is tall, airy, radial, and visibly powered.
- **Ascendant B — `bramble-atlas`:** the aerofoils lock downward as overlapping armor shutters over a low six-legged survey crawler; thorn-like rail guards, heavy hip servos, and a dorsal reactor make it broad, square, and planted—the mechanical opposite of the Seraph.

### 2. `hearth-newt` — Hearth Newt

- **Mechanical creature:** a friendly kiln-inspection crawler shaped like a newt, built from soot-black iron and warm ceramic furnace tiles.
- **Silhouette:** a low stove chassis, blunt segmented tail, four then six piston feet, and a dorsal row of heat-dissipation vanes.
- **Built signature:** smiling charcoal visor, glass-fronted ember reactor, firebrick plating, pressure gauge, chimney exhaust, and orange-lit joints.
- **Hatchling — Ember Caddy:** a compact oval stove-bot on four clearly separated roller-feet, with a two-segment tail wrapped around its chassis; panel breaks and the furnace-door bezel replace the former coal-pebble read.
- **Awakened — Kiln Salamander:** the chassis telescopes into a long low oven, four piston legs extend, the tail becomes a jointed heat pipe, and three dorsal radiator fins unfold around a larger reactor window.
- **Ascendant — Hearth Wyrm:** an S-curved six-legged furnace dragon frame replaces the low crawler; twin chimney stacks, a forked poker-tail, a crown of heat vanes, polished copper trim, and a large contained ember core make it a cozy traveling engine rather than a fire creature.

### 3. `lodestar-moth` — Lodestar Moth

- **Mechanical creature:** a nocturnal navigation drone with moth-like solar/radar panels and funerary-lantern styling.
- **Silhouette:** deep teardrop instrument pod under a broad layered wing mantle, escalating from two folded panels to six tattered-edged metal foils and an orbiting astrolabe.
- **Built signature:** cobalt lead optic, etched compass graphics, mesh wing ribs, shovel-shaped antenna tools, gimbaled lantern battery, and brass bearing rings.
- **Hatchling — Northfinder:** a faceted compass housing with two folded metal-mesh panels, a visible hinge spine, landing prongs, and one cobalt navigation optic—never a smooth seed.
- **Awakened — Compass Mantle:** the housing deepens into a suspended instrument pod, four radar wings open as a layered diamond, and a gimbaled lantern cell drops beneath on a mechanical yoke.
- **Ascendant — Gravesky Cartographer:** six undertaker-shaped sensor wings spread around a tiny central avionics block; three broken astrolabe rings rotate on visible bearings, two moon probes orbit the mast, shovel antennae deploy, and the lantern becomes a bright caged energy core.

### 4. `copper-snail` — Copper Snail

- **Mechanical creature:** a patient courier rover whose “shell” is a copper cable drum and monowheel housing.
- **Silhouette:** low front sensor sled beneath an oversized wheel, then a lengthened cargo rig, then either a tall walking caravan or a compact concentric gyroscope.
- **Built signature:** twin telescoping optic stalks, recessed magnet notch, copper panel seams, treaded shell rim, cargo latches, and undercarriage suspension.
- **Hatchling — Coinwheel Courier:** a treaded copper drum dominates the outline, but a visible two-rail chassis, tiny bogie wheels, front optic stalks, and rear charging plug make it a vehicle rather than a coin-colored lump.
- **Awakened — Packwheel Hauler:** the rail chassis extends into a long sled, the shell splits into offset drive discs around a dark motor hub, and paired hard panniers deploy on articulated brackets.
- **Ascendant A — `wayhouse-caravan`:** the drum unfolds upward into a three-tier armored canopy with shutters, antenna bells, and six piston legs; a thumb-sized service droid operates a dorsal console. It reads as a warm mobile base, not an inhabited animal shell.
- **Ascendant B — `lodestone-roller`:** the chassis tucks inside three perpendicular gyroscope rings with exposed magnetic bearings and counterweights; the optic prow remains visible while blue ion jets lift and steer the compact rolling machine.

### 5. `gilded-gecko` — Gilded Gecko

- **Mechanical creature:** a gold-plated wall-service robot modeled after a gecko, with a gyroscopic counterweight tail.
- **Silhouette:** wedge head, low articulated spine, broad suction-pad feet, and a tail that grows from a tight counterweight curl into a three-bladed balancing fan.
- **Built signature:** friendly wedge optic, segmented tail vertebrae, micro-suction toe discs, exposed ankle servos, balance gimbals, and satin-gold plating over a dark frame.
- **Hatchling — Countercurl:** a compact wedge chassis on four visible magnetic pad-feet, paired with an almost equally large geared tail drum; the axle and joint gaps keep both circles mechanical.
- **Awakened — Ribbon Skink:** the spine extends into a low S-frame, four origami-like feet unfold on double joints, the tail becomes a long articulated counterweight boom, and dorsal balance fins deploy.
- **Ascendant — Auric Fan Basilisk:** six delicate suction legs lift a long polished chassis; the tail divides into a three-lobed stabilizer fan with gimbaled weights, a radial collar of sensor vanes opens behind the head, and a bright central balance core becomes visible.

### 6. `brass-crab` — Brass Crab

- **Mechanical creature:** a precision maintenance and reload rig whose crab outline comes from tool arms and a low clock chassis.
- **Silhouette:** split gauge disc, paired claws, increasingly numerous hairpin legs, then a crescent gantry with orbiting gear modules.
- **Built signature:** calm gauge-face optic, cyan timing pip, ratcheted joints, piston legs, asymmetric tool claws, winding key, and exposed escapement.
- **Hatchling — Ticklet Rig:** a hovering split brass gauge on two short stabilizer skids, with a folded claw yoke, visible seam, winding key, and cyan status lens; the separation prevents a featureless puck read.
- **Awakened — Gauge Skitter:** upper and lower armor plates separate around an exposed timing core, two tool claws telescope outward, and four piston legs unfold beneath the chassis.
- **Ascendant — Clockwork Choir:** the shell opens into a crescent service gantry carrying four graduated tool arms and six hairpin legs; three gear satellites orbit a tuning-fork antenna while a chrome escapement and bright cyan core occupy the central negative space.

### 7. `pale-firefly` — Pale Firefly

- **Mechanical creature:** a compact rescue-and-revival relay drone inspired by a firefly, with milk-glass lamp armor and petal-shaped rotors.
- **Silhouette:** faceted hanging light pod, crossed rotor petals, then a radial six-rotor leader surrounded by four mini relay units.
- **Built signature:** dark friendly visor notch, milk-glass battery capsule, rotor hinges, ribbon antenna cables, rescue beacon, and pale-blue power cell.
- **Hatchling — Milkglass Relay:** a faceted lantern housing inside two folded rotor guards, with landing pins, a lower battery latch, and visible hinge blocks—never a glowing bead or droplet.
- **Awakened — Petal Rotor:** the battery pod lengthens on a gimbal, four independent petal rotors unfold into a cross, and paired flexible antenna cables trail from the stabilized body.
- **Ascendant — Lantern Procession:** the leader opens a six-rotor rosette around a chrome command core and deploys four smaller relay drones on distinct front/back formations; every satellite repeats the visor notch and has its own tiny thruster, so the swarm reads manufactured rather than spawned.

### 8. `slate-tortoise` — Slate Tortoise

- **Mechanical creature:** a slate-gray mobile shield platform with tortoise proportions, built as a companion-sized disaster-response tank.
- **Silhouette:** low faceted armor dome over visible jointed legs, widening into a stepped walker, then branching into either a massive chapel carrier or a hollow levitating phase cage.
- **Built signature:** recessed friendly visor, pale reactor behind a moss-green diagnostic seam, hex-bolted shell plates, hydraulic legs, magnetic plate locks, and rear cooling vents.
- **Hatchling — Slateback Rover:** a beveled shield dome sits on four clearly visible joint pods and a low sensor prow; perimeter bolts, tread-textured feet, and a rear vent explicitly replace the rounded rune-pebble concept.
- **Awakened — Cairn Walker:** the chassis broadens, four hydraulic legs extend, and three offset armor tiers separate around a visible central coil, creating hard gaps and machinery between every “stone” plate.
- **Ascendant A — `walking-sanctuary`:** a peaked armored command shelter rises on four pillar-like piston legs with horn-shaped sensor rails, a warm reactor window, heavy vent stacks, and a seed-sized maintenance droid at the dorsal console. It is a walking rescue fortress.
- **Ascendant B — `cairn-wraith`:** the leg assemblies retract and six slate-gray armor plates unlock into a tall magnetic cage around an exposed phase core; two stabilizer shards orbit on luminous rails and ion-stream cables trail behind. It is a levitating experimental drone, not a stone ghost.

## Proposed sixteen: robotic recast

The sixteen additions retain their IDs and taste niches, but none remains biological, elemental, spectral, botanical, or amorphous in construction. Wave membership from the source roster can remain unchanged; the following order is by roster identity.

### 9. `biscuit-jackalope` — Biscuit Jackalope

- **Mechanical creature:** a tan-enamel spring-hare courier automaton with comically oversized radio ears.
- **Silhouette:** pear-shaped toy chassis under a wide V of dish ears, rising into a tall spring runner before branching into either a tiny airborne mascot or a round six-legged bunker.
- **Built signature:** horseshoe-shaped fork antennae passing through the ear panels, coil-spring hocks, friendly twin optics, seam-lined enamel plating, and a bead-shaped charging plug for a tail.
- **Hatchling — Biscuit Button:** a visibly riveted pear chassis on four rubber-tipped piston nubs, with folded dish ears, small fork antennae, and an exposed wind-up arbor at the rear.
- **Awakened — Springhare Courier:** the torso telescopes upright on four long spring legs, both antenna ears extend to body length, and the charging-tail becomes a round battery counterweight.
- **Ascendant A — `prairie-cherub`:** the central chassis compresses into a tiny chrome mascot while four enormous servo ear-panels deploy as lift vanes; horseshoe antenna loops and three spherical battery pods create a wide, airy aerial machine.
- **Ascendant B — `warren-regent`:** the courier refolds into a large round six-legged shelter rover; the two ear panels become draped side shields, the fork antennae spread into a low sensor canopy, and three cargo cells hang beneath heavy armor. It is grounded, broad, and mechanically opposite the Cherub.

### 10. `crowned-pronghorn` — Crowned Pronghorn

- **Mechanical creature:** a high-speed long-range signal strider with pronghorn geometry and ceremonial chrome trim.
- **Silhouette:** the roster’s narrowest vertical quadruped, defined by needle legs and two lyre antennae that visually close into a crown; later forms stretch into an airborne runner and then a sweeping horizon frame.
- **Built signature:** split visor, carbon-fiber limbs, exposed knee servos, forked antenna horns, chest gyroscope, hoof thrusters, and polished crown edges.
- **Hatchling — Crownlet Strider:** a slim plated torso on four sharply jointed legs with small fork antennae and visible shock absorbers; its lifted sensor chest makes it poised without relying on fawn anatomy.
- **Awakened — Lyre Runner:** the chassis lengthens into a fixed running stance, rear-leg pistons extend, front legs fold into steering canards, and the antennae triple in height around a bright diamond-shaped comms aperture.
- **Ascendant — Horizon Sovereign:** four cape-like stabilizer panels sweep from the shoulders, immense chrome antenna rails arc around the forward half, detached vector-hoof pods carry it on blue thrust, and a high-output gyroscopic core suspends the whole strider above the ground.

### 11. `manymoon-oracle` — Manymoon Oracle

- **Mechanical creature:** an uncanny predictive sensor drone made from nested bell housings, shutter optics, and orbiting calibration satellites.
- **Silhouette:** inverted bell on three probes, widening to a hollow six-probe scanner, then separating into three counter-rotating mantles inside a seven-satellite ring.
- **Built signature:** one friendly lead aperture among closed iris shutters, engraved bearing tracks, gimbaled probe arms, moon-shaped sensor pods, anti-grav coils, and a suspended energy crystal.
- **Hatchling — Hushbell Probe:** a hard-edged inverted bell housing with three jointed feeler-tools, one orbiting calibrator, a visible lower thruster, and a ring of clearly mechanical iris shutters.
- **Awakened — Moon Array:** the bell opens into a wider hollow scanner, six gimbaled probes deploy in two lengths, three moon sensors occupy different orbital rails, and the lead aperture rotates toward hazards.
- **Ascendant — Sevenfold Orrery:** three skeletal bell frames counter-rotate around a central keyhole-shaped energy core; seven independently thrustered moon probes form an incomplete ring while long antenna ribbons and exposed magnetic bearings create a majestic instrument, not a jellyfish.

### 12. `little-pallbearer` — Little Pallbearer

- **Mechanical creature:** a polite mortuary-archive courier: a sealed reliquary cargo case carried by precise jointed legs.
- **Silhouette:** a hard horizontal rectangle above a rhythmic leg fringe, then a raised six-leg carrier, then a tall processional gantry surrounding the original sealed case.
- **Built signature:** lid-latch scan bar, brass corner guards, serialized plates, elbowed spindle legs, quiet wheel-toes, antenna key, and violet status seam.
- **Hatchling — Casket Caddy:** a toy-sized rectangular hard case on four visible two-joint legs; its long lid seam is an LED scanner, not an eyelid, and two corner optics establish a clear front.
- **Awakened — Pallbearer Walker:** the case lifts on six telescoping spindle legs, paired stabilizer rails extend fore and aft, and the lid exposes a recessed—not organic—archive core behind a protective grille.
- **Ascendant — Procession Engine:** the original case hangs intact inside a tall chrome cenotaph gantry carried by eight slender actuator legs; four lantern sensors mount at the corners, a key-shaped antenna crowns the frame, and an illuminated data core occupies the deliberate central void.

### 13. `rivet-mule` — Rivet Mule

- **Mechanical creature:** a patched frontier repair mule built to carry tools and keep other machines running.
- **Silhouette:** square boiler foal with dish ears and rear flywheel, then a high rectangular gantry, then a broad six-legged workshop platform.
- **Built signature:** mismatched rivets, one obvious patch plate, dish antenna ears, spring legs, belt-driven rear flywheel, pressure exhaust, and amber workshop optics.
- **Hatchling — Rivet Foal:** a compact boiler box on four coil legs with a stub chimney, large rear horseshoe flywheel, and asymmetrical dish ears; every mass has hinges, axles, or fasteners.
- **Awakened — Gantry Mule:** the boiler telescopes lengthwise and rises on four piston legs, the ears become offset receiver dishes, and the patched flywheel drives an exposed belt across a dorsal repair gantry.
- **Ascendant — Walking Workshop:** the gantry unfolds sideways into a six-legged service deck; two forelimbs become a clamp and rotary brush, the flywheel upgrades into a rear lift rotor, chrome tool lockers flank a bright generator core, and a thumb-sized repair bot operates the bench.

### 14. `brimstone-imp` — Brimstone Imp

- **Mechanical creature:** a mischievous thermal-management drone whose “fire” is controlled exhaust and whose horns are heat sinks.
- **Silhouette:** small triangular furnace chassis on two skids, then a digitigrade four-limb service imp, then a wide radiator-winged thrust machine.
- **Built signature:** sulfur-yellow optics, split horn radiators, ceramic black plating, heat-warning chevrons, cloven magnetic feet, tailpipe nozzle, and contained orange reactor.
- **Hatchling — Cinder Impeller:** a riveted triangular housing on two hoof-shaped stabilizer skids, with twin heat-sink horns, a tiny rear exhaust, and a visible caged thermal cell—never a coal lump or living flame.
- **Awakened — Furnace Gremlin:** the housing unfolds into two reverse-jointed legs and two small tool arms, the horn radiators separate into fin stacks, and the tailpipe extends on articulated vertebrae for thrust steering.
- **Ascendant — Brimstone Overdrive:** four broad radiator panels deploy like angular wings around a chrome-black chassis, six articulated limbs distribute heat and tools, the forked exhaust produces two controlled ion plumes, and the enlarged reactor glows behind a bolted safety cage.

### 15. `thimble-deputy` — Thimble Deputy

- **Mechanical creature:** a tiny frontier patrol bot whose enormous cowboy-hat silhouette is actually a rotating radar dish and rotor guard.
- **Silhouette:** huge flat brim over two feet, then raised dish on a compact quadruped, then a star-shaped command rotor surrounding a very small marshal unit.
- **Built signature:** brass badge optic, hat-brim antenna track, two wheel-boots, spur gyros, telescoping neck mast, speaker grille, and cobalt signal lamp.
- **Hatchling — Badge Button:** a pea-sized gimbal body rolls on two boot-shaped wheels beneath a five-times-wider radar brim; the shining “bullet hole” is a star-aperture signal lens.
- **Awakened — Dish Deputy:** four short spur-wheel legs unfold, the hat rises on a mast and tilts as a directional scanner, and two side holsters reveal harmless repair probes and charging leads.
- **Ascendant — Marshal Array:** the brim splits into five star-shaped rotor/antenna blades around a chrome command hub; six tiny wheel legs stabilize below, twin beacon pods orbit the mast, and the original little deputy remains visibly seated at the center.

### 16. `chapelback-bison` — Chapelback Bison

- **Mechanical creature:** a heavy escort and mobile shelter mech with bison mass and chapel-like armor architecture.
- **Silhouette:** low wedge-front calf machine beneath a peaked canopy, widening into a four-piston hauler, then becoming the roster’s broadest six-leg fortress.
- **Built signature:** crash-bar horns, layered shoulder plating, hydraulic legs, stained-glass-pattern reactor window, roofline vents, tow lugs, and warm interior utility lights.
- **Hatchling — Vestry Calf:** a low riveted wedge on four compact pistons, with a small peaked armor hump and a faceted amber reactor window; bumper horns and exposed joints prevent an animal/rock read.
- **Awakened — Nave Hauler:** the shoulders widen, four column pistons extend, the canopy rises around a larger shield generator, and side armor opens into deployable rescue bays.
- **Ascendant — Cathedral Bulwark:** six load-bearing legs support a multi-tier mobile bastion with huge horn rails, twin cooling towers, chrome-edged armor plates, and a radiant stained-glass energy core; shield emitters form a broken protective halo without changing gameplay function.

### 17. `tollwater-ray` — Tollwater Ray

- **Mechanical creature:** a silent hover-skimmer patterned after a manta ray, built for sonar mapping and calm escort duty.
- **Silhouette:** flat diamond airframe with curled vector pods and one long tail, broadening into a four-thruster wing before becoming a double-deck abyssal survey craft.
- **Built signature:** hard panel seams, curled ducted fans, underside blue optic, pressure gauges, flexible cable-tail, bell-shaped sonar transducer, and cold vapor exhaust.
- **Hatchling — Bellfin Skimmer:** a small faceted diamond chassis with two curled ducted fans, a visible underside landing gimbal, and one cable-tail ending in a metal sonar bell.
- **Awakened — Tollwing Surveyor:** the airframe widens, four independent vector fans open along its edges, the tail lengthens through jointed couplers, and a transparent pressure-rated core becomes visible beneath.
- **Ascendant — Abyssal Tollcarrier:** two swept diamond frames separate vertically around a chrome-blue reactor, six vector thrusters produce an unmistakable mechanical hover stance, and a three-bell sonar array fans from the articulated tail alongside orbiting depth probes.

### 18. `gravewick-beetle` — Gravewick Beetle

- **Mechanical creature:** a diligent cemetery-maintenance robot with beetle packaging, digging tools, and a lantern battery.
- **Silhouette:** low armored oval over six legs, lengthening into a shovel-front worker, then opening into a tall glass-core cryptwright engine.
- **Built signature:** spade-shaped tool mandibles, six ratcheted legs, hinged wing-case service panels, warm glass battery, visible charging filament, headlamp optics, and dirt-shedding vents.
- **Hatchling — Wickbug Tender:** a riveted oval chassis on six clearly jointed spade feet, with a small front tool clamp and a lantern battery protected by a rear metal cage.
- **Awakened — Graveyard Digger:** the frame lengthens, shovel mandibles telescope into independent arms, upper armor splits into service doors, and the battery rises on a shock-mounted gimbal above stronger piston legs.
- **Ascendant — Cryptwright Engine:** the rear shell opens into two tall armor wings around a large caged power lantern; six chrome legs and two dedicated excavator arms create an eight-point work silhouette, while a mast of locator antennae and exhaust stacks crowns the machine.

### 19. `ragwing-vulture` — Ragwing Vulture

- **Mechanical creature:** a weathered salvage-and-recovery drone with vulture posture and dignity, assembled from repaired frontier aircraft parts.
- **Silhouette:** hunched comma chassis with long crane neck and folded scrap wings, then a broad glider, then a huge turbine-centered condor rig.
- **Built signature:** single hooded optic, telescoping neck, hooked retrieval clamp, mismatched stamped wing plates, exposed feather-like flap servos, talon landing gear, and patched turbine housing.
- **Hatchling — Ragpicker Chick:** a compact turbine body beneath a folded stack of stamped scrap plates, with a narrow two-joint sensor neck and blunt recovery clamp; faded poster fragments appear only as decals on metal panels.
- **Awakened — Wanted-Wing Reclaimer:** the wings open into two ragged arrays of independently hinged flaps, the neck extends, and two talon gear assemblies plus a belly winch deploy for salvage work.
- **Ascendant — Frontier Condor:** a large chrome-edged lift turbine becomes the central negative space, four layered wing arrays span wide around it, the crane neck rises above the ring, and twin cargo claws plus trailing exhaust vanes make a majestic recovery aircraft rather than a flesh-and-feather bird.

### 20. `rambleroot-tumbleweed` — Rambleroot

- **Mechanical creature:** a rootless spherical cable-cage rover whose “bramble” is braided conduit and whose “flower” is a traveling locator optic.
- **Silhouette:** open wire sphere on four tiny actuators, expanding into a three-axis rolling cage, then becoming a large gyro rover with a suspended core and six deployable feet.
- **Built signature:** braided copper conduits, machined junction collars, ring bearings, foldout boot actuators, cobalt blossom-shaped lens, central battery, and dust-clearing air jets.
- **Hatchling — Rambleroot Ball:** a sparse spherical cage of insulated cables around a visible metal hub, standing on four little mechanical boots; the cobalt locator lens rides a toothed equatorial rail instead of growing from the cage.
- **Awakened — Wayline Tumbler:** three rigid conduit rings separate onto gimbaled axes, the central battery floats in bearing forks, and four telescoping feet alternately retract so the rover can roll or walk.
- **Ascendant — Horizon Gyro:** six chrome conduit rings form an airy globe around a bright suspended energy core; six articulated legs unfold from the lower hemisphere, three cobalt sensor pods travel on orbital tracks, and directional exhaust puffs steer the whole contraption.

### 21. `ghost-coyote-pup` — Ghost Coyote Pup

- **Mechanical creature:** a loyal phase-recon hound drone using translucent armor, projection hardware, and fiber-optic chassis rails.
- **Silhouette:** big antenna ears over a lean foreframe with a tapering projector tail, lengthening into a floating four-pod runner, then leading a crescent formation of four mini scout drones.
- **Built signature:** oversized receiver ears, friendly visor, transparent polycarbonate side panels, fiber-optic “rib” rails, vector-foot thrusters, phase coils, and rear hologram projectors.
- **Hatchling — Wisp Scout:** a slim hard chassis with two front stabilizer paws and two small rear vector jets; its taper is a projected navigation trail emitted by a visible tail nozzle, not smoke or missing anatomy.
- **Awakened — Boundary Hound:** the frame lengthens, four detached-looking but solid vector-foot pods mount on magnetic struts, twin projector tails deploy, and the owner-pointing constellation becomes a lit fiber-optic brace inside transparent armor.
- **Ascendant — Pack of One:** the chrome leader deploys four smaller coyote-profile scout drones in a crescent formation, each with visible optics and thrusters; three rear projector booms link their navigation lights into one constellation while an exposed phase core stabilizes the group.

### 22. `hungry-boot` — Hungry Boot

- **Mechanical creature:** an absurd boot-shaped frontier salvage automaton with a clamp bay in its toe and a sensor gimbal in its spur.
- **Silhouette:** upright L-shaped hopper, then horizontal six-leg cable crawler, then a long S-shaped train of boot armor modules.
- **Built signature:** riveted boot-profile plating, heel piston, hinged toe clamp, lace-like control cables terminated in metal feet, rowel sensor, sole vents, and serial-number stamps.
- **Hatchling — Nibbler Hopper:** a hard armored boot chassis bounces on a visible heel piston; the toe opens as a rounded pickup clamp and the spur is a swiveling camera, removing the mouth-and-eyeball interpretation.
- **Awakened — Lace Crawler:** the chassis tips horizontal, six braided actuator cables deploy as legs with small magnetic shoes, the upper shaft telescopes into a sensor neck, and the toe clamp widens for hauling scrap.
- **Ascendant — Bootleg Leviathan:** repeated boot-shaped armor housings lock into a long articulated S-frame with three heel pistons and three graduated clamp bays; five rowel camera satellites orbit the original lead sensor while chrome sole plates and exhaust vents run the length of the machine.

### 23. `moonmilk-ooze` — Moonmilk Ooze

- **Mechanical creature:** a lunar-white ceramic maintenance skimmer whose old “ooze” name describes its smooth ground-hugging motion, never its substance or anatomy.
- **Silhouette:** low faceted hover skirt with central dome and three tool pods, opening into a tri-lobed service craft, then separating into a broad ring foundry around a suspended core.
- **Built signature:** overlapping ceramic plates, black gasket seams, perimeter microjets, chrome dome, star-shaped reactor aperture, magnetic tool pods, and blue-white underside thrust.
- **Hatchling — Moonmilk Skimmer:** a rigid low hexagonal skirt surrounds a bolted dome; three small tool pods travel on a perimeter rail and the star aperture glows through a protected central lens. It never puddles, squashes, drips, or deforms.
- **Awakened — Crescent Servicer:** the skirt splits into three articulated hover plates with hard gaps between them, the dome rises on a telescoping core column, six microjets become visible, and the tool pods extend on magnetic working arms.
- **Ascendant — Lunar Ringfoundry:** the plates rotate upright into a broad broken halo around a suspended chrome energy core; six independent service limbs and three orbiting tool drones occupy the negative space, while a lower thruster crown gives the construct a crisp levitating stance.

### 24. `rattlesmoke-wyrm` — Rattlesmoke Wyrm

- **Mechanical creature:** an articulated rail-inspection serpent drone built from brass train couplings and jet-assisted chassis segments.
- **Silhouette:** short C-shaped chain, then a long S of repeated segments with two tool arms, then a sweeping chrome rail-wyrm with stabilizer fins, multiple limbs, and a turbine tail.
- **Built signature:** numbered coupling segments, glowing route optic, ball-bearing spine joints, brass rattle links, foldout inspection arms, side microthrusters, and controlled exhaust trails.
- **Hatchling — Coupling Whelp:** three armored segments curl into a C around a compact power cell, with a narrow sensor head, two landing claws, and a visibly mechanical chain of miniature rail couplers at the tail.
- **Awakened — Switchline Wyrm:** seven segments extend into an S, two articulated inspection arms unfold near the head, paired stabilizer fins open along the body, and distributed microjets replace the former smoke-frayed anatomy.
- **Ascendant — Rattle-Rail Leviathan:** twelve chrome-edged carriages articulate around a bright linear energy core; six tool/stabilizer limbs punctuate the long contour, a multi-ring turbine replaces the tail rattle, and synchronized exhaust ports leave a deliberate mechanical wake.

## Rescue priority: existing shipped pets

This is the explicit rescue order for the eight pets already named in `packages/shared/src/pets.ts`. “Urgency” measures risk of reading as an organic/mineral lump at small scale, not the quality of the name or gameplay function.

| Urgency | Existing pet and risky read | Robotic replacement to author |
|---|---|---|
| **Critical 1** | **Slate Tortoise:** “rune pebble,” rounded shell, cairn plates, moss, and floating stone can collapse into the rejected rock-lump read in every band. | **Slateback disaster-response rover:** beveled shield armor over visible hydraulic legs → stepped armored walker → chapel carrier or magnetic phase-cage drone. Every “stone” is a machined slate-gray plate with bolts, locks, and an observable suspension system. |
| **Critical 2** | **Copper Snail:** a charcoal bean hidden under a coin disc is almost the exact silhouette failure the owner described. Copper material alone does not save it. | **Copper cable-drum courier:** treaded monowheel over a rail undercarriage → articulated cargo hauler → six-leg mobile wayhouse or three-axis gyroscope. Optic stalks, hub motor, suspension, and latches must remain visible. |
| **Critical 3** | **Hearth Newt:** “coal pebble,” limbless body, and soft fire treatment can read as a warm rock or salamander-shaped lump. | **Kiln-inspection crawler:** paneled stove caddy with roller-feet and segmented heat-pipe tail → four-piston oven crawler → six-leg S-frame furnace engine. Flame motifs become radiator fins, contained reactor light, and exhaust. |
| **High 4** | **Verdant Wing:** bud, fern leaf, root feet, and botanical seraph language currently imply growth even when painted metallic. | **Verdigris aerial survey drone:** folded stamped aerofoils → four-wing servo kite → six-wing sensor seraph or low six-leg armored field crawler. Leaf shapes survive only as cut-metal geometry. |
| **High 5** | **Pale Firefly:** round milk lantern, droplet language, seedpod opening, and “young” risk a luminous organic bead that reproduces. | **Rescue relay drone:** faceted lamp housing → four-rotor flyer → six-rotor command unit deploying four built mini relays. Satellite units launch from hard docking bays; none buds or hatches. |
| **Medium 6** | **Lodestar Moth:** seed-thorax and gravedigger cloth can read as a conventional moth or bundled organic shape. | **Nocturnal navigation drone:** compass housing with hinge spine → four-panel radar mantle → six-panel cartography rig with bearing-mounted astrolabe and caged lantern battery. |
| **Medium 7** | **Gilded Gecko:** the long lizard form is readable, but the old limbless bean and skin/scale language remain biological. | **Wall-service robot:** magnetic pad-feet, segmented counterweight tail, and exposed joints → extended balance crawler → six-leg chrome basilisk with stabilizer fan. |
| **Low but required 8** | **Brass Crab:** it is already closest to the mandate, but the Hatchling’s round “puck” can still become a metal blob if hinges disappear. | **Precision maintenance rig:** split gauge housing and folded tool yoke → piston-leg skitter → open crescent gantry with four tool arms, six legs, satellites, and exposed escapement. |

## Pre-production rescues among the proposed sixteen

Several proposed concepts must be replaced before any image generation because their original premise itself was organic or amorphous:

- `moonmilk-ooze`: replace the puddle, droplets, squashing, and internal inclusion with the rigid **Moonmilk Skimmer**—ceramic hover plates, microjets, tool pods, and a star-aperture reactor.
- `rambleroot-tumbleweed`: replace roots, thorns, boot feet, and traveling flower with the **Rambleroot cable-cage rover**—braided conduits, bearing rings, actuator boots, and a rail-mounted cobalt locator lens.
- `ghost-coyote-pup`: replace smoke anatomy and constellation ribs with a **phase-recon hound drone**—transparent armor, fiber-optic braces, projector nozzles, vector-foot pods, and deployed mini scouts.
- `biscuit-jackalope`: replace velvet, powder-puff anatomy, and biological antlers with a **spring-hare courier automaton**—enamel plates, dish ears, coil legs, fork antennae, and a battery counterweight.
- `brimstone-imp`: replace coal, hoof nubs, living flame, and flame horns with a **thermal-management drone**—ceramic furnace shell, magnetic skids, horn radiators, caged reactor, and controlled exhaust.
- `hungry-boot`: replace the literal jaw, throat, and eyeball with a **boot-profile salvage bot**—toe clamp, storage bay, heel piston, control-cable legs, and rowel camera.
- `manymoon-oracle`: replace eyelids, jellyfish feelers, and translucent skirt with a **predictive sensor instrument**—iris shutters, gimbaled probes, nested counter-rotating housings, magnetic bearings, and calibration satellites.
- `little-pallbearer`: replace finger-legs and blinking coffin imagery with a **mortuary archive courier**—sealed hard case, scan bar, spindle actuators, lantern sensors, and data core.
- `ragwing-vulture`: replace bare neck, beak, plumage, and paper feathers with a **salvage aircraft drone**—crane sensor neck, retrieval clamp, independently hinged metal flaps, lift turbine, and decals only on hard panels.

The remaining additions were closer to mechanical already, but still require the same gate: animal outline is allowed; animal anatomy and unexplained material deformation are not.

## Four-pet Ascendant branch pilot, mechanically restated

The branch count does not expand. Hatchling and Awakened remain shared, and only the following four pets receive two Ascendant assemblies.

| Pet | Mechanical care-path prompt | Ascendant A | Ascendant B | Required black-silhouette contrast |
|---|---|---|---|---|
| Verdant Wing | Install **aerial-control firmware** or **terrain-crawler armor**? | `canopy-seraph` / `verdant-wing:s3:canopy-seraph` | `bramble-atlas` / `verdant-wing:s3:bramble-atlas` | Tall six-aerofoil sensor halo vs low six-leg armored square |
| Copper Snail | Fit a **mobile-shelter kit** or **gyroscope calibration kit**? | `wayhouse-caravan` / `copper-snail:s3:wayhouse-caravan` | `lodestone-roller` / `copper-snail:s3:lodestone-roller` | Tall inhabited walker with canopy vs compact concentric roller |
| Slate Tortoise | Install a **rescue-bastion module** or **phase-cage coil**? | `walking-sanctuary` / `slate-tortoise:s3:walking-sanctuary` | `cairn-wraith` / `slate-tortoise:s3:cairn-wraith` | Solid low four-pillar fortress vs tall hollow levitating plate cage |
| Biscuit Jackalope | Tune for **lift-vane agility** or fit a **shelter-rover chassis**? | `prairie-cherub` / `biscuit-jackalope:s3:prairie-cherub` | `warren-regent` / `biscuit-jackalope:s3:warren-regent` | Tiny center with four giant ear vanes vs round heavy six-leg bunker |

The earlier interaction rules still stand: the level-4 care path previews both silhouettes, remains freely changeable through Awakened, commits visually at level 8, and can later be swapped through Rebond without losing Bond XP or changing mechanics. The care objects and UI copy must use parts, firmware, calibration, charging, tuning, or maintenance—not feeding, growing, nesting, planting, or magical communion.

## Art-direction rejection gate

Reject a concept, generation, paintover, or gameplay-scale render if any statement below is true:

1. The pet can be described accurately as a pebble, bean, blob, puddle, mound, turd, cloud, tuft, or smooth lump before it can be described as a device.
2. Metal color is the only evidence of machinery. Gray rock with a glow is still a rock; a copper snail shell without hub, seam, axle, or suspension is still a shell.
3. A limb, wing, horn, tail, or satellite has no visible joint, hinge, bearing, cable, mount, magnetic rail, or thruster explaining attachment and motion.
4. The only powered cue is an uncontained magical glow. Light must originate in an optic, reactor window, status strip, coil, exhaust, or instrument aperture.
5. “Spectral” parts exist without a visible projector, phase coil, magnetic field rail, emitter, or solid control chassis.
6. Smoke or flame substitutes for anatomy. It may only leave a modeled nozzle, vent, stack, turbine, or radiator system.
7. Plant motifs look grown. Ferns, flowers, brambles, moss, and roots may appear only as etched patterns, shaped metal, braided conduits, colored diagnostic seams, or purpose-built panels.
8. Eyes read as wet eyes or mouths read as flesh. Use lenses, shutters, visors, cameras, speaker grilles, clamps, cargo hatches, and tool bays.
9. Band 2 is only a stretched Band 1, or Band 3 is only a larger/recolored Band 2 with an accessory. The mechanical chassis and topology must visibly reconfigure.
10. The pet loses cuteness because “robotic” was interpreted as hostile. Keep friendly optic proportions, rounded safety edges, toy-like timing, expressive antenna poses, and non-weapon tool language where appropriate.

## Layered bob compatibility

The owner’s two-layer pet motion request reinforces this recast. Each form should identify one **lower/support layer** and one **upper/reactive layer** so the upper assembly can bob, lag, tilt, flutter, or counter-rotate without pretending the machine is soft:

- walkers: leg/undercarriage layer below; chassis, canopy, or sensor mast above;
- fliers: core/gimbal layer below; wing, rotor, antenna, or satellite assembly above;
- rollers: contact wheel or magnetic rail below; suspended cab/core above;
- long frames: main linked chassis below; head mast, dorsal gantry, or tail counterweight above.

The layer break must follow a real bearing, suspension mount, gimbal, or flexible cable. It should make the companion feel alive through engineered secondary motion while strengthening the “built” read.

## Production handoff

- Preserve the 24 IDs and current eight gameplay definitions. This report changes visual direction only.
- Treat earlier biological stage prose as superseded wherever it conflicts with this document. Stable branch keys remain usable even when their display concept is mechanically rewritten.
- Build and review one pet form per isolated image-generation context under the owner’s standing anti-bleed rule; share an approved robotic-pet style reference across contexts rather than batching subjects.
- For each generated form, require a silhouette sheet, a lit construction-detail crop, and a gameplay-size composite. The lit crop must make at least three built signatures immediately pointable.
- Use the existing logical `core`/`primary`/`secondary` compatibility model as implementation context, but do not mistake a three-slot save contract for an aesthetic limit on legs, rotors, shells, satellites, or hard-surface layers.
- Do not touch product code or assets as part of this design recast. Art, manifest, rig, and catalog implementation are separate authorized tasks.

## Validation

- Re-read owner decision item 7, both requested pet design reports, and the shipped catalog in `packages/shared/src/pets.ts` before completing the recast.
- Counted exactly **24 numbered roster entries and 24 unique IDs**: all eight shipped pets plus all sixteen proposed pets.
- Confirmed every entry contains a mechanical-creature identity, silhouette, built signature, Hatchling form, Awakened form, and Ascendant form.
- Counted **28 Ascendant descriptions**: one for each of 20 unbranched pets plus two each for the exact four-pet pilot. The consolidated branch table contains eight namespaced full form keys.
- Confirmed the rescue section explicitly ranks all eight shipped pets and names the robotic replacement for each; the critical list directly addresses Copper Snail, Slate Tortoise, Hearth Newt, and other lump-prone forms.
- Confirmed there are no `TODO`, `TBD`, or `FIXME` markers and `git diff --check` reports no whitespace errors for this file.
- This design task created only `docs/design/pet-robotic-roster.md`; it did not modify product code, assets, catalogs, tests, generated files, or the live game/processes on ports 5180/2567.
