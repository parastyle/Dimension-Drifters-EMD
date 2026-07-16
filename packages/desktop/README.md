# Dimension Drifters desktop

`pnpm --filter @dd/desktop dev` keeps the existing development behavior: Electron loads
`DD_CLIENT_URL`, or `http://localhost:5180` when that variable is unset, and retries while Vite starts.

`pnpm --filter @dd/desktop package` rebuilds the client, stages `packages/client/dist`, and creates
an unsigned Windows x64 directory build at `packages/desktop/release/win-unpacked`. The workspace
`build` script consumes an already-built client; the `@dd/client` workspace dev dependency makes
`pnpm -r build` order the client before desktop. The packaged renderer loads from a privileged
`ddapp://` origin. This keeps Vite's `/assets/...` URLs and Phaser's relative `sprites/...`,
`belt/...`, and other public asset URLs on the same origin without opening a local HTTP port.

## Colyseus is not bundled

The packaged app still requires a separately running Colyseus server. The client constructs its
endpoint in `packages/client/src/scenes/ArenaScene.ts` as
`ws://<location.hostname>:DEFAULT_PORT`. Desktop uses `DD_SERVER_HOST` (default `localhost`) as the
packaged origin hostname, and `DEFAULT_PORT` is exported by `packages/shared/src/constants.ts`
(currently 2567). Set `DD_SERVER_HOST` to change the server hostname before launching the packaged
executable; change `DEFAULT_PORT` and rebuild the client to use a different port. `DD_CLIENT_URL`
remains a development-only override. No server process is included or started by this package.
