import { db } from "../server/db.ts";
import { employees } from "../shared/schema.ts";

try {
  const rows = await db.select().from(employees).limit(2);
  console.log("ok", rows.length, rows[0]?.name);
} catch (err) {
  console.error("drizzle err:", err.message);
}
process.exit(0);
