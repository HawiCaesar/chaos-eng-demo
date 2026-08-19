import { z } from "zod";

export const bookingStatusSchema = z.literal("BOOKED");

export const createBookingSchema = z
  .object({
    guestName: z.string().min(1).max(200),
    email: z.string().email(),
    roomId: z.string().min(1).max(50),
    checkIn: z.string().date(),
    checkOut: z.string().date(),
  })
  .refine((data) => data.checkOut > data.checkIn, {
    message: "checkOut must be after checkIn",
    path: ["checkOut"],
  });

export const bookingSchema = z.object({
  id: z.string().uuid(),
  bookingId: z.string(),
  guestName: z.string(),
  email: z.string().email(),
  roomId: z.string(),
  checkIn: z.string().date(),
  checkOut: z.string().date(),
  status: bookingStatusSchema,
  createdAt: z.string(),
});

export const createBookingResponseSchema = z.object({
  status: bookingStatusSchema,
  bookingId: z.string(),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type Booking = z.infer<typeof bookingSchema>;
export type CreateBookingResponse = z.infer<typeof createBookingResponseSchema>;

export type ApiErrorBody = {
  message: string;
  code?: string;
  details?: Record<string, string[]>;
};
