// Load environment variables if not already loaded
import { config } from "dotenv";
import { resolve } from "path";

// Use the working directory as the project root so the path resolution
// works in both dev (ESM) and the bundled production build (CJS) where
// import.meta.url is unavailable.
const projectRoot = process.cwd();

// Load .env from project root
config({ path: resolve(projectRoot, ".env") });

import { drizzle } from "drizzle-orm/node-postgres";
import pkg from "pg";
const { Pool } = pkg;
import * as schema from "../shared/schema.js";

if (!process.env.DATABASE_URL) {
  console.error("\n❌ ERROR: DATABASE_URL is not set!\n");
  console.error("Make sure you have a .env file in the project root with:");
  console.error("DATABASE_URL=postgresql://user:password@host:port/database\n");
  throw new Error("DATABASE_URL environment variable is not set");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Connection pool configuration
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 30000, // Return an error after 30 seconds if connection could not be established (increased from 10s)
  // Keep connections alive
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
});

// Set statement timeout on connection (30 seconds for query execution)
pool.on("connect", async (client) => {
  await client.query("SET statement_timeout = 30000"); // 30 seconds
});

// Handle pool errors gracefully
pool.on("error", (err) => {
  console.error("Unexpected error on idle database client:", err);
  // Don't exit the process, just log the error
  // The pool will handle reconnection automatically
});

// Handle connection errors
pool.on("connect", () => {
  // Connection established successfully
});

pool.on("acquire", () => {
  // Client acquired from pool
});

pool.on("remove", () => {
  // Client removed from pool
});

export const db = drizzle(pool, { schema });
export { pool };
