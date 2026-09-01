import pg from "pg";
import { env } from "../env.js";

const { Pool } = pg;

let pool: pg.Pool | null = null;

export const getPool = (): pg.Pool => {
  if (!pool) {
    pool = new Pool({
      connectionString: env.DATABASE_URL,
      connectionTimeoutMillis: 2_000,
    });
    pool.on("error", (error) => {
      console.error("primary database pool error", error);
    });
  }
  return pool;
};

export const closePool = async (): Promise<void> => {
  if (!pool) {
    return;
  }
  const active = pool;
  pool = null;
  await active.end();
};
