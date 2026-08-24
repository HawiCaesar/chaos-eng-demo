import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const parseRequestIdHeader = (header: string | undefined): string | null => {
  if (!header) {
    return null;
  }
  const trimmed = header.trim();
  if (!UUID_PATTERN.test(trimmed)) {
    return null;
  }
  return trimmed;
};

export const requestIdMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const fromHeader = parseRequestIdHeader(req.header("X-Request-ID"));
  const requestId = fromHeader ?? randomUUID();
  req.requestId = requestId;
  res.setHeader("X-Request-ID", requestId);
  next();
};
