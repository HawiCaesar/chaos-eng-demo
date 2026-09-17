import type {
  Experiment,
  ExperimentMetricsResult,
  ExperimentScenario,
  ExperimentStatus,
  InfrastructureServiceStatus,
  ServiceLifecycleStatus,
} from "@hotel-chaos/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useState } from "react";
import {
  ApiError,
  createExperiment,
  getCurrentExperiment,
  getExperiment,
  getExperimentMetrics,
  getExperimentTimeline,
  getInfrastructure,
  restartPrimaryDb,
  startExperiment,
  stopPrimaryDb,
} from "../lib/api";

type PendingAction = "stop" | "restart" | null;

const TERMINAL_EXPERIMENT_STATUSES: ExperimentStatus[] = ["COMPLETED", "FAILED"];

const isExperimentInFlightStatus = (status: ExperimentStatus | undefined): boolean => {
  if (!status) {
    return false;
  }
  if (status === "CREATED") {
    return false;
  }
  return !TERMINAL_EXPERIMENT_STATUSES.includes(status);
};

const displayedLifecycle = (
  service: InfrastructureServiceStatus,
  pendingAction: PendingAction,
): ServiceLifecycleStatus => {
  if (service.key !== "primary-db" || pendingAction === null) {
    return service.status;
  }

  if (pendingAction === "stop" && service.status !== "STOPPED" && service.status !== "FAILED") {
    return "STOPPING";
  }

  if (pendingAction === "restart" && service.status !== "RUNNING" && service.status !== "FAILED") {
    return "STARTING";
  }

  return service.status;
};

const statusToneClass = (status: ServiceLifecycleStatus): { dot: string; text: string } => {
  switch (status) {
    case "RUNNING":
      return { dot: "bg-emerald-500", text: "text-emerald-800" };
    case "STOPPING":
    case "STARTING":
      return { dot: "bg-amber-500", text: "text-amber-900" };
    case "STOPPED":
      return { dot: "bg-slate-400", text: "text-slate-700" };
    case "FAILED":
      return { dot: "bg-red-500", text: "text-red-800" };
  }
};

const formatTimelineTime = (isoTimestamp: string): string => {
  const date = new Date(isoTimestamp);
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
};

const experimentPollIntervalMs = (status: ExperimentStatus | undefined): number | false => {
  if (!status || !isExperimentInFlightStatus(status)) {
    return false;
  }
  return 1000;
};

const experimentStatusToneClass = (
  status: ExperimentStatus,
): { dot: string; text: string } => {
  if (status === "COMPLETED") {
    return { dot: "bg-emerald-500", text: "text-emerald-800" };
  }
  if (status === "FAILED") {
    return { dot: "bg-red-500", text: "text-red-800" };
  }
  return { dot: "bg-amber-500", text: "text-amber-900" };
};

const metricsResultToneClass = (
  result: ExperimentMetricsResult,
): { dot: string; text: string } => {
  switch (result) {
    case "RECOVERED":
      return { dot: "bg-emerald-500", text: "text-emerald-800" };
    case "FAILED":
      return { dot: "bg-red-500", text: "text-red-800" };
    case "IN_PROGRESS":
      return { dot: "bg-amber-500", text: "text-amber-900" };
    case "UNKNOWN":
      return { dot: "bg-slate-400", text: "text-slate-700" };
  }
};

const formatScenarioLabel = (scenario: ExperimentScenario): string => {
  if (scenario === "database-outage") {
    return "Database outage";
  }
  return scenario;
};

const formatNullablePercent = (value: number | null): string =>
  value === null ? "—" : `${value}%`;

const formatNullableSeconds = (value: number | null): string =>
  value === null ? "—" : `${value}s`;

