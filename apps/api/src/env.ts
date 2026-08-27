import { config } from "dotenv";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv, type Env } from "@hotel-chaos/shared";

const apiRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
config({ path: resolve(apiRoot, ".env") });

const parsed = parseEnv();

if (!parsed.DATABASE_URL) {
  throw new Error("DATABASE_URL is required for the booking API");
}

if (!parsed.AUDIT_DATABASE_URL) {
  throw new Error("AUDIT_DATABASE_URL is required for the booking API");
}

if (!parsed.RAILWAY_API_TOKEN) {
  throw new Error("RAILWAY_API_TOKEN is required for the booking API");
}

if (!parsed.RAILWAY_ENVIRONMENT_ID) {
  throw new Error("RAILWAY_ENVIRONMENT_ID is required for the booking API");
}

if (!parsed.RAILWAY_PRIMARY_DB_SERVICE_ID) {
  throw new Error("RAILWAY_PRIMARY_DB_SERVICE_ID is required for the booking API");
}

if (!parsed.RAILWAY_AUDIT_DB_SERVICE_ID) {
  throw new Error("RAILWAY_AUDIT_DB_SERVICE_ID is required for the booking API");
}

if (!parsed.RAILWAY_API_SERVICE_ID) {
  throw new Error("RAILWAY_API_SERVICE_ID is required for the booking API");
}

export type ApiEnv = Env & {
  DATABASE_URL: string;
  AUDIT_DATABASE_URL: string;
  RAILWAY_API_TOKEN: string;
  RAILWAY_ENVIRONMENT_ID: string;
  RAILWAY_PRIMARY_DB_SERVICE_ID: string;
  RAILWAY_AUDIT_DB_SERVICE_ID: string;
  RAILWAY_API_SERVICE_ID: string;
};

export const env: ApiEnv = {
  ...parsed,
  DATABASE_URL: parsed.DATABASE_URL,
  AUDIT_DATABASE_URL: parsed.AUDIT_DATABASE_URL,
  RAILWAY_API_TOKEN: parsed.RAILWAY_API_TOKEN,
  RAILWAY_ENVIRONMENT_ID: parsed.RAILWAY_ENVIRONMENT_ID,
  RAILWAY_PRIMARY_DB_SERVICE_ID: parsed.RAILWAY_PRIMARY_DB_SERVICE_ID,
  RAILWAY_AUDIT_DB_SERVICE_ID: parsed.RAILWAY_AUDIT_DB_SERVICE_ID,
  RAILWAY_API_SERVICE_ID: parsed.RAILWAY_API_SERVICE_ID,
};
