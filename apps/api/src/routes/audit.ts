import { listAuditEventsQuerySchema } from "@hotel-chaos/shared";
import { Router } from "express";
import { listAuditEvents } from "../db/auditEventsRepository.js";

export const auditRouter = Router();

auditRouter.get("/audit/events", async (req, res, next) => {
  const parsed = listAuditEventsQuerySchema.safeParse(req.query);

  if (!parsed.success) {
    res.status(400).json({
      message: "Invalid query parameters",
      details: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  const { requestId, bookingId } = parsed.data;

  if (!requestId && !bookingId) {
    res.status(400).json({
      message: "At least one of requestId or bookingId is required",
    });
    return;
  }

  try {
    const events = await listAuditEvents({ requestId, bookingId });
    res.status(200).json({ events });
  } catch (error) {
    next(error);
  }
});
