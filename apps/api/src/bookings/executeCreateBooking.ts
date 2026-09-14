import type { Booking, CreateBookingInput } from "@hotel-chaos/shared";
import { recordAuditEvent } from "../audit/recordAuditEvent.js";
import { insertBooking } from "../db/bookingsRepository.js";
import { isDatabaseUnavailable } from "../errors.js";
import { getActiveExperimentId } from "../experiments/store.js";

export const executeCreateBooking = async (
  input: CreateBookingInput,
  requestId: string,
): Promise<Booking> => {
  const experimentId = getActiveExperimentId();

  await recordAuditEvent({
    eventType: "VALIDATION_PASSED",
    requestId,
    experimentId,
  });

  await recordAuditEvent({
    eventType: "BOOKING_ATTEMPTED",
    requestId,
    experimentId,
  });

  try {
    const booking = await insertBooking(input);

    await recordAuditEvent({
      eventType: "BOOKING_CREATED",
      requestId,
      bookingId: booking.bookingId,
      experimentId,
    });

    return booking;
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      await recordAuditEvent(
        {
          eventType: "DATABASE_UNAVAILABLE",
          requestId,
          experimentId,
        },
        { critical: true },
      );
      await recordAuditEvent(
        {
          eventType: "BOOKING_FAILED",
          requestId,
          experimentId,
        },
        { critical: true },
      );
    }
    throw error;
  }
};
