---
name: ddv2-no-player-auras
description: DDv2 weapons must never render an aura/glow around the player character
metadata: 
  node_type: memory
  type: feedback
  originSessionId: a77d4384-de26-420e-a954-33923a9ca83d
  modified: 2026-07-24T04:20:26.215Z
---

Weapon VFX must never include a persistent aura, glow, or halo rendered around the PLAYER
character. Effects belong on the weapon, the strike, or the target — not wrapped around the
wielder.

**Why:** Owner note (2026-07-24, training): "All the new martial art weapons have player aura.
Get that shit out, never again." The B14/B19 kung-fu wrap VFX shipped with per-style player
auras and the owner rejected them outright.

**How to apply:**
- When authoring weapon VFX recipes, no layer may attach to/follow the player body as an ambient
  aura (impact flashes, strike trails, and projectile effects are fine).
- When briefing VFX Sols, include this ban alongside the chain/tassel ban.
- If a recipe needs a "charged" tell, put it on the WEAPON sprite, not around the character.

Related: [[ddv2-no-chain-physics]]
