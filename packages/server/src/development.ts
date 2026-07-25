process.env.NODE_ENV = "development";
process.env.DD_DEV_TOOLS = "1";

const { startGameServer } = await import("./index.js");
await startGameServer();

export {};
