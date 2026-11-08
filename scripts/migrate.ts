import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getPool, closePool } from "../src/db/index";

const direction = process.argv[2] === "down" ? "down" : "up";
const file = resolve(
  __dirname,
  `../src/db/migrations/0001_init_refract_schema.${direction}.sql`,
);
const sql = readFileSync(file, "utf8");

async function main() {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("COMMIT");
    console.log(`Migration 0001 ${direction} applied (${file})`);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await closePool();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
