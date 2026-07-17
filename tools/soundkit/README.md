# soundkit — weapon/impact SFX via ElevenLabs sound-generation

Setup: create `.env` at the repo root with `ELEVENLABS_API_KEY=<your key>` (never commit it).

- `node tools/soundkit/gen-sfx.mjs` — generate + install priority-1 sounds (resumable; skips existing raws in `out/`)
- Flags: `--priority N` (default 1), `--only <id>`, `--dry-run` (plan only, no key needed), `--manifest <path>`
- `node tools/soundkit/check-sfx.mjs` — verify installs vs manifest; exit 1 if any P1 file is missing

Contract: `sfx-manifest.json` is an array of `{ id, category, priority, prompt, durationSeconds, loop, variations, replaces }`;
malformed entries are skipped with a warning. Raws land in `tools/soundkit/out/<id>[-vN].mp3`, installs in
`packages/client/public/audio/sfx/<id>[-vN].mp3` (`-vN` only when `variations > 1`).
