import pg from "pg";
import dotenv from "dotenv";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });
dotenv.config({ path: join(__dirname, "../server/.env") });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

try {
  const cols = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'employees' ORDER BY 1`
  );
  console.log("employees columns:", cols.rows.map((r) => r.column_name).join(", "));

  const rows = await pool.query(`SELECT id, name, nationality FROM employees LIMIT 3`);
  console.log("sample:", rows.rows);
} catch (err) {
  console.error("Error:", err.message);
} finally {
  await pool.end();
}
