import { config } from "dotenv";

config();

import { createServer } from "http";
import app from "./app.js";

const PORT = process.env.PORT || 3001;

const server = createServer(app);

server.listen(PORT, () => {
  console.log(`🚀 Boardly API running on http://localhost:${PORT}`);
});
