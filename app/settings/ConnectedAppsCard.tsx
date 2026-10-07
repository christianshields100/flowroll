"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { disconnectApp } from "./oauth-actions";

type Row = { id: string; client_name: string; scope: string; created_at: string; last_used_at: string | null };

// AI tools the athlete has connected through "Connect FlowRoll" (OAuth).
export function ConnectedAppsCard({ apps }: { apps: Row[] }) {
  const [confirm, setConfirm] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onDisconnect(id: string) {
    if (confirm !== id) {
      setConfirm(id);
      return;
    }
    setConfirm(null);
    startTransition(async () => {
      await disconnectApp(id);
    });
  }

  const fmt = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "never";

  return (
    <section id="connected-apps" className="mt-12 max-w-2xl">
      <p className="text-[11px] uppercase tracking-dojo text-accent">Connected apps</p>
      <p className="mt-1 text-sm text-ink-mute">
        AI assistants you&apos;ve connected to your log. See{" "}
        <Link href="/connect" className="underline hover:text-ink">
          how to connect one
        </Link>
        .
      </p>
      {apps.length === 0 ? (
        <p className="mt-4 text-sm italic text-ink-mute">Nothing connected yet.</p>
      ) : (
        <ul className="mt-4 border border-paper-line divide-y divide-paper-line">
          {apps.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-4 p-4">
              <span>
                <span className="block text-sm text-ink">{a.client_name}</span>
                <span className="block text-[12px] text-ink-mute">
                  {/\bwrite\b/.test(a.scope) ? "Read & log sessions" : "Read only"} · connected {fmt(a.created_at)} · last used{" "}
                  {fmt(a.last_used_at)}
                </span>
              </span>
              <button
                type="button"
                disabled={pending}
                onClick={() => onDisconnect(a.id)}
                className={`text-[11px] uppercase tracking-dojo transition-colors disabled:opacity-50 ${
                  confirm === a.id ? "text-accent" : "text-ink-mute hover:text-accent"
                }`}
              >
                {confirm === a.id ? "Confirm disconnect" : "Disconnect"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
