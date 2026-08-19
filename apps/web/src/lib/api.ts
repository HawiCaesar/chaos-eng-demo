import type {
  ApiErrorBody,
  Booking,
  CreateBookingInput,
  CreateBookingResponse,
} from "@hotel-chaos/shared";

export class ApiError extends Error {
  readonly status: number;
  readonly body: ApiErrorBody;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

export type HealthResponse = {
  status: string;
  service: string;
  timestamp: string;
  database: "up" | "down";
};

export const getApiBaseUrl = (): string => {
  const base = import.meta.env.VITE_API_URL?.replace(/\/$/, "");
  return base ?? "http://localhost:3001";
};

const parseErrorBody = async (response: Response): Promise<ApiErrorBody> => {
  try {
    const data = (await response.json()) as ApiErrorBody;
    if (typeof data.message === "string") {
      return data;
    }
  } catch {
    // fall through
  }

  return { message: response.statusText || "Request failed" };
};

const requestJson = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const body = await parseErrorBody(response);
    throw new ApiError(response.status, body);
  }

  return (await response.json()) as T;
};

export const getHealth = async (): Promise<HealthResponse> =>
  requestJson<HealthResponse>("/health");

export const createBooking = async (
  input: CreateBookingInput,
): Promise<CreateBookingResponse> =>
  requestJson<CreateBookingResponse>("/bookings", {
    method: "POST",
    body: JSON.stringify(input),
  });

export const getBooking = async (bookingId: string): Promise<Booking> =>
  requestJson<Booking>(`/bookings/${encodeURIComponent(bookingId)}`);
