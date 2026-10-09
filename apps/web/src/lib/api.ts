import type {
  ApiErrorBody,
  AuditEvent,
  Booking,
  CreateBookingInput,
  CreateBookingResponse,
  CreateExperimentBody,
  Experiment,
  ExperimentMetricsResponse,
  ExperimentTimelineResponse,
  InfrastructureStatusResponse,
  ListAuditEventsResponse,
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

export const getErrorMessage = (caught: unknown, fallback: string): string => {
  if (caught instanceof ApiError) {
    return caught.body.message;
  }
  if (caught instanceof Error) {
    return caught.message;
  }
  return fallback;
};

export type HealthResponse = {
  status: string;
  service: string;
  timestamp: string;
  database: "up" | "down";
  auditDatabase: "up" | "down";
};

export type PrimaryDbStopResponse = {
  key: "primary-db";
  action: "stop";
};

export type PrimaryDbRestartResponse = {
  key: "primary-db";
  action: "restart";
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

const demoAccessHeaders = (demoAccessToken: string): HeadersInit => ({
  Authorization: `Bearer ${demoAccessToken}`,
});

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

export const getInfrastructure = async (): Promise<InfrastructureStatusResponse> =>
  requestJson<InfrastructureStatusResponse>("/infrastructure");

export const stopPrimaryDb = async (
  demoAccessToken: string,
): Promise<PrimaryDbStopResponse> =>
  requestJson<PrimaryDbStopResponse>("/infrastructure/primary-db/stop", {
    method: "POST",
    headers: demoAccessHeaders(demoAccessToken),
  });

export const restartPrimaryDb = async (
  demoAccessToken: string,
): Promise<PrimaryDbRestartResponse> =>
  requestJson<PrimaryDbRestartResponse>("/infrastructure/primary-db/restart", {
    method: "POST",
    headers: demoAccessHeaders(demoAccessToken),
  });

export const createExperiment = async (
  demoAccessToken: string,
  body: CreateExperimentBody = {},
): Promise<Experiment> =>
  requestJson<Experiment>("/experiments", {
    method: "POST",
    headers: demoAccessHeaders(demoAccessToken),
    body: JSON.stringify(body),
  });

export const startExperiment = async (
  id: string,
  demoAccessToken: string,
): Promise<Experiment> =>
  requestJson<Experiment>(`/experiments/${encodeURIComponent(id)}/start`, {
    method: "POST",
    headers: demoAccessHeaders(demoAccessToken),
  });

export const getExperiment = async (id: string): Promise<Experiment> =>
  requestJson<Experiment>(`/experiments/${encodeURIComponent(id)}`);

export const getCurrentExperiment = async (): Promise<Experiment> =>
  requestJson<Experiment>("/experiments/current");

export const getExperimentEvents = async (
  id: string,
): Promise<{ events: AuditEvent[] }> => {
  const response = await requestJson<ListAuditEventsResponse>(
    `/experiments/${encodeURIComponent(id)}/events`,
  );
  return { events: response.events };
};

export const getExperimentTimeline = async (
  id: string,
): Promise<ExperimentTimelineResponse> =>
  requestJson<ExperimentTimelineResponse>(
    `/experiments/${encodeURIComponent(id)}/timeline`,
  );

export const getExperimentMetrics = async (
  id: string,
): Promise<ExperimentMetricsResponse> =>
  requestJson<ExperimentMetricsResponse>(
    `/experiments/${encodeURIComponent(id)}/metrics`,
  );
