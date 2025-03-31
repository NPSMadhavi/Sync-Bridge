#!/usr/bin/env node
import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
const { Pool } = pkg;
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read the DATABASE_URL from environment variables
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not defined');
  process.exit(1);
}

// Create a PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const pushSchema = async () => {
  try {
    console.log('Pushing schema changes to the database...');
    
    // This will execute a direct SQL query to create tables
    const schemaContent = readFileSync(resolve(__dirname, '../shared/schema.sql'), 'utf8');
    
    await pool.query(schemaContent);
    
    console.log('Schema changes pushed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Schema push failed:', error);
    process.exit(1);
  }
};

pushSchema();