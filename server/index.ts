import { config } from "dotenv";

config();

import { createServer } from "http";
import app from "./app.js";
import { initPresenceWebSocketServer } from "./presence-ws.js";
import { initSocketServer } from "./socket.js";

const PORT = process.env.PORT || 3001;

const server = createServer(app);
initPresenceWebSocketServer(server);
initSocketServer(server);

server.listen(PORT, () => {
  console.log(`🚀 Boardly API running on http://localhost:${PORT}`);
});
