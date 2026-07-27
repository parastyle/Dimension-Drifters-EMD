import { ENEMY_RADIUS, MOVE_SPEED, PLAYER_RADIUS, TICK_MS } from "@dd/shared";

const contactReach = PLAYER_RADIUS + ENEMY_RADIUS;
const measuredAuthLead = 49;
const enemyX = 1_000;
const drawnStartX = 900;
const sampleCount = 21;
const stepX = MOVE_SPEED * (TICK_MS / 1_000);

let phantomHitsBefore = 0;
let phantomHitsAfter = 0;

for (let sample = 0; sample < sampleCount; sample += 1) {
  const drawnX = drawnStartX + sample * stepX;
  const staleServerX = drawnX - measuredAuthLead;
  const visibleBodyIsClear = Math.abs(drawnX - enemyX) > contactReach;
  const staleBodyIsHit = Math.abs(staleServerX - enemyX) <= contactReach;
  const presentedBodyIsHit = Math.abs(drawnX - enemyX) <= contactReach;

  if (visibleBodyIsClear && staleBodyIsHit) phantomHitsBefore += 1;
  if (visibleBodyIsClear && presentedBodyIsHit) phantomHitsAfter += 1;
}

const formatRate = (hits: number): string => `${((hits / sampleCount) * 100).toFixed(2)}%`;

console.log(
  [
    "L11 scripted walk-past-enemy",
    `reach=${contactReach}px`,
    `authLead=${measuredAuthLead}px`,
    `samples=${sampleCount}`,
    `before=${phantomHitsBefore}/${sampleCount} (${formatRate(phantomHitsBefore)})`,
    `after=${phantomHitsAfter}/${sampleCount} (${formatRate(phantomHitsAfter)})`,
  ].join(" | "),
);
