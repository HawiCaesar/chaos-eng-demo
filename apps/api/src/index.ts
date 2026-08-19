import express from "express";
import cors from "cors";
import { closePool } from "./db/pool.js";
import { env } from "./env.js";
import { errorHandler } from "./errors.js";
import { bookingsRouter } from "./routes/bookings.js";
import { healthRouter } from "./routes/health.js";

const app = express();

app.use(cors({ origin: env.WEB_ORIGIN }));
app.use(express.json());

app.use(healthRouter);
app.use(bookingsRouter);
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
    process.exit(0);
  })().catch((error) => {
    console.error("shutdown failed", error);
    process.exit(1);
  });
};

process.on("SIGTERM", handleShutdown);
