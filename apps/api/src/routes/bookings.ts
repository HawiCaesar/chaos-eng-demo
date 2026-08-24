import { createBookingSchema } from "@hotel-chaos/shared";
import { Router } from "express";
import { recordAuditEvent } from "../audit/recordAuditEvent.js";
import {
  findBookingByPublicId,
  insertBooking,
} from "../db/bookingsRepository.js";
import { isDatabaseUnavailable, zodValidationDetails } from "../errors.js";

export const bookingsRouter = Router();

bookingsRouter.post("/bookings", async (req, res, next) => {
  const requestId = req.requestId;

  await recordAuditEvent({
    eventType: "REQUEST_RECEIVED",
    requestId,
  });

  const parsed = createBookingSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      message: "Validation failed",
      details: zodValidationDetails(parsed.error),
    });
    return;
  }

  await recordAuditEvent({
    eventType: "VALIDATION_PASSED",
    requestId,
  });

  await recordAuditEvent({
    eventType: "BOOKING_ATTEMPTED",
    requestId,
  });

  try {
    const booking = await insertBooking(parsed.data);

    await recordAuditEvent({
      eventType: "BOOKING_CREATED",
      requestId,
      bookingId: booking.bookingId,
    });

    res.status(201).json({
      status: booking.status,
      bookingId: booking.bookingId,
    });
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      await recordAuditEvent(
        { eventType: "DATABASE_UNAVAILABLE", requestId },
        { critical: true },
      );
      await recordAuditEvent(
        { eventType: "BOOKING_FAILED", requestId },
        { critical: true },
      );
    }
    next(error);
  }
});

bookingsRouter.get("/bookings/:id", async (req, res, next) => {
  try {
    const booking = await findBookingByPublicId(req.params.id);

    if (!booking) {
      res.status(404).json({ message: "Booking not found" });
      return;
    }

    res.status(200).json(booking);
  } catch (error) {
    next(error);
  }
});
