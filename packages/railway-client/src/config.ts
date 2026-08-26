import { parseEnv } from "@hotel-chaos/shared";

export type RailwayClientConfig = {
  apiToken: string;
  environmentId: string;
  primaryDbServiceId: string;
  projectId?: string;
};

const requireEnv = (value: string | undefined, name: string): string => {
  if (!value?.trim()) {
    throw new Error(`${name} is required to create a RailwayClient`);
  }
  return value;
};

export const loadRailwayConfigFromEnv = (
  input: NodeJS.ProcessEnv = process.env,
): RailwayClientConfig => {
  const env = parseEnv(input);

  const config: RailwayClientConfig = {
    apiToken: requireEnv(env.RAILWAY_API_TOKEN, "RAILWAY_API_TOKEN"),
    environmentId: requireEnv(env.RAILWAY_ENVIRONMENT_ID, "RAILWAY_ENVIRONMENT_ID"),
    primaryDbServiceId: requireEnv(
      env.RAILWAY_PRIMARY_DB_SERVICE_ID,
      "RAILWAY_PRIMARY_DB_SERVICE_ID",
    ),
  };

  if (env.RAILWAY_PROJECT_ID?.trim()) {
    config.projectId = env.RAILWAY_PROJECT_ID;
  }

  return config;
};
