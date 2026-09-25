"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/app/notifications-actions";
import {
  describeNotification,
  relativeTime,
  type NotificationRow,
} from "@/lib/notifications";

// Header bell: unread badge, click for a dropdown of recent notifications.
// Opening the panel marks everything read (optimistically) — the count is
// the nudge, the list is the record.
export function NotificationBell({
  items,
  unread,
  meId,
}: {
  items: NotificationRow[];
  unread: number;
  meId: string;
}) {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(unread);
  const [list, setList] = useState(items);
  const [, startTransition] = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && count > 0) {
      setCount(0);
      setList((l) => l.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
      startTransition(async () => {
        await markAllNotificationsRead();
      });
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label={count > 0 ? `${count} unread notifications` : "Notifications"}
        aria-expanded={open}
        className="relative p-1.5 text-ink-mute hover:text-ink transition-colors"
      >
        <svg
          aria-hidden
          viewBox="0 0 20 20"
          className="h-[18px] w-[18px]"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M5 8a5 5 0 0 1 10 0v3.5l1.5 2.5h-13L5 11.5V8z" />
          <path d="M8 16a2 2 0 0 0 4 0" />
        </svg>
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-accent text-paper text-[10px] font-semibold leading-4 text-center">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] bg-paper border border-ink z-50"
        >
          <div className="px-4 py-3 border-b border-paper-line flex items-center justify-between">
            <p className="text-[11px] uppercase tracking-dojo text-ink-mute">Notifications</p>
            <Link
              href="/settings#notifications"
              onClick={() => setOpen(false)}
              className="text-[11px] text-ink-mute hover:text-ink transition-colors"
            >
              Preferences
            </Link>
          </div>
          {list.length === 0 ? (
            <p className="px-4 py-6 text-sm italic text-ink-mute">
              Nothing yet. Follow a training partner and this fills up.
            </p>
          ) : (
            <ul className="max-h-[24rem] overflow-y-auto divide-y divide-paper-line">
              {list.map((n) => {
                const { text, href } = describeNotification(n, meId);
                const fresh = !n.read_at;
                return (
                  <li key={n.id}>
                    <Link
                      href={href}
                      onClick={() => {
                        setOpen(false);
                        if (!n.read_at)
                          startTransition(async () => {
                            await markNotificationRead(n.id);
                          });
                      }}
                      className="block px-4 py-3 hover:bg-paper-sunken transition-colors"
                    >
                      <span className="flex items-start gap-3">
                        <span
                          aria-hidden
                          className={`mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full ${
                            fresh ? "bg-accent" : "bg-transparent"
                          }`}
                        />
                        <span className="flex-1 text-sm text-ink leading-snug">{text}</span>
                        <span className="shrink-0 text-[11px] text-ink-mute">
                          {relativeTime(n.created_at)}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
