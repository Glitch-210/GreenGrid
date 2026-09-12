import http from "http";
import { createApp } from "./app";
import { initSocket } from "./sockets/io";
import { env } from "./config/env";
import { logger } from "./lib/logger";
import { startScheduler } from "./jobs/scheduler";

const app = createApp();
const httpServer = http.createServer(app);
initSocket(httpServer);

httpServer.listen(env.port, () => {
  logger.info(`API listening on :${env.port}`, { nodeEnv: env.nodeEnv, chainMode: env.chainMode });
  startScheduler();
});
