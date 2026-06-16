import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { drizzle as drizzleNode } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import ws from "ws";
import * as schema from "@shared/schema";

type PgPoolLike = pg.Pool | Pool;

type DbGlobal = {
  pool?: PgPoolLike;
  db?: ReturnType<typeof drizzleNode>;
  shutdownRegistered?: boolean;
};

const globalForDb = globalThis as typeof globalThis & { __syncbridgeDb?: DbGlobal };

const isNeon = () =>
  Boolean(process.env.DATABASE_URL?.includes("pooler.internal.neon.tech"));

async function closePoolSafely(existing?: PgPoolLike) {
  if (!existing || typeof (existing as pg.Pool).end !== "function") return;
  try {
    await (existing as pg.Pool).end();
  } catch {
    // Pool may already be closed after a prior restart.
  }
}

function registerPoolShutdown(poolToClose: PgPoolLike) {
  if (globalForDb.__syncbridgeDb?.shutdownRegistered) return;
  globalForDb.__syncbridgeDb = {
    ...globalForDb.__syncbridgeDb,
    shutdownRegistered: true,
  };

  const shutdown = () => {
    void closePoolSafely(poolToClose);
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
  process.once("beforeExit", shutdown);
}

function createPool(): PgPoolLike {
  const connectionString = process.env.DATABASE_URL!;
  const maxConnections = isNeon() ? 3 : 2;

  if (isNeon()) {
    neonConfig.webSocketConstructor = ws;
    return new Pool({
      connectionString,
      connectionTimeoutMillis: 5000,
      max: maxConnections,
    });
  }

  return new pg.Pool({
    connectionString,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 10_000,
    max: maxConnections,
    allowExitOnIdle: true,
    application_name: "syncbridge",
  });
}

// Create database connection with singleton pool (survives dev reloads)
let pool: PgPoolLike | null = null;
let db: DbGlobal["db"] = null;

try {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL not provided");
  }

  if (globalForDb.__syncbridgeDb?.pool && globalForDb.__syncbridgeDb?.db) {
    pool = globalForDb.__syncbridgeDb.pool;
    db = globalForDb.__syncbridgeDb.db;
  } else {
    if (globalForDb.__syncbridgeDb?.pool) {
      void closePoolSafely(globalForDb.__syncbridgeDb.pool);
    }

    pool = createPool();

    if (pool instanceof pg.Pool) {
      pool.on("error", (err) => {
        console.error("[db] Unexpected idle pool client error:", err.message);
      });
    }

    db = isNeon()
      ? drizzle({ client: pool as Pool, schema })
      : drizzleNode(pool as pg.Pool, { schema });

    globalForDb.__syncbridgeDb = { pool, db };
    registerPoolShutdown(pool);

    console.log(
      `Connected to PostgreSQL database (pool max=${isNeon() ? 3 : 2})`
    );

    import("./ensure-schema").then(
      ({
        ensurePayrollSchema,
        ensureCompaniesSchema,
        ensureEmployeeCompanySchema,
        ensureRunningNumbersSchema,
        ensureUserPermissionsSchema,
        ensureAssetTenantSchema,
        ensureEmployeeReminderSchema,
      }) => {
        const queryPool = pool as { query: (sql: string) => Promise<unknown> };
        ensurePayrollSchema(queryPool).catch((err: Error) =>
          console.warn("[ensure-schema] payroll skipped:", err.message)
        );
        ensureCompaniesSchema(queryPool).catch((err: Error) =>
          console.warn("[ensure-schema] companies skipped:", err.message)
        );
        ensureEmployeeCompanySchema(queryPool).catch((err: Error) =>
          console.warn("[ensure-schema] employee company skipped:", err.message)
        );
        ensureRunningNumbersSchema(queryPool).catch((err: Error) =>
          console.warn("[ensure-schema] running numbers skipped:", err.message)
        );
        ensureUserPermissionsSchema(queryPool).catch((err: Error) =>
          console.warn("[ensure-schema] user permissions skipped:", err.message)
        );
        ensureAssetTenantSchema(queryPool).catch((err: Error) =>
          console.warn("[ensure-schema] asset tenant skipped:", err.message)
        );
        ensureEmployeeReminderSchema(queryPool).catch((err: Error) =>
          console.warn("[ensure-schema] employee reminder skipped:", err.message)
        );
      }
    );
  }
} catch (error) {
  console.error("Database connection failed:", (error as Error).message);
  throw error;
}

export { pool, db };
