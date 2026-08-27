import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(3001),
  WEB_ORIGIN: z.string().url().default("http://localhost:5173"),
  DATABASE_URL: z.string().optional(),
  AUDIT_DATABASE_URL: z.string().optional(),
  RAILWAY_API_TOKEN: z.string().optional(),
  RAILWAY_PROJECT_ID: z.string().optional(),
  RAILWAY_ENVIRONMENT_ID: z.string().optional(),
  RAILWAY_PRIMARY_DB_SERVICE_ID: z.string().optional(),
  RAILWAY_AUDIT_DB_SERVICE_ID: z.string().optional(),
  RAILWAY_API_SERVICE_ID: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export const parseEnv = (input: NodeJS.ProcessEnv = process.env): Env =>
  envSchema.parse(input);
