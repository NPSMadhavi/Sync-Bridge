import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

// Create database connection with fallback handling
let pool: any = null;
let db: any = null;

try {
  if (process.env.DATABASE_URL) {
    pool = new Pool({ 
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 5000,
      max: 10
    });
    db = drizzle({ client: pool, schema });
    console.log('Connected to PostgreSQL database');
  } else {
    throw new Error('DATABASE_URL not provided');
  }
} catch (error) {
  console.error('Database connection failed:', error.message);
  throw error; // Don't fallback for main database - this should fail deployment if DB is not available
}

export { pool, db };