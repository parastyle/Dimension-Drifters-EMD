process.env.NODE_ENV = "production";

const { startGameServer } = await import("./index.js");
await startGameServer();

export {};
