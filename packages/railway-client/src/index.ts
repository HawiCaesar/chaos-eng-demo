import { loadRailwayConfigFromEnv } from "./config.js";
import { RailwayClient } from "./RailwayClient.js";

export const createRailwayClientFromEnv = (
  input: NodeJS.ProcessEnv = process.env,
): RailwayClient => new RailwayClient(loadRailwayConfigFromEnv(input));

export {
  loadRailwayConfigFromEnv,
  type RailwayClientConfig,
} from "./config.js";
export { toLifecycleStatus } from "./mapDeploymentStatus.js";
export { RailwayClientError, type GraphQLErrorItem } from "./errors.js";
export { RailwayClient } from "./RailwayClient.js";
export type {
  DeploymentStatusResult,
  ServiceLifecycleStatus,
  ServiceStatusResult,
} from "./types.js";
