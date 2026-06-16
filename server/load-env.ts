import { config } from "dotenv";

// Local Vercel pulls write secrets to .env.local. Load it first so the server
// sees the same values as a Vercel deployment, then fill any gaps from .env.
config({ path: ".env.local" });
config();
