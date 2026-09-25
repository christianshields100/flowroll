"use client";

import { useState, useTransition } from "react";
import { updateNotificationPrefs } from "@/app/notifications-actions";

type Prefs = { social: boolean; partners: boolean; journey: boolean };

// Per-category notification toggles. In-app only — FlowRoll sends no
// notification email.
export function NotificationPrefsCard({ initial }: { initial: Prefs }) {
  const [prefs, setPrefs] = useState<Prefs>(initial);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function set(key: keyof Prefs, value: boolean) {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    setSaved(false);
    setError(null);
    startTransition(async () => {
      const res = await updateNotificationPrefs(next);
      if (res.error) setError(res.error);
      else setSaved(true);
    });
  }

  const rows: { key: keyof Prefs; label: string; hint: string }[] = [
    {
      key: "social",
      label: "Social",
      hint: "Follow requests, new followers, reactions, and comments",
    },
    {
      key: "partners",
      label: "Training partners",
      hint: "When someone logs a session that names you",
    },
    {
      key: "journey",
      label: "Your journey",
      hint: "Milestones, promotions, and your weekly recap",
    },
  ];

  return (
    <section id="notifications" className="mt-12 max-w-2xl">
      <p className="text-[11px] uppercase tracking-dojo text-accent">Notifications</p>
      <p className="mt-1 text-sm text-ink-mute">
        In-app only — the bell in the header. FlowRoll never sends notification
        emails.
      </p>
      <div className="mt-4 border border-paper-line divide-y divide-paper-line">
        {rows.map((r) => (
          <label
            key={r.key}
            className="flex items-center justify-between gap-4 p-4 cursor-pointer"
          >
            <span>
              <span className="block text-sm text-ink">{r.label}</span>
              <span className="block text-[12px] text-ink-mute">{r.hint}</span>
            </span>
            <input
              type="checkbox"
              checked={prefs[r.key]}
              disabled={pending}
              onChange={(e) => set(r.key, e.target.checked)}
              className="h-4 w-4 accent-accent"
            />
          </label>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-ink-mute">
        {error ? <span className="text-accent">{error}</span> : saved ? "Saved." : " "}
      </p>
    </section>
  );
}
