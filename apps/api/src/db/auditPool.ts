import pg from "pg";
import { env } from "../env.js";

const { Pool } = pg;

let auditPool: pg.Pool | null = null;

export const getAuditPool = (): pg.Pool => {
  if (!auditPool) {
    auditPool = new Pool({
      connectionString: env.AUDIT_DATABASE_URL,
      connectionTimeoutMillis: 2_000,
    });
    auditPool.on("error", (error) => {
      console.error("audit database pool error", error);
    });
  }
  return auditPool;
};

export const closeAuditPool = async (): Promise<void> => {
  if (!auditPool) {
    return;
  }
  const active = auditPool;
  auditPool = null;
  await active.end();
};
