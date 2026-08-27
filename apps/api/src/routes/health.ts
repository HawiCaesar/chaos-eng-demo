import { Router } from "express";
import { getAuditPool } from "../db/auditPool.js";
import { getPool } from "../db/pool.js";
import { probeDatabase } from "../db/probe.js";

export const healthRouter = Router();

healthRouter.get("/health", async (_req, res) => {
  const [database, auditDatabase] = await Promise.all([
    probeDatabase(getPool()),
    probeDatabase(getAuditPool()),
  ]);

  res.status(200).json({
    status: "ok",
    service: "booking-api",
    timestamp: new Date().toISOString(),
    database,
    auditDatabase,
  });
});
