import pg from "pg";
import dotenv from "dotenv";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../server/.env") });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const statements = [
  `ALTER TABLE employees ADD COLUMN IF NOT EXISTS pr_status TEXT`,
  `DO $$ BEGIN
    ALTER TYPE nationality ADD VALUE IF NOT EXISTS 'citizen';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$`,
  `DO $$ BEGIN
    ALTER TYPE nationality ADD VALUE IF NOT EXISTS 'pr';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$`,
  `ALTER TABLE employee_payroll ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(12,2)`,
  `ALTER TABLE employee_payroll ADD COLUMN IF NOT EXISTS employer_cpf_rate DECIMAL(5,2) DEFAULT 0.00`,
  `ALTER TABLE employee_payroll ADD COLUMN IF NOT EXISTS employer_cpf_amount DECIMAL(12,2)`,
];

try {
  for (const sql of statements) {
    await pool.query(sql);
    console.log("OK:", sql.split("\n")[0].slice(0, 60));
  }
  console.log("Migration completed.");
} catch (err) {
  console.error("Migration failed:", err.message);
  process.exit(1);
} finally {
  await pool.end();
}
