/**
 * B45 physical recoil authoring.
 *
 * Gun recoil is an instantaneous impulse-speed budget in px/s:
 *
 *   raw = 20 + 7 * sqrt(directDamagePerTrigger) + sizeBonus + familyBonus
 *
 * `directDamagePerTrigger` is damage per projectile times the fixed/expected pellet count. Size bonuses
 * are S=0, M=15, L=30, XL=55. Family bonuses encode the catalog's physical heft (pistol=0, rifle=30,
 * shotgun=70, hand-cannon=80, launcher/cannon=105, railgun=110, heavy ordnance=125). Rapid fire is then
 * capped to a 180 px/s sustained budget: per-bullet recoil <= 180 * fireRate. The final authored value is
 * rounded to a whole px/s and clamped to 8..300.
 *
 * Ranged beams use the same damage/family/size facts but author a deliberately subtle acceleration budget
 * (px/s added per second of channeling), capped at 42. Caster beams remain zero under B44's planted-caster
 * law. A top-level catalog `recoil` value may override either derived result for one-weapon tuning.
 */

const SIZE_BONUS = Object.freeze({ S: 0, M: 15, L: 30, XL: 55 });

function pelletCount(behavior) {
  if (behavior.randomPellets) {
    return Math.max(1, (behavior.randomPellets.min + behavior.randomPellets.max) / 2);
  }
  return Math.max(1, behavior.pellets ?? 1);
}

function familyBonus(family) {
  const value = String(family ?? "").toLowerCase();
  if (value === "hand-cannon") return 80;
  if (/shotgun|blunderbuss|scrap-cannon|scattergun/.test(value)) return 70;
  if (/heavy-ordnance/.test(value)) return 125;
  if (/railgun/.test(value)) return 110;
  if (/grenade-launcher|rocket|mortar|howitzer|concussion-cannon|cannon|launcher/.test(value))
    return 105;
  if (/marksman-rifle|lever-rifle|auto-rifle|long.?rifle/.test(value)) return 30;
  if (/exotic-ranged/.test(value)) return 15;
  return 0;
}

export function directDamagePerTrigger(behavior) {
  return Math.max(0, Number(behavior.damage) || 0) * pelletCount(behavior);
}

export function deriveGunRecoil({ behavior, family, size }) {
  const damageTerm = 7 * Math.sqrt(directDamagePerTrigger(behavior));
  const raw =
    20 + damageTerm + (SIZE_BONUS[size] ?? SIZE_BONUS.M) + familyBonus(family);
  const fireRate = Math.max(0.01, Number(behavior.fireRate) || 0.3);
  const rapidBudget = fireRate <= 0.2 ? 180 * fireRate : Number.POSITIVE_INFINITY;
  return Math.max(8, Math.min(300, Math.round(Math.min(raw, rapidBudget))));
}

export function deriveBeamRecoil({ behavior, family, size, type }) {
  if (type !== "ranged") return 0;
  const familyHeft = /railgun|heavy-ordnance/.test(String(family ?? "").toLowerCase()) ? 8 : 0;
  const raw =
    12 +
    2 * Math.sqrt(Math.max(0, Number(behavior.damage) || 0)) +
    (SIZE_BONUS[size] ?? SIZE_BONUS.M) * 0.25 +
    familyHeft;
  return Math.max(8, Math.min(42, Math.round(raw)));
}
