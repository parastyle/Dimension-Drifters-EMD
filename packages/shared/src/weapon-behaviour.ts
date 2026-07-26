import type { WeaponDef } from "./weapons.js";

function numberText(value: number, fractionDigits = 2): string {
  if (!Number.isFinite(value)) return "0";
  return Number(value.toFixed(fractionDigits)).toString();
}

function secondsText(value: number): string {
  return `${numberText(Math.max(0, value))} ${Math.abs(value - 1) < 1e-9 ? "second" : "seconds"}`;
}

function pxText(value: number): string {
  return `${Math.round(Math.max(0, value))} px`;
}

function countText(value: number, singular: string, plural = `${singular}s`): string {
  const count = Math.max(0, Math.trunc(value));
  return `${count} ${count === 1 ? singular : plural}`;
}

function hitCapacityText(value: number): string {
  return `hits up to ${countText(value, "enemy", "enemies")}`;
}

function reloadSubject(weapon: Readonly<WeaponDef>): string {
  if ((weapon.gun?.pellets ?? 1) > 1 || weapon.gun?.randomPellets) return "trigger pulls";
  if ((weapon.gun?.burst?.count ?? 1) > 1) return "bursts";
  return "shots";
}

function gunBehaviour(weapon: Readonly<WeaponDef>): string {
  const gun = weapon.gun;
  if (!gun) return meleeBehaviour(weapon);
  let opening: string;
  if (gun.randomPellets) {
    const { min, max, directions } = gun.randomPellets;
    opening =
      directions === "radial"
        ? `Fires ${min}–${max} shots in every direction per trigger pull`
        : `Fires ${min}–${max} pellets in a cone per trigger pull`;
  } else if ((gun.pellets ?? 1) > 1) {
    opening = `Fires ${countText(gun.pellets ?? 1, "pellet")} in a cone per trigger pull`;
  } else if ((gun.burst?.count ?? 1) > 1) {
    opening = `Fires a ${gun.burst?.count ?? 1}-shot burst per trigger pull`;
  } else {
    opening = `Fires one shot every ${secondsText(gun.fireRate)}`;
  }

  const traits: string[] = [];
  if ((gun.pierce ?? 1) > 1) traits.push(`each shot ${hitCapacityText(gun.pierce ?? 1)}`);
  if ((gun.bounces ?? 0) > 0) {
    traits.push(`ricochets off walls ${countText(gun.bounces ?? 0, "time", "times")}`);
  }
  if (gun.explode) traits.push(`explodes in a ${pxText(gun.explode.radius)} radius`);
  if (gun.arcHeight) traits.push("travels in an arc");

  const detail =
    traits.length > 0
      ? traits.slice(0, 2).join(" and ")
      : `reloads after ${gun.magazine} ${reloadSubject(weapon)} in ${secondsText(gun.reloadSeconds)}`;
  return `${opening}; ${detail}.`;
}

function castBehaviour(weapon: Readonly<WeaponDef>): string {
  const cast = weapon.cast;
  if (!cast) return meleeBehaviour(weapon);
  const count = Math.max(1, Math.trunc(cast.volley?.count ?? 1));
  const opening =
    count > 1
      ? `Casts ${countText(count, "bolt")} in a cone every ${secondsText(cast.cooldown)}`
      : `Casts a bolt every ${secondsText(cast.cooldown)}`;
  const traits: string[] = [];
  if ((cast.pierce ?? 99) >= 99) traits.push("each bolt passes through every enemy in its path");
  else if ((cast.pierce ?? 1) > 1) traits.push(`each bolt ${hitCapacityText(cast.pierce ?? 1)}`);
  if (cast.projectileWaveform) traits.push("the bolts weave from side to side");
  if (cast.explode) traits.push(`each bolt explodes in a ${pxText(cast.explode.radius)} radius`);
  if (traits.length === 0) traits.push(`reaches up to ${pxText(cast.range)}`);
  return `${opening}; ${traits.slice(0, 2).join(" and ")}.`;
}