export const ChaosControlPage = () => {
  const headingId = useId();
  const experimentSectionId = useId();
  const experimentStatusId = useId();
  const timelineSectionId = useId();
  const timelineListId = useId();
  const metricsSectionId = useId();
  const metricsResultId = useId();
  const queryClient = useQueryClient();
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [actionInFlight, setActionInFlight] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [experimentRunInFlight, setExperimentRunInFlight] = useState(false);
  const [experimentRunError, setExperimentRunError] = useState<string | null>(null);
  const [trackedExperimentId, setTrackedExperimentId] = useState<string | null>(null);

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ["infrastructure"],
    queryFn: getInfrastructure,
    refetchInterval: pendingAction !== null ? 1000 : 3000,
    retry: 1,
  });

  const { data: currentInFlight } = useQuery({
    queryKey: ["experiment", "current"],
    queryFn: async () => {
      try {
        return await getCurrentExperiment();
      } catch (caught) {
        if (caught instanceof ApiError && caught.status === 404) {
          return null;
        }
        throw caught;
      }
    },
    retry: false,
  });

  useEffect(() => {
    if (currentInFlight?.id) {
      setTrackedExperimentId(currentInFlight.id);
    }
  }, [currentInFlight?.id]);

  const { data: experiment } = useQuery({
    queryKey: ["experiment", trackedExperimentId],
    queryFn: () => getExperiment(trackedExperimentId!),
    enabled: trackedExperimentId !== null,
    refetchInterval: (query) =>
      experimentPollIntervalMs(query.state.data?.status),
  });

  const {
    data: timeline,
    isPending: isTimelinePending,
    isError: isTimelineError,
    error: timelineError,
    refetch: refetchTimeline,
  } = useQuery({
    queryKey: ["experiment", trackedExperimentId, "timeline"],
    queryFn: () => getExperimentTimeline(trackedExperimentId!),
    enabled: trackedExperimentId !== null,
    refetchInterval: () => {
      const cached = queryClient.getQueryData<Experiment>([
        "experiment",
        trackedExperimentId,
      ]);
      return experimentPollIntervalMs(cached?.status ?? experiment?.status);
    },
  });

  const {
    data: metrics,
    isPending: isMetricsPending,
    isError: isMetricsError,
    error: metricsError,
    refetch: refetchMetrics,
  } = useQuery({
    queryKey: ["experiment", trackedExperimentId, "metrics"],
    queryFn: () => getExperimentMetrics(trackedExperimentId!),
    enabled: trackedExperimentId !== null,
    refetchInterval: () => {
      const cached = queryClient.getQueryData<Experiment>([
        "experiment",
        trackedExperimentId,
      ]);
      return experimentPollIntervalMs(cached?.status ?? experiment?.status);
    },
  });

  const primary = data?.services.find((service) => service.key === "primary-db");

  const primaryStatus = primary?.status;

  useEffect(() => {
    if (!primaryStatus || pendingAction === null) {
      return;
    }

    if (pendingAction === "stop" && (primaryStatus === "STOPPED" || primaryStatus === "FAILED")) {
      setPendingAction(null);
      return;
    }

    if (pendingAction === "restart" && (primaryStatus === "RUNNING" || primaryStatus === "FAILED")) {
      setPendingAction(null);
    }
  }, [pendingAction, primaryStatus]);

  const handleRetry = () => {
    setActionError(null);
    void refetch();
  };

  const handleRetryTimeline = () => {
    void refetchTimeline();
  };

  const handleRetryMetrics = () => {
    void refetchMetrics();
  };

  const handleRunExperiment = async () => {
    const confirmed = window.confirm(
      "This run stops primary Postgres, submits one booking that should fail with DATABASE_UNAVAILABLE, restarts the database, then submits one booking that should succeed. Continue?",
    );
    if (!confirmed) {
      return;
    }

    setExperimentRunInFlight(true);
    setExperimentRunError(null);

    try {
      const created = await createExperiment({});
      const started = await startExperiment(created.id);
      setTrackedExperimentId(started.id);
      queryClient.setQueryData(["experiment", started.id], started);
      void queryClient.invalidateQueries({ queryKey: ["experiment", "current"] });
      void queryClient.invalidateQueries({ queryKey: ["experiment", started.id] });
      void queryClient.invalidateQueries({
        queryKey: ["experiment", started.id, "timeline"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["experiment", started.id, "metrics"],
      });
    } catch (caught) {
      setExperimentRunError(
        caught instanceof ApiError
          ? caught.body.message
          : caught instanceof Error
            ? caught.message
            : "Experiment failed to start",
      );
    } finally {
      setExperimentRunInFlight(false);
    }
  };

  const handleStop = async () => {
    const confirmed = window.confirm(
      "Stopping the primary database will make bookings fail until you restart it.",
    );
    if (!confirmed) {
      return;
    }

    setActionInFlight(true);
    setActionError(null);

    try {
      await stopPrimaryDb();
      setPendingAction("stop");
      void refetch();
    } catch (caught) {
      setActionError(
        caught instanceof ApiError
          ? caught.body.message
          : caught instanceof Error
            ? caught.message
            : "Stop failed",
      );
    } finally {
      setActionInFlight(false);
    }
  };

  const handleRestart = async () => {
    setActionInFlight(true);
    setActionError(null);

    try {
      await restartPrimaryDb();
      setPendingAction("restart");
      void refetch();
    } catch (caught) {
      setActionError(
        caught instanceof ApiError
          ? caught.body.message
          : caught instanceof Error
            ? caught.message
            : "Restart failed",
      );
    } finally {
      setActionInFlight(false);
    }
  };

  const isRailwayUnavailable =
    isError && error instanceof ApiError && error.body.code === "RAILWAY_UNAVAILABLE";
  const errorMessage = isError
    ? error instanceof ApiError
      ? error.body.message
      : error instanceof Error
        ? error.message
        : "Could not load infrastructure status"
    : null;

  const experimentInFlight = isExperimentInFlightStatus(experiment?.status);
  const actionsLocked =
    pendingAction !== null ||
    actionInFlight ||
    experimentInFlight ||
    experimentRunInFlight;

  const experimentTone = experiment
    ? experimentStatusToneClass(experiment.status)
    : null;

  const timelineErrorMessage = isTimelineError
    ? timelineError instanceof ApiError
      ? timelineError.body.message
      : timelineError instanceof Error
        ? timelineError.message
        : "Could not load experiment timeline"
    : null;

  const metricsErrorMessage = isMetricsError
    ? metricsError instanceof ApiError
      ? metricsError.body.message
      : metricsError instanceof Error
        ? metricsError.message
        : "Could not load recovery metrics"
    : null;

  const showTimelineSection = trackedExperimentId !== null;
  const metricsTone = metrics ? metricsResultToneClass(metrics.result) : null;
  const timelineEvents = timeline?.events ?? [];
  const showNoTimelineYet =
    !isTimelinePending &&
    !isTimelineError &&
    timelineEvents.length === 0 &&
    (experiment?.status === "CREATED" || experiment === undefined);

  return (
    <main className="mx-auto min-h-screen max-w-lg px-6 py-12">
      <h1 id={headingId} className="text-2xl font-semibold tracking-tight text-slate-900">
        Chaos Control
      </h1>
      <p className="mt-2 text-slate-600">
        Stop targets Railway primary Postgres. Bookings will return 503 until you restart it.
      </p>

      <section
        className="mt-8 rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
        aria-labelledby={experimentSectionId}
      >
        <h2 id={experimentSectionId} className="text-sm font-medium text-slate-500">
          Database outage experiment
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Fully automated: stop primary Postgres, one failed booking, restart, one successful booking.
        </p>

        {experiment && experimentTone && (
          <div className="mt-4 space-y-2">
            <p className="font-mono text-xs text-slate-500">{experiment.id}</p>
            <div
              id={experimentStatusId}
              className="flex items-center gap-2"
              aria-live="polite"
            >
              <span
                className={`h-2.5 w-2.5 shrink-0 rounded-full ${experimentTone.dot}`}
                aria-hidden="true"
              />
              <span className={`text-lg font-semibold ${experimentTone.text}`}>
                {experiment.status}
              </span>
            </div>
            {experiment.status === "FAILED" && experiment.error && (
              <p className="text-sm text-red-800" role="alert">
                {experiment.error}
              </p>
            )}
            {experiment.failureRequestId && (
              <p className="font-mono text-xs text-slate-600">
                Failure request: {experiment.failureRequestId}
              </p>
            )}
            {experiment.recoveryBookingId && (
              <p className="font-mono text-xs text-slate-600">
                Recovery booking: {experiment.recoveryBookingId}
              </p>
            )}
          </div>
        )}

        {experimentRunError && (
          <div
            className="mt-4 rounded-lg border border-red-300 bg-red-50 p-3 text-red-950"
            role="alert"
          >
            <p className="text-sm font-medium">Experiment could not start</p>
            <p className="mt-1 text-sm">{experimentRunError}</p>
          </div>
        )}

        <button
          type="button"
          aria-label="Run database outage experiment"
          disabled={experimentInFlight || experimentRunInFlight}
          onClick={() => void handleRunExperiment()}
          className="mt-4 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Run database outage experiment
        </button>
      </section>

      {showTimelineSection && (
        <section
          className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
          aria-labelledby={timelineSectionId}
        >
          <h2 id={timelineSectionId} className="text-sm font-medium text-slate-900">
            Experiment {trackedExperimentId}
          </h2>

          {isTimelineError && (
            <div
              className="mt-4 rounded-lg border border-red-300 bg-red-50 p-3 text-red-950"
              role="alert"
            >
              <p className="text-sm font-medium">Could not load timeline</p>
              <p className="mt-1 text-sm">{timelineErrorMessage}</p>
              <button
                type="button"
                className="mt-3 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
                onClick={handleRetryTimeline}
              >
                Retry
              </button>
            </div>
          )}

          {isTimelinePending && !isTimelineError && (
            <p className="mt-4 text-sm text-slate-500" aria-busy="true">
              Loading timeline…
            </p>
          )}

          {showNoTimelineYet && (
            <p className="mt-4 text-sm text-slate-500">No timeline yet</p>
          )}

          {!isTimelinePending && !isTimelineError && timelineEvents.length > 0 && (
            <ol
              id={timelineListId}
              className="mt-4 space-y-2"
              aria-live="polite"
              aria-label="Experiment timeline"
            >
              {timelineEvents.map((event) => (
                <li
                  key={event.id}
                  className="flex flex-col gap-0.5 border-b border-slate-100 pb-2 last:border-b-0 last:pb-0 sm:flex-row sm:items-baseline sm:gap-3"
                >
                  <time
                    dateTime={event.timestamp}
                    className="shrink-0 font-mono text-xs tabular-nums text-slate-500"
                  >
                    {formatTimelineTime(event.timestamp)}
                  </time>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-900">{event.label}</p>
                    {event.source === "audit" && (event.bookingId || event.requestId) && (
                      <p className="mt-0.5 font-mono text-xs text-slate-500">
                        {event.bookingId && <span>Booking {event.bookingId}</span>}
                        {event.bookingId && event.requestId && (
                          <span aria-hidden="true"> · </span>
                        )}
                        {event.requestId && <span>Request {event.requestId}</span>}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      {showTimelineSection && (
        <section
          className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
          aria-labelledby={metricsSectionId}
        >
          <h2 id={metricsSectionId} className="text-sm font-medium text-slate-900">
            Recovery metrics
          </h2>
          <p className="mt-1 font-mono text-xs text-slate-500">{trackedExperimentId}</p>

          {isMetricsError && (
            <div
              className="mt-4 rounded-lg border border-red-300 bg-red-50 p-3 text-red-950"
              role="alert"
            >
              <p className="text-sm font-medium">Could not load recovery metrics</p>
              <p className="mt-1 text-sm">{metricsErrorMessage}</p>
              <button
                type="button"
                className="mt-3 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
                onClick={handleRetryMetrics}
              >
                Retry
              </button>
            </div>
          )}

          {isMetricsPending && !isMetricsError && (
            <p className="mt-4 text-sm text-slate-500" aria-busy="true">
              Loading recovery metrics…
            </p>
          )}

          {!isMetricsPending && !isMetricsError && metrics && metricsTone && (
            <dl
              className="mt-4 space-y-3 text-sm"
              aria-live="polite"
              aria-labelledby={metricsSectionId}
            >
              <div className="flex justify-between gap-4">
                <dt className="text-slate-600">Scenario</dt>
                <dd className="font-medium text-slate-900">
                  {formatScenarioLabel(metrics.scenario)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-600">Requests</dt>
                <dd className="tabular-nums text-slate-900">{metrics.totalRequests}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-600">Successful</dt>
                <dd className="tabular-nums text-slate-900">{metrics.successfulRequests}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-600">Failed</dt>
                <dd className="tabular-nums text-slate-900">{metrics.failedRequests}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-600">Failure rate</dt>
                <dd className="tabular-nums text-slate-900">
                  {formatNullablePercent(metrics.failureRatePercent)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-600">Database downtime</dt>
                <dd className="tabular-nums text-slate-900">
                  {formatNullableSeconds(metrics.databaseDowntimeSeconds)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-600">Recovery time</dt>
                <dd className="tabular-nums text-slate-900">
                  {formatNullableSeconds(metrics.recoveryTimeSeconds)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 border-t border-slate-100 pt-3">
                <dt className="text-slate-600">Result</dt>
                <dd
                  id={metricsResultId}
                  className="flex items-center gap-2"
                  aria-live="polite"
                >
                  <span
                    className={`h-2.5 w-2.5 shrink-0 rounded-full ${metricsTone.dot}`}
                    aria-hidden="true"
                  />
                  <span className={`font-semibold ${metricsTone.text}`}>{metrics.result}</span>
                </dd>
              </div>
            </dl>
          )}
        </section>
      )}

      {isPending && !isError && (
        <div className="mt-8 animate-pulse space-y-4" aria-busy="true" aria-label="Loading infrastructure">
          <div className="h-24 rounded-lg bg-slate-200" />
          <div className="h-24 rounded-lg bg-slate-200" />
          <div className="h-24 rounded-lg bg-slate-200" />
        </div>
      )}

      {isError && (
        <div
          className={
            isRailwayUnavailable
              ? "mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950"
              : "mt-6 rounded-lg border border-red-300 bg-red-50 p-4 text-red-950"
          }
          role="alert"
        >
          <p className="font-medium">
            {isRailwayUnavailable ? "Railway unavailable" : "Could not load status"}
          </p>
          <p className="mt-1 text-sm">{errorMessage}</p>
          <button
            type="button"
            className="mt-3 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
            onClick={handleRetry}
          >
            Retry
          </button>
        </div>
      )}

      {actionError && (
        <div className="mt-6 rounded-lg border border-red-300 bg-red-50 p-4 text-red-950" role="alert">
          <p className="font-medium">Action failed</p>
          <p className="mt-1 text-sm">{actionError}</p>
        </div>
      )}

      {data && (
        <ul className="mt-8 space-y-4" aria-labelledby={headingId}>
          {data.services.map((service) => {
            const displayed = displayedLifecycle(service, pendingAction);
            const tone = statusToneClass(displayed);
            const statusId = `${headingId}-${service.key}-status`;

            return (
              <li
                key={service.key}
                className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
              >
                <p className="text-sm font-medium text-slate-500">{service.label}</p>
                <div id={statusId} className="mt-2 flex items-center gap-2" aria-live="polite">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${tone.dot}`} aria-hidden="true" />
                  <span className={`text-lg font-semibold ${tone.text}`}>{displayed}</span>
                </div>
                <p className="mt-1 font-mono text-xs text-slate-500">{service.rawDeploymentStatus}</p>

                {service.actions.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {service.actions.includes("stop") && (
                      <button
                        type="button"
                        aria-label="Stop primary database"
                        disabled={actionsLocked || displayed !== "RUNNING"}
                        onClick={() => void handleStop()}
                        className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Stop Database
                      </button>
                    )}
                    {service.actions.includes("restart") && (
                      <button
                        type="button"
                        aria-label="Restart primary database"
                        disabled={actionsLocked || (displayed !== "STOPPED" && displayed !== "FAILED")}
                        onClick={() => void handleRestart()}
                        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Restart Database
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
};
