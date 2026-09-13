import type { Server as HttpServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { isOriginAllowed } from "../config/cors";
import { logger } from "../lib/logger";
import { userRoom, zoneRoom } from "./events";

let io: SocketIOServer | null = null;

export function initSocket(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: (origin, callback) => {
        callback(null, isOriginAllowed(origin));
      },
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (token) {
      try {
        const payload = jwt.verify(token, env.jwtSecret) as { id: string };
        socket.join(userRoom(payload.id));
      } catch {
        logger.warn("Socket auth failed", { socketId: socket.id });
      }
    }

    socket.on("zone:subscribe", (gridZoneId: string) => {
      socket.join(zoneRoom(gridZoneId));
    });

    socket.on("zone:unsubscribe", (gridZoneId: string) => {
      socket.leave(zoneRoom(gridZoneId));
    });
  });

  return io;
}

export function getIO(): SocketIOServer {
  if (!io) throw new Error("Socket.IO not initialized — call initSocket first");
  return io;
}

export function emitToZone(gridZoneId: string, event: string, payload: unknown) {
  io?.to(zoneRoom(gridZoneId)).emit(event, payload);
}

export function emitToUser(userId: string, event: string, payload: unknown) {
  io?.to(userRoom(userId)).emit(event, payload);
}
