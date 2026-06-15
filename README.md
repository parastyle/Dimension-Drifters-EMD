# Dimension Drifters

Online co-op bullet-heaven. **The design bible is [`DIMENSION_DRIFTERS_MASTER_SPEC.md`](./DIMENSION_DRIFTERS_MASTER_SPEC.md) — single source of truth.** Read it first.

## Stack

Phaser 4 (client) · Colyseus 0.16 (authoritative server) · TypeScript strict · pnpm monorepo · Biome · Vitest. See spec §3 / §27.

## Layout

```
packages/shared   # single source of truth: constants, Colyseus Schema state, pure sim logic
packages/server   # Colyseus authoritative room (20Hz tick, §4)
packages/client   # Phaser 4 game (rendering, input, interpolation)
tools/            # tracked tooling (artkit fork, schema-validate) — §26 retro #1
data/ assets/     # hand-authored definitions + generated art
tests/            # Vitest, hot-path first — §26 retro #4
```

## Develop

```bash
pnpm install
pnpm dev:desktop  # RECOMMENDED: server + client + Electron window (matches the shipped runtime)
pnpm dev          # browser mode: server + client only (open http://localhost:5180 yourself)
# or separately:
pnpm dev:server
pnpm dev:client
```

**Prefer `pnpm dev:desktop`** — it opens the game in an Electron window with `backgroundThrottling: false`, so the render loop never pauses (the browser-tab gotcha below doesn't apply) and you're testing the same runtime you ship (§3).

Open <http://localhost:5180>, then open a **second tab** (or another machine on the LAN) to see co-op sync. WASD to move.

> **Dev gotcha — keep the Chrome window focused.** Chrome pauses `requestAnimationFrame` when its window is hidden/occluded (behind your terminal/editor), which freezes the Phaser render loop — the page connects (`players: 1`) but draws nothing until you bring Chrome to the foreground. The on-screen `loop:` debug line shows this (it stops counting up when frozen). This is a background-tab artifact only; the shipped **Electron** build (§3) uses a dedicated window and is not affected. If a `pnpm dev` restart leaves stray servers fighting over port 2567, kill lingering project node processes (the `tsx watch` supervisor respawns the server, so kill the watcher, not just the listener).

## Quality gates (mirror CI — §26 retro #7)

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

## Current milestone

**M0 — "Prove the Game"** (spec §23). Build order in §27.3.
Done so far: **step 1** (monorepo scaffold) + **step 2** (netcode handshake POC — server-authoritative blob, multi-client, interpolation, free-roam camera).
