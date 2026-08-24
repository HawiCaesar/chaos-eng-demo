import { config } from "dotenv";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Client } = pg;

const apiRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "../..");
config({ path: resolve(apiRoot, ".env") });

const runAuditMigrations = async (): Promise<void> => {
  const connectionString = process.env.AUDIT_DATABASE_URL;
  if (!connectionString) {
    console.error("AUDIT_DATABASE_URL is required (set it in apps/api/.env)");
    process.exit(1);
  }

  const client = new Client({ connectionString });
  await client.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY
      );
    `);

    const migrationsDir = resolve(apiRoot, "db/audit-migrations");
    const files = (await readdir(migrationsDir))
      .filter((file) => file.endsWith(".sql"))
      .sort();

    const { rows: appliedRows } = await client.query<{ name: string }>(
      "SELECT name FROM schema_migrations",
    );
    const applied = new Set(appliedRows.map((row) => row.name));

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`skip ${file} (already applied)`);
        continue;
      }

      const sql = await readFile(resolve(migrationsDir, file), "utf8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
        await client.query("COMMIT");
        console.log(`applied ${file}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    await client.end();
  }
};

runAuditMigrations().catch((error) => {
  console.error(error);
  process.exit(1);
});
