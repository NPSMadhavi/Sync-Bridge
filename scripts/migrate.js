#!/usr/bin/env node
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
const { Pool } = pkg;

// Read the DATABASE_URL from environment variables
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not defined');
  process.exit(1);
}

// Create a PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const runMigration = async () => {
  try {
    console.log('Running database migrations...');
    const db = drizzle(pool);
    
    // This will automatically create tables based on your schema
    await migrate(db, { migrationsFolder: 'drizzle' });
    
    console.log('Migrations completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
};

runMigration();