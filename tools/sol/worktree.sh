#!/usr/bin/env bash
# Sol worktree lifecycle — run each IMPLEMENTATION Sol in its own isolated git worktree so
# unrelated Sols never clobber shared files (the sprite manifest, the packed atlas, census
# guards, generated files). Design/research Sols that only write their own report do NOT need
# this — they are naturally isolated by writing distinct files; keep them in the main tree.
#
# Validated 2026-07-23: `pnpm install --prefer-offline` in a fresh worktree is ~5s (the pnpm
# store at %LOCALAPPDATA%\pnpm\store is content-addressable, so it only links), and the
# workspace link `@dd/shared <- packages/shared` points at the WORKTREE's source — real isolation.
#
# Usage:
#   tools/sol/worktree.sh create <name> [base-branch]   # make + install; prints the worktree path
#   tools/sol/worktree.sh merge  <name>                 # merge sol/<name> back into base, keep going on conflict
#   tools/sol/worktree.sh remove <name>                 # delete worktree + branch
#
# The orchestrator runs `codex exec ... < /dev/null` with cwd = the printed worktree path, lets the
# Sol edit in isolation, then verifies (typecheck/tests run INSIDE the worktree), commits on
# sol/<name>, and merges. Merge conflicts are surfaced (not silently clobbered) — resolve by hand.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WT_HOME="$(cd "$ROOT/.." && pwd)/ddv2-wt"
BASE_DEFAULT="feat/v0.118-metagame"

cmd="${1:-}"; name="${2:-}"
[ -z "$name" ] && { echo "usage: worktree.sh {create|merge|remove} <name> [base]"; exit 2; }
wt="$WT_HOME/$name"; branch="sol/$name"

case "$cmd" in
  create)
    base="${3:-$BASE_DEFAULT}"
    mkdir -p "$WT_HOME"
    git -C "$ROOT" worktree add -b "$branch" "$wt" "$base" >/dev/null
    ( cd "$wt" && pnpm install --prefer-offline >/dev/null 2>&1 )
    echo "$wt"
    ;;
  merge)
    base="${3:-$BASE_DEFAULT}"
    # commit anything left uncommitted in the worktree on its branch first
    if [ -n "$(git -C "$wt" status --porcelain 2>/dev/null)" ]; then
      git -C "$wt" add -A && git -C "$wt" commit -q -m "sol/$name work" || true
    fi
    git -C "$ROOT" checkout "$base" >/dev/null 2>&1 || true
    if git -C "$ROOT" merge --no-edit "$branch"; then
      echo "MERGED sol/$name -> $base"
    else
      echo "CONFLICT merging sol/$name -> $base — resolve in $ROOT then commit"; exit 1
    fi
    ;;
  remove)
    git -C "$ROOT" worktree remove --force "$wt" 2>/dev/null || true
    rm -rf "$wt" 2>/dev/null || true
    git -C "$ROOT" branch -D "$branch" 2>/dev/null || true
    git -C "$ROOT" worktree prune 2>/dev/null || true
    echo "removed worktree + branch for $name"
    ;;
  *) echo "usage: worktree.sh {create|merge|remove} <name> [base]"; exit 2 ;;
esac
