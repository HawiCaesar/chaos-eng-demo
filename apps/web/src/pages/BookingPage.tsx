import { createBookingSchema } from "@hotel-chaos/shared";
import { useQuery } from "@tanstack/react-query";
import { useId, useRef, useState } from "react";
import { Link } from "react-router";
import { ApiError, createBooking, getHealth } from "../lib/api";

type FormValues = {
  guestName: string;
  email: string;
  roomId: string;
  checkIn: string;
  checkOut: string;
};

const emptyForm: FormValues = {
  guestName: "",
  email: "",
  roomId: "",
  checkIn: "",
  checkOut: "",
};

export const BookingPage = () => {
  const formId = useId();
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const [values, setValues] = useState<FormValues>(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [successBookingId, setSuccessBookingId] = useState<string | null>(null);
  const [infrastructureError, setInfrastructureError] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    data: health,
    isPending: healthLoading,
    isError: healthFailed,
    refetch: refetchHealth,
  } = useQuery({
    queryKey: ["health"],
    queryFn: getHealth,
  });

  const handleChange = (field: keyof FormValues) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setValues((prev) => ({ ...prev, [field]: event.target.value }));
    setFieldErrors((prev) => {
      if (!prev[field]) {
        return prev;
      }
      const next = { ...prev };
      delete next[field];
      return next;
    });
    setInfrastructureError(false);
    setSubmitError(null);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setFieldErrors({});
    setInfrastructureError(false);
    setSubmitError(null);
    setSuccessBookingId(null);

    const parsed = createBookingSchema.safeParse(values);

    if (!parsed.success) {
      const details: Record<string, string[]> = {};
      for (const issue of parsed.error.errors) {
        const field = issue.path[0]?.toString() ?? "_root";
        details[field] = [...(details[field] ?? []), issue.message];
      }
      setFieldErrors(details);
      setSubmitting(false);
      errorSummaryRef.current?.focus();
      return;
    }

    try {
      const result = await createBooking(parsed.data);
      setSuccessBookingId(result.bookingId);
      setValues(emptyForm);
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 503 && error.body.code === "DATABASE_UNAVAILABLE") {
          setInfrastructureError(true);
        } else if (error.status === 400 && error.body.details) {
          setFieldErrors(error.body.details);
          errorSummaryRef.current?.focus();
        } else {
          setSubmitError(error.body.message);
        }
      } else {
        setSubmitError(error instanceof Error ? error.message : "Booking failed");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetryInfrastructure = () => {
    setInfrastructureError(false);
    void refetchHealth();
  };

  const fieldErrorId = (field: string) => `${formId}-${field}-error`;

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col px-6 py-12">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Book a room</h1>
        <p className="mt-2 text-slate-600">Normal path (Milestone 2)</p>
      </header>

      {infrastructureError && (
        <div
          className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950"
          role="alert"
        >
          <p className="font-medium">Database unavailable</p>
          <p className="mt-1 text-sm">
            The booking service cannot reach Postgres. Try again when the database is back.
          </p>
          <button
            type="button"
            className="mt-3 rounded-md bg-amber-900 px-3 py-2 text-sm font-medium text-amber-50 hover:bg-amber-800"
            onClick={handleRetryInfrastructure}
          >
            Retry
          </button>
        </div>
      )}

      {successBookingId && (
        <div
          className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-950"
          role="status"
        >
          <p className="font-medium">Booking confirmed</p>
          <p className="mt-1 text-sm">
            Reference:{" "}
            <span className="font-mono font-semibold">{successBookingId}</span>
          </p>
          <Link
            to={`/bookings/${successBookingId}`}
            className="mt-3 inline-block text-sm font-medium text-emerald-800 underline hover:text-emerald-900"
          >
            View booking details
          </Link>
        </div>
      )}

      <form
        className="mt-8 space-y-5 rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
        onSubmit={handleSubmit}
        noValidate
        aria-describedby={Object.keys(fieldErrors).length > 0 ? `${formId}-errors` : undefined}
      >
        <div
          ref={errorSummaryRef}
          id={`${formId}-errors`}
          tabIndex={-1}
          className="outline-none"
          aria-live="polite"
        >
          {Object.keys(fieldErrors).length > 0 && (
            <p className="mb-4 text-sm font-medium text-red-700">
              Please fix the errors below.
            </p>
          )}
          {submitError && (
            <p className="mb-4 text-sm font-medium text-red-700">{submitError}</p>
          )}
        </div>

        {(
          [
            ["guestName", "Guest name", "text"],
            ["email", "Email", "email"],
            ["roomId", "Room ID", "text"],
            ["checkIn", "Check-in", "date"],
            ["checkOut", "Check-out", "date"],
          ] as const
        ).map(([field, label, type]) => (
          <div key={field}>
            <label htmlFor={`${formId}-${field}`} className="block text-sm font-medium text-slate-700">
              {label}
            </label>
            <input
              id={`${formId}-${field}`}
              name={field}
              type={type}
              value={values[field]}
              onChange={handleChange(field)}
              aria-invalid={Boolean(fieldErrors[field]?.length)}
              aria-describedby={
                fieldErrors[field]?.length ? fieldErrorId(field) : undefined
              }
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
              disabled={submitting}
            />
            {fieldErrors[field]?.map((message) => (
              <p
                key={`${field}-${message}`}
                id={fieldErrorId(field)}
                className="mt-1 text-sm text-red-600"
              >
                {message}
              </p>
            ))}
          </div>
        ))}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Booking…" : "Book room"}
        </button>
      </form>

      <footer className="pt-8">
        <div
          className="flex flex-wrap items-center gap-2 text-sm text-slate-600"
          aria-label="API health"
        >
          <span className="font-medium text-slate-500">API</span>
          {healthLoading && <span>checking…</span>}
          {healthFailed && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-red-800">unreachable</span>
          )}
          {health && (
            <>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-800">
                {health.status}
              </span>
              <span className="font-medium text-slate-500">Database</span>
              <span
                className={
                  health.database === "up"
                    ? "rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-800"
                    : "rounded-full bg-amber-100 px-2 py-0.5 text-amber-900"
                }
              >
                {health.database}
              </span>
            </>
          )}
        </div>
      </footer>
    </main>
  );
};
