import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
});

try {
  const max = await pool.query(
    "SELECT setting::int AS max_connections FROM pg_settings WHERE name = 'max_connections'"
  );
  const active = await pool.query(
    "SELECT count(*)::int AS cnt FROM pg_stat_activity WHERE datname = current_database()"
  );
  const sessions = await pool.query(
    "SELECT pid, application_name, state, backend_start FROM pg_stat_activity WHERE datname = current_database() ORDER BY backend_start"
  );
  console.log("max_connections:", max.rows[0]);
  console.log("active_connections:", active.rows[0]);
  console.log("sessions:", sessions.rows);
} finally {
  await pool.end();
}
