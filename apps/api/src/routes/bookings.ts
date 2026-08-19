import { createBookingSchema } from "@hotel-chaos/shared";
import { Router } from "express";
import {
  findBookingByPublicId,
  insertBooking,
} from "../db/bookingsRepository.js";
import { zodValidationDetails } from "../errors.js";

export const bookingsRouter = Router();

bookingsRouter.post("/bookings", async (req, res, next) => {
  const parsed = createBookingSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      message: "Validation failed",
      details: zodValidationDetails(parsed.error),
    });
    return;
  }

  try {
    const booking = await insertBooking(parsed.data);
    res.status(201).json({
      status: booking.status,
      bookingId: booking.bookingId,
    });
  } catch (error) {
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
