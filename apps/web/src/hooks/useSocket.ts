import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getSocket } from "../lib/socket";

/**
 * Subscribes to a socket event and invalidates the given query keys on receipt.
 *
 * Depends on a serialized form of the keys, not the array itself: every caller
 * passes an inline literal, which is a new identity on every render, so the effect
 * used to tear down and re-subscribe continuously.
 */
export function useSocketInvalidate(event: string, ...queryKeys: unknown[][]) {
  const queryClient = useQueryClient();
  const serialized = JSON.stringify(queryKeys);

  useEffect(() => {
    const socket = getSocket();
    const keys = JSON.parse(serialized) as unknown[][];
    const handler = () => {
      for (const queryKey of keys) queryClient.invalidateQueries({ queryKey });
    };
    socket.on(event, handler);
    return () => {
      socket.off(event, handler);
    };
  }, [event, queryClient, serialized]);
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
