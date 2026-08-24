import { Router } from "express";
import { getAuditPool } from "../db/auditPool.js";
import { getPool } from "../db/pool.js";

export const healthRouter = Router();

healthRouter.get("/health", async (_req, res) => {
  let database: "up" | "down" = "down";
  let auditDatabase: "up" | "down" = "down";

  try {
    await getPool().query("SELECT 1");
    database = "up";
  } catch {
    database = "down";
  }

  try {
    await getAuditPool().query("SELECT 1");
    auditDatabase = "up";
  } catch {
    auditDatabase = "down";
  }

  res.status(200).json({
    status: "ok",
    service: "booking-api",
    timestamp: new Date().toISOString(),
    database,
    auditDatabase,
  });
});