function beamBehaviour(weapon: Readonly<WeaponDef>): string {
  const beam = weapon.beam;
  if (!beam) return meleeBehaviour(weapon);
  const rays = Math.max(1, Math.trunc(beam.randomRays?.count ?? 1));
  const delivery = beam.coneStream
    ? `a widening ${beam.coneStream.flavor} cone`
    : rays > 1
      ? `${countText(rays, "beam")}`
      : "a beam";
  return `Charges for ${secondsText(beam.chargeSeconds)}, then channels ${delivery} up to ${pxText(beam.range)}; overheats after ${secondsText(beam.overheat.maxChannelSeconds)}.`;
}

function thrownBehaviour(weapon: Readonly<WeaponDef>): string {
  const thrown = weapon.thrown;
  if (!thrown) return meleeBehaviour(weapon);
  const traits: string[] = [];
  if (thrown.returning) traits.push("returns to you");
  if ((thrown.ricochetHops ?? 0) > 0) {
    traits.push(
      `ricochets to ${countText(thrown.ricochetHops ?? 0, "more enemy", "more enemies")}`,
    );
  }
  if ((thrown.pierce ?? 1) > 1) traits.push(hitCapacityText(thrown.pierce));
  if (thrown.helix) traits.push("flies in a twin helix");
  const refill =
    thrown.charges === 1
      ? `its charge refills after ${secondsText(thrown.refillSeconds)}`
      : `all ${thrown.charges} charges refill after ${secondsText(thrown.refillSeconds)}`;
  const detail = traits.length > 0 ? `; each throw ${traits.slice(0, 2).join(" and ")}` : "";
  return `Throws one charge at a time up to ${pxText(thrown.range)}${detail}; ${refill}.`;
}

function groundZoneBehaviour(weapon: Readonly<WeaponDef>): string {
  const zone = weapon.groundZone;
  if (!zone) return meleeBehaviour(weapon);
  const style =
    zone.style === "poison-smoke"
      ? "poison cloud"
      : zone.style === "nether"
        ? "damaging rift"
        : `${zone.style} zone`;
  const article = /^[aeiou]/i.test(style) ? "an" : "a";
  const placement =
    zone.trigger === "landing"
      ? "where the projectile lands"
      : zone.trigger === "impact"
        ? "on impact"
        : zone.trigger === "channel"
          ? "while held"
          : "on attack";
  const slow =
    zone.slowMultiplier !== undefined && zone.slowMultiplier < 1
      ? ` and slows enemies by ${Math.round((1 - zone.slowMultiplier) * 100)}%`
      : "";
  return `Creates ${article} ${style} ${placement} that reaches a ${pxText(zone.maxRadius)} radius for ${secondsText(zone.lingerSeconds)}${slow}.`;
}

function scatterBehaviour(weapon: Readonly<WeaponDef>): string {
  const scatter = weapon.scatter;
  if (!scatter) return meleeBehaviour(weapon);
  const direction = scatter.aim === "radial-random" ? "in every direction" : "in a cone";
  const ending = scatter.explode
    ? `; each one explodes in a ${pxText(scatter.explode.radius)} radius`
    : (scatter.pierce ?? 1) > 1
      ? `; each one ${hitCapacityText(scatter.pierce ?? 1)}`
      : ` up to ${pxText(scatter.range)}`;
  return `Launches ${countText(scatter.count, "projectile")} ${direction} every ${secondsText(weapon.cooldown)}${ending}.`;
}

function quakeBehaviour(weapon: Readonly<WeaponDef>): string {
  const quake = weapon.quake;
  if (!quake) return meleeBehaviour(weapon);
  const placement = quake.placementRange
    ? ` at your cursor from up to ${pxText(quake.placementRange)} away`
    : " around you";
  return `Slams an area with a ${pxText(quake.radius)} radius${placement} every ${secondsText(weapon.cooldown)}.`;
}

