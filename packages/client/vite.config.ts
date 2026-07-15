import { defineConfig } from "vite";

export default defineConfig({
  server: {
    // Default 5180 to dodge the common 5173 collision (and the Electron shell points at
    // 5180). Honor PORT env so tooling that assigns a port (e.g. the preview runner) can
    // run a second instance alongside the desktop dev server. `strictPort: false` falls back.
    port: Number(process.env.PORT) || 5180,
    strictPort: false,
    // Bind on all interfaces so a second machine on the LAN can test co-op (M0 exit
    // criterion: two people on different machines complete a run together, §23).
    host: true,
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
