import { Router } from "express";
import { getPool } from "../db/pool.js";

export const healthRouter = Router();

healthRouter.get("/health", async (_req, res) => {
  let database: "up" | "down" = "down";

  try {
    await getPool().query("SELECT 1");
    database = "up";
  } catch {
    database = "down";
  }

  res.status(200).json({
    status: "ok",
    service: "booking-api",
    timestamp: new Date().toISOString(),
    database,
  });
});
