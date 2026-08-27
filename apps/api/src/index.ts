import express from "express";
import cors from "cors";
import { closeAuditPool } from "./db/auditPool.js";
import { closePool } from "./db/pool.js";
import { env } from "./env.js";
import { errorHandler } from "./errors.js";
import { requestIdMiddleware } from "./middleware/requestId.js";
import { auditRouter } from "./routes/audit.js";
import { bookingsRouter } from "./routes/bookings.js";
import { healthRouter } from "./routes/health.js";
import { infrastructureRouter } from "./routes/infrastructure.js";

const app = express();

app.use(cors({ origin: env.WEB_ORIGIN }));
app.use(express.json());
app.use(requestIdMiddleware);

app.use(healthRouter);
app.use(auditRouter);
app.use(bookingsRouter);
app.use(infrastructureRouter);
app.use(errorHandler);

const server = app.listen(env.PORT, () => {
  console.log(`api listening on http://localhost:${env.PORT}`);
});

const handleShutdown = (): void => {
  void (async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
    await closePool();
    await closeAuditPool();
    process.exit(0);
  })().catch((error) => {
    console.error("shutdown failed", error);
    process.exit(1);
  });
};

process.on("SIGTERM", handleShutdown);
