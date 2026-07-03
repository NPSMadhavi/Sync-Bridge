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
  schemaEnsured?: boolean;
  schemaReadyPromise?: Promise<void>;
};

const globalForDb = globalThis as typeof globalThis & { __syncbridgeDb?: DbGlobal };

const isNeon = () =>
  Boolean(process.env.DATABASE_URL?.includes("pooler.internal.neon.tech"));

function resolvePoolMax(): number {
  const configuredMax = Number(process.env.PG_POOL_MAX);
  if (Number.isFinite(configuredMax) && configuredMax > 0) {
    return configuredMax;
  }
  return isNeon() ? 3 : 2;
}

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
  const maxConnections = resolvePoolMax();

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
    idleTimeoutMillis: 5_000,
    max: maxConnections,
    allowExitOnIdle: true,
    application_name: "syncbridge",
  });
}

function createDrizzle(activePool: PgPoolLike) {
  return isNeon()
    ? drizzle({ client: activePool as Pool, schema })
    : drizzleNode(activePool as pg.Pool, { schema });
}

function scheduleSchemaPatches(activePool: PgPoolLike) {
  if (globalForDb.__syncbridgeDb?.schemaEnsured) {
    return;
  }

  const schemaReadyPromise = import("./ensure-schema")
    .then(({ runAllSchemaPatches }) => runAllSchemaPatches(activePool))
    .then(() => {
      console.log("[ensure-schema] complete");
    })
    .catch((err: Error) => {
      console.warn("[ensure-schema] failed:", err.message);
    });

  globalForDb.__syncbridgeDb = {
    ...globalForDb.__syncbridgeDb,
    schemaEnsured: true,
    schemaReadyPromise,
  };
}

// Create database connection with singleton pool (survives dev reloads)
let pool: PgPoolLike | null = null;
let db: DbGlobal["db"] = null;

try {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL not provided");
  }

  const existing = globalForDb.__syncbridgeDb;

  if (existing?.pool) {
    pool = existing.pool;
    db = existing.db ?? createDrizzle(pool);
    globalForDb.__syncbridgeDb = { ...existing, pool, db };
    if (!existing.schemaEnsured) {
      scheduleSchemaPatches(pool);
    }
  } else {
    pool = createPool();

    if (pool instanceof pg.Pool) {
      pool.on("error", (err) => {
        console.error("[db] Unexpected idle pool client error:", err.message);
      });
    }

    db = createDrizzle(pool);
    globalForDb.__syncbridgeDb = { pool, db };
    registerPoolShutdown(pool);

    const poolMax =
      pool instanceof pg.Pool ? pool.options.max : (pool as Pool).options?.max;
    console.log(`Connected to PostgreSQL database (pool max=${poolMax ?? "default"})`);

    scheduleSchemaPatches(pool);
  }
} catch (error) {
  console.error("Database connection failed:", (error as Error).message);
  throw error;
}

/** Resolves after startup schema patches finish (or fail). Safe to call before patches run. */
export function whenSchemaReady(): Promise<void> {
  return globalForDb.__syncbridgeDb?.schemaReadyPromise ?? Promise.resolve();
}

export { pool, db };
