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

  app.get("/", (_req, res) => {
    res.json({
      success: true,
      message: "WattShare Backend API is running successfully!",
      version: "v1",
      healthCheck: `${API_PREFIX}/health`,
      frontendUrl: "http://localhost:5173",
      note: "Visit http://localhost:5173 to access the WattShare web dashboard."
    });
  });

  app.use(API_PREFIX, apiRouter);

  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}
