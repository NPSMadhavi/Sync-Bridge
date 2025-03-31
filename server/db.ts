import { drizzle } from "drizzle-orm/postgres-js";
import { Pool } from "pg";
import postgres from "postgres";
import * as schema from "@shared/schema";

// Create connection string
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not defined");
}

// Create PostgreSQL connection pool for session store
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Create Postgres.js client for Drizzle
const client = postgres(process.env.DATABASE_URL);

// Create Drizzle instance
export const db = drizzle(client, { schema });