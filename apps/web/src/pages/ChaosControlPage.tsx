import type { InfrastructureServiceStatus, ServiceLifecycleStatus } from "@hotel-chaos/shared";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useId, useState } from "react";
import { ApiError, getInfrastructure, restartPrimaryDb, stopPrimaryDb } from "../lib/api";

type PendingAction = "stop" | "restart" | null;

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

export const ChaosControlPage = () => {
  const headingId = useId();
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [actionInFlight, setActionInFlight] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ["infrastructure"],
    queryFn: getInfrastructure,
    refetchInterval: pendingAction !== null ? 1000 : 3000,
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
      await refetch();
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
      await refetch();
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

  const actionsLocked = pendingAction !== null || actionInFlight;

  return (
    <main className="mx-auto min-h-screen max-w-lg px-6 py-12">
      <h1 id={headingId} className="text-2xl font-semibold tracking-tight text-slate-900">
        Chaos Control
      </h1>
      <p className="mt-2 text-slate-600">
        Stop targets Railway primary Postgres. Bookings will return 503 until you restart it.
      </p>

      {isPending && (
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
