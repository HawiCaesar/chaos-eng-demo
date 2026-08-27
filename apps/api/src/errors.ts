import type { NextFunction, Request, Response } from "express";
import { RailwayClientError } from "@hotel-chaos/railway-client";
import type { ZodError } from "zod";

const NODE_CONNECTION_CODES = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "EHOSTUNREACH",
  "ENOTFOUND",
  "EPIPE",
  "ETIMEDOUT",
]);

const PG_CONNECTION_CLASS_PREFIX = "08";
const PG_UNAVAILABLE_CODES = new Set(["57P01", "53300"]);

export const zodValidationDetails = (error: ZodError): Record<string, string[]> => {
  const details: Record<string, string[]> = {};

  for (const issue of error.errors) {
    const field = issue.path.length > 0 ? issue.path.join(".") : "_root";
    const messages = details[field] ?? [];
    messages.push(issue.message);
    details[field] = messages;
  }

  return details;
};

export const isDatabaseUnavailable = (error: unknown): boolean => {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return false;
  }

  const code = String((error as { code: unknown }).code);

  if (NODE_CONNECTION_CODES.has(code)) {
    return true;
  }

  if (code.startsWith(PG_CONNECTION_CLASS_PREFIX)) {
    return true;
  }

  return PG_UNAVAILABLE_CODES.has(code);
};

export const errorHandler = (
  error: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
): void => {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (isDatabaseUnavailable(error)) {
    res.status(503).json({
      code: "DATABASE_UNAVAILABLE",
      message: "Database is unavailable",
    });
    return;
  }

  if (error instanceof RailwayClientError) {
    res.status(502).json({
      code: "RAILWAY_UNAVAILABLE",
      message: error.message,
    });
    return;
  }

  console.error(error);
  res.status(500).json({ message: "Internal server error" });
};
