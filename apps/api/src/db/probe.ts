import type pg from "pg";

export type DatabaseProbeResult = "up" | "down";

export const probeDatabase = async (pool: pg.Pool): Promise<DatabaseProbeResult> => {
  try {
    await pool.query("SELECT 1");
    return "up";
  } catch {
    return "down";
  }
};
