import type { Booking } from "@hotel-chaos/shared";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router";
import { ApiError, getBooking } from "../lib/api";

export const BookingDetailsPage = () => {
  const { bookingId } = useParams<{ bookingId: string }>();

  const {
    data: booking,
    isPending,
    isError,
    error,
  } = useQuery({
    queryKey: ["booking", bookingId],
    queryFn: () => getBooking(bookingId!),
    enabled: Boolean(bookingId),
    retry: false,
  });

  if (!bookingId) {
    return (
      <main className="mx-auto min-h-screen max-w-lg px-6 py-12">
        <Link to="/" className="text-sm font-medium text-slate-600 hover:text-slate-900">
          ← Back to booking
        </Link>
        <p className="mt-8 text-slate-700" role="alert">
          Booking not found for <span className="font-mono">unknown id</span>.
        </p>
      </main>
    );
  }

  const isNotFound = isError && error instanceof ApiError && error.status === 404;
  const errorMessage =
    isError && !isNotFound
      ? error instanceof ApiError
        ? error.body.message
        : error instanceof Error
          ? error.message
          : "Could not load booking"
      : null;

  return (
    <main className="mx-auto min-h-screen max-w-lg px-6 py-12">
      <Link to="/" className="text-sm font-medium text-slate-600 hover:text-slate-900">
        ← Back to booking
      </Link>

      <h1 className="mt-6 text-2xl font-semibold text-slate-900">Booking details</h1>

      {isPending && (
        <div className="mt-8 animate-pulse space-y-4" aria-busy="true" aria-label="Loading booking">
          <div className="h-4 w-1/3 rounded bg-slate-200" />
          <div className="h-4 w-full rounded bg-slate-200" />
          <div className="h-4 w-5/6 rounded bg-slate-200" />
          <div className="h-4 w-2/3 rounded bg-slate-200" />
        </div>
      )}

      {isNotFound && (
        <p className="mt-8 text-slate-700" role="alert">
          Booking not found for <span className="font-mono">{bookingId}</span>.
        </p>
      )}

      {errorMessage && (
        <p className="mt-8 text-red-700" role="alert">
          {errorMessage}
        </p>
      )}

      {booking && <BookingDetailsList booking={booking} />}
    </main>
  );
};

const BookingDetailsList = ({ booking }: { booking: Booking }) => (
  <dl className="mt-8 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white shadow-sm">
    {(
      [
        ["Booking ID", booking.bookingId],
        ["Status", booking.status],
        ["Guest", booking.guestName],
        ["Email", booking.email],
        ["Room", booking.roomId],
        ["Check-in", booking.checkIn],
        ["Check-out", booking.checkOut],
        ["Created", booking.createdAt],
        ["Internal ID", booking.id],
      ] as const
    ).map(([label, value]) => (
      <div key={label} className="grid grid-cols-3 gap-4 px-4 py-3 sm:grid-cols-4">
        <dt className="text-sm font-medium text-slate-500">{label}</dt>
        <dd className="col-span-2 font-mono text-sm text-slate-900 sm:col-span-3">{value}</dd>
      </div>
    ))}
  </dl>
);
