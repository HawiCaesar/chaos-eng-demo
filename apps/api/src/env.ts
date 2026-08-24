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

export type ApiEnv = Env & {
  DATABASE_URL: string;
  AUDIT_DATABASE_URL: string;
};

export const env: ApiEnv = {
  ...parsed,
  DATABASE_URL: parsed.DATABASE_URL,
  AUDIT_DATABASE_URL: parsed.AUDIT_DATABASE_URL,
};
