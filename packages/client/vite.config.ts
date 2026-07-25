import { defineConfig } from "vite";

export default defineConfig({
  server: {
    // Default 5180 to dodge the common 5173 collision (and the Electron shell points at
    // 5180). Honor PORT env so tooling that assigns a port (e.g. the preview runner) can
    // run a second instance alongside the desktop dev server. Fail if that port is already in
    // use so Electron can never silently connect to a stale or unrelated service.
    port: Number(process.env.PORT) || 5180,
    strictPort: true,
    // Bind on all interfaces so a second machine on the LAN can test co-op (M0 exit
    // criterion: two people on different machines complete a run together, §23).
    host: process.env.HOST ?? true,
    // Pose Studio is a dev-only Vite entry. The existing Weaponsmith process owns the only write surface;
    // proxying it keeps the browser same-origin and leaves production/game runtime bundles untouched.
    proxy: {
      "/api/pose-studio": {
        target: `http://127.0.0.1:${Number(process.env.POSE_STUDIO_API_PORT) || 5050}`,
      },
    },
  },
  // @dd/shared is consumed as TS source; don't pre-bundle it so edits hot-reload.
  optimizeDeps: {
    exclude: ["@dd/shared"],
  },
  build: {
    rollupOptions: {
      output: {
        // Stable vendor chunk names keep the heavyweight engine + net client cached across game updates.
        manualChunks(id) {
          const moduleId = id.replaceAll("\\", "/");
          if (moduleId.includes("/node_modules/phaser/")) return "phaser";
          if (moduleId.includes("/node_modules/colyseus.js/")) return "net";
          // Shared state classes need the schema runtime at boot; keep that sliver from pulling in net.
          if (moduleId.includes("/node_modules/@colyseus/schema/")) return "schema";
        },
      },
    },
  },
});
