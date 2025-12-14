import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";

// Load environment variables from .env file
config();

if (!process.env.DATABASE_URL) {
  console.error("\n❌ ERROR: DATABASE_URL is not set!\n");
  console.error("To fix this:");
  console.error("1. Create a .env file in the project root");
  console.error("2. Add your Neon database connection string:");
  console.error("   DATABASE_URL=postgresql://user:password@host:port/database\n");
  console.error("Get your connection string from: https://neon.tech\n");
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  schema: "./shared/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
