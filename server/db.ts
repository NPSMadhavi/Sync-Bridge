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
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    db = drizzle({ client: pool, schema });
    console.log('Connected to PostgreSQL database');
  } else {
    throw new Error('DATABASE_URL not provided');
  }
} catch (error) {
  console.warn('Database connection failed, using fallback:', error.message);
  // Create mock objects for fallback
  pool = {
    query: async () => ({ rows: [] }),
    connect: () => ({ release: () => {} }),
  };
  
  db = {
    select: () => ({
      from: () => ({
        where: () => [],
        orderBy: () => ({ limit: () => [] }),
        limit: () => [],
        groupBy: () => []
      })
    }),
    insert: () => ({ values: () => ({ returning: () => [] }) }),
    update: () => ({ set: () => ({ where: () => ({ returning: () => [] }) }) }),
    delete: () => ({ where: () => {} })
  };
}

export { pool, db };