import { useEffect, useRef, useState } from "react";
import { useApiQuery, useApiMutation } from "../../hooks/useApi";
import { useSocketInvalidate } from "../../hooks/useSocket";
import type { NotificationDTO } from "@wattshare/shared";

function relativeTime(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86_400)}d ago`;
}

/**
 * The bell used to be a `<button>` with no handler at all — the unread dot could
 * never be cleared, and `PATCH /notifications/:id/read` was called from nowhere in
 * the app. It is a menu button, so it carries the disclosure semantics to match.
 */
export function NotificationMenu() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const { data } = useApiQuery<NotificationDTO[]>(["notifications"], "/notifications");
  useSocketInvalidate("notification:new", ["notifications"]);

  const markRead = useApiMutation<{ id: string }>("patch", (body) => `/notifications/${body.id}/read`, {
    invalidates: [["notifications"]],
  });

  const notifications = data ?? [];
  const unread = notifications.filter((n) => !n.isRead);

  // Close on Escape and on an outside click, returning focus to the trigger so
  // keyboard users aren't stranded at the top of the document.
  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    function onPointerDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        className="relative border-3 border-black bg-white p-1.5 shadow-hard-sm"
        aria-label={unread.length > 0 ? `Notifications, ${unread.length} unread` : "Notifications"}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        <span aria-hidden>🔔</span>
        {unread.length > 0 && <span className="absolute -right-1 -top-1 h-3 w-3 border-2 border-black bg-fault" />}
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Notifications"
          className="absolute right-0 top-full z-30 mt-2 max-h-[70vh] w-[min(20rem,calc(100vw-2rem))] overflow-y-auto border-3 border-black bg-surface shadow-hard"
        >
          <div className="flex items-center justify-between border-b-3 border-black px-3 py-2">
            <p className="font-mono text-[10px] font-bold uppercase tracking-wider">
              Notifications{unread.length > 0 ? ` · ${unread.length} new` : ""}
            </p>
            {unread.length > 0 && (
              <button
                type="button"
                className="font-mono text-[10px] font-bold uppercase underline"
                disabled={markRead.isPending}
                onClick={() => unread.forEach((n) => markRead.mutate({ id: n.id }))}
              >
                Mark all read
              </button>
            )}
          </div>

          {notifications.length === 0 && (
            <p className="px-3 py-4 font-mono text-xs text-on-surface-variant">Nothing yet.</p>
          )}

          {notifications.map((n) => (
            <button
              key={n.id}
              type="button"
              role="menuitem"
              className={`block w-full border-b-2 border-black px-3 py-2 text-left last:border-b-0 ${
                n.isRead ? "bg-white" : "bg-surface-container-low"
              }`}
              onClick={() => !n.isRead && markRead.mutate({ id: n.id })}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-mono text-xs font-bold">{n.title}</p>
                {!n.isRead && <span aria-hidden className="mt-1 h-2 w-2 shrink-0 border border-black bg-fault" />}
              </div>
              <p className="font-mono text-[11px] text-on-surface-variant">{n.message}</p>
              <p className="mt-0.5 font-mono text-[10px] uppercase text-on-surface-variant">
                {relativeTime(n.createdAt)}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