function chainBehaviour(weapon: Readonly<WeaponDef>): string {
  const chain = weapon.chainLightning;
  if (!chain) return meleeBehaviour(weapon);
  return `Strikes within ${pxText(weapon.range)}, then lightning jumps to ${countText(chain.jumps, "more enemy", "more enemies")} within ${pxText(chain.range)}.`;
}

function hybridBehaviour(weapon: Readonly<WeaponDef>): string {
  const hybrid = weapon.hybridProjectile;
  if (!hybrid) return meleeBehaviour(weapon);
  const trigger =
    hybrid.trigger === "combo-finisher" ? "on the combo finisher" : "with every swing";
  return `Swings within ${pxText(weapon.range)} and launches ${countText(hybrid.count, "projectile")} ${trigger}.`;
}

function meleeBehaviour(weapon: Readonly<WeaponDef>): string {
  const arcDegrees = Math.max(1, Math.round((weapon.halfArc * 360) / Math.PI));
  const verb =
    weapon.swingStyle === "thrust"
      ? "Thrusts"
      : weapon.swingStyle === "punch"
        ? "Punches"
        : weapon.swingStyle === "spin"
          ? "Spins"
          : "Swings";
  return `${verb} through a ${arcDegrees}° arc up to ${pxText(weapon.range)} every ${secondsText(weapon.cooldown)}.`;
}

/**
 * Build one player-facing line from authoritative weapon data. Specialized delivery blocks win over the
 * generic melee envelope so a weapon's defining behavior is always the first thing the player reads.
 */
export function derivedWeaponBehaviourLine(weapon: Readonly<WeaponDef>): string {
  if (weapon.rez) {
    return `Revives a downed ally caught within ${pxText(weapon.rez.radius)} of the swing.`;
  }
  if (weapon.warp) {
    return `Warps a strike to your cursor and hits a ${pxText(weapon.warp.burstRadius)}-radius area.`;
  }
  if (weapon.chargedProjectile) {
    const charged = weapon.chargedProjectile;
    return `Hold for up to ${secondsText(charged.chargeSeconds)}, then release a projectile that explodes within ${pxText(charged.explosionRadiusMax)}.`;
  }
  if (weapon.groundZone) return groundZoneBehaviour(weapon);
  if (weapon.beam) return beamBehaviour(weapon);
  if (weapon.gun) return gunBehaviour(weapon);
  if (weapon.cast) return castBehaviour(weapon);
  if (weapon.thrown) return thrownBehaviour(weapon);
  if (weapon.rapidThrust) {
    return `Strikes ${weapon.rapidThrust.impacts.length} times per attack up to ${pxText(weapon.range)} every ${secondsText(weapon.cooldown)}.`;
  }
  if (weapon.quake) return quakeBehaviour(weapon);
  if (weapon.scatter) return scatterBehaviour(weapon);
  if (weapon.chainLightning) return chainBehaviour(weapon);
  if (weapon.hybridProjectile) return hybridBehaviour(weapon);
  if (weapon.performance?.aura) {
    const aura = weapon.performance.aura;
    return `Hold to damage enemies within ${pxText(aura.radius)}, spending ${numberText(aura.resourcePerSecond)} Drive per second.`;
  }
  if (weapon.hitStatus?.kind === "slow") {
    return `Hits slow enemies by ${Math.round((1 - weapon.hitStatus.multiplier) * 100)}% for ${secondsText(weapon.hitStatus.seconds)}.`;
  }
  return meleeBehaviour(weapon);
}

/** Authored catalog copy is the explicit override; data-derived behavior guarantees every fallback. */
export function weaponBehaviourLine(weapon: Readonly<WeaponDef>): string {
  const authored = weapon.description?.trim();
  return authored || derivedWeaponBehaviourLine(weapon);
}
