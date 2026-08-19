import type { Booking, CreateBookingInput } from "@hotel-chaos/shared";
import { getPool } from "./pool.js";

type BookingRow = {
  id: string;
  booking_id: string;
  guest_name: string;
  email: string;
  room_id: string;
  check_in: Date | string;
  check_out: Date | string;
  status: string;
  created_at: Date;
};

const generatePublicBookingId = (): string => {
  const suffix = Math.floor(Math.random() * 9000) + 1000;
  return `BK-${suffix}`;
};

const formatDateColumn = (value: Date | string): string => {
  if (typeof value === "string") {
    return value.slice(0, 10);
  }
  return value.toISOString().slice(0, 10);
};

const mapRowToBooking = (row: BookingRow): Booking => ({
  id: row.id,
  bookingId: row.booking_id,
  guestName: row.guest_name,
  email: row.email,
  roomId: row.room_id,
  checkIn: formatDateColumn(row.check_in),
  checkOut: formatDateColumn(row.check_out),
  status: "BOOKED",
  createdAt: row.created_at.toISOString(),
});

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  (error as { code: string }).code === "23505";

const insertBookingWithPublicId = async (
  input: CreateBookingInput,
  bookingId: string,
): Promise<Booking> => {
  const result = await getPool().query<BookingRow>(
    `
      INSERT INTO bookings (
        booking_id,
        guest_name,
        email,
        room_id,
        check_in,
        check_out,
        status
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'BOOKED')
      RETURNING *
    `,
    [
      bookingId,
      input.guestName,
      input.email,
      input.roomId,
      input.checkIn,
      input.checkOut,
    ],
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error("Insert booking returned no row");
  }

  return mapRowToBooking(row);
};

export const insertBooking = async (input: CreateBookingInput): Promise<Booking> => {
  const firstId = generatePublicBookingId();

  try {
    return await insertBookingWithPublicId(input, firstId);
  } catch (error) {
    if (!isUniqueViolation(error)) {
      throw error;
    }
    const secondId = generatePublicBookingId();
    return insertBookingWithPublicId(input, secondId);
  }
};

export const findBookingByPublicId = async (bookingId: string): Promise<Booking | null> => {
  const result = await getPool().query<BookingRow>(
    `
      SELECT *
      FROM bookings
      WHERE booking_id = $1
    `,
    [bookingId],
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  return mapRowToBooking(row);
};
