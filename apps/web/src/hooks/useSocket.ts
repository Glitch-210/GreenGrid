import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getSocket } from "../lib/socket";

/** Subscribes to a socket event and invalidates the given query key on receipt. */
export function useSocketInvalidate(event: string, queryKey: unknown[]) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const socket = getSocket();
    const handler = () => queryClient.invalidateQueries({ queryKey });
    socket.on(event, handler);
    return () => {
      socket.off(event, handler);
    };
  }, [event, queryClient, queryKey]);
}

export function useZoneRoom(gridZoneId: string | undefined) {
  useEffect(() => {
    if (!gridZoneId) return;
    const socket = getSocket();
    socket.emit("zone:subscribe", gridZoneId);
    return () => {
      socket.emit("zone:unsubscribe", gridZoneId);
    };
  }, [gridZoneId]);
}
