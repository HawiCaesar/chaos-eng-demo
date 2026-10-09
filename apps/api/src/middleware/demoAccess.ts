import { timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import { env } from "../env.js";

const getBearerToken = (authorizationHeader: string | undefined): string | null => {
  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token, ...extraParts] = authorizationHeader.trim().split(/\s+/);
  if (scheme?.toLowerCase() !== "bearer" || !token || extraParts.length > 0) {
    return null;
  }

  return token;
};

export const isValidDemoAccessToken = (
  authorizationHeader: string | undefined,
  expectedToken: string,
): boolean => {
  const providedToken = getBearerToken(authorizationHeader);
  if (!providedToken) {
    return false;
  }

  const providedBuffer = Buffer.from(providedToken);
  const expectedBuffer = Buffer.from(expectedToken);
  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(providedBuffer, expectedBuffer);
};

export const createDemoAccessMiddleware =
  (expectedToken: string): RequestHandler =>
  (req: Request, res: Response, next: NextFunction): void => {
    if (!isValidDemoAccessToken(req.header("authorization"), expectedToken)) {
      res.status(401).json({
        code: "DEMO_ACCESS_DENIED",
        message: "A valid demo access token is required",
      });
      return;
    }

    next();
  };

export const requireDemoAccess = createDemoAccessMiddleware(env.DEMO_ACCESS_TOKEN);
