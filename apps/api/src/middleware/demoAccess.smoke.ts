import assert from "node:assert/strict";
import type { NextFunction, Request, Response } from "express";

Object.assign(process.env, {
  DATABASE_URL: "postgresql://demo",
  AUDIT_DATABASE_URL: "postgresql://demo",
  DEMO_ACCESS_TOKEN: "demo-access-token-1234",
  RAILWAY_API_TOKEN: "railway-token",
  RAILWAY_ENVIRONMENT_ID: "environment-id",
  RAILWAY_PRIMARY_DB_SERVICE_ID: "primary-id",
  RAILWAY_AUDIT_DB_SERVICE_ID: "audit-id",
  RAILWAY_API_SERVICE_ID: "api-id",
});

const { createDemoAccessMiddleware } = await import("./demoAccess.js");

type MiddlewareResult = {
  nextCalled: boolean;
  statusCode: number | null;
  body: unknown;
};

const runMiddleware = (authorizationHeader?: string): MiddlewareResult => {
  const result: MiddlewareResult = {
    nextCalled: false,
    statusCode: null,
    body: null,
  };

  const request = {
    header: (name: string) =>
      name.toLowerCase() === "authorization" ? authorizationHeader : undefined,
  } as Request;

  const response = {
    status: (statusCode: number) => {
      result.statusCode = statusCode;
      return response;
    },
    json: (body: unknown) => {
      result.body = body;
      return response;
    },
  } as unknown as Response;

  const next: NextFunction = () => {
    result.nextCalled = true;
  };

  createDemoAccessMiddleware("demo-access-token-1234")(request, response, next);
  return result;
};

const missingToken = runMiddleware();
assert.equal(missingToken.statusCode, 401);
assert.equal(missingToken.nextCalled, false);

const incorrectToken = runMiddleware("Bearer incorrect-token-value");
assert.equal(incorrectToken.statusCode, 401);
assert.equal(incorrectToken.nextCalled, false);

const correctToken = runMiddleware("Bearer demo-access-token-1234");
assert.equal(correctToken.statusCode, null);
assert.equal(correctToken.nextCalled, true);

console.log("demo access middleware smoke passed");
