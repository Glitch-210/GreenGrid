import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env";
import { API_PREFIX } from "./config/constants";
import { apiRateLimit } from "./middleware/rateLimit.middleware";
import { errorMiddleware, notFoundMiddleware } from "./middleware/error.middleware";
import { router as apiRouter } from "./routes";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.corsOrigin, credentials: true }));
  app.use(express.json());
  app.use(apiRateLimit);

  app.use(API_PREFIX, apiRouter);

  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}
