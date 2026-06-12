import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { drizzle as drizzleNode } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import ws from "ws";
import * as schema from "@shared/schema";

type DbGlobal = {
  pool?: pg.Pool | Pool;
  db?: ReturnType<typeof drizzleNode>;
};

const globalForDb = globalThis as typeof globalThis & { __syncbridgeDb?: DbGlobal };

// Create database connection with fallback handling
let pool: DbGlobal["pool"] = null;
let db: DbGlobal["db"] = null;

try {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL not provided');
  }

  if (globalForDb.__syncbridgeDb?.pool && globalForDb.__syncbridgeDb?.db) {
    pool = globalForDb.__syncbridgeDb.pool;
    db = globalForDb.__syncbridgeDb.db;
  } else if (process.env.DATABASE_URL.includes('pooler.internal.neon.tech')) {
    // Neon serverless configuration
    neonConfig.webSocketConstructor = ws;
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 5000,
      max: 5,
    });
    db = drizzle({ client: pool, schema });
  } else {
    // Local PostgreSQL configuration
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 20000,
      max: 5,
    });
    db = drizzleNode(pool, { schema });
  }

  globalForDb.__syncbridgeDb = { pool, db };

  console.log('Connected to PostgreSQL database');

  import('./ensure-schema').then(({ ensurePayrollSchema, ensureCompaniesSchema, ensureEmployeeCompanySchema }) => {
    ensurePayrollSchema(pool).catch((err: Error) =>
      console.warn('[ensure-schema] payroll skipped:', err.message)
    );
    ensureCompaniesSchema(pool).catch((err: Error) =>
      console.warn('[ensure-schema] companies skipped:', err.message)
    );
    ensureEmployeeCompanySchema(pool).catch((err: Error) =>
      console.warn('[ensure-schema] employee company skipped:', err.message)
    );
  });
} catch (error) {
  console.error('Database connection failed:', (error as Error).message);
  throw error; // Don't fallback for main database - this should fail deployment if DB is not available
}

export { pool, db };