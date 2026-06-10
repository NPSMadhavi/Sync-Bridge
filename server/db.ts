import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { drizzle as drizzleNode } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import ws from "ws";
import * as schema from "@shared/schema";

// Create database connection with fallback handling
let pool: any = null;
let db: any = null;

try {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL not provided');
  }

  // Check if using Neon (serverless) or local PostgreSQL
  if (process.env.DATABASE_URL.includes('pooler.internal.neon.tech')) {
    // Neon serverless configuration
    neonConfig.webSocketConstructor = ws;
    pool = new Pool({ 
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 5000,
      max: 10
    });
    db = drizzle({ client: pool, schema });
  } else {
    // Local PostgreSQL configuration
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 5000,
      max: 10
    });
    db = drizzleNode(pool, { schema });
  }
  
  console.log('Connected to PostgreSQL database');

  import('./ensure-schema').then(({ ensurePayrollSchema }) =>
    ensurePayrollSchema(pool).catch((err: Error) =>
      console.warn('[ensure-schema] skipped:', err.message)
    )
  );
} catch (error) {
  console.error('Database connection failed:', error.message);
  throw error; // Don't fallback for main database - this should fail deployment if DB is not available
}

export { pool, db };