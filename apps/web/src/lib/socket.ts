import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(import.meta.env.VITE_API_ORIGIN ?? "http://localhost:5000", {
      // Read at construction time, so the singleton must be disposed on logout
      // or the next user inherits this connection — and with it the previous
      // user's `user:<id>` room. See disconnectSocket below.
      auth: { token: localStorage.getItem("token") },
      autoConnect: true,
    });
  }
  return socket;
}

/**
 * Close the connection and drop the singleton, so the next getSocket() dials
 * again with whatever token is current. Called from logout() and from the 401
 * interceptor: a session that is over must not keep a live socket authenticated
 * as the user who just left.
 */
export function disconnectSocket() {
  if (!socket) return;
  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
}
