import type { ServiceLifecycleStatus } from "./types.js";

/**
 * Maps Railway deployment status strings to dashboard lifecycle states.
 *
 * Railway does not expose a distinct `STOPPING` deployment status. After
 * `deploymentStop`, polling may still see transitional values (`DEPLOYING`, etc.)
 * mapped here as `STARTING`; the smoke script (step 8) can treat post-stop polls as
 * `STOPPING` until `STOPPED`.
 */
export const toLifecycleStatus = (railwayStatus: string): ServiceLifecycleStatus => {
  switch (railwayStatus.trim().toUpperCase()) {
    case "SUCCESS":
      return "RUNNING";
    case "BUILDING":
    case "DEPLOYING":
    case "QUEUED":
    case "WAITING":
      return "STARTING";
    case "REMOVED":
    case "SLEEPING":
    case "SKIPPED":
      return "STOPPED";
    case "CRASHED":
    case "FAILED":
      return "FAILED";
    default:
      return "FAILED";
  }
};
